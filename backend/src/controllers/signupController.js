const pool = require('../config/dbPool');
const bcrypt = require('bcrypt');
const salt = 10;

// [기능 1] 아이디 중복 체크
exports.checkId = async (req, res) => {
    const { username } = req.body;
    try {
        const sql = `SELECT id FROM Users WHERE username = ?`;
        const [rows] = await pool.query(sql, [username]);

        if (rows.length > 0) {
            return res.status(400).json({ result: 'fail', message: '이미 사용 중인 아이디입니다.' });
        }
        res.json({ result: 'success', message: '사용 가능한 아이디입니다.' });
    } catch (error) {
        res.status(500).json({ result: 'fail', message: error.message });
    }
};

// [기능 2] 통합 회원가입 (일반유저 / 세무사)
exports.signUp = async (req, res) => {
    // 프론트에서 보낸 formData 구조에 맞춤
    const { username, password, name, phone_number, user_type, company_name, registration_number } = req.body;

    if (!username || !password || !name) {
        return res.status(400).json({ result: 'fail', message: '필수 정보를 모두 입력해주세요.' });
    }

    const connection = await pool.getConnection(); // 트랜잭션 시작을 위해 연결 확보
    try {
        await connection.beginTransaction(); // 트랜잭션 시작 (Users와 Profile 동시 저장)

        // 1. 비밀번호 암호화
        const hashPasswd = await bcrypt.hash(password, salt);

        // 2. 공통 유저 정보 저장 (Users 테이블)
        const userSql = `INSERT INTO Users (username, password, name, phone_number, user_type) VALUES (?, ?, ?, ?, ?)`;
        const [userResult] = await connection.query(userSql, [username, hashPasswd, name, phone_number, user_type]);

        const userId = userResult.insertId;

        // 3. 세무사일 경우 추가 정보 저장 (TaxAccountantProfile 테이블)
        if (user_type === 'TAX_ACCOUNTANT') {
            const taxSql = `INSERT INTO TaxAccountantProfile (user_id, company_name, registration_number) VALUES (?, ?, ?)`;
            await connection.query(taxSql, [userId, company_name, registration_number]);

            // 4. 통계 테이블 초기화 (필요 시)
            const statsSql = `INSERT INTO TaxStats (tax_id) SELECT id FROM TaxAccountantProfile WHERE user_id = ?`;
            await connection.query(statsSql, [userId]);
        }

        await connection.commit(); // 모든 쿼리 성공 시 DB 반영
        res.json({ result: 'success', message: '회원가입이 완료되었습니다.' });
    } catch (error) {
        await connection.rollback(); // 하나라도 실패하면 되돌림
        console.error(error);
        res.status(500).json({ result: 'fail', message: '서버 오류: ' + error.message });
    } finally {
        connection.release(); // 연결 반환
    }
};

// [기능 3] 사업자 등록번호 중복 체크
exports.checkCompanyNumber = async (req, res) => {
    const { registration_number } = req.body;

    if (!registration_number) {
        return res.status(400).json({ result: 'fail', message: '사업자 번호를 입력해주세요.' });
    }

    try {
        // TaxAccountantProfile 테이블에서 해당 번호가 있는지 확인
        const sql = `SELECT id FROM TaxAccountantProfile WHERE registration_number = ?`;
        const [rows] = await pool.query(sql, [registration_number]);

        if (rows.length > 0) {
            return res.status(400).json({
                result: 'fail',
                message: '이미 등록된 사업자 번호입니다.',
            });
        }

        res.json({
            result: 'success',
            message: '사용 가능한 사업자 번호입니다.',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ result: 'fail', message: '서버 오류: ' + error.message });
    }
};
