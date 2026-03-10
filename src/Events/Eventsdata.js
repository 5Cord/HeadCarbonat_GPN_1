export const CARD_TYPES = {
  OPPORTUNITY: 'opportunity', 
  RISK: 'risk',              
  RANDOM: 'random'           
};


export const OPPORTUNITY_QUESTIONS = [
  {
    id: 'oq1',
    question: 'Какой тип коллектора характерен для карбонатных пород?',
    options: [
      'Поровый',
      'Трещинно-кавернозный',
      'Терригенный',
      'Глинистый'
    ],
    correctAnswer: 1,
    points: 2,
    explanation: 'Карбонаты часто имеют трещинно-кавернозный коллектор'
  },
  {
    id: 'oq2',
    question: 'Что означает аббревиатура СРР?',
    options: [
      'Сейсмическая разведочная работа',
      'Сейсморазведочные работы',
      'Структурная расшифровка региона',
      'Сейсмический резонансный регистратор'
    ],
    correctAnswer: 1,
    points: 3,
    explanation: 'СРР - Сейсморазведочные работы'
  },
  {
    id: 'oq3',
    question: 'Какая плотность ресурсов считается высокой?',
    options: [
      'Менее 5 тыс.т УВ/км²',
      '5-10 тыс.т УВ/км²',
      '10-50 тыс.т УВ/км²',
      'Более 50 тыс.т УВ/км²'
    ],
    correctAnswer: 2,
    points: 2,
    explanation: 'Высокая плотность: 10-50 тыс.т УВ/км²'
  },
  {
    id: 'oq4',
    question: 'Для чего нужна геомеханическая модель?',
    options: [
      'Для расчета запасов',
      'Для планирования траектории скважины',
      'Для анализа рынка',
      'Для оценки климата'
    ],
    correctAnswer: 1,
    points: 3,
    explanation: 'Геомеханика важна для безопасного бурения'
  },
  {
    id: 'oq5',
    question: 'Что такое ГДИС?',
    options: [
      'Геодинамические исследования',
      'Гидродинамические исследования скважин',
      'Геологическая динамика и структура',
      'Гипотетическая диаграмма исследований'
    ],
    correctAnswer: 1,
    points: 2,
    explanation: 'ГДИС - Гидродинамические исследования скважин'
  },
  {
    id: 'oq6',
    question: 'Какой метод используется для повышения нефтеотдачи?',
    options: [
      'Только бурение новых скважин',
      'МУН (методы увеличения нефтеотдачи)',
      'Закрытие старых скважин',
      'Простое ожидание'
    ],
    correctAnswer: 1,
    points: 3,
    explanation: 'МУН включает различные технологии для увеличения добычи'
  },
  {
    id: 'oq7',
    question: 'Что показывает 3D сейсморазведка?',
    options: [
      'Только глубину залегания',
      'Объемную структуру пластов',
      'Химический состав',
      'Погоду'
    ],
    correctAnswer: 1,
    points: 2,
    explanation: '3D СРР дает объемную картину геологического строения'
  },
  {
    id: 'oq8',
    question: 'Зачем проводят геохимическую съемку?',
    options: [
      'Для поиска углеводородов по поверхностным признакам',
      'Для анализа воды',
      'Для измерения радиации',
      'Для поиска металлов'
    ],
    correctAnswer: 0,
    points: 2,
    explanation: 'Геохимия помогает обнаружить следы УВ на поверхности'
  }
];

export const RISK_CARDS = [
  { id: 'r1', points: -1, description: 'Неожиданная сложность в бурении' },
  { id: 'r2', points: -1, description: 'Задержка поставки оборудования' },
  { id: 'r3', points: -2, description: 'Геологическая неопределенность' },
  { id: 'r4', points: -1, description: 'Низкое качество керна' },
  { id: 'r5', points: -2, description: 'Обводнение пласта' },
  { id: 'r6', points: -1, description: 'Технические проблемы с оборудованием' },
  { id: 'r7', points: -2, description: 'Неблагоприятные результаты испытаний' },
  { id: 'r8', points: -1, description: 'Превышение бюджета на работы' }
];

export const RANDOM_CARDS = [
  { id: 'rnd1', points: 2, description: 'Удачное бурение - досрочное завершение' },
  { id: 'rnd2', points: -1, description: 'Непредвиденные геологические условия' },
  { id: 'rnd3', points: 3, description: 'Обнаружена дополнительная продуктивная зона' },
  { id: 'rnd4', points: -2, description: 'Поломка оборудования' },
  { id: 'rnd5', points: 2, description: 'Высокие дебиты нефти' },
  { id: 'rnd6', points: -1, description: 'Плохие погодные условия - задержка работ' }
];

/**
 * Генерация линии карточек для ЛУ
 * @param {number} successRate - Процент успеха с предыдущего этапа
 * @returns {Array} - Массив из 6 карточек
 */
export const generateEventLine = (successRate) => {

  let opportunityCount;
  if (successRate >= 60) opportunityCount = 3;
  else if (successRate >= 40) opportunityCount = 2;
  else if (successRate >= 20) opportunityCount = 1;
  else opportunityCount = 0;
  

  const randomCount = 1;
  

  const riskCount = 6 - opportunityCount - randomCount;
  
  const cards = [];
  

  const shuffledQuestions = [...OPPORTUNITY_QUESTIONS].sort(() => Math.random() - 0.5);
  for (let i = 0; i < opportunityCount; i++) {
    cards.push({
      type: CARD_TYPES.OPPORTUNITY,
      position: i,
      data: shuffledQuestions[i]
    });
  }
  
  const shuffledRisks = [...RISK_CARDS].sort(() => Math.random() - 0.5);
  for (let i = 0; i < riskCount; i++) {
    cards.push({
      type: CARD_TYPES.RISK,
      position: opportunityCount + i,
      data: shuffledRisks[i]
    });
  }
  
  const randomCard = RANDOM_CARDS[Math.floor(Math.random() * RANDOM_CARDS.length)];
  cards.push({
    type: CARD_TYPES.RANDOM,
    position: 5,
    data: randomCard
  });
  

  return cards.sort((a, b) => a.position - b.position);
};

/**
 * Подготовка данных для API
 */
export const prepareEventsDataForAPI = (teamId, luId, lineResults) => {
  return {
    teamId,
    luId,
    results: lineResults.map(result => ({
      cardId: result.cardId,
      cardType: result.cardType,
      answered: result.answered,
      correct: result.correct,
      pointsEarned: result.pointsEarned,
      timestamp: new Date().toISOString()
    })),
    totalScore: lineResults.reduce((sum, r) => sum + r.pointsEarned, 0),
    passedThreshold: lineResults.reduce((sum, r) => sum + r.pointsEarned, 0) > 0
  };
};