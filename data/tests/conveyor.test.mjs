// 컨베이어 실제 분류(spec §5.5) — 같은 가방이면 늘 같은 결과, 빨간 물건은 늘 가방의 원인과 이어진다
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
const Rng = require('../js/rng.js');
const m2 = require('../missions/m2.js');
const { judge } = require('../js/judge.js');
const Conveyor = require('../js/conveyor.js');

const bagOf = (counts) => Object.entries(counts).flatMap(([key, n]) => Array.from({ length: n }, (_, i) => ({ id: key + i, key })));
const fakesOf = (id, n, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: id + '_' + i, fakeId: id, ...extra }));
const M2_ALL2 = { can_drink: 2, can_tin: 2, pet_clear: 2, pet_crushed: 2, vinyl_bag: 2, pack_milk: 2, paper_news: 2, trash_misc: 2, battery_aa: 2 };
const run = (bag) => Conveyor.sort(m2, judge(m2, bag, cfg));

test('all correct when nothing failed', () => {
  const out = run(bagOf(M2_ALL2));
  assert.equal(out.length, m2.conveyor.length);
  for (const it of out) {
    assert.equal(it.correct, true, it.id);
    assert.equal(it.bin, it.correctBin, it.id);
    assert.equal(it.cause, null, it.id);
    assert.equal(it.emergency, false, it.id);
  }
  assert.deepEqual(out.map((o) => o.id), m2.conveyor.map((c) => c.id));
});

test('every cause has an item', () => {
  const causes = new Set(m2.conveyor.flatMap((c) => c.causes));
  for (const s of m2.scenes) {
    for (const c of s.combos) assert.ok(causes.has(c.id), c.id);
    assert.ok(causes.has('contaminated:' + s.id), s.id);
  }
  for (const f of m2.fakes) assert.ok(causes.has(f.id), f.id);
});

test('deterministic', () => {
  const bag = bagOf({ ...M2_ALL2, can_tin: 0 }).concat(fakesOf('f_receipt', 2));
  assert.deepEqual(run(bag), run(bag));
});

test('receipt goes to paper when f_receipt contaminates', () => {
  const out = run(bagOf(M2_ALL2).concat(fakesOf('f_receipt', 2)));
  const receipt = out.find((o) => o.art === 'f_receipt');
  assert.equal(receipt.bin, 'paper');
  assert.equal(receipt.correct, false);
  assert.equal(receipt.cause, 'f_receipt');
  assert.ok(out.filter((o) => !o.correct).every((o) => o.scene === 'S3'));
});

test('missing battery stops the press', () => {
  const out = run(bagOf({ ...M2_ALL2, battery_aa: 0 }));
  const bad = out.filter((o) => !o.correct);
  assert.ok(bad.length >= 1);
  assert.ok(bad.every((o) => o.scene === 'S4'));
  assert.ok(bad.some((o) => o.emergency && o.bin === 'can'));
});

test("fake causes only count in the item's own scene", () => {
  // 건전지 가짜 1장(캔) + 음료 캔을 '건전지'로 잘못 고친 1장 → S4만 오염(S1은 캔 이름표 1장뿐)
  const bag = bagOf(M2_ALL2).concat(fakesOf('f_battery', 1), [{ id: 'x', key: 'can_drink', label: 'battery' }]);
  const r = judge(m2, bag, cfg);
  assert.equal(r.scenes[0].pass, true);
  assert.equal(r.scenes[3].pass, false);
  for (const o of Conveyor.sort(m2, r)) if (o.scene === 'S1') assert.equal(o.correct, true, o.id);
  assert.equal(Conveyor.happened(r, 'f_battery'), true);
  assert.equal(Conveyor.happened(r, 'f_battery', 'S1'), false);
});

test('passing scene items are all correct (random bags)', () => {
  const rng = Rng.create(42);
  const keys = Object.keys(m2.cardTypes), labels = m2.labels.map((l) => l.id);
  for (let n = 0; n < 50; n++) {
    const bag = [];
    for (let i = 0; i < 30; i++) {
      if (rng.next() < 0.2) bag.push({ id: 'f' + i, fakeId: m2.fakes[Math.floor(rng.next() * m2.fakes.length)].id });
      else bag.push({ id: 'k' + i, key: keys[Math.floor(rng.next() * keys.length)] });
      if (rng.next() < 0.1) bag[bag.length - 1].label = labels[Math.floor(rng.next() * labels.length)];
    }
    const r = judge(m2, bag, cfg);
    const pass = new Set(r.scenes.filter((s) => s.pass).map((s) => s.id));
    for (const o of Conveyor.sort(m2, r)) {
      if (pass.has(o.scene)) assert.equal(o.correct, true, n + ' ' + o.id);
      if (!o.correct) assert.ok(o.cause, o.id);
    }
  }
});
