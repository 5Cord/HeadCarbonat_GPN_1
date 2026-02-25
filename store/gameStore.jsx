// store/gameStore.js
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ========== ЭКСПОРТИРУЕМЫЕ КОНСТАНТЫ ==========
export const BUDGET_CONFIG = {
  STUDENT: 99999,
  PROFESSIONAL: 100,
};

// Начальная цена аукциона при конфликте за ячейку
export const AUCTION_START_PRICE = 50; // млн руб.

/**
 * Главный store игры.
 *
 * Структура купленных ячеек сетки (gridCells):
 *   owned    — ячейки ТЕКУЩЕЙ команды: { cellRef -> CellData }
 *   allTeams — все ячейки всех команд:  { cellRef -> CellData }
 *   (allTeams будет синхронизироваться с backend; сейчас симулируется локально)
 *
 * CellData: { id, cellRef, name, ownedByTeamId, ownedByTeamName, purchasedAt, auctionPrice? }
 *
 * Структура аукциона (auctions.active):
 *   { cellRef -> { cellRef, cellName, currentBid, currentBidTeamId, currentBidTeamName,
 *                  startPrice, bids: [{ teamId, teamName, amount, at }] } }
 *
 * licenseUnits.owned — купленные КАРТОЧКИ ИНФОРМАЦИИ (старая логика, сохранена)
 * licenseUnits.current — текущий ЛУ для НИР (из gridCells.owned, не из карточек!)
 */
const useGameStore = create(
  devtools(
    persist(
      (set, get) => ({

        // ── СОСТОЯНИЕ ИГРЫ ──────────────────────────────────────────────────
        game: {
          id: null,
          status: 'SETUP',           // SETUP | IN_PROGRESS | FINISHED
          currentRound: 1,
          currentPhase: 'LOBBY',     // LOBBY | REGION_MAP | RESEARCH | EVENTS | FIELD_WORK | RESULTS
          currentLUProgress: {},
          createdAt: null,
          currentYear: 1,            // 1–10
        },

        // ── ИГРОК / КОМАНДА ─────────────────────────────────────────────────
        player: {
          id: null,
          name: '',
          teamId: null,              // уникальный id команды (для онлайн-режима)
          budget: 1000,
          initialBudget: 1000,
          experienceLevel: 'student',
          totalScore: 0,
          teamMembers: [],
        },

        // ── КАРТОЧКИ ИНФОРМАЦИИ (покупка на карте — старая логика) ──────────
        licenseUnits: {
          available: [],
          owned: [],                 // купленные карточки информации
          current: null,            // текущий ЛУ для НИР (из gridCells.owned)
        },

        // ── КУПЛЕННЫЕ ЯЧЕЙКИ СЕТКИ ──────────────────────────────────────────
        gridCells: {
          owned: {},                 // { cellRef -> CellData } — ячейки текущей команды
          allTeams: {},              // { cellRef -> CellData } — все команды (sync с backend)
        },

        // ── АУКЦИОНЫ ────────────────────────────────────────────────────────
        auctions: {
          active: {},               // { cellRef -> AuctionData }
          completed: {},            // { cellRef -> AuctionData }
        },

        // ── КАРТА РЕГИОНА ────────────────────────────────────────────────────
        regionMap: {
          cells: [],
          resourceDensityRevealed: false,
        },

        // ── НАУЧНЫЕ ИССЛЕДОВАНИЯ ─────────────────────────────────────────────
        research: {
          availableWorks: [],
          progressByLU: {},
          // { luId: { purchasedWorks[], totalSpent, successRates{}, purchasedCells{}, mobilizedColumns[] } }
        },

        // ── СОБЫТИЯ ──────────────────────────────────────────────────────────
        events: {
          linesByLU: {},
          revealedCards: {},
          lineScores: {},
          skippedLines: {},
          completed: false,
        },

        // ── ПОЛЕВЫЕ РАБОТЫ ───────────────────────────────────────────────────
        fieldWork: {
          availableOptions: [],
          selectionsByLU: {},
        },

        // ── РЕЗУЛЬТАТЫ ───────────────────────────────────────────────────────
        results: {
          cardsByLU: {},
          finalScore: 0,
        },

        // ════════════════════════════════════════════════════════════════════
        //  ДЕЙСТВИЯ
        // ════════════════════════════════════════════════════════════════════

        // ── Год ─────────────────────────────────────────────────────────────
        setYear: (year) => set({ game: { ...get().game, currentYear: year } }),

        nextYear: () => {
          const y = get().game.currentYear;
          if (y < 10) set({ game: { ...get().game, currentYear: y + 1 } });
        },

        // ── Инициализация игры ───────────────────────────────────────────────
        initializeGame: (gameData) => {
          set({
            game: { ...get().game, id: gameData.id, status: 'IN_PROGRESS', createdAt: new Date().toISOString() },
            licenseUnits: { ...get().licenseUnits, available: gameData.availableLU },
            regionMap: { cells: gameData.regionMap.cells, resourceDensityRevealed: false },
            research: { ...get().research, availableWorks: gameData.researchWorks },
            fieldWork: { ...get().fieldWork, availableOptions: gameData.fieldWorkOptions },
          });
        },

        // ── Настройка команды ────────────────────────────────────────────────
        setTeam: (teamData) => {
          const budget = teamData.experienceLevel === 'student'
            ? BUDGET_CONFIG.STUDENT
            : BUDGET_CONFIG.PROFESSIONAL;
          set({
            player: {
              ...get().player,
              name: teamData.name,
              teamId: teamData.teamId || teamData.name,
              teamMembers: teamData.members,
              experienceLevel: teamData.experienceLevel,
              budget,
              initialBudget: budget,
            },
          });
        },

        // ════════════════════════════════════════════════════════════════════
        //  ПОКУПКА ЯЧЕЕК СЕТКИ
        // ════════════════════════════════════════════════════════════════════

        /**
         * Купить ячейку сетки (бесплатно, если свободна).
         * Возвращает: 'ok' | 'limit' | 'already_owned' | 'auction'
         *
         * Аукцион запускается когда ячейка уже занята другой командой.
         */
        purchaseGridCell: (cellRef, cellName) => {
          const { gridCells, player, auctions } = get();
          const ownedCount = Object.keys(gridCells.owned).length;

          if (ownedCount >= 5) return 'limit';
          if (gridCells.owned[cellRef]) return 'already_owned';

          // Проверяем, принадлежит ли ячейка другой команде
          const existing = gridCells.allTeams[cellRef];

          // Ячейка занята другой командой?
          if (existing && existing.ownedByTeamId && existing.ownedByTeamId !== player.teamId) {
            // Проверяем, не открыт ли уже аукцион
            if (!auctions.active[cellRef]) {
              // Открываем новый аукцион
              set({
                auctions: {
                  ...get().auctions,
                  active: {
                    ...get().auctions.active,
                    [cellRef]: {
                      cellRef,
                      cellName,
                      currentBid: AUCTION_START_PRICE,
                      currentBidTeamId: existing.ownedByTeamId,
                      currentBidTeamName: existing.ownedByTeamName,
                      startPrice: AUCTION_START_PRICE,
                      bids: [{
                        teamId: existing.ownedByTeamId,
                        teamName: existing.ownedByTeamName,
                        amount: AUCTION_START_PRICE,
                        at: existing.purchasedAt,
                      }],
                    },
                  },
                },
              });
            }
            return 'auction';
          }

          // Проверяем, есть ли активный аукцион на эту ячейку
          if (auctions.active[cellRef]) {
            return 'auction';
          }

          // Свободна — берём бесплатно
          const cellData = {
            id: cellRef,
            cellRef,
            name: cellName,
            ownedByTeamId: player.teamId || player.name,
            ownedByTeamName: player.name,
            purchasedAt: new Date().toISOString(),
          };

          const newOwned = { ...gridCells.owned, [cellRef]: cellData };
          const newAllTeams = { ...gridCells.allTeams, [cellRef]: cellData };

          // Первая ячейка становится current для НИР
          const newCurrent = get().licenseUnits.current || cellData;

          set({
            gridCells: { owned: newOwned, allTeams: newAllTeams },
            licenseUnits: { ...get().licenseUnits, current: newCurrent },
          });
          return 'ok';
        },

        // Снять выбор ячейки (вернуть)
        unpurchaseGridCell: (cellRef) => {
          const { gridCells } = get();
          if (!gridCells.owned[cellRef]) return false;

          const newOwned = { ...gridCells.owned };
          const newAllTeams = { ...gridCells.allTeams };
          delete newOwned[cellRef];
          delete newAllTeams[cellRef];

          const remaining = Object.values(newOwned);
          const currentLU = get().licenseUnits.current;
          const newCurrent = currentLU?.cellRef === cellRef
            ? (remaining[0] || null)
            : currentLU;

          set({
            gridCells: { owned: newOwned, allTeams: newAllTeams },
            licenseUnits: { ...get().licenseUnits, current: newCurrent },
          });
          return true;
        },

        // ── АУКЦИОН ──────────────────────────────────────────────────────────

        // Сделать ставку
        placeBid: (cellRef, amount) => {
          const { auctions, player } = get();
          const auction = auctions.active[cellRef];
          if (!auction) return false;
          if (amount <= auction.currentBid) return false;
          if (player.budget < amount) return false;

          const myId = player.teamId || player.name;

          set({
            auctions: {
              ...get().auctions,
              active: {
                ...get().auctions.active,
                [cellRef]: {
                  ...auction,
                  currentBid: amount,
                  currentBidTeamId: myId,
                  currentBidTeamName: player.name,
                  bids: [
                    ...auction.bids,
                    { teamId: player.teamId, teamName: player.name, amount, at: new Date().toISOString() },
                  ],
                },
              },
            },
          });
          return true;
        },

        // Завершить аукцион: победитель платит и получает ячейку
        finalizeAuction: (cellRef) => {
          const { auctions, player, gridCells } = get();
          const auction = auctions.active[cellRef];
          if (!auction) return false;

          // Сравниваем по teamId с фолбэком на name (на случай если teamId не задан)
          const myId = player.teamId || player.name;
          const weWon = auction.currentBidTeamId === myId ||
            auction.currentBidTeamName === player.name;

          const active = { ...auctions.active };
          delete active[cellRef];

          if (weWon) {
            // Проверяем, хватает ли бюджета
            if (player.budget < auction.currentBid) return false;

            // Создаем данные ячейки для победителя
            const cellData = {
              id: cellRef,
              cellRef,
              name: auction.cellName,
              ownedByTeamId: myId,
              ownedByTeamName: player.name,
              purchasedAt: new Date().toISOString(),
              auctionPrice: auction.currentBid,
            };

            // Обновляем allTeams - перезаписываем ячейку за победителем
            const newAllTeams = { ...gridCells.allTeams, [cellRef]: cellData };

            // Обновляем owned - добавляем ячейку в список владения текущего игрока
            const newOwned = { ...gridCells.owned, [cellRef]: cellData };

            set({
              player: { ...get().player, budget: player.budget - auction.currentBid },
              gridCells: {
                owned: newOwned,
                allTeams: newAllTeams,
              },
              auctions: {
                active,
                completed: { ...auctions.completed, [cellRef]: { ...auction, winner: myId } },
              },
              licenseUnits: {
                ...get().licenseUnits,
                current: get().licenseUnits.current || cellData,
              },
            });
          } else {
            // Если не выиграли, просто переносим аукцион в завершенные
            set({
              auctions: {
                active,
                completed: { ...auctions.completed, [cellRef]: auction }
              }
            });
          }
          return true;
        },

        // DEV: симулировать, что другая команда уже владеет ячейкой
        simulateOtherTeamOwns: (cellRef, cellName) => {
          const cellData = {
            id: cellRef,
            cellRef,
            name: cellName,
            ownedByTeamId: 'other_team_' + Date.now(), // Уникальный ID для разных симуляций
            ownedByTeamName: 'Другая команда',
            purchasedAt: new Date().toISOString(),
          };

          // Убедимся, что ячейка не принадлежит текущему игроку
          const { gridCells, player } = get();
          const myId = player.teamId || player.name;

          // Удаляем ячейку из owned текущего игрока, если она там была
          const newOwned = { ...gridCells.owned };
          if (newOwned[cellRef] && newOwned[cellRef].ownedByTeamId === myId) {
            delete newOwned[cellRef];
          }

          set({
            gridCells: {
              owned: newOwned,
              allTeams: { ...gridCells.allTeams, [cellRef]: cellData },
            },
          });
        },

        // ════════════════════════════════════════════════════════════════════
        //  КАРТОЧКИ ИНФОРМАЦИИ (старая логика — сохранена полностью)
        // ════════════════════════════════════════════════════════════════════

        purchaseLU: (lu) => {
          const budget = get().player.budget;
          if (budget < lu.cost) return false;
          set({
            player: { ...get().player, budget: budget - lu.cost },
            licenseUnits: {
              ...get().licenseUnits,
              available: get().licenseUnits.available.filter(l => l.id !== lu.id),
              owned: [...get().licenseUnits.owned, lu],
            },
          });
          return true;
        },

        unpurchaseLU: (luId) => {
          const lu = get().licenseUnits.owned.find(l => l.id === luId);
          if (!lu) return false;
          set({
            player: { ...get().player, budget: get().player.budget + lu.cost },
            licenseUnits: {
              ...get().licenseUnits,
              available: [...get().licenseUnits.available, lu],
              owned: get().licenseUnits.owned.filter(l => l.id !== luId),
            },
          });
          return true;
        },

        // ── Фазы / раунды ────────────────────────────────────────────────────
        nextPhase: () => {
          const phases = ['REGION_MAP', 'RESEARCH', 'EVENTS', 'FIELD_WORK', 'RESULTS'];
          const idx = phases.indexOf(get().game.currentPhase);
          if (idx < phases.length - 1) {
            set({ game: { ...get().game, currentPhase: phases[idx + 1] } });
          } else {
            get().nextLU();
          }
        },

        nextLU: () => {
          const cells = Object.values(get().gridCells.owned);
          const current = get().licenseUnits.current;
          const idx = cells.findIndex(c => c.cellRef === current?.cellRef);
          if (idx < cells.length - 1) {
            const nextYear = Math.min(get().game.currentYear + 1, 10);
            set({
              licenseUnits: { ...get().licenseUnits, current: cells[idx + 1] },
              game: {
                ...get().game,
                currentPhase: 'REGION_MAP',
                currentRound: get().game.currentRound + 1,
                currentYear: nextYear,
              },
            });
          } else {
            get().finishGame();
          }
        },

        // ── НИР ─────────────────────────────────────────────────────────────
        purchaseResearch: (luId, researchWork) => {
          const budget = get().player.budget;
          if (budget < researchWork.baseCost) return false;

          const cur = get().research.progressByLU[luId] || {
            purchasedWorks: [], totalSpent: 0, successRates: {}, purchasedCells: {}, mobilizedColumns: [],
          };

          const rates = { ...cur.successRates };
          Object.keys(researchWork.successRates).forEach(wt => {
            rates[wt] = Math.min((rates[wt] || 0) + researchWork.successRates[wt], 95);
          });

          const mobCols = [...(cur.mobilizedColumns || [])];
          if (researchWork.mobilizationType && !mobCols.includes(researchWork.mobilizationType)) {
            mobCols.push(researchWork.mobilizationType);
          }

          const updated = {
            purchasedWorks: [...cur.purchasedWorks, researchWork],
            totalSpent: cur.totalSpent + researchWork.baseCost,
            successRates: rates,
            purchasedCells: { ...(cur.purchasedCells || {}), [researchWork.metadata?.cellKey || researchWork.id]: researchWork },
            mobilizedColumns: mobCols,
          };

          set({
            player: { ...get().player, budget: budget - researchWork.baseCost },
            research: { ...get().research, progressByLU: { ...get().research.progressByLU, [luId]: updated } },
          });
          return true;
        },

        // ── События ──────────────────────────────────────────────────────────
        updateEventLine: (luId, d) => set({ events: { ...get().events, linesByLU: { ...get().events.linesByLU, [luId]: d } } }),
        saveEventLine: (luId, d) => set({ events: { ...get().events, linesByLU: { ...get().events.linesByLU, [luId]: d } } }),
        revealEventCard: (luId, k, d) => set({ events: { ...get().events, revealedCards: { ...get().events.revealedCards, [luId]: { ...(get().events.revealedCards[luId] || {}), [k]: d } } } }),
        updateEventLineScore: (luId, p) => set({ events: { ...get().events, lineScores: { ...get().events.lineScores, [luId]: (get().events.lineScores[luId] || 0) + p } } }),
        skipEventLine: (luId) => set({ events: { ...get().events, skippedLines: { ...get().events.skippedLines, [luId]: [...(get().events.skippedLines[luId] || []), Date.now()] } } }),
        completeEvents: () => set({ events: { ...get().events, completed: true } }),

        // ── Полевые работы ───────────────────────────────────────────────────
        selectFieldWork: (luId, d) => {
          set({ fieldWork: { ...get().fieldWork, selectionsByLU: { ...get().fieldWork.selectionsByLU, [luId]: d } } });
          return true;
        },

        selectFieldWorkWithBudget: (luId, options, totalCost, qualityScore) => {
          const budget = get().player.budget;
          if (budget < totalCost) return false;
          set({
            player: { ...get().player, budget: budget - totalCost },
            fieldWork: { ...get().fieldWork, selectionsByLU: { ...get().fieldWork.selectionsByLU, [luId]: { selectedOptions: options, totalCost, qualityScore } } },
          });
          return true;
        },

        // ── Результаты ───────────────────────────────────────────────────────
        saveResult: (luId, card) => set({ results: { ...get().results, cardsByLU: { ...get().results.cardsByLU, [luId]: card } } }),

        // ── Запуск / финиш / сброс ───────────────────────────────────────────
        startGame: (gameData) => {
          const cells = Object.values(get().gridCells.owned);
          const firstCell = cells[0] || null;
          set({
            game: { ...get().game, status: 'IN_PROGRESS', currentPhase: 'REGION_MAP', currentRound: 1, currentYear: 1 },
            licenseUnits: { ...get().licenseUnits, current: firstCell },
            regionMap: gameData.regionMap || get().regionMap,
            research: { ...get().research, availableWorks: gameData.researchWorks || [] },
            fieldWork: { ...get().fieldWork, availableOptions: gameData.fieldWorkOptions || [] },
          });
        },

        finishGame: () => {
          const score = Object.values(get().results.cardsByLU).reduce((s, c) => s + (c.roi || 0), 0);
          set({ game: { ...get().game, status: 'FINISHED', currentPhase: 'RESULTS' }, results: { ...get().results, finalScore: score } });
        },

        resetGame: () => set({
          game: { id: null, status: 'SETUP', currentRound: 1, currentPhase: 'LOBBY', currentLUProgress: {}, createdAt: null, currentYear: 1 },
          player: { id: null, name: '', teamId: null, budget: 1000, initialBudget: 1000, experienceLevel: 'student', totalScore: 0, teamMembers: [] },
          licenseUnits: { available: [], owned: [], current: null },
          gridCells: { owned: {}, allTeams: {} },
          auctions: { active: {}, completed: {} },
          regionMap: { cells: [], resourceDensityRevealed: false },
          research: { availableWorks: [], progressByLU: {} },
          events: { linesByLU: {}, revealedCards: {}, lineScores: {}, skippedLines: {}, completed: false },
          fieldWork: { availableOptions: [], selectionsByLU: {} },
          results: { cardsByLU: {}, finalScore: 0 },
        }),

        // ════════════════════════════════════════════════════════════════════
        //  ГЕТТЕРЫ
        // ════════════════════════════════════════════════════════════════════

        getCurrentLU: () => get().licenseUnits.current,

        // Список ЛУ для НИР — из купленных ячеек сетки (НЕ из карточек)
        getOwnedGridCellsAsLU: () =>
          Object.values(get().gridCells.owned).map(cell => ({
            id: cell.cellRef,
            cellRef: cell.cellRef,
            name: cell.name || `Участок ${cell.cellRef}`,
            ownedByTeamId: cell.ownedByTeamId,
            ownedByTeamName: cell.ownedByTeamName,
            auctionPrice: cell.auctionPrice || 0,
          })),

        getCurrentResearchProgress: () => {
          const lu = get().licenseUnits.current;
          if (!lu) return null;
          return get().research.progressByLU[lu.id || lu.cellRef] || null;
        },

        getCurrentEventLine: () => {
          const lu = get().licenseUnits.current;
          if (!lu) return null;
          return get().events.linesByLU[lu.id || lu.cellRef] || null;
        },

        getCurrentFieldWorkSelection: () => {
          const lu = get().licenseUnits.current;
          if (!lu) return null;
          return get().fieldWork.selectionsByLU[lu.id || lu.cellRef] || null;
        },

        getCurrentResult: () => {
          const lu = get().licenseUnits.current;
          if (!lu) return null;
          return get().results.cardsByLU[lu.id || lu.cellRef] || null;
        },

        getEventDataForLU: (luId) => ({
          line: get().events.linesByLU[luId],
          revealedCards: get().events.revealedCards[luId] || {},
          score: get().events.lineScores[luId] || 0,
          skipped: get().events.skippedLines[luId] || [],
          completed: get().events.completed,
        }),

        getCurrentEventData: () => {
          const lu = get().licenseUnits.current;
          if (!lu) return null;
          return get().getEventDataForLU(lu.id || lu.cellRef);
        },
      }),
      {
        name: 'geology-game-storage',
        partialize: (state) => ({
          game: state.game,
          player: state.player,
          licenseUnits: state.licenseUnits,
          gridCells: state.gridCells,
          auctions: state.auctions,
          research: state.research,
          events: state.events,
          fieldWork: state.fieldWork,
          results: state.results,
        }),
      }
    )
  )
);

export default useGameStore;