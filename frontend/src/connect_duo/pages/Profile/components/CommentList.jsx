import React, { useEffect, useMemo, useState } from 'react';
import CommentItem from './CommentItem';

// ✅ pagination icons
import rightNext from '../../../assets/right-next.png';
import rightEnd from '../../../assets/right-end.png';

const sortDesc = (arr) => [...arr].sort((a, b) => String(b?.createdAt ?? '').localeCompare(String(a?.createdAt ?? '')));

export default function CommentList({ me, comments, onDelete, pageSize = 3, canDelete = true }) {
    const [page, setPage] = useState(1);
    const [myOpen, setMyOpen] = useState(true); // ✅ 기본 열림(원하면 false로)

    const myId = useMemo(() => String(me?.id ?? ''), [me?.id]);

    const myComments = useMemo(() => {
        if (!myId) return [];
        const list = Array.isArray(comments) ? comments : [];
        return sortDesc(list.filter((c) => String(c?.userId ?? '') === myId));
    }, [comments, myId]);

    const otherComments = useMemo(() => {
        const list = Array.isArray(comments) ? comments : [];
        if (!myId) return sortDesc(list);
        return sortDesc(list.filter((c) => String(c?.userId ?? '') !== myId));
    }, [comments, myId]);

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
            {/* ✅ 내 댓글 박스: 토글로 전체 접기/펼치기 */}
            <div className="my-comments-box">
                <div className="my-comments-head">
                    <div className="my-comments-title">내가 쓴 댓글</div>

                    <button
                        type="button"
                        className="my-toggle"
                        onClick={() => setMyOpen((v) => !v)}
                        aria-label="my-comments-toggle"
                        title="내 댓글 영역 펼치기/접기"
                    >
                        {myOpen ? '▲' : '▼'}
                    </button>
                </div>

                {myOpen && (
                    <div className="my-comments-body">
                        {myComments.length === 0 ? (
                            <div className="comment-empty">내 댓글이 없습니다.</div>
                        ) : (
                            <div className="my-comments-list">
                                {myComments.map((c, idx) => (
                                    <CommentItem
                                        key={c?.id ?? `my-${idx}`}
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
                )}
            </div>

            {/* ✅ 다른 사람 댓글 */}
            <div className="comment-list">
                {slicedOthers.length === 0 ? (
                    <div className="comment-empty">아직 댓글이 없습니다.</div>
                ) : (
                    slicedOthers.map((c, idx) => (
                        <CommentItem
                            key={c?.id ?? `other-${idx}`}
                            me={me}
                            comment={c}
                            canDelete={canDelete}
                            onDelete={onDelete}
                        />
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
