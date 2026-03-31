// sceneUtils.js — утилиты для сценарных карточек ResultsPanel
import sceneDescData from '../assets/scene/sceneDesc.json';

// Предзагружаем все изображения сценариев через Vite glob
const sceneImages = import.meta.glob(
  '/src/assets/scene/**/*.jpg',
  { eager: true, import: 'default' }
);

// Данные Scen.json встроены напрямую (строки A–J, столбцы 1–10)
const SCEN_DATA = {
  A: [4, 4, 4, 1, 1, 1, 2, 0, 3, 0],
  B: [4, 1, 1, 1, 1, 2, 2, 0, 0, 3],
  C: [4, 1, 1, 1, 2, 0, 0, 0, 0, 2],
  D: [1, 1, 1, 2, 2, 3, 0, 3, 2, 1],
  E: [1, 2, 2, 0, 0, 0, 0, 2, 1, 1],
  F: [2, 0, 3, 0, 0, 0, 2, 1, 1, 4],
  G: [0, 3, 0, 0, 3, 0, 2, 1, 1, 4],
  H: [0, 0, 0, 0, 0, 2, 2, 1, 1, 4],
  I: [0, 0, 3, 0, 0, 2, 1, 1, 1, 4],
  J: [0, 3, 0, 0, 2, 1, 1, 1, 4, 4],
};

// Маппинг workId → папка, аббревиатура файла, кол-во строк
export const WORK_SCENE_MAP = {
  srr_2d:        { folder: 'СРР 2_3D',             fileKey: 'СРР2Д',   rows: 2 },
  srr_3d:        { folder: 'СРР 2_3D',             fileKey: 'СРР3Д',   rows: 2 },
  '1pr':         { folder: '1ПО',                  fileKey: 'ПО',      rows: 3 },
  '3r':          { folder: '3Р',                   fileKey: 'Р',       rows: 3 },
  drilling_5gs:  { folder: 'ГС',                   fileKey: 'ГС',      rows: 3 },
  drilling_6gs:  { folder: 'ГС с МГРП',            fileKey: 'ГС_МГРП', rows: 3 },
  drilling_7mzs: { folder: 'МЗС',                  fileKey: 'МЗС',     rows: 3 },
  testing:       { folder: 'ППД',                  fileKey: 'ППД',     rows: 3 },
  mun:           { folder: 'МУН',                  fileKey: 'МУН',     rows: 3 },
  depression:    { folder: 'Бурение на депрессии', fileKey: 'БнД',     rows: 3 },
  bsko:          { folder: 'БСКО',                 fileKey: 'БСКО',    rows: 3 },
  ppd:           { folder: 'Перевод в ППД',        fileKey: 'ПППД',    rows: 3 },
  '3bs':         { folder: 'ЗБС',                  fileKey: 'ЗБС',     rows: 3 },
};

// cellRef "A2" → номер сценария (0–4) или null
export const getScenario = (cellRef) => {
  if (!cellRef || cellRef.length < 2) return null;
  const row = cellRef[0].toUpperCase();
  const col = parseInt(cellRef.slice(1), 10);
  if (!SCEN_DATA[row] || col < 1 || col > 10) return null;
  return SCEN_DATA[row][col - 1];
};

// Маппинг workId → название категории в sceneDesc.json
const WORK_CATEGORY_MAP = {
  srr_2d:        'СРР 2_3D',
  srr_3d:        'СРР 2_3D',
  '1pr':         'ПО',
  '3r':          '3Р',
  drilling_5gs:  'ГС',
  drilling_6gs:  'ГС с МГРП',
  drilling_7mzs: 'МЗС',
  testing:       'ППД',
  mun:           'МУН',
  depression:    'Бурение на депрессии',
  bsko:          'БСКО',
  ppd:           'Перевод в ППД',
  '3bs':         'ЗБС',
};

// Возвращает текстовое описание из sceneDesc.json
// scenario 4 хранится как source_id 5
export const resolveSceneDesc = (scenario, workId, rowNum) => {
  if (scenario == null || rowNum == null || rowNum < 1) return null;
  const map = WORK_SCENE_MAP[workId];
  if (!map) return null;
  const sourceId = scenario === 4 ? 5 : scenario;
  const source = sceneDescData.sources.find(s => s.source_id === sourceId);
  if (!source) return null;
  const catName = WORK_CATEGORY_MAP[workId];
  const category = source.categories.find(c => c.name === catName);
  if (!category) return null;
  // СРР 2D и 3D делят одну категорию — фильтруем по fileKey
  if (workId === 'srr_2d' || workId === 'srr_3d') {
    const filtered = category.items.filter(item => item.scene.includes(`_${map.fileKey}_`));
    return filtered[rowNum - 1]?.description ?? null;
  }
  return category.items[rowNum - 1]?.description ?? null;
};

// Отладка: перебирает все сценарии/работы/ранки и выводит console.table
export const debugAllSceneImages = () => {
  const rows = [];
  for (let scenario = 0; scenario <= 4; scenario++) {
    for (const workId of Object.keys(WORK_SCENE_MAP)) {
      const map = WORK_SCENE_MAP[workId];
      const maxRank = map.rows;
      for (let rank = 1; rank <= maxRank; rank++) {
        const img = resolveSceneImage(scenario, workId, rank, 'к');
        const desc = resolveSceneDesc(scenario, workId, rank);
        rows.push({
          сценарий: scenario,
          workId,
          rank,
          'img ✓/✗': img ? '✓' : '✗',
          'desc ✓/✗': desc ? '✓' : '✗',
          desc_текст: desc ?? '—',
        });
      }
    }
  }
  console.table(rows);
  const missing = rows.filter(r => r['img ✓/✗'] === '✗');
  console.warn(`[SceneDebug] Не найдено img: ${missing.length} из ${rows.length}`, missing.map(r => `${r.сценарий}/${r.workId}/rank${r.rank}`));
};

// Возвращает URL картинки: type = 'к' (картинка) | 'т' (текст, устарело)
// rowNum = avgRank из FieldWork (1, 2 или 3)
export const resolveSceneImage = (scenario, workId, rowNum, type) => {
  const map = WORK_SCENE_MAP[workId];
  if (!map || rowNum == null || rowNum < 1) return null;
  const prefix = Math.max(scenario, 1);
  const key = `/src/assets/scene/${scenario}/${map.folder}/${prefix}_${map.fileKey}_${rowNum}_${type}.jpg`;
  return sceneImages[key] ?? null;
};
