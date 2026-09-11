import test from 'node:test';
import assert from 'node:assert/strict';
import { statusLabel, permittedActions, requestTimeline, eventDate, utcDate } from '../src/utils/exchanges.js';

test('stored states retain clear labels and closed exchanges expose no decision', () => {
  assert.equal(statusLabel('approved'), 'Accepted');
  assert.equal(statusLabel('rejected'), 'Declined');
  assert.equal(statusLabel('given'), 'Given');
  assert.deepEqual(permittedActions('pending', true), ['approved', 'rejected']);
  assert.deepEqual(permittedActions('pending', false), ['cancelled']);
  assert.deepEqual(permittedActions('approved', true), ['completed']);
  assert.deepEqual(permittedActions('approved', false), []);
  for (const state of ['completed', 'rejected', 'cancelled']) {
    assert.deepEqual(permittedActions(state, true), []);
    assert.deepEqual(permittedActions(state, false), []);
  }
});
test('UTC database timestamps retain the same instant in chat and timelines', () => {
  assert.equal(utcDate('2026-09-11T08:09:00').toISOString(), '2026-09-11T08:09:00.000Z');
  assert.equal(utcDate('2026-09-11T08:09:00Z').toISOString(), '2026-09-11T08:09:00.000Z');
  assert.equal(utcDate('2026-09-11T11:09:00+03:00').toISOString(), '2026-09-11T08:09:00.000Z');
});
test('timeline never fabricates historical acceptance or completion dates', () => {
  assert.deepEqual(requestTimeline({status: 'approved', request_date: '2026-01-01'}), [{status:'pending', at:'2026-01-01'}]);
  assert.deepEqual(requestTimeline({status: 'completed', request_date:'2026-01-01', accepted_at:'2026-01-02', completed_at:'2026-01-03'}).map(e => e.status), ['pending','approved','completed']);
  assert.deepEqual(requestTimeline({request_date: 'invalid'}), []);
  assert.equal(eventDate(null), 'Date unavailable');
});
