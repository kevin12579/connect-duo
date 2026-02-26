import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import useForm from '../../hooks/useForm'; // 커스텀 훅 임포트
import '../Auth/style.css';
import Logo from '../../assets/connectDuo_logo.png';
import { postLogin } from '../../api/axios';

import { getUserProfile } from '../../api/axios';

const Login = ({ onSuccess, setDbUser }) => {
    const navigate = useNavigate();
    const loginAuthUser = useAuthStore((s) => s.loginAuthUser);
    const authUser = useAuthStore((s) => s.authUser);
    const isAuthLoading = useAuthStore((s) => s.isAuthLoading);

    // 1. useForm 적용 (초기값 설정)
    const { formData, inputChangeHandler, setFormData } = useForm({
        email: '',
        passwd: '',
    });

    const emailRef = useRef(null);
    const passwdRef = useRef(null);

    useEffect(() => {
        if (isAuthLoading) return;

        if (authUser) {
            navigate('/');
        }
    }, [authUser, isAuthLoading, navigate]);

    useEffect(() => {
        emailRef.current?.focus();
    }, []);

    // 3. 확인 중일 때는 로그인 폼 대신 로딩 화면을 보여줌 (깜빡임 방지)
    if (isAuthLoading) {
        return <div className="loading-container">로그인 확인 중입니다...</div>;
    }

    // 2. 핸들러 함수 단순화
    // 기존의 복잡한 name 매핑 로직이 필요 없어집니다.
    const handleSubmit = async (e) => {
        e.preventDefault();

        // 유효성 검사
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
            // formData를 그대로 전달
            const response = await postLogin(formData);
            const { result, message, data } = response;

            if (result === 'success') {
                sessionStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                const userInfo = {
                    id: data.id,
                    name: data.name, // 👈 이 줄이 빠져있었습니다.
                    username: data.username,
                    user_type: data.user_type,
                    email: data.email,
                };
                localStorage.setItem('userBackup', JSON.stringify(userInfo));

                // 여기서 onSuccess를 await로 쓸 수 있게 바꾸거나, setDbUser가 있으면 즉시 fetch
                if (setDbUser) {
                    // 최신 DB 프로필 즉시 반영
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

                // 전역 상태 업데이트 (토큰 저장은 axios.js 내부에서 처리되도록 권장)
                loginAuthUser({ ...data });
                alert('로그인 성공!');
                navigate('/');
            } else {
                alert(message);
            }
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message ?? error.message);

            // 폼 초기화
            setFormData({ email: '', passwd: '' });
            emailRef.current?.focus();
        }
    };

    return (
        <div className="loginform">
            <img
                src={Logo}
                alt="logo"
                onClick={() => navigate('/')}
                style={{ cursor: 'pointer' }}
                className="logintitle"
            />
            <form className="loginbox" onSubmit={handleSubmit}>
                <div>
                    <div className="loginid">
                        <input
                            type="text"
                            id="email"
                            name="email" // formData의 키값과 일치시킴
                            placeholder=" "
                            required
                            ref={emailRef}
                            value={formData.email}
                            onChange={inputChangeHandler} // 커스텀 훅 핸들러
                        />
                        <label htmlFor="email">아이디</label>
                    </div>
                    <div className="loginpw">
                        <input
                            type="password"
                            id="passwd"
                            name="passwd" // formData의 키값과 일치시킴
                            placeholder=" "
                            required
                            ref={passwdRef}
                            value={formData.passwd}
                            onChange={inputChangeHandler} // 커스텀 훅 핸들러
                        />
                        <label htmlFor="passwd">비밀번호</label>
                    </div>
                </div>
                <button className="loginbutton" type="submit">
                    로그인
                </button>
            </form>
            <div className="loginLink">
                <span onClick={() => navigate('/signup')} style={{ cursor: 'pointer' }}>
                    회원가입
                </span>
            </div>
        </div>
    );
};

export default Login;
