import React, { useEffect, useRef, useState } from 'react';

export default function ProfileHeaderCard({
    taxPro,
    viewerRole = 'USER',
    consultStatus,
    onConsultRequest,
    onSaveProfile,
}) {
    const isTaxProViewer = viewerRole === 'TAXPRO';
    const isPending = consultStatus === 'PENDING';

    const wrapRef = useRef(null);

    // ✅ 사진/글 편집을 분리
    const [photoEdit, setPhotoEdit] = useState(false);
    const [infoEdit, setInfoEdit] = useState(false);

    const [draft, setDraft] = useState({
        name: '',
        oneLine: '',
        intro: '',
        avatarUrl: '',
    });

    // ✅ 처음 로드/프로필 바뀌면 동기화
    useEffect(() => {
        if (!taxPro) return;
        setDraft({
            name: taxPro.name || '',
            oneLine: taxPro.oneLine || '',
            intro: taxPro.intro || taxPro.specialty || '', // intro 없으면 specialty를 소개로 대체(원하면 수정)
            avatarUrl: taxPro.avatarUrl || '',
        });
    }, [taxPro]);

    const isEditing = photoEdit || infoEdit;

    const startPhotoEdit = () => {
        if (!isTaxProViewer || !taxPro) return;
        setDraft((d) => ({ ...d, avatarUrl: taxPro.avatarUrl || '' }));
        setInfoEdit(false);
        setPhotoEdit(true);
    };

    const startInfoEdit = () => {
        if (!isTaxProViewer || !taxPro) return;
        setDraft({
            name: taxPro.name || '',
            oneLine: taxPro.oneLine || '',
            intro: taxPro.intro || taxPro.specialty || '',
            avatarUrl: taxPro.avatarUrl || '',
        });
        setPhotoEdit(false);
        setInfoEdit(true);
    };

    const cancelAll = () => {
        setPhotoEdit(false);
        setInfoEdit(false);
        if (!taxPro) return;
        setDraft({
            name: taxPro.name || '',
            oneLine: taxPro.oneLine || '',
            intro: taxPro.intro || taxPro.specialty || '',
            avatarUrl: taxPro.avatarUrl || '',
        });
    };

    const commitSave = () => {
        if (!isEditing) return;
        setPhotoEdit(false);
        setInfoEdit(false);

        // ✅ 서버로 보낼 값(필요한 것만)
        onSaveProfile?.({
            name: draft.name,
            oneLine: draft.oneLine,
            intro: draft.intro,
            avatarUrl: draft.avatarUrl,
        });
    };

    // ✅ 바깥 클릭 저장(원하면 유지, 싫으면 이 useEffect 통째로 삭제)
    useEffect(() => {
        if (!isEditing) return;

        const onDocMouseDown = (e) => {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target)) commitSave();
        };

        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing, draft]);

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

    return (
        <div className={`taxpro-header ${isTaxProViewer ? 'is-owner' : ''}`} ref={wrapRef}>
            {/* 1) 사진 영역 */}
            <div className="taxpro-avatar">
                <div className="taxpro-avatar-circle">
                    {draft.avatarUrl ? (
                        <img src={draft.avatarUrl} alt="taxpro" />
                    ) : (
                        <div className="taxpro-avatar-fallback" />
                    )}
                </div>

                {/* 사진 연필: 유저처럼 "옆에" */}
                {isTaxProViewer && (
                    <button className="edit-btn edit-photo" type="button" title="사진 수정" onClick={startPhotoEdit}>
                        ✎
                    </button>
                )}
            </div>

            {/* 2) 글 영역 */}
            <div className="taxpro-info" onKeyDown={onKeyDownSave}>
                {!infoEdit ? (
                    <>
                        <div className="taxpro-name">{taxPro?.name}</div>

                        {/* ✅ 유저 이메일 줄처럼: 한줄 + 연필을 같은 줄에 */}
                        <div className="taxpro-oneLine-row">
                            <div className="taxpro-oneLine">{taxPro?.oneLine}</div>

                            {isTaxProViewer && (
                                <button
                                    className="edit-btn edit-text"
                                    type="button"
                                    title="정보 수정"
                                    onClick={startInfoEdit}
                                >
                                    ✎
                                </button>
                            )}
                        </div>

                        <div className="taxpro-meta">{taxPro?.intro || taxPro?.specialty}</div>
                    </>
                ) : (
                    <div className="edit-form">
                        <label className="edit-row">
                            <span>이름</span>
                            <input
                                autoFocus
                                value={draft.name}
                                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                            />
                        </label>

                        <label className="edit-row">
                            <span>한줄</span>
                            <input
                                value={draft.oneLine}
                                onChange={(e) => setDraft((d) => ({ ...d, oneLine: e.target.value }))}
                            />
                        </label>

                        <label className="edit-row">
                            <span>소개</span>
                            <input
                                value={draft.intro}
                                onChange={(e) => setDraft((d) => ({ ...d, intro: e.target.value }))}
                            />
                        </label>
                    </div>
                )}

                {/* ✅ 사진 수정 모드일 때만 URL 입력 */}
                {photoEdit && (
                    <div className="photo-edit-row">
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

            {/* 3) 오른쪽 영역은 그대로 */}
            <div className="taxpro-cta">
                {!isTaxProViewer && (
                    <button
                        className={`taxpro-btn ${isPending ? 'pending' : ''}`}
                        onClick={onConsultRequest}
                        disabled={isPending}
                    >
                        {isPending ? '상담 신청 대기 중...' : '상담 신청'}
                    </button>
                )}

                {isTaxProViewer && isEditing && (
                    <div className="taxpro-action-row">
                        <button className="btn-primary" type="button" onClick={commitSave}>
                            저장
                        </button>
                        <button className="btn-danger" type="button" onClick={cancelAll}>
                            취소
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
