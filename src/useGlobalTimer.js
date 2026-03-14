// useGlobalTimer.js
// Единственный источник тика для глобального таймера.
// Подключается ОДИН РАЗ на верхнем уровне приложения (App.jsx или GameRoot).
// Все компоненты только читают globalTimer из store — не создают своих интервалов.
//
// Таймеры по годам (минуты):
//   RegionMap — отдельный, хранится в REGION_MAP_DURATION
//   НИР + События + Полевые + Результаты — одно общее время на год из YEAR_DURATIONS
//
// Когда бэк будет готов — заменить YEAR_DURATIONS и REGION_MAP_DURATION на значения
// из sessionConfig, полученного при joinSession. Store уже хранит эти поля в
// globalTimer.yearDurations / globalTimer.regionMapDuration — просто заполни их
// при инициализации сессии через setSessionTimers().

import { useEffect, useRef } from 'react';
import useGameStore from '../store/gameStore';

// ── Дефолтные значения (минуты → секунды) ────────────────────────────────────
// Когда придёт конфиг с бэка — передавай их через setSessionTimers()
export const YEAR_DURATIONS_SEC = {
  1: 25 * 60,
  2: 20 * 60,
  3: 15 * 60,
  4: 15 * 60,
  5: 10 * 60,
  6: 15 * 60,
  7: 15 * 60,
  8: 15 * 60,
  9: 10 * 60,
  10: 10 * 60,
};

export const REGION_MAP_DURATION_SEC = 20 * 60;

// ── Хук ───────────────────────────────────────────────────────────────────────
export default function useGlobalTimer() {
  const intervalRef = useRef(null);

  const {
    globalTimer,
    tickGlobalTimer,
    startGlobalTimer,
    stopGlobalTimer,
  } = useGameStore();

  // Запускаем один интервал при монтировании, чистим при размонтировании
  useEffect(() => {
    startGlobalTimer();

    intervalRef.current = setInterval(() => {
      tickGlobalTimer();
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      stopGlobalTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // При смене года — таймер уже сброшен через advanceToNextYear / setYear в store,
  // интервал продолжает тикать без перезапуска.

  return globalTimer;
}