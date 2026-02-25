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
} from './apiHelpers';
import './AdminPanel.css';

const AdminPanel = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [stats, setStats] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [teams, setTeams] = useState([]);
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({});

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        setLoading(true);
        try {
            const statsData = await getAdminStats();
            setStats(statsData);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSessions = async () => {
        setLoading(true);
        try {
            const sessionsData = await getAdminSessions(filters);
            setSessions(sessionsData);
        } catch (error) {
            console.error('Failed to load sessions:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadTeams = async () => {
        setLoading(true);
        try {
            const teamsData = await getAdminTeams(filters);
            setTeams(teamsData);
        } catch (error) {
            console.error('Failed to load teams:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadConfig = async () => {
        setLoading(true);
        try {
            const configData = await getGameConfig();
            setConfig(configData);
        } catch (error) {
            console.error('Failed to load config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleConfigUpdate = async (updatedConfig) => {
        setLoading(true);
        try {
            await updateGameConfig(updatedConfig);
            setConfig(updatedConfig);
            alert('Конфигурация успешно обновлена!');
        } catch (error) {
            console.error('Failed to update config:', error);
            alert('Ошибка обновления конфигурации');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSession = async (sessionId) => {
        if (!window.confirm('Вы уверены? Это действие необратимо.')) return;

        try {
            await deleteSession(sessionId);
            loadSessions();
            alert('Сессия удалена');
        } catch (error) {
            console.error('Failed to delete session:', error);
            alert('Ошибка удаления');
        }
    };

    const handleResetTeam = async (teamId) => {
        if (!window.confirm('Сбросить данные команды? Прогресс будет утерян.')) return;

        try {
            await resetTeam(teamId);
            loadTeams();
            alert('Команда сброшена');
        } catch (error) {
            console.error('Failed to reset team:', error);
            alert('Ошибка сброса');
        }
    };

    const handleExport = async (type, format) => {
        try {
            const blob = await exportData(type, format);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}_export_${Date.now()}.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export:', error);
            alert('Ошибка экспорта');
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'sessions') loadSessions();
        if (tab === 'teams') loadTeams();
        if (tab === 'config') loadConfig();
        if (tab === 'dashboard') loadDashboard();
    };

    return (
        <div className="admin-panel">
            <header className="admin-header">
                <h1>⚙️ Админ-панель | Геологоразведочная игра</h1>
                <button className="logout-btn" onClick={() => localStorage.removeItem('auth_token')}>
                    Выйти
                </button>
            </header>

            <nav className="admin-nav">
                <button
                    className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => handleTabChange('dashboard')}
                >
                    📊 Дашборд
                </button>
                <button
                    className={`nav-btn ${activeTab === 'sessions' ? 'active' : ''}`}
                    onClick={() => handleTabChange('sessions')}
                >
                    🎮 Сессии
                </button>
                <button
                    className={`nav-btn ${activeTab === 'teams' ? 'active' : ''}`}
                    onClick={() => handleTabChange('teams')}
                >
                    👥 Команды
                </button>
                <button
                    className={`nav-btn ${activeTab === 'config' ? 'active' : ''}`}
                    onClick={() => handleTabChange('config')}
                >
                    ⚙️ Конфигурация
                </button>
            </nav>

            <main className="admin-content">
                {loading && <div className="loading">Загрузка...</div>}

                {activeTab === 'dashboard' && stats && (
                    <div className="dashboard">
                        <h2>Общая статистика</h2>
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon">🎮</div>
                                <div className="stat-value">{stats.totalSessions || 0}</div>
                                <div className="stat-label">Всего сессий</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">👥</div>
                                <div className="stat-value">{stats.totalTeams || 0}</div>
                                <div className="stat-label">Всего команд</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">🏆</div>
                                <div className="stat-value">{stats.averageScore || 0}</div>
                                <div className="stat-label">Средний счёт</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">✅</div>
                                <div className="stat-value">{stats.completionRate || 0}%</div>
                                <div className="stat-label">Завершённость</div>
                            </div>
                        </div>

                        <div className="export-section">
                            <h3>Экспорт данных</h3>
                            <button onClick={() => handleExport('sessions', 'csv')}>
                                📥 Сессии (CSV)
                            </button>
                            <button onClick={() => handleExport('teams', 'csv')}>
                                📥 Команды (CSV)
                            </button>
                            <button onClick={() => handleExport('stats', 'json')}>
                                📥 Статистика (JSON)
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'sessions' && (
                    <div className="sessions">
                        <h2>Управление сессиями</h2>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Код</th>
                                    <th>Статус</th>
                                    <th>Команды</th>
                                    <th>Создана</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map(session => (
                                    <tr key={session.sessionId}>
                                        <td>{session.sessionId}</td>
                                        <td><strong>{session.sessionCode}</strong></td>
                                        <td>
                                            <span className={`status-badge ${session.status}`}>
                                                {session.status}
                                            </span>
                                        </td>
                                        <td>{session.teams?.length || 0}</td>
                                        <td>{new Date(session.createdAt).toLocaleString('ru-RU')}</td>
                                        <td>
                                            <button
                                                className="action-btn view"
                                                onClick={() => window.open(`/admin/sessions/${session.sessionId}`, '_blank')}
                                            >
                                                👁️ Просмотр
                                            </button>
                                            <button
                                                className="action-btn delete"
                                                onClick={() => handleDeleteSession(session.sessionId)}
                                            >
                                                🗑️ Удалить
                                            </button>
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
                                <tr>
                                    <th>ID</th>
                                    <th>Название</th>
                                    <th>Опыт</th>
                                    <th>Участники</th>
                                    <th>Сессия</th>
                                    <th>Создана</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {teams.map(team => (
                                    <tr key={team.teamId}>
                                        <td>{team.teamId}</td>
                                        <td><strong>{team.name}</strong></td>
                                        <td>{team.experienceLevel === 'student' ? '🎓 Студенты' : '💼 Профи'}</td>
                                        <td>{team.members?.length || 0}</td>
                                        <td>{team.sessionCode || '—'}</td>
                                        <td>{new Date(team.createdAt).toLocaleString('ru-RU')}</td>
                                        <td>
                                            <button
                                                className="action-btn view"
                                                onClick={() => window.open(`/admin/teams/${team.teamId}`, '_blank')}
                                            >
                                                👁️ Просмотр
                                            </button>
                                            <button
                                                className="action-btn reset"
                                                onClick={() => handleResetTeam(team.teamId)}
                                            >
                                                🔄 Сбросить
                                            </button>
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

const ConfigEditor = ({ config, onSave }) => {
    const [editedConfig, setEditedConfig] = useState(config);

    const handleChange = (section, key, value) => {
        setEditedConfig(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: parseFloat(value) || value,
            },
        }));
    };

    return (
        <div className="config-editor">
            <div className="config-section">
                <h3>💰 Бюджеты</h3>
                <label>
                    Студенты:
                    <input
                        type="number"
                        value={editedConfig.budgets?.student || 0}
                        onChange={(e) => handleChange('budgets', 'student', e.target.value)}
                    />
                    млн ₽
                </label>
                <label>
                    Профессионалы:
                    <input
                        type="number"
                        value={editedConfig.budgets?.professional || 0}
                        onChange={(e) => handleChange('budgets', 'professional', e.target.value)}
                    />
                    млн ₽
                </label>
            </div>

            <div className="config-section">
                <h3>🏗️ Стоимость ЛУ</h3>
                <label>
                    Базовая цена:
                    <input
                        type="number"
                        value={editedConfig.luCosts?.base || 0}
                        onChange={(e) => handleChange('luCosts', 'base', e.target.value)}
                    />
                    млн ₽
                </label>
            </div>

            <div className="config-section">
                <h3>🔬 Стоимость НИР</h3>
                <label>
                    Мобилизация:
                    <input
                        type="number"
                        value={editedConfig.researchCosts?.mobilization || 0}
                        onChange={(e) => handleChange('researchCosts', 'mobilization', e.target.value)}
                    />
                    млн ₽
                </label>
            </div>

            <button className="save-config-btn" onClick={() => onSave(editedConfig)}>
                💾 Сохранить изменения
            </button>
        </div>
    );
};

export default AdminPanel;