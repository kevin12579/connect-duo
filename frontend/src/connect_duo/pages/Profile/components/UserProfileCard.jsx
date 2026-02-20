import React, { useEffect, useRef, useState } from 'react';

export default function UserProfileCard({ user, onSave, onDeleteAccount }) {
    const wrapRef = useRef(null);

    const [photoEdit, setPhotoEdit] = useState(false); // ✅ 사진만
    const [infoEdit, setInfoEdit] = useState(false); // ✅ 이름/이메일

    const [draft, setDraft] = useState({ nickname: '', email: '', avatarUrl: '' });

    useEffect(() => {
        if (!user) return;
        setDraft({
            nickname: user.nickname || '',
            email: user.email || '',
            avatarUrl: user.avatarUrl || '',
        });
    }, [user]);

    // 바깥 클릭 저장(둘 중 하나라도 편집중이면)
    useEffect(() => {
        const isEditing = photoEdit || infoEdit;
        if (!isEditing) return;

        const onDocMouseDown = (e) => {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target)) {
                commitSave();
            }
        };

        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [photoEdit, infoEdit, draft]);

    const commitSave = () => {
        if (!photoEdit && !infoEdit) return;
        setPhotoEdit(false);
        setInfoEdit(false);
        onSave?.({
            nickname: draft.nickname,
            email: draft.email,
            avatarUrl: draft.avatarUrl,
        });
    };

    const cancelAll = () => {
        setPhotoEdit(false);
        setInfoEdit(false);
        if (!user) return;
        setDraft({
            nickname: user.nickname || '',
            email: user.email || '',
            avatarUrl: user.avatarUrl || '',
        });
    };

    const onKeyDownSave = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitSave();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelAll();
        }
    };

    if (!user) {
        return (
            <div className="usercard" ref={wrapRef}>
                <div className="usercard-mid">
                    <div className="user-name">사용자 정보 불러오는 중...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="usercard" ref={wrapRef}>
            {/* 왼쪽: 아바타 + (아바타 오른쪽) 사진 연필 */}
            <div className="usercard-left">
                <div className="user-avatar">
                    {draft.avatarUrl ? (
                        <img src={draft.avatarUrl} alt="me" />
                    ) : (
                        <div className="user-avatar-fallback" />
                    )}
                </div>

                <button
                    className="edit-icon edit-photo"
                    type="button"
                    title="사진 수정"
                    onClick={() => {
                        // 사진 수정만 켜기
                        setInfoEdit(false);
                        setPhotoEdit((v) => !v);
                    }}
                >
                    ✎
                </button>
            </div>

            {/* 가운데: 이름/이메일 + 이메일 오른쪽에 정보 연필 */}
            <div className="usercard-mid" onKeyDown={onKeyDownSave}>
                {!infoEdit ? (
                    <>
                        <div className="user-name">{user.nickname}</div>

                        <div className="user-email-row">
                            <div className="user-sub">{user.email || ''}</div>

                            <button
                                className="edit-icon edit-info"
                                type="button"
                                title="이름/이메일 수정"
                                onClick={() => {
                                    setPhotoEdit(false);
                                    setInfoEdit(true);
                                }}
                            >
                                ✎
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="user-edit-form">
                        <label className="edit-row">
                            <span>이름</span>
                            <input
                                autoFocus
                                value={draft.nickname}
                                onChange={(e) => setDraft((d) => ({ ...d, nickname: e.target.value }))}
                            />
                        </label>

                        <label className="edit-row">
                            <span>이메일</span>
                            <input
                                value={draft.email}
                                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                            />
                        </label>
                    </div>
                )}

                {/* ✅ 사진 수정 모드일 때만 아래에 URL 입력 */}
                {photoEdit && (
                    <div className="photo-edit-row" onKeyDown={onKeyDownSave}>
                        <label className="edit-row">
                            <span>사진URL</span>
                            <input
                                value={draft.avatarUrl}
                                onChange={(e) => setDraft((d) => ({ ...d, avatarUrl: e.target.value }))}
                                placeholder="https://..."
                            />
                        </label>
                    </div>
                )}
            </div>

            {/* 오른쪽: 저장/취소 + 탈퇴 */}
            <div className="usercard-right">
                {(photoEdit || infoEdit) && (
                    <div className="usercard-actions">
                        <button className="btn-primary" type="button" onClick={commitSave}>
                            저장
                        </button>
                        <button className="btn-danger" type="button" onClick={cancelAll}>
                            취소
                        </button>
                    </div>
                )}

                <button className="withdraw-link" onClick={onDeleteAccount} type="button">
                    계정 탈퇴
                </button>
            </div>
        </div>
    );
}
