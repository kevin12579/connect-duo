import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CHAT_MESSAGE_EVENT } from '../../api/chatApi';
import {
    safeParse,
    ROOMS_KEY,
    CHAT_META_UPDATED_EVENT,
    getRooms,
    saveRooms,
    ensureDefaultRoom,
    makeRoomId,
} from '../../utils/chat/storage';

import { getRoomCard } from '../../utils/chat/roomCard';

// ✅ 알림 토글 저장 키
const NOTI_ENABLED_KEY = 'chat_noti_enabled';

// ✅ 파일(mp3/wav) 대신 WebAudio 비프음 (Range 416 이슈 회피)
function playBeep() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = 880; // 소리 높이(원하면 660~1200 사이로 조절)
        gain.gain.value = 0.0001;

        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

        osc.start(now);
        osc.stop(now + 0.13);

        osc.onended = () => {
            ctx.close().catch(() => {});
        };
    } catch {
        // ignore
    }
}

// ✅ 99+ 포맷
function formatUnread(n) {
    const x = Number(n) || 0;
    if (x <= 0) return '';
    return x >= 100 ? '99+' : String(x);
}

// ✅ draft(임시저장) 읽기
function getDraft(roomId) {
    const text = (localStorage.getItem(`draft_${roomId}`) || '').trim();
    if (!text) return null;

    const updatedAtRaw = localStorage.getItem(`draft_updatedAt_${roomId}`);
    const updatedAt = updatedAtRaw ? Number(updatedAtRaw) : Date.now();

    const preview = text.length > 25 ? text.slice(0, 25) + '…' : text;
    return { text, preview, updatedAt };
}

// ✅ 리스트용 날짜 라벨 (간단 버전)
function dayLabelFromTs(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';

    const now = new Date();
    const sameDay =
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();

    if (sameDay) return '오늘';

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd}`;
}

// ✅ time label: 안읽음(뱃지) 있을 때만 "분 전/1시간 전" 표시 (최대 1시간)
// - 1시간(60분) 이내: '59분 전' ... '1시간 전'
// - 1시간 초과 & 같은 날: '오후 12:23'
// - 다른 날: 'YYYY.MM.DD'
function toMs(t) {
    if (!t) return 0;
    if (typeof t === 'number') return t;
    const ms = new Date(t).getTime();
    return Number.isFinite(ms) ? ms : 0;
}

function formatTimeKo(ts) {
    if (!ts) return '';
    try {
        return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

function isSameDayTs(tsA, tsB) {
    const a = new Date(tsA);
    const b = new Date(tsB);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ✅ unreadCount + 마지막 안읽은 메시지 timestamp 같이 계산
function computeUnreadInfo(rid) {
    const lastReadIso = localStorage.getItem(`chat_lastRead_${rid}`);
    const lastReadTs = toMs(lastReadIso);

    const history = safeParse(localStorage.getItem(`chat_history_${rid}`), []);
    const list = Array.isArray(history) ? history : [];

    let count = 0;
    let lastTs = 0;

    for (const m of list) {
        const ts = toMs(m?.time);
        if (m?.from !== 'me' && ts > lastReadTs) {
            count += 1;
            if (ts > lastTs) lastTs = ts;
        }
    }

    return { count, lastTs };
}

// ✅ 안읽음 있을 때 보여줄 라벨(1시간까지만 상대시간)
function labelFromUnreadTs(ts) {
    const ms = toMs(ts);
    if (!ms) return '';

    const now = Date.now();
    const diffMin = Math.floor((now - ms) / (60 * 1000));

    if (diffMin <= 0) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffMin === 60) return '1시간 전';

    // 1시간 초과
    if (isSameDayTs(ms, now)) return formatTimeKo(ms);
    return dayLabelFromTs(ms);
}
export default function ChatList() {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState(() => ensureDefaultRoom());

    // 🔥 리스트 화면에서는 active_room 제거 (배지 정상 동작용)
    useEffect(() => {
        localStorage.removeItem('chat_active_room');
    }, []);

    // 🔔 알림 ON/OFF (localStorage 유지)
    const [soundEnabled, setSoundEnabled] = useState(() => {
        const raw = localStorage.getItem(NOTI_ENABLED_KEY);
        return raw === null ? true : raw === 'true'; // 기본 ON
    });
    const soundEnabledRef = useRef(soundEnabled);

    useEffect(() => {
        soundEnabledRef.current = soundEnabled;
        localStorage.setItem(NOTI_ENABLED_KEY, String(soundEnabled));
    }, [soundEnabled]);

    // ✅ 통합 동기화 useEffect (중복 제거)
    useEffect(() => {
        const sync = () => {
            const nextRooms = getRooms();
            setRooms(Array.isArray(nextRooms) ? nextRooms : []);
        };

        const onStorage = (e) => {
            if (!e.key) return;
            if (
                e.key === ROOMS_KEY ||
                e.key.startsWith('chat_history_') ||
                e.key.startsWith('chat_meta_') ||
                e.key.startsWith('chat_lastRead_') ||
                e.key.startsWith('draft_') ||
                e.key.startsWith('draft_updatedAt_')
            ) {
                sync();
            }
        };

        sync();

        window.addEventListener('storage', onStorage);
        window.addEventListener(CHAT_META_UPDATED_EVENT, sync);

        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener(CHAT_META_UPDATED_EVENT, sync);
        };
    }, []);

    // 🔥 실시간 메시지 이벤트 구독
    useEffect(() => {
        const onMsg = (e) => {
            const { roomId, message } = e.detail || {};
            if (!roomId || !message) return;

            const rid = String(roomId);

            // ✅ 1) history 저장 (unread 계산 재료)
            const historyKey = `chat_history_${rid}`;
            const prev = safeParse(localStorage.getItem(historyKey), []);
            const list = Array.isArray(prev) ? prev : [];

            const isNew = !list.some((m) => String(m?.id) === String(message?.id));

            if (isNew) {
                localStorage.setItem(historyKey, JSON.stringify([...list, message]));
            }

            // ✅ 2) meta 저장 (카드 미리보기/정렬)
            localStorage.setItem(
                `chat_meta_${rid}`,
                JSON.stringify({
                    preview: message.text || (message.fileName ? `[파일] ${message.fileName}` : ''),
                    updatedAt: Date.now(),
                }),
            );

            // ✅ 3) 내가 보고 있는 방이면 lastRead 갱신 (읽음 처리)
            const active = localStorage.getItem('chat_active_room');
            const isActive = String(active) === rid;

            if (isActive) {
                localStorage.setItem(`chat_lastRead_${rid}`, new Date().toISOString());
            }

            // 🔔 4) 알림음: "새 메시지" + "내가 보고 있는 방 아님" + "토글 ON"일 때만 울림
            if (isNew && !isActive && soundEnabledRef.current) {
                playBeep();
            }

            // ✅ 5) 리스트 갱신 이벤트
            window.dispatchEvent(new Event(CHAT_META_UPDATED_EVENT));
        };

        window.addEventListener(CHAT_MESSAGE_EVENT, onMsg);
        return () => window.removeEventListener(CHAT_MESSAGE_EVENT, onMsg);
    }, []);

    // ✅ 카드 생성 (draft 반영)
    const cards = useMemo(() => {
        const list = rooms.map((r) => {
            const card = getRoomCard(r);
            const draft = getDraft(card.id);

            // ✅ unread 계산 (history + lastRead 기준)
            const unreadInfo = computeUnreadInfo(card.id);
            const unread = unreadInfo.count;

            if (draft) {
                const nextUpdatedAt = Math.max(card.updatedAt || 0, draft.updatedAt || 0);

                // unread가 있으면 "마지막 안읽은 메시지 시간" 기준으로 라벨 표시
                const labelTs = unread > 0 && unreadInfo.lastTs ? unreadInfo.lastTs : nextUpdatedAt;

                return {
                    ...card,
                    unread,
                    preview: `임시저장: ${draft.preview}`,
                    updatedAt: nextUpdatedAt,
                    dayLabel: unread > 0 ? labelFromUnreadTs(labelTs) : dayLabelFromTs(labelTs),
                    __hasDraft: true,
                };
            }

            const baseTs = card.updatedAt || 0;
            const labelTs = unread > 0 && unreadInfo.lastTs ? unreadInfo.lastTs : baseTs;

            return {
                ...card,
                unread,
                dayLabel: unread > 0 ? labelFromUnreadTs(labelTs) : dayLabelFromTs(labelTs),
                __hasDraft: false,
            };
        });

        return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }, [rooms]);

    const createNewRoom = () => {
        const newRoom = {
            id: makeRoomId(),
            title: '세무쳇',
            createdAt: Date.now(),
        };

        const next = [...getRooms(), newRoom];
        saveRooms(next);
        setRooms(next);

        navigate(`/chat/${newRoom.id}`);
    };

    const removeRoom = (rid) => {
        const next = getRooms().filter((r) => r?.id !== rid);
        saveRooms(next);
        setRooms(next);

        localStorage.removeItem(`chat_history_${rid}`);
        localStorage.removeItem(`chat_meta_${rid}`);
        localStorage.removeItem(`chat_lastRead_${rid}`);

        // ✅ draft도 같이 제거
        localStorage.removeItem(`draft_${rid}`);
        localStorage.removeItem(`draft_updatedAt_${rid}`);
    };

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a' }}>
            <div
                style={{
                    width: 'min(1700px, 98%)',
                    margin: '0 auto',
                    color: 'white',
                    padding: 18,
                    boxSizing: 'border-box',
                }}
            >
                {/* 헤더 */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 14,
                        gap: 10,
                    }}
                >
                    <div style={{ fontWeight: 900 }}>채팅창 리스트</div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* 🔔 알림 토글 */}
                        <button
                            type="button"
                            onClick={() => setSoundEnabled((v) => !v)}
                            style={{
                                border: '1px solid rgba(255,255,255,0.12)',
                                background: soundEnabled ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.06)',
                                color: 'white',
                                padding: '8px 12px',
                                borderRadius: 14,
                                fontWeight: 900,
                                cursor: 'pointer',
                            }}
                            title={soundEnabled ? '알림 ON' : '알림 OFF'}
                            aria-pressed={soundEnabled}
                        >
                            {soundEnabled ? '🔔 알림 ON' : '🔕 알림 OFF'}
                        </button>

                        <button
                            onClick={createNewRoom}
                            style={{
                                border: 'none',
                                background: 'rgba(255,255,255,0.10)',
                                color: 'white',
                                padding: '8px 12px',
                                borderRadius: 14,
                                fontWeight: 900,
                                cursor: 'pointer',
                            }}
                        >
                            + 새 채팅
                        </button>
                    </div>
                </div>

                {/* 카드 리스트 */}
                {cards.map((c) => {
                    const badgeText = formatUnread(c.unread);

                    return (
                        <div
                            key={c.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate(`/chat/${c.id}`)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    navigate(`/chat/${c.id}`);
                                }
                            }}
                            style={{ textDecoration: 'none' }}
                        >
                            <div
                                style={{
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.10)',
                                    borderRadius: 18,
                                    padding: '12px 14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    marginBottom: 10,
                                    cursor: 'pointer',
                                }}
                            >
                                {/* 아바타 */}
                                <div
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 999,
                                        background: 'rgba(255,255,255,0.14)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 900,
                                    }}
                                >
                                    세
                                </div>

                                {/* 텍스트 영역 */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            gap: 10,
                                        }}
                                    >
                                        <div style={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {c.title}
                                            {c.__hasDraft && (
                                                <span
                                                    style={{
                                                        fontSize: 11,
                                                        fontWeight: 900,
                                                        color: '#ffb020',
                                                        border: '1px solid rgba(255,176,32,0.35)',
                                                        background: 'rgba(255,176,32,0.10)',
                                                        padding: '2px 8px',
                                                        borderRadius: 999,
                                                    }}
                                                >
                                                    임시저장
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{c.dayLabel}</div>
                                    </div>

                                    <div
                                        style={{
                                            color: 'rgba(255,255,255,0.7)',
                                            fontSize: 13,
                                            marginTop: 4,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {c.preview}
                                    </div>
                                </div>

                                {/* 오른쪽 영역 */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {badgeText && (
                                        <div
                                            style={{
                                                minWidth: 22,
                                                height: 22,
                                                borderRadius: 999,
                                                background: 'rgba(239,68,68,0.9)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 12,
                                                fontWeight: 900,
                                                padding: '0 6px',
                                            }}
                                        >
                                            {badgeText}
                                        </div>
                                    )}

                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            removeRoom(c.id);
                                        }}
                                        title="채팅방 삭제"
                                        style={{
                                            width: 34,
                                            height: 34,
                                            borderRadius: 12,
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            background: 'rgba(255,255,255,0.06)',
                                            cursor: 'pointer',
                                            fontSize: 16,
                                        }}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
