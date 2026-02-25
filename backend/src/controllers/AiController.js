const { ChatOpenAI } = require('@langchain/openai');
const { DynamicTool } = require('@langchain/core/tools');
const { AgentExecutor, createOpenAIFunctionsAgent } = require('langchain/agents');
const { ChatPromptTemplate, MessagesPlaceholder } = require('@langchain/core/prompts');

const axios = require('axios');
const db = require('../config/dbPool');

// 국세청 법령해석 API 도구
const taxLawSearchTool = new DynamicTool({
    name: 'nts_law_interpretation',
    description: '국세청의 세무 법령해석 사례를 검색합니다. 검색어를 입력하세요.',
    func: async (query) => {
        try {
            const OC = process.env.LAW_API_ID;
            const url = `http://www.law.go.kr/DRF/lawSearch.do?OC=${OC}&target=ntsCgmExpc&type=JSON&query=${encodeURIComponent(query)}&display=5`;

            const response = await axios.get(url);
            const data = response.data;

            if (!data.LawSearch || !data.LawSearch.item) {
                return '검색된 관련 법령해석 사례가 없습니다.';
            }

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

const askAi = async (req, res) => {
    const { question } = req.body;

    // 💡 수정 포인트: req.user -> req.authUser
    if (!req.authUser || !req.authUser.id) {
        return res.status(401).json({ error: '인증 정보가 없습니다. 다시 로그인해주세요.' });
    }

    const userId = req.authUser.id;

    try {
        // 최근 대화 맥락 유지 (5개)
        const [rows] = await db.execute(
            'SELECT role, content FROM AI_History WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
            [userId],
        );
        const history = rows.reverse().map((r) => (r.role === 'user' ? ['human', r.content] : ['ai', r.content]));

        const llm = new ChatOpenAI({
            modelName: 'gpt-4o',
            temperature: 0.1,
            apiKey: process.env.OPENAI_API_KEY,
        });

        const tools = [taxLawSearchTool];
        const prompt = ChatPromptTemplate.fromMessages([
            [
                'system',
                '당신은 대한민국 국세청 데이터를 기반으로 하는 전문 세무사입니다. 제공된 도구를 사용하여 정확한 법령해석 사례를 근거로 답변하세요.',
            ],
            ...history,
            ['human', '{input}'],
            new MessagesPlaceholder('agent_scratchpad'),
        ]);

        const agent = await createOpenAIFunctionsAgent({ llm, tools, prompt });
        const agentExecutor = new AgentExecutor({ agent, tools });

        const result = await agentExecutor.invoke({ input: question });

        // DB 기록 저장
        await db.execute("INSERT INTO AI_History (user_id, role, content) VALUES (?, 'user', ?)", [userId, question]);
        await db.execute("INSERT INTO AI_History (user_id, role, content) VALUES (?, 'assistant', ?)", [
            userId,
            result.output,
        ]);

        res.json({ answer: result.output });
    } catch (error) {
        console.error('AI 상담 중 에러 발생:', error);
        res.status(500).json({ error: '상담 처리 중 오류 발생' });
    }
};

const getHistory = async (req, res) => {
    // 💡 수정 포인트: req.user -> req.authUser
    if (!req.authUser || !req.authUser.id) {
        return res.status(401).json({ error: '인증 정보가 없습니다.' });
    }

    const userId = req.authUser.id;
    try {
        const [rows] = await db.execute(
            'SELECT role, content FROM AI_History WHERE user_id = ? ORDER BY created_at ASC',
            [userId],
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: '기록 조회 실패' });
    }
};

module.exports = { askAi, getHistory };
