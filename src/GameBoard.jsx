import React, { useState, useEffect } from 'react';
import RegionMap from './RegionMap/RegionMap';
import ResearchPanel from './Research/ResearchPanel';
import EventsZone from './Events/EventsZone';
import FieldWorkPanel from './FieldWork/FieldWorkPanel';
import ResultsPanel from './Results/ResultsPanel';
import GlobalTimer from './GlobalTimer';
import useGameStore from '../store/gameStore';
import styles from './GameBoard.module.css';

// Маппинг экрана (строка в Zustand) ↔ expandedField (число в компоненте)
const SCREEN_TO_FIELD = { region_map: 0, research: 1, events: 2, field_work: 3, results: 4 };
const FIELD_TO_SCREEN = { 0: 'region_map', 1: 'research', 2: 'events', 3: 'field_work', 4: 'results' };

// ─────────────────────────────────────────────────────────────────────────────

const GameBoard = () => {
    const setCurrentScreen = useGameStore(s => s.setCurrentScreen);
    const savedScreen      = useGameStore(s => s.game.currentScreen);

    // Восстанавливаем expandedField из Zustand (localStorage) при монтировании
    const [expandedField, setExpandedFieldRaw] = useState(() =>
        savedScreen != null ? (SCREEN_TO_FIELD[savedScreen] ?? null) : null
    );
    const [showInfoCards, setShowInfoCards] = useState(false);
    const [selectedInfoCard, setSelectedInfoCard] = useState(null);
    const [isWideScreen, setIsWideScreen] = useState(window.innerWidth > 1580);
    const [viewMode, setViewMode] = useState(null);

    // Обёртка: при каждом изменении сохраняем в Zustand → localStorage
    const setExpandedField = (val) => {
        setCurrentScreen(val != null ? (FIELD_TO_SCREEN[val] ?? null) : null);
        setExpandedFieldRaw(val);
    };

    const {
        game, player, licenseUnits, gridCells,
        purchaseLU, getCurrentLU, globalTimer,
        navigateToResearch, setNavigateToResearch,
        navigateToRefusal, setNavigateToRefusal,
        setTriggerRefusal,
        showRegionMapBanner, setShowRegionMapBanner,
    } = useGameStore();

    const MAX_LUS_PER_TEAM = player.sessionConfig?.maxLUsPerTeam ?? 5;

    const currentLU = getCurrentLU();
    const set = useGameStore.setState;
    const ownedGridCells = Object.values(gridCells.owned);
    const ownedGridCellsCount = ownedGridCells.length;
    const infoCards = licenseUnits.owned;
    const currentYear = globalTimer?.currentYear ?? game.currentYear ?? 1;

    useEffect(() => {
        const handleResize = () => setIsWideScreen(window.innerWidth > 1580);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!navigateToResearch) return;
        setNavigateToResearch(false);
        if (currentLU) {
            set(st => ({
                game: {
                    ...st.game,
                    currentLUProgress: {
                        ...st.game.currentLUProgress,
                        [currentLU.id]: {
                            researchCompleted: false,
                            eventsCompleted: false,
                            fieldWorkCompleted: false,
                            resultsCompleted: false,
                        },
                    },
                },
            }));
        }
        setExpandedField(1);
    }, [navigateToResearch]);

    useEffect(() => {
        if (!navigateToRefusal) return;
        setNavigateToRefusal(false);
        setTriggerRefusal(true);
        setExpandedField(1);
    }, [navigateToRefusal]);

    useEffect(() => {
        if (!showRegionMapBanner) return;
        setExpandedField(0);
    }, [showRegionMapBanner]);


    useEffect(() => {
        if (!currentLU && infoCards.length > 0) {
            const firstLU = infoCards[0];
            set(st => ({
                licenseUnits: { ...st.licenseUnits, current: firstLU },
                game: { ...st.game, currentPhase: 'REGION_MAP' },
            }));
        }
    }, [infoCards.length, currentLU?.id]);

    useEffect(() => {
        if (!currentLU) return;
        const luResearch = game.currentLUProgress?.[currentLU.id] || {};
        if (
            luResearch.researchCompleted &&
            luResearch.eventsCompleted &&
            luResearch.fieldWorkCompleted &&
            luResearch.resultsCompleted
        ) {
            const currentIndex = infoCards.findIndex(lu => lu.id === currentLU.id);
            if (currentIndex >= 0 && currentIndex < infoCards.length - 1) {
                const nextLU = infoCards[currentIndex + 1];
                set(st => ({
                    licenseUnits: { ...st.licenseUnits, current: nextLU },
                    game: {
                        ...st.game,
                        currentPhase: 'REGION_MAP',
                        currentLUProgress: {
                            ...st.game.currentLUProgress,
                            [nextLU.id]: {},
                        },
                    },
                }));
            }
        }
    }, [game.currentLUProgress, currentLU?.id]);

    const getActiveField = () => {
        if (infoCards.length === 0 && ownedGridCellsCount === 0) return 0;
        if (!currentLU) return 0;
        const luResearch = game.currentLUProgress?.[currentLU.id] || {};
        if (!luResearch.researchCompleted) return 1;
        if (!luResearch.eventsCompleted) return 2;
        if (!luResearch.fieldWorkCompleted) return 3;
        if (!luResearch.resultsCompleted) return 4;
        return 1;
    };

    const activeField = getActiveField();

    const isFieldAvailable = (fieldIndex) => {
        if (fieldIndex === 0) return true;
        if (infoCards.length === 0) return false;
        return fieldIndex <= activeField;
    };

    const handleFieldClick = (fieldIndex) => {
        if (!isFieldAvailable(fieldIndex)) {
            alert('Сначала выполните предыдущие этапы для текущего ЛУ!');
            return;
        }
        setExpandedField(fieldIndex);
    };

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

    const goToField = (nextFieldIndex) => setExpandedField(nextFieldIndex);
    const goToMenu = () => setExpandedField(null);

    const handleResultsComplete = () => {
        const newYear = useGameStore.getState().globalTimer.currentYear;
        const isGameOver = newYear > 10;

        if (isGameOver) {
            // Игра завершена — просто выходим в меню
            goToMenu();
            return;
        }

        if (currentLU) {
            set(st => ({
                game: {
                    ...st.game,
                    currentLUProgress: {
                        ...st.game.currentLUProgress,
                        [currentLU.id]: {
                            researchCompleted: false,
                            eventsCompleted: false,
                            fieldWorkCompleted: false,
                            resultsCompleted: false,
                        },
                    },
                },
            }));
        }
        goToField(1);
    };

    const fields = [
        { id: 0, title: 'Карта региона', number: '0' },
        { id: 1, title: 'Научные исследования', number: '1' },
        { id: 2, title: 'Зона событий', number: '2' },
        { id: 3, title: 'Полевые работы', number: '3' },
        { id: 4, title: 'Результаты работ', number: '4' },
    ];

    // ── Expanded-режим ───────────────────────────────────────────────────────
    if (expandedField !== null) {
        const progress = getCurrentLUProgress();
        return (
            <div className={styles.gameBoardExpanded}>
                {expandedField === 0 ? (
                    <RegionMap
                        selectedLU={infoCards}
                        onLUClick={(lu) => {
                            const isOwned = infoCards.find(item => item.id === lu.id);
                            if (!isOwned && infoCards.length < MAX_LUS_PER_TEAM) purchaseLU(lu);
                        }}
                        budget={player.budget}
                        showResourceDensity={infoCards.some(lu => lu.id === 'research')}
                        onComplete={goToMenu}
                        onBack={goToMenu}
                        onMenu={goToMenu}
                        onNext={() => { setShowRegionMapBanner(false); goToField(1); }}
                    />
                ) : expandedField === 1 ? (
                    <ResearchPanel
                        onBack={() => goToField(0)}
                        onMenu={goToMenu}
                        onComplete={() => {
                            set(st => ({
                                game: {
                                    ...st.game,
                                    currentLUProgress: {
                                        ...st.game.currentLUProgress,
                                        [currentLU?.id]: { ...st.game.currentLUProgress?.[currentLU?.id], researchCompleted: true },
                                    },
                                },
                            }));
                            goToField(2);
                        }}
                        currentLU={currentLU}
                        luProgress={progress}
                    />
                ) : expandedField === 2 ? (
                    <EventsZone
                        onBack={() => goToField(1)}
                        onMenu={goToMenu}
                        onComplete={() => {
                            set(st => ({
                                game: {
                                    ...st.game,
                                    currentLUProgress: {
                                        ...st.game.currentLUProgress,
                                        [currentLU?.id]: { ...st.game.currentLUProgress?.[currentLU?.id], researchCompleted: true, eventsCompleted: true },
                                    },
                                },
                            }));
                            goToField(3);
                        }}
                        currentLU={currentLU}
                        luProgress={progress}
                    />
                ) : expandedField === 3 ? (
                    <FieldWorkPanel
                        onBack={() => goToField(2)}
                        onMenu={goToMenu}
                        onComplete={() => {
                            set(st => ({
                                game: {
                                    ...st.game,
                                    currentLUProgress: {
                                        ...st.game.currentLUProgress,
                                        [currentLU?.id]: { ...st.game.currentLUProgress?.[currentLU?.id], researchCompleted: true, eventsCompleted: true, fieldWorkCompleted: true },
                                    },
                                },
                            }));
                            goToField(4);
                        }}
                        currentLU={currentLU}
                        luProgress={progress}
                    />
                ) : expandedField === 4 ? (
                    <ResultsPanel
                        onBack={() => goToField(3)}
                        onMenu={goToMenu}
                        onComplete={handleResultsComplete}
                        currentLU={currentLU}
                        luProgress={progress}
                    />
                ) : null}
            </div>
        );
    }

    // ── Главный экран (плитки) ───────────────────────────────────────────────
    return (
        <div className={styles.gameBoardFullscreen}>

            <GlobalTimer />

            <div className={styles.gameLogo}>
                <div className={styles.logoIcon}>⚙️</div>
                <div className={styles.logoText}>
                    <div className={styles.logoTitle}>КУРС</div>
                    <div className={styles.logoSubtitle}>НА КАРБОНАТЫ</div>
                </div>
            </div>

            {/* ── Единый левый сайдбар ── */}
            <div className={styles.sidebar}>
                <div className={styles.sidebarStats}>
                    <div className={styles.statTeam}>{player.name}</div>

                    <div className={styles.statRow}>
                        <span className={styles.statLabel}>Год</span>
                        <span className={styles.statValue}>{currentYear} / 10</span>
                    </div>
                    <div className={styles.yearProgress}>
                        <div className={styles.yearProgressFill} style={{ width: `${(currentYear / 10) * 100}%` }} />
                    </div>

                    <div className={styles.statRow}>
                        <span className={styles.statLabel}>Бюджет</span>
                        <span className={styles.statValue}>{player.budget.toLocaleString('ru-RU')} млн ₽</span>
                    </div>

                    <div className={styles.statRow}>
                        <span className={styles.statLabel}>ЛУ куплено</span>
                        <span className={styles.statValue}>{ownedGridCellsCount} / {MAX_LUS_PER_TEAM}</span>
                    </div>

                    {ownedGridCellsCount > 0 && (
                        <div className={styles.ownedCellsCompact}>
                            {ownedGridCells.map(cell => (
                                <span key={cell.cellRef} className={styles.ownedCellBadge}>
                                    {cell.cellRef}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {infoCards.length > 0 && (
                    <div className={styles.sidebarCards}>
                        <div className={styles.sidebarCardsHeader}>
                            <span>Карточки информации</span>
                            <span className={styles.sidebarCardsBadge}>{infoCards.length}</span>
                        </div>
                        <div className={styles.sidebarCardsList}>
                            {infoCards.map((lu) => (
                                <div
                                    key={lu.id}
                                    className={styles.compactInfoCard}
                                    onClick={() => { setViewMode('sidebar'); setSelectedInfoCard(lu); }}
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
            </div>

            {/* Кнопка на маленьких экранах */}
            {infoCards.length > 0 && (
                <button className={styles.cardsFloatBtn} onClick={() => { setViewMode('button'); setShowInfoCards(true); }}>
                    Карточки · {infoCards.length}
                </button>
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
                            <div className={styles.fieldOverlay} />
                            <div className={styles.fieldContentNew}>
                                <div className={styles.fieldTitleNew}>{field.title}</div>
                            </div>
                            {status === 'completed' && <div className={styles.fieldCompletedBadge}>✓</div>}
                            {status === 'locked' && <div className={styles.fieldLockedBadge}>🔒</div>}
                        </div>
                    );
                })}
            </div>

            {infoCards.length === 0 && ownedGridCellsCount === 0 && (
                <div className={styles.gameHintNew}>
                    💡 Нажмите на "Карта региона" для выбора лицензионных участков и карточек информации
                </div>
            )}

            {selectedInfoCard && viewMode === 'sidebar' && (
                <div
                    className={styles.infoModalOverlay}
                    onClick={() => { setSelectedInfoCard(null); setViewMode(null); }}
                >
                    <div className={styles.infoModalContent} onClick={e => e.stopPropagation()}>
                        <button className={styles.closeModal} onClick={() => { setSelectedInfoCard(null); setViewMode(null); }}>✕</button>
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
                <div
                    className={styles.infoModalOverlay}
                    onClick={() => { setShowInfoCards(false); setSelectedInfoCard(null); setViewMode(null); }}
                >
                    <div
                        className={`${styles.infoModalContent} ${styles.modalList}`}
                        onClick={e => e.stopPropagation()}
                    >
                        <button className={styles.closeModal} onClick={() => { setShowInfoCards(false); setSelectedInfoCard(null); setViewMode(null); }}>✕</button>
                        <h2>Карточки информации</h2>
                        <div className={styles.cardsGrid}>
                            {infoCards.map((lu) => (
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