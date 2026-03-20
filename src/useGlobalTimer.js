/**
 * useGlobalTimer.js
 *
 * Онлайн:  таймер тикает на СЕРВЕРЕ → timer:tick через WS → обновляет стор.
 *          Локальный setInterval НЕ тикает — только проверяет связь.
 *
 * Оффлайн: нет WS (мок/нет бэка) → локальный setInterval тикает как раньше.
 *
 * ФИКС: убран startGlobalTimer() из mount-эффекта.
 * Состояние isRunning приходит с сервера через onFullState/onTimerState/onTimerTick.
 * Принудительный запуск при монтировании конфликтовал с серверным состоянием
 * и ломал таймер после обновления страницы.
 */

import { useEffect, useRef } from 'react';
import useGameStore from '../store/gameStore';
import { getSocket } from './apiHelpers';

export const YEAR_DURATIONS_SEC = {
  1: 25 * 60, 2: 20 * 60, 3: 15 * 60, 4: 15 * 60, 5: 10 * 60,
  6: 15 * 60, 7: 15 * 60, 8: 15 * 60, 9: 10 * 60, 10: 10 * 60,
};
export const REGION_MAP_DURATION_SEC = 20 * 60;

export default function useGlobalTimer() {
  const intervalRef = useRef(null);

  // ФИКС: убрали startGlobalTimer из деструктуризации — не вызываем при монтировании.
  // Если нет WS — tickGlobalTimer сам проверяет isRunning/isPaused внутри.
  const { globalTimer, tickGlobalTimer, stopGlobalTimer } = useGameStore();

  useEffect(() => {
    // НЕ вызываем startGlobalTimer() здесь.
    // В онлайн-режиме isRunning выставляет сервер через onFullState / onTimerTick.
    // В оффлайн-режиме tickGlobalTimer() проверяет isRunning внутри и не тикает
    // пока флаг не выставлен (например, AdminPanel запускает таймер вручную).

    intervalRef.current = setInterval(() => {
      // Проверяем: есть ли живой WS-коннект к серверу?
      const socket = getSocket();
      const isServerConnected = socket?.connected === true;

      if (!isServerConnected) {
        // Оффлайн / мок-режим — считаем время локально
        tickGlobalTimer();
      }
      // Онлайн — ничего не делаем.
      // timer:tick из useSocket.js обновляет стор напрямую,
      // и timeRemaining берётся с сервера — у всех одинаковое.
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // stopGlobalTimer только в оффлайн-режиме имеет смысл,
      // но оставляем для чистоты — в онлайне сервер всё равно главный.
      stopGlobalTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return globalTimer;
}