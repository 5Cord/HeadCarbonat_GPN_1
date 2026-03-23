// С Бэкендом
// ResultsPanel.jsx
import React, { useState, useEffect, useCallback } from 'react';
import './ResultsPanel.css';
import useGameStore from '../../store/gameStore';
import { FIELD_WORK_BLOCKS } from '../FieldWork/Fieldworkdata';
import BudgetBar from '../Budgetbar.jsx';
import { getSocket } from '../apiHelpers';
import ResultsPanelTour from './ResultsPanelTour';

const formatTime = (s) => {
  const t = Math.max(0, Math.floor(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

const TABLE_COLUMNS = [
  { mobWorkId: 'srr_2d', label: 'СРР 2D', color: 'gray' },
  { mobWorkId: 'srr_3d', label: 'СРР 3D', color: 'gray' },
  { mobWorkId: '1pr', label: '1ПО', color: 'orange' },
  { mobWorkId: '2pr', label: '2ПО', color: 'orange' },
  { mobWorkId: '3r', label: '3Р', color: 'orange' },
  { mobWorkId: '4r', label: '4Р', color: 'orange' },
  { mobWorkId: 'gs', label: 'ГС', color: 'beige' },
  { mobWorkId: 'drilling_5gs', label: 'ГС с МГРП', color: 'beige' },
  { mobWorkId: 'drilling_6gs', label: 'МЗС', color: 'beige' },
  { mobWorkId: 'ppd', label: 'ППД', color: 'beige' },
  { mobWorkId: 'mun', label: 'МУН', color: 'beige' },
  { mobWorkId: 'depression', label: 'Бурение\nна депрессии', color: 'blue' },
  { mobWorkId: 'bsko', label: 'БСКО', color: 'blue' },
  { mobWorkId: 'bsko_ppd', label: 'Перевод\nв ППД', color: 'blue' },
  { mobWorkId: '3bs', label: 'ЗБС', color: 'blue' },
];

const COLOR_MAP    = { gray: '#9e9e9e', orange: '#e67e22', beige: '#c8a96e', blue: '#5b8dd9' };
const GROUP_BG     = { gray: '#f0f0f0', orange: '#ffd8b1', beige: '#f5e8d0', blue: '#c6e2ff' };
const STATUS_LABEL = { done: 'Выполнено', noWork: 'Нет работ', failed: 'Провал', noResearch: 'Нет НИР' };

// ─── Хелперы чтения fieldWork ─────────────────────────────────────────────────

const getSelectionsForYear = (fwData, year) => {
  if (!fwData) return null;
  if (fwData.selectionsByYear) return fwData.selectionsByYear[year] || null;
  if (fwData.byYear) return fwData.byYear[year]?.selections || null;
  return fwData.selections || null;
};

const getCostForYear = (fwData, year) => {
  if (!fwData) return 0;
  if (fwData.metaByYear) return fwData.metaByYear[year]?.totalCost || 0;
  if (fwData.byYear) return fwData.byYear[year]?.totalCost || 0;
  return fwData.totalCost || 0;
};

const getQualityForYear = (fwData, year) => {
  if (!fwData) return 0;
  if (fwData.metaByYear) return fwData.metaByYear[year]?.qualityScore || 0;
  if (fwData.byYear) return fwData.byYear[year]?.qualityScore || 0;
  return fwData.qualityScore || 0;
};

const getWorkedYears = (fwData) => {
  if (!fwData) return [];
  const src = fwData.selectionsByYear || (fwData.byYear
    ? Object.fromEntries(Object.entries(fwData.byYear).map(([y, d]) => [y, d?.selections]))
    : fwData.selections ? { 1: fwData.selections } : {});
  return Object.keys(src)
    .map(Number)
    .filter(y => src[y] && Object.keys(src[y]).length > 0)
    .sort((a, b) => a - b);
};

const getTotalCostAllYears = (fwData) => {
  if (!fwData) return 0;
  if (fwData.metaByYear) return Object.values(fwData.metaByYear).reduce((s, m) => s + (m?.totalCost || 0), 0);
  if (fwData.byYear) return Object.values(fwData.byYear).reduce((s, d) => s + (d?.totalCost || 0), 0);
  return fwData.totalCost || 0;
};

// ─── WorkCell ─────────────────────────────────────────────────────────────────

const WorkCell = ({ block, selections, year }) => {
  if (!block || !selections) return <div className="rp-empty-cell" />;
  const chosen = block.cards.map(card => {
    const rank = selections[card.cardId];
    if (rank == null) return null;
    const opt = card.options.find(o => o.rank === rank);
    return opt ? { title: card.cardTitle, param: opt.param, cost: opt.cost } : null;
  }).filter(Boolean);
  if (!chosen.length) return <div className="rp-empty-cell" />;
  const clr = COLOR_MAP[block.groupColor] || '#aaa';
  return (
    <div className="rp-work-cell" style={{ borderColor: clr }}>
      <div className="rp-work-cell-head" style={{ background: clr }}>
        {block.title}
        {year != null && (
          <span style={{ marginLeft: 6, fontSize: '0.68rem', opacity: 0.9, fontWeight: 600 }}>
            год {year}
          </span>
        )}
      </div>
      <div className="rp-work-cell-body">
        {chosen.map((c, i) => (
          <div key={i} className="rp-work-param">
            <div className="rp-work-param-label">{c.title}</div>
            <div className="rp-work-param-val">{c.param}</div>
          </div>
        ))}
      </div>
      <div className="rp-work-cell-cost">{chosen.reduce((s, c) => s + c.cost, 0)} млн</div>
    </div>
  );
};

// ─── MultiYearCell ────────────────────────────────────────────────────────────

const MultiYearCell = ({ block, fwData, workedYears }) => {
  if (!block || !workedYears.length) return <div className="rp-empty-cell" />;
  const yearsWithData = workedYears.filter(y => {
    const s = getSelectionsForYear(fwData, y);
    return s && block.cards.some(c => s[c.cardId] != null);
  });
  if (!yearsWithData.length) return <div className="rp-empty-cell" />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {yearsWithData.map(y => (
        <WorkCell key={y} block={block} selections={getSelectionsForYear(fwData, y)} year={y} />
      ))}
    </div>
  );
};

// ─── WaitingModal — модалка ожидания других команд ───────────────────────────

const WaitingModal = ({ year, readyCount, totalCount, isLastYear, teamNames }) => (
  <div style={{
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.82)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 4000,
  }}>
    <div style={{
      background: '#fff', borderRadius: 16, padding: '2.5rem',
      maxWidth: 480, width: '90%',
      boxShadow: '0 10px 50px rgba(0,0,0,0.4)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
      <h3 style={{ color: '#2e7d32', marginBottom: '0.5rem', fontSize: '1.4rem' }}>
        {isLastYear ? 'Ожидание завершения игры' : `Ожидание перехода к году ${year + 1}`}
      </h3>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        Ждём пока все команды завершат год {year}
      </p>

      {/* Прогресс-бар */}
      <div style={{ background: '#f0f0f0', borderRadius: 8, height: 12, marginBottom: '1rem', overflow: 'hidden' }}>
        <div style={{
          width: `${(readyCount / Math.max(totalCount, 1)) * 100}%`,
          height: '100%',
          background: '#2fa394',
          borderRadius: 8,
          transition: 'width 0.4s ease',
        }} />
      </div>

      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#333', marginBottom: '1rem' }}>
        {readyCount} / {totalCount} команд готовы
      </div>

      {/* Список готовых команд */}
      {teamNames && teamNames.length > 0 && (
        <div style={{ textAlign: 'left', background: '#f8f9fa', borderRadius: 8, padding: '0.75rem 1rem' }}>
          {teamNames.map((name, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: '0.9rem', color: '#444' }}>
              <span style={{ color: '#2fa394', fontWeight: 700 }}>✓</span>
              {name}
            </div>
          ))}
        </div>
      )}

      <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#aaa' }}>
        Переход произойдёт автоматически когда все будут готовы
      </p>
    </div>
  </div>
);

// ─── ConfirmYearModal ─────────────────────────────────────────────────────────

const ConfirmYearModal = ({ globalYear, isLastYear, onConfirm, onCancel }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
    <div style={{ background: '#fff', borderRadius: 12, padding: '2.5rem', maxWidth: 480, width: '90%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
      <h3 style={{ textAlign: 'center', color: '#2e7d32', marginBottom: '1rem', fontSize: '1.4rem' }}>
        {isLastYear ? 'Завершить игру?' : `Завершить год ${globalYear}?`}
      </h3>
      <p style={{ textAlign: 'center', color: '#555', marginBottom: '0.5rem' }}>
        {isLastYear
          ? 'Это последний год. После подтверждения игра завершится.'
          : `Все данные года ${globalYear} сохранены. Начнётся год ${globalYear + 1} с новыми исследованиями.`}
      </p>
      {!isLastYear && (
        <p style={{ textAlign: 'center', color: '#ff9800', fontWeight: 700, fontSize: '0.9rem' }}>
          Карточки событий сбросятся для нового года.
        </p>
      )}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
        <button onClick={onConfirm} style={{ flex: 1, padding: '1rem', background: isLastYear ? '#c62828' : '#2fa394', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}>
          {isLastYear ? 'Завершить игру' : `Да, перейти к году ${globalYear + 1}`}
        </button>
        <button onClick={onCancel} style={{ flex: 1, padding: '1rem', background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
          Отмена
        </button>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// ОСНОВНОЙ КОМПОНЕНТ
// ─────────────────────────────────────────────────────────────────────────────

const ResultsPanel = ({ onComplete, onBack, onMenu }) => {
  const {
    player, research, events, fieldWork, gridCells,
    advanceToNextYear, resetEventCardsForNewYear, applyYearTransitionForAllLUs,
    game, setGlobalPhase,
  } = useGameStore();

  const globalTimer    = useGameStore(s => s.globalTimer);
  const timeRemaining  = globalTimer.timeRemaining;
  const globalYear     = globalTimer?.currentYear ?? game?.currentYear ?? 1;
  const isLastYear     = globalYear >= 10;

  useEffect(() => { setGlobalPhase('RESULTS'); }, []);

  const [showConfirm, setShowConfirm] = useState(false);

  // ── Состояние ожидания других команд ─────────────────────────────────────
  const [waiting, setWaiting]           = useState(false);
  const [readyCount, setReadyCount]     = useState(0);
  const [totalCount, setTotalCount]     = useState(0);
  const [readyTeamIds, setReadyTeamIds] = useState([]);
  const [readyTeamNames, setReadyTeamNames] = useState([]);

  // Подписываемся на WS события готовности и перехода года
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onReadyStatus = ({ year, readyCount: rc, totalCount: tc, readyTeams }) => {
      setReadyCount(rc);
      setTotalCount(tc);
      setReadyTeamIds(readyTeams || []);
    };

    const onYearAdvanced = ({ year }) => {
      // Сервер перекинул всех — выполняем локальный переход
      setWaiting(false);
      const nextYear = year; // год уже обновлён через timer:state
      resetEventCardsForNewYear(nextYear);
      applyYearTransitionForAllLUs(nextYear - 1);
      advanceToNextYear();
      onComplete();
    };

    const onGameOver = () => {
      setWaiting(false);
      onComplete();
    };

    socket.on('year:ready_status', onReadyStatus);
    socket.on('year:advanced',     onYearAdvanced);
    socket.on('game:over',         onGameOver);

    return () => {
      socket.off('year:ready_status', onReadyStatus);
      socket.off('year:advanced',     onYearAdvanced);
      socket.off('game:over',         onGameOver);
    };
  }, []);

  // Формируем имена готовых команд из списка id
  // (для отображения в модалке — берём из sessionTeams если есть, иначе просто id)
  useEffect(() => {
    // Простой вариант: показываем teamId как имя, 
    // если хочется имена — нужно хранить маппинг teams в сторе
    setReadyTeamNames(readyTeamIds);
  }, [readyTeamIds]);

  const ownedLUs = Object.values(gridCells.owned).map(c => ({
    cellRef: c.cellRef,
    name: c.name || `Участок ${c.cellRef}`,
  }));

  const [activeLUId, setActiveLUId] = useState(() => ownedLUs[0]?.cellRef || null);
  const activeLU     = ownedLUs.find(l => l.cellRef === activeLUId) || ownedLUs[0] || null;
  const activeFwData = activeLU ? (fieldWork.selectionsByLU[activeLU.cellRef] || null) : null;
  const workedYears  = getWorkedYears(activeFwData);

  const blockByMobId = {};
  FIELD_WORK_BLOCKS.forEach(b => { blockByMobId[b.mobWorkId] = b; });

  const activeEv      = activeLU ? (events.lineScores?.[activeLU.cellRef] ?? 0) : 0;
  const activeCostAll = getTotalCostAllYears(activeFwData);
  const activeMob     = activeLU ? (research.progressByLU[activeLU.cellRef]?.mobilizedColumns?.length || 0) : 0;
  const activeQAvg    = workedYears.length
    ? Math.round(workedYears.reduce((s, y) => s + getQualityForYear(activeFwData, y), 0) / workedYears.length)
    : 0;

  const getLUStatus = (cellRef) => {
    const sc = events.lineScores?.[cellRef] ?? 0;
    const fw = fieldWork.selectionsByLU[cellRef];
    const rp = research.progressByLU[cellRef];
    if (sc < 0) return 'failed';
    if (getWorkedYears(fw).length > 0) return 'done';
    if (!rp?.mobilizedColumns?.length) return 'noResearch';
    return 'noWork';
  };

  const timerCls = () => {
    if (timeRemaining <= 0) return 'rp-timer rp-timer-finished';
    if (timeRemaining <= 10) return 'rp-timer rp-timer-critical';
    if (timeRemaining <= 30) return 'rp-timer rp-timer-warning';
    if (timeRemaining <= 60) return 'rp-timer rp-timer-alert';
    return 'rp-timer';
  };

  const handleFinishYear = () => setShowConfirm(true);

  const confirmFinishYear = () => {
    setShowConfirm(false);

    const socket = getSocket();
    const isOnline = !!(socket?.connected && player.sessionId);

    if (isLastYear) {
      // Последний год — для онлайна тоже через year:ready
      if (isOnline) {
        setWaiting(true);
        setReadyCount(0);
        socket.emit('year:ready', { year: globalYear }, (res) => {
          if (res) {
            setReadyCount(res.readyCount);
            setTotalCount(res.totalCount);
          }
        });
      } else {
        onComplete();
      }
      return;
    }

    if (isOnline) {
      // Онлайн: показываем ожидание, отправляем готовность на сервер
      setWaiting(true);
      setReadyCount(0);
      // Локально сохраняем прогресс (события и исследования уже сохранены через WS ранее)
      resetEventCardsForNewYear(globalYear + 1);
      applyYearTransitionForAllLUs(globalYear);

      socket.emit('year:ready', { year: globalYear }, (res) => {
        if (res) {
          setReadyCount(res.readyCount);
          setTotalCount(res.totalCount);
          // Если мы единственная команда — сервер сам пришлёт year:advanced
        }
      });
    } else {
      // Офлайн: старое поведение
      const nextYear = globalYear + 1;
      resetEventCardsForNewYear(nextYear);
      applyYearTransitionForAllLUs(globalYear);
      onComplete();
      setTimeout(() => { advanceToNextYear(); }, 0);
    }
  };

  const totalSpent = Object.values(research.progressByLU).reduce((s, p) => s + (p.totalSpent || 0), 0);

  return (
    <div className="rp-panel">

      {/* ── КНОПКИ НАВИГАЦИИ ───────────────────────────────────────────── */}
      <div className="rp-nav-controls">
        <button className="rp-nav-btn rp-nav-btn-back" onClick={onBack}>← Назад</button>
        <button className="rp-nav-btn rp-nav-btn-back" onClick={onMenu}>В меню</button>
        <button className="rp-nav-btn rp-nav-btn-finish" onClick={handleFinishYear}>
          {isLastYear ? '🏁 Завершить игру' : `✓ Завершить год ${globalYear}`}
        </button>
      </div>

      {/* ── ТАЙМЕР ──────────────────────────────────────────────────────── */}
      <div className={timerCls()}>
        <div className="rp-timer-lbl">Итоги года {globalYear}</div>
        {timeRemaining > 0
          ? <div className="rp-timer-val">{formatTime(timeRemaining)}</div>
          : <div className="rp-timer-val">—</div>}
        <div className="rp-timer-sub">
          {isLastYear ? 'Игра завершена'
            : timeRemaining > 0 ? `осталось ${formatTime(timeRemaining)}`
              : 'Время вышло'}
        </div>
      </div>

      {/* ── КАРТОЧКИ УЧАСТКОВ ───────────────────────────────────────────── */}
      <div className="rp-lu-switcher">
        <span className="rp-lu-switcher-label">Выберите участок:</span>
        <div className="rp-lu-switcher-row">
          {ownedLUs.map(lu => {
            const status       = getLUStatus(lu.cellRef);
            const isActive     = lu.cellRef === activeLUId;
            const score        = events.lineScores?.[lu.cellRef] ?? 0;
            const mob          = research.progressByLU[lu.cellRef]?.mobilizedColumns?.length || 0;
            const fw           = fieldWork.selectionsByLU[lu.cellRef];
            const fwCostBadge  = getTotalCostAllYears(fw);
            const wYears       = getWorkedYears(fw);
            return (
              <div
                key={lu.cellRef}
                onClick={() => setActiveLUId(lu.cellRef)}
                className={['rp-lu-card', isActive ? 'rp-lu-card--active' : '', `rp-lu-card--${status}`].join(' ')}
              >
                {isActive && <span className="rp-lu-check"></span>}
                <div className="rp-lu-ref">{lu.cellRef}</div>
                <div className="rp-lu-name">{lu.name}</div>
                <div className="rp-lu-badges">
                  {mob > 0 && <span className="rp-badge rp-badge-mob">{mob} НИР</span>}
                  {score !== 0 && (
                    <span className={`rp-badge ${score >= 0 ? 'rp-badge-pos' : 'rp-badge-neg'}`}>
                      {score >= 0 ? '+' : ''}{score}
                    </span>
                  )}
                  {fwCostBadge > 0 && <span className="rp-badge rp-badge-cost">{fwCostBadge} млн</span>}
                  {wYears.length > 1 && (
                    <span className="rp-badge" style={{ background: '#e8f0fe', color: '#3a5fc8', border: '1px solid #b0c4ef' }}>
                      г. {wYears.join(', ')}
                    </span>
                  )}
                </div>
                <div className="rp-lu-status-lbl">{STATUS_LABEL[status] || status}</div>
              </div>
            );
          })}
        </div>
        <br />
        <BudgetBar budget={player.budget} spent={totalSpent} theme="light" />
      </div>

      {/* ── ТАБЛИЦА ─────────────────────────────────────────────────────── */}
      {activeLU && (
        <div className="rp-table-section">
          {workedYears.length > 1 && (
            <div style={{ padding: '0 20px 6px', fontSize: '0.75rem', color: '#aaa' }}>
              Таблица показывает все годы. Итоговая строка содержит карточки за всё время.
              Ниже — строки по каждому году отдельно.
            </div>
          )}
          <div className="rp-table-scroll">
            <table className="rp-table">
              <thead>
                <tr>
                  <th className="rp-th rp-th-lu">Год / участок</th>
                  {TABLE_COLUMNS.map(col => (
                    <th
                      key={col.mobWorkId}
                      className="rp-th"
                      style={{ background: GROUP_BG[col.color], borderBottom: `3px solid ${COLOR_MAP[col.color]}` }}
                    >
                      {col.label.split('\n').map((l, i, a) => (
                        <span key={i}>{l}{i < a.length - 1 && <br />}</span>
                      ))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workedYears.length === 0 && (
                  <tr>
                    <td className="rp-td rp-td-lu">
                      <div className="rp-lu-info">
                        <div className="rp-lu-info-ref">{activeLU.cellRef}</div>
                        <div className="rp-lu-info-name">{activeLU.name}</div>
                      </div>
                    </td>
                    {TABLE_COLUMNS.map(col => (
                      <td key={col.mobWorkId} className="rp-td"><div className="rp-empty-cell" /></td>
                    ))}
                  </tr>
                )}

                {workedYears.length > 0 && (
                  <tr style={{ background: '#f8f9fa' }}>
                    <td className="rp-td rp-td-lu">
                      <div className="rp-lu-info">
                        <div className="rp-lu-info-ref">{activeLU.cellRef}</div>
                        <div className="rp-lu-info-name">{activeLU.name}</div>
                        <div className="rp-lu-info-divider" />
                        {[
                          { l: workedYears.length > 1 ? 'Итого (все годы)' : `Год ${workedYears[0]}`, v: `${activeCostAll} млн`, bold: true },
                          { l: 'Среднее качество', v: `${activeQAvg}%` },
                          { l: 'События', v: activeEv === 0 ? '—' : (activeEv >= 0 ? '+' : '') + activeEv, cls: activeEv >= 0 ? 'rp-pos' : 'rp-neg' },
                          { l: 'НИР', v: `${activeMob} кол.` },
                          ...(workedYears.length > 1 ? [{ l: 'Годы работ', v: workedYears.join(', ') }] : []),
                        ].map(({ l, v, cls, bold }) => (
                          <div key={l} className="rp-lu-info-row">
                            <span className="rp-lu-info-lbl">{l}</span>
                            <span className={`rp-lu-info-val ${cls || ''}`} style={bold ? { fontWeight: 800 } : {}}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    {TABLE_COLUMNS.map(col => {
                      const block = blockByMobId[col.mobWorkId];
                      return (
                        <td key={col.mobWorkId} className="rp-td">
                          {workedYears.length === 1
                            ? (() => {
                              const sels   = getSelectionsForYear(activeFwData, workedYears[0]);
                              const hasAny = block && sels && block.cards.some(c => sels[c.cardId] != null);
                              return hasAny
                                ? <WorkCell block={block} selections={sels} year={null} />
                                : <div className="rp-empty-cell" />;
                            })()
                            : <MultiYearCell block={block} fwData={activeFwData} workedYears={workedYears} />
                          }
                        </td>
                      );
                    })}
                  </tr>
                )}

                {workedYears.length > 1 && workedYears.map(y => {
                  const ySels  = getSelectionsForYear(activeFwData, y);
                  const yCost  = getCostForYear(activeFwData, y);
                  const yQ     = getQualityForYear(activeFwData, y);
                  const hasWork = ySels && Object.keys(ySels).length > 0;
                  if (!hasWork) return null;
                  return (
                    <tr key={y} style={{ opacity: 0.7 }}>
                      <td className="rp-td rp-td-lu">
                        <div className="rp-lu-info">
                          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#5b8dd9', marginBottom: 4 }}>Год {y}</div>
                          {[
                            { l: 'Стоимость', v: `${yCost} млн` },
                            { l: 'Качество',  v: `${yQ}%` },
                          ].map(({ l, v }) => (
                            <div key={l} className="rp-lu-info-row">
                              <span className="rp-lu-info-lbl">{l}</span>
                              <span className="rp-lu-info-val">{v}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      {TABLE_COLUMNS.map(col => {
                        const block  = blockByMobId[col.mobWorkId];
                        const hasAny = block && ySels && block.cards.some(c => ySels[c.cardId] != null);
                        return (
                          <td key={col.mobWorkId} className="rp-td">
                            {hasAny
                              ? <WorkCell block={block} selections={ySels} year={y} />
                              : <div className="rp-empty-cell" />}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ЛЕГЕНДА ─────────────────────────────────────────────────────── */}
      <div className="rp-legend">
        {[
          { color: 'gray',   label: 'СРР (сейсморазведочные работы)' },
          { color: 'orange', label: 'ГРР (геологоразведочные работы)' },
          { color: 'beige',  label: 'Бурение' },
          { color: 'blue',   label: 'Добыча' },
        ].map(({ color, label }) => (
          <div key={color} className="rp-legend-item">
            <div className="rp-legend-dot" style={{ background: COLOR_MAP[color] }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* ── МОДАЛКИ ─────────────────────────────────────────────────────── */}
      {showConfirm && (
        <ConfirmYearModal
          globalYear={globalYear} isLastYear={isLastYear}
          onConfirm={confirmFinishYear} onCancel={() => setShowConfirm(false)}
        />
      )}

      {waiting && (
        <WaitingModal
          year={globalYear}
          readyCount={readyCount}
          totalCount={totalCount}
          isLastYear={isLastYear}
          teamNames={readyTeamNames}
        />
      )}
      {/* <ResultsPanelTour globalYear={globalYear} onDone={() => {}} /> */}
    </div>
  );
};

export default ResultsPanel;