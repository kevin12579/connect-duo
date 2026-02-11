import './App.css';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import MainScreen from './connect_duo/Main/MainScreen.jsx';
function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<MainScreen />}></Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
