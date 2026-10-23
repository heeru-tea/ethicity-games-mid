// 그림 한 장 → 3D 모델(GLB), fal.ai 큐 API. 키는 publicness/.env의 FAL_KEY(커밋 금지, .gitignore).
//   node publicness/tools/fal-3d.mjs <입력 그림.png> <출력.glb> [엔드포인트=fal-ai/trellis]
// 버스: assets/models/bus-input.png(sheet-bus.png의 비스듬한 앞모습을 잘라 낸 것) → assets/models/bus-trellis.glb → tools/bus-model.mjs
// 요금이 나간다(2026-10-23 조회: trellis 0.02달러/회). 응답 JSON은 출력 옆 *-response.json으로 남긴다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [input, output, endpoint = 'fal-ai/trellis'] = process.argv.slice(2);
if (!input || !output) { console.error('사용법: node publicness/tools/fal-3d.mjs <입력.png> <출력.glb> [엔드포인트]'); process.exit(1); }
const env = fs.existsSync(path.join(PB, '.env')) ? fs.readFileSync(path.join(PB, '.env'), 'utf8') : '';
const key = (env.match(/^FAL_KEY=(.*)$/m) || [])[1]?.trim() || process.env.FAL_KEY;
if (!key) { console.error('FAL_KEY 없음: publicness/.env에 FAL_KEY=... 를 넣을 것'); process.exit(1); }

const H = { Authorization: 'Key ' + key, 'Content-Type': 'application/json' };
const image_url = 'data:image/png;base64,' + fs.readFileSync(input).toString('base64');
const sub = await (await fetch('https://queue.fal.run/' + endpoint, { method: 'POST', headers: H, body: JSON.stringify({ image_url }) })).json();
if (!sub.request_id) { console.error('요청 실패', JSON.stringify(sub).slice(0, 300)); process.exit(1); }
console.log('요청', sub.request_id);
const t0 = Date.now();
for (;;) {
  await new Promise((r) => setTimeout(r, 4000));
  const st = await (await fetch(sub.status_url, { headers: H })).json();
  if (st.status === 'COMPLETED') break;
  if (st.error || Date.now() - t0 > 600000) { console.error('실패/시간 초과', JSON.stringify(st).slice(0, 300)); process.exit(1); }
}
const res = await (await fetch(sub.response_url, { headers: H })).json();
fs.writeFileSync(output.replace(/\.glb$/, '') + '-response.json', JSON.stringify(res, null, 2));
const url = res.model_mesh?.url || res.model_glb?.url || res.model?.url;
if (!url) { console.error('결과에 모델 주소 없음', JSON.stringify(res).slice(0, 300)); process.exit(1); }
const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
fs.writeFileSync(output, buf);
console.log(`✓ ${output} ${Math.round(buf.length / 1024)}KB · ${Math.round((Date.now() - t0) / 1000)}초`);
