// FieldWorkPanel.jsx — локальный таймер убран, читаем globalTimer из store
import React, { useState, useEffect, useCallback } from 'react';
import { FIELD_WORK_BLOCKS, calculateTotalCost, calculateQualityScore, prepareFieldWorkForAPI } from './Fieldworkdata';
import useGameStore from '../../store/gameStore';
import styles from './FieldWorkPanel.module.css';
import BudgetBar from '../Budgetbar.jsx';
import { getSocket } from '../apiHelpers';

// ─── Утилиты ─────────────────────────────────────────────────────────────────

const fmtTime = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
};

const GRP_LBL = {
  gray: 'СРР (сейсморазведочные работы)',
  orange: 'ГРР (геологоразведочные работы)',
  beige: 'Бурение',
  blue: 'Добыча',
};
const ST_TXT = { ready: 'Готов', done: 'Выбрано', failed: 'Провал', noResearch: 'Нет НИР' };

const calcAvgRank = (selections, blocks) => {
  let sum = 0, count = 0;
  blocks.forEach(block => {
    block.cards.forEach(card => {
      const rank = selections[card.cardId];
      if (rank != null) { sum += rank; count++; }
    });
  });
  if (count === 0) return null;
  return Math.floor(sum / count);
};

// ─────────────────────────────────────────────────────────────────────────────
// КОМПОНЕНТ
// ─────────────────────────────────────────────────────────────────────────────

const FieldWorkPanel = ({ onComplete, currentLU: currentLUProp, onBack, onMenu }) => {
  const { player, gridCells, research, fieldWork, events, licenseUnits } = useGameStore();
  const { setGlobalPhase } = useGameStore();
  const globalYear = useGameStore(s => s.game.currentYear);

  // ── ГЛОБАЛЬНЫЙ ТАЙМЕР (только чтение) ─────────────────────────────────────
  const globalTimer = useGameStore(s => s.globalTimer);
  const timeRemaining = globalTimer.timeRemaining;
  const isTimerFinished = timeRemaining <= 0;

  // Объявить фазу при монтировании
  useEffect(() => {
    setGlobalPhase('FIELD_WORK');
  }, []);

  // ── Участки ───────────────────────────────────────────────────────────────

  const ownedCells = Object.values(gridCells.owned).map(c => ({
    id: c.cellRef, cellRef: c.cellRef,
    name: c.name || ('Участок ' + c.cellRef),
    auctionPrice: c.auctionPrice || 0,
  }));

  const [activeLUId, setActiveLUId] = useState(
    () => currentLUProp?.id || currentLUProp?.cellRef || ownedCells[0]?.cellRef || null
  );
  const activeLU = ownedCells.find(l => l.cellRef === activeLUId) || ownedCells[0] || null;
  const luId = activeLU?.cellRef || null;

  const researchProg = luId ? (research.progressByLU[luId] || null) : null;
  const evScore = luId ? (events.lineScores?.[luId] ?? 0) : 0;

  // Доступные блоки
  const avail = (() => {
    if (evScore < 0 || !researchProg) return [];
    const chosenColThisYear = researchProg.columnsByYear?.[globalYear];
    const mobThisYear = researchProg.mobilizedColumnsByYear?.[globalYear] || [];
    if (mobThisYear.length > 0) return FIELD_WORK_BLOCKS.filter(b => mobThisYear.includes(b.mobWorkId));
    if (chosenColThisYear) return FIELD_WORK_BLOCKS.filter(b => b.mobWorkId === chosenColThisYear);
    return [];
  })();

  // ── Selections ────────────────────────────────────────────────────────────

  const getYearSelections = useCallback((id, year) => {
    return fieldWork.selectionsByLU[id]?.selectionsByYear?.[year] || {};
  }, [fieldWork.selectionsByLU]);

  const [selections, setSelections] = useState(() => getYearSelections(luId, globalYear));
  const [pendingSelection, setPendingSelection] = useState(null); // { cardId, rank, param, cost }
  const [lockedCardIds, setLockedCardIds] = useState(new Set());

  useEffect(() => {
    setSelections(getYearSelections(luId, globalYear));
    setPendingSelection(null);
    setLockedCardIds(new Set());
  }, [luId, globalYear]);

  useEffect(() => {
    if (!luId) return;
    const tc = calculateTotalCost(selections, avail);
    const qs = calculateQualityScore(selections, avail);
    const avgRank = calcAvgRank(selections, avail);

    useGameStore.setState(st => {
      const prev = st.fieldWork.selectionsByLU[luId] || {};
      const prevByYear = prev.selectionsByYear || {};
      const prevMeta = prev.metaByYear || {};
      return {
        fieldWork: {
          ...st.fieldWork,
          selectionsByLU: {
            ...st.fieldWork.selectionsByLU,
            [luId]: {
              ...prev, selections, totalCost: tc, qualityScore: qs, avgRank,
              availableBlocks: avail.map(b => b.blockId),
              metaByYear: { ...prevMeta, [globalYear]: { totalCost: tc, qualityScore: qs, avgRank } },
            },
          },
        },
      };
    });
  }, [selections, luId, globalYear]);

  // ── Расчёты ───────────────────────────────────────────────────────────────

  const tc = calculateTotalCost(selections, avail);
  const totCards = avail.reduce((s, b) => s + b.cards.length, 0);
  const selCards = Object.keys(selections).filter(k => avail.some(b => b.cards.some(c => c.cardId === k))).length;
  const canAfford = player.budget >= tc;

  const doSelect = (cardId, rank) => setSelections(prev => ({ ...prev, [cardId]: rank }));

  // ── Сохранение на сервер ─────────────────────────────────────────────────
  // Формируем детальные данные карточек для AdminPanel
  const buildDetailedSelections = (sel, blocks) => {
    const details = [];
    blocks.forEach(block => {
      block.cards.forEach(card => {
        const chosenRank = sel[card.cardId];
        // Записываем все карточки: выбранные и нет
        const chosen = chosenRank != null
          ? card.options.find(o => o.rank === chosenRank)
          : null;
        details.push({
          blockId:      block.blockId,
          blockTitle:   block.title,
          groupColor:   block.groupColor,
          mobWorkId:    block.mobWorkId,
          cardId:       card.cardId,
          cardTitle:    card.cardTitle,
          chosenRank:   chosenRank ?? null,
          chosenParam:  chosen?.param  ?? null,
          cost:         chosen?.cost   ?? 0,
          skipped:      chosenRank == null,
          allOptions:   card.options.map(o => ({ rank: o.rank, param: o.param, cost: o.cost })),
        });
      });
    });
    return details;
  };

  const saveToServer = (sel, blocks, budgetAfter) => {
    const socket = getSocket();
    if (!socket?.connected || !player.sessionId) return;

    const totalCost     = calculateTotalCost(sel, blocks);
    const qualityScore  = calculateQualityScore(sel, blocks);
    const avgR          = calcAvgRank(sel, blocks);
    const detailedCards = buildDetailedSelections(sel, blocks);

    socket.emit('fieldwork:save', {
      luId,
      year: globalYear,
      data: {
        selections:     detailedCards,   // детальные данные для AdminPanel
        selectionsRaw:  sel,             // { cardId: rank } — быстрый доступ
        totalCost,
        qualityScore,
        avgRank:        avgR,
        budgetAfter:    budgetAfter ?? useGameStore.getState().player.budget,
        availableBlocks: blocks.map(b => b.blockId),
        completed:      true,
      },
    }, (res) => {
      if (!res?.ok) console.warn('fieldwork:save failed:', res?.error);
      else console.log(`🏕 fieldwork:save ok — год ${globalYear} ЛУ ${luId} cost=${totalCost}`);
    });
  };

  // Вызывается автоматически когда все карточки ЛУ подтверждены
  const autoSave = (confirmedSelections) => {
    const cost = calculateTotalCost(confirmedSelections, avail);
    const newBudget = player.budget - cost;

    useGameStore.setState(st => {
      const prev = st.fieldWork.selectionsByLU[luId] || {};
      return {
        player: { ...st.player, budget: newBudget },
        fieldWork: {
          ...st.fieldWork,
          totalSpent: (st.fieldWork.totalSpent || 0) + cost,
          totalSpentByYear: {
            ...st.fieldWork.totalSpentByYear,
            [globalYear]: (st.fieldWork.totalSpentByYear?.[globalYear] || 0) + cost,
          },
          selectionsByLU: {
            ...st.fieldWork.selectionsByLU,
            [luId]: {
              ...prev,
              selectionsByYear: { ...(prev.selectionsByYear || {}), [globalYear]: confirmedSelections },
            },
          },
        },
      };
    });

    saveToServer(confirmedSelections, avail, newBudget);
  };

  const getStatus = (cellRef) => {
    const p = research.progressByLU[cellRef];
    const sc = events.lineScores?.[cellRef] ?? 0;
    const yearSel = fieldWork.selectionsByLU[cellRef]?.selectionsByYear?.[globalYear];
    if (sc < 0) return 'failed';
    if (yearSel && Object.keys(yearSel).length > 0) return 'done';
    if (!p || !(p.mobilizedColumns?.length)) return 'noResearch';
    return 'ready';
  };

  const allFieldWorkDone = ownedCells.every(lu => getStatus(lu.cellRef) !== 'ready');
  const isLocked = luId ? getStatus(luId) === 'done' : false;

  const handleBack = useCallback(() => {
    if (onBack) onBack();
    else console.warn('onBack callback not provided');
  }, [onBack]);

  // Карточки перемешиваются один раз при монтировании
  const [shuffledOptions] = useState(() => {
    const map = {};
    FIELD_WORK_BLOCKS.forEach(block => {
      block.cards.forEach(card => {
        const a = [...card.options];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        map[card.cardId] = a;
      });
    });
    return map;
  });

  const totalSpent =
    Object.values(research.progressByLU).reduce((s, p) => s + (p.totalSpent || 0), 0) +
    (fieldWork.totalSpent || 0) +
    (events.totalMoneySpent || 0) +
    (licenseUnits?.owned ?? []).reduce((s, lu) => s + (lu.cost || 0), 0) +
    Object.values(gridCells?.owned ?? {}).reduce((s, c) => s + (c.auctionPrice || 0), 0);

  // ── CSS класс таймера ─────────────────────────────────────────────────────
  const timerCls = () => {
    if (isTimerFinished) return styles.timer + ' ' + styles.timerFinished;
    const t = timeRemaining;
    if (t <= 30) return styles.timer + ' ' + styles.timerCritical;
    if (t <= 120) return styles.timer + ' ' + styles.timerWarning;
    if (t <= 300) return styles.timer + ' ' + styles.timerAlert;
    return styles.timer;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // РЕНДЕР
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.panel}>
      {/* ── КНОПКИ НАВИГАЦИИ ── */}
      <div className={styles.researchMapControls}>
        <button className={`${styles.researchControlBtn} ${styles.researchBackBtn}`} onClick={handleBack}>
          ← Назад
        </button>
        <button className={`${styles.researchControlBtn} ${styles.researchBackBtn}`} onClick={onMenu}>
          В меню
        </button>
        <button
          className={`${styles.researchControlBtn} ${styles.researchNextBtn}`}
          onClick={onComplete}
          disabled={!allFieldWorkDone}
          title={!allFieldWorkDone ? 'Завершите полевые работы на всех участках' : undefined}
        >
          Далее — К результатам
        </button>
      </div>

      {/* ── ГЛОБАЛЬНЫЙ ТАЙМЕР ── */}
      <div className={timerCls()}>
        {isTimerFinished ? (
          <>
            <div className={styles.timerLabel}>Время истекло</div>
            <div className={styles.timerSub}>Полевые работы</div>
          </>
        ) : (
          <>
            <div className={styles.timerLabel}>Глобальный таймер</div>
            <div className={styles.timerValue}>{fmtTime(timeRemaining)}</div>
            <div className={styles.timerSub}>Год {globalTimer.currentYear}</div>
          </>
        )}
      </div>

      {/* ── ВЫБОР УЧАСТКА ── */}
      <div className={styles.luSection}>
        <div className={styles.luSectionLabel}>Шаг 1. Выберите участок:</div>
        <div className={styles.luCardsRow}>
          {ownedCells.map(lu => {
            const status = getStatus(lu.cellRef);
            const isActive = lu.cellRef === activeLUId;
            const fw = fieldWork.selectionsByLU[lu.cellRef];
            const score = events.lineScores?.[lu.cellRef] ?? 0;
            const mob = (research.progressByLU[lu.cellRef]?.mobilizedColumnsByYear?.[globalYear] || []).length
              || (research.progressByLU[lu.cellRef]?.mobilizedColumns || []).length;
            const yearMeta = fw?.metaByYear?.[globalYear];
            return (
              <div key={lu.cellRef} onClick={() => setActiveLUId(lu.cellRef)}
                className={[styles.luCard, isActive ? styles.luCardActive : '', styles['luSt_' + status]].join(' ')}>
                <div className={styles.luCardRef}>{lu.cellRef}</div>
                <div className={styles.luCardName}>{lu.name}</div>
                <div className={styles.luCardMeta}>
                  {mob > 0 && <span className={styles.metaMob}>{mob} НИР</span>}
                  {score !== 0 && (
                    <span className={[styles.metaScore, score >= 0 ? styles.metaPos : styles.metaNeg].join(' ')}>
                      {score >= 0 ? '+' : ''}{score}
                    </span>
                  )}
                  {yearMeta?.totalCost > 0 && <span className={styles.metaCost}>{yearMeta.totalCost} млн</span>}
                </div>
                <div className={styles.luCardStatus}>{ST_TXT[status]}</div>
              </div>
            );
          })}
        </div>

        <BudgetBar
          budget={player.budget}
          spent={totalSpent}
          phaseSpent={fieldWork.totalSpentByYear?.[globalYear] || 0}
          theme="dark"
        />

        {activeLU && (
          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <span className={styles.statLbl}>Карточки</span>
              <span className={styles.statVal}>{selCards} из {totCards}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLbl}>Стоимость</span>
              <span className={[styles.statVal, canAfford ? styles.ok : styles.fail].join(' ')}>{tc} млн руб.</span>
            </div>
            {isLocked && <div className={styles.lockedBadge}>✓ Работы сохранены</div>}
          </div>
        )}
      </div>

      {/* ── ОБЛАСТЬ КАРТОЧЕК ── */}
      <div className={styles.fieldArea}>
        {!activeLU ? (
          <div className={styles.emptyMsg}>Выберите участок выше</div>
        ) : avail.length === 0 ? (
          <div className={styles.emptyMsg}>
            {evScore < 0
              ? 'Провал в зоне событий (счёт ' + evScore + ') — полевые работы недоступны для участка ' + activeLU.cellRef
              : !researchProg || !(researchProg.mobilizedColumns?.length)
                ? 'Для участка ' + activeLU.cellRef + ' не проводились научные исследования.'
                : 'Нет доступных блоков работ для года ' + globalYear}
          </div>
        ) : (
          avail.map(block => (
            <div key={block.blockId} className={[styles.blockCol, styles['grp_' + block.groupColor]].join(' ')}>
              <div className={styles.blockHead}>
                <div className={[styles.blockDot, styles['dotClr_' + block.groupColor]].join(' ')} />
                <div className={styles.blockHeadText}>
                  <span className={styles.blockName}>{block.title}</span>
                  <span className={styles.blockGrpLbl}>{GRP_LBL[block.groupColor]}</span>
                </div>
              </div>
              <div className={styles.blockCards}>
                {block.cards.map(card => {
                  const chosen = selections[card.cardId];
                  const cardLocked = isLocked || lockedCardIds.has(card.cardId);
                  return (
                    <div key={card.cardId}
                      className={[styles.card, styles['cardGrp_' + block.groupColor], chosen ? styles.cardHasSel : styles.cardNoSel, cardLocked ? styles.cardConfirmed : ''].join(' ')}>
                      <div className={styles.cardTitle}>
                        {card.cardTitle}
                        {cardLocked && <span className={styles.cardLockedMark}>✓ выбрано</span>}
                      </div>
                      <div className={styles.cardOpts}>
                        {(shuffledOptions[card.cardId] || card.options).map(opt => {
                          const cardLocked = isLocked || lockedCardIds.has(card.cardId);
                          return (
                            <button key={opt.rank}
                              className={[styles.optBtn, chosen === opt.rank ? styles.optSel : '', cardLocked ? styles.optLocked : ''].join(' ')}
                              onClick={() => !cardLocked && setPendingSelection({ cardId: card.cardId, rank: opt.rank, param: opt.param, cost: opt.cost, cardTitle: card.cardTitle })}
                              disabled={cardLocked}>
                              <div className={styles.optDescBlock}>
                                <div className={styles.optDesc}>{opt.param}</div>
                              </div>
                              <div className={styles.optCostBadge}>
                                {opt.cost > 0 ? opt.cost + ' млн' : 'Бесплатно'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── НИЖНЯЯ ПАНЕЛЬ ПОДТВЕРЖДЕНИЯ ── */}
      {activeLU && avail.length > 0 && (
        <div className={styles.bottomBar}>
          <div className={styles.bottomInfo}>
            {!canAfford && <span className={styles.warnRed}>Недостаточно бюджета — </span>}
            {canAfford && selCards < totCards && (
              <span className={styles.warnOrange}>
                {selCards === 0 ? 'Выберите работу по каждой карточке — ' : `Осталось ${totCards - selCards} карточки без выбора — `}
              </span>
            )}
            Выбрано {selCards} из {totCards} карточек
          </div>
        </div>
      )}

      {/* ── МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ КАРТОЧКИ ── */}
      {pendingSelection && (
        <div className={styles.modalOverlay} onClick={() => setPendingSelection(null)}>
          <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>Подтвердить выбор работы?</div>
            <div className={styles.modalBody}>
              <div className={styles.modalRow}>
                <span className={styles.modalLbl}>Карточка</span>
                <span className={styles.modalVal}>{pendingSelection.cardTitle}</span>
              </div>
              <div className={styles.modalRow}>
                <span className={styles.modalLbl}>Работа</span>
                <span className={styles.modalVal}>{pendingSelection.param}</span>
              </div>
              <div className={styles.modalRow}>
                <span className={styles.modalLbl}>Стоимость</span>
                <span className={styles.modalVal}>
                  {pendingSelection.cost > 0 ? `${pendingSelection.cost} млн руб.` : 'Бесплатно'}
                </span>
              </div>
            </div>
            <div className={styles.modalWarn}>
              После подтверждения изменить выбор по этой карточке нельзя
            </div>
            <div className={styles.modalActions}>
              <button className={styles.modalCancelBtn} onClick={() => setPendingSelection(null)}>
                Отмена
              </button>
              <button className={styles.modalConfirmBtn} onClick={() => {
                const newSelections = { ...selections, [pendingSelection.cardId]: pendingSelection.rank };
                const newLockedIds  = new Set([...lockedCardIds, pendingSelection.cardId]);
                setSelections(newSelections);
                setLockedCardIds(newLockedIds);
                setPendingSelection(null);
                if (newLockedIds.size >= totCards) {
                  autoSave(newSelections);
                }
              }}>
                Да, подтвердить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldWorkPanel;