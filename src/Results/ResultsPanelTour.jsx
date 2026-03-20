
import React, { useState, useEffect, useRef, useCallback } from 'react';
import './ResultsPanelTour.css';

const TOUR_KEY = 'resultsPanel_tourDone';


const RESULTS_TOUR_STEPS = [
  {
    id: 'welcome',
    title: 'Итоги года',
    text: 'Этот экран подводит итоги прошедшего года: показывает все выполненные полевые работы по участкам, результаты событий и суммарные затраты. Изучите данные перед переходом к следующему году.',
    target: null,
    placement: 'center',
  },
  {
    id: 'timer',
    title: 'Таймер итогов',
    text: 'Таймер в правом верхнем углу отсчитывает оставшееся время на просмотр итогов. Когда он истечёт, переход к следующему году произойдёт автоматически. Изучайте результаты, пока есть время.',
    target: '.rp-timer',
    placement: 'left',
  },
  {
    id: 'nav_buttons',
    title: 'Кнопки навигации',
    text: '"Назад" — вернуться к полевым работам. "В меню" — выйти в главное меню. "Завершить год N" — подтвердить переход к следующему году. При нажатии появится диалог подтверждения.',
    target: '.rp-nav-controls',
    placement: 'bottom',
  },
  {
    id: 'lu_switcher',
    title: 'Выбор участка',
    text: 'Нажмите на карточку участка, чтобы отобразить его итоговую таблицу. Цветная левая полоска показывает статус: зелёная — выполнено, красная — провал, серая — нет работ или НИР.',
    target: '.rp-lu-switcher-row',
    placement: 'bottom',
  },
  {
    id: 'lu_badges',
    title: 'Значки участка',
    text: 'На карточке участка отображаются сводные данные: количество НИР, счёт событий (+/-), общая стоимость полевых работ и список лет, в которых велись работы.',
    target: '.rp-lu-badges',
    placement: 'bottom',
  },
  {
    id: 'table_section',
    title: 'Таблица полевых работ',
    text: 'Таблица показывает, какие работы были выбраны для участка. Столбцы — типы работ, разбитые по группам. Строки — годы. Пустая ячейка означает, что данный тип работ не выбирался.',
    target: '.rp-table-section',
    placement: 'top',
  },
  {
    id: 'table_header',
    title: 'Заголовки столбцов',
    text: 'Столбцы разбиты на 4 группы по цвету: серый — СРР, оранжевый — ГРР, бежевый — Бурение, синий — Добыча. Фон заголовка соответствует группе работ.',
    target: '.rp-th',
    placement: 'bottom',
  },
  {
    id: 'lu_info_cell',
    title: 'Сводка по участку в таблице',
    text: 'Левая ячейка содержит итоговые данные: общая стоимость всех работ, среднее качество, результат событий и количество НИР. Если работы велись несколько лет — указаны все годы.',
    target: '.rp-lu-info',
    placement: 'right',
  },
  {
    id: 'work_cell',
    title: 'Ячейка с выбранными работами',
    text: 'Заполненная ячейка показывает конкретные параметры, выбранные в Полевых работах: название параметра, выбранный вариант и его стоимость. Наведите курсор — ячейка увеличится для удобного чтения.',
    target: '.rp-work-cell',
    placement: 'left',
  },
  {
    id: 'empty_cell',
    title: 'Пустая ячейка',
    text: 'Серая ячейка с пунктирной рамкой означает, что данный тип работы не применялся для этого участка в этом году. Это может быть нормально — не все типы работ нужны на каждом этапе.',
    target: '.rp-empty-cell',
    placement: 'right',
  },
  {
    id: 'finish_year',
    title: 'Завершение года',
    text: 'Когда будете готовы, нажмите "Завершить год". Появится диалог подтверждения — там же будет предупреждение о сбросе карточек событий для нового года. Действие необратимо.',
    target: '.rp-nav-btn-finish',
    placement: 'bottom',
  },
  {
    id: 'done',
    title: 'Всё готово',
    text: 'Теперь вы знаете, как читать итоги года. Этот тур больше не появится. Для сброса: localStorage.removeItem("resultsPanel_tourDone") в консоли браузера.',
    target: null,
    placement: 'center',
  },
];


const STEPS_SCROLL_CONFIG = {
  table_header:  { scrollTo: true,  lockScroll: false },
  lu_info_cell:  { scrollTo: true,  lockScroll: false },
  work_cell:     { scrollTo: true,  lockScroll: false },
  empty_cell:    { scrollTo: true,  lockScroll: false },
  legend:        { scrollTo: true,  lockScroll: false },
  lu_badges:     { scrollTo: false, lockScroll: false },
};


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


function HighlightMask({ rect }) {
  if (!rect) return <div className="rpt2-mask-full" />;
  const PAD = 10;
  const r = {
    top:    Math.max(0, rect.top  - PAD),
    left:   Math.max(0, rect.left - PAD),
    width:  rect.width  + PAD * 2,
    height: rect.height + PAD * 2,
  };
  return (
    <svg className="rpt2-mask-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <mask id="rpt2-cutout">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect x={r.left} y={r.top} width={r.width} height={r.height} rx="8" fill="black" />
        </mask>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.72)" mask="url(#rpt2-cutout)" />
      <rect
        x={r.left - 2} y={r.top - 2} width={r.width + 4} height={r.height + 4}
        rx="10" fill="none" stroke="#2fa394" strokeWidth="3" strokeDasharray="8 4"
        className="rpt2-highlight-border"
      />
    </svg>
  );
}


function StepDots({ total, current }) {
  return (
    <div className="rpt2-dots">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`rpt2-dot ${i === current ? 'rpt2-dot-active' : i < current ? 'rpt2-dot-done' : ''}`}
        />
      ))}
    </div>
  );
}


function Arrow({ placement }) {
  if (!placement || placement === 'center') return null;
  return <div className={`rpt2-arrow rpt2-arrow-${placement}`} />;
}


export default function ResultsPanelTour({ globalYear, onDone }) {
  const [step, setStep]               = useState(0);
  const [visible, setVisible]         = useState(false);
  const [rect, setRect]               = useState(null);
  const [scrollReady, setScrollReady] = useState(true);
  const tooltipRef                    = useRef(null);

  const current   = RESULTS_TOUR_STEPS[step];
  const scrollCfg = STEPS_SCROLL_CONFIG[current?.id] || {};

  useScrollLock(visible && !!scrollCfg.lockScroll, current?.target);

  useEffect(() => {
    if (globalYear !== 1) return;
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      const timer = setTimeout(() => setVisible(true), 700);
      return () => clearTimeout(timer);
    }
  }, [globalYear]);

  const updateRect = useCallback(() => {
    if (!current?.target) { setRect(null); return; }
    setRect(getElementRect(current.target));
  }, [current?.target]);

  useEffect(() => {
    if (!visible || !current?.target) {
      updateRect();
      return;
    }

    if (scrollCfg.scrollTo) {
      setScrollReady(false);
      const element = findElement(current.target);

      if (!element) {
        console.warn(`[ResultsPanelTour] Element not found: ${current.target}`);
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

  useEffect(() => {
    if (!visible) return;
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [visible, updateRect]);

  useEffect(() => {
    if (visible && tooltipRef.current) {
      tooltipRef.current.focus({ preventScroll: true });
    }
  }, [step, visible]);

  if (!visible) return null;

  const total   = RESULTS_TOUR_STEPS.length;
  const isFirst = step === 0;
  const isLast  = step === total - 1;

  const goToStep = (newStep) => setStep(Math.max(0, Math.min(total - 1, newStep)));

  const finish = () => {
    localStorage.setItem(TOUR_KEY, '1');
    setVisible(false);
    onDone?.();
  };

  const effectiveRect = scrollReady ? rect : null;
  const tooltipStyle  = computeTooltipStyle(effectiveRect, scrollReady ? current.placement : 'center');

  return (
    <div
      className="rpt2-root"
      role="dialog"
      aria-modal="true"
      aria-label="Обучающий тур — Итоги года"
    >
      <HighlightMask rect={effectiveRect} />

      <div
        ref={tooltipRef}
        className={`rpt2-tooltip ${!scrollReady ? 'rpt2-tooltip-fade' : ''}`}
        style={tooltipStyle}
        tabIndex="-1"
        aria-live="polite"
      >
        <Arrow placement={current.placement} />

        <div className="rpt2-header">
          <span className="rpt2-step-label">Шаг {step + 1} / {total}</span>
        </div>

        <h3 className="rpt2-title">{current.title}</h3>
        <p  className="rpt2-text">{current.text}</p>

        <StepDots total={total} current={step} />

        <div className="rpt2-actions">
          {!isFirst && (
            <button className="rpt2-btn rpt2-btn-back" onClick={() => goToStep(step - 1)}>
              &larr; Назад
            </button>
          )}
          <div style={{ flex: 1 }} />
          {isLast ? (
            <button className="rpt2-btn rpt2-btn-finish" onClick={finish}>
              Начать работу
            </button>
          ) : (
            <button className="rpt2-btn rpt2-btn-next" onClick={() => goToStep(step + 1)}>
              Далее &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}