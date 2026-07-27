import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import questionsFilePlugin from './questionsFilePlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), questionsFilePlugin()],
  // ВАЖНО: question.json НЕ игнорируем в watcher — иначе игра (статический импорт
  // в Eventsdata.js) «замораживается» на версии файла на момент старта dev-сервера
  // и не видит добавленные через админку вопросы. Цена — после сохранения вопроса
  // страница перезагрузится, зато новый вопрос сразу попадает в игровой пул.
})
