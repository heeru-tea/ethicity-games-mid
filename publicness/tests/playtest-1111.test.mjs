// 2026-11-11 교사 플레이테스트 지적 13건 — 엔진·문장 쪽 단위 검사(화면은 tests/playtest-1111-browser.mjs)
//  기본 모드 · 시드 42 · ‘무난한 노선’(tools/econ-review.cjs 균형 계획과 같은 것 — tests/playtest-1111-plan.cjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
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

test('5번: 노선 색 이름은 인물 이름과 겹치지 않고(하늘 → 파랑), 색 이름 바로 뒤에 조사를 직접 적은 문장이 없다', () => {
  const Names = require('../js/route-names.js'), fs = require('node:fs'), path = require('node:path'), s = { config: cfg };
  const people = cfg.residents.concat(cfg.challenge.residents).map((r) => r.name);
  cfg.ui.routeNames.forEach((n) => assert.ok(people.indexOf(n) < 0, '인물 이름과 겹침: ' + n));
  assert.equal(cfg.ui.routeNames.length, cfg.ui.routeColors.length); assert.equal(cfg.ui.routeColors[3], '#4A9CC2', '색은 그대로(이름만 바꿈)');
  assert.equal(Names.route(4, s), '파랑 노선'); assert.equal(Names.bus(4, s, 4), '파랑 버스');
  assert.equal(Names.text('4번 노선을 고쳤어요. 4번 노선으로 옮겨요.', s), '파랑 노선을 고쳤어요. 파랑 노선으로 옮겨요.');
  // 색 이름만 쓰고 조사를 붙이는 곳은 Narrative.josa가 받침으로 고른다
  const N = require('../js/narrative.js');
  assert.equal(N.josa(Names.color(4, s), '과와'), '파랑과'); assert.equal(N.josa(Names.color(5, s), '과와'), '보라와'); assert.equal(N.josa(Names.color(4, s), '이가'), '파랑이');
  // 소스 검사: Names.color(…)·C(…) 바로 뒤에 조사 글자로 시작하는 문자열을 잇지 않는다(‘ 노선’·‘ 버스’처럼 띄어서만)
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'js');
  fs.readdirSync(dir).filter((f) => f.endsWith('.js')).forEach((f) => {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(src, /Names\.color\([^()]*\)\s*\+\s*'(은|는|이|가|을|를|과|와|으로|로)[ ']/, f + ': 색 이름 뒤에 조사를 직접 적음');
  });
});

test('13번: 엔딩 총평은 해요체, 금액 이름은 누적 잔액', () => {
  const N = require('../js/narrative.js');
  const hs = [1, 2, 3, 4, 5].map((p) => ({ phase: p, metrics: { costs: { total: 1000 } }, residents: {} }));
  const some = N.endingConclusion([{ satisfied: true }, { satisfied: false }], hs, { cause: 'complete' }), all = N.endingConclusion([{ satisfied: true }], hs, { cause: 'complete' });
  assert.equal(some.verdict, '도시 노선을 나름 잘 설계했어요. 하지만 이게 최선이었을까요?'); assert.equal(all.verdict, '다양한 사람들을 만족시켰어요.');
  [some, all, N.endingConclusion([], hs, { cause: 'contract' })].forEach((c) => { assert.doesNotMatch(c.verdict, /(했다|이다|있다|됐다|보자|을까)[.?]/, c.verdict); });
  assert.match(some.text, /누적 잔액 5,000원/); assert.doesNotMatch(some.text, /총 수익|누적 손익/);
  assert.match(N.endingConclusion([], hs, { cause: 'bankrupt' }).text, /보유 잔액 5,000원/);
});
