// utils/score.js

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

// 1. 추천수 점수 (0~100개 기준 로그 스케일)
function logScore(value, cap) {
    const score = (Math.log1p(value) / Math.log1p(cap)) * 100;
    return clamp(score, 0, 100);
}

// 2. 만족도 점수 (1~5점 -> 0~100점)
function ratingScore(avgRating) {
    if (!avgRating) return 0;
    return clamp(((avgRating - 1) / 4) * 100, 0, 100);
}

// 3. 응답 속도 점수 (분 단위: 10분 이내 100점, 24시간 이상 0점)
function responseScore(avgMinutes) {
    const MAX_MIN = 24 * 60; // 1440분
    return clamp(100 * (1 - avgMinutes / MAX_MIN), 0, 100);
}

export function calcTotalScore(stats) {
    if (!stats) return 0;
    const likeS = logScore(stats.likesCount || 0, 100);
    const rateS = ratingScore(stats.avgRating || 0);
    const repeatS = clamp(stats.repeatRate || 0, 0, 100);
    const consultS = logScore(stats.consultCount || 0, 150);
    const respS = responseScore(stats.avgResponseMinutes || 60);

    const weights = { likes: 0.2, rate: 0.3, repeat: 0.3, consult: 0.15, resp: 0.05 };

    return (
        likeS * weights.likes +
        rateS * weights.rate +
        repeatS * weights.repeat +
        consultS * weights.consult +
        respS * weights.resp
    );
}

export function buildDonutSegments(stats) {
    if (!stats) return [];
    return [
        { label: '추천수', value: logScore(stats.likesCount || 0, 100), weight: 0.2 },
        { label: '만족도', value: ratingScore(stats.avgRating || 0), weight: 0.3 },
        { label: '재상담률', value: clamp(stats.repeatRate || 0, 0, 100), weight: 0.3 },
        { label: '상담횟수', value: logScore(stats.consultCount || 0, 150), weight: 0.15 },
        { label: '응답속도', value: responseScore(stats.avgResponseMinutes || 60), weight: 0.05 },
    ];
}
