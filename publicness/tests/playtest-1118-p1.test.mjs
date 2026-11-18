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

test('P1-7: 청원이 바라는 곳(to)과 답하지 않은 청원 — 기본 모드 3단계 사건 청원은 답할 차례가 없어 결과·보고서에 남는다', () => {
  const Ch = require('../js/choices.js'), R = require('../js/report.js');
  const s = T.playTo(3);
  const fp = s.fixedPetition; assert.ok(fp && fp.to, '2단계 고정 청원에 바라는 곳 ' + JSON.stringify(fp));
  assert.ok(cfg.nodes.some((n) => n.id === fp.to) && fp.to !== fp.zone);
  const h3 = s.history.find((h) => h.phase === 3);
  assert.ok(h3.petition && !h3.petition.fixed, '재현: 3단계 사건 청원 ' + JSON.stringify(h3.petition));
  assert.equal(Ch.list(s).some((p) => p.phase === 3), false, '기본 모드 사건 청원은 답하는 목록에 없음(지금 흐름 그대로)');
  const un = Ch.unanswered(s);
  assert.deepEqual(un.map((p) => [p.phase, p.zone]), [[3, h3.petition.zone]], '답하지 않은 청원 = 3단계 사건 청원');
  assert.ok(un[0].to, '바라는 곳');
  const names = (id) => cfg.nodes.find((n) => n.id === id).name;
  const rep = R.build ? R.build(s, { won: (n) => (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('ko-KR') + '원', duration: (v) => Math.floor(v / 60) + '시간', rate: (r) => Math.round(r * 100) + '%', name: names, route: (n) => n + '번 노선', choices: { many: '더 많은 사람을 빠르게', longest: '오래 기다린 사람부터' }, date: new Date(2026, 10, 18) }) : null;
  if (rep) {
    const lines = rep.choices.petitions.map((p) => p.text);
    assert.ok(lines.some((t) => t.startsWith('3단계 ' + names(h3.petition.zone) + ' 주민 청원 · 답하지 않은 청원 · ') && t.includes('가는 버스를 늘려 주세요') && t.includes('못 간 이동 ' + h3.petition.count + '건')), JSON.stringify(lines));
  }
  // 고정 청원이 답할 목록은 그대로
  assert.deepEqual(Ch.list(s).map((p) => [p.kind, p.phase, p.answer]), [['fixed', 2, 3]]);
});
