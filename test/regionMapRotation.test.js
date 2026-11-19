import test from 'node:test';
import assert from 'node:assert/strict';
import { getDisplayCellRef, getRegionMapLayout, getRegionMapNorthArrow, getRotatedCardSide, getRotatedCardStyle, normalizeRegionMapRotation, rotateRegionMapPoint } from '../src/RegionMap/regionMapRotation.js';

test('each quarter turn keeps all cell references and rotates their positions', () => {
  const corners = {
    0: ['A1', 'A10', 'J1', 'J10'],
    90: ['J1', 'A1', 'J10', 'A10'],
    180: ['J10', 'J1', 'A10', 'A1'],
    270: ['A10', 'J10', 'A1', 'J1'],
  };

  for (const [angle, expected] of Object.entries(corners)) {
    const { cells, columnHeaders, rowHeaders } = getRegionMapLayout(Number(angle));
    assert.deepEqual([cells[0][0], cells[0][9], cells[9][0], cells[9][9]], expected);
    assert.equal(new Set(cells.flat()).size, 100);
    assert.deepEqual(columnHeaders, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual(rowHeaders, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
    assert.equal(getDisplayCellRef(cells[0][0], Number(angle)), 'A1');
    assert.equal(getDisplayCellRef(cells[9][9], Number(angle)), 'J10');
  }

  for (const [angle, expected] of [[0, [3, 5]], [90, [5, 6]], [180, [6, 4]], [270, [4, 3]]]) {
    const cells = getRegionMapLayout(angle).cells;
    const row = cells.findIndex(line => line.includes('D6'));
    assert.deepEqual([row, cells[row].indexOf('D6')], expected);
    assert.equal(getDisplayCellRef('D6', angle), `${'ABCDEFGHIJ'[row]}${expected[1] + 1}`);
  }
  assert.equal(getDisplayCellRef('D6', 360), 'D6');
});

test('invalid or missing rotations use the original map', () => {
  assert.equal(normalizeRegionMapRotation(undefined), 0);
  assert.equal(normalizeRegionMapRotation(45), 0);
  assert.equal(normalizeRegionMapRotation('270'), 270);
  assert.equal(getRegionMapLayout(450), getRegionMapLayout(0));
});

test('screen coordinates stay fixed through every turn and return to the original layout', () => {
  let rotation = 0;
  for (const [next, displayedD6] of [[90, 'F7'], [180, 'G5'], [270, 'E4'], [0, 'D6']]) {
    rotation = (rotation + 90) % 360;
    assert.equal(rotation, next);
    const layout = getRegionMapLayout(rotation);
    assert.equal(getDisplayCellRef('D6', rotation), displayedD6);
    assert.equal(layout.displayRefByCell[layout.cells[0][0]], 'A1');
    assert.equal(layout.displayRefByCell[layout.cells[9][9]], 'J10');
    assert.equal(new Set(Object.values(layout.displayRefByCell)).size, 100);
  }
  for (const angle of [90, 180, 270]) {
    const layout = getRegionMapLayout(angle);
    assert.ok(layout.cells.flat().every(ref => getDisplayCellRef(ref, angle) !== ref));
  }
});

test('overlay points follow the same rotation', () => {
  assert.deepEqual(rotateRegionMapPoint(20, 30, 90, 100), { x: 70, y: 20 });
  assert.deepEqual(rotateRegionMapPoint(20, 30, 180, 100), { x: 80, y: 70 });
  assert.deepEqual(rotateRegionMapPoint(20, 30, 270, 100), { x: 30, y: 80 });
});

test('card positions turn with their attached cells and north direction', () => {
  const cardStyle = { top: '-130px', left: '0px' };
  assert.deepEqual([0, 90, 180, 270].map(angle => getRotatedCardSide(cardStyle, angle)), ['top', 'right', 'bottom', 'left']);
  assert.deepEqual([0, 90, 180, 270].map(angle => getRotatedCardStyle(cardStyle, angle)), [
    { left: '0px', top: 'calc(-1 * var(--lu-size, 65px) - 75px)' },
    { left: 'calc(var(--lu-size, 65px) + 30px)', top: '0px' },
    { left: '0px', top: 'calc(var(--lu-size, 65px) + 30px)' },
    { left: 'calc(-1 * var(--lu-size, 65px) - 75px)', top: '0px' },
  ]);
  for (const angle of [0, 90, 180, 270]) {
    const cells = getRegionMapLayout(angle).cells;
    assert.equal(cells.flat().filter(ref => ref === 'A2').length, 1);
  }
  assert.deepEqual([0, 90, 180, 270].map(getRegionMapNorthArrow), ['↑', '→', '↓', '←']);
});
