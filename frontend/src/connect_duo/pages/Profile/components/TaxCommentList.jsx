import React, { useEffect, useMemo, useState } from 'react';
import CommentItem from './CommentItem';

// ✅ pagination icons
import rightNext from '../../../assets/right-next.png';
import rightEnd from '../../../assets/right-end.png';

const sortDesc = (arr) => [...arr].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

export default function TaxCommentList({ comments = [], pageSize = 3 }) {
    const [page, setPage] = useState(1);

    const sorted = useMemo(() => sortDesc(comments), [comments]);
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const sliced = useMemo(() => {
        const start = (page - 1) * pageSize;
        return sorted.slice(start, start + pageSize);
    }, [sorted, page, pageSize]);

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
            <div className="comment-list">
                {sliced.length === 0 ? (
                    <div className="comment-empty">아직 댓글이 없습니다.</div>
                ) : (
                    sliced.map((c) => (
                        <CommentItem key={c.id} me={null} comment={c} canDelete={false} onDelete={null} />
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
                    <span>{page}</span> / <span>{totalPages}</span>
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