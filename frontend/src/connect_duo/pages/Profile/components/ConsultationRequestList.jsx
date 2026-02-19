import React, { useMemo, useState, useEffect } from 'react';

export default function ConsultationRequestList({ requests, onAccept, onReject, pageSize = 3 }) {
    const [page, setPage] = useState(1);

    const totalPages = Math.max(1, Math.ceil((requests?.length ?? 0) / pageSize));

    const sliced = useMemo(() => {
        const start = (page - 1) * pageSize;
        return (requests ?? []).slice(start, start + pageSize);
    }, [requests, page, pageSize]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const isFirst = page === 1;
    const isLast = page === totalPages;

    const goFirst = () => setPage(1);
    const goPrev = () => setPage((p) => Math.max(1, p - 1));
    const goNext = () => setPage((p) => Math.min(totalPages, p + 1));
    const goLast = () => setPage(totalPages);

    return (
        <div className="consults-wrap">
            <div className="consults-title">상담 신청 리스트</div>

            <div className="consults-list">
                {sliced.map((r) => (
                    <div key={r.id} className="consult-row">
                        <div className="consult-date">{r.createdAt}</div>

                        <div className="consult-main">
                            <div className="consult-avatar" />
                            <div className="consult-name">{r.nickname}</div>

                            <div className="consult-actions">
                                <button className="consult-btn accept" onClick={() => onAccept(r.id)} type="button">
                                    수락
                                </button>
                                <button className="consult-btn reject" onClick={() => onReject(r.id)} type="button">
                                    거절
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="consult-pagination">
                <button onClick={goFirst} className="pg-btn" aria-label="first" type="button" disabled={isFirst}>
                    ⏮
                </button>
                <button onClick={goPrev} className="pg-btn" aria-label="prev" type="button" disabled={isFirst}>
                    ◀
                </button>

                <div className="pg-info">
                    {page} / {totalPages}
                </div>

                <button onClick={goNext} className="pg-btn" aria-label="next" type="button" disabled={isLast}>
                    ▶
                </button>
                <button onClick={goLast} className="pg-btn" aria-label="last" type="button" disabled={isLast}>
                    ⏭
                </button>
            </div>
        </div>
    );
}
