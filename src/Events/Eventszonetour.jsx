// EventsZoneTour.jsx
// Пошаговый обучающий тур для экрана EventsZone (Зона событий).
// Показывается только один раз — при первом заходе (globalYear === 1).
// Флаг хранится в localStorage: 'eventsZone_tourDone'.
//
// Подключение в EventsZone.jsx:
//   import EventsZoneTour from './EventsZoneTour';
//   ...
//   <EventsZoneTour globalYear={globalYear} onDone={() => {}} />

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Eventszonetour.css';

const TOUR_KEY = 'eventsZone_tourDone';

// ─────────────────────────────────────────────────────────────────────────────
// ШАГИ ТУРА
// target    — CSS-селектор подсвечиваемого элемента (null = центр экрана)
// placement — 'top' | 'bottom' | 'left' | 'right' | 'center'
// ─────────────────────────────────────────────────────────────────────────────

const EVENTS_TOUR_STEPS = [
  {
    id: 'welcome',
    icon: '',
    title: 'Добро пожаловать в Зону событий!',
    text: 'Здесь вы будете разыгрывать карточки событий для ваших участков. Каждая карточка влияет на счёт или бюджет. Внимательно читайте условия!',
    target: null,
    placement: 'center',
  },
  {
    id: 'timer',
    icon: '⏱️',
    title: 'Глобальный таймер',
    text: 'Таймер в правом верхнем углу отсчитывает время на события. Когда он истечёт — этап завершится автоматически. Успейте разыграть все обязательные карточки!',
    target: '[class*="timer"]',
    placement: 'left',
  },
  {
    id: 'nav_buttons',
    icon: '',
    title: 'Кнопки навигации',
    text: '«← Назад» — вернуться на экран исследований. «В меню» — выйти в главное меню. «Далее — К полевым работам» — перейти к следующему этапу (доступна после завершения всех линий).',
    target: '[class*="researchMapControls"]',
    placement: 'bottom',
  },
  {
    id: 'lu_cards',
    icon: '',
    title: 'Выбор участка',
    text: 'Нажмите на карточку участка, чтобы просмотреть его линию событий. Синяя рамка = активный участок. Значок «Успех %» — шанс из НИР. Счёт обновляется в реальном времени.',
    target: '[class*="luCardsRow"]',
    placement: 'bottom',
  },
  {
    id: 'event_line',
    icon: '',
    title: 'Линия событий участка',
    text: 'Каждый участок имеет линию карточек. Карточки трёх типов: Риск, Возможность, Случайность. Кликайте по нераскрытым карточкам, чтобы взаимодействовать с ними.',
    target: '[class*="eventLine"]',
    placement: 'top',
  },
  {
    id: 'risk_cards',
    icon: '',
    title: 'Карточки риска',
    text: 'Красные карточки — риски. Они уже применены автоматически при загрузке линии. Отрицательный эффект списывается сразу. Но с помощью карточки «Случайность: отмена риска» можно нейтрализовать один из них!',
    target: '[class*="riskCard"]',
    placement: 'right',
  },
  {
    id: 'opportunity_cards',
    icon: '',
    title: 'Карточки возможности',
    text: 'Карточки с «?» — вопросы. Кликните по карточке и выберите правильный ответ. За верный ответ начисляются очки. Неверный — 0 очков. Ответить обязательно, пропустить нельзя!',
    target: '[class*="opportunity"]',
    placement: 'right',
  },
  {
    id: 'random_cards',
    icon: '',
    title: 'Карточки случайности',
    text: 'Карточки с кубиком — необязательные. Вы сами решаете: сыграть или пропустить. Эффект может быть положительным (+очки/+бюджет) или отменить один из рисков. Пропуск — без последствий.',
    target: '[class*="randomCard"]',
    placement: 'right',
  },
  {
    id: 'line_score',
    icon: '',
    title: 'Счёт линии',
    text: 'В заголовке линии отображается текущий счёт: зелёный = положительный, красный = отрицательный. После завершения всех обязательных карточек появится статус «Пройдено ✅» или «Провалено ❌».',
    target: '[class*="lineHeader"]',
    placement: 'bottom',
  },
  {
    id: 'skip_line',
    icon: '',
    title: 'Пропуск линии',
    text: 'Если линия неинтересна, нажмите «Пропустить» в заголовке. Все карточки будут отмечены как пропущенные. Используйте осторожно — это необратимо!',
    target: '[class*="skipLineBtn"]',
    placement: 'left',
  },
  {
    id: 'complete_stage',
    icon: '',
    title: 'Завершение этапа',
    text: 'Когда все линии завершены (или пропущены), кнопка «Далее — К полевым работам» станет активной. Нажмите её или дождитесь истечения таймера, чтобы перейти дальше.',
    target: '[class*="researchNextBtn"]',
    placement: 'bottom',
  },
  {
    id: 'done',
    icon: '',
    title: 'Всё готово — удачи!',
    text: 'Теперь вы знаете всё о Зоне событий. Разыгрывайте карточки мудро и следите за бюджетом. Удачи!',
    target: null,
    placement: 'center',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Конфигурация прокрутки для отдельных шагов
// ─────────────────────────────────────────────────────────────────────────────

const STEPS_SCROLL_CONFIG = {
  risk_cards:        { scrollTo: true,  lockScroll: false },
  opportunity_cards: { scrollTo: true,  lockScroll: false },
  random_cards:      { scrollTo: true,  lockScroll: false },
  line_score:        { scrollTo: true,  lockScroll: false },
  skip_line:         { scrollTo: true,  lockScroll: false },
  complete_stage:    { scrollTo: false, lockScroll: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// Утилиты DOM
// ─────────────────────────────────────────────────────────────────────────────

function findElement(selector) {
  if (!selector) return null;
  if (selector.startsWith('[class*=')) {
    const partial = selector.match(/\[class\*="(.+?)"\]/)?.[1];
    if (partial) return document.querySelector(`[class*="${partial}"]`);
  }
  return document.querySelector(selector);
}

function getElementRect(selector) {
  const el = findElement(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
}

function getScrollableParents(element) {
  const parents = [];
  let current = element.parentElement;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflow = style.overflow + style.overflowY + style.overflowX;
    if (/(auto|scroll)/.test(overflow)) parents.push(current);
    current = current.parentElement;
  }
  return parents;
}

// ─────────────────────────────────────────────────────────────────────────────
// Хук блокировки скролла
// ─────────────────────────────────────────────────────────────────────────────

function useScrollLock(active, targetSelector) {
  useEffect(() => {
    if (!active || !targetSelector) return;
    const targetElement = findElement(targetSelector);
    if (!targetElement) return;

    const scrollableParents = getScrollableParents(targetElement);
    const originalOverflows = new Map();

    originalOverflows.set(document.body, document.body.style.overflow);
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    scrollableParents.forEach(parent => {
      originalOverflows.set(parent, parent.style.overflow);
      parent.style.overflow = 'hidden';
    });

    const preventDefault = (e) => e.preventDefault();
    document.addEventListener('wheel', preventDefault, { passive: false });
    document.addEventListener('touchmove', preventDefault, { passive: false });

    return () => {
      document.body.style.overflow = originalOverflows.get(document.body) || '';
      document.body.style.touchAction = '';
      scrollableParents.forEach(parent => {
        parent.style.overflow = originalOverflows.get(parent) || '';
      });
      document.removeEventListener('wheel', preventDefault);
      document.removeEventListener('touchmove', preventDefault);
    };
  }, [active, targetSelector]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Позиционирование тултипа
// ─────────────────────────────────────────────────────────────────────────────

function computeTooltipStyle(rect, placement) {
  if (!rect || placement === 'center') {
    return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxWidth: 440 };
  }
  const GAP = 18;
  const TW  = 380;
  const vw  = window.innerWidth;
  const vh  = window.innerHeight;
  let style = { position: 'fixed', maxWidth: TW };

  switch (placement) {
    case 'right':
      style.left = Math.min(rect.right + GAP, vw - TW - 12);
      style.top  = Math.max(12, Math.min(rect.top + rect.height / 2 - 90, vh - 320));
      break;
    case 'left':
      style.left = Math.max(12, rect.left - TW - GAP);
      style.top  = Math.max(12, Math.min(rect.top + rect.height / 2 - 90, vh - 320));
      break;
    case 'bottom':
      style.top  = Math.min(rect.bottom + GAP, vh - 320);
      style.left = Math.max(12, Math.min(rect.left + rect.width / 2 - TW / 2, vw - TW - 12));
      break;
    case 'top':
      style.top  = Math.max(12, rect.top - 240 - GAP);
      style.left = Math.max(12, Math.min(rect.left + rect.width / 2 - TW / 2, vw - TW - 12));
      break;
    default:
      style.top = '50%'; style.left = '50%'; style.transform = 'translate(-50%, -50%)';
  }
  return style;
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG-маска с вырезом
// ─────────────────────────────────────────────────────────────────────────────

function HighlightMask({ rect }) {
  if (!rect) return <div className="ezt-mask-full" />;
  const PAD = 10;
  const r = {
    top:    Math.max(0, rect.top  - PAD),
    left:   Math.max(0, rect.left - PAD),
    width:  rect.width  + PAD * 2,
    height: rect.height + PAD * 2,
  };
  return (
    <svg className="ezt-mask-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <mask id="ezt-cutout">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect x={r.left} y={r.top} width={r.width} height={r.height} rx="8" fill="black" />
        </mask>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.75)" mask="url(#ezt-cutout)" />
      <rect
        x={r.left - 2} y={r.top - 2} width={r.width + 4} height={r.height + 4}
        rx="10" fill="none" stroke="#ff9800" strokeWidth="3" strokeDasharray="8 4"
        className="ezt-highlight-border"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Прогресс-точки
// ─────────────────────────────────────────────────────────────────────────────

function StepDots({ total, current }) {
  return (
    <div className="ezt-dots">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`ezt-dot ${i === current ? 'ezt-dot-active' : i < current ? 'ezt-dot-done' : ''}`}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Стрелка-указатель
// ─────────────────────────────────────────────────────────────────────────────

function Arrow({ placement }) {
  if (!placement || placement === 'center') return null;
  return <div className={`ezt-arrow ezt-arrow-${placement}`} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// ОСНОВНОЙ КОМПОНЕНТ ТУРА
// ─────────────────────────────────────────────────────────────────────────────

export default function EventsZoneTour({ globalYear, onDone }) {
  const [step, setStep]               = useState(0);
  const [visible, setVisible]         = useState(false);
  const [rect, setRect]               = useState(null);
  const [scrollReady, setScrollReady] = useState(true);
  const tooltipRef                    = useRef(null);

  const current   = EVENTS_TOUR_STEPS[step];
  const scrollCfg = STEPS_SCROLL_CONFIG[current?.id] || {};

  useScrollLock(visible && !!scrollCfg.lockScroll, current?.target);

  // Показываем тур только в первый год и только один раз
  useEffect(() => {
    if (globalYear !== 1) return;
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      const timer = setTimeout(() => setVisible(true), 700);
      return () => clearTimeout(timer);
    }
  }, [globalYear]);

  // Обновление позиции подсветки
  const updateRect = useCallback(() => {
    if (!current?.target) { setRect(null); return; }
    setRect(getElementRect(current.target));
  }, [current?.target]);

  // Скролл к элементу + обновление rect
  useEffect(() => {
    if (!visible || !current?.target) {
      updateRect();
      return;
    }

    if (scrollCfg.scrollTo) {
      setScrollReady(false);
      const element = findElement(current.target);

      if (!element) {
        console.warn(`[EventsZoneTour] Element not found: ${current.target}`);
        setScrollReady(true);
        updateRect();
        return;
      }

      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

      let rafId;
      let lastRect    = null;
      let stableCount = 0;
      const STABLE_THRESHOLD = 3;

      const checkScrollStability = () => {
        const newRect = getElementRect(current.target);
        if (newRect) {
          setRect(newRect);
          if (lastRect) {
            const isStable =
              Math.abs(newRect.top  - lastRect.top)  < 2 &&
              Math.abs(newRect.left - lastRect.left) < 2;
            if (isStable) {
              stableCount++;
              if (stableCount >= STABLE_THRESHOLD) { setScrollReady(true); return; }
            } else {
              stableCount = 0;
            }
          }
          lastRect = newRect;
          rafId = requestAnimationFrame(checkScrollStability);
        } else {
          setTimeout(checkScrollStability, 50);
        }
      };

      const timeoutId = setTimeout(() => { rafId = requestAnimationFrame(checkScrollStability); }, 100);

      return () => {
        clearTimeout(timeoutId);
        if (rafId) cancelAnimationFrame(rafId);
      };
    } else {
      updateRect();
      setScrollReady(true);
    }
  }, [step, visible, scrollCfg.scrollTo, current?.target, updateRect]);

  // Обновляем rect при ресайзе
  useEffect(() => {
    if (!visible) return;
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [visible, updateRect]);

  // Фокус на тултип для доступности
  useEffect(() => {
    if (visible && tooltipRef.current) {
      tooltipRef.current.focus({ preventScroll: true });
    }
  }, [step, visible]);

  if (!visible) return null;

  const total   = EVENTS_TOUR_STEPS.length;
  const isFirst = step === 0;
  const isLast  = step === total - 1;

  const goToStep = (newStep) => setStep(Math.max(0, Math.min(total - 1, newStep)));

  const finish = () => {
    localStorage.setItem(TOUR_KEY, '1');
    setVisible(false);
    onDone?.();
  };

  // Пока скролл идёт — тултип по центру без подсветки
  const effectiveRect = scrollReady ? rect : null;
  const tooltipStyle  = computeTooltipStyle(effectiveRect, scrollReady ? current.placement : 'center');

  return (
    <div
      className="ezt-root"
      role="dialog"
      aria-modal="true"
      aria-label="Обучающий тур — Зона событий"
    >
      <HighlightMask rect={effectiveRect} />

      <div
        ref={tooltipRef}
        className={`ezt-tooltip ${!scrollReady ? 'ezt-tooltip-fade' : ''}`}
        style={tooltipStyle}
        tabIndex="-1"
        aria-live="polite"
      >
        <Arrow placement={current.placement} />

        <div className="ezt-header">
          <span className="ezt-icon">{current.icon}</span>
          <span className="ezt-step-label">Шаг {step + 1} / {total}</span>
        </div>

        <h3 className="ezt-title">{current.title}</h3>
        <p  className="ezt-text">{current.text}</p>

        <StepDots total={total} current={step} />

        <div className="ezt-actions">
          {!isFirst && (
            <button className="ezt-btn ezt-btn-back" onClick={() => goToStep(step - 1)}>
              ← Назад
            </button>
          )}
          <div style={{ flex: 1 }} />
          {/* <button className="ezt-btn ezt-btn-skip" onClick={finish}>Пропустить</button> */}
          {isLast ? (
            <button className="ezt-btn ezt-btn-finish" onClick={finish}>
              Начать
            </button>
          ) : (
            <button className="ezt-btn ezt-btn-next" onClick={() => goToStep(step + 1)}>
              Далее →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
