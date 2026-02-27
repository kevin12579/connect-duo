import React from 'react';

export default function UserAvatar({ avatarUrl, name, size = 54, bg = '#6ea8ff' }) {
    return avatarUrl ? (
        <img
            src={avatarUrl}
            alt={name || '사용자'}
            className="avatar-img"
            style={{
                width: size,
                height: size,
                borderRadius: '50%',
                objectFit: 'cover',
                background: '#fff',
            }}
        />
    ) : (
        <div
            className="avatar-fallback"
            style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '900',
                fontSize: size / 2,
                color: '#fff',
            }}
        >
            {(name || 'U').charAt(0)}
        </div>
    );
}
