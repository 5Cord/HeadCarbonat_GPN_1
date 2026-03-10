import React, { useState, useEffect } from 'react';
import { generateEventLine, CARD_TYPES } from './Eventsdata.js';
import useGameStore from '../../store/gameStore';
import styles from './EventsZone.module.css';

const formatTime = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

// ─── Картинка карточки с fallback ───────────────────────────────────────────
const CardImage = ({ src, alt = '', className = '' }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={`${styles.cardImage} ${className}`}
      onError={() => setFailed(true)}
    />
  );
};

const EventsZone = ({ onComplete }) => {
  const {
    gridCells,
    research,
    events,
    saveEventLine,
    revealEventCard,
    updateEventLineScore,
    skipEventLine,
    completeEvents,
    globalTimer,
    tickGlobalTimer,
    pauseGlobalTimer,
    resumeGlobalTimer,
    setGlobalPhase,
  } = useGameStore();

  const globalYear = useGameStore((s) => s.game.currentYear);
  const [selectedCard, setSelectedCard] = useState(null);

  const ownedLUs = Object.values(gridCells.owned).map(cell => ({
    id: cell.cellRef,
    cellRef: cell.cellRef,
    name: cell.name || `Участок ${cell.cellRef}`,
  }));

  const [activeLUId, setActiveLUId] = useState(() => ownedLUs[0]?.cellRef || null);
  const activeLU = ownedLUs.find(l => l.cellRef === activeLUId) || ownedLUs[0] || null;

  useEffect(() => {
    setGlobalPhase('EVENTS');
    const interval = setInterval(() => tickGlobalTimer(), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedCard) pauseGlobalTimer();
    else resumeGlobalTimer();
  }, [selectedCard]);

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
        if (rates.length > 0) {
          avgSuccess = rates.reduce((sum, r) => sum + r, 0) / rates.length;
        }

        const lineData = {
          luId: lu.id,
          luName: lu.name,
          year: globalYear,
          cards: generateEventLine(avgSuccess),
          successRate: Math.round(avgSuccess),
          generatedAt: Date.now(),
          hasResearch: true,
        };

        const riskCards = lineData.cards.filter(c => c.type === CARD_TYPES.RISK);
        const totalRiskPoints = riskCards.reduce((sum, c) => sum + c.data.points, 0);

        if (totalRiskPoints !== 0) {
          useGameStore.setState(state => ({
            events: {
              ...state.events,
              lineScores: { ...state.events.lineScores, [lu.id]: totalRiskPoints },
            },
          }));
        }

        saveEventLine(lu.id, lineData);
      } else {
        const lineData = {
          luId: lu.id, luName: lu.name, year: globalYear,
          cards: [], successRate: 0, generatedAt: Date.now(), hasResearch: false,
        };
        saveEventLine(lu.id, lineData);
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

  const activeLine = activeLU
    ? playableLines.find(l => l.luId === activeLU.cellRef) || null
    : null;
  const activeLineIndex = activeLine
    ? playableLines.findIndex(l => l.luId === activeLine.luId)
    : -1;

  const isLineComplete = (lineIndex) => {
    const line = playableLines[lineIndex];
    if (!line) return true;
    const luId = line.luId;
    const skipped = events.skippedLines[luId] || [];
    if (skipped.length > 0) return true;
    const revealedCards = events.revealedCards[luId] || {};
    return line.cards.every((card, cardIndex) => {
      const cardKey = `${lineIndex}-${cardIndex}`;
      if (card.type === CARD_TYPES.RISK) return true;
      if (card.type === CARD_TYPES.RANDOM) return true;
      return revealedCards[cardKey]?.revealed;
    });
  };

  const isLineSkipped = (lineIndex) => {
    const line = playableLines[lineIndex];
    if (!line) return false;
    return (events.skippedLines[line.luId] || []).length > 0;
  };

  const getLineScore = (lineIndex) => {
    const line = playableLines[lineIndex];
    if (!line) return 0;
    return events.lineScores[line.luId] || 0;
  };

  const getLUStatus = (luId) => {
    const line = eventLines.find(l => l.luId === luId);
    if (!line?.hasResearch) return 'noResearch';
    const lineIndex = playableLines.findIndex(l => l.luId === luId);
    if (lineIndex === -1) return 'noResearch';
    if (isLineSkipped(lineIndex)) return 'skipped';
    if (isLineComplete(lineIndex)) return 'done';
    return 'ready';
  };

  const canCompleteStage = () => {
    if (playableLines.length > 0) return playableLines.every((_, i) => isLineComplete(i));
    return nonResearchLines.length > 0 || eventLines.length === 0;
  };

  const totalScore = Object.values(events.lineScores || {}).reduce((sum, s) => sum + s, 0);

  const handleSkipLine = (lineIndex) => {
    const line = playableLines[lineIndex];
    if (!line) return;
    if (window.confirm(`Пропустить линию для ЛУ "${line.luName}"?`)) {
      skipEventLine(line.luId);
      line.cards.forEach((_, cardIndex) => {
        const cardKey = `${lineIndex}-${cardIndex}`;
        const currentRevealed = events.revealedCards[line.luId] || {};
        if (!currentRevealed[cardKey]) {
          revealEventCard(line.luId, cardKey, { revealed: true, skipped: true, points: 0 });
        }
      });
    }
  };

  const handleSkipAllLines = () => {
    if (playableLines.length === 0) return;
    if (window.confirm('Пропустить все линии?')) {
      playableLines.forEach((line, lineIndex) => {
        skipEventLine(line.luId);
        line.cards.forEach((_, cardIndex) => {
          const cardKey = `${lineIndex}-${cardIndex}`;
          const currentRevealed = events.revealedCards[line.luId] || {};
          if (!currentRevealed[cardKey]) {
            revealEventCard(line.luId, cardKey, { revealed: true, skipped: true, points: 0 });
          }
        });
      });
    }
  };

  const handleCardClick = (lineIndex, cardIndex, card) => {
    const line = playableLines[lineIndex];
    if (!line) return;
    if (card.type === CARD_TYPES.RISK) return;
    const cardKey = `${lineIndex}-${cardIndex}`;
    const luId = line.luId;
    const currentRevealed = events.revealedCards[luId] || {};
    if (currentRevealed[cardKey]?.revealed) return;
    const skipped = events.skippedLines[luId] || [];
    if (skipped.length > 0) return;
    setSelectedCard({ lineIndex, cardIndex, card, cardKey, luId });
  };

  const handleAnswerQuestion = (answerIndex) => {
    if (!selectedCard || selectedCard.card.type !== CARD_TYPES.OPPORTUNITY) return;
    const { cardKey, card, luId } = selectedCard;
    const isCorrect = answerIndex === card.data.correctAnswer;
    const points = isCorrect ? card.data.points : 0;
    revealEventCard(luId, cardKey, { revealed: true, correct: isCorrect, points });
    updateEventLineScore(luId, points);
    setSelectedCard(null);
  };

  const handlePlayRandom = (play) => {
    if (!selectedCard || selectedCard.card.type !== CARD_TYPES.RANDOM) return;
    const { cardKey, card, luId } = selectedCard;
    const points = play ? card.data.points : 0;
    revealEventCard(luId, cardKey, { revealed: true, played: play, points });
    if (play) updateEventLineScore(luId, points);
    setSelectedCard(null);
  };

  const handleComplete = () => {
    completeEvents();
    onComplete();
  };

  const renderCard = (card, cardIndex, lineIndex, line) => {
    const luId = line.luId;
    const cardKey = `${lineIndex}-${cardIndex}`;
    const revealedCardsForLU = events.revealedCards[luId] || {};
    const revealed = revealedCardsForLU[cardKey];
    const lineSkipped = isLineSkipped(lineIndex);

    // ── РИСК: картинка-фон, очки поверх в круге, название + описание внизу ──
    if (card.type === CARD_TYPES.RISK) {
      const parts = card.data.description.split(':');
      const title = parts[0].trim();
      const desc  = parts.slice(1).join(':').trim();
      return (
        <div key={cardIndex} className={styles.riskCard}>
          <CardImage src={card.data.image} alt="Риск" className={styles.riskBgImage} />
          <div className={styles.riskBadge}>{card.data.points}</div>
          <div className={styles.riskFooter}>
            <div className={styles.riskTitle}>{title}</div>
            {desc && <div className={styles.riskDesc}>{desc}</div>}
          </div>
        </div>
      );
    }

    // ── ВОЗМОЖНОСТЬ: превью без картинки, картинка только в модале ────────────
    if (card.type === CARD_TYPES.OPPORTUNITY) {
      return (
        <div
          key={cardIndex}
          className={`${styles.eventCard} ${styles.opportunity} ${revealed?.revealed ? `${styles.revealed} ${styles.answered}` : ''}`}
          onClick={() => !revealed?.revealed && !lineSkipped && handleCardClick(lineIndex, cardIndex, card)}
          style={{ cursor: revealed?.revealed || lineSkipped ? 'default' : 'pointer' }}
        >
          <div className={styles.cardFront}>
            {revealed?.revealed ? (
              <div className={styles.opportunityResult}>
                <span>{revealed.correct ? '✅' : '❌'}</span>
                <span className={styles.points}>{revealed.points > 0 ? `+${revealed.points}` : '0'}</span>
              </div>
            ) : (
              <div className={styles.opportunityPreview}>
                <span style={{ fontSize: '2rem' }}>❓</span>
                <span className={styles.points} style={{ color: '#2e7d32', fontSize: '1.5rem' }}>
                  +{card.data.points}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#666', marginTop: '5px' }}>Нажмите</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // ── СЛУЧАЙНОСТЬ: картинка на карточке после раскрытия + в модале ──────────
    return (
      <div
        key={cardIndex}
        className={`${styles.eventCard} ${styles.random} ${revealed?.revealed ? styles.revealed : ''} ${styles.optionalCard}`}
        onClick={() => !revealed?.revealed && !lineSkipped && handleCardClick(lineIndex, cardIndex, card)}
        style={{ cursor: revealed?.revealed || lineSkipped ? 'default' : 'pointer' }}
      >
        {!revealed?.revealed ? (
          <div className={styles.cardBack}>
            <span className={styles.cardTypeIcon}>🎲</span>
            <span className={styles.cardPosition}>{cardIndex + 1}</span>
            <span className={styles.optionalBadge}>необяз.</span>
          </div>
        ) : (
          <div className={styles.cardFront}>
            {/* картинка на самой карточке после раскрытия */}
            <CardImage src={card.data.image} alt="Случайность" className={styles.randomCardImage} />
            <div className={styles.randomResult}>
              {revealed.played ? (
                <>
                  <span className={styles.playedBadge}>Сыграна</span>
                  <span className={styles.points}>
                    {card.data.points > 0 ? `+${card.data.points}` : card.data.points}
                  </span>
                </>
              ) : (
                <span className={styles.skippedBadge}>
                  Пропущена
                  <span className={styles.pointsSmall}> ({card.data.points})</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.eventsZone}>

      <div className={styles.timer}>
        <div className={styles.timerLabel}>Время на события</div>
        <div className={styles.timerValue}>{formatTime(globalTimer.timeRemaining)}</div>
        <div className={styles.timerSubtitle}>Год {globalTimer.currentYear}</div>
      </div>

      <div className={styles.researchMapControls}>
        <button className={`${styles.researchControlBtn} ${styles.researchBackBtn}`} onClick={onComplete}>
          Назад
        </button>
        <button
          className={`${styles.researchControlBtn} ${styles.researchNextBtn}`}
          onClick={handleComplete}
          disabled={!canCompleteStage()}
        >
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
                  {hasRes && line?.successRate != null && (
                    <span className={styles.metaMob}>Успех {line.successRate}%</span>
                  )}
                  {score !== 0 && (
                    <span className={[styles.metaScore, score >= 0 ? styles.metaPos : styles.metaNeg].join(' ')}>
                      {score >= 0 ? '+' : ''}{score}
                    </span>
                  )}
                </div>
                <div className={styles.luCardStatus}>
                  {status === 'done'       ? 'Пройдено'
                    : status === 'skipped' ? 'Пропущено'
                    : status === 'noResearch' ? 'Нет НИР'
                    : 'В процессе'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.activeLineArea}>
        {!activeLU ? (
          <div className={styles.emptyMsg}>Нет купленных участков</div>
        ) : !activeLine ? (
          <div className={styles.emptyMsg}>
            Для участка <strong>{activeLU.cellRef}</strong> не проводились НИРы в этом году.
            Вернитесь в раздел «Научные исследования».
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
                {isLineSkipped(activeLineIndex) && (
                  <span className={`${styles.lineStatus} ${styles.skipped}`}>⏭️ Пропущено</span>
                )}
                {isLineComplete(activeLineIndex) && !isLineSkipped(activeLineIndex) && (
                  <span className={styles.lineStatus}>
                    {getLineScore(activeLineIndex) >= 0 ? 'Пройдено ✅' : 'Провалено ❌'}
                  </span>
                )}
                {!isLineComplete(activeLineIndex) && !isLineSkipped(activeLineIndex) && (
                  <button className={styles.skipLineBtn} onClick={() => handleSkipLine(activeLineIndex)}>
                    Пропустить
                  </button>
                )}
              </div>
            </div>

            <div className={styles.cardsRow}>
              {activeLine.cards.map((card, cardIndex) =>
                renderCard(card, cardIndex, activeLineIndex, activeLine)
              )}
            </div>

            {activeLine.cards.some(c => c.type === CARD_TYPES.RANDOM) && (
              <div className={styles.randomHint}>
                Крайняя правая карточка («карточка случайности») необязательна
              </div>
            )}
          </div>
        )}

        {nonResearchLines.length > 0 && (
          <div className={styles.noResearchSection}>
            <p className={styles.noResearchLabel}>Участки без НИРов в этом году:</p>
            <div className={styles.noResearchList}>
              {nonResearchLines.map(line => (
                <span key={line.luId} className={styles.noResearchItem}>{line.luName}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          МОДАЛЫ
      ═══════════════════════════════════════════════════════ */}
      {selectedCard && (
        <div className={styles.cardModalOverlay}>
          <div className={styles.cardModal} onClick={e => e.stopPropagation()}>

            {/* ── ВОЗМОЖНОСТЬ ───────────────────────────────── */}
            {selectedCard.card.type === CARD_TYPES.OPPORTUNITY && (
              <div className={styles.opportunityModal}>
                <h3>❓ Карточка возможности</h3>
                <div className={styles.mustAnswerHint}>
                  Необходимо выбрать ответ, чтобы продолжить
                </div>
                <div className={styles.cardContent}>
                  {/* картинка в модале (для карточек с иллюстрацией) */}
                  {selectedCard.card.data.image && (
                    <div className={styles.modalImageWrap}>
                      <CardImage
                        src={selectedCard.card.data.image}
                        alt="Иллюстрация к вопросу"
                        className={styles.modalImage}
                      />
                    </div>
                  )}
                  <p className={styles.question}>{selectedCard.card.data.question}</p>
                  <div className={styles.options}>
                    {selectedCard.card.data.options.map((option, index) => (
                      <button
                        key={index}
                        className={styles.optionBtn}
                        onClick={() => handleAnswerQuestion(index)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <p className={styles.pointsInfo}>За правильный ответ: +{selectedCard.card.data.points}</p>
                </div>
              </div>
            )}

            {/* ── СЛУЧАЙНОСТЬ ───────────────────────────────── */}
            {selectedCard.card.type === CARD_TYPES.RANDOM && (
              <div className={styles.randomModal}>
                <h3>🎲 Карточка случайности</h3>
                <div className={styles.mustAnswerHint}>
                  Выберите действие, чтобы продолжить
                </div>
                <div className={styles.cardContent}>
                  {/* картинка в модале */}
                  {selectedCard.card.data.image && (
                    <div className={styles.modalImageWrap}>
                      <CardImage
                        src={selectedCard.card.data.image}
                        alt="Карточка случайности"
                        className={styles.modalImage}
                      />
                    </div>
                  )}
                  <p className={styles.description}>{selectedCard.card.data.description}</p>
                  <p className={styles.hiddenPoints}>Инфа про +/- или отмену</p>
                  <div className={styles.randomActions}>
                    <button className={styles.playBtn} onClick={() => handlePlayRandom(true)}>
                      Сыграть карточку
                    </button>
                    <button className={styles.skipBtn} onClick={() => handlePlayRandom(false)}>
                      Узнать результат (не играть)
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default EventsZone;