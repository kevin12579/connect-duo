import './App.css';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import MainScreen from './connect_duo/pages/Main/MainPage';
import Login from './connect_duo/pages/Auth/Login';
import Signup from './connect_duo/pages/Auth/Signup';
import { QueryClient, QueryClientProvider } from 'react-query';

const queryClient = new QueryClient();

function App() {
    return (
        // 1. 가장 바깥에 Provider를 둡니다.
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
