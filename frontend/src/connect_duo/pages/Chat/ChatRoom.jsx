import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    fetchMessages,
    markRoomRead,
    sendTextMessage,
    uploadRoomFiles,
    connectRoom,
    closeRoom,
    absolutizeFileUrl,
    extractMessagesFromAxiosResponse,
} from '../../api/chatApi';
import './ChatRoom.css';

import txtPanelIcon from '../../assets/txt.png';
import pictureIcon from '../../assets/picture.png';
import txtFileIcon from '../../assets/txt-file.png';

const DRAFT_KEY = 'cd_chat_drafts_v1';
const DRAFT_EVENT = 'cd_draft_updated';
const LAST_READ_MS_KEY = (rid) => `chat_last_read_at_${rid}`;

function safeParse(raw, fallback) {
    try {
        const v = raw ? JSON.parse(raw) : fallback;
        return v ?? fallback;
    } catch {
        return fallback;
    }
}

function loadDraftMap() {
    return safeParse(localStorage.getItem(DRAFT_KEY), {});
}
function saveDraft(roomId, text) {
    const map = loadDraftMap();
    const rid = String(roomId);
    const v = String(text || '');
    const next = { ...map };

    if (v.trim()) next[rid] = v;
    else delete next[rid];

    localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(DRAFT_EVENT));
}
function getDraft(roomId) {
    const map = loadDraftMap();
    return String(map?.[String(roomId)] || '');
}

function pick(obj, ...keys) {
    for (const k of keys) {
        const v = obj?.[k];
        if (v !== undefined && v !== null) return v;
    }
    return undefined;
}

function normalizeTime(m) {
    return pick(m, 'created_at', 'createdAt', 'createdAtUtc', 'time') || new Date().toISOString();
}
function normalizeFileUrl(m) {
    return pick(m, 'file_url', 'fileUrl', 'url', 'downloadUrl') || null;
}
function normalizeFileName(m) {
    return pick(m, 'file_name', 'fileName', 'originalName', 'name') || null;
}
function normalizeFileMime(m) {
    return pick(m, 'file_mime', 'fileMime', 'mime') || null;
}
function normalizeFileSize(m) {
    return pick(m, 'file_size', 'fileSize', 'size') || null;
}
function normalizeSenderId(m) {
    return pick(m, 'sender_id', 'senderId', 'user_id', 'userId');
}
function normalizeContent(m) {
    return pick(m, 'content', 'text', 'message') || '';
}
function normalizeType(m) {
    const t = pick(m, 'type', 'message_type', 'messageType');
    return (t || 'TEXT').toUpperCase();
}

// 파일명 깨짐 보정(선택)
function hangulScore(s) {
    return (String(s || '').match(/[가-힣]/g) || []).length;
}

function tryEscapeRepair(raw) {
    try {
        return decodeURIComponent(escape(raw));
    } catch {
        return raw;
    }
}

function tryTextDecoderRepair(raw) {
    try {
        if (typeof TextDecoder === 'undefined') return raw;
        const bytes = Uint8Array.from(raw.split('').map((c) => c.charCodeAt(0) & 0xff));
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch {
        return raw;
    }
}

function fixMojibakeName(name) {
    const raw = String(name || '');
    if (!raw) return raw;

    const a = tryEscapeRepair(raw);
    const b = tryTextDecoderRepair(raw);

    const candidates = [raw, a, b];

    candidates.sort((x, y) => {
        const hx = hangulScore(x);
        const hy = hangulScore(y);
        if (hy !== hx) return hy - hx;
        const bx = (x.match(/�/g) || []).length;
        const by = (y.match(/�/g) || []).length;
        return bx - by;
    });

    return candidates[0];
}

function mapRowToUiMessage(row, myId) {
    const senderId = normalizeSenderId(row);
    const isMe = String(senderId) === String(myId);

    const rawUrl = normalizeFileUrl(row);
    const absUrl = rawUrl ? absolutizeFileUrl(rawUrl) : null;

    const rawName = normalizeFileName(row);
    const fixedName = rawName ? fixMojibakeName(rawName) : null;

    return {
        id: pick(row, 'id', 'message_id', 'messageId') ?? `unknown-${Math.random()}`,
        from: isMe ? 'me' : 'agent',
        type: normalizeType(row),
        text: normalizeContent(row),
        fileUrl: absUrl,
        fileName: fixedName,
        fileMime: normalizeFileMime(row),
        fileSize: normalizeFileSize(row),
        time: normalizeTime(row),
    };
}

function isTxtLike(m) {
    const name = String(m.fileName || '').toLowerCase();
    const mime = String(m.fileMime || '').toLowerCase();
    return name.endsWith('.txt') || mime === 'text/plain';
}
function stripTxtExt(name) {
    return String(name || '').replace(/\.txt$/i, '');
}
function displayFileTitle(m) {
    const raw = m?.fileName || '파일';
    if (isTxtLike(m)) return stripTxtExt(raw);
    return raw;
}
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
    return `${yyyy}.${mm}.${dd}`;
}

async function downloadFile(url, fileName) {
    const res = await fetch(url, { credentials: 'include' });
    if (res.status === 410) {
        const err = new Error('EXPIRED');
        err.code = 410;
        throw err;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const blob = await res.blob();
    const a = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);

    a.href = objectUrl;
    a.download = fileName || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(objectUrl);
}

function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** ✅ "폴더 열기"는 OS 폴더가 아니라 /uploads-ui 페이지를 연다 */
function getUploadsUiUrlFromFileUrl(fileUrl) {
    const u = String(fileUrl || '');
    try {
        const url = new URL(u, window.location.origin);
        return `${url.origin}/uploads-ui`;
    } catch {
        return '/uploads-ui';
    }
}

/**
 * ✅ TXT "열기"는 /uploads-ui/view/<filename>
 * 핵심: filename이 이미 %EC... 로 인코딩된 경우가 있어서
 * -> decodeURIComponent로 먼저 '한 번만' 풀고
 * -> encodeURIComponent로 '한 번만' 다시 인코딩한다.
 * 그래서 %25... (이중 인코딩) 방지
 */
function getTxtViewerUrl(fileUrl) {
    const u = String(fileUrl || '');

    const build = (origin, filenameMaybeEncoded) => {
        const raw = String(filenameMaybeEncoded || '');
        let decoded = raw;
        try {
            // 이미 %EC... 형태면 여기서 한글로 복원됨
            decoded = decodeURIComponent(raw);
        } catch {
            // raw가 한글/일반문자면 decodeURIComponent가 에러날 수 있음 -> 그대로 둠
            decoded = raw;
        }
        // 최종은 항상 1회 인코딩만
        const onceEncoded = encodeURIComponent(decoded);
        return `${origin}/uploads-ui/view/${onceEncoded}`;
    };

    try {
        const url = new URL(u, window.location.origin);
        const pathname = url.pathname || '';
        const idx = pathname.lastIndexOf('/');
        const filename = idx >= 0 ? pathname.slice(idx + 1) : pathname;
        return build(url.origin, filename);
    } catch {
        const idx = u.lastIndexOf('/');
        const filename = idx >= 0 ? u.slice(idx + 1) : u;
        return build('', filename).replace(/^\/uploads-ui/, '/uploads-ui'); // origin 없는 경우
    }
}

// ✅ 서버 응답에서 메시지 배열 안전 추출
function extractMessagesSafely(res) {
    if (typeof extractMessagesFromAxiosResponse === 'function') {
        const x = extractMessagesFromAxiosResponse(res);
        if (Array.isArray(x)) return x;
    }

    const data = res?.data?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.messages)) return data.messages;
    if (Array.isArray(res?.data?.messages)) return res.data.messages;

    return [];
}

// ✅ 로그인 유저 id(가능하면 여기서)
function getMyIdFallback1() {
    const candidates = [
        safeParse(localStorage.getItem('auth'), null)?.user?.id,
        safeParse(localStorage.getItem('user'), null)?.id,
        safeParse(localStorage.getItem('loginUser'), null)?.id,
        localStorage.getItem('userId'),
    ];
    const v = candidates.find((x) => x != null && String(x).trim() !== '');
    return v != null ? Number(v) || 1 : 1;
}

// ✅ props로 roomId/onBack 받으면 "패널 모드" / 없으면 "라우터 모드"
export default function ChatRoom({ roomId: propRoomId, onBack }) {
    const { roomId: paramRoomId } = useParams();
    const navigate = useNavigate();

    const rid = useMemo(() => String(propRoomId ?? paramRoomId ?? ''), [propRoomId, paramRoomId]);
    const listRef = useRef(null);

    const [showAttach, setShowAttach] = useState(false);
    const txtInputRef = useRef(null);
    const imgInputRef = useRef(null);

    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState('bot'); // bot | connecting | human

    // ✅ msgId: 'loading' | 'failed' | 'expired'
    const [dlState, setDlState] = useState({});

    // 🔎 검색/메뉴
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeHitIdx, setActiveHitIdx] = useState(0);
    const [menuOpen, setMenuOpen] = useState(false);

    const MY_ID = useMemo(() => getMyIdFallback1(), []);

    const scrollToBottom = useCallback(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, []);

    const detectModeFromMessages = (mapped) => {
        const hasConnectedSystem = mapped.some(
            (m) => String(m.type).toUpperCase() === 'SYSTEM' && (m.text || '').includes('상담사가 연결되었습니다'),
        );
        return hasConnectedSystem ? 'human' : 'bot';
    };

    const touchRead = useCallback(
        async (lastMessageId) => {
            try {
                localStorage.setItem(LAST_READ_MS_KEY(rid), String(Date.now()));
                window.dispatchEvent(new Event('chat_meta_updated'));
                if (lastMessageId != null) await markRoomRead(rid, lastMessageId).catch(() => {});
            } catch {}
        },
        [rid],
    );

    const loadMessages = useCallback(async () => {
        if (!rid) return;

        try {
            setLoading(true);
            const res = await fetchMessages(rid);

            const arr = extractMessagesSafely(res);
            const mapped = arr.map((m) => mapRowToUiMessage(m, MY_ID));

            setMessages(mapped);
            setMode((prev) => (prev === 'connecting' ? prev : detectModeFromMessages(mapped)));

            const last = mapped[mapped.length - 1];
            if (last?.id) await touchRead(last.id);
        } catch (e) {
            console.error('메시지 불러오기 실패:', e);
            setMessages([]);
        } finally {
            setLoading(false);
            setTimeout(scrollToBottom, 0);
        }
    }, [rid, scrollToBottom, touchRead, MY_ID]);

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

    const doConnectHuman = async () => {
        if (!rid) return;
        if (loading) return;
        if (mode !== 'bot') return;

        try {
            setMode('connecting');
            await connectRoom(rid);
            await loadMessages();
            setMode('human');
        } catch (e) {
            console.error('상담사 연결 실패:', e);
            setMode('bot');
        }
    };

    const sendMessage = async (overrideText) => {
        const text = (overrideText ?? input).trim();
        if (!text || !rid) return;

        const connectKeywords = ['상담사', '상담원', '사람', '직원'];
        const wantHuman = text.includes('연결') && connectKeywords.some((k) => text.includes(k));

        if (wantHuman) {
            setInput('');
            await doConnectHuman();
            return;
        }

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
            const res = await sendTextMessage(rid, text);
            const data = res?.data?.data;
            const savedUser = data?.user;
            const savedAi = data?.ai;

            if (savedUser) {
                const userUi = mapRowToUiMessage(savedUser, MY_ID);
                setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, ...userUi } : m)));
            }
            if (savedAi) {
                const aiUi = mapRowToUiMessage(savedAi, MY_ID);
                setMessages((prev) => {
                    if (prev.some((x) => String(x.id) === String(aiUi.id))) return prev;
                    return [...prev, aiUi];
                });
            }

            const lastId = savedAi
                ? pick(savedAi, 'id', 'message_id', 'messageId')
                : savedUser
                  ? pick(savedUser, 'id', 'message_id', 'messageId')
                  : null;
            if (lastId) await touchRead(lastId);

            setTimeout(scrollToBottom, 0);
        } catch (e) {
            console.error('전송 실패:', e);
            setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, text: `${text}\n\n(전송 실패)` } : m)));
        } finally {
            setTimeout(scrollToBottom, 0);
        }
    };

    const addFileMessages = async (files) => {
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
            if (e?.code === 410 || e?.message === 'EXPIRED') {
                setDlState((prev) => ({ ...prev, [m.id]: 'expired' }));
                return;
            }
            console.error('다운로드 실패:', e);
            setDlState((prev) => ({ ...prev, [m.id]: 'failed' }));
        }
    };

    const leaveRoom = async () => {
        const ok = window.confirm('정말 나가시겠습니까? 채팅방이 삭제됩니다.');
        if (!ok) return;

        try {
            await closeRoom(rid);
        } catch (e) {
            console.error('채팅방 나가기 실패:', e);
        } finally {
            if (typeof onBack === 'function') onBack();
            else navigate('/chat');
        }
    };

    const onKeyDown = (e) => {
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
                const type = String(m.type).toUpperCase();
                if (type === 'SYSTEM') return false;
                const hay = `${m.text || ''} ${m.fileName || ''}`.toLowerCase();
                return hay.includes(lower);
            })
            .map((m) => m.id);
    }, [messages, query]);

    useEffect(() => {
        if (!searchOpen) return;
        if (!hits.length) return;
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

    const headerTitle = useMemo(() => `세무쳇 (방 ${rid || '-'})`, [rid]);
    const headerStatus = useMemo(() => {
        if (!rid) return '방 정보 없음';
        if (loading) return '불러오는 중…';
        if (mode === 'connecting') return '상담사 연결중…';
        if (mode === 'human') return '상담사 연결됨';
        return '챗봇: ON';
    }, [loading, mode, rid]);

    // ✅ rid가 없을 때 안전 UI
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
                                else navigate('/chat');
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
                                    else navigate('/chat');
                                }}
                                className="cr-back"
                                aria-label="뒤로가기"
                                title="리스트로 돌아가기"
                            >
                                ←
                            </button>

                            <div className="cr-title" title={headerTitle}>
                                {headerTitle}
                            </div>

                            <div className="cr-status">{headerStatus}</div>

                            <div className="cr-headerActions">
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

                            {query.trim() ? (
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
                            ) : null}
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

                            if (isSystem) {
                                return (
                                    <div key={m.id} className="cr-systemRow">
                                        <div className="cr-systemPill">{renderHighlightedText(m.text)}</div>
                                    </div>
                                );
                            }

                            const dl = dlState[m.id] || null;
                            const folderUrl = m.fileUrl ? getUploadsUiUrlFromFileUrl(m.fileUrl) : null;
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
                                        {type === 'IMAGE' && m.fileUrl ? (
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
                                                        {folderUrl && (
                                                            <a
                                                                className="cr-openBtn"
                                                                href={folderUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                            >
                                                                폴더 열기
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
                                        ) : null}

                                        {/* FILE */}
                                        {type === 'FILE' && m.fileUrl ? (
                                            <div className="cr-fileCard">
                                                {isTxtLike(m) && (
                                                    <img className="cr-txtCornerIcon" src={txtFileIcon} alt="txt" />
                                                )}

                                                <div className="cr-fileTopRow">
                                                    <div className="cr-fileBadge">{isTxtLike(m) ? 'TXT' : 'FILE'}</div>
                                                    <div className="cr-fileTitle" title={displayFileTitle(m)}>
                                                        {displayFileTitle(m) || '파일'}
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
                                                    {folderUrl && (
                                                        <a
                                                            className="cr-openBtn"
                                                            href={folderUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            폴더 열기
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
                                        ) : null}

                                        {/* TEXT */}
                                        {type === 'TEXT' ? (
                                            <div className="cr-text">{renderHighlightedText(m.text)}</div>
                                        ) : null}

                                        <div className={`cr-time ${isMe ? 'cr-timeMe' : 'cr-timeOther'}`}>
                                            {timeText}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>

                {/* inputs */}
                <input
                    ref={txtInputRef}
                    type="file"
                    accept=".txt,text/plain"
                    className="cr-hidden"
                    onChange={(e) => {
                        addFileMessages(e.target.files);
                        e.target.value = '';
                    }}
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
                />

                {/* attach panel */}
                {showAttach && (
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

                {/* input bar */}
                <div className="cr-inputBar">
                    <button
                        type="button"
                        onClick={() => setShowAttach((v) => !v)}
                        className={`cr-plus ${showAttach ? 'isOpen' : ''}`}
                        aria-label="첨부"
                        title="파일 업로드"
                    >
                        +
                    </button>

                    <button
                        type="button"
                        onClick={doConnectHuman}
                        disabled={loading || mode !== 'bot'}
                        className={`cr-connect ${
                            mode === 'human'
                                ? 'cr-connectHuman'
                                : mode === 'connecting'
                                  ? 'cr-connectConnecting'
                                  : 'cr-connectBot'
                        }`}
                        title="상담사 연결"
                    >
                        {mode === 'human' ? '상담사 연결됨' : mode === 'connecting' ? '연결중…' : '상담사 연결'}
                    </button>

                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="메시지를 입력하세요"
                        rows={1}
                        className="cr-textarea"
                        onFocus={() => setShowAttach(false)}
                    />

                    <button type="button" onClick={() => sendMessage()} className="cr-send">
                        전송
                    </button>
                </div>

                {/* menu overlay */}
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
