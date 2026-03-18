// src/components/Profile/components/UserProfileCard.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getCreditHistory } from '../../../api/axios';

const TAX_CATEGORIES = [
    '기장',
    '부가가치세신고대행',
    '종합소득세신고대행',
    '법인설립',
    '양도소득세신고대행',
    '증여세신고대행',
    '상속세신고대행',
    '컨설팅',
    '기타',
    '근로소득자',
];

const CREDIT_PACKAGES = [
    { label: '1만원', credit: 10000 },
    { label: '5만원', credit: 50000 },
    { label: '10만원', credit: 100000 },
    { label: '20만원', credit: 200000 },
    { label: '50만원', credit: 500000 },
];

/* ─────────────────────────────────────────────────────────
   메인 컴포넌트
───────────────────────────────────────────────────────── */
export default function UserProfileCard({ user, onSave, onDeleteAccount, onChargeCredit }) {
    const isTax = user?.userType === 'TAX_ACCOUNTANT';

    /* 모드 */
    const [mode, setMode] = useState('view'); // 'view' | 'edit'

    /* 모달 */
    const [showCreditModal, setShowCreditModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyList, setHistoryList] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    /* 캘린더 월 상태 */
    const [calMonth, setCalMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });

    /* ── draft (편집용 복사본) ── */
    const buildDraft = useCallback(
        () => ({
            name: user?.name || '',
            bio: user?.bio || user?.bio_one_line || '',
            avatarUrl: user?.avatarUrl || '',
            company_name: user?.company_name || '',
            office_address: user?.office_address || '',
            experience_years: user?.experience_years || 0,
            monthly_fee: user?.monthly_fee || 0,
            chat_rate_per_10min: user?.chat_rate_per_10min || 0,
            available_hours: user?.available_hours || '',
            categories: Array.isArray(user?.categories) ? [...user.categories] : [],
            consult_schedule: Array.isArray(user?.consult_schedule) ? [...user.consult_schedule] : [],
        }),
        [user],
    );

    const [draft, setDraft] = useState(buildDraft);

    /* user prop 변경 시 draft 리셋 */
    useEffect(() => {
        setDraft(buildDraft());
    }, [user, buildDraft]);

    /* ── 핸들러 ── */
    const toggleCategory = (cat) =>
        setDraft((p) => ({
            ...p,
            categories: p.categories.includes(cat) ? p.categories.filter((c) => c !== cat) : [...p.categories, cat],
        }));

    const toggleDate = (dateStr) =>
        setDraft((p) => ({
            ...p,
            consult_schedule: p.consult_schedule.includes(dateStr)
                ? p.consult_schedule.filter((d) => d !== dateStr)
                : [...p.consult_schedule, dateStr],
        }));

    const handleSave = () => {
        onSave?.({
            ...draft,
            experience_years: Number(draft.experience_years) || 0,
            monthly_fee: Number(draft.monthly_fee) || 0,
            chat_rate_per_10min: Number(draft.chat_rate_per_10min) || 0,
        });
        setMode('view');
    };

    const handleCancel = () => {
        setDraft(buildDraft());
        setMode('view');
    };

    /* ── 숫자 input 전용 핸들러 ── */
    const handleNumberFocus = (field) => {
        setDraft((p) => ({
            ...p,
            [field]: Number(p[field]) === 0 ? '' : String(p[field]),
        }));
    };

    const handleNumberChange = (field, rawValue) => {
        // 빈값 허용
        if (rawValue === '') {
            setDraft((p) => ({ ...p, [field]: '' }));
            return;
        }

        // 숫자만 허용
        if (!/^\d+$/.test(rawValue)) return;

        setDraft((p) => ({
            ...p,
            [field]: rawValue,
        }));
    };

    const handleNumberBlur = (field) => {
        setDraft((p) => {
            const raw = p[field];

            if (raw === '' || raw === null || raw === undefined) {
                return { ...p, [field]: 0 };
            }

            const num = Math.max(0, Number(raw) || 0);
            return { ...p, [field]: num };
        });
    };

    /* ── 크레딧 내역 불러오기 ── */
    const openHistory = async () => {
        setShowHistoryModal(true);
        setHistoryLoading(true);
        try {
            const res = await getCreditHistory(user.id);
            setHistoryList(res.result === 'success' ? res.data || [] : []);
        } catch {
            setHistoryList([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    /* ── 캘린더 렌더 ── */
    const renderCalendar = () => {
        const { year, month } = calMonth;
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date().toISOString().slice(0, 10);

        const cells = [];
        for (let i = 0; i < firstDay; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++)
            cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

        return (
            <div className="user-profile-cal-wrap">
                <div className="user-profile-cal-header">
                    <button
                        type="button"
                        className="user-profile-cal-nav"
                        onClick={() =>
                            setCalMonth((p) => {
                                const d = new Date(p.year, p.month - 1);
                                return { year: d.getFullYear(), month: d.getMonth() };
                            })
                        }
                    >
                        ‹
                    </button>
                    <span className="user-profile-cal-title">
                        {year}년 {month + 1}월
                    </span>
                    <button
                        type="button"
                        className="user-profile-cal-nav"
                        onClick={() =>
                            setCalMonth((p) => {
                                const d = new Date(p.year, p.month + 1);
                                return { year: d.getFullYear(), month: d.getMonth() };
                            })
                        }
                    >
                        ›
                    </button>
                </div>

                <div className="user-profile-cal-grid">
                    {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                        <div key={d} className="user-profile-cal-weekday">
                            {d}
                        </div>
                    ))}

                    {cells.map((dateStr, i) => {
                        if (!dateStr) return <div key={`e-${i}`} className="user-profile-cal-empty" />;
                        const sel = draft.consult_schedule.includes(dateStr);
                        const past = dateStr < today;

                        const cellClass = ['user-profile-cal-cell', sel ? 'is-selected' : '', past ? 'is-past' : '']
                            .filter(Boolean)
                            .join(' ');

                        return (
                            <button
                                key={dateStr}
                                type="button"
                                disabled={past}
                                className={cellClass}
                                onClick={() => !past && toggleDate(dateStr)}
                            >
                                {Number(dateStr.split('-')[2])}
                            </button>
                        );
                    })}
                </div>

                <p className="user-profile-cal-foot">✅ {draft.consult_schedule.length}일 선택됨</p>
            </div>
        );
    };

    if (!user) return null;

    if (mode === 'view')
        return (
            <div className="user-profile-card-root">
                <div className="user-profile-view-header">
                    <div className="user-profile-avatar-col">
                        {user.avatarUrl ? (
                            <img
                                src={user.avatarUrl}
                                alt="profile"
                                className="user-profile-avatar-img"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                }}
                            />
                        ) : (
                            <div className="user-profile-avatar-fallback">{user.name?.charAt(0) || '?'}</div>
                        )}
                    </div>

                    <div className="user-profile-view-info">
                        <div className="user-profile-name-row">
                            <span className="user-profile-name-text">{user.name}</span>
                            <span className="user-profile-role-badge">{isTax ? '세무사' : '일반사용자'}</span>
                        </div>
                        <div className="user-profile-username">@{user.username}</div>

                        <div className="user-profile-credit-bar">
                            <span className="user-profile-credit-icon" aria-hidden="true">
                                💳
                            </span>

                            <div className="user-profile-credit-meta">
                                <div className="user-profile-credit-label">내 크레딧</div>
                                <div className="user-profile-credit-value">{(user.credit || 0).toLocaleString()} C</div>
                            </div>

                            <button className="user-profile-btn-charge" onClick={() => setShowCreditModal(true)}>
                                충전
                            </button>
                            <button className="user-profile-btn-history" onClick={openHistory}>
                                내역 보기
                            </button>
                        </div>
                    </div>

                    <div className="user-profile-view-actions">
                        <button className="user-profile-btn-edit" onClick={() => setMode('edit')}>
                            ✏️ 프로필 편집
                        </button>
                        <button className="user-profile-btn-withdraw" onClick={onDeleteAccount}>
                            계정 탈퇴
                        </button>
                    </div>
                </div>

                {isTax && (
                    <div className="user-profile-tax-grid">
                        <InfoBox icon="📝" label="한줄 소개" value={user.bio || user.bio_one_line || '미등록'} wide />

                        <InfoBox icon="🏢" label="회사명" value={user.company_name || '미등록'} />
                        <InfoBox icon="📍" label="사무실 주소" value={user.office_address || '미등록'} />
                        <InfoBox
                            icon="🎓"
                            label="경력"
                            value={user.experience_years > 0 ? `${user.experience_years}년` : '미등록'}
                        />
                        <InfoBox
                            icon="🧾"
                            label="기장료"
                            value={user.monthly_fee > 0 ? `${user.monthly_fee.toLocaleString()}원/월` : '미등록'}
                        />
                        <InfoBox
                            icon="💰"
                            label="10분 채팅 요금"
                            value={
                                user.chat_rate_per_10min > 0
                                    ? `${user.chat_rate_per_10min.toLocaleString()}원`
                                    : '미등록'
                            }
                        />
                        <InfoBox icon="⏰" label="상담 가능 시간" value={user.available_hours || '미등록'} />

                        <div className="user-profile-info-box wide">
                            <span className="user-profile-info-icon">🎯</span>
                            <div className="user-profile-info-body">
                                <div className="user-profile-info-label">전문 분야</div>
                                {Array.isArray(user.categories) && user.categories.length > 0 ? (
                                    <div className="user-profile-tag-row">
                                        {user.categories.map((c) => (
                                            <span key={c} className="user-profile-tag-blue">
                                                {c}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="user-profile-info-value">미등록</div>
                                )}
                            </div>
                        </div>

                        <div className="user-profile-info-box wide">
                            <span className="user-profile-info-icon">📅</span>
                            <div className="user-profile-info-body">
                                <div className="user-profile-info-label">상담 가능 일정</div>
                                {Array.isArray(user.consult_schedule) && user.consult_schedule.length > 0 ? (
                                    <div className="user-profile-tag-row">
                                        {user.consult_schedule.sort().map((d) => (
                                            <span key={d} className="user-profile-tag-green">
                                                {d}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="user-profile-info-value">설정된 일정 없음</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {!isTax && user.bio && <div className="user-profile-user-bio-display">{user.bio}</div>}

                {showCreditModal && (
                    <Overlay onClose={() => setShowCreditModal(false)}>
                        <h3 className="user-profile-modal-title">💳 크레딧 충전</h3>
                        <p className="user-profile-modal-sub">
                            현재 잔액:{' '}
                            <strong className="user-profile-modal-strong">
                                {(user.credit || 0).toLocaleString()} 크레딧
                            </strong>
                        </p>

                        <div className="user-profile-pkg-grid">
                            {CREDIT_PACKAGES.map((pkg) => (
                                <button
                                    key={pkg.credit}
                                    className="user-profile-pkg-btn"
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                `${pkg.label} 결제 시 ${pkg.credit.toLocaleString()} 크레딧이 충전됩니다.\n진행하시겠습니까?`,
                                            )
                                        ) {
                                            onChargeCredit?.(pkg.credit, `${pkg.label} 크레딧 패키지 구매`);
                                            setShowCreditModal(false);
                                        }
                                    }}
                                >
                                    <div className="user-profile-pkg-credit">{pkg.credit.toLocaleString()}</div>
                                    <div className="user-profile-pkg-unit">크레딧</div>
                                    <div className="user-profile-pkg-label">{pkg.label}</div>
                                </button>
                            ))}
                        </div>

                        <p className="user-profile-modal-tip">💡 크레딧은 채팅 상담, 서비스 이용 등에 사용됩니다.</p>

                        <button className="user-profile-modal-close" onClick={() => setShowCreditModal(false)}>
                            닫기
                        </button>
                    </Overlay>
                )}

                {showHistoryModal && (
                    <Overlay onClose={() => setShowHistoryModal(false)}>
                        <h3 className="user-profile-modal-title">📋 크레딧 거래 내역</h3>

                        {historyLoading ? (
                            <div className="user-profile-modal-loading">불러오는 중...</div>
                        ) : historyList.length === 0 ? (
                            <div className="user-profile-modal-empty">거래 내역이 없습니다.</div>
                        ) : (
                            <div className="user-profile-hist-list">
                                {historyList.map((item, idx) => {
                                    const typeClass =
                                        item.type === 'CHARGE'
                                            ? 'user-profile-hist-badge charge'
                                            : 'user-profile-hist-badge spend';

                                    const amountClass =
                                        item.type === 'CHARGE'
                                            ? 'user-profile-hist-amount charge'
                                            : 'user-profile-hist-amount spend';

                                    return (
                                        <div key={item.id || idx} className="user-profile-hist-item">
                                            <div className="user-profile-hist-left">
                                                <span className={typeClass}>
                                                    {item.type === 'CHARGE' ? '충전' : '차감'}
                                                </span>
                                                <span className="user-profile-hist-desc">{item.description}</span>
                                            </div>

                                            <div className="user-profile-hist-right">
                                                <span className={amountClass}>
                                                    {item.type === 'CHARGE' ? '+' : '-'}
                                                    {(item.amount || 0).toLocaleString()}
                                                </span>
                                                <span className="user-profile-hist-sub">
                                                    잔액 {(item.balance_after || 0).toLocaleString()}
                                                </span>
                                                <span className="user-profile-hist-sub">
                                                    {new Date(item.created_at).toLocaleDateString('ko-KR')}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <button className="user-profile-modal-close" onClick={() => setShowHistoryModal(false)}>
                            닫기
                        </button>
                    </Overlay>
                )}
            </div>
        );

    return (
        <div className="user-profile-edit-root">
            <div className="user-profile-edit-header">
                <h3 className="user-profile-edit-title">✏️ 프로필 편집</h3>
                <span className="user-profile-edit-hint">수정 후 하단의 [저장하기] 버튼을 눌러주세요</span>
            </div>

            <div className="user-profile-edit-grid">
                <div className="user-profile-span-all">
                    <FL>프로필 이미지 URL</FL>
                    <input
                        className="user-profile-input"
                        placeholder="https://... (이미지 주소 입력)"
                        value={draft.avatarUrl}
                        onChange={(e) => setDraft((p) => ({ ...p, avatarUrl: e.target.value }))}
                    />
                    {draft.avatarUrl && (
                        <img
                            src={draft.avatarUrl}
                            alt="preview"
                            className="user-profile-avatar-preview"
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                    )}
                </div>

                <div>
                    <FL>이름</FL>
                    <input
                        className="user-profile-input"
                        value={draft.name}
                        onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                        placeholder="이름"
                    />
                </div>

                {isTax ? (
                    <>
                        <div>
                            <FL>한줄 소개</FL>
                            <input
                                className="user-profile-input"
                                value={draft.bio}
                                onChange={(e) => setDraft((p) => ({ ...p, bio: e.target.value }))}
                                placeholder="나를 표현하는 한 줄"
                            />
                        </div>

                        <div>
                            <FL>회사명 (상호명)</FL>
                            <input
                                className="user-profile-input"
                                value={draft.company_name}
                                onChange={(e) => setDraft((p) => ({ ...p, company_name: e.target.value }))}
                                placeholder="예: ○○ 세무회계"
                            />
                        </div>

                        <div>
                            <FL>사무실 주소</FL>
                            <input
                                className="user-profile-input"
                                value={draft.office_address}
                                onChange={(e) => setDraft((p) => ({ ...p, office_address: e.target.value }))}
                                placeholder="예: 서울시 강남구..."
                            />
                        </div>

                        <div>
                            <FL>경력 (년)</FL>
                            <input
                                className="user-profile-input"
                                type="number"
                                min="0"
                                value={draft.experience_years}
                                onFocus={() => handleNumberFocus('experience_years')}
                                onChange={(e) => handleNumberChange('experience_years', e.target.value)}
                                onBlur={() => handleNumberBlur('experience_years')}
                            />
                        </div>

                        <div>
                            <FL>기장료 (원/월)</FL>
                            <input
                                className="user-profile-input"
                                type="number"
                                min="0"
                                value={draft.monthly_fee}
                                onFocus={() => handleNumberFocus('monthly_fee')}
                                onChange={(e) => handleNumberChange('monthly_fee', e.target.value)}
                                onBlur={() => handleNumberBlur('monthly_fee')}
                                placeholder="예: 100000"
                            />
                        </div>

                        <div>
                            <FL>10분 채팅 요금 (원)</FL>
                            <input
                                className="user-profile-input"
                                type="number"
                                min="0"
                                value={draft.chat_rate_per_10min}
                                onFocus={() => handleNumberFocus('chat_rate_per_10min')}
                                onChange={(e) => handleNumberChange('chat_rate_per_10min', e.target.value)}
                                onBlur={() => handleNumberBlur('chat_rate_per_10min')}
                                placeholder="예: 5000"
                            />
                        </div>

                        <div>
                            <FL>상담 가능 시간</FL>
                            <input
                                className="user-profile-input"
                                value={draft.available_hours}
                                onChange={(e) => setDraft((p) => ({ ...p, available_hours: e.target.value }))}
                                placeholder="예: 평일 09:00~18:00"
                            />
                        </div>

                        <div className="user-profile-span-all">
                            <FL>전문 분야 (여러 개 선택 가능)</FL>
                            <div className="user-profile-cat-wrap">
                                {TAX_CATEGORIES.map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        className={
                                            draft.categories.includes(cat)
                                                ? 'user-profile-cat-on'
                                                : 'user-profile-cat-off'
                                        }
                                        onClick={() => toggleCategory(cat)}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="user-profile-span-all">
                            <FL>📅 상담 가능 일정 (날짜 클릭으로 선택 / 다시 클릭으로 해제)</FL>
                            {renderCalendar()}
                        </div>
                    </>
                ) : (
                    <div>
                        <FL>한줄 소개</FL>
                        <textarea
                            className="user-profile-input user-profile-textarea"
                            rows={3}
                            value={draft.bio}
                            onChange={(e) => setDraft((p) => ({ ...p, bio: e.target.value }))}
                            placeholder="나를 표현하는 한 줄"
                        />
                    </div>
                )}
            </div>

            <div className="user-profile-edit-footer">
                <button className="user-profile-btn-save" onClick={handleSave}>
                    💾 저장하기
                </button>
                <button className="user-profile-btn-cancel" onClick={handleCancel}>
                    취소
                </button>
            </div>
        </div>
    );
}

function FL({ children }) {
    return <div className="user-profile-field-label">{children}</div>;
}

function InfoBox({ icon, label, value, wide }) {
    return (
        <div className={`user-profile-info-box ${wide ? 'wide' : ''}`}>
            <span className="user-profile-info-icon">{icon}</span>
            <div className="user-profile-info-body">
                <div className="user-profile-info-label">{label}</div>
                <div className="user-profile-info-value">{value}</div>
            </div>
        </div>
    );
}

/* ✅ Portal Overlay */
function Overlay({ children, onClose }) {
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="user-profile-overlay" onClick={onClose}>
            <div className="user-profile-modal-box" onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>,
        document.body,
    );
}
