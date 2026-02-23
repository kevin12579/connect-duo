// src/connect_duo/utils/chat/demoAgent.js

export function demoAgentReply(userText) {
    const t = (userText || '').trim();

    if (!t) return '네 🙂 내용을 알려주시면 바로 도와드릴게요.';

    if (t.includes('상담사 연결')) {
        return '상담사 연결이 완료되었습니다 🙂 문의 내용을 한 줄로 적어주세요. (예: 사업자 등록 / 부가세 / 종소세)';
    }

    if (t.includes('사업자')) return '사업자 등록은 홈택스에서 가능해요 🙂 판매 형태(개인/법인)와 업종을 알려주실래요?';
    if (t.includes('부가세'))
        return '부가세는 보통 1월/7월 신고기간이 있어요 🙂 예상 매출과 매입(구매) 비중이 어느 정도인가요?';
    if (t.includes('종소세'))
        return '종소세는 5월 신고예요 🙂 현재 소득 형태(근로 + 부업 여부)를 알려주시면 더 정확히 안내할게요.';

    return '확인했어요 🙂 정확히 안내드리려면 1) 개인/사업자 여부 2) 판매/수입 형태 3) 월 매출 예상 범위를 알려주세요.';
}
