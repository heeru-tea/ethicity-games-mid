// 장면 좌표 검사: 출발점·출입구·NPC·조사 지점이 직접 정한 걷기 영역 안에 있고, 출발점에서 걸어서 닿는지.
// 실행: node rights/tests/geometry.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const src = fs.readFileSync(fileURLToPath(new URL('../js/data.js', import.meta.url)), 'utf8');
const ctx = { window: {} };
vm.runInNewContext(src, ctx);
const D = ctx.window.RightsData;
const CELL = 16, COLS = 80, ROWS = 45;

const inWalk = (r, x, y) => r.walk.some(([rx, ry, w, h]) => x >= rx && x <= rx + w && y >= ry && y <= ry + h);
function reachable(r) {
  const ok = (cx, cy) => cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS && inWalk(r, cx * CELL + 8, cy * CELL + 8);
  const seen = new Set(), start = [Math.floor(r.hero.x / CELL), Math.floor(r.hero.y / CELL)], q = [start];
  seen.add(start.join());
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = [x + dx, y + dy];
      if (ok(...k) && !seen.has(k.join())) { seen.add(k.join()); q.push(k); }
    }
  }
  return (x, y) => seen.has([Math.floor(x / CELL), Math.floor(y / CELL)].join());
}

const casts = {};
for (const part of Object.values(D.SCRIPT)) for (const st of part) if (st.cast) (casts[st.room] ||= []).push(...st.cast);

let checked = 0;
for (const [id, r] of Object.entries(D.ROOMS)) {
  const reach = reachable(r);
  for (const [what, p] of [['출발점', r.hero], ['출입구', r.exit], ...(casts[id] || []).map((c) => ['인물 ' + c.id, c])]) {
    assert.ok(inWalk(r, p.x, p.y), `${id} ${what} (${p.x},${p.y})가 걷기 영역 밖`);
    assert.ok(reach(p.x, p.y), `${id} ${what}에 걸어서 닿지 않음`);
    checked++;
  }
}
for (const [id, s] of Object.entries(D.SPOTS)) {
  const r = D.ROOMS[s.room];
  const npc = s.npc && (casts[s.room] || []).find((c) => c.id === s.npc);
  const stand = s.stand || (npc && { x: npc.x, y: npc.y + 50 });
  assert.ok(stand, `${id} 설 자리 없음`);
  assert.ok(inWalk(r, stand.x, stand.y) && reachable(r)(stand.x, stand.y), `${id} 설 자리 (${stand.x},${stand.y})에 닿지 않음`);
  for (const st of s.steps) {
    if (st.t === 'card') assert.ok(D.CARDS[st.id], `${id}: 카드 ${st.id} 없음`);
    if (st.t === 'quiz') assert.ok(D.QUIZ[st.id], `${id}: 문항 ${st.id} 없음`);
  }
  for (const n of s.need || []) assert.ok(D.SPOTS[n], `${id}: need ${n} 없음`);
  checked++;
}
for (const part of Object.values(D.SCRIPT)) for (const st of part) {
  if (st.t === 'card') assert.ok(D.CARDS[st.id], `카드 ${st.id} 없음`);
  if (st.t === 'explore') for (const sp of st.spots) assert.equal(D.SPOTS[sp].room, st.room, `${sp}는 ${st.room}에 있어야 함`);
}
// 데이터 문항의 정답 표시는 사실 계산과 맞아야 한다
assert.equal(D.QUIZ.q1_2.options[D.QUIZ.q1_2.answer], `${5.0 / 0.5}배`);
assert.equal(D.QUIZ.q2_1.options[D.QUIZ.q2_1.answer], `${1960 / 2000 * 100}%`);
assert.equal(D.QUIZ.q3_1.options[D.QUIZ.q3_1.answer], `${10000 * 0.005}명`);
assert.equal(D.QUIZ.q3_2.options[D.QUIZ.q3_2.answer], `${(1e6 * 0.005).toLocaleString('en-US')}건`);
// 지호(jiho)·하늘(haneul) 이름은 이 게임에서 서로 바꿔 부른다
assert.equal(D.nameOf('jiho'), '하늘');
assert.equal(D.nameOf('haneul'), '지호');
// '초등학교' 표기를 쓰지 않는다(중등편 결정)
for (const f of ['../js/data.js', '../index.html', '../js/app.js']) assert.ok(!fs.readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8').includes('초등'), `${f}에 '초등' 표기`);
console.log(`ok — 좌표 ${checked}곳, 카드·문항 참조, 수치, 표기 검사`);
