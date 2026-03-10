import React, { useState } from 'react';
import useGameStore from '../store/gameStore';
import { getSessionByCode, joinSession } from './apiHelpers';
import './GameLobby.css';

const ROLES = ['Геолог', 'Геофизик', 'Инженер по бурению', 'Экономист', 'Менеджер проекта'];

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

    const canProceed =
        teamName.trim() !== '' &&
        members.every(m => m.name.trim() !== '');

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

    return (
        <div className="lobby-step lobby-step-wide">
            {/* Инфо сессии */}
            <div className="session-info-bar">
                <div className="session-info-chip">
                    <span className="chip-label">Сессия</span>
                    <span className="chip-value">{sessionCode}</span>
                </div>
                <div className="session-info-chip">
                    <span className="chip-label">Режим</span>
                    <span className="chip-value">
                        {sessionConfig.gameMode === 'online' ? '🌐 Онлайн' : '👤 Одиночная'}
                    </span>
                </div>
                <div className="session-info-chip">
                    <span className="chip-label">Бюджет</span>
                    <span className="chip-value">
                        {sessionConfig.budget?.toLocaleString('ru-RU') ?? '—'} млн ₽
                    </span>
                </div>
            </div>

            <h2>Данные команды</h2>

            {/* Название */}
            <div className="field-group">
                <label className="field-label">Название команды</label>
                <input
                    type="text"
                    className="field-input"
                    placeholder="Например: Стражи Галактики"
                    value={teamName}
                    onChange={e => setTeamName(e.target.value)}
                    maxLength={50}
                />
            </div>

            {/* Размер команды */}
            <div className="field-group">
                <label className="field-label">Количество участников</label>
                <div className="size-btns">
                    {[1, 2, 3, 4, 5].map(n => (
                        <button
                            key={n}
                            className={`size-btn ${teamSize === n ? 'active' : ''}`}
                            onClick={() => handleSizeChange(n)}
                        >
                            {n}
                        </button>
                    ))}
                </div>
            </div>

            {/* Участники */}
            <div className="members-grid">
                {members.map((m, i) => (
                    <div key={i} className="member-card">
                        <div className="member-num">Участник {i + 1}</div>
                        <input
                            type="text"
                            className="field-input"
                            placeholder="Имя"
                            value={m.name}
                            onChange={e => updateMember(i, 'name', e.target.value)}
                        />
                        <select
                            className="field-select"
                            value={m.role}
                            onChange={e => updateMember(i, 'role', e.target.value)}
                        >
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                ))}
            </div>

            {error && <div className="lobby-error">{error}</div>}

            {!canProceed && teamName.trim() !== '' && (
                <div className="lobby-warn">Заполните имена всех участников</div>
            )}

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
    const [step, setStep] = useState('code');       // 'code' | 'team'
    const [sessionCode, setSessionCode] = useState('');
    const [sessionConfig, setSessionConfig] = useState(null);

    const handleCodeSuccess = (code, config) => {
        setSessionCode(code);
        setSessionConfig(config);
        setStep('team');
    };

    const handleJoin = (result) => {
        // result содержит { teamId, token, sessionConfig, ... }
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