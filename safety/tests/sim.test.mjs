// 운영 시뮬레이션 검증(기획 6-2·8): node safety/tests/sim.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../js/patients.js');
const S = require('../js/sim.js');

// 1) 환자 구성: 경증 70 · 중증 20 · 응급 10, 미션 3 사례(확신도 96%)가 처음부터 들어 있다
const count = (k) => P.list.filter((p) => p.actual === k).length;
assert.equal(P.list.length, 100);
assert.deepEqual([count('mild'), count('severe'), count('emergency')], [70, 20, 10]);
const rc = P.byId(P.REPORT_CASE);
assert.deepEqual([rc.actual, rc.ai, rc.conf], ['severe', 'mild', 96]);
assert.ok(P.list.filter((p) => p.actual !== p.ai).length >= 10, 'AI 오류가 양쪽으로 섞여 있다');

// 2) 같은 정책이면 같은 결과
const all = [];
for (const mild of S.LEVELS) for (const severe of S.LEVELS) for (const emergency of S.EMERGENCY) all.push({ mild, severe, emergency });
for (const pol of all) assert.deepEqual(S.run(pol), S.run(pol));

// 3) 응급환자 평가는 어떤 정책에서도 즉시(필수 안전 의무는 해제되지 않는다)
for (const pol of all) assert.equal(S.run(pol).emergencyOnTime, 10, JSON.stringify(pol));

// 4) 세 지표 모두에서 가장 좋은 정책은 없다(모든 선택에 장점과 한계)
const res = all.map((pol) => ({ pol, r: S.run(pol) }));
const best = (k) => Math.min(...res.map((x) => x.r[k]));
const dominant = res.filter((x) => x.r.delayed === best('delayed') && x.r.missed === best('missed') && x.r.reviews === best('reviews'));
assert.equal(dominant.length, 0, '모든 지표에서 이기는 정책: ' + JSON.stringify(dominant.map((x) => x.pol)));

// 5) AI를 적극 활용하면 빠르지만 놓치고, 모두 재검토하면 덜 놓치지만 늦다
const fast = S.run({ mild: 'sample', severe: 'sample', emergency: 'alert' });
const strict = S.run({ mild: 'all', severe: 'all', emergency: 'alert' });
assert.ok(fast.missed > strict.missed && fast.delayed < strict.delayed && fast.reviews < strict.reviews);
assert.ok(strict.worsened > 0, '모두 재검토하면 기다리다 상태가 나빠지는 환자가 생긴다(사건 B)');

// 6) 조건부 재확인은 위험 신호·불확실성이 없는 확신도 96% 오류를 놓친다(사건 C·미션 3)
assert.equal(S.run({ mild: 'cond', severe: 'cond', emergency: 'alert' }).patients.P047.state, 'missed');

// 7) 안전장치는 점수를 더하지 않고 특정 환자·절차에 작용한다
const cc = { mild: 'cond', severe: 'cond', emergency: 'alert' };
assert.notEqual(S.run(cc, ['analysis']).patients.P047.state, 'missed', '오류 집중 분석이 같은 유형을 찾는다');
assert.equal(S.run({ mild: 'all', severe: 'all', emergency: 'alert' }).patients.P084.state, 'missed', '알아채기 어려운 사례');
assert.notEqual(S.run({ mild: 'all', severe: 'all', emergency: 'alert' }, ['training']).patients.P084.state, 'missed', '교육이 있으면 발견');
assert.ok(S.run(cc, ['warning']).reviews > S.run(cc).reviews, '불확실성 경고는 검토 업무를 늘린다');
assert.ok(S.run({ mild: 'all', severe: 'all', emergency: 'alert' }, ['staff']).delayed < strict.delayed, '추가 인력은 대기를 줄인다');
assert.equal(S.cost(['analysis', 'staff']), 5);

// 8) 사건·엔딩 경향 분류
assert.equal(S.eventFor({ mild: 'sample' }), 'A');
assert.equal(S.eventFor({ mild: 'all' }), 'B');
assert.equal(S.eventFor({ mild: 'cond' }), 'C');
assert.equal(S.tendency({ mild: 'sample', severe: 'sample' }), 'speed');
assert.equal(S.tendency({ mild: 'all', severe: 'all' }), 'thorough');
assert.equal(S.tendency({ mild: 'cond', severe: 'all' }), 'balance');

console.log('sim ok —', res.length, '개 정책');
