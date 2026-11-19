import { BLOCKED_CELLS } from '../RegionMap/blockedCells.js';

const companyRefs = new Set(BLOCKED_CELLS.company);

// The scenario records work completed by the company before the plot was transferred.
export function getCompanyWorkResults(cellRef, ownedCells, cellScenarios) {
  if (!companyRefs.has(cellRef) || !ownedCells?.[cellRef]) return [];
  const scenario = cellScenarios?.[cellRef];
  if (!scenario) return [];
  return [
    ...(scenario.srrWorkId === 'srr_2d' || scenario.srrWorkId === 'srr_3d'
      ? [scenario.srrWorkId] : []),
    ...(scenario.workId === '1pr' ? ['1pr'] : []),
  ];
}
