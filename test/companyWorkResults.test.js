import test from 'node:test';
import assert from 'node:assert/strict';
import { getCompanyWorkResults } from '../src/Results/companyWorkResults.js';

test('shows the completed SRR and search drilling for an acquired company plot', () => {
  const owned = { D8: { cellRef: 'D8' } };
  const scenarios = { D8: { srrWorkId: 'srr_3d', workId: '1pr', rank: 2 } };
  assert.deepEqual(getCompanyWorkResults('D8', owned, scenarios), ['srr_3d', '1pr']);
});

test('shows only work recorded in the scenario', () => {
  const owned = { D8: { cellRef: 'D8' } };
  assert.deepEqual(getCompanyWorkResults('D8', owned, { D8: { workId: '1pr' } }), ['1pr']);
  assert.deepEqual(getCompanyWorkResults('D8', owned, { D8: { srrWorkId: 'srr_2d' } }), ['srr_2d']);
  assert.deepEqual(getCompanyWorkResults('D8', owned, { D8: { workId: '3r' } }), []);
});

test('does not expose company work on an unowned plot or a normal plot', () => {
  const scenarios = {
    D8: { srrWorkId: 'srr_2d', workId: '1pr' },
    B2: { srrWorkId: 'srr_2d', workId: '1pr' },
  };
  assert.deepEqual(getCompanyWorkResults('D8', { B2: { cellRef: 'B2' } }, scenarios), []);
  assert.deepEqual(getCompanyWorkResults('B2', { B2: { cellRef: 'B2' } }, scenarios), []);
});
