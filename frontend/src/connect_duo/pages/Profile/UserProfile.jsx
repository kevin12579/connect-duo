import React, { useState } from 'react';
import './UserProfile.css';
import UserProfileCard from './components/UserProfileCard';
import MyCommentsCard from './components/MyCommentsCard';

// ✅ 더미 사용자 (여기만 나중에 API로 교체하면 됨)
const DUMMY_USER = {
    id: 'user-99',
    nickname: 'Lemon378',
    email: 'lemon378@connectduo.com',
    avatarUrl: '',
    isLoggedIn: true,
};

// ✅ 더미 "내가 쓴 댓글" 목록
const DUMMY_MYCOMMENTS = [
    {
        taxProId: 'taxpro-1',
        taxProName: '김세진 세무사',
        avatarUrl: '',
        count: 3,
    },
    {
        taxProId: 'taxpro-2',
        taxProName: '이도현 세무사',
        avatarUrl: '',
        count: 1,
    },
];

export default function UserProfile({ onOpenTaxProProfile }) {
    const [user, setUser] = useState(DUMMY_USER);

    const handleSave = (updated) => {
        // 실제로는 PUT /users/me
        setUser((prev) => ({ ...prev, ...updated }));
    };

    const handleDeleteAccount = () => {
        const ok = window.confirm('정말 탈퇴하시겠습니까?');
        if (!ok) return;

        // 실제로는 DELETE /users/me
        alert('탈퇴 완료 (더미)');
    };

    return (
        <div className="uprofile-root">
            <h2 className="uprofile-title">프로필</h2>

            <div className="uprofile-card">
                <UserProfileCard
                    user={user} // ✅ 이제 undefined 아님
                    onSave={handleSave}
                    onDeleteAccount={handleDeleteAccount}
                />
            </div>

            <div className="uprofile-card mycomments-card">
                <MyCommentsCard user={user} items={DUMMY_MYCOMMENTS} onOpenTaxProProfile={onOpenTaxProProfile} />
            </div>
        </div>
    );
}
