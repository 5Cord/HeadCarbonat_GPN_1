// RefusalMap.jsx — мини-карта для отказа от участков
// Используется внутри модалки отказа в ResearchPanel (годы 3 и 5)
//
// Props:
//   ownedCells   — объект { [cellRef]: { cellRef, name, ... } } из gridCells.owned
//   selectedRefs — string[] — текущий выбор (cellRef[])
//   maxCount     — сколько участков можно отдать за раз (= MAX_REFUSAL_COUNT)
//   onToggle     — (cellRef) => void — переключить выбор
//   allTeamsCells — gridCells.allTeams (для отображения чужих участков)

import React from 'react';
import './RefusalMap.css';

const BLOCKED_CELLS = {
  reserve:    ['C3', 'C4', 'D3', 'D4'],
  settlement: ['G6', 'G7', 'H6', 'H7'],
  company:    ['B5', 'C5', 'B6', 'C6'],
};

const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const cols = Array.from({ length: 10 }, (_, i) => i + 1);

const getBlockedType = (cellRef) => {
  if (BLOCKED_CELLS.reserve.includes(cellRef))    return 'reserve';
  if (BLOCKED_CELLS.settlement.includes(cellRef)) return 'settlement';
  if (BLOCKED_CELLS.company.includes(cellRef))    return 'company';
  return null;
};

const RefusalMap = ({ ownedCells = {}, selectedRefs = [], maxCount = 1, onToggle, allTeamsCells = {} }) => {
  const ownedKeys = Object.keys(ownedCells);

  return (
    <div className="refusal-map-wrap">
      {/* Легенда */}
      <div className="refusal-map-legend">
        <span className="refusal-legend-item refusal-legend-own">Ваш участок</span>
        <span className="refusal-legend-item refusal-legend-selected">Выбран для отказа</span>
        <span className="refusal-legend-item refusal-legend-other">Другая команда</span>
        <span className="refusal-legend-item refusal-legend-blocked">Заблокировано</span>
      </div>

      {/* Сетка */}
      <div className="refusal-map-grid-wrap">
        {/* Заголовок колонок */}
        <div className="refusal-grid-col-headers">
          <div className="refusal-grid-corner" />
          {cols.map(c => <div key={c} className="refusal-grid-col-header">{c}</div>)}
        </div>

        {/* Строки */}
        {rows.map(row => (
          <div key={row} className="refusal-grid-row">
            <div className="refusal-grid-row-header">{row}</div>
            {cols.map(col => {
              const cellRef    = `${row}${col}`;
              const isOwned    = !!ownedCells[cellRef];
              const isSelected = selectedRefs.includes(cellRef);
              const blockedType = getBlockedType(cellRef);
              const isOther    = !isOwned && !!allTeamsCells[cellRef]?.ownedByTeamId;
              const canToggle  = isOwned && (isSelected || selectedRefs.length < maxCount);

              let cls = 'refusal-cell';
              if (blockedType)  cls += ` refusal-cell-blocked refusal-cell-blocked-${blockedType}`;
              else if (isSelected) cls += ' refusal-cell-selected';
              else if (isOwned)    cls += ' refusal-cell-own';
              else if (isOther)    cls += ' refusal-cell-other';

              return (
                <div
                  key={cellRef}
                  className={cls}
                  onClick={() => canToggle && onToggle(cellRef)}
                  title={
                    isSelected  ? `${cellRef} — выбран для отказа (нажмите чтобы снять)` :
                    isOwned     ? (selectedRefs.length >= maxCount ? `${cellRef} — лимит выбора (${maxCount})` : `${cellRef} — нажмите для выбора`) :
                    blockedType ? `${cellRef} — заблокировано` :
                    isOther     ? `${cellRef} — участок другой команды` :
                                  cellRef
                  }
                >
                  <span className="refusal-cell-label">{cellRef}</span>
                  {isSelected && <span className="refusal-cell-mark">✕</span>}
                  {isOwned && !isSelected && <span className="refusal-cell-mark refusal-cell-own-mark">●</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Итог выбора */}
      {ownedKeys.length > 0 && (
        <div className="refusal-map-selection-summary">
          {selectedRefs.length === 0 ? (
            <span className="refusal-summary-hint">
              Нажмите на свой участок (●) чтобы выбрать его для отказа
              {maxCount > 1 ? ` — можно выбрать до ${maxCount}` : ''}
            </span>
          ) : (
            <span className="refusal-summary-chosen">
              Выбрано для отказа: {selectedRefs.join(', ')}
              {maxCount > 1 && ` (${selectedRefs.length}/${maxCount})`}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default RefusalMap;