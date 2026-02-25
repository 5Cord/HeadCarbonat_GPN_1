import React, { useState, useEffect } from 'react';
import { generateEventLine, CARD_TYPES } from './Eventsdata.js';
import useGameStore from '../../store/gameStore';
import styles from './EventsZone.module.css'; 

const EventsZone = ({ onComplete }) => {
  const {
    licenseUnits,
    research,
    events,
    saveEventLine,
    revealEventCard,
    updateEventLineScore,
    skipEventLine,
    completeEvents,
  } = useGameStore();

  const [selectedCard, setSelectedCard] = useState(null);

  const hasResearchForLU = (luId) => {
    const luResearch = research.progressByLU[luId];
    return luResearch && luResearch.purchasedWorks && luResearch.purchasedWorks.length > 0;
  };

  useEffect(() => {
    licenseUnits.owned.forEach((lu) => {
      const hasResearch = hasResearchForLU(lu.id);
      const existingLine = events.linesByLU[lu.id];


      if (hasResearch && (!existingLine || !existingLine.hasResearch)) {
        const luResearch = research.progressByLU[lu.id];
        let avgSuccess = 0;

        if (luResearch && luResearch.successRates) {
          const rates = Object.values(luResearch.successRates);
          if (rates.length > 0) {
            avgSuccess = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
          }
        }

        const lineData = {
          luId: lu.id,
          luName: lu.name,
          cards: generateEventLine(avgSuccess),
          successRate: Math.round(avgSuccess),
          generatedAt: Date.now(),
          hasResearch: true
        };


        const riskCards = lineData.cards.filter(c => c.type === CARD_TYPES.RISK);
        const totalRiskPoints = riskCards.reduce((sum, c) => sum + c.data.points, 0);

        if (totalRiskPoints !== 0) {
          useGameStore.setState(state => ({
            events: {
              ...state.events,
              lineScores: {
                ...state.events.lineScores,
                [lu.id]: totalRiskPoints
              }
            }
          }));
        }

        saveEventLine(lu.id, lineData);
        console.log(`[EventsZone] Сгенерирована новая линия для ${lu.name} с успешностью ${avgSuccess}%`);
      }

      if (!hasResearch && !existingLine) {
        const lineData = {
          luId: lu.id,
          luName: lu.name,
          cards: [],
          successRate: 0,
          generatedAt: Date.now(),
          hasResearch: false
        };

        saveEventLine(lu.id, lineData);
      }
    });
  }, [licenseUnits.owned, research.progressByLU, events.linesByLU]);

  const eventLines = licenseUnits.owned.map(lu => {
    const lineData = events.linesByLU[lu.id] || {
      luId: lu.id,
      luName: lu.name,
      cards: [],
      successRate: 0,
      hasResearch: hasResearchForLU(lu.id)
    };

    return {
      ...lineData,
      lineIndex: licenseUnits.owned.findIndex(l => l.id === lu.id)
    };
  });

  const playableLines = eventLines.filter(line => line.hasResearch);
  const nonResearchLines = eventLines.filter(line => !line.hasResearch);

  const handleSkipLine = (lineIndex) => {
    const line = playableLines[lineIndex];
    if (!line) return;

    if (window.confirm(`Пропустить линию для ЛУ "${line.luName}"?`)) {
      skipEventLine(line.luId);

      line.cards.forEach((_, cardIndex) => {
        const cardKey = `${lineIndex}-${cardIndex}`;
        const currentRevealed = events.revealedCards[line.luId] || {};

        if (!currentRevealed[cardKey]) {
          revealEventCard(line.luId, cardKey, {
            revealed: true,
            skipped: true,
            points: 0
          });
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
            revealEventCard(line.luId, cardKey, {
              revealed: true,
              skipped: true,
              points: 0
            });
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

    revealEventCard(luId, cardKey, {
      revealed: true,
      correct: isCorrect,
      points: points
    });

    updateEventLineScore(luId, points);
    setSelectedCard(null);
  };

  const handlePlayRandom = (play) => {
    if (!selectedCard || selectedCard.card.type !== CARD_TYPES.RANDOM) return;

    const { cardKey, card, luId } = selectedCard;
    const points = play ? card.data.points : 0;

    revealEventCard(luId, cardKey, {
      revealed: true,
      played: play,
      points: points
    });

    if (play) {
      updateEventLineScore(luId, points);
    }

    setSelectedCard(null);
  };

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

      return revealedCards[cardKey]?.revealed;
    });
  };

  const isLineSkipped = (lineIndex) => {
    const line = playableLines[lineIndex];
    if (!line) return false;

    const skipped = events.skippedLines[line.luId] || [];
    return skipped.length > 0;
  };

  const getLineScore = (lineIndex) => {
    const line = playableLines[lineIndex];
    if (!line) return 0;

    return events.lineScores[line.luId] || 0;
  };

  const canCompleteStage = () => {
    if (playableLines.length > 0) {
      return playableLines.every((_, i) => isLineComplete(i));
    }
    return nonResearchLines.length > 0 || eventLines.length === 0;
  };

  const totalScore = Object.values(events.lineScores || {}).reduce((sum, score) => sum + score, 0);

  const handleComplete = () => {
    completeEvents();
    onComplete();
  };

  return (
    <div className={styles.eventsZone}>
      <div className={styles.mapControls}>
        <button className={styles.controlBtn} onClick={onComplete}>← Назад</button>
        <button
          className={styles.controlBtn}
          onClick={handleComplete}
          disabled={!canCompleteStage()}
        >
          Далее → К полевым работам
        </button>
      </div>

      <div className={styles.eventsHeader}>
        <h2>Зона событий</h2>
        <p className={styles.eventsSubtitle}>
          Карточки рисков открыты сразу. Отвечайте на вопросы возможностей. Решайте — играть случайность или узнать результат!
        </p>
      </div>

      <div className={styles.eventsControls}>

        <div className={styles.globalControls}>
          <button
            className={styles.skipAllBtn}
            onClick={handleSkipAllLines}
            disabled={playableLines.length === 0 || playableLines.every((_, i) => isLineComplete(i))}
          >
            Пропустить все линии
          </button>
          <div className={styles.totalScore}>
            Общий счет: <span className={`${styles.scoreValue} ${totalScore >= 0 ? styles.positive : styles.negative}`}>
              {totalScore >= 0 ? '+' : ''}{totalScore}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.researchStatusSummary}>
        <h4>Исследования по ЛУ:</h4>
        {licenseUnits.owned.map(lu => {
          const luResearch = research.progressByLU[lu.id];
          const successRates = luResearch?.successRates || {};
          const totalSuccess = Object.values(successRates).reduce((sum, rate) => sum + rate, 0);
          const avgSuccess = Object.keys(successRates).length > 0 ? totalSuccess / Object.keys(successRates).length : 0;

          return (
            <div key={lu.id} className={styles.luResearchStatus}>
              <span className={styles.luName}>{lu.name}:</span>
              <span className={styles.luSuccess}>
                {Object.keys(successRates).length > 0
                  ? `Успешность: ${Math.round(avgSuccess)}%`
                  : 'Исследования не проводились'}
              </span>
            </div>
          );
        })}
      </div>

      {nonResearchLines.length > 0 && (
        <div className={styles.noResearchSection}>
          <h3>ЛУ без НИР (недоступны для событий)</h3>
          <div className={styles.noResearchList}>
            {nonResearchLines.map(line => (
              <div key={line.luId} className={styles.noResearchItem}>
                <span className={styles.luName}>{line.luName}</span>
                <span className={styles.message}>
                  Для этого ЛУ не проводились НИР. Вернитесь к научным исследовательским работам!
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {playableLines.length > 0 && (
        <div className={styles.eventLines}>
          {playableLines.map((line, lineIndex) => {
            const luId = line.luId;
            const lineSkipped = isLineSkipped(lineIndex);
            const lineComplete = isLineComplete(lineIndex);
            const lineScore = getLineScore(lineIndex);
            const revealedCardsForLU = events.revealedCards[luId] || {};

            const isNewLine = line.generatedAt && (Date.now() - line.generatedAt < 5000);

            return (
              <div key={line.luId} className={`${styles.eventLine} ${isNewLine ? styles.newLine : ''}`}>
                <div className={styles.lineHeader}>
                  <h3>{line.luName}</h3>
                  <div className={styles.lineStats}>
                    {isNewLine && <span className={styles.newLineBadge}>🆕 НОВАЯ ЛИНИЯ</span>}
                    <span className={styles.successRate}>Успех: {line.successRate}%</span>
                    <span className={`${styles.lineScore} ${lineScore >= 0 ? styles.positive : styles.negative}`}>
                      Счет: {lineScore >= 0 ? '+' : ''}{lineScore}
                    </span>
                    {lineSkipped && <span className={`${styles.lineStatus} ${styles.skipped}`}>⏭️ Пропущено</span>}
                    {lineComplete && !lineSkipped && (
                      <span className={styles.lineStatus}>
                        {lineScore > 0 ? '✅ Пройдено' : '❌ Провалено'}
                      </span>
                    )}
                  </div>

                  {!lineComplete && !lineSkipped && (
                    <button className={styles.skipLineBtn} onClick={() => handleSkipLine(lineIndex)}>
                      Пропустить
                    </button>
                  )}
                </div>

                <div className={styles.cardsRow}>
                  {line.cards.map((card, cardIndex) => {
                    const cardKey = `${lineIndex}-${cardIndex}`;
                    const revealed = revealedCardsForLU[cardKey];
                    if (card.type === CARD_TYPES.RISK) {
                      return (
                        <div key={cardIndex} className={`${styles.eventCard} ${styles.risk} ${styles.revealed}`}>
                          <div className={styles.cardFront}>
                            <div className={styles.riskResult}>
                              <span style={{ fontSize: '2rem' }}>⚠️</span>
                              <span className={styles.points} style={{ color: '#c62828', fontSize: '2rem' }}>
                                {card.data.points}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: '#666' }}>Риск</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (card.type === CARD_TYPES.OPPORTUNITY) {
                      return (
                        <div
                          key={cardIndex}
                          className={`${styles.eventCard} ${styles.opportunity} ${revealed?.revealed ? `${styles.revealed} ${styles.answered}` : styles.revealed}`}
                          onClick={() => !revealed?.revealed && !lineSkipped && handleCardClick(lineIndex, cardIndex, card)}
                          style={{ cursor: revealed?.revealed || lineSkipped ? 'default' : 'pointer' }}
                        >
                          <div className={styles.cardFront}>
                            {revealed?.revealed ? (
                              <div className={styles.opportunityResult}>
                                {revealed.correct ? '✅' : '❌'}
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

                    return (
                      <div
                        key={cardIndex}
                        className={`${styles.eventCard} ${styles.random} ${revealed?.revealed ? styles.revealed : ''}`}
                        onClick={() => !revealed?.revealed && !lineSkipped && handleCardClick(lineIndex, cardIndex, card)}
                        style={{ cursor: revealed?.revealed || lineSkipped ? 'default' : 'pointer' }}
                      >
                        {!revealed?.revealed ? (
                          <div className={styles.cardBack}>
                            <span className={styles.cardTypeIcon}>🎲</span>
                            <span className={styles.cardPosition}>{cardIndex + 1}</span>
                          </div>
                        ) : (
                          <div className={styles.cardFront}>
                            <div className={styles.randomResult}>
                              {revealed.played ? (
                                <>
                                  <span className={styles.playedBadge}>Сыграна</span>
                                  <span className={styles.points}>{card.data.points > 0 ? `+${card.data.points}` : card.data.points}</span>
                                </>
                              ) : (
                                <span className={styles.skippedBadge}>Пропущена</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {eventLines.length === 0 && (
        <div className={styles.noLuMessage}>
          <p>Нет выбранных ЛУ</p>
        </div>
      )}

      {eventLines.length > 0 && playableLines.length === 0 && (
        <div className={styles.noResearchMessage}>
          <p>Все ЛУ без НИР</p>
        </div>
      )}

      {/* Модальное окно */}
      {selectedCard && (
        <div className={styles.cardModalOverlay} onClick={() => setSelectedCard(null)}>
          <div className={styles.cardModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeModalBtn} onClick={() => setSelectedCard(null)}>✕</button>

            {selectedCard.card.type === CARD_TYPES.OPPORTUNITY && (
              <div className={styles.opportunityModal}>
                <h3>❓ Карточка возможности</h3>
                <div className={styles.cardContent}>
                  <p className={styles.question}>{selectedCard.card.data.question}</p>
                  <div className={styles.options}>
                    {selectedCard.card.data.options.map((option, index) => (
                      <button key={index} className={styles.optionBtn} onClick={() => handleAnswerQuestion(index)}>
                        {option}
                      </button>
                    ))}
                  </div>
                  <p className={styles.pointsInfo}>За правильный ответ: +{selectedCard.card.data.points}</p>
                </div>
              </div>
            )}

            {selectedCard.card.type === CARD_TYPES.RANDOM && (
              <div className={styles.randomModal}>
                <h3>🎲 Карточка случайности</h3>
                <div className={styles.cardContent}>
                  <p className={styles.description}>{selectedCard.card.data.description}</p>
                  <p className={styles.points}>{selectedCard.card.data.points > 0 ? '+' : ''}{selectedCard.card.data.points} баллов</p>
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

      <div className={styles.eventsActions}>
        <p className={styles.completionHint}>
          {playableLines.length > 0 && canCompleteStage()
            ? 'Все линии завершены!'
            : `Линии: ${playableLines.filter((_, i) => isLineComplete(i)).length}/${playableLines.length}`}
        </p>
      </div>
    </div>
  );
};

export default EventsZone;