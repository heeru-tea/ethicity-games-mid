// fal.ai가 만든 버스 GLB → 게임이 읽는 assets/models/bus.js (PB.busModelData).
//   node publicness/tools/bus-model.mjs [assets/models/bus-trellis.glb] [--q 0.85]
// 좌표를 앞=+x(게임의 진행 방향)·길이 3.2·바닥 y=0으로 옮긴 뒤 Uint16으로 양자화해 base64로 넣고,
// 텍스처는 tools/to-webp.mjs(헤드리스 Edge)로 webp 변환해 data URI로 넣는다 — file://에서도 캔버스 색칠이 막히지 않게.
// GLB·입력 그림·중간 PNG/webp는 .gitignore(assets/models/*), 커밋하는 건 bus.js 하나.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const qi = args.indexOf('--q');
const Q = qi >= 0 ? args.splice(qi, 2)[1] : '0.85';
const src = path.join(PB, args[0] || 'assets/models/bus-trellis.glb');
const LENGTH = 3.2;

const glb = fs.readFileSync(src);
const jsonLen = glb.readUInt32LE(12);
const j = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
const binAt = 20 + jsonLen, bin = glb.subarray(binAt + 8, binAt + 8 + glb.readUInt32LE(binAt));
if (j.meshes.length !== 1 || j.meshes[0].primitives.length !== 1) throw new Error('메쉬·프리미티브가 하나인 GLB만 지원');
if ((j.nodes || []).some((n) => n.matrix || n.rotation || n.scale || n.translation)) throw new Error('노드 변환이 있는 GLB는 미지원');
const prim = j.meshes[0].primitives[0];
function view(ai, Ctor) {
  const a = j.accessors[ai], bv = j.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type];
  const raw = bin.subarray((bv.byteOffset || 0) + (a.byteOffset || 0));
  return new Ctor(raw.buffer.slice(raw.byteOffset, raw.byteOffset + a.count * n * Ctor.BYTES_PER_ELEMENT));
}
const pos = view(prim.attributes.POSITION, Float32Array), uv = view(prim.attributes.TEXCOORD_0, Float32Array);
const idxAcc = j.accessors[prim.indices];
const index = idxAcc.componentType === 5125 ? view(prim.indices, Uint32Array) : view(prim.indices, Uint16Array);

// Trellis 출력은 y 위·앞=+z → y축 +90° 회전으로 앞=+x: (x, z) → (z, −x)
let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < pos.length; i += 3) {
  const p = [pos[i + 2], pos[i + 1], -pos[i]];
  pos.set(p, i);
  for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); }
}
const s = LENGTH / (mx[0] - mn[0]), c = [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2];
for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) pos[i + k] = (pos[i + k] - c[k]) * s;

function pack(arr, dim) {
  const min = Array(dim).fill(Infinity), max = Array(dim).fill(-Infinity);
  arr.forEach((v, i) => { min[i % dim] = Math.min(min[i % dim], v); max[i % dim] = Math.max(max[i % dim], v); });
  const q = new Uint16Array(arr.length);
  arr.forEach((v, i) => { const k = i % dim, r = max[k] - min[k]; q[i] = r ? Math.round((v - min[k]) / r * 65535) : 0; });
  const r6 = (v) => Math.round(v * 1e6) / 1e6;
  return { b64: Buffer.from(q.buffer).toString('base64'), min: min.map(r6), max: max.map(r6) };
}
const P = pack(pos, 3), U = pack(uv, 2);
const small = pos.length / 3 < 65536;
const I = small ? Uint16Array.from(index) : index;

const img = j.images[j.textures[j.materials[prim.material].pbrMetallicRoughness.baseColorTexture.index].source];
const ibv = j.bufferViews[img.bufferView];
const texPng = path.join(PB, 'assets/models/bus-texture.png');
fs.writeFileSync(texPng, bin.subarray(ibv.byteOffset || 0, (ibv.byteOffset || 0) + ibv.byteLength));
execFileSync(process.execPath, [path.join(PB, 'tools/to-webp.mjs'), 'assets/models/bus-texture.png', '--q', Q], { stdio: 'inherit' });
const webp = fs.readFileSync(texPng.replace(/\.png$/, '.webp'));

const data = {
  source: path.basename(src), vertices: pos.length / 3, triangles: index.length / 3,
  posMin: P.min, posMax: P.max, position: P.b64, uvMin: U.min, uvMax: U.max, uv: U.b64,
  indexType: small ? 'u16' : 'u32', index: Buffer.from(I.buffer).toString('base64'),
  texture: 'data:image/webp;base64,' + webp.toString('base64')
};
const out = path.join(PB, 'assets/models/bus.js');
fs.writeFileSync(out, '/* 자동 생성 — tools/bus-model.mjs (원본: fal.ai Trellis, ' + data.source + '). 직접 고치지 말 것 */\n' +
  '(function (root) { root.PB = root.PB || {}; root.PB.busModelData = ' + JSON.stringify(data) + '; })(typeof window !== \'undefined\' ? window : globalThis);\n');
console.log(`✓ ${path.relative(PB, out)} ${Math.round(fs.statSync(out).size / 1024)}KB · 정점 ${data.vertices} · 삼각형 ${data.triangles} · 크기 ${P.max.map((v, k) => (v - P.min[k]).toFixed(2)).join('×')}`);
