import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { refreshAccessToken } from '../../utils/authUtils';
import './MainPage.css';

import Login from '../Auth/Login';
import Signup from '../Auth/Signup';
import RankingPage from '../Ranking/RankingPage';
import TaxProfile from '../Profile/TaxProfile';
import UserProfile from '../Profile/UserProfile';
import SearchTool from '../AI/SearchTool';

import logoImg from '../../assets/connectDuo_logo.png';
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

export default function MainPage() {
    const navigate = useNavigate();
    const { authUser, loginAuthUser, logout, isAuthLoading, setAuthLoading } = useAuthStore();
    const displayUser =
        authUser && typeof authUser === 'object' && authUser.name
            ? authUser
            : JSON.parse(localStorage.getItem('userBackup') || 'null');

    const [selected, setSelected] = useState('login');
    const [authView, setAuthView] = useState('login');
    const [profileView, setProfileView] = useState('USER_PROFILE');
    const [profileNav, setProfileNav] = useState(null);

    // AI 채팅 관련 상태
    const [search, setSearch] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatQuery, setChatQuery] = useState('');

    useEffect(() => {
        const initAuth = async () => {
            const rToken = localStorage.getItem('refreshToken');
            const userBackup = localStorage.getItem('userBackup');
            if (!rToken) {
                setAuthLoading(false);
                return;
            }

            try {
                const newAt = await refreshAccessToken();
                if (newAt) {
                    sessionStorage.setItem('accessToken', newAt);
                    const parsedUser = userBackup ? JSON.parse(userBackup) : {};
                    loginAuthUser({ ...parsedUser, accessToken: newAt });
                }
            } catch (error) {
                console.error('자동 로그인 실패:', error);
                logout();
            } finally {
                setAuthLoading(false);
            }
        };

        initAuth();
    }, [loginAuthUser, logout, setAuthLoading]);

    const handleLogout = () => {
        if (window.confirm('로그아웃 하시겠습니까?')) {
            logout();
            alert('로그아웃 되었습니다.');
            setSelected('login');
        }
    };

    const openTaxProFromUser = (taxProId) => {
        setProfileNav({ taxProId });
        setProfileView('USER_TO_TAXPRO');
        setSelected('profile');
    };

    if (isAuthLoading) {
        return (
            <div className="mainpage-loading">
                <p>사용자 정보를 확인 중입니다...</p>
            </div>
        );
    }

    const handleSearchAction = (e) => {
        if (e.key === 'Enter' || e.type === 'click') {
            // 💡 로그인 여부 확인 로직 추가
            if (!authUser) {
                alert('로그인이 필요한 서비스입니다.');
                setSearch(''); // 검색창 초기화
                setIsChatOpen(false); // 채팅창 닫기
                setSelected('login'); // 로그인 탭으로 이동
                setAuthView('login'); // 로그인 화면 렌더링
                return;
            }

            if (!search.trim()) {
                setIsChatOpen(!isChatOpen);
                return;
            }

            setChatQuery(search);
            setIsChatOpen(true);
            setSearch('');
        }
    };

    const renderProfile = () => {
        if (profileView === 'USER_PROFILE') return <UserProfile onOpenTaxProProfile={openTaxProFromUser} />;
        if (profileView === 'USER_TO_TAXPRO') return <TaxProfile viewerRole="USER" nav={profileNav} />;
        if (profileView === 'TAX_PROFILE') return <UserProfile onOpenTaxProProfile={openTaxProFromUser} />;
    };

    const renderContent = () => {
        if (selected === 'login') {
            if (authUser && displayUser) {
                return (
                    <div className="welcome-container">
                        <div className="welcome-header">
                            <div className="welcome-avatar">
                                {displayUser?.profile_img && typeof displayUser.profile_img === 'string' ? (
                                    <img
                                        src={displayUser.profile_img}
                                        alt="프로필"
                                        className="avatar-img"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                        }}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            borderRadius: '50%',
                                            objectFit: 'cover',
                                            background: '#fff',
                                        }}
                                    />
                                ) : (
                                    String(displayUser?.name || displayUser?.username || 'U').charAt(0)
                                )}
                            </div>
                            <div className="welcome-text">
                                <h2>
                                    반가워요,{' '}
                                    <span className="highlight">
                                        {String(displayUser?.name || displayUser?.username || '사용자')}
                                    </span>
                                    님!
                                </h2>
                                <p>오늘도 ConnectDuo와 함께 스마트한 세무 관리를 시작해보세요.</p>
                            </div>
                        </div>

                        <div className="welcome-actions">
                            <button
                                className="welcome-btn profile-btn"
                                onClick={() => {
                                    setSelected('profile');
                                    const role = authUser?.user_type || 'USER';
                                    setProfileView(role === 'TAX_ACCOUNTANT' ? 'TAX_PROFILE' : 'USER_PROFILE');
                                }}
                            >
                                <img src={profileIcon} alt="프로필" className="btn-icon" />내 프로필 가기
                            </button>
                            <button className="welcome-btn logout-btn" onClick={handleLogout}>
                                로그아웃
                            </button>
                        </div>
                    </div>
                );
            }

            return authView === 'login' ? (
                <Login
                    onSuccess={(data) => {
                        const userInfo = {
                            name: data.name,
                            username: data.username,
                            user_type: data.user_type,
                            email: data.email,
                        };
                        localStorage.setItem('userBackup', JSON.stringify(userInfo));

                        loginAuthUser(data);
                        setSelected('profile');
                        setProfileView(data.user_type === 'TAX_ACCOUNTANT' ? 'TAX_PROFILE' : 'USER_PROFILE');
                    }}
                    onGoSignup={() => setAuthView('signup')}
                />
            ) : (
                <Signup onGoLogin={() => setAuthView('login')} onSignedUp={() => setAuthView('login')} />
            );
        }

        if (selected === 'profile') return renderProfile();
        if (selected === 'ranking') return <RankingPage onOpenTaxProProfile={openTaxProFromUser} />;
        if (selected === 'consult') return <div className="main-content-empty">상담 컴포넌트 영역</div>;
        return null;
    };

    return (
        <div className="mainpage-root">
            <div className="mainpage-top-card">
                <div className="mainpage-top-inner">
                    <div className="mainpage-top-left">
                        <img src={logoImg} alt="로고" className="mainpage-logo" onClick={() => setSelected('login')} />
                    </div>

                    <div className="mainpage-top-center">
                        <div className="mainpage-title-row">
                            <img src={chatbotIcon} alt="챗봇" className="mainpage-chatbot-icon" />
                            <div className="mainpage-title">
                                {displayUser && (displayUser.name || displayUser.username)
                                    ? `${displayUser.name || displayUser.username}님, 무엇을 도와드릴까요?`
                                    : '무엇을 도와드릴까요?'}
                            </div>
                        </div>
                        <div className={`search-wrapper ${isChatOpen ? 'is-open' : ''}`}>
                            <div className="search-bar-container">
                                <input
                                    className="mainpage-search-input"
                                    placeholder="세무 궁금증을 입력하고 엔터를 누르세요"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={handleSearchAction}
                                />
                                <button
                                    className={`expand-arrow ${isChatOpen ? 'up' : ''}`}
                                    onClick={handleSearchAction}
                                >
                                    ▼
                                </button>
                            </div>
                            {isChatOpen && (
                                <div className="search-expand-content">
                                    <SearchTool
                                        initialQuery={chatQuery}
                                        setChatQuery={setChatQuery}
                                        isOpen={isChatOpen}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mainpage-inner">
                <div className="mainpage-category-row">
                    {categories.map((cat) => (
                        <button
                            key={cat.key}
                            type="button"
                            className={`mainpage-category-btn${selected === cat.key ? ' selected' : ''}`}
                            onClick={() => {
                                if (!authUser && cat.key !== 'login') {
                                    alert('로그인이 필요한 서비스입니다.');
                                    setSelected('login');
                                    setAuthView('login');
                                    return;
                                }
                                setSelected(cat.key);
                                if (cat.key === 'login') setAuthView('login');
                                if (cat.key === 'profile') {
                                    const role = authUser?.user_type || 'USER';
                                    setProfileView(role === 'TAX_ACCOUNTANT' ? 'TAX_PROFILE' : 'USER_PROFILE');
                                }
                            }}
                        >
                            <img src={cat.icon} alt={cat.label} className="mainpage-category-icon" />
                            <span className="mainpage-category-label">
                                {cat.key === 'login' && authUser ? '내 정보' : cat.label}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="mainpage-content-card">{renderContent()}</div>
            </div>
        </div>
    );
}
