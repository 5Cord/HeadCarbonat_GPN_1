// RegionMap.jsx
import React, { useState, useEffect, useRef } from 'react';
import './RegionMap.css';
import useGameStore, { AUCTION_START_PRICE } from '../../store/gameStore';
import AuctionDashboard from './AuctionDashboard'; // ← новый компонент
import {
  saveTeamProgress,
  getSessionStatus,
  placeBidOnAuction,
  finalizeTeamSelection
} from '../apiHelpers';

const LICENSE_UNITS = [
  { id: 'well1', name: 'Парам. скважина №1', shortName: '1', cost: 10, cellRef: 'A2', position: 'top-left', customStyle: { top: '-130px', left: '0px' }, description: 'Целевой комплекс: светлые слоистые строматолитовые доломиты с прослоями гипса и ангидрита. Свойства: доломиты слабо пористые, с редкими выпотами густой нефти.', hasImage: false },
  { id: 'well2', name: 'Парам. скважина №2', shortName: '2', cost: 10, cellRef: 'A5', position: 'top-left', customStyle: { top: '-130px', left: '0px' }, description: 'Целевой комплекс: светлые тонкослоистые известняки и доломиты, прослоями зернистые. Свойства: межзерновая пористость, признаки нефтенасыщения по порам.', hasImage: false },
  { id: 'seismic', name: 'ОиИ архивных СРР 2Д', shortName: 'И', cost: 30, cellRef: 'A10', position: 'corner-bottom-left', customStyle: { top: '-130px', left: '80px' }, description: 'По данным 2D сейсморазведки выделяются ориентированные с ЮЗ на СВ объекты, похожие на структурные валы. В центральной части территории между ними фиксируется палеопрогиб.', hasImage: false },
  { id: 'well3', name: 'Парам. скважина №3', shortName: '3', cost: 10, cellRef: 'B10', position: 'right', customStyle: { top: '0', left: '85px' }, description: 'Целевой комплекс: тонкослоистые черные кремнистые известняки с повышенным содержанием Сорг (органического углерода). Свойства: мощность комплекса сильно сокращена.', hasImage: false },
  { id: 'well4', name: 'Парам. скважина №4', shortName: '4', cost: 20, cellRef: 'E10', position: 'right', customStyle: { top: '0px', left: '85px' }, description: 'Целевой комплекс: массивные трещиновато-кавернозные известняки с кораллами и губками. Свойства: по кавернам обильные выполы (выпоты) нефти.', hasImage: false },
  { id: 'well5', name: 'Парам. скважина №5', shortName: '5', cost: 20, cellRef: 'J8', position: 'right', customStyle: { top: '85px', left: '0px' }, description: 'Целевой комплекс: светлые слоистые известняки и доломиты (зернистые и микритовые). Свойства: прослоями породы пористые, с признаками углеводородов (УВ).', hasImage: false },
  { id: 'well6', name: 'Парам. скважина №6', shortName: '6', cost: 10, cellRef: 'J3', position: 'right', customStyle: { top: '85px', left: '0px' }, description: 'Целевой комплекс: тонкослоистые черные кремнистые известняки с повышенным содержанием Сорг, с остатками планктонной фауны. Свойства: мощность комплекса сильно сокращена.', hasImage: false },
  { id: 'research', name: 'Региональная НИР', shortName: 'Н', cost: 70, cellRef: 'J1', position: 'corner-top-right', customStyle: { top: '85px', left: '-118px' }, description: 'Выполнены: КГМ, СГМ, БМ, оценка ресурсов. Карта плотности ресурсов УВ (тыс. т. у.в. на кв. км): 10-50, 5-10, <5.', hasImage: true, imagePath: '/src/svgs/RegNir.svg' },
  { id: 'quarry', name: 'Карьер', shortName: 'К', cost: 20, cellRef: 'F1', position: 'left', customStyle: { top: '0', left: '-130px' }, description: 'Горные породы: известняки и доломиты массивные, химически чистые, органогенные, кавернозно-трещиноватые. Тип: разрабатываемый содовый карьер.', hasImage: false },
  { id: 'outcrop', name: 'Обнажение', shortName: 'О', cost: 10, cellRef: 'D1', position: 'left', customStyle: { top: '0', left: '-130px' }, description: 'Горные породы: ритмично-слоистые светло-серые известняки и доломиты с микробиальными биотермами до 10 м толщиной. Встречаются поры, каверны и трещины с запахом УВ.', hasImage: false },
];

const BLOCKED_CELLS = {
  reserve: ['C3', 'C4', 'D3', 'D4'],
  settlement: ['G6', 'G7', 'H6', 'H7'],
  company: ['B5', 'C5', 'B6', 'C6'],
};

const SELECTION_DURATION = 0.3 * 60;
const AUCTION_DURATION = 1 * 60;
const POST_AUCTION_TIME = 0.3 * 60;

const RM_WARNING_5MIN = 0.3 * 60;
const RM_WARNING_2MIN = 0.3 * 60;
const RM_WARNING_30SEC = 0.3;

const TIMER_STORAGE_KEY = 'regionMap_timer';
const PHASE_STORAGE_KEY = 'regionMap_phase';

const formatTime = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
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

// ──────────────────────────────────────────────
// Универсальное модальное окно подтверждения
// ──────────────────────────────────────────────
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, children, confirmLabel = 'Подтвердить', cancelLabel = 'Отмена', confirmVariant = 'primary' }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content confirm-modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>{title}</h2>
        <div className="confirm-modal-body">{children}</div>
        <div className="modal-actions">
          <button
            className={`modal-btn modal-btn-${confirmVariant}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────
// Модальное окно «сначала купи карточку»
// ──────────────────────────────────────────────
const NoInfoCardModal = ({ isOpen, onClose, onGoToBuyCard }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content confirm-modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="no-card-modal-icon">🗂️</div>
        <h2>Нужна карточка информации</h2>
        <div className="confirm-modal-body">
          <p>
            Прежде чем выбирать лицензионный участок, необходимо приобрести хотя бы одну
            <strong> карточку информации</strong>.
          </p>
          <p className="confirm-modal-hint">
            Карточки содержат геологические данные о регионе и помогают сделать обоснованный выбор участка.
          </p>
        </div>
        <div className="modal-actions">
          <button className="modal-btn modal-btn-primary" onClick={onGoToBuyCard}>
            Купить карточку
          </button>
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────
// Модальное окно предупреждения (без confirm)
// ──────────────────────────────────────────────
const AlertModal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content confirm-modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>{title}</h2>
        <div className="confirm-modal-body">{children}</div>
        <div className="modal-actions">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

const RegionMap = ({ onComplete, onNext }) => {
  const {
    player, licenseUnits, gridCells, auctions,
    purchaseLU, purchaseGridCell, placeBid, finalizeAuction,
    registerForAuction, getMyAuctionParticipation, simulateOtherTeamOwns,
    unpurchaseGridCell, unregisterFromAuction
  } = useGameStore();

  const budget = player.budget;
  const selectedLU = licenseUnits.owned;
  const ownedCells = gridCells.owned;
  const ownedCount = Object.keys(ownedCells).length;
  const myAuctionCells = getMyAuctionParticipation();
  const totalCommittedCells = ownedCount + myAuctionCells.length;

  const [hoveredLU, setHoveredLU] = useState(null);
  const [showInfoCards, setShowInfoCards] = useState(false);
  const [selectedInfoCard, setSelectedInfoCard] = useState(null);
  const [isWideScreen, setIsWideScreen] = useState(window.innerWidth > 1580);
  const [viewMode, setViewMode] = useState(null);

  // ── auctionModal убран — заменён на AuctionDashboard ──
  // Оставляем его только для legacy-открытия из старых мест (не используется в новом флоу)
  const [auctionModal, setAuctionModal] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [auctionMsg, setAuctionMsg] = useState('');

  const [simulationActive, setSimulationActive] = useState(false);
  const simulationIntervalRef = useRef(null);

  const [showPostAuctionBanner, setShowPostAuctionBanner] = useState(false);
  const bannerTimerRef = useRef(null);

  const [currentPhase, setCurrentPhase] = useState(() => localStorage.getItem(PHASE_STORAGE_KEY) || 'selection');
  const [timeRemaining, setTimeRemaining] = useState(() => {
    const saved = localStorage.getItem(TIMER_STORAGE_KEY);
    if (saved) {
      const { remaining, timestamp } = JSON.parse(saved);
      const elapsed = Math.floor((Date.now() - timestamp) / 1000);
      return Math.max(0, remaining - elapsed);
    }
    return SELECTION_DURATION;
  });

  const [teamFinished, setTeamFinished] = useState(false);
  const [waitingForOthers, setWaitingForOthers] = useState(false);

  const timerRef = useRef(null);
  const pollingRef = useRef(null);

  // ── Модальные окна ──────────────
  const [luConfirmModal, setLuConfirmModal] = useState(null);
  const [gridConfirmModal, setGridConfirmModal] = useState(null);
  const [noCardModal, setNoCardModal] = useState(false);
  const [alertModal, setAlertModal] = useState(null);

  const showAlert = (title, message) => setAlertModal({ title, message });

  useEffect(() => {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({ remaining: timeRemaining, timestamp: Date.now() }));
  }, [timeRemaining]);

  useEffect(() => {
    localStorage.setItem(PHASE_STORAGE_KEY, currentPhase);
  }, [currentPhase]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (teamFinished && !waitingForOthers) {
      setWaitingForOthers(true);
      startPolling();
    }
  }, [teamFinished]);

  useEffect(() => {
    if (currentPhase === 'post_auction') {
      setShowPostAuctionBanner(true);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = setTimeout(() => setShowPostAuctionBanner(false), 10000);
    } else {
      setShowPostAuctionBanner(false);
      if (bannerTimerRef.current) { clearTimeout(bannerTimerRef.current); bannerTimerRef.current = null; }
    }
    return () => { if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current); };
  }, [currentPhase]);

  useEffect(() => {
    if (currentPhase !== 'auction' && simulationActive) stopBidSimulation();
  }, [currentPhase]);

  useEffect(() => {
    if (timeRemaining <= 0 && currentPhase !== 'finished') {
      handlePhaseTransition();
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); handlePhaseTransition(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timeRemaining, currentPhase]);

  const startPolling = () => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      try {
        const sessionId = player.sessionId;
        if (!sessionId) return;
        const status = await getSessionStatus(sessionId);
        if (status.phase === 'auction') {
          setCurrentPhase('auction');
          setTimeRemaining(AUCTION_DURATION);
          setWaitingForOthers(false);
          clearInterval(pollingRef.current); pollingRef.current = null;
        } else if (status.phase === 'finished') {
          setCurrentPhase('finished');
          setWaitingForOthers(false);
          clearInterval(pollingRef.current); pollingRef.current = null;
        }
      } catch (error) { console.error('Polling error:', error); }
    }, 2000);
  };

  const handlePhaseTransition = () => {
    if (currentPhase === 'selection') {
      setCurrentPhase('auction');
      setTimeRemaining(AUCTION_DURATION);
      setTeamFinished(false);
      setWaitingForOthers(false);
    } else if (currentPhase === 'auction') {
      Object.keys(auctions.active).forEach(cellRef => finalizeAuction(cellRef));
      setCurrentPhase('post_auction');
      setTimeRemaining(POST_AUCTION_TIME);
    } else if (currentPhase === 'post_auction') {
      setCurrentPhase('finished');
    }
  };

  const handleFinishSelection = async () => {
    if (ownedCount === 0 && myAuctionCells.length === 0) {
      showAlert('Нет выбранных участков', 'Выберите хотя бы один лицензионный участок или зарегистрируйтесь на аукцион перед завершением.');
      return;
    }
    try {
      const sessionId = player.sessionId;
      const teamId = player.teamId || player.name;
      await finalizeTeamSelection(sessionId, teamId, {
        selectedCells: Object.keys(ownedCells),
        registeredAuctions: myAuctionCells,
        budget,
        timestamp: Date.now(),
      });
      setTeamFinished(true);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    } catch (error) {
      console.error('Error finishing selection:', error);
      showAlert('Ошибка', 'Ошибка при завершении выбора. Попробуйте снова.');
    }
  };

  const resetTimer = () => {
    setTimeRemaining(SELECTION_DURATION);
    setCurrentPhase('selection');
    setTeamFinished(false);
    setWaitingForOthers(false);
    localStorage.removeItem(TIMER_STORAGE_KEY);
    localStorage.removeItem(PHASE_STORAGE_KEY);
  };

  const simulateOtherTeamBid = (cellRef) => {
    const auction = auctions.active[cellRef];
    if (!auction) return;
    const otherTeamId = `team_comp_${Math.floor(Math.random() * 100)}`;
    const otherTeamName = `Конкурент ${Math.floor(Math.random() * 10)}`;
    const newBid = auction.currentBid + AUCTION_START_PRICE;
    const mockBid = { teamId: otherTeamId, teamName: otherTeamName, amount: newBid, timestamp: Date.now() };
    useGameStore.setState(state => {
      const targetAuction = state.auctions.active[cellRef];
      if (targetAuction) {
        targetAuction.currentBid = newBid;
        targetAuction.currentBidTeamId = otherTeamId;
        targetAuction.currentBidTeamName = otherTeamName;
        targetAuction.bids = [...(targetAuction.bids || []), mockBid];
        if (!targetAuction.participants.includes(otherTeamId))
          targetAuction.participants = [...targetAuction.participants, otherTeamId];
      }
      return state;
    });
  };

  const startBidSimulation = () => {
    if (simulationIntervalRef.current) return;
    simulationIntervalRef.current = setInterval(() => {
      const myId = player.teamId || player.name;
      const activeAuctions = Object.entries(auctions.active);
      const myAuctions = activeAuctions.filter(([, auction]) => auction.participants?.includes(myId));
      if (myAuctions.length > 0) {
        const [cellRef, auction] = myAuctions[Math.floor(Math.random() * myAuctions.length)];
        const otherTeamId = `team_auto_${Math.floor(Math.random() * 50)}`;
        const otherTeamName = `Автоконкурент ${Math.floor(Math.random() * 5)}`;
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

  const getTimerClass = () => {
    if (currentPhase === 'finished') return 'region-timer region-timer-finished';
    if (waitingForOthers) return 'region-timer region-timer-waiting';
    if (timeRemaining <= RM_WARNING_30SEC) return 'region-timer region-timer-critical';
    if (timeRemaining <= RM_WARNING_2MIN) return 'region-timer region-timer-warning';
    if (timeRemaining <= RM_WARNING_5MIN) return 'region-timer region-timer-alert';
    return 'region-timer';
  };

  const getTimerLabel = () => {
    if (waitingForOthers) return 'Ожидание других команд';
    if (currentPhase === 'finished') return 'Время вышло';
    if (currentPhase === 'auction') return 'Аукцион';
    if (currentPhase === 'post_auction') return 'Докупка участков';
    return 'Выбор участков';
  };

  const getTimerSubtitle = () => {
    if (waitingForOthers) return 'Вы завершили выбор';
    if (currentPhase === 'finished') return 'Переход к следующему этапу';
    if (currentPhase === 'auction') return 'Победит лидер по истечении времени';
    if (currentPhase === 'post_auction') return 'Только свободные участки (аукционы недоступны)';
    return 'Покупка лицензионных участков';
  };

  const getBlockedType = (cellRef) => {
    if (BLOCKED_CELLS.reserve.includes(cellRef)) return 'reserve';
    if (BLOCKED_CELLS.settlement.includes(cellRef)) return 'settlement';
    if (BLOCKED_CELLS.company.includes(cellRef)) return 'company';
    return null;
  };
  const isBlocked = (cellRef) => !!getBlockedType(cellRef);
  const getBlockedLabel = (type) => {
    switch (type) {
      case 'reserve': return 'Природный заказник';
      case 'settlement': return 'Населённый пункт';
      case 'company': return 'Занято нефтяной компанией';
      default: return 'Заблокировано';
    }
  };

  const isLUSelected = (luId) => selectedLU.some(lu => lu.id === luId);
  const canAffordLU = (lu) => {
    if (isLUSelected(lu.id)) return true;
    const totalSpent = selectedLU.reduce((sum, item) => sum + item.cost, 0);
    return (budget - totalSpent) >= lu.cost;
  };

  const handleLUClick = (lu) => {
    const canBuy = (currentPhase === 'selection' && !teamFinished && !waitingForOthers)
      || (currentPhase === 'post_auction');

    if (!canBuy) {
      if (isLUSelected(lu.id)) { setViewMode('sidebar'); setSelectedInfoCard(lu); }
      else showAlert('Недоступно', 'Покупка карточек информации сейчас недоступна.');
      return;
    }

    if (isLUSelected(lu.id)) {
      setViewMode('sidebar');
      setSelectedInfoCard(lu);
      return;
    }

    if (!canAffordLU(lu)) {
      showAlert('Недостаточно средств', `Не хватает ${lu.cost - (budget - selectedLU.reduce((s, l) => s + l.cost, 0))} млн руб. для покупки карточки «${lu.name}».`);
      return;
    }

    setLuConfirmModal({ lu });
  };

  const confirmBuyLU = () => {
    if (!luConfirmModal) return;
    purchaseLU(luConfirmModal.lu);
    setLuConfirmModal(null);
  };

  const totalSpent = selectedLU.reduce((sum, lu) => sum + lu.cost, 0);
  const getLUPosition = (cellId) => LICENSE_UNITS.find(lu => lu.cellRef === cellId);
  const isOwnedByMe = (cellRef) => !!ownedCells[cellRef];
  const isOwnedByOther = (cellRef) => {
    if (ownedCells[cellRef]) return false;
    const cellData = gridCells.allTeams[cellRef];
    if (!cellData || !cellData.ownedByTeamId) return false;
    const myId = player.teamId || player.name;
    return myId ? cellData.ownedByTeamId !== myId : false;
  };
  const isRegisteredForAuction = (cellRef) => myAuctionCells.includes(cellRef);

  const canInteractWithGrid = () =>
    (currentPhase === 'selection' && !teamFinished && !waitingForOthers) ||
    (currentPhase === 'post_auction');

  const handleGridCellClick = (cellRef) => {
    if (!canInteractWithGrid()) {
      // В фазе аукциона клик по ячейке не открывает старый modal —
      // всё управление через AuctionDashboard
      if (currentPhase === 'auction') {
        // Просто ничего не делаем — дашборд уже видно
        return;
      } else if (currentPhase === 'finished') {
        showAlert('Время истекло', 'Время на выбор участков истекло.');
      } else if (waitingForOthers) {
        showAlert('Ожидание', 'Вы завершили выбор. Ожидайте других команд.');
      }
      return;
    }

    if (isBlocked(cellRef)) {
      showAlert('Участок недоступен', `Причина: ${getBlockedLabel(getBlockedType(cellRef))}`);
      return;
    }

    if (selectedLU.length === 0) {
      setNoCardModal(true);
      return;
    }

    if (totalCommittedCells >= 5 && !isOwnedByMe(cellRef) && !isRegisteredForAuction(cellRef)) {
      showAlert(
        'Лимит участков',
        `Лимит 5 участков (включая аукционы).\nУ вас: ${ownedCount} участков + ${myAuctionCells.length} аукционов = ${totalCommittedCells}/5`
      );
      return;
    }

    if (isOwnedByMe(cellRef)) {
      showAlert('Уже ваш', 'Этот участок уже принадлежит вашей команде.');
      return;
    }

    if (isOwnedByOther(cellRef)) {
      const cellData = gridCells.allTeams[cellRef];
      const ownerTeam = cellData.ownedByTeamName || 'Другая команда';

      if (currentPhase === 'post_auction') {
        showAlert(
          'Участок занят',
          `Участок ${cellRef} занят командой «${ownerTeam}».\n\nВо время дополнительного времени нельзя участвовать в аукционах. Доступны только свободные участки.`
        );
        return;
      }

      if (isRegisteredForAuction(cellRef)) {
        showAlert('Уже зарегистрированы', `Вы уже зарегистрированы на аукцион за участок ${cellRef}.`);
        return;
      }
      if (totalCommittedCells >= 5) {
        showAlert('Лимит', `Нельзя зарегистрироваться на ещё один аукцион.\nЛимит: ${totalCommittedCells}/5`);
        return;
      }

      setGridConfirmModal({ cellRef, mode: 'auction', ownerTeam });
      return;
    }

    setGridConfirmModal({ cellRef, mode: 'buy' });
  };

  const confirmGridAction = () => {
    if (!gridConfirmModal) return;
    const { cellRef, mode } = gridConfirmModal;

    if (mode === 'buy') {
      purchaseGridCell(cellRef, `Участок ${cellRef}`);
    } else if (mode === 'auction') {
      if (!registerForAuction(cellRef)) {
        showAlert('Ошибка', 'Не удалось зарегистрироваться на аукцион.');
      }
    }
    setGridConfirmModal(null);
  };

  // ── Обработчики для AuctionDashboard ────────────────────────────────

  /**
   * Ставка из дашборда.
   * Возвращает true если ставка принята, false если нет.
   */
  const handleDashboardBid = async (cellRef, amount) => {
    try {
      if (player.sessionId && import.meta.env.VITE_USE_BACKEND === 'true') {
        try {
          await placeBidOnAuction(player.sessionId, cellRef, {
            teamId: player.teamId || player.name, amount, timestamp: Date.now()
          });
        } catch (e) { console.log('Backend недоступен:', e); }
      }
      return placeBid(cellRef, amount);
    } catch (error) {
      console.error('Error placing bid:', error);
      return false;
    }
  };

  /**
   * Выход из аукциона из дашборда — открывает confirm-модал.
   */
  const handleDashboardLeave = (cellRef) => {
    const auction = auctions.active[cellRef];
    const myId = player.teamId || player.name;
    const weAreLeading = auction?.currentBidTeamId === myId;

    const message = weAreLeading
      ? `Вы сейчас лидируете! Если покинете аукцион, участок достанется другой команде.`
      : `Если вы выйдете, участок достанется победителю среди других участников.`;

    setGridConfirmModal({ cellRef, mode: 'leave', message, weAreLeading });
  };

  const confirmLeaveAuction = () => {
    const { cellRef } = gridConfirmModal;
    const myId = player.teamId || player.name;
    try {
      if (unregisterFromAuction) {
        unregisterFromAuction(cellRef);
      } else {
        useGameStore.setState(state => {
          const targetAuction = state.auctions.active[cellRef];
          if (targetAuction && targetAuction.participants) {
            targetAuction.participants = targetAuction.participants.filter(id => id !== myId);
            if (targetAuction.participants.length === 0) {
              delete state.auctions.active[cellRef];
            } else if (targetAuction.currentBidTeamId === myId && targetAuction.participants.length > 0) {
              const nextLeaderId = targetAuction.participants[0];
              targetAuction.currentBidTeamId = nextLeaderId;
              targetAuction.currentBidTeamName = `Команда ${nextLeaderId}`;
              targetAuction.currentBid = targetAuction.startPrice;
            }
          }
          state.auctions.pendingForMe = state.auctions.pendingForMe.filter(ref => ref !== cellRef);
          return state;
        });
      }
      setGridConfirmModal(null);
    } catch (error) {
      console.error('Error leaving auction:', error);
      showAlert('Ошибка', 'Ошибка при выходе из аукциона');
    }
  };

  // ── DEV helpers ──────────────────────────────────────────────────────

  const DEV_SIMULATED_TEAMS = [
    { cellRef: 'E5', name: 'Участок E5', teamId: 'dev_team_alpha', teamName: 'Команда Альфа' },
    { cellRef: 'F7', name: 'Участок F7', teamId: 'dev_team_beta',  teamName: 'Команда Бета'  },
  ];

  const shouldShowDevButton = () =>
    DEV_SIMULATED_TEAMS.some(({ cellRef }) => !isOwnedByMe(cellRef) && !isOwnedByOther(cellRef));

  return (
    <div className="region-map-fullscreen">

      {/* ── Таймер ── */}
      <div className={getTimerClass()}>
        {waitingForOthers ? (
          <>
            <div className="region-timer-label">{getTimerLabel()}</div>
            <div className="region-timer-waiting-icon">WAIT</div>
            <div className="region-timer-subtitle">{getTimerSubtitle()}</div>
          </>
        ) : currentPhase === 'finished' ? (
          <>
            <div className="region-timer-label">{getTimerLabel()}</div>
            <div className="region-timer-value">00:00</div>
            <div className="region-timer-subtitle">{getTimerSubtitle()}</div>
          </>
        ) : (
          <>
            <div className="region-timer-label">{getTimerLabel()}</div>
            <div className="region-timer-value">{formatTime(timeRemaining)}</div>
            <div className="region-timer-subtitle">{getTimerSubtitle()}</div>
          </>
        )}
      </div>

      {currentPhase === 'post_auction' && showPostAuctionBanner && (
        <div className="post-auction-banner">
          Аукцион завершён! У вас есть 2 минуты, чтобы докупить свободные участки (аукционы недоступны)
        </div>
      )}

      {/* ── Управляющие кнопки ── */}
      <div className="map-controls">
        <button className="control-btn back-control-btn" onClick={onComplete}>Назад</button>
        {!teamFinished && !waitingForOthers && currentPhase === 'selection' && (ownedCount > 0 || myAuctionCells.length > 0) && (
          <button className="control-btn finish-selection-btn" onClick={handleFinishSelection}>
            Завершить выбор
          </button>
        )}
        {currentPhase === 'finished' && ownedCount > 0 && onNext && (
          <button className="control-btn next-control-btn" onClick={onNext}>
            Далее - Научные исследования
          </button>
        )}
      </div>

      {/* ── DEV: симуляция ставок ── */}
      {import.meta.env.DEV && currentPhase === 'auction' && (
        <div style={{ position: 'fixed', bottom: '20px', left: '380px', zIndex: 1000, display: 'flex', gap: '8px' }}>
          <button
            className="dev-sim-btn"
            onClick={simulationActive ? stopBidSimulation : startBidSimulation}
            style={{ backgroundColor: simulationActive ? '#f44336' : '#4caf50', color: 'white', fontWeight: 700 }}
          >
            {simulationActive ? 'STOP симуляция' : 'START симуляция ставок'}
          </button>
          {/* DEV: перебить случайную ставку вручную */}
          {Object.keys(auctions.active).length > 0 && (
            <button
              className="dev-sim-btn"
              style={{ backgroundColor: '#ff9800', color: 'white', fontWeight: 700 }}
              onClick={() => {
                const keys = Object.keys(auctions.active);
                const cellRef = keys[Math.floor(Math.random() * keys.length)];
                simulateOtherTeamBid(cellRef);
              }}
            >
              DEV: перебить ставку
            </button>
          )}
        </div>
      )}

      {/* ── Информационная панель ── */}
      <div className={`game-info-panel ${!isWideScreen ? 'ultra-compact' : ''}`}>
        {!isWideScreen ? (
          <>
            <div className="info-row"><span className="info-label">Карточки:</span><span className="info-value">{selectedLU.length}</span></div>
            <div className="info-row"><span className="info-label">Участки:</span><span className="info-value">{ownedCount}/5</span></div>
            {myAuctionCells.length > 0 && (
              <div className="info-row"><span className="info-label">Аукционы:</span><span className="info-value auction-count">{myAuctionCells.length}</span></div>
            )}
            <div className="info-row">
              <span className="info-label">Всего:</span>
              <span className={`info-value ${totalCommittedCells >= 5 ? 'limit-reached' : ''}`}>{totalCommittedCells}/5</span>
            </div>
            <div className="info-row icons-only">
              <span className="info-value budget-value">{budget} млн</span>
              <span className="info-value spent-value">{totalSpent} млн</span>
            </div>
            {currentPhase !== 'selection' && (
              <div className="phase-indicator-compact"><span className="phase-label">{getTimerLabel()}</span></div>
            )}
            {selectedLU.length > 0 && (
              <div className="compact-cards-mini-list">
                {selectedLU.map((lu) => (
                  <div key={lu.id} className="compact-card-mini-item" onClick={() => { setViewMode('button'); setSelectedInfoCard(lu); setShowInfoCards(true); }}>
                    <span className="compact-card-mini-title">{lu.name}</span>
                    <span className="compact-card-mini-cost">{lu.cost} млн</span>
                    <span className="compact-card-mini-hint">-&gt;</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="info-row"><span className="info-label">Карточки информации:</span><span className="info-value">{selectedLU.length}</span></div>
            <div className="info-row"><span className="info-label">Выбрано участков:</span><span className="info-value">{ownedCount} / 5</span></div>
            {myAuctionCells.length > 0 && (
              <div className="info-row"><span className="info-label">Зарегистрировано на аукционы:</span><span className="info-value auction-count">{myAuctionCells.length}</span></div>
            )}
            <div className="info-row"><span className="info-label">Бюджет:</span><span className="info-value budget-value">{budget.toLocaleString('ru-RU')} млн руб.</span></div>
            <div className="info-row"><span className="info-label">Потрачено:</span><span className="info-value spent-value">{totalSpent.toLocaleString('ru-RU')} млн руб.</span></div>
            {currentPhase !== 'selection' && (
              <div className="phase-indicator">
                <div className="phase-indicator-label">Текущий этап:</div>
                <div className="phase-indicator-value">{getTimerLabel()}</div>
              </div>
            )}
            {myAuctionCells.length > 0 && currentPhase === 'selection' && (
              <div className="pending-auctions-list">
                <div className="pending-auctions-title">Ожидание аукционов:</div>
                {myAuctionCells.map(cellRef => (
                  <div key={cellRef} className="pending-auction-item">
                    <span className="pending-auction-cell">WAIT {cellRef}</span>
                  </div>
                ))}
              </div>
            )}
            {selectedLU.length > 0 && (
              <div className="info-panel-section">
                <h4 className="info-panel-section-title">Карточки информации<span className="section-title-count">{selectedLU.length}</span></h4>
                <div className="info-panel-cards-list">
                  {selectedLU.map((lu) => (
                    <div key={lu.id} className="info-panel-card-item" onClick={() => { setViewMode('sidebar'); setSelectedInfoCard(lu); }}>
                      <div className="info-panel-card-header">
                        <span className="info-panel-card-title">{lu.name}</span>
                        <span className="info-panel-card-cost">{lu.cost} млн руб.</span>
                      </div>
                      <div className="info-panel-card-footer"><span className="info-panel-card-hint">Подробнее -&gt;</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {ownedCount > 0 && (
              <div className="owned-cells-list">
                <div className="owned-cells-title">Ваши участки:</div>
                {Object.values(ownedCells).map(cell => (
                  <div key={cell.cellRef} className="owned-cell-item owned-cell-item-static">
                    <span className="owned-cell-ref">{cell.cellRef}</span>
                    <span className="owned-cell-name">{cell.name}</span>
                    {cell.auctionPrice ? <span className="owned-cell-price">{cell.auctionPrice} млн</span> : <span className="owned-cell-free">бесплатно</span>}
                  </div>
                ))}
              </div>
            )}
            {import.meta.env.DEV && shouldShowDevButton() && (
              <button
                className="dev-sim-btn"
                onClick={() => {
                  DEV_SIMULATED_TEAMS.forEach(({ cellRef, name, teamId, teamName }) => {
                    if (!isOwnedByMe(cellRef) && !isOwnedByOther(cellRef)) {
                      simulateOtherTeamOwns(cellRef, name, teamId, teamName);
                    }
                  });
                }}
              >
                DEV: Симулировать 2 команды (E5 + F7)
              </button>
            )}
            {import.meta.env.DEV && (
              <button className="dev-sim-btn" onClick={resetTimer} style={{ marginTop: '8px' }}>DEV: Сброс таймера</button>
            )}
          </>
        )}
      </div>

      {selectedLU.length > 0 && isWideScreen && (
        <div className="info-cards-sidebar">
          <h3>Карточки информации</h3>
          <div className="compact-cards-list">
            {selectedLU.map((lu) => (
              <div key={lu.id} className="compact-info-card" onClick={() => { setViewMode('sidebar'); setSelectedInfoCard(lu); }}>
                <div className="compact-card-header">
                  <span className="compact-card-title">{lu.name}</span>
                  <span className="compact-card-cost">{lu.cost} млн руб.</span>
                </div>
                <div className="compact-card-hint">Подробнее -&gt;</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="vertical-title"><div className="vertical-title-text">Карта региона</div></div>

      {/* ── Основная карта ── */}
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
            <div className="grid-with-lu">
              {rows.map((row) => (
                <div key={row} className="grid-row">
                  {cols.map((col) => {
                    const cellId = `${row}${col}`;
                    const lu = getLUPosition(cellId);
                    const ownedByMe = isOwnedByMe(cellId);
                    const ownedByOther = isOwnedByOther(cellId);
                    const hasActiveAuction = !!auctions.active[cellId];
                    const blockedType = getBlockedType(cellId);
                    const isPendingAuction = isRegisteredForAuction(cellId);
                    const isDisabled =
                      currentPhase === 'finished' ||
                      waitingForOthers ||
                      (currentPhase === 'auction' && !hasActiveAuction);

                    return (
                      <div key={cellId} className="cell-with-lu-wrapper">
                        <div
                          className={[
                            'grid-cell',
                            ownedByMe ? 'grid-cell-owned' : '',
                            ownedByOther ? 'grid-cell-other' : '',
                            hasActiveAuction ? 'grid-cell-auction' : '',
                            isPendingAuction ? 'grid-cell-pending-auction' : '',
                            blockedType ? `grid-cell-blocked grid-cell-blocked-${blockedType}` : '',
                            isDisabled ? 'grid-cell-disabled' : '',
                          ].filter(Boolean).join(' ')}
                          onClick={() => handleGridCellClick(cellId)}
                          title={
                            isDisabled && !hasActiveAuction ? 'Выбор участков недоступен'
                              : blockedType ? `${cellId} - ${getBlockedLabel(blockedType)}`
                                : ownedByMe ? `${cellId} - ваш участок`
                                  : ownedByOther ? `${cellId} - занят другой командой${currentPhase === 'post_auction' ? ' (аукционы недоступны)' : ''}`
                                    : hasActiveAuction ? `${cellId} - аукцион (смотрите панель справа)`
                                      : isPendingAuction ? `${cellId} - вы в очереди на аукцион`
                                        : totalCommittedCells >= 5 ? `${cellId} - лимит 5 участков`
                                          : `${cellId} - нажмите чтобы выбрать`
                          }
                        >
                          <span className="cell-label">{cellId}</span>
                          {ownedByMe && <span className="cell-mark cell-mark-own">OK</span>}
                          {ownedByOther && <span className="cell-mark cell-mark-other">!</span>}
                          {hasActiveAuction && !ownedByMe && !ownedByOther && <span className="cell-mark cell-mark-auction">LIVE</span>}
                          {isPendingAuction && <span className="cell-mark cell-mark-pending">WAIT</span>}
                          {blockedType && <span className="cell-mark cell-mark-blocked">X</span>}
                          {isDisabled && !blockedType && !hasActiveAuction && <span className="cell-mark cell-mark-timer">X</span>}
                        </div>

                        {lu && (
                          <div className="lu-container">
                            <div
                              className={[
                                'lu-marker',
                                isLUSelected(lu.id) ? 'selected' : '',
                                !canAffordLU(lu) && !isLUSelected(lu.id) ? 'disabled' : '',
                                currentPhase === 'auction' && !isLUSelected(lu.id) ? 'timer-disabled' : '',
                                currentPhase === 'selection' && (teamFinished || waitingForOthers) && !isLUSelected(lu.id) ? 'timer-disabled' : '',
                                currentPhase === 'finished' && !isLUSelected(lu.id) ? 'timer-disabled' : '',
                              ].filter(Boolean).join(' ')}
                              style={lu.customStyle}
                              onClick={() => handleLUClick(lu)}
                              onMouseEnter={() => setHoveredLU(lu.id)}
                              onMouseLeave={() => setHoveredLU(null)}
                              title={`${lu.name} - ${lu.cost} млн руб.`}
                            >
                              <span className="lu-marker-number">{lu.shortName}</span>
                              {isLUSelected(lu.id) && <span className="lu-marker-check">OK</span>}
                            </div>
                            <div className="lu-name-label" style={{
                              position: 'absolute', top: lu.customStyle?.top || '0', left: lu.customStyle?.left || '0',
                              transform: getLUNamePosition(lu.position), whiteSpace: 'nowrap',
                            }}>
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
            </div>
          </div>
        </div>
      </div>

      {/* ── Легенда ── */}
      <div className="map-legend">
        <div className="legend-item"><div className="legend-color legend-color-own"></div><span>Ваш участок</span></div>
        <div className="legend-item"><div className="legend-color legend-color-other"></div><span>Занят другой командой</span></div>
        <div className="legend-item"><div className="legend-color legend-color-free"></div><span>Свободный участок</span></div>
        <div className="legend-item"><div className="legend-color legend-color-blocked-reserve"></div><span>Природный заказник</span></div>
        <div className="legend-item"><div className="legend-color legend-color-blocked-settlement"></div><span>Населённый пункт</span></div>
        <div className="legend-item"><div className="legend-color legend-color-blocked-company"></div><span>Нефтяная компания</span></div>
      </div>

      {/* ══════════════════════════════════════════════════════
          ЕДИНАЯ ПАНЕЛЬ АУКЦИОНОВ (новая)
      ══════════════════════════════════════════════════════ */}
      <AuctionDashboard
        auctions={auctions}
        player={player}
        budget={budget}
        onPlaceBid={handleDashboardBid}
        onLeaveAuction={handleDashboardLeave}
        currentPhase={currentPhase}
      />

      {/* ══════════════════════════════════════════════════════
          МОДАЛЬНЫЕ ОКНА
      ══════════════════════════════════════════════════════ */}

      {/* 1. Просмотр карточки информации */}
      {selectedInfoCard && viewMode === 'sidebar' && (
        <div className="modal-overlay" onClick={() => { setSelectedInfoCard(null); setViewMode(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setSelectedInfoCard(null); setViewMode(null); }}>✕</button>
            <h2>{selectedInfoCard.name}</h2>
            {selectedInfoCard.hasImage && <div className="card-image-wrap"><img src={selectedInfoCard.imagePath} alt={selectedInfoCard.name} /></div>}
            <div className="card-description">{selectedInfoCard.description}</div>
            <div className="card-meta"><span>Стоимость: <strong>{selectedInfoCard.cost} млн руб.</strong></span></div>
          </div>
        </div>
      )}

      {/* 2. Список карточек информации */}
      {showInfoCards && viewMode === 'button' && (
        <div className="modal-overlay" onClick={() => { setShowInfoCards(false); setSelectedInfoCard(null); setViewMode(null); }}>
          <div className="modal-content modal-list" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setShowInfoCards(false); setSelectedInfoCard(null); setViewMode(null); }}>✕</button>
            <h2>Информация о карточках</h2>
            <div className="cards-grid">
              {selectedLU.map((lu) => (
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

      {/* 3. Подтверждение покупки карточки информации */}
      <ConfirmModal
        isOpen={!!luConfirmModal}
        onClose={() => setLuConfirmModal(null)}
        onConfirm={confirmBuyLU}
        title="Купить карточку информации?"
        confirmLabel={`Купить за ${luConfirmModal?.lu.cost} млн руб.`}
        cancelLabel="Отмена"
        confirmVariant="primary"
      >
        {luConfirmModal && (
          <div className="confirm-purchase-details">
            <div className="confirm-card-header-row">
              <div className="confirm-card-icon">{luConfirmModal.lu.shortName}</div>
              <div className="confirm-card-name">{luConfirmModal.lu.name}</div>
            </div>
            <div className="confirm-budget-row">
              <span>Стоимость:</span>
              <strong>{luConfirmModal.lu.cost.toLocaleString('ru-RU')} млн руб.</strong>
            </div>
            <div className="confirm-budget-row">
              <span>Бюджет после покупки:</span>
              <strong className={budget - totalSpent - luConfirmModal.lu.cost < 0 ? 'text-danger' : 'text-success'}>
                {(budget - totalSpent - luConfirmModal.lu.cost).toLocaleString('ru-RU')} млн руб.
              </strong>
            </div>
          </div>
        )}
      </ConfirmModal>

      {/* 4. Подтверждение покупки / регистрации на аукцион ЛУ */}
      <ConfirmModal
        isOpen={!!gridConfirmModal && gridConfirmModal.mode !== 'leave'}
        onClose={() => setGridConfirmModal(null)}
        onConfirm={confirmGridAction}
        title={
          gridConfirmModal?.mode === 'buy'
            ? `Приобрести участок ${gridConfirmModal?.cellRef}?`
            : `Зарегистрироваться на аукцион за участок ${gridConfirmModal?.cellRef}?`
        }
        confirmLabel={
          gridConfirmModal?.mode === 'buy'
            ? 'Приобрести участок'
            : 'Зарегистрироваться на аукцион'
        }
        cancelLabel="Отмена"
        confirmVariant="primary"
      >
        {gridConfirmModal && gridConfirmModal.mode === 'buy' && (
          <div className="confirm-purchase-details">
            <div className="confirm-cell-ref">{gridConfirmModal.cellRef}</div>
            <p>Вы выбираете лицензионный участок <strong>{gridConfirmModal.cellRef}</strong></p>
            <div className="confirm-stats-row">
              <div className="confirm-stat">
                <span className="confirm-stat-label">Участков:</span>
                <span className="confirm-stat-value">{ownedCount + 1} / 5</span>
              </div>
            </div>
          </div>
        )}
        {gridConfirmModal && gridConfirmModal.mode === 'auction' && (
          <div className="confirm-purchase-details">
            <div className="confirm-cell-ref">{gridConfirmModal.cellRef}</div>
            <p>
              Участок <strong>{gridConfirmModal.cellRef}</strong> занят командой <strong>«{gridConfirmModal.ownerTeam}»</strong>.
            </p>
            <p>Вы будете участвовать в аукционе на этот участок после завершения фазы выбора.</p>
            <div className="confirm-auction-info">
              <div className="confirm-auction-row">
                <span>Начальная цена аукциона:</span>
                <strong>{AUCTION_START_PRICE} млн руб.</strong>
              </div>
              <div className="confirm-auction-row">
                <span>Шаг ставки:</span>
                <strong>{AUCTION_START_PRICE} млн руб.</strong>
              </div>
            </div>
            <div className="confirm-stats-row">
              <div className="confirm-stat">
                <span className="confirm-stat-label">Аукционов будет</span>
                <span className="confirm-stat-value">{myAuctionCells.length + 1}</span>
              </div>
              <div className="confirm-stat">
                <span className="confirm-stat-label">Всего обязательств</span>
                <span className={`confirm-stat-value ${totalCommittedCells + 1 >= 5 ? 'text-warning' : ''}`}>
                  {totalCommittedCells + 1} / 5
                </span>
              </div>
            </div>
          </div>
        )}
      </ConfirmModal>

      {/* 5. Подтверждение выхода из аукциона */}
      <ConfirmModal
        isOpen={!!gridConfirmModal && gridConfirmModal.mode === 'leave'}
        onClose={() => setGridConfirmModal(null)}
        onConfirm={confirmLeaveAuction}
        title={`Покинуть аукцион за участок ${gridConfirmModal?.cellRef}?`}
        confirmLabel="Покинуть аукцион"
        cancelLabel="Остаться"
        confirmVariant="danger"
      >
        {gridConfirmModal?.mode === 'leave' && (
          <div className="confirm-purchase-details">
            {gridConfirmModal.weAreLeading && (
              <div className="confirm-warning-box">
                ⚠️ Вы сейчас <strong>лидируете</strong> в этом аукционе!
              </div>
            )}
            <p>{gridConfirmModal.message}</p>
          </div>
        )}
      </ConfirmModal>

      {/* 6. Предупреждение «нет карточек» */}
      <NoInfoCardModal
        isOpen={noCardModal}
        onClose={() => setNoCardModal(false)}
        onGoToBuyCard={() => setNoCardModal(false)}
      />

      {/* 7. Универсальное предупреждение */}
      <AlertModal
        isOpen={!!alertModal}
        onClose={() => setAlertModal(null)}
        title={alertModal?.title || 'Внимание'}
      >
        <p>{alertModal?.message}</p>
      </AlertModal>

    </div>
  );
};

export default RegionMap;