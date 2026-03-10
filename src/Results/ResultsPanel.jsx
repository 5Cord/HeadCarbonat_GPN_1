import React, { useState, useEffect, useRef } from 'react';
import './ResultsPanel.css';
import useGameStore from '../../store/gameStore';

const RESULTS_DURATION = 2 * 60; // 2 минуты на просмотр результатов

const formatTime = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const ResultsPanel = ({ onComplete, onBack }) => {
  const { 
    player, 
    research, 
    events, 
    fieldWork, 
    gridCells,
    globalTimer,
    advanceToNextYear,
    resetEventCardsForNewYear,
  } = useGameStore();
  
  const globalYear = globalTimer.currentYear;
  
  const [timeRemaining, setTimeRemaining] = useState(RESULTS_DURATION);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const timerRef = useRef(null);

  // Таймер
  useEffect(() => {
    if (timeRemaining <= 0) {
      handleAutoTransition();
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoTransition();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeRemaining]);

  const handleAutoTransition = () => {
    if (globalYear >= 10) {
      // Игра завершена
      if (onComplete) onComplete();
    } else {
      // Переход на следующий год
      handleNextYear();
    }
  };

  const handleNextYear = async () => {
    try {
      // TODO: Отправка данных на бэкенд
      // const sessionData = {
      //   sessionId: player.sessionId,
      //   teamId: player.teamId,
      //   year: globalYear,
      //   research: research.progressByLU,
      //   events: {
      //     lineScores: events.lineScores,
      //     revealedCards: events.revealedCards,
      //   },
      //   fieldWork: fieldWork.selectionsByLU,
      //   timestamp: Date.now()
      // };
      // await saveYearResults(sessionData);

      console.log('[ResultsPanel] Переход с года', globalYear, 'на год', globalYear + 1);

      // Сбрасываем карточки EventsZone для нового года
      resetEventCardsForNewYear(globalYear + 1);

      // Увеличиваем год
      advanceToNextYear();

      // Возвращаемся к ResearchPanel
      if (onComplete) onComplete();
      
    } catch (error) {
      console.error('Error transitioning to next year:', error);
      alert('Ошибка при переходе на следующий год. Попробуйте снова.');
    }
  };

  const handleManualNextYear = () => {
    setShowConfirmModal(true);
  };

  const confirmNextYear = () => {
    setShowConfirmModal(false);
    handleNextYear();
  };

  const getTimerClass = () => {
    if (timeRemaining <= 10) return 'results-timer results-timer-critical';
    if (timeRemaining <= 30) return 'results-timer results-timer-warning';
    if (timeRemaining <= 60) return 'results-timer results-timer-alert';
    return 'results-timer';
  };

  // Подсчёт статистики за год
  const getTotalResearchSpent = () => {
    let total = 0;
    Object.values(research.progressByLU || {}).forEach(luData => {
      total += luData.totalSpent || 0;
    });
    return total;
  };

  const getTotalFieldWorkSpent = () => {
    let total = 0;
    Object.values(fieldWork.selectionsByLU || {}).forEach(luData => {
      total += luData.totalCost || 0;
    });
    return total;
  };

  const getEventsScore = () => {
    let total = 0;
    Object.values(events.lineScores || {}).forEach(score => {
      total += score;
    });
    return total;
  };

  const totalResearchSpent = getTotalResearchSpent();
  const totalFieldWorkSpent = getTotalFieldWorkSpent();
  const eventsScore = getEventsScore();
  const ownedLUs = Object.values(gridCells.owned);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      console.warn('onBack callback not provided');
    }
  };

  return (
    <div className="results-panel-fullscreen">
      
      {/* Таймер */}
      <div className={getTimerClass()}>
        <div className="results-timer-label">Результаты года {globalYear}</div>
        <div className="results-timer-value">{formatTime(timeRemaining)}</div>
        <div className="results-timer-subtitle">
          {globalYear >= 10 
            ? 'Игра завершена' 
            : `Автоматический переход на год ${globalYear + 1}`}
        </div>
      </div>

      {/* Кнопка "Назад" */}
      <div className="results-topbar">
        <button className="results-back-btn" onClick={handleBack}>← Назад</button>
      </div>

      {/* Основной контент */}
      <div className="results-main-content">
        <div className="results-header">
          <h1>Итоги {globalYear} года</h1>
          <p className="results-subtitle">Результаты вашей деятельности</p>
        </div>

        {/* Сводка */}
        <div className="results-summary">
          <div className="results-section">
            <h2>Научные исследования</h2>
            <div className="results-stats">
              <div className="stat-item">
                <span className="stat-label">Потрачено на НИРы:</span>
                <span className="stat-value">{totalResearchSpent} млн руб.</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Участков исследовано:</span>
                <span className="stat-value">{Object.keys(research.progressByLU || {}).length}</span>
              </div>
            </div>
          </div>

          <div className="results-section">
            <h2>Зона событий</h2>
            <div className="results-stats">
              <div className="stat-item">
                <span className="stat-label">Карточек открыто:</span>
                <span className="stat-value">
                  {Object.values(events.revealedCards || {}).reduce((sum, luCards) => sum + Object.keys(luCards).length, 0)}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Баллов получено:</span>
                <span className={`stat-value ${eventsScore >= 0 ? 'positive' : 'negative'}`}>
                  {eventsScore >= 0 ? '+' : ''}{eventsScore}
                </span>
              </div>
            </div>
          </div>

          <div className="results-section">
            <h2>Полевые работы</h2>
            <div className="results-stats">
              <div className="stat-item">
                <span className="stat-label">Потрачено на работы:</span>
                <span className="stat-value">{totalFieldWorkSpent} млн руб.</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Участков обработано:</span>
                <span className="stat-value">
                  {Object.keys(fieldWork.selectionsByLU || {}).length}
                </span>
              </div>
            </div>
          </div>

          <div className="results-section results-section-total">
            <h2>Общие показатели</h2>
            <div className="results-stats">
              <div className="stat-item">
                <span className="stat-label">Текущий бюджет:</span>
                <span className="stat-value budget-value">{player.budget} млн руб.</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Потрачено за год:</span>
                <span className="stat-value spent-value">
                  {totalResearchSpent + totalFieldWorkSpent} млн руб.
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Участков в работе:</span>
                <span className="stat-value">{ownedLUs.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Действия */}
        <div className="results-actions">
          {globalYear < 10 ? (
            <button 
              className="results-btn results-btn-primary"
              onClick={handleManualNextYear}
            >
              Перейти на {globalYear + 1} год
            </button>
          ) : (
            <button 
              className="results-btn results-btn-success"
              onClick={onComplete}
            >
              Завершить игру
            </button>
          )}
          
          <button 
            className="results-btn results-btn-secondary"
            onClick={handleBack}
          >
            Назад в меню
          </button>
        </div>
      </div>

      {/* Модал подтверждения */}
      {showConfirmModal && (
        <div className="results-modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="results-modal" onClick={(e) => e.stopPropagation()}>
            <button className="results-modal-close" onClick={() => setShowConfirmModal(false)}>X</button>
            <h3>Переход на следующий год</h3>
            <div className="results-modal-content">
              <p>Вы уверены, что хотите перейти на {globalYear + 1} год?</p>
              <p className="results-modal-warning">
                Данные текущего года будут сохранены.
                <br />
                Карточки EventsZone будут обновлены для нового года.
              </p>
              {timeRemaining > 0 && (
                <p className="results-modal-info">
                  Осталось времени: {formatTime(timeRemaining)}
                </p>
              )}
            </div>
            <div className="results-modal-actions">
              <button 
                className="results-btn results-btn-primary"
                onClick={confirmNextYear}
              >
                Да, перейти
              </button>
              <button 
                className="results-btn results-btn-secondary"
                onClick={() => setShowConfirmModal(false)}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ResultsPanel;