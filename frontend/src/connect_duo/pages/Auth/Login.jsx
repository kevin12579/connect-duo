import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { setAuthSession } from '../../utils/authStorage';
import '../../../styles/AuthForm.css';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const response = await axios.post('http://localhost:4000/api/auth/login', {
                username,
                password,
            });

            if (response.status === 200) {
                const { token, user } = response.data;
                setAuthSession({ token, user });

                navigate('/', {
                    replace: true,
                    state: { selected: 'profile' },
                });
                return;
            }

            setError('로그인에 실패했습니다.');
        } catch (err) {
            if (err.response?.data?.message) {
                setError(err.response.data.message);
                return;
            }
            setError('로그인에 실패했습니다.');
        }
    };

    return (
        <>
            <div className="auth-form-container">
                <h2>로그인</h2>
                <form onSubmit={handleSubmit} className="auth-form">
                    <input
                        type="text"
                        placeholder="아이디"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="비밀번호"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    {error && <div className="auth-error">{error}</div>}
                    <button type="submit">로그인</button>
                </form>
                <div className="auth-link">
                    계정이 없으신가요? <span onClick={() => navigate('/signup')}>회원가입</span>
                </div>
            </div>
        </>
    );
}

export default Login;
