import React from 'react';

export default function CommentCard({ open, onToggle, latestComment, children }) {
    const name = latestComment?.nickname ?? '익명';
    const content = latestComment?.content ?? '아직 댓글이 없습니다.';
    const preview = content.length > 42 ? content.slice(0, 42) + '...' : content;

    return (
        <div className="profile-card comment-card">
            {!open ? (
                <div className="comment-collapsed">
                    <div className="comment-mini">
                        <div className="comment-mini-left">
                            <div className="comment-mini-avatar" />
                            <div className="comment-mini-name">{name}</div>
                        </div>
                        <div className="comment-bubble">{preview}</div>
                    </div>
                    <button type="button" className="comment-toggle" onClick={onToggle} aria-label="open comments">
                        ▼
                    </button>
                </div>
            ) : (
                <div className="comment-expanded">
                    <div className="comment-expanded-head">
                        <div className="comment-expanded-title">댓글 목록</div>
                        <button type="button" className="comment-toggle" onClick={onToggle} aria-label="close comments">
                            ▲
                        </button>
                    </div>
                    {children}
                </div>
            )}
        </div>
    );
}
