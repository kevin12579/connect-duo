import React from 'react';

export default function MessageBubble({ msg, formatTime }) {
    const isMe = msg.from === 'me';
    const isSystem = msg.from === 'system';
    const whoLabel = isSystem ? '안내' : isMe ? '나' : '세무사';

    const rowStyle = {
        ...styles.bubbleRow,
        justifyContent: isSystem ? 'center' : isMe ? 'flex-end' : 'flex-start',
    };

    const bubbleStyle = {
        ...styles.bubble,
        ...(isSystem ? styles.systemBubble : isMe ? styles.meBubble : styles.agentBubble),
    };

    return (
        <div style={rowStyle}>
            <div style={bubbleStyle}>
                {!isSystem && <div style={styles.who}>{whoLabel}</div>}
                <div style={styles.text}>{msg.text}</div>
                <div style={styles.time}>{formatTime(msg.time)}</div>
            </div>
        </div>
    );
}

const styles = {
    bubbleRow: {
        display: 'flex',
        marginBottom: 10,
    },
    bubble: {
        maxWidth: '78%',
        padding: '10px 12px',
        borderRadius: 16,
        boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.08)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
    },
    meBubble: {
        background: 'rgba(99,102,241,0.22)',
        borderTopRightRadius: 6,
    },
    agentBubble: {
        background: 'rgba(255,255,255,0.08)',
        borderTopLeftRadius: 6,
    },
    systemBubble: {
        background: 'rgba(34,197,94,0.16)',
        border: '1px solid rgba(34,197,94,0.25)',
        maxWidth: '90%',
        textAlign: 'center',
    },
    who: { fontSize: 12, opacity: 0.75, marginBottom: 4 },
    text: { fontSize: 14, lineHeight: 1.5 },
    time: { fontSize: 11, opacity: 0.6, marginTop: 6, textAlign: 'right' },
};
