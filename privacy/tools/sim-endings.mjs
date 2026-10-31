// 엔딩 밸런스 몬테카를로: node privacy/tools/sim-endings.mjs [N=5000] [시간상한ms=20000]
//   PrivacyEngine(createState·needsChoice·visibleChoices·choose·advance·resolveEnding)을 그대로 써서 무작위 완주.
//   출력: 엔딩별 비율 · 예외 난 장면 · 도달 못 한 장면 · 대표 경로 2개(가장 신중한 선택 / 나쁜 선택 뒤 수습)의 엔딩과 수치.
//   CONDS='{"B":"repair+help>=3 && spread<=3"}' 로 엔딩 조건을 바꿔 미리 볼 수 있다(파일은 안 바뀜).
// 전체 경로 DFS는 경우의 수가 수억이라 쓰지 않는다(브라우저 탭이 멈춘 적 있음).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const story = require('../js/story.js');
const E = require('../js/engine.js');
const WORLD = require('../js/world.js');
story.triggers = WORLD.triggers; // 앱과 같은 연결(트리거 장면 앞 맵 단계)

const N = Number(process.argv[2] || 5000), LIMIT = Number(process.argv[3] || 20000);
const over = process.env.CONDS ? JSON.parse(process.env.CONDS) : {};
story.endings.forEach((e) => { if (over[e.code] !== undefined) e.if = over[e.code]; });

let seed = 20261031;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

function play(pick) {
  let s = E.createState(story);
  for (let step = 0; s.screen !== 'ending'; step++) {
    if (step > 400) throw new Error('무한 루프 의심 @' + s.scene);
    if (s.screen === 'scene' && E.needsChoice(story, s)) {
      const cs = E.visibleChoices(story, story.scenes[s.scene], s);
      if (!cs.length) throw new Error('보이는 선택지 없음 @' + s.scene);
      const c = pick(s, cs);
      s = E.choose(story, s, c.id); s.history = [];
    }
    seen.add(s.scene);
    s = E.advance(story, s);
  }
  return s;
}

const seen = new Set(), count = {}, errors = {};
const t0 = Date.now();
let done = 0;
for (; done < N && Date.now() - t0 < LIMIT; done++) {
  try {
    const s = play((st, cs) => cs[Math.floor(rnd() * cs.length)]);
    const end = E.resolveEnding(story, s).code;
    count[end] = (count[end] || 0) + 1;
  } catch (e) { errors[e.message] = (errors[e.message] || 0) + 1; }
}

// 대표 경로: 장면마다 고를 선택지 id 우선순위(앞에서부터 보이는 것)
function route(prefs) {
  const s = play((st, cs) => {
    const want = prefs[st.scene] || [];
    return cs.find((c) => want.includes(c.id)) || cs[0];
  });
  return { end: E.resolveEnding(story, s).code, stats: s.stats };
}
const CAREFUL = {
  c1_e1_a: ['propose'], c1_e1_b: ['fix'], c1_e2_a: ['no'], c1_e3_b: ['ask'],
  c2_e4_a: ['refuse'], c2_e4_b: ['ask'], c2_e5_a: ['min'], c2_e5_b: ['check'], c2_e6_a: ['logout'],
  c3_e7_a: ['stop'], c3_e7_b: ['help'], c3_e8_a: ['tell'], c3_e9_a: ['ask'], c3_e9_b: ['calm']
};
// 지시서의 "나쁜 선택 후 수습": 계좌 공개 · 몰래 촬영 · 캡처 전달 · DM 엿보기 · 정문 싸움, 그 뒤 수습은 다 한다
const BAD_THEN_REPAIR = {
  c1_e1_a: ['public'], c1_e1_b: ['fixboth'], c1_e2_a: ['shoot'], c1_e2_b: ['group'], c1_e2_d: ['all'],
  c1_e3_b: ['capture'], c1_e3_cap: ['full'], c2_e4_a: ['refuse'], c2_e4_b: ['report'], c2_e5_a: ['min'], c2_e5_b: ['check'],
  c2_e6_a: ['peek'], c2_e6_b: ['stop'], c3_e7_a: ['stop'], c3_e7_b: ['help'], c3_e7_small: ['help'],
  c3_e8_a: ['meet'], c3_e8_b: ['go'], c3_e8_c: ['fight'], c3_e8_f: ['support'], c3_e9_a: ['report'], c3_e9_b: ['calm']
};

const pct = (k) => ((count[k] || 0) / Math.max(1, done - Object.values(errors).reduce((a, b) => a + b, 0)) * 100).toFixed(1);
console.log(`무작위 완주 ${done}회 (${Date.now() - t0}ms${done < N ? ', 시간 상한으로 멈춤' : ''})`);
console.log('엔딩 분포: ' + story.endings.map((e) => `${e.code} ${pct(e.code)}%`).join(' · '));
console.log('엔딩 조건: ' + story.endings.map((e) => `${e.code}[${e.if || '기본'}]`).join(' '));
console.log('예외: ' + (Object.keys(errors).length ? JSON.stringify(errors) : '0건'));
const unreached = Object.keys(story.scenes).filter((k) => !seen.has(k));
console.log('도달 못 한 장면: ' + (unreached.length ? unreached.join(', ') : '없음'));
for (const [name, r] of [['가장 신중한 선택만', CAREFUL], ['나쁜 선택 후 수습', BAD_THEN_REPAIR]]) {
  const x = route(r);
  console.log(`${name} → 엔딩 ${x.end} ${JSON.stringify(x.stats)}`);
}
if (process.env.JSON) console.log(JSON.stringify(Object.fromEntries(story.endings.map((e) => [e.code, Number(pct(e.code))]))));
