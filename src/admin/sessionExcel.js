const MONEY_FORMAT = '#,##0.##';
const PERCENT_FORMAT = '0.0"%"';
const DATE_FORMAT = 'dd.mm.yyyy hh:mm';

const SPEND_LABELS = {
  lu_card: 'Карточки участков',
  auction: 'Аукцион',
  research: 'Исследования',
  fieldwork: 'Полевые работы',
  events: 'События',
  pipeline: 'Нефтепровод',
  other: 'Прочее',
};

const STATUS_LABELS = { waiting: 'Ожидает начала', active: 'Идёт', finished: 'Завершена' };
const BLUE = '#1E3A5F';
const LIGHT = '#EFF6FF';

const number = value => {
  if (value == null || value === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};

const money = value => {
  const valueNumber = number(value);
  return valueNumber == null ? null : { value: valueNumber, format: MONEY_FORMAT };
};

const percent = value => {
  const valueNumber = number(value);
  return valueNumber == null ? null : { value: valueNumber, format: PERCENT_FORMAT };
};

const date = value => {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  const parsed = Number.isFinite(numeric)
    ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : { value: parsed, format: DATE_FORMAT };
};

const memberName = member => typeof member === 'string'
  ? member : (member?.name || member?.fullName || '');

const membersOf = team => Array.isArray(team.members) ? team.members : [];

const cell = (input, index) => {
  if (input == null) return null;
  const value = typeof input === 'object' && !(input instanceof Date) && 'value' in input
    ? input : { value: input };
  return { backgroundColor: index % 2 ? LIGHT : '#FFFFFF', wrap: true, height: 25,
    ...(typeof value.value === 'string' ? { type: String, format: '@' } : {}), ...value };
};

const header = value => ({ value, fontWeight: 'bold', textColor: '#FFFFFF',
  backgroundColor: BLUE, wrap: true, height: 36, alignVertical: 'center' });

const tableData = (headings, rows) => [
  headings.map(header),
  ...rows.map((row, index) => row.map(value => cell(value, index))),
];

const sheet = (name, headings, rows, widths) => ({
  sheet: name,
  data: tableData(headings, rows),
  columns: widths.map(width => ({ width })),
  stickyRowsCount: 1,
  showGridLines: false,
});

export function buildSessionExcelSheets(report, session, generatedAt = new Date()) {
  if (!report || !Array.isArray(report.teams) || !report.sessionId) {
    throw new Error('Не удалось получить данные выбранной сессии');
  }
  if (session?.id && session.id !== report.sessionId) {
    throw new Error('Данные отчёта не соответствуют выбранной сессии');
  }

  const teams = [...report.teams].sort((a, b) =>
    (number(b.totalPoints) ?? 0) - (number(a.totalPoints) ?? 0)
    || String(a.teamName).localeCompare(String(b.teamName), 'ru'));
  const ranks = new Map();
  teams.forEach((team, index) => {
    const previous = teams[index - 1];
    ranks.set(team.teamId, previous && team.totalPoints === previous.totalPoints
      ? ranks.get(previous.teamId) : index + 1);
  });

  const summaryRows = teams.map(team => [
    ranks.get(team.teamId), team.teamName, membersOf(team).length,
    money(team.initialBudget), money(team.finalBudget), money(team.budgetSpent),
    money(team.totalIncome), team.cellsCount ?? team.cells?.length ?? 0,
    money(team.totalROI), team.metrics?.answerAccuracy?.correct ?? 0,
    team.metrics?.answerAccuracy?.answered ?? 0,
    percent(team.metrics?.answerAccuracy?.value), team.totalPoints ?? 0,
  ]);
  const summaryHeaders = [
    'Место', 'Команда', 'Участников', 'Начальный бюджет, млн ₽',
    'Остаток, млн ₽', 'Потрачено, млн ₽', 'Доходы, млн ₽',
    'Участков', 'ROI', 'Верных ответов', 'Ответов всего', 'Точность ответов', 'Очки рейтинга',
  ];
  const summaryTable = tableData(summaryHeaders, summaryRows);
  const title = { value: `Отчёт по сессии ${report.sessionCode || session?.code || ''}`,
    columnSpan: summaryHeaders.length, fontWeight: 'bold', fontSize: 16,
    textColor: '#FFFFFF', backgroundColor: BLUE, height: 38 };
  const section = { value: 'Итоги команд', columnSpan: summaryHeaders.length,
    fontWeight: 'bold', textColor: BLUE, backgroundColor: LIGHT, height: 28 };
  const blank = Array(summaryHeaders.length).fill(null);
  const summary = {
    sheet: 'Сводка',
    data: [
      [title, ...blank.slice(1)],
      ['Код сессии', report.sessionCode || session?.code || '', 'Статус',
        STATUS_LABELS[session?.status] || session?.status || '—'],
      ['Создана', date(session?.created_at), 'Выгружена', { value: generatedAt, format: DATE_FORMAT }],
      ['Команд', teams.length, 'Участников', teams.reduce((sum, team) => sum + membersOf(team).length, 0)],
      blank,
      [section, ...blank.slice(1)],
      ...summaryTable,
    ],
    columns: [9, 25, 16, 23, 21, 21, 20, 12, 16, 17, 17, 19, 18].map(width => ({ width })),
    stickyRowsCount: 7,
    showGridLines: false,
  };

  const participants = teams.flatMap(team => membersOf(team).map((member, index) => [
    team.teamName, index + 1, memberName(member), typeof member === 'string' ? '' : member.role || '',
  ]));

  const rating = teams.map(team => [
    ranks.get(team.teamId), team.teamName,
    money(team.metrics?.grr?.value), team.ranking?.grr?.points ?? 0,
    money(team.metrics?.stage2?.value), team.ranking?.stage2?.points ?? 0,
    money(team.metrics?.stage3?.value), team.ranking?.stage3?.points ?? 0,
    money(team.metrics?.extraCosts?.value), team.ranking?.extraCosts?.points ?? 0,
    percent(team.metrics?.answerAccuracy?.value), team.ranking?.answerAccuracy?.points ?? 0,
    team.totalPoints ?? 0,
  ]);

  const finances = teams.map(team => {
    const spent = team.spentByType || {};
    return [team.teamName, money(team.initialBudget), money(spent.lu_card),
      money(spent.auction), money(spent.research), money(spent.fieldwork),
      money(spent.events), money(spent.pipeline), money(spent.other),
      money(team.budgetSpent), money(team.totalIncome), money(team.finalBudget)];
  });

  const plots = teams.flatMap(team => (team.cells || []).map(plot => [
    team.teamName, plot.cellRef, money(plot.auctionPrice),
  ]));

  const work = teams.flatMap(team => [
    ...(team.researchByYear || []).map(item => [
      team.teamName, item.year, item.luId, 'Исследования',
      item.skipped ? 'Пропущено' : item.columnId ? 'Выбрана работа' : 'Без выбора',
      null, null,
    ]),
    ...(team.fieldworkByYear || []).map(item => [
      team.teamName, item.year, item.luId, 'Полевые работы', 'Записаны',
      money(item.totalCost), number(item.qualityScore),
    ]),
  ]).sort((a, b) => (number(a[1]) ?? 0) - (number(b[1]) ?? 0)
    || String(a[0]).localeCompare(String(b[0]), 'ru'));

  const operations = teams.flatMap(team => (team.transactions || []).map(item => [
    date(item.createdAt), team.teamName,
    SPEND_LABELS[item.type] || item.type || 'Прочее', item.description || '',
    number(item.amount) < 0 ? money(-Number(item.amount)) : null,
    number(item.amount) > 0 ? money(item.amount) : null,
  ])).sort((a, b) => (a[0]?.value?.getTime() ?? 0) - (b[0]?.value?.getTime() ?? 0));

  return [
    summary,
    sheet('Участники', ['Команда', '№', 'Участник', 'Роль'], participants, [26, 8, 34, 28]),
    sheet('Рейтинг', [
      'Место', 'Команда', 'Разведка 1–5', 'Очки', 'Работы 6–8', 'Очки',
      'Работы 9–10', 'Очки', 'Доп. расходы, млн ₽', 'Очки',
      'Точность ответов', 'Очки', 'Всего очков',
    ], rating, [9, 26, 20, 9, 19, 9, 19, 9, 22, 9, 20, 9, 15]),
    sheet('Финансы', [
      'Команда', 'Начальный бюджет', 'Карточки участков', 'Аукционы',
      'Исследования', 'Полевые работы', 'События', 'Нефтепровод',
      'Прочее', 'Всего потрачено', 'Доходы', 'Остаток',
    ], finances, [26, 20, 22, 16, 18, 20, 16, 18, 15, 20, 16, 18]),
    sheet('Участки', ['Команда', 'Участок', 'Цена аукциона, млн ₽'], plots, [26, 14, 25]),
    sheet('Работы по годам', [
      'Команда', 'Год', 'Участок', 'Этап', 'Статус', 'Расходы, млн ₽', 'Качество',
    ], work, [26, 9, 14, 21, 20, 21, 13]),
    sheet('Денежные операции', [
      'Дата', 'Команда', 'Категория', 'Описание', 'Расход, млн ₽', 'Доход, млн ₽',
    ], operations, [21, 26, 22, 60, 20, 20]),
  ];
}

export async function downloadSessionExcel(report, session) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const sheets = buildSessionExcelSheets(report, session);
  const code = String(report.sessionCode || session?.code || report.sessionId)
    .replace(/[^\p{L}\p{N}_-]/gu, '_');
  const stamp = new Date().toISOString().slice(0, 10);
  await writeExcelFile(sheets, { fontFamily: 'Arial', fontSize: 10 })
    .toFile(`Сессия_${code}_${stamp}.xlsx`);
}
