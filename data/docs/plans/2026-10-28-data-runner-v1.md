# 데이터 러너 첫 버전(튜토리얼 + 1 임무) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 팀원이 `data` 브랜치에서 `data/index.html`을 더블클릭해 튜토리얼 → 1 임무(침수 판별 AI) 전체 흐름을 끝까지 플레이할 수 있는 3D 3레인 러너를 만든다.

**Architecture:** 빌드 없는 바닐라 JS, 클래식 `<script>`, 전역 `DR`. 판정·코스 생성·잡기 규칙은 DOM/three.js와 무관한 순수 모듈(UMD 꼬리: `root.DR.X = api; if (module) module.exports = api`)로 만들어 `node --test`로 검증하고, 3D 달리기(three.js r149)·화면·흐름은 Playwright가 `file://`로 연 페이지에서 검증한다. 임무 내용(장면·조합·카드 수·대사)은 `data/missions/*.js` 데이터 파일에만 둔다.

**Tech Stack:** Vanilla JS(ES2017, 클래식 스크립트), three.js r149(`publicness/vendor/three.min.js` 복사), Canvas 2D(카드 그림), Web Audio(효과음), Node 22 `node:test`, Playwright(msedge, `PLAYWRIGHT_MODULE=D:/Works/token_economy/node_modules/playwright`).

**Spec:** `data/docs/specs/2026-10-27-data-runner-v1-design.md` (원 기획서 `data/data-runner-plan.md` — 무엇을 만드는지는 기획서가 기준, 둘이 다르면 spec이 우선)

## Global Constraints

- 작업 위치: 워크트리 `D:\Works\ethicity-games-mid-data`, 브랜치 `data`, push 대상 `origin data`. 모든 경로는 레포 루트 기준.
- `data/index.html`을 **`file://`로 열어도** 동작: fetch·ES 모듈·외부 이미지/폰트/소리 파일·네트워크 없음. 그림은 Canvas로 생성.
- 클래식 스크립트 + 전역 네임스페이스 `DR`. 순수 모듈은 공공성 편과 같은 UMD 꼬리(`(function(root){...})(typeof window!=='undefined'?window:globalThis)`).
- 결과 화면에 **숫자 정확도(%) 없음**. 결과 문구는 "우리가 넣은 데이터에는 ○○가 없었다" 형식 — AI 탓·플레이어 탓 문구 금지.
- 달리기 중 **균형 게이지·실시간 균형 알림 없음**. HUD는 가방 칸 수(예: `12/30`)와 남은 거리 막대만.
- **퍼펙트는 점수·순위·판정에 영향 없음**(연출과 효과음만).
- 검수 장면별 요약에 충족/미충족 표시 없음.
- 지하차도 장면 금지. 실제 재난 사진 금지. 생성형 AI 이미지 사용 안 함.
- 손맛·판정 수치는 전부 `data/js/config.js`의 `DR.config` 한 곳(초기값은 아래 Task 1 표).
- 키보드(←/→, A/D, Space)와 터치(좌우 스와이프, 탭) 모두. 가로·세로 화면 모두. `prefers-reduced-motion`이면 화면 흔들림·속도선 끔.
- 인물 이름은 기획서 가칭(나·동기·감독관·안내 AI·수거봇·선배). 안내 AI와 복구 대상 AI는 다른 모양.
- 공통 패키지 `shared/`는 쓰지 않는다. `publicness/`·`privacy/`는 건드리지 않는다.
- 코드 주석·UI 문구는 한국어. 커밋 메시지 `feat(data): …` 형식, 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **달리는 중 창 크기·방향 변경**(태블릿 회전, 창 크기 조절) → 렌더러가 새 크기에 맞고 달리기는 이어진다. → Task 6 테스트 `resize mid-run`.
2. **탭 전환·창 포커스 잃음 뒤 복귀**(수업 중 다른 창) → 큰 프레임 간격으로 카드 여러 장을 건너뛰지 않는다(프레임 dt 상한). → Task 6 테스트 `dt clamp`.
3. **Space를 누르고 있기·연타** → 키 반복으로 카드가 줄줄이 잡히지 않는다(누름 한 번 = 잡기 시도 한 번). → Task 6 테스트 `key repeat ignored`.
4. **"?" 카드를 분류하지 않은 채 제출** → 넣지 않은 것으로 처리되고, 제출 전 검수 화면에 "아직 정하지 않은 카드" 안내가 보인다. 크래시 없음. → Task 8 테스트 `undecided ambiguous`.
5. **보충 준비에서 가방이 꽉 찬 상태** → 정해진 칸 수를 비우기 전엔 출발 버튼이 비활성, 비우면 활성. "?" 카드도 뺄 수 있다. → Task 8 테스트 `supplement needs free slots`.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `data/index.html` | 스크립트 로드 순서, 화면 컨테이너(`#screen-*`), HUD |
| `data/css/style.css` | 네온 데이터 세계 토큰·화면 레이아웃 |
| `data/vendor/three.min.js`, `THREE_LICENSE` | publicness에서 복사(r149) |
| `data/js/config.js` | `DR.config` 조정값 |
| `data/js/rng.js` | `DR.Rng.create(seed)` → `{next()}` (publicness/js/rng.js와 같은 xorshift32) |
| `data/missions/cast.js` | `DR.Cast` 인물 표 |
| `data/missions/tutorial.js`, `data/missions/m1.js` | `DR.Missions.tutorial`, `DR.Missions.m1` |
| `data/js/judge.js` | `DR.Judge` 순수 판정 |
| `data/js/stream.js` | `DR.Stream` 순수 코스 생성 |
| `data/js/catch.js` | `DR.Catch` 순수 잡기 규칙 |
| `data/js/input.js` | `DR.Input` 스와이프/탭 분류(순수) + 키·터치 바인딩 |
| `data/js/cardart.js` | `DR.CardArt` Canvas 카드·단서·장면 그림, 픽셀화, 설명표 아이콘 |
| `data/js/sfx.js` | `DR.Sfx` Web Audio 합성 효과음, 음소거 |
| `data/js/run3d.js` | `DR.Run` three.js 달리기 장면·루프 |
| `data/js/ui-story.js` | `DR.UI.dialogue`, `DR.UI.briefing`, `DR.UI.outro` |
| `data/js/ui-inspect.js` | `DR.UI.inspect`, `DR.UI.supervisor`, `DR.UI.supplementPrep` |
| `data/js/ui-result.js` | `DR.UI.result` |
| `data/js/app.js` | `DR.App` 흐름 상태 기계 |
| `data/tests/*.test.mjs` | 순수 모듈 단위 테스트 |
| `data/tests/browser.mjs` | 공용: msedge 실행 + `file://` 열기 헬퍼 |
| `data/tests/*-browser.mjs` | 브라우저 테스트 |
| `data/CLAUDE.md`, `data/README.md` | 인수인계·실행법 |

공통 명령(레포 루트에서):
- 단위: `node --test data/tests/`
- 브라우저 하나: `PLAYWRIGHT_MODULE=D:/Works/token_economy/node_modules/playwright node data/tests/<name>-browser.mjs` → 마지막 줄 `PASS <name>`

---

### Task 1: 뼈대 · 조정값 · 임무 데이터

**Files:**
- Create: `data/index.html`, `data/css/style.css`, `data/vendor/three.min.js`, `data/vendor/THREE_LICENSE`, `data/js/config.js`, `data/js/rng.js`, `data/missions/cast.js`, `data/missions/tutorial.js`, `data/missions/m1.js`, `data/tests/browser.mjs`
- Test: `data/tests/missions.test.mjs`, `data/tests/boot-browser.mjs`

**Interfaces:**
- Produces:
  - `DR.config` (아래 초기값 표 그대로의 키)
  - `DR.Rng.create(seed:number) → {next():number in [0,1)}`
  - `DR.Cast = {runner, peer, supervisor, guide, bot, senior, examiner}` 각 `{name:string, color:string, shape:'circle'|'square'|'diamond'|'hex'|'bot'}`
  - 임무 스키마(아래). `DR.Missions.tutorial`, `DR.Missions.m1`.
  - `data/tests/browser.mjs`: `export async function openGame(opts={viewport:{width:1366,height:900}}) → {browser, page, errors:string[]}` — msedge headless, args `['--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files']`, `page.goto(pathToFileURL('data/index.html') + (opts.query||''))`, `pageerror`를 `errors`에 모음.

`DR.config` 초기값(spec §4·기획서 초기값):

| 키 | 값 | 뜻 |
|---|---|---|
| `baseSpeed` | 16 | m/s, 코스 z 좌표 기준 속도 |
| `speedRamp` | 0.25 | 코스 끝까지 최대 +25% |
| `laneWidth` | 2.4 | m |
| `catchLead` | 0.7 | s, 판정 구간 시작(닿기 전) |
| `perfectWindow` | 0.08 | s, 닿는 순간 ± |
| `grabBuffer` | 0.15 | s, 잡기 입력 유지 시간 |
| `wallSlow` | {factor:0.5, seconds:1} | 충돌 감속 |
| `rareWallGap` | 6 | m, 드문 카드 앞 벽까지 최대 거리 |
| `swipeMin` | 30 | px |
| `maxDt` | 0.05 | s, 프레임 dt 상한 |
| `ambiguousWeight` | 2 | 올바른 "?" 카드 가중 |
| `maxSupplements` | 2 | 보충 최대 횟수 |
| `supplementFreeSlots` | 6 | 보충 출발 전 비워야 할 칸 |
| `randomSeed` | false | true면 시작마다 시드 변경 |

임무 스키마(m1 예):
```js
DR.Missions.m1 = {
  id: 'm1', title: '침수 판별 AI', bag: 30, runSeconds: 180, supplementSeconds: 30, seed: 1101,
  labelOptions: [ {id:'flood_deep',text:'침수(깊음)'}, {id:'flood_shallow',text:'침수(얕음)'},
                  {id:'wet',text:'정상(젖음)'}, {id:'dry',text:'정상(마름)'} ],
  cardTypes: {               // key → 그림·아이콘·진짜 값
    day_deep:     {icons:['day','flood_deep'],    art:{place:'alley', time:'day', water:'deep'}},
    day_shallow:  {icons:['day','flood_shallow'], art:{...}},
    day_wet:      {icons:['day','wet']}, day_dry: {icons:['day','dry']},
    night_wet:    {icons:['night','wet']},
    night_neon:   {icons:['night','wet'], rare:true},          // 일반 경계 카드
    night_deep:   {icons:['night','flood_deep'], rare:true},
    night_shallow:{icons:['night','flood_shallow'], rare:true},
    night_muddy:  {icons:['night','flood_shallow'], rare:true} // 일반 경계 카드
  },
  ambiguous: [               // "?" 카드 — 흐름에 각 1장
    {id:'q_neon',  truthKey:'night_neon',  correctLabel:'wet',           icons:['night','unknown'],
     clues:[{type:'usual_photo'},{type:'sensor',text:'근처 수위 센서: 0 cm'}]},
    {id:'q_muddy', truthKey:'night_muddy', correctLabel:'flood_shallow', icons:['night','unknown'],
     clues:[{type:'sensor',text:'수위 센서: 9 cm'},{type:'wheel',text:'바퀴 아래쪽이 잠김'}]},
    {id:'q_clean', truthKey:'day_wet',     correctLabel:'wet',           icons:['day','unknown'],
     clues:[{type:'time',text:'촬영 10:12'},{type:'log',text:'청소차 운행 기록: 10:05 통과'}]}
  ],
  counts: { day_deep:22, day_shallow:18, day_wet:6, day_dry:6, night_wet:9,
            night_neon:3, night_deep:3, night_shallow:3, night_muddy:3 },
  scenes: [
    {id:'S1', title:'낮 주택가 골목 침수', emphasis:'normal', combos:[
      {id:'S1_day_deep', keys:['day_deep'], need:2, danger:true, missingLine:'…'},
      {id:'S1_day_shallow', keys:['day_shallow'], need:2, danger:true, missingLine:'…'}],
     passLine:'…', cuts:{danger:'…', inconvenience:'…'}},
    // S2: S2_day_wet[day_wet] / S2_day_dry[day_dry]            (danger:false 둘 다)
    // S3: S3_night_wet[night_wet] / S3_night_neon[night_neon](boundary) / S3_night_deep[night_deep](danger)
    // S4: emphasis:'low' — S4_night_shallow[night_shallow](danger) / S4_night_muddy[night_muddy](boundary, danger) / S4_night_wet[night_wet]
  ],
  story: { intro:[{who:'bot',text:'침수 사진 3,000장 확보!'}, …], supervisorQuestion:'브리핑 장면 네 개, 하나씩 다 떠올려 봤어?',
           senior:[{who:'senior',text:'첫날치고 나쁘지 않네. 근데 AI 너무 믿지는 마. AI는 네가 준 것 이상은 절대 몰라.'}],
           guideBrief:'이 AI는 비 오는 날 밤에도 침수 도로와 젖은 도로를 구별해야 합니다.' }
};
```
- `danger:true` = 침수 조합(빠지면 침수를 안전으로 통과시키는 위험), `danger:false` = 정상 조합. `boundary:true`는 S3_night_neon·S4_night_muddy.
- `missingLine` 예(S4_night_shallow): `'우리가 넣은 데이터에는 물에 살짝 잠긴 밤 도로가 거의 없었다.'` — 나머지는 같은 형식으로 작성.
- 튜토리얼: `id:'tutorial'`, `bag:10`, `runSeconds:90`, `labelOptions:[]`, `ambiguous:[]`, `cardTypes:{dog:{icons:['dog']}, cat:{icons:['cat']}}`, `counts:{dog:9, cat:9}`(`seed:7`), `scenes:[{id:'T1', title:'보호소 입양 안내', combos:[{id:'T1_dog',keys:['dog'],need:3,danger:false}, {id:'T1_cat',keys:['cat'],need:3,danger:false}]}]`, `story.fail` = AI가 강아지를 보고 "고양이!"라고 외치는 귀여운 실패 문구, `story.outro` = 시험관(`examiner`) "달리기 기록은 최고. 데이터 판단은… 아직."
- 인물 대사는 기획서 §6·§7.1 문장을 그대로 쓰고 빈 곳은 짧게 채운다(밝게, 꾸짖지 않게).

- [ ] **Step 1: 실패하는 테스트 작성** — `data/tests/missions.test.mjs`(`require('../js/config.js')`, `require('../missions/m1.js')` 등)

```js
test('m1 combos reference existing card keys', () => { for (const s of m1.scenes) for (const c of s.combos) for (const k of c.keys) assert.ok(m1.cardTypes[k], k); });
test('m1 scenes match the plan', () => {
  assert.deepEqual(m1.scenes.map(s=>s.id), ['S1','S2','S3','S4']);
  assert.equal(m1.scenes.find(s=>s.id==='S4').emphasis, 'low');
  assert.deepEqual(m1.scenes.flatMap(s=>s.combos).filter(c=>c.boundary).map(c=>c.id).sort(), ['S3_night_neon','S4_night_muddy']);
});
test('ambiguous cards point at real keys and labels', () => { for (const q of m1.ambiguous) { assert.ok(m1.cardTypes[q.truthKey]); assert.ok(m1.labelOptions.some(o=>o.id===q.correctLabel)); } assert.equal(m1.ambiguous.length, 3); });
test('every combo is fillable within the bag', () => {
  const keys = new Set(m1.scenes.flatMap(s=>s.combos).flatMap(c=>c.keys));
  const minCards = [...keys].reduce((n,k)=>n+Math.max(...m1.scenes.flatMap(s=>s.combos).filter(c=>c.keys.includes(k)).map(c=>c.need)),0);
  assert.ok(minCards <= m1.bag, `${minCards} > ${m1.bag}`);
  for (const k of keys) assert.ok(m1.counts[k] >= 2, k);
});
test('no forbidden copy', () => { const txt = JSON.stringify([m1, tutorial]); assert.ok(!/지하차도|%|AI가 틀렸|당신이 실패/.test(txt)); });
test('missingLine format', () => { for (const c of m1.scenes.flatMap(s=>s.combos)) assert.match(c.missingLine, /^우리가 넣은 데이터에는 .+(없었다|부족했다)\.$/); });
test('tutorial needs 3 dogs and 3 cats in a 10-card bag', () => { assert.equal(tutorial.bag, 10); assert.deepEqual(tutorial.scenes[0].combos.map(c=>[c.keys[0],c.need]), [['dog',3],['cat',3]]); });
test('rng is deterministic', () => { const a=DR_Rng.create(5), b=DR_Rng.create(5); assert.equal(a.next(), b.next()); });
```

- [ ] **Step 2:** `node --test data/tests/missions.test.mjs` → FAIL(파일 없음)
- [ ] **Step 3:** 위 파일들 작성. `index.html` 스크립트 순서: vendor/three.min.js → js/config.js → js/rng.js → missions/cast.js → missions/tutorial.js → missions/m1.js → (이후 태스크 파일 자리) → js/app.js. 화면 컨테이너 `#screen-title`(제목 「데이터 러너: 끊어진 도시」, `#btn-start`), 나머지 `#screen-story #screen-briefing #screen-run #screen-inspect #screen-supervisor #screen-result #screen-prep #screen-outro`는 비어 있는 `<section hidden>`. `app.js`는 이 태스크에선 `DR.App = {go(name)}`(해당 section만 보이게)만.
- [ ] **Step 4:** `boot-browser.mjs`: `openGame()` → `#btn-start` 보임, `typeof DR.Missions.m1 === 'object'`, `typeof THREE === 'object'`, `errors` 비어 있음 → `PASS boot`.
- [ ] **Step 5:** 두 테스트 PASS 확인 후 커밋 `feat(data): 뼈대·조정값·임무 데이터`

---

### Task 2: 판정 `DR.Judge`

**Files:** Create `data/js/judge.js` · Test `data/tests/judge.test.mjs`

**Interfaces:**
- Consumes: 임무 스키마(Task 1), `DR.config.ambiguousWeight`
- Produces: `DR.Judge.judge(mission, bag, cfg) → {scenes:[{id, pass:boolean, failKind:null|'danger'|'inconvenience', missing:[comboId]}], mislabeled:[cardId], allPass:boolean}`
  - `bag` 항목: 일반 `{id, key}` / "?" `{id, ambiguousId, assigned: labelId|null|undefined}`. `assigned`가 `null`(넣지 않기)·`undefined`(미결정)면 제출에서 빠짐.
  - 셈: 일반 카드 = 그 key +1. "?"는 `assigned===correctLabel`이면 `truthKey` +`cfg.ambiguousWeight`, 아니면 셈 없이 `mislabeled`에 id. 한 카드는 그 key를 쓰는 **모든 장면의 조합에 함께 센다**.
  - 조합 충족 = Σ(조합 keys의 셈) ≥ need. `failKind` = 빠진 조합에 `danger:true`가 하나라도 있으면 `'danger'`, 아니면 `'inconvenience'`.
- `DR.Judge.missingLines(mission, result) → string[]` (빠진 조합의 `missingLine`, 장면 순서) — 결과 화면용.

- [ ] **Step 1: 실패하는 테스트** (헬퍼 `bagOf(counts)` = key마다 n장의 `{id:key+i, key}` 배열)

```js
const ALL2 = {day_deep:2,day_shallow:2,day_wet:2,day_dry:2,night_wet:2,night_neon:2,night_deep:2,night_shallow:2,night_muddy:2};
test('common cards only: S1 passes, S2-S4 fail', () => { const r = judge(m1, bagOf({day_deep:15, day_shallow:15}), cfg); assert.deepEqual(r.scenes.map(s=>s.pass), [true,false,false,false]); });
test('normal-only bag still fails S4 as danger', () => { const r = judge(m1, bagOf({day_wet:6,day_dry:6,night_wet:6,night_neon:3}), cfg); const s4=r.scenes[3]; assert.equal(s4.pass,false); assert.equal(s4.failKind,'danger'); });
test('equal per type without boundary cards fails S3 and S4', () => { const r = judge(m1, bagOf({day_deep:3,day_shallow:3,day_wet:3,day_dry:3,night_wet:3,night_deep:3,night_shallow:3}), cfg); assert.deepEqual(r.scenes.map(s=>s.pass), [true,true,false,false]); assert.deepEqual(r.scenes[2].missing, ['S3_night_neon']); });
test('ordinary boundary cards fill boundary combos (user choice 나)', () => { assert.equal(judge(m1, bagOf(ALL2), cfg).allPass, true); });
test('correct ambiguous card counts double', () => { const b = bagOf({...ALL2, night_muddy:0}).concat([{id:'q_muddy',ambiguousId:'q_muddy',assigned:'flood_shallow'}]); assert.equal(judge(m1,b,cfg).allPass, true); });
test('mislabeled ambiguous fills nothing and is reported', () => { const b = bagOf({...ALL2, night_neon:0}).concat([{id:'q_neon',ambiguousId:'q_neon',assigned:'flood_deep'}]); const r=judge(m1,b,cfg); assert.equal(r.scenes[2].pass,false); assert.deepEqual(r.mislabeled,['q_neon']); });
test('excluded or undecided ambiguous is ignored', () => { const base=bagOf({day_deep:2}); for (const a of [null, undefined]) assert.deepEqual(judge(m1, base.concat([{id:'q_clean',ambiguousId:'q_clean',assigned:a}]), cfg).mislabeled, []); });
test('q_clean labelled wet fills S2_day_wet', () => { const r = judge(m1, bagOf({day_dry:2}).concat([{id:'q_clean',ambiguousId:'q_clean',assigned:'wet'}]), cfg); assert.equal(r.scenes[1].pass, true); });
test('flood missing beats normal missing for failKind', () => { const r = judge(m1, bagOf({night_wet:2}), cfg); assert.equal(r.scenes[3].failKind, 'danger'); });
test('only normal combos missing gives inconvenience', () => { const r = judge(m1, bagOf({night_deep:2,night_neon:0,night_wet:0}), cfg); assert.equal(r.scenes[2].failKind, 'inconvenience'); });
test('empty bag: all fail, no throw', () => { const r = judge(m1, [], cfg); assert.equal(r.allPass, false); assert.equal(r.scenes.length, 4); });
test('tutorial: 8 dogs 2 cats fails, 3 and 3 passes', () => { assert.equal(judge(tutorial, bagOf({dog:8,cat:2}), cfg).allPass, false); assert.equal(judge(tutorial, bagOf({dog:3,cat:3}), cfg).allPass, true); });
test('missingLines follows scene order', () => { const r = judge(m1, bagOf({day_deep:2,day_shallow:2}), cfg); assert.equal(missingLines(m1, r)[0], m1.scenes[1].combos[0].missingLine); });
```
- [ ] **Step 2:** `node --test data/tests/judge.test.mjs` → FAIL
- [ ] **Step 3:** `data/js/judge.js` 구현, `index.html`에 추가
- [ ] **Step 4:** PASS
- [ ] **Step 5:** 커밋 `feat(data): 규칙 기반 판정`

---

### Task 3: 코스 생성 `DR.Stream`

**Files:** Create `data/js/stream.js` · Test `data/tests/stream.test.mjs`

**Interfaces:**
- Consumes: 임무 스키마, `DR.Rng`, `DR.config`
- Produces: `DR.Stream.build(mission, cfg, {seed:number, seconds?:number, focusKeys?:string[]}) → {length:number, items:[{uid:string, kind:'card'|'wall', key?:string, ambiguousId?:string, lane:0|1|2, z:number}]}` — `items`는 z 오름차순. 카드 `uid`는 코스 안에서 유일(`'c12'`), "?" 카드는 `key` 없이 `ambiguousId`.
  - 기본(`focusKeys` 없음): `mission.counts`대로 카드 + `ambiguous` 각 1장, 길이 = `seconds??mission.runSeconds` × `cfg.baseSpeed`. 처음 3초 구간은 비움(출발 여유). 카드 간 최소 z 간격 `cfg.baseSpeed*0.35`(같은 레인), 행마다 1~2장.
  - 드문 카드(`cardTypes[key].rare` 또는 "?")는 같은 레인에서 `cfg.rareWallGap` 이내 앞에 벽이 있다. 벽은 드문 카드 외에도 코스 전체에 듬성듬성(총 카드 수의 약 15%). 같은 z 행에서 세 레인을 모두 막는 벽 없음.
  - 보충(`focusKeys`): 길이 = `mission.supplementSeconds`×`baseSpeed`, 카드 12장, 그중 8장이 `focusKeys`(키마다 고르게 돌려 배분 → 키마다 ≥ ⌊8/키 수⌋장), 나머지는 흔한 카드. "?" 없음.

- [ ] **Step 1: 실패하는 테스트**

```js
const c = build(m1, cfg, {seed:1101});
test('card counts match mission', () => { for (const [k,n] of Object.entries(m1.counts)) assert.equal(c.items.filter(i=>i.key===k).length, n, k); assert.equal(c.items.filter(i=>i.ambiguousId).length, 3); });
test('same seed same course, other seed differs', () => { assert.deepEqual(build(m1,cfg,{seed:1101}), c); assert.notDeepEqual(build(m1,cfg,{seed:2}).items, c.items); });
test('rare cards sit behind a wall in their lane', () => { for (const it of c.items.filter(i=>i.ambiguousId || m1.cardTypes[i.key]?.rare)) assert.ok(c.items.some(w=>w.kind==='wall'&&w.lane===it.lane&&it.z-w.z>0&&it.z-w.z<=cfg.rareWallGap), it.uid); });
test('never three walls in one row', () => { const rows = Object.groupBy(c.items.filter(i=>i.kind==='wall'), w=>Math.round(w.z)); for (const r of Object.values(rows)) assert.ok(new Set(r.map(w=>w.lane)).size < 3); });
test('same-lane spacing and opening gap', () => { const cards=c.items.filter(i=>i.kind==='card'); assert.ok(cards[0].z >= cfg.baseSpeed*3); for (const l of [0,1,2]) { const zs=cards.filter(i=>i.lane===l).map(i=>i.z); for (let i=1;i<zs.length;i++) assert.ok(zs[i]-zs[i-1] >= cfg.baseSpeed*0.35-1e-9); } });
test('course length matches run time', () => { assert.equal(c.length, m1.runSeconds*cfg.baseSpeed); assert.ok(c.items.at(-1).z < c.length); });
test('supplement focuses on missing keys', () => { const s = build(m1, cfg, {seed:3, focusKeys:['night_shallow','night_muddy']}); const cards=s.items.filter(i=>i.kind==='card'); assert.equal(cards.length, 12); assert.ok(cards.filter(i=>['night_shallow','night_muddy'].includes(i.key)).length >= 8); for (const k of ['night_shallow','night_muddy']) assert.ok(cards.filter(i=>i.key===k).length >= 4, k); assert.equal(s.length, m1.supplementSeconds*cfg.baseSpeed); });
test('tutorial course builds', () => { const t = build(tutorial, cfg, {seed:7}); assert.equal(t.items.filter(i=>i.key==='dog').length, 9); });
```
- [ ] **Step 2:** FAIL 확인 → **Step 3:** 구현(`index.html` 추가) → **Step 4:** PASS → **Step 5:** 커밋 `feat(data): 시드 고정 코스 생성`

---

### Task 4: 잡기 규칙 `DR.Catch` · 입력 분류 `DR.Input`

**Files:** Create `data/js/catch.js`, `data/js/input.js` · Test `data/tests/catch.test.mjs`, `data/tests/input.test.mjs`

**Interfaces:**
- Produces:
  - `DR.Catch.phase(item, runnerZ, speed, cfg) → 'far'|'active'|'passed'` — `d = item.z - runnerZ`; `d<0` passed, `d <= speed*cfg.catchLead` active, 아니면 far.
  - `DR.Catch.grabber(cfg) → {press(now:number):void, update(s) → null | {item, perfect:boolean} | {full:true}}`
    - `s = {now, items, runnerZ, speed, lane, bagCount, bagMax, taken:Set<uid>}`.
    - `press`는 대기 입력 하나를 만든다(이미 대기 중이면 시각만 갱신). `update`는 대기 입력이 있을 때 현재 레인의 active·미획득 카드 중 가장 가까운 것을 잡고 대기를 지운다. 없으면 `now - pressedAt > cfg.grabBuffer`일 때 대기를 버린다(→ 레인 이동 직전·직후 0.15초 허용). 가방이 차 있으면 `{full:true}` 반환 후 대기 지움.
    - `perfect = |item.z - runnerZ| <= speed*cfg.perfectWindow`.
  - `DR.Input.classify(dx, dy, cfg) → 'left'|'right'|'tap'|null` — `|dx|>=cfg.swipeMin && |dx|>|dy|` → 좌/우, `|dx|<cfg.swipeMin && |dy|<cfg.swipeMin` → tap, 그 외(세로 긁기) null.
  - `DR.Input.bind(target:HTMLElement, handlers:{lane(dir:-1|1), grab()}) → unbind()` — keydown: ←/A → lane(-1), →/D → lane(1), Space → grab(); **`e.repeat`면 무시**; Space 기본 동작(스크롤) 막음. touchstart/touchend로 classify. (bind는 브라우저 테스트 Task 6에서 검증)

- [ ] **Step 1: 실패하는 테스트**

```js
const card = (z,lane=1,uid='a') => ({uid, kind:'card', key:'day_deep', lane, z});
test('phase boundaries', () => { assert.equal(phase(card(16*0.7),0,16,cfg),'active'); assert.equal(phase(card(16*0.71),0,16,cfg),'far'); assert.equal(phase(card(-0.1),0,16,cfg),'passed'); });
test('grabs nearest active card in own lane only', () => { const g=grabber(cfg); g.press(0); const r=g.update({now:0, items:[card(8,1,'far'),card(3,1,'near'),card(1,0,'other')], runnerZ:0, speed:16, lane:1, bagCount:0, bagMax:30, taken:new Set()}); assert.equal(r.item.uid,'near'); });
test('one press grabs one card', () => { const g=grabber(cfg); g.press(0); const s={now:0, items:[card(2,1,'x'),card(4,1,'y')], runnerZ:0, speed:16, lane:1, bagCount:0, bagMax:30, taken:new Set()}; assert.ok(g.update(s)); assert.equal(g.update(s), null); });
test('press just before lane change still grabs in new lane', () => { const g=grabber(cfg); g.press(0); const base={items:[card(3,2,'r')], runnerZ:0, speed:16, bagCount:0, bagMax:30, taken:new Set()}; assert.equal(g.update({...base, now:0.05, lane:1}), null); assert.equal(g.update({...base, now:0.12, lane:2}).item.uid,'r'); });
test('buffer expires', () => { const g=grabber(cfg); g.press(0); const base={items:[card(3,2,'r')], runnerZ:0, speed:16, bagCount:0, bagMax:30, taken:new Set()}; g.update({...base, now:0.1, lane:1}); assert.equal(g.update({...base, now:0.2, lane:2}), null); });
test('full bag', () => { const g=grabber(cfg); g.press(0); assert.deepEqual(g.update({now:0, items:[card(2)], runnerZ:0, speed:16, lane:1, bagCount:30, bagMax:30, taken:new Set()}), {full:true}); });
test('perfect only at contact', () => { const g=grabber(cfg); g.press(0); assert.equal(g.update({now:0, items:[card(1)], runnerZ:0, speed:16, lane:1, bagCount:0, bagMax:30, taken:new Set()}).perfect, true); const h=grabber(cfg); h.press(0); assert.equal(h.update({now:0, items:[card(5)], runnerZ:0, speed:16, lane:1, bagCount:0, bagMax:30, taken:new Set()}).perfect, false); });
test('taken cards are skipped', () => { const g=grabber(cfg); g.press(0); assert.equal(g.update({now:0, items:[card(2,1,'t')], runnerZ:0, speed:16, lane:1, bagCount:0, bagMax:30, taken:new Set(['t'])}), null); });
// input.test.mjs
test('swipe vs tap', () => { assert.equal(classify(40,5,cfg),'right'); assert.equal(classify(-40,5,cfg),'left'); assert.equal(classify(5,5,cfg),'tap'); assert.equal(classify(10,60,cfg),null); });
```
- [ ] **Step 2:** FAIL → **Step 3:** 구현(`index.html` 추가) → **Step 4:** PASS → **Step 5:** 커밋 `feat(data): 잡기 규칙·입력 분류`

---

### Task 5: 카드 그림 `DR.CardArt`

**Files:** Create `data/js/cardart.js` · Test `data/tests/cardart-browser.mjs`

**Interfaces:**
- Consumes: 임무 `cardTypes[key].art`·`ambiguous[].truthKey`
- Produces:
  - `DR.CardArt.card(mission, keyOrAmbiguousId, variant:number, size:number) → HTMLCanvasElement` — 원본(정사각형). 같은 인자 → 같은 그림(캐시 `Map`).
  - `DR.CardArt.thumb(canvas, cells=24) → HTMLCanvasElement` — 자동 픽셀화(작게 그렸다 `imageSmoothingEnabled=false`로 키움).
  - `DR.CardArt.icon(name, size) → HTMLCanvasElement` — `day night flood_deep flood_shallow wet dry unknown dog cat`. 도형·선으로 직접 그림(이모지·외부 폰트 금지). 깊음/얕음은 물결 줄 수로 구분, `unknown`은 "?".
  - `DR.CardArt.clue(mission, ambiguousId, clueIndex, size) → HTMLCanvasElement` — `usual_photo`는 같은 장소를 마른 낮(또는 마른 밤) 상태로, 나머지는 단서 문구를 계기판 모양으로.
  - `DR.CardArt.scene(mission, sceneId, outcome:'pass'|'danger'|'inconvenience', size) → HTMLCanvasElement` — 결과 컷: 장면 바탕 + 차단봉(불편)/멈춘 차와 감독관 실루엣·멈춤 손(위험)/초록 통과 표시(통과). 사람은 실루엣.
- 그리는 법(spec §6): 바탕(`alley`·`street`·`crossing`·`overpass` — 고가 **위 도로 아래의 지상 교차로**이지 지하차도 아님) × 시간(낮 하늘·밤 하늘+가로등) × 물 레이어(`dry/wet/shallow/deep` — 반사 강도·수위선) × 변형(`neon` 네온 반사, `muddy` 흙빛 물, `clean` 물청소 줄무늬). `variant` 번호로 시드를 바꿔 건물 배치·색을 조금씩 달리한다. 튜토리얼 개·고양이도 같은 평면 도형 방식.
- "?" 카드 그림은 같은 레이어를 쓰되 판단이 갈리는 값(예: `q_neon`의 반사 강도를 `night_shallow`와 비슷하게, `q_muddy`의 수위선을 거의 안 보이게).

- [ ] **Step 1: 실패하는 테스트** `cardart-browser.mjs` — `openGame()` 후 `page.evaluate`:
  - 모든 m1 key·ambiguous id·tutorial key에 대해 `card(...,0,256)`이 256×256이고 픽셀 표준편차 > 10(빈 그림 아님).
  - `card(m1,'day_deep',0,256)`과 `card(m1,'day_deep',1,256)` 픽셀이 다름, `card(m1,'day_deep',0,256)` 두 번 호출은 같은 객체.
  - `day_dry`와 `day_deep` 하단 1/3 평균 밝기·색이 다름(물 레이어가 실제로 그려짐).
  - 9개 아이콘이 서로 다른 픽셀.
  - `thumb(c,24)`의 결과를 다시 24×24로 줄였을 때 인접 픽셀 블록이 균일(픽셀화 확인).
  - 각 장면 × 3 outcome `scene()` 정상 생성.
  - 모든 그림을 한 장의 시트로 `data/tests/_shot-cardart.png` 저장(사람 눈 확인용) · `errors` 없음 → `PASS cardart`
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** PASS, `_shot-cardart.png`를 직접 열어 장면이 구분되는지·지하차도로 안 보이는지 확인 → **Step 5:** `.gitignore`(`data/.gitignore`: `tests/_shot-*.png`) 추가, 커밋 `feat(data): 절차적 카드 그림·아이콘`

---

### Task 6: 3D 달리기 `DR.Run` · 효과음 `DR.Sfx`

**Files:** Create `data/js/run3d.js`, `data/js/sfx.js` · Modify `data/index.html`(HUD: `#hud-bag`, `#hud-progress`, `#btn-mute`), `data/css/style.css` · Test `data/tests/run-browser.mjs`

**Interfaces:**
- Consumes: `DR.Stream.build`, `DR.Catch.grabber/phase`, `DR.Input.bind`, `DR.CardArt.card/thumb/icon`, `DR.config`
- Produces:
  - `DR.Run.start(container:HTMLElement, opts) → void` — `opts = {mission, course, bag:Array(이미 든 카드 — 보충 때), bagMax, onEnd(result)}`. 코스 끝에 도달하면 루프를 멈추고 `onEnd({grabbed:[{uid, key?, ambiguousId?}], hits:number, perfects:number})`.
  - `DR.Run.stop()` — 장면·리스너 정리(다시 `start` 가능).
  - `DR.Run.step(dt:number)` — 한 프레임 진행(내부 rAF 루프도 이걸 부름). **`dt`를 `cfg.maxDt`로 자름.**
  - `DR.Run.peek() → {runnerZ, speed, lane, bagCount, running:boolean, slowedUntil:number}` — 테스트·디버그용.
  - `DR.Run.finishNow()` — 테스트용: 남은 코스를 건너뛰고 `onEnd` 호출.
  - `DR.Sfx.play(name:'grab'|'perfect'|'hit'|'lane'|'full'|'ui')`, `DR.Sfx.setMuted(bool)`, `DR.Sfx.muted` — 첫 사용자 입력 뒤 `AudioContext` 생성. 음소거 상태는 `localStorage['dr.muted']`(try/catch, 실패해도 동작).
- 장면(spec §4.1·4.5): 뒤에서 따라가는 원근 카메라(러너 뒤 위쪽, 진행 방향을 내려다봄), 남보라 바탕·시안/분홍 네온 격자 도로·양옆 블록 빌딩(재사용 메시, 러너 앞뒤로 순환 배치)·지평선 그라데이션. 러너 = 캡슐 몸+머리+팔다리 흔들기. 카드 = 레인 위 세운 판(앞면 텍스처 = 썸네일 + 아이콘 2~3개를 한 캔버스에 합성), `active`면 테두리 빛·살짝 커짐, 가방 가득이면 회색. 벽 = 지직거리는 분홍 판.
- 손맛: 레인 이동 0.12초 보간 + 몸 기울기 + 카메라 관성 추종, 속도 = `baseSpeed × (1 + speedRamp × 진행률)`, 벽 충돌(같은 레인, z 지남) → `wallSlow` 감속 + 화면 흔들림, 잡기 → 카드가 HUD 가방 아이콘 쪽으로 날아감 + `#hud-bag` 숫자 튐, 퍼펙트 → 반짝 파티클 + `perfect` 소리, 속도선. `matchMedia('(prefers-reduced-motion: reduce)')`면 흔들림·속도선 끔.
- `visibilitychange`로 숨겨지면 루프 일시정지, 보이면 재개.
- 렌더러는 컨테이너 크기를 따라 `ResizeObserver`로 맞춤(세로 화면이면 카메라 시야각을 넓혀 3레인이 다 보이게).
- 디버그 진입: `index.html?run=m1` 또는 `?run=tutorial`이면 타이틀을 건너뛰고 바로 그 임무 달리기(테스트·손맛 조정용).

- [ ] **Step 1: 실패하는 테스트** `run-browser.mjs`(`openGame({query:'?run=m1'})`):
  - `start`: `DR.Run.peek().running === true`, `canvas` 1개.
  - `lane change`: `ArrowRight` → 0.2초 뒤 `peek().lane === 2`, `KeyA` 두 번 → `0`.
  - `grab`: `page.evaluate`로 현재 레인의 다음 카드가 active가 될 때까지 기다린 뒤 `Space` → `peek().bagCount === 1`, `#hud-bag` 글자에 `1/30`.
  - `key repeat ignored`: active 카드 2장이 같은 레인에 있도록 `DR.Run.step`으로 맞춘 뒤 `keydown Space {repeat:false}` 1번 + `{repeat:true}` 5번 dispatch → `bagCount` +1만.
  - `wall`: 벽 바로 앞 레인으로 옮겨 통과시키면 `peek().slowedUntil > 0`이고 speed < baseSpeed.
  - `dt clamp`: `const z0=peek().runnerZ; DR.Run.step(5)` → 증가량 ≤ `speed*cfg.maxDt + 1e-6`.
  - `resize mid-run`: `setViewportSize(375×812)` → 다음 프레임 뒤 canvas의 CSS 크기가 375 폭에 맞고 `running` 유지. 스크린샷 `_shot-run-375.png`, 1366에서 `_shot-run-1366.png`.
  - `end`: `DR.Run.finishNow()` → `onEnd`가 `grabbed` 배열과 함께 한 번 호출(테스트 훅: `?run=` 모드에서 `window.__runResult`에 저장).
  - `errors` 없음 → `PASS run`
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** PASS, 스크린샷 두 장을 직접 열어 3레인·카드 아이콘이 읽히는지 확인
- [ ] **Step 5:** 커밋 `feat(data): 3D 3레인 달리기·효과음`

---

### Task 7: 이야기 · 브리핑 · 튜토리얼 흐름

**Files:** Create `data/js/ui-story.js` · Modify `data/js/app.js`, `data/index.html`, `data/css/style.css` · Test `data/tests/tutorial-browser.mjs`

**Interfaces:**
- Consumes: `DR.Cast`, 임무 `story`·`scenes`, `DR.CardArt.scene/icon`, `DR.Run`, `DR.Stream`, `DR.Judge`
- Produces:
  - `DR.UI.dialogue(lines:[{who,text}], done:Function)` — `#screen-story`. 초상 = `DR.Cast[who]`의 색·도형(안내 AI는 `hex`, 복구 대상 AI 표현과 겹치지 않게). 클릭·Space·Enter로 다음, `#btn-skip`으로 끝까지.
  - `DR.UI.briefing(mission, done)` — `#screen-briefing`: 안내 AI가 `story.guideBrief`를 말하고, `scenes`를 그림 카드(`CardArt.scene(...,'pass')` 대신 중립 그림 — 같은 바탕에 결과 표시 없이)로 나열. `emphasis:'low'` 장면은 작게·흐리게(덜 강조). **수집 목록·필요 장 수는 보여주지 않는다.** `#btn-run` "달리기 시작".
  - `DR.UI.outro(lines, done)` — 마무리 안내(기획서 §4.7: "이 결과는 실제 AI가 아니라 단순화한 규칙으로 만든 것").
  - `DR.App.state = {mission:string, bag:Array, supplements:number, firstTry:boolean|null, seed:number}`
  - `DR.App.go(name)`, `DR.App.startMission(id)`.
  - 테스트 훅 `DR.App.debugFill(counts:{[keyOrAmbiguousId]:number})` — 달리는 중 현재 코스에서 그 key(또는 ambiguousId) 카드를 앞에서부터 골라 가방에 넣음(이미 든 것 제외, 모자라면 throw). "?"는 `assigned` 없이 들어감.
- 튜토리얼 흐름: 타이틀 `#btn-start` → 대화(`tutorial.story.intro`) → 브리핑 → 달리기(`bag:10`) → 판정: 통과면 결과 한 장(AI가 개·고양이를 바르게 맞히는 컷) → `story.outro`(시험관 대사) → `startMission('m1')`; 실패면 귀여운 실패 한 장(`story.fail`) + `#btn-retry`(같은 시드 코스 다시, 가방 비움). 튜토리얼에는 검수·감독관 없음.
- 달리기 첫 화면에 조작 안내 한 줄(키보드/터치를 `matchMedia('(pointer: coarse)')`로 골라 표시), 첫 레인 이동 또는 3초 뒤 사라짐.

- [ ] **Step 1: 실패하는 테스트** `tutorial-browser.mjs`:
  - 타이틀 → `#btn-start` → 대화 넘기기(`#btn-skip`) → 브리핑: 장면 카드 1장, 문서에 `need`·숫자 목록 없음 → `#btn-run`.
  - 달리기 중 `page.evaluate`로 개 8장·고양이 0장을 담고 `DR.Run.finishNow()` 호출(테스트 훅 `DR.App.debugFill(keys)`가 현재 코스에서 그 key 카드 uid를 골라 가방에 넣음) → 실패 화면에 `story.fail` 문구, `#btn-retry` → 다시 달리기 화면, 가방 0.
  - 다시 개 3·고양이 3 → 통과 화면 → 시험관 대사 → 1 임무 대화(`m1.story.intro[0].text` 보임).
  - 1366·375 두 크기, `errors` 없음 → `PASS tutorial`
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** PASS → **Step 5:** 커밋 `feat(data): 이야기·브리핑·튜토리얼 흐름`

---

### Task 8: 검수 · 감독관 · 결과 · 보충 (1 임무 흐름)

**Files:** Create `data/js/ui-inspect.js`, `data/js/ui-result.js` · Modify `data/js/app.js`, `data/index.html`, `data/css/style.css` · Test `data/tests/m1-browser.mjs`

**Interfaces:**
- Consumes: `DR.Judge.judge/missingLines`, `DR.Stream.build({focusKeys})`, `DR.CardArt.*`, `DR.UI.dialogue`, `DR.App.state`
- Produces:
  - `DR.UI.inspect(mission, bag, done(bag))` — `#screen-inspect`:
    - 가방 격자(썸네일 + 아이콘). 카드 누르면 원본 크게(`#inspect-zoom`, Esc·바깥 클릭 닫힘). 각 카드 `[빼기]`.
    - "?" 카드: 원본 + `CardArt.clue` 단서들 + `labelOptions` 버튼 + `[넣지 않기]` → `assigned` 설정(다시 바꿀 수 있음). 미결정 "?"가 있으면 `#inspect-undecided` "아직 정하지 않은 카드 N장 — 정하지 않으면 넣지 않아요" 표시.
    - 장면별 요약 `#inspect-scenes`: 장면마다 제목 + 그 장면 조합 key에 해당하는 가방 카드 썸네일(올바르게 분류된 "?"는 `truthKey`로, 잘못 분류된 건 붙인 설명표 기준으로 보이게 — 플레이어가 붙인 대로 보여준다). **숫자·충족 표시 없음.**
    - `#btn-submit` → `done(bag)`.
  - `DR.UI.supervisor(question, back(), submit())` — 감독관 대사 + `#btn-back`(검수로) / `#btn-confirm`(제출).
  - `DR.UI.result(mission, judgeResult, done)` — `#screen-result`: 장면 S1~S4를 한 장씩(`#btn-next`): `CardArt.scene(outcome)` + 통과면 `passLine`, 실패면 `cuts[failKind]` + 그 장면 빠진 조합의 `missingLine`들. 위험 실패 컷에는 감독관 "승인한 건 나니까, 나도 같이 책임질게." `mislabeled`가 있으면 마지막 장에 "설명표를 다르게 붙인 카드: …" 한 줄. % 없음.
  - `DR.UI.supplementPrep(mission, judgeResult, bag, done(bag))` — `#screen-prep`: 실패 장면 짚기 + 가방 격자(빼기) + `#btn-supplement`. 필요한 빈칸 = `min(6, bagMax)`(초기값, `DR.config.supplementFreeSlots: 6`으로 Task 1 표에 추가). `bagMax - bag.length < 필요 빈칸`이면 버튼 비활성 + "N칸 더 비워야 해요".
  - 디버그 진입 `index.html?start=m1` — 튜토리얼을 건너뛰고 1 임무 대화부터. `DR.App.lastJudge` = 마지막 판정 결과.
- 1 임무 흐름(`DR.App`): 대화(`m1.story.intro`) → 브리핑 → 달리기(`bag:30`) → 검수 → 감독관 → [back이면 검수] → 결과 → 전부 통과면 `firstTry=true` → 선배 대화 → 마무리 / 실패면 `firstTry=false` → 보충 준비 → 보충 달리기(`focusKeys` = 실패 장면들의 빠진 조합 keys, 기존 가방 유지) → (새 "?" 없음이므로) 감독관 → 결과 → 실패 & `supplements < cfg.maxSupplements`면 다시 보충, 아니면 그대로 선배 대화 → 마무리. `DR.App.state.record = {firstTry, supplements}`를 남긴다(표시 없음 — spec 비목표).

- [ ] **Step 1: 실패하는 테스트** `m1-browser.mjs`(`?start=m1` 디버그 진입, 시나리오마다 새 페이지):
  - **시나리오 A — 흔한 카드만**: 대화·브리핑 → 브리핑 장면 4장, S4 카드에 `data-emphasis="low"` → `debugFill({day_deep:15, day_shallow:15})` + `finishNow` → 검수: 격자 30장, `#inspect-scenes`에 숫자(`/\d+\s*\/\s*\d+|%/`) 없음 → 제출 → 감독관 `#btn-back` → 검수 화면 → 다시 제출 → `#btn-confirm` → 결과: S1 통과 / S2 불편 / S3·S4 위험 컷, S4 장에 감독관 책임 대사, 전체 텍스트에 `%` 없음.
  - **시나리오 B — `undecided ambiguous`**: `debugFill({...ALL2, q_neon:1})`(q_neon 미결정) → `#inspect-undecided` 보임 → 제출·확인 → `DR.App.lastJudge.mislabeled` 빔, 결과 정상 표시.
  - **시나리오 C — 보충**: `debugFill({...ALL2, night_shallow:0, night_muddy:0, day_deep:18})`(30장, S4만 위험 실패) → 결과 → 보충 준비: 30/30에서 `#btn-supplement` disabled(`supplement needs free slots`), day_deep 6장 빼면 enabled → 보충 달리기 코스(`DR.Run`에 넘긴 course)의 카드 12장 중 ≥ 8장이 `night_shallow`/`night_muddy` → `debugFill({night_shallow:2, night_muddy:2})` + `finishNow` → 감독관 → 결과 전부 통과 → 선배 대사(`m1.story.senior[0].text`) → 마무리 안내에 "단순화한 규칙", `DR.App.state.record` = `{firstTry:false, supplements:1}`.
  - 1366·375, `errors` 없음, 결과 화면 스크린샷 `_shot-result-1366.png`·`_shot-inspect-375.png` → `PASS m1`
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** PASS, 스크린샷 직접 확인 → **Step 5:** 커밋 `feat(data): 검수·감독관·결과·보충 흐름`

---

### Task 9: 전체 통과 · 인수인계 · push

**Files:** Create `data/tests/run-all.mjs`, `data/CLAUDE.md`, `data/README.md` · Test 전체

**Interfaces:**
- Consumes: 모든 이전 태스크

- [ ] **Step 1:** `run-all.mjs` — `data/tests/*-browser.mjs`를 차례로 실행해 이름별 PASS/FAIL과 마지막 오류 줄을 출력, 하나라도 FAIL이면 exit 1.
- [ ] **Step 2:** `node --test data/tests/` 전부 PASS, `node data/tests/run-all.mjs` 전부 PASS.
- [ ] **Step 3:** 실제 `file://` 수동 확인: 탐색기에서 `data/index.html` 더블클릭 → 타이틀부터 튜토리얼 끝까지 키보드로 직접 1회(사람 손 — 실행자가 Playwright `headless:false` 대신 할 수 없으면 "미확인"으로 보고).
- [ ] **Step 4:** `data/README.md`(팀원용: 브랜치 받기 → `data/index.html` 더블클릭, 조작, 디버그 진입 `?run=m1`·`?start=m1`, 조정값 위치 `js/config.js`) · `data/CLAUDE.md`(인수인계: 구조 표, 검증 명령, spec과 기획서의 차이 — 매끈한 3D·경계 조합 규칙·실패 종류 규칙, 남은 일 = 기획서 §11 시험 플레이 체크 항목·2~4 임무).
- [ ] **Step 5:** 커밋 `docs(data): 인수인계·실행 안내` → `git push origin data`.
- [ ] **Step 6:** 보고 — 자동 확인(단위 N개·브라우저 4종 PASS·스크린샷 확인) / 미확인(손맛·실기기 성능·터치 실기기·팀 플레이) 구분.
