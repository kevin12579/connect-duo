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
                            loginAuthUser({ ...userData, accessToken: newAt });
                            setDbUser({ ...userData, avatarUrl: userData.profile_img });
                            localStorage.setItem('userBackup', JSON.stringify(userData));
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

    // ✅ 2. [추가] 크레딧 로드 전용 useEffect
    // authUser.id가 바뀌는 순간(로그인, 복구 등) 자동으로 크레딧을 가져옵니다.
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
    }, [authUser?.id]); // ID 감시

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
        if (profileView === 'TAX_DETAIL_VIEW')
            return <TaxProfile viewerRole={profileNav?.viewerRole || 'USER'} nav={profileNav} />;
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

                        {/* 크레딧 배너 */}
                        <div style={creditStyles.banner}>
                            <div style={creditStyles.bannerLeft}>
                                <span style={creditStyles.bannerIcon}>💳</span>
                                <div>
                                    <div style={creditStyles.bannerLabel}>내 크레딧</div>
                                    <div style={creditStyles.bannerValue}>{userCredit.toLocaleString()} C</div>
                                </div>
                            </div>
                            <button style={creditStyles.chargeBtn} onClick={() => setShowCreditModal(true)}>
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
                        // 여기서 getCredit을 직접 호출하지 않아도 위쪽 useEffect가 authUser 변화를 감지해 처리합니다.
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

                        {authUser && (
                            <div style={creditStyles.headerCredit}>
                                <span>💳 {userCredit.toLocaleString()} 크레딧</span>
                                <button style={creditStyles.headerChargeBtn} onClick={() => setShowCreditModal(true)}>
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

            {/* 크레딧 충전 모달 */}
            {showCreditModal && (
                <div style={creditStyles.overlay} onClick={() => setShowCreditModal(false)}>
                    <div style={creditStyles.modal} onClick={(e) => e.stopPropagation()}>
                        <h3 style={creditStyles.modalTitle}>💳 크레딧 충전</h3>
                        <p style={creditStyles.modalSub}>
                            현재 잔액:{' '}
                            <strong style={{ color: '#3d6fd9' }}>{userCredit.toLocaleString()} 크레딧</strong>
                        </p>
                        <div style={creditStyles.pkgGrid}>
                            {CREDIT_PACKAGES.map((pkg) => (
                                <button
                                    key={pkg.price}
                                    style={creditStyles.pkgBtn}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.background = '#e8eeff';
                                        e.currentTarget.style.borderColor = '#5a8cf1';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.background = '#f4f7ff';
                                        e.currentTarget.style.borderColor = '#e8eeff';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
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
                                    <div style={creditStyles.pkgCredit}>{pkg.credit.toLocaleString()}</div>
                                    <div style={creditStyles.pkgCreditLabel}>크레딧</div>
                                    <div style={creditStyles.pkgPrice}>{pkg.label}</div>
                                </button>
                            ))}
                        </div>
                        <p style={creditStyles.notice}>💡 크레딧은 채팅 상담, 서비스 이용 등에 사용됩니다.</p>
                        <button style={creditStyles.closeBtn} onClick={() => setShowCreditModal(false)}>
                            닫기
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const creditStyles = {
    headerCredit: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontSize: '0.9rem',
        fontWeight: 700,
        color: '#3d6fd9',
        marginBottom: 4,
    },
    headerChargeBtn: {
        padding: '3px 12px',
        borderRadius: 20,
        border: '1.5px solid #5a8cf1',
        background: '#fff',
        color: '#5a8cf1',
        fontWeight: 700,
        cursor: 'pointer',
        fontSize: '0.82rem',
    },
    banner: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(135deg, #eef2ff 0%, #e0e9ff 100%)',
        borderRadius: 18,
        padding: '16px 22px',
        border: '1.5px solid #c7d8ff',
    },
    bannerLeft: { display: 'flex', alignItems: 'center', gap: 14 },
    bannerIcon: { fontSize: '2rem' },
    bannerLabel: { fontSize: '0.82rem', color: '#7a92c0', fontWeight: 600 },
    bannerValue: { fontSize: '1.5rem', fontWeight: 900, color: '#3d6fd9', letterSpacing: '-0.5px' },
    chargeBtn: {
        padding: '10px 22px',
        borderRadius: 14,
        border: 'none',
        background: '#5a8cf1',
        color: '#fff',
        fontWeight: 800,
        fontSize: '0.95rem',
        cursor: 'pointer',
    },
    overlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(3px)',
    },
    modal: {
        background: '#fff',
        borderRadius: 26,
        padding: '38px 36px',
        width: 480,
        maxWidth: '95vw',
        boxShadow: '0 30px 80px rgba(0,0,0,0.22)',
    },
    modalTitle: { margin: '0 0 10px', fontSize: '1.5rem', fontWeight: 900, color: '#222' },
    modalSub: { color: '#666', marginBottom: 26, fontSize: '1rem' },
    pkgGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 },
    pkgBtn: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: '18px 12px',
        borderRadius: 16,
        border: '2px solid #e8eeff',
        background: '#f4f7ff',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
    },
    pkgCredit: { fontSize: '1.25rem', fontWeight: 900, color: '#3d6fd9' },
    pkgCreditLabel: { fontSize: '0.72rem', color: '#9ab' },
    pkgPrice: {
        fontSize: '0.9rem',
        fontWeight: 700,
        color: '#222',
        marginTop: 5,
        background: '#e8f0fe',
        padding: '3px 10px',
        borderRadius: 20,
    },
    notice: { fontSize: '0.82rem', color: '#888', textAlign: 'center', marginBottom: 18 },
    closeBtn: {
        width: '100%',
        padding: '14px',
        borderRadius: 14,
        border: 'none',
        background: '#f0f0f0',
        color: '#555',
        fontWeight: 800,
        fontSize: '1rem',
        cursor: 'pointer',
    },
};
