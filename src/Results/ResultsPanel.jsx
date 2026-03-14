import React, { useState, useEffect, useRef } from 'react';
import './ResultsPanel.css';
import useGameStore from '../../store/gameStore';
import { FIELD_WORK_BLOCKS } from '../FieldWork/fieldWorkData';
import BudgetBar from '../BudgetBar.jsx';


const RESULTS_DURATION = 2 * 60;

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

const COLOR_MAP = { gray: '#9e9e9e', orange: '#e67e22', beige: '#c8a96e', blue: '#5b8dd9' };
const GROUP_BG = { gray: '#f0f0f0', orange: '#ffd8b1', beige: '#f5e8d0', blue: '#c6e2ff' };

const STATUS_LABEL = {
  done: 'Выполнено',
  noWork: 'Нет работ',
  failed: 'Провал',
  noResearch: 'Нет НИР',
};


const WorkCell = ({ block, selections }) => {
  if (!block || !selections) return <div className="rp-empty-cell" />;

  const chosen = block.cards
    .map(card => {
      const rank = selections[card.cardId];
      if (rank == null) return null;
      const opt = card.options.find(o => o.rank === rank);
      return opt ? { title: card.cardTitle, param: opt.param, cost: opt.cost } : null;
    })
    .filter(Boolean);

  if (!chosen.length) return <div className="rp-empty-cell" />;

  const clr = COLOR_MAP[block.groupColor] || '#aaa';
  return (
    <div className="rp-work-cell" style={{ borderColor: clr }}>
      <div className="rp-work-cell-head" style={{ background: clr }}>{block.title}</div>
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


const YearSummaryScreen = ({
  globalYear, ownedLUs, research, events, fieldWork, player,
  onFinishYear, onBack, isLastYear,
}) => {
  const totResearch = Object.values(research.progressByLU || {})
    .reduce((s, d) => s + (d.totalSpent || 0), 0);
  const totField = Object.values(fieldWork.selectionsByLU || {})
    .reduce((s, d) => s + (d.totalCost || 0), 0);

  return (
    <div className="rp-panel">
      <div className="rp-topbar">
        <div className="rp-topbar-l">
          <button className="rp-btn-back" onClick={onBack}>← К детальным итогам</button>
          <span className="rp-topbar-title">Сводка — год {globalYear}</span>
        </div>
        <div className="rp-topbar-r">
          <span className="rp-budget">{player.budget} млн руб.</span>
          <button
            className="rp-btn-finish-year"
            onClick={onFinishYear}
          >
            {isLastYear ? '🏁 Завершить игру' : `✓ Завершить год ${globalYear} → год ${globalYear + 1}`}
          </button>
        </div>
      </div>

      <div className="rp-summary">
        {[
          { l: 'Год', v: `${globalYear} / 10` },
          { l: 'НИРы', v: `${totResearch} млн` },
          { l: 'Полевые работы', v: `${totField} млн` },
          { l: 'Потрачено', v: `${totResearch + totField} млн`, c: 'rp-spent' },
          { l: 'Участков', v: String(ownedLUs.length) },
        ].map(({ l, v, c }) => (
          <div key={l} className="rp-sum-item">
            <span className="rp-sum-lbl">{l}</span>
            <span className={`rp-sum-val ${c || ''}`}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#333', marginBottom: 4 }}>
          Результаты по участкам:
        </div>

        {ownedLUs.map(lu => {
          const evScore = events.lineScores?.[lu.cellRef] ?? 0;
          const fwData = fieldWork.selectionsByLU[lu.cellRef];
          const nirData = research.progressByLU[lu.cellRef];
          const nirCount = (nirData?.purchasedWorks || []).length;
          const fwCost = fwData?.totalCost || 0;
          const nirCost = nirData?.totalSpent || 0;
          const quality = fwData?.qualityScore || 0;
          const mobCols = nirData?.mobilizedColumns?.length || 0;
          const hasWork = fwCost > 0;
          const failed = evScore < 0;

          return (
            <div key={lu.cellRef} style={{
              background: '#fff', borderRadius: 12,
              border: `2px solid ${failed ? '#e53935' : hasWork ? '#2e7d32' : '#ddd'}`,
              padding: '14px 18px',
              boxShadow: '0 2px 8px rgba(0,0,0,.07)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#111' }}>{lu.cellRef}</span>
                  <span style={{ marginLeft: 10, color: '#666', fontSize: '0.9rem' }}>{lu.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {evScore !== 0 && (
                    <span style={{
                      padding: '3px 10px', borderRadius: 6, fontWeight: 800, fontSize: '0.9rem',
                      background: evScore >= 0 ? '#e8f5e9' : '#ffebee',
                      color: evScore >= 0 ? '#2e7d32' : '#c62828',
                      border: `1.5px solid ${evScore >= 0 ? '#a5d6a7' : '#ef9a9a'}`,
                    }}>
                      События: {evScore >= 0 ? `+${evScore}` : evScore}
                    </span>
                  )}
                  <span style={{
                    padding: '3px 10px', borderRadius: 6, fontWeight: 700, fontSize: '0.82rem',
                    background: hasWork ? '#e8f5e9' : '#f5f5f5',
                    color: hasWork ? '#2e7d32' : '#aaa',
                  }}>
                    {hasWork ? 'Работы выполнены' : 'Нет полевых работ'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {[
                  { l: 'НИРы куплено', v: `${nirCount} шт.` },
                  { l: 'НИР стоимость', v: `${nirCost} млн` },
                  { l: 'Полевые работы', v: `${fwCost} млн` },
                  { l: 'Качество', v: `${quality}%` },
                  { l: 'Мобилизовано кол.', v: `${mobCols}` },
                  { l: 'ИТОГО расходов', v: `${nirCost + fwCost} млн`, bold: true },
                ].map(({ l, v, bold }) => (
                  <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: '#aaa', fontWeight: 600, letterSpacing: '.04em' }}>{l}</span>
                    <span style={{ fontSize: bold ? '1rem' : '0.9rem', fontWeight: bold ? 800 : 700, color: bold ? '#c62828' : '#333', fontFamily: 'monospace' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <button
            className="rp-btn-finish-year"
            onClick={onFinishYear}
            style={{ fontSize: '1.1rem', padding: '14px 40px' }}
          >
            {isLastYear ? '🏁 Завершить игру' : `✓ Завершить год ${globalYear} → год ${globalYear + 1}`}
          </button>
        </div>
      </div>
    </div>
  );
};


const ConfirmYearModal = ({ globalYear, isLastYear, onConfirm, onCancel }) => (
  <div style={{
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 3000,
  }}>
    <div style={{
      background: '#fff', borderRadius: 12, padding: '2.5rem',
      maxWidth: 480, width: '90%',
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
    }}>
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
        <button
          onClick={onConfirm}
          style={{
            flex: 1, padding: '1rem',
            background: isLastYear ? '#c62828' : '#2fa394',
            color: '#fff', border: 'none', borderRadius: 8,
            fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer',
          }}
        >
          {isLastYear ? 'Завершить игру' : `Да, перейти к году ${globalYear + 1}`}
        </button>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: '1rem',
            background: '#f0f0f0', color: '#333',
            border: 'none', borderRadius: 8,
            fontWeight: 700, cursor: 'pointer',
          }}
        >
          Отмена
        </button>
      </div>
    </div>
  </div>
);


const ResultsPanel = ({ onComplete, onBack, onMenu }) => {
  const {
    player, research, events, fieldWork, gridCells,
    advanceToNextYear, resetEventCardsForNewYear,
    game, globalTimer,
  } = useGameStore();

  const globalYear = globalTimer?.currentYear ?? game?.currentYear ?? 1;
  const isLastYear = globalYear >= 10;

  const [timeRemaining, setTimeRemaining] = useState(RESULTS_DURATION);
  const [showSummary, setShowSummary] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timeRemaining <= 0) {
      setShowSummary(true);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeRemaining(p => {
        if (p <= 1) {
          clearInterval(timerRef.current);
          setShowSummary(true);
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const ownedLUs = Object.values(gridCells.owned).map(c => ({
    cellRef: c.cellRef,
    name: c.name || `Участок ${c.cellRef}`,
  }));

  const [activeLUId, setActiveLUId] = useState(() => ownedLUs[0]?.cellRef || null);
  const activeLU = ownedLUs.find(l => l.cellRef === activeLUId) || ownedLUs[0] || null;

  const blockByMobId = {};
  (FIELD_WORK_BLOCKS || []).forEach(b => { blockByMobId[b.mobWorkId] = b; });

  const totResearch = Object.values(research.progressByLU || {}).reduce((s, d) => s + (d.totalSpent || 0), 0);
  const totField = Object.values(fieldWork.selectionsByLU || {}).reduce((s, d) => s + (d.totalCost || 0), 0);
  const totEvents = Object.values(events.lineScores || {}).reduce((s, v) => s + v, 0);

  const activeSels = activeLU ? (fieldWork.selectionsByLU[activeLU.cellRef]?.selections || null) : null;
  const activeEv = activeLU ? (events.lineScores?.[activeLU.cellRef] ?? 0) : 0;
  const activeCost = activeLU ? (fieldWork.selectionsByLU[activeLU.cellRef]?.totalCost || 0) : 0;
  const activeQ = activeLU ? (fieldWork.selectionsByLU[activeLU.cellRef]?.qualityScore || 0) : 0;
  const activeMob = activeLU ? (research.progressByLU[activeLU.cellRef]?.mobilizedColumns?.length || 0) : 0;

  const getLUStatus = (cellRef) => {
    const sc = events.lineScores?.[cellRef] ?? 0;
    const fw = fieldWork.selectionsByLU[cellRef];
    const rp = research.progressByLU[cellRef];
    if (sc < 0) return 'failed';
    if (fw?.selections && Object.keys(fw.selections).length) return 'done';
    if (!rp?.mobilizedColumns?.length) return 'noResearch';
    return 'noWork';
  };

  const timerCls = () => {
    if (timeRemaining <= 10) return 'rp-timer rp-timer-critical';
    if (timeRemaining <= 30) return 'rp-timer rp-timer-warning';
    if (timeRemaining <= 60) return 'rp-timer rp-timer-alert';
    return 'rp-timer';
  };

  const handleFinishYear = () => {
    setShowConfirm(true);
  };

  const confirmFinishYear = () => {
    setShowConfirm(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (isLastYear) {
      onComplete();
      return;
    }

    resetEventCardsForNewYear(globalYear + 1);

    advanceToNextYear();

    onComplete();
  };

  const cancelFinishYear = () => setShowConfirm(false);

  if (showSummary) {
    return (
      <>
        <YearSummaryScreen
          globalYear={globalYear}
          ownedLUs={ownedLUs}
          research={research}
          events={events}
          fieldWork={fieldWork}
          player={player}
          onFinishYear={handleFinishYear}
          onBack={() => setShowSummary(false)}
          isLastYear={isLastYear}
        />
        {showConfirm && (
          <ConfirmYearModal
            globalYear={globalYear}
            isLastYear={isLastYear}
            onConfirm={confirmFinishYear}
            onCancel={cancelFinishYear}
          />
        )}
      </>
    );
  }
  const totalSpent = Object.values(research.progressByLU)
    .reduce((s, p) => s + (p.totalSpent || 0), 0);
  return (
    <div className="rp-panel">

      <div className={timerCls()}>
        <div className="rp-timer-lbl">Итоги года {globalYear}</div>
        <div className="rp-timer-val">{formatTime(timeRemaining)}</div>
        <div className="rp-timer-sub">
          {isLastYear ? 'Игра завершена' : `Сводка откроется через ${formatTime(timeRemaining)}`}
        </div>
      </div>

      <div className="rp-topbar">
        <div className="rp-topbar-l">
          <button className="rp-btn-back" onClick={onMenu}>В меню</button>
          <span className="rp-topbar-title">Итоги {globalYear} года</span>
        </div>
        <div className="rp-topbar-r">
          <span className="rp-budget">{player.budget} млн руб.</span>
          <button className="rp-btn-next" onClick={() => {
            clearInterval(timerRef.current);
            setShowSummary(true);
          }}>
            Сводка →
          </button>
          <button className="rp-btn-finish-year" onClick={handleFinishYear}>
            {isLastYear ? '🏁 Завершить игру' : `✓ Завершить год ${globalYear}`}
          </button>
        </div>
      </div>


      <div className="rp-summary">
        {[
          { l: 'НИРы', v: `${totResearch} млн`, c: '' },
          { l: 'Полевые работы', v: `${totField} млн`, c: '' },
          { l: 'События (все)', v: `${totEvents >= 0 ? '+' : ''}${totEvents}`, c: totEvents >= 0 ? 'rp-pos' : 'rp-neg' },
          { l: 'Потрачено', v: `${totResearch + totField} млн`, c: 'rp-spent' },
          { l: 'Участков', v: String(ownedLUs.length), c: '' },
        ].map(({ l, v, c }) => (
          <div key={l} className="rp-sum-item">
            <span className="rp-sum-lbl">{l}</span>
            <span className={`rp-sum-val ${c}`}>{v}</span>
          </div>
        ))}
      </div>

      <div className="rp-lu-switcher">
        <span className="rp-lu-switcher-label">Выберите участок:</span>
        <div className="rp-lu-switcher-row">
          {ownedLUs.map(lu => {
            const status = getLUStatus(lu.cellRef);
            const isActive = lu.cellRef === activeLUId;
            const score = events.lineScores?.[lu.cellRef] ?? 0;
            const mob = research.progressByLU[lu.cellRef]?.mobilizedColumns?.length || 0;
            const fw = fieldWork.selectionsByLU[lu.cellRef];

            return (
              <div
                key={lu.cellRef}
                onClick={() => setActiveLUId(lu.cellRef)}
                className={['rp-lu-card', isActive ? 'rp-lu-card--active' : '', `rp-lu-card--${status}`].join(' ')}
              >
                {isActive && <span className="rp-lu-check">✓ </span>}
                <div className="rp-lu-ref">{lu.cellRef}</div>
                <div className="rp-lu-name">{lu.name}</div>
                <div className="rp-lu-badges">
                  {mob > 0 && <span className="rp-badge rp-badge-mob">{mob} НИР</span>}
                  {score !== 0 && <span className={`rp-badge ${score >= 0 ? 'rp-badge-pos' : 'rp-badge-neg'}`}>{score >= 0 ? '+' : ''}{score}</span>}
                  {fw?.totalCost > 0 && <span className="rp-badge rp-badge-cost">{fw.totalCost}млн</span>}
                </div>
                <div className="rp-lu-status-lbl">{STATUS_LABEL[status] || status}</div>
              </div>
            );
          })}
        </div>
        <br></br>
        <BudgetBar budget={player.budget} spent={totalSpent} theme="light" />
      </div>

      {activeLU && (
        <div className="rp-table-section">
          <div className="rp-table-scroll">
            <table className="rp-table">
              <thead>
                <tr>
                  <th className="rp-th rp-th-lu">№ участка</th>
                  {TABLE_COLUMNS.map(col => (
                    <th
                      key={col.mobWorkId}
                      className="rp-th"
                      style={{
                        background: GROUP_BG[col.color],
                        borderBottom: `3px solid ${COLOR_MAP[col.color]}`,
                      }}
                    >
                      {col.label.split('\n').map((l, i, a) => (
                        <span key={i}>{l}{i < a.length - 1 && <br />}</span>
                      ))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="rp-td rp-td-lu">
                    <div className="rp-lu-info">
                      <div className="rp-lu-info-ref">{activeLU.cellRef}</div>
                      <div className="rp-lu-info-name">{activeLU.name}</div>
                      <div className="rp-lu-info-divider" />
                      <div className="rp-lu-info-row">
                        <span className="rp-lu-info-lbl">Работы</span>
                        <span className="rp-lu-info-val">{activeCost} млн</span>
                      </div>
                      <div className="rp-lu-info-row">
                        <span className="rp-lu-info-lbl">Качество</span>
                        <span className="rp-lu-info-val">{activeQ}%</span>
                      </div>
                      <div className="rp-lu-info-row">
                        <span className="rp-lu-info-lbl">События</span>
                        <span className={`rp-lu-info-val ${activeEv >= 0 ? 'rp-pos' : 'rp-neg'}`}>
                          {activeEv === 0 ? '—' : (activeEv >= 0 ? '+' : '') + activeEv}
                        </span>
                      </div>
                      <div className="rp-lu-info-row">
                        <span className="rp-lu-info-lbl">НИР</span>
                        <span className="rp-lu-info-val">{activeMob} кол.</span>
                      </div>
                    </div>
                  </td>
                  {TABLE_COLUMNS.map(col => {
                    const block = blockByMobId[col.mobWorkId];
                    const hasAny = block && activeSels && block.cards.some(c => activeSels[c.cardId] != null);
                    return (
                      <td key={col.mobWorkId} className="rp-td">
                        {hasAny
                          ? <WorkCell block={block} selections={activeSels} />
                          : <div className="rp-empty-cell" />}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rp-legend">
        {[
          { color: 'gray', label: 'СРР (сейсморазведочные работы)' },
          { color: 'orange', label: 'ГРР (геологоразведочные работы)' },
          { color: 'beige', label: 'Бурение' },
          { color: 'blue', label: 'Добыча' },
        ].map(({ color, label }) => (
          <div key={color} className="rp-legend-item">
            <div className="rp-legend-dot" style={{ background: COLOR_MAP[color] }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {showConfirm && (
        <ConfirmYearModal
          globalYear={globalYear}
          isLastYear={isLastYear}
          onConfirm={confirmFinishYear}
          onCancel={cancelFinishYear}
        />
      )}
    </div>
  );
};

export default ResultsPanel;