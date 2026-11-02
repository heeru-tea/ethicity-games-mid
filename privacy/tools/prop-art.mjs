// 마당·마을에 합성할 작은 그림(매점 건물·토끼·다람쥐·새·고양이) — fal.ai nano-banana/edit
//   node privacy/tools/prop-art.mjs gen critters|store   그림 생성(요금 나감) → assets/scenes/<id>.raw.png(gitignore, 로컬 기록)
//   node privacy/tools/prop-art.mjs cut                  raw → 마젠타 배경 지우기·잘라내기 → assets/props/*.png(투명)
//   참조 = 공통 팩 courtyard.png(카메라·화풍) + props.png(소품 화풍). 키·호출은 publicness 도구(fal.mjs, 키 커밋 금지).
//   합성은 tools/yard-compose.mjs(마당)·tools/village-compose.mjs(마을)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sharp = (await import('file:///D:/Works/sih26/node_modules/sharp/lib/index.js')).default;
const PRIV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BG = path.join(PRIV, '..', 'shared', 'ethicity-elementary-common-v1', 'backgrounds');
const RAW = process.env.RAW_DIR || path.join(PRIV, 'assets', 'scenes'); // RAW_DIR·OUT_DIR = 시험용 바꿔치기
const OUT = process.env.OUT_DIR || path.join(PRIV, 'assets', 'props');

const STYLE = 'Use exactly the pixel art style of image 1: chunky clearly visible pixels, dark brown outlines, the same warm muted palette, soft cel shading, flat even daylight. '
  + 'The background must be one flat solid pure magenta color (#FF00FF) everywhere, with no ground, no grass, no cast shadow and no gradient. '
  + 'No text, letters, numbers, logos or watermark anywhere.';

const JOBS = {
  // 귀여운 동물 4마리(한 장에 따로따로) — 왼쪽부터 토끼·다람쥐·새·고양이
  critters: {
    refs: [path.join(BG, 'courtyard.png'), path.join(BG, 'props.png')],
    aspect: '16:9',
    prompt: 'Image 1 is the official art of our game. Draw a sprite sheet of FOUR small cute animals standing in one row from left to right, '
      + 'each one fully separate with lots of empty space between them: '
      + '(1) a small white rabbit sitting, with pink inner ears; (2) a small brown squirrel with a big fluffy tail holding an acorn; '
      + '(3) a small round sparrow bird with a brown back and cream belly standing on the ground; (4) an orange tabby cat curled up sleeping. '
      + 'Seen from the same high three-quarter top-down camera as image 1. Chibi cute proportions, big simple shapes, readable at a tiny size. ' + STYLE
  },
  // 학교 매점: courtyard의 학교·도서관 건물처럼 정면 3/4 시점(앞면이 화면을 똑바로 봄), 테라코타 지붕
  store: {
    refs: [path.join(BG, 'courtyard.png'), path.join(BG, 'props.png')],
    aspect: '1:1',
    prompt: 'Image 1 is the official art of our game. Draw ONE small single-storey school snack kiosk building, as a standalone sprite. '
      + 'Camera: exactly like the school building and the library building in image 1 — the front wall faces the viewer straight on (frontal view, NOT rotated, NOT isometric, no corner pointing at the viewer), '
      + 'the roof is seen slightly from above. A terracotta red tiled gable roof like the library in image 1, cream plaster walls with wooden trim and a low stone base like the buildings in image 1. '
      + 'In the middle of the front wall a wide open serving window with a wooden counter and a small green and cream striped awning; '
      + 'inside the window shelves of colorful snack bags, small milk cartons and drink bottles; a small white ice cream freezer chest stands in front beside the counter. '
      + 'The whole building is visible including its bottom edge where it meets the ground (draw the bottom edge, do not crop it). ' + STYLE
  }
};

async function gen(id) {
  const FAL = process.env.FAL_TOOLS || 'D:/Works/ethicity-games-mid-publicness/publicness/tools/fal.mjs';
  const { upload, run, download } = await import('file:///' + FAL.replace(/\\/g, '/'));
  const job = JOBS[id];
  const urls = [];
  for (const r of job.refs) urls.push(await upload(r));
  const res = await run('fal-ai/nano-banana/edit', { prompt: job.prompt, image_urls: urls, num_images: 1, output_format: 'png', aspect_ratio: job.aspect });
  const url = res.images?.[0]?.url;
  if (!url) throw new Error('결과 없음 ' + JSON.stringify(res).slice(0, 200));
  const raw = path.join(RAW, id + '.raw.png');
  await download(url, raw);
  fs.appendFileSync(path.join(RAW, 'generation-log.jsonl'), JSON.stringify({ at: new Date().toISOString(), id, model: 'fal-ai/nano-banana/edit', prompt: job.prompt }) + '\n');
  console.log(`✓ ${id} → ${path.relative(PRIV, raw)} (${res._seconds}s)`);
}

// 마젠타 배경 지우기: 가장자리에서 마젠타에 가까운 칸을 번져 나가며 투명으로(안쪽 분홍은 남김) + 가장자리 마젠타 번짐 빼기
async function key(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  // 배경색 = 네 모서리 평균(생성 그림의 마젠타는 #FF00FF가 아니라 진분홍~자주로 흔들림) → 그 색과 가까우면 배경
  const cs = [0, w - 1, (h - 1) * w, h * w - 1].map((p) => [data[p * 4], data[p * 4 + 1], data[p * 4 + 2]]);
  const bg = [0, 1, 2].map((k) => cs.reduce((t, c) => t + c[k], 0) / 4);
  const dist = (i) => Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
  const isBg = (i) => dist(i) < 70;
  const seen = new Uint8Array(w * h), q = [];
  for (let x = 0; x < w; x++) { q.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { q.push(y * w, y * w + w - 1); }
  while (q.length) {
    const p = q.pop();
    if (seen[p] || !isBg(p * 4)) continue;
    seen[p] = 1; data[p * 4 + 3] = 0;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) q.push(p - 1); if (x < w - 1) q.push(p + 1); if (y > 0) q.push(p - w); if (y < h - 1) q.push(p + w);
  }
  // 남은 섬(그림 안쪽에 갇힌 배경 조각)도 마젠타가 뚜렷하면 지움, 경계의 분홍 번짐은 초록을 올려 중화
  for (let p = 0; p < w * h; p++) {
    const i = p * 4; if (!data[i + 3]) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (dist(i) < 45) { data[i + 3] = 0; continue; } // 그림 안쪽에 갇힌 배경 조각
    if (r > 120 && b > 120 && g < Math.min(r, b) - 50) data[i + 1] = Math.min(255, Math.round((r + b) / 2 - 20)); // 번짐 중화
  }
  return { data, w, h };
}

// 투명 아닌 덩어리(연결 요소)를 찾아 큰 것부터 — 동물 시트를 한 마리씩 나눈다
function blobs({ data, w, h }, minArea) {
  const lab = new Int32Array(w * h).fill(-1), out = [];
  for (let s = 0; s < w * h; s++) {
    if (lab[s] >= 0 || data[s * 4 + 3] < 128) continue;
    const id = out.length, st = [s]; let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    lab[s] = id;
    while (st.length) {
      const p = st.pop(); n++;
      const x = p % w, y = (p / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { // 2px 틈은 같은 덩어리(수염·꼬리 끝)
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx; if (lab[q] < 0 && data[q * 4 + 3] >= 128) { lab[q] = id; st.push(q); }
      }
    }
    out.push({ n, x0, y0, x1, y1 });
  }
  return out.filter((b) => b.n >= minArea);
}

async function save(k, b, name) {
  const pad = 2, l = Math.max(0, b.x0 - pad), t = Math.max(0, b.y0 - pad);
  const wd = Math.min(k.w - l, b.x1 - b.x0 + 1 + pad * 2), ht = Math.min(k.h - t, b.y1 - b.y0 + 1 + pad * 2);
  await sharp(Buffer.from(k.data), { raw: { width: k.w, height: k.h, channels: 4 } }).extract({ left: l, top: t, width: wd, height: ht }).png().toFile(path.join(OUT, name + '.png'));
  console.log(`✓ assets/props/${name}.png ${wd}×${ht}`);
}

async function cut() {
  fs.mkdirSync(OUT, { recursive: true });
  const st = path.join(RAW, 'store.raw.png');
  if (fs.existsSync(st)) { const k = await key(st); const b = blobs(k, 2000).sort((a, c) => c.n - a.n)[0]; await save(k, b, 'store'); }
  const cr = path.join(RAW, 'critters.raw.png');
  if (fs.existsSync(cr)) {
    const k = await key(cr);
    const bs = blobs(k, 1500).sort((a, c) => c.n - a.n).slice(0, 4).sort((a, c) => a.x0 - c.x0);
    const names = ['rabbit', 'squirrel', 'bird', 'cat'];
    for (let i = 0; i < bs.length; i++) await save(k, bs[i], names[i]);
  }
}

const [cmd, ...ids] = process.argv.slice(2);
if (cmd === 'gen') for (const id of ids) { try { await gen(id); } catch (e) { console.log(`✗ ${id}: ${e.message.slice(0, 200)}`); } }
else if (cmd === 'cut') await cut();
else console.log('사용법: node privacy/tools/prop-art.mjs gen critters|store  /  cut');
