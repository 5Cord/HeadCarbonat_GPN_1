import React from 'react';
import RefusalMap from './RefusalMap';
import { getPipelineCost } from '../RegionMap/pipelineZones';
import styles from './ResearchPanel.module.css';

export default function PipelineCompletionModal({ ownedCells, allTeamsCells, onContinue }) {
  const cells = Object.keys(ownedCells);
  const costs = cells.map(ref => ({ ref, cost: getPipelineCost(ref) }));
  const total = costs.every(item => item.cost != null)
    ? costs.reduce((sum, item) => sum + item.cost, 0)
    : null;

  return (
    <div className={styles.cellModalOverlay}>
      <div className={`${styles.cellModal} ${styles.mapModal}`} role="dialog" aria-modal="true"
        aria-label="Строительство нефтепровода" style={{ maxWidth: 820, width: '97%' }}>
        <h3>Строительство нефтепровода завершено</h3>
        <div className={styles.modalInfo}>
          <p style={{ textAlign: 'center', margin: 0 }}>Нефть можно сдавать в центральной точке. Доплата за подключение зависит от расположения вашего участка.</p>
          <RefusalMap mode="pipeline" ownedCells={ownedCells} allTeamsCells={allTeamsCells} />
          <p style={{ textAlign: 'center', margin: 0 }}>
            {costs.map(({ ref, cost }) => `${ref}: ${cost == null ? 'стоимость не определена' : `${cost} млн руб.`}`).join(' · ') || 'У команды нет участка'}
          </p>
          <p style={{ textAlign: 'center', margin: 0, fontWeight: 800 }}>
            Доплата: {total == null ? 'не определена' : `${total.toLocaleString('ru-RU')} млн руб.`}
          </p>
        </div>
        <div className={styles.modalActions}>
          <button className={styles.purchaseModalBtn} onClick={onContinue}>Перейти к 9-му году</button>
        </div>
      </div>
    </div>
  );
}
