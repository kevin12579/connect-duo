import React, { useEffect, useRef, useState } from 'react';

export default function ProfileHeaderCard({
    taxPro,
    viewerRole = 'USER',
    consultStatus,
    onConsultRequest,
    onSaveProfile,
}) {
    const isTaxProViewer = viewerRole === 'TAX_ACCOUNTANT';
    const isPending = consultStatus === 'PENDING';
    const wrapRef = useRef(null);

    const [photoEdit, setPhotoEdit] = useState(false);
    const [infoEdit, setInfoEdit] = useState(false);
    const [draft, setDraft] = useState({
        name: '',
        oneLine: '',
        intro: '',
        avatarUrl: '',
    });

    useEffect(() => {
        if (!taxPro) return;
        setDraft({
            name: taxPro.name || '',
            oneLine: taxPro.oneLine || '',
            intro: taxPro.intro || taxPro.specialty || '',
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
        onSaveProfile?.({
            id: taxPro.id, // 반드시 TaxAccountantProfile.id를 넘긴다
            name: draft.name,
            oneLine: draft.oneLine,
            avatarUrl: draft.avatarUrl,
        });
    };

    useEffect(() => {
        if (!isEditing) return;
        const onDocMouseDown = (e) => {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target)) commitSave();
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
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
            <div className="taxpro-avatar">
                <div className="taxpro-avatar-circle">
                    {draft.avatarUrl ? (
                        <img src={draft.avatarUrl} alt="taxpro" />
                    ) : (
                        <div className="taxpro-avatar-fallback" />
                    )}
                </div>
                {isTaxProViewer && (
                    <button className="edit-btn edit-photo" type="button" title="사진 수정" onClick={startPhotoEdit}>
                        ✎
                    </button>
                )}
            </div>
            <div className="taxpro-info" onKeyDown={onKeyDownSave}>
                {!infoEdit ? (
                    <>
                        <div className="taxpro-name">{taxPro?.name}</div>
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
