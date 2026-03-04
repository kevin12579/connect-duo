// src/controllers/profileController.js
const pool = require('../config/dbPool');

async function updateTaxStatsInternal(tax_id) {
    const [reviewRows] = await pool.query(
        `SELECT AVG(rating) AS avgRating, COUNT(CASE WHEN is_recommend = TRUE THEN 1 END) AS recCount
         FROM Reviews WHERE tax_id = ?`,
        [tax_id],
    );
    const [profile] = await pool.query('SELECT user_id FROM TaxAccountantProfile WHERE id = ?', [tax_id]);
    let consultCount = 0;
    let reConsultRate = 0;
    if (profile[0]) {
        const tUserId = profile[0].user_id;
        const [consultRows] = await pool.query(
            `SELECT COUNT(*) AS total_cases, COUNT(DISTINCT user_id) AS total_users FROM ConsultRooms WHERE tax_id = ?`,
            [tUserId],
        );
        consultCount = consultRows[0].total_cases || 0;
        if (consultRows[0].total_users > 0 && consultCount > 0) {
            reConsultRate = ((consultCount - consultRows[0].total_users) / consultCount) * 100;
        }
    }
    await pool.query(
        `INSERT INTO TaxStats (tax_id, satisfaction_score, recommend_count, consult_count, re_consult_rate)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            satisfaction_score = VALUES(satisfaction_score),
            recommend_count    = VALUES(recommend_count),
            consult_count      = VALUES(consult_count),
            re_consult_rate    = VALUES(re_consult_rate)`,
        [tax_id, reviewRows[0].avgRating || 0, reviewRows[0].recCount || 0, consultCount, reConsultRate],
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 유저별 리뷰 집계 조회
// ─────────────────────────────────────────────────────────────────────────────
exports.usercomment = async (req, res) => {
    const userId = req.body.id;
    if (!userId) return res.status(400).json({ result: 'fail', message: 'userId가 필요합니다.' });

    try {
        // credit 컬럼은 마이그레이션 후에만 존재하므로 IFNULL + 서브쿼리 대신
        // 안전하게 기본 컬럼만 조회 후 credit을 별도로 시도
        const [users] = await pool.query('SELECT id, username, name, profile_img, user_type FROM Users WHERE id = ?', [
            userId,
        ]);
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });

        // credit 컬럼 안전 조회 (없으면 0)
        let credit = 0;
        try {
            const [creditRow] = await pool.query('SELECT credit FROM Users WHERE id = ?', [userId]);
            credit = creditRow[0]?.credit ?? 0;
        } catch (_) {}

        const [comments] = await pool.query(
            `SELECT tap.id AS taxProId, tap.user_id AS taxProUserId,
                    u.name AS taxProName, u.profile_img AS avatarUrl, COUNT(r.id) AS count
             FROM Reviews r
             JOIN TaxAccountantProfile tap ON r.tax_id = tap.id
             JOIN Users u ON tap.user_id = u.id
             WHERE r.user_id = ?
             GROUP BY tap.id, tap.user_id, u.name, u.profile_img`,
            [userId],
        );

        let taxProfile = {};
        if (users[0].user_type === 'TAX_ACCOUNTANT') {
            // 기본 필드 먼저
            const [profiles] = await pool.query(
                'SELECT bio_one_line, company_name, registration_number FROM TaxAccountantProfile WHERE user_id = ?',
                [userId],
            );
            if (profiles[0]) {
                taxProfile = { ...profiles[0] };
            }

            // 확장 필드 안전 조회 (마이그레이션 후에만 존재)
            try {
                const [extProfile] = await pool.query(
                    `SELECT chat_rate_per_10min, available_hours, office_address,
                            experience_years, categories, monthly_fee, consult_schedule
                     FROM TaxAccountantProfile WHERE user_id = ?`,
                    [userId],
                );
                if (extProfile[0]) {
                    const ep = extProfile[0];
                    taxProfile = {
                        ...taxProfile,
                        chat_rate_per_10min: ep.chat_rate_per_10min || 0,
                        available_hours: ep.available_hours || '',
                        office_address: ep.office_address || '',
                        experience_years: ep.experience_years || 0,
                        monthly_fee: ep.monthly_fee || 0,
                        categories: ep.categories
                            ? typeof ep.categories === 'string'
                                ? JSON.parse(ep.categories)
                                : ep.categories
                            : [],
                        consult_schedule: ep.consult_schedule
                            ? typeof ep.consult_schedule === 'string'
                                ? JSON.parse(ep.consult_schedule)
                                : ep.consult_schedule
                            : [],
                    };
                }
            } catch (_) {
                // 확장 컬럼 없으면 기본값으로 진행
                taxProfile = {
                    ...taxProfile,
                    chat_rate_per_10min: 0,
                    available_hours: '',
                    office_address: '',
                    experience_years: 0,
                    monthly_fee: 0,
                    categories: [],
                    consult_schedule: [],
                };
            }
        }

        res.json({
            result: 'success',
            data: {
                user: { ...users[0], credit, ...taxProfile },
                comments,
            },
        });
    } catch (error) {
        res.status(500).json({ result: 'fail', message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. 프로필 수정
// ─────────────────────────────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
    const {
        id,
        name,
        profile_img,
        bio_one_line,
        chat_rate_per_10min,
        available_hours,
        office_address,
        experience_years,
        categories,
        monthly_fee,
        consult_schedule,
        company_name,
    } = req.body;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('UPDATE Users SET name = ?, profile_img = ? WHERE id = ?', [name, profile_img, id]);

        const [user] = await connection.query('SELECT user_type FROM Users WHERE id = ?', [id]);
        if (user[0] && user[0].user_type === 'TAX_ACCOUNTANT') {
            // 기본 필드는 항상 업데이트
            await connection.query(
                'UPDATE TaxAccountantProfile SET bio_one_line = ?, company_name = ? WHERE user_id = ?',
                [bio_one_line || null, company_name || null, id],
            );

            // 확장 필드는 컬럼이 있을 때만 업데이트
            try {
                await connection.query(
                    `UPDATE TaxAccountantProfile SET
                        chat_rate_per_10min = ?,
                        available_hours     = ?,
                        office_address      = ?,
                        experience_years    = ?,
                        categories          = ?,
                        monthly_fee         = ?,
                        consult_schedule    = ?
                     WHERE user_id = ?`,
                    [
                        chat_rate_per_10min || 0,
                        available_hours || null,
                        office_address || null,
                        experience_years || 0,
                        categories ? JSON.stringify(categories) : null,
                        monthly_fee || 0,
                        consult_schedule ? JSON.stringify(consult_schedule) : null,
                        id,
                    ],
                );
            } catch (_) {
                // 확장 컬럼 없으면 기본 필드만 업데이트된 상태로 진행
            }
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

// ─────────────────────────────────────────────────────────────────────────────
// 3. 회원 탈퇴
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteAccount = async (req, res) => {
    const userId = req.params.id;
    try {
        const [result] = await pool.query('DELETE FROM Users WHERE id = ?', [userId]);
        if (result.affectedRows === 0) return res.status(404).json({ result: 'fail', message: '유저 없음' });
        res.json({ result: 'success' });
    } catch (error) {
        res.status(500).json({ result: 'fail', message: '탈퇴 처리 중 오류' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. 세무사 상세 정보 조회
// ─────────────────────────────────────────────────────────────────────────────
exports.taxpro = async (req, res) => {
    const { id: taxProUserId, viewerId } = req.body;
    if (!taxProUserId) return res.status(400).json({ result: 'fail', message: 'ID 필요' });

    try {
        // 기본 필드 조회
        const [taxPros] = await pool.query(
            `SELECT tap.id, tap.user_id, u.name, u.profile_img,
                    tap.bio_one_line, tap.response_speed, tap.company_name, tap.registration_number
             FROM TaxAccountantProfile tap
             JOIN Users u ON tap.user_id = u.id
             WHERE tap.user_id = ?`,
            [taxProUserId],
        );
        if (taxPros.length === 0) return res.status(404).json({ message: 'TaxPro not found' });

        let taxPro = { ...taxPros[0], categories: [], consult_schedule: [] };

        // 확장 필드 안전 조회
        try {
            const [ext] = await pool.query(
                `SELECT chat_rate_per_10min, available_hours, office_address,
                        experience_years, categories, monthly_fee, consult_schedule
                 FROM TaxAccountantProfile WHERE user_id = ?`,
                [taxProUserId],
            );
            if (ext[0]) {
                taxPro = {
                    ...taxPro,
                    chat_rate_per_10min: ext[0].chat_rate_per_10min || 0,
                    available_hours: ext[0].available_hours || '',
                    office_address: ext[0].office_address || '',
                    experience_years: ext[0].experience_years || 0,
                    monthly_fee: ext[0].monthly_fee || 0,
                    is_ad: !!ext[0].is_ad,
                    ad_expires_at: ext[0].ad_expires_at || null,
                    categories: ext[0].categories
                        ? typeof ext[0].categories === 'string'
                            ? JSON.parse(ext[0].categories)
                            : ext[0].categories
                        : [],
                    consult_schedule: ext[0].consult_schedule
                        ? typeof ext[0].consult_schedule === 'string'
                            ? JSON.parse(ext[0].consult_schedule)
                            : ext[0].consult_schedule
                        : [],
                };
            }
        } catch (_) {}

        const taxProProfileId = taxPro.id;

        const [stats] = await pool.query(
            'SELECT recommend_count, satisfaction_score, re_consult_rate, consult_count FROM TaxStats WHERE tax_id = ?',
            [taxProProfileId],
        );

        const [comments] = await pool.query(
            `SELECT r.id, r.user_id AS userId, u.name AS nickname,
                    u.profile_img AS avatarUrl, r.created_at AS createdAt,
                    r.comment AS content, r.rating, r.is_recommend
             FROM Reviews r JOIN Users u ON r.user_id = u.id
             WHERE r.tax_id = ? ORDER BY r.created_at DESC`,
            [taxProProfileId],
        );

        let consultStatus = 'NONE';
        if (viewerId) {
            const [roomRows] = await pool.query(
                `SELECT id FROM ConsultRooms WHERE user_id = ? AND tax_id = ? AND status = 'ACTIVE'`,
                [viewerId, taxProUserId],
            );
            if (roomRows.length > 0) {
                consultStatus = 'ACCEPTED';
            } else {
                const [reqRows] = await pool.query(
                    'SELECT status FROM ConsultRequests WHERE user_id = ? AND tax_user_id = ?',
                    [viewerId, taxProUserId],
                );
                if (reqRows.length > 0) consultStatus = reqRows[0].status;
            }
        }

        let requests = [];
        if (String(viewerId) === String(taxProUserId)) {
            const [reqList] = await pool.query(
                `SELECT cr.id, u.name AS nickname, cr.created_at, u.profile_img AS avatarUrl
                 FROM ConsultRequests cr JOIN Users u ON cr.user_id = u.id
                 WHERE cr.tax_user_id = ? AND cr.status = 'PENDING'`,
                [taxProUserId],
            );
            requests = reqList;
        }

        res.json({
            result: 'success',
            data: { taxPro, stats: stats[0] || {}, comments, requests, consultStatus },
        });
    } catch (error) {
        res.status(500).json({ result: 'fail', message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. 리뷰 등록/수정
// ─────────────────────────────────────────────────────────────────────────────
exports.createReview = async (req, res) => {
    const { tax_id, user_id, rating, comment, is_recommend } = req.body;
    try {
        const [existing] = await pool.query('SELECT id FROM Reviews WHERE user_id = ? AND tax_id = ?', [
            user_id,
            tax_id,
        ]);
        if (existing.length > 0) {
            await pool.query(
                `UPDATE Reviews SET rating = IFNULL(?, rating), comment = IFNULL(?, comment),
                    is_recommend = IFNULL(?, is_recommend) WHERE id = ?`,
                [
                    rating !== undefined ? rating : null,
                    comment || null,
                    is_recommend !== undefined ? is_recommend : null,
                    existing[0].id,
                ],
            );
        } else {
            await pool.query(
                'INSERT INTO Reviews (user_id, tax_id, rating, comment, is_recommend) VALUES (?, ?, ?, ?, ?)',
                [user_id, tax_id, rating || null, comment || null, is_recommend || false],
            );
        }
        await updateTaxStatsInternal(tax_id);
        const [reviews] = await pool.query(
            `SELECT r.id, r.user_id AS userId, u.name AS nickname, u.profile_img AS avatarUrl,
                    r.created_at AS createdAt, r.comment AS content, r.rating, r.is_recommend
             FROM Reviews r JOIN Users u ON r.user_id = u.id
             WHERE r.tax_id = ? ORDER BY r.created_at DESC`,
            [tax_id],
        );
        res.json({ result: 'success', comments: reviews });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: '리뷰 처리 오류' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. 리뷰 삭제
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteReview = async (req, res) => {
    const { reviewId, userId } = req.body;
    try {
        const [rows] = await pool.query('SELECT user_id, tax_id FROM Reviews WHERE id = ?', [reviewId]);
        if (!rows.length) return res.status(404).json({ result: 'fail', message: '댓글 없음' });
        if (rows[0].user_id !== userId) return res.status(403).json({ result: 'fail', message: '권한 없음' });
        const taxId = rows[0].tax_id;
        await pool.query('DELETE FROM Reviews WHERE id = ?', [reviewId]);
        await updateTaxStatsInternal(taxId);
        res.json({ result: 'success' });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: '삭제 오류' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. 추천 토글
// ─────────────────────────────────────────────────────────────────────────────
exports.toggleRecommend = async (req, res) => {
    const { reviewId, is_recommend, tax_id } = req.body;
    try {
        await pool.query('UPDATE Reviews SET is_recommend = ? WHERE id = ?', [!!is_recommend, reviewId]);
        if (tax_id) await updateTaxStatsInternal(tax_id);
        res.json({ result: 'success' });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: '추천 토글 오류' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. 상담 신청
// ─────────────────────────────────────────────────────────────────────────────
exports.requestConsult = async (req, res) => {
    const { user_id, tax_id } = req.body;
    try {
        const [existing] = await pool.query('SELECT id FROM ConsultRequests WHERE user_id = ? AND tax_user_id = ?', [
            user_id,
            tax_id,
        ]);
        if (existing.length > 0) return res.json({ result: 'fail', message: '이미 상담 신청 중입니다.' });
        await pool.query(`INSERT INTO ConsultRequests (user_id, tax_user_id, status) VALUES (?, ?, 'PENDING')`, [
            user_id,
            tax_id,
        ]);
        res.json({ result: 'success' });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: '상담 신청 실패' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. 상담 수락
// ─────────────────────────────────────────────────────────────────────────────
exports.acceptConsult = async (req, res) => {
    const { requestId } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [request] = await conn.query('SELECT * FROM ConsultRequests WHERE id = ?', [requestId]);
        if (request.length === 0) throw new Error('존재하지 않는 요청입니다.');
        const { user_id, tax_user_id } = request[0];
        const [profile] = await conn.query('SELECT id FROM TaxAccountantProfile WHERE user_id = ?', [tax_user_id]);
        if (profile.length === 0) throw new Error('세무사 프로필을 찾을 수 없습니다.');
        await conn.query(`INSERT INTO ConsultRooms (user_id, tax_id, status) VALUES (?, ?, 'ACTIVE')`, [
            user_id,
            tax_user_id,
        ]);
        await conn.query('DELETE FROM ConsultRequests WHERE id = ?', [requestId]);
        await updateTaxStatsInternal(profile[0].id);
        await conn.commit();
        res.json({ result: 'success' });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ result: 'fail', message: e.message });
    } finally {
        conn.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 10. 상담 거절
// ─────────────────────────────────────────────────────────────────────────────
exports.rejectConsult = async (req, res) => {
    const { requestId } = req.body;
    try {
        await pool.query('DELETE FROM ConsultRequests WHERE id = ?', [requestId]);
        res.json({ result: 'success' });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: '거절 처리 실패' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 11. 별점 전용 업데이트
// ─────────────────────────────────────────────────────────────────────────────
exports.rateReview = async (req, res) => {
    const { reviewId, rating, tax_id } = req.body;
    try {
        await pool.query('UPDATE Reviews SET rating = ? WHERE id = ?', [rating, reviewId]);
        if (tax_id) await updateTaxStatsInternal(tax_id);
        res.json({ result: 'success' });
    } catch (e) {
        res.status(500).json({ result: 'fail' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 12. 랭킹 조회
// ─────────────────────────────────────────────────────────────────────────────
exports.getRanking = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT u.id AS user_id, u.name, u.profile_img,
                    tap.id, tap.bio_one_line, tap.response_speed, tap.company_name, tap.is_ad, tap.ad_expires_at,
                    IFNULL(ts.recommend_count,    0) AS recommend_count,
                    IFNULL(ts.satisfaction_score, 0) AS satisfaction_score,
                    IFNULL(ts.re_consult_rate,    0) AS re_consult_rate,
                    IFNULL(ts.consult_count,      0) AS consult_count
             FROM Users u
             JOIN TaxAccountantProfile tap ON u.id = tap.user_id
             LEFT JOIN TaxStats ts ON tap.id = ts.tax_id
             WHERE u.user_type = 'TAX_ACCOUNTANT'`,
        );

        // 확장 필드 안전 조회
        const enriched = await Promise.all(
            rows.map(async (row) => {
                let extra = { office_address: '', experience_years: 0, categories: [], monthly_fee: 0 };
                try {
                    const [ext] = await pool.query(
                        'SELECT office_address, experience_years, categories, monthly_fee, is_ad, ad_expires_at FROM TaxAccountantProfile WHERE user_id = ?',
                        [row.user_id],
                    );
                    if (ext[0]) {
                        extra = {
                            office_address: ext[0].office_address || '',
                            experience_years: ext[0].experience_years || 0,
                            monthly_fee: ext[0].monthly_fee || 0,
                            is_ad: !!ext[0].is_ad,
                            ad_expires_at: ext[0].ad_expires_at || null,
                            categories: ext[0].categories
                                ? typeof ext[0].categories === 'string'
                                    ? JSON.parse(ext[0].categories)
                                    : ext[0].categories
                                : [],
                        };
                    }
                } catch (_) {}
                return { ...row, ...extra };
            }),
        );

        res.json({ result: 'success', data: enriched });
    } catch (error) {
        res.status(500).json({ result: 'fail', message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 광고 구매 (크레딧 차감 + is_ad = true)
// ─────────────────────────────────────────────────────────────────────────────
const AD_PRICE_PER_DAY = 1000; // 1일당 크레딧
const AD_DEFAULT_DAYS = 30; // 기본 30일

exports.purchaseAd = async (req, res) => {
    const { user_id, days = AD_DEFAULT_DAYS } = req.body;
    if (!user_id) return res.status(400).json({ result: 'fail', message: 'user_id 필요' });

    const cost = AD_PRICE_PER_DAY * days;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 크레딧 확인
        const [[user]] = await conn.query('SELECT credit FROM Users WHERE id = ? FOR UPDATE', [user_id]);
        if (!user || user.credit < cost) {
            await conn.rollback();
            return res
                .status(400)
                .json({ result: 'fail', message: `크레딧이 부족합니다. 필요: ${cost}, 보유: ${user?.credit ?? 0}` });
        }

        // 크레딧 차감
        const newCredit = user.credit - cost;
        await conn.query('UPDATE Users SET credit = ? WHERE id = ?', [newCredit, user_id]);

        // TaxAccountantProfile 조회
        const [[tap]] = await conn.query(
            'SELECT id, is_ad, ad_expires_at FROM TaxAccountantProfile WHERE user_id = ?',
            [user_id],
        );
        if (!tap) {
            await conn.rollback();
            return res.status(404).json({ result: 'fail', message: '세무사 프로필이 없습니다.' });
        }

        // 이미 광고 중이면 만료일 연장, 아니면 지금부터
        const base =
            tap.is_ad && tap.ad_expires_at && new Date(tap.ad_expires_at) > new Date()
                ? new Date(tap.ad_expires_at)
                : new Date();
        base.setDate(base.getDate() + days);
        const expiresAt = base.toISOString().slice(0, 19).replace('T', ' ');

        await conn.query('UPDATE TaxAccountantProfile SET is_ad = TRUE, ad_expires_at = ? WHERE user_id = ?', [
            expiresAt,
            user_id,
        ]);

        // 거래 내역 (CreditTransactions)
        await conn.query(
            'INSERT INTO CreditTransactions (user_id, type, amount, description, balance_after) VALUES (?, ?, ?, ?, ?)',
            [user_id, 'DEDUCT', cost, `광고 ${days}일 구매`, newCredit],
        );

        // AdTransactions
        try {
            await conn.query(
                'INSERT INTO AdTransactions (user_id, tax_pro_id, credits_used, days, expires_at) VALUES (?, ?, ?, ?, ?)',
                [user_id, tap.id, cost, days, expiresAt],
            );
        } catch (_) {}

        await conn.commit();
        res.json({
            result: 'success',
            credit: newCredit,
            ad_expires_at: expiresAt,
            message: `광고 ${days}일 등록 완료`,
        });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ result: 'fail', message: e.message });
    } finally {
        conn.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 광고 취소 (환불 없음, is_ad = false)
// ─────────────────────────────────────────────────────────────────────────────
exports.cancelAd = async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ result: 'fail', message: 'user_id 필요' });

    try {
        await pool.query('UPDATE TaxAccountantProfile SET is_ad = FALSE, ad_expires_at = NULL WHERE user_id = ?', [
            user_id,
        ]);
        res.json({ result: 'success', message: '광고가 취소되었습니다.' });
    } catch (e) {
        res.status(500).json({ result: 'fail', message: e.message });
    }
};
