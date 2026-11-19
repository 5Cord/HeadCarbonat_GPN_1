// luCards.js — дефолтные карточки ЛУ карты региона и мёрж с настройками сессии.
// Вынесено в отдельный модуль, чтобы делиться константами между RegionMap и
// админкой без нарушения react-refresh (файл компонента экспортирует только компонент).
import RegNirSvg from '../svgs/RegNir.svg';

// Полные дефолты с позициями/стилями — используются для рендера на карте.
export const DEFAULT_LICENSE_UNITS = [
  { id: 'well1', name: 'Парам. скважина №1', shortName: '1', cost: 10, cellRef: 'A2', position: 'top-left', customStyle: { top: '-130px', left: '0px' }, description: 'Целевой комплекс: светлые слоистые строматолитовые доломиты с прослоями гипса и ангидрита. Свойства: доломиты слабо пористые, с редкими выпотами густой нефти.', hasImage: false },
  { id: 'well2', name: 'Парам. скважина №2', shortName: '2', cost: 10, cellRef: 'A5', position: 'top-left', customStyle: { top: '-130px', left: '0px' }, description: 'Целевой комплекс: светлые тонкослоистые известняки и доломиты, прослоями зернистые. Свойства: межзерновая пористость, признаки нефтенасыщения по порам.', hasImage: false },
  { id: 'seismic', name: 'ОиИ архивных СРР 2D', shortName: 'И', cost: 30, cellRef: 'A10', position: 'corner-bottom-left', customStyle: { top: '-130px', left: '80px' }, description: 'По данным двухмерной сейсморазведки выделяются ориентированные с юго-запада на северо-восток объекты, похожие на структурные валы. В центральной части территории между ними фиксируется палеопрогиб.', hasImage: false },
  { id: 'well3', name: 'Парам. скважина №3', shortName: '3', cost: 10, cellRef: 'B10', position: 'right', customStyle: { top: '0', left: '85px' }, description: 'Целевой комплекс: тонкослоистые черные кремнистые известняки с повышенным содержанием органического углерода. Свойства: мощность комплекса сильно сокращена.', hasImage: false },
  { id: 'well4', name: 'Парам. скважина №4', shortName: '4', cost: 20, cellRef: 'E10', position: 'right', customStyle: { top: '0px', left: '85px' }, description: 'Целевой комплекс: массивные трещиновато-кавернозные известняки с кораллами и губками. Свойства: по кавернам обильные выпоты нефти.', hasImage: false },
  { id: 'well5', name: 'Парам. скважина №5', shortName: '5', cost: 20, cellRef: 'J8', position: 'right', customStyle: { top: '85px', left: '0px' }, description: 'Целевой комплекс: светлые слоистые известняки и доломиты (зернистые и микритовые). Свойства: прослоями породы пористые, с признаками углеводородов.', hasImage: false },
  { id: 'well6', name: 'Парам. скважина №6', shortName: '6', cost: 10, cellRef: 'J3', position: 'right', customStyle: { top: '85px', left: '0px' }, description: 'Целевой комплекс: тонкослоистые черные кремнистые известняки с повышенным содержанием органического углерода, с остатками планктонной фауны. Свойства: мощность комплекса сильно сокращена.', hasImage: false },
  { id: 'research', name: 'Региональная НИР', shortName: 'Н', cost: 70, cellRef: 'J1', position: 'corner-top-right', customStyle: { top: '85px', left: '-118px' }, description: 'Выполнены: концептуальное геологическое моделирование, сейсмогеологическое моделирование, бассейновое моделирование, оценка ресурсов. Карта плотности ресурсов углеводородов (тысяч тонн условного топлива на квадратный километр): 10-50, 5-10, менее 5.', hasImage: true, imagePath: RegNirSvg },
  { id: 'quarry', name: 'Карьер', shortName: 'К', cost: 20, cellRef: 'F1', position: 'left', customStyle: { top: '0', left: '-130px' }, description: 'Горные породы: известняки и доломиты массивные, химически чистые, органогенные, кавернозно-трещиноватые. Тип: разрабатываемый содовый карьер.', hasImage: false },
  { id: 'outcrop', name: 'Обнажение', shortName: 'О', cost: 10, cellRef: 'D1', position: 'left', customStyle: { top: '0', left: '-130px' }, description: 'Горные породы: ритмично-слоистые светло-серые известняки и доломиты с микробиальными биотермами до 10 м толщиной. Встречаются поры, каверны и трещины с запахом углеводородов.', hasImage: false },
];

// Лёгкие дефолты карточек ЛУ для редактора в админке (без позиций/стилей —
// они фиксированы и не настраиваются). `image` — пользовательская картинка
// (override, по умолчанию null). `defaultImage` — бандловая картинка по умолчанию
// (напр. карта НИР) только для показа миниатюры в админке; не сохраняется в конфиг.
export const DEFAULT_LU_CARDS = DEFAULT_LICENSE_UNITS.map(({ id, name, shortName, cost, description, hasImage, imagePath }) => ({
  id, name, shortName, cost, description, image: null,
  defaultImage: hasImage ? imagePath : null,
}));

// Мёрж пользовательских настроек карточек (из sessionConfig.luCards) на дефолты.
// Меняются только name/cost/description/image; позиция, буква и ячейка — из дефолтов.
export function resolveLicenseUnits(luCards) {
  if (!Array.isArray(luCards) || luCards.length === 0) return DEFAULT_LICENSE_UNITS;
  const byId = Object.fromEntries(luCards.map(c => [c.id, c]));
  return DEFAULT_LICENSE_UNITS.map(def => {
    const o = byId[def.id];
    if (!o) return def;
    return {
      ...def,
      name: o.name ?? def.name,
      cost: o.cost ?? def.cost,
      description: def.id === 'research' && typeof o.description === 'string'
        ? o.description
            .replace('космогеологическое моделирование', 'концептуальное геологическое моделирование')
            .replace('структурно-генетическое моделирование', 'сейсмогеологическое моделирование')
        : o.description ?? def.description,
      ...(o.image ? { hasImage: true, imagePath: o.image } : {}),
    };
  });
}
