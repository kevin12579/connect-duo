// src/pages/RankingPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { getTaxProRanking, purchaseAd, cancelAd } from '../../api/axios';
import './RankingPage.css';

/* ─── 상수 ────────────────────────────────────── */
const ALL_CATEGORIES = [
    '전체',
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
const SORT_OPTIONS = [
    { key: 'satisfaction_score', label: '만족도' },
    { key: 'recommend_count', label: '추천수' },
    { key: 'consult_count', label: '상담수' },
    { key: 're_consult_rate', label: '재상담률' },
];
const AD_PLANS = [
    { days: 7, price: 7000, label: '7일', tag: '단기 체험' },
    { days: 30, price: 30000, label: '30일', tag: '추천' },
    { days: 90, price: 80000, label: '90일', tag: '인기' },
];

/* ─── 유틸 ─────────────────────────────────────── */
const isAdActive = (item) => !!(item.is_ad && item.ad_expires_at && new Date(item.ad_expires_at) > new Date());

const fmtDate = (str) =>
    str ? new Date(str).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

/* ═══════════════════════════════════════════════════════
   메인 컴포넌트
═══════════════════════════════════════════════════════ */
export default function RankingPage({ onOpenTaxProProfile }) {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('전체');
    const [sortKey, setSortKey] = useState('satisfaction_score');
    const [adModal, setAdModal] = useState(null); // null | 'purchase' | 'cancel'
    const [adLoading, setAdLoading] = useState(false);

    /* 로그인 유저 */
    const me = useMemo(() => {
        const b = JSON.parse(localStorage.getItem('userBackup') || 'null');
        return b ? { id: b.id, userType: b.user_type } : null;
    }, []);
    const isTaxPro = me?.userType === 'TAX_ACCOUNTANT';

    /* 내 랭킹 항목 */
    const myItem = useMemo(
        () => (isTaxPro && me ? list.find((i) => String(i.user_id) === String(me.id)) || null : null),
        [list, me, isTaxPro],
    );
    const myAdActive = myItem ? isAdActive(myItem) : false;

    /* 데이터 fetch */
    const fetchList = () => {
        setLoading(true);
        getTaxProRanking()
            .then((res) => {
                if (res.result === 'success') setList(res.data);
            })
            .finally(() => setLoading(false));
    };
    useEffect(fetchList, []);

    /* 필터 + 정렬 + AD 상단 고정 */
    const filtered = useMemo(() => {
        const base = list
            .filter(
                (item) =>
                    selectedCategory === '전체' ||
                    (Array.isArray(item.categories) && item.categories.includes(selectedCategory)),
            )
            .sort((a, b) => Number(b[sortKey]) - Number(a[sortKey]));

        const adItems = base.filter(isAdActive);
        const normalItems = base.filter((i) => !isAdActive(i));
        return [...adItems, ...normalItems];
    }, [list, selectedCategory, sortKey]);

    /* 광고 구매 */
    const handlePurchase = async (days) => {
        if (!me) return;
        setAdLoading(true);
        try {
            const res = await purchaseAd(me.id, days);
            if (res.result === 'success') {
                alert(
                    `✅ 광고 등록 완료!\n만료일: ${fmtDate(res.ad_expires_at)}\n남은 크레딧: ${(res.credit || 0).toLocaleString()}`,
                );
                setAdModal(null);
                fetchList();
            } else {
                alert(res.message || '광고 구매에 실패했습니다.');
            }
        } catch (e) {
            alert(e?.response?.data?.message || '광고 구매 중 오류가 발생했습니다.');
        } finally {
            setAdLoading(false);
        }
    };

    /* 광고 취소 */
    const handleCancel = async () => {
        if (!me) return;
        if (!window.confirm('광고를 취소하시겠습니까?\n남은 기간에 대한 환불은 되지 않습니다.')) return;
        setAdLoading(true);
        try {
            const res = await cancelAd(me.id);
            if (res.result === 'success') {
                alert('광고가 취소되었습니다.');
                setAdModal(null);
                fetchList();
            }
        } catch {
            alert('취소 중 오류가 발생했습니다.');
        } finally {
            setAdLoading(false);
        }
    };

    if (loading)
        return (
            <div style={st.loadingWrap}>
                <div style={st.spinner} />
                <p style={{ color: '#7a92c0', fontWeight: 700 }}>랭킹 데이터를 불러오는 중...</p>
            </div>
        );

    return (
        <div className="ranking-root" style={st.root}>
            {/* ── 헤더 ── */}
            <div style={st.header}>
                <h2 style={st.title}>🏆 세무사 랭킹</h2>
                {isTaxPro && (
                    <button
                        className={`ad-top-btn ${myAdActive ? 'active' : 'buy'}`}
                        onClick={() => setAdModal(myAdActive ? 'cancel' : 'purchase')}
                    >
                        {myAdActive
                            ? `📢 광고 진행 중 · ${fmtDate(myItem?.ad_expires_at)} 만료`
                            : '📢 내 프로필 광고 등록하기'}
                    </button>
                )}
            </div>

            {/* ── 전문 분야 필터 ── */}
            <div style={st.filterSection}>
                <div style={st.filterLabel}>전문 분야</div>
                <div style={st.filterRow}>
                    {ALL_CATEGORIES.map((cat) => (
                        <button
                            key={cat}
                            style={selectedCategory === cat ? st.filterChipActive : st.filterChip}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── 정렬 ── */}
            <div style={st.sortRow}>
                {SORT_OPTIONS.map((opt) => (
                    <button
                        key={opt.key}
                        style={sortKey === opt.key ? st.sortBtnActive : st.sortBtn}
                        onClick={() => setSortKey(opt.key)}
                    >
                        {opt.label}순
                    </button>
                ))}
                <span style={st.resultCount}>총 {filtered.length}명</span>
            </div>

            {/* ── 랭킹 리스트 ── */}
            {filtered.length === 0 ? (
                <div style={st.empty}>해당 분야의 세무사가 없습니다.</div>
            ) : (
                <div style={st.list}>
                    {filtered.map((item, idx) => {
                        const ad = isAdActive(item);
                        const isMe = isTaxPro && String(item.user_id) === String(me?.id);

                        /* 순위는 AD 제외한 일반 목록에서 계산 */
                        const normalItems = filtered.filter((i) => !isAdActive(i));
                        const rank = ad ? null : normalItems.indexOf(item) + 1;

                        return ad ? (
                            <AdCard
                                key={item.user_id}
                                item={item}
                                isMe={isMe}
                                onOpen={() => onOpenTaxProProfile?.(item.user_id)}
                                onManage={() => setAdModal(myAdActive ? 'cancel' : 'purchase')}
                            />
                        ) : (
                            <NormalCard
                                key={item.user_id}
                                item={item}
                                rank={rank}
                                isMe={isMe}
                                myAdActive={myAdActive}
                                onOpen={() => onOpenTaxProProfile?.(item.user_id)}
                                onAdUpsell={() => setAdModal('purchase')}
                            />
                        );
                    })}
                </div>
            )}

            {/* ── 광고 구매 모달 ── */}
            {adModal === 'purchase' && (
                <AdPurchaseModal
                    plans={AD_PLANS}
                    loading={adLoading}
                    onBuy={handlePurchase}
                    onClose={() => setAdModal(null)}
                />
            )}

            {/* ── 광고 관리/취소 모달 ── */}
            {adModal === 'cancel' && (
                <AdCancelModal
                    item={myItem}
                    loading={adLoading}
                    onCancel={handleCancel}
                    onExtend={() => setAdModal('purchase')}
                    onClose={() => setAdModal(null)}
                />
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   AD 카드 — 프리미엄 배너
═══════════════════════════════════════════════════════ */
function AdCard({ item, isMe, onOpen, onManage }) {
    const hasFee = item.chat_rate_per_10min > 0 || item.monthly_fee > 0;

    return (
        <div className="ad-card" onClick={onOpen}>
            {/* 배경 글로우 */}
            <div className="ad-card-glow" />
            <div className="ad-card-glow2" />

            {/* 뱃지 */}
            <div className="ad-badge">📢 AD</div>
            <div className="ad-sponsored">SPONSORED</div>

            {/* 본문 */}
            <div className="ad-inner">
                {/* 아바타 */}
                <div className="ad-avatar-wrap">
                    {item.profile_img ? (
                        <img src={item.profile_img} alt={item.name} className="ad-avatar-img" />
                    ) : (
                        <div className="ad-avatar-fallback">{item.name?.charAt(0)}</div>
                    )}
                    <div className="ad-online-dot" />
                </div>

                {/* 정보 */}
                <div className="ad-info">
                    <div className="ad-name-row">
                        <span className="ad-name">{item.name}</span>
                        <span className="ad-role-badge">세무사</span>
                        {item.experience_years > 0 && (
                            <span className="ad-exp-badge">경력 {item.experience_years}년</span>
                        )}
                    </div>

                    {(item.company_name || item.office_address) && (
                        <div className="ad-meta">
                            {item.company_name && <span>🏢 {item.company_name}</span>}
                            {item.company_name && item.office_address && <span className="ad-sep">|</span>}
                            {item.office_address && <span>📍 {item.office_address}</span>}
                        </div>
                    )}

                    <div className="ad-bio">{item.bio_one_line || '문의 주시면 성실히 답변드립니다.'}</div>

                    {Array.isArray(item.categories) && item.categories.length > 0 && (
                        <div className="ad-cat-row">
                            {item.categories.map((c) => (
                                <span key={c} className="ad-cat-chip">
                                    {c}
                                </span>
                            ))}
                        </div>
                    )}

                    {hasFee && (
                        <div className="ad-fee-box" onClick={(e) => e.stopPropagation()}>
                            {item.chat_rate_per_10min > 0 && (
                                <div className="ad-fee-row">
                                    <span className="ad-fee-label">💬 10분 채팅 상담</span>
                                    <span className="ad-fee-val">{item.chat_rate_per_10min.toLocaleString()}원</span>
                                </div>
                            )}
                            {item.monthly_fee > 0 && (
                                <div className="ad-fee-row">
                                    <span className="ad-fee-label">📋 기장료</span>
                                    <span className="ad-fee-val">{item.monthly_fee.toLocaleString()}원/월</span>
                                </div>
                            )}
                        </div>
                    )}

                    {isMe && (
                        <button
                            className="ad-manage-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onManage();
                            }}
                        >
                            ⚙️ 광고 관리
                        </button>
                    )}
                </div>

                {/* 통계 */}
                <div className="ad-stats">
                    <div className="ad-stat-pill gold">
                        <span className="ad-stat-val">⭐ {Number(item.satisfaction_score).toFixed(1)}</span>
                        <span className="ad-stat-label">만족도</span>
                    </div>
                    <div className="ad-stat-pill">
                        <span className="ad-stat-val">👍 {item.recommend_count}</span>
                        <span className="ad-stat-label">추천</span>
                    </div>
                    <div className="ad-stat-pill">
                        <span className="ad-stat-val">💬 {item.consult_count}</span>
                        <span className="ad-stat-label">상담</span>
                    </div>
                    <div className="ad-stat-pill">
                        <span className="ad-stat-val">🔁 {Math.round(item.re_consult_rate)}%</span>
                        <span className="ad-stat-label">재상담</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   일반 카드 (기존 디자인 유지)
═══════════════════════════════════════════════════════ */
function NormalCard({ item, rank, isMe, myAdActive, onOpen, onAdUpsell }) {
    const rankBgMap = [
        'linear-gradient(135deg, #FFD700, #FFA500)',
        'linear-gradient(135deg, #C0C0C0, #a0a0a0)',
        'linear-gradient(135deg, #CD7F32, #a05a1a)',
    ];
    const rankBg = rank <= 3 ? rankBgMap[rank - 1] : '#eee';
    const rankColor = rank <= 3 ? '#fff' : '#666';
    const rankEmoji = ['🥇', '🥈', '🥉'];

    return (
        <div
            style={{
                ...st.card,
                ...(isMe ? st.cardMe : {}),
                ...(rank === 1 ? st.cardGold : {}),
                ...(rank === 2 ? st.cardSilver : {}),
                ...(rank === 3 ? st.cardBronze : {}),
            }}
            onClick={onOpen}
        >
            {/* 순위 */}
            <div style={{ ...st.rank, background: rankBg, color: rankColor }}>
                {rank <= 3 ? rankEmoji[rank - 1] : rank}
            </div>

            {/* 아바타 */}
            <div style={{ flexShrink: 0 }}>
                {item.profile_img ? (
                    <img src={item.profile_img} alt={item.name} style={st.avatarImg} />
                ) : (
                    <div style={st.avatarFallback}>{item.name?.charAt(0)}</div>
                )}
            </div>

            {/* 정보 */}
            <div style={st.info}>
                <div style={st.name}>
                    {item.name}
                    {item.company_name && <span style={st.company}>{item.company_name}</span>}
                    {isMe && <span style={st.meLabel}>나</span>}
                </div>
                {item.office_address && <div style={st.sub}>📍 {item.office_address}</div>}
                {item.experience_years > 0 && <div style={st.sub}>🗂 경력 {item.experience_years}년</div>}
                <div style={st.bio}>{item.bio_one_line || '소개가 없습니다.'}</div>

                {Array.isArray(item.categories) && item.categories.length > 0 && (
                    <div style={st.catWrap}>
                        {item.categories.map((c) => (
                            <span key={c} style={st.catTag}>
                                {c}
                            </span>
                        ))}
                    </div>
                )}

                {/* 본인 + 광고 없으면 광고 유도 */}
                {isMe && !myAdActive && (
                    <button
                        className="ad-upsell-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAdUpsell();
                        }}
                    >
                        📢 광고로 최상단에 노출하기
                    </button>
                )}
            </div>

            {/* 통계 */}
            <div style={st.stats}>
                <div style={st.stat}>
                    <div style={st.statVal}>⭐ {Number(item.satisfaction_score).toFixed(1)}</div>
                    <div style={st.statLabel}>만족도</div>
                </div>
                <div style={st.stat}>
                    <div style={st.statVal}>👍 {item.recommend_count}</div>
                    <div style={st.statLabel}>추천</div>
                </div>
                <div style={st.stat}>
                    <div style={st.statVal}>💬 {item.consult_count}</div>
                    <div style={st.statLabel}>상담</div>
                </div>
                <div style={st.stat}>
                    <div style={st.statVal}>{Math.round(item.re_consult_rate)}%</div>
                    <div style={st.statLabel}>재상담률</div>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   광고 구매 모달
═══════════════════════════════════════════════════════ */
function AdPurchaseModal({ plans, loading, onBuy, onClose }) {
    const [selected, setSelected] = useState(plans[1]); // 기본 30일

    return (
        <div className="ad-overlay" onClick={onClose}>
            <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
                <div className="ad-modal-header">
                    <div className="ad-modal-icon">📢</div>
                    <div>
                        <h3 className="ad-modal-title">광고 등록</h3>
                        <p className="ad-modal-sub">광고 등록 시 랭킹 최상단에 프리미엄 배너로 노출됩니다.</p>
                    </div>
                </div>

                <div className="ad-benefit-grid">
                    {[
                        '🔝 랭킹 최상단 고정 노출',
                        '✨ 프리미엄 AD 배너 디자인',
                        '💛 골드 테두리 & 아바타 강조',
                        '📊 실시간 광고 기간 표시',
                    ].map((t) => (
                        <div key={t} className="ad-benefit-item">
                            {t}
                        </div>
                    ))}
                </div>

                <div className="plan-grid">
                    {plans.map((plan) => (
                        <button
                            key={plan.days}
                            className={`plan-card${selected.days === plan.days ? ' selected' : ''}`}
                            onClick={() => setSelected(plan)}
                        >
                            <span className="plan-tag">{plan.tag}</span>
                            <div className="plan-days">{plan.label}</div>
                            <div className="plan-price">{plan.price.toLocaleString()}</div>
                            <div className="plan-unit">크레딧</div>
                        </button>
                    ))}
                </div>

                <p className="plan-note">
                    💡 이미 광고 중이라면 만료일이 <strong>{selected.days}일</strong> 연장됩니다.
                </p>

                <div className="ad-modal-footer">
                    <button className="btn-ad-confirm" disabled={loading} onClick={() => onBuy(selected.days)}>
                        {loading ? '처리 중...' : `${selected.price.toLocaleString()} 크레딧으로 광고 등록`}
                    </button>
                    <button className="btn-ad-close" onClick={onClose}>
                        취소
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   광고 관리/취소 모달
═══════════════════════════════════════════════════════ */
function AdCancelModal({ item, loading, onCancel, onExtend, onClose }) {
    const daysLeft = item?.ad_expires_at
        ? Math.max(0, Math.ceil((new Date(item.ad_expires_at) - new Date()) / 86400000))
        : 0;

    return (
        <div className="ad-overlay" onClick={onClose}>
            <div className="ad-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
                <h3 className="ad-modal-title" style={{ marginBottom: 18 }}>
                    📢 광고 관리
                </h3>

                <div className="ad-cancel-info">
                    <div className="ad-cancel-row">
                        <span>📅 만료일</span>
                        <strong>{fmtDate(item?.ad_expires_at)}</strong>
                    </div>
                    <div className="ad-cancel-row">
                        <span>⏱ 남은 기간</span>
                        <strong style={{ color: daysLeft <= 3 ? '#ef4444' : '#166534' }}>{daysLeft}일</strong>
                    </div>
                </div>

                <div className="ad-modal-footer">
                    <button className="btn-ad-extend" onClick={onExtend}>
                        기간 연장하기
                    </button>
                    <button className="btn-ad-cancel-ad" disabled={loading} onClick={onCancel}>
                        {loading ? '처리 중...' : '광고 취소 (환불 없음)'}
                    </button>
                    <button className="btn-ad-close" onClick={onClose}>
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── 인라인 스타일 (기존 코드와 동일한 패턴 유지) ─── */
const st = {
    root: { width: '100%', padding: '10px 0' },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 22,
    },
    title: { fontSize: '1.6rem', fontWeight: 900, color: '#222', margin: 0 },
    loadingWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 60 },
    spinner: {
        width: 36,
        height: 36,
        border: '4px solid #e0e7ff',
        borderTop: '4px solid #5a8cf1',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
    },

    filterSection: { marginBottom: 18 },
    filterLabel: { fontSize: '0.88rem', fontWeight: 700, color: '#555', marginBottom: 8 },
    filterRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
    filterChip: {
        padding: '6px 16px',
        borderRadius: 20,
        border: '1.5px solid #ddd',
        background: '#f5f5f5',
        color: '#555',
        fontWeight: 600,
        fontSize: '0.85rem',
        cursor: 'pointer',
    },
    filterChipActive: {
        padding: '6px 16px',
        borderRadius: 20,
        border: '1.5px solid #3d6fd9',
        background: '#3d6fd9',
        color: '#fff',
        fontWeight: 700,
        fontSize: '0.85rem',
        cursor: 'pointer',
    },

    sortRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
    sortBtn: {
        padding: '6px 16px',
        borderRadius: 10,
        border: '1.5px solid #ddd',
        background: '#fff',
        color: '#666',
        fontWeight: 600,
        fontSize: '0.85rem',
        cursor: 'pointer',
    },
    sortBtnActive: {
        padding: '6px 16px',
        borderRadius: 10,
        border: '1.5px solid #5a8cf1',
        background: '#eef2ff',
        color: '#3d6fd9',
        fontWeight: 800,
        fontSize: '0.85rem',
        cursor: 'pointer',
    },
    resultCount: { marginLeft: 'auto', fontSize: '0.85rem', color: '#999', fontWeight: 600 },

    list: { display: 'flex', flexDirection: 'column', gap: 14 },
    empty: { textAlign: 'center', color: '#aaa', padding: 60, fontWeight: 600 },

    /* 일반 카드 */
    card: {
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        background: '#fff',
        borderRadius: 18,
        border: '1.5px solid #eef0f5',
        padding: '18px 22px',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
    },
    cardMe: { border: '1.5px solid rgba(99,102,241,0.4)', background: 'rgba(238,242,255,0.4)' },
    cardGold: {
        border: '2px solid rgba(255,202,40,0.6)',
        background: 'linear-gradient(to right,#fffcf0,#fff)',
        boxShadow: '0 10px 30px rgba(255,202,40,0.12)',
    },
    cardSilver: { border: '2px solid rgba(207,216,220,0.8)', background: 'linear-gradient(to right,#eef2f6,#fff)' },
    cardBronze: { border: '2px solid rgba(255,204,188,0.8)', background: 'linear-gradient(to right,#fff8f6,#fff)' },
    rank: {
        minWidth: 42,
        height: 42,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        fontSize: '1.1rem',
        flexShrink: 0,
    },
    avatarImg: { width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' },
    avatarFallback: {
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'linear-gradient(135deg,#a3bffa,#7d9df5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 900,
        fontSize: '1.4rem',
    },
    info: { flex: 1, minWidth: 0 },
    name: { fontSize: '1.05rem', fontWeight: 800, color: '#222', display: 'flex', alignItems: 'center', gap: 8 },
    company: {
        fontSize: '0.8rem',
        fontWeight: 600,
        color: '#7a92c0',
        background: '#eef2ff',
        padding: '2px 8px',
        borderRadius: 8,
    },
    meLabel: {
        fontSize: '0.75rem',
        fontWeight: 800,
        color: '#fff',
        background: '#6366f1',
        padding: '2px 8px',
        borderRadius: 8,
    },
    sub: { fontSize: '0.82rem', color: '#888', marginTop: 2 },
    bio: {
        fontSize: '0.88rem',
        color: '#555',
        marginTop: 4,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    catWrap: { display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 },
    catTag: {
        padding: '2px 9px',
        borderRadius: 12,
        background: '#f0f4ff',
        color: '#5a8cf1',
        fontSize: '0.75rem',
        fontWeight: 700,
        border: '1px solid #dce8ff',
    },
    stats: { display: 'flex', gap: 16, flexShrink: 0 },
    stat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
    statVal: { fontSize: '0.95rem', fontWeight: 800, color: '#222' },
    statLabel: { fontSize: '0.72rem', color: '#aaa', fontWeight: 600 },
};
