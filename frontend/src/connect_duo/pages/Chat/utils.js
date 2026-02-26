// ✅ JSON 안전 파싱
export function safeParse(raw, fallback) {
    try {
        const v = raw ? JSON.parse(raw) : fallback;
        return v ?? fallback;
    } catch {
        return fallback;
    }
}

// ✅ 랜덤 정수
export function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ✅ text에 키워드 배열 중 하나라도 포함되는지
export function includesAny(text, arr) {
    const t = (text || '').toLowerCase();
    return (arr || []).some((k) => t.includes(String(k).toLowerCase()));
}

// ✅ 퍼센트 추출 (예: 40%, 40퍼, 0.4)
export function extractPercent(text) {
    const t = (text || '').replace(/\s/g, '');

    const m1 = t.match(/(\d{1,3})%/);
    if (m1) return Math.min(100, Math.max(0, parseInt(m1[1], 10)));

    const m2 = t.match(/(\d{1,3})퍼/);
    if (m2) return Math.min(100, Math.max(0, parseInt(m2[1], 10)));

    const m3 = t.match(/0\.(\d{1,2})/);
    if (m3) {
        const frac = m3[1];
        const v = frac.length === 1 ? parseInt(frac, 10) * 10 : parseInt(frac, 10);
        return Math.min(100, Math.max(0, v));
    }

    // "40 정도" 같은 케이스
    const m4 = t.match(/(\d{1,3})/);
    if (m4) {
        const n = parseInt(m4[1], 10);
        if (n >= 0 && n <= 100) return n;
    }

    return null;
}

// ✅ "1-1, 2-3, 3-3" 파싱
export function parseChoiceTriplet(text) {
    const s = (text || '').replace(/\s/g, '');
    const matches = s.match(/[123]-[1-4]/g);
    if (!matches) return null;

    const uniq = Array.from(new Set(matches));
    const pick = (prefix) => uniq.find((x) => x.startsWith(prefix));
    const a = pick('1-');
    const b = pick('2-');
    const c = pick('3-');
    if (!a || !b || !c) return null;

    return { a, b, c };
}

export function labelA(a) {
    const map = {
        '1-1': '아직 사업자 없음(개인)',
        '1-2': '개인으로 시작 예정(곧 등록)',
        '1-3': '이미 사업자 있음',
    };
    return map[a] || a;
}

export function labelB(b) {
    const map = {
        '2-1': '스마트스토어/쿠팡 등 플랫폼',
        '2-2': '인스타/블로그/자사몰',
        '2-3': '오프라인(매장/행사)',
    };
    return map[b] || b;
}

export function labelC(c) {
    const map = {
        '3-1': '0~100만원',
        '3-2': '100~300만원',
        '3-3': '300~500만원',
        '3-4': '500만원 이상',
    };
    return map[c] || c;
}

// ✅ "모르겠" 감지 (중요: 숫자 있으면 모르겠 분기 금지)
export function isDontKnowText(text) {
    const t = (text || '').trim();
    if (!t) return false;

    if (/\d/.test(t)) return false;

    const patterns = [
        '잘 모르',
        '모르겠',
        '모르겠어',
        '모르겠어요',
        '몰라',
        '몰라요',
        '아직 몰라',
        '아직 모르',
        '기억이 안',
        '생각이 안',
        '감이 안',
        '처음이라',
        '미정',
    ];
    return patterns.some((p) => t.includes(p));
}

// ✅ 종료 의사 감지
export function isUserClosingText(text) {
    const t = (text || '').trim();
    if (!t) return false;

    const patterns = [
        '감사',
        '고마',
        '수고',
        '끝',
        '종료',
        '마무리',
        '충분',
        '이해했',
        '알겠',
        '됐어',
        '됐어요',
        '괜찮아요',
        '더 없',
        '없어요',
        '정리됐',
    ];
    return patterns.some((p) => t.includes(p));
}
