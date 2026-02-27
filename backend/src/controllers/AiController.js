const { ChatOpenAI } = require('@langchain/openai');
const { DynamicTool } = require('@langchain/core/tools');
const { AgentExecutor, createOpenAIFunctionsAgent } = require('langchain/agents');
const { ChatPromptTemplate, MessagesPlaceholder } = require('@langchain/core/prompts');

const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../config/dbPool');
const OC = process.env.LAW_API_ID;

// ✅ 고정 크롤링 대상 URL
const FIXED_GIFTISHOW_URL =
    'https://biz.giftishow.com/blog/2025%EB%85%84-%EA%B0%9C%EC%9D%B8%EC%82%AC%EC%97%85%EC%9E%90-%EC%A2%85%ED%95%A9%EC%86%8C%EB%93%9D%EC%84%B8-%EC%8B%A0%EA%B3%A0-%EC%99%84%EB%B2%BD-%EA%B0%80%EC%9D%B4%EB%93%9C-%EC%8B%A0%EA%B3%A0%EA%B8%B0%EA%B0%84-%EC%8B%A0%EA%B3%A0%EB%B0%A9%EB%B2%95-%EB%88%84%EC%A7%84%EC%84%B8%EC%9C%A8';
const FIXED_TAXMEDI_URL = 'https://guide.taxmedicenter.com/32/?bmode=view&idx=13713325';

// ==========================================
// 1. 기존 도구 (법령 API 관련)
// ==========================================

const taxLawSearchTool = new DynamicTool({
    name: 'nts_law_interpretation',
    description: '국세청의 세무 법령해석 사례를 검색합니다. 검색어를 입력하세요.',
    func: async (query) => {
        try {
            const url = `http://www.law.go.kr/DRF/lawSearch.do?OC=${OC}&target=ntsCgmExpc&type=JSON&query=${encodeURIComponent(query)}&display=5`;
            const response = await axios.get(url);
            const data = response.data;
            if (!data.LawSearch || !data.LawSearch.item) return '검색된 관련 법령해석 사례가 없습니다.';
            const items = Array.isArray(data.LawSearch.item) ? data.LawSearch.item : [data.LawSearch.item];
            return items
                .map(
                    (item) =>
                        `[안건명: ${item['안건명']}] / [해석일자: ${item['해석일자']}] / [링크: ${item['법령해석상세링크']}]`,
                )
                .join('\n');
        } catch (e) {
            return '세무 법령 데이터를 가져오는 중 오류가 발생했습니다.';
        }
    },
});

const lawSubTextTool = new DynamicTool({
    name: 'get_law_article_detail',
    description: '법령의 특정 조, 항, 호, 목 내용을 상세히 조회합니다. MST, JO, HANG, HO 등이 필요합니다.',
    func: async (input) => {
        try {
            const params = typeof input === 'string' ? JSON.parse(input) : input;
            const { MST, JO, HANG = '', HO = '', MOK = '' } = params;
            const url = `http://www.law.go.kr/DRF/lawService.do?OC=${OC}&target=eflawjosub&type=JSON&MST=${MST}&JO=${JO}&HANG=${HANG}&HO=${HO}&MOK=${encodeURIComponent(MOK)}`;
            const response = await axios.get(url);
            const data = response.data.LawService;
            if (!data) return '해당 조항을 찾을 수 없습니다.';
            return `[${data.법령명_한글} 제${data.조문번호}조] 내용: ${data.조문내용 || ''} ${data.항내용 || ''} ${data.호내용 || ''}`;
        } catch (e) {
            return '조항 상세 조회 중 오류 발생';
        }
    },
});

const lawMainTextTool = new DynamicTool({
    name: 'get_full_law_text',
    description: '법령 ID 또는 MST 번호를 이용해 법령 전체 내용을 조회합니다.',
    func: async (input) => {
        try {
            const { ID, MST, JO } = typeof input === 'string' ? JSON.parse(input) : input;
            let url = `http://www.law.go.kr/DRF/lawService.do?OC=${OC}&target=eflaw&type=JSON`;
            if (ID) url += `&ID=${ID}`;
            else if (MST) url += `&MST=${MST}`;
            if (JO) url += `&JO=${JO}`;
            const response = await axios.get(url);
            const data = response.data.Law;
            if (!data) return '법령 본문을 가져올 수 없습니다.';
            return `[법령명: ${data.법령명_한글}] 소관부처: ${data.소관부처} / 내용 요약: ${data.조문?.map((j) => j.조문제목).join(', ')}`;
        } catch (e) {
            return '법령 본문 조회 중 오류 발생';
        }
    },
});

const lawTermTool = new DynamicTool({
    name: 'search_law_term',
    description: '어려운 세무/법령 용어의 정의를 검색합니다.',
    func: async (query) => {
        try {
            const url = `http://www.law.go.kr/DRF/lawService.do?OC=${OC}&target=lstrm&type=JSON&query=${encodeURIComponent(query)}`;
            const response = await axios.get(url);
            const items = response.data.LawTermService?.item;
            if (!items) return '용어 정의를 찾을 수 없습니다.';
            const itemList = Array.isArray(items) ? items : [items];
            return itemList.map((i) => `[용어: ${i.법령용어명_한글}] 정의: ${i.법령용어정의}`).join('\n');
        } catch (e) {
            return '용어 조회 중 오류 발생';
        }
    },
});

const precedentDetailTool = new DynamicTool({
    name: 'get_precedent_detail',
    description: '판례 일련번호(ID)를 이용해 판결 내용을 상세 조회합니다.',
    func: async (id) => {
        try {
            const url = `http://www.law.go.kr/DRF/lawService.do?OC=${OC}&target=prec&type=JSON&ID=${id}`;
            const response = await axios.get(url);
            const data = response.data.PrecService;
            if (!data) return '판례 내용을 찾을 수 없습니다.';
            return `[사건명: ${data.사건명}] 판결요지: ${data.판결요지}\n내용: ${data.판례내용}`;
        } catch (e) {
            return '판례 상세 조회 중 오류 발생';
        }
    },
});

const taxTribunalDetailTool = new DynamicTool({
    name: 'get_tax_tribunal_detail',
    description: '조세심판원 결정례 일련번호(ID)를 이용해 상세 조회합니다.',
    func: async (id) => {
        try {
            const url = `http://www.law.go.kr/DRF/lawService.do?OC=${OC}&target=ttSpecialDecc&type=JSON&ID=${id}`;
            const response = await axios.get(url);
            const data = response.data.SpecialDeccService;
            if (!data) return '결정례 내용을 찾을 수 없습니다.';
            return `[사건명: ${data.사건명}] 주문: ${data.주문}\n이유: ${data.이유.substring(0, 1000)}...`;
        } catch (e) {
            return '조세심판원 상세 조회 중 오류 발생';
        }
    },
});

// ==========================================
// 2. 범용 크롤링 Tool (cheerio 기반)
// ==========================================

const multiSiteCrawler = new DynamicTool({
    name: 'multi_site_crawler',
    description:
        '지정된 웹페이지를 크롤링해 내용을 텍스트로 제공합니다. 입력은 "giftishow", "taxmedicenter" 또는 URL입니다.',
    func: async (input) => {
        try {
            let targetUrl = '';
            const normalized = (input || '').toString().trim();
            if (normalized.startsWith('http')) targetUrl = normalized.split('#')[0];
            else if (normalized === 'giftishow') targetUrl = FIXED_GIFTISHOW_URL;
            else if (normalized === 'taxmedicenter') targetUrl = FIXED_TAXMEDI_URL;
            else return '크롤링 대상이 모호합니다.';

            const resp = await axios.get(targetUrl, { timeout: 10000, headers: { 'User-Agent': 'TaxBot/1.0' } });
            const $ = cheerio.load(resp.data);

            const title = $('meta[property="og:title"]').attr('content') || $('h1').first().text() || '제목 없음';

            let bodyText = '';
            $('article, .entry-content, .post-content, .board_view, .content')
                .find('p, li')
                .each((_, el) => {
                    const t = $(el).text().replace(/\s+/g, ' ').trim();
                    if (t.length >= 2) bodyText += t + '\n';
                });

            let tableText = '';
            $('table').each((_, table) => {
                const rows = [];
                $(table)
                    .find('tr')
                    .each((__, tr) => {
                        const cols = [];
                        $(tr)
                            .find('th, td')
                            .each((___, td) => cols.push($(td).text().trim()));
                        if (cols.length) rows.push(cols.join(' | '));
                    });
                if (rows.length) tableText += rows.join('\n') + '\n';
            });

            const combined = (bodyText + (tableText ? `\n[표]\n${tableText}` : '')).trim();
            return `제목: ${title}\n본문: ${combined.slice(0, 5000)}\n링크: ${targetUrl}`;
        } catch (e) {
            return `크롤링 중 오류: ${e.message}`;
        }
    },
});

// ==========================================
// 3. AI 질문 처리 ( askAi )
// ==========================================

const askAi = async (req, res) => {
    const { question } = req.body;
    if (!req.authUser || !req.authUser.id) return res.status(401).json({ error: '인증 정보 없음' });

    const userId = req.authUser.id;

    try {
        const [rows] = await db.execute(
            'SELECT role, content FROM AI_History WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
            [userId],
        );
        const history = rows.reverse().map((r) => (r.role === 'user' ? ['human', r.content] : ['ai', r.content]));

        // ✅ 1단계: 선제적 크롤링 여부 판단
        let crawledContext = '';
        const q = (question || '').toString();
        const urlMatch = q.match(/https?:\/\/[^\s]+/);

        if (q.includes('taxmedicenter')) crawledContext = await multiSiteCrawler.func('taxmedicenter');
        else if (q.includes('giftishow')) crawledContext = await multiSiteCrawler.func('giftishow');
        else if (urlMatch) crawledContext = await multiSiteCrawler.func(urlMatch[0]);

        const llm = new ChatOpenAI({
            modelName: 'gpt-4o',
            temperature: 0.1,
            apiKey: process.env.OPENAI_API_KEY,
        });

        // ✅ 2단계: 크롤링 데이터가 있다면 즉시 답변 (Direct Prompt)
        if (crawledContext) {
            const directPrompt = ChatPromptTemplate.fromMessages([
                [
                    'system',
                    `당신은 대한민국 세무사입니다. 제공된 [웹 크롤링 결과]를 바탕으로 가독성 좋게 답변하세요. 
                - Markdown을 활용해 핵심은 **굵게**, 목록은 불렛 포인트로 정리하세요.
                - 반드시 제공된 자료를 근거로 하되, 부족하면 링크를 참고하라고 안내하세요.`,
                ],
                ['system', `[웹 크롤링 결과]\n${crawledContext}`],
                ...history,
                ['human', '{input}'],
            ]);

            const messages = await directPrompt.formatMessages({ input: question });
            const aiMsg = await llm.invoke(messages);
            const output = aiMsg.content;

            await db.execute("INSERT INTO AI_History (user_id, role, content) VALUES (?, 'user', ?)", [
                userId,
                question,
            ]);
            await db.execute("INSERT INTO AI_History (user_id, role, content) VALUES (?, 'assistant', ?)", [
                userId,
                output,
            ]);
            return res.json({ answer: output });
        }

        // ✅ 3단계: 크롤링 데이터가 없다면 기존 Agent 실행
        const tools = [
            taxLawSearchTool,
            lawSubTextTool,
            lawMainTextTool,
            lawTermTool,
            precedentDetailTool,
            taxTribunalDetailTool,
            multiSiteCrawler,
        ];

        const agentPrompt = ChatPromptTemplate.fromMessages([
            [
                'system',
                `당신은 대한민국 최고의 전문 세무사입니다. 
            - 법령 근거가 필요하면 get_law_article_detail 등을 사용하세요.
            - 웹 정보가 필요하면 multi_site_crawler를 사용하세요.
            - 답변은 Markdown으로 구조화(요약, 상세, 근거, 결론)하고 줄바꿈을 충분히 하세요.
            - 마지막에 "※ 본 답변은 참고용이며 세무사와 상담하십시오" 문구를 넣으세요.`,
            ],
            ...history,
            ['human', '{input}'],
            new MessagesPlaceholder('agent_scratchpad'),
        ]);

        const agent = await createOpenAIFunctionsAgent({ llm, tools, prompt: agentPrompt });
        const agentExecutor = new AgentExecutor({ agent, tools });
        const result = await agentExecutor.invoke({ input: question });

        await db.execute("INSERT INTO AI_History (user_id, role, content) VALUES (?, 'user', ?)", [userId, question]);
        await db.execute("INSERT INTO AI_History (user_id, role, content) VALUES (?, 'assistant', ?)", [
            userId,
            result.output,
        ]);

        res.json({ answer: result.output });
    } catch (error) {
        console.error('에러:', error);
        res.status(500).json({ error: '상담 처리 중 오류 발생' });
    }
};

const getHistory = async (req, res) => {
    const userId = req.authUser.id;
    try {
        const [rows] = await db.execute(
            'SELECT role, content FROM AI_History WHERE user_id = ? ORDER BY created_at ASC',
            [userId],
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: '조회 실패' });
    }
};

module.exports = { askAi, getHistory };
