// 장면 그림(맵 개편, docs/specs/2026-10-31-scene-map-design.md) — fal.ai nano-banana/edit
//   node privacy/tools/scene-art.mjs [yard village room]
//   참조 = 공통 팩 배경·props(화풍·카메라 기준). 결과는 공통 배경과 같은 1672×941로 맞춰 assets/scenes/<id>.png, 원본은 <id>.raw.png
//   키·호출은 publicness 도구(fal.mjs, 키 = publicness/.env — 커밋 금지). 생성 기록은 assets/scenes/generation-log.jsonl
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAL = process.env.FAL_TOOLS || 'D:/Works/ethicity-games-mid-publicness/publicness/tools/fal.mjs';
const { upload, run, download } = await import('file:///' + FAL.replace(/\\/g, '/'));
const sharp = (await import('file:///D:/Works/sih26/node_modules/sharp/lib/index.js')).default;
const PRIV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BG = path.join(PRIV, '..', 'shared', 'ethicity-elementary-common-v1', 'backgrounds');
const OUT = path.join(PRIV, 'assets', 'scenes');
fs.mkdirSync(OUT, { recursive: true });
const W = 1672, H = 941;

const STYLE = 'Polished 16-bit pixel art with chunky clearly visible pixels and dark brown outlines, the same warm muted palette, '
  + 'soft cel shading, flat even daylight. No text, letters, numbers or watermark anywhere. Wide 16:9 landscape image.';

const SCENES = {
  // 공통 마당을 그대로 두고 천막 2개·매점 가판대만 더한다
  yard: {
    refs: [path.join(BG, 'courtyard.png'), path.join(PRIV, 'assets/schoolyard/booth-photo.png'), path.join(PRIV, 'assets/schoolyard/booth-snack.png'), path.join(PRIV, 'assets/schoolyard/store.png')],
    prompt: 'Edit image 1. Keep EVERYTHING in image 1 exactly as it is: the same buildings, doors, paths, gate pillars, trees, benches, camera angle, framing and size. '
      + 'Only ADD three small things, drawn in exactly the same pixel art style as image 1: '
      + '(a) on the large lawn at the lower LEFT, two festival booth tents standing side by side facing the viewer, like image 2 (green and cream striped awning, photo frames and a camera on the counter) and image 3 (red and white striped awning, cotton candy); '
      + '(b) on the lawn at the lower RIGHT, one small wooden snack kiosk with a green roof and a counter of snacks, like image 4. '
      + 'Keep the dirt paths completely clear. Do not move or remove anything else. ' + STYLE
  },
  // 학교 교문 밖 마을 길: 이웃집 2채를 지나 길 끝 마지막 집이 우리 집
  village: {
    refs: [path.join(BG, 'courtyard.png'), path.join(PRIV, 'assets/neighborhood/house-sage.png'), path.join(PRIV, 'assets/neighborhood/house-brick.png'), path.join(PRIV, 'assets/sprites/house-exterior.png')],
    prompt: 'Image 1 is the official art of our game: use exactly its pixel art style, palette and its high top-down three-quarter camera. '
      + 'Draw a NEW scene with the same camera and scale as image 1: a quiet small-town residential street at daytime. '
      + 'A wide dirt road enters from the middle of the LEFT edge and runs to the right side of the picture. '
      + 'Along the upper side of the road stand, from left to right: a cottage with a sage green roof like image 2, then a red brick house like image 3, '
      + 'and at the far RIGHT END of the road the last house: a cream house with a dark navy tiled roof, a small entrance canopy and a wooden front door facing the road, like image 4, with a yellow mailbox next to its door. '
      + 'Each house has a short path from its front door down to the road. Below the road: lawn with flower beds, a wooden bench, a street lamp and a small round pond with lily pads at the lower left. '
      + 'Trees and bushes frame the top and the edges. The road itself is empty and clear. ' + STYLE
  },
  // 내 방: 교실 그림과 같은 시점의 아이 방
  room: {
    refs: [path.join(BG, 'classroom.png'), path.join(PRIV, 'assets/room/plush.png')],
    prompt: 'Image 1 is the official art of our game: use exactly its pixel art style, palette, wooden floor and its interior camera (back wall at the top, floor seen from above, side walls slanting at the left and right). '
      + 'Draw a NEW interior with the same camera and scale: a cozy middle-school student\'s bedroom. '
      + 'Back wall with a window with curtains in the middle and a small framed poster. A single bed with a cream blanket against the back wall on the LEFT. '
      + 'A study desk with a computer monitor, keyboard and a chair against the back wall on the RIGHT, a small bookshelf next to it. '
      + 'A big plush panda toy like image 2 sitting in the LOWER RIGHT corner. A round soft rug in the middle of the floor. '
      + 'At the BOTTOM CENTER edge a doormat where the room door is (the camera side). Most of the floor is empty and clear for walking. ' + STYLE
  }
};

const list = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENES);
for (const id of list) {
  const sc = SCENES[id];
  const t0 = Date.now();
  try {
    const urls = [];
    for (const r of sc.refs) urls.push(await upload(r));
    const res = await run('fal-ai/nano-banana/edit', { prompt: sc.prompt, image_urls: urls, num_images: 1, output_format: 'png', aspect_ratio: '16:9' });
    const url = res.images?.[0]?.url;
    if (!url) throw new Error('결과 없음 ' + JSON.stringify(res).slice(0, 200));
    const raw = path.join(OUT, id + '.raw.png');
    await download(url, raw);
    const m = await sharp(raw).metadata();
    await sharp(raw).resize(W, H, { fit: 'cover', position: 'centre', kernel: 'nearest' }).png().toFile(path.join(OUT, id + '.png'));
    fs.appendFileSync(path.join(OUT, 'generation-log.jsonl'), JSON.stringify({ at: new Date().toISOString(), id, model: 'fal-ai/nano-banana/edit', raw: m.width + 'x' + m.height, prompt: sc.prompt }) + '\n');
    console.log(`✓ ${id} (생성 ${m.width}×${m.height} → ${W}×${H}, ${Math.round((Date.now() - t0) / 1000)}s)`);
  } catch (e) { console.log(`✗ ${id}: ${e.message.slice(0, 200)}`); }
}
