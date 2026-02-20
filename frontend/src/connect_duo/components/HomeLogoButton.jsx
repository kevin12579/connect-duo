import React from 'react';
import { Link } from 'react-router-dom';
import logoImg from '../assets/connectDuo_logo.png';
import './HomeLogoButton.css';

export default function HomeLogoButton({ fixed = true }) {
    const linkClassName = fixed ? 'home-logo-link' : 'home-logo-link home-logo-link--inline';

    return (
        <Link to="/" className={linkClassName} aria-label="메인페이지로 이동">
            <img src={logoImg} alt="연결해듀오 로고" className="home-logo-image" />
        </Link>
    );
}
