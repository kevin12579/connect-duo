import React, { useEffect, useRef, useState } from 'react';
import UserAvatar from './UserAvatar'; // 추가

export default function ProfileHeaderCard({
    taxPro,
    viewerRole = 'USER',
    consultStatus,
    onConsultRequest,
    onSaveProfile,
}) {
    const isTaxProViewer = viewerRole === 'TAX_ACCOUNTANT';
    const isPending = consultStatus === 'PENDING';
    const isAccepted = consultStatus === 'ACCEPTED';
    const isDisabled = isPending || isAccepted;
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
            id: taxPro.id,
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
                    {/* ✅ UserAvatar 사용, 없으면 이니셜-보라색원 */}
                    <UserAvatar avatarUrl={draft.avatarUrl} name={draft.name || taxPro?.name} size={190} bg="#b79cb6" />
                </div>
            </div>
            <div className="taxpro-info" onKeyDown={onKeyDownSave}>
                <>
                    <div className="taxpro-name">{taxPro?.name}</div>
                    <div className="taxpro-oneLine-row">
                        <div className="taxpro-oneLine">{taxPro?.oneLine}</div>
                    </div>
                    <div className="taxpro-meta">{taxPro?.intro || taxPro?.specialty}</div>
                </>
            </div>
            <div className="taxpro-cta">
                {!isTaxProViewer && (
                    <button
                        className={`taxpro-btn ${isPending ? 'pending' : ''} ${isAccepted ? 'accepted' : ''}`}
                        onClick={onConsultRequest}
                        disabled={isDisabled}
                    >
                        {isPending && '상담 신청 대기 중...'}
                        {isAccepted && '상담 진행 중'}
                        {!isPending && !isAccepted && '상담 신청'}
                    </button>
                )}
            </div>
        </div>
    );
}
