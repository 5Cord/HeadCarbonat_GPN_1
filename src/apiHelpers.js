// apiHelpers.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5173/api';

// ── Мок-режим ─────────────────────────────────────────────────────────────────
const USE_MOCK = true; // поменяй на false когда бэк готов

const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

// Хранилище сессий в localStorage — живёт между перезагрузками
const SESSIONS_KEY = 'mock_sessions';

const getSessions = () => {
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}'); }
  catch { return {}; }
};

const saveSessions = (sessions) => {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
};

const generateCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

// ── Моки ─────────────────────────────────────────────────────────────────────

const MOCKS = {
  createSession: async (sessionForm) => {
    await delay();
    const sessions = getSessions();
    const sessionCode = generateCode();
    const sessionId = `sess_${Date.now()}`;
    sessions[sessionCode] = {
      sessionId,
      sessionCode,
      status: 'waiting',
      ...sessionForm,
      budget: sessionForm.playerType === 'students' ? 99999999 : 99999999,
      createdAt: new Date().toISOString(),
      teams: sessionForm.teams || [],
    };
    saveSessions(sessions);
    console.log('[MOCK] Сессия создана:', sessionCode, '| Все сессии:', Object.keys(sessions));
    return { sessionId, sessionCode, status: 'waiting' };
  },

  getSessionByCode: async (sessionCode) => {
    await delay();
    const sessions = getSessions();
    const session = sessions[sessionCode];
    console.log('[MOCK] getSessionByCode:', sessionCode, '→', session ? 'найдена' : 'не найдена');
    if (!session) throw new Error('Сессия не найдена');
    return session;
  },

  joinSession: async (sessionCode, teamData) => {
    await delay();
    const sessions = getSessions();
    const session = sessions[sessionCode];
    if (!session) throw new Error('Сессия не найдена');
    const teamId = `team_${Date.now()}`;
    // Регистрируем команду в сессии
    session.joinedTeams = session.joinedTeams || [];
    session.joinedTeams.push({ teamId, teamName: teamData.teamName, joinedAt: new Date().toISOString() });
    saveSessions(sessions);
    return {
      teamId,
      teamName: teamData.teamName,
      members: teamData.members,
      token: `mock_token_${teamId}`,
      sessionConfig: {
        gameMode: session.gameMode,
        playerType: session.playerType,
        budget: session.budget,
        timers: session.timers,
        maxLUsPerTeam: session.maxLUsPerTeam,
      },
    };
  },

  getSessionStatus: async (sessionId) => {
    await delay();
    return { status: 'active', currentPhase: 'selection', teams: [] };
  },

  getAdminStats: async () => {
    await delay();
    const sessions = getSessions();
    const allSessions = Object.values(sessions);
    const totalTeams = allSessions.reduce((n, s) => n + (s.joinedTeams?.length || 0), 0);
    return {
      totalSessions: allSessions.length,
      totalTeams,
      averageScore: 0,
      completionRate: 0,
    };
  },

  getAdminSessions: async () => {
    await delay();
    return Object.values(getSessions());
  },

  getAdminTeams: async () => {
    await delay();
    const sessions = getSessions();
    return Object.values(sessions).flatMap(s =>
      (s.joinedTeams || []).map(t => ({
        ...t,
        sessionCode: s.sessionCode,
        experienceLevel: s.playerType,
        members: [],
        createdAt: t.joinedAt,
      }))
    );
  },

  getGameConfig: async () => {
    await delay();
    return {
      budgets: { student: 99999999, professional: 99999999 },
      luCosts: { base: 200 },
      researchCosts: { mobilization: 100 },
    };
  },

  updateGameConfig: async (config) => {
    await delay();
    return { success: true, config };
  },

  deleteSession: async (sessionId) => {
    await delay();
    const sessions = getSessions();
    const code = Object.keys(sessions).find(k => sessions[k].sessionId === sessionId);
    if (code) { delete sessions[code]; saveSessions(sessions); }
    return { success: true };
  },

  resetTeam: async () => { await delay(); return { success: true }; },
  leaveSession: async () => { await delay(); return { success: true }; },
  saveTeamProgress: async () => { await delay(); return { success: true }; },
  finalizeTeamSelection: async () => { await delay(); return { success: true }; },
  placeBidOnAuction: async () => { await delay(); return { success: true }; },
  saveResearchProgress: async () => { await delay(); return { success: true }; },
  saveEventsResults: async () => { await delay(); return { success: true }; },
  saveFieldWorkSelection: async () => { await delay(); return { success: true }; },
  saveResults: async () => { await delay(); return { success: true }; },
  getTeamProgress: async () => { await delay(); return {}; },
  healthCheck: async () => { await delay(); return { status: 'ok (mock)', version: '0.0.1' }; },
  exportData: async () => { await delay(); return new Blob(['mock'], { type: 'text/csv' }); },
};

// ── Реальный fetch ────────────────────────────────────────────────────────────

const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultHeaders = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('auth_token');
  if (token) defaultHeaders['Authorization'] = `Bearer ${token}`;

  const config = { ...options, headers: { ...defaultHeaders, ...options.headers } };

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

// ── Обёртка: мок или реальный запрос ─────────────────────────────────────────

const withMock = (mockFn, realFn) => USE_MOCK ? mockFn : realFn;

// ========== СЕССИИ ==========

export const createSession = withMock(
  MOCKS.createSession,
  async (sessionForm) => apiFetch('/sessions/create', { method: 'POST', body: JSON.stringify(sessionForm) })
);

export const getSessionByCode = withMock(
  MOCKS.getSessionByCode,
  async (sessionCode) => apiFetch(`/sessions/by-code/${sessionCode}`)
);

export const joinSession = withMock(
  MOCKS.joinSession,
  async (sessionCode, teamData) => apiFetch('/sessions/join', { method: 'POST', body: JSON.stringify({ sessionCode, teamData }) })
);

export const getSessionStatus = withMock(
  MOCKS.getSessionStatus,
  async (sessionId) => apiFetch(`/sessions/${sessionId}/status`)
);

export const leaveSession = withMock(
  MOCKS.leaveSession,
  async (sessionId, teamId) => apiFetch(`/sessions/${sessionId}/leave`, { method: 'POST', body: JSON.stringify({ teamId }) })
);

// ========== ИГРОВЫЕ ДАННЫЕ ==========

export const finalizeTeamSelection = withMock(
  MOCKS.finalizeTeamSelection,
  async (sessionId, teamId, selectionData) => apiFetch(`/sessions/${sessionId}/teams/${teamId}/finalize`, { method: 'POST', body: JSON.stringify(selectionData) })
);

export const saveResearchProgress = withMock(
  MOCKS.saveResearchProgress,
  async (teamId, luId, researchData) => apiFetch('/game/research', { method: 'POST', body: JSON.stringify({ teamId, luId, ...researchData }) })
);

export const saveEventsResults = withMock(
  MOCKS.saveEventsResults,
  async (teamId, luId, eventsData) => apiFetch('/game/events', { method: 'POST', body: JSON.stringify({ teamId, luId, ...eventsData }) })
);

export const saveFieldWorkSelection = withMock(
  MOCKS.saveFieldWorkSelection,
  async (teamId, luId, fieldWorkData) => apiFetch('/game/fieldwork', { method: 'POST', body: JSON.stringify({ teamId, luId, ...fieldWorkData }) })
);

export const saveResults = withMock(
  MOCKS.saveResults,
  async (teamId, luId, resultsData) => apiFetch('/game/results', { method: 'POST', body: JSON.stringify({ teamId, luId, ...resultsData }) })
);

export const getTeamProgress = withMock(
  MOCKS.getTeamProgress,
  async (teamId) => apiFetch(`/game/team/${teamId}/progress`)
);

export const placeBidOnAuction = withMock(
  MOCKS.placeBidOnAuction,
  async (sessionId, cellRef, bidData) => apiFetch(`/sessions/${sessionId}/auction/${cellRef}/bid`, { method: 'POST', body: JSON.stringify(bidData) })
);

export const saveTeamProgress = withMock(
  MOCKS.saveTeamProgress,
  async (sessionId, teamId, progressData) => apiFetch(`/sessions/${sessionId}/teams/${teamId}/progress`, { method: 'POST', body: JSON.stringify(progressData) })
);

// ========== АДМИН-ПАНЕЛЬ ==========

export const adminLogin = async (username, password) =>
  apiFetch('/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });

export const getAdminSessions = withMock(
  MOCKS.getAdminSessions,
  async (filters = {}) => apiFetch(`/admin/sessions?${new URLSearchParams(filters)}`)
);

export const getAdminSessionDetails = async (sessionId) => apiFetch(`/admin/sessions/${sessionId}`);

export const getAdminTeams = withMock(
  MOCKS.getAdminTeams,
  async (filters = {}) => apiFetch(`/admin/teams?${new URLSearchParams(filters)}`)
);

export const getAdminTeamDetails = async (teamId) => apiFetch(`/admin/teams/${teamId}`);

export const getAdminStats = withMock(
  MOCKS.getAdminStats,
  async () => apiFetch('/admin/stats')
);

export const updateGameConfig = withMock(
  MOCKS.updateGameConfig,
  async (config) => apiFetch('/admin/config', { method: 'PUT', body: JSON.stringify(config) })
);

export const getGameConfig = withMock(
  MOCKS.getGameConfig,
  async () => apiFetch('/admin/config')
);

export const deleteSession = withMock(
  MOCKS.deleteSession,
  async (sessionId) => apiFetch(`/admin/sessions/${sessionId}`, { method: 'DELETE' })
);

export const resetTeam = withMock(
  MOCKS.resetTeam,
  async (teamId) => apiFetch(`/admin/teams/${teamId}/reset`, { method: 'POST' })
);

export const exportData = withMock(
  MOCKS.exportData,
  async (type, format = 'csv') => {
    const response = await fetch(`${API_BASE_URL}/admin/export/${type}?format=${format}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
    });
    if (!response.ok) throw new Error('Export failed');
    return response.blob();
  }
);

export const healthCheck = withMock(
  MOCKS.healthCheck,
  async () => apiFetch('/health')
);

export default {
  createSession, getSessionByCode, joinSession, getSessionStatus, leaveSession,
  finalizeTeamSelection, saveResearchProgress, saveEventsResults,
  saveFieldWorkSelection, saveResults, getTeamProgress,
  placeBidOnAuction, saveTeamProgress,
  adminLogin, getAdminSessions, getAdminSessionDetails,
  getAdminTeams, getAdminTeamDetails, getAdminStats,
  updateGameConfig, getGameConfig, deleteSession, resetTeam,
  exportData, healthCheck,
};