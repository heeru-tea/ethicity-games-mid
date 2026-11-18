// 2026-11-18 플레이테스트(pb-3.2.0) P1 — 엔진·문장 쪽 단위 검사(화면은 tests/playtest-1118-p1-browser.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js'), S = require('../js/session.js'), A = require('../js/advisor.js'), T = require('./playtest-1111-plan.cjs');

test('P1-5: ‘소외 지역’ 한 목록 — 계획 화면은 지금 단계, 결과 화면은 다음 단계(AI라면?과 같은 입력), 다음 단계 계획 화면과 같다', () => {
  const s0 = S.create(cfg); S.beginPlan(s0);
  assert.deepEqual(S.underserved(s0), cfg.reachInitial, '1단계 = 사람이 정해 둔 지역');
  assert.deepEqual(A.recommendSync(S.revealed(s0), 'reach').targets, S.underserved(s0), '계획 화면 AI 패널 = underserved');
  for (const ph of [1, 2, 3, 4]) {
    const s = T.playTo(ph), u = S.underserved(s);
    const card = A.recommendSync(S.revealed(S.plannedNext(s), { allowNodes: S.visibleNodeIds(s) }), 'reach').targets;
    assert.deepEqual(card, u, ph + '단계 결과: AI라면? 소외 지역 = underserved');
    const n = T.playTo(ph); S.nextPhase(n); T.lay(n);
    const panel = S.underserved(n), fresh = cfg.nodes.filter((x) => x.fromPhase === ph + 1).map((x) => x.id);
    assert.deepEqual(panel.filter((id) => fresh.indexOf(id) < 0), u.filter((id) => fresh.indexOf(id) < 0), `${ph}단계 결과 목록 = ${ph + 1}단계 계획 AI 패널(새 정류장 빼고) ${u} / ${panel}`);
  }
});
