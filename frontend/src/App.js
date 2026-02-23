import './App.css';
import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import MainScreen from './connect_duo/pages/Main/MainPage';
import Login from './connect_duo/pages/Auth/Login';
import Signup from './connect_duo/pages/Auth/Signup';
import TaxProfile from './connect_duo/pages/Profile/TaxProfile';
import UserProfile from './connect_duo/pages/Profile/UserProfile';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useAuthStore } from './connect_duo/stores/authStore';
import { refreshAccessToken } from './connect_duo/utils/authUtils';

// React Query 클라이언트
const queryClient = new QueryClient();

// 세무사 프로필 라우트용 래퍼: 라우터 param → TaxProfile로 전달
function TaxProfilePageWrapper() {
    const { taxProId } = useParams();
    // highlightUserId, focus 등이 필요하다면 nav에 추가
    const nav = { taxProId, focus: null, highlightUserId: null };
    return <TaxProfile nav={nav} viewerRole="USER" />;
}

// 내 프로필 페이지에서 navigate 사용
function UserProfilePage() {
    const navigate = useNavigate();
    // 콜백으로 taxProId를 받아 해당 경로로 라우트 이동
    const handleOpenTaxProProfile = (taxProId) => {
        // 로그로 확인 가능
        // console.log('Open TaxProProfile with id:', taxProId);
        navigate(`/taxpro/${taxProId}`);
    };
    return <UserProfile onOpenTaxProProfile={handleOpenTaxProProfile} />;
}

function App() {
    const loginAuthUser = useAuthStore((s) => s.loginAuthUser);
    const setAuthLoading = useAuthStore((s) => s.setAuthLoading);

    useEffect(() => {
        const autoLogin = async () => {
            const rToken = localStorage.getItem('refreshToken');
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
                    <Route path="/taxpro/:taxProId" element={<TaxProfilePageWrapper />} />
                    <Route path="/profile" element={<UserProfilePage />} />
                </Routes>
            </BrowserRouter>
        </QueryClientProvider>
    );
}

export default App;
