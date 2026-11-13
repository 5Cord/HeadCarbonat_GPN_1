import React, { useState, useMemo } from 'react';
import useGameStore from '../store/gameStore';
import { getSessionByCode, joinSession, resumeSession } from './apiHelpers';
import './GameLobby.css';

const ROLES = [
    { value: 'Геолог' },
    { value: 'Геофизик' },
    { value: 'Петрофизик' },
    { value: 'Разработчик' },
    { value: 'Инженер по бурению' },
    { value: 'Экономист' },
    { value: 'Менеджер' },
    { value: 'Седиментолог' },
    { value: 'Геохимик' },
    { value: 'Другое' },
];
const MAX_TEAM_MEMBERS = 7;

// ── Шаг 1: ввод кода сессии ───────────────────────────────────────────────────

// Команда, которой заходили с этого браузера в прошлый раз.
const readSavedTeam = () => {
    try {
        const saved = JSON.parse(localStorage.getItem('last_team') || 'null');
        return saved?.name ? saved : null;
    } catch { return null; }
};

// То же, но для кнопки возврата — без токена вернуться в сессию нельзя.
const readLastTeam = () => (localStorage.getItem('auth_token') ? readSavedTeam() : null);

const normalizeMembers = (list) => {
    const arr = (Array.isArray(list) ? list : []).filter(m => m?.name);
    if (arr.length === 0) return [{ name: '', role: 'Геолог' }];
    return arr.slice(0, MAX_TEAM_MEMBERS).map(m => ({
        name: m.name,
        role: ROLES.some(r => r.value === m.role) ? m.role : 'Геолог',
    }));
};

const StepCode = ({ onNext, onResume }) => {
    const [code, setCode]       = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');
    const [lastTeam, setLastTeam] = useState(readLastTeam);
    const [resuming, setResuming] = useState(false);

    const handleResume = async () => {
        setResuming(true);
        setError('');
        try {
            onResume(await resumeSession());
        } catch {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('last_team');
            setLastTeam(null);
            setError('Не удалось вернуться в сессию — войдите по коду.');
        } finally {
            setResuming(false);
        }
    };

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
            {lastTeam && (
                <div className="lobby-resume">
                    <button className="lobby-btn-resume" onClick={handleResume} disabled={resuming}>
                        {resuming ? 'Восстановление...' : `Продолжить за команду «${lastTeam.name}»`}
                    </button>
                    <p className="step-hint">Прогресс сохранён — вернётесь к тому же состоянию игры</p>
                </div>
            )}
        </div>
    );
};

// ── Шаг 2: данные команды ─────────────────────────────────────────────────────

const StepTeam = ({ sessionCode, sessionConfig, onJoin }) => {
    // Подстановка прошлого состава: сначала этот браузер, затем — команда,
    // которую сервер опознал по IP (только если с адреса тут играет одна команда).
    const knownTeam = sessionConfig?.knownTeam;
    const prefill = useMemo(() => {
        const saved = readSavedTeam();
        const src = (saved && saved.code === sessionCode) ? saved
            : (knownTeam?.name ? knownTeam : null);
        return src ? { name: src.name, members: normalizeMembers(src.members) } : null;
    }, [sessionCode, knownTeam]);

    const [teamName, setTeamName] = useState(prefill?.name ?? '');
    const [teamSize, setTeamSize] = useState(prefill?.members.length ?? 1);
    const [members, setMembers]   = useState(prefill?.members ?? [{ name: '', role: 'Геолог' }]);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');

    const handleSizeChange = (size) => {
        const n = Math.max(1, Math.min(MAX_TEAM_MEMBERS, size));
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
                members:  members.map(m => ({ name: m.name.trim(), role: m.role })),
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
                <div className="session-banner-divider" />
                <div className="session-banner-chip">
                    <span className="sbc-label">Макс. ЛУ</span>
                    <span className="sbc-value">{sessionConfig.maxLUsPerTeam ?? 5}</span>
                </div>
            </div>

            {/* ── Заголовок ── */}
            <div className="team-setup-header">
                <h2>Данные команды</h2>
                <p>
                    {prefill
                        ? 'Название и состав подставлены из прошлого входа — проверьте и при необходимости измените'
                        : 'Заполните название и состав — это будет видно всем участникам игры'}
                </p>
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
                    {Array.from({ length: MAX_TEAM_MEMBERS }, (_, i) => i + 1).map(n => (
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
                            <span className="member-avatar">👤</span>
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
                                    <span className="role-chip-label">{r.value}</span>
                                </button>
                            ))}
                        </div>
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
                {loading ? 'Подключение...' : 'Начать игру'}
            </button>
        </div>
    );
};

// ── Главный компонент ─────────────────────────────────────────────────────────

const GameLobby = () => {
    const { setTeam, setSessionConfig } = useGameStore();
    const [step, setStep]               = useState('code');
    const [sessionCode, setSessionCode] = useState('');
    const [sessionConfig, setLocalSessionConfig] = useState(null);

    const handleCodeSuccess = (code, config) => {
        setSessionCode(code);
        setLocalSessionConfig(config);
        setStep('team');
    };

    const TOUR_KEYS = [
        'regionMap_tourDone',
        'researchPanel_tourDone',
        'refusalMap_tourDone',
        'fieldWorkPanel_tourDone',
        'resultsPanel_tourDone',
        'eventsZone_tourDone',
    ];

    const handleJoin = (result) => {
        const prevSessionId = useGameStore.getState().player.sessionId;
        const newSessionId  = result.sessionConfig?.sessionId;

        if (result.rejoin) {
            // Переподключение к той же сессии: сбрасываем game-данные чтобы
            // onFullState восстановил их свежими из БД
            useGameStore.setState(s => ({
                fieldWork: { ...s.fieldWork, selectionsByLU: {} },
                research:  { ...s.research,  progressByLU:   {} },
                events:    { ...s.events,    lineScores: {}, historyByYear: {}, linesByLU: {} },
                results:   { ...s.results,   cardsByLU: {} },
            }));
        } else if (prevSessionId !== newSessionId) {
            // Вход в новую сессию — полный сброс состояния и туторов
            useGameStore.setState(s => ({ game: { ...s.game, status: 'IN_PROGRESS' } }));
            TOUR_KEYS.forEach(k => localStorage.removeItem(k));
        }

        // 1. Сохраняем данные команды.
        // При возврате по токену код сессии приходит с сервера — локального ещё нет.
        const code = result.sessionCode ?? sessionCode;
        setTeam({
            name:             result.teamName,
            teamId:           result.teamId,
            members:          result.members,
            experienceLevel:  result.sessionConfig?.playerType ?? 'students',
            sessionCode:      code,
            isMultiplayer:    result.sessionConfig?.gameMode === 'online',
            token:            result.token,
            sessionId:        result.sessionConfig?.sessionId,
            budget:           result.sessionConfig?.budget,
        });

        // ── 2. Сохраняем конфиг сессии — таймеры, лимит ЛУ и т.д. ──────────
        // Без этого RegionMap будет использовать хардкод вместо настроек из админки
        if (result.sessionConfig) {
            setSessionConfig(result.sessionConfig);
        }

        // 3. Токен для REST-запросов + метка команды для кнопки «Продолжить» в лобби
        localStorage.setItem('auth_token', result.token);
        localStorage.setItem('last_team', JSON.stringify({
            name: result.teamName,
            members: result.members || [],
            code,
        }));
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
                {step === 'code' && <StepCode onNext={handleCodeSuccess} onResume={handleJoin} />}
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
