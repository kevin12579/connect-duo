// src/services/chatService.js
const pool = require('../config/dbPool');

// ✅ uploadMiddleware의 normalizeOriginalName을 재사용 (중복/실수 방지)
const { normalizeOriginalName } = require('../middlewares/uploadMiddleware');

// ✅ 봇 sender_id
const BOT_ID = Number(process.env.CHAT_BOT_ID || 2);

/** 참여자 권한 체크 */
async function assertParticipant(connection, roomId, userId) {
    if (!userId) throw new Error('인증 정보가 없습니다. (userId 없음)');
    const sql = `SELECT 1 FROM ChatParticipants WHERE room_id=? AND user_id=?`;
    const [rows] = await connection.query(sql, [roomId, userId]);
    if (rows.length === 0) throw new Error('해당 채팅방 접근 권한이 없습니다.');
}

/** 세무사 참여자 보장 */
async function ensureTaxParticipant(connection, roomId, taxId) {
    const [rows] = await connection.query(`SELECT 1 FROM ChatParticipants WHERE room_id=? AND user_id=?`, [
        roomId,
        taxId,
    ]);
    if (rows.length) return;

    await connection.query(
        `INSERT INTO ChatParticipants (room_id, user_id, role, last_read_message_id, last_read_at)
         VALUES (?, ?, 'TAX_ACCOUNTANT', NULL, NOW())`,
        [roomId, taxId],
    );
}

/** ✅ users 테이블에 id 존재 여부 체크 (FK 방지) */
async function existsUserId(connection, userId) {
    const [rows] = await connection.query(`SELECT 1 FROM users WHERE id=? LIMIT 1`, [userId]);
    return rows.length > 0;
}

/** 시스템 메시지 insert */
async function insertSystemMessage(connection, roomId, content, senderId = BOT_ID) {
    const sql = `
        INSERT INTO ChatMessages (room_id, sender_id, type, content, created_at)
        VALUES (?, ?, 'SYSTEM', ?, NOW())
    `;
    const [res] = await connection.query(sql, [roomId, senderId, String(content || '')]);
    return res.insertId;
}

/** ✅ (옵션) LLM 호출: 키 없으면 임시 답변 */
async function generateAiReply(userText) {
    const text = String(userText || '').trim();
    if (!text) return '무엇을 도와드릴까요? 🙂';

    if (!process.env.OPENAI_API_KEY) {
        return (
            `(임시 AI) "${text}" 관련해서 도와드릴게요 🙂\n` +
            `정확한 안내를 위해 아래 중 알려주실 수 있나요?\n` +
            `- 사업자 등록 여부(없음/예정/있음)\n` +
            `- 판매 채널(스마트스토어/쿠팡/인스타/오프라인)\n` +
            `- 예상 매출(월/연 대략)\n`
        );
    }

    let OpenAI;
    try {
        OpenAI = require('openai');
    } catch (e) {
        return (
            `(임시 AI) "${text}" 관련해서 도와드릴게요 🙂\n` +
            `※ openai 패키지가 설치되지 않아 임시 응답으로 동작 중입니다.\n` +
            `- 사업자 등록 여부(없음/예정/있음)\n` +
            `- 판매 채널(스마트스토어/쿠팡/인스타/오프라인)\n` +
            `- 예상 매출(월/연 대략)\n`
        );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const resp = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content:
                    '너는 한국어 세무 상담 챗봇 "세무쳇"이야. 사용자의 상황을 먼저 파악하기 위해 필요한 질문을 하고, 실무적인 체크리스트/다음 단계 안내를 짧고 친절하게 해.',
            },
            { role: 'user', content: text },
        ],
        temperature: 0.5,
    });

    return resp.choices?.[0]?.message?.content?.trim() || '답변을 생성하지 못했어요. 다시 한번 말씀해 주세요.';
}

/** ✅ 마지막 메시지를 미리보기 문자열로 변환 */
function makeLastPreview(row) {
    if (!row) return '대화를 시작해보세요 🙂';

    const type = String(row.lastMessageType || '').toUpperCase();
    const content = String(row.lastMessageContent || '').trim();

    // ✅ DB에 저장된 file_name도 혹시 깨졌을 수 있어 여기서도 보정
    const fileName = normalizeOriginalName(String(row.lastMessageFileName || '').trim());

    if (type === 'IMAGE') return fileName ? `📷 [사진] ${fileName}` : '📷 [사진]';
    if (type === 'FILE') return fileName ? `📎 [파일] ${fileName}` : '📎 [파일]';
    if (content) return content;

    return '대화를 시작해보세요 🙂';
}

/** 방 목록 */
exports.listRooms = async (userId) => {
    const sql = `
        SELECT
          r.id,
          r.status,
          r.last_message_at AS updatedAt,
          COALESCE(r.title, '세무쳇') AS title,
          p.last_read_message_id AS lastReadMessageId,

          lm.type       AS lastMessageType,
          lm.content    AS lastMessageContent,
          lm.file_name  AS lastMessageFileName

        FROM ChatRooms r
        JOIN ChatParticipants p ON p.room_id = r.id

        LEFT JOIN (
          SELECT m1.*
          FROM ChatMessages m1
          JOIN (
            SELECT room_id, MAX(id) AS max_id
            FROM ChatMessages
            GROUP BY room_id
          ) t ON t.room_id = m1.room_id AND t.max_id = m1.id
        ) lm ON lm.room_id = r.id

        WHERE p.user_id = ?
        ORDER BY r.last_message_at DESC, r.updated_at DESC
    `;

    const [rows] = await pool.query(sql, [userId]);

    return rows.map((r) => ({
        ...r,
        lastMessagePreview: makeLastPreview(r),
    }));
};

/** 방 생성 */
exports.createRoom = async ({ userId, taxId, title }) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const roomSql = `
            INSERT INTO ChatRooms (title, status, created_at, updated_at, last_message_at)
            VALUES (?, 'ACTIVE', NOW(), NOW(), NOW())
        `;
        const [roomRes] = await conn.query(roomSql, [title || '세무쳇']);
        const roomId = roomRes.insertId;

        await conn.query(
            `INSERT INTO ChatParticipants (room_id, user_id, role, last_read_message_id, last_read_at)
             VALUES (?, ?, 'USER', NULL, NOW())`,
            [roomId, userId],
        );

        if (taxId) {
            await ensureTaxParticipant(conn, roomId, taxId);
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

/** 메시지 목록 */
exports.listMessages = async ({ userId, roomId, cursor, limit }) => {
    const conn = await pool.getConnection();
    try {
        await assertParticipant(conn, roomId, userId);

        const n = Math.min(100, Math.max(1, parseInt(limit || '30', 10)));
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

        // ✅ 파일명도 응답에서 보정해서 내려주면 프론트가 훨씬 편함
        const fixedRows = rows.map((r) => ({
            ...r,
            fileName: r.fileName ? normalizeOriginalName(r.fileName) : r.fileName,
        }));

        const nextCursor = fixedRows.length ? fixedRows[fixedRows.length - 1].id : null;
        const messages = fixedRows.reverse();

        return { messages, nextCursor };
    } finally {
        conn.release();
    }
};

/** 상담사 연결 */
exports.connectRoom = async ({ userId, roomId, taxId = BOT_ID }) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await assertParticipant(conn, roomId, userId);
        await ensureTaxParticipant(conn, roomId, taxId);

        await insertSystemMessage(conn, roomId, '상담사가 연결되었습니다 🙂', BOT_ID);
        await conn.query(`UPDATE ChatRooms SET last_message_at = NOW(), updated_at = NOW() WHERE id=?`, [roomId]);

        await conn.commit();
        return { ok: true };
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
};

/** 메시지 전송 */
exports.sendMessage = async ({ userId, roomId, type, content }) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await assertParticipant(conn, roomId, userId);

        const normType = String(type || 'TEXT').toUpperCase();
        const normContent = String(content || '');

        const insUserSql = `
            INSERT INTO ChatMessages (room_id, sender_id, type, content, created_at)
            VALUES (?, ?, ?, ?, NOW())
        `;
        const [userRes] = await conn.query(insUserSql, [roomId, userId, normType, normContent]);
        const userMsgId = userRes.insertId;

        await conn.query(`UPDATE ChatRooms SET last_message_at = NOW(), updated_at = NOW() WHERE id=?`, [roomId]);

        let aiMsgId = null;

        if (normType === 'TEXT' && normContent.trim()) {
            let aiText;
            try {
                aiText = await generateAiReply(normContent);
            } catch (e) {
                console.error('[AI ERROR] generateAiReply failed:', e);
                aiText = '(임시 AI) 현재 AI 응답 생성에 실패했어요. 잠시 후 다시 시도해 주세요 🙂';
            }

            let canSaveAi = true;
            try {
                const botExists = await existsUserId(conn, BOT_ID);
                if (!botExists) {
                    canSaveAi = false;
                    console.warn(`[WARN] BOT_ID(${BOT_ID})가 users에 없어 AI 메시지 저장 스킵(FK 방지)`);
                }
            } catch (e) {
                canSaveAi = false;
                console.warn('[WARN] BOT 존재 여부 체크 실패 → AI 저장 스킵:', e?.message || e);
            }

            if (canSaveAi) {
                try {
                    const insAiSql = `
                        INSERT INTO ChatMessages (room_id, sender_id, type, content, created_at)
                        VALUES (?, ?, 'TEXT', ?, NOW())
                    `;
                    const [aiRes] = await conn.query(insAiSql, [roomId, BOT_ID, aiText]);
                    aiMsgId = aiRes.insertId;

                    await conn.query(`UPDATE ChatRooms SET last_message_at = NOW(), updated_at = NOW() WHERE id=?`, [
                        roomId,
                    ]);
                } catch (e) {
                    console.error('[AI ERROR] AI message insert failed (skip):', e);
                    aiMsgId = null;
                }
            }
        }

        await conn.commit();

        const [userRows] = await conn.query(
            `SELECT id, room_id AS roomId, sender_id AS senderId, type, content, created_at AS createdAt
             FROM ChatMessages WHERE id=?`,
            [userMsgId],
        );
        const savedUser = userRows[0];

        let savedAi = null;
        if (aiMsgId) {
            const [aiRows] = await conn.query(
                `SELECT id, room_id AS roomId, sender_id AS senderId, type, content, created_at AS createdAt
                 FROM ChatMessages WHERE id=?`,
                [aiMsgId],
            );
            savedAi = aiRows[0] || null;
        }

        return { user: savedUser, ai: savedAi };
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
};

/** ✅ 파일 업로드 메시지 저장 */
exports.attachFiles = async ({ userId, roomId, files }) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await assertParticipant(conn, roomId, userId);

        const inserted = [];

        for (const f of files) {
            const fileUrl = `/uploads/${f.filename}`;
            const type = f.mimetype?.startsWith('image/') ? 'IMAGE' : 'FILE';

            // ✅ middleware에서 이미 고쳤지만, 혹시 몰라 한번 더 "안전" 보정
            const fixedOriginalName = normalizeOriginalName(f.originalname);

            const sql = `
                INSERT INTO ChatMessages (room_id, sender_id, type, content, file_url, file_name, file_mime, file_size, created_at)
                VALUES (?, ?, ?, '', ?, ?, ?, ?, NOW())
            `;
            const [r] = await conn.query(sql, [roomId, userId, type, fileUrl, fixedOriginalName, f.mimetype, f.size]);

            inserted.push({
                id: r.insertId,
                roomId,
                senderId: userId,
                type,
                content: '',
                fileUrl,
                fileName: fixedOriginalName,
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

/** 읽음 처리 */
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

/** 방 종료 */
exports.closeRoom = async ({ userId, roomId }) => {
    const conn = await pool.getConnection();
    try {
        await assertParticipant(conn, roomId, userId);
        await conn.query(`UPDATE ChatRooms SET status='CLOSED', closed_at=NOW(), updated_at=NOW() WHERE id=?`, [roomId]);
    } finally {
        conn.release();
    }
};

/** 세무사 ACTIVE 방 목록 */
exports.listTaxActiveRooms = async (taxId) => {
    const sql = `
        SELECT
          r.id,
          r.status,
          r.last_message_at AS updatedAt,
          COALESCE(r.title,'세무쳇') AS title,

          lm.type       AS lastMessageType,
          lm.content    AS lastMessageContent,
          lm.file_name  AS lastMessageFileName

        FROM ChatRooms r
        JOIN ChatParticipants p ON p.room_id = r.id

        LEFT JOIN (
          SELECT m1.*
          FROM ChatMessages m1
          JOIN (
            SELECT room_id, MAX(id) AS max_id
            FROM ChatMessages
            GROUP BY room_id
          ) t ON t.room_id = m1.room_id AND t.max_id = m1.id
        ) lm ON lm.room_id = r.id

        WHERE p.user_id = ? AND p.role='TAX_ACCOUNTANT' AND r.status='ACTIVE'
        ORDER BY r.last_message_at DESC
    `;
    const [rows] = await pool.query(sql, [taxId]);

    return rows.map((r) => ({
        ...r,
        lastMessagePreview: makeLastPreview(r),
    }));
};