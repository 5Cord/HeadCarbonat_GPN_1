// RegionMap.jsx
import React, { useState, useEffect, useRef } from 'react';
import './RegionMap.css';
import useGameStore, { AUCTION_START_PRICE } from '../../store/gameStore';
import GlobalTimer from '../GlobalTimer';
import AuctionDashboard from './Auctiondashboard';
import RegionMapTour from './Regionmaptour';
import { getSocket } from '../apiHelpers';
import { getLastSuccessfulSceneImage, getSceneImageFromMeta, getScenario, resolveSceneImage, WORK_SCENE_MAP } from '../Research/sceneUtils';
import RegNirSvg from '../svgs/RegNir.svg';
import NeftImg from '../assets/cards/Neft.png';

const LICENSE_UNITS = [
  { id: 'well1', name: 'Парам. скважина №1', shortName: '1', cost: 10, cellRef: 'A2', position: 'top-left', customStyle: { top: '-130px', left: '0px' }, labelLeft: '0px', description: 'Целевой комплекс: светлые слоистые строматолитовые доломиты с прослоями гипса и ангидрита. Свойства: доломиты слабо пористые, с редкими выпотами густой нефти.', hasImage: false },
  { id: 'well2', name: 'Парам. скважина №2', shortName: '2', cost: 10, cellRef: 'A5', position: 'top-left', customStyle: { top: '-130px', left: '0px' }, labelLeft: '0px', description: 'Целевой комплекс: светлые тонкослоистые известняки и доломиты, прослоями зернистые. Свойства: межзерновая пористость, признаки нефтенасыщения по порам.', hasImage: false },
  { id: 'seismic', name: 'ОиИ архивных СРР 2D', shortName: 'И', cost: 30, cellRef: 'A10', position: 'corner-bottom-left', customStyle: { top: '-130px', left: '80px' }, labelLeft: '100px', description: 'По данным двухмерной сейсморазведки выделяются ориентированные с юго-запада на северо-восток объекты, похожие на структурные валы. В центральной части территории между ними фиксируется палеопрогиб.', hasImage: false },
  { id: 'well3', name: 'Парам. скважина №3', shortName: '3', cost: 10, cellRef: 'B10', position: 'right', customStyle: { top: '0', left: '85px' }, labelLeft: '85px', description: 'Целевой комплекс: тонкослоистые черные кремнистые известняки с повышенным содержанием органического углерода. Свойства: мощность комплекса сильно сокращена.', hasImage: false },
  { id: 'well4', name: 'Парам. скважина №4', shortName: '4', cost: 20, cellRef: 'E10', position: 'right', customStyle: { top: '0px', left: '85px' }, labelLeft: '85px', description: 'Целевой комплекс: массивные трещиновато-кавернозные известняки с кораллами и губками. Свойства: по кавернам обильные выполы (выпоты) нефти.', hasImage: false },
  { id: 'well5', name: 'Парам. скважина №5', shortName: '5', cost: 20, cellRef: 'J8', position: 'right', customStyle: { top: '85px', left: '0px' }, labelLeft: '0px', description: 'Целевой комплекс: светлые слоистые известняки и доломиты (зернистые и микритовые). Свойства: прослоями породы пористые, с признаками углеводородов.', hasImage: false },
  { id: 'well6', name: 'Парам. скважина №6', shortName: '6', cost: 10, cellRef: 'J3', position: 'right', customStyle: { top: '85px', left: '0px' }, labelLeft: '0px', description: 'Целевой комплекс: тонкослоистые черные кремнистые известняки с повышенным содержанием органического углерода, с остатками планктонной фауны. Свойства: мощность комплекса сильно сокращена.', hasImage: false },
  { id: 'research', name: 'Региональная НИР', shortName: 'Н', cost: 70, cellRef: 'J1', position: 'corner-top-right', customStyle: { top: '85px', left: '-118px' }, labelLeft: '-120px', description: 'Выполнены: космогеологическое моделирование, структурно-генетическое моделирование, бассейновое моделирование, оценка ресурсов. Карта плотности ресурсов углеводородов (тысяч тонн условного топлива на квадратный километр): 10-50, 5-10, менее 5.', hasImage: true, imagePath: RegNirSvg },
  { id: 'quarry', name: 'Карьер', shortName: 'К', cost: 20, cellRef: 'F1', position: 'left', customStyle: { top: '0', left: '-130px' }, description: 'Горные породы: известняки и доломиты массивные, химически чистые, органогенные, кавернозно-трещиноватые. Тип: разрабатываемый содовый карьер.', hasImage: false },
  { id: 'outcrop', name: 'Обнажение', shortName: 'О', cost: 10, cellRef: 'D1', position: 'left', customStyle: { top: '0', left: '-130px' }, description: 'Горные породы: ритмично-слоистые светло-серые известняки и доломиты с микробиальными биотермами до 10 м толщиной. Встречаются поры, каверны и трещины с запахом углеводородов.', hasImage: false },
];

const BLOCKED_CELLS = {
  reserve: ['C3', 'C4', 'D3', 'D4'],
  settlement: ['G6', 'G7', 'H6', 'H7'],
  company: ['B5', 'C5', 'B6', 'C6'],
};

const SCENARIO_WORK_LABELS = {
  srr_3d:        'СРР 3D',
  srr_2d:        'СРР 2D',
  '1pr':         '1ПО',
  '3r':          '3Р',
  drilling_5gs:  '5ГС',
  drilling_6gs:  '6ГС МГРП',
  drilling_7mzs: '7МЗС',
  testing:       'ППД',
  mun:           'МУН',
  depression:    'БнД',
  bsko:          'БСКО',
  ppd:           'ПППД',
  '3bs':         'ЗБС',
};


const getLUNamePosition = (position) => {
  switch (position) {
    case 'top-left': return 'translate(60%, 0)';
    case 'right': return 'translate(60%, 0)';
    case 'left': return 'translate(-120%, 0%)';
    case 'corner-bottom-left': return 'translate(60%, 0)';
    case 'corner-top-right': return 'translate(70%, 20%)';
    default: return 'translate(50%, -150%)';
  }
};

const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const cols = Array.from({ length: 10 }, (_, i) => i + 1);

// ── Модалки ───────────────────────────────────────────────────────────────────

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, children, confirmLabel = 'Подтвердить', cancelLabel = 'Отмена', confirmVariant = 'primary' }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content confirm-modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>{title}</h2>
        <div className="confirm-modal-body">{children}</div>
        <div className="modal-actions">
          <button className={`modal-btn modal-btn-${confirmVariant}`} onClick={onConfirm}>{confirmLabel}</button>
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
};

const NoInfoCardModal = ({ isOpen, onClose, onGoToBuyCard }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content confirm-modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="no-card-modal-icon">🗂️</div>
        <h2>Нужна карточка информации</h2>
        <div className="confirm-modal-body">
          <p>Прежде чем выбирать лицензионный участок, необходимо приобрести хотя бы одну <strong>карточку информации</strong>.</p>
          <p className="confirm-modal-hint">Карточки содержат геологические данные о регионе и помогают сделать обоснованный выбор участка.</p>
        </div>
        <div className="modal-actions">
          <button className="modal-btn modal-btn-primary" onClick={onGoToBuyCard}>Купить карточку</button>
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
};

const AlertModal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content confirm-modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>{title}</h2>
        <div className="confirm-modal-body">{children}</div>
        <div className="modal-actions">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
};

// ── Маппинг серверных фаз ─────────────────────────────────────────────────────
const serverPhaseToLocal = (serverPhase) => {
  switch (serverPhase) {
    case 'REGION_MAP_SELECTION': return 'selection';
    case 'REGION_MAP_AUCTION': return 'auction';
    case 'REGION_MAP_POST_AUCTION': return 'post_auction';
    default: return null;
  }
};

const isRegionMapPhase = (serverPhase) =>
  ['REGION_MAP_SELECTION', 'REGION_MAP_AUCTION', 'REGION_MAP_POST_AUCTION'].includes(serverPhase);

// ── Главный компонент ─────────────────────────────────────────────────────────

const RegionMap = ({ onComplete, onNext, onBack, onMenu }) => {
  const {
    player, licenseUnits, gridCells, auctions,
    purchaseLU, purchaseGridCell, placeBid, finalizeAuction,
    registerForAuction, getMyAuctionParticipation, simulateOtherTeamOwns,
    unpurchaseGridCell, unregisterFromAuction,
    fieldWork, events,
  } = useGameStore();

  const otherTeamsScene    = useGameStore(s => s.otherTeamsScene);
  const cellScenarios      = useGameStore(s => s.cellScenarios);
  const assignCellScenarios = useGameStore(s => s.assignCellScenarios);
  const globalYear         = useGameStore(s => s.globalTimer.currentYear);
  const showRegionMapBanner   = useGameStore(s => s.showRegionMapBanner);
  const setShowRegionMapBanner = useGameStore(s => s.setShowRegionMapBanner);

  const sessionConfig = player.sessionConfig ?? {};
  const MAX_LUS_PER_TEAM = sessionConfig.maxLUsPerTeam ?? 5;

  const globalTimer = useGameStore(s => s.globalTimer);
  const serverPhase = globalTimer.phase;

  const currentPhase = serverPhaseToLocal(serverPhase) ?? 'finished';
  const isOurPhase = isRegionMapPhase(serverPhase);

  const isOnline = () => {
    const socket = getSocket();
    return !!(socket?.connected && player.sessionId);
  };

  const budget = player.budget;
  const selectedLU = licenseUnits.owned;
  const ownedCells = gridCells.owned;
  const ownedCount = Object.keys(ownedCells).length;
  const myAuctionCells = getMyAuctionParticipation();
  const totalCommittedCells = ownedCount + myAuctionCells.length;

  const myId = player.teamId || player.name;

  const myContestedCells = Object.entries(auctions.active || {}).reduce((acc, [cellRef, auction]) => {
    const isMyCell = ownedCells[cellRef] !== undefined;
    const hasOtherParticipants = (auction.participants || []).some(pid => pid !== myId);
    if (isMyCell && hasOtherParticipants) acc[cellRef] = auction;
    return acc;
  }, {});

  const [hoveredLU, setHoveredLU] = useState(null);
  const [cellTooltip, setCellTooltip] = useState(null); // { cellId, x, y }
  const [showInfoCards, setShowInfoCards] = useState(false);
  const [selectedInfoCard, setSelectedInfoCard] = useState(null);
  const [isWideScreen, setIsWideScreen] = useState(window.innerWidth > 1580);
  const [viewMode, setViewMode] = useState(null);

  const simulationIntervalRef = useRef(null);
  const [simulationActive, setSimulationActive] = useState(false);

  const [showPostAuctionBanner, setShowPostAuctionBanner] = useState(false);
  const bannerTimerRef = useRef(null);

  const [showContestedBanner, setShowContestedBanner] = useState(false);
  const contestedBannerTimerRef = useRef(null);
  const prevContestedKeysRef = useRef('');

  const [autoAssignBanner, setAutoAssignBanner] = useState(null);
  const autoAssignTimerRef = useRef(null);

  const REGION_BANNER_DURATION = 7000;
  const [regionBannerProgress, setRegionBannerProgress] = useState(100);
  const regionBannerIntervalRef = useRef(null);

  useEffect(() => {
    if (!showRegionMapBanner) {
      clearInterval(regionBannerIntervalRef.current);
      setRegionBannerProgress(100);
      return;
    }
    setRegionBannerProgress(100);
    const step = 100 / (REGION_BANNER_DURATION / 50);
    regionBannerIntervalRef.current = setInterval(() => {
      setRegionBannerProgress(prev => {
        const next = prev - step;
        if (next <= 0) {
          clearInterval(regionBannerIntervalRef.current);
          setShowRegionMapBanner(false);
          return 0;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(regionBannerIntervalRef.current);
  }, [showRegionMapBanner]);

  const mapDone = !isOurPhase && serverPhase !== 'LOBBY' && !isRegionMapPhase(serverPhase);
  const hasLUs  = ownedCount > 0;


  const [showCaseIntro, setShowCaseIntro] = useState(
    () => sessionStorage.getItem('caseIntroDone') !== '1'
  );

  const dismissCaseIntro = () => {
    sessionStorage.setItem('caseIntroDone', '1');
    setShowCaseIntro(false);
  };

  const [showNirHint, setShowNirHint] = useState(false);
  const nirHintShownRef = useRef(sessionStorage.getItem('nirHintShown') === '1');

  useEffect(() => {
    if (mapDone && hasLUs && !nirHintShownRef.current) {
      nirHintShownRef.current = true;
      sessionStorage.setItem('nirHintShown', '1');
      setShowNirHint(true);
    }
  }, [mapDone, hasLUs]);

  // ── Сценарии свободных ячеек ─────────────────────────────────────────────
  // Action в store сам проверяет, обрабатывался ли уже этот год (idempotent),
  // поэтому повторный вход на карту не перегенерирует сценарии.
  useEffect(() => {
    // В онлайн-режиме сценарии приходят с сервера — клиентская генерация не нужна
    const socket = getSocket();
    const isOnline = !!(socket?.connected && player.sessionId);
    if (isOnline) return;

    // Сценарии появляются только после завершения первого года
    if (globalYear < 2) return;

    const allBlockedRefs = [
      ...BLOCKED_CELLS.reserve,
      ...BLOCKED_CELLS.settlement,
      ...BLOCKED_CELLS.company,
    ];
    const ownedByAnyTeam = new Set(Object.keys(gridCells.allTeams));

    const freeCellRefs = [];
    for (const row of rows) {
      for (const col of cols) {
        const ref = `${row}${col}`;
        if (!allBlockedRefs.includes(ref) && !ownedByAnyTeam.has(ref)) {
          freeCellRefs.push(ref);
        }
      }
    }

    const totalCells = rows.length * cols.length;
    const blockedCount = allBlockedRefs.length;
    const ownedCount = ownedByAnyTeam.size;
    const freeCount = freeCellRefs.length;
    const thisTeamLUCount = Object.keys(ownedCells).length;
    const calcFree = totalCells - blockedCount - thisTeamLUCount;
    const available = Math.floor(calcFree / 2);
    const toReveal = Math.max(1, Math.floor(available / 3));

    console.log(
      `[RegionMap] Год ${globalYear} | Всего: ${totalCells} | Заблокировано: ${blockedCount} | ЛУ команды: ${thisTeamLUCount} | Расчётных свободных: ${calcFree} | Доступных (½): ${available} | Открываемых (⅓): ${toReveal}`
    );

    assignCellScenarios(globalYear, freeCellRefs, calcFree);
  }, [globalYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const contestedKeys = Object.keys(myContestedCells).sort().join(',');
  useEffect(() => {
    if (contestedKeys && contestedKeys !== prevContestedKeysRef.current) {
      prevContestedKeysRef.current = contestedKeys;
      setShowContestedBanner(true);
      if (contestedBannerTimerRef.current) clearTimeout(contestedBannerTimerRef.current);
      contestedBannerTimerRef.current = setTimeout(() => setShowContestedBanner(false), 7000);
    }
    if (!contestedKeys) {
      prevContestedKeysRef.current = '';
      setShowContestedBanner(false);
      if (contestedBannerTimerRef.current) clearTimeout(contestedBannerTimerRef.current);
    }
  }, [contestedKeys]);

  const [luConfirmModal, setLuConfirmModal] = useState(null);
  const [gridConfirmModal, setGridConfirmModal] = useState(null);
  const [noCardModal, setNoCardModal] = useState(false);
  const [alertModal, setAlertModal] = useState(null);

  const showAlert = (title, message) => setAlertModal({ title, message });

  // ── cells:updated ─────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onCellsUpdated = (cellsMap) => {
      useGameStore.setState(st => {
        const myTeamId = st.player.teamId || st.player.name;
        const newAllTeams = { ...st.gridCells.allTeams };
        for (const [cellRef, data] of Object.entries(cellsMap)) {
          if (data && data.ownedByTeamId) newAllTeams[cellRef] = data;
          else delete newAllTeams[cellRef];
        }
        const baseOwned = { ...st.gridCells.owned };
        for (const [cellRef, data] of Object.entries(cellsMap)) {
          if (data && data.ownedByTeamId === myTeamId) {
            baseOwned[cellRef] = {
              cellRef, name: `Участок ${cellRef}`,
              auctionPrice: data.auctionPrice ?? 0,
              isAutoAssigned: data.isAutoAssigned ?? false,
              ownedByTeamId: data.ownedByTeamId,
              ownedByTeamName: data.ownedByTeamName,
            };
          } else if (data && data.ownedByTeamId && data.ownedByTeamId !== myTeamId) {
            delete baseOwned[cellRef];
          }
        }
        return { gridCells: { ...st.gridCells, owned: baseOwned, allTeams: newAllTeams } };
      });
    };
    socket.on('cells:updated', onCellsUpdated);
    return () => socket.off('cells:updated', onCellsUpdated);
  }, []);

  // ── cells:auto_assigned ───────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onAutoAssigned = ({ teamId, cells }) => {
      if (teamId !== myId) return;
      setAutoAssignBanner({ cells });
      if (autoAssignTimerRef.current) clearTimeout(autoAssignTimerRef.current);
      autoAssignTimerRef.current = setTimeout(() => setAutoAssignBanner(null), 12000);
    };
    socket.on('cells:auto_assigned', onAutoAssigned);
    return () => {
      socket.off('cells:auto_assigned', onAutoAssigned);
      if (autoAssignTimerRef.current) clearTimeout(autoAssignTimerRef.current);
    };
  }, [myId]);

  useEffect(() => {
    const handleResize = () => setIsWideScreen(window.innerWidth > 1580);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
      if (autoAssignTimerRef.current) clearTimeout(autoAssignTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (currentPhase === 'post_auction') {
      setShowPostAuctionBanner(true);
      bannerTimerRef.current = setTimeout(() => setShowPostAuctionBanner(false), 10000);
    } else {
      setShowPostAuctionBanner(false);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    }
  }, [currentPhase]);

  useEffect(() => {
    if (currentPhase !== 'auction' && simulationActive) stopBidSimulation();
  }, [currentPhase]);

  // ── DEV симуляция ─────────────────────────────────────────────────────────
  const simulateOtherTeamBid = (cellRef) => {
    const auction = auctions.active[cellRef];
    if (!auction) return;
    const otherTeamId = `team_comp_${Math.floor(Math.random() * 100)}`;
    const otherTeamName = `Конкурент ${Math.floor(Math.random() * 10)}`;
    const newBid = auction.currentBid + AUCTION_START_PRICE;
    useGameStore.setState(state => {
      const t = state.auctions.active[cellRef];
      if (t) {
        t.currentBid = newBid;
        t.currentBidTeamId = otherTeamId;
        t.currentBidTeamName = otherTeamName;
        t.bids = [...(t.bids || []), { teamId: otherTeamId, teamName: otherTeamName, amount: newBid, timestamp: Date.now() }];
        if (!t.participants.includes(otherTeamId)) t.participants = [...t.participants, otherTeamId];
      }
      return state;
    });
  };

  const startBidSimulation = () => {
    if (simulationIntervalRef.current) return;
    simulationIntervalRef.current = setInterval(() => {
      const myAuctions = Object.entries(auctions.active).filter(([, a]) => a.participants?.includes(myId));
      if (myAuctions.length > 0) {
        const [cellRef, auction] = myAuctions[Math.floor(Math.random() * myAuctions.length)];
        const otherTeamId = `team_auto_${Math.floor(Math.random() * 50)}`;
        const otherTeamName = `Автоконкурент ${Math.floor(Math.random() * 5)}`;
        const newBid = auction.currentBid + AUCTION_START_PRICE;
        useGameStore.setState(state => {
          const t = state.auctions.active[cellRef];
          if (t) {
            t.currentBid = newBid; t.currentBidTeamId = otherTeamId; t.currentBidTeamName = otherTeamName;
            t.bids = [...(t.bids || []), { teamId: otherTeamId, teamName: otherTeamName, amount: newBid, timestamp: Date.now() }];
            if (!t.participants.includes(otherTeamId)) t.participants = [...t.participants, otherTeamId];
          }
          return state;
        });
      }
    }, 8000);
    setSimulationActive(true);
  };

  const stopBidSimulation = () => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
      setSimulationActive(false);
    }
  };


  // ── Вспомогательные ──────────────────────────────────────────────────────
  const getBlockedType = (ref) => {
    if (ownedCells[ref]) return null;                          // наша после обмена с компанией
    if (gridCells.allTeams[ref]?.ownedByTeamId) return null;  // чужая после обмена — не блокируем
    if (BLOCKED_CELLS.reserve.includes(ref))    return 'reserve';
    if (BLOCKED_CELLS.settlement.includes(ref)) return 'settlement';
    if (BLOCKED_CELLS.company.includes(ref))    return 'company';
    return null;
  };

  const isBlocked = (ref) => !!getBlockedType(ref);
  const getBlockedLabel = (type) => ({ reserve: 'Природный заказник', settlement: 'Населённый пункт', company: 'Занято нефтяной компанией' }[type] || 'Заблокировано');

  const getCellTooltipContent = (cellId) => {
    if (cellId === '__neft_point__') return { title: 'Точка сдачи нефти', sub: 'Доступна с 9-го года' };
    const blockedType = getBlockedType(cellId);
    if (blockedType) return { title: getBlockedLabel(blockedType), sub: `${cellId} · недоступен` };
    const isContested = isMyContestedCell(cellId);
    if (isContested) {
      const bid = myContestedCells[cellId]?.currentBid;
      return { title: 'Ваш участок оспаривается ⚔', sub: `${cellId}${bid != null ? ` · ставка: ${bid} млн` : ''}` };
    }
    if (isOwnedByMe(cellId)) {
      const isAuto = ownedCells[cellId]?.isAutoAssigned;
      return { title: isAuto ? 'Ваш участок (авто)' : 'Ваш участок', sub: cellId };
    }
    if (isOwnedByOther(cellId)) {
      const name = gridCells.allTeams[cellId]?.ownedByTeamName ?? 'Другая команда';
      return { title: name, sub: `${cellId} · занят` };
    }
    const auction = auctions.active[cellId];
    if (auction) {
      const bid = auction.currentBid;
      return { title: 'Аукцион LIVE', sub: `${cellId} · текущая ставка: ${bid != null ? `${bid} млн` : '—'}` };
    }
    if (isRegisteredForAuction(cellId)) return { title: 'Вы в очереди', sub: `${cellId} · ожидание аукциона` };
    return { title: 'Свободный участок', sub: cellId };
  };

  const isLUSelected = (luId) => selectedLU.some(lu => lu.id === luId);
  const canAffordLU = (lu) => isLUSelected(lu.id) || budget >= lu.cost;
  const isOwnedByMe = (ref) => !!ownedCells[ref];
  const isOwnedByOther = (ref) => {
    if (ownedCells[ref]) return false;
    const cell = gridCells.allTeams[ref];
    if (!cell?.ownedByTeamId) return false;
    return myId ? cell.ownedByTeamId !== myId : false;
  };
  const isRegisteredForAuction = (ref) => myAuctionCells.includes(ref);
  const isMyContestedCell = (ref) => !!myContestedCells[ref];
  const canBuyCells = () => currentPhase === 'selection' || currentPhase === 'post_auction';
  const canJoinAuction = () => currentPhase === 'selection' || currentPhase === 'auction';

  // ── Покупка карточки ЛУ ───────────────────────────────────────────────────
  const handleLUClick = (lu) => {
    const canBuy = canBuyCells();
    if (!canBuy) {
      if (isLUSelected(lu.id)) { setViewMode('sidebar'); setSelectedInfoCard(lu); }
      else showAlert('Недоступно', 'Покупка карточек информации сейчас недоступна.');
      return;
    }
    if (isLUSelected(lu.id)) { setViewMode('sidebar'); setSelectedInfoCard(lu); return; }
    if (!canAffordLU(lu)) { showAlert('Недостаточно средств', `Не хватает средств для покупки карточки «${lu.name}».`); return; }
    setLuConfirmModal({ lu });
  };

  // ── ИСПРАВЛЕНО: убрано двойное списание ──────────────────────────────────
  // В онлайн-режиме бюджет списывает ТОЛЬКО сервер через lu:purchase.
  // Ответ приходит в budget:updated → стор обновляется там.
  // Здесь добавляем карточку в owned БЕЗ изменения budget.
  // В оффлайн-режиме — старый путь через purchaseLU (списывает локально).
  const confirmBuyLU = () => {
    if (!luConfirmModal) return;
    const { lu } = luConfirmModal;
    setLuConfirmModal(null);

    const socket = getSocket();
    if (socket?.connected && player.sessionId) {
      socket.emit('lu:purchase', { luId: lu.id, luName: lu.name, cost: lu.cost }, (res) => {
        if (res?.ok) {
          // Только добавляем карточку локально. Бюджет НЕ трогаем —
          // он придёт через событие budget:updated от сервера.
          useGameStore.setState(st => {
            const alreadyOwned = st.licenseUnits.owned.some(l => l.id === lu.id);
            if (alreadyOwned) return st;
            return {
              licenseUnits: {
                ...st.licenseUnits,
                owned: [...st.licenseUnits.owned, lu],
              },
            };
          });
        } else {
          showAlert('Ошибка',
            res?.error === 'INSUFFICIENT_FUNDS' ? 'Недостаточно средств на счёте.' :
              res?.error === 'ALREADY_PURCHASED' ? 'Эта карточка уже куплена.' :
                `Ошибка покупки: ${res?.error || 'неизвестная ошибка'}`
          );
        }
      });
    } else {
      // Оффлайн — старый путь (purchaseLU вычитает бюджет локально)
      purchaseLU(lu);
    }
  };

  const luSpent = selectedLU.reduce((sum, lu) => sum + (lu.cost || 0), 0);
  const auctionSpent = Object.values(ownedCells).reduce((sum, c) => sum + (c.auctionPrice || 0), 0);
  const totalSpent = luSpent + auctionSpent;
  const getLUPosition = (cellId) => LICENSE_UNITS.find(lu => lu.cellRef === cellId);

  const handleGridCellClick = (cellRef) => {
    if (!isOurPhase) { showAlert('Время истекло', 'Время на выбор участков истекло.'); return; }
    if (isBlocked(cellRef)) { showAlert('Участок недоступен', `Причина: ${getBlockedLabel(getBlockedType(cellRef))}`); return; }
    if (cellScenarios[cellRef]) { showAlert('Участок недоступен', `Участок ${cellRef} занят случайным сценарием и не может быть куплен или оспорен.`); return; }
    if (selectedLU.length === 0) { setNoCardModal(true); return; }
    if (isOwnedByMe(cellRef)) {
      if (isMyContestedCell(cellRef)) {
        const auction = myContestedCells[cellRef];
        const competitorCount = (auction.participants || []).filter(p => p !== myId).length;
        showAlert(`⚔️ Участок ${cellRef} оспаривается!`,
          `${competitorCount} ${competitorCount === 1 ? 'команда претендует' : 'команды претендуют'} на ваш участок ${cellRef}. После фазы выбора состоится аукцион — вы в нём не участвуете, участок будет разыгран между претендентами. Победитель выкупит его у вас по финальной ставке.`
        );
      } else {
        showAlert('Уже ваш', 'Этот участок уже принадлежит вашей команде.');
      }
      return;
    }

    if (isOwnedByOther(cellRef)) {
      const ownerTeam = gridCells.allTeams[cellRef]?.ownedByTeamName || 'Другая команда';
      if (currentPhase === 'post_auction') { showAlert('Участок занят', `Участок ${cellRef} занят командой «${ownerTeam}».\n\nВо время допокупки аукционы недоступны.`); return; }
      if (!canJoinAuction()) { showAlert('Недоступно', 'Регистрация на аукцион сейчас недоступна.'); return; }
      if (isRegisteredForAuction(cellRef)) { showAlert('Уже зарегистрированы', `Вы уже зарегистрированы на аукцион за участок ${cellRef}.`); return; }
      if (totalCommittedCells >= MAX_LUS_PER_TEAM) { showAlert('Лимит', `Достигнут лимит ${MAX_LUS_PER_TEAM} участков.`); return; }
      setGridConfirmModal({ cellRef, mode: 'auction', ownerTeam });
      return;
    }

    if (currentPhase === 'auction') return;
    if (!canBuyCells()) { showAlert('Недоступно', 'Покупка участков сейчас недоступна.'); return; }
    if (totalCommittedCells >= MAX_LUS_PER_TEAM && !isRegisteredForAuction(cellRef)) {
      showAlert('Лимит участков', `Лимит ${MAX_LUS_PER_TEAM} участков. У вас: ${ownedCount} + ${myAuctionCells.length} аукционов = ${totalCommittedCells}/${MAX_LUS_PER_TEAM}`);
      return;
    }
    setGridConfirmModal({ cellRef, mode: 'buy' });
  };

  const confirmGridAction = () => {
    if (!gridConfirmModal) return;
    const { cellRef, mode } = gridConfirmModal;
    setGridConfirmModal(null);

    if (mode === 'buy') {
      const socket = getSocket();
      if (socket?.connected && player.sessionId) {
        socket.emit('cell:purchase', { cellRef, cellName: `Участок ${cellRef}` }, (res) => {
          if (!res?.ok) {
            if (res?.error === 'LIMIT') showAlert('Лимит', `Достигнут лимит ${MAX_LUS_PER_TEAM} участков.`);
            else if (res?.error === 'ALREADY_OWNED') showAlert('Уже ваш', 'Этот участок уже ваш.');
            else if (res?.error === 'SCENARIO_CELL') showAlert('Участок недоступен', `Участок ${cellRef} занят случайным сценарием и не может быть куплен.`);
            else if (res?.action === 'auction') showAlert('Аукцион', `Участок занят, запущен аукцион за ${cellRef}`);
          }
        });
      } else {
        purchaseGridCell(cellRef, `Участок ${cellRef}`);
      }
    } else if (mode === 'auction') {
      const socket = getSocket();
      if (socket?.connected && player.sessionId) {
        socket.emit('cell:purchase', { cellRef, cellName: `Участок ${cellRef}` }, (res) => {
          if (res?.action === 'auction' || res?.ok) {
            // auction:created придёт через WS
          } else if (res?.error === 'LIMIT') {
            showAlert('Лимит', `Достигнут лимит ${MAX_LUS_PER_TEAM} участков.`);
          } else if (res?.error) {
            socket.emit('auction:register', { cellRef }, (regRes) => {
              if (!regRes?.ok) showAlert('Ошибка', regRes?.error || 'Не удалось зарегистрироваться на аукцион.');
            });
          }
        });
      } else {
        if (!registerForAuction(cellRef)) showAlert('Ошибка', 'Не удалось зарегистрироваться на аукцион.');
      }
    }
  };

  const handleDashboardBid = async (cellRef, amount) => {
    const socket = getSocket();
    if (socket?.connected && player.sessionId) {
      return new Promise(resolve => {
        socket.emit('auction:bid', { cellRef, amount }, (res) => { resolve(res?.ok ?? false); });
      });
    }
    return placeBid(cellRef, amount);
  };

  const handleDashboardLeave = (cellRef) => {
    const auction = auctions.active[cellRef];
    const weLeading = auction?.currentBidTeamId === myId;
    const message = weLeading
      ? 'Вы сейчас лидируете! Если покинете аукцион, участок достанется другой команде.'
      : 'Если вы выйдете, участок достанется победителю среди других участников.';
    setGridConfirmModal({ cellRef, mode: 'leave', message, weAreLeading: weLeading });
  };

  const confirmLeaveAuction = () => {
    const { cellRef } = gridConfirmModal;
    setGridConfirmModal(null);
    const socket = getSocket();
    if (socket?.connected && player.sessionId) {
      socket.emit('auction:leave', { cellRef }, () => { });
    } else {
      unregisterFromAuction(cellRef);
    }
  };

  const contestedCount = Object.keys(myContestedCells).length;

  return (
    <div className="region-map-fullscreen">

      {showCaseIntro && (
        <div className="case-intro-overlay">
          <div className="case-intro-modal">
            <h1 className="case-intro-title">Кейс</h1>
            <div className="case-intro-divider" />
            <div className="case-intro-body">
              <p>В стране растёт интерес компаний к новому потенциально нефтеносному району.</p>
              <p>По данным федеральных научных институтов, перспективы связаны с карбонатным комплексом платформенного типа.</p>
              <p>На западе расположен складчато-надвиговый комплекс, где целевые объекты могут выходить на поверхность.</p>
              <p>Изученность района крайне низкая: сейсморазведка 2D почти отсутствует, бурение не проводилось.</p>
              <p>По периметру пробурены параметрические скважины, примыкающие к зоне лицензирования.</p>
            </div>
            <button className="case-intro-btn" onClick={dismissCaseIntro}>
              Начать работу →
            </button>
          </div>
        </div>
      )}

      <GlobalTimer
        className="region-timer"
        label={
          currentPhase === 'selection'   ? 'Покупка ЛУ' :
          currentPhase === 'auction'     ? 'Аукцион' :
          currentPhase === 'post_auction'? 'Докупка ЛУ' :
          'Таймер'
        }
        subtitleOverride={
          currentPhase === 'selection'   ? 'Выбор лицензионных участков' :
          currentPhase === 'auction'     ? 'Победит лидер по истечении времени' :
          currentPhase === 'post_auction'? 'Только свободные участки' :
          undefined
        }
        forceFinished={mapDone}
        finishedLabel="Карта региона завершена"
        finishedText="Перейдите к полю «Научные исследования»"
      />

      {showRegionMapBanner && (
        <div className="post-auction-banner" style={{ background: 'linear-gradient(90deg,#1565c0,#1976d2)', display: 'flex', flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '8px 16px' }}>
            <span>Ознакомьтесь с картой региона и переходите к НИРам</span>
            <button
              onClick={() => { clearInterval(regionBannerIntervalRef.current); setShowRegionMapBanner(false); onNext?.(); }}
              style={{ padding: '6px 16px', background: '#fff', color: '#1565c0', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.85rem' }}
            >
              К НИРам →
            </button>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.25)', width: '100%' }}>
            <div style={{ height: '100%', width: `${regionBannerProgress}%`, background: '#fff', transition: 'width 0.05s linear' }} />
          </div>
        </div>
      )}

      {currentPhase === 'post_auction' && showPostAuctionBanner && (
        <div className="post-auction-banner">Аукцион завершён! Есть время докупить свободные участки (аукционы недоступны)</div>
      )}

      {showContestedBanner && contestedCount > 0 && (currentPhase === 'selection' || currentPhase === 'auction') && (
        <div className="contested-banner">
          <span className="contested-banner-icon">⚔️</span>
          <div className="contested-banner-text">
            <strong>{contestedCount === 1 ? 'Ваш участок оспаривается!' : `${contestedCount} ваших участка оспариваются!`}</strong>
            <span>{Object.keys(myContestedCells).join(', ')} — другие команды зарегистрировались на аукцион за {contestedCount === 1 ? 'него' : 'них'}</span>
          </div>
        </div>
      )}

      {autoAssignBanner && (
        <div className="auto-assign-banner">
          <span className="auto-assign-banner-icon">🎲</span>
          <div className="auto-assign-banner-text">
            <strong>Участки назначены автоматически</strong>
            <span>Время допокупки истекло. Вам выданы свободные участки: <strong>{autoAssignBanner.cells.join(', ')}</strong></span>
          </div>
          <button className="auto-assign-banner-close" onClick={() => setAutoAssignBanner(null)}>✕</button>
        </div>
      )}

      {showNirHint && (
        <div className="nir-hint-overlay" onClick={() => setShowNirHint(false)}>
          <div className="nir-hint-modal" onClick={e => e.stopPropagation()}>
            <div className="nir-hint-icon">🗺️</div>
            <div className="nir-hint-title">Карта региона завершена!</div>
            <div className="nir-hint-text">
              Теперь переходите к&nbsp;
              <strong>Научным исследованиям (НИР)</strong>&nbsp;—
              это первый шаг работы на вашем лицензионном участке.
            </div>
            <div className="nir-hint-actions">
              <button className="nir-hint-btn-secondary" onClick={() => setShowNirHint(false)}>
                Остаться на карте
              </button>
              {onNext && (
                <button className="nir-hint-btn-primary" onClick={() => { setShowNirHint(false); onNext(); }}>
                  Перейти к НИР →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="map-controls">
        <button className={`control-btn back-control-btn ${isOurPhase ? 'control-btn-locked' : ''}`} onClick={isOurPhase ? undefined : onBack} disabled={isOurPhase} title={isOurPhase ? 'Дождитесь завершения всех этапов карты региона' : ''}>← Назад</button>
        <button className={`control-btn back-control-btn ${isOurPhase ? 'control-btn-locked' : ''}`} onClick={isOurPhase ? undefined : onMenu} disabled={isOurPhase} title={isOurPhase ? 'Дождитесь завершения всех этапов карты региона' : ''}>В меню</button>
        {onNext && (() => {
          const mapDone = !isOurPhase && serverPhase !== 'LOBBY' && !isRegionMapPhase(serverPhase);
          const hasLUs = ownedCount > 0;
          if (mapDone && hasLUs) return <button className="control-btn next-control-btn" onClick={onNext}>Далее — Научные исследования</button>;
          const hint = isOurPhase ? `Дождитесь завершения всех этапов карты` : !hasLUs ? 'Сначала выберите хотя бы один участок' : 'Ожидайте завершения всех этапов карты';
          return <button className="control-btn next-control-btn next-control-btn-disabled" disabled title={hint}>{isOurPhase ? `⏳ Идёт ${currentPhase === 'selection' ? 'выбор участков' : currentPhase === 'auction' ? 'аукцион' : 'допокупка'}…` : 'Далее — Научные исследования'}</button>;
        })()}
      </div>

      {import.meta.env.DEV && currentPhase === 'auction' && (
        <div style={{ position: 'fixed', bottom: '20px', left: '380px', zIndex: 1000, display: 'flex', gap: '8px' }}>
          <button className="dev-sim-btn" onClick={simulationActive ? stopBidSimulation : startBidSimulation} style={{ backgroundColor: simulationActive ? '#f44336' : '#4caf50', color: 'white', fontWeight: 700 }}>
            {simulationActive ? 'STOP симуляция' : 'START симуляция ставок'}
          </button>
          {Object.keys(auctions.active).length > 0 && (
            <button className="dev-sim-btn" style={{ backgroundColor: '#ff9800', color: 'white', fontWeight: 700 }} onClick={() => { const keys = Object.keys(auctions.active); simulateOtherTeamBid(keys[Math.floor(Math.random() * keys.length)]); }}>DEV: перебить ставку</button>
          )}
        </div>
      )}

      <div className={`game-info-panel ${!isWideScreen ? 'ultra-compact' : ''}`}>
        {!isWideScreen ? (
          <>
            <div className="info-row"><span className="info-label">Карточки:</span><span className="info-value">{selectedLU.length}</span></div>
            <div className="info-row"><span className="info-label">Участки:</span><span className={`info-value ${ownedCount >= MAX_LUS_PER_TEAM ? 'limit-reached' : ''}`}>{ownedCount}/{MAX_LUS_PER_TEAM}</span></div>
            <div className="lu-limit-bar-track">
              <div className="lu-limit-bar-fill" style={{ width: `${Math.min(100, (ownedCount / MAX_LUS_PER_TEAM) * 100)}%`, background: ownedCount >= MAX_LUS_PER_TEAM ? '#ef4444' : ownedCount >= MAX_LUS_PER_TEAM - 1 ? '#f59e0b' : '#2fa394' }} />
            </div>
            {myAuctionCells.length > 0 && <div className="info-row"><span className="info-label">Аукционы:</span><span className="info-value auction-count">{myAuctionCells.length}</span></div>}
            {contestedCount > 0 && <div className="info-row contested-info-row"><span className="info-label">⚔️ Оспор.:</span><span className="info-value contested-value">{contestedCount}</span></div>}
            <div className="info-row"><span className="info-label">Всего:</span><span className={`info-value ${totalCommittedCells >= MAX_LUS_PER_TEAM ? 'limit-reached' : ''}`}>{totalCommittedCells}/{MAX_LUS_PER_TEAM}</span></div>
            <div className="info-row icons-only"><span className="info-value budget-value">{budget.toLocaleString('ru-RU')} млн</span><span className="info-value spent-value">{totalSpent} млн</span></div>
            {selectedLU.length > 0 && (
              <div className="compact-cards-mini-list">
                {selectedLU.map(lu => (
                  <div key={lu.id} className="compact-card-mini-item" onClick={() => { setViewMode('button'); setSelectedInfoCard(lu); setShowInfoCards(true); }}>
                    <span className="compact-card-mini-title">{lu.name}</span>
                    <span className="compact-card-mini-cost">{lu.cost} млн</span>
                    <span className="compact-card-mini-hint">→</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="info-row"><span className="info-label">Карточки информации:</span><span className="info-value">{selectedLU.length}</span></div>
            <div className="info-row"><span className="info-label">Выбрано участков:</span><span className={`info-value ${ownedCount >= MAX_LUS_PER_TEAM ? 'limit-reached' : ''}`}>{ownedCount} / {MAX_LUS_PER_TEAM}</span></div>
            <div className="lu-limit-bar-track">
              <div className="lu-limit-bar-fill" style={{ width: `${Math.min(100, (ownedCount / MAX_LUS_PER_TEAM) * 100)}%`, background: ownedCount >= MAX_LUS_PER_TEAM ? '#ef4444' : ownedCount >= MAX_LUS_PER_TEAM - 1 ? '#f59e0b' : '#2fa394' }} />
            </div>
            {myAuctionCells.length > 0 && <div className="info-row"><span className="info-label">Зарегистрировано на аукционы:</span><span className="info-value auction-count">{myAuctionCells.length}</span></div>}
            {contestedCount > 0 && (
              <div className="contested-cells-block">
                <div className="contested-cells-title"><span>⚔️ Ваши участки оспариваются</span><span className="contested-cells-count">{contestedCount}</span></div>
                <div className="contested-cells-list">
                  {Object.entries(myContestedCells).map(([ref, auction]) => {
                    const competitors = (auction.participants || []).filter(p => p !== myId);
                    return (
                      <div key={ref} className="contested-cell-row">
                        <span className="contested-cell-ref">{ref}</span>
                        <span className="contested-cell-info">{competitors.length} {competitors.length === 1 ? 'претендент' : 'претендента'}</span>
                        <span className="contested-cell-hint">аукцион ждёт</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="info-row"><span className="info-label">Бюджет:</span><span className="info-value budget-value">{budget.toLocaleString('ru-RU')} млн руб.</span></div>
            <div className="info-row"><span className="info-label">Потрачено:</span><span className="info-value spent-value">{totalSpent.toLocaleString('ru-RU')} млн руб.</span></div>
            {/* {isOnline() && <div className="info-row"><span className="info-label">Онлайн</span><span className="info-value" style={{ color: '#4caf50' }}>синхронизировано</span></div>} */}
            {myAuctionCells.length > 0 && currentPhase === 'selection' && (
              <div className="pending-auctions-list">
                <div className="pending-auctions-title">Ожидание аукционов:</div>
                {myAuctionCells.map(ref => <div key={ref} className="pending-auction-item"><span className="pending-auction-cell">WAIT {ref}</span></div>)}
              </div>
            )}

            {ownedCount > 0 && (
              <div className="owned-cells-list">
                <div className="owned-cells-title">Ваши участки:</div>
                {Object.values(ownedCells).map(cell => (
                  <div key={cell.cellRef} className={`owned-cell-item owned-cell-item-static ${myContestedCells[cell.cellRef] ? 'owned-cell-item-contested' : ''} ${cell.isAutoAssigned ? 'owned-cell-item-auto' : ''}`}>
                    <span className="owned-cell-ref">{cell.cellRef}</span>
                    {myContestedCells[cell.cellRef] && <span className="owned-cell-contested-icon" title="Другая команда претендует на этот участок">⚔️</span>}
                    {cell.isAutoAssigned && <span className="owned-cell-auto-icon" title="Участок выдан автоматически">🎲</span>}
                    <span className="owned-cell-name">{cell.name}</span>
                    {cell.auctionPrice ? <span className="owned-cell-price">{cell.auctionPrice} млн</span> : <span className="owned-cell-free">{cell.isAutoAssigned ? 'авто' : ''}</span>}
                  </div>
                ))}
              </div>
            )}
                        {selectedLU.length > 0 && (
              <div className="info-panel-section">
                <h4 className="info-panel-section-title">Карточки информации <span className="section-title-count">{selectedLU.length}</span></h4>
                <div className="info-panel-cards-list">
                  {selectedLU.map(lu => (
                    <div key={lu.id} className="info-panel-card-item" onClick={() => { setViewMode('sidebar'); setSelectedInfoCard(lu); }}>
                      <div className="info-panel-card-header"><span className="info-panel-card-title">{lu.name}</span><span className="info-panel-card-cost">{lu.cost} млн руб.</span></div>
                      <div className="info-panel-card-footer"><span className="info-panel-card-hint">Подробнее →</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedLU.length > 0 && isWideScreen && (
        <div className="info-cards-sidebar">
          <h3>Карточки информации</h3>
          <div className="compact-cards-list">
            {selectedLU.map(lu => (
              <div key={lu.id} className="compact-info-card" onClick={() => { setViewMode('sidebar'); setSelectedInfoCard(lu); }}>
                <div className="compact-card-header"><span className="compact-card-title">{lu.name}</span><span className="compact-card-cost">{lu.cost} млн руб.</span></div>
                <div className="compact-card-hint">Подробнее →</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="vertical-title"><div className="vertical-title-text">Карта региона</div></div>

      <div className="map-main-area">
        <div className="grid-with-lu-wrapper">
          <div className="grid-column-headers">
            <div className="grid-corner"></div>
            {cols.map(col => <div key={col} className="grid-header-cell">{col}</div>)}
          </div>
          <div className="grid-content-wrapper">
            <div className="grid-row-headers">
              {rows.map(row => <div key={row} className="grid-row-header">{row}</div>)}
            </div>
            <div className="grid-with-lu" style={{ position: 'relative' }}>
              {rows.map(row => (
                <div key={row} className="grid-row">
                  {cols.map(col => {
                    const cellId = `${row}${col}`;
                    const lu = getLUPosition(cellId);
                    const ownedByMe = isOwnedByMe(cellId);
                    const ownedByOther = isOwnedByOther(cellId);
                    const hasActiveAuction = !!auctions.active[cellId];
                    const blockedType = getBlockedType(cellId);
                    const isPendingAuction = isRegisteredForAuction(cellId);
                    const isContested = isMyContestedCell(cellId);
                    const isAutoAssigned = ownedCells[cellId]?.isAutoAssigned;
                    const isDisabled = !isOurPhase || (currentPhase === 'auction' && !hasActiveAuction);
                    const cellScenario = (!ownedByMe && !ownedByOther && (!blockedType || blockedType === 'company'))
                      ? cellScenarios[cellId]
                      : null;

                    // Сценарий ячейки нефтяной компании — показываем всем командам даже после обмена
                    const companyCellScenario = ownedByOther && cellScenarios[cellId]?.srrWorkId
                      ? cellScenarios[cellId]
                      : null;

                    const enemyCompanySceneImg = (() => {
                      if (!companyCellScenario) return null;
                      const scenNum = getScenario(cellId) ?? 0;
                      const maxRows = WORK_SCENE_MAP[companyCellScenario.workId]?.rows ?? 3;
                      const rank = Math.min(companyCellScenario.rank ?? 1, maxRows);
                      return resolveSceneImage(scenNum, companyCellScenario.workId, rank, 'к') ?? null;
                    })();

                    const sceneImg = ownedByMe
                      ? (() => {
                          const fwImg = getLastSuccessfulSceneImage(
                            cellId,
                            fieldWork.selectionsByLU[cellId],
                            events,
                            globalTimer.currentYear,
                          );
                          if (fwImg) return fwImg;
                          // Участок получен от нефтяной компании — показываем сценарий до начала полевых работ
                          const cs = cellScenarios[cellId];
                          if (cs?.workId) {
                            const scenNum = getScenario(cellId) ?? 0;
                            const maxRows = WORK_SCENE_MAP[cs.workId]?.rows ?? 3;
                            const rank = Math.min(cs.rank ?? 1, maxRows);
                            return resolveSceneImage(scenNum, cs.workId, rank, 'к') ?? null;
                          }
                          return null;
                        })()
                      : null;

                    const enemyCellData  = otherTeamsScene[cellId];
                    const enemySceneImg  = ownedByOther && enemyCellData
                      ? getSceneImageFromMeta(
                          cellId,
                          enemyCellData.metaByYear,
                          enemyCellData.evScoreByYear,
                        )
                      : null;

                    // Картинка сценария для свободной ячейки
                    const scenarioImg = (() => {
                      if (!cellScenario || hasActiveAuction || isPendingAuction) return null;
                      const scenNum = getScenario(cellId) ?? 0;
                      const rawRank = scenNum <= 1 ? 1 : scenNum <= 3 ? 2 : 3;
                      const maxRows  = WORK_SCENE_MAP[cellScenario.workId]?.rows ?? 3;
                      const rank     = Math.min(rawRank, maxRows);
                      return resolveSceneImage(scenNum, cellScenario.workId, rank, 'к');
                    })();

                    return (
                      <div key={cellId} className="cell-with-lu-wrapper">
                        <div
                          className={['grid-cell', ownedByMe && isContested ? 'grid-cell-contested' : '', ownedByMe && !isContested && isAutoAssigned ? 'grid-cell-auto' : '', ownedByMe && !isContested && !isAutoAssigned ? 'grid-cell-owned' : '', ownedByOther ? 'grid-cell-other' : '', hasActiveAuction ? 'grid-cell-auction' : '', isPendingAuction ? 'grid-cell-pending-auction' : '', blockedType ? `grid-cell-blocked grid-cell-blocked-${blockedType}` : '', isDisabled ? 'grid-cell-disabled' : ''].filter(Boolean).join(' ')}
                          onClick={() => handleGridCellClick(cellId)}
                          onMouseMove={(e) => setCellTooltip({ cellId, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setCellTooltip(null)}
                        >
                          {sceneImg ? (
                            <div className="cell-scene-img-wrap">
                              <img src={sceneImg} alt={cellId} className="cell-scene-img" />
                              <div className="cell-scene-owned-overlay" />
                              <span className="cell-scene-owned-badge">
                                {isContested ? '⚔' : isAutoAssigned ? '🎲' : '★'}
                              </span>
                              <span className="cell-scene-label">{cellId}</span>
                            </div>
                          ) : (
                            <>
                              {!scenarioImg && <span className="cell-label">{cellId}</span>}
                              {ownedByMe && isContested && <span className="cell-mark cell-mark-contested">⚔</span>}
                              {ownedByMe && !isContested && isAutoAssigned && <span className="cell-mark cell-mark-auto">🎲</span>}
                              {ownedByMe && !isContested && !isAutoAssigned && <span className="cell-mark cell-mark-own">OK</span>}
                            </>
                          )}
                          {!sceneImg && ownedByOther && !enemySceneImg && !enemyCompanySceneImg && <span className="cell-mark cell-mark-other">!</span>}
                          {!sceneImg && ownedByOther && (enemySceneImg || enemyCompanySceneImg) && (
                            <div className="cell-scene-img-wrap">
                              <img src={enemySceneImg ?? enemyCompanySceneImg} alt={cellId} className="cell-scene-img" />
                              <div className="cell-scene-enemy-overlay" />
                              {!companyCellScenario && <span className="cell-scene-enemy-badge">!</span>}
                              <span className="cell-scene-label">{cellId}</span>
                              {companyCellScenario && (
                                <div className="cell-scenario-img-badge">
                                  {SCENARIO_WORK_LABELS[companyCellScenario.workId] ?? companyCellScenario.workId}
                                </div>
                              )}
                            </div>
                          )}
                          {!sceneImg && !enemySceneImg && hasActiveAuction && !ownedByMe && !ownedByOther && <span className="cell-mark cell-mark-auction">LIVE</span>}
                          {!sceneImg && !enemySceneImg && isPendingAuction && <span className="cell-mark cell-mark-pending">WAIT</span>}
                          {!sceneImg && blockedType && !scenarioImg && <span className="cell-mark cell-mark-blocked"></span>}
                          {!sceneImg && !enemySceneImg && isDisabled && !blockedType && !hasActiveAuction && <span className="cell-mark cell-mark-timer"></span>}
                          {cellScenario && !hasActiveAuction && !isPendingAuction && (
                            scenarioImg ? (
                              <div className="cell-scene-img-wrap cell-scene-scenario">
                                <img src={scenarioImg} alt={cellId} className="cell-scene-img" />
                                <span className="cell-scene-label">{cellId}</span>
                                <div className="cell-scenario-img-badge">
                                  {SCENARIO_WORK_LABELS[cellScenario.workId] ?? cellScenario.workId}
                                </div>
                              </div>
                            ) : (
                              <div className="cell-scenario-badge">
                                <span className="cell-scenario-work">{SCENARIO_WORK_LABELS[cellScenario.workId] ?? cellScenario.workId}</span>
                              </div>
                            )
                          )}
                        </div>

                        {lu && (
                          <div className="lu-container">
                            <div
                              className={['lu-marker', isLUSelected(lu.id) ? 'selected' : '', !canAffordLU(lu) && !isLUSelected(lu.id) ? 'disabled' : '', !canBuyCells() && !isLUSelected(lu.id) ? 'timer-disabled' : ''].filter(Boolean).join(' ')}
                              style={lu.customStyle}
                              onClick={() => handleLUClick(lu)}
                              onMouseEnter={() => setHoveredLU(lu.id)}
                              onMouseLeave={() => setHoveredLU(null)}
                              title={`${lu.name} - ${lu.cost} млн руб.`}
                            >
                              <span className="lu-marker-number">{lu.shortName}</span>
                              {isLUSelected(lu.id) && <span className="lu-marker-check"></span>}
                            </div>
                            <div className="lu-name-label" style={{ position: 'absolute', top: lu.customStyle?.top || '0', left: lu.labelLeft ?? lu.customStyle?.left ?? '0', transform: getLUNamePosition(lu.position), whiteSpace: 'nowrap' }}>
                              <div className="lu-name-text">{lu.name}</div>
                              <div className="lu-cost-text">{lu.cost} млн руб.</div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              {globalTimer.currentYear >= 9 && (
                <img
                  src={NeftImg}
                  alt="Точка сдачи нефти"
                  className="neft-point-marker"
                  style={{
                    position: 'absolute',
                    left: 401,
                    top: 267,
                    width: 48,
                    height: 48,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10,
                    cursor: 'default',
                  }}
                  onMouseMove={(e) => setCellTooltip({ cellId: '__neft_point__', x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setCellTooltip(null)}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="map-legend">
        <div className="legend-title">Легенда</div>
        <div className="legend-item"><div className="legend-color legend-color-own"></div><span>Ваш участок</span></div>
        <div className="legend-item"><div className="legend-color legend-color-contested"></div><span>Оспаривается</span></div>
        <div className="legend-item"><div className="legend-color legend-color-auction"></div><span>Аукцион</span></div>
        <div className="legend-item"><div className="legend-color legend-color-other"></div><span>Занят другой командой</span></div>
        <div className="legend-item"><div className="legend-color legend-color-blocked-reserve"></div><span>Природный заказник</span></div>
        <div className="legend-item"><div className="legend-color legend-color-blocked-settlement"></div><span>Населённый пункт</span></div>
        <div className="legend-item"><div className="legend-color legend-color-blocked-company"></div><span>Другие компании</span></div>
      </div>

      {cellTooltip && (() => {
        const { title, sub } = getCellTooltipContent(cellTooltip.cellId);
        return (
          <div className="cell-tooltip" style={{ left: cellTooltip.x + 14, top: cellTooltip.y - 10 }}>
            <div className="cell-tooltip-title">{title}</div>
            <div className="cell-tooltip-sub">{sub}</div>
          </div>
        );
      })()}

      <AuctionDashboard auctions={auctions} player={player} budget={budget} onPlaceBid={handleDashboardBid} onLeaveAuction={handleDashboardLeave} currentPhase={currentPhase} />

      {selectedInfoCard && viewMode === 'sidebar' && (
        <div className="modal-overlay" onClick={() => { setSelectedInfoCard(null); setViewMode(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setSelectedInfoCard(null); setViewMode(null); }}>✕</button>
            <h2>{selectedInfoCard.name}</h2>
            {selectedInfoCard.hasImage && <div className="card-image-wrap"><img src={selectedInfoCard.imagePath} alt={selectedInfoCard.name} /></div>}
            <div className="card-description">{selectedInfoCard.description}</div>
            <div className="card-meta"><span>Стоимость: <strong>{selectedInfoCard.cost} млн руб.</strong></span></div>
          </div>
        </div>
      )}

      {showInfoCards && viewMode === 'button' && (
        <div className="modal-overlay" onClick={() => { setShowInfoCards(false); setSelectedInfoCard(null); setViewMode(null); }}>
          <div className="modal-content modal-list" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setShowInfoCards(false); setSelectedInfoCard(null); setViewMode(null); }}>✕</button>
            <h2>Информация о карточках</h2>
            <div className="cards-grid">
              {selectedLU.map(lu => (
                <div key={lu.id} className="info-card">
                  <div className="info-card-header">
                    <div className="info-card-icon">{lu.shortName}</div>
                    <div className="info-card-title-block"><h3>{lu.name}</h3><span className="info-card-cost">{lu.cost} млн руб.</span></div>
                  </div>
                  {lu.hasImage && <div className="info-card-image"><img src={lu.imagePath} alt={lu.name} /></div>}
                  <div className="info-card-description">{lu.description}</div>
                  <div className="info-card-footer"><span>Ячейка: {lu.cellRef}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={!!luConfirmModal} onClose={() => setLuConfirmModal(null)} onConfirm={confirmBuyLU} title="Купить карточку информации?" confirmLabel={`Купить за ${luConfirmModal?.lu.cost} млн руб.`} cancelLabel="Отмена">
        {luConfirmModal && (
          <div className="confirm-purchase-details">
            <div className="confirm-card-header-row"><div className="confirm-card-icon">{luConfirmModal.lu.shortName}</div><div className="confirm-card-name">{luConfirmModal.lu.name}</div></div>
            <div className="confirm-budget-row"><span>Стоимость:</span><strong>{luConfirmModal.lu.cost.toLocaleString('ru-RU')} млн руб.</strong></div>
            <div className="confirm-budget-row"><span>Бюджет после покупки:</span><strong className={budget - luConfirmModal.lu.cost < 0 ? 'text-danger' : 'text-success'}>{(budget - luConfirmModal.lu.cost).toLocaleString('ru-RU')} млн руб.</strong></div>
          </div>
        )}
      </ConfirmModal>

      <ConfirmModal isOpen={!!gridConfirmModal && gridConfirmModal.mode !== 'leave'} onClose={() => setGridConfirmModal(null)} onConfirm={confirmGridAction} title={gridConfirmModal?.mode === 'buy' ? `Приобрести участок ${gridConfirmModal?.cellRef}?` : `Зарегистрироваться на аукцион за участок ${gridConfirmModal?.cellRef}?`} confirmLabel={gridConfirmModal?.mode === 'buy' ? 'Приобрести участок' : 'Зарегистрироваться на аукцион'} cancelLabel="Отмена">
        {gridConfirmModal?.mode === 'buy' && (
          <div className="confirm-purchase-details">
            <div className="confirm-cell-ref">{gridConfirmModal.cellRef}</div>
            <p>Вы выбираете лицензионный участок <strong>{gridConfirmModal.cellRef}</strong></p>
            <div className="confirm-stats-row"><div className="confirm-stat"><span className="confirm-stat-label">Участков:</span><span className="confirm-stat-value">{ownedCount + 1} / {MAX_LUS_PER_TEAM}</span></div></div>
          </div>
        )}
        {gridConfirmModal?.mode === 'auction' && (
          <div className="confirm-purchase-details">
            <div className="confirm-cell-ref">{gridConfirmModal.cellRef}</div>
            <p>Участок <strong>{gridConfirmModal.cellRef}</strong> занят командой <strong>«{gridConfirmModal.ownerTeam}»</strong>.</p>
            <p>Вы будете участвовать в аукционе на этот участок после завершения фазы выбора.</p>
            <div className="confirm-auction-info">
              <div className="confirm-auction-row"><span>Начальная цена:</span><strong>{AUCTION_START_PRICE} млн руб.</strong></div>
              <div className="confirm-auction-row"><span>Шаг ставки:</span><strong>{AUCTION_START_PRICE} млн руб.</strong></div>
            </div>
          </div>
        )}
      </ConfirmModal>

      <ConfirmModal isOpen={!!gridConfirmModal && gridConfirmModal.mode === 'leave'} onClose={() => setGridConfirmModal(null)} onConfirm={confirmLeaveAuction} title={`Покинуть аукцион за участок ${gridConfirmModal?.cellRef}?`} confirmLabel="Покинуть аукцион" cancelLabel="Остаться" confirmVariant="danger">
        {gridConfirmModal?.mode === 'leave' && (
          <div className="confirm-purchase-details">
            {gridConfirmModal.weAreLeading && <div className="confirm-warning-box">⚠️ Вы сейчас <strong>лидируете</strong> в этом аукционе!</div>}
            <p>{gridConfirmModal.message}</p>
          </div>
        )}
      </ConfirmModal>

      <NoInfoCardModal isOpen={noCardModal} onClose={() => setNoCardModal(false)} onGoToBuyCard={() => setNoCardModal(false)} />
      <AlertModal isOpen={!!alertModal} onClose={() => setAlertModal(null)} title={alertModal?.title || 'Внимание'}><p>{alertModal?.message}</p></AlertModal>

      <RegionMapTour onDone={() => {}} maxLUs={MAX_LUS_PER_TEAM} />
    </div>
  );
};

export default RegionMap;