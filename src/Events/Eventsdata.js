// Содержимое «Зоны событий» приходит с бэка, ответы проверяет сервер.
import { getEventCards, getPublicQuestions, resolveApiUrl } from '../apiHelpers.js';

export const CARD_TYPES = {
  OPPORTUNITY: 'opportunity',
  RISK: 'risk',
  RANDOM: 'random'
};

// Мутируются на месте после loadEventPool().
export const OPPORTUNITY_QUESTIONS = [];
export const RISK_CARDS = [];
export const RANDOM_CARDS = [];

const withImages = (item) => ({
  ...item,
  image: resolveApiUrl(item.image) ?? null,
  ...(item.optionImages ? { optionImages: item.optionImages.map(resolveApiUrl) } : {}),
});

const replaceAll = (target, items) => target.splice(0, target.length, ...items.map(withImages));

let _loaded = null;

export function loadEventPool() {
  if (!_loaded) {
    _loaded = Promise.all([getPublicQuestions(), getEventCards()])
      .then(([questions, cards]) => {
        replaceAll(OPPORTUNITY_QUESTIONS, Array.isArray(questions) ? questions : []);
        replaceAll(RISK_CARDS, cards?.risk || []);
        replaceAll(RANDOM_CARDS, cards?.random || []);
        return true;
      })
      .catch(() => {
        _loaded = null;
        return false;
      });
  }
  return _loaded;
}


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