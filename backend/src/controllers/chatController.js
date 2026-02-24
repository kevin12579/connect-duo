// controllers/chatController.js
const chatService = require('../services/chatService');

function getUser(req) {
    if (req.authUser && req.authUser.id) return req.authUser;

    // ✅ 개발용 더미 유저
    return { id: 1, user_type: 'USER', name: 'DEV', username: 'dev@local' };
}

function toInt(v, fallback = null) {
    const n = Number(v);
    return Number.isNaN(n) ? fallback : n;
}

function toRoomId(raw) {
    // DB가 INT면 숫자로 맞추는게 안전
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
}

exports.listRooms = async (req, res) => {
    try {
        const me = getUser(req);
        const rooms = await chatService.listRooms(me.id);
        res.json({ result: 'success', data: rooms });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: `[listRooms] ${e.message}` });
    }
};

exports.createRoom = async (req, res) => {
    try {
        const me = getUser(req);
        let { taxId, title } = req.body || {};

        // ✅ 기본 taxId=2 (BOT/상담사)
        const parsedTaxId = toInt(taxId, 2);

        const room = await chatService.createRoom({
            userId: me.id,
            taxId: parsedTaxId,
            title,
        });

        res.json({ result: 'success', data: room });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: `[createRoom] ${e.message}` });
    }
};

exports.listMessages = async (req, res) => {
    try {
        const me = getUser(req);
        const { roomId } = req.params;
        const { cursor, limit } = req.query;

        const data = await chatService.listMessages({
            userId: me.id,
            roomId: toRoomId(roomId),
            // cursor/limit도 숫자형으로 받는게 안전(서비스는 parseInt 처리하지만)
            cursor: cursor ? toInt(cursor, cursor) : undefined,
            limit: limit ? toInt(limit, limit) : undefined,
        });

        res.json({ result: 'success', data });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: `[listMessages] ${e.message}` });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const me = getUser(req);
        const { roomId } = req.params;
        const { type = 'TEXT', content = '' } = req.body || {};

        // ✅ 서비스가 { user, ai } 형태로 리턴
        const data = await chatService.sendMessage({
            userId: me.id,
            roomId: toRoomId(roomId),
            type,
            content,
        });

        res.json({ result: 'success', data });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: `[sendMessage] ${e.message}` });
    }
};

exports.uploadFiles = async (req, res) => {
    try {
        const me = getUser(req);
        const { roomId } = req.params;

        const files = Array.isArray(req.files) ? req.files : [];
        const msgs = await chatService.attachFiles({
            userId: me.id,
            roomId: toRoomId(roomId),
            files,
        });

        res.json({ result: 'success', data: msgs });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: `[uploadFiles] ${e.message}` });
    }
};

exports.markRead = async (req, res) => {
    try {
        const me = getUser(req);
        const { roomId } = req.params;

        // ✅ 프론트가 lastReadMessageId 또는 messageId로 보내도 대응
        const { lastReadMessageId, messageId } = req.body || {};
        const lastIdRaw = lastReadMessageId ?? messageId ?? null;

        await chatService.markRead({
            userId: me.id,
            roomId: toRoomId(roomId),
            lastReadMessageId: lastIdRaw == null ? null : toInt(lastIdRaw, lastIdRaw),
        });

        res.json({ result: 'success' });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: `[markRead] ${e.message}` });
    }
};

exports.closeRoom = async (req, res) => {
    try {
        const me = getUser(req);
        const { roomId } = req.params;

        await chatService.closeRoom({
            userId: me.id,
            roomId: toRoomId(roomId),
        });

        res.json({ result: 'success' });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: `[closeRoom] ${e.message}` });
    }
};

exports.listTaxActiveRooms = async (req, res) => {
    try {
        const me = getUser(req);

        // ✅ 세무사면 본인 id, 아니면 DEV 기본 2
        const taxId = me.user_type === 'TAX_ACCOUNTANT' ? me.id : 2;

        const rooms = await chatService.listTaxActiveRooms(taxId);
        res.json({ result: 'success', data: rooms });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: `[listTaxActiveRooms] ${e.message}` });
    }
};

/**
 * (선택) ✅ 상담사 연결 API를 "정석"으로 분리하고 싶으면 이거 쓰면 됨
 * POST /chat/rooms/:roomId/connect  body: { taxId?: number }
 *
 * 프론트: connectRoom(rid, 2) 이런 식으로 호출 가능
 */
exports.connectRoom = async (req, res) => {
    try {
        const me = getUser(req);
        const { roomId } = req.params;
        const { taxId } = req.body || {};

        const data = await chatService.connectRoom({
            userId: me.id,
            roomId: toRoomId(roomId),
            taxId: toInt(taxId, 2),
        });

        res.json({ result: 'success', data });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: `[connectRoom] ${e.message}` });
    }
};
