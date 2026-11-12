// 우리 집 벽 다듬기(2026-11-11 사용자 지시): house-base.png(벽이 단색 갈색 띠인 원본) → house.png + house.webp + house-walls-night.png(2026-11-12, 밤·저녁에만 덧그리는 어두운 벽 — 아래 「밤 벽 덧그림」)
//   node privacy/tools/house-walls.mjs            → assets/scenes/house.png · house.webp · house-walls-night.png 다시 만들기
//   node privacy/tools/house-walls.mjs --check    → 벽 자리 대조표만(파일은 안 씀)
//   node privacy/tools/house-walls.mjs --mask     → 구분 확인 그림도(tests/_shot-walls-mask.png, gitignore 대상 — 벽 윗면·옆면·걸레받이·집 바깥·그림자를 원색으로)
// 가구·바닥·벽지·출입구는 한 픽셀도 다시 그리지 않는다. 원본의 '벽 갈색'(110,88,67 ±2, 완전 단색) 픽셀만 새 색으로 바꾸고(가구 윤곽과 맞닿아 색이 섞인 가장자리 픽셀은 섞인 만큼만),
// 벽 아래·옆 마룻바닥에만 옅은 그림자를 곱한다. 그림 크기·좌표는 그대로 → world.js·map.js는 건드릴 일이 없다(밤 벽 덧그림만 world.js SCENES room.bgOuterNight · map.js drawOuter WALL_NIGHT가 쓴다).
//
// 벽 자리 = world.js SCENES room 의 벽 칸(WALLS) × 그림 픽셀:
//   ① 칸(32×18) → 픽셀(1672×941) 예상 자리를 구하고 ② 그 근처에서 실제 갈색이 끝나는 줄을 재서 맞춘다(±SNAP 안에서, 못 찾거나 벗어나면 멈춤).
//   ③ 벽 = 맞춘 사각형의 합(윗면·옆면 줄이 곧게 나오도록 사각형 기하로만 나눈다). 사각형 밖 6px 안에 붙어 남은 갈색(그림 가장자리가 1~5px 들쭉날쭉한 만큼)은 윤곽선 색으로 덮는다.
// 집 바깥 = 위쪽 띠의 첫 줄: world.js에서 바깥벽은 왼쪽·오른쪽·아래가 한 칸 두께인데 위만 두 칸([0,0,32,2])이고, 그 윗줄은 실내 어느 칸과도 닿지 않는다
//   → 실내 위 끝에서 한 칸까지만 벽, 그 위는 집 바깥(어둡게 가라앉힘). 갈색을 전부 한 색으로 바꾸지 않는다.
// 벽 가장자리(벽 사각형 기하로 판정 — 벽 앞에 놓인 수납장·화분 뒤에서는 가려진 채로 이어진다):
//   · 바닥을 향한 아래쪽(방문 양옆 가로 벽, 세로 벽 아래 끝): 옆면 띠 + 걸레받이 + 바닥 그림자
//   · 거실·복도·출입구를 향한 옆쪽(세로 벽 오른쪽, 바깥벽 안쪽, 문설주): 얇은 옆면 + 걸레받이 줄 + 옅은 그림자
//   · 내 방 그림(room.png가 덧그려지는 자리)과 닿는 곳, 거실 뒷벽 벽지 위(위 바깥벽 아래 끝), 바닥보다 아래쪽에 있는 벽의 위 가장자리(카메라에서 안 보이는 면), 집 바깥·그림 끝: 윤곽선만
//     — 내 방의 옆벽·뒷벽은 room.png가 이미 벽면(창·벽지)을 그려 놓았으므로 옆면을 또 넣으면 벽이 두 겹이 된다.
// 다 만든 뒤 `node tests/house-walls-1111.mjs`(전·후 비교 화면)로 볼 것.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = (await import('file:///D:/Works/sih26/node_modules/sharp/lib/index.js')).default;
const WORLD = require('../js/world.js');
const PRIV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(PRIV, 'assets', 'scenes');
const BASE = path.join(DIR, 'house-base.png'), OUT = path.join(DIR, 'house.png');
const CHECK = process.argv.includes('--check'), MASK = process.argv.includes('--mask');

/* 색(원본 팔레트: 크림 벽지 244,229,199 · 초록 징두리 127,148,117 · 마룻바닥 223,158,96 · 현관 타일 179,174,163) */
const BROWN = [110, 88, 67];   // 원본 벽 띠(단색)
const COL = {
  top: [210, 201, 186],        // 벽 윗면: 밝은 회베이지(벽지보다 회색·한 톤 어둡게 — 벽지와 헷갈리지 않게)
  lip: [232, 225, 212],        // 윗면이 옆면으로 꺾이는 모서리 한 줄
  face: [187, 172, 151],       // 아래로 보이는 옆면: 조금 어두운 베이지
  side: [196, 182, 162],       // 옆으로 보이는 얇은 옆면
  dark: [94, 65, 43],          // 걸레받이·윤곽선: 짙은 갈색(그림의 가구 윤곽선 계열)
  out: [70, 57, 46]            // 집 바깥: 원본 갈색을 어둡게 가라앉힘
};
/* 두께(px, 그림 1672×941 기준 — 화면에서는 칸이 28px일 때 약 0.54배: 1280×800·390×844 둘 다 그쯤) */
const OL = 3;                  // 윤곽선
const BASEBOARD = 6;           // 아래쪽 걸레받이
const FACE = 16;               // 아래쪽 옆면
const SIDE = 9;                // 옆쪽 옆면
const LIP = 2;                 // 윗면 모서리 줄
const SHADOW = { s: [[5, 0.24], [11, 0.11]], side: [[5, 0.12]] }; // [벽에서부터 px, 어두워지는 정도]
const SNAP = 14, SNAP_MAX = 8, GROW = 6; // 맞출 때 찾는 범위 · 칸 계산과 그림이 이보다 더 어긋나면 멈춤 · 사각형 밖에 붙은 갈색을 벽으로 볼 거리

/* world.js의 벽 칸(장면 안 칸). x0 = 내 방 그림 오른쪽 끝(세로 벽은 칸 18~19 중 그림이 덮지 않는 곳만 갈색) */
const sc = WORLD.SCENES.find((s) => s.id === 'room'), BG = sc.bg;
const WALLS = [
  { id: '위 바깥벽', r: [0, 0, 32, 2] }, { id: '왼쪽 바깥벽', r: [0, 0, 1, 18] }, { id: '오른쪽 바깥벽', r: [31, 0, 1, 18] },
  { id: '방↔거실 세로 벽', r: [18, 2, 2, 11], x0: BG.x + BG.w },
  { id: '방문 왼쪽 가로 벽', r: [0, 12, 9, 1] }, { id: '방문 오른쪽 가로 벽', r: [11, 12, 9, 1] },
  { id: '아래 바깥벽(현관 왼쪽)', r: [0, 17, 24, 1] }, { id: '아래 바깥벽(현관 오른쪽)', r: [28, 17, 4, 1] }
];
const LIVING_WALL = [20, 2, 11, 3]; // 거실 뒷벽(벽지 면) — 그 위 가장자리(위 바깥벽 아래 끝)는 윤곽선만. 옆(세로 벽·오른쪽 바깥벽)의 옆면은 벽지 옆에서도 이어진다
const has = (r) => sc.rects.some((q) => q.join() === r.join());
for (const w of WALLS.concat([{ id: '거실 뒷벽', r: LIVING_WALL }])) if (!has(w.r)) throw new Error(`world.js SCENES room.rects에 ${w.id} [${w.r}] 가 없다 — 벽 칸이 바뀌었으면 이 표(WALLS)와 그림을 같이 고칠 것`);

const { data: src, info } = await sharp(BASE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, CW = W / WORLD.SW, CH = H / WORLD.SH;
const at = (x, y) => (y * W + x) * 3;
const dist = (x, y) => { const i = at(x, y); return Math.max(Math.abs(src[i] - BROWN[0]), Math.abs(src[i + 1] - BROWN[1]), Math.abs(src[i + 2] - BROWN[2])); };
const brown = (x, y) => x >= 0 && y >= 0 && x < W && y < H && dist(x, y) <= 14;
const alpha = (x, y) => Math.max(0, Math.min(1, 1 - (dist(x, y) - 8) / 18)); // 갈색이 섞인 만큼(가장자리 픽셀)
const wood = (x, y) => { const i = at(x, y), r = src[i], g = src[i + 1], b = src[i + 2]; return r > 185 && g > 115 && b < 150 && r - b > 70; }; // 마룻바닥

/* ① 예상 자리 → ② 실제 갈색 끝 줄로 맞추기 */
const median = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
function snapX(xe, y0, y1, side) { // 세로 가장자리. side -1 = 벽이 왼쪽(x < e), +1 = 벽이 오른쪽(x ≥ e)
  if (xe <= 0 || xe >= W) return Math.round(xe);
  const hit = [];
  for (let y = Math.ceil(y0) + 6; y < y1 - 6; y += 3) {
    let best = null;
    for (let e = Math.round(xe) - SNAP; e <= Math.round(xe) + SNAP; e++) {
      const ok = side < 0 ? brown(e - 1, y) && brown(e - 2, y) && !brown(e, y) && !brown(e + 1, y) : !brown(e - 1, y) && !brown(e - 2, y) && brown(e, y) && brown(e + 1, y);
      if (ok && (best === null || Math.abs(e - xe) < Math.abs(best - xe))) best = e;
    }
    if (best !== null) hit.push(best);
  }
  return hit.length >= 8 ? median(hit) : null;
}
function snapY(ye, x0, x1, side) { // 가로 가장자리. side -1 = 벽이 위(y < e), +1 = 벽이 아래(y ≥ e)
  if (ye <= 0 || ye >= H) return Math.round(ye);
  const hit = [];
  for (let x = Math.ceil(x0) + 6; x < x1 - 6; x += 3) {
    let best = null;
    for (let e = Math.round(ye) - SNAP; e <= Math.round(ye) + SNAP; e++) {
      const ok = side < 0 ? brown(x, e - 1) && brown(x, e - 2) && !brown(x, e) && !brown(x, e + 1) : !brown(x, e - 1) && !brown(x, e - 2) && brown(x, e) && brown(x, e + 1);
      if (ok && (best === null || Math.abs(e - ye) < Math.abs(best - ye))) best = e;
    }
    if (best !== null) hit.push(best);
  }
  return hit.length >= 8 ? median(hit) : null;
}
const table = [];
for (const w of WALLS) {
  const [cx, cy, cw, ch] = w.r, want = { x0: (w.x0 ?? cx) * CW, y0: cy * CH, x1: (cx + cw) * CW, y1: (cy + ch) * CH };
  const got = { x0: snapX(want.x0, want.y0, want.y1, +1), x1: snapX(want.x1, want.y0, want.y1, -1), y0: snapY(want.y0, want.x0, want.x1, +1), y1: snapY(want.y1, want.x0, want.x1, -1) };
  w.px = {}; w.joined = [];
  for (const k of ['x0', 'y0', 'x1', 'y1']) {
    if (got[k] === null) { w.px[k] = Math.round(want[k]); w.joined.push(k); continue; } // 갈색이 끝나지 않는 가장자리 = 다른 벽과 이어진 곳(예상 자리 그대로)
    if (Math.abs(got[k] - want[k]) > SNAP_MAX) throw new Error(`${w.id} ${k}: 칸으로 본 자리 ${want[k].toFixed(1)} ↔ 그림 ${got[k]} — ${SNAP_MAX}px 넘게 다르다(world.js와 그림이 어긋남)`);
    w.px[k] = got[k];
  }
  table.push(`  ${w.id.padEnd(16)} 칸 [${w.r}]${w.x0 ? ` (왼쪽 끝 ${w.x0}칸)` : ''} → 예상 x ${want.x0.toFixed(1)}~${want.x1.toFixed(1)} y ${want.y0.toFixed(1)}~${want.y1.toFixed(1)} → 그림 x ${w.px.x0}~${w.px.x1} y ${w.px.y0}~${w.px.y1}${w.joined.length ? ` (이어진 쪽: ${w.joined})` : ''}`);
}
const byId = (id) => WALLS.find((w) => w.id === id).px;
const top = byId('위 바깥벽'), left = byId('왼쪽 바깥벽'), right = byId('오른쪽 바깥벽'), div = byId('방↔거실 세로 벽'), doorL = byId('방문 왼쪽 가로 벽'), doorR = byId('방문 오른쪽 가로 벽');
const botL = byId('아래 바깥벽(현관 왼쪽)'), botR = byId('아래 바깥벽(현관 오른쪽)');
div.y0 = top.y1; // 세로 벽은 위 바깥벽에 이어진다
div.x1 = doorR.x1 = Math.min(div.x1, doorR.x1); // 세로 벽 오른쪽 면과 그 아래 끝(가로 벽 오른쪽 끝)은 한 줄 — 따로 재면 1px 어긋나 옆면 줄이 꺾인다
const OUT_Y = Math.round(top.y1 - CH); // 이 줄 위 = 집 바깥(위 바깥벽은 실내 위 끝에서 한 칸까지만)
console.log('벽 자리 대조(world.js 칸 ↔ house-base.png 갈색):\n' + table.join('\n'));
console.log(`  집 바깥 = y < ${OUT_Y} (위 띠 ${top.y1}px 중 실내 쪽 한 칸 ${Math.round(CH)}px만 벽)`);
console.log(`  방문 통로 x ${doorL.x1}~${doorR.x0} (칸 9~11 = ${(9 * CW).toFixed(1)}~${(11 * CW).toFixed(1)}) · 현관 통로 x ${botL.x1}~${botR.x0} (칸 24~28 = ${(24 * CW).toFixed(1)}~${(28 * CW).toFixed(1)})`);
if (CHECK) process.exit(0);

/* ③ 벽 영역 G = 맞춘 사각형의 합(곧은 줄). 사각형 밖 GROW px 안에 붙어 남은 갈색(RAG — 그림 가장자리가 1~5px 들쭉날쭉한 만큼)은 윤곽선 색으로 덮는다 */
const G = new Uint8Array(W * H);
for (const w of WALLS) for (let y = Math.max(w.px.y0, OUT_Y); y < w.px.y1; y++) for (let x = w.px.x0; x < w.px.x1; x++) G[y * W + x] = 1;
const inG = (x, y) => x >= 0 && y >= 0 && x < W && y < H && G[y * W + x] === 1;
const RAG = new Uint8Array(W * H);
for (let y = OUT_Y; y < H; y++) for (let x = 0; x < W; x++) {
  if (G[y * W + x] || alpha(x, y) <= 0) continue;
  search: for (let d = -GROW; d <= GROW; d++) for (let e = -GROW; e <= GROW; e++) if (inG(x + e, y + d)) { RAG[y * W + x] = 1; break search; }
}

/* 벽이 닿는 곳의 종류 */
const Z = { EDGE: 0, OUT: 1, PIC: 2, FLOOR: 3 };
const livY1 = Math.round((LIVING_WALL[1] + LIVING_WALL[3]) * CH);
function zone(x, y) {
  if (x < 0 || x >= W || y >= H) return Z.EDGE;
  if (y < OUT_Y) return Z.OUT;
  if (x >= left.x1 - 2 && x < div.x0 + 2 && y >= top.y1 - 2 && y < doorL.y0 + 2) return Z.PIC;        // 내 방 그림
  if (x >= div.x1 - 2 && x < right.x0 + 2 && y >= top.y1 - 2 && y < livY1) return Z.PIC;               // 거실 뒷벽 벽지
  return Z.FLOOR;
}
const SW_ = OL + SIDE, SF = BASEBOARD + FACE; // 옆면·아래 옆면이 벽 안쪽으로 차지하는 폭(윤곽·걸레받이 포함)
function look(x, y, dx, dy, reach) { // 그 방향으로 벽이 끝나는 거리(1 = 바로 옆)와 그 너머의 종류
  for (let d = 1; d <= reach; d++) if (!inG(x + dx * d, y + dy * d)) return [d, zone(x + dx * d, y + dy * d)];
  return [99, -1];
}
function nearEdge(x, y) { // 벽이 아닌 픽셀이 OL 안에(대각선 포함 — 모서리에서 윤곽선이 끊기지 않게)
  for (let d = -OL; d <= OL; d++) for (let e = -OL; e <= OL; e++) if (!inG(x + e, y + d)) return true;
  return false;
}
function corner(x, y, sx) { // 오목한 모서리(왼쪽 바깥벽 ↔ 방문 왼쪽 가로 벽): 대각선 아래(sx 쪽)에 바닥이 있으면 [가로 거리, 세로 거리]
  let u = 99, v = 99;
  for (let d = 1; d <= SF; d++) for (let e = 1; e <= SW_; e++) {
    const a = x + sx * e, b = y + d;
    if (!inG(a, b) && zone(a, b) === Z.FLOOR) { u = Math.min(u, e); v = Math.min(v, d); }
  }
  return u < 99 ? [u, v] : null;
}
const K = { TOP: 0, LIP: 1, FACE: 2, SIDE: 3, DARK: 4, OUT: 5 };
const kind = new Uint8Array(W * H).fill(255);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const p = y * W + x;
  if (y < OUT_Y) { kind[p] = K.OUT; continue; }
  if (RAG[p]) { kind[p] = K.DARK; continue; }
  if (!G[p]) continue;
  const [ds, zs] = look(x, y, 0, 1, SF), [de, ze] = look(x, y, 1, 0, SW_), [dw, zw] = look(x, y, -1, 0, SW_);
  const sFloor = zs === Z.FLOOR;
  // 옆면은 바닥 옆뿐 아니라 거실 뒷벽 벽지 옆에서도 끊지 않는다(세로 벽 오른쪽·오른쪽 바깥벽이 위에서 아래까지 한 줄). 내 방 그림 쪽은 윤곽선만
  const eFace = ze === Z.FLOOR || (ze === Z.PIC && x >= div.x0 && x < div.x1), wFace = zw === Z.FLOOR || (zw === Z.PIC && x >= right.x0);
  let k = K.TOP;
  if (nearEdge(x, y) || (sFloor && ds <= BASEBOARD)) k = K.DARK;
  else if (sFloor && ds <= SF) k = K.FACE;
  else if ((eFace && de <= SW_) || (wFace && dw <= SW_)) k = K.SIDE;
  else {
    const c = corner(x, y, 1) || corner(x, y, -1);
    if (c) k = c[0] <= OL && c[1] <= BASEBOARD ? K.DARK : c[0] * SF <= c[1] * SW_ ? K.FACE : K.SIDE; // 맞닿는 두 면을 대각선으로 나눔
  }
  kind[p] = k;
}
// 윗면이 옆면으로 꺾이는 모서리 한 줄: 옆면(아래·옆) 바로 옆의 윗면 픽셀(옆면이 끝나는 곳도 같은 줄로 닫힌다)
{
  const lip = [];
  for (let y = OUT_Y; y < H; y++) for (let x = 0; x < W; x++) {
    if (kind[y * W + x] !== K.TOP) continue;
    search: for (let d = -LIP; d <= LIP; d++) for (let e = -LIP; e <= LIP; e++) {
      const a = x + e, b = y + d;
      if (a < 0 || b < 0 || a >= W || b >= H) continue;
      const q = kind[b * W + a];
      if (q === K.FACE || q === K.SIDE) { lip.push(y * W + x); break search; }
    }
  }
  for (const p of lip) kind[p] = K.LIP;
}

/* 그림자를 넣지 않을 곳: world.js의 가구 칸(벽이 아닌 막힌 칸) 안에서 실제 가구가 차지한 범위(마룻바닥·갈색이 아닌 픽셀의 테두리) */
const skip = [];
for (const r of sc.rects) {
  if (WALLS.some((w) => w.r.join() === r.join())) continue;
  const x0 = Math.max(0, Math.round(r[0] * CW) - 8), y0 = Math.max(0, Math.round(r[1] * CH) - 8), x1 = Math.min(W, Math.round((r[0] + r[2]) * CW) + 8), y1 = Math.min(H, Math.round((r[1] + r[3]) * CH) + 8);
  let b = null;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (wood(x, y) || dist(x, y) <= 34) continue;
    b = b ? { x0: Math.min(b.x0, x), y0: Math.min(b.y0, y), x1: Math.max(b.x1, x + 1), y1: Math.max(b.y1, y + 1) } : { x0: x, y0: y, x1: x + 1, y1: y + 1 };
  }
  if (b) skip.push({ x0: b.x0 - 1, y0: b.y0 - 1, x1: b.x1 + 1, y1: b.y1 + 1 });
}
const skipped = (x, y) => skip.some((b) => x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1);
const doorway = (x, y) => (x >= doorL.x1 && x < doorR.x0 && y >= doorL.y0 - GROW && y < doorL.y1 + GROW) || (x >= botL.x1 && x < botR.x0 && y >= botL.y0 - GROW);

/* 칠하기 */
const out = Buffer.from(src);
const shade = new Float32Array(W * H);
let nWall = 0, nOut = 0, nShadow = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const k = kind[y * W + x], i = at(x, y);
  if (k !== 255) { // 벽·집 바깥: 갈색이 섞인 만큼만 새 색으로 옮긴다(가구·화분·매트 픽셀은 a = 0이라 그대로)
    const a = alpha(x, y);
    if (a <= 0) continue;
    const c = [COL.top, COL.lip, COL.face, COL.side, COL.dark, COL.out][k];
    for (let j = 0; j < 3; j++) out[i + j] = a >= 1 ? c[j] : Math.max(0, Math.min(255, Math.round(src[i + j] + a * (c[j] - BROWN[j])))); // 순수한 벽 갈색은 새 색 그대로(원본의 옅은 얼룩을 물려받지 않게)
    if (k === K.OUT) nOut++; else nWall++;
    continue;
  }
  if (zone(x, y) !== Z.FLOOR) continue;
  // 바닥 그림자: 위에 벽(아래로 보이는 옆면)이 있거나 옆에 벽(옆면)이 있을 때
  let s = 0;
  for (const [d, v] of SHADOW.s) { let hit = false; for (let e = 1; e <= d; e++) if (inG(x, y - e)) { hit = true; break; } if (hit) { s = Math.max(s, v); break; } }
  for (const [d, v] of SHADOW.side) { let hit = false; for (let e = 1; e <= d; e++) if (inG(x - e, y) || inG(x + e, y)) { hit = true; break; } if (hit) { s = Math.max(s, v); break; } }
  if (!s) continue;
  if (!doorway(x, y) && (!wood(x, y) || skipped(x, y))) continue; // 통로 안은 바닥·매트뿐이라 그대로 넣고, 그 밖은 마룻바닥에만(가구·화분·벽지 제외)
  shade[y * W + x] = s; nShadow++;
  out[i] = Math.round(src[i] * (1 - s * 0.92)); out[i + 1] = Math.round(src[i + 1] * (1 - s)); out[i + 2] = Math.round(src[i + 2] * (1 - s * 0.96));
}

await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toFile(OUT);
await sharp(OUT).webp({ quality: 82 }).toFile(OUT.replace(/\.png$/, '.webp')); // room-compose.mjs와 같은 품질. js/webp-list.js에는 house.png가 이미 있어 목록은 그대로

/* 밤 벽 덧그림(2026-11-12 사용자 결정 "밤에만 벽을 어둡게 눌러서 마무리") → house-walls-night.png
   밝은 벽은 낮엔 방을 나눠 보여 좋지만, 밤 화면(map.js sceneLight가 그림에 남색을 곱함)에서는 어두운 방보다 벽 띠가 먼저 눈에 들어왔다.
   한 장의 그림이 낮엔 밝고 밤엔 어두울 수는 없으므로, 벽 픽셀(윗면·모서리 줄·옆면)만 '밤 색'으로 칠한 투명 그림을 따로 만들고
   map.js drawOuter가 밤(불투명)·저녁(옅게)에만 house 그림 위에 한 번 더 그린다(낮에는 안 그림 → 낮 화면은 그대로).
   · 같은 크기·같은 자리(1672×941) — 벽이 아닌 곳은 완전 투명. 걸레받이·윤곽선·집 바깥은 원래 짙어서 그대로 둔다.
   · 가구 윤곽과 색이 섞인 가장자리 픽셀은 낮 그림과 같은 식(섞인 만큼만)으로 밤 색을 구해 불투명하게 넣는다 → 덧그리면 정확히 '밤 판'이 된다.
   · webp 사본은 만들지 않는다(무손실 PNG가 이미 작다 — js/webp-list.js에 없으니 게임은 PNG를 바로 요청한다). */
const NIGHT_K = 0.52; // 낮 벽 색 × 이 값 = 밤 벽 색(윗면 109,105,97 — 원본 갈색 띠 110,88,67와 비슷한 밝기, 윗면 > 옆면 순서는 그대로 남는다)
const NIGHT = [COL.top, COL.lip, COL.face, COL.side].map((c) => c.map((v) => Math.round(v * NIGHT_K)));
const NIGHT_OUT = path.join(DIR, 'house-walls-night.png');
const ov = Buffer.alloc(W * H * 4);
let nNight = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const k = kind[y * W + x];
  if (k > K.SIDE) continue; // 걸레받이·윤곽(DARK)·집 바깥(OUT)·벽 아님(255)
  const a = alpha(x, y);
  if (a <= 0) continue;
  const i = at(x, y), o = (y * W + x) * 4, c = NIGHT[k];
  for (let j = 0; j < 3; j++) ov[o + j] = a >= 1 ? c[j] : Math.max(0, Math.min(255, Math.round(src[i + j] + a * (c[j] - BROWN[j]))));
  ov[o + 3] = 255; nNight++;
}
await sharp(ov, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(NIGHT_OUT);
let changed = 0, stray = 0; // stray = 벽 갈색이 전혀 섞이지 않았고 그림자 자리도 아닌데 바뀐 픽셀(가구·벽지·출입구) — 0이어야 한다
for (let p = 0; p < W * H; p++) if (out[p * 3] !== src[p * 3] || out[p * 3 + 1] !== src[p * 3 + 1] || out[p * 3 + 2] !== src[p * 3 + 2]) { changed++; if (!shade[p] && alpha(p % W, (p / W) | 0) <= 0) stray++; }
if (stray) throw new Error('벽이 아닌 픽셀이 ' + stray + '개 바뀌었다');
console.log(`✓ house.png + house.webp — 벽 ${nWall}px · 집 바깥 ${nOut}px · 바닥 그림자 ${nShadow}px, 바뀐 픽셀 ${changed} / ${W * H} (${(changed / W / H * 100).toFixed(1)}%), 벽 갈색·그림자 밖에서 바뀐 픽셀 ${stray}`);
console.log(`✓ house-walls-night.png — 밤 벽 ${nNight}px (낮 벽 ${nWall}px 중 걸레받이·윤곽선 제외), ${(fs.statSync(NIGHT_OUT).size / 1024).toFixed(1)}KB`);

if (MASK) { // 구분 확인용
  const m = Buffer.alloc(W * H * 3);
  const PAL = [[230, 230, 230], [255, 255, 0], [255, 140, 0], [255, 0, 255], [0, 0, 0], [40, 40, 160]];
  for (let p = 0; p < W * H; p++) {
    const k = kind[p], c = k !== 255 ? PAL[k] : shade[p] ? [255, 0, 0] : [Math.round(src[p * 3] * 0.35 + 120), Math.round(src[p * 3 + 1] * 0.35 + 120), Math.round(src[p * 3 + 2] * 0.35 + 120)];
    m[p * 3] = c[0]; m[p * 3 + 1] = c[1]; m[p * 3 + 2] = c[2];
  }
  await sharp(m, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path.join(PRIV, 'tests', '_shot-walls-mask.png'));
  console.log('✓ tests/_shot-walls-mask.png (흰 = 벽 윗면, 노랑 = 모서리 줄, 주황 = 아래 옆면, 분홍 = 옆 옆면, 검정 = 걸레받이·윤곽, 남색 = 집 바깥, 빨강 = 그림자)');
}
