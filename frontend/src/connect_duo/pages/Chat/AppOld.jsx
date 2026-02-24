import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import ChatList from './connect_duo/pages/Chat/ChatList';
import ChatRoom from './connect_duo/pages/Chat/ChatRoom';

import Home from './pages/Home';
import Login from './pages/Login';
import Ranking from './pages/Ranking';
import Profile from './pages/Profile';

import AgentDashboard from './pages/AgentDashboard';
import AgentChat from './pages/AgentChat';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/ranking" element={<Ranking />} />
                <Route path="/profile" element={<Profile />} />

                {/* ✅ 채팅 */}
                <Route path="/chat" element={<ChatList />} />
                <Route path="/chat/:roomId" element={<ChatRoom />} />

                <Route path="/agent" element={<AgentDashboard />} />
                <Route path="/agent/chat/:roomId" element={<AgentChat />} />

                {/* ✅ 없는 경로는 홈으로 */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
}

export default App;