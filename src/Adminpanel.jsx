import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    getAdminSessions, getAdminTeams, getAdminStats,
    deleteSession, resetTeam, exportData,
    adminLogin, getAdminSessionDetails,
    updateSessionIntro,
    getPresets, createPreset, updatePreset, deletePreset,
    getIntroPresets, createIntroPreset, updateIntroPreset, deleteIntroPreset,
} from './apiHelpers';
import { io as socketIO } from 'socket.io-client';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    Cell, ResponsiveContainer, PieChart, Pie,
    LineChart, Line,
} from 'recharts';
import './Adminpanel.css';

const YEARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const DEFAULT_TIMERS = {
    regionMap: { selection: 20, auction: 2, postAuction: 2 },
    years: { 1: 25, 2: 20, 3: 15, 4: 15, 5: 10, 6: 15, 7: 15, 8: 15, 9: 10, 10: 10 },
};

const BUDGET_DEFAULTS = { students: 20000, professionals: 20000 };

const DEFAULT_CASE_INTRO = {
    title: 'Кейс',
    paragraphs: [
        'В стране растёт интерес компаний к новому потенциально нефтеносному району.',
        'По данным федеральных научных институтов, перспективы связаны с карбонатным комплексом платформенного типа.',
        'На западе расположен складчато-надвиговый комплекс, где целевые объекты могут выходить на поверхность.',
        'Изученность района крайне низкая: сейсморазведка 2D почти отсутствует, бурение не проводилось.',
        'По периметру пробурены параметрические скважины, примыкающие к зоне лицензирования.',
    ],
    buttonText: 'Начать работу →',
};

// ── Преобразование таймеров пресета/сессии в форму TimersForm ────────────────
const timersFromConfig = (cfg) => {
    const years = { ...DEFAULT_TIMERS.years };
    Object.entries(cfg?.timers || {}).forEach(([y, v]) => {
        const n = Number(y);
        if (n >= 1 && n <= 10) years[n] = Number(v);
    });
    return {
        regionMap: {
            selection: Number(cfg?.regionMapTimers?.selection ?? DEFAULT_TIMERS.regionMap.selection),
            auction: Number(cfg?.regionMapTimers?.auction ?? DEFAULT_TIMERS.regionMap.auction),
            postAuction: Number(cfg?.regionMapTimers?.postAuction ?? DEFAULT_TIMERS.regionMap.postAuction),
        },
        years,
    };
};

const ALL_PHASES = [
    'LOBBY', 'REGION_MAP_SELECTION', 'REGION_MAP_AUCTION', 'REGION_MAP_POST_AUCTION', 'RESEARCH',
];

const PHASE_LABELS = {
    LOBBY: 'Лобби',
    REGION_MAP_SELECTION: 'Карта — выбор ЛУ',
    REGION_MAP_AUCTION: 'Карта — аукцион',
    REGION_MAP_POST_AUCTION: 'Карта — допокупка',
    RESEARCH: 'Основная игра (НИР / события / полевые / результаты)',
};

const GROUP_COLOR_STYLES = {
    gray: { bg: '#f1f5f9', border: '#94a3b8', text: '#475569', label: 'СРР' },
    orange: { bg: '#fff7ed', border: '#fb923c', text: '#c2410c', label: 'ГРР' },
    beige: { bg: '#fef9ee', border: '#d4a853', text: '#92400e', label: 'Бурение' },
    blue: { bg: '#eff6ff', border: '#60a5fa', text: '#1d4ed8', label: 'Добыча' },
};

const RANK_COLORS = { 1: '#16a34a', 2: '#d97706', 3: '#64748b' };
const RANK_LABELS = { 1: 'Лучший', 2: 'Средний', 3: 'Базовый' };

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const fmt = (sec) => { const s = Math.max(0, Math.floor(sec ?? 0)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const fmtMln = (n) => Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 });

const getSavedToken = () => {
    const token = localStorage.getItem('auth_token');
    return token && token.length > 0 ? token : null;
};

const apiAction = async (path, method = 'POST', body) => {
    const token = getSavedToken();
    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
        localStorage.removeItem('auth_token');
        window.dispatchEvent(new Event('admin:unauthorized'));
        throw new Error('Unauthorized');
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};


function useAdminFetch(url, deps = []) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const token = getSavedToken();

    const load = useCallback(async () => {
        if (!url) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/api/admin${url}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setData(json);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [url, token]);

    useEffect(() => { load(); }, [load, ...deps]);

    return { data, loading, error, reload: load };
}

const MinuteInput = ({ value, onChange, disabled }) => {
    const [raw, setRaw] = useState(String(value ?? ''));
    useEffect(() => setRaw(String(value ?? '')), [value]);
    const commit = () => {
        const n = parseFloat(String(raw).replace(',', '.'));
        const v = isNaN(n) || n < 0 ? 0 : Math.min(Math.round(n * 1000) / 1000, 120);
        setRaw(String(v)); onChange(v);
    };
    return (
        <input className="min-input" type="number" min={0} max={120} step="any"
            value={raw} onChange={e => setRaw(e.target.value)} onBlur={commit} disabled={disabled} />
    );
};

const LoginScreen = ({ onLogin }) => {
    const [pw, setPw] = useState('');
    const [loading, setLoad] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
        if (!pw.trim()) return;
        setLoad(true); setError('');
        try {
            const res = await adminLogin('admin', pw);
            localStorage.setItem('auth_token', res.token);
            onLogin(res.token);
        } catch { setError('Неверный пароль'); } finally { setLoad(false); }
    };

    return (
        <div className="login-wrap">
            <div className="login-card">
                <div className="login-logo">АП</div>
                <h2>Админ-панель</h2>
                <p className="login-hint">Курс на карбонаты</p>
                <input type="password" className="login-input" placeholder="Пароль администратора"
                    value={pw} onChange={e => { setPw(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && submit()} autoFocus />
                {error && <div className="login-error">{error}</div>}
                <button className="login-btn" onClick={submit} disabled={loading || !pw.trim()}>
                    {loading ? 'Вход...' : 'Войти →'}
                </button>
            </div>
        </div>
    );
};

const TimersForm = ({ timers, onChange }) => {
    const set = (path, val) => {
        const next = JSON.parse(JSON.stringify(timers));
        const keys = path.split('.');
        let cur = next;
        keys.slice(0, -1).forEach(k => cur = cur[k]);
        cur[keys[keys.length - 1]] = val;
        onChange(next);
    };
    return (
        <div className="timers-form">
            <div className="tf-section">
                <div className="tf-section-title">Карта региона</div>
                {[['Выбор участков', 'regionMap.selection'], ['Аукцион', 'regionMap.auction'], ['Допокупка', 'regionMap.postAuction']].map(([label, path]) => (
                    <div key={path} className="tf-row">
                        <label>{label}</label>
                        <div className="tf-row-right">
                            <MinuteInput value={path.split('.').reduce((o, k) => o[k], timers)} onChange={v => set(path, v)} />
                            <span>мин</span>
                        </div>
                    </div>
                ))}
            </div>
            <div className="tf-section">
                <div className="tf-section-title">НИР · События · Полевые · Результаты (по годам)</div>
                <div className="tf-years-grid">
                    {YEARS.map(y => (
                        <div key={y} className="tf-year-cell">
                            <span className="tf-year-label">Год {y}</span>
                            <MinuteInput value={timers.years[y]} onChange={v => set(`years.${y}`, v)} />
                            <span>м</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ── Редактор стартового окна (кейс) ──────────────────────────────────────────
const normalizeName = (s) => s.trim().toLowerCase();

const IntroContentEditor = ({ value, onChange, hidePresetPicker }) => {
    const intro = value ?? DEFAULT_CASE_INTRO;
    const [presets, setPresets] = useState([]);
    const [presetId, setPresetId] = useState('');
    const [busy, setBusy] = useState(false);
    const [prompt, setPrompt] = useState(null); // null | { mode: 'create' | 'rename' }
    const [promptError, setPromptError] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const setField = (k, v) => onChange({ ...intro, [k]: v });
    const setParagraph = (idx, v) => onChange({ ...intro, paragraphs: intro.paragraphs.map((p, j) => j === idx ? v : p) });
    const addParagraph = () => onChange({ ...intro, paragraphs: [...(intro.paragraphs ?? []), ''] });
    const removeParagraph = (idx) => onChange({ ...intro, paragraphs: intro.paragraphs.filter((_, j) => j !== idx) });

    useEffect(() => {
        if (hidePresetPicker) return;
        getIntroPresets().then(setPresets).catch(() => setPresets([]));
    }, [hidePresetPicker]);

    const selectedPreset = presets.find(p => p.id === presetId) || null;

    const applyPreset = (id) => {
        setPresetId(id);
        if (!id) {
            onChange(JSON.parse(JSON.stringify(DEFAULT_CASE_INTRO)));
            return;
        }
        const preset = presets.find(p => p.id === id);
        if (preset) onChange(preset.introContent ?? JSON.parse(JSON.stringify(DEFAULT_CASE_INTRO)));
    };

    const isDuplicateName = (name, excludeId) =>
        presets.some(p => p.id !== excludeId && normalizeName(p.name) === normalizeName(name));

    const handleCreate = () => { setPromptError(''); setPrompt({ mode: 'create' }); };
    const handleRename = () => { if (!selectedPreset) return; setPromptError(''); setPrompt({ mode: 'rename' }); };

    const handlePromptConfirm = async (rawName) => {
        const name = (rawName || '').trim();
        if (!name) { setPromptError('Укажите название пресета'); return; }
        if (prompt.mode === 'create' && isDuplicateName(name)) {
            setPromptError('Пресет с таким названием уже существует');
            return;
        }
        if (prompt.mode === 'rename' && isDuplicateName(name, selectedPreset.id)) {
            setPromptError('Пресет с таким названием уже существует');
            return;
        }
        setBusy(true);
        try {
            if (prompt.mode === 'create') {
                const created = await createIntroPreset({ name, introContent: intro });
                setPresets(p => [created, ...p]);
                setPresetId(created.id);
            } else {
                const updated = await updateIntroPreset(selectedPreset.id, { name });
                setPresets(p => p.map(x => x.id === updated.id ? updated : x));
            }
            setPrompt(null);
        } catch (e) {
            setPromptError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const handleSave = async () => {
        if (!selectedPreset) return;
        setBusy(true);
        try {
            const updated = await updateIntroPreset(selectedPreset.id, { introContent: intro });
            setPresets(p => p.map(x => x.id === updated.id ? updated : x));
        } catch (e) {
            alert('Ошибка: ' + e.message);
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedPreset) return;
        setBusy(true);
        try {
            await deleteIntroPreset(selectedPreset.id);
            setPresets(p => p.filter(x => x.id !== selectedPreset.id));
            setPresetId('');
        } catch (e) {
            alert('Ошибка: ' + e.message);
        } finally {
            setBusy(false);
            setConfirmDelete(false);
        }
    };

    return (
        <div className="intro-editor-form">
            {!hidePresetPicker && (
                <>
                    <div className="intro-section-label">Пресет</div>
                    <div className="tf-row">
                        <select className="preset-select" style={{ flex: 1 }} value={presetId} onChange={e => applyPreset(e.target.value)}>
                            <option value="">По умолчанию</option>
                            {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="intro-preset-actions">
                        <button className="preset-action-btn paction-create" onClick={handleCreate} disabled={busy}>Сохранить как новый пресет</button>
                        <button className="preset-action-btn paction-save" onClick={handleSave} disabled={busy || !selectedPreset}>Обновить пресет</button>
                        <button className="preset-action-btn paction-rename" onClick={handleRename} disabled={busy || !selectedPreset}>Переименовать пресет</button>
                        <button className="preset-action-btn paction-delete" onClick={() => setConfirmDelete(true)} disabled={busy || !selectedPreset}>Удалить пресет</button>
                    </div>
                </>
            )}

            <div className="intro-section-label">Содержимое окна</div>
            <div className="tf-row">
                <label>Заголовок</label>
                <input className="text-input" type="text" placeholder="Например: Кейс" value={intro.title ?? ''} onChange={e => setField('title', e.target.value)} />
            </div>
            <div className="tf-row">
                <label>Текст кнопки</label>
                <input className="text-input" type="text" placeholder="Например: Начать работу →" value={intro.buttonText ?? ''} onChange={e => setField('buttonText', e.target.value)} />
            </div>
            <div className="fs-title" style={{ marginTop: '.5rem' }}>Параграфы</div>
            {(intro.paragraphs ?? []).map((p, idx) => (
                <div key={idx} className="intro-paragraph-row">
                    <span className="intro-paragraph-num">{idx + 1}</span>
                    <textarea className="intro-paragraph-input" rows={2} placeholder="Текст параграфа…" value={p} onChange={e => setParagraph(idx, e.target.value)} />
                    <button className="ghost-btn" onClick={() => removeParagraph(idx)}>✕</button>
                </div>
            ))}
            <button className="ghost-btn" onClick={addParagraph}>+ Добавить параграф</button>

            {prompt && (
                <PromptModal
                    title={prompt.mode === 'create' ? 'Название нового пресета стартового окна:' : 'Новое название пресета:'}
                    initialValue={prompt.mode === 'rename' ? (selectedPreset?.name ?? '') : ''}
                    confirmLabel={prompt.mode === 'create' ? 'Создать' : 'Сохранить'}
                    error={promptError}
                    onConfirm={handlePromptConfirm}
                    onCancel={() => setPrompt(null)}
                />
            )}
            {confirmDelete && (
                <ConfirmModal
                    message={`Удалить пресет «${selectedPreset?.name}»?`}
                    onConfirm={handleDelete}
                    onCancel={() => setConfirmDelete(false)}
                />
            )}
        </div>
    );
};

const LiveTimersEditor = ({ sessionId, adminSocket }) => {
    const [timers, setTimers] = useState(JSON.parse(JSON.stringify(DEFAULT_TIMERS)));
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!sessionId) return;
        setSaved(false); setLoading(true);
        getAdminSessionDetails(sessionId)
            .then(s => {
                const years = { ...DEFAULT_TIMERS.years };
                Object.entries(s.timers || {}).forEach(([y, v]) => { const n = Number(y); if (n >= 1 && n <= 10) years[n] = Number(v); });
                setTimers({
                    regionMap: {
                        selection: Number(s.regionMapTimers?.selection ?? DEFAULT_TIMERS.regionMap.selection),
                        auction: Number(s.regionMapTimers?.auction ?? DEFAULT_TIMERS.regionMap.auction),
                        postAuction: Number(s.regionMapTimers?.postAuction ?? DEFAULT_TIMERS.regionMap.postAuction),
                    },
                    years,
                });
            })
            .catch(() => setTimers(JSON.parse(JSON.stringify(DEFAULT_TIMERS))))
            .finally(() => setLoading(false));
    }, [sessionId]);

    const handleApply = async () => {
        setSaving(true); setSaved(false);
        try {
            adminSocket?.current?.emit('admin:updateTimers', { sessionId, yearTimers: timers.years, regionMapTimers: timers.regionMap, regionMapTimer: timers.regionMap.selection });
            await apiAction(`/api/admin/sessions/${sessionId}/timers`, 'PATCH', { yearTimers: timers.years, regionMapTimers: timers.regionMap, regionMapTimer: timers.regionMap.selection });
            setSaved(true); setTimeout(() => setSaved(false), 2500);
        } catch (e) { alert('Ошибка: ' + e.message); } finally { setSaving(false); }
    };

    return (
        <div className="live-editor">
            <div className="live-editor-head">
                <span>Изменить таймеры</span>
                <button className="ghost-btn" onClick={() => setTimers(JSON.parse(JSON.stringify(DEFAULT_TIMERS)))}>↺ сброс</button>
            </div>
            {loading ? <div className="live-editor-loading">Загрузка…</div> : <TimersForm timers={timers} onChange={setTimers} />}
            <button className={`apply-btn ${saved ? 'apply-btn-saved' : ''}`} onClick={handleApply} disabled={saving || loading || !sessionId}>
                {saving ? 'Применяю…' : saved ? 'Применено!' : 'Применить к сессии'}
            </button>
            <p className="apply-hint">Новое время вступит в силу при следующей смене фазы или года.</p>
        </div>
    );
};

const IntroEditor = ({ sessionId }) => {
    const [intro, setIntro] = useState(JSON.parse(JSON.stringify(DEFAULT_CASE_INTRO)));
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!sessionId) return;
        setSaved(false); setLoading(true);
        getAdminSessionDetails(sessionId)
            .then(s => setIntro(s.introContent ?? JSON.parse(JSON.stringify(DEFAULT_CASE_INTRO))))
            .catch(() => setIntro(JSON.parse(JSON.stringify(DEFAULT_CASE_INTRO))))
            .finally(() => setLoading(false));
    }, [sessionId]);

    const handleSave = async () => {
        setSaving(true); setSaved(false);
        try {
            await updateSessionIntro(sessionId, intro);
            setSaved(true); setTimeout(() => setSaved(false), 2500);
        } catch (e) { alert('Ошибка: ' + e.message); } finally { setSaving(false); }
    };

    return (
        <div className="live-editor">
            <div className="live-editor-head">
                <span>Стартовое окно (кейс)</span>
                <button className="ghost-btn" onClick={() => setIntro(JSON.parse(JSON.stringify(DEFAULT_CASE_INTRO)))}>↺ сброс</button>
            </div>
            {loading ? <div className="live-editor-loading">Загрузка…</div> : <IntroContentEditor value={intro} onChange={setIntro} />}
            <button className={`apply-btn ${saved ? 'apply-btn-saved' : ''}`} onClick={handleSave} disabled={saving || loading || !sessionId}>
                {saving ? 'Сохраняю…' : saved ? 'Сохранено!' : 'Сохранить'}
            </button>
        </div>
    );
};

const ConfirmModal = ({ message, onConfirm, onCancel }) => (
    <div className="cm-overlay" onClick={onCancel}>
        <div className="cm-box" onClick={e => e.stopPropagation()}>
            <p className="cm-message">{message}</p>
            <div className="cm-actions">
                <button className="cm-btn cm-btn-cancel" onClick={onCancel}>Отмена</button>
                <button className="cm-btn cm-btn-confirm" onClick={onConfirm}>Подтвердить</button>
            </div>
        </div>
    </div>
);

const PromptModal = ({ title, initialValue = '', confirmLabel = 'ОК', error, onConfirm, onCancel }) => {
    const [value, setValue] = useState(initialValue);
    return (
        <div className="cm-overlay" onClick={onCancel}>
            <div className="cm-box" onClick={e => e.stopPropagation()}>
                <p className="cm-message">{title}</p>
                <input
                    className="cm-input"
                    type="text"
                    autoFocus
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && onConfirm(value)}
                />
                {error && <p className="cm-error">{error}</p>}
                <div className="cm-actions">
                    <button className="cm-btn cm-btn-cancel" onClick={onCancel}>Отмена</button>
                    <button className="cm-btn cm-btn-confirm" onClick={() => onConfirm(value)}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
};

const TimerControl = ({ sessionId, sessions, adminSocket, onRefresh, openConfirm }) => {
    const [timer, setTimer] = useState(null);
    const [connected, setConn] = useState(false);
    const [phase, setPhase_] = useState('RESEARCH');
    const [starting, setStarting] = useState(false);

    const sess = sessions?.find(s => s.id === sessionId);
    const status = sess?.status ?? 'waiting';

    useEffect(() => {
        const sock = adminSocket?.current;
        if (!sock) return;
        const onConn = () => setConn(true);
        const onDisc = () => setConn(false);
        const onState = d => setTimer(d);
        const onTick = d => setTimer(p => p ? { ...p, ...d } : d);
        sock.on('connect', onConn); sock.on('disconnect', onDisc);
        sock.on('timer:state', onState); sock.on('timer:tick', onTick);
        setConn(sock.connected);
        return () => { sock.off('connect', onConn); sock.off('disconnect', onDisc); sock.off('timer:state', onState); sock.off('timer:tick', onTick); };
    }, [adminSocket]);

    useEffect(() => {
        const sock = adminSocket?.current;
        if (!sock || !sessionId) return;
        sock.emit('admin:joinSession', { sessionId }); setTimer(null);
    }, [sessionId, adminSocket]);

    const emit = (ev, extra = {}) => adminSocket?.current?.emit(ev, { sessionId, ...extra });

    const handleStart = async () => {
        setStarting(true);
        try { await apiAction(`/api/admin/sessions/${sessionId}/start`); onRefresh?.(); }
        catch (e) { alert('Ошибка: ' + e.message); } finally { setStarting(false); }
    };
    const handleStop = () => {
        openConfirm('Завершить сессию?', async () => {
            try { await apiAction(`/api/admin/sessions/${sessionId}/stop`); onRefresh?.(); }
            catch (e) { alert('Ошибка: ' + e.message); }
        });
    };
    const handleReactivate = () => {
        openConfirm('Вернуть сессию в статус "В процессе"?', async () => {
            try { await apiAction(`/api/admin/sessions/${sessionId}/reactivate`); onRefresh?.(); }
            catch (e) { alert('Ошибка: ' + e.message); }
        });
    };

    if (!sessionId) return <div className="tc-empty">Выберите сессию из списка выше</div>;

    return (
        <div className="tc-panel">
            {/* ── Левая панель: дисплей ── */}
            <div className="tc-display-hero">
                <div className="tc-time">{timer ? fmt(timer.timeRemaining) : '--:--'}</div>
                {timer ? (
                    <div className="tc-meta">
                        <span>Год {timer.currentYear} / 10</span>
                        <span className="tc-phase-label">{PHASE_LABELS[timer.phase] ?? timer.phase}</span>
                    </div>
                ) : (
                    <div className="tc-meta">Таймер не запущен</div>
                )}
                <span className={`tc-badge tc-badge-hero ${timer?.isRunning && !timer?.isPaused ? 'tc-run' : timer?.isPaused ? 'tc-pause' : 'tc-stop'}`}>
                    {timer?.isRunning && !timer?.isPaused ? '● Идёт' : timer?.isPaused ? '‖ Пауза' : '■ Стоп'}
                </span>
                {timer?.pendingRefusal && <div className="tc-refusal">Отказ — {fmt(timer.refusalTimeLeft)}</div>}
                <div className="tc-status">
                    <span className={`dot ${connected ? 'dot-on' : 'dot-off'}`} />
                    <span>{connected ? 'Подключено' : 'Нет связи'}</span>
                    <code className="tc-sid">{sessionId.slice(0, 8)}…</code>
                </div>
            </div>

            {/* ── Правая панель: контролы ── */}
            <div className="tc-controls">

                {/* Сессия */}
                <div className="tc-ctrl-row">
                    <span className="tc-ctrl-label">Сессия</span>
                    <div className="tc-ctrl-btns">
                        {status === 'waiting' && (
                            <button className="tc-start-btn" onClick={handleStart} disabled={!connected || starting}>
                                {starting ? 'Запуск…' : '▶ Старт сессии'}
                            </button>
                        )}
                        {status === 'active' && (
                            <>
                                <span className="tc-active-label">● Активна</span>
                                <button className="tc-stop-btn" onClick={handleStop}>■ Завершить</button>
                            </>
                        )}
                        {status === 'finished' && (
                            <>
                                <span className="tc-finished-label">Завершена</span>
                                <button className="tc-start-btn" onClick={handleReactivate}>↺ В процесс</button>
                            </>
                        )}
                    </div>
                </div>

                <div className="tc-ctrl-divider" />

                {/* Таймер */}
                <div className="tc-ctrl-row">
                    <span className="tc-ctrl-label">Таймер</span>
                    <div className="tc-ctrl-btns">
                        <button className="tb tb-green" onClick={() => emit('admin:startTimer')} disabled={!connected || (timer?.isRunning && !timer?.isPaused)}>▶ Старт</button>
                        <button className="tb tb-yellow" onClick={() => emit(timer?.isPaused ? 'admin:resumeTimer' : 'admin:pauseTimer')} disabled={!connected || !timer?.isRunning}>
                            {timer?.isPaused ? '▶ Продолжить' : '‖ Пауза'}
                        </button>
                    </div>
                </div>

                {/* Год */}
                <div className="tc-ctrl-row">
                    <span className="tc-ctrl-label">Год</span>
                    <div className="tc-ctrl-btns">
                        <button className="tb tb-gray" onClick={() => emit('admin:advanceYear')} disabled={!connected}>→ Следующий год</button>
                        <button className="tb tb-gray tb-danger" onClick={() => openConfirm('Сбросить к году 1?', () => emit('admin:resetTimer'))} disabled={!connected}>↺ Сброс</button>
                    </div>
                </div>

                <div className="tc-ctrl-divider" />

                {/* Фаза */}
                <div className="tc-ctrl-row">
                    <span className="tc-ctrl-label">Фаза</span>
                    <div className="tc-ctrl-btns tc-ctrl-btns--phase">
                        <select className="tc-select tc-select-phase" value={phase} onChange={e => setPhase_(e.target.value)}>
                            {ALL_PHASES.map(p => <option key={p} value={p}>{PHASE_LABELS[p] ?? p}</option>)}
                        </select>
                        <button className="tb tb-gray" onClick={() => emit('admin:setPhase', { phase })} disabled={!connected}>Применить</button>
                    </div>
                </div>

            </div>
        </div>
    );
};

// ── Сворачиваемый блок (аккордеон) ───────────────────────────────────────────
const CollapsibleSection = ({ title, extra, defaultOpen = false, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="fs">
            <div className="fs-title-row collapsible-header" onClick={() => setOpen(o => !o)}>
                <span className="fs-title">
                    <span className={`collapsible-arrow ${open ? 'collapsible-arrow-open' : ''}`}>▸</span>
                    {title}
                </span>
                {extra && <span onClick={e => e.stopPropagation()}>{extra}</span>}
            </div>
            {open && children}
        </div>
    );
};

const CreateSessionTab = ({ onGoToControl }) => {
    const [step, setStep] = useState('form');
    const [loading, setLoad] = useState(false);
    const [error, setError] = useState('');
    const [created, setCreated] = useState(null);
    const [copied, setCopied] = useState(false);
    const [presets, setPresets] = useState([]);
    const [presetId, setPresetId] = useState('');

    const [form, setForm] = useState({
        gameMode: 'online', playerType: 'students', maxLUs: 3,
        budgets: { ...BUDGET_DEFAULTS },
        timers: JSON.parse(JSON.stringify(DEFAULT_TIMERS)),
        introContent: JSON.parse(JSON.stringify(DEFAULT_CASE_INTRO)),
    });
    const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

    useEffect(() => {
        getPresets().then(setPresets).catch(() => setPresets([]));
    }, []);

    const applyPreset = (id) => {
        setPresetId(id);
        if (!id) return;
        const preset = presets.find(p => p.id === id);
        if (!preset) return;
        setForm(f => ({
            ...f,
            gameMode: preset.gameMode ?? f.gameMode,
            playerType: preset.playerType ?? f.playerType,
            maxLUs: preset.maxLUsPerTeam ?? f.maxLUs,
            budgets: { ...f.budgets, [preset.playerType]: preset.budget ?? f.budgets[preset.playerType] },
            timers: timersFromConfig(preset),
            introContent: preset.introContent ?? JSON.parse(JSON.stringify(DEFAULT_CASE_INTRO)),
        }));
    };

    const handleCreate = async () => {
        setError(''); setLoad(true);
        try {
            const token = getSavedToken();
            const r = await fetch(`${API_URL}/api/admin/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ gameMode: form.gameMode, playerType: form.playerType, maxLUsPerTeam: form.maxLUs, budget: form.budgets[form.playerType], budgets: form.budgets, regionMapTimers: form.timers.regionMap, timers: form.timers.years, introContent: form.introContent }),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const res = await r.json();
            setCreated(res); setStep('done');
        } catch (e) { setError(e.message); } finally { setLoad(false); }
    };

    if (step === 'done' && created) {
        return (
            <div className="created-screen">
                <div className="created-icon created-icon-ok">✓</div>
                <h2>Сессия создана!</h2>
                <div className="code-box">
                    <div className="code-label">Код для команд</div>
                    <div className="code-value">{created.sessionCode}</div>
                    <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(created.sessionCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                        {copied ? '✓ Скопировано' : 'Копировать'}
                    </button>
                </div>
                <p className="created-hint">Таймер → выберите сессию → нажмите «Старт сессии»</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button className="create-btn" onClick={() => onGoToControl?.(created.id)}>Перейти к управлению →</button>
                    <button className="secondary-btn" onClick={() => { setStep('form'); setCreated(null); setCopied(false); }}>+ Создать ещё</button>
                </div>
            </div>
        );
    }

    return (
        <div className="create-form">
            <div className="create-form-left">
                {presets.length > 0 && (
                    <div className="fs">
                        <div className="fs-title">Пресет</div>
                        <select className="text-input" value={presetId} onChange={e => applyPreset(e.target.value)}>
                            <option value="">— не выбран —</option>
                            {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                )}
                <div className="fs">
                    <div className="fs-title">Режим игры</div>
                    <div className="toggle-row">
                        {[['online', 'Онлайн'], ['solo', 'Одиночная']].map(([v, l]) => (
                            <button key={v} className={`tog ${form.gameMode === v ? 'tog-on' : ''}`} onClick={() => sf('gameMode', v)}>{l}</button>
                        ))}
                    </div>
                </div>
                <div className="fs">
                    <div className="fs-title">Тип игроков</div>
                    <div className="toggle-row">
                        {[['students', 'Студенты'], ['professionals', 'Профессионалы']].map(([v, l]) => (
                            <button key={v} className={`tog ${form.playerType === v ? 'tog-on' : ''}`} onClick={() => sf('playerType', v)}>{l}</button>
                        ))}
                    </div>
                </div>
                <div className="fs">
                    <div className="fs-title">Бюджеты (млн ₽)</div>
                    {[['students', 'Студенты'], ['professionals', 'Профессионалы']].map(([key, label]) => (
                        <div key={key} className="tf-row">
                            <label>{label}</label>
                            <div className="tf-row-right">
                                <input className="num-input" type="number" min={1} value={form.budgets[key]}
                                    onChange={e => setForm(f => ({ ...f, budgets: { ...f.budgets, [key]: Number(e.target.value) } }))} />
                                <span>млн</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="fs">
                    <div className="fs-title">Лицензионные участки</div>
                    <div className="tf-row">
                        <label>Макс. ЛУ на команду</label>
                        <div className="tf-row-right">
                            <input className="num-input" type="number" min={3} max={5} value={form.maxLUs}
                                onChange={e => sf('maxLUs', Math.max(3, Math.min(5, Number(e.target.value))))} />
                            <span>(3–5)</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="create-form-right">
                <div className="fs">
                    <div className="fs-title-row">
                        <span className="fs-title">Таймеры</span>
                        <button className="ghost-btn" onClick={() => sf('timers', JSON.parse(JSON.stringify(DEFAULT_TIMERS)))}>↺ Сброс</button>
                    </div>
                    <TimersForm timers={form.timers} onChange={v => sf('timers', v)} />
                </div>
                <CollapsibleSection
                    title="Стартовое окно (кейс)"
                    extra={<button className="ghost-btn" onClick={() => sf('introContent', JSON.parse(JSON.stringify(DEFAULT_CASE_INTRO)))}>↺ Сброс</button>}
                >
                    <IntroContentEditor value={form.introContent} onChange={v => sf('introContent', v)} />
                </CollapsibleSection>
                {error && <div className="form-error">{error}</div>}
                <button className="create-btn" onClick={handleCreate} disabled={loading}>
                    {loading ? 'Создание…' : 'Создать сессию'}
                </button>
            </div>
        </div>
    );
};

// ── Пресеты ────────────────────────────────────────────────────────────────

const PresetForm = ({ initial, onSave, onCancel, saving, existingNames = [] }) => {
    const [form, setForm] = useState(() => ({
        name: initial?.name ?? '',
        gameMode: initial?.gameMode ?? 'online',
        playerType: initial?.playerType ?? 'students',
        maxLUs: initial?.maxLUsPerTeam ?? 3,
        budgets: { ...BUDGET_DEFAULTS, ...(initial ? { [initial.playerType]: initial.budget } : {}) },
        timers: timersFromConfig(initial),
        introContent: initial?.introContent ?? JSON.parse(JSON.stringify(DEFAULT_CASE_INTRO)),
        adminNotes: initial?.adminNotes ?? '',
    }));
    const [nameError, setNameError] = useState('');
    const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = () => {
        const trimmed = form.name.trim();
        if (!trimmed) { setNameError('Укажите название пресета'); return; }
        if (existingNames.some(n => normalizeName(n) === normalizeName(trimmed))) {
            setNameError('Пресет с таким названием уже существует');
            return;
        }
        setNameError('');
        onSave({
            name: form.name.trim(),
            gameMode: form.gameMode,
            playerType: form.playerType,
            maxLUsPerTeam: form.maxLUs,
            budget: form.budgets[form.playerType],
            budgets: form.budgets,
            regionMapTimers: form.timers.regionMap,
            timers: form.timers.years,
            introContent: form.introContent,
            adminNotes: form.adminNotes,
        });
    };

    return (
        <div className="create-form">
            <div className="create-form-left">
                <div className="fs">
                    <div className="fs-title">Название пресета</div>
                    <input className="text-input" type="text" value={form.name} onChange={e => { sf('name', e.target.value); setNameError(''); }} placeholder="Например: Демо для студентов" />
                    {nameError && <p className="cm-error" style={{ textAlign: 'left' }}>{nameError}</p>}
                </div>
                <div className="fs">
                    <div className="fs-title">Режим игры</div>
                    <div className="toggle-row">
                        {[['online', 'Онлайн'], ['solo', 'Одиночная']].map(([v, l]) => (
                            <button key={v} className={`tog ${form.gameMode === v ? 'tog-on' : ''}`} onClick={() => sf('gameMode', v)}>{l}</button>
                        ))}
                    </div>
                </div>
                <div className="fs">
                    <div className="fs-title">Тип игроков</div>
                    <div className="toggle-row">
                        {[['students', 'Студенты'], ['professionals', 'Профессионалы']].map(([v, l]) => (
                            <button key={v} className={`tog ${form.playerType === v ? 'tog-on' : ''}`} onClick={() => sf('playerType', v)}>{l}</button>
                        ))}
                    </div>
                </div>
                <div className="fs">
                    <div className="fs-title">Бюджеты (млн ₽)</div>
                    {[['students', 'Студенты'], ['professionals', 'Профессионалы']].map(([key, label]) => (
                        <div key={key} className="tf-row">
                            <label>{label}</label>
                            <div className="tf-row-right">
                                <input className="num-input" type="number" min={1} value={form.budgets[key]}
                                    onChange={e => setForm(f => ({ ...f, budgets: { ...f.budgets, [key]: Number(e.target.value) } }))} />
                                <span>млн</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="fs">
                    <div className="fs-title">Лицензионные участки</div>
                    <div className="tf-row">
                        <label>Макс. ЛУ на команду</label>
                        <div className="tf-row-right">
                            <input className="num-input" type="number" min={3} max={5} value={form.maxLUs}
                                onChange={e => sf('maxLUs', Math.max(3, Math.min(5, Number(e.target.value))))} />
                            <span>(3–5)</span>
                        </div>
                    </div>
                </div>
                <div className="fs">
                    <div className="fs-title">Заметки</div>
                    <textarea className="intro-paragraph-input" rows={2} value={form.adminNotes} onChange={e => sf('adminNotes', e.target.value)} />
                </div>
            </div>
            <div className="create-form-right">
                <div className="fs">
                    <div className="fs-title-row">
                        <span className="fs-title">Таймеры</span>
                        <button className="ghost-btn" onClick={() => sf('timers', JSON.parse(JSON.stringify(DEFAULT_TIMERS)))}>↺ Сброс</button>
                    </div>
                    <TimersForm timers={form.timers} onChange={v => sf('timers', v)} />
                </div>
                <CollapsibleSection
                    title="Стартовое окно (кейс)"
                    extra={<button className="ghost-btn" onClick={() => sf('introContent', JSON.parse(JSON.stringify(DEFAULT_CASE_INTRO)))}>↺ Сброс</button>}
                >
                    <IntroContentEditor value={form.introContent} onChange={v => sf('introContent', v)} />
                </CollapsibleSection>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="create-btn" onClick={handleSave} disabled={saving}>
                        {saving ? 'Сохранение…' : 'Сохранить пресет'}
                    </button>
                    <button className="secondary-btn" onClick={onCancel}>Отмена</button>
                </div>
            </div>
        </div>
    );
};

// ── Редактор отдельного пресета стартового окна ──────────────────────────────
const IntroPresetEditor = ({ initial, onSave, onCancel, saving, existingNames = [] }) => {
    const [name, setName] = useState(initial?.name ?? '');
    const [intro, setIntro] = useState(initial?.introContent ?? JSON.parse(JSON.stringify(DEFAULT_CASE_INTRO)));
    const [nameError, setNameError] = useState('');

    const handleSave = () => {
        const trimmed = name.trim();
        if (!trimmed) { setNameError('Укажите название пресета'); return; }
        if (existingNames.some(n => normalizeName(n) === normalizeName(trimmed))) {
            setNameError('Пресет с таким названием уже существует');
            return;
        }
        setNameError('');
        onSave({ name: trimmed, introContent: intro });
    };

    return (
        <div className="fs">
            <div className="fs-title">Название пресета</div>
            <input className="text-input" type="text" value={name} onChange={e => { setName(e.target.value); setNameError(''); }} placeholder="Например: Альтернативный кейс" />
            {nameError && <p className="cm-error" style={{ textAlign: 'left' }}>{nameError}</p>}
            <div className="fs-title" style={{ marginTop: '.75rem' }}>Содержимое</div>
            <IntroContentEditor value={intro} onChange={setIntro} hidePresetPicker />
            <div style={{ display: 'flex', gap: 10, marginTop: '.75rem' }}>
                <button className="create-btn" onClick={handleSave} disabled={saving}>
                    {saving ? 'Сохранение…' : 'Сохранить'}
                </button>
                <button className="secondary-btn" onClick={onCancel}>Отмена</button>
            </div>
        </div>
    );
};

// ── Пресеты стартового окна (список) ─────────────────────────────────────────
const IntroPresetsSection = () => {
    const [presets, setPresets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(null); // null | 'new' | preset
    const [saving, setSaving] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const load = () => {
        setLoading(true);
        getIntroPresets().then(setPresets).catch(() => setPresets([])).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    const handleSave = async (data) => {
        setSaving(true);
        try {
            if (editing === 'new') await createIntroPreset(data);
            else await updateIntroPreset(editing.id, data);
            setEditing(null);
            load();
        } catch (e) { alert('Ошибка: ' + e.message); } finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        try { await deleteIntroPreset(id); load(); } catch (e) { alert('Ошибка: ' + e.message); } finally { setConfirmDeleteId(null); }
    };

    if (editing) {
        const existingNames = presets.filter(p => editing === 'new' || p.id !== editing.id).map(p => p.name);
        return <IntroPresetEditor initial={editing === 'new' ? null : editing} onSave={handleSave} onCancel={() => setEditing(null)} saving={saving} existingNames={existingNames} />;
    }

    return (
        <div className="fs">
            <div className="fs-title-row">
                <span className="fs-title">Пресеты стартового окна</span>
                <button className="ghost-btn" onClick={() => setEditing('new')}>+ Создать</button>
            </div>
            {loading && <div className="live-editor-loading">Загрузка…</div>}
            {!loading && presets.length === 0 && <p className="ap-empty">Нет сохранённых пресетов.</p>}
            {presets.map(p => (
                <div key={p.id} className="tf-row">
                    <label>{p.name}</label>
                    <div className="tf-row-right">
                        <button className="ghost-btn" onClick={() => setEditing(p)}>Изменить</button>
                        <button className="ghost-btn" onClick={() => setConfirmDeleteId(p.id)}>Удалить</button>
                    </div>
                </div>
            ))}
            {confirmDeleteId && (
                <ConfirmModal
                    message={`Удалить пресет «${presets.find(p => p.id === confirmDeleteId)?.name}»?`}
                    onConfirm={() => handleDelete(confirmDeleteId)}
                    onCancel={() => setConfirmDeleteId(null)}
                />
            )}
        </div>
    );
};

const PresetsTab = () => {
    const [presets, setPresets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(null); // null | 'new' | preset
    const [saving, setSaving] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const load = () => {
        setLoading(true);
        getPresets().then(setPresets).catch(() => setPresets([])).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    const handleSave = async (data) => {
        setSaving(true);
        try {
            if (editing === 'new') await createPreset(data);
            else await updatePreset(editing.id, data);
            setEditing(null);
            load();
        } catch (e) { alert('Ошибка: ' + e.message); } finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        try { await deletePreset(id); load(); } catch (e) { alert('Ошибка: ' + e.message); } finally { setConfirmDeleteId(null); }
    };

    if (editing) {
        return <PresetForm initial={editing === 'new' ? null : editing} onSave={handleSave} onCancel={() => setEditing(null)} saving={saving} existingNames={presets.filter(p => editing === 'new' || p.id !== editing.id).map(p => p.name)} />;
    }

    return (
        <div>
            <div className="fs-title-row">
                <h2 style={{ margin: 0 }}>Пресеты</h2>
                <button className="create-btn" onClick={() => setEditing('new')}>+ Создать пресет</button>
            </div>
            {loading && <div className="ap-loading">Загрузка…</div>}
            {!loading && presets.length === 0 && <p className="ap-empty">Нет сохранённых пресетов.</p>}
            <div className="sessions-grid">
                {presets.map(p => (
                    <div key={p.id} className="session-card">
                        <div className="sc-header">
                            <strong>{p.name}</strong>
                        </div>
                        <div style={{ fontSize: '.85rem', color: 'var(--text3)', display: 'flex', flexDirection: 'column', gap: 2, marginBottom: '.5rem' }}>
                            <span>{p.gameMode === 'online' ? 'Онлайн' : 'Одиночная'} · {p.playerType === 'students' ? 'Студенты' : 'Профессионалы'}</span>
                            <span>Бюджет: {fmtMln(p.budget)} млн · Макс. ЛУ: {p.maxLUsPerTeam}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="ghost-btn" onClick={() => setEditing(p)}>Редактировать</button>
                            <button className="ghost-btn" onClick={() => setConfirmDeleteId(p.id)}>Удалить</button>
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ marginTop: '1rem' }}>
                <IntroPresetsSection />
            </div>
            {confirmDeleteId && (
                <ConfirmModal
                    message={`Удалить пресет «${presets.find(p => p.id === confirmDeleteId)?.name}»?`}
                    onConfirm={() => handleDelete(confirmDeleteId)}
                    onCancel={() => setConfirmDeleteId(null)}
                />
            )}
        </div>
    );
};

// ── Вспомогательные компоненты мониторинга ────────────────────────────────────

const fmtNumber = (n) => (n ?? 0).toLocaleString('ru-RU');
const fmtSigned = (n) => { const v = n ?? 0; return (v >= 0 ? '+' : '') + fmtNumber(v); };

const MetricCard = ({ label, value, sub, color = '#334155', accent = false }) => (
    <div style={{
        background: accent ? '#1e3a5f' : '#f8fafc',
        border: `1.5px solid ${accent ? '#3b82f6' : '#e2e8f0'}`,
        borderRadius: 10, padding: '14px 18px', minWidth: 140,
    }}>
        <div style={{ fontSize: 11, color: accent ? '#93c5fd' : '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: accent ? '#fff' : color }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: accent ? '#93c5fd' : '#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
);

const AccuracyBadge = ({ correct, wrong }) => {
    const total = correct + wrong;
    if (!total) return <span style={{ color: '#94a3b8', fontSize: 12 }}>нет данных</span>;
    const pct = Math.round(100 * correct / total);
    const color = pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626';
    return (
        <span style={{ fontWeight: 600, color }}>
            {correct}✓ / {wrong}✗ &nbsp;
            <span style={{ fontSize: 12, color, background: color + '18', padding: '1px 6px', borderRadius: 4 }}>{pct}%</span>
        </span>
    );
};

// ── Модалка детального просмотра карточки события ─────────────────────────────
const CardAnswerModal = ({ card, onClose }) => {
    if (!card) return null;
    const { question, options, selectedAnswers, correctAnswer, isCorrect, points, skipped, cardType } = card;
    const correctArr = Array.isArray(correctAnswer) ? correctAnswer : (correctAnswer != null ? [correctAnswer] : []);
    const selectedArr = Array.isArray(selectedAnswers) ? selectedAnswers : [];

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 560, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxHeight: '85vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: 4 }}>
                            {cardType === 'opportunity' ? 'Возможность' : cardType === 'random' ? 'Случайность' : 'Риск'}
                        </span>
                        {skipped && <span style={{ marginLeft: 8, fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>пропущено</span>}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b', lineHeight: 1 }}>✕</button>
                </div>
                {question && <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 18, lineHeight: 1.5 }}>{question}</div>}
                {options && options.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                        {options.map((opt, i) => {
                            const isSel = selectedArr.includes(i);
                            const isCorr = correctArr.includes(i);
                            let bg = '#f8fafc', border = '#e2e8f0', textColor = '#334155';
                            if (isSel && isCorr) { bg = '#dcfce7'; border = '#16a34a'; textColor = '#15803d'; }
                            else if (isSel && !isCorr) { bg = '#fee2e2'; border = '#dc2626'; textColor = '#b91c1c'; }
                            else if (!isSel && isCorr) { bg = '#f0fdf4'; border = '#86efac'; textColor = '#166534'; }
                            return (
                                <div key={i} style={{ padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${border}`, background: bg, color: textColor, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontWeight: 700, minWidth: 20 }}>{i + 1}.</span>
                                    <span style={{ flex: 1 }}>{opt}</span>
                                    {isSel && isCorr && <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>✓</span>}
                                    {isSel && !isCorr && <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>✗</span>}
                                    {!isSel && isCorr && <span style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>← правильный</span>}
                                </div>
                            );
                        })}
                    </div>
                )}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: isCorrect ? '#16a34a' : skipped ? '#64748b' : '#dc2626' }}>
                        {skipped ? 'Пропущено' : isCorrect ? '✓ Правильно' : '✗ Неправильно'}
                    </span>
                    <span style={{ fontSize: 13, color: '#64748b' }}>Очков: <strong>{points > 0 ? '+' + points : points}</strong></span>
                </div>
            </div>
        </div>
    );
};

// ── Строка с карточками-ответами одного ЛУ (события) ─────────────────────────
const EventLineDetail = ({ line }) => {
    const [openCard, setOpenCard] = useState(null);
    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>Участок {line.luId}</span>
                <AccuracyBadge correct={line.correctAnswers} wrong={line.wrongAnswers} />
                <span style={{ fontSize: 13, color: '#64748b' }}>Счёт: <strong style={{ color: line.score >= 0 ? '#16a34a' : '#dc2626' }}>{fmtSigned(line.score)}</strong></span>
                {line.moneyDelta !== 0 && <span style={{ fontSize: 13, color: '#64748b' }}>Деньги: <strong style={{ color: line.moneyDelta >= 0 ? '#16a34a' : '#dc2626' }}>{fmtSigned(line.moneyDelta)} млн</strong></span>}
                {line.skipped && <span style={{ fontSize: 12, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 4 }}>Пропущено</span>}
                {line.completed && !line.skipped && <span style={{ fontSize: 12, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 4 }}>Завершено</span>}
            </div>
            {line.cards && line.cards.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 8 }}>
                    {line.cards.filter(c => c.cardType === 'opportunity').map((card, i) => {
                        const bg = card.skipped ? '#f1f5f9' : card.isCorrect ? '#dcfce7' : '#fee2e2';
                        const border = card.skipped ? '#cbd5e1' : card.isCorrect ? '#86efac' : '#fca5a5';
                        const icon = card.skipped ? '–' : card.isCorrect ? '✓' : '✗';
                        return (
                            <button key={i} onClick={() => setOpenCard(card)} title="Нажмите для просмотра" style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span>{icon}</span>
                                <span>Карт. {card.cardIndex + 1}</span>
                                {card.points > 0 && <span style={{ color: '#16a34a' }}>+{card.points}</span>}
                            </button>
                        );
                    })}
                    {line.cards.filter(c => c.cardType === 'opportunity').length === 0 && (
                        <span style={{ fontSize: 12, color: '#94a3b8', paddingLeft: 4 }}>Нет карточек-вопросов</span>
                    )}
                </div>
            )}
            {openCard && <CardAnswerModal card={openCard} onClose={() => setOpenCard(null)} />}
        </div>
    );
};

// ── Блок полевых работ одного ЛУ ─────────────────────────────────────────────
const FieldworkLUDetail = ({ lu }) => {
    const [expanded, setExpanded] = useState(false);

    const rankColor = (rank) => rank ? RANK_COLORS[rank] || '#64748b' : '#94a3b8';
    const rankLabel = (rank) => rank ? (RANK_LABELS[rank] || `Ранг ${rank}`) : 'Не выбрано';

    const totalSelected = lu.blocks
        ? lu.blocks.reduce((s, b) => s + b.cards.filter(c => !c.skipped && c.chosenRank != null).length, 0)
        : 0;
    const totalCards = lu.blocks
        ? lu.blocks.reduce((s, b) => s + b.cards.length, 0)
        : 0;

    return (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
            {/* Заголовок ЛУ */}
            <div
                onClick={() => setExpanded(e => !e)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f8fafc', cursor: 'pointer', userSelect: 'none' }}
            >
                <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>Участок {lu.luId}</span>
                <span style={{ fontSize: 12, color: '#64748b' }}>{fmtNumber(lu.totalCost)} млн</span>
                {lu.qualityScore > 0 && (
                    <span style={{ fontSize: 12, background: '#dcfce7', color: '#15803d', padding: '1px 8px', borderRadius: 4, fontWeight: 600 }}>
                        ★ Качество {lu.qualityScore}
                    </span>
                )}
                {lu.avgRank && (
                    <span style={{ fontSize: 12, color: rankColor(Math.round(lu.avgRank)), background: rankColor(Math.round(lu.avgRank)) + '18', padding: '1px 8px', borderRadius: 4 }}>
                        Ср. ранг {lu.avgRank?.toFixed(1)}
                    </span>
                )}
                {totalCards > 0 && (
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                        {totalSelected}/{totalCards} карточек
                    </span>
                )}
                {lu.completed && <span style={{ fontSize: 12, background: '#dcfce7', color: '#15803d', padding: '1px 8px', borderRadius: 4 }}>✓ Подтверждено</span>}
                <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 14 }}>{expanded ? '▲' : '▼'}</span>
            </div>

            {/* Детальные блоки карточек */}
            {expanded && lu.blocks && lu.blocks.length > 0 && (
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {lu.blocks.map(block => {
                        const style = GROUP_COLOR_STYLES[block.groupColor] || GROUP_COLOR_STYLES.gray;
                        return (
                            <div key={block.blockId} style={{ border: `1px solid ${style.border}`, borderRadius: 8, overflow: 'hidden' }}>
                                {/* Заголовок блока */}
                                <div style={{ padding: '6px 12px', background: style.bg, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: style.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        {style.label}
                                    </span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{block.blockTitle}</span>
                                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{block.groupLabel}</span>
                                </div>
                                {/* Карточки блока */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                    {block.cards.map((card, ci) => (
                                        <div key={card.cardId} style={{
                                            padding: '8px 12px',
                                            borderTop: ci > 0 ? '1px solid #f1f5f9' : 'none',
                                            display: 'flex', alignItems: 'flex-start', gap: 12,
                                            background: card.skipped ? '#fafafa' : '#fff',
                                        }}>
                                            {/* Название карточки */}
                                            <div style={{ minWidth: 140, fontSize: 12, color: '#64748b', paddingTop: 2 }}>
                                                {card.cardTitle}
                                            </div>
                                            {/* Выбранный вариант */}
                                            <div style={{ flex: 1 }}>
                                                {card.skipped || card.chosenRank == null ? (
                                                    <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Не выбрано</span>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <span style={{
                                                            fontSize: 11, fontWeight: 700,
                                                            color: rankColor(card.chosenRank),
                                                            background: rankColor(card.chosenRank) + '18',
                                                            padding: '1px 7px', borderRadius: 4,
                                                        }}>
                                                            {rankLabel(card.chosenRank)}
                                                        </span>
                                                        <span style={{ fontSize: 13, color: '#1e293b' }}>{card.chosenParam}</span>
                                                        <span style={{ fontSize: 12, color: card.cost > 0 ? '#dc2626' : '#16a34a', marginLeft: 4 }}>
                                                            {card.cost > 0 ? `${fmtNumber(card.cost)} млн` : 'Бесплатно'}
                                                        </span>
                                                    </div>
                                                )}
                                                {/* Остальные варианты (свёрнуто) */}
                                                {card.allOptions && card.allOptions.length > 1 && card.chosenRank != null && (
                                                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                        {card.allOptions
                                                            .filter(o => o.rank !== card.chosenRank)
                                                            .map(o => (
                                                                <span key={o.rank} style={{ fontSize: 11, color: '#94a3b8', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1px 6px', borderRadius: 4 }}>
                                                                    {rankLabel(o.rank)}: {o.param} {o.cost > 0 ? `(${o.cost} млн)` : '(бесплатно)'}
                                                                </span>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {expanded && (!lu.blocks || lu.blocks.length === 0) && (
                <div style={{ padding: '12px 14px', fontSize: 13, color: '#94a3b8' }}>Детальные данные карточек не сохранены</div>
            )}
        </div>
    );
};

// ── НИРы за год ───────────────────────────────────────────────────────────────
const ResearchYearSection = ({ research }) => {
    if (!research) return null;
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <h4 style={{ margin: 0, fontSize: 14, color: '#1e293b' }}>Научные исследования (НИР)</h4>
                <span style={{ fontSize: 13, color: '#64748b' }}>Итого: <strong style={{ color: '#dc2626' }}>{fmtNumber(research.totalSpent)} млн</strong></span>
            </div>
            {research.lus && research.lus.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {research.lus.map(lu => (
                        <div key={lu.luId} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: lu.purchases?.length ? 8 : 0 }}>
                                <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>Участок {lu.luId}</span>
                                <span style={{ fontSize: 12, color: '#64748b' }}>{fmtNumber(lu.totalSpent)} млн</span>
                                {lu.skipped && <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4 }}>Пропущено</span>}
                                {lu.columnId && <span style={{ fontSize: 11, color: '#7c3aed', background: '#ede9fe', padding: '1px 6px', borderRadius: 4 }}>Колонна: {lu.columnId}</span>}
                            </div>
                            {lu.purchases && lu.purchases.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {lu.purchases.map((p, i) => (
                                        <span key={i} style={{ fontSize: 11, background: '#ede9fe', color: '#5b21b6', padding: '2px 8px', borderRadius: 4 }}>
                                            {p.work_name || p.workName} — {fmtNumber(p.cost)} млн
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ fontSize: 13, color: '#94a3b8' }}>НИРы за этот год не проводились</div>
            )}
        </div>
    );
};

const sectionTitleStyle = { margin: '0 0 12px 0', fontSize: 15, fontWeight: 700, color: '#1e293b', paddingBottom: 6, borderBottom: '2px solid #e2e8f0' };

// ── Вкладка: Сводка за сессию ─────────────────────────────────────────────────
const SummaryTab = ({ summary }) => {
    if (!summary) return <div style={{ color: '#94a3b8', padding: 20 }}>Нет данных</div>;
    const { spentByType, incomeByType, cells, luCards, eventStats, research, fieldwork } = summary;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <section>
                <h3 style={sectionTitleStyle}> Бюджет</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    <MetricCard label="Начальный бюджет" value={`${fmtNumber(summary.initialBudget)} млн`} />
                    <MetricCard label="Текущий бюджет" value={`${fmtNumber(summary.currentBudget)} млн`} accent />
                    <MetricCard label="Всего потрачено" value={`${fmtNumber(summary.totalSpent)} млн`} color="#dc2626" />
                    <MetricCard label="Всего доходов" value={`${fmtNumber(summary.totalIncome)} млн`} color="#16a34a" />
                </div>
            </section>

            <section>
                <h3 style={sectionTitleStyle}> Расходы по категориям</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {[
                        { key: 'luCard', label: 'Карточки ЛУ' },
                        { key: 'auction', label: 'Аукционы' },
                        { key: 'research', label: 'НИР' },
                        { key: 'fieldwork', label: 'Полевые работы' },
                        { key: 'events', label: 'События (расходы)' },
                    ].map(({ key, label }) => (
                        <MetricCard key={key} label={label} value={`${fmtNumber(spentByType[key])} млн`} />
                    ))}
                </div>
                {incomeByType?.events > 0 && (
                    <div style={{ marginTop: 10 }}>
                        <MetricCard label="События (доходы)" value={`${fmtNumber(incomeByType.events)} млн`} color="#16a34a" />
                    </div>
                )}
            </section>

            {luCards && luCards.length > 0 && (
                <section>
                    <h3 style={sectionTitleStyle}> Купленные карточки информации</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {luCards.map((c, i) => (
                            <div key={i} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
                                <span style={{ color: '#0369a1', fontWeight: 600 }}>{c.description?.replace('Карточка ЛУ: ', '') || `Карточка ${i + 1}`}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {cells && cells.length > 0 && (
                <section>
                    <h3 style={sectionTitleStyle}> Лицензионные участки ({cells.length})</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {cells.map(c => (
                            <div key={c.cellRef} style={{ background: c.isAutoAssigned ? '#fef3c7' : '#dcfce7', border: `1px solid ${c.isAutoAssigned ? '#fcd34d' : '#86efac'}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: c.isAutoAssigned ? '#92400e' : '#15803d' }}>
                                {c.cellRef}
                                {c.auctionPrice > 0 && <span style={{ fontWeight: 400, marginLeft: 4 }}>({fmtNumber(c.auctionPrice)} млн)</span>}
                                {c.isAutoAssigned && <span style={{ marginLeft: 4 }}>🎲</span>}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {eventStats && (
                <section>
                    <h3 style={sectionTitleStyle}>🎲 Статистика событий (все годы)</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        <MetricCard label="Правильных ответов" value={eventStats.correctAnswers} color="#16a34a" />
                        <MetricCard label="Неправильных ответов" value={eventStats.wrongAnswers} color="#dc2626" />
                        <MetricCard label="Точность" value={eventStats.accuracy != null ? `${eventStats.accuracy}%` : '—'} />
                        <MetricCard label="Итого очков" value={fmtSigned(eventStats.totalScore)} color={eventStats.totalScore >= 0 ? '#16a34a' : '#dc2626'} />
                        <MetricCard label="Денежный эффект" value={`${fmtSigned(eventStats.moneyDelta)} млн`} color={eventStats.moneyDelta >= 0 ? '#16a34a' : '#dc2626'} />
                    </div>
                </section>
            )}

            {research && research.totalSpent > 0 && (
                <section>
                    <h3 style={sectionTitleStyle}> НИРы — итого</h3>
                    <MetricCard label="Потрачено на НИР" value={`${fmtNumber(research.totalSpent)} млн`} color="#7c3aed" />
                    {research.byYear && research.byYear.length > 0 && (
                        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {research.byYear.map(y => (
                                <div key={y.year} style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>
                                    <span style={{ fontWeight: 700, color: '#6b21a8' }}>Год {y.year}</span>
                                    <span style={{ color: '#7c3aed', marginLeft: 8 }}>{fmtNumber(y.totalSpent)} млн</span>
                                    <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 11 }}>({y.lus?.length || 0} ЛУ)</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {fieldwork && fieldwork.totalSpent > 0 && (
                <section>
                    <h3 style={sectionTitleStyle}> Полевые работы — итого</h3>
                    <MetricCard label="Потрачено на полевые работы" value={`${fmtNumber(fieldwork.totalSpent)} млн`} color="#0369a1" />
                    {fieldwork.byYear && fieldwork.byYear.length > 0 && (
                        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {fieldwork.byYear.map(y => (
                                <div key={y.year} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>
                                    <span style={{ fontWeight: 700, color: '#0369a1' }}>Год {y.year}</span>
                                    <span style={{ color: '#0284c7', marginLeft: 8 }}>{fmtNumber(y.totalCost)} млн</span>
                                    <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 11 }}>({y.lus?.length || 0} ЛУ)</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};

// ── Вкладка: Статистика за год ────────────────────────────────────────────────
const YearTab = ({ sessionId, teamId, availableYears }) => {
    const [selectedYear, setSelectedYear] = useState(availableYears[0] ?? 1);
    const { data, loading, error } = useAdminFetch(
        `/sessions/${sessionId}/team/${teamId}/year/${selectedYear}`,
        [selectedYear]
    );

    return (
        <div>
            {/* Выбор года */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {availableYears.map(y => (
                    <button key={y} onClick={() => setSelectedYear(y)} style={{
                        padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: 600,
                        background: y === selectedYear ? '#1e40af' : '#e2e8f0',
                        color: y === selectedYear ? '#fff' : '#374151',
                        transition: 'background 0.15s',
                    }}>
                        Год {y}
                    </button>
                ))}
            </div>

            {loading && <div style={{ color: '#64748b', padding: 20 }}>Загрузка…</div>}
            {error && <div style={{ color: '#dc2626', padding: 20 }}>Ошибка: {error}</div>}

            {data && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Расходы */}
                    <section>
                        <h3 style={sectionTitleStyle}> Расходы за год {selectedYear}</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                            <MetricCard label="Всего за год" value={`${fmtNumber(data.budget.totalSpentThisYear)} млн`} color="#dc2626" accent />
                            {Object.entries(data.budget.spentByType).filter(([, v]) => v > 0).map(([k, v]) => {
                                const labels = { research: 'НИРы', events: 'События', fieldwork: 'Полевые', other: 'Прочее' };
                                return <MetricCard key={k} label={labels[k] || k} value={`${fmtNumber(v)} млн`} />;
                            })}
                        </div>
                    </section>

                    {/* НИРы */}
                    <section><ResearchYearSection research={data.research} /></section>

                    {/* События */}
                    <section>
                        <h3 style={sectionTitleStyle}>События за год {selectedYear}</h3>
                        {data.events.lines.length > 0 ? (
                            <>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                                    <MetricCard label="Правильных" value={data.events.correctAnswers} color="#16a34a" />
                                    <MetricCard label="Неправильных" value={data.events.wrongAnswers} color="#dc2626" />
                                    <MetricCard label="Точность"
                                        value={data.events.accuracy != null ? `${data.events.accuracy}%` : '—'}
                                        color={data.events.accuracy >= 70 ? '#16a34a' : data.events.accuracy >= 40 ? '#d97706' : '#dc2626'}
                                    />
                                    <MetricCard label="Очков" value={fmtSigned(data.events.totalScore)} color={data.events.totalScore >= 0 ? '#16a34a' : '#dc2626'} />
                                    <MetricCard label="Денег" value={`${fmtSigned(data.events.totalMoney)} млн`} color={data.events.totalMoney >= 0 ? '#16a34a' : '#dc2626'} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {data.events.lines.map((line, i) => <EventLineDetail key={line.luId || i} line={line} />)}
                                </div>
                            </>
                        ) : (
                            <div style={{ fontSize: 13, color: '#94a3b8' }}>Событий за этот год нет</div>
                        )}
                    </section>

                    {/* Полевые работы */}
                    <section>
                        <h3 style={sectionTitleStyle}> Полевые работы за год {selectedYear}</h3>
                        {data.fieldwork?.lus?.length > 0 ? (
                            <>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                                    <MetricCard label="Итого стоимость" value={`${fmtNumber(data.fieldwork.totalCost)} млн`} color="#0369a1" accent />
                                    {(() => {
                                        const lus = data.fieldwork.lus.filter(f => f.qualityScore > 0);
                                        if (!lus.length) return null;
                                        const avg = Math.round(lus.reduce((s, f) => s + f.qualityScore, 0) / lus.length);
                                        return <MetricCard label="Ср. качество" value={`${avg} / 100`} color={avg >= 70 ? '#16a34a' : avg >= 40 ? '#d97706' : '#dc2626'} />;
                                    })()}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {data.fieldwork.lus.map((lu, i) => <FieldworkLUDetail key={lu.luId || i} lu={lu} />)}
                                </div>
                            </>
                        ) : (
                            <div style={{ fontSize: 13, color: '#94a3b8' }}>Полевые работы за этот год не проводились</div>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
};

// ── Модалка детального мониторинга команды ────────────────────────────────────
const AdminMonitoring = ({ sessionId, teamId, teamName, onClose }) => {
    const [activeTab, setActiveTab] = useState('summary');

    const { data: summary, loading: summaryLoading, error: summaryError } =
        useAdminFetch(`/sessions/${sessionId}/team/${teamId}/summary`, [sessionId, teamId]);

    const availableYears = React.useMemo(() => {
        const years = new Set();
        if (summary?.eventStats?.byYear) summary.eventStats.byYear.forEach(y => years.add(y.year));
        if (summary?.research?.byYear) summary.research.byYear.forEach(y => years.add(y.year));
        if (summary?.fieldwork?.byYear) summary.fieldwork.byYear.forEach(y => years.add(y.year));
        const arr = Array.from(years).sort((a, b) => a - b);
        return arr.length > 0 ? arr : [1, 2, 3];
    }, [summary]);

    const tabs = [
        { id: 'summary', label: ' Сводка за сессию' },
        { id: 'year', label: ' По годам' },
    ];

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 16, width: '95%', maxWidth: 900, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.3)' }}>
                {/* Шапка */}
                <div style={{ padding: '20px 28px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1e3a5f', borderRadius: '16px 16px 0 0' }}>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>Мониторинг: {teamName}</div>
                        <div style={{ fontSize: 12, color: '#93c5fd', marginTop: 2 }}>ID сессии: {sessionId}</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 14px', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                        Закрыть ✕
                    </button>
                </div>
                {/* Вкладки */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: '12px 22px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: activeTab === t.id ? '#1e40af' : '#64748b', borderBottom: activeTab === t.id ? '2.5px solid #1e40af' : '2.5px solid transparent', transition: 'all 0.15s' }}>
                            {t.label}
                        </button>
                    ))}
                </div>
                {/* Контент */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                    {summaryLoading && <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>Загрузка данных…</div>}
                    {summaryError && <div style={{ color: '#dc2626', padding: 20 }}>Ошибка загрузки: {summaryError}</div>}
                    {!summaryLoading && !summaryError && (
                        <>
                            {activeTab === 'summary' && <SummaryTab summary={summary} />}
                            {activeTab === 'year' && <YearTab sessionId={sessionId} teamId={teamId} availableYears={availableYears} />}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── BudgetBreakdown (компактный в карточке команды) ───────────────────────────
const BudgetBreakdown = ({ initial, current, spentByType = {}, incomeByType = {}, eventStats = null, currentYearSpent = 0, lu = [], members = [], isOnline = false, isOpen = false }) => {
    const spent = initial - current;
    const pct = initial > 0 ? Math.max(0, Math.min(100, (current / initial) * 100)) : 0;
    const isLow = current < initial * 0.2;
    const fmtV = (val) => Number(val || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 });

    return (
        <div style={{ padding: '10px 14px', borderTop: '1px solid #f1f5f9', background: '#fff' }}>
            <div style={{ display: 'flex', gap: 0, border: '1px solid #e9ecef', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ flex: 1, padding: '8px 12px', borderRight: '1px solid #e9ecef' }}>
                    <div style={{ fontSize: 11, color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Остаток</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: isLow ? '#dc2626' : '#16a34a' }}>{fmtV(current)} млн</div>
                </div>
                <div style={{ flex: 1, padding: '8px 12px', borderRight: '1px solid #e9ecef' }}>
                    <div style={{ fontSize: 11, color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Суммарный расход</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#334155' }}>{fmtV(spent)} млн</div>
                </div>
            </div>
            <div style={{ height: 4, background: '#e9ecef', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ height: '100%', borderRadius: 4, background: isLow ? '#dc2626' : '#16a34a', width: `${pct}%`, transition: 'width 0.4s' }} />
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#374151' }}>
                <div><span style={{ color: '#6c757d', fontWeight: 600 }}>Участки: </span>{lu.length > 0 ? lu.join(', ') : '—'}</div>
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: '#374151' }}>
                <span style={{ color: '#6c757d', fontWeight: 600 }}>Состав: </span>
                {members.length > 0 ? members.map(m => typeof m === 'string' ? m : (m.name || m.fullName || '')).filter(Boolean).join(', ') : '—'}
            </div>
            <div style={{ marginTop: 6, fontSize: 13 }}>
                <span style={{ color: '#6c757d', fontWeight: 600 }}>Статус: </span>
                <span style={{ color: isOnline ? '#16a34a' : '#6b7280', fontWeight: 600 }}>{isOnline ? 'Онлайн' : 'Офлайн'}</span>
            </div>
        </div>
    );
};

// ── Мониторинг команд ─────────────────────────────────────────────────────────
const TeamsMonitor = ({ sessionId }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [openIds, setOpenIds] = useState(() => new Set());
    const [expensesMap, setExpensesMap] = useState({});
    const [expensesLoading, setExpensesLoading] = useState(false);
    const [monitoringTeam, setMonitoringTeam] = useState(null);

    const load = async (sid) => {
        if (!sid) return;
        setLoading(true);
        try {
            const json = await apiAction(`/api/admin/sessions/${sid}`, 'GET');
            setData(json);
            loadExpenses(sid, json.teams ?? []);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const loadExpenses = async (sid, teams) => {
        if (!teams.length) return;
        setExpensesLoading(true);
        try {
            const results = await Promise.all(
                teams.map(async (team) => {
                    try {
                        const json = await apiAction(`/api/admin/sessions/${sid}/team/${team.id}/expenses`, 'GET');
                        return { teamId: team.id, spentByType: json.spentByType ?? {}, incomeByType: json.incomeByType ?? {}, eventStats: json.eventStats ?? null };
                    } catch {
                        return { teamId: team.id, spentByType: {}, incomeByType: {}, eventStats: null };
                    }
                })
            );
            const map = {};
            // В loadExpenses, где формируется map:
            results.forEach(({ teamId, spentByType, incomeByType, eventStats }) => {
                const currentYearSpent = Object.values(spentByType).reduce((s, v) => s + (v || 0), 0);
                map[teamId] = { spentByType, incomeByType, eventStats, currentYearSpent };
            });
            setExpensesMap(map);
        } catch (e) { console.error('loadExpenses error:', e); } finally { setExpensesLoading(false); }
    };

    useEffect(() => {
        setData(null); setOpenIds(new Set()); setExpensesMap({});
        load(sessionId);
    }, [sessionId]);

    const toggle = (teamId) => {
        const id = String(teamId);
        setOpenIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    };

    if (!sessionId) return <div className="tm-empty">Выберите сессию для просмотра команд</div>;
    if (loading) return <div className="tm-loading">Загрузка данных…</div>;
    if (!data) return <div className="tm-empty">Нет данных</div>;

    const teams = data.teams ?? [];
    const cells = data.cells ?? [];
    const teamCells = {};
    cells.forEach(cell => { if (!cell.team_id) return; (teamCells[cell.team_id] ??= []).push(cell.cell_ref); });
    const sorted = [...teams].sort((a, b) => b.budget - a.budget);

    return (
        <>
            <div className="tm-wrap">
                <div className="tm-refresh-row">
                    <button className="tb tb-gray" onClick={() => load(sessionId)}>↻ Обновить</button>
                    <span className="tm-hint">
                        {teams.length} команд · сессия {data.code}
                        {expensesLoading && ' · загрузка расходов…'}
                    </span>
                </div>
                <div className="tm-cards">
                    {sorted.map(team => {
                        const lu = teamCells[team.id] ?? [];
                        const members = team.members_json ?? team.members ?? [];
                        const initial = team.initial_budget ?? team.budget ?? 0;
                        const isOnline = team.is_online;
                        const isOpen = openIds.has(String(team.id));
                        const teamData = expensesMap[team.id] ?? {};

                        return (
                            <div key={team.id} className={`tm-card ${isOnline ? 'tm-card-online' : 'tm-card-offline'}`}>
                                <div className="tm-card-header" onClick={() => toggle(team.id)}>
                                    <div className="tm-card-left">
                                        <span className={`tm-online-dot ${isOnline ? 'tm-dot-on' : 'tm-dot-off'}`} />
                                        <strong className="tm-team-name">{team.name}</strong>
                                        <span className="tm-session-badge">{team.session_code || data.code}</span>
                                    </div>
                                    <div className="tm-card-right">
                                        <span className="tm-budget-val">{fmtMln(team.budget)} млн ₽</span>
                                        <span className="tm-lu-count">{lu.length} ЛУ</span>
                                        <span className={`tm-chevron ${isOpen ? 'tm-chevron-open' : ''}`}>▼</span>
                                    </div>
                                </div>

                                <BudgetBreakdown
                                    initial={initial} current={team.budget}
                                    spentByType={teamData.spentByType}
                                    incomeByType={teamData.incomeByType}
                                    eventStats={teamData.eventStats}
                                    currentYearSpent={teamData.currentYearSpent || 0}
                                    lu={lu}
                                    members={members}
                                    isOnline={isOnline}
                                />

                                {isOpen && (
                                    <div className="tm-card-details">
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                                            {Object.entries({ 'Карточки ЛУ': teamData.spentByType?.lu_card, 'Аукционы': teamData.spentByType?.auction, 'НИР': teamData.spentByType?.research, 'Полевые': teamData.spentByType?.fieldwork, 'События': teamData.spentByType?.events }).map(([label, val]) =>
                                                val > 0 ? (
                                                    <div key={label} style={{ fontSize: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px' }}>
                                                        <span style={{ color: '#64748b' }}>{label}: </span>
                                                        <span style={{ fontWeight: 700 }}>{Number(val || 0).toLocaleString('ru-RU')} млн</span>
                                                    </div>
                                                ) : null
                                            )}
                                        </div>
                                        {teamData.eventStats && (
                                            <div style={{ fontSize: 12, color: '#374151', marginBottom: 10 }}>
                                                <span style={{ color: '#6c757d', fontWeight: 600 }}>Верно/Ошибки: </span>
                                                {teamData.eventStats.correctAnswers || 0} / {teamData.eventStats.wrongAnswers || 0}
                                            </div>
                                        )}
                                        <button className="tb tb-primary" onClick={() => setMonitoringTeam(team)} style={{ width: '100%' }}>
                                            Детальный мониторинг
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {monitoringTeam && (
                <AdminMonitoring
                    sessionId={sessionId}
                    teamId={monitoringTeam.id}
                    teamName={monitoringTeam.name}
                    onClose={() => setMonitoringTeam(null)}
                />
            )}
        </>
    );
};

// ── Dashboard: графики по командам ────────────────────────────────────────────
const SPEND_CATS = [
    { key: 'auction',   label: 'Аукционы',          color: '#f59e0b' },
    { key: 'lu_card',   label: 'Карточки ЛУ',       color: '#6366f1' },
    { key: 'research',  label: 'НИР',               color: '#8b5cf6' },
    { key: 'fieldwork', label: 'Полевые работы',    color: '#0ea5e9' },
    { key: 'events',    label: 'События',           color: '#ec4899' },
    { key: 'pipeline',  label: 'Нефтепровод',       color: '#92400e' },
    { key: 'other',     label: 'Инф. карточки',     color: '#94a3b8' },
];

const mlnFmt = v => `${Number(v || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} млн`;

const PIE_COLORS = ['#6366f1','#f59e0b','#22c55e','#ef4444','#0ea5e9','#ec4899','#8b5cf6','#14b8a6'];

const BudgetPieTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const pct = d.initial > 0 ? Math.round((d.current / d.initial) * 100) : 0;
    const color = pct > 60 ? '#16a34a' : pct > 30 ? '#d97706' : '#dc2626';
    return (
        <div className="dash-tooltip">
            <div className="dash-tooltip-name">{d.name}</div>
            <div>Текущий бюджет: <strong>{mlnFmt(d.current)}</strong></div>
            <div>Начальный: {mlnFmt(d.initial)}</div>
            <div>Остаток: <strong style={{ color }}>{pct}%</strong></div>
            <div>Доля от общего: <strong>{d.sharePct}%</strong></div>
        </div>
    );
};

const SpendTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((s, p) => s + (p.value || 0), 0);
    return (
        <div className="dash-tooltip">
            <div className="dash-tooltip-name">{label}</div>
            {payload.map(p => p.value > 0 && (
                <div key={p.dataKey} style={{ color: p.fill }}>
                    {p.name}: <strong>{mlnFmt(p.value)}</strong>
                </div>
            ))}
            <div style={{ marginTop: 4, borderTop: '1px solid #e2e8f0', paddingTop: 4 }}>
                Итого: <strong>{mlnFmt(total)}</strong>
            </div>
        </div>
    );
};

const LuTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="dash-tooltip">
            <div className="dash-tooltip-name">{label}</div>
            <div>ЛУ: <strong>{payload[0].value}</strong></div>
        </div>
    );
};

const EventsTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const correct = payload.find(p => p.dataKey === 'correct')?.value || 0;
    const wrong   = payload.find(p => p.dataKey === 'wrong')?.value || 0;
    const total   = correct + wrong;
    const pct     = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
        <div className="dash-tooltip">
            <div className="dash-tooltip-name">{label}</div>
            <div style={{ color: '#16a34a' }}>Правильно: <strong>{correct}</strong></div>
            <div style={{ color: '#dc2626' }}>Неправильно: <strong>{wrong}</strong></div>
            <div style={{ marginTop: 4, borderTop: '1px solid #e2e8f0', paddingTop: 4 }}>
                Точность: <strong>{pct}%</strong>
            </div>
        </div>
    );
};

const CHART_MARGIN = { top: 8, right: 20, left: 10, bottom: 8 };
const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };
const RATING_LINE_COLORS = ['#6366f1','#f59e0b','#22c55e','#ef4444','#0ea5e9','#ec4899','#8b5cf6','#14b8a6'];

const RatingTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const sorted = [...payload].sort((a, b) => b.value - a.value);
    return (
        <div className="dash-tooltip">
            <div className="dash-tooltip-name">{label}</div>
            {sorted.map((p, i) => (
                <div key={p.dataKey} style={{ color: p.stroke }}>
                    {i + 1}. {p.name}: <strong>{p.value} очк.</strong>
                </div>
            ))}
        </div>
    );
};

const DashboardTab = ({ sessions, globalStats }) => {
    const [sessId, setSessId]       = useState('');
    const [teamsData, setTeamsData] = useState(null);
    const [expMap, setExpMap]       = useState({});
    const [ratingData, setRatingData] = useState(null);
    const [topicData, setTopicData]   = useState(null);
    const [loading, setLoading]     = useState(false);

    const load = async (sid) => {
        if (!sid) return;
        setLoading(true);
        setTeamsData(null);
        setExpMap({});
        setRatingData(null);
        setTopicData(null);
        try {
            const [sessJson, ratingJson, topicJson] = await Promise.all([
                apiAction(`/api/admin/sessions/${sid}`, 'GET'),
                apiAction(`/api/admin/sessions/${sid}/rating`, 'GET').catch(() => null),
                apiAction(`/api/admin/sessions/${sid}/topic-stats`, 'GET').catch(() => null),
            ]);

            const teams = sessJson.teams ?? [];
            const cells = sessJson.cells ?? [];

            const expResults = await Promise.all(
                teams.map(async (t) => {
                    try {
                        const j = await apiAction(`/api/admin/sessions/${sid}/team/${t.id}/expenses`, 'GET');
                        return { teamId: t.id, spentByType: j.spentByType ?? {}, incomeByType: j.incomeByType ?? {}, eventStats: j.eventStats ?? null };
                    } catch {
                        return { teamId: t.id, spentByType: {}, incomeByType: {}, eventStats: null };
                    }
                })
            );
            const map = {};
            expResults.forEach(({ teamId, spentByType, incomeByType, eventStats }) => {
                map[teamId] = { spentByType, incomeByType, eventStats };
            });

            const teamCells = {};
            cells.forEach(c => { if (c.team_id) (teamCells[c.team_id] ??= []).push(c.cell_ref); });

            setTeamsData({ teams, teamCells, code: sessJson.code });
            setExpMap(map);
            if (ratingJson?.ok) setRatingData(ratingJson);
            if (topicJson?.ok)  setTopicData(topicJson);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handleSessChange = (sid) => { setSessId(sid); load(sid); };

    const teams  = teamsData?.teams ?? [];
    const sorted = [...teams].sort((a, b) => b.budget - a.budget);

    // ── Данные для графиков бюджета / расходов ──
    const totalBudget = sorted.reduce((s, t) => s + (t.budget ?? 0), 0);
    const budgetData = sorted.map(t => ({
        name: t.name,
        current: t.budget ?? 0,
        initial: t.initial_budget ?? t.budget ?? 0,
        sharePct: totalBudget > 0 ? Math.round(((t.budget ?? 0) / totalBudget) * 100) : 0,
    }));

    const spendData = sorted.map(t => {
        const sp = expMap[t.id]?.spentByType ?? {};
        return { name: t.name, ...Object.fromEntries(SPEND_CATS.map(c => [c.key, sp[c.key] || 0])) };
    });

    const luData = [...teams]
        .sort((a, b) => (teamsData?.teamCells?.[b.id]?.length ?? 0) - (teamsData?.teamCells?.[a.id]?.length ?? 0))
        .map(t => ({ name: t.name, lu: teamsData?.teamCells?.[t.id]?.length ?? 0 }));

    const eventsData = sorted
        .filter(t => expMap[t.id]?.eventStats)
        .map(t => ({
            name: t.name,
            correct: expMap[t.id].eventStats.correctAnswers || 0,
            wrong:   expMap[t.id].eventStats.wrongAnswers   || 0,
        }));

    const barH = Math.max(teams.length * 52 + 40, 200);

    // ── Данные для графика рейтинга по фазам ──
    const PHASES = [
        { key: 'start',  label: 'Старт',                   components: [] },
        { key: 'grr',    label: 'ГРР (1–5 год)',            components: ['grr'] },
        { key: 'stage2', label: 'Проектирование (6–8 год)', components: ['grr', 'stage2'] },
        { key: 'stage3', label: 'Управление (9–10 год)',    components: ['grr', 'stage2', 'stage3'] },
        { key: 'final',  label: 'Итоговый рейтинг',        components: ['grr', 'stage2', 'stage3'] },
    ];

    const ratingTeams = ratingData?.teams ?? [];
    const ratingLineData = PHASES.map(phase => {
        const row = { phase: phase.label };
        ratingTeams.forEach(t => {
            row[t.teamName] = phase.components.reduce((s, c) => s + (t.ranking[c]?.points || 0), 0);
        });
        return row;
    });

    // Итоговые места
    const finalStandings = [...ratingTeams].sort((a, b) => b.totalPoints - a.totalPoints);
    let standingRank = 1, si = 0;
    const standingRanks = {};
    while (si < finalStandings.length) {
        const pts = finalStandings[si].totalPoints;
        let sj = si;
        while (sj < finalStandings.length && finalStandings[sj].totalPoints === pts) sj++;
        for (let k = si; k < sj; k++) standingRanks[finalStandings[k].teamId] = standingRank;
        standingRank += (sj - si);
        si = sj;
    }

    return (
        <div className="dash-wrap">
            {/* Глобальная статистика */}
            {globalStats && (
                <div className="dash-global-stats">
                    {[
                        ['Сессий',    globalStats.totalSessions  ?? 0],
                        ['Команд',    globalStats.totalTeams     ?? 0],
                        ['Активных',  globalStats.activeSessions ?? 0],
                    ].map(([label, val]) => (
                        <div key={label} className="dash-stat-pill">
                            <span className="dash-stat-val">{val}</span>
                            <span className="dash-stat-lbl">{label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Селектор сессии + обновить */}
            <div className="dash-controls">
                <select className="tc-select" value={sessId} onChange={e => handleSessChange(e.target.value)}>
                    <option value="">— выберите сессию —</option>
                    {sessions.map(s => (
                        <option key={s.id} value={s.id}>{s.code} · {s.status} · {s.teamsCount ?? 0} команд</option>
                    ))}
                </select>
                <button className="tb tb-gray" onClick={() => load(sessId)} disabled={!sessId || loading}>
                    ↻ Обновить
                </button>
            </div>

            {loading && <div className="ap-loading">Загрузка данных…</div>}
            {!sessId && !loading && <div className="dash-empty">Выберите сессию, чтобы увидеть данные</div>}
            {teamsData && !loading && teams.length === 0 && <div className="dash-empty">В сессии нет команд</div>}

            {teamsData && !loading && teams.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'row', gap: 24, alignItems: 'flex-start', width: '100%' }}>

                    {/* ══ ЛЕВАЯ КОЛОНКА: Графики ══ */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                <div className="dash-charts">

                    {/* ── 0. Рейтинг по фазам — линейный график ── */}
                    {ratingTeams.length > 0 && (
                        <div className="dash-chart-card dash-chart-card--wide">
                            <div className="dash-chart-title">Рейтинг команд по этапам</div>
                            <div className="dash-chart-hint">Накопленные очки после каждой фазы — чем выше, тем лучше</div>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={ratingLineData} margin={{ top: 12, right: 24, left: 0, bottom: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="phase" tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                    <Tooltip content={<RatingTooltip />} />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                                    {ratingTeams.map((t, i) => (
                                        <Line
                                            key={t.teamId}
                                            type="monotone"
                                            dataKey={t.teamName}
                                            stroke={RATING_LINE_COLORS[i % RATING_LINE_COLORS.length]}
                                            strokeWidth={2.5}
                                            dot={{ r: 5 }}
                                            activeDot={{ r: 7 }}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>

                            {/* Итоговая таблица мест */}
                            <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Итоговые места</div>
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    {finalStandings.map((t, i) => {
                                        const rank = standingRanks[t.teamId];
                                        const color = RATING_LINE_COLORS[ratingTeams.findIndex(r => r.teamId === t.teamId) % RATING_LINE_COLORS.length];
                                        return (
                                            <div key={t.teamId} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: `2px solid ${color}`, borderRadius: 10, padding: '8px 16px' }}>
                                                <span style={{ fontSize: 18 }}>{MEDAL[rank] || `#${rank}`}</span>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{t.teamName}</div>
                                                    <div style={{ fontSize: 12, color: '#64748b' }}>{t.totalPoints} очков</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── 1. Бюджет команд — круговая диаграмма ── */}
                    <div className="dash-chart-card dash-chart-card--wide">
                        <div className="dash-chart-title">Бюджет команд</div>
                        <div className="dash-chart-hint">Доля текущего бюджета каждой команды от общей суммы</div>
                        <ResponsiveContainer width="100%" height={320}>
                            <PieChart>
                                <Pie
                                    data={budgetData}
                                    dataKey="current"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={120}
                                    innerRadius={52}
                                    paddingAngle={2}
                                    label={({ name, sharePct }) => `${name} · ${sharePct}%`}
                                    labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                                >
                                    {budgetData.map((d, i) => (
                                        <Cell key={d.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<BudgetPieTooltip />} />
                                <Legend
                                    formatter={(value, entry) => (
                                        <span style={{ fontSize: 12, color: '#1e293b', fontWeight: 600 }}>
                                            {value} — {mlnFmt(entry.payload.current)}
                                        </span>
                                    )}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* ── 2. Структура расходов — stacked ── */}
                    <div className="dash-chart-card dash-chart-card--wide">
                        <div className="dash-chart-title">Структура расходов</div>
                        <div className="dash-chart-hint">Сколько потрачено по каждой категории</div>
                        <ResponsiveContainer width="100%" height={barH}>
                            <BarChart data={spendData} layout="vertical" margin={CHART_MARGIN}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" tickFormatter={v => `${(v / 1e6).toFixed(0)} млн`} tick={{ fontSize: 11, fill: '#64748b' }} />
                                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: '#1e293b', fontWeight: 600 }} />
                                <Tooltip content={<SpendTooltip />} />
                                <Legend iconType="square" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                                {SPEND_CATS.map(c => (
                                    <Bar key={c.key} dataKey={c.key} name={c.label} stackId="s" fill={c.color} maxBarSize={28}
                                        radius={[0, 0, 0, 0]}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* ── 4. Точность событий — нормированная диаграмма с накоплением ── */}
                    {eventsData.length > 0 && (() => {
                        const normData = eventsData.map(d => {
                            const total = (d.correct || 0) + (d.wrong || 0);
                            const correctPct = total > 0 ? Math.round((d.correct / total) * 100) : 0;
                            const wrongPct   = total > 0 ? 100 - correctPct : 0;
                            return { name: d.name, correctPct, wrongPct, correct: d.correct, wrong: d.wrong, total };
                        });
                        const NormTooltip = ({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const d = normData.find(x => x.name === label) || {};
                            return (
                                <div className="dash-tooltip">
                                    <div className="dash-tooltip-name">{label}</div>
                                    <div style={{ color: '#16a34a' }}>Правильно: <strong>{d.correct}</strong> ({d.correctPct}%)</div>
                                    <div style={{ color: '#dc2626' }}>Неправильно: <strong>{d.wrong}</strong> ({d.wrongPct}%)</div>
                                    <div style={{ marginTop: 4, borderTop: '1px solid #e2e8f0', paddingTop: 4 }}>Всего: <strong>{d.total}</strong></div>
                                </div>
                            );
                        };
                        const CorrectLabel = ({ x, y, width, height, index }) => {
                            const d = normData[index];
                            if (!d || width < 55) return null;
                            return <text x={x + width / 2} y={y + height / 2 + 4} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={700}>{d.correct} ({d.correctPct}%)</text>;
                        };
                        const WrongLabel = ({ x, y, width, height, index }) => {
                            const d = normData[index];
                            if (!d || width < 55) return null;
                            return <text x={x + width / 2} y={y + height / 2 + 4} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={700}>{d.wrong} ({d.wrongPct}%)</text>;
                        };
                        return (
                            <div className="dash-chart-card">
                                <div className="dash-chart-title">Точность ответов на события</div>
                                <div className="dash-chart-hint">100% диаграмма: зелёный — правильные, красный — неправильные</div>
                                <ResponsiveContainer width="100%" height={Math.max(eventsData.length * 44 + 40, 180)}>
                                    <BarChart data={normData} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                        <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: '#1e293b', fontWeight: 600 }} />
                                        <Tooltip content={<NormTooltip />} />
                                        <Legend iconType="square" wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                                        <Bar dataKey="correctPct" name="Правильно" stackId="s" fill="#22c55e" maxBarSize={28} isAnimationActive={false} label={<CorrectLabel />} />
                                        <Bar dataKey="wrongPct"   name="Неправильно" stackId="s" fill="#ef4444" maxBarSize={28} isAnimationActive={false} label={<WrongLabel />} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        );
                    })()}

                    {/* ── 5. Тепловая карта «Команды × Тематики» ── */}
                    {topicData?.teams?.length > 0 && (() => {
                        const allTopics = [...new Set(topicData.teams.flatMap(t => Object.keys(t.topics)))].sort();
                        if (!allTopics.length) return (
                            <div className="dash-chart-card dash-chart-card--wide">
                                <div className="dash-chart-title">Сильные и слабые тематики команд</div>
                                <div style={{ color: '#94a3b8', padding: 16, fontSize: 13 }}>Данные появятся после того как команды ответят на карточки событий</div>
                            </div>
                        );
                        return (
                            <div className="dash-chart-card dash-chart-card--wide">
                                <div className="dash-chart-title">Сильные и слабые тематики команд</div>
                                <div className="dash-chart-hint">Правильных/всего (%) по теме. Зелёный — сильная, красный — слабая, серый — нет данных</div>
                                <div style={{ overflowX: 'auto', marginTop: 12 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ padding: '6px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '2px solid #e2e8f0' }}>Команда</th>
                                                {allTopics.map(t => (
                                                    <th key={t} style={{ padding: '6px 6px', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: 11, borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }} title={t}>
                                                        {t.length > 12 ? t.slice(0, 11) + '…' : t}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topicData.teams.map((team, ri) => (
                                                <tr key={team.teamId} style={{ background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                                    <td style={{ padding: '7px 10px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0' }}>{team.teamName}</td>
                                                    {allTopics.map(topic => {
                                                        const d = team.topics[topic];
                                                        if (!d) return (
                                                            <td key={topic} style={{ padding: '7px 6px', textAlign: 'center', background: '#f1f5f9', color: '#94a3b8', borderBottom: '1px solid #e2e8f0', fontSize: 11 }}>—</td>
                                                        );
                                                        const total = d.correct + d.wrong;
                                                        const pct = total > 0 ? Math.round(d.correct / total * 100) : 0;
                                                        const bg = pct >= 70 ? `rgba(34,197,94,${0.15 + pct / 200})` : pct >= 40 ? `rgba(251,191,36,${0.2 + pct / 300})` : `rgba(239,68,68,${0.15 + (100 - pct) / 200})`;
                                                        const color = pct >= 70 ? '#15803d' : pct >= 40 ? '#92400e' : '#991b1b';
                                                        return (
                                                            <td key={topic} style={{ padding: '7px 6px', textAlign: 'center', background: bg, color, fontWeight: 700, borderBottom: '1px solid #e2e8f0', fontSize: 12, lineHeight: 1.3 }}>
                                                                <div>{d.correct}/{total}</div>
                                                                <div style={{ fontSize: 11, opacity: 0.85 }}>({pct}%)</div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}

                </div>
                    </div>{/* конец левой колонки */}

                    {/* ══ ПРАВАЯ КОЛОНКА: Таблицы рейтинга ══ */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <RatingTab sessId={sessId} />
                    </div>

                </div>
            )}
        </div>
    );
};

// ── Рейтинг: вспомогательные компоненты ──────────────────────────────────────

const RatingTable = ({ title, hint, teams, metricKey, valueLabel, costKey }) => {
    const sorted = [...teams].sort((a, b) => {
        const ra = a.ranking[metricKey]?.rank, rb = b.ranking[metricKey]?.rank;
        if (ra == null && rb == null) return 0;
        if (ra == null) return 1;
        if (rb == null) return -1;
        return ra - rb;
    });
    return (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '14px 16px', background: '#1e3a5f', color: '#fff' }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
                {hint && <div style={{ fontSize: 12, color: '#93c5fd', marginTop: 2 }}>{hint}</div>}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left',   fontSize: 12, color: '#64748b', fontWeight: 600 }}>Место</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left',   fontSize: 12, color: '#64748b', fontWeight: 600 }}>Команда</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right',  fontSize: 12, color: '#64748b', fontWeight: 600 }}>Значение</th>
                        {costKey && <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: '#64748b', fontWeight: 600 }}>Расходы, млн</th>}
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, color: '#64748b', fontWeight: 600 }}>Очки</th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((t, idx) => {
                        const r    = t.ranking[metricKey];
                        const rank = r?.rank;
                        const pts  = r?.points ?? 0;
                        const cost = costKey ? (t.stageCosts?.[costKey] ?? 0) : null;
                        const rowBg = rank === 1 ? '#fefce8' : idx % 2 === 0 ? '#fff' : '#f8fafc';
                        return (
                            <tr key={t.teamId} style={{ background: rowBg, borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '9px 12px', fontWeight: 700, fontSize: 14, color: rank <= 3 ? '#1e40af' : '#94a3b8' }}>
                                    {MEDAL[rank] || (rank ? `#${rank}` : '—')}
                                </td>
                                <td style={{ padding: '9px 12px', fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{t.teamName}</td>
                                <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 13, color: '#475569' }}>
                                    {valueLabel(t.metrics[metricKey])}
                                </td>
                                {costKey && (
                                    <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 13, color: cost > 0 ? '#c2410c' : '#94a3b8' }}>
                                        {cost > 0 ? `−${fmtNumber(cost)}` : '—'}
                                    </td>
                                )}
                                <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, fontSize: 14, color: '#1e40af' }}>{pts}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const TotalRatingTable = ({ teams }) => {
    const sorted = [...teams].sort((a, b) => b.totalPoints - a.totalPoints);
    let rank = 1, i = 0;
    const ranks = {};
    while (i < sorted.length) {
        const pts = sorted[i].totalPoints;
        let j = i;
        while (j < sorted.length && sorted[j].totalPoints === pts) j++;
        for (let k = i; k < j; k++) ranks[sorted[k].teamId] = rank;
        rank += (j - i);
        i = j;
    }
    return (
        <div style={{ background: '#fff', border: '2px solid #1e40af', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '14px 16px', background: '#1e40af', color: '#fff' }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Итоговый рейтинг</div>
                <div style={{ fontSize: 12, color: '#bfdbfe', marginTop: 2 }}>Сумма очков по трём критериям</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#f0f9ff', borderBottom: '2px solid #bae6fd' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left',  fontSize: 13, color: '#1e40af', fontWeight: 700 }}>Место</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left',  fontSize: 13, color: '#1e40af', fontWeight: 700 }}>Команда</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: '#1e40af', fontWeight: 700 }}>ГРР (1–5)</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: '#1e40af', fontWeight: 700 }}>Проектирование (6–8)</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: '#1e40af', fontWeight: 700 }}>Управление (9–10)</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: '#1e40af', fontWeight: 700 }}>Итого очков</th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((t, idx) => {
                        const r      = ranks[t.teamId];
                        const rowBg  = r === 1 ? '#fefce8' : idx % 2 === 0 ? '#fff' : '#f8fafc';
                        const pt     = (key) => t.ranking[key]?.points ?? 0;
                        const grr    = t.metrics.grr?.value;
                        const s2     = t.metrics.stage2?.value;
                        const s3     = t.metrics.stage3?.value;
                        const c1     = t.stageCosts?.stage1_5  ?? 0;
                        const c2     = t.stageCosts?.stage6_8  ?? 0;
                        const c3     = t.stageCosts?.stage9_10 ?? 0;
                        const costStyle = { display: 'block', fontSize: 11, color: '#c2410c', marginTop: 2 };
                        return (
                            <tr key={t.teamId} style={{ background: rowBg, borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 14, color: r <= 3 ? '#1e40af' : '#64748b' }}>
                                    {MEDAL[r] || `#${r}`}
                                </td>
                                <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{t.teamName}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: '#475569' }}>
                                    {grr != null ? `${fmtNumber(Math.round(grr))} тыс. т.` : '—'}
                                    <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 11 }}>({pt('grr')} оч.)</span>
                                    {c1 > 0 && <span style={costStyle}>−{fmtNumber(c1)} млн</span>}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: '#475569' }}>
                                    {s2 != null ? `${fmtNumber(s2)} т.` : '—'}
                                    <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 11 }}>({pt('stage2')} оч.)</span>
                                    {c2 > 0 && <span style={costStyle}>−{fmtNumber(c2)} млн</span>}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: '#475569' }}>
                                    {s3 != null ? `${fmtNumber(s3)} т.` : '—'}
                                    <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 11 }}>({pt('stage3')} оч.)</span>
                                    {c3 > 0 && <span style={costStyle}>−{fmtNumber(c3)} млн</span>}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, fontSize: 15, color: '#1e40af' }}>{t.totalPoints}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// ── Вкладка рейтинга ──────────────────────────────────────────────────────────
const RatingTab = ({ sessions, sessId: externalSessId }) => {
    const isControlled = externalSessId !== undefined;
    const [ownSessId, setOwnSessId] = useState('');
    const [data, setData]      = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError]    = useState(null);

    const sessId = isControlled ? externalSessId : ownSessId;

    const load = async (sid) => {
        if (!sid) return;
        setLoading(true); setError(null); setData(null);
        try {
            const json = await apiAction(`/api/admin/sessions/${sid}/rating`, 'GET');
            setData(json);
        } catch (e) { setError(e.message); } finally { setLoading(false); }
    };

    useEffect(() => {
        setData(null);
        if (externalSessId) load(externalSessId);
    }, [externalSessId]);

    const teams = data?.teams ?? [];

    return (
        <div>
            {!isControlled && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
                    <select className="tc-select" value={ownSessId} onChange={e => { setOwnSessId(e.target.value); load(e.target.value); }}>
                        <option value="">— выберите сессию —</option>
                        {(sessions ?? []).map(s => (
                            <option key={s.id} value={s.id}>{s.code} · {s.status} · {s.teamsCount ?? 0} команд</option>
                        ))}
                    </select>
                    <button className="tb tb-gray" onClick={() => load(ownSessId)} disabled={!ownSessId || loading}>↻ Обновить</button>
                </div>
            )}

            {loading && <div className="ap-loading">Загрузка рейтинга…</div>}
            {error   && <div style={{ color: '#dc2626', padding: 12 }}>Ошибка: {error}</div>}
            {!isControlled && !sessId && !loading && <div className="dash-empty">Выберите сессию для просмотра рейтинга</div>}
            {data && !loading && teams.length === 0 && <div className="dash-empty">В сессии нет команд</div>}

            {data && !loading && teams.length > 0 && (
                <div>
                    <TotalRatingTable teams={teams} />

                    <RatingTable
                        title="1. Геологоразведка (этап 1–5)"
                        hint="Площадь СРР × плотность запасов (ПО) + запасы по 3Р · больше = лучше"
                        teams={teams}
                        metricKey="grr"
                        costKey="stage1_5"
                        valueLabel={m => m.value != null && m.value > 0
                            ? `${fmtNumber(Math.round(m.value))} тыс. т.`
                            : '—'}
                    />

                    <RatingTable
                        title="2. Накопленная добыча — Проектирование разработки (этап 6–8)"
                        hint="Сумма «Доп. добыча за год» по всем ЛУ и годам 6–8 · больше = лучше"
                        teams={teams}
                        metricKey="stage2"
                        costKey="stage6_8"
                        valueLabel={m => m.value != null && m.value > 0
                            ? `${fmtNumber(m.value)} т.`
                            : '—'}
                    />

                    <RatingTable
                        title="3. Накопленная добыча — Управление разработкой (этап 9–10)"
                        hint="Сумма «Доп. добыча за год» по всем ЛУ и годам 9–10 · больше = лучше"
                        teams={teams}
                        metricKey="stage3"
                        costKey="stage9_10"
                        valueLabel={m => m.value != null && m.value > 0
                            ? `${fmtNumber(m.value)} т.`
                            : '—'}
                    />
                </div>
            )}
        </div>
    );
};

// ── Вкладка «Баг репорт» ──────────────────────────────────────────────────────
const BugReportsTab = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const load = async () => {
        setLoading(true); setError(null);
        try {
            const data = await apiAction('/api/admin/bug-reports', 'GET');
            setReports(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const remove = async (id) => {
        try {
            await apiAction(`/api/admin/bug-reports/${id}`, 'DELETE');
            setReports(prev => prev.filter(r => r.id !== id));
        } catch (e) {
            alert('Ошибка удаления: ' + e.message);
        }
    };

    const fmt = (ts) => {
        if (!ts) return '—';
        const d = new Date(Number(ts) * 1000);
        return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <h2 style={{ margin: 0 }}>Баг-репорты</h2>
                <button className="tb tb-gray" onClick={load} disabled={loading}>↻ Обновить</button>
                {reports.length > 0 && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>{reports.length} шт.</span>}
            </div>

            {loading && <div className="ap-loading">Загрузка…</div>}
            {error && <div style={{ color: '#fca5a5', padding: '12px 0' }}>Ошибка: {error}</div>}

            {!loading && reports.length === 0 && !error && (
                <p className="ap-empty">Баг-репортов нет.</p>
            )}

            {reports.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {reports.map(r => (
                        <div key={r.id} style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10,
                            padding: '14px 16px',
                            position: 'relative',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{
                                    background: 'rgba(96,165,250,0.15)',
                                    border: '1px solid rgba(96,165,250,0.3)',
                                    borderRadius: 6,
                                    padding: '2px 10px',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    color: '#93c5fd',
                                    whiteSpace: 'nowrap',
                                }}>{r.location}</span>
                                {r.team_name && (
                                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                                        👤 {r.team_name}
                                    </span>
                                )}
                                {r.session_id && (
                                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)' }}>
                                        сессия: {r.session_id}
                                    </span>
                                )}
                                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
                                    {fmt(r.created_at)}
                                </span>
                            </div>
                            <p style={{ margin: '10px 0 0', fontSize: '0.88rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {r.description}
                            </p>
                            <button
                                onClick={() => remove(r.id)}
                                style={{
                                    position: 'absolute', top: 10, right: 10,
                                    background: 'none', border: 'none',
                                    color: 'rgba(239,68,68,0.5)', cursor: 'pointer',
                                    fontSize: '1rem', lineHeight: 1, padding: '2px 6px',
                                    borderRadius: 4,
                                }}
                                title="Удалить"
                            >×</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Главный компонент AdminPanel ───────────────────────────────────────────────
const AdminPanel = ({ onLogout }) => {
    const [loggedIn, setLoggedIn] = useState(() => !!getSavedToken());
    const [tab, setTab] = useState('create');
    const [stats, setStats] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(false);
    const [controlSess, setControlSess] = useState(null);
    const [headerTimer, setHeaderTimer] = useState(null);
    const [selectedSessions, setSelectedSessions] = useState(new Set());
    const [confirmState, setConfirmState] = useState(null);
    const adminSocketRef = useRef(null);

    const openConfirm = (message, onConfirm) => setConfirmState({ message, onConfirm });
    const closeConfirm = () => setConfirmState(null);

    useEffect(() => {
        const onUnauthorized = () => {
            adminSocketRef.current?.disconnect(); adminSocketRef.current = null;
            sessionStorage.removeItem('admin_tab');
            setLoggedIn(false);
        };
        window.addEventListener('admin:unauthorized', onUnauthorized);
        return () => window.removeEventListener('admin:unauthorized', onUnauthorized);
    }, []);

    useEffect(() => {
        if (!loggedIn) { adminSocketRef.current?.disconnect(); adminSocketRef.current = null; return; }
        if (adminSocketRef.current) return;
        const sock = socketIO(WS_URL, { auth: { role: 'admin' }, transports: ['websocket'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000 });
        adminSocketRef.current = sock;
        sock.on('connect', () => console.log('[admin ws] connected'));
        sock.on('disconnect', () => console.log('[admin ws] disconnected'));
        sock.on('timer:state', d => setHeaderTimer(d));
        sock.on('timer:tick', d => setHeaderTimer(p => p ? { ...p, ...d } : d));
    }, [loggedIn]);

    useEffect(() => { if (loggedIn) { const t = sessionStorage.getItem('admin_tab') || 'create'; setTab(t); } }, []);

    if (!loggedIn) {
        return <LoginScreen onLogin={() => setLoggedIn(true)} />;
    }

    const logout = () => {
        adminSocketRef.current?.disconnect(); adminSocketRef.current = null;
        localStorage.removeItem('auth_token'); sessionStorage.removeItem('admin_tab');
        setLoggedIn(false);
        onLogout?.();
    };

    const loadSessions = async () => { setLoading(true); try { setSessions(await apiAction('/api/admin/sessions', 'GET')); } catch (e) { console.error(e); } finally { setLoading(false); } };
    const loadTeams = async () => { setLoading(true); try { setTeams(await getAdminTeams()); } catch { } finally { setLoading(false); } };
    const loadDash = async () => { setLoading(true); try { setStats(await getAdminStats()); } catch { } finally { setLoading(false); } };

    const changeTab = t => {
        setTab(t); sessionStorage.setItem('admin_tab', t);
        if (['sessions', 'control'].includes(t)) loadSessions();
        if (t === 'teams') loadTeams();
        if (t === 'dashboard') { loadSessions(); loadDash(); }
    };

    const goToControl = async (sessionId) => {
        await loadSessions();
        setControlSess(sessionId);
        changeTab('control');
    };

    const handleExport = async (type) => {
        try {
            const blob = await exportData(type, 'csv');
            const url = URL.createObjectURL(blob);
            const a = Object.assign(document.createElement('a'), { href: url, download: `${type}_${Date.now()}.csv` });
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        } catch (e) { alert('Ошибка: ' + e.message); }
    };

    const TABS = [
        { id: 'create',     label: '+ Создать' },
        { id: 'presets',    label: 'Пресеты' },
        { id: 'control',    label: 'Управление сессией' },
        { id: 'sessions',   label: 'Сессии' },
        // { id: 'teams',   label: 'Команды' },
        { id: 'dashboard',  label: 'Статистика' },
        { id: 'bugreports', label: 'Баг репорт' },
    ];

    return (
        <div className="ap">
            <header className="ap-header">
                <h1>Админ-панель · Курс на карбонаты</h1>
                {headerTimer?.isRunning && (
                    <div className="htw" onClick={() => changeTab('control')} title="Перейти к управлению">
                        <span className="htw-year">Год {headerTimer.currentYear}/10</span>
                        <span className={`htw-time${headerTimer.timeRemaining <= 30 ? ' htw-critical' : headerTimer.timeRemaining <= 120 ? ' htw-warn' : ''}`}>
                            {fmt(headerTimer.timeRemaining)}
                        </span>
                        <span className="htw-phase">{PHASE_LABELS[headerTimer.phase] ?? headerTimer.phase}</span>
                        <span className={`htw-dot ${headerTimer.isPaused ? 'htw-dot-pause' : 'htw-dot-run'}`} />
                    </div>
                )}
                <button className="ap-logout" onClick={logout}>Выйти</button>
            </header>
            <nav className="ap-nav">
                {TABS.map(t => <button key={t.id} className={`ap-tab ${tab === t.id ? 'ap-tab-on' : ''}`} onClick={() => changeTab(t.id)}>{t.label}</button>)}
            </nav>
            <main className={`ap-main${tab === 'control' ? ' ap-main--control' : ''}`}>
                {loading && <div className="ap-loading">Загрузка…</div>}

                {tab === 'create' && <CreateSessionTab onGoToControl={goToControl} />}

                {tab === 'presets' && <PresetsTab />}

                {tab === 'control' && (
                    <div className="control-wrap">
                        <h2>Управление сессией</h2>
                        <div className="tc-select-row">
                            <select className="tc-select" value={controlSess || ''} onChange={e => setControlSess(e.target.value || null)}>
                                <option value="">— выберите сессию —</option>
                                {sessions.map(s => <option key={s.id} value={s.id}>{s.code} · {s.status} · {s.teamsCount ?? 0} команд</option>)}
                            </select>
                            <button className="tb tb-gray" onClick={loadSessions}>↻ Обновить</button>
                        </div>
                        <div className="control-layout">
                            <div className="control-left">
                                <TimerControl sessionId={controlSess} sessions={sessions} adminSocket={adminSocketRef} onRefresh={loadSessions} openConfirm={openConfirm} />
                                {controlSess && (
                                    <div className="live-editor-card" style={{ marginTop: '1rem' }}>
                                        <div className="live-editor-card-title">Таймеры сессии</div>
                                        <LiveTimersEditor sessionId={controlSess} adminSocket={adminSocketRef} />
                                    </div>
                                )}
                                {controlSess && (
                                    <div className="live-editor-card" style={{ marginTop: '1rem' }}>
                                        <div className="live-editor-card-title">Стартовое окно</div>
                                        <IntroEditor sessionId={controlSess} />
                                    </div>
                                )}
                            </div>
                            <div className="control-right">
                                <TeamsMonitor sessionId={controlSess} />
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'sessions' && (
                    <div>
                        <h2>Сессии</h2>
                        {sessions.length === 0 ? (
                            <p className="ap-empty">Нет сессий. Создайте во вкладке «+ Создать».</p>
                        ) : (
                            <>
                                <div className="sessions-toolbar">
                                    <label className="sess-select-all">
                                        <input
                                            type="checkbox"
                                            checked={selectedSessions.size === sessions.length}
                                            onChange={e => setSelectedSessions(e.target.checked ? new Set(sessions.map(s => s.id)) : new Set())}
                                        />
                                        {selectedSessions.size === sessions.length ? 'Снять выбор' : 'Выбрать все'}
                                    </label>
                                    {selectedSessions.size > 0 && (
                                        <button
                                            className="ab ab-red"
                                            onClick={() => openConfirm(`Удалить ${selectedSessions.size} сессий(ю)?`, async () => {
                                                for (const id of selectedSessions) {
                                                    try { await deleteSession(id); } catch (e) { alert(e.message); break; }
                                                }
                                                setSelectedSessions(new Set());
                                                loadSessions();
                                            })}
                                        >
                                            Удалить выбранные ({selectedSessions.size})
                                        </button>
                                    )}
                                </div>
                                <div className="sessions-grid">
                                    {sessions.map(s => (
                                        <div
                                            key={s.id}
                                            className={`session-card sc-${s.status}${selectedSessions.has(s.id) ? ' sc-selected' : ''}`}
                                            onClick={() => setSelectedSessions(prev => {
                                                const next = new Set(prev);
                                                next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                                                return next;
                                            })}
                                        >
                                            <div className="sc-header">
                                                <input
                                                    type="checkbox"
                                                    className="sc-checkbox"
                                                    checked={selectedSessions.has(s.id)}
                                                    onChange={() => {}}
                                                    onClick={e => e.stopPropagation()}
                                                />
                                                <span className="sc-code">{s.code}</span>
                                                <span className={`badge badge-${s.status}`}>{s.status}</span>
                                            </div>
                                            <div className="sc-meta">
                                                <span className="sc-meta-item">{s.game_mode === 'online' ? 'Онлайн' : 'Одиночная'}</span>
                                                <span className="sc-meta-item">{s.teamsCount || 0} команд</span>
                                                <span className="sc-meta-item">Макс. {s.max_lus ?? s.maxLUsPerTeam ?? '—'} ЛУ</span>
                                            </div>
                                            <div className="sc-actions" onClick={e => e.stopPropagation()}>
                                                {s.status === 'waiting' && (
                                                    <button className="ab ab-green" onClick={async () => { try { await apiAction(`/api/admin/sessions/${s.id}/start`); loadSessions(); } catch (e) { alert(e.message); } }}>▶ Старт</button>
                                                )}
                                                <button className="ab" onClick={() => { setControlSess(s.id); changeTab('control'); }}>Управление →</button>
                                                <button className="ab ab-red" onClick={() => openConfirm('Удалить сессию?', async () => { try { await deleteSession(s.id); loadSessions(); } catch (e) { alert(e.message); } })}>Удалить</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {tab === 'teams' && (
                    <div>
                        <h2>Команды</h2>
                        {teams.length === 0 ? <p className="ap-empty">Нет команд.</p> : (
                            <div className="ap-table-wrap">
                                <table className="ap-table">
                                    <thead><tr><th>Название</th><th>Опыт</th><th>Участники</th><th>Сессия</th><th>Действия</th></tr></thead>
                                    <tbody>
                                        {teams.map(t => (
                                            <tr key={t.id}>
                                                <td><strong>{t.name}</strong></td>
                                                <td>{t.experience === 'students' ? 'Студенты' : 'Профессионалы'}</td>
                                                <td>{t.members_json?.length || 0}</td>
                                                <td>{t.session_code || '—'}</td>
                                                <td><button className="ab" onClick={() => openConfirm('Сбросить команду?', async () => { try { await resetTeam(t.id); loadTeams(); } catch (e) { alert(e.message); } })}>Сброс</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'dashboard' && (
                    <div>
                        <h2>Статистика</h2>
                        <DashboardTab sessions={sessions} globalStats={stats} />
                    </div>
                )}

                {tab === 'bugreports' && <BugReportsTab />}
            </main>

            {confirmState && (
                <ConfirmModal
                    message={confirmState.message}
                    onConfirm={() => { closeConfirm(); confirmState.onConfirm(); }}
                    onCancel={closeConfirm}
                />
            )}
        </div>
    );
};

export default AdminPanel;