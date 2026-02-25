// apiHelpers.js
// Центральный модуль для всех API-запросов к бэкенду

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5173/api';

/**
 * Обёртка для fetch с обработкой ошибок
 */
const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  
  // Добавляем токен если есть
  const token = localStorage.getItem('auth_token');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };
  
  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`[API Error] ${endpoint}:`, error);
    throw error;
  }
};

// ========== СЕССИИ (МУЛЬТИПЛЕЕР) ==========

/**
 * Создать новую игровую сессию
 * @param {string} sessionCode - 6-значный код сессии
 * @param {object} teamData - Данные команды-создателя
 * @returns {Promise<{sessionId, sessionCode, status, teams}>}
 */
export const createSession = async (sessionCode, teamData) => {
  // TODO: Заменить на реальный API call
  console.log('[API Mock] createSession:', { sessionCode, teamData });
  
  return apiFetch('/sessions/create', {
    method: 'POST',
    body: JSON.stringify({ sessionCode, teamData }),
  });
  
  // Mock response
  // return {
  //   sessionId: 'sess_' + Math.random().toString(36).substring(7),
  //   sessionCode,
  //   status: 'waiting',
  //   teams: [teamData],
  //   createdAt: new Date().toISOString(),
  // };
};

/**
 * Подключиться к существующей сессии
 * @param {string} sessionCode
 * @param {object} teamData
 * @returns {Promise<{sessionId, teams, gameState}>}
 */
export const joinSession = async (sessionCode, teamData) => {
  console.log('[API Mock] joinSession:', { sessionCode, teamData });
  
  return apiFetch('/sessions/join', {
    method: 'POST',
    body: JSON.stringify({ sessionCode, teamData }),
  });
};

/**
 * Получить статус сессии (для polling)
 * @param {string} sessionId
 * @returns {Promise<{status, teams, currentPhase}>}
 */
export const getSessionStatus = async (sessionId) => {
  return apiFetch(`/sessions/${sessionId}/status`);
};

/**
 * Покинуть сессию
 * @param {string} sessionId
 * @param {string} teamId
 */
export const leaveSession = async (sessionId, teamId) => {
  return apiFetch(`/sessions/${sessionId}/leave`, {
    method: 'POST',
    body: JSON.stringify({ teamId }),
  });
};

// ========== ИГРОВЫЕ ДАННЫЕ ==========

/**
 * Сохранить прогресс команды (НИР)
 * @param {string} teamId
 * @param {string} luId
 * @param {object} researchData - { purchasedWorks, mobilizedColumns, successRates, totalSpent }
 */
export const saveResearchProgress = async (teamId, luId, researchData) => {
  console.log('[API Mock] saveResearchProgress:', { teamId, luId, researchData });
  
  return apiFetch('/game/research', {
    method: 'POST',
    body: JSON.stringify({ teamId, luId, ...researchData }),
  });
};

/**
 * Сохранить результаты событий
 * @param {string} teamId
 * @param {string} luId
 * @param {object} eventsData - { lineScores, revealedCards, skippedLines }
 */
export const saveEventsResults = async (teamId, luId, eventsData) => {
  console.log('[API Mock] saveEventsResults:', { teamId, luId, eventsData });
  
  return apiFetch('/game/events', {
    method: 'POST',
    body: JSON.stringify({ teamId, luId, ...eventsData }),
  });
};

/**
 * Сохранить выбор полевых работ
 * @param {string} teamId
 * @param {string} luId
 * @param {object} fieldWorkData - { selections, totalCost, qualityScore }
 */
export const saveFieldWorkSelection = async (teamId, luId, fieldWorkData) => {
  console.log('[API Mock] saveFieldWorkSelection:', { teamId, luId, fieldWorkData });
  
  return apiFetch('/game/fieldwork', {
    method: 'POST',
    body: JSON.stringify({ teamId, luId, ...fieldWorkData }),
  });
};

/**
 * Сохранить финальные результаты
 * @param {string} teamId
 * @param {string} luId
 * @param {object} resultsData - { roi, geologicalParams, revealedFields }
 */
export const saveResults = async (teamId, luId, resultsData) => {
  console.log('[API Mock] saveResults:', { teamId, luId, resultsData });
  
  return apiFetch('/game/results', {
    method: 'POST',
    body: JSON.stringify({ teamId, luId, ...resultsData }),
  });
};

/**
 * Получить полный прогресс команды
 * @param {string} teamId
 * @returns {Promise<{research, events, fieldWork, results}>}
 */
export const getTeamProgress = async (teamId) => {
  return apiFetch(`/game/team/${teamId}/progress`);
};

// ========== АДМИН-ПАНЕЛЬ ==========

/**
 * Аутентификация админа
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{token, admin}>}
 */
export const adminLogin = async (username, password) => {
  console.log('[API Mock] adminLogin:', { username });
  
  return apiFetch('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  
  // Mock response
  // return {
  //   token: 'admin_token_' + Math.random().toString(36).substring(7),
  //   admin: { id: 'admin1', username, role: 'superadmin' },
  // };
};

/**
 * Получить все игровые сессии
 * @param {object} filters - { status?, dateFrom?, dateTo? }
 * @returns {Promise<Array<{sessionId, sessionCode, status, teams, createdAt}>>}
 */
export const getAdminSessions = async (filters = {}) => {
  const query = new URLSearchParams(filters).toString();
  return apiFetch(`/admin/sessions?${query}`);
};

/**
 * Получить детальную статистику сессии
 * @param {string} sessionId
 * @returns {Promise<{session, teams, gameState, timeline}>}
 */
export const getAdminSessionDetails = async (sessionId) => {
  return apiFetch(`/admin/sessions/${sessionId}`);
};

/**
 * Получить все команды
 * @param {object} filters - { sessionId?, experienceLevel? }
 * @returns {Promise<Array<{teamId, name, members, experienceLevel, createdAt}>>}
 */
export const getAdminTeams = async (filters = {}) => {
  const query = new URLSearchParams(filters).toString();
  return apiFetch(`/admin/teams?${query}`);
};

/**
 * Получить детальную статистику команды
 * @param {string} teamId
 * @returns {Promise<{team, research, events, fieldWork, results, timeline}>}
 */
export const getAdminTeamDetails = async (teamId) => {
  return apiFetch(`/admin/teams/${teamId}`);
};

/**
 * Получить глобальную статистику
 * @returns {Promise<{totalSessions, totalTeams, averageScores, completionRates}>}
 */
export const getAdminStats = async () => {
  return apiFetch('/admin/stats');
};

/**
 * Обновить игровые параметры (конфигурация)
 * @param {object} config - { budgets?, luCosts?, researchCosts?, ... }
 * @returns {Promise<{success, config}>}
 */
export const updateGameConfig = async (config) => {
  console.log('[API Mock] updateGameConfig:', config);
  
  return apiFetch('/admin/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
};

/**
 * Получить текущую конфигурацию игры
 * @returns {Promise<{budgets, luCosts, researchCosts, ...}>}
 */
export const getGameConfig = async () => {
  return apiFetch('/admin/config');
};

/**
 * Удалить сессию (hard delete)
 * @param {string} sessionId
 */
export const deleteSession = async (sessionId) => {
  return apiFetch(`/admin/sessions/${sessionId}`, {
    method: 'DELETE',
  });
};

/**
 * Сбросить данные команды
 * @param {string} teamId
 */
export const resetTeam = async (teamId) => {
  return apiFetch(`/admin/teams/${teamId}/reset`, {
    method: 'POST',
  });
};

/**
 * Экспортировать данные (CSV/JSON)
 * @param {string} type - 'sessions' | 'teams' | 'stats'
 * @param {string} format - 'csv' | 'json'
 * @returns {Promise<Blob>}
 */
export const exportData = async (type, format = 'csv') => {
  const response = await fetch(`${API_BASE_URL}/admin/export/${type}?format=${format}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
    },
  });
  
  if (!response.ok) throw new Error('Export failed');
  
  return response.blob();
};

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

/**
 * Проверить здоровье API
 * @returns {Promise<{status, version}>}
 */
export const healthCheck = async () => {
  return apiFetch('/health');
};

export default {
  // Sessions
  createSession,
  joinSession,
  getSessionStatus,
  leaveSession,
  
  // Game Data
  saveResearchProgress,
  saveEventsResults,
  saveFieldWorkSelection,
  saveResults,
  getTeamProgress,
  
  // Admin
  adminLogin,
  getAdminSessions,
  getAdminSessionDetails,
  getAdminTeams,
  getAdminTeamDetails,
  getAdminStats,
  updateGameConfig,
  getGameConfig,
  deleteSession,
  resetTeam,
  exportData,
  
  // Utils
  healthCheck,
};