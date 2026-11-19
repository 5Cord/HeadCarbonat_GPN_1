import React from 'react';
import RefusalMap from './RefusalMap';
import { getPipelineCost } from '../RegionMap/pipelineZones';
import { getDisplayCellRef } from '../RegionMap/regionMapRotation';
import useGameStore from '../../store/gameStore';
import styles from './ResearchPanel.module.css';

export default function PipelineCompletionModal({ ownedCells, allTeamsCells, onContinue }) {
  const rotation = useGameStore(state => state.player.sessionConfig?.regionMapRotation);
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
          <p style={{ textAlign: 'center', margin: 0 }}>Нефтепровод построен. Для того, чтобы компания начала сдавать в него продукты, вам пришлось достроить трубу до него. Размер стоимости строительства определен автоматически исходя из удаленности вашего участка до точки сдачи нефти.</p>
          <RefusalMap mode="pipeline" ownedCells={ownedCells} allTeamsCells={allTeamsCells} />
          <p style={{ textAlign: 'center', margin: 0 }}>
            {costs.map(({ ref, cost }) => `${getDisplayCellRef(ref, rotation)}: ${cost == null ? 'стоимость не определена' : `${cost} млн руб.`}`).join(' · ') || 'У команды нет участка'}
          </p>
          <p style={{ textAlign: 'center', margin: 0, fontWeight: 800 }}>
            Расчётная стоимость: {total == null ? 'не определена' : `${total.toLocaleString('ru-RU')} млн руб.`}
          </p>
        </div>
        <div className={styles.modalActions}>
          <button className={styles.purchaseModalBtn} onClick={onContinue}>Перейти к 9-му году</button>
        </div>
      </div>
    </div>
  );
}
