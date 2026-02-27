import React, { useEffect, useState } from 'react';
import {
    acceptConsult,
    rejectConsult,
    getUserProfile,
    getTaxProProfile,
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

    const fetchProfileData = async () => {
        setLoading(true);
        const storedUser = JSON.parse(localStorage.getItem('userBackup') || 'null');

        if (!storedUser || !storedUser.id) {
            setLoading(false);
            return;
        }

        try {
            // 1. 기본 사용자 정보 가져오기
            const response = await getUserProfile(storedUser.id);

            if (response.result === 'success') {
                const userData = response.data.user;
                setUser({
                    id: userData.id,
                    name: userData.name,
                    username: userData.username,
                    avatarUrl: userData.profile_img || '',
                    bio: userData.bio_one_line || '',
                    userType: userData.user_type,
                });
                setMyComments(response.data.comments);

                // 2. 세무사일 경우 본인에게 들어온 상담 신청 리스트 패칭
                if (userData.user_type === 'TAX_ACCOUNTANT') {
                    // ★ 수정 포인트: 두 번째 인자로 본인의 ID(viewerId)를 함께 전달
                    const res = await getTaxProProfile(userData.id, userData.id);
                    if (res.result === 'success') {
                        // 백엔드에서 넘겨주는 requests 데이터 확인
                        setRequests(res.data.requests || []);
                    }
                }
            }
        } catch (error) {
            console.error('프로필 로딩 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfileData();
        // eslint-disable-next-line
    }, []);

    const handleAccept = async (requestId) => {
        if (!window.confirm('상담을 수락하시겠습니까?')) return;
        try {
            const res = await acceptConsult(requestId);
            if (res.result === 'success') {
                alert('상담이 수락되었습니다. 채팅 메뉴를 확인해주세요.');
                setRequests((prev) => prev.filter((r) => r.id !== requestId));
            }
        } catch (e) {
            alert('수락 처리 중 오류 발생');
        }
    };

    const handleReject = async (requestId) => {
        if (!window.confirm('상담을 거절하시겠습니까?')) return;
        try {
            const res = await rejectConsult(requestId);
            if (res.result === 'success') {
                alert('상담 요청을 거절했습니다.');
                setRequests((prev) => prev.filter((r) => r.id !== requestId));
            }
        } catch (e) {
            alert('거절 처리 중 오류 발생');
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
            alert('수정 중 오류 발생');
        }
    };

    const handleDeleteAccount = async () => {
        if (window.confirm('정말 탈퇴하시겠습니까?')) {
            try {
                const res = await deleteUserAccount(user.id);
                if (res.result === 'success') {
                    alert('탈퇴 완료되었습니다.');
                    logout();
                    window.location.href = '/';
                }
            } catch (err) {
                alert('탈퇴 처리 실패');
            }
        }
    };

    if (loading) return <div className="loading">정보를 불러오는 중...</div>;
    if (!user) return <div className="error">세션 만료. 다시 로그인해주세요.</div>;

    return (
        <div className="uprofile-root">
            <h2 className="uprofile-title">내 계정 설정</h2>
            <div className="uprofile-card">
                {user.userType === 'TAX_ACCOUNTANT' && (
                    <button
                        className="mytaxpro-btn"
                        onClick={() => onOpenTaxProProfile(user.id)}
                        style={{ marginBottom: '16px', padding: '10px', cursor: 'pointer' }}
                    >
                        내 세무사 프로필 공개 페이지 확인
                    </button>
                )}
                <UserProfileCard user={user} onSave={handleSave} onDeleteAccount={handleDeleteAccount} />
            </div>

            {user.userType === 'TAX_ACCOUNTANT' && (
                <div className="uprofile-card">
                    <ConsultationRequestList requests={requests} onAccept={handleAccept} onReject={handleReject} />
                </div>
            )}

            <div className="uprofile-card">
                <MyCommentsCard user={user} items={myComments} onOpenTaxProProfile={onOpenTaxProProfile} />
            </div>
        </div>
    );
}
