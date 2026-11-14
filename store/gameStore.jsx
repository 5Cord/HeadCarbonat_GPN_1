// Frontend часть
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export const BUDGET_CONFIG = {
  STUDENT: 99999,
  PROFESSIONAL: 99999,
};

export const AUCTION_START_PRICE = 50;

export const PHASE_DURATIONS = {
  REGION_MAP_SELECTION: 20 * 60,
  REGION_MAP_AUCTION: 5 * 60,
  REGION_MAP_POST_AUCTION: 2 * 60,
  RESEARCH: 10 * 60,
  EVENTS: 15 * 60,
  FIELD_WORK: 15 * 60,
};

export const YEAR_DURATIONS = {
  1: 25 * 60,
  2: 20 * 60,
  3: 15 * 60,
  4: 15 * 60,
  5: 10 * 60,
  6: 15 * 60,
  7: 15 * 60,
  8: 15 * 60,
  9: 10 * 60,
  10: 10 * 60,
};

export const REGION_MAP_DURATION = 20 * 60;

const defaultLUProgress = {
  purchasedWorks: [],
  purchasedWorksByYear: {},
  purchasedCells: {},
  purchasedCellsByYear: {},
  totalSpent: 0,
  successRates: {},
  successRatesByYear: {},
  mobilizedColumns: [],
  mobilizedColumnsByYear: {},
  columnsByYear: {},
  skippedYears: [],
  completedColumns: [],
};

const defaultSessionConfig = {
  sessionId: null,
  gameMode: 'online',
  playerType: 'students',
  budget: 99999,
  timers: {},
  regionMapTimer: 20,
  regionMapTimers: {
    selection: 20,
    auction: 2,
    postAuction: 2,
  },
  maxLUsPerTeam: 5,
  researchConfig: null,
};

const defaultPlayer = {
  id: null,
  name: '',
  teamId: null,
  budget: 1000,
  token: null,
  sessionId: null,
  initialBudget: 1000,
  experienceLevel: 'student',
  totalScore: 0,
  teamMembers: [],
  sessionConfig: { ...defaultSessionConfig },
};

const useGameStore = create(
  devtools(
    persist(
      (set, get) => ({

        game: {
          id: null,
          status: 'SETUP',
          currentRound: 1,
          currentPhase: 'LOBBY',
          currentLUProgress: {},
          createdAt: null,
          currentYear: 1,
          // ── Текущий экран — сохраняется при обновлении страницы ──────────
          // Значения: null | 'region_map' | 'research' | 'events' | 'field_work' | 'results'
          // null = пользователь ещё не вошёл в игру (лобби/меню)
          currentScreen: null,
        },

        globalTimer: {
          currentYear: 1,
          timeRemaining: YEAR_DURATIONS[1],
          isRunning: false,
          isPaused: false,
          pendingRefusal: false,
          refusalYear: null,
          refusalTimeLeft: 0,
          phase: 'RESEARCH',
          yearDurations: { ...YEAR_DURATIONS },
          regionMapDuration: REGION_MAP_DURATION,
        },

        player: { ...defaultPlayer },

        licenseUnits: {
          available: [],
          owned: [],
          current: null,
        },

        gridCells: {
          owned: {},
          allTeams: {},
        },

        auctions: {
          active: {},
          completed: {},
        },

        regionMap: {
          cells: [],
          resourceDensityRevealed: false,
        },

        research: {
          availableWorks: [],
          progressByLU: {},
          yearTransitionApplied: false,
        },

        events: {
          linesByLU: {},
          revealedCards: {},
          lineScores: {},
          skippedLines: {},
          historyByYear: {},
          isCompleted: false,
          yearScores: {},
          yearlyStats: {},
          totalMoneySpent: 0,
          moneySpentByYear: {},
          sessionUsedCardIds: [],
          sessionUsedTopics: {},
        },

        statistics: {
          yearlyData: {},
        },

        fieldWork: {
          availableOptions: [],
          selectionsByLU: {},
          totalSpent: 0,
          totalSpentByYear: {},
        },

        // Данные других команд для отображения картинок сценариев на карте
        // { [cellRef]: { metaByYear: { [year]: { avgRank } }, evScoreByYear: { [year]: evScore } } }
        otherTeamsScene: {},

        // Раскрытые случайные сценарии свободных ячеек карты
        // { [cellRef]: { workId: string, openedInYear: number } }
        cellScenarios: {},
        // До какого года включительно уже обработали сценарии (защита от повторной генерации)
        cellScenariosProcessedYear: 0,

        results: {
          cardsByLU: {},
          finalScore: 0,
        },

        navigateToResearch: false,
        navigateToRefusal: false,
        triggerRefusal: false,
        showRegionMapBanner: false,
        yearEndToast: false,

        // ── Текущий экран ─────────────────────────────────────────────────
        // Вызывать при каждом переходе между экранами:
        //   useGameStore.getState().setCurrentScreen('research')
        // При монтировании GameBoard:
        //   const saved = useGameStore.getState().game.currentScreen
        //   const [screen, setScreen] = useState(saved || 'region_map')
        setCurrentScreen: (screen) => {
          set((state) => ({
            game: { ...state.game, currentScreen: screen },
          }));
        },

        setNavigateToResearch: (value) => set({ navigateToResearch: value }),
        setNavigateToRefusal: (value) => set({ navigateToRefusal: value }),
        setTriggerRefusal: (value) => set({ triggerRefusal: value }),
        setShowRegionMapBanner: (value) => set({ showRegionMapBanner: value }),
        setYearEndToast: (value) => set({ yearEndToast: value }),

        // ── Таймер: методы ────────────────────────────────────────────────────

        startGlobalTimer: () => {
          set((state) => ({
            globalTimer: { ...state.globalTimer, isRunning: true, isPaused: false },
          }));
        },

        stopGlobalTimer: () => {
          set((state) => ({
            globalTimer: { ...state.globalTimer, isRunning: false },
          }));
        },

        pauseGlobalTimer: () => {
          set((state) => ({
            globalTimer: { ...state.globalTimer, isPaused: true },
          }));
        },

        resumeGlobalTimer: () => {
          set((state) => ({
            globalTimer: { ...state.globalTimer, isPaused: false },
          }));
        },

        tickGlobalTimer: () => {
          const { globalTimer } = get();
          if (!globalTimer.isRunning || globalTimer.isPaused) return;

          if (globalTimer.pendingRefusal) {
            if (globalTimer.refusalTimeLeft <= 1) {
              set((state) => ({
                globalTimer: { ...state.globalTimer, refusalTimeLeft: 0 },
              }));
              return;
            }
            set((state) => ({
              globalTimer: {
                ...state.globalTimer,
                refusalTimeLeft: state.globalTimer.refusalTimeLeft - 1,
              },
            }));
            return;
          }

          if (globalTimer.timeRemaining <= 1) {
            set((state) => ({
              globalTimer: { ...state.globalTimer, timeRemaining: 0, isRunning: false },
            }));
            return;
          }

          set((state) => ({
            globalTimer: {
              ...state.globalTimer,
              timeRemaining: state.globalTimer.timeRemaining - 1,
            },
          }));
        },

        setSessionTimers: (yearTimers, regionMapTimer) => {
          const yearDurations = {};
          Object.entries(yearTimers || {}).forEach(([y, mins]) => {
            yearDurations[Number(y)] = Number(mins) * 60;
          });
          const regionMapDuration = regionMapTimer
            ? Number(regionMapTimer) * 60
            : REGION_MAP_DURATION;

          const year = get().globalTimer.currentYear;
          const phase = get().globalTimer.phase;

          const timeRemaining = phase === 'REGION_MAP'
            ? regionMapDuration
            : (yearDurations[year] ?? YEAR_DURATIONS[year]);

          set((state) => ({
            globalTimer: {
              ...state.globalTimer,
              yearDurations,
              regionMapDuration,
              timeRemaining,
            },
          }));
        },

        setGlobalPhase: (phase) => {
          set((state) => {
            if (state.globalTimer.phase === phase) return state;
            return {
              globalTimer: {
                ...state.globalTimer,
                phase,
                isRunning: true,
                isPaused: false,
              },
            };
          });
        },

        advanceToNextYear: () => {
          const { globalTimer } = get();
          const nextYear = globalTimer.currentYear + 1;
          if (nextYear > 10) {
            set((state) => ({
              globalTimer: { ...state.globalTimer, isRunning: false, timeRemaining: 0 },
            }));
            return;
          }
          const dur = globalTimer.yearDurations?.[nextYear] ?? YEAR_DURATIONS[nextYear];
          set((state) => ({
            game: { ...state.game, currentYear: nextYear },
            globalTimer: {
              ...state.globalTimer,
              currentYear: nextYear,
              timeRemaining: dur,
              isRunning: true,
              isPaused: false,
              pendingRefusal: false,
              refusalYear: null,
              refusalTimeLeft: 0,
              phase: 'RESEARCH',
            },
          }));
        },

        setGlobalYear: (year) => {
          const { globalTimer } = get();
          const dur = globalTimer.yearDurations?.[year] ?? YEAR_DURATIONS[year];
          set((state) => ({
            game: { ...state.game, currentYear: year },
            globalTimer: {
              ...state.globalTimer,
              currentYear: year,
              timeRemaining: dur,
              pendingRefusal: false,
              refusalYear: null,
              refusalTimeLeft: 0,
            },
          }));
        },

        startRefusalPeriod: (year) => {
          const REFUSAL_DURATION = 10 * 60;
          set((state) => ({
            globalTimer: {
              ...state.globalTimer,
              pendingRefusal: true,
              refusalYear: year,
              refusalTimeLeft: REFUSAL_DURATION,
              timeRemaining: REFUSAL_DURATION,
            },
          }));
        },

        completeRefusalPeriod: () => {
          const { globalTimer } = get();
          const nextYear = globalTimer.refusalYear + 1;
          const dur = globalTimer.yearDurations?.[nextYear] ?? YEAR_DURATIONS[nextYear];
          set((state) => ({
            game: { ...state.game, currentYear: nextYear },
            globalTimer: {
              ...state.globalTimer,
              currentYear: nextYear,
              timeRemaining: dur,
              isRunning: true,
              isPaused: false,
              pendingRefusal: false,
              refusalYear: null,
              refusalTimeLeft: 0,
              phase: 'RESEARCH',
            },
          }));
        },

        resetGlobalTimer: () => {
          set((state) => ({
            globalTimer: {
              ...state.globalTimer,
              currentYear: 1,
              timeRemaining: state.globalTimer.yearDurations?.[1] ?? YEAR_DURATIONS[1],
              isRunning: false,
              isPaused: false,
              pendingRefusal: false,
              refusalYear: null,
              refusalTimeLeft: 0,
              phase: 'RESEARCH',
            },
            game: { ...state.game, currentYear: 1 },
          }));
        },

        setYear: (year) => {
          const { globalTimer } = get();
          const dur = globalTimer.yearDurations?.[year] ?? YEAR_DURATIONS[year];
          set({
            game: { ...get().game, currentYear: year },
            globalTimer: {
              ...get().globalTimer,
              currentYear: year,
              timeRemaining: dur,
            },
          });
        },

        nextYear: () => {
          const y = get().game.currentYear;
          if (y < 10) {
            const dur = get().globalTimer.yearDurations?.[y + 1] ?? YEAR_DURATIONS[y + 1];
            set({
              game: { ...get().game, currentYear: y + 1 },
              globalTimer: {
                ...get().globalTimer,
                currentYear: y + 1,
                timeRemaining: dur,
              },
            });
          }
        },

        recordYearStatistics: (year, data) => {
          set((state) => {
            const existing = state.statistics.yearlyData[year] || [];
            return {
              statistics: {
                ...state.statistics,
                yearlyData: {
                  ...state.statistics.yearlyData,
                  [year]: [...existing, data],
                },
              },
            };
          });
        },

        resetEventCardsForNewYear: (nextYear) => {
          set((state) => {
            const prevYear = nextYear - 1;
            const currentEvents = state.events;
            if (currentEvents.historyByYear?.[prevYear]) return state;
            const historyEntry = {
              linesByLU: { ...currentEvents.linesByLU },
              revealedCards: { ...currentEvents.revealedCards },
              lineScores: { ...currentEvents.lineScores },
              skippedLines: { ...currentEvents.skippedLines },
              totalMoneySpent: currentEvents.totalMoneySpent || 0,
            };
            const yearlyStats = { ...state.events.yearlyStats };
            yearlyStats[prevYear] = yearlyStats[prevYear] || {};
            Object.keys(currentEvents.lineScores).forEach(luId => {
              yearlyStats[prevYear][luId] = { score: currentEvents.lineScores[luId] || 0 };
            });
            return {
              events: {
                ...currentEvents,
                linesByLU: {},
                revealedCards: {},
                lineScores: {},
                skippedLines: {},
                isCompleted: false,
                totalMoneySpent: 0,
                historyByYear: {
                  ...(currentEvents.historyByYear || {}),
                  [prevYear]: historyEntry,
                },
                yearlyStats,
                sessionUsedCardIds: currentEvents.sessionUsedCardIds || [],
                sessionUsedTopics: currentEvents.sessionUsedTopics || {},
              },
            };
          });
        },

        applyYearTransitionForAllLUs: (prevYear) => {
          set((state) => {
            const updProg = { ...state.research.progressByLU };

            Object.keys(updProg).forEach(luId => {
              const prog = updProg[luId];
              if (!prog) return;

              const prevCol = prog.columnsByYear?.[prevYear];
              const skipped = (prog.skippedYears || []).includes(prevYear);

              const evScore =
                state.events.historyByYear?.[prevYear]?.lineScores?.[luId]
                ?? state.events.lineScores?.[luId]
                ?? 0;

              let blocked = [...(prog.blockedColumns || [])];

              if (prevCol && !skipped && evScore >= 0) {
                if (!blocked.includes(prevCol)) blocked.push(prevCol);
              }

              updProg[luId] = {
                ...prog,
                blockedColumns: blocked,
                purchasedCells: {},
                successRates: {},
              };
            });

            return {
              research: {
                ...state.research,
                progressByLU: updProg,
                yearTransitionApplied: true,
              },
            };
          });
        },

        initializeGame: (gameData) => {
          set({
            game: { ...get().game, id: gameData.id, status: 'IN_PROGRESS', createdAt: new Date().toISOString() },
            licenseUnits: { ...get().licenseUnits, available: gameData.availableLU },
            regionMap: { cells: gameData.regionMap.cells, resourceDensityRevealed: false },
            research: { ...get().research, availableWorks: gameData.researchWorks },
            fieldWork: { ...get().fieldWork, availableOptions: gameData.fieldWorkOptions },
          });
        },

        setTeam: (teamData) => {
          const budget = teamData.experienceLevel === 'student'
            ? BUDGET_CONFIG.STUDENT
            : BUDGET_CONFIG.PROFESSIONAL;
          set({
            player: {
              ...get().player,
              name: teamData.name,
              teamId: teamData.teamId || teamData.name,
              token: teamData.token ?? null,
              sessionId: teamData.sessionId ?? null,
              teamMembers: teamData.members,
              experienceLevel: teamData.experienceLevel,
              budget,
              initialBudget: budget,
            },
          });
        },

        setSessionConfig: (config) => {
          set((state) => ({
            player: {
              ...state.player,
              sessionConfig: {
                ...defaultSessionConfig,
                ...config,
                regionMapTimers: {
                  selection: config.regionMapTimers?.selection ?? config.regionMapTimer ?? 20,
                  auction: config.regionMapTimers?.auction ?? 2,
                  postAuction: config.regionMapTimers?.postAuction ?? 2,
                },
                maxLUsPerTeam: config.maxLUsPerTeam ?? 5,
              },
            },
          }));

          if (config.timers && Object.keys(config.timers).length > 0) {
            get().setSessionTimers(config.timers, config.regionMapTimer);
          }
        },

        purchaseGridCell: (cellRef, cellName) => {
          const { gridCells, player, auctions } = get();
          const maxLUs = player.sessionConfig?.maxLUsPerTeam ?? 5;
          const ownedCount = Object.keys(gridCells.owned).length;
          if (ownedCount >= maxLUs) return 'limit';
          if (gridCells.owned[cellRef]) return 'already_owned';
          const existing = gridCells.allTeams[cellRef];
          if (existing && existing.ownedByTeamId && existing.ownedByTeamId !== player.teamId) {
            if (!auctions.active[cellRef]) {
              set({
                auctions: {
                  ...get().auctions,
                  active: {
                    ...get().auctions.active,
                    [cellRef]: {
                      cellRef, cellName,
                      currentBid: AUCTION_START_PRICE,
                      currentBidTeamId: existing.ownedByTeamId,
                      currentBidTeamName: existing.ownedByTeamName,
                      startPrice: AUCTION_START_PRICE,
                      participants: [existing.ownedByTeamId],
                      bids: [{ teamId: existing.ownedByTeamId, teamName: existing.ownedByTeamName, amount: AUCTION_START_PRICE, at: existing.purchasedAt }],
                    },
                  },
                },
              });
            }
            return 'auction';
          }
          if (auctions.active[cellRef]) return 'auction';
          const cellData = {
            id: cellRef, cellRef, name: cellName,
            ownedByTeamId: player.teamId || player.name,
            ownedByTeamName: player.name,
            purchasedAt: new Date().toISOString(),
          };
          const newOwned = { ...gridCells.owned, [cellRef]: cellData };
          const newAllTeams = { ...gridCells.allTeams, [cellRef]: cellData };
          const newCurrent = get().licenseUnits.current || cellData;
          set({
            gridCells: { owned: newOwned, allTeams: newAllTeams },
            licenseUnits: { ...get().licenseUnits, current: newCurrent },
          });
          return 'ok';
        },

        unpurchaseGridCell: (cellRef) => {
          const { gridCells } = get();
          if (!gridCells.owned[cellRef]) return false;
          const newOwned = { ...gridCells.owned };
          const newAllTeams = { ...gridCells.allTeams };
          delete newOwned[cellRef];
          delete newAllTeams[cellRef];
          const remaining = Object.values(newOwned);
          const currentLU = get().licenseUnits.current;
          const newCurrent = currentLU?.cellRef === cellRef ? (remaining[0] || null) : currentLU;
          set({
            gridCells: { owned: newOwned, allTeams: newAllTeams },
            licenseUnits: { ...get().licenseUnits, current: newCurrent },
          });
          return true;
        },

        registerForAuction: (cellRef) => {
          const { auctions, player, gridCells } = get();
          const myId = player.teamId || player.name;
          let auction = auctions.active[cellRef];
          if (auction) {
            if (!auction.participants.includes(myId)) {
              set({ auctions: { ...get().auctions, active: { ...get().auctions.active, [cellRef]: { ...auction, participants: [...auction.participants, myId] } } } });
              return true;
            }
            return false;
          } else {
            const cellData = gridCells.allTeams[cellRef];
            if (!cellData || !cellData.ownedByTeamId) return false;
            set({
              auctions: {
                ...get().auctions,
                active: {
                  ...get().auctions.active,
                  [cellRef]: {
                    cellRef, cellName: cellData.name || `Участок ${cellRef}`,
                    startPrice: AUCTION_START_PRICE,
                    currentBid: AUCTION_START_PRICE,
                    currentBidTeamId: cellData.ownedByTeamId,
                    currentBidTeamName: cellData.ownedByTeamName,
                    participants: [cellData.ownedByTeamId, myId],
                    bids: [{ teamId: cellData.ownedByTeamId, teamName: cellData.ownedByTeamName, amount: AUCTION_START_PRICE, at: cellData.purchasedAt || new Date().toISOString() }],
                  },
                },
              },
            });
            return true;
          }
        },

        placeBid: (cellRef, amount) => {
          const { auctions, player } = get();
          const auction = auctions.active[cellRef];
          if (!auction) return false;
          if (amount <= auction.currentBid) return false;
          if (player.budget < amount) return false;
          const myId = player.teamId || player.name;
          const participants = [...(auction.participants || [])];
          if (!participants.includes(myId)) participants.push(myId);
          set({
            auctions: {
              ...get().auctions,
              active: {
                ...get().auctions.active,
                [cellRef]: {
                  ...auction, currentBid: amount,
                  currentBidTeamId: myId, currentBidTeamName: player.name, participants,
                  bids: [...auction.bids, { teamId: myId, teamName: player.name, amount, at: new Date().toISOString() }],
                },
              },
            },
          });
          return true;
        },

        getMyAuctionParticipation: () => {
          const { auctions, player } = get();
          const myId = player.teamId || player.name;
          return Object.keys(auctions.active).filter(cellRef => {
            const auction = auctions.active[cellRef];
            if (!auction?.participants?.includes(myId)) return false;
            const weMadeBid = auction.bids?.some(
              b => b.teamId === myId || b.teamName === player.name
            );
            const weAreLeader = auction.currentBidTeamId === myId
              || auction.currentBidTeamName === player.name;
            if (weAreLeader && !weMadeBid) return false;
            return true;
          });
        },

        finalizeAuction: (cellRef) => {
          const { auctions, player, gridCells } = get();
          const auction = auctions.active[cellRef];
          if (!auction) return false;
          const myId = player.teamId || player.name;
          const weWon = auction.currentBidTeamId === myId || auction.currentBidTeamName === player.name;
          const active = { ...auctions.active };
          delete active[cellRef];
          if (weWon) {
            if (player.budget < auction.currentBid) return false;
            const cellData = {
              id: cellRef, cellRef, name: auction.cellName,
              ownedByTeamId: myId, ownedByTeamName: player.name,
              purchasedAt: new Date().toISOString(),
              auctionPrice: auction.currentBid,
            };
            set({
              player: { ...get().player, budget: player.budget - auction.currentBid },
              gridCells: {
                owned: { ...gridCells.owned, [cellRef]: cellData },
                allTeams: { ...gridCells.allTeams, [cellRef]: cellData },
              },
              auctions: { active, completed: { ...auctions.completed, [cellRef]: { ...auction, winner: myId } } },
              licenseUnits: { ...get().licenseUnits, current: get().licenseUnits.current || cellData },
            });
          } else {
            set({ auctions: { active, completed: { ...auctions.completed, [cellRef]: auction } } });
          }
          return true;
        },

        unregisterFromAuction: (cellRef) => {
          const { auctions, player } = get();
          const myId = player.teamId || player.name;
          set(state => {
            const auction = state.auctions.active[cellRef];
            if (!auction) return state;
            const updatedParticipants = (auction.participants || []).filter(id => id !== myId);
            if (updatedParticipants.length === 0) {
              const newActive = { ...state.auctions.active };
              delete newActive[cellRef];
              return { auctions: { ...state.auctions, active: newActive } };
            }
            let updatedAuction = { ...auction, participants: updatedParticipants };
            if (auction.currentBidTeamId === myId) {
              updatedAuction.currentBidTeamId = updatedParticipants[0];
              updatedAuction.currentBidTeamName = `Команда ${updatedParticipants[0]}`;
              updatedAuction.currentBid = auction.startPrice;
            }
            return { auctions: { ...state.auctions, active: { ...state.auctions.active, [cellRef]: updatedAuction } } };
          });
        },

        purchaseResearch: (luId, researchWork) => {
          const budget = get().player.budget;
          if (budget < researchWork.baseCost) return false;
          const cur = get().research.progressByLU[luId] || { ...defaultLUProgress };
          const currentYear = get().globalTimer.currentYear;
          const rates = { ...cur.successRates };
          Object.keys(researchWork.successRates).forEach(wt => {
            rates[wt] = Math.min((rates[wt] || 0) + researchWork.successRates[wt], 95);
          });
          const ratesByYear = { ...(cur.successRatesByYear || {}) };
          ratesByYear[currentYear] = { ...rates };
          const mobCols = [...(cur.mobilizedColumns || [])];
          const mobColsByYear = { ...(cur.mobilizedColumnsByYear || {}) };
          if (researchWork.mobilizationType && !mobCols.includes(researchWork.mobilizationType)) {
            mobCols.push(researchWork.mobilizationType);
            mobColsByYear[currentYear] = [...(mobColsByYear[currentYear] || []), researchWork.mobilizationType];
          }
          const colsByYear = { ...(cur.columnsByYear || {}) };
          if (researchWork.mobilizationType) colsByYear[currentYear] = researchWork.mobilizationType;
          const worksByYear = { ...(cur.purchasedWorksByYear || {}) };
          worksByYear[currentYear] = [...(worksByYear[currentYear] || []), researchWork];
          const updated = {
            ...cur,
            purchasedWorks: [...cur.purchasedWorks, researchWork],
            purchasedWorksByYear: worksByYear,
            purchasedCells: { ...(cur.purchasedCells || {}), [researchWork.metadata?.cellKey || researchWork.id]: researchWork },
            purchasedCellsByYear: {
              ...(cur.purchasedCellsByYear || {}),
              [currentYear]: { ...(cur.purchasedCellsByYear?.[currentYear] || {}), [researchWork.metadata?.cellKey || researchWork.id]: researchWork },
            },
            totalSpent: cur.totalSpent + researchWork.baseCost,
            successRates: rates,
            successRatesByYear: ratesByYear,
            mobilizedColumns: mobCols,
            mobilizedColumnsByYear: mobColsByYear,
            columnsByYear: colsByYear,
            skippedYears: cur.skippedYears || [],
            completedColumns: cur.completedColumns || [],
          };
          set({
            player: { ...get().player, budget: budget - researchWork.baseCost },
            research: { ...get().research, progressByLU: { ...get().research.progressByLU, [luId]: updated } },
          });
          return true;
        },

        markYearSkippedForLU: (luId, year) => {
          set(state => {
            const prog = state.research.progressByLU[luId] || { ...defaultLUProgress };
            const skippedYears = [...(prog.skippedYears || [])];
            if (!skippedYears.includes(year)) skippedYears.push(year);
            return {
              research: {
                ...state.research,
                progressByLU: { ...state.research.progressByLU, [luId]: { ...prog, skippedYears } },
              },
            };
          });
        },

        updateEventLine: (luId, d) => set({ events: { ...get().events, linesByLU: { ...get().events.linesByLU, [luId]: d } } }),

        saveEventLine: (luId, lineData) => {
          set((state) => ({
            events: { ...state.events, linesByLU: { ...state.events.linesByLU, [luId]: lineData } },
          }));
        },

        revealEventCard: (luId, k, d) => set({
          events: {
            ...get().events,
            revealedCards: { ...get().events.revealedCards, [luId]: { ...(get().events.revealedCards[luId] || {}), [k]: d } },
          },
        }),

        updateEventLineScore: (luId, p) => set({
          events: { ...get().events, lineScores: { ...get().events.lineScores, [luId]: (get().events.lineScores[luId] || 0) + p } },
        }),

        skipEventLine: (luId) => set({
          events: { ...get().events, skippedLines: { ...get().events.skippedLines, [luId]: [...(get().events.skippedLines[luId] || []), Date.now()] } },
        }),

        completeEvents: () => set({ events: { ...get().events, isCompleted: true } }),

        updateEventMoneySpent: (amount) => {
          if (!amount || amount >= 0) return;
          const year = get().game?.currentYear ?? get().globalTimer?.currentYear ?? 1;
          const abs = Math.abs(amount);
          set((state) => ({
            events: {
              ...state.events,
              totalMoneySpent: (state.events.totalMoneySpent || 0) + abs,
              moneySpentByYear: {
                ...state.events.moneySpentByYear,
                [year]: (state.events.moneySpentByYear?.[year] || 0) + abs,
              },
            },
          }));
        },

        addUsedEventCardIds: (ids) => {
          if (!ids || ids.length === 0) return;
          set((state) => {
            const existing = new Set(state.events.sessionUsedCardIds || []);
            ids.forEach(id => existing.add(id));
            return { events: { ...state.events, sessionUsedCardIds: [...existing] } };
          });
        },

        addUsedEventTopics: (topics) => {
          if (!topics || Object.keys(topics).length === 0) return;
          set((state) => {
            const existing = { ...(state.events.sessionUsedTopics || {}) };
            Object.entries(topics).forEach(([t, cnt]) => {
              existing[t] = (existing[t] || 0) + cnt;
            });
            return { events: { ...state.events, sessionUsedTopics: existing } };
          });
        },

        selectFieldWork: (luId, d) => {
          const year = get().globalTimer.currentYear;
          const existing = get().fieldWork.selectionsByLU[luId] || {};
          set({
            fieldWork: {
              ...get().fieldWork,
              selectionsByLU: {
                ...get().fieldWork.selectionsByLU,
                [luId]: {
                  ...existing,
                  byYear: { ...(existing.byYear || {}), [year]: d },
                  ...d,
                },
              },
            },
          });
          return true;
        },

        selectFieldWorkWithBudget: (luId, options, totalCost, qualityScore) => {
          const budget = get().player.budget;
          if (budget < totalCost) return false;
          const year = get().globalTimer.currentYear;
          const existing = get().fieldWork.selectionsByLU[luId] || {};
          const yearData = { selectedOptions: options, totalCost, qualityScore };
          set({
            player: { ...get().player, budget: budget - totalCost },
            fieldWork: {
              ...get().fieldWork,
              selectionsByLU: {
                ...get().fieldWork.selectionsByLU,
                [luId]: {
                  ...existing,
                  byYear: { ...(existing.byYear || {}), [year]: yearData },
                  ...yearData,
                },
              },
            },
          });
          return true;
        },

        saveResult: (luId, card) => set({ results: { ...get().results, cardsByLU: { ...get().results.cardsByLU, [luId]: card } } }),

        // ── Сценарии свободных ячеек карты региона ────────────────────────────
        // freeCellRefs: string[] — список cellRef ячеек, которые сейчас свободны
        // year: number — текущий игровой год (1–10)
        //
        // Правила:
        //   Вызов за тот же год игнорируется (idempotent) — защита от повторного
        //   монтирования компонента или лишних рендеров.
        //   Год 1–3: открывается 1/3 всех свободных ячеек (новые к уже открытым)
        //   Год 4+:  новые ячейки не открываются
        //   Всегда (при смене года):  workId уже открытых ячеек обновляется
        //                             по пулу сценариев текущего года
        assignCellScenarios: (year, freeCellRefs, calcFreeCount) => set((state) => {
          // Уже обрабатывали этот год — ничего не делаем
          if (year <= state.cellScenariosProcessedYear) return {};

          const SCENARIOS_BY_YEAR = {
            1: ['srr_3d', 'srr_2d', '1pr'],
            2: ['srr_3d', 'srr_2d', '1pr'],
            3: ['srr_3d', 'srr_2d', '1pr'],
            4: ['srr_3d', 'srr_2d', '1pr', '3r'],
            5: ['3r'],
            6: ['3r'],
            7: ['drilling_5gs', 'drilling_6gs', 'drilling_7mzs', 'testing', 'mun'],
            8: ['drilling_5gs', 'drilling_6gs', 'drilling_7mzs', 'testing', 'mun'],
            9: ['drilling_5gs', 'drilling_6gs', 'drilling_7mzs', 'testing', 'mun'],
            10: ['depression', 'bsko', 'ppd', '3bs'],
          };

          const pool = SCENARIOS_BY_YEAR[year];
          if (!pool || pool.length === 0) return {};

          const pick = () => pool[Math.floor(Math.random() * pool.length)];
          const freeSet = new Set(freeCellRefs);
          const existing = state.cellScenarios;

          // Обновляем workId у всех уже открытых ячеек (смена сценария при смене года)
          const updated = {};
          Object.entries(existing).forEach(([ref, data]) => {
            updated[ref] = freeSet.has(ref)
              ? { ...data, workId: pick() }
              : data; // ячейка куплена — оставляем (на карте не отображается)
          });

          // Годы 1–3: открываем ещё 1/3 всех свободных ячеек (из тех, что не открыты)
          if (year <= 3) {
            const unopened = freeCellRefs.filter(r => !existing[r]);
            const countForCalc = calcFreeCount ?? freeCellRefs.length;
            const available = Math.floor(countForCalc / 2);
            const toOpen = Math.max(1, Math.floor(available / 3));
            [...unopened]
              .sort(() => Math.random() - 0.5)
              .slice(0, toOpen)
              .forEach(ref => {
                updated[ref] = { workId: pick(), openedInYear: year };
              });
          }

          // ── Сценарии нефтяных компаний: ~70% случайных, назначаем один раз ────
          const COMPANY_REFS = ['B5', 'C5', 'B6', 'C6'];
          const COMPANY_WORK_POOL = ['srr_2d', 'srr_3d', '1pr'];
          const companyCount = Math.max(1, Math.round(COMPANY_REFS.length * 0.7));
          const companySubset = [...COMPANY_REFS].sort(() => Math.random() - 0.5).slice(0, companyCount);
          companySubset.forEach(ref => {
            if (!existing[ref]) {
              updated[ref] = {
                workId: COMPANY_WORK_POOL[Math.floor(Math.random() * COMPANY_WORK_POOL.length)],
                rank: Math.ceil(Math.random() * 3),
                year,
                isCompanyCell: true,
              };
            }
          });

          return { cellScenarios: updated, cellScenariosProcessedYear: year };
        }),

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
          set({
            game: { ...get().game, status: 'FINISHED', currentPhase: 'RESULTS' },
            results: { ...get().results, finalScore: score },
          });
        },

        resetGame: () => {
          const { globalTimer } = get();
          set({
            game: {
              id: null, status: 'SETUP', currentRound: 1, currentPhase: 'LOBBY',
              currentLUProgress: {}, createdAt: null, currentYear: 1,
              currentScreen: null,  // сбрасываем экран при полном сбросе игры
            },
            player: { ...defaultPlayer },
            licenseUnits: { available: [], owned: [], current: null },
            gridCells: { owned: {}, allTeams: {} },
            auctions: { active: {}, completed: {} },
            regionMap: { cells: [], resourceDensityRevealed: false },
            research: { availableWorks: [], progressByLU: {}, yearTransitionApplied: false },
            events: { linesByLU: {}, revealedCards: {}, lineScores: {}, skippedLines: {}, historyByYear: {}, isCompleted: false, yearScores: {}, yearlyStats: {}, totalMoneySpent: 0, moneySpentByYear: {}, sessionUsedCardIds: [], sessionUsedTopics: {} },
            statistics: { yearlyData: {} },
            fieldWork: { availableOptions: [], selectionsByLU: {}, totalSpent: 0, totalSpentByYear: {} },
            otherTeamsScene: {},
            cellScenarios: {},
            cellScenariosProcessedYear: 0,
            results: { cardsByLU: {}, finalScore: 0 },
            triggerRefusal: false,
            showRegionMapBanner: false,
            globalTimer: {
              currentYear: 1,
              timeRemaining: globalTimer.yearDurations?.[1] ?? YEAR_DURATIONS[1],
              isRunning: false,
              isPaused: false,
              pendingRefusal: false,
              refusalYear: null,
              refusalTimeLeft: 0,
              phase: 'RESEARCH',
              yearDurations: globalTimer.yearDurations ?? { ...YEAR_DURATIONS },
              regionMapDuration: globalTimer.regionMapDuration ?? REGION_MAP_DURATION,
            },
          });
        },

        // Выход из сессии без сброса данных.
        // Очищает только player, game.currentScreen и таймер.
        // Данные игры (research/fieldWork/events/gridCells) остаются —
        // они восстановятся с сервера через state:sync при переподключении.
        leaveSession: () => {
          set((state) => ({
            player: { ...defaultPlayer },
            game: { ...state.game, currentScreen: null },
          }));
        },

        getCurrentLU: () => get().licenseUnits.current,

        getOwnedGridCellsAsLU: () =>
          Object.values(get().gridCells.owned).map(cell => ({
            id: cell.cellRef, cellRef: cell.cellRef,
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
          isCompleted: get().events.isCompleted,
        }),

        getCurrentEventData: () => {
          const lu = get().licenseUnits.current;
          if (!lu) return null;
          return get().getEventDataForLU(lu.id || lu.cellRef);
        },

        getCurrentYearTimeRemaining: () => get().globalTimer.timeRemaining,

        getCurrentYearInfo: () => ({
          year: get().globalTimer.currentYear,
          timeRemaining: get().globalTimer.timeRemaining,
          isRunning: get().globalTimer.isRunning,
          isPaused: get().globalTimer.isPaused,
          pendingRefusal: get().globalTimer.pendingRefusal,
          refusalTimeLeft: get().globalTimer.refusalTimeLeft,
        }),

        getYearStats: (year) => {
          const state = get();
          const eventsHistory = state.events.historyByYear?.[year] || {
            linesByLU: state.events.linesByLU,
            lineScores: state.events.lineScores,
          };
          const researchByLU = {};
          Object.keys(state.research.progressByLU).forEach(luId => {
            const prog = state.research.progressByLU[luId];
            researchByLU[luId] = {
              works: prog.purchasedWorksByYear?.[year] || [],
              column: prog.columnsByYear?.[year] || null,
              successRates: prog.successRatesByYear?.[year] || {},
              mobilizedColumns: prog.mobilizedColumnsByYear?.[year] || [],
              eventsScore: eventsHistory.lineScores?.[luId] ?? null,
              skipped: (prog.skippedYears || []).includes(year),
            };
          });
          return { year, research: researchByLU, events: eventsHistory };
        },

        getSessionStatistics: () => {
          const state = get();
          return {
            teamId: state.player.teamId,
            teamName: state.player.name,
            initialBudget: state.player.initialBudget,
            finalBudget: state.player.budget,
            yearlyActions: state.statistics.yearlyData,
            researchByLU: state.research.progressByLU,
            eventStatsByYear: state.events.yearlyStats,
            eventHistoryByYear: state.events.historyByYear,
            fieldWork: state.fieldWork.selectionsByLU,
          };
        },

        simulateOtherTeamOwns: (cellRef, cellName) => {
          const { gridCells, player } = get();
          const myId = player.teamId || player.name;
          const cellData = { id: cellRef, cellRef, name: cellName, ownedByTeamId: 'other_team_' + Date.now(), ownedByTeamName: 'Другая команда', purchasedAt: new Date().toISOString() };
          const newOwned = { ...gridCells.owned };
          if (newOwned[cellRef] && newOwned[cellRef].ownedByTeamId === myId) delete newOwned[cellRef];
          set({ gridCells: { owned: newOwned, allTeams: { ...gridCells.allTeams, [cellRef]: cellData } } });
        },

        purchaseLU: (lu) => {
          const budget = get().player.budget;
          if (budget < lu.cost) return false;
          set({
            player: { ...get().player, budget: budget - lu.cost },
            licenseUnits: { ...get().licenseUnits, available: get().licenseUnits.available.filter(l => l.id !== lu.id), owned: [...get().licenseUnits.owned, lu] },
          });
          return true;
        },

        unpurchaseLU: (luId) => {
          const lu = get().licenseUnits.owned.find(l => l.id === luId);
          if (!lu) return false;
          set({
            player: { ...get().player, budget: get().player.budget + lu.cost },
            licenseUnits: { ...get().licenseUnits, available: [...get().licenseUnits.available, lu], owned: get().licenseUnits.owned.filter(l => l.id !== luId) },
          });
          return true;
        },

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
              game: { ...get().game, currentPhase: 'REGION_MAP', currentRound: get().game.currentRound + 1, currentYear: nextYear },
            });
          } else {
            get().finishGame();
          }
        },
      }),
      {
        name: 'geology-game-storage',
        partialize: (state) => ({
          game: state.game,          // ← currentScreen сохраняется здесь автоматически
          player: state.player,
          licenseUnits: state.licenseUnits,
          gridCells: state.gridCells,
          auctions: state.auctions,
          research: state.research,
          events: state.events,
          statistics: state.statistics,
          fieldWork: state.fieldWork,
          results: state.results,
          globalTimer: state.globalTimer,
        }),
      }
    )
  )
);

export default useGameStore;
