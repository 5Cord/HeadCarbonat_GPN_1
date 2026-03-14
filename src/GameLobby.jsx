import React, { useState } from 'react';
import useGameStore from '../store/gameStore';
import { getSessionByCode, joinSession } from './apiHelpers';
import './GameLobby.css';

const ROLES = [
    { value: 'Геолог',               icon: '' },
    { value: 'Геофизик',             icon: '📡' },
    { value: 'Инженер по бурению',   icon: '⚙️' },
    { value: 'Экономист',            icon: '📊' },
    { value: 'Менеджер проекта',     icon: '🗂️' },
];

// ── Шаг 1: ввод кода сессии ───────────────────────────────────────────────────

const StepCode = ({ onNext }) => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        const trimmed = code.trim().toUpperCase();
        if (trimmed.length < 4) { setError('Введите корректный код'); return; }
        setLoading(true);
        setError('');
        try {
            const session = await getSessionByCode(trimmed);
            if (!session) { setError('Сессия не найдена. Проверьте код.'); return; }
            if (session.status === 'finished') { setError('Эта сессия уже завершена.'); return; }
            onNext(trimmed, session);
        } catch (e) {
            setError('Сессия не найдена. Проверьте код.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="lobby-step">
            <div className="step-icon">🔑</div>
            <h2>Введите код сессии</h2>
            <p className="step-hint">Код выдаёт организатор перед началом игры</p>
            <div className="code-input-wrap">
                <input
                    type="text"
                    className="code-input"
                    placeholder="XXXXXX"
                    value={code}
                    onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    maxLength={8}
                    autoFocus
                />
            </div>
            {error && <div className="lobby-error">{error}</div>}
            <button
                className="lobby-btn-primary"
                onClick={handleSubmit}
                disabled={loading || code.trim().length < 4}
            >
                {loading ? 'Проверка...' : 'Войти →'}
            </button>
        </div>
    );
};

// ── Шаг 2: данные команды ─────────────────────────────────────────────────────

const StepTeam = ({ sessionCode, sessionConfig, onJoin }) => {
    const [teamName, setTeamName] = useState('');
    const [teamSize, setTeamSize] = useState(1);
    const [members, setMembers] = useState([{ name: '', role: 'Геолог' }]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSizeChange = (size) => {
        const n = Math.max(1, Math.min(5, size));
        setTeamSize(n);
        setMembers(prev => Array.from({ length: n }, (_, i) =>
            prev[i] ?? { name: '', role: 'Геолог' }
        ));
    };

    const updateMember = (idx, field, value) => {
        setMembers(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const canProceed = teamName.trim() !== '' && members.every(m => m.name.trim() !== '');

    const handleJoin = async () => {
        if (!canProceed) return;
        setLoading(true);
        setError('');
        try {
            const result = await joinSession(sessionCode, {
                teamName: teamName.trim(),
                members: members.map(m => ({ name: m.name.trim(), role: m.role })),
            });
            onJoin(result);
        } catch (e) {
            setError(e.message || 'Ошибка подключения к сессии');
        } finally {
            setLoading(false);
        }
    };

    const getRoleIcon = (roleValue) =>
        ROLES.find(r => r.value === roleValue)?.icon ?? '👤';

    return (
        <div className="team-setup-page">

            {/* ── Шапка сессии ── */}
            <div className="session-banner">
                <div className="session-banner-chip">
                    <span className="sbc-label">Сессия</span>
                    <span className="sbc-value">{sessionCode}</span>
                </div>
                <div className="session-banner-divider" />
                <div className="session-banner-chip">
                    <span className="sbc-label">Режим</span>
                    <span className="sbc-value">
                        {sessionConfig.gameMode === 'online' ? '🌐 Онлайн' : '👤 Одиночная'}
                    </span>
                </div>
                <div className="session-banner-divider" />
                <div className="session-banner-chip">
                    <span className="sbc-label">Бюджет</span>
                    <span className="sbc-value sbc-budget">
                        {sessionConfig.budget?.toLocaleString('ru-RU') ?? '—'} <span className="sbc-unit">млн ₽</span>
                    </span>
                </div>
            </div>

            {/* ── Заголовок ── */}
            <div className="team-setup-header">
                <h2>Данные команды</h2>
                <p>Заполните название и состав — это будет видно всем участникам игры</p>
            </div>

            {/* ── Название команды ── */}
            <div className="team-name-block">
                <label className="ts-label">Название команды</label>
                <div className="team-name-field-wrap">
                    <span className="team-name-prefix">🏴</span>
                    <input
                        type="text"
                        className="team-name-field"
                        placeholder="Например: Стражи Галактики"
                        value={teamName}
                        onChange={e => setTeamName(e.target.value)}
                        maxLength={50}
                    />
                    {teamName.trim() && <span className="team-name-ok">✓</span>}
                </div>
            </div>

            {/* ── Размер команды ── */}
            <div className="team-size-block">
                <label className="ts-label">Количество участников</label>
                <div className="size-pills">
                    {[1, 2, 3, 4, 5].map(n => (
                        <button
                            key={n}
                            className={`size-pill ${teamSize === n ? 'active' : ''}`}
                            onClick={() => handleSizeChange(n)}
                        >
                            {n}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Карточки участников ── */}
            <div className="members-deck">
                {members.map((m, i) => (
                    <div key={i} className={`member-tile ${m.name.trim() ? 'filled' : ''}`}>
                        <div className="member-tile-header">
                            <span className="member-avatar">{getRoleIcon(m.role)}</span>
                            <span className="member-index">Участник {i + 1}</span>
                            {m.name.trim() && <span className="member-done">✓</span>}
                        </div>
                        <input
                            type="text"
                            className="member-name-input"
                            placeholder="Имя"
                            value={m.name}
                            onChange={e => updateMember(i, 'name', e.target.value)}
                        />
                        <div className="member-role-row">
                            {ROLES.map(r => (
                                <button
                                    key={r.value}
                                    className={`role-chip ${m.role === r.value ? 'active' : ''}`}
                                    onClick={() => updateMember(i, 'role', r.value)}
                                    title={r.value}
                                >
                                    <span>{r.icon}</span>
                                    <span className="role-chip-label">{r.value}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Ошибки / предупреждения ── */}
            {error && <div className="lobby-error">{error}</div>}
            {!canProceed && teamName.trim() !== '' && (
                <div className="lobby-warn">Заполните имена всех участников</div>
            )}

            {/* ── Кнопка ── */}
            <button
                className="lobby-btn-primary"
                onClick={handleJoin}
                disabled={!canProceed || loading}
            >
                {loading ? 'Подключение...' : '🚀 Начать игру'}
            </button>
        </div>
    );
};

// ── Главный компонент ─────────────────────────────────────────────────────────

const GameLobby = () => {
    const { setTeam } = useGameStore();
    const [step, setStep] = useState('code');
    const [sessionCode, setSessionCode] = useState('');
    const [sessionConfig, setSessionConfig] = useState(null);

    const handleCodeSuccess = (code, config) => {
        setSessionCode(code);
        setSessionConfig(config);
        setStep('team');
    };

    const handleJoin = (result) => {
        setTeam({
            name: result.teamName,
            teamId: result.teamId,
            members: result.members,
            experienceLevel: result.sessionConfig?.playerType ?? 'students',
            sessionCode,
            isMultiplayer: result.sessionConfig?.gameMode === 'online',
            token: result.token,
            budget: result.sessionConfig?.budget,
        });
    };

    return (
        <div className="game-lobby">
            <header className="lobby-header">
                <h1>Курс на карбонаты</h1>
                {step === 'team' && (
                    <button className="lobby-back-btn" onClick={() => setStep('code')}>
                        ← Назад
                    </button>
                )}
            </header>

            <main className="lobby-content">
                {step === 'code' && <StepCode onNext={handleCodeSuccess} />}
                {step === 'team' && (
                    <StepTeam
                        sessionCode={sessionCode}
                        sessionConfig={sessionConfig}
                        onJoin={handleJoin}
                    />
                )}
            </main>

            <footer className="lobby-footer">
                <p>💡 Для входа в игру используйте код, выданный организатором</p>
            </footer>
        </div>
    );
};

export default GameLobby;