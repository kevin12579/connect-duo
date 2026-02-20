const express = require('express');
const { signup, login } = require('../controllers/auth.controller');

const router = express.Router();

// 회원가입
router.post('/register', signup);

// 로그인
router.post('/login', login);

module.exports = router;
