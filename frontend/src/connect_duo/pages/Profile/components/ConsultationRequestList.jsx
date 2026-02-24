import React, { useMemo, useState, useEffect } from 'react';

export default function ConsultationRequestList({ requests, onAccept, onReject, pageSize = 3 }) {
    const [page, setPage] = useState(1);
    const safeRequests = Array.isArray(requests) ? requests : [];
    const totalPages = Math.max(1, Math.ceil(safeRequests.length / pageSize));

    const sliced = useMemo(() => {
        const start = (page - 1) * pageSize;
        return safeRequests.slice(start, start + pageSize);
    }, [safeRequests, page, pageSize]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    return (
        <div className="consult-section">
            <div className="list-title">
                <span>📩</span> 상담 신청 리스트 ({safeRequests.length})
            </div>

            <div className="list-wrapper">
                {safeRequests.length === 0 ? (
                    <div className="no-data-msg">아직 신청된 상담 내역이 없습니다.</div>
                ) : (
                    sliced.map((r) => (
                        <div key={r.id} className="item-row">
                            <div className="item-side-info">{new Date(r.created_at).toLocaleDateString()}</div>
                            <div className="item-main-info">
                                {r.avatarUrl ? (
                                    <img src={r.avatarUrl} className="item-avatar" alt="user" />
                                ) : (
                                    <div className="item-avatar fallback-avatar">{r.nickname?.charAt(0) || 'U'}</div>
                                )}
                                <div className="item-text-wrap">
                                    <span className="item-primary-text">{r.nickname} 님</span>
                                    <span className="item-secondary-text">새로운 상담 요청이 도착했습니다.</span>
                                </div>
                            </div>
                            <div className="item-actions">
                                <button className="action-btn btn-accept" onClick={() => onAccept(r.id)}>
                                    수락
                                </button>
                                <button className="action-btn btn-reject" onClick={() => onReject(r.id)}>
                                    거절
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {safeRequests.length > pageSize && (
                <div className="custom-pagination">
                    <button className="pg-ctrl-btn" onClick={() => setPage(1)} disabled={page === 1}>
                        ⏮
                    </button>
                    <button className="pg-ctrl-btn" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
                        ◀
                    </button>
                    <div className="pg-num-info">
                        {page} / {totalPages}
                    </div>
                    <button
                        className="pg-ctrl-btn"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page === totalPages}
                    >
                        ▶
                    </button>
                    <button className="pg-ctrl-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
                        ⏭
                    </button>
                </div>
            )}
        </div>
    );
}
