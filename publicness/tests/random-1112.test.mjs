// 2026-11-12 교사 랜덤 모드 검토(시드 245525538, 1280×800) 12건 — 순수 로직 회귀 검사. 화면 쪽은 random-1112-browser.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js'), S = require('../js/session.js'), G = require('../js/graph.js'), Q = require('../js/schedule.js');
export const SEED = 245525538;

// 단계 p의 계획 화면까지(정산 결과는 상관없음 — 계약 종료는 지워서 끝까지 간다)
export function reach(p, opts = {}) {
  const s = S.create(cfg, { mode: 'random', seed: SEED });
  while (s.phase < p) { S.beginPlan(s); if (opts.each) opts.each(s); S.startRun(s); S.finishRun(s); s.end = null; s.negStreak = 0; S.nextPhase(s); }
  S.beginPlan(s); return s;
}
export function lay(s, routes) {
  s.draft.routes = []; s.draft.buses.forEach((b) => { b.routeNum = null; });
  routes.forEach(([num, nodes, ids]) => { s.draft.routes.push({ num, nodes: nodes.slice(), stops: nodes.map(() => true), autoPlaced: true }); ids.forEach((id) => { const b = s.draft.buses.find((x) => x.id === id); if (b) b.routeNum = num; }); });
}

test('7번: 직행 노선 한 바퀴·간격은 한 함수(노선 번호로 차량 속도) — 노선 칩·글 목록·보고서가 같은 값', () => {
  const s = reach(6); lay(s, [[5, ['F', 'B', 'L'], [7]], [1, ['A', 'B'], [1]]]);
  const g = S.graph(s), r5 = S.routeByNum(s, 5);
  assert.equal(S.routeCycle(s, 5), Q.cycleMinutes(g, s.config, 7, r5), '직행 = 7호차(1.5배) 속도');
  assert.notEqual(S.routeCycle(s, 5), G.cycleMinutes(g, r5), '속도를 뺀 값(예전 글 목록)과 다름');
  const gap = S.routeGaps(s).find((x) => x.num === 5);
  assert.equal(gap.headway, S.routeCycle(s, 5), '버스 1대 = 간격과 한 바퀴가 같음');
  assert.equal(S.routeHeadway(s, 5), S.routeCycle(s, 5));
  // 버스가 없어도(계획 중) 직행 노선은 직행 차량 속도로
  s.draft.buses.find((b) => b.id === 7).routeNum = null;
  assert.equal(S.routeCycle(s, 5), Q.cycleMinutes(g, s.config, 7, r5));
  assert.equal(Q.routeVehicleId(s.config, 6), 9); assert.equal(Q.routeVehicleId(s.config, 2), 1);
  const base = S.create(cfg, { mode: 'default' });
  assert.equal(Q.routeVehicleId(base.config, 5), 1, '기본 모드는 모두 일반 버스');
});

test('7번: 보고서 노선 줄에도 같은 한 바퀴·간격', () => {
  const Report = require('../js/report.js'), D = require('../js/demand.js');
  const s = reach(6); lay(s, [[5, ['F', 'B', 'L'], [7]], [1, ['A', 'B'], [1, 2]]]);
  const lap5 = S.routeCycle(s, 5), lap1 = S.routeCycle(s, 1);
  S.startRun(s); S.finishRun(s);
  s.planLog = { 6: { routes: [{ num: 5, nodes: ['F', 'B', 'L'], buses: 1 }, { num: 1, nodes: ['A', 'B'], buses: 2 }], resting: 0 } };
  const f = { won: String, duration: (m) => 'D' + m, rate: String, name: (id) => id, route: (n) => 'R' + n, clock: (t) => D.clock(s.config, t), choices: {}, date: new Date(2026, 10, 12) };
  const st = Report.build(s, f).stages.find((x) => x.phase === 6);
  assert.ok(st.plan[0].endsWith(' · 한 바퀴 D' + lap5 + ' · 간격 약 D' + lap5), st.plan[0]);
  assert.ok(st.plan[1].endsWith(' · 한 바퀴 D' + lap1 + ' · 간격 약 D' + lap1 / 2), st.plan[1]);
});

test('2번: 노선은 이어지지만 갈아타기 2번 → TOO_MANY_TRANSFERS(유나·다은), 정말 안 이어지면 NO_LINK — 길 찾기 규칙(1번까지)은 그대로', () => {
  const s = reach(4); lay(s, [[1, ['J', 'B'], [1]], [2, ['B', 'A'], [2]], [3, ['A', 'H'], [3]]]);
  const Sim = require('../js/sim.js'), g = S.graph(s), plan = S.toPlan(s);
  assert.equal(Sim.transfersNeeded(g, plan, 'J', 'H'), 2); assert.equal(Sim.structural(g, plan, 'J', 'H'), false, '한 번 환승으로는 못 감(규칙 그대로)');
  assert.equal(Sim.transfersNeeded(g, plan, 'J', 'A'), 1); assert.equal(Sim.transfersNeeded(g, plan, 'J', 'C'), null);
  const tr = S.departChecks(s).transfers;
  assert.deepEqual(tr.map((x) => x.name), ['유나', '다은'], '계획 화면·출발 확인창이 미리 경고할 인물');
  assert.ok(tr.every((x) => x.n === 2 && x.legs[0].o === 'J' && x.legs[0].d === 'H'));
  const r = S.startRun(s), yuna = r.passengers.find((p) => p.residentId === 'yuna' && p.leg === 'outbound');
  assert.equal(yuna.fail, 'TOO_MANY_TRANSFERS'); assert.equal(yuna.waitTotal, 0, '노선 없음처럼 기다린 것으로 세지 않음(대기·해시 그대로)');
  const m = s.current.metrics; assert.ok(m.transfers >= 2, '결과 요약: 갈아타기 2번 이동 따로 셈 ' + m.transfers);
  assert.equal(r.passengers.filter((p) => p.fail === 'NO_LINK').length, m.noLink, '잇는 노선이 정말 없는 이동만 noLink');
  const rec = S.finishRun(s).residents.yuna;
  assert.equal(rec.reasons[0].code, 'transfers'); assert.match(rec.reasons[0].text, /갈아타기를 두 번 해야 해서 못 가요\(갈아타기는 한 번까지\)/);
  const N = require('../js/narrative.js');
  assert.ok(Object.keys(N).length > 0);
  const sc = s.history[s.history.length - 1].scores.mobility.reasons; assert.ok(sc.transfers >= 2, '평가 대상 못 간 이유도 나눠 셈');
});

test('2번: 예전 저장본(transfers 없는 기록)도 그대로 읽힌다 — 보고서·재정 돌아보기', () => {
  const s = reach(3); lay(s, [[1, ['A', 'B'], [1]]]); S.startRun(s); S.finishRun(s);
  const h = s.history[s.history.length - 1]; delete h.metrics.transfers; delete h.scores.mobility.reasons.transfers;
  Object.values(h.metrics.zones).forEach((z) => delete z.transfers);
  const back = S.safeRestore(JSON.parse(JSON.stringify(S.serialize(s))), cfg); assert.ok(back);
  const N = require('../js/narrative.js'), fr = N.financeReview(back.config, back.history); assert.equal(fr.transfers, 0);
  const Report = require('../js/report.js'), D = require('../js/demand.js');
  const f = { won: String, duration: String, rate: String, name: (id) => id, route: (n) => 'R' + n, clock: (t) => D.clock(back.config, t), choices: {}, date: new Date(2026, 10, 12) };
  const st = Report.build(back, f).stages.find((x) => x.phase === 3); assert.ok(st.numbers.length > 0);
});
