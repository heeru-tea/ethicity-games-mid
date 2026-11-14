// 2026-11-13 사건 5 「AI 도우미 루미」 확장 — 두 가지 일(안내문 · 지호 고민) + AI 에이전트 장면 + 성찰 카드 둘째 주제
//   설계 docs/specs/2026-11-13-ai-agent-scene-design.md · 계획 docs/plans/2026-11-13-ai-agent-scene.md
//   쓰기: node tests/ai-agent-1113.mjs  (ENDING_V2=0 으로도 — 수치 표는 두 판정을 다 본다)
//   when      선택지의 조건부 효과(기본 set 뒤 상태로 판정, addV2는 V2에서만, 0 밑으로 안 내려감)
//   migrate   옛 진행(e5=jiho|anon 한 칸) → e5j, 사건 5 도중 저장은 새 흐름 자리로
//   wish      overrode_wish = e5=all || e5j=jiho
//   statOnce  사건 5 수치는 두 일을 합쳐 한 번(둘 다 조심 = 최소 +1, 하나라도 통째로 = V2 확산 +1·최소 -1)
//   undo      지호 일에서 되돌려 다시 골라도 두 번 더해지지 않음
//   conds     설정 화면 del/check가 어느 쪽이든 '통째로 넣은 적'에 맞게
//   agent*    에이전트 장면: 선택 4개·엔딩 무관·연결 플래그·결과 한 줄 · cardTopic 성찰 카드 둘째 주제 · cardSig 옛 카드 지문
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const story = require('../js/story.js'), E = require('../js/engine.js');
story.triggers = require('../js/world.js').triggers;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const on = (k) => !ONLY || ONLY.includes(k);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (extra === undefined ? '' : ' :: ' + JSON.stringify(extra))); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const mulberry32 = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const withV2 = (v2, fn) => { const keep = story.endingV2; story.endingV2 = v2; try { return fn(); } finally { story.endingV2 = keep; } };

/* ── when: 조건부 효과 ── */
if (on('when')) {
  const zero = () => ({ spread: 0, consent: 0, minimize: 0, repair: 0, help: 0, serious: 0 });
  const mini = (choice, v2 = true) => ({ endingV2: v2, characters: {}, trustable: [], scenes: { s: { choices: [Object.assign({ id: 'x', next: 's' }, choice)] } } });
  const st = (flags = {}, stats = {}) => ({ v: 1, screen: 'scene', scene: 's', reaction: null, stats: Object.assign(zero(), stats), trust: {}, flags, history: [], visited: ['s'] });
  const pick = (choice, s, v2) => E.choose(mini(choice, v2), s, 'x');
  let r = pick({ set: { a: 1 }, when: [{ if: 'b=1', set: { c: 2 }, add: { repair: 1 } }] }, st({ b: 1 }));
  ok('when 조건이 맞으면 set·add 반영', r.flags.c === 2 && r.stats.repair === 1 && r.flags.a === 1, { flags: r.flags, stats: r.stats });
  r = pick({ when: [{ if: 'b=1', set: { c: 2 }, add: { repair: 1 } }] }, st({ b: 0 }));
  ok('when 조건이 안 맞으면 무시', !('c' in r.flags) && r.stats.repair === 0);
  r = pick({ when: [{ if: 'b=1', add: { repair: 1 }, addV2: { spread: 2 } }] }, st({ b: 1 }), false);
  ok('V1에선 when의 addV2 무시', r.stats.repair === 1 && r.stats.spread === 0, r.stats);
  r = pick({ when: [{ if: 'b=1', add: { repair: 1 }, addV2: { spread: 2 } }] }, st({ b: 1 }), true);
  ok('V2에선 when의 addV2도 더함', r.stats.repair === 1 && r.stats.spread === 2, r.stats);
  r = pick({ set: { b: 1 }, when: [{ if: 'b=1', set: { c: 3 } }] }, st({ b: 0 }));
  ok('when 판정은 기본 set 뒤 상태로', r.flags.c === 3);
  r = pick({ when: [{ if: 'b=1', set: { b: 2 } }, { if: 'b=1', set: { d: 1 } }] }, st({ b: 1 }));
  ok('when끼리는 서로의 set에 영향받지 않음(모두 먼저 판정)', r.flags.b === 2 && r.flags.d === 1, r.flags);
  r = pick({ add: { minimize: 1 }, when: [{ if: 'b=1', add: { minimize: -1 }, addV2: { minimize: -1 } }] }, st({ b: 1 }, { minimize: 0 }));
  ok('기본 add와 합친 뒤 0 밑으로 안 내려감', r.stats.minimize === 0, r.stats);
  r = pick({ add: { minimize: 1 }, when: [{ if: 'b=1', add: { minimize: -1 } }] }, st({ b: 1 }, { minimize: 2 }));
  ok('기본 add + when add 합산', r.stats.minimize === 2, r.stats);
}

/* ── migrate: 옛 진행 옮기기 ── */
if (on('migrate')) {
  ok('E.migrate가 있다', typeof E.migrate === 'function');
  if (typeof E.migrate === 'function') {
    // 실제 옛 흐름을 흉내: 사건 5 직전까지 걸어간 상태에서 옛 선택(c2_e5_a#jiho)을 직접 만든다
    const before = walkTo('c2_e5_a');
    const snapA = (() => { const s = E.clone(before); delete s.history; return s; })();
    const old1 = Object.assign(E.clone(before), { reaction: 'jiho', flags: Object.assign({}, before.flags, { e5: 'jiho' }),
      history: before.history.concat([{ scene: 'c2_e5_a', choice: 'jiho', snap: snapA }]) });
    const m1 = E.migrate(story, old1);
    ok('① c2_e5_a 반응 jiho → c2_e5_j 반응', m1.scene === 'c2_e5_j' && m1.reaction === 'jiho', { scene: m1.scene, reaction: m1.reaction });
    ok('① e5=jiho → e5j, e5 지움', m1.flags.e5j === 'jiho' && !('e5' in m1.flags), m1.flags);
    ok('① 기록 장면도 c2_e5_j', m1.history[m1.history.length - 1].scene === 'c2_e5_j' && m1.history[m1.history.length - 1].choice === 'jiho');
    ok('① 원본은 그대로(순수)', old1.scene === 'c2_e5_a' && old1.flags.e5 === 'jiho');
    ok('① 옮긴 뒤 유효한 상태', E.isValidState(story, m1));
    ok('① 지나온 장면에 c2_e5_j(선택 경로 화면이 "지나지 않은 장면"으로 보이지 않게, 최종 검토 2026-11-14)', m1.visited.includes('c2_e5_j') && m1.visited.filter((x) => x === 'c2_e5_j').length === 1, m1.visited.slice(-4));
    if (E.isValidState(story, m1)) {
      const n1 = E.advance(story, m1);
      ok('① 계속 → 에이전트 장면', n1.scene === 'c2_e5_agent' || (n1.screen === 'map' && n1.mapTarget === 'c2_e5_agent'), { screen: n1.screen, scene: n1.scene });
      const u1 = E.undo(m1);
      ok('① 되돌리면 c2_e5_a 고르기 전', u1.scene === 'c2_e5_a' && !u1.reaction && !('e5' in u1.flags) && !('e5j' in u1.flags), { scene: u1.scene, flags: u1.flags });
    }
    // ② c2_e5_b(설정 화면)에 선 옛 진행, 기록 snap 두 개에도 e5=anon
    const snapB = Object.assign(E.clone(snapA), { flags: Object.assign({}, snapA.flags, { e5: 'anon' }), scene: 'c2_e5_b' });
    const old2 = Object.assign(E.clone(before), { scene: 'c2_e5_b', reaction: null, flags: Object.assign({}, before.flags, { e5: 'anon' }),
      history: before.history.concat([{ scene: 'c2_e5_a', choice: 'anon', snap: snapA }]) });
    const old2b = Object.assign(E.clone(old2), { scene: 'c2_e6_a', flags: Object.assign({}, old2.flags, { e5fix: 'check' }), history: old2.history.concat([{ scene: 'c2_e5_b', choice: 'check', snap: snapB }]) });
    const m2 = E.migrate(story, old2b);
    ok('② snap마다 e5 → e5j', m2.history.every((h) => !h.snap.flags || h.snap.flags.e5 !== 'anon') && m2.history[m2.history.length - 1].snap.flags.e5j === 'anon', m2.history.slice(-2).map((h) => h.snap.flags));
    ok('② 기록 c2_e5_a#anon → c2_e5_j#anon', m2.history.some((h) => h.scene === 'c2_e5_j' && h.choice === 'anon') && !m2.history.some((h) => h.scene === 'c2_e5_a' && h.choice === 'anon'));
    ok('② 옮긴 뒤 유효', E.isValidState(story, m2));
    const back = E.undo(m2);
    ok('② 되돌리면 설정 화면, e5j=anon', back.scene === 'c2_e5_b' && back.flags.e5j === 'anon' && !('e5' in back.flags), { scene: back.scene, flags: back.flags });
    if (E.isValidState(story, back)) ok('② 설정 화면 check 보임(옛 진행 e5j=anon만)', E.visibleChoices(story, story.scenes.c2_e5_b, back).some((c) => c.id === 'check'));
    // ③ 안내문 일(all|min)만 한 옛 진행 = 새 흐름과 같은 값 → 그대로
    const old3 = Object.assign(E.clone(before), { scene: 'c2_e6_a', flags: Object.assign({}, before.flags, { e5: 'all', e5fix: 'del' }) });
    ok('③ e5=all 진행은 바뀌지 않음', same(E.migrate(story, old3), old3));
    ok('새 모양 진행은 바뀌지 않음', same(E.migrate(story, before), before));
  }
}

/* ── wish: overrode_wish ── */
if (on('wish')) {
  const f = (flags) => E.evalCond('overrode_wish', { stats: {}, trust: {}, flags });
  ok('e5j=jiho → 뜻 무시', f({ e5j: 'jiho' }));
  ok('e5=all → 뜻 무시', f({ e5: 'all' }));
  ok('e5=min·e5j=anon → 아님', !f({ e5: 'min', e5j: 'anon' }));
  ok('옛 값 e5=jiho는 더 읽지 않음(옮겨진 뒤만 존재)', !/e5=all\|jiho/.test(E.COMPUTED.overrode_wish), E.COMPUTED.overrode_wish);
}

/* 사건 5를 고르는 도우미: c2_e5_a에서 a, c2_e5_j에서 j를 고른 직후(반응 중) 상태 */
function doTasks(s0, a, j) {
  let s = E.choose(story, s0, a);
  s = E.advance(story, s);
  if (!(s.screen === 'scene' && s.scene === 'c2_e5_j')) throw new Error('안내문 뒤가 c2_e5_j가 아님: ' + s.screen + ' ' + s.scene);
  return E.choose(story, s, j);
}
const STAT0 = ['consent', 'repair', 'help', 'serious'];

/* ── statOnce: 사건 5 수치는 한 번 ── */
if (on('statOnce')) {
  ok('c2_e5_j 장면이 있다', !!story.scenes.c2_e5_j);
  if (story.scenes.c2_e5_j) {
    ok('안내문 선택 = all·min', same(story.scenes.c2_e5_a.choices.map((c) => c.id), ['all', 'min']));
    ok('지호 선택 = jiho·anon', same(story.scenes.c2_e5_j.choices.map((c) => c.id), ['jiho', 'anon']));
    const base = walkTo('c2_e5_a');
    for (const v2 of [true, false]) for (const m of [0, 1, 3]) for (const sp of [0, 2]) {
      const s0 = Object.assign(E.clone(base), { stats: Object.assign({}, base.stats, { minimize: m, spread: sp }) });
      for (const [a, j] of [['all', 'anon'], ['all', 'jiho'], ['min', 'anon'], ['min', 'jiho']]) {
        const r = withV2(v2, () => doTasks(s0, a, j));
        const raw = a === 'all' || j === 'jiho';
        const want = v2 ? (raw ? { spread: sp + 1, minimize: Math.max(0, m - 1) } : { spread: sp, minimize: m + 1 })
          : (raw ? { spread: sp, minimize: m } : { spread: sp, minimize: m + 1 });
        ok(`statOnce V${v2 ? 2 : 1} m${m} sp${sp} ${a}+${j}`, r.stats.spread === want.spread && r.stats.minimize === want.minimize && STAT0.every((k) => r.stats[k] === s0.stats[k]) && same(r.trust, s0.trust),
          { got: r.stats, want });
      }
    }
  }
}

/* ── undo: 지호 일 되돌려 다시 고르기 ── */
if (on('undo') && story.scenes.c2_e5_j) {
  const base = Object.assign(walkTo('c2_e5_a'), {});
  base.stats.minimize = 2;
  for (const v2 of [true, false]) {
    const redo = withV2(v2, () => { const r = doTasks(base, 'min', 'jiho'); return E.choose(story, E.undo(r), 'anon'); });
    const direct = withV2(v2, () => doTasks(base, 'min', 'anon'));
    ok(`undo V${v2 ? 2 : 1}: jiho → 이전 → anon = 바로 anon`, same(redo.stats, direct.stats) && same(redo.flags, direct.flags), { redo: redo.stats, direct: direct.stats });
  }
}

/* ── conds: 설정 화면 선택 ── */
if (on('conds')) {
  const vis = (flags) => E.visibleChoices(story, story.scenes.c2_e5_b, { stats: {}, trust: {}, flags }).map((c) => c.id).join(',');
  for (const [flags, want] of [[{ e5: 'all', e5j: 'anon' }, 'del,close'], [{ e5: 'min', e5j: 'jiho' }, 'del,close'], [{ e5: 'all', e5j: 'jiho' }, 'del,close'],
    [{ e5: 'min', e5j: 'anon' }, 'check,close'], [{ e5: 'min' }, 'check,close'], [{ e5j: 'anon' }, 'check,close'], [{ e5j: 'jiho' }, 'del,close'], [{ e5: 'all' }, 'del,close']]) {
    ok('conds ' + JSON.stringify(flags) + ' → ' + want, vis(flags) === want, vis(flags));
  }
  const consentLine = (flags) => E.visibleLines(story, story.scenes.c2_e5_b.lines, { stats: {}, trust: {}, flags }).some((l) => /동의한 적이 없다/.test(l.text));
  ok('친구 동의 줄 = 통째로 넣은 적 있을 때만', consentLine({ e5: 'min', e5j: 'jiho' }) && consentLine({ e5: 'all', e5j: 'anon' }) && !consentLine({ e5: 'min', e5j: 'anon' }));
}

/* ── outcomes · endingNotes ── */
if (on('outcomes') && story.scenes.c2_e5_j) {
  const base = walkTo('c2_e5_a');
  for (const [a, j] of [['all', 'anon'], ['all', 'jiho'], ['min', 'anon'], ['min', 'jiho']]) {
    const s = Object.assign(E.clone(doTasks(base, a, j)), {});
    const out = E.eventOutcomes(story, 'e5', s);
    const first = a === 'all' ? /통째로 입력/ : /부스 정보만/;
    const jl = j === 'jiho' ? /지호 모르게/ : /이름과 구체적인 사정을 빼고/;
    ok(`outcomes ${a}+${j}: 첫 줄 = 안내문, 지호 줄 있음`, first.test(out[0] || '') && out.some((t) => jl.test(t)), out);
  }
  const lines = (flags) => story.endingNotes.lines.filter((n) => E.evalCond(n.if, { stats: {}, trust: {}, flags })).map((n) => n.text).join(' / ');
  ok('endingNotes e5j=jiho → 지호 줄', /지호가 털어놓은 대화/.test(lines({ e5: 'min', e5j: 'jiho' })), lines({ e5: 'min', e5j: 'jiho' }));
  ok('endingNotes e5=min·e5j=anon → 사건 5 줄 없음', !/AI 도우미/.test(lines({ e5: 'min', e5j: 'anon' })));
  ok('endingNotes에 옛 값 e5=jiho 조건 없음', !story.endingNotes.lines.some((n) => /e5=jiho/.test(String(n.if))));
}

/* ── 에이전트 장면 ── */
const AGENTS = ['give', 'draft', 'scoped', 'ask'];
const NOTE = '이 선택은 엔딩에 영향을 주지 않습니다.';
const BRANDS = ['카카오', '네이버', '코레일', '토스', '쿠팡', '구글', '애플', '삼성', '배민', '당근', '피클', 'pickle', 'naver', 'kakao', 'korail', 'google'];
const ag = story.scenes.c2_e5_agent;
if (on('agentScene')) {
  ok('c2_e5_agent 장면이 있다', !!ag);
  if (ag) {
    ok('지호 일 다음 = 에이전트 장면', story.scenes.c2_e5_j.choices.every((c) => c.next === 'c2_e5_agent'));
    ok('에이전트 다음 = 설정 화면', ag.choices.every((c) => c.next === 'c2_e5_b'));
    ok('선택 4개 give·draft·scoped·ask', same(ag.choices.map((c) => c.id), AGENTS));
    ok('promptNote 문구', ag.promptNote === NOTE, ag.promptNote);
    ok('에이전트 선택은 set만(수치·믿음 없음)', ag.choices.every((c) => !c.add && !c.addV2 && !c.when && c.set && Object.keys(c.set).join() === 'e5agent'));
    ok('에이전트 선택은 조건 없이 늘 4개', ag.choices.every((c) => c.if == null));
    const allText = JSON.stringify([ag, story.scenes.c2_e5_b, story.scenes.c2_e5_j, story.events.e5]).toLowerCase();
    ok('실제 상표 없음', BRANDS.every((b) => allText.indexOf(b) < 0), BRANDS.filter((b) => allText.indexOf(b) >= 0));
    ok('지어낸 이름 솔빛포털·한빛인화', /솔빛포털/.test(allText) && /한빛인화/.test(allText));
    const lines = JSON.stringify(ag.lines);
    ok('루미가 솔빛포털 아이디·비밀번호를 묻는다(카드 번호는 묻지 않음)', /아이디·비밀번호/.test(lines) && !/카드 번호/.test(lines));
    ok('전제: 보호자 허락 · 카드가 솔빛포털에 등록', /보호자/.test(lines) && /허락/.test(lines) && /등록/.test(lines));
    ok('제한 권한 3줄(예약·2만 원·내일 자정)', /2만 원/.test(lines) && /내일 자정/.test(lines) && /예약/.test(lines));
    const give = JSON.stringify(ag.choices[0].react);
    ok('give 반응 = 볼 수 있게 된 것(카드·메일·연락처·결제 내역)', ['카드', '메일', '연락처', '결제 내역'].every((w) => give.indexOf(w) >= 0), give);
  }
}

/* 무작위 완주 — 에이전트 장면에서는 agent를 고르고, 다른 장면은 rnd(에이전트 장면은 rnd를 쓰지 않아 다른 선택이 같게 맞물린다) */
function playWith(seed, agent, closePick) {
  const rnd = mulberry32(seed);
  let s = E.createState(story);
  for (let step = 0; s.screen !== 'ending'; step++) {
    if (step > 700) throw new Error('무한 루프 @' + s.scene);
    if (s.screen === 'scene' && E.needsChoice(story, s)) {
      const cs = E.visibleChoices(story, story.scenes[s.scene], s);
      let id;
      if (s.scene === 'c2_e5_agent') id = agent;
      else if (s.scene === 'c2_e5_b' && closePick) id = closePick(cs);
      else id = cs[Math.floor(rnd() * cs.length)].id;
      s = E.choose(story, s, id); s.history = []; // 기록(snap)을 쌓으면 복사가 길어져 느리다 — 되돌리기는 이 검사에서 안 씀
    }
    s = E.advance(story, s);
  }
  return s;
}
if (on('agentInvariant') && ag) {
  for (const v2 of [true, false]) {
    let diff = 0, n = 0; const ex = [];
    for (let i = 0; i < 2000; i++) {
      const runs = AGENTS.map((a) => withV2(v2, () => playWith(9000 + i, a)));
      const key = (s) => JSON.stringify([s.ending, s.stats, s.trust]);
      const flagKey = (s) => { const f = Object.assign({}, s.flags); delete f.e5agent; delete f.e5link; return JSON.stringify(f); };
      n++;
      if (!runs.every((r) => key(r) === key(runs[0]) && flagKey(r) === flagKey(runs[0]))) { diff++; if (ex.length < 2) ex.push(runs.map(key)); }
    }
    ok(`agentInvariant V${v2 ? 2 : 1}: 2,000경로 × 4 에이전트 선택 — 엔딩·수치·믿음·다른 플래그 같음`, diff === 0, { diff, n, ex });
  }
}
if (on('agentFlagsUnused')) {
  const bad = [];
  const has = (x) => /e5agent|e5link/.test(JSON.stringify(x === undefined ? null : x));
  story.endings.forEach((e) => { if (has(e.if)) bad.push('엔딩 ' + e.code); });
  Object.keys(E.COMPUTED).forEach((k) => { if (has(E.COMPUTED[k])) bad.push('COMPUTED ' + k); });
  if (has(story.seriousSplit)) bad.push('seriousSplit');
  if (has(story.endingNotes)) bad.push('endingNotes');
  Object.entries(story.scenes).forEach(([id, sc]) => {
    if (has(sc.next)) bad.push(id + ' next');
    (sc.choices || []).forEach((c) => {
      if (has(c.if)) bad.push(id + '#' + c.id + ' if');
      if (has(c.next)) bad.push(id + '#' + c.id + ' next');
      (c.when || []).forEach((w) => { if (has(w.if) && (w.add || w.addV2)) bad.push(id + '#' + c.id + ' when 수치'); });
    });
  });
  ok('e5agent·e5link는 엔딩·계산 플래그·지표·분기·선택 표시·수치에 쓰지 않음', bad.length === 0, bad);
}
if (on('linkFlag') && ag) {
  const base = walkTo('c2_e5_agent');
  for (const a of AGENTS) {
    let s = E.advance(story, E.choose(story, base, a));
    ok(`linkFlag ${a}: 다음 = 설정 화면`, s.scene === 'c2_e5_b', s.scene);
    for (const fix of E.visibleChoices(story, story.scenes.c2_e5_b, s).map((c) => c.id)) {
      const r = E.choose(story, s, fix);
      const want = (a === 'give' || a === 'scoped') ? (fix === 'close' ? 'kept' : 'cut') : undefined;
      ok(`linkFlag ${a}+${fix} → ${want}`, r.flags.e5link === want, r.flags.e5link);
      const out = E.eventOutcomes(story, 'e5', r).filter((t) => /^루미에게 맡긴 것:/.test(t));
      ok(`outcomeLine ${a}+${fix}: 맡긴 것 한 줄`, out.length === 1, out);
      const rl = E.visibleLines(story, story.scenes.c2_e5_b.choices.find((c) => c.id === fix).react, r).map((l) => l.text).join(' / ');
      if (a === 'give') ok(`give+${fix} 반응이 비밀번호 상태를 말함`, fix === 'close' ? /로그인한 채/.test(rl) : /비밀번호를 바꿨/.test(rl), rl);
      if (a === 'scoped') ok(`scoped+${fix} 반응이 권한 상태를 말함`, fix === 'close' ? /자정에 저절로/.test(rl) : /권한을 거두/.test(rl), rl);
      if (a === 'draft' || a === 'ask') ok(`${a}+${fix} 반응에 연결 줄 없음`, !/비밀번호를 바꿨|권한을 거두|로그인한 채|저절로 끝난다/.test(rl), rl);
    }
    const rows = E.visibleLines(story, story.scenes.c2_e5_b.lines, s).filter((l) => l.kind === 'setting' && /연결된 계정/.test(l.text));
    ok(`설정 화면 연결된 계정 줄 1개(${a})`, rows.length === 1 && (a === 'give' ? /비밀번호/.test(rows[0].meta) : a === 'scoped' ? /2만 원/.test(rows[0].meta) : rows[0].meta === '없음'), rows);
  }
  const legacy = { stats: {}, trust: {}, flags: { e5j: 'jiho', e5fix: 'del' } };
  ok('옛 진행(e5agent 없음): 맡긴 것 줄 없음', !E.eventOutcomes(story, 'e5', legacy).some((t) => /루미에게 맡긴 것/.test(t)));
  ok('옛 진행 설정 화면: 연결된 계정 = 없음', E.visibleLines(story, story.scenes.c2_e5_b.lines, legacy).filter((l) => /연결된 계정/.test(l.text)).map((l) => l.meta).join() === '없음');
  const order = E.eventOutcomes(story, 'e5', { stats: {}, trust: {}, flags: { e5: 'min', e5j: 'anon', e5agent: 'draft', e5fix: 'check' } });
  ok('결과 줄 순서 = 안내문 → 지호 → 맡긴 것 → 정리', order.length === 4 && /부스 정보만/.test(order[0]) && /빼고/.test(order[1]) && /^루미에게 맡긴 것/.test(order[2]) && /설정/.test(order[3]), order);
}
if (on('cardTopic')) {
  const t = story.card.topics[1];
  ok('카드 둘째 제목', t.title === 'AI에 넘긴 것, AI에 맡긴 것', t.title);
  ok('카드 둘째 설명', t.explain === 'AI 에이전트는 질문에 답만 하는 AI와 달리, 내 계정과 권한을 받아 예약·결제·메시지 보내기 같은 일을 대신 해 주는 AI예요. 편리한 만큼 무엇을, 어디까지 맡겼는지가 중요해요.', t.explain);
  ok('카드 둘째 질문', t.q === 'AI 에이전트에게 내 계정이나 개인정보를 맡겨도 되는 때와 안 되는 때는 언제일까요? 게임에서 루미에게 맡긴 것을 떠올리며 써 보세요.', t.q);
  ok('카드 둘째 사건 그대로 e4·e5', same(t.events, ['e4', 'e5']));
  const Card = require('../js/card.js');
  const tp = Card.topics(story, E, { stats: {}, trust: {}, flags: { e5: 'min', e5j: 'anon', e5agent: 'scoped', e5fix: 'check', e5link: 'cut' }, history: [] });
  ok('card.js topics가 설명(explain)을 넘김 — 둘째만', tp[1].explain === t.explain && !tp[0].explain && !tp[2].explain, tp.map((x) => x.explain));
  ok('카드 둘째 자동 줄에 맡긴 것 한 줄', tp[1].items.filter((it) => /^루미에게 맡긴 것:/.test(it.text)).length === 1, tp[1].items);
}

/* ── cardSig: 엔딩을 본 옛 진행 — 옮긴 뒤에도 성찰 카드 답이 남는다(app.js loadAll이 지문을 이월) ── */
if (on('cardSig')) {
  const Card = require('../js/card.js');
  ok('Card.carrySig가 있다', typeof Card.carrySig === 'function');
  if (typeof Card.carrySig === 'function') {
    const before = walkTo('c2_e5_a');
    const snapA = (() => { const s = E.clone(before); delete s.history; return s; })();
    const old = Object.assign(E.clone(before), { screen: 'ending', ending: 'C', flags: Object.assign({}, before.flags, { e5: 'jiho', e5fix: 'del' }),
      history: before.history.concat([{ scene: 'c2_e5_a', choice: 'jiho', snap: snapA }]) });
    const raw = { v: 1, ending: 'C', sig: Card.sig(old), sid: '20315', name: '김온유', answers: ['하나', '둘째 칸 옛 답', '셋'] };
    const moved = E.migrate(story, old);
    ok('옮기면 지문이 바뀐다(이월이 필요한 경우)', Card.sig(moved) !== Card.sig(old));
    const r0 = Card.read(raw, moved);
    ok('이월 전에는 다른 진행으로 읽힌다(stale)', r0.stale === true);
    const carried = Card.carrySig(raw, old, moved);
    ok('carrySig: 옛 지문이면 새 지문으로', carried && carried.sig === Card.sig(moved) && same(carried.answers, raw.answers));
    const r1 = Card.read(carried, moved);
    ok('이월 뒤 같은 진행 — 답 그대로(둘째 칸 포함)', r1.stale !== true && same(r1.card.answers, raw.answers), r1);
    ok('carrySig: 다른 진행의 카드는 건드리지 않음', Card.carrySig(Object.assign({}, raw, { sig: 'zzz' }), old, moved) === null);
    ok('carrySig: 지문이 그대로면 null', Card.carrySig(raw, old, old) === null);
  }
}

/* 사건 5 직전(c2_e5_a 장면, 고르기 전)까지 걸어간 상태 — want(s)가 맞는 것만, 씨앗 고정 */
function walkTo(target, want, seed = 5) {
  const rnd = mulberry32(seed);
  for (let tries = 0; tries < 5000; tries++) {
    let s = E.createState(story);
    for (let step = 0; step < 600 && s.screen !== 'ending'; step++) {
      if (s.screen === 'scene' && s.scene === target && !s.reaction) { if (want && !want(s)) break; return s; }
      if (s.screen === 'scene' && E.needsChoice(story, s)) { const cs = E.visibleChoices(story, story.scenes[s.scene], s); s = E.choose(story, s, cs[Math.floor(rnd() * cs.length)].id); }
      s = E.advance(story, s);
    }
  }
  throw new Error('경로 없음: ' + target);
}

console.log(`ai-agent-1113 (V${story.endingV2 ? 2 : 1}): ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
