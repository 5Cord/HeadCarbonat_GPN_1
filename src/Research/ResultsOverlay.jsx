// ResultsOverlay.jsx
import React, { useState, useEffect, useRef } from 'react';
import useGameStore from '../../store/gameStore'; // Добавляем импорт
import styles from './ResearchPanel.module.css';

const RESULTS_DURATION = 2 * 60;

const formatTime = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const ResultsOverlay = ({ 
  globalYear, 
  research, 
  events, 
  fieldWork, 
  gridCells, 
  player,
  onNextYear,
  onBack 
}) => {
  // Получаем методы из store
  const { advanceToNextYear, resetEventCardsForNewYear } = useGameStore();
  
  const [timeRemaining, setTimeRemaining] = useState(RESULTS_DURATION);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const timerRef = useRef(null);

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
      onNextYear(); // Передаём управление родителю для финального модала
    } else {
      handleNextYear();
    }
  };

  const handleNextYear = () => {
    setShowConfirmModal(true);
  };

  const confirmNextYear = () => {
    setShowConfirmModal(false);
    
    // Используем методы из store
    advanceToNextYear();
    const nextYear = globalYear + 1;
    resetEventCardsForNewYear(nextYear);
    
    // Вызываем колбэк родителя
    onNextYear();
  };

  const getTimerClass = () => {
    if (timeRemaining <= 10) return `${styles.timer} ${styles.timerCritical}`;
    if (timeRemaining <= 30) return `${styles.timer} ${styles.timerWarning}`;
    if (timeRemaining <= 60) return `${styles.timer} ${styles.timerAlert}`;
    return styles.timer;
  };

  // ... остальной код (подсчёт статистики) ...

  return (
    <div className={styles.resultsOverlay}>
      
      <div className={getTimerClass()}>
        <div className={styles.timerLabel}>Результаты года {globalYear}</div>
        <div className={styles.timerValue}>{formatTime(timeRemaining)}</div>
        <div className={styles.timerSubtitle}>
          {globalYear >= 10 
            ? 'Игра завершена' 
            : `Автоматический переход на год ${globalYear + 1}`}
        </div>
      </div>

      <div className={styles.resultsTopbar}>
        <button className={styles.resultsBackBtn} onClick={onBack}>← Назад к исследованиям</button>
      </div>

      <div className={styles.resultsMainContent}>
        <div className={styles.resultsHeader}>
          <h1>Итоги {globalYear} года</h1>
          <p className={styles.resultsSubtitle}>Результаты вашей деятельности</p>
        </div>

        {/* ... остальной JSX ... */}

        <div className={styles.resultsActions}>
          {globalYear < 10 ? (
            <button 
              className={`${styles.researchControlBtn} ${styles.researchNextBtn}`}
              onClick={handleNextYear}
            >
              Перейти на {globalYear + 1} год
            </button>
          ) : (
            <button 
              className={`${styles.researchControlBtn} ${styles.researchNextBtn}`}
              onClick={onNextYear}
            >
              Завершить игру
            </button>
          )}
          
          <button 
            className={`${styles.researchControlBtn} ${styles.researchBackBtn}`}
            onClick={onBack}
          >
            Вернуться к исследованиям
          </button>
        </div>
      </div>

      {/* Модал подтверждения */}
      {showConfirmModal && (
        <div className={styles.cellModalOverlay} onClick={() => setShowConfirmModal(false)}>
          <div className={styles.cellModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => setShowConfirmModal(false)}>X</button>
            <h3>Переход на следующий год</h3>
            <div className={styles.modalInfo}>
              <p style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '1.1rem', color: 'black' }}>
                Вы уверены, что хотите перейти на {globalYear + 1} год?
              </p>
              <p style={{ textAlign: 'center', color: '#d32f2f', fontWeight: 600 }}>
                Данные текущего года будут сохранены, но новый год начнётся с нуля.
              </p>
              {timeRemaining > 0 && (
                <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.95rem', color: '#666' }}>
                  Осталось времени: {formatTime(timeRemaining)}
                </p>
              )}
            </div>
            <div className={styles.modalActions}>
              <button 
                className={styles.purchaseModalBtn}
                onClick={confirmNextYear}
              >
                Да, перейти
              </button>
              <button 
                className={styles.cancelModalBtn}
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

export default ResultsOverlay;