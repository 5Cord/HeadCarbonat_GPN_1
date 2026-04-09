// ResearchPanelTour.jsx
// Пошаговый обучающий тур для экранов ResearchPanel и RefusalMap.
// Показывается только один раз — при первом заходе (globalYear === 1).
// Флаг хранится в localStorage: 'researchPanel_tourDone'.
//
// Подключение в ResearchPanel.jsx:
//   import ResearchPanelTour from './ResearchPanelTour';
//   ...
//   <ResearchPanelTour globalYear={globalYear} onDone={() => {}} />

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Researchpaneltour.css';

const TOUR_KEY = 'researchPanel_tourDone';

// ─────────────────────────────────────────────────────────────────────────────
// ШАГИ ТУРА
// target  — CSS-селектор подсвечиваемого элемента (null = центр экрана)
// placement — 'top' | 'bottom' | 'left' | 'right' | 'center'
// ─────────────────────────────────────────────────────────────────────────────

const RESEARCH_TOUR_STEPS = [
  {
    id: 'welcome',
    icon: '',
    title: 'Добро пожаловать в Научные исследования!',
    text: 'Здесь вы будете покупать НИР (научно-исследовательские работы) для ваших участков, чтобы повысить успешность геологоразведки. Каждый год — новые возможности.',
    target: null,
    placement: 'center',
  },
  {
    id: 'timer',
    icon: '⏱️',
    title: 'Глобальный таймер',
    text: 'Таймер в правом верхнем углу отсчитывает время года. Когда он истечёт — год завершится автоматически. Не спешите, но и не затягивайте!',
    target: '[class*="timer"]',
    placement: 'left',
  },
  {
    id: 'nav_buttons',
    icon: '',
    title: 'Кнопки навигации',
    text: '«← Назад» — вернуться на карту региона. «В меню» — выйти в главное меню. «Далее — К зоне событий» — перейти к следующему этапу игры.',
    target: '[class*="researchMapControls"]',
    placement: 'bottom',
  },
  {
    id: 'research_header',
    icon: '',
    title: 'Заголовок и бюджет',
    text: 'Здесь отображается ваш текущий бюджет (в млн руб.) и итоговая успешность выбранного участка. Следите за тратами!',
    target: '[class*="researchHeader"]',
    placement: 'bottom',
  },
  {
    id: 'lu_cards',
    icon: '',
    title: 'Шаг 1 — Выберите участок',
    text: 'Нажмите на карточку участка (синяя рамка = выбран). Можно выбрать несколько сразу — тогда НИР будет куплена для всех выбранных участков одним действием.',
    target: '[class*="luCardsContainer"]',
    placement: 'bottom',
  },
  {
    id: 'year_round',
    icon: '',
    title: 'Год и итерация',
    text: 'Эта строка показывает текущий год и тип работ (ГРР, Бурение, Добыча). Кнопка «Завершить год» — ручной досрочный переход, если всё готово.',
    target: '[class*="roundIndicator"]',
    placement: 'bottom',
  },
  {
    id: 'legend',
    icon: '',
    title: 'Легенда цветовых групп',
    text: 'Столбцы таблицы разбиты на 4 группы: СРР (серый), ГРР (оранжевый), Бурение (бежевый), Добыча (синий). Каждая группа доступна только в определённые годы.',
    target: '[class*="groupLegend"]',
    placement: 'bottom',
  },
  {
    id: 'table_header',
    icon: '',
    title: 'Шаг 2 — Выберите столбец (мобилизацию)',
    text: 'Нажмите на заголовок столбца в таблице — это выбор типа работ на год. Заголовки активных столбцов подсвечены. Заблокированные или недоступные в этом году — затемнены.',
    target: '[class*="researchTableContainer"]',
    placement: 'top',
  },
  {
    id: 'table_cells',
    icon: '',
    title: 'Шаг 3 — Купите НИР в ячейках',
    text: 'После выбора столбца кликайте по ячейкам в нём — каждая ячейка это отдельная НИР. Знак «?» означает скрытый % успешности (откроется после покупки). «✕» — заблокировано, «-» — не в этом году.',
    target: '[class*="researchTableScroll"]',
    placement: 'top',
  },
  {
    id: 'confirm_session',
    icon: '',
    title: 'Шаг 4 — Подтвердите выбор',
    text: 'После покупки всех нужных НИР нажмите «Подтвердить НИРы — завершить». Это зафиксирует выбранный столбец для участков на этот год. Без подтверждения год не засчитается!',
    target: '[class*="confirmSessionBtn"]',
    placement: 'bottom',
  },
  {
    id: 'totals_row',
    icon: '',
    title: 'Итоговая строка успешности',
    text: 'Последняя строка таблицы показывает суммарный % успешности по каждому столбцу. Зелёный ≥70%, оранжевый ≥40%, красный <40%. Чем выше — тем лучше результат геологоразведки.',
    target: '[class*="totalsRow"]',
    placement: 'top',
  },
  {
    id: 'finish_year',
    icon: '',
    title: 'Завершение года',
    text: 'Когда завершится таймер (или вы нажмёте «Завершить год») — откроется экран результатов. После этого начнётся следующий год. В годы 3 и 5 появится специальный экран отказа от участков.',
    target: '[class*="skipYearBtn"]',
    placement: 'left',
  },
  {
    id: 'done',
    icon: '',
    title: 'Всё готово — начинайте!',
    text: 'Теперь вы знаете основы. Удачи в исследованиях!',
    target: null,
    placement: 'center',
  },
];

// Отдельные шаги для экрана отказа от участков (RefusalMap)
export const REFUSAL_TOUR_STEPS = [
  {
    id: 'refusal_welcome',
    icon: '',
    title: 'Возможность отказа от участка',
    text: 'В годы 3 и 5 у вас есть возможность отказаться от одного или нескольких участков. Это может быть выгодно, если участок бесперспективен.',
    target: null,
    placement: 'center',
  },
  {
    id: 'refusal_timer',
    icon: '',
    title: 'Таймер решения',
    text: 'У вас ограниченное время на принятие решения. Если таймер истечёт — год перейдёт автоматически без отказа от участков.',
    target: '.refusal-modal-timer',
    placement: 'bottom',
  },
  {
    id: 'refusal_map',
    icon: '',
    title: 'Мини-карта участков',
    text: 'Синие ячейки — ваши участки. Нажмите на синюю ячейку чтобы выбрать её для отказа (станет красной). Нажмите снова — чтобы отменить выбор.',
    target: '.refusal-map-wrap',
    placement: 'right',
  },
  {
    id: 'refusal_legend',
    icon: '',
    title: 'Легенда карты',
    text: 'Синий = ваш участок, красный = выбран для отказа, серый = другая команда, цветные с полосками = заблокированные зоны.',
    target: '.refusal-map-legend',
    placement: 'bottom',
  },
  {
    id: 'refusal_action',
    icon: '',
    title: 'Кнопки действия',
    text: '«Отказаться от: [участок]» — безвозвратно передаёт участок. «Продолжить с текущими» — ничего не меняет, год переходит дальше. Отказ необратим!',
    target: '.refusal-modal-actions',
    placement: 'top',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Шаги, требующие прокрутки к элементу перед показом
// ─────────────────────────────────────────────────────────────────────────────

// scrollTo: true  — прокрутить страницу к элементу перед показом тултипа
// lockScroll: true — заблокировать прокрутку пока шаг активен
const STEPS_SCROLL_CONFIG = {
  totals_row:   { scrollTo: true, lockScroll: true },
  table_header: { scrollTo: true, lockScroll: true },
  table_cells:  { scrollTo: true, lockScroll: true },
  lu_cards:     { scrollTo: true, lockScroll: false },
  finish_year:  { scrollTo: true, lockScroll: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// Утилита: найти DOM-элемент по селектору (с поддержкой CSS-модулей)
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

// Поиск всех прокручиваемых родителей элемента
function getScrollableParents(element) {
  const parents = [];
  let current = element.parentElement;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflow = style.overflow + style.overflowY + style.overflowX;
    if (/(auto|scroll)/.test(overflow)) {
      parents.push(current);
    }
    current = current.parentElement;
  }
  return parents;
}

// Плавный скролл к элементу с учётом того, что он может быть
// внутри overflow-контейнера (горизонтальный скролл таблицы) ИЛИ на странице.
function scrollToElement(selector) {
  const el = findElement(selector);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Хук блокировки/разблокировки скролла страницы и прокручиваемых родителей
// ─────────────────────────────────────────────────────────────────────────────

function useScrollLock(active, targetSelector) {
  useEffect(() => {
    if (!active || !targetSelector) return;

    const targetElement = findElement(targetSelector);
    if (!targetElement) return;

    const scrollableParents = getScrollableParents(targetElement);
    
    // Сохраняем исходные стили для восстановления
    const originalOverflows = new Map();
    
    // Блокируем body
    originalOverflows.set(document.body, document.body.style.overflow);
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    
    // Блокируем всех прокручиваемых родителей
    scrollableParents.forEach(parent => {
      originalOverflows.set(parent, parent.style.overflow);
      parent.style.overflow = 'hidden';
    });

    // Блокируем события колеса и касания на весь документ
    const preventDefault = (e) => e.preventDefault();
    document.addEventListener('wheel', preventDefault, { passive: false });
    document.addEventListener('touchmove', preventDefault, { passive: false });

    return () => {
      // Восстанавливаем body
      document.body.style.overflow = originalOverflows.get(document.body) || '';
      document.body.style.touchAction = '';
      
      // Восстанавливаем родителей
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
  const TW = 380;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let style = { position: 'fixed', maxWidth: TW };

  switch (placement) {
    case 'right':
      style.left = Math.min(rect.right + GAP, vw - TW - 12);
      style.top = Math.max(12, Math.min(rect.top + rect.height / 2 - 90, vh - 300));
      break;
    case 'left':
      style.left = Math.max(12, rect.left - TW - GAP);
      style.top = Math.max(12, Math.min(rect.top + rect.height / 2 - 90, vh - 300));
      break;
    case 'bottom':
      style.top = Math.min(rect.bottom + GAP, vh - 300);
      style.left = Math.max(12, Math.min(rect.left + rect.width / 2 - TW / 2, vw - TW - 12));
      break;
    case 'top':
      style.top = Math.max(12, rect.top - 220 - GAP);
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
  if (!rect) return <div className="rpt-mask-full" />;
  const PAD = 10;
  const r = {
    top: Math.max(0, rect.top - PAD),
    left: Math.max(0, rect.left - PAD),
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };
  return (
    <svg className="rpt-mask-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <mask id="rpt-cutout">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect x={r.left} y={r.top} width={r.width} height={r.height} rx="8" fill="black" />
        </mask>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.75)" mask="url(#rpt-cutout)" />
      <rect
        x={r.left - 2} y={r.top - 2} width={r.width + 4} height={r.height + 4}
        rx="10" fill="none" stroke="#4fc3f7" strokeWidth="3" strokeDasharray="8 4"
        className="rpt-highlight-border"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Прогресс-точки
// ─────────────────────────────────────────────────────────────────────────────

function StepDots({ total, current }) {
  return (
    <div className="rpt-dots">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`rpt-dot ${i === current ? 'rpt-dot-active' : i < current ? 'rpt-dot-done' : ''}`} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Стрелка
// ─────────────────────────────────────────────────────────────────────────────

function Arrow({ placement }) {
  if (!placement || placement === 'center') return null;
  return <div className={`rpt-arrow rpt-arrow-${placement}`} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// ОСНОВНОЙ ТУР (ResearchPanel)
// ─────────────────────────────────────────────────────────────────────────────

export default function ResearchPanelTour({ globalYear, onDone }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [rect, setRect] = useState(null);
  const [scrollReady, setScrollReady] = useState(true);
  const tooltipRef = useRef(null);

  const current = RESEARCH_TOUR_STEPS[step];
  const scrollCfg = STEPS_SCROLL_CONFIG[current?.id] || {};

  // Блокируем скролл когда нужно, с передачей селектора текущего элемента
  useScrollLock(visible && !!scrollCfg.lockScroll, current?.target);

  // Показываем тур только в первый год и если ещё не пройден
  useEffect(() => {
    if (globalYear !== 1) return;
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      // Небольшая задержка, чтобы страница успела отрендериться
      const timer = setTimeout(() => setVisible(true), 700);
      return () => clearTimeout(timer);
    }
  }, [globalYear]);

  // Функция обновления позиции подсветки
  const updateRect = useCallback(() => {
    if (!current?.target) {
      setRect(null);
      return;
    }
    setRect(getElementRect(current.target));
  }, [current?.target]);

  // Эффект для скролла к элементу и обновления rect
  useEffect(() => {
    if (!visible || !current?.target) {
      updateRect();
      return;
    }

    if (scrollCfg.scrollTo) {
      setScrollReady(false);
      const element = findElement(current.target);
      
      if (!element) {
        console.warn(`Element not found for selector: ${current.target}`);
        setScrollReady(true);
        updateRect();
        return;
      }

      // Запускаем скролл
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      
      let rafId;
      let lastRect = null;
      let stableCount = 0;
      const STABLE_THRESHOLD = 3; // Сколько раз подряд позиция должна быть стабильной
      
      // Функция проверки стабильности скролла
      const checkScrollStability = () => {
        const newRect = getElementRect(current.target);
        
        if (newRect) {
          setRect(newRect); // Обновляем rect для плавного движения подсветки
          
          if (lastRect) {
            const isStable = 
              Math.abs(newRect.top - lastRect.top) < 2 &&
              Math.abs(newRect.left - lastRect.left) < 2;
            
            if (isStable) {
              stableCount++;
              if (stableCount >= STABLE_THRESHOLD) {
                // Скролл стабилизировался
                setScrollReady(true);
                return;
              }
            } else {
              stableCount = 0; // Сброс счетчика при движении
            }
          }
          
          lastRect = newRect;
          rafId = requestAnimationFrame(checkScrollStability);
        } else {
          // Элемент исчез? Пробуем еще раз чуть позже
          setTimeout(checkScrollStability, 50);
        }
      };
      
      // Даем скроллу старт и начинаем проверку
      const timeoutId = setTimeout(() => {
        rafId = requestAnimationFrame(checkScrollStability);
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        if (rafId) cancelAnimationFrame(rafId);
      };
    } else {
      // Если скролл не нужен, просто обновляем rect
      updateRect();
      setScrollReady(true);
    }
  }, [step, visible, scrollCfg.scrollTo, current?.target, updateRect]);

  // Обновляем rect при ресайзе окна
  useEffect(() => {
    if (!visible) return;
    
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [visible, updateRect]);

  // Устанавливаем фокус на тултип при смене шага для доступности
  useEffect(() => {
    if (visible && tooltipRef.current) {
      tooltipRef.current.focus({ preventScroll: true });
    }
  }, [step, visible]);

  if (!visible) return null;

  const isLast = step === RESEARCH_TOUR_STEPS.length - 1;
  const isFirst = step === 0;
  const total = RESEARCH_TOUR_STEPS.length;

  const goToStep = (newStep) => {
    setStep(Math.max(0, Math.min(total - 1, newStep)));
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

  // Пока скролл ещё идёт — показываем тултип по центру без подсветки
  const effectiveRect = scrollReady ? rect : null;
  const tooltipStyle = computeTooltipStyle(effectiveRect, scrollReady ? current.placement : 'center');

  return (
    <div className="rpt-root" role="dialog" aria-modal="true" aria-label="Обучающий тур — Исследования">
      <HighlightMask rect={effectiveRect} />
      <div 
        ref={tooltipRef}
        className={`rpt-tooltip ${!scrollReady ? 'rpt-tooltip-fade' : ''}`} 
        style={tooltipStyle}
        tabIndex="-1"
        aria-live="polite"
      >
        <Arrow placement={current.placement} />

        <div className="rpt-header">
          <span className="rpt-icon">{current.icon}</span>
          <span className="rpt-step-label">Шаг {step + 1} / {total}</span>
        </div>

        <h3 className="rpt-title">{current.title}</h3>
        <p className="rpt-text">{current.text}</p>

        <StepDots total={total} current={step} />

        <div className="rpt-actions">
          {!isFirst && (
            <button className="rpt-btn rpt-btn-back" onClick={() => goToStep(step - 1)}>
              ← Назад
            </button>
          )}
          <div style={{ flex: 1 }} />
          {/* <button className="rpt-btn rpt-btn-skip" onClick={skip}>
            Пропустить
          </button> */}
          {isLast ? (
            <button className="rpt-btn rpt-btn-finish" onClick={finish}>
              Начать работу
            </button>
          ) : (
            <button className="rpt-btn rpt-btn-next" onClick={() => goToStep(step + 1)}>
              Далее →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ТУР ДЛЯ МОДАЛКИ ОТКАЗА (RefusalMap)
// Использование: <RefusalTour onDone={() => {}} />
// Показывается только один раз (свой localStorage-ключ).
// ─────────────────────────────────────────────────────────────────────────────

const REFUSAL_TOUR_KEY = 'refusalMap_tourDone';

export function RefusalTour({ onDone }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [rect, setRect] = useState(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    const done = localStorage.getItem(REFUSAL_TOUR_KEY);
    if (!done) {
      const timer = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(timer);
    }
  }, []);

  const updateRect = useCallback(() => {
    const current = REFUSAL_TOUR_STEPS[step];
    if (!current?.target) {
      setRect(null);
      return;
    }
    setRect(getElementRect(current.target));
  }, [step]);

  useEffect(() => {
    if (!visible) return;
    updateRect();
    
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [step, visible, updateRect]);

  useEffect(() => {
    if (visible && tooltipRef.current) {
      tooltipRef.current.focus({ preventScroll: true });
    }
  }, [step, visible]);

  if (!visible) return null;

  const current = REFUSAL_TOUR_STEPS[step];
  const isLast = step === REFUSAL_TOUR_STEPS.length - 1;
  const isFirst = step === 0;
  const total = REFUSAL_TOUR_STEPS.length;

  const goToStep = (newStep) => {
    setStep(Math.max(0, Math.min(total - 1, newStep)));
  };

  const finish = () => {
    localStorage.setItem(REFUSAL_TOUR_KEY, '1');
    setVisible(false);
    onDone?.();
  };

  const skip = () => {
    localStorage.setItem(REFUSAL_TOUR_KEY, '1');
    setVisible(false);
    onDone?.();
  };

  const tooltipStyle = computeTooltipStyle(rect, current.placement);

  return (
    <div 
      className="rpt-root" 
      style={{ zIndex: 3000 }} 
      role="dialog" 
      aria-modal="true"
      aria-label="Тур — Отказ от участка"
    >
      <HighlightMask rect={rect} />
      <div 
        ref={tooltipRef}
        className="rpt-tooltip rpt-tooltip-refusal" 
        style={tooltipStyle}
        tabIndex="-1"
        aria-live="polite"
      >
        <Arrow placement={current.placement} />

        <div className="rpt-header">
          <span className="rpt-icon">{current.icon}</span>
          <span className="rpt-step-label rpt-step-label-refusal">
            Шаг {step + 1} / {total}
          </span>
        </div>

        <h3 className="rpt-title">{current.title}</h3>
        <p className="rpt-text">{current.text}</p>

        <StepDots total={total} current={step} />

        <div className="rpt-actions">
          {!isFirst && (
            <button className="rpt-btn rpt-btn-back" onClick={() => goToStep(step - 1)}>
              ← Назад
            </button>
          )}
          <div style={{ flex: 1 }} />
          {/* <button className="rpt-btn rpt-btn-skip" onClick={skip}>
            Пропустить
          </button> */}
          {isLast ? (
            <button className="rpt-btn rpt-btn-finish rpt-btn-finish-refusal" onClick={finish}>
              Понятно, начинаем ✓
            </button>
          ) : (
            <button className="rpt-btn rpt-btn-next" onClick={() => goToStep(step + 1)}>
              Далее →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
