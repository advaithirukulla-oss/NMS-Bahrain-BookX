import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applySuggestion, smartError } from '../src/utils/smart.js';

test('applying one suggestion preserves every other field and never mutates the draft', () => {
  const draft = {title:'My title', subject:'English', grade:'7', description:'My own words'};
  const next = applySuggestion(draft, 'subject', 'Science');
  assert.deepEqual(next, {...draft, subject:'Science'});
  assert.equal(draft.subject, 'English');
  assert.equal(applySuggestion(draft, 'owner_id', '99'), draft);
});
test('provider/network failures and limits have safe actionable fallback copy', () => {
  assert.match(smartError(new Error('private provider detail')), /continue manually/);
  assert.doesNotMatch(smartError(new Error('secret')), /secret/);
  assert.match(smartError({response:{status:429}}), /wait a minute/);
});
test('general suggestions are plain ideas; real records use BookCard', () => {
  const source = readFileSync(new URL('../src/pages/AIBookFinder.jsx', import.meta.url), 'utf8');
  const general = source.slice(source.indexOf('<aside className="smart-general"'), source.indexOf('</aside>'));
  assert.doesNotMatch(general, /BookCard|Request|button/);
  assert.match(general, /not BookSpins listings/);
  assert.match(source, /<BookCard/);
});
