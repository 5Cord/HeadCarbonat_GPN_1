// socketHandlers.js

import {
  getTeamByToken, updateTeamSocket, setTeamOffline,
  getSessionById, getSessionTeams, updateTeamBudget,
} from './sessionManager.js';

import {
  initTimer, getTimer, startTimer, stopTimer, pauseTimer, resumeTimer,
  setPhase, advanceYear, startRefusal, completeRefusal, resetTimer,
  updateTimerConfig, setIO, setAuctionPhaseEndHandler,
} from './timerManager.js';

import {
  createAuction, registerParticipant, placeBid, leaveAuction,
  finalizeAuction, finalizeAllAuctions, getActiveAuctions,
  getAuction,
  AUCTION_START_PRICE,
} from './auctionManager.js';

import { pool, dbGet, dbRun, dbAll, parseJ, stringJ } from './db.js';

// sessionId → Set(teamId) — команды готовые к переходу года
const yearReadyTeams = new Map();

// ── Запись транзакции расхода ─────────────────────────────────────────────────
async function logExpense(sessionId, teamId, amount, type, description) {
  try {
    await pool.query(`
            INSERT INTO budget_transactions
              (session_id, team_id, amount, type, description, created_at)
            VALUES ($1,$2,$3,$4,$5, EXTRACT(EPOCH FROM NOW())::BIGINT)
        `, [sessionId, teamId, -Math.abs(amount), type, description]);
  } catch (e) {
    console.warn('logExpense skipped:', e.message);
  }
}

export function registerSocketHandlers(io) {
  setIO(io);

  setAuctionPhaseEndHandler(async (sessionId) => {
    const results = await finalizeAllAuctions(sessionId);

    for (const r of results) {
      io.to(sessionId).emit('auction:finalized', r);

      if (r.winnerId && r.winnerBudget != null) {
        const winnerSockets = await io.in(sessionId).fetchSockets();
        winnerSockets
          .filter(s => s._team?.id === r.winnerId)
          .forEach(s => s.emit('budget:updated', { budget: r.winnerBudget }));
      }
    }

    const cells = await _getSessionCells(sessionId);
    io.to(sessionId).emit('cells:updated', cells);
  });

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

    socket._team = team;
    socket._sessionId = sessionId;
    next();
  });

  io.on('connection', async (socket) => {
    const sessionId = socket._sessionId;
    const team = socket._team;

    if (!sessionId) {
      handleAdminSocket(socket, io);
      return;
    }

    socket.join(sessionId);
    await updateTeamSocket(team.id, socket.id, true);
    console.log(`🟢  ${team.name} [${socket.id}] → session ${sessionId}`);

    if (!getTimer(sessionId)) {
      const session = await getSessionById(sessionId);
      if (session) await initTimer(sessionId, session);
    }

    await _sendFullState(socket, sessionId, team);

    // ── Карта: покупка карточки ЛУ ───────────────────────────────────────
    socket.on('lu:purchase', async ({ luId, luName, cost }, cb) => {
      const teamRow = await dbGet('SELECT budget FROM teams WHERE id = $1', [team.id]);
      if (!teamRow) return cb?.({ ok: false, error: 'Team not found' });
      if (teamRow.budget < cost) return cb?.({ ok: false, error: 'INSUFFICIENT_FUNDS' });

      const newBudget = teamRow.budget - cost;

      await dbTx(async (client) => {
        await client.query(
          'UPDATE teams SET budget = $1 WHERE id = $2',
          [newBudget, team.id]
        );
        await client.query(`
                    INSERT INTO budget_transactions
                      (session_id, team_id, amount, type, description, created_at)
                    VALUES ($1,$2,$3,'lu_card',$4, EXTRACT(EPOCH FROM NOW())::BIGINT)
                `, [sessionId, team.id, -cost, `Карточка ЛУ: ${luName} (${cost} млн)`]);
      });

      socket.emit('budget:updated', { budget: newBudget });
      cb?.({ ok: true, budget: newBudget });
    });

    // ── Карта: покупка участка (grid cell) ───────────────────────────────
    socket.on('cell:purchase', async ({ cellRef, cellName }, cb) => {
      const myId = team.id;

      const session = await getSessionById(sessionId);
      const maxLUs = session?.max_lus ?? 5;

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

        await createAuction(sessionId, cellRef, cellName, existing.team_id, existing.team_name);
        await registerParticipant(sessionId, cellRef, myId);

        const auctionId = `${sessionId}:${cellRef}`;
        const fullAuction = await getAuction(auctionId);

        io.to(sessionId).emit('auction:created', fullAuction);
        return cb?.({ ok: true, action: 'auction', auction: fullAuction });
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

    // ── Отказ от участков (отказной период после года 3 и 5) ─────────────
    socket.on('cell:refusal_release', async ({ cellRefs }, cb) => {
      if (!Array.isArray(cellRefs) || cellRefs.length === 0) {
        return cb?.({ ok: true, released: [] });
      }

      const released = [];
      for (const cellRef of cellRefs) {
        const result = await pool.query(
          'DELETE FROM grid_cells WHERE session_id = $1 AND cell_ref = $2 AND team_id = $3 RETURNING id',
          [sessionId, cellRef, team.id]
        );
        if (result.rowCount > 0) released.push(cellRef);
      }

      if (released.length > 0) {
        const allCells = await _getSessionCells(sessionId);
        io.to(sessionId).emit('cells:updated', allCells);
        console.log(`[${sessionId}] ${team.name} отказался от участков: ${released.join(', ')}`);
      }

      cb?.({ ok: true, released });
    });

    // ── Аукционы ─────────────────────────────────────────────────────────
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

      for (const r of results) {
        io.to(sessionId).emit('auction:finalized', r);

        if (r.winnerId && r.winnerBudget != null) {
          const allSockets = await io.in(sessionId).fetchSockets();
          allSockets
            .filter(s => s._team?.id === r.winnerId)
            .forEach(s => s.emit('budget:updated', { budget: r.winnerBudget }));
        }
      }

      const allCells = await _getSessionCells(sessionId);
      io.to(sessionId).emit('cells:updated', allCells);
      cb?.({ ok: true, results });
    });

    // ── НИР: покупка работ ───────────────────────────────────────────────────────
    socket.on('research:purchase', async ({ purchases, totalCost }, cb) => {
      try {
        if (!Array.isArray(purchases) || purchases.length === 0) {
          return cb?.({ ok: false, error: 'NO_PURCHASES' });
        }

        const teamRow = await dbGet('SELECT budget FROM teams WHERE id = $1', [team.id]);
        if (!teamRow) return cb?.({ ok: false, error: 'TEAM_NOT_FOUND' });

        const cost = Number(totalCost) || 0;
        if (teamRow.budget < cost) {
          return cb?.({ ok: false, error: 'INSUFFICIENT_FUNDS' });
        }

        const newBudget = teamRow.budget - cost;

        // ── Транзакция: обновляем бюджет И логируем в budget_transactions ──
        await dbTx(async (client) => {
          // 1. Обновляем бюджет команды
          await client.query(
            'UPDATE teams SET budget = $1 WHERE id = $2',
            [newBudget, team.id]
          );

          // 2. Логируем каждую покупку НИР в budget_transactions
          for (const p of purchases) {
            const luName = p.luId ? `участок ${p.luId}` : 'участок';
            const description = `НИР: ${p.workName || ''} | Мобилизация: ${p.mobName || ''} (год ${p.year || '?'}) на ${luName}`;

            await client.query(`
                            INSERT INTO budget_transactions
                              (session_id, team_id, amount, type, description, created_at)
                            VALUES ($1,$2,$3,'research',$4, EXTRACT(EPOCH FROM NOW())::BIGINT)
                        `, [sessionId, team.id, -Number(p.cost || 0), description]);
          }
        });

        // 3. Сохраняем историю покупок в research_purchases ДЛЯ АНАЛИТИКИ
        // ← ВАЖНО: Это НЕ критично, используем try-catch чтобы не падать если таблицы нет
        try {
          for (const p of purchases) {
            await dbRun(`
                            INSERT INTO research_purchases
                              (session_id, team_id, lu_id, work_id, work_name,
                               mob_id, mob_name, cost, year, purchased_at)
                            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, EXTRACT(EPOCH FROM NOW())::BIGINT)
                        `, [
              sessionId,
              team.id,
              p.luId || '',
              p.workId || '',
              p.workName || '',
              p.mobId || '',
              p.mobName || '',
              Number(p.cost) || 0,
              Number(p.year) || 1,
            ]);
          }
        } catch (err) {
          // Таблица research_purchases может не существовать - это нормально
          // Критичная операция (логирование в budget_transactions) уже выполнена
          console.warn('⚠️  research_purchases table not available (optional), but budget_transactions is OK');
        }

        // 4. Уведомляем команду о новом бюджете
        socket.emit('budget:updated', { budget: newBudget });

        console.log(`🔬  ${team.name} купил НИР (${purchases.length} шт.) на ${cost} млн → бюджет ${newBudget}`);
        cb?.({ ok: true, newBudget });
      } catch (err) {
        console.error('research:purchase error:', err);
        cb?.({ ok: false, error: 'SERVER_ERROR' });
      }
    });

    // ── Переход года: команда сигнализирует готовность ───────────────────
    socket.on('year:ready', async ({ year }, cb) => {
      if (!yearReadyTeams.has(sessionId)) {
        yearReadyTeams.set(sessionId, new Set());
      }
      yearReadyTeams.get(sessionId).add(team.id);

      const readySet = yearReadyTeams.get(sessionId);
      const allTeams = await getSessionTeams(sessionId);
      const totalCount = allTeams.length;
      const readyCount = readySet.size;

      io.to(sessionId).emit('year:ready_status', {
        year,
        readyCount,
        totalCount,
        readyTeams: [...readySet],
      });

      cb?.({ ok: true, readyCount, totalCount });

      if (readyCount >= totalCount) {
        yearReadyTeams.delete(sessionId);
        const s = advanceYear(sessionId);
        if (s) {
          io.to(sessionId).emit('timer:state', s);
          if (s.gameOver) {
            io.to(sessionId).emit('game:over', { sessionId });
          } else {
            io.to(sessionId).emit('year:advanced', { year: s.currentYear });
          }
        }
      }
    });

    // ── Финальное сохранение при завершении игры ─────────────────────────
    socket.on('request_final_save', async ({ sessionId }, cb) => {
      try {
        const teams = await getSessionTeams(sessionId);

        for (const team of teams) {
          await pool.query(`
                        UPDATE teams 
                        SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
                        WHERE id = $1
                    `, [team.id]);

          console.log(`Финальное сохранение для команды ${team.name} (${team.id})`);
        }

        const timer = getTimer(sessionId);
        if (timer) {
          await pool.query(`
                        UPDATE session_timers 
                        SET is_running = false, 
                            updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
                        WHERE session_id = $1
                    `, [sessionId]);
        }

        console.log(`Все данные сессии ${sessionId} сохранены`);
        cb?.({ ok: true });
      } catch (err) {
        console.error('Ошибка финального сохранения:', err);
        cb?.({ ok: false, error: err.message });
      }
    });

    // ── Прогресс (События, полевые) — сохраняем в БД ──────────────────────

    socket.on('events:save', async ({ luId, year, data }, cb) => {
      try {
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
          data.score || 0,
          data.moneyDelta || 0,
          stringJ(data.line || {}),
          data.completed || false,
        ]);

        if (data.moneyDelta && data.moneyDelta !== 0) {
          await logExpense(
            sessionId,
            team.id,
            -data.moneyDelta,
            'events',
            `События год ${year} участок ${luId}: ${data.moneyDelta > 0 ? 'доход' : 'трата'} ${Math.abs(data.moneyDelta)} млн`
          );
        }

        if (data.budgetAfter != null) {
          await dbRun('UPDATE teams SET budget = $1 WHERE id = $2', [data.budgetAfter, team.id]);
          socket.emit('budget:updated', { budget: data.budgetAfter });
        }

        cb?.({ ok: true });
      } catch (err) {
        console.error('events:save error:', err);
        cb?.({ ok: false, error: err.message });
      }
    });

    socket.on('fieldwork:save', async ({ luId, year, data }, cb) => {
      try {
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
          data.totalCost || 0,
          data.qualityScore || 0,
        ]);

        if (data.totalCost && data.totalCost > 0) {
          await logExpense(
            sessionId,
            team.id,
            data.totalCost,
            'fieldwork',
            `Полевые работы год ${year} участок ${luId}: ${data.totalCost} млн`
          );
        }

        if (data.budgetAfter != null) {
          await dbRun('UPDATE teams SET budget = $1 WHERE id = $2', [data.budgetAfter, team.id]);
          socket.emit('budget:updated', { budget: data.budgetAfter });
        }

        cb?.({ ok: true });
      } catch (err) {
        console.error('fieldwork:save error:', err);
        cb?.({ ok: false, error: err.message });
      }
    });

    socket.on('research:save', async ({ luId, year, data }, cb) => {
      try {
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
          stringJ(data.successRates || {}),
          data.totalSpent || 0,
          data.skipped || false,
        ]);

        if (data.budgetAfter != null) {
          await dbRun('UPDATE teams SET budget = $1 WHERE id = $2', [data.budgetAfter, team.id]);
          socket.emit('budget:updated', { budget: data.budgetAfter });
        }

        cb?.({ ok: true });
      } catch (err) {
        console.error('research:save error:', err);
        cb?.({ ok: false, error: err.message });
      }
    });

    socket.on('result:save', async ({ luId, data }, cb) => {
      try {
        await pool.query(`
                    INSERT INTO results (session_id, team_id, lu_id, card_json, roi)
                    VALUES ($1,$2,$3,$4,$5)
                    ON CONFLICT (team_id, lu_id) DO UPDATE SET
                      card_json = EXCLUDED.card_json,
                      roi       = EXCLUDED.roi
                `, [sessionId, team.id, luId, stringJ(data.card || {}), data.roi || 0]);
        cb?.({ ok: true });
      } catch (err) {
        console.error('result:save error:', err);
        cb?.({ ok: false, error: err.message });
      }
    });

    // ── Универсальное обновление бюджета (fallback) ───────────────────────
    socket.on('budget:update', async ({ newBudget, reason, amount }, cb) => {
      await updateTeamBudget(team.id, newBudget);

      if (reason && amount) {
        await logExpense(sessionId, team.id, amount, 'other', reason);
      }

      socket.emit('budget:updated', { budget: newBudget });
      cb?.({ ok: true });
    });

    socket.on('state:sync', async (_data, cb) => {
      await _sendFullState(socket, sessionId, team);
      cb?.({ ok: true });
    });

    socket.on('request_full_state', async () => {
      await _sendFullState(socket, sessionId, team);
    });

    // ── Отключение ───────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`🔴  ${team.name} disconnected`);
      await setTeamOffline(socket.id);
      socket.to(sessionId).emit('team:offline', { teamId: team.id, teamName: team.name });
      yearReadyTeams.get(sessionId)?.delete(team.id);
    });
  });
}

// ── Admin socket ───────────────────────────────────────────────────────────────
function handleAdminSocket(socket, io) {
  console.log(`🔧  Admin connected [${socket.id}]`);

  socket.on('admin:joinSession', ({ sessionId }) => {
    socket.join(sessionId);
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
    yearReadyTeams.delete(sessionId);
    const s = advanceYear(sessionId);
    if (s) {
      io.to(sessionId).emit('timer:state', s);
      if (s.gameOver) io.to(sessionId).emit('game:over', { sessionId });
      else io.to(sessionId).emit('year:advanced', { year: s.currentYear });
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

  socket.on('admin:updateTimers', ({ sessionId, yearTimers, regionMapTimer, regionMapTimers }) => {
    const s = updateTimerConfig(sessionId, yearTimers, regionMapTimer, regionMapTimers);
    if (s) io.to(sessionId).emit('timer:state', s);
  });

  socket.on('admin:finalizeAllAuctions', async ({ sessionId }) => {
    const results = await finalizeAllAuctions(sessionId);

    for (const r of results) {
      io.to(sessionId).emit('auction:finalized', r);
      if (r.winnerId && r.winnerBudget != null) {
        const allSockets = await io.in(sessionId).fetchSockets();
        allSockets
          .filter(s => s._team?.id === r.winnerId)
          .forEach(s => s.emit('budget:updated', { budget: r.winnerBudget }));
      }
    }

    const cells = await _getSessionCells(sessionId);
    io.to(sessionId).emit('cells:updated', cells);
  });

  socket.on('disconnect', () => console.log(`🔧  Admin disconnected`));
}

// ── Хелперы ────────────────────────────────────────────────────────────────────
async function _sendFullState(socket, sessionId, team) {
  const timer = getTimer(sessionId);
  const cells = await _getSessionCells(sessionId);
  const auctions = await getActiveAuctions(sessionId);
  const teamRow = await dbGet('SELECT budget FROM teams WHERE id = $1', [team.id]);

  socket.emit('state:full', {
    timer,
    cells,
    auctions,
    budget: teamRow?.budget ?? team.budget,
    teamId: team.id,
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
      cellRef: r.cell_ref,
      ownedByTeamId: r.team_id,
      ownedByTeamName: r.team_name,
      auctionPrice: r.auction_price,
      purchasedAt: r.purchased_at,
    };
  });
  return result;
}

// dbTx helper если не импортирован из db.js
async function dbTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await fn(client);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}