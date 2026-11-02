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
  // 매점(2026-11-01 prop-art.mjs, 정면 3/4·테라코타 지붕): 오른쪽 아래 잔디 뒤쪽에 앉혀 창구가 아래(14줄 서는 자리)를 본다 — world.js store (20,11) 4×3
  { file: 'assets/props/store.png', cx: 1150, bottom: 734, w: 205, shadowH: 10 },
  // 작은 동물(구석의 막힌 칸만): 왼쪽 위 나무 그늘 토끼, 오른쪽 나무 밑동 옆 땅 위 다람쥐(장면 칸 30,10 — 나무 칸이라 이미 막힘)
  //   2026-11-02: 다람쥐가 왼쪽 벤치 위에 어설프게 올라앉아 있었다(cx 222, bottom 784) → 나무 밑동 옆 땅으로(사용자 지적)
  { file: 'assets/props/rabbit.png', cx: 100, bottom: 492, w: 40 },
  { file: 'assets/props/squirrel.png', cx: 1597, bottom: 578, w: 46, shadowH: 6 }
];

async function alphaCrisp(buf) { // 반투명 가장자리 → 0 또는 255(픽셀 그림처럼 또렷하게)
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= 110 ? 255 : 0;
  return sharp(data, { raw: info }).png().toBuffer();
}
async function sprite(p) {
  const trimmed = await sharp(path.join(PRIV, p.file)).trim().png().toBuffer(); // 투명 여백 제거
  const img = await sharp(trimmed).resize({ width: p.w, kernel: p.w < 80 ? 'lanczos3' : 'nearest' }).png().toBuffer(); // 아주 작게 줄이는 동물은 부드럽게 줄인 뒤 아래에서 알파를 또렷하게
  const crisp = p.w < 80 ? await alphaCrisp(img) : img;
  const m = await sharp(img).metadata();
  // 발밑 그림자(바닥에 붙어 보이게)
  const sh = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${m.width}" height="40"><ellipse cx="${m.width / 2}" cy="20" rx="${m.width * 0.46}" ry="${p.shadowH || 13}" fill="rgba(40,50,30,0.28)"/></svg>`);
  return [
    { input: sh, left: Math.round(p.cx - m.width / 2), top: p.bottom - 22 },
    { input: crisp, left: Math.round(p.cx - m.width / 2), top: p.bottom - m.height }
  ];
}
const layers = (await Promise.all(PLACE.map(sprite))).flat();
await sharp(BG).composite(layers).png().toFile(path.join(PRIV, 'assets', 'scenes', 'yard.png'));
console.log('✓ assets/scenes/yard.png (courtyard 원본 + ' + PLACE.length + '개 합성)');
