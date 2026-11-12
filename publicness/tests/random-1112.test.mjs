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
