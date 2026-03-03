import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import useForm from '../../hooks/useForm';
import './Login.css';
import Logo from '../../assets/connectDuo_logo.png';
import { postLogin, getUserProfile } from '../../api/axios';

const Login = ({ onSuccess, setDbUser }) => {
    const navigate = useNavigate();
    const loginAuthUser = useAuthStore((s) => s.loginAuthUser);
    const authUser = useAuthStore((s) => s.authUser);
    const isAuthLoading = useAuthStore((s) => s.isAuthLoading);

    const { formData, inputChangeHandler, setFormData } = useForm({
        email: '',
        passwd: '',
    });

    const emailRef = useRef(null);
    const passwdRef = useRef(null);

    useEffect(() => {
        if (isAuthLoading) return;
        if (authUser) navigate('/');
    }, [authUser, isAuthLoading, navigate]);

    useEffect(() => {
        emailRef.current?.focus();
    }, []);

    if (isAuthLoading) {
        return (
            <div className="login-page">
                <div className="lp-loading">로그인 확인 중입니다...</div>
            </div>
        );
    }

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.email.trim()) {
            alert('아이디를 입력하세요');
            emailRef.current?.focus();
            return;
        }
        if (!formData.passwd.trim()) {
            alert('비밀번호를 입력하세요');
            passwdRef.current?.focus();
            return;
        }

        try {
            const response = await postLogin(formData);
            const { result, message, data } = response;

            if (result === 'success') {
                sessionStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);

                const userInfo = {
                    id: data.id,
                    name: data.name,
                    username: data.username,
                    user_type: data.user_type,
                    email: data.email,
                };
                localStorage.setItem('userBackup', JSON.stringify(userInfo));

                if (setDbUser) {
                    try {
                        const res = await getUserProfile(data.id);
                        if (res.result === 'success') {
                            setDbUser({
                                ...res.data.user,
                                avatarUrl: res.data.user.profile_img,
                            });
                            localStorage.setItem('userBackup', JSON.stringify(res.data.user));
                        }
                    } catch {}
                }

                loginAuthUser({ ...data });
                alert('로그인 성공!');
                navigate('/');
            } else {
                alert(message);
            }
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message ?? error.message);

            setFormData({ email: '', passwd: '' });
            emailRef.current?.focus();
        }
    };

    return (
        <div className="login-page">
            <div className="lp-wrap">
                <img
                    src={Logo}
                    alt="logo"
                    onClick={() => navigate('/')}
                    style={{ cursor: 'pointer' }}
                    className="lp-logo"
                />

                <form className="lp-card" onSubmit={handleSubmit}>
                    <div className="lp-fields">
                        <div className="lp-field">
                            <input
                                type="text"
                                id="email"
                                name="email"
                                placeholder=" "
                                required
                                ref={emailRef}
                                value={formData.email}
                                onChange={inputChangeHandler}
                                className="lp-input"
                            />
                            <label htmlFor="email" className="lp-label">
                                아이디
                            </label>
                        </div>

                        <div className="lp-field">
                            <input
                                type="password"
                                id="passwd"
                                name="passwd"
                                placeholder=" "
                                required
                                ref={passwdRef}
                                value={formData.passwd}
                                onChange={inputChangeHandler}
                                className="lp-input"
                            />
                            <label htmlFor="passwd" className="lp-label">
                                비밀번호
                            </label>
                        </div>
                    </div>

                    <button className="lp-btn" type="submit">
                        로그인
                    </button>
                </form>

                <div className="lp-linkRow">
                    <span className="lp-link" onClick={() => navigate('/signup')} style={{ cursor: 'pointer' }}>
                        회원가입
                    </span>
                </div>
            </div>
        </div>
    );
};

export default Login;