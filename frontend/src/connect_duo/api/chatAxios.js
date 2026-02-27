// src/api/chatAxios.js
import { io } from 'socket.io-client';
import { axiosAuth } from './axios';

const SOCKET_URL = 'http://192.168.0.8:7777';

let socket = null;

/**
 * 소켓 초기화.
 * axios.js의 postLogin()에서 로그인 성공 직후 자동으로 호출됩니다.
 */
export const initSocket = (token) => {
    // 기존 소켓 정리
    if (socket) socket.disconnect();

    socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });

    socket.on('connect', () => console.log(`[Socket] ✅ Connected  : ${socket.id}`));
    socket.on('disconnect', (reason) => console.log(`[Socket] ❌ Disconnected : ${reason}`));
    socket.on('connect_error', (err) => console.error(`[Socket] 🚨 Error : ${err.message}`));

    return socket;
};

/** 현재 소켓 인스턴스 반환 */
export const getSocket = () => socket;

/**
 * ✅ FIX BUG4: 새로고침(F5) 후 socket이 null인 경우 자동 복구
 *
 * ChatRoom, ChatList 컴포넌트에서는 getSocket() 대신 이 함수를 사용하세요.
 * 소켓이 없거나 끊겨있으면 sessionStorage의 accessToken으로 자동 재연결합니다.
 */
export const ensureSocket = () => {
    if (socket && socket.connected) return socket;

    const token = sessionStorage.getItem('accessToken');
    if (!token) {
        console.warn('[Socket] accessToken이 없습니다. 로그인이 필요합니다.');
        return null;
    }

    console.log('[Socket] 소켓 없음 또는 끊김 → 재연결 시도');
    return initSocket(token);
};

/** 소켓 연결 종료 (로그아웃 시 사용) */
export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

// ─── 파일 URL 절대경로 변환 ─────────────────────────────────────────
export const absolutizeFileUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `http://192.168.0.8:7777${url.startsWith('/') ? url : `/${url}`}`;
};

// ─── REST API 함수들 ────────────────────────────────────────────────
export const listRooms = () => axiosAuth.get('/chat/rooms').then((r) => r.data);

export const createRoom = (taxId) => axiosAuth.post('/chat/rooms', { taxId }).then((r) => r.data);

export const listMessages = (roomId, params) =>
    axiosAuth.get(`/chat/rooms/${roomId}/messages`, { params }).then((r) => r.data);

export const sendMessage = (roomId, content) =>
    axiosAuth.post(`/chat/rooms/${roomId}/messages`, { content }).then((r) => r.data);

export const markRead = (roomId) => axiosAuth.post(`/chat/rooms/${roomId}/read`).then((r) => r.data);

export const closeRoom = (roomId) => axiosAuth.post(`/chat/rooms/${roomId}/close`).then((r) => r.data);

export const deleteRoom = (roomId) => axiosAuth.delete(`/chat/rooms/${roomId}`).then((r) => r.data);

export const uploadRoomFiles = (roomId, files) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    return axiosAuth
        .post(`/chat/rooms/${roomId}/upload`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data);
};
