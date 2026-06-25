import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MOBILIZATION_WORKS, normalizeResearchConfig } from './researchData';
import useGameStore from '../../store/gameStore';
import GlobalTimer from '../GlobalTimer';
import styles from './ResearchPanel.module.css';
import RefusalMap from './RefusalMap';
import ResearchPanelTour, { RefusalTour } from './Researchpaneltour';
import BudgetBar from '../Budgetbar.jsx';
import { getSocket } from '../apiHelpers';
import { getLastSuccessfulSceneImage, getSceneImageFromMeta, resolveSceneImage, getScenario, WORK_SCENE_MAP } from './sceneUtils';


const REFUSAL_YEARS = [3, 5];
const REFUSAL_DURATION = 10 * 60;
const RESULTS_DURATION = 2 * 60;

// ЛУ крупной нефтегазовой компании, доступные для обмена
const COMPANY_LU_CELLS = ['B5', 'C5', 'B6', 'C6'];

const DRILLING_GROUP_A = ['drilling_5gs', 'drilling_6gs', 'drilling_7mzs']; // макс. 2 из 3
const DRILLING_GROUP_B = ['testing', 'mun'];                                 // макс. 1 из 2

const COLS_BY_YEAR = {
  1: ['srr_2d', 'srr_3d', '1pr'],
  2: ['srr_2d', 'srr_3d', '1pr'],
  3: ['srr_2d', 'srr_3d', '1pr'],
  4: ['srr_2d', 'srr_3d', '1pr', '3r'],
  5: ['3r'],
  6: ['drilling_5gs', 'drilling_6gs', 'drilling_7mzs', 'testing', 'mun'],
  7: ['drilling_5gs', 'drilling_6gs', 'drilling_7mzs', 'testing', 'mun'],
  8: ['drilling_5gs', 'drilling_6gs', 'drilling_7mzs', 'testing', 'mun'],
  9: ['depression', 'bsko', 'ppd', '3bs'],
  10: ['depression', 'bsko', 'ppd', '3bs'],
};


const fmt = (s) => {
  const t = Math.max(0, Math.floor(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

const isColActiveThisYear = (colId, year) => (COLS_BY_YEAR[year] || []).includes(colId);

const iterLabel = (year) => {
  if (year <= 4) return '1 — ГРР (годы 1–4)';
  if (year === 5) return '1б — Разведка 4Р (год 5)';
  if (year <= 8) return '2 — Бурение (годы 6–8)';
  return '3 — Добыча (годы 9–10)';
};


const defaultProgress = () => ({
  blockedColumns: [],
  mobilizedColumns: [],
  columnsByYear: {},
  skippedYears: [],
  purchasedWorks: [],
  purchasedWorksByYear: {},
  purchasedCellsByYear: {},
  successRatesByYear: {},
  totalSpent: 0,
  purchasedCells: {},
  successRates: {},
});


function applyYearTransition(prog, prevYear, eventsScore) {
  const prevCol = prog.columnsByYear?.[prevYear];
  const skipped = (prog.skippedYears || []).includes(prevYear);
  let blocked = [...(prog.blockedColumns || [])];
  if (prevCol && !skipped && eventsScore >= 0) {
    if (!blocked.includes(prevCol)) blocked.push(prevCol);
  }
  return { ...prog, blockedColumns: blocked, purchasedCells: {}, successRates: {} };
}


const MOB_GROUPS = [
  { ids: ['srr_2d', 'srr_3d'], label: 'СЕЙСМОРАЗВЕДКА', cls: 'colGroupGray' },
  { ids: ['1pr', '3r'], label: 'ПОИСКОВО-РАЗВЕДОЧНОЕ БУРЕНИЕ', cls: 'colGroupOrange' },
  { ids: ['drilling_5gs', 'drilling_6gs', 'drilling_7mzs', 'testing', 'mun'], label: 'ПРОЕКТИРОВАНИЕ РАЗРАБОТКИ', cls: 'colGroupBeige' },
  { ids: ['depression', 'bsko', 'ppd', '3bs'], label: 'УПРАВЛЕНИЕ РАЗРАБОТКОЙ', cls: 'colGroupBlue' },
];

const getColGroup = (colId) => MOB_GROUPS.find(g => g.ids.includes(colId)) || MOB_GROUPS[0];


export default function ResearchPanel({ onComplete, onBack, onMenu }) {
  const {
    player, gridCells, licenseUnits, research, events, fieldWork,
    markYearSkippedForLU, resetEventCardsForNewYear, applyYearTransitionForAllLUs,
    setGlobalPhase, pauseGlobalTimer, resumeGlobalTimer, stopGlobalTimer,
    advanceToNextYear,
  } = useGameStore();

  const globalTimer = useGameStore(s => s.globalTimer);
  const globalYear = useGameStore(s => s.game.currentYear);
  const otherTeamsScene  = useGameStore(s => s.otherTeamsScene);
  const cellScenarios    = useGameStore(s => s.cellScenarios);
  const triggerRefusal = useGameStore(s => s.triggerRefusal);
  const setTriggerRefusal = useGameStore(s => s.setTriggerRefusal);
  const setShowRegionMapBanner = useGameStore(s => s.setShowRegionMapBanner);
  const timeRemaining = globalTimer.timeRemaining;

  const socket = getSocket();
  const isOnline = !!(socket?.connected && player.sessionId);

  const [showYearResultsModal, setShowYearResultsModal] = useState(false);
  const [resultsTimeRemaining, setResultsTimeRemaining] = useState(RESULTS_DURATION);
  const resultsTimerRef = useRef(null);

  const [showFinalModal, setShowFinalModal] = useState(false);
  const [showRefusalModal, setShowRefusalModal] = useState(false);
  const [showPostRefusalModal, setShowPostRefusalModal] = useState(false);
  const [showCompanyExchangeModal, setShowCompanyExchangeModal] = useState(false);
  const [exchangeMyRef, setExchangeMyRef] = useState(null);
  const [exchangeCompanyRef, setExchangeCompanyRef] = useState(null);
  const [showYearConfirm, setShowYearConfirm] = useState(false);
  const [refusalRefs, setRefusalRefs] = useState([]);

  const keepCount = globalYear === 5 ? 1 : 2;
  const requiredRefusalCount = Math.max(0, Object.keys(gridCells.owned).length - keepCount);
  const [purchaseModal, setPurchaseModal] = useState(null);

  const [refusalLeft, setRefusalLeft] = useState(0);
  const [inRefusal, setInRefusal] = useState(false);
  const refusalIntervalRef = useRef(null);

  const [selectedLUs, setSelectedLUs] = useState([]);
  const [selectedCol, setSelectedCol] = useState(null);
  const [activeLU, setActiveLU] = useState(null);
  const [sessionCount, setSessionCount] = useState(0);

  const [waiting, setWaiting] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [readyTeamIds, setReadyTeamIds] = useState([]);

  useEffect(() => {
    setGlobalPhase('RESEARCH');
  }, []);

  useEffect(() => {
    if (timeRemaining > 0) return;
    if (inRefusal) return;
    handleYearEnd();
  }, [timeRemaining]);

  useEffect(() => {
    if (showYearConfirm || purchaseModal || showYearResultsModal) pauseGlobalTimer();
    else if (!inRefusal) resumeGlobalTimer();
  }, [showYearConfirm, purchaseModal, showYearResultsModal, inRefusal]);

  useEffect(() => {
    if (!showYearResultsModal) return;
    setResultsTimeRemaining(RESULTS_DURATION);
    resultsTimerRef.current = setInterval(() => {
      setResultsTimeRemaining(prev => {
        if (prev <= 1) { clearInterval(resultsTimerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(resultsTimerRef.current);
  }, [showYearResultsModal]);

  useEffect(() => {
    if (!showYearResultsModal || resultsTimeRemaining > 0) return;
    confirmNextYear();
  }, [resultsTimeRemaining, showYearResultsModal]);

  useEffect(() => {
    if (!socket) return;

    const onReadyStatus = ({ readyCount: rc, totalCount: tc, readyTeams }) => {
      setReadyCount(rc);
      setTotalCount(tc);
      setReadyTeamIds(readyTeams || []);
    };

    const onYearAdvanced = ({ year }) => {
      setWaiting(false);
      const nextYear = year;
      resetEventCardsForNewYear(nextYear);
      applyYearTransitionForAllLUs(nextYear - 1);
      advanceToNextYear();
    };

    const onGameOver = () => {
      setWaiting(false);
      setShowFinalModal(true);
    };

    socket.on('year:ready_status', onReadyStatus);
    socket.on('year:advanced', onYearAdvanced);
    socket.on('game:over', onGameOver);

    return () => {
      socket.off('year:ready_status', onReadyStatus);
      socket.off('year:advanced', onYearAdvanced);
      socket.off('game:over', onGameOver);
    };
  }, [socket]);

  const startRefusalTimer = useCallback(() => {
    setRefusalLeft(REFUSAL_DURATION);
    setInRefusal(true);
    stopGlobalTimer();
    refusalIntervalRef.current = setInterval(() => {
      setRefusalLeft(p => {
        if (p <= 1) { clearInterval(refusalIntervalRef.current); refusalIntervalRef.current = null; return 0; }
        return p - 1;
      });
    }, 1000);
  }, [stopGlobalTimer]);

  const stopRefusalTimer = useCallback(() => {
    if (refusalIntervalRef.current) { clearInterval(refusalIntervalRef.current); refusalIntervalRef.current = null; }
    setInRefusal(false);
  }, []);

  useEffect(() => {
    return () => {
      if (refusalIntervalRef.current) clearInterval(refusalIntervalRef.current);
      if (resultsTimerRef.current) clearInterval(resultsTimerRef.current);
    };
  }, []);

  // Открываем модалку отказа, если пришли с экрана ResultsPanel
  useEffect(() => {
    if (!triggerRefusal) return;
    setTriggerRefusal(false);
    startRefusalTimer();
    setShowRefusalModal(true);
  }, [triggerRefusal]);

  const prevYearRef = useRef(globalYear);
  useEffect(() => {
    if (prevYearRef.current === globalYear) return;
    const prevYear = prevYearRef.current;
    prevYearRef.current = globalYear;

    // После перехода с года отказа — переходим на карту региона с плашкой
    if (REFUSAL_YEARS.includes(prevYear)) {
      setShowRegionMapBanner(true);
    }

    const currentResearch = useGameStore.getState().research;
    const currentEvents = useGameStore.getState().events;

    if (currentResearch.yearTransitionApplied) {
      useGameStore.setState(st => ({ research: { ...st.research, yearTransitionApplied: false } }));
    } else {
      const updProg = { ...currentResearch.progressByLU };
      Object.keys(updProg).forEach(luId => {
        const score =
          currentEvents?.historyByYear?.[prevYear]?.lineScores?.[luId]
          ?? currentEvents?.lineScores?.[luId]
          ?? 0;
        updProg[luId] = applyYearTransition(updProg[luId], prevYear, score);
      });
      useGameStore.setState({ research: { ...currentResearch, progressByLU: updProg } });
    }

    resetSelection();
    setActiveLU(null);
    setGlobalPhase('RESEARCH');
  }, [globalYear]);


  const handleYearEnd = useCallback(() => {
    if (globalYear >= 10) { setTimeout(() => setShowFinalModal(true), 200); return; }
    if (REFUSAL_YEARS.includes(globalYear)) { startRefusalTimer(); setShowRefusalModal(true); return; }
    setTimeout(() => setShowYearResultsModal(true), 200);
  }, [globalYear, startRefusalTimer]);

  const doFinishYear = () => {
    stopGlobalTimer();
    setShowYearConfirm(false);
    if (REFUSAL_YEARS.includes(globalYear)) { startRefusalTimer(); setShowRefusalModal(true); }
    else setShowYearResultsModal(true);
  };

  const goToNextYear = useCallback(() => {
    stopRefusalTimer();
    setShowRefusalModal(false);
    setRefusalRefs([]);
  }, [stopRefusalTimer]);

  const confirmNextYear = useCallback(() => {
    clearInterval(resultsTimerRef.current);
    setShowYearResultsModal(false);
    setResultsTimeRemaining(RESULTS_DURATION);

    if (globalYear >= 10) { setShowFinalModal(true); return; }

    if (isOnline) {
      setWaiting(true);
      setReadyCount(0);
      resetEventCardsForNewYear(globalYear + 1);
      applyYearTransitionForAllLUs(globalYear);

      socket.emit('year:ready', { year: globalYear }, (res) => {
        if (res) { setReadyCount(res.readyCount); setTotalCount(res.totalCount); }
      });
    } else {
      const nextYear = globalYear + 1;
      resetEventCardsForNewYear(nextYear);
      applyYearTransitionForAllLUs(globalYear);
      advanceToNextYear();
    }
  }, [globalYear, isOnline, socket]);


  const handleRefusalAccept = useCallback((refsToRemove = []) => {
    stopRefusalTimer();

    if (refsToRemove.length > 0) {
      if (isOnline && socket?.connected) {
        socket.emit('cell:refusal_release', { cellRefs: refsToRemove }, (res) => {
          if (!res?.ok) {
            console.error('Refusal release failed:', res);
          } else {
            console.log('Refusal released on server:', res.released);
            _applyRefusalLocally(refsToRemove);
          }
        });
      } else {
        _applyRefusalLocally(refsToRemove);
      }
    }

    setRefusalRefs([]);
    setShowRefusalModal(false);
    if (globalYear === 3) {
      setShowPostRefusalModal(true);
    } else {
      goToNextYear();
      setTimeout(() => setShowYearResultsModal(true), 200);
    }
  }, [isOnline, socket, stopRefusalTimer, globalYear, goToNextYear]);

  const _applyRefusalLocally = (refsToRemove) => {
    const st = useGameStore.getState();
    const newOwned = { ...st.gridCells.owned };
    const newAll = { ...st.gridCells.allTeams };
    refsToRemove.forEach(ref => { delete newOwned[ref]; delete newAll[ref]; });

    const WORKS_BY_YEAR = {
      1: ['srr_3d','srr_2d','1pr'], 2: ['srr_3d','srr_2d','1pr'], 3: ['srr_3d','srr_2d','1pr'],
      4: ['srr_3d','srr_2d','1pr','3r'], 5: ['3r'], 6: ['3r'],
      7: ['drilling_5gs','drilling_6gs','drilling_7mzs','testing','mun'],
      8: ['drilling_5gs','drilling_6gs','drilling_7mzs','testing','mun'],
      9: ['drilling_5gs','drilling_6gs','drilling_7mzs','testing','mun'],
      10: ['depression','bsko','ppd','3bs'],
    };
    const year = Math.min(Math.max(st.game.currentYear, 2), 10);
    const works = WORKS_BY_YEAR[year];
    const newScenarios = { ...st.cellScenarios };
    refsToRemove.forEach(ref => {
      newScenarios[ref] = {
        workId: works[Math.floor(Math.random() * works.length)],
        rank: Math.ceil(Math.random() * 3),
        year,
      };
    });

    useGameStore.setState({
      gridCells: { owned: newOwned, allTeams: newAll },
      licenseUnits: { ...st.licenseUnits, current: Object.values(newOwned)[0] || null },
      cellScenarios: newScenarios,
    });
    if (refsToRemove.includes(activeLU?.cellRef)) setActiveLU(null);
    setSelectedLUs(p => p.filter(id => !refsToRemove.includes(id)));
  };

  const handleCompanyExchange = () => {
    if (!exchangeMyRef || !exchangeCompanyRef) return;
    const st = useGameStore.getState();
    const newOwned = { ...st.gridCells.owned };
    const newAll   = { ...st.gridCells.allTeams };

    // Отдаём свой ЛУ
    delete newOwned[exchangeMyRef];
    delete newAll[exchangeMyRef];

    // Получаем ЛУ компании — сценарий уже был сгенерирован заранее в cellScenarios.
    // Если по какой-то причине сценария нет — создаём запасной вариант.
    const existingScenario = st.cellScenarios[exchangeCompanyRef];
    const companyScenario = existingScenario ?? {
      workId: '1pr',
      srrWorkId: Math.random() < 0.5 ? 'srr_2d' : 'srr_3d',
      rank: Math.ceil(Math.random() * 3),
      year: globalYear,
      isCompanyCell: true,
    };

    newOwned[exchangeCompanyRef] = {
      cellRef: exchangeCompanyRef,
      name: `Участок ${exchangeCompanyRef}`,
      ownedByTeamId: player.teamId,
      ownedByTeamName: player.teamName,
      auctionPrice: 0,
      fromCompanyExchange: true,
    };
    newAll[exchangeCompanyRef] = {
      cellRef: exchangeCompanyRef,
      ownedByTeamId: player.teamId,
      ownedByTeamName: player.teamName,
    };

    // Работы, выполненные компанией: 1ПО + СРР 2Д|3Д (оба всегда гарантированы)
    const companyCompletedWorks = [companyScenario.workId];
    if (companyScenario.srrWorkId) companyCompletedWorks.push(companyScenario.srrWorkId);

    // Обновляем cellScenarios только если сценария не было (fallback)
    const cellScenariosUpdate = existingScenario
      ? {}
      : { cellScenarios: { ...st.cellScenarios, [exchangeCompanyRef]: companyScenario } };

    // Инициализируем прогресс НИР для ячейки компании: колонки заблокированы
    const existingProgress = st.research.progressByLU[exchangeCompanyRef] || defaultProgress();
    const companyProgress = {
      ...existingProgress,
      blockedColumns: [...new Set([...(existingProgress.blockedColumns || []), ...companyCompletedWorks])],
      companyCompletedWorks,
    };

    useGameStore.setState({
      gridCells: { owned: newOwned, allTeams: newAll },
      licenseUnits: { ...st.licenseUnits, current: Object.values(newOwned)[0] || null },
      research: {
        ...st.research,
        progressByLU: {
          ...st.research.progressByLU,
          [exchangeCompanyRef]: companyProgress,
        },
      },
      ...cellScenariosUpdate,
    });

    if (activeLU?.cellRef === exchangeMyRef) setActiveLU(null);
    setSelectedLUs(p => p.filter(id => id !== exchangeMyRef));

    if (isOnline && socket?.connected) {
      socket.emit('cell:company_exchange', {
        releaseRef: exchangeMyRef,
        acquireRef: exchangeCompanyRef,
        scenario: companyScenario,
        completedWorks: companyCompletedWorks,
      });
    }

    setExchangeMyRef(null);
    setExchangeCompanyRef(null);
    setShowCompanyExchangeModal(false);
    goToNextYear();
    setTimeout(() => setShowYearResultsModal(true), 200);
  };

  const toggleRefusalRef = (cellRef) => {
    const keep = globalYear === 5 ? 1 : 2;
    const maxRefusal = Math.max(0, Object.keys(useGameStore.getState().gridCells.owned).length - keep);
    setRefusalRefs(prev => {
      if (prev.includes(cellRef)) return prev.filter(r => r !== cellRef);
      if (prev.length >= maxRefusal) return prev;
      return [...prev, cellRef];
    });
  };


  const ownedLUs = useMemo(() =>
    Object.values(gridCells.owned).map(c => ({
      id: c.cellRef, cellRef: c.cellRef,
      name: c.name || `Участок ${c.cellRef}`,
      auctionPrice: c.auctionPrice || 0,
    })),
    [gridCells.owned]);

  // Виды работ берём из конфигурации сессии (правится в админке), иначе — дефолт.
  const researchWorks = useMemo(
    () => normalizeResearchConfig(player.sessionConfig?.researchConfig),
    [player.sessionConfig?.researchConfig]
  );

  const getProgress = useCallback((luId) => research.progressByLU[luId] || defaultProgress(), [research.progressByLU]);

  const allMobilized = useMemo(() => {
    const s = new Set();
    Object.values(research.progressByLU).forEach(p => (p.mobilizedColumns || []).forEach(c => s.add(c)));
    return s;
  }, [research.progressByLU]);

  const colStatus = useCallback((colId, luId) => {
    const mob = MOBILIZATION_WORKS.find(w => w.id === colId);
    if (!mob) return { ok: false, reason: 'Не найден' };
    if (!isColActiveThisYear(colId, globalYear))
      return { ok: false, reason: mob.years?.length ? `Доступен в годы: ${mob.years.join(', ')}` : 'Не в этом году' };
    if (mob.dependency && !allMobilized.has(mob.dependency)) {
      const dep = MOBILIZATION_WORKS.find(w => w.id === mob.dependency);
      return { ok: false, reason: `Требует: ${dep?.name || mob.dependency}` };
    }
    const prog = getProgress(luId);
    if ((prog.blockedColumns || []).includes(colId))
      return { ok: false, reason: 'Заблокирован (события ≥ 0 в прошлом)' };
    const chosenThisYear = prog.columnsByYear?.[globalYear];
    if (chosenThisYear && chosenThisYear !== colId) {
      const lw = MOBILIZATION_WORKS.find(w => w.id === chosenThisYear);
      return { ok: false, reason: `В году ${globalYear} уже выбран: ${lw?.name || chosenThisYear}` };
    }
    const usedByOther = Object.entries(research.progressByLU).some(
      ([id, p]) => id !== luId && !selectedLUs.includes(id) && p.columnsByYear?.[globalYear] === colId
    );
    if (usedByOther) return { ok: false, reason: `Столбец уже используется другим участком в ${globalYear} году` };

    // Ограничения для лет 6–8: из группы A (5ГС/6ГС/7МЗС) — макс 2 в году, из группы B (ППД/МУН) — макс 1 за всю игру
    if (DRILLING_GROUP_A.includes(colId) || DRILLING_GROUP_B.includes(colId)) {
      const activeThisYear = Object.values(research.progressByLU)
        .map(p => p.columnsByYear?.[globalYear])
        .filter(Boolean);
      if (DRILLING_GROUP_A.includes(colId)) {
        const activeA = activeThisYear.filter(c => DRILLING_GROUP_A.includes(c));
        const alreadyChosen = prog.columnsByYear?.[globalYear] === colId;
        if (!alreadyChosen && activeA.length >= 2 && !activeA.includes(colId))
          return { ok: false, reason: 'Уже выбраны 2 из 3 типов бурения в этом году' };
      }
      if (DRILLING_GROUP_B.includes(colId)) {
        // Проверяем все годы 6–8, а не только текущий
        const activeBAllYears = Object.values(research.progressByLU)
          .flatMap(p => Object.entries(p.columnsByYear || {})
            .filter(([yr]) => [6, 7, 8].includes(Number(yr)))
            .map(([, col]) => col))
          .filter(c => DRILLING_GROUP_B.includes(c));
        const alreadyChosenThisYear = prog.columnsByYear?.[globalYear] === colId;
        if (!alreadyChosenThisYear && activeBAllYears.length >= 1 && !activeBAllYears.includes(colId))
          return { ok: false, reason: 'Тип тестирования уже выбран на другом году (6–8)' };
      }
    }

    const usedBefore = Object.values(prog.columnsByYear || {}).includes(colId);
    return { ok: true, reason: '', repeatable: usedBefore };
  }, [globalYear, allMobilized, getProgress, research.progressByLU, selectedLUs]);

  const isLUDone = useCallback((luId) => {
    const prog = getProgress(luId);
    return (prog.skippedYears || []).includes(globalYear) || !!prog.columnsByYear?.[globalYear];
  }, [getProgress, globalYear]);


  const resetSelection = () => { setSelectedLUs([]); setSelectedCol(null); setActiveLU(null); setSessionCount(0); };

  const toggleLU = (lu) => {
    const already = selectedLUs.includes(lu.cellRef);
    if (!already && selectedCol) return;
    if (!already && isLUDone(lu.cellRef)) return;
    setActiveLU(lu);
    setSelectedLUs(prev => {
      if (already) {
        const next = prev.filter(id => id !== lu.cellRef);
        if (next.length === 0) { setSelectedCol(null); setActiveLU(null); }
        return next;
      }
      return [...prev, lu.cellRef];
    });
  };

  const handleColClick = (mob) => {
    if (selectedLUs.length === 0) return;
    if (!isColActiveThisYear(mob.id, globalYear)) return;

    const valid = selectedLUs.filter(luId => colStatus(mob.id, luId).ok);
    if (valid.length === 0) return;

    setSelectedLUs(valid);
    setSelectedCol(prev => prev === mob.id ? null : mob.id);
  };


  const openPurchaseModal = (work, mob) => {
    if (!isColActiveThisYear(mob.id, globalYear)) return;

    if (selectedLUs.length > 0 && selectedCol === mob.id) {
      const cellKey = `${work.id}-${mob.id}`;
      const toBuy = selectedLUs.filter(luId => {
        const s = colStatus(mob.id, luId);
        return s.ok && !getProgress(luId).purchasedCells?.[cellKey];
      });
      if (toBuy.length === 0) return;
      const breakdown = toBuy.map(luId => {
        const needsMob = !(getProgress(luId).mobilizedColumns || []).includes(mob.id);
        return { luId, needsMob, cost: work.cost + (needsMob ? mob.cost : 0) };
      });
      setPurchaseModal({ work, mob, cellKey, multi: true, toBuy, breakdown, total: breakdown.reduce((s, x) => s + x.cost, 0) });
      return;
    }
    if (!activeLU) return;
    const luId = activeLU.cellRef;
    const s = colStatus(mob.id, luId);
    if (!s.ok) return;
    const cellKey = `${work.id}-${mob.id}`;
    const prog = getProgress(luId);
    if (prog.purchasedCells?.[cellKey]) return;
    const needsMob = !(prog.mobilizedColumns || []).includes(mob.id);
    setPurchaseModal({ work, mob, cellKey, multi: false, luId, needsMob, total: work.cost + (needsMob ? mob.cost : 0) });
  };

  const confirmPurchase = () => {
    if (!purchaseModal) return;
    const { work, mob, cellKey, multi } = purchaseModal;

    if (multi) {
      const { breakdown, total, toBuy } = purchaseModal;
      if (player.budget < total) return;

      const purchases = breakdown.map(({ luId, needsMob, cost }) => ({
        luId,
        workId: work.id,
        workName: work.name,
        mobId: mob.id,
        mobName: mob.name,
        needsMob,
        cost,
        year: globalYear,
      }));

      if (isOnline) {
        socket?.emit('research:purchase', { purchases, totalCost: total }, (res) => {
          if (!res?.ok) {
            showAlert?.('Ошибка', res?.error || 'Не удалось списать бюджет');
            return;
          }
        });
      }

      const updProg = { ...research.progressByLU };
      breakdown.forEach(({ luId, needsMob, cost }) => {
        const p = updProg[luId] || defaultProgress();
        const rate = work.successRates[mob.id] || 0;
        const newRate = Math.min((p.successRates?.[mob.id] || 0) + rate, 95);
        const rw = makeResearchWork(work, mob, cellKey, cost, needsMob, rate);
        updProg[luId] = mergePurchase(p, mob, cellKey, rw, newRate, needsMob);
      });

      if (isOnline) {
        useGameStore.setState(st => ({ research: { ...st.research, progressByLU: updProg } }));
      } else {
        useGameStore.setState(st => ({
          player: { ...st.player, budget: st.player.budget - total },
          research: { ...st.research, progressByLU: updProg }
        }));
      }

      setSessionCount(c => c + breakdown.length);
      setPurchaseModal(null);
      return;
    }

    const { luId, needsMob, total } = purchaseModal;
    if (player.budget < total) return;

    if (isOnline) {
      socket?.emit('research:purchase', {
        purchases: [{
          luId,
          workId: work.id,
          workName: work.name,
          mobId: mob.id,
          mobName: mob.name,
          needsMob,
          cost: total,
          year: globalYear,
        }],
        totalCost: total,
      }, (res) => {
        if (!res?.ok) {
          showAlert?.('Ошибка', res?.error || 'Не удалось списать бюджет');
        }
      });
    }

    const p = getProgress(luId);
    const rate = work.successRates[mob.id] || 0;
    const newRate = Math.min((p.successRates?.[mob.id] || 0) + rate, 95);
    const rw = makeResearchWork(work, mob, cellKey, total, needsMob, rate);
    const updProg = { ...useGameStore.getState().research.progressByLU };
    updProg[luId] = mergePurchase(p, mob, cellKey, rw, newRate, needsMob);

    if (isOnline) {
      useGameStore.setState(st => ({ research: { ...st.research, progressByLU: updProg } }));
    } else {
      useGameStore.setState(st => ({
        player: { ...st.player, budget: st.player.budget - total },
        research: { ...st.research, progressByLU: updProg }
      }));
    }

    setSessionCount(c => c + 1);
    setPurchaseModal(null);
  };

  const confirmSession = () => {
    if (!selectedCol || selectedLUs.length === 0) { resetSelection(); return; }
    const updProg = { ...research.progressByLU };
    selectedLUs.forEach(luId => {
      const p = updProg[luId] || defaultProgress();
      updProg[luId] = { ...p, columnsByYear: { ...(p.columnsByYear || {}), [globalYear]: selectedCol } };
    });
    useGameStore.setState({ research: { ...research, progressByLU: updProg } });
    resetSelection();
  };

  const skipResearch = () => {
    if (selectedLUs.length === 0) return;
    const skippable = selectedLUs.filter(luId =>
      (getProgress(luId).purchasedWorksByYear?.[globalYear] || []).length === 0
    );
    if (skippable.length === 0) return;
    skippable.forEach(luId => markYearSkippedForLU?.(luId, globalYear));
    const remaining = selectedLUs.filter(id => !skippable.includes(id));
    if (remaining.length === 0) { resetSelection(); }
    else {
      setSelectedLUs(remaining);
      if (skippable.includes(activeLU?.cellRef)) setActiveLU(ownedLUs.find(l => l.cellRef === remaining[0]) || null);
    }
  };


  const makeResearchWork = (work, mob, cellKey, cost, needsMob, rate) => ({
    id: cellKey, name: `${work.name} | ${mob.name}`, baseCost: cost,
    successRates: { [mob.id]: rate }, workType: work.id, mobilizationType: mob.id,
    metadata: { cellKey, workCost: work.cost, mobilizationCost: needsMob ? mob.cost : 0, successRate: rate, year: globalYear },
  });

  const mergePurchase = (prog, mob, cellKey, rw, newRate, needsMob) => {
    const year = globalYear;
    return {
      ...prog,
      mobilizedColumns: needsMob ? [...new Set([...(prog.mobilizedColumns || []), mob.id])] : (prog.mobilizedColumns || []),
      mobilizedColumnsByYear: needsMob ? appendToYearArr(prog.mobilizedColumnsByYear, year, mob.id) : (prog.mobilizedColumnsByYear || {}),
      columnsByYear: { ...(prog.columnsByYear || {}), [year]: mob.id },
      purchasedWorks: [...(prog.purchasedWorks || []), rw],
      purchasedWorksByYear: appendToYearArr(prog.purchasedWorksByYear, year, rw),
      purchasedCells: { ...(prog.purchasedCells || {}), [cellKey]: { ...rw, successRate: rw.metadata.successRate } },
      purchasedCellsByYear: appendToYearMap(prog.purchasedCellsByYear, year, cellKey, { ...rw, successRate: rw.metadata.successRate }),
      successRates: { ...(prog.successRates || {}), [mob.id]: newRate },
      successRatesByYear: appendRateToYear(prog.successRatesByYear, prog.successRatesByYear?.[year], year, mob.id, newRate),
      totalSpent: (prog.totalSpent || 0) + rw.baseCost,
      spentByYear: { ...(prog.spentByYear || {}), [year]: (prog.spentByYear?.[year] || 0) + rw.baseCost },
    };
  };

  const appendToYearArr = (obj, year, item) => { const o = obj || {}; return { ...o, [year]: [...(o[year] || []), item] }; };
  const appendToYearMap = (obj, year, key, val) => { const o = obj || {}; return { ...o, [year]: { ...(o[year] || {}), [key]: val } }; };
  const appendRateToYear = (byYear, cur, year, colId, rate) => { const o = byYear || {}; return { ...o, [year]: { ...(cur || {}), [colId]: rate } }; };


  const totalSpent =
    Object.values(research.progressByLU).reduce((s, p) => s + (p.totalSpent || 0), 0) +
    (fieldWork.totalSpent || 0) +
    (events.totalMoneySpent || 0) +
    (licenseUnits?.owned ?? []).reduce((s, lu) => s + (lu.cost || 0), 0) +
    Object.values(gridCells?.owned ?? {}).reduce((s, c) => s + (c.auctionPrice || 0), 0);


  const ROWS = ['A','B','C','D','E','F','G','H','I','J'];
  const COLS = [1,2,3,4,5,6,7,8,9,10];
  const sceneImages = useMemo(() => {
    const map = {};
    for (const row of ROWS) {
      for (const col of COLS) {
        const cellRef = `${row}${col}`;
        if (gridCells.owned[cellRef]) {
          const img = getLastSuccessfulSceneImage(cellRef, fieldWork.selectionsByLU?.[cellRef], events, globalYear);
          if (img) {
            map[cellRef] = img;
          } else {
            // Участок получен от нефтяной компании — показываем сценарий до начала полевых работ
            const scenario = cellScenarios[cellRef];
            if (scenario?.workId) {
              const scenNum = getScenario(cellRef) ?? 0;
              const maxRows = WORK_SCENE_MAP[scenario.workId]?.rows ?? 3;
              const rank = Math.min(scenario.rank ?? 1, maxRows);
              const img2 = resolveSceneImage(scenNum, scenario.workId, rank, 'к');
              if (img2) map[cellRef] = img2;
            }
          }
        } else if (otherTeamsScene[cellRef]) {
          const scene = otherTeamsScene[cellRef];
          const img = getSceneImageFromMeta(cellRef, scene.metaByYear, scene.evScoreByYear);
          if (img) map[cellRef] = img;
        } else {
          const scenario = cellScenarios[cellRef];
          if (scenario) {
            const scenNum = getScenario(cellRef) ?? 0;
            const rawRank = scenNum <= 1 ? 1 : scenNum <= 3 ? 2 : 3;
            const maxRows = WORK_SCENE_MAP[scenario.workId]?.rows ?? 3;
            const rank = Math.min(rawRank, maxRows);
            const img = resolveSceneImage(scenNum, scenario.workId, rank, 'к');
            if (img) map[cellRef] = img;
          }
        }
      }
    }
    return map;
  }, [gridCells.owned, fieldWork.selectionsByLU, events, globalYear, otherTeamsScene, cellScenarios]);

  const getResultsTimerColor = () => {
    if (resultsTimeRemaining <= 10) return { bg: '#ffebee', border: '#c62828', text: '#c62828' };
    if (resultsTimeRemaining <= 30) return { bg: '#fff3e0', border: '#ff9800', text: '#ff9800' };
    if (resultsTimeRemaining <= 60) return { bg: '#fff8e1', border: '#fbc02d', text: '#f57f17' };
    return { bg: '#e3f2fd', border: '#1565c0', text: '#1565c0' };
  };


  const activeProg = activeLU ? getProgress(activeLU.cellRef) : null;
  const multiMode = selectedLUs.length > 0;
  const canSkipAny = selectedLUs.some(luId => (getProgress(luId).purchasedWorksByYear?.[globalYear] || []).length === 0);

  const allLUsDoneThisYear = useMemo(() => {
    if (ownedLUs.length === 0) return false;
    return ownedLUs.every(lu => isLUDone(lu.cellRef));
  }, [ownedLUs, isLUDone]);

  const colRateActive = useCallback((colId) => {
    const targetProgs = multiMode && selectedLUs.length > 0
      ? selectedLUs.map(id => research.progressByLU[id] || defaultProgress())
      : activeProg ? [activeProg] : [];

    if (targetProgs.length === 0) return 0;

    let maxRate = 0;
    targetProgs.forEach(prog => {
      let sum = 0;
      Object.values(prog.purchasedCells || {}).forEach(c => {
        if (c.mobilizationType === colId) sum += (c.successRate || 0);
      });
      maxRate = Math.max(maxRate, Math.min(sum, 95));
    });
    return maxRate;
  }, [multiMode, selectedLUs, activeProg, research.progressByLU]);


  return (
    <div className={styles.researchPanel}>

      {inRefusal
        ? <GlobalTimer
            label="Время на решение"
            valueOverride={fmt(refusalLeft)}
            subtitleOverride={`Отказ от участка (год ${globalYear})`}
            forceWarning
          />
        : <GlobalTimer
            finishedLabel="Ход завершён"
            finishedText="Исследования завершены"
          />
      }

      <div className={styles.researchMapControls}>
        <button className={`${styles.researchControlBtn} ${styles.researchBackBtn}`} onClick={onBack}>← Назад</button>
        <button className={`${styles.researchControlBtn} ${styles.researchBackBtn}`} onClick={onMenu}>В меню</button>
        <button
          className={`${styles.researchControlBtn} ${styles.researchNextBtn}`}
          onClick={allLUsDoneThisYear ? onComplete : undefined}
          disabled={!allLUsDoneThisYear}
          title={!allLUsDoneThisYear ? 'Завершите или пропустите НИРы для всех участков' : ''}
          style={!allLUsDoneThisYear ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
        >
          {allLUsDoneThisYear ? 'Далее — К зоне событий' : `Осталось: ${ownedLUs.filter(lu => !isLUDone(lu.cellRef)).length} уч.`}
        </button>
      </div>

      <div className={styles.researchHeader}>
        <h2>Научные исследования</h2>

        {ownedLUs.length === 0 ? (
          <div style={{ padding: '1rem', background: '#ffebee', borderRadius: 8, border: '2px solid #c62828' }}>
            <span style={{ color: '#c62828', fontWeight: 700 }}>Нет купленных участков. Вернитесь на карту.</span>
          </div>
        ) : (
          <div style={{ width: '100%' }}>
            <div style={{ marginBottom: '0.5rem', fontWeight: 700, color: '#333' }}>
              {!multiMode
                ? 'Шаг 1 — Выберите лицензионные участки ниже'
                : !selectedCol
                  ? <>Шаг 2 — Выберите столбец (клик по заголовку таблицы)<span className={styles.stepArrow}></span></>
                  : 'Шаг 3 — Кликайте по ячейкам и подтвердите'}
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              {ownedLUs.map(lu => {
                const prog = getProgress(lu.cellRef);
                const inGroup = selectedLUs.includes(lu.cellRef);
                const done = isLUDone(lu.cellRef) && !inGroup;
                const skipped = (prog.skippedYears || []).includes(globalYear);
                const blocked = prog.blockedColumns || [];
                const nirCount = (prog.purchasedWorksByYear?.[globalYear] || []).length;
                const prevYear = globalYear - 1;
                const evScore = events?.historyByYear?.[prevYear]?.lineScores?.[lu.cellRef] ?? events?.lineScores?.[lu.cellRef] ?? null;
                const prevColId = prevYear > 0 ? prog.columnsByYear?.[prevYear] : null;
                const prevColName = prevColId ? MOBILIZATION_WORKS.find(w => w.id === prevColId)?.name : null;

                return (
                  <div
                    key={lu.cellRef}
                    onClick={() => !done && toggleLU(lu)}
                    className={`${styles.luCard} ${inGroup ? styles.luCardActive : ''} ${done && !inGroup ? styles.luCardDone : ''}`}
                  >
                    <div className={styles.luCardName}>{inGroup && '✓ '}{lu.name}</div>
                    {done && (
                      <span
                        className={styles.luBadge}
                        style={{ color: skipped ? '#e65100' : '#2fa394', background: skipped ? '#fff3e0' : '#e8f5f3' }}
                      >
                        {skipped ? 'Пропущен' : 'Использован'} (год {globalYear})
                      </span>
                    )}
                    {prevColName && evScore !== null && prevYear > 0 && (
                      <div className={styles.luCardScore} style={{ color: evScore >= 0 ? (inGroup ? 'rgba(255,255,255,.85)' : '#2e7d32') : (inGroup ? 'rgba(255,220,200,1)' : '#c62828') }}>
                        {evScore >= 0 ? `+${evScore}` : evScore} по «{prevColName}»{evScore < 0 ? ' ↺' : ''}
                      </div>
                    )}
                    {nirCount > 0 && <div className={styles.luCardNir}>{nirCount} НИР куплено</div>}
                    {blocked.length > 0 && (
                      <div className={styles.luCardBlocked} style={{ color: inGroup ? 'rgba(255,255,255,.6)' : '#999' }}>
                        Заблок.: {blocked.map(c => MOBILIZATION_WORKS.find(w => w.id === c)?.name || c).join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {multiMode && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
                {sessionCount > 0 && (
                  <button onClick={confirmSession} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#2fa394,#1a7a6e)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem' }}>
                    ✓ Подтвердить НИРы ({sessionCount}) — завершить
                  </button>
                )}
                {canSkipAny && (
                  <button onClick={skipResearch} style={{ padding: '8px 16px', background: '#fff', color: '#e53935', border: '2px solid #e53935', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}>
                    Отказаться от исследований
                  </button>
                )}
              </div>
            )}

            {!multiMode && !activeLU && !allLUsDoneThisYear && ownedLUs.length > 0 && (
              <div style={{ padding: '6px 12px', background: '#fff3e0', borderRadius: 7, border: '1px solid #ffe082', color: '#e65100', fontSize: '0.85rem', marginTop: 4 }}>
                <strong>Не все участки обработаны:</strong>{' '}
                {ownedLUs.filter(lu => !isLUDone(lu.cellRef)).map(lu => lu.name).join(', ')}
              </div>
            )}

          </div>
        )}

        <div className={styles.luBudgetSection}>
          <BudgetBar
            budget={player.budget}
            spent={totalSpent}
            phaseSpent={Object.values(research.progressByLU).reduce((s, p) => s + (p.spentByYear?.[globalYear] || 0), 0)}
            theme="light"
          />
        </div>

        {(multiMode || activeLU) && (() => {
          const targetLUIds = multiMode ? selectedLUs : [activeLU?.cellRef].filter(Boolean);
          const activeColId = selectedCol
            || (activeLU ? getProgress(activeLU.cellRef).columnsByYear?.[globalYear] : null);

          if (!activeColId || targetLUIds.length === 0) return null;

          const mob = MOBILIZATION_WORKS.find(m => m.id === activeColId);
          if (!mob) return null;

          const items = targetLUIds.map(luId => {
            const prog = getProgress(luId);
            let sum = 0;
            Object.values(prog.purchasedCells || {}).forEach(c => {
              if (c.mobilizationType === activeColId) sum += (c.successRate || 0);
            });
            const rate = Math.min(sum, 95);
            const luName = ownedLUs.find(l => l.cellRef === luId)?.name || luId;
            return { luId, luName, rate };
          });

          const hasPurchases = items.some(i => i.rate > 0);
          if (!hasPurchases) return null;

          const shortColName = mob.name.replace(/^Успешность\s+/i, '');

          return (
            <div style={{
              marginTop: 10, padding: '8px 14px', background: '#e8f5e9',
              borderRadius: 8, border: '1px solid #a5d6a7',
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '0.78rem', color: '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {shortColName}
              </span>
              <span style={{ fontSize: '0.85rem', color: '#555' }}>
                {items.map(i => i.luName).join(', ')}
              </span>
              <span style={{ fontSize: '0.85rem', color: '#555' }}>
                Успешность
              </span>

              <span style={{
                fontSize: '1.2rem', fontWeight: 800, lineHeight: 1,
                color: (() => {
                  const maxRate = Math.max(...items.map(i => i.rate));
                  return maxRate >= 60 ? '#2e7d32' : maxRate >= 40 ? '#f9a825' : maxRate > 0 ? '#c62828' : '#bbb';
                })(),
              }}>
                {items[0]?.rate > 0 ? `${items[0].rate}%` : '—'}
              </span>
            </div>
          );
        })()}
      </div>

      <div className={styles.roundIndicator}>
        <div className={styles.yearInfo}>
          <span className={styles.yearLabel}>Год:</span>
          <span className={styles.yearValue}>{globalYear}</span>
          <span style={{ color: '#fff', fontSize: '0.85rem', marginLeft: 8, opacity: .85 }}>{iterLabel(globalYear)}</span>
        </div>
        <button
          onClick={() => setShowYearConfirm(true)}
          disabled={inRefusal || timeRemaining <= 0 || globalYear >= 10}
          className={styles.skipYearBtn}
          style={{
            marginLeft: 15, padding: '4px 12px',
            background: 'transparent',
            color: (!inRefusal && timeRemaining > 0) ? '#78909c' : '#ccc',
            border: `1px solid ${(!inRefusal && timeRemaining > 0) ? '#b0bec5' : '#ccc'}`,
            borderRadius: 5, cursor: 'pointer', fontWeight: 400, fontSize: '0.82rem',
          }}
        >
          Завершить год
        </button>
      </div>

      <div className={styles.groupLegend}>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ background: '#757575' }} />
          <span className={styles.legendText}>Сейсморазведка</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ background: '#f4511e' }} />
          <span className={styles.legendText}>Поисково-разведочное бурение</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ background: '#8d6e63' }} />
          <span className={styles.legendText}>Проектирование разработки</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ background: '#1976d2' }} />
          <span className={styles.legendText}>Управление разработкой</span>
        </div>
      </div>

      <div className={styles.researchTableContainer}>
        <div className={styles.researchTableScroll}>
          <table className={`${styles.researchTable} ${styles.battleship}`}>
            <thead>
              <tr>
                <th className={styles.colWorkName}>Вид работ</th>
                <th className={styles.colCost}>Стоимость</th>
                {MOBILIZATION_WORKS.map((mob) => {
                  const { cls, label, ids } = getColGroup(mob.id);
                  const isFirstInGroup = ids[0] === mob.id;
                  const active = isColActiveThisYear(mob.id, globalYear);
                  const isSelected = multiMode && selectedCol === mob.id;
                  const hasDep = mob.dependency && !allMobilized.has(mob.dependency);

                  const blockedForActive = activeLU && !multiMode
                    ? (getProgress(activeLU.cellRef).blockedColumns || []).includes(mob.id)
                    : false;
                  const repeatableForActive = activeLU && !multiMode && !blockedForActive
                    ? Object.values(getProgress(activeLU.cellRef).columnsByYear || {}).includes(mob.id)
                    : false;

                  const blockedCount = multiMode
                    ? selectedLUs.filter(id => (getProgress(id).blockedColumns || []).includes(mob.id)).length
                    : 0;
                  const allBlocked = multiMode && selectedLUs.length > 0 && blockedCount === selectedLUs.length;
                  const validCount = multiMode
                    ? selectedLUs.filter(id => colStatus(mob.id, id).ok).length
                    : 0;
                  const noneValid = multiMode && selectedLUs.length > 0 && validCount === 0;

                  const takenByOther = active && Object.entries(research.progressByLU).some(
                    ([id, p]) => !selectedLUs.includes(id) && p.columnsByYear?.[globalYear] === mob.id
                  );

                  const fullyDisabled = !active || hasDep || takenByOther
                    || (blockedForActive && !multiMode)
                    || (noneValid && multiMode);

                  const clickable = multiMode && active && !noneValid && !hasDep && !takenByOther;

                  let hClass = `${styles[cls] || ''}`;
                  if (!active) {
                    hClass += ` ${styles.colYearInactive}`;
                  } else if (isSelected) {
                    hClass += ` ${styles.mobilized}`;
                  } else if (takenByOther || (blockedForActive && !multiMode) || (noneValid && multiMode)) {
                    hClass += ` ${styles.locked}`;
                  } else {
                    hClass += ` ${styles.available}`;
                  }

                  return (
                    <th key={mob.id} className={`${styles.colMob} ${hClass}`}
                      onClick={() => clickable && handleColClick(mob)}
                      style={{
                        cursor: clickable ? 'pointer' : 'default',
                        outline: isSelected ? '3px solid #ff9800' : 'none',
                        outlineOffset: '-3px',
                        filter: !active ? 'grayscale(1)' : 'none',
                        opacity: !active ? 0.4 : fullyDisabled ? 0.45 : 1,
                      }}
                      title={
                        !active ? `Доступен в годы: ${mob.years?.join(', ') || '—'}`
                          : isSelected ? 'Выбран — повторный клик снимает'
                            : hasDep ? `Требует: ${MOBILIZATION_WORKS.find(w => w.id === mob.dependency)?.name}`
                              // : takenByOther ? `Занят другим участком в ${globalYear} году`
                                : blockedForActive ? 'Заблокирован (события ≥ 0)'
                                  : noneValid && multiMode ? 'Недоступен для всех выбранных участков'
                                    : repeatableForActive ? '↺ Доступен повторно (события < 0)'
                                      : clickable ? 'Нажмите для выбора' : ''
                      }
                    >
                      {isFirstInGroup && <div className={styles.groupHeader}>{label}</div>}
                      <div className={styles.mobHeader}>
                        <span className={styles.mobName}>{mob.name}</span>
                        <span className={styles.mobCost}>{mob.cost} млн</span>
                        <span className={styles.mobYears}>{mob.years?.length ? `Годы: ${mob.years.join(', ')}` : ''}</span>
                        {!active && <span className={styles.mobLocked}>Не в этом году</span>}
                        {active && hasDep && <span className={styles.mobLocked}>Требует зависимость</span>}
                        {active && takenByOther && <span className={styles.mobLocked} style={{ color: '#ffffff' }}>Занят в {globalYear}г</span>}
                        {active && blockedForActive && !multiMode && <span className={styles.mobLocked} style={{ color: '#bdbdbd' }}>Заблокирован</span>}
                        {active && repeatableForActive && !multiMode && <span className={styles.mobLocked} style={{ color: '#ff9800' }}>↺ Повтор</span>}
                        {active && multiMode && blockedCount > 0 && !noneValid && <span className={styles.mobLocked} style={{ color: '#ffccbc' }}>{blockedCount} заблок.</span>}
                        {active && noneValid && multiMode && <span className={styles.mobLocked} style={{ color: '#bdbdbd' }}>Недоступен</span>}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {researchWorks.map(work => (
                <tr key={work.id}>
                  <td className={styles.workName}>{work.name}</td>
                  <td className={styles.workCost}>{work.cost} млн</td>
                  {MOBILIZATION_WORKS.map((mob) => {
                    const { cls } = getColGroup(mob.id);
                    const cellKey = `${work.id}-${mob.id}`;
                    const active = isColActiveThisYear(mob.id, globalYear);
                    const isSelCol = multiMode && selectedCol === mob.id;
                    const rate = work.successRates[mob.id] || 0;

                    const boughtByMe = multiMode
                      ? selectedLUs.length > 0 && selectedLUs.every(id => !!getProgress(id).purchasedCells?.[cellKey])
                      : !!(activeProg?.purchasedCells?.[cellKey]);

                    const someBought = multiMode
                      ? selectedLUs.some(id => !!getProgress(id).purchasedCells?.[cellKey])
                      : false;

                    const displayRate = multiMode
                      ? (() => {
                        const buyer = selectedLUs.find(id => !!getProgress(id).purchasedCells?.[cellKey]);
                        return buyer ? (getProgress(buyer).purchasedCells[cellKey]?.successRate ?? rate) : rate;
                      })()
                      : rate;

                    const blockedMe = activeLU && !multiMode && !boughtByMe
                      ? (getProgress(activeLU.cellRef).blockedColumns || []).includes(mob.id)
                      : false;
                    const repeatMe = activeLU && !multiMode && !blockedMe && !boughtByMe
                      ? Object.values(getProgress(activeLU.cellRef).columnsByYear || {}).includes(mob.id)
                      : false;

                    const validLUsForSel = isSelCol ? selectedLUs.filter(id => colStatus(mob.id, id).ok) : [];
                    const allBought = isSelCol && validLUsForSel.length > 0 && validLUsForSel.every(id => !!getProgress(id).purchasedCells?.[cellKey]);
                    const canClickMulti = isSelCol && active && validLUsForSel.length > 0 && !allBought;
                    const canClickSingle = !multiMode && activeLU && !boughtByMe && active && !blockedMe && colStatus(mob.id, activeLU.cellRef).ok;
                    const clickable = canClickMulti || canClickSingle;

                    const colNoneValid = multiMode && selectedLUs.length > 0
                      && selectedLUs.filter(id => colStatus(mob.id, id).ok).length === 0;

                    if (!active) {
                      return (
                        <td key={mob.id} className={`${styles.cell} ${styles[cls] || ''} ${styles.cellYearInactive}`}
                          style={{ cursor: 'not-allowed', opacity: 0.25, filter: 'grayscale(1)' }}
                          title={`Доступен в годы: ${mob.years?.join(', ') || '—'}`}
                        >
                          <div className={styles.cellUnavailable}>
                            <span className={styles.cellLockIcon}>—</span>
                          </div>
                        </td>
                      );
                    }

                    let cCls = `${styles.cell} ${styles[cls] || ''}`;
                    if (boughtByMe) cCls += ` ${styles.purchased}`;
                    else if (someBought) cCls += ` ${styles.purchased}`;
                    else if (blockedMe) cCls += ` ${styles.pastPurchased}`;
                    else if (repeatMe) cCls += ` ${styles.repeatable}`;
                    else if (colNoneValid) cCls += ` ${styles.unavailable}`;
                    else if (clickable) cCls += ` ${styles.available}`;
                    else cCls += ` ${styles.unavailable}`;

                    return (
                      <td key={mob.id} className={cCls}
                        onClick={() => clickable && openPurchaseModal(work, mob)}
                        style={{
                          cursor: clickable ? 'pointer' : 'not-allowed',
                          outline: isSelCol && !colNoneValid ? '2px solid rgba(255,152,0,.4)' : 'none',
                          outlineOffset: '-2px',
                          opacity: (blockedMe || colNoneValid) ? 0.35 : 1,
                        }}
                        title={
                          boughtByMe ? `Куплено: +${displayRate}%`
                            : someBought ? `Частично куплено: +${displayRate}%`
                              : blockedMe ? 'Заблокирован'
                                : colNoneValid ? 'Недоступен для выбранных участков'
                                  : repeatMe ? '↺ Доступен повторно'
                                    : canClickMulti ? `Купить для ${validLUsForSel.length} уч.`
                                      : canClickSingle ? 'Нажмите для покупки' : 'Недоступно'
                        }
                      >
                        {boughtByMe ? (
                          <div className={styles.cellPurchased}><span className={styles.cellRate}>{displayRate}%</span></div>
                        ) : someBought ? (
                          <div className={styles.cellPurchased} style={{ opacity: 0.6 }}><span className={styles.cellRate}>~{displayRate}%</span></div>
                        ) : blockedMe || colNoneValid ? (
                          <div className={styles.cellUnavailable}><span className={styles.cellLockIcon}>✕</span></div>
                        ) : repeatMe ? (
                          <div className={styles.cellAvailable}><span className={styles.cellHiddenRate}>↺</span><span className={styles.cellHoverInfo}>Повтор</span></div>
                        ) : (
                          <div className={styles.cellAvailable}>
                            <span className={styles.cellHiddenRate}>?</span>
                            <span className={styles.cellHoverInfo}>{canClickMulti && validLUsForSel.length > 1 ? `×${validLUsForSel.length}` : 'Купить'}</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr className={styles.totalsRow}>
                <td colSpan="2" className={styles.totalsLabel}><strong>Итоговая успешность:</strong></td>
                {MOBILIZATION_WORKS.map((mob) => {
                  const { cls } = getColGroup(mob.id);
                  const active = isColActiveThisYear(mob.id, globalYear);
                  const succ = colRateActive(mob.id);

                  const checkProgs = multiMode && selectedLUs.length > 0
                    ? selectedLUs.map(id => research.progressByLU[id] || defaultProgress())
                    : activeProg ? [activeProg] : [];

                  const bought = checkProgs.some(prog =>
                    Object.keys(prog.purchasedCells || {}).some(k => k.endsWith(`-${mob.id}`))
                  );

                  const blocked = !multiMode && activeLU
                    ? (getProgress(activeLU.cellRef).blockedColumns || []).includes(mob.id)
                    : false;
                  const repeat = !multiMode && activeLU && !blocked
                    ? Object.values(getProgress(activeLU.cellRef).columnsByYear || {}).includes(mob.id)
                    : false;

                  if (!active) {
                    return (
                      <td key={mob.id} className={`${styles.totalsCell} ${styles[cls] || ''}`}
                        style={{ opacity: 0.25, filter: 'grayscale(1)' }}>
                        <span style={{ color: '#bbb', fontSize: '0.9rem' }}>—</span>
                      </td>
                    );
                  }

                  return (
                    <td key={mob.id} className={`${styles.totalsCell} ${styles[cls] || ''}`}>
                      {bought
                        ? <span className={`${styles.totalSuccess} ${succ >= 60 ? styles.high : succ >= 40 ? styles.medium : styles.low}`}>{succ}%</span>
                        : blocked ? <span style={{ color: '#bdbdbd', fontSize: '0.9rem' }}>✕</span>
                          : repeat ? <span style={{ color: '#ff9800', fontSize: '0.9rem' }}>↺</span>
                            : <span className={styles.lockedTotal}>?</span>}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {showYearConfirm && (
        <div className={styles.cellModalOverlay} onClick={() => setShowYearConfirm(false)}>
          <div className={styles.cellModal} onClick={e => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => setShowYearConfirm(false)}>✕</button>
            <h3 style={{ color: '#ff9800' }}>Завершить год {globalYear}?</h3>
            <div className={styles.modalInfo}>
              <p style={{ textAlign: 'center', color: '#d32f2f', fontWeight: 600 }}>Оставшееся время будет потеряно!</p>
              <p style={{ textAlign: 'center', color: '#666' }}>Осталось: {fmt(timeRemaining)}</p>
              {REFUSAL_YEARS.includes(globalYear) && <p style={{ textAlign: 'center', color: '#e65100', fontWeight: 'bold', marginTop: 8 }}>Этот год — год возможного отказа от участков</p>}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.purchaseModalBtn} onClick={doFinishYear} style={{ background: '#ff9800' }}>Да, завершить</button>
              <button className={styles.cancelModalBtn} onClick={() => setShowYearConfirm(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {purchaseModal && (
        <div className={styles.cellModalOverlay} onClick={() => setPurchaseModal(null)}>
          <div className={styles.cellModal} onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <button className={styles.closeModal} onClick={() => setPurchaseModal(null)}>✕</button>
            <p style={{ margin: '0 0 2px', fontSize: '0.75rem', color: '#999', fontWeight: 400 }}>
              {purchaseModal.multi
                ? `${purchaseModal.toBuy.length} участка · ${purchaseModal.toBuy.map(id => ownedLUs.find(l => l.cellRef === id)?.name || id).join(', ')}`
                : ownedLUs.find(l => l.cellRef === purchaseModal.luId)?.name || purchaseModal.luId}
            </p>
            <p style={{ margin: '0 0 1.25rem', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.4, paddingRight: '2rem', color: '#333' }}>{purchaseModal.work.name}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1rem' }}>
              {purchaseModal.multi ? (
                purchaseModal.breakdown.some(b => b.needsMob) && (
                  <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>Мобилизация</div>
                    {purchaseModal.breakdown.map(({ luId, needsMob }) => {
                      const luName = ownedLUs.find(l => l.cellRef === luId)?.name || luId;
                      return needsMob
                        ? <div key={luId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', padding: '2px 0' }}><span style={{ color: '#555' }}>{luName}</span><span style={{ color: '#333', fontWeight: 600 }}>{purchaseModal.mob.cost} млн</span></div>
                        : <div key={luId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', padding: '2px 0' }}><span style={{ color: '#aaa' }}>{luName}</span><span style={{ color: '#aaa', fontSize: '0.8rem' }}>оплачена ✓</span></div>;
                    })}
                  </div>
                )
              ) : (
                <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>Мобилизация</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span style={{ color: '#555' }}>{purchaseModal.mob.name}</span>
                    {purchaseModal.needsMob ? <span style={{ color: '#333', fontWeight: 600 }}>{purchaseModal.mob.cost} млн</span> : <span style={{ color: '#aaa', fontSize: '0.8rem' }}>оплачена ✓</span>}
                  </div>
                </div>
              )}
              <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: '0.7rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>НИР</div>
                {purchaseModal.multi
                  ? purchaseModal.breakdown.map(({ luId }) => { const n = ownedLUs.find(l => l.cellRef === luId)?.name || luId; return <div key={luId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', padding: '2px 0' }}><span style={{ color: '#555' }}>{n}</span><span style={{ color: '#333', fontWeight: 600 }}>{purchaseModal.work.cost} млн</span></div>; })
                  : <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}><span style={{ color: '#555' }}>{purchaseModal.work.name}</span><span style={{ color: '#333', fontWeight: 600 }}>{purchaseModal.work.cost} млн</span></div>}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: player.budget < purchaseModal.total ? '#ffebee' : '#e8f5e9', borderRadius: 8, padding: '10px 14px', marginBottom: '1.25rem' }}>
              <span style={{ fontWeight: 600, color: player.budget < purchaseModal.total ? '#c62828' : '#2e7d32', fontSize: '0.9rem' }}>
                {player.budget < purchaseModal.total ? '⚠ Недостаточно средств' : 'Итого'}
              </span>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: player.budget < purchaseModal.total ? '#c62828' : '#2e7d32' }}>{purchaseModal.total} млн руб.</span>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.purchaseModalBtn} onClick={confirmPurchase} disabled={player.budget < purchaseModal.total}>Купить</button>
              <button className={styles.cancelModalBtn} onClick={() => setPurchaseModal(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {showYearResultsModal && (() => {
        const timerColors = getResultsTimerColor();
        return (
          <div className={styles.cellModalOverlay}>
            <div className={styles.cellModal} onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
              <h3 style={{ textAlign: 'center', color: '#1565c0', marginBottom: 12 }}>Итоги {globalYear} года</h3>
              <div style={{ textAlign: 'center', padding: '10px 16px', background: timerColors.bg, borderRadius: 8, border: `2px solid ${timerColors.border}`, marginBottom: 16 }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: timerColors.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.05em' }}>{fmt(resultsTimeRemaining)}</div>
                <div style={{ fontSize: '0.82rem', color: '#666', marginTop: 2 }}>{globalYear >= 10 ? 'Автопереход к завершению' : `Автопереход на год ${globalYear + 1}`}</div>
              </div>
              <div className={styles.modalInfo}>
                <p style={{ textAlign: 'center', marginBottom: 10, color: '#444', fontSize: '0.9rem' }}>Результаты в <strong>{globalYear} году</strong></p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.values(gridCells.owned).map(cell => {
                    const prog = research.progressByLU[cell.cellRef] || defaultProgress();
                    const worksThisYear = (prog.purchasedWorksByYear?.[globalYear] || []).length;
                    const col = prog.columnsByYear?.[globalYear];
                    const colName = col ? MOBILIZATION_WORKS.find(m => m.id === col)?.name : null;
                    const skipped = (prog.skippedYears || []).includes(globalYear);
                    const spent = (prog.purchasedWorksByYear?.[globalYear] || []).reduce((s, w) => s + (w.baseCost || 0), 0);
                    return (
                      <div key={cell.cellRef} style={{ padding: '8px 12px', background: '#f8f9fa', borderRadius: 8, border: '1px solid #e0e0e0' }}>
                        <div style={{ fontWeight: 700, marginBottom: 3, color: '#222' }}>{cell.name || `Участок ${cell.cellRef}`}</div>
                        {skipped ? <div style={{ color: '#ff9800', fontSize: '0.85rem' }}>Исследования пропущены</div>
                          : colName ? <><div style={{ fontSize: '0.85rem', color: '#555' }}>Направление: <strong>{colName}</strong></div><div style={{ fontSize: '0.85rem', color: '#555' }}>НИР: <strong>{worksThisYear}</strong> шт. · Потрачено: <strong>{spent} млн</strong></div></>
                            : <div style={{ fontSize: '0.85rem', color: '#999' }}>Направление не выбрано</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className={styles.modalActions} style={{ marginTop: 16 }}>
                <button className={styles.purchaseModalBtn} onClick={confirmNextYear}>{globalYear >= 10 ? 'Завершить игру' : `Перейти на год ${globalYear + 1}`}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {waiting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '2.5rem', maxWidth: 480, width: '90%', boxShadow: '0 10px 50px rgba(0,0,0,0.4)', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
            <h3 style={{ color: '#2e7d32', marginBottom: '0.5rem', fontSize: '1.4rem' }}>Ожидание перехода к году {globalYear + 1}</h3>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>Ждём пока все команды завершат год {globalYear}</p>
            <div style={{ background: '#f0f0f0', borderRadius: 8, height: 12, marginBottom: '1rem', overflow: 'hidden' }}>
              <div style={{ width: `${(readyCount / Math.max(totalCount, 1)) * 100}%`, height: '100%', background: '#2fa394', borderRadius: 8, transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#333', marginBottom: '1rem' }}>{readyCount} / {totalCount} команд готовы</div>
            {readyTeamIds.length > 0 && (
              <div style={{ textAlign: 'left', background: '#f8f9fa', borderRadius: 8, padding: '0.75rem 1rem' }}>
                {readyTeamIds.map((id, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: '0.9rem', color: '#444' }}><span style={{ color: '#2fa394', fontWeight: 700 }}>✓</span> {id}</div>)}
              </div>
            )}
            <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#aaa' }}>Переход произойдёт автоматически когда все будут готовы</p>
          </div>
        </div>
      )}

      {showRefusalModal && (
        <div className={styles.cellModalOverlay}>
          <div className={styles.cellModal} onClick={e => e.stopPropagation()} style={{ maxWidth: 700, width: '95%' }}>
            <h3 style={{ textAlign: 'center', color: '#e65100' }}>Отказ от лицензионных участков</h3>
            <div className={styles.modalInfo}>
              <div style={{ textAlign: 'center', padding: '6px 14px', background: '#fff3e0', borderRadius: 8, border: '2px solid #ff9800', margin: '0 0 8px 0' }}>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#e65100' }}>Время: {fmt(refusalLeft)}</span>
              </div>
              {globalYear === 5 ? (
                <p style={{ textAlign: 'center', lineHeight: 1.5, margin: '0 0 8px 0' }}>
                  После 5-го года ваша команда продолжает разработку только на <strong>одном участке</strong>.
                  У вас <strong>{ownedLUs.length}</strong> {ownedLUs.length === 1 ? 'участок' : 'участка(-ов)'} — необходимо отказаться
                  от <strong>{requiredRefusalCount}</strong> {requiredRefusalCount === 1 ? 'участка' : 'участков'}.
                  Выберите {requiredRefusalCount === 1 ? 'его' : 'их'} на карте.
                </p>
              ) : (
                <p style={{ textAlign: 'center', lineHeight: 1.5, margin: '0 0 8px 0' }}>
                  У вас <strong>{ownedLUs.length} участка(-ов)</strong>. Необходимо отказаться
                  от <strong>{requiredRefusalCount}</strong> {requiredRefusalCount === 1 ? 'участка' : 'участков'}.
                  Выберите {requiredRefusalCount === 1 ? 'его' : 'их'} на карте.
                </p>
              )}
              {ownedLUs.length > 0
                ? <RefusalMap ownedCells={gridCells.owned} allTeamsCells={gridCells.allTeams} selectedRefs={refusalRefs} maxCount={requiredRefusalCount} onToggle={toggleRefusalRef} sceneImages={sceneImages} />
                : <p style={{ textAlign: 'center', color: '#999' }}>Нет участков для отказа</p>}
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.purchaseModalBtn}
                onClick={() => handleRefusalAccept(refusalRefs)}
                disabled={refusalRefs.length !== requiredRefusalCount}
                style={{ background: refusalRefs.length === requiredRefusalCount ? '#e65100' : '#bbb', cursor: refusalRefs.length === requiredRefusalCount ? 'pointer' : 'not-allowed' }}
              >
                {refusalRefs.length === requiredRefusalCount
                  ? `Отказаться от: ${refusalRefs.join(', ')}`
                  : `Выберите ещё ${requiredRefusalCount - refusalRefs.length} участок(-ов)`}
              </button>
            </div>
          </div>
          <RefusalTour onDone={() => { }} refusalCount={requiredRefusalCount} />
        </div>
      )}

      {showPostRefusalModal && (
        <div className={styles.cellModalOverlay}>
          <div className={styles.cellModal} onClick={e => e.stopPropagation()} style={{ maxWidth: 580, width: '95%' }}>
            <h3 style={{ textAlign: 'center', color: '#1565c0' }}>Предложение от крупной нефтегазовой компании</h3>
            <div className={styles.modalInfo}>
              <p style={{ textAlign: 'center', lineHeight: 1.7, fontSize: '1.05rem', margin: '0 0 12px 0' }}>
                Как оказалось, крупная нефтегазовая компания — это ваша материнская компания. У вас есть возможность взять у нее бесплатно 1 участок, но для этого придется отказаться еще от 1 своего участка. Вы можете согласиться или отказаться и продолжить с текущими участками.
              </p>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.purchaseModalBtn}
                style={{ background: '#1565c0' }}
                onClick={() => {
                  setShowPostRefusalModal(false);
                  setExchangeMyRef(null);
                  setExchangeCompanyRef(null);
                  setShowCompanyExchangeModal(true);
                }}
              >
                Согласиться на обмен
              </button>
              <button
                className={styles.cancelModalBtn}
                onClick={() => {
                  setShowPostRefusalModal(false);
                  goToNextYear();
                  setTimeout(() => setShowYearResultsModal(true), 200);
                }}
              >
                Отказаться, продолжить
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompanyExchangeModal && (
        <div className={styles.cellModalOverlay}>
          <div className={styles.cellModal} onClick={e => e.stopPropagation()} style={{ maxWidth: 820, width: '97%' }}>
            <h3 style={{ textAlign: 'center', color: '#1565c0' }}>Обмен участками с компанией</h3>
            <div className={styles.modalInfo}>
              <p style={{ textAlign: 'center', color: '#555', marginBottom: 12, fontSize: '0.95rem' }}>
                Нажмите на <strong style={{ color: '#0d47a1' }}>свой участок</strong> (синий) чтобы отдать,
                затем на <strong style={{ color: '#bf360c' }}>участок компании</strong> (оранжевый) чтобы получить.
              </p>
              <RefusalMap
                mode="exchange"
                ownedCells={gridCells.owned}
                allTeamsCells={gridCells.allTeams}
                companyCells={COMPANY_LU_CELLS.filter(ref => !!cellScenarios[ref])}
                selectedMyRef={exchangeMyRef}
                selectedCompanyRef={exchangeCompanyRef}
                onSelectMy={setExchangeMyRef}
                onSelectCompany={setExchangeCompanyRef}
                sceneImages={sceneImages}
              />
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.purchaseModalBtn}
                disabled={!exchangeMyRef || !exchangeCompanyRef}
                style={{
                  background: exchangeMyRef && exchangeCompanyRef ? '#1565c0' : '#bbb',
                  cursor: exchangeMyRef && exchangeCompanyRef ? 'pointer' : 'not-allowed',
                }}
                onClick={handleCompanyExchange}
              >
                {exchangeMyRef && exchangeCompanyRef
                  ? `Обменять ${exchangeMyRef} → ${exchangeCompanyRef}`
                  : 'Выберите оба участка'}
              </button>
              <button
                className={styles.cancelModalBtn}
                onClick={() => {
                  setShowCompanyExchangeModal(false);
                  setExchangeMyRef(null);
                  setExchangeCompanyRef(null);
                  goToNextYear();
                  setTimeout(() => setShowYearResultsModal(true), 200);
                }}
              >
                Отказаться от обмена
              </button>
            </div>
          </div>
        </div>
      )}

      {showFinalModal && (
        <div className={styles.cellModalOverlay}>
          <div className={styles.cellModal}>
            <h3 style={{ textAlign: 'center', color: '#2e7d32', fontSize: '1.5rem' }}>Исследования завершены!</h3>
            <div className={styles.modalInfo}>
              <p style={{ textAlign: 'center', fontSize: '1.1rem', marginBottom: 12 }}>Все 10 лет пройдены</p>
              {Object.keys(gridCells.owned).map(cellRef => (
                <div key={cellRef} style={{ padding: '6px 14px', background: '#e8f5e9', borderRadius: 6, marginBottom: 4, fontWeight: 600 }}>✓ Участок {cellRef}</div>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.purchaseModalBtn} onClick={onComplete}>Перейти к зоне событий</button>
            </div>
          </div>
        </div>
      )}

      <ResearchPanelTour globalYear={globalYear} onDone={() => {}} />
    </div>
  );
}