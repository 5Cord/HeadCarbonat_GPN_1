import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CASE_INTRO, PIPELINE_START_MESSAGE, getCaseIntroParagraphs } from '../src/RegionMap/caseIntro.js';

test('стандартный кейс показывает новое сообщение один раз в начале', () => {
  const paragraphs = getCaseIntroParagraphs();
  assert.equal(paragraphs[1], PIPELINE_START_MESSAGE);
  assert.equal(paragraphs.filter(p => p.includes(PIPELINE_START_MESSAGE)).length, 1);
  assert.ok(paragraphs.includes('В районе нет нефтяной инфраструктуры.'));
  assert.deepEqual(paragraphs, DEFAULT_CASE_INTRO.paragraphs);
});

test('старый текст сессии сохраняет остальные сообщения и не показывает старый маршрут', () => {
  const paragraphs = getCaseIntroParagraphs([
    'В стране растёт интерес компаний к новому потенциально нефтеносному району.',
    'Другое сообщение.',
    'В районе нет нефтяной инфраструктуры. Нефтепровод можно проложить через участки материнской компании с запада на восток.',
  ]);
  assert.deepEqual(paragraphs, [
    'В стране растёт интерес компаний к новому потенциально нефтеносному району.',
    PIPELINE_START_MESSAGE,
    'Другое сообщение.',
    'В районе нет нефтяной инфраструктуры.',
  ]);
});

test('при повторном открытии кейса новое сообщение не дублируется', () => {
  const once = getCaseIntroParagraphs(DEFAULT_CASE_INTRO.paragraphs);
  assert.deepEqual(getCaseIntroParagraphs(once), once);
});
