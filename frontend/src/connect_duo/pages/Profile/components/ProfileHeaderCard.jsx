// src/components/TaxProfile/components/ProfileHeaderCard.jsx
import React, { useEffect, useRef, useState } from 'react';
import UserAvatar from './UserAvatar';

/* ─── 헬퍼 ───────────────────────────── */
function safe(v, fallback = '') {
    return v ?? fallback;
}
function safeArr(v) {
    return Array.isArray(v) ? v : [];
}

/* ─── 구분자 | ───────────────────────── */
function Sep() {
    return <span className="taxpro-sep">|</span>;
}

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
    const [draft, setDraft] = useState({ name: '', oneLine: '', avatarUrl: '' });

    useEffect(() => {
        if (!taxPro) return;
        setDraft({
            name: taxPro.name || '',
            oneLine: taxPro.oneLine || '',
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
        const handler = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) commitSave();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isEditing, draft]);

    const onKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitSave();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelAll();
        }
    };

    if (!taxPro) return null;

    /* ── 파생 데이터 ── */
    const categories = safeArr(taxPro.categories);
    const schedule = safeArr(taxPro.consult_schedule);
    const hasMeta = taxPro.company_name || taxPro.office_address;
    const hasCategories = categories.length > 0;
    const hasFee = taxPro.chat_rate_per_10min > 0 || taxPro.monthly_fee > 0;
    const hasSchedule = taxPro.available_hours || schedule.length > 0;

    /* ── 오늘 이후 상담 가능일 카운트 ── */
    const today = new Date().toISOString().slice(0, 10);
    const upcomingDays = schedule.filter((d) => d >= today).length;

    return (
        <div className={`taxpro-header ${isTaxProViewer ? 'is-owner' : ''}`} ref={wrapRef}>
            {/* ════════════ 왼쪽: 아바타 ════════════ */}
            <div className="taxpro-avatar">
                <div className="taxpro-avatar-circle">
                    <UserAvatar avatarUrl={draft.avatarUrl} name={draft.name || taxPro.name} size={190} bg="#b79cb6" />
                </div>
            </div>

            {/* ════════════ 가운데: 정보 ════════════ */}
            <div className="taxpro-info" onKeyDown={onKeyDown}>
                {/* ① 이름 + 세무사 뱃지 */}
                <div className="taxpro-name-row">
                    <span className="taxpro-name">{taxPro.name}</span>
                    <span className="taxpro-role-badge">세무사</span>
                </div>

                {/* ② 메타 한줄: 회사명 | 주소 */}
                {hasMeta && (
                    <div className="taxpro-meta-row">
                        {taxPro.company_name && <span className="taxpro-company">{taxPro.company_name}</span>}
                        {taxPro.company_name && taxPro.office_address && <Sep />}
                        {taxPro.office_address && (
                            <span className="taxpro-addr">
                                <span className="taxpro-meta-icon">📍</span>
                                {taxPro.office_address}
                            </span>
                        )}
                    </div>
                )}

                {/* ③ 한줄 소개 */}
                {taxPro.oneLine && (
                    <div className="taxpro-oneLine-row">
                        <div className="taxpro-oneLine">{taxPro.oneLine}</div>
                    </div>
                )}

                {/* ④ 전문 분야 카테고리 칩 */}
                {hasCategories && (
                    <div className="taxpro-categories">
                        {categories.map((cat) => (
                            <span key={cat} className="taxpro-cat-chip">
                                {cat}
                            </span>
                        ))}
                    </div>
                )}

                {/* ⑤ 경력 + 상담 가능 시간 행 */}
                <div className="taxpro-detail-row">
                    {taxPro.experience_years > 0 && (
                        <span className="taxpro-detail-item">
                            <span className="taxpro-meta-icon">🎓</span>
                            경력 {taxPro.experience_years}년 이상
                        </span>
                    )}
                    {taxPro.available_hours && (
                        <span className="taxpro-detail-item">
                            <span className="taxpro-meta-icon">⏰</span>
                            {taxPro.available_hours}
                        </span>
                    )}
                    {upcomingDays > 0 && (
                        <span className="taxpro-detail-item taxpro-schedule-badge">
                            <span className="taxpro-meta-icon">📅</span>
                            상담 가능 {upcomingDays}일
                        </span>
                    )}
                </div>

                {/* ⑥ 요금 정보 테이블 */}
                {hasFee && (
                    <div className="taxpro-fee-table">
                        {taxPro.chat_rate_per_10min > 0 && (
                            <div className="taxpro-fee-row">
                                <span className="taxpro-fee-label">💰 10분 채팅 상담</span>
                                <span className="taxpro-fee-value">
                                    {taxPro.chat_rate_per_10min.toLocaleString()}원
                                </span>
                            </div>
                        )}
                        {taxPro.monthly_fee > 0 && (
                            <div className="taxpro-fee-row">
                                <span className="taxpro-fee-label">🧾 기장료</span>
                                <span className="taxpro-fee-value">{taxPro.monthly_fee.toLocaleString()}원/월</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ════════════ 오른쪽: CTA ════════════ */}
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