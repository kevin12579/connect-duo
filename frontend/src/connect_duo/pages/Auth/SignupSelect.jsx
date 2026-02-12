// src/pages/Auth/SignupSelect.jsx
import React, { useMemo, useState } from 'react';
import './SignupSelect.css';

export default function SignupSelect({ onGoLogin }) {
    // 'user' | 'tax'
    const [role, setRole] = useState('user');

    // 폼 상태
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        password2: '',
    });

    const roleText = useMemo(() => {
        return role === 'user'
            ? { tabUser: '사용자', tabTax: '세무사', nameLabel: '이름', submit: '사용자 가입하기' }
            : { tabUser: '사용자', tabTax: '세무사', nameLabel: '상호명(이름)', submit: '세무사 가입하기' };
    }, [role]);

    const onChange = (key) => (e) => {
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

    const validate = () => {
        if (!form.name.trim()) return '이름을 입력하세요.';
        if (!form.email.trim()) return '이메일을 입력하세요.';
        if (!form.password) return '비밀번호를 입력하세요.';
        if (form.password.length < 4) return '비밀번호는 4자 이상으로 입력하세요.';
        if (form.password !== form.password2) return '비밀번호 확인이 일치하지 않습니다.';
        return '';
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const msg = validate();
        if (msg) {
            alert(msg);
            return;
        }

        // TODO: 여기서 백엔드 회원가입 API 붙이면 됨
        alert(`${role === 'user' ? '사용자' : '세무사'} 회원가입 요청(테스트) 완료!`);

        //  가입 후 "페이지 이동" 말고 메인 하단에서 로그인 뷰로 전환
        if (onGoLogin) onGoLogin();
    };

    return (
        <div className="signup-root">
            <div className="signup-card">
                <h2 className="signup-title">회원가입</h2>

                <div className="signup-tabs" role="tablist" aria-label="회원 유형 선택">
                    <button
                        type="button"
                        className={`signup-tab ${role === 'user' ? 'active' : ''}`}
                        onClick={() => setRole('user')}
                    >
                        {roleText.tabUser}
                    </button>

                    <button
                        type="button"
                        className={`signup-tab ${role === 'tax' ? 'active' : ''}`}
                        onClick={() => setRole('tax')}
                    >
                        {roleText.tabTax}
                    </button>
                </div>

                <form className="signup-form" onSubmit={handleSubmit}>
                    <div className="signup-input-box">
                        <input
                            className="signup-input"
                            type="text"
                            placeholder={roleText.nameLabel}
                            value={form.name}
                            onChange={onChange('name')}
                        />

                        <input
                            className="signup-input"
                            type="email"
                            placeholder="이메일"
                            value={form.email}
                            onChange={onChange('email')}
                        />

                        <input
                            className="signup-input"
                            type="password"
                            placeholder="비밀번호"
                            value={form.password}
                            onChange={onChange('password')}
                        />

                        <input
                            className="signup-input"
                            type="password"
                            placeholder="비밀번호 확인"
                            value={form.password2}
                            onChange={onChange('password2')}
                        />

                        <button className="signup-btn" type="submit">
                            {roleText.submit}
                        </button>

                        <div className="signup-footer">
                            <span className="signup-footer-text">이미 계정이 있으신가요?</span>
                            <span
                                className="signup-footer-link"
                                role="button"
                                tabIndex={0}
                                onClick={() => onGoLogin && onGoLogin()}
                                onKeyDown={(e) => {
                                    if ((e.key === 'Enter' || e.key === ' ') && onGoLogin) onGoLogin();
                                }}
                            >
                                로그인
                            </span>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
