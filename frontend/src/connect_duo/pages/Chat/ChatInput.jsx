import React from 'react';

export default function ChatInput({ value, onChange, onSend }) {
    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend?.();
        }
    };

    return (
        <div style={styles.inputBar}>
            <textarea
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="메시지를 입력하세요 (Enter 전송 / Shift+Enter 줄바꿈)"
                style={styles.textarea}
                rows={1}
            />
            <button onClick={onSend} style={styles.sendBtn}>
                전송
            </button>
        </div>
    );
}

const styles = {
    inputBar: {
        padding: 12,
        display: 'flex',
        gap: 10,
        background: '#111827',
        borderTop: '1px solid rgba(255,255,255,0.08)',
    },
    textarea: {
        flex: 1,
        resize: 'none',
        borderRadius: 14,
        padding: '10px 12px',
        border: '1px solid rgba(255,255,255,0.14)',
        background: 'rgba(255,255,255,0.06)',
        color: '#e2e8f0',
        outline: 'none',
        fontSize: 14,
    },
    sendBtn: {
        border: 'none',
        background: 'rgba(99,102,241,0.85)',
        color: 'white',
        padding: '10px 14px',
        borderRadius: 14,
        cursor: 'pointer',
        fontWeight: 700,
    },
};
