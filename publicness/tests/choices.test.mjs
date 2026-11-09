// 2026-11-10 2단계 고정 청원 + 필수 선택(청원 답·무임 정책)
import test from 'node:test'; import assert from 'node:assert/strict'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js'), S = require('../js/session.js'), Choices = require('../js/choices.js');
const { playTo, runAndFinish, balancedPlan } = require('./fairness-fixture.cjs');

test('2단계 고정 청원: seed 여러 개 x 기본·랜덤 모두 정확히 하나, 사건 추첨 불변', () => {
  for (const opt of [{}, { mode: 'fixed', seed: 7 }, { mode: 'fixed', seed: 1234 }]) {
    const s = S.create(cfg, opt), before = JSON.stringify(s.events);
    const h = playTo(s, 2, balancedPlan).history[1];
    assert.ok(h.petition && h.petition.fixed); assert.equal(h.petition.t, 45);
    assert.equal(JSON.stringify(s.events), before);
    assert.equal(s.fixedPetition.zone, h.petition.zone);
    assert.equal(typeof s.fixedPetition.noRecord, 'boolean');
  }
});
test('required: 3단계 청원 답 필요, 고르면 해제 · 4단계 무임 정책', () => {
  const s = playTo(S.create(cfg), 2, balancedPlan); S.nextPhase(s);
  assert.deepEqual(Choices.required(s), ['petition']);
  Choices.set(s, "petition", "why", "x");
});
test('required: 이유만으로는 부족, 선택하면 해제', () => {
  const s = playTo(S.create(cfg), 2, balancedPlan); S.nextPhase(s);
  Choices.set(s, 'petition', 'why', '병원 가는 길이라'); assert.deepEqual(Choices.required(s), ['petition']);
  Choices.set(s, 'petition', 'choice', 'not-now'); assert.deepEqual(Choices.required(s), []);
  assert.equal(s.petitionReply.zone, s.fixedPetition.zone);
  runAndFinish(s, balancedPlan); S.nextPhase(s);
  assert.deepEqual(Choices.required(s), ['elder']);
  Choices.set(s, 'elder', 'choice', 'abolish'); assert.deepEqual(s.elderPolicy, { phase: 4, choice: 'abolish' });
  assert.deepEqual(Choices.required(s), []);
});
test('옛 저장본: fixedPetition 없이 3단계면 청원 답을 요구하지 않는다', () => {
  const s = playTo(S.create(cfg), 2, balancedPlan); S.nextPhase(s); delete s.fixedPetition;
  assert.deepEqual(Choices.required(s), []);
});
test('set: 200자 자르기·빈 값 지움·잘못된 값 무시', () => {
  const s = S.create(cfg); s.phase = 4;
  assert.equal(Choices.set(s, 'elder', 'choice', 'zzz'), null); assert.equal(s.elderPolicy, undefined);
  Choices.set(s, 'elder', 'choice', 'keep');
  Choices.set(s, 'elder', 'why', 'a'.repeat(300)); assert.equal(s.elderPolicy.why.length, 200);
  Choices.set(s, 'elder', 'why', '  '); assert.equal('why' in s.elderPolicy, false);
  Choices.set(s, 'elder', 'choice', 'bad'); assert.equal(s.elderPolicy.choice, 'keep');
  assert.equal(Choices.set(s, 'nope', 'choice', 'keep'), null);
});
test('2단계에 무작위 청원이 뽑힌 seed에서도 청원은 하나', () => {
  let found = 0;
  for (let seed = 1; seed < 400 && found < 2; seed++) {
    const s = S.create(cfg, { mode: 'fixed', seed });
    if (!s.events[1] || s.events[1].type !== 'petition') continue;
    found++;
    const h = playTo(s, 2, balancedPlan).history[1];
    assert.equal(s.current.result.log.filter((e) => e.type === 'petition').length, 1);
    assert.ok(h.petition.fixed);
  }
  assert.ok(found > 0, '청원 사건 seed를 찾지 못함');
});
test('3단계 이후 단계는 고정 청원을 만들지 않는다', () => {
  const s = playTo(S.create(cfg), 3, balancedPlan);
  assert.equal(s.history[2].petition && s.history[2].petition.fixed, undefined);
});
