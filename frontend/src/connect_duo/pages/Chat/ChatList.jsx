import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchRooms, createRoom, closeRoom } from '../../api/chatApi';
import './ChatList.css';

const LAST_READ_MS_KEY = (rid) => `chat_last_read_at_${rid}`;
const HISTORY_KEY = (rid) => `chat_history_${rid}`;
const META_KEY = (rid) => `chat_meta_${rid}`;

const DRAFT_KEY = 'cd_chat_drafts_v1';
const DRAFT_EVENT = 'cd_draft_updated';

function safeParse(raw, fallback) {
    try {
        const v = raw ? JSON.parse(raw) : fallback;
        return v ?? fallback;
    } catch {
        return fallback;
    }
}
function pick(obj, ...keys) {
    for (const k of keys) {
        const v = obj?.[k];
        if (v !== undefined && v !== null) return v;
    }
    return undefined;
}
function toMillis(v) {
    if (!v) return 0;
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? 0 : t;
}
function formatDayLabel(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const sameDay =
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();

    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    const yesterday =
        d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate();

    if (sameDay) return '오늘';
    if (yesterday) return '어제';

    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}.${mm}.${dd}`;
}

function computeUnreadLocal(rid) {
    const lastReadMs = Number(localStorage.getItem(LAST_READ_MS_KEY(rid)) || 0);
    const hist = safeParse(localStorage.getItem(HISTORY_KEY(rid)), []);
    const msgs = Array.isArray(hist) ? hist : [];

    let cnt = 0;
    for (const m of msgs) {
        const from = String(m?.from || '');
        if (from === 'me' || from === 'system') continue;

        const t = m?.time || m?.createdAt || m?.created_at;
        const ms = t ? new Date(t).getTime() : 0;
        if (Number.isFinite(ms) && ms > lastReadMs) cnt += 1;
    }
    return cnt;
}

function formatUnread(n) {
    const x = Number(n) || 0;
    if (x <= 0) return '';
    return x >= 100 ? '99+' : String(x);
}

function buildPreviewFromLocalLastMessage(last) {
    if (!last) return '';
    const type = String(last?.type || 'TEXT').toUpperCase();
    if (type === 'FILE') return String(last?.fileName || '파일');
    if (type === 'IMAGE') return String(last?.fileName || '사진');
    return String(last?.text || '').trim();
}

function getPreviewLocalOrServer(rid, serverPreview) {
    const meta = safeParse(localStorage.getItem(META_KEY(rid)), null);
    if (meta?.preview) return meta.preview;

    const hist = safeParse(localStorage.getItem(HISTORY_KEY(rid)), []);
    const msgs = Array.isArray(hist) ? hist : [];
    const last = msgs[msgs.length - 1];

    const localPreview = buildPreviewFromLocalLastMessage(last);
    if (localPreview) return localPreview;

    return serverPreview || '대화를 시작해보세요 🙂';
}

function hasDraft(rid) {
    const map = safeParse(localStorage.getItem(DRAFT_KEY), {});
    const v = String(map?.[String(rid)] || '');
    return !!v.trim();
}

export default function ChatList({ onOpenRoom }) {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadRooms = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetchRooms();
            const list = res?.data?.data;
            setRooms(Array.isArray(list) ? list : []);
        } catch (e) {
            console.error('방 목록 불러오기 실패:', e);
            setRooms([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRooms();

        const onMeta = () => loadRooms();
        const onDraft = () => loadRooms();

        window.addEventListener('chat_meta_updated', onMeta);
        window.addEventListener(DRAFT_EVENT, onDraft);

        return () => {
            window.removeEventListener('chat_meta_updated', onMeta);
            window.removeEventListener(DRAFT_EVENT, onDraft);
        };
    }, [loadRooms]);

    const cards = useMemo(() => {
        const list = (rooms || []).map((r) => {
            const id = String(pick(r, 'id', 'roomId', 'room_id') ?? '');

            const updatedAt =
                toMillis(pick(r, 'updatedAt', 'updated_at', 'last_message_at', 'lastMessageAt')) ||
                toMillis(pick(r, 'createdAt', 'created_at')) ||
                0;

            const serverPreview =
                pick(r, 'lastMessagePreview') ||
                pick(r, 'lastMessage', 'last_message') ||
                pick(r, 'last_message_content', 'lastMessageContent') ||
                '';

            const preview = getPreviewLocalOrServer(id, serverPreview);
            const unread = id ? computeUnreadLocal(id) : 0;
            const draft = id ? hasDraft(id) : false;

            return {
                id,
                title: pick(r, 'title') || '세무쳇',
                preview,
                updatedAt,
                dayLabel: formatDayLabel(updatedAt),
                unread,
                status: pick(r, 'status') || 'ACTIVE',
                draft,
            };
        });

        return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }, [rooms]);

    const openRoom = (rid) => {
        const id = String(rid || '').trim();
        if (!id) return;

        if (typeof onOpenRoom === 'function') {
            onOpenRoom(id);
            return;
        }
        navigate(`/chat/${id}`);
    };

    const createNewRoom = async () => {
        try {
            const payload = { title: '세무쳇', taxId: 2 };
            const res = await createRoom(payload);
            const room = res?.data?.data;

            await loadRooms();
            if (room?.id != null) openRoom(room.id);
        } catch (e) {
            console.error('방 생성 실패:', e);
        }
    };

    const removeRoom = async (rid) => {
        const ok = window.confirm('채팅방을 종료(닫기)할까요?');
        if (!ok) return;

        try {
            await closeRoom(rid);
            await loadRooms();
        } catch (e) {
            console.error('방 종료 실패:', e);
        }
    };

    return (
        <div className="cl-page">
            <div className="cl-panel">
                <div className="cl-header">
                    <div className="cl-title">채팅창 리스트</div>
                    <button onClick={createNewRoom} className="cl-newBtn" disabled={loading}>
                        + 새 채팅
                    </button>
                </div>

                {loading && <div className="cl-loading">불러오는 중…</div>}

                {!loading && cards.length === 0 && (
                    <div className="cl-empty">채팅방이 없습니다. “새 채팅”을 눌러 생성하세요.</div>
                )}

                {cards.map((c) => {
                    const badgeText = formatUnread(c.unread);

                    return (
                        <div
                            key={c.id || Math.random()}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                                if (c.status === 'CLOSED') return;
                                openRoom(c.id);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    if (c.status === 'CLOSED') return;
                                    openRoom(c.id);
                                }
                            }}
                            className="cl-link"
                        >
                            <div className={`cl-card ${c.status === 'CLOSED' ? 'isClosed' : ''}`}>
                                <div className="cl-avatar" title={c.title}>
                                    세
                                </div>

                                <div className="cl-body">
                                    <div className="cl-topRow">
                                        <div className="cl-roomTitle">
                                            {c.title}
                                            {c.status === 'CLOSED' ? ' (종료)' : ''}

                                            {c.draft && (
                                                <span
                                                    className="cl-badge cl-badgeDraft"
                                                    title="전송되지 않은 임시저장 메시지가 있습니다"
                                                >
                                                    임시 저장
                                                </span>
                                            )}

                                            {!!badgeText && (
                                                <span
                                                    className="cl-badge cl-badgeUnread"
                                                    title={`안읽은 메시지 ${c.unread}개`}
                                                >
                                                    {badgeText}
                                                </span>
                                            )}
                                        </div>
                                        <div className="cl-day">{c.dayLabel}</div>
                                    </div>

                                    <div className="cl-preview" title={c.preview}>
                                        {c.preview}
                                    </div>
                                </div>

                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        removeRoom(c.id);
                                    }}
                                    title="채팅방 종료"
                                    className="cl-trashBtn"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
