import React from 'react';
import UserAvatar from './UserAvatar';
function formatKoreanDate(createdAt) {
    if (!createdAt) return '';

    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return String(createdAt); // 파싱 실패하면 원문

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');

    const h24 = d.getHours();
    const ampm = h24 < 12 ? '오전' : '오후';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

    const hh = String(h12).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd} ${ampm} ${hh}시 ${mi}분 ${ss}초`;
}

export default function CommentItem({ me, comment, onDelete, canDelete = true }) {
    const isMine = comment.userId === me?.id;

    return (
        <div className={`comment-item ${isMine ? 'mine' : 'other'}`}>
            <div className="comment-left">
                <UserAvatar avatarUrl={comment.avatarUrl} name={comment.nickname} />
                <div className="comment-name">{comment.nickname ?? '익명'}</div>
            </div>

            <div className="comment-body">
                <div className="comment-topline">
                    <div className="comment-date">{formatKoreanDate(comment.createdAt)}</div>

                    {isMine && canDelete && (
                        <button
                            type="button"
                            className="comment-delete"
                            onClick={() => onDelete?.(comment.id)}
                            aria-label="delete"
                        >
                            X
                        </button>
                    )}
                </div>

                <div className="comment-content">{comment.content ?? ''}</div>
            </div>
        </div>
    );
}
