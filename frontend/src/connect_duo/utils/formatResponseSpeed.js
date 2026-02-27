/**
 * formatResponseSpeed.js
 *
 * 응답속도(분) → 사람이 읽기 좋은 문자열로 변환
 *
 * 사용처:
 *  - ChatRoom 헤더 : "⏱ 평균 응답 12분"
 *  - TaxProfile    : StatsCard의 avgResponseMinutes prop으로 그냥 전달 (이미 formatTime 있음)
 *  - RankingPage   : 랭킹 카드에 응답속도 뱃지로 표시
 */

/**
 * 분(number) → "N분" | "N시간 M분" | "빠른 응답" 문자열
 * @param {number|null|undefined} minutes
 * @returns {string}
 */
export function formatResponseSpeed(minutes) {
    const mins = Math.max(0, Math.floor(Number(minutes) || 0));

    if (mins === 0) return '측정 중';
    if (mins < 5) return '⚡ 빠른 응답';

    const h = Math.floor(mins / 60);
    const m = mins % 60;

    if (h > 0) return `${h}시간 ${m > 0 ? m + '분' : ''}`.trim();
    return `${m}분`;
}

/**
 * 응답속도에 따른 색상 클래스 반환
 * @param {number} minutes
 * @returns {'speed-fast' | 'speed-normal' | 'speed-slow'}
 */
export function responseSpeedClass(minutes) {
    const mins = Number(minutes) || 0;
    if (mins === 0 || mins <= 10) return 'speed-fast';
    if (mins <= 60) return 'speed-normal';
    return 'speed-slow';
}
