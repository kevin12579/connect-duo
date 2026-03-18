// api/publicAxios.js (공용 API용)
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:7777';

const axiosInstance = axios.create({
    baseURL: `${API_BASE_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// 여기에는 인터셉터를 아예 달지 않거나,
// 혹은 로그 출력(Logging) 처럼 순수하게 정보를 기록하는 용도로만 사용합니다.

export default axiosInstance;
