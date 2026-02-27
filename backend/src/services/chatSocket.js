// src/services/chatSocket.js
const jwt = require('jsonwebtoken');

module.exports = (io) => {
    // ─── JWT 인증 미들웨어 ───────────────────────────────────────────
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('인증이 필요합니다.'));

        jwt.verify(token, process.env.ACCESS_SECRET, (err, decoded) => {
            if (err) return next(new Error('유효하지 않은 토큰입니다.'));

            // ✅ FIX BUG6: socket.user → socket.data.user (Socket.io 표준)
            //    fetchSockets()가 반환하는 RemoteSocket에서 socket.data는 접근 가능하지만
            //    임의 프로퍼티(socket.user)는 접근 불가. socket.data로 통일한다.
            socket.data.user = decoded;
            next();
        });
    });

    io.on('connection', (socket) => {
        const user = socket.data.user;
        console.log(`✅ [Socket] Connected  : ${user.name} (id:${user.id}, socketId:${socket.id})`);

        // ✅ FIX BUG2: disconnect 시 socket.rooms가 이미 비어있으므로
        //    입장한 방 목록을 직접 Set으로 추적한다.
        const joinedRooms = new Set();

        // ─── 방 입장 ─────────────────────────────────────────────────
        socket.on('join_room', (roomId) => {
            const rid = String(roomId);
            socket.join(rid);
            joinedRooms.add(rid);
            console.log(`   [join_room] user:${user.id}(${user.name}) → room:${rid}`);

            // 본인을 제외한 같은 방 소켓에게 온라인 알림
            socket.to(rid).emit('user_online', { userId: user.id });
        });

        // ─── 방 퇴장 (프론트에서 명시적으로 emit) ──────────────────
        socket.on('leave_room', (roomId) => {
            const rid = String(roomId);
            socket.leave(rid);
            joinedRooms.delete(rid);
            console.log(`   [leave_room] user:${user.id}(${user.name}) ← room:${rid}`);

            socket.to(rid).emit('user_offline', { userId: user.id });
        });

        // ─── 연결 끊김 (탭 닫기, 네트워크 끊김 등) ──────────────────
        socket.on('disconnect', (reason) => {
            console.log(`❌ [Socket] Disconnect : ${user.name} (reason:${reason})`);

            // ✅ FIX BUG2: joinedRooms Set으로 추적한 방 목록으로 오프라인 emit
            joinedRooms.forEach((rid) => {
                socket.to(rid).emit('user_offline', { userId: user.id });
            });
            joinedRooms.clear();
        });
    });
};
