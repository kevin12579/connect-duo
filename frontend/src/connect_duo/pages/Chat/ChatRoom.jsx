// src/components/chat/ChatRoom.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
    getMyIdFallback1,
    displayFileTitle,
    escapeRegExp,
} from './chatRoomUtil';

import './ChatRoom.css';
import txtPanelIcon from '../../assets/txt.png';
import pictureIcon from '../../assets/picture.png';
import txtFileIcon from '../../assets/txt-icon.png';
import leftArrowIcon from '../../assets/left-arrow.png';

/* ✅ (2) 돋보기 검색용 up/down 아이콘(32px) */
import upIcon from '../../assets/up.png';
import downIcon from '../../assets/down.png';

import { formatResponseSpeed, responseSpeedClass } from '../../utils/formatResponseSpeed';

export default function ChatRoom({ roomId, onBack }) {
    const rid = useMemo(() => String(roomId ?? ''), [roomId]);
    const listRef = useRef(null);
    const markReadTimerRef = useRef(null);

    const [showAttach, setShowAttach] = useState(false);
    const txtInputRef = useRef(null);
    const imgInputRef = useRef(null);
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

    // ✅ 실패 라벨(메시지 id별) - 성공 전까지 유지
    const [sendFail, setSendFail] = useState({}); // { [msgId]: true }

    const MY_ID = useMemo(() => getMyIdFallback1(), []);

    const isMyTypeUser = useMemo(() => {
        try {
            const backup = JSON.parse(localStorage.getItem('userBackup') || '{}');
            return (backup?.user_type || 'USER') === 'USER';
        } catch {
            return true;
        }
    }, []);

    const isAgentOnline = useMemo(() => {
        return [...onlineUsers].some((uid) => uid !== String(MY_ID));
    }, [onlineUsers, MY_ID]);

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

    // =========================================================
    // Socket.io 이벤트 핸들러 등록
    // =========================================================
    useEffect(() => {
        if (!rid) return;

        const socket = ensureSocket();
        if (!socket) {
            console.warn('[ChatRoom] 소켓 초기화 실패. 로그인 상태를 확인하세요.');
            return;
        }

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

                        // ✅ 성공으로 temp 교체되면 “전송 실패” 라벨 제거
                        if (tempId) {
                            setSendFail((sf) => {
                                if (!sf || !sf[tempId]) return sf;
                                const n = { ...sf };
                                delete n[tempId];
                                return n;
                            });
                        }
                        return next;
                    }
                    return [...prev, uiMsg];
                }

                if (uiMsg.from !== 'me') debouncedMarkRead();
                return [...prev, uiMsg];
            });

            setTimeout(scrollToBottom, 0);

            if (uiMsg.from !== 'me') {
                debouncedMarkRead();
            }
        };

        const onRoomClosed = () => setRoomClosed(true);

        const onReadUpdated = ({ userId }) => {
            if (String(userId) !== String(MY_ID)) {
                setMessages((prev) => prev.map((m) => (m.from === 'me' ? { ...m, isRead: true } : m)));
            }
        };

        const onUserOnline = ({ userId }) => setOnlineUsers((prev) => new Set([...prev, String(userId)]));
        const onUserOffline = ({ userId }) => {
            setOnlineUsers((prev) => {
                const next = new Set(prev);
                next.delete(String(userId));
                return next;
            });
        };
        const onCurrentUsers = ({ users }) => setOnlineUsers(new Set((users || []).map((id) => String(id))));

        socket.on('receive_message', onReceiveMessage);
        socket.on('ROOM_CLOSED', onRoomClosed);
        socket.on('read_updated', onReadUpdated);
        socket.on('user_online', onUserOnline);
        socket.on('user_offline', onUserOffline);
        socket.on('room_users', onCurrentUsers);

        socket.emit('join_room', rid);

        return () => {
            socket.emit('leave_room', rid);
            socket.off('receive_message', onReceiveMessage);
            socket.off('ROOM_CLOSED', onRoomClosed);
            socket.off('read_updated', onReadUpdated);
            socket.off('user_online', onUserOnline);
            socket.off('user_offline', onUserOffline);
            socket.off('room_users', onCurrentUsers);
            if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
        };
    }, [rid, MY_ID, scrollToBottom, debouncedMarkRead]);

    const lastMyMsgId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].from === 'me') return messages[i].id;
        }
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

    const loadMessages = useCallback(async () => {
        if (!rid) return;
        try {
            setLoading(true);
            await fetchRoomStatus();
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
    }, [rid, scrollToBottom, MY_ID, fetchRoomStatus, debouncedMarkRead]);

    useEffect(() => {
        if (!rid) {
            setLoading(false);
            setMessages([]);
            return;
        }
        const draft = getDraft(rid);
        if (draft) setInput(draft);
        loadMessages();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rid]);

    useEffect(() => {
        if (!rid) return;
        saveDraft(rid, input);
    }, [rid, input]);

    // ✅ 전송 실패 라벨: 성공 전까지 유지(자동 제거 X)
    const markSendFail = useCallback((msgId) => {
        setSendFail((prev) => ({ ...(prev || {}), [msgId]: true }));
    }, []);

    const sendMessage = async (overrideText) => {
        if (roomClosed) return;
        const text = (overrideText ?? input).trim();
        if (!text || !rid) return;

        setInput('');
        const tempId = `temp-${Date.now()}`;

        setMessages((prev) => [
            ...prev,
            {
                id: tempId,
                from: 'me',
                type: 'TEXT',
                text,
                time: new Date().toISOString(),
                isRead: false,
            },
        ]);
        setTimeout(scrollToBottom, 0);

        try {
            const res = await apiSendMessage(rid, text);
            const serverMsg = res?.data;
            if (serverMsg?.id) {
                const uiMsg = mapRowToUiMessage(serverMsg, MY_ID, absolutizeFileUrl);

                setMessages((prev) => prev.map((m) => (m.id === tempId ? uiMsg : m)));

                // ✅ 성공이면 실패 라벨 제거
                setSendFail((prev) => {
                    if (!prev || !prev[tempId]) return prev;
                    const next = { ...prev };
                    delete next[tempId];
                    return next;
                });
            }
        } catch {
            // ✅ 실패면 “말풍선 옆 라벨”로 유지
            markSendFail(tempId);
        }
    };

    const addFileMessages = async (files) => {
        if (roomClosed) return;
        if (!files || files.length === 0 || !rid) return;
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
        setDlState((prev) => ({ ...prev, [m.id]: 'loading' }));
        try {
            await downloadFile(m.fileUrl, m.fileName || 'download');

            // ✅ 성공이면 제거
            setDlState((prev) => {
                const next = { ...prev };
                delete next[m.id];
                return next;
            });
        } catch (e) {
            // ✅ 실패/만료도 성공 전까지 유지(자동 제거 X)
            const nextState = e?.code === 410 || e?.message === 'EXPIRED' ? 'expired' : 'failed';
            setDlState((prev) => ({ ...prev, [m.id]: nextState }));
        }
    };

    const leaveRoom = async () => {
        if (!window.confirm('정말 나가시겠습니까? 채팅방이 종료됩니다.')) return;
        try {
            await closeRoom(rid);
        } catch (e) {
            console.error('채팅방 나가기 실패:', e);
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
            .filter((m) => {
                if (String(m.type).toUpperCase() === 'SYSTEM') return false;
                const hay = `${m.text || ''} ${m.fileName || ''}`.toLowerCase();
                return hay.includes(lower);
            })
            .map((m) => m.id);
    }, [messages, query]);

    useEffect(() => {
        if (!searchOpen || !hits.length) return;
        const idx = Math.min(activeHitIdx, hits.length - 1);
        const el = document.getElementById(`msg-${hits[idx]}`);
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

    if (!rid) {
        return (
            <div className="cr-page">
                <div className="cr-wrap" style={{ padding: 16 }}>
                    <div style={{ fontWeight: 900, marginBottom: 10 }}>채팅방을 열 수 없어요</div>
                    <div style={{ opacity: 0.8, lineHeight: 1.4 }}>roomId가 비어있거나 잘못 전달되었습니다.</div>
                    <div style={{ marginTop: 12 }}>
                        <button type="button" className="cr-send" onClick={() => typeof onBack === 'function' && onBack()}>
                            리스트로
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="cr-page">
            <div className="cr-wrap">
                <div className="cr-header">
                    {!searchOpen ? (
                        <>
                            <button
                                type="button"
                                onClick={() => typeof onBack === 'function' && onBack()}
                                className="cr-back"
                                aria-label="뒤로가기"
                                title="리스트로 돌아가기"
                            >
                                <img className="cr-backIcon" src={leftArrowIcon} alt="back" />
                            </button>

                            <div className="cr-header-info">
                                <div className="cr-title" title={headerTitle}>
                                    {headerTitle}
                                    {roomClosed && (
                                        <span style={{ color: '#ffe066', fontSize: 14, marginLeft: 8, fontWeight: 700 }}>
                                            [상담 종료]
                                        </span>
                                    )}
                                </div>

                                <div className="cr-header-meta">
                                    <div className={`cr-status-tag ${isAgentOnline ? 'is-online' : ''}`}>
                                        <span className="cr-status-dot"></span>
                                        <span className="cr-status-text">{isAgentOnline ? '접속 중' : '오프라인'}</span>
                                    </div>

                                    {isMyTypeUser && roomInfo?.partner_response_speed !== undefined && (
                                        <div className={`cr-status-tag cr-response-speed ${responseSpeedClass(roomInfo.partner_response_speed)}`}>
                                            <span className="cr-status-dot" />
                                            <span className="cr-status-text">평균 응답 {formatResponseSpeed(roomInfo.partner_response_speed)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="cr-headerActions" style={{ marginLeft: 'auto' }}>
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
                                    title="취소"
                                >
                                    ✕
                                </button>
                            </div>
                            {query.trim() && (
                                <div className="cr-searchMeta">
                                    <span className="cr-hitCount">
                                        {hits.length ? `${Math.min(activeHitIdx + 1, hits.length)}/${hits.length}` : '0/0'}
                                    </span>
                                    <div className="cr-searchNav">
                                        <button
                                            type="button"
                                            className="cr-navBtn"
                                            disabled={!hits.length}
                                            onClick={() => setActiveHitIdx((x) => Math.max(0, x - 1))}
                                            title="이전"
                                        >
                                            {/* ✅ (2) up 아이콘 */}
                                            <img className="cr-navIcon" src={upIcon} alt="up" />
                                        </button>
                                        <button
                                            type="button"
                                            className="cr-navBtn"
                                            disabled={!hits.length}
                                            onClick={() => setActiveHitIdx((x) => Math.min(hits.length - 1, x + 1))}
                                            title="다음"
                                        >
                                            {/* ✅ (2) down 아이콘 */}
                                            <img className="cr-navIcon" src={downIcon} alt="down" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

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
                        messages.map((m) => {
                            const isMe = m.from === 'me';
                            const type = String(m.type).toUpperCase();
                            const isSystem = type === 'SYSTEM' || m.from === 'system';
                            const isLastMyMsg = isMe && m.id === lastMyMsgId;

                            if (isSystem)
                                return (
                                    <div key={m.id} className="cr-systemRow">
                                        <div className="cr-systemPill">{renderHighlightedText(m.text)}</div>
                                    </div>
                                );

                            const dl = dlState[m.id] || null;
                            const openUrl = m.fileUrl ? (isTxtLike(m) ? getTxtViewerUrl(m.fileUrl) : m.fileUrl) : null;

                            // ✅ “말풍선 밖 옆 라벨” 결정 (우선순위: 다운로드 > 만료 > 전송)
                            let sideLabel = null;
                            let sideKind = null;
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
                                <div key={m.id} id={`msg-${m.id}`} className={`cr-row ${isMe ? 'cr-rowMe' : 'cr-rowOther'}`}>
                                    <div className={`cr-bubbleWrap ${isMe ? 'isMe' : 'isOther'}`}>
                                        {/* ✅ 요구사항: 라벨은 “말풍선 바깥 왼쪽” (카톡 느낌) */}
                                        {sideLabel && (
                                            <div className={`cr-sideLabel ${sideKind === 'err' ? 'isErr' : 'isWarn'}`}>
                                                {sideLabel}
                                            </div>
                                        )}

                                        <div className={`cr-bubble ${isMe ? 'cr-bubbleMe' : 'cr-bubbleOther'}`}>
                                            {type === 'IMAGE' && m.fileUrl && (
                                                <div className="cr-imgWrap">
                                                    <img className="cr-img" src={m.fileUrl} alt={m.fileName || 'image'} />
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
                                                                <a className="cr-openBtn" href={openUrl} target="_blank" rel="noreferrer">
                                                                    열기
                                                                </a>
                                                            )}
                                                        </div>

                                                        <div className="cr-fileSub">
                                                            <div className="cr-fileSubRow">
                                                                <span className="cr-fileLabel">용량:</span>
                                                                <span className="cr-fileValue">{formatBytes(m.fileSize)}</span>
                                                            </div>
                                                            <div className="cr-fileSubRow">
                                                                <span className="cr-fileLabel">유효기간:</span>
                                                                <span className="cr-fileValue">{formatExpireDate(m.time)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {type === 'FILE' && m.fileUrl && (
                                                <div className="cr-fileCard">
                                                    {isTxtLike(m) && <img className="cr-txtCornerIcon" src={txtFileIcon} alt="txt" />}
                                                    <div className="cr-fileTopRow">
                                                        <div className="cr-fileBadge">{isTxtLike(m) ? 'TXT' : 'FILE'}</div>
                                                        <div className="cr-fileTitle" title={m?.fileName || '파일'}>
                                                            {renderHighlightedText(displayFileTitle(m) || '파일')}
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
                                                            <a className="cr-openBtn" href={openUrl} target="_blank" rel="noreferrer">
                                                                열기
                                                            </a>
                                                        )}
                                                    </div>

                                                    <div className="cr-fileSub">
                                                        <div className="cr-fileSubRow">
                                                            <span className="cr-fileLabel">용량:</span>
                                                            <span className="cr-fileValue">{formatBytes(m.fileSize)}</span>
                                                        </div>
                                                        <div className="cr-fileSubRow">
                                                            <span className="cr-fileLabel">유효기간:</span>
                                                            <span className="cr-fileValue">{formatExpireDate(m.time)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {type === 'TEXT' && <div className="cr-text">{renderHighlightedText(m.text)}</div>}

                                            <div className={`cr-time ${isMe ? 'cr-timeMe' : 'cr-timeOther'}`}>
                                                {timeText}
                                                {isLastMyMsg && (
                                                    <span className="cr-readStatus" style={{ marginLeft: 6, fontSize: '11px', color: '#221e1e' }}>
                                                        {m.isRead ? '읽음' : '안읽음'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
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
                        aria-label="첨부"
                        title="파일 업로드"
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