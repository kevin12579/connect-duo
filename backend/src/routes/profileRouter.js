const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

// 프로필 및 코멘트 조회
router.post('/usercomment', profileController.usercomment);

// 프로필 수정 (PUT)
router.put('/update', profileController.updateProfile);

// 회원 탈퇴 (DELETE) - 경로 파라미터 :id 사용
router.delete('/delete/:id', profileController.deleteAccount);

// 세무사 프로필 전체 조회
router.post('/taxpro', profileController.taxpro);

//추가사항

// 리뷰(댓글) 등록
router.post('/review', profileController.createReview);

// 리뷰(댓글) 삭제
router.post('/review/delete', profileController.deleteReview);

// 리뷰 추천 토글
router.post('/review/recommend', profileController.toggleRecommend);

// 평점 등록 (리뷰에는 평점 포함)
router.post('/review/rate', profileController.rateReview);

// 상담 신청
router.post('/consult/request', profileController.requestConsult);

// 상담 수락
router.post('/consult/accept', profileController.acceptConsult);

// 상담 거절
router.post('/consult/reject', profileController.rejectConsult);

module.exports = router;
