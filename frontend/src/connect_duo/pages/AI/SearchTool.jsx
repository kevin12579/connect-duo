import React, { useState, useEffect, useRef } from 'react';
import { getAiHistory, postAskAi } from '../../api/axios';
import './SearchTool.css';

// ✅ 내 프로필 아이콘(요구: ai-profile 32px)
import myAvatarImg from '../../assets/ai-profile.png';

// ✅ AI 프로필 아이콘(요구: 사진 넣기, 32px)
import aiAvatarImg from '../../assets/ai-bot.png';

export default function SearchTool({ initialQuery, setChatQuery, isOpen, onToggleLock }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
    const scrollRef = useRef();

    // ✅ 토글 열리면: 위 검색창 잠금 / 닫히면 해제
    useEffect(() => {
        if (typeof onToggleLock === 'function') {
            onToggleLock(!!isOpen);
        }
    }, [isOpen, onToggleLock]);

    // 1) 대화 기록 로드
    useEffect(() => {
        let isMounted = true;

        const fetchHistory = async () => {
            try {
                const data = await getAiHistory();
                if (isMounted) setMessages(data);
            } catch (err) {
                console.error('기록 로드 실패', err);
            } finally {
                if (isMounted) setIsHistoryLoaded(true);
            }
        };

        fetchHistory();
        return () => {
            isMounted = false;
        };
    }, []);

    // 2) 메인페이지 검색어 감지 → 질문 발송 (기록 로딩 끝난 후만)
    useEffect(() => {
        if (isHistoryLoaded && initialQuery && initialQuery.trim() !== '') {
            const queryToProcess = initialQuery;

            // ✅ 무한루프 방지: 부모 query 초기화
            if (setChatQuery) setChatQuery('');

            handleSend(null, queryToProcess);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHistoryLoaded, initialQuery, setChatQuery]);

    // 3) 자동 스크롤
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const handleSend = async (e, directInput = null) => {
        if (e) e.preventDefault();
        const query = directInput || input;
        if (!query.trim() || loading) return;

        const userMsg = { role: 'user', content: query };
        setMessages((prev) => [...prev, userMsg]);

        if (!directInput) setInput('');
        setLoading(true);

        try {
            const res = await postAskAi(query);
            const aiMsg = { role: 'assistant', content: res.answer };
            setMessages((prev) => [...prev, aiMsg]);
        } catch (err) {
            console.error(err);
            setMessages((prev) => [...prev, { role: 'assistant', content: '오류가 발생했습니다. 다시 시도해주세요.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`search-tool-inner ${isOpen ? 'is-open' : ''}`}>
            <div className="chat-window" ref={scrollRef}>
                {messages.length === 0 && !loading && (
                    <div className="empty-chat">
                        <p>전문 세무 AI 비서가 국세청 법령을 기반으로 답변해 드립니다.</p>
                        <span>궁금한 세무 지식을 아래에 입력해 보세요.</span>
                    </div>
                )}

                {messages.map((m, i) => (
                    <div key={i} className={`message-bubble ${m.role}`}>
                        <div className="avatar" aria-hidden>
                            {m.role === 'user' ? (
                                <img className="avatar-img" src={myAvatarImg} alt="내 프로필" />
                            ) : (
                                <img className="avatar-img" src={aiAvatarImg} alt="AI 프로필" />
                            )}
                        </div>

                        <div className="content-wrapper">
                            <div className="sender">{m.role === 'user' ? '나' : '전문 세무비서'}</div>
                            <div className="text">{m.content}</div>
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="message-bubble assistant loading">
                        <div className="avatar" aria-hidden>
                            <img className="avatar-img" src={aiAvatarImg} alt="AI 프로필" />
                        </div>
                        <div className="content-wrapper">
                            <div className="sender">전문 세무비서</div>
                            <div className="text">분석 중...</div>
                        </div>
                    </div>
                )}
            </div>

            <form className="chat-input-area" onSubmit={handleSend}>
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="질문을 입력하세요"
                    disabled={loading}
                />
                <button type="submit" disabled={loading || !input.trim()}>
                    전송
                </button>
            </form>
        </div>
    );
}