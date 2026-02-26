// src/connect_duo/utils/chat/messageNormalize.js

export function dayKey(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

export function formatDayLabel(ts) {
    const d = new Date(ts);
    const now = new Date();

    const sameDay =
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();

    const y = new Date();
    y.setDate(now.getDate() - 1);

    const yesterday =
        d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate();

    if (sameDay) return '오늘';
    if (yesterday) return '어제';

    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}.${mm}.${dd}`;
}

// ==============================
// ✅ 서버 payload normalize
// ==============================
export function normalizeMessages(payload) {
    // ✅ 너희 mock/axios 스타일 대응(이거 추가해두는 게 안정적)
    if (payload?.data?.data && Array.isArray(payload.data.data)) return payload.data.data;

    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && Array.isArray(payload.messages)) return payload.messages;
    return [];
}

export function pick(obj, ...keys) {
    for (const k of keys) {
        const v = obj?.[k];
        if (v !== undefined && v !== null) return v;
    }
    return undefined;
}

export function normalizeTime(m) {
    return pick(m, 'created_at', 'createdAt', 'createdAtUtc', 'time') || new Date().toISOString();
}

export function normalizeFileUrl(m) {
    return pick(m, 'file_url', 'fileUrl', 'url', 'downloadUrl') || null;
}

export function normalizeFileName(m) {
    return pick(m, 'file_name', 'fileName', 'originalName', 'name') || null;
}

export function normalizeSenderId(m) {
    return pick(m, 'sender_id', 'senderId', 'user_id', 'userId');
}

export function normalizeContent(m) {
    return pick(m, 'content', 'text', 'message') || '';
}

export function normalizeType(m) {
    const t = pick(m, 'type', 'message_type', 'messageType');
    return (t || 'TEXT').toUpperCase();
}

export function normalizeRead(m) {
    const readFlag = pick(m, 'read', 'is_read', 'isRead', 'read_yn', 'readYn');
    const readAt = pick(m, 'read_at', 'readAt', 'readAtUtc');
    return Boolean(readFlag) || Boolean(readAt);
}
