import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './UserProfile.css';
import UserProfileCard from './components/UserProfileCard';
import MyCommentsCard from './components/MyCommentsCard';
import { getMyCommentCounts } from './utils/commentStore';
import { dummyTaxAdvisors } from '../Ranking/dummyTaxAdvisors';

const mapCurrentUserToProfile = (currentUser) => ({
    id: currentUser?.id || 'user-99',
    nickname: currentUser?.name || currentUser?.username || '사용자',
    email: currentUser?.username ? `${currentUser.username}@connectduo.com` : '',
    avatarUrl: currentUser?.avatarUrl || '',
    isLoggedIn: true,
});

export default function UserProfile({ onOpenTaxProProfile, currentUser = null }) {
    const navigate = useNavigate();
    const initialProfile = useMemo(() => mapCurrentUserToProfile(currentUser), [currentUser]);
    const [user, setUser] = useState(initialProfile);
    const [refreshTick, setRefreshTick] = useState(0);

    useEffect(() => {
        setUser(initialProfile);
    }, [initialProfile]);

    useEffect(() => {
        const onFocus = () => setRefreshTick((v) => v + 1);
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, []);

    const myCommentItems = useMemo(() => {
        if (!user?.id) return [];

        return getMyCommentCounts(user.id)
            .map((item) => {
                const advisor = dummyTaxAdvisors.find((taxPro) => taxPro.id === item.taxProId);
                return {
                    taxProId: item.taxProId,
                    taxProName: advisor?.name || `세무사 ${item.taxProId}`,
                    avatarUrl: advisor?.photo || '',
                    count: item.count,
                };
            })
            .sort((a, b) => b.count - a.count || a.taxProName.localeCompare(b.taxProName));
    }, [user?.id, refreshTick]);

    const handleOpenTaxProProfile = (payload) => {
        if (onOpenTaxProProfile) {
            onOpenTaxProProfile(payload);
            return;
        }

        const taxProId = Number(payload?.taxProId);
        if (!taxProId) return;

        navigate(`/profile/tax/${taxProId}`, {
            state: {
                focus: 'comments',
                highlightUserId: user?.id,
            },
        });
    };

    const handleSave = (updated) => {
        setUser((prev) => {
            const next = { ...prev, ...updated };

            const storedUserRaw = localStorage.getItem('currentUser');
            if (storedUserRaw) {
                try {
                    const storedUser = JSON.parse(storedUserRaw);
                    const patchedStoredUser = {
                        ...storedUser,
                        name: next.nickname,
                        avatarUrl: next.avatarUrl,
                    };
                    localStorage.setItem('currentUser', JSON.stringify(patchedStoredUser));
                } catch {
                    // no-op
                }
            }

            return next;
        });
    };

    const handleDeleteAccount = () => {
        const ok = window.confirm('정말 탈퇴하시겠습니까?');
        if (!ok) return;

        localStorage.removeItem('accessToken');
        localStorage.removeItem('currentUser');
        alert('계정 탈퇴가 완료되었습니다. (더미)');
        window.location.href = '/';
    };

    return (
        <div className="uprofile-root">
            <h2 className="uprofile-title">프로필</h2>

            <div className="uprofile-card">
                <h3 className="mycomments-title">일반 사용자 설정</h3>
                <UserProfileCard user={user} onSave={handleSave} onDeleteAccount={handleDeleteAccount} />
            </div>

            <div className="uprofile-card mycomments-card">
                <MyCommentsCard user={user} items={myCommentItems} onOpenTaxProProfile={handleOpenTaxProProfile} />
            </div>
        </div>
    );
}
