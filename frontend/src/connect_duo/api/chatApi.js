// src/api/chatApi.js
// ✅ Connect-Duo Chat API (single source of truth)
const API_BASE = process.env.REACT_APP_API_BASE || process.env.REACT_APP_CHAT_API_BASE || 'http://localhost:4000';
console.log('✅ API_BASE =', API_BASE);

// ===== localStorage keys =====
const ROOMS_KEY = 'chat_rooms';
const LAST_READ_KEY = (rid) => `chat_lastRead_${rid}`;

// ===== helpers =====
async function request(path, { method = 'GET', headers, body } = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(headers || {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
    });

    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }

    if (!res.ok) {
        const msg = (data && data.message) || (typeof data === 'string' ? data : '') || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

function pick(obj, ...keys) {
    for (const k of keys) {
        const v = obj?.[k];
        if (v !== undefined && v !== null) return v;
    }
    return undefined;
}

function normalizeTimeMs(m) {
    const t = pick(m, 'created_at', 'createdAt', 'time', 'timestamp', 'sentAt');
    const d = t ? new Date(t) : new Date();
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : Date.now();
}

function normalizeMessage(m) {
    const id = pick(m, 'id', '_id', 'messageId') ?? `${normalizeTimeMs(m)}_${Math.random()}`;
    const fromRaw = pick(m, 'from', 'sender', 'role', 'author') ?? 'agent';
    const text = pick(m, 'text', 'content', 'message') ?? '';
    const typeRaw = pick(m, 'type') ?? 'text';

    // ✅ 서버 응답(backend/server.js)이 주는 fileName/fileUrl 보존
    const fileUrl = pick(m, 'fileUrl', 'file_url', 'url', 'downloadUrl') ?? null;
    const fileName = pick(m, 'fileName', 'file_name', 'originalName', 'originalname', 'name') ?? null;

    const files = pick(m, 'files', 'attachments', 'attachments') ?? [];

    return {
        id,
        from: fromRaw, // 'me' | 'agent' | 'system'
        text,
        type: String(typeRaw).toUpperCase(), // TEXT / FILE
        fileUrl, // ✅ 추가
        fileName, // ✅ 추가
        files,
        time: new Date(normalizeTimeMs(m)).toISOString(),
        read: pick(m, 'read', 'isRead') ?? undefined,
    };
}

function normalizeMessages(payload) {
    if (Array.isArray(payload)) return payload.map(normalizeMessage);
    if (payload && Array.isArray(payload.items)) return payload.items.map(normalizeMessage);
    if (payload && Array.isArray(payload.messages)) return payload.messages.map(normalizeMessage);
    if (payload && Array.isArray(payload.data)) return payload.data.map(normalizeMessage);
    return [];
}

function safeParse(raw, fallback) {
    try {
        const v = raw ? JSON.parse(raw) : fallback;
        return v ?? fallback;
    } catch {
        return fallback;
    }
}

function loadLastReadAt(rid) {
    const raw = localStorage.getItem(LAST_READ_KEY(rid));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
}

function saveLastReadAt(rid, ms) {
    localStorage.setItem(LAST_READ_KEY(rid), String(ms));
}

function computeUnreadCountFallback(rid, messages) {
    const lastReadAt = loadLastReadAt(rid);
    return messages.filter((m) => {
        const ms = new Date(m.time).getTime();
        const from = m.from;
        if (from === 'me') return false;
        if (from === 'system') return false;
        return ms > lastReadAt;
    }).length;
}

// ==============================
// ✅ Rooms
// ==============================
export async function fetchRooms() {
    try {
        const data = await request(`/api/chat/rooms`);
        const rooms = Array.isArray(data) ? data : data?.items || data?.rooms || [];
        return rooms.map((r) => ({
            id: pick(r, 'id', '_id', 'roomId'),
            title: pick(r, 'title', 'name') ?? '세무쳇',
            updatedAt: pick(r, 'updatedAt', 'updated_at', 'lastMessageAt') ?? null,
            lastMessage: pick(r, 'lastMessage', 'last_message', 'preview') ?? '',
            unread_count: pick(r, 'unread_count', 'unreadCount') ?? undefined,
            raw: r,
        }));
    } catch {
        const rooms = safeParse(localStorage.getItem(ROOMS_KEY), []);
        return (Array.isArray(rooms) ? rooms : []).map((r) => ({
            id: r?.id,
            title: r?.title ?? '세무쳇',
            updatedAt: r?.updatedAt ?? null,
            lastMessage: r?.lastMessage ?? '',
            unread_count: r?.unread_count ?? 0,
            raw: r,
        }));
    }
}

export function upsertRoomCache(room) {
    const rooms = safeParse(localStorage.getItem(ROOMS_KEY), []);
    const list = Array.isArray(rooms) ? rooms : [];
    const idx = list.findIndex((x) => x?.id === room?.id);
    const next = {
        id: room?.id,
        title: room?.title ?? '세무쳇',
        updatedAt: room?.updatedAt ?? Date.now(),
        lastMessage: room?.lastMessage ?? '',
        unread_count: room?.unread_count ?? 0,
    };
    if (idx >= 0) list[idx] = { ...list[idx], ...next };
    else list.unshift(next);
    localStorage.setItem(ROOMS_KEY, JSON.stringify(list));
    return list;
}

// ==============================
// ✅ Messages
// ==============================
export async function fetchMessages(roomId, { limit = 50, before } = {}) {
    const qs = new URLSearchParams();
    if (limit) qs.set('limit', String(limit));
    if (before) qs.set('before', String(before));
    const q = qs.toString() ? `?${qs.toString()}` : '';

    const data = await request(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages${q}`);
    return normalizeMessages(data); // ✅ 배열 리턴
}

export async function sendTextMessage(roomId, text) {
    const data = await request(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages`, {
        method: 'POST',
        body: { type: 'text', text },
    });

    if (data && (data.id || data._id || data.messageId || data.text || data.content)) {
        return normalizeMessage(data);
    }

    return normalizeMessage({
        id: `${Date.now()}_${Math.random()}`,
        from: 'me',
        text,
        createdAt: new Date().toISOString(),
    });
}

// ✅ 핵심 수정: files 정규화
function normalizeFilesInput(files) {
    if (!files) return [];
    if (Array.isArray(files)) return files;
    if (files instanceof FileList) return Array.from(files);
    // 단일 File
    if (files instanceof File) return [files];
    return [];
}

export async function uploadRoomFiles(roomId, files = []) {
    const list = normalizeFilesInput(files);
    if (list.length === 0) return null;

    const form = new FormData();
    list.forEach((f) => form.append('files', f));

    const res = await fetch(`${API_BASE}/api/chat/rooms/${encodeURIComponent(roomId)}/files`, {
        method: 'POST',
        body: form,
        credentials: 'include',
    });

    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }

    if (!res.ok) {
        throw new Error((data && data.message) || `HTTP ${res.status}`);
    }

    if (data && (data.id || data._id || data.messageId)) return normalizeMessage(data);
    return data;
}

// ==============================
// ✅ Read / Unread
// ==============================
export async function markRoomRead(roomId, { readAt = Date.now() } = {}) {
    saveLastReadAt(roomId, readAt);

    try {
        await request(`/api/chat/rooms/${encodeURIComponent(roomId)}/read`, {
            method: 'POST',
            body: { readAt },
        });
        return { ok: true, readAt, source: 'server' };
    } catch (e) {
        return { ok: true, readAt, source: 'local-fallback', error: e?.message };
    }
}

export async function getUnreadCount(roomId, { messagesIfAlreadyHave } = {}) {
    try {
        const msgs = messagesIfAlreadyHave || (await fetchMessages(roomId, { limit: 200 }));
        return computeUnreadCountFallback(roomId, msgs);
    } catch {
        return 0;
    }
}

export async function pingChatServer() {
    try {
        const data = await request(`/api/health`);
        return data;
    } catch {
        return { ok: false };
    }
}

export const CHAT_MESSAGE_EVENT = 'chat_message_event';
