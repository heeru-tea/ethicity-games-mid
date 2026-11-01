// 맵 표시 그림(목적지 표시·말 걸기 ?) — fal.ai nano-banana/edit로 시안 → 공통 팩 픽셀 격자·색으로 맞춤
//   node privacy/tools/marker-art.mjs gen [회차이름]   시안 생성(요금 나감: 1회 = 그림 num장) → assets/markers/raw/<회차>-<n>.png
//   node privacy/tools/marker-art.mjs fit <raw.png> <x> <y> <w> <h> <이름> [격자칸 높이]
//        raw 그림의 한 칸(사각형)을 잘라 → 흰 배경을 가장자리부터 지우고 → 격자칸 높이(기본 16)로 줄이며 칸마다 가장 많은 색 → 공통 팔레트로 스냅
//        → assets/markers/<이름>.png (원래 크기 1배; 게임은 정수 배로 키워 그린다)
//   node privacy/tools/marker-art.mjs sheet          고른 그림을 1·2·3배로 장면 그림 위에 늘어놓은 확인용 판(raw/preview.png)
// 참조: 공통 팩 말풍선(ui/speech.png)·아이콘(ui/icons.png의 ! ?)·REF_A 지도 예시(말풍선 느낌표)·교실 배경
// 키·호출은 publicness 도구(fal.mjs, 키 = publicness/.env — 커밋 금지). 기록은 assets/markers/generation-log.jsonl
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sharp = (await import('file:///D:/Works/sih26/node_modules/sharp/lib/index.js')).default;
const PRIV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMMON = path.join(PRIV, '..', 'shared', 'ethicity-elementary-common-v1');
const OUT = path.join(PRIV, 'assets', 'markers');
const RAW = path.join(OUT, 'raw');
fs.mkdirSync(RAW, { recursive: true });

// 공통 팩 팔레트(manifest.style.palette) + 그림자·밝은 면 몇 단계(공통 말풍선 speech.png에서 뽑은 색)
const PALETTE = {
  ink: '#294b40', inkDark: '#1d3a31', cream: '#fff9e7', creamShade: '#f2e7c7', gold: '#f3cf72', goldDark: '#c9a043',
  goldLight: '#fbe7a6', sage: '#a8bb8c', blue: '#72b7c4', red: '#bf7865', green: '#5a8c65'
};
const PAL = Object.entries(PALETTE).map(([k, h]) => ({ k, r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) }));

async function refs() {
  const r = [];
  // 1) 공통 UI: 말풍선·공지 상자 + ! ? 아이콘을 크게(최근접) 흰 바탕에
  const big = (f, ext) => sharp(f).extract(ext || { left: 0, top: 0, width: 64, height: 64 }).resize(256, 256, { kernel: 'nearest' }).png().toBuffer();
  const icons = path.join(COMMON, 'ui', 'icons.png');
  const parts = [await big(path.join(COMMON, 'ui', 'speech.png')), await big(path.join(COMMON, 'ui', 'notice.png')),
    await big(icons, { left: 384, top: 64, width: 64, height: 64 }), await big(icons, { left: 448, top: 64, width: 64, height: 64 })];
  const ui = path.join(RAW, '_ref-ui.png');
  await sharp({ create: { width: 1120, height: 300, channels: 4, background: '#ffffff' } })
    .composite(parts.map((b, i) => ({ input: b, left: 24 + i * 272, top: 22 }))).png().toFile(ui);
  r.push(ui);
  // 2) REF_A 지도 예시(캐릭터 머리 위 느낌표 말풍선) — 크기·위치 감
  const refA = path.join(COMMON, 'references', 'REF_A_character_sheet.png');
  const k = 1122 / 1200, mapRef = path.join(RAW, '_ref-map.png');
  await sharp(refA).extract({ left: Math.round(880 * k), top: Math.round(240 * k), width: Math.round(300 * k), height: Math.round(460 * k) }).png().toFile(mapRef);
  r.push(mapRef);
  // 3) 교실 배경 일부(게임 화면 색감)
  const bg = path.join(RAW, '_ref-classroom.png');
  await sharp(path.join(COMMON, 'backgrounds', 'classroom.png')).extract({ left: 300, top: 200, width: 900, height: 506 }).png().toFile(bg);
  r.push(bg);
  return r;
}

const PROMPTS = {
  // 1회차: 세 가지를 한 판에 — 목적지 핀(!), 말 걸기 말풍선(?), 같은 말풍선의 강조판
  v1: 'Image 1 shows the official UI pieces of our pixel-art school game: a cream speech-bubble panel with a dark green (#294b40) stepped pixel outline, '
    + 'and dark green pixel glyphs "!" and "?". Image 2 shows how a small "!" speech bubble floats above a character on the map. Image 3 is a game background for colour mood. '
    + 'Draw a clean GAME UI SPRITE SHEET with exactly THREE separate small map marker icons in one row, evenly spaced, each centred in its own third of the image, '
    + 'on a perfectly flat plain pure WHITE background (#ffffff) with lots of empty white space around every icon. No shadows on the background, no ground, no scenery, no text, no letters except the glyphs. '
    + 'Icon A (destination marker, "go here"): a chunky map PIN shaped like an upside-down teardrop pointing straight DOWN, honey gold (#f3cf72) fill with a lighter top-left highlight, '
    + 'dark green (#294b40) 1-pixel stepped outline, and a bold cream (#fff9e7) exclamation mark "!" inside the round head. '
    + 'Icon B (talk marker, "something is up, come talk"): a small rounded square cream (#fff9e7) speech bubble with a short pointed tail at the bottom centre, dark green (#294b40) stepped pixel outline, '
    + 'and a bold dark green question mark "?" in the middle, exactly in the style of image 1. '
    + 'Icon C: the same speech bubble as B but with a pale honey (#fbe7a6) fill and a dark green "?". '
    + 'Style: crisp 16-bit pixel art on a coarse 16x16 pixel grid per icon, every pixel a big clearly visible square block, only 4 to 6 flat colours, no gradients, no anti-aliasing, no glow, no drop shadow, calm and friendly, not flashy.',
  // 2회차: 말풍선 ?를 더 다듬기(꼬리·물음표 굵기 변화) 4가지
  v2: 'Image 1 shows the official UI pieces of our pixel-art school game: a cream speech-bubble panel with a dark green (#294b40) stepped pixel outline, and dark green pixel glyphs "!" and "?". '
    + 'Image 2 shows how a small speech bubble floats above a character on the map. Image 3 is a game background for colour mood. '
    + 'Draw a clean GAME UI SPRITE SHEET with exactly FOUR separate small speech-bubble icons in one row, evenly spaced, on a perfectly flat plain pure WHITE background (#ffffff) with lots of empty white space around each. '
    + 'Each icon: a small rounded cream (#fff9e7) speech bubble with a short tail at the bottom (centre or slightly left), dark green (#294b40) 1-pixel stepped outline, a thin pale shade line (#f2e7c7) along the inner bottom edge, '
    + 'and a bold, thick, very readable question mark "?" in the middle. Variation 1: dark green "?". Variation 2: honey gold (#c9a043) "?". Variation 3: dark green "?" with a tiny gold sparkle pixel at the top right corner of the bubble. Variation 4: three-quarter view bubble tilted slightly, dark green "?". '
    + 'Style: crisp 16-bit pixel art on a coarse 16x16 pixel grid per icon, every pixel a big clearly visible square block, 4 to 5 flat colours, no gradients, no anti-aliasing, no glow, no drop shadow. No text other than the "?" glyphs.',
  // 3회차: 목적지 표시 시안 4가지
  v3: 'Image 1 shows the official UI pieces of our pixel-art school game: a cream speech-bubble panel with a dark green (#294b40) stepped pixel outline, and dark green pixel glyphs "!" and "?". '
    + 'Image 2 shows how a small "!" marker floats above a character on the map. Image 3 is a game background for colour mood. '
    + 'Draw a clean GAME UI SPRITE SHEET with exactly FOUR separate small DESTINATION marker icons ("go here next") in one row, evenly spaced, on a perfectly flat plain pure WHITE background (#ffffff) with lots of empty white space around each. '
    + 'All use honey gold (#f3cf72) with a lighter (#fbe7a6) top-left highlight, a dark green (#294b40) 1-pixel stepped outline, and a bold cream (#fff9e7) or dark green "!" glyph. '
    + 'Variation 1: a map pin (upside-down teardrop) pointing straight down with "!" in the round head. Variation 2: a rounded square gold badge with "!" and a small downward pointing triangle below it. '
    + 'Variation 3: a shield-shaped gold tag pointing down with "!". Variation 4: a simple chunky downward arrow (chevron) in gold with a dark green outline, no glyph. '
    + 'Style: crisp 16-bit pixel art on a coarse 16x16 pixel grid per icon, every pixel a big clearly visible square block, 4 to 5 flat colours, no gradients, no anti-aliasing, no glow, no drop shadow, calm and friendly, not flashy. No text other than the "!" glyphs.'
};

async function gen(name) {
  const { upload, run, download } = await import('file:///' + (process.env.FAL_TOOLS || 'D:/Works/ethicity-games-mid-publicness/publicness/tools/fal.mjs').replace(/\\/g, '/'));
  const prompt = PROMPTS[name];
  if (!prompt) throw new Error('회차 없음: ' + name + ' (' + Object.keys(PROMPTS) + ')');
  const files = await refs();
  const urls = [];
  for (const f of files) urls.push(await upload(f));
  const n = Number(process.env.NUM || 2);
  const res = await run('fal-ai/nano-banana/edit', { prompt, image_urls: urls, num_images: n, output_format: 'png', aspect_ratio: '16:9' });
  const outs = [];
  for (let i = 0; i < (res.images || []).length; i++) {
    const f = path.join(RAW, `${name}-${i + 1}.png`);
    await download(res.images[i].url, f);
    outs.push(path.basename(f));
  }
  fs.appendFileSync(path.join(OUT, 'generation-log.jsonl'), JSON.stringify({ at: new Date().toISOString(), round: name, model: 'fal-ai/nano-banana/edit', images: outs, seconds: res._seconds, refs: files.map((f) => path.basename(f)), prompt }) + '\n');
  console.log('✓ ' + name + ': ' + outs.join(', ') + ` (${res._seconds}s)`);
}

function nearest(r, g, b) {
  let best = null, bd = 1e9;
  for (const p of PAL) { const d = (p.r - r) ** 2 + (p.g - g) ** 2 + (p.b - b) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
}

// raw의 사각형 → 흰 배경 제거(가장자리에서 이어진 밝은 칸만: 말풍선 속 크림색은 외곽선에 막혀 남는다) → 격자 → 팔레트
async function fit(rawFile, x, y, w, h, name, rows = 16) {
  const { data, info } = await sharp(rawFile).extract({ left: x, top: y, width: w, height: h }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, bg = new Uint8Array(W * H);
  const light = (i) => { const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]; return (255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2 < 30 ** 2; };
  const q = [];
  for (let i = 0; i < W; i++) { q.push(i, (H - 1) * W + i); }
  for (let j = 0; j < H; j++) { q.push(j * W, j * W + W - 1); }
  while (q.length) { const p = q.pop(); if (bg[p] || !light(p)) continue; bg[p] = 1; const px = p % W, py = (p / W) | 0; if (px > 0) q.push(p - 1); if (px < W - 1) q.push(p + 1); if (py > 0) q.push(p - W); if (py < H - 1) q.push(p + W); }
  // 그림이 차지한 범위
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (!bg[j * W + i]) { x0 = Math.min(x0, i); y0 = Math.min(y0, j); x1 = Math.max(x1, i); y1 = Math.max(y1, j); }
  const cs = (y1 - y0 + 1) / rows, cols = Math.max(1, Math.round((x1 - x0 + 1) / cs));
  const out = Buffer.alloc(cols * rows * 4);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const votes = {}; let opaque = 0, total = 0;
    const ya = Math.floor(y0 + r * cs), yb = Math.floor(y0 + (r + 1) * cs), xa = Math.floor(x0 + c * cs), xb = Math.floor(x0 + (c + 1) * cs);
    // 칸 가운데 60%만 본다(경계 번짐 무시)
    const my = Math.max(1, Math.round((yb - ya) * 0.2)), mx = Math.max(1, Math.round((xb - xa) * 0.2));
    for (let j = ya + my; j < Math.max(ya + my + 1, yb - my); j++) for (let i = xa + mx; i < Math.max(xa + mx + 1, xb - mx); i++) {
      if (i >= W || j >= H) continue;
      total++;
      const p = j * W + i;
      if (bg[p]) continue;
      opaque++;
      const n = nearest(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
      votes[n.k] = (votes[n.k] || 0) + 1;
    }
    const o = (r * cols + c) * 4;
    if (!total || opaque / total < 0.5) continue; // 반 넘게 배경이면 투명
    const k = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
    const p = PAL.find((e) => e.k === k);
    out[o] = p.r; out[o + 1] = p.g; out[o + 2] = p.b; out[o + 3] = 255;
  }
  if (process.env.SYM) tidy(out, cols, rows);
  const f = path.join(OUT, name + '.png');
  await sharp(out, { raw: { width: cols, height: rows, channels: 4 } }).png().toFile(f);
  fs.appendFileSync(path.join(OUT, 'generation-log.jsonl'), JSON.stringify({ at: new Date().toISOString(), fit: name + '.png', from: path.basename(rawFile), rect: [x, y, w, h], rows, size: cols + 'x' + rows, tidy: !!process.env.SYM }) + '\n');
  console.log(`✓ ${name}.png ${cols}×${rows} (원본 칸 ${cs.toFixed(1)}px)`);
}

// SYM=1: 생성 그림의 흔들린 윤곽 정리 — 모양(알파)은 왼쪽 반을 오른쪽에 거울로, 바깥 둘레 1칸 = 잉크 윤곽,
//   안쪽에 남은 겹 윤곽(둘레에 붙은 잉크)은 채움색으로. 가운데 글자(! ?)는 둘레에 닿지 않으므로 그대로 남는다.
function tidy(buf, cols, rows) {
  const key = (r, c) => { const o = (r * cols + c) * 4; if (!buf[o + 3]) return null; return PAL.find((p) => p.r === buf[o] && p.g === buf[o + 1] && p.b === buf[o + 2]).k; };
  const g = [], m = [];
  for (let r = 0; r < rows; r++) { g.push([]); m.push([]); for (let c = 0; c < cols; c++) g[r].push(key(r, c)); }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const lc = c <= (cols - 1) / 2 ? c : cols - 1 - c; m[r][c] = g[r][lc] != null; }
  const inM = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols && m[r][c];
  const edge = (r, c) => m[r][c] && (!inM(r - 1, c) || !inM(r + 1, c) || !inM(r, c - 1) || !inM(r, c + 1));
  const res = g.map((row) => row.slice());
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!m[r][c]) { res[r][c] = null; continue; }
    if (edge(r, c)) { res[r][c] = 'ink'; continue; }
    const nearEdge = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => edge(r + dr, c + dc));
    let k = g[r][c];
    const mir = g[r][cols - 1 - c];
    if (k == null || (k === 'ink' && nearEdge)) k = mir && mir !== 'ink' ? mir : null;
    if (k == null || (k === 'ink' && nearEdge)) {
      // 이웃 중 잉크 아닌 가장 흔한 색
      const v = {};
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const n = g[r + dr]?.[c + dc]; if (n && n !== 'ink') v[n] = (v[n] || 0) + 1; }
      k = Object.entries(v).sort((a, b) => b[1] - a[1])[0]?.[0] || 'cream';
    }
    if (k === 'goldLight' && c > cols / 2) k = 'gold'; // 밝은 면은 왼쪽 위에만
    res[r][c] = k;
  }
  // 가운데 글자(둘레가 아닌 잉크)를 가로 가운데로
  let gx0 = cols, gx1 = -1;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (res[r][c] === 'ink' && !edge(r, c)) { gx0 = Math.min(gx0, c); gx1 = Math.max(gx1, c); }
  const shift = gx1 >= 0 ? Math.round((cols - 1) / 2 - (gx0 + gx1) / 2) : 0;
  if (shift) {
    const fillAt = (r, c) => { for (let d = 1; d < cols; d++) for (const cc of [c - d, c + d]) { const k = res[r][cc]; if (k && k !== 'ink') return k; } return 'cream'; };
    const glyph = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (res[r][c] === 'ink' && !edge(r, c)) glyph.push([r, c]);
    glyph.forEach(([r, c]) => { res[r][c] = fillAt(r, c); });
    glyph.forEach(([r, c]) => { if (inM(r, c + shift) && !edge(r, c + shift)) res[r][c + shift] = 'ink'; });
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const o = (r * cols + c) * 4, k = res[r][c];
    if (!k) { buf[o] = buf[o + 1] = buf[o + 2] = buf[o + 3] = 0; continue; }
    const p = PAL.find((e) => e.k === k); buf[o] = p.r; buf[o + 1] = p.g; buf[o + 2] = p.b; buf[o + 3] = 255;
  }
}

// 확인용 판: 고른 그림을 1·2·3배로 교실·마당 그림 위에
async function sheet(names) {
  names = names.length ? names : fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, ''));
  const bgs = [path.join(COMMON, 'backgrounds', 'classroom.png'), path.join(PRIV, 'assets', 'scenes', 'yard.png')];
  const tiles = [];
  for (const bgf of bgs) {
    const base = await sharp(bgf).extract({ left: 600, top: 380, width: 200 * names.length, height: 120 }).png().toBuffer();
    const comp = [];
    for (let i = 0; i < names.length; i++) {
      const f = path.join(OUT, names[i] + '.png'), m = await sharp(f).metadata();
      [1, 2, 3].forEach((s, k) => comp.push({ input: f, left: i * 200 + 10 + [0, 30, 80][k], top: 20, scale: s, m }));
    }
    const ins = [];
    for (const c of comp) ins.push({ input: await sharp(c.input).resize(c.m.width * c.scale, c.m.height * c.scale, { kernel: 'nearest' }).png().toBuffer(), left: c.left, top: c.top });
    tiles.push(await sharp(base).composite(ins).png().toBuffer());
  }
  const W = 200 * names.length;
  const f = path.join(RAW, 'preview.png');
  const flat = await sharp({ create: { width: W, height: 240, channels: 4, background: '#000' } }).composite(tiles.map((b, i) => ({ input: b, left: 0, top: i * 120 }))).png().toBuffer();
  await sharp(flat).resize(W * 2, 480, { kernel: 'nearest' }).png().toFile(f); // sharp는 resize를 composite보다 먼저 하므로 두 번에
  console.log('✓ ' + f + ' — ' + names.join(', '));
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'gen') await gen(args[0] || 'v1');
else if (cmd === 'fit') await fit(path.resolve(args[0]), +args[1], +args[2], +args[3], +args[4], args[5], args[6] ? +args[6] : 16);
else if (cmd === 'sheet') await sheet(args);
else console.log('사용법: gen [v1|v2|v3] · fit <raw> x y w h 이름 [칸높이] · sheet [이름...]');
