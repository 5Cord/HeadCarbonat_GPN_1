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

// ─── Admin Access Button ──────────────────────────────────────────────────────

const AdminAccessButton = ({ onLogin, onLogout }) => {
  const [hasToken, setHasToken] = useState(() => !!localStorage.getItem('auth_token'));

  useEffect(() => {
    const sync = () => setHasToken(!!localStorage.getItem('auth_token'));
    window.addEventListener('admin:unauthorized', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('admin:unauthorized', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const btnStyle = {
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

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('admin_tab');
    setHasToken(false);
    onLogout?.();
  };

  return (
    <div style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 9999 }}>
      {hasToken ? (
        <button style={btnStyle} onClick={handleLogout}>Выйти из панели</button>
      ) : (
        <button style={btnStyle} onClick={() => { setHasToken(false); onLogin?.(); }}>Войти в панель</button>
      )}
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
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        setShowAdmin(prev => !prev);
      }
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

  if (showAdmin) return <AdminPanel onLogout={() => setShowAdmin(false)} />;

  if (!player.name) return (
    <>
      <GameLobby />
      <AdminAccessButton onLogin={() => setShowAdmin(true)} onLogout={() => setShowAdmin(false)} />
    </>
  );

  const handleLeave = () => {
    import('./apiHelpers').then(({ disconnectSocket }) => disconnectSocket());
    resetGame();
    localStorage.clear();
    sessionStorage.clear();
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
      <AdminAccessButton onLogin={() => setShowAdmin(true)} onLogout={() => setShowAdmin(false)} />
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
