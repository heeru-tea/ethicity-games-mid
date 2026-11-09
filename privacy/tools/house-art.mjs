// 우리 집 바깥(거실·식탁·복도·현관) 그림 = SCENES.room.bgOuter. 내 방 그림(room.png)은 게임이 그 위 ROOM_BG 자리에 덧그린다.
//   node privacy/tools/house-art.mjs guide        → assets/scenes/house-guide.png (배치 밑그림: 벽·가구 색 블록 + 내 방 그림)
//   node privacy/tools/house-art.mjs gen [n]      → fal nano-banana/edit 시안 n장(기본 2) assets/scenes/house-cand-<k>.png (원본 .raw.png)
//   node privacy/tools/house-art.mjs pick <k>     → house-cand-<k>.png 를 assets/scenes/house.png 로(그다음 to-webp)
// 밑그림의 칸(32×18)은 world.js SCENES room의 rects와 같은 자리여야 한다 — 가구를 옮기면 HOUSE 표와 world.js를 같이 고칠 것.
// 키·호출은 publicness 도구(fal.mjs, 키 = publicness/.env — 커밋 금지). 생성 기록 = assets/scenes/generation-log.jsonl
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sharp = (await import('file:///D:/Works/sih26/node_modules/sharp/lib/index.js')).default;
const PRIV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(PRIV, 'assets', 'scenes');
const W = 1672, H = 941, CW = W / 32, CH = H / 18;
const ROOM_BG = { x: 1, y: 2, w: 17.6, h: 9.9 }; // world.js ROOM_BG와 같게

// 밑그림 블록 [x, y, w, h(칸), 색]. 그리는 순서 = 아래부터.
const C = { wallTop: '#6E5A45', wallFace: '#F3E6CB', trim: '#7C9270', floor: '#D8A56A', tile: '#B9B4AA', rug: '#E9DCC0',
  sofa: '#7FA08A', wood: '#A8743F', fridge: '#F4F4EE', cabinet: '#7A5634', box: '#C9A06A', plant: '#4F8A4A', mat: '#C8B48C', door: '#8C6A48' };
const HOUSE = [
  [0, 0, 32, 18, C.floor],
  [20, 2, 11, 2.3, C.wallFace], [20, 4.3, 11, 0.7, C.trim],        // 거실 뒷벽(내 방처럼 크림 벽 + 초록 징두리)
  [20.5, 7.4, 3.2, 2.2, C.rug], [21, 8, 2, 1, C.wood],              // 러그 + 낮은 탁자
  [20.2, 4.6, 3.6, 2.2, C.sofa],                                     // 소파(뒷벽에 붙어 정면)
  [25, 5, 4, 0.9, C.wood], [25.2, 6, 3.6, 2, C.wood], [25, 8.1, 4, 0.9, C.wood], // 의자 2 + 식탁 + 의자 2
  [29.9, 2.6, 1.1, 4.2, C.fridge],                                   // 냉장고(오른쪽 구석)
  [30, 9.6, 1, 1.4, C.plant],                                        // 화분
  [1, 12.6, 1, 1.4, C.plant], [2.2, 13, 2.6, 1, C.cabinet],          // 복도 왼쪽 끝: 화분 + 낮은 수납장
  [23, 15.6, 6, 1.4, C.tile],                                        // 현관 타일(한 단 낮은 바닥)
  [29, 13.2, 2, 3.8, C.cabinet],                                     // 신발장
  [28.1, 16, 0.85, 0.9, C.box],                                      // 택배 상자
  [24, 17, 4, 1, C.mat],                                             // 현관문 매트(나가는 곳)
  // 벽(위에서 본 벽 윗면)
  [0, 0, 32, 2, C.wallTop], [0, 0, 1, 18, C.wallTop], [31, 0, 1, 18, C.wallTop],
  [18, 2, 2, 11, C.wallTop], [0, 12, 10, 1, C.wallTop], [11, 12, 9, 1, C.wallTop],
  [0, 17, 24, 1, C.wallTop], [28, 17, 4, 1, C.wallTop],
  [10, 12, 1, 1, C.door]                                             // 내 방 문
];

async function guide() {
  const rects = HOUSE.map(([x, y, w, h, c]) => `<rect x="${(x * CW).toFixed(1)}" y="${(y * CH).toFixed(1)}" width="${(w * CW).toFixed(1)}" height="${(h * CH).toFixed(1)}" fill="${c}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${rects}</svg>`;
  const room = await sharp(path.join(OUT, 'room.png')).resize(Math.round(ROOM_BG.w * CW), Math.round(ROOM_BG.h * CH)).png().toBuffer();
  const file = path.join(OUT, 'house-guide.png');
  await sharp(Buffer.from(svg)).composite([{ input: room, left: Math.round(ROOM_BG.x * CW), top: Math.round(ROOM_BG.y * CH) }]).png().toFile(file);
  console.log('✓ ' + file);
}

const STYLE = 'Polished 16-bit pixel art with chunky clearly visible pixels and dark brown outlines, the same warm muted palette, '
  + 'soft cel shading, flat even daylight with no dramatic shadows. No text, letters, numbers or watermark anywhere.';
const PROMPT = 'Image 1 is a rough flat color-block LAYOUT of the inside of a small family apartment, seen with exactly the same camera as image 2 '
  + '(high three-quarter view: back walls at the top, floors seen from above, the thick dark brown bands are the tops of walls). '
  + 'Image 2 is the finished bedroom of our game. Repaint image 1 into one finished game background in exactly the pixel art style of image 2. '
  + 'KEEP THE LAYOUT OF IMAGE 1 EXACTLY: same framing, same size, every wall band, opening and furniture block stays at the same position and size. Do not add walls or furniture where image 1 has plain floor. '
  + 'The upper-left part is the bedroom of image 2: keep it as it is. '
  + 'The right part is the living room and dining area: the cream back wall with green wainscoting has a window with curtains, a few family photo frames and a round wall clock; '
  + 'the sage green block is a three-seat fabric sofa with cushions standing against the back wall and facing the viewer; the small brown block on the beige rug is a low wooden coffee table with a TV remote; '
  + 'the large brown block with four smaller blocks is a wooden dining table with four chairs, on the table a few side dishes covered with plastic wrap and a rice bowl; '
  + 'the tall white block in the upper right corner is a refrigerator with a few magnets and a small memo note; the green block on the right is a potted plant. '
  + 'The long wooden strip along the bottom is a hallway. At its left end: a potted plant and a low wooden cabinet. '
  + 'The bottom right is the entrance: the grey block is a lowered tiled floor with a few pairs of sneakers and shoes on it, the tall dark brown block against the right wall is a shoe cabinet, '
  + 'the small tan block is a cardboard delivery box with a white shipping label (no readable text), and the light block at the very bottom edge is the doormat at the front door. '
  + 'The small brown square in the wall band below the bedroom is the open bedroom door. '
  + 'The home feels lived-in and quiet, like a kid comes home before the parents. Keep all plain floor areas clear and open for walking. ' + STYLE;

// 1차(nano-banana, 밑그림+room.png 두 장)는 배치를 무시하고 아이소메트릭 모형집을 새로 그렸다(house-cand-1.raw.png) →
// 밑그림 한 장만 주고 '색 블록만 칠하기'로 편집시킨다(PROMPT_EDIT).
const BLOCKS = 'The cream area with green wainscoting at the top right is the living room back wall: add a window with curtains, two small family photo frames and a round wall clock on it. '
  + 'Sage green block = a three-seat fabric sofa with cushions against that back wall, facing the viewer. Beige block with a small brown block = a rug with a low wooden coffee table and a TV remote. '
  + 'Big brown block with two thin brown bars above and below = a wooden dining table with two chairs on each side, on the table side dishes covered with plastic wrap and a rice bowl. '
  + 'Tall white block in the top right corner = a refrigerator with magnets and a small memo. Green squares = potted plants. Small dark brown block at the left of the bottom hallway = a low wooden cabinet. '
  + 'Grey block at the bottom right = lowered grey tiled entrance floor with a few pairs of sneakers. Tall dark brown block against the right wall = a shoe cabinet. Small tan block = a cardboard delivery box with a white shipping label (no readable text). '
  + 'Light block in the bottom wall band = the doormat at the front door. Small brown square in the wall band below the bedroom = the open bedroom door. '
  + 'Plain orange-tan areas = wooden plank floor exactly like the bedroom floor, left empty for walking. Thick flat dark brown bands = tops of walls, keep them as plain dark wall tops.';
const PROMPT_EDIT = 'Edit this image. It is a map of a small family home for a top-down pixel art game. The bedroom in the upper left is finished pixel art. '
  + 'Everything else is still flat placeholder color blocks. Repaint ONLY the flat placeholder blocks into finished pixel art in exactly the same style, palette, straight camera and scale as the bedroom. '
  + 'The composition must stay exactly the same: do not move, resize, rotate, crop, zoom or re-frame anything, keep the straight front-facing camera (NOT isometric), and keep the bedroom unchanged. '
  + 'Every block keeps its exact position and size. ' + BLOCKS + ' The home feels lived-in and quiet. ' + STYLE;

const MODELS = {
  nb: { id: 'fal-ai/nano-banana/edit', input: (u, p) => ({ prompt: p, image_urls: u, num_images: 1, output_format: 'png', aspect_ratio: '16:9' }) },
  nbpro: { id: 'fal-ai/nano-banana-pro/edit', input: (u, p) => ({ prompt: p, image_urls: u, num_images: 1, output_format: 'png', aspect_ratio: '16:9' }) },
  kontext: { id: 'fal-ai/flux-pro/kontext', input: (u, p) => ({ prompt: p, image_url: u[0], num_images: 1, output_format: 'png', aspect_ratio: '16:9' }) }
};

// gen <n> [모델 nb|nbpro|kontext] — 기본 nbpro, 밑그림 한 장 + PROMPT_EDIT. LEGACY=1이면 1차 방식(nb, 두 장, PROMPT)
async function gen(n, model) {
  const FAL = process.env.FAL_TOOLS || 'D:/Works/ethicity-games-mid-publicness/publicness/tools/fal.mjs';
  const { upload, run, download } = await import('file:///' + FAL.replace(/\\/g, '/'));
  const legacy = process.env.LEGACY === '1', M = MODELS[legacy ? 'nb' : (model || 'nbpro')];
  const refs = legacy ? ['house-guide.png', 'room.png'] : ['house-guide.png'], prompt = legacy ? PROMPT : PROMPT_EDIT;
  const urls = [];
  for (const r of refs) urls.push(await upload(path.join(OUT, r)));
  const tag = legacy ? 'nb2' : (model || 'nbpro');
  for (let k = 1; k <= n; k++) {
    const t0 = Date.now(), id = `house-cand-${tag}-${k}`;
    try {
      const res = await run(M.id, M.input(urls, prompt));
      const url = res.images?.[0]?.url;
      if (!url) throw new Error('결과 없음 ' + JSON.stringify(res).slice(0, 200));
      const raw = path.join(OUT, id + '.raw.png');
      await download(url, raw);
      const m = await sharp(raw).metadata();
      await sharp(raw).resize(W, H, { fit: 'fill', kernel: 'nearest' }).png().toFile(path.join(OUT, id + '.png'));
      fs.appendFileSync(path.join(OUT, 'generation-log.jsonl'), JSON.stringify({ at: new Date().toISOString(), id, model: M.id, raw: m.width + 'x' + m.height, refs, prompt }) + '\n');
      console.log(`✓ ${id} (생성 ${m.width}×${m.height} → ${W}×${H}, ${Math.round((Date.now() - t0) / 1000)}s)`);
    } catch (e) { console.log(`✗ ${id}: ${String(e.message || e).slice(0, 300)}`); }
  }
}

// fix <후보> → house.png: 고른 시안(nbpro-1)의 작은 흠만 손본다(픽셀 좌표 = 1672×941 기준).
//   ① 복도 아래 없던 벽 토막(972~1045, 812~894) → 150px 왼쪽 마룻바닥을 복사해 메움(판자가 가로라 줄이 이어진다)
//   ② 내 방 문 구멍 445~575(2.5칸) → 왼쪽 445~470을 벽으로 → 470~575 = 칸 9~10(world.js 방문 두 칸)
async function fix(name) {
  const src = path.join(OUT, `house-cand-${name}.png`);
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, ch = info.channels, at = (x, y) => (y * w + x) * ch;
  const copy = (x0, y0, x1, y1, dx) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) for (let c = 0; c < ch; c++) data[at(x, y) + c] = data[at(x + dx, y) + c]; };
  copy(968, 806, 1049, 894, -150);
  const wall = at(300, 656); // 같은 벽 띠의 색
  for (let y = 629; y < 683; y++) for (let x = 443; x < Math.round(9 * CW); x++) for (let c = 0; c < ch; c++) data[at(x, y) + c] = data[wall + c];
  await sharp(data, { raw: { width: w, height: info.height, channels: ch } }).png().toFile(path.join(OUT, 'house.png'));
  console.log('✓ house.png ← house-cand-' + name + ' (벽 토막 지움 · 방문 두 칸)');
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'fix') await fix(arg || 'nbpro-1');
else if (cmd === 'guide') await guide();
else if (cmd === 'gen') await gen(Number(arg) || 2, process.argv[4]);
else if (cmd === 'pick') { fs.copyFileSync(path.join(OUT, `house-cand-${arg}.png`), path.join(OUT, 'house.png')); console.log('✓ house.png ← house-cand-' + arg); }
else console.log('사용법: guide | gen [n] [nb|nbpro|kontext] | pick <후보 이름 뒤쪽, 예: nbpro-1>');
