// Тут надо поправить
export const CARD_TYPES = {
  OPPORTUNITY: 'opportunity',
  RISK: 'risk',
  RANDOM: 'random'
};

const opportunityImages = import.meta.glob(
  '/src/assets/cards/opportunity/*.{jpg,png}',
  { eager: true, import: 'default' }
);
const opportunityImg = (n) =>
  opportunityImages[`/src/assets/cards/opportunity/Card${n}.jpg`] ??
  opportunityImages[`/src/assets/cards/opportunity/Card${n}.png`] ??
  null;

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


export const OPPORTUNITY_QUESTIONS = [
  {
    id: 'oq1',
    image: opportunityImg(1),
    question: "Какой тип складок характерен для передовых частей складчато-надвиговых поясов?",
    options: ["Линейные","Брахиформные","Мульды","Купола"],
    correctAnswer: 0,
    points: 2,
  },
  {
    id: 'oq2',
    image: opportunityImg(2),
    question: "Как определитть направление перемещения блоков горных пород по разлому в полевых условиях?",
    options: ["по направлению борозд на поверхности разлома (по зеркалу скольжения)","невозможно определить в полевых условиях","по составу вещества, заполняющего разлом","по амплитуде смещения"],
    correctAnswer: 0,
    points: 1,
  },
  {
    id: 'oq3',
    image: opportunityImg(3),
    question: "Как расположено максимальное напряжение по отношению к осям складки в структурах сжатия",
    options: ["Параллельно короткой оси складки","Параллельно длинной оси складки","По биссектрисе между длинной и короткой осями складки","Невозможно определить направление максимального напряжения по осям складки"],
    correctAnswer: 0,
    points: 2,
  },
  {
    id: 'oq4',
    image: opportunityImg(4),
    question: "Чем может быть представлено пустотное пространство к карбонатных коллекторах?",
    options: ["трещины","каверны","поры","все варианты"],
    correctAnswer: 3,
    points: 1,
  },
  {
    id: 'oq5',
    image: opportunityImg(5),
    question: "Как влияют тектонические процессы на проницаемость флюидоупора?",
    options: ["никак","улучшают их флюидоупорные свойства","до конца неизвестно, на сегодняшний день","зависит от минералогического состава флюидоупора и количества примесей"],
    correctAnswer: 3,
    points: 2,
  },
  {
    id: 'oq7',
    image: opportunityImg(7),
    question: "Максимальная зона открытой тектонической трещиноватости в линейных складках развивается в области?",
    options: ["на крыльях складки","в замке антиклинальнй складки","в медианной части крыльев складки","в синклинальной части складки"],
    correctAnswer: 1,
    points: 1,
  },
  {
    id: 'oq8',
    image: opportunityImg(8),
    question: "Как называются трещины, которые формируются в условиях сдвиго-растяжения, часто заполненны кальцитом?",
    options: ["трещины скола","трещины отрыва","сколы Риделя","Стилолиты"],
    correctAnswer: 2,
    points: 2,
  },
  {
    id: 'oq9',
    image: opportunityImg(9),
    question: "Как называются трещины, которые формируются в условиях сжатия и приводят к растворению карбонатного вещества?",
    options: ["трещины скола","трещины отрыва","сколы Риделя","Стилолиты"],
    correctAnswer: 3,
    points: 1,
  },
  {
    id: 'oq10',
    image: opportunityImg(10),
    question: "Какими породами представлены продуктивные отложения доюрского комплекса Фестивального месторождения?",
    options: ["метаморфические и карбонатные","магматические, метаморфические и карбонатные","магматические и карбонатные","карбонатные и терригенные"],
    correctAnswer: 1,
    points: 3,
  },
  {
    id: 'oq11',
    image: opportunityImg(11),
    question: "Определите территориальное расположение Чузикско-Чижапской зоны, там где целенаправленно велись поиски УВ в фундаменте",
    options: ["ЯНАО","Свердловская область","Омская область","Томская область"],
    correctAnswer: 3,
    points: 2,
  },
  {
    id: 'oq12',
    image: opportunityImg(12),
    question: "Территория России покрыта сетью исследований потенциальных полей.  Какой масштаб съемки использовался?",
    options: ["исследованиями масштаба 1:50000","исследованиями масштаба 1:200000","исследованиями масштаба 1:25000","исследованиями масштаба 1:100000"],
    correctAnswer: 1,
    points: 2,
  },
  {
    id: 'oq13',
    image: opportunityImg(13),
    question: "Какой объем запасов нефти и газа отмечено в карбонатах по разным оценкам в мире?",
    options: ["до 20%","20%-40%","40%-60%","60%-75%"],
    correctAnswer: 2,
    points: 2,
  },
  {
    id: 'oq14',
    image: opportunityImg(14),
    question: "Дополните определение \"Дилатансионный эффект связывается….\"",
    options: ["с раскрытием трещин и заполнением флюидами. В режиме компакции флюиды выжимаются из фундамента и перемещаются в сторону меньших давлений, в верхние горизонты земной коры и не исключено, что флюиды могут двигаться вниз.","с закрытием трещин и выжиманием флюида.  В режиме компакции флюиды выжимаются из фундамента.","с перераспределением трещин и заполнением флюидами. В режиме компакции флюиды выжимаются из фундамента и перемещаются только в сторону меньших давлений, в верхние горизонты земной коры.","с заполнение трещин пластовой водой. В режиме компакции флюиды  могут двигаться вниз."],
    correctAnswer: 0,
    points: 3,
  },
  {
    id: 'oq16',
    image: opportunityImg(16),
    question: "Что позволяет прогнозировать на региональном этапе концептуальная модель карбонатной платформы?",
    options: ["На региональном этапе модель карбонатной платформы не имеет значения","Только зоны распространения НГМТ","Только зоны развития коллекторов","Зоны распространения коллекторов и НГМТ"],
    correctAnswer: 3,
    points: 2,
  },
  {
    id: 'oq18',
    image: opportunityImg(18),
    question: "Какой структурный тип карбонатных пород будет иметь наилучшие ФЕС в седиментационном типе резервуара?",
    options: ["Пакстоуны","Мадстоуны","Грейнстоуны","Вакстоуны"],
    correctAnswer: 2,
    points: 2,
  },
  {
    id: 'oq24',
    image: opportunityImg(24),
    question: "Какой тип микротрещины изображен на фотографии шлифа известняка?",
    options: ["Строматолитовая","Стилолитовая","Тектоническая","Литогенетическая диагенетическая"],
    correctAnswer: 1,
    points: 1,
  },
  {
    id: 'oq25',
    image: opportunityImg(25),
    question: "Отложения, представленные на фотографиях керна это",
    options: ["Известняки зернистые (грейнстоуны), зона отмелей края карбонатной платформы","Известняки коралловые (баундстоуны) с крустификационными кальцитовыми цементами, зона рифового склона","Известняки микрокристаллические (мадстоуны), зона забарьерной лагуны","Известняки биокластовые разнозернистые, фациальная зона мелководной сублиторали открытого шельфа"],
    correctAnswer: 1,
    points: 3,
  },
  {
    id: 'oq27',
    image: opportunityImg(27),
    question: "При каких условиях интенсивно поступающий в морской бассейн терригенный материал подавляет карбонатную седиментацию в жарком климате?",
    options: ["В районах с прилегающей гористой местностью","В условиях эвапоритового бассейна","При наличии сильных вдольбереговых течений","При доминировании эолового привноса"],
    correctAnswer: 0,
    points: 1,
  },
  {
    id: 'oq40',
    image: opportunityImg(40),
    question: "В результате какого вторичного процесса образовались поры (фото шлифа известняка)?",
    options: ["Перекристаллизация","Доломитизация","Сульфатизация","Выщелачивание"],
    correctAnswer: 3,
    points: 2,
  },
  {
    id: 'oq42',
    image: opportunityImg(42),
    question: "Что выделяется на изображении микросканера известняка?",
    options: ["Каверна","Конкреция","Технический дефект","Поперечный срез канала"],
    correctAnswer: 1,
    points: 2,
  },
  {
    id: 'oq44',
    image: opportunityImg(44),
    question: "Я могу проинтерпретировать отложения, представленные на фотографиях керна как...",
    options: ["Известняки микритовые (микрокристаллические) лагуны с нарушенной соленостью","Известняки кораллово-строматопоровые с микритовым цементом (флаутстоуны) фациальной зоны среднего рампа","Доломиты сульфатизированные, фациальная зона супралиторали","Известняки глинистые микрокристаллические, обогащенные Сорг, фациальная зона внутришельфовой впадины"],
    correctAnswer: 1,
    points: 3,
  },
  {
    id: 'oq45',
    image: opportunityImg(45),
    question: "Для какого системного тракта/трактов карбонатной платформы характерно развитие  обширной карстовой равнины (в условиях гумидного климата)?",
    options: ["Для тракта высокого стояния уровня моря - HST","Для трактов падения и низкого стояния уровня моря - FSST и LST","Для трансгрессивного системного тракта  - TST","Для трактов высокого стояния и падения уровня моря - HST и FSST"],
    correctAnswer: 1,
    points: 2,
  },
  {
    id: 'oq46',
    image: opportunityImg(46),
    question: "В секвенции окаймленной карбонатной платформы рифовые системы барьерного типа достигают максимального развития в … (завершите фразу)",
    options: ["В ходе формирования тракта низкого стояния - LST","В ходе формирования трансгрессивного системного тракта - TST","В ходе формирования тракта падения уровня моря - FSST","В ходе формирования тракта высокого стояния - HST"],
    correctAnswer: 3,
    points: 2,
  },
  {
    id: 'oq47',
    image: opportunityImg(47),
    question: "Какой этап формирования осадочной секвенции наиболее значим для образования вторичной пористости в нижележащей (предшествующей) карбонатной секвенции ?",
    options: ["Этап формирования тракта низкого стояния уровня моря - LST","Этап формирования тракта высокого стояния уровня моря - HST","Этап формирования трансгрессивного системного тракта - TST","Для формирования вторичной пористости в предшествующей карбонатной секвенции разные стадии развития новой секвенции не имеют значения."],
    correctAnswer: 0,
    points: 3,
  },
  {
    id: 'oq55',
    image: opportunityImg(55),
    question: "Сколько групп трещин можно выделить на рисунке?",
    options: ["четыре","одну","две","более 6"],
    correctAnswer: 2,
    points: 1,
  }
];

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


export const generateEventLine = (successRate, excludeIds = new Set(), playerType = 'student') => {
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
    // Студенты: всегда сложность 1, с вероятностью 50% добавляется сложность 2
    const d1 = OPPORTUNITY_QUESTIONS.filter(q => q.points === 1);
    const d2 = OPPORTUNITY_QUESTIONS.filter(q => q.points === 2).filter(() => Math.random() < 0.5);
    difficultyPool = [...d1, ...d2];
    if (difficultyPool.length === 0) difficultyPool = d1.length > 0 ? d1 : OPPORTUNITY_QUESTIONS;
  }

  // Строго только уникальные — без fallback на весь пул (карточки не повторяются за всю сессию)
  const filteredQ = difficultyPool.filter(q => !excludeIds.has(q.id));
  const shuffledQ = [...filteredQ].sort(() => Math.random() - 0.5);
  const actualOpportunityCount = Math.min(opportunityCount, shuffledQ.length);
  for (let i = 0; i < actualOpportunityCount; i++) {
    cards.push({ type: CARD_TYPES.OPPORTUNITY, position: i, data: shuffledQ[i] });
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