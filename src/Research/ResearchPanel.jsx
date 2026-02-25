// ResearchPanel.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RESEARCH_WORKS, MOBILIZATION_WORKS, RESEARCH_ROUNDS } from './researchData';
import useGameStore from '../../store/gameStore';
import styles from './ResearchPanel.module.css';


const YEAR_DURATIONS = {
  1: 25, 2: 20, 3: 15,
  4: 15, 5: 10, 6: 15,
  7: 15, 8: 15, 9: 10, 10: 10,
};

const REFUSAL_AFTER_YEARS = [3, 5];
const REFUSAL_DURATION_MIN = 10;

const WARNING_5MIN = 5 * 60;
const WARNING_2MIN = 2 * 60;
const WARNING_30SEC = 30;

const getIteration = (year) => {
  if (year <= 4) return 'iter1';
  if (year === 5) return 'iter1b';
  if (year <= 8) return 'iter2';
  return 'iter3';
};

const ITER1_SINGLE_COLUMNS = ['srr_2d', 'srr_3d', '1pr', '3r'];

const COLUMNS_BY_ITERATION = {
  iter1: ['srr_2d', 'srr_3d', '1pr', '2pr', '3r'],      // 1-4 годы
  iter1b: ['4r'],                                         // только 5 год
  iter2: ['drilling_5gs', 'drilling_6gs', 'drilling_7mzs', 'testing', 'mun'], // 6-8 годы
  iter3: ['depression', 'bsko', 'ppd', '3bs']             // 9-10 годы
};

const formatTime = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const ResearchPanel = ({ onComplete }) => {
  const {
    player,
    licenseUnits,
    gridCells,
    research,
    purchaseResearch,
    getCurrentLU,
    setYear,
  } = useGameStore();

  const globalYear = useGameStore((s) => s.game.currentYear);
  const currentRound = globalYear <= 5 ? 1 : globalYear <= 8 ? 2 : 3;
  const currentIteration = getIteration(globalYear);

  const ownedCellsAsLU = Object.values(gridCells.owned).map(cell => ({
    id: cell.cellRef,
    cellRef: cell.cellRef,
    name: cell.name || `Участок ${cell.cellRef}`,
    ownedByTeamName: cell.ownedByTeamName,
    auctionPrice: cell.auctionPrice || 0,
  }));

  const currentLU = getCurrentLU();

  const getProgress = (luId) =>
    research.progressByLU[luId] || {
      purchasedWorks: [], totalSpent: 0, successRates: {},
      purchasedCells: {}, mobilizedColumns: [],
    };

  const currentProgress = currentLU
    ? getProgress(currentLU.id || currentLU.cellRef)
    : { purchasedWorks: [], totalSpent: 0, successRates: {}, purchasedCells: {}, mobilizedColumns: [] };

  const [selectedCell, setSelectedCell] = useState(null);
  const [successRates, setSuccessRates] = useState(currentProgress.successRates || {});
  const [mobilizedColumns, setMobilizedColumns] = useState(new Set(currentProgress.mobilizedColumns || []));
  const [purchasedCells, setPurchasedCells] = useState(currentProgress.purchasedCells || {});
  const [allPurchasedCells, setAllPurchasedCells] = useState({});
  const [showIterationConfirm, setShowIterationConfirm] = useState(false);
  const [showYearSkipConfirm, setShowYearSkipConfirm] = useState(false);

  const [timerState, setTimerState] = useState({
    timeRemaining: YEAR_DURATIONS[globalYear] * 60,
    year: globalYear,
    isFinished: false,
    pendingRefusal: false,
    refusalYear: null,
    refusalTimeLeft: 0,
  });

  const [showRefusalModal, setShowRefusalModal] = useState(false);
  const [showFinalModal, setShowFinalModal] = useState(false);

  const intervalRef = useRef(null);
  const isInitializedRef = useRef(false); // 👈 ДОБАВЬТЕ ЭТУ СТРОКУ

  useEffect(() => {
    setSuccessRates(currentProgress.successRates || {});
    setMobilizedColumns(new Set(currentProgress.mobilizedColumns || []));
    setPurchasedCells(currentProgress.purchasedCells || {});
  }, [currentProgress.successRates, currentProgress.mobilizedColumns, currentProgress.purchasedCells, currentLU]);

  useEffect(() => {
    const all = {};
    Object.keys(research.progressByLU).forEach(luId => {
      const luData = research.progressByLU[luId];
      const luName = ownedCellsAsLU.find(lu => lu.id === luId)?.name || luId;
      if (luData.purchasedCells) {
        Object.keys(luData.purchasedCells).forEach(cellKey => {
          if (!all[cellKey]) all[cellKey] = [];
          all[cellKey].push({ luId, luName, data: luData.purchasedCells[cellKey] });
        });
      }
    });
    setAllPurchasedCells(all);
  }, [research.progressByLU]);

  useEffect(() => {

    setTimerState(prev => {
      if (prev.year === globalYear) return prev;

      return {
        ...prev,
        timeRemaining: YEAR_DURATIONS[globalYear] * 60,
        year: globalYear,
      };
    });
  }, [globalYear]);


  const checkAllFinished = useCallback(() => {
    const allLUs = Object.keys(useGameStore.getState().gridCells.owned);
    if (allLUs.length === 0) return;

    if (globalYear >= 10) {
      setShowFinalModal(true);
    }
  }, [globalYear]);

  const handleYearEnd = useCallback(() => {
    const currentYear = globalYear;

    if (currentYear >= 10) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setTimerState(prev => ({
        ...prev,
        timeRemaining: 0,
        isFinished: true,
      }));
      setTimeout(() => checkAllFinished(), 200);
      return;
    }

    if (REFUSAL_AFTER_YEARS.includes(currentYear)) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;

      setTimerState(prev => ({
        ...prev,
        timeRemaining: REFUSAL_DURATION_MIN * 60,
        pendingRefusal: true,
        refusalYear: currentYear,
        refusalTimeLeft: REFUSAL_DURATION_MIN * 60,
      }));

      setShowRefusalModal(true);

      intervalRef.current = setInterval(() => {
        setTimerState(prev => {
          if (prev.refusalTimeLeft <= 1) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
            continueAfterRefusal();
            return { ...prev, refusalTimeLeft: 0 };
          }
          return { ...prev, refusalTimeLeft: prev.refusalTimeLeft - 1 };
        });
      }, 1000);

      return;
    }

    const nextYear = currentYear + 1;

    useGameStore.setState({
      game: { ...useGameStore.getState().game, currentYear: nextYear },
    });

    setTimerState({
      timeRemaining: YEAR_DURATIONS[nextYear] * 60,
      year: nextYear,
      isFinished: false,
      pendingRefusal: false,
      refusalYear: null,
      refusalTimeLeft: 0,
    });

    startMainInterval();
  }, [globalYear, checkAllFinished]);

  const startMainInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    intervalRef.current = setInterval(() => {
      setTimerState(prev => {
        if (prev.pendingRefusal || prev.isFinished) return prev;

        const newTime = prev.timeRemaining - 1;

        if (newTime <= 0) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setTimeout(() => handleYearEnd(), 0);
          return { ...prev, timeRemaining: 0 };
        }

        return { ...prev, timeRemaining: newTime };
      });
    }, 1000);
  }, [handleYearEnd]);

  useEffect(() => {
    setTimerState({
      timeRemaining: YEAR_DURATIONS[globalYear] * 60,
      year: globalYear,
      isFinished: false,
      pendingRefusal: false,
      refusalYear: null,
      refusalTimeLeft: 0,
    });

    startMainInterval();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const continueAfterRefusal = useCallback(() => {
    setShowRefusalModal(false);

    const nextYear = globalYear + 1;

    useGameStore.setState({
      game: { ...useGameStore.getState().game, currentYear: nextYear },
    });

    setTimerState({
      timeRemaining: YEAR_DURATIONS[nextYear] * 60,
      year: nextYear,
      isFinished: false,
      pendingRefusal: false,
      refusalYear: null,
      refusalTimeLeft: 0,
    });

    startMainInterval();
  }, [globalYear, startMainInterval]);

  const [selectedRefusalLU, setSelectedRefusalLU] = useState(null);

  const handleRefusalAccept = useCallback((luIdToRemove) => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setShowRefusalModal(false);
    setSelectedRefusalLU(null);

    if (luIdToRemove) {
      const state = useGameStore.getState();
      const newOwned = { ...state.gridCells.owned };
      const newAllTeams = { ...state.gridCells.allTeams };
      delete newOwned[luIdToRemove];
      delete newAllTeams[luIdToRemove];

      useGameStore.setState({
        gridCells: { owned: newOwned, allTeams: newAllTeams },
        licenseUnits: { ...state.licenseUnits, current: Object.values(newOwned)[0] || null },
      });
    }

    continueAfterRefusal();
  }, [continueAfterRefusal]);

  const canSkipToNextYear = () => {
    if (timerState.pendingRefusal || timerState.isFinished) return false;
    if (globalYear >= 10) return false;
    return true;
  };

  const handleYearSkip = () => {
    if (!canSkipToNextYear()) return;

    // Останавливаем текущий интервал
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (REFUSAL_AFTER_YEARS.includes(globalYear)) {
      setTimerState(prev => ({
        ...prev,
        timeRemaining: REFUSAL_DURATION_MIN * 60,
        pendingRefusal: true,
        refusalYear: globalYear,
        refusalTimeLeft: REFUSAL_DURATION_MIN * 60,
      }));

      setShowRefusalModal(true);

      intervalRef.current = setInterval(() => {
        setTimerState(prev => {
          if (prev.refusalTimeLeft <= 1) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
            continueAfterRefusal();
            return { ...prev, refusalTimeLeft: 0 };
          }
          return { ...prev, refusalTimeLeft: prev.refusalTimeLeft - 1 };
        });
      }, 1000);
    } else {
      const nextYear = globalYear + 1;

      useGameStore.setState({
        game: { ...useGameStore.getState().game, currentYear: nextYear },
      });

      setTimerState({
        timeRemaining: YEAR_DURATIONS[nextYear] * 60,
        year: nextYear,
        isFinished: false,
        pendingRefusal: false,
        refusalYear: null,
        refusalTimeLeft: 0,
      });

      startMainInterval();
    }

    setShowYearSkipConfirm(false);
  };

  const handleLUChange = (e) => {
    const cell = Object.values(gridCells.owned).find(c => c.cellRef === e.target.value);
    if (!cell) return;

    const cellAsLU = {
      id: cell.cellRef,
      cellRef: cell.cellRef,
      name: cell.name || `Участок ${cell.cellRef}`,
      ownedByTeamName: cell.ownedByTeamName,
    };

    useGameStore.setState({
      licenseUnits: { ...licenseUnits, current: cellAsLU },
    });
  };

  const isColumnMobilizedGlobally = (colId) => {
    if (mobilizedColumns.has(colId)) return true;
    return Object.values(research.progressByLU).some(luData =>
      (luData.mobilizedColumns || []).includes(colId)
    );
  };

  const getLockedColumnForCurrentLU = () => {
    const firstCellKey = Object.keys(purchasedCells)[0];
    return firstCellKey ? purchasedCells[firstCellKey]?.mobilizationType : null;
  };

  const getMobilizationGroup = (index) => {
    if (index < 2) return 'gray';
    if (index < 6) return 'orange';
    if (index < 11) return 'beige';
    return 'blue';
  };

  const getColumnColorClass = (index) => {
    switch (getMobilizationGroup(index)) {
      case 'gray': return 'colGroupGray';
      case 'orange': return 'colGroupOrange';
      case 'beige': return 'colGroupBeige';
      case 'blue': return 'colGroupBlue';
      default: return '';
    }
  };

  const getGroupLabel = (index) => {
    switch (getMobilizationGroup(index)) {
      case 'gray': return 'СРР';
      case 'orange': return 'ГРР';
      case 'beige': return 'Бурение';
      case 'blue': return 'Добыча';
      default: return '';
    }
  };

  const shouldShowGroupHeader = (index) => {
    const g = getMobilizationGroup(index);
    return (
      (g === 'gray' && index === 0) ||
      (g === 'orange' && index === 2) ||
      (g === 'beige' && index === 6) ||
      (g === 'blue' && index === 11)
    );
  };

  const getGroupColorStyle = (group) => {
    switch (group) {
      case 'gray': return { backgroundColor: '#f0f0f0' };
      case 'orange': return { backgroundColor: '#ffd8b1' };
      case 'beige': return { backgroundColor: '#f5e8d0' };
      case 'blue': return { backgroundColor: '#c6e2ff' };
      default: return {};
    }
  };

  const isColumnAvailableInYear = (mobWork) => {
    if (!mobWork.years) return true;
    return mobWork.years.includes(globalYear);
  };

  const isColumnDependencySatisfied = (mobWork) => {
    if (!mobWork.dependency) return true;
    return isColumnMobilizedGlobally(mobWork.dependency);
  };

  const getMobilizedInIterationForCurrentLU = (iteration) => {
    return Array.from(mobilizedColumns).filter(colId => {
      const col = MOBILIZATION_WORKS.find(w => w.id === colId);
      if (!col) return false;
      const minY = Math.min(...col.years);
      if (iteration === 'iter1' && minY >= 1 && minY <= 4) return true;
      if (iteration === 'iter1b' && minY === 5) return true;
      if (iteration === 'iter2' && minY >= 6 && minY <= 8) return true;
      if (iteration === 'iter3' && minY >= 9) return true;
      return false;
    });
  };

  const canPurchaseInCurrentIteration = (mobWorkId) => {
    const allowedColumns = COLUMNS_BY_ITERATION[currentIteration] || [];
    return allowedColumns.includes(mobWorkId);
  };

  const canMobilizeColumn = (mobWork) => {
    if (mobilizedColumns.has(mobWork.id)) return true;

    if (!canPurchaseInCurrentIteration(mobWork.id)) return false;

    if (!isColumnAvailableInYear(mobWork)) return false;
    if (!isColumnDependencySatisfied(mobWork)) return false;

    const locked = getLockedColumnForCurrentLU();
    if (locked && locked !== mobWork.id) return false;

    const iteration = getIteration(globalYear);

    if (iteration === 'iter1') {
      if (mobWork.id === '2pr') return true;
      if (ITER1_SINGLE_COLUMNS.includes(mobWork.id)) {
        const alreadyTaken = Array.from(mobilizedColumns).some(id => ITER1_SINGLE_COLUMNS.includes(id));
        if (alreadyTaken) return false;
      }
    }

    if (iteration === 'iter2' || iteration === 'iter3') {
      if (getMobilizedInIterationForCurrentLU(iteration).length > 0) return false;
    }

    return true;
  };

  const hasPurchasedWorksOnCurrentLU = () => Object.keys(purchasedCells).length > 0;
  const isLastIteration = () => globalYear >= 9;
  const canMoveToNextIteration = () => !hasPurchasedWorksOnCurrentLU() && !isLastIteration();

  const confirmNextIteration = () => {
    let nextYear = globalYear;

    if (globalYear <= 4) {
      nextYear = isColumnMobilizedGlobally('3r') ? 5 : 6;
    } else if (globalYear === 5) {
      nextYear = 6;
    } else if (globalYear >= 6 && globalYear <= 8) {
      nextYear = 9;
    } else {
      alert('Вы находитесь на последней итерации (9-10 год)');
      setShowIterationConfirm(false);
      return;
    }

    setYear(nextYear);

    setTimerState(prev => ({
      ...prev,
      year: nextYear,
      timeRemaining: YEAR_DURATIONS[nextYear] * 60,
    }));

    setShowIterationConfirm(false);
  };

  const handleCellClick = (work, mobWork) => {
    if (!currentLU) {
      alert('Сначала выберите лицензионный участок!');
      return;
    }

    const cellKey = `${work.id}-${mobWork.id}`;
    if (purchasedCells[cellKey]) return;

    if (!canPurchaseInCurrentIteration(mobWork.id)) {
      alert(
        `Столбец "${mobWork.name}" нельзя купить в текущей итерации (${getIterationLabel(globalYear)}).\n\n` +
        `Доступные столбцы в этой итерации:\n${COLUMNS_BY_ITERATION[currentIteration].map(colId => {
          const col = MOBILIZATION_WORKS.find(w => w.id === colId);
          return `• ${col?.name} (годы ${col?.years?.join(', ')})`;
        }).join('\n')
        }`
      );
      return;
    }

    if (!mobilizedColumns.has(mobWork.id) && !canMobilizeColumn(mobWork)) {
      const locked = getLockedColumnForCurrentLU();
      if (locked && locked !== mobWork.id) {
        const lockedWork = MOBILIZATION_WORKS.find(w => w.id === locked);
        alert(
          `На этом ЛУ уже ведутся исследования по столбцу "${lockedWork?.name}".\n\n` +
          `Чтобы работать со столбцом "${mobWork.name}", переключитесь на другой ЛУ.`
        );
        return;
      }

      if (!isColumnAvailableInYear(mobWork)) {
        alert(
          `Столбец "${mobWork.name}" доступен только в годы: ${mobWork.years?.join(', ')}\n` +
          `Текущий год: ${globalYear}\n\n` +
          `Этот столбец недоступен в текущем году.`
        );
        return;
      }

      if (!isColumnDependencySatisfied(mobWork)) {
        const depWork = MOBILIZATION_WORKS.find(w => w.id === mobWork.dependency);
        alert(`Для доступа к "${mobWork.name}" необходимо сначала мобилизовать "${depWork?.name || mobWork.dependency}" (на любом ЛУ)`);
        return;
      }

      const iter = getIteration(globalYear);
      if (iter === 'iter1' && ITER1_SINGLE_COLUMNS.includes(mobWork.id)) {
        const takenId = Array.from(mobilizedColumns).find(id => ITER1_SINGLE_COLUMNS.includes(id));
        const takenCol = MOBILIZATION_WORKS.find(w => w.id === takenId);
        alert(`В итерации 1 (годы 1–4) на этом ЛУ уже выбран столбец: "${takenCol?.name}"\nПерейдите на другой ЛУ чтобы выбрать иной столбец.`);
        return;
      }

      if (iter === 'iter2' || iter === 'iter3') {
        const inIter = getMobilizedInIterationForCurrentLU(iter);
        if (inIter.length > 0) {
          const takenCol = MOBILIZATION_WORKS.find(w => w.id === inIter[0]);
          alert(`В этой итерации на текущем ЛУ уже выбран столбец: "${takenCol?.name}"\nПерейдите на другой ЛУ чтобы выбрать иной столбец.`);
          return;
        }
      }

      alert('Этот столбец недоступен в текущем году.');
      return;
    }

    const successRate = work.successRates[mobWork.id] || 0;
    const otherPurchases = allPurchasedCells[cellKey] || [];
    setSelectedCell({ work, mobWork, cellKey, successRate, otherPurchases });
  };

  const handlePurchaseCell = () => {
    console.log('🛒 Покупка НИР:', { currentLU, selectedCell });

    if (!selectedCell || !currentLU) {
      console.error('❌ Ошибка: currentLU не установлен!');
      alert('Ошибка: участок не выбран. Попробуйте выбрать участок из списка.');
      return;
    }

    const { work, mobWork, cellKey, successRate } = selectedCell;
    const luId = currentLU.id || currentLU.cellRef;

    console.log('✅ Покупка для участка:', luId);

    const needsMob = !mobilizedColumns.has(mobWork.id);
    const totalCost = work.cost + (needsMob ? mobWork.cost : 0);

    if (player.budget < totalCost) {
      alert('Недостаточно средств!');
      return;
    }

    const researchWork = {
      id: cellKey,
      name: `${work.name} + ${mobWork.name}`,
      baseCost: totalCost,
      successRates: { [mobWork.id]: successRate },
      workType: work.id,
      mobilizationType: mobWork.id,
      metadata: {
        cellKey,
        workCost: work.cost,
        mobilizationCost: needsMob ? mobWork.cost : 0,
        successRate,
      },
    };

    const newRate = Math.min((successRates[mobWork.id] || 0) + successRate, 95);
    const updatedCells = { ...purchasedCells, [cellKey]: { ...researchWork, successRate } };
    const updatedMobSet = new Set(mobilizedColumns);
    if (needsMob) updatedMobSet.add(mobWork.id);

    const updatedProgress = {
      purchasedWorks: [...(currentProgress.purchasedWorks || []), researchWork],
      totalSpent: (currentProgress.totalSpent || 0) + totalCost,
      successRates: { ...successRates, [mobWork.id]: newRate },
      purchasedCells: updatedCells,
      mobilizedColumns: Array.from(updatedMobSet),
    };

    const ok = purchaseResearch(luId, researchWork);
    if (ok) {
      // Стейт локал
      setPurchasedCells(updatedCells);
      setMobilizedColumns(updatedMobSet);
      setSuccessRates(updatedProgress.successRates);

      // Стейт глобал
      useGameStore.setState({
        research: {
          ...research,
          progressByLU: {
            ...research.progressByLU,
            [luId]: updatedProgress
          },
        },
      });

      setSelectedCell(null);

    }
  };

  const isCellPurchased = (wId, mId) => !!purchasedCells[`${wId}-${mId}`];
  const isCellPurchasedOther = (wId, mId) => {
    const purchases = allPurchasedCells[`${wId}-${mId}`] || [];
    return purchases.some(p => p.luId !== (currentLU?.id || currentLU?.cellRef));
  };
  const isColumnMobilized = (id) => mobilizedColumns.has(id);
  const getColumnSuccessRate = (id) => {
    let total = 0;
    Object.values(purchasedCells).forEach(c => {
      if (c.mobilizationType === id && c.successRate) total += c.successRate;
    });
    return Math.min(total, 95);
  };
  const getCurrentSuccessRate = () =>
    Math.min(Object.values(successRates).reduce((s, r) => s + r, 0), 95);

  const getIterationLabel = (year) => {
    if (year <= 4) return '1 — ГРР (годы 1–4)';
    if (year === 5) return '1б — Разведка 4Р (год 5)';
    if (year <= 8) return '2 — Бурение (годы 6–8)';
    return '3 — Добыча (годы 9–10)';
  };

  const getTimerYearLabel = (year) => {
    if (year <= 4) return `ГРР — год ${year}`;
    if (year === 5) return 'Разведка 4Р — год 5';
    if (year <= 8) return `Бурение — год ${year}`;
    return `Добыча — год ${year}`;
  };

  const getTimerClassName = () => {
    if (timerState.isFinished) return `${styles.timer} ${styles.timerFinished}`;
    if (timerState.pendingRefusal) return `${styles.timer} ${styles.timerWarning}`;

    const t = timerState.timeRemaining;
    if (t <= WARNING_30SEC) return `${styles.timer} ${styles.timerCritical}`;
    if (t <= WARNING_2MIN) return `${styles.timer} ${styles.timerWarning}`;
    if (t <= WARNING_5MIN) return `${styles.timer} ${styles.timerAlert}`;
    return styles.timer;
  };

  return (
    <div className={styles.researchPanel}>

      <div className={getTimerClassName()}>
        {timerState.isFinished ? (
          <>
            <div className={styles.timerLabel}>Ход по всем ЛУ завершён</div>
            <div className={styles.timerFinishedText}>Исследования завершены</div>
          </>
        ) : timerState.pendingRefusal ? (
          <>
            <div className={styles.timerLabel}>Время на решение</div>
            <div className={styles.timerValue}>{formatTime(timerState.refusalTimeLeft)}</div>
            <div className={styles.timerSubtitle}>Отказ от участка (год {timerState.refusalYear})</div>
          </>
        ) : (
          <>
            <div className={styles.timerLabel}>Глобальный таймер</div>
            <div className={styles.timerValue}>{formatTime(timerState.timeRemaining)}</div>
            <div className={styles.timerSubtitle}>{getTimerYearLabel(timerState.year)}</div>
          </>
        )}
      </div>

      <div className={styles.researchMapControls}>
        <button className={`${styles.researchControlBtn} ${styles.researchBackBtn}`} onClick={onComplete}>
          Назад
        </button>
        <button className={`${styles.researchControlBtn} ${styles.researchNextBtn}`} onClick={onComplete}>
          Далее → К зоне событий
        </button>
      </div>

      <div className={styles.researchHeader}>
        <h2>Научные исследования</h2>
        <div className={styles.headerControls}>
          {ownedCellsAsLU.length > 0 ? (
            <div className={styles.luSelector}>
              <label>Участок для НИР:</label>
              <select
                value={currentLU?.id || currentLU?.cellRef || ''}
                onChange={handleLUChange}
                className={styles.luSelect}
              >
                {ownedCellsAsLU.map(lu => {
                  const luProgress = useGameStore.getState().research.progressByLU[lu.id];
                  const count = luProgress?.purchasedWorks?.length || 0;
                  return (
                    <option key={lu.id} value={lu.id}>
                      {lu.name}
                      {count > 0 ? ` (${count} НИР)` : ''}
                      {lu.auctionPrice ? ` — аукцион ${lu.auctionPrice} млн` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            <div className={styles.luSelector}>
              <span style={{ color: '#c62828', fontWeight: 700 }}>
                Нет купленных участков. Вернитесь на карту и выберите участки.
              </span>
            </div>
          )}

          <div className={styles.budgetInfo}>
            <p className={styles.budgetDisplay}>Бюджет: {player.budget} млн руб.</p>
            <p className={styles.successDisplay}>
              Успешность: <span className={styles.successValue}>{getCurrentSuccessRate()}%</span>
            </p>
          </div>
        </div>
      </div>

      <div className={styles.researchInfoBanner}>
        <p>При первой покупке в столбце оплачивается мобилизация.</p>
        <p>100% успешности недостижимы.</p>
        <p>Потрачено: {currentProgress.totalSpent || 0} млн руб.</p>
      </div>

      {import.meta.env.DEV && (
        <div style={{ background: '#fff3e0', padding: '8px 12px', borderRadius: 8, marginBottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#666', fontWeight: 700 }}>
          </span>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(y => (
            <button
              key={y}
              onClick={() => {
                if (intervalRef.current) {
                  clearInterval(intervalRef.current);
                  intervalRef.current = null;
                }

                setYear(y);

                setTimerState({
                  timeRemaining: YEAR_DURATIONS[y] * 60,
                  year: y,
                  isFinished: false,
                  pendingRefusal: false,
                  refusalYear: null,
                  refusalTimeLeft: 0,
                });

                setShowRefusalModal(false);
                setShowFinalModal(false);

                startMainInterval();
              }}
              style={{
                padding: '3px 10px', borderRadius: 5,
                border: `2px solid ${globalYear === y ? '#2fa394' : '#ccc'}`,
                background: globalYear === y ? '#2fa394' : 'white',
                color: globalYear === y ? 'white' : '#333',
                fontWeight: 700, cursor: 'pointer', fontSize: 13,
              }}
            >{y}</button>
          ))}
          <button
            onClick={() => {
              setMobilizedColumns(new Set());
              setPurchasedCells({});
              setSuccessRates({});

              const luId = currentLU?.id || currentLU?.cellRef;
              if (luId) {
                useGameStore.setState({
                  research: {
                    ...research,
                    progressByLU: {
                      ...research.progressByLU,
                      [luId]: {
                        purchasedWorks: [],
                        totalSpent: 0,
                        successRates: {},
                        purchasedCells: {},
                        mobilizedColumns: []
                      },
                    },
                  },
                });
              }
            }}
            style={{ marginLeft: 'auto', padding: '3px 12px', borderRadius: 5, border: '2px solid #ff5722', background: 'white', color: '#ff5722', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
          >
            Сброс
          </button>
        </div>
      )}

      <div className={styles.roundIndicator}>
        <div className={styles.yearInfo}>
          <span className={styles.yearLabel}>Текущий год:</span>
          <span className={styles.yearValue}>{globalYear}</span>
        </div>

        <button
          className={styles.skipYearBtn}
          onClick={() => setShowYearSkipConfirm(true)}
          disabled={!canSkipToNextYear()}
          style={{
            marginLeft: '15px',
            padding: '5px 15px',
            background: canSkipToNextYear() ? '#ff9800' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: canSkipToNextYear() ? 'pointer' : 'not-allowed',
            fontWeight: 'bold',
            fontSize: '0.9rem'
          }}
          title={!canSkipToNextYear()
            ? (globalYear >= 10 ? 'Последний год, нельзя пропустить' : 'Нельзя пропустить год во время отказа')
            : 'Досрочно перейти на следующий год'
          }
        >
          Пропустить год
        </button>
      </div>

      <div className={styles.groupLegend}>
        {[
          { group: 'gray', label: 'СРР (2 шт)' },
          { group: 'orange', label: 'ГРР (4 шт)' },
          { group: 'beige', label: 'Бурение (5 шт)' },
          { group: 'blue', label: 'Добыча (4 шт)' },
        ].map(({ group, label }) => (
          <div key={group} className={styles.legendItem}>
            <span className={styles.legendColor} style={getGroupColorStyle(group)} />
            <span className={styles.legendText}>{label}</span>
          </div>
        ))}
      </div>

      <div className={styles.researchTableContainer}>
        <div className={styles.researchTableScroll}>
          <table className={`${styles.researchTable} ${styles.battleship}`}>
            <thead>
              <tr>
                <th className={styles.colWorkName}>Вид работ</th>
                <th className={styles.colCost}>Стоимость НИР</th>
                {MOBILIZATION_WORKS.map((mobWork, index) => {
                  const mobilized = isColumnMobilized(mobWork.id);
                  const colSucc = getColumnSuccessRate(mobWork.id);
                  const groupClass = getColumnColorClass(index);
                  const colAvailable = canMobilizeColumn(mobWork);
                  const yearsStr = mobWork.years?.join(',') || 'все';
                  const hasDep = mobWork.dependency && !isColumnMobilizedGlobally(mobWork.dependency);
                  const notAvailableYear = !mobilized && !isColumnAvailableInYear(mobWork);
                  const canPurchaseNow = canPurchaseInCurrentIteration(mobWork.id);

                  let headerClass = styles[groupClass];
                  if (mobilized) headerClass += ` ${styles.mobilized}`;
                  else if (canPurchaseNow && colAvailable) headerClass += ` ${styles.available}`;
                  else headerClass += ` ${styles.locked}`;

                  return (
                    <th
                      key={mobWork.id}
                      className={`${styles.colMob} ${headerClass}`}
                      title={
                        !canPurchaseNow
                          ? `Столбец недоступен в текущей итерации (${getIterationLabel(globalYear)})`
                          : notAvailableYear
                            ? `Недоступно: столбец только в годы ${yearsStr}, текущий год: ${globalYear}`
                            : !colAvailable
                              ? `Годы: ${yearsStr}${hasDep ? ` | Требует: ${mobWork.dependency}` : ''}`
                              : ''
                      }
                    >
                      {shouldShowGroupHeader(index) && (
                        <div className={styles.groupHeader}>{getGroupLabel(index)}</div>
                      )}
                      <div className={styles.mobHeader}>
                        <span className={styles.mobName}>{mobWork.name}</span>
                        <span className={styles.mobCost}>{mobWork.cost} млн руб.</span>
                        {mobWork.years && <span className={styles.mobYears}>Годы: {yearsStr}</span>}
                        {hasDep && !mobilized && (
                          <span className={styles.mobDependency}>Требует: {mobWork.dependency}</span>
                        )}
                        {mobilized && <span className={styles.mobSuccess}>{colSucc}%</span>}
                        {!colAvailable && !mobilized && (
                          <span className={styles.mobLocked}>
                            {!canPurchaseNow
                              ? 'Не в этой итерации'
                              : notAvailableYear
                                ? `Текущий год: ${globalYear}`
                                : 'Недоступен'}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {RESEARCH_WORKS.map(work => (
                <tr key={work.id}>
                  <td className={styles.workName}>{work.name}</td>
                  <td className={styles.workCost}>{work.cost} млн руб.</td>
                  {MOBILIZATION_WORKS.map((mobWork, mIdx) => {
                    const cellKey = `${work.id}-${mobWork.id}`;
                    const isPurchCurr = isCellPurchased(work.id, mobWork.id);
                    const isPurchOther = isCellPurchasedOther(work.id, mobWork.id);
                    const colMobilized = isColumnMobilized(mobWork.id);
                    const colAvailable = canMobilizeColumn(mobWork);
                    const groupClass = getColumnColorClass(mIdx);
                    const successRate = work.successRates[mobWork.id] || 0;
                    const notAvailableYear = !colMobilized && !isColumnAvailableInYear(mobWork);
                    const canPurchaseNow = canPurchaseInCurrentIteration(mobWork.id);

                    let cellClass = `${styles.cell} ${styles[groupClass]}`;
                    if (isPurchCurr) cellClass += ` ${styles.purchased}`;
                    else if (isPurchOther) cellClass += ` ${styles.purchasedOther}`;
                    else if (colAvailable && canPurchaseNow) cellClass += ` ${styles.available}`;
                    else cellClass += ` ${styles.unavailable}`;

                    if (colMobilized) cellClass += ` ${styles.colVisible}`;
                    else cellClass += ` ${styles.colHidden}`;

                    return (
                      <td
                        key={mobWork.id}
                        className={cellClass}
                        onClick={() => !isPurchCurr && handleCellClick(work, mobWork)}
                        title={
                          isPurchCurr ? `Куплено для ${currentLU?.name}: +${successRate}%`
                            : isPurchOther ? `Куплено для других участков. Нажмите для покупки для ${currentLU?.name}`
                              : !canPurchaseNow
                                ? `Столбец недоступен в текущей итерации (${getIterationLabel(globalYear)})`
                                : notAvailableYear
                                  ? `Недоступно: годы ${mobWork.years?.join(',')} — текущий год: ${globalYear}`
                                  : !colAvailable
                                    ? `Недоступно. Годы: ${mobWork.years?.join(',') || 'все'}${mobWork.dependency ? ` | Требует: ${mobWork.dependency}` : ''}`
                                    : 'Доступно для покупки'
                        }
                      >
                        {isPurchCurr ? (
                          <div className={styles.cellPurchased}>
                            <span className={styles.cellRate}>{successRate}%</span>
                          </div>
                        ) : isPurchOther ? (
                          <div className={styles.cellPurchasedOther}>
                            <span className={styles.cellOtherRate}>{successRate}%</span>
                            <span className={styles.cellHoverInfo}>Нажмите для покупки</span>
                          </div>
                        ) : !colAvailable || !canPurchaseNow ? (
                          <div className={styles.cellUnavailable}>
                            <span className={styles.cellLockIcon}>—</span>
                            <span className={styles.cellHoverInfo}>
                              {!canPurchaseNow ? 'Не в этой итерации' : 'Недоступно'}
                            </span>
                          </div>
                        ) : (
                          <div className={styles.cellAvailable}>
                            <span className={styles.cellHiddenRate}>?</span>
                            <span className={styles.cellHoverInfo}>Нажмите для покупки</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr className={styles.totalsRow}>
                <td colSpan="2" className={styles.totalsLabel}><strong>Итоговая успешность:</strong></td>
                {MOBILIZATION_WORKS.map((mobWork, index) => {
                  const mobilized = isColumnMobilized(mobWork.id);
                  const succ = getColumnSuccessRate(mobWork.id);
                  const groupClass = getColumnColorClass(index);
                  return (
                    <td key={mobWork.id} className={`${styles.totalsCell} ${styles[groupClass]}`}>
                      {mobilized ? (
                        <span className={`${styles.totalSuccess} ${succ >= 70 ? styles.high : succ >= 40 ? styles.medium : styles.low
                          }`}>{succ}%</span>
                      ) : (
                        <span className={styles.lockedTotal}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {currentProgress.purchasedWorks?.length > 0 && (
        <div className={styles.purchaseHistory}>
          <h4>Купленные НИР для {currentLU?.name}:</h4>
          <div className={styles.historyList}>
            {currentProgress.purchasedWorks.map((work, idx) => {
              const [wId, mId] = work.id.split('-');
              const workItem = RESEARCH_WORKS.find(w => w.id === wId);
              const mobWork = MOBILIZATION_WORKS.find(m => m.id === mId);
              const mIdx = MOBILIZATION_WORKS.findIndex(m => m.id === mId);
              const groupClass = getColumnColorClass(mIdx);
              return (
                <div key={`${work.id}-${idx}`} className={`${styles.historyItem} ${styles[groupClass]}`}>
                  <span className={styles.historyWork}>{workItem?.name || wId}</span>
                  <span className={styles.historyColumn}>{mobWork?.name || mId}</span>
                  <span className={styles.historyCost}>{work.baseCost} млн руб.</span>
                  <span className={styles.historySuccess}>
                    +{work.metadata?.successRate || Object.values(work.successRates || {})[0] || 0}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.researchActions} />

      {/* Со стилями наворотил, потои исправить */}
      {showIterationConfirm && (
        <div className={styles.cellModalOverlay} onClick={() => setShowIterationConfirm(false)}>
          <div className={styles.cellModal} onClick={e => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => setShowIterationConfirm(false)}>x</button>
            <h3>Переход на следующую итерацию</h3>
            <div className={styles.modalInfo}>
              <p style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '1.1rem', color: 'black' }}>
                Вы уверены что хотите перейти на следующую итерацию?
              </p>
              <p style={{ textAlign: 'center', color: '#d32f2f', fontWeight: 600 }}>
                Возврата назад не будет!
              </p>
              {globalYear <= 4 && !isColumnMobilizedGlobally('3r') && (
                <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.95rem', color: '#666' }}>
                  3Р не куплен — год 5 будет пропущен
                </p>
              )}
              {globalYear <= 4 && isColumnMobilizedGlobally('3r') && (
                <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.95rem', color: '#2e7d32' }}>
                  3Р куплен — переход на год 5 (разведка 4Р)
                </p>
              )}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.purchaseModalBtn} onClick={confirmNextIteration}>Да, перейти</button>
              <button className={styles.cancelModalBtn} onClick={() => setShowIterationConfirm(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {showYearSkipConfirm && (
        <div className={styles.cellModalOverlay} onClick={() => setShowYearSkipConfirm(false)}>
          <div className={styles.cellModal} onClick={e => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => setShowYearSkipConfirm(false)}>x</button>
            <h3 style={{ color: '#ff9800' }}>Пропустить год</h3>
            <div className={styles.modalInfo}>
              <p style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '1.1rem', color: "black" }}>
                Вы уверены что хотите досрочно перейти на следующий год?
              </p>
              <p style={{ textAlign: 'center', color: '#d32f2f', fontWeight: 600 }}>
                Оставшееся время текущего года будет потеряно!
              </p>
              <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.95rem', color: '#666' }}>
                Текущий год: {globalYear}<br />
                Осталось времени: {formatTime(timerState.timeRemaining)}
              </p>
              {REFUSAL_AFTER_YEARS.includes(globalYear) && (
                <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.95rem', color: '#e65100', fontWeight: 'bold' }}>
                  Этот год является годом отказа от участков
                </p>
              )}
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.purchaseModalBtn}
                onClick={handleYearSkip}
                style={{ background: '#ff9800' }}
              >
                Да, пропустить
              </button>
              <button className={styles.cancelModalBtn} onClick={() => setShowYearSkipConfirm(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {selectedCell && (
        <div className={styles.cellModalOverlay} onClick={() => setSelectedCell(null)}>
          <div className={styles.cellModal} onClick={e => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => setSelectedCell(null)}>x</button>
            <h3>Покупка НИР для {currentLU?.name}</h3>
            <div className={styles.modalInfo}>
              <div className={styles.infoRow}>
                <span className={styles.label}>НИР:</span>
                <span className={styles.value}>{selectedCell.work.name}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>Столбец:</span>
                <span className={styles.value}>{selectedCell.mobWork.name}</span>
              </div>
              {!isColumnMobilized(selectedCell.mobWork.id) && (
                <div className={`${styles.infoRow} ${styles.highlight}`}>
                  <span className={styles.label}>+ Мобилизация:</span>
                  <span className={styles.value}>{selectedCell.mobWork.cost} млн руб.</span>
                </div>
              )}
              <div className={`${styles.infoRow} ${styles.total}`}>
                <span className={styles.label}>ИТОГО:</span>
                <span className={styles.value}>
                  {selectedCell.work.cost + (isColumnMobilized(selectedCell.mobWork.id) ? 0 : selectedCell.mobWork.cost)} млн руб.
                </span>
              </div>
              <div className={`${styles.infoRow} ${styles.mystery}`}>
                <span className={styles.value}>(процент успешности откроется после покупки)</span>
              </div>
              {selectedCell.otherPurchases?.length > 0 && (
                <div className={`${styles.infoRow} ${styles.otherLuInfo}`}>
                  <span className={styles.label}>Уже куплено для:</span>
                  <span className={styles.value}>{selectedCell.otherPurchases.map(p => p.luName).join(', ')}</span>
                </div>
              )}
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.purchaseModalBtn}
                onClick={handlePurchaseCell}
                disabled={
                  player.budget < selectedCell.work.cost +
                  (isColumnMobilized(selectedCell.mobWork.id) ? 0 : selectedCell.mobWork.cost)
                }
              >
                Купить ячейку
              </button>
              <button className={styles.cancelModalBtn} onClick={() => setSelectedCell(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {showRefusalModal && (
        <div className={styles.cellModalOverlay}>
          <div className={styles.cellModal} onClick={e => e.stopPropagation()}>
            <h3 style={{ textAlign: 'center', color: '#e65100', marginBottom: '1rem' }}>
              Возможность отказа от участка
            </h3>
            <div className={styles.modalInfo}>
              <p style={{ textAlign: 'center', fontSize: '1.05rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                {timerState.refusalYear === 3
                  ? 'После 3 года можно отказаться от одного участка и выбрать новый на карте региона.'
                  : 'После 5 года можно отказаться от участков и выбрать новые на карте региона.'}
              </p>
              <div style={{ textAlign: 'center', padding: '0.6rem 1rem', background: '#fff3e0', borderRadius: 8, border: '2px solid #ff9800', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#e65100' }}>
                  Время на решение: {formatTime(timerState.refusalTimeLeft)}
                </span>
              </div>
              {ownedCellsAsLU.length > 0 && (
                <div>
                  <p style={{ fontWeight: 700, marginBottom: '0.5rem', textAlign: 'center', fontSize: '0.95rem' }}>
                    Выберите участок от которого хотите отказаться:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {ownedCellsAsLU.map(lu => (
                      <div
                        key={lu.id}
                        onClick={() => setSelectedRefusalLU(lu.id === selectedRefusalLU ? null : lu.id)}
                        style={{
                          padding: '0.6rem 1rem',
                          background: selectedRefusalLU === lu.id ? '#fff3e0' : '#f5f5f5',
                          border: `2px solid ${selectedRefusalLU === lu.id ? '#ff9800' : '#e0e0e0'}`,
                          borderRadius: 8, cursor: 'pointer',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          fontWeight: selectedRefusalLU === lu.id ? 700 : 400,
                          transition: 'all 0.2s',
                        }}
                      >
                        <span>{lu.name}</span>
                        {selectedRefusalLU === lu.id && <span style={{ color: '#ff9800', fontSize: '1.2rem' }}>✓</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.purchaseModalBtn}
                onClick={() => {
                  if (!selectedRefusalLU && ownedCellsAsLU.length > 0) {
                    alert('Выберите участок от которого хотите отказаться');
                    return;
                  }
                  handleRefusalAccept(selectedRefusalLU);
                }}
                style={{ background: '#e65100' }}
              >
                Отказаться и выбрать новый
              </button>
              <button
                className={styles.cancelModalBtn}
                onClick={continueAfterRefusal}
              >
                Продолжить с текущими
              </button>
            </div>
          </div>
        </div>
      )}

      {showFinalModal && (
        <div className={styles.cellModalOverlay}>
          <div className={styles.cellModal}>
            <h3 style={{ textAlign: 'center', color: '#2e7d32', fontSize: '1.5rem', marginBottom: '1rem' }}>
              Ход по "Научным исследованиям" завершён!
            </h3>
            <div className={styles.modalInfo}>
              <p style={{ textAlign: 'center', fontSize: '1.1rem', margin: '0.5rem 0 1rem' }}>
                Все 10 лет пройдены
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {Object.keys(gridCells.owned).map(cellRef => (
                  <div key={cellRef} style={{ padding: '0.5rem 1rem', background: '#e8f5e9', borderRadius: 6, display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                    <span style={{ color: '#2e7d32', fontSize: '1.2rem' }}>✓</span>
                    <span>Участок {cellRef}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.purchaseModalBtn} onClick={onComplete}>
                Перейти к зоне событий
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ResearchPanel;