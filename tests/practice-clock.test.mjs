import test from 'node:test';
import assert from 'node:assert/strict';
import { activeClock } from '../lesson/active.js';

const fake = () => {
  let t = 1e12;
  return { now: () => t, go: (ms) => { t += ms; } };
};

test('counts steady playing', () => {
  const f = fake();
  const c = activeClock({ now: f.now });
  c.start();
  for (let i = 0; i < 60; i++) { f.go(1000); c.tick(); }
  assert.equal(c.stop(), 60);
});

test('a device asleep for days adds nothing', () => {
  const f = fake();
  const c = activeClock({ now: f.now });
  c.start();
  for (let i = 0; i < 30; i++) { f.go(1000); c.tick(); }
  f.go(3 * 864e5);
  assert.equal(c.stop(), 30);
});

test('stops counting, and says so, after minutes without a touch', () => {
  const f = fake();
  const c = activeClock({ now: f.now, idle: 5 * 60e3 });
  c.start();
  let going = true;
  let n = 0;
  while (going && n < 3600) { f.go(1000); going = c.tick(); n++; }
  assert.equal(going, false);
  assert.equal(c.stop(), 300);
});

test('touches keep it counting', () => {
  const f = fake();
  const c = activeClock({ now: f.now, idle: 5 * 60e3 });
  c.start();
  for (let i = 0; i < 600; i++) { f.go(1000); if (i % 120 === 0) c.touch(); assert.ok(c.tick()); }
  assert.equal(c.stop(), 600);
});
