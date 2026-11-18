import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSetup } from '../lesson/codec.js';

test('sections keep a pickup and a cut end', () => {
  assert.deepEqual(cleanSetup({ sec: [['A', 2, 3, 240, 0], ['B', 5, 4, 0, 120]] }).sec, [['A', 2, 3, 240, 0], ['B', 4, 5, 0, 120]]);
});

test('plain sections stay three long, bad pickups are dropped', () => {
  assert.deepEqual(cleanSetup({ sec: [['A', 1, 4], ['B', 2, 3, 0, 0], ['C', 1, 2, -5, 0], ['D', 1, 2, 1.5, 0]] }).sec, [['A', 1, 4], ['B', 2, 3]]);
});
