import React, { useEffect, useMemo, useState } from 'react';
import './TaxProfile.css';

import ProfileHeaderCard from './components/ProfileHeaderCard';
import CommentCard from './components/CommentCard';
import CommentList from './components/CommentList';
import TaxCommentList from './components/TaxCommentList';
import StatsCard from './components/StatsCard';
import ScoreDonutCard from './components/ScoreDonutCard';
import ActionCard from './components/ActionCard';
import ConsultationRequestList from './components/ConsultationRequestList';

import { calcTotalScore, buildDonutSegments } from './utils/score';

// ✅ 더미 데이터(나중에 API로 교체)
const DUMMY_TAXPRO = {
    id: 'taxpro-1',
    name: '김세진',
    oneLine: '신뢰감과 편안함을 드리는 상담을 하겠습니다!',
    career: '경력: 여제구 저제구',
    specialty: '분야: 여제구 저제구',
    available: '상담 가능 시간은 오전 몇 시에서 오후 몇 시',
    avatarUrl: '',
};

const DUMMY_ME = {
    id: 'user-99',
    nickname: 'Lemon378',
    avatarUrl: '',
    isLoggedIn: true,
};

const DUMMY_STATS = {
    likesCount: 35,
    avgRating: 4.5,
    repeatRate: 0.843,
    consultCount: 52,
    avgResponseSeconds: 30 * 60 + 12,
};

const initialConsultStatus = 'NONE';

// ✅ 더미 댓글
const DUMMY_COMMENTS = [
    {
        id: 'c1',
        userId: DUMMY_ME.id,
        nickname: DUMMY_ME.nickname,
        avatarUrl: '',
        createdAt: '2024-07-09 08:11',
        content: '지금까지 쓴 어떤 세무사 연결 플랫폼 보다 만족도가 높은것 같아요. 앞으로도 계속 이용하겠습니다^^',
    },
    // ✅ 내 더미 댓글 하나 더 (추가)
    {
        id: 'c1-2',
        userId: DUMMY_ME.id,
        nickname: DUMMY_ME.nickname,
        avatarUrl: '',
        createdAt: '2026-02-13 11:30',
        content: '두 번째 내 댓글 더미입니다! 설명이 친절하고 처리 과정이 명확해서 믿음이 갔어요.',
    },
    {
        id: 'c2',
        userId: 'u2',
        nickname: 'Cookiee@23',
        avatarUrl: '',
        createdAt: '2026-02-08 04:35',
        content:
            '지인에게 추천받아 쓰게 된 플랫폼인데 생각보다 정말 좋은것 같아요! 그래서 친구에게 추천하기로 했어요!!',
    },
    {
        id: 'c3',
        userId: 'u3',
        nickname: '채율이아빠',
        avatarUrl: '',
        createdAt: '2026-02-07 13:20',
        content:
            '가게를 차린지 몇 년 됐는데 혼자 세무처리를 하려니 너무 어렵더라고요.. 세무사, AI와 상담하니 금방 처리 됐습니다.',
    },
    {
        id: 'c4',
        userId: 'u4',
        nickname: 'Tiger294#',
        avatarUrl: '',
        createdAt: '2026-01-15 09:18',
        content:
            '말투도 상냥하시고 어려운 용어를 쉽게 설명해주셔서 너무 좋았고 사업자등록을 어떻게 할 지 몰랐는데 이제 방법을 잘 알게 됐어요!',
    },
];

// ✅ 더미 상담 신청 리스트(세무사용)
const DUMMY_REQUESTS = [
    { id: 'r1', nickname: 'Tiger294#', createdAt: '2025-12-13 23:06', avatarUrl: '' },
    { id: 'r2', nickname: 'Lemon378', createdAt: '2024-05-09 15:11', avatarUrl: '' },
    { id: 'r3', nickname: '채율이아빠', createdAt: '2024-06-09 08:12', avatarUrl: '' },
    { id: 'r4', nickname: 'Cookiee@23', createdAt: '2026-02-08 04:35', avatarUrl: '' },
];

/**
 * viewerRole: 'USER' | 'TAXPRO'
 * nav: { taxProId, focus: 'comments', highlightUserId }
 */
export default function TaxProfile({ viewerRole = 'USER', nav = null }) {
    const isTaxProViewer = viewerRole === 'TAXPRO';

    const me = DUMMY_ME;

    // ✅ nav.taxProId로 나중에 다른 세무사 데이터 로드하기 쉬움 (지금은 더미만)
    const taxPro = DUMMY_TAXPRO;

    const [consultStatus, setConsultStatus] = useState(initialConsultStatus);

    // 추천(좋아요) 토글 (유저 화면에서만 의미)
    const [liked, setLiked] = useState(false);

    // 별점(유저 1회)
    const [myRating, setMyRating] = useState(null);
    const [ratingDraft, setRatingDraft] = useState(0);

    // 댓글 입력
    const [commentDraft, setCommentDraft] = useState('');

    // 댓글 목록/토글
    const [commentsOpen, setCommentsOpen] = useState(false);

    // 댓글 데이터
    const [comments, setComments] = useState(DUMMY_COMMENTS);

    // 상담 신청 리스트(세무사 화면)
    const [requests, setRequests] = useState(DUMMY_REQUESTS);

    // ✅ nav.focus === 'comments'면 자동 펼치기
    useEffect(() => {
        if (nav?.focus === 'comments') {
            setCommentsOpen(true);
        }
    }, [nav]);

    // createdAt: "YYYY-MM-DD HH:mm" -> time(ms)
    const toTime = (s) => {
    if (!s) return 0;
    // Safari/브라우저 파싱 안정화
    return new Date(s.replace(' ', 'T')).getTime();
    };

    // ✅ 내 댓글 위로 (highlightUserId 우선) + 각 그룹 최신순 정렬
    const orderedComments = useMemo(() => {
    const uid = nav?.highlightUserId || me.id;

    const mine = comments
        .filter((c) => c.userId === uid)
        .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));

    const others = comments
        .filter((c) => c.userId !== uid)
        .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));

    return [...mine, ...others];
    }, [comments, nav, me.id]);

    const stats = useMemo(() => {
        const likesCount = DUMMY_STATS.likesCount + (!isTaxProViewer && liked ? 1 : 0);
        const avgRating = myRating == null ? DUMMY_STATS.avgRating : (DUMMY_STATS.avgRating * 10 + myRating) / 11;

        return {
            ...DUMMY_STATS,
            likesCount,
            avgRating,
        };
    }, [liked, myRating, isTaxProViewer]);

    const totalScore = useMemo(() => calcTotalScore(stats), [stats]);
    const donutSegments = useMemo(() => buildDonutSegments(stats), [stats]);

    // ====== 사용자: 상담 신청 버튼 ======
    const handleConsultRequest = () => {
        if (!me.isLoggedIn) {
            alert('로그인 후 이용 가능합니다.');
            return;
        }
        if (consultStatus === 'PENDING') return;
        setConsultStatus('PENDING');
    };

    // ====== 댓글 삭제 (사용자만) ======
    const handleDeleteComment = (commentId) => {
        const target = comments.find((c) => c.id === commentId);
        if (!target) return;
        if (target.userId !== me.id) return;

        const ok = window.confirm('정말 삭제하시겠습니까?');
        if (!ok) return;

        setComments((prev) => prev.filter((c) => c.id !== commentId));
    };

    // ====== 댓글 입력 (사용자만) ======
    const handleSubmitComment = () => {
        if (!me.isLoggedIn) {
            alert('로그인 후 이용 가능합니다.');
            return;
        }
        const text = commentDraft.trim();
        if (!text) return;

        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const formatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
            now.getHours(),
        )}:${pad(now.getMinutes())}`;

        const newComment = {
            id: `c_${Date.now()}`,
            userId: me.id,
            nickname: me.nickname,
            avatarUrl: me.avatarUrl,
            createdAt: formatted,
            content: text,
        };

        setComments((prev) => [newComment, ...prev]);
        setCommentDraft('');
        setCommentsOpen(true);
    };

    const handleCancelComment = () => setCommentDraft('');

    // ====== 별점 입력 (사용자만) ======
    const handleSubmitRating = () => {
        if (!me.isLoggedIn) {
            alert('로그인 후 이용 가능합니다.');
            return;
        }
        if (myRating != null) {
            alert('이미 평가하셨습니다.');
            return;
        }
        if (ratingDraft < 1) {
            alert('별을 눌러주십시오');
            return;
        }
        setMyRating(ratingDraft);
    };

    const handleCancelRating = () => setRatingDraft(0);

    // ====== 추천 토글 (사용자만) ======
    const handleToggleLike = () => {
        if (!me.isLoggedIn) {
            alert('로그인 후 이용 가능합니다.');
            return;
        }
        setLiked((v) => !v);
    };

    // ====== 세무사: 상담 신청 수락/거절 ======
    const handleAccept = (requestId) => {
        alert(`수락(더미): ${requestId}\n=> 여기서 하단에 ChatList/ChatRoom 렌더링 연결하면 됨`);
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
    };

    const handleReject = (requestId) => {
        alert(`거절(더미): ${requestId}\n=> 사용자 화면은 상담신청 버튼이 다시 '상담 신청'으로 원복`);
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
    };

    // ✅ createdAt 기준 최신순 정렬
    const sortByCreatedAtDesc = (arr) =>
        [...arr].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    // ✅ 전체 댓글 최신순
    const allSorted = useMemo(() => sortByCreatedAtDesc(comments), [comments]);

    // ✅ 접힘 미리보기용: 전체 중 가장 최신 1개
    const latestAllComment = allSorted[0] || null;

    // ✅ 세무사→세무사: "사용자 댓글만" 최신순
    const taxViewComments = useMemo(
    () => allSorted.filter((c) => c.userId !== taxPro.id), // (혹시 taxPro가 댓글 쓸 일이 있으면 제외)
    [allSorted, taxPro.id]
    );


    return (
        <div className="profile-root">
            <h2 className="profile-title">프로필</h2>

            <div className="profile-card profile-top">
                <ProfileHeaderCard
                    taxPro={taxPro}
                    viewerRole={viewerRole}
                    consultStatus={consultStatus}
                    onConsultRequest={handleConsultRequest}
                    onSaveProfile={(updated) => {
                        alert('프로필 저장(더미)\n' + JSON.stringify(updated, null, 2));
                    }}
                />

                {!isTaxProViewer && consultStatus === 'PENDING' && (
                    <div className="profile-help-text">세무사가 상담 신청 거절 시 다시 ‘상담 신청’으로 돌아갑니다.</div>
                )}
                {!isTaxProViewer && consultStatus === 'REJECTED' && (
                    <div className="profile-help-text">세무사가 거절했습니다. 다시 상담 신청이 가능합니다.</div>
                )}
            </div>

            <CommentCard
                open={commentsOpen}
                onToggle={() => setCommentsOpen((v) => !v)}
                latestComment={isTaxProViewer ? (taxViewComments[0] || null) : latestAllComment}
                >
                {isTaxProViewer ? (
                    <TaxCommentList comments={taxViewComments} pageSize={3} />
                ) : (
                    <CommentList
                    me={me}
                    comments={orderedComments}
                    onDelete={handleDeleteComment}
                    pageSize={3}
                    canDelete={true}
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
                        onCancelRating={handleCancelRating}
                        commentDraft={commentDraft}
                        onChangeCommentDraft={setCommentDraft}
                        onSubmitComment={handleSubmitComment}
                        onCancelComment={handleCancelComment}
                    />
                </div>
            )}

            {isTaxProViewer && (
                <div className="profile-card profile-consults">
                    <ConsultationRequestList
                        requests={requests}
                        onAccept={handleAccept}
                        onReject={handleReject}
                        pageSize={3}
                    />
                </div>
            )}
        </div>
    );
}
