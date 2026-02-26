const chatService = require('../services/chatService');

// ✅ 미들웨어에서 넣어준 인증 정보를 가져오는 함수
function getMe(req) {
    return req.authUser; // verifyAccessToken 미들웨어가 넣어준 정보
}

function toInt(v, fallback = null) {
    const n = Number(v);
    return Number.isNaN(n) ? fallback : n;
}

exports.listRooms = async (req, res) => {
    try {
        const rooms = await chatService.listRooms(getMe(req).id);
        res.json({ result: 'success', data: rooms });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
};

exports.listMessages = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { cursor, limit } = req.query;

        const messages = await chatService.listMessages({
            roomId: toInt(roomId),
            cursor: cursor ? toInt(cursor) : null,
            limit: limit ? toInt(limit) : 20,
        });

        res.json({ result: 'success', data: messages });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: `[listMessages] ${e.message}` });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const me = getMe(req);
        const { roomId } = req.params;
        const { content } = req.body;

        const msg = await chatService.sendMessage({
            roomId: toInt(roomId),
            senderId: me.id,
            content,
        });

        res.json({ result: 'success', data: msg });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: `[sendMessage] ${e.message}` });
    }
};

exports.uploadFiles = async (req, res) => {
    try {
        const me = getMe(req);
        const { roomId } = req.params;
        const files = req.files || [];

        const results = [];
        for (const file of files) {
            const fileUrl = `/uploads/${file.filename}`;
            const msg = await chatService.sendMessage({
                roomId: toInt(roomId),
                senderId: me.id,
                content: '파일을 전송했습니다.',
                fileUrl,
                fileName: file.originalname, // 원본 파일명 (예: '보고서.pdf')
                fileSize: file.size, // 파일 크기 (byte 단위)
                fileMime: file.mimetype, // 파일 타입 (예: 'image/png')
            });
            results.push(msg);
        }

        res.json({ result: 'success', data: results });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: `[uploadFiles] ${e.message}` });
    }
};

exports.markRead = async (req, res) => {
    try {
        const me = getMe(req);
        await chatService.markRead(toInt(req.params.roomId), me.id);
        res.json({ result: 'success' });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
};

// ✅ [추가] 채팅방 생성
exports.createRoom = async (req, res) => {
    try {
        const me = getMe(req);
        const { taxId, userId } = req.body;

        // 접속한 유저의 타입에 따라 파라미터 매핑
        let finalUserId, finalTaxId;
        if (me.user_type === 'USER') {
            finalUserId = me.id;
            finalTaxId = taxId; // 유저가 요청 시 taxId를 받아옴
        } else {
            finalUserId = userId; // 세무사가 요청 시 userId를 받아옴
            finalTaxId = me.id;
        }

        if (!finalUserId || !finalTaxId) {
            return res.status(400).json({ result: 'fail', message: '대화 상대방의 ID가 필요합니다.' });
        }

        const room = await chatService.createRoom({ userId: finalUserId, taxId: finalTaxId });
        res.json({ result: 'success', data: room });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: `[createRoom] ${e.message}` });
    }
};

// ✅ [추가] 상담(채팅방) 종료
exports.closeRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        await chatService.closeRoom(toInt(roomId));
        res.json({ result: 'success', message: '상담이 성공적으로 종료되었습니다.' });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: `[closeRoom] ${e.message}` });
    }
};

// ✅ 세무사용 활성 채팅방 목록
exports.listTaxActiveRooms = async (req, res) => {
    try {
        const me = getMe(req);
        const rooms = await chatService.listRooms(me.id);
        res.json({ result: 'success', data: rooms });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
};

// chatController.js
exports.deleteRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        await chatService.deleteRoom(Number(roomId));
        res.json({ result: 'success', message: '채팅방이 정상적으로 삭제되었습니다.' });
    } catch (e) {
        console.error('[deleteRoom] 컨트롤러 에러:', e);
        res.status(500).json({ result: 'fail', message: `[deleteRoom] ${e.message}` });
    }
};
