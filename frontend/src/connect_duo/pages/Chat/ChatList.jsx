// src/components/chat/ChatList.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { listRooms, closeRoom, deleteRoom, absolutizeFileUrl, ensureSocket } from '../../api/chatAxios';
import './ChatList.css';

const DRAFT_KEY = 'cd_chat_drafts_v1';
const DRAFT_EVENT = 'cd_draft_updated';

const safeParse = (raw, fallback) => {
    try {
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
};
const toMillis = (v) => (v ? new Date(v).getTime() : 0);

function formatDayLabel(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return '오늘';
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return '어제';
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function ChatList({ onOpenRoom }) {
    const authUser = useAuthStore((s) => s.authUser);
    const isMyTypeUser = (authUser?.user_type ?? 'USER') === 'USER';

    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [onlineSet, setOnlineSet] = useState(new Set()); // 전역 온라인 유저 ID 집합

    const loadRooms = useCallback(async () => {
        try {
            setLoading(true);
            const res = await listRooms();
            setRooms(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error('방 목록 불러오기 실패:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRooms();
        window.addEventListener('chat_meta_updated', loadRooms);
        window.addEventListener(DRAFT_EVENT, loadRooms);

        const socket = ensureSocket();
        if (socket) {
            // 전역 온라인 목록 초기 수신
            const onOnlineList = ({ userIds }) => {
                setOnlineSet(new Set((userIds || []).map(String)));
            };
            // 실시간 전역 온/오프라인
            const onGlobalOnline = ({ userId }) => setOnlineSet((p) => new Set([...p, String(userId)]));
            const onGlobalOffline = ({ userId }) =>
                setOnlineSet((p) => {
                    const n = new Set(p);
                    n.delete(String(userId));
                    return n;
                });

            socket.on('online_user_list', onOnlineList);
            socket.on('global_user_online', onGlobalOnline);
            socket.on('global_user_offline', onGlobalOffline);

            if (socket.connected) {
                socket.emit('get_online_users');
                loadRooms();
            } else {
                socket.on('connect', () => {
                    socket.emit('get_online_users');
                    loadRooms();
                });
            }

            return () => {
                window.removeEventListener('chat_meta_updated', loadRooms);
                window.removeEventListener(DRAFT_EVENT, loadRooms);
                socket.off('online_user_list', onOnlineList);
                socket.off('global_user_online', onGlobalOnline);
                socket.off('global_user_offline', onGlobalOffline);
                socket.off('connect', loadRooms);
            };
        }

        return () => {
            window.removeEventListener('chat_meta_updated', loadRooms);
            window.removeEventListener(DRAFT_EVENT, loadRooms);
        };
    }, [loadRooms]);

    // 카드 데이터 변환
    const allCards = useMemo(() => {
        return rooms.map((r) => {
            const id = String(r.id);
            const updatedAt = toMillis(r.last_message_at || r.created_at);
            const draftMap = safeParse(localStorage.getItem(DRAFT_KEY), {});
            const hasDraft = !!String(draftMap[id] || '').trim();

            // 파트너 온라인 여부 (partner_user_id 필드)
            const partnerUserId = String(r.partner_user_id || r.tax_id || '');
            const isPartnerOnline = partnerUserId ? onlineSet.has(partnerUserId) : false;

            // 카테고리
            let categories = [];
            try {
                const c = r.partner_categories;
                categories = c ? (typeof c === 'string' ? JSON.parse(c) : c) : [];
            } catch {
                categories = [];
            }

            return {
                id,
                title: r.partner_name || '세무 상담',
                partnerProfile: absolutizeFileUrl(r.partner_profile),
                partnerCompany: r.partner_company || '',
                partnerBio: r.partner_bio || '',
                partnerCategories: categories,
                partnerExperience: r.partner_experience_years || 0,
                partnerMonthlyFee: r.partner_monthly_fee || 0,
                partnerRate: r.partner_rate_per_10min || 0,
                partnerResponseSpeed: r.partner_response_speed,
                isPartnerOnline,
                preview: r.last_message || '클릭하여 대화를 시작해보세요.',
                updatedAt,
                dayLabel: formatDayLabel(updatedAt),
                unread: r.unread_count || 0,
                status: r.status,
                draft: hasDraft,
            };
        });
    }, [rooms, onlineSet]);

    // 활성 / 종료 분리 + 각각 시간순 정렬
    const activeCards = useMemo(
        () => allCards.filter((c) => c.status !== 'CLOSED').sort((a, b) => b.updatedAt - a.updatedAt),
        [allCards],
    );
    const closedCards = useMemo(
        () => allCards.filter((c) => c.status === 'CLOSED').sort((a, b) => b.updatedAt - a.updatedAt),
        [allCards],
    );

    const handleOpenRoom = (id) => onOpenRoom && onOpenRoom(id);

    const handleCloseRoom = async (e, rid) => {
        e.stopPropagation();
        if (!window.confirm('상담을 종료하시겠습니까?')) return;
        try {
            await closeRoom(rid);
            await loadRooms();
        } catch (err) {
            console.error('방 종료 실패:', err);
        }
    };

    const handleDeleteRoom = async (e, rid) => {
        e.stopPropagation();
        if (!window.confirm('채팅방을 정말 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.')) return;
        try {
            await deleteRoom(rid);
            await loadRooms();
        } catch (err) {
            alert('채팅방 삭제에 실패했습니다.');
            console.error(err);
        }
    };

    const renderCard = (c, isClosed = false) => (
        <div
            key={c.id}
            className={`cl-card-wrapper ${isClosed ? 'is-closed' : ''}`}
            onClick={() => handleOpenRoom(c.id)}
        >
            <div className="cl-card">
                {/* 아바타 + 온라인 점 */}
                <div className="cl-avatar-wrap">
                    <div className="cl-avatar">
                        {c.partnerProfile ? (
                            <img src={c.partnerProfile} alt="profile" />
                        ) : (
                            <div className="cl-avatar-fallback">{c.title[0]}</div>
                        )}
                    </div>
                    <span className={`cl-online-dot ${c.isPartnerOnline ? 'is-on' : ''}`} />
                </div>

                {/* 본문 */}
                <div className="cl-body">
                    {/* 상단: 이름 + 시간 */}
                    <div className="cl-topRow">
                        <div className="cl-roomTitle">
                            {c.title}
                            {isClosed && <span className="cl-badge-closed">종료</span>}
                            {c.draft && <span className="cl-badge-draft">임시 저장</span>}
                            {c.unread > 0 && (
                                <span className="cl-badge-unread">{c.unread > 99 ? '99+' : c.unread}</span>
                            )}
                        </div>
                        <div className="cl-day">{c.dayLabel}</div>
                    </div>

                    {/* 회사명 + 한줄 소개 */}
                    {(c.partnerCompany || c.partnerBio) && (
                        <div className="cl-partnerMeta">
                            {c.partnerCompany && <span className="cl-partnerCompany">{c.partnerCompany}</span>}
                            {c.partnerCompany && c.partnerBio && <span className="cl-metaDot">·</span>}
                            {c.partnerBio && <span className="cl-partnerBio">{c.partnerBio}</span>}
                        </div>
                    )}

                    {/* 마지막 메시지 */}
                    <div className="cl-preview">{c.preview}</div>

                    {/* 요금 + 경력 + 기장료 + 카테고리 칩 */}
                    <div className="cl-infoRow">
                        {/* 요금: USER만 표시 */}
                        {isMyTypeUser &&
                            (c.partnerRate > 0 ? (
                                <span className="cl-chip cl-chip-rate">💰 {c.partnerRate.toLocaleString()}cr/10분</span>
                            ) : (
                                <span className="cl-chip cl-chip-free">💬 무료 상담</span>
                            ))}
                        {/* 경력 */}
                        {c.partnerExperience > 0 && (
                            <span className="cl-chip cl-chip-info">경력 {c.partnerExperience}년</span>
                        )}
                        {/* 기장료 */}
                        {c.partnerMonthlyFee > 0 && (
                            <span className="cl-chip cl-chip-info">
                                기장료 {c.partnerMonthlyFee.toLocaleString()}원~
                            </span>
                        )}
                        {/* 카테고리 최대 2개 */}
                        {c.partnerCategories.slice(0, 2).map((cat) => (
                            <span key={cat} className="cl-chip cl-chip-cat">
                                {cat}
                            </span>
                        ))}
                        {/* 온라인 상태 */}
                        <span className={`cl-chip ${c.isPartnerOnline ? 'cl-chip-online' : 'cl-chip-offline'}`}>
                            <span className={`cl-chip-status-dot ${c.isPartnerOnline ? 'is-online' : 'is-offline'}`} />
                            <span className="cl-chip-status-text">{c.isPartnerOnline ? '접속 중' : '오프라인'}</span>
                        </span>
                    </div>
                </div>

                {/* 액션 버튼 */}
                {!isClosed ? (
                    <button className="cl-trashBtn" onClick={(e) => handleCloseRoom(e, c.id)} title="상담 종료">
                        ✕
                    </button>
                ) : (
                    <button className="cl-trashBtn" onClick={(e) => handleDeleteRoom(e, c.id)} title="채팅방 삭제">
                        🗑
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="cl-page">
            <div className={`cl-panel ${allCards.length >= 5 ? 'is-scrollable' : ''}`}>
                {loading ? (
                    <div className="cl-loading">불러오는 중...</div>
                ) : allCards.length === 0 ? (
                    <div className="cl-empty">
                        <div className="cl-empty-icon">💬</div>
                        <div>진행 중인 상담이 없습니다.</div>
                    </div>
                ) : (
                    <>
                        {/* ── 활성 상담 ── */}
                        {activeCards.length > 0 && (
                            <section className="cl-section">
                                <div className="cl-section-header">
                                    <span className="cl-section-dot cl-dot-active" />
                                    <span className="cl-section-title">진행 중인 상담</span>
                                    <span className="cl-section-count">{activeCards.length}</span>
                                </div>
                                <div className="cl-card-wrapper-group">
                                    {activeCards.map((c) => renderCard(c, false))}
                                </div>
                            </section>
                        )}

                        {/* ── 종료된 상담 ── */}
                        {closedCards.length > 0 && (
                            <section className="cl-section">
                                <div className="cl-section-header">
                                    <span className="cl-section-dot cl-dot-closed" />
                                    <span className="cl-section-title">종료된 상담</span>
                                    <span className="cl-section-count">{closedCards.length}</span>
                                </div>
                                <div className="cl-card-wrapper-group">
                                    {closedCards.map((c) => renderCard(c, true))}
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
