import React from 'react';
import { BLOCKED_CELLS } from './blockedCells';
import { ROWS } from './faciesUtils';
import { resolveLicenseUnits } from './luCards';
import { getRegionMapLayout, getRegionMapNorthArrow, getRotatedCardSide, normalizeRegionMapRotation } from './regionMapRotation';
import './RegionMapMiniature.css';

const COLUMNS = Array.from({ length: 10 }, (_, index) => index + 1);
const SETTLEMENTS = new Set(BLOCKED_CELLS.settlement);
const PARENT_COMPANY = new Set(BLOCKED_CELLS.company);

export default function RegionMapMiniature({ rotation = 0, luCards, onRotationChange }) {
  const currentRotation = normalizeRegionMapRotation(rotation);
  const layout = getRegionMapLayout(currentRotation);
  const northArrow = getRegionMapNorthArrow(currentRotation);
  const freeCount = ROWS.length * COLUMNS.length - SETTLEMENTS.size - PARENT_COMPANY.size;
  const cardsByCell = Object.fromEntries(resolveLicenseUnits(luCards).map(card => [card.cellRef, card]));

  return (
    <div className="region-miniature">
      <div className="region-miniature-heading">
        <div>
          <div className="region-miniature-title">Карта региона</div>
          <div className="region-miniature-subtitle">Расположение участков в новой сессии</div>
        </div>
        <span className="region-miniature-tag">Предпросмотр</span>
      </div>

      <div className="region-miniature-toolbar">
        <span className="region-miniature-north" aria-label={`Север: ${northArrow}`}>{northArrow} С</span>
        <div className="region-miniature-rotate">
          <button type="button" disabled={!onRotationChange} onClick={() => onRotationChange((currentRotation + 270) % 360)} aria-label="Повернуть карту на 90 градусов против часовой стрелки">
            ↶ 90°
          </button>
          <button type="button" disabled={!onRotationChange} onClick={() => onRotationChange((currentRotation + 90) % 360)} aria-label="Повернуть карту на 90 градусов по часовой стрелке">
            90° ↷
          </button>
        </div>
      </div>

      <div className="region-miniature-map" role="img" aria-label={`Карта региона, поворот ${currentRotation} градусов. Свободных участков: ${freeCount}. Населённых пунктов: ${SETTLEMENTS.size}. Участков материнской компании: ${PARENT_COMPANY.size}. Карточек информации: ${Object.keys(cardsByCell).length}.`}>
        <div className="region-miniature-grid" aria-hidden="true">
          <span className="region-miniature-axis region-miniature-axis-corner" />
          {layout.columnHeaders.map(column => <span key={`column-${column}`} className="region-miniature-axis">{column}</span>)}
          {layout.cells.map((cells, rowIndex) => (
            <React.Fragment key={rowIndex}>
              <span className="region-miniature-axis">{layout.rowHeaders[rowIndex]}</span>
              {cells.map(ref => {
                const type = SETTLEMENTS.has(ref) ? 'settlement'
                  : PARENT_COMPANY.has(ref) ? 'company' : 'free';
                const card = cardsByCell[ref];
                return <span key={ref} className={`region-miniature-cell region-miniature-cell-${type}`}>
                  <span className="region-miniature-cell-ref">{ref}</span>
                  {card && <span className={`region-miniature-card region-miniature-card-${getRotatedCardSide(card.customStyle, currentRotation)}`} title={`${card.name} · ${card.cost} млн ₽`}>{card.shortName}</span>}
                </span>;
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="region-miniature-legend">
        <span><i className="region-miniature-swatch region-miniature-swatch-free" />Свободные · {freeCount}</span>
        <span><i className="region-miniature-swatch region-miniature-swatch-settlement" />Населённые пункты · {SETTLEMENTS.size}</span>
        <span><i className="region-miniature-swatch region-miniature-swatch-company" />Материнская компания · {PARENT_COMPANY.size}</span>
        <span><i className="region-miniature-swatch region-miniature-swatch-card" />Карточки информации · {Object.keys(cardsByCell).length}</span>
      </div>
      <p className="region-miniature-note">Поворот: {currentRotation}°. Это положение сохранится при создании сессии.</p>
    </div>
  );
}
