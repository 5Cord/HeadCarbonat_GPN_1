// App.jsx
import React, { useEffect, useState } from 'react';
import GameLobby from './GameLobby';
import GameBoard from './GameBoard';
import AdminPanel from './Adminpanel';
import GameOverScreen from './GameOver/GameOverScreen'; // ← НОВЫЙ ИМПОРТ
import YearEndToast from './YearEndToast';
import BugReportModal from './BugReportModal';
import useGameStore from '../store/gameStore';
import useGlobalTimer from './useGlobalTimer';
import useSocket from './useSocket';
import './App.css';

// ─── DEV Reset Button ─────────────────────────────────────────────────────────

const DevResetButton = () => {
  const { resetGame } = useGameStore();
  const [confirm, setConfirm] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => {
      setCountdown(c => c - 1);
      if (countdown === 1) setConfirm(false);
    }, 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const doReset = () => {
    localStorage.removeItem('geology-game-storage');
    localStorage.clear();
    sessionStorage.clear();
    resetGame();
    window.location.reload();
  };

  const handleClick = () => {
    if (!confirm) { setConfirm(true); setCountdown(4); return; }
    doReset();
  };

  const style = {
    position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
  };
  const btnStyle = {
    padding: confirm ? '8px 14px' : '6px 12px',
    background: confirm ? '#c62828' : 'rgba(0,0,0,0.55)',
    color: '#fff',
    border: confirm ? '2px solid #ef9a9a' : '1.5px solid rgba(255,255,255,0.18)',
    borderRadius: 8, fontSize: confirm ? '0.85rem' : '0.75rem',
    fontWeight: confirm ? 800 : 600, cursor: 'pointer',
    backdropFilter: 'blur(6px)', transition: 'all 0.2s',
    boxShadow: confirm ? '0 4px 16px rgba(198,40,40,0.4)' : '0 2px 8px rgba(0,0,0,0.3)',
    whiteSpace: 'nowrap',
  };
  const hintStyle = {
    fontSize: '0.65rem',
    color: confirm ? '#ef9a9a' : 'rgba(255,255,255,0.45)',
    textAlign: 'right', fontWeight: 500,
  };

  return (
    <div style={style}>
      <button style={btnStyle} onClick={handleClick}>
        {confirm ? `⚠️ Точно сбросить? (${countdown}с)` : '🔄 DEV: Сброс сессии'}
      </button>
      <span style={hintStyle}>
        {confirm ? 'Нажмите ещё раз — удалит все данные' : 'Ctrl+Shift+R — быстрый сброс'}
      </span>
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isAdminRoute = () =>
  window.location.pathname === '/admin' ||
  new URLSearchParams(window.location.search).has('admin');

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  // ── ВСЕ хуки — строго здесь, ДО любых условных return ────────────────────
  // Rules of Hooks: хуки нельзя вызывать после условных операторов/return.

  useSocket();
  useGlobalTimer();

  const { player, resetGame, leaveSession } = useGameStore();
  const gameStatus = useGameStore(s => s.game.status); // ← НОВАЯ СТРОКА
  const connectionStatus = useGameStore(s => s.connectionStatus);
  const yearEndToast = useGameStore(s => s.yearEndToast);

  // ФИКС порядка хуков: useState и useEffect идут до return null/return <X/>,
  // иначе React падает с "Rendered more hooks than during the previous render".
  const [hydrated, setHydrated]   = useState(false);
  const [showAdmin, setShowAdmin] = useState(isAdminRoute);
  const [showBugReport, setShowBugReport] = useState(false);

  // Ждём гидрацию Zustand persist.
  // При обновлении страницы persist восстанавливает стор АСИНХРОННО —
  // первый рендер видит player.name='' и уводит в GameLobby.
  useEffect(() => {
    if (useGameStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useGameStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return unsub;
  }, []);

  // Горячие клавиши
  useEffect(() => {
    const handleKey = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        localStorage.removeItem('geology-game-storage');
        localStorage.clear();
        sessionStorage.clear();
        resetGame();
        window.location.reload();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [resetGame]);

  // ── Условные return — только после всех хуков ─────────────────────────────

  if (!hydrated) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0a0a0a',
        color: 'rgba(255,255,255,0.4)',
        fontSize: '0.9rem',
        letterSpacing: '0.05em',
      }}>
        Загрузка...
      </div>
    );
  }

  if (showAdmin) return <AdminPanel onLogout={() => {
    window.history.replaceState(null, '', '/');
    setShowAdmin(false);
  }} />;

  if (!player.name) return <GameLobby />;

  // Выход без потери прогресса: auth_token и persist-стор остаются, поэтому
  // в лобби доступно «Продолжить за команду», а данные догрузятся из БД.
  const handleLeave = () => {
    import('./apiHelpers').then(({ disconnectSocket }) => disconnectSocket());
    if (connectionStatus === 'revoked' || connectionStatus === 'kicked') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('last_team');
    }
    leaveSession();
  };

  const btnBase = {
    padding: '6px 14px',
    background: 'rgba(10,34,64,0.85)',
    color: '#fff',
    border: '1.5px solid rgba(255,255,255,0.2)',
    borderRadius: 8,
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    backdropFilter: 'blur(6px)',
    whiteSpace: 'nowrap',
  };

  return (
    <>
      <GameBoard />
      {player.sessionId && connectionStatus !== 'connected' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(5,15,30,0.88)', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ maxWidth: 440, background: '#fff', color: '#17324d', padding: 28, borderRadius: 14, textAlign: 'center' }}>
            <h2>{connectionStatus === 'kicked' ? 'Команда исключена из сессии' : connectionStatus === 'revoked' ? 'Доступ перенесён' : 'Ожидаем подключение'}</h2>
            <p>{connectionStatus === 'kicked'
              ? 'Администратор исключил команду. Её действия в этой сессии больше недоступны.'
              : connectionStatus === 'revoked'
              ? 'Команда вошла с другого устройства. На этом устройстве действия больше недоступны.'
              : 'Связь с сервером прервана. Игровые действия возобновятся после синхронизации.'}</p>
            <button onClick={connectionStatus === 'revoked' || connectionStatus === 'kicked' ? handleLeave : () => window.location.reload()} style={{ ...btnBase, background: '#17324d' }}>
              {connectionStatus === 'revoked' || connectionStatus === 'kicked' ? 'Вернуться к входу' : 'Повторить подключение'}
            </button>
          </div>
        </div>
      )}
      <div style={{ position: 'fixed', bottom: 56, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <button
          onClick={() => setShowBugReport(true)}
          style={{ ...btnBase, background: 'rgba(20,10,40,0.85)', borderColor: 'rgba(239,68,68,0.4)', color: '#fca5a5' }}
        >
        Сообщить о баге
        </button>
        <button onClick={handleLeave} style={btnBase}>
          Выйти из сессии
        </button>
      </div>
      {showBugReport && (
        <BugReportModal
          onClose={() => setShowBugReport(false)}
          sessionId={player.sessionId}
          teamName={player.name}
        />
      )}
      {gameStatus === 'FINISHED' && <GameOverScreen />}
      {yearEndToast && <YearEndToast />}
    </>
  );
}

export default App;
