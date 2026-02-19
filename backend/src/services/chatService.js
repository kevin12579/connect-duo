const pool = require('../config/dbPool');

async function assertParticipant(connection, roomId, userId) {
    const sql = `SELECT 1 FROM ChatParticipants WHERE room_id=? AND user_id=?`;
    const [rows] = await connection.query(sql, [roomId, userId]);
    if (rows.length === 0) throw new Error('해당 채팅방 접근 권한이 없습니다.');
}

exports.listRooms = async (userId) => {
    const sql = `
    SELECT r.id, r.status, r.last_message_at AS updatedAt,
           COALESCE(r.title, '세무쳇') AS title,
           p.last_read_message_id AS lastReadMessageId
    FROM ChatRooms r
    JOIN ChatParticipants p ON p.room_id = r.id
    WHERE p.user_id = ?
    ORDER BY r.last_message_at DESC, r.updated_at DESC
  `;
    const [rows] = await pool.query(sql, [userId]);
    return rows;
};

exports.createRoom = async ({ userId, taxId, title }) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const roomSql = `INSERT INTO ChatRooms (title, status, created_at, updated_at, last_message_at) VALUES (?, 'ACTIVE', NOW(), NOW(), NOW())`;
        const [roomRes] = await conn.query(roomSql, [title || '세무쳇']);
        const roomId = roomRes.insertId;

        const partSql = `INSERT INTO ChatParticipants (room_id, user_id, role, last_read_message_id, last_read_at)
                     VALUES (?, ?, 'USER', NULL, NOW())`;
        await conn.query(partSql, [roomId, userId]);

        if (taxId) {
            const taxPartSql = `INSERT INTO ChatParticipants (room_id, user_id, role, last_read_message_id, last_read_at)
                          VALUES (?, ?, 'TAX_ACCOUNTANT', NULL, NOW())`;
            await conn.query(taxPartSql, [roomId, taxId]);
        }

        await conn.commit();
        return { id: roomId, title: title || '세무쳇', status: 'ACTIVE' };
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
};

exports.listMessages = async ({ userId, roomId, cursor, limit }) => {
    const conn = await pool.getConnection();
    try {
        await assertParticipant(conn, roomId, userId);

        const n = Math.min(100, Math.max(1, parseInt(limit || '30', 10)));

        // cursor: 마지막으로 받은 message id (무한스크롤)
        const whereCursor = cursor ? `AND m.id < ?` : '';
        const params = cursor ? [roomId, cursor, n] : [roomId, n];

        const sql = `
      SELECT m.id, m.room_id AS roomId, m.sender_id AS senderId,
             m.type, m.content, m.file_url AS fileUrl, m.file_name AS fileName,
             m.file_mime AS fileMime, m.file_size AS fileSize,
             m.created_at AS createdAt
      FROM ChatMessages m
      WHERE m.room_id = ?
      ${whereCursor}
      ORDER BY m.id DESC
      LIMIT ?
    `;
        const [rows] = await conn.query(sql, params);

        // 최신→과거로 뽑았으니 프론트 편하게 과거→최신으로 뒤집어줌
        const messages = rows.reverse();
        const nextCursor = rows.length ? rows[rows.length - 1].id : null;

        return { messages, nextCursor };
    } finally {
        conn.release();
    }
};

exports.sendMessage = async ({ userId, roomId, type, content }) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await assertParticipant(conn, roomId, userId);

        const insSql = `
      INSERT INTO ChatMessages (room_id, sender_id, type, content, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `;
        const [res] = await conn.query(insSql, [roomId, userId, type, content]);

        const msgId = res.insertId;

        await conn.query(`UPDATE ChatRooms SET last_message_at = NOW(), updated_at = NOW() WHERE id=?`, [roomId]);

        await conn.commit();

        const [rows] = await conn.query(
            `SELECT id, room_id AS roomId, sender_id AS senderId, type, content, created_at AS createdAt
       FROM ChatMessages WHERE id=?`,
            [msgId],
        );
        return rows[0];
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
};

exports.attachFiles = async ({ userId, roomId, files }) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await assertParticipant(conn, roomId, userId);

        const inserted = [];

        for (const f of files) {
            const fileUrl = `/uploads/${f.filename}`;
            const type = f.mimetype.startsWith('image/') ? 'IMAGE' : 'FILE';

            const sql = `
        INSERT INTO ChatMessages (room_id, sender_id, type, content, file_url, file_name, file_mime, file_size, created_at)
        VALUES (?, ?, ?, '', ?, ?, ?, ?, NOW())
      `;
            const [r] = await conn.query(sql, [roomId, userId, type, fileUrl, f.originalname, f.mimetype, f.size]);
            inserted.push({
                id: r.insertId,
                roomId,
                senderId: userId,
                type,
                content: '',
                fileUrl,
                fileName: f.originalname,
                fileMime: f.mimetype,
                fileSize: f.size,
            });
        }

        await conn.query(`UPDATE ChatRooms SET last_message_at = NOW(), updated_at = NOW() WHERE id=?`, [roomId]);
        await conn.commit();

        return inserted;
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
};

exports.markRead = async ({ userId, roomId, lastReadMessageId }) => {
    const conn = await pool.getConnection();
    try {
        await assertParticipant(conn, roomId, userId);

        const sql = `
      UPDATE ChatParticipants
      SET last_read_message_id = ?, last_read_at = NOW()
      WHERE room_id = ? AND user_id = ?
    `;
        await conn.query(sql, [lastReadMessageId || null, roomId, userId]);
    } finally {
        conn.release();
    }
};

exports.closeRoom = async ({ userId, roomId }) => {
    const conn = await pool.getConnection();
    try {
        await assertParticipant(conn, roomId, userId);
        await conn.query(`UPDATE ChatRooms SET status='CLOSED', closed_at=NOW(), updated_at=NOW() WHERE id=?`, [
            roomId,
        ]);

        // 시스템 메시지로 "상담 종료" 남기고 싶으면 여기서 INSERT하면 됨
    } finally {
        conn.release();
    }
};

exports.listTaxActiveRooms = async (taxId) => {
    const sql = `
    SELECT r.id, r.status, r.last_message_at AS updatedAt, COALESCE(r.title,'세무쳇') AS title
    FROM ChatRooms r
    JOIN ChatParticipants p ON p.room_id = r.id
    WHERE p.user_id = ? AND p.role='TAX_ACCOUNTANT' AND r.status='ACTIVE'
    ORDER BY r.last_message_at DESC
  `;
    const [rows] = await pool.query(sql, [taxId]);
    return rows;
};
