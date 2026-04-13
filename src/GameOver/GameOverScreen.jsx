// GameOverScreen.jsx
// Показывается когда game:over — блокирует весь UI, показывает итоговую статистику всех команд

import React, { useEffect, useState, useCallback } from 'react';
import useGameStore from '../../store/gameStore';
import { disconnectSocket } from '../apiHelpers';

const API_BASE = import.meta.env.VITE_WS_URL || '';

// ── Хелперы ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
    n == null ? '—' : Number(n).toLocaleString('ru-RU');

const fmtBudget = (n) =>
    n == null ? '—' : `${Number(n).toLocaleString('ru-RU')} млн`;

const medal = (rank) => {
    if (rank === 0) return '🥇';
    if (rank === 1) return '🥈';
    if (rank === 2) return '🥉';
    return `${rank + 1}.`;
};

// Основная метрика ранжирования — итоговый бюджет (чем больше осталось, тем лучше)
const sortKey = (team) => team.finalBudget ?? 0;

// ── Fetcher статистики ────────────────────────────────────────────────────────

async function fetchFinalStats(sessionId) {
    const token = localStorage.getItem('auth_token') || '';
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/final-stats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ── Компонент карточки команды ────────────────────────────────────────────────

const TeamCard = ({ team, rank, isMe }) => {
    const [open, setOpen] = useState(rank === 0); // топ-1 раскрыт по умолчанию

    const budgetColor =
        (team.finalBudget ?? 0) > (team.initialBudget ?? 0)
            ? '#2e7d32'
            : (team.finalBudget ?? 0) < (team.initialBudget ?? 0)
                ? '#c62828'
                : '#555';

    return (
        <div
            style={{
                border: isMe ? '2px solid #2fa394' : '1.5px solid #e0e0e0',
                borderRadius: 14,
                marginBottom: 12,
                overflow: 'hidden',
                background: isMe ? '#f0faf8' : '#fff',
                boxShadow: rank === 0 ? '0 4px 20px rgba(47,163,148,0.18)' : '0 1px 4px rgba(0,0,0,0.06)',
                transition: 'box-shadow 0.2s',
            }}
        >
            {/* ── Заголовок ── */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 18px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: rank === 0 ? 'linear-gradient(90deg,#e8f7f5,#fff)' : 'transparent',
                }}
                onClick={() => setOpen((o) => !o)}
            >
                <span style={{ fontSize: 22, minWidth: 36, textAlign: 'center' }}>{medal(rank)}</span>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1a1a1a' }}>
                        {team.teamName}
                        {isMe && (
                            <span
                                style={{
                                    marginLeft: 8,
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    background: '#2fa394',
                                    color: '#fff',
                                    borderRadius: 6,
                                    padding: '2px 7px',
                                }}
                            >
                                Ваша команда
                            </span>
                        )}
                    </div>
                    {team.members?.length > 0 && (
                        <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 2 }}>
                            {team.members.map((m) => (typeof m === 'string' ? m : m.name)).join(', ')}
                        </div>
                    )}
                </div>

                {/* Основные показатели в заголовке */}
                <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.72rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Бюджет
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: budgetColor }}>
                            {fmtBudget(team.finalBudget)}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.72rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Участки
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#333' }}>
                            {team.cellsCount ?? team.cells?.length ?? '—'}
                        </div>
                    </div>
                    <span
                        style={{
                            fontSize: 18,
                            color: '#bbb',
                            transform: open ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s',
                            display: 'inline-block',
                        }}
                    >
                        ▾
                    </span>
                </div>
            </div>

            {/* ── Детали (раскрывается) ── */}
            {open && (
                <div style={{ padding: '0 18px 16px', borderTop: '1px solid #f0f0f0' }}>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                            gap: 10,
                            marginTop: 14,
                        }}
                    >
                        {[
                            { label: 'Начальный бюджет', value: fmtBudget(team.initialBudget), color: '#555' },
                            { label: 'Итоговый бюджет', value: fmtBudget(team.finalBudget), color: budgetColor },
                            { label: 'Потрачено на НИР', value: fmtBudget(team.totalResearchSpent), color: '#1565c0' },
                            { label: 'Полевые работы', value: fmtBudget(team.totalFieldworkCost), color: '#6a1599' },
                            { label: 'События (итого)', value: team.totalEventsScore != null ? (team.totalEventsScore >= 0 ? '+' : '') + fmt(team.totalEventsScore) : '—', color: team.totalEventsScore >= 0 ? '#2e7d32' : '#c62828' },
                            { label: 'Участков', value: fmt(team.cellsCount ?? team.cells?.length), color: '#333' },
                        ].map(({ label, value, color }) => (
                            <div
                                key={label}
                                style={{
                                    background: '#f8f9fa',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                }}
                            >
                                <div style={{ fontSize: '0.72rem', color: '#999', marginBottom: 2 }}>{label}</div>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color }}>{value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Список участков */}
                    {team.cells?.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: '0.78rem', color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Участки
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {team.cells.map((c) => (
                                    <span
                                        key={c.cellRef}
                                        style={{
                                            background: '#e8f0fe',
                                            color: '#1a56a6',
                                            borderRadius: 6,
                                            padding: '3px 10px',
                                            fontSize: '0.82rem',
                                            fontWeight: 600,
                                        }}
                                    >
                                        {c.cellRef}
                                        {c.auctionPrice ? ` (аукцион: ${fmt(c.auctionPrice)} млн)` : ''}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ── Главный экран ─────────────────────────────────────────────────────────────

const GameOverScreen = () => {
    const player = useGameStore((s) => s.player);
    const resetGame = useGameStore((s) => s.resetGame);
    const sessionId = player?.sessionId || player?.sessionConfig?.sessionId;
    const myTeamId = player?.teamId;

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [retries, setRetries] = useState(0);

    const handleCloseSession = () => {
        disconnectSocket();
        resetGame();
        localStorage.clear();
        sessionStorage.clear();
    };

    const load = useCallback(async () => {
        if (!sessionId) {
            setError('Нет sessionId — невозможно загрузить статистику');
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            const data = await fetchFinalStats(sessionId);
            // Сортируем по finalBudget убывание
            const sorted = [...(data.teams || [])].sort((a, b) => sortKey(b) - sortKey(a));
            setStats({ ...data, teams: sorted });
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [sessionId]);

    useEffect(() => {
        load();
    }, [load, retries]);

    // ── Render ──────────────────────────────────────────────────────────────────

    return (
        // Полноэкранный оверлей — перекрывает весь интерфейс и блокирует взаимодействие
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                background: 'rgba(0,0,0,0.72)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                overflowY: 'auto',
                padding: '24px 16px 40px',
            }}
        >
            <div
                style={{
                    background: '#fff',
                    borderRadius: 20,
                    width: '100%',
                    maxWidth: 680,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
                    overflow: 'hidden',
                }}
            >
                {/* ── Шапка ── */}
                <div
                    style={{
                        background: 'linear-gradient(135deg, #1a3a2e 0%, #2fa394 100%)',
                        padding: '32px 28px 24px',
                        textAlign: 'center',
                        color: '#fff',
                    }}
                >
                    <div style={{ fontSize: 52, marginBottom: 8 }}>🏁</div>
                    <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                        Игра завершена!
                    </h1>
                    <p style={{ margin: '8px 0 0', opacity: 0.8, fontSize: '1rem' }}>
                        Пройдено 10 лет геологоразведки. Итоговые результаты всех команд:
                    </p>
                    {stats && (
                        <div
                            style={{
                                display: 'inline-flex',
                                gap: 20,
                                marginTop: 16,
                                background: 'rgba(255,255,255,0.12)',
                                borderRadius: 10,
                                padding: '8px 20px',
                                fontSize: '0.85rem',
                            }}
                        >
                            <span>Сессия: <b>{stats.sessionCode}</b></span>
                            <span>Команд: <b>{stats.teams?.length}</b></span>
                        </div>
                    )}
                </div>

                {/* ── Тело ── */}
                <div style={{ padding: '24px 20px' }}>
                    {loading && (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
                            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                            <div>Загружаем статистику...</div>
                        </div>
                    )}

                    {error && !loading && (
                        <div style={{ textAlign: 'center', padding: '32px 0' }}>
                            <div style={{ color: '#c62828', marginBottom: 12 }}>
                                Ошибка загрузки статистики: {error}
                            </div>
                            <button
                                onClick={() => setRetries((r) => r + 1)}
                                style={{
                                    padding: '10px 24px',
                                    background: '#2fa394',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 8,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    fontSize: '0.95rem',
                                }}
                            >
                                Повторить
                            </button>
                        </div>
                    )}

                    {stats && !loading && (
                        <>
                            {/* Пьедестал — топ-3 */}
                            {stats.teams?.length >= 3 && (
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'flex-end',
                                        gap: 8,
                                        marginBottom: 24,
                                        padding: '16px 0 8px',
                                    }}
                                >
                                    {[1, 0, 2].map((idx) => {
                                        const team = stats.teams[idx];
                                        if (!team) return null;
                                        const heights = [88, 110, 70];
                                        const h = heights[idx === 1 ? 1 : idx === 0 ? 0 : 2];
                                        const colors = ['#C0A960', '#FFD700', '#C87533'];
                                        const color = colors[idx === 1 ? 1 : idx === 0 ? 0 : 2];
                                        return (
                                            <div
                                                key={team.teamId}
                                                style={{ flex: 1, maxWidth: 180, textAlign: 'center' }}
                                            >
                                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#555', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {team.teamName}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: '#2fa394', fontWeight: 700, marginBottom: 4 }}>
                                                    {fmtBudget(team.finalBudget)}
                                                </div>
                                                <div
                                                    style={{
                                                        height: h,
                                                        background: `linear-gradient(to top, ${color}cc, ${color}44)`,
                                                        borderRadius: '6px 6px 0 0',
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        justifyContent: 'center',
                                                        paddingTop: 10,
                                                        fontSize: 22,
                                                        border: `2px solid ${color}`,
                                                        borderBottom: 'none',
                                                    }}
                                                >
                                                    {medal(idx)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Полный список команд */}
                            <div>
                                {stats.teams.map((team, idx) => (
                                    <TeamCard
                                        key={team.teamId}
                                        team={team}
                                        rank={idx}
                                        isMe={team.teamId === myTeamId}
                                    />
                                ))}
                            </div>

                            {/* Подпись */}
                            <div
                                style={{
                                    textAlign: 'center',
                                    marginTop: 24,
                                    padding: '16px',
                                    background: '#f8f9fa',
                                    borderRadius: 10,
                                    color: '#888',
                                    fontSize: '0.82rem',
                                }}
                            >
                                Игра завершена. Все данные сохранены. Спасибо за участие!
                            </div>
                        </>
                    )}

                    {/* Кнопка завершения — показывается всегда */}
                    <div style={{ textAlign: 'center', marginTop: 28 }}>
                        <button
                            onClick={handleCloseSession}
                            style={{
                                padding: '12px 36px',
                                background: 'linear-gradient(135deg, #1a3a2e 0%, #2fa394 100%)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 10,
                                fontWeight: 700,
                                fontSize: '1rem',
                                cursor: 'pointer',
                                letterSpacing: '0.02em',
                                boxShadow: '0 4px 16px rgba(47,163,148,0.3)',
                            }}
                        >
                            Завершить сессию
                        </button>
                        <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#aaa' }}>
                            Вернёт на экран входа. Повторно подключиться к этой сессии невозможно.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameOverScreen;