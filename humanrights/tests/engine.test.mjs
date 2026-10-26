// 엔진 검증: node --test "humanrights/tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const C = require('../js/config.js');
const S = require('../js/stories.js');
const E = require('../js/engine.js');
const MIN = C.MIN_TEXT;
const TEXT = '충분히 긴 답변입니다';

function memStore() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), map: m };
}

// 한 안건을 끝까지 진행한다(final: { choice, prot })
function playAgenda(state, ag, initial, final) {
  const a = state.answers[ag.id];
  assert.equal(E.next(state, S, MIN), true, 'brief');
  if (ag.data.kind === 'checklist') {
    assert.equal(E.canAdvance(state, S, MIN), false);
    a.data.picks.push('who');
  } else {
    for (const q of ag.data.questions) {
      if (q.type === 'text') a.data.q[q.id] = { value: TEXT };
      else { E.answerQuestion(state, ag, q.id, 'x'); E.answerQuestion(state, ag, q.id, 'x'); }
    }
  }
  assert.equal(E.next(state, S, MIN), true, 'data');
  assert.equal(E.canAdvance(state, S, MIN), false, '최초 판단 전에는 못 넘어감');
  assert.equal(E.lockInitial(state, ag, initial, S), true);
  assert.equal(E.next(state, S, MIN), true, 'initial');
  assert.equal(E.next(state, S, MIN), true, 'extra');
  if (ag.interviewTask) {
    assert.equal(E.canAdvance(state, S, MIN), false);
    a.interview.pick = 0; a.interview.reason = TEXT;
  }
  assert.equal(E.next(state, S, MIN), true, 'interview');
  assert.equal(E.canAdvance(state, S, MIN), false, '시뮬레이터를 돌려야 넘어감');
  a.sim.ran = true;
  assert.equal(E.next(state, S, MIN), true, 'sim');
  a.final.choice = final.choice; a.final.prot = final.prot || []; a.final.text = TEXT;
  if (ag.finalFactor) a.final.factor = ag.finalFactor[0];
  assert.equal(E.next(state, S, MIN), true, 'final');
}

test('세 안건 → 마무리 → 보고서까지 진행', () => {
  const st = E.newState(S, C.VERSION);
  assert.equal(E.next(st, S, MIN), true);
  playAgenda(st, S.AGENDAS[0], 'A', { choice: 'B', prot: ['alt', 'minimize'] });
  playAgenda(st, S.AGENDAS[1], 'A', { choice: 'A' });
  playAgenda(st, S.AGENDAS[2], 'C', { choice: 'C' });
  assert.equal(st.phase, 'guideline');
  assert.equal(E.canAdvance(st, S, MIN), false);
  for (const f of S.GUIDELINE_FIELDS) st.guideline[f.id] = TEXT;
  assert.equal(E.canAdvance(st, S, MIN), false, '일관성 질문 답도 필요');
  for (const q of E.consistencyQuestions(st, S)) st.consistency[q.id] = TEXT;
  assert.equal(E.next(st, S, MIN), true);
  st.rebuttal.id = 'base'; st.rebuttal.text = TEXT;
  assert.equal(E.canAdvance(st, S, MIN), false, '유지·수정 선택 필요');
  st.rebuttal.decision = 'keep';
  assert.equal(E.next(st, S, MIN), true);
  for (const f of S.REFLECTION_FIELDS) st.reflection[f.id] = TEXT;
  assert.equal(E.next(st, S, MIN), true);
  assert.equal(st.phase, 'report');
  assert.ok(st.completedAt);
  assert.equal(E.cardText(st, S, C.TITLE), 'AI 안면인식 심의위원회 · 출입 조건부 도입 · 채용 도입 · 치안 도입 안 함');
});

test('최초 판단은 한 번 확정하면 바꿀 수 없다', () => {
  const st = E.newState(S, C.VERSION);
  const ag = S.AGENDAS[0];
  assert.equal(E.lockInitial(st, ag, 'Z', S), false);
  assert.equal(E.lockInitial(st, ag, 'B', S), true);
  assert.equal(E.lockInitial(st, ag, 'C', S), false);
  assert.equal(st.answers.library.initial, 'B');
  assert.equal(st.answers.library.sim.choice, 'B', '시뮬레이터는 최초 판단에서 출발');
});

test('계산 문항: 맞히거나 두 번 시도하면 끝난다', () => {
  const st = E.newState(S, C.VERSION);
  const hiring = S.AGENDAS[1], policing = S.AGENDAS[2];
  let r = E.answerQuestion(st, hiring, 'q2', '8배');
  assert.equal(r.correct, true); assert.equal(r.done, true);
  r = E.answerQuestion(st, policing, 'q1', '1000');
  assert.equal(r.done, false);
  r = E.answerQuestion(st, policing, 'q1', '10');
  assert.equal(r.done, true); assert.equal(r.correct, false);
  r = E.answerQuestion(st, policing, 'q1', '100');
  assert.equal(r.correct, false, '끝난 문항은 다시 채점하지 않음');
  assert.equal(E.answerQuestion(st, policing, 'none', 1), null);
});

test('시뮬레이터: 보호 조치는 위험을 옮기고 점수를 만들지 않는다', () => {
  for (const ag of S.AGENDAS) {
    const a = E.simulate(ag, 'A', [], S);
    assert.equal(a.rightsAtRisk.length > 0, true, ag.id + ' A안은 남은 위험이 있음');
    assert.equal(a.aspects.rights.level.text, '높음');
    assert.equal(Object.keys(a).includes('score'), false);

    const all = ag.sim.risks.flatMap(r => r.fixedBy);
    const b = E.simulate(ag, 'B', all, S);
    assert.equal(b.rightsAtRisk.length, 0, ag.id + ' 모든 위험에 조치하면 남은 권리 위험 없음');
    assert.equal(b.reduced, ag.sim.risks.length);
    assert.ok(b.unresolved.some(t => t.includes('0으로 만들지는 않아요')), '줄어든 위험도 0은 아님');

    const c = E.simulate(ag, 'C', ['alt'], S);
    assert.equal(c.aspects.cost.level.text, '늘지 않음');
    assert.ok(c.unresolved.length > 0, 'C안도 해결되지 않은 문제를 보여 줌');

    // B안인데 조치가 없으면 A안과 같은 위험
    assert.deepEqual(E.simulate(ag, 'B', [], S).rightsAtRisk, a.rightsAtRisk);
  }
});

test('시뮬레이터: 관련 없는 조치는 따로 알린다', () => {
  const lib = S.AGENDAS[0];
  const r = E.simulate(lib, 'B', ['limit'], S);
  assert.ok(r.unresolved.some(t => t.startsWith('목적·장소 제한')));
});

test('일관성 점검: 조치를 한쪽에서만 요구하면 질문이 생긴다', () => {
  const st = E.newState(S, C.VERSION);
  st.answers.library.final = { choice: 'B', prot: ['alt'], text: '', factor: null };
  st.answers.hiring.final = { choice: 'B', prot: ['human'], text: '', factor: null };
  st.answers.policing.final = { choice: 'C', prot: [], text: '', factor: null };
  const qs = E.consistencyQuestions(st, S);
  assert.ok(qs.some(q => q.text === '출입에서는 대체 인증 수단을 요구했는데 채용에서는 왜 요구하지 않았나요?'), JSON.stringify(qs));
  assert.ok(qs.length <= 3);

  st.answers.library.final.choice = 'A';
  st.answers.hiring.final.choice = 'C';
  st.answers.policing.final.choice = 'A';
  const ids = E.consistencyQuestions(st, S).map(q => q.id);
  assert.ok(ids.includes('contrast:library:hiring'));
  assert.ok(ids.includes('contrast:policing'));
});

test('일관성 점검: 어긋남이 없으면 공통 기준 질문 하나', () => {
  const st = E.newState(S, C.VERSION);
  for (const ag of S.AGENDAS) st.answers[ag.id].final = { choice: 'C', prot: [], text: '', factor: null };
  assert.deepEqual(E.consistencyQuestions(st, S).map(q => q.id), ['common']);
});

test('저장 복원: 손상·옛 버전은 버리고 잘못된 값은 걸러 낸다', () => {
  assert.equal(E.restore(null, S, 1), null);
  assert.equal(E.restore({ v: 0, answers: {} }, S, 1), null);
  assert.equal(E.restore({ v: 1, phase: 'hack', answers: {} }, S, 1), null);
  const st = E.newState(S, 1);
  st.phase = 'agenda'; st.agenda = 9; st.step = -3;
  st.answers.library.initial = 'Q';
  st.answers.library.final.prot = ['alt', 'alt', 'nope'];
  const back = E.restore(JSON.parse(JSON.stringify(st)), S, 1);
  assert.equal(back.agenda, 2);
  assert.equal(back.step, 0);
  assert.equal(back.answers.library.initial, null);
  assert.deepEqual(back.answers.library.final.prot, ['alt']);
});

test('저장: 공통 플레이어 정보는 읽기만, 기록 지우기는 이 게임 키만', () => {
  const St = require('../js/storage.js');
  const s = memStore();
  s.setItem('ethicity.player', JSON.stringify({ character: 'char_03', nickname: '  <b>민</b>  ' }));
  s.setItem('ethicity.result.privacy', '{"game":"privacy"}');
  assert.deepEqual(St.readPlayer(s), { nickname: '<b>민</b>' });
  assert.equal(St.writeResult('카드', s), true);
  assert.deepEqual(JSON.parse(s.getItem(St.RESULT_KEY)), { game: 'humanrights', completed: true, ending: null, card: '카드' });
  St.writeProgress({ v: 1 }, s);
  St.clearGame(s);
  assert.equal(s.getItem(St.RESULT_KEY), null);
  assert.equal(s.getItem(St.PROGRESS_KEY), null);
  assert.ok(s.getItem('ethicity.player'));
  assert.ok(s.getItem('ethicity.result.privacy'));
  s.setItem('ethicity.player', '{broken');
  assert.equal(St.readPlayer(s), null);
});
