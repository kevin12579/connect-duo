const pool = require('../db/pool');

async function listRanking(req, res) {
    try {
        const [rows] = await pool.query(`
        SELECT 
        tap.id as tax_profile_id,
        u.id as user_id,
        u.name,
        tap.company_name,
        tap.bio_one_line,
        tap.response_speed,
        tap.is_online,
        COALESCE(ts.recommend_count, 0) as recommend_count,
        COALESCE(ts.satisfaction_score, 0) as satisfaction_score,
        COALESCE(ts.re_consult_rate, 0) as re_consult_rate,
        COALESCE(ts.consult_count, 0) as consult_count,
        COALESCE(ts.ranking_score, 0) as ranking_score
        FROM TaxAccountantProfile tap
        JOIN Users u ON u.id = tap.user_id
        LEFT JOIN TaxStats ts ON ts.tax_id = tap.id
        ORDER BY ranking_score DESC, satisfaction_score DESC
        LIMIT 50
    `);

        return res.json(rows);
    } catch (e) {
        return res.status(500).json({ message: '서버 오류', detail: e.message });
    }
}

async function createProfile(req, res) {
    try {
        const userId = req.user.id;

        if (req.user.user_type !== 'TAX_ACCOUNTANT') {
            return res.status(403).json({ message: '세무사만 생성 가능' });
        }

        const { company_name, registration_number, bio_one_line, bio_full } = req.body;

        const [result] = await pool.query(
            `INSERT INTO TaxAccountantProfile (user_id, company_name, registration_number, bio_one_line, bio_full)
        VALUES (?, ?, ?, ?, ?)`,
            [userId, company_name, registration_number, bio_one_line, bio_full],
        );

        const profileId = result.insertId;

        await pool.query(`INSERT INTO TaxStats (tax_id, ranking_score) VALUES (?, 0)`, [profileId]);

        return res.json({ ok: true, profileId });
    } catch (e) {
        return res.status(500).json({ message: '서버 오류', detail: e.message });
    }
}

module.exports = { listRanking, createProfile };
