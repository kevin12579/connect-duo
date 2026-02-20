import './App.css';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import MainScreen from './connect_duo/pages/Main/MainPage';
import Login from './connect_duo/pages/Auth/Login';
import Signup from './connect_duo/pages/Auth/Signup';
import TaxProfile from './connect_duo/pages/Profile/TaxProfile';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<MainScreen />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/profile/tax/:taxAdvisorId" element={<TaxProfile />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
