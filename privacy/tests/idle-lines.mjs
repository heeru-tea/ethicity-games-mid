// 요일·상황별 한마디(js/idle-lines.js) 정적 검사: node privacy/tests/idle-lines.mjs   (SAMPLES=무작위 완주 수, 기본 4000)
//   1) 걷기 구간마다 나오는 인물(목적지 인물 제외)은 그날 어떤 선택을 했든 2줄 이상
//   2) 줄 길이 40자 이하 · 강조 기호 [[ ]] 없음 · 훈계 말·실제 상표 이름 없음 · 'id: ' 꼴(다른 화자로 읽힘) 아님
//   3) 조건 줄은 있는 플래그만 쓰고, 실제로 켜지는 경우와 꺼지는 경우가 모두 있음 · 사이가 멀어진(trust<0) 친구는 그날 줄 대신 COLD_LINES
//   4) 차례 돌기: 같은 사람에게 n번까지는 새 줄(안내 없음), n+1번째 첫 되풀이(over 1), n+2번째(over 2) · 걷기 구간이 바뀌면 처음부터
import { createRequire } from 'node:module'; import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js'), IL = require('../js/idle-lines.js');
story.triggers = WORLD.triggers;
let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else fails.push(m); };

const MAX = 40;
const PREACH = ['잘못', '해야 해', '해야 돼', '조심', '개인정보', '동의', '허락', '함부로', '퍼뜨', '지켜야', '나쁜', '반성', '교훈', '올바른', '옳은', '책임', '신고'];
const BRANDS = ['카톡', '카카오', '인스타', '페북', '페이스북', '유튜브', '틱톡', '네이버', '구글', '당근', '쿠팡', '배민', '디스코드', '트위터', '스타벅스', 'GS25', 'CU', '세븐일레븐', '이마트', '롯데', '삼성', '아이폰', '갤럭시', '넷플릭스', '로블록스', '마인크래프트', '포켓몬', '메가커피', '편의점'];

// 1) 무작위 완주로 걷기 구간마다 그 순간 상태를 모은다
const SAMPLES = Number(process.env.SAMPLES || 4000);
let seed = 11;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const at = {}; // 걷기 id → [state]
for (let k = 0; k < SAMPLES; k++) {
  let s = E.createState(story);
  for (let step = 0; step < 600 && s.screen !== 'ending'; step++) {
    if (s.screen === 'map') { (at[s.mapTarget] = at[s.mapTarget] || []).push(JSON.parse(JSON.stringify({ flags: s.flags, stats: s.stats, trust: s.trust }))); }
    if (s.screen === 'scene' && E.needsChoice(story, s)) {
      const cs = E.visibleChoices(story, story.scenes[s.scene], s);
      s = E.choose(story, s, cs[Math.floor(rnd() * cs.length)].id); s.history = [];
    }
    s = E.advance(story, s);
  }
}
const condOf = (st) => (c) => E.evalCond(c, st);

for (const [id, trig] of Object.entries(WORLD.triggers)) {
  const states = at[id] || [];
  ok(states.length > 0, `${id}: 무작위 완주에서 이 걷기에 도착한 적 없음`);
  const whos = [...new Set(trig.cast.map((c) => c.who))].filter((w) => w !== (trig.target && trig.target.npc));
  for (const who of whos) {
    ok(!!(IL.WALKS[id] && IL.WALKS[id][who]), `${id} ${who}: 그날 줄이 없음`);
    let min = Infinity;
    for (const st of states) min = Math.min(min, IL.pool(id, who, condOf(st)).length);
    ok(min >= 2, `${id} ${who}: 어떤 선택에서는 줄이 ${min}개뿐(2개 이상이어야)`);
  }
  // 이 걷기에 없는 사람의 줄(위치 조정으로 빠졌는지) — 남은 줄은 안 쓰이니 알림
  for (const who of Object.keys(IL.WALKS[id] || {})) ok(whos.includes(who), `${id} ${who}: 이 걷기의 cast에 없는데 줄이 있음`);
}
for (const id of Object.keys(IL.WALKS)) ok(!!WORLD.triggers[id], `idle-lines의 ${id}: 그런 걷기 구간이 없음`);

// 2) 줄 모양
const allLines = [];
for (const [id, w] of Object.entries(IL.WALKS)) for (const [who, list] of Object.entries(w)) for (const l of list) allLines.push({ where: `${id} ${who}`, l: typeof l === 'string' ? { text: l } : l });
for (const [who, list] of Object.entries(IL.COLD_LINES)) for (const l of list) allLines.push({ where: `COLD ${who}`, l: { text: l } });
for (const { where, l } of allLines) {
  const t = l.text, len = [...t].length;
  ok(len <= MAX, `${where}: ${len}자 > ${MAX} "${t}"`);
  ok(!/\[\[|\]\]/.test(t), `${where}: 강조 기호 "${t}"`);
  ok(!/^\w+: /.test(t), `${where}: 'id: ' 꼴 "${t}"`);
  for (const w of PREACH) ok(!t.includes(w), `${where}: 훈계 말 '${w}' "${t}"`);
  for (const w of BRANDS) ok(!t.includes(w), `${where}: 상표 이름 '${w}' "${t}"`);
}
for (const [who, list] of Object.entries(IL.COLD_LINES)) ok(list.length >= 2, `COLD ${who}: 2줄 이상`);

// 3) 조건 줄: 있는 플래그만 · 켜짐/꺼짐 둘 다 있음
const known = new Set(['trust', ...Object.keys(story.stats || {})]);
for (const sc of Object.values(story.scenes)) for (const c of sc.choices || []) for (const k of Object.keys(c.set || {})) known.add(k);
const COMPUTED_OK = /^(hurt\.(minjun|saebom|jiho|haneul)|harmed_others|trust\.\w+)$/;
for (const [id, w] of Object.entries(IL.WALKS)) for (const [who, list] of Object.entries(w)) for (const l of list) {
  if (typeof l === 'string' || !l.if) continue;
  const atoms = l.if.split(/&&|\|\|/).map((a) => a.trim().replace(/^!/, '').split(/\s*(>=|<=|!=|=|>|<)\s*/)[0]);
  for (const a of atoms) ok(known.has(a) || COMPUTED_OK.test(a), `${id} ${who}: 조건의 '${a}'는 이야기에 없는 플래그 (${l.if})`);
  const states = at[id] || [];
  const on = states.filter((st) => E.evalCond(l.if, st)).length;
  ok(on > 0 && on < states.length, `${id} ${who}: 조건 '${l.if}'가 늘 ${on ? '참' : '거짓'} (${on}/${states.length})`);
}
// 사이가 멀어진 친구는 그날 줄을 쓰지 않는다 · 멀어지지 않았으면 COLD_LINES를 쓰지 않는다
for (const [id, w] of Object.entries(IL.WALKS)) for (const who of Object.keys(w)) {
  if (!IL.COLD[who]) continue;
  for (const st of at[id] || []) {
    const p = IL.pool(id, who, condOf(st)), cold = E.evalCond(IL.COLD[who], st);
    const isCold = p.every((t) => IL.COLD_LINES[who].includes(t));
    if (cold !== isCold) { ok(false, `${id} ${who}: trust ${st.trust[who]}인데 ${isCold ? '멀어진' : '그날'} 줄`); break; }
  }
}
// 이야기와 어긋나지 않게: 아래 줄은 그 일이 있었을 때만
const must = [
  ['c3_e9_a', 'minjun', '걱정했어', (st) => !!st.flags.alone_meet && !E.evalCond('hurt.minjun', st)], // 그 밤 '가지 마' 개인톡을 보낸 민준
  ['c3_e9_a', 'haneul', '단톡 보고', (st) => st.flags.e8 === 'crew'],
  ['c1_e1_a', 'saebom', '사진 담당', (st) => st.flags.role === 'photo']
];
for (const [id, who, frag, need] of must) {
  let shown = 0;
  for (const st of at[id] || []) {
    const has = IL.pool(id, who, condOf(st)).some((t) => t.includes(frag));
    if (has) { shown++; ok(need(st), `${id} ${who}: '${frag}' 줄이 맞지 않는 상태에서 나옴 ${JSON.stringify(st.flags)}`); }
  }
  ok(shown > 0, `${id} ${who}: '${frag}' 줄이 한 번도 안 나옴`);
}

// 4) 차례 돌기
{
  IL.reset();
  const yes = condOf(E.createState(story)), n = IL.pool('c1_e2_a', 'jiho', yes).length, got = [];
  for (let i = 0; i < n + 2; i++) got.push(IL.next('c1_e2_a', 'jiho', yes));
  ok(new Set(got.slice(0, n).map((g) => g.text)).size === n && got.slice(0, n).every((g) => g.over === 0), '처음 n번은 서로 다른 새 줄, 안내 없음');
  ok(got[n].over === 1 && got[n + 1].over === 2 && got[n].text === got[0].text, 'n+1번째 = 첫 줄 되풀이(over 1), n+2번째 over 2');
  const other = IL.next('c1_e2_a', 'saebom', yes);
  ok(other.i === 0, '다른 사람은 따로 센다');
  const nextDay = IL.next('c1_e3_a', 'saebom', yes);
  ok(nextDay.i === 0 && !IL.pool('c1_e2_a', 'saebom', yes).includes(nextDay.text), '걷기 구간(날·상황)이 바뀌면 다른 줄을 처음부터');
  ok(IL.next('nope', 'jiho', yes) === null, '줄 없는 걷기는 null(옛 방식)');
  // 날마다 다름: 같은 사람이 두 날 모두 나오면 그날 줄이 겹치지 않는다
  const byWho = {};
  for (const [id, w] of Object.entries(IL.WALKS)) for (const [who, list] of Object.entries(w)) for (const l of list) {
    const t = typeof l === 'string' ? l : l.text;
    ok(!(byWho[who] && byWho[who][t] && byWho[who][t] !== id), `${who}: "${t}"가 ${byWho[who] && byWho[who][t]}·${id} 두 곳에`);
    (byWho[who] = byWho[who] || {})[t] = id;
  }
  IL.reset();
}

const total = allLines.length;
if (fails.length) { console.error(fails.map((f) => 'FAIL ' + f).join('\n')); console.error(`idle-lines: ${pass} PASS, ${fails.length} FAIL`); process.exit(1); }
console.log(`idle-lines: ${pass} PASS (줄 ${total}개, 걷기 ${Object.keys(IL.WALKS).length}구간, 무작위 완주 ${SAMPLES}회)`);
