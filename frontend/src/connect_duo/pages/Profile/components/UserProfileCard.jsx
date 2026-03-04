// src/components/Profile/components/UserProfileCard.jsx
import React, { useEffect, useState, useCallback } from 'react';
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
    }, [user]);

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
        onSave?.({ ...draft }); // ← UserProfile.jsx handleSave 호출
        setMode('view');
    };

    const handleCancel = () => {
        setDraft(buildDraft());
        setMode('view');
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
            <div style={s.calWrap}>
                {/* 월 네비게이션 */}
                <div style={s.calHeader}>
                    <button
                        type="button"
                        style={s.calNav}
                        onClick={() =>
                            setCalMonth((p) => {
                                const d = new Date(p.year, p.month - 1);
                                return { year: d.getFullYear(), month: d.getMonth() };
                            })
                        }
                    >
                        ‹
                    </button>
                    <span style={s.calTitle}>
                        {year}년 {month + 1}월
                    </span>
                    <button
                        type="button"
                        style={s.calNav}
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

                {/* 요일 헤더 */}
                <div style={s.calGrid}>
                    {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                        <div key={d} style={{ ...s.calCell, color: '#888', fontWeight: 700, fontSize: '0.75rem' }}>
                            {d}
                        </div>
                    ))}

                    {/* 날짜 */}
                    {cells.map((dateStr, i) => {
                        if (!dateStr) return <div key={`e-${i}`} />;
                        const sel = draft.consult_schedule.includes(dateStr);
                        const past = dateStr < today;
                        return (
                            <button
                                key={dateStr}
                                type="button"
                                disabled={past}
                                style={{
                                    ...s.calCell,
                                    background: sel ? '#3d6fd9' : past ? '#f0f0f0' : '#fff',
                                    color: sel ? '#fff' : past ? '#ccc' : '#222',
                                    border: sel ? '2px solid #2d5592' : '1px solid #e0e0e0',
                                    cursor: past ? 'default' : 'pointer',
                                    borderRadius: 8,
                                    fontWeight: sel ? 800 : 500,
                                }}
                                onClick={() => !past && toggleDate(dateStr)}
                            >
                                {Number(dateStr.split('-')[2])}
                            </button>
                        );
                    })}
                </div>
                <p style={{ fontSize: '0.78rem', color: '#888', marginTop: 6 }}>
                    ✅ {draft.consult_schedule.length}일 선택됨
                </p>
            </div>
        );
    };

    if (!user) return null;

    /* ══════════════════════════════════════════════════════
       VIEW MODE
    ══════════════════════════════════════════════════════ */
    if (mode === 'view')
        return (
            <div>
                {/* ── 헤더: 아바타 + 기본정보 + 액션 버튼 ── */}
                <div style={s.viewHeader}>
                    {/* 아바타 */}
                    <div style={{ flexShrink: 0 }}>
                        {user.avatarUrl ? (
                            <img
                                src={user.avatarUrl}
                                alt="profile"
                                style={s.avatarImg}
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                }}
                            />
                        ) : (
                            <div style={s.avatarFallback}>{user.name?.charAt(0) || '?'}</div>
                        )}
                    </div>

                    {/* 이름·아이디·크레딧 */}
                    <div style={s.viewInfo}>
                        <div style={s.nameRow}>
                            <span style={s.nameText}>{user.name}</span>
                            <span style={s.roleBadge}>{isTax ? '세무사' : '일반사용자'}</span>
                        </div>
                        <div style={s.usernameText}>@{user.username}</div>

                        {/* 크레딧 바 */}
                        <div style={s.creditBar}>
                            <span style={{ fontSize: '1.3rem' }}>💳</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.72rem', color: '#7a92c0', fontWeight: 600 }}>내 크레딧</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#3d6fd9' }}>
                                    {(user.credit || 0).toLocaleString()} C
                                </div>
                            </div>
                            <button style={s.btnCharge} onClick={() => setShowCreditModal(true)}>
                                충전
                            </button>
                            <button style={s.btnHistory} onClick={openHistory}>
                                내역 보기
                            </button>
                        </div>
                    </div>

                    {/* 오른쪽 액션 버튼 */}
                    <div style={s.viewActions}>
                        <button style={s.btnEdit} onClick={() => setMode('edit')}>
                            ✏️ 프로필 편집
                        </button>
                        <button style={s.btnWithdraw} onClick={onDeleteAccount}>
                            계정 탈퇴
                        </button>
                    </div>
                </div>

                {/* ── 세무사 상세 정보 그리드 ── */}
                {isTax && (
                    <div style={s.taxGrid}>
                        <InfoBox icon="📝" label="한줄 소개" value={user.bio || user.bio_one_line || '미등록'} wide />

                        <InfoBox icon="🏢" label="회사명" value={user.company_name || '미등록'} />
                        <InfoBox icon="📍" label="사무실 주소" value={user.office_address || '미등록'} />
                        <InfoBox
                            icon="⏱"
                            label="경력"
                            value={user.experience_years > 0 ? `${user.experience_years}년` : '미등록'}
                        />
                        <InfoBox
                            icon="📋"
                            label="기장료"
                            value={user.monthly_fee > 0 ? `${user.monthly_fee.toLocaleString()}원/월` : '미등록'}
                        />
                        <InfoBox
                            icon="💬"
                            label="10분 채팅 요금"
                            value={
                                user.chat_rate_per_10min > 0
                                    ? `${user.chat_rate_per_10min.toLocaleString()}원`
                                    : '미등록'
                            }
                        />
                        <InfoBox icon="🕐" label="상담 가능 시간" value={user.available_hours || '미등록'} />

                        {/* 전문 분야 */}
                        <div style={{ ...s.infoBox, gridColumn: '1 / -1' }}>
                            <span style={s.infoIcon}>🎯</span>
                            <div>
                                <div style={s.infoLbl}>전문 분야</div>
                                {Array.isArray(user.categories) && user.categories.length > 0 ? (
                                    <div style={s.tagRow}>
                                        {user.categories.map((c) => (
                                            <span key={c} style={s.tagBlue}>
                                                {c}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={s.infoVal}>미등록</div>
                                )}
                            </div>
                        </div>

                        {/* 상담 가능 일정 */}
                        <div style={{ ...s.infoBox, gridColumn: '1 / -1' }}>
                            <span style={s.infoIcon}>📅</span>
                            <div style={{ flex: 1 }}>
                                <div style={s.infoLbl}>상담 가능 일정</div>
                                {Array.isArray(user.consult_schedule) && user.consult_schedule.length > 0 ? (
                                    <div style={s.tagRow}>
                                        {user.consult_schedule.sort().map((d) => (
                                            <span key={d} style={s.tagGreen}>
                                                {d}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={s.infoVal}>설정된 일정 없음</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 일반 유저 한줄 소개 */}
                {!isTax && user.bio && (
                    <div className="user-bio-display" style={{ marginTop: 16 }}>
                        {user.bio}
                    </div>
                )}

                {/* ── 크레딧 충전 모달 ── */}
                {showCreditModal && (
                    <Overlay onClose={() => setShowCreditModal(false)}>
                        <h3 style={s.modalTitle}>💳 크레딧 충전</h3>
                        <p style={s.modalSub}>
                            현재 잔액:{' '}
                            <strong style={{ color: '#3d6fd9' }}>{(user.credit || 0).toLocaleString()} 크레딧</strong>
                        </p>
                        <div style={s.pkgGrid}>
                            {CREDIT_PACKAGES.map((pkg) => (
                                <button
                                    key={pkg.credit}
                                    style={s.pkgBtn}
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
                                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#3d6fd9' }}>
                                        {pkg.credit.toLocaleString()}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#9ab' }}>크레딧</div>
                                    <div
                                        style={{
                                            fontSize: '0.85rem',
                                            fontWeight: 700,
                                            background: '#e8f0fe',
                                            padding: '2px 8px',
                                            borderRadius: 16,
                                            marginTop: 4,
                                        }}
                                    >
                                        {pkg.label}
                                    </div>
                                </button>
                            ))}
                        </div>
                        <p style={{ fontSize: '0.8rem', color: '#aaa', textAlign: 'center', marginBottom: 12 }}>
                            💡 크레딧은 채팅 상담, 서비스 이용 등에 사용됩니다.
                        </p>
                        <button style={s.modalCloseBtn} onClick={() => setShowCreditModal(false)}>
                            닫기
                        </button>
                    </Overlay>
                )}

                {/* ── 크레딧 거래 내역 모달 ── */}
                {showHistoryModal && (
                    <Overlay onClose={() => setShowHistoryModal(false)}>
                        <h3 style={s.modalTitle}>📋 크레딧 거래 내역</h3>
                        {historyLoading ? (
                            <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>불러오는 중...</div>
                        ) : historyList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>거래 내역이 없습니다.</div>
                        ) : (
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 8,
                                    maxHeight: 380,
                                    overflowY: 'auto',
                                    marginBottom: 16,
                                }}
                            >
                                {historyList.map((item, idx) => (
                                    <div key={item.id || idx} style={s.histItem}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span
                                                style={{
                                                    ...s.histBadge,
                                                    background: item.type === 'CHARGE' ? '#e8f5e9' : '#ffeaea',
                                                    color: item.type === 'CHARGE' ? '#2e7d32' : '#c62828',
                                                }}
                                            >
                                                {item.type === 'CHARGE' ? '충전' : '차감'}
                                            </span>
                                            <span style={{ fontSize: '0.85rem', color: '#334155' }}>
                                                {item.description}
                                            </span>
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'flex-end',
                                                gap: 2,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: '0.95rem',
                                                    fontWeight: 800,
                                                    color: item.type === 'CHARGE' ? '#2e7d32' : '#c62828',
                                                }}
                                            >
                                                {item.type === 'CHARGE' ? '+' : '-'}
                                                {(item.amount || 0).toLocaleString()}
                                            </span>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                                잔액 {(item.balance_after || 0).toLocaleString()}
                                            </span>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                                {new Date(item.created_at).toLocaleDateString('ko-KR')}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button style={s.modalCloseBtn} onClick={() => setShowHistoryModal(false)}>
                            닫기
                        </button>
                    </Overlay>
                )}
            </div>
        );

    /* ══════════════════════════════════════════════════════
       EDIT MODE
       ★ 저장 버튼은 폼 최하단에 항상 고정
    ══════════════════════════════════════════════════════ */
    return (
        <div>
            {/* 편집 헤더 */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 20,
                    paddingBottom: 14,
                    borderBottom: '1.5px solid rgba(63,111,181,0.15)',
                }}
            >
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>✏️ 프로필 편집</h3>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    수정 후 하단의 [저장하기] 버튼을 눌러주세요
                </span>
            </div>

            {/* 2-컬럼 편집 그리드 */}
            <div style={s.editGrid}>
                {/* 프로필 이미지 URL */}
                <div style={{ gridColumn: '1 / -1' }}>
                    <FL>프로필 이미지 URL</FL>
                    <input
                        style={s.input}
                        placeholder="https://... (이미지 주소 입력)"
                        value={draft.avatarUrl}
                        onChange={(e) => setDraft((p) => ({ ...p, avatarUrl: e.target.value }))}
                    />
                    {draft.avatarUrl && (
                        <img
                            src={draft.avatarUrl}
                            alt="preview"
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                marginTop: 8,
                                border: '2px solid #e2e8f0',
                            }}
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                    )}
                </div>

                {/* 이름 */}
                <div>
                    <FL>이름</FL>
                    <input
                        style={s.input}
                        value={draft.name}
                        onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                        placeholder="이름"
                    />
                </div>

                {isTax ? (
                    <>
                        {/* 한줄 소개 */}
                        <div>
                            <FL>한줄 소개</FL>
                            <input
                                style={s.input}
                                value={draft.bio}
                                onChange={(e) => setDraft((p) => ({ ...p, bio: e.target.value }))}
                                placeholder="나를 표현하는 한 줄"
                            />
                        </div>

                        {/* 회사명 */}
                        <div>
                            <FL>회사명 (상호명)</FL>
                            <input
                                style={s.input}
                                value={draft.company_name}
                                onChange={(e) => setDraft((p) => ({ ...p, company_name: e.target.value }))}
                                placeholder="예: ○○ 세무회계"
                            />
                        </div>

                        {/* 사무실 주소 */}
                        <div>
                            <FL>사무실 주소</FL>
                            <input
                                style={s.input}
                                value={draft.office_address}
                                onChange={(e) => setDraft((p) => ({ ...p, office_address: e.target.value }))}
                                placeholder="예: 서울시 강남구..."
                            />
                        </div>

                        {/* 경력 */}
                        <div>
                            <FL>경력 (년)</FL>
                            <input
                                style={s.input}
                                type="number"
                                min="0"
                                value={draft.experience_years}
                                onChange={(e) =>
                                    setDraft((p) => ({ ...p, experience_years: parseInt(e.target.value) || 0 }))
                                }
                            />
                        </div>

                        {/* 기장료 */}
                        <div>
                            <FL>기장료 (원/월)</FL>
                            <input
                                style={s.input}
                                type="number"
                                min="0"
                                value={draft.monthly_fee}
                                onChange={(e) =>
                                    setDraft((p) => ({ ...p, monthly_fee: parseInt(e.target.value) || 0 }))
                                }
                                placeholder="예: 100000"
                            />
                        </div>

                        {/* 10분 채팅 요금 */}
                        <div>
                            <FL>10분 채팅 요금 (원)</FL>
                            <input
                                style={s.input}
                                type="number"
                                min="0"
                                value={draft.chat_rate_per_10min}
                                onChange={(e) =>
                                    setDraft((p) => ({ ...p, chat_rate_per_10min: parseInt(e.target.value) || 0 }))
                                }
                                placeholder="예: 5000"
                            />
                        </div>

                        {/* 상담 가능 시간 */}
                        <div>
                            <FL>상담 가능 시간</FL>
                            <input
                                style={s.input}
                                value={draft.available_hours}
                                onChange={(e) => setDraft((p) => ({ ...p, available_hours: e.target.value }))}
                                placeholder="예: 평일 09:00~18:00"
                            />
                        </div>

                        {/* 전문 분야 */}
                        <div style={{ gridColumn: '1 / -1' }}>
                            <FL>전문 분야 (여러 개 선택 가능)</FL>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                {TAX_CATEGORIES.map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        style={draft.categories.includes(cat) ? s.catOn : s.catOff}
                                        onClick={() => toggleCategory(cat)}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 상담 일정 캘린더 */}
                        <div style={{ gridColumn: '1 / -1' }}>
                            <FL>📅 상담 가능 일정 (날짜 클릭으로 선택 / 다시 클릭으로 해제)</FL>
                            {renderCalendar()}
                        </div>
                    </>
                ) : (
                    /* 일반 유저 */
                    <div>
                        <FL>한줄 소개</FL>
                        <textarea
                            style={{ ...s.input, resize: 'vertical' }}
                            rows={3}
                            value={draft.bio}
                            onChange={(e) => setDraft((p) => ({ ...p, bio: e.target.value }))}
                            placeholder="나를 표현하는 한 줄"
                        />
                    </div>
                )}
            </div>

            {/* ★★★ 저장 / 취소 버튼 — 항상 폼 하단에 위치 ★★★ */}
            <div style={s.editFooter}>
                <button style={s.btnSave} onClick={handleSave}>
                    💾 저장하기
                </button>
                <button style={s.btnCancel} onClick={handleCancel}>
                    취소
                </button>
            </div>
        </div>
    );
}

/* ─── 서브 컴포넌트 ─── */
function FL({ children }) {
    return <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', marginBottom: 5 }}>{children}</div>;
}

function InfoBox({ icon, label, value, wide }) {
    return (
        <div style={{ ...s.infoBox, gridColumn: wide ? '1 / -1' : 'auto' }}>
            <span style={s.infoIcon}>{icon}</span>
            <div>
                <div style={s.infoLbl}>{label}</div>
                <div style={s.infoVal}>{value}</div>
            </div>
        </div>
    );
}

function Overlay({ children, onClose }) {
    return (
        <div style={s.overlay} onClick={onClose}>
            <div style={s.modalBox} onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
}

/* ─── 스타일 ─── */
const s = {
    /* VIEW */
    viewHeader: { display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' },
    avatarImg: {
        width: 110,
        height: 110,
        borderRadius: '50%',
        objectFit: 'cover',
        border: '3px solid #fff',
        boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
    },
    avatarFallback: {
        width: 110,
        height: 110,
        borderRadius: '50%',
        background: 'linear-gradient(135deg,#3f6fb5,#2d5592)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 42,
        fontWeight: 800,
    },
    viewInfo: { flex: 1, minWidth: 200 },
    nameRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 },
    nameText: { fontSize: '1.45rem', fontWeight: 800, color: '#1a202c' },
    roleBadge: {
        fontSize: '0.75rem',
        fontWeight: 700,
        background: '#eef4ff',
        color: '#3f6fb5',
        padding: '3px 10px',
        borderRadius: 8,
        border: '1px solid rgba(63,111,181,0.22)',
    },
    usernameText: { fontSize: '0.9rem', color: '#94a3b8', marginBottom: 10 },

    /* 크레딧 바 */
    creditBar: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'linear-gradient(135deg,#eef2ff,#e0e9ff)',
        borderRadius: 14,
        padding: '10px 14px',
        border: '1.5px solid #c7d8ff',
    },
    btnCharge: {
        padding: '7px 16px',
        borderRadius: 20,
        border: 'none',
        background: '#3d6fd9',
        color: '#fff',
        fontWeight: 700,
        fontSize: '0.82rem',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    btnHistory: {
        padding: '7px 16px',
        borderRadius: 20,
        border: '1.5px solid #c0cfe8',
        background: '#fff',
        color: '#4a6fa5',
        fontWeight: 700,
        fontSize: '0.82rem',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },

    /* 뷰 액션 버튼 */
    viewActions: { display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 },
    btnEdit: {
        padding: '10px 20px',
        borderRadius: 12,
        border: '1.5px solid rgba(63,111,181,0.3)',
        background: 'rgba(238,244,255,0.9)',
        color: '#3f6fb5',
        fontWeight: 700,
        fontSize: '0.9rem',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    btnWithdraw: {
        padding: '8px 16px',
        borderRadius: 10,
        border: 'none',
        background: 'none',
        color: '#94a3b8',
        fontSize: '0.82rem',
        cursor: 'pointer',
    },

    /* 세무사 정보 그리드 */
    taxGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 20 },
    infoBox: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        background: 'rgba(248,250,252,0.9)',
        borderRadius: 12,
        padding: '12px 16px',
        border: '1px solid rgba(63,111,181,0.12)',
    },
    infoIcon: { fontSize: '1.1rem', flexShrink: 0 },
    infoLbl: { fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: 3 },
    infoVal: { fontSize: '0.9rem', fontWeight: 600, color: '#334155' },
    tagRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 },
    tagBlue: {
        padding: '3px 10px',
        borderRadius: 20,
        background: '#eef2ff',
        color: '#3d6fd9',
        fontSize: '0.78rem',
        fontWeight: 700,
        border: '1px solid #c7d8ff',
    },
    tagGreen: {
        padding: '3px 10px',
        borderRadius: 20,
        background: '#e8f5e9',
        color: '#2e7d32',
        fontSize: '0.78rem',
        fontWeight: 700,
        border: '1px solid #a5d6a7',
    },

    /* EDIT */
    editGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 },
    input: {
        width: '100%',
        padding: '11px 14px',
        borderRadius: 10,
        border: '1px solid #e2e8f0',
        fontSize: '0.9rem',
        background: '#fcfdfe',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        outline: 'none',
    },
    catOn: {
        padding: '6px 14px',
        borderRadius: 20,
        border: '1.5px solid #3d6fd9',
        background: '#3d6fd9',
        color: '#fff',
        fontSize: '0.82rem',
        fontWeight: 700,
        cursor: 'pointer',
    },
    catOff: {
        padding: '6px 14px',
        borderRadius: 20,
        border: '1.5px solid #ddd',
        background: '#f5f7fa',
        color: '#555',
        fontSize: '0.82rem',
        fontWeight: 600,
        cursor: 'pointer',
    },

    /* ★ 저장/취소 버튼 — 폼 최하단 */
    editFooter: {
        display: 'flex',
        gap: 12,
        justifyContent: 'flex-end',
        marginTop: 28,
        paddingTop: 18,
        borderTop: '1.5px solid rgba(63,111,181,0.12)',
    },
    btnSave: {
        padding: '13px 40px',
        borderRadius: 12,
        border: 'none',
        background: '#3f6fb5',
        color: '#fff',
        fontWeight: 800,
        fontSize: '1rem',
        cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(63,111,181,0.3)',
    },
    btnCancel: {
        padding: '13px 24px',
        borderRadius: 12,
        border: '1.5px solid #ddd',
        background: '#fff',
        color: '#666',
        fontWeight: 700,
        fontSize: '1rem',
        cursor: 'pointer',
    },

    /* 캘린더 */
    calWrap: { background: '#f8f9fb', borderRadius: 12, padding: 14, marginTop: 6 },
    calHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    calTitle: { fontWeight: 800, fontSize: '0.95rem', color: '#1e293b' },
    calNav: {
        background: 'none',
        border: 'none',
        fontSize: '1.4rem',
        cursor: 'pointer',
        color: '#3d6fd9',
        fontWeight: 700,
        padding: '0 6px',
        lineHeight: 1,
    },
    calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 },
    calCell: { textAlign: 'center', padding: '7px 2px', fontSize: '0.8rem', background: 'none', border: 'none' },

    /* 모달 공통 */
    overlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.52)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
    },
    modalBox: {
        background: '#fff',
        borderRadius: 22,
        padding: '32px 28px',
        width: 460,
        maxWidth: '95vw',
        maxHeight: '85vh',
        overflowY: 'auto',
        boxShadow: '0 30px 80px rgba(0,0,0,0.22)',
    },
    modalTitle: { margin: '0 0 8px', fontSize: '1.3rem', fontWeight: 900, color: '#1e293b' },
    modalSub: { color: '#64748b', marginBottom: 22, fontSize: '0.95rem' },
    modalCloseBtn: {
        width: '100%',
        padding: '12px',
        borderRadius: 12,
        border: 'none',
        background: '#f1f5f9',
        color: '#555',
        fontWeight: 700,
        fontSize: '0.95rem',
        cursor: 'pointer',
        marginTop: 8,
    },

    /* 크레딧 충전 패키지 */
    pkgGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 },
    pkgBtn: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: '16px 10px',
        borderRadius: 14,
        border: '2px solid #e8eeff',
        background: '#f4f7ff',
        cursor: 'pointer',
    },

    /* 크레딧 내역 */
    histItem: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderRadius: 10,
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
    },
    histBadge: { padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700 },
};
