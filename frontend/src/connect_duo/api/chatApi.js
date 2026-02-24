// src/api/chatApi.js
// 채팅 및 상담 관리 API
import { api } from './axios';

function getApiBaseURL() {
    const base = api?.defaults?.baseURL;
    if (base && typeof base === 'string') return base.replace(/\/+$/, '');
    return 'http://localhost:7777';
}

// ✅ 상대경로(/uploads/xxx) -> 절대경로(http://localhost:7777/uploads/xxx)
export function absolutizeFileUrl(url) {
    if (!url) return null;
    const s = String(url);
    if (s.startsWith('http://') || s.startsWith('https://')) return s;

    const base = getApiBaseURL();
    if (s.startsWith('/')) return `${base}${s}`;
    return `${base}/${s}`;
}

// ✅ (선택) ChatRoom이 axios res에서 메시지 배열만 뽑을 때 쓰는 헬퍼
export function extractMessagesFromAxiosResponse(res) {
    const payload = res?.data?.data;
    if (!payload) return [];

    // 백엔드: { messages, nextCursor }
    if (Array.isArray(payload.messages)) return payload.messages;

    // 기타 케이스도 방어
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.items)) return payload.items;
    if (payload.data && Array.isArray(payload.data.messages)) return payload.data.messages;

    return [];
}

// ✅ 방 목록
export const listRooms = () => api.get('/api/chat/rooms');

// ✅ 방 생성
export const createRoom = (payload) => api.post('/api/chat/rooms', payload);

// ✅ 메시지 목록
export const listMessages = (roomId, params) => api.get(`/api/chat/rooms/${roomId}/messages`, { params });

// ✅ 메시지 전송(텍스트)
export const sendMessage = (roomId, payload) => api.post(`/api/chat/rooms/${roomId}/messages`, payload);

// ✅ 읽음 처리
export const markRead = (roomId, payload) => api.post(`/api/chat/rooms/${roomId}/read`, payload);

// ✅ 파일 업로드
export const uploadFiles = (roomId, formData) =>
    api.post(`/api/chat/rooms/${roomId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

// ✅ 방 종료
export const closeRoom = (roomId) => api.post(`/api/chat/rooms/${roomId}/close`);

// ✅ 세무사용 활성 방 목록
export const listTaxActiveRooms = () => api.get('/api/chat/tax/active');

// ✅ 상담사 연결
export const connectRoom = (roomId, taxId = 2) => api.post(`/api/chat/rooms/${roomId}/connect`, { taxId });

// =====================================
// ✅ 레거시(예전 컴포넌트) 호환용 alias
// =====================================
export const fetchRooms = (...args) => listRooms(...args);
export const fetchMessages = (...args) => listMessages(...args);
export const markRoomRead = (roomId, lastReadMessageId) => markRead(roomId, { lastReadMessageId });

export const sendTextMessage = (roomId, text, extra = {}) =>
    sendMessage(roomId, { type: 'TEXT', content: text, ...extra });

export const uploadRoomFiles = (roomId, files) => {
    const fd = new FormData();
    Array.from(files || []).forEach((f) => fd.append('files', f));
    return uploadFiles(roomId, fd);
};