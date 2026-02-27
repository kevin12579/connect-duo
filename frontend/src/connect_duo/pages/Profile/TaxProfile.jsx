import React, { useEffect, useMemo, useState, useCallback } from 'react';
import './TaxProfile.css';

import ProfileHeaderCard from './components/ProfileHeaderCard';
import CommentCard from './components/CommentCard';
import CommentList from './components/CommentList';
import TaxCommentList from './components/TaxCommentList';
import StatsCard from './components/StatsCard';
import ScoreDonutCard from './components/ScoreDonutCard';
import ActionCard from './components/ActionCard';

import { calcTotalScore, buildDonutSegments } from '../../utils/score';

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

    // 내 리뷰 객체를 실시간으로 계산 (ActionCard 전달용)
    const myReview = useMemo(() => {
        return comments.find((c) => String(c.userId) === String(me.id)) || null;
    }, [comments, me.id]);

    const fetchTaxProData = useCallback(
        async (isInitial = false) => {
            if (!taxProUserId) return;
            if (isInitial) setLoading(true);

            try {
                // API 호출 시 내 ID(me.id)를 같이 보내서 상담 상태를 확인해야 함
                const res = await getTaxProProfile(taxProUserId, me.id);
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
                        repeatRate: Number(data.stats.re_consult_rate || 0),
                        consultCount: data.stats.consult_count || 0,
                        avgResponseMinutes: Number(data.taxPro.response_speed || 0),
                    });
                    setComments(data.comments || []);

                    // 핵심: 서버에서 현재 유저와의 상담 신청 상태를 받아와서 설정
                    // 백엔드에서 res.data.consultStatus (PENDING, NONE 등)를 내려준다고 가정
                    setConsultStatus(data.consultStatus || 'NONE');

                    const mine = (data.comments || []).find((c) => String(c.userId) === String(me.id));
                    setLiked(!!mine?.is_recommend);
                    setMyRating(mine?.rating ?? null);
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

    // 상담 신청 핸들러
    const handleConsultRequest = async () => {
        if (!me.isLoggedIn) return alert('로그인이 필요합니다.');
        try {
            const res = await requestConsult(me.id, taxPro.user_id);
            if (res.result === 'success') {
                alert('상담 신청이 완료되었습니다.');
                setConsultStatus('PENDING'); // 즉시 UI 반영
            } else {
                alert(res.message || '이미 신청되었거나 오류가 발생했습니다.');
            }
        } catch (e) {
            alert('상담 신청 중 오류가 발생했습니다.');
        }
    };

    const handleToggleLike = async () => {
        if (!me.isLoggedIn) return alert('로그인이 필요합니다.');
        // 이미 추천했다면 작동 안함
        if (myReview?.is_recommend) return;

        try {
            if (!myReview) {
                await createReview({ tax_id: taxPro.id, user_id: me.id, is_recommend: true });
            } else {
                await toggleRecommend(myReview.id, true, taxPro.id);
            }
            fetchTaxProData(false);
        } catch (e) {
            alert('추천 처리 중 오류가 발생했습니다.');
        }
    };

    const handleSubmitRating = async () => {
        if (myRating !== null) return; // 이미 별점이 있으면 중단
        if (ratingDraft < 1) return alert('별점을 선택해주세요.');
        try {
            await createReview({
                tax_id: taxPro.id,
                user_id: me.id,
                rating: ratingDraft,
            });
            fetchTaxProData(false);
        } catch (e) {
            alert('별점 등록 중 오류가 발생했습니다.');
        }
    };

    const handleSubmitComment = async () => {
        if (myReview?.comment) return; // 이미 댓글이 있으면 중단
        const text = commentDraft.trim();
        if (!text) return;
        try {
            await createReview({
                tax_id: taxPro.id,
                user_id: me.id,
                comment: text,
            });
            setCommentDraft('');
            setCommentsOpen(true);
            fetchTaxProData(false);
        } catch (e) {
            alert('댓글 등록 오류');
        }
    };

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
                    consultStatus={consultStatus} // PENDING 상태 전달
                    onConsultRequest={handleConsultRequest}
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
                        myReview={myReview}
                    />
                </div>
            )}
        </div>
    );
}
