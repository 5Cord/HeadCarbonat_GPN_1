// EventsZone.jsx — таймер читается из globalTimer store, локального setInterval нет
import React, { useState, useEffect, useRef } from 'react';
import { generateEventLine, CARD_TYPES } from './Eventsdata.js';
import useGameStore from '../../store/gameStore';
import GlobalTimer from '../GlobalTimer';
import styles from './EventsZone.module.css';
import BudgetBar from '../Budgetbar.jsx';
import { getSocket } from '../apiHelpers';


const CardImage = ({ src, alt = '123', className = '' }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return <img src={src} alt={alt} className={`${styles.cardImage} ${className}`} onError={() => setFailed(true)} />;
};

const fmtEffect = (effect) => {
  if (!effect) return '';
  if (effect.type === 'points') return (effect.value >= 0 ? '+' : '') + effect.value + ' очков';
  if (effect.type === 'money') return (effect.value >= 0 ? '+' : '') + effect.value + ' млн';
  if (effect.type === 'cancel') return '✦ Отмена риска';
  return '';
};

const effectIsPositive = (effect) => {
  if (!effect) return null;
  if (effect.type === 'cancel') return true;
  return effect.value > 0;
};

// Компонент модалки подтверждения пропуска
const SkipConfirmModal = ({ lineName, stats, onConfirm, onCancel }) => {
  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.skipConfirmModal} onClick={e => e.stopPropagation()}>
        <div className={styles.skipConfirmIcon}></div>
        <div className={styles.skipConfirmContent}>
          <h3 className={styles.skipConfirmTitle}>Пропустить линию событий?</h3>
          <p className={styles.skipConfirmLine}>{lineName}</p>

          <div className={styles.skipConfirmStats}>
            <div className={styles.skipStatRow}>
              <span className={styles.skipStatLabel}>Текущий счёт:</span>
              <span className={styles.skipStatValue}>{stats.score} очков</span>
            </div>
            <div className={styles.skipStatRow}>
              <span className={styles.skipStatLabel}>Правильных ответов:</span>
              <span className={styles.skipStatValue}>{stats.correct}</span>
            </div>
            <div className={styles.skipStatRow}>
              <span className={styles.skipStatLabel}>Неправильных ответов:</span>
              <span className={styles.skipStatValue}>{stats.wrong}</span>
            </div>
            {stats.moneyDelta !== 0 && (
              <div className={styles.skipStatRow}>
                <span className={styles.skipStatLabel}>Изменение бюджета:</span>
                <span className={styles.skipStatValue} style={{ color: stats.moneyDelta > 0 ? '#4ade80' : '#f87171' }}>
                  {stats.moneyDelta > 0 ? '+' : ''}{stats.moneyDelta} млн
                </span>
              </div>
            )}
          </div>

          <div className={styles.skipConfirmWarning}>
            <span></span>
            <span>Неотвеченные карточки будут пропущены без начисления очков</span>
          </div>

          <div className={styles.skipConfirmActions}>
            <button className={styles.skipConfirmCancel} onClick={onCancel}>
              Отмена
            </button>
            <button className={styles.skipConfirmConfirm} onClick={onConfirm}>
              Подтвердить пропуск
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EventsZone = ({ onComplete, onBack, onMenu }) => {
  const {
    gridCells, research, events, player, fieldWork,
    saveEventLine, revealEventCard, updateEventLineScore,
    skipEventLine, completeEvents, updateEventMoneySpent,
    pauseGlobalTimer, resumeGlobalTimer, setGlobalPhase, licenseUnits,
    resetEventCardsForNewYear, applyYearTransitionForAllLUs, advanceToNextYear,
    setNavigateToRefusal,
  } = useGameStore();

  const globalTimer = useGameStore(s => s.globalTimer);
  const globalYear = useGameStore(s => s.game.currentYear);
  const timeRemaining = useGameStore(s => s.globalTimer.timeRemaining);
  const isLastYear = globalYear >= 10;

  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [cancelPickMode, setCancelPickMode] = useState(false);
  const [cancelSource, setCancelSource] = useState(null);
  const [skipConfirmData, setSkipConfirmData] = useState(null);

  const [showYearEndModal, setShowYearEndModal] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // lineStatsRef — трекер ответов/денег по каждому ЛУ за текущий вызов компонента
  // Добавлено поле cardAnswers — массив детальных ответов для передачи на сервер
  const lineStatsRef = useRef({});

  const ownedLUs = Object.values(gridCells.owned).map(cell => ({
    id: cell.cellRef, cellRef: cell.cellRef,
    name: cell.name || `Участок ${cell.cellRef}`,
  }));

  const [activeLUId, setActiveLUId] = useState(() => ownedLUs[0]?.cellRef || null);
  const activeLU = ownedLUs.find(l => l.cellRef === activeLUId) || ownedLUs[0] || null;

  // Инициализируем трекер для каждого ЛУ
  useEffect(() => {
    ownedLUs.forEach(lu => {
      if (!lineStatsRef.current[lu.cellRef]) {
        lineStatsRef.current[lu.cellRef] = {
          correct: 0, wrong: 0, moneyDelta: 0,
          cardAnswers: [], // детальные ответы на карточки
          _saved: false,
        };
      }
    });
  }, [ownedLUs.length]);

  useEffect(() => {
    setGlobalPhase('EVENTS');
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

  useEffect(() => {
    if (selectedCard || cancelPickMode) pauseGlobalTimer();
    else resumeGlobalTimer();
  }, [selectedCard, cancelPickMode]);

  const hasResearchForLU = (luId) => {
    const luResearch = research.progressByLU[luId];
    const currentYearWorks = luResearch?.purchasedWorksByYear?.[globalYear] || [];
    return currentYearWorks.length > 0;
  };

  useEffect(() => {
    ownedLUs.forEach((lu) => {
      const hasResearch = hasResearchForLU(lu.id);
      const existingLine = events.linesByLU[lu.id];
      if (existingLine && existingLine.year === globalYear) return;

      if (hasResearch) {
        const luResearch = research.progressByLU[lu.id];
        let avgSuccess = 0;
        const yearRates = luResearch?.successRatesByYear?.[globalYear] || luResearch?.successRates || {};
        const rates = Object.values(yearRates);
        if (rates.length > 0) avgSuccess = rates.reduce((s, r) => s + r, 0) / rates.length;

        const lineData = {
          luId: lu.id, luName: lu.name, year: globalYear,
          cards: generateEventLine(avgSuccess),
          successRate: Math.round(avgSuccess),
          generatedAt: Date.now(), hasResearch: true,
        };

        let riskPointsTotal = 0;
        let riskMoneyTotal = 0;
        lineData.cards.forEach(c => {
          if (c.type === CARD_TYPES.RISK) {
            const effect = c.data.effect;
            if (!effect) return;
            if (effect.type === 'points') riskPointsTotal += effect.value;
            if (effect.type === 'money') riskMoneyTotal += effect.value;
          }
        });

        if (!lineStatsRef.current[lu.id]) {
          lineStatsRef.current[lu.id] = { correct: 0, wrong: 0, moneyDelta: 0, cardAnswers: [], _saved: false };
        }
        if (riskMoneyTotal !== 0) {
          lineStatsRef.current[lu.id].moneyDelta += riskMoneyTotal;
        }

        useGameStore.setState(state => {
          const newState = { events: { ...state.events } };
          if (riskPointsTotal !== 0) {
            newState.events = {
              ...newState.events,
              lineScores: { ...state.events.lineScores, [lu.id]: riskPointsTotal },
            };
          }
          if (riskMoneyTotal !== 0) {
            if (riskMoneyTotal < 0) {
              newState.events = {
                ...newState.events,
                totalMoneySpent: (state.events.totalMoneySpent || 0) + Math.abs(riskMoneyTotal),
              };
            }
            return { ...newState, player: { ...state.player, budget: state.player.budget + riskMoneyTotal } };
          }
          return newState;
        });

        saveEventLine(lu.id, lineData);
      } else {
        saveEventLine(lu.id, {
          luId: lu.id, luName: lu.name, year: globalYear,
          cards: [], successRate: 0, generatedAt: Date.now(), hasResearch: false,
        });
      }
    });
  }, [ownedLUs.length, research.progressByLU, events.linesByLU, globalYear]);

  const eventLines = ownedLUs.map(lu => {
    const lineData = events.linesByLU[lu.id] || {
      luId: lu.id, luName: lu.name, year: globalYear,
      cards: [], successRate: 0, hasResearch: hasResearchForLU(lu.id),
    };
    return { ...lineData, lineIndex: ownedLUs.findIndex(l => l.id === lu.id) };
  });

  const playableLines = eventLines.filter(line => line.hasResearch);
  const nonResearchLines = eventLines.filter(line => !line.hasResearch);
  const activeLine = activeLU ? playableLines.find(l => l.luId === activeLU.cellRef) || null : null;
  const activeLineIndex = activeLine ? playableLines.findIndex(l => l.luId === activeLine.luId) : -1;

  const isLineComplete = (lineIndex) => {
    const line = playableLines[lineIndex];
    if (!line) return true;
    if ((events.skippedLines[line.luId] || []).length > 0) return true;
    const rev = events.revealedCards[line.luId] || {};
    return line.cards.every((card, ci) => {
      const key = `${lineIndex}-${ci}`;
      if (card.type === CARD_TYPES.RISK) return true;
      if (card.type === CARD_TYPES.RANDOM) return true;
      return rev[key]?.revealed;
    });
  };

  const isLineSkipped = (li) => (events.skippedLines[playableLines[li]?.luId] || []).length > 0;
  const getLineScore = (li) => events.lineScores[playableLines[li]?.luId] || 0;

  const getLUStatus = (luId) => {
    const line = eventLines.find(l => l.luId === luId);
    if (!line?.hasResearch) return 'noResearch';
    const li = playableLines.findIndex(l => l.luId === luId);
    if (li === -1) return 'noResearch';
    if (isLineSkipped(li)) return 'skipped';
    if (isLineComplete(li)) return 'done';
    return 'ready';
  };

  const canCompleteStage = () => {
    if (playableLines.length > 0) return playableLines.every((_, i) => isLineComplete(i));
    return nonResearchLines.length > 0 || eventLines.length === 0;
  };

  // ── Сохранение линии на сервер (с детальными ответами) ────────────────────
  const saveLineToServer = (luId, options = {}) => {
    const socket = getSocket();
    if (!socket?.connected || !player.sessionId) return;

    const stats = lineStatsRef.current[luId] || { correct: 0, wrong: 0, moneyDelta: 0, cardAnswers: [] };
    const score = events.lineScores?.[luId] ?? 0;
    const currentBudget = useGameStore.getState().player.budget;

    socket.emit('events:save', {
      luId,
      year: globalYear,
      data: {
        score,
        moneyDelta: stats.moneyDelta,
        correctAnswers: stats.correct,
        wrongAnswers: stats.wrong,
        budgetAfter: currentBudget,
        line: events.linesByLU[luId] || {},
        completed: options.completed || false,
        skipped: options.skipped || false,
        // Детальные ответы для AdminPanel
        cardAnswers: stats.cardAnswers || [],
      },
    }, (res) => {
      if (!res?.ok) console.warn('events:save failed:', res?.error);
    });
  };

  useEffect(() => {
    playableLines.forEach((line, li) => {
      if (isLineComplete(li) || isLineSkipped(li)) {
        const stats = lineStatsRef.current[line.luId];
        if (stats && !stats._saved) {
          stats._saved = true;
          saveLineToServer(line.luId, { completed: true });
        }
      }
    });
  });

  const handleCardClick = (lineIndex, cardIndex, card) => {
    const line = playableLines[lineIndex];
    if (!line) return;
    if (card.type === CARD_TYPES.RISK) {
      if (cancelPickMode && cancelSource) handleCancelRisk(lineIndex, cardIndex, card);
      return;
    }
    const cardKey = `${lineIndex}-${cardIndex}`;
    const luId = line.luId;
    const rev = events.revealedCards[luId] || {};
    if (rev[cardKey]?.revealed) return;
    if ((events.skippedLines[luId] || []).length > 0) return;
    setSelectedCard({ lineIndex, cardIndex, card, cardKey, luId });
    setSelectedAnswers([]);
  };

  // Обработка выбора варианта ответа (с ограничением по количеству)
  const handleSelectAnswer = (answerIndex) => {
    if (!selectedCard || selectedCard.card.type !== CARD_TYPES.OPPORTUNITY) return;

    const { card } = selectedCard;
    const isMultipleChoice = card.data.correctAnswer && Array.isArray(card.data.correctAnswer);
    const maxSelections = isMultipleChoice ? card.data.correctAnswer.length : 1;

    if (selectedAnswers.includes(answerIndex)) {
      setSelectedAnswers(selectedAnswers.filter(idx => idx !== answerIndex));
    } else {
      if (selectedAnswers.length < maxSelections) {
        setSelectedAnswers([...selectedAnswers, answerIndex]);
      }
    }
  };

  // ── Подтверждение ответа — записываем детальный ответ в lineStatsRef ──────
  const handleConfirmAnswer = () => {
    if (!selectedCard || selectedCard.card.type !== CARD_TYPES.OPPORTUNITY) return;

    const { cardKey, card, luId, cardIndex } = selectedCard;
    const isMultipleChoice = card.data.correctAnswer && Array.isArray(card.data.correctAnswer);

    const expectedCount = isMultipleChoice ? card.data.correctAnswer.length : 1;
    if (selectedAnswers.length !== expectedCount) return;

    let isCorrect = false;
    if (isMultipleChoice) {
      isCorrect = card.data.correctAnswer.every(correctIdx =>
        selectedAnswers.includes(correctIdx)
      ) && selectedAnswers.length === card.data.correctAnswer.length;
    } else {
      isCorrect = selectedAnswers[0] === card.data.correctAnswer;
    }

    const pts = isCorrect ? card.data.points : 0;

    if (!lineStatsRef.current[luId]) {
      lineStatsRef.current[luId] = { correct: 0, wrong: 0, moneyDelta: 0, cardAnswers: [], _saved: false };
    }
    lineStatsRef.current[luId]._saved = false;
    if (isCorrect) lineStatsRef.current[luId].correct += 1;
    else lineStatsRef.current[luId].wrong += 1;

    // ── Детальная запись ответа ───────────────────────────────────────────
    lineStatsRef.current[luId].cardAnswers.push({
      cardIndex,
      cardType: 'opportunity',
      question: card.data.question || '',
      options: card.data.options || [],
      selectedAnswers: [...selectedAnswers],
      correctAnswer: card.data.correctAnswer,
      isCorrect,
      points: pts,
      skipped: false,
    });

    revealEventCard(luId, cardKey, { revealed: true, correct: isCorrect, points: pts });
    updateEventLineScore(luId, pts);
    setSelectedCard(null);
    setSelectedAnswers([]);
  };

  const handlePlayRandom = () => {
    if (!selectedCard || selectedCard.card.type !== CARD_TYPES.RANDOM) return;
    const { cardKey, card, luId, cardIndex } = selectedCard;
    const effect = card.data.effect
      || (typeof card.data.points === 'number' ? { type: 'points', value: card.data.points } : { type: 'points', value: 0 });

    if (effect.type === 'cancel') {
      revealEventCard(luId, cardKey, { revealed: true, played: true, points: 0 });
      setSelectedCard(null);
      setCancelSource({ cardKey, luId });
      setCancelPickMode(true);
      return;
    }

    if (!lineStatsRef.current[luId]) {
      lineStatsRef.current[luId] = { correct: 0, wrong: 0, moneyDelta: 0, cardAnswers: [], _saved: false };
    }
    lineStatsRef.current[luId]._saved = false;

    if (effect.type === 'points') {
      revealEventCard(luId, cardKey, { revealed: true, played: true, points: effect.value });
      updateEventLineScore(luId, effect.value);
    }

    if (effect.type === 'money') {
      revealEventCard(luId, cardKey, { revealed: true, played: true, money: effect.value });
      useGameStore.setState(st => ({ player: { ...st.player, budget: st.player.budget + effect.value } }));
      updateEventMoneySpent(effect.value);
      lineStatsRef.current[luId].moneyDelta += effect.value;
    }

    setSelectedCard(null);
  };

  const handleCancelRisk = (lineIndex, cardIndex, card) => {
    if (!cancelSource) return;
    const luId = cancelSource.luId;
    const cardKey = `${lineIndex}-${cardIndex}`;
    const effect = card.data.effect;

    if (!lineStatsRef.current[luId]) {
      lineStatsRef.current[luId] = { correct: 0, wrong: 0, moneyDelta: 0, cardAnswers: [], _saved: false };
    }
    lineStatsRef.current[luId]._saved = false;

    if (effect?.type === 'points' && effect.value < 0) {
      updateEventLineScore(luId, -effect.value);
      useGameStore.setState(st => ({
        events: {
          ...st.events,
          revealedCards: {
            ...st.events.revealedCards,
            [luId]: {
              ...(st.events.revealedCards[luId] || {}),
              [cardKey]: { revealed: true, cancelled: true, points: 0 },
            },
          },
        },
      }));
    } else if (effect?.type === 'money' && effect.value < 0) {
      useGameStore.setState(st => ({
        player: { ...st.player, budget: st.player.budget - effect.value },
        events: {
          ...st.events,
          revealedCards: {
            ...st.events.revealedCards,
            [luId]: {
              ...(st.events.revealedCards[luId] || {}),
              [cardKey]: { revealed: true, cancelled: true, money: 0 },
            },
          },
        },
      }));
      lineStatsRef.current[luId].moneyDelta -= effect.value;
    }

    setCancelPickMode(false);
    setCancelSource(null);
  };

  const handleSkipLine = (lineIndex) => {
    const line = playableLines[lineIndex];
    if (!line) return;

    const currentStats = lineStatsRef.current[line.luId] || { correct: 0, wrong: 0, moneyDelta: 0, cardAnswers: [], _saved: false };
    const currentScore = events.lineScores?.[line.luId] || 0;

    setSkipConfirmData({
      lineIndex,
      line,
      stats: {
        score: currentScore,
        correct: currentStats.correct,
        wrong: currentStats.wrong,
        moneyDelta: currentStats.moneyDelta,
      }
    });
  };

  const confirmSkipLine = () => {
    if (!skipConfirmData) return;

    const { lineIndex, line, stats } = skipConfirmData;

    // Помечаем все ещё не открытые карточки-вопросы как пропущенные в детальных ответах
    if (!lineStatsRef.current[line.luId]) {
      lineStatsRef.current[line.luId] = { correct: 0, wrong: 0, moneyDelta: 0, cardAnswers: [], _saved: false };
    }
    const lineData = events.linesByLU[line.luId];
    if (lineData?.cards) {
      const rev = events.revealedCards[line.luId] || {};
      lineData.cards.forEach((card, ci) => {
        if (card.type !== CARD_TYPES.OPPORTUNITY) return;
        const key = `${lineIndex}-${ci}`;
        if (rev[key]?.revealed) return; // уже отвечено — не дублируем
        lineStatsRef.current[line.luId].cardAnswers.push({
          cardIndex: ci,
          cardType: 'opportunity',
          question: card.data?.question || '',
          options: card.data?.options || [],
          selectedAnswers: [],
          correctAnswer: card.data?.correctAnswer ?? null,
          isCorrect: false,
          points: 0,
          skipped: true,
        });
      });
    }

    const socket = getSocket();
    if (socket?.connected && player.sessionId) {
      socket.emit('events:save', {
        luId: line.luId,
        year: globalYear,
        data: {
          score: stats.score,
          moneyDelta: stats.moneyDelta,
          correctAnswers: stats.correct,
          wrongAnswers: stats.wrong,
          budgetAfter: useGameStore.getState().player.budget,
          line: events.linesByLU[line.luId] || {},
          completed: false,
          skipped: true,
          cardAnswers: lineStatsRef.current[line.luId]?.cardAnswers || [],
        },
      }, (res) => {
        if (!res?.ok) console.warn('events:save failed before skip:', res?.error);
      });
    }

    skipEventLine(line.luId);

    line.cards.forEach((card, ci) => {
      const key = `${lineIndex}-${ci}`;
      const rev = events.revealedCards[line.luId] || {};
      if (rev[key]?.revealed) return;
      revealEventCard(line.luId, key, {
        revealed: true, skipped: true, points: 0, timestamp: Date.now()
      });
    });

    if (lineStatsRef.current[line.luId]) {
      lineStatsRef.current[line.luId]._saved = false;
      lineStatsRef.current[line.luId].skipped = true;
    }

    setSkipConfirmData(null);
  };

  const cancelSkipLine = () => {
    setSkipConfirmData(null);
  };

  const handleComplete = () => {
    playableLines.forEach(line => {
      const stats = lineStatsRef.current[line.luId];
      if (stats) {
        stats._saved = false;
        saveLineToServer(line.luId, { completed: true });
      }
    });
    completeEvents();
    onComplete();
  };

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

  const getLicenseCost = () => {
    const ownedLicenses = licenseUnits?.owned ?? licenseUnits?.licenseUnits?.owned ?? [];
    return ownedLicenses.reduce((s, lu) => s + (lu.cost || 0), 0);
  };

  const getGridCost = () => {
    return Object.values(gridCells?.owned ?? {}).reduce((s, c) => s + (c.auctionPrice || 0), 0);
  };

  const renderCard = (card, cardIndex, lineIndex, line) => {
    const luId = line.luId;
    const cardKey = `${lineIndex}-${cardIndex}`;
    const rev = (events.revealedCards[luId] || {})[cardKey];
    const skipped = isLineSkipped(lineIndex);
    const cancelled = rev?.cancelled;

    const normalizeEffect = (data) => {
      if (data?.effect) return data.effect;
      if (typeof data?.points === 'number') return { type: 'points', value: data.points };
      return { type: 'points', value: 0 };
    };

    if (card.type === CARD_TYPES.RISK) {
      const parts = card.data.description.split(':');
      const title = parts[0].trim();
      const desc = parts.slice(1).join(':').trim();
      const effect = normalizeEffect(card.data);
      const badgeTxt = effect.type === 'money'
        ? (effect.value >= 0 ? '+' : '') + effect.value + '₽'
        : (effect.value >= 0 ? '+' : '') + String(effect.value);
      const isPickable = cancelPickMode && cancelSource?.luId === luId && !cancelled;
      return (
        <div key={cardIndex}
          className={[styles.riskCard, cancelled ? styles.riskCancelled : '', isPickable ? styles.riskPickable : ''].join(' ')}
          onClick={() => isPickable && handleCancelRisk(lineIndex, cardIndex, card)}
          title={isPickable ? 'Нажмите, чтобы отменить этот риск' : undefined}
        >
          <CardImage src={card.data.image} alt="Риск" className={styles.riskBgImage} />
          <div className={styles.riskBadge}>{cancelled ? '✕' : badgeTxt}</div>
          {cancelled && <div className={styles.riskCancelBanner}>ОТМЕНЁН</div>}
          <div className={styles.riskFooter}>
            <div className={styles.riskTitle}>{title}</div>
            {desc && <div className={styles.riskDesc}>{desc}</div>}
          </div>
        </div>
      );
    }

    if (card.type === CARD_TYPES.OPPORTUNITY) {
      return (
        <div key={cardIndex}
          className={`${styles.eventCard} ${styles.opportunity} ${rev?.revealed ? `${styles.revealed} ${styles.answered}` : ''}`}
          onClick={() => !rev?.revealed && !skipped && handleCardClick(lineIndex, cardIndex, card)}
          style={{ cursor: rev?.revealed || skipped ? 'default' : 'pointer' }}
        >
          <div className={styles.cardFront}>
            {rev?.revealed ? (
              <div className={styles.opportunityResult}>
                <span>{rev.correct ? '✅' : '❌'}</span>
                <span className={styles.points}>{rev.points > 0 ? `+${rev.points}` : '0'}</span>
              </div>
            ) : (
              <div className={styles.opportunityPreview}>
                <span style={{ fontSize: '2rem' }}></span>
                <span className={styles.points} style={{ color: '#2e7d32', fontSize: '1.5rem' }}>+{card.data.points}</span>
                <span style={{ fontSize: '0.75rem', color: '#666', marginTop: '5px' }}>Нажмите</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    const effect = normalizeEffect(card.data);
    const isPos = effectIsPositive(effect);
    const effLabel = fmtEffect(effect);
    return (
      <div key={cardIndex}
        className={`${styles.randomCard} ${rev?.revealed ? (isPos ? styles.randomPos : styles.randomNeg) : ''} ${styles.optionalCard}`}
        onClick={() => !rev?.revealed && !skipped && handleCardClick(lineIndex, cardIndex, card)}
        style={{ cursor: rev?.revealed || skipped ? 'default' : 'pointer' }}
      >
        {!rev?.revealed ? (
          <div className={styles.randomBack}>
            <CardImage src={card.data.image} alt="Случайность" className={styles.randomBgImage} />
            <div className={styles.randomBackOverlay}>
              <span className={styles.cardTypeIcon}>🎲</span>
              <span className={styles.optionalBadge}>необяз.</span>
            </div>
          </div>
        ) : (
          <div className={styles.randomFront}>
            <CardImage src={card.data.image} alt="Случайность" className={styles.randomBgImage} />
            <div className={styles.randomFrontOverlay}>
              {rev.played ? (
                <><span className={styles.randomEffectBadge}>{effLabel}</span><span className={styles.randomTitle}>{card.data.title}</span></>
              ) : (
                <><span className={styles.randomSkippedBadge}>Не сыграна</span><span className={styles.randomTitle}>{card.data.title}</span></>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const totalSpent =
    Object.values(research.progressByLU).reduce((s, p) => s + (p.totalSpent || 0), 0) +
    (fieldWork.totalSpent || 0) +
    (events.totalMoneySpent || 0) +
    (licenseUnits?.owned ?? []).reduce((s, lu) => s + (lu.cost || 0), 0) +
    Object.values(gridCells?.owned ?? {}).reduce((s, c) => s + (c.auctionPrice || 0), 0);

  const incompleteCount = playableLines.filter((_, i) => !isLineComplete(i) && !isLineSkipped(i)).length;

  return (
    <div className={styles.eventsZone}>
      <GlobalTimer />

      <div className={styles.researchMapControls}>
        <button className={`${styles.researchControlBtn} ${styles.researchBackBtn}`} onClick={onBack}>← Назад</button>
        <button className={`${styles.researchControlBtn} ${styles.researchBackBtn}`} onClick={onMenu}>В меню</button>
        <div className={styles.nextBtnWrap}>
          <button className={`${styles.researchControlBtn} ${styles.researchNextBtn}`} onClick={handleComplete} disabled={!canCompleteStage()}>
            Далее — К полевым работам
          </button>
          {!canCompleteStage() && incompleteCount > 0 && (
            <div className={styles.nextBtnHint}>
              Осталось завершить: {incompleteCount} {incompleteCount === 1 ? 'участок' : incompleteCount < 5 ? 'участка' : 'участков'}
            </div>
          )}
        </div>
      </div>

      <div className={styles.luSection}>
        <h2 className={styles.panelTitle}>Зона событий</h2>
        <div className={styles.luSectionLabel}>Выберите участок:</div>
        <div className={styles.luCardsRow}>
          {ownedLUs.map(lu => {
            const status = getLUStatus(lu.cellRef);
            const isActive = lu.cellRef === activeLUId;
            const score = events.lineScores?.[lu.cellRef] ?? 0;
            const line = events.linesByLU[lu.cellRef];
            const hasRes = hasResearchForLU(lu.cellRef);
            const luLineIndex = playableLines.findIndex(l => l.luId === lu.cellRef);
            const totalQ = line?.cards?.filter(c => c.type === CARD_TYPES.OPPORTUNITY).length ?? 0;
            const revMap = events.revealedCards[lu.cellRef] || {};
            const answeredQ = line?.cards?.reduce((count, card, ci) => {
              const key = `${luLineIndex}-${ci}`;
              return card.type === CARD_TYPES.OPPORTUNITY && revMap[key]?.revealed ? count + 1 : count;
            }, 0) ?? 0;
            return (
              <div key={lu.cellRef} onClick={() => setActiveLUId(lu.cellRef)}
                className={[styles.luCard, isActive ? styles.luCardActive : '', styles['luSt_' + status]].join(' ')}>
                <div className={styles.luCardRef}>{lu.cellRef}</div>
                <div className={styles.luCardName}>{lu.name}</div>
                <div className={styles.luCardMeta}>
                  {hasRes && line?.successRate != null && <span className={styles.metaMob}>Успех {line.successRate}%</span>}
                  {score !== 0 && (
                    <span className={[styles.metaScore, score >= 0 ? styles.metaPos : styles.metaNeg].join(' ')}>
                      {score >= 0 ? '+' : ''}{score}
                    </span>
                  )}
                </div>
                {hasRes && totalQ > 0 && (
                  <div className={styles.luProgress}>
                    <span className={styles.luProgressCount}>{answeredQ}/{totalQ}</span>
                    <div className={styles.luProgressBar}>
                      <div className={styles.luProgressFill} style={{ width: `${(answeredQ / totalQ) * 100}%` }} />
                    </div>
                  </div>
                )}
                <div className={styles.luCardStatus}>
                  {status === 'done' ? 'Пройдено' : status === 'skipped' ? 'Пропущено' : status === 'noResearch' ? 'Нет НИР' : 'В процессе'}
                </div>
              </div>
            );
          })}
        </div>
        <BudgetBar
          budget={player.budget}
          spent={totalSpent}
          phaseSpent={events.moneySpentByYear?.[globalYear] || 0}
          theme="light"
        />
      </div>

      <div className={styles.activeLineArea}>
        {!activeLU ? (
          <div className={styles.emptyMsg}>Нет купленных участков</div>
        ) : !activeLine ? (
          <div className={styles.emptyMsg}>
            Для участка <strong>{activeLU.cellRef}</strong> не проводились НИРы в этом году.
          </div>
        ) : (
          <div className={`${styles.eventLine} ${activeLine.generatedAt && Date.now() - activeLine.generatedAt < 5000 ? styles.newLine : ''}`}>
            <div className={styles.lineHeader}>
              <div className={styles.lineHeaderLeft}>
                <h3>{activeLine.luName}</h3>
                <span className={styles.successRate}>Успешность: {activeLine.successRate}%</span>
              </div>
              <div className={styles.lineStats}>
                <span className={`${styles.lineScore} ${getLineScore(activeLineIndex) >= 0 ? styles.positive : styles.negative}`}>
                  Счёт: {getLineScore(activeLineIndex) >= 0 ? '+' : ''}{getLineScore(activeLineIndex)}
                </span>

                {isLineSkipped(activeLineIndex) && <span className={`${styles.lineStatus} ${styles.skipped}`}>⏭️ Пропущено</span>}
                {isLineComplete(activeLineIndex) && !isLineSkipped(activeLineIndex) && (
                  <span className={styles.lineStatus}>
                    {getLineScore(activeLineIndex) >= 0 ? 'Пройдено ✅' : 'Провалено ❌'}
                  </span>
                )}
                {!isLineComplete(activeLineIndex) && !isLineSkipped(activeLineIndex) && (
                  <button className={styles.skipLineBtn} onClick={() => handleSkipLine(activeLineIndex)}>Пропустить</button>
                )}
              </div>
            </div>
            <div className={styles.cardsRow}>
              {activeLine.cards.map((card, ci) => renderCard(card, ci, activeLineIndex, activeLine))}
            </div>
            {activeLine.cards.some(c => c.type === CARD_TYPES.RANDOM) && (
              <div className={styles.randomHint}>Крайняя правая карточка («случайность») необязательна</div>
            )}
          </div>
        )}
        {nonResearchLines.length > 0 && (
          <div className={styles.noResearchSection}>
            <p className={styles.noResearchLabel}>Участки без НИРов в этом году:</p>
            <div className={styles.noResearchList}>
              {nonResearchLines.map(line => <span key={line.luId} className={styles.noResearchItem}>{line.luName}</span>)}
            </div>
          </div>
        )}
      </div>

      {selectedCard && (
        <div className={styles.cardModalOverlay}>
          <div className={styles.cardModal} onClick={e => e.stopPropagation()}>
            {selectedCard.card.type === CARD_TYPES.OPPORTUNITY && (() => {
              const isMultipleChoice = selectedCard.card.data.correctAnswer &&
                Array.isArray(selectedCard.card.data.correctAnswer);
              const maxSelections = isMultipleChoice ? selectedCard.card.data.correctAnswer.length : 1;
              const canConfirm = selectedAnswers.length === maxSelections;

              return (
                <div className={styles.opportunityModal}>
                  <h3>Карточка возможности</h3>
                  <div className={styles.mustAnswerHint}>
                    {isMultipleChoice
                      ? `Выберите ${maxSelections} варианта ответа, затем нажмите "Подтвердить ответ"`
                      : 'Выберите ответ, затем нажмите "Подтвердить ответ"'}
                  </div>
                  <div className={styles.cardContent}>
                    {selectedCard.card.data.image && (
                      <div className={styles.modalImageWrap}>
                        <CardImage src={selectedCard.card.data.image} alt="Иллюстрация" className={styles.modalImage} />
                      </div>
                    )}
                    <p className={styles.question}>{selectedCard.card.data.question}</p>
                    <div className={styles.options}>
                      {selectedCard.card.data.options.map((opt, i) => (
                        <button
                          key={i}
                          className={`${styles.optionBtn} ${selectedAnswers.includes(i) ? styles.optionBtnSelected : ''}`}
                          onClick={() => handleSelectAnswer(i)}
                        >
                          {opt}
                          {selectedAnswers.includes(i) && <span className={styles.checkmark}></span>}
                        </button>
                      ))}
                    </div>
                    <div className={styles.selectionInfo}>
                      <span className={styles.selectionCount}>
                        Выбрано: {selectedAnswers.length} из {maxSelections}
                      </span>
                    </div>
                    <div className={styles.confirmButtonContainer}>
                      <button
                        className={`${styles.confirmAnswerBtn} ${canConfirm ? styles.confirmActive : styles.confirmDisabled}`}
                        onClick={handleConfirmAnswer}
                        disabled={!canConfirm}
                      >
                        Подтвердить ответ
                      </button>
                    </div>
                    <p className={styles.pointsInfo}>За правильный ответ: +{selectedCard.card.data.points}</p>
                  </div>
                </div>
              );
            })()}
            {selectedCard.card.type === CARD_TYPES.RANDOM && (() => {
              const effect = selectedCard.card.data.effect
                || (typeof selectedCard.card.data.points === 'number' ? { type: 'points', value: selectedCard.card.data.points } : { type: 'points', value: 0 });
              const isPos = effectIsPositive(effect);
              return (
                <div className={styles.randomModal}>
                  <h3>🎲 Карточка случайности</h3>
                  <div className={styles.mustAnswerHint}>Выберите действие, чтобы продолжить</div>
                  <div className={styles.cardContent}>
                    {selectedCard.card.data.image && (
                      <div className={styles.modalImageWrap}>
                        <CardImage src={selectedCard.card.data.image} alt="Случайность" className={styles.modalImage} />
                      </div>
                    )}
                    <p className={styles.randomCardTitle}>{selectedCard.card.data.title}</p>
                    <p className={styles.description}>{selectedCard.card.data.description}</p>
                    <div className={[styles.effectPreview, isPos ? styles.effectPos : styles.effectNeg].join(' ')}>
                      {fmtEffect(effect)}
                      {effect.type === 'cancel' && <span className={styles.effectHint}> — нажмите «Сыграть», затем выберите карточку риска</span>}
                    </div>
                    <div className={styles.randomActions}>
                      <button className={styles.playBtn} onClick={handlePlayRandom}>Сыграть карточку</button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {skipConfirmData && (
        <SkipConfirmModal
          lineName={skipConfirmData.line.luName}
          stats={skipConfirmData.stats}
          onConfirm={confirmSkipLine}
          onCancel={cancelSkipLine}
        />
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
    </div>
  );
};

export default EventsZone;