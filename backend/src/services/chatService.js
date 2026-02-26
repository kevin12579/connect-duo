const db = require('../config/dbPool');
const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

class ChatService {
    // 1. 내 채팅방 목록 조회
    async listRooms(userId) {
        const sql = `
        SELECT r.*, 
               u.name as partner_name, u.profile_img as partner_profile,
               (SELECT content FROM ChatMessages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) as last_message,
               (SELECT created_at FROM ChatMessages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
               (SELECT COUNT(*) FROM ChatMessages WHERE room_id = r.id AND sender_id != ? AND is_read = FALSE) as unread_count
        FROM ConsultRooms r
        JOIN Users u ON (r.user_id = u.id OR r.tax_id = u.id)
        WHERE (r.user_id = ? OR r.tax_id = ?) AND u.id != ?
        ORDER BY last_message_at DESC
    `;
        const [rows] = await db.execute(sql, [userId, userId, userId, userId]);
        return rows;
    }

    // 2. 메시지 목록 조회 (페이징)
    async listMessages({ roomId, cursor, limit = 20 }) {
        let sql = `SELECT * FROM ChatMessages WHERE room_id = ?`;
        const params = [roomId];

        if (cursor) {
            sql += ` AND id < ?`;
            params.push(cursor);
        }

        sql += ` ORDER BY id DESC LIMIT ${Number(limit)}`;

        const [rows] = await db.execute(sql, params);
        return rows.reverse();
    }

    // 3. 메시지 전송
    // ChatService.js의 sendMessage 함수 수정
    // ChatService.js의 sendMessage 함수 수정
    async sendMessage({
        roomId,
        senderId,
        content,
        fileUrl = null,
        fileName = null,
        fileSize = null,
        fileMime = null,
    }) {
        const [result] = await db.execute(
            `INSERT INTO ChatMessages 
            (room_id, sender_id, content, file_url, file_name, file_size, file_mime) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [roomId, senderId, content, fileUrl, fileName, fileSize, fileMime],
        );

        const [newMessage] = await db.execute(`SELECT * FROM ChatMessages WHERE id = ?`, [result.insertId]);
        return newMessage[0];
    }

    // 4. 읽음 처리
    async markRead(roomId, userId) {
        await db.execute(`UPDATE ChatMessages SET is_read = TRUE WHERE room_id = ? AND sender_id != ?`, [
            roomId,
            userId,
        ]);
    }

    // 5. [추가] 채팅방 생성 (중복 방지 로직 포함)
    async createRoom({ userId, taxId }) {
        // 이미 진행 중(ACTIVE)인 방이 있는지 확인
        const [existing] = await db.execute(
            `SELECT * FROM ConsultRooms WHERE user_id = ? AND tax_id = ? AND status = 'ACTIVE'`,
            [userId, taxId],
        );

        if (existing.length > 0) {
            return existing[0]; // 이미 존재하면 기존 방 반환
        }

        // 없다면 새로 생성
        const [result] = await db.execute(
            `INSERT INTO ConsultRooms (user_id, tax_id, status) VALUES (?, ?, 'ACTIVE')`,
            [userId, taxId],
        );

        const [newRoom] = await db.execute(`SELECT * FROM ConsultRooms WHERE id = ?`, [result.insertId]);
        return newRoom[0];
    }

    // 6. [수정/보강] 상담 종료
    async closeRoom(roomId) {
        await db.execute(`UPDATE ConsultRooms SET status = 'CLOSED', closed_at = NOW() WHERE id = ?`, [roomId]);
    }
    //채팅방 삭제
    async deleteRoom(roomId) {
        try {
            // 파일 찾기
            const [files] = await db.execute(
                'SELECT file_url FROM ChatMessages WHERE room_id = ? AND file_url IS NOT NULL',
                [roomId],
            );

            // 파일 삭제
            for (const row of files) {
                const fileUrl = row.file_url;
                if (fileUrl && typeof fileUrl === 'string') {
                    const fileName = fileUrl.replace(/^\/uploads\//, '');
                    const filePath = path.join(UPLOAD_DIR, fileName);
                    console.log('[deleteRoom] 파일 삭제 시도:', filePath);
                    try {
                        await fs.promises.unlink(filePath);
                    } catch (error) {
                        // 파일이 없으면 무시, 다른 에러는 기록
                        if (error.code !== 'ENOENT') {
                            console.error('[deleteRoom] 파일 삭제 실패:', filePath, error);
                        }
                    }
                }
            }

            // 메시지/방 삭제
            await db.execute('DELETE FROM ChatMessages WHERE room_id = ?', [roomId]);
            await db.execute('DELETE FROM ConsultRooms WHERE id = ?', [roomId]);
        } catch (error) {
            console.error('[deleteRoom] 전체 에러:', error);
            throw error; // 컨트롤러에서 catch됨
        }
    }
}

module.exports = new ChatService();
