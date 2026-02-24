// 로그인/회원가입 API

// 공용 인스턴스

import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:7777';

export const api = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
});
