import {
  getTeamByToken, updateTeamSocket, setTeamOffline,
  getSessionById, getSessionTeams, updateTeamBudget,
} from './sessionManager.js';

import {
  initTimer, getTimer, startTimer, stopTimer, pauseTimer, resumeTimer,
  setPhase, advanceYear, startRefusal, completeRefusal, resetTimer,
  updateTimerConfig, setIO,
} from './timerManager.js';

import {
  createAuction, registerParticipant, placeBid, leaveAuction,
  finalizeAuction, finalizeAllAuctions, getActiveAuctions,
  AUCTION_START_PRICE,
} from './auctionManager.js';

import { pool, dbGet, dbRun, dbAll, parseJ, stringJ } from './db.js';

export function registerSocketHandlers(io) {
  setIO(io);

  // ── Middleware: аутентификация ────────────────────────────────────────────
  io.use(async (socket, next) => {
    const { token, sessionId } = socket.handshake.auth || {};

    if (!token || !sessionId) {
      if (socket.handshake.auth?.role === 'admin') {
        socket._isAdmin = true;
        return next();
      }
      return next(new Error('AUTH_REQUIRED'));
    }

    const team = await getTeamByToken(token);
    if (!team) return next(new Error('INVALID_TOKEN'));
    if (team.session_id !== sessionId) return next(new Error('SESSION_MISMATCH'));

    socket._team      = team;
    socket._sessionId = sessionId;
    next();
  });

  io.on('connection', async (socket) => {
    const sessionId = socket._sessionId;
    const team      = socket._team;

    if (!sessionId) {
      handleAdminSocket(socket, io);
      return;
    }

    socket.join(sessionId);
    await updateTeamSocket(team.id, socket.id, true);
    console.log(`🟢  ${team.name} [${socket.id}] → session ${sessionId}`);

    // Инициализируем таймер если нет
    if (!getTimer(sessionId)) {
      const session = await getSessionById(sessionId);
      if (session) await initTimer(sessionId, session);
    }

    await _sendFullState(socket, sessionId, team);

    // ── Таймер ──────────────────────────────────────────────────────────────
    socket.on('timer:start',  () => { const s = startTimer(sessionId);  if (s) io.to(sessionId).emit('timer:state', s); });
    socket.on('timer:stop',   () => { const s = stopTimer(sessionId);   if (s) io.to(sessionId).emit('timer:state', s); });
    socket.on('timer:pause',  () => { const s = pauseTimer(sessionId);  if (s) io.to(sessionId).emit('timer:state', s); });
    socket.on('timer:resume', () => { const s = resumeTimer(sessionId); if (s) io.to(sessionId).emit('timer:state', s); });

    socket.on('timer:setPhase', ({ phase }) => {
      const s = setPhase(sessionId, phase);
      io.to(sessionId).emit('timer:state', s);
    });

    socket.on('timer:advanceYear', () => {
      const s = advanceYear(sessionId);
      io.to(sessionId).emit('timer:state', s);
      if (s?.gameOver) io.to(sessionId).emit('game:over', { sessionId });
    });

    socket.on('timer:startRefusal', ({ year }) => {
      const s = startRefusal(sessionId, year);
      io.to(sessionId).emit('timer:state', s);
      io.to(sessionId).emit('refusal:started', { year });
    });

    socket.on('timer:completeRefusal', () => {
      const s = completeRefusal(sessionId);
      io.to(sessionId).emit('timer:state', s);
      io.to(sessionId).emit('refusal:completed');
    });

    // ── Карта ────────────────────────────────────────────────────────────────
    socket.on('cell:purchase', async ({ cellRef, cellName }, cb) => {
      const myId = team.id;

      // ── Читаем реальный лимит ЛУ из сессии ───────────────────────────────
      const session = await getSessionById(sessionId);
      const maxLUs  = session?.max_lus ?? 5;

      const owned = await dbAll(
        'SELECT id FROM grid_cells WHERE session_id = $1 AND team_id = $2',
        [sessionId, myId]
      );
      if (owned.length >= maxLUs) return cb?.({ ok: false, error: 'LIMIT' });

      const existing = await dbGet(
        'SELECT * FROM grid_cells WHERE session_id = $1 AND cell_ref = $2',
        [sessionId, cellRef]
      );

      if (existing) {
        if (existing.team_id === myId) return cb?.({ ok: false, error: 'ALREADY_OWNED' });
        const auction = await createAuction(
          sessionId, cellRef, cellName, existing.team_id, existing.team_name
        );
        await registerParticipant(sessionId, cellRef, myId);
        io.to(sessionId).emit('auction:created', auction);
        return cb?.({ ok: true, action: 'auction', auction });
      }

      await dbRun(`
        INSERT INTO grid_cells (id, session_id, cell_ref, team_id, team_name, purchased_at)
        VALUES ($1,$2,$3,$4,$5, EXTRACT(EPOCH FROM NOW())::BIGINT)
        ON CONFLICT (session_id, cell_ref) DO NOTHING
      `, [`${sessionId}:${cellRef}`, sessionId, cellRef, myId, team.name]);

      const allCells = await _getSessionCells(sessionId);
      io.to(sessionId).emit('cells:updated', allCells);
      cb?.({ ok: true, action: 'purchased' });
    });

    socket.on('cell:release', async ({ cellRef }, cb) => {
      await dbRun(
        'DELETE FROM grid_cells WHERE session_id = $1 AND cell_ref = $2 AND team_id = $3',
        [sessionId, cellRef, team.id]
      );
      const allCells = await _getSessionCells(sessionId);
      io.to(sessionId).emit('cells:updated', allCells);
      cb?.({ ok: true });
    });

    // ── Аукционы ─────────────────────────────────────────────────────────────
    socket.on('auction:register', async ({ cellRef }, cb) => {
      const result = await registerParticipant(sessionId, cellRef, team.id);
      if (!result.ok) return cb?.({ ok: false, error: result.error });
      io.to(sessionId).emit('auction:updated', result.auction);
      cb?.({ ok: true, auction: result.auction });
    });

    socket.on('auction:bid', async ({ cellRef, amount }, cb) => {
      const result = await placeBid(sessionId, cellRef, team.id, team.name, amount);
      if (!result.ok) return cb?.({ ok: false, error: result.error });
      io.to(sessionId).emit('auction:bid', {
        cellRef, amount, teamId: team.id, teamName: team.name,
        auction: result.auction,
      });
      cb?.({ ok: true, auction: result.auction });
    });

    socket.on('auction:leave', async ({ cellRef }, cb) => {
      const result = await leaveAuction(sessionId, cellRef, team.id);
      if (result.cancelled) {
        io.to(sessionId).emit('auction:cancelled', { cellRef });
      } else {
        io.to(sessionId).emit('auction:updated', result.auction);
      }
      cb?.({ ok: true });
    });

    socket.on('auction:finalizeAll', async (_data, cb) => {
      const results = await finalizeAllAuctions(sessionId);
      results.forEach(r => io.to(sessionId).emit('auction:finalized', r));
      const allCells = await _getSessionCells(sessionId);
      io.to(sessionId).emit('cells:updated', allCells);
      cb?.({ ok: true, results });
    });

    // ── Прогресс ─────────────────────────────────────────────────────────────
    socket.on('research:save', async ({ luId, year, data }, cb) => {
      await pool.query(`
        INSERT INTO research_progress
          (session_id, team_id, lu_id, year, column_id,
           purchased_works_json, success_rates_json, total_spent, skipped)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (team_id, lu_id, year) DO UPDATE SET
          column_id            = EXCLUDED.column_id,
          purchased_works_json = EXCLUDED.purchased_works_json,
          success_rates_json   = EXCLUDED.success_rates_json,
          total_spent          = EXCLUDED.total_spent,
          skipped              = EXCLUDED.skipped
      `, [
        sessionId, team.id, luId, year,
        data.columnId || null,
        stringJ(data.purchasedWorks || []),
        stringJ(data.successRates   || {}),
        data.totalSpent || 0,
        data.skipped    || false,
      ]);
      cb?.({ ok: true });
    });

    socket.on('events:save', async ({ luId, year, data }, cb) => {
      await pool.query(`
        INSERT INTO events_results
          (session_id, team_id, lu_id, year, score, money_delta, line_json, completed)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (team_id, lu_id, year) DO UPDATE SET
          score       = EXCLUDED.score,
          money_delta = EXCLUDED.money_delta,
          line_json   = EXCLUDED.line_json,
          completed   = EXCLUDED.completed
      `, [
        sessionId, team.id, luId, year,
        data.score      || 0,
        data.moneyDelta || 0,
        stringJ(data.line || {}),
        data.completed  || false,
      ]);
      cb?.({ ok: true });
    });

    socket.on('fieldwork:save', async ({ luId, year, data }, cb) => {
      await pool.query(`
        INSERT INTO field_work
          (session_id, team_id, lu_id, year, selections_json, total_cost, quality_score)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (team_id, lu_id, year) DO UPDATE SET
          selections_json = EXCLUDED.selections_json,
          total_cost      = EXCLUDED.total_cost,
          quality_score   = EXCLUDED.quality_score
      `, [
        sessionId, team.id, luId, year,
        stringJ(data.selections || {}),
        data.totalCost    || 0,
        data.qualityScore || 0,
      ]);
      cb?.({ ok: true });
    });

    socket.on('result:save', async ({ luId, data }, cb) => {
      await pool.query(`
        INSERT INTO results (session_id, team_id, lu_id, card_json, roi)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (team_id, lu_id) DO UPDATE SET
          card_json = EXCLUDED.card_json,
          roi       = EXCLUDED.roi
      `, [sessionId, team.id, luId, stringJ(data.card || {}), data.roi || 0]);
      cb?.({ ok: true });
    });

    socket.on('budget:update', async ({ newBudget }, cb) => {
      await updateTeamBudget(team.id, newBudget);
      socket.emit('budget:updated', { budget: newBudget });
      cb?.({ ok: true });
    });

    socket.on('state:sync', async (_data, cb) => {
      await _sendFullState(socket, sessionId, team);
      cb?.({ ok: true });
    });

    // ── Отключение ───────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`🔴  ${team.name} disconnected`);
      await setTeamOffline(socket.id);
      socket.to(sessionId).emit('team:offline', { teamId: team.id, teamName: team.name });
    });
  });
}

// ── Admin ──────────────────────────────────────────────────────────────────────
function handleAdminSocket(socket, io) {
  console.log(`🔧  Admin connected [${socket.id}]`);

  socket.on('admin:joinSession', ({ sessionId }) => {
    socket.join(sessionId);
    // Отправляем текущее состояние таймера сразу при подключении
    const timerState = getTimer(sessionId);
    if (timerState) socket.emit('timer:state', timerState);
  });

  socket.on('admin:startTimer', ({ sessionId }) => {
    const s = startTimer(sessionId);
    if (s) io.to(sessionId).emit('timer:state', s);
  });

  socket.on('admin:stopTimer', ({ sessionId }) => {
    const s = stopTimer(sessionId);
    if (s) io.to(sessionId).emit('timer:state', s);
  });

  socket.on('admin:pauseTimer', ({ sessionId }) => {
    const s = pauseTimer(sessionId);
    if (s) io.to(sessionId).emit('timer:state', s);
  });

  socket.on('admin:resumeTimer', ({ sessionId }) => {
    const s = resumeTimer(sessionId);
    if (s) io.to(sessionId).emit('timer:state', s);
  });

  socket.on('admin:resetTimer', ({ sessionId }) => {
    const s = resetTimer(sessionId);
    if (s) io.to(sessionId).emit('timer:state', s);
  });

  socket.on('admin:setPhase', ({ sessionId, phase }) => {
    const s = setPhase(sessionId, phase);
    if (s) io.to(sessionId).emit('timer:state', s);
  });

  socket.on('admin:advanceYear', ({ sessionId }) => {
    const s = advanceYear(sessionId);
    if (s) {
      io.to(sessionId).emit('timer:state', s);
      if (s.gameOver) io.to(sessionId).emit('game:over', { sessionId });
    }
  });

  socket.on('admin:startRefusal', ({ sessionId, year }) => {
    const s = startRefusal(sessionId, year);
    if (s) {
      io.to(sessionId).emit('timer:state', s);
      io.to(sessionId).emit('refusal:started', { year });
    }
  });

  socket.on('admin:completeRefusal', ({ sessionId }) => {
    const s = completeRefusal(sessionId);
    if (s) {
      io.to(sessionId).emit('timer:state', s);
      io.to(sessionId).emit('refusal:completed');
    }
  });

  socket.on('admin:updateTimers', ({ sessionId, yearTimers, regionMapTimer }) => {
    const s = updateTimerConfig(sessionId, yearTimers, regionMapTimer);
    if (s) io.to(sessionId).emit('timer:state', s);
  });

  socket.on('admin:finalizeAllAuctions', async ({ sessionId }) => {
    const results = await finalizeAllAuctions(sessionId);
    results.forEach(r => io.to(sessionId).emit('auction:finalized', r));
    const cells = await _getSessionCells(sessionId);
    io.to(sessionId).emit('cells:updated', cells);
  });

  socket.on('disconnect', () => console.log(`🔧  Admin disconnected`));
}

// ── Хелперы ────────────────────────────────────────────────────────────────────
async function _sendFullState(socket, sessionId, team) {
  const timer    = getTimer(sessionId);
  const cells    = await _getSessionCells(sessionId);
  const auctions = await getActiveAuctions(sessionId);
  const teamRow  = await dbGet('SELECT budget FROM teams WHERE id = $1', [team.id]);

  socket.emit('state:full', {
    timer,
    cells,
    auctions,
    budget:   teamRow?.budget ?? team.budget,
    teamId:   team.id,
    teamName: team.name,
  });
}

async function _getSessionCells(sessionId) {
  const rows = await dbAll(
    'SELECT * FROM grid_cells WHERE session_id = $1', [sessionId]
  );
  const result = {};
  rows.forEach(r => {
    result[r.cell_ref] = {
      cellRef:         r.cell_ref,
      ownedByTeamId:   r.team_id,
      ownedByTeamName: r.team_name,
      auctionPrice:    r.auction_price,
      purchasedAt:     r.purchased_at,
    };
  });
  return result;
}