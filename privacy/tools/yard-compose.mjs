// 학교 마당 장면 = 공통 courtyard.png 원본 그대로 + 축제 천막 2개·매점 가판대(이미 공통 화풍으로 만든 그림)를 정해진 자리에 합성.
// fal 편집은 원본을 통째로 다시 그려 버려서(교문 위치까지 바뀜) 쓰지 않는다. node privacy/tools/yard-compose.mjs
// 자리(원본 1672×941 픽셀, 발밑 가운데 기준)는 아래 PLACE — world.js 마당 핫스팟과 같은 곳.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const sharp = (await import('file:///D:/Works/sih26/node_modules/sharp/lib/index.js')).default;
const PRIV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BG = path.join(PRIV, '..', 'shared', 'ethicity-elementary-common-v1', 'backgrounds', 'courtyard.png');

export const PLACE = [
  { file: 'assets/schoolyard/booth-photo.png', cx: 405, bottom: 760, w: 205 }, // 레트로 사진관(우리 반)
  { file: 'assets/schoolyard/booth-snack.png', cx: 605, bottom: 760, w: 205 }, // 옆 반
  { file: 'assets/schoolyard/store.png', cx: 1150, bottom: 785, w: 215 }       // 매점 가판대
];

async function sprite(p) {
  const trimmed = await sharp(path.join(PRIV, p.file)).trim().png().toBuffer(); // 투명 여백 제거
  const img = await sharp(trimmed).resize({ width: p.w, kernel: 'nearest' }).png().toBuffer();
  const m = await sharp(img).metadata();
  // 발밑 그림자(바닥에 붙어 보이게)
  const sh = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${m.width}" height="40"><ellipse cx="${m.width / 2}" cy="20" rx="${m.width * 0.46}" ry="13" fill="rgba(40,50,30,0.28)"/></svg>`);
  return [
    { input: sh, left: Math.round(p.cx - m.width / 2), top: p.bottom - 22 },
    { input: img, left: Math.round(p.cx - m.width / 2), top: p.bottom - m.height }
  ];
}
const layers = (await Promise.all(PLACE.map(sprite))).flat();
await sharp(BG).composite(layers).png().toFile(path.join(PRIV, 'assets', 'scenes', 'yard.png'));
console.log('✓ assets/scenes/yard.png (courtyard 원본 + 3개 합성)');
