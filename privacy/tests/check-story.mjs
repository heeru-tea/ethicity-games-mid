// 스토리 그래프 검증: node privacy/tests/check-story.mjs
// - 연결 무결성(없는 장면·인물·플래그), 막다른 장면
// - 어떤 길로도 9개 사건을 건너뛸 수 없는지(정적 그래프)
// - 서로 다른 완주 경로 수(정확한 계산)
// - 무작위 완주 표본: 모든 장면·선택지·조건부 대사·사건 결과 문장이 실제로 나타나는지
// - 엔딩별 대표 경로(routes.js)가 의도한 엔딩에 도착하는지
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const story = require('../js/story.js');
const E = require('../js/engine.js');
const WORLD = require('../js/world.js');
const EM = require('../js/emph.js'); // [[강조]] 표시: 글자 비교는 표시를 뺀 글자로
story.triggers = WORLD.triggers; // 앱과 같은 연결: 트리거가 있는 장면 앞에 맵 단계

const errors = [];
const warn = [];
const err = (m) => errors.push(m);

// ── 1. 정적 검사 ─────────────────────────
const sceneIds = Object.keys(story.scenes);
const setFlags = new Set();
const knownStats = new Set(E.STAT_KEYS);
for (const s of Object.values(story.scenes)) for (const c of s.choices || []) Object.keys(c.set || {}).forEach((k) => setFlags.add(k));

function checkTarget(t, where) {
  const list = Array.isArray(t) ? t.map((x) => x.to) : [t];
  for (const x of list) {
    if (x == null) { err(`${where}: next 없음`); continue; }
    if (x === '@ending') continue;
    if (x.startsWith('@chapter:')) { if (!story.chapters[x.split(':')[1]]) err(`${where}: 없는 장 ${x}`); continue; }
    if (!story.scenes[x]) err(`${where}: 없는 장면 ${x}`);
  }
}
function condKeys(cond) {
  if (cond == null) return [];
  if (Array.isArray(cond)) return cond.flatMap(condKeys);
  return cond.split(/\|\||&&/).map((c) => c.trim().replace(/^!/, '').split(/>=|<=|!=|=|>|</)[0].trim())
    .flatMap((k) => k.split('+').map((x) => x.trim()));
}
function checkCond(cond, where) {
  for (const k of condKeys(cond)) {
    if (knownStats.has(k)) continue;
    if (E.COMPUTED && Object.prototype.hasOwnProperty.call(E.COMPUTED, k)) continue; // 계산 플래그(hurt.*·harmed_others)
    if (k.startsWith('trust.')) { if (!story.trustable.includes(k.slice(6))) err(`${where}: 없는 신뢰 대상 ${k}`); continue; }
    if (!setFlags.has(k)) err(`${where}: 어디서도 설정하지 않는 플래그 '${k}'`);
  }
}
function checkLines(lines, where) {
  (lines || []).forEach((l, i) => {
    const n = E.normLine(l, story);
    if (typeof l === 'string' && n.who === 'narr' && !l.startsWith('narr: ')) err(`${where} 대사${i}: 인물 id 인식 실패 "${l.slice(0, 20)}"`);
    if (n.who && n.who !== 'narr' && n.who !== 'sys' && !story.characters[n.who]) err(`${where} 대사${i}: 없는 인물 ${n.who}`);
    checkCond(n.if, `${where} 대사${i}`);
  });
}
for (const [id, s] of Object.entries(story.scenes)) {
  if (s.event && !story.events[s.event]) err(`${id}: 없는 사건 ${s.event}`);
  if (!s.label) err(`${id}: label 없음`);
  checkLines(s.lines, id);
  const ids = new Set();
  for (const c of s.choices || []) {
    if (!c.id) err(`${id}: 선택지 id 없음`);
    if (ids.has(c.id)) err(`${id}: 선택지 id 중복 ${c.id}`);
    ids.add(c.id);
    checkTarget(c.next, `${id}#${c.id}`);
    checkCond(c.if, `${id}#${c.id}`);
    checkLines(c.react, `${id}#${c.id} react`);
  }
  if (!(s.choices || []).length) checkTarget(s.next, id);
  if (s.next) checkTarget(s.next, id);
}
for (const [eid, ev] of Object.entries(story.events)) ev.outcomes.forEach((o, i) => checkCond(o.if, `사건 ${eid} 결과${i}`));
story.endings.forEach((e) => checkCond(e.if, `엔딩 ${e.code}`));
if (story.endings[story.endings.length - 1].if != null) err('마지막 엔딩은 조건 없는 기본값이어야 함');

// ── 2. 정적 도달 그래프 ─────────────────
function targetsOf(t) {
  return (Array.isArray(t) ? t.map((x) => x.to) : [t])
    .map((x) => (x && x.startsWith('@chapter:') ? story.chapters[x.split(':')[1]].start : x))
    .filter((x) => x && x !== '@ending');
}
const succ = {};
for (const [id, sc] of Object.entries(story.scenes)) succ[id] = new Set([...(sc.choices || []).flatMap((c) => targetsOf(c.next)), ...targetsOf(sc.next)]);
const eventIds = Object.keys(story.events);
const endScenes = sceneIds.filter((id) => {
  const sc = story.scenes[id];
  return [...(sc.choices || []).map((c) => c.next), sc.next].flat().some((t) => t === '@ending' || (t && t.to === '@ending'));
});
// 어떤 사건의 장면을 모두 빼도 엔딩에 닿으면, 그 사건을 건너뛰는 길이 있다는 뜻
for (const e of eventIds) {
  const banned = new Set(sceneIds.filter((id) => story.scenes[id].event === e));
  const seen = new Set([story.start]), stack = [story.start];
  while (stack.length) { const x = stack.pop(); for (const y of succ[x]) if (!banned.has(y) && !seen.has(y)) { seen.add(y); stack.push(y); } }
  if (endScenes.some((x) => seen.has(x))) err(`사건 ${e}을 건너뛰고 엔딩에 닿는 길이 있음`);
}

// ── 3. 서로 다른 완주 경로 수(정확) ──────────
// 선택지 표시·분기에 쓰이는 조건의 참/거짓만 키로 삼으면, 같은 키에서 이어지는 경로 수는 같다.
function routingConds(sc) {
  const out = [];
  for (const c of sc.choices || []) { out.push(c.if); if (Array.isArray(c.next)) c.next.forEach((n) => out.push(n.if)); }
  if (Array.isArray(sc.next)) sc.next.forEach((n) => out.push(n.if));
  return out.filter((c) => c != null);
}
const routeAtoms = [...new Set(sceneIds.flatMap((id) => routingConds(story.scenes[id]))
  .flatMap((c) => [].concat(c).flatMap((x) => x.split(/\|\||&&/))).map((a) => a.trim()))];
const countMemo = new Map();
function countPaths(s, depth) {
  if (depth > 400) { err('무한 루프 의심: ' + s.scene); return 0; }
  if (s.screen === 'ending') return 1;
  // 신뢰값은 이후 증감이 문턱 판정에 영향을 주므로 원값 그대로 포함
  const k = JSON.stringify([s.screen, s.scene, s.reaction, s.nextChapter, routeAtoms.map((a) => (E.evalCond(a, s) ? 1 : 0)).join(''), s.trust]);
  if (countMemo.has(k)) return countMemo.get(k);
  let n = 0;
  if (s.screen === 'scene' && E.needsChoice(story, s)) {
    for (const c of E.visibleChoices(story, story.scenes[s.scene], s)) {
      const a = E.choose(story, s, c.id); a.history = [];
      n += countPaths(E.advance(story, a), depth + 1);
    }
  } else if (s.screen === 'scene' && E.pendingNext(story, s) == null) err('막다른 장면: ' + s.scene);
  else n = countPaths(E.advance(story, s), depth + 1);
  countMemo.set(k, n);
  return n;
}
const totalPaths = countPaths(E.createState(story), 0);
// 무대·맵 개편은 이야기 분기를 바꾸지 않는다
if (totalPaths !== 26181792000) /* 특별 수업 28가지(설치 안 함 1 + 3×3×3) 포함. 2026-11-10 플레이테스트: 사과 장면 c3_e9_j(선택 2개)·믿음 상한으로 24,766,560,000 → 26,181,792,000 */ err('완주 경로 수가 바뀜: ' + totalPaths);

// ── 4. 무작위 완주 표본(실제 상태 그대로) ──────
const seenScene = new Set(), seenChoice = new Set(), seenLine = new Set(), seenOutcome = new Set();
const endingCount = {};
function markLines(s) {
  const scene = story.scenes[s.scene];
  (scene.lines || []).forEach((l, i) => { if (E.evalCond(E.normLine(l, story).if, s)) seenLine.add(`${s.scene}|${i}`); });
  if (s.reaction) {
    const c = scene.choices.find((c) => c.id === s.reaction);
    (c.react || []).forEach((l, i) => { if (E.evalCond(E.normLine(l, story).if, s)) seenLine.add(`${s.scene}#${c.id}|r${i}`); });
  }
}
let seed = 20261017;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
let seedSc = 7; const rndSc = () => (seedSc = (seedSc * 1103515245 + 12345) % 2147483648) / 2147483648; // 특별 수업(sc_*) 선택 전용 — 엔딩과 무관한 선택이 다른 장면의 표본 순서를 밀지 않게(2026-11-10)
const SAMPLES = Number(process.env.SAMPLES || 100000);
const EM_MAX = 2; // 장면당(장면 대사 + 반응) 강조 최대 개수 — 많으면 강조가 아니게 된다
const emCount = (lines) => lines.reduce((n, l) => n + EM.parts(l.text).filter((p) => p.strong).length + (l.meta ? EM.parts(l.meta).filter((p) => p.strong).length : 0), 0);
const emOver = new Map(), emSeen = new Set();
function play(pick) {
  let s = E.createState(story);
  const path = [];
  for (let step = 0; s.screen !== 'ending'; step++) {
    if (step > 400) { err('무한 루프 의심'); break; }
    if (s.screen === 'scene') {
      seenScene.add(s.scene); markLines(s);
      let em = emCount(E.visibleLines(story, story.scenes[s.scene].lines, s)), at = s.scene;
      if (E.needsChoice(story, s)) {
        const cs = E.visibleChoices(story, story.scenes[s.scene], s);
        const c = pick(s, cs);
        if (!c) return { s, path, fail: s.scene };
        seenChoice.add(`${s.scene}#${c.id}`); path.push(`${s.scene}#${c.id}`);
        s = E.choose(story, s, c.id); s.history = []; markLines(s);
        em += emCount(E.visibleLines(story, c.react, s)); at += '#' + c.id;
      }
      if (em) emSeen.add(at);
      if (em > EM_MAX) emOver.set(at, em);
    }
    s = E.advance(story, s);
  }
  return { s, path };
}
for (let i = 0; i < SAMPLES; i++) {
  const { s, path } = play((st, cs) => cs[Math.floor((/^sc_/.test(st.scene) ? rndSc() : rnd()) * cs.length)]);
  endingCount[s.ending] = (endingCount[s.ending] || 0) + 1;
  // ENDING_V2(2026-11-09): 안전 지표 두 줄(seriousSplit)이 serious와 맞는지 — e8 crew는 두 줄 모두 센다. serious를 올리는 새 선택이 생기면 story.js seriousSplit에 넣을 것
  { const sp = E.seriousSplit(story, s); if (sp && sp[0].value + sp[1].value - (E.evalCond('e8=crew', s) ? 1 : 0) !== s.stats.serious) err('seriousSplit 두 줄이 serious와 다름: ' + path.join(' > ')); }
  for (const e of eventIds) {
    const outs = E.eventOutcomes(story, e, s);
    outs.forEach((t) => seenOutcome.add(e + '|' + t));
    if (!outs.length) err(`사건 ${e} 결과 문장이 없는 경로: ${path.join(' > ')}`);
  }
}

// ── 5. 엔딩별 대표 경로(결정적) ─────────────
const ROUTES = require('./routes.js');
const routeResult = {};
for (const [code, route] of Object.entries(ROUTES)) {
  let i = 0;
  const r = play((st, cs) => {
    const [sc, id] = (route[i] || '').split('#');
    if (sc !== st.scene) return null;
    i++;
    return cs.find((c) => c.id === id);
  });
  if (r.fail) err(`대표 경로 ${code}: ${r.fail}에서 예정된 선택(${route[i] || '없음'})을 고를 수 없음`);
  else if (i !== route.length) err(`대표 경로 ${code}: 선택 ${route.length - i}개가 남은 채 끝남`);
  else if (r.s.ending !== code) err(`대표 경로 ${code}가 엔딩 ${r.s.ending}에 도착함`);
  routeResult[code] = r;
}

// ── 5b. 엔진: 트리거 skipIf(조건이 맞으면 걷기 생략) ──
{
  const mini = { start: 'a', trustable: [], characters: {},
    scenes: { a: { choices: [{ id: 'x', set: { f: true }, next: 'b' }, { id: 'y', next: 'b' }] }, b: { next: '@ending' } },
    endings: [{ code: 'C' }], triggers: { b: { skipIf: 'f' } } };
  const go = (id) => E.advance(mini, E.choose(mini, E.createState(mini), id));
  const sx = go('x'), sy = go('y');
  if (sx.screen !== 'scene' || sx.scene !== 'b') err('skipIf 참인데 걷기를 건너뛰지 않음: ' + sx.screen);
  if (sy.screen !== 'map' || sy.mapTarget !== 'b') err('skipIf 거짓인데 걷기가 없음: ' + sy.screen);
  if (E.isValidState(mini, Object.assign(E.clone(sy), { flags: { f: true } }))) err('skipIf 참인 map 상태가 유효로 판정됨');
}

// ── 5c. 사건 8 확장(렌즈 안에 갇힌 밤): 현장 방문만으로 D가 아님, 수습하면 회복 ──
function runRoute(route) {
  let s = E.createState(story), i = 0, mapBefore9 = false, prev = null;
  for (let step = 0; s.screen !== 'ending' && step < 600; step++) {
    if (s.screen === 'map' && s.mapTarget === 'c3_e9_a') mapBefore9 = true;
    if (s.screen === 'scene' && E.needsChoice(story, s)) {
      const [sc, id] = (route[i] || '').split('#');
      if (sc !== s.scene) return { fail: `${s.scene}에서 ${route[i] || '없음'} 예정` };
      prev = s; s = E.choose(story, s, id); s.history = []; i++;
    }
    s = E.advance(story, s);
  }
  return { s, mapBefore9 };
}
{
  const swap = (list) => ROUTES.A.flatMap((x) => (x === 'c3_e8_a#tell' ? list : [x]));
  const base = runRoute(ROUTES.A).s;
  const leave = runRoute(swap(['c3_e8_a#meet', 'c3_e8_b#go', 'c3_e8_c#leave']));
  if (leave.fail) err('e8 leave 경로: ' + leave.fail);
  else {
    if (leave.s.ending === 'D') err('현장에 갔다가 돌아왔을 뿐인데 엔딩 D');
    if (leave.s.flags.alone_meet !== true) err('leave 경로에 alone_meet 이력이 없음');
    if (!leave.mapBefore9) err('leave 경로가 사건 9 걷기를 거치지 않음');
  }
  const sup = runRoute(swap(['c3_e8_a#meet', 'c3_e8_b#go', 'c3_e8_c#fight', 'c3_e8_f#support']));
  if (sup.fail) err('e8 fight→support 경로: ' + sup.fail);
  else {
    // 2026-10-31 플레이테스트: 정문에서 싸운 경로는 수습해도 B가 아니다(serious 3 → D). D 본문은 도움을 청한 경우 문장이 바뀐다
    if (sup.s.ending === 'B') err('정문에서 싸웠는데 수습만으로 엔딩 B');
    if (sup.s.ending === 'D' && !E.evalCond('help>=2', sup.s)) err('싸운 뒤 지원 요청 경로인데 D 본문 분기(help>=2)가 안 맞음');
    if (sup.s.trust.haneul !== base.trust.haneul - 1) err(`영상 확산 감점: 하늘 신뢰 ${base.trust.haneul}→${sup.s.trust.haneul} (−1 기대)`);
    if (sup.s.stats.spread !== base.stats.spread + 1) err(`영상 확산 spread ${base.stats.spread}→${sup.s.stats.spread} (+1 기대)`);
    if (sup.mapBefore9) err('싸움 경로인데 사건 9 전에 교문에서 다시 걷게 됨');
  }
  const fine = runRoute(swap(['c3_e8_a#meet', 'c3_e8_b#go', 'c3_e8_c#fight', 'c3_e8_f#silence', 'c3_e8_i#fine']));
  if (fine.fail) err('e8 fight→silence→fine 경로: ' + fine.fail);
  else if (fine.s.ending !== 'D') err('위험이 해소되지 않았는데 엔딩 ' + fine.s.ending + ' (D 기대)');
}

// ── 5d. 내가 해친 친구는 나를 위로하지 않는다 / 가해 경로의 엔딩·에필로그엔 책임이 보인다(2026-11-02 지시서) ──
function linesOnRoute(route) {
  let s = E.createState(story), i = 0;
  const seen = [];
  for (let step = 0; s.screen !== 'ending' && step < 800; step++) {
    if (s.screen === 'scene' && !s.reaction) E.visibleLines(story, story.scenes[s.scene].lines, s).forEach((l) => seen.push({ scene: s.scene, who: l.who, text: EM.plain(l.text) }));
    if (s.screen === 'scene' && E.needsChoice(story, s)) {
      const [sc, id] = (route[i] || '').split('#');
      if (sc !== s.scene) return { fail: s.scene + ' / ' + (route[i] || '없음') };
      const c = story.scenes[sc].choices.find((x) => x.id === id);
      s = E.choose(story, s, id); s.history = []; i++;
      E.visibleLines(story, c.react, s).forEach((l) => seen.push({ scene: sc, who: l.who, text: EM.plain(l.text) }));
    }
    s = E.advance(story, s);
  }
  const end = story.endings.find((e) => e.code === s.ending);
  const body = end.body.filter((p) => typeof p === 'string' || E.evalCond(p.if, s)).map((p) => (typeof p === 'string' ? p : p.text));
  return { s, seen, body };
}
{
  const BAD = ['pro_1#sns', 'c1_e1_a#public', 'c1_e1_b#pass', 'c1_e2_a#shoot', 'c1_e2_b#story', 'c1_e2_d#no', 'c1_e3_b#capture', 'c1_e3_cap#none',
    'sc_1#on', 'sc_2#all', 'sc_3#open', 'sc_4#open', 'c2_e4_a#forward', 'c2_e4_b#blame', 'c2_e5_a#all', 'c2_e5_b#close', 'c2_e6_a#post', 'c2_e6_b#deny',
    'c3_e7_a#join', 'c3_e7_b#hide', 'c3_e8_a#meet', 'c3_e8_b#go', 'c3_e8_c#fight', 'c3_e8_f#silence', 'c3_e8_i#fine', 'c3_e9_a#share', 'c3_e9_b#keep'];
  const bad = linesOnRoute(BAD);
  if (bad.fail) err('나쁜 경로: ' + bad.fail);
  else {
    if (bad.s.ending !== 'D') err('나쁜 경로가 엔딩 ' + bad.s.ending + '에 도착(D 기대)');
    const warm = bad.seen.filter((l) => l.who === 'minjun' && /미안|걱정|괜찮아\?|언제든|같이 가 줄까/.test(l.text) && /^c3_|^ep_/.test(l.scene));
    if (warm.length) err('나쁜 경로에서 민준이 사과·걱정함: ' + warm.map((l) => l.scene + ' "' + l.text + '"').join(' / '));
    if (!bad.seen.some((l) => l.scene === 'c3_e8_b' && l.who !== 'minjun' && l.who !== 'sys')) err('나쁜 경로 9시 전: 민준 대신 말리는 사람(또는 "아무도 말리지 않았다")이 없음');
    if (bad.seen.some((l) => l.scene === 'c3_e9_a' && /\(개인톡\)/.test(l.text))) err('새봄이를 해친 경로인데 새봄이가 개인톡으로 부탁함');
    if (!bad.seen.some((l) => l.scene === 'ep_1' && l.who === 'haneul' && /너였지/.test(l.text))) err('계정 사칭·모른 척 경로에서 하늘이가 알게 되는 줄이 없음');
    if (!bad.seen.some((l) => l.scene === 'ep_1' && /각자 마주해야/.test(l.text))) err('가해 경로 에필로그에 "각자 한 일은 각자 마주" 줄이 없음');
    if (!bad.body.some((t) => /퍼뜨린 사람이기도/.test(t)) || !bad.body.some((t) => /사과하고/.test(t) && /협조/.test(t))) err('나쁜 경로 엔딩 D 본문에 양면·책임 행동 문단이 없음');
  }
  // 좋은 선택을 해 오다 9시에 나간 경로: 민준이 말리고, 다음 날 사과하고, 같이 가 준다(따뜻한 대사 그대로)
  const GOOD_OUT = ROUTES.A.flatMap((x) => (x === 'c3_e8_a#tell' ? ['c3_e8_a#meet', 'c3_e8_b#go', 'c3_e8_c#fight', 'c3_e8_f#silence', 'c3_e8_i#accept'] : [x]));
  const good = linesOnRoute(GOOD_OUT);
  if (good.fail) err('좋은 경로(9시 외출): ' + good.fail);
  else {
    const want = [['c3_e8_b', '진짜 나가?'], ['c3_e8_i', '미안'], ['c3_e8_i', '같이 가 줄까?']];
    want.forEach(([sc, t]) => { if (!good.seen.some((l) => l.scene === sc && l.who === 'minjun' && l.text.indexOf(t) >= 0)) err('좋은 경로에서 민준의 대사가 빠짐: ' + sc + ' "' + t + '"'); });
    if (good.body.some((t) => /퍼뜨린 사람이기도/.test(t))) err('남의 정보를 퍼뜨리지 않은 경로에 책임 문단이 나옴');
  }
  const goodA = linesOnRoute(ROUTES.A);
  if (!goodA.fail && goodA.seen.some((l) => /각자 마주해야/.test(l.text))) err('대표 경로 A 에필로그에 가해 경로 줄이 나옴');
}

// ── 5e. 2026-11-10 플레이테스트: 나쁜 선택을 여럿 한 경로는 B가 아니고, 믿음·에필로그가 피해를 반영한다 / 실수 한두 번 뒤 수습한 경로는 B ──
{
  const pick = (base, over) => Object.entries(Object.assign({}, base, over)).map(([k, v]) => k + '#' + v);
  const byScene = (route) => Object.fromEntries(route.map((x) => x.split('#')));
  const REPRO = pick({}, { pro_1: 'photo', c1_e1_a: 'public', c1_e1_b: 'fixboth', c1_e2_a: 'shoot', c1_e2_b: 'group', c1_e2_d: 'all', c1_e3_b: 'capture', c1_e3_cap: 'part',
    sc_1: 'none', c2_e4_a: 'ignore', c2_e4_b: 'report', c2_e5_a: 'jiho', c2_e5_b: 'del', c2_e6_a: 'peek', c2_e6_b: 'stop', c3_e7_a: 'silent', c3_e7_b: 'del',
    c3_e8_a: 'crew', c3_e8_b: 'go', c3_e8_c: 'leave', c3_e9_a: 'ask', c3_e9_j: 'sorry', c3_e9_b: 'calm' });
  const r = linesOnRoute(REPRO);
  if (r.fail) err('재현 경로(1110): ' + r.fail);
  else {
    if (r.s.ending === 'B' || r.s.ending === 'A') err('나쁜 선택을 여럿 한 재현 경로가 엔딩 ' + r.s.ending);
    if (!(r.s.trust.jiho < 0) || !(r.s.trust.minjun < 0)) err('재현 경로: 지호·민준 믿음이 내려가지 않음 ' + JSON.stringify(r.s.trust));
    const at = (sc, re) => r.seen.findIndex((l) => l.scene === sc && re.test(l.text));
    if (at('c3_e8_a', /정문 9시/) < 0 || r.s.flags.e8_place_known !== true) err('crew 경로: 시간·장소를 알리는 줄(e8_place_known)이 없음');
    const b = story.scenes.c3_e8_b.lines, last = b[b.length - 1]; // 질문(“9시까지 30분”) 바로 앞 = 장면 대사의 마지막 줄
    if (!(last && last.who === 'haneul' && last.if === 'e8=crew' && /못 갈 듯/.test(last.text)) || !r.seen.some((l) => l.scene === 'c3_e8_b' && /못 갈 듯/.test(l.text))) err('crew 경로 9시 전: 하늘의 "못 갈 듯"이 마지막 줄이 아님');
    if (r.seen.some((l) => l.scene === 'ep_1' && /고마웠어|올린 것도 너였지만/.test(l.text))) err('재현 경로 에필로그에 민준의 사진 대사가 나옴');
    if (r.seen.some((l) => l.scene === 'ep_1' && /더 커지기 전에/.test(l.text))) err('재현 경로 에필로그에 "더 커지기 전에"가 나옴');
    if (!r.seen.some((l) => l.scene === 'ep_1' && /그 옆에 서 있었다/.test(l.text))) err('가만히 있던 경로(e7=silent) 에필로그 줄이 없음');
    if (!r.seen.some((l) => l.scene === 'c3_e9_j')) err('캡처 전달을 알게 된 지호와의 사과 장면(c3_e9_j)을 거치지 않음');
  }
  // 대표 경로 A(가장 신중한 선택)에서 한두 군데만 실수로 바꾼 경로 — 장면 순서대로 다시 늘어놓는다. 나머지가 모두 신중하면 A, 아니면 B(둘 다 C·D는 아님)
  // 대표 경로 B(routes.js: 계좌 공개·사진 단톡 뒤 수습)는 위 5절에서 B 도착을 확인한다
  const A = byScene(ROUTES.A);
  const order = ['pro_1', 'c1_e1_a', 'c1_e1_b', 'c1_e2_a', 'c1_e2_b', 'c1_e2_d', 'c1_e3_b', 'c1_e3_cap', 'sc_1', 'sc_2', 'sc_3', 'sc_4', 'c2_e4_a', 'c2_e4_b', 'c2_e5_a', 'c2_e5_b', 'c2_e6_a', 'c2_e6_b', 'c3_e7_a', 'c3_e7_b', 'c3_e8_a', 'c3_e9_a', 'c3_e9_j', 'c3_e9_b'];
  const mk = (over) => { const m = Object.assign({}, A, over); return order.filter((k) => m[k]).map((k) => k + '#' + m[k]); };
  for (const [name, over] of [['사진을 단톡에 올렸다가 지우고 부탁', { c1_e2_a: 'shoot', c1_e2_b: 'group', c1_e2_d: 'all' }],
    ['사진 단톡 + 캡처 전달 뒤 둘 다 수습', { c1_e2_a: 'shoot', c1_e2_b: 'group', c1_e2_d: 'all', c1_e3_b: 'capture', c1_e3_cap: 'full' }]]) {
    const x = linesOnRoute(mk(over));
    if (x.fail) err('실수 뒤 수습 경로(' + name + '): ' + x.fail);
    else if (x.s.ending !== 'B' && x.s.ending !== 'A') err('실수 뒤 수습 경로(' + name + ')가 엔딩 ' + x.s.ending + ' (A·B 기대)');
    else if (x.s.trust.minjun > 0) err('해친 친구의 믿음이 처음보다 올라감: 민준 ' + x.s.trust.minjun);
  }
  // 자료 설명(c2_e5_a): 실제 단톡방에 올라간 번호만 — "28명 … 전화번호·계좌번호"라고 하지 않는다
  for (const l of story.scenes.c2_e5_a.lines) if (l && l.meta && /28명 이름·전화번호·계좌번호/.test(l.meta)) err('AI 도우미 자료 설명이 28명 모두의 번호처럼 읽힘');
  if (E.evalCond('harmed_others', { stats: {}, trust: {}, flags: { e2post: 'group' } }) !== true) err('harmed_others에 e2post=group이 없음');
}

// ── 6. 커버리지 ──────────────────────────
for (const id of sceneIds) if (!seenScene.has(id)) err('도달하지 않은 장면: ' + id);
for (const [id, sc] of Object.entries(story.scenes)) {
  for (const c of sc.choices || []) if (!seenChoice.has(`${id}#${c.id}`)) err(`한 번도 나타나지 않은 선택지: ${id}#${c.id}`);
  (sc.lines || []).forEach((l, i) => { if (!seenLine.has(`${id}|${i}`)) err(`한 번도 표시되지 않은 대사: ${id} 대사${i}`); });
  for (const c of sc.choices || []) (c.react || []).forEach((l, i) => { if (!seenLine.has(`${id}#${c.id}|r${i}`)) err(`한 번도 표시되지 않은 반응: ${id}#${c.id} 반응${i}`); });
}
for (const [eid, ev] of Object.entries(story.events)) ev.outcomes.forEach((o) => { if (!o.legacy && !seenOutcome.has(eid + '|' + o.text)) err(`한 번도 나오지 않은 사건 결과: ${eid} "${o.text}"`); });
for (const e of story.endings) if (!endingCount[e.code] && routeResult[e.code]?.s.ending !== e.code) err('도달 불가 엔딩: ' + e.code);

// ── 6b. 맵 검사 ──────────────────────────
const TRIGGER_ORDER = ['pro_1', 'c1_e1_a', 'c1_e2_a', 'c1_e3_a', 'c2_e4_a', 'c2_e5_a', 'c2_e6_a', 'c3_e7_a', 'c3_e8_a', 'c3_e9_a', 'ep_1'];
for (const id of Object.keys(WORLD.triggers)) if (!story.scenes[id]) err('맵 트리거가 없는 장면을 가리킴: ' + id);
for (const id of TRIGGER_ORDER) if (!WORLD.triggers[id]) err('맵 트리거 누락: ' + id);
// 다른 사건(또는 장 시작)에서 넘어오는 장면 = 사건 입구 → 반드시 트리거가 있어야 걸어서 들어간다
for (const [id, sc] of Object.entries(story.scenes)) {
  for (const t of succ[id]) { const to = story.scenes[t]; if (to.event !== sc.event && to.event && !WORLD.triggers[t]) err('사건 입구인데 맵 트리거 없음: ' + t); }
}
for (const n of Object.values(story.chapters)) if (!WORLD.triggers[n.start]) err('장 시작 장면에 맵 트리거 없음: ' + n.start);
// 등교 오프닝: 시작 장면도 걸어서 들어간다
if (!WORLD.triggers[story.start]) err('시작 장면에 트리거 없음(등교 오프닝): ' + story.start);
{ const s0 = E.createState(story); if (s0.screen !== 'map' || s0.mapTarget !== story.start) err('createState가 오프닝 맵으로 시작하지 않음'); }
// 장면 무대가 플레이어를 옮기므로 모든 걷기 구간은 시작 위치를 명시한다
for (const [id, t] of Object.entries(WORLD.triggers)) if (!t.spawn || !WORLD.SPAWNS[t.spawn]) err('트리거 spawn 없음/잘못됨: ' + id);
for (const [id, t] of Object.entries(WORLD.triggers)) {
  if (Array.isArray(t.greet)) t.greet.forEach((g, i) => { if (!g.text || (g.who && !story.characters[g.who])) err(id + ': greet ' + i + ' 형식 오류'); });
  for (const w of Object.keys(t.castLines || {})) if (!t.cast.some((c) => c.who === w)) err(id + ': castLines 인물이 cast에 없음 ' + w);
}
let prevEnd = null;
const walkLengths = []; let walkTotal = 0;
for (const id of TRIGGER_ORDER) {
  const tr = WORLD.triggers[id];
  if (!tr) continue;
  const blocked = {};
  const seenAt = {};
  for (const c of tr.cast) {
    if (!story.characters[c.who]) err(id + ': 없는 인물 ' + c.who);
    if (!WORLD.walkable(c.x, c.y)) err(id + ': ' + c.who + '이 막힌 칸(' + c.x + ',' + c.y + ')에 서 있음');
    if (seenAt[c.x + ',' + c.y]) err(id + ': 두 인물이 같은 칸 ' + c.x + ',' + c.y);
    seenAt[c.x + ',' + c.y] = true; blocked[c.x + ',' + c.y] = true;
  }
  let contains;
  if (tr.target.npc) {
    const c = tr.cast.find((c) => c.who === tr.target.npc);
    if (!c) { err(id + ': 대상 인물 ' + tr.target.npc + '이 배치되지 않음'); continue; }
    contains = (x, y) => x === c.x && y === c.y;
  } else {
    const o = WORLD.object(tr.target.obj);
    if (!o) { err(id + ': 없는 사물 ' + tr.target.obj); continue; }
    contains = (x, y) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h;
  }
  let start = tr.spawn ? WORLD.SPAWNS[tr.spawn] : prevEnd;
  if (!start) { err(id + ': 시작 위치를 알 수 없음(첫 트리거엔 spawn 필요)'); continue; }
  if (!WORLD.walkable(start.x, start.y, blocked)) { // 앱과 같은 규칙: 인물과 겹치면 가장 가까운 빈칸으로
    const p = WORLD.findPath({ x: start.x, y: start.y }, (x, y) => WORLD.walkable(x, y, blocked), {});
    if (!p) { err(id + ': 시작 위치 근처에 빈칸 없음'); continue; }
    let cur = { x: start.x, y: start.y }; for (const d of p) cur = WORLD.stepFrom(cur.x, cur.y, d, {});
    start = cur;
  }
  const path = WORLD.findPath({ x: start.x, y: start.y }, WORLD.adjacentTo({ contains }), blocked);
  if (!path) { err(id + ': 시작 위치에서 대상까지 걸어갈 수 없음'); continue; }
  walkLengths.push(id + ' ' + path.length + '칸'); walkTotal += path.length;
  let cur = { x: start.x, y: start.y }; for (const d of path) cur = WORLD.stepFrom(cur.x, cur.y, d, blocked);
  prevEnd = cur;
}
{
  // 집 사건은 교문을 지나 걸어야만 닿는지: 마당 교문 출입구를 막으면 길이 없어야 함
  const gateBlocked = {};
  for (const [k, d] of Object.entries(WORLD.DOORS)) if (d.scene === 'village' && WORLD.sceneAt(Number(k.split(',')[0])).id === 'yard') gateBlocked[k] = true;
  const bed = WORLD.object('bed');
  const p = WORLD.findPath(WORLD.SPAWNS.classroom, WORLD.adjacentTo({ contains: (x, y) => x >= bed.x && x < bed.x + bed.w && y >= bed.y && y < bed.y + bed.h }), gateBlocked);
  if (p) err('교문을 지나지 않고 집에 갈 수 있는 길이 있음');
}

// ── 6d. 장면 그림 맵 검사(2026-10-31 개편: 장면 5개를 이어 붙인 격자, 출입구로 오감) ──
{
  if (WORLD.W !== WORLD.SW * WORLD.SCENES.length || WORLD.H !== WORLD.SH) err('격자 크기가 장면 수와 안 맞음: ' + WORLD.W + '×' + WORLD.H);
  for (const sc of WORLD.SCENES) if (!sc.img) err('장면 그림 없음: ' + sc.id);
  // 출입구: 도착 칸은 걸을 수 있고 문이 아니며, 다른 장면에 있다. 장면마다 다른 장면으로 이어지는 문이 있다
  for (const [k, d] of Object.entries(WORLD.DOORS)) {
    const [x, y] = k.split(',').map(Number);
    if (!WORLD.walkable(x, y)) err('출입구 칸이 막힘: ' + k);
    if (!WORLD.walkable(d.to[0], d.to[1])) err('출입구 도착 칸이 막힘: ' + k + ' → ' + d.to);
    if (WORLD.DOORS[d.to[0] + ',' + d.to[1]]) err('도착 칸이 또 문(왕복 튕김): ' + k);
    if (WORLD.sceneAt(x) === WORLD.sceneAt(d.to[0])) err('같은 장면 안 출입구: ' + k);
  }
  // 모든 장면이 서로 오갈 수 있다(교실에서 출발해 각 장면의 아무 칸에, 그리고 돌아오기)
  const C0 = WORLD.SPAWNS.classroom;
  for (const sc of WORLD.SCENES) {
    // 걷기 워프로만 가는 장면(특별실 ai_lab = 특별 수업 걷기에서만, 2026-11-10)은 그 워프를 켠 채로 확인
    const wt = Object.values(WORLD.triggers).find((t) => t.warp && WORLD.sceneAt(t.warp.to[0]) === sc);
    WORLD.setWarp(wt ? wt.warp : null);
    const there = WORLD.findPath(wt ? WORLD.SPAWNS[wt.spawn] : C0, (x) => WORLD.sceneAt(x) === sc, {});
    if (!there) { err('교실에서 갈 수 없는 장면: ' + sc.id); continue; }
  }
  WORLD.setWarp(null);
  // 장면 경계로 새지 않는다: 이웃한 두 장면의 맞닿은 칸이 둘 다 걸을 수 있으면 문 없이 넘어가 버림
  for (let i = 1; i < WORLD.SCENES.length; i++) {
    const xL = WORLD.SCENES[i].ox - 1, xR = WORLD.SCENES[i].ox;
    for (let y = 0; y < WORLD.H; y++) if (WORLD.walkable(xL, y) && WORLD.walkable(xR, y)) err('장면 경계가 열림: ' + xL + '|' + xR + ',' + y);
  }
  // 위·아래 끝 줄은 문 말고는 막혀 있거나 장면 안쪽(바깥으로 걸어 나가지 않게: 격자 밖은 tile()이 '#')
  // 이웃집 2채 + 길 끝 우리 집
  const NB = WORLD.NEIGHBORS || [];
  if (NB.length !== 2) err('이웃집이 2채가 아님: ' + NB.length);
  const road = WORLD.SPAWNS.road;
  for (const n of NB) {
    if (!WORLD.walkable(n.approach.x, n.approach.y)) err('이웃집 현관 앞이 막힘: ' + n.id);
    if (!WORLD.findPath({ x: road.x, y: road.y }, (x, y) => x === n.approach.x && y === n.approach.y, {})) err('마을 길에서 이웃집 현관 앞까지 길이 없음: ' + n.id);
    if (!WORLD.object(n.id) || !WORLD.object(n.id).look) err('이웃집 조사 지점·문구 없음: ' + n.id);
  }
  for (const t of Object.values(WORLD.triggers)) if (t.target.obj && NB.some((n) => n.id === t.target.obj)) err('이웃집이 사건 목적지가 됨');
  const home = Object.entries(WORLD.DOORS).find(([, d]) => d.scene === 'room');
  if (!home) err('우리 집(내 방으로 가는) 현관 없음');
  else {
    const hx = Number(home[0].split(',')[0]);
    // 우리 집은 길 끝 마지막 집: 이웃집 현관보다 오른쪽
    if (NB.some((n) => n.approach.x >= hx)) err('우리 집이 길 끝 마지막 집이 아님');
    const mb = WORLD.object('mailbox');
    if (!mb || Math.abs(mb.x - hx) > 3) err('우편함이 우리 집 현관 근처가 아님');
  }
  // 내 방 가구에 닿을 수 있다(침대·컴퓨터·팬더) — 방에 들어선 칸에서
  const roomIn = WORLD.DOORS[home[0]].to;
  for (const id of ['bed', 'mypc', 'plush']) {
    const o = WORLD.object(id);
    if (!WORLD.findPath({ x: roomIn[0], y: roomIn[1] }, WORLD.adjacentTo({ contains: (x, y) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h }), {})) err('내 방 ' + id + '에 닿을 수 없음');
  }
  // 조사 지점은 서서 볼 수 있는 칸이 하나 이상 붙어 있다
  for (const o of WORLD.OBJECTS) {
    let ok = false;
    for (let y = o.y - 1; y <= o.y + o.h && !ok; y++) for (let x = o.x - 1; x <= o.x + o.w && !ok; x++) {
      const inside = x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h;
      const edge = (x === o.x - 1 || x === o.x + o.w) !== (y === o.y - 1 || y === o.y + o.h); // 대각선 제외
      if (!inside && edge && WORLD.walkable(x, y)) ok = true;
    }
    if (!ok) err('조사 지점 옆에 설 칸이 없음: ' + o.id);
  }
  // 매점은 날마다 잘 팔리는 간식이 바뀐다: 걷기 구간의 모든 날에 문구가 있고, 날마다 다르며, 상표 이름이 없다
  const store = WORLD.object('store');
  const days = [...new Set(Object.values(WORLD.triggers).map((t) => String(t.time).split(' · ')[0]))];
  for (const d of days) if (!store.looks || !store.looks[d]) err('매점 문구가 없는 날: ' + d);
  const storeTexts = Object.values(WORLD.triggers).map((t) => WORLD.lookFor(store, t.time));
  if (new Set(days.map((d) => WORLD.lookFor(store, d + ' · 오후'))).size !== days.length) err('매점 문구가 날마다 다르지 않음');
  const BRAND = /치토스|새우깡|포카칩|꼬북칩|빼빼로|초코파이|홈런볼|맛동산|칸쵸|메로나|월드콘|비비빅|죠스바|스크류바|바나나맛/;
  for (const t of storeTexts) if (!t || BRAND.test(t)) err('매점 문구가 비었거나 상표 이름: ' + t);
  if (WORLD.lookFor(WORLD.object('bed'), 'D-4 · 하교') !== WORLD.object('bed').look) err('날 문구가 없는 사물은 기본 문구여야 함');
}

// ── 6c. 장면 무대 검사 ─────────────────────
// 모든 장면은 맵 위 한 장소에서 벌어진다: 장소·인물 위치·말풍선 기준 줄이 실제로 맞는지
function sceneTexts(id) {
  const sc = story.scenes[id], out = [];
  const add = (l) => { const n = E.normLine(l, story); if (n && n.text) out.push(EM.plain(n.text)); };
  (sc.lines || []).forEach(add);
  for (const c of sc.choices || []) { if (c.say) out.push(c.say); (c.react || []).forEach(add); }
  return out;
}
const STAGES = WORLD.STAGES || {}, PLACES = WORLD.PLACES || {};
for (const id of sceneIds) {
  const st = STAGES[id];
  if (!st) { err('무대 없음: ' + id); continue; }
  const pl = PLACES[st.place];
  if (!pl) { err('무대 장소 잘못됨: ' + id + ' ' + st.place); continue; }
  const me = st.me || pl.me;
  if (!me.pose && !WORLD.walkable(me.x, me.y)) err('무대에서 내가 막힌 칸: ' + id); // pose(침대에 누움 등)는 가구 위 소수 좌표(2026-11-03)
  if (['day', 'evening', 'night'].indexOf(st.tint) < 0) err('무대 시간대 잘못됨: ' + id);
  if (st.device && ['phone', 'monitor', 'none'].indexOf(st.device) < 0) err('무대 기기 잘못됨: ' + id);
  const dev = st.device || { group: 'phone', dm: 'phone', sns: 'phone', ai: 'monitor', pc: 'monitor', place: 'none' }[(story.scenes[id].view || {}).type];
  if (st.pcOn && dev !== 'monitor') err('컴퓨터가 켜진 무대인데 모니터가 아님: ' + id);
  const at = { [me.x + ',' + me.y]: 'me' };
  for (const c of st.cast) {
    if (!story.characters[c.who]) err('무대 인물 없음: ' + id + '/' + c.who);
    if (!WORLD.walkable(c.x, c.y)) err('무대 인물이 벽·가구 위: ' + id + '/' + c.who + ' ' + c.x + ',' + c.y);
    if (at[c.x + ',' + c.y]) err('무대에서 같은 칸에 둘: ' + id + ' ' + c.x + ',' + c.y);
    at[c.x + ',' + c.y] = c.who;
  }
  const texts = sceneTexts(id);
  for (const b of st.bubbles || []) {
    if (!texts.some((t) => t.indexOf(b.on) >= 0)) err('말풍선 기준 줄 없음: ' + id + ' "' + b.on + '"');
    if (b.who !== 'me' && !st.cast.some((c) => c.who === b.who)) err('말풍선 인물이 무대에 없음: ' + id + '/' + b.who);
  }
}

// ── 6e. 강조 표시([[…]]) ──────────────────
// 짝이 맞고 겹치지 않음 / 선택지·내 말·질문·제목에는 없음(정답 신호 금지) / 장면당 2개까지(무작위 완주에서 실제로 보인 것)
{
  const bad = (t) => { if (typeof t !== 'string') return false; const ps = EM.parts(t); return ps.some((p) => p.strong && (/\[\[|\]\]/.test(p.text) || !p.text.trim())) || /\[\[|\]\]/.test(ps.filter((p) => !p.strong).map((p) => p.text).join('')); };
  const lineTexts = (l) => { const n = E.normLine(l, story); return [n.text, n.meta, n.alt]; };
  for (const [id, sc] of Object.entries(story.scenes)) {
    (sc.lines || []).forEach((l, i) => lineTexts(l).forEach((t) => { if (bad(t)) err(`강조 표시 짝이 안 맞음: ${id} 대사${i}`); }));
    for (const c of sc.choices || []) {
      (c.react || []).forEach((l, i) => lineTexts(l).forEach((t) => { if (bad(t)) err(`강조 표시 짝이 안 맞음: ${id}#${c.id} 반응${i}`); }));
      [c.text, c.say].forEach((t) => { if (t && EM.has(t)) err(`선택지·내 말에 강조 표시(정답 신호): ${id}#${c.id}`); });
    }
    const titles = [sc.prompt, sc.label, ...[].concat((sc.view || {}).title || []).map((x) => (typeof x === 'string' ? x : x.title)), (sc.view || {}).meta];
    titles.forEach((t) => { if (t && /\[\[|\]\]/.test(t)) err('질문·제목에 강조 표시: ' + id); });
  }
  for (const [eid, ev] of Object.entries(story.events)) { if (/\[\[|\]\]/.test(ev.title + ev.topic)) err('사건 제목에 강조 표시: ' + eid); ev.outcomes.forEach((o, i) => { if (bad(o.text)) err(`강조 표시 짝이 안 맞음: 사건 ${eid} 결과${i}`); }); }
  story.endings.forEach((e) => { if (/\[\[|\]\]/.test(e.title)) err('엔딩 제목에 강조 표시: ' + e.code); [e.summary, ...e.body.map((p) => (typeof p === 'string' ? p : p.text))].forEach((t) => { if (bad(t)) err('강조 표시 짝이 안 맞음: 엔딩 ' + e.code); }); });
  for (const [k, n] of emOver) err(`한 장면에 강조가 ${n}개(최대 ${EM_MAX}): ${k}`);
  // 표시 도구 자체: 조각·맨 글자·별명 막기
  const ps = EM.parts('가 [[28명 방에]] 나 [[둘]]');
  if (ps.length !== 4 || !ps[1].strong || ps[1].text !== '28명 방에' || EM.plain('가 [[28명 방에]] 나') !== '가 28명 방에 나') err('emph.js parts/plain 오류');
  if (EM.has(EM.safe('[[별명]]')) || EM.plain(EM.safe('[[별명]]')).replace(/\u200b/g, '') !== '[[별명]]') err('emph.js safe: 별명 속 [[ ]]가 강조로 읽힘');
  if (EM.plain('짝 없는 [[괄호') !== '짝 없는 [[괄호') err('emph.js: 짝 없는 괄호는 글자 그대로여야 함');
  console.log(`강조 표시: 장면·반응 조합 ${emSeen.size}곳에서 보임 (장면당 최대 ${EM_MAX}개)`);
}

// ── 7. 보고 ──────────────────────────────
const decisionScenes = sceneIds.filter((id) => (story.scenes[id].choices || []).length);
const choiceTotal = sceneIds.reduce((n, id) => n + (story.scenes[id].choices || []).length, 0);
const lineTotal = sceneIds.reduce((n, id) => n + (story.scenes[id].lines || []).length
  + (story.scenes[id].choices || []).reduce((m, c) => m + (c.react || []).length, 0), 0);
console.log(`장면 ${sceneIds.length}개 · 선택 지점 ${decisionScenes.length}곳 · 선택지 ${choiceTotal}개 · 대사 ${lineTotal}줄 · 사건 ${eventIds.length}개 · 엔딩 ${story.endings.length}종`);
console.log(`서로 다른 완주 경로: ${totalPaths.toLocaleString()}가지`);
console.log('맵 이동 거리(최단): ' + walkLengths.join(' · ') + ' · 합계 ' + walkTotal + '칸');
// 엔딩 연출의 “아무거나 골랐다면 n%”(js/odds.js)가 실제 무작위 완주 비율과 1%p 안에서 맞는지(표본이 충분할 때)
{
  const ODDS = require('../js/odds.js');
  if (SAMPLES >= 50000) for (const e of story.endings) {
    const real = (endingCount[e.code] || 0) / SAMPLES * 100;
    if (typeof ODDS[e.code] !== 'number' || Math.abs(ODDS[e.code] - real) > 1) errors.push('js/odds.js 엔딩 ' + e.code + ' 확률이 실제와 다름: ' + ODDS[e.code] + '% vs ' + real.toFixed(1) + '%');
  }
}
console.log(`ENDING_V2=${story.endingV2} · `);
console.log(`무작위 완주 ${SAMPLES.toLocaleString()}회 엔딩 분포: ` + story.endings.map((e) => `${e.code} ${((endingCount[e.code] || 0) / SAMPLES * 100).toFixed(1)}%`).join(' · '));
for (const e of story.endings) {
  const r = routeResult[e.code];
  console.log(`\n[엔딩 ${e.code}] ${e.title}` + (r && !r.fail ? ` — 대표 경로(선택 ${r.path.length}번, 도착 ${r.s.ending})` : ''));
  if (r && !r.fail) console.log('  ' + r.path.join(' > '));
}
if (errors.length) {
  console.log(`\n✗ 오류 ${errors.length}건:\n- ` + [...new Set(errors)].slice(0, 60).join('\n- '));
  process.exit(1);
}
console.log('\n✓ 검증 통과: 끊긴 연결·막다른 장면 없음 / 사건을 건너뛰는 길 없음 / 모든 장면·선택지·조건부 대사·사건 결과 등장 / 엔딩 A~D 대표 경로 도착');

