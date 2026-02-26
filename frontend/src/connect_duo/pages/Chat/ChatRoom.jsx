import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
    listMessages,
    markRead,
    sendMessage as apiSendMessage,
    uploadRoomFiles,
    closeRoom,
    absolutizeFileUrl,
    listRooms, // 종료 상태 조회용
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

    // State
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
    const [roomClosed, setRoomClosed] = useState(false); // 🔥 방 종료 여부

    const MY_ID = useMemo(() => getMyIdFallback1(), []);
    // Scroll to bottom
    const scrollToBottom = useCallback(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, []);

    // 읽음 처리
    const touchRead = useCallback(
        async (lastMessageId) => {
            try {
                localStorage.setItem(LAST_READ_MS_KEY(rid), String(Date.now()));
                window.dispatchEvent(new Event('chat_meta_updated'));
                if (lastMessageId != null) await markRead(rid).catch(() => {});
            } catch {}
        },
        [rid],
    );

    // 마지막 내 메시지 id
    const lastMyMsgId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].from === 'me') return messages[i].id;
        }
        return null;
    }, [messages]);

    // 🔥 방 상태(종료 여부)도 가져옴
    const fetchRoomStatus = useCallback(async () => {
        if (!rid) return;
        try {
            const res = await listRooms();
            if (Array.isArray(res.data)) {
                const meRoom = res.data.find((r) => String(r.id) === rid);
                setRoomClosed(meRoom?.status === 'CLOSED');
            }
        } catch (e) {
            // 실패하면 기본 false
            setRoomClosed(false);
        }
    }, [rid]);

    // 메시지 불러오기 (방 종료여부도 함께 체크)
    const loadMessages = useCallback(async () => {
        if (!rid) return;
        try {
            setLoading(true);
            await fetchRoomStatus();
            const res = await listMessages(rid);
            const arr = extractMessagesSafely(res, (r) => r?.messages || r?.data || r || []);
            const mapped = arr.map((m) => mapRowToUiMessage(m, MY_ID, absolutizeFileUrl));
            setMessages(mapped);
            const last = mapped[mapped.length - 1];
            if (last?.id) await touchRead(last.id);
        } catch (e) {
            console.error('메시지 불러오기 실패:', e);
            setMessages([]);
        } finally {
            setLoading(false);
            setTimeout(scrollToBottom, 0);
        }
    }, [rid, scrollToBottom, touchRead, MY_ID, fetchRoomStatus]);

    useEffect(() => {
        if (!rid) {
            setLoading(false);
            setMessages([]);
            return;
        }
        const draft = getDraft(rid);
        if (draft) setInput(draft);
        loadMessages();
        // eslint-disable-next-line
    }, [rid, loadMessages]);

    useEffect(() => {
        if (!rid) return;
        saveDraft(rid, input);
    }, [rid, input]);

    const sendMessage = async (overrideText) => {
        if (roomClosed) return;
        const text = (overrideText ?? input).trim();
        if (!text || !rid) return;
        setInput('');
        setShowAttach(false);
        const tempId = `temp-${Date.now()}`;
        setMessages((prev) => [
            ...prev,
            {
                id: tempId,
                from: 'me',
                type: 'TEXT',
                text,
                time: new Date().toISOString(),
            },
        ]);
        setTimeout(scrollToBottom, 0);

        try {
            const res = await apiSendMessage(rid, text);
            const data = res?.data?.data || res?.data || res;
            const savedUser = data?.user;
            const savedAi = data?.ai;
            if (savedUser) {
                const userUi = mapRowToUiMessage(savedUser, MY_ID, absolutizeFileUrl);
                setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, ...userUi } : m)));
            }
            if (savedAi) {
                const aiUi = mapRowToUiMessage(savedAi, MY_ID, absolutizeFileUrl);
                setMessages((prev) => {
                    if (prev.some((x) => String(x.id) === String(aiUi.id))) return prev;
                    return [...prev, aiUi];
                });
            }
            setTimeout(scrollToBottom, 0);
        } catch (e) {
            console.error('전송 실패:', e);
            setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, text: `${text}\n\n(전송 실패)` } : m)));
        } finally {
            setTimeout(scrollToBottom, 0);
        }
    };

    const addFileMessages = async (files) => {
        if (roomClosed) return;
        if (!files || files.length === 0 || !rid) return;
        try {
            await uploadRoomFiles(rid, files);
            await loadMessages();
        } catch (e) {
            console.error('파일 업로드 실패:', e);
        } finally {
            setShowAttach(false);
        }
    };

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

    const leaveRoom = async () => {
        if (!window.confirm('정말 나가시겠습니까? 채팅방이 삭제됩니다.')) return;
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

    // 검색 관련
    const hits = useMemo(() => {
        const q = query.trim();
        if (!q) return [];
        const lower = q.toLowerCase();
        return messages
            .filter((m) => {
                const type = String(m.type).toUpperCase();
                if (type === 'SYSTEM') return false;
                const hay = `${m.text || ''} ${m.fileName || ''}`.toLowerCase();
                return hay.includes(lower);
            })
            .map((m) => m.id);
    }, [messages, query]);

    useEffect(() => {
        if (!searchOpen || !hits.length) return;
        const idx = Math.min(activeHitIdx, hits.length - 1);
        const id = hits[idx];
        const el = document.getElementById(`msg-${id}`);
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

    if (!rid) {
        return (
            <div className="cr-page">
                <div className="cr-wrap" style={{ padding: 16 }}>
                    <div style={{ fontWeight: 900, marginBottom: 10 }}>채팅방을 열 수 없어요</div>
                    <div style={{ opacity: 0.8, lineHeight: 1.4 }}>roomId가 비어있거나 잘못 전달되었습니다.</div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                        <button
                            type="button"
                            className="cr-send"
                            onClick={() => {
                                if (typeof onBack === 'function') onBack();
                            }}
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
                <div className="cr-header">
                    {!searchOpen ? (
                        <>
                            <button
                                type="button"
                                onClick={() => {
                                    if (typeof onBack === 'function') onBack();
                                }}
                                className="cr-back"
                                aria-label="뒤로가기"
                                title="리스트로 돌아가기"
                            >
                                ←
                            </button>
                            <div className="cr-title" title={headerTitle}>
                                {headerTitle}
                                {roomClosed && (
                                    <span style={{ color: '#ffe066', fontSize: 14, marginLeft: 8, fontWeight: 700 }}>
                                        [상담 종료]
                                    </span>
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
                                    disabled={roomClosed}
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
                                : timeObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

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

                {/* 파일 첨부 input - 종료방이면 disabled */}
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

                {/* 첨부 패널 */}
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

                {/* 입력 바 - 종료방이면 전체 disabled */}
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
                        placeholder={roomClosed ? '상담이 종료되어 메시지 입력 불가' : '메시지를 입력하세요'}
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

                {/* 메뉴 오버레이 */}
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
