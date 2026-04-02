import React from 'react';
import useGameStore from '../store/gameStore';
import styles from './YearSummaryModal.module.css';

const PHASE_LABELS = {
  EVENTS: 'Фаза событий',
  FIELD_WORK: 'Полевые работы',
  RESULTS: 'Итоги фазы',
  REGION_MAP_AUCTION: 'Аукцион карты',
  REGION_MAP_POST_AUCTION: 'После аукциона',
};

const PHASE_TO_FIELD = {
  FIELD_WORK: 3,
  RESULTS:    4,
};

const YearSummaryModal = () => {
  const setYearResultsPending = useGameStore(s => s.setYearResultsPending);
  const setPendingNavigation  = useGameStore(s => s.setPendingNavigation);

  const globalYear = useGameStore(s => s.game.currentYear);
  const phase = useGameStore(s => s.globalTimer.phase);
  const budget = useGameStore(s => s.player.budget);
  const lineScores = useGameStore(s => s.events.lineScores);

  const totalEventScore = Object.values(lineScores || {}).reduce((s, v) => s + (v || 0), 0);
  const phaseLabel = PHASE_LABELS[phase] || phase;

  const fmt = (v) => (v >= 0 ? `+${v}` : `${v}`);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.icon}>⏱️</div>
        <h2 className={styles.title}>Время вышло</h2>
        <div className={styles.phase}>{phaseLabel} · {globalYear} год</div>

        <div className={styles.stats}>
          <div className={styles.statCard}>
            <span className={`${styles.statValue} ${totalEventScore >= 0 ? styles.positive : styles.negative}`}>
              {fmt(totalEventScore)}
            </span>
            <span className={styles.statLabel}>Очки событий</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{budget} млн</span>
            <span className={styles.statLabel}>Бюджет</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{globalYear}</span>
            <span className={styles.statLabel}>Год</span>
          </div>
        </div>

        <button className={styles.continueBtn} onClick={() => {
          const field = PHASE_TO_FIELD[phase];
          if (field != null) setPendingNavigation(field);
          setYearResultsPending(false);
        }}>
          Продолжить
        </button>
      </div>
    </div>
  );
};

export default YearSummaryModal;
