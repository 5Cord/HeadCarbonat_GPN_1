// FieldWorkPanelTour.jsx
// Пошаговый обучающий тур для экрана FieldWorkPanel (Полевые работы).
// Показывается только один раз — при первом заходе (globalYear === 1).
// Флаг хранится в localStorage: 'fieldWorkPanel_tourDone'.
//
// Подключение в FieldWorkPanel.jsx:
//   import FieldWorkPanelTour from './FieldWorkPanelTour';
//   ...
//   <FieldWorkPanelTour globalYear={globalYear} onDone={() => {}} />

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Fieldworkpaneltour.css';

const TOUR_KEY = 'fieldWorkPanel_tourDone';

// ─────────────────────────────────────────────────────────────────────────────
// ШАГИ ТУРА
// target    — CSS-селектор подсвечиваемого элемента (null = центр экрана)
// placement — 'top' | 'bottom' | 'left' | 'right' | 'center'
// ─────────────────────────────────────────────────────────────────────────────

const FIELD_WORK_TOUR_STEPS = [
  {
    id: 'welcome',
    title: 'Добро пожаловать в Полевые работы!',
    text: 'Здесь вы подбираете конкретные параметры работ для каждого участка: методы, оборудование, подрядчиков. Выбор влияет на качество геологоразведки и стоимость.',
    target: null,
    placement: 'center',
  },
  {
    id: 'timer',
    title: 'Глобальный таймер',
    text: 'Таймер отсчитывает время на полевые работы. Цвет меняется по мере истечения: оранжевый — осталось мало, красный — критически мало. По истечении этап завершится автоматически.',
    target: '[class*="timer"]',
    placement: 'left',
  },
  {
    id: 'nav_buttons',
    title: 'Кнопки навигации',
    text: '"Назад" — вернуться в Зону событий. "В меню" — выйти в главное меню. "Далее" — перейти к следующему этапу (доступна всегда, даже без подтверждения выбора).',
    target: '[class*="topbarLeft"]',
    placement: 'bottom',
  },
  {
    id: 'budget',
    title: 'Бюджет',
    text: 'Текущий бюджет команды отображается в правом верхнем углу. Следите за ним — стоимость выбранных опций списывается при подтверждении.',
    target: '[class*="budgetBadge"]',
    placement: 'bottom',
  },
  {
    id: 'lu_section',
    title: 'Шаг 1 — Выберите участок',
    text: 'Нажмите на карточку участка, чтобы отобразить доступные для него блоки работ. Синяя рамка — активный участок. Статус "Выбрано" означает, что параметры уже подтверждены.',
    target: '[class*="luCardsRow"]',
    placement: 'bottom',
  },
  {
    id: 'stats_row',
    title: 'Сводка по участку',
    text: 'Здесь отображаются: количество заполненных карточек, итоговая стоимость выбора и средний ранг. Если стоимость красная — бюджета не хватает.',
    target: '[class*="statsRow"]',
    placement: 'bottom',
  },
  {
    id: 'field_area',
    title: 'Шаг 2 — Блоки работ',
    text: 'Колонки соответствуют типам работ (СРР, ГРР, Бурение, Добыча). Каждая колонка доступна только в определённые годы и только при наличии соответствующих НИР.',
    target: '[class*="fieldArea"]',
    placement: 'top',
  },
  {
    id: 'block_col',
    title: 'Блок работ',
    text: 'Каждый блок содержит набор карточек с параметрами. Цветная полоска вверху и точка обозначают группу: серый — СРР, оранжевый — ГРР, бежевый — Бурение, синий — Добыча.',
    target: '[class*="blockCol"]',
    placement: 'right',
  },
  {
    id: 'card',
    title: 'Шаг 3 — Карточка параметра',
    text: 'Каждая карточка — это один параметр работы (например, тип оборудования или метод сейсмики). Зелёная рамка вокруг карточки означает, что для неё уже выбран вариант.',
    target: '[class*="card"]',
    placement: 'right',
  },
  {
    id: 'opt_btn',
    title: 'Варианты параметра',
    text: 'Нажмите на вариант, чтобы выбрать его. Слева — описание параметра, справа — стоимость в млн руб. Зелёный фон варианта означает, что он выбран. Выбор можно менять.',
    target: '[class*="optBtn"]',
    placement: 'right',
  },
  {
    id: 'confirm_btn',
    title: 'Шаг 4 — Подтвердите выбор',
    text: 'После заполнения карточек нажмите "Подтвердить выбор". Стоимость спишется с бюджета, и участок получит статус "Выбрано". Без подтверждения изменения не сохранятся.',
    target: '[class*="confirmBtnBottom"]',
    placement: 'top',
  },
  {
    id: 'avg_rank',
    title: 'Средний ранг',
    text: 'Средний ранг отображает качество выбранных параметров. Более высокий ранг соответствует более дорогим, но качественным опциям. Ранг влияет на итоговые результаты бурения.',
    target: '[class*="avgRankBadge"]',
    placement: 'top',
  },
  {
    id: 'done',
    title: 'Всё готово — начинайте!',
    text: 'Теперь вы знаете основы Полевых работ. Выбирайте параметры для каждого участка и подтверждайте. Удачи!',
    target: null,
    placement: 'center',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Конфигурация прокрутки для отдельных шагов
// ─────────────────────────────────────────────────────────────────────────────

const STEPS_SCROLL_CONFIG = {
  block_col: { scrollTo: true, lockScroll: false },
  card: { scrollTo: true, lockScroll: false },
  opt_btn: { scrollTo: true, lockScroll: false },
  confirm_btn: { scrollTo: true, lockScroll: false },
  avg_rank: { scrollTo: true, lockScroll: false },
  stats_row: { scrollTo: false, lockScroll: false },
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
  const TW = 380;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let style = { position: 'fixed', maxWidth: TW };

  switch (placement) {
    case 'right':
      style.left = Math.min(rect.right + GAP, vw - TW - 12);
      style.top = Math.max(12, Math.min(rect.top + rect.height / 2 - 90, vh - 320));
      break;
    case 'left':
      style.left = Math.max(12, rect.left - TW - GAP);
      style.top = Math.max(12, Math.min(rect.top + rect.height / 2 - 90, vh - 320));
      break;
    case 'bottom':
      style.top = Math.min(rect.bottom + GAP, vh - 320);
      style.left = Math.max(12, Math.min(rect.left + rect.width / 2 - TW / 2, vw - TW - 12));
      break;
    case 'top':
      style.top = Math.max(12, rect.top - 240 - GAP);
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
  if (!rect) return <div className="fwt-mask-full" />;
  const PAD = 10;
  const r = {
    top: Math.max(0, rect.top - PAD),
    left: Math.max(0, rect.left - PAD),
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };
  return (
    <svg className="fwt-mask-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <mask id="fwt-cutout">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect x={r.left} y={r.top} width={r.width} height={r.height} rx="8" fill="black" />
        </mask>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.78)" mask="url(#fwt-cutout)" />
      <rect
        x={r.left - 2} y={r.top - 2} width={r.width + 4} height={r.height + 4}
        rx="10" fill="none" stroke="#c8a97e" strokeWidth="3" strokeDasharray="8 4"
        className="fwt-highlight-border"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Прогресс-точки
// ─────────────────────────────────────────────────────────────────────────────

function StepDots({ total, current }) {
  return (
    <div className="fwt-dots">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`fwt-dot ${i === current ? 'fwt-dot-active' : i < current ? 'fwt-dot-done' : ''}`}
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
  return <div className={`fwt-arrow fwt-arrow-${placement}`} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// ОСНОВНОЙ КОМПОНЕНТ ТУРА
// ─────────────────────────────────────────────────────────────────────────────

export default function FieldWorkPanelTour({ globalYear, onDone }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [rect, setRect] = useState(null);
  const [scrollReady, setScrollReady] = useState(true);
  const tooltipRef = useRef(null);

  const current = FIELD_WORK_TOUR_STEPS[step];
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
        console.warn(`[FieldWorkPanelTour] Element not found: ${current.target}`);
        setScrollReady(true);
        updateRect();
        return;
      }

      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

      let rafId;
      let lastRect = null;
      let stableCount = 0;
      const STABLE_THRESHOLD = 3;

      const checkScrollStability = () => {
        const newRect = getElementRect(current.target);
        if (newRect) {
          setRect(newRect);
          if (lastRect) {
            const isStable =
              Math.abs(newRect.top - lastRect.top) < 2 &&
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

  const total = FIELD_WORK_TOUR_STEPS.length;
  const isFirst = step === 0;
  const isLast = step === total - 1;

  const goToStep = (newStep) => setStep(Math.max(0, Math.min(total - 1, newStep)));

  const finish = () => {
    localStorage.setItem(TOUR_KEY, '1');
    setVisible(false);
    onDone?.();
  };

  const effectiveRect = scrollReady ? rect : null;
  const tooltipStyle = computeTooltipStyle(effectiveRect, scrollReady ? current.placement : 'center');

  return (
    <div
      className="fwt-root"
      role="dialog"
      aria-modal="true"
      aria-label="Обучающий тур — Полевые работы"
    >
      <HighlightMask rect={effectiveRect} />

      <div
        ref={tooltipRef}
        className={`fwt-tooltip ${!scrollReady ? 'fwt-tooltip-fade' : ''}`}
        style={tooltipStyle}
        tabIndex="-1"
        aria-live="polite"
      >
        <Arrow placement={current.placement} />

        <div className="fwt-header">
          <span className="fwt-step-label">Шаг {step + 1} / {total}</span>
        </div>

        <h3 className="fwt-title">{current.title}</h3>
        <p className="fwt-text">{current.text}</p>

        <StepDots total={total} current={step} />

        <div className="fwt-actions">
          {!isFirst && (
            <button className="fwt-btn fwt-btn-back" onClick={() => goToStep(step - 1)}>
              &larr; Назад
            </button>
          )}
          <div style={{ flex: 1 }} />
          {isLast ? (
            <button className="fwt-btn fwt-btn-finish" onClick={finish}>
              Начать работу
            </button>
          ) : (
            <button className="fwt-btn fwt-btn-next" onClick={() => goToStep(step + 1)}>
              Далее &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
