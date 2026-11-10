// 특별 수업 「우리 학교에 AI CCTV를 단다면」(2026-11-10) 검사 — 브라우저 없이: node privacy/tests/special-class.mjs
//   이야기·장 흐름(1장 → 특별 수업 → 2장), 플래그만(엔딩·수치 불변), 반문 줄, 결과 칸 줄, 옛 저장, 지도(특별실·워프·걸음).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;

let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗ ' + m); } };
const run = (name, fn) => { try { fn(); } catch (e) { fails.push(name + ': ' + e.message); console.log('  ✗ ' + name + ': ' + e.message); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 장면마다 고를 선택 id(없으면 첫 선택). 엔진 상태를 끝(엔딩)까지 또는 stop(state)이 참일 때까지 진행
function play(prefs, stop, rnd) {
  let s = E.createState(story);
  for (let step = 0; step < 800; step++) {
    if (stop && stop(s)) return s;
    if (s.screen === 'ending') return s;
    if (s.screen === 'scene' && E.needsChoice(story, s)) {
      const cs = E.visibleChoices(story, story.scenes[s.scene], s);
      const want = prefs[s.scene];
      const c = cs.find((x) => x.id === want) || (rnd ? cs[Math.floor(rnd() * cs.length)] : cs[0]);
      s = E.choose(story, s, c.id); s.history = s.history.slice(-1);
    }
    s = E.advance(story, s);
  }
  throw new Error('끝까지 못 감');
}
const SC = {
  a: { sc_1: 'on', sc_2: 'incident', sc_3: '30d', sc_4: 'self' },
  b: { sc_1: 'on', sc_2: 'ai', sc_3: 'open', sc_4: 'open' },
  c: { sc_1: 'on', sc_2: 'guide', sc_3: 'term', sc_4: 'staff' },
  n: { sc_1: 'none' }
};
const atScene = (id) => (s) => s.screen === 'scene' && s.scene === id;
const afterClass = (s) => s.screen === 'chapter' && s.nextChapter === 2;

/* ── Task 1: 이야기·장 흐름 ── */
run('chapterFlow', () => {
  for (const [scene, choice] of [['c1_e3_b', 'ask'], ['c1_e3_b', 'anon'], ['c1_e3_b', 'capture']]) {
    const s = play({ [scene]: choice }, (x) => x.screen === 'chapter' && x.nextChapter !== 1 && x.chapter === 1);
    ok(s.nextChapter === 'sc', `1장 끝(${choice}) → 다음 장 = 특별 수업: ${s.nextChapter}`);
    const t = E.advance(story, s);
    ok(t.chapter === 'sc' && (t.mapTarget === 'sc_1' || t.scene === 'sc_1'), `특별 수업 시작 = sc_1(걷기 여부는 Task 2 walkReach): ${t.screen} ${t.mapTarget || t.scene}`);
  }
  const s = play(SC.a, afterClass);
  ok(s.screen === 'chapter' && s.nextChapter === 2, '특별 수업 끝 → 2장 카드');
});

run('flagsOnly', () => {
  for (const [k, pref] of Object.entries(SC)) {
    const before = play(pref, (x) => x.screen === 'chapter' && x.nextChapter === 'sc');
    const after = play(pref, afterClass);
    ok(same(before.stats, after.stats) && same(before.trust, after.trust), `특별 수업(${k})은 스탯·믿음을 바꾸지 않음`);
  }
});

run('noneSkips', () => {
  const s = play(SC.n, afterClass);
  ok(s.flags.ccx === 'none' && !s.flags.ccxPurpose && !s.flags.ccxKeep && !s.flags.ccxAccess, '설치 안 함 → 조건 플래그 없음 ' + JSON.stringify(s.flags));
  ok(s.visited.includes('sc_5') && !s.visited.some((v) => ['sc_2', 'sc_3', 'sc_4'].includes(v)), '설치 안 함 → sc_2~4 건너뜀 ' + s.visited.filter((v) => /^sc_/.test(v)));
});

run('notesEveryOption', () => {
  const praise = /잘 ?했|정답|훌륭|잘 정했/;
  const seen = new Set();
  for (const p of ['incident', 'guide', 'ai']) for (const k of ['30d', 'term', 'open']) for (const a of ['self', 'staff', 'open']) {
    const s = play({ sc_1: 'on', sc_2: p, sc_3: k, sc_4: a }, afterClass);
    const notes = E.specialClassNotes(story, s);
    ok(notes.length === 3, `on/${p}/${k}/${a} 반문 3줄: ${notes.length}`);
    notes.forEach((n) => seen.add(n));
    ok(!notes.some((n) => praise.test(n)), '칭찬·정답 낱말 없음');
  }
  const n = E.specialClassNotes(story, play(SC.n, afterClass));
  ok(n.length === 1 && !praise.test(n[0]), '설치 안 함 반문 1줄');
  ok(seen.size === 9, '보기 9개 모두 서로 다른 반문: ' + seen.size);
  ok(story.specialClass.notes.length === 10 && typeof story.specialClass.closing === 'string' && story.specialClass.closing.length > 10, 'notes 10줄 + 마무리');
  // 정리 장면(sc_5) 대사 = 반문 줄 + 마무리
  const s = play(SC.b, atScene('sc_5'));
  const lines = E.visibleLines(story, story.scenes.sc_5.lines, s).map((l) => l.text);
  ok(E.specialClassNotes(story, s).every((t) => lines.includes(t)) && lines.includes(story.specialClass.closing), 'sc_5 대사에 반문 3줄과 마무리');
});

run('rows', () => {
  const r = E.specialClassRows(story, play(SC.a, afterClass));
  ok(r.length === 4 && r.map((x) => x.label).join() === '설치 여부,촬영 목적,보관 기간,열람·삭제', '설치 → 4줄 ' + JSON.stringify(r));
  ok(r[1].text === '신고된 사건 확인에만' && r[2].text === '30일 뒤 자동 삭제', '줄 글자 ' + JSON.stringify(r));
  const rn = E.specialClassRows(story, play(SC.n, afterClass));
  ok(rn.length === 1 && rn[0].text === '설치하지 않음', '설치 안 함 → 1줄');
  ok(E.specialClassRows(story, E.createState(story)).length === 0, '특별 수업 전 → 0줄');
});

run('oldSave', () => {
  // 업데이트 전 저장: 1장 끝 장 카드에서 nextChapter = 2
  const s = play({}, (x) => x.screen === 'chapter' && x.nextChapter === 'sc');
  const old = Object.assign({}, s, { nextChapter: 2 });
  ok(E.isValidState(story, old), '옛 저장(nextChapter 2) 유효');
  const t = E.advance(story, old);
  ok(t.chapter === 2 && (t.mapTarget === 'c2_e4_a' || t.scene === 'c2_e4_a'), '옛 저장 → 2장으로');
});

run('endingsUnchanged', () => {
  let seed = 20261110; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const N = Number(process.env.PAIRS || 3000);
  let diff = 0;
  for (let i = 0; i < N; i++) {
    const s0 = seed;
    const e1 = play(SC.a, null, rnd).ending;
    seed = s0; // 같은 무작위 선택을 다시 — 특별 수업 선택만 다르게
    const e2 = play(SC.b, null, rnd).ending;
    seed = s0; const e3 = play(SC.n, null, rnd).ending;
    if (e1 !== e2 || e1 !== e3) diff++;
    seed = (s0 * 48271 + 7) % 2147483647; // 다음 표본
  }
  ok(diff === 0, `특별 수업 선택만 바꾼 ${N}쌍에서 엔딩이 달라진 수 = ${diff}`);
});

/* ── Task 2: 특별실 지도 ── */
run('aiLabScene', () => {
  const S = WORLD.SCENES;
  ok(S[S.length - 1].id === 'ai_lab' && /ai_lab\.png$/.test(S[S.length - 1].img), '마지막 장면 = ai_lab ' + S.map((x) => x.id));
  ok(S.slice(0, 5).map((x) => x.ox).join() === '0,32,64,96,128', '기존 장면 ox 그대로 ' + S.map((x) => x.ox));
  ok(WORLD.VERSION === 4, '지도 판 VERSION 4 그대로');
});
const classDoor = () => { const ox = WORLD.SCENES.find((x) => x.id === 'yard').ox; return WORLD.DOORS[(ox + 7) + ',4']; };
run('warpOnlyInClass', () => {
  const d = classDoor(), lab = WORLD.SCENES.find((x) => x.id === 'ai_lab');
  ok(!!d && WORLD.sceneAt(d.to[0]).id === 'classroom', '평소 마당→교실 문 = 교실');
  const w = WORLD.doorTarget(d, WORLD.triggers.sc_1);
  ok(WORLD.sceneAt(w.to[0]).id === 'ai_lab' && w.to[0] >= lab.ox && WORLD.walkable(w.to[0], w.to[1]), '특별 수업 걷기 → 특별실 안 칸 ' + JSON.stringify(w));
  const o = WORLD.doorTarget(d, WORLD.triggers.c1_e2_a);
  ok(same(o.to, d.to), '다른 걷기 → 교실 그대로');
  WORLD.setWarp(WORLD.triggers.sc_1.warp);
  ok(WORLD.sceneAt(classDoor().to[0]).id === 'ai_lab', 'setWarp 켜면 DOORS도 특별실로');
  WORLD.setWarp(null);
  ok(WORLD.sceneAt(classDoor().to[0]).id === 'classroom', 'setWarp(null)이면 교실로 되돌아감');
});
run('walkReach', () => {
  const s = play({}, (x) => x.screen === 'map' && x.mapTarget === 'sc_1');
  ok(s.chapter === 'sc', '특별 수업 = 걷기로 시작(map sc_1)');
  const tr = WORLD.triggers.sc_1, start = WORLD.SPAWNS[tr.spawn], t = tr.cast.find((c) => c.who === tr.target.npc);
  WORLD.setWarp(tr.warp);
  const blocked = (x, y) => tr.cast.some((c) => c.x === x && c.y === y);
  const p = WORLD.findPath({ x: start.x, y: start.y }, (x, y) => Math.abs(x - t.x) + Math.abs(y - t.y) === 1, blocked);
  WORLD.setWarp(null);
  ok(!!p && p.length <= 25, `마당 → 특별실 선생님 옆 걸음 ${p && p.length} (≤ 25)`);
});
run('stagesCast', () => {
  for (const id of ['sc_1', 'sc_2', 'sc_3', 'sc_4', 'sc_5']) {
    const st = WORLD.STAGES[id];
    ok(!!st && st.place === 'ailab', id + ' 무대 = 특별실');
  }
  const c = WORLD.STAGES.sc_1.cast;
  ok(c.map((x) => x.who).sort().join() === 'haneul,jiho,minjun,saebom,teacher', 'cast 다섯 ' + c.map((x) => x.who));
  const me = WORLD.PLACES.ailab.me, all = c.concat([me]);
  let far = true;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (Math.abs(all[i].x - all[j].x) + Math.abs(all[i].y - all[j].y) < 2) far = false;
  ok(far, '서로 2칸 이상');
  ok(all.every((p) => WORLD.walkable(p.x, p.y)), '모두 걸을 수 있는 칸');
});

console.log(`\n통과 ${pass} · 실패 ${fails.length}`);
process.exitCode = fails.length ? 1 : 0;
