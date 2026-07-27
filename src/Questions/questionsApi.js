// ── Слой данных для вопросов (CRUD) ──────────────────────────────────────────
// ЕДИНЫЙ игровой пул вопросов = база + добавленные через админку:
//   • БАЗА — BASE_OPPORTUNITY_QUESTIONS из Events/Eventsdata.js (с картинками),
//     редактируется только в коде, в админке доступна «только для чтения».
//   • CUSTOM — добавленные через эту форму, хранятся в БД на бэкенде
//     (таблица questions) и правятся через REST /api/admin/questions.
//     Если бэкенд недоступен — читаем снапшот из src/question.json (read-only).
// Игра склеивает оба набора через loadCustomQuestions() в Eventsdata.js.
// Здесь админка читает объединённый список, а правит CUSTOM.
//
// game-схема вопроса (как в Eventsdata.js и в БД):
//   { id, title?, question, options: string[], correctAnswer: index, points: 1|2|3, topic, image }
// модель формы (UI):
//   { id, source: 'base'|'custom', title, text, image, difficulty, topic, answers: [{ id, text, correct }] }
//
// База пока в коде — фильтрация/пагинация выполняются на клиенте по
// объединённому списку. После переноса базы в БД переключим на серверную.

import { BASE_OPPORTUNITY_QUESTIONS } from '../Events/Eventsdata.js';
import customFile from '../question.json';
import {
    getAdminQuestions, createAdminQuestion, updateAdminQuestion, deleteAdminQuestion,
    getQuestionTopics, createQuestionTopic, renameQuestionTopic, deleteQuestionTopic,
} from '../apiHelpers.js';

export const MIN_ANSWERS = 2;
export const MAX_ANSWERS = 5;
export const PAGE_SIZE = 10;
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
const gameToModel = (q, source) => ({
    id: q.id,
    source,
    title: String(q.title ?? '').trim(),
    text: String(q.question ?? '').trim(),
    image: q.image ?? null,
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

const clone = (x) => JSON.parse(JSON.stringify(x));

// ── Хранилище ────────────────────────────────────────────────────────────────
// Базовые модели считаем один раз (база статична). _customRaw — локальный кэш
// кастомных вопросов из БД (game-схема). Объединённый список: CUSTOM, затем БАЗА.
const BASE_MODELS = BASE_OPPORTUNITY_QUESTIONS.map(q => gameToModel(q, 'base'));

let _customRaw = [];
let _loaded = false;
let _readOnly = false; // бэкенд недоступен → правки запрещены

const allModels = () => [
    ..._customRaw.map(q => gameToModel(q, 'custom')),
    ...BASE_MODELS,
];

const ensureLoaded = async () => {
    if (_loaded) return;
    try {
        const { items } = await getAdminQuestions({ source: 'custom' });
        _customRaw = Array.isArray(items) ? items : [];
        _readOnly = false;
    } catch {
        // Бэкенд недоступен — показываем снапшот из question.json (только чтение).
        _customRaw = Array.isArray(customFile?.custom) ? customFile.custom : [];
        _readOnly = true;
    }
    _loaded = true;
};

const invalidate = () => { _loaded = false; };

const assertWritable = () => {
    if (_readOnly) throw new Error('Бэкенд недоступен — сохранение вопросов невозможно.');
};

// Проверка одного вопроса на соответствие фильтрам (поиск/тематика/сложность).
const matchesFilters = (q, { search = '', topic = '', difficulty = '' }) => {
    if (topic && q.topic !== topic) return false;
    if (difficulty !== '' && difficulty != null && q.difficulty !== Number(difficulty)) return false;
    const s = String(search || '').trim().toLowerCase();
    if (s && !`${q.title} ${q.text}`.toLowerCase().includes(s)) return false;
    return true;
};

// ── Публичный CRUD ───────────────────────────────────────────────────────────
export async function getQuestions() {
    await ensureLoaded();
    return clone(allModels());
}

// Постраничная (ленивая) выборка для бесконечного скролла.
export async function getQuestionsPage({ offset = 0, limit = PAGE_SIZE, search = '', topic = '', difficulty = '' } = {}) {
    await ensureLoaded();
    const all = allModels().filter(q => matchesFilters(q, { search, topic, difficulty }));
    const items = all.slice(offset, offset + limit);
    return {
        items: clone(items),
        total: all.length,
        offset,
        limit,
        hasMore: offset + items.length < all.length,
    };
}

export async function createQuestion(input) {
    await ensureLoaded();
    assertWritable();
    const created = await createAdminQuestion(modelToGame(input));
    _customRaw = [created, ..._customRaw];
    return gameToModel(created, 'custom');
}

export async function updateQuestion(id, input) {
    await ensureLoaded();
    const idx = _customRaw.findIndex(q => q.id === id);
    if (idx === -1) throw new Error('Базовые вопросы редактируются в коде (Eventsdata.js).');
    assertWritable();
    const updated = await updateAdminQuestion(id, modelToGame(input));
    _customRaw = _customRaw.map((q, i) => (i === idx ? updated : q));
    return gameToModel(updated, 'custom');
}

export async function deleteQuestion(id) {
    await ensureLoaded();
    if (!_customRaw.some(q => q.id === id)) throw new Error('Базовый вопрос нельзя удалить из админки.');
    assertWritable();
    await deleteAdminQuestion(id);
    _customRaw = _customRaw.filter(q => q.id !== id);
    return { success: true };
}

// ── Тематики ─────────────────────────────────────────────────────────────────
// Справочник живёт в БД (question_topics). Темы базовых (захардкоженных)
// вопросов добавляем к списку на клиенте, пока база не перенесена в БД.

const baseTopics = () => BASE_MODELS
    .map(q => (q.topic || '').trim())
    .filter(Boolean);

// Уникальные тематики (для подсказок в форме) — по всему пулу.
export async function getTopics() {
    const seen = new Map(); // нормализованное имя → оригинальное (первое встреченное)
    const push = (t) => {
        const name = String(t || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (!seen.has(key)) seen.set(key, name);
    };
    try {
        (await getQuestionTopics()).forEach(t => push(t.name));
    } catch {
        // бэкенд недоступен — темы только из локального пула
        await ensureLoaded();
        _customRaw.forEach(q => push(q.topic));
    }
    baseTopics().forEach(push);
    return [...seen.values()].sort((a, b) => a.localeCompare(b, 'ru'));
}

// Полный список тем из БД для блока управления: [{ id, name, questionsCount, baseCount }]
// baseCount — сколько базовых (read-only) вопросов используют тему: их
// переименование не затронет, предупреждаем в UI.
export async function getTopicsAdmin() {
    const topics = await getQuestionTopics();
    const baseUsage = new Map();
    baseTopics().forEach(t => {
        const key = t.toLowerCase();
        baseUsage.set(key, (baseUsage.get(key) || 0) + 1);
    });
    return topics.map(t => ({
        ...t,
        baseCount: baseUsage.get(String(t.name || '').toLowerCase()) || 0,
    }));
}

export async function addTopic(name) {
    return createQuestionTopic(name);
}

export async function renameTopic(id, name) {
    const result = await renameQuestionTopic(id, name);
    invalidate(); // тема каскадно обновилась в кастомных вопросах — перечитать
    return result;
}

export async function removeTopic(id) {
    return deleteQuestionTopic(id);
}
