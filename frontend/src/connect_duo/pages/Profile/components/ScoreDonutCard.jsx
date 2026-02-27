import React from 'react';

export default function ScoreDonutCard({ totalScore, segments }) {
    const size = 220;
    const r = 78;
    const cx = size / 2;
    const cy = size / 2;
    const circumference = 2 * Math.PI * r;

    let accumulatedWeight = 0;

    return (
        <div className="score-card">
            <div className="score-title">종합 평가 지수</div>
            <div className="donut-wrap">
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-svg">
                    <circle cx={cx} cy={cy} r={r} className="donut-bg" fill="none" stroke="#f0f0f0" strokeWidth="14" />
                    {segments.map((seg, idx) => {
                        const dashLength = (seg.weight || 0) * circumference;
                        const dashArray = `${dashLength} ${circumference - dashLength}`;
                        const dashOffset = -accumulatedWeight * circumference;
                        accumulatedWeight += seg.weight || 0;

                        return (
                            <circle
                                key={seg.label}
                                cx={cx}
                                cy={cy}
                                r={r}
                                fill="none"
                                strokeWidth="14"
                                className={`donut-seg seg-${idx}`}
                                strokeDasharray={dashArray}
                                strokeDashoffset={dashOffset}
                                strokeLinecap="round"
                            />
                        );
                    })}
                    <circle cx={cx} cy={cy} r={52} className="donut-center" fill="#fff" />
                    <text
                        x={cx}
                        y={cy + 8}
                        textAnchor="middle"
                        className="donut-score-text"
                        fill="#333"
                        style={{ fontSize: '24px', fontWeight: 'bold' }}
                    >
                        {Math.round(totalScore)}점
                    </text>
                </svg>
                <div className="donut-legend">
                    {segments.map((s, idx) => (
                        <div key={s.label} className="legend-row">
                            <span className={`legend-dot seg-${idx}`} />
                            <span className="legend-label">{s.label}</span>
                            <span className="legend-val">{Math.round(s.value)}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
