import React, { useState, useEffect } from 'react';
import { getUserProfile } from '../../api/axios';
import './UserProfile.css';
import UserProfileCard from './components/UserProfileCard';
import MyCommentsCard from './components/MyCommentsCard';

export default function UserProfile({ onOpenTaxProProfile }) {
    const [user, setUser] = useState(null);
    const [myComments, setMyComments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfileData = async () => {
            // 1. 로컬스토리지에서 직접 유저 정보 파싱
            const storedUser = JSON.parse(localStorage.getItem('userBackup') || 'null');

            console.log('로컬스토리지 유저 정보:', storedUser);

            // 2. id 존재 여부 확인
            if (!storedUser || !storedUser.id) {
                console.warn('로컬스토리지에 유저 ID가 없습니다. 로그인이 필요합니다.');
                setLoading(false);
                return;
            }

            try {
                // 3. API 호출 (저장된 id 사용)
                const response = await getUserProfile(storedUser.id);
                console.log('서버 응답:', response);

                if (response.result === 'success') {
                    setUser({
                        id: response.data.user.id,
                        nickname: response.data.user.name,
                        email: response.data.user.username,
                        avatarUrl: response.data.user.profile_img || '',
                        isLoggedIn: true,
                    });
                    setMyComments(response.data.comments);
                }
            } catch (error) {
                console.error('프로필 로딩 실패:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfileData();
    }, []); // 컴포넌트 마운트 시 1회 실행

    const handleSave = (updated) => {
        // 실제 API 호출 로직 (생략)
        setUser((prev) => ({ ...prev, ...updated }));
    };

    const handleDeleteAccount = () => {
        if (window.confirm('정말 탈퇴하시겠습니까?')) {
            alert('탈퇴 처리되었습니다.');
        }
    };

    if (loading) return <div className="loading">로딩 중...</div>;

    // 유저 정보가 없을 때 화면 처리
    if (!user) return <div className="error">로그인 정보가 유효하지 않습니다. 다시 로그인 해주세요.</div>;

    return (
        <div className="uprofile-root">
            <h2 className="uprofile-title">프로필</h2>
            <div className="uprofile-card">
                <UserProfileCard user={user} onSave={handleSave} onDeleteAccount={handleDeleteAccount} />
            </div>
            <div className="uprofile-card mycomments-card">
                <MyCommentsCard user={user} items={myComments} onOpenTaxProProfile={onOpenTaxProProfile} />
            </div>
        </div>
    );
}
