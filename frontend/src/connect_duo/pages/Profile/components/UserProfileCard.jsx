import React, { useEffect, useRef, useState } from 'react';

export default function UserProfileCard({ user, onSave, onDeleteAccount }) {
    const wrapRef = useRef(null);
    const [photoEdit, setPhotoEdit] = useState(false);
    const [infoEdit, setInfoEdit] = useState(false);

    const [draft, setDraft] = useState({ name: '', bio: '', avatarUrl: '' });

    // 일반 유저라면 한줄소개/수정 숨기기: 타입 체크 (예시로 'user'로 가정. 필요시 콘솔로 확인)
    const isNormalUser = user.userType === 'USER'; // 실제 값 확인 필요!

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
                <button className="edit-icon edit-photo" onClick={() => setPhotoEdit(!photoEdit)} title="사진 변경">
                    ✎
                </button>
            </div>

            {/* 가운데: 정보 섹션 */}
            <div className="usercard-mid">
                {!infoEdit ? (
                    <>
                        <div className="user-name">
                            {user.name} <span className="user-role-badge">{user.userType}</span>
                        </div>
                        <div className="user-sub-id">@{user.username}</div>

                        {/* 일반유저 아니면 (== 전문가만) 한줄소개/수정 */}
                        {!isNormalUser && (
                            <div className="user-bio-display">
                                {user.bio || '등록된 한 줄 소개가 없습니다. 자신을 소개해 보세요!'}
                            </div>
                        )}
                        {!isNormalUser && (
                            <button className="edit-info-btn" onClick={() => setInfoEdit(true)}>
                                프로필 수정
                            </button>
                        )}
                    </>
                ) : (
                    // 수정폼은 전문가만 띄움
                    !isNormalUser && (
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
                    )
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
                    // 전문가만 저장/취소
                    !isNormalUser && (
                        <div className="usercard-actions" style={{ width: '100%' }}>
                            <button className="btn-primary" onClick={commitSave} style={{ marginBottom: '8px' }}>
                                변경사항 저장
                            </button>
                            <button className="btn-danger" onClick={cancelAll}>
                                취소
                            </button>
                        </div>
                    )
                ) : (
                    <button className="withdraw-link" onClick={onDeleteAccount}>
                        계정 탈퇴하기
                    </button>
                )}
            </div>
        </div>
    );
}
