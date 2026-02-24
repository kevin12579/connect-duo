import React from 'react';

// ✅ 재사용: 이니셜/이미지 아바타 컴포넌트 (댓글 등에서 같이 사용 가능)
function UserAvatar({ avatarUrl, name, size = 34 }) {
    return avatarUrl ? (
        <img
            src={avatarUrl}
            alt={name || '사용자'}
            className="avatar-img"
            style={{
                width: size,
                height: size,
                borderRadius: '50%',
                objectFit: 'cover',
                background: '#fff',
            }}
        />
    ) : (
        <div
            className="avatar-fallback"
            style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: '#f08fa0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '900',
                fontSize: size / 2,
                color: '#fff',
            }}
        >
            {(name || 'U').charAt(0)}
        </div>
    );
}

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
    myReview,
}) {
    // 잠금 조건 정의
    const ratingLocked = myRating !== null && myRating > 0;
    const likeLocked = myReview?.is_recommend === 1 || myReview?.is_recommend === true;
    const commentLocked = !!myReview?.comment && myReview.comment.trim() !== '';

    return (
        <div className="actions-grid">
            {/* 왼쪽: 추천 및 별점 */}
            <div className="actions-left">
                <div className="actions-title">추천하기</div>
                <div className="like-area">
                    <button
                        type="button"
                        className={`like-btn ${liked ? 'on' : ''}`}
                        onClick={(e) => {
                            e.preventDefault();
                            if (!likeLocked) onToggleLike();
                        }}
                        disabled={likeLocked || !me.isLoggedIn}
                    >
                        <span className="like-emoji">👍</span>
                    </button>
                    <div className="like-help">{likeLocked ? '추천이 완료되었습니다.' : '눌러서 추천해보세요'}</div>
                </div>

                <div className="rating-area">
                    <div className="actions-title">평가하기</div>
                    <div className="rating-box">
                        <StarRow
                            value={ratingLocked ? myRating : ratingDraft}
                            onChange={onChangeRatingDraft}
                            disabled={ratingLocked || !me.isLoggedIn}
                        />
                    </div>
                    <div className="actions-btn-row right">
                        <button
                            type="button"
                            className="btn-primary"
                            onClick={onSubmitRating}
                            disabled={ratingLocked || !me.isLoggedIn}
                        >
                            {ratingLocked ? '완료' : '입력'}
                        </button>
                        <button
                            type="button"
                            className="btn-danger"
                            onClick={onCancelRating}
                            disabled={ratingLocked || !me.isLoggedIn}
                        >
                            취소
                        </button>
                    </div>
                    {ratingLocked && <div className="lock-msg">별점 평가를 완료했습니다.</div>}
                </div>
            </div>

            {/* 오른쪽: 댓글 작성 */}
            <div className="actions-right">
                <div className="comment-writer-head">
                    {/* ✅ 현재 접속한 유저 아바타 */}
                    <UserAvatar avatarUrl={me.avatarUrl} name={me.nickname} size={34} />
                    <div className="writer-name">{me.isLoggedIn ? me.nickname : '로그인 필요'}</div>
                </div>
                <textarea
                    className="comment-input"
                    placeholder={commentLocked ? '작성한 댓글이 있습니다.' : '댓글 남기기'}
                    value={commentLocked ? myReview.comment : commentDraft}
                    onChange={(e) => onChangeCommentDraft(e.target.value)}
                    disabled={!me.isLoggedIn || commentLocked}
                />
                <div className="actions-btn-row right">
                    <button
                        className="btn-primary"
                        onClick={onSubmitComment}
                        disabled={!me.isLoggedIn || commentLocked || !commentDraft.trim()}
                    >
                        {commentLocked ? '완료' : '입력'}
                    </button>
                    <button className="btn-danger" onClick={onCancelComment} disabled={!me.isLoggedIn || commentLocked}>
                        취소
                    </button>
                </div>
                {commentLocked && <div className="comment-info">댓글은 한 번만 작성 가능합니다.</div>}
            </div>
        </div>
    );
}
