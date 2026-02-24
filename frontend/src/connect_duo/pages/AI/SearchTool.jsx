import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './SearchTool.css'; // 스타일은 별도 정의

export default function SearchTool() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef();

    // 1. 대화 기록 불러오기
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await axios.get('/api/ai/history'); // 백엔드 경로
                setMessages(res.data);
            } catch (err) {
                console.error('기록 로드 실패', err);
            }
        };
        fetchHistory();
    }, []);

    // 스크롤 하단 이동
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = { role: 'user', content: input };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await axios.post('/api/ai/ask', { question: input });
            const aiMsg = { role: 'assistant', content: res.data.answer };
            setMessages((prev) => [...prev, aiMsg]);
        } catch (err) {
            alert('답변을 가져오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="chat-container">
            <div className="chat-window" ref={scrollRef}>
                {messages.map((m, i) => (
                    <div key={i} className={`message-bubble ${m.role}`}>
                        <div className="avatar">{m.role === 'user' ? '나' : '세무AI'}</div>
                        <div className="text">{m.content}</div>
                    </div>
                ))}
                {loading && <div className="loading">세무사가 분석 중입니다...</div>}
            </div>

            <form className="chat-input-area" onSubmit={handleSend}>
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="세금 관련 궁금한 점을 물어보세요..."
                    disabled={loading}
                />
                <button type="submit" disabled={loading}>
                    전송
                </button>
            </form>
        </div>
    );
}
