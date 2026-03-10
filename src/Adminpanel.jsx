import React, { useState, useEffect } from 'react';
import {
    getAdminSessions,
    getAdminTeams,
    getAdminStats,
    getGameConfig,
    updateGameConfig,
    deleteSession,
    resetTeam,
    exportData,
    createSession,
} from './apiHelpers';
import './AdminPanel.css';


const DEFAULT_TIMERS = {
    selection: 20,
    research: 10,
    events: 15,
    fieldWork: 15,
};

const BUDGET_DEFAULTS = { students: 99999999, professionals: 99999999 };


const CreateSessionTab = () => {
    const [step, setStep] = useState('form');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [createdSession, setCreatedSession] = useState(null);

    const [form, setForm] = useState({
        gameMode: 'online',
        playerType: 'students',
        teamsCount: 2,
        timers: { ...DEFAULT_TIMERS },
        maxLUsPerTeam: 3,
    });

    const setField = (key, value) => setForm(f => ({ ...f, [key]: value }));

    const handlePlayerTypeChange = (type) => {
        setForm(f => ({ ...f, playerType: type }));
    };

    const updateTimer = (key, value) => {
        setForm(f => ({ ...f, timers: { ...f.timers, [key]: Number(value) } }));
    };

    const handleCreate = async () => {
        setError('');
        setLoading(true);
        try {
            const result = await createSession(form);
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
    };

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
                    {form.gameMode === 'online' && (
                        <div className="summary-row">
                            <span>Команд</span>
                            <strong>{form.teamsCount}</strong>
                        </div>
                    )}
                    <div className="summary-row">
                        <span>Бюджет</span>
                        <strong>{BUDGET_DEFAULTS[form.playerType].toLocaleString('ru-RU')} млн ₽</strong>
                    </div>
                    <div className="summary-row">
                        <span>Макс. ЛУ на команду</span>
                        <strong>{form.maxLUsPerTeam}</strong>
                    </div>
                </div>

                <p className="session-hint-text">
                    Покажите код командам — они вводят его на стартовом экране игры.
                </p>

                <div className="result-actions">
                    <button className="btn-secondary" onClick={handleReset}>
                        ＋ Создать ещё
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="create-session-form">
            <h2>Создать новую сессию</h2>

            <div className="form-section">
                <div className="form-section-title">Режим игры</div>
                <div className="toggle-group">
                    <button
                        className={`toggle-btn ${form.gameMode === 'online' ? 'active' : ''}`}
                        onClick={() => setField('gameMode', 'online')}
                    >
                        <span>🌐</span>
                        <div>
                            <strong>Онлайн</strong>
                            <small>Несколько команд одновременно</small>
                        </div>
                    </button>
                    <button
                        className={`toggle-btn ${form.gameMode === 'solo' ? 'active' : ''}`}
                        onClick={() => setField('gameMode', 'solo')}
                    >
                        <span>👤</span>
                        <div>
                            <strong>Одиночная</strong>
                            <small>Одна команда</small>
                        </div>
                    </button>
                </div>
            </div>

            <div className="form-section">
                <div className="form-section-title">Тип игроков</div>
                <div className="toggle-group">
                    <button
                        className={`toggle-btn ${form.playerType === 'students' ? 'active' : ''}`}
                        onClick={() => handlePlayerTypeChange('students')}
                    >
                        <span>🎓</span>
                        <div>
                            <strong>Студенты</strong>
                            <small>Бюджет {BUDGET_DEFAULTS.students.toLocaleString('ru-RU')} млн ₽</small>
                        </div>
                    </button>
                    <button
                        className={`toggle-btn ${form.playerType === 'professionals' ? 'active' : ''}`}
                        onClick={() => handlePlayerTypeChange('professionals')}
                    >
                        <span>💼</span>
                        <div>
                            <strong>Профессионалы</strong>
                            <small>Бюджет {BUDGET_DEFAULTS.professionals.toLocaleString('ru-RU')} млн ₽</small>
                        </div>
                    </button>
                </div>
            </div>

            {form.gameMode === 'online' && (
                <div className="form-section">
                    <div className="form-section-title">
                        Количество команд
                        <div className="teams-count-ctrl">
                            <button onClick={() => setField('teamsCount', Math.max(1, form.teamsCount - 1))}>−</button>
                            <span>{form.teamsCount}</span>
                            <button onClick={() => setField('teamsCount', Math.min(8, form.teamsCount + 1))}>+</button>
                        </div>
                    </div>
                    <p className="form-hint">Команды сами вводят название и состав при входе в игру</p>
                </div>
            )}

            <div className="form-section">
                <div className="form-section-title">Таймеры фаз (минуты)</div>
                <div className="timers-grid">
                    {[
                        { key: 'selection', label: 'Выбор участков' },
                        { key: 'research', label: 'НИР' },
                        { key: 'events', label: 'События' },
                        { key: 'fieldWork', label: 'Полевые работы' },
                    ].map(({ key, label }) => (
                        <label key={key} className="timer-field">
                            <span>{label}</span>
                            <input
                                type="number"
                                min={1}
                                max={120}
                                value={form.timers[key]}
                                onChange={e => updateTimer(key, e.target.value)}
                            />
                            <span>мин</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="form-section">
                <div className="form-section-title">Дополнительно</div>
                <label className="timer-field">
                    <span>Макс. ЛУ на команду</span>
                    <input
                        type="number"
                        min={1}
                        max={5}
                        value={form.maxLUsPerTeam}
                        onChange={e => setField('maxLUsPerTeam', Math.max(1, Math.min(5, Number(e.target.value))))}
                    />
                    <span className="field-range-hint">(1–5)</span>
                </label>
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


const ConfigEditor = ({ config, onSave }) => {
    const [editedConfig, setEditedConfig] = useState(config);

    const handleChange = (section, key, value) => {
        setEditedConfig(prev => ({
            ...prev,
            [section]: { ...prev[section], [key]: parseFloat(value) || value },
        }));
    };

    return (
        <div className="config-editor">
            <div className="config-section">
                <h3>💰 Бюджеты</h3>
                <label>
                    Студенты:
                    <input type="number" value={editedConfig.budgets?.student || 0}
                        onChange={e => handleChange('budgets', 'student', e.target.value)} />
                    млн ₽
                </label>
                <label>
                    Профессионалы:
                    <input type="number" value={editedConfig.budgets?.professional || 0}
                        onChange={e => handleChange('budgets', 'professional', e.target.value)} />
                    млн ₽
                </label>
            </div>
            <button className="save-config-btn" onClick={() => onSave(editedConfig)}>
                💾 Сохранить изменения
            </button>
        </div>
    );
};


const AdminPanel = () => {
    const [activeTab, setActiveTab] = useState('create');
    const [stats, setStats] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [teams, setTeams] = useState([]);
    const [config, setConfig] = useState(null);
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

    const loadConfig = async () => {
        setLoading(true);
        try { setConfig(await getGameConfig()); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleConfigUpdate = async (updated) => {
        setLoading(true);
        try {
            await updateGameConfig(updated);
            setConfig(updated);
            alert('Конфигурация обновлена!');
        } catch (e) {
            alert('Ошибка обновления конфигурации');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSession = async (sessionId) => {
        if (!window.confirm('Удалить сессию? Это действие необратимо.')) return;
        try {
            await deleteSession(sessionId);
            loadSessions();
        } catch (e) { alert('Ошибка удаления'); }
    };

    const handleResetTeam = async (teamId) => {
        if (!window.confirm('Сбросить прогресс команды?')) return;
        try {
            await resetTeam(teamId);
            loadTeams();
        } catch (e) { alert('Ошибка сброса'); }
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
        if (tab === 'config') loadConfig();
        if (tab === 'dashboard') loadDashboard();
    };

    const TABS = [
        { id: 'create', label: '＋ Создать сессию' },
        { id: 'dashboard', label: '📊 Дашборд' },
        { id: 'sessions', label: '🎮 Сессии' },
        { id: 'teams', label: '👥 Команды' },
        { id: 'config', label: '⚙️ Конфиг' },
    ];

    return (
        <div className="admin-panel">
            <header className="admin-header">
                <h1>⚙️ Админ-панель · Геологоразведочная игра</h1>
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
                                        <td>{t.sessionCode || '—'}</td>
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

                {activeTab === 'config' && config && (
                    <div className="config">
                        <h2>Конфигурация игры</h2>
                        <ConfigEditor config={config} onSave={handleConfigUpdate} />
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminPanel;