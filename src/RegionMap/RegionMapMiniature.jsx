import React from 'react';
import { BLOCKED_CELLS } from './blockedCells';
import { ROWS } from './faciesUtils';
import './RegionMapMiniature.css';

const COLUMNS = Array.from({ length: 10 }, (_, index) => index + 1);
const SETTLEMENTS = new Set(BLOCKED_CELLS.settlement);
const PARENT_COMPANY = new Set(BLOCKED_CELLS.company);

export default function RegionMapMiniature() {
  const freeCount = ROWS.length * COLUMNS.length - SETTLEMENTS.size - PARENT_COMPANY.size;

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
        <span className="region-miniature-north" aria-hidden="true">↑ С</span>
        <div className="region-miniature-rotate">
          <button type="button" disabled title="Поворот карты появится позже" aria-label="Повернуть карту на 90 градусов против часовой стрелки">
            ↶ 90°
          </button>
          <button type="button" disabled title="Поворот карты появится позже" aria-label="Повернуть карту на 90 градусов по часовой стрелке">
            90° ↷
          </button>
        </div>
      </div>

      <div className="region-miniature-map" role="img" aria-label={`Карта региона. Свободных участков: ${freeCount}. Населённых пунктов: ${SETTLEMENTS.size}. Участков материнской компании: ${PARENT_COMPANY.size}.`}>
        <div className="region-miniature-grid" aria-hidden="true">
          <span className="region-miniature-axis region-miniature-axis-corner" />
          {COLUMNS.map(column => <span key={`column-${column}`} className="region-miniature-axis">{column}</span>)}
          {ROWS.map(row => (
            <React.Fragment key={row}>
              <span className="region-miniature-axis">{row}</span>
              {COLUMNS.map(column => {
                const ref = `${row}${column}`;
                const type = SETTLEMENTS.has(ref) ? 'settlement'
                  : PARENT_COMPANY.has(ref) ? 'company' : 'free';
                return <span key={ref} className={`region-miniature-cell region-miniature-cell-${type}`}>{ref}</span>;
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="region-miniature-legend">
        <span><i className="region-miniature-swatch region-miniature-swatch-free" />Свободные · {freeCount}</span>
        <span><i className="region-miniature-swatch region-miniature-swatch-settlement" />Населённые пункты · {SETTLEMENTS.size}</span>
        <span><i className="region-miniature-swatch region-miniature-swatch-company" />Материнская компания · {PARENT_COMPANY.size}</span>
      </div>
      <p className="region-miniature-note">Поворот карты будет доступен позже.</p>
    </div>
  );
}
