const express = require('express');
const router = express.Router();
const { askAi, getHistory } = require('../controllers/AiController');
const verifyMiddleware = require('../middlewares/verifyMiddleware'); // 인증 미들웨어

// 모든 AI 요청은 로그인이 필요함
router.get('/history', verifyMiddleware.verifyAccessToken, getHistory);
router.post('/ask', verifyMiddleware.verifyAccessToken, askAi);

module.exports = router;
