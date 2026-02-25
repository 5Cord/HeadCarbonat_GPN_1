import React from 'react';
import './ResearchPanel.css';

export const EventsZone = ({ onComplete }) => {
    return (
        <div className="events-zone">
            <div className="placeholder-content">
                <h2>Зона событий</h2>
                <p>Компонент в разработке</p>
                <p>Здесь будет:</p>
                <ul>
                    <li>Генерация линий событий (6 карточек)</li>
                    <li>Карточки возможности с вопросами</li>
                    <li>Карточки риска</li>
                    <li>Карточки случайности</li>
                    <li>Подсчет итогового балла</li>
                </ul>

                <button className="next-btn" onClick={onComplete}>
                    Пропустить → К полевым работам
                </button>
            </div>
        </div>
    );
};

export const FieldWorkPanel = ({ onComplete }) => {
    return (
        <div className="field-work-panel">
            <div className="placeholder-content">
                <h2>Полевые работы</h2>
                <p>Компонент в разработке</p>
                <p>Здесь будет:</p>
                <ul>
                    <li>Выбор технологий (СРР 2D, 3D)</li>
                    <li>Горизонтальные скважины</li>
                    <li>Многозабойные скважины</li>
                    <li>Расчет качества и стоимости</li>
                </ul>

                <button className="next-btn" onClick={onComplete}>
                    Пропустить → К результатам
                </button>
            </div>
        </div>
    );
};

export const ResultsPanel = ({ onComplete }) => {
    return (
        <div className="results-panel">
            <div className="placeholder-content">
                <h2>Результаты работы</h2>
                <p>Компонент в разработке</p>
                <p>Здесь будет:</p>
                <ul>
                    <li>Карточка результата по ЛУ</li>
                    <li>Геологические параметры</li>
                    <li>Расчет ROI</li>
                    <li>Сравнение с оптимальной стратегией</li>
                </ul>

                <button className="next-btn" onClick={onComplete}>
                    Следующий ЛУ →
                </button>
            </div>
        </div>
    );
};

export default EventsZone;