const db = require('../config/dbPool');
const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

class ChatService {
    // ─── 1. 내 채팅방 목록 조회 ──────────────────────────────────────
    // partner_response_speed(파트너의 평균 응답시간/분)를 함께 반환합니다.
    async listRooms(userId) {
        const sql = `
            SELECT
                r.*,
                u.name        AS partner_name,
                u.profile_img AS partner_profile,
                (SELECT content    FROM ChatMessages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) AS last_message,
                (SELECT created_at FROM ChatMessages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
                (SELECT COUNT(*)   FROM ChatMessages WHERE room_id = r.id AND sender_id != ? AND is_read = FALSE) AS unread_count,
                IFNULL(tap.response_speed, 0) AS partner_response_speed
            FROM ConsultRooms r
            JOIN Users u ON (r.user_id = u.id OR r.tax_id = u.id) AND u.id != ?
            LEFT JOIN TaxAccountantProfile tap ON u.id = tap.user_id
            WHERE (r.user_id = ? OR r.tax_id = ?)
            ORDER BY last_message_at DESC
        `;
        const [rows] = await db.execute(sql, [userId, userId, userId, userId]);
        return rows;
    }

    // ─── 2. 메시지 목록 조회 (페이징) ───────────────────────────────
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

    // ─── 3. 메시지 전송 ─────────────────────────────────────────────
    /**
     * @param {object}  opts
     * @param {number}  opts.roomId
     * @param {number}  opts.senderId
     * @param {string}  opts.senderType  - 'USER' | 'TAX_ACCOUNTANT'
     * @param {string}  opts.content
     * @param {string}  [opts.fileUrl]
     * @param {string}  [opts.fileName]
     * @param {number}  [opts.fileSize]
     * @param {string}  [opts.fileMime]
     */
    async sendMessage({
        roomId,
        senderId,
        senderType = 'USER',
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

        // ★ 세무사가 보낸 메시지라면 실제 응답속도를 측정해서 DB에 반영
        // await 없이 실행 → 메시지 전송을 블로킹하지 않음
        if (senderType === 'TAX_ACCOUNTANT') {
            this._updateResponseSpeed(roomId, senderId).catch((e) =>
                console.error('[ChatService] 응답속도 업데이트 오류:', e),
            );
        }

        return newMessage[0];
    }

    // ─── 4. 읽음 처리 ───────────────────────────────────────────────
    async markRead(roomId, userId) {
        await db.execute(`UPDATE ChatMessages SET is_read = TRUE WHERE room_id = ? AND sender_id != ?`, [
            roomId,
            userId,
        ]);
    }

    // ─── 5. 채팅방 생성 (중복 방지) ──────────────────────────────────
    async createRoom({ userId, taxId }) {
        const [existing] = await db.execute(
            `SELECT * FROM ConsultRooms WHERE user_id = ? AND tax_id = ? AND status = 'ACTIVE'`,
            [userId, taxId],
        );
        if (existing.length > 0) return existing[0];

        const [result] = await db.execute(
            `INSERT INTO ConsultRooms (user_id, tax_id, status) VALUES (?, ?, 'ACTIVE')`,
            [userId, taxId],
        );
        const [newRoom] = await db.execute(`SELECT * FROM ConsultRooms WHERE id = ?`, [result.insertId]);
        return newRoom[0];
    }

    // ─── 6. 상담 종료 ────────────────────────────────────────────────
    async closeRoom(roomId) {
        await db.execute(`UPDATE ConsultRooms SET status = 'CLOSED', closed_at = NOW() WHERE id = ?`, [roomId]);
    }

    // ─── 7. 채팅방 삭제 ──────────────────────────────────────────────
    async deleteRoom(roomId) {
        try {
            const [files] = await db.execute(
                'SELECT file_url FROM ChatMessages WHERE room_id = ? AND file_url IS NOT NULL',
                [roomId],
            );

            for (const row of files) {
                const fileUrl = row.file_url;
                if (fileUrl && typeof fileUrl === 'string') {
                    const fileName = fileUrl.replace(/^\/uploads\//, '');
                    const filePath = path.join(UPLOAD_DIR, fileName);
                    try {
                        await fs.promises.unlink(filePath);
                    } catch (error) {
                        if (error.code !== 'ENOENT') {
                            console.error('[deleteRoom] 파일 삭제 실패:', filePath, error);
                        }
                    }
                }
            }

            await db.execute('DELETE FROM ChatMessages WHERE room_id = ?', [roomId]);
            await db.execute('DELETE FROM ConsultRooms WHERE id = ?', [roomId]);
        } catch (error) {
            console.error('[deleteRoom] 전체 에러:', error);
            throw error;
        }
    }

    // ─── [내부 private] 실제 응답속도 계산 및 업데이트 ───────────────
    /**
     * 세무사(taxUserId)가 참여한 모든 채팅방에서
     * "직전 유저 메시지 → 세무사 답장" 의 분 단위 시간 차이 평균을 구해서
     * TaxAccountantProfile.response_speed 에 반영합니다.
     *
     * 이상값 필터: 7일(10080분) 초과 응답은 집계에서 제외합니다.
     */
    async _updateResponseSpeed(roomId, taxUserId) {
        // 세무사가 참여한 모든 방의 메시지 기준으로 평균 계산
        const [avgRows] = await db.execute(
            `SELECT AVG(diff_min) AS avg_response
             FROM (
                 SELECT
                     TIMESTAMPDIFF(
                         MINUTE,
                         (
                             SELECT cm2.created_at
                             FROM   ChatMessages cm2
                             JOIN   ConsultRooms cr2 ON cm2.room_id = cr2.id
                             WHERE  cm2.room_id   = cm.room_id
                               AND  cm2.sender_id = cr2.user_id
                               AND  cm2.id        < cm.id
                             ORDER BY cm2.id DESC
                             LIMIT 1
                         ),
                         cm.created_at
                     ) AS diff_min
                 FROM ChatMessages cm
                 JOIN ConsultRooms cr ON cm.room_id = cr.id
                 WHERE cm.sender_id = ?
                   AND cr.tax_id   = ?
             ) t
             WHERE diff_min IS NOT NULL
               AND diff_min >= 0
               AND diff_min < 10080`,
            [taxUserId, taxUserId],
        );

        const avgMinutes = avgRows[0]?.avg_response;
        if (avgMinutes === null || avgMinutes === undefined) return;

        const rounded = Math.round(Number(avgMinutes));

        await db.execute('UPDATE TaxAccountantProfile SET response_speed = ? WHERE user_id = ?', [rounded, taxUserId]);

        console.log(`[ChatService] 세무사 id:${taxUserId} 평균 응답속도 → ${rounded}분`);
    }
}

module.exports = new ChatService();
