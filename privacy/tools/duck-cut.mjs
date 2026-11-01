// 공통 팩 공식 레퍼런스(REF_B_world_concept.png) 연못의 오리 3마리를 물에서 오려 assets/props/duck-*.png(투명)로.
//   같은 그림체(공통 팩)라 마을 연못에 그대로 띄운다. node privacy/tools/duck-cut.mjs → 합성은 tools/village-compose.mjs
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const sharp = (await import('file:///D:/Works/sih26/node_modules/sharp/lib/index.js')).default;
const PRIV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = path.join(PRIV, '..', 'shared', 'ethicity-elementary-common-v1', 'references', 'REF_B_world_concept.png');
const OUT = path.join(PRIV, 'assets', 'props');
fs.mkdirSync(OUT, { recursive: true });

// 레퍼런스 그림(1122×1402) 안 오리 자리(여유 있게)
const DUCKS = { 'duck-white': [526, 582, 60, 50], 'duck-yellow1': [580, 607, 46, 40], 'duck-yellow2': [619, 618, 46, 40] };

for (const [name, [l, t, w, h]] of Object.entries(DUCKS)) {
  const { data, info } = await sharp(REF).extract({ left: l, top: t, width: w, height: h }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const water = (p) => { const i = p * 4, r = data[i], g = data[i + 1], b = data[i + 2]; return b > r + 35 && b > 120; }; // 물(파랑·하늘색·물결)
  const seen = new Uint8Array(W * H), q = [];
  for (let x = 0; x < W; x++) q.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) q.push(y * W, y * W + W - 1);
  while (q.length) { // 가장자리에서 물을 번져 지운다(오리 윤곽선 안쪽은 안 들어감)
    const p = q.pop();
    if (seen[p] || !water(p)) continue;
    seen[p] = 1; data[p * 4 + 3] = 0;
    const x = p % W, y = (p / W) | 0;
    if (x > 0) q.push(p - 1); if (x < W - 1) q.push(p + 1); if (y > 0) q.push(p - W); if (y < H - 1) q.push(p + W);
  }
  // 가장 큰 덩어리(오리)만 남김 — 옆 오리 조각·물 반짝임 제거
  const lab = new Int32Array(W * H).fill(-1); let best = -1, bestN = 0, id = 0;
  for (let s = 0; s < W * H; s++) {
    if (lab[s] >= 0 || !data[s * 4 + 3]) continue;
    const st = [s]; let n = 0; lab[s] = id;
    while (st.length) { const p = st.pop(); n++; const x = p % W, y = (p / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const qq = ny * W + nx; if (lab[qq] < 0 && data[qq * 4 + 3]) { lab[qq] = id; st.push(qq); } } }
    if (n > bestN) { bestN = n; best = id; } id++;
  }
  for (let p = 0; p < W * H; p++) if (lab[p] !== best) data[p * 4 + 3] = 0;
  await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: 4 } }).trim().png().toFile(path.join(OUT, name + '.png'));
  const m = await sharp(path.join(OUT, name + '.png')).metadata();
  console.log(`✓ assets/props/${name}.png ${m.width}×${m.height}`);
}
