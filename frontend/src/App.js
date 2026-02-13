import './App.css';
import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import MainScreen from './connect_duo/pages/Main/MainPage';
import Login from './connect_duo/pages/Auth/Login';
import Signup from './connect_duo/pages/Auth/Signup';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useAuthStore } from './connect_duo/stores/authStore';
import { refreshAccessToken } from './connect_duo/utils/authUtils';

const queryClient = new QueryClient();

function App() {
    const loginAuthUser = useAuthStore((s) => s.loginAuthUser);
    const setAuthLoading = useAuthStore((s) => s.setAuthLoading); // 로딩 제어 함수 가져오기

    useEffect(() => {
        const autoLogin = async () => {
            const rToken = localStorage.getItem('refreshToken');

            // 리프레시 토큰이 있는 경우에만 서버에 확인 요청
            if (rToken) {
                try {
                    const newAt = await refreshAccessToken();

                    if (newAt) {
                        sessionStorage.setItem('accessToken', newAt);
                        loginAuthUser({ accessToken: newAt });
                    }
                } catch (error) {
                    localStorage.removeItem('refreshToken');
                }
            }
            setAuthLoading(false);
        };

        autoLogin();
    }, [loginAuthUser, setAuthLoading]);

    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<MainScreen />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                </Routes>
            </BrowserRouter>
        </QueryClientProvider>
    );
}

export default App;
