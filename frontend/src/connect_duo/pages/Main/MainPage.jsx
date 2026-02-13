import React, { useState } from 'react';
import './MainPage.css';

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

function MainPage() {
    const [selected, setSelected] = useState('login');
    const [search, setSearch] = useState('');

    const renderContent = () => {
        switch (selected) {
            case 'login':
                return <div className="main-content-empty">로그인 컴포넌트 영역</div>;
            case 'profile':
                return <div className="main-content-empty">프로필 컴포넌트 영역</div>;
            case 'ranking':
                return <div className="main-content-empty">랭킹 컴포넌트 영역</div>;
            case 'consult':
                return <div className="main-content-empty">상담 컴포넌트 영역</div>;
            default:
                return null;
        }
    };

    return (
        <div className="mainpage-root">
            {/* 상단 AI 챗봇 카드 (무조건 화면 끝까지) */}
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

            {/* 여기부터 아래(카테고리/하단/출처)만 여백 */}
            <div className="mainpage-inner">
                {/* 중단 카테고리 메뉴 */}
                <div className="mainpage-category-row">
                    {categories.map((cat) => (
                        <button
                            key={cat.key}
                            type="button"
                            className={`mainpage-category-btn${selected === cat.key ? ' selected' : ''}`}
                            onClick={() => setSelected(cat.key)}
                        >
                            <img src={cat.icon} alt={cat.label} className="mainpage-category-icon" />
                            <span className="mainpage-category-label">{cat.label}</span>
                        </button>
                    ))}
                </div>

                {/* 하단 콘텐츠 카드 */}
                <div className="mainpage-content-card">{renderContent()}</div>

                {/* 출처 */}
                <div className="mainpage-credit">Icons by Flaticon (Freepik, Oetjandra, improstudio)</div>
            </div>
        </div>
    );
}

export default MainPage;
