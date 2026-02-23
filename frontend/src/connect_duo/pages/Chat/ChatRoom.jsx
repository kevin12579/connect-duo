import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchMessages, markRoomRead, sendTextMessage, uploadRoomFiles, CHAT_MESSAGE_EVENT } from '../../api/chatApi';
import './ChatRoom.css';

import {
    dayKey,
    formatDayLabel,
    pick,
    normalizeTime,
    normalizeFileUrl,
    normalizeFileName,
    normalizeSenderId,
    normalizeContent,
    normalizeType,
    normalizeRead,
} from '../../utils/chat/messageNormalize';

import { upsertRoomMeta } from '../../utils/chat/roomMeta';
import { demoAgentReply } from '../../utils/chat/demoAgent';

// ==============================
// ✅ bytes -> "68.38KB" formatter
// ==============================
function formatBytes(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let v = n;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i += 1;
    }
    const fixed = i === 0 ? 0 : 2;
    return `${v.toFixed(fixed)}${units[i]}`;
}
function formatExpireDate(baseTime) {
    if (!baseTime) return '';

    const base = new Date(baseTime);
    if (Number.isNaN(base.getTime())) return '';

    const expire = new Date(base);
    expire.setDate(expire.getDate() + 7);

    const yyyy = expire.getFullYear();
    const mm = String(expire.getMonth() + 1).padStart(2, '0');
    const dd = String(expire.getDate()).padStart(2, '0');

    return `~${yyyy}.${mm}.${dd}`;
}
export default function ChatRoom() {
    const { roomId } = useParams();
    const rid = roomId || 'demo-room';
    const draftKey = `draft_${rid}`;
    const draftTimeKey = `draft_updatedAt_${rid}`;
    const draftHydratedRef = useRef(false);

    useEffect(() => {
        if (!rid) return;
        upsertRoomMeta(rid, { title: '세무쳇' }); // unreadCount 건드리지 마!
    }, [rid]);

    const listRef = useRef(null);
    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);

    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    useEffect(() => {
        // ✅ 방 들어오자마자 input === '' 때문에 draft가 지워지는 걸 방지
        if (!draftHydratedRef.current) return;

        if (input && input.trim().length > 0) {
            localStorage.setItem(draftKey, input);
            localStorage.setItem(draftTimeKey, String(Date.now()));
        } else {
            localStorage.removeItem(draftKey);
            localStorage.removeItem(draftTimeKey);
        }

        window.dispatchEvent(new Event('chat_meta_updated'));
    }, [input, draftKey, draftTimeKey]);

    useEffect(() => {
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) setInput(savedDraft);

        draftHydratedRef.current = true;
    }, [rid, draftKey]);

    // { [messageId]: true/false }
    const [expandedTxt, setExpandedTxt] = useState(() => ({}));

    // ✅ 다운로드 버튼 상태 + 실패 표시
    // { [messageId]: { downloaded?: boolean, downloadFailed?: boolean, expired?: boolean } }
    const [fileActionState, setFileActionState] = useState(() => ({}));
    const markAction = (id, patch) => {
        setFileActionState((prev) => ({
            ...prev,
            [id]: { ...(prev?.[id] || {}), ...patch },
        }));
    };

    const MY_ID = 1;

    const scrollToBottom = () => {
        const el = listRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
        requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
    };

    // ✅ textarea 자동 높이
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }, [input, draftKey, draftTimeKey]);

    // ==============================
    // ✅ 다운로드
    // - downloadUrl 있으면 우선 사용
    // - 410 -> 만료 표시
    // ==============================
    const downloadFile = async (m) => {
        const url = m?.downloadUrl || m?.fileUrl; // ✅ 우선순위: downloadUrl
        if (!url) return;

        try {
            markAction(m.id, { downloadFailed: false, expired: false });

            const res = await fetch(url, { credentials: 'include' });

            if (res.status === 410) {
                // ✅ 만료
                markAction(m.id, { expired: true, downloadFailed: false });
                return;
            }

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const blob = await res.blob();
            const a = document.createElement('a');
            const objUrl = window.URL.createObjectURL(blob);

            a.href = objUrl;
            a.download = m.fileName || 'file';

            document.body.appendChild(a);
            a.click();
            a.remove();

            window.URL.revokeObjectURL(objUrl);

            markAction(m.id, { downloaded: true });
        } catch (e) {
            console.error('다운로드 실패:', e);
            markAction(m.id, { downloadFailed: true });
        }
    };

    // ==============================
    // ✅ 메시지 로드
    // ==============================
    const loadMessages = async () => {
        if (!rid) return;

        try {
            setLoading(true);

            // ✅ chatApi fetchMessages는 "배열"을 리턴함
            const raw = await fetchMessages(rid);

            // ✅ 보고 있는 방 읽음 처리
            await markRoomRead(rid).catch(() => {});

            const mapped = (Array.isArray(raw) ? raw : []).map((m) => {
                const senderId = normalizeSenderId(m);
                const isMe = String(senderId) === String(MY_ID) || String(m?.from) === 'me';

                return {
                    id: pick(m, 'id', 'message_id', 'messageId') ?? `unknown-${Math.random()}`,
                    from: isMe ? 'me' : 'agent',
                    type: normalizeType(m),
                    text: normalizeContent(m),
                    fileUrl: normalizeFileUrl(m),
                    fileName: normalizeFileName(m),
                    downloadUrl: pick(m, 'downloadUrl', 'download_url') ?? null, // ✅ 추가
                    attachments: pick(m, 'attachments') ?? null, // ✅ 추가 (size용)
                    time: normalizeTime(m),
                    read: normalizeRead(m),
                };
            });

            setMessages(mapped);

            // ✅ unread 계산 재료 갱신
            localStorage.setItem(`chat_history_${rid}`, JSON.stringify(mapped));
            localStorage.setItem(`chat_lastRead_${rid}`, new Date().toISOString());
            window.dispatchEvent(new Event('chat_meta_updated'));
        } catch (e) {
            console.error('메시지 불러오기 실패:', e);
        } finally {
            setLoading(false);
            requestAnimationFrame(scrollToBottom);
        }
    };

    useEffect(() => {
        if (!rid) return;

        loadMessages();

        // ✅ 지금 내가 보고 있는 방 기록
        localStorage.setItem('chat_active_room', String(rid));
        localStorage.setItem(`chat_lastRead_${rid}`, new Date().toISOString());
        window.dispatchEvent(new Event('chat_meta_updated'));

        return () => {
            const cur = localStorage.getItem('chat_active_room');
            if (cur === String(rid)) localStorage.removeItem('chat_active_room');
        };
        // eslint-disable-next-line
    }, [rid]);

    // ==============================
    // 🔥 실시간 이벤트 구독
    // ==============================
    useEffect(() => {
        const handler = (e) => {
            const { roomId, message } = e.detail || {};
            if (!message) return;
            if (String(roomId) !== String(rid)) return;

            // 내 텍스트는 서버 재반영시 중복 방지용: 읽음 처리만
            const isMyText = message?.from === 'me' && String(message?.type).toUpperCase() === 'TEXT';
            if (isMyText) {
                markRoomRead(rid).catch(() => {});
                localStorage.setItem(`chat_lastRead_${rid}`, new Date().toISOString());
                window.dispatchEvent(new Event('chat_meta_updated'));
                return;
            }

            setMessages((prev) => {
                if (prev.some((m) => String(m.id) === String(message?.id))) return prev;

                const newMsg = {
                    id: message.id,
                    from: message.from,
                    type: message.type,
                    text: message.text,
                    fileUrl: message.fileUrl ?? null,
                    fileName: message.fileName ?? null,
                    downloadUrl: message.downloadUrl ?? null, // ✅ 추가
                    attachments: message.attachments ?? null, // ✅ 추가 (size용)
                    time: message.time,
                    read: message.read ?? true,
                };

                const next = [...prev, newMsg];

                localStorage.setItem(`chat_history_${rid}`, JSON.stringify(next));
                localStorage.setItem(
                    `chat_meta_${rid}`,
                    JSON.stringify({
                        preview: newMsg.text || (newMsg.fileName ? `[파일] ${newMsg.fileName}` : ''),
                        updatedAt: Date.now(),
                    }),
                );

                window.dispatchEvent(new Event('chat_meta_updated'));
                return next;
            });

            requestAnimationFrame(scrollToBottom);
            window.dispatchEvent(new Event('chat_meta_updated'));
        };

        window.addEventListener(CHAT_MESSAGE_EVENT, handler);
        return () => window.removeEventListener(CHAT_MESSAGE_EVENT, handler);
    }, [rid]);

    // ✅ 마지막 내 메시지 id (읽음 표시용)
    const lastMyMessageId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.from === 'me') return messages[i].id;
        }
        return null;
    }, [messages]);

    // ==============================
    // ✅ 데모 상담사 자동응답
    // ==============================
    const demoPushAgentMessage = (userText) => {
        setTimeout(() => {
            const replyText = demoAgentReply(userText);

            window.dispatchEvent(
                new CustomEvent(CHAT_MESSAGE_EVENT, {
                    detail: {
                        roomId: rid,
                        message: {
                            id: `agent-${Date.now()}`,
                            from: 'agent',
                            type: 'TEXT',
                            text: replyText,
                            time: new Date().toISOString(),
                            read: false,
                        },
                    },
                }),
            );
        }, 700);
    };

    // ✅ Enter 전송 + Shift+Enter 줄바꿈
    const onKeyDown = (e) => {
        if (e.nativeEvent?.isComposing) return; // 한글 조합중 Enter 방지
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // ==============================
    // ✅ 텍스트 전송
    // ==============================
    const sendMessage = async (overrideText) => {
        const text = (overrideText ?? input).trim();
        if (!text || !rid || sending) return;

        setSending(true);
        setInput('');
        localStorage.removeItem(draftKey);
        localStorage.removeItem(draftTimeKey);
        window.dispatchEvent(new Event('chat_meta_updated'));

        // ✅ 1) optimistic UI (내 메시지 즉시 추가)
        const tempId = `temp-${Date.now()}`;
        const optimistic = {
            id: tempId,
            from: 'me',
            type: 'TEXT',
            text,
            time: new Date().toISOString(),
            read: false,
        };

        setMessages((prev) => {
            const next = [...prev, optimistic];
            localStorage.setItem(`chat_history_${rid}`, JSON.stringify(next));
            localStorage.setItem(`chat_meta_${rid}`, JSON.stringify({ preview: text, updatedAt: Date.now() }));
            return next;
        });

        requestAnimationFrame(scrollToBottom);

        try {
            // ✅ 2) 서버 전송
            const created = await sendTextMessage(rid, text);

            // ✅ 3) 서버 응답 메시지를 이벤트로 다시 흘려보내서(중복 방지 로직 있음)
            if (created) {
                window.dispatchEvent(
                    new CustomEvent(CHAT_MESSAGE_EVENT, {
                        detail: {
                            roomId: rid,
                            message: {
                                id: created.id ?? `me-${Date.now()}`,
                                from: 'me',
                                type: 'TEXT',
                                text: created.text ?? text,
                                time: created.time ?? new Date().toISOString(),
                                read: false,
                            },
                        },
                    }),
                );
            }

            // ✅ 4) 보고있는 방 읽음 처리
            await markRoomRead(rid).catch(() => {});
            localStorage.setItem(`chat_lastRead_${rid}`, new Date().toISOString());
            window.dispatchEvent(new Event('chat_meta_updated'));
        } catch (err) {
            console.error('메시지 전송 실패:', err);
            alert('메시지 전송 실패!');
        } finally {
            setSending(false);

            // ✅ 데모 상담사 자동답변
            demoPushAgentMessage(text);
        }
    };

    // ==============================
    // ✅ 파일 업로드
    // ==============================
    const onPickFiles = async (e) => {
        const list = Array.from(e.target.files || []);
        if (list.length === 0 || !rid) return;

        const first = list[0];

        // ✅ txt 내용 미리 읽기(업로드 전에)
        let txtPreview = '';
        const isTxt = first && (first.type === 'text/plain' || /\.txt$/i.test(first.name || ''));

        if (isTxt) {
            try {
                const rawText = await first.text();
                txtPreview = rawText.length > 5000 ? rawText.slice(0, 5000) + '\n…(이하 생략)' : rawText;
            } catch {
                txtPreview = '';
            }
        }

        // ✅ fallback에서도 쓸 localMeta(무조건 존재해야 함)
        const localMeta = list.map((f) => ({
            name: f.name,
            size: f.size,
            type: f.type,
        }));

        try {
            const uploaded = await uploadRoomFiles(rid, list);
            console.log('uploaded:', uploaded);

            // ✅ 서버가 attachments를 안 주면 우리가 만든다 (용량 무조건 표시)
            const attachmentsForUi = list.map((f, idx) => ({
                name: f.name,
                size: f.size,
                type: f.type,
                url: idx === 0 ? uploaded?.downloadUrl || uploaded?.fileUrl || null : null,
            }));

            // ✅ uploaded가 있으면 업로드 응답 기반으로 메시지 생성
            if (uploaded) {
                window.dispatchEvent(
                    new CustomEvent(CHAT_MESSAGE_EVENT, {
                        detail: {
                            roomId: rid,
                            message: {
                                id: uploaded?.id ?? `file-${Date.now()}`,
                                from: uploaded?.from || 'me',
                                type: uploaded?.type || 'FILE',
                                text: uploaded?.text || (isTxt ? txtPreview : ''),
                                fileUrl: uploaded?.fileUrl || null,
                                fileName: uploaded?.fileName || first?.name || null,
                                downloadUrl: uploaded?.downloadUrl || null,
                                attachments: attachmentsForUi, // ✅ 여기서 size가 살아있음!
                                time: uploaded?.time || new Date().toISOString(),
                                read: uploaded?.read ?? false,
                            },
                        },
                    }),
                );
                return;
            }

            // ✅ uploaded가 없으면 fallback로 표시
            const fallbackId = `file-${Date.now()}`;
            window.dispatchEvent(
                new CustomEvent(CHAT_MESSAGE_EVENT, {
                    detail: {
                        roomId: rid,
                        message: {
                            id: fallbackId,
                            from: 'me',
                            type: 'FILE',
                            text: isTxt ? txtPreview : '',
                            fileUrl: null,
                            fileName: first?.name || '파일',
                            downloadUrl: null,
                            attachments: localMeta, // ✅ fallback도 size 표시
                            time: new Date().toISOString(),
                            read: false,
                        },
                    },
                }),
            );
        } catch (err) {
            console.error('파일 업로드 실패:', err);
            alert('파일 업로드 실패! (서버/라우트/CORS/응답 확인 필요)');
        } finally {
            e.target.value = '';
            textareaRef.current?.focus();
        }
    };

    const onClickAiCounselor = async () => {
        await sendMessage('상담사 연결');
    };

    const headerTitle = useMemo(() => `세무쳇 (방 ${rid})`, [rid]);

    return (
        <div className="chatroom-page">
            <div className="chatroom-shell">
                <div className="chatroom-header">
                    <Link to="/chat" className="chatroom-back-btn">
                        ←
                    </Link>
                    <div className="chatroom-title">{headerTitle}</div>
                    <div className="chatroom-status">{loading ? '불러오는 중…' : '연결됨'}</div>
                </div>

                <div ref={listRef} className="chatroom-list">
                    {loading ? (
                        <div>메시지 불러오는 중…</div>
                    ) : (
                        messages.map((m, idx) => {
                            const isMe = m.from === 'me';
                            const currDay = dayKey(m.time);
                            const prevDay = idx > 0 ? dayKey(messages[idx - 1]?.time) : '';
                            const showDayDivider = currDay && currDay !== prevDay;

                            return (
                                <React.Fragment key={m.id}>
                                    {showDayDivider && <div className="day-divider">{formatDayLabel(m.time)}</div>}

                                    <div className={`msg-row ${isMe ? 'me' : 'other'}`}>
                                        <div className={`msg-bubble ${isMe ? 'me' : 'other'}`}>
                                            {m.type === 'FILE' || m.fileName ? (
                                                <div>
                                                    {(() => {
                                                        const fileName = m.fileName || '파일';
                                                        const lower = String(fileName).toLowerCase();
                                                        const dot = lower.lastIndexOf('.');
                                                        const ext = dot > -1 ? lower.slice(dot + 1).toUpperCase() : '';

                                                        return (
                                                            <div className="file-head">
                                                                <div className="file-title" title={fileName}>
                                                                    📎 {fileName}
                                                                </div>

                                                                {/* ✅ 위쪽은 확장자만 (중복 방지) */}
                                                                <div className="file-meta">{ext || 'FILE'}</div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* ✅ 토글(내용 보기/접기) + 이미지/텍스트 프리뷰 */}
                                                    {(() => {
                                                        const name = String(m.fileName || '').toLowerCase();
                                                        const url = String(m.fileUrl || '');

                                                        const isImage =
                                                            name.endsWith('.png') ||
                                                            name.endsWith('.jpg') ||
                                                            name.endsWith('.jpeg') ||
                                                            name.endsWith('.gif') ||
                                                            name.endsWith('.webp') ||
                                                            (m.fileUrl && url.startsWith('http'));

                                                        const hasTxt = m.text && String(m.text).trim().length > 0;

                                                        // 이미지도 아니고 txt도 아니면(일반 파일) 토글 UI 생략
                                                        if (!isImage && !hasTxt) return null;

                                                        const opened = !!expandedTxt?.[m.id];

                                                        return (
                                                            <div style={{ marginTop: 8 }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setExpandedTxt((prev) => ({
                                                                            ...prev,
                                                                            [m.id]: !prev?.[m.id],
                                                                        }))
                                                                    }
                                                                    style={{
                                                                        border: '1px solid rgba(255,255,255,0.18)',
                                                                        background: 'rgba(255,255,255,0.06)',
                                                                        color: 'white',
                                                                        padding: '6px 10px',
                                                                        borderRadius: 10,
                                                                        cursor: 'pointer',
                                                                        fontSize: 12,
                                                                        fontWeight: 800,
                                                                    }}
                                                                >
                                                                    {opened ? '내용 접기' : '내용 보기'}
                                                                </button>

                                                                {/* ✅ 펼쳤을 때: 이미지 */}
                                                                {opened && isImage && m.fileUrl && (
                                                                    <div style={{ marginTop: 10 }}>
                                                                        <img
                                                                            src={m.fileUrl}
                                                                            alt={m.fileName || 'image'}
                                                                            style={{
                                                                                maxWidth: '260px',
                                                                                width: '100%',
                                                                                borderRadius: 12,
                                                                                border: '1px solid rgba(255,255,255,0.12)',
                                                                                display: 'block',
                                                                            }}
                                                                        />
                                                                    </div>
                                                                )}

                                                                {/* ✅ 펼쳤을 때: txt */}
                                                                {opened && hasTxt && (
                                                                    <pre
                                                                        style={{
                                                                            marginTop: 10,
                                                                            whiteSpace: 'pre-wrap',
                                                                            background: 'rgba(0,0,0,0.20)',
                                                                            border: '1px solid rgba(255,255,255,0.10)',
                                                                            borderRadius: 12,
                                                                            padding: 10,
                                                                            lineHeight: 1.35,
                                                                            fontSize: 13,
                                                                            opacity: 0.95,
                                                                        }}
                                                                    >
                                                                        {m.text}
                                                                    </pre>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* ✅ 다운로드 버튼 + (아래) 용량/만료 */}
                                                    {(m.downloadUrl || m.fileUrl) && (
                                                        <div
                                                            style={{
                                                                marginTop: 10,
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                alignItems: 'flex-start',
                                                                gap: 6,
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 8,
                                                                    flexWrap: 'wrap',
                                                                }}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() => downloadFile(m)}
                                                                    style={{
                                                                        border: '1px solid rgba(255,255,255,0.18)',
                                                                        background: fileActionState?.[m.id]?.downloaded
                                                                            ? 'rgba(139,92,246,0.25)'
                                                                            : 'rgba(59,130,246,0.20)',
                                                                        color: 'white',
                                                                        padding: '6px 10px',
                                                                        borderRadius: 10,
                                                                        cursor: 'pointer',
                                                                        fontSize: 12,
                                                                        fontWeight: 800,
                                                                    }}
                                                                >
                                                                    다운로드
                                                                </button>

                                                                {fileActionState?.[m.id]?.expired && (
                                                                    <span
                                                                        style={{
                                                                            color: '#ffb020',
                                                                            fontWeight: 900,
                                                                            fontSize: 12,
                                                                        }}
                                                                    >
                                                                        보관기간 만료
                                                                    </span>
                                                                )}

                                                                {fileActionState?.[m.id]?.downloadFailed && (
                                                                    <span
                                                                        style={{
                                                                            color: '#ff6b6b',
                                                                            fontWeight: 900,
                                                                            fontSize: 12,
                                                                        }}
                                                                    >
                                                                        다운 실패
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* ✅ 버튼 아래 "용량 · 7일" (여기만 남김) */}
                                                            {(() => {
                                                                const expireLabel = formatExpireDate(m.time);
                                                                const bytes = m?.attachments?.[0]?.size ?? null;
                                                                const sizeLabel = bytes ? formatBytes(bytes) : '';
                                                                const label = sizeLabel
                                                                    ? `${sizeLabel} · ${expireLabel}`
                                                                    : `${expireLabel}`;

                                                                return <div className="file-submeta">{label}</div>;
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                m.text
                                            )}

                                            <div className="msg-meta">
                                                {isMe && m.id === lastMyMessageId && m.read && <span>읽음</span>}
                                                <span>
                                                    {new Date(m.time).toLocaleTimeString('ko-KR', {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.txt"
                    style={{ display: 'none' }}
                    onChange={onPickFiles}
                />

                <div className="chatroom-inputbar">
                    <button onClick={() => fileInputRef.current?.click()}>+</button>
                    <button onClick={onClickAiCounselor}>AI 상담사</button>

                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="메시지를 입력하세요"
                    />

                    <button onClick={() => sendMessage()} disabled={sending}>
                        {sending ? '전송중…' : '전송'}
                    </button>
                </div>
            </div>
        </div>
    );
}
