import assert from 'node:assert/strict';
import test from 'node:test';
import { recentIds, recordView, recommend } from '../src/utils/discovery.js';
import { findIntent } from '../src/utils/finder.js';
test('recent history is deduplicated, newest first, bounded and rejects malformed data', () => {
  assert.deepEqual(recordView([3, 2, 1], 2), [2, 3, 1]);
  assert.deepEqual(recentIds([1, '2', null, 1, -1, 2.3]), [1]);
  assert.equal(recentIds(Array.from({length: 30}, (_, i) => i + 1)).length, 15);
  assert.deepEqual(recentIds({}), []);
});
test('For You prioritizes actual interests, excludes own and unavailable listings', () => {
  const books = [
    {id:1, subject:'Science', grade:'7', status:'available', owner_id:2},
    {id:2, subject:'Science', grade:'7', status:'reserved', owner_id:2},
    {id:3, subject:'Science', grade:'7', status:'available', owner_id:1},
    {id:4, subject:'English', grade:'8', status:'available', owner_id:2},
    {id:5, subject:'Science', grade:'8', status:'available', owner_id:2},
  ];
  const results = recommend(books, {id:1, grade:'7'}, [books[0]], []);
  assert.deepEqual(results.map(item=>item.book.id), [1, 5, 4]);
  assert.equal(results[0].reason, 'Similar to books you saved');
  assert.equal(recommend(books, {id:1, grade:'7'}, [], [books[3]])[1].reason, 'Because you viewed English books');
});
test('Finder understands KG and exact numbered grades without number keywords', () => {
  assert.equal(findIntent('I want a book suitable for KG 2').grade, 'kg 2');
  assert.equal(findIntent('Science for Grade 1').grade, '1');
  assert.equal(findIntent('Science for Grade 10').grade, '10');
  assert.equal(findIntent('English reading practice').subject, 'english');
  assert.deepEqual(findIntent('books for KG 2').keywords, []);
});
