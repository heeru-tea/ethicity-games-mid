// 버스 왕복 시각표·공차 검증
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
const G = require('../js/graph.js');
const S = require('../js/schedule.js');

const T = true, F = false;
const g1 = G.build(cfg, 1);
const brief = (tl, n) => tl.visits.slice(0, n).map((v) => [v.t, v.node, v.kind, v.runIn, v.runOut]);

test('route from A has no deadhead (AC7)', () => {
  const tl = S.timeline(g1, cfg, 1, { nodes: ['A', 'B', 'C'], stops: [T, T, T] }, 0);
  assert.deepEqual(brief(tl, 5), [
    [0, 'A', 'stop', -1, 0], [3, 'B', 'stop', 0, 0], [6, 'C', 'stop', 0, 1], [9, 'B', 'stop', 1, 1], [12, 'A', 'stop', 1, 2]
  ]);
  assert.equal(tl.segments.filter((s) => s.deadhead).length, 0);
  assert.equal(tl.routeId, 'A-B-C');
  assert.equal(tl.opMinutes, 120);
});

test('deadhead to first endpoint (AC7)', () => {
  const tl = S.timeline(g1, cfg, 2, { nodes: ['F', 'C', 'D', 'A'], stops: [T, T, T, T] }, 4);
  const dh = tl.segments.filter((s) => s.deadhead);
  assert.deepEqual(dh.map((s) => [s.from, s.to, s.t0, s.t1]), [['A', 'B', 4, 6], ['B', 'F', 6, 10]]);
  assert.deepEqual(tl.visits[0], { t: 10, node: 'F', kind: 'stop', runIn: -1, runOut: 0 });
  assert.equal(tl.opMinutes, 116);
  const moved = tl.segments.reduce((s, x) => s + Math.max(0, Math.min(x.t1, 120) - Math.max(x.t0, 0)), 0);
  assert.equal(tl.moveMinutes, moved);
  assert.ok(tl.moveMinutes >= 6);
});

test('pass node has no dwell', () => {
  const tl = S.timeline(g1, cfg, 1, { nodes: ['A', 'B', 'C'], stops: [T, F, T] }, 0);
  assert.deepEqual(brief(tl, 5).map((v) => [v[0], v[1], v[2]]), [[0, 'A', 'stop'], [3, 'B', 'pass'], [5, 'C', 'stop'], [8, 'B', 'pass'], [10, 'A', 'stop']]);
});

test('clipped at 120', () => {
  const tl = S.timeline(g1, cfg, 1, { nodes: ['A', 'B', 'C'], stops: [T, T, T] }, 0);
  assert.ok(tl.visits.every((v) => v.t <= 120));
  assert.equal(tl.visits[tl.visits.length - 1].t, 120); // 주기 12 → 120분에 A 도착
  // 오프셋 4: 120분에 도로 중간이면 그 분까지만 이동 시간
  const tl4 = S.timeline(g1, cfg, 1, { nodes: ['A', 'B', 'C'], stops: [T, T, T] }, 4);
  const last = tl4.segments[tl4.segments.length - 1];
  assert.ok(last.t0 < 120);
  assert.equal(tl4.moveMinutes, tl4.segments.reduce((s, x) => s + Math.max(0, Math.min(x.t1, 120) - x.t0), 0));
  assert.ok(tl4.moveMinutes <= 116);
});

test('unassigned bus parks at A', () => {
  const tl = S.timeline(g1, cfg, 3, null, 0);
  assert.deepEqual([tl.visits.length, tl.segments.length, tl.opMinutes, tl.moveMinutes, tl.routeId], [0, 0, 0, 0, null]);
  assert.deepEqual(S.positionAt(tl, cfg, 50), { node: 'A', parked: true });
});

test('positionAt interpolates segments and parks before departure', () => {
  const tl = S.timeline(g1, cfg, 2, { nodes: ['F', 'C', 'D', 'A'], stops: [T, T, T, T] }, 4);
  assert.deepEqual(S.positionAt(tl, cfg, 2), { node: 'A', parked: true });
  const mid = S.positionAt(tl, cfg, 8);
  assert.equal(mid.from, 'B'); assert.equal(mid.to, 'F'); assert.equal(mid.f, 0.5); assert.equal(mid.parked, false);
  assert.deepEqual(S.positionAt(tl, cfg, 10.5), { node: 'F', parked: false });
});
