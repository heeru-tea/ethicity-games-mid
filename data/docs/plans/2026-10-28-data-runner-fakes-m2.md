# 데이터 러너 — 가짜 카드 + 2 임무 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 튜토리얼 다음부터 "그림과 이름표가 안 맞는" 가짜 카드가 섞이고(1 임무부터), 2 임무 「분리배출 분류 AI」를 이름표 고치기 검수 + 컨베이어 실제 분류 결과까지 끝까지 플레이할 수 있게 한다.

**Architecture:** 카드의 진짜 종류·붙은 이름표·아이콘을 한 곳에서 계산하는 순수 모듈 `DR.Cards`를 새로 두고, 판정(`DR.Judge`)·코스(`DR.Stream`)·달리기·검수가 모두 그것을 쓴다. 컨베이어 분류는 순수 모듈 `DR.Conveyor.sort`(node 테스트) + 화면 `DR.UI.conveyor`로 나눈다. 1부(Task 1~5, 가짜 + 1 임무)를 먼저 끝내 push하고, 2부(Task 6~10, 2 임무)를 잇는다.

**Tech Stack:** 기존 그대로 — 바닐라 JS 클래식 스크립트·전역 `DR`, three.js r149, Canvas 2D, Web Audio, `node:test`, Playwright(msedge, `file://`).

**Spec:** `data/docs/specs/2026-10-28-data-runner-fakes-m2-design.md` (그 위에 `data/docs/specs/2026-10-27-data-runner-v1-design.md`, 원 기획서 `data/data-runner-plan.md`)

## Global Constraints

- 워크트리 `D:\Works\ethicity-games-mid-data`, 브랜치 `data`, push `origin data`(자동 OK). 경로는 레포 루트 기준.
- `file://` 더블클릭으로 동작: fetch·ES 모듈·외부 파일·네트워크 없음. 그림은 전부 Canvas(`DR.CardArt`) — **fal.ai·공공 데이터 이미지 쓰지 않음(사용자: 결제 전 보류)**.
- 순수 모듈은 UMD 꼬리(`root.DR.X = api; if (module) module.exports = api`), `(typeof window!=='undefined'?window:globalThis)`.
- 숫자 정확도(%)·맞힌 개수 없음(결과·컨베이어 모두). 결과 문구는 탓하지 않는 "우리가 넣은 데이터에(는) …" 형식.
- 달리는 중 가짜를 잡았다/피했다 알림 없음(같은 소리·같은 연출). 첫 가짜 안내 문구 한 번만 예외.
- 가짜는 같은 화풍으로 그린다(테두리·반짝임 등 표식 금지). 앞에 벽 없음. 코스 앞 15% 구간에 없음.
- 한 장면에 가짜 2장 이상 = 오염(`config.fakeLimit: 2`). 가짜·오표기 카드는 조합을 채우지 않는다.
- 1 임무 "?" 카드 규칙은 그대로(잘못 분류해도 가짜로 세지 않음). 튜토리얼에는 가짜 없음.
- 지하차도 금지, 실제 재난 사진 금지. 분리배출 내용은 실제 규칙과 맞아야 한다.
- 화면 전환 때 자동 포커스 금지(`go()`가 blur). 달리기 화면 `touch-action:none`. `prefers-reduced-motion` 존중.
- 커밋 `feat(data): …`/`fix(data): …`, 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 단위: `node --test "data/tests/*.test.mjs"` · 브라우저: `PLAYWRIGHT_MODULE=D:/Works/token_economy/node_modules/playwright node data/tests/run-all.mjs`. 기존 테스트는 계속 통과(바꾸는 단언은 아래에 명시).

## Review Focus

1. **2 임무에서 같은 카드의 이름표를 여러 번 바꾸기**(원래 이름표로 되돌리기 포함) → 원래 이름표로 돌아오면 "고침" 표시가 사라지고 판정은 보통 카드와 같다. → Task 8 `relabel back clears fixed`.
2. **보충 준비에서 가짜만 빼고 모자란 조합이 없을 때 / 있을 때** → 없으면 "다시 제출"(달리지 않음, 칸 조건 없음), 있으면 기존 보충 달리기. 다시 제출도 보충 1회로 세고 `maxSupplements`를 넘으면 마무리로. → Task 5 `resubmit without run`.
3. **컨베이어에서 비상 정지 중 건너뛰기·2배속 연타** → `done`이 한 번만 불리고 화면이 멈추지 않는다. → Task 9 `skip during stop`.
4. **375px 세로 화면의 컨베이어** → 함 7개가 가로 스크롤 없이 들어간다. → Task 9 `conveyor fits 375`.
5. **임무 선택으로 2 임무에 바로 들어오기 / 2 임무를 끝낸 뒤 다시 하기** → 1 임무 기록이 없으면 기본 브리핑, 상태가 섞이지 않는다. → Task 10 `m2 direct entry`.

---

## 파일 구조

| 파일 | 할 일 |
|---|---|
| `data/js/cards.js` (새) | 순수: 카드의 진짜 종류·이름표·아이콘·그림 id·이름표가 걸리는 장면 |
| `data/js/judge.js` | 가짜·오표기 오염, 장면 `contaminated`, `contaminationLines` |
| `data/js/stream.js` | 가짜 카드 배치(앞 15% 없음·벽 없음), 보충에 1장 |
| `data/js/conveyor.js` (새) | 순수: 판정 결과 → 컨베이어 물건별 함·맞음·원인 |
| `data/js/config.js` | `fakeLimit: 2`, `conveyor: { step: 1.2 }` |
| `data/missions/m1.js` | `fakes` 3종, `outcomeText`, `next: 'm2'`, 수거봇 이름표 대사 |
| `data/missions/m2.js` (새) | 2 임무 데이터(이름표·카드·가짜·장면·컨베이어·대사) |
| `data/missions/cast.js` | `sorter`(선별장 직원) |
| `data/js/cardart.js` | 가짜 장소(수영장·분수 광장)·물건(냉장고·쓰레기 물건) 그리기, 2 임무 아이콘 7종, 선별장 결과 컷 |
| `data/js/run3d.js` | 카드 앞면을 `DR.Cards`로, `take`가 `fakeId` 보존, 첫 가짜 안내 |
| `data/js/ui-inspect.js` | 아이콘·장면 모아 보기를 `DR.Cards`로, 2 임무 이름표 고치기(검수·보충 준비 공용 크게 보기), 다시 제출 |
| `data/js/ui-conveyor.js` (새) | 컨베이어 화면 |
| `data/js/ui-result.js` | `outcomeText`, 오염 문구, 장면별 잘못 간 물건 |
| `data/js/ui-story.js` | 브리핑 기록 한 줄, 마무리 화면 다음 임무 버튼 |
| `data/js/app.js` | 가짜 debugFill, 다시 제출 길, 컨베이어 단계, 임무 선택·기록 |
| `data/index.html` · `css/style.css` | 새 스크립트·`#screen-conveyor`·타이틀 임무 고르기 |
| `data/tests/*` | 아래 각 Task |

**공통 자료 모양(모든 Task가 따름)**
- 코스 카드: `{uid, kind:'card', lane, z}` + `key` | `ambiguousId` | `fakeId` 중 하나.
- 가방 카드: `{id}` + `key` | `ambiguousId`(+`assigned`) | `fakeId` 중 하나, 2 임무에서 고친 경우 `label`.
- 임무 `fakes: [{ id, name, art, label, truth, count, line }]` — `label` = 붙은 이름표 id, `truth` = 진짜 카드 종류 key 또는 `null`(엉뚱한 가짜), `line` = 오염 결과 문구.
- 이름표 id: 1 임무는 카드 종류 key 자체(`'day_deep'`), 2 임무는 `mission.labels`의 id(`'can'`)이고 `cardTypes[k].label`이 그 id를 가리킨다.
- 위험물: `cardTypes[k].hazard: true`(2 임무 건전지).

---

### Task 1: `DR.Cards` + 판정의 가짜·오표기

**Files:**
- Create: `data/js/cards.js`, `data/tests/cards.test.mjs`
- Modify: `data/js/judge.js`, `data/js/config.js`, `data/index.html`(judge 앞에 cards.js), `data/tests/judge.test.mjs`

**Interfaces:**
- Produces (`DR.Cards`):
  - `labelOfKey(mission, key) → string` — `cardTypes[key].label || key`
  - `currentLabel(mission, card) → string|null` — `card.label` 있으면 그것, 아니면 key → `labelOfKey`, fakeId → `fake.label`; "?" 카드는 `null`
  - `truthKey(mission, card) → string|null` — key → key, fakeId → `fake.truth`, "?" → `null`
  - `isMislabeled(mission, card) → boolean` — "?"가 아니고, `truthKey`가 null이거나 `labelOfKey(truthKey) !== currentLabel`
  - `harm(mission, card) → 'danger'|'inconvenience'` — `truthKey`의 `hazard`면 danger
  - `sourceId(mission, card) → string` — fakeId 카드는 fakeId, 아니면 `'mis:' + key + ':' + label`
  - `scenesForLabel(mission, label) → string[]` — 조합 keys 중 `labelOfKey(k) === label`인 key가 있는 장면 id
  - `iconsOf(mission, card) → string[]` — 이름표의 아이콘: `mission.labels`가 있으면 `[label]`, 없으면 `cardTypes[label].icons`; "?" 카드는 기존 규칙(`assigned` 반영)
  - `artId(card) → string` — `key || ambiguousId || fakeId`
  - `labelText(mission, label) → string` — `mission.labels` 또는 `labelOptions`의 text, 없으면 cardTypes 이름
- Produces (`DR.Judge.judge` 반환 확장): 장면마다 `contaminated: string[]`(sourceId, 중복 없음, 문턱 미만이면 `[]`), 그리고 `failKind`에 오염 피해 반영. `DR.Judge.contaminationLines(mission, result) → string[]`(장면 순서, 중복 없음): fake면 `fake.line`, `mis:`면 `'우리가 넣은 데이터에 ' + cardTypes[key].name + ' 사진이 \'' + labelText + '\'로 들어갔다.'`
- `config.fakeLimit = 2`

- [ ] **Step 1: 실패하는 테스트** — `cards.test.mjs`는 테스트 안에 작은 가짜 임무 둘을 직접 만든다(1 임무형: 이름표 = key / 2 임무형: `labels` + `cardTypes.x.label` + `hazard`). 단언:
  - `currentLabel`: 보통 카드 = 자기 이름표, 가짜 = `fake.label`, `card.label`이 있으면 그것.
  - `isMislabeled`: 보통 카드 false · 가짜 true · 진짜 종류로 고친 가짜 false · 엉뚱한 가짜(truth null)는 어떤 이름표든 true · 보통 카드를 다른 이름표로 바꾸면 true.
  - `scenesForLabel`: 2 임무형에서 `'can'`이 음료 캔·통조림 캔을 쓰는 장면 둘 다.
  - `harm`: truth가 hazard면 `'danger'`.
  
  `judge.test.mjs`에 추가(실제 `m1`을 쓰되 Task 3 전이므로 테스트 안에서 `{...m1, fakes:[{id:'f_pool', label:'day_deep', truth:null, count:2, line:'L'}]}`로 덮어 씀):
  - `one fake is harmless`: `ALL2` + 가짜 1장 → `allPass` true, S1 `contaminated` `[]`.
  - `two fakes contaminate the scene of their label`: `ALL2` + 가짜 2장 → S1 실패, `failKind 'inconvenience'`, `contaminated ['f_pool']`, `missing []`.
  - `fakes of different kinds add up per scene`: f_pool 1 + f_fountain(label day_shallow) 1 → S1 오염, `contaminated` 둘 다.
  - `fakes fill no combo`: `ALL2`에서 day_deep 0 + 가짜 2 → S1 `missing`에 `S1_day_deep`.
  - `hazard fake is danger`: 2 임무형 작은 임무로 truth hazard 가짜 2장 → 그 이름표의 모든 장면이 `danger`.
  - `ambiguous mislabel is still not a fake`: 기존 `mislabeled` 테스트 그대로 + 해당 장면 `contaminated` `[]`.
  - `contaminationLines`가 fake `line`과 `mis:` 문구를 장면 순서대로 중복 없이.
- [ ] **Step 2: 실행해 실패 확인** — `node --test "data/tests/*.test.mjs"` → cards.js 없음 / `contaminated` undefined로 FAIL.
- [ ] **Step 3: 구현** — `cards.js`(UMD), `judge.js`의 `tally`가 "?"가 아닌 카드마다 `isMislabeled`면 `scenesForLabel(currentLabel)`의 장면별 목록에 `{source, harm}`을 쌓고 아니면 `counts[truthKey]++`. 장면 실패 = 빠진 조합 있음 또는 쌓인 수 ≥ `cfg.fakeLimit`. `failKind` = (빠진 조합 중 danger 또는 오염 harm 중 danger) ? danger : inconvenience. `shortfall`은 같은 tally를 쓰므로 오표기 카드는 세지 않는다. judge.js는 node에서 `require('./cards.js')`, 브라우저에선 `root.DR.Cards`(stream.js의 rngApi와 같은 방식).
- [ ] **Step 4: 통과 확인** — 같은 명령, 전부 PASS(기존 59 포함).
- [ ] **Step 5: 커밋** — `feat(data): 가짜 카드 판정 — 한 장면 2장 이상이면 오염(DR.Cards)`

### Task 2: 코스에 가짜 카드

**Files:** Modify `data/js/stream.js`, `data/tests/stream.test.mjs`, `data/tests/m1-browser.mjs`(보충 단언)

**Interfaces:**
- Consumes: `mission.fakes[].{id,count}`
- Produces: 코스 카드 `{kind:'card', fakeId}`(uid `c#`); 보충 코스에 가짜 1장 = `mission.fakes[seed % fakes.length]`

- [ ] **Step 1: 실패하는 테스트**(`stream.test.mjs`, 테스트 안에서 `m1F = {...m1, fakes:[{id:'f_a',label:'day_deep',truth:null,count:2},{id:'f_b',label:'night_wet',truth:null,count:2}]}`):
  - `fake counts match mission`: 종류마다 `count`장.
  - `no fake in the first 15%`: 모든 가짜 `z >= course.length * 0.15`.
  - `no wall right before a fake`: 가짜와 같은 레인, z 앞 `rareWallGap` 안에 벽 없음.
  - `same seed same course` with fakes.
  - `supplement has one fake`: `build(m1F, cfg, {seed:5, focusCounts:{night_deep:2}})` 가짜 정확히 1장.
  - `missions without fakes unchanged`: `build(m1, cfg, {seed:1101})`의 카드 수가 기존과 같다(fakes 없는 m1).
- [ ] **Step 2: 실패 확인** — `node --test "data/tests/*.test.mjs"` FAIL(fakeId 없음).
- [ ] **Step 3: 구현** — `FAKE_FROM = 0.15` 상수. 덱에 `{fakeId}` 추가, 배치 뒤 앞 15% 줄에 놓인 가짜는 15% 뒤 줄의 가짜 아닌 카드와 맞바꾼다(같은 rng로 결정적). `isRare`는 fakeId에 false. 불꽃 배치 규칙은 그대로.
- [ ] **Step 4: m1-browser 시나리오 C의 보충 단언**을 `items.filter(i => i.kind==='card' && i.key)`로 바꾼다(보충에 가짜 1장이 생겨도 key 카드 10장 단언 유지). Ruling 없이 계획된 변경.
- [ ] **Step 5: 통과 확인** — 단위 PASS.
- [ ] **Step 6: 커밋** — `feat(data): 코스에 가짜 카드 — 앞 15% 없음·벽 없음·보충 1장`

### Task 3: 1 임무 가짜 데이터 + 그림

**Files:** Modify `data/missions/m1.js`, `data/js/cardart.js`, `data/tests/missions.test.mjs`, `data/tests/cardart-browser.mjs`

**Interfaces:**
- Produces: `m1.fakes`(아래 값), `m1.outcomeText = { pass:'제대로 판단했다', inconvenience:'멀쩡한 길을 막았다 · 불편', danger:'잠긴 길을 통과시켰다 · 위험' }`, `m1.next = 'm2'`, `DR.CardArt.card(mission, fakeId, variant, size)`가 가짜 그림을 돌려준다.

`m1.fakes` (spec §4):
| id | name | label | truth | count | art | line |
|---|---|---|---|---|---|---|
| `f_pool` | 수영장 | `day_deep` | null | 2 | `{ place:'pool', time:'day' }` | 우리가 넣은 데이터에 수영장 사진이 '깊은 침수'로 섞여 들어갔다. |
| `f_fountain` | 분수 광장 | `day_shallow` | null | 2 | `{ place:'fountain', time:'day' }` | 우리가 넣은 데이터에 분수 광장 사진이 '얕은 침수'로 섞여 들어갔다. |
| `f_fridge` | 냉장고 | `night_wet` | null | 2 | `{ object:'fridge' }` | 우리가 넣은 데이터에 냉장고 사진이 '비에 젖은 밤 도로'로 섞여 들어갔다. |

수거봇 도입 대사 `{ who:'bot', text:'삐빅! 침수 사진 3,000장 확보! 이름표도 제가 다 붙였어요! 임무 완료!' }`(기존 수거봇 줄 교체).

- [ ] **Step 1: 실패하는 테스트**(`missions.test.mjs`): `m1 fakes are well-formed`(label이 cardTypes key, truth null 또는 key, count ≥1, line이 `/^우리가 넣은 데이터에 .+\.$/`), `m1 fake scenes`(`DR.Cards.scenesForLabel`로 f_pool·f_fountain → `['S1']`, f_fridge → `['S3','S4']`), `m1 passes in 30 cards avoiding fakes`(ALL2 + 나머지 흔한 카드로 30장 → allPass), `m1 outcomeText has three kinds`, `no forbidden copy`가 fakes 문구도 검사. `cardart-browser.mjs`: 가짜 3종 `std > 10`, 시트에 가짜 3종 + 24칸 썸네일 추가.
- [ ] **Step 2: 실패 확인** — 단위 FAIL / `node data/tests/cardart-browser.mjs` FAIL(알 수 없는 카드).
- [ ] **Step 3: 구현** — `artOf`가 `mission.fakes`도 찾는다. `card()`가 `o.place==='pool'|'fountain'` → `drawPlace`(도로와 같은 하늘·건물 붓, 바닥 대신 파란 타일+레인 줄+사다리 / 둥근 수반+물줄기), `o.object` → `drawObject`(Task 7에서 물건이 늘어난다; 지금은 냉장고: 흰 세로 상자·손잡이·바닥 그림자, 배경은 동물 그림과 같은 단색 판). 24칸 썸네일에서 실루엣이 남게 큰 덩어리로.
- [ ] **Step 4: 통과 확인** — 단위 PASS, `cardart-browser` PASS, `tests/_shot-cardart.png`를 직접 열어 가짜 3종이 24칸에서 알아보이는지 본다.
- [ ] **Step 5: 커밋** — `feat(data): 1 임무 가짜 카드 3종(수영장·분수 광장·냉장고)`

### Task 4: 달리기 — 가짜 카드 앞면·잡기·첫 안내

**Files:** Modify `data/js/run3d.js`, `data/js/app.js`(debugFill), Create `data/tests/fakes-browser.mjs`, Modify `data/tests/run-all.mjs`

**Interfaces:**
- Consumes: `DR.Cards.artId`, `DR.Cards.iconsOf`
- Produces: `take`가 `g.fakeId` 보존 → `toBag`도 `{id, fakeId}`; `DR.App.debugFill({f_pool:1})` 지원; `DR.Run.peek().fakeHintShown`

- [ ] **Step 1: 실패하는 테스트**(`fakes-browser.mjs` 1부, `?run=m1`): 일시정지 후 `step`으로 첫 가짜가 러너 앞 `baseSpeed * catchLead * 2` 안에 들어올 때까지 진행 → `#run-hint` 보이고 텍스트 `그림이랑 이름표가 맞는지 봐!`, `peek().fakeHintShown` true; 두 번째 가짜에선 안내가 다시 뜨지 않음(그동안 hint 텍스트가 바뀌지 않음). 가짜 레인으로 가서 Space로 잡기 → `__runResult`/`grabbed`에 `fakeId`. `?start=m1`에서 `debugFill({f_pool:2})` 후 검수 격자에 `[data-key="f_pool"]` 2장. errors `[]`.
- [ ] **Step 2: 실패 확인** — `PLAYWRIGHT_MODULE=… node data/tests/fakes-browser.mjs` FAIL.
- [ ] **Step 3: 구현** — `cardTexture`가 `DR.Cards.artId/iconsOf` 사용(텍스처 캐시 키에 artId). 안내 거리 = `max(speed, baseSpeed) * catchLead * 2`, 레인 무관, 한 판 한 번(`S.fakeHintShown`, 시간 2.5초). 불꽃 안내와 겹치면 나중 것이 덮어써도 된다. `debugFill`은 `it.fakeId === id`도 찾는다. 인스펙트 격자 `data-key`는 `card.key || card.ambiguousId || card.fakeId`.
- [ ] **Step 4: 통과 확인** — fakes-browser 1부 PASS, `run-all` 전부 PASS.
- [ ] **Step 5: 커밋** — `feat(data): 달리기에 가짜 카드 — 같은 연출, 첫 가짜에만 안내 한 줄`

### Task 5: 검수·결과·보충 — 오염 문구와 "다시 제출"

**Files:** Modify `data/js/ui-inspect.js`, `data/js/ui-result.js`, `data/js/app.js`, `data/tests/fakes-browser.mjs`

**Interfaces:**
- Consumes: `DR.Cards.iconsOf/currentLabel/scenesForLabel`, `judge(...).scenes[].contaminated`, `DR.Judge.contaminationLines`
- Produces: `DR.UI.supplementPrep(mission, result, bag, done)`의 `done(bag, { resubmit: boolean })`; 결과 장면 `.result-scene`에 오염 문구 `p.contam`; 결과 칩 문구는 `mission.outcomeText`

- [ ] **Step 1: 실패하는 테스트**(`fakes-browser.mjs` 2부, `?start=m1`, 1366·375):
  - `contaminated scene`: `debugFill({...ALL2, f_pool:1, f_fountain:1})` → 검수 장면 모아 보기 S1 줄에 썸네일이 6장(ALL2의 day_deep 2 + day_shallow 2 + 가짜 2) → 제출 → S1 `data-outcome="inconvenience"`, 페이지에 수영장·분수 광장 문구 둘, 나머지 pass.
  - `resubmit without run`: 이어서 보충 준비 — 모자란 조합이 없으므로 `#btn-supplement` 글자 `다시 제출`, 빈칸이 6칸 미만이어도 enabled. 가짜 2장 빼고 누르면 `#screen-supervisor`로 바로(달리기 화면을 거치지 않음, `DR.Run.peek().running` false), 확인 → 모두 pass, `App.state.supplements === 1`.
  - `resubmit still counts`: 다시 제출로 `maxSupplements`(2)를 다 쓰고도 실패면 마무리(선배 대사)로.
  - `needs run when short`: `debugFill({...ALL2, day_deep:0, f_pool:2})` → 보충 준비 버튼 `보충 달리기 출발`, 기존 칸 조건 그대로.
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** —
  - 검수: `iconRow`·장면 모아 보기·크게 보기를 `DR.Cards`로("?" 카드는 기존 `effectiveKey` 유지, 아닌 카드는 `scenesForLabel(currentLabel)`에 든 장면 줄에 표시).
  - 결과: 칩 = `mission.outcomeText[outcome]`(없으면 기존 문구), 빠진 조합 문구 뒤에 그 장면의 오염 문구(`contaminationLines`를 장면별로 — `contaminated`의 source마다 한 줄) `p.missing.contam`.
  - 보충 준비: 매 렌더에 `DR.Judge.shortfall(mission, bag, cfg)`가 비면 버튼 글자 `다시 제출`·칸 조건 없음·안내 문구 "모자란 카드는 없다. 가방을 정리했으면 다시 제출하자."; `done(bag, {resubmit:true})`.
  - app `prepSupplement`: `resubmit`이면 `supplements++` 후 `askSupervisor(m)`.
- [ ] **Step 4: 통과 확인** — fakes-browser·m1-browser·run-all PASS.
- [ ] **Step 5: 커밋 + 1부 push** — `feat(data): 오염 결과 문구·가짜만 빼면 달리지 않고 다시 제출` → `git push origin data`. `data/CLAUDE.md` "지금 상태"에 가짜 카드 한 줄 추가(같은 커밋).

### Task 6: 2 임무 데이터 + 컨베이어 분류 규칙

**Files:** Create `data/missions/m2.js`, `data/js/conveyor.js`, `data/tests/conveyor.test.mjs`; Modify `data/missions/cast.js`, `data/js/config.js`, `data/tests/missions.test.mjs`, `data/index.html`(m2.js, conveyor.js)

**Interfaces:**
- Produces `DR.Missions.m2`: `id:'m2', title:'분리배출 분류 AI', bag:30, runSeconds:90, supplementSeconds:30, seed:2201, fires:6`, `labels`(7), `cardTypes`(각 `label`, `name`, `art`, 드문 것 `rare`, 건전지 `hazard`), `ambiguous: []`, `counts`, `fakes`(4), `scenes`(4, 모든 장면에 `cuts.danger`·`cuts.inconvenience`), `conveyor`(12), `outcomeText`, `story`.
- Produces `DR.Conveyor.sort(mission, judged) → [{ id, art, variant, scene, bin, correctBin, correct, cause }]`(`mission.conveyor` 순서, `cause` = 일어난 첫 원인 또는 null), `DR.Conveyor.happened(judged, cause) → boolean`(원인: 조합 id ∈ 그 장면 `missing` / fake id ∈ 어느 장면 `contaminated` / `'contaminated:S#'` = 그 장면 `contaminated` 비어 있지 않음).
- `config.conveyor = { step: 1.2 }`(초/물건, 2배속은 절반).

값(spec §5.2·5.3):
- `labels`: can 캔 · pet 투명 페트 · pack 종이팩 · paper 종이 · vinyl 비닐 · battery 건전지 · trash 일반쓰레기 (아이콘 이름 = id).
- `cardTypes`/`counts`: can_drink(can) 9 · pet_clear(pet) 8 · vinyl_bag(vinyl) 6 · paper_news(paper) 7 · pack_milk(pack) 5 · can_tin(can, rare) 3 · pet_crushed(pet, rare) 3 · trash_misc(trash, rare) 3 · battery_aa(battery, rare, hazard) 3.
- `fakes`: f_receipt 영수증 label paper truth trash_misc ×3 · f_toothbrush 칫솔 label pet truth trash_misc ×2 · f_battery 건전지 label can truth battery_aa ×3 · f_cat 고양이 label vinyl truth null ×2(art `{animal:'cat'}`).
- `scenes`: S1 음료 캔과 통조림 캔 [can_drink 2, can_tin 2(boundary)] · S2 찌그러진 페트병과 비닐 [pet_clear 2, pet_crushed 2(boundary), vinyl_bag 2] · S3 우유팩·신문지·영수증 [pack_milk 2, paper_news 2, trash_misc 2] · S4 캔 사이에 섞인 건전지(emphasis low) [battery_aa 2 danger, can_drink 2]. missingLine은 m1 형식.
- `conveyor` 12개(art, scene, bin → wrongBin, causes): can_drink S1 can→vinyl [S1_can_drink, contaminated:S1] · can_tin S1 can→trash [S1_can_tin] · battery_aa S1 battery→can [f_battery] · pet_clear S2 pet→vinyl [S2_pet_clear, contaminated:S2] · pet_crushed S2 pet→trash [S2_pet_crushed] · vinyl_bag S2 vinyl→trash [S2_vinyl_bag, f_cat] · f_toothbrush S2 trash→pet [f_toothbrush] · pack_milk S3 pack→paper [S3_pack_milk, contaminated:S3] · paper_news S3 paper→trash [S3_paper_news] · f_receipt S3 trash→paper [f_receipt, S3_trash_misc] · battery_aa S4 battery→can [S4_battery_aa, f_battery, contaminated:S4] · can_drink S4 can→trash [S4_can_drink]. 모두 variant ≥ 3(학습 카드는 0~2).
- `story`: intro(감독관 상황 · 수거봇 "삐빅! 분리배출 사진 5,000장! 이름표도 제가 다 붙였어요!" · 선별장 직원 피해 · 안내 AI 불꽃 경보 · 선배 "다음엔 나랑 같이 달려 보자" · 감독관 출동), `guideBrief`, `recordLine: { firstTry, supplemented }`(1 임무 기록 한 줄), `supervisorQuestion`, `conveyorIntro: { who:'supervisor', text:'그럼, 실제로 돌려 보자.' }`, `emergency: { who:'supervisor', text:'비상 정지! 캔 함에 건전지가 들어갔어.' }`, `responsibility`, `clientPass`/`clientFail`(sorter), `senior`(끝 — "기계가 틀리면 결국 사람이 다시 골라야 하잖아." 결), `outro`(규칙 기반 시뮬레이션 안내 2줄). cast에 `sorter: 선별장 직원`.

- [ ] **Step 1: 분리배출 사실 확인** — WebSearch로 환경부 분리배출 안내에서 영수증(감열지)·칫솔 = 종량제, 폐건전지 = 전용 수거함, 종이팩 ≠ 종이, 투명 페트 = 라벨 제거·찌그러뜨려 별도 배출을 확인. 다르면 위 표를 고치고 ledger에 `Ruling:`.
- [ ] **Step 2: 실패하는 테스트** — `missions.test.mjs`: `m2 well-formed`(조합 keys·fake label·truth·conveyor art/bin/causes가 모두 존재하는 것을 가리킴, 모든 장면에 두 cuts), `m2 passes in 30 cards avoiding fakes`, `m2 fixing fakes also passes`(f_receipt를 `label:'trash'`로 고친 카드가 S3 trash를 채움), `m2 every scene can fail`(장면마다 그 장면만 실패하는 가방 존재 — 조합 하나 빼기), `f_battery x2 fails S1 and S4 as danger`, `no forbidden copy`·`missingLine format`·`cast covers every speaker`를 m2까지. `conveyor.test.mjs`: `all correct when nothing failed`, `every cause has an item`(m2의 모든 조합 id·fake id·`contaminated:S1..S4`가 어떤 물건의 causes에 있음), `deterministic`, `receipt goes to paper when f_receipt contaminates`, `passing scene items are all correct`(무작위 가방 50개에 대해 pass 장면 물건은 correct).
- [ ] **Step 3: 실패 확인** — `node --test "data/tests/*.test.mjs"` FAIL.
- [ ] **Step 4: 구현** — m2.js·conveyor.js(UMD)·cast·config.
- [ ] **Step 5: 통과 확인** — 단위 전부 PASS.
- [ ] **Step 6: 커밋** — `feat(data): 2 임무 데이터·컨베이어 분류 규칙`

### Task 7: 2 임무 그림

**Files:** Modify `data/js/cardart.js`, `data/tests/cardart-browser.mjs`

**Interfaces:**
- Produces: `card(m2, id, variant, size)`가 모든 m2 카드·가짜·컨베이어 물건(variant 3~4)을 그림; `icon(name)`에 can·pet·pack·paper·vinyl·battery·trash; `scene(m2, S#, 'neutral'|'pass'|'danger'|'inconvenience', size)` = 선별장 컷(벨트 + 함, pass 체크 / inconvenience 잘못된 함 + 사람 실루엣 손으로 고름 / danger 압착기 불꽃 + 감독관 멈춤 손 + 비상 버튼). 지하차도 없음.

- [ ] **Step 1: 실패하는 테스트** — `cardart-browser.mjs`: m2 카드 9종·가짜 4종·컨베이어 variant 3·4 전부 `std > 10`, 같은 종류 variant 0과 3이 다름, 아이콘 7종이 서로 다르고 기존 9종과도 다름(16종 고유), m2 장면 4×4 컷 `std > 10`. 시트에 m2 전부 + 24칸 썸네일(영수증·종이·칫솔·페트·건전지·캔 나란히).
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — `drawObject`에 물건(음료 캔·통조림 캔·투명 페트·찌그러진 페트·비닐봉지·신문지/상자·우유팩·일반쓰레기 묶음·AA 건전지·영수증·칫솔·냉장고). 같은 바탕 판(동물 그림과 같은 단색 + 바닥 띠) 위 가운데 한 물건, variant로 색·각도·찌그러짐. 고양이는 기존 `drawAnimal`. **영수증↔신문지, 칫솔↔페트, 건전지↔캔**이 24칸에서 구별되게(영수증 = 길고 좁은 흰 띠+회색 줄, 칫솔 = 가는 막대+솔, 건전지 = 작은 원통++극 마크).
- [ ] **Step 4: 통과 확인** — PASS, `_shot-cardart.png` 직접 확인.
- [ ] **Step 5: 커밋** — `feat(data): 2 임무 물건·이름표 아이콘·선별장 컷 그림`

### Task 8: 이름표 고치기(검수·보충 준비)

**Files:** Modify `data/js/ui-inspect.js`, `data/css/style.css`, Create `data/tests/m2-browser.mjs`, Modify `data/tests/run-all.mjs`

**Interfaces:**
- Consumes: `DR.Cards.*`, `mission.labels`
- Produces: 크게 보기 창(검수 `#inspect-zoom`, 보충 준비 `#prep-zoom`)에 `mission.labels`가 있으면 버튼 `[data-relabel="<id>"]`(지금 이름표 `aria-pressed="true"`); 누르면 `card.label = id`(원래 이름표와 같으면 `delete card.label`); 격자 카드 `.bag-card.fixed` + `.bag-fixed` "고침".

- [ ] **Step 1: 실패하는 테스트**(`m2-browser.mjs` 1부, `?start=m2`, 1366·375): `debugFill({ ...M2_ALL2, f_receipt:1 })`(M2_ALL2 = m2 조합 key 2장씩) → 검수에서 f_receipt 카드 열기 → 버튼 7개, `paper` 눌림 → `trash` 누름 → 격자에 "고침", S3 모아 보기 줄로 옮겨 감(일반쓰레기 기준). `relabel back clears fixed`: 다시 `paper` → "고침" 사라짐. 보통 카드(can_drink)도 버튼 7개(가짜만이 아님). 1 임무(`?start=m1`) 크게 보기에는 `[data-relabel]` 0개. 보충 준비에서도 카드를 눌러 `#prep-zoom`에서 고칠 수 있다. errors `[]`.
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — 크게 보기를 `openZoom(mission, card, host, rerender, zoomId)` 하나로 빼서 검수·보충 준비가 함께 쓴다(기존 "?" 카드 단서·설명표 부분 유지, keydown 정리 함수 하나 규칙 유지). 보충 준비 격자에 `onOpen` 연결.
- [ ] **Step 4: 통과 확인** — m2-browser 1부·m1-browser·fakes-browser PASS.
- [ ] **Step 5: 커밋** — `feat(data): 2 임무 검수 — 이름표 고치기(검수·보충 준비)`

### Task 9: 컨베이어 화면 + 결과 연결

**Files:** Create `data/js/ui-conveyor.js`; Modify `data/index.html`(`#screen-conveyor`, 스크립트), `data/css/style.css`, `data/js/app.js`(SCREENS·`judgeAndShow`), `data/js/ui-result.js`, `data/tests/m2-browser.mjs`

**Interfaces:**
- Consumes: `DR.Conveyor.sort`, `DR.CardArt.card/thumb/icon`, `mission.story.conveyorIntro/emergency/responsibility`, `config.conveyor.step`
- Produces: `DR.UI.conveyor(mission, judged, done)`; DOM `#screen-conveyor`, `.cv-bin[data-bin]`(7), 물건 `.cv-item[data-id][data-bin][data-correct]`, `#btn-cv-fast`(aria-pressed), `#btn-cv-skip`, 정지 창 `#cv-stop` + `#btn-cv-resume`, 끝나면 `#btn-cv-next`. `DR.UI.result`는 `mission.conveyor`가 있으면 각 장면 페이지에 그 장면 `correct:false` 물건 썸네일 `.result-wrong img`.

- [ ] **Step 1: 실패하는 테스트**(`m2-browser.mjs` 2부):
  - `all pass flow`: M2_ALL2 제출 → 확인 → `#screen-conveyor`(감독관 "그럼, 실제로 돌려 보자."), 건너뛰기 → 12개 모두 `data-correct="true"` → `#btn-cv-next` → 장면 결과 4장 pass → 마무리.
  - `receipt to paper`: `{...M2_ALL2, f_receipt:2}` → 컨베이어 끝 상태에서 f_receipt 물건이 `data-bin="paper"`·`data-correct="false"` → S3 결과 페이지에 `.result-wrong img` ≥1과 영수증 문구.
  - `emergency stop`: `{...M2_ALL2, battery_aa:0}` → 2배속으로 진행(`page.clock` 대신 `config.conveyor.step`을 0.05로 바꿔 둠) → `#cv-stop` 보이고 책임 대사 → `#btn-cv-resume` → 끝까지.
  - `skip during stop`: 정지 창이 떠 있을 때 `#btn-cv-skip` → 끝 상태, `#btn-cv-next` 한 번 눌러 결과로 한 번만 감(결과 화면 1번째 장면).
  - `no numbers`: 컨베이어 화면 텍스트에 `/\d+\s*\/\s*\d+|%|\d+개/` 없음.
  - `conveyor fits 375`: 375 폭에서 `document.documentElement.scrollWidth <= 375`.
  - `reduced motion`: `emulateMedia({reducedMotion:'reduce'})` → 화면이 열리자마자 12개 모두 함에 들어간 상태.
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — 벨트(가로 띠) 위로 물건이 한 개씩 들어와 집게가 함으로 옮기는 CSS transition(시간 = `step`, 2배속 절반). 함은 2줄 그리드(375에선 4+3). 틀리면 빨간 테두리·맞으면 초록. 위험물이 틀린 함으로 가면 진행을 멈추고 `#cv-stop`(불꽃 효과·`emergency`·`responsibility` 대사·`burn` 효과음). 건너뛰기 = 남은 물건을 바로 최종 위치로, 정지 창 닫기, 타이머 정리 — `done`은 `#btn-cv-next`에서만, 한 번만. app `judgeAndShow`: `m.conveyor`면 `conveyor → result`, 아니면 기존. 1 임무 결과는 바뀌지 않는다.
- [ ] **Step 4: 통과 확인** — m2-browser·run-all PASS.
- [ ] **Step 5: 커밋** — `feat(data): 2 임무 결과 — 컨베이어 실제 분류(비상 정지·2배속·건너뛰기)`

### Task 10: 임무 선택·임무 잇기·기록 한 줄 + 문서

**Files:** Modify `data/index.html`(타이틀), `data/css/style.css`, `data/js/app.js`, `data/js/ui-story.js`, `data/tests/boot-browser.mjs`, `data/tests/m2-browser.mjs`, `data/CLAUDE.md`, `data/README.md`

**Interfaces:**
- Produces: 타이틀 `#btn-start`(처음부터) + `.title-missions` 안 `#btn-m1`, `#btn-m2`; `DR.UI.briefing(mission, done, extraLine)`(extraLine 있으면 안내 AI 줄 하나 더); `DR.UI.outro(lines, done, { kicker, next })` — `next`가 있으면 `#btn-next-mission`("다음 임무로"), `#btn-again` 글자 "타이틀로"; `DR.App.records = { m1: {firstTry, supplements} }`.

- [ ] **Step 1: 실패하는 테스트** — `boot-browser`: 타이틀에 세 버튼, `#btn-m2` → m2 도입 대화. `m2-browser` 3부: `m2 direct entry`(기록 없음 → 브리핑에 recordLine 두 문구 모두 없음), `m1 to m2`(`?start=m1` 첫 판 통과 → 마무리 `#btn-next-mission` → m2 브리핑에 `recordLine.firstTry`), `m2 replay`(m2 마무리 → 타이틀 → `#btn-m2` → 가방 비어 있음·`supplements 0`).
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — `finishMission`이 `App.records[m.id]`를 남기고 `outro`에 `{ kicker: m.title + ' 완료', next: m.next }`. `startMission(id)`가 이전 임무 기록으로 `extraLine`(`App.records.m1.firstTry ? recordLine.firstTry : recordLine.supplemented`, m2에만). 디버그 `?start=m2`·`?run=m2`는 기존 경로로 이미 됨(확인만).
- [ ] **Step 4: 통과 확인** — 단위 전부 + `run-all` 전부 PASS. 스크린샷 핵심만: `_shot-conveyor-1366.png`, `_shot-conveyor-375.png`, `_shot-relabel-375.png` 직접 확인.
- [ ] **Step 5: 문서** — `data/CLAUDE.md`(지금 상태·구조 표에 cards/conveyor/ui-conveyor/m2·테스트 수·함정), `data/README.md`(임무 고르기·2 임무 안내).
- [ ] **Step 6: 커밋 + push** — `feat(data): 타이틀 임무 고르기·1→2 임무 잇기·기록 한 줄` → `git push origin data`.
