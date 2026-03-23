import React, { useEffect, useState, useRef } from 'react';
import {
    getAdminSessions, getAdminTeams, getAdminStats,
    deleteSession, resetTeam, exportData,
    adminLogin, getAdminSessionDetails,
} from './apiHelpers';
import { io as socketIO } from 'socket.io-client';
import './AdminPanel.css';

// ─── Константы ───────────────────────────────────────────────────────────────

const YEARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const DEFAULT_TIMERS = {
    regionMap: { selection: 20, auction: 2, postAuction: 2 },
    years: { 1: 25, 2: 20, 3: 15, 4: 15, 5: 10, 6: 15, 7: 15, 8: 15, 9: 10, 10: 10 },
};

const BUDGET_DEFAULTS = { students: 99999999, professionals: 99999999 };

const ALL_PHASES = [
    'LOBBY',
    'REGION_MAP_SELECTION',
    'REGION_MAP_AUCTION',
    'REGION_MAP_POST_AUCTION',
    'RESEARCH',
];

const PHASE_LABELS = {
    LOBBY: 'Лобби',
    REGION_MAP_SELECTION: 'Карта — выбор ЛУ',
    REGION_MAP_AUCTION: 'Карта — аукцион',
    REGION_MAP_POST_AUCTION: 'Карта — допокупка',
    RESEARCH: 'Основная игра (НИР / события / полевые / результаты)',
};

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const fmt = (sec) => {
    const s = Math.max(0, Math.floor(sec ?? 0));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const getSavedToken = () => localStorage.getItem('auth_token') || null;

// ─── API ─────────────────────────────────────────────────────────────────────

const apiAction = async (path, method = 'POST', body) => {
    const token = getSavedToken();
    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};

// ─── MinuteInput ─────────────────────────────────────────────────────────────

const MinuteInput = ({ value, onChange, disabled }) => {
    const [raw, setRaw] = useState(String(value ?? ''));
    useEffect(() => setRaw(String(value ?? '')), [value]);

    const commit = () => {
        const n = parseFloat(String(raw).replace(',', '.'));
        const v = isNaN(n) || n < 0 ? 0 : Math.min(Math.round(n * 1000) / 1000, 120);
        setRaw(String(v));
        onChange(v);
    };

    return (
        <input
            className="min-input"
            type="number" min={0} max={120} step="any"
            value={raw}
            onChange={e => setRaw(e.target.value)}
            onBlur={commit}
            disabled={disabled}
        />
    );
};

// ─── LoginScreen ─────────────────────────────────────────────────────────────

const LoginScreen = ({ onLogin }) => {
    const [pw, setPw] = useState('');
    const [loading, setLoad] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
        if (!pw.trim()) return;
        setLoad(true); setError('');
        try {
            let token;
            try {
                const res = await adminLogin('admin', pw);
                token = res.token;
            } catch {
                token = pw;
            }
            localStorage.setItem('auth_token', token);
            onLogin(token);
        } catch {
            setError('Неверный пароль');
        } finally {
            setLoad(false);
        }
    };

    return (
        <div className="login-wrap">
            <div className="login-card">
                <div className="login-icon">⚙️</div>
                <h2>Админ-панель</h2>
                <p className="login-hint">Курс на карбонаты</p>
                <input
                    type="password" className="login-input"
                    placeholder="Пароль администратора"
                    value={pw}
                    onChange={e => { setPw(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && submit()}
                    autoFocus
                />
                {error && <div className="login-error">{error}</div>}
                <button className="login-btn" onClick={submit} disabled={loading || !pw.trim()}>
                    {loading ? 'Вход...' : 'Войти →'}
                </button>
            </div>
        </div>
    );
};

// ─── TimersForm ──────────────────────────────────────────────────────────────

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
        // Два столбца: левый — карта региона, правый — годовая сетка
        <div className="timers-form">
            <div className="tf-section">
                <div className="tf-section-title">🗺️ Карта региона</div>
                <div className="tf-row">
                    <label>Выбор участков</label>
                    <div className="tf-row-right">
                        <MinuteInput value={timers.regionMap.selection} onChange={v => set('regionMap.selection', v)} />
                        <span>мин</span>
                    </div>
                </div>
                <div className="tf-row">
                    <label>Аукцион</label>
                    <div className="tf-row-right">
                        <MinuteInput value={timers.regionMap.auction} onChange={v => set('regionMap.auction', v)} />
                        <span>мин</span>
                    </div>
                </div>
                <div className="tf-row">
                    <label>Допокупка</label>
                    <div className="tf-row-right">
                        <MinuteInput value={timers.regionMap.postAuction} onChange={v => set('regionMap.postAuction', v)} />
                        <span>мин</span>
                    </div>
                </div>
            </div>

            <div className="tf-section">
                <div className="tf-section-title">📅 НИР · События · Полевые · Результаты (по годам)</div>
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

// ─── LiveTimersEditor ─────────────────────────────────────────────────────────

const LiveTimersEditor = ({ sessionId, adminSocket }) => {
    const [timers, setTimers] = useState(JSON.parse(JSON.stringify(DEFAULT_TIMERS)));
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!sessionId) return;
        setSaved(false);
        setLoading(true);
        getAdminSessionDetails(sessionId)
            .then(s => {
                const years = { ...DEFAULT_TIMERS.years };
                Object.entries(s.timers || {}).forEach(([y, v]) => {
                    const n = Number(y);
                    if (n >= 1 && n <= 10) years[n] = Number(v);
                });
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
            adminSocket?.current?.emit('admin:updateTimers', {
                sessionId,
                yearTimers: timers.years,
                regionMapTimers: timers.regionMap,
                regionMapTimer: timers.regionMap.selection,
            });
            await apiAction(`/api/admin/sessions/${sessionId}/timers`, 'PATCH', {
                yearTimers: timers.years,
                regionMapTimers: timers.regionMap,
                regionMapTimer: timers.regionMap.selection,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (e) {
            alert('Ошибка: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="live-editor">
            <div className="live-editor-head">
                <span>Изменить таймеры</span>
                <button className="ghost-btn" onClick={() => setTimers(JSON.parse(JSON.stringify(DEFAULT_TIMERS)))}>↺ сброс</button>
            </div>
            {loading
                ? <div className="live-editor-loading">Загрузка…</div>
                : <TimersForm timers={timers} onChange={setTimers} />
            }
            <button
                className={`apply-btn ${saved ? 'apply-btn-saved' : ''}`}
                onClick={handleApply}
                disabled={saving || loading || !sessionId}
            >
                {saving ? '⏳ Применяю…' : saved ? '✅ Применено!' : '💾 Применить к сессии'}
            </button>
            <p className="apply-hint">Новое время вступит в силу при следующей смене фазы или года.</p>
        </div>
    );
};

// ─── TimerControl ─────────────────────────────────────────────────────────────

const TimerControl = ({ sessionId, sessions, adminSocket, onRefresh }) => {
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
        sock.on('connect', onConn);
        sock.on('disconnect', onDisc);
        sock.on('timer:state', onState);
        sock.on('timer:tick', onTick);
        setConn(sock.connected);
        return () => {
            sock.off('connect', onConn);
            sock.off('disconnect', onDisc);
            sock.off('timer:state', onState);
            sock.off('timer:tick', onTick);
        };
    }, [adminSocket]);

    useEffect(() => {
        const sock = adminSocket?.current;
        if (!sock || !sessionId) return;
        sock.emit('admin:joinSession', { sessionId });
        setTimer(null);
    }, [sessionId, adminSocket]);

    const emit = (ev, extra = {}) => adminSocket?.current?.emit(ev, { sessionId, ...extra });

    const handleStart = async () => {
        setStarting(true);
        try { await apiAction(`/api/admin/sessions/${sessionId}/start`); onRefresh?.(); }
        catch (e) { alert('Ошибка: ' + e.message); }
        finally { setStarting(false); }
    };

    const handleStop = async () => {
        if (!confirm('Завершить сессию?')) return;
        try { await apiAction(`/api/admin/sessions/${sessionId}/stop`); onRefresh?.(); }
        catch (e) { alert('Ошибка: ' + e.message); }
    };

    if (!sessionId) return <div className="tc-empty">Выберите сессию из списка выше</div>;

    return (
        <div className="tc-panel">
            <div className="tc-status">
                <span className={`dot ${connected ? 'dot-on' : 'dot-off'}`} />
                <span>{connected ? 'Подключено' : 'Нет соединения'}</span>
                <code className="tc-sid">{sessionId.slice(0, 8)}…</code>
                <span className={`badge badge-${status}`}>{status}</span>
            </div>

            <div className="tc-action">
                {status === 'waiting' && (
                    <button className="tc-start-btn" onClick={handleStart} disabled={!connected || starting}>
                        {starting ? '⏳ Запуск…' : '🚀 Старт сессии'}
                    </button>
                )}
                {status === 'active' && (
                    <div className="tc-active-row">
                        <div className="tc-active-label">✅ Сессия активна</div>
                        <button className="tc-stop-btn" onClick={handleStop}>⏹ Завершить</button>
                    </div>
                )}
                {status === 'finished' && <div className="tc-finished-label">Сессия завершена</div>}
            </div>

            <div className="tc-display">
                <div className="tc-time">{timer ? fmt(timer.timeRemaining) : '--:--'}</div>
                {timer && (
                    <div className="tc-meta">
                        <span>Год {timer.currentYear}/10</span>
                        <span className="tc-phase-label">{PHASE_LABELS[timer.phase] ?? timer.phase}</span>
                        <span className={`tc-badge ${timer.isRunning && !timer.isPaused ? 'tc-run' : timer.isPaused ? 'tc-pause' : 'tc-stop'}`}>
                            {timer.isRunning && !timer.isPaused ? 'Идёт' : timer.isPaused ? 'Пауза' : 'Стоп'}
                        </span>
                    </div>
                )}
                {timer?.pendingRefusal && (
                    <div className="tc-refusal">Отказной период — {fmt(timer.refusalTimeLeft)}</div>
                )}
            </div>

            <div className="tc-group-label">Управление</div>
            <div className="tc-btns">
                <button className="tb tb-green" onClick={() => emit('admin:startTimer')} disabled={!connected || (timer?.isRunning && !timer?.isPaused)}>▶ Старт</button>
                <button className="tb tb-yellow" onClick={() => emit(timer?.isPaused ? 'admin:resumeTimer' : 'admin:pauseTimer')} disabled={!connected || !timer?.isRunning}>
                    {timer?.isPaused ? '▶ Продолжить' : '⏸ Пауза'}
                </button>
            </div>

            <div className="tc-group-label">Навигация</div>
            <div className="tc-btns">
                <button className="tb tb-gray" onClick={() => emit('admin:advanceYear')} disabled={!connected}>След. год →</button>
                <button className="tb tb-gray tb-danger" onClick={() => confirm('Сбросить к году 1?') && emit('admin:resetTimer')} disabled={!connected}>↺ Сброс</button>
            </div>

            <div className="tc-group-label">Сменить фазу</div>
            <div className="tc-phase-row">
                <select className="tc-select" value={phase} onChange={e => setPhase_(e.target.value)}>
                    {ALL_PHASES.map(p => <option key={p} value={p}>{PHASE_LABELS[p] ?? p}</option>)}
                </select>
                <button className="tb tb-gray" onClick={() => emit('admin:setPhase', { phase })} disabled={!connected}>Применить</button>
            </div>
        </div>
    );
};

// ─── CreateSessionTab ─────────────────────────────────────────────────────────

const CreateSessionTab = () => {
    const [step, setStep] = useState('form');
    const [loading, setLoad] = useState(false);
    const [error, setError] = useState('');
    const [created, setCreated] = useState(null);
    const [copied, setCopied] = useState(false);

    const [form, setForm] = useState({
        gameMode: 'online',
        playerType: 'students',
        maxLUs: 3,
        budgets: { ...BUDGET_DEFAULTS },
        timers: JSON.parse(JSON.stringify(DEFAULT_TIMERS)),
    });

    const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleCreate = async () => {
        setError(''); setLoad(true);
        try {
            const token = getSavedToken();
            const payload = {
                gameMode: form.gameMode,
                playerType: form.playerType,
                maxLUsPerTeam: form.maxLUs,
                budget: form.budgets[form.playerType],
                budgets: form.budgets,
                regionMapTimers: form.timers.regionMap,
                timers: form.timers.years,
            };
            const r = await fetch(`${API_URL}/api/admin/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const res = await r.json();
            setCreated(res);
            setStep('done');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoad(false);
        }
    };

    if (step === 'done' && created) {
        return (
            <div className="created-screen">
                <div className="created-icon">✅</div>
                <h2>Сессия создана!</h2>
                <div className="code-box">
                    <div className="code-label">Код для команд</div>
                    <div className="code-value">{created.sessionCode}</div>
                    <button className="copy-btn" onClick={() => {
                        navigator.clipboard.writeText(created.sessionCode);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    }}>
                        {copied ? '✅ Скопировано' : '📋 Копировать'}
                    </button>
                </div>
                <p className="created-hint">Таймер → выберите сессию → нажмите «Старт сессии»</p>
                <button className="secondary-btn" onClick={() => { setStep('form'); setCreated(null); setCopied(false); }}>＋ Создать ещё</button>
            </div>
        );
    }

    return (
        <div className="create-form">
            <div className="create-form-left">
                <div className="fs">
                    <div className="fs-title">Режим игры</div>
                    <div className="toggle-row">
                        {[['online', '🌐 Онлайн'], ['solo', '👤 Одиночная']].map(([v, l]) => (
                            <button key={v} className={`tog ${form.gameMode === v ? 'tog-on' : ''}`} onClick={() => sf('gameMode', v)}>{l}</button>
                        ))}
                    </div>
                </div>

                <div className="fs">
                    <div className="fs-title">Тип игроков</div>
                    <div className="toggle-row">
                        {[['students', '🎓 Студенты'], ['professionals', '💼 Профессионалы']].map(([v, l]) => (
                            <button key={v} className={`tog ${form.playerType === v ? 'tog-on' : ''}`} onClick={() => sf('playerType', v)}>{l}</button>
                        ))}
                    </div>
                </div>

                <div className="fs">
                    <div className="fs-title">Бюджеты (млн ₽)</div>
                    <div className="tf-row">
                        <label>🎓 Студенты</label>
                        <div className="tf-row-right">
                            <input className="num-input" type="number" min={1} value={form.budgets.students}
                                onChange={e => setForm(f => ({ ...f, budgets: { ...f.budgets, students: Number(e.target.value) } }))} />
                            <span>млн</span>
                        </div>
                    </div>
                    <div className="tf-row">
                        <label>💼 Профессионалы</label>
                        <div className="tf-row-right">
                            <input className="num-input" type="number" min={1} value={form.budgets.professionals}
                                onChange={e => setForm(f => ({ ...f, budgets: { ...f.budgets, professionals: Number(e.target.value) } }))} />
                            <span>млн</span>
                        </div>
                    </div>
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

                {error && <div className="form-error">{error}</div>}

                <button className="create-btn" onClick={handleCreate} disabled={loading}>
                    {loading ? 'Создание…' : '🚀 Создать сессию'}
                </button>
            </div>
        </div>
    );
};

// ─── TeamsMonitor ─────────────────────────────────────────────────────────────
//
// АККОРДЕОН — каждая карточка открывается и закрывается НЕЗАВИСИМО.
//
// openIds — это React.useState с Set<string>.
// toggle(teamId):
//   • если String(teamId) есть в Set → удаляем (карточка закрывается)
//   • если нет → добавляем (карточка открывается)
//   • все остальные карточки НЕ затрагиваются
//
// isOpen = openIds.has(String(team.id)) — строгое сравнение строк,
// не зависит от того, число или строка пришло с сервера.

const TeamsMonitor = ({ sessionId }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [openIds, setOpenIds] = useState(() => new Set());

    const load = async (sid) => {
        if (!sid) return;
        setLoading(true);
        try {
            const token = getSavedToken();
            const r = await fetch(`${API_URL}/api/admin/sessions/${sid}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            setData(await r.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setData(null);
        setOpenIds(new Set());   // сбрасываем все раскрытые при смене сессии
        load(sessionId);
    }, [sessionId]);

    const toggle = (teamId) => {
        const id = String(teamId);
        setOpenIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);   // карточка была открыта → закрываем
            } else {
                next.add(id);      // карточка была закрыта → открываем
            }
            return next;
        });
    };

    if (!sessionId) return <div className="tm-empty">Выберите сессию для просмотра команд</div>;
    if (loading) return <div className="tm-loading">Загрузка данных…</div>;
    if (!data) return <div className="tm-empty">Нет данных</div>;

    const teams = data.teams ?? [];
    const cells = data.cells ?? [];

    const teamCells = {};
    cells.forEach(cell => {
        if (!cell.team_id) return;
        (teamCells[cell.team_id] ??= []).push(cell.cell_ref);
    });

    const maxBudget = Math.max(...teams.map(t => t.initial_budget ?? t.budget ?? 0), 1);
    const sorted = [...teams].sort((a, b) => b.budget - a.budget);

    return (
        <div className="tm-wrap">
            <div className="tm-refresh-row">
                <button className="tb tb-gray" onClick={() => load(sessionId)}>↻ Обновить</button>
                <span className="tm-hint">{teams.length} команд · сессия {data.code}</span>
            </div>

            <div className="tm-cards">
                {sorted.map(team => {
                    const lu = teamCells[team.id] ?? [];
                    const members = team.members_json ?? team.members ?? [];
                    const initial = team.initial_budget ?? team.budget ?? 0;
                    const spent = initial - (team.budget ?? 0);
                    const pct = Math.max(0, Math.min(100, ((team.budget ?? 0) / maxBudget) * 100));
                    const isOnline = team.is_online;
                    const isOpen = openIds.has(String(team.id));

                    return (
                        <div
                            key={team.id}
                            className={`tm-card ${isOnline ? 'tm-card-online' : 'tm-card-offline'}`}
                        >
                            {/* Кликабельный заголовок */}
                            <div className="tm-card-header" onClick={() => toggle(team.id)}>
                                <div className="tm-card-left">
                                    <span className={`tm-online-dot ${isOnline ? 'tm-dot-on' : 'tm-dot-off'}`} />
                                    <strong className="tm-team-name">{team.name}</strong>
                                    <span className="tm-session-badge">{team.session_code || data.code}</span>
                                </div>
                                <div className="tm-card-right">
                                    <span className="tm-budget-val">{(team.budget ?? 0).toLocaleString('ru-RU')} млн ₽</span>
                                    <span className="tm-lu-count">{lu.length} ЛУ</span>
                                    <span className={`tm-chevron ${isOpen ? 'tm-chevron-open' : ''}`}>▼</span>
                                </div>
                            </div>

                            {/* Прогресс-бар бюджета */}
                            <div className="tm-budget-bar-wrap">
                                <div className="tm-budget-bar" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="tm-budget-sub">
                                <span>Начало: {initial.toLocaleString('ru-RU')} млн</span>
                                <span className={spent > 0 ? 'tm-spent' : ''}>Потрачено: {spent.toLocaleString('ru-RU')} млн</span>
                            </div>

                            {/* Аккордеон — рендерится только если isOpen */}
                            {isOpen && (
                                <div className="tm-card-details">
                                    <div className="tm-detail-section">
                                        <div className="tm-detail-title">🗺️ Лицензионные участки ({lu.length})</div>
                                        {lu.length === 0
                                            ? <div className="tm-detail-empty">Нет участков</div>
                                            : <div className="tm-lu-list">
                                                {lu.map(ref => <span key={ref} className="tm-lu-badge">{ref}</span>)}
                                            </div>
                                        }
                                    </div>

                                    <div className="tm-detail-section">
                                        <div className="tm-detail-title">👥 Состав ({members.length} чел.)</div>
                                        {members.length === 0
                                            ? <div className="tm-detail-empty">Нет данных</div>
                                            : <div className="tm-members-list">
                                                {members.map((m, i) => (
                                                    <div key={i} className="tm-member-row">
                                                        <span className="tm-member-icon">👤</span>
                                                        <span className="tm-member-name">
                                                            {typeof m === 'string' ? m : (m.name || m.fullName || JSON.stringify(m))}
                                                        </span>
                                                        {m.role && <span className="tm-member-role">{m.role}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        }
                                    </div>

                                    <div className="tm-detail-section tm-detail-meta">
                                        <div><span className="tm-meta-label">Тип:</span> {team.experience === 'students' ? '🎓 Студенты' : '💼 Профессионалы'}</div>
                                        <div><span className="tm-meta-label">Статус:</span> {isOnline ? '🟢 Онлайн' : '🔴 Офлайн'}</div>
                                        <div><span className="tm-meta-label">ID:</span> <code className="tm-id">{String(team.id).slice(0, 12)}…</code></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── AdminPanel ───────────────────────────────────────────────────────────────

const AdminPanel = () => {
    const [loggedIn, setLoggedIn] = useState(() => !!getSavedToken());
    const [tab, setTab] = useState('create');
    const [stats, setStats] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(false);
    const [timerSess, setTimerSess] = useState(null);
    const [monitorSess, setMonitorSess] = useState(null);
    const adminSocketRef = useRef(null);

    useEffect(() => {
        if (!loggedIn) {
            adminSocketRef.current?.disconnect();
            adminSocketRef.current = null;
            return;
        }
        if (adminSocketRef.current) return;

        const sock = socketIO(WS_URL, {
            auth: { role: 'admin' },
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
        });
        adminSocketRef.current = sock;
        sock.on('connect', () => console.log('🔧 admin ws connected'));
        sock.on('disconnect', () => console.log('🔧 admin ws disconnected'));
    }, [loggedIn]);

    useEffect(() => {
        if (loggedIn) {
            const savedTab = sessionStorage.getItem('admin_tab') || 'create';
            setTab(savedTab);
        }
    }, []);

    if (!loggedIn) {
        return <LoginScreen onLogin={token => {
            localStorage.setItem('auth_token', token);
            setLoggedIn(true);
        }} />;
    }

    const logout = () => {
        adminSocketRef.current?.disconnect();
        adminSocketRef.current = null;
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('admin_tab');
        setLoggedIn(false);
    };

    const apiFetch = async (url) => {
        const token = getSavedToken();
        const r = await fetch(`${API_URL}${url}`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.status === 401) { logout(); throw new Error('Unauthorized'); }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    };

    const loadSessions = async () => {
        setLoading(true);
        try { setSessions(await apiFetch('/api/admin/sessions')); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const loadTeams = async () => {
        setLoading(true);
        try { setTeams(await getAdminTeams()); } catch { }
        finally { setLoading(false); }
    };

    const loadDash = async () => {
        setLoading(true);
        try { setStats(await getAdminStats()); } catch { }
        finally { setLoading(false); }
    };

    const changeTab = t => {
        setTab(t);
        sessionStorage.setItem('admin_tab', t);
        if (['sessions', 'timer', 'monitor'].includes(t)) loadSessions();
        if (t === 'teams') loadTeams();
        if (t === 'dashboard') loadDash();
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
        { id: 'create', label: '＋ Создать' },
        { id: 'timer', label: '⏱ Таймер' },
        { id: 'monitor', label: '👁 Мониторинг' },
        { id: 'sessions', label: '🎮 Сессии' },
        { id: 'teams', label: '👥 Команды' },
        { id: 'dashboard', label: '📊 Статистика' },
    ];

    return (
        <div className="ap">
            <header className="ap-header">
                <h1>⚙️ Админ-панель · Курс на карбонаты</h1>
                <button className="ap-logout" onClick={logout}>Выйти</button>
            </header>

            <nav className="ap-nav">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        className={`ap-tab ${tab === t.id ? 'ap-tab-on' : ''}`}
                        onClick={() => changeTab(t.id)}
                    >
                        {t.label}
                    </button>
                ))}
            </nav>

            <main className="ap-main">
                {loading && <div className="ap-loading">Загрузка…</div>}

                {tab === 'create' && <CreateSessionTab />}

                {tab === 'timer' && (
                    <div className="timer-tab-wrap">
                        <h2>Управление таймером</h2>
                        <div className="tc-select-row">
                            <select className="tc-select" value={timerSess || ''} onChange={e => setTimerSess(e.target.value || null)}>
                                <option value="">— выберите сессию —</option>
                                {sessions.map(s => (
                                    <option key={s.id} value={s.id}>{s.code} · {s.status} · {s.teamsCount ?? 0} команд</option>
                                ))}
                            </select>
                            <button className="tb tb-gray" onClick={loadSessions}>↻ Обновить</button>
                        </div>
                        <div className="timer-columns">
                            <TimerControl sessionId={timerSess} sessions={sessions} adminSocket={adminSocketRef} onRefresh={loadSessions} />
                            {timerSess && (
                                <div className="live-editor-card">
                                    <div className="live-editor-card-title">📅 Таймеры сессии</div>
                                    <LiveTimersEditor sessionId={timerSess} adminSocket={adminSocketRef} />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tab === 'monitor' && (
                    <div className="monitor-tab-wrap">
                        <h2>Мониторинг команд</h2>
                        <div className="tc-select-row">
                            <select className="tc-select" value={monitorSess || ''} onChange={e => setMonitorSess(e.target.value || null)}>
                                <option value="">— выберите сессию —</option>
                                {sessions.map(s => (
                                    <option key={s.id} value={s.id}>{s.code} · {s.status} · {s.teamsCount ?? 0} команд</option>
                                ))}
                            </select>
                            <button className="tb tb-gray" onClick={loadSessions}>↻ Обновить список</button>
                        </div>
                        <TeamsMonitor sessionId={monitorSess} />
                    </div>
                )}

                {tab === 'sessions' && (
                    <div>
                        <h2>Сессии</h2>
                        {sessions.length === 0
                            ? <p className="ap-empty">Нет сессий. Создайте во вкладке «Создать».</p>
                            : (
                                <div className="ap-table-wrap">
                                    <table className="ap-table">
                                        <thead>
                                            <tr><th>Код</th><th>Статус</th><th>Режим</th><th>ЛУ</th><th>Команды</th><th>Действия</th></tr>
                                        </thead>
                                        <tbody>
                                            {sessions.map(s => (
                                                <tr key={s.id}>
                                                    <td><strong className="code-cell">{s.code}</strong></td>
                                                    <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                                                    <td>{s.game_mode === 'online' ? '🌐 Онлайн' : '👤 Одиночная'}</td>
                                                    <td>{s.max_lus ?? s.maxLUsPerTeam ?? '—'}</td>
                                                    <td>{s.teamsCount || 0}</td>
                                                    <td className="ap-actions">
                                                        {s.status === 'waiting' && (
                                                            <button className="ab ab-green" onClick={async () => {
                                                                try { await apiAction(`/api/admin/sessions/${s.id}/start`); loadSessions(); }
                                                                catch (e) { alert(e.message); }
                                                            }}>▶ Старт</button>
                                                        )}
                                                        <button className="ab" onClick={() => { setTimerSess(s.id); changeTab('timer'); }}>⏱ Таймер</button>
                                                        <button className="ab ab-red" onClick={async () => {
                                                            if (!confirm('Удалить сессию?')) return;
                                                            try { await deleteSession(s.id); loadSessions(); }
                                                            catch (e) { alert(e.message); }
                                                        }}>🗑 Удалить</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        }
                    </div>
                )}

                {tab === 'teams' && (
                    <div>
                        <h2>Команды</h2>
                        {teams.length === 0
                            ? <p className="ap-empty">Нет команд.</p>
                            : (
                                <div className="ap-table-wrap">
                                    <table className="ap-table">
                                        <thead>
                                            <tr><th>Название</th><th>Опыт</th><th>Участники</th><th>Сессия</th><th>Действия</th></tr>
                                        </thead>
                                        <tbody>
                                            {teams.map(t => (
                                                <tr key={t.id}>
                                                    <td><strong>{t.name}</strong></td>
                                                    <td>{t.experience === 'students' ? '🎓 Студенты' : '💼 Профессионалы'}</td>
                                                    <td>{t.members_json?.length || 0}</td>
                                                    <td>{t.session_code || '—'}</td>
                                                    <td>
                                                        <button className="ab" onClick={async () => {
                                                            if (!confirm('Сбросить команду?')) return;
                                                            try { await resetTeam(t.id); loadTeams(); }
                                                            catch (e) { alert(e.message); }
                                                        }}>🔄 Сброс</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        }
                    </div>
                )}

                {tab === 'dashboard' && (
                    <div>
                        <h2>Статистика</h2>
                        {stats ? (
                            <>
                                <div className="stats-row">
                                    {[
                                        ['🎮', stats.totalSessions || 0, 'Сессий'],
                                        ['👥', stats.totalTeams || 0, 'Команд'],
                                        ['🟢', stats.activeSessions || 0, 'Активных'],
                                    ].map(([icon, val, label]) => (
                                        <div key={label} className="stat-card">
                                            <div className="stat-icon">{icon}</div>
                                            <div className="stat-val">{val}</div>
                                            <div className="stat-label">{label}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="export-row">
                                    <button className="tb tb-gray" onClick={() => handleExport('sessions')}>📥 Сессии CSV</button>
                                    <button className="tb tb-gray" onClick={() => handleExport('teams')}>📥 Команды CSV</button>
                                </div>
                            </>
                        ) : <p className="ap-empty">Загрузка…</p>}
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminPanel;