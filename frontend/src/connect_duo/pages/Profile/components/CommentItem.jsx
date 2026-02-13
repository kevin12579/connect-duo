import React from 'react';

function formatKoreanDate(createdAt) {
    // createdAt 예: "2024-07-09 08:11"
    if (!createdAt) return '';
    const [datePart, timePart] = createdAt.split(' ');
    if (!timePart) return createdAt;

    const [hh, mm] = timePart.split(':').map((x) => parseInt(x, 10));
    const isAM = hh < 12;
    const h12 = ((hh + 11) % 12) + 1;
    const label = isAM ? '오전' : '오후';

    return `${datePart} ${label} ${String(h12).padStart(2, '0')}시 ${String(mm).padStart(2, '0')}분`;
}

export default function CommentItem({ me, comment, onDelete, canDelete = true }) {
    const isMine = comment.userId === me?.id;

    return (
        <div className={`comment-item ${isMine ? 'mine' : 'other'}`}>
            <div className="comment-left">
                <div className="comment-avatar" />
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
