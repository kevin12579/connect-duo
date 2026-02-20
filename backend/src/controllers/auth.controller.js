const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

async function signup(req, res) {
    const { username, password, name, phone_number, user_type } = req.body;
    // 필수값 체크
    if (!username || !password || !name || !user_type) {
        return res.status(400).json({ message: '필수값 누락' });
    }
    try {
        const hashed = await bcrypt.hash(password, 10);
        // DB unique 제약 기반 회원가입
        await pool.query(
            `INSERT INTO users (username, password, name, phone_number, user_type)
            VALUES (?, ?, ?, ?, ?)`,
            [username, hashed, name, phone_number || null, user_type],
        );
        return res.status(201).json({ ok: true });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: '이미 존재하는 아이디' });
        }
        return res.status(500).json({ message: '서버 오류', detail: e.message });
    }
}

async function login(req, res) {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query(
            `SELECT id, username, password, name, phone_number, user_type FROM users WHERE username = ?`,
            [username],
        );
        if (rows.length === 0) return res.status(401).json({ message: '로그인 실패' });
        const user = rows[0];
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ message: '로그인 실패' });
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ message: 'JWT_SECRET 환경변수 미설정' });
        }
        const token = jwt.sign({ id: user.id, user_type: user.user_type }, process.env.JWT_SECRET, { expiresIn: '7d' });
        return res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                phone_number: user.phone_number,
                user_type: user.user_type,
            },
        });
    } catch (e) {
        return res.status(500).json({ message: '서버 오류', detail: e.message });
    }
}

module.exports = { signup, login };
