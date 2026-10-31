// 이 게임 전용 그림 만들기 — fal.ai nano-banana(그림 편집)로 공통 팩 그림을 화풍 기준 삼아 생성한 뒤 공통 팩 규격으로 맞춘다.
//   node safety/tools/art.mjs [이름 ...]          생성 + 규격 맞춤(이름을 안 주면 전부)
//   node safety/tools/art.mjs --pack [이름 ...]   assets/art/raw에 올린(또는 받아 둔) 원본으로 규격 맞춤만 — 직접 그린 그림도 이걸로
// 이름: bg-lobby bg-meeting director doctor patientrep extra-1 extra-2 extra-3
// 결과(커밋): assets/art/bg-*.png(1672×941, 공통 배경과 같은 크기) · npc-<id>-stand.png(96×128, 발 48·120)
//            npc-<id>-portraits.png(1024×256, 표정 4칸 neutral·happy·worried·explaining) · art.js(게임이 불러올 목록)
// 원본(커밋 안 함): assets/art/raw/. 요금이 나간다(그림 한 장 약 0.04달러).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { upload, run, download } from './fal.mjs';
import { decode, encode, cover, keyBackground, keyChecker, keepMain, gutter, bbox, crop, resize, blank, paste } from './png.mjs';

const SF = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMMON = path.resolve(SF, '../shared/ethicity-elementary-common-v1');
const ART = path.join(SF, 'assets/art'), RAW = path.join(ART, 'raw');
fs.mkdirSync(RAW, { recursive: true });

const BG_STYLE = [
  'Use the reference image as the exact guide for art style, camera angle, framing and pixel density: a polished 16-bit pixel-art illustration of a room interior seen from a high three-quarter top-down view,',
  'back wall at the top with sage-green wainscoting, side walls angled outward, warm cream walls, dark brown outlines, soft window light, warm cozy palette (cream, sage green, honey wood, sky-blue accents).',
  'At the bottom edge there is a low sage-green front wall with a central entrance gap, exactly like the reference.',
  'Keep the large central floor area empty so characters can walk there.',
  'No people, no characters, no animals, no text, no letters, no numbers, no logos. Not photorealistic, not 3D.'
].join('\n');
const SPRITE_STYLE = 'Use the reference image ONLY as the art style guide: the same polished 16-bit pixel art with clearly stepped pixel edges, dark brown outlines, warm colors, and the same chibi proportions as the adult characters (large head, compact body).';
const MAGENTA = 'Plain flat solid pure magenta (#FF00FF) background filling the whole image. No shadow, no ground, no frame, no text, no letters.';

const ITEMS = {
  'bg-lobby': { kind: 'bg', ref: 'backgrounds/classroom.png', what: 'a friendly community hospital outpatient lobby and waiting area: a long wooden reception counter with two small computer monitors against the back wall on the left side; a closed wooden double door in the exact center of the back wall; a large blank dark-blue wall-mounted status display screen on the back wall on the right side (the screen is blank); two short rows of mint-green waiting benches on the lower left and two short rows on the lower right, leaving a wide empty aisle in the middle; wide open doorways in the middle of the left side wall and the right side wall; a few potted plants; a simple red cross pictogram above the reception counter (no letters); light beige tiled floor.' },
  'bg-meeting': { kind: 'bg', ref: 'backgrounds/library.png', what: 'a hospital committee meeting room: a large oval wooden conference table in the middle of the room with sage-green chairs around it; a big blank wall-mounted presentation screen in the center of the back wall (the screen is blank); bookshelves and a cork notice board on the back wall; potted plants in the corners; large windows on the side walls; warm wooden floor; leave open floor between the table and the bottom entrance.' },
  director: { kind: 'npc', who: 'a hospital operations director in their 50s: short neat dark hair with gray streaks, rectangular glasses, navy blazer over a light blue shirt, a lanyard with an ID card, holding a tablet, gray trousers, brown shoes' },
  doctor: { kind: 'npc', who: 'a doctor in their 40s: dark brown hair tied back in a low bun, white doctor\'s coat over a sage-green top, a stethoscope around the neck, holding a clipboard, dark trousers, white shoes' },
  patientrep: { kind: 'npc', who: 'a patient representative in their 60s: short curly gray hair, kind smile lines, a mustard-yellow cardigan over a cream shirt, brown trousers, holding a small notebook, a cloth tote bag on the shoulder' },
  'extra-1': { kind: 'extra', who: 'an elderly patient in their 80s leaning on a wooden cane, beige padded jacket, flat cap, gray trousers' },
  'extra-2': { kind: 'extra', who: 'a young adult patient holding a cold pack to the forehead, gray hoodie, jeans, sneakers' },
  'extra-3': { kind: 'extra', who: 'a parent in their 30s in a teal coat holding a small paper number ticket, black trousers' }
};

async function edit(prompt, refs, out, extra = {}) {
  const urls = [];
  for (const r of refs) urls.push(await upload(r));
  let res;
  try { res = await run('fal-ai/nano-banana/edit', Object.assign({ prompt, image_urls: urls, num_images: 1, output_format: 'png' }, extra)); }
  catch (e) { if (!Object.keys(extra).length) throw e; res = await run('fal-ai/nano-banana/edit', { prompt, image_urls: urls, num_images: 1, output_format: 'png' }); }
  if (!res.images?.[0]?.url) throw new Error('그림 없음 ' + JSON.stringify(res).slice(0, 200));
  await download(res.images[0].url, out);
  return res._seconds;
}

async function generate(name) {
  const it = ITEMS[name];
  if (it.kind === 'bg') {
    const s = await edit(BG_STYLE + '\nCreate a NEW room: ' + it.what, [path.join(COMMON, it.ref)], path.join(RAW, name + '.png'), { aspect_ratio: '16:9' });
    return `배경 ${s}초`;
  }
  const stand = path.join(RAW, name + '-stand.png');
  const s1 = await edit([SPRITE_STYLE, 'Create ONE full-body pixel-art sprite of a NEW adult character: ' + it.who + '.',
    'Standing still and facing the viewer (front view), arms relaxed, feet together, the whole body visible and centered with generous margin.', MAGENTA].join('\n'),
  [path.join(COMMON, 'characters/teacher-source.png')], stand);
  if (it.kind !== 'npc') return `서 있는 모습 ${s1}초`;
  const s2 = await edit(['Image 1 shows the dialogue-portrait format and the pixel-art style. Image 2 shows the character to draw.',
    'Draw FOUR head-and-shoulders dialogue portraits of the character in image 2, in the exact pixel-art style of image 1, arranged in a 2 by 2 grid with equal cells and wide gaps between them:',
    'top-left calm neutral face, top-right cheerful smile, bottom-left worried eyebrows, bottom-right explaining with mouth slightly open and one hand raised.',
    'Same face, hair, glasses and outfit in all four, each cut at the chest, facing slightly toward the viewer.', MAGENTA].join('\n'),
  [path.join(COMMON, 'characters/teacher-portraits.png'), stand], path.join(RAW, name + '-portraits.png'));
  return `서 있는 모습 ${s1}초 · 표정 ${s2}초`;
}

// ── 규격 맞춤 ──
// 배경 지우기: 체크무늬가 칠해진 원본이면 체크무늬를, 아니면 모서리 색을 지운다
const unbg = (img) => keyChecker(img) || keyBackground(img, 90);
function packBg(name) {
  const img = cover(decode(fs.readFileSync(path.join(RAW, name + '.png'))), 1672, 941);
  fs.writeFileSync(path.join(ART, name + '.png'), encode(img));
}
// 서 있는 모습: 배경 제거 → 몸만 잘라 → 키 110px(공통 팩 성인과 같음)로 줄여 96×128 칸, 발 y=119
function packStand(name) {
  const img = keepMain(unbg(decode(fs.readFileSync(path.join(RAW, name + '-stand.png')))));
  const b = bbox(img); if (!b) throw new Error(name + ': 인물을 찾지 못함');
  const k = Math.min(110 / b.h, 90 / b.w), w = Math.max(1, Math.round(b.w * k)), h = Math.max(1, Math.round(b.h * k));
  const small = resize(crop(img, b.x, b.y, b.w, b.h), w, h, 128);
  const cell = paste(blank(96, 128), small, Math.round(48 - w / 2), 120 - h);
  fs.writeFileSync(path.join(ART, `npc-${name}-stand.png`), encode(cell));
}
// 표정 4칸: <이름>-neutral/happy/worried/explaining.png 네 장, 또는 <이름>-portraits.png 한 장(2×2 격자: 좌상 기본·우상 기쁨·좌하 걱정·우하 설명)
// 격자는 가운데 근처의 빈 줄에서 나눈다(칸 크기가 고르지 않은 원본 대비)
// 각 얼굴을 256×256에 아래 맞춤
const EXPRS = ['neutral', 'happy', 'worried', 'explaining'];
function packPortraits(name) {
  const sheet = blank(1024, 256);
  const files = EXPRS.map((e) => path.join(RAW, `${name}-${e}.png`));
  let quads;
  if (files.every((f) => fs.existsSync(f))) quads = files.map((f) => unbg(decode(fs.readFileSync(f))));
  else {
    const img = unbg(decode(fs.readFileSync(path.join(RAW, name + '-portraits.png'))));
    const gx = gutter(img, 'x', Math.round(img.width * 0.3), Math.round(img.width * 0.7));
    const gy = gutter(img, 'y', Math.round(img.height * 0.3), Math.round(img.height * 0.7));
    quads = [[0, 0, gx, gy], [gx, 0, img.width - gx, gy], [0, gy, gx, img.height - gy], [gx, gy, img.width - gx, img.height - gy]].map(([x, y, w, h]) => crop(img, x, y, w, h));
  }
  quads.forEach((q, i) => {
    keepMain(q);
    const b = bbox(q); if (!b) throw new Error(name + ': ' + EXPRS[i] + ' 표정이 비어 있음');
    const k = Math.min(236 / b.w, 240 / b.h), w = Math.round(b.w * k), h = Math.round(b.h * k);
    paste(sheet, resize(crop(q, b.x, b.y, b.w, b.h), w, h, 128), i * 256 + Math.round(128 - w / 2), 248 - h);
  });
  fs.writeFileSync(path.join(ART, `npc-${name}-portraits.png`), encode(sheet));
}
function pack(name) {
  const it = ITEMS[name];
  if (it.kind === 'bg') packBg(name);
  else {
    packStand(name);
    const hasFaces = fs.existsSync(path.join(RAW, name + '-portraits.png')) || EXPRS.every((e) => fs.existsSync(path.join(RAW, `${name}-${e}.png`)));
    if (it.kind === 'npc' && hasFaces) packPortraits(name);
    else if (it.kind === 'npc') console.log(name, ': 표정 그림이 없어 서 있는 모습만 맞춤(대화창은 임시 얼굴)');
  }
}
function writeList() {
  const keys = fs.readdirSync(ART).filter((f) => /\.png$/.test(f)).map((f) => f.replace(/\.png$/, '')).sort();
  const list = Object.fromEntries(keys.map((k) => [k, true]));
  fs.writeFileSync(path.join(ART, 'art.js'), '// 이 게임 전용 그림 목록 — tools/art.mjs가 그림을 만들 때마다 다시 쓴다. 없는 그림은 임시 도형으로 그린다.\nwindow.SAFETY_ART = ' + JSON.stringify(list, null, 2) + ';\n');
  return keys;
}

const args = process.argv.slice(2), packOnly = args[0] === '--pack';
const names = (packOnly ? args.slice(1) : args);
const todo = names.length ? names : Object.keys(ITEMS);
for (const n of todo) if (!ITEMS[n]) throw new Error('모르는 이름: ' + n);
for (const n of todo) {
  try {
    const msg = packOnly ? '' : await generate(n);
    pack(n);
    console.log(n, '완료', msg);
  } catch (e) { console.error(n, '실패:', e.message); process.exitCode = 1; }
}
console.log('art.js:', writeList().join(', '));
