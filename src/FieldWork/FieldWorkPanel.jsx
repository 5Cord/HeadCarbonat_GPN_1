import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FIELD_WORK_BLOCKS, calculateTotalCost, calculateQualityScore, prepareFieldWorkForAPI } from './fieldWorkData';
import useGameStore from '../../store/gameStore';
import styles from './FieldWorkPanel.module.css';
import BudgetBar from '../BudgetBar.jsx';

const YEAR_DURATIONS = { 1: 25, 2: 20, 3: 15, 4: 15, 5: 10, 6: 15, 7: 15, 8: 15, 9: 10, 10: 10 };
const W5 = 5 * 60, W2 = 2 * 60, W30 = 30;

const fmtTime = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
};

const yearLabel = (y) => {
  if (y <= 4) return 'Геологоразведочные работы — год ' + y;
  if (y === 5) return 'Разведочное бурение — год 5';
  if (y <= 8) return 'Бурение скважин — год ' + y;
  return 'Добыча — год ' + y;
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

const FieldWorkPanel = ({ onComplete, currentLU: currentLUProp, onBack, onMenu }) => {
  const { player, gridCells, research, fieldWork, events } = useGameStore();
  const globalYear = useGameStore((s) => s.game.currentYear);

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

  // ФИХ: avail строится ТОЛЬКО из столбцов, мобилизованных в текущем году.
  // mobilizedColumnsByYear[globalYear] — массив столбцов именно этого года.
  // Старые годы хранятся в том же объекте, но сюда не попадают.
  // Если mobilizedColumnsByYear отсутствует (старые данные), fallback на mobilizedColumns
  // с фильтрацией по columnsByYear[globalYear] — чтобы не сломать backward compat.
  const avail = (() => {
    if (evScore < 0 || !researchProg) return [];

    // Приоритет: берём столбец, выбранный в этом году (один столбец на год)
    const chosenColThisYear = researchProg.columnsByYear?.[globalYear];

    // mobilizedColumnsByYear[year] — список всех столбцов, мобилизованных в этом году
    const mobThisYear = researchProg.mobilizedColumnsByYear?.[globalYear] || [];

    // Если есть данные по году — используем их
    if (mobThisYear.length > 0) {
      return FIELD_WORK_BLOCKS.filter(b => mobThisYear.includes(b.mobWorkId));
    }

    // Fallback для backward compat: если mobilizedColumnsByYear не заполнен,
    // показываем только блок выбранного в этом году столбца
    if (chosenColThisYear) {
      return FIELD_WORK_BLOCKS.filter(b => b.mobWorkId === chosenColThisYear);
    }

    // Совсем нет данных — пусто
    return [];
  })();

  // Загружаем selections ТОЛЬКО текущего года
  const getYearSelections = useCallback((id, year) => {
    return fieldWork.selectionsByLU[id]?.selectionsByYear?.[year] || {};
  }, [fieldWork.selectionsByLU]);

  const [selections, setSelections] = useState(() => getYearSelections(luId, globalYear));

  // При смене участка или года — загружаем selections именно этого года
  useEffect(() => {
    setSelections(getYearSelections(luId, globalYear));
  }, [luId, globalYear]);

  // Сохраняем selections в store — ТОЛЬКО в слот текущего года,
  // прошлые годы в selectionsByYear остаются нетронутыми
  useEffect(() => {
    if (!luId) return;
    const tc = calculateTotalCost(selections, avail);
    const qs = calculateQualityScore(selections, avail);
    const avgRank = calcAvgRank(selections, avail);

    useGameStore.setState(st => {
      const prev = st.fieldWork.selectionsByLU[luId] || {};
      const prevByYear = prev.selectionsByYear || {};   // все прошлые годы целы
      const prevMeta = prev.metaByYear || {};           // все прошлые мета целы
      return {
        fieldWork: {
          ...st.fieldWork,
          selectionsByLU: {
            ...st.fieldWork.selectionsByLU,
            [luId]: {
              ...prev,
              // «текущие» selections — всегда только этот год
              selections,
              totalCost: tc,
              qualityScore: qs,
              avgRank,
              availableBlocks: avail.map(b => b.blockId),
              // Пишем ТОЛЬКО в слот текущего года, остальные годы не трогаем
              selectionsByYear: { ...prevByYear, [globalYear]: selections },
              metaByYear: {
                ...prevMeta,
                [globalYear]: { totalCost: tc, qualityScore: qs, avgRank },
              },
            },
          },
        },
      };
    });
  }, [selections, luId, globalYear]);

  const [timer, setTimer] = useState({
    timeRemaining: YEAR_DURATIONS[globalYear] * 60,
    year: globalYear,
    isFinished: false,
  });
  const ivRef = useRef(null);
  const startIv = useCallback(() => {
    if (ivRef.current) { clearInterval(ivRef.current); ivRef.current = null; }
    ivRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev.isFinished) return prev;
        const t = prev.timeRemaining - 1;
        if (t <= 0) {
          clearInterval(ivRef.current);
          ivRef.current = null;
          return { ...prev, timeRemaining: 0, isFinished: true };
        }
        return { ...prev, timeRemaining: t };
      });
    }, 1000);
  }, []);

  useEffect(() => {
    setTimer({ timeRemaining: YEAR_DURATIONS[globalYear] * 60, year: globalYear, isFinished: false });
    startIv();
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, [globalYear]);

  const timerCls = () => {
    if (timer.isFinished) return styles.timer + ' ' + styles.timerFinished;
    const t = timer.timeRemaining;
    if (t <= W30) return styles.timer + ' ' + styles.timerCritical;
    if (t <= W2) return styles.timer + ' ' + styles.timerWarning;
    if (t <= W5) return styles.timer + ' ' + styles.timerAlert;
    return styles.timer;
  };

  const tc = calculateTotalCost(selections, avail);
  const totCards = avail.reduce((s, b) => s + b.cards.length, 0);
  const selCards = Object.keys(selections).filter(
    k => avail.some(b => b.cards.some(c => c.cardId === k))
  ).length;
  const canAfford = player.budget >= tc;
  const avgRank = calcAvgRank(selections, avail);

  const doSelect = (cardId, rank) => setSelections(prev => ({ ...prev, [cardId]: rank }));

  const doConfirm = () => {
    if (!canAfford || selCards === 0) return;
    useGameStore.setState(st => ({
      player: { ...st.player, budget: st.player.budget - tc },
    }));
    const luStore = fieldWork.selectionsByLU[luId] || {};
    const apiPayload = {
      ...prepareFieldWorkForAPI(player.id, luId, selections, avail),
      year: globalYear,
      // Передаём ВСЕ годы для истории — backend может использовать
      selectionsByYear: luStore.selectionsByYear || {},
      metaByYear: luStore.metaByYear || {},
    };
    console.log('[FieldWork API]', apiPayload);
    onComplete();
  };

  const getStatus = (cellRef) => {
    const p = research.progressByLU[cellRef];
    const sc = events.lineScores?.[cellRef] ?? 0;
    // Статус — только по выборам текущего года
    const yearSel = fieldWork.selectionsByLU[cellRef]?.selectionsByYear?.[globalYear];
    if (sc < 0) return 'failed';
    if (yearSel && Object.keys(yearSel).length > 0) return 'done';
    if (!p || !(p.mobilizedColumns?.length)) return 'noResearch';
    return 'ready';
  };

  const handleBack = useCallback(() => {
    if (onBack) onBack();
    else console.warn('onBack callback not provided');
  }, [onBack]);

  // shuffledOptions перемешиваются один раз при монтировании —
  // порядок кнопок внутри карточки случайный, но стабильный в рамках сессии
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

  const totalSpent = Object.values(research.progressByLU)
    .reduce((s, p) => s + (p.totalSpent || 0), 0);

  return (
    <div className={styles.panel}>

      {/* ── ТОПБАР ──────────────────────────────────────────────────────── */}
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <button className={styles.navBtnBack} onClick={handleBack}>← Назад</button>
          <button className={styles.navBtnBack} onClick={onMenu}>В меню</button>
          <span className={styles.topbarTitle}>Полевые работы</span>
        </div>
        <div className={styles.topbarRight}>
          <span className={styles.budgetBadge}>Бюджет: {player.budget} млн руб.</span>
          <button className={styles.navBtn} onClick={onComplete}>Далее</button>
        </div>
      </div>

      {/* ── ТАЙМЕР ──────────────────────────────────────────────────────── */}
      <div className={timerCls()}>
        {timer.isFinished ? (
          <>
            <div className={styles.timerLabel}>Время истекло</div>
            <div className={styles.timerSub}>Полевые работы</div>
          </>
        ) : (
          <>
            <div className={styles.timerLabel}>Глобальный таймер</div>
            <div className={styles.timerValue}>{fmtTime(timer.timeRemaining)}</div>
            <div className={styles.timerSub}>{yearLabel(timer.year)}</div>
          </>
        )}
      </div>

      {/* ── ВЫБОР УЧАСТКА ───────────────────────────────────────────────── */}
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
              <div
                key={lu.cellRef}
                onClick={() => setActiveLUId(lu.cellRef)}
                className={[
                  styles.luCard,
                  isActive ? styles.luCardActive : '',
                  styles['luSt_' + status],
                ].join(' ')}
              >
                <div className={styles.luCardRef}>{lu.cellRef}</div>
                <div className={styles.luCardName}>{lu.name}</div>
                <div className={styles.luCardMeta}>
                  {mob > 0 && <span className={styles.metaMob}>{mob} НИР</span>}
                  {score !== 0 && (
                    <span className={[styles.metaScore, score >= 0 ? styles.metaPos : styles.metaNeg].join(' ')}>
                      {score >= 0 ? '+' : ''}{score}
                    </span>
                  )}
                  {yearMeta?.totalCost > 0 && (
                    <span className={styles.metaCost}>{yearMeta.totalCost} млн</span>
                  )}
                </div>
                <div className={styles.luCardStatus}>{ST_TXT[status]}</div>
              </div>
            );
          })}
        </div>

        <BudgetBar budget={player.budget} spent={totalSpent} theme="dark" />

        {activeLU && (
          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <span className={styles.statLbl}>Карточки</span>
              <span className={styles.statVal}>{selCards} из {totCards}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLbl}>Стоимость</span>
              <span className={[styles.statVal, canAfford ? styles.ok : styles.fail].join(' ')}>
                {tc} млн руб.
              </span>
            </div>
            {avgRank !== null && (
              <div className={styles.stat}>
                <span className={styles.statLbl}>Средний ранг</span>
                <span className={styles.statVal}>{avgRank}</span>
              </div>
            )}
            <div className={styles.statActions}>
              <button
                className={styles.confirmBtn}
                onClick={doConfirm}
                disabled={!canAfford || selCards === 0}
              >
                Подтвердить — {tc} млн руб.
              </button>
              <button className={styles.skipBtn} onClick={onComplete}>Далее</button>
            </div>
          </div>
        )}
      </div>

      {/* ── ОБЛАСТЬ КАРТОЧЕК ────────────────────────────────────────────── */}
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
            <div
              key={block.blockId}
              className={[styles.blockCol, styles['grp_' + block.groupColor]].join(' ')}
            >
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
                  return (
                    <div
                      key={card.cardId}
                      className={[
                        styles.card,
                        styles['cardGrp_' + block.groupColor],
                        chosen ? styles.cardHasSel : styles.cardNoSel,
                      ].join(' ')}
                    >
                      <div className={styles.cardTitle}>{card.cardTitle}</div>
                      <div className={styles.cardOpts}>
                        {(shuffledOptions[card.cardId] || card.options).map(opt => (
                          <button
                            key={opt.rank}
                            className={[
                              styles.optBtn,
                              chosen === opt.rank ? styles.optSel : '',
                            ].join(' ')}
                            onClick={() => doSelect(card.cardId, opt.rank)}
                          >
                            <div className={styles.optDescBlock}>
                              <div className={styles.optDesc}>{opt.param}</div>
                            </div>
                            <div className={styles.optCostBadge}>
                              {opt.cost > 0 ? opt.cost + ' млн' : 'Бесплатно'}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── НИЖНЯЯ ПАНЕЛЬ ПОДТВЕРЖДЕНИЯ ─────────────────────────────────── */}
      {activeLU && avail.length > 0 && (
        <div className={styles.bottomBar}>
          <div className={styles.bottomInfo}>
            {!canAfford && <span className={styles.warnRed}>Недостаточно бюджета — </span>}
            {selCards === 0 && canAfford && <span className={styles.warnOrange}>Выберите варианты — </span>}
            Выбрано {selCards} из {totCards} карточек
            {avgRank !== null && (
              <span className={styles.avgRankBadge}>
                &nbsp;· Средний ранг: <strong>{avgRank}</strong>
              </span>
            )}
          </div>
          <button
            className={styles.confirmBtnBottom}
            onClick={doConfirm}
            disabled={!canAfford || selCards === 0}
          >
            Подтвердить выбор — {tc} млн руб.
          </button>
        </div>
      )}
    </div>
  );
};

export default FieldWorkPanel;