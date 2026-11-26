'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./frontend-fixture');

test('Bikram Sambat converter round-trips known and generated dates', () => {
  const app = createApp();
  assert.equal(app.call('bsToGregorian', 2081, 4, 9), '2024-07-24');
  assert.equal(app.call('gregorianToBsString', '2024-07-24'), '2081-04-09');

  for (let year = 2080; year <= 2085; year++) {
    for (let month = 1; month <= 12; month++) {
      for (const day of [1, 15, app.call('bsDaysInMonth', year, month)]) {
        const gregorian = app.call('bsToGregorian', year, month, day);
        const expected = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        assert.equal(app.call('gregorianToBsString', gregorian), expected);
      }
    }
  }
});

test('monthly reminders with a BS anchor stay on the BS day', () => {
  const app = createApp();
  const reminder = {
    calendar: 'bs', bsDate: '2083-05-15', date: '2026-08-31',
    time: '09:00', repeat: 'monthly', enabled: true
  };

  assert.match(app.call('reminderScheduleLabel', reminder), /Monthly on 15 Bhadra · 9:00 AM/);

  const first = app.call('nextReminderDate', reminder, new Date(2026, 7, 1, 0, 0));
  assert.equal(first.getFullYear(), 2026);
  assert.equal(first.getMonth(), 7);
  assert.equal(first.getDate(), 31);
  assert.equal(first.getHours(), 9);

  const second = app.call('nextReminderDate', reminder, new Date(2026, 8, 1, 0, 0));
  assert.equal(second.getFullYear(), 2026);
  assert.equal(second.getMonth(), 9);
  assert.equal(second.getDate(), 1);
  assert.equal(second.getHours(), 9);
});

test('legacy reminders without BS metadata keep Gregorian monthly behavior', () => {
  const app = createApp();
  const reminder = { date: '2026-12-20', time: '09:00', repeat: 'monthly' };
  assert.match(app.call('reminderScheduleLabel', reminder), /Monthly on 20 · 9:00 AM/);

  const next = app.call('nextReminderDate', reminder, new Date(2026, 10, 1, 0, 0));
  assert.equal(next.getFullYear(), 2026);
  assert.equal(next.getMonth(), 11);
  assert.equal(next.getDate(), 20);
});
