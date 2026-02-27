// src/components/chat/ChatList.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
    listRooms,
    closeRoom,
    deleteRoom,
    absolutizeFileUrl,
    ensureSocket, // ✅ FIX BUG5: 실시간 목록 갱신을 위해 소켓 사용
} from '../../api/chatAxios';
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

    // ✅ FIX BUG5: 소켓으로 실시간 목록 갱신
    //
    // ChatList는 현재 어떤 방에도 join하지 않은 상태입니다.
    // 그래서 receive_message 이벤트를 방별로 받을 수 없고,
    // 대신 서버에서 'list_updated' 이벤트를 전송하는 방식이 이상적이지만
    // 백엔드 수정 없이도 작동하는 방법으로:
    //   - 소켓이 연결(connect)될 때 목록을 다시 불러온다
    //   - window 이벤트(chat_meta_updated)를 통해 ChatRoom과 동기화한다
    //
    // 추가로, 소켓의 'receive_message' 이벤트는 방에 join한 경우에만 받을 수 있으므로
    // ChatList에서는 소켓 재연결 시 자동 갱신으로 처리합니다.
    useEffect(() => {
        loadRooms();

        // window 이벤트 기반 갱신 (ChatRoom ↔ ChatList 동기화)
        window.addEventListener('chat_meta_updated', loadRooms);
        window.addEventListener(DRAFT_EVENT, loadRooms);

        // ✅ 소켓 연결/재연결 시 목록 갱신
        const socket = ensureSocket();
        let onConnect = null;
        if (socket) {
            onConnect = () => {
                console.log('[ChatList] 소켓 연결됨 → 목록 갱신');
                loadRooms();
            };
            // 이미 연결되어 있으면 즉시 갱신
            if (socket.connected) loadRooms();
            else socket.on('connect', onConnect);
        }

        return () => {
            window.removeEventListener('chat_meta_updated', loadRooms);
            window.removeEventListener(DRAFT_EVENT, loadRooms);
            if (socket && onConnect) socket.off('connect', onConnect);
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
            console.error('방 삭제 실패:', err);
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
                            onClick={() => handleOpenRoom(c.id)}
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

                                {/* ACTIVE → 종료 버튼 / CLOSED → 삭제 버튼 */}
                                {c.status !== 'CLOSED' ? (
                                    <button
                                        className="cl-trashBtn"
                                        onClick={(e) => handleCloseRoom(e, c.id)}
                                        title="상담 종료"
                                    >
                                        ✕
                                    </button>
                                ) : (
                                    <button
                                        className="cl-trashBtn"
                                        onClick={(e) => handleDeleteRoom(e, c.id)}
                                        title="채팅방 삭제"
                                    >
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
