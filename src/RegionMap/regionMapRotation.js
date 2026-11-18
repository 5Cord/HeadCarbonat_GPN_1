import { ROWS } from './faciesUtils.js';
const SIZE = ROWS.length;

export const normalizeRegionMapRotation = value => {
  const rotation = Number(value);
  return [0, 90, 180, 270].includes(rotation) ? rotation : 0;
};

const layouts = Object.fromEntries([0, 90, 180, 270].map(rotation => {
  const cells = Array.from({ length: SIZE }, (_, displayRow) =>
    Array.from({ length: SIZE }, (_, displayColumn) => {
      let row = displayRow;
      let column = displayColumn;
      if (rotation === 90) { row = SIZE - 1 - displayColumn; column = displayRow; }
      if (rotation === 180) { row = SIZE - 1 - displayRow; column = SIZE - 1 - displayColumn; }
      if (rotation === 270) { row = displayColumn; column = SIZE - 1 - displayRow; }
      return `${ROWS[row]}${column + 1}`;
    }),
  );
  const swappedAxes = rotation === 90 || rotation === 270;
  return [rotation, {
    cells,
    columnHeaders: cells[0].map(ref => swappedAxes ? ref[0] : Number(ref.slice(1))),
    rowHeaders: cells.map(row => swappedAxes ? Number(row[0].slice(1)) : row[0][0]),
  }];
}));

export const getRegionMapLayout = rotation => layouts[normalizeRegionMapRotation(rotation)];

const NORTH_ARROWS = { 0: '↑', 90: '→', 180: '↓', 270: '←' };
export const getRegionMapNorthArrow = rotation => NORTH_ARROWS[normalizeRegionMapRotation(rotation)];

export function rotateRegionMapPoint(x, y, rotation, size) {
  switch (normalizeRegionMapRotation(rotation)) {
    case 90: return { x: size - y, y: x };
    case 180: return { x: size - x, y: size - y };
    case 270: return { x: y, y: size - x };
    default: return { x, y };
  }
}

// Сторона карты, у которой стоит карточка, поворачивается вместе с её участком.
export function getRotatedCardSide(customStyle, rotation) {
  const left = parseFloat(customStyle?.left) || 0;
  const top = parseFloat(customStyle?.top) || 0;
  const point = rotateRegionMapPoint(left, top, rotation, 0);
  return Math.abs(point.x) > Math.abs(point.y)
    ? (point.x < 0 ? 'left' : 'right')
    : (point.y < 0 ? 'top' : 'bottom');
}

export function getRotatedCardStyle(customStyle, rotation) {
  const side = getRotatedCardSide(customStyle, rotation);
  return {
    left: side === 'left' ? 'calc(-1 * var(--lu-size, 65px) - 75px)'
      : side === 'right' ? 'calc(var(--lu-size, 65px) + 30px)' : '0px',
    top: side === 'top' ? 'calc(-1 * var(--lu-size, 65px) - 75px)'
      : side === 'bottom' ? 'calc(var(--lu-size, 65px) + 30px)' : '0px',
  };
}

// Подписи верхнего и нижнего ряда располагаются по свободную сторону маркера.
// Проверяем соседние маркеры и уже размещённые подписи, чтобы они не пересекались.
export function getRegionMapCardLabelDirections(cards, rotation, cellSize = 65) {
  const layout = getRegionMapLayout(rotation);
  const columnsByCell = new Map(layout.cells.flatMap(row => row.map((ref, column) => [ref, column])));
  const directions = {};
  const step = cellSize + 2;
  const labelGap = 8;

  for (const side of ['top', 'bottom']) {
    const edgeCards = cards
      .filter(card => getRotatedCardSide(card.customStyle, rotation) === side)
      .map(card => ({
        ...card,
        x: columnsByCell.get(card.cellRef) * step,
        labelWidth: Math.min(200, Math.max(75, card.name.length * 8.5)),
      }))
      .sort((a, b) => b.x - a.x);
    const labels = [];

    for (const card of edgeCards) {
      const candidate = direction => direction === 'left'
        ? [card.x - labelGap - card.labelWidth, card.x - labelGap]
        : [card.x + cellSize + labelGap, card.x + cellSize + labelGap + card.labelWidth];
      const isFree = span => edgeCards.every(other => other.id === card.id || span[1] <= other.x || span[0] >= other.x + cellSize)
        && labels.every(other => span[1] <= other[0] || span[0] >= other[1]);
      const direction = isFree(candidate('right')) ? 'right' : 'left';
      directions[card.id] = direction;
      labels.push(candidate(direction));
    }
  }
  return directions;
}
