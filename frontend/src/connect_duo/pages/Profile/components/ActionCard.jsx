import React from 'react';

function StarRow({ value, onChange, disabled }) {
    return (
        <div className={`star-row ${disabled ? 'disabled' : ''}`}>
            {[1, 2, 3, 4, 5].map((n) => (
                <button
                    key={n}
                    className={`star-btn ${value >= n ? 'on' : ''}`}
                    onClick={() => !disabled && onChange(n)}
                    type="button"
                    aria-label={`star-${n}`}
                >
                    ★
                </button>
            ))}
        </div>
    );
}

export default function ActionCard({
    me,
    liked,
    onToggleLike,
    myRating,
    ratingDraft,
    onChangeRatingDraft,
    onSubmitRating,
    onCancelRating,
    commentDraft,
    onChangeCommentDraft,
    onSubmitComment,
    onCancelComment,
}) {
    const ratingLocked = myRating != null;

    return (
        <div className="actions-grid">
            <div className="actions-left">
                <div className="actions-title">추천하기</div>
                <div className="like-area">
                    {/* type="button" 확인 */}
                    <button
                        type="button"
                        className={`like-btn ${liked ? 'on' : ''}`}
                        onClick={(e) => {
                            e.preventDefault();
                            onToggleLike();
                        }}
                    >
                        <span className="like-emoji">👍</span>
                    </button>
                    <div className="like-help">{liked ? '추천했어요!' : '눌러서 추천해보세요'}</div>
                </div>

                <div className="rating-area">
                    <div className="actions-title">평가하기</div>
                    <div className="rating-box">
                        <StarRow
                            value={ratingLocked ? myRating : ratingDraft}
                            onChange={onChangeRatingDraft}
                            disabled={ratingLocked}
                        />
                    </div>
                    <div className="actions-btn-row right">
                        <button
                            type="button"
                            className="btn-primary"
                            onClick={onSubmitRating}
                            disabled={ratingLocked || !me.isLoggedIn}
                        >
                            입력
                        </button>
                        <button type="button" className="btn-danger" onClick={onCancelRating} disabled={ratingLocked}>
                            취소
                        </button>
                    </div>
                </div>
            </div>
            <div className="actions-right">
                <div className="comment-writer-head">
                    <div className="writer-avatar" />
                    <div className="writer-name">{me.isLoggedIn ? me.nickname : '로그인 필요'}</div>
                </div>
                <textarea
                    className="comment-input"
                    placeholder="댓글 남기기"
                    value={commentDraft}
                    onChange={(e) => onChangeCommentDraft(e.target.value)}
                    disabled={!me.isLoggedIn}
                />
                <div className="actions-btn-row right">
                    <button className="btn-primary" onClick={onSubmitComment} disabled={!me.isLoggedIn}>
                        입력
                    </button>
                    <button className="btn-danger" onClick={onCancelComment} disabled={!me.isLoggedIn}>
                        취소
                    </button>
                </div>
            </div>
        </div>
    );
}
