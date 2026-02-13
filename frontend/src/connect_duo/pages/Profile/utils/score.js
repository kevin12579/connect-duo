function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function logScore(value, cap) {
    // 0~cap 사이를 로그로 0~100으로
    // cap은 “상위권 기준치” (초기값 100 정도로 시작 추천)
    const v = Math.max(0, value);
    const c = Math.max(1, cap);
    const score = (Math.log1p(v) / Math.log1p(c)) * 100;
    return clamp(score, 0, 100);
}

function ratingScore(avgRating) {
    // 1~5 -> 0~100
    return clamp(((avgRating - 1) / 4) * 100, 0, 100);
}

function repeatScore(repeatRate) {
    return clamp(repeatRate * 100, 0, 100);
}

function responseScore(avgSeconds) {
    // 0초=100점, 24시간 이상=0점(기준치)
    const CAP = 24 * 60 * 60;
    return clamp(100 * (1 - avgSeconds / CAP), 0, 100);
}

export function calcTotalScore(stats) {
    const likeS = logScore(stats.likesCount, 100);
    const rateS = ratingScore(stats.avgRating);
    const repeatS = repeatScore(stats.repeatRate);
    const consultS = logScore(stats.consultCount, 120);
    const respS = responseScore(stats.avgResponseSeconds);

    // 가중치(디자인의 도넛 라벨 비율이랑 맞춰도 됨)
    const w = {
        추천수: 0.2,
        만족도: 0.3,
        재상담률: 0.35,
        상담횟수: 0.1,
        응답속도: 0.05,
    };

    return (
        likeS * w['추천수'] +
        rateS * w['만족도'] +
        repeatS * w['재상담률'] +
        consultS * w['상담횟수'] +
        respS * w['응답속도']
    );
}

export function buildDonutSegments(stats) {
    // 도넛 섹션은 “가중치” 비율로 나누고
    // 각 섹션 옆에 표시하는 값(value)은 해당 지표 점수(0~100)
    const likeS = logScore(stats.likesCount, 100);
    const rateS = ratingScore(stats.avgRating);
    const repeatS = repeatScore(stats.repeatRate);
    const consultS = logScore(stats.consultCount, 120);
    const respS = responseScore(stats.avgResponseSeconds);

    // weight 합이 1이 되게
    const segments = [
        { label: '추천수', value: likeS, weight: 0.2 },
        { label: '만족도', value: rateS, weight: 0.3 },
        { label: '재상담률', value: repeatS, weight: 0.35 },
        { label: '상담횟수', value: consultS, weight: 0.1 },
        { label: '응답속도', value: respS, weight: 0.05 },
    ];

    return segments;
}
