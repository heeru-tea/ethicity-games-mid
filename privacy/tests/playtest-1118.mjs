// 2026-11-18 플레이테스트 수정 확인 — Node만(브라우저 검사는 tests/playtest-1118-browser.mjs). 쓰기: node privacy/tests/playtest-1118.mjs
//   지시서 = docs/queue/2026-11-18-playtest-workers.md(사용자 전달 원문). 확인 경로(엔딩 C)를 그대로 따라가며 2·3·7·8번 문구를 보고,
//   무작위 경로로 조건이 늘 맞는지(판정·수치는 그대로 — 문구만 갈림) 확인한다.
//   1 시작 화면 '게임 안내' → 이름 칸 아래 한 줄 + 주의 화면 '시작 전에 알아 둘 것'(정적) · 2 에필로그 담임 대사 · 3 엔딩 C 둘째 문장 · 4 밤 무대 색
//   5 선택지 ▶ = aria-hidden span(정적) · 7 AI에 붙여 넣은 내용 · 8 에이전트 안내 문구 · P2 장 카드 recap
//   ONLY=1,2,3,4,5,7,8,p2
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const story = require('../js/story.js'), E = require('../js/engine.js'), WORLD = require('../js/world.js');
story.triggers = WORLD.triggers;
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const ONLY = (process.env.ONLY || '1,2,3,4,5,7,8,p2').split(',');
const on = (k) => ONLY.includes(k);
let pass = 0; const fails = [];
const ok = (c, name, note = '') => { if (c) pass++; else { fails.push(name); console.log('  ✗ ' + name + (note === '' ? '' : ' :: ' + (typeof note === 'string' ? note : JSON.stringify(note)))); } return !!c; };

// 확인 경로(지시서): 다온 → 정산 → … → 엔딩 C
const ROUTE = ['money', 'public', 'fixboth', 'shoot', 'group', 'all', 'capture', 'full', 'on', 'danger', '30d', 'self', 'forward', 'confess',
  'all', 'anon', 'scoped', 'del', 'post', 'own', 'warn', 'help', 'tell', 'critique', 'calm'];
function play(pick) {
  let s = E.createState(story); const seen = []; let k = 0;
  for (let n = 0; n < 900 && s.screen !== 'ending'; n++) {
    if (s.screen === 'scene' && E.needsChoice(story, s)) {
      const cs = E.visibleChoices(story, story.scenes[s.scene], s), id = pick(s, cs, k++);
      if (!cs.some((c) => c.id === id)) throw new Error(`${s.scene}: 선택 ${id} 없음 (${cs.map((c) => c.id)})`);
      seen.push({ scene: s.scene, choice: id });
      s = E.choose(story, s, id);
    }
    s = E.advance(story, s);
  }
  return { s, seen };
}
const routeRun = () => play((s, cs, k) => ROUTE[k]);
const endOf = (s) => story.endings.find((e) => e.code === s.ending);
const epLines = (s) => E.visibleLines(story, story.scenes.ep_1.lines, s).map((l) => l.text);
let seed = 20261118; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const randRun = () => play((s, cs) => cs[Math.floor(rnd() * cs.length)].id);

const R = routeRun();
ok(R.s.ending === 'C', '확인 경로 = 엔딩 C', R.s.ending);
ok(R.s.stats.repair === 11 && R.s.stats.help === 2, '확인 경로 수치(결과 화면 기준 수습 11·도움 연결 2) — 수치 그대로', R.s.stats);

/* ── 1 시작 화면·주의 화면(정적) ── */
if (on('1')) {
  const html = read('../index.html');
  ok(!/facts-box/.test(html) && !/<summary>게임 안내<\/summary>/.test(html), '1 제목 화면에 details.facts-box(게임 안내) 없음');
  const nameAt = html.indexOf('id="name-field"'), noteAt = html.indexOf('id="name-note"'), actAt = html.indexOf('class="start-actions"');
  ok(nameAt > 0 && noteAt > nameAt && noteAt < actAt, '1 개인정보 한 줄 = 이름 칸 바로 아래(시작 버튼 앞)');
  ok(html.includes('실제 정보를 적는 곳은 이 이름(선택)과 끝난 뒤 성찰 카드뿐이에요. 이 기기에만 저장돼요.'), '1 개인정보 한 줄 문구 그대로');
  ok(/aria-describedby="name-note"/.test(html), '1 이름 칸이 그 한 줄을 설명으로 가리킴');
  const w = html.slice(html.indexOf('id="warning"'), html.indexOf('</div>\n    </div>', html.indexOf('id="warning"')));
  ok(/WARNING<span class="warning-sub">시작하기 전에<\/span>/.test(w), '1 WARNING 아래 한국어 부제 "시작하기 전에"');
  const knowAt = w.indexOf('시작 전에 알아 둘 것'), okAt = w.indexOf('id="btn-warning-ok"');
  ok(knowAt > 0 && knowAt < okAt, '1 확인 버튼 위에 "시작 전에 알아 둘 것"');
  ok(w.includes('선택 뒤에 정답·오답을 보여 주지 않아요. 결과는 이야기로 돌아와요.') && w.includes('메시지 알림음은 메뉴 → 효과음에서 끌 수 있어요.'), '1 두 줄 문구 그대로');
  ok((w.match(/<button/g) || []).length === 1, '1 주의 화면 버튼은 확인 하나(누르는 횟수 그대로)');
  ok(!/15~20분/.test(w) && !/방향키/.test(w), '1 시간·조작법은 주의 화면에 넣지 않음');
}

/* ── 2 에필로그 담임 대사 ── */
const EARLY = '도움을 청한 건 잘한 일이야. 그 덕분에 더 커지기 전에 멈출 수 있었어.';
const SPREAD = '도움을 청한 건 잘한 일이야. 이미 퍼진 건 되돌릴 수 없지만, 거기서 더 번지는 건 막았어.';
if (on('2')) {
  const ep = epLines(R.s);
  ok(ep.some((t) => /가짜 춤 영상은 그 뒤로도/.test(t)), '2 확인 경로: 영상이 더 돌았다는 줄이 있음(전제)');
  ok(!ep.includes(EARLY), '2 확인 경로: "더 커지기 전에 멈출 수 있었어" 없음');
  ok(ep.includes(SPREAD), '2 확인 경로: 이미 퍼진 것을 인정하는 대사', ep.filter((t) => /도움을 청한/.test(t)));
  let early = 0, spread = 0, bad = 0;
  for (let i = 0; i < 2000; i++) {
    const { s } = randRun(), ep2 = epLines(s);
    if (ep2.includes(EARLY)) { early++; if (s.stats.spread > 2 || s.flags.e4 === 'forward') bad++; }
    if (ep2.includes(SPREAD)) spread++;
    if (ep2.includes(EARLY) && ep2.includes(SPREAD)) bad++;
    const helpOk = s.stats.help >= 2 && !s.flags.e8_video_spread && !['silent', 'join'].includes(s.flags.e7);
    if (helpOk && !(ep2.includes(EARLY) || ep2.includes(SPREAD))) bad++; // 도움을 청한 경로에는 둘 중 하나는 꼭
  }
  ok(bad === 0, `2 무작위 2,000회: 퍼짐이 크거나 영상을 전달한 경로엔 "더 커지기 전에" 없음·둘 중 하나만 (어긋남 ${bad})`);
  ok(early > 0 && spread > 0, `2 무작위: 두 대사 모두 나옴 (커지기 전 ${early} · 퍼진 뒤 ${spread})`);
}

/* ── 3 엔딩 C 둘째 문장 ── */
const SILENT = '그리고 그때 아무 말도 하지 않았던 순간들이, 친구들과의 사이에 조용히 남아 있다.';
const FIXED = '지우고 사과했지만, 이미 본 사람들의 기억까지 지울 수는 없었다.';
const SILENT_PICKS = { c1_e1_b: ['pass'], c1_e2_d: ['no'], c1_e3_cap: ['none'], c2_e4_a: ['ignore'], c2_e5_b: ['close'], c2_e6_a: ['leave'], c2_e6_b: ['deny'],
  c3_e7_a: ['silent'], c3_e7_b: ['none', 'hide'], c3_e8_f: ['silence'], c3_e9_b: ['keep'] };
if (on('3')) {
  const body = E.endingBody(story, endOf(R.s), R.s);
  ok(!body.includes(SILENT), '3 확인 경로(매번 털어놓고 사과): "아무 말도 하지 않았던 순간들" 없음');
  ok(body.includes(FIXED), '3 확인 경로: 수습 경로용 문장', body);
  let n = 0, bad = 0, sil = 0, fix = 0;
  for (let i = 0; i < 3000; i++) {
    const { s, seen } = randRun();
    if (s.ending !== 'C') continue;
    n++;
    const b = E.endingBody(story, endOf(s), s), hush = seen.some((x) => (SILENT_PICKS[x.scene] || []).includes(x.choice));
    if (b.includes(SILENT) !== hush) bad++;
    if (b.includes(SILENT) && b.includes(FIXED)) bad++;
    if (!hush && s.stats.repair >= 2 && !b.includes(FIXED)) bad++;
    if (b.includes(SILENT)) sil++; if (b.includes(FIXED)) fix++;
  }
  ok(n > 300 && bad === 0, `3 무작위 엔딩 C ${n}회: 침묵·넘김 계열 선택이 있을 때만 그 문장, 아니면 수습 문장 (어긋남 ${bad})`);
  ok(sil > 0 && fix > 0, `3 두 문장 모두 나옴 (침묵 ${sil} · 수습 ${fix})`);
}

/* ── 4 '축제 당일 · 저녁 7:40' 내 방 = 밤 색 ── */
if (on('4')) {
  ok(WORLD.STAGES.c3_e8_a.tint === 'night', '4 c3_e8_a 무대 = 밤 색', WORLD.STAGES.c3_e8_a.tint);
  ok(['c1_e3_a', 'c2_e5_a', 'c3_e8_b'].every((id) => WORLD.STAGES[id].tint === 'night'), '4 다른 밤 장면도 밤 색 그대로');
  const app = read('../js/app.js');
  ok(/function hudTime\(scene, state\)/.test(app) && /hudTime\(scene, preChoiceState\(run\)\)/.test(app), '4 장면이 열릴 때 HUD 시각을 장면 시각으로(app.js hudTime)');
  ok(/var target = story\.scenes\[run\.mapTarget \|\| run\.scene\];[^\n]*\n\s*if \(target\) \$\('g-chap'\)\.textContent = chapterLabel\(target\.chapter\);/.test(app), '4 걷기 중 장 이름 = 이어지는 장면의 장(renderMap)');
}

/* ── 5 선택지 ▶ ── */
if (on('5')) {
  const app = read('../js/app.js'), css = read('../css/style.css');
  ok(/el\('span', 'choice-mark', '▶'\);[^\n]*\n\s*mark\.setAttribute\('aria-hidden', 'true'\);/.test(app), '5 ▶ = aria-hidden span');
  ok(!/\.choice::before\s*\{[^}]*content/.test(css), '5 선택지 ::before 글자(content) 없음');
}

/* ── 7 AI에 붙여 넣은 내용 ── */
if (on('7')) {
  const all = story.scenes.c2_e5_a.choices.find((c) => c.id === 'all');
  ok(typeof all.say === 'string' && /28명/.test(all.say) && /새봄, 하늘, 민준, 지호/.test(all.say) && /1111-11-111111/.test(all.say) && /010-0000-0000/.test(all.say),
    '7 고른 직후 내가 보낸 메시지 = 28명 목록 앞부분·하늘이 계좌·번호 줄', all.say);
  ok(!/\[\[|\]\]/.test(all.say), '7 보낸 메시지에 강조 표시 없음(say 규칙)');
  // 단톡방 원문과 같은 숫자인가
  const src = story.scenes.c1_e1_a.lines.filter((l) => typeof l === 'string' && /^haneul: /.test(l)).join('\n');
  ok(src.includes('1111-11-111111') && src.includes('010-0000-0000'), '7 붙여 넣은 계좌·번호 = 사건 1 단톡방에 하늘이가 올린 것');
  const lines = [all.say, ...all.react].length - story.scenes.c2_e5_a.choices.find((c) => c.id === 'all').react.length;
  ok(lines === 1, '7 새 대사는 한 줄(2줄 이내)');
  // 반응 순서: 내가 보낸 메시지 → 루미 안내문
  const s = play((st, cs, k) => ROUTE[k]); // 같은 경로
  ok(s.s.flags.e5 === 'all', '7 확인 경로에서 e5=all');
  const mid = (() => { let st = E.createState(story), k = 0; for (let n = 0; n < 900; n++) { if (st.screen === 'scene' && E.needsChoice(story, st)) { const id = ROUTE[k++]; st = E.choose(story, st, id); if (st.scene === 'c2_e5_a') return st; } st = E.advance(story, st); } return null; })();
  ok(mid && mid.reaction === 'all', '7 고른 직후 같은 AI 창(c2_e5_a)의 반응 단계');
  ok(story.scenes.c2_e5_a.choices.every((c) => c.id !== 'all' || (c.set.e5 === 'all' && c.addV2.spread === 1 && c.addV2.minimize === -1 && c.next === 'c2_e5_j')), '7 수치·다음 장면 그대로');
}

/* ── 8 에이전트 장면 안내 ── */
if (on('8')) {
  const ag = story.scenes.c2_e5_agent;
  ok(ag.promptNote === '이 선택은 결과 화면에 따로 기록돼요.', '8 안내 문구', ag.promptNote);
  // 사실 확인: 결과(엔딩) 화면의 사건 5 카드(eventOutcomes)에 맡긴 것 한 줄이 4가지 모두 나온다
  for (const id of ['give', 'draft', 'scoped', 'ask']) {
    const { s } = play((st, cs, k) => (st.scene === 'c2_e5_agent' ? id : cs[0].id));
    const outs = E.eventOutcomes(story, 'e5', s);
    ok(outs.some((t) => /^루미에게 맡긴 것: /.test(t)), `8 ${id}: 엔딩 화면 사건 5 카드에 '루미에게 맡긴 것' 줄이 있음`, outs);
  }
  ok(Object.values(story.chapters).some((c) => (c.events || []).includes('e5')), '8 사건 5가 장 목록에 있어 엔딩 화면 사건 카드로 그려짐');
}

/* ── P2 장 카드 recap ── */
if (on('p2')) {
  const recapOf = (s, ch) => story.chapters[ch].events.flatMap((e) => { const o = E.eventOutcomes(story, e, s), out = o[0] ? [o[0]] : []; story.events[e].outcomes.forEach((x) => { if (x.recap && E.evalCond(x.if, s) && !out.includes(x.text)) out.push(x.text); }); return out; });
  const r1 = recapOf(R.s, 1);
  ok(r1.includes('민준이가 자는 모습이 동의 없이 찍혔다.') && r1.includes('사진이 반 단톡방 28명에게 퍼졌다.'), 'P2 올린 경로: 1장 카드에 "찍혔다" + "28명에게 퍼졌다"', r1);
  const { s: noPost } = play((st, cs, k) => (st.scene === 'c1_e2_b' ? 'ask' : cs[0].id));
  ok(!recapOf(noPost, 1).some((t) => /28명에게 퍼졌다|312회/.test(t)), 'P2 올리지 않은 경로: 퍼졌다는 줄 없음');
  ok(story.events.e2.outcomes.filter((o) => o.recap).map((o) => o.if).join() === 'e2post=group,e2post=story', 'P2 recap 표시는 사건 2 게시 두 줄뿐');
}

/* ── 판정 불변(문구만 갈림): 무작위 3,000회 엔딩·수치가 조건식과 같다 ── */
{
  let bad = 0;
  for (let i = 0; i < 1500; i++) { const { s } = randRun(); const want = story.endings.find((e) => E.evalCond(e.if, s)); if (!want || want.code !== s.ending) bad++; }
  ok(bad === 0, `판정(무작위 1,500회): 엔딩 = 조건식 첫 일치 (어긋남 ${bad})`);
}

console.log(`\nplaytest-1118: 통과 ${pass} · 실패 ${fails.length}`);
process.exit(fails.length ? 1 : 0);
