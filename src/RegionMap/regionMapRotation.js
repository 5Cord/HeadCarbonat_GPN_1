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
