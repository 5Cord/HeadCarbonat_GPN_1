import React, { useEffect, useState } from 'react';
import useGameStore from '../store/gameStore';
import styles from './YearEndToast.module.css';

const DURATION = 10000;

const YearEndToast = () => {
  const setYearEndToast = useGameStore(s => s.setYearEndToast);
  const currentYear     = useGameStore(s => s.globalTimer.currentYear);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    const hideTimer = setTimeout(() => setHiding(true), DURATION - 1000);
    const removeTimer = setTimeout(() => setYearEndToast(false), DURATION);
    return () => { clearTimeout(hideTimer); clearTimeout(removeTimer); };
  }, []);

  return (
    <div className={`${styles.toast} ${hiding ? styles.hiding : ''}`}>
      <div className={styles.toastTitle}>Время вышло</div>
      <div className={styles.toastBody}>Настал {currentYear} год</div>
      <div className={styles.toastBar}>
        <div className={styles.toastBarFill} />
      </div>
    </div>
  );
};

export default YearEndToast;
