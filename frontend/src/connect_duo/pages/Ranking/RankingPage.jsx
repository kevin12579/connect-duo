import React, { useEffect, useState } from 'react';
import './RankingPage.css';
import { getTaxProRanking } from '../../api/axios';
import { calcTotalScore } from '../../utils/score';

// ✅ assets (네 폴더 스샷 기준 파일명)
import goldBadge from '../../assets/Gold_1st.png';
import silverBadge from '../../assets/Silver_2st.png';
import bronzeBadge from '../../assets/Bronze_3st.png';
import crownImg from '../../assets/Crown.png';

const PAGE_SIZE = 4;

const RankingPage = ({ onOpenTaxProProfile }) => {
    const [advisors, setAdvisors] = useState([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    const storedMe = JSON.parse(localStorage.getItem('userBackup') || 'null');
    const myId = storedMe?.id;

    useEffect(() => {
        const fetchRankingData = async () => {
            try {
                const res = await getTaxProRanking();
                if (res.result === 'success') {
                    const scoredData = res.data.map((advisor) => {
                        const stats = {
                            recommend_count: Number(advisor.recommend_count || 0),
                            satisfaction_score: Number(advisor.satisfaction_score || 0),
                            re_consult_rate: Number(advisor.re_consult_rate || 0),
                            consult_count: Number(advisor.consult_count || 0),
                            response_speed: Number(advisor.response_speed || 60),
                        };
                        const totalScore = calcTotalScore({
                            likesCount: stats.recommend_count,
                            avgRating: stats.satisfaction_score,
                            repeatRate: stats.re_consult_rate,
                            consultCount: stats.consult_count,
                            avgResponseMinutes: stats.response_speed,
                        });
                        return { ...advisor, ...stats, totalScore: isNaN(totalScore) ? 0 : totalScore };
                    });
                    scoredData.sort((a, b) => b.totalScore - a.totalScore);
                    setAdvisors(scoredData);
                }
            } catch (err) {
                console.error('Ranking fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchRankingData();
    }, []);

    const totalPages = Math.ceil(advisors.length / PAGE_SIZE);
    const pagesArray = [];
    for (let i = 0; i < totalPages; i++) {
        pagesArray.push(advisors.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE));
    }

    if (loading)
        return (
            <div className="ranking-root">
                <div className="loading-container">
                    <div className="loader"></div>
                    <p>랭킹 분석 중...</p>
                </div>
            </div>
        );

    return (
        <div className="ranking-root">
            <div className="ranking-outer-container">
                <div className="ranking-window">
                    <div className="ranking-slider-track" style={{ transform: `translateX(-${(page - 1) * 100}%)` }}>
                        {pagesArray.length > 0 ? (
                            pagesArray.map((group, pageIdx) => (
                                <div className="ranking-page-group" key={pageIdx}>
                                    {group.map((advisor, idx) => {
                                        const globalRank = pageIdx * PAGE_SIZE + idx + 1;
                                        const rankClass = globalRank <= 3 ? `rank-${globalRank}` : '';

                                        const badgeSrc =
                                            globalRank === 1
                                                ? goldBadge
                                                : globalRank === 2
                                                  ? silverBadge
                                                  : globalRank === 3
                                                    ? bronzeBadge
                                                    : null;

                                        const isMe = String(advisor.user_id) === String(myId);

                                        return (
                                            <div className={`ranking-profile-card ${rankClass}`} key={advisor.id}>
                                                {/* ✅ 1~3위 뱃지 이미지 / 4등부터 숫자 */}
                                                <div className="rank-badge-area">
                                                    {globalRank <= 3 ? (
                                                        <img
                                                            className={`ranking-badge-img ${globalRank === 2 ? 'silver-badge' : ''}`}
                                                            src={badgeSrc}
                                                            alt={`${globalRank}등`}
                                                        />
                                                    ) : (
                                                        <div className="ranking-rank-num">{globalRank}</div>
                                                    )}
                                                </div>

                                                {/* ✅ 사진 영역 + 1등 왕관(이미지) */}
                                                <div className="photo-wrap">
                                                    {globalRank === 1 && (
                                                        <img className="crown-icon" src={crownImg} alt="1등" />
                                                    )}

                                                    {advisor.profile_img ? (
                                                        <img
                                                            src={advisor.profile_img}
                                                            alt={advisor.name}
                                                            className="ranking-photo"
                                                        />
                                                    ) : (
                                                        <div className="ranking-photo-placeholder">
                                                            <span>{advisor.name?.[0]}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="ranking-info">
                                                    <h3 className="ranking-name">{advisor.name} 세무사</h3>
                                                    <p className="ranking-desc">
                                                        {advisor.bio_one_line || '최상의 세무 서비스를 제공합니다.'}
                                                    </p>
                                                </div>

                                                <div className="ranking-stats-grid">
                                                    <div className="ranking-stat">
                                                        <span className="stat-val">{advisor.recommend_count}</span>
                                                        <span className="stat-label">추천</span>
                                                    </div>
                                                    <div className="ranking-stat">
                                                        <span className="stat-val">
                                                            {Number(advisor.satisfaction_score || 0).toFixed(1)}
                                                        </span>
                                                        <span className="stat-label">만족도</span>
                                                    </div>
                                                    <div className="ranking-stat">
                                                        <span className="stat-val">{Math.round(advisor.re_consult_rate)}%</span>
                                                        <span className="stat-label">재상담</span>
                                                    </div>
                                                    <div className="ranking-stat">
                                                        <span className="stat-val">{advisor.consult_count}</span>
                                                        <span className="stat-label">상담</span>
                                                    </div>
                                                </div>

                                                <div className="ranking-footer">
                                                    <div className="ranking-total-badge">
                                                        Score <span>{(advisor.totalScore || 0).toFixed(1)}</span>
                                                    </div>

                                                    <button
                                                        className={`ranking-action-btn ${isMe ? 'is-me' : ''}`}
                                                        onClick={() => onOpenTaxProProfile(advisor.user_id)}
                                                    >
                                                        {isMe ? '내 프로필 관리' : '프로필 상세보기'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))
                        ) : (
                            <div className="no-data">현재 등록된 세무사 정보가 없습니다.</div>
                        )}
                    </div>
                </div>

                {totalPages > 1 && (
                    <div className="ranking-pagination">
                        <button className="nav-btn prev" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
                            &lt;
                        </button>

                        <div className="page-indicator">
                            <strong>{page}</strong> / {totalPages}
                        </div>

                        <button className="nav-btn next" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>
                            &gt;
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RankingPage;