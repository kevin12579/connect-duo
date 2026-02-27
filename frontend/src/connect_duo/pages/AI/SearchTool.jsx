import React, { useState, useEffect, useRef } from 'react';
import { getAiHistory, postAskAi } from '../../api/axios';
import './SearchTool.css';

export default function SearchTool({ initialQuery, setChatQuery, isOpen }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    // 💡 핵심 추가: 과거 대화 기록이 다 불러와졌는지 확인하는 상태
    const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
    const scrollRef = useRef();

    // 1. 대화 기록 로드 (마운트 될 때 한 번만 실행)
    useEffect(() => {
        let isMounted = true;
        const fetchHistory = async () => {
            try {
                const data = await getAiHistory();
                if (isMounted) setMessages(data);
            } catch (err) {
                console.error('기록 로드 실패', err);
            } finally {
                if (isMounted) setIsHistoryLoaded(true); // 기록 로딩 완료 표시
            }
        };
        fetchHistory();

        return () => {
            isMounted = false;
        };
    }, []);

    // 2. 메인페이지 검색어 감지하여 질문 발송 (기록 로딩이 끝난 후에만 실행!)
    useEffect(() => {
        // 기록을 다 불러왔고, 넘겨받은 질문이 있을 때만 실행 (덮어쓰기 방지)
        if (isHistoryLoaded && initialQuery && initialQuery.trim() !== '') {
            const queryToProcess = initialQuery;

            // 💡 무한 루프(DB 도배) 방지를 위해 부모의 쿼리를 즉시 초기화!
            if (setChatQuery) setChatQuery('');

            // 질문 전송
            handleSend(null, queryToProcess);
        }
    }, [isHistoryLoaded, initialQuery, setChatQuery]);

    // 3. 자동 스크롤
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const handleSend = async (e, directInput = null) => {
        if (e) e.preventDefault();
        const query = directInput || input;
        if (!query.trim() || loading) return;

        // 1. 내 메시지를 즉시 화면에 추가 (이제 덮어써지지 않습니다!)
        const userMsg = { role: 'user', content: query };
        setMessages((prev) => [...prev, userMsg]);

        if (!directInput) setInput('');
        setLoading(true);

        try {
            const res = await postAskAi(query);
            const aiMsg = { role: 'assistant', content: res.answer };
            // 2. AI 답변 추가
            setMessages((prev) => [...prev, aiMsg]);
        } catch (err) {
            console.error(err);
            setMessages((prev) => [...prev, { role: 'assistant', content: '오류가 발생했습니다. 다시 시도해주세요.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="search-tool-inner">
            <div className="chat-window" ref={scrollRef}>
                {messages.length === 0 && !loading && (
                    <div className="empty-chat">
                        <p>전문 세무 AI 비서가 국세청 법령을 기반으로 답변해 드립니다.</p>
                        <span>궁금한 세무 지식을 아래에 입력해 보세요.</span>
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} className={`message-bubble ${m.role}`}>
                        <div className="avatar">{m.role === 'user' ? '👤' : '⚖️'}</div>
                        <div className="content-wrapper">
                            <div className="sender">{m.role === 'user' ? '나' : '전문 세무비서'}</div>
                            <div className="text">{m.content}</div>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="message-bubble assistant loading">
                        <div className="avatar">⚖️</div>
                        <div className="text">분석 중...</div>
                    </div>
                )}
            </div>

            <form className="chat-input-area" onSubmit={handleSend}>
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="추가 질문을 입력하세요..."
                    disabled={loading}
                />
                <button type="submit" disabled={loading || !input.trim()}>
                    전송
                </button>
            </form>
        </div>
    );
}
