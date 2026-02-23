import React, { useEffect, useMemo, useState, useCallback } from 'react';
import './TaxProfile.css';

import ProfileHeaderCard from './components/ProfileHeaderCard';
import CommentCard from './components/CommentCard';
import CommentList from './components/CommentList';
import TaxCommentList from './components/TaxCommentList';
import StatsCard from './components/StatsCard';
import ScoreDonutCard from './components/ScoreDonutCard';
import ActionCard from './components/ActionCard';

import { calcTotalScore, buildDonutSegments } from './utils/score';

import {
    getTaxProProfile,
    createReview,
    deleteReview,
    toggleRecommend,
    requestConsult,
    updateUserProfile,
} from '../../api/axios';

export default function TaxProfile({ viewerRole = 'USER', nav = null }) {
    const isTaxProViewer = viewerRole === 'TAX_ACCOUNTANT';
    const taxProUserId = nav?.taxProId;

    const [taxPro, setTaxPro] = useState(null);
    const [stats, setStats] = useState(null);
    const [comments, setComments] = useState([]);
    const [consultStatus, setConsultStatus] = useState('NONE');
    const [liked, setLiked] = useState(false);
    const [myRating, setMyRating] = useState(null);
    const [ratingDraft, setRatingDraft] = useState(0);
    const [commentDraft, setCommentDraft] = useState('');
    const [loading, setLoading] = useState(true);
    const [commentsOpen, setCommentsOpen] = useState(false);

    const storedMe = JSON.parse(localStorage.getItem('userBackup') || 'null');
    const me = {
        id: storedMe?.id || '',
        nickname: storedMe?.name || '',
        avatarUrl: storedMe?.profile_img || '',
        isLoggedIn: !!storedMe?.id,
        userType: storedMe?.user_type,
    };

    // 1. 데이터 가져오기 로직 공통화 (ID 타입 불일치 해결 포함)
    const fetchTaxProData = useCallback(
        async (isInitial = false) => {
            if (!taxProUserId) return;
            if (isInitial) setLoading(true); // 처음 로딩때만 전체 화면 가림

            try {
                const res = await getTaxProProfile(taxProUserId);
                if (res.result === 'success') {
                    const data = res.data;
                    setTaxPro({
                        ...data.taxPro,
                        oneLine: data.taxPro.bio_one_line,
                        avatarUrl: data.taxPro.profile_img,
                    });
                    setStats({
                        likesCount: data.stats.recommend_count || 0,
                        avgRating: Number(data.stats.satisfaction_score) || 0,
                        repeatRate: Number(data.stats.re_consult_rate || 0), // DB에서 이미 0~100 사이 값
                        consultCount: data.stats.consult_count || 0,
                        avgResponseMinutes: Number(data.taxPro.response_speed || 0), // 분 단위
                    });
                    setComments(data.comments || []);

                    // 내 리뷰 찾기 (타입 강제 변환하여 비교)
                    const myReview = (data.comments || []).find((c) => String(c.userId) === String(me.id));
                    setLiked(!!myReview?.is_recommend);
                    setMyRating(myReview?.rating ?? null);
                }
            } catch (err) {
                console.error('Data Fetch Error:', err);
            } finally {
                setLoading(false);
            }
        },
        [taxProUserId, me.id],
    );

    useEffect(() => {
        fetchTaxProData(true);
    }, [fetchTaxProData]);

    // 2. 추천 토글 (리뷰가 없으면 생성 후 토글)
    const handleToggleLike = async () => {
        if (!me.isLoggedIn) return alert('로그인이 필요합니다.');
        const myReview = comments.find((c) => String(c.userId) === String(me.id));

        try {
            if (!myReview) {
                // 리뷰가 아예 없으면 새로 생성 (is_recommend: true)
                await createReview({ tax_id: taxPro.id, user_id: me.id, is_recommend: true });
            } else {
                // 있으면 토글
                await toggleRecommend(myReview.id, !liked, taxPro.id);
            }
            // 낙관적 업데이트 대신 즉시 새로고침 (loading 없이)
            fetchTaxProData(false);
        } catch (e) {
            alert('추천 처리 중 오류가 발생했습니다.');
        }
    };

    // 3. 별점 제출 (Upsert 방식)
    const handleSubmitRating = async () => {
        if (ratingDraft < 1) return alert('별점을 선택해주세요.');
        try {
            const res = await createReview({
                tax_id: taxPro.id,
                user_id: me.id,
                rating: ratingDraft,
            });
            if (res.result === 'success') {
                setMyRating(ratingDraft); // 즉시 상태 반영
                fetchTaxProData(false); // 도넛 차트/통계 갱신
            }
        } catch (e) {
            alert('별점 등록 중 오류가 발생했습니다.');
        }
    };

    // 4. 댓글 제출
    const handleSubmitComment = async () => {
        const text = commentDraft.trim();
        if (!text) return;
        try {
            const res = await createReview({
                tax_id: taxPro.id,
                user_id: me.id,
                comment: text,
            });
            if (res.result === 'success') {
                setCommentDraft('');
                setCommentsOpen(true);
                fetchTaxProData();
            }
        } catch (e) {
            alert('댓글 등록 오류');
        }
    };

    // 나머지 헬퍼 로직 (정렬 및 점수 계산)
    const orderedComments = useMemo(() => {
        const list = [...comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const mine = list.filter((c) => String(c.userId) === String(me.id));
        const others = list.filter((c) => String(c.userId) !== String(me.id));
        return [...mine, ...others];
    }, [comments, me.id]);

    const totalScore = useMemo(() => (stats ? calcTotalScore(stats) : 0), [stats]);
    const donutSegments = useMemo(() => (stats ? buildDonutSegments(stats) : []), [stats]);

    if (loading) return <div className="loading">불러오는 중...</div>;
    if (!taxPro) return <div className="error">정보가 없습니다.</div>;

    return (
        <div className="profile-root">
            <h2 className="profile-title">프로필</h2>
            <div className="profile-card profile-top">
                <ProfileHeaderCard
                    taxPro={taxPro}
                    viewerRole={viewerRole}
                    consultStatus={consultStatus}
                    onConsultRequest={() =>
                        requestConsult(me.id, taxPro.user_id).then(() => setConsultStatus('PENDING'))
                    }
                    onSaveProfile={(updated) => updateUserProfile(updated.id, updated)}
                />
            </div>

            <CommentCard
                open={commentsOpen}
                onToggle={() => setCommentsOpen(!commentsOpen)}
                latestComment={comments[0]}
            >
                {isTaxProViewer ? (
                    <TaxCommentList comments={comments} pageSize={3} />
                ) : (
                    <CommentList
                        me={me}
                        comments={orderedComments}
                        onDelete={(id) => deleteReview(id, me.id).then(fetchTaxProData)}
                        pageSize={3}
                    />
                )}
            </CommentCard>

            <div className="profile-row-2">
                <div className="profile-card profile-stats">
                    <StatsCard stats={stats} />
                </div>
                <div className="profile-card profile-score">
                    <ScoreDonutCard totalScore={totalScore} segments={donutSegments} />
                </div>
            </div>

            {!isTaxProViewer && (
                <div className="profile-card profile-actions">
                    <ActionCard
                        me={me}
                        liked={liked}
                        onToggleLike={handleToggleLike}
                        myRating={myRating}
                        ratingDraft={ratingDraft}
                        onChangeRatingDraft={setRatingDraft}
                        onSubmitRating={handleSubmitRating}
                        onCancelRating={() => setRatingDraft(0)}
                        commentDraft={commentDraft}
                        onChangeCommentDraft={setCommentDraft}
                        onSubmitComment={handleSubmitComment}
                        onCancelComment={() => setCommentDraft('')}
                    />
                </div>
            )}
        </div>
    );
}
