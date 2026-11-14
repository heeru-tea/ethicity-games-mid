// 2026-11-14 교사 요청: 엔딩 A '회복 경로' — 제한적인 실수 뒤 그 사건에 맞게 끝까지 수습한 경로도 A(예방 A는 그대로)
//   쓰기: node tests/ending-a-recovery-1114.mjs  (ENDING_V2=0 으로도)
//   0 판정 정의(engine.js COMPUTED slip.*·fix.*·grave_harm·recovered)와 A 조건
//   1 분류 빠짐 없음: 뜻을 무시한 행동·친구를 해친 선택은 모두 '회복할 수 있는 실수' 또는 '회복 불가' 중 하나
//   2 대표 경로: 예방 A 유지 / 실수 하나 + 그 사건 수습 → 회복 A / 수습 거절·부분 수습 → A 아님 / 다른 사건 도움만 → A 아님
//     / 같은 친구 두 사건 → A 아님 / 반복·심각한 가해 + 수습 → A 아님 / 위험 상황은 D 먼저
//   3 문장: 회복 A는 예방 A와 다른 문장, 피해가 없던 일이 된 것처럼 말하지 않음 · 예방 A 문장은 고치기 전과 같음
//   4 피해 기록·믿음 상한 그대로(회복 A여도 hurt·harm_count 유지, 해친 친구 믿음 ≤ 0)
//   5 무작위 표본: 새 A = 예방 A ∪ 회복 A, 예방 A는 하나도 빠지지 않음, 회복 A는 모두 실수 하나·수습 완료·회복 불가 없음
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const story = require('../js/story.js'), E = require('../js/engine.js'), routes = require('./routes.js');
story.triggers = require('../js/world.js').triggers;
const V = story.endingV2 === true ? 'V2' : 'V1';

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (extra === undefined ? '' : ' :: ' + JSON.stringify(extra))); } };
const A = story.endings.find((e) => e.code === 'A');
const PREVENT = 'spread<=2 && minimize>=2 && harm_count=0 && !overrode_wish && e8!=crew'; // 2026-11-14 교사 결정: 친구들을 모아 같이 나가자고 한 경로(e8=crew)는 A가 아니다
const RECOVER = 'spread<=2 && minimize>=2 && recovered';
const condOf = (code) => story.endings.find((e) => e.code === code).if;

/* ── 0. 정의 ── */
ok('A 조건 = 예방 A || 회복 A', A.if === PREVENT + ' || ' + RECOVER, A.if);
ok('D·B·C 조건 그대로, 순서 D → A → B → C', story.endings.map((e) => e.code).join('') === 'DABC' && condOf('D') === 'e8_unresolved_threat || serious>=3' && condOf('B') === 'repair+help>=3 && spread<=4 && harm_count<=2' && condOf('C') == null);
for (const k of ['slip.e2', 'slip.e5', 'slip.e6', 'slip.e7', 'fix.e2', 'fix.e5', 'fix.e6', 'fix.e7', 'slip_count', 'slip_fixed', 'grave_harm', 'recovered']) ok('COMPUTED ' + k, E.COMPUTED[k] != null);
ok('피해 정의(hurt·harm_count·harmed_others·overrode_wish)는 그대로', E.COMPUTED['hurt.minjun'] === 'e2post=story|group || e2fix=no || e7=join|silent || e7b=none' && E.COMPUTED.overrode_wish.indexOf('e5j=jiho') > 0);

/* ── 1. 분류 빠짐 없음 ── */
const flagsOnly = (flags) => ({ stats: {}, trust: {}, flags });
const SLIPS = ['slip.e2', 'slip.e5', 'slip.e6', 'slip.e7'];
const isSlip = (f) => SLIPS.some((k) => E.evalCond(k, flagsOnly(f)));
const isGrave = (f) => E.evalCond('grave_harm', flagsOnly(f));
const BAD = 'overrode_wish || harm_count>=1';
// 장면마다 그 선택의 set만으로 판정 + 앞 선택과 함께여야 뜻이 정해지는 조합(사진: 찍기 × 올리기)
const unclassified = [];
for (const [id, sc] of Object.entries(story.scenes)) for (const c of sc.choices || []) {
  if (id === 'c1_e2_b') continue; // 올리기는 찍기(nocheck|asked)와 함께여야 뜻이 정해진다 — 아래 조합으로
  const f = Object.assign({}, c.set || {});
  if (E.evalCond(BAD, flagsOnly(f)) && !isSlip(f) && !isGrave(f)) unclassified.push(id + '#' + c.id);
}
for (const shot of ['nocheck', 'asked']) for (const post of ['ask', 'keep', 'group', 'story']) { // 'none'(안 찍음)은 올리기 장면을 거치지 않는다
  const f = { e2shot: shot, e2post: post };
  if (E.evalCond(BAD, flagsOnly(f)) && !isSlip(f) && !isGrave(f)) unclassified.push('e2 ' + shot + '+' + post);
}
ok('뜻을 무시한 행동·친구를 해친 선택은 모두 실수 또는 회복 불가로 분류됨', unclassified.length === 0, unclassified);
ok('실수이면서 회복 불가인 선택 없음(사진 찍기 단독)', !isGrave({ e2shot: 'nocheck' }) && isSlip({ e2shot: 'nocheck', e2post: 'group' }) && isGrave({ e2shot: 'asked', e2post: 'group' }) && isGrave({ e2shot: 'nocheck', e2post: 'story' }));

/* ── 2. 대표 경로 ── */
function play(prefs) {
  let s = E.createState(story);
  for (let k = 0; k < 900; k++) {
    if (s.screen === 'ending') return s;
    if (s.screen === 'scene' && E.needsChoice(story, s)) {
      const cs = E.visibleChoices(story, story.scenes[s.scene], s);
      const c = cs.find((x) => x.id === prefs[s.scene]);
      if (prefs[s.scene] && !c) throw new Error('고를 수 없음 ' + s.scene + '#' + prefs[s.scene]);
      s = E.choose(story, s, (c || cs[0]).id); s.history = [];
    }
    s = E.advance(story, s);
  }
  throw new Error('끝나지 않음');
}
const base = Object.fromEntries(routes.A.map((p) => p.split('#')));
const run = (over) => play({ ...base, ...over });
const kind = (s) => (s.ending !== 'A' ? s.ending : E.evalCond('recovered', s) ? 'A(회복)' : 'A(예방)');
const rows = [];
const expect = (name, over, want) => { const s = run(over); const k = kind(s); rows.push(`${name}: ${k} ${JSON.stringify(s.stats)} 실수 ${E.evalCond('slip_count', s) ? E.COMPUTED.slip_count && computedCount(s) : 0} 회복불가 ${E.evalCond('grave_harm', s)}`); ok(`${name} → ${want}`, k === want, { got: k, stats: s.stats }); return s; };
const computedCount = (s) => SLIPS.filter((k) => E.evalCond(k, s)).length;

expect('예방 A(가장 신중한 선택, routes.js A)', {}, 'A(예방)');
expect('예방 A(동의 0: 찍지 않음·신고·보호자)', { pro_1: 'money', c1_e1_a: 'dm', c1_e2_a: 'no', c1_e3_b: 'anon', c2_e4_b: 'report', c3_e9_a: 'critique', c3_e9_b: 'calm' }, 'A(예방)');

const SLIP = {
  e2: { c1_e2_a: 'shoot', c1_e2_b: 'group', c1_e2_d: 'all' },
  e5: { c2_e5_a: 'all', c2_e5_j: 'anon', c2_e5_b: 'del' },
  e6: { c2_e6_a: 'peek', c2_e6_b: 'stop' },
  e7: { c3_e7_a: 'silent', c3_e7_b: 'help' }
};
const recov = {};
for (const [ev, over] of Object.entries(SLIP)) recov[ev] = expect(`회복 ${ev}: 실수 + 그 사건 수습`, over, 'A(회복)');
// 같은 실수 + 수습 거절 · 부분 수습
expect('e2 묻지 않고 올림 + 삭제 요청 넘김', { ...SLIP.e2, c1_e2_d: 'no' }, 'B');
expect('e2 묻지 않고 올림 + 내리고 사과만(사본 회수 요청 없음)', { ...SLIP.e2, c1_e2_d: 'sorry' }, 'B');
expect('e2 묻지 않고 찍음 + 올리기 전에 물음(사진을 지우는 선택이 없음 — 수습 확인 불가)', { c1_e2_a: 'shoot', c1_e2_b: 'ask' }, 'B');
expect('e5 통째로 + 그냥 닫기', { ...SLIP.e5, c2_e5_b: 'close' }, 'B');
expect('e6 DM 열람 + 캡처 전달(같은 사건에서 거듭 침해)', { c2_e6_a: 'peek', c2_e6_b: 'cap' }, 'B');
expect('e7 가만히 + 그냥 둠', { ...SLIP.e7, c3_e7_b: 'none' }, 'B');
expect('e7 가만히 + 지우라고만(민준이·선생님 없이)', { ...SLIP.e7, c3_e7_b: 'del' }, 'B');
// 다른 사건의 도움 점수만 높임
const other = expect('e5 통째로 + 그냥 닫기, 대신 다른 사건에서 도움·수습 최대', { ...SLIP.e5, c2_e5_b: 'close', c2_e4_b: 'ask', c3_e9_a: 'report', c3_e8_a: 'tell' }, 'B');
ok('다른 사건 도움으로 수치는 충분해도 A 아님', other.stats.repair + other.stats.help >= 3, other.stats);
// 같은 친구(민준) 두 사건 — 해친 친구 수는 1이지만 실수한 사건은 2
const twice = expect('민준 두 사건(사진 + 번호 방관) 둘 다 수습', { ...SLIP.e2, ...SLIP.e7 }, 'B');
ok('같은 친구 두 사건: harm_count=1(옛 harm_count<=1 완화였다면 통과) · 실수 사건 2', E.evalCond('harm_count=1', twice) && computedCount(twice) === 2, { harm: E.evalCond('harm_count=1', twice), slips: computedCount(twice) });
expect('서로 다른 두 사건 실수(e5 + e6) 둘 다 수습', { ...SLIP.e5, ...SLIP.e6 }, 'B');
// 반복·심각한 가해 + 수습
expect('가짜 영상 전달 + 털어놓고 지워 달라 함', { c2_e4_a: 'forward', c2_e4_b: 'confess' }, 'B');
expect('하늘 계정 사칭 + 털어놓고 지움', { c2_e6_a: 'post', c2_e6_b: 'own' }, 'B');
expect('민준 번호 유포 + 지우게 하고 선생님께', { c3_e7_a: 'join', c3_e7_b: 'help' }, 'B');
expect('지호 비밀 캡처 + 지워 달라 하고 사과', { c1_e3_b: 'capture', c1_e3_cap: 'full' }, 'B');
expect('"올리진 마" 뒤 단톡방에 올림 + 내리고 부탁', { c1_e2_a: 'ask', c1_e2_b: 'group', c1_e2_d: 'all' }, 'B');
expect('묻지 않고 스토리(학교 밖)에 올림 + 내리고 부탁', { c1_e2_a: 'shoot', c1_e2_b: 'story', c1_e2_d: 'all' }, 'B');
expect('지호 대화를 AI에 + 지움', { c2_e5_a: 'min', c2_e5_j: 'jiho', c2_e5_b: 'del' }, 'B');
expect('신상 스토리 공유 + 내림', { c3_e9_a: 'share', c3_e9_b: 'del' }, 'B');
// 안전 위협은 D가 먼저
expect('회복 e2 + 정문 약속에 나가 싸우고 알림 끔(위협이 남음)', { ...SLIP.e2, c3_e8_a: 'meet', c3_e8_b: 'go', c3_e8_c: 'fight', c3_e8_f: 'silence', c3_e8_i: 'fine' }, 'D');
// B·C 정상 분기(대표 경로)
for (const code of ['B', 'C', 'D']) { let i = 0; const s = play(Object.fromEntries(routes[code].map((p) => p.split('#')))); ok('대표 경로 ' + code + ' 그대로', s.ending === code, s.ending); }

// 2026-11-14 교사 결정: 사건 8 '친구들 모아 같이 나가자'(e8=crew)는 뒤에 도움을 청해도 A가 아니다(예방·회복 모두)
{
  const crewHelp = { c3_e8_a: 'crew', c3_e8_b: 'help' };
  const pc = play(crewHelp), rc = play({ ...SLIP.e5, ...crewHelp });
  ok('신중한 경로 + e8 crew → help: A 아님', pc.ending !== 'A' && E.evalCond('e8=crew', pc), pc.ending);
  ok('회복 e5 + e8 crew → help: A 아님(grave_harm)', rc.ending !== 'A' && E.evalCond('grave_harm', rc) && !E.evalCond('recovered', rc), rc.ending);
}

/* ── 3. 문장 ── */
const endOf = (s) => story.endings.find((e) => e.code === s.ending);
const text = (s) => [E.endingSummary(story, endOf(s), s), ...E.endingBody(story, endOf(s), s)].join(' / ');
const LINE = { e2: /민준이의 사진/, e5: /AI 도우미/, e6: /하늘이의 DM/, e7: /민준이의 번호/ };
for (const [ev, s] of Object.entries(recov)) {
  const t = text(s);
  ok(`회복 A 문장(${ev}): 바로잡은 경로 요약 · 그 사건 줄 · 없던 일이 되지 않음`, /수습을 했다/.test(E.endingSummary(story, endOf(s), s)) && LINE[ev].test(t) && /없던 일이 되지는 않는다/.test(t), t);
  ok(`회복 A 문장(${ev}): 예방 A 문장이 섞이지 않음`, !/매번|필요할 때 상대에게 물으며|함부로 꺼내지 않는 데서|모든 일을 막을 수 있었던/.test(t), t);
  for (const [ev2, re] of Object.entries(LINE)) if (ev2 !== ev && ev2 !== 'e2' && ev2 !== 'e7') ok(`회복 A(${ev}) 문장에 다른 사건(${ev2}) 줄 없음`, !(re.test(t) && /바로잡|지웠|로그아웃|알렸/.test(t.split(' / ').filter((x) => re.test(x)).join())), t);
}
// 실수의 종류를 잘못 말하지 않는다(최종 검토 2026-11-14): 방관(e7)은 '묻지 않은 것'이 아니다 — 회복 A 요약·첫 줄은 네 사건 모두에 맞는 말로
for (const [ev, st] of Object.entries(recov)) ok(`회복 A(${ev}) 요약·첫 줄이 '묻지 않고'라고 단정하지 않음`, !/묻지 않고 넘어간/.test(text(st)), text(st).slice(0, 120));
// 예방 A 문장은 고치기 전 코드와 같다(기준선 D:/Works/tmp/arec-before)
let before = null;
try { const req2 = createRequire('D:/Works/tmp/arec-before/privacy/tests/x.mjs'); before = { story: req2('../js/story.js'), E: req2('../js/engine.js') }; before.story.endingV2 = story.endingV2; } catch (e) { before = null; }
if (before) {
  for (const over of [{}, { pro_1: 'money', c1_e1_a: 'dm', c1_e2_a: 'no', c1_e3_b: 'anon', c2_e4_b: 'report', c3_e9_a: 'critique', c3_e9_b: 'calm' }, { c2_e4_b: 'report' }]) {
    const s = run(over);
    const b = before.story.endings.find((e) => e.code === 'A');
    const old = [before.E.endingSummary(before.story, b, s), ...before.E.endingBody(before.story, b, s)].join(' / ');
    ok('예방 A 문장이 고치기 전과 같음 ' + JSON.stringify(over).slice(0, 60), text(s) === old, { now: text(s), old });
  }
} else console.log('(기준선 사본이 없어 예방 A 문장 전후 비교는 건너뜀)');

/* ── 4. 피해 기록·믿음 상한 ── */
ok('회복 A(e2)여도 민준이를 해친 기록·믿음 상한 그대로', E.evalCond('hurt.minjun', recov.e2) && E.evalCond('harm_count=1', recov.e2) && E.evalCond('harmed_others', recov.e2) && recov.e2.trust.minjun <= 0, recov.e2.trust);
ok('회복 A(e7)여도 민준이를 해친 기록 그대로·믿음 ≤ 0', E.evalCond('hurt.minjun', recov.e7) && recov.e7.trust.minjun <= 0, recov.e7.trust);
ok('회복 A(e5·e6)는 뜻을 무시한 행동 기록이 남음', E.evalCond('overrode_wish', recov.e5) && E.evalCond('overrode_wish', recov.e6));

/* ── 5. 무작위 표본 ── */
const mulberry32 = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rnd = mulberry32(20261114);
let n = 0, prev = 0, rec = 0, lost = 0, badRec = 0, mism = 0;
for (let i = 0; i < 4000; i++) {
  let s = E.createState(story);
  while (s.screen !== 'ending') { if (s.screen === 'scene' && E.needsChoice(story, s)) { const cs = E.visibleChoices(story, story.scenes[s.scene], s); s = E.choose(story, s, cs[Math.floor(rnd() * cs.length)].id); s.history = []; } s = E.advance(story, s); }
  n++;
  const d = E.evalCond(condOf('D'), s), p = !d && E.evalCond(PREVENT, s), r = !d && !p && E.evalCond(RECOVER, s);
  if (p) prev++; if (r) rec++;
  if (p && s.ending !== 'A') lost++;
  if ((s.ending === 'A') !== (p || r)) mism++;
  if (r && !(computedCount(s) === 1 && E.evalCond('slip_fixed', s) && !E.evalCond('grave_harm', s))) badRec++;
}
ok(`무작위 ${n}회: 엔진 판정 = 예방 A ∪ 회복 A`, mism === 0, mism);
ok('무작위: 예방 A는 하나도 빠지지 않음', lost === 0, lost);
ok('무작위: 회복 A는 모두 실수 하나·수습 완료·회복 불가 없음', badRec === 0, badRec);

console.log(rows.map((r) => '  ' + r).join('\n'));
console.log(`  무작위 ${n}회(씨앗 20261114): 예방 A ${prev} · 회복 A ${rec}`);
console.log(`ending-a-recovery-1114 (${V}): ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
