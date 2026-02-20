import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import TaxProfile from '../Profile/TaxProfile';
import UserProfile from '../Profile/UserProfile';
import RankingPage from '../Ranking/RankingPage';
import Login from '../Auth/Login';
import HomeLogoButton from '../../components/HomeLogoButton';
import { AUTH_STORAGE_EVENT, clearAuthSession, getAuthState } from '../../utils/authStorage';
import './MainPage.css';

import chatbotIcon from '../../assets/chatbot.png';
import loginIcon from '../../assets/login.png';
import profileIcon from '../../assets/profile.png';
import rankingIcon from '../../assets/rank.png';
import consultIcon from '../../assets/consult.png';

const categories = [
    { key: 'login', label: '로그인', icon: loginIcon },
    { key: 'profile', label: '프로필', icon: profileIcon },
    { key: 'ranking', label: '랭킹', icon: rankingIcon },
    { key: 'consult', label: '상담', icon: consultIcon },
];

function MainPage() {
    const [selected, setSelected] = useState(() => (getAuthState().isLoggedIn ? 'profile' : 'login'));
    const [search, setSearch] = useState('');
    const location = useLocation();
    const [authState, setAuthState] = useState(getAuthState);

    const currentUser = authState.user;
    const isLoggedIn = authState.isLoggedIn;
    const isTaxAccountant = currentUser?.user_type === 'TAX_ACCOUNTANT';
    const visibleCategories = isLoggedIn ? categories.filter((cat) => cat.key !== 'login') : categories;

    useEffect(() => {
        const selectedFromState = location.state?.selected;
        if (selectedFromState) {
            setSelected(selectedFromState);
        }
    }, [location.state]);

    useEffect(() => {
        const syncAuth = () => {
            setAuthState(getAuthState());
        };

        syncAuth();
        window.addEventListener('storage', syncAuth);
        window.addEventListener(AUTH_STORAGE_EVENT, syncAuth);

        return () => {
            window.removeEventListener('storage', syncAuth);
            window.removeEventListener(AUTH_STORAGE_EVENT, syncAuth);
        };
    }, []);

    const renderedProfile = useMemo(() => {
        if (!isLoggedIn) return null;
        if (isTaxAccountant) {
            return <TaxProfile viewerRole="TAXPRO" currentUser={currentUser} />;
        }
        return <UserProfile currentUser={currentUser} />;
    }, [isLoggedIn, isTaxAccountant, currentUser]);

    const handleCategoryClick = (key) => {
        if (key === 'profile' && !isLoggedIn) {
            alert('로그인 후 프로필 기능을 사용할 수 있습니다.');
            setSelected('login');
            return;
        }
        setSelected(key);
    };

    const handleLogout = () => {
        clearAuthSession();
        setSelected('login');
    };

    const renderContent = () => {
        switch (selected) {
            case 'login':
                return isLoggedIn ? renderedProfile : <Login />;
            case 'profile':
                return renderedProfile;
            case 'ranking':
                return <RankingPage />;
            case 'consult':
                return <div className="main-content-empty">상담 컴포넌트 영역</div>;
            default:
                return null;
        }
    };

    return (
        <div className="mainpage-root">
            <div className="mainpage-top-card">
                <div className="mainpage-top-inner">
                    {isLoggedIn && (
                        <div className="mainpage-top-auth">
                            <span className="mainpage-user-name">{currentUser?.name || currentUser?.username}님</span>
                            <button type="button" className="mainpage-logout-btn" onClick={handleLogout}>
                                로그아웃
                            </button>
                        </div>
                    )}

                    <div className="mainpage-top-left">
                        <HomeLogoButton fixed={false} />
                    </div>

                    <div className="mainpage-top-center">
                        <div className="mainpage-title-row">
                            <img src={chatbotIcon} alt="챗봇" className="mainpage-chatbot-icon" />
                            <div className="mainpage-title">무엇이 필요하신가요?</div>
                        </div>

                        <input
                            className="mainpage-search-input"
                            type="text"
                            placeholder="검색어를 입력하세요"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="mainpage-inner">
                <div className="mainpage-category-row">
                    {visibleCategories.map((cat) => (
                        <button
                            key={cat.key}
                            type="button"
                            className={`mainpage-category-btn${selected === cat.key ? ' selected' : ''}`}
                            onClick={() => handleCategoryClick(cat.key)}
                        >
                            <img src={cat.icon} alt={cat.label} className="mainpage-category-icon" />
                            <span className="mainpage-category-label">{cat.label}</span>
                        </button>
                    ))}
                </div>

                <div className="mainpage-content-card">{renderContent()}</div>
                <div className="mainpage-credit">Icons by Flaticon (Freepik, Oetjandra, improstudio)</div>
            </div>
        </div>
    );
}

export default MainPage;
