import React, { useState } from 'react';
import './Login.css';

function mockLogin(email, password) {
    return email === 'test@test.com' && password === '1234';
}

//  onGoSignup 추가
export default function Login({ onSuccess, onGoSignup }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [popup, setPopup] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!email || !password) {
            setPopup('이메일과 비밀번호를 입력하세요.');
            return;
        }

        if (mockLogin(email, password)) {
            if (onSuccess) onSuccess({ email });
            return;
        }

        setPopup('아이디 또는 비밀번호가 틀렸습니다.');
    };

    const closePopup = () => setPopup('');

    return (
        <div className="login-root">
            <div className="login-card">
                <h2 className="login-title">로그인</h2>

                <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
                    <div className="login-input-box">
                        <input
                            className="login-input"
                            type="email"
                            name="email"
                            autoComplete="off"
                            placeholder="이메일"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                        <input
                            className="login-input"
                            type="password"
                            name="password"
                            autoComplete="new-password"
                            placeholder="비밀번호"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />

                        <button className="login-btn" type="submit">
                            로그인
                        </button>

                        {/*  회원가입 링크: 페이지 이동 말고 "메인 하단에서 뷰 전환" */}
                        <div className="login-signup-wrap">
                            <span
                                className="login-signup-link"
                                role="button"
                                tabIndex={0}
                                onClick={() => onGoSignup && onGoSignup()}
                                onKeyDown={(e) => {
                                    if ((e.key === 'Enter' || e.key === ' ') && onGoSignup) {
                                        onGoSignup();
                                    }
                                }}
                            >
                                회원가입
                            </span>
                        </div>
                    </div>
                </form>
            </div>

            {popup && (
                <div className="login-popup">
                    <div className="login-popup-content">
                        {popup}
                        <button className="login-popup-close" type="button" onClick={closePopup}>
                            닫기
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
