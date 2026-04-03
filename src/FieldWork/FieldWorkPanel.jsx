import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FIELD_WORK_BLOCKS, calculateTotalCost, calculateQualityScore, prepareFieldWorkForAPI } from './Fieldworkdata';
import useGameStore from '../../store/gameStore';
import GlobalTimer from '../GlobalTimer';
import styles from './FieldWorkPanel.module.css';
import BudgetBar from '../Budgetbar.jsx';
import { getSocket } from '../apiHelpers';



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


const FieldWorkPanel = ({ onComplete, currentLU: currentLUProp, onBack, onMenu }) => {
  const { player, gridCells, research, fieldWork, events, licenseUnits,
    resetEventCardsForNewYear, applyYearTransitionForAllLUs, advanceToNextYear,
    setNavigateToRefusal,
  } = useGameStore();
  const { setGlobalPhase } = useGameStore();
  const globalYear = useGameStore(s => s.game.currentYear);
  const timeRemaining = useGameStore(s => s.globalTimer.timeRemaining);
  const isLastYear = globalYear >= 10;


  useEffect(() => {
    setGlobalPhase('FIELD_WORK');
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onYearAdvanced = ({ year }) => {
      setWaiting(false);
      resetEventCardsForNewYear(year);
      applyYearTransitionForAllLUs(year - 1);
      onComplete();
    };

    const onReadyStatus = ({ readyCount: rc, totalCount: tc }) => {
      setReadyCount(rc);
      setTotalCount(tc);
    };

    const onGameOver = () => {
      setWaiting(false);
      onComplete();
    };

    socket.on('year:advanced', onYearAdvanced);
    socket.on('year:ready_status', onReadyStatus);
    socket.on('game:over', onGameOver);

    return () => {
      socket.off('year:advanced', onYearAdvanced);
      socket.off('year:ready_status', onReadyStatus);
      socket.off('game:over', onGameOver);
    };
  }, []);

  useEffect(() => {
    if (timeRemaining > 0) return;
    if (showYearEndModal || waiting) return;
    if ([3, 5].includes(globalYear)) { setNavigateToRefusal(true); return; }
    setShowYearEndModal(true);
  }, [timeRemaining]);

  const confirmNextYear = () => {
    setShowYearEndModal(false);
    const socket = getSocket();
    const isOnline = !!(socket?.connected && player.sessionId);
    if (isOnline) {
      setWaiting(true);
      setReadyCount(0);
      socket.emit('year:ready', { year: globalYear }, (res) => {
        if (res) { setReadyCount(res.readyCount); setTotalCount(res.totalCount); }
      });
    } else {
      const nextYear = globalYear + 1;
      resetEventCardsForNewYear(nextYear);
      applyYearTransitionForAllLUs(globalYear);
      onComplete();
      setTimeout(() => advanceToNextYear(), 0);
    }
  };


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

  const avail = (() => {
    if (evScore < 0 || !researchProg) return [];
    const chosenColThisYear = researchProg.columnsByYear?.[globalYear];
    const mobThisYear = researchProg.mobilizedColumnsByYear?.[globalYear] || [];
    if (mobThisYear.length > 0) return FIELD_WORK_BLOCKS.filter(b => mobThisYear.includes(b.mobWorkId));
    if (chosenColThisYear) return FIELD_WORK_BLOCKS.filter(b => b.mobWorkId === chosenColThisYear);
    return [];
  })();


  const getYearSelections = useCallback((id, year) => {
    return fieldWork.selectionsByLU[id]?.selectionsByYear?.[year] || {};
  }, [fieldWork.selectionsByLU]);

  const [selections, setSelections] = useState(() => getYearSelections(luId, globalYear));
  const [pendingSelection, setPendingSelection] = useState(null);
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


  const tc = calculateTotalCost(selections, avail);
  const totCards = avail.reduce((s, b) => s + b.cards.length, 0);
  const selCards = Object.keys(selections).filter(k => avail.some(b => b.cards.some(c => c.cardId === k))).length;
  const canAfford = player.budget >= tc;

  const doSelect = (cardId, rank) => setSelections(prev => ({ ...prev, [cardId]: rank }));

  const buildDetailedSelections = (sel, blocks) => {
    const details = [];
    blocks.forEach(block => {
      block.cards.forEach(card => {
        const chosenRank = sel[card.cardId];
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
        selections:     detailedCards,
        selectionsRaw:  sel,
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

    setSavedToast(true);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setSavedToast(false), 2500);
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
  const doneLUs = ownedCells.filter(lu => getStatus(lu.cellRef) === 'done').length;

  // ЛУ считается «есть реальная работа» только если статус ready И есть блоки для этого года
  const isLUWorkable = (cellRef) => {
    if (getStatus(cellRef) !== 'ready') return false;
    const resP = research.progressByLU[cellRef];
    const sc = events.lineScores?.[cellRef] ?? 0;
    if (sc < 0 || !resP) return false;
    const mobThisYear = resP.mobilizedColumnsByYear?.[globalYear] || [];
    if (mobThisYear.length > 0) return FIELD_WORK_BLOCKS.some(b => mobThisYear.includes(b.mobWorkId));
    const chosenCol = resP.columnsByYear?.[globalYear];
    return !!chosenCol && FIELD_WORK_BLOCKS.some(b => b.mobWorkId === chosenCol);
  };
  const canProceed = allFieldWorkDone || !ownedCells.some(lu => isLUWorkable(lu.cellRef));
  const isLocked = luId ? getStatus(luId) === 'done' : false;

  const handleBack = useCallback(() => {
    if (onBack) onBack();
    else console.warn('onBack callback not provided');
  }, [onBack]);

  const [savedToast, setSavedToast] = useState(false);
  const toastTimerRef = useRef(null);

  const [showYearEndModal, setShowYearEndModal] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

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



  return (
    <div className={styles.panel}>
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
          disabled={!canProceed}
          title={!canProceed ? 'Завершите полевые работы на всех участках' : undefined}
        >
          Далее — К результатам
        </button>
      </div>

      <GlobalTimer />

      <div className={styles.luSection}>
        <div className={styles.luSectionLabel}>
          Шаг 1. Выберите участок:
          <span className={styles.progressBadge}>{doneLUs} / {ownedCells.length} ЛУ завершено</span>
        </div>
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
                {status === 'ready' && (() => {
                  const yearSel = fieldWork.selectionsByLU[lu.cellRef]?.selectionsByYear?.[globalYear];
                  const selCount = yearSel ? Object.keys(yearSel).length : 0;
                  return selCount > 0
                    ? <div className={styles.cardCountBadge}>{selCount} карт. выбрано</div>
                    : null;
                })()}
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

      <div className={styles.fieldArea}>
        {!activeLU ? (
          <div className={styles.emptyMsg}>Выберите участок выше</div>
        ) : avail.length === 0 ? (
          evScore < 0 ? (
            <div className={styles.emptyMsg}>
              Провал в зоне событий (счёт {evScore}) — полевые работы недоступны для участка {activeLU.cellRef}
            </div>
          ) : !researchProg || !(researchProg.mobilizedColumns?.length) ? (
            <div className={styles.emptyStateNoResearch}>
              <div className={styles.emptyStateIcon}>🔬</div>
              <div className={styles.emptyStateTitle}>Нет научных исследований</div>

            </div>
          ) : (
            <div className={styles.emptyMsg}>
              Нет доступных блоков работ для года {globalYear}
            </div>
          )
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

      {savedToast && (
        <div className={styles.savedToast}>Работы сохранены</div>
      )}

      {showYearEndModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '2.5rem', maxWidth: 480, width: '90%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
            <h3 style={{ textAlign: 'center', color: '#2e7d32', marginBottom: '1rem', fontSize: '1.4rem' }}>
              {isLastYear ? 'Завершить игру?' : `Завершить год ${globalYear}?`}
            </h3>
            <p style={{ textAlign: 'center', color: '#555', marginBottom: '1.5rem' }}>
              {isLastYear
                ? 'Это последний год. После подтверждения игра завершится.'
                : `Время вышло. Переходим к году ${globalYear + 1}.`}
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={confirmNextYear} style={{ flex: 1, padding: '1rem', background: isLastYear ? '#c62828' : '#2fa394', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}>
                {isLastYear ? 'Завершить игру' : `Перейти к году ${globalYear + 1}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {waiting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '2.5rem', maxWidth: 480, width: '90%', boxShadow: '0 10px 50px rgba(0,0,0,0.4)', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
            <h3 style={{ color: '#2e7d32', marginBottom: '0.5rem', fontSize: '1.4rem' }}>
              {isLastYear ? 'Ожидание завершения игры' : `Ожидание перехода к году ${globalYear + 1}`}
            </h3>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>Ждём пока все команды завершат год {globalYear}</p>
            <div style={{ background: '#f0f0f0', borderRadius: 8, height: 12, marginBottom: '1rem', overflow: 'hidden' }}>
              <div style={{ width: `${(readyCount / Math.max(totalCount, 1)) * 100}%`, height: '100%', background: '#2fa394', borderRadius: 8, transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#333' }}>
              {readyCount} / {totalCount} команд готовы
            </div>
            <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#aaa' }}>Переход произойдёт автоматически когда все будут готовы</p>
          </div>
        </div>
      )}

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