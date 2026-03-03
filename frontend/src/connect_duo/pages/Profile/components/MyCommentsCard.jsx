import React, { useMemo, useState } from 'react';

// ✅ pagination icons
import rightNext from '../../../assets/right-next.png';
import rightEnd from '../../../assets/right-end.png';

export default function MyCommentsCard({ user, items = [], onOpenTaxProProfile, pageSize = 2 }) {
    const [page, setPage] = useState(1);
    const sorted = useMemo(() => {
        return [...items].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    }, [items]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const sliced = useMemo(() => {
        const start = (page - 1) * pageSize;
        return sorted.slice(start, start + pageSize);
    }, [sorted, page, pageSize]);

    return (
        <div className="comments-section">
            <div className="list-title">
                <span>💬</span> 내가 리뷰를 남긴 전문가
            </div>

            <div className="list-wrapper">
                {items.length === 0 ? (
                    <div className="no-data-msg">아직 작성한 리뷰가 없습니다.</div>
                ) : (
                    sliced.map((it) => (
                        <div className="item-row" key={it.taxProUserId}>
                            <div className="item-side-info">전문가</div>
                            <div className="item-main-info">
                                {it.avatarUrl ? (
                                    <img src={it.avatarUrl} className="item-avatar" alt="pro" />
                                ) : (
                                    <div className="item-avatar fallback-avatar">{it.taxProName?.charAt(0) || 'T'}</div>
                                )}
                                <div className="item-text-wrap">
                                    <span className="item-primary-text">{it.taxProName} 세무사</span>
                                    <span className="item-secondary-text">내가 작성한 댓글: {it.count}개</span>
                                </div>
                            </div>
                            <div className="item-actions">
                                <button
                                    className="action-btn btn-circle"
                                    onClick={() =>
                                        onOpenTaxProProfile({
                                            taxProId: it.taxProUserId,
                                            focus: 'comments',
                                            highlightUserId: user?.id,
                                        })
                                    }
                                >
                                    ➜
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {items.length > pageSize && (
                <div className="custom-pagination">
                    <button className="pg-ctrl-btn" onClick={() => setPage(1)} disabled={page === 1} aria-label="first" title="처음">
                        <img className="pg-icon pg-rotate" src={rightEnd} alt="" aria-hidden="true" />
                    </button>
                    <button
                        className="pg-ctrl-btn"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        aria-label="prev"
                        title="이전"
                    >
                        <img className="pg-icon pg-rotate" src={rightNext} alt="" aria-hidden="true" />
                    </button>

                    <div className="pg-num-info">
                        {page} / {totalPages}
                    </div>

                    <button
                        className="pg-ctrl-btn"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        aria-label="next"
                        title="다음"
                    >
                        <img className="pg-icon" src={rightNext} alt="" aria-hidden="true" />
                    </button>
                    <button
                        className="pg-ctrl-btn"
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        aria-label="last"
                        title="마지막"
                    >
                        <img className="pg-icon" src={rightEnd} alt="" aria-hidden="true" />
                    </button>
                </div>
            )}
        </div>
    );
}