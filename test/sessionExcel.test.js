import test from 'node:test';
import assert from 'node:assert/strict';
import writeExcelFile from 'write-excel-file/node';
import { buildSessionExcelSheets } from '../src/admin/sessionExcel.js';

const report = {
  sessionId: 'session-1', sessionCode: 'ABC123',
  teams: [
    {
      teamId: 'team-1', teamName: 'Команда Север', totalPoints: 18,
      members: [{ name: 'Анна', role: 'Геолог' }, { name: 'Игорь', role: 'Экономист' }],
      initialBudget: 20000, finalBudget: 17000, budgetSpent: 3500, totalIncome: 500,
      cells: [{ cellRef: 'C5', auctionPrice: 350 }], cellsCount: 1,
      totalROI: 120, eventStats: { correctAnswers: 3 },
      metrics: { grr: { value: 100 }, stage2: { value: 70 }, stage3: { value: 50 },
        extraCosts: { value: 850 }, answerAccuracy: { value: 75, correct: 3, answered: 4 } },
      ranking: { grr: { points: 4 }, stage2: { points: 4 }, stage3: { points: 4 },
        extraCosts: { points: 3 }, answerAccuracy: { points: 3 } },
      spentByType: { auction: 350, fieldwork: 3150 },
      researchByYear: [{ luId: 'C5', year: 2, columnId: 'srr_2d', skipped: false }],
      fieldworkByYear: [{ luId: 'C5', year: 2, totalCost: 200, qualityScore: 3 }],
      transactions: [{ type: 'auction', amount: -350, description: 'Участок C5', createdAt: 1763000000 }],
    },
    {
      teamId: 'team-2', teamName: 'Команда Юг', totalPoints: 10,
      members: ['Мария'], initialBudget: 20000, finalBudget: 20000,
      budgetSpent: 0, totalIncome: 0, cells: [], cellsCount: 0,
      metrics: { answerAccuracy: { value: null, correct: 0, answered: 0 } },
      spentByType: {}, researchByYear: [], fieldworkByYear: [], transactions: [],
    },
  ],
};

test('Excel export contains the selected session, members, financial values and a real XLSX', async () => {
  const sheets = buildSessionExcelSheets(report,
    { id: 'session-1', code: 'ABC123', status: 'finished', created_at: 1762900000 });
  assert.equal(sheets.length, 7);
  assert.deepEqual(sheets.map(sheet => sheet.sheet), [
    'Сводка', 'Участники', 'Рейтинг', 'Финансы', 'Участки', 'Работы по годам', 'Денежные операции',
  ]);
  assert.equal(sheets[0].data[1][1], 'ABC123');
  assert.equal(sheets[0].data[3][3], 3);
  assert.equal(sheets[0].data[7][9].value, 3);
  assert.equal(sheets[0].data[7][10].value, 4);
  assert.equal(sheets[1].data[1][2].value, 'Анна');
  assert.equal(sheets[1].data[1][3].value, 'Геолог');
  assert.equal(sheets[2].data[1][12].value, 18);
  assert.equal(sheets[3].data[1][3].value, 350);
  assert.equal(sheets[4].data[1][1].value, 'C5');
  assert.equal(sheets[6].data[1][4].value, 350);

  const buffer = await writeExcelFile(sheets).toBuffer();
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  assert.ok(buffer.length > 1000);
});

test('Excel export refuses data from a different session', () => {
  assert.throws(() => buildSessionExcelSheets(report, { id: 'session-2' }),
    /не соответствуют выбранной сессии/);
});

test('Excel export still opens for a session without teams', async () => {
  const sheets = buildSessionExcelSheets({ sessionId: 'empty', sessionCode: 'EMPTY', teams: [] },
    { id: 'empty', status: 'waiting' });
  assert.equal(sheets[0].data[3][1], 0);
  assert.equal(sheets[1].data.length, 1);
  const buffer = await writeExcelFile(sheets).toBuffer();
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
});
