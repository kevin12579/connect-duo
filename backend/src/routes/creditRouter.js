// src/routes/creditRouter.js
const express = require('express');
const router = express.Router();
const creditController = require('../controllers/creditController');
const { verifyAccessToken } = require('../middlewares/verifyMiddleware');

// 잔액 조회 (본인 or 관리자만)
router.get('/balance/:userId', verifyAccessToken, creditController.getCredit);

// 충전 (구매)
router.post('/charge', verifyAccessToken, creditController.chargeCredit);

// 차감 (상품 구매)
router.post('/deduct', verifyAccessToken, creditController.deductCredit);

// 수동 수정 (관리자용)
router.put('/update', verifyAccessToken, creditController.updateCredit);

// 전액 초기화
router.delete('/reset/:userId', verifyAccessToken, creditController.deleteCredit);

// 거래 내역 조회
router.get('/history/:userId', verifyAccessToken, creditController.getCreditHistory);

module.exports = router;
