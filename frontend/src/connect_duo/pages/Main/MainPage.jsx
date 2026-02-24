import React, { useEffect, useState } from 'react';
import './MainPage.css';

import Login from '../Auth/Login';
import SignupSelect from '../Auth/SignupSelect';
import RankingPage from '../Ranking/RankingPage';

import TaxProfile from '../Profile/TaxProfile';
import UserProfile from '../Profile/UserProfile';

import ChatList from '../Chat/ChatList';
import ChatRoom from '../Chat/ChatRoom';

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

export default function MainPage({ initialSelected, initialOpenRoomId }) {
    const [selected, setSelected] = useState(initialSelected || 'login');
    const [authView, setAuthView] = useState('login');
    const [search, setSearch] = useState('');

    // ✅ 상담 탭 room 상태
    const [openRoomId, setOpenRoomId] = useState(initialOpenRoomId ? String(initialOpenRoomId) : null);

    // ✅ 프로필 탭 상태
    const [profileView, setProfileView] = useState('USER_PROFILE');
    const [profileNav, setProfileNav] = useState(null);
    const [myRole, setMyRole] = useState('USER');

    // ✅ 라우터(/chat 또는 /chat/:id)로 들어왔을 때도 상태 반영
    useEffect(() => {
        if (initialSelected) setSelected(initialSelected);
    }, [initialSelected]);

    useEffect(() => {
        if (initialOpenRoomId != null) {
            setSelected('consult');
            setOpenRoomId(String(initialOpenRoomId));
        }
    }, [initialOpenRoomId]);

    const openTaxProFromUser = ({ taxProId, focus, highlightUserId }) => {
        setProfileNav({ taxProId, focus, highlightUserId });
        setProfileView('TAX_PROFILE');
        setSelected('profile');
    };

    const renderProfile = () => {
        if (profileView === 'USER_PROFILE') return <UserProfile onOpenTaxProProfile={openTaxProFromUser} />;
        if (profileView === 'USER_TO_TAXPRO') return <TaxProfile viewerRole="USER" nav={profileNav} />;
        return <TaxProfile viewerRole="TAXPRO" nav={profileNav} />;
    };

    const renderConsult = () => {
        // ✅ 상담탭: openRoomId 없으면 리스트, 있으면 룸
        if (!openRoomId) {
            return (
                <ChatList
                    onOpenRoom={(rid) => {
                        setOpenRoomId(String(rid));
                    }}
                />
            );
        }

        return (
            <ChatRoom
                roomId={openRoomId}
                onBack={() => {
                    setOpenRoomId(null);
                }}
            />
        );
    };

    const renderContent = () => {
        if (selected === 'login') {
            return authView === 'login' ? (
                <Login
                    onSuccess={(roleFromServer) => {
                        const role = roleFromServer || 'USER';
                        setMyRole(role);

                        setSelected('profile');
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
        if (selected === 'consult') return renderConsult();

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

                                if (cat.key === 'login') setAuthView('login');

                                if (cat.key === 'profile') {
                                    setProfileView(myRole === 'TAXPRO' ? 'TAX_PROFILE' : 'USER_PROFILE');
                                }

                                // ✅ 상담 탭 누르면 항상 리스트부터
                                if (cat.key === 'consult') {
                                    setOpenRoomId(null);
                                }
                            }}
                        >
                            <img src={cat.icon} alt={cat.label} className="mainpage-category-icon" />
                            <span className="mainpage-category-label">{cat.label}</span>
                        </button>
                    ))}
                </div>

                {/* ✅ 프로필 안에서 switch 버튼 */}
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
