// 대화 그림 가공(2026-11-11) — ChatGPT 원본(assets/_incoming/, gitignore)을 게임용 webp로.
//   node tools/story-art.mjs            (data 폴더에서) 학생 초상 시트 + 1·2 임무 장면 그림을 다시 만든다
//   node tools/story-art.mjs --compare  + 기준 칸과 나란히 놓은 비교 그림 tests/_shot-student-compare.png(gitignore)
// 게임은 결과 webp만 읽는다. sharp는 게임 의존성이 아니라 이 PC의 다른 프로젝트 것을 빌려 쓴다(SHARP_MODULE로 바꿀 수 있음).
//
// ① 학생 초상 시트 assets/characters/student-portraits.webp (1024×256, 256칸 4개: 기본 · 걱정 · 기본 · 기본)
//    기준 = courier-portraits.webp 1칸의 인물 영역(불투명 화소의 위·아래·가로 가운데)을 **재서** 학생 그림을 같은 값에 맞춘다:
//    머리 꼭대기 y · 아래 잘림 y가 같도록 축소 비율을 정하고, 가로는 가운데끼리. 두 표정은 같은 창(기본 표정 기준)으로 잘라 얼굴이 안 튄다.
//    원본 배경이 투명이 아니면(네 모서리 알파가 0이 아님) 멈춘다 — 이번 원본은 실제 알파라 배경 지우기가 필요 없었다.
// ② 장면 그림 assets/story/m1-lostfound.webp · m2-sorting.webp (1600×900, reveal-senior.webp와 같은 규격)
//    1536×1024 → 가로 그대로·세로 864줄(16:9)만 남김. 가운데(top 80)가 기본이고, SCENES의 top으로 위아래를 조정.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SHARP = process.env.SHARP_MODULE || 'D:/Works/sih26/node_modules/sharp/lib/index.js';
const sharp = (await import(pathToFileURL(SHARP).href)).default;
const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IN = path.join(DATA, 'assets', '_incoming');
const CHAR = path.join(DATA, 'assets', 'characters');
const STORY = path.join(DATA, 'assets', 'story');
const CELL = 256, ALPHA = 16; // 불투명으로 볼 알파 문턱
const kb = (f) => (fs.statSync(f).size / 1024).toFixed(1) + 'KB';

// 불투명 화소의 경계(끝 포함) — { x0, x1, y0, y1 }
async function bounds(input, region) {
  let s = sharp(input).ensureAlpha();
  if (region) s = s.extract(region);
  const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > ALPHA) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const corners = [0, info.width - 1, (info.height - 1) * info.width, info.height * info.width - 1].map((i) => data[i * 4 + 3]);
  return { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, corners, width: info.width, height: info.height };
}

async function portraits() {
  const ref = await bounds(path.join(CHAR, 'courier-portraits.webp'), { left: 0, top: 0, width: CELL, height: CELL });
  const srcFiles = ['student-basic.png', 'student-worried.png'].map((f) => path.join(IN, f));
  const src = await bounds(srcFiles[0]);
  for (const f of srcFiles) {
    const b = await bounds(f);
    if (b.corners.some((a) => a > 0)) throw new Error(path.basename(f) + ': 배경이 투명이 아니다(모서리 알파 ' + b.corners + ') — 먼저 가장자리부터 배경을 지워야 한다');
    if (b.width !== 1024 || b.height !== 1024) throw new Error(path.basename(f) + ': 1024×1024가 아니다');
  }
  // 축소 비율: 인물 높이(머리 꼭대기 ~ 아래 잘림)를 기준 칸과 같게. 창 = 256칸이 원본에서 차지하는 정사각형(정수 화소로 맞춤)
  const scale = ref.h / src.h;
  const win = Math.ceil(CELL / scale); // 올림 — 반올림(969)이면 아래 잘림이 기준보다 한 줄 내려간다(250)
  const left = Math.round((src.x0 + src.x1 + 1) / 2 - ((ref.x0 + ref.x1 + 1) / 2) / scale);
  const top = Math.round(src.y0 - ref.y0 / scale);
  const pad = { top: Math.max(0, -top), left: Math.max(0, -left), bottom: Math.max(0, top + win - src.height), right: Math.max(0, left + win - src.width) };
  const cells = [];
  for (const f of srcFiles) {
    // 창이 원본 밖으로 나가는 만큼 투명으로 넓힌 뒤 자르고, Lanczos로 줄인다(sharp는 알파를 미리 곱해 줄여서 가장자리에 검은 띠가 안 생김)
    const ext = await sharp(f).ensureAlpha().extend({ ...pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    cells.push(await sharp(ext).extract({ left: left + pad.left, top: top + pad.top, width: win, height: win }).resize(CELL, CELL, { kernel: 'lanczos3' }).png().toBuffer());
  }
  const out = path.join(CHAR, 'student-portraits.webp');
  await sharp({ create: { width: CELL * 4, height: CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([cells[0], cells[1], cells[0], cells[0]].map((input, i) => ({ input, left: i * CELL, top: 0 })))
    .webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(out);
  const got = [];
  for (let i = 0; i < 4; i++) got.push(await bounds(out, { left: i * CELL, top: 0, width: CELL, height: CELL }));
  const m = await sharp(out).metadata();
  const fmt = (b) => 'x ' + b.x0 + '~' + b.x1 + ' (가운데 ' + ((b.x0 + b.x1 + 1) / 2) + ') · y ' + b.y0 + '~' + b.y1 + ' (높이 ' + b.h + ')';
  console.log('[초상] 기준 courier 1칸  ' + fmt(ref));
  console.log('[초상] 원본 student-basic ' + fmt(src) + ' → 비율 ' + scale.toFixed(4) + ', 원본 창 left ' + left + ' top ' + top + ' 한 변 ' + win + ' (아래 ' + pad.bottom + 'px 투명으로 넓힘)');
  got.forEach((b, i) => console.log('[초상] 결과 ' + (i + 1) + '칸        ' + fmt(b)));
  console.log('[초상] ' + path.relative(DATA, out) + ' ' + m.width + '×' + m.height + ' alpha ' + m.hasAlpha + ' ' + kb(out));
  return { out, ref, got };
}

// top = 원본에서 남길 864줄의 시작 줄(가운데 = 80)
const SCENES = [
  // m1: 위로 40줄 올림 — 학생 머리 위 여유(건너뛰기 버튼과 떨어지게) + 천장 CCTV가 통째로 + 아래는 바지 밑단에서 끊김(신발 중간이 아니라)
  { name: 'm1-lostfound', top: 40 },
  // m1 마무리(해결된 장면, 2026-11-11): 도입 그림과 같은 방·같은 구도 → 같은 자리로 자른다
  { name: 'm1-lostfound-solved', top: 40 },
  // m2: 위로 24줄 올림 — 왼쪽 선별장 직원 모자(원본 y 85) 위에 여유, 수거봇 머리는 좁은 화면 대화창보다 위
  { name: 'm2-sorting', top: 56 }
];
async function scenes() {
  for (const s of SCENES) {
    const src = path.join(IN, s.name + '.png'), out = path.join(STORY, s.name + '.webp');
    const m = await sharp(src).metadata();
    if (m.width !== 1536 || m.height !== 1024) throw new Error(s.name + ': 1536×1024가 아니다');
    const h = Math.round(m.width * 9 / 16); // 864
    const base = sharp(src).extract({ left: 0, top: s.top, width: m.width, height: h }).resize(1600, 900, { kernel: 'lanczos3' });
    let q = 85;
    for (;;) { // 400KB를 넘으면 품질을 2씩 낮춘다
      await base.clone().webp({ quality: q, effort: 6, smartSubsample: true }).toFile(out);
      if (fs.statSync(out).size <= 400 * 1024 || q <= 70) break;
      q -= 2;
    }
    const o = await sharp(out).metadata();
    console.log('[장면] ' + path.relative(DATA, out) + ' ' + o.width + '×' + o.height + ' · 원본 y ' + s.top + '~' + (s.top + h) + ' (가운데면 80~944) · q' + q + ' · ' + kb(out));
  }
}

// 비교 그림: 기존 2표정 시트 1·2칸과 학생 1·2칸을 어두운 바탕·밝은 바탕에 3배로 나란히 + 기준선(머리 꼭대기·아래 잘림)
async function compare(p) {
  const K = 3, S = CELL * K, G = 6;
  const ids = [['courier', 0], ['student', 0], ['student', 1], ['grader', 0], ['sorter', 0]];
  const W = ids.length * (S + G) - G, comps = [];
  for (const [row, bg] of [[0, '#211a4d'], [1, '#e9e6f5']]) {
    comps.push({ input: await sharp({ create: { width: W, height: S, channels: 4, background: bg } }).png().toBuffer(), left: 0, top: row * (S + G) });
    for (let i = 0; i < ids.length; i++) {
      const cell = await sharp(path.join(CHAR, ids[i][0] + '-portraits.webp')).extract({ left: ids[i][1] * CELL, top: 0, width: CELL, height: CELL }).resize(S, S, { kernel: 'nearest' }).png().toBuffer();
      comps.push({ input: cell, left: i * (S + G), top: row * (S + G) });
    }
    const lines = [p.ref.y0, p.ref.y1 + 1].map((y) => '<line x1="0" x2="' + W + '" y1="' + (y * K + row * (S + G)) + '" y2="' + (y * K + row * (S + G)) + '" stroke="#ff3bd4" stroke-width="1"/>').join('');
    comps.push({ input: Buffer.from('<svg width="' + W + '" height="' + (2 * S + G) + '" xmlns="http://www.w3.org/2000/svg">' + lines + '</svg>'), left: 0, top: 0 });
  }
  const out = path.join(DATA, 'tests', '_shot-student-compare.png');
  await sharp({ create: { width: W, height: 2 * S + G, channels: 4, background: '#000' } }).composite(comps).png().toFile(out);
  console.log('[비교] ' + path.relative(DATA, out) + ' — 왼쪽부터 courier 1칸 · student 1칸 · student 2칸 · grader 1칸 · sorter 1칸 (분홍 선 = 기준 칸의 머리 꼭대기·아래 잘림)');
}

const p = await portraits();
await scenes();
if (process.argv.includes('--compare')) await compare(p);
