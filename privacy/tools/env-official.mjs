// 「공유한 순간」 맵 그림을 윤리시티 공통 팩 화풍으로 다시 그린다(fal.ai nano-banana/edit, 요금 발생).
//   node privacy/tools/env-official.mjs [경로 …]   (privacy/assets 기준, .png 생략. 없으면 전부)
// - 그림 기준 = 공통 팩 공식 자료만(공식 배경 + 공식 소품 시트). 옛 그림은 넘기지 않는다(넘기면 모델이 옛 그림을 그대로 베낌 — 2026-10-31 시험).
//   무엇을 그릴지는 DESC의 글로만. 짝 그림(골대 방향·문 열림)은 먼저 만든 기본 그림을 세 번째 기준으로 넘겨 같은 물건으로 맞춘다.
// - 결과는 privacy/assets-official/<같은 경로>.png, 원래 그림과 **같은 픽셀 크기**.
//   투명 그림: 흰 배경으로 뽑아 흰색 거리로 키잉 → 여백을 잘라 **옛 그림이 차지하던 상자(알파 경계)에 맞춰 아래 가운데 정렬**(맵 칸·충돌 좌표 그대로).
//   바닥 타일: 이음매 없는 정사각으로 뽑아 원래 크기로 늘림(픽셀 그대로, nearest).
// - 키: D:/Works/ethicity-games-mid-publicness/publicness/.env 의 FAL_KEY(커밋 금지). 생성 기록은 assets-official/generation-log.jsonl.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('D:/Works/sih26/node_modules/sharp');
const fal = await import(pathToFileURL('D:/Works/ethicity-games-mid-publicness/publicness/tools/fal.mjs').href);

const PRIV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHARED = path.resolve(PRIV, '../shared/ethicity-elementary-common-v1/backgrounds');
const OUT = path.join(PRIV, 'assets-official');
const ENDPOINT = 'fal-ai/nano-banana/edit';

// tile = 이음매 없는 바닥 질감. from = 이 그림을 기준으로 바꾼 짝 그림(같은 물건)
const DESC = {
  'terrain/grass': { tile: true, d: 'lush medium green lawn grass ground' },
  'terrain/grass-soft': { tile: true, d: 'softer, slightly darker green lawn grass ground' },
  'terrain/path': { tile: true, d: 'warm sandy yellow packed dirt path ground' },
  'terrain/path-soft': { tile: true, d: 'pale beige ground texture, lighter than a dirt path, very fine grain' },
  'schoolyard/soil': { tile: true, d: 'light brown packed dirt ground with a few tiny pebbles, organic and irregular, NOT tiles, NOT a grid, NOT a checker pattern' },
  'schoolyard/track': { tile: true, d: 'plain reddish brown ground texture, fine speckles' },
  'school/wood': { tile: true, d: 'light beige wooden classroom floor planks running horizontally' },
  'schoolyard/booth-photo': { d: 'school festival photo booth stall with a green-and-cream striped awning, wooden counter with a small camera and picture frames, small bunting flags' },
  'schoolyard/booth-snack': { d: 'school festival snack stall with a red-and-white striped canopy roof, a cotton candy machine and pastel cotton candy on a wooden counter, bunting flags' },
  'schoolyard/goal': { d: 'white soccer goal with net, seen from the front and slightly above' },
  'schoolyard/goal-back': { from: 'schoolyard/goal', d: 'the SAME soccer goal as image 3, now seen from directly behind' },
  'schoolyard/goal-left': { from: 'schoolyard/goal', d: 'the SAME soccer goal as image 3, now seen diagonally from its left side' },
  'schoolyard/goal-right': { from: 'schoolyard/goal', d: 'the SAME soccer goal as image 3, now seen diagonally from its right side' },
  'schoolyard/store': { d: 'small school snack kiosk building with a green tiled roof, open front with shelves of snacks and drinks, wooden walls' },
  'school/desk-rear': { d: 'student wooden desk with metal legs and a sage green plastic chair tucked in, seen from the back and slightly above, a blue notebook on the desk' },
  'school/exterior': { d: 'a long low two-floor building seen from the front, dark blue roof, cream walls, a row of square windows on each floor, double glass doors in the middle, a few round bushes; whole building visible with white margin' },
  'school/locker': { d: 'tall sage green metal school lockers, two columns and two rows of doors, front view' },
  'school/teacher-desk': { d: "long wooden teacher's desk with a cream front panel, a sage green chair behind it, a few books on top, front view" },
  'school/window': { d: 'wide wooden-framed classroom window with four panes showing blue sky and green trees outside, front view' },
  'school-entry/door-classroom-closed': { d: 'closed wooden sliding door of a school room in a cream wooden frame, upper glass pane and sage green lower panel, front view' },
  'school-entry/door-classroom-open': { from: 'school-entry/door-classroom-closed', d: 'ONLY the empty door frame of image 3 (same frame, same size): no door leaf at all, the opening inside the frame is plain white #FFFFFF' },
  'school-entry/door-library-closed': { d: 'library entrance between cream pillars with a green trim, closed wooden door with a glass panel showing bookshelves inside, front view' },
  'school-entry/door-library-open': { from: 'school-entry/door-library-closed', d: 'the SAME library entrance as image 3 (same pillars and frame), but the wooden door is swung open inward and only a thin edge of it is visible at one side; the rest of the opening is plain white #FFFFFF' },
  'school-entry/exterior-v2': { d: 'two-storey school main building facade with a dark navy roof, cream walls, rows of windows and a central entrance, small shrubs, wide and low. The WHOLE building must be visible from roof top to ground line with white space around it, nothing cut off' },
  'school-entry/forecourt': { d: 'long low strip of pale stone paving with a wider stepped section in the middle forming a T shape, front view slightly from above' },
  'outdoor/lamp': { d: 'black iron park street lamp with a glowing lantern top on a stone base, tall and thin' },
  'outdoor/pond': { d: 'small oval garden pond with clear blue water, lily pads, an edge of rounded stones and grass tufts' },
  'outdoor/rabbit': { d: 'small white rabbit eating a green leaf, side view' },
  'outdoor/squirrel': { d: 'brown squirrel sitting and holding an acorn, big fluffy tail' },
  'neighborhood/fence-front': { d: 'low garden fence: cream stone pillars with a dark green metal railing between them, front view, long and low' },
  'neighborhood/fence-side': { from: 'neighborhood/fence-front', d: 'the SAME fence as image 3, now seen from the side so it runs away into depth, tall and narrow' },
  'neighborhood/gate-parts': { d: 'two separate cream stone gate pillars with brick bases, one at the far left and one at the far right, each with a small dark green gate leaf, empty space between them' },
  'neighborhood/house-balcony': { d: 'two-storey cream house with a dark navy tiled roof, a balcony with potted plants on the upper floor, wooden front door, windows with curtains, brick base' },
  'neighborhood/house-brick': { d: 'single-storey Korean house, wide and low: dark navy-black tiled roof, red brick walls, wooden front door under a small canopy, two windows with curtains, a window flower box, a bicycle leaning on the wall' },
  'neighborhood/house-sage': { d: 'single-storey cream house, wide and low, with a sage green tiled roof, wooden front door, two windows, potted plants by the door, brick base' },
  'neighborhood/mailbox': { d: 'yellow mailbox with a small red flag on a wooden post with a stone base' },
  'room/plush': { d: 'big plush panda toy sitting, black and white, soft and round' },
  'sprites/house-exterior': { d: "the player's family house: single-storey cream house with a dark navy tiled roof, small entrance canopy, wooden front door, windows with a flower box, brick base, wide and low. Strict straight-on FRONT ELEVATION: the facade is parallel to the viewer, no side wall visible, not angled, not isometric, front door slightly left of center" },
};

const BASE = 'Images 1 and 2 are the OFFICIAL STYLE REFERENCES of our game (a background scene and a sheet of official props). '
  + 'Create ONE new game asset in exactly the same art style: polished 16-bit pixel art, chunky clearly visible pixels, dark brown outlines, '
  + 'the same warm muted palette (cream, sage green, warm wood, soft sky blue, brick red), soft cel shading with few tones, flat even daylight, no cast shadows. '
  + 'It must look drawn by the same artist for the same game as images 1 and 2. NOT anime, NOT painterly, NOT 3D, NOT realistic. No text, letters or watermark. ';

function promptFor(rel, aspect, ratio) {
  const it = DESC[rel];
  if (it.tile) return BASE + `Subject: ${it.d}, as a seamless tileable texture that fills the entire square edge to edge, seen straight from above, no objects. No frame, no border, no darker or lighter edges, no vignette: the pattern simply continues past every edge so copies placed side by side join invisibly.`;
  const pre = it.from ? 'Image 3 shows an asset we already made in this style. ' : '';
  return pre + BASE + `Subject: ${it.d}. The object's overall proportions must be width:height = ${ratio}. Like the props in image 2, centered, filling about 80% of a ${aspect} frame. Isolated on a pure flat white #FFFFFF background, nothing else, no ground.`;
}

// 흰색과의 거리로 투명화: 10 이하 투명 ~ 34 이상 불투명, 가장자리 색은 흰색 섞임을 되돌린다
async function keyWhite(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const dist = Math.sqrt((255 - data[i]) ** 2 + (255 - data[i + 1]) ** 2 + (255 - data[i + 2]) ** 2);
    const a = dist <= 10 ? 0 : dist >= 34 ? 1 : (dist - 10) / 24;
    if (a > 0 && a < 1) for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - 255 * (1 - a)) / a)));
    data[i + 3] = Math.round(a * 255);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// 알파 경계 상자
async function alphaBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// 새 그림(투명)을 옛 그림의 상자에 맞춰: 비율 유지·상자 안에 꽉 차게·아래 가운데
async function fitToOld(keyed, oldBuf, W, H) {
  const nb = await alphaBox(keyed), ob = (await alphaBox(oldBuf)) || { x: 0, y: 0, w: W, h: H };
  const cut = await sharp(keyed).extract({ left: nb.x, top: nb.y, width: nb.w, height: nb.h }).toBuffer();
  const s = Math.min(ob.w / nb.w, ob.h / nb.h);
  let w = Math.max(1, Math.round(nb.w * s)), h = Math.max(1, Math.round(nb.h * s));
  // 비율이 15% 넘게 다르면(문·담장처럼 칸에 꼭 맞아야 하는 것) 상자를 꽉 채우게 늘린다
  if (Math.abs((nb.w / nb.h) / (ob.w / ob.h) - 1) > 0.15) { w = ob.w; h = ob.h; }
  const piece = await sharp(cut).resize(w, h, { kernel: 'nearest' }).toBuffer();
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: piece, left: ob.x + Math.round((ob.w - w) / 2), top: ob.y + ob.h - h }]).png().toBuffer();
}

const urls = {};
async function up(key, file) { if (!urls[key]) urls[key] = await fal.upload(file); return urls[key]; }
function styleName(rel) { return /^(school\/(desk-rear|locker|teacher-desk|window|wood)|school-entry\/door|room\/)/.test(rel) ? 'classroom.png' : 'courtyard.png'; }

const all = Object.keys(DESC);
const list = process.argv.slice(2).length ? process.argv.slice(2) : all;
// 짝 그림은 기준 그림 뒤에
list.sort((a, b) => (DESC[a] && DESC[a].from ? 1 : 0) - (DESC[b] && DESC[b].from ? 1 : 0));
fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const rel of list) {
  const it = DESC[rel];
  if (!it) { console.error('설명 없음: ' + rel); continue; }
  try {
    const src = path.join(PRIV, 'assets', rel + '.png');
    const oldBuf = fs.readFileSync(src);
    const meta = await sharp(oldBuf).metadata();
    const aspect = meta.width > meta.height * 1.2 ? 'wide landscape' : meta.height > meta.width * 1.2 ? 'tall portrait' : 'square';
    const refs = [await up(styleName(rel), path.join(SHARED, styleName(rel))), await up('props', path.join(SHARED, 'props.png'))];
    if (it.from) refs.push(await fal.upload(path.join(OUT, it.from + '.raw.png')));
    const ob = it.tile ? null : await alphaBox(oldBuf);
    const ratio = ob ? '1:' + (ob.h / ob.w).toFixed(2) : '1:1';
    const res = await fal.run(ENDPOINT, { prompt: promptFor(rel, aspect, ratio), image_urls: refs, num_images: 1, output_format: 'png' });
    const url = res.images && res.images[0] && res.images[0].url;
    if (!url) throw new Error('결과 없음 ' + JSON.stringify(res).slice(0, 200));
    const raw = Buffer.from(await (await fetch(url)).arrayBuffer());
    const out = path.join(OUT, rel + '.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(path.join(OUT, rel + '.raw.png'), raw); // 생성 원본(키잉 전)
    const final = it.tile
      ? await sharp(raw).resize(meta.width, meta.height, { fit: 'fill', kernel: 'nearest' }).removeAlpha().png().toBuffer()
      : await fitToOld(await keyWhite(raw), oldBuf, meta.width, meta.height);
    fs.writeFileSync(out, final);
    const rm = await sharp(raw).metadata();
    fs.appendFileSync(path.join(OUT, 'generation-log.jsonl'), JSON.stringify({ rel, size: meta.width + 'x' + meta.height, generated: rm.width + 'x' + rm.height, seconds: res._seconds, from: it.from || null, at: new Date().toISOString(), endpoint: ENDPOINT }) + '\n');
    console.log(`✓ ${rel} ${meta.width}×${meta.height} (생성 ${rm.width}×${rm.height}, ${res._seconds}s)`);
    n++;
  } catch (e) { console.error(`✗ ${rel}: ${e.message}`); }
}
console.log(`\n완료 ${n}/${list.length}`);
