// src/controllers/creditController.js
const pool = require('../config/dbPool');

/** 잔액 조회 */
exports.getCredit = async (req, res) => {
    const { userId } = req.params;
    try {
        const [rows] = await pool.query('SELECT credit FROM Users WHERE id = ?', [userId]);
        if (rows.length === 0) return res.status(404).json({ result: 'fail', message: '유저 없음' });
        res.json({ result: 'success', credit: rows[0].credit || 0 });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
};

/** 충전 */
exports.chargeCredit = async (req, res) => {
    const { user_id, amount, description } = req.body;
    if (!user_id || !amount || amount <= 0)
        return res.status(400).json({ result: 'fail', message: '유효하지 않은 요청입니다.' });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query('UPDATE Users SET credit = credit + ? WHERE id = ?', [amount, user_id]);
        const [[{ credit }]] = await conn.query('SELECT credit FROM Users WHERE id = ?', [user_id]);
        await conn.query(
            'INSERT INTO CreditTransactions (user_id, type, amount, description, balance_after) VALUES (?, ?, ?, ?, ?)',
            [user_id, 'CHARGE', amount, description || '크레딧 충전', credit],
        );

        await conn.commit();
        res.json({ result: 'success', credit, message: `${amount.toLocaleString()} 크레딧 충전 완료` });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ result: 'fail', message: e.message });
    } finally {
        conn.release();
    }
};

/** 차감 */
exports.deductCredit = async (req, res) => {
    const { user_id, amount, description } = req.body;
    if (!user_id || !amount || amount <= 0)
        return res.status(400).json({ result: 'fail', message: '유효하지 않은 요청입니다.' });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[user]] = await conn.query('SELECT credit FROM Users WHERE id = ? FOR UPDATE', [user_id]);
        if (!user || user.credit < amount) {
            await conn.rollback();
            return res.status(400).json({ result: 'fail', message: '크레딧이 부족합니다.' });
        }

        const newCredit = user.credit - amount;
        await conn.query('UPDATE Users SET credit = ? WHERE id = ?', [newCredit, user_id]);
        await conn.query(
            'INSERT INTO CreditTransactions (user_id, type, amount, description, balance_after) VALUES (?, ?, ?, ?, ?)',
            [user_id, 'DEDUCT', amount, description || '크레딧 차감', newCredit],
        );

        await conn.commit();
        res.json({ result: 'success', credit: newCredit });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ result: 'fail', message: e.message });
    } finally {
        conn.release();
    }
};

/** 수동 수정 (관리자) */
exports.updateCredit = async (req, res) => {
    const { user_id, credit, description } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('UPDATE Users SET credit = ? WHERE id = ?', [credit, user_id]);
        await conn.query(
            'INSERT INTO CreditTransactions (user_id, type, amount, description, balance_after) VALUES (?, ?, ?, ?, ?)',
            [user_id, 'CHARGE', credit, description || '관리자 수동 조정', credit],
        );
        await conn.commit();
        res.json({ result: 'success', credit });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ result: 'fail', message: e.message });
    } finally {
        conn.release();
    }
};

/** 전액 초기화 */
exports.deleteCredit = async (req, res) => {
    const { userId } = req.params;
    try {
        await pool.query('UPDATE Users SET credit = 0 WHERE id = ?', [userId]);
        res.json({ result: 'success', credit: 0 });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
};

/** 거래 내역 조회 — { result: 'success', data: [...] } 형식 */
exports.getCreditHistory = async (req, res) => {
    const { userId } = req.params;
    try {
        const [rows] = await pool.query(
            `SELECT id, type, amount, description, balance_after, created_at
             FROM CreditTransactions
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 50`,
            [userId],
        );
        res.json({ result: 'success', data: rows });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
};
