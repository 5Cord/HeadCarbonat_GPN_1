// AuctionDashboard.jsx — модальное окно всех аукционов

import React, { useState, useEffect } from 'react';
import './AuctionDashboard.css';
import { AUCTION_START_PRICE } from '../../store/gameStore';

const AuctionDashboard = ({ auctions, player, budget, onPlaceBid, onLeaveAuction, currentPhase }) => {
  const myId = player.teamId || player.name;
  const activeEntries = Object.entries(auctions.active || {});

  // bidAmounts: { [cellRef]: number } — всегда числа, не строки
  const [bidAmounts, setBidAmounts] = useState({});
  const [messages, setMessages]     = useState({});

  // Каждый раз когда обновились аукционы — синхронизируем поля ввода.
  // Правило: если текущее значение поля МЕНЬШЕ нового минимума — поднимаем до минимума.
  // Если поля ещё нет вообще — ставим минимум.
  useEffect(() => {
    setBidAmounts(prev => {
      const next = { ...prev };
      activeEntries.forEach(([cellRef, auction]) => {
        const minBid = auction.currentBid + AUCTION_START_PRICE;
        const cur = next[cellRef];
        if (cur === undefined || cur === null || cur < minBid) {
          next[cellRef] = minBid;
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

  const handleBid = (cellRef) => {
    const auction = auctions.active[cellRef];
    if (!auction) return;

    const amount  = Number(bidAmounts[cellRef]);
    const minBid  = auction.currentBid + AUCTION_START_PRICE;

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

    const ok = onPlaceBid(cellRef, amount);
    if (ok) {
      setMessages(m => ({ ...m, [cellRef]: `✓ Ставка ${amount} млн принята!` }));
      // После успешной ставки — следующий шаг
      setBidAmounts(b => ({ ...b, [cellRef]: amount + AUCTION_START_PRICE }));
    } else {
      setMessages(m => ({ ...m, [cellRef]: 'Ошибка при размещении ставки' }));
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

        {/* Карточки */}
        <div className="auction-dashboard-cards">
          {myAuctions.map(([cellRef, auction]) => {
            const weLeading  = auction.currentBidTeamId === myId || auction.currentBidTeamName === player.name;
            const minNextBid = auction.currentBid + AUCTION_START_PRICE;

            // Берём значение из state (число), или минимум если не задано
            const bidVal = bidAmounts[cellRef] !== undefined ? bidAmounts[cellRef] : minNextBid;

            const msg       = messages[cellRef];
            const isSuccess = msg?.startsWith('✓');

            const isDisabled = !Number.isFinite(Number(bidVal))
              || Number(bidVal) < minNextBid
              || Number(bidVal) > budget;

            return (
              <div
                key={cellRef}
                className={`auction-card ${weLeading ? 'auction-card-leading' : 'auction-card-losing'}`}
              >
                <div className="auction-card-body">

                  {/* Координата + статус */}
                  <div className="auction-card-top">
                    <div className="auction-card-ref">{cellRef}</div>
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
                        {weLeading ? 'Вы' : auction.currentBidTeamName}
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
                            onChange={e => {
                              const raw = e.target.value;
                              // Храним как число; если поле пустое — 0 (покажет ошибку при попытке поставить)
                              setBidAmounts(b => ({ ...b, [cellRef]: raw === '' ? '' : Number(raw) }));
                              // Сбрасываем сообщение при изменении
                              setMessages(m => ({ ...m, [cellRef]: undefined }));
                            }}
                            onKeyDown={e => e.key === 'Enter' && handleBid(cellRef)}
                          />
                          <span className="auction-bid-currency">млн</span>
                        </div>
                        <button
                          className="auction-place-bid-btn"
                          onClick={() => handleBid(cellRef)}
                          disabled={isDisabled}
                        >
                          Поставить
                        </button>
                        <button className="auction-leave-btn" onClick={() => onLeaveAuction(cellRef)}>
                          Выйти
                        </button>
                      </div>
                      <div className="auction-bid-hint-row">
                        Мин.: <strong>{minNextBid} млн</strong> · Шаг: <strong>{AUCTION_START_PRICE} млн</strong>
                      </div>
                    </div>
                  )}

                  {/* Сообщение */}
                  {msg && (
                    <div className={`auction-card-message ${isSuccess ? 'auction-msg-success' : 'auction-msg-error'}`}>
                      {msg}
                    </div>
                  )}

                  {/* Последние ставки */}
                  {auction.bids?.length > 0 && (
                    <div className="auction-bids-mini">
                      {[...auction.bids].reverse().slice(0, 3).map((bid, i) => {
                        const isMe = bid.teamId === myId || bid.teamName === player.name;
                        return (
                          <div key={i} className={`auction-bid-mini-row ${isMe ? 'bid-mini-me' : ''}`}>
                            <span>{isMe ? 'Вы' : bid.teamName}</span>
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