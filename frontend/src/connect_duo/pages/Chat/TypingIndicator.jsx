import React from 'react';

export default function TypingIndicator({ show }) {
    if (!show) return null;

    return (
        <div style={{ ...styles.bubbleRow, justifyContent: 'flex-start' }}>
            <div style={{ ...styles.bubble, ...styles.agentBubble }}>
                <div style={{ fontSize: 13, opacity: 0.85 }}>세무사가 답변을 작성 중…</div>
                <div style={styles.dots}>
                    <span style={styles.dot} />
                    <span style={styles.dot} />
                    <span style={styles.dot} />
                </div>
            </div>
        </div>
    );
}

const styles = {
    bubbleRow: { display: 'flex', marginBottom: 10 },
    bubble: {
        maxWidth: '78%',
        padding: '10px 12px',
        borderRadius: 16,
        boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.08)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
    },
    agentBubble: {
        background: 'rgba(255,255,255,0.08)',
        borderTopLeftRadius: 6,
    },
    dots: { display: 'flex', gap: 4, marginTop: 6 },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.7)',
        display: 'inline-block',
    },
};
