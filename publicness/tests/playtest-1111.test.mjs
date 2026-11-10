// 2026-11-11 교사 플레이테스트 지적 13건 — 엔진·문장 쪽 단위 검사(화면은 tests/playtest-1111-browser.mjs)
//  기본 모드 · 시드 42 · ‘무난한 노선’(tools/econ-review.cjs 균형 계획과 같은 것 — tests/playtest-1111-plan.cjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js'), S = require('../js/session.js'), A = require('../js/advisor.js'), P = require('./playtest-1111-plan.cjs');

test('2번: 결과 화면 AI는 다음 단계 수요로 계산해도 이번 단계에 보이는 정류장으로만 노선을 짠다', () => {
  const s = P.playTo(2); // 2단계 결과 화면(신도시는 3단계부터)
  const vis = S.visibleNodeIds(s), base = S.plannedNext(s);
  assert.equal(base.phase, 3); assert.ok(vis.indexOf('I') < 0 && S.visibleNodeIds(base).indexOf('I') >= 0);
  const nodesOf = (rec) => [...new Set(rec.plan.buses.flatMap((b) => (b.route ? b.route.nodes : [])))];
  // 좁히지 않으면(예전) 아직 없는 신도시를 추천한다 — 재현
  const leak = ['time', 'reach', 'profit'].some((g) => nodesOf(A.recommendSync(S.revealed(base), g)).indexOf('I') >= 0);
  assert.equal(leak, true, '예전 동작 재현: 신도시가 추천에 들어감');
  for (const g of ['time', 'reach', 'profit']) {
    const rec = A.recommendSync(S.revealed(base, { allowNodes: vis }), g);
    assert.deepEqual(nodesOf(rec).filter((n) => vis.indexOf(n) < 0), [], g + ': 추천 노선의 정류장은 모두 2단계에 보이는 정류장');
    assert.deepEqual(rec.targets.filter((n) => vis.indexOf(n) < 0), [], g + ': 소외 지역 대상도 보이는 정류장만');
  }
  // 계획 화면(좁히지 않음)은 그대로 — allowNodes가 없으면 그 단계 지도 전체
  assert.equal(S.revealed(base).allowNodes, null);
});
