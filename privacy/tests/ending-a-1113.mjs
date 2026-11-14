// 2026-11-13 교사 요청: 엔딩 A에서 consent>=2(동의 2번 이상)를 빼고 '당사자의 뜻을 무시한 행동 없음'(engine.js COMPUTED overrode_wish)으로.
//   쓰기: node tests/ending-a-1113.mjs  (ENDING_V2=0 이면 옛 판정 화면 쪽 — 두 쪽 다 돌릴 것)
//   1 overrode_wish 목록: 들어가야 할 선택은 참, 넣지 않기로 한 선택(묻지 않았을 뿐·내 정보·방관)은 거짓
//   2 대표 경로: ① 확산 0·동의 1·최소 4·수습 2·도움 2 → A  ② 동의 0으로 찍지·올리지 않은 경로 → A
//     ③ 거절·삭제·비밀 요청을 어긴 경로(다른 선택은 신중) → A 아님  ④ 가장 신중한 선택(routes.js A) → A 그대로
//   3 A 문장이 물어본 횟수와 맞는가(묻지 않은 경로에 "물었다"·"보내도 돼?"가 없다)
//   4 무작위 표본: 새 A는 모두 뜻을 무시한 행동이 없고, 옛 A였는데 새 A가 아닌 표본은 모두 뜻을 무시한 행동이 있다
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const story = require('../js/story.js'), E = require('../js/engine.js'), routes = require('./routes.js');
story.triggers = require('../js/world.js').triggers;
const V2 = story.endingV2 === true;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (extra === undefined ? '' : ' :: ' + JSON.stringify(extra))); } };

const A = story.endings.find((e) => e.code === 'A');
const OLD_A = 'spread<=2 && consent>=2 && minimize>=2 && harm_count=0';
const condOf = (code) => story.endings.find((e) => e.code === code).if;
const oldEnding = (s) => (E.evalCond(condOf('D'), s) ? 'D' : E.evalCond(OLD_A, s) ? 'A' : E.evalCond(condOf('B'), s) ? 'B' : 'C');

/* ── 0. 조건 문자열 ── */
// 2026-11-14: A = 예방 A(이 검사가 보는 11-13 규칙) || 회복 A(tests/ending-a-recovery-1114.mjs) — 아래 표본·경로 검사는 회복 A가 아닌 A(예방 A)만 본다
ok('A 조건 첫 갈래(예방 A) = spread<=2 && minimize>=2 && harm_count=0 && !overrode_wish && e8!=crew', A.if.split(' || ')[0] === 'spread<=2 && minimize>=2 && harm_count=0 && !overrode_wish && e8!=crew', A.if); // 2026-11-14 교사 결정: e8=crew는 A 불가
ok('A 조건에 consent가 없다', !/consent/.test(A.if), A.if);
ok('판정 순서 D → A → B → C 그대로', story.endings.map((e) => e.code).join('') === 'DABC');
ok('D·B 조건 그대로', condOf('D') === 'e8_unresolved_threat || serious>=3' && condOf('B') === 'repair+help>=3 && spread<=4 && harm_count<=2' && condOf('C') == null);
ok('overrode_wish는 계산 플래그', typeof E.COMPUTED.overrode_wish === 'string');

/* ── 1. overrode_wish 목록 ── */
const flagsOnly = (flags) => ({ stats: {}, trust: {}, flags });
const IN = [ // [플래그, 이유]
  [{ e2shot: 'nocheck' }, '자는 민준이를 묻지 않고 촬영'],
  [{ e2shot: 'asked', e2post: 'group' }, '"올리진 마" 뒤 단톡방에 올림'],
  [{ e2shot: 'nocheck', e2post: 'story' }, '묻지 않고 스토리에 올림'],
  [{ e2fix: 'no' }, '삭제 요청을 넘김'],
  [{ e3: 'capture' }, '"아무한테도 말하지 마" 대화를 캡처해 보냄'],
  [{ e4: 'forward' }, '새봄이 가짜 영상 전달'],
  [{ e5: 'all' }, '하늘이 번호·계좌가 든 단톡을 AI에 통째로'],
  [{ e5j: 'jiho' }, '지호가 비밀로 한 대화를 AI에'], // 2026-11-13 e5 → e5j
  [{ e6: 'peek' }, '하늘이 계정 DM 열람'],
  [{ e6: 'post' }, '하늘이 계정으로 글 올림'],
  [{ e6: 'peek', e6b: 'cap' }, '하늘이 DM 캡처 전달'],
  [{ e7: 'join' }, '민준이 번호를 낯선 사람에게'],
  [{ e9: 'share' }, '남의 이름·학교·동네·얼굴 공유']
];
for (const [f, why] of IN) ok('뜻을 무시한 행동: ' + why, E.evalCond('overrode_wish', flagsOnly(f)) === true, f);
const OUT = [
  [{}, '아무것도 안 함'],
  [{ e1: 'public' }, '내 계좌번호(내 정보)'],
  [{ e1: 'dm', e1b: 'pass' }, '하늘이가 스스로 올린 번호를 넘어감'],
  [{ e2shot: 'none' }, '찍지 않음(묻지 않았지만 무시 아님)'],
  [{ e2shot: 'asked', e2post: 'keep' }, '허락받고 찍고 안 올림'],
  [{ e2shot: 'none', e3: 'anon' }, '이름·사정 빼고 역할 재신청(묻지 않았지만 무시 아님)'],
  [{ e4: 'ignore' }, '받은 영상에 반응 안 함'],
  [{ e4: 'refuse', e4b: 'report' }, '거절·신고'],
  [{ e5: 'min' }, '필요한 부스 정보만'],
  [{ e5j: 'anon' }, '이름·사정 빼고 질문'],
  [{ e6: 'leave' }, '그냥 떠남'],
  [{ e6: 'logout' }, '로그아웃'],
  [{ e7: 'silent' }, '가만히 있음(방관 — harm_count가 맡음)'],
  [{ e7: 'warn' }, '민준이에게 알림'],
  [{ e8: 'meet' }, '내 학교·시간(내 정보)'],
  [{ e8: 'crew' }, '내 약속을 단톡에(내 정보)'],
  [{ e8_response: 'expose' }, '상대가 공개 게시판에 직접 쓴 계정·댓글'],
  [{ e9: 'critique' }, '비판만'],
  [{ e9: 'report' }, '신고']
];
for (const [f, why] of OUT) ok('뜻을 무시한 행동 아님: ' + why, E.evalCond('overrode_wish', flagsOnly(f)) === false, f);
// 모든 선택지의 set을 하나씩 넣어 본다 — IN 목록 밖의 선택이 끼어들지 않았는지
const expected = new Set(['c1_e2_a#shoot', 'c1_e2_b#group', 'c1_e2_b#story', 'c1_e2_d#no', 'c1_e3_b#capture', 'c2_e4_a#forward', 'c2_e5_a#all', 'c2_e5_j#jiho',
  'c2_e6_a#peek', 'c2_e6_a#post', 'c2_e6_b#cap', 'c3_e7_a#join', 'c3_e9_a#share']);
const actual = new Set();
for (const [id, sc] of Object.entries(story.scenes)) for (const c of sc.choices || []) if (E.evalCond('overrode_wish', flagsOnly(Object.assign({}, c.set || {})))) actual.add(id + '#' + c.id);
ok('뜻을 무시한 행동으로 세는 선택지 = 13개 목록과 같다', actual.size === expected.size && [...expected].every((k) => actual.has(k)), [...actual]);
ok('남의 정보를 퍼뜨린 선택(harmed_others)은 모두 뜻을 무시한 행동에도 든다', (() => {
  for (const [, sc] of Object.entries(story.scenes)) for (const c of sc.choices || []) {
    const st = flagsOnly(Object.assign({}, c.set || {}));
    if (E.evalCond('harmed_others', st) && !E.evalCond('overrode_wish', st)) return false;
  }
  return true;
})());

/* ── 2. 대표 경로 ── */
function play(prefs) {
  let s = E.createState(story);
  for (let n = 0; n < 800; n++) {
    if (s.screen === 'ending') return s;
    if (s.screen === 'scene' && E.needsChoice(story, s)) {
      const cs = E.visibleChoices(story, story.scenes[s.scene], s);
      const want = prefs[s.scene];
      const c = cs.find((x) => x.id === want);
      if (want && !c) throw new Error('고를 수 없는 선택: ' + s.scene + '#' + want);
      s = E.choose(story, s, (c || cs[0]).id);
    }
    s = E.advance(story, s);
  }
  throw new Error('not finished');
}
const base = Object.fromEntries(routes.A.map((p) => p.split('#')));
const run = (over) => play({ ...base, ...over });
const endOf = (s) => story.endings.find((e) => e.code === s.ending);
const text = (s) => [E.endingSummary(story, endOf(s), s), ...E.endingBody(story, endOf(s), s)].join(' / ');
const st = (s) => s.stats;
const same = (a, b) => Object.keys(b).every((k) => a[k] === b[k]);
const report = [];
const note = (name, s) => report.push(`${name}: 옛 ${oldEnding(s)} → 새 ${s.ending} ${JSON.stringify(s.stats)} 뜻무시 ${E.evalCond('overrode_wish', s)} 해친친구 ${E.evalCond('harm_count>=1', s) ? 'O' : 0}`);

// ① 확산 0·동의 1·최소 4·수습 2·도움 2, 해친 친구·뜻을 무시한 행동 없음
const P1 = { pro_1: 'photo', c1_e1_a: 'dm', c1_e1_b: 'fix', c1_e2_a: 'no', c1_e3_b: 'anon', c2_e4_a: 'refuse', c2_e4_b: 'ask', c2_e5_a: 'min', c2_e5_b: 'check',
  c2_e6_a: 'logout', c3_e7_a: 'stop', c3_e8_a: 'block', c3_e9_a: 'report' };
const p1 = run(P1); note('① 확산0·동의1·최소4·수습2·도움2', p1);
ok('① 수치 = 확산 0·동의 1·최소 4·수습 2·도움 2·위험 0', same(st(p1), { spread: 0, consent: 1, minimize: 4, repair: 2, help: 2, serious: 0 }), st(p1));
ok('① 해친 친구 0·뜻을 무시한 행동 없음', E.evalCond('harm_count=0 && !overrode_wish', p1));
ok('① → 엔딩 A', p1.ending === 'A', p1.ending);
ok('① 옛 규칙이었다면 A가 아니었다(동의 1)', oldEnding(p1) !== 'A', oldEnding(p1));
ok('① 문장: 한 번 물었다 — "필요할 때 상대에게 물으며", "매번" 없음', /필요할 때 상대에게 물으며/.test(text(p1)) && !/매번/.test(text(p1)) && /정보의 주인에게 먼저 묻고/.test(text(p1)), text(p1));

// ② 동의 0 — 찍지 않고(no) 이름·사정 빼고(anon) 필요한 것만(min) 전한, 실제로 고를 수 있는 경로
const P2 = { pro_1: 'money', c1_e1_a: 'dm', c1_e1_b: 'fix', c1_e2_a: 'no', c1_e3_b: 'anon', c2_e4_a: 'refuse', c2_e4_b: 'report', c2_e5_a: 'min', c2_e5_b: 'check',
  c2_e6_a: 'logout', c3_e7_a: 'stop', c3_e8_a: 'tell', c3_e9_a: 'critique', c3_e9_b: 'calm' };
const p2 = run(P2); note('② 동의 0·찍지/올리지 않음', p2);
ok('② 동의 0', st(p2).consent === 0, st(p2));
ok('② 다른 A 조건 충족(확산 ≤2·최소 ≥2·해친 친구 0·뜻 무시 없음·D 아님)', E.evalCond('spread<=2 && minimize>=2 && harm_count=0 && !overrode_wish', p2) && !E.evalCond(condOf('D'), p2), st(p2));
ok('② → 엔딩 A', p2.ending === 'A', p2.ending);
ok('② 옛 규칙이었다면 A가 아니었다', oldEnding(p2) !== 'A', oldEnding(p2));
ok('② 문장: "물었다"·"보내도 돼?"·"매번" 없음', !/물으며|묻고|보내도 돼\?|매번/.test(text(p2)), text(p2));
ok('② 문장: 묻지 않고 안전하게 피한 길에 맞는 말("함부로 꺼내지 않고", "찍지 않고, 올리지 않고")', /함부로 꺼내지 않고/.test(text(p2)) && /찍지 않고, 올리지 않고, 필요한 것만 전했다/.test(text(p2)) && /안 보내는 게 맞아/.test(text(p2)), text(p2));

// ③ 거절·삭제·비밀 요청을 어긴 경로 — 나머지는 가장 신중한 선택
const P3 = {
  '③a "올리진 마" 뒤 단톡방에 올리고 지움(다른 선택 신중)': { c1_e2_a: 'ask', c1_e2_b: 'group', c1_e2_d: 'all' },
  '③b 몰래 찍고 단톡방에 올리고 삭제 요청을 넘김': { c1_e2_a: 'shoot', c1_e2_b: 'group', c1_e2_d: 'no' },
  '③c 지호가 비밀로 한 대화를 AI 도우미에(다른 선택 신중)': { c2_e5_j: 'jiho', c2_e5_b: 'del' },
  '③d 자는 민준이를 묻지 않고 찍음 → 올리기 전엔 물음(안 올림)': { c1_e2_a: 'shoot', c1_e2_b: 'ask' },
  '③e 하늘이 계정 DM을 열어 봄 → 캡처 없이 로그아웃': { c2_e6_a: 'peek', c2_e6_b: 'stop' }
};
const p3 = {};
for (const [name, over] of Object.entries(P3)) {
  const s = run(over); p3[name] = s; note(name, s);
  ok(name + ' → 뜻을 무시한 행동 있음', E.evalCond('overrode_wish', s));
  ok(name + ' → 예방 A 아님(회복 A일 수는 있음 — ③e, 2026-11-14)', s.ending !== 'A' || E.evalCond('recovered', s), s.ending);
  ok(name + ' → A의 요약·본문이 나오지 않음', !/함께 세운 것이다|함부로 꺼내지 않/.test(text(s)), text(s));
}
// ③c·③d·③e는 옛 규칙(동의 2번 이상)에서는 A였다 — 새 기준이 실제로 막는 경로(③a·③b는 해친 친구 조건이 이미 막음)
ok('③c 옛 규칙에서는 A였다(뜻 무시 조건이 새로 막음)', oldEnding(p3['③c 지호가 비밀로 한 대화를 AI 도우미에(다른 선택 신중)']) === 'A');
ok('③d 옛 규칙에서는 A였다', oldEnding(p3['③d 자는 민준이를 묻지 않고 찍음 → 올리기 전엔 물음(안 올림)']) === 'A');
ok('③e 옛 규칙에서는 A였다', oldEnding(p3['③e 하늘이 계정 DM을 열어 봄 → 캡처 없이 로그아웃']) === 'A');
ok('③a 해친 친구가 있어 옛 규칙에서도 A 아님', oldEnding(p3['③a "올리진 마" 뒤 단톡방에 올리고 지움(다른 선택 신중)']) !== 'A');

// ④ 가장 신중한 선택(routes.js A) — 그대로 A, 문장도 그대로
const p4 = run({}); note('④ 가장 신중한 선택(routes.js A)', p4);
ok('④ → 엔딩 A(전후 같음)', p4.ending === 'A' && oldEnding(p4) === 'A', [oldEnding(p4), p4.ending]);
ok('④ 문장 그대로("이거 보내도 돼?", "매번 상대에게 물으며")', /이거 보내도 돼\?/.test(text(p4)) && /매번 상대에게 물으며/.test(text(p4)) && /정보의 주인에게 먼저 묻고, 필요한 범위에서만 공유하고 대응했다\./.test(text(p4)), text(p4));

/* ── 3. A 문장은 물어본 횟수마다 정확히 한 갈래 ── */
for (const c of [0, 1, 2, 3, 4]) {
  const s = { stats: { consent: c, spread: 0, minimize: 2 }, trust: {}, flags: {} };
  const body = E.endingBody(Object.assign({}, story, { endingV2: false }), A, s);
  ok(`A 본문(물어본 횟수 ${c}): 첫 줄 1개·경계 줄 1개`, body.filter((t) => /같은 반, 친한 친구 사이에서도/.test(t)).length === 1 && body.filter((t) => /^경계는/.test(t)).length === 1, body);
  ok(`A 본문(물어본 횟수 ${c}): "매번"은 2번 이상일 때만`, /매번/.test(body.join(' ')) === (c >= 2), body);
  ok(`A 요약(물어본 횟수 ${c}): "묻고"는 1번 이상일 때만`, /묻고/.test(E.endingSummary(story, A, s)) === (c >= 1), E.endingSummary(story, A, s));
}

/* ── 4. 무작위 표본(3,000회) ── */
{
  const mulberry32 = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rnd = mulberry32(20261113);
  let newA = 0, badA = 0, lost = 0, lostBad = 0, gained = 0, gainedBad = 0, textBad = 0;
  for (let n = 0; n < 3000; n++) {
    let s = E.createState(story);
    for (let k = 0; k < 800 && s.screen !== 'ending'; k++) {
      if (s.screen === 'scene' && E.needsChoice(story, s)) { const cs = E.visibleChoices(story, story.scenes[s.scene], s); s = E.choose(story, s, cs[Math.floor(rnd() * cs.length)].id); s.history = []; }
      s = E.advance(story, s);
    }
    const o = oldEnding(s);
    if (s.ending === 'A' && !E.evalCond('recovered', s)) { newA++; if (E.evalCond('overrode_wish || harm_count>=1 || spread>=3 || minimize<=1 || e8=crew', s)) badA++; if (s.stats.consent === 0 && /물으며|묻고|매번/.test(text(s))) textBad++; }
    if (o === 'A' && s.ending !== 'A') { lost++; if (!E.evalCond('overrode_wish || e8=crew', s)) lostBad++; }
    if (o !== 'A' && s.ending === 'A' && !E.evalCond('recovered', s)) { gained++; if (s.stats.consent >= 2) gainedBad++; }
  }
  ok('표본: 새 A는 모두 확산 ≤2·최소 ≥2·해친 친구 0·뜻 무시 없음', badA === 0, { newA, badA });
  ok('표본: 옛 A였는데 새 A가 아닌 것은 모두 뜻을 무시한 행동(또는 e8 crew) 때문', lostBad === 0, { lost, lostBad });
  ok('표본: 새로 A가 된 것은 모두 동의 2번 미만(동의 조건을 뺀 몫)', gainedBad === 0, { gained, gainedBad });
  ok('표본: 동의 0인 A에 "물었다" 문장 없음', textBad === 0);
  report.push(`무작위 3,000회(씨앗 20261113): 새 A ${newA} · 옛 A→새 A 아님 ${lost} · 새로 A ${gained}`);
}

console.log(`ENDING_V2=${V2}`);
for (const r of report) console.log('  ' + r);
console.log(`ending-a-1113: ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
