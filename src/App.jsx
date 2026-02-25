import React from 'react';
import GameLobby from './GameLobby';
import GameBoard from './GameBoard';
import useGameStore from '../store/gameStore';
import './App.css';
import AdminPanel from './Adminpanel';

/**
 * Главный компонент приложения
 * 
 * Навигация:
 * 1. Команда не создана → GameLobby (настройка команды)
 * 2. Команда создана → GameBoard (доска с 5 полями)
 *    - Поле [0] Карта региона = выбор ЛУ
 *    - После выбора ЛУ → круги по полям 1-2-3-4
 */
function App() {
  const { player } = useGameStore();
  
  // Если команда не создана - показываем лобби
  if (!player.name || player.teamMembers.length === 0) {
    return <GameLobby />;
    // return <AdminPanel />;
  }
  
  return <GameBoard />;
}

export default App;