import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ChatList from './connect_duo/pages/Chat/ChatList';
import ChatRoom from './connect_duo/pages/Chat/ChatRoom';
import Home from './pages/Home';
import './main.css';
function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/chat" element={<ChatList />} />
                <Route path="/chat/:roomId" element={<ChatRoom />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
