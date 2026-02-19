// loginController.js
//npm i jsonwebtoken
// loginController.js
// loginController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('../config/dbPool');

const generateToken = (user, secret, expirein) => {
    return jwt.sign(user, secret, { expiresIn: expirein });
};

exports.login = async (req, res) => {
    // 프론트에서 email이라는 이름으로 보내므로 그대로 받되, DB의 username과 비교합니다.
    const { email, passwd } = req.body;

    try {
        // 1. Users 테이블에서 username(이메일)으로 회원정보 가져오기
        const sql = `SELECT id, name, username, password, user_type FROM Users WHERE username = ?`;
        const [result] = await pool.query(sql, [email]);

        if (result.length === 0) {
            return res.status(401).json({ result: 'fail', message: '존재하지 않는 아이디입니다.' });
        }

        const tmpUser = result[0];

        // 2. 비밀번호 체크 (DB 필드명 password)
        const isMatch = await bcrypt.compare(passwd, tmpUser.password);
        if (!isMatch) {
            return res.status(401).json({ result: 'fail', message: '비밀번호가 일치하지 않습니다.' });
        }

        // 3. 토큰 생성 (민감정보인 password 제외)
        const userPayload = {
            id: tmpUser.id,
            name: tmpUser.name,
            username: tmpUser.username,
            user_type: tmpUser.user_type,
        };

        const accessToken = generateToken(userPayload, process.env.ACCESS_SECRET, '15m');
        const refreshToken = generateToken(userPayload, process.env.REFRESH_SECRET, '1h');

        // 4. DB에 refreshToken 저장 (Users 테이블에 해당 컬럼이 있어야 합니다)
        // 만약 Users 테이블에 refreshToken 컬럼이 없다면 추가해야 합니다.
        const sql2 = `UPDATE Users SET refreshToken = ? WHERE username = ?`;
        await pool.query(sql2, [refreshToken, email]);

        res.json({
            result: 'success',
            message: '로그인 성공!',
            data: { accessToken, refreshToken, ...userPayload },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ result: 'fail', message: '서버 오류: ' + error.message });
    }
};

// 로그아웃: refreshToken 무효화
exports.logout = async (req, res) => {
    const { email } = req.body;
    try {
        const sql = `UPDATE Users SET refreshToken = NULL WHERE username = ?`;
        await pool.query(sql, [email]);
        res.json({ result: 'success', message: '로그아웃 되었습니다.' });
    } catch (error) {
        res.status(500).json({ result: 'fail', message: error.message });
    }
};

// 마이페이지: 유저 타입에 따른 상세 정보 처리 가능
exports.mypage = async (req, res) => {
    try {
        if (!req.authUser) return res.status(401).json({ result: 'fail', message: '로그인이 필요합니다.' });

        const { id, user_type } = req.authUser;

        // 기본 정보 조회
        let sql = `SELECT id, username, name, phone_number, user_type, profile_img FROM Users WHERE id = ?`;
        const [result] = await pool.query(sql, [id]);

        if (result.length === 0) return res.status(404).json({ result: 'fail', message: '사용자를 찾을 수 없습니다.' });

        let userData = result[0];

        // 세무사라면 추가 프로필 정보까지 가져오기 (JOIN)
        if (user_type === 'TAX_ACCOUNTANT') {
            const taxSql = `SELECT * FROM TaxAccountantProfile WHERE user_id = ?`;
            const [taxResult] = await pool.query(taxSql, [id]);
            userData.profile = taxResult[0] || null;
        }

        res.json({ result: 'success', data: userData });
    } catch (error) {
        res.status(500).json({ result: 'fail', message: error.message });
    }
};

// 미들웨어(authMiddleware)에서 검증된 유저 정보를 반환
exports.getAuthenticUser = (req, res) => {
    // req.authUser는 보통 미들웨어에서 jwt.verify 후 넣어준 데이터입니다.
    if (!req.authUser) {
        return res.status(401).json({ result: 'fail', message: '로그인 정보가 없습니다.' });
    }
    res.json({ result: 'success', data: req.authUser });
};
//refreshToken을 검증하여 타당할 경우 새 억세스토큰 발급
// refreshToken을 검증하여 타당할 경우 새 Access Token 발급
exports.refreshVerify = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ result: 'fail', message: '토큰이 없습니다.' });
    }

    jwt.verify(refreshToken, process.env.REFRESH_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(403).json({ result: 'fail', message: '유효하지 않거나 만료된 리프레시 토큰입니다.' });
        }

        try {
            // [수정] members -> Users 테이블로 변경 / refreshToken 대조
            const sql = `SELECT id, name, username, user_type FROM Users WHERE refreshToken = ?`;
            const [result] = await pool.query(sql, [refreshToken]);

            if (result.length === 0) {
                return res.status(403).json({ result: 'fail', message: '인증받지 않은 회원입니다.' });
            }

            const user = result[0];
            // 새 Access Token 생성 (페이로드에 핵심 정보 담기)
            const newAccessToken = generateToken(
                { id: user.id, name: user.name, username: user.username, user_type: user.user_type },
                process.env.ACCESS_SECRET,
                '15m',
            );

            res.json({ result: 'success', accessToken: newAccessToken });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ result: 'error', message: '서버 오류' });
        }
    });
};
