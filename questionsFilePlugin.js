// Vite dev-плагин: даёт фронту читать и писать src/question.json во время
// `npm run dev`. Нужен, пока нет бэка с БД — добавленные/изменённые вопросы
// сохраняются прямо в файл. В production-сборке плагина нет: фронт тогда
// работает в режиме «только чтение» (статический импорт question.json).
//
// Маршруты:
//   GET /__questions  → содержимое src/question.json (как есть)
//   PUT /__questions  → перезаписывает src/question.json телом запроса
//
// Плагин намеренно «тупой»: вся доменная логика (маппинг, нумерация, пометка
// правильного ответа) живёт в src/Questions/questionsApi.js.

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUESTIONS_FILE = resolve(__dirname, 'src/question.json');
const ROUTE = '/__questions';

const readBody = (req) => new Promise((res, rej) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => res(data));
    req.on('error', rej);
});

const sendJson = (res, status, payload) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
};

export default function questionsFilePlugin() {
    return {
        name: 'questions-file-plugin',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const url = (req.url || '').split('?')[0];
                if (url !== ROUTE) return next();

                try {
                    if (req.method === 'GET') {
                        const raw = await readFile(QUESTIONS_FILE, 'utf-8');
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json; charset=utf-8');
                        res.end(raw);
                        return;
                    }

                    if (req.method === 'PUT') {
                        const body = await readBody(req);
                        // Проверяем, что прислали валидный JSON, прежде чем писать на диск.
                        const parsed = JSON.parse(body);
                        await writeFile(QUESTIONS_FILE, JSON.stringify(parsed, null, 1), 'utf-8');
                        sendJson(res, 200, { success: true });
                        return;
                    }

                    sendJson(res, 405, { error: 'Method Not Allowed' });
                } catch (e) {
                    sendJson(res, 500, { error: e.message });
                }
            });
        },
    };
}
