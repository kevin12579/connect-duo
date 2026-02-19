// const express = require('express');
// const router = express.Router();

// const chatController = require('../controllers/chatController');
// const verifyMiddleware = require('../middlewares/verifyMiddleware');
// const { upload } = require('../middlewares/uploadMiddleware');

// // ✅ 내 채팅방 목록
// router.get('/rooms', verifyMiddleware.verifyAccessToken, chatController.listRooms);

// // ✅ 방 생성 (상담 신청 수락 시 만들거면 나중에 제한)
// router.post('/rooms', verifyMiddleware.verifyAccessToken, chatController.createRoom);

// // ✅ 특정 방 메시지 조회 (페이징)
// router.get('/rooms/:roomId/messages', verifyMiddleware.verifyAccessToken, chatController.listMessages);

// // ✅ 메시지 전송(텍스트)
// router.post('/rooms/:roomId/messages', verifyMiddleware.verifyAccessToken, chatController.sendMessage);

// // ✅ 읽음 처리
// router.post('/rooms/:roomId/read', verifyMiddleware.verifyAccessToken, chatController.markRead);

// // ✅ 파일 업로드 (TXT/사진)
// router.post(
//     '/rooms/:roomId/upload',
//     verifyMiddleware.verifyAccessToken,
//     upload.array('files', 5), // form-data key="files"
//     chatController.uploadFiles,
// );

// // ✅ 상담 종료
// router.post('/rooms/:roomId/close', verifyMiddleware.verifyAccessToken, chatController.closeRoom);

// // ✅ (세무사용) 내가 맡은 활성 채팅방
// router.get(
//     '/tax/active',
//     verifyMiddleware.verifyAccessToken,
//     verifyMiddleware.verifyTaxAccountant,
//     chatController.listTaxActiveRooms,
// );

// module.exports = router;

console.log('✅ chatRouter loaded:', __filename);

const express = require('express');
const router = express.Router();

const chatController = require('../controllers/chatController');
// const verifyMiddleware = require('../middlewares/verifyMiddleware'); // ✅ 개발용: 잠깐 주석
const { upload } = require('../middlewares/uploadMiddleware');

// ✅ 내 채팅방 목록
router.get('/rooms', chatController.listRooms);

// ✅ 방 생성
router.post('/rooms', chatController.createRoom);

// ✅ 특정 방 메시지 조회
router.get('/rooms/:roomId/messages', chatController.listMessages);

// ✅ 메시지 전송(텍스트)
router.post('/rooms/:roomId/messages', chatController.sendMessage);

// ✅ 읽음 처리
router.post('/rooms/:roomId/read', chatController.markRead);

// ✅ 파일 업로드 (TXT/사진)
router.post('/rooms/:roomId/upload', upload.array('files', 5), chatController.uploadFiles);

// ✅ 상담 종료
router.post('/rooms/:roomId/close', chatController.closeRoom);

// ✅ (세무사용) 활성 채팅방
router.get('/tax/active', chatController.listTaxActiveRooms);

module.exports = router;
