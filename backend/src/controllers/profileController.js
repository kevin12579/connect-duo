const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // 설정하신 mysql pool

// 내 프로필 정보 및 리뷰 남긴 세무사 목록 가져오기
// profileController.js
exports.usercomment = async (req, res) => {
    // 💡 수정: req.query.id -> req.body.id (POST 요청의 body에서 가져옴)
    const userId = req.body.id;

    if (!userId) {
        return res.status(400).json({ result: 'fail', message: 'userId가 필요합니다.' });
    }

    try {
        // 1. 유저 기본 정보 조회
        const userSql = `SELECT id, username, name, profile_img, user_type FROM Users WHERE id = ?`;
        const [users] = await pool.query(userSql, [userId]);

        if (users.length === 0) return res.status(404).json({ message: 'User not found' });

        // 2. 내가 리뷰를 남긴 세무사 목록 조회 (JOIN 쿼리는 잘 작성하셨습니다!)
        const commentSql = `
            SELECT 
                tap.id AS taxProId, 
                u.name AS taxProName, 
                u.profile_img AS avatarUrl,
                COUNT(r.id) AS count
            FROM Reviews r
            JOIN TaxAccountantProfile tap ON r.tax_id = tap.id
            JOIN Users u ON tap.user_id = u.id
            WHERE r.user_id = ?
            GROUP BY tap.id, u.name, u.profile_img
        `;
        const [comments] = await pool.query(commentSql, [userId]);

        res.json({
            result: 'success',
            data: {
                user: users[0],
                comments: comments,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ result: 'fail', message: error.message });
    }
};
