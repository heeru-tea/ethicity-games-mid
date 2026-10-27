// 규칙 기반 판정 — 기획서 §5·§7.5와 spec §5.4의 설계 확인 사례
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
const m1 = require('../missions/m1.js');
const tutorial = require('../missions/tutorial.js');
const { judge, missingLines } = require('../js/judge.js');

const bagOf = (counts) => Object.entries(counts).flatMap(([key, n]) => Array.from({ length: n }, (_, i) => ({ id: key + i, key })));
const ALL2 = { day_deep: 2, day_shallow: 2, day_wet: 2, day_dry: 2, night_wet: 2, night_neon: 2, night_deep: 2, night_shallow: 2, night_muddy: 2 };
const q = (id, assigned) => ({ id, ambiguousId: id, assigned });

test('common cards only: S1 passes, S2-S4 fail', () => {
  const r = judge(m1, bagOf({ day_deep: 15, day_shallow: 15 }), cfg);
  assert.deepEqual(r.scenes.map((s) => s.pass), [true, false, false, false]);
});

test('normal-only bag still fails S4 as danger', () => {
  const s4 = judge(m1, bagOf({ day_wet: 6, day_dry: 6, night_wet: 6, night_neon: 3 }), cfg).scenes[3];
  assert.equal(s4.pass, false);
  assert.equal(s4.failKind, 'danger');
});

test('equal per type without boundary cards fails S3 and S4', () => {
  const r = judge(m1, bagOf({ day_deep: 3, day_shallow: 3, day_wet: 3, day_dry: 3, night_wet: 3, night_deep: 3, night_shallow: 3 }), cfg);
  assert.deepEqual(r.scenes.map((s) => s.pass), [true, true, false, false]);
  assert.deepEqual(r.scenes[2].missing, ['S3_night_neon']);
});

test('ordinary boundary cards fill boundary combos (user choice 나)', () => {
  assert.equal(judge(m1, bagOf(ALL2), cfg).allPass, true);
});

test('correct ambiguous card counts double', () => {
  const b = bagOf({ ...ALL2, night_muddy: 0 }).concat([q('q_muddy', 'flood_shallow')]);
  assert.equal(judge(m1, b, cfg).allPass, true);
});

test('mislabeled ambiguous fills nothing and is reported', () => {
  const r = judge(m1, bagOf({ ...ALL2, night_neon: 0 }).concat([q('q_neon', 'flood_deep')]), cfg);
  assert.equal(r.scenes[2].pass, false);
  assert.deepEqual(r.mislabeled, ['q_neon']);
});

test('excluded or undecided ambiguous is ignored', () => {
  for (const a of [null, undefined]) assert.deepEqual(judge(m1, bagOf({ day_deep: 2 }).concat([q('q_clean', a)]), cfg).mislabeled, []);
});

test('q_clean labelled wet fills S2_day_wet', () => {
  assert.equal(judge(m1, bagOf({ day_dry: 2 }).concat([q('q_clean', 'wet')]), cfg).scenes[1].pass, true);
});

test('flood missing beats normal missing for failKind', () => {
  assert.equal(judge(m1, bagOf({ night_wet: 2 }), cfg).scenes[3].failKind, 'danger');
});

test('only normal combos missing gives inconvenience', () => {
  assert.equal(judge(m1, bagOf({ night_deep: 2 }), cfg).scenes[2].failKind, 'inconvenience');
});

test('passing scene has no failKind', () => {
  const s1 = judge(m1, bagOf({ day_deep: 2, day_shallow: 2 }), cfg).scenes[0];
  assert.equal(s1.pass, true);
  assert.equal(s1.failKind, null);
  assert.deepEqual(s1.missing, []);
});

test('empty bag: all fail, no throw', () => {
  const r = judge(m1, [], cfg);
  assert.equal(r.allPass, false);
  assert.equal(r.scenes.length, 4);
});

test('tutorial: 8 dogs 2 cats fails, 3 and 3 passes', () => {
  assert.equal(judge(tutorial, bagOf({ dog: 8, cat: 2 }), cfg).allPass, false);
  assert.equal(judge(tutorial, bagOf({ dog: 3, cat: 3 }), cfg).allPass, true);
});

test('missingLines follows scene order', () => {
  const r = judge(m1, bagOf({ day_deep: 2, day_shallow: 2 }), cfg);
  assert.equal(missingLines(m1, r)[0], m1.scenes[1].combos[0].missingLine);
});

test('missingLines does not repeat a shared line', () => {
  const lines = missingLines(m1, judge(m1, [], cfg));
  assert.equal(lines.length, new Set(lines).size);
});
