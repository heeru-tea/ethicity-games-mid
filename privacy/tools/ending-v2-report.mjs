// 엔딩 판정 v2 보고(2026-11-09 교사 지시서 Phase A): node privacy/tools/ending-v2-report.mjs [N=20000]
//   ① 선택을 무작위로 고른 완주 N회(전체 경로 탐색 안 함)로 A/B/C/D 분포를 ENDING_V2 false/true 각각 — 60% 초과·5% 미만은 ⚠
//   ② 대표 경로 3개(모범 / 섞은 = 지시서 재현 경로 / 위험)의 엔딩·수치·본문(선택별 한 줄 포함)·안전 지표 두 줄
//   ③ seriousSplit 검사: 무작위 완주마다 '두 줄 합 − e8 crew 중복' = serious 인지(새 serious 선택이 생기면 여기서 잡힌다)
// 같은 프로세스에서 story.endingV2만 바꿔 가며 돈다(engine이 실행 때마다 읽음).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const story = require('../js/story.js');
const E = require('../js/engine.js');
const WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;

const N = Number(process.argv[2] || 20000);
// 2026-11-12 외부 검토 8번: 예전 식 (seed * 1103515245 + 12345) % 2^31 은 곱이 2^53을 넘어 값이 뭉개지고 10,466번마다 되풀이됐다 → 32비트 연산(mulberry32).
//   SEED=숫자 로 씨앗을 바꿔 다시 돌려 볼 수 있다(엔딩 비율이 씨앗에 따라 얼마나 흔들리는지 확인용)
const mulberry32 = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const SEED = Number(process.env.SEED || 20261109);
const rnd = mulberry32(SEED);
const rndSc = mulberry32(7); // 특별 수업(sc_*) 선택 전용 — 엔딩과 무관한 선택이 다른 장면의 표본 순서를 밀지 않게(2026-11-10)

function play(pick) {
  let s = E.createState(story);
  for (let step = 0; s.screen !== 'ending'; step++) {
    if (step > 400) throw new Error('무한 루프 의심 @' + s.scene);
    if (s.screen === 'scene' && E.needsChoice(story, s)) {
      const cs = E.visibleChoices(story, story.scenes[s.scene], s);
      s = E.choose(story, s, pick(s, cs).id); s.history = [];
    }
    s = E.advance(story, s);
  }
  return s;
}

const out = [];
const log = (t = '') => { out.push(t); console.log(t); };
const pct = (n) => (n / N * 100).toFixed(1);
let splitErr = 0;
for (const v2 of [false, true]) {
  story.endingV2 = v2; seed = 20261109;
  const count = {};
  for (let i = 0; i < N; i++) {
    const s = play((st, cs) => cs[Math.floor((/^sc_/.test(st.scene) ? rndSc() : rnd()) * cs.length)]);
    count[s.ending] = (count[s.ending] || 0) + 1;
    if (v2) {
      const sp = E.seriousSplit(story, s), dup = E.evalCond('e8=crew', s) ? 1 : 0;
      if (sp[0].value + sp[1].value - dup !== s.stats.serious) splitErr++;
    }
  }
  const row = story.endings.map((e) => `${e.code} ${pct(count[e.code] || 0)}%`).join(' · ');
  const warn = story.endings.filter((e) => { const p = (count[e.code] || 0) / N * 100; return p > 60 || p < 5; })
    .map((e) => `⚠ 엔딩 ${e.code} ${pct(count[e.code] || 0)}% (${(count[e.code] || 0) / N * 100 > 60 ? '60% 초과' : '5% 미만'})`);
  log(`ENDING_V2=${v2} · 무작위 ${N.toLocaleString()}회: ${row}${warn.length ? '  ' + warn.join(' ') : ''}`);
}
log(`seriousSplit 합 검사(ENDING_V2=true, ${N.toLocaleString()}회): ${splitErr ? '✗ 어긋남 ' + splitErr + '회' : '✓ 모두 일치'}`);

const ROUTES = {
  '모범 선택': { pro_1: ['photo'], c1_e1_a: ['propose'], c1_e1_b: ['fix'], c1_e2_a: ['ask'], c1_e2_b: ['keep', 'ask'], c1_e3_b: ['ask'],
    c2_e4_a: ['refuse'], c2_e4_b: ['ask'], c2_e5_a: ['min'], c2_e5_b: ['check'], c2_e6_a: ['logout'],
    c3_e7_a: ['stop'], c3_e7_small: ['help'], c3_e7_b: ['help'], c3_e8_a: ['tell'], c3_e9_a: ['ask'], c3_e9_b: ['calm'] },
  // 지시서 Phase A 재현 경로: 1장 개인톡 제안·번호 넘어감·안 찍음·지호에게 물음 / 2장 합성 거절·새봄 위로·AI 통째·별일 없겠지·계정 장난→자백 / 3장 신고·보호자
  '섞은 선택(재현 경로)': { pro_1: ['photo'], c1_e1_a: ['propose'], c1_e1_b: ['pass'], c1_e2_a: ['no'], c1_e3_b: ['ask'],
    c2_e4_a: ['refuse'], c2_e4_b: ['ask'], c2_e5_a: ['all'], c2_e5_b: ['close'], c2_e6_a: ['post'], c2_e6_b: ['own'],
    c3_e7_a: ['stop'], c3_e7_small: ['help'], c3_e7_b: ['help'], c3_e8_a: ['tell'], c3_e9_a: ['report'], c3_e9_b: ['calm'] },
  '위험 선택': { pro_1: ['sns'], c1_e1_a: ['public'], c1_e1_b: ['pass'], c1_e2_a: ['shoot'], c1_e2_b: ['story'], c1_e2_d: ['no'], c1_e3_b: ['capture'], c1_e3_cap: ['none'],
    c2_e4_a: ['forward'], c2_e4_b: ['blame'], c2_e5_a: ['all'], c2_e5_b: ['close'], c2_e6_a: ['post'], c2_e6_b: ['deny'],
    c3_e7_a: ['join'], c3_e7_b: ['hide'], c3_e8_a: ['meet'], c3_e8_b: ['go'], c3_e8_c: ['fight'], c3_e8_f: ['expose'], c3_e8_g: ['keep'], c3_e8_i: ['fine'], c3_e9_a: ['share'], c3_e9_b: ['keep'] }
};
for (const [name, prefs] of Object.entries(ROUTES)) {
  log(''); log(`■ ${name}`);
  for (const v2 of [false, true]) {
    story.endingV2 = v2;
    const picks = [];
    const s = play((st, cs) => { const c = cs.find((x) => (prefs[st.scene] || []).includes(x.id)) || cs[0]; picks.push(st.scene + '#' + c.id); return c; });
    const end = story.endings.find((e) => e.code === s.ending);
    log(`  ENDING_V2=${v2} → 엔딩 ${end.code} 「${end.title}」 · ${Object.entries(s.stats).map(([k, v]) => k + ' ' + v).join(', ')}`);
    const sp = E.seriousSplit(story, s);
    if (sp) log('    안전 지표: ' + sp.map((r) => `${r.label} ${r.value}`).join(' / '));
    E.endingBody(story, end, s).forEach((t) => log('    · ' + t));
    if (v2) log('    경로: ' + picks.join(' > '));
  }
}
story.endingV2 = true;
