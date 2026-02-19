import './App.css';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import MainScreen from './connect_duo/pages/Main/MainPage';
import SignupSelect from './connect_duo/pages/Auth/SignupSelect';
import RankingPage from './connect_duo/pages/Ranking/RankingPage';
import TaxProfile from "./connect_duo/pages/Profile/TaxProfile";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<MainScreen />}></Route>
                <Route path="/auth/signup-select" element={<SignupSelect />} />
                <Route path="/ranking" element={<RankingPage />} />
                <Route path="/taxpro/:id" element={<TaxProfile viewerRole="USER" />} />
                <Route path="/taxpro/me" element={<TaxProfile viewerRole="TAXPRO" />} />
            </Routes>            
        </BrowserRouter>
    );
}

export default App;
