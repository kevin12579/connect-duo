import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { listRooms, closeRoom, deleteRoom, absolutizeFileUrl } from '../../api/chatAxios';
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
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);

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
        return () => {
            window.removeEventListener('chat_meta_updated', loadRooms);
            window.removeEventListener(DRAFT_EVENT, loadRooms);
        };
    }, [loadRooms]);

    const cards = useMemo(
        () =>
            rooms
                .map((r) => {
                    const id = String(r.id);
                    const updatedAt = toMillis(r.last_message_at || r.created_at);
                    const draftMap = safeParse(localStorage.getItem(DRAFT_KEY), {});
                    const hasDraft = !!String(draftMap[id] || '').trim();
                    return {
                        id,
                        title: r.partner_name || '세무 상담',
                        partnerProfile: absolutizeFileUrl(r.partner_profile),
                        preview: r.last_message || '클릭하여 대화를 시작해보세요.',
                        updatedAt,
                        dayLabel: formatDayLabel(updatedAt),
                        unread: r.unread_count || 0,
                        status: r.status,
                        draft: hasDraft,
                    };
                })
                .sort((a, b) => b.updatedAt - a.updatedAt),
        [rooms],
    );

    // 기존 열기
    const handleOpenRoom = (id, status) => onOpenRoom && onOpenRoom(id);

    // 종료 (=닫기)
    const handleCloseRoom = async (e, rid) => {
        e.stopPropagation();
        if (!window.confirm('상담을 종료하시겠습니까?')) return;
        try {
            await closeRoom(rid);
            await loadRooms();
        } catch (e) {
            console.error('방 종료 실패:', e);
        }
    };

    // ★ 종료된 방에서 삭제 (완전 삭제)
    const handleDeleteRoom = async (e, rid) => {
        e.stopPropagation();
        if (!window.confirm('채팅방을 정말 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.')) return;
        try {
            await deleteRoom(rid);
            await loadRooms();
        } catch (e) {
            alert('채팅방 삭제에 실패했습니다.');
            console.error('방 삭제 실패:', e);
        }
    };

    return (
        <div className="cl-page">
            <div className="cl-panel">
                <div className="cl-header">
                    <h2 className="cl-title">상담 목록</h2>
                </div>
                {loading ? (
                    <div className="cl-loading">불러오는 중...</div>
                ) : cards.length === 0 ? (
                    <div className="cl-empty">진행 중인 상담이 없습니다.</div>
                ) : (
                    cards.map((c) => (
                        <div
                            key={c.id}
                            className={`cl-card-wrapper ${c.status === 'CLOSED' ? 'is-closed' : ''}`}
                            onClick={() => handleOpenRoom(c.id, c.status)}
                        >
                            <div className="cl-card">
                                <div className="cl-avatar">
                                    {c.partnerProfile ? (
                                        <img src={c.partnerProfile} alt="profile" />
                                    ) : (
                                        <div className="cl-avatar-fallback">{c.title[0]}</div>
                                    )}
                                </div>
                                <div className="cl-body">
                                    <div className="cl-topRow">
                                        <div className="cl-roomTitle">
                                            {c.title}
                                            {c.status === 'CLOSED' && <span className="cl-status-tag"> (종료)</span>}
                                            {c.draft && <span className="cl-badge-draft">임시 저장</span>}
                                            {c.unread > 0 && (
                                                <span className="cl-badge-unread">
                                                    {c.unread > 99 ? '99+' : c.unread}
                                                </span>
                                            )}
                                        </div>
                                        <div className="cl-day">{c.dayLabel}</div>
                                    </div>
                                    <div className="cl-preview">{c.preview}</div>
                                </div>
                                {/* 상태별 버튼: ACTIVE → 종료, CLOSED → 삭제 */}
                                {c.status !== 'CLOSED' ? (
                                    <button className="cl-trashBtn" onClick={(e) => handleCloseRoom(e, c.id)}>
                                        ✕
                                    </button>
                                ) : (
                                    <button className="cl-trashBtn" onClick={(e) => handleDeleteRoom(e, c.id)}>
                                        🗑
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
