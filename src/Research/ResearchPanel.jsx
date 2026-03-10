// ResearchPanel.jsx — переписано с нуля
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RESEARCH_WORKS, MOBILIZATION_WORKS } from './researchData';
import useGameStore from '../../store/gameStore';
import styles from './ResearchPanel.module.css';
import ResultsOverlay from './ResultsOverlay';

// ─────────────────────────────────────────────────────────────────────────────
// КОНСТАНТЫ
// ─────────────────────────────────────────────────────────────────────────────

const YEAR_DURATIONS_SEC = {
  1: 25 * 60, 2: 20 * 60, 3: 15 * 60, 4: 15 * 60, 5: 10 * 60,
  6: 15 * 60, 7: 15 * 60, 8: 15 * 60, 9: 10 * 60, 10: 10 * 60,
};

const REFUSAL_YEARS     = [3, 5];
const REFUSAL_DURATION  = 10 * 60; // секунд

// Какие столбцы активны в каком диапазоне лет
// Каждый столбец доступен СТРОГО в перечисленные годы — не раньше, не позже.
const COLS_BY_YEAR = {
  1:  ['srr_2d', 'srr_3d', '1pr'],
  2:  ['srr_2d', 'srr_3d', '1pr'],
  3:  ['srr_2d', 'srr_3d', '1pr'],
  4:  ['srr_2d', 'srr_3d', '1pr', '3r'],   // 3r — только год 4
  5:  ['3r', '4r'],                                // 4r — только год 5
  6:  ['drilling_5gs', 'drilling_6gs', 'drilling_7mzs', 'testing', 'mun'],
  7:  ['drilling_5gs', 'drilling_6gs', 'drilling_7mzs', 'testing', 'mun'],
  8:  ['drilling_5gs', 'drilling_6gs', 'drilling_7mzs', 'testing', 'mun'],
  9:  ['depression', 'bsko', 'ppd', '3bs'],
  10: ['depression', 'bsko', 'ppd', '3bs'],
};


// ─────────────────────────────────────────────────────────────────────────────
// УТИЛИТЫ
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (s) => {
  const t = Math.max(0, Math.floor(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

const isColActiveThisYear = (colId, year) =>
  (COLS_BY_YEAR[year] || []).includes(colId);

const iterLabel = (year) => {
  if (year <= 4) return '1 — ГРР (годы 1–4)';
  if (year === 5) return '1б — Разведка 4Р (год 5)';
  if (year <= 8) return '2 — Бурение (годы 6–8)';
  return '3 — Добыча (годы 9–10)';
};

const timerYearLabel = (year) => {
  if (year <= 4) return `ГРР — год ${year}`;
  if (year === 5) return 'Разведка 4Р — год 5';
  if (year <= 8) return `Бурение — год ${year}`;
  return `Добыча — год ${year}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// ПРОГРЕСС ЛУ — дефолтная структура
// ─────────────────────────────────────────────────────────────────────────────

const defaultProgress = () => ({
  // ── Персистентные (не сбрасываются) ──
  blockedColumns:       [],  // colId[] — навсегда заблокированы (eventsScore >= 0)
  mobilizedColumns:     [],  // colId[] — мобилизации куплены хотя бы раз
  columnsByYear:        {},  // { year: colId }
  skippedYears:         [],  // year[]
  purchasedWorks:       [],  // все НИРы за всю игру
  purchasedWorksByYear: {},  // { year: work[] }
  purchasedCellsByYear: {},  // { year: { cellKey: work } }
  successRatesByYear:   {},  // { year: { colId: % } }
  totalSpent:           0,

  // ── Сбрасываются каждый год ──
  purchasedCells: {},  // { cellKey: work } — только текущий год
  successRates:   {},  // { colId: % }    — только текущий год
});

// ─────────────────────────────────────────────────────────────────────────────
// ЛОГИКА ПЕРЕХОДА ГОДА
// Вызывается один раз при смене года.
// eventsScore — баллы событий за prevYear для данного ЛУ.
// ─────────────────────────────────────────────────────────────────────────────

function applyYearTransition(prog, prevYear, eventsScore) {
  const prevCol  = prog.columnsByYear?.[prevYear];
  const skipped  = (prog.skippedYears || []).includes(prevYear);
  let blocked    = [...(prog.blockedColumns || [])];

  // Блокируем столбец только если: был выбран + не пропущен год + события >= 0
  if (prevCol && !skipped && eventsScore >= 0) {
    if (!blocked.includes(prevCol)) blocked.push(prevCol);
  }
  // eventsScore < 0 → столбец НЕ блокируем (↺ доступен повторно)
  // skipped → вообще ничего не блокируем

  return {
    ...prog,
    blockedColumns: blocked,
    purchasedCells: {},  // сброс ячеек нового года
    successRates:   {},  // сброс процентов нового года
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ЦВЕТОВЫЕ ГРУППЫ СТОЛБЦОВ
// ─────────────────────────────────────────────────────────────────────────────

const MOB_GROUPS = [
  { ids: ['srr_2d', 'srr_3d'],                                           label: 'СРР',     cls: 'colGroupGray'   },
  { ids: ['1pr', '3r', '4r'],                                            label: 'ГРР',     cls: 'colGroupOrange' },
  { ids: ['drilling_5gs','drilling_6gs','drilling_7mzs','testing','mun'],label: 'Бурение', cls: 'colGroupBeige'  },
  { ids: ['depression','bsko','ppd','3bs'],                              label: 'Добыча',  cls: 'colGroupBlue'   },
];

const getColGroup = (colId) =>
  MOB_GROUPS.find(g => g.ids.includes(colId)) || MOB_GROUPS[0];

// ─────────────────────────────────────────────────────────────────────────────
// КОМПОНЕНТ
// ─────────────────────────────────────────────────────────────────────────────

export default function ResearchPanel({ onComplete }) {
  const {
    player, gridCells, research, events,
    fieldWork, markYearSkippedForLU,
    setYear, resetEventCardsForNewYear,
  } = useGameStore();

  const globalYear = useGameStore(s => s.game.currentYear);

  // ── Локальный UI-стейт ────────────────────────────────────────────────────
  const [showResults,      setShowResults]      = useState(false);
  const [showFinalModal,   setShowFinalModal]    = useState(false);
  const [showRefusalModal, setShowRefusalModal]  = useState(false);
  const [showYearConfirm,  setShowYearConfirm]   = useState(false);
  const [refusalLU,        setRefusalLU]         = useState(null);
  const [purchaseModal,    setPurchaseModal]      = useState(null); // данные для модалки покупки

  // ── Выбор участников и столбца ────────────────────────────────────────────
  // selectedLUs: string[] — cellRef выбранных участков
  // selectedCol: string|null — выбранный colId
  const [selectedLUs, setSelectedLUs] = useState([]);
  const [selectedCol, setSelectedCol] = useState(null);
  const [activeLU,    setActiveLU]    = useState(null); // последний кликнутый (для одиночного режима)
  const [sessionCount, setSessionCount] = useState(0);  // куплено в текущей сессии

  // ── Таймер ────────────────────────────────────────────────────────────────
  const [timer, setTimer] = useState({
    remaining:     YEAR_DURATIONS_SEC[globalYear],
    year:          globalYear,
    done:          false,
    refusal:       false,
    refusalYear:   null,
    refusalLeft:   0,
  });
  const intervalRef = useRef(null);

  // ─────────────────────────────────────────────────────────────────────────
  // ВСПОМОГАТЕЛЬНЫЕ ДАННЫЕ
  // ─────────────────────────────────────────────────────────────────────────

  const ownedLUs = useMemo(() =>
    Object.values(gridCells.owned).map(c => ({
      id:   c.cellRef, cellRef: c.cellRef,
      name: c.name || `Участок ${c.cellRef}`,
      auctionPrice: c.auctionPrice || 0,
    })),
  [gridCells.owned]);

  const getProgress = useCallback((luId) =>
    research.progressByLU[luId] || defaultProgress(),
  [research.progressByLU]);

  // Все купленные мобилизации по всем ЛУ (для проверки зависимостей)
  const allMobilized = useMemo(() => {
    const s = new Set();
    Object.values(research.progressByLU).forEach(p =>
      (p.mobilizedColumns || []).forEach(c => s.add(c)));
    return s;
  }, [research.progressByLU]);

  // ─────────────────────────────────────────────────────────────────────────
  // ПРАВИЛА ДОСТУПНОСТИ СТОЛБЦА ДЛЯ ЛУ
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Возвращает { ok, reason, repeatable }
   * ok         — можно выбрать
   * repeatable — столбец ↺ (события < 0 в прошлом году, не заблокирован)
   */
  const colStatus = useCallback((colId, luId) => {
    const mob  = MOBILIZATION_WORKS.find(w => w.id === colId);
    if (!mob) return { ok: false, reason: 'Не найден' };

    // 1. Активен в текущем году?
    if (!isColActiveThisYear(colId, globalYear))
      return { ok: false, reason: mob.years?.length
        ? `Доступен в годы: ${mob.years.join(', ')}`
        : 'Не в этом году' };

    // 2. Зависимость выполнена?
    if (mob.dependency && !allMobilized.has(mob.dependency)) {
      const dep = MOBILIZATION_WORKS.find(w => w.id === mob.dependency);
      return { ok: false, reason: `Требует: ${dep?.name || mob.dependency}` };
    }

    const prog = getProgress(luId);

    // 3. Заблокирован навсегда?
    if ((prog.blockedColumns || []).includes(colId))
      return { ok: false, reason: 'Заблокирован (события ≥ 0 в прошлом)' };

    // 4. Ограничение: в текущем году для ЭТОГО ЛУ уже выбран другой столбец?
    //    Смотрим ТОЛЬКО columnsByYear[globalYear] — выбор текущего года.
    //    История прошлых лет (в т.ч. при eventsScore < 0) не ограничивает.
    const chosenThisYear = prog.columnsByYear?.[globalYear];
    if (chosenThisYear && chosenThisYear !== colId) {
      const lw = MOBILIZATION_WORKS.find(w => w.id === chosenThisYear);
      return { ok: false, reason: `В году ${globalYear} уже выбран: ${lw?.name || chosenThisYear}` };
    }

    // 5. Столбец уже занят ДРУГИМ ЛУ в этом году?
    //    Исключаем ЛУ из текущей мульти-сессии — они могут использовать один столбец совместно.
    //    selectedLUs захватывается из замыкания.
    const usedByOther = Object.entries(research.progressByLU).some(
      ([id, p]) =>
        id !== luId &&
        !selectedLUs.includes(id) &&
        p.columnsByYear?.[globalYear] === colId
    );
    if (usedByOther) {
      return { ok: false, reason: `Столбец уже используется другим участком в ${globalYear} году` };
    }

    // ↺ Столбец использовался в прошлом и не заблокирован → повтор доступен
    const usedBefore = Object.values(prog.columnsByYear || {}).includes(colId);
    const repeatable = usedBefore;

    return { ok: true, reason: '', repeatable };
  }, [globalYear, allMobilized, getProgress, research.progressByLU, selectedLUs]);

  // ЛУ уже «использован» в этом году (выбрал столбец или отказался)
  const isLUDone = useCallback((luId) => {
    const prog = getProgress(luId);
    return (prog.skippedYears || []).includes(globalYear)
      || !!prog.columnsByYear?.[globalYear];
  }, [getProgress, globalYear]);

  // ─────────────────────────────────────────────────────────────────────────
  // ТАЙМЕР
  // ─────────────────────────────────────────────────────────────────────────

  const stopTimer = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const handleYearEnd = useCallback(() => {
    stopTimer();
    if (globalYear >= 10) {
      setTimer(p => ({ ...p, remaining: 0, done: true }));
      setTimeout(() => setShowFinalModal(true), 200);
      return;
    }
    if (REFUSAL_YEARS.includes(globalYear)) {
      setTimer(p => ({ ...p, refusal: true, refusalYear: globalYear, refusalLeft: REFUSAL_DURATION }));
      setShowRefusalModal(true);
      intervalRef.current = setInterval(() => {
        setTimer(p => {
          if (p.refusalLeft <= 1) {
            stopTimer();
            return { ...p, refusalLeft: 0 };
          }
          return { ...p, refusalLeft: p.refusalLeft - 1 };
        });
      }, 1000);
      return;
    }
    setTimer(p => ({ ...p, remaining: 0, done: true }));
    setTimeout(() => setShowResults(true), 200);
  }, [globalYear, stopTimer]);

  const startTimer = useCallback(() => {
    stopTimer();
    intervalRef.current = setInterval(() => {
      setTimer(p => {
        if (p.refusal || p.done) return p;
        if (p.remaining <= 1) {
          stopTimer();
          setTimeout(handleYearEnd, 0);
          return { ...p, remaining: 0 };
        }
        return { ...p, remaining: p.remaining - 1 };
      });
    }, 1000);
  }, [stopTimer, handleYearEnd]);

  // Старт при монтировании
  useEffect(() => {
    startTimer();
    return stopTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Реакция на смену года (из store)
  useEffect(() => {
    if (timer.year === globalYear) return;

    // Применяем переход для всех ЛУ
    const prevYear = globalYear - 1;
    const updProg  = { ...research.progressByLU };
    Object.keys(updProg).forEach(luId => {
      const score =
        events?.historyByYear?.[prevYear]?.lineScores?.[luId]
        ?? events?.lineScores?.[luId]
        ?? 0;
      updProg[luId] = applyYearTransition(updProg[luId], prevYear, score);
    });
    useGameStore.setState({ research: { ...research, progressByLU: updProg } });

    resetSelection();
    setTimer({
      remaining:   YEAR_DURATIONS_SEC[globalYear],
      year:        globalYear,
      done:        false,
      refusal:     false,
      refusalYear: null,
      refusalLeft: 0,
    });
    startTimer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalYear]);

  // ─────────────────────────────────────────────────────────────────────────
  // ВЫБОР УЧАСТНИКОВ И СТОЛБЦА
  // ─────────────────────────────────────────────────────────────────────────

  const resetSelection = () => {
    setSelectedLUs([]);
    setSelectedCol(null);
    setActiveLU(null);
    setSessionCount(0);
  };

  const toggleLU = (lu) => {
    const already = selectedLUs.includes(lu.cellRef);

    // Нельзя добавить новый ЛУ после выбора столбца
    if (!already && selectedCol) {
      alert('После выбора столбца нельзя добавлять участки. Сначала подтвердите или сбросьте.');
      return;
    }
    // Нельзя выбрать ЛУ, который уже завершил год
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

  // Клик по заголовку столбца
  const handleColClick = (mob) => {
    if (selectedLUs.length === 0) {
      alert('Сначала выберите хотя бы один участок!');
      return;
    }

    const valid   = [];
    const invalid = [];

    selectedLUs.forEach(luId => {
      const s = colStatus(mob.id, luId);
      const name = ownedLUs.find(l => l.cellRef === luId)?.name || luId;
      s.ok ? valid.push(luId) : invalid.push(`${name}: ${s.reason}`);
    });

    if (valid.length === 0) {
      alert(`Столбец «${mob.name}» недоступен:\n\n${invalid.join('\n')}`);
      return;
    }

    if (invalid.length > 0) {
      const names = valid.map(id => ownedLUs.find(l => l.cellRef === id)?.name || id).join(', ');
      const go = window.confirm(
        `Недоступно для части участков:\n${invalid.join('\n')}\n\nДоступно для: ${names}\n\nПродолжить?`
      );
      if (!go) return;
      setSelectedLUs(valid);
    }

    setSelectedCol(prev => prev === mob.id ? null : mob.id);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ПОКУПКА ЯЧЕЙКИ
  // ─────────────────────────────────────────────────────────────────────────

  // Открыть модалку покупки
  const openPurchaseModal = (work, mob) => {
    // Мульти-режим
    if (selectedLUs.length > 0 && selectedCol === mob.id) {
      const cellKey = `${work.id}-${mob.id}`;
      const toBuy   = selectedLUs.filter(luId => {
        const s = colStatus(mob.id, luId);
        return s.ok && !getProgress(luId).purchasedCells?.[cellKey];
      });
      if (toBuy.length === 0) return;

      const breakdown = toBuy.map(luId => {
        const needsMob = !(getProgress(luId).mobilizedColumns || []).includes(mob.id);
        return { luId, needsMob, cost: work.cost + (needsMob ? mob.cost : 0) };
      });

      setPurchaseModal({
        work, mob, cellKey,
        multi: true,
        toBuy, breakdown,
        total: breakdown.reduce((s, x) => s + x.cost, 0),
      });
      return;
    }

    // Одиночный режим
    if (!activeLU) { alert('Выберите участок!'); return; }
    const luId   = activeLU.cellRef;
    const s      = colStatus(mob.id, luId);
    if (!s.ok) { alert(s.reason); return; }

    const cellKey  = `${work.id}-${mob.id}`;
    const prog     = getProgress(luId);
    if (prog.purchasedCells?.[cellKey]) return; // уже куплено

    const needsMob = !(prog.mobilizedColumns || []).includes(mob.id);
    setPurchaseModal({
      work, mob, cellKey,
      multi: false,
      luId,
      needsMob,
      total: work.cost + (needsMob ? mob.cost : 0),
    });
  };

  // Подтвердить покупку
  const confirmPurchase = () => {
    if (!purchaseModal) return;
    const { work, mob, cellKey, multi } = purchaseModal;

    if (multi) {
      const { toBuy, breakdown, total } = purchaseModal;
      if (player.budget < total) {
        alert(`Недостаточно средств! Нужно: ${total} млн`);
        return;
      }

      const updProg = { ...research.progressByLU };
      breakdown.forEach(({ luId, needsMob, cost }) => {
        const p       = updProg[luId] || defaultProgress();
        const rate    = work.successRates[mob.id] || 0;
        const newRate = Math.min((p.successRates?.[mob.id] || 0) + rate, 95);
        const rw      = makeResearchWork(work, mob, cellKey, cost, needsMob, rate);

        updProg[luId] = mergePurchase(p, luId, mob, cellKey, rw, newRate, needsMob);
      });

      useGameStore.setState(st => ({
        player:   { ...st.player, budget: st.player.budget - total },
        research: { ...st.research, progressByLU: updProg },
      }));
      setSessionCount(c => c + breakdown.length);
      setPurchaseModal(null);
      return;
    }

    // Одиночный — делаем ВСЁ в одном setState, без вызова purchaseResearch из стора
    // (он дублирует списание бюджета и перезатирает progressByLU старым снапшотом)
    const { luId, needsMob, total } = purchaseModal;
    if (player.budget < total) { alert('Недостаточно средств!'); return; }

    const p       = getProgress(luId);
    const rate    = work.successRates[mob.id] || 0;
    const newRate = Math.min((p.successRates?.[mob.id] || 0) + rate, 95);
    const rw      = makeResearchWork(work, mob, cellKey, total, needsMob, rate);
    const updProg = { ...useGameStore.getState().research.progressByLU };
    updProg[luId] = mergePurchase(p, luId, mob, cellKey, rw, newRate, needsMob);

    useGameStore.setState(st => ({
      player:   { ...st.player, budget: st.player.budget - total },
      research: { ...st.research, progressByLU: updProg },
    }));
    setSessionCount(c => c + 1);
    setPurchaseModal(null);
  };

  // Зафиксировать выбранный столбец для всех ЛУ (кнопка «Подтвердить»)
  const confirmSession = () => {
    if (!selectedCol || selectedLUs.length === 0) { resetSelection(); return; }
    const updProg = { ...research.progressByLU };
    selectedLUs.forEach(luId => {
      const p = updProg[luId] || defaultProgress();
      updProg[luId] = {
        ...p,
        columnsByYear: { ...(p.columnsByYear || {}), [globalYear]: selectedCol },
      };
    });
    useGameStore.setState({ research: { ...research, progressByLU: updProg } });
    resetSelection();
  };

  // Отказ от исследований
  const skipResearch = () => {
    if (selectedLUs.length === 0) return;
    const names = selectedLUs.map(id => ownedLUs.find(l => l.cellRef === id)?.name || id).join(', ');
    if (!window.confirm(`Отказаться от исследований в году ${globalYear} для:\n${names}?`)) return;
    selectedLUs.forEach(luId => markYearSkippedForLU?.(luId, globalYear));
    resetSelection();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ИММУТАБЕЛЬНЫЕ ХЕЛПЕРЫ
  // ─────────────────────────────────────────────────────────────────────────

  const makeResearchWork = (work, mob, cellKey, cost, needsMob, rate) => ({
    id:               cellKey,
    name:             `${work.name} | ${mob.name}`,
    baseCost:         cost,
    successRates:     { [mob.id]: rate },
    workType:         work.id,
    mobilizationType: mob.id,
    metadata: {
      cellKey,
      workCost:        work.cost,
      mobilizationCost: needsMob ? mob.cost : 0,
      successRate:     rate,
      year:            globalYear,
    },
  });

  const mergePurchase = (prog, luId, mob, cellKey, rw, newRate, needsMob) => {
    const year = globalYear;
    return {
      ...prog,
      mobilizedColumns: needsMob
        ? [...new Set([...(prog.mobilizedColumns || []), mob.id])]
        : (prog.mobilizedColumns || []),
      mobilizedColumnsByYear: needsMob
        ? appendToYearArr(prog.mobilizedColumnsByYear, year, mob.id)
        : (prog.mobilizedColumnsByYear || {}),
      columnsByYear: { ...(prog.columnsByYear || {}), [year]: mob.id },
      purchasedWorks: [...(prog.purchasedWorks || []), rw],
      purchasedWorksByYear: appendToYearArr(prog.purchasedWorksByYear, year, rw),
      purchasedCells: { ...(prog.purchasedCells || {}), [cellKey]: { ...rw, successRate: rw.metadata.successRate } },
      purchasedCellsByYear: appendToYearMap(prog.purchasedCellsByYear, year, cellKey, { ...rw, successRate: rw.metadata.successRate }),
      successRates: { ...(prog.successRates || {}), [mob.id]: newRate },
      successRatesByYear: appendRateToYear(prog.successRatesByYear, prog.successRates, year, mob.id, newRate),
      totalSpent: (prog.totalSpent || 0) + rw.baseCost,
    };
  };

  const appendToYearArr = (obj, year, item) => {
    const o = obj || {};
    return { ...o, [year]: [...(o[year] || []), item] };
  };
  const appendToYearMap = (obj, year, key, val) => {
    const o = obj || {};
    return { ...o, [year]: { ...(o[year] || {}), [key]: val } };
  };
  const appendRateToYear = (byYear, cur, year, colId, rate) => {
    const o = byYear || {};
    return { ...o, [year]: { ...(cur || {}), ...(o[year] || {}), [colId]: rate } };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // УПРАВЛЕНИЕ ГОДОМ
  // ─────────────────────────────────────────────────────────────────────────

  const doFinishYear = () => {
    stopTimer();
    if (REFUSAL_YEARS.includes(globalYear)) {
      setTimer(p => ({ ...p, refusal: true, refusalYear: globalYear, refusalLeft: REFUSAL_DURATION }));
      setShowRefusalModal(true);
      intervalRef.current = setInterval(() => {
        setTimer(p => {
          if (p.refusalLeft <= 1) { stopTimer(); return { ...p, refusalLeft: 0 }; }
          return { ...p, refusalLeft: p.refusalLeft - 1 };
        });
      }, 1000);
    } else {
      setTimer(p => ({ ...p, remaining: 0, done: true }));
      setShowResults(true);
    }
    setShowYearConfirm(false);
  };

  const goToNextYear = useCallback((skipRefusal = false) => {
    stopTimer();
    setShowRefusalModal(false);
    setRefusalLU(null);
    const next = globalYear + 1;
    resetEventCardsForNewYear?.(next);
    setYear(next);
    // timer обновится через useEffect [globalYear]
  }, [globalYear, stopTimer, setYear, resetEventCardsForNewYear]);

  const handleRefusalAccept = (luIdToRemove) => {
    stopTimer();
    if (luIdToRemove) {
      const st      = useGameStore.getState();
      const newOwned = { ...st.gridCells.owned };
      const newAll   = { ...st.gridCells.allTeams };
      delete newOwned[luIdToRemove];
      delete newAll[luIdToRemove];
      useGameStore.setState({
        gridCells:    { owned: newOwned, allTeams: newAll },
        licenseUnits: { ...st.licenseUnits, current: Object.values(newOwned)[0] || null },
      });
      if (activeLU?.cellRef === luIdToRemove) setActiveLU(null);
      setSelectedLUs(p => p.filter(id => id !== luIdToRemove));
    }
    goToNextYear();
  };

  const handleNextYearFromResults = () => {
    setShowResults(false);
    if (globalYear >= 10) { setShowFinalModal(true); return; }
    goToNextYear();
    startTimer();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ОТОБРАЖЕНИЕ ТАЙМЕРА
  // ─────────────────────────────────────────────────────────────────────────

  const timerCls = () => {
    if (timer.done)          return `${styles.timer} ${styles.timerFinished}`;
    if (timer.refusal)       return `${styles.timer} ${styles.timerWarning}`;
    const t = timer.remaining;
    if (t <= 30)             return `${styles.timer} ${styles.timerCritical}`;
    if (t <= 120)            return `${styles.timer} ${styles.timerWarning}`;
    if (t <= 300)            return `${styles.timer} ${styles.timerAlert}`;
    return styles.timer;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ДАННЫЕ ДЛЯ ТАБЛИЦЫ
  // ─────────────────────────────────────────────────────────────────────────

  // purchasedCells активного ЛУ в текущем году
  const activeProg = activeLU ? getProgress(activeLU.cellRef) : null;

  // Суммарная успешность активного ЛУ по конкретному столбцу (текущий год)
  const colRateActive = (colId) => {
    if (!activeProg) return 0;
    let sum = 0;
    Object.values(activeProg.purchasedCells || {}).forEach(c => {
      if (c.mobilizationType === colId) sum += (c.successRate || 0);
    });
    return Math.min(sum, 95);
  };

  const totalRateActive = () => {
    if (!activeProg) return 0;
    return Math.min(
      Object.values(activeProg.successRates || {}).reduce((s, r) => s + r, 0),
      95
    );
  };

  const multiMode = selectedLUs.length > 0;

  // ─────────────────────────────────────────────────────────────────────────
  // РЕНДЕР
  // ─────────────────────────────────────────────────────────────────────────

  if (showResults) {
    return (
      <ResultsOverlay
        globalYear={globalYear} research={research} events={events}
        fieldWork={fieldWork} gridCells={gridCells} player={player}
        onNextYear={handleNextYearFromResults}
        onBack={() => setShowResults(false)}
      />
    );
  }

  return (
    <div className={styles.researchPanel}>

      {/* ── ТАЙМЕР ─────────────────────────────────────────────────────── */}
      <div className={timerCls()}>
        {timer.done ? (
          <>
            <div className={styles.timerLabel}>Ход завершён</div>
            <div className={styles.timerFinishedText}>Исследования завершены</div>
          </>
        ) : timer.refusal ? (
          <>
            <div className={styles.timerLabel}>Время на решение</div>
            <div className={styles.timerValue}>{fmt(timer.refusalLeft)}</div>
            <div className={styles.timerSubtitle}>Отказ от участка (год {timer.refusalYear})</div>
          </>
        ) : (
          <>
            <div className={styles.timerLabel}>Глобальный таймер</div>
            <div className={styles.timerValue}>{fmt(timer.remaining)}</div>
            <div className={styles.timerSubtitle}>{timerYearLabel(timer.year)}</div>
          </>
        )}
      </div>

      {/* ── НАВИГАЦИЯ ──────────────────────────────────────────────────── */}
      <div className={styles.researchMapControls}>
        <button className={`${styles.researchControlBtn} ${styles.researchBackBtn}`} onClick={onComplete}>Назад</button>
        <button className={`${styles.researchControlBtn} ${styles.researchNextBtn}`} onClick={onComplete}>Далее — К зоне событий</button>
      </div>

      {/* ── ПАНЕЛЬ УЧАСТКОВ ────────────────────────────────────────────── */}
      <div className={styles.researchHeader}>
        <h2>Научные исследования</h2>

        {ownedLUs.length === 0 ? (
          <div style={{ padding: '1rem', background: '#ffebee', borderRadius: 8, border: '2px solid #c62828' }}>
            <span style={{ color: '#c62828', fontWeight: 700 }}>Нет купленных участков. Вернитесь на карту.</span>
          </div>
        ) : (
          <div style={{ width: '100%' }}>
            {/* Шаг 1: карточки участков */}
            <div style={{ marginBottom: '0.5rem', fontWeight: 700, color: '#333' }}>
              Шаг 1. Выберите участки:
              <span style={{ marginLeft: 8, fontWeight: 400, color: '#888', fontSize: '0.85rem' }}>
                {multiMode
                  ? (selectedCol ? 'Столбец выбран — кликайте по ячейкам' : 'Теперь выберите столбец (заголовок)')
                  : 'Один клик — выбрать, повторный — снять'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              {ownedLUs.map(lu => {
                const prog       = getProgress(lu.cellRef);
                const inGroup    = selectedLUs.includes(lu.cellRef);
                const done       = isLUDone(lu.cellRef) && !inGroup;
                const skipped    = (prog.skippedYears || []).includes(globalYear);
                const blocked    = prog.blockedColumns || [];
                const nirCount   = (prog.purchasedWorksByYear?.[globalYear] || []).length;
                const prevYear   = globalYear - 1;
                const evScore    = events?.historyByYear?.[prevYear]?.lineScores?.[lu.cellRef]
                  ?? events?.lineScores?.[lu.cellRef] ?? null;
                const prevColId  = prevYear > 0 ? prog.columnsByYear?.[prevYear] : null;
                const prevColName = prevColId
                  ? MOBILIZATION_WORKS.find(w => w.id === prevColId)?.name : null;

                return (
                  <div key={lu.cellRef}
                    onClick={() => !done && toggleLU(lu)}
                    style={{
                      padding: '10px 14px', minWidth: 140, borderRadius: 10, cursor: done ? 'default' : 'pointer',
                      border: `2px solid ${inGroup ? '#2fa394' : done ? '#ddd' : '#e0e0e0'}`,
                      background: inGroup ? '#2fa394' : done ? '#f5f5f5' : '#fff',
                      color: inGroup ? '#fff' : done ? '#aaa' : '#333',
                      opacity: done ? 0.65 : 1,
                      display: 'flex', flexDirection: 'column', gap: 3,
                      boxShadow: inGroup ? '0 4px 12px rgba(47,163,148,.3)' : '0 2px 4px rgba(0,0,0,.06)',
                      transform: inGroup ? 'translateY(-2px)' : 'none',
                      transition: 'all .2s',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                      {inGroup && '✓ '}{lu.name}
                    </div>
                    {done && (
                      <div style={{ fontSize: '0.75rem', color: skipped ? '#ff9800' : '#2fa394', fontWeight: 600 }}>
                        {skipped ? 'Пропущен' : 'Использован'} (год {globalYear})
                      </div>
                    )}
                    {prevColName && evScore !== null && prevYear > 0 && (
                      <div style={{ fontSize: '0.75rem', fontWeight: 700,
                        color: evScore >= 0
                          ? (inGroup ? 'rgba(255,255,255,.85)' : '#2e7d32')
                          : (inGroup ? 'rgba(255,220,200,1)' : '#c62828') }}>
                        {evScore >= 0 ? `+${evScore}` : evScore} по «{prevColName}»{evScore < 0 ? ' ↺' : ''}
                      </div>
                    )}
                    {nirCount > 0 && (
                      <div style={{ fontSize: '0.82rem', opacity: .9, fontWeight: 600 }}>
                        {nirCount} НИР куплено
                      </div>
                    )}
                    {blocked.length > 0 && (
                      <div style={{ fontSize: '0.65rem', color: inGroup ? 'rgba(255,255,255,.6)' : '#bbb' }}>
                        Заблок.: {blocked.map(c => MOBILIZATION_WORKS.find(w => w.id === c)?.name || c).join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Панель статуса мульти-режима */}
            {multiMode && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
                <div style={{ padding: '7px 14px', background: '#e8f5e9', border: '2px solid #4caf50', borderRadius: 8, fontSize: '0.9rem' }}>
                  <span style={{ color: '#2e7d32', fontWeight: 700 }}>Выбрано: {selectedLUs.length} уч.</span>
                  {selectedCol && (
                    <span style={{ marginLeft: 8, color: '#ff9800', fontWeight: 700 }}>
                      | Столбец: {MOBILIZATION_WORKS.find(m => m.id === selectedCol)?.name}
                    </span>
                  )}
                </div>
                {sessionCount > 0 && (
                  <button onClick={confirmSession}
                    style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#2fa394,#1a7a6e)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem' }}>
                    ✓ Подтвердить НИРы ({sessionCount}) — завершить
                  </button>
                )}
                <button onClick={skipResearch}
                  style={{ padding: '8px 16px', background: '#fff', color: '#e53935', border: '2px solid #e53935', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}>
                  Отказаться от исследований
                </button>
              </div>
            )}

            {/* Подсказки */}
            {!multiMode && !activeLU && (
              <div style={{ padding: '6px 12px', background: '#f3f8ff', borderRadius: 7, border: '1px solid #b3d0f5', color: '#1565c0', fontSize: '0.85rem' }}>
                Выберите один или несколько участков выше, чтобы начать
              </div>
            )}
            {multiMode && !selectedCol && (
              <div style={{ padding: '6px 12px', background: '#fff8e1', borderRadius: 7, border: '1px solid #ffe082', color: '#795548', fontSize: '0.85rem' }}>
                <strong>Шаг 2:</strong> кликните на заголовок столбца в таблице ниже
              </div>
            )}
            {multiMode && selectedCol && sessionCount === 0 && (
              <div style={{ padding: '6px 12px', background: '#fff8e1', borderRadius: 7, border: '1px solid #ffe082', color: '#795548', fontSize: '0.85rem' }}>
                <strong>Шаг 3:</strong> кликайте по ячейкам столбца. После покупок нажмите «Подтвердить».
              </div>
            )}
          </div>
        )}

        <div className={styles.budgetInfo}>
          <p className={styles.budgetDisplay}>Бюджет: {player.budget} млн руб.</p>
          <p className={styles.successDisplay}>
            Успешность: <span className={styles.successValue}>{totalRateActive()}%</span>
          </p>
        </div>
      </div>

      {/* ── DEV-переключатель ──────────────────────────────────────────── */}
      {/* {import.meta.env.DEV && (
        <div style={{ background: '#fff3e0', padding: '8px 12px', borderRadius: 8, marginBottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {[1,2,3,4,5,6,7,8,9,10].map(y => (
            <button key={y}
              onClick={() => {
                stopTimer();
                const upd = {};
                Object.entries(research.progressByLU).forEach(([id, p]) =>
                  upd[id] = { ...p, purchasedCells: {}, successRates: {} });
                useGameStore.setState({ research: { ...research, progressByLU: upd } });
                setYear(y);
                setTimer({ remaining: YEAR_DURATIONS_SEC[y], year: y, done: false, refusal: false, refusalYear: null, refusalLeft: 0 });
                setShowRefusalModal(false); setShowFinalModal(false);
                resetSelection();
                startTimer();
              }}
              style={{ padding: '3px 10px', borderRadius: 5, border: `2px solid ${globalYear === y ? '#2fa394' : '#ccc'}`, background: globalYear === y ? '#2fa394' : '#fff', color: globalYear === y ? '#fff' : '#333', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              {y}
            </button>
          ))}
          <button onClick={() => { resetSelection(); useGameStore.setState({ research: { ...research, progressByLU: {} } }); }}
            style={{ marginLeft: 'auto', padding: '3px 12px', borderRadius: 5, border: '2px solid #ff5722', background: '#fff', color: '#ff5722', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            Сброс
          </button>
        </div>
      )} */}

      {/* ── ГОД + КНОПКА ЗАВЕРШИТЬ ─────────────────────────────────────── */}
      <div className={styles.roundIndicator}>
        <div className={styles.yearInfo}>
          <span className={styles.yearLabel}>Год:</span>
          <span className={styles.yearValue}>{globalYear}</span>
          {/* <span style={{ color: '#fff', fontSize: '0.85rem', marginLeft: 8, opacity: .85 }}>{iterLabel(globalYear)}</span> */}
        </div>
        <button
          onClick={() => setShowYearConfirm(true)}
          disabled={timer.refusal || timer.done || globalYear >= 10}
          className={styles.skipYearBtn}
          style={{ marginLeft: 15, padding: '5px 15px', background: (!timer.refusal && !timer.done) ? '#ff9800' : '#ccc', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>
          Завершить год
        </button>
      </div>

      {/* ── ЛЕГЕНДА ────────────────────────────────────────────────────── */}
      <div className={styles.groupLegend}>
        {MOB_GROUPS.map(g => (
          <div key={g.cls} className={styles.legendItem}>
            <span className={styles.legendColor} style={{ background: { colGroupGray: '#f0f0f0', colGroupOrange: '#ffd8b1', colGroupBeige: '#f5e8d0', colGroupBlue: '#c6e2ff' }[g.cls] }} />
            <span className={styles.legendText}>{g.label}</span>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  ТАБЛИЦА НИР                                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className={styles.researchTableContainer}>
        <div className={styles.researchTableScroll}>
          <table className={`${styles.researchTable} ${styles.battleship}`}>
            <thead>
              <tr>
                <th className={styles.colWorkName}>Вид работ</th>
                <th className={styles.colCost}>Стоимость</th>

                {MOBILIZATION_WORKS.map((mob) => {
                  const { cls, label, ids } = getColGroup(mob.id);
                  const isFirstInGroup      = ids[0] === mob.id;
                  const active              = isColActiveThisYear(mob.id, globalYear);
                  const isSelected          = multiMode && selectedCol === mob.id;
                  const hasDep              = mob.dependency && !allMobilized.has(mob.dependency);

                  // Для активного одиночного ЛУ
                  const blockedForActive = activeLU && !multiMode
                    ? (getProgress(activeLU.cellRef).blockedColumns || []).includes(mob.id)
                    : false;
                  const repeatableForActive = activeLU && !multiMode && !blockedForActive
                    ? Object.values(getProgress(activeLU.cellRef).columnsByYear || {}).includes(mob.id)
                    : false;

                  // Для мульти: сколько ЛУ заблокировано
                  const blockedCount = multiMode
                    ? selectedLUs.filter(id => (getProgress(id).blockedColumns || []).includes(mob.id)).length
                    : 0;
                  const allBlocked = multiMode && selectedLUs.length > 0 && blockedCount === selectedLUs.length;

                  // Занят ли столбец другим ЛУ в текущем году?
                  const takenByOther = active && Object.entries(research.progressByLU).some(
                    ([id, p]) => !selectedLUs.includes(id) && p.columnsByYear?.[globalYear] === mob.id
                  );

                  const clickable = multiMode && active && !allBlocked && !hasDep && !takenByOther;

                  let hClass = `${styles[cls] || ''}`;
                  if      (isSelected)                        hClass += ` ${styles.mobilized}`;
                  else if (takenByOther)                      hClass += ` ${styles.locked}`;
                  else if (blockedForActive && !multiMode)    hClass += ` ${styles.locked}`;
                  else if (active && !allBlocked)             hClass += ` ${styles.available}`;
                  else                                        hClass += ` ${styles.locked}`;

                  return (
                    <th key={mob.id}
                      className={`${styles.colMob} ${hClass}`}
                      onClick={() => clickable && handleColClick(mob)}
                      style={{
                        cursor:        clickable ? 'pointer' : 'default',
                        outline:       isSelected ? '3px solid #ff9800' : 'none',
                        outlineOffset: '-3px',
                        opacity:       (allBlocked || takenByOther || (blockedForActive && !multiMode)) ? 0.4 : 1,
                      }}
                      title={
                        isSelected          ? 'Выбран — повторный клик снимает' :
                        hasDep              ? `Требует: ${MOBILIZATION_WORKS.find(w => w.id === mob.dependency)?.name}` :
                        takenByOther        ? `Занят другим участком в ${globalYear} году` :
                        blockedForActive    ? 'Заблокирован (события ≥ 0)' :
                        repeatableForActive ? '↺ Доступен повторно (события < 0)' :
                        !active             ? 'Не в этом году' :
                        clickable           ? 'Нажмите для выбора' : ''
                      }
                    >
                      {isFirstInGroup && <div className={styles.groupHeader}>{label}</div>}
                      <div className={styles.mobHeader}>
                        {isSelected && <span style={{ fontSize: '0.85rem', marginRight: 2 }}>★ </span>}
                        <span className={styles.mobName}>{mob.name}</span>
                        <span className={styles.mobCost}>{mob.cost} млн</span>
                        <span className={styles.mobYears}>{mob.years?.join(', ') ? `Годы: ${mob.years.join(', ')}` : ''}</span>
                        {!active               && <span className={styles.mobLocked}>Не в этом году</span>}
                        {hasDep                && <span className={styles.mobLocked}>Требует зависимость</span>}
                        {takenByOther          && <span className={styles.mobLocked} style={{ color: '#ef9a9a' }}>Занят в {globalYear}г</span>}
                        {blockedForActive && !multiMode && <span className={styles.mobLocked} style={{ color: '#bdbdbd' }}>Заблокирован</span>}
                        {repeatableForActive && !multiMode && <span className={styles.mobLocked} style={{ color: '#ff9800' }}>↺ Повтор</span>}
                        {multiMode && blockedCount > 0 && !allBlocked && <span className={styles.mobLocked} style={{ color: '#ffccbc' }}>{blockedCount} заблок.</span>}
                        {allBlocked            && <span className={styles.mobLocked} style={{ color: '#bdbdbd' }}>Все заблок.</span>}
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
                  <td className={styles.workCost}>{work.cost} млн</td>

                  {MOBILIZATION_WORKS.map((mob) => {
                    const { cls }    = getColGroup(mob.id);
                    const cellKey    = `${work.id}-${mob.id}`;
                    const active     = isColActiveThisYear(mob.id, globalYear);
                    const isSelCol   = multiMode && selectedCol === mob.id;
                    const rate       = work.successRates[mob.id] || 0;

                    // Куплено активным ЛУ в текущем году?
                    const boughtByMe = !!(activeProg?.purchasedCells?.[cellKey]);

                    // Заблокирован / повторен для активного ЛУ
                    const blockedMe  = activeLU && !multiMode && !boughtByMe
                      ? (getProgress(activeLU.cellRef).blockedColumns || []).includes(mob.id)
                      : false;
                    const repeatMe   = activeLU && !multiMode && !blockedMe && !boughtByMe
                      ? Object.values(getProgress(activeLU.cellRef).columnsByYear || {}).includes(mob.id)
                      : false;

                    // В мульти: все доступные ЛУ уже купили эту ячейку
                    const validLUsForSel = isSelCol
                      ? selectedLUs.filter(id => colStatus(mob.id, id).ok)
                      : [];
                    const allBought = isSelCol && validLUsForSel.length > 0
                      && validLUsForSel.every(id => !!getProgress(id).purchasedCells?.[cellKey]);

                    const canClickMulti  = isSelCol && active && validLUsForSel.length > 0 && !allBought;
                    const canClickSingle = !multiMode && activeLU && !boughtByMe && active && !blockedMe
                      && colStatus(mob.id, activeLU.cellRef).ok;
                    const clickable = canClickMulti || canClickSingle;

                    // CSS класс ячейки
                    let cCls = `${styles.cell} ${styles[cls] || ''}`;
                    if      (boughtByMe)  cCls += ` ${styles.purchased}`;
                    else if (blockedMe)   cCls += ` ${styles.pastPurchased}`;
                    else if (repeatMe)    cCls += ` ${styles.repeatable}`;
                    else if (!active)     cCls += ` ${styles.unavailable}`;
                    else if (clickable)   cCls += ` ${styles.available}`;
                    else                  cCls += ` ${styles.unavailable}`;

                    return (
                      <td key={mob.id} className={cCls}
                        onClick={() => clickable && openPurchaseModal(work, mob)}
                        style={{
                          cursor:        clickable ? 'pointer' : 'not-allowed',
                          outline:       isSelCol ? '2px solid rgba(255,152,0,.4)' : 'none',
                          outlineOffset: '-2px',
                          opacity:       blockedMe ? 0.4 : 1,
                        }}
                        title={
                          boughtByMe  ? `Куплено: +${rate}%` :
                          blockedMe   ? 'Заблокирован' :
                          repeatMe    ? '↺ Доступен повторно' :
                          !active     ? 'Не в этом году' :
                          canClickMulti ? `Купить для ${validLUsForSel.length} уч.` :
                          canClickSingle ? 'Нажмите для покупки' : 'Недоступно'
                        }
                      >
                        {boughtByMe ? (
                          <div className={styles.cellPurchased}>
                            <span className={styles.cellRate}>{rate}%</span>
                          </div>
                        ) : blockedMe ? (
                          <div className={styles.cellUnavailable}>
                            <span className={styles.cellLockIcon}>✕</span>
                          </div>
                        ) : repeatMe ? (
                          <div className={styles.cellAvailable}>
                            <span className={styles.cellHiddenRate}>↺</span>
                            <span className={styles.cellHoverInfo}>Повтор</span>
                          </div>
                        ) : !active ? (
                          <div className={styles.cellUnavailable}>
                            <span className={styles.cellLockIcon}>-</span>
                          </div>
                        ) : (
                          <div className={styles.cellAvailable}>
                            <span className={styles.cellHiddenRate}>?</span>
                            <span className={styles.cellHoverInfo}>
                              {canClickMulti && validLUsForSel.length > 1 ? `×${validLUsForSel.length}` : 'Купить'}
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Итоговая строка */}
              <tr className={styles.totalsRow}>
                <td colSpan="2" className={styles.totalsLabel}><strong>Итоговая успешность:</strong></td>
                {MOBILIZATION_WORKS.map((mob) => {
                  const { cls }   = getColGroup(mob.id);
                  const succ      = colRateActive(mob.id);
                  const bought    = Object.keys(activeProg?.purchasedCells || {}).some(k => k.endsWith(`-${mob.id}`));
                  const blocked   = activeLU && (getProgress(activeLU.cellRef).blockedColumns || []).includes(mob.id);
                  const repeat    = activeLU && !blocked && Object.values(getProgress(activeLU.cellRef).columnsByYear || {}).includes(mob.id);
                  return (
                    <td key={mob.id} className={`${styles.totalsCell} ${styles[cls] || ''}`}>
                      {bought
                        ? <span className={`${styles.totalSuccess} ${succ >= 70 ? styles.high : succ >= 40 ? styles.medium : styles.low}`}>{succ}%</span>
                        : blocked ? <span style={{ color: '#bdbdbd', fontSize: '0.9rem' }}>✕</span>
                        : repeat  ? <span style={{ color: '#ff9800', fontSize: '0.9rem' }}>↺</span>
                        :           <span className={styles.lockedTotal}>?</span>
                      }
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  МОДАЛЬНЫЕ ОКНА                                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {/* Подтверждение завершения года */}
      {showYearConfirm && (
        <div className={styles.cellModalOverlay} onClick={() => setShowYearConfirm(false)}>
          <div className={styles.cellModal} onClick={e => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => setShowYearConfirm(false)}>✕</button>
            <h3 style={{ color: '#ff9800' }}>Завершить год {globalYear}?</h3>
            <div className={styles.modalInfo}>
              <p style={{ textAlign: 'center', color: '#d32f2f', fontWeight: 600 }}>Оставшееся время будет потеряно!</p>
              <p style={{ textAlign: 'center', color: '#666' }}>Осталось: {fmt(timer.remaining)}</p>
              {REFUSAL_YEARS.includes(globalYear) && (
                <p style={{ textAlign: 'center', color: '#e65100', fontWeight: 'bold', marginTop: 8 }}>
                  Этот год — год возможного отказа от участков
                </p>
              )}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.purchaseModalBtn} onClick={doFinishYear} style={{ background: '#ff9800' }}>Да, завершить</button>
              <button className={styles.cancelModalBtn} onClick={() => setShowYearConfirm(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка покупки */}
      {purchaseModal && (
        <div className={styles.cellModalOverlay} onClick={() => setPurchaseModal(null)}>
          <div className={styles.cellModal} onClick={e => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => setPurchaseModal(null)}>✕</button>
            <h3>
              {purchaseModal.multi
                ? `Покупка НИР для ${purchaseModal.toBuy.length} участков`
                : `Покупка НИР — ${ownedLUs.find(l => l.cellRef === purchaseModal.luId)?.name || purchaseModal.luId}`}
            </h3>
            <div className={styles.modalInfo}>
              <div className={styles.infoRow}>
                <span className={styles.label}>НИР:</span>
                <span className={styles.value}>{purchaseModal.work.name}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>Столбец:</span>
                <span className={styles.value}>{purchaseModal.mob.name}</span>
              </div>

              {purchaseModal.multi ? (
                <>
                  {purchaseModal.breakdown.map(({ luId, needsMob, cost }) => {
                    const luName = ownedLUs.find(l => l.cellRef === luId)?.name || luId;
                    return (
                      <div key={luId} className={styles.infoRow}>
                        <span className={styles.label}>{luName}:</span>
                        <span className={styles.value}>
                          {purchaseModal.work.cost} млн
                          {needsMob
                            ? ` + моб. ${purchaseModal.mob.cost} млн`
                            : ' (мобилизация оплачена ✓)'}
                          {' = '}<strong>{cost} млн</strong>
                        </span>
                      </div>
                    );
                  })}
                  <div className={`${styles.infoRow} ${styles.total}`}>
                    <span className={styles.label}>ИТОГО:</span>
                    <span className={styles.value}>{purchaseModal.total} млн руб.</span>
                  </div>
                </>
              ) : (
                <>
                  {purchaseModal.needsMob ? (
                    <div className={`${styles.infoRow} ${styles.highlight}`}>
                      <span className={styles.label}>+ Мобилизация:</span>
                      <span className={styles.value}>{purchaseModal.mob.cost} млн (первый раз)</span>
                    </div>
                  ) : (
                    <div className={styles.infoRow}>
                      <span className={styles.label}>Мобилизация:</span>
                      <span className={styles.value} style={{ color: '#2e7d32' }}>уже оплачена ✓</span>
                    </div>
                  )}
                  <div className={`${styles.infoRow} ${styles.total}`}>
                    <span className={styles.label}>ИТОГО:</span>
                    <span className={styles.value}>{purchaseModal.total} млн руб.</span>
                  </div>
                </>
              )}

              <div className={`${styles.infoRow} ${styles.mystery}`}>
                <span className={styles.value}>(% успешности откроется после покупки)</span>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.purchaseModalBtn}
                onClick={confirmPurchase}
                disabled={player.budget < purchaseModal.total}>
                {purchaseModal.multi
                  ? `Купить для всех (${purchaseModal.total} млн)`
                  : `Купить (${purchaseModal.total} млн)`}
              </button>
              <button className={styles.cancelModalBtn} onClick={() => setPurchaseModal(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Отказ от участков (годы 3 и 5) */}
      {showRefusalModal && (
        <div className={styles.cellModalOverlay}>
          <div className={styles.cellModal} onClick={e => e.stopPropagation()}>
            <h3 style={{ textAlign: 'center', color: '#e65100' }}>Возможность отказа от участка</h3>
            <div className={styles.modalInfo}>
              <p style={{ textAlign: 'center', lineHeight: 1.5 }}>
                {timer.refusalYear === 3
                  ? 'После 3 года можно отказаться от одного участка.'
                  : 'После 5 года можно отказаться от участков.'}
              </p>
              <div style={{ textAlign: 'center', padding: '6px 14px', background: '#fff3e0', borderRadius: 8, border: '2px solid #ff9800', margin: '8px 0' }}>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#e65100' }}>
                  Время: {fmt(timer.refusalLeft)}
                </span>
              </div>
              {ownedLUs.length > 0 && (
                <div>
                  <p style={{ fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>Выберите участок для отказа:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ownedLUs.map(lu => (
                      <div key={lu.id}
                        onClick={() => setRefusalLU(lu.id === refusalLU ? null : lu.id)}
                        style={{
                          padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                          background: refusalLU === lu.id ? '#fff3e0' : '#f5f5f5',
                          border: `2px solid ${refusalLU === lu.id ? '#ff9800' : '#e0e0e0'}`,
                          fontWeight: refusalLU === lu.id ? 700 : 400,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                        <span>{lu.name}</span>
                        {refusalLU === lu.id && <span style={{ color: '#ff9800' }}>✓</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.purchaseModalBtn}
                onClick={() => {
                  if (!refusalLU && ownedLUs.length > 0) { alert('Выберите участок для отказа'); return; }
                  handleRefusalAccept(refusalLU);
                }}
                style={{ background: '#e65100' }}>
                Отказаться и продолжить
              </button>
              <button className={styles.cancelModalBtn} onClick={() => goToNextYear()}>
                Продолжить с текущими
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Финальное окно */}
      {showFinalModal && (
        <div className={styles.cellModalOverlay}>
          <div className={styles.cellModal}>
            <h3 style={{ textAlign: 'center', color: '#2e7d32', fontSize: '1.5rem' }}>Исследования завершены!</h3>
            <div className={styles.modalInfo}>
              <p style={{ textAlign: 'center', fontSize: '1.1rem', marginBottom: 12 }}>Все 10 лет пройдены</p>
              {Object.keys(gridCells.owned).map(cellRef => (
                <div key={cellRef} style={{ padding: '6px 14px', background: '#e8f5e9', borderRadius: 6, marginBottom: 4, fontWeight: 600 }}>
                  ✓ Участок {cellRef}
                </div>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.purchaseModalBtn} onClick={onComplete}>Перейти к зоне событий</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}