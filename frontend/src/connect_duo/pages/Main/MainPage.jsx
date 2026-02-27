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
import ChatList from '../Chat/ChatList';
import ChatRoom from '../Chat/ChatRoom';

import { getUserProfile } from '../../api/axios';

const categories = [
    { key: 'login', label: '로그인', icon: loginIcon },
    { key: 'profile', label: '프로필', icon: profileIcon },
    { key: 'ranking', label: '랭킹', icon: rankingIcon },
    { key: 'consult', label: '상담', icon: consultIcon },
];

export default function MainPage() {
    const { authUser, loginAuthUser, logout, isAuthLoading, setAuthLoading } = useAuthStore();
    const [dbUser, setDbUser] = useState(null);
    const displayUser = dbUser || authUser;

    const [selected, setSelected] = useState('login');
    const [authView, setAuthView] = useState('login');
    const [profileView, setProfileView] = useState('USER_PROFILE');
    const [profileNav, setProfileNav] = useState(null);

    // AI 채팅 관련 상태
    const [search, setSearch] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatQuery, setChatQuery] = useState('');

    // ★ 상담방 열림 상태 및 현재 열린 roomId
    const [activeChatRoom, setActiveChatRoom] = useState(null);

    useEffect(() => {
        const initAuth = async () => {
            // 새로고침 시 로딩 시작
            setAuthLoading(true);

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
                    const parsedBackup = userBackup ? JSON.parse(userBackup) : {};

                    // ✅ 중요: parsedBackup의 ID와 실제 DB 정보가 일치하는지 확인 과정 포함
                    if (parsedBackup.id) {
                        const res = await getUserProfile(parsedBackup.id);
                        if (res.result === 'success') {
                            const userData = res.data.user;

                            // 1. Zustand 스토어 업데이트
                            loginAuthUser({ ...userData, accessToken: newAt });

                            // 2. 로컬 상태 업데이트 (메인 페이지 전용)
                            setDbUser({
                                ...userData,
                                avatarUrl: userData.profile_img,
                            });

                            // 3. 백업 데이터 최신화 (다음 새로고침을 위해)
                            localStorage.setItem('userBackup', JSON.stringify(userData));
                        }
                    }
                }
            } catch (error) {
                console.error('인증 초기화 실패:', error);
                // 토큰이 만료되었거나 에러가 나면 아예 비워버림
                localStorage.removeItem('userBackup');
                logout();
            } finally {
                setAuthLoading(false);
            }
        };

        initAuth();
    }, [loginAuthUser, logout, setAuthLoading]);

    if (isAuthLoading) {
        return (
            <div className="mainpage-loading">
                <p>최신 정보를 불러오고 있습니다...</p>
            </div>
        );
    }

    const handleLogout = () => {
        if (window.confirm('로그아웃 하시겠습니까?')) {
            logout();
            setDbUser(null); // ✅ 로컬 상태 초기화
            localStorage.removeItem('userBackup'); // ✅ 백업 삭제
            alert('로그아웃 되었습니다.');
            setSelected('login');
        }
    };

    const openTaxProFromUser = (targetTaxProId) => {
        const myId = authUser?.id || JSON.parse(localStorage.getItem('userBackup') || 'null')?.id;

        // 2. 타겟 ID와 내 ID 비교하여 역할 결정
        const isMe = String(myId) === String(targetTaxProId);
        const role = isMe ? 'TAX_ACCOUNTANT' : 'USER';

        // 3. 상태 업데이트
        setProfileNav({ taxProId: targetTaxProId, viewerRole: role });
        setProfileView('TAX_DETAIL_VIEW'); // 통합된 상세 뷰 상태값
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
            if (!authUser) {
                alert('로그인이 필요한 서비스입니다.');
                setSearch('');
                setIsChatOpen(false);
                setSelected('login');
                setAuthView('login');
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
        // 1. 기본 유저 프로필 (설정 페이지)
        if (profileView === 'USER_PROFILE') {
            return <UserProfile onOpenTaxProProfile={openTaxProFromUser} />;
        }

        // 2. 세무사 본인의 설정 페이지 (UserProfile과 동일하지만 구분 필요시)
        if (profileView === 'TAX_PROFILE') {
            return <UserProfile onOpenTaxProProfile={openTaxProFromUser} />;
        }

        // 3. 세무사 공개 프로필 상세 페이지 (유저가 보거나, 세무사 본인이 보거나)
        if (profileView === 'TAX_DETAIL_VIEW') {
            return <TaxProfile viewerRole={profileNav?.viewerRole || 'USER'} nav={profileNav} />;
        }

        // 기본값
        return <UserProfile onOpenTaxProProfile={openTaxProFromUser} />;
    };
    // ★ 상담 영역: 채팅 room 선택 시 ChatRoom 오픈, 아니라면 ChatList
    const renderConsultContent = () => {
        if (activeChatRoom) {
            return <ChatRoom roomId={activeChatRoom} onBack={() => setActiveChatRoom(null)} />;
        }
        return <ChatList onOpenRoom={setActiveChatRoom} />;
    };

    const renderContent = () => {
        if (selected === 'login') {
            if (authUser && displayUser) {
                const userPhoto = displayUser.profile_img || displayUser.avatarUrl;
                return (
                    <div className="welcome-container">
                        <div className="welcome-header">
                            <div className="welcome-avatar">
                                {userPhoto ? (
                                    <img
                                        src={userPhoto}
                                        alt="프로필"
                                        className="avatar-img"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.parentNode.innerText = String(displayUser?.name || 'U').charAt(0);
                                        }}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            borderRadius: '50%',
                                            objectFit: 'cover',
                                        }}
                                    />
                                ) : (
                                    <span>{String(displayUser?.name || 'U').charAt(0)}</span>
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
                    onSuccess={async (data) => {
                        // 로컬 백업 + 상태 업데이트 (기존대로)
                        const userInfo = {
                            id: data.id,
                            name: data.name,
                            username: data.username,
                            user_type: data.user_type,
                            email: data.email,
                        };
                        localStorage.setItem('userBackup', JSON.stringify(userInfo));
                        loginAuthUser({ ...data });
                        setSelected('profile');
                        setProfileView(data.user_type === 'TAX_ACCOUNTANT' ? 'TAX_PROFILE' : 'USER_PROFILE');

                        // 👉 프로필 동기화 (DB 최신 정보로 상태/사진 재확인)
                        try {
                            const res = await getUserProfile(data.id);
                            if (res.result === 'success') {
                                setDbUser({
                                    ...res.data.user,
                                    avatarUrl: res.data.user.profile_img,
                                });
                                // 혹시 모를 new profile 백업
                                localStorage.setItem('userBackup', JSON.stringify(res.data.user));
                            }
                        } catch (e) {
                            // fail safe
                        }
                    }}
                    setDbUser={setDbUser}
                    onGoSignup={() => setAuthView('signup')}
                />
            ) : (
                <Signup onGoLogin={() => setAuthView('login')} onSignedUp={() => setAuthView('login')} />
            );
        }

        if (selected === 'profile') return renderProfile();
        if (selected === 'ranking') return <RankingPage onOpenTaxProProfile={openTaxProFromUser} />;
        if (selected === 'consult') return renderConsultContent();
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
                                // 상담 탭 클릭 시 상담방 닫기 (항상 목록부터)
                                if (cat.key === 'consult') setActiveChatRoom(null);
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
