// src/api/axios.js
import axios from 'axios';
import { checkTokenExpiration, refreshAccessToken } from '../utils/authUtils';
import { initSocket, disconnectSocket } from './chatAxios';
const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:7777';
const BASE_URL = `${SOCKET_URL}/api/`;

// [1] 인증 불필요
export const axiosBase = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

// [2] 인증 필요
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
                const newAccessToken = await refreshAccessToken();
                if (newAccessToken) {
                    sessionStorage.setItem('accessToken', newAccessToken);
                    accessToken = newAccessToken;
                } else {
                    sessionStorage.clear();
                    localStorage.removeItem('refreshToken');
                    disconnectSocket();
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

// ─── 인증/프로필 API ──────────────────────────────────────────────────────────

export const postUserIdCheck = (data) => axiosBase.post('/accounts/signup/check-id/', data).then((r) => r.data);

export const postCompanyRegistrationNumberCheck = (data) =>
    axiosBase.post('/accounts/signup/check-company/', data).then((r) => r.data);

export const postSignUpUser = (data) =>
    axiosBase.post('/accounts/signup', { ...data, user_type: 'USER' }).then((r) => r.data);

export const postSignUpTaxAccountant = (data) =>
    axiosBase.post('/accounts/signup', { ...data, user_type: 'TAX_ACCOUNTANT' }).then((r) => r.data);

export const postLogin = async (data) => {
    const res = await axiosBase.post('/accounts/login/', data);
    const { accessToken, refreshToken } = res.data;
    sessionStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    initSocket(accessToken);
    return res.data;
};

export const getUserProfile = async (userId) => {
    const res = await axiosBase.post('/profile/usercomment', { id: userId });
    return res.data;
};

export const updateUserProfile = async (userId, data) => {
    const res = await axiosBase.put('/profile/update', { id: userId, ...data });
    return res.data;
};

export const deleteUserAccount = async (userId) => {
    const res = await axiosBase.delete(`/profile/delete/${userId}`);
    return res.data;
};

export const getTaxProProfile = async (taxProId, viewerId = null) => {
    const id = typeof taxProId === 'object' && taxProId !== null ? taxProId.taxProId : taxProId;
    const res = await axiosBase.post('/profile/taxpro', { id, viewerId });
    return res.data;
};

export const createReview = async (data) => axiosAuth.post('/profile/review', data).then((res) => res.data);
export const deleteReview = async (reviewId, userId) =>
    axiosAuth.post('/profile/review/delete', { reviewId, userId }).then((res) => res.data);
export const toggleRecommend = async (reviewId, is_recommend) =>
    axiosAuth.post('/profile/review/recommend', { reviewId, is_recommend }).then((res) => res.data);
export const rateReview = async (reviewId, rating) =>
    axiosAuth.post('/profile/review/rate', { reviewId, rating }).then((res) => res.data);

export const requestConsult = async (user_id, tax_id) =>
    axiosAuth.post('/profile/consult/request', { user_id, tax_id }).then((res) => res.data);
export const acceptConsult = async (requestId) =>
    axiosAuth.post('/profile/consult/accept', { requestId }).then((res) => res.data);
export const rejectConsult = async (requestId) =>
    axiosAuth.post('/profile/consult/reject', { requestId }).then((res) => res.data);

export const getTaxProRanking = async () => {
    const res = await axiosBase.get('/profile/ranking');
    return res.data;
};

export const getAiHistory = () => axiosAuth.get('/ai/history').then((r) => r.data);
export const postAskAi = (question) => axiosAuth.post('/ai/ask', { question }).then((r) => r.data);
export const deleteAiHistory = () => axiosAuth.delete('/ai/history').then((r) => r.data);

// ─── 크레딧 API ───────────────────────────────────────────────────────────────

/** 크레딧 잔액 조회 */
export const getCredit = async (userId) => {
    const res = await axiosAuth.get(`/credit/balance/${userId}`);
    return res.data;
};

/** 크레딧 충전 (구매) */
export const chargeCredit = async (user_id, amount, description) => {
    const res = await axiosAuth.post('/credit/charge', { user_id, amount, description });
    return res.data;
};

/** 크레딧 차감 (상품 구매 시) */
export const deductCredit = async (user_id, amount, description) => {
    const res = await axiosAuth.post('/credit/deduct', { user_id, amount, description });
    return res.data;
};

/** 크레딧 수동 수정 (관리자) */
export const updateCredit = async (user_id, credit, description) => {
    const res = await axiosAuth.put('/credit/update', { user_id, credit, description });
    return res.data;
};

/** 크레딧 전액 초기화 */
export const deleteCredit = async (userId) => {
    const res = await axiosAuth.delete(`/credit/reset/${userId}`);
    return res.data;
};

/** 크레딧 거래 내역 조회 */
export const getCreditHistory = async (userId) => {
    const res = await axiosAuth.get(`/credit/history/${userId}`);
    return res.data;
};

/** 광고 구매 (크레딧 차감) */
export const purchaseAd = async (user_id, days) => {
    const res = await axiosAuth.post('/profile/ad/purchase', { user_id, days });
    return res.data;
};

/** 광고 취소 */
export const cancelAd = async (user_id) => {
    const res = await axiosAuth.post('/profile/ad/cancel', { user_id });
    return res.data;
};
