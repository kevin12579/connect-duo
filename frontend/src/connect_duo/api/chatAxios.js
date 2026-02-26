import { axiosAuth } from './axios';

// 파일 URL 절대경로 변환
export const absolutizeFileUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `http://localhost:7777${url.startsWith('/') ? url : `/${url}`}`;
};

export const listRooms = () => axiosAuth.get('/chat/rooms').then((r) => r.data);
export const createRoom = (taxId) => axiosAuth.post('/chat/rooms', { taxId }).then((r) => r.data);
export const listMessages = (roomId, params) =>
    axiosAuth.get(`/chat/rooms/${roomId}/messages`, { params }).then((r) => r.data);
export const sendMessage = (roomId, content) =>
    axiosAuth.post(`/chat/rooms/${roomId}/messages`, { content }).then((r) => r.data);
export const markRead = (roomId) => axiosAuth.post(`/chat/rooms/${roomId}/read`).then((r) => r.data);
export const closeRoom = (roomId) => axiosAuth.post(`/chat/rooms/${roomId}/close`).then((r) => r.data);
export const deleteRoom = (roomId) => axiosAuth.delete(`/chat/rooms/${roomId}`).then((r) => r.data);
// 파일 업로드 (FormData 처리)
export const uploadRoomFiles = (roomId, files) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    return axiosAuth
        .post(`/chat/rooms/${roomId}/upload`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data);
};
