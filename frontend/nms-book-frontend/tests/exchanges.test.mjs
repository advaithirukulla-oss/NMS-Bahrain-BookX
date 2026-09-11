import test from 'node:test';
import assert from 'node:assert/strict';
import { statusLabel, permittedActions, requestTimeline, eventDate } from '../src/utils/exchanges.js';

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
test('timeline never fabricates historical acceptance or completion dates', () => {
  assert.deepEqual(requestTimeline({status: 'approved', request_date: '2026-01-01'}), [{status:'pending', at:'2026-01-01'}]);
  assert.deepEqual(requestTimeline({status: 'completed', request_date:'2026-01-01', accepted_at:'2026-01-02', completed_at:'2026-01-03'}).map(e => e.status), ['pending','approved','completed']);
  assert.deepEqual(requestTimeline({request_date: 'invalid'}), []);
  assert.equal(eventDate(null), 'Date unavailable');
});
