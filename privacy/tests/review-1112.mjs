// 2026-11-12 외부 검토(review.md) 8건을 고친 뒤의 확인 — Node만(브라우저 없음). 쓰기: node tests/review-1112.mjs
//   1 엔딩 A의 요약·본문이 실제 선택과 맞는가(판정은 그대로) · 2 저장·삭제 실패 뒤 최신 상태 읽기 · 3 성찰 카드에 올리기·수습·거절이 남는가
//   4 지호의 대화를 AI에 넣은 선택이 수치·엔딩 줄에 드러나는가 · 5 AI CCTV에서 고른 조건이 결과 칸에 남는가 · 8 난수가 되풀이되지 않는가
//   (6 시작 안내·이름 지우기, 7 주의 화면 Tab 은 화면 검사 tests/review-1112-browser.mjs)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const story = require('../js/story.js'), E = require('../js/engine.js'), Card = require('../js/card.js'), routes = require('./routes.js');
story.triggers = require('../js/world.js').triggers;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (extra === undefined ? '' : ' :: ' + JSON.stringify(extra))); } };

function play(prefs) {
  let s = E.createState(story);
  for (let n = 0; n < 800; n++) {
    if (s.screen === 'ending') return s;
    if (s.screen === 'scene' && E.needsChoice(story, s)) {
      const cs = E.visibleChoices(story, story.scenes[s.scene], s);
      s = E.choose(story, s, (cs.find((c) => c.id === prefs[s.scene]) || cs[0]).id);
    }
    s = E.advance(story, s);
  }
  throw new Error('not finished');
}
const base = Object.fromEntries(routes.A.map((p) => p.split('#')));
const run = (over) => play({ ...base, ...over });
const endOf = (s) => story.endings.find((e) => e.code === s.ending);
const text = (s) => [E.endingSummary(story, endOf(s), s), ...E.endingBody(story, endOf(s), s)].join(' / ');
const share = (s) => Card.topics(story, E, s)[0].items;
const photo = (s) => { const it = share(s), i = it.findIndex((x) => x.head === '잠든 친구 사진'); const out = []; for (let k = i; k < it.length && (k === i || it[k].head === ''); k++) out.push(it[k].text); return out; };

/* ── 1. 엔딩 A: 판정은 그대로, 말은 선택과 맞게 ── */
const clean = run({}), noDelete = run({ c1_e2_a: 'shoot', c1_e2_b: 'group', c1_e2_d: 'no' }), fixed = run({ c1_e2_a: 'ask', c1_e2_b: 'story', c1_e2_d: 'all' });
ok('대표 A 경로 = 엔딩 A', clean.ending === 'A', clean.ending);
ok('대표 A 경로: "매번 상대에게 물으며" 그대로', /매번 상대에게 물으며/.test(text(clean)) && /필요한 범위에서만 공유하고 대응했다\./.test(text(clean)), text(clean));
ok('삭제 거절 경로: 판정은 여전히 A(조건은 안 바꿈 — 사용자 판단 대기)', noDelete.ending === 'A', noDelete.ending);
ok('삭제 거절 경로: "매번 상대에게 물으며" 없음', !/매번 상대에게 물으며/.test(text(noDelete)), text(noDelete));
ok('삭제 거절 경로: "다른 사람이 퍼뜨린 정보" 없음(내가 퍼뜨린 일을 남 탓으로 돌리지 않음)', !/다른 사람이 퍼뜨린 정보/.test(text(noDelete)));
ok('삭제 거절 경로: 요약이 "그러지 못한 순간도 있었다"', /그러지 못한 순간도 있었다/.test(text(noDelete)));
ok('삭제 거절 경로: "지워 달라고 했는데도 사진을 내리지 않았고" 줄', /지워 달라고 했는데도 사진을 내리지 않았고/.test(text(noDelete)), text(noDelete));
ok('올리고 지운 경로: "지우고 사과했지만, 올린 사람은 나였고" 줄', /지우고 사과했지만, 올린 사람은 나였고/.test(text(fixed)) && !/지워 달라고 했는데도/.test(text(fixed)), text(fixed));
ok('세 경로의 엔딩 글이 서로 다름', new Set([text(clean), text(noDelete), text(fixed)]).size === 3);
ok('요약이 문자열인 엔딩(B·C·D)도 endingSummary가 그대로 돌려줌', story.endings.filter((e) => typeof e.summary === 'string').every((e) => E.endingSummary(story, e, clean) === e.summary));

/* ── 3. 성찰 카드: 찍기 / 올리기 / 지우기·거절이 남는다 ── */
ok('카드(안 올림): 찍기 허락 + 올라가지 않음', photo(clean).length === 2 && /허락/.test(photo(clean)[0]) && /올라가지 않았다/.test(photo(clean)[1]), photo(clean));
ok('카드(삭제 거절): 동의 없이 찍힘 + 단톡방 28명 + 삭제 요청을 넘김', photo(noDelete).length === 3 && /동의 없이/.test(photo(noDelete)[0]) && /28명/.test(photo(noDelete)[1]) && /삭제 요청을 넘겼고/.test(photo(noDelete)[2]), photo(noDelete));
ok('카드(올리고 지움): 스토리 게시 + 지우고 사과', photo(fixed).length === 3 && /스토리/.test(photo(fixed)[1]) && /지우고 사과/.test(photo(fixed)[2]), photo(fixed));
ok('세 경로의 카드 사진 줄이 서로 다름', new Set([photo(clean), photo(noDelete), photo(fixed)].map((x) => x.join('|'))).size === 3);
const capture = run({ c1_e3_b: 'capture' });
ok('카드(캡처 전달): 캡처 전달 + 그 뒤 대응 줄', share(capture).some((x) => /캡처가 새봄이에게/.test(x.text)) && share(capture).filter((x, i, a) => { const h = a.slice(0, i + 1).reverse().find((y) => y.head); return h && h.head === '털어놓은 고민'; }).length >= 2, share(capture).map((x) => x.head + ':' + x.text));
// 가장 긴 경우에도 '내가 공유한 순간'은 17줄을 넘지 않는다(pick 합)
const pickSum = Object.values(story.card.topics[0].pick).reduce((a, b) => a + b, 0);
let worst = 0;
{ const rnd = (() => { let a = 20261112; return () => { a = (a + 0x6D2B79F5) | 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  for (let n = 0; n < 3000; n++) {
    let s = E.createState(story);
    for (let k = 0; k < 800 && s.screen !== 'ending'; k++) { if (s.screen === 'scene' && E.needsChoice(story, s)) { const cs = E.visibleChoices(story, story.scenes[s.scene], s); s = E.choose(story, s, cs[Math.floor(rnd() * cs.length)].id); s.history = []; } s = E.advance(story, s); }
    worst = Math.max(worst, share(s).length);
  } }
ok('무작위 3000번: "내가 공유한 순간" 줄 수 ≤ pick 합(' + pickSum + ')', worst <= pickSum && worst >= 7, worst);

/* ── 4. 지호의 대화를 AI에 넣은 선택 ── */
const jiho = run({ c2_e5_a: 'jiho', c2_e5_b: 'close' }), all = run({ c2_e5_a: 'all', c2_e5_b: 'close' }), anon = run({ c2_e5_a: 'anon' }), min = run({ c2_e5_a: 'min' });
ok('지호 대화 입력: 필요 이상 공유 +1(단톡방 통째와 같음)', jiho.stats.spread === clean.stats.spread + 1 && all.stats.spread === clean.stats.spread + 1, [clean.stats.spread, jiho.stats.spread, all.stats.spread]);
ok('이름을 뺀 질문·부스 정보만: 공유 수치 그대로', anon.stats.spread === clean.stats.spread && min.stats.spread === clean.stats.spread, [anon.stats.spread, min.stats.spread]);
ok('지호 대화 입력: 엔딩 글에 그 일을 짚는 줄', /지호에게 묻지 않고 AI 도우미에 넣은 일/.test(text(jiho)), text(jiho));
ok('단톡방 통째 입력: 기존 줄 그대로', /28명의 이름과 하늘이의 전화번호·계좌번호/.test(text(all)));
ok('AI 입력을 인터넷 공개라고 말하지 않음', !/공개/.test(E.endingBody(story, endOf(jiho), jiho).filter((t) => /AI 도우미/.test(t)).join(' ')));

/* ── 5. AI CCTV: 고른 조건이 결과 칸에 남는다 ── */
const cctv = run({ sc_1: 'on', sc_2: 'safety', sc_3: '30d', sc_4: 'self' });
const rows = E.specialClassRows(story, cctv), row = (l) => (rows.find((r) => r.label === l) || {}).text || '';
ok('특별 수업을 한 경로(설치·30일·본인 요청)', cctv.flags.ccx === 'on' && cctv.flags.ccxKeep === '30d' && cctv.flags.ccxAccess === 'self', cctv.flags);
ok('보관 기간: "확인 중인 일의 영상은 그 일이 끝날 때까지" 예외가 남음', /30일 뒤 자동 삭제/.test(row('보관 기간')) && /확인 중인 일의 영상은 그 일이 끝날 때까지/.test(row('보관 기간')), row('보관 기간'));
ok('열람·삭제: "누가 봤는지 기록"이 남음', /누가 봤는지 기록/.test(row('열람·삭제')), row('열람·삭제'));
ok('성찰 카드의 CCTV 안에도 같은 문장', Card.topics(story, E, cctv)[2].items.some((x) => /그 일이 끝날 때까지/.test(x.text)) && Card.topics(story, E, cctv)[2].items.some((x) => /누가 봤는지 기록/.test(x.text)));
const noCctv = run({ sc_1: 'none' });
ok('설치하지 않는 경로: 고르지 않은 보관·열람 줄을 만들지 않음', E.specialClassRows(story, noCctv).length === 1, E.specialClassRows(story, noCctv));
const sc3 = story.scenes.sc_3.choices.find((c) => c.id === '30d'), sc4 = story.scenes.sc_4.choices.find((c) => c.id === 'self');
ok('칠판 문장에도 예외·기록이 들어감', /그 일이 끝날 때까지/.test(sc3.react.join(' ')) && /누가 봤는지 기록/.test(sc4.react.join(' ')));

/* ── 2. 저장소: 실패 뒤에도 이 탭의 최신 상태 ── */
function storage() {
  const st = { fail: null, data: {} };
  const localStorage = { getItem: (k) => (k in st.data ? st.data[k] : null), setItem: (k, v) => { if (st.fail === 'write') throw new Error('quota'); st.data[k] = v; }, removeItem: (k) => { if (st.fail === 'delete') throw new Error('denied'); delete st.data[k]; } };
  const ctx = { window: { localStorage } };
  vm.runInNewContext(fs.readFileSync(new URL('../js/storage.js', import.meta.url), 'utf8'), ctx);
  return { S: ctx.window.PrivacyStorage, st };
}
{ const { S, st } = storage(), K = S.KEYS.card;
  ok('정상 저장', S.writeJSON(K, { a: 'old' }) === true && S.readJSON(K).value.a === 'old' && !S.status.writeFailed);
  st.fail = 'write';
  ok('쓰기 실패: false를 돌려줌', S.writeJSON(K, { a: 'new' }) === false);
  ok('쓰기 실패 뒤 읽기 = 최신 값(new), 저장소에는 옛 값', S.readJSON(K).value.a === 'new' && JSON.parse(st.data[K]).a === 'old', [S.readJSON(K).value, st.data[K]]);
  ok('쓰기 실패 상태 표시', S.status.writeFailed === true);
  st.fail = null;
  ok('다시 저장되면 실패 표시가 풀림', S.writeJSON(K, { a: 'newer' }) === true && S.status.writeFailed === false && JSON.parse(st.data[K]).a === 'newer');
  st.fail = 'delete';
  ok('지우기 실패: false를 돌려줌', S.remove(K) === false);
  ok('지우기 실패 뒤 읽기 = 없음(이 탭에서는 지워짐), 저장소에는 남음', S.readJSON(K).value === null && K in st.data, [S.readJSON(K).value, st.data[K]]);
  ok('지우기 실패 상태 표시(쓰기 실패와 따로)', S.status.removeFailed === true && S.status.writeFailed === false);
  st.fail = null;
  ok('다시 지워지면 표시가 풀림', S.remove(K) === true && S.status.removeFailed === false && !(K in st.data));
  ok('지운 뒤 새로 쓰면 그 값이 읽힘', S.writeJSON(K, { a: 'fresh' }) === true && S.readJSON(K).value.a === 'fresh');
  st.fail = 'delete'; S.remove(K); st.fail = 'write';
  ok('지우기 실패 뒤 쓰기도 실패: 최신 값(메모리)이 읽힘', S.writeJSON(K, { a: 'mem' }) === false && S.readJSON(K).value.a === 'mem' && S.status.writeFailed === true && S.status.removeFailed === false);
}
{ // 저장소를 아예 못 쓰는 브라우저
  const ctx = { window: { get localStorage() { throw new Error('blocked'); } } };
  vm.runInNewContext(fs.readFileSync(new URL('../js/storage.js', import.meta.url), 'utf8'), ctx);
  const S = ctx.window.PrivacyStorage;
  ok('저장소 차단: 메모리로 쓰고 읽고 지움', S.status.available === false && S.writeJSON(S.KEYS.card, { a: 1 }) === false && S.readJSON(S.KEYS.card).value.a === 1 && S.remove(S.KEYS.card) === true && S.readJSON(S.KEYS.card).value === null);
}

/* ── 8. 난수 ── */
for (const f of ['tests/check-story.mjs', 'tools/sim-endings.mjs', 'tools/ending-v2-report.mjs']) {
  const src = fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  ok(f + ': 옛 난수식이 없음', !src.includes('% 2147483648) / 2147483648') && src.includes('mulberry32'));
}
{ const mulberry32 = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r = mulberry32(20261017), seen = new Set(); let dup = false, lo = 1, hi = 0, sum = 0;
  for (let i = 0; i < 2000000; i++) { const v = r(); if (i < 200000) { const key = Math.round(v * 4294967296); if (seen.has(key)) dup = true; seen.add(key); } lo = Math.min(lo, v); hi = Math.max(hi, v); sum += v; }
  ok('새 난수: 20만 개 안에 되풀이 주기 없음(같은 값이 나와도 줄 전체가 되풀이되지 않음)', (() => { const a = mulberry32(20261017), first = []; for (let i = 0; i < 16; i++) first.push(a()); const b = mulberry32(20261017); const buf = []; for (let i = 0; i < 300000; i++) { buf.push(b()); if (buf.length > 16) buf.shift(); if (i >= 16 && buf.every((x, k) => x === first[k])) return false; } return true; })(), dup);
  ok('새 난수: 0 이상 1 미만, 평균 0.5 근처', lo >= 0 && hi < 1 && Math.abs(sum / 2000000 - 0.5) < 0.002, [lo, hi, sum / 2000000]);
}

console.log(`review-1112: 통과 ${pass} · 실패 ${fail}`);
process.exitCode = fail ? 1 : 0;
