const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { verifyAccessToken, verifyTaxAccountant } = require('../middlewares/verifyMiddleware');
const { upload } = require('../middlewares/uploadMiddleware');

/**
 * 모든 채팅 API는 로그인이 필요하므로 verifyAccessToken을 먼저 거칩니다.
 */

// 1. 내 채팅방 목록
router.get('/rooms', verifyAccessToken, chatController.listRooms);

// 2. [추가] 채팅방 생성
router.post('/rooms', verifyAccessToken, chatController.createRoom);

// 3. 특정 방 메시지 조회
router.get('/rooms/:roomId/messages', verifyAccessToken, chatController.listMessages);

// 4. 메시지 전송
router.post('/rooms/:roomId/messages', verifyAccessToken, chatController.sendMessage);

// 5. 읽음 처리
router.post('/rooms/:roomId/read', verifyAccessToken, chatController.markRead);

// 6. [추가] 상담(채팅방) 종료
router.post('/rooms/:roomId/close', verifyAccessToken, chatController.closeRoom);

// 7. 파일 업로드
router.post('/rooms/:roomId/upload', verifyAccessToken, upload.array('files', 5), chatController.uploadFiles);

// 8. (세무사 전용) 활성 채팅방 목록 조회
router.get('/tax/active', verifyAccessToken, verifyTaxAccountant, chatController.listTaxActiveRooms);

// 9. 채팅방 삭제
router.delete('/rooms/:roomId', verifyAccessToken, chatController.deleteRoom);
module.exports = router;
