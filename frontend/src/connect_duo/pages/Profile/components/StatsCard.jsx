import React from 'react';

// % 포맷팅 (DB값이 15.5이면 15.5%로 표시)
function formatPercent(x) {
    return `${Number(x || 0).toFixed(1)}%`;
}

// 분(min) 단위를 시간/분으로 포맷팅
function formatTime(totalMinutes) {
    const mins = Math.max(0, Math.floor(totalMinutes || 0));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}시간 ${m}분`;
    return `${m}분`;
}

export default function StatsCard({ stats }) {
    if (!stats) return null;

    return (
        <div className="stats-card">
            <div className="stats-row">
                <div className="stats-label">👍 추천수</div>
                <div className="stats-value">{stats.likesCount}</div>
            </div>
            <div className="stats-row">
                <div className="stats-label">⭐ 만족도</div>
                <div className="stats-value">
                    <span className="stars" style={{ color: '#ffc107' }}>
                        {'★'.repeat(Math.round(stats.avgRating))}
                        {'☆'.repeat(5 - Math.round(stats.avgRating))}
                    </span>
                    <span className="rating-num">({Number(stats.avgRating).toFixed(1)})</span>
                </div>
            </div>
            <div className="stats-row">
                <div className="stats-label">🔁 재상담률</div>
                <div className="stats-value">{formatPercent(stats.repeatRate)}</div>
            </div>
            <div className="stats-row">
                <div className="stats-label">✋ 상담횟수</div>
                <div className="stats-value">{stats.consultCount}회</div>
            </div>
            <div className="stats-row">
                <div className="stats-label">⏱ 응답속도</div>
                <div className="stats-value chip">{formatTime(stats.avgResponseMinutes)}</div>
            </div>
        </div>
    );
}
