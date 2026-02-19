const express = require('express');
const router = express.Router();
const pool = require('../config/dbPool');

router.get('/db', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT 1 AS ok');
        res.json({ result: 'success', db: rows[0] });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
});

module.exports = router;
