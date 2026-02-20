import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../../styles/AuthForm.css';

function Signup() {
    const [form, setForm] = useState({
        username: '',
        password: '',
        name: '',
        phone_number: '',
        user_type: 'TAX_ACCOUNTANT',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);
        try {
            const { username, password, name, phone_number, user_type } = form;
            const response = await axios.post('http://localhost:4000/api/auth/register', {
                username,
                password,
                name,
                phone_number,
                user_type,
            });
            if (response.status === 201) {
                setSuccess(true);
                setTimeout(() => navigate('/login'), 1000);
            }
        } catch (submitError) {
            if (submitError.response && submitError.response.data && submitError.response.data.message) {
                setError(submitError.response.data.message);
            } else {
                setError('회원가입에 실패했습니다.');
            }
        }
    };

    return (
        <>
            <div className="auth-form-container">
                <h2>회원가입</h2>
                <form onSubmit={handleSubmit} className="auth-form">
                    <input
                        type="text"
                        name="username"
                        placeholder="아이디"
                        value={form.username}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="password"
                        name="password"
                        placeholder="비밀번호"
                        value={form.password}
                        onChange={handleChange}
                        required
                    />
                    <input type="text" name="name" placeholder="이름" value={form.name} onChange={handleChange} required />
                    <input
                        type="text"
                        name="phone_number"
                        placeholder="전화번호 (선택)"
                        value={form.phone_number}
                        onChange={handleChange}
                    />
                    <select name="user_type" value={form.user_type} onChange={handleChange} required>
                        <option value="TAX_ACCOUNTANT">세무사</option>
                        <option value="USER">일반 사용자</option>
                    </select>
                    {error && <div className="auth-error">{error}</div>}
                    {success && <div className="auth-success">회원가입 성공! 로그인으로 이동합니다.</div>}
                    <button type="submit">회원가입</button>
                </form>
                <div className="auth-link">
                    이미 계정이 있으신가요? <span onClick={() => navigate('/login')}>로그인</span>
                </div>
            </div>
        </>
    );
}

export default Signup;
