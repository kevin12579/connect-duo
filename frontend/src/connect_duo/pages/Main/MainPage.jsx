// MainPage.js (FULL) - creditStyles 제거 + CSS className 적용 (main-credit-...)
// ✅ 요청대로: "헤더 크레딧 span만" 숫자/글자 분리(span 추가)만 적용
// ✅ 나머지 로직/구조/클래스명은 그대로 유지

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

import { getUserProfile, getCredit, chargeCredit } from '../../api/axios';

const categories = [
    { key: 'login', label: '로그인', icon: loginIcon },
    { key: 'profile', label: '프로필', icon: profileIcon },
    { key: 'ranking', label: '랭킹', icon: rankingIcon },
    { key: 'consult', label: '상담', icon: consultIcon },
];

const CREDIT_PACKAGES = [
    { label: '1만원', price: 10000, credit: 10000 },
    { label: '5만원', price: 50000, credit: 50000 },
    { label: '10만원', price: 100000, credit: 100000 },
    { label: '20만원', price: 200000, credit: 200000 },
    { label: '50만원', price: 500000, credit: 500000 },
];

export default function MainPage() {
    const { authUser, loginAuthUser, logout, isAuthLoading, setAuthLoading } = useAuthStore();
    const [dbUser, setDbUser] = useState(null);
    const displayUser = dbUser || authUser;

    const [selected, setSelected] = useState('login');
    const [authView, setAuthView] = useState('login');
    const [profileView, setProfileView] = useState('USER_PROFILE');
    const [profileNav, setProfileNav] = useState(null);

    const [search, setSearch] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [lockMainSearch, setLockMainSearch] = useState(false);
    const [chatQuery, setChatQuery] = useState('');

    const [activeChatRoom, setActiveChatRoom] = useState(null);
    const [userCredit, setUserCredit] = useState(0);
    const [showCreditModal, setShowCreditModal] = useState(false);

    // ✅ 1. 인증 초기화 (토큰 복구 및 유저 정보 로드)
    useEffect(() => {
        const initAuth = async () => {
            setAuthLoading(true);
            const rToken = localStorage.getItem('refreshToken');
            const userBackup = localStorage.getItem('userBackup');

            if (!rToken) {
                setAuthLoading(false);
                return;
            }

            try {
                const newAt = await refreshAccessToken();
                if (!newAt) {
                    localStorage.removeItem('userBackup');
                    logout();
                    setAuthLoading(false);
                    return;
                }

                sessionStorage.setItem('accessToken', newAt);
                const parsedBackup = userBackup ? JSON.parse(userBackup) : {};

                if (parsedBackup.id) {
                    // 백업 데이터로 즉시 상태 복원
                    loginAuthUser({ ...parsedBackup, accessToken: newAt });
                    setDbUser({
                        ...parsedBackup,
                        avatarUrl: parsedBackup.profile_img || parsedBackup.avatarUrl || '',
                    });

                    // DB에서 최신 정보 동기화
                    try {
                        const res = await getUserProfile(parsedBackup.id);
                        if (res.result === 'success') {
                            const userData = res.data.user;
                            // ✅ user_type은 로그인 시 저장된 값을 우선 보존 (getUserProfile이 없을 수 있음)
                            const mergedUser = {
                                ...userData,
                                user_type: userData.user_type || parsedBackup.user_type,
                            };
                            loginAuthUser({ ...mergedUser, accessToken: newAt });
                            setDbUser({ ...mergedUser, avatarUrl: mergedUser.profile_img });
                            localStorage.setItem('userBackup', JSON.stringify(mergedUser));
                        }
                    } catch (profileErr) {
                        console.warn('[Auth] 최신 프로필 동기화 실패:', profileErr?.message);
                    }
                }
            } catch (error) {
                console.error('인증 초기화 실패:', error);
                localStorage.removeItem('userBackup');
                logout();
            } finally {
                setAuthLoading(false);
            }
        };

        initAuth();
    }, [loginAuthUser, logout, setAuthLoading]);

    // ✅ 2. 크레딧 로드 전용 useEffect
    useEffect(() => {
        const fetchCredit = async () => {
            const userId = authUser?.id || JSON.parse(localStorage.getItem('userBackup') || 'null')?.id;
            if (userId) {
                try {
                    const creditRes = await getCredit(userId);
                    if (creditRes.result === 'success') {
                        setUserCredit(creditRes.credit);
                    }
                } catch (e) {
                    console.error('[Credit] 로드 실패:', e);
                }
            }
        };
        fetchCredit();
    }, [authUser?.id]);

    useEffect(() => {
        if (!isChatOpen) setLockMainSearch(false);
    }, [isChatOpen]);

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
            setDbUser(null);
            setUserCredit(0);
            localStorage.removeItem('userBackup');
            alert('로그아웃 되었습니다.');
            setSelected('login');
        }
    };

    const handleChargeCredit = async (amount, description) => {
        const userId = authUser?.id || JSON.parse(localStorage.getItem('userBackup') || 'null')?.id;
        if (!userId) return;

        try {
            const res = await chargeCredit(userId, amount, description);
            if (res.result === 'success') {
                setUserCredit(res.credit);
                alert(
                    `✅ ${amount.toLocaleString()} 크레딧이 충전되었습니다!\n현재 잔액: ${res.credit.toLocaleString()}`,
                );
                setShowCreditModal(false);
            }
        } catch (e) {
            alert('충전 중 오류가 발생했습니다.');
        }
    };

    const openTaxProFromUser = (targetTaxProId) => {
        const myId = authUser?.id || JSON.parse(localStorage.getItem('userBackup') || 'null')?.id;
        const isMe = String(myId) === String(targetTaxProId);
        const role = isMe ? 'TAX_ACCOUNTANT' : 'USER';
        setProfileNav({ taxProId: targetTaxProId, viewerRole: role });
        setProfileView('TAX_DETAIL_VIEW');
        setSelected('profile');
    };

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
                const next = !isChatOpen;
                setIsChatOpen(next);
                if (!next) setLockMainSearch(false);
                return;
            }
            setChatQuery(search);
            setIsChatOpen(true);
            setSearch('');
        }
    };

    const renderProfile = () => {
        if (profileView === 'USER_PROFILE') return <UserProfile onOpenTaxProProfile={openTaxProFromUser} />;
        if (profileView === 'TAX_PROFILE') return <UserProfile onOpenTaxProProfile={openTaxProFromUser} />;
        if (profileView === 'TAX_DETAIL_VIEW') {
            return <TaxProfile viewerRole={profileNav?.viewerRole || 'USER'} nav={profileNav} />;
        }
        return <UserProfile onOpenTaxProProfile={openTaxProFromUser} />;
    };

    const renderConsultContent = () => {
        if (activeChatRoom) return <ChatRoom roomId={activeChatRoom} onBack={() => setActiveChatRoom(null)} />;
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

                        {/* ✅ 크레딧 배너 (CSS class) */}
                        <div className="main-credit-banner">
                            <div className="main-credit-banner-left">
                                <span className="main-credit-banner-icon">💳</span>
                                <div>
                                    <div className="main-credit-banner-label">내 크레딧</div>
                                    <div className="main-credit-banner-value">
                                        <span className="credit-num">{userCredit.toLocaleString()}</span> C
                                    </div>
                                </div>
                            </div>
                            <button className="main-credit-banner-charge" onClick={() => setShowCreditModal(true)}>
                                충전하기
                            </button>
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

                        {/* ✅ 헤더 크레딧 (CSS class) */}
                        {authUser && (
                            <div className="main-credit-header">
                                {/* ✅ 여기만 수정: 숫자만 credit-num에 넣고, '크레딧'은 credit-word로 분리 */}
                                <span className="main-credit-header-text">
                                    💳 <span className="credit-num">{userCredit.toLocaleString()}</span>{' '}
                                    <span className="credit-word">크레딧</span>
                                </span>

                                <button className="main-credit-header-btn" onClick={() => setShowCreditModal(true)}>
                                    + 충전
                                </button>
                            </div>
                        )}

                        <div className={`search-wrapper ${isChatOpen ? 'is-open' : ''}`}>
                            <div className="search-bar-container">
                                <input
                                    className="mainpage-search-input"
                                    placeholder="세무 궁금증을 입력하고 엔터를 누르세요"
                                    value={search}
                                    onChange={(e) => {
                                        if (lockMainSearch) return;
                                        setSearch(e.target.value);
                                    }}
                                    onKeyDown={(e) => {
                                        if (lockMainSearch) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            return;
                                        }
                                        handleSearchAction(e);
                                    }}
                                    onMouseDown={(e) => {
                                        if (lockMainSearch) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }
                                    }}
                                    onFocus={(e) => {
                                        if (lockMainSearch) e.target.blur();
                                    }}
                                    readOnly={lockMainSearch}
                                    tabIndex={lockMainSearch ? -1 : 0}
                                    aria-disabled={lockMainSearch}
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
                                        onToggleLock={setLockMainSearch}
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

            {/* ✅ 크레딧 충전 모달 (CSS class) */}
            {showCreditModal && (
                <div className="main-credit-overlay" onClick={() => setShowCreditModal(false)}>
                    <div className="main-credit-modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="main-credit-modal-title">💳 크레딧 충전</h3>

                        <p className="main-credit-modal-sub">
                            현재 잔액:{' '}
                            <strong className="main-credit-modal-strong">{userCredit.toLocaleString()} 크레딧</strong>
                        </p>

                        <div className="main-credit-pkg-grid">
                            {CREDIT_PACKAGES.map((pkg) => (
                                <button
                                    key={pkg.price}
                                    className="main-credit-pkg-btn"
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                `${pkg.label} 결제 시 ${pkg.credit.toLocaleString()} 크레딧이 충전됩니다.\n진행하시겠습니까?`,
                                            )
                                        ) {
                                            handleChargeCredit(pkg.credit, `${pkg.label} 크레딧 패키지 구매`);
                                        }
                                    }}
                                >
                                    <div className="main-credit-pkg-credit">{pkg.credit.toLocaleString()}</div>
                                    <div className="main-credit-pkg-unit">크레딧</div>
                                    <div className="main-credit-pkg-label">{pkg.label}</div>
                                </button>
                            ))}
                        </div>

                        <p className="main-credit-modal-tip">💡 크레딧은 채팅 상담, 서비스 이용 등에 사용됩니다.</p>

                        <button className="main-credit-modal-close" onClick={() => setShowCreditModal(false)}>
                            닫기
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
