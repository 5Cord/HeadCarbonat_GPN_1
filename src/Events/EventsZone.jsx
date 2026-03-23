// EventsZone.jsx — таймер читается из globalTimer store, локального setInterval нет
import React, { useState, useEffect } from 'react';
import { generateEventLine, CARD_TYPES } from './Eventsdata.js';
import useGameStore from '../../store/gameStore';
import styles from './EventsZone.module.css';
import BudgetBar from '../Budgetbar.jsx';
import EventsZoneTour from './Eventszonetour';

const formatTime = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

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

const EventsZone = ({ onComplete, onBack, onMenu }) => {
  const {
    gridCells, research, events, player,
    saveEventLine, revealEventCard, updateEventLineScore,
    skipEventLine, completeEvents, updateEventMoneySpent,
    pauseGlobalTimer, resumeGlobalTimer, setGlobalPhase,
  } = useGameStore();

  // ── ГЛОБАЛЬНЫЙ ТАЙМЕР (только чтение) ────────────────────────────────────
  // Интервал живёт в useGlobalTimer() на уровне App/GameRoot.
  // Здесь мы только объявляем фазу и читаем timeRemaining.
  const globalTimer = useGameStore(s => s.globalTimer);
  const globalYear = useGameStore(s => s.game.currentYear);

  const [selectedCard, setSelectedCard] = useState(null);
  const [cancelPickMode, setCancelPickMode] = useState(false);
  const [cancelSource, setCancelSource] = useState(null);

  const ownedLUs = Object.values(gridCells.owned).map(cell => ({
    id: cell.cellRef, cellRef: cell.cellRef,
    name: cell.name || `Участок ${cell.cellRef}`,
  }));

  const [activeLUId, setActiveLUId] = useState(() => ownedLUs[0]?.cellRef || null);
  const activeLU = ownedLUs.find(l => l.cellRef === activeLUId) || ownedLUs[0] || null;

  // Объявляем фазу при монтировании → таймер сбросится на yearDurations[year]
  useEffect(() => {
    setGlobalPhase('EVENTS');
    // Нет setInterval — тик идёт из useGlobalTimer() на уровне App
  }, []);

  // Пауза при открытом модальном окне
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
  };

  const handleAnswerQuestion = (answerIndex) => {
    if (!selectedCard || selectedCard.card.type !== CARD_TYPES.OPPORTUNITY) return;
    const { cardKey, card, luId } = selectedCard;
    const isCorrect = answerIndex === card.data.correctAnswer;
    const pts = isCorrect ? card.data.points : 0;
    revealEventCard(luId, cardKey, { revealed: true, correct: isCorrect, points: pts });
    updateEventLineScore(luId, pts);
    setSelectedCard(null);
  };

  const handlePlayRandom = (play) => {
    if (!selectedCard || selectedCard.card.type !== CARD_TYPES.RANDOM) return;
    const { cardKey, card, luId } = selectedCard;
    const effect = card.data.effect
      || (typeof card.data.points === 'number' ? { type: 'points', value: card.data.points } : { type: 'points', value: 0 });

    if (!play) {
      revealEventCard(luId, cardKey, { revealed: true, played: false, points: 0 });
      setSelectedCard(null);
      return;
    }
    if (effect.type === 'cancel') {
      revealEventCard(luId, cardKey, { revealed: true, played: true, points: 0 });
      setSelectedCard(null);
      setCancelSource({ cardKey, luId });
      setCancelPickMode(true);
      return;
    }
    if (effect.type === 'points') {
      revealEventCard(luId, cardKey, { revealed: true, played: true, points: effect.value });
      updateEventLineScore(luId, effect.value);
    }
    if (effect.type === 'money') {
      revealEventCard(luId, cardKey, { revealed: true, played: true, money: effect.value });
      useGameStore.setState(st => ({ player: { ...st.player, budget: st.player.budget + effect.value } }));
      updateEventMoneySpent(effect.value); // записывает в счётчик только отрицательные суммы
    }
    setSelectedCard(null);
  };

  const handleCancelRisk = (lineIndex, cardIndex, card) => {
    if (!cancelSource) return;
    const luId = cancelSource.luId;
    const cardKey = `${lineIndex}-${cardIndex}`;
    const effect = card.data.effect;
    if (effect?.type === 'points' && effect.value < 0) {
      updateEventLineScore(luId, -effect.value);
      useGameStore.setState(st => ({
        events: {
          ...st.events,
          revealedCards: { ...st.events.revealedCards, [luId]: { ...(st.events.revealedCards[luId] || {}), [cardKey]: { revealed: true, cancelled: true, points: 0 } } },
        },
      }));
    } else if (effect?.type === 'money' && effect.value < 0) {
      useGameStore.setState(st => ({
        player: { ...st.player, budget: st.player.budget - effect.value },
        events: {
          ...st.events,
          revealedCards: { ...st.events.revealedCards, [luId]: { ...(st.events.revealedCards[luId] || {}), [cardKey]: { revealed: true, cancelled: true, money: 0 } } },
        },
      }));
    }
    setCancelPickMode(false);
    setCancelSource(null);
  };

  const handleSkipLine = (lineIndex) => {
    const line = playableLines[lineIndex];
    if (!line) return;
    if (window.confirm(`Пропустить линию для ЛУ "${line.luName}"?`)) {
      skipEventLine(line.luId);
      line.cards.forEach((_, ci) => {
        const key = `${lineIndex}-${ci}`;
        const rev = events.revealedCards[line.luId] || {};
        if (!rev[key]) revealEventCard(line.luId, key, { revealed: true, skipped: true, points: 0 });
      });
    }
  };

  const handleComplete = () => { completeEvents(); onComplete(); };

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
                <span style={{ fontSize: '2rem' }}>❓</span>
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

  const totalSpent = Object.values(research.progressByLU).reduce((s, p) => s + (p.totalSpent || 0), 0);

  return (
    <div className={styles.eventsZone}>
      {/* <EventsZoneTour globalYear={globalYear} onDone={() => { }} /> */}
      {/* ── ГЛОБАЛЬНЫЙ ТАЙМЕР (только чтение из store) ─────────────────── */}
      <div className={styles.timer}>
        <div className={styles.timerLabel}>Время на события</div>
        <div className={styles.timerValue}>{formatTime(globalTimer.timeRemaining)}</div>
        <div className={styles.timerSubtitle}>Год {globalTimer.currentYear}</div>
      </div>

      <div className={styles.researchMapControls}>
        <button className={`${styles.researchControlBtn} ${styles.researchBackBtn}`} onClick={onBack}>← Назад</button>
        <button className={`${styles.researchControlBtn} ${styles.researchBackBtn}`} onClick={onMenu}>В меню</button>
        <button className={`${styles.researchControlBtn} ${styles.researchNextBtn}`} onClick={handleComplete} disabled={!canCompleteStage()}>
          Далее — К полевым работам
        </button>
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
          eventSpent={events.totalMoneySpent || 0}
          theme="light"
        />
      </div>

      {/* {cancelPickMode && (
        <div className={styles.cancelBanner}>
          <span>🎯 Выберите карточку риска, которую хотите отменить</span>
          <button className={styles.cancelBannerAbort} onClick={() => { setCancelPickMode(false); setCancelSource(null); }}>
            Отказаться
          </button>
        </div>
      )} */}

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
            {selectedCard.card.type === CARD_TYPES.OPPORTUNITY && (
              <div className={styles.opportunityModal}>
                <h3>❓ Карточка возможности</h3>
                <div className={styles.mustAnswerHint}>Необходимо выбрать ответ, чтобы продолжить</div>
                <div className={styles.cardContent}>
                  {selectedCard.card.data.image && (
                    <div className={styles.modalImageWrap}>
                      <CardImage src={selectedCard.card.data.image} alt="Иллюстрация" className={styles.modalImage} />
                    </div>
                  )}
                  <p className={styles.question}>{selectedCard.card.data.question}</p>
                  <div className={styles.options}>
                    {selectedCard.card.data.options.map((opt, i) => (
                      <button key={i} className={styles.optionBtn} onClick={() => handleAnswerQuestion(i)}>{opt}</button>
                    ))}
                  </div>
                  <p className={styles.pointsInfo}>За правильный ответ: +{selectedCard.card.data.points}</p>
                </div>
              </div>
            )}
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
                      <button className={styles.playBtn} onClick={() => handlePlayRandom(true)}>Сыграть карточку</button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsZone;