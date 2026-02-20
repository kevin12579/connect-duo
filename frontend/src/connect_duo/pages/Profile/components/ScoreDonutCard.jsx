import React from 'react';

export default function ScoreDonutCard({ totalScore, segments }) {
    // segments: [{label, value(0~100), weight(0~1)}...]
    // 도넛은 "가중치 비율"로 섹션을 나눠서 그려줌
    const size = 220;
    const r = 78;
    const cx = size / 2;
    const cy = size / 2;
    const c = 2 * Math.PI * r;

    let acc = 0;

    return (
        <div className="score-card">
            <div className="score-title">종합 점수</div>

            <div className="donut-wrap">
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-svg">
                    {/* 바탕 링 */}
                    <circle cx={cx} cy={cy} r={r} className="donut-bg" />

                    {/* 섹션들 */}
                    {segments.map((seg, idx) => {
                        const dash = (seg.weight || 0) * c;
                        const dasharray = `${dash} ${c - dash}`;
                        const dashoffset = -acc * c;
                        acc += seg.weight || 0;

                        return (
                            <circle
                                key={seg.label + idx}
                                cx={cx}
                                cy={cy}
                                r={r}
                                className={`donut-seg seg-${idx}`}
                                strokeDasharray={dasharray}
                                strokeDashoffset={dashoffset}
                            />
                        );
                    })}

                    {/* 가운데 */}
                    <circle cx={cx} cy={cy} r={52} className="donut-center" />
                    <text x={cx} y={cy + 6} textAnchor="middle" className="donut-score-text">
                        {Math.round(totalScore)} 점
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
