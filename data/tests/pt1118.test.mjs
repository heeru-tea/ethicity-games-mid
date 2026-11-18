// 3·4 임무 플레이테스트 수정(2026-11-18, docs/feedback/2026-11-18-playtest-m3-m4.md) — 판정은 그대로, 보이는 문구·흐름만
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
const { judge } = require('../js/judge.js');
const Conveyor = require('../js/conveyor.js');
const m3 = require('../missions/m3.js');

const bagOf = (counts) => Object.entries(counts).flatMap(([key, n]) => Array.from({ length: n }, (_, i) => ({ id: key + i, key })));
const fk = (id, n) => Array.from({ length: n }, (_, i) => ({ id: id + '_' + i, fakeId: id }));
const ALL = { station_now: 2, station_rain: 2, market_now: 2, market_old: 1, market_eve_old: 2, river_now: 2, river_night: 2, crossing_now: 2, crossing_rain: 2 };
const guideOf = (bag) => { const r = judge(m3, bag, cfg); return { r, items: Conveyor.sort(m3, r, m3.guide) }; };
const byId = (items, id) => items.filter((x) => x.id === id)[0];
const g = (id) => m3.guide.filter((x) => x.id === id)[0];
const OLD = /철거|옛|예전 사진/;

/* P0-1 3 임무: 부족이 원인인데 옛 사진이 남은 것처럼 보이던 시연·배지 */
test('P0-1 재현 경로: 옛 역 앞 사진 없이 지금 광장 1장 → 시연·배지가 "부족"으로 읽힌다', () => {
  const { r, items } = guideOf(bagOf({ ...ALL, station_now: 1 }));
  const s1 = r.scenes.filter((s) => s.id === 'S1')[0];
  assert.equal(s1.pass, false); assert.deepEqual(s1.missing, ['S1_station_now']); assert.equal((s1.contaminated || []).length, 0);
  const it = byId(items, 'g1');
  assert.equal(it.correct, false);
  assert.equal(it.causeKind, 'short');
  const t = Conveyor.guideText(g('g1'), it);
  assert.notEqual(t.wrong, g('g1').wrong); assert.notEqual(t.note, g('g1').note);
  assert.ok(!/철거/.test(t.note), 'note does not blame a demolished building: ' + t.note);
  assert.match(t.note, /지금 광장 사진이 적어서/);
  assert.equal(Conveyor.outcomeKey(m3, s1), 'inconvenienceShort');
  assert.ok(!/옛길/.test(m3.outcomeText.inconvenienceShort));
});

test('P0-1 오염(철거 전 빌딩 2장 남음): 시연·배지는 예전 문구 그대로', () => {
  const { r, items } = guideOf(bagOf({ ...ALL }).concat(fk('o_station', 2)));
  const s1 = r.scenes.filter((s) => s.id === 'S1')[0];
  assert.ok(s1.contaminated.includes('o_station'));
  const it = byId(items, 'g1');
  assert.equal(it.causeKind, 'contam');
  assert.deepEqual({ ...Conveyor.guideText(g('g1'), it) }, { wrong: g('g1').wrong, note: g('g1').note });
  assert.equal(Conveyor.outcomeKey(m3, s1), 'inconvenience');
  // 부족 + 오염이 함께면 오염 문구(옛 사진이 실제로 남아 있으니)
  const both = guideOf(bagOf({ ...ALL, station_now: 1 }).concat(fk('o_station', 2)));
  assert.equal(byId(both.items, 'g1').causeKind, 'contam');
  assert.equal(Conveyor.guideText(g('g1'), byId(both.items, 'g1')).note, g('g1').note);
});

test('P0-1 강변길(g5)·학교 앞(g7)도 같은 구조 — 부족이면 부족 문구, 위험 판정·멈춤은 그대로', () => {
  const river = guideOf(bagOf({ ...ALL, river_now: 1 }));
  const g5 = byId(river.items, 'g5');
  assert.equal(g5.causeKind, 'short');
  assert.match(Conveyor.guideText(g('g5'), g5).note, /지금 강변길 사진이 적어서/);
  const cross = guideOf(bagOf({ ...ALL, crossing_now: 1 }));
  const g7 = byId(cross.items, 'g7'), s4 = cross.r.scenes.filter((s) => s.id === 'S4')[0];
  assert.equal(s4.failKind, 'danger'); assert.equal(g7.emergency, true, 'hazard stop unchanged');
  assert.equal(g7.causeKind, 'short');
  assert.match(Conveyor.guideText(g('g7'), g7).note, /지금 횡단보도 사진이 적어서/);
  assert.equal(Conveyor.outcomeKey(m3, s4), 'dangerShort');
  const old = guideOf(bagOf({ ...ALL }).concat(fk('o_crossing', 2)));
  const g7o = byId(old.items, 'g7');
  assert.equal(g7o.causeKind, 'contam');
  assert.equal(Conveyor.guideText(g('g7'), g7o).wrong, '육교로 건너세요.');
  assert.equal(Conveyor.outcomeKey(m3, old.r.scenes.filter((s) => s.id === 'S4')[0]), 'danger');
});

test('P0-1 판정·맞고 틀림·위험 멈춤은 고치기 전과 같다(무작위 가방) · 맞은 질문은 원인 없음', () => {
  const keys = Object.keys(m3.counts), fakes = m3.fakes.map((f) => f.id);
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let n = 0; n < 300; n++) {
    const counts = {}; for (const k of keys) counts[k] = Math.floor(rnd() * 4);
    const bag = bagOf(counts); for (const f of fakes) bag.push(...fk(f, Math.floor(rnd() * 3)));
    const { r, items } = guideOf(bag);
    for (const it of items) {
      // 고치기 전 규칙: 원인 중 하나라도 일어났으면 틀림
      const src = m3.guide.filter((x) => x.id === it.id)[0];
      assert.equal(it.correct, !src.causes.some((c) => Conveyor.happened(r, c, src.scene)));
      if (it.correct) assert.equal(it.causeKind, null);
      else assert.ok(it.causeKind === 'short' || it.causeKind === 'contam');
    }
  }
});

test('P0-1 새 문구는 짧고 이모지·%·— 없음', () => {
  const BAD = /[—%]|\p{Extended_Pictographic}/u;
  for (const id of ['g1', 'g5', 'g7']) for (const k of ['wrongShort', 'noteShort']) { assert.ok(g(id)[k], id + k); assert.ok(!BAD.test(g(id)[k])); assert.ok(g(id)[k].length <= 60, g(id)[k]); }
  for (const k of ['inconvenienceShort', 'dangerShort']) assert.ok(m3.outcomeText[k] && !OLD.test(m3.outcomeText[k]), k);
});
