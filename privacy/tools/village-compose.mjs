// 마을 길 장면 = fal로 그린 마을 그림(assets/scenes/village-base.png, scene-art.mjs 결과를 고정한 원본) + 작은 동물 합성.
//   node privacy/tools/village-compose.mjs → assets/scenes/village.png (그다음 node privacy/tools/to-webp.mjs assets/scenes)
//   자리(원본 1672×941 픽셀, 발밑/물 위 가운데 기준)는 PLACE. 길·집 앞이 아닌 구석(연못·잔디 끝)에만 둔다(world.js 마을 칸 지도에서 막힌 곳).
//   scene-art.mjs village 로 마을을 다시 그리면 village.png를 village-base.png로 복사한 뒤 이 도구를 다시 돌린다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const sharp = (await import('file:///D:/Works/sih26/node_modules/sharp/lib/index.js')).default;
const PRIV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = path.join(PRIV, 'assets', 'scenes', 'village-base.png');
if (!fs.existsSync(BASE)) fs.copyFileSync(path.join(PRIV, 'assets', 'scenes', 'village.png'), BASE); // 처음 한 번: 지금 그림을 원본으로 고정

// water: 물 위에 뜬 것(발밑 그림자 대신 옅은 물결)
export const PLACE = [
  { file: 'assets/props/duck-white.png', cx: 445, bottom: 793, scale: 1.4, water: true },   // 왼쪽 아래 연못: 엄마 오리
  { file: 'assets/props/duck-yellow1.png', cx: 203, bottom: 874, scale: 1.4, water: true }, // 새끼 오리 둘
  { file: 'assets/props/duck-yellow2.png', cx: 250, bottom: 884, scale: 1.4, water: true },
  // prop-art.mjs 동물(w = 줄일 폭): 우리 집 옆 잔디에서 자는 고양이, 벤치 왼쪽 잔디 위 참새(장면 칸 13,15 — 막힌 잔디)
  //   2026-11-02: 참새가 벤치 등받이 끝에 걸쳐 있었다(cx 868, bottom 792) → 꽃과 벤치 사이 땅으로(가구 위에 두지 않기)
  { file: 'assets/props/cat.png', cx: 1447, bottom: 734, w: 50 },
  { file: 'assets/props/bird.png', cx: 725, bottom: 812, w: 34 }
];

async function sprite(p) {
  const src = path.join(PRIV, p.file);
  if (!fs.existsSync(src)) { console.log('  (없어서 건너뜀) ' + p.file); return []; }
  const m0 = await sharp(src).metadata();
  let img = await sharp(src).trim().resize({ width: p.w || Math.round(m0.width * p.scale), kernel: p.w ? 'lanczos3' : 'nearest' }).png().toBuffer();
  if (p.w) { // 크게 줄인 동물: 반투명 가장자리를 0/255로(픽셀 그림처럼 또렷하게)
    const { data, info } = await sharp(img).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= 110 ? 255 : 0;
    img = await sharp(data, { raw: info }).png().toBuffer();
  }
  const m = await sharp(img).metadata();
  const left = Math.round(p.cx - m.width / 2), top = p.bottom - m.height;
  const under = p.water
    ? `<ellipse cx="${m.width / 2}" cy="10" rx="${m.width * 0.5}" ry="6" fill="rgba(225,240,255,0.55)"/>` // 물결
    : `<ellipse cx="${m.width / 2}" cy="10" rx="${m.width * 0.42}" ry="6" fill="rgba(40,50,30,0.28)"/>`;   // 그림자
  const sh = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${m.width}" height="20">${under}</svg>`);
  return [{ input: sh, left, top: p.bottom - 13 }, { input: img, left, top }];
}
const layers = (await Promise.all(PLACE.map(sprite))).flat();
await sharp(BASE).composite(layers).png().toFile(path.join(PRIV, 'assets', 'scenes', 'village.png'));
console.log('✓ assets/scenes/village.png (village-base + ' + layers.length / 2 + '개 합성)');
