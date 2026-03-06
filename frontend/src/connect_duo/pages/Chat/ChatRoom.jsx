// src/components/chat/ChatRoom.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import {
    listMessages,
    markRead,
    sendMessage as apiSendMessage,
    uploadRoomFiles,
    closeRoom,
    absolutizeFileUrl,
    listRooms,
    ensureSocket,
} from '../../api/chatAxios';
import { axiosAuth } from '../../api/axios';
import {
    getDraft,
    saveDraft,
    LAST_READ_MS_KEY,
    mapRowToUiMessage,
    formatBytes,
    formatExpireDate,
    isTxtLike,
    getTxtViewerUrl,
    downloadFile,
    extractMessagesSafely,
    displayFileTitle,
    escapeRegExp,
} from './chatRoomUtil';

import './ChatRoom.css';
import txtPanelIcon from '../../assets/txt.png';
import pictureIcon from '../../assets/picture.png';
import txtFileIcon from '../../assets/txt-icon.png';
import leftArrowIcon from '../../assets/left-arrow.png';
import upIcon from '../../assets/up.png';
import downIcon from '../../assets/down.png';
import { formatResponseSpeed, responseSpeedClass } from '../../utils/formatResponseSpeed';

function dayKeyFromTime(t) {
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatKoreanDayHeader(t) {
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return '';
    const WEEK = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일 ${WEEK[d.getDay()]}`;
}
function formatTimer(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const BILLING_INTERVAL = 300;

export default function ChatRoom({ roomId, onBack }) {
    const rid = useMemo(() => String(roomId ?? ''), [roomId]);
    const listRef = useRef(null);
    const markReadTimerRef = useRef(null);
    const timerRef = useRef(null);
    const billingRef = useRef({ consultSec: 0, billingSec: BILLING_INTERVAL });
    const txtInputRef = useRef(null);
    const imgInputRef = useRef(null);

    const [showAttach, setShowAttach] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dlState, setDlState] = useState({});
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeHitIdx, setActiveHitIdx] = useState(0);
    const [menuOpen, setMenuOpen] = useState(false);
    const [roomClosed, setRoomClosed] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [roomInfo, setRoomInfo] = useState(null);
    const [sendFail, setSendFail] = useState({});
    const [userCredit, setUserCredit] = useState(null);
    const [consultSec, setConsultSec] = useState(0);
    const [billingSec, setBillingSec] = useState(BILLING_INTERVAL);
    const [billingAlert, setBillingAlert] = useState('');
    const [infoOpen, setInfoOpen] = useState(false);
    // ✅ 세무사 자신의 요금 (SQL이 partner 기준이라 별도 fetch 필요)
    const [taxOwnRate, setTaxOwnRate] = useState(0);

    // ✅ Zustand store에서 유저 정보 읽기 (loginAuthUser에서 { id, user_type, ... } 저장)
    const authUser = useAuthStore((s) => s.authUser);
    const MY_ID = authUser?.id ?? null;
    const isMyTypeUser = (authUser?.user_type ?? 'USER') === 'USER';

    const isAgentOnline = useMemo(() => [...onlineUsers].some((uid) => uid !== String(MY_ID)), [onlineUsers, MY_ID]);
    const bothOnline = useMemo(
        () => onlineUsers.has(String(MY_ID)) && isAgentOnline,
        [onlineUsers, MY_ID, isAgentOnline],
    );
    // ✅ USER: 상대(세무사) 요금 / TAX_ACCOUNTANT: 자신의 요금 (partner는 일반인이라 0)
    const ratePerBilling = useMemo(() => {
        if (isMyTypeUser) return roomInfo?.partner_rate_per_10min || 0;
        return taxOwnRate;
    }, [isMyTypeUser, roomInfo, taxOwnRate]);
    const partnerCategories = useMemo(() => {
        try {
            const c = roomInfo?.partner_categories;
            if (!c) return [];
            return typeof c === 'string' ? JSON.parse(c) : c;
        } catch {
            return [];
        }
    }, [roomInfo]);

    const scrollToBottom = useCallback(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, []);

    const debouncedMarkRead = useCallback(() => {
        if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
        markReadTimerRef.current = setTimeout(() => {
            markRead(rid).catch(() => {});
            localStorage.setItem(LAST_READ_MS_KEY(rid), String(Date.now()));
            window.dispatchEvent(new Event('chat_meta_updated'));
        }, 500);
    }, [rid]);

    // ✅ 문제2: 타이머 저장/복원
    const saveTimer = useCallback(
        (cSec, bSec) => {
            try {
                localStorage.setItem(`chat_timer_${rid}`, JSON.stringify({ cSec, bSec }));
            } catch {}
        },
        [rid],
    );

    const restoreTimer = useCallback(() => {
        try {
            const raw = localStorage.getItem(`chat_timer_${rid}`);
            if (!raw) return;
            const { cSec, bSec } = JSON.parse(raw);
            if (typeof cSec === 'number' && cSec > 0) {
                billingRef.current.consultSec = cSec;
                billingRef.current.billingSec = typeof bSec === 'number' && bSec > 0 ? bSec : BILLING_INTERVAL;
                setConsultSec(cSec);
                setBillingSec(billingRef.current.billingSec);
            }
        } catch {}
    }, [rid]);

    // ✅ 문제3: 세무사도 크레딧 조회
    const fetchUserCredit = useCallback(async () => {
        if (!MY_ID) return;
        try {
            const res = await axiosAuth.get(`/credit/balance/${MY_ID}`);
            setUserCredit(res.data?.credit ?? 0);
        } catch {
            /* ignore */
        }
    }, [MY_ID]);

    const handleBilling = useCallback(async () => {
        if (!isMyTypeUser || ratePerBilling <= 0 || !rid) return;
        try {
            const balRes = await axiosAuth.get(`/credit/balance/${MY_ID}`);
            const currentCredit = balRes.data?.credit ?? 0;
            if (currentCredit < ratePerBilling) {
                setBillingAlert('⚠️ 크레딧 부족으로 상담이 종료됩니다.');
                // ✅ 문제3: 세무사에게 크레딧 부족 종료 알림
                const sock = ensureSocket();
                if (sock) sock.emit('credit_shortage', { roomId: rid });
                try {
                    await closeRoom(rid);
                } catch (_) {}
                setRoomClosed(true);
                if (timerRef.current) clearInterval(timerRef.current);
                return;
            }
            await axiosAuth.post('/credit/deduct', {
                user_id: MY_ID,
                amount: ratePerBilling,
                description: `채팅 상담 10분 요금 (방 #${rid})`,
            });
            const taxUserId = roomInfo?.tax_id;
            if (taxUserId) {
                await axiosAuth.post('/credit/charge', {
                    user_id: taxUserId,
                    amount: Math.floor(ratePerBilling * 0.9),
                    description: `채팅 수익 (방 #${rid}, 수수료 10%)`,
                });
            }
            await fetchUserCredit();
            setBillingAlert(`💳 ${ratePerBilling.toLocaleString()} 크레딧 결제 완료`);
            setTimeout(() => setBillingAlert(''), 3500);
        } catch (e) {
            console.error('[ChatRoom] 결제 오류:', e);
        }
    }, [isMyTypeUser, ratePerBilling, rid, MY_ID, roomInfo, fetchUserCredit]);

    // ✅ 타이머: USER가 마스터, 10초마다 세무사에게 sync emit
    useEffect(() => {
        if (roomClosed || ratePerBilling <= 0) return;
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            if (!bothOnline) return;
            billingRef.current.consultSec += 1;
            billingRef.current.billingSec -= 1;
            setConsultSec(billingRef.current.consultSec);
            setBillingSec(billingRef.current.billingSec);
            // 5초마다 localStorage 저장
            if (billingRef.current.consultSec % 5 === 0) {
                saveTimer(billingRef.current.consultSec, billingRef.current.billingSec);
            }
            // USER가 10초마다 세무사에게 타이머 동기화 emit
            if (isMyTypeUser && billingRef.current.consultSec % 10 === 0) {
                const sock = ensureSocket();
                if (sock)
                    sock.emit('timer_sync', {
                        roomId: rid,
                        consultSec: billingRef.current.consultSec,
                        billingSec: billingRef.current.billingSec,
                    });
            }
            if (billingRef.current.billingSec <= 0) {
                billingRef.current.billingSec = BILLING_INTERVAL;
                setBillingSec(BILLING_INTERVAL);
                if (isMyTypeUser) handleBilling();
            }
        }, 1000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [bothOnline, roomClosed, ratePerBilling, isMyTypeUser, handleBilling, saveTimer, rid]);

    // ✅ 문제4: 소켓 이벤트 및 join_room 타이밍
    useEffect(() => {
        if (!rid) return;
        const socket = ensureSocket();
        if (!socket) return;

        // 방 진입마다 온라인 상태 초기화 (room_users로 재수신)
        setOnlineUsers(new Set());

        const onReceiveMessage = (rawMsg) => {
            const uiMsg = mapRowToUiMessage(rawMsg, MY_ID, absolutizeFileUrl);
            if (!uiMsg) return;
            setMessages((prev) => {
                if (prev.some((m) => String(m.id) === String(uiMsg.id))) return prev;
                if (uiMsg.from === 'me') {
                    const tempIdx = prev.findIndex((m) => typeof m.id === 'string' && m.id.startsWith('temp-'));
                    if (tempIdx !== -1) {
                        const next = [...prev];
                        const tempId = next[tempIdx]?.id;
                        next[tempIdx] = uiMsg;
                        if (tempId)
                            setSendFail((sf) => {
                                if (!sf?.[tempId]) return sf;
                                const n = { ...sf };
                                delete n[tempId];
                                return n;
                            });
                        return next;
                    }
                    return [...prev, uiMsg];
                }
                debouncedMarkRead();
                return [...prev, uiMsg];
            });
            setTimeout(scrollToBottom, 0);
            if (uiMsg.from !== 'me') debouncedMarkRead();
        };
        const onRoomClosed = () => {
            setRoomClosed(true);
            if (timerRef.current) clearInterval(timerRef.current);
        };
        // ✅ 문제3: 세무사 크레딧 부족 종료 알림 수신
        const onCreditShortage = () => {
            setBillingAlert('⚠️ 상대방 크레딧 부족으로 상담이 종료됩니다.');
            setRoomClosed(true);
            if (timerRef.current) clearInterval(timerRef.current);
        };
        const onReadUpdated = ({ userId }) => {
            if (String(userId) !== String(MY_ID))
                setMessages((prev) => prev.map((m) => (m.from === 'me' ? { ...m, isRead: true } : m)));
        };
        // ✅ 문제4: 방 접속자 목록 (이 채팅방에 join한 사람만)
        const onCurrentUsers = ({ users }) => setOnlineUsers(new Set((users || []).map((id) => String(id))));
        const onUserOnline = ({ userId }) => setOnlineUsers((p) => new Set([...p, String(userId)]));
        const onUserOffline = ({ userId }) =>
            setOnlineUsers((p) => {
                const n = new Set(p);
                n.delete(String(userId));
                return n;
            });

        // ✅ 타이머 동기화: 세무사가 USER로부터 수신
        const onTimerSync = ({ consultSec: cs, billingSec: bs }) => {
            if (isMyTypeUser) return; // USER는 무시
            billingRef.current.consultSec = cs;
            billingRef.current.billingSec = bs;
            setConsultSec(cs);
            setBillingSec(bs);
        };

        socket.on('timer_sync', onTimerSync);
        socket.on('receive_message', onReceiveMessage);
        socket.on('ROOM_CLOSED', onRoomClosed);
        socket.on('credit_shortage', onCreditShortage);
        socket.on('read_updated', onReadUpdated);
        socket.on('room_users', onCurrentUsers);
        socket.on('user_online', onUserOnline);
        socket.on('user_offline', onUserOffline);

        // ✅ 문제4 핵심: connected 상태 확인 후 join_room - 아직 연결 중이면 connect 이후 emit
        const doJoin = () => socket.emit('join_room', rid);
        if (socket.connected) {
            doJoin();
        } else {
            socket.once('connect', doJoin);
        }

        return () => {
            socket.off('connect', doJoin);
            socket.emit('leave_room', rid);
            socket.off('timer_sync', onTimerSync);
            socket.off('receive_message', onReceiveMessage);
            socket.off('ROOM_CLOSED', onRoomClosed);
            socket.off('credit_shortage', onCreditShortage);
            socket.off('read_updated', onReadUpdated);
            socket.off('room_users', onCurrentUsers);
            socket.off('user_online', onUserOnline);
            socket.off('user_offline', onUserOffline);
            if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
        };
    }, [rid, MY_ID, isMyTypeUser, scrollToBottom, debouncedMarkRead]);

    const lastMyMsgId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) if (messages[i].from === 'me') return messages[i].id;
        return null;
    }, [messages]);

    const fetchRoomStatus = useCallback(async () => {
        if (!rid) return;
        try {
            const res = await listRooms();
            if (Array.isArray(res.data)) {
                const meRoom = res.data.find((r) => String(r.id) === rid);
                setRoomClosed(meRoom?.status === 'CLOSED');
                if (meRoom) setRoomInfo(meRoom);
            }
        } catch {
            setRoomClosed(false);
        }
    }, [rid]);

    // ✅ 세무사 자신의 chat_rate_per_10min 조회
    useEffect(() => {
        if (isMyTypeUser || !MY_ID) return;
        (async () => {
            try {
                const res = await axiosAuth.post('/profile/taxpro', { id: MY_ID });
                // 응답 구조: res.data.data.taxPro.chat_rate_per_10min
                const rate = res.data?.data?.taxPro?.chat_rate_per_10min ?? 0;
                setTaxOwnRate(Number(rate) || 0);
            } catch (e) {
                console.warn('[ChatRoom] 세무사 요금 조회 실패:', e?.message);
            }
        })();
    }, [isMyTypeUser, MY_ID]);

    const loadMessages = useCallback(async () => {
        if (!rid) return;
        try {
            setLoading(true);
            await fetchRoomStatus();
            await fetchUserCredit();
            restoreTimer(); // ✅ 문제2: 나갔다 들어와도 타이머 복원
            const res = await listMessages(rid);
            const arr = extractMessagesSafely(res, (r) => r?.messages || r?.data || r || []);
            const mapped = arr.map((m) => mapRowToUiMessage(m, MY_ID, absolutizeFileUrl));
            setMessages(mapped);
            if (mapped.length > 0) debouncedMarkRead();
        } catch (e) {
            console.error('메시지 불러오기 실패:', e);
            setMessages([]);
        } finally {
            setLoading(false);
            setTimeout(scrollToBottom, 0);
        }
    }, [rid, scrollToBottom, MY_ID, fetchRoomStatus, debouncedMarkRead, fetchUserCredit, restoreTimer]);

    useEffect(() => {
        if (!rid) {
            setLoading(false);
            setMessages([]);
            return;
        }
        const draft = getDraft(rid);
        if (draft) setInput(draft);
        loadMessages();
    }, [rid]); // eslint-disable-line

    useEffect(() => {
        if (rid) saveDraft(rid, input);
    }, [rid, input]);

    const markSendFail = useCallback((msgId) => setSendFail((p) => ({ ...(p || {}), [msgId]: true })), []);

    const sendMessage = async (overrideText) => {
        if (roomClosed) return;
        const text = (overrideText ?? input).trim();
        if (!text || !rid) return;
        setInput('');
        const tempId = `temp-${Date.now()}`;
        setMessages((prev) => [
            ...prev,
            { id: tempId, from: 'me', type: 'TEXT', text, time: new Date().toISOString(), isRead: false },
        ]);
        setTimeout(scrollToBottom, 0);
        try {
            const res = await apiSendMessage(rid, text);
            const serverMsg = res?.data;
            if (serverMsg?.id) {
                const uiMsg = mapRowToUiMessage(serverMsg, MY_ID, absolutizeFileUrl);
                setMessages((prev) => prev.map((m) => (m.id === tempId ? uiMsg : m)));
                setSendFail((p) => {
                    if (!p?.[tempId]) return p;
                    const n = { ...p };
                    delete n[tempId];
                    return n;
                });
            }
        } catch {
            markSendFail(tempId);
        }
    };

    const addFileMessages = async (files) => {
        if (roomClosed || !files?.length || !rid) return;
        try {
            await uploadRoomFiles(rid, files);
        } catch (e) {
            console.error('파일 업로드 실패:', e);
            await loadMessages();
        } finally {
            setShowAttach(false);
        }
    };

    const handleDownload = async (m) => {
        if (!m?.fileUrl) return;
        setDlState((p) => ({ ...p, [m.id]: 'loading' }));
        try {
            await downloadFile(m.fileUrl, m.fileName || 'download');
            setDlState((p) => {
                const n = { ...p };
                delete n[m.id];
                return n;
            });
        } catch (e) {
            setDlState((p) => ({ ...p, [m.id]: e?.code === 410 || e?.message === 'EXPIRED' ? 'expired' : 'failed' }));
        }
    };

    const leaveRoom = async () => {
        if (!window.confirm('정말 나가시겠습니까? 채팅방이 종료됩니다.')) return;
        try {
            await closeRoom(rid);
        } catch (e) {
            console.error(e);
        } finally {
            if (typeof onBack === 'function') onBack();
        }
    };

    const onKeyDown = (e) => {
        if (roomClosed) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const hits = useMemo(() => {
        const q = query.trim();
        if (!q) return [];
        const lower = q.toLowerCase();
        return messages
            .filter(
                (m) =>
                    String(m.type).toUpperCase() !== 'SYSTEM' &&
                    `${m.text || ''} ${m.fileName || ''}`.toLowerCase().includes(lower),
            )
            .map((m) => m.id);
    }, [messages, query]);

    useEffect(() => {
        if (!searchOpen || !hits.length) return;
        const el = document.getElementById(`msg-${hits[Math.min(activeHitIdx, hits.length - 1)]}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [searchOpen, hits, activeHitIdx]);

    const renderHighlightedText = (text) => {
        const q = query.trim();
        if (!searchOpen || !q) return text;
        const re = new RegExp(escapeRegExp(q), 'ig');
        const parts = String(text || '').split(re);
        if (parts.length <= 1) return text;
        const matches = String(text || '').match(re) || [];
        const out = [];
        for (let i = 0; i < parts.length; i++) {
            out.push(<span key={`p-${i}`}>{parts[i]}</span>);
            if (i < matches.length)
                out.push(
                    <mark key={`m-${i}`} className="cr-hl">
                        {matches[i]}
                    </mark>,
                );
        }
        return out;
    };

    const headerTitle = useMemo(() => roomInfo?.partner_name || `세무챗 (방 ${rid || '-'})`, [rid, roomInfo]);

    if (!rid)
        return (
            <div className="cr-page">
                <div className="cr-wrap" style={{ padding: 16 }}>
                    <div style={{ fontWeight: 900, marginBottom: 10 }}>채팅방을 열 수 없어요</div>
                    <button type="button" className="cr-send" onClick={() => typeof onBack === 'function' && onBack()}>
                        리스트로
                    </button>
                </div>
            </div>
        );

    return (
        <div className="cr-page">
            <div className="cr-wrap">
                {/* ════ 헤더 ════ */}
                <div className="cr-header">
                    {!searchOpen ? (
                        <>
                            <button
                                type="button"
                                onClick={() => typeof onBack === 'function' && onBack()}
                                className="cr-back"
                                aria-label="뒤로가기"
                            >
                                <img className="cr-backIcon" src={leftArrowIcon} alt="back" />
                            </button>

                            <div className="cr-header-info">
                                <div className="cr-title">
                                    {headerTitle}
                                    {roomClosed && <span className="cr-closedBadge">종료</span>}
                                </div>
                                <div className="cr-header-meta">
                                    <div className={`cr-status-tag ${isAgentOnline ? 'is-online' : ''}`}>
                                        <span className="cr-status-dot" />
                                        <span className="cr-status-text">{isAgentOnline ? '접속 중' : '오프라인'}</span>
                                    </div>
                                    {isMyTypeUser && roomInfo?.partner_response_speed !== undefined && (
                                        <div
                                            className={`cr-status-tag cr-response-speed ${responseSpeedClass(roomInfo.partner_response_speed)}`}
                                        >
                                            <span className="cr-status-dot" />
                                            <span className="cr-status-text">
                                                평균 응답 {formatResponseSpeed(roomInfo.partner_response_speed)}
                                            </span>
                                        </div>
                                    )}
                                    {/* ✅ 문제1: USER만 요금/무료 태그 표시 */}
                                    {isMyTypeUser && ratePerBilling > 0 && (
                                        <div className="cr-status-tag cr-rate-tag">
                                            <span className="cr-status-text">
                                                💳 {ratePerBilling.toLocaleString()}cr/10분
                                            </span>
                                        </div>
                                    )}
                                    {isMyTypeUser && ratePerBilling === 0 && (
                                        <div className="cr-status-tag cr-free-tag">
                                            <span className="cr-status-text">✅ 무료 상담</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="cr-headerActions">
                                {isMyTypeUser && roomInfo && (
                                    <button
                                        type="button"
                                        className={`cr-hIcon ${infoOpen ? 'isOn' : ''}`}
                                        title="세무사 정보"
                                        onClick={() => setInfoOpen((v) => !v)}
                                    >
                                        👤
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="cr-hIcon"
                                    title="검색"
                                    onClick={() => {
                                        setSearchOpen(true);
                                        setMenuOpen(false);
                                    }}
                                >
                                    🔎
                                </button>
                                <button
                                    type="button"
                                    className={`cr-hIcon cr-menuIcon ${menuOpen ? 'isOn' : ''}`}
                                    title="메뉴"
                                    onClick={() => setMenuOpen((v) => !v)}
                                >
                                    ☰
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="cr-searchBar">
                                <input
                                    className="cr-searchInput"
                                    value={query}
                                    onChange={(e) => {
                                        setQuery(e.target.value);
                                        setActiveHitIdx(0);
                                    }}
                                    placeholder="대화 내용 검색"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    className="cr-searchX"
                                    onClick={() => {
                                        setSearchOpen(false);
                                        setQuery('');
                                        setActiveHitIdx(0);
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                            {query.trim() && (
                                <div className="cr-searchMeta">
                                    <span className="cr-hitCount">
                                        {hits.length
                                            ? `${Math.min(activeHitIdx + 1, hits.length)}/${hits.length}`
                                            : '0/0'}
                                    </span>
                                    <div className="cr-searchNav">
                                        <button
                                            type="button"
                                            className="cr-navBtn"
                                            disabled={!hits.length}
                                            onClick={() => setActiveHitIdx((x) => Math.max(0, x - 1))}
                                        >
                                            <img className="cr-navIcon" src={upIcon} alt="up" />
                                        </button>
                                        <button
                                            type="button"
                                            className="cr-navBtn"
                                            disabled={!hits.length}
                                            onClick={() => setActiveHitIdx((x) => Math.min(hits.length - 1, x + 1))}
                                        >
                                            <img className="cr-navIcon" src={downIcon} alt="down" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ════ 세무사 정보 패널 ════ */}
                {infoOpen && isMyTypeUser && roomInfo && (
                    <div className="cr-taxPanel">
                        <div className="cr-taxPanel-inner">
                            <div className="cr-taxPanel-left">
                                {roomInfo.partner_profile ? (
                                    <img
                                        className="cr-taxAvatar"
                                        src={absolutizeFileUrl(roomInfo.partner_profile)}
                                        alt="avatar"
                                    />
                                ) : (
                                    <div className="cr-taxAvatarFallback">{(roomInfo.partner_name || '?')[0]}</div>
                                )}
                                <div className="cr-taxInfo">
                                    <div className="cr-taxName">{roomInfo.partner_name}</div>
                                    {roomInfo.partner_company && (
                                        <div className="cr-taxCompany">{roomInfo.partner_company}</div>
                                    )}
                                    {roomInfo.partner_bio && <div className="cr-taxBio">{roomInfo.partner_bio}</div>}
                                    {partnerCategories.length > 0 && (
                                        <div className="cr-taxCats">
                                            {partnerCategories.slice(0, 4).map((c) => (
                                                <span key={c} className="cr-taxCat">
                                                    {c}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="cr-taxPanel-right">
                                {roomInfo.partner_experience_years > 0 && (
                                    <div className="cr-taxStat">
                                        <span className="cr-taxStatIcon">🏅</span>
                                        <span className="cr-taxStatLabel">경력</span>
                                        <span className="cr-taxStatVal">{roomInfo.partner_experience_years}년</span>
                                    </div>
                                )}
                                {roomInfo.partner_monthly_fee > 0 && (
                                    <div className="cr-taxStat">
                                        <span className="cr-taxStatIcon">📋</span>
                                        <span className="cr-taxStatLabel">기장료</span>
                                        <span className="cr-taxStatVal">
                                            {roomInfo.partner_monthly_fee.toLocaleString()}원~
                                        </span>
                                    </div>
                                )}
                                <div className="cr-taxStat">
                                    <span className="cr-taxStatIcon">💳</span>
                                    <span className="cr-taxStatLabel">채팅 요금</span>
                                    <span className={`cr-taxStatVal ${ratePerBilling === 0 ? 'is-free' : ''}`}>
                                        {ratePerBilling === 0 ? '무료' : `${ratePerBilling.toLocaleString()}cr/10분`}
                                    </span>
                                </div>
                                <div className="cr-taxStat">
                                    <span className="cr-taxStatIcon">{isAgentOnline ? '🟢' : '⚫'}</span>
                                    <span className="cr-taxStatLabel">현재 상태</span>
                                    <span className={`cr-taxStatVal ${isAgentOnline ? 'is-online-text' : ''}`}>
                                        {isAgentOnline ? '접속 중' : '오프라인'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ════ 결제/입금 타이머 바 (USER + 세무사 모두) ════ */}
                {!roomClosed && ratePerBilling > 0 && (
                    <div className="cr-billingBar">
                        <div className="cr-billingLeft">
                            <div className="cr-billingItem">
                                <span className="cr-billingLabel">⏱ 상담 시간</span>
                                <span className="cr-billingVal">{formatTimer(consultSec)}</span>
                            </div>
                            <div className="cr-billingDivider" />
                            {/* ✅ 문제3: USER는 "다음 결제", 세무사는 "다음 입금" */}
                            <div className="cr-billingItem">
                                <span className="cr-billingLabel">
                                    {isMyTypeUser ? '💳 다음 결제' : '💰 다음 입금'}
                                </span>
                                <span
                                    className={`cr-billingVal ${billingSec <= 60 ? 'is-urgent' : ''} ${!isMyTypeUser ? 'cr-billingVal-income' : ''}`}
                                >
                                    {formatTimer(billingSec)}
                                </span>
                            </div>
                            {/* ✅ 세무사: 다음 입금 예정액 */}
                            {!isMyTypeUser && (
                                <>
                                    <div className="cr-billingDivider" />
                                    <div className="cr-billingItem">
                                        <span className="cr-billingLabel">입금 예정</span>
                                        <span className="cr-billingVal cr-billingVal-income">
                                            +{Math.floor(ratePerBilling * 0.9).toLocaleString()}cr
                                        </span>
                                    </div>
                                </>
                            )}
                            {!bothOnline && <span className="cr-billingPause">⏸ 오프라인 — 타이머 정지</span>}
                        </div>
                        <div className="cr-billingRight">
                            <span className="cr-creditLabel">보유 크레딧</span>
                            <span
                                className={`cr-creditVal ${isMyTypeUser && userCredit !== null && userCredit < ratePerBilling ? 'is-low' : ''}`}
                            >
                                {userCredit !== null ? userCredit.toLocaleString() : '…'}
                            </span>
                        </div>
                    </div>
                )}

                {/* 무료 상담 크레딧 표시 */}
                {!roomClosed && ratePerBilling === 0 && isMyTypeUser && userCredit !== null && (
                    <div className="cr-creditOnlyBar">
                        <span className="cr-creditLabel">보유 크레딧</span>
                        <span className="cr-creditVal">{userCredit.toLocaleString()}</span>
                    </div>
                )}

                {/* 결제 토스트 */}
                {billingAlert && <div className="cr-billingAlert">{billingAlert}</div>}

                {/* ════ 채팅 본문 ════ */}
                <div
                    ref={listRef}
                    className="cr-chat"
                    onClick={() => {
                        setShowAttach(false);
                        setMenuOpen(false);
                    }}
                >
                    {loading && <div className="cr-loading">메시지 불러오는 중…</div>}
                    {!loading &&
                        (() => {
                            let lastDayKey = null;
                            return messages.map((m) => {
                                const isMe = m.from === 'me';
                                const type = String(m.type).toUpperCase();
                                const isSystem = type === 'SYSTEM' || m.from === 'system';
                                const isLastMy = isMe && m.id === lastMyMsgId;
                                const dk = dayKeyFromTime(m.time);
                                const showDay = dk && dk !== lastDayKey;
                                if (showDay) lastDayKey = dk;

                                if (isSystem)
                                    return (
                                        <React.Fragment key={m.id}>
                                            {showDay && (
                                                <div className="cr-dayPill">{formatKoreanDayHeader(m.time)}</div>
                                            )}
                                            <div className="cr-systemRow">
                                                <div className="cr-systemPill">{renderHighlightedText(m.text)}</div>
                                            </div>
                                        </React.Fragment>
                                    );

                                const dl = dlState[m.id] || null;
                                const openUrl = m.fileUrl
                                    ? isTxtLike(m)
                                        ? getTxtViewerUrl(m.fileUrl)
                                        : m.fileUrl
                                    : null;
                                let sideLabel = null,
                                    sideKind = null;
                                if (dl === 'failed') {
                                    sideLabel = '다운로드 실패';
                                    sideKind = 'err';
                                } else if (dl === 'expired') {
                                    sideLabel = '보관기간 만료';
                                    sideKind = 'warn';
                                } else if (isMe && sendFail[m.id]) {
                                    sideLabel = '전송 실패';
                                    sideKind = 'err';
                                }

                                const timeObj = new Date(m.time);
                                const timeText = Number.isNaN(timeObj.getTime())
                                    ? ''
                                    : timeObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

                                return (
                                    <React.Fragment key={m.id}>
                                        {showDay && <div className="cr-dayPill">{formatKoreanDayHeader(m.time)}</div>}
                                        <div
                                            id={`msg-${m.id}`}
                                            className={`cr-row ${isMe ? 'cr-rowMe' : 'cr-rowOther'}`}
                                        >
                                            <div className={`cr-bubbleWrap ${isMe ? 'isMe' : 'isOther'}`}>
                                                {sideLabel && (
                                                    <div
                                                        className={`cr-sideLabel ${sideKind === 'err' ? 'isErr' : 'isWarn'}`}
                                                    >
                                                        {sideLabel}
                                                    </div>
                                                )}
                                                <div className={`cr-bubble ${isMe ? 'cr-bubbleMe' : 'cr-bubbleOther'}`}>
                                                    {type === 'IMAGE' && m.fileUrl && (
                                                        <div className="cr-imgWrap">
                                                            <img
                                                                className="cr-img"
                                                                src={m.fileUrl}
                                                                alt={m.fileName || 'image'}
                                                            />
                                                            <div className="cr-fileBody">
                                                                <div className="cr-fileActions">
                                                                    <button
                                                                        type="button"
                                                                        className="cr-downloadBtn"
                                                                        onClick={() => handleDownload(m)}
                                                                        disabled={dl === 'loading'}
                                                                    >
                                                                        {dl === 'loading' ? '다운로드중…' : '다운로드'}
                                                                    </button>
                                                                    {openUrl && (
                                                                        <a
                                                                            className="cr-openBtn"
                                                                            href={openUrl}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                        >
                                                                            열기
                                                                        </a>
                                                                    )}
                                                                </div>
                                                                <div className="cr-fileSub">
                                                                    <div className="cr-fileSubRow">
                                                                        <span className="cr-fileLabel">용량:</span>
                                                                        <span className="cr-fileValue">
                                                                            {formatBytes(m.fileSize)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="cr-fileSubRow">
                                                                        <span className="cr-fileLabel">유효기간:</span>
                                                                        <span className="cr-fileValue">
                                                                            {formatExpireDate(m.time)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {type === 'FILE' && m.fileUrl && (
                                                        <div className="cr-fileCard">
                                                            {isTxtLike(m) && (
                                                                <img
                                                                    className="cr-txtCornerIcon"
                                                                    src={txtFileIcon}
                                                                    alt="txt"
                                                                />
                                                            )}
                                                            <div className="cr-fileTopRow">
                                                                <div className="cr-fileBadge">
                                                                    {isTxtLike(m) ? 'TXT' : 'FILE'}
                                                                </div>
                                                                <div
                                                                    className="cr-fileTitle"
                                                                    title={m?.fileName || '파일'}
                                                                >
                                                                    {renderHighlightedText(
                                                                        displayFileTitle(m) || '파일',
                                                                    )}
                                                                </div>
                                                                <div className="cr-fileRightSlot" />
                                                            </div>
                                                            <div className="cr-fileActions">
                                                                <button
                                                                    type="button"
                                                                    className="cr-downloadBtn"
                                                                    onClick={() => handleDownload(m)}
                                                                    disabled={dl === 'loading'}
                                                                >
                                                                    {dl === 'loading' ? '다운로드중…' : '다운로드'}
                                                                </button>
                                                                {openUrl && (
                                                                    <a
                                                                        className="cr-openBtn"
                                                                        href={openUrl}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                    >
                                                                        열기
                                                                    </a>
                                                                )}
                                                            </div>
                                                            <div className="cr-fileSub">
                                                                <div className="cr-fileSubRow">
                                                                    <span className="cr-fileLabel">용량:</span>
                                                                    <span className="cr-fileValue">
                                                                        {formatBytes(m.fileSize)}
                                                                    </span>
                                                                </div>
                                                                <div className="cr-fileSubRow">
                                                                    <span className="cr-fileLabel">유효기간:</span>
                                                                    <span className="cr-fileValue">
                                                                        {formatExpireDate(m.time)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {type === 'TEXT' && (
                                                        <div className="cr-text">{renderHighlightedText(m.text)}</div>
                                                    )}

                                                    <div className={`cr-time ${isMe ? 'cr-timeMe' : 'cr-timeOther'}`}>
                                                        {timeText}
                                                        {isLastMy && (
                                                            <span className="cr-readStatus">
                                                                {m.isRead ? '읽음' : '안읽음'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </React.Fragment>
                                );
                            });
                        })()}
                </div>

                <input
                    ref={txtInputRef}
                    type="file"
                    accept=".txt,text/plain"
                    className="cr-hidden"
                    onChange={(e) => {
                        addFileMessages(e.target.files);
                        e.target.value = '';
                    }}
                    disabled={roomClosed}
                />
                <input
                    ref={imgInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="cr-hidden"
                    onChange={(e) => {
                        addFileMessages(e.target.files);
                        e.target.value = '';
                    }}
                    disabled={roomClosed}
                />

                {showAttach && !roomClosed && (
                    <div className="cr-attachPanel">
                        <button type="button" className="cr-attachItem" onClick={() => txtInputRef.current?.click()}>
                            <span className="cr-attachIcon">
                                <img className="cr-attachImg" src={txtPanelIcon} alt="텍스트 업로드" />
                            </span>
                            <span className="cr-attachText">텍스트 업로드</span>
                        </button>
                        <button type="button" className="cr-attachItem" onClick={() => imgInputRef.current?.click()}>
                            <span className="cr-attachIcon">
                                <img className="cr-attachImg" src={pictureIcon} alt="사진 업로드" />
                            </span>
                            <span className="cr-attachText">사진 업로드</span>
                        </button>
                    </div>
                )}

                <div className="cr-inputBar">
                    <button
                        type="button"
                        onClick={() => !roomClosed && setShowAttach((v) => !v)}
                        className={`cr-plus ${showAttach ? 'isOpen' : ''}`}
                        disabled={roomClosed}
                    >
                        +
                    </button>
                    <textarea
                        value={input}
                        onChange={(e) => !roomClosed && setInput(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder={roomClosed ? '상담이 종료되었습니다.' : '메시지를 입력하세요'}
                        rows={1}
                        className="cr-textarea"
                        onFocus={() => !roomClosed && setShowAttach(false)}
                        disabled={roomClosed}
                        readOnly={roomClosed}
                    />
                    <button type="button" onClick={() => sendMessage()} className="cr-send" disabled={roomClosed}>
                        전송
                    </button>
                </div>

                {menuOpen && (
                    <div className="cr-menuOverlay" onClick={() => setMenuOpen(false)}>
                        <div className="cr-menuSheet" onClick={(e) => e.stopPropagation()}>
                            <button type="button" className="cr-leaveBtn" onClick={leaveRoom}>
                                채팅방 나가기
                            </button>
                            <button type="button" className="cr-cancelBtn" onClick={() => setMenuOpen(false)}>
                                닫기
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
