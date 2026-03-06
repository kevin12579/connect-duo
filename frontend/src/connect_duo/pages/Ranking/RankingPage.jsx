// src/pages/RankingPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getTaxProRanking, purchaseAd, cancelAd } from '../../api/axios';
import './RankingPage.css';

import rankGold from '../../assets/gold-1st.png';
import rankSilver from '../../assets/silver-2st.png';
import rankBronze from '../../assets/bronze-3rd.png';
import adPng from '../../assets/ad.png';

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
const isAdActive = (item) =>
  !!(item.is_ad && item.ad_expires_at && new Date(item.ad_expires_at) > new Date());

const fmtDate = (str) =>
  str ? new Date(str).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

/* ═══════════════════════════════════════════════════════
   메인
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
  const myItem = useMemo(() => {
    if (!isTaxPro || !me) return null;
    return list.find((i) => String(i.user_id) === String(me.id)) || null;
  }, [list, me, isTaxPro]);

  const myAdActive = myItem ? isAdActive(myItem) : false;

  /* 데이터 fetch */
  const fetchList = () => {
    setLoading(true);
    getTaxProRanking()
      .then((res) => {
        if (res?.result === 'success') setList(res.data || []);
      })
      .finally(() => setLoading(false));
  };
  useEffect(fetchList, []);

  /* 필터 + 정렬 + AD 상단 고정 */
  const filtered = useMemo(() => {
    const base = (Array.isArray(list) ? list : [])
      .filter(
        (item) =>
          selectedCategory === '전체' ||
          (Array.isArray(item.categories) && item.categories.includes(selectedCategory)),
      )
      .sort((a, b) => Number(b?.[sortKey] || 0) - Number(a?.[sortKey] || 0));

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
      if (res?.result === 'success') {
        alert(
          `✅ 광고 등록 완료!\n만료일: ${fmtDate(res.ad_expires_at)}\n남은 크레딧: ${(res.credit || 0).toLocaleString()}`,
        );
        setAdModal(null);
        fetchList();
      } else {
        alert(res?.message || '광고 구매에 실패했습니다.');
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
      if (res?.result === 'success') {
        alert('광고가 취소되었습니다.');
        setAdModal(null);
        fetchList();
      } else {
        alert(res?.message || '취소에 실패했습니다.');
      }
    } catch (e) {
      alert(e?.response?.data?.message || '취소 중 오류가 발생했습니다.');
    } finally {
      setAdLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="ranking-loading">
        <div className="ranking-spinner" />
        <p className="ranking-loading-text">랭킹 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="ranking-root">
      {/* 헤더 */}
      <div className="ranking-header">
        <h2 className="ranking-title">🏆 세무사 랭킹</h2>

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

      {/* 필터 */}
      <div className="ranking-filter">
        <div className="ranking-filter-label">전문 분야</div>
        <div className="ranking-filter-row">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`filter-chip ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 정렬 */}
      <div className="ranking-sort-row">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            className={`sort-btn ${sortKey === opt.key ? 'active' : ''}`}
            onClick={() => setSortKey(opt.key)}
          >
            {opt.label}순
          </button>
        ))}
        <span className="ranking-result-count">총 {filtered.length}명</span>
      </div>

      {/* 리스트 */}
      {filtered.length === 0 ? (
        <div className="ranking-empty">해당 분야의 세무사가 없습니다.</div>
      ) : (
        <div className="ranking-list">
          {filtered.map((item) => {
            const ad = isAdActive(item);
            const isMe = isTaxPro && String(item.user_id) === String(me?.id);

            // 순위는 AD 제외한 일반 목록에서 계산
            const normalItems = filtered.filter((i) => !isAdActive(i));
            const rank = ad ? null : normalItems.indexOf(item) + 1;

            return ad ? (
              <AdCard
                key={item.user_id}
                item={item}
                isMe={isMe}
                onOpen={() => onOpenTaxProProfile?.(item.user_id)}
                onManage={() => setAdModal(myAdActive ? 'cancel' : 'purchase')}
                adIcon={adPng}
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
                badgeGold={rankGold}
                badgeSilver={rankSilver}
                badgeBronze={rankBronze}
              />
            );
          })}
        </div>
      )}

      {/* 광고 구매 모달 (PORTAL) */}
      {adModal === 'purchase' && (
        <AdPurchaseModal
          plans={AD_PLANS}
          loading={adLoading}
          onBuy={handlePurchase}
          onClose={() => setAdModal(null)}
          adIcon={adPng}
        />
      )}

      {/* 광고 관리/취소 모달 (PORTAL) */}
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

/* =========================
   AD 카드 (정의 누락 방지)
========================= */
function AdCard({ item, isMe, onOpen, onManage, adIcon }) {
  const hasFee = item.chat_rate_per_10min > 0 || item.monthly_fee > 0;

  return (
    <div className="ad-card" onClick={onOpen}>
      <div className="ad-card-glow" />
      <div className="ad-card-glow2" />

      <div className="ad-badge">
        <img className="ad-badge-icon" src={adIcon} alt="AD" />
        <span>AD</span>
      </div>
      <div className="ad-sponsored">SPONSORED</div>

      <div className="ad-inner ad-inner--center">
        <div className="ad-avatar-wrap">
          {item.profile_img ? (
            <img src={item.profile_img} alt={item.name} className="ad-avatar-img" />
          ) : (
            <div className="ad-avatar-fallback">{item.name?.charAt(0)}</div>
          )}
          <div className="ad-online-dot" />
        </div>

        <div className="ad-info">
          <div className="ad-name-row">
            <span className="ad-name">{item.name}</span>
            <span className="ad-role-badge">세무사</span>
            {item.experience_years > 0 && <span className="ad-exp-badge">경력 {item.experience_years}년</span>}
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

/* =========================
   일반 카드
========================= */
function NormalCard({
  item,
  rank,
  isMe,
  myAdActive,
  onOpen,
  onAdUpsell,
  badgeGold,
  badgeSilver,
  badgeBronze,
}) {
  const badgeSrc = rank === 1 ? badgeGold : rank === 2 ? badgeSilver : rank === 3 ? badgeBronze : null;

  // 이건 네 CSS에 “레일 방식”이 이미 있어서, className 기반으로만 출력
  return (
    <div className={`ranking-card ${rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : ''} ${isMe ? 'is-me' : ''}`} onClick={onOpen}>
      <div className="rank-rail">
        {badgeSrc ? <img className="rank-badge-img" src={badgeSrc} alt={`${rank}등`} /> : <div className="rank-number">{rank}</div>}
      </div>

      <div className="card-avatar">
        {item.profile_img ? (
          <img src={item.profile_img} alt={item.name} className="avatar-img" />
        ) : (
          <div className="avatar-fallback">{item.name?.charAt(0)}</div>
        )}
      </div>

      <div className="card-info">
        <div className="card-name-row">
          <span className="card-name">{item.name}</span>
          {item.company_name && <span className="card-company">{item.company_name}</span>}
          {isMe && <span className="card-me">나</span>}
        </div>

        {item.office_address && <div className="card-sub">📍 {item.office_address}</div>}
        {item.experience_years > 0 && <div className="card-sub">🗂 경력 {item.experience_years}년</div>}

        <div className="card-bio">{item.bio_one_line || '소개가 없습니다.'}</div>

        {Array.isArray(item.categories) && item.categories.length > 0 && (
          <div className="card-cats">
            {item.categories.map((c) => (
              <span key={c} className="cat-tag">
                {c}
              </span>
            ))}
          </div>
        )}

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

      <div className="card-stats">
        <div className="stat">
          <div className="stat-val">⭐ {Number(item.satisfaction_score).toFixed(1)}</div>
          <div className="stat-label">만족도</div>
        </div>
        <div className="stat">
          <div className="stat-val">👍 {item.recommend_count}</div>
          <div className="stat-label">추천</div>
        </div>
        <div className="stat">
          <div className="stat-val">💬 {item.consult_count}</div>
          <div className="stat-label">상담</div>
        </div>
        <div className="stat">
          <div className="stat-val">{Math.round(item.re_consult_rate)}%</div>
          <div className="stat-label">재상담률</div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   광고 구매 모달 (Portal)
========================= */
function AdPurchaseModal({ plans, loading, onBuy, onClose, adIcon }) {
  const [selected, setSelected] = useState(plans[1]);

  return createPortal(
    <div className="ad-overlay" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ad-modal-header">
          <img className="ad-modal-iconimg" src={adIcon} alt="AD" />
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
    </div>,
    document.body,
  );
}

/* =========================
   광고 취소/관리 모달 (Portal)
========================= */
function AdCancelModal({ item, loading, onCancel, onExtend, onClose }) {
  const daysLeft = item?.ad_expires_at
    ? Math.max(0, Math.ceil((new Date(item.ad_expires_at) - new Date()) / 86400000))
    : 0;

  return createPortal(
    <div className="ad-overlay" onClick={onClose}>
      <div className="ad-modal ad-modal--sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="ad-modal-title ad-modal-title--only">📢 광고 관리</h3>

        <div className="ad-cancel-info">
          <div className="ad-cancel-row">
            <span>📅 만료일</span>
            <strong>{fmtDate(item?.ad_expires_at)}</strong>
          </div>
          <div className="ad-cancel-row">
            <span>⏱ 남은 기간</span>
            <strong className={`days-left ${daysLeft <= 3 ? 'danger' : 'ok'}`}>{daysLeft}일</strong>
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
    </div>,
    document.body,
  );
}