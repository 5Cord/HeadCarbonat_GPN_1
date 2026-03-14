import React, { useEffect, useState } from 'react';
import GameLobby from './GameLobby';
import GameBoard from './GameBoard';
import AdminPanel from './AdminPanel';
import useGameStore from '../store/gameStore';
import useGlobalTimer from './useGlobalTimer'
import './App.css';

/**
 * Навигация:
 *  /admin или ?admin  → AdminPanel
 *  player не создан   → GameLobby
 *  player создан      → GameBoard
 *
 * DEV: Ctrl+Shift+A toggles admin panel
 */
function App() {
  const { player } = useGameStore();
  useGlobalTimer();
  const isAdmin = () =>
    window.location.pathname === '/admin' ||
    new URLSearchParams(window.location.search).has('admin');

  const [showAdmin, setShowAdmin] = useState(isAdmin);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        setShowAdmin(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (showAdmin) return <AdminPanel />;

  if (!player.name) return <GameLobby />;

  return <GameBoard />;
}

export default App;