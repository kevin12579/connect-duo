// src/services/chatSocket.js
const jwt = require('jsonwebtoken');

// ── 전역 온라인 유저 추적 (userId → socketId Set) ────────────────────
const onlineUsers = new Map(); // key: String(userId), value: Set<socketId>

module.exports = (io) => {
    // ─── JWT 인증 미들웨어 ───────────────────────────────────────────
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('인증이 필요합니다.'));

        jwt.verify(token, process.env.ACCESS_SECRET, (err, decoded) => {
            if (err) return next(new Error('유효하지 않은 토큰입니다.'));
            socket.data.user = decoded;
            next();
        });
    });

    io.on('connection', (socket) => {
        const user = socket.data.user;
        const uid = String(user.id);
        console.log(`✅ [Socket] Connected  : ${user.name} (id:${uid}, socketId:${socket.id})`);

        // ── 전역 온라인 등록 ──────────────────────────────────────────
        if (!onlineUsers.has(uid)) onlineUsers.set(uid, new Set());
        onlineUsers.get(uid).add(socket.id);

        // 새 연결에게 현재 전체 온라인 목록 전송
        socket.emit('online_user_list', { userIds: [...onlineUsers.keys()] });

        // 다른 모든 소켓에 이 유저가 온라인임을 알림
        socket.broadcast.emit('global_user_online', { userId: uid });

        const joinedRooms = new Set();

        // ─── 온라인 목록 재요청 (탭 전환 후 재마운트 시) ────────────
        socket.on('get_online_users', () => {
            socket.emit('online_user_list', { userIds: [...onlineUsers.keys()] });
        });

        // ─── 방 입장 ─────────────────────────────────────────────────
        socket.on('join_room', (roomId) => {
            const rid = String(roomId);
            socket.join(rid);
            joinedRooms.add(rid);
            console.log(`   [join_room] user:${uid}(${user.name}) → room:${rid}`);

            // 이 방에 접속 중인 유저 ID 수집
            const clients = io.sockets.adapter.rooms.get(rid);
            const userIds = [];
            if (clients) {
                clients.forEach((clientId) => {
                    const clientSocket = io.sockets.sockets.get(clientId);
                    if (clientSocket?.data?.user?.id) {
                        userIds.push(String(clientSocket.data.user.id));
                    }
                });
            }

            // 본인에게 현재 방 접속자 목록 전송
            socket.emit('room_users', { users: userIds });
            // 방 전체에 온라인 알림
            io.to(rid).emit('user_online', { userId: uid });
        });

        // ─── ✅ 크레딧 부족 종료 알림 (USER → 세무사에게 relay) ──────
        socket.on('credit_shortage', ({ roomId }) => {
            const rid = String(roomId);
            // 나를 제외한 방 나머지에게 전달
            socket.to(rid).emit('credit_shortage', { roomId: rid });
        });

        // ─── 방 퇴장 ─────────────────────────────────────────────────
        socket.on('leave_room', (roomId) => {
            const rid = String(roomId);
            socket.leave(rid);
            joinedRooms.delete(rid);
            console.log(`   [leave_room] user:${uid}(${user.name}) ← room:${rid}`);
            socket.to(rid).emit('user_offline', { userId: uid });
        });

        // ─── 연결 끊김 ───────────────────────────────────────────────
        socket.on('disconnect', (reason) => {
            console.log(`❌ [Socket] Disconnect : ${user.name} (reason:${reason})`);

            // 방별 offline 알림
            joinedRooms.forEach((rid) => {
                socket.to(rid).emit('user_offline', { userId: uid });
            });
            joinedRooms.clear();

            // 전역 온라인 제거
            const userSockets = onlineUsers.get(uid);
            if (userSockets) {
                userSockets.delete(socket.id);
                if (userSockets.size === 0) {
                    onlineUsers.delete(uid);
                    // 이 유저의 소켓이 전부 끊어졌을 때만 오프라인 브로드캐스트
                    socket.broadcast.emit('global_user_offline', { userId: uid });
                }
            }
        });

        socket.on('timer_sync', ({ roomId, consultSec, billingSec }) => {
            socket.to(String(roomId)).emit('timer_sync', { consultSec, billingSec });
        });

        socket.on('request_timer_sync', ({ roomId }) => {
            socket.to(String(roomId)).emit('request_timer_sync', { roomId });
        });
    });
};
