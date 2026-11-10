// AI 프라이버시 반영(2026-11-10) 검사 — 브라우저 없이: node privacy/tests/ai-privacy.mjs
//   B 사건 4 「AI가 만든 가짜 춤 영상」: id·set·add·next·조건이 그대로인지(엔딩·수치 불변), 휴대폰 틀 그림은 선택 전에 내리는지, 옛 '합성' 글자가 남지 않았는지
//   C 성찰 카드(js/card.js 순수 로직): 자동으로 채우는 선택, 파일 이름, 저장 읽기·섞임 방지, 지우기 전 확인 조건
//   (특별 수업 A는 tests/special-class.mjs)
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js'), EM = require('../js/emph.js');
story.triggers = WORLD.triggers;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗ ' + m); } };
const run = (name, fn) => { try { fn(); } catch (e) { fails.push(name + ': ' + e.message); console.log('  ✗ ' + name + ': ' + e.message); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameKeys = (a, b) => { const ka = Object.keys(a).sort(), kb = Object.keys(b).sort(); return same(ka, kb) && ka.every((k) => a[k] === b[k]); }; // 칸 순서와 무관
const hasCg = (l) => typeof l === 'object' && l !== null && Object.prototype.hasOwnProperty.call(l, 'cg');
const norm = (l) => E.normLine(l, story);

// 엔진으로 끝(엔딩)까지 또는 stop(state)이 참일 때까지. prefs = 장면별 선택 id(없으면 첫 선택 또는 rnd)
function play(prefs, stop, rnd) {
  let s = E.createState(story);
  for (let step = 0; step < 800; step++) {
    if (stop && stop(s)) return s;
    if (s.screen === 'ending') return s;
    if (s.screen === 'scene' && E.needsChoice(story, s)) {
      const cs = E.visibleChoices(story, story.scenes[s.scene], s);
      const c = cs.find((x) => x.id === prefs[s.scene]) || (rnd ? cs[Math.floor(rnd() * cs.length)] : cs[0]);
      s = E.choose(story, s, c.id);
    }
    s = E.advance(story, s);
  }
  throw new Error('끝까지 못 감');
}

/* ───────── B. 사건 4: AI가 만든 가짜 춤 영상 ───────── */
run('e4Structure', () => {
  // 글자만 바꿨다 — 선택 id·플래그·수치·다음 장면·조건은 2026-11-10 이전과 같아야 한다(엔딩·다른 사건의 참조가 그대로 맞게)
  const WANT = {
    c2_e4_a: [
      { id: 'forward', set: { e4: 'forward' }, add: { spread: 2, serious: 1 }, next: 'c2_e4_b' },
      { id: 'refuse', set: { e4: 'refuse' }, add: { minimize: 1 }, next: 'c2_e4_b' },
      { id: 'ignore', set: { e4: 'ignore' }, next: 'c2_e4_b' }],
    c2_e4_b: [
      { id: 'ask', set: { e4b: 'ask' }, add: { consent: 1, help: 1, 'trust.saebom': 1 }, next: 'c2_e5_a' },
      { id: 'report', set: { e4b: 'report' }, add: { repair: 1 }, next: 'c2_e5_a' },
      { id: 'confess', if: 'e4=forward', set: { e4b: 'confess' }, add: { repair: 2, 'trust.saebom': -1 }, next: 'c2_e5_a' },
      { id: 'blame', set: { e4b: 'blame' }, add: { 'trust.saebom': -2 }, next: 'c2_e5_a' }]
  };
  for (const [id, want] of Object.entries(WANT)) {
    const got = story.scenes[id].choices.map((c) => { const o = { id: c.id }; for (const k of ['if', 'set', 'add', 'addV2', 'next']) if (c[k] !== undefined) o[k] = c[k]; return o; });
    ok(same(got, want), id + ' 선택 구조 그대로 ' + JSON.stringify(got));
    ok(story.scenes[id].event === 'e4' && story.scenes[id].chapter === 2, id + ' 사건·장 그대로');
  }
  ok(same(story.events.e4.outcomes.map((o) => o.if), ['e4=forward', 'e4=refuse', 'e4=ignore', 'e4b=ask', 'e4b=report', 'e4b=confess', 'e4b=blame']), '사건 결과 조건·순서 그대로');
  ok(same(story.scenes.c2_e4_a.lines.filter((l) => typeof l === 'object' && l.if).map((l) => l.if), ['e3=capture && e2post=group|story', 'e3=capture && e2post!=group|story', 'e3!=capture && e2post=group|story']), 'c2_e4_a 조건부 줄 조건 그대로');
  ok(same(story.scenes.c2_e4_b.lines.filter((l) => typeof l === 'object' && l.if).map((l) => l.if), ['e4=forward']), 'c2_e4_b 조건부 줄 조건 그대로');
  ok(story.scenes.c2_e4_a.view.type === 'place' && /매점 앞 · D-1 오후 6:05/.test(story.scenes.c2_e4_a.view.title) && story.scenes.c2_e4_b.view.type === 'dm' && story.scenes.c2_e4_b.view.title === '새봄', '장소·시간·등장 방식 그대로');
  ok(same(story.seriousSplit[1].items.filter((i) => /e4/.test(i.if)), [{ if: 'e4=forward', ch: 2 }]) && /e4=forward/.test(E.COMPUTED['hurt.saebom']) && /e4=forward/.test(E.COMPUTED.harmed_others), '다른 곳의 e4 참조 그대로');
});

run('e4Clip', () => {
  const a = story.scenes.c2_e4_a, lines = a.lines.map(norm);
  const cgs = lines.filter(hasCg).map((l) => l.cg);
  ok(same(cgs, ['saebom-selfie', 'saebom-dance', null]), '휴대폰 틀: 셀카 → 춤 영상 → 내리기 ' + JSON.stringify(cgs));
  ok(!a.view.cg, '장면 첫 화면은 그림 없이(매점 앞 무대)');
  ok(lines.filter(hasCg).every((l) => !l.if), '그림 줄은 조건 없는 줄(어느 경로에서나 같은 순서)');
  const iDown = lines.findIndex((l) => hasCg(l) && l.cg === null), iLastUp = lines.map((l, i) => (hasCg(l) && l.cg ? i : -1)).reduce((m, v) => Math.max(m, v), -1);
  ok(iDown > iLastUp && iDown < lines.length - 1, '선택지가 뜨기 전에 영상을 내린다(내린 뒤에도 대사가 이어짐) ' + iLastUp + ' < ' + iDown + ' < ' + (lines.length - 1));
  const upLines = lines.slice(lines.findIndex((l) => l.cg === 'saebom-dance'), iDown);
  ok(upLines.length >= 2 && upLines.length <= 5, '영상은 대사 몇 줄 동안만 ' + upLines.length + '줄');
  // 모든 장면에서: 휴대폰 틀 그림(story.clips)을 띄웠다면 그 장면 대사 안에서 반드시 내린다(선택 반응 줄에는 휴대폰 틀 금지)
  for (const [id, sc] of Object.entries(story.scenes)) {
    let up = false;
    (sc.lines || []).map(norm).forEach((l) => { if (hasCg(l)) up = !!(l.cg && story.clips[l.cg]); });
    ok(!up, id + ': 휴대폰 틀 그림을 내리지 않고 장면 대사가 끝남');
    for (const c of sc.choices || []) ok(!(c.react || []).map(norm).some((l) => hasCg(l) && l.cg && story.clips[l.cg]), id + '#' + c.id + ': 선택 반응 줄에 휴대폰 틀 그림');
    ok(!(sc.view && story.clips[sc.view.cg]), id + ': 장면 첫 그림(view.cg)에 휴대폰 틀 금지');
  }
  // 그림 파일
  const webp = fs.readFileSync(path.join(ROOT, 'js/webp-list.js'), 'utf8');
  ok(same(Object.keys(story.clips), ['saebom-selfie', 'saebom-dance']) && story.clips['saebom-selfie'].frames.length === 1 && story.clips['saebom-dance'].frames.length === 3, '셀카 1장 · 춤 장면 3장');
  for (const [k, c] of Object.entries(story.clips)) {
    for (const f of c.frames) ok(fs.existsSync(path.join(ROOT, f)) && fs.existsSync(path.join(ROOT, f.replace(/\.png$/, '.webp'))) && webp.includes('"' + f + '"'), k + ' 그림(png·webp·목록) ' + f);
    ok(typeof c.alt === 'string' && c.alt.length > 30 && typeof c.who === 'string' && c.who.length > 2, k + ' 대체 글·계정 줄');
  }
  ok(story.clips['saebom-dance'].video === true && !story.clips['saebom-selfie'].video, '춤 영상에만 재생 표시');
  ok(!/AI|딥페이크|가짜/.test(story.clips['saebom-dance'].who), '영상 위 계정 줄에는 "AI로 만든 영상" 표시를 붙이지 않는다(이야기 속에서는 아무 표시 없이 돈다)');
  ok(/AI/.test(story.clips['saebom-dance'].alt) && /춘 적 없는/.test(story.clips['saebom-dance'].alt), '화면 읽기 대체 글은 AI로 만든 가짜임을 말한다');
  // 무대 말풍선 기준 줄(world.js STAGES.c2_e4_a.bubbles)이 여전히 대사에 있다
  const all = lines.map((l) => EM.plain(l.text)).concat(a.choices.flatMap((c) => (c.react || []).map((l) => EM.plain(norm(l).text))));
  for (const b of WORLD.STAGES.c2_e4_a.bubbles) ok(all.some((t) => t.includes(b.on)), '무대 말풍선 기준 줄 "' + b.on + '"');
  // 프로브(emphasis)가 쓰는 첫 강조 줄
  const firstEm = lines.find((l) => EM.has(l.text));
  ok(!!firstEm && firstEm.who === 'haneul' && EM.parts(firstEm.text).filter((p) => p.strong).map((p) => p.text).join() === '다른 반 애들도', 'c2_e4_a 첫 강조 줄 = 하늘 “다른 반 애들도”');
});

run('e4Ethics', () => {
  // 대사가 담아야 할 것(설계 5.3) — 문장 자체는 교사 검수 대상, 여기서는 빠지지 않았는지만
  const a = story.scenes.c2_e4_a, b = story.scenes.c2_e4_b;
  const la = a.lines.map(norm).map((l) => EM.plain(l.text)).join('\n'), lb = b.lines.map(norm).filter((l) => l.who === 'saebom').map((l) => EM.plain(l.text)).join('\n');
  ok(/사진 한 장/.test(la) && /춘 적이 없다/.test(la), '사진 한 장으로 만들어졌고, 새봄은 이런 춤을 춘 적이 없다');
  ok(/딥페이크/.test(la) && /AI/.test(la), '단순 합성이 아니라 AI 딥페이크임을 말한다');
  ok(/진짜/.test(lb) && /춘 적 없어/.test(lb), '진짜처럼 보여서 본 사람들이 실제로 춘 줄 안다(새봄의 말)');
  const refuse = a.choices.find((c) => c.id === 'refuse'), fwd = a.choices.find((c) => c.id === 'forward');
  ok(/공개/.test(refuse.say) && /AI/.test(refuse.say) && /잘못 아니야/.test(refuse.say), '공개로 올린 사진이라도 AI의 재료로 써도 된다는 뜻은 아니다');
  ok(fwd.react.map((l) => EM.plain(norm(l).text)).some((t) => /옮긴 건 나/.test(t)), '전달하면 퍼뜨린 사람이 된다');
  // 옛 '합성' 글자가 이야기·화면 글자에 남아 있지 않다
  const texts = [];
  const push = (t) => { if (typeof t === 'string') texts.push(t); };
  for (const sc of Object.values(story.scenes)) {
    (sc.lines || []).forEach((l) => push(norm(l).text)); push(sc.label); push(sc.prompt);
    (sc.choices || []).forEach((c) => { push(c.text); push(c.say); (c.react || []).forEach((l) => push(norm(l).text)); });
  }
  for (const ev of Object.values(story.events)) { push(ev.title); push(ev.topic); ev.outcomes.forEach((o) => push(o.text)); }
  story.reflection.basic.concat(story.reflection.deep).forEach(push);
  for (const arr of Object.values(WORLD.idle)) (Array.isArray(arr) ? arr : []).forEach((l) => push(l.text));
  push(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, ''));
  const old = texts.filter((t) => /합성/.test(t));
  ok(texts.length > 500 && old.length === 0, '화면 글자 ' + texts.length + '개에 옛 "합성" 표현 없음 ' + old.map((t) => t.slice(0, 30)).join(' / '));
  // 조롱·성적 표현 금지 낱말(새봄을 깎아내리는 말)이 사건 4 글자에 없다
  const e4 = [a, b].flatMap((sc) => (sc.lines || []).map((l) => norm(l).text).concat((sc.choices || []).flatMap((c) => [c.text, c.say || ''].concat((c.react || []).map((l) => norm(l).text)))));
  ok(!e4.some((t) => /섹시|야한|몸매|노출|못생|흑역사|쪽팔/.test(t)), '사건 4에 성적·조롱 낱말 없음');
});

run('endingsSame', () => {
  // 사건 4의 글자를 바꿔도 수치·엔딩은 그대로: 대표 선택 조합마다 2026-11-10 이전에 기록해 둔 값과 같은지
  const cases = [
    [{ c2_e4_a: 'forward', c2_e4_b: 'confess' }, { e4: 'forward', e4b: 'confess' }, { spread: 2, serious: 1, repair: 2 }, -1],
    [{ c2_e4_a: 'forward', c2_e4_b: 'blame' }, { e4: 'forward', e4b: 'blame' }, { spread: 2, serious: 1 }, -2],
    [{ c2_e4_a: 'refuse', c2_e4_b: 'ask' }, { e4: 'refuse', e4b: 'ask' }, { minimize: 1, consent: 1, help: 1 }, 1],
    [{ c2_e4_a: 'ignore', c2_e4_b: 'report' }, { e4: 'ignore', e4b: 'report' }, { repair: 1 }, 0]
  ];
  for (const [prefs, flags, delta, trust] of cases) {
    const before = play(prefs, (s) => s.screen === 'scene' && s.scene === 'c2_e4_a');
    const after = play(prefs, (s) => s.screen === 'scene' && s.scene === 'c2_e5_a');
    const d = {}; for (const k of E.STAT_KEYS) if (after.stats[k] !== before.stats[k]) d[k] = after.stats[k] - before.stats[k];
    ok(sameKeys(d, delta) && after.flags.e4 === flags.e4 && after.flags.e4b === flags.e4b && after.trust.saebom - before.trust.saebom === trust, JSON.stringify(prefs) + ' 수치 변화 ' + JSON.stringify(d) + ' 새봄 믿음 ' + (after.trust.saebom - before.trust.saebom));
  }
});

/* @@CARD@@ */

console.log(`\n통과 ${pass} · 실패 ${fails.length}`);
process.exitCode = fails.length ? 1 : 0;
