import React from 'react';
import { getScenario } from '../Research/sceneUtils.js';
import { getDisplayCellRef } from '../RegionMap/regionMapRotation.js';
import useGameStore from '../../store/gameStore';
import infaData from '../infa_.json';

export default function GeologyInfoCard({ cellRef }) {
  const rotation = useGameStore(state => state.player.sessionConfig?.regionMapRotation);
  const scenario = infaData.scenarios.find(s => s.id === getScenario(cellRef));
  return (
    <div style={{
      background: 'linear-gradient(135deg,#0d47a1,#1565c0)', borderRadius: 14,
      padding: '18px 24px', color: '#fff', width: '100%', maxWidth: 400, boxSizing: 'border-box',
      boxShadow: '0 4px 20px rgba(13,71,161,0.35)',
    }}>
      <div style={{ fontSize: '2.8rem', fontWeight: 900, lineHeight: 1, marginBottom: 8 }}>
        Участок {getDisplayCellRef(cellRef, rotation)}
      </div>
      <div style={{ fontSize: '0.95rem', lineHeight: 1.6, opacity: 0.92 }}>
        {scenario?.description ?? 'Геологические данные отсутствуют'}
      </div>
    </div>
  );
}
