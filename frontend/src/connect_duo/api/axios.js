// src/api/axios.js
import axios from 'axios';
import { checkTokenExpiration, refreshAccessToken } from '../utils/authUtils';
import { initSocket, disconnectSocket } from './chatAxios';

const BASE_URL = `http://192.168.0.8:7777/api/`;

// [1] 인증 불필요 (회원가입, 로그인 등)
export const axiosBase = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

// [2] 인증 필요 (채팅, 프로필 등)
export const axiosAuth = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

// ─── 요청 인터셉터 ───────────────────────────────────────────────────
axiosAuth.interceptors.request.use(
    async (config) => {
        let accessToken = sessionStorage.getItem('accessToken');

        if (accessToken) {
            if (checkTokenExpiration(accessToken)) {
                console.log('[Auth] 토큰 만료 → 리프레시 시도...');
                const newAccessToken = await refreshAccessToken();

                if (newAccessToken) {
                    sessionStorage.setItem('accessToken', newAccessToken);
                    accessToken = newAccessToken;
                } else {
                    // 리프레시 실패 → 강제 로그아웃
                    sessionStorage.clear();
                    localStorage.removeItem('refreshToken');
                    disconnectSocket(); // ✅ 소켓도 함께 종료
                    window.location.href = '/login';
                    return Promise.reject('Refresh failed');
                }
            }
            config.headers['Authorization'] = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error),
);

// ─── 응답 인터셉터 ───────────────────────────────────────────────────
axiosAuth.interceptors.response.use(
    (res) => res,
    async (err) => {
        const { config, response: { status } = {} } = err;

        if (status === 401) {
            const newAccessToken = await refreshAccessToken();
            if (newAccessToken) {
                sessionStorage.setItem('accessToken', newAccessToken);
                config.headers['Authorization'] = `Bearer ${newAccessToken}`;
                return axiosAuth(config);
            }
        }

        if (status === 403) alert('접근 권한이 없습니다.');
        return Promise.reject(err);
    },
);

// ─── API 함수들 ──────────────────────────────────────────────────────

export const postUserIdCheck = (data) => axiosBase.post('/accounts/signup/check-id/', data).then((r) => r.data);

export const postCompanyRegistrationNumberCheck = (data) =>
    axiosBase.post('/accounts/signup/check-company/', data).then((r) => r.data);

export const postSignUpUser = (data) =>
    axiosBase.post('/accounts/signup', { ...data, user_type: 'USER' }).then((r) => r.data);

export const postSignUpTaxAccountant = (data) =>
    axiosBase.post('/accounts/signup', { ...data, user_type: 'TAX_ACCOUNTANT' }).then((r) => r.data);

/**
 * ✅ 로그인 후 소켓 자동 초기화
 * 로그인 성공 시 accessToken으로 즉시 Socket.io 연결을 맺습니다.
 */
export const postLogin = async (data) => {
    const res = await axiosBase.post('/accounts/login/', data);
    const { accessToken, refreshToken } = res.data;

    sessionStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    // ✅ 핵심: 로그인 직후 소켓 연결 초기화
    initSocket(accessToken);

    return res.data;
};

export const getUserProfile = async (userId) => {
    const res = await axiosBase.post(`/profile/usercomment`, { id: userId });
    return res.data;
};

export const updateUserProfile = async (userId, data) => {
    const res = await axiosBase.put(`/profile/update`, { id: userId, ...data });
    return res.data;
};

export const deleteUserAccount = async (userId) => {
    const res = await axiosBase.delete(`/profile/delete/${userId}`);
    return res.data;
};

export const getTaxProProfile = async (taxProId, viewerId = null) => {
    const id = typeof taxProId === 'object' && taxProId !== null ? taxProId.taxProId : taxProId;
    const res = await axiosBase.post(`/profile/taxpro`, { id, viewerId });
    return res.data;
};

export const createReview = async (data) => axiosAuth.post(`/profile/review`, data).then((res) => res.data);

export const deleteReview = async (reviewId, userId) =>
    axiosAuth.post(`/profile/review/delete`, { reviewId, userId }).then((res) => res.data);

export const toggleRecommend = async (reviewId, is_recommend) =>
    axiosAuth.post(`/profile/review/recommend`, { reviewId, is_recommend }).then((res) => res.data);

export const rateReview = async (reviewId, rating) =>
    axiosAuth.post(`/profile/review/rate`, { reviewId, rating }).then((res) => res.data);

export const requestConsult = async (user_id, tax_id) =>
    axiosAuth.post(`/profile/consult/request`, { user_id, tax_id }).then((res) => res.data);

export const acceptConsult = async (requestId) =>
    axiosAuth.post(`/profile/consult/accept`, { requestId }).then((res) => res.data);

export const rejectConsult = async (requestId) =>
    axiosAuth.post(`/profile/consult/reject`, { requestId }).then((res) => res.data);

export const getTaxProRanking = async () => {
    const res = await axiosBase.get(`/profile/ranking`);
    return res.data;
};

export const getAiHistory = () => axiosAuth.get('/ai/history').then((r) => r.data);

export const postAskAi = (question) => axiosAuth.post('/ai/ask', { question }).then((r) => r.data);

export const deleteAiHistory = () => axiosAuth.delete('/ai/history').then((r) => r.data);
