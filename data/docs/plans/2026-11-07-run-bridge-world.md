# 달리기 무대 개편 1차(빛의 다리) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 연습·1 임무(밤)·3 임무(낮)의 달리기 무대를 "도시 위를 잇는 빛의 다리"로 바꾼다. 코스·판정·속도는 그대로.

**Architecture:** 겉모습 데이터(색·구역별 색조)는 순수 모듈 `js/bridge-look.js`(node 단위 테스트), 그리는 쪽은 새 모듈 `js/run-world.js`(DR.RunWorld) 하나. 하늘·지평선 도시 그림은 3D가 아니라 `#run-stage` 안 캔버스 **뒤의 CSS 층**(file:// 더블클릭에서 WebGL 텍스처 보안 문제 회피, 시작 화면과 같은 방식), 다리·레인·다리 아래 불빛·스파크는 three.js. `run3d.js`는 임무에 `world`가 있으면 RunWorld를 만들고 기본 바닥·격자·상자 빌딩을 숨긴다. 구역 색조는 기존 `DR.RunScenery`가 RunWorld에 `look(zoneId)`로 넘긴다.

**Tech Stack:** 클래식 `<script>` + 전역 `DR`, three.js r149(`vendor/`), CSS, node:test, Playwright(msedge 헤드리스).

**Spec:** `data/docs/specs/2026-11-07-run-bridge-world-design.md`

## Global Constraints

- ES 모듈·fetch 금지(`file://`로 열림). 새 파일은 기존 모듈처럼 `(function(root){…})(typeof window!=='undefined'?window:globalThis)` + `module.exports`.
- 바뀌면 안 되는 것: 코스(카드·벽·불꽃 자리·uid, 스냅숏), 잡기·판정·저장, `config.js` 수치, **2·4 임무 모습**(`sorting`·`exam` 무대 그대로), 길 모양(곧은 3레인).
- 그림 안 글자·숫자 없음. 새 그림은 webp, 한 세트(밤/낮) 약 640KB 이내.
- `?low=1`·`prefers-reduced-motion`: 비·스파크·흐르는 배경 층·다리 아래 불빛 흐름을 멈춘다(정적 하늘·다리는 보임).
- 밤 바닥 = 어두운 남색 철판(`#16162f` 기준), 가로 격자줄 없음(철판 이음매만 아주 흐리게), 레인 줄 가늘고 흐리게, **가장 밝은 빛 = 다리 양쪽 가장자리**, 젖은 네온 반사는 레인 가운데를 피해 흐리게.
- 낮(3 임무) = 밝은 청회색 철판(하늘보다 어둡게), 가장자리 청록 은은하게, 비·젖은 바닥은 S4에만, S2는 저녁빛(등불).
- 네온 색이 카드·벽 색과 겹치면 색은 지키고 밝기·크기·위치로 양보.
- 브라우저 테스트는 한 번에 하나(`PLAYWRIGHT_MODULE=D:/Works/token_economy/node_modules/playwright`). 전체는 `node data/tests/run-all.mjs`를 백그라운드로.

## Review Focus

1. **플래그 없이 더블클릭(file://)** — `--allow-file-access-from-files` 없이도 하늘·도시가 보여야 한다(테스트는 그 플래그로 돌아서 놓치기 쉬움) → Task 2에 플래그 없는 브라우저로 여는 확인.
2. **세로 휴대폰(375×812) 지평선 맞춤** — 세로는 카메라 fov 74·높이 4.6이라 지평선 높이가 다르다. 도시 그림 밑변이 지평선에서 뜨거나 다리를 가리면 안 됨 → Task 2·4 스크린샷 375 + `--rw-horizon` 값이 화면 안(0.15h~0.6h).
3. **낮 바닥 위 분홍 벽** — 밝은 바닥에서 반투명 분홍 노이즈 벽이 묻힐 수 있다 → Task 1 대비 테스트(벽 대 바닥 ≥ 2.2, 미달이면 낮에만 벽 밑 어두운 접지 그림자) + Task 4 스크린샷.
4. **달리기를 여러 번 오갈 때(다시 달리기·보충·임무 바꾸기)** — CSS 층·rAF·Points가 남거나 겹치면 안 됨 → Task 2 테스트: 두 번 달린 뒤 `.rw-layer` 개수 그대로, 2 임무로 가면 0.
5. **그림을 못 읽을 때(낮 그림 파일 없음 등)** — 오류 없이 단색 하늘로 → Task 4 테스트(낮 그림 경로를 막고 열기).

---

## 파일 구조

| 파일 | 할 일 |
|---|---|
| Create `data/js/bridge-look.js` | 순수 데이터: 밤/낮 팔레트, 연습·1 임무·3 임무 구역별 look, `contrast(a,b)` |
| Create `data/js/run-world.js` | DR.RunWorld: CSS 배경층 + 3D 다리·레인·가장자리·다리 아래 불빛·스파크, look 적용, 정리 |
| Modify `data/js/run3d.js` | 임무 `world`면 RunWorld 생성·매 프레임 update·resize 때 지평선·stop 때 dispose, 기본 바닥/격자/빌딩 숨김, `peek().world` |
| Modify `data/js/run-scenery.js` | 새 테마 `bridge`(1 임무 구역 색조), `city`(3 임무)를 다리 위로 |
| Modify `data/missions/tutorial.js`·`m1.js`·`m3.js` | `world` 필드, m1 `scenery:'bridge'` |
| Modify `data/css/style.css`, `data/index.html` | `.rw-*` 규칙, 스크립트 2줄(`bridge-look.js`·`run-world.js`를 `run-scenery.js` 앞에) |
| Create `data/assets/title/bg-sky-day.webp`·`bg-far-day.webp`·`bg-mid-day.webp` | 낮 그림(PNG 원본은 커밋 안 함) |
| Test | `data/tests/bridge-look.test.mjs`(신규), `data/tests/bridge-browser.mjs`(신규), `m3-browser.mjs`·`zones-browser.mjs` 보강 |

---

### Task 1: 겉모습 데이터 `bridge-look.js` + 대비 단위 테스트

**Files:**
- Create: `data/js/bridge-look.js`
- Test: `data/tests/bridge-look.test.mjs`

**Interfaces:**
- Produces: `DR.BridgeLook = { PALETTE: { night: Pal, day: Pal }, look(missionId, zoneId) -> Look, contrast(hexA, hexB) -> number }`
  - `Pal = { deck, seam, lane, laneOpacity, edge, edgeOpacity, side, fog, lights: [hex,hex,hex], lightOpacity, reflect: [hex,hex], reflectOpacity }` (hex는 `'#rrggbb'` 문자열)
  - `Look = { id, time: 'night'|'day', tint: 'rgba(...)'|null, lightMix: [n,n,n] (합 1), rain: bool, wet: bool, lanterns: bool, river: bool }`
  - `look('tutorial', null)` 한 가지, `look('m1','S1'|'S2'|'S3')` 밤 3가지(서로 다른 tint·lightMix), `look('m3','S1'..'S4')` 낮 4가지, 그 밖의 임무/구역 → `look('tutorial', null)`.
- 값: night `deck '#16162f'`, `edge '#7ff9ff'`, `lights ['#ffd24a','#7ff9ff','#ff5fb0']`, `reflect ['#ff5fb0','#7ff9ff']`; day `deck`은 청회색 계열에서 아래 대비 조건을 만족하는 값(시작점 `'#5b6680'`), `edge '#a6e9f0'`, `fog '#cfe4ef'`. m3: S1 tint null·rain false / S2 저녁 tint(`rgba(120,60,90,.38)` 근처)·lanterns true / S3 river true / S4 tint 흐림(`rgba(60,70,90,.3)` 근처)·rain true·wet true.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/bridge-look.test.mjs`:

```js
const L = require('../js/bridge-look.js');
const CARD = '#f4f1ff', WALL = '#ff5fb0';
test('night deck: card ≥ 7, wall ≥ 4.5, edge brighter than lane', () => {
  assert.ok(L.contrast(CARD, L.PALETTE.night.deck) >= 7);
  assert.ok(L.contrast(WALL, L.PALETTE.night.deck) >= 4.5);
  assert.ok(L.PALETTE.night.edgeOpacity > L.PALETTE.night.laneOpacity);
});
test('day deck: darker than sky, card ≥ 4.5, wall ≥ 2.2', () => {
  assert.ok(L.contrast(L.PALETTE.day.deck, '#8fc8e8') >= 1.4, 'deck darker than sky');
  assert.ok(L.contrast(CARD, L.PALETTE.day.deck) >= 4.5);
  assert.ok(L.contrast(WALL, L.PALETTE.day.deck) >= 2.2);
});
test('looks: tutorial night, m1 3 distinct night zones, m3 4 day zones with props', () => {
  assert.equal(L.look('tutorial', null).time, 'night');
  const m1 = ['S1','S2','S3'].map((z) => L.look('m1', z));
  assert.ok(m1.every((l) => l.time === 'night'));
  assert.equal(new Set(m1.map((l) => l.tint + '|' + l.lightMix.join())).size, 3);
  const m3 = ['S1','S2','S3','S4'].map((z) => L.look('m3', z));
  assert.ok(m3.every((l) => l.time === 'day'));
  assert.deepEqual(m3.map((l) => l.rain), [false, false, false, true]);
  assert.ok(m3[1].lanterns && m3[1].tint, 'S2 evening');
  assert.ok(m3[2].river);
  assert.ok(m1.concat(m3).every((l) => Math.abs(l.lightMix.reduce((a, b) => a + b, 0) - 1) < 1e-9));
  assert.equal(L.look('m2', 'S1').id, L.look('tutorial', null).id, 'unknown → tutorial look');
});
```

- [ ] **Step 2: 실패 확인** — Run: `node --test data/tests/bridge-look.test.mjs` / Expected: FAIL (`Cannot find module '../js/bridge-look.js'`)
- [ ] **Step 3: `js/bridge-look.js` 작성** — 위 Interfaces 그대로. `contrast`는 WCAG 상대 휘도 비 `(L1+0.05)/(L2+0.05)`(큰 쪽이 위).
- [ ] **Step 4: 통과 확인** — `node --test "data/tests/*.test.mjs"` / Expected: 기존 230 + 3 모두 pass
- [ ] **Step 5: 커밋** — `git add data/js/bridge-look.js data/tests/bridge-look.test.mjs && git commit -m "feat(data): 빛의 다리 겉모습 데이터(밤·낮 팔레트, 구역 색조)와 대비 테스트"`

---

### Task 2: RunWorld — 연습 달리기를 밤 다리로

**Files:**
- Create: `data/js/run-world.js`
- Modify: `data/js/run3d.js` (`start` 634행 근처, `animate` 468행 근처, `resize` 562행, `stop` 667행, `peek` 705행)
- Modify: `data/missions/tutorial.js` (10행 `world: 'bridge'` 추가)
- Modify: `data/css/style.css` (달리기 절 40~44행 뒤에 `.rw-*`), `data/index.html` (97행 `run-scenery.js` 앞에 `bridge-look.js`, `run-world.js`)
- Test: `data/tests/bridge-browser.mjs` (신규, `run-all.mjs` 목록에 추가)

**Interfaces:**
- Consumes: `DR.BridgeLook.PALETTE`, `DR.BridgeLook.look(missionId, zoneId)`
- Produces: `DR.RunWorld.create(view, stage, opts) -> World`
  - `opts = { time: 'night'|'day', low: bool, reduced: bool, missionId: string, laneWidth: number }`
  - `World.look(zoneId|null)` — 그 구역 Look 적용(같은 id면 아무것도 안 함)
  - `World.update(z, t, speed)` — 다리 아래 불빛·스파크 재배치, 배경 층 시차 이동(low/reduced면 멈춤)
  - `World.setHorizon(px)` — `stage.style.setProperty('--rw-horizon', px + 'px')`
  - `World.state() -> { time, look, rain, moving, layers }` (`layers` = 붙은 `.rw-layer` 수)
  - `World.dispose()` — 붙인 DOM 층 제거, 만든 geometry/material/texture 정리
  - `view.world` = 만든 World(그다음 RunScenery가 씀)
- run3d: `S.mission.world`가 있으면 `S.view.world = DR.RunWorld.create(S.view, container, {...})`, `scene.background = null`, `view.ground/road/lines/buildings`를 `visible=false`. 매 프레임 `world.update(S.z, S.t, speed)`. 구역 없는 임무는 시작 때 `world.look(null)`. `resize()` 끝에서 `world.setHorizon(y)` — y = `new THREE.Vector3(S.camX, 0, -S.z - 300).project(S.camera)`의 화면 y(px). `peek().world = S.view.world ? S.view.world.state() : null`.

그리는 것(값은 PALETTE):
- **CSS 층**(`#run-stage` 안, 캔버스 앞 형제로 `insertBefore`): `.rw-sky`(전체, `bg-sky[-day].webp` cover), `.rw-far`·`.rw-mid`(밑변 = `--rw-horizon`, 높이는 지평선 위 약 0.32h·0.30h, `background-repeat:repeat-x`), `.rw-tint`(look.tint), `.rw-rain`(시작 화면 `.tl-rain`과 같은 SVG 빗줄기). 모두 `pointer-events:none`. 시차 = `transform: translateX()`를 JS가 갱신(far 느리게 < mid). 이미지 로드 실패 → 해당 층 숨김(`#run-stage`의 기존 그라디언트가 단색 하늘 역할).
- **3D**: 다리 상판(폭 = 레인 3개 + 1.2, 기존 `road` 자리, 캔버스 텍스처: deck 색 + 흐린 seam + 레인 바깥쪽 흐린 reflect 줄), 레인 줄 4개 중 안쪽 2개 폭 0.05·laneOpacity, 가장자리 2개 = edge 색 띠 + 상판 옆면(두께 0.6, side 색) 위 빛 선, 다리 아래 불빛 = `THREE.Points` 약 500개(low면 200), x는 |x| ≥ 상판 반폭+3, y −14~−3, 앞 150m 안에서 뒤로 빠지면 앞으로 재배치, 색 비율 = look.lightMix, 크기 작게·lightOpacity. 스파크 = 상판 바깥 양옆 몇 개의 짧은 노란 깜빡임(reduced/low면 없음). `scene.fog.color` = PALETTE.fog.

- [ ] **Step 1: 실패하는 브라우저 테스트 작성** — `tests/bridge-browser.mjs`, `openGame({ query: '?run=tutorial' })`(바로 달리기, `app.js debugRun`), 시계 멈춘 채(`DR.Run.setPaused(true)`) 검사:

```js
const w = await page.evaluate(() => DR.Run.peek().world);
assert.deepEqual([w.time, w.look, w.layers], ['night', 'tutorial', 5]);
assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.rw-sky')).backgroundImage.includes('bg-sky.webp')), true);
const hz = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('run-stage')).getPropertyValue('--rw-horizon')) / innerHeight);
assert.ok(hz > 0.15 && hz < 0.6, 'horizon on screen');
// 두 번째 달리기(다시 달리기 경로 또는 DR.Run.stop() 후 같은 임무 재시작) 뒤에도 층 5개, 그리고 2 임무로 가면 0
// ?low=1 → w.moving === false, w.rain === false ; page.emulateMedia({ reducedMotion: 'reduce' }) → w.moving === false
// 스크린샷: shotPath('bridge-tutorial-1366'), 375×812 → shotPath('bridge-tutorial-375')
```
  추가로 **플래그 없는 브라우저**(`chromium.launch({ channel:'msedge', headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'] })`, `browser.mjs`의 `openGame({ browser })`에 넘김)로 같은 진입 → `.rw-sky` 배경 이미지 로드됨(`new Image()`로 같은 URL `naturalWidth > 0`), 페이지 오류 0.
- [ ] **Step 2: 실패 확인** — `node data/tests/bridge-browser.mjs` / Expected: FAIL (`peek().world` null)
- [ ] **Step 3: `run-world.js`·CSS·index.html·tutorial.js·run3d 연결 구현** (위 Interfaces)
- [ ] **Step 4: 통과 확인** — `node data/tests/bridge-browser.mjs` PASS, 그다음 하나씩 `tutorial-browser.mjs`, `run-browser.mjs`, `readability-browser.mjs`, `runner-browser.mjs` PASS. 스크린샷 2장을 눈으로 확인(카드·벽·불꽃이 지금보다 덜 보이지 않는지).
- [ ] **Step 5: 커밋** — `git add data/js/run-world.js data/js/run3d.js data/missions/tutorial.js data/css/style.css data/index.html data/tests/bridge-browser.mjs data/tests/run-all.mjs && git commit -m "feat(data): 연습 달리기를 도시 위 빛의 다리로(픽셀 도시 배경층, 남색 철판, 다리 아래 불빛)"`

---

### Task 3: 1 임무를 밤 다리로(구역 색조)

**Files:**
- Modify: `data/missions/m1.js:14` (`scenery: 'sorting'` → `'bridge'`, `world: 'bridge'` 추가)
- Modify: `data/js/run-scenery.js` (`create`에 `'bridge'` 분기, 새 함수 `bridge(view, mission)`)
- Test: `data/tests/bridge-browser.mjs`에 묶음 추가, `data/tests/zones-browser.mjs`(2 임무 'sorting' 그대로 확인은 이미 있음)

**Interfaces:**
- Consumes: `view.world.look(zoneId)` (Task 2)
- Produces: `RunScenery` 테마 `bridge`: `update(id)` → `view.world.look(id)`, `state() -> { zone, theme: 'bridge', look }`. `scene.background`는 건드리지 않는다(null 유지).

- [ ] **Step 1: 실패하는 테스트** — `bridge-browser.mjs`에 `?run=m1` 달리기: `DR.Run.course().zones` 순서대로 `DR.Run.step`으로 각 구역 시작 +1m까지 굴리며 `peek().scenery` = `{ theme:'bridge', zone:id }`, `peek().world.look`이 구역마다 다름(3개 서로 다름), `getComputedStyle(.rw-tint).backgroundColor`도 구역마다 다름. 2 임무(`?run=m2`) 달리기는 `peek().world === null`, `peek().scenery.theme === 'sorting'`. 스크린샷 `bridge-m1-1366`.
- [ ] **Step 2: 실패 확인** — Expected: FAIL (theme 'sorting')
- [ ] **Step 3: 구현** — m1.js 두 필드, `run-scenery.js`에 `bridge()`.
- [ ] **Step 4: 통과 확인** — `bridge-browser.mjs`, `lost-browser.mjs`, `m1-browser.mjs`, `zones-browser.mjs`, `m2-browser.mjs` 하나씩 PASS. 코스 스냅숏은 `node --test "data/tests/*.test.mjs"`로 그대로.
- [ ] **Step 5: 커밋** — `git commit -m "feat(data): 1 임무 달리기를 밤 다리로(구역마다 하늘 색조·불빛 비율)"`

---

### Task 4: 3 임무를 낮 다리로

**Files:**
- Create: `data/assets/title/bg-sky-day.webp`, `bg-far-day.webp`, `bg-mid-day.webp` (도착한 PNG에서 브라우저 인코더로 변환 — 시작 화면 그림과 같은 방법, 알파 유지; 세 장 합계 ≤ 640KB, 넘으면 품질을 낮춤. PNG·preview·seam-check·ps1·json은 커밋 안 함 → `data/.gitignore`에 `assets/title/*-day*.png`, `assets/title/bg-day-preview.png`, `assets/title/make-day-layers.ps1` 추가)
- Modify: `data/missions/m3.js:25` (`world: 'bridge', worldTime: 'day'` 추가, `scenery: 'city'` 유지)
- Modify: `data/js/run-scenery.js` `city()` (166~210행) — `view.world`가 있으면: `scene.background`·안개·빌딩 색 바꾸지 않음, `view.world.look(id)`, 등불(S2)은 상판 위 아치 높이 그대로, 강물(S3)은 상판 아래(y ≈ −6, 상판 옆 x ≈ ±10), 비(S4)는 RunWorld의 rain이 맡으므로 city의 3D 빗줄기는 끈다
- Modify: `data/js/run3d.js` — `world` 생성 시 `time = mission.worldTime || 'night'`
- Modify: `data/js/app.js` — 3 임무 브리핑에서 낮 그림 3장 미리 받기(`new Image().src`, 한 번만)
- Test: `data/tests/m3-browser.mjs`(66행 근처 theme 확인 옆에 추가), `bridge-browser.mjs`

**Interfaces:**
- Consumes: `World`(Task 2), `look('m3', id)`(Task 1)
- Produces: `peek().scenery.theme === 'city'`(기존 테스트 그대로), `peek().world.time === 'day'`

- [ ] **Step 1: 실패하는 테스트** — `m3-browser.mjs`: 달리기에서 `peek().world.time === 'day'`, `.rw-sky` 배경이 `bg-sky-day.webp`; S1→S4 각 구역에서 `world.rain`이 `[false,false,false,true]`, S2 `.rw-tint` 색 ≠ S1. 스크린샷 `bridge-m3-S1..S4-1366`, `bridge-m3-S2-375`. `bridge-browser.mjs`: `page.route('**/bg-sky-day.webp', r => r.abort())`(또는 file://면 `requestfailed` 허용 목록에 넣고 파일명 바꿔 막기 대신 `DR.RunWorld` 쪽 이미지 오류 처리 경로를 직접 호출) → 페이지 오류 0, `.rw-sky` 숨김.
- [ ] **Step 2: 실패 확인** — Expected: FAIL (`world` null)
- [ ] **Step 3: 구현 + webp 변환**
- [ ] **Step 4: 통과 확인** — `m3-browser.mjs`, `play-browser.mjs`(3 임무 진짜 키 통과), `bridge-browser.mjs` 하나씩 PASS. 스크린샷 눈 확인: 낮 바닥 위 분홍 벽이 보이는지(안 보이면 Task 1 day deck을 더 어둡게 조정하거나 낮에만 벽 밑 접지 그림자 `#2b3350` 반투명 판 — 대비 테스트 다시).
- [ ] **Step 5: 커밋** — `git add` webp 3장·m3.js·run-scenery.js·run3d.js·app.js·.gitignore·테스트 → `git commit -m "feat(data): 3 임무 달리기를 낮 다리로(Codex 낮 도시 그림, 시장 저녁빛·학교 앞 비)"`

---

### Task 5: 회귀 확인 · 문서 · 배포

**Files:**
- Modify: `data/CLAUDE.md` (맨 위에 `## ★지금 상태 (2026-11-07, 달리기 무대 1차 = 빛의 다리)` — 구조·테스트·미확인 요약, 구조 표에 `bridge-look.js`·`run-world.js` 추가, 브라우저 테스트 개수)
- Modify: `data/tests/run-all.mjs` (Task 2에서 추가했으면 확인만)

- [ ] **Step 1: 단위 전체** — `node --test "data/tests/*.test.mjs"` / Expected: 233 pass, 0 fail
- [ ] **Step 2: 브라우저 전체(백그라운드)** — `node data/tests/run-all.mjs` / Expected: 모두 PASS(이번 변경 전에도 실패하던 것이 있으면 HEAD 사본과 비교해 같은 실패임을 보고)
- [ ] **Step 3: 2·4 임무 불변 확인** — `m2-browser`·`m4-browser` PASS + 그 달리기 스크린샷이 이전 `_shot-*`과 같은 무대(theme sorting/exam, world null)
- [ ] **Step 4: 사람 눈 스크린샷 묶음 확인** — `_shot-bridge-*` 전부 열어 반목표(카드 덜 보임·번쩍임·글자) 점검, 결과를 확인/미확인으로 기록(실기 PC 프레임·실제 학생 체감 = 미확인)
- [ ] **Step 5: 커밋·푸시·배포 사본** — `git commit -m "docs(data): 빛의 다리 인수인계"` → `git push origin data` → 배포 레포 `D:\Works\ethicity-data`에 바뀐 파일 복사(줄바꿈만 다른 사본) → `git commit -m "update: 데이터 러너 달리기 무대 빛의 다리"` → `git push origin main`
