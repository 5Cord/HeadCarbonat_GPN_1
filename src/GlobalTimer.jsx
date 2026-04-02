import React from 'react';
import useGameStore from '../store/gameStore';
import styles from './GlobalTimer.module.css';

const formatTime = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const GlobalTimer = ({
  label = 'Таймер',
  valueOverride,
  subtitleOverride,
  finishedLabel,
  finishedText,
  forceWarning = false,
  forceFinished = false,
}) => {
  const timeRemaining = useGameStore(s => s.globalTimer.timeRemaining);
  const currentYear   = useGameStore(s => s.globalTimer.currentYear);

  const isFinished = (forceFinished || timeRemaining <= 0) && !valueOverride;

  const timerCls = () => {
    if (forceWarning)   return `${styles.timer} ${styles.timerWarning}`;
    if (isFinished)     return `${styles.timer} ${styles.timerFinished}`;
    if (timeRemaining <= 30)  return `${styles.timer} ${styles.timerCritical}`;
    if (timeRemaining <= 120) return `${styles.timer} ${styles.timerWarning}`;
    if (timeRemaining <= 300) return `${styles.timer} ${styles.timerAlert}`;
    return styles.timer;
  };

  if (isFinished && finishedText) {
    return (
      <div className={timerCls()}>
        <div className={styles.timerLabel}>{finishedLabel ?? label}</div>
        <div className={styles.timerFinishedText}>{finishedText}</div>
      </div>
    );
  }

  const displayValue    = valueOverride ?? formatTime(Math.max(0, timeRemaining));
  const displaySubtitle = subtitleOverride ?? `Год ${currentYear}`;

  return (
    <div className={timerCls()}>
      <div className={styles.timerLabel}>{label}</div>
      <div className={styles.timerValue}>{displayValue}</div>
      <div className={styles.timerSubtitle}>{displaySubtitle}</div>
    </div>
  );
};

export default GlobalTimer;
