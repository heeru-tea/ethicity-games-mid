// PNG 읽기·쓰기와 그림 손질(설치 없이 node:zlib만) — tools/art.mjs가 생성 그림을 공통 팩 규격으로 맞출 때 쓴다.
//   decode(buf) → { width, height, data: RGBA }   (8비트, 비월 없음: 회색·RGB·팔레트·RGBA)
//   encode(img) → PNG Buffer(RGBA)
import zlib from 'node:zlib';

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function decode(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('PNG가 아님');
  let pos = 8, w = 0, h = 0, depth = 0, type = 0, inter = 0, plte = null, trns = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), kind = buf.toString('ascii', pos + 4, pos + 8), body = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); depth = body[8]; type = body[9]; inter = body[12]; }
    else if (kind === 'PLTE') plte = body;
    else if (kind === 'tRNS') trns = body;
    else if (kind === 'IDAT') idat.push(body);
    else if (kind === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || inter) throw new Error(`지원하지 않는 PNG(비트 ${depth}, 비월 ${inter})`);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, out = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, s = x * ch;
      if (type === 6) { out[o] = cur[s]; out[o + 1] = cur[s + 1]; out[o + 2] = cur[s + 2]; out[o + 3] = cur[s + 3]; }
      else if (type === 2) { out[o] = cur[s]; out[o + 1] = cur[s + 1]; out[o + 2] = cur[s + 2]; out[o + 3] = 255; }
      else if (type === 0) { out[o] = out[o + 1] = out[o + 2] = cur[s]; out[o + 3] = 255; }
      else if (type === 4) { out[o] = out[o + 1] = out[o + 2] = cur[s]; out[o + 3] = cur[s + 1]; }
      else { const k = cur[s]; out[o] = plte[k * 3]; out[o + 1] = plte[k * 3 + 1]; out[o + 2] = plte[k * 3 + 2]; out[o + 3] = trns && k < trns.length ? trns[k] : 255; }
    }
    [prev, cur] = [cur, prev];
  }
  return { width: w, height: h, data: out };
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc(buf) { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(kind, body) {
  const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
  const kb = Buffer.from(kind, 'ascii'), c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([kb, body])));
  return Buffer.concat([len, kb, body, c]);
}
export function encode(img) {
  const { width: w, height: h, data } = img, stride = w * 4, raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; Buffer.from(data.buffer, data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

export function blank(w, h) { return { width: w, height: h, data: new Uint8Array(w * h * 4) }; }
export function crop(img, x, y, w, h) {
  const out = blank(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const sx = x + i, sy = y + j; if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) continue;
    const s = (sy * img.width + sx) * 4, o = (j * w + i) * 4;
    for (let k = 0; k < 4; k++) out.data[o + k] = img.data[s + k];
  }
  return out;
}
// 넓이 평균 축소(투명도 가중). alphaCut을 주면 반투명 가장자리를 0/255로 잘라 도트를 또렷하게
export function resize(img, w, h, alphaCut) {
  const out = blank(w, h), sx = img.width / w, sy = img.height / h;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x0 = i * sx, x1 = (i + 1) * sx, y0 = j * sy, y1 = (j + 1) * sy;
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
      if (x >= img.width || y >= img.height) continue;
      const s = (y * img.width + x) * 4, al = img.data[s + 3];
      r += img.data[s] * al; g += img.data[s + 1] * al; b += img.data[s + 2] * al; a += al; n++;
    }
    const o = (j * w + i) * 4;
    if (a) { out.data[o] = r / a; out.data[o + 1] = g / a; out.data[o + 2] = b / a; }
    let al = n ? a / n : 0;
    if (alphaCut != null) al = al >= alphaCut ? 255 : 0;
    out.data[o + 3] = al;
  }
  return out;
}
// 가로세로 비율에 맞춰 가운데를 자른 뒤 크기 맞춤(배경용)
export function cover(img, w, h) {
  const want = w / h, have = img.width / img.height;
  let cw = img.width, ch = img.height;
  if (have > want) cw = Math.round(img.height * want); else ch = Math.round(img.width / want);
  return resize(crop(img, Math.round((img.width - cw) / 2), Math.round((img.height - ch) / 2), cw, ch), w, h);
}
// 가장자리에서 이어진 배경색을 투명하게(생성 그림의 단색 배경 제거)
export function keyBackground(img, tol = 60) {
  const { width: w, height: h, data } = img;
  const corners = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]];
  // 이미 배경이 투명한 그림은 그대로 둔다(투명 칸의 색을 기준으로 지우면 외곽선까지 지워진다)
  if (corners.every(([x, y]) => data[(y * w + x) * 4 + 3] < 16)) return img;
  const samples = corners.map(([x, y]) => { const s = (y * w + x) * 4; return [data[s], data[s + 1], data[s + 2]]; });
  const key = [0, 1, 2].map((k) => samples.reduce((a, c) => a + c[k], 0) / samples.length);
  const near = (p) => { const s = p * 4; return Math.hypot(data[s] - key[0], data[s + 1] - key[1], data[s + 2] - key[2]) < tol; };
  const seen = new Uint8Array(w * h), stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop();
    if (seen[p] || !near(p)) continue;
    seen[p] = 1; data[p * 4 + 3] = 0;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p - 1); if (x < w - 1) stack.push(p + 1); if (y > 0) stack.push(p - w); if (y < h - 1) stack.push(p + w);
  }
  return img;
}
// 투명 표시용 체크무늬(흰 칸·회색 칸)가 그림에 칠해진 원본: 체크 색인 픽셀만 가장자리에서부터 이어서 지운다.
// 칸 사이 경계(중간 밝기)는 가까이에 흰 칸·회색 칸이 함께 있을 때만 배경으로 본다 — 칸 위치가 고르지 않아도 되고,
// 흰 옷처럼 체크와 비슷한 색은 인물 외곽선에 막혀 남는다. 체크무늬가 아니면 null
export function keyChecker(img) {
  const { width: w, height: h, data } = img;
  const gray = (x, y) => { const s = (y * w + x) * 4; return data[s + 3] > 200 && Math.max(data[s], data[s + 1], data[s + 2]) - Math.min(data[s], data[s + 1], data[s + 2]) < 8 ? data[s] : -1; };
  const light = (g) => g >= 246, dark = (g) => g >= 198 && g <= 224;
  let nl = 0, nd = 0;
  for (let x = 0; x < w; x++) { const g = gray(x, 2); if (g < 0) return null; if (light(g)) nl++; else if (dark(g)) nd++; }
  if (nl < w * 0.3 || nd < w * 0.3) return null;
  const near = (x, y, test) => {
    for (let k = -2; k <= 2; k++) {
      if (x + k >= 0 && x + k < w && test(gray(x + k, y))) return true;
      if (y + k >= 0 && y + k < h && test(gray(x, y + k))) return true;
    }
    return false;
  };
  const isBg = (p) => {
    const x = p % w, y = (p / w) | 0, g = gray(x, y);
    if (g < 198) return false;
    return light(g) || dark(g) || (near(x, y, light) && near(x, y, dark));
  };
  const seen = new Uint8Array(w * h), bg = new Uint8Array(w * h), stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    if (!isBg(p)) continue;
    bg[p] = 1;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p - 1); if (x < w - 1) stack.push(p + 1); if (y > 0) stack.push(p - w); if (y < h - 1) stack.push(p + w);
  }
  for (let p = 0; p < w * h; p++) if (bg[p]) data[p * 4 + 3] = 0;
  // 남은 체크 조각(칸 모서리 점·이어 붙인 그림의 경계선): 투명한 곳에 떠 있는 밝은 무채색 점·가는 선을 몇 번 깎는다
  for (let pass = 0; pass < 4; pass++) {
    const cut = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (gray(x, y) < 198) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h && data[(ny * w + nx) * 4 + 3]) n++;
      }
      if (n <= 3) cut.push(y * w + x);
    }
    if (!cut.length) break;
    cut.forEach((p) => { data[p * 4 + 3] = 0; });
  }
  return img;
}
// 가장 큰 덩어리(인물)와 그 범위 안에 걸친 조각(티끌보다 큰 것)만 남기고 지운다 — 큰 그림에서 오려 낸 원본에 섞인 옆 인물 조각·티끌 제거
export function keepMain(img, minAlpha = 128) {
  const { width: w, height: h, data } = img, label = new Int32Array(w * h), boxes = [];
  for (let p0 = 0; p0 < w * h; p0++) {
    if (label[p0] || data[p0 * 4 + 3] < minAlpha) continue;
    const id = boxes.length + 1, b = { x0: w, y0: h, x1: -1, y1: -1, n: 0 }, stack = [p0];
    label[p0] = id;
    while (stack.length) {
      const p = stack.pop(), x = p % w, y = (p / w) | 0;
      b.n++; if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, q = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || label[q] || data[q * 4 + 3] < minAlpha) continue;
        label[q] = id; stack.push(q);
      }
    }
    boxes.push(b);
  }
  if (!boxes.length) return img;
  const m = boxes.reduce((a, b) => (b.n > a.n ? b : a));
  const keep = boxes.map((b) => { const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; return b === m || (b.n >= m.n * 0.002 && cx >= m.x0 && cx <= m.x1 && cy >= m.y0 && cy <= m.y1); });
  for (let p = 0; p < w * h; p++) {
    const x = p % w, y = (p / w) | 0;
    if (label[p] ? !keep[label[p] - 1] : (x < m.x0 || x > m.x1 || y < m.y0 || y > m.y1)) data[p * 4 + 3] = 0;
  }
  return img;
}
// from~to 사이에서 불투명 칸이 가장 적은 세로줄(axis 'x') 또는 가로줄(axis 'y') — 격자 그림의 칸 경계 찾기
export function gutter(img, axis, from, to) {
  let best = from, min = Infinity;
  for (let i = from; i <= to; i++) {
    let n = 0;
    const len = axis === 'x' ? img.height : img.width;
    for (let j = 0; j < len; j++) n += img.data[((axis === 'x' ? j * img.width + i : i * img.width + j)) * 4 + 3] >= 128;
    if (n < min) { min = n; best = i; }
  }
  return best;
}
export function bbox(img, minAlpha = 128) {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (img.data[(y * img.width + x) * 4 + 3] >= minAlpha) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
export function paste(dst, src, x, y) {
  for (let j = 0; j < src.height; j++) for (let i = 0; i < src.width; i++) {
    const dx = x + i, dy = y + j; if (dx < 0 || dy < 0 || dx >= dst.width || dy >= dst.height) continue;
    const s = (j * src.width + i) * 4; if (!src.data[s + 3]) continue;
    const o = (dy * dst.width + dx) * 4; for (let k = 0; k < 4; k++) dst.data[o + k] = src.data[s + k];
  }
  return dst;
}
