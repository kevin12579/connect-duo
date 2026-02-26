import { FaqData } from './FaqData';
import { useState } from 'react';

export default function FaqList({ onQuestionClick }) {
    const [openId, setOpenId] = useState(null);

    return (
        <div>
            <h2>자주 묻는 질문</h2>
            {FaqData.map((item) => (
                <div key={item.id}>
                    <h4
                        style={{ cursor: 'pointer', color: '#6366f1' }}
                        onClick={() => {
                            setOpenId(item.id);
                            if (onQuestionClick) onQuestionClick(item.question);
                        }}
                    >
                        {item.question}
                    </h4>
                    {openId === item.id && <p style={{ whiteSpace: 'pre-line' }}>{item.answer}</p>}
                </div>
            ))}
        </div>
    );
}
