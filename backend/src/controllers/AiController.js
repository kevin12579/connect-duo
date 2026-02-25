// controllers/AiController.js
const { ChatOpenAI } = require('@langchain/openai');
const { DynamicTool } = require('@langchain/core/tools');
const { AgentExecutor, createOpenAIFunctionsAgent } = require('langchain/agents');
const { ChatPromptTemplate, MessagesPlaceholder } = require('@langchain/core/prompts');
const axios = require('axios');
const xml2js = require('xml2js'); // XML 변환용
const db = require('../config/db'); // 귀하의 DB 설정 파일

// 1. 국가법령정보 API 도구
const lawSearchTool = new DynamicTool({
    name: 'national_law_search',
    description: '대한민국 법령, 판례, 세무 관련 법규를 검색합니다. 입력은 검색어입니다.',
    func: async (query) => {
        try {
            const OC = process.env.LAW_API_ID; // 발급받은 ID
            const url = `https://www.law.go.kr/DRF/lawSearch.do?OC=${OC}&target=law&type=XML&query=${encodeURIComponent(query)}`;
            const response = await axios.get(url);
            const parser = new xml2js.Parser({ explicitArray: false });
            const result = await parser.parseStringPromise(response.data);
            // 요약된 정보 반환
            return JSON.stringify(result.LawSearch.law || '검색 결과가 없습니다.');
        } catch (e) {
            return '법령 검색 중 오류가 발생했습니다.';
        }
    },
});

// 2. 세금 계산기 도구 (단순 수식 계산)
const taxCalculatorTool = new DynamicTool({
    name: 'tax_calculator',
    description: '세금이나 숫자를 계산합니다. 예: 1000000 * 0.1',
    func: async (expression) => {
        try {
            // 주의: 실제 서비스에서는 mathjs 같은 라이브러리 사용 권장
            return String(eval(expression.replace(/[^-()\d/*+.]/g, '')));
        } catch (e) {
            return '계산기 실행 오류';
        }
    },
});

const askAi = async (req, res) => {
    const { question } = req.body;
    const userId = req.user.id; // 인증 미들웨어에서 가져온 정보

    try {
        // 이전 대화 기록 가져오기 (최근 5개)
        const [historyRows] = await db.execute(
            'SELECT role, content FROM AI_History WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
            [userId],
        );
        const pastMessages = historyRows.reverse().map((row) => row.content);

        const llm = new ChatOpenAI({
            modelName: 'gpt-4o',
            temperature: 0,
            apiKey: process.env.OPENAI_API_KEY,
        });

        const tools = [lawSearchTool, taxCalculatorTool];
        // Tavily가 필요하면 @langchain/community의 TavilySearchResults 추가 가능

        const prompt = ChatPromptTemplate.fromMessages([
            ['system', '당신은 전문 세무사 AI입니다. 법령을 검색하고 정확한 계산을 제공하세요.'],
            ['human', '{input}'],
            new MessagesPlaceholder('agent_scratchpad'),
        ]);

        const agent = await createOpenAIFunctionsAgent({ llm, tools, prompt });
        const agentExecutor = new AgentExecutor({ agent, tools });

        const result = await agentExecutor.invoke({ input: question });

        // DB 저장
        await db.execute("INSERT INTO AI_History (user_id, role, content) VALUES (?, 'user', ?)", [userId, question]);
        await db.execute("INSERT INTO AI_History (user_id, role, content) VALUES (?, 'assistant', ?)", [
            userId,
            result.output,
        ]);

        res.json({ answer: result.output });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'AI 처리 중 오류 발생' });
    }
};

const getHistory = async (req, res) => {
    const userId = req.user.id;
    const [rows] = await db.execute('SELECT * FROM AI_History WHERE user_id = ? ORDER BY created_at ASC', [userId]);
    res.json(rows);
};

module.exports = { askAi, getHistory };
