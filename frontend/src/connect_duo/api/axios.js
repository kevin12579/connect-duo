import axios from 'axios';
import { checkTokenExpiration, refreshAccessToken } from '../utils/authUtils';

const BASE_URL = `http://localhost:7777/api`;

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

export default axiosAuth;
