import test from 'node:test';
import assert from 'node:assert/strict';
import { getRegionMapLayout, getRegionMapNorthArrow, getRotatedCardSide, getRotatedCardStyle, normalizeRegionMapRotation, rotateRegionMapPoint } from '../src/RegionMap/regionMapRotation.js';

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
    assert.equal(columnHeaders.length, 10);
    assert.equal(rowHeaders.length, 10);
  }

  for (const [angle, expected] of [[0, [3, 5]], [90, [5, 6]], [180, [6, 4]], [270, [4, 3]]]) {
    const cells = getRegionMapLayout(angle).cells;
    const row = cells.findIndex(line => line.includes('D6'));
    assert.deepEqual([row, cells[row].indexOf('D6')], expected);
  }
});

test('invalid or missing rotations use the original map', () => {
  assert.equal(normalizeRegionMapRotation(undefined), 0);
  assert.equal(normalizeRegionMapRotation(45), 0);
  assert.equal(getRegionMapLayout(450), getRegionMapLayout(0));
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
