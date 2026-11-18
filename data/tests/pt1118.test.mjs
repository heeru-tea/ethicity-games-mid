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

/* P0-2 임무 고르기로 중간 임무부터 했을 때 도시 복구 — 구간은 '깬 임무' 기준(tutorial=보호소, m1=분실물, m2=분리배출, m3=역·횡단보도, m4=학교) */
import { boot, store } from './app-flow-helper.mjs';
const Save = require('../js/save.js');
const Look = require('../js/city-look.js');
const C = { cleared: true };

test('P0-2 구간 = 깬 임무 id, 숫자 = 깬 수/5', () => {
  assert.deepEqual([...Save.CITY_SECTIONS], ['tutorial', 'm1', 'm2', 'm3', 'm4']);
  assert.deepEqual(Save.citySections({ m3: C }), [3]);
  assert.deepEqual(Save.citySections({ tutorial: C, m3: C }), [0, 3]);
  assert.deepEqual(Save.citySections({ m4: C, m3: C, m2: { cleared: false } }), [3, 4]);
  assert.deepEqual(Save.citySections({ tutorial: C, m1: C, m2: C, m3: C, m4: C, flood: C }), [0, 1, 2, 3, 4]);
  assert.equal(Save.citySection('m3'), 3); assert.equal(Save.citySection('flood'), -1);
  assert.equal(Save.cityCount({ tutorial: C, m3: C }), 2);
  // 4 임무 = 이야기의 끝이라 화면은 늘 뜨지만, 숫자는 깬 수 그대로(전엔 늘 →5)
  assert.deepEqual(Save.cityStep('m4', 2, 3), { from: 2, to: 3 });
  assert.deepEqual(Save.cityStep('m4', 0, 1), { from: 0, to: 1 });
  assert.deepEqual(Save.cityStep('m4', 5, 5), { from: 4, to: 5 }, 'replaying m4 still shows its cell lighting up');
  assert.deepEqual(Save.cityStep('m3', 0, 1), { from: 0, to: 1 });
  assert.equal(Save.cityStep('m3', 2, 2), null);
});

test('P0-2 그림 겹: 왼쪽부터 차례로 켜진 경우만 예전 그림 두 장(city-from → city-to), 아니면 구간별', () => {
  assert.equal(Look.inOrder([0, 1, 2], 2), true, 'tutorial, m1, m2 in order');
  assert.equal(Look.inOrder([0], 0), true);
  assert.equal(Look.inOrder([3], 3), false, 'm3 only');
  assert.equal(Look.inOrder([0, 1, 2], 1), false, 'm1 played last after m2');
  assert.equal(Look.inOrder([0, 1, 2, 3, 4], 3), false);
  // 구간별: 새 구간(m3 = 4번째 칸)만 열리고, 케이블은 새 구간 왼쪽 끝에서 가운데까지(꺼진 구간 위로 안 지나감)
  const L = Look.sectionLayout([0, 3], 3, false);
  assert.ok(Math.abs(L.revealFrom - 0.6) < 1e-9 && Math.abs(L.revealTo - 0.8) < 1e-9);
  assert.ok(Math.abs(L.cableFrom - 0.6) < 1e-9 && Math.abs(L.cableTo - 0.7) < 1e-9);
  assert.deepEqual(L.others.map((o) => o.i), [0]);
  assert.ok(Math.abs(L.others[0].l - 0) < 1e-9 && Math.abs(L.others[0].r - 0.2) < 1e-9);
  const N = Look.sectionLayout([3], 3, true);
  assert.ok(N.revealFrom >= 0 && N.revealTo <= 1 && N.revealTo > N.revealFrom, 'new zone inside the narrow box');
  assert.equal(Look.sectionLayout([0, 1, 2, 3, 4], 3, false).final, true);
  const css = Look.sectionCss([0, 3], 3);
  for (const k of ['--city-pos-w', '--city-clip-l-w', '--city-clip-r-w', '--city-cable-left-w', '--city-cable-len-w', '--city-pos-n', '--city-clip-l-n']) assert.ok(css[k], k);
});

// 실제 흐름: 뒤 활동 이어하기(도시 복구 차례)에서 DR.UI.city에 넘기는 값
function cityOpts(records, mission, city) {
  const st = store();
  for (const [id, r] of Object.entries(records)) Save.setRecord(id, r, st);
  Save.setEnding({ mission, step: 4, city, peer: 'none', compare: null }, st);
  const g = boot(st);
  g.App.resumeEnding(g.Save.ending());
  assert.ok(g.ui.city, 'city screen shown');
  return g.ui.city[0];
}
test('P0-2 재현: 1·2 임무 없이 3 임무만 → 역·횡단보도 구간만, 도시 1/5 (연습 기록이 있으면 2/5)', () => {
  const o = cityOpts({ m3: C }, 'm3', { from: 0, to: 1 });
  assert.equal(o.to, 1); assert.deepEqual([...o.sections], [3]); assert.equal(o.add, 3);
  const t = cityOpts({ tutorial: C, m3: C }, 'm3', { from: 1, to: 2 });
  assert.equal(t.to, 2); assert.deepEqual([...t.sections], [0, 3]); assert.equal(t.add, 3);
});
test('P0-2 재현: 이어서 4 임무 → 도시 3/5(연습·3·4), 1·2 임무 구간은 꺼진 채', () => {
  const o = cityOpts({ tutorial: C, m3: C, m4: C }, 'm4', { from: 2, to: 3 });
  assert.equal(o.to, 3); assert.deepEqual([...o.sections], [0, 3, 4]); assert.equal(o.add, 4);
  // 고치기 전에 저장된 뒤 활동({from:2,to:5})으로 이어 해도 숫자는 깬 수
  const old = cityOpts({ tutorial: C, m3: C, m4: C }, 'm4', { from: 2, to: 5 });
  assert.equal(old.to, 3);
});

/* P0-3·P0-4 4 임무 결판 뒤 대사 — 실제 app.js 흐름(검수 → 감독관 → 채점 시연 → 결과 → 결판 대화) */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { root as DATA } from './app-flow-helper.mjs';
const m4 = require('../missions/m4.js');
// 모든 조합을 채우는 가방(종류마다 그 종류가 첫 열쇠인 조합들의 가장 큰 need)
function fullBag4() {
  const counts = {};
  for (const s of m4.scenes) for (const c of s.combos) counts[c.keys[0]] = Math.max(counts[c.keys[0]] || 0, c.need);
  return counts;
}
function toShowdown(counts, opts = {}) {
  const g = boot(store());
  vm.runInContext(fs.readFileSync(path.join(DATA, 'js/conveyor.js'), 'utf8'), g.ctx, { filename: 'js/conveyor.js' });
  const set = (n) => (...a) => { g.ui[n] = a; g.log.push(n); };
  Object.assign(g.DR.UI, { supervisor: set('supervisor'), supervisorBlock: set('supervisorBlock'), grade: set('grade'), result: set('result') });
  g.App.startMission('m4');
  g.ui.dialogue[1]();               // 도입 대화 끝
  g.ui.briefing[1]();               // 출발 → (가짜 달리기 바로 끝) → 검수
  assert.ok(g.ui.inspect, 'inspect');
  g.App.state.bag = Object.entries(counts).flatMap(([key, n]) => Array.from({ length: n }, (_, i) => ({ id: key + '_' + i, key })));
  if (opts.supplements !== undefined) g.App.state.supplements = opts.supplements;
  if (opts.removed) for (const c of opts.removed) g.App.noteRemoved(c);
  if (opts.undone) for (const c of opts.undone) g.App.noteRemoved(c, true);
  g.ui.inspect[2]();                // 제출
  g.ui.supervisor[2]();             // 감독관 → 판정
  g.ui.grade[2]();                  // 채점 시연 끝
  g.ui.result[2]();                 // 장면 결과 끝 → 결판
  return { g, lines: g.ui.dialogue[0].map((l) => l.text) };
}
const sd = m4.story.showdown;
test('P0-3 동기 카드로 다 채워지면(보충 달리기 없음) "다시 제출하기 전에 가방에 넣을게."', () => {
  const c = fullBag4(); delete c.scrawl_ml; delete c.alt_ml;
  const { g, lines } = toShowdown(c);
  assert.ok(lines.includes(sd.peerJoin[0].text));
  assert.ok(lines.includes(sd.peerJoinNoRun.text), lines.join(' / '));
  assert.ok(!lines.some((t) => /보충 달리기가 끝나면/.test(t)));
  g.ui.dialogue[1]();               // → 보충 준비
  const prep = g.ui.supplementPrep;
  const extra = prep[4].extra;
  assert.deepEqual({ ...g.DR.Judge.shortfall(m4, g.App.state.bag.concat(extra), g.DR.config) }, {}, 'prep will offer only resubmit');
});
test('P0-3 보충 달리기가 필요하면 예전 대사 그대로', () => {
  const c = fullBag4(); delete c.scrawl_ml; c.neat_data = 0; // 다른 장면도 모자람 → 달려야 함
  const { lines } = toShowdown(c);
  assert.ok(lines.includes(sd.peerJoin[1].text), lines.join(' / '));
  assert.ok(!lines.includes(sd.peerJoinNoRun.text));
});
test('P0-3 남은 보충이 없으면(다시 제출로만) 달리기 없는 대사', () => {
  const c = fullBag4(); delete c.scrawl_ml; c.neat_data = 0;
  const { lines } = toShowdown(c, { supplements: 2 });
  assert.ok(lines.includes(sd.peerJoinNoRun.text), lines.join(' / '));
});
test('P0-4 아주 흘려 쓴 머신러닝을 뺀 적 없이 모자라기만 하면 "봐, 또 못 읽잖아."', () => {
  const c = fullBag4(); c.scrawl_ml = 1;
  const { lines } = toShowdown(c);
  assert.ok(lines.includes(sd.failKept[0].text), lines.join(' / '));
  assert.ok(!lines.includes('봐, 또 지웠잖아.'));
});
test('P0-4 검수에서 그 카드(아주 흘려 쓴·띄어 쓴 머신러닝)를 뺐으면 "봐, 또 지웠잖아." · 되돌렸으면 아님', () => {
  const c = fullBag4(); c.scrawl_ml = 1;
  const a = toShowdown(c, { removed: [{ id: 'x1', key: 'scrawl_ml' }] });
  assert.ok(a.lines.includes('봐, 또 지웠잖아.'), a.lines.join(' / '));
  const b = toShowdown(c, { removed: [{ id: 'x1', key: 'scrawl_ml' }], undone: [{ id: 'x1', key: 'scrawl_ml' }] });
  assert.ok(b.lines.includes(sd.failKept[0].text));
  const o = toShowdown(c, { removed: [{ id: 'y1', key: 'neat_data' }] });
  assert.ok(o.lines.includes(sd.failKept[0].text), 'removing an unrelated card is not "erasing"');
  const sp = toShowdown(c, { removed: [{ id: 'z1', key: 'alt_ml' }] });
  assert.ok(sp.lines.includes('봐, 또 지웠잖아.'), 'spaced 머신 러닝 is the same answer');
});
