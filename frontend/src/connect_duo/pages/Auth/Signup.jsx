import React, { useState, useRef } from 'react';
import { useMutation } from 'react-query';
import { useNavigate } from 'react-router-dom';
import '../Auth/style.css';
import Logo from '../../assets/logo.png';
import {
    postUserIdCheck,
    postSignUpUser,
    postSignUpTaxAccountant,
    postCompanyRegistrationNumberCheck,
} from '../../api/axios';
import useForm from '../../hooks/useForm';

const Signup = () => {
    const navigate = useNavigate();
    const idRef = useRef();

    // 1. 상태 관리 (USER or TAX_ACCOUNTANT)
    const [userType, setUserType] = useState('USER');

    const { formData, inputChangeHandler, resetForm } = useForm({
        email: '',
        password: '',
        password2: '',
        phone_number: '',
        name: '',
        company_registration_number: '',
        company_name: '',
    });

    const [errors, setErrors] = useState({});
    const [isBlurs, setIsBlurs] = useState({});
    const [idDuplicateCheck, setIdDuplicateCheck] = useState('');
    const [companyNumberCheck, setCompanyNumberCheck] = useState('');
    const [terms, setTerms] = useState(false);

    // 2. 유효성 검사
    const isValids = (target, targetName) => {
        if (targetName === 'email') return /^[a-z]+[a-zA-Z0-9]{5,19}$/g.test(target);
        if (targetName === 'password') return /^(?=.*[a-z])(?=.*[0-9]).{8,16}$/g.test(target);
        if (targetName === 'password2') return target === formData.password;
        if (targetName === 'phone_number') return /^01([0|1|6|7|8|9])([0-9]{3,4})([0-9]{4})$/g.test(target);
        if (targetName === 'name') return target !== '';
        if (targetName === 'company_registration_number') return /^[0-9]{10}$/g.test(target);
        return true;
    };

    // 3. API 통신 로직
    const idCheckMutation = useMutation(postUserIdCheck, {
        onSuccess: (data) => setIdDuplicateCheck(data.Success),
        onError: (err) => {
            setErrors({ ...errors, email: err.response?.data?.FAIL_Message || '이미 존재하는 아이디입니다.' });
            idRef.current.focus();
        },
    });

    const companyCheckMutation = useMutation(postCompanyRegistrationNumberCheck, {
        onSuccess: (data) => setCompanyNumberCheck(data.Success),
        onError: (err) =>
            setErrors({
                ...errors,
                company_registration_number: err.response?.data?.FAIL_Message || '이미 등록된 사업자 번호입니다.',
            }),
    });

    // 선택된 타입에 따라 다른 API 함수 호출
    const signupMutation = useMutation(userType === 'USER' ? postSignUpUser : postSignUpTaxAccountant, {
        onSuccess: () => {
            alert('회원가입을 완료했습니다. 로그인 페이지로 이동합니다.');
            navigate('/login');
        },
        onError: (err) => {
            // 서버에서 보낸 에러 메시지가 있다면 출력
            const msg = err.response?.data?.message || err.message;
            alert('서버 오류: ' + msg);
        },
    });

    // 4. 핸들러 함수
    // [수정] 커스텀 핸들러 (기존 onChangeHandler 역할)
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        // 1. 값 업데이트 (useForm의 핸들러 호출)
        inputChangeHandler(e);

        // 2. 중복 체크 상태 초기화
        if (name === 'email') setIdDuplicateCheck('');
        if (name === 'company_registration_number') setCompanyNumberCheck('');

        // 3. 실시간 유효성 검사 (isValids 로직은 유지)
        if (!isValids(value, name)) {
            const errorMessages = {
                email: '6~20자 영문 소문자, 숫자를 사용하세요.',
                password: '8~16자 영소문자, 숫자를 포함해야 합니다.',
                password2: '비밀번호가 일치하지 않습니다.',
                phone_number: '올바른 휴대폰 번호를 입력하세요.',
                company_registration_number: '사업자번호는 10자리 숫자입니다.',
            };
            setErrors((prev) => ({ ...prev, [name]: errorMessages[name] || '형식이 올바르지 않습니다.' }));
        } else {
            setErrors((prev) => ({ ...prev, [name]: '' }));
        }
    };

    const onBlurHandler = (e) => {
        const { name, value } = e.target;
        setIsBlurs({ ...isBlurs, [name]: true });
        if (!value) setErrors((prev) => ({ ...prev, [name]: '필수 정보입니다.' }));
    };

    const onSubmitHandler = (e) => {
        // 1) submit 기본 동작(페이지 새로고침) 방지
        e.preventDefault();

        // 2) 필수 체크 (중복확인 및 인증 여부)
        if (!idDuplicateCheck) {
            alert('아이디 중복 확인이 필요합니다.');
            idRef.current.focus();
            return;
        }

        if (userType === 'TAX_ACCOUNTANT' && !companyNumberCheck) {
            alert('사업자 인증이 필요합니다.');
            return;
        }

        // 3) 약관 동의 체크
        if (!terms) {
            alert('이용약관에 동의해주세요.');
            return;
        }

        // 4) 에러 상태가 하나라도 있으면 중단
        const hasError = Object.values(errors).some((error) => error !== '');
        if (hasError) {
            alert('입력 양식을 다시 확인해주세요.');
            return;
        }

        // 5) 최종 Mutation 실행 (비동기 요청 시작)
        // values 객체는 이미 formData 역할을 하고 있습니다.
        signupMutation.mutate(formData);
    };

    // 리셋 핸들러 (입력 필드 초기화)
    const handleReset = () => {
        resetForm(); // useForm에서 제공하는 리셋 함수 사용
        setErrors({});
        setIdDuplicateCheck('');
        setCompanyNumberCheck('');
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

            <form className="loginbox" onSubmit={onSubmitHandler}>
                <div className="role-selector">
                    <button
                        type="button"
                        className={userType === 'USER' ? 'active' : ''}
                        onClick={() => {
                            setUserType('USER');
                            handleReset();
                        }}
                    >
                        일반 사용자
                    </button>
                    <button
                        type="button"
                        className={userType === 'TAX_ACCOUNTANT' ? 'active' : ''}
                        onClick={() => {
                            setUserType('TAX_ACCOUNTANT');
                            handleReset();
                        }}
                    >
                        세무사
                    </button>
                </div>

                <div className="input-group">
                    {/* 아이디 */}
                    <div className="loginid with-btn">
                        <div className="input-wrapper">
                            <input
                                type="text"
                                id="email"
                                name="email"
                                placeholder=" "
                                required
                                ref={idRef}
                                onChange={handleInputChange}
                                onBlur={onBlurHandler}
                            />
                            <label htmlFor="email">아이디</label>
                        </div>
                        <button
                            type="button"
                            className="inner-btn"
                            onClick={() => idCheckMutation.mutate({ email: formData.email })}
                            disabled={!formData.email || !!errors.email}
                        >
                            중복확인
                        </button>
                    </div>
                    {isBlurs.email && errors.email && <p className="err-msg">{errors.email}</p>}
                    {idDuplicateCheck && <p className="success-msg">{idDuplicateCheck}</p>}

                    {/* 비밀번호 */}
                    <div className="loginpw">
                        <input
                            type="password"
                            id="password"
                            name="password"
                            placeholder=" "
                            required
                            onChange={handleInputChange}
                            onBlur={onBlurHandler}
                        />
                        <label htmlFor="password">비밀번호</label>
                    </div>
                    {isBlurs.password && errors.password && <p className="err-msg">{errors.password}</p>}

                    {/* 비밀번호 확인 */}
                    <div className="loginpw">
                        <input
                            type="password"
                            id="password2"
                            name="password2"
                            placeholder=" "
                            required
                            onChange={handleInputChange}
                            onBlur={onBlurHandler}
                        />
                        <label htmlFor="password2">비밀번호 확인</label>
                    </div>
                    {isBlurs.password2 && errors.password2 && <p className="err-msg">{errors.password2}</p>}

                    {/* 이름 */}
                    <div className="loginid">
                        <input
                            type="text"
                            id="name"
                            name="name"
                            placeholder=" "
                            required
                            onChange={handleInputChange}
                            onBlur={onBlurHandler}
                        />
                        <label htmlFor="name">이름</label>
                    </div>

                    {/* 휴대폰 번호 */}
                    <div className="loginid">
                        <input
                            type="number"
                            id="phone_number"
                            name="phone_number"
                            placeholder=" "
                            required
                            onChange={handleInputChange}
                            onBlur={onBlurHandler}
                        />
                        <label htmlFor="phone_number">휴대폰 번호 (- 제외)</label>
                    </div>
                    {isBlurs.phone_number && errors.phone_number && <p className="err-msg">{errors.phone_number}</p>}

                    {/* 세무사(TAX_ACCOUNTANT) 전용 필드 */}
                    {userType === 'TAX_ACCOUNTANT' && (
                        <>
                            <div className="loginid with-btn">
                                <div className="input-wrapper">
                                    <input
                                        type="text"
                                        id="company_registration_number"
                                        name="company_registration_number"
                                        placeholder=" "
                                        required
                                        maxLength={10} // 10자리 제한
                                        onChange={handleInputChange}
                                        onBlur={onBlurHandler}
                                    />
                                    <label htmlFor="company_registration_number">사업자 번호</label>
                                </div>
                                <button
                                    type="button"
                                    className="inner-btn"
                                    onClick={() =>
                                        companyCheckMutation.mutate({
                                            company_registration_number: formData.company_registration_number,
                                        })
                                    }
                                    disabled={
                                        !formData.company_registration_number ||
                                        !!errors.company_registration_number ||
                                        companyCheckMutation.isLoading
                                    }
                                >
                                    인증
                                </button>
                            </div>
                            {isBlurs.company_registration_number && errors.company_registration_number && (
                                <p className="err-msg">{errors.company_registration_number}</p>
                            )}
                            {companyNumberCheck && <p className="success-msg">{companyNumberCheck}</p>}

                            <div className="loginid">
                                <input
                                    type="text"
                                    id="company_name"
                                    name="company_name"
                                    placeholder=" "
                                    required
                                    onChange={handleInputChange}
                                    onBlur={onBlurHandler}
                                />
                                <label htmlFor="company_name">상호명(회사명)</label>
                            </div>
                        </>
                    )}
                </div>

                <div className="loginkeep" style={{ marginTop: '20px' }}>
                    <input type="checkbox" id="terms" checked={terms} onChange={() => setTerms(!terms)} />
                    <label htmlFor="terms" style={{ fontSize: '12px' }}>
                        이용약관 및 개인정보처리방침 동의
                    </label>
                </div>

                <button
                    className="loginbutton"
                    type="submit"
                    disabled={
                        signupMutation.isLoading ||
                        !terms ||
                        Object.values(errors).some((e) => e !== '') ||
                        !idDuplicateCheck || // 아이디 체크 필수
                        (userType === 'TAX_ACCOUNTANT' && !companyNumberCheck) // 세무사면 사업자 체크 필수
                    }
                >
                    {signupMutation.isLoading ? '처리 중...' : '가입하기'}
                </button>
            </form>
        </div>
    );
};

export default Signup;
