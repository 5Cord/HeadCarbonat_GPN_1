// RefusalMap.jsx — мини-карта для отказа от участков и обмена с компанией
//
// Props (режим отказа — mode='refusal' по умолчанию):
//   ownedCells   — объект { [cellRef]: { cellRef, name, ... } } из gridCells.owned
//   selectedRefs — string[] — текущий выбор (cellRef[])
//   maxCount     — сколько участков можно отдать за раз
//   onToggle     — (cellRef) => void — переключить выбор
//   allTeamsCells — gridCells.allTeams (для отображения чужих участков)
//
// Props (режим обмена — mode='exchange'):
//   companyCells      — string[] — участки компании, доступные для выбора
//   selectedMyRef     — string|null — выбранный свой участок
//   selectedCompanyRef — string|null — выбранный участок компании
//   onSelectMy        — (cellRef) => void
//   onSelectCompany   — (cellRef) => void

import React from 'react';
import './RefusalMap.css';
import { getPipelineCost } from '../RegionMap/pipelineZones';
import { BLOCKED_CELLS } from '../RegionMap/blockedCells';

const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const cols = Array.from({ length: 10 }, (_, i) => i + 1);

const getBlockedType = (cellRef) => {
  if (BLOCKED_CELLS.reserve.includes(cellRef))    return 'reserve';
  if (BLOCKED_CELLS.settlement.includes(cellRef)) return 'settlement';
  if (BLOCKED_CELLS.company.includes(cellRef))    return 'company';
  return null;
};

const RefusalMap = ({
  mode = 'refusal',
  ownedCells = {},
  selectedRefs = [],
  maxCount = 1,
  onToggle,
  allTeamsCells = {},
  sceneImages = {},
  // exchange mode
  companyCells = [],
  selectedMyRef = null,
  selectedCompanyRef = null,
  onSelectMy,
  onSelectCompany,
}) => {
  const ownedKeys = Object.keys(ownedCells);

  return (
    <div className="refusal-map-wrap">
      {/* Легенда */}
      <div className="refusal-map-legend">
        {mode === 'pipeline' ? (
          <>
            {[0, 500, 1000, 1500, 2000, 2500].map(cost =>
              <span key={cost} className={`refusal-legend-item pipeline-legend-${cost}`}>{cost} млн</span>
            )}
            <span className="refusal-legend-item refusal-legend-own">Ваш участок</span>
            <span className="refusal-legend-item pipeline-legend-point">Точка сдачи нефти</span>
          </>
        ) : mode === 'exchange' ? (
          <>
            <span className="refusal-legend-item refusal-legend-own">Ваш участок</span>
            <span className="refusal-legend-item refusal-legend-give">Отдаёте</span>
            <span className="refusal-legend-item refusal-legend-company-avail">Участок компании</span>
            <span className="refusal-legend-item refusal-legend-receive">Получаете</span>
          </>
        ) : (
          <>
            <span className="refusal-legend-item refusal-legend-own">Ваш участок</span>
            <span className="refusal-legend-item refusal-legend-selected">Выбран для отказа</span>
            <span className="refusal-legend-item refusal-legend-other">Другая команда</span>
            <span className="refusal-legend-item refusal-legend-blocked">Заблокировано</span>
          </>
        )}
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
              const cellRef = `${row}${col}`;

              if (mode === 'pipeline') {
                const cost = getPipelineCost(cellRef);
                const isOwned = !!ownedCells[cellRef];
                return (
                  <div key={cellRef} className={`refusal-cell pipeline-cell pipeline-cell-${cost ?? 'unknown'}${isOwned ? ' pipeline-cell-own' : ''}`}
                    title={`${cellRef}: ${cost == null ? 'стоимость не определена' : `${cost} млн руб.`}${isOwned ? ' — ваш участок' : ''}`}>
                    <span className="refusal-cell-label">{cellRef}</span>
                    {isOwned && <span className="refusal-cell-mark">●</span>}
                    {cellRef === 'D6' && <span className="pipeline-point" title="Точка сдачи нефти">◆</span>}
                  </div>
                );
              }

              if (mode === 'exchange') {
                const isSettlement   = BLOCKED_CELLS.settlement.includes(cellRef);
                const isOwned        = !!ownedCells[cellRef];
                const isTakenByOther = !isOwned && !!allTeamsCells[cellRef]?.ownedByTeamId;
                // company-клетка доступна только если ещё никем не взята
                const isCompany      = companyCells.includes(cellRef) && !isTakenByOther;
                const isGive         = selectedMyRef === cellRef;
                const isReceive      = selectedCompanyRef === cellRef;
                const blockedType    = isSettlement ? 'settlement' : (!isOwned && !isCompany && !isTakenByOther) ? getBlockedType(cellRef) : null;

                let cls = 'refusal-cell';
                if (isSettlement)     cls += ' refusal-cell-blocked refusal-cell-blocked-settlement';
                else if (isGive)      cls += ' refusal-cell-give';
                else if (isOwned)     cls += ' refusal-cell-own';
                else if (isReceive)   cls += ' refusal-cell-receive';
                else if (isCompany)   cls += ' refusal-cell-company-avail';
                else if (isTakenByOther) cls += ' refusal-cell-other';
                else if (blockedType) cls += ` refusal-cell-blocked refusal-cell-blocked-${blockedType}`;

                const handleClick = () => {
                  if (isSettlement) return;
                  if (isOwned) onSelectMy?.(isGive ? null : cellRef);
                  else if (isCompany) onSelectCompany?.(isReceive ? null : cellRef);
                };

                const sceneImg = sceneImages[cellRef];
                return (
                  <div
                    key={cellRef}
                    className={cls}
                    onClick={handleClick}
                    title={
                      isSettlement ? `${cellRef} — населённый пункт, недоступно для выбора` :
                      isGive        ? `${cellRef} — отдаёте (нажмите чтобы снять)` :
                      isReceive     ? `${cellRef} — получаете (нажмите чтобы снять)` :
                      isOwned       ? `${cellRef} — нажмите чтобы выбрать для передачи` :
                      isCompany     ? `${cellRef} — участок компании, нажмите чтобы выбрать` :
                      isTakenByOther ? `${cellRef} — уже занят другой командой` :
                      blockedType   ? `${cellRef} — заблокировано` :
                                      cellRef
                    }
                    style={{ cursor: !isSettlement && (isOwned || isCompany) ? 'pointer' : 'default' }}
                  >
                    {sceneImg && <img className="refusal-cell-scene-img" src={sceneImg} alt="" />}
                    <span className="refusal-cell-label">{cellRef}</span>
                    {isGive    && <span className="refusal-cell-mark" style={{ color: '#c62828' }}>✕</span>}
                    {isReceive && <span className="refusal-cell-mark" style={{ color: '#1565c0' }}>✓</span>}
                  </div>
                );
              }

              // ── режим отказа (по умолчанию) ──
              const isOwned    = !!ownedCells[cellRef];
              const isSelected = selectedRefs.includes(cellRef);
              const isOwnedByOther = !isOwned && !!allTeamsCells[cellRef]?.ownedByTeamId;
              // если клетка из BLOCKED_CELLS.company уже взята кем-то — не показываем как заблокированную
              const blockedType = BLOCKED_CELLS.settlement.includes(cellRef) ? 'settlement' : (isOwned || isOwnedByOther) ? null : getBlockedType(cellRef);
              const isOther    = isOwnedByOther;
              const canToggle  = !blockedType && isOwned && (isSelected || selectedRefs.length < maxCount);

              let cls = 'refusal-cell';
              if (blockedType)     cls += ` refusal-cell-blocked refusal-cell-blocked-${blockedType}`;
              else if (isSelected) cls += ' refusal-cell-selected';
              else if (isOwned)    cls += ' refusal-cell-own';
              else if (isOther)    cls += ' refusal-cell-other';

              const sceneImg = sceneImages[cellRef];
              return (
                <div
                  key={cellRef}
                  className={cls}
                  onClick={() => canToggle && onToggle(cellRef)}
                  title={
                    blockedType === 'settlement' ? `${cellRef} — населённый пункт, недоступно для выбора` :
                    isSelected  ? `${cellRef} — выбран для отказа (нажмите чтобы снять)` :
                    isOwned     ? (selectedRefs.length >= maxCount ? `${cellRef} — лимит выбора (${maxCount})` : `${cellRef} — нажмите для выбора`) :
                    blockedType ? `${cellRef} — заблокировано` :
                    isOther     ? `${cellRef} — участок другой команды` :
                                  cellRef
                  }
                >
                  {sceneImg && <img className="refusal-cell-scene-img" src={sceneImg} alt="" />}
                  <span className="refusal-cell-label">{cellRef}</span>
                  {isSelected && <span className="refusal-cell-mark">✕</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Итог выбора */}
      {mode === 'pipeline' ? null : mode === 'exchange' ? (
        <div className="refusal-map-selection-summary">
          {!selectedMyRef && !selectedCompanyRef ? (
            <span className="refusal-summary-hint">Выберите ваш участок и участок компании</span>
          ) : selectedMyRef && selectedCompanyRef ? (
            <span className="refusal-summary-exchange-ready">
              {selectedMyRef} → {selectedCompanyRef}
            </span>
          ) : selectedMyRef ? (
            <span className="refusal-summary-hint">Теперь выберите участок компании (оранжевый)</span>
          ) : (
            <span className="refusal-summary-hint">Теперь выберите ваш участок для передачи</span>
          )}
        </div>
      ) : (
        ownedKeys.length > 0 && (
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
        )
      )}
    </div>
  );
};

export default RefusalMap;
