import React, { useMemo, useState, useEffect } from 'react';

export default function MyCommentsCard({ user, items = [], onOpenTaxProProfile, pageSize = 2 }) {
    const [page, setPage] = useState(1);

    // ✅ 정렬: 내가 쓴 댓글 수(count) 많은 순 -> 이름순(옵션)
    const sorted = useMemo(() => {
        return [...items].sort((a, b) => {
            if ((b.count ?? 0) !== (a.count ?? 0)) return (b.count ?? 0) - (a.count ?? 0);
            return String(a.taxProName).localeCompare(String(b.taxProName));
        });
    }, [items]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

    // ✅ 아이템/페이지사이즈 바뀌면 1페이지로 (UX 안정)
    useEffect(() => {
        setPage(1);
    }, [pageSize, items.length]);

    // ✅ 페이지 범위 보정
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const sliced = useMemo(() => {
        const start = (page - 1) * pageSize;
        return sorted.slice(start, start + pageSize);
    }, [sorted, page, pageSize]);

    const goFirst = () => setPage(1);
    const goPrev = () => setPage((p) => Math.max(1, p - 1));
    const goNext = () => setPage((p) => Math.min(totalPages, p + 1));
    const goLast = () => setPage(totalPages);

    const isFirst = page === 1;
    const isLast = page === totalPages;

    return (
        <div>
            <div className="mycomments-title">내가 쓴 댓글로 가기</div>

            <div className="mycomments-list">
                {sliced.map((it) => (
                    <div className="mycomments-row" key={it.taxProId}>
                        <div className="mycomments-avatar" />

                        <div className="mycomments-main">
                            <div className="mycomments-name">{it.taxProName}</div>
                            <div className="mycomments-count">내가 쓴 댓글 : {it.count}개</div>
                        </div>

                        <button
                            className="enter-btn"
                            type="button"
                            aria-label="enter"
                            onClick={() => {
                                if (!onOpenTaxProProfile) return;
                                onOpenTaxProProfile({
                                    taxProId: it.taxProId,
                                    focus: 'comments',
                                    highlightUserId: user?.id,
                                });
                            }}
                        >
                            ➜
                        </button>
                    </div>
                ))}
            </div>

            <div className="mycomments-pagination">
                <button className="mycomments-pgbtn" onClick={goFirst} disabled={isFirst} aria-label="first" type="button">
                    ⏮
                </button>
                <button className="mycomments-pgbtn" onClick={goPrev} disabled={isFirst} aria-label="prev" type="button">
                    ◀
                </button>

                <div className="mycomments-pginfo">
                    <span className="mycomments-pgcurrent">{page}</span>
                    <span className="mycomments-pgslash">/</span>
                    <span className="mycomments-pgtotal">{totalPages}</span>
                </div>

                <button className="mycomments-pgbtn" onClick={goNext} disabled={isLast} aria-label="next" type="button">
                    ▶
                </button>
                <button className="mycomments-pgbtn" onClick={goLast} disabled={isLast} aria-label="last" type="button">
                    ⏭
                </button>
            </div>
        </div>
    );
}
