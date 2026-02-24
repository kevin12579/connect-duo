import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';

import MainScreen from './connect_duo/pages/Main/MainPage';
import SignupSelect from './connect_duo/pages/Auth/SignupSelect';
import RankingPage from './connect_duo/pages/Ranking/RankingPage';
import TaxProfile from './connect_duo/pages/Profile/TaxProfile';

// ✅ /chat 라우트에서 MainPage(상단/카테고리 유지)로 들어가도록 래퍼
function ChatHomeRoute() {
    return <MainScreen initialSelected="consult" />;
}

// ✅ /chat/:roomId 라우트에서 특정 방이 열린 상태로 MainPage를 띄우도록 래퍼
function ChatRoomRoute() {
    const { roomId } = useParams();
    return <MainScreen initialSelected="consult" initialOpenRoomId={roomId} />;
}

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<MainScreen />} />

                <Route path="/auth/signup-select" element={<SignupSelect />} />
                <Route path="/ranking" element={<RankingPage />} />

                {/* ✅ 세무사 프로필 */}
                <Route path="/taxpro/:id" element={<TaxProfile viewerRole="USER" />} />
                <Route path="/taxpro/me" element={<TaxProfile viewerRole="TAXPRO" />} />

                {/* ✅ 채팅: 단독 페이지가 아니라 MainPage(패널 구조)로 진입 */}
                <Route path="/chat" element={<ChatHomeRoute />} />
                <Route path="/chat/:roomId" element={<ChatRoomRoute />} />

                {/* ✅ 없는 경로는 홈으로 */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
}

export default App;
