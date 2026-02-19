// const chatService = require('../services/chatService');

// exports.listRooms = async (req, res) => {
//     try {
//         const userId = req.authUser.id;
//         const rooms = await chatService.listRooms(userId);
//         res.json({ result: 'success', data: rooms });
//     } catch (e) {
//         res.status(500).json({ result: 'fail', message: e.message });
//     }
// };

// exports.createRoom = async (req, res) => {
//     try {
//         const userId = req.authUser.id;
//         const { taxId, title } = req.body; // taxId optional
//         const room = await chatService.createRoom({ userId, taxId, title });
//         res.json({ result: 'success', data: room });
//     } catch (e) {
//         res.status(500).json({ result: 'fail', message: e.message });
//     }
// };

// exports.listMessages = async (req, res) => {
//     try {
//         const userId = req.authUser.id;
//         const { roomId } = req.params;
//         const { cursor, limit } = req.query;
//         const data = await chatService.listMessages({ userId, roomId, cursor, limit });
//         res.json({ result: 'success', data });
//     } catch (e) {
//         res.status(500).json({ result: 'fail', message: e.message });
//     }
// };

// exports.sendMessage = async (req, res) => {
//     try {
//         const userId = req.authUser.id;
//         const { roomId } = req.params;
//         const { type = 'TEXT', content = '' } = req.body;

//         const msg = await chatService.sendMessage({ userId, roomId, type, content });
//         res.json({ result: 'success', data: msg });
//     } catch (e) {
//         res.status(500).json({ result: 'fail', message: e.message });
//     }
// };

// exports.uploadFiles = async (req, res) => {
//     try {
//         const userId = req.authUser.id;
//         const { roomId } = req.params;

//         const files = req.files || [];
//         const msgs = await chatService.attachFiles({ userId, roomId, files });
//         res.json({ result: 'success', data: msgs });
//     } catch (e) {
//         res.status(500).json({ result: 'fail', message: e.message });
//     }
// };

// exports.markRead = async (req, res) => {
//     try {
//         const userId = req.authUser.id;
//         const { roomId } = req.params;
//         const { lastReadMessageId } = req.body;
//         await chatService.markRead({ userId, roomId, lastReadMessageId });
//         res.json({ result: 'success' });
//     } catch (e) {
//         res.status(500).json({ result: 'fail', message: e.message });
//     }
// };

// exports.closeRoom = async (req, res) => {
//     try {
//         const userId = req.authUser.id;
//         const { roomId } = req.params;
//         await chatService.closeRoom({ userId, roomId });
//         res.json({ result: 'success' });
//     } catch (e) {
//         res.status(500).json({ result: 'fail', message: e.message });
//     }
// };

// exports.listTaxActiveRooms = async (req, res) => {
//     try {
//         const taxId = req.authUser.id;
//         const rooms = await chatService.listTaxActiveRooms(taxId);
//         res.json({ result: 'success', data: rooms });
//     } catch (e) {
//         res.status(500).json({ result: 'fail', message: e.message });
//     }
// };

const chatService = require('../services/chatService');

// ✅ 개발용: 인증 미들웨어 껐을 때도 안 터지게
function getUser(req) {
    // 토큰 붙어있으면 그걸 쓰고
    if (req.authUser && req.authUser.id) return req.authUser;

    // 토큰 없으면 개발용 임시 유저
    return { id: 1, user_type: 'USER', name: 'DEV', username: 'dev@local' };
}

exports.listRooms = async (req, res) => {
    try {
        const me = getUser(req);
        const rooms = await chatService.listRooms(me.id);
        res.json({ result: 'success', data: rooms });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
};

exports.createRoom = async (req, res) => {
    try {
        const me = getUser(req);
        const { taxId, title } = req.body; // taxId optional
        const room = await chatService.createRoom({ userId: me.id, taxId, title });
        res.json({ result: 'success', data: room });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
};

exports.listMessages = async (req, res) => {
    try {
        const me = getUser(req);
        const { roomId } = req.params;
        const { cursor, limit } = req.query;
        const data = await chatService.listMessages({ userId: me.id, roomId, cursor, limit });
        res.json({ result: 'success', data });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const me = getUser(req);
        const { roomId } = req.params;
        const { type = 'TEXT', content = '' } = req.body;

        const msg = await chatService.sendMessage({ userId: me.id, roomId, type, content });
        res.json({ result: 'success', data: msg });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
};

exports.uploadFiles = async (req, res) => {
    try {
        const me = getUser(req);
        const { roomId } = req.params;

        const files = req.files || [];
        const msgs = await chatService.attachFiles({ userId: me.id, roomId, files });
        res.json({ result: 'success', data: msgs });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
};

exports.markRead = async (req, res) => {
    try {
        const me = getUser(req);
        const { roomId } = req.params;
        const { lastReadMessageId } = req.body;
        await chatService.markRead({ userId: me.id, roomId, lastReadMessageId });
        res.json({ result: 'success' });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
};

exports.closeRoom = async (req, res) => {
    try {
        const me = getUser(req);
        const { roomId } = req.params;
        await chatService.closeRoom({ userId: me.id, roomId });
        res.json({ result: 'success' });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
};

exports.listTaxActiveRooms = async (req, res) => {
    try {
        const me = getUser(req);
        // 세무사 목록 API는 개발용으로 taxId도 임시값 줄 수 있음
        const taxId = me.user_type === 'TAX_ACCOUNTANT' ? me.id : 2;
        const rooms = await chatService.listTaxActiveRooms(taxId);
        res.json({ result: 'success', data: rooms });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
};
