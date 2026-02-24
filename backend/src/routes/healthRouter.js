const express = require('express');
const router = express.Router();
const pool = require('../config/dbPool');

// 기본 서버 상태 체크
router.get('/', (req, res) => {
    res.json({ status: 'ok' });
});

// DB 연결 체크
router.get('/db', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT 1 AS ok');
        res.json({ result: 'success', db: rows[0] });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
});

module.exports = router;
