# headcarbonat-gpn — Frontend

Фронтенд командной деловой игры «Курс на карбонаты» (Газпромнефть).
Команды участвуют в аукционе лицензионных участков, ведут буровые работы, исследования и управляют бюджетом в реальном времени.

---

## Стек

| Технология | Версия | Назначение |
|---|---|---|
| React | 19 | UI |
| Vite | 7 | Сборка и dev-сервер |
| Zustand | 5 | Глобальное состояние |
| Socket.io-client | 4.8 | Real-time связь с бэком |
| CSS Modules / plain CSS | — | Стили (без фреймворка) |

---

## Быстрый старт

```bash
npm install
npm run dev        # dev-сервер на http://localhost:5173
npm run build      # продакшн-сборка в dist/
npm run preview    # превью сборки
npm run lint       # ESLint
```

---

## Переменные окружения

Создать файл `.env` в корне проекта:

```env
VITE_API_BASE_URL=http://localhost:3001/api   # базовый URL REST API
VITE_WS_URL=http://localhost:3001             # URL WebSocket-сервера
```

> Для прода заменить `localhost:3001` на адрес сервера.

---

## Структура `src/`

```
src/
├── main.jsx                  # Точка входа React
├── App.jsx                   # Корневой компонент, роутинг по фазам игры
├── apiHelpers.js             # REST-запросы + Socket singleton (connectSocket, adminFetch и др.)
├── useSocket.js              # React-хук для подключения к сокету
├── socketHandlers.js         # Обработчики входящих WS-событий
├── useGlobalTimer.js         # Хук глобального таймера
│
├── Adminpanel.jsx            # Панель администратора (управление сессиями, фазами, таймерами)
├── GameBoard.jsx             # Главный экран игры (переключает компоненты по фазе)
├── GameLobby.jsx             # Экран лобби (вход в сессию)
├── Budgetbar.jsx             # Строка бюджета команды
├── LUSelectionMap.jsx        # Карта выбора лицензионных участков
│
├── Events/                   # Фаза событий
│   ├── EventsZone.jsx
│   └── Eventsdata.js
│
├── FieldWork/                # Фаза полевых работ
│   ├── FieldWorkPanel.jsx
│   └── Fieldworkdata.js
│
├── Research/                 # Фаза НИР
│   ├── ResearchPanel.jsx
│   ├── RefusalMap.jsx        # Карта отказа от ЛУ
│   ├── ResultsOverlay.jsx
│   └── researchData.js
│
├── Results/                  # Фаза результатов
│   └── ResultsPanel.jsx
│
├── RegionMap/                # Карта региона + аукцион
│   ├── RegionMap.jsx
│   └── Auctiondashboard.jsx
│
├── GameOver/                 # Финальный экран
│   └── GameOverScreen.jsx
│
└── assets/
    └── cards/
        ├── opportunity/      # Карты возможностей (27 шт.)
        ├── random/           # Случайные карты (31 шт.)
        └── Risk/             # Карты рисков (49 шт.)
```

---

## Глобальное состояние

Стор находится в `store/gameStore.jsx` (Zustand).
Содержит: данные сессии, команды, фазу игры, ЛУ, аукцион, таймер, бюджет.

---

## Взаимодействие с бэком

### REST (через `apiHelpers.js`)

| Функция | Метод | Endpoint |
|---|---|---|
| `getSessionByCode` | GET | `/sessions/by-code/:code` |
| `joinSession` | POST | `/sessions/join` |
| `getSessionStatus` | GET | `/sessions/:id/status` |
| `adminLogin` | POST | `/admin/login` |
| `getAdminSessions` | GET | `/admin/sessions` |
| `createSession` | POST | `/admin/sessions` |
| `deleteSession` | DELETE | `/admin/sessions/:id` |
| `getGameConfig` | GET | `/admin/config` |
| `updateGameConfig` | PUT | `/admin/config` |

### WebSocket (Socket.io)

Подключение: `connectSocket(token, sessionId)` из `apiHelpers.js`.

**Emit (фронт → бэк):**
- `state:sync` — запросить полное состояние
- `auction:bid` — сделать ставку
- `research:save`, `events:save`, `fieldwork:save`, `result:save` — сохранить прогресс

**On (бэк → фронт):**
- `state:full` — полный снимок состояния
- `auction:created/updated/bid/finalized/cancelled`
- `cells:updated` — обновление карты ЛУ
- `timer:tick/state/expired`
- `session:started/finished`
- `team:joined/offline`
- `game:over`

---

## Фазы игры

```
LOBBY → REGION_MAP_SELECTION → REGION_MAP_AUCTION → REGION_MAP_POST_AUCTION → RESEARCH → ...
```

`GameBoard.jsx` рендерит нужный компонент в зависимости от текущей фазы из стора.

---

## Авторизация администратора

Токен хранится в `localStorage` под ключом `auth_token`.
После `adminLogin` токен подставляется в заголовок `Authorization: Bearer <token>` всех admin-запросов.
