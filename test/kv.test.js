import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStored } from '../api/_lib/kv.js';

test('parseStored reads raw JSON, including values with % signs', () => {
  assert.deepEqual(parseStored('{"definition":"100% sure"}'), { definition: '100% sure' });
});

test('parseStored reads URL-encoded JSON from the old path-style writes', () => {
  const encoded = encodeURIComponent(JSON.stringify({ word: 'Kaffee', definition: 'a & b / c' }));
  assert.deepEqual(parseStored(encoded), { word: 'Kaffee', definition: 'a & b / c' });
});

test('parseStored throws on garbage so callers can skip the entry', () => {
  assert.throws(() => parseStored('not json %'));
});
