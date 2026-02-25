// Ща будет дудос полный :) Распиши всё
// Полные данные карточек полевых работ.
//
// Связь с ResearchPanel:
//   Каждый блок привязан к мобилизованному столбцу из researchData.js.
//   Блок доступен только если в ResearchPanel для этого ЛУ столбец мобилизован И success > 0.
//
// Структура блока:
//   blockId        уникальный ID блока
//   mobWorkId      ID столбца мобилизации из researchData (ключ связи)
//   groupColor     цвет группы: 'gray' | 'orange' | 'beige' | 'blue'
//   title          название блока (отображается как заголовок)
//   cards          массив карточек внутри блока.
//                    Каждая карточка имеет несколько вариантов (options) по рангам.
//                    Команда выбирает ОДИН вариант из каждой карточки.
//
// Ранг:  1 = лучший параметр, самый дорогой
//        2 = средний
//        3 = базовый / бесплатный (там где есть)

export const FIELD_WORK_BLOCKS = [


  {
    blockId: 'block_srr_2d',
    mobWorkId: 'srr_2d',
    groupColor: 'gray',
    title: 'СРР 2D',
    cards: [
      {
        cardId: 'srr2d_shag_pp',
        cardTitle: 'Шаг ПП',
        options: [
          { rank: 1, param: '12,5 м',  cost: 500 },
          { rank: 2, param: '25 м',    cost: 400 }
        ]
      },
      {
        cardId: 'srr2d_udaleniya',
        cardTitle: 'Удаления',
        options: [
          { rank: 1, param: '3 км',  cost: 200 },
          { rank: 2, param: '5 км',  cost: 100 }
        ]
      }
    ]
  },


  {
    blockId: 'block_srr_3d',
    mobWorkId: 'srr_3d',
    groupColor: 'gray',
    title: 'СРР 3D',
    cards: [
      {
        cardId: 'srr3d_azimut',
        cardTitle: 'Азимутальность',
        options: [
          { rank: 1, param: 'Полноазимутальная', cost: 350 },
          { rank: 2, param: 'Узкоазимутальная',  cost: 250 }
        ]
      },
      {
        cardId: 'srr3d_setka',
        cardTitle: 'Сетка профилей',
        options: [
          { rank: 1, param: '200м × 200м', cost: 600 },
          { rank: 2, param: '300м × 300м', cost: 400 }
        ]
      },
      {
        cardId: 'srr3d_kratnost',
        cardTitle: 'Кратность',
        options: [
          { rank: 1, param: 'Более 300',  cost: 600 },
          { rank: 2, param: '150–300',     cost: 350 }
        ]
      }
    ]
  },

  {
    blockId: 'block_1pr',
    mobWorkId: '1pr',
    groupColor: 'orange',
    title: 'Поисково-разведочное бурение',
    cards: [
      {
        cardId: '1pr_ispytaniya',
        cardTitle: 'Испытания',
        options: [
          { rank: 1, param: 'ИПТ, MDT, перфорация',  cost: 70 },
          { rank: 2, param: 'MDT, перфорация',        cost: 50 },
          { rank: 3, param: 'ИПТ, перфорация',        cost: 10 }
        ]
      },
      {
        cardId: '1pr_gis',
        cardTitle: 'Комплекс ГИС',
        options: [
          { rank: 1, param: 'НК, АК, ГК, УЭС, КВ, ГГКП, ЛП, ЯМК, ИНГКС, FMI, АКШ (SS)', cost: 75 },
          { rank: 2, param: 'НК, АК, ГК, УЭС, КВ, ГГКП, ЛП, ЯМК, ИНГКС',                 cost: 50 },
          { rank: 3, param: 'НК, АК, ГК, УЭС, КВ, ГГКП, ЛП, ЯМК',                         cost: 25 }
        ]
      },
      {
        cardId: '1pr_kern',
        cardTitle: 'Отбор керна',
        options: [
          { rank: 1, param: 'Алюминиевая труба half-moon, антизаклиночная система, 9 м за рейс',  cost: 30 },
          { rank: 2, param: 'Стеклопластиковая труба, антизаклиночная система, 18 м за рейс',     cost: 20 },
          { rank: 3, param: 'Стеклопластиковая труба, 27 м за рейс',                              cost: 10 }
        ]
      }
    ]
  },

  {
    blockId: 'block_gs',
    mobWorkId: '2pr',
    groupColor: 'beige',
    title: 'Горизонтальные скважины (ГС)',
    cards: [
      {
        cardId: 'gs_traektoria',
        cardTitle: 'Траектория',
        options: [
          { rank: 1, param: 'Угол ствола м/у Т1 и Т3 — 90°', cost: 30 },
          { rank: 2, param: 'Угол ствола м/у Т1 и Т3 — 75°', cost: 20 },
          { rank: 3, param: 'Угол ствола м/у Т1 и Т3 — 60°', cost: 10 }
        ]
      },
      {
        cardId: 'gs_dlina',
        cardTitle: 'Длина ГС',
        options: [
          { rank: 1, param: '1300 м', cost: 140 },
          { rank: 2, param: '1000 м', cost: 120 },
          { rank: 3, param: '700 м',  cost: 100 }
        ]
      },
      {
        cardId: 'gs_issledovaniya',
        cardTitle: 'Исследования',
        options: [
          { rank: 1, param: 'LWD, микроимиджер, ГДИС', cost: 30 },
          { rank: 2, param: 'LWD, микроимиджер',       cost: 25 },
          { rank: 3, param: 'Комплекс LWD',            cost: 10 }
        ]
      }
    ]
  },


  {
    blockId: 'block_gs_mgrp',
    mobWorkId: 'drilling_5gs',
    groupColor: 'beige',
    title: 'ГС с МГРП',
    cards: [
      {
        cardId: 'mgrp_podryadchik',
        cardTitle: 'Подрядчик',
        options: [
          { rank: 1, param: 'Зарубежный лицензиар технологии',          cost: 50 },
          { rank: 2, param: 'Российский подрядчик (зарубежное обор.)',   cost: 30 },
          { rank: 3, param: 'Российский вендор',                         cost: 0  }
        ]
      },
      {
        cardId: 'mgrp_dlina',
        cardTitle: 'Длина ГС',
        options: [
          { rank: 1, param: '1300 м', cost: 140 },
          { rank: 2, param: '1000 м', cost: 120 },
          { rank: 3, param: '700 м',  cost: 100 }
        ]
      },
      {
        cardId: 'mgrp_propant',
        cardTitle: 'Масса пропанта',
        options: [
          { rank: 1, param: '60 т на стадию', cost: 60 },
          { rank: 2, param: '50 т на стадию', cost: 50 },
          { rank: 3, param: '40 т на стадию', cost: 40 }
        ]
      }
    ]
  },

  {
    blockId: 'block_mzs',
    mobWorkId: 'drilling_6gs',
    groupColor: 'beige',
    title: 'Многозабойные скважины (МЗС)',
    cards: [
      {
        cardId: 'mzs_dlina_otv',
        cardTitle: 'Длина ответвления',
        options: [
          { rank: 1, param: '700 м', cost: 60 },
          { rank: 2, param: '500 м', cost: 30 },
          { rank: 3, param: '300 м', cost: 0  }
        ]
      },
      {
        cardId: 'mzs_podryadchik',
        cardTitle: 'Подрядчик',
        options: [
          { rank: 1, param: 'Зарубежный лицензиар технологии',        cost: 50 },
          { rank: 2, param: 'Российский подрядчик (зарубежное обор.)', cost: 30 },
          { rank: 3, param: 'Российский вендор',                       cost: 0  }
        ]
      },
      {
        cardId: 'mzs_kol_stvolv',
        cardTitle: 'Кол-во стволов',
        options: [
          { rank: 1, param: '5 стволов', cost: 240 },
          { rank: 2, param: '4 ствола',  cost: 210 },
          { rank: 3, param: '3 ствола',  cost: 190 }
        ]
      }
    ]
  },

  {
    blockId: 'block_mun',
    mobWorkId: 'mun',
    groupColor: 'beige',
    title: 'МУН (газовые / химические)',
    cards: [
      {
        cardId: 'mun_gaz',
        cardTitle: 'Процент газа',
        options: [
          { rank: 1, param: 'ВГВ (одновременная закачка) — 40 % газа', cost: 2100 },
          { rank: 2, param: 'ВГВ (одновременная закачка) — 20 % газа', cost: 1800 },
          { rank: 3, param: 'Без газовых МУН',                         cost: 0    }
        ]
      },
      {
        cardId: 'mun_himiya',
        cardTitle: 'Химия',
        options: [
          { rank: 1, param: 'Полимерное заводнение', cost: 600 },
          { rank: 2, param: 'Smart-water',           cost: 200 },
          { rank: 3, param: 'Без химических МУН',    cost: 0   }
        ]
      },
      {
        cardId: 'mun_masshtab',
        cardTitle: 'Масштабность',
        options: [
          { rank: 1, param: 'CO₂ (полномасштабное внедрение)',             cost: 2300 },
          { rank: 2, param: 'CO₂ (закачка на отдельном участке)',          cost: 2000 },
          { rank: 3, param: 'CO₂ (huff & puff) на 10 % фонда',           cost: 200  }
        ]
      }
    ]
  },

  {
    blockId: 'block_ppd',
    mobWorkId: 'ppd',
    groupColor: 'beige',
    title: 'Регулярная система ППД водой',
    cards: [
      {
        cardId: 'ppd_sistema',
        cardTitle: 'Система разработки',
        options: [
          { rank: 1, param: 'Очаговая система с учётом естественных трещин', cost: 130 },
          { rank: 2, param: 'Площадная система',                             cost: 100 },
          { rank: 3, param: 'Без регулярной системы ППД',                    cost: 0   }
        ]
      },
      {
        cardId: 'ppd_voda',
        cardTitle: 'Вода для ППД',
        options: [
          { rank: 1, param: 'С подбором хим. состава и очисткой от мех. примесей', cost: 100 },
          { rank: 2, param: 'Подготовленная вода',                                  cost: 30  },
          { rank: 3, param: 'Вода из водозаборных скважин',                        cost: 0   }
        ]
      }
    ]
  },

  {
    blockId: 'block_depression',
    mobWorkId: 'depression',
    groupColor: 'blue',
    title: 'Бурение на депрессии',
    cards: [
      {
        cardId: 'depr_fond',
        cardTitle: 'Процент фонда',
        options: [
          { rank: 1, param: '50 % фонда в зонах с подозрением на трещиноватость',      cost: 500 },
          { rank: 2, param: '20 % наиболее рискового фонда в зонах трещиноватости',     cost: 300 },
          { rank: 3, param: 'Без бурения на депрессии',                                 cost: 0   }
        ]
      },
      {
        cardId: 'depr_mehanizm',
        cardTitle: 'Механизм закачки',
        options: [
          { rank: 1, param: 'Бурение с промывкой буровым раствором',                    cost: 70 },
          { rank: 2, param: 'Закачка в микрокольцевую зону или нагнетательную колонну', cost: 50 },
          { rank: 3, param: 'Закачка через стояк',                                      cost: 30 }
        ]
      },
      {
        cardId: 'depr_podryadchik',
        cardTitle: 'Уровень подрядчика',
        options: [
          { rank: 1, param: 'Зарубежный лицензиар технологии',                    cost: 50 },
          { rank: 2, param: 'Российский подрядчик с зарубежным оборудованием',    cost: 30 },
          { rank: 3, param: 'Российский вендор',                                  cost: 0  }
        ]
      }
    ]
  },

  {
    blockId: 'block_perv_ppd',
    mobWorkId: 'bsko',
    groupColor: 'blue',
    title: 'Адресный перевод в ППД',
    cards: [
      {
        cardId: 'pervppd_kriteriy',
        cardTitle: 'Критерий перевода',
        options: [
          { rank: 1, param: 'Перевод с учётом системы естественных трещин',   cost: 50 },
          { rank: 2, param: 'Перевод в зоне потерь по пластовому давлению',   cost: 30 },
          { rank: 3, param: 'Перевод скважин отработавших запасы',            cost: 10 }
        ]
      },
      {
        cardId: 'pervppd_tipy',
        cardTitle: 'Типы скважин к переводу',
        options: [
          { rank: 1, param: 'Перевод ГС скважин с учётом давления раскрытия трещин',          cost: 30 },
          { rank: 2, param: 'Перевод ВС и ННС с учётом давления раскрытия трещин',            cost: 15 },
          { rank: 3, param: 'Перевод скважин любой конструкции для обеспечения компенсации',  cost: 10 }
        ]
      }
    ]
  },

  {
    blockId: 'block_zbs',
    mobWorkId: '3bs',
    groupColor: 'blue',
    title: 'Зарезка боковых стволов (ЗБС)',
    cards: [
      {
        cardId: 'zbs_otkhod',
        cardTitle: 'Отход ЗБС от основного ствола',
        options: [
          { rank: 1, param: '600 м', cost: 300 },
          { rank: 2, param: '400 м', cost: 250 },
          { rank: 3, param: '200 м', cost: 200 }
        ]
      },
      {
        cardId: 'zbs_ugol',
        cardTitle: 'Угол входа ЗБС в пласт',
        options: [
          { rank: 1, param: '75–90°',  cost: 30 },
          { rank: 2, param: '50–75°',  cost: 20 },
          { rank: 3, param: 'до 50°',  cost: 10 }
        ]
      }
    ]
  }
];

/**
 * Получить доступные блоки для конкретного ЛУ.
 *
 * Правила:
 *   1. eventsScore < 0  → пустой массив (провал, ничего не выкладывается)
 *   2. Иначе            → блоки, у которых столбец мобилизован в ResearchPanel
 *
 * @param {Object} researchProgress — progress из store: research.progressByLU[luId]
 *     { mobilizedColumns: ['srr_2d', '1pr', ...], successRates: {...} }
 * @param {number} eventsScore      — счёт из events.lineScores[luId]
 * @returns {Array} доступные блоки
 */
export const getAvailableBlocks = (researchProgress, eventsScore = 0) => {

  if (eventsScore < 0) return [];

  if (!researchProgress) return [];

  const mobilized = researchProgress.mobilizedColumns || [];

  return FIELD_WORK_BLOCKS.filter(block => mobilized.includes(block.mobWorkId));
};

/**
 * Рассчитать суммарную стоимость выбранных вариантов
 * @param {Object} selections — { cardId: optionRank, ... }
 * @param {Array}  blocks     — доступные блоки
 * @returns {number} суммарная стоимость
 */
export const calculateTotalCost = (selections, blocks) => {
  let total = 0;
  blocks.forEach(block => {
    block.cards.forEach(card => {
      const chosenRank = selections[card.cardId];
      if (chosenRank != null) {
        const option = card.options.find(o => o.rank === chosenRank);
        if (option) total += option.cost;
      }
    });
  });
  return total;
};

/**
 * Рассчитать quality-score (условный показатель качества)
 * для отправки на этап "Результаты".
 * Формула: среднее арифметическое (4 - rank) по всем карточкам.
 * Ранг 1 → 3 очка, ранг 2 → 2 очка, ранг 3 → 1 очко.
 * Итог нормируется в диапазон 0..100.
 *
 * @param {Object} selections — { cardId: optionRank, ... }
 * @param {Array}  blocks     — доступные блоки
 * @returns {number} 0..100
 */
export const calculateQualityScore = (selections, blocks) => {
  let totalPoints = 0;
  let cardCount = 0;

  blocks.forEach(block => {
    block.cards.forEach(card => {
      const chosenRank = selections[card.cardId];
      if (chosenRank != null) {
        totalPoints += (4 - chosenRank); 
        cardCount++;
      }
    });
  });

  if (cardCount === 0) return 0;
  return Math.round((totalPoints / (cardCount * 3)) * 100);
};

/**
 * Подготовить данные для backend API
 */
export const prepareFieldWorkForAPI = (teamId, luId, selections, blocks) => {
  const details = [];

  blocks.forEach(block => {
    block.cards.forEach(card => {
      const chosenRank = selections[card.cardId];
      if (chosenRank != null) {
        const option = card.options.find(o => o.rank === chosenRank);
        details.push({
          blockId: block.blockId,
          blockTitle: block.title,
          mobWorkId: block.mobWorkId,
          cardId: card.cardId,
          cardTitle: card.cardTitle,
          chosenRank,
          chosenParam: option?.param || '',
          cost: option?.cost || 0
        });
      }
    });
  });

  return {
    teamId,
    luId,
    selections: details,
    totalCost: calculateTotalCost(selections, blocks),
    qualityScore: calculateQualityScore(selections, blocks),
    savedAt: new Date().toISOString()
  };
};