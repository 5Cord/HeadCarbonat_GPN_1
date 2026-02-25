import React, { useState, useEffect } from 'react';
import {
  FIELD_WORK_BLOCKS,
  calculateTotalCost,
  calculateQualityScore,
  prepareFieldWorkForAPI
} from './fieldWorkData';
import useGameStore from '../../store/gameStore';
import './FieldWorkPanel.css';

/**
 * FieldWorkPanel — Полевые работы
 *
 * Связь назад  → ResearchPanel: берём мобилизованные столбцы + success > 0
 * Связь вперёд → ResultsPanel:  передаём selections + qualityScore + totalCost
 *
 * Каждый блок карточек — это группа работ одного типа.
 * Внутри блока несколько карточек, в каждой 2-3 варианта по рангам.
 * Команда выбирает ОДИН вариант в каждой карточке.
 */
/**
 * FieldWorkPanel — Полевые работы
 *
 * Связь назад  → ResearchPanel: берём мобилизованные столбцы
 * Связь назад  → EventsZone:    блок выкладывается только если счёт по ЛУ >= 0
 * Связь вперёд → ResultsPanel:  передаём selections + qualityScore + totalCost
 *
 * Логика выкладки блока:
 *   1. Столбец (mobWorkId) должен быть мобилизован в ResearchPanel для этого ЛУ
 *   2. Счёт в EventsZone для этого ЛУ должен быть >= 0
 *   Если счёт < 0 — ничего не выкладывается вообще (команда «провалилась»)
 */
const FieldWorkPanel = ({ onComplete, currentLU }) => {
  const {
    player,
    licenseUnits,
    research,
    fieldWork,
    events,
  } = useGameStore();

  const luId = currentLU?.id;

  const researchProgress = luId ? (research.progressByLU[luId] || null) : null;

  const eventsScore = luId ? (events.lineScores[luId] || 0) : 0;
  const eventsSkipped = luId ? ((events.skippedLines[luId] || []).length > 0) : false;

  const availableBlocks = (() => {
    if (eventsScore < 0) return []; 

    if (!researchProgress) return [];
    const mobilized = researchProgress.mobilizedColumns || [];

    return FIELD_WORK_BLOCKS.filter(block => mobilized.includes(block.mobWorkId));
  })();

  const savedSelections = luId ? (fieldWork.selectionsByLU[luId]?.selections || {}) : {};

  const [selections, setSelections] = useState(savedSelections);

  useEffect(() => {
    setSelections(savedSelections);
  }, [luId, savedSelections]);

  useEffect(() => {
    if (!luId) return;
    const totalCost = calculateTotalCost(selections, availableBlocks);
    const qualityScore = calculateQualityScore(selections, availableBlocks);

    useGameStore.setState(state => ({
      fieldWork: {
        ...state.fieldWork,
        selectionsByLU: {
          ...state.fieldWork.selectionsByLU,
          [luId]: {
            selections,
            totalCost,
            qualityScore,
            availableBlocks: availableBlocks.map(b => b.blockId)
          }
        }
      }
    }));
  }, [selections, luId]);

  const handleSelectOption = (cardId, rank) => {
    setSelections(prev => ({
      ...prev,
      [cardId]: rank
    }));
  };

  const totalCost = calculateTotalCost(selections, availableBlocks);
  const qualityScore = calculateQualityScore(selections, availableBlocks);

  const totalCards = availableBlocks.reduce((sum, b) => sum + b.cards.length, 0);
  const selectedCards = Object.keys(selections).length;

  const canAfford = player.budget >= totalCost;

  const handleConfirm = () => {
    if (!canAfford) {
      alert('Недостаточно бюджета!');
      return;
    }

    useGameStore.setState(state => ({
      player: {
        ...state.player,
        budget: state.player.budget - totalCost
      }
    }));

    // Данные для future backend
    const apiPayload = prepareFieldWorkForAPI(
      player.id,
      luId,
      selections,
      availableBlocks
    );
    console.log('[FieldWork] payload для backend:', apiPayload);

    onComplete();
  };

  const groupColors = { gray: 'Сейсморазведка', orange: 'Поисково-разведочное бурение', beige: 'Специализированные работы', blue: 'Оптимизация и перевод' };

  // ЛУ селектор
  const handleLUChange = (e) => {
    const lu = licenseUnits.owned.find(l => l.id === e.target.value);
    if (lu) {
      useGameStore.setState(state => ({
        licenseUnits: { ...state.licenseUnits, current: lu }
      }));
    }
  };

  if (availableBlocks.length === 0) {
    const failedEvents = eventsScore < 0;
    const noResearchAtAll = !researchProgress || (
      (!researchProgress.purchasedWorks || researchProgress.purchasedWorks.length === 0) &&
      (!researchProgress.mobilizedColumns || researchProgress.mobilizedColumns.length === 0)
    );
    const hasMobilization = researchProgress?.mobilizedColumns?.length > 0;

    return (
      <div className="fieldwork-panel fieldwork-empty">
        <div className="fieldwork-header">
          <h2>🛠️ Полевые работы</h2>
          {licenseUnits.owned.length > 1 && (
            <div className="lu-selector">
              <label>ЛУ:</label>
              <select value={luId || ''} onChange={handleLUChange} className="lu-select">
                {licenseUnits.owned.map(lu => (
                  <option key={lu.id} value={lu.id}>{lu.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="empty-state">
          {failedEvents ? (
            <>
              <div className="empty-icon">❌</div>
              <h3>Провал на зоне событий</h3>
              <p>
                Счёт по событиям для «{currentLU?.name}» составил <strong className="score-negative">{eventsScore}</strong> (меньше 0).
                Команда не смогла пройти этот участок — полевые работы не выкладываются.
              </p>
            </>
          ) : noResearchAtAll ? (
            <>
              <div className="empty-icon">🔬</div>
              <h3>НИР не проводились</h3>
              <p>
                Лицензионный участок «{currentLU?.name}» <strong>куплен</strong>, но на этапе «Научные исследования» для него не была куплена ни одна работа.
              </p>
              <p>
                Чтобы карточки полевых работ выкладывались, нужно купить хотя бы одну НИР и мобилизовать соответствующий столбец.
              </p>
            </>
          ) : (
            <>
              <div className="empty-icon">🛑</div>
              <h3>Нет мобилизованных столбцов</h3>
              <p>
                Для «{currentLU?.name}» не был мобилизован ни один столбец мобилизации.
                Полевые работы доступны только по видам, у которых столбец был мобилизован на этапе НИР.
              </p>
            </>
          )}
          <button className="next-btn" onClick={onComplete}>
            Далее → К результатам
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fieldwork-panel">
      <div className="fieldwork-header">
        <h2>🛠️ Полевые работы</h2>
        <div className="header-right">
          {licenseUnits.owned.length > 1 && (
            <div className="lu-selector">
              <label>ЛУ:</label>
              <select value={luId || ''} onChange={handleLUChange} className="lu-select">
                {licenseUnits.owned.map(lu => (
                  <option key={lu.id} value={lu.id}>{lu.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="budget-badge">
            💰 {player.budget} млн ₽
          </div>
        </div>
      </div>

      <div className="fieldwork-info-banner">
        <p>📋 Для <strong>{currentLU?.name}</strong> доступно <strong>{availableBlocks.length}</strong> блоков работ ({totalCards} карточек).</p>
        <p>🎯 В каждой карточке выберите один вариант. Ранг 1 = лучшее качество, выше стоимость.</p>
        <p>📊 Выбрано: <strong>{selectedCards}</strong> / {totalCards} карточек</p>
        <p className={`events-score-line ${eventsScore >= 0 ? 'ok' : 'fail'}`}>
          🎲 Счёт событий для этого ЛУ: <strong>{eventsScore >= 0 ? '+' : ''}{eventsScore}</strong>
          {eventsSkipped && ' (пропущено)'}
        </p>
      </div>

      <div className="fieldwork-blocks">
        {availableBlocks.map(block => (
          <div key={block.blockId} className={`fieldwork-block group-${block.groupColor}`}>
            <div className="block-header">
              <div className="block-title-row">
                <span className={`block-color-badge ${block.groupColor}`}></span>
                <h3>{block.title}</h3>
                <span className="block-group-label">{groupColors[block.groupColor]}</span>
              </div>
              <div className="block-research-link">
                <span className="link-icon">🔗</span>
                <span>Успешность НИР: <strong>{(researchProgress?.successRates?.[block.mobWorkId] || 0)}%</strong></span>
              </div>
            </div>

            <div className="block-cards">
              {block.cards.map(card => {
                const chosenRank = selections[card.cardId];

                return (
                  <div key={card.cardId} className={`fieldwork-card ${chosenRank ? 'has-selection' : 'no-selection'}`}>
                    <div className="card-title">{card.cardTitle}</div>
                    <div className="card-options">
                      {card.options.map(option => (
                        <button
                          key={option.rank}
                          className={`option-btn rank-${option.rank} ${chosenRank === option.rank ? 'selected' : ''}`}
                          onClick={() => handleSelectOption(card.cardId, option.rank)}
                        >
                          <div className="option-rank">Ранг {option.rank}</div>
                          <div className="option-param">{option.param}</div>
                          <div className="option-cost">
                            {option.cost > 0 ? `${option.cost} млн ₽` : 'Бесплатно'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="fieldwork-summary">
        <div className="summary-stats">
          <div className="summary-item">
            <span className="summary-label">Выбрано карточек</span>
            <span className="summary-value ok">
              {selectedCards} / {totalCards}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Стоимость</span>
            <span className={`summary-value ${canAfford ? 'ok' : 'danger'}`}>
              {totalCost} млн ₽
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Бюджет после оплаты</span>
            <span className={`summary-value ${player.budget - totalCost >= 0 ? 'ok' : 'danger'}`}>
              {player.budget - totalCost} млн ₽
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Качество работ</span>
            <span className={`summary-value quality ${qualityScore >= 70 ? 'high' : qualityScore >= 40 ? 'medium' : 'low'}`}>
              {qualityScore}%
            </span>
          </div>
        </div>

        <div className="summary-actions">
          <button
            className="confirm-btn"
            onClick={handleConfirm}
            disabled={!canAfford}
          >
            ✅ Подтвердить выбор ({totalCost} млн ₽)
          </button>
          <button className="next-btn" onClick={onComplete}>
            Далее → К результатам
          </button>
        </div>

        {!canAfford && (
          <p className="summary-warning">⚠️ Недостаточно бюджета</p>
        )}
      </div>
    </div>
  );
};

export default FieldWorkPanel;