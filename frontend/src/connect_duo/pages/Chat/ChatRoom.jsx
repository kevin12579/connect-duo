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
    ensureSocket, // ✅ FIX BUG4: getSocket 대신 ensureSocket 사용
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
import txtFileIcon from '../../assets/txt-img.png';

export default function ChatRoom({ roomId, onBack }) {
    const rid = useMemo(() => String(roomId ?? ''), [roomId]);
    const listRef = useRef(null);
    const markReadTimerRef = useRef(null); // markRead 디바운스용

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

    const MY_ID = useMemo(() => getMyIdFallback1(), []);

    const scrollToBottom = useCallback(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, []);

    // markRead 디바운스: 연속 호출 방지 (500ms)
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

        // ✅ FIX BUG4: ensureSocket()으로 새로고침 후에도 소켓 자동 복구
        const socket = ensureSocket();
        if (!socket) {
            console.warn('[ChatRoom] 소켓 초기화 실패. 로그인 상태를 확인하세요.');
            return;
        }

        socket.emit('join_room', rid);

        /**
         * ✅ FIX BUG3: 내 메시지 중복 표시 문제
         *
         * 서버는 io.to(roomId).emit()으로 방 전체에 emit합니다 (본인 포함).
         * 따라서 내가 보낸 메시지도 소켓으로 다시 수신됩니다.
         *
         * 처리 흐름:
         *   [케이스 A] HTTP 응답이 소켓보다 먼저 도달 (일반적):
         *     sendMessage() → tempId 추가 → HTTP 응답으로 tempId→실제id 교체
         *     → 소켓 수신 시 id 중복 체크 → skip ✓
         *
         *   [케이스 B] 소켓이 HTTP 응답보다 먼저 도달 (드물지만 발생 가능):
         *     sendMessage() → tempId 추가
         *     → 소켓 수신 시 내 메시지 + temp-* 발견 → tempId를 실제id로 교체
         *     → HTTP 응답 도달 시 tempId 없음 → no-op ✓
         */
        const onReceiveMessage = (rawMsg) => {
            const uiMsg = mapRowToUiMessage(rawMsg, MY_ID, absolutizeFileUrl);
            if (!uiMsg) return;

            setMessages((prev) => {
                // ① 이미 같은 id가 있으면 skip (케이스 A의 소켓 중복 처리)
                if (prev.some((m) => String(m.id) === String(uiMsg.id))) return prev;

                // ② 내가 보낸 메시지인 경우: tempId를 찾아서 교체 (케이스 B)
                if (uiMsg.from === 'me') {
                    const tempIdx = prev.findIndex((m) => typeof m.id === 'string' && m.id.startsWith('temp-'));
                    if (tempIdx !== -1) {
                        // tempId 자리에 실제 서버 메시지 삽입
                        const next = [...prev];
                        next[tempIdx] = uiMsg;
                        return next;
                    }
                    // tempId가 이미 HTTP 응답으로 교체됐거나 없으면 skip
                    return prev;
                }

                // ③ 상대방 메시지: 목록 끝에 추가
                return [...prev, uiMsg];
            });

            setTimeout(scrollToBottom, 0);

            // 상대방 메시지 수신 시에만 읽음 처리
            if (uiMsg.from !== 'me') {
                debouncedMarkRead();
            }
        };

        // 상담 종료 실시간 수신
        const onRoomClosed = () => {
            setRoomClosed(true);
        };

        // 상대방이 읽으면 내 메시지들 읽음 표시
        const onReadUpdated = ({ userId }) => {
            if (String(userId) !== String(MY_ID)) {
                setMessages((prev) => prev.map((m) => (m.from === 'me' ? { ...m, isRead: true } : m)));
            }
        };

        // 온라인/오프라인 상태 수신
        const onUserOnline = ({ userId }) => {
            setOnlineUsers((prev) => new Set([...prev, String(userId)]));
        };
        const onUserOffline = ({ userId }) => {
            setOnlineUsers((prev) => {
                const next = new Set(prev);
                next.delete(String(userId));
                return next;
            });
        };

        socket.on('receive_message', onReceiveMessage);
        socket.on('ROOM_CLOSED', onRoomClosed);
        socket.on('read_updated', onReadUpdated);
        socket.on('user_online', onUserOnline);
        socket.on('user_offline', onUserOffline);

        return () => {
            socket.emit('leave_room', rid);
            socket.off('receive_message', onReceiveMessage);
            socket.off('ROOM_CLOSED', onRoomClosed);
            socket.off('read_updated', onReadUpdated);
            socket.off('user_online', onUserOnline);
            socket.off('user_offline', onUserOffline);
            if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
        };
    }, [rid, MY_ID, scrollToBottom, debouncedMarkRead]);

    // 마지막 내 메시지 id (읽음/안읽음 표시용)
    const lastMyMsgId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].from === 'me') return messages[i].id;
        }
        return null;
    }, [messages]);

    // 방 상태(ACTIVE/CLOSED) 확인
    const fetchRoomStatus = useCallback(async () => {
        if (!rid) return;
        try {
            const res = await listRooms();
            if (Array.isArray(res.data)) {
                const meRoom = res.data.find((r) => String(r.id) === rid);
                setRoomClosed(meRoom?.status === 'CLOSED');
            }
        } catch {
            setRoomClosed(false);
        }
    }, [rid]);

    // 메시지 목록 로드
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

    // 방 입장 시 초기화
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

    // 임시 저장
    useEffect(() => {
        if (!rid) return;
        saveDraft(rid, input);
    }, [rid, input]);

    // ─── 텍스트 메시지 전송 ─────────────────────────────────────────
    const sendMessage = async (overrideText) => {
        if (roomClosed) return;
        const text = (overrideText ?? input).trim();
        if (!text || !rid) return;

        setInput('');
        const tempId = `temp-${Date.now()}`;

        // 낙관적 UI: 임시 메시지 먼저 표시
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
            // axiosAuth → r.data → { result:'success', data:{ id, sender_id, ... } }
            const serverMsg = res?.data;
            if (serverMsg?.id) {
                const uiMsg = mapRowToUiMessage(serverMsg, MY_ID, absolutizeFileUrl);
                // tempId를 실제 서버 메시지로 교체
                // (소켓이 먼저 케이스 B 처리를 했다면 tempId가 없어 no-op)
                setMessages((prev) => prev.map((m) => (m.id === tempId ? uiMsg : m)));
            }
        } catch {
            setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, text: `${text} (전송 실패)` } : m)));
        }
    };

    // ─── 파일 업로드 ────────────────────────────────────────────────
    const addFileMessages = async (files) => {
        if (roomClosed) return;
        if (!files || files.length === 0 || !rid) return;
        try {
            await uploadRoomFiles(rid, files);
            // 서버가 소켓으로 receive_message emit → onReceiveMessage에서 자동 수신
            // (파일 업로드는 낙관적 UI 없이 소켓 수신으로만 처리)
        } catch (e) {
            console.error('파일 업로드 실패:', e);
            // 실패 시 수동 갱신
            await loadMessages();
        } finally {
            setShowAttach(false);
        }
    };

    // ─── 파일 다운로드 ──────────────────────────────────────────────
    const handleDownload = async (m) => {
        if (!m?.fileUrl) return;
        setDlState((prev) => ({ ...prev, [m.id]: 'loading' }));
        try {
            await downloadFile(m.fileUrl, m.fileName || 'download');
            setDlState((prev) => {
                const next = { ...prev };
                delete next[m.id];
                return next;
            });
        } catch (e) {
            setDlState((prev) => ({
                ...prev,
                [m.id]: e?.code === 410 || e?.message === 'EXPIRED' ? 'expired' : 'failed',
            }));
        }
    };

    // ─── 채팅방 나가기 (상담 종료) ──────────────────────────────────
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

    // ─── 키보드 입력 ────────────────────────────────────────────────
    const onKeyDown = (e) => {
        if (roomClosed) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // ─── 검색 ───────────────────────────────────────────────────────
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

    const headerTitle = useMemo(() => `세무챗 (방 ${rid || '-'})`, [rid]);

    // 상대방 온라인 여부
    const isPartnerOnline = useMemo(() => [...onlineUsers].some((uid) => uid !== String(MY_ID)), [onlineUsers, MY_ID]);

    // rid 없음 fallback
    if (!rid) {
        return (
            <div className="cr-page">
                <div className="cr-wrap" style={{ padding: 16 }}>
                    <div style={{ fontWeight: 900, marginBottom: 10 }}>채팅방을 열 수 없어요</div>
                    <div style={{ opacity: 0.8, lineHeight: 1.4 }}>roomId가 비어있거나 잘못 전달되었습니다.</div>
                    <div style={{ marginTop: 12 }}>
                        <button
                            type="button"
                            className="cr-send"
                            onClick={() => typeof onBack === 'function' && onBack()}
                        >
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
                {/* ─── 헤더 ─────────────────────────────────────── */}
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
                                ←
                            </button>
                            <div className="cr-title" title={headerTitle}>
                                {headerTitle}
                                {roomClosed && (
                                    <span
                                        style={{
                                            color: '#ffe066',
                                            fontSize: 14,
                                            marginLeft: 8,
                                            fontWeight: 700,
                                        }}
                                    >
                                        [상담 종료]
                                    </span>
                                )}
                                {/* ✅ 상대방 온라인 초록 점 */}
                                {isPartnerOnline && (
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            width: 10,
                                            height: 10,
                                            borderRadius: '50%',
                                            background: '#4caf50',
                                            marginLeft: 8,
                                            verticalAlign: 'middle',
                                        }}
                                        title="상대방 온라인"
                                    />
                                )}
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
                                            title="이전"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            type="button"
                                            className="cr-navBtn"
                                            disabled={!hits.length}
                                            onClick={() => setActiveHitIdx((x) => Math.min(hits.length - 1, x + 1))}
                                            title="다음"
                                        >
                                            ↓
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ─── 메시지 목록 ──────────────────────────────── */}
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
                            const timeObj = new Date(m.time);
                            const timeText = Number.isNaN(timeObj.getTime())
                                ? ''
                                : timeObj.toLocaleTimeString('ko-KR', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                  });

                            return (
                                <div
                                    key={m.id}
                                    id={`msg-${m.id}`}
                                    className={`cr-row ${isMe ? 'cr-rowMe' : 'cr-rowOther'}`}
                                >
                                    <div className={`cr-bubble ${isMe ? 'cr-bubbleMe' : 'cr-bubbleOther'}`}>
                                        {/* IMAGE */}
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
                                                        {dl === 'failed' && (
                                                            <div className="cr-dlFail">다운로드 실패</div>
                                                        )}
                                                        {dl === 'expired' && (
                                                            <div className="cr-dlExpired">보관기간 만료</div>
                                                        )}
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

                                        {/* FILE */}
                                        {type === 'FILE' && m.fileUrl && (
                                            <div className="cr-fileCard">
                                                {isTxtLike(m) && (
                                                    <img className="cr-txtCornerIcon" src={txtFileIcon} alt="txt" />
                                                )}
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
                                                    {dl === 'failed' && <div className="cr-dlFail">다운로드 실패</div>}
                                                    {dl === 'expired' && (
                                                        <div className="cr-dlExpired">보관기간 만료</div>
                                                    )}
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
                                                        <span className="cr-fileValue">{formatBytes(m.fileSize)}</span>
                                                    </div>
                                                    <div className="cr-fileSubRow">
                                                        <span className="cr-fileLabel">유효기간:</span>
                                                        <span className="cr-fileValue">{formatExpireDate(m.time)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* TEXT */}
                                        {type === 'TEXT' && (
                                            <div className="cr-text">{renderHighlightedText(m.text)}</div>
                                        )}

                                        <div className={`cr-time ${isMe ? 'cr-timeMe' : 'cr-timeOther'}`}>
                                            {timeText}
                                            {isLastMyMsg && (
                                                <span
                                                    className="cr-readStatus"
                                                    style={{
                                                        marginLeft: 6,
                                                        fontSize: '11px',
                                                        color: '#ffffff',
                                                    }}
                                                >
                                                    {m.isRead ? '읽음' : '안읽음'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>

                {/* ─── 파일 첨부 hidden input ───────────────────── */}
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

                {/* ─── 첨부 패널 ───────────────────────────────── */}
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

                {/* ─── 입력 바 ──────────────────────────────────── */}
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

                {/* ─── 메뉴 오버레이 ───────────────────────────── */}
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
