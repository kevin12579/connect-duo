const express = require('express');
const signupController = require('../controllers/signupController');
const router = express.Router();

// 아이디 중복 체크: POST /api/users/check-id
router.post('/check-id', signupController.checkId);

// 통합 회원가입: POST /api/users/signup
router.post('/', signupController.signUp);

// 사업자 번호 체크
router.post('/check-company', signupController.checkCompanyNumber);

module.exports = router;
