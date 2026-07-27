import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    getQuestionsPage, createQuestion, updateQuestion, deleteQuestion, getTopics,
    getTopicsAdmin, addTopic, renameTopic, removeTopic,
    MIN_ANSWERS, MAX_ANSWERS, PAGE_SIZE, DIFFICULTY_LEVELS, DIFFICULTY_LABELS,
} from './questionsApi';
import './QuestionsTab.css';

// Картинка сжимается в браузере до миниатюры и хранится base64 — по образцу
// LUCardsEditor в Adminpanel.jsx. При подключении бэка можно будет слать файл.
const MAX_IMAGE_DIM = 900;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

const downscaleImage = (file) => new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Можно загрузить только изображение'));
    if (file.size > MAX_SOURCE_BYTES) return reject(new Error(`Файл слишком большой (макс. ${Math.round(MAX_SOURCE_BYTES / 1024 / 1024)} МБ)`));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        try { resolve(canvas.toDataURL('image/jpeg', 0.85)); }
        catch { reject(new Error('Не удалось обработать изображение')); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось прочитать изображение')); };
    img.src = url;
});

const emptyAnswer = () => ({ id: `new_${Math.random().toString(36).slice(2)}`, text: '', correct: false });

const blankForm = () => ({
    title: '',
    text: '',
    image: null,
    difficulty: 1,
    topic: '',
    answers: [{ ...emptyAnswer(), correct: true }, emptyAnswer()],
});

// ── Модалка формы создания/редактирования ────────────────────────────────────
const QuestionFormModal = ({ initial, topics, onSave, onCancel }) => {
    const [form, setForm] = useState(() => initial ? JSON.parse(JSON.stringify(initial)) : blankForm());
    const [error, setError] = useState('');
    const [imgError, setImgError] = useState('');
    const [saving, setSaving] = useState(false);

    const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const setAnswerText = (i, v) => sf('answers', form.answers.map((a, j) => j === i ? { ...a, text: v } : a));
    const setCorrect = (i) => sf('answers', form.answers.map((a, j) => ({ ...a, correct: j === i })));
    const addAnswer = () => { if (form.answers.length < MAX_ANSWERS) sf('answers', [...form.answers, emptyAnswer()]); };
    const removeAnswer = (i) => {
        if (form.answers.length <= MIN_ANSWERS) return;
        const removedCorrect = form.answers[i].correct;
        const next = form.answers.filter((_, j) => j !== i);
        if (removedCorrect && !next.some(a => a.correct)) next[0].correct = true;
        sf('answers', next);
    };

    const handleImage = async (file) => {
        setImgError('');
        if (!file) return;
        try { sf('image', await downscaleImage(file)); }
        catch (e) { setImgError(e.message); }
    };

    const validate = () => {
        if (!form.text.trim()) return 'Укажите текст вопроса';
        if (!form.topic.trim()) return 'Укажите тематику';
        const filled = form.answers.filter(a => a.text.trim());
        if (filled.length < MIN_ANSWERS) return `Нужно минимум ${MIN_ANSWERS} варианта ответа с текстом`;
        if (!form.answers.some(a => a.correct && a.text.trim())) return 'Отметьте правильный вариант ответа (с текстом)';
        return '';
    };

    const handleSubmit = async () => {
        const err = validate();
        if (err) { setError(err); return; }
        setSaving(true); setError('');
        try {
            // Сохраняем только варианты с непустым текстом.
            const answers = form.answers.filter(a => a.text.trim());
            if (!answers.some(a => a.correct)) answers[0].correct = true;
            await onSave({ ...form, answers });
        } catch (e) {
            setError(e.message || 'Не удалось сохранить');
            setSaving(false);
        }
    };

    return (
        <div className="cm-overlay" onClick={onCancel}>
            <div className="qf-modal" onClick={e => e.stopPropagation()}>
                <h3 className="qf-title">{initial ? 'Редактировать вопрос' : 'Новый вопрос'}</h3>

                <label className="qf-label">Заголовок</label>
                <input className="qf-input" type="text" placeholder="Например: Структурная геология — складки"
                    value={form.title} onChange={e => sf('title', e.target.value)} />

                <label className="qf-label">Текст вопроса <span className="qf-req">*</span></label>
                <textarea className="qf-input qf-textarea" rows={3} placeholder="Формулировка вопроса…"
                    value={form.text} onChange={e => sf('text', e.target.value)} />

                <div className="qf-row">
                    <div className="qf-col">
                        <label className="qf-label">Сложность</label>
                        <select className="qf-input" value={form.difficulty}
                            onChange={e => sf('difficulty', Number(e.target.value))}>
                            {DIFFICULTY_LEVELS.map(d => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
                        </select>
                    </div>
                    <div className="qf-col">
                        <label className="qf-label">Тематика <span className="qf-req">*</span></label>
                        <input className="qf-input" type="text" list="qf-topics" placeholder="Выберите или введите новую"
                            value={form.topic} onChange={e => sf('topic', e.target.value)} />
                        <datalist id="qf-topics">
                            {topics.map(t => <option key={t} value={t} />)}
                        </datalist>
                    </div>
                </div>

                <label className="qf-label">Картинка (необязательно)</label>
                <div className="qf-img-row">
                    {form.image && (
                        <div className="qf-img-preview">
                            <img src={form.image} alt="Картинка вопроса" />
                            <button type="button" className="ghost-btn" onClick={() => sf('image', null)}>Удалить</button>
                        </div>
                    )}
                    <label className="qf-img-upload">
                        <span>{form.image ? 'Заменить картинку' : '＋ Загрузить картинку'}</span>
                        <input type="file" accept="image/*" hidden
                            onChange={e => { handleImage(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                </div>
                {imgError && <div className="qf-error">{imgError}</div>}

                <label className="qf-label">Варианты ответа ({form.answers.length}/{MAX_ANSWERS})</label>
                {form.answers.map((a, i) => (
                    <div key={a.id} className="qf-answer-row">
                        <label className="qf-correct" title="Правильный ответ">
                            <input type="radio" name="qf-correct" checked={a.correct} onChange={() => setCorrect(i)} />
                        </label>
                        <input className="qf-input qf-answer-input" type="text" placeholder={`Вариант ${i + 1}`}
                            value={a.text} onChange={e => setAnswerText(i, e.target.value)} />
                        <button type="button" className="ghost-btn qf-answer-del" onClick={() => removeAnswer(i)}
                            disabled={form.answers.length <= MIN_ANSWERS} title="Удалить вариант">✕</button>
                    </div>
                ))}
                <button type="button" className="ghost-btn qf-add-answer" onClick={addAnswer} disabled={form.answers.length >= MAX_ANSWERS}>
                    + вариант
                </button>
                <p className="qf-hint">Отметьте кружком правильный вариант. Минимум {MIN_ANSWERS}, максимум {MAX_ANSWERS}.</p>

                {error && <div className="qf-error">{error}</div>}

                <div className="qf-actions">
                    <button className="cm-btn cm-btn-cancel" onClick={onCancel} disabled={saving}>Отмена</button>
                    <button className="cm-btn cm-btn-confirm" onClick={handleSubmit} disabled={saving}>
                        {saving ? 'Сохранение…' : 'Сохранить'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Панель управления тематиками ─────────────────────────────────────────────
// Справочник тем живёт в БД: переименование каскадно обновляет добавленные
// вопросы (базовые правятся только в коде — о них предупреждаем), удалить
// можно только тему, которую не использует ни один вопрос из БД.
const TopicsPanel = ({ onChanged }) => {
    const [rows, setRows] = useState(null); // null = загрузка
    const [newName, setNewName] = useState('');
    const [editId, setEditId] = useState(null);
    const [editName, setEditName] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const reload = useCallback(() => {
        getTopicsAdmin().then(setRows).catch(e => {
            setRows([]);
            setError(e.message || 'Не удалось загрузить тематики (бэкенд недоступен?)');
        });
    }, []);
    useEffect(() => { reload(); }, [reload]);

    const run = async (fn) => {
        setBusy(true); setError('');
        try {
            await fn();
            reload();
            onChanged?.();
        } catch (e) {
            setError(e.message || 'Ошибка');
        } finally {
            setBusy(false);
        }
    };

    const handleAdd = () => {
        const name = newName.trim();
        if (!name) return;
        run(async () => { await addTopic(name); setNewName(''); });
    };

    const handleRename = () => {
        const name = editName.trim();
        if (!name || editId == null) return;
        run(async () => { await renameTopic(editId, name); setEditId(null); });
    };

    return (
        <div className="qtp">
            <div className="qtp-add">
                <input className="qf-input" type="text" placeholder="Новая тематика…"
                    value={newName} onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} disabled={busy} />
                <button className="qt-add-btn" onClick={handleAdd} disabled={busy || !newName.trim()}>Добавить</button>
            </div>

            {error && <div className="qf-error">{error}</div>}

            {rows === null ? (
                <div className="qt-loading">Загрузка…</div>
            ) : rows.length === 0 ? (
                <p className="qt-empty">Тем пока нет — они появятся при добавлении вопросов или создайте вручную.</p>
            ) : (
                <div className="qtp-list">
                    {rows.map(t => (
                        <div key={t.id} className="qtp-row">
                            {editId === t.id ? (
                                <>
                                    <input className="qf-input qtp-rename-input" type="text" autoFocus
                                        value={editName} onChange={e => setEditName(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleRename();
                                            if (e.key === 'Escape') setEditId(null);
                                        }} disabled={busy} />
                                    <button className="ghost-btn" onClick={handleRename} disabled={busy || !editName.trim()}>Сохранить</button>
                                    <button className="ghost-btn" onClick={() => setEditId(null)} disabled={busy}>Отмена</button>
                                </>
                            ) : (
                                <>
                                    <span className="qtp-name">{t.name}</span>
                                    <span className="qt-badge qt-badge-topic" title="Вопросов с этой темой (добавленных через админку)">
                                        {t.questionsCount}
                                    </span>
                                    {t.baseCount > 0 && (
                                        <span className="qt-badge qt-badge-src-base"
                                            title="Тему используют и базовые вопросы из кода — переименование их не затронет">
                                            +{t.baseCount} базовых
                                        </span>
                                    )}
                                    <span className="qtp-spacer" />
                                    <button className="ghost-btn" disabled={busy}
                                        onClick={() => { setEditId(t.id); setEditName(t.name); }}>✎ Переименовать</button>
                                    <button className="ghost-btn qt-del" disabled={busy || t.questionsCount > 0}
                                        title={t.questionsCount > 0 ? 'Сначала перенесите вопросы этой темы на другую' : 'Удалить тему'}
                                        onClick={() => run(() => removeTopic(t.id))}>🗑</button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <p className="qf-hint">Переименование темы автоматически обновит её во всех добавленных вопросах.</p>
        </div>
    );
};

// ── Вкладка «Вопросы» ────────────────────────────────────────────────────────
const QuestionsTab = () => {
    const [items, setItems] = useState([]);          // накопленные (подгруженные) вопросы
    const [total, setTotal] = useState(0);           // всего по текущим фильтрам
    const [hasMore, setHasMore] = useState(false);
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(false);   // загрузка первой страницы / сброс
    const [loadingMore, setLoadingMore] = useState(false);
    const [editing, setEditing] = useState(null);    // null | { question } | { question: null } (создание)
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [search, setSearch] = useState('');
    const [topicFilter, setTopicFilter] = useState('');
    const [difficultyFilter, setDifficultyFilter] = useState('');
    const [showTopics, setShowTopics] = useState(false);

    const sentinelRef = useRef(null);
    // Накопленную длину держим в ref, чтобы observer всегда брал актуальный offset
    // и не пересоздавался на каждую подгрузку.
    const itemsLenRef = useRef(0);
    itemsLenRef.current = items.length;

    const reloadTopics = useCallback(() => {
        getTopics().then(setTopics).catch(() => setTopics([]));
    }, []);

    // Загрузка страницы. offset 0 → сброс списка, иначе дозагрузка в конец.
    const loadPage = useCallback(async (offset) => {
        const fresh = offset === 0;
        if (fresh) setLoading(true); else setLoadingMore(true);
        try {
            const res = await getQuestionsPage({
                offset, limit: PAGE_SIZE, search, topic: topicFilter, difficulty: difficultyFilter,
            });
            setItems(prev => (fresh ? res.items : [...prev, ...res.items]));
            setTotal(res.total);
            setHasMore(res.hasMore);
        } catch (e) {
            console.error(e);
        } finally {
            if (fresh) setLoading(false); else setLoadingMore(false);
        }
    }, [search, topicFilter, difficultyFilter]);

    useEffect(() => { reloadTopics(); }, [reloadTopics]);

    // Сброс к первой странице при смене фильтров (поиск — с дебаунсом).
    useEffect(() => {
        const t = setTimeout(() => { loadPage(0); }, 250);
        return () => clearTimeout(t);
    }, [loadPage]);

    // Бесконечный скролл: догружаем следующую страницу, когда виден «маяк» внизу.
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el || !hasMore) return;
        const obs = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && !loading && !loadingMore) {
                loadPage(itemsLenRef.current);
            }
        }, { rootMargin: '250px' });
        obs.observe(el);
        return () => obs.disconnect();
    }, [hasMore, loading, loadingMore, loadPage]);

    const refresh = async () => { await Promise.all([loadPage(0), reloadTopics()]); };

    const handleSave = async (form) => {
        if (editing?.question) await updateQuestion(editing.question.id, form);
        else await createQuestion(form);
        setEditing(null);
        await refresh();
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        await deleteQuestion(confirmDelete.id);
        setConfirmDelete(null);
        await refresh();
    };

    return (
        <div className="qt">
            <div className="qt-toolbar">
                <h2 className="qt-h2">Вопросы <span className="qt-count">{total}</span></h2>
                <div className="qt-toolbar-btns">
                    <button className={`qt-topics-btn ${showTopics ? 'qt-topics-btn-on' : ''}`}
                        onClick={() => setShowTopics(v => !v)}>
                        {showTopics ? 'Скрыть тематики' : 'Тематики'}
                    </button>
                    <button className="qt-add-btn" onClick={() => setEditing({ question: null })}>+ Добавить вопрос</button>
                </div>
            </div>

            {showTopics && <TopicsPanel onChanged={refresh} />}

            <div className="qt-filters">
                <input className="qf-input" type="text" placeholder="Поиск по тексту…"
                    value={search} onChange={e => setSearch(e.target.value)} />
                <select className="qf-input" value={topicFilter} onChange={e => setTopicFilter(e.target.value)}>
                    <option value="">Все тематики</option>
                    {topics.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select className="qf-input" value={difficultyFilter} onChange={e => setDifficultyFilter(e.target.value)}>
                    <option value="">Любая сложность</option>
                    {DIFFICULTY_LEVELS.map(d => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="qt-loading">Загрузка…</div>
            ) : items.length === 0 ? (
                <p className="qt-empty">Вопросов нет. Нажмите «+ Добавить вопрос».</p>
            ) : (
                <div className="qt-list">
                    {items.map(item => (
                            <div key={item.id} className="qt-card">
                                {item.image && <img className="qt-card-img" src={item.image} alt="" />}
                                <div className="qt-card-body">
                                    <div className="qt-card-meta">
                                        <span className={`qt-badge qt-badge-d${item.difficulty}`}>{DIFFICULTY_LABELS[item.difficulty]}</span>
                                        <span className="qt-badge qt-badge-topic">{item.topic || '— без тематики —'}</span>
                                        <span className={`qt-badge qt-badge-src qt-badge-src-${item.source}`}>
                                            {item.source === 'base' ? 'базовый' : 'добавлен'}
                                        </span>
                                    </div>
                                    {item.title && <div className="qt-card-title">{item.title}</div>}
                                    <div className="qt-card-text">{item.text}</div>
                                    <div className="qt-card-answers">
                                        {item.answers.map(a => (
                                            <span key={a.id} className={`qt-answer ${a.correct ? 'qt-answer-correct' : ''}`}>
                                                {a.correct ? '*' : ''}{a.text}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="qt-card-actions">
                                    {item.source === 'base' ? (
                                        <span className="qt-readonly" title="Базовые вопросы правятся в коде (Eventsdata.js)">только чтение</span>
                                    ) : (
                                        <>
                                            <button className="ghost-btn" onClick={() => setEditing({ question: item })}>✎ Изменить</button>
                                            <button className="ghost-btn qt-del" onClick={() => setConfirmDelete(item)}>🗑 Удалить</button>
                                        </>
                                    )}
                                </div>
                            </div>
                    ))}
                </div>
            )}

            {/* «Маяк» бесконечного скролла + индикаторы */}
            {!loading && hasMore && <div ref={sentinelRef} className="qt-sentinel" aria-hidden="true" />}
            {loadingMore && <div className="qt-loading qt-loading-more">Загрузка ещё…</div>}
            {!loading && !hasMore && items.length > 0 && (
                <div className="qt-end">Показаны все вопросы ({total})</div>
            )}

            {editing && (
                <QuestionFormModal
                    initial={editing.question}
                    topics={topics}
                    onSave={handleSave}
                    onCancel={() => setEditing(null)}
                />
            )}

            {confirmDelete && (
                <div className="cm-overlay" onClick={() => setConfirmDelete(null)}>
                    <div className="cm-box" onClick={e => e.stopPropagation()}>
                        <p className="cm-message">Удалить вопрос?<br /><small>{confirmDelete.text}</small></p>
                        <div className="cm-actions">
                            <button className="cm-btn cm-btn-cancel" onClick={() => setConfirmDelete(null)}>Отмена</button>
                            <button className="cm-btn cm-btn-confirm" onClick={handleDelete}>Удалить</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuestionsTab;
