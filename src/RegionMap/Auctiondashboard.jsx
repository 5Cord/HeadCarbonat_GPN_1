// С Бэкендом
// AuctionDashboard.jsx
import React, { useState, useEffect } from 'react';
import './Auctiondashboard.css';
import { AUCTION_START_PRICE } from '../../store/gameStore';

const AuctionDashboard = ({ auctions, player, budget, onPlaceBid, onLeaveAuction, currentPhase, formatCellRef = ref => ref }) => {
  const myId         = player.teamId || player.name;
  const activeEntries = Object.entries(auctions.active || {});

  const [bidAmounts, setBidAmounts] = useState({});
  const [messages, setMessages]     = useState({});
  const [pending, setPending]       = useState({}); // { [cellRef]: true } — идёт запрос

  // Синхронизируем поля ввода при обновлении аукционов
  useEffect(() => {
    setBidAmounts(prev => {
      const next = { ...prev };
      activeEntries.forEach(([cellRef, auction]) => {
        const minBid = auction.currentBid + AUCTION_START_PRICE;
        const cur    = next[cellRef];
        if (cur === undefined || cur === null || cur < minBid) {
          next[cellRef] = minBid;
        }
      });
      return next;
    });
    // Сбрасываем сообщения для аукционов где нас перебили
    setMessages(prev => {
      const next = { ...prev };
      activeEntries.forEach(([cellRef, auction]) => {
        const weLeading = auction.currentBidTeamId === myId || auction.currentBidTeamName === player.name;
        // Если нас перебили — убираем старое сообщение об успехе
        if (!weLeading && next[cellRef]?.startsWith('✓')) {
          delete next[cellRef];
        }
      });
      return next;
    });
  }, [auctions.active]); // eslint-disable-line react-hooks/exhaustive-deps

  if (currentPhase !== 'auction') return null;

  const myAuctions = activeEntries.filter(([, auction]) =>
    auction.participants?.includes(myId)
  );
  if (myAuctions.length === 0) return null;

  const leadingCount = myAuctions.filter(([, a]) =>
    a.currentBidTeamId === myId || a.currentBidTeamName === player.name
  ).length;

  // ── Ставка — поддерживает и sync и async onPlaceBid ──────────────────────
  const handleBid = async (cellRef) => {
    const auction = auctions.active[cellRef];
    if (!auction) return;

    const amount  = Number(bidAmounts[cellRef]);
    const minBid  = auction.currentBid + AUCTION_START_PRICE;

    // Валидация
    if (!Number.isFinite(amount) || amount % AUCTION_START_PRICE !== 0) {
      setMessages(m => ({ ...m, [cellRef]: `Ставка должна быть кратна ${AUCTION_START_PRICE} млн` }));
      return;
    }
    if (amount < minBid) {
      setMessages(m => ({ ...m, [cellRef]: `Минимальная ставка: ${minBid} млн руб.` }));
      return;
    }
    if (amount > budget) {
      setMessages(m => ({ ...m, [cellRef]: 'Недостаточно средств' }));
      return;
    }

    // Блокируем кнопку на время запроса
    setPending(p => ({ ...p, [cellRef]: true }));
    setMessages(m => ({ ...m, [cellRef]: undefined }));

    try {
      const result = await Promise.resolve(onPlaceBid(cellRef, amount));
      const ok     = result === true || result?.ok === true;

      if (ok) {
        setMessages(m => ({ ...m, [cellRef]: `✓ Ставка ${amount} млн принята!` }));
        setBidAmounts(b => ({ ...b, [cellRef]: amount + AUCTION_START_PRICE }));
      } else {
        const errMsg = typeof result === 'object' ? (result?.error || 'Ошибка при размещении ставки') : 'Ошибка при размещении ставки';
        setMessages(m => ({ ...m, [cellRef]: errMsg }));
      }
    } catch (err) {
      setMessages(m => ({ ...m, [cellRef]: err.message || 'Ошибка при размещении ставки' }));
    } finally {
      setPending(p => ({ ...p, [cellRef]: false }));
    }
  };

  return (
    <div className="auction-dashboard-overlay">
      <div className="auction-dashboard">

        {/* Шапка */}
        <div className="auction-dashboard-header">
          <div className="auction-dashboard-title">
            <span className="auction-dashboard-icon">⚡</span>
            Аукцион
          </div>
          <div className="auction-dashboard-summary">
            <span className="auction-summary-chip auction-summary-chip-total">
              Участков: {myAuctions.length}
            </span>
            {leadingCount > 0 && (
              <span className="auction-summary-chip auction-summary-chip-leading">
                Лидирую: {leadingCount}
              </span>
            )}
            {leadingCount < myAuctions.length && (
              <span className="auction-summary-chip auction-summary-chip-losing">
                Отстаю: {myAuctions.length - leadingCount}
              </span>
            )}
          </div>
        </div>

        {/* Карточки аукционов */}
        <div className="auction-dashboard-cards">
          {myAuctions.map(([cellRef, auction]) => {
            const weLeading  = auction.currentBidTeamId === myId || auction.currentBidTeamName === player.name;
            const minNextBid = auction.currentBid + AUCTION_START_PRICE;
            const bidVal     = bidAmounts[cellRef] !== undefined ? bidAmounts[cellRef] : minNextBid;
            const msg        = messages[cellRef];
            const isSuccess  = msg?.startsWith('✓');
            const isBusy     = pending[cellRef] === true;

            const isDisabled = isBusy
              || !Number.isFinite(Number(bidVal))
              || Number(bidVal) < minNextBid
              || Number(bidVal) > budget;

            const participantRows = (auction.participants || []).map(teamId => {
              const latestBid = [...(auction.bids || [])].reverse().find(b => b.teamId === teamId);
              const teamName = auction.participantDetails?.find(p => p.teamId === teamId)?.teamName
                || latestBid?.teamName
                || (auction.currentBidTeamId === teamId ? auction.currentBidTeamName : null)
                || teamId;
              return { teamId, teamName, latestBid };
            });

            return (
              <div
                key={cellRef}
                className={`auction-card ${weLeading ? 'auction-card-leading' : 'auction-card-losing'}`}
              >
                <div className="auction-card-body">

                  {/* Координата + статус */}
                  <div className="auction-card-top">
                    <div className="auction-card-ref">{formatCellRef(cellRef)}</div>
                    <div className={`auction-card-badge ${weLeading ? 'badge-leading' : 'badge-losing'}`}>
                      {weLeading ? '▲ Лидирую' : '▼ Отстаю'}
                    </div>
                  </div>

                  {/* Данные ставки */}
                  <div className="auction-card-bid-info">
                    <div className="auction-bid-current">
                      <span className="auction-bid-label">Ставка</span>
                      <span className="auction-bid-value">{auction.currentBid} млн</span>
                    </div>
                    <div className="auction-bid-leader">
                      <span className="auction-bid-label">Лидирует</span>
                      <span className={`auction-bid-team ${weLeading ? 'bid-team-me' : 'bid-team-other'}`}>
                        {weLeading ? 'Вы' : (auction.currentBidTeamName || 'Другая команда')}
                      </span>
                    </div>
                    <div className="auction-bid-participants">
                      <span className="auction-bid-label">Участников</span>
                      <span className="auction-bid-value">{auction.participants?.length || 1}</span>
                    </div>
                  </div>

                  {/* Лидирую */}
                  {weLeading ? (
                    <div className="auction-leading-status">
                      <div className="auction-leading-icon">✓</div>
                      <div className="auction-leading-text">
                        <strong>Вы лидируете</strong>
                        <span>Участок ваш, если никто не перебьёт</span>
                      </div>
                      <button className="auction-leave-btn" onClick={() => onLeaveAuction(cellRef)}>
                        Выйти
                      </button>
                    </div>
                  ) : (
                    <div className="auction-bid-form">
                      <div className="auction-losing-alert">⚠ Вас перебили — сделайте ставку!</div>
                      <div className="auction-bid-input-row">
                        <div className="auction-bid-input-wrap">
                          <input
                            type="number"
                            className="auction-bid-input-field"
                            value={bidVal}
                            min={minNextBid}
                            step={AUCTION_START_PRICE}
                            max={budget}
                            disabled={isBusy}
                            onChange={e => {
                              const raw = e.target.value;
                              setBidAmounts(b => ({ ...b, [cellRef]: raw === '' ? '' : Number(raw) }));
                              setMessages(m => ({ ...m, [cellRef]: undefined }));
                            }}
                            onKeyDown={e => e.key === 'Enter' && !isDisabled && handleBid(cellRef)}
                          />
                          <span className="auction-bid-currency">млн</span>
                        </div>
                        <button
                          className="auction-place-bid-btn"
                          onClick={() => handleBid(cellRef)}
                          disabled={isDisabled}
                        >
                          {isBusy ? '...' : 'Поставить'}
                        </button>
                        <button
                          className="auction-leave-btn"
                          onClick={() => onLeaveAuction(cellRef)}
                          disabled={isBusy}
                        >
                          Выйти
                        </button>
                      </div>
                      <div className="auction-bid-hint-row">
                        Мин.: <strong>{minNextBid} млн</strong> · Шаг: <strong>{AUCTION_START_PRICE} млн</strong>
                      </div>
                    </div>
                  )}

                  {/* Сообщение об успехе/ошибке */}
                  {msg && (
                    <div className={`auction-card-message ${isSuccess ? 'auction-msg-success' : 'auction-msg-error'}`}>
                      {msg}
                    </div>
                  )}

                  <div className="auction-participants-list">
                    <div className="auction-participants-title">Участники и последние ставки</div>
                    {participantRows.map(({ teamId, teamName, latestBid }) => (
                      <div key={teamId} className={`auction-participant-row ${teamId === myId ? 'auction-participant-me' : ''}`}>
                        <span>{teamId === myId ? `Вы — ${teamName}` : teamName}</span>
                        <strong>{latestBid ? `${latestBid.amount} млн` : 'Пока без ставки'}</strong>
                      </div>
                    ))}
                  </div>

                  {/* История последних ставок */}
                  {auction.bids?.length > 0 && (
                    <div className="auction-bids-mini">
                      <div className="auction-participants-title">Последние ставки</div>
                      {[...auction.bids].reverse().slice(0, 3).map((bid, i) => {
                        const isMe = bid.teamId === myId || bid.teamName === player.name;
                        return (
                          <div key={i} className={`auction-bid-mini-row ${isMe ? 'bid-mini-me' : ''}`}>
                            <span>{isMe ? 'Вы' : (bid.teamName || bid.teamId || 'Участник')}</span>
                            <span>{bid.amount} млн</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>

        {/* Футер */}
        <div className="auction-dashboard-footer">
          <span>Ваш бюджет:</span>
          <strong>{budget.toLocaleString('ru-RU')} млн руб.</strong>
        </div>

      </div>
    </div>
  );
};

export default AuctionDashboard;
