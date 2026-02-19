import React, { useState } from 'react';
import './RankingPage.css';

const trophySVG = (rank) => {
    const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
    return (
        <svg className="ranking-trophy" viewBox="0 0 40 40">
            <rect x="10" y="12" width="20" height="16" rx="6" fill={colors[rank - 1]} stroke="#888" strokeWidth="1.5" />
            <ellipse cx="20" cy="12" rx="10" ry="5" fill={colors[rank - 1]} stroke="#888" strokeWidth="1.5" />
            <rect x="17" y="28" width="6" height="6" rx="2" fill="#888" />
            <text x="20" y="23" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#fff">
                {rank}
            </text>
        </svg>
    );
};

const dummyTaxAdvisors = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    name: `세무사 ${i + 1}`,
    photo: `https://randomuser.me/api/portraits/men/${(i % 10) + 10}.jpg`,
    desc: `전문 분야: ${['소득세', '법인세', '부가가치세', '상속세'][i % 4]}`,
    stats: { 추천수: 10, 만족도: '95%', 재상담율: '80%', 상담횟수: 100, 응답속도: '1시간' },
}));

const PAGE_SIZE = 4;

const RankingPage = () => {
    const [page, setPage] = useState(1);
    const totalPages = Math.ceil(dummyTaxAdvisors.length / PAGE_SIZE);

    // 페이지별로 미리 그룹화 (슬라이드 판을 만들기 위해)
    const pagesArray = [];
    for (let i = 0; i < totalPages; i++) {
        pagesArray.push(dummyTaxAdvisors.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE));
    }

    return (
        <div className="ranking-outer-container">
            {/* 실제 슬라이드가 일어나는 창문 */}
            <div className="ranking-window">
                <div className="ranking-slider-track" style={{ transform: `translateX(-${(page - 1) * 100}%)` }}>
                    {pagesArray.map((group, pageIdx) => (
                        <div className="ranking-page-group" key={pageIdx}>
                            {group.map((advisor, idx) => {
                                const globalRank = pageIdx * PAGE_SIZE + idx + 1;
                                return (
                                    <div className="ranking-profile" key={advisor.id}>
                                        {globalRank <= 3 ? (
                                            trophySVG(globalRank)
                                        ) : (
                                            <div className="ranking-rank-num">{globalRank}</div>
                                        )}
                                        <img src={advisor.photo} alt={advisor.name} className="ranking-photo" />
                                        <div className="ranking-name">{advisor.name}</div>
                                        <div className="ranking-desc">{advisor.desc}</div>
                                        <div className="ranking-stats">
                                            <div className="ranking-stat">
                                                {advisor.stats.추천수}
                                                <span className="ranking-stat-label">추천수</span>
                                            </div>
                                            <div className="ranking-stat">
                                                {advisor.stats.만족도}
                                                <span className="ranking-stat-label">만족도</span>
                                            </div>
                                            <div className="ranking-stat">
                                                {advisor.stats.재상담율}
                                                <span className="ranking-stat-label">재상담율</span>
                                            </div>
                                            <div className="ranking-stat">
                                                {advisor.stats.상담횟수}
                                                <span className="ranking-stat-label">상담횟수</span>
                                            </div>
                                            <div className="ranking-stat">
                                                {advisor.stats.응답속도}
                                                <span className="ranking-stat-label">응답속도</span>
                                            </div>
                                        </div>
                                        <button className="ranking-consult-btn">프로필 보기</button>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            <div className="ranking-pagination">
                <button className="ranking-arrow" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
                    ←
                </button>
                <span className="ranking-page-num">
                    {page} / {totalPages}
                </span>
                <button className="ranking-arrow" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>
                    →
                </button>
            </div>
        </div>
    );
};

export default RankingPage;