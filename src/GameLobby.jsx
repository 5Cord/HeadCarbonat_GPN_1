import React, { useState, useMemo } from 'react';
import useGameStore from '../store/gameStore';
import { getSessionByCode, joinSession, recoverSession, resumeSession } from './apiHelpers';
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
    const [recoveryMode, setRecoveryMode] = useState(false);
    const [recoveryCode, setRecoveryCode] = useState('');

    const handleResume = async () => {
        setResuming(true);
        setError('');
        try {
            onResume(await resumeSession());
        } catch (error) {
            if (error.message === 'TEAM_REMOVED') {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('last_team');
                setLastTeam(null);
                setError('Команда исключена администратором из этой сессии.');
            } else if (['Team not found', 'Session not found', 'Session already finished'].includes(error.message)) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('last_team');
                setLastTeam(null);
                setError('Доступ с этого устройства больше не действует. Запросите код восстановления у администратора.');
            } else {
                setError('Не удалось связаться с сервером. Повторите попытку — данные входа сохранены.');
            }
        } finally {
            setResuming(false);
        }
    };

    const handleSubmit = async () => {
        const trimmed = code.trim().toUpperCase();
        if (trimmed.length < 4) { setError('Введите код сессии.'); return; }
        if (recoveryMode && recoveryCode.trim().length !== 10) {
            setError('Введите 10-символьный код восстановления.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            if (recoveryMode) {
                onResume(await recoverSession(trimmed, recoveryCode.trim()));
                return;
            }
            const session = await getSessionByCode(trimmed);
            if (!session) { setError('Сессия не найдена. Проверьте код.'); return; }
            if (session.status === 'finished') { setError('Эта сессия уже завершена.'); return; }
            if (session.status !== 'waiting') {
                setError('Сессия уже началась. Новые команды не подключаются. Вернитесь с прежнего устройства или используйте код восстановления от администратора.');
                return;
            }
            onNext(trimmed, session);
        } catch {
            setError(recoveryMode ? 'Код восстановления неверен или срок его действия истёк.' : 'Сессия не найдена. Проверьте код.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="lobby-step">
            <div className="step-icon">🔑</div>
            <h2>{recoveryMode ? 'Возврат в текущую сессию' : 'Вход в новую сессию'}</h2>
            <p className="step-hint">
                {recoveryMode
                    ? (lastTeam
                        ? 'Продолжите на прежнем устройстве или войдите с другого по коду организатора.'
                        : 'Введите код сессии и одноразовый код, который выдал организатор.')
                    : 'Введите код сессии, который выдал организатор.'}
            </p>
            {lastTeam && recoveryMode && (
                <div className="lobby-resume">
                    <p className="lobby-resume-label">На этом устройстве</p>
                    <button type="button" className="lobby-btn-resume" onClick={handleResume} disabled={resuming}>
                        {resuming ? 'Подключение...' : `Продолжить за команду «${lastTeam.name}»`}
                    </button>
                </div>
            )}
            <div className="code-input-wrap">
                <label className="lobby-input-label" htmlFor="lobby-session-code">Код сессии</label>
                <input
                    id="lobby-session-code"
                    type="text"
                    className="code-input"
                    placeholder="Код сессии"
                    value={code}
                    onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    maxLength={8}
                    autoFocus
                />
            </div>
            {recoveryMode && (
                <div className="code-input-wrap">
                    <label className="lobby-input-label" htmlFor="lobby-recovery-code">Одноразовый код восстановления</label>
                    <input id="lobby-recovery-code" type="text" className="code-input code-input-recovery" placeholder="Запросите у организаторов"
                        value={recoveryCode} maxLength={10} autoComplete="off"
                        onChange={e => { setRecoveryCode(e.target.value.toUpperCase()); setError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
                    <p className="lobby-input-help">Попросите организатора выдать код для вашей команды. Он действует 15 минут.</p>
                </div>
            )}
            {error && <div className="lobby-error">{error}</div>}
            <button
                className="lobby-btn-primary"
                onClick={handleSubmit}
                disabled={loading || code.trim().length < 4 || (recoveryMode && recoveryCode.trim().length !== 10)}
            >
                {loading ? 'Проверка...' : recoveryMode ? 'Вернуться в игру' : 'Продолжить →'}
            </button>
            <button type="button" className="lobby-mode-switch"
                onClick={() => { setRecoveryMode(mode => !mode); setError(''); }}>
                {recoveryMode ? 'Войти в новую сессию' : 'Вернуться в текущую сессию'}
            </button>
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
            setError(e.message === 'SESSION_ALREADY_STARTED'
                ? 'Сессия уже началась: новые команды подключиться не могут.'
                : e.message === 'TEAM_REMOVED'
                    ? 'Команда исключена администратором из этой сессии.'
                : e.message === 'TEAM_RECOVERY_REQUIRED'
                    ? 'Эта команда уже зарегистрирована. На прежнем устройстве используйте «Продолжить», на новом — код восстановления от администратора.'
                    : e.message || 'Ошибка подключения к сессии');
        } finally {
            setLoading(false);
        }
    };

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
        const prevTeamId = useGameStore.getState().player.teamId;
        const newSessionId  = result.sessionConfig?.sessionId;
        const savedTeamId = readSavedTeam()?.teamId;
        const sameLocalTeam = prevTeamId === result.teamId
            || (!prevSessionId && savedTeamId === result.teamId);

        if (!sameLocalTeam) {
            // На новом устройстве не смешиваем данные старой команды с восстановлением из БД.
            useGameStore.getState().resetGame();
        }
        if (!result.rejoin && prevSessionId !== newSessionId) {
            TOUR_KEYS.forEach(k => localStorage.removeItem(k));
        }
        useGameStore.setState(s => ({ game: { ...s.game, status: 'IN_PROGRESS' } }));

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
            teamId: result.teamId,
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
