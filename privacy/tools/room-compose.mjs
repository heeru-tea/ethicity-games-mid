// 내 방 장면 그림 = room-base.png(fal로 만든 원본 그대로) + 판다 인형 축소 + 공통 팩 코르크보드. node privacy/tools/room-compose.mjs
// 2026-11-03 플레이테스트: 방을 0.55배로 줄여 그려도 판다가 캐릭터 키보다 커서(약 2.6칸) 판다만 더 줄인다.
//   판다는 원본 그림에 박혀 있어서 ① 바닥색이 아닌 덩어리로 오려 내고 ② 그 자리를 왼쪽 바닥으로 메운 뒤 ③ 줄여서 다시 앉힌다.
// 코르크보드는 공통 팩 backgrounds/props.png 한 칸(2열 4번째)을 잘라 침대 옆 창가에 세운다 — world.js corkboard 자리와 같은 곳.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const sharp = (await import('file:///D:/Works/sih26/node_modules/sharp/lib/index.js')).default;
const PRIV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = path.join(PRIV, 'assets/scenes/room-base.png'), OUT = path.join(PRIV, 'assets/scenes/room.png');
const PROPS = path.join(PRIV, '..', 'shared', 'ethicity-elementary-common-v1', 'backgrounds', 'props.png');

const BOX = { x0: 1445, y0: 675, x1: 1665, y1: 941 }; // 판다가 든 사각형(원본 1672×941)
const PANDA = { scale: 0.75, cx: 1545, bottom: 926 }; // 줄인 판다: 발밑 가운데·배율
const CORK = { src: { left: 790, top: 268, width: 216, height: 234 }, w: 150, cx: 640, bottom: 430 };
const FILL_DX = 270; // 메울 바닥을 가져올 왼쪽 거리

const { data, info } = await sharp(BASE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = info.channels;
const at = (x, y) => (y * W + x) * C;
const isFloor = (x, y) => { const i = at(x, y); return data[i] > 150 && data[i] - data[i + 2] > 62; }; // 나무 바닥은 채도 높은 주황

// ① 사각형 안 '바닥 아닌' 칸 중 가장 큰 덩어리 = 판다(벽·책꽂이 조각은 작다)
const seen = new Set();
let best = [];
for (let y = BOX.y0; y < BOX.y1; y++) for (let x = BOX.x0; x < BOX.x1; x++) {
  const k = y * W + x;
  if (seen.has(k) || isFloor(x, y)) continue;
  const q = [[x, y]], blob = [];
  seen.add(k);
  while (q.length) {
    const [a, b] = q.pop();
    blob.push([a, b]);
    for (const [c, d] of [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]]) {
      if (c < BOX.x0 || c >= BOX.x1 || d < BOX.y0 || d >= BOX.y1) continue;
      const kk = d * W + c;
      if (seen.has(kk) || isFloor(c, d)) continue;
      seen.add(kk); q.push([c, d]);
    }
  }
  if (blob.length > best.length) best = blob;
}
const bw = BOX.x1 - BOX.x0, bh = BOX.y1 - BOX.y0;
const cut = Buffer.alloc(bw * bh * 4); // 오려 낸 판다(RGBA)
const mask = new Uint8Array(bw * bh);
for (const [x, y] of best) {
  const i = at(x, y), j = ((y - BOX.y0) * bw + (x - BOX.x0)) * 4;
  cut[j] = data[i]; cut[j + 1] = data[i + 1]; cut[j + 2] = data[i + 2]; cut[j + 3] = 255;
  mask[(y - BOX.y0) * bw + (x - BOX.x0)] = 1;
}
// 구멍(눈 주변 등 바닥색으로 잘못 뚫린 곳)은 없다고 보고, 그림자까지 지우려고 판다에서 18칸 넓혀 바닥으로 메운다
const R = 18, wide = new Uint8Array(bw * bh);
for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
  if (!mask[y * bw + x]) continue;
  for (let d = -R; d <= R; d++) for (let e = -R; e <= R; e++) {
    if (d * d + e * e > R * R) continue;
    const a = x + e, b = y + d;
    if (a >= 0 && a < bw && b >= 0 && b < bh) wide[b * bw + a] = 1;
  }
}
// ② 메우기: 같은 줄의 왼쪽 바닥(판자 가로줄이 이어진다)
for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
  if (!wide[y * bw + x]) continue;
  const X = x + BOX.x0, Y = y + BOX.y0, i = at(X, Y), s = at(X - FILL_DX, Y);
  data[i] = data[s]; data[i + 1] = data[s + 1]; data[i + 2] = data[s + 2];
}
// ③ 줄인 판다 + 코르크보드
const pandaPng = await sharp(cut, { raw: { width: bw, height: bh, channels: 4 } }).trim().png().toBuffer();
const pm = await sharp(pandaPng).metadata();
const small = await sharp(pandaPng).resize({ width: Math.round(pm.width * PANDA.scale), kernel: 'lanczos3' }).png().toBuffer();
const sm = await sharp(small).metadata();
const shadow = (w, h) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w * 0.46}" ry="${h * 0.42}" fill="rgba(70,40,10,0.26)"/></svg>`);
const corkTrim = await sharp(await sharp(PROPS).extract(CORK.src).png().toBuffer()).trim().png().toBuffer(); // sharp는 한 줄에서 trim을 먼저 해서 두 번에 나눔
const cork = await sharp(corkTrim).resize({ width: CORK.w, kernel: 'lanczos3' }).png().toBuffer();
const cm = await sharp(cork).metadata();
await sharp(data, { raw: { width: W, height: H, channels: C } }).composite([
  { input: shadow(sm.width, 26), left: Math.round(PANDA.cx - sm.width / 2), top: PANDA.bottom - 15 },
  { input: small, left: Math.round(PANDA.cx - sm.width / 2), top: PANDA.bottom - sm.height },
  { input: shadow(cm.width, 18), left: Math.round(CORK.cx - cm.width / 2), top: CORK.bottom - 10 },
  { input: cork, left: Math.round(CORK.cx - cm.width / 2), top: CORK.bottom - cm.height }
]).png().toFile(OUT);
await sharp(OUT).webp({ quality: 82 }).toFile(OUT.replace(/\.png$/, '.webp'));
console.log(`✓ room.png + room.webp (판다 ${pm.width}×${pm.height} → ${sm.width}×${sm.height} @${PANDA.cx},${PANDA.bottom}, 코르크보드 ${cm.width}×${cm.height} @${CORK.cx},${CORK.bottom})`);
