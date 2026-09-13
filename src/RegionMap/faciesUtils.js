// faciesUtils.js
// Фации карты региона: разбор шаблона, нормализация и геометрия узловых точек.
//
// Формат нормализованного конфига:
//   { width, height, legend: { код: { name, color } }, grid: [[код]], nodes: [{ at, type, label }] }
//
// Узел адресуется левой-верхней из своих 4 ячеек: at: 'C6' — угол между C6/C7/D6/D7.

export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

// Геометрия сетки — держать в согласии с RegionMap.css (.cell-with-lu-wrapper / .grid-row)
export const CELL_PX = 65;
export const GAP_PX  = 2;
export const STEP_PX = CELL_PX + GAP_PX;

export const DEFAULT_FACIES_COLORS = {
  'ПО': '#B3B3B3',
  'Р':  '#F4CC9B',
  'Д':  '#FCFCC2',
  'ВД': '#A2D16C',
  'П':  '#F28D8D',
  'ГК': '#8ECEF5',
  'ГГ': '#B39BC8',
};

const FALLBACK_COLORS = ['#a8d5a2', '#6fb7e3', '#e8c66a', '#b39ddb', '#f2e394', '#d99a6c', '#94a3b8', '#f8b4b4', '#7dd3c0', '#c4b5a0'];

export const NODE_TYPES = {
  oil_delivery: { label: 'Точка сдачи нефти', icon: '⬢' },
};

export const DEFAULT_NODE_TYPE = 'oil_delivery';

// ── Адресация ────────────────────────────────────────────────────────────────

export function cellRefToRC(ref) {
  if (typeof ref !== 'string' || ref.length < 2) return null;
  const r = ROWS.indexOf(ref[0].toUpperCase());
  const c = parseInt(ref.slice(1), 10) - 1;
  if (r < 0 || Number.isNaN(c) || c < 0) return null;
  return { r, c };
}

export function rcToCellRef(r, c) {
  if (r < 0 || r >= ROWS.length || c < 0) return null;
  return `${ROWS[r]}${c + 1}`;
}

// ── Разбор сырого шаблона ────────────────────────────────────────────────────

// Отрезает пометку вида "П(в центре скважина)" → "П"
function splitCellToken(token) {
  const raw = String(token ?? '').trim();
  const open = raw.indexOf('(');
  if (open === -1) return { code: raw, marked: false };
  return { code: raw.slice(0, open).trim(), marked: true };
}

// Помеченные ячейки схлопываются в узлы: блок 2×2 помеченных → одна точка в его центре
function deriveNodes(marks, width, height) {
  const isMarked = (r, c) => r >= 0 && r < height && c >= 0 && c < width && marks[r][c];
  const nodes = [];
  const covered = new Set();

  for (let r = 0; r < height - 1; r++) {
    for (let c = 0; c < width - 1; c++) {
      if (isMarked(r, c) && isMarked(r, c + 1) && isMarked(r + 1, c) && isMarked(r + 1, c + 1)) {
        nodes.push({ at: rcToCellRef(r, c), type: DEFAULT_NODE_TYPE, label: NODE_TYPES[DEFAULT_NODE_TYPE].label });
        covered.add(`${r}:${c}`).add(`${r}:${c + 1}`).add(`${r + 1}:${c}`).add(`${r + 1}:${c + 1}`);
      }
    }
  }

  // Одиночная помеченная ячейка вне блока — точка в её правом нижнем углу
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!marks[r][c] || covered.has(`${r}:${c}`)) continue;
      const nr = Math.min(r, height - 2);
      const nc = Math.min(c, width - 2);
      const at = rcToCellRef(nr, nc);
      if (at && !nodes.some(n => n.at === at)) {
        nodes.push({ at, type: DEFAULT_NODE_TYPE, label: NODE_TYPES[DEFAULT_NODE_TYPE].label });
      }
    }
  }

  return nodes;
}

function buildLegend(rawLegend, codesInGrid) {
  const legend = {};
  let i = 0;
  const entries = rawLegend && typeof rawLegend === 'object' ? Object.entries(rawLegend) : [];

  for (const [code, val] of entries) {
    const key = String(code).trim();
    if (!key) continue;
    legend[key] = {
      name:  typeof val === 'string' ? val : (val?.name ?? key),
      color: val?.color || DEFAULT_FACIES_COLORS[key] || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    };
    i++;
  }

  // Коды, встреченные в сетке, но забытые в легенде
  for (const code of codesInGrid) {
    if (legend[code]) continue;
    legend[code] = {
      name:  code,
      color: DEFAULT_FACIES_COLORS[code] || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    };
    i++;
  }

  return legend;
}

// Принимает как сырой шаблон ({ matrix: {...} } с пометками в скобках), так и уже нормализованный
export function parseFaciesPreset(input) {
  const src = input?.matrix ?? input;
  if (!src || !Array.isArray(src.grid)) return null;

  const height = Number(src.height) || src.grid.length;
  const width  = Number(src.width)  || (src.grid[0]?.length ?? 0);
  if (!width || !height) return null;

  const grid  = [];
  const marks = [];
  const codes = new Set();

  for (let r = 0; r < height; r++) {
    const rowSrc = Array.isArray(src.grid[r]) ? src.grid[r] : [];
    const gridRow = [];
    const markRow = [];
    for (let c = 0; c < width; c++) {
      const { code, marked } = splitCellToken(rowSrc[c]);
      gridRow.push(code);
      markRow.push(marked);
      if (code) codes.add(code);
    }
    grid.push(gridRow);
    marks.push(markRow);
  }

  const derived = deriveNodes(marks, width, height);
  const explicit = Array.isArray(src.nodes)
    ? src.nodes
        .filter(n => n && cellRefToRC(n.at))
        .map(n => ({
          at:    String(n.at).toUpperCase(),
          type:  n.type || DEFAULT_NODE_TYPE,
          label: n.label || NODE_TYPES[n.type || DEFAULT_NODE_TYPE]?.label || 'Точка',
        }))
    : [];

  const nodes = [...explicit];
  for (const n of derived) {
    if (!nodes.some(e => e.at === n.at)) nodes.push(n);
  }

  return { width, height, legend: buildLegend(src.legend, codes), grid, nodes };
}

// ── Доступ при рендере ───────────────────────────────────────────────────────

export function getFacies(config, cellRef) {
  if (!config?.grid) return null;
  const rc = cellRefToRC(cellRef);
  if (!rc) return null;
  const code = config.grid[rc.r]?.[rc.c];
  if (!code) return null;
  const meta = config.legend?.[code];
  return { code, name: meta?.name ?? code, color: meta?.color ?? '#cbd5e1' };
}

// Абсолютные координаты узлов внутри .grid-with-lu
export function getFaciesNodes(config) {
  if (!config?.nodes?.length) return [];
  return config.nodes.reduce((acc, n) => {
    const rc = cellRefToRC(n.at);
    if (!rc) return acc;
    acc.push({
      ...n,
      icon: NODE_TYPES[n.type]?.icon ?? NODE_TYPES[DEFAULT_NODE_TYPE].icon,
      x: rc.c * STEP_PX + CELL_PX + GAP_PX / 2,
      y: rc.r * STEP_PX + CELL_PX + GAP_PX / 2,
    });
    return acc;
  }, []);
}
