// src/services/chatSocket.js
const jwt = require('jsonwebtoken');

module.exports = (io) => {
    // ─── JWT 인증 미들웨어 ───────────────────────────────────────────
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('인증이 필요합니다.'));

        jwt.verify(token, process.env.ACCESS_SECRET, (err, decoded) => {
            if (err) return next(new Error('유효하지 않은 토큰입니다.'));
            // socket.data.user에 인증 정보 저장
            socket.data.user = decoded;
            next();
        });
    });

    io.on('connection', (socket) => {
        const user = socket.data.user;
        console.log(`✅ [Socket] Connected  : ${user.name} (id:${user.id}, socketId:${socket.id})`);

        const joinedRooms = new Set();

        // ─── 방 입장 ─────────────────────────────────────────────────
        socket.on('join_room', (roomId) => {
            const rid = String(roomId);
            socket.join(rid);
            joinedRooms.add(rid);
            console.log(`   [join_room] user:${user.id}(${user.name}) → room:${rid}`);

            // 1. 현재 이 방(rid)에 접속해 있는 모든 소켓에서 유저 ID 수집
            const clients = io.sockets.adapter.rooms.get(rid);
            const userIds = [];
            if (clients) {
                clients.forEach((clientId) => {
                    const clientSocket = io.sockets.sockets.get(clientId);
                    // 미들웨어에서 설정한 socket.data.user.id 사용
                    if (clientSocket?.data?.user?.id) {
                        userIds.push(String(clientSocket.data.user.id));
                    }
                });
            }

            // 2. 방금 들어온 본인에게 현재 접속 중인 유저 목록 전송
            socket.emit('room_users', { users: userIds });

            // 3. 기존 방식: 다른 사람들에게 내가 들어왔음을 알림
            io.to(rid).emit('user_online', { userId: user.id });
        });

        // ─── 방 퇴장 ─────────────────────────────────────────────────
        socket.on('leave_room', (roomId) => {
            const rid = String(roomId);
            socket.leave(rid);
            joinedRooms.delete(rid);
            console.log(`   [leave_room] user:${user.id}(${user.name}) ← room:${rid}`);
            socket.to(rid).emit('user_offline', { userId: user.id });
        });

        // ─── 연결 끊김 ───────────────────────────────────────────────
        socket.on('disconnect', (reason) => {
            console.log(`❌ [Socket] Disconnect : ${user.name} (reason:${reason})`);
            joinedRooms.forEach((rid) => {
                socket.to(rid).emit('user_offline', { userId: user.id });
            });
            joinedRooms.clear();
        });
    });
};
