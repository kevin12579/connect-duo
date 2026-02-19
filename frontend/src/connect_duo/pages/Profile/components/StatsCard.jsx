import React from 'react';

function formatPercent(x) {
    return `${(x * 100).toFixed(1)}%`;
}

function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) return `${h}시간 ${m}분 ${r}초`;
    if (m > 0) return `${m}분 ${r}초`;
    return `${r}초`;
}

export default function StatsCard({ stats }) {
    return (
        <div className="stats-card">
            <div className="stats-row">
                <div className="stats-label">👍 추천수</div>
                <div className="stats-value">{stats.likesCount}</div>
            </div>

            <div className="stats-row">
                <div className="stats-label">⭐ 만족도</div>
                <div className="stats-value">
                    <span className="stars">
                        {'★'.repeat(Math.round(stats.avgRating))}
                        {'☆'.repeat(5 - Math.round(stats.avgRating))}
                    </span>
                </div>
            </div>

            <div className="stats-row">
                <div className="stats-label">🔁 재상담률</div>
                <div className="stats-value">{formatPercent(stats.repeatRate)}</div>
            </div>

            <div className="stats-row">
                <div className="stats-label">✋ 상담횟수</div>
                <div className="stats-value">{stats.consultCount}</div>
            </div>

            <div className="stats-row">
                <div className="stats-label">⏱ 응답속도</div>
                <div className="stats-value chip">{formatTime(stats.avgResponseSeconds)}</div>
            </div>
        </div>
    );
}
