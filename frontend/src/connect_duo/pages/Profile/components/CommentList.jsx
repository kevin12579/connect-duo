import React, { useEffect, useMemo, useState } from 'react';
import CommentItem from './CommentItem';

// ✅ pagination icons
import rightNext from '../../../assets/right-next.png';
import rightEnd from '../../../assets/right-end.png';

const sortDesc = (arr) => [...arr].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

export default function CommentList({ me, comments, onDelete, pageSize = 3, canDelete = true }) {
    const [page, setPage] = useState(1);
    const [myOpen, setMyOpen] = useState(false);

    const myComments = useMemo(() => {
        if (!me?.id) return [];
        return sortDesc(comments.filter((c) => c.userId === me.id));
    }, [comments, me?.id]);

    const otherComments = useMemo(() => {
        if (!me?.id) return sortDesc(comments);
        return sortDesc(comments.filter((c) => c.userId !== me.id));
    }, [comments, me?.id]);

    const myLatest = myComments[0] || null;
    const myHasList = myComments.length >= 2;

    const totalPages = Math.max(1, Math.ceil(otherComments.length / pageSize));
    const slicedOthers = useMemo(() => {
        const start = (page - 1) * pageSize;
        return otherComments.slice(start, start + pageSize);
    }, [otherComments, page, pageSize]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const goFirst = () => setPage(1);
    const goPrev = () => setPage((p) => Math.max(1, p - 1));
    const goNext = () => setPage((p) => Math.min(totalPages, p + 1));
    const goLast = () => setPage(totalPages);

    const isFirst = page === 1;
    const isLast = page === totalPages;

    return (
        <div className="comment-list-wrap">
            <div className="my-comments-box">
                <div className="my-comments-head">
                    <div className="my-comments-title">내가 쓴 댓글 (최신)</div>
                    <button
                        type="button"
                        className={`my-toggle ${myHasList ? '' : 'disabled'}`}
                        onClick={() => myHasList && setMyOpen((v) => !v)}
                        disabled={!myHasList}
                        aria-label="my-comments-toggle"
                        title={myHasList ? '내 댓글 목록 펼치기/접기' : '내 댓글이 1개라 목록이 없습니다'}
                    >
                        {myOpen ? '▲' : '▼'}
                    </button>
                </div>
                <div className="my-comments-body">
                    {myLatest ? (
                        <CommentItem me={me} comment={myLatest} canDelete={canDelete} onDelete={onDelete} forceMine />
                    ) : (
                        <div className="comment-empty">내 댓글이 없습니다.</div>
                    )}
                    {myHasList && myOpen && (
                        <div className="my-comments-list">
                            {myComments.slice(1).map((c) => (
                                <CommentItem
                                    key={c.id}
                                    me={me}
                                    comment={c}
                                    canDelete={canDelete}
                                    onDelete={onDelete}
                                    forceMine
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="comment-list">
                {slicedOthers.length === 0 ? (
                    <div className="comment-empty">아직 댓글이 없습니다.</div>
                ) : (
                    slicedOthers.map((c) => (
                        <CommentItem key={c.id} me={me} comment={c} canDelete={canDelete} onDelete={onDelete} />
                    ))
                )}
            </div>

            {/* ✅ pagination: 아이콘 버전 */}
            <div className="comment-pagination">
                <button className="pg-btn" onClick={goFirst} disabled={isFirst} aria-label="first" title="처음">
                    <img className="pg-icon pg-rotate" src={rightEnd} alt="" aria-hidden="true" />
                </button>

                <button className="pg-btn" onClick={goPrev} disabled={isFirst} aria-label="prev" title="이전">
                    <img className="pg-icon pg-rotate" src={rightNext} alt="" aria-hidden="true" />
                </button>

                <div className="pg-info">
                    <span className="pg-current">{page}</span>
                    <span className="pg-slash">/</span>
                    <span className="pg-total">{totalPages}</span>
                </div>

                <button className="pg-btn" onClick={goNext} disabled={isLast} aria-label="next" title="다음">
                    <img className="pg-icon" src={rightNext} alt="" aria-hidden="true" />
                </button>

                <button className="pg-btn" onClick={goLast} disabled={isLast} aria-label="last" title="마지막">
                    <img className="pg-icon" src={rightEnd} alt="" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}