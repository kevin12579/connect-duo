const express = require('express');
const router = express.Router();
const loginController = require('../controllers/loginController');
const verifyMiddleware = require('../middlewares/verifyMiddleware');
// /api/accounts/login

router.post(`/login`, loginController.login);
router.post(`/logout`, verifyMiddleware.verifyAccessToken, loginController.logout);
router.get('/user', verifyMiddleware.verifyAccessToken, loginController.getAuthenticUser); //accessToken이 유효한지 검증하는 미들웨어
router.post('/refresh', loginController.refreshVerify);
router.get('/mypage', verifyMiddleware.verifyAccessToken, loginController.mypage);

// 예시: 세무사만 접근 가능한 상담 목록
// router.get(
//     '/tax/consults',
//     verifyMiddleware.verifyAccessToken,
//     verifyMiddleware.verifyTaxAccountant, // 우리가 만든 세무사 체크 미들웨어
//     taxController.getConsultList,
// );

module.exports = router;
