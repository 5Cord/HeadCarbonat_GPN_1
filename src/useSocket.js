// Frontend часть
/**
 * useSocket.js
 *
 * - При монтировании ВСЕГДА пытается подключиться если есть token+sessionId
 *   (включая случай обновления страницы — persist восстановит token из localStorage)
 * - timer:tick с сервера = единственный источник времени в онлайне
 * - При дисконнекте — connectedRef сбрасывается, при реконнекте — восстанавливается
 * - ФИКС: при реконнекте явно запрашиваем full_state у сервера
 */

import { useEffect, useRef } from 'react';
import useGameStore from '../store/gameStore';
import { connectSocket, disconnectSocket, getSocket } from './apiHelpers';
import { normalizeResearchConfig } from './Research/researchData';

// Пустой прогресс ЛУ для восстановления из БД.
const emptyLUProgress = () => ({
  purchasedWorks: [], purchasedWorksByYear: {},
  purchasedCells: {}, purchasedCellsByYear: {},
  mobilizedColumns: [], mobilizedColumnsByYear: {}, columnsByYear: {},
  totalSpent: 0, spentByYear: {},
  successRates: {}, successRatesByYear: {},
  skippedYears: [], completedColumns: [],
});

export default function useSocket() {
  const player       = useGameStore(s => s.player);
  const connectedRef = useRef(false);

  useEffect(() => {
    const { token, sessionId } = player;
    if (!token || !sessionId) return;

    // Не создаём второе соединение если уже есть живое
    if (connectedRef.current) return;
    connectedRef.current = true;

    connectSocket(token, sessionId, {

      // ── Таймер ── ГЛАВНЫЙ источник времени в онлайне ──────────────────────
      onTimerTick: (data) => {
        useGameStore.setState(st => ({
          globalTimer: {
            ...st.globalTimer,
            currentYear:     data.currentYear,
            phase:           data.phase,
            timeRemaining:   data.timeRemaining,
            isRunning:       data.isRunning,
            isPaused:        data.isPaused,
            pendingRefusal:  data.pendingRefusal  ?? false,
            refusalTimeLeft: data.refusalTimeLeft ?? 0,
          },
          game: { ...st.game, currentYear: data.currentYear },
        }));
      },

      onTimerExpired: ({ year, phase }) => {
        console.log(`⏰ [FRONT] timer:expired year=${year} phase=${phase}`);
        // RESEARCH — ResearchPanel шлёт year:ready сам через свой модал
        // RESULTS   — бэк сам двигает год через _autoAdvancePhase
        // REGION_MAP — отдельная логика, не трогаем
        const EMIT_YEAR_READY_PHASES = [];
        if (EMIT_YEAR_READY_PHASES.includes(phase)) {
          console.log(`⏰ [FRONT] emitting year:ready for phase=${phase}`);
          const socket = getSocket();
          if (socket?.connected) {
            socket.emit('year:ready', { year });
          }
        } else {
          console.log(`⏰ [FRONT] NOT emitting year:ready for phase=${phase} (waiting for backend)`);
        }
      },

      onTimerState: (data) => {
        console.log(`🕐 [FRONT] timer:state year=${data.currentYear} phase=${data.phase} t=${data.timeRemaining}`);
        useGameStore.setState(st => ({
          globalTimer: {
            ...st.globalTimer,
            currentYear:     data.currentYear     ?? st.globalTimer.currentYear,
            phase:           data.phase           ?? st.globalTimer.phase,
            timeRemaining:   data.timeRemaining   ?? st.globalTimer.timeRemaining,
            isRunning:       data.isRunning       ?? st.globalTimer.isRunning,
            isPaused:        data.isPaused        ?? st.globalTimer.isPaused,
            pendingRefusal:  data.pendingRefusal  ?? st.globalTimer.pendingRefusal,
            refusalTimeLeft: data.refusalTimeLeft ?? st.globalTimer.refusalTimeLeft,
          },
          game: { ...st.game, currentYear: data.currentYear ?? st.game.currentYear },
        }));
      },

      onYearAdvanced: ({ year }) => {
        console.log(`📅 [FRONT] year:advanced received year=${year}`);
        const { resetEventCardsForNewYear, applyYearTransitionForAllLUs } = useGameStore.getState();
        resetEventCardsForNewYear(year);
        applyYearTransitionForAllLUs(year - 1);
        // После года отказа (3→4, 5→6) идём на карту региона, иначе — на НИРы
        const fromRefusalYear = year === 4 || year === 6;
        useGameStore.setState({
          navigateToResearch: !fromRefusalYear,
          showRegionMapBanner: fromRefusalYear,
          yearEndToast: true,
        });
      },

      // ── Карта ────────────────────────────────────────────────────────────
      onCellsUpdated: (cells) => {
        const myId = useGameStore.getState().player.teamId;
        const owned = {};
        Object.entries(cells || {}).forEach(([ref, cell]) => {
          if (cell.ownedByTeamId === myId) {
            owned[ref] = { ...cell, cellRef: ref, id: ref, name: `Участок ${ref}` };
          }
        });
        useGameStore.setState(st => ({
          gridCells: { owned, allTeams: cells },
          otherTeamsScene: _mergeSceneFromCells(cells, myId, st.otherTeamsScene),
        }));
      },

      // ── Аукционы ─────────────────────────────────────────────────────────
      onAuctionCreated: (auction) => {
        if (!auction) return;
        useGameStore.setState(st => ({
          auctions: {
            ...st.auctions,
            active: { ...st.auctions.active, [auction.cell_ref]: _fmt(auction) },
          },
        }));
      },

      onAuctionUpdated: (auction) => {
        if (!auction) return;
        useGameStore.setState(st => ({
          auctions: {
            ...st.auctions,
            active: { ...st.auctions.active, [auction.cell_ref]: _fmt(auction) },
          },
        }));
      },

      onAuctionBid: ({ cellRef, auction }) => {
        if (!auction) return;
        useGameStore.setState(st => ({
          auctions: {
            ...st.auctions,
            active: { ...st.auctions.active, [cellRef]: _fmt(auction) },
          },
        }));
      },

      onAuctionFinalized: ({ cellRef, winnerId, winnerName, finalBid }) => {
        const myId = useGameStore.getState().player.teamId;
        useGameStore.setState(st => {
          const active    = { ...st.auctions.active };
          const completed = { ...st.auctions.completed, [cellRef]: active[cellRef] };
          delete active[cellRef];
          let owned    = { ...st.gridCells.owned };
          let allTeams = { ...st.gridCells.allTeams };
          if (winnerId === myId) {
            const cellData = {
              id: cellRef, cellRef, name: `Участок ${cellRef}`,
              ownedByTeamId: myId, ownedByTeamName: winnerName,
              auctionPrice: finalBid, purchasedAt: new Date().toISOString(),
            };
            owned[cellRef]    = cellData;
            allTeams[cellRef] = cellData;
          } else {
            delete owned[cellRef];
          }
          return { auctions: { active, completed }, gridCells: { owned, allTeams } };
        });
      },

      onAuctionCancelled: ({ cellRef }) => {
        useGameStore.setState(st => {
          const active = { ...st.auctions.active };
          delete active[cellRef];
          return { auctions: { ...st.auctions, active } };
        });
      },

      // ── Полный стейт при коннекте / реконнекте ───────────────────────────
      onCellsScenariosUpdated: ({ scenarios }) => {
        useGameStore.setState({ cellScenarios: scenarios ?? {} });
      },

      onFullState: ({ timer, cells, auctions, budget, researchRows, eventsRows, fieldWorkRows, resultRows, purchaseRows, scenarios }) => {
        if (scenarios) useGameStore.setState({ cellScenarios: scenarios });
        useGameStore.setState(st => {
          const newTimer = timer ? {
            ...st.globalTimer,
            currentYear:     timer.currentYear,
            phase:           timer.phase,
            timeRemaining:   timer.timeRemaining,
            isRunning:       timer.isRunning,
            isPaused:        timer.isPaused,
            pendingRefusal:  timer.pendingRefusal  ?? false,
            refusalTimeLeft: timer.refusalTimeLeft ?? 0,
          } : st.globalTimer;

          const allTeams = cells || {};
          const myId     = st.player.teamId;
          const owned    = {};
          Object.entries(allTeams).forEach(([ref, cell]) => {
            if (cell.ownedByTeamId === myId) {
              owned[ref] = { ...cell, cellRef: ref, id: ref, name: `Участок ${ref}` };
            }
          });

          const activeAuctions = {};
          (auctions || []).forEach(a => {
            if (a) activeAuctions[a.cell_ref] = _fmt(a);
          });

          // Восстановление НИР из БД (только если localStorage пуст)
          let restoredResearch = st.research;
          if ((researchRows || []).length > 0 && Object.keys(st.research.progressByLU || {}).length === 0) {
            const progressByLU = {};
            for (const row of researchRows) {
              const luId = row.lu_id;
              if (!progressByLU[luId]) {
                progressByLU[luId] = {
                  purchasedWorks: [], purchasedWorksByYear: {},
                  mobilizedColumns: [], mobilizedColumnsByYear: {}, columnsByYear: {},
                  totalSpent: 0, successRates: {}, successRatesByYear: {},
                  skippedYears: [], completedColumns: [],
                  purchasedCells: {}, purchasedCellsByYear: {},
                };
              }
              const prog = progressByLU[luId];
              const yearWorks = Array.isArray(row.purchased_works_json) ? row.purchased_works_json : [];
              prog.purchasedWorksByYear[row.year] = yearWorks;
              prog.purchasedWorks = [...new Set([...prog.purchasedWorks, ...yearWorks])];
              prog.totalSpent += row.total_spent || 0;
              if (row.success_rates_json && typeof row.success_rates_json === 'object') {
                Object.assign(prog.successRates, row.success_rates_json);
              }
              if (row.column_id) {
                if (!prog.mobilizedColumns.includes(row.column_id)) prog.mobilizedColumns.push(row.column_id);
                prog.columnsByYear[row.year] = row.column_id;
              }
              if (row.skipped) prog.skippedYears.push(row.year);
            }
            restoredResearch = { ...st.research, progressByLU };
          } else if ((purchaseRows || []).length > 0 && Object.keys(st.research.progressByLU || {}).length === 0) {
            // Покупки НИР пишутся в research_purchases — собираем прогресс из них.
            // Ключ ячейки таблицы тот же, что при покупке: `${workId}-${mobId}`.
            const works  = normalizeResearchConfig(st.player.sessionConfig?.researchConfig);
            const byId   = Object.fromEntries(works.map(w => [w.id, w]));
            const progressByLU = {};

            for (const row of purchaseRows) {
              const luId = row.lu_id;
              if (!progressByLU[luId]) progressByLU[luId] = emptyLUProgress();
              const prog    = progressByLU[luId];
              const cellKey = `${row.work_id}-${row.mob_id}`;
              const rate    = byId[row.work_id]?.successRates?.[row.mob_id] ?? 0;
              const year    = row.year;
              const cost    = row.cost || 0;

              const rw = {
                id: cellKey,
                name: `${row.work_name} | ${row.mob_name}`,
                baseCost: cost,
                successRates: { [row.mob_id]: rate },
                workType: row.work_id,
                mobilizationType: row.mob_id,
                metadata: { cellKey, workCost: byId[row.work_id]?.cost ?? 0, mobilizationCost: 0, successRate: rate, year },
              };
              const cell = { ...rw, successRate: rate };

              prog.purchasedWorks.push(rw);
              prog.purchasedWorksByYear[year] = [...(prog.purchasedWorksByYear[year] || []), rw];
              prog.purchasedCells[cellKey] = cell;
              prog.purchasedCellsByYear[year] = { ...(prog.purchasedCellsByYear[year] || {}), [cellKey]: cell };
              prog.totalSpent += cost;
              prog.spentByYear[year] = (prog.spentByYear[year] || 0) + cost;

              const acc = Math.min((prog.successRates[row.mob_id] || 0) + rate, 95);
              prog.successRates[row.mob_id] = acc;
              prog.successRatesByYear[year] = { ...(prog.successRatesByYear[year] || {}), [row.mob_id]: acc };

              if (!prog.mobilizedColumns.includes(row.mob_id)) prog.mobilizedColumns.push(row.mob_id);
              if (!(prog.mobilizedColumnsByYear[year] || []).includes(row.mob_id)) {
                prog.mobilizedColumnsByYear[year] = [...(prog.mobilizedColumnsByYear[year] || []), row.mob_id];
              }
              prog.columnsByYear[year] = row.mob_id;
            }
            restoredResearch = { ...st.research, progressByLU };
          }

          // Восстановление событий из БД (только если localStorage пуст)
          let restoredEvents = st.events;
          if ((eventsRows || []).length > 0 && Object.keys(st.events.lineScores || {}).length === 0) {
            const lineScores = {};
            const historyByYear = {};
            const linesByLU = {};
            const lineYear = {};   // линия по ЛУ берётся за самый поздний год
            for (const row of eventsRows) {
              if (row.score != null) lineScores[row.lu_id] = (lineScores[row.lu_id] || 0) + row.score;
              if (!historyByYear[row.year]) historyByYear[row.year] = { lineScores: {} };
              historyByYear[row.year].lineScores[row.lu_id] = row.score || 0;

              const line = row.line_json;
              if (line && typeof line === 'object' && Object.keys(line).length > 0
                  && row.year >= (lineYear[row.lu_id] ?? -Infinity)) {
                linesByLU[row.lu_id] = line;
                lineYear[row.lu_id]  = row.year;
              }
            }
            restoredEvents = { ...st.events, lineScores, historyByYear, linesByLU };
          }

          // Восстановление полевых работ из БД (только если localStorage пуст)
          let restoredFieldWork = st.fieldWork;
          if ((fieldWorkRows || []).length > 0 && Object.keys(st.fieldWork.selectionsByLU || {}).length === 0) {
            const selectionsByLU = {};
            for (const row of fieldWorkRows) {
              const luId = row.lu_id;
              if (!selectionsByLU[luId]) {
                selectionsByLU[luId] = { selectionsByYear: {}, metaByYear: {}, totalCost: 0 };
              }
              const lu = selectionsByLU[luId];
              const rawSels = (row.selections_raw_json && typeof row.selections_raw_json === 'object')
                ? row.selections_raw_json
                : {};
              lu.selectionsByYear[row.year] = rawSels;
              lu.metaByYear[row.year] = {
                avgRank:      row.avg_rank,
                totalCost:    row.total_cost,
                qualityScore: row.quality_score,
              };
              lu.totalCost += row.total_cost || 0;
            }
            restoredFieldWork = { ...st.fieldWork, selectionsByLU };
          }

          // Восстановление карточек итогов из БД (только если localStorage пуст)
          let restoredResults = st.results;
          if ((resultRows || []).length > 0 && Object.keys(st.results.cardsByLU || {}).length === 0) {
            const cardsByLU = {};
            for (const row of resultRows) {
              if (row.card_json && typeof row.card_json === 'object') cardsByLU[row.lu_id] = row.card_json;
            }
            restoredResults = {
              ...st.results,
              cardsByLU,
              finalScore: Object.values(cardsByLU).reduce((s, c) => s + (c.roi || 0), 0),
            };
          }

          return {
            globalTimer: newTimer,
            game:        { ...st.game, currentYear: newTimer.currentYear },
            gridCells:   { owned, allTeams },
            auctions:    { ...st.auctions, active: activeAuctions },
            player:      budget != null ? { ...st.player, budget } : st.player,
            research:    restoredResearch,
            events:      restoredEvents,
            fieldWork:   restoredFieldWork,
            results:     restoredResults,
            otherTeamsScene: _mergeSceneFromCells(allTeams, myId, st.otherTeamsScene),
          };
        });
      },

      onBudgetUpdated: ({ budget }) => {
        if (budget == null) return;
        useGameStore.setState(st => ({ player: { ...st.player, budget } }));
      },

      onGameOver: () => {
        useGameStore.setState(st => ({ game: { ...st.game, status: 'FINISHED' } }));
      },

      onFieldworkTeamUpdate: ({ teamId, cellRef, year, avgRank, mobWorkId }) => {
        useGameStore.setState(st => {
          const prev = st.otherTeamsScene[cellRef] || { metaByYear: {}, evScoreByYear: {} };
          return {
            otherTeamsScene: {
              ...st.otherTeamsScene,
              [cellRef]: {
                ...prev,
                metaByYear: {
                  ...prev.metaByYear,
                  [year]: { ...(prev.metaByYear[year] || {}), avgRank, ...(mobWorkId ? { mobWorkId } : {}) },
                },
              },
            },
          };
        });
      },

      onEventsTeamUpdate: ({ teamId, cellRef, year, evScore }) => {
        useGameStore.setState(st => {
          const prev = st.otherTeamsScene[cellRef] || { metaByYear: {}, evScoreByYear: {} };
          return {
            otherTeamsScene: {
              ...st.otherTeamsScene,
              [cellRef]: {
                ...prev,
                evScoreByYear: {
                  ...prev.evScoreByYear,
                  [year]: evScore,
                },
              },
            },
          };
        });
      },

      onTeamJoined:  ({ teamName }) => console.log(`🟢 ${teamName} joined`),
      onTeamOffline: ({ teamName }) => console.log(`🔴 ${teamName} offline`),

      onConnect: () => {
        console.log('✅ WS connected — таймер с сервера');
        const socket = getSocket();
        if (socket) {
          socket.emit('request_full_state');
        }
      },

      onDisconnect: () => {
        connectedRef.current = false;
        console.log('🔴 WS disconnected — fallback на локальный таймер');
      },
    });

    // При возврате на вкладку — переподключаемся если сокет упал
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const socket = getSocket();
      if (!socket) return;
      if (!socket.connected) {
        console.log('👁 Tab visible — reconnecting socket');
        socket.connect();
      } else {
        // Сокет жив — всё равно синхронизируем состояние
        socket.emit('request_full_state');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disconnectSocket();
      connectedRef.current = false;
    };
  // Важно: зависимость от token и sessionId — при обновлении страницы
  // persist восстанавливает их, useEffect запускается заново
  }, [player.token, player.sessionId]);
}

// Извлекает fieldworkByYear из данных ячеек других команд
// и мёржит в текущий otherTeamsScene, не затирая данные от fieldwork:team_update
function _mergeSceneFromCells(cells, myId, prevScene) {
  const next = { ...prevScene };
  Object.entries(cells || {}).forEach(([ref, cell]) => {
    if (!cell?.ownedByTeamId || cell.ownedByTeamId === myId) return;
    if (!cell.fieldworkByYear || !Object.keys(cell.fieldworkByYear).length) return;
    const prev = next[ref] || { metaByYear: {}, evScoreByYear: {} };
    next[ref] = {
      ...prev,
      metaByYear: { ...cell.fieldworkByYear, ...prev.metaByYear },
    };
  });
  return next;
}

function _fmt(a) {
  if (!a) return null;
  return {
    cellRef:            a.cell_ref          ?? a.cellRef,
    cellName:           a.cell_name         ?? a.cellName ?? `Участок ${a.cell_ref ?? a.cellRef}`,
    currentBid:         a.current_bid       ?? a.currentBid,
    currentBidTeamId:   a.leading_team_id   ?? a.currentBidTeamId,
    currentBidTeamName: a.leading_team_name ?? a.currentBidTeamName,
    startPrice:         a.start_price       ?? a.startPrice,
    participants:       a.participants      || [],
    bids:               (a.bids || []).map(b => ({
      teamId: b.team_id ?? b.teamId,
      teamName: b.team_name ?? b.teamName,
      amount: Number(b.amount),
      at: b.placed_at ?? b.at,
    })),
    participantDetails: (a.participantDetails || []).map(p => ({
      teamId: p.team_id ?? p.teamId,
      teamName: p.team_name ?? p.teamName,
    })),
    status:             a.status            || 'active',
  };
}
