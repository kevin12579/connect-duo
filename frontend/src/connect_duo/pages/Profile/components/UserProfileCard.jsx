import React, { useEffect, useRef, useState } from 'react';

export default function UserProfileCard({ user, onSave, onDeleteAccount }) {
    const wrapRef = useRef(null);
    const [photoEdit, setPhotoEdit] = useState(false);
    const [infoEdit, setInfoEdit] = useState(false);
    const [draft, setDraft] = useState({ name: '', bio: '', avatarUrl: '' });

    const isNormalUser = user.userType === 'USER';

    useEffect(() => {
        if (!user) return;
        setDraft({
            name: user.name || '',
            bio: user.bio || '',
            avatarUrl: user.avatarUrl || '',
        });
    }, [user]);

    const commitSave = () => {
        setPhotoEdit(false);
        setInfoEdit(false);
        onSave?.({ ...draft });
    };

    const cancelAll = () => {
        setPhotoEdit(false);
        setInfoEdit(false);
        setDraft({
            name: user.name || '',
            bio: user.bio || '',
            avatarUrl: user.avatarUrl || '',
        });
    };

    return (
        <div className="usercard" ref={wrapRef}>
            {/* 왼쪽: 아바타 섹션 */}
            <div className="usercard-left">
                <div className="user-avatar">
                    {draft.avatarUrl ? (
                        <img src={draft.avatarUrl} alt="profile" />
                    ) : (
                        <div className="user-avatar-fallback">{user.name?.charAt(0)}</div>
                    )}
                </div>
                <button className="edit-photo" onClick={() => setPhotoEdit(!photoEdit)} title="사진 변경">
                    ✎
                </button>
            </div>

            {/* 가운데: 정보 섹션 */}
            <div className="usercard-mid">
                {!infoEdit ? (
                    <>
                        <div className="user-name">
                            {user.name}
                            <span className="user-role-badge">
                                {user.userType === 'TAX_ACCOUNTANT' ? '세무사' : '일반사용자'}
                            </span>
                        </div>
                        <div className="user-sub-id">@{user.username}</div>

                        {!isNormalUser && (
                            <div className="user-bio-display">
                                {user.bio || '등록된 한 줄 소개가 없습니다. 자신을 소개해 보세요!'}
                            </div>
                        )}

                        {!isNormalUser && (
                            <button className="edit-info-btn" onClick={() => setInfoEdit(true)}>
                                프로필 편집
                            </button>
                        )}
                    </>
                ) : (
                    <div className="user-edit-form">
                        <div className="edit-row">
                            <span>이름</span>
                            <input
                                value={draft.name}
                                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                placeholder="이름을 입력하세요"
                            />
                        </div>
                        <div className="edit-row">
                            <span>한줄 소개</span>
                            <textarea
                                rows="3"
                                value={draft.bio}
                                onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                                placeholder="나를 표현하는 한마디를 적어주세요."
                            />
                        </div>
                    </div>
                )}

                {photoEdit && (
                    <div className="photo-edit-input">
                        <input
                            placeholder="이미지 URL (https://...)"
                            value={draft.avatarUrl}
                            onChange={(e) => setDraft({ ...draft, avatarUrl: e.target.value })}
                        />
                    </div>
                )}
            </div>

            {/* 오른쪽: 버튼 섹션 */}
            <div className="usercard-right">
                {photoEdit || infoEdit ? (
                    <div className="usercard-actions">
                        <button
                            className="action-btn btn-accept"
                            onClick={commitSave}
                            style={{ width: '100%', marginBottom: '8px' }}
                        >
                            저장하기
                        </button>
                        <button className="action-btn btn-reject" onClick={cancelAll} style={{ width: '100%' }}>
                            취소
                        </button>
                    </div>
                ) : (
                    <button className="withdraw-link" onClick={onDeleteAccount}>
                        계정 탈퇴하기
                    </button>
                )}
            </div>
        </div>
    );
}
