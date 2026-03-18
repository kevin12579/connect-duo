import React, { useEffect, useState } from 'react';
import {
    acceptConsult,
    rejectConsult,
    getUserProfile,
    getTaxProProfile,
    updateUserProfile,
    deleteUserAccount,
    chargeCredit,
    getCredit,
} from '../../api/axios';
import { useAuthStore } from '../../stores/authStore';
import './UserProfile.css';
import UserProfileCard from './components/UserProfileCard';
import MyCommentsCard from './components/MyCommentsCard';
import ConsultationRequestList from './components/ConsultationRequestList';

const NOTI_STORAGE_KEY = 'consult_status_notifications_v1';

function pushConsultStatusNotification({ requesterId, taxProName, status }) {
    if (!requesterId) return;

    try {
        const raw = localStorage.getItem(NOTI_STORAGE_KEY);
        const prev = raw ? JSON.parse(raw) : [];
        const safePrev = Array.isArray(prev) ? prev : [];

        const next = [
            {
                id: `noti-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                requesterId,
                taxProName,
                status,
                actedAt: new Date().toISOString(),
                read: false,
            },
            ...safePrev,
        ];

        localStorage.setItem(NOTI_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
        console.error('상담 결과 알림 저장 실패:', e);
    }
}

function getRequesterIdFromRequest(request) {
    return (
        request?.user_id ||
        request?.userId ||
        request?.requester_id ||
        request?.requesterId ||
        request?.from_user_id ||
        request?.fromUserId ||
        request?.request_user_id ||
        request?.client_id ||
        request?.member_id ||
        request?.user?.id ||
        request?.requester?.id ||
        null
    );
}

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
            const response = await getUserProfile(storedUser.id);

            if (response.result === 'success') {
                const userData = response.data.user;

                let credit = userData.credit || 0;
                try {
                    const creditRes = await getCredit(userData.id);
                    if (creditRes.result === 'success') credit = creditRes.credit;
                } catch (_) {}

                setUser({
                    id: userData.id,
                    name: userData.name,
                    username: userData.username,
                    avatarUrl: userData.profile_img || '',
                    bio: userData.bio_one_line || '',
                    userType: userData.user_type,
                    credit,
                    company_name: userData.company_name || '',
                    office_address: userData.office_address || '',
                    experience_years: userData.experience_years || 0,
                    monthly_fee: userData.monthly_fee || 0,
                    chat_rate_per_10min: userData.chat_rate_per_10min || 0,
                    available_hours: userData.available_hours || '',
                    categories: Array.isArray(userData.categories) ? userData.categories : [],
                    consult_schedule: Array.isArray(userData.consult_schedule) ? userData.consult_schedule : [],
                });

                setMyComments(Array.isArray(response.data.comments) ? response.data.comments : []);

                if (userData.user_type === 'TAX_ACCOUNTANT') {
                    const res = await getTaxProProfile(userData.id, userData.id);
                    if (res.result === 'success') {
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

    const handleChargeCredit = async (amount, description) => {
        try {
            const res = await chargeCredit(user.id, amount, description);
            if (res.result === 'success') {
                alert(
                    `✅ ${amount.toLocaleString()} 크레딧이 충전되었습니다!\n현재 잔액: ${res.credit.toLocaleString()}`,
                );
                setUser((prev) => ({ ...prev, credit: res.credit }));
            }
        } catch (e) {
            alert('충전 중 오류가 발생했습니다.');
        }
    };

    const handleAccept = async (requestId) => {
        if (!window.confirm('상담을 수락하시겠습니까?')) return;

        try {
            const targetRequest = requests.find((r) => r.id === requestId);
            const requesterId = getRequesterIdFromRequest(targetRequest);

            const res = await acceptConsult(requestId);
            if (res.result === 'success') {
                pushConsultStatusNotification({
                    requesterId,
                    taxProName: user?.name || '세무사',
                    status: 'ACCEPTED',
                });

                alert('상담이 수락되었습니다. 채팅 메뉴를 확인해주세요.');
                setRequests((prev) => prev.filter((r) => r.id !== requestId));
            }
        } catch (e) {
            console.error('수락 처리 중 오류:', e);
            alert('수락 처리 중 오류 발생');
        }
    };

    const handleReject = async (requestId) => {
        if (!window.confirm('상담을 거절하시겠습니까?')) return;

        try {
            const targetRequest = requests.find((r) => r.id === requestId);
            const requesterId = getRequesterIdFromRequest(targetRequest);

            const res = await rejectConsult(requestId);
            if (res.result === 'success') {
                pushConsultStatusNotification({
                    requesterId,
                    taxProName: user?.name || '세무사',
                    status: 'REJECTED',
                });

                alert('상담 요청을 거절했습니다.');
                setRequests((prev) => prev.filter((r) => r.id !== requestId));
            }
        } catch (e) {
            console.error('거절 처리 중 오류:', e);
            alert('거절 처리 중 오류 발생');
        }
    };

    const handleSave = async (updated) => {
        try {
            const res = await updateUserProfile(user.id, {
                name: updated.name,
                profile_img: updated.avatarUrl,
                bio_one_line: updated.bio,
                company_name: updated.company_name,
                office_address: updated.office_address,
                experience_years: updated.experience_years,
                monthly_fee: updated.monthly_fee,
                chat_rate_per_10min: updated.chat_rate_per_10min,
                available_hours: updated.available_hours,
                categories: updated.categories,
                consult_schedule: updated.consult_schedule,
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

                <UserProfileCard
                    user={user}
                    onSave={handleSave}
                    onDeleteAccount={handleDeleteAccount}
                    onChargeCredit={handleChargeCredit}
                />
            </div>

            {user.userType === 'TAX_ACCOUNTANT' && (
                <div className="uprofile-card">
                    <ConsultationRequestList
                        requests={requests}
                        onAccept={handleAccept}
                        onReject={handleReject}
                        pageSize={2}
                    />
                </div>
            )}

            <div className="uprofile-card">
                <MyCommentsCard user={user} items={myComments} onOpenTaxProProfile={onOpenTaxProProfile} pageSize={2} />
            </div>
        </div>
    );
}
