import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import './TaxProfile.css';

import ProfileHeaderCard from './components/ProfileHeaderCard';
import CommentCard from './components/CommentCard';
import CommentList from './components/CommentList';
import TaxCommentList from './components/TaxCommentList';
import StatsCard from './components/StatsCard';
import ScoreDonutCard from './components/ScoreDonutCard';
import ActionCard from './components/ActionCard';
import ConsultationRequestList from './components/ConsultationRequestList';
import HomeLogoButton from '../../components/HomeLogoButton';
import { AUTH_STORAGE_EVENT, getAuthState } from '../../utils/authStorage';

import { calcTotalScore, buildDonutSegments } from './utils/score';
import { getCommentsByTaxProId, saveCommentsByTaxProId } from './utils/commentStore';
import { dummyTaxAdvisors } from '../Ranking/dummyTaxAdvisors';

const initialConsultStatus = 'NONE';

const DUMMY_REQUESTS = [
    { id: 'r1', nickname: 'Tiger294#', createdAt: '2025-12-13 23:06', avatarUrl: '' },
    { id: 'r2', nickname: 'Lemon378', createdAt: '2024-05-09 15:11', avatarUrl: '' },
    { id: 'r3', nickname: 'TaxBeginner', createdAt: '2024-06-09 08:12', avatarUrl: '' },
    { id: 'r4', nickname: 'Cookiee@23', createdAt: '2026-02-08 04:35', avatarUrl: '' },
];

const mapOwnerProfile = (currentUser) => ({
    id: `taxpro-${currentUser?.id || 'me'}`,
    name: currentUser?.name || currentUser?.username || '세무사',
    oneLine: currentUser?.oneLine || '절세 전략부터 신고까지 꼼꼼하게 도와드립니다.',
    intro: currentUser?.intro || '',
    specialty: currentUser?.intro || '',
    avatarUrl: currentUser?.avatarUrl || '',
});

export default function TaxProfile({ viewerRole = 'USER', nav = null, currentUser = null }) {
    const { taxAdvisorId } = useParams();
    const location = useLocation();
    const navState = nav ?? location.state ?? null;
    const isTaxProViewer = viewerRole === 'TAXPRO';
    const showHomeLogo = !isTaxProViewer;
    const [authState, setAuthState] = useState(getAuthState);

    const [ownerTaxProfile, setOwnerTaxProfile] = useState(() => mapOwnerProfile(currentUser));

    useEffect(() => {
        if (isTaxProViewer) {
            setOwnerTaxProfile(mapOwnerProfile(currentUser));
        }
    }, [isTaxProViewer, currentUser]);

    const selectedAdvisor = useMemo(() => {
        const targetAdvisorId = Number(taxAdvisorId || navState?.taxProId || 1);
        return dummyTaxAdvisors.find((advisor) => advisor.id === targetAdvisorId) || dummyTaxAdvisors[0];
    }, [taxAdvisorId, navState?.taxProId]);

    const me = useMemo(() => {
        const user = authState.user ?? null;
        const userId = user?.id ?? user?.username ?? null;
        return {
            id: userId,
            nickname: user?.name || user?.username || '로그인 필요',
            avatarUrl: user?.avatarUrl || '',
            isLoggedIn: authState.isLoggedIn && Boolean(userId),
        };
    }, [authState]);

    useEffect(() => {
        // eslint-disable-next-line no-console
        console.log('[TaxProfile] auth/me', {
            isLoggedIn: me.isLoggedIn,
            userId: me.id,
            nickname: me.nickname,
        });
    }, [me.id, me.isLoggedIn, me.nickname]);

    const taxPro = useMemo(() => {
        if (isTaxProViewer) {
            return ownerTaxProfile;
        }

        return {
            id: `taxpro-${selectedAdvisor.id}`,
            name: selectedAdvisor.name,
            oneLine: `${selectedAdvisor.desc} 기반으로 실무 중심 상담을 제공합니다.`,
            specialty: selectedAdvisor.desc,
            intro: selectedAdvisor.desc,
            avatarUrl: selectedAdvisor.photo,
        };
    }, [isTaxProViewer, ownerTaxProfile, selectedAdvisor]);

    const baseStats = useMemo(
        () => ({
            likesCount: isTaxProViewer ? 42 : selectedAdvisor.stats.recommendCount,
            avgRating: isTaxProViewer
                ? 4.7
                : Math.max(1, Math.min(5, selectedAdvisor.stats.satisfaction / 20)),
            repeatRate: isTaxProViewer ? 0.86 : selectedAdvisor.stats.reConsultRate / 100,
            consultCount: isTaxProViewer ? 120 : selectedAdvisor.stats.consultCount,
            avgResponseSeconds: isTaxProViewer ? 40 * 60 : selectedAdvisor.stats.avgReplyHours * 60 * 60,
        }),
        [isTaxProViewer, selectedAdvisor],
    );

    const [consultStatus, setConsultStatus] = useState(initialConsultStatus);
    const [liked, setLiked] = useState(false);
    const [myRating, setMyRating] = useState(null);
    const [ratingDraft, setRatingDraft] = useState(0);
    const [commentDraft, setCommentDraft] = useState('');
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [comments, setComments] = useState([]);
    const [isCommentsHydrated, setIsCommentsHydrated] = useState(false);
    const [requests, setRequests] = useState(DUMMY_REQUESTS);

    useEffect(() => {
        const syncAuth = () => setAuthState(getAuthState());
        syncAuth();
        window.addEventListener('storage', syncAuth);
        window.addEventListener(AUTH_STORAGE_EVENT, syncAuth);
        return () => {
            window.removeEventListener('storage', syncAuth);
            window.removeEventListener(AUTH_STORAGE_EVENT, syncAuth);
        };
    }, []);

    useEffect(() => {
        if (isTaxProViewer) return;
        setIsCommentsHydrated(false);
        // eslint-disable-next-line no-console
        console.log('[TaxProfile] load comments', {
            selectedAdvisorId: selectedAdvisor.id,
        });
        const loadedComments = getCommentsByTaxProId(selectedAdvisor.id);
        setComments(loadedComments);
        setIsCommentsHydrated(true);
    }, [isTaxProViewer, selectedAdvisor.id]);

    useEffect(() => {
        if (isTaxProViewer || !isCommentsHydrated) return;
        // eslint-disable-next-line no-console
        console.log('[TaxProfile] persist comments', {
            selectedAdvisorId: selectedAdvisor.id,
            count: comments.length,
        });
        saveCommentsByTaxProId(selectedAdvisor.id, comments);
    }, [comments, isTaxProViewer, selectedAdvisor.id, isCommentsHydrated]);

    useEffect(() => {
        if (navState?.focus === 'comments') {
            setCommentsOpen(true);
        }
    }, [navState]);

    const toTime = (s) => {
        if (!s) return 0;
        return new Date(s.replace(' ', 'T')).getTime();
    };

    const orderedComments = useMemo(() => {
        const uid = navState?.highlightUserId || me.id;

        const mine = comments
            .filter((c) => c.userId === uid)
            .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));

        const others = comments
            .filter((c) => c.userId !== uid)
            .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));

        return [...mine, ...others];
    }, [comments, navState, me.id]);

    const stats = useMemo(() => {
        const likesCount = baseStats.likesCount + (!isTaxProViewer && liked ? 1 : 0);
        const avgRating = myRating == null ? baseStats.avgRating : (baseStats.avgRating * 10 + myRating) / 11;

        return {
            ...baseStats,
            likesCount,
            avgRating,
        };
    }, [baseStats, liked, myRating, isTaxProViewer]);

    const totalScore = useMemo(() => calcTotalScore(stats), [stats]);
    const donutSegments = useMemo(() => buildDonutSegments(stats), [stats]);

    const handleConsultRequest = () => {
        if (!me.isLoggedIn) {
            alert('로그인 후 이용할 수 있습니다.');
            return;
        }
        if (consultStatus === 'PENDING') return;
        setConsultStatus('PENDING');
    };

    const handleDeleteComment = (commentId) => {
        const target = comments.find((c) => c.id === commentId);
        if (!target) return;
        if (target.userId !== me.id) return;

        const ok = window.confirm('댓글을 삭제하시겠습니까?');
        if (!ok) return;

        setComments((prev) => prev.filter((c) => c.id !== commentId));
    };

    const handleSubmitComment = () => {
        if (!me.isLoggedIn) {
            alert('로그인 후 이용할 수 있습니다.');
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

        // eslint-disable-next-line no-console
        console.log('[TaxProfile] submit comment', {
            selectedAdvisorId: selectedAdvisor.id,
            userId: me.id,
            commentId: newComment.id,
        });
        setComments((prev) => [newComment, ...prev]);
        setCommentDraft('');
        setCommentsOpen(true);
    };

    const handleCancelComment = () => setCommentDraft('');

    const handleSubmitRating = () => {
        if (!me.isLoggedIn) {
            alert('로그인 후 이용할 수 있습니다.');
            return;
        }
        if (myRating != null) {
            alert('평가는 한 번만 등록할 수 있습니다.');
            return;
        }
        if (ratingDraft < 1) {
            alert('별점을 1점 이상 선택해 주세요.');
            return;
        }
        setMyRating(ratingDraft);
    };

    const handleCancelRating = () => setRatingDraft(0);

    const handleToggleLike = () => {
        if (!me.isLoggedIn) {
            alert('로그인 후 이용할 수 있습니다.');
            return;
        }
        setLiked((v) => !v);
    };

    const handleAccept = (requestId) => {
        alert(`요청 수락: ${requestId}`);
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
    };

    const handleReject = (requestId) => {
        alert(`요청 거절: ${requestId}`);
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
    };

    const handleSaveProfile = (updated) => {
        if (!isTaxProViewer) {
            return;
        }

        setOwnerTaxProfile((prev) => {
            const next = {
                ...prev,
                ...updated,
                specialty: updated.intro || updated.oneLine || prev.specialty,
            };

            try {
                const raw = localStorage.getItem('currentUser');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    const patched = {
                        ...parsed,
                        name: next.name,
                        avatarUrl: next.avatarUrl,
                        oneLine: next.oneLine,
                        intro: next.intro,
                    };
                    localStorage.setItem('currentUser', JSON.stringify(patched));
                }
            } catch {
                // no-op
            }

            return next;
        });
    };

    const handleDeleteAccount = () => {
        const ok = window.confirm('정말 회원 탈퇴를 진행하시겠습니까?');
        if (!ok) return;

        localStorage.removeItem('accessToken');
        localStorage.removeItem('currentUser');
        alert('회원 탈퇴 처리가 완료되었습니다. (더미)');
        window.location.href = '/';
    };

    const sortByCreatedAtDesc = (arr) => [...arr].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const allSorted = useMemo(() => sortByCreatedAtDesc(comments), [comments]);
    const latestAllComment = allSorted[0] || null;

    const taxViewComments = useMemo(
        () => allSorted.filter((c) => c.userId !== taxPro.id),
        [allSorted, taxPro.id],
    );

    return (
        <div className="profile-root">
            {showHomeLogo && <HomeLogoButton fixed={false} />}
            <h2 className="profile-title">프로필</h2>

            <div className="profile-card profile-top">
                {isTaxProViewer && <h3 className="tax-settings-title">세무사 계정 설정</h3>}

                <ProfileHeaderCard
                    taxPro={taxPro}
                    viewerRole={viewerRole}
                    consultStatus={consultStatus}
                    onConsultRequest={handleConsultRequest}
                    onSaveProfile={handleSaveProfile}
                />

                {isTaxProViewer && (
                    <div className="tax-settings-actions">
                        <button type="button" className="tax-withdraw-btn" onClick={handleDeleteAccount}>
                            회원 탈퇴
                        </button>
                    </div>
                )}

                {!isTaxProViewer && consultStatus === 'PENDING' && (
                    <div className="profile-help-text">상담 요청이 접수되었습니다.</div>
                )}
                {!isTaxProViewer && consultStatus === 'REJECTED' && (
                    <div className="profile-help-text">상담 요청이 거절되었습니다. 다른 세무사를 찾아보세요.</div>
                )}
            </div>

            <CommentCard
                open={commentsOpen}
                onToggle={() => setCommentsOpen((v) => !v)}
                latestComment={isTaxProViewer ? taxViewComments[0] || null : latestAllComment}
            >
                {isTaxProViewer ? (
                    <TaxCommentList comments={taxViewComments} pageSize={3} />
                ) : (
                    <CommentList me={me} comments={orderedComments} onDelete={handleDeleteComment} pageSize={3} canDelete={true} />
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
                    <ConsultationRequestList requests={requests} onAccept={handleAccept} onReject={handleReject} pageSize={3} />
                </div>
            )}
        </div>
    );
}



