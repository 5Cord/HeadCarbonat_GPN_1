import { io as socketIO } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const WS_URL   = import.meta.env.VITE_WS_URL       || 'http://localhost:3001';

// ── Socket singleton ──────────────────────────────────────────────────────────
let _socket = null;

export function getSocket() { return _socket; }

export function connectSocket(token, sessionId, callbacks = {}) {
  if (_socket?.connected && _socket?._sessionId === sessionId) return _socket;
  if (_socket) _socket.disconnect();

  _socket = socketIO(WS_URL, {
    auth: { token, sessionId },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  _socket._sessionId = sessionId;

  _socket.on('connect', () => {
    console.log('🔌  Socket connected:', _socket.id);
    callbacks.onConnect?.();
    _socket.emit('state:sync');
  });

  _socket.on('disconnect', (reason) => {
    console.log('🔴  Socket disconnected:', reason);
    callbacks.onDisconnect?.(reason);
  });

  _socket.on('connect_error', (err) => {
    console.error('❌  Socket error:', err.message);
    callbacks.onError?.(err);
  });

  _socket.on('timer:tick',    callbacks.onTimerTick    || (() => {}));
  _socket.on('timer:state',   callbacks.onTimerState   || (() => {}));
  _socket.on('timer:expired', callbacks.onTimerExpired || (() => {}));

  _socket.on('cells:updated',     callbacks.onCellsUpdated     || (() => {}));
  _socket.on('auction:created',   callbacks.onAuctionCreated   || (() => {}));
  _socket.on('auction:updated',   callbacks.onAuctionUpdated   || (() => {}));
  _socket.on('auction:bid',       callbacks.onAuctionBid       || (() => {}));
  _socket.on('auction:finalized', callbacks.onAuctionFinalized || (() => {}));
  _socket.on('auction:cancelled', callbacks.onAuctionCancelled || (() => {}));

  _socket.on('team:joined',  callbacks.onTeamJoined  || (() => {}));
  _socket.on('team:offline', callbacks.onTeamOffline || (() => {}));

  _socket.on('session:started',   callbacks.onSessionStarted   || (() => {}));
  _socket.on('session:finished',  callbacks.onSessionFinished  || (() => {}));
  _socket.on('refusal:started',   callbacks.onRefusalStarted   || (() => {}));
  _socket.on('refusal:expired',   callbacks.onRefusalExpired   || (() => {}));
  _socket.on('refusal:completed', callbacks.onRefusalCompleted || (() => {}));
  _socket.on('game:over',         callbacks.onGameOver         || (() => {}));
  _socket.on('state:full',        callbacks.onFullState        || (() => {}));
  _socket.on('budget:updated',    callbacks.onBudgetUpdated    || (() => {}));
  _socket.on('year:advanced',     callbacks.onYearAdvanced     || (() => {}));

  return _socket;
}

export function disconnectSocket() {
  _socket?.disconnect();
  _socket = null;
}

// ── REST ──────────────────────────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = localStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401) {
      // Диспатчим admin:unauthorized ТОЛЬКО для admin-эндпоинтов (не для game-сайд запросов).
      // auth_token не трогаем — его чистит только явный logout в AdminPanel.
      if (endpoint.startsWith('/admin/') && !endpoint.endsWith('/admin/login')) {
        window.dispatchEvent(new CustomEvent('admin:unauthorized'));
      }
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Сессии ────────────────────────────────────────────────────────────────────
export const getSessionByCode = (code) =>
  apiFetch(`/sessions/by-code/${code}`);

export const joinSession = (sessionCode, teamData) =>
  apiFetch('/sessions/join', {
    method: 'POST',
    body: JSON.stringify({ sessionCode, teamData }),
  });

export const getSessionStatus = (sessionId) =>
  apiFetch(`/sessions/${sessionId}/status`);

export const leaveSession = async () => ({ success: true });

// ── Игровые данные (через WebSocket) ─────────────────────────────────────────
export const saveResearchProgress = (teamId, luId, data) =>
  new Promise((resolve) => {
    if (_socket?.connected) {
      _socket.emit('research:save', { luId, year: data.year, data }, resolve);
    } else resolve({ ok: true });
  });

export const saveEventsResults = (teamId, luId, data) =>
  new Promise((resolve) => {
    if (_socket?.connected) {
      _socket.emit('events:save', { luId, year: data.year, data }, resolve);
    } else resolve({ ok: true });
  });

export const saveFieldWorkSelection = (teamId, luId, data) =>
  new Promise((resolve) => {
    if (_socket?.connected) {
      _socket.emit('fieldwork:save', { luId, year: data.year, data }, resolve);
    } else resolve({ ok: true });
  });

export const saveResults = (teamId, luId, data) =>
  new Promise((resolve) => {
    if (_socket?.connected) {
      _socket.emit('result:save', { luId, data }, resolve);
    } else resolve({ ok: true });
  });

export const saveTeamProgress    = async () => ({ success: true });
export const getTeamProgress     = async () => ({});
export const finalizeTeamSelection = async () => ({ success: true });

export const placeBidOnAuction = (sessionId, cellRef, bidData) =>
  new Promise((resolve, reject) => {
    if (!_socket?.connected) return reject(new Error('Not connected'));
    _socket.emit('auction:bid', { cellRef, amount: bidData.amount }, (res) => {
      if (res.ok) resolve(res); else reject(new Error(res.error));
    });
  });

// ── Admin ─────────────────────────────────────────────────────────────────────
const adminFetch = (endpoint, options = {}) => {
  const token = localStorage.getItem('auth_token');
  return apiFetch(`/admin${endpoint}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
};

export const adminLogin = (username, password) =>
  apiFetch('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

export const createSession         = (form)   => adminFetch('/sessions', { method: 'POST', body: JSON.stringify(form) });
export const getAdminSessions      = ()        => adminFetch('/sessions');
export const getAdminSessionDetails = (id)    => adminFetch(`/sessions/${id}`);
export const getAdminTeams         = ()        => adminFetch('/teams');
export const getAdminTeamDetails   = (id)     => adminFetch(`/teams/${id}`);
export const getAdminStats         = ()        => adminFetch('/stats');
export const deleteSession         = (id)     => adminFetch(`/sessions/${id}`, { method: 'DELETE' });
export const resetTeam             = (id)     => adminFetch(`/teams/${id}/reset`, { method: 'POST' });
export const updateGameConfig      = (config) => adminFetch('/config', { method: 'PUT', body: JSON.stringify(config) });
export const getGameConfig         = ()        => adminFetch('/config');

export const exportData = async (type, format = 'csv') => {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE}/admin/export/${type}?format=${format}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
};

export const healthCheck = () => apiFetch('/health');

export default {
  getSocket, connectSocket, disconnectSocket,
  getSessionByCode, joinSession, getSessionStatus, leaveSession,
  saveResearchProgress, saveEventsResults, saveFieldWorkSelection,
  saveResults, saveTeamProgress, getTeamProgress,
  placeBidOnAuction, finalizeTeamSelection,
  adminLogin, createSession, getAdminSessions, getAdminSessionDetails,
  getAdminTeams, getAdminTeamDetails, getAdminStats,
  deleteSession, resetTeam, updateGameConfig, getGameConfig,
  exportData, healthCheck,
};