// ── Слой данных для вопросов (CRUD через /api/admin/questions) ──────────────

import {
    getAdminQuestions, createAdminQuestion, updateAdminQuestion, deleteAdminQuestion,
    getQuestionTopics, createQuestionTopic, renameQuestionTopic, deleteQuestionTopic,
    resolveApiUrl,
} from '../apiHelpers.js';

export const MIN_ANSWERS = 2;
export const MAX_ANSWERS = 5;
export const PAGE_SIZE = 10;
export const QUESTION_SETS = [
    { id: 'main', label: 'Основной набор' },
    { id: 'branch', label: 'Ответвление (скрыты в игре)' },
];
export const DIFFICULTY_LEVELS = [1, 2, 3];
export const DIFFICULTY_LABELS = {
    1: 'Лёгкий (1)',
    2: 'Средний (2)',
    3: 'Сложный (3)',
};

let _idSeq = 1;
const nextId = (prefix = 'q') => `${prefix}_${Date.now()}_${_idSeq++}`;
const normDifficulty = (v) => (DIFFICULTY_LEVELS.includes(Number(v)) ? Number(v) : 1);

// ── Мапперы game-схема ↔ модель формы ────────────────────────────────────────
const gameToModel = (q) => ({
    id: q.id,
    source: q.source === 'base' ? 'base' : 'custom',
    questionSet: q.questionSet === 'branch' ? 'branch' : 'main',
    title: String(q.title ?? '').trim(),
    text: String(q.question ?? '').trim(),
    image: resolveApiUrl(q.image) ?? null,
    optionImages: q.optionImages ? q.optionImages.map(resolveApiUrl) : null,
    difficulty: normDifficulty(q.points),
    topic: String(q.topic ?? '').trim(),
    answers: (q.options || []).map((o, i) => ({
        id: nextId('a'),
        text: String(o ?? ''),
        correct: i === Number(q.correctAnswer),
    })),
});

const modelToGame = (model) => {
    const answers = (model.answers || []).filter(a => String(a.text ?? '').trim());
    let correctAnswer = answers.findIndex(a => a.correct);
    if (correctAnswer < 0) correctAnswer = 0;
    return {
        title: String(model.title ?? '').trim(),
        question: String(model.text ?? '').trim(),
        options: answers.map(a => String(a.text).trim()),
        correctAnswer,
        points: normDifficulty(model.difficulty),
        topic: String(model.topic ?? '').trim(),
        image: model.image ?? null,
    };
};

// ── Публичный CRUD ───────────────────────────────────────────────────────────
// Постраничная (ленивая) выборка для бесконечного скролла.
export async function getQuestionsPage({ offset = 0, limit = PAGE_SIZE, search = '', topic = '', difficulty = '', set = '' } = {}) {
    const page = await getAdminQuestions({ offset, limit, search, topic, difficulty, set });
    return { ...page, items: (page.items || []).map(gameToModel) };
}

export async function createQuestion(input) {
    return gameToModel(await createAdminQuestion(modelToGame(input)));
}

export async function updateQuestion(id, input) {
    return gameToModel(await updateAdminQuestion(id, modelToGame(input)));
}

export async function deleteQuestion(id) {
    await deleteAdminQuestion(id);
    return { success: true };
}

// ── Тематики ─────────────────────────────────────────────────────────────────
export async function getTopics() {
    const names = (await getQuestionTopics()).map(t => String(t.name || '').trim()).filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'ru'));
}

export async function getTopicsAdmin() {
    return getQuestionTopics();
}

export async function addTopic(name) {
    return createQuestionTopic(name);
}

export async function renameTopic(id, name) {
    return renameQuestionTopic(id, name);
}

export async function removeTopic(id) {
    return deleteQuestionTopic(id);
}
