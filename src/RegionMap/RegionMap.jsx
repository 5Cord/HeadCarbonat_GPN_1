// RegionMap.jsx
import React, { useState, useEffect, useRef } from 'react';
import './RegionMap.css';
import useGameStore, { AUCTION_START_PRICE } from '../../store/gameStore';

const LICENSE_UNITS = [
  {
    id: 'well1',
    name: 'Парам. скважина №1',
    shortName: '1',
    cost: 10,
    cellRef: 'A2',
    position: 'top-left',
    customStyle: { top: '-130px', left: '0px' },
    description: 'Целевой комплекс: светлые слоистые строматолитовые доломиты с прослоями гипса и ангидрита. Свойства: доломиты слабо пористые, с редкими выпотами густой нефти.',
    hasImage: false,
  },
  {
    id: 'well2',
    name: 'Парам. скважина №2',
    shortName: '2',
    cost: 10,
    cellRef: 'A5',
    position: 'top-left',
    customStyle: { top: '-130px', left: '0px' },
    description: 'Целевой комплекс: светлые тонкослоистые известняки и доломиты, прослоями зернистые. Свойства: межзерновая пористость, признаки нефтенасыщения по порам.',
    hasImage: false,
  },
  {
    id: 'seismic',
    name: 'ОиИ архивных СРР 2Д',
    shortName: 'И',
    cost: 30,
    cellRef: 'A10',
    position: 'corner-bottom-left',
    customStyle: { top: '-130px', left: '80px' },
    description: 'По данным 2D сейсморазведки выделяются ориентированные с ЮЗ на СВ объекты, похожие на структурные валы. В центральной части территории между ними фиксируется палеопрогиб.',
    hasImage: false,
  },
  {
    id: 'well3',
    name: 'Парам. скважина №3',
    shortName: '3',
    cost: 10,
    cellRef: 'B10',
    position: 'right',
    customStyle: { top: '0', left: '85px' },
    description: 'Целевой комплекс: тонкослоистые черные кремнистые известняки с повышенным содержанием Сорг (органического углерода). Свойства: мощность комплекса сильно сокращена. В отдельных прослоях породы при раскалывании пахнут углеводородами (УВ).',
    hasImage: false,
  },
  {
    id: 'well4',
    name: 'Парам. скважина №4',
    shortName: '4',
    cost: 20,
    cellRef: 'E10',
    position: 'right',
    customStyle: { top: '0px', left: '85px' },
    description: 'Целевой комплекс: массивные трещиновато-кавернозные известняки с кораллами и губками. Свойства: по кавернам обильные выполы (выпоты) нефти.',
    hasImage: false,
  },
  {
    id: 'well5',
    name: 'Парам. скважина №5',
    shortName: '5',
    cost: 20,
    cellRef: 'J8',
    position: 'right',
    customStyle: { top: '85px', left: '0px' },
    description: 'Целевой комплекс: светлые слоистые известняки и доломиты (зернистые и микритовые), с пачками трещиноватых органогенных известняков. Свойства: прослоями породы пористые, с признаками углеводородов (УВ).',
    hasImage: false,
  },
  {
    id: 'well6',
    name: 'Парам. скважина №6',
    shortName: '6',
    cost: 10,
    cellRef: 'J3',
    position: 'right',
    customStyle: { top: '85px', left: '0px' },
    description: 'Целевой комплекс: тонкослоистые черные кремнистые известняки с повышенным содержанием Сорг, с остатками планктонной фауны. Свойства: мощность комплекса сильно сокращена.',
    hasImage: false,
  },
  {
    id: 'research',
    name: 'Региональная НИР',
    shortName: 'Н',
    cost: 70,
    cellRef: 'J1',
    position: 'corner-top-right',
    customStyle: { top: '85px', left: '-118px' },
    description: 'Выполнены: комплекс геолого-геофизических мероприятий (КГМ), структурно-геологическое моделирование (СГМ), бассейновое моделирование (БМ), оценка ресурсов. Результат: выделены перспективные зоны. Карта плотности ресурсов УВ (тыс. т. условных у.в. на кв. км) показывает три категории: 10-50, 5-10, <5.',
    hasImage: true,
    imagePath: '/src/svgs/RegNir.svg',
  },
  {
    id: 'quarry',
    name: 'Карьер',
    shortName: 'К',
    cost: 20,
    cellRef: 'F1',
    position: 'left',
    customStyle: { top: '0', left: '-130px' },
    description: 'Горные породы: известняки и доломиты массивные, химически чистые, органогенные, кавернозно-трещиноватые. Свойства: по кавернам густые выпоты окисленной нефти. Тип: разрабатываемый содовый карьер.',
    hasImage: false,
  },
  {
    id: 'outcrop',
    name: 'Обнажение',
    shortName: 'О',
    cost: 10,
    cellRef: 'D1',
    position: 'left',
    customStyle: { top: '0', left: '-130px' },
    description: 'Горные породы: ритмично-слоистые светло-серые известняки и доломиты с микробиальными биотермами до 10 м толщиной. Свойства: встречаются поры, каверны и трещины с запахом углеводородов (УВ).',
    hasImage: false,
  },
];


const BLOCKED_CELLS = {
  reserve: ['C3', 'C4', 'D3', 'D4'],
  settlement: ['G6', 'G7', 'H6', 'H7'],
  company: ['B5', 'C5', 'B6', 'C6']
};


const REGION_MAP_DURATION = 20 * 60; // 20 минут в секундах
const RM_WARNING_5MIN     = 5 * 60;
const RM_WARNING_2MIN     = 2 * 60;
const RM_WARNING_30SEC    = 30;

// Ключ для localStorage
const TIMER_STORAGE_KEY = 'regionMap_timer';

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

const RegionMap = ({ onComplete, onNext }) => {
  const {
    player,
    licenseUnits,
    gridCells,
    auctions,
    purchaseLU,
    purchaseGridCell,
    placeBid,
    finalizeAuction,
    simulateOtherTeamOwns,
  } = useGameStore();

  const budget = player.budget;
  const selectedLU = licenseUnits.owned;
  const ownedCells = gridCells.owned;
  const ownedCount = Object.keys(ownedCells).length;

  const [hoveredLU, setHoveredLU] = useState(null);
  const [showInfoCards, setShowInfoCards] = useState(false);
  const [selectedInfoCard, setSelectedInfoCard] = useState(null);
  const [isWideScreen, setIsWideScreen] = useState(window.innerWidth > 1580);
  const [viewMode, setViewMode] = useState(null);

  const [auctionModal, setAuctionModal] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [auctionMsg, setAuctionMsg] = useState('');

  const [timeRemaining, setTimeRemaining] = useState(() => {
    const saved = localStorage.getItem(TIMER_STORAGE_KEY);
    if (saved) {
      const { remaining, timestamp } = JSON.parse(saved);
      const elapsed = Math.floor((Date.now() - timestamp) / 1000);
      const newRemaining = Math.max(0, remaining - elapsed);
      return newRemaining;
    }
    return REGION_MAP_DURATION;
  });
  
  const [timerFinished, setTimerFinished] = useState(() => timeRemaining <= 0);
  const timerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({
      remaining: timeRemaining,
      timestamp: Date.now()
    }));
  }, [timeRemaining]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (timerFinished) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setTimerFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timerFinished]); 

  const resetTimer = () => {
    setTimeRemaining(REGION_MAP_DURATION);
    setTimerFinished(false);
    localStorage.removeItem(TIMER_STORAGE_KEY);
  };

  const getTimerClass = () => {
    if (timerFinished) return 'region-timer region-timer-finished';
    if (timeRemaining <= RM_WARNING_30SEC) return 'region-timer region-timer-critical';
    if (timeRemaining <= RM_WARNING_2MIN) return 'region-timer region-timer-warning';
    if (timeRemaining <= RM_WARNING_5MIN) return 'region-timer region-timer-alert';
    return 'region-timer';
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
    if (selectedLU.length >= 5) return false;
    const totalSpent = selectedLU.reduce((sum, item) => sum + item.cost, 0);
    return (budget - totalSpent) >= lu.cost;
  };

  const isResearchAvailable = () => {
    return ownedCount >= 1;
  };

  const handleLUClick = (lu) => {
    if (timerFinished && !isLUSelected(lu.id)) {
      alert('Время на покупку карточек информации истекло. Доступен только просмотр.');
      return;
    }

    if (isLUSelected(lu.id)) {
      setViewMode('sidebar');
      setSelectedInfoCard(lu);
      return;
    }

    if (canAffordLU(lu)) {
      purchaseLU(lu);
    } else {
      if (selectedLU.length >= 5) {
        alert('Достигнут лимит карточек информации (максимум 5)');
      } else {
        alert('Недостаточно средств для покупки этой карточки');
      }
    }
  };

  const totalSpent = selectedLU.reduce((sum, lu) => sum + lu.cost, 0);
  const getLUPosition = (cellId) => LICENSE_UNITS.find(lu => lu.cellRef === cellId);

  const isOwnedByMe = (cellRef) => !!ownedCells[cellRef];

  const isOwnedByOther = (cellRef) => {
    if (ownedCells[cellRef]) return false;
    const cellData = gridCells.allTeams[cellRef];
    if (!cellData || !cellData.ownedByTeamId) return false;
    const myId = player.teamId || player.name;
    if (!myId) return false;
    return cellData.ownedByTeamId !== myId;
  };

  const handleGridCellClick = (cellRef) => {
    if (timerFinished) {
      alert('Время на выбор участков истекло. Доступен только просмотр.');
      return;
    }

    if (isBlocked(cellRef)) {
      const type = getBlockedType(cellRef);
      alert(`Этот участок недоступен для покупки.\nПричина: ${getBlockedLabel(type)}`);
      return;
    }

    if (ownedCount >= 5 && !isOwnedByMe(cellRef)) {
      alert('Можно выбрать не более 5 участков.');
      return;
    }

    if (isOwnedByMe(cellRef)) {
      alert('Этот участок уже ваш. Отказаться от него нельзя.');
      return;
    }

    if (isOwnedByOther(cellRef)) {
      if (!auctions.active[cellRef]) {
        const result = purchaseGridCell(cellRef, `Участок ${cellRef}`);
        if (result === 'auction') {
          setAuctionModal({ cellRef, cellName: `Участок ${cellRef}` });
          const curBid = auctions.active[cellRef]?.currentBid || AUCTION_START_PRICE;
          setBidAmount(String(curBid + AUCTION_START_PRICE)); // Следующая ставка = текущая + 50
          setAuctionMsg('');
        }
      } else {
        setAuctionModal({ cellRef, cellName: `Участок ${cellRef}` });
        const curBid = auctions.active[cellRef]?.currentBid || AUCTION_START_PRICE;
        setBidAmount(String(curBid + AUCTION_START_PRICE));
        setAuctionMsg('');
      }
      return;
    }

    const result = purchaseGridCell(cellRef, `Участок ${cellRef}`);
    if (result === 'auction') {
      setAuctionModal({ cellRef, cellName: `Участок ${cellRef}` });
      const curBid = auctions.active[cellRef]?.currentBid || AUCTION_START_PRICE;
      setBidAmount(String(curBid + AUCTION_START_PRICE));
      setAuctionMsg('');
    }
  };

  const handlePlaceBid = () => {
    if (!auctionModal) return;
    
    if (timerFinished) {
      alert('Время на участие в аукционах истекло.');
      setAuctionModal(null);
      return;
    }
    
    const auction = auctions.active[auctionModal.cellRef];
    if (!auction) return;
    
    const amount = Number(bidAmount);
    const minNextBid = auction.currentBid + AUCTION_START_PRICE;

    if (amount < minNextBid) {
      setAuctionMsg(`Минимальная ставка: ${minNextBid} млн руб. (шаг ${AUCTION_START_PRICE} млн)`);
      return;
    }

    if ((amount - AUCTION_START_PRICE) % AUCTION_START_PRICE !== 0) {
      setAuctionMsg(`Ставка должна быть кратна ${AUCTION_START_PRICE} млн руб.`);
      return;
    }

    if (amount > budget) {
      setAuctionMsg('Недостаточно средств.');
      return;
    }

    const ok = placeBid(auctionModal.cellRef, amount);
    if (ok) {
      setAuctionMsg(`Ваша ставка ${amount} млн руб. принята. Ожидайте хода другой команды.`);
      setBidAmount(String(amount + AUCTION_START_PRICE));
    }
  };

  const handleFinalizeAuction = () => {
    if (!auctionModal) return;
    
    if (timerFinished) {
      alert('Время на участие в аукционах истекло.');
      setAuctionModal(null);
      return;
    }
    
    finalizeAuction(auctionModal.cellRef);
    setAuctionModal(null);
  };

  const isE5AuctionWonByMe = () => {
    const auctionE5 = auctions.active['E5'];
    if (!auctionE5) return false;
    const myId = player.teamId || player.name;
    return auctionE5.currentBidTeamId === myId || auctionE5.currentBidTeamName === player.name;
  };

  const isE5OwnedByOther = () => isOwnedByOther('E5');
  const isE5OwnedByMe = () => isOwnedByMe('E5');

  const shouldShowDevButton = () => {
    if (isE5OwnedByMe()) return false;
    if (isE5OwnedByOther()) return false;
    if (isE5AuctionWonByMe()) return false;
    return true;
  };

  return (
    <div className="region-map-fullscreen">

      <div className={getTimerClass()}>
        {timerFinished ? (
          <>
            <div className="region-timer-label">Время вышло</div>
            <div className="region-timer-value">00:00</div>
            <div className="region-timer-subtitle">Только просмотр</div>
          </>
        ) : (
          <>
            <div className="region-timer-label">Карта региона</div>
            <div className="region-timer-value">{formatTime(timeRemaining)}</div>
            <div className="region-timer-subtitle">Покупка и анализ участков</div>
          </>
        )}
      </div>

      <div className="map-controls">
        <button className="control-btn back-control-btn" onClick={onComplete}>Назад</button>
        {ownedCount > 0 && onNext && !timerFinished && (
          <button className="control-btn next-control-btn" onClick={onNext}>
            Далее → Научные исследования
          </button>
        )}
        {ownedCount > 0 && onNext && timerFinished && (
          <button className="control-btn next-control-btn" onClick={onNext}>
            Далее → Научные исследования
          </button>
        )}

      </div>

      <div className={`game-info-panel ${!isWideScreen ? 'ultra-compact' : ''}`}>
        {!isWideScreen ? (
          <>
            <div className="info-row">
              <span className="info-label">Карточки:</span>
              <span className="info-value">{selectedLU.length}/5</span>
            </div>
            <div className="info-row">
              <span className="info-label">Участки:</span>
              <span className="info-value">{ownedCount}/5</span>
            </div>
            <div className="info-row icons-only">
              <span className="info-value budget-value">{budget} млн</span>
              <span className="info-value spent-value">{totalSpent} млн</span>
            </div>

            {selectedLU.length > 0 && (
              <div className="compact-cards-mini-list">
                {selectedLU.map((lu) => (
                  <div
                    key={lu.id}
                    className="compact-card-mini-item"
                    onClick={() => {
                      setViewMode('button');
                      setSelectedInfoCard(lu);
                      setShowInfoCards(true);
                    }}
                  >
                    <span className="compact-card-mini-title">{lu.name}</span>
                    <span className="compact-card-mini-cost">{lu.cost} млн</span>
                    <span className="compact-card-mini-hint">→</span>
                  </div>
                ))}
              </div>
            )}

            {selectedLU.length > 0 && (
              <button
                className="info-cards-toggle-btn micro-btn"
                onClick={() => {
                  setViewMode('button');
                  setShowInfoCards(true);
                }}
              >
                {selectedLU.length}
              </button>
            )}
          </>
        ) : (
          <>
            <div className="info-row">
              <span className="info-label">Карточки информации:</span>
              <span className="info-value">{selectedLU.length} / 5</span>
            </div>
            <div className="info-row">
              <span className="info-label">Выбрано участков:</span>
              <span className="info-value">{ownedCount} / 5</span>
            </div>
            <div className="info-row">
              <span className="info-label">Бюджет:</span>
              <span className="info-value budget-value">{budget.toLocaleString('ru-RU')} млн руб.</span>
            </div>
            <div className="info-row">
              <span className="info-label">Потрачено:</span>
              <span className="info-value spent-value">{totalSpent.toLocaleString('ru-RU')} млн руб.</span>
            </div>

            {selectedLU.length > 0 && (
              <div className="info-panel-section">
                <h4 className="info-panel-section-title">
                  Выбранные участки
                  <span className="section-title-count">{selectedLU.length}</span>
                </h4>
                <div className="info-panel-cards-list">
                  {selectedLU.map((lu) => (
                    <div
                      key={lu.id}
                      className="info-panel-card-item"
                      onClick={() => {
                        setViewMode('sidebar');
                        setSelectedInfoCard(lu);
                      }}
                    >
                      <div className="info-panel-card-header">
                        <span className="info-panel-card-title">{lu.name}</span>
                        <span className="info-panel-card-cost">{lu.cost} млн руб.</span>
                      </div>
                      <div className="info-panel-card-footer">
                        <span className="info-panel-card-hint">Подробнее →</span>
                      </div>
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
                    {cell.auctionPrice
                      ? <span className="owned-cell-price">{cell.auctionPrice} млн</span>
                      : <span className="owned-cell-free">бесплатно</span>
                    }
                  </div>
                ))}
              </div>
            )}

            {import.meta.env.DEV && shouldShowDevButton() && (
              <button
                className="dev-sim-btn"
                onClick={() => simulateOtherTeamOwns('E5', 'Участок E5')}
              >
                DEV: Другая команда E5
              </button>
            )}
          </>
        )}
      </div>

      {selectedLU.length > 0 && isWideScreen && (
        <div className="info-cards-sidebar">
          <h3>Выбранные участки</h3>
          <div className="compact-cards-list">
            {selectedLU.map((lu) => (
              <div key={lu.id} className="compact-info-card" onClick={() => {
                setViewMode('sidebar');
                setSelectedInfoCard(lu);
              }}>
                <div className="compact-card-header">
                  <span className="compact-card-title">{lu.name}</span>
                  <span className="compact-card-cost">{lu.cost} млн руб.</span>
                </div>
                <div className="compact-card-hint">Подробнее →</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="vertical-title">
        <div className="vertical-title-text">Карта региона</div>
      </div>

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

                    return (
                      <div key={cellId} className="cell-with-lu-wrapper">

                        <div
                          className={[
                            'grid-cell',
                            ownedByMe ? 'grid-cell-owned' : '',
                            ownedByOther ? 'grid-cell-other' : '',
                            hasActiveAuction ? 'grid-cell-auction' : '',
                            blockedType ? `grid-cell-blocked grid-cell-blocked-${blockedType}` : '',
                            timerFinished ? 'grid-cell-disabled' : '',
                          ].filter(Boolean).join(' ')}
                          onClick={() => handleGridCellClick(cellId)}
                          title={
                            timerFinished ? 'Время вышло. Доступен только просмотр.'
                              : blockedType ? `${cellId} — ${getBlockedLabel(blockedType)}`
                              : ownedByMe ? `${cellId} — ваш участок (отказаться нельзя)`
                              : ownedByOther ? `${cellId} — занят другой командой`
                                : hasActiveAuction ? `${cellId} — идет аукцион`
                                  : ownedCount >= 5 ? `${cellId} — лимит 5 участков`
                                    : `${cellId} — нажмите чтобы выбрать`
                          }
                        >
                          <span className="cell-label">{cellId}</span>
                          {ownedByMe && <span className="cell-mark cell-mark-own">✓</span>}
                          {ownedByOther && <span className="cell-mark cell-mark-other">!</span>}
                          {hasActiveAuction && !ownedByMe && !ownedByOther && <span className="cell-mark cell-mark-auction">⚡</span>}
                          {blockedType && <span className="cell-mark cell-mark-blocked">✕</span>}
                          {timerFinished && <span className="cell-mark cell-mark-timer">✕</span>}
                        </div>

                        {lu && (
                          <div className="lu-container">
                            <div
                              className={[
                                'lu-marker',
                                isLUSelected(lu.id) ? 'selected' : '',
                                !canAffordLU(lu) && !isLUSelected(lu.id) ? 'disabled' : '',
                                timerFinished && !isLUSelected(lu.id) ? 'timer-disabled' : '', // Добавляем класс для маркеров при завершении времени
                              ].filter(Boolean).join(' ')}
                              style={lu.customStyle}
                              onClick={() => handleLUClick(lu)}
                              onMouseEnter={() => setHoveredLU(lu.id)}
                              onMouseLeave={() => setHoveredLU(null)}
                              title={
                                timerFinished && !isLUSelected(lu.id) 
                                  ? `${lu.name} — время вышло, доступен только просмотр` 
                                  : `${lu.name} — ${lu.cost} млн руб.${!canAffordLU(lu) && !isLUSelected(lu.id) ? ' (недостаточно средств)' : ''}`
                              }
                            >
                              <span className="lu-marker-number">{lu.shortName}</span>
                              {isLUSelected(lu.id) && <span className="lu-marker-check">✓</span>}
                            </div>
                            <div className="lu-name-label" style={{
                              position: 'absolute',
                              top: lu.customStyle?.top || '0',
                              left: lu.customStyle?.left || '0',
                              transform: getLUNamePosition(lu.position),
                              whiteSpace: 'nowrap',
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


      <div className="map-legend">
        <div className="legend-item">
          <div className="legend-color legend-color-own"></div>
          <span>Ваш участок</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-color-other"></div>
          <span>Занят другой командой</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-color-auction"></div>
          <span>Идет аукцион</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-color-free"></div>
          <span>Свободный участок</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-color-blocked-reserve"></div>
          <span>Природный заказник</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-color-blocked-settlement"></div>
          <span>Населённый пункт</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-color-blocked-company"></div>
          <span>Нефтяная компания</span>
        </div>
        {timerFinished && (
          <div className="legend-item">
            <div className="legend-color legend-color-timer"></div>
            <span>Время вышло (только просмотр)</span>
          </div>
        )}
      </div>

      {selectedInfoCard && viewMode === 'sidebar' && (
        <div className="modal-overlay" onClick={() => { setSelectedInfoCard(null); setViewMode(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setSelectedInfoCard(null); setViewMode(null); }}>✕</button>
            <h2>{selectedInfoCard.name}</h2>
            {selectedInfoCard.hasImage && (
              <div className="card-image-wrap">
                <img src={selectedInfoCard.imagePath} alt={selectedInfoCard.name} />
              </div>
            )}
            <div className="card-description">{selectedInfoCard.description}</div>
            <div className="card-meta">
              <span>Стоимость: <strong>{selectedInfoCard.cost} млн руб.</strong></span>
            </div>
          </div>
        </div>
      )}

      {showInfoCards && viewMode === 'button' && (
        <div className="modal-overlay" onClick={() => { setShowInfoCards(false); setSelectedInfoCard(null); setViewMode(null); }}>
          <div className="modal-content modal-list" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setShowInfoCards(false); setSelectedInfoCard(null); setViewMode(null); }}>✕</button>
            <h2>Информация о выбранных участках</h2>
            <div className="cards-grid">
              {selectedLU.map((lu) => (
                <div key={lu.id} className="info-card">
                  <div className="info-card-header">
                    <div className="info-card-icon">{lu.shortName}</div>
                    <div className="info-card-title-block">
                      <h3>{lu.name}</h3>
                      <span className="info-card-cost">{lu.cost} млн руб.</span>
                    </div>
                  </div>
                  {lu.hasImage && (
                    <div className="info-card-image">
                      <img src={lu.imagePath} alt={lu.name} />
                    </div>
                  )}
                  <div className="info-card-description">{lu.description}</div>
                  <div className="info-card-footer">
                    <span>Ячейка: {lu.cellRef}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {auctionModal && (() => {
        const auction = auctions.active[auctionModal.cellRef];
        const myId = player.teamId || player.name;
        const weLeading = auction?.currentBidTeamId === myId ||
          auction?.currentBidTeamName === player.name;
        return (
          <div className="modal-overlay" onClick={() => setAuctionModal(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setAuctionModal(null)}>✕</button>
              <h2>Аукцион — {auctionModal.cellName}</h2>

              {auction ? (
                <>
                  <div className="auction-info">
                    <div className="auction-info-row">
                      <span>Начальная цена:</span>
                      <strong>{auction.startPrice} млн руб.</strong>
                    </div>
                    <div className="auction-info-row">
                      <span>Шаг аукциона:</span>
                      <strong>{AUCTION_START_PRICE} млн руб.</strong>
                    </div>
                    <div className="auction-info-row">
                      <span>Текущая ставка:</span>
                      <strong>{auction.currentBid} млн руб.</strong>
                    </div>
                    <div className="auction-info-row">
                      <span>Лидирует:</span>
                      <strong>{auction.currentBidTeamName}</strong>
                    </div>
                    <div className="auction-info-row">
                      <span>Ваш бюджет:</span>
                      <strong>{budget} млн руб.</strong>
                    </div>
                    {weLeading && (
                      <div className="auction-leading">✓ Вы лидируете в торгах</div>
                    )}
                    {timerFinished && (
                      <div className="auction-warning" style={{ color: '#ff6b6b', marginTop: '10px', textAlign: 'center' }}>
                        ⚠️ Время на участие в аукционах истекло
                      </div>
                    )}
                  </div>

                  {!weLeading && !timerFinished && (
                    <div className="auction-bid-input">
                      <label>Ваша ставка (млн руб.):</label>
                      <input
                        type="number"
                        value={bidAmount}
                        min={auction.currentBid + AUCTION_START_PRICE}
                        step={AUCTION_START_PRICE}
                        max={budget}
                        onChange={(e) => setBidAmount(e.target.value)}
                      />
                      <div className="auction-bid-hint">
                        Минимальная ставка: {auction.currentBid + AUCTION_START_PRICE} млн руб.
                      </div>
                    </div>
                  )}

                  {auctionMsg && <div className="auction-message">{auctionMsg}</div>}

                  <div className="modal-actions">
                    {!weLeading && !timerFinished && (
                      <button className="modal-btn modal-btn-primary" onClick={handlePlaceBid}>
                        Сделать ставку
                      </button>
                    )}
                    {!timerFinished && (
                      <button className="modal-btn modal-btn-success" onClick={handleFinalizeAuction}>
                        {weLeading ? 'Подтвердить победу и оплатить' : 'Завершить торги'}
                      </button>
                    )}
                    {timerFinished && (
                      <button className="modal-btn modal-btn-secondary" onClick={() => setAuctionModal(null)}>
                        Закрыть
                      </button>
                    )}
                    {!timerFinished && (
                      <button className="modal-btn modal-btn-secondary" onClick={() => setAuctionModal(null)}>
                        Отмена
                      </button>
                    )}
                  </div>

                  {auction.bids.length > 1 && (
                    <div className="auction-history">
                      <div className="auction-history-title">История ставок:</div>
                      {[...auction.bids].reverse().map((bid, i) => (
                        <div key={i} className="auction-bid-row">
                          <span>{bid.teamName}</span>
                          <span>{bid.amount} млн руб.</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p style={{ textAlign: 'center', color: '#888', padding: '20px 0' }}>
                  Данные аукциона недоступны.
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default RegionMap;