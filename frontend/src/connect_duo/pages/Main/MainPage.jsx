import React, { useState } from 'react';
import './MainPage.css';

// 하단 화면에 import
import Login from '../Auth/Login';
import SignupSelect from '../Auth/SignupSelect';
import RankingPage from '../Ranking/RankingPage';

// ✅ 프로필 화면 import
import TaxProfile from '../Profile/TaxProfile';
import UserProfile from '../Profile/UserProfile';

// 이미지 import
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
    const [selected, setSelected] = useState('login');
    const [authView, setAuthView] = useState('login'); // 'login' | 'signup'
    const [search, setSearch] = useState('');

    /**
     * ✅ 프로필 탭 내부에서 “사용자 프로필 / 세무사 프로필”을 스위칭
     * - USER_PROFILE: 사용자만 보는 내 프로필
     * - TAX_PROFILE: 세무사 프로필(사용자가 보는 화면 or 세무사 본인 화면)
     */
    const [profileView, setProfileView] = useState('USER_PROFILE');
    // 'USER_PROFILE' | 'USER_TO_TAXPRO' | 'TAXPRO_TO_TAXPRO'
    /**
     * ✅ UserProfile에서 “내가 쓴 댓글로 가기” 누르면
     * TaxProfile로 전환하면서 “댓글 자동 펼침” 정보를 nav로 넘김
     */
    const [profileNav, setProfileNav] = useState(null);
    // profileNav 예: { taxProId, focus: 'comments', highlightUserId }

    /**
     * ✅ 지금은 더미로 “로그인한 사람이 사용자냐/세무사냐”를 정해두자
     * 나중에는 로그인 성공 시 서버에서 role 내려받아 이 state에 저장하면 됨
     */
    const [myRole, setMyRole] = useState('USER'); // 'USER' | 'TAXPRO'

    // ✅ UserProfile → TaxProfile(댓글로) 이동 콜백
    const openTaxProFromUser = ({ taxProId, focus, highlightUserId }) => {
        setProfileNav({ taxProId, focus, highlightUserId });
        setProfileView('TAX_PROFILE');
        setSelected('profile'); // 혹시 다른 탭이었다면 프로필로
    };

    const renderProfile = () => {
    if (profileView === 'USER_PROFILE') {
        return <UserProfile onOpenTaxProProfile={openTaxProFromUser} />;
    }

    if (profileView === 'USER_TO_TAXPRO') {
        return <TaxProfile viewerRole="USER" nav={profileNav} />;
    }

    // TAXPRO_TO_TAXPRO
    return <TaxProfile viewerRole="TAXPRO" nav={profileNav} />;
    };


    const renderContent = () => {
        if (selected === 'login') {
            return authView === 'login' ? (
                <Login
                    onSuccess={(roleFromServer) => {
                        // ✅ 여기서 role을 받아왔다고 치고 세팅(더미)
                        // 실제 Login에서 role을 넘겨주기 어렵다면 일단 아래 두 줄만 두고 나중에 연결하면 됨
                        const role = roleFromServer || 'USER';
                        setMyRole(role);

                        setSelected('profile');

                        // ✅ 로그인 성공 시 기본 프로필 화면: 사용자면 내 프로필, 세무사면 세무사 프로필
                        setProfileView(role === 'TAXPRO' ? 'TAX_PROFILE' : 'USER_PROFILE');
                    }}
                    onGoSignup={() => setAuthView('signup')}
                />
            ) : (
                <SignupSelect onGoLogin={() => setAuthView('login')} onSignedUp={() => setAuthView('login')} />
            );
        }

        if (selected === 'profile') return renderProfile();
        if (selected === 'ranking') return <RankingPage />;
        if (selected === 'consult') return <div className="main-content-empty">상담 컴포넌트 영역</div>;
        return null;
    };

    return (
        <div className="mainpage-root">
            {/* 상단 */}
            <div className="mainpage-top-card">
                <div className="mainpage-top-inner">
                    <div className="mainpage-top-left">
                        <img src={logoImg} alt="로고" className="mainpage-logo" />
                    </div>

                    <div className="mainpage-top-center">
                        <div className="mainpage-title-row">
                            <img src={chatbotIcon} alt="챗봇" className="mainpage-chatbot-icon" />
                            <div className="mainpage-title">무엇을 도와드릴까요?</div>
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

            {/* 중단/하단 */}
            <div className="mainpage-inner">
                <div className="mainpage-category-row">
                    {categories.map((cat) => (
                        <button
                            key={cat.key}
                            type="button"
                            className={`mainpage-category-btn${selected === cat.key ? ' selected' : ''}`}
                            onClick={() => {
                                setSelected(cat.key);

                                if (cat.key === 'login') {
                                    setAuthView('login');
                                }

                                // ✅ 프로필 탭 누르면: 사용자면 USER_PROFILE, 세무사면 TAX_PROFILE 기본으로
                                if (cat.key === 'profile') {
                                    setProfileView(myRole === 'TAXPRO' ? 'TAX_PROFILE' : 'USER_PROFILE');
                                }
                            }}
                        >
                            <img src={cat.icon} alt={cat.label} className="mainpage-category-icon" />
                            <span className="mainpage-category-label">{cat.label}</span>
                        </button>
                    ))}
                </div>

                {/* ✅ 프로필 안에서 TAX_PROFILE로 갔다가 다시 USER_PROFILE로 돌아갈 버튼(있으면 편함) */}
                {selected === 'profile' && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: -10 }}>
                        <button
                        type="button"
                        className="profile-switch-btn"
                        onClick={() => setProfileView('USER_PROFILE')}
                        >
                        사용자 프로필
                        </button>

                        <button
                        type="button"
                        className="profile-switch-btn"
                        onClick={() => setProfileView('USER_TO_TAXPRO')}
                        >
                        사용자→세무사 프로필
                        </button>

                        <button
                        type="button"
                        className="profile-switch-btn"
                        onClick={() => setProfileView('TAXPRO_TO_TAXPRO')}
                        >
                        세무사→세무사 프로필
                        </button>
                    </div>
                    )}


                <div className="mainpage-content-card">{renderContent()}</div>

                <div className="mainpage-credit">Icons by Flaticon (Freepik, Oetjandra, improstudio)</div>
            </div>
        </div>
    );
}
