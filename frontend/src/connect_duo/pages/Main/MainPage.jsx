import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import './styles.css';

function MainScreen(props) {
    const navigate = useNavigate();

    // isAuthLoading 상태를 추가로 가져옵니다.
    const { authUser, logout, isAuthLoading } = useAuthStore();

    const handleLogout = () => {
        if (window.confirm('로그아웃 하시겠습니까?')) {
            logout();
            alert('로그아웃 되었습니다.');
            navigate('/');
        }
    };

    // [핵심] 로그인 확인 절차가 진행 중일 때는 아무것도 보여주지 않거나 로딩바를 보여줍니다.
    if (isAuthLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <p>데이터를 불러오는 중입니다...</p>
            </div>
        );
    }

    return (
        <div className="main-container">
            <header
                style={{
                    padding: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #ddd',
                }}
            >
                <h2>Connect Duo</h2>

                <div className="auth-buttons">
                    {authUser ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <span>
                                <strong>{authUser.username || '사용자'}</strong>님 반갑습니다!
                            </span>
                            <button
                                onClick={handleLogout}
                                className="logout-btn"
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#ff4d4f',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                }}
                            >
                                로그아웃
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => navigate('/login')}
                            className="login-btn"
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#1890ff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            로그인
                        </button>
                    )}
                </div>
            </header>

            <main style={{ padding: '40px', textAlign: 'center' }}>
                <h1>테스트입니다.</h1>
                <p>현재 {authUser ? '로그인' : '비로그인'} 상태입니다.</p>
            </main>
        </div>
    );
}

export default MainScreen;
