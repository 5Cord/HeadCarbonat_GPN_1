// Вопросы, добавленные через админку (вкладка «Вопросы»), хранятся в БД на
// бэкенде и подгружаются через loadCustomQuestions() — игра использует
// объединённый пул. question.json — локальный снапшот на случай недоступности
// бэка (только чтение).
import customQuestionsFile from '../question.json';
import rawOpportunityQuestions from './opportunityQuestions.json';
import { getPublicQuestions } from '../apiHelpers.js';

export const CARD_TYPES = {
  OPPORTUNITY: 'opportunity',
  RISK: 'risk',
  RANDOM: 'random'
};

const opportunityImages = import.meta.glob(
  '/src/assets/cards/opportunity/*.{jpg,png}',
  { eager: true, import: 'default' }
);
// Имя файла берётся из вопроса (например img_ask_1.png). Файла нет — карточка
// просто отрисуется без картинки.
const opportunityImg = (file) =>
  file ? (opportunityImages[`/src/assets/cards/opportunity/${file}`] ?? null) : null;

const riskImages = import.meta.glob(
  '/src/assets/cards/risk/*.jpg',
  { eager: true, import: 'default' }
);
const riskImg = (n) => riskImages[`/src/assets/cards/risk/Risk (${n}).jpg`] ?? null;

const randomImages = import.meta.glob(
  '/src/assets/cards/random/*.png',
  { eager: true, import: 'default' }
);
const randomImg = (n) => randomImages[`/src/assets/cards/random/CardRandom (${n}).png`] ?? null;


// Пул вопросов «Карточки возможности». Источник — opportunityQuestions.json
// в исходном виде (id, level, question, image, options, answer, topic), чтобы
// обновлённый файл можно было просто заменить целиком.
//
// Приведение к игровой схеме:
//   level → points (4 считаем 3-й сложностью), answer → индекс в options,
//   image → файл из assets/cards/opportunity.
// Пустые варианты в исходнике отбрасываются (вопрос остаётся с меньшим числом
// ответов). Сам вопрос пропускается, только если вариантов меньше двух или
// правильного ответа нет среди них.
const stripEscapes = (s) => String(s ?? '').replace(/\\([^A-Za-zА-Яа-я0-9\s])/g, '$1');

// Вопросы, у которых варианты ответа — картинки, а не текст. Ключ — id из JSON,
// значение — номера файлов img_ask_N(true|false).png в assets/cards/opportunity;
// (true) помечает правильный вариант. Держим здесь, а не в JSON, чтобы исходник
// заказчика можно было заменять целиком.
const IMAGE_ANSWER_QUESTIONS = {
  46: [7, 8, 9, 10],
  47: [11, 12, 13, 14],
};

const OPPORTUNITY_DIR = '/src/assets/cards/opportunity';
const optionImg = (n) =>
  opportunityImages[`${OPPORTUNITY_DIR}/img_ask_${n}(true).png`] ??
  opportunityImages[`${OPPORTUNITY_DIR}/img_ask_${n}(false).png`] ??
  null;
const isCorrectOptionImg = (n) =>
  Boolean(opportunityImages[`${OPPORTUNITY_DIR}/img_ask_${n}(true).png`]);

// Текстовые подписи нужны и с картинками: их показывают разбор линии
// («Ваш ответ: …») и мониторинг ответов в админке.
const toImageAnswerQuestion = (raw, imageNumbers) => {
  const optionImages = imageNumbers.map(optionImg);
  const correctAnswer = imageNumbers.findIndex(isCorrectOptionImg);
  if (optionImages.some(src => !src) || correctAnswer < 0) return null;
  return {
    id: `oq${raw.id}`,
    image: opportunityImg(raw.image),
    question: stripEscapes(raw.question),
    options: imageNumbers.map((_, i) => `Вариант ${i + 1}`),
    optionImages,
    correctAnswer,
    points: Math.min(3, Math.max(1, Number(raw.level) || 1)),
    topic: raw.topic || '',
  };
};

const toGameQuestion = (raw) => {
  const imageNumbers = IMAGE_ANSWER_QUESTIONS[raw.id];
  if (imageNumbers) return toImageAnswerQuestion(raw, imageNumbers);

  const options = (raw.options || []).map(stripEscapes).filter(o => o.trim());
  const correctAnswer = options.indexOf(stripEscapes(raw.answer));
  if (options.length < 2 || correctAnswer < 0) return null;
  return {
    id: `oq${raw.id}`,
    image: opportunityImg(raw.image),
    question: stripEscapes(raw.question),
    options,
    correctAnswer,
    points: Math.min(3, Math.max(1, Number(raw.level) || 1)),
    topic: raw.topic || '',
  };
};

export const BASE_OPPORTUNITY_QUESTIONS = rawOpportunityQuestions
  .map(toGameQuestion)
  .filter(Boolean);

if (import.meta.env.DEV) {
  const skipped = rawOpportunityQuestions.filter(q => !toGameQuestion(q)).map(q => q.id);
  if (skipped.length) {
    console.warn(`[Вопросы] пропущены без корректного ответа: ${skipped.join(', ')}`);
    const noTrueImage = skipped.filter(id => IMAGE_ANSWER_QUESTIONS[id]);
    if (noTrueImage.length) {
      console.warn(`[Вопросы] у ${noTrueImage.join(', ')} нет картинки с пометкой (true) в assets/cards/opportunity`);
    }
  }
}

// Добавленные через админку вопросы (game-схема: id, question, options,
// correctAnswer, points, topic, image). Поле title игра игнорирует.
// До loadCustomQuestions() здесь лежит снапшот из question.json.
export const CUSTOM_OPPORTUNITY_QUESTIONS =
  Array.isArray(customQuestionsFile?.custom) ? [...customQuestionsFile.custom] : [];

// Единый игровой пул: база (с картинками) + добавленные через админку.
// Массив мутируется на месте, чтобы модули, уже импортировавшие его,
// увидели подгруженные с бэка вопросы.
export const OPPORTUNITY_QUESTIONS = [
  ...BASE_OPPORTUNITY_QUESTIONS,
  ...CUSTOM_OPPORTUNITY_QUESTIONS,
];

let _customLoaded = false;

// Подтягивает кастомные вопросы из БД (GET /api/questions) и обновляет пул.
// При недоступном бэке остаёмся на снапшоте question.json.
export async function loadCustomQuestions() {
  if (_customLoaded) return OPPORTUNITY_QUESTIONS;
  try {
    const custom = await getPublicQuestions();
    if (Array.isArray(custom)) {
      CUSTOM_OPPORTUNITY_QUESTIONS.splice(0, CUSTOM_OPPORTUNITY_QUESTIONS.length, ...custom);
      OPPORTUNITY_QUESTIONS.splice(
        BASE_OPPORTUNITY_QUESTIONS.length,
        OPPORTUNITY_QUESTIONS.length,
        ...custom,
      );
      _customLoaded = true;
    }
  } catch {
    // бэкенд недоступен
  }
  return OPPORTUNITY_QUESTIONS;
}

export const RISK_CARDS = [
  { id: 'r1', image: riskImg(1), effect: { type: 'points', value: -2 }, description: 'Смещение сроков: подрядчик мобилизовал некомплект и старое оборудование.' },
  { id: 'r2', image: riskImg(2), effect: { type: 'points', value: -1 }, description: 'Нарушение логистики: открыли непромёрзший зимник — часть техники не дошла.' },
  { id: 'r3', image: riskImg(3), effect: { type: 'points', value: -1 }, description: 'Местные жители: коренные народы поставили чум и не пропускают технику.' },
  { id: 'r4', image: riskImg(4), effect: { type: 'points', value: -2 }, description: 'Авария: ГНВП при строительстве скважины.' },
  { id: 'r5', image: riskImg(41), effect: { type: 'points', value: -2 }, description: 'Своё видение: акционеры долго согласовывают стоимости и объёмы работ.' },
  { id: 'r6', image: riskImg(42), effect: { type: 'points', value: -1 }, description: 'Тёплая зима: требуются доп. работы по укреплению зимников.' },
  { id: 'r7', image: riskImg(43), effect: { type: 'points', value: -3 }, description: 'Срыв закупок: никто не заявился на тендер.' },
  { id: 'r8', image: riskImg(44), effect: { type: 'points', value: -1 }, description: 'Нарушение логистики: не успели завезти оборудование по зимнику.' },
  { id: 'r9', image: riskImg(45), effect: { type: 'points', value: -1 }, description: 'Задержка инвестиций: позднее инвестиционное решение затягивает начало работ.' },
  { id: 'r10', image: riskImg(36), effect: { type: 'points', value: -1 }, description: 'Торги: подрядчик завышает цены, переговоры затягиваются.' },
  { id: 'r11', image: riskImg(37), effect: { type: 'points', value: -3 }, description: 'Отбой: из Корпоративного центра пришло поручение свернуть активность.' },
  { id: 'r12', image: riskImg(38), effect: { type: 'points', value: -1 }, description: 'Дефект: обвязка "поплыла" — подрядчик делал её зимой без соблюдения технологий.' },
  { id: 'r13', image: riskImg(39), effect: { type: 'points', value: -2 }, description: 'Ждём запчасти: техника не приспособлена для условий проекта.' },
  { id: 'r14', image: riskImg(40), effect: { type: 'points', value: -1 }, description: 'Хаос в работе: нет чёткой матрицы ответственности, всё — в ручном управлении.' },
  { id: 'r15', image: riskImg(31), effect: { type: 'points', value: -1 }, description: 'Подорожание: повышение стоимости аренды земли.' },
  { id: 'r16', image: riskImg(32), effect: { type: 'points', value: -1 }, description: 'Отказ в аренде: хозяин земли отказывает в аренде.' },
  { id: 'r17', image: riskImg(33), effect: { type: 'points', value: -2 }, description: 'Простой: ожидание флота ГРП.' },
  { id: 'r18', image: riskImg(34), effect: { type: 'points', value: -3 }, description: 'ЧП: склад взрывчатых веществ не соответствует требованиям ТБ.' },
  { id: 'r19', image: riskImg(35), effect: { type: 'points', value: -1 }, description: 'Проблема с ПО: переход на отечественное ПО требует перестройки инфраструктуры.' },
  { id: 'r20', image: riskImg(26), effect: { type: 'points', value: -2 }, description: 'Испытания: осложнения при испытании скважин с АВПД после ГРП.' },
  { id: 'r21', image: riskImg(27), effect: { type: 'points', value: -2 }, description: 'Ледовое окно: позднее открытие зимника не позволяет подрядчику зайти вовремя.' },
  { id: 'r22', image: riskImg(28), effect: { type: 'points', value: -1 }, description: 'Проблемы реализации: неучтённые географические особенности удорожают проект.' },
  { id: 'r23', image: riskImg(29), effect: { type: 'points', value: -2 }, description: 'Ошибка в расчётах: данные по аналогу дали некорректный расчёт запасов.' },
  { id: 'r24', image: riskImg(30), effect: { type: 'points', value: -2 }, description: 'Высокий газовый фактор: установленное оборудование не подходит для условий.' },
  { id: 'r25', image: riskImg(21), effect: { type: 'points', value: -3 }, description: 'Финансовые риски: банкротство подрядчика.' },
  { id: 'r26', image: riskImg(22), effect: { type: 'points', value: -1 }, description: 'Авария на буровой: ожидаем приезда аварийного мастера.' },
  { id: 'r27', image: riskImg(23), effect: { type: 'points', value: -3 }, description: 'Эвакуация: вблизи площадки бушует лесной пожар.' },
  { id: 'r28', image: riskImg(24), effect: { type: 'points', value: -2 }, description: 'Раскопки: на участке найдено древнее кладбище — объект федерального значения.' },
  { id: 'r29', image: riskImg(25), effect: { type: 'points', value: -3 }, description: 'Арест имущества: судебные приставы наложили арест на оборудование подрядчика.' },
  { id: 'r30', image: riskImg(17), effect: { type: 'points', value: 0 }, description: 'Некорректные данные: в процессе работ вышли за пределы лицензионного участка.' },
  { id: 'r31', image: riskImg(18), effect: { type: 'points', value: -2 }, description: 'Конфликт (оленеводы): во время сейсморазведки на участок зашли стада оленей.' },
  { id: 'r32', image: riskImg(19), effect: { type: 'points', value: -1 }, description: 'Нет пропусков: служба безопасности не допустила подрядчиков на объект.' },
  { id: 'r33', image: riskImg(19), effect: { type: 'points', value: -1 }, description: 'Не прошли медкомиссию: подрядчики отстранены до устранения проблем со здоровьем.' },
  { id: 'r34', image: riskImg(20), effect: { type: 'points', value: -2 }, description: 'Несоответствие ТЗ: мобилизованные ресурсы не соответствуют заявленной производительности.' },
  { id: 'r35', image: riskImg(12), effect: { type: 'points', value: -3 }, description: 'Сероводород (H₂S): не завезли оборудование для работы в условиях сероводородной опасности.' },
  { id: 'r36', image: riskImg(13), effect: { type: 'points', value: 0 }, description: 'Весенняя распутица: на площадке грязь, сложности с подъездом техники.' },
  { id: 'r37', image: riskImg(14), effect: { type: 'points', value: -2 }, description: 'Проверка: на объекте работает природоохранная комиссия.' },
  { id: 'r38', image: riskImg(15), effect: { type: 'points', value: 0 }, description: 'Трудности в добыче: нефть найдена, но она высоковязкая (сложно извлекаемая).' },
  { id: 'r39', image: riskImg(16), effect: { type: 'points', value: -3 }, description: 'Авария (прорыв): прорыв трубопровода на участке.' },
  { id: 'r40', image: riskImg(7), effect: { type: 'points', value: -2 }, description: 'Несоответствие буровой: установка не прошла проверку на соответствие нормам.' },
  { id: 'r41', image: riskImg(8), effect: { type: 'points', value: -3 }, description: 'Авария на скважине: некорректная программа бурения привела к неуправляемому фонтанированию.' },
  { id: 'r42', image: riskImg(9), effect: { type: 'points', value: -1 }, description: 'Строительные риски: фундамент зданий не выдерживает низких температур.' },
  { id: 'r43', image: riskImg(10), effect: { type: 'points', value: -1 }, description: 'Поломка оборудования: неожиданная неисправность на площадке.' },
  { id: 'r44', image: riskImg(11), effect: { type: 'points', value: -2 }, description: 'Избыток продукции: объём добычи превышает пропускную способность трубопровода.' },
  { id: 'r45', image: riskImg(46), effect: { type: 'points', value: -2 }, description: 'Финансовые риски: инфляция оказалась выше прогнозной.' },
  { id: 'r46', image: riskImg(47), effect: { type: 'points', value: -3 }, description: 'Ущерб экологии: прорыв трубопровода, требуется рекультивация почвы.' },
  { id: 'r47', image: riskImg(49), effect: { type: 'points', value: -1 }, description: 'Финансовые риски: цены на углеводороды ниже прогнозных.' },
  { id: 'r48', image: riskImg(48), effect: { type: 'points', value: -1 }, description: 'Ошибка комплектации: поставленное оборудование несовместимо друг с другом.' },
  { id: 'r49', image: riskImg(5), effect: { type: 'points', value: -2 }, description: 'Сложная геология: встречены зоны поглощения, нет оборудования для проходки.' },
  { id: 'r50', image: riskImg(6), effect: { type: 'points', value: -2 }, description: 'Простой (индексация): буровой подрядчик отказывается работать без индексации оплаты.' },
];


export const RANDOM_CARDS = [
  { id: 'rnd1', image: randomImg(3), effect: { type: 'points', value: 1 }, title: 'Развитый край', description: 'Местные жители благодарят нефтяников, регион стал богаче' },
  { id: 'rnd2', image: randomImg(5), effect: { type: 'points', value: 1 }, title: 'Точность', description: 'Логистика отлажена идеально' },
  { id: 'rnd3', image: randomImg(7), effect: { type: 'points', value: 2 }, title: 'Работаем!', description: 'Налоговая льгота по проницаемости, экономика проекта растёт, согласовывают увеличение объема работ' },
  { id: 'rnd4', image: randomImg(9), effect: { type: 'money', value: 200 }, title: 'Современные технологии', description: 'Для работ по проекту применяются беспилотники, что позволяет сократить сроки работ и повысить экономическую эффективность' },
  { id: 'rnd5', image: randomImg(12), effect: { type: 'points', value: 2 }, title: 'Нашли много нефти', description: 'Объект оказался более перспективным, чем считалось ранее' },
  { id: 'rnd6', image: randomImg(4), effect: { type: 'money', value: 200 }, title: 'Прибыль', description: 'Оплата труда стала ниже, прибыль нефтяной компании' },
  { id: 'rnd7', image: randomImg(6), effect: { type: 'money', value: 200 }, title: 'Как часы', description: 'Нефтяное оборудование совместимо и работает исправно' },
  { id: 'rnd8', image: randomImg(8), effect: { type: 'money', value: 200 }, title: 'Партнерство', description: 'Передавали мероприятия ГТМщикам, т.к. их не согласовывали в рамках ГРР' },
  { id: 'rnd9', image: randomImg(10), effect: { type: 'money', value: 200 }, title: 'По рукам!', description: 'Подрядчик сделал скидку на работы' },
  { id: 'rnd10', image: randomImg(11), effect: { type: 'money', value: 200 }, title: 'Оптимизация сроков', description: 'Подрядчик усилил партию и раньше срока закончил работы' },
  { id: 'rnd11', image: randomImg(13), effect: { type: 'cancel' }, title: 'Юридический успех', description: 'Нефтяная компания выиграла суд' },
  { id: 'rnd12', image: randomImg(15), effect: { type: 'cancel' }, title: 'Успех алгоритмов', description: 'Использовали ML. Получили отличный результат' },
  { id: 'rnd13', image: randomImg(14), effect: { type: 'cancel' }, title: 'Новые методики', description: 'Удалось применить новые методические наработки и технические политики при реализации проекта' },
  { id: 'rnd14', image: randomImg(16), effect: { type: 'cancel' }, title: 'Перспективная находка', description: 'В процессе НИР найдена скважина-кандидат под проверку одного из ключевых поисковых направлений' },
  { id: 'rnd15', image: randomImg(17), effect: { type: 'money', value: -100 }, title: 'Разногласия', description: 'Согласование стоимости и объемов работ с двумя акционерами – срок согласования увеличивается' },
  { id: 'rnd16', image: randomImg(18), effect: { type: 'money', value: -100 }, title: 'Разногласия', description: 'Между службами компании возникли разногласия, которые привели к перерасходу бюджета' },
  { id: 'rnd17', image: randomImg(20), effect: { type: 'money', value: -100 }, title: 'Сложности коммуникации', description: 'Подрядчик проигнорировал команды от заказчика и выполнил работы по-своему, что привело к перерасходу бюджета' },
  { id: 'rnd18', image: randomImg(21), effect: { type: 'money', value: -100 }, title: 'Авария', description: 'Нанесен ущерб экологии' },
  { id: 'rnd19', image: randomImg(23), effect: { type: 'money', value: -100 }, title: 'Простой', description: 'При бурении выявили расформирование нефтяной оторочки, но в разрезе остались запасы газовой шапки. Инфраструктура не готова к приему газа' },
  { id: 'rnd20', image: randomImg(25), effect: { type: 'money', value: -100 }, title: 'Задержка инвестиций', description: 'Позднее принятие инвестиционного решения затягивает начало работ' },
  { id: 'rnd21', image: randomImg(26), effect: { type: 'money', value: -100 }, title: 'Торги', description: 'Подрядчик необоснованно завышает цены на полевые работы, процесс переговоров затягивает время' },
  { id: 'rnd22', image: randomImg(27), effect: { type: 'money', value: -100 }, title: 'Хаос', description: 'Во время пересменки вахт супервайзер не заехал на объект. Часть работ выполнена некачественно' },
  { id: 'rnd23', image: randomImg(28), effect: { type: 'money', value: -200 }, title: 'Авария', description: 'Неопытная команда подрядчика, ранее не работавшая с таким типом объектов, совершила критичные ошибки' },
  { id: 'rnd24', image: randomImg(29), effect: { type: 'money', value: -100 }, title: 'Сложная геология', description: 'В процессе работ столкнулись со сложностями, обусловленными геологическим строением. Требуется время и деньги для решения проблемы' },
  { id: 'rnd25', image: randomImg(19), effect: { type: 'money', value: -200 }, title: 'Сложности погоды', description: 'Погодные условия не позволяют завезти грузы по морю и рекам' },
  { id: 'rnd26', image: randomImg(30), effect: { type: 'money', value: -100 }, title: 'Проблемы с оборудованием', description: 'Техника все чаще ломается. Нашелся Кулибин, который чинит ее в полевых условиях, но это не помогает полностью' },
  { id: 'rnd27', image: randomImg(24), effect: { type: 'money', value: -100 }, title: 'Ледовое окно', description: 'Позднее открытие ледового окна в летний сезон на арктическом шельфе не позволяет подрядчику вовремя зайти на участок' },
  { id: 'rnd28', image: randomImg(31), effect: { type: 'money', value: -200 }, title: 'Проблемы с персоналом', description: 'Подрядчику не удалось сформировать команду из-за того, что весь полевой персонал ушел работать доставщиками и в др. отрасли' },
];


function pickTopicBalanced(pool, count, usedTopics) {
  if (count <= 0 || pool.length === 0) return [];

  const byTopic = {};
  pool.forEach(q => {
    const t = q.topic || 'unknown';
    if (!byTopic[t]) byTopic[t] = [];
    byTopic[t].push(q);
  });

  const sortedTopics = Object.keys(byTopic).sort(
    (a, b) => (usedTopics[a] || 0) - (usedTopics[b] || 0)
  );

  const picked = [];
  for (const topic of sortedTopics) {
    if (picked.length >= count) break;
    const candidates = [...byTopic[topic]].sort(() => Math.random() - 0.5);
    picked.push(candidates[0]);
  }

  if (picked.length < count) {
    const pickedIds = new Set(picked.map(q => q.id));
    const remaining = pool
      .filter(q => !pickedIds.has(q.id))
      .sort((a, b) => (usedTopics[a.topic] || 0) - (usedTopics[b.topic] || 0));
    for (const q of remaining) {
      if (picked.length >= count) break;
      picked.push(q);
    }
  }

  return picked.sort(() => Math.random() - 0.5);
}

export const generateEventLine = (successRate, excludeIds = new Set(), playerType = 'student', usedTopics = {}) => {
  let opportunityCount;
  if (successRate >= 60) opportunityCount = 3;
  else if (successRate >= 40) opportunityCount = 2;
  else if (successRate >= 20) opportunityCount = 1;
  else opportunityCount = 0;

  const randomCount = 1;

  const cards = [];

  // ── Фильтрация по типу игроков ────────────────────────────────────────────
  const isPro = playerType === 'professional' || playerType === 'professionals';
  let difficultyPool;
  if (isPro) {
    // Профессионалы: только сложность 2 и 3
    difficultyPool = OPPORTUNITY_QUESTIONS.filter(q => q.points >= 2);
  } else {
    // Студенты: сложность 1 и 2
    const d1 = OPPORTUNITY_QUESTIONS.filter(q => q.points === 1);
    const d2 = OPPORTUNITY_QUESTIONS.filter(q => q.points === 2);
    difficultyPool = [...d1, ...d2];
    if (difficultyPool.length === 0) difficultyPool = d1.length > 0 ? d1 : OPPORTUNITY_QUESTIONS;
  }

  // Строго только уникальные — без fallback на весь пул (карточки не повторяются за всю сессию)
  const filteredQ = difficultyPool.filter(q => !excludeIds.has(q.id));
  const actualOpportunityCount = Math.min(opportunityCount, filteredQ.length);
  const pickedQ = pickTopicBalanced(filteredQ, actualOpportunityCount, usedTopics);
  for (let i = 0; i < pickedQ.length; i++) {
    cards.push({ type: CARD_TYPES.OPPORTUNITY, position: i, data: pickedQ[i] });
  }

  const riskCount = 6 - actualOpportunityCount - randomCount;
  const filteredR = RISK_CARDS.filter(r => !excludeIds.has(r.id));
  const poolR = filteredR.length >= riskCount ? filteredR : RISK_CARDS;
  const shuffledR = [...poolR].sort(() => Math.random() - 0.5);
  for (let i = 0; i < riskCount; i++) {
    cards.push({ type: CARD_TYPES.RISK, position: actualOpportunityCount + i, data: shuffledR[i] });
  }

  const filteredRnd = RANDOM_CARDS.filter(r => !excludeIds.has(r.id));
  if (filteredRnd.length > 0) {
    const randomCard = filteredRnd[Math.floor(Math.random() * filteredRnd.length)];
    cards.push({ type: CARD_TYPES.RANDOM, position: actualOpportunityCount + riskCount, data: randomCard });
  }

  return cards.sort((a, b) => a.position - b.position);
};


export const prepareEventsDataForAPI = (teamId, luId, lineResults) => ({
  teamId,
  luId,
  results: lineResults.map(result => ({
    cardId: result.cardId,
    cardType: result.cardType,
    answered: result.answered,
    correct: result.correct,
    pointsEarned: result.pointsEarned,
    timestamp: new Date().toISOString(),
  })),
  totalScore: lineResults.reduce((sum, r) => sum + r.pointsEarned, 0),
  passedThreshold: lineResults.reduce((sum, r) => sum + r.pointsEarned, 0) > 0,
});