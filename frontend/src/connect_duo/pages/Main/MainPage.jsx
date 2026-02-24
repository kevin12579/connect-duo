import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { refreshAccessToken } from '../../utils/authUtils';
import './MainPage.css';

// 1. 하단 화면 컴포넌트 import 추가
import Login from '../Auth/Login';
import Signup from '../Auth/Signup';
import RankingPage from '../Ranking/RankingPage';

// 2. 프로필 화면 컴포넌트 import 추가
import TaxProfile from '../Profile/TaxProfile';
import UserProfile from '../Profile/UserProfile';

// 3. 이미지 및 아이콘 import 추가
import logoImg from '../../assets/connectDuo_logo.png';
import chatbotIcon from '../../assets/chatbot.png';
import loginIcon from '../../assets/login.png';
import profileIcon from '../../assets/profile.png';
import rankingIcon from '../../assets/rank.png';
import consultIcon from '../../assets/consult.png';

// 4. categories 배열 추가
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
    const [search, setSearch] = useState('');
    const [profileView, setProfileView] = useState('USER_PROFILE');
    const [profileNav, setProfileNav] = useState(null);

    // [자동 로그인 로직] 페이지 접속 시 토큰 확인
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

    // 로그아웃 핸들러
    const handleLogout = () => {
        if (window.confirm('로그아웃 하시겠습니까?')) {
            logout();
            alert('로그아웃 되었습니다.');
            setSelected('login');
        }
    };

    // 5. 누락되었던 openTaxProFromUser 함수 추가
    const openTaxProFromUser = (taxProId) => {
        setProfileNav({ taxProId }); // taxProId만 넣어도 충분!
        setProfileView('USER_TO_TAXPRO');
        setSelected('profile');
    };

    // 로딩 중 화면
    if (isAuthLoading) {
        return (
            <div className="mainpage-loading">
                <p>사용자 정보를 확인 중입니다...</p>
            </div>
        );
    }

    const renderProfile = () => {
        if (profileView === 'USER_PROFILE') return <UserProfile onOpenTaxProProfile={openTaxProFromUser} />;
        if (profileView === 'USER_TO_TAXPRO') return <TaxProfile viewerRole="USER" nav={profileNav} />;
        if (profileView === 'TAX_PROFILE') return <UserProfile onOpenTaxProProfile={openTaxProFromUser} />;
    };

    const renderContent = () => {
        if (selected === 'login') {
            // renderContent 함수 내부의 authUser 조건문 수정
            if (authUser && displayUser) {
                return (
                    <div className="welcome-container">
                        <div className="welcome-header">
                            <div className="welcome-avatar">
                                {/* 1. profile_img가 존재하고 타입이 string일 때만 img 태그 출력 */}
                                {displayUser?.profile_img && typeof displayUser.profile_img === 'string' ? (
                                    <img
                                        src={displayUser.profile_img}
                                        alt="프로필"
                                        className="avatar-img"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                        }} // 이미지 로드 실패 시 숨김 처리
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            borderRadius: '50%',
                                            objectFit: 'cover',
                                            background: '#fff',
                                        }}
                                    />
                                ) : (
                                    /* 2. 이미지가 없을 때 첫 글자 추출 (문자열 보장) */
                                    String(displayUser?.name || displayUser?.username || 'U').charAt(0)
                                )}
                            </div>
                            <div className="welcome-text">
                                <h2>
                                    반가워요,{' '}
                                    <span className="highlight">
                                        {/* 문자열로 확실히 변환하여 렌더링 */}
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
                        // 💡 1. 백업 데이터 생성 및 저장 (이게 있어야 새로고침 시 안 사라짐)
                        const userInfo = {
                            name: data.name,
                            username: data.username,
                            user_type: data.user_type,
                            email: data.email,
                        };
                        localStorage.setItem('userBackup', JSON.stringify(userInfo));

                        // 2. 전역 상태 업데이트
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
        if (selected === 'ranking') {
            return <RankingPage onOpenTaxProProfile={openTaxProFromUser} />;
        }
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
                    {categories.map((cat) => (
                        <button
                            key={cat.key}
                            type="button"
                            className={`mainpage-category-btn${selected === cat.key ? ' selected' : ''}`}
                            onClick={() => {
                                // 💡 로그인 여부 확인 로직 추가
                                if (!authUser && cat.key !== 'login') {
                                    alert('로그인이 필요한 서비스입니다.');
                                    setSelected('login');
                                    setAuthView('login');
                                    return;
                                }

                                // 로그인 상태이거나, 'login' 카테고리를 누른 경우 정상 동작
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
