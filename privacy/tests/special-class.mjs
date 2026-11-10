// 특별 수업 「우리 교실에 AI CCTV를 단다면」(2026-11-10) 검사 — 브라우저 없이: node privacy/tests/special-class.mjs
//   이야기·장 흐름(1장 → 특별 수업 → 2장), 플래그만(엔딩·수치 불변), 반문 줄, 결과 칸 줄, 옛 저장, 지도(특별실·워프·걸음).
//   같은 날 AI 프라이버시 반영: 알림 범위(ccxPurpose = safety|danger|all), 감지 화면 네 장(cg 줄·사각형 좌표 = cctv-boxes.json), 얼굴 인식 전제 없음, 옛 값에도 안 깨짐.
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

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
  a: { sc_1: 'on', sc_2: 'safety', sc_3: '30d', sc_4: 'self' },
  b: { sc_1: 'on', sc_2: 'all', sc_3: 'open', sc_4: 'open' },
  c: { sc_1: 'on', sc_2: 'danger', sc_3: 'term', sc_4: 'staff' },
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
  for (const p of ['safety', 'danger', 'all']) for (const k of ['30d', 'term', 'open']) for (const a of ['self', 'staff', 'open']) {
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
  ok(r.length === 4 && r.map((x) => x.label).join() === '설치 여부,알림 범위,보관 기간,열람·삭제', '설치 → 4줄 ' + JSON.stringify(r));
  ok(r[1].text === '쓰러짐·싸움처럼 다칠 수 있는 일만' && r[2].text === '30일 뒤 자동 삭제' && /아니라고 말하기/.test(r[3].text), '줄 글자 ' + JSON.stringify(r));
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

/* ── AI 프라이버시 반영(2026-11-10): 감지 화면·알림 범위·옛 값 ── */
const hasCg = (l) => Object.prototype.hasOwnProperty.call(l, 'cg');
const sc1Lines = story.scenes.sc_1.lines.map((l) => E.normLine(l, story));
run('cctvIntro', () => {
  // 도입: 그림 네 장(쓰러짐 → 싸움 → 창문 → 휴대폰)을 차례로 띄운 뒤 내리고(cg:null) 토론
  const cgs = sc1Lines.filter(hasCg).map((l) => l.cg);
  ok(same(cgs, ['cctv-collapse', 'cctv-fight', 'cctv-window', 'cctv-phone', null]), '도입 cg 순서 = 쓰러짐·싸움·창문·휴대폰 → 내리기 ' + JSON.stringify(cgs));
  ok(!story.scenes.sc_1.view.cg, '장면 첫 화면은 그림 없이(실습실 무대)');
  ok(sc1Lines.filter(hasCg).every((l) => !l.if && l.who === 'teacher'), '그림 줄은 조건 없는 선생님 대사');
  const down = sc1Lines.findIndex((l) => hasCg(l) && l.cg === null);
  const debate = sc1Lines.findIndex((l) => ['saebom', 'jiho', 'minjun'].includes(l.who));
  ok(down > 0 && debate > down, '친구 토론은 그림을 내린 뒤(무대 말풍선이 보이게) ' + down + ' < ' + debate);
  const said = (who) => sc1Lines.filter((l) => l.who === who).map((l) => l.text).join(' ');
  ok(/찬성/.test(said('saebom')) && /찬성/.test(said('haneul')) && /반대/.test(said('jiho')) && /반대/.test(said('minjun')), '찬성 둘(새봄·하늘)·반대 둘(지호·민준)');
  ok(!sc1Lines.some((l) => l.if), '도입 대사는 관계·앞 선택과 무관(조건 없음)');
  for (const id of ['sc_2', 'sc_3', 'sc_4', 'sc_5']) ok(!story.scenes[id].view.cg && !story.scenes[id].lines.some((l) => typeof l === 'object' && hasCg(l)), id + ' 는 그림 없이 무대에서');
});
run('cctvBoxes', () => {
  // 사각형 좌표: story.cctv.shots[키].box 는 assets/cctv/cctv-boxes.json 을 옮겨 적은 것 — 두 곳이 똑같아야 한다(file://에서는 json을 못 읽는다)
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/cctv/cctv-boxes.json'), 'utf8'));
  const shots = story.cctv.shots, keys = Object.keys(shots);
  ok(same(keys.slice().sort(), Object.keys(json).sort()) && keys.length === 4, '키 네 개가 json과 같음 ' + keys);
  const webp = fs.readFileSync(path.join(ROOT, 'js/webp-list.js'), 'utf8');
  for (const k of keys) {
    ok(!!json[k] && json[k].length === 1 && same(shots[k].box, json[k][0]), k + ' 좌표가 json과 같음 ' + JSON.stringify(shots[k].box));
    const b = shots[k].box;
    ok([b.x, b.y, b.w, b.h].every((v) => v > 0 && v < 1) && b.x + b.w <= 1 && b.y + b.h <= 1, k + ' 좌표는 그림 안(0~1)');
    ok(b.y > 0.12 + 0.05 && !(b.x + b.w > 0.66 && b.y + b.h > 0.78), k + ' 사각형·꼬리표가 위쪽 띠(12%)·알림 카드 자리(오른쪽 아래 34%×22%)와 안 겹침');
    ok(typeof shots[k].label === 'string' && shots[k].label.length >= 3 && shots[k].pct > 50 && shots[k].pct < 100, k + ' 꼬리표 글자·확신 정도');
    ok(typeof shots[k].alt === 'string' && shots[k].alt.includes(shots[k].label) && shots[k].alt.length > 40, k + ' 대체 글(무엇이 보이고 무엇으로 알렸는지)');
    ok(fs.existsSync(path.join(ROOT, 'assets/cctv', k + '.png')) && fs.existsSync(path.join(ROOT, 'assets/cctv', k + '.webp')) && webp.includes('"assets/cctv/' + k + '.png"'), k + ' 그림(png·webp·목록)');
  }
  ok(!!story.cctv.room && !!story.cctv.send && !!story.cctv.cam, '알림 카드·카메라 이름 글자');
  // 꼬리표·카드 글자는 대사에도 그대로 나온다(색·그림만으로 전하지 않음)
  for (const k of keys) ok(sc1Lines.some((l) => l.cg === k && l.text.includes(shots[k].label)), k + ' 줄 대사에 꼬리표 글자(' + shots[k].label + ')');
});
run('noFaceRecognition', () => {
  // 새 시스템은 "무슨 상황인지"만 알린다 — 얼굴 인식·이동 경로 전제 문장이 남아 있지 않다(특별 수업 대사·보기·반문·걷기 한마디)
  const IDLE = require('../js/idle-lines.js');
  const texts = [];
  for (const id of ['sc_1', 'sc_2', 'sc_3', 'sc_4', 'sc_5']) {
    const sc = story.scenes[id];
    (sc.lines || []).forEach((l) => texts.push(E.normLine(l, story).text));
    (sc.choices || []).forEach((c) => { texts.push(c.text); (c.react || []).forEach((l) => texts.push(E.normLine(l, story).text)); });
    if (sc.prompt) texts.push(sc.prompt);
  }
  story.specialClass.notes.forEach((n) => texts.push(n.text)); texts.push(story.specialClass.closing);
  story.specialClass.rows.forEach((r) => { texts.push(r.label); Object.values(r.values).forEach((v) => texts.push(v)); });
  const idle = IDLE.WALKS.sc_1;
  ok(!!idle && Object.keys(idle).length === 4, '걷기 한마디 sc_1 네 명');
  Object.values(idle || {}).forEach((arr) => arr.forEach((t) => texts.push(typeof t === 'string' ? t : t.text)));
  ok(texts.length > 50, '특별 수업 글자 ' + texts.length + '줄을 모음');
  const bad = texts.filter((t) => /얼굴|이동 경로|4번 인식|주의 학생|누가 어디 있었는지|증거가 필요한/.test(t || ''));
  ok(bad.length === 0, '얼굴 인식·추적 전제 문장 없음 ' + bad.join(' / '));
  ok(!story.characters.aidemo && !sc1Lines.some((l) => l.who === 'aidemo'), 'AI 시연 대사(같은 학생 4번 인식) 없음');
  ok(sc1Lines.some((l) => l.who === 'teacher' && /누가 누구인지는 알아보지 않/.test(l.text)), '선생님이 "누구인지는 알아보지 않는다"고 말함');
  ok(sc1Lines.some((l) => l.who === 'teacher' && /선생님도 알림을 받/.test(l.text)), '선생님도 알림을 받는 쪽');
  ok(story.chapters.sc.title === '우리 교실에 AI CCTV를 단다면', '장 카드 제목');
});
run('oldPurposeValue', () => {
  // 배포 전 로컬 저장의 옛 값(incident|guide|ai): 깨지지 않고 그 줄만 비어 보인다
  for (const old of ['incident', 'guide', 'ai']) {
    const s = play(SC.a, afterClass); s.flags.ccxPurpose = old;
    let rows = null, notes = null;
    try { rows = E.specialClassRows(story, s); notes = E.specialClassNotes(story, s); } catch (e) { rows = null; }
    ok(!!rows && rows.length === 4 && rows[1].label === '알림 범위' && rows[1].text === '—' && rows[1].unknown === true, '옛 값 ' + old + ' → 그 줄만 — ' + JSON.stringify(rows && rows[1]));
    ok(!!rows && rows[0].text === '조건을 붙여 설치' && rows[2].text === '30일 뒤 자동 삭제', '다른 줄은 그대로');
    ok(!!notes && notes.length === 2, '반문은 남은 두 줄 ' + (notes && notes.length));
    ok(E.isValidState(story, s), '옛 값이 든 저장도 유효');
  }
  const odd = E.specialClassRows(story, { flags: { ccx: 'on', ccxPurpose: 7, ccxKeep: {}, ccxAccess: 'toString' } }).map((r) => r.text);
  ok(same(odd, ['조건을 붙여 설치', '—', '—', '—']), '엉뚱한 값(숫자·객체·toString)도 — ' + JSON.stringify(odd));
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
