const pool = require('../config/dbPool');

/**
 * [내부 공통 함수] 세무사 통계(TaxStats) 업데이트
 * 리뷰 등록, 수정, 삭제, 추천 토글 시마다 이 함수를 호출하여 실시간 점수를 계산합니다.
 */
async function updateTaxStatsInternal(tax_id) {
    // 1. 평점 평균 및 추천수
    const [reviewRows] = await pool.query(
        `SELECT 
            AVG(rating) as avgRating, 
            COUNT(CASE WHEN is_recommend = TRUE THEN 1 END) as recCount 
         FROM Reviews WHERE tax_id = ?`,
        [tax_id],
    );

    // 2. 세무사의 user_id 가져오기 (상담 기록 조회용)
    const [profile] = await pool.query('SELECT user_id FROM TaxAccountantProfile WHERE id = ?', [tax_id]);

    let consultCount = 0;
    let reConsultRate = 0;

    if (profile[0]) {
        const tUserId = profile[0].user_id;

        // 3. 상담 횟수 및 재상담률 계산
        // 동일 유저가 2번 이상 상담한 경우를 재상담으로 정의
        const [consultRows] = await pool.query(
            `SELECT 
                COUNT(*) as total_cases,
                COUNT(DISTINCT user_id) as total_users
             FROM ConsultRooms WHERE tax_id = ?`,
            [tUserId],
        );

        consultCount = consultRows[0].total_cases || 0;
        if (consultRows[0].total_users > 0 && consultCount > 0) {
            // 공식: (전체 상담 건수 - 상담 유저 수) / 전체 상담 건수 * 100
            reConsultRate = ((consultCount - consultRows[0].total_users) / consultCount) * 100;
        }
    }

    // 4. 통계 테이블 반영
    await pool.query(
        `INSERT INTO TaxStats (tax_id, satisfaction_score, recommend_count, consult_count, re_consult_rate)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
            satisfaction_score = VALUES(satisfaction_score),
            recommend_count = VALUES(recommend_count),
            consult_count = VALUES(consult_count),
            re_consult_rate = VALUES(re_consult_rate)`,
        [tax_id, reviewRows[0].avgRating || 0, reviewRows[0].recCount || 0, consultCount, reConsultRate],
    );
}

// 1. 유저별 리뷰 집계 조회
exports.usercomment = async (req, res) => {
    const userId = req.body.id;
    if (!userId) return res.status(400).json({ result: 'fail', message: 'userId가 필요합니다.' });

    try {
        const userSql = `SELECT id, username, name, profile_img, user_type FROM Users WHERE id = ?`;
        const [users] = await pool.query(userSql, [userId]);
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });

        const commentSql = `
            SELECT tap.id AS taxProId,
                tap.user_id AS taxProUserId,
                u.name AS taxProName,
                u.profile_img AS avatarUrl,
                COUNT(r.id) AS count
            FROM Reviews r
            JOIN TaxAccountantProfile tap ON r.tax_id = tap.id
            JOIN Users u ON tap.user_id = u.id
            WHERE r.user_id = ?
            GROUP BY tap.id, tap.user_id, u.name, u.profile_img
        `;
        const [comments] = await pool.query(commentSql, [userId]);

        let bio = '';
        if (users[0].user_type === 'TAX_ACCOUNTANT') {
            const [profiles] = await pool.query('SELECT bio_one_line FROM TaxAccountantProfile WHERE user_id = ?', [
                userId,
            ]);
            bio = profiles[0]?.bio_one_line || '';
        }

        res.json({
            result: 'success',
            data: {
                user: { ...users[0], bio_one_line: bio },
                comments,
            },
        });
    } catch (error) {
        res.status(500).json({ result: 'fail', message: error.message });
    }
};

// 2. 프로필 수정
exports.updateProfile = async (req, res) => {
    const { id, name, profile_img, bio_one_line } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query(`UPDATE Users SET name = ?, profile_img = ? WHERE id = ?`, [name, profile_img, id]);
        const [user] = await connection.query('SELECT user_type FROM Users WHERE id = ?', [id]);
        if (user[0] && user[0].user_type === 'TAX_ACCOUNTANT') {
            await connection.query(`UPDATE TaxAccountantProfile SET bio_one_line = ? WHERE user_id = ?`, [
                bio_one_line,
                id,
            ]);
        }
        await connection.commit();
        res.json({ result: 'success', message: '프로필이 업데이트되었습니다.' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ result: 'fail', message: '업데이트 중 오류 발생' });
    } finally {
        connection.release();
    }
};

// 3. 회원 탈퇴
exports.deleteAccount = async (req, res) => {
    const userId = req.params.id;
    try {
        const [result] = await pool.query(`DELETE FROM Users WHERE id = ?`, [userId]);
        if (result.affectedRows === 0) return res.status(404).json({ result: 'fail', message: '유저 없음' });
        res.json({ result: 'success' });
    } catch (error) {
        res.status(500).json({ result: 'fail', message: '탈퇴 처리 중 오류' });
    }
};

// 4. 세무사 상세 정보 조회
exports.taxpro = async (req, res) => {
    const taxProUserId = req.body.id;
    if (!taxProUserId) return res.status(400).json({ result: 'fail', message: 'ID 필요' });

    try {
        const taxProSql = `
            SELECT tap.id, tap.user_id, u.name, u.profile_img, tap.bio_one_line, tap.response_speed,
                tap.company_name, tap.registration_number
            FROM TaxAccountantProfile tap
            JOIN Users u ON tap.user_id = u.id
            WHERE tap.user_id = ?`;
        const [taxPros] = await pool.query(taxProSql, [taxProUserId]);
        if (taxPros.length === 0) return res.status(404).json({ message: 'TaxPro not found' });

        const [stats] = await pool.query(
            `SELECT recommend_count, satisfaction_score, re_consult_rate, consult_count FROM TaxStats WHERE tax_id = ?`,
            [taxPros[0].id],
        );
        const [comments] = await pool.query(
            `
            SELECT r.id, r.user_id AS userId, u.name AS nickname, u.profile_img AS avatarUrl, r.created_at AS createdAt, r.comment AS content, r.rating, r.is_recommend
            FROM Reviews r JOIN Users u ON r.user_id = u.id
            WHERE r.tax_id = ? ORDER BY r.created_at DESC`,
            [taxPros[0].id],
        );

        const [requests] = await pool.query(
            `
            SELECT cr.id, u.name AS nickname, cr.created_at, u.profile_img AS avatarUrl
            FROM ConsultRooms cr JOIN Users u ON cr.user_id = u.id
            WHERE cr.tax_id = ? AND cr.status = 'ACTIVE'`,
            [taxPros[0].user_id],
        );

        res.json({
            result: 'success',
            data: { taxPro: taxPros[0], stats: stats[0] || {}, comments, requests },
        });
    } catch (error) {
        res.status(500).json({ result: 'fail', message: error.message });
    }
};

// 5. 리뷰 등록/수정 (Upsert)
// 5. 리뷰 등록/수정 (Upsert) - 추천/별점 단독 처리 가능
exports.createReview = async (req, res) => {
    const { tax_id, user_id, rating, comment, is_recommend } = req.body;
    try {
        // 기존 리뷰가 있는지 확인
        const [existing] = await pool.query('SELECT id FROM Reviews WHERE user_id = ? AND tax_id = ?', [
            user_id,
            tax_id,
        ]);

        if (existing.length > 0) {
            // 업데이트 (보내준 값만 변경, 나머지는 유지)
            await pool.query(
                `UPDATE Reviews SET 
                    rating = IFNULL(?, rating), 
                    comment = IFNULL(?, comment), 
                    is_recommend = IFNULL(?, is_recommend) 
                 WHERE id = ?`,
                [
                    rating !== undefined ? rating : null,
                    comment || null,
                    is_recommend !== undefined ? is_recommend : null,
                    existing[0].id,
                ],
            );
        } else {
            // 신규 생성 (리뷰 텍스트가 없어도 추천/별점만으로 생성 가능)
            await pool.query(
                'INSERT INTO Reviews (user_id, tax_id, rating, comment, is_recommend) VALUES (?, ?, ?, ?, ?)',
                [user_id, tax_id, rating || null, comment || null, is_recommend || false],
            );
        }

        // 통계 즉시 갱신
        await updateTaxStatsInternal(tax_id);

        // 갱신된 리뷰 리스트 반환
        const [reviews] = await pool.query(
            `SELECT r.id, r.user_id AS userId, u.name AS nickname, u.profile_img AS avatarUrl, 
                    r.created_at AS createdAt, r.comment AS content, r.rating, r.is_recommend
             FROM Reviews r JOIN Users u ON r.user_id = u.id 
             WHERE r.tax_id = ? ORDER BY r.created_at DESC`,
            [tax_id],
        );
        res.json({ result: 'success', comments: reviews });
    } catch (e) {
        console.error(e);
        res.status(500).json({ result: 'fail', message: '리뷰 처리 오류' });
    }
};

// 6. 리뷰 삭제
exports.deleteReview = async (req, res) => {
    const { reviewId, userId } = req.body;
    try {
        const [rows] = await pool.query(`SELECT user_id, tax_id FROM Reviews WHERE id = ?`, [reviewId]);
        if (!rows.length) return res.status(404).json({ result: 'fail', message: '댓글 없음' });
        if (rows[0].user_id !== userId) return res.status(403).json({ result: 'fail', message: '권한 없음' });

        const taxId = rows[0].tax_id;
        await pool.query(`DELETE FROM Reviews WHERE id = ?`, [reviewId]);

        // ⭐ 삭제 후 통계 갱신
        await updateTaxStatsInternal(taxId);

        res.json({ result: 'success' });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: '삭제 오류' });
    }
};

// 7. 추천 토글
exports.toggleRecommend = async (req, res) => {
    const { reviewId, is_recommend, tax_id } = req.body;
    try {
        await pool.query(`UPDATE Reviews SET is_recommend = ? WHERE id = ?`, [!!is_recommend, reviewId]);
        if (tax_id) await updateTaxStatsInternal(tax_id);
        res.json({ result: 'success' });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: '추천 토글 오류' });
    }
};

// 8~10. 상담 관련 (기존 로직 유지)
exports.requestConsult = async (req, res) => {
    const { user_id, tax_id } = req.body;
    try {
        await pool.query(`INSERT INTO ConsultRooms (user_id, tax_id, status) VALUES (?, ?, 'ACTIVE')`, [
            user_id,
            tax_id,
        ]);
        res.json({ result: 'success' });
    } catch (e) {
        res.status(500).json({ result: 'fail' });
    }
};
exports.acceptConsult = async (req, res) => {
    try {
        await pool.query(`UPDATE ConsultRooms SET status = 'CLOSED', closed_at = NOW() WHERE id = ?`, [
            req.body.requestId,
        ]);
        res.json({ result: 'success' });
    } catch (e) {
        res.status(500).json({ result: 'fail' });
    }
};
exports.rejectConsult = async (req, res) => {
    try {
        await pool.query(`DELETE FROM ConsultRooms WHERE id = ?`, [req.body.requestId]);
        res.json({ result: 'success' });
    } catch (e) {
        res.status(500).json({ result: 'fail' });
    }
};

// 11. 별점 전용 업데이트
exports.rateReview = async (req, res) => {
    const { reviewId, rating, tax_id } = req.body;
    try {
        await pool.query(`UPDATE Reviews SET rating = ? WHERE id = ?`, [rating, reviewId]);
        if (tax_id) await updateTaxStatsInternal(tax_id);
        res.json({ result: 'success' });
    } catch (e) {
        res.status(500).json({ result: 'fail' });
    }
};
