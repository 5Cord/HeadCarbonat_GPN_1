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

      onTimerState: (data) => {
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

      onTimerExpired: ({ year, phase }) => {
        console.log(`⏰ Timer expired year=${year} phase=${phase}`);
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
        useGameStore.setState(() => ({
          gridCells: { owned, allTeams: cells },
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
      onFullState: ({ timer, cells, auctions, budget }) => {
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

          return {
            globalTimer: newTimer,
            game:        { ...st.game, currentYear: newTimer.currentYear },
            gridCells:   { owned, allTeams },
            auctions:    { ...st.auctions, active: activeAuctions },
            player:      budget != null ? { ...st.player, budget } : st.player,
          };
        });
      },

      onGameOver: () => {
        useGameStore.setState(st => ({ game: { ...st.game, status: 'FINISHED' } }));
      },

      onTeamJoined:  ({ teamName }) => console.log(`🟢 ${teamName} joined`),
      onTeamOffline: ({ teamName }) => console.log(`🔴 ${teamName} offline`),

      onConnect: () => {
        console.log('✅ WS connected — таймер с сервера');

        // ФИКС: явно запрашиваем актуальное состояние после реконнекта.
        // Это гарантирует синхронизацию таймера и ячеек даже если пропустили события
        // пока соединение было разорвано (например, при обновлении страницы).
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

    return () => {
      disconnectSocket();
      connectedRef.current = false;
    };
  // Важно: зависимость от token и sessionId — при обновлении страницы
  // persist восстанавливает их, useEffect запускается заново
  }, [player.token, player.sessionId]);
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
    bids:               a.bids              || [],
    status:             a.status            || 'active',
  };
}