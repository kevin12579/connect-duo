import axios from 'axios';
import { checkTokenExpiration, refreshAccessToken } from '../utils/authUtils';

const BASE_URL = `http://localhost:7777/api/`;

// [1] 일반 요청용 인스턴스 (회원가입, 로그인, 중복체크 등)
export const axiosBase = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

// [2] 인증 필수 요청용 인스턴스 (프로필, 상담, 채팅 등)
const axiosAuth = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

// --- 요청 인터셉터 (인증용) ---
axiosAuth.interceptors.request.use(
    async (config) => {
        let accessToken = sessionStorage.getItem('accessToken');

        if (accessToken) {
            // 토큰 만료 체크 (true면 만료)
            if (checkTokenExpiration(accessToken)) {
                console.log('토큰 만료됨. 리프레시 시도...');
                const newAccessToken = await refreshAccessToken();

                if (newAccessToken) {
                    sessionStorage.setItem('accessToken', newAccessToken);
                    accessToken = newAccessToken;
                } else {
                    // 리프레시 실패 시 로그아웃 처리
                    sessionStorage.clear();
                    localStorage.removeItem('refreshToken');
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

// --- 응답 인터셉터 (인증용) ---
axiosAuth.interceptors.response.use(
    (res) => res,
    async (err) => {
        const { config, response: { status } = {} } = err;

        if (status === 401) {
            // 인증 에러 (토큰 만료 등)
            const newAccessToken = await refreshAccessToken();
            if (newAccessToken) {
                sessionStorage.setItem('accessToken', newAccessToken);
                config.headers['Authorization'] = `Bearer ${newAccessToken}`;
                return axiosAuth(config); // 실패했던 원래 요청 재시도
            }
        }

        if (status === 403) alert('접근 권한이 없습니다.');
        return Promise.reject(err);
    },
);

// --- 구체적인 API 함수들 ---

// 회원가입/중복체크는 axiosBase(인증X)를 사용합니다.
//중복체크
export const postUserIdCheck = (data) => axiosBase.post('/accounts/signup/check-id/', data).then((r) => r.data);
export const postCompanyRegistrationNumberCheck = (data) =>
    axiosBase.post('/accounts/signup/check-company/', data).then((r) => r.data);

//회원가입
export const postSignUpUser = (data) =>
    axiosBase.post('/accounts/signup', { ...data, user_type: 'USER' }).then((r) => r.data);

export const postSignUpTaxAccountant = (data) =>
    axiosBase.post('/accounts/signup', { ...data, user_type: 'TAX_ACCOUNTANT' }).then((r) => r.data);

// 로그인은 성공 시 토큰을 저장해야 합니다.
export const postLogin = async (data) => {
    const res = await axiosBase.post('/accounts/login/', data);
    const { accessToken, refreshToken } = res.data;
    sessionStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken); // 리프레시는 오래 보관하기 위해 로컬에
    return res.data;
};

//프로필
export const getUserProfile = async (userId) => {
    const res = await axiosBase.post(`/profile/usercomment`, { id: userId });
    return res.data;
};

// 프로필 정보 수정 (이름, 사진, 한줄소개 등)
export const updateUserProfile = async (userId, data) => {
    // data 에는 { name, profile_img, bio_one_line } 등이 담깁니다.
    const res = await axiosBase.put(`/profile/update`, { id: userId, ...data });
    return res.data;
};

// 회원 탈퇴
export const deleteUserAccount = async (userId) => {
    const res = await axiosBase.delete(`/profile/delete/${userId}`);
    return res.data;
};

//세무사프로필

// 세무사 프로필 전체 조회 (기본 정보 + 통계 + 리뷰)
// 세무사 프로필 전체 조회 (viewerId 추가)
export const getTaxProProfile = async (taxProId, viewerId = null) => {
    // taxProId 추출 로직
    const id = typeof taxProId === 'object' && taxProId !== null ? taxProId.taxProId : taxProId;

    // POST 본문에 viewerId를 포함하여 전송
    const res = await axiosBase.post(`/profile/taxpro`, { id, viewerId });
    return res.data;
};

// 리뷰(댓글) 등록
export const createReview = async (data) => axiosAuth.post(`/profile/review`, data).then((res) => res.data);

// 리뷰(댓글) 삭제
export const deleteReview = async (reviewId, userId) =>
    axiosAuth.post(`/profile/review/delete`, { reviewId, userId }).then((res) => res.data);

// 리뷰 추천 토글
export const toggleRecommend = async (reviewId, is_recommend) =>
    axiosAuth.post(`/profile/review/recommend`, { reviewId, is_recommend }).then((res) => res.data);

// 별점 등록 (리뷰에는 평점 포함)
export const rateReview = async (reviewId, rating) =>
    axiosAuth.post(`/profile/review/rate`, { reviewId, rating }).then((res) => res.data);

// 상담 신청
export const requestConsult = async (user_id, tax_id) =>
    axiosAuth.post(`/profile/consult/request`, { user_id, tax_id }).then((res) => res.data);

// 상담 수락
export const acceptConsult = async (requestId) =>
    axiosAuth.post(`/profile/consult/accept`, { requestId }).then((res) => res.data);

// 상담 거절
export const rejectConsult = async (requestId) =>
    axiosAuth.post(`/profile/consult/reject`, { requestId }).then((res) => res.data);

export const getTaxProRanking = async () => {
    // 백엔드에서 TaxAccountantProfile과 TaxStats를 Join해서 가져오는 엔드포인트
    const res = await axiosBase.get(`/profile/ranking`);
    return res.data;
};

// 1. AI 채팅 기록 불러오기 (최근 기록 포함 전체)
export const getAiHistory = () => axiosAuth.get('/ai/history').then((r) => r.data);

// 2. AI에게 질문하기 (RAG 기반 답변 요청)
export const postAskAi = (question) => axiosAuth.post('/ai/ask', { question }).then((r) => r.data);

// 3. (선택사항) 채팅 기록 초기화가 필요하다면
export const deleteAiHistory = () => axiosAuth.delete('/ai/history').then((r) => r.data);
