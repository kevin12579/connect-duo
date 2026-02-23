import React, { useEffect, useState } from 'react';
import {
    acceptConsult,
    rejectConsult,
    getUserProfile,
    getTaxProProfile, // ★ 반드시 import!
    updateUserProfile,
    deleteUserAccount,
} from '../../api/axios';
import { useAuthStore } from '../../stores/authStore';
import './UserProfile.css';
import UserProfileCard from './components/UserProfileCard';
import MyCommentsCard from './components/MyCommentsCard';
import ConsultationRequestList from './components/ConsultationRequestList';

export default function UserProfile({ onOpenTaxProProfile }) {
    const { logout } = useAuthStore();
    const [user, setUser] = useState(null);
    const [myComments, setMyComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState([]);

    // 주요 데이터 패칭
    const fetchProfileData = async () => {
        setLoading(true);
        const storedUser = JSON.parse(localStorage.getItem('userBackup') || 'null');
        if (!storedUser || !storedUser.id) {
            setLoading(false);
            return;
        }
        try {
            // 1. 기본 사용자 프로필/코멘트
            const response = await getUserProfile(storedUser.id);
            if (response.result === 'success') {
                setUser({
                    id: response.data.user.id,
                    name: response.data.user.name,
                    username: response.data.user.username,
                    avatarUrl: response.data.user.profile_img || '',
                    bio: response.data.user.bio_one_line || '',
                    userType: response.data.user.user_type,
                });
                setMyComments(response.data.comments);
            }

            // 2. 세무사라면 상담신청 리스트도 불러오기
            if (response.result === 'success' && response.data.user.user_type === 'TAX_ACCOUNTANT') {
                const taxProUserId = response.data.user.id;
                const res = await getTaxProProfile(taxProUserId); // 반드시 Users.id(본인)
                if (res.result === 'success') {
                    setRequests(res.data.requests || []);
                } else {
                    setRequests([]);
                }
            } else {
                setRequests([]); // 일반 유저는 상담리스트 없음
            }
        } catch (error) {
            setUser(null);
            setMyComments([]);
            setRequests([]);
            console.error('프로필 로딩 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfileData();
        //eslint-disable-next-line
    }, []);

    // 상담 수락
    const handleAccept = async (requestId) => {
        try {
            const res = await acceptConsult(requestId);
            if (res.result === 'success') {
                setRequests((prev) => prev.filter((r) => r.id !== requestId));
            } else {
                alert(res.message || '수락 실패');
            }
        } catch (e) {
            alert('수락 에러');
        }
    };

    // 상담 거절
    const handleReject = async (requestId) => {
        try {
            const res = await rejectConsult(requestId);
            if (res.result === 'success') {
                setRequests((prev) => prev.filter((r) => r.id !== requestId));
            } else {
                alert(res.message || '거절 실패');
            }
        } catch (e) {
            alert('거절 에러');
        }
    };

    const handleSave = async (updated) => {
        try {
            const res = await updateUserProfile(user.id, {
                name: updated.name,
                profile_img: updated.avatarUrl,
                bio_one_line: updated.bio,
            });
            if (res.result === 'success') {
                alert('성공적으로 수정되었습니다.');
                fetchProfileData();
            }
        } catch (err) {
            alert('수정 중 오류가 발생했습니다.');
        }
    };

    const handleDeleteAccount = async () => {
        if (window.confirm('정말 탈퇴하시겠습니까? 작성하신 리뷰와 상담 내역이 모두 삭제됩니다.')) {
            try {
                const res = await deleteUserAccount(user.id);
                if (res.result === 'success') {
                    alert('탈퇴가 완료되었습니다. 감사합니다.');
                    logout();
                    window.location.href = '/';
                }
            } catch (err) {
                alert('탈퇴 처리 실패: ' + err.message);
            }
        }
    };

    if (loading) return <div className="loading">사용자 정보를 불러오는 중입니다...</div>;
    if (!user) return <div className="error">로그인 세션이 만료되었습니다. 다시 로그인해주세요.</div>;

    const isTaxProUser = user.userType === 'TAX_ACCOUNTANT';

    return (
        <div className="uprofile-root">
            <h2 className="uprofile-title">내 계정 설정</h2>
            <div className="uprofile-card">
                {isTaxProUser && (
                    <button
                        className="mytaxpro-btn"
                        style={{
                            marginBottom: '16px',
                            background: '#eaf7ff',
                            color: '#1a67b2',
                            fontWeight: 'bold',
                            borderRadius: '8px',
                            padding: '10px 18px',
                            border: '1px solid #bde0ff',
                            cursor: 'pointer',
                        }}
                        onClick={() => onOpenTaxProProfile(user.id)}
                    >
                        내 세무사 프로필 페이지로 이동
                    </button>
                )}
                <UserProfileCard user={user} onSave={handleSave} onDeleteAccount={handleDeleteAccount} />
            </div>
            {isTaxProUser && (
                <div className="uprofile-card profile-consults">
                    <ConsultationRequestList
                        requests={requests}
                        onAccept={handleAccept}
                        onReject={handleReject}
                        pageSize={3}
                    />
                </div>
            )}
            <div className="uprofile-card mycomments-card">
                <h3 className="mycomments-title">내가 리뷰를 남긴 전문가</h3>
                <MyCommentsCard user={user} items={myComments} onOpenTaxProProfile={onOpenTaxProProfile} pageSize={2} />
            </div>
        </div>
    );
}
