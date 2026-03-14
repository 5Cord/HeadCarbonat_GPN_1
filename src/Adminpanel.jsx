import React, { useState } from 'react';
import {
    getAdminSessions,
    getAdminTeams,
    getAdminStats,
    deleteSession,
    resetTeam,
    exportData,
    createSession,
} from './apiHelpers';
import './AdminPanel.css';

// ─── Константы ───────────────────────────────────────────────────────────────

const YEARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const YEAR_LABEL = (y) => {
    if (y <= 4) return `Год ${y}`;
    if (y === 5) return `Год ${y}`;
    if (y <= 8) return `Год ${y}`;
    return `Год ${y}`;
};

// Карта региона - своё время (минуты), не зависит от года
const DEFAULT_REGION_MAP_TIMER = 20;

// НИР + События + Полевые + Результаты - одно общее время на год (минуты)
const DEFAULT_YEAR_TIMERS = {
    1: 25,
    2: 20,
    3: 15,
    4: 15,
    5: 10,
    6: 15,
    7: 15,
    8: 15,
    9: 10,
    10: 10,
};

const BUDGET_DEFAULTS = {
    students: 99999999,
    professionals: 99999999,
};

// ─── CreateSessionTab ─────────────────────────────────────────────────────────

const CreateSessionTab = () => {
    const [step, setStep] = useState('form');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [createdSession, setCreatedSession] = useState(null);
    const [timersExpanded, setTimersExpanded] = useState(false);

    const [form, setForm] = useState({
        gameMode: 'online',
        playerType: 'students',
        maxLUsPerTeam: 3,
        budgets: { ...BUDGET_DEFAULTS },
        regionMapTimer: DEFAULT_REGION_MAP_TIMER,
        yearTimers: { ...DEFAULT_YEAR_TIMERS },
    });

    const setField = (key, value) => setForm(f => ({ ...f, [key]: value }));

    const updateBudget = (type, value) =>
        setForm(f => ({ ...f, budgets: { ...f.budgets, [type]: Number(value) } }));

    const updateYearTimer = (year, value) =>
        setForm(f => ({
            ...f,
            yearTimers: {
                ...f.yearTimers,
                [year]: Math.max(1, Math.min(120, Number(value))),
            },
        }));

    const resetTimersToDefault = () =>
        setForm(f => ({
            ...f,
            regionMapTimer: DEFAULT_REGION_MAP_TIMER,
            yearTimers: { ...DEFAULT_YEAR_TIMERS },
        }));

    const handleCreate = async () => {
        setError('');
        setLoading(true);
        try {
            const payload = {
                gameMode: form.gameMode,
                playerType: form.playerType,
                maxLUsPerTeam: form.maxLUsPerTeam,
                budget: form.budgets[form.playerType],
                budgets: form.budgets,
                // Карта региона - одно время, не привязано к году
                regionMapTimer: form.regionMapTimer,
                // НИР + События + Полевые + Результаты - одно время на год
                yearTimers: form.yearTimers,
            };
            const result = await createSession(payload);
            setCreatedSession(result);
            setStep('created');
        } catch (e) {
            setError(e.message || 'Ошибка создания сессии');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setStep('form');
        setCreatedSession(null);
        setError('');
        setTimersExpanded(false);
    };

    // ── Экран результата ──────────────────────────────────────────────────
    if (step === 'created') {
        return (
            <div className="create-session-result">
                <div className="session-created-icon">✅</div>
                <h2>Сессия создана!</h2>
                <div className="session-code-display">
                    <div className="session-code-label">Код сессии</div>
                    <div className="session-code-big">{createdSession.sessionCode}</div>
                    <button
                        className="copy-btn"
                        onClick={() => navigator.clipboard.writeText(createdSession.sessionCode)}
                    >
                        📋 Копировать
                    </button>
                </div>
                <div className="session-summary">
                    <div className="summary-row">
                        <span>Режим</span>
                        <strong>{form.gameMode === 'online' ? '🌐 Онлайн' : '👤 Одиночная'}</strong>
                    </div>
                    <div className="summary-row">
                        <span>Игроки</span>
                        <strong>{form.playerType === 'students' ? '🎓 Студенты' : '💼 Профессионалы'}</strong>
                    </div>
                    <div className="summary-row">
                        <span>Бюджет</span>
                        <strong>{form.budgets[form.playerType].toLocaleString('ru-RU')} млн ₽</strong>
                    </div>
                    <div className="summary-row">
                        <span>Макс. ЛУ на команду</span>
                        <strong>{form.maxLUsPerTeam}</strong>
                    </div>
                    <div className="summary-row">
                        <span>Карта региона</span>
                        <strong>{form.regionMapTimer} мин</strong>
                    </div>
                </div>
                <p className="session-hint-text">
                    Покажите код командам - они вводят его на стартовом экране игры.
                </p>
                <div className="result-actions">
                    <button className="btn-secondary" onClick={handleReset}>＋ Создать ещё</button>
                </div>
            </div>
        );
    }

    // ── Форма ─────────────────────────────────────────────────────────────
    return (
        <div className="create-session-form">
            <h2>Создать новую сессию</h2>

            {/* Режим */}
            <div className="form-section">
                <div className="form-section-title">Режим игры</div>
                <div className="toggle-group">
                    <button
                        className={`toggle-btn ${form.gameMode === 'online' ? 'active' : ''}`}
                        onClick={() => setField('gameMode', 'online')}
                    >
                        <span>🌐</span>
                        <div><strong>Онлайн</strong><small>Несколько команд одновременно</small></div>
                    </button>
                    <button
                        className={`toggle-btn ${form.gameMode === 'solo' ? 'active' : ''}`}
                        onClick={() => setField('gameMode', 'solo')}
                    >
                        <span>👤</span>
                        <div><strong>Одиночная</strong><small>Одна команда</small></div>
                    </button>
                </div>
            </div>

            {/* Тип игроков */}
            <div className="form-section">
                <div className="form-section-title">Тип игроков</div>
                <div className="toggle-group">
                    <button
                        className={`toggle-btn ${form.playerType === 'students' ? 'active' : ''}`}
                        onClick={() => setField('playerType', 'students')}
                    >
                        <span>🎓</span>
                        <div><strong>Студенты</strong></div>
                    </button>
                    <button
                        className={`toggle-btn ${form.playerType === 'professionals' ? 'active' : ''}`}
                        onClick={() => setField('playerType', 'professionals')}
                    >
                        <span>💼</span>
                        <div><strong>Профессионалы</strong></div>
                    </button>
                </div>
            </div>

            {/* Бюджеты */}
            <div className="form-section">
                <div className="form-section-title">Бюджеты (млн ₽)</div>
                <div className="timers-grid">
                    <label className="timer-field">
                        <span>🎓 Студенты</span>
                        <input
                            type="number"
                            min={1}
                            value={form.budgets.students}
                            onChange={e => updateBudget('students', e.target.value)}
                        />
                        <span>млн ₽</span>
                    </label>
                    <label className="timer-field">
                        <span>💼 Профессионалы</span>
                        <input
                            type="number"
                            min={1}
                            value={form.budgets.professionals}
                            onChange={e => updateBudget('professionals', e.target.value)}
                        />
                        <span>млн ₽</span>
                    </label>
                </div>
            </div>

            {/* Макс. ЛУ */}
            <div className="form-section">
                <div className="form-section-title">Настройка ЛУ</div>
                <label className="timer-field">
                    <span>Макс. ЛУ на команду</span>
                    <input
                        type="number"
                        min={3}
                        max={5}
                        value={form.maxLUsPerTeam}
                        onChange={e => setField('maxLUsPerTeam', Math.max(3, Math.min(5, Number(e.target.value))))}
                    />
                    <span className="field-range-hint">(3–5)</span>
                </label>
            </div>

            {/* Таймеры */}
            <div className="form-section">
                <div className="form-section-title-row">
                    <span className="form-section-title">Таймеры</span>
                    <button className="btn-ghost-small" onClick={resetTimersToDefault}>
                        ↺ Сбросить к умолчаниям
                    </button>
                </div>

                {/* Карта региона - отдельно */}
                <div className="timer-block-standalone">
                    <div className="timer-block-label">
                        <span className="timer-block-icon">🗺️</span>
                        <div>
                            <div className="timer-block-name">Карта региона</div>
                            <div className="timer-block-hint">Одно время - не зависит от года</div>
                        </div>
                    </div>
                    <label className="timer-field timer-field-inline">
                        <input
                            type="number"
                            min={1}
                            max={120}
                            value={form.regionMapTimer}
                            onChange={e => setField('regionMapTimer', Math.max(1, Math.min(120, Number(e.target.value))))}
                        />
                        <span>мин</span>
                    </label>
                </div>

                {/* Разделитель */}
                <div className="timer-section-divider">
                    <span>НИР · События · Полевые работы · Результаты</span>
                    <span className="timer-section-divider-hint">одно общее время на каждый год</span>
                </div>

                {/* Годовые таймеры - компактная сетка */}
                <button
                    className="years-toggle-btn"
                    onClick={() => setTimersExpanded(v => !v)}
                >
                    <span>{timersExpanded ? '▲ Свернуть' : '▼ Развернуть все годы'}</span>
                    <span className="years-toggle-summary">
                        {YEARS.map(y => (
                            <span key={y} className="year-mini-chip">
                                {y}: {form.yearTimers[y]}м
                            </span>
                        ))}
                    </span>
                </button>

                {timersExpanded && (
                    <div className="year-timers-grid">
                        {YEARS.map(year => (
                            <div key={year} className="year-timer-cell">
                                <div className="year-timer-label">{YEAR_LABEL(year)}</div>
                                <label className="timer-field">
                                    <input
                                        type="number"
                                        min={1}
                                        max={120}
                                        value={form.yearTimers[year]}
                                        onChange={e => updateYearTimer(year, e.target.value)}
                                    />
                                    <span>мин</span>
                                </label>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {error && <div className="form-error">{error}</div>}

            <button
                className="create-session-btn"
                onClick={handleCreate}
                disabled={loading}
            >
                {loading ? 'Создание...' : '🚀 Создать сессию'}
            </button>
        </div>
    );
};

// ─── AdminPanel ───────────────────────────────────────────────────────────────

const AdminPanel = () => {
    const [activeTab, setActiveTab] = useState('create');
    const [stats, setStats] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filters] = useState({});

    const loadDashboard = async () => {
        setLoading(true);
        try { setStats(await getAdminStats()); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const loadSessions = async () => {
        setLoading(true);
        try { setSessions(await getAdminSessions(filters)); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const loadTeams = async () => {
        setLoading(true);
        try { setTeams(await getAdminTeams(filters)); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleDeleteSession = async (sessionId) => {
        if (!window.confirm('Удалить сессию? Это действие необратимо.')) return;
        try { await deleteSession(sessionId); loadSessions(); }
        catch (e) { alert('Ошибка удаления'); }
    };

    const handleResetTeam = async (teamId) => {
        if (!window.confirm('Сбросить прогресс команды?')) return;
        try { await resetTeam(teamId); loadTeams(); }
        catch (e) { alert('Ошибка сброса'); }
    };

    const handleExport = async (type, format) => {
        try {
            const blob = await exportData(type, format);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}_${Date.now()}.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) { alert('Ошибка экспорта'); }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'sessions') loadSessions();
        if (tab === 'teams') loadTeams();
        if (tab === 'dashboard') loadDashboard();
    };

    const TABS = [
        { id: 'create', label: '＋ Создать сессию' },
        { id: 'dashboard', label: '📊 Дашборд' },
        { id: 'sessions', label: '🎮 Сессии' },
        { id: 'teams', label: '👥 Команды' },
    ];

    return (
        <div className="admin-panel">
            <header className="admin-header">
                <h1>⚙️ Админ-панель · Курс на карбонаты</h1>
                <button className="logout-btn" onClick={() => localStorage.removeItem('auth_token')}>
                    Выйти
                </button>
            </header>

            <nav className="admin-nav">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        className={`nav-btn ${activeTab === t.id ? 'active' : ''} ${t.id === 'create' ? 'nav-btn-accent' : ''}`}
                        onClick={() => handleTabChange(t.id)}
                    >
                        {t.label}
                    </button>
                ))}
            </nav>

            <main className="admin-content">
                {loading && <div className="loading">Загрузка...</div>}

                {activeTab === 'create' && <CreateSessionTab />}

                {activeTab === 'dashboard' && stats && (
                    <div className="dashboard">
                        <h2>Общая статистика</h2>
                        <div className="stats-grid">
                            <div className="stat-card"><div className="stat-icon">🎮</div><div className="stat-value">{stats.totalSessions || 0}</div><div className="stat-label">Сессий</div></div>
                            <div className="stat-card"><div className="stat-icon">👥</div><div className="stat-value">{stats.totalTeams || 0}</div><div className="stat-label">Команд</div></div>
                            <div className="stat-card"><div className="stat-icon">🏆</div><div className="stat-value">{stats.averageScore || 0}</div><div className="stat-label">Средний счёт</div></div>
                            <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-value">{stats.completionRate || 0}%</div><div className="stat-label">Завершённость</div></div>
                        </div>
                        <div className="export-section">
                            <h3>Экспорт данных</h3>
                            <button onClick={() => handleExport('sessions', 'csv')}>📥 Сессии (CSV)</button>
                            <button onClick={() => handleExport('teams', 'csv')}>📥 Команды (CSV)</button>
                            <button onClick={() => handleExport('stats', 'json')}>📥 Статистика (JSON)</button>
                        </div>
                    </div>
                )}

                {activeTab === 'sessions' && (
                    <div className="sessions">
                        <h2>Управление сессиями</h2>
                        <table className="data-table">
                            <thead>
                                <tr><th>ID</th><th>Код</th><th>Статус</th><th>Команды</th><th>Создана</th><th>Действия</th></tr>
                            </thead>
                            <tbody>
                                {sessions.map(s => (
                                    <tr key={s.sessionId}>
                                        <td>{s.sessionId}</td>
                                        <td><strong className="session-code-cell">{s.sessionCode}</strong></td>
                                        <td><span className={`status-badge ${s.status}`}>{s.status}</span></td>
                                        <td>{s.teams?.length || 0}</td>
                                        <td>{new Date(s.createdAt).toLocaleString('ru-RU')}</td>
                                        <td>
                                            <button className="action-btn view" onClick={() => window.open(`/admin/sessions/${s.sessionId}`, '_blank')}>👁️</button>
                                            <button className="action-btn delete" onClick={() => handleDeleteSession(s.sessionId)}>🗑️</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'teams' && (
                    <div className="teams">
                        <h2>Управление командами</h2>
                        <table className="data-table">
                            <thead>
                                <tr><th>ID</th><th>Название</th><th>Опыт</th><th>Участники</th><th>Сессия</th><th>Создана</th><th>Действия</th></tr>
                            </thead>
                            <tbody>
                                {teams.map(t => (
                                    <tr key={t.teamId}>
                                        <td>{t.teamId}</td>
                                        <td><strong>{t.name}</strong></td>
                                        <td>{t.experienceLevel === 'student' ? '🎓' : '💼'}</td>
                                        <td>{t.members?.length || 0}</td>
                                        <td>{t.sessionCode || '-'}</td>
                                        <td>{new Date(t.createdAt).toLocaleString('ru-RU')}</td>
                                        <td>
                                            <button className="action-btn view" onClick={() => window.open(`/admin/teams/${t.teamId}`, '_blank')}>👁️</button>
                                            <button className="action-btn reset" onClick={() => handleResetTeam(t.teamId)}>🔄</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminPanel;