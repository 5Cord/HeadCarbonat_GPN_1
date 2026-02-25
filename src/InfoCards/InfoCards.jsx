import React, { useState } from 'react';
import './InfoCards.css';
import resourceMapImage from './resource-map.svg'; // Импортируем изображение

const INFO_CARDS_DATA = {
  quarry: {
    id: 'quarry',
    title: 'Карьер',
    type: 'outcrop',
    content: 'Известняки и доломиты массивные, химически чистые, органогенные, кавернозно-трещиноватые. По кавернам густые выпоты окисленной нефти. Разрабатываемый содовый карьер',
  },

  outcrop: {
    id: 'outcrop',
    title: 'Обнажение',
    type: 'outcrop',
    content: 'В целевом комплексе породы представлены известняками и доломитами ритмично-слоистыми, светло-серыми, с микробиальными биогермами до 10 м толщиной. В породах встречаются поры, каверны и трещины с запахом УВ.',
  },

  seismic: {
    id: 'seismic',
    title: 'ОиИ архивных СРР 2Д',
    type: 'seismic',
    content: 'По данным СРР 2Д в НГР выделяются ориентированные с ЮЗ на СВ объекты, похожие на структурные валы. В центральной части территории, между валообразными зонами, фиксируется палеопрогиб.',
  },

  well1: {
    id: 'well1',
    title: 'Параметрическая скважина №1',
    type: 'well',
    content: 'В целевом комплексе керн представлен светлыми слоистыми строматолитовыми доломитами с прослоями гипсов и ангидритов. Прослоями доломиты слабо пористые, с редкими выпотами густой нефти.',
  },

  well2: {
    id: 'well2',
    title: 'Параметрическая скважина №2',
    type: 'well',
    content: 'В целевом комплексе керн представлен светлыми тонкослоистыми известняками и доломитами, прослоями зернистыми, с межзерновой пористостью. По порам признаки нефтенасыщения.',
  },

  well3: {
    id: 'well3',
    title: 'Параметрическая скважина №3',
    type: 'well',
    content: 'В целевом комплексе керн представлен тонкослоистыми черными кремнистыми известняками с повышенным содержанием Сорг. Мощность комплекса сильно сокращена. В отдельных прослоях породы при раскалывании молотком пахнут УВ',
  },

  well4: {
    id: 'well4',
    title: 'Параметрическая скважина №4',
    type: 'well',
    content: 'В целевом комплексе керн представлен массивными трещиновато-кавернозными известняками с кораллами и губками, по кавернам обильные выпоты нефти',
  },

  well5: {
    id: 'well5',
    title: 'Параметрическая скважина №5',
    type: 'well',
    content: 'В целевом комплексе керн представлен светлыми слоистыми известняками и доломитами, зернистыми и микритовыми, с пачками трещиноватых органогенных известняков. Прослоями породы пористые, с признаками УВ.',
  },

  well6: {
    id: 'well6',
    title: 'Параметрическая скважина №6',
    type: 'well',
    content: 'В целевом комплексе керн представлен тонкослоистыми черными кремнистыми известняками с повышенным содержанием Сорг, с остатками планктонной фауны. Мощность комплекса сильно сокращена.',
  },

  research: {
    id: 'research',
    title: 'Региональная НИР (КГМ, СГМ, БМ, оценка ресурсов)',
    type: 'research',
    content: 'По итогам НИР выделены перспективные зоны.',
    hasImage: true,
    imageAlt: 'Карта плотности ресурсов УВ по целевому комплексу',
    imageCaption: 'Карта плотности ресурсов УВ по целевому комплексу (тыс. т. УВ/кв. км)',
    legendItems: [
    ]
  }
};

const InfoCards = ({ selectedLU }) => {
  const [selectedCard, setSelectedCard] = useState(null);

  const getInfoCards = () => {
    return selectedLU.map(lu => INFO_CARDS_DATA[lu.id]).filter(Boolean);
  };

  const cards = getInfoCards();

  const handleCardClick = (card) => {
    setSelectedCard(card);
  };

  const closeModal = () => {
    setSelectedCard(null);
  };

  if (cards.length === 0) {
    return (
      <div className="info-cards-empty">
        <p>📋 Карточки информации появятся после покупки ЛУ</p>
      </div>
    );
  }

  return (
    <div className="info-cards-container">
      <h2>📋 Карточки "Информация"</h2>
      <p className="info-subtitle">
        Изучите данные по купленным лицензионным участкам
      </p>

      <div className="info-cards-grid">
        {cards.map(card => (
          <div
            key={card.id}
            className={`info-card ${card.type}`}
            onClick={() => handleCardClick(card)}
          >
            <div className="card-icon">{card.type === 'well' ? '🕳️' : 
                                       card.type === 'outcrop' ? '⛰️' : 
                                       card.type === 'seismic' ? '📡' : 
                                       card.type === 'research' ? '📊' : '📋'}</div>
            <h3>{card.title}</h3>
            <button className="view-details-btn">Просмотр →</button>
          </div>
        ))}
      </div>

      {/* Модальное окно с детальной информацией */}
      {selectedCard && (
        <div className="info-modal-overlay" onClick={closeModal}>
          <div className="info-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal-btn" onClick={closeModal}>✕</button>
            
            <div className="modal-header">
              <div>
                <h2>{selectedCard.title}</h2>
              </div>
            </div>

            <div className="modal-content">
              <div className="content-section">
                <div className="content-block">
                  <p>{selectedCard.content}</p>
                </div>
              </div>

              {selectedCard.hasImage && (
                <div className="image-section">
                  <div className="image-container">
                    <h3 className="image-caption">{selectedCard.imageCaption}</h3>
                    <div className="image-wrapper">
                      <img 
                        src={resourceMapImage} 
                        alt={selectedCard.imageAlt} 
                        className="resource-map-image"
                      />
                    </div>
                    <div className="image-legend">
                      {selectedCard.legendItems.map((item, index) => (
                        <div key={index} className="legend-item">
                          <span 
                            className="legend-color" 
                            style={{ backgroundColor: item.color }}
                          ></span>
                          <span className="legend-range">{item.range}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InfoCards;