// RegionMapTour.jsx
// Обучающий тур для RegionMap — показывается только при первом заходе в сессию.
// Управляется через localStorage: ключ 'regionMap_tourDone'.
//
// Использование в RegionMap.jsx:
//   import RegionMapTour from './RegionMapTour';
//   ...
//   <RegionMapTour onDone={() => {}} />

import React, { useState, useEffect, useRef } from 'react';
import './Regionmaptour.css';

// ─────────────────────────────────────────────────────────────────────────────
// ШАГИ ТУРА
// Каждый шаг: { id, title, text, target, placement, icon }
//   target    — CSS-селектор элемента, который подсвечиваем (или null для центра)
//   placement — 'top' | 'bottom' | 'left' | 'right' | 'center'
// ─────────────────────────────────────────────────────────────────────────────

const getTourSteps = (maxLUs) => [
  {
    id: 'welcome',
    icon: '',
    title: 'Добро пожаловать на карту региона!',
    text: 'Здесь вы будете выбирать лицензионные участки для поиска, разведки и разработки месторождений нефти.',
    target: null,
    placement: 'center',
  },
  {
    id: 'timer',
    icon: '⏱',
    title: 'Таймер фазы',
    text: 'Таймер в правом верхнем углу показывает сколько времени осталось. Следите за временем!',
    target: '.region-timer',
    placement: 'left',
  },
  {
    id: 'info_panel',
    icon: '',
    title: 'Информационная панель',
    text: 'Здесь отображаются ваши расходы, бюджет, купленные карточки и прочая информация.',
    target: '.game-info-panel',
    placement: 'right',
  },
  {
    id: 'info_cards',
    icon: '',
    title: 'Шаг 1 — Купите карточку информации',
    text: 'Прежде чем выбирать участок на карте, нужно купить хотя бы одну карточку информации. Нажмите на любой маркер с буквой или цифрой (например «1», «Н», «К») на карте. Карточки содержат геологические данные о регионе.',
    target: '.lu-marker',
    placement: 'right',
  },
  {
    id: 'grid',
    icon: '',
    title: 'Шаг 2 — Выберите участок на сетке',
    text: 'Выберете участок на карте. Кликните на любую свободную клетку сетки (серые ячейки A1–J10). Синие ячейки — ваши, красные — чужих команд. Ячейки с паттерном-полосками недоступны.',
    target: '.grid-with-lu',
    placement: 'left',
  },
  {
    id: 'blocked',
    icon: '',
    title: 'Заблокированные зоны',
    text: 'Жёлтые ячейки — населённые пункты, фиолетовые — участки материнской компании. Эти участки нельзя выбрать.',
    target: '.grid-cell-blocked',
    placement: 'right',
  },
  {
    id: 'auction',
    icon: '',
    title: 'Аукцион (если участок занят)',
    text: 'Если вы кликнете на участок, занятый другой командой — вы зарегистрируетесь на аукцион. Когда начнётся фаза аукциона, делайте ставки в панели справа. Победит тот, кто предложит больше.',
    target: '.auction-dashboard',
    placement: 'left',
  },
  {
    id: 'ready_btn',
    icon: '✅',
    title: 'Готовность команды',
    text: `Когда вы купили все ${maxLUs} участков — нажмите «Готовность команды». Это сигнал, что вы завершили выбор. Рядом с кнопкой видно, сколько команд уже готовы. Когда готовы все — фаза покупки сразу завершается.`,
    target: '.ready-control-btn',
    placement: 'bottom',
  },
  {
    id: 'post_auction',
    icon: '',
    title: 'Докупка участков',
    text: `После аукциона у вас будет дополнительное время, чтобы приобрести свободные участки напрямую. Если несколько команд выберут один участок, он достанется той, чья покупка прошла первой. Повторного аукциона не будет. Воспользуйтесь допокупкой, если у вас меньше ${maxLUs} участков или если вы проиграли аукцион.`,
    target: null,
    placement: 'center',
  },
  {
    id: 'next_btn',
    icon: '',
    title: 'Переход к исследованиям',
    text: 'Как только все участки выбраны — кнопка «Далее — Научные исследования» станет активной. Нажмите её, чтобы перейти к следующему этапу.',
    target: '.next-control-btn',
    placement: 'bottom',
  },
  {
    id: 'done',
    icon: '',
    title: 'Готово! Вы знаете всё необходимое',
    text: 'Удачи в выборе участков! Если понадобится помощь — обратитесь к ведущему.',
    target: null,
    placement: 'center',
  },
];

const TOUR_KEY = 'regionMap_tourDone';

// ─────────────────────────────────────────────────────────────────────────────
// Утилита: найти позицию элемента на странице
// ─────────────────────────────────────────────────────────────────────────────
function getElementRect(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
}

// ─────────────────────────────────────────────────────────────────────────────
// Вычислить позицию tooltip относительно highlight-прямоугольника
// ─────────────────────────────────────────────────────────────────────────────
function computeTooltipStyle(rect, placement) {
  if (!rect || placement === 'center') {
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: 420,
    };
  }

  const GAP = 18;
  const TW = 360; // tooltip width approx
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let style = { position: 'fixed', maxWidth: TW };

  switch (placement) {
    case 'right':
      style.left = Math.min(rect.right + GAP, vw - TW - 12);
      style.top = Math.max(12, Math.min(rect.top + rect.height / 2 - 80, vh - 280));
      break;
    case 'left':
      style.left = Math.max(12, rect.left - TW - GAP);
      style.top = Math.max(12, Math.min(rect.top + rect.height / 2 - 80, vh - 280));
      break;
    case 'bottom':
      style.top = Math.min(rect.bottom + GAP, vh - 280);
      style.left = Math.max(12, Math.min(rect.left + rect.width / 2 - TW / 2, vw - TW - 12));
      break;
    case 'top':
      style.top = Math.max(12, rect.top - 200 - GAP);
      style.left = Math.max(12, Math.min(rect.left + rect.width / 2 - TW / 2, vw - TW - 12));
      break;
    default:
      style.top = '50%';
      style.left = '50%';
      style.transform = 'translate(-50%, -50%)';
  }

  return style;
}

// ─────────────────────────────────────────────────────────────────────────────
// Highlight-маска: вырезаем «дыру» над целевым элементом
// ─────────────────────────────────────────────────────────────────────────────
function HighlightMask({ rect }) {
  if (!rect) {
    // Просто тёмная накладка без дыры
    return <div className="tour-mask-full" />;
  }

  const PAD = 8;
  const r = {
    top: Math.max(0, rect.top - PAD),
    left: Math.max(0, rect.left - PAD),
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  return (
    <svg className="tour-mask-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <mask id="tour-cutout">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect
            x={r.left} y={r.top}
            width={r.width} height={r.height}
            rx="8" fill="black"
          />
        </mask>
      </defs>
      <rect
        x="0" y="0" width="100%" height="100%"
        fill="rgba(0,0,0,0.72)"
        mask="url(#tour-cutout)"
      />
      {/* Рамка вокруг выделенного элемента */}
      <rect
        x={r.left - 2} y={r.top - 2}
        width={r.width + 4} height={r.height + 4}
        rx="10"
        fill="none"
        stroke="#2fa394"
        strokeWidth="3"
        strokeDasharray="8 4"
        className="tour-highlight-border"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Индикатор прогресса
// ─────────────────────────────────────────────────────────────────────────────
function StepDots({ total, current }) {
  return (
    <div className="tour-dots">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`tour-dot ${i === current ? 'tour-dot-active' : i < current ? 'tour-dot-done' : ''}`}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Стрелка-указатель (decorative)
// ─────────────────────────────────────────────────────────────────────────────
function Arrow({ placement }) {
  if (!placement || placement === 'center') return null;
  return <div className={`tour-arrow tour-arrow-${placement}`} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// ГЛАВНЫЙ КОМПОНЕНТ
// ─────────────────────────────────────────────────────────────────────────────

export default function RegionMapTour({ onDone, maxLUs = 5 }) {
  const TOUR_STEPS = getTourSteps(maxLUs);

  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [rect, setRect] = useState(null);
  const [animating, setAnimating] = useState(false);
  const rafRef = useRef(null);

  // Проверяем флаг при монтировании
  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      // Небольшая задержка чтобы страница успела отрендериться
      setTimeout(() => setVisible(true), 600);
    }
  }, []);

  // При смене шага — обновляем rect цели
  useEffect(() => {
    if (!visible) return;
    const current = TOUR_STEPS[step];

    const updateRect = () => {
      const r = getElementRect(current.target);
      setRect(r);
    };

    updateRect();
    // Подписываемся на resize
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [step, visible]);

  useEffect(() => {
    if (!visible) return;
    const handleKey = (e) => {
      if (e.key === 'Enter') setStep(s => Math.min(TOUR_STEPS.length - 1, s + 1));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [visible, TOUR_STEPS.length]);

  if (!visible) return null;

  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;
  const isFirst = step === 0;

  const go = (delta) => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      setStep(s => Math.max(0, Math.min(TOUR_STEPS.length - 1, s + delta)));
      setAnimating(false);
    }, 180);
  };

  const finish = () => {
    localStorage.setItem(TOUR_KEY, '1');
    setVisible(false);
    onDone?.();
  };

  const skip = () => {
    localStorage.setItem(TOUR_KEY, '1');
    setVisible(false);
    onDone?.();
  };

  const tooltipStyle = computeTooltipStyle(rect, current.placement);

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-label="Обучающий тур">
      {/* ── Маска с вырезом ── */}
      <HighlightMask rect={rect} />

      {/* ── Тултип ── */}
      <div
        className={`tour-tooltip ${animating ? 'tour-tooltip-fade' : ''}`}
        style={tooltipStyle}
      >
        <Arrow placement={current.placement} />

        {/* Заголовок */}
        
        <div className="tour-tooltip-header">
          <span className="tour-step-icon">{current.icon}</span>
          <span className="tour-step-label">Шаг {step + 1} из {TOUR_STEPS.length}</span>
        </div>

        <h3 className="tour-tooltip-title">{current.title}</h3>
        <p className="tour-tooltip-text">{current.text}</p>

        {/* Прогресс-точки */}
        <StepDots total={TOUR_STEPS.length} current={step} />

        {/* Кнопки */}
        <div className="tour-tooltip-actions">
          {!isFirst && (
            <button className="tour-btn tour-btn-back" onClick={() => go(-1)}>
              ← Назад
            </button>
          )}
          <div style={{ flex: 1 }} />
          {/* <button className="tour-btn tour-btn-skip" onClick={skip}>
            Пропустить
          </button> */}
          {isLast ? (
            <button className="tour-btn tour-btn-finish" onClick={finish}>
              Начать игру
            </button>
          ) : (
            <button className="tour-btn tour-btn-next" onClick={() => go(1)}>
              Далее →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
