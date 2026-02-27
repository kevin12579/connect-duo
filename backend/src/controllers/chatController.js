// src/controllers/chatController.js
const chatService = require('../services/chatService');

function getMe(req) {
    return req.authUser;
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

        // ① 먼저 HTTP 응답 반환 (프론트의 tempId 교체용)
        res.json({ result: 'success', data: msg });

        // ② 소켓으로 방 전체(본인 포함)에 emit
        //
        // ✅ FIX BUG1: 이전 코드는 fetchSockets()를 써서 s.user를 체크했으나
        //    RemoteSocket 객체에는 socket.user 같은 임의 프로퍼티가 존재하지 않아
        //    아무에게도 emit 되지 않는 치명적 버그가 있었음.
        //
        //    해결책: io.to(roomId).emit() 으로 방 전체에 emit 하고
        //    프론트(ChatRoom.jsx)에서 내 메시지 중복을 직접 처리한다.
        //    → 프론트의 onReceiveMessage: 내 메시지가 도착하면 tempId를 실제id로 교체,
        //       이미 교체된 상태라면 id 중복 체크로 skip 처리.
        const io = req.app.get('io');
        io.to(String(roomId)).emit('receive_message', msg);
    } catch (e) {
        res.status(500).json({ result: 'fail', message: `[sendMessage] ${e.message}` });
    }
};

exports.uploadFiles = async (req, res) => {
    try {
        const me = getMe(req);
        const { roomId } = req.params;
        const files = req.files || [];
        const io = req.app.get('io');

        const results = [];
        for (const file of files) {
            const fileUrl = `/uploads/${file.filename}`;
            const msg = await chatService.sendMessage({
                roomId: toInt(roomId),
                senderId: me.id,
                content: '파일을 전송했습니다.',
                fileUrl,
                fileName: file.originalname,
                fileSize: file.size,
                fileMime: file.mimetype,
            });

            // 파일도 방 전체에 emit (프론트에서 id 중복 체크로 처리)
            io.to(String(roomId)).emit('receive_message', msg);
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
        const { roomId } = req.params;
        await chatService.markRead(toInt(roomId), me.id);

        const io = req.app.get('io');
        io.to(String(roomId)).emit('read_updated', { roomId, userId: me.id });

        res.json({ result: 'success' });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
};

exports.createRoom = async (req, res) => {
    try {
        const me = getMe(req);
        const { taxId, userId } = req.body;

        let finalUserId, finalTaxId;
        if (me.user_type === 'USER') {
            finalUserId = me.id;
            finalTaxId = taxId;
        } else {
            finalUserId = userId;
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

exports.closeRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        await chatService.closeRoom(toInt(roomId));

        const io = req.app.get('io');
        io.to(String(roomId)).emit('ROOM_CLOSED', { roomId });

        res.json({ result: 'success', message: '상담이 성공적으로 종료되었습니다.' });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: `[closeRoom] ${e.message}` });
    }
};

exports.listTaxActiveRooms = async (req, res) => {
    try {
        const me = getMe(req);
        const rooms = await chatService.listRooms(me.id);
        res.json({ result: 'success', data: rooms });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
};

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
