// src/utils/chat/demoAgent.js
// ✅ 세무챗 데모 상담 자동응답 (stateless / keyword-based)

const clamp = (s = '') => String(s || '').trim();
const lower = (s = '') => clamp(s).toLowerCase();

const includesAny = (t, arr) => arr.some((k) => t.includes(k));
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

function friendlyDisclaimer() {
    return '※ 참고용 안내야. 정확한 신고/절세는 증빙·업종·매출형태에 따라 달라서 필요하면 세무사 확인 추천!';
}

function askBasics() {
    return (
        '확인만 몇 가지 해볼게 🙂\n' +
        '1) 개인/법인? 2) 간이/일반과세? 3) 업종(예: 쇼핑몰/음식점/프리랜서)?\n' +
        '4) 올해 매출 대략(카드/현금/계좌이체 비중) 알려주면 더 정확히 안내해줄게!'
    );
}

function replyGreeting() {
    return pickOne([
        '안녕 🙂 세무쳇이야! 어떤 세무 고민이야? (부가세/종소세/원천세/경비처리/사업자등록 등)',
        '어서와 😄 세무 관련해서 뭐가 제일 급해? 상황만 간단히 말해줘!',
        '안녕하세요! 세무 상담 도와줄게 🙂 어떤 업종이고 어떤 문제가 생겼어?',
    ]);
}

function replyVat(t) {
    const base =
        '부가세(부가가치세)는 보통 1월/7월에 신고가 많고, 매출·매입 자료 정리가 핵심이야.\n' +
        '빠르게 체크할 것:\n' +
        '- 매출: 카드/현금영수증/세금계산서/플랫폼 정산\n' +
        '- 매입: 세금계산서/현금영수증/카드(사업용) + 증빙 누락 여부\n' +
        '- 공제: 사업 관련 지출인지(개인 소비 섞이면 공제 제한)\n' +
        '- 간이/일반 여부에 따라 계산이 달라!\n';

    const follow = '\n질문! 지금은 간이과세자야, 일반과세자야? 그리고 업종이랑 최근 매출 규모(대략) 알려줄래?';

    // “간이/일반” 분기
    if (includesAny(t, ['간이'])) {
        return (
            '간이과세자면 부가세 계산 방식이 조금 달라서 “매출액 + 업종별 부가율” 개념이 들어가.\n' +
            '그래도 매입 증빙 챙겨두는 게 중요하고(특히 일반과세 전환 가능성),\n' +
            '연 매출이 커지면 일반과세 전환될 수도 있어.\n' +
            follow +
            '\n' +
            friendlyDisclaimer()
        );
    }
    if (includesAny(t, ['일반'])) {
        return (
            '일반과세자면 매출세액 - 매입세액으로 계산돼.\n' +
            '그래서 “매입 증빙 누락”이 바로 세금 증가로 이어지는 편이야.\n' +
            base +
            follow +
            '\n' +
            friendlyDisclaimer()
        );
    }

    return base + follow + '\n' + friendlyDisclaimer();
}

function replyIncomeTax() {
    return (
        '종합소득세(종소세)는 5월에 많이 신고하고, “수입 - 필요경비 - 각종 공제”로 세금이 결정돼.\n' +
        '경비처리 핵심 포인트:\n' +
        '- 증빙(카드/현금영수증/세금계산서) 있는 지출이 유리\n' +
        '- 개인지출 섞이면 경비로 인정 안 되거나 일부만 인정될 수 있어\n' +
        '- 차량/통신/식대/접대비 등은 기준이 있어\n\n' +
        '일단 업종이랑 “매출/경비 대략 비율”이 어떤지 말해줄래?\n' +
        friendlyDisclaimer()
    );
}

function replyWithholding() {
    return (
        '원천세는 “급여/프리랜서 지급” 같은 인건비 지급할 때 많이 걸려.\n' +
        '빠른 체크:\n' +
        '- 직원 급여인지? 프리랜서(사업/기타소득)인지?\n' +
        '- 지급일 기준으로 원천징수/신고 기한이 달라질 수 있어\n' +
        '- 4대보험(직원)도 같이 고려해야 해\n\n' +
        '지금 사람을 고용한 거야? 아니면 프리랜서에게 용역비 지급한 거야? 지급 금액/횟수도 알려줘 🙂\n' +
        friendlyDisclaimer()
    );
}

function replyPayrollInsurance() {
    return (
        '직원 고용이면 4대보험 + 급여 원천세 + 지급명세서(연말정산)까지 한 세트로 봐야 해.\n' +
        '질문!\n' +
        '1) 정규직/알바? 2) 월급/시급? 3) 주 몇 시간? 4) 4대보험 가입 여부(또는 가입 예정) 알려줄래?\n' +
        friendlyDisclaimer()
    );
}

function replyInvoice(t) {
    if (includesAny(t, ['세금계산서', '계산서', '전자'])) {
        return (
            '세금계산서/전자세금계산서는 거래 증빙의 “끝판왕”이야 😎\n' +
            '체크 포인트:\n' +
            '- 공급자/공급받는자 사업자번호 정확히\n' +
            '- 공급가액·부가세·작성일(공급시기) 맞는지\n' +
            '- 수정세금계산서가 필요한 상황인지(취소/반품/금액 변경)\n\n' +
            '어떤 상황이야? “발급을 못했어/잘못 발급했어/취소해야 해” 중 어디에 가까워?\n' +
            friendlyDisclaimer()
        );
    }
    return (
        '증빙(세금계산서/현금영수증/카드전표)은 매입공제·경비처리에 핵심이야.\n' +
        '어떤 증빙이 필요한 상황인지(거래처 요구/비용 처리/매출 신고) 말해줘 🙂\n' +
        friendlyDisclaimer()
    );
}

function replyExpense() {
    return (
        '경비처리 고민 많지 😅 보통은 “사업 관련성 + 증빙 + 한도/규정” 3가지만 보면 돼.\n' +
        '자주 물어보는 항목:\n' +
        '- 식대/커피: 업무 관련이면 가능(증빙 중요)\n' +
        '- 접대비: 한도/증빙 규정 있음\n' +
        '- 차량유지비: 사업용 여부·운행기록/비율 이슈\n' +
        '- 통신비: 개인폰이면 업무사용 비율 문제\n\n' +
        '어떤 지출을 경비로 넣고 싶은데? (예: 주유/통신/식비/장비/광고비/택배비)\n' +
        friendlyDisclaimer()
    );
}

function replyBusinessReg() {
    return (
        '사업자등록은 업종·형태에 따라 준비 서류가 조금 달라.\n' +
        '보통 체크:\n' +
        '- 임대차계약서(사업장 주소)\n' +
        '- 업종 코드(온라인쇼핑/음식/서비스 등)\n' +
        '- 간이/일반 선택(예상 매출에 따라)\n\n' +
        '어떤 업종이고, 오프라인 매장 있어? 아니면 온라인/프리랜서 형태야?\n' +
        friendlyDisclaimer()
    );
}

function replyCashReceipt() {
    return (
        '현금영수증은 매출 누락 방지 + 소비자 소득공제용으로 자주 걸려.\n' +
        '사업자 입장 체크:\n' +
        '- 발급 의무 업종 여부\n' +
        '- 발급 못 했을 때 가산세 가능성\n' +
        '- 계좌이체/현금 매출 관리\n\n' +
        '“발급 요청을 받았는데 못했어”야? 아니면 “발급을 어떻게 해”가 궁금해?\n' +
        friendlyDisclaimer()
    );
}

function replyPlatformSales() {
    return (
        '쿠팡/네이버/배민 같은 플랫폼 매출은 “정산서 기준”으로 매출·수수료·광고비를 같이 정리하는 게 포인트야.\n' +
        '빠른 정리법:\n' +
        '- 매출: 정산서 총매출 기준\n' +
        '- 비용: 플랫폼 수수료/광고비/배달비(증빙 여부 체크)\n' +
        '- 부가세 신고 때 매출 누락/중복 잡히기 쉬움\n\n' +
        '어떤 플랫폼 써? 그리고 카드/현금/배달앱 비중 대략 어때?\n' +
        friendlyDisclaimer()
    );
}

function replyRefundCancel() {
    return (
        '반품/취소/환불 있으면 “매출 차감 처리”랑 “증빙(세금계산서/현금영수증) 수정”이 포인트야.\n' +
        '질문!\n' +
        '1) 카드 결제 취소인지 2) 계좌환불인지 3) 세금계산서 발행 거래인지 알려줘.\n' +
        friendlyDisclaimer()
    );
}

function replyClosing() {
    return pickOne([
        '정리해주면 내가 체크리스트로 딱 정리해줄게 🙂\n' + askBasics(),
        '좋아, 지금 정보만 조금 더 있으면 정확히 안내 가능해 😎\n' + askBasics(),
        '오케이! 상황 파악만 하면 해결 방향 바로 잡아줄게.\n' + askBasics(),
    ]);
}

const FALLBACKS = [
    '오케이 🙂 지금 말해준 내용 기준으로 보면, “증빙/과세유형/매출형태” 3가지만 더 알면 정확히 답할 수 있어. 업종이랑 간이/일반 여부 알려줘!',
    '음… 그 케이스는 디테일에 따라 달라서 확인 질문할게! 개인/법인인지, 간이/일반인지, 최근 매출 규모가 어느 정도야?',
    '좋아! 지금 상황을 “한 줄 요약”으로 다시 말해줄래? (예: 부가세 신고 누락 / 경비 인정 가능? / 세금계산서 수정 필요 등)',
];

export function demoAgentReplyText(userText) {
    const t0 = clamp(userText);
    const t = lower(userText);

    if (!t0) return replyGreeting();

    // 종료/감사
    if (includesAny(t, ['고마워', '감사', '땡큐', 'thanks'])) {
        return '천만에 🙂 필요한 거 있으면 바로 물어봐! ' + friendlyDisclaimer();
    }

    // 인사/시작
    if (includesAny(t, ['안녕', '하이', 'hello', '시작', '처음', '문의'])) {
        return replyGreeting();
    }

    // 사업자등록/개업
    if (includesAny(t, ['사업자', '등록', '개업', '창업', '업종', '임대차'])) {
        return replyBusinessReg();
    }

    // 부가세/부가가치세/간이/일반
    if (includesAny(t, ['부가세', '부가가치세', 'vat', '과세', '간이', '일반'])) {
        return replyVat(t);
    }

    // 종소세/종합소득세/5월
    if (includesAny(t, ['종소세', '종합소득세', '5월', '소득세', '경비', '필요경비', '장부'])) {
        // 경비 단독 키워드면 경비 응답이 더 자연스러움
        if (includesAny(t, ['경비', '필요경비', '증빙', '카드', '현금영수증'])) return replyExpense();
        return replyIncomeTax();
    }

    // 원천세/3.3/프리랜서/급여
    if (includesAny(t, ['원천', '원천세', '3.3', '삼쩜삼', '프리랜서', '급여', '인건비', '지급명세서'])) {
        return replyWithholding();
    }

    // 4대보험/직원/알바
    if (includesAny(t, ['4대', '사대', '보험', '직원', '알바', '근로계약', '연말정산'])) {
        return replyPayrollInsurance();
    }

    // 세금계산서/전자/수정
    if (includesAny(t, ['세금계산서', '계산서', '전자', '발행', '수정', '취소'])) {
        // 취소/환불도 같이 들어오면 환불 쪽이 자연스러움
        if (includesAny(t, ['환불', '취소', '반품'])) return replyRefundCancel();
        return replyInvoice(t);
    }

    // 현금영수증
    if (includesAny(t, ['현금영수증', '현금', '발급', '의무발행'])) {
        return replyCashReceipt();
    }

    // 플랫폼 매출(정산)
    if (includesAny(t, ['쿠팡', '네이버', '스마트스토어', '배민', '요기요', '정산', '수수료', '광고비', '플랫폼'])) {
        return replyPlatformSales();
    }

    // 환불/취소/반품
    if (includesAny(t, ['환불', '취소', '반품', '클레임'])) {
        return replyRefundCancel();
    }

    // 기본 마무리(추가 질문 유도)
    return replyClosing() + '\n\n' + pickOne(FALLBACKS);
}
