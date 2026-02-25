import React, { useState, useEffect } from 'react';
import RegionMap from './RegionMap/RegionMap';
import ResearchPanel from './Research/ResearchPanel';
import EventsZone from './Events/EventsZone';
import FieldWorkPanel from './FieldWork/FieldWorkPanel';
import ResultsPanel from './Results/ResultsPanel';
import InfoCards from './InfoCards/InfoCards';
import useGameStore from '../store/gameStore';
import styles from './GameBoard.module.css';

const GameBoard = () => {
  const [expandedField, setExpandedField] = useState(null);
  const [showInfoCards, setShowInfoCards] = useState(false);
  const [selectedInfoCard, setSelectedInfoCard] = useState(null);
  const [isWideScreen, setIsWideScreen] = useState(window.innerWidth > 1580);
  const [viewMode, setViewMode] = useState(null);

  const {
    game,
    player,
    licenseUnits,
    purchaseLU,
    unpurchaseLU,
    getCurrentLU,
  } = useGameStore();

  const currentLU = getCurrentLU();
  const set = useGameStore.setState;

  useEffect(() => {
    const handleResize = () => {
      setIsWideScreen(window.innerWidth > 1580);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getActiveField = () => {
    if (licenseUnits.owned.length === 0) {
      return 0;
    }

    if (!currentLU && licenseUnits.owned.length > 0) {
      const firstLU = licenseUnits.owned[0];
      set({
        licenseUnits: { ...licenseUnits, current: firstLU },
        game: { ...game, currentPhase: 'REGION_MAP' }
      });
      return 0;
    }

    if (currentLU) {
      const luResearch = game.currentLUProgress?.[currentLU.id] || {};

      if (!luResearch.researchCompleted) return 1;
      if (!luResearch.eventsCompleted) return 2;
      if (!luResearch.fieldWorkCompleted) return 3;
      if (!luResearch.resultsCompleted) return 4;

      const currentIndex = licenseUnits.owned.findIndex(lu => lu.id === currentLU.id);
      if (currentIndex < licenseUnits.owned.length - 1) {
        const nextLU = licenseUnits.owned[currentIndex + 1];
        set({
          licenseUnits: { ...licenseUnits, current: nextLU },
          game: {
            ...game,
            currentPhase: 'REGION_MAP',
            currentLUProgress: {
              ...game.currentLUProgress,
              [nextLU.id]: {}
            }
          }
        });
        return 1;
      }
    }

    return 1;
  };

  const activeField = getActiveField();

  const isFieldAvailable = (fieldIndex) => {
    if (fieldIndex === 0) return true;
    if (licenseUnits.owned.length === 0) return false;
    return fieldIndex <= activeField;
  };

  const handleFieldClick = (fieldIndex) => {
    if (!isFieldAvailable(fieldIndex)) {
      alert('Сначала выполните предыдущие этапы для текущего ЛУ!');
      return;
    }
    setExpandedField(fieldIndex);
  };

  const handleCloseField = () => {
    setExpandedField(null);
  };

  const handleNextPhase = (currentField) => {
    if (currentLU) {
      const luProgress = game.currentLUProgress?.[currentLU.id] || {};
      let newProgress = { ...luProgress };
      let nextField = null;

      switch (currentField) {
        case 1:
          newProgress.researchCompleted = true;
          nextField = 2;
          break;
        case 2:
          newProgress.eventsCompleted = true;
          nextField = 3;
          break;
        case 3:
          newProgress.fieldWorkCompleted = true;
          nextField = 4;
          break;
        case 4:
          newProgress.resultsCompleted = true;
          const currentIndex = licenseUnits.owned.findIndex(lu => lu.id === currentLU.id);
          if (currentIndex < licenseUnits.owned.length - 1) {
            const nextLU = licenseUnits.owned[currentIndex + 1];
            set({
              licenseUnits: { ...licenseUnits, current: nextLU },
              game: {
                ...game,
                currentLUProgress: {
                  ...game.currentLUProgress,
                  [currentLU.id]: newProgress,
                  [nextLU.id]: {}
                }
              }
            });
            nextField = 1;
          } else {
            alert('🎉 Поздравляем! Вы завершили работу со всеми лицензионными участками!');
            nextField = 0;
          }
          break;
      }

      if (currentField !== 4) {
        set({
          game: {
            ...game,
            currentLUProgress: {
              ...game.currentLUProgress,
              [currentLU.id]: newProgress
            }
          }
        });
      }

      setExpandedField(null);

      if (nextField !== null) {
        setTimeout(() => {
          if (nextField === 1 && licenseUnits.owned.length > 0) {
            setExpandedField(nextField);
          }
        }, 300);
      }
    }
  };

  const handleStartGame = () => {
    if (licenseUnits.owned.length === 0) {
      alert('Выберите хотя бы один лицензионный участок!');
      return;
    }

    const firstLU = licenseUnits.owned[0];
    set({
      game: {
        ...game,
        currentPhase: 'RESEARCH',
        currentLUProgress: {
          [firstLU.id]: {
            researchCompleted: false,
            eventsCompleted: false,
            fieldWorkCompleted: false,
            resultsCompleted: false
          }
        }
      },
      licenseUnits: {
        ...licenseUnits,
        current: firstLU
      }
    });

    setExpandedField(1);
  };

  const fields = [
    { id: 0, title: 'Карта региона', icon: '🗺️', number: '0', component: RegionMap },
    { id: 1, title: 'Научные исследования', icon: '🔬', number: '1', component: ResearchPanel },
    { id: 2, title: 'Зона событий', icon: '🎲', number: '2', component: EventsZone },
    { id: 3, title: 'Полевые работы', icon: '🛠️', number: '3', component: FieldWorkPanel },
    { id: 4, title: 'Результаты работ', icon: '📊', number: '4', component: ResultsPanel }
  ];

  const getCurrentLUProgress = () => {
    if (!currentLU) return {};
    return game.currentLUProgress?.[currentLU.id] || {};
  };

  const isStageCompleted = (fieldIndex) => {
    if (!currentLU) return false;
    const progress = getCurrentLUProgress();

    switch (fieldIndex) {
      case 1: return progress.researchCompleted || false;
      case 2: return progress.eventsCompleted || false;
      case 3: return progress.fieldWorkCompleted || false;
      case 4: return progress.resultsCompleted || false;
      default: return false;
    }
  };

  const getFieldStatus = (fieldIndex) => {
    if (fieldIndex === 0) return 'active';
    if (!isFieldAvailable(fieldIndex)) return 'locked';
    if (fieldIndex === activeField) return 'active';
    if (isStageCompleted(fieldIndex)) return 'completed';
    return 'available';
  };

  if (expandedField !== null) {
    const field = fields[expandedField];
    const FieldComponent = field.component;
    const isMapField = expandedField === 0;
    const progress = getCurrentLUProgress();

    return (
      <div className={styles.gameBoardExpanded}>
        {isMapField ? (
          <RegionMap
            selectedLU={licenseUnits.owned}
            onLUClick={(lu) => {
              const isOwned = licenseUnits.owned.find(item => item.id === lu.id);
              if (!isOwned && licenseUnits.owned.length < 5) {
                purchaseLU(lu);
              }
            }}
            budget={player.budget}
            showResourceDensity={licenseUnits.owned.some(lu => lu.id === 'research')}
            onComplete={handleCloseField}
            onNext={handleStartGame}
          />
        ) : (
          <FieldComponent
            onComplete={() => handleNextPhase(expandedField)}
            currentLU={currentLU}
            luProgress={progress}
          />
        )}
      </div>
    );
  }

  return (
    <div className={styles.gameBoardFullscreen}>
      <div className={styles.gameLogo}>
        <div className={styles.logoIcon}>⚙️</div>
        <div className={styles.logoText}>
          <div className={styles.logoTitle}>КУРС</div>
          <div className={styles.logoSubtitle}>НА КАРБОНАТЫ</div>
        </div>
      </div>

      <div className={`${styles.gameInfoPanel} ${!isWideScreen ? styles.ultraCompact : ''}`}>
        {!isWideScreen ? (
          <>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}></span>
              <span className={styles.infoValue}>{player.name}</span>
            </div>
            <div className={`${styles.infoRow} ${styles.iconsOnly}`}>
              <span className={styles.infoLabel}></span>
              <span className={styles.infoValue}>{player.budget}₽</span>
              <span className={styles.infoLabel}></span>
              <span className={styles.infoValue}>{licenseUnits.owned.length}/5</span>
            </div>
            {licenseUnits.owned.length > 0 && (
              <button
                className={`${styles.infoCardsToggleBtn} ${styles.microBtn}`}
                onClick={() => {
                  setViewMode('button');
                  setShowInfoCards(true);
                }}
              >
                {licenseUnits.owned.length}
              </button>
            )}
          </>
        ) : (
          <>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Команда:</span>
              <span className={styles.infoValue}>{player.name}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Бюджет:</span>
              <span className={styles.infoValue}>{player.budget.toLocaleString('ru-RU')} млн ₽</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>ЛУ куплено:</span>
              <span className={styles.infoValue}>{licenseUnits.owned.length} / 5</span>
            </div>
            {currentLU && (
              <div className={`${styles.infoRow} ${styles.currentLu}`}>
                <span className={styles.infoLabel}>Текущий ЛУ:</span>
                <span className={styles.infoValue}>{currentLU.name}</span>
              </div>
            )}

            {licenseUnits.owned.length > 0 && (
              <div className={styles.luSelectorCompact}>
                <label>Работа с ЛУ:</label>
                <select
                  value={currentLU?.id || ''}
                  onChange={(e) => {
                    const lu = licenseUnits.owned.find(l => l.id === e.target.value);
                    if (lu) {
                      set({ licenseUnits: { ...licenseUnits, current: lu } });
                    }
                  }}
                >
                  {licenseUnits.owned.map(lu => {
                    const progress = game.currentLUProgress?.[lu.id] || {};
                    const completedStages = [
                      progress.researchCompleted,
                      progress.eventsCompleted,
                      progress.fieldWorkCompleted,
                      progress.resultsCompleted
                    ].filter(Boolean).length;

                    return (
                      <option key={lu.id} value={lu.id}>
                        {lu.name} {completedStages > 0 ? `(${completedStages}/4)` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </>
        )}
      </div>

      {licenseUnits.owned.length > 0 && isWideScreen && (
        <div className={styles.infoCardsSidebar}>
          <h3>Выбранные участки</h3>
          <div className={styles.compactCardsList}>
            {licenseUnits.owned.map((lu) => (
              <div
                key={lu.id}
                className={styles.compactInfoCard}
                onClick={() => {
                  setViewMode('sidebar');
                  setSelectedInfoCard(lu);
                }}
              >
                <div className={styles.compactCardHeader}>
                  <span className={styles.compactCardTitle}>{lu.name}</span>
                  <span className={styles.compactCardCost}>{lu.cost} млн ₽</span>
                </div>
                <div className={styles.compactCardHint}>Подробнее →</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.gameBoardGridNew}>
        {fields.map((field) => {
          const status = getFieldStatus(field.id);

          return (
            <div
              key={field.id}
              className={`${styles.gameFieldNew} ${styles[`field${field.id}`]} ${styles[status]}`}
              onClick={() => handleFieldClick(field.id)}
            >
              <div className={styles.fieldOverlay}></div>
              <div className={styles.fieldContentNew}>
                <div className={styles.fieldTitleNew}>{field.title}</div>
              </div>

              {status === 'completed' && (
                <div className={styles.fieldCompletedBadge}>✓</div>
              )}

              {status === 'locked' && (
                <div className={styles.fieldLockedBadge}>🔒</div>
              )}
            </div>
          );
        })}
      </div>

      {licenseUnits.owned.length === 0 && (
        <div className={styles.gameHintNew}>
          💡 Нажмите на "Карта региона" для выбора лицензионных участков
        </div>
      )}

      {selectedInfoCard && viewMode === 'sidebar' && (
        <div className={styles.infoModalOverlay} onClick={() => {
          setSelectedInfoCard(null);
          setViewMode(null);
        }}>
          <div className={styles.infoModalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => {
              setSelectedInfoCard(null);
              setViewMode(null);
            }}>✕</button>
            <h2>{selectedInfoCard.name}</h2>
            {selectedInfoCard.hasImage && (
              <div className={styles.cardImageWrap}>
                <img src={selectedInfoCard.imagePath} alt={selectedInfoCard.name} />
              </div>
            )}
            <div className={styles.cardDescription}>{selectedInfoCard.description}</div>
            <div className={styles.cardMeta}>
              <span>Стоимость: <strong>{selectedInfoCard.cost} млн ₽</strong></span>
            </div>
          </div>
        </div>
      )}

      {showInfoCards && viewMode === 'button' && (
        <div className={styles.infoModalOverlay} onClick={() => {
          setShowInfoCards(false);
          setSelectedInfoCard(null);
          setViewMode(null);
        }}>
          <div className={`${styles.infoModalContent} ${styles.modalList}`} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => {
              setShowInfoCards(false);
              setSelectedInfoCard(null);
              setViewMode(null);
            }}>✕</button>
            <h2>Информация о выбранных участках</h2>
            <div className={styles.cardsGrid}>
              {licenseUnits.owned.map((lu) => (
                <div key={lu.id} className={styles.infoCard}>
                  <div className={styles.infoCardHeader}>
                    <div className={styles.infoCardIcon}>{lu.shortName}</div>
                    <div className={styles.infoCardTitleBlock}>
                      <h3>{lu.name}</h3>
                      <span className={styles.infoCardCost}>{lu.cost} млн ₽</span>
                    </div>
                  </div>
                  {lu.hasImage && (
                    <div className={styles.infoCardImage}>
                      <img src={lu.imagePath} alt={lu.name} />
                    </div>
                  )}
                  <div className={styles.infoCardDescription}>{lu.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameBoard;