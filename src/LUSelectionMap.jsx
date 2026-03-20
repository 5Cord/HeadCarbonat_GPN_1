import React, { useState } from 'react';
import RegionMap from './RegionMap/RegionMap';
import InfoCards from './InfoCards/InfoCards';
import useGameStore from '../store/gameStore';
import './LUSelectionMap.css';

const AVAILABLE_LU = [
  { id: 'well1', name: 'Параметрическая скважина №1', cost: 10, type: 'well' },
  { id: 'well2', name: 'Параметрическая скважина №2', cost: 10, type: 'well' },
  { id: 'well3', name: 'Параметрическая скважина №3', cost: 10, type: 'well' },
  { id: 'well4', name: 'Параметрическая скважина №4', cost: 20, type: 'well' },
  { id: 'well5', name: 'Параметрическая скважина №5', cost: 20, type: 'well' },
  { id: 'well6', name: 'Параметрическая скважина №6', cost: 10, type: 'well' },
  { id: 'outcrop', name: 'Обнажение (О)', cost: 10, type: 'outcrop' },
  { id: 'quarry', name: 'Карьер (К)', cost: 20, type: 'quarry' },
  { id: 'research', name: 'Региональный НИР (Н)', cost: 70, type: 'research' },
  { id: 'seismic', name: 'ОиИ ретро рег. СРР (И)', cost: 30, type: 'seismic' }
];

/**
 * Компонент для выбора лицензионных участков на карте
 * Появляется после настройки команды в лобби
 */
const LUSelectionMap = () => {
  const {
    player,
    licenseUnits,
    purchaseLU,
    unpurchaseLU,
    startGame,
  } = useGameStore();

  const [showInfoCards, setShowInfoCards] = useState(false);
  const [showResourceDensity, setShowResourceDensity] = useState(false);

  const handleLUClick = (lu) => {
    const isOwned = licenseUnits.owned.find(item => item.id === lu.id);
    
    if (isOwned) {
      unpurchaseLU(lu.id);
    } else if (licenseUnits.owned.length < 5) {
      const success = purchaseLU(lu);
      
      if (success && lu.id === 'research') {
        setTimeout(() => setShowResourceDensity(true), 500);
      }
    }
  };

  const handleStartGame = () => {
    if (licenseUnits.owned.length === 0) {
      alert('Необходимо выбрать хотя бы один лицензионный участок!');
      return;
    }

    startGame({
      availableLU: AVAILABLE_LU,
      regionMap: { cells: [] },
      researchWorks: [],
      fieldWorkOptions: []
    });
  };

  const totalSpent = licenseUnits.owned.reduce((sum, lu) => sum + lu.cost, 0);
  const remainingBudget = player.budget - totalSpent;
  const purchasedResearch = licenseUnits.owned.find(lu => lu.id === 'research');

  return (
    <div className="lu-selection-map">
      <div className="selection-header">
        <div className="team-display">
          <h2>👥 {player.name || 'Команда'}</h2>
          <p>{player.teamMembers.length} чел. | {player.experienceLevel === 'student' ? 'Студенты' : 'Профи'}</p>
        </div>

        <div className="budget-display">
          <div className="budget-item">
            <span className="label">Бюджет:</span>
            <span className="value">{player.budget} млн ₽</span>
          </div>
          <div className="budget-item">
            <span className="label">Потрачено:</span>
            <span className="value spent">{totalSpent} млн ₽</span>
          </div>
          <div className="budget-item">
            <span className="label">Остаток:</span>
            <span className={`value ${remainingBudget < 100 ? 'low' : ''}`}>
              {remainingBudget} млн ₽
            </span>
          </div>
        </div>

        <div className="selection-controls">
          <button 
            className="info-btn"
            onClick={() => setShowInfoCards(!showInfoCards)}
            disabled={licenseUnits.owned.length === 0}
          >
            📋 Карточки ({licenseUnits.owned.length})
          </button>

          {purchasedResearch && (
            <label className="density-toggle">
              <input
                type="checkbox"
                checked={showResourceDensity}
                onChange={(e) => setShowResourceDensity(e.target.checked)}
              />
              Карта ресурсов
            </label>
          )}
        </div>
      </div>

      <div className="instructions">
        <p>
          💡 Выберите от 1 до 5 лицензионных участков. 
          Рекомендуется начать с <strong>"Региональный НИР"</strong> для получения карты плотности ресурсов.
        </p>
      </div>

      <RegionMap
        selectedLU={licenseUnits.owned}
        onLUClick={handleLUClick}
        budget={player.budget}
        showResourceDensity={showResourceDensity}
        resourceDensityData={showResourceDensity ? RESOURCE_DENSITY_DATA : null}
      />

      <div className="selected-lu-panel">
        <h3>Выбранные лицензионные участки ({licenseUnits.owned.length}/5)</h3>
        
        {licenseUnits.owned.length === 0 ? (
          <p className="empty-state">Нажмите на ЛУ на карте для выбора</p>
        ) : (
          <div className="selected-lu-list">
            {licenseUnits.owned.map((lu, idx) => (
              <div key={lu.id} className="selected-lu-item">
                <span className="lu-number">{idx + 1}</span>
                <div className="lu-info">
                  <strong>{lu.name}</strong>
                  <span>{lu.cost} млн ₽</span>
                </div>
                <button
                  className="remove-btn"
                  onClick={() => handleLUClick(lu)}
                  title="Отменить выбор"
                >
                  ✕
                </button>
              </div>
            ))}
            
            <div className="lu-total">
              <strong>Итого:</strong>
              <span>{totalSpent} млн ₽</span>
            </div>
          </div>
        )}

        <button
          className="start-game-btn"
          onClick={handleStartGame}
          disabled={licenseUnits.owned.length === 0}
        >
          Начать игру с {licenseUnits.owned.length} ЛУ
        </button>
      </div>

      {showInfoCards && (
        <div className="modal-overlay" onClick={() => setShowInfoCards(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setShowInfoCards(false)}>
              ✕
            </button>
            <InfoCards 
              selectedLU={licenseUnits.owned}
              onResourceMapUnlock={() => setShowResourceDensity(true)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const RESOURCE_DENSITY_DATA = {
  'C3': 45, 'C4': 42, 'D3': 38, 'D4': 40, 'E3': 35, 'E4': 37,
  'F4': 32, 'F5': 30, 'G4': 28, 'G5': 31, 'H5': 25, 'H6': 27,
  'I5': 22, 'I6': 24, 'B2': 9, 'B3': 8, 'C2': 7, 'C5': 8.5,
  'D2': 6.5, 'D5': 9, 'E2': 7.5, 'E5': 8, 'F2': 6, 'F3': 7,
  'F6': 8.5, 'G3': 6.5, 'G6': 9, 'H3': 7, 'H4': 8, 'H7': 8.5,
  'I3': 6, 'I4': 7.5, 'I7': 9, 'J4': 6.5, 'J5': 7, 'J6': 8,
  'A1': 3, 'A2': 2.5, 'A3': 4, 'A4': 3.5, 'A5': 4.5,
};

export default LUSelectionMap;