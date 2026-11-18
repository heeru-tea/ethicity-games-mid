// 2026-11-18 플레이테스트(pb-3.2.0) P0 — 엔진·문장 쪽 단위 검사(화면은 tests/playtest-1118-browser.mjs)
//  기본 모드 · 시드 42
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js'), S = require('../js/session.js'), A = require('../js/advisor.js');

function phase1(routes) {
  const s = S.create(cfg); S.beginPlan(s);
  routes.forEach(([nodes, n], i) => { const r = s.draft.routes[i]; r.nodes = nodes.slice(); r.stops = nodes.map(() => true); for (let k = 0; k < n; k++) s.draft.buses.filter((b) => b.routeNum == null)[0].routeNum = r.num; });
  return s;
}

test('P0-1: AI 제안 미리보기 — 내 계획에서 빠지는 구간과 더는 서지 않는 정류장(Session.previewDiff)', () => {
  // 1단계 빨강 = 외곽 마을→병원→기차역→밀집 주거지→대학교, ‘빠른 이동’ 제안은 외곽 마을·병원을 뺀다
  const s = phase1([[['F', 'D', 'A', 'B', 'C'], 1]]), rec = A.recommendSync(S.revealed(s), 'time'), pv = S.previewRec(s, rec);
  const aiNodes = pv.draft.routes.flatMap((r) => r.nodes);
  assert.ok(aiNodes.indexOf('F') < 0, '재현 조건: 제안에 외곽 마을 없음 ' + JSON.stringify(pv.draft.routes.map((r) => r.nodes.join(''))));
  const d = S.previewDiff(s, pv);
  assert.ok(d.segs.some((x) => x.key === 'D-F'), '외곽 마을—병원 = 빠지는 구간 ' + JSON.stringify(d.segs));
  assert.ok(d.stops.indexOf('F') >= 0, '외곽 마을 = 더는 서지 않는 정류장');
  // 제안에도 있는 구간(방향 무관)·정류장은 빠짐이 아님
  const aiKeys = new Set(pv.draft.routes.flatMap((r) => r.nodes.slice(1).map((n, i) => [r.nodes[i], n].sort().join('-'))));
  d.segs.forEach((x) => assert.ok(!aiKeys.has(x.key), x.key + '는 제안에 없는 구간'));
  assert.deepEqual(d.stops.filter((id) => aiNodes.indexOf(id) >= 0), [], '제안이 서는 정류장은 빠짐 아님');
  // 같은 계획이면 빠지는 것 없음 · 정류장 1곳짜리 노선은 지도에 안 그려지므로 안 셈
  assert.deepEqual(S.previewDiff(s, s), { segs: [], stops: [] });
  const one = phase1([[['F'], 0]]); assert.deepEqual(S.previewDiff(one, pv), { segs: [], stops: [] });
  // 거꾸로 이은 같은 구간은 남는 구간
  const rev = phase1([[['C', 'B', 'A'], 1]]), fwd = phase1([[['A', 'B', 'C'], 1]]);
  assert.deepEqual(S.previewDiff(rev, fwd), { segs: [], stops: [] });
});
