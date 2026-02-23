import React, { useEffect, useMemo, useState } from 'react';
import CommentItem from './CommentItem';

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
            <div className="comment-pagination">
                <button className="pg-btn" onClick={goFirst} disabled={isFirst}>
                    ⏮
                </button>
                <button className="pg-btn" onClick={goPrev} disabled={isFirst}>
                    ◀
                </button>
                <div className="pg-info">
                    <span>{page}</span> / <span>{totalPages}</span>
                </div>
                <button className="pg-btn" onClick={goNext} disabled={isLast}>
                    ▶
                </button>
                <button className="pg-btn" onClick={goLast} disabled={isLast}>
                    ⏭
                </button>
            </div>
        </div>
    );
}
