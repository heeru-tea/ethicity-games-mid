// 걷기 구간마다 인물 배치가 길을 막거나 좁히는지 점검(2026-11-02). node privacy/tests/audit-placement.cjs [--map]
//   표: 시작→목적지 최단 걸음(인물 없음 / 인물 있음) · 문·도착 칸·목적지 접근 칸 위 인물 · 한 칸 통로(끊는 칸) 위 인물
//       · 인물 하나가 장면 안 주요 지점(문·도착 칸·시작·목적지 접근) 사이 길을 몇 걸음 늘리는지 · 말 걸 빈 칸 수 · 붙어 선 인물
//   --map: 장면별 칸 지도(.=걷는 칸 #=막힘 D=문 A=도착 칸 o=조사 지점 S=시작 글자=인물)
//   종료 코드: 문제(ERR)가 있으면 1
const WD = require('../js/world.js');
const T = WD.triggers, SW = WD.SW, H = WD.H;
const SHOW_MAP = process.argv.includes('--map');
const K = (x, y) => x + ',' + y;
const sceneOf = (x) => WD.sceneAt(x);
const ARRIVALS = {}; Object.values(WD.DOORS).forEach((d) => { ARRIVALS[K(d.to[0], d.to[1])] = true; });
const DOORS = WD.DOORS;

function dist(from, goal, blocked) { const p = WD.findPath(from, goal, blocked); return p ? p.length : Infinity; }
function boxOf(trig, cast) {
  if (trig.target.npc) { const c = cast.find((k) => k.who === trig.target.npc); return { x: c.x, y: c.y, w: 1, h: 1 }; }
  const o = WD.object(trig.target.obj); return { x: o.x, y: o.y, w: o.w, h: o.h };
}
const inBox = (b) => (x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
// 같은 장면 안 BFS 거리(문은 건너지 않음)
function bfsScene(sx, sy, blocked, ox) {
  const d = {}; const q = [[sx, sy]]; d[K(sx, sy)] = 0;
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < ox || nx >= ox + SW || ny < 0 || ny >= H) continue;
      if (!WD.walkable(nx, ny, blocked) || d[K(nx, ny)] !== undefined) continue;
      d[K(nx, ny)] = d[K(x, y)] + 1; q.push([nx, ny]);
    }
  }
  return d;
}
const free4 = (x, y, blocked) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => WD.walkable(x + dx, y + dy, blocked)).length;

const rows = []; let errs = 0;
for (const id of Object.keys(T)) {
  const trig = T[id], cast = trig.cast, spawn = WD.SPAWNS[trig.spawn];
  const blocked = {}; cast.forEach((c) => { blocked[K(c.x, c.y)] = true; });
  const box = boxOf(trig, cast), goal = WD.adjacentTo({ contains: inBox(box) });
  const d0 = dist(spawn, goal, trig.target.npc ? { [K(box.x, box.y)]: true } : {}), d1 = dist(spawn, goal, blocked);
  const issues = [];
  if (d1 === Infinity) { issues.push('ERR 목적지에 못 감'); errs++; }
  else if (d1 > d0) issues.push(`돌아감 +${d1 - d0}`);
  // 주요 지점(장면별): 문 칸, 도착 칸, 시작, 목적지 접근 칸 — 인물 자신 칸은 빼고
  const keyPts = (ox) => {
    const pts = [];
    for (const k of Object.keys(DOORS)) { const [x, y] = k.split(',').map(Number); if (x >= ox && x < ox + SW) pts.push([x, y, 'door']); }
    for (const k of Object.keys(ARRIVALS)) { const [x, y] = k.split(',').map(Number); if (x >= ox && x < ox + SW) pts.push([x, y, 'arr']); }
    if (spawn.x >= ox && spawn.x < ox + SW) pts.push([spawn.x, spawn.y, 'spawn']);
    return pts;
  };
  cast.forEach((c) => {
    const sc = sceneOf(c.x), ox = sc.ox, me = K(c.x, c.y), lx = c.x - ox;
    const tag = `${c.who}(${sc.id} ${lx},${c.y})`;
    if (!WD.walkable(c.x, c.y)) { issues.push(`ERR ${tag} 막힌 칸(가구·벽) 위`); errs++; }
    if (DOORS[me]) { issues.push(`ERR ${tag} 출입구 칸 위`); errs++; }
    if (ARRIVALS[me]) { issues.push(`ERR ${tag} 문 도착 칸 위`); errs++; }
    if (Math.abs(c.x - spawn.x) + Math.abs(c.y - spawn.y) <= 1) issues.push(`${tag} 시작 칸 바로 옆`);
    for (const k of Object.keys(ARRIVALS)) { const [x, y] = k.split(',').map(Number); if (Math.abs(c.x - x) + Math.abs(c.y - y) === 1) issues.push(`${tag} 문 도착 칸 바로 옆`); }
    // 사물 목적지 접근 칸
    if (!trig.target.npc && goal(c.x, c.y)) issues.push(`${tag} 목적지 접근 칸 위`);
    // 다른 인물을 뺀 말 걸 빈 칸 수
    const others = {}; cast.forEach((o) => { if (o !== c) others[K(o.x, o.y)] = true; });
    const f = free4(c.x, c.y, others);
    if (f <= 1) issues.push(`${tag} 말 걸 빈 칸 ${f}개`);
    // 이 인물 하나 때문에 장면 안 주요 지점 사이가 얼마나 멀어지나(끊기면 ERR)
    const pts = keyPts(ox).filter((p) => K(p[0], p[1]) !== me);
    if (!trig.target.npc && sceneOf(box.x) === sc) { // 목적지 접근 칸 하나(가장 가까운 것 대신 전부 중 최소로 계산)
      pts.push([null, null, 'goal']);
    }
    let worst = 0, cut = false;
    const without = {}; Object.assign(without, others);
    const withC = Object.assign({}, others, { [me]: true });
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j];
      if (a[2] === 'goal' || b[2] === 'goal') continue;
      const da = bfsScene(a[0], a[1], without, ox)[K(b[0], b[1])], db = bfsScene(a[0], a[1], withC, ox)[K(b[0], b[1])];
      if (da === undefined) continue;
      if (db === undefined) cut = true; else worst = Math.max(worst, db - da);
    }
    if (cut) { issues.push(`ERR ${tag} 주요 지점 사이 길을 끊음`); errs++; }
    else if (worst >= 2) issues.push(`${tag} 주요 길 +${worst}걸음`);
    // 한 칸 통로: 이 칸을 막으면 장면 안 걷는 칸이 둘로 갈리나(다른 인물 고려)
    const start = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [c.x + dx, c.y + dy]).filter(([x, y]) => x >= ox && x < ox + SW && WD.walkable(x, y, withC));
    if (start.length >= 2) {
      const d = bfsScene(start[0][0], start[0][1], withC, ox);
      if (start.some(([x, y]) => d[K(x, y)] === undefined)) issues.push(`${tag} 한 칸 통로를 막음`);
    }
  });
  // 붙어 선 인물(말 걸 때 누가 대상인지 헷갈림)
  for (let i = 0; i < cast.length; i++) for (let j = i + 1; j < cast.length; j++) {
    const a = cast[i], b = cast[j];
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1) issues.push(`${a.who}·${b.who} 바로 붙어 섬`);
  }
  rows.push({ id, spawn: trig.spawn, target: trig.target.npc || trig.target.obj, d0, d1, issues });
}

console.log('걷기 구간 | 시작 | 목적지 | 최단(인물 없음) | 최단(인물 있음) | 지적');
console.log('---|---|---|---|---|---');
rows.forEach((r) => console.log(`${r.id} | ${r.spawn} | ${r.target} | ${r.d0} | ${r.d1} | ${r.issues.join(' · ') || '-'}`));
console.log(`\n합계 최단 걸음: 인물 없음 ${rows.reduce((s, r) => s + r.d0, 0)} · 인물 있음 ${rows.reduce((s, r) => s + r.d1, 0)} · ERR ${errs}`);

if (SHOW_MAP) {
  for (const id of Object.keys(T)) {
    const trig = T[id], spawn = WD.SPAWNS[trig.spawn];
    const scenes = [...new Set(trig.cast.map((c) => sceneOf(c.x).id))];
    for (const sid of scenes) {
      const sc = WD.SCENES.find((s) => s.id === sid);
      console.log(`\n[${id}] ${sid}`);
      console.log('   ' + Array.from({ length: SW }, (_, i) => String(i % 10)).join(''));
      for (let y = 0; y < H; y++) {
        let line = '';
        for (let lx = 0; lx < SW; lx++) {
          const x = sc.ox + lx, k = K(x, y);
          const c = trig.cast.find((q) => q.x === x && q.y === y);
          let ch = WD.grid[y][x] === '#' ? '#' : '.';
          if (WD.objectAt(x, y)) ch = 'o';
          if (ARRIVALS[k]) ch = 'A';
          if (DOORS[k]) ch = 'D';
          if (spawn.x === x && spawn.y === y) ch = 'S';
          if (c) ch = c.who[0].toUpperCase() + (c.who === 'minjun' ? '' : '');
          if (c && c.who === 'minjun') ch = 'M'; if (c && c.who === 'jiho') ch = 'J'; if (c && c.who === 'haneul') ch = 'H'; if (c && c.who === 'saebom') ch = 'B'; if (c && c.who === 'teacher') ch = 'T'; if (c && c.who === 'friend') ch = 'F';
          line += ch;
        }
        console.log(String(y).padStart(2) + ' ' + line);
      }
    }
  }
}
process.exitCode = errs ? 1 : 0;
