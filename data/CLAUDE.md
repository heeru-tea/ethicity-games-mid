# CLAUDE.md — 「데이터 러너: 끊어진 도시」(data) 인수인계

## ★지금 상태 (2026-11-07, 달리기 무대 1차 = 「도시 위를 잇는 빛의 다리」)
- **사용자 결정(재논의 금지)**: "엑셀 위에서 달리는 느낌" → 방향 C(도시 위 빛의 다리), 바닥 = 시안 2번 어두운 남색 철판(눈이 덜 피곤, 카드·벽이 잘 보임). 연습·1 임무 = 밤 다리, **3 임무 = 낮 다리**, **2·4 임무 = 실내 무대 유지(2차에서 다듬기)**. 겉모습만(길 모양·코스·판정 그대로). 설계 `docs/specs/2026-11-07-run-bridge-world-design.md`, 계획 `docs/plans/2026-11-07-run-bridge-world.md`.
- **구조**: 임무 데이터 `world: 'bridge'`(+ 3 임무 `worldTime: 'day'`) → `run3d.js start`가 `DR.RunWorld.create`(`js/run-world.js`), 기본 바닥 격자·상자 빌딩 숨김, `peek().world`. 색·구역 모습은 `js/bridge-look.js`(순수, node 테스트 — 밤 바닥 `#16162f`, 낮 바닥 `#535d76`은 분홍 벽 대비 2.2 때문에 계획보다 어둡게, 낮에만 노이즈 벽 = 흰·분홍·연분홍 + 불투명도 0.9 — 진분홍 칸이 낮 바닥과 밝기가 같아서, 리뷰 I1). 1 임무 `scenery: 'bridge'`(구역마다 하늘 색조·다리 아래 불빛 비율), 3 임무 `scenery: 'city'`는 다리 위에서 소품만(등불 S2·강물 다리 아래 S3), 비 = 다리가 S4만.
- **하늘·도시 그림 = 캔버스 뒤 CSS 층**(`.rw-sky/.rw-far/.rw-mid/.rw-tint/.rw-rain`, `#run-stage` isolation + z-index −1). WebGL 텍스처가 아니라서 file:// 더블클릭에서도 막히지 않음(플래그 없는 브라우저로 테스트). 도시 밑변 = `--rw-horizon`(매 프레임 지평선 투영). 그림 못 읽으면 그 층만 숨김 → `#run-stage` 그라디언트가 단색 하늘. 낮 그림 `assets/title/bg-*-day.webp`(Codex, 원본 PNG·preview·ps1은 gitignore), 3 임무 브리핑 때 `DR.RunWorld.preload`.
- 젖은 네온 반사는 레인 밖 여백에만(레인 위에 띠가 지면 카드·벽과 겹침). `?low=1`·움직임 줄이기 = 비·시차·스파크 멈춤(`peek().world.moving`).
- 테스트: 단위 `bridge-look.test`(대비·구역 모습) · 브라우저 `bridge-browser`(연습 밤 1366·375, 다시 달려도 층 5개, 2 임무로 가면 0, low/reduced, 플래그 없는 file://, 1 임무 구역 3색, 그림 없음 대체) · `m3-browser`(낮·구역별 비·저녁빛). 스크린샷 `_shot-bridge-*`. 헤드리스 fps: 이전 16 → 23(상자 빌딩이 빠져 더 가벼움).
- ⚠️ `tutorial-browser`·`runner-browser`는 실시간 대기(30·60초)라 다른 브라우저 테스트 직후 묶어 돌리면 가끔 시간 초과 — 혼자 다시 돌리면 통과(이전 코드도 같은 성질).
- 미확인: 실제 학교 PC 프레임·체감, 실기기 휴대폰, 학생 반응. 2차 = 2·4 임무 실내 무대 다듬기(+1 임무 자기 실내 무대는 선택), 그다음 길 모양(휘기·오르내리기).

## 지금 상태 (2026-11-06, 오프닝·첫 시험 개편 + 1 임무 = 분실물 센터)
- **사용자 결정(재논의 금지)**: 침수 임무는 중학생에게 어려워 1 임무를 **분실물 센터 AI**로 교체. 설계 `docs/specs/2026-11-05-opening-tutorial-draft.md`(오프닝·첫 시험) + `docs/specs/2026-11-06-m1-lost-found.md`(1 임무).
- **옛 침수 임무** = `missions/legacy-flood.js`(id flood, `?start=flood`로만). 게임 흐름에 없음. 가짜·"?" 카드 엔진 테스트 자료로 남김(m4에 쓰이는 규칙을 지키려고) — 테스트의 `?start=flood`·`legacy-flood.js`는 이 때문.
- **오프닝** `js/ui-exam.js opening` + `missions/prologue.js`(beats: shelter·split·school·world·gate). 그림 `assets/story/opening/*.webp`(1280px, Codex 2026-11-06, 원본 PNG·프롬프트는 커밋 안 함, 없으면 그림 자리 숨김).
- **첫 시험**: 튜토리얼 카드 = 개 7·고양이 7 + 이름표 틀린 카드 2장(`fakes`, 코스 뒤 절반 `fakeFrom`, 달리는 중 안내 없음 `fakeHint:false`). 판정 `DR.Judge.exam`(사진 기준 수 + 이름표). 검수·시연 `examInspect/examDemo`. 틀린 카드를 안 가져오면 시험관의 연습 카드(`state.drill`, 가방·개수·판정 밖, 고쳐야 넘어감). 이름표만 틀리면 재달리기 없음. 달리기 목표 HUD는 사진 기준. 표기 '강아지' → '개'(문서 기준).
- **새 1 임무** `missions/m1.js`: 장면 3(우산·지갑·스마트폰), 조합 = 모습 6개 각 3장, `hideShapes`(이름표는 종류, 첫 검수까지 모습을 글로 안 알림, 결과·보충부터 모습 이름), `rareLate`(구역 앞 35%는 흔한 모습), 컨베이어 `holdBin`(모자란 모습만 '분류 보류' 칸, 비상 정지 없음). 사진 `assets/cards/lost-found/*.webp`(384², 원본 PNG는 커밋 안 함). 동기 "이상하게 놓인 사진은 그냥 빼자"는 m4 "이상한 건 빼자" 복선이라 유지.
- 옛 침수 저장: `App.resume`이 도로 카드를 보면 새 1 임무 브리핑으로 되돌림, 3 임무 정체 공개는 지금 장면 이름만 인용.
- 그림 대기(Codex): 임무 카드 썸네일(지금은 접힌 우산 사진을 임시로), 학생 초상(cast student — 지금 도형), 선별장 배경은 임시 재사용.
- 테스트: `exam.test`, `exam-browser`, `lost-browser`, `browser.mjs passExam`. 침수 전용 기대값은 `?start=flood`로 옮김.

## ★지금 상태 (2026-11-05, 노이즈 벽 페널티·벽 간격·연습 카드·실기 미션·끝맺음)
- **벽 페널티**(`config.wallPenalty`, `DR.Catch.dropCards`): 벽에 부딪히면 **이번 달리기에 담은** 카드 중 가장 최근 1장을 잃는다. 보충 때 들고 들어온 가방은 안 잃는다(이미 검수한 것 — 지시서엔 없던 판단). 빈 가방은 감속만, `invuln` 동안은 또 안 잃음. 연출 = `RunFeedback.drop`(구역 "이번 N장"도 같이 줄임), 잃은 수 = `state.lost`(저장 O, 옛 저장은 0) → 검수 `#inspect-lost`.
- **벽 간격 = 초 단위**(`config.rareWallGapSec`, 계단식 — 진행 0~0.4 2초 / 0.4~0.75 1.2초 / 0.75~ 0.6초, 거리 = 그 지점 속도 × 초). `stream.js`: 다른 카드와 겹치면 `rareGapRange` 안에서 벽만 비킨다. **카드 자리·uid는 스냅숏 그대로, 벽과 일부 불꽃만 달라짐** → 스냅숏 테스트는 카드만 비교(`tests/walls-helper.mjs`). 그 밖의 벽은 다음 줄에 카드가 있는 레인을 피하고, 자리가 없으면 세우지 않는다.
- ⚠️ 후반 0.6초 < `catchLead` 0.7초라, 벽 0.1초 앞에서 일찍 잡으면 그 벽에 부딪혀 **방금 잡은 드문 카드를 잃을 수 있다**. 또 후반도 벽을 옆으로 피하고 0.7초 안에 돌아오면 손해 없이 잡을 수 있다(강제가 아니라 선택). 수치는 `rareWallGapSec` 마지막 칸.
- **벽 모양**: 서 있는 반투명 벽(1.05m, 윗면 띠). 가까운 카드는 3D 위 DOM이라 벽을 가리므로, **같은 레인 앞에 안 지난 벽이 있는 카드는 벽을 지날 때까지 3D로만**(`behindWall`).
- **연습 카드** `#btn-practice`(임무 고르기 맨 앞): 세이브 있음 = `App.practiceTutorial`(브리핑부터, `state.practice`로 체크포인트 안 함, 끝나면 타이틀) / 세이브 없음(`Save.hasSave`, 튜토리얼 도중 체크포인트만 있는 경우 포함) = `startTutorial`(프롤로그부터, 끝나면 1 임무 도입 대화 → 브리핑) + "처음이라면 여기부터".
- **실기 미션 안내** `DR.UI.tutorialGoal`(첫 출발만, 다시 달리기엔 안 뜸, Esc = 브리핑). 목표 HUD `#run-goal`(`mission.runGoal`). 튜토리얼 need 5·가방 10이라 한쪽을 넘게 담으면 그 판은 통과 불가. 쏠림(한쪽 0 또는 목표 초과) = `fail`, 나머지 = `failFew`.
- **끝맺음**(`config.finish`, `beginFinish/finishStep`): 마지막 3초 게이트 → 통과 시 입력 잠금·1.2초 감속 → HUD 끔·0.8초 어두워짐(`#run-fade`, 화면이 바뀌어도 남음) → `onEnd` → 0.4초 걷힘. HP 0 = 0.5초 플래시 뒤 같은 페이드("연결 끊김"). 시간은 `step` 기준이라 **시계를 멈춘 테스트는 끝까지 step 해야 끝난다**. `finishNow`는 연출 없음. 건너뛰기는 0.3초 뒤부터(잡기 연타로 넘어가지 않게). `peek().finishing`이면 일시정지 불가.
- **가방 찬 뒤 가속**(`config.bagFullRush` 1.5배, 1/3초에 걸쳐): 카드를 잃으면 원래 속도.
- 테스트: `runner-browser`(진짜 키로 피하기·내주기, 진짜 시계 끝맺음, 연습 저장 유지) · `stream.test`(벽 규칙 × 5임무 × 17 seed). 단위 221, 브라우저 22개. 미확인: 실제 손맛(벽 페널티 난이도·간격), 실기기.

## ★지금 상태 (2026-11-03, 튜토리얼 개·고양이 카드 = fal 사진 C안)
- 튜토리얼 개·고양이 카드 그림 = 사진 `assets/cards/animals/d01~d08·c01~c08.webp`(384², 원본 `cards-pilot/plain/` 무손실 → q80 다시 저장, 16장 약 13만 바이트). 카드 번호(uid `c12` → 12) % 8로 고른다(같은 코스 = 같은 사진, 코스·판정·저장은 그대로). 아이콘·이름표는 지금처럼 코드가 얹음. `cardart.js` `card(mission, id, variant, size, n)` — n은 사진 카드만 쓴다(다른 임무 그림·variant 그대로).
- 미리 받기: 타이틀이 뜬 뒤 0.3초·`go('title'|'briefing'|'run')`(`DR.CardArt.preloadPhotos`, 한 번만, 기다리지 않음). 사진이 아직 없거나 못 읽으면 그 카드는 예전 Canvas 그림. 사진 썸네일(`thumb`)은 24칸 대신 48칸(튜토리얼엔 검수 화면이 없어 지금은 테스트 시트에서만 보임).
- `e01~e03`(경계 사진)도 같은 폴더에 있지만 **안 씀** — 튜토리얼에 "?" 카드(`ambiguous`)가 없다. 결과·브리핑 장면 그림(보호소 개+고양이)은 아직 Canvas.
- 테스트: `cardart-browser`(번호별 사진·48칸 썸네일·m1은 Canvas·없는 사진 → Canvas → `_shot-cardart-tutorial.png`), `tutorial-browser`(달리는 카드 사진 = 종류·번호와 맞음, 이름표 → `_shot-run-tutorial-1366/375.png`).

## ★지금 상태 (2026-11-02, 4 임무 「채점 AI」 + 도시 복구 화면 — 이야기 끝까지)
- **4 임무 완성**(계획 `docs/plans/2026-11-02-data-runner-m4.md` Task 1~7, 설계 §5·§7). `missions/m4.js`: 이름표 = 선택지 번호 1~5(`labels`), 가짜에만 7·8(`labelExtra`), `labelStyle:'digit'`(고치기·"?" 버튼 = 동그라미 숫자 하나, 375px 한 줄), 가짜가 쌓이는 장면은 데이터 `fake.scenes`(`DR.Cards.fakeScenes` — 이름표를 바꾸면 바뀐 이름표 기준). S2·S4 위험 / S1·S3 불편. 크게 기운 1·표 답을 다 빼면 S4는 반드시 실패(테스트).
- 흐름: 대화 → 브리핑 → 달리기(시험장 배경 `RunScenery` exam, S2·S4 들어설 때 선배 한 줄 `story.runLines`) → 검수 → 감독관 → **채점 시연**(`js/ui-grade.js`, 답안지 13장, 원인 규칙 = `DR.Conveyor.sort` + 새 원인 `any:가짜id`) → 장면 결과 → **결판**(`DR.Judge.readable` = S4 조합만, 대사 줄 `sheet` → 대화창 위 선배 답안 `DR.CardArt.sheet`, bg `showdown-senior.webp`) ─ 못 읽음 → "봐, 또 지웠잖아" → 동기 합류(`js/showdown.js`: 남은 보충 2 = NEW·뺄 수 있음 / 1 = 고정 "동기와 함께 넣음" / 0 = 고정 + 다시 제출) → 보충(동기 카드는 달리기 뒤 가방에, 그만큼 칸 비워 둠) → … ─ 읽음 → **도시 재연결 5/5** → 의뢰인(선생님·택배 기사) → (합류한 적 없으면) 동기 "챙겨 왔어" → 해커의 이후(bg `senior-after.webp`) → 마무리(토론 질문 2개, `#outro-questions`).
- **도시 복구 화면**(`js/ui-city.js`, `#screen-city`): 튜토리얼 끝 0→1, 1~3 임무 마지막 대화 뒤(칸이 늘었을 때만), 4 임무는 늘 →5. 칸 = `DR.Save.cityCount`(records.m1~m4 + records.tutorial, '처음부터'면 0). **그림 `assets/city/city-0..5.webp`는 아직 없음** → `<img>` 오류로 그림 자리 숨기고 점 5칸 + 문구. 파일만 그 이름으로 넣으면 저절로 쓰인다. 타이틀 왼쪽 위 배지 `#title-city`("도시 n/5", role=img).
- 손글씨 카드 = Canvas 같은 붓(`cardart.js` GLYPHS·PEN — 깃발 1↔7, 고리 3↔8, 각진 2↔5, 둥근 5↔2). 크게 기운 1 = 굵고 일정, 떨림 없음. 동기 "이상한 건 빼자" 한 줄이 1~3 임무 도입에도. 시험 이름 = "새빛 진학 평가"(3 임무도).
- ⚠️ 사용자 판단: Codex `showdown-senior.webp`의 답안지에 손글씨 "1"과 빨간 ✕가 그려져 있다(설계는 "그림 안 숫자·글자 없음") — 결판에서 읽었을 때(○)도 그림 속 ✕는 그대로. S1·S3도 플레이어가 위험 가짜(7·8·5)를 다른 틀린 번호로 고쳐 2장 쌓으면 위험이 될 수 있다(그 번호로 잘못 배움 = 맞게 쓴 답에 ✕, 의도로 둠). 동기 "챙겨 왔어"는 계획대로 재연결·의뢰인 줄 뒤(설계 §5.6은 "재연결 직전").
- 저장: 체크포인트에 `peer`·`peerPending`·`showdownPassed`. 4 임무 S4 구역은 짧다(seed 4401에서 약 8초 — 7·8 가짜가 이제 S2에 쌓여서, 설계 §5.9의 23초는 그 전 계산).
- 테스트: 단위 `m4.test`(27)·`city.test`·`save.test`·`reach.test`(4 임무) 추가, 브라우저 `m4-browser`(A 첫 판 S4 실패 → 동기 → 통과 1280·390 / B 첫 판 통과 / C 동기 카드 빼고 마지막 보충 고정 + 결판 그림 없음 / D 375px 버튼 / E 타이틀 배지·임무 카드 / F 표 답만 없음 → 결판 "답 없음 · 사람 채점"), `cardart-browser`(→ `_shot-cardart-m4.png`). 앞 임무 브라우저 테스트는 `passCity`로 도시 화면을 지난다.

## 지금 상태 (2026-11-02, 달리기 배경음악 「Arcade Rush」)
- **배경음악** `js/bgm.js`(DR.Bgm) + `assets/bgm/arcade-rush.mp3`(사용자 Suno 곡, 원본 3.9MB → 112kbps 44.1kHz 스테레오 2.3MB·2:46.8, 앞 0.12초·끝 무음 1초 덜고 끝 0.55초 페이드, 마지막 타격음 → 조용한 도입이라 `audio.loop` 그대로). `<audio>`(Audio 객체)라 file://에서도 재생.
- **달리기 화면에서만**(튜토리얼·보충 포함): `app.js go()` → `DR.Bgm.scene(name)`. 볼륨 0.14(시리즈 공통), 0.6초 페이드 인/아웃, 다음 달리기는 멈춘 자리부터. play() 약속이 늦게 풀려도 rise()가 다시 확인(끝난 뒤 울리지 않게). 탭 숨기면 멈춤. 첫 클릭·키 입력 때 막힌 재생 다시 시도 + 소리 없이 한 번 틀었다 멈춤(아이폰 잠금 풀기). 효과음(sfx.js)은 그대로.
- **켬/끔** = 달리기 **일시정지 메뉴의 "배경음악" 체크**(`ui-shell.js bgmToggle`), 저장 키 `ethicity.data.bgm`('1'/'0', 없으면 켜짐 — `DR.Save.bgmOn/setBgm`, `ethicity.data.save` 형식은 그대로). HUD ♪ 버튼 이름은 "효과음 끄기/켜기"로 바꿈.
- 테스트: `save.test`(키·기본 켜짐·효과음과 따로) · `bgm-browser`(달리기에서 0.14 재생·되풀이·탭 숨김·검수로 가면 서서히 멈춤·결과 무음·보충 이어서·메뉴 끄기 → 무음+새로고침 뒤에도·다시 켜기·타이틀 멈춤·콘솔 오류 없음). 단위 170, 브라우저 테스트 20개. 미확인: 실제 귀로 듣기(이음매·음량), 아이폰 실기기.

## 지금 상태 (2026-11-02, 버그 2건 — 다온 고르면 시작 화면 주인공 사라짐 · 비 오는 학교 앞 카드)
- **시작 화면 주인공 사라짐**: `title-scene.js dispose3d`가 `forceContextLoss()`로 문맥을 잃힌 **같은 캔버스**에 `build3d`가 새 렌더러를 붙여 만들기 실패(mode 'none') → 주인공 바꾸기·시작 화면 돌아오기 때 주인공이 안 그려졌다. 정리할 때 `#title-runner`를 같은 속성의 새 캔버스로 바꿔 둔다. 달리기(`run3d.js`)는 매번 새 캔버스라 해당 없음. 테스트 `title-browser` 마지막 묶음(다온·온유·다온·돌아오기·다온 저장 새로고침마다 3D 캔버스 화소를 readPixels로 셈) → `_shot-title-hero-daon-1428`.
- **"비 오는 날 학교 앞 카드가 안 나옴"**: 카드는 코스에 늘 있고 잡을 수 있었다(아래 두 테스트). 원인은 그림 — `crossing_rain`(낮+비)이 맑은 날 횡단보도와 거의 같았다(픽셀 차이 35, 다른 장면 조건 쌍은 300+). 이름표도 같은 '학교 앞 횡단보도'라 학생이 찾을 단서가 없었다. `cardart.js`: 비 오는 낮 = 잿빛 먹구름 하늘, 비 그림(`rainOver`) = 전체 어둡게·물웅덩이·노란 우산 쓴 사람·굵은 빗줄기(역 앞 비 오는 밤에도 같이). 차이 35 → 150+.
- 테스트: `cardart-browser`(한 장면의 두 조합 카드 그림 차이 > 150, 3 임무 장면 4개 모두) · `reach.test`(모든 임무 × seed 16개: 장면마다 필요한 카드를 서로 다른 줄에서 채울 수 있음 + 조합별 보충 코스) · `play-browser`(debugFill 없이 레인 키·Space로 진짜 잡아 3 임무 첫 판 4장면 통과 — 배포 코스 seed 3301 × 온유·다온 + 3317). 단위 169, 브라우저 테스트 19개. `title-browser`의 떠나는 전환 확인은 클릭 뒤 클래스를 늦게 보면 이미 빠져 있어(느린 헤드리스) 실패하던 테스트 쪽 경쟁 → MutationObserver로 기록하게 고침.
- 참고(고치지 않음): 드문 카드 같은 종류 2장이 한 줄(레인 0·2)에 놓이면 하나만 잡힌다 — 배포 코스 3301의 비 오는 학교 앞 3장 중 잡을 수 있는 건 2장(필요 2장, 여유 없음). 1 임무 코스 스냅숏 때문에 코스 생성은 손대지 않았다.

## 지금 상태 (2026-11-02, 3 임무 그림 3장 연결)
- **3 임무 카드 썸네일** `assets/title/mission-m3.webp`(`ui-shell.js` MISSION_CARDS — m1·m2와 같은 자리, 미끼 글은 게임이 얹음). **택배 기사 초상** `assets/characters/courier-portraits.png`(2표정, `ui-story.js` SHEETS `courier`) — 이제 도형 초상 쓰는 인물 없음. **정체 공개 장면 그림** `assets/story/reveal-senior.webp`: 대사 줄의 `bg`(그림 경로)를 `DR.UI.dialogue`가 대화창 뒤에 깐다(`.story-bg`, 0.6초 서서히·움직임 줄이기면 바로, `object-position: 90%`로 폰에서도 오른쪽 선배가 보임, 900px 이상이면 대화창을 그림의 빈 왼쪽으로). 데이터는 `m3.story.reveal.bg` 하나 → `app.js revealLines`가 정체 공개 줄마다 붙임(공개 대화 8줄 내내, 마무리 대화엔 없음).
- 원본·검토용(`*-original*.png`, `preview-all.png`, `README.md.bak`, `bg-*.png`, `og-image.png`, `*-seam-check.png`)과 `tools/`는 저장소에 올리지 않음. ⚠️ `reveal-senior.webp` 수거봇 머리 위에 흐릿한 글자 같은 무늬(4~5자)가 있음 — 그림 수정은 사용자 판단.
- 테스트: `m3.test`(reveal.bg 파일 존재), `portraits-browser`(courier 칸), `m3-browser`(택배 기사 걱정 칸·임무 카드 썸네일·정체 공개 그림 → `_shot-m3-courier-worried-*`·`_shot-m3-mission-card-1280`·`_shot-m3-reveal-1280/390`). 단위 162.

## 지금 상태 (2026-11-02, 새 인물 초상)
- **대화 초상**: Codex 시트(`assets/characters/`) — 4표정 supervisor·senior·examiner, 2표정 sorter·client·collector(cast 키 bot). 대사 줄의 `face`(basic·happy·worried·explain, 없으면 기본) → 칸(`ui-story.js` SHEETS·faceIndex). 시트가 없는 인물(택배 기사)은 도형 초상. 단위 162.

## 지금 상태 (2026-11-02, 시작 화면)
- **시작 화면 다시 꾸미기**: `js/title-scene.js`(DR.TitleScene — 배경 4층 패럴랙스·비·반짝임·3D 주인공 제자리 달리기·카드 줍기·글리치·떠나는 전환·봇 말풍선, 30fps 한 루프, 떠나면 stop()으로 3D 정리) + `.tl-*` CSS + `ui-shell.js`(임무 카드·이어하기 위치·봇 안내). 그림 `assets/title/`(README에 게임용 사본·원본 보관 정리). 테스트 공용 `browser.mjs`는 `__DR_FAST_TITLE`로 전환을 건너뜀(`titleFx:true`면 전환 확인). 브라우저 테스트 18개.

## 지금 상태 (2026-11-02, 사소한 문제 9가지)
- 대화·프로필은 화면 아무 곳이나 눌러 넘김(떠오르는 중이면 첫 클릭은 완성), 프로필·주인공 대사 이름 = 고른 주인공, 1 임무 브리핑·검수·결과 순서 = 달리기 구역 순서(`DR.UI.sceneOrder`), "(두 장면 공통)", 임무 완료 요약(`#outro-summary`, 기록 `fixedLabels`), 떠난 화면 DOM 비우기(`go()` — 타이틀·달리기는 aria-hidden), 달리기 화소 비율 상한 `config.maxPixelRatio` 1.25 · `?low=1` 저사양. 브라우저 테스트 17개(polish 추가).

## 지금 상태 (2026-11-02, 3 임무)
- **3 임무 「길 안내 AI」 완성**(계획 `docs/plans/2026-11-02-data-runner-m3.md`, 진행 기록 `.superpowers/sdd/2026-11-02-data-runner-m3/progress.md`). 장소 이름표 4종·모든 카드 촬영 날짜·바뀐 곳의 옛 사진(가짜, 철거 전 육교 = 위험)·시장 골목은 바뀐 적 없어 옛 사진도 지켜야 통과(원칙 2). 검수 = 도시 변경 기록 판 + 크게 보기 날짜(이름표 고치기 없음, `relabel:false`). 결과 = 길 안내 시연(`js/ui-guide.js`) → 장면 결과 → 선배 정체 공개(1·2 임무 첫 판 실수 기록을 "누구나 그래"로, 없으면 일반 문장). 2 → 3 임무 잇기·임무 고르기 3개. 달리기 배경 `RunScenery` city. 4 임무는 아직(설계만).
- 브라우저 테스트 16개(m3 추가). 메모리가 빠듯할 때 readability·fakes·fire가 시간 초과로 실패할 수 있음 — 혼자 돌리면 통과.
- **사용자 지시서 3건 반영**: ①가짜 정리가 운에 달리지 않게 — 앞선 결과에서 이름이 나온 가짜(오표기 포함)가 남아 있으면 그 장면은 개수와 상관없이 실패(`judge(…, { named })`, 결과 "…사진이 아직 남아 있다"), 보충 준비에 오염 장면 안내 한 줄(어느 카드인지 말 안 함), 종류별 "1장 빼기" = 사진 펼쳐 직접 고르기. ②결과 문구: 가진 개수 0 → "없었다", 모자라면 "부족했다"(조합 데이터는 `what`, `DR.Judge.missingLine`), 이름표는 맞게 고쳤는데 개수 부족이면 그 원인 줄(`DR.Judge.fixedNotes`), "계속 돌리기", 1 임무 S1 불편 컷 = 물 없는 옆 골목. ③구역 배치 일반화(장면 2개 이상 임무, 데이터 `zones`), 2 임무 구역 HUD + 선별장 배경(`RunScenery` sorting), 1 임무·튜토리얼 코스는 스냅숏과 동일(`tests/fixtures/courses-before-zones.json`).

## 지금 상태 (2026-11-01)
- **2 임무 「분리배출 분류 AI」 완성**(계획 Task 6~10, 로컬 커밋 — push는 사용자 검토 뒤). 흐름: 대화 → 브리핑 → 달리기 → 검수(이름표 고치기) → 감독관 → **컨베이어 실제 분류**(`js/ui-conveyor.js`) → 장면별 결과(잘못 간 물건 썸네일) → 보충/다시 제출 → 선배 → 마무리. 1 임무 마무리에 [다음 임무로], 타이틀에 **임무 고르기**(1·2 임무, 저장된 진행이 있으면 먼저 묻는다).
- **임무 기록 한 곳**: `DR.App.records[임무] = { cleared, passed, firstTry, supplements, firstFails:[{scene,title,kind}] }`, 저장소 `ethicity.data.save`의 `records`에도(새로고침 뒤에도 "몇 개 깼는지"). 2 임무 브리핑 한 줄·3 임무 정체 공개·(검토 중인) 도시 복구 화면이 읽는다. '처음부터'(clear)에서 지워진다.
- **3·4 임무 = 설계 초안만**(`docs/specs/2026-11-01-data-runner-m3-m4-design.md`, 사용자 승인 전 구현 금지). 문서 끝 열린 질문부터.
- 진행 기록: `.superpowers/sdd/2026-10-28-data-runner-fakes-m2/progress.md`(Ruling 목록).
- 그림은 전부 Canvas(`js/cardart.js`). `tools/card-art-fal.mjs`(fal.ai 카드 그림 시범)는 **사용자 승인 전 — 게임이 쓰지 않음**.
- 미확인: 실제 학생 플레이(가짜·이름표 판단이 달리는 속도에서 되는지), 실기기 터치·저사양 PC 프레임.

## 지금 상태 (2026-10-28)
- **첫 버전 = 튜토리얼 + 1 임무(침수 판별 AI) 전체 흐름 완성**, 브랜치 `data`(origin/data), 워크트리 `D:\Works\ethicity-games-mid-data`. main 병합은 **팀 피드백 뒤 따로 결정**(팀원은 data 브랜치를 받아 `data/index.html` 더블클릭).
- 성공 기준(사용자): **팀원이 돌려 보고 "재밌다"**. 그래서 달리기 손맛이 최우선.
- **가짜 카드(1 임무부터, 튜토리얼 제외)**: 그림과 이름표가 안 맞는 카드(수영장·분수 광장·냉장고). 한 장면에 2장 이상이면 오염 → 실패(`config.fakeLimit`). 달리는 중엔 알림 없음(첫 가짜에만 안내 한 줄). 보충 준비에서 모자란 조합이 없으면 달리지 않고 "다시 제출". 설계 `docs/specs/2026-10-28-data-runner-fakes-m2-design.md` · 계획 `docs/plans/2026-10-28-data-runner-fakes-m2.md`(1부 = Task 1~5 완료, 2부 = 2 임무).
- 문서: 기획서 `data-runner-plan.md`(무엇을) · 설계 `docs/specs/2026-10-27-data-runner-v1-design.md`(어떻게, 기획서와 다른 점) · 계획 `docs/plans/2026-10-28-data-runner-v1.md`.

## 기획서와 달라진 점(사용자 결정 — 재논의 금지)
- 데이터 세계 = **매끈한 3D**(서브웨이 서퍼식 뒤 카메라, three.js). 기획서의 "픽셀 아트"는 카드 썸네일 자동 픽셀화에만 남김. 팀 공유 필요할 수 있음.
- **경계 조합(S3 네온 반사·S4 흙빛 얕은 침수)은 일반 드문 카드로도 채워짐**, 올바르게 분류한 "?" 카드는 2장 몫(`config.ambiguousWeight`).
- **불꽃(방해 세력, 3 임무에서 선배로 밝혀질 복선)**: 날아오는 불꽃에 맞으면 감속·흔들림·HP-1, HP 3 다 잃으면 그 달리기를 처음부터(그 판 카드 비움). 벽은 감속 + 카드 1장(2026-11-05 사용자 지시로 바뀜). 너무 어렵지 않게(1 임무 6개·튜토리얼 연습 2개·늘 빈 레인) — `config.hp`·`config.fire`·`mission.fires`.
- 실패 종류는 장면이 아니라 **빠진 조합**으로: 침수 조합(danger) 빠짐 → 위험(감독관이 막아 세움), 정상 조합만 빠짐 → 불편.

## 구조
| 파일 | 역할 |
|---|---|
| `js/config.js` | 손맛·판정 수치 한 곳 |
| `missions/*.js` | 임무 데이터(장면·조합·카드 수·대사) — 2~4 임무는 여기에 파일 추가. `prologue.js` = 러너 프로필·독백 |
| `js/cards.js` | 카드의 진짜 종류·붙은 이름표·아이콘(가짜·이름표 고치기의 단일 출처) |
| `js/judge.js` · `stream.js` · `catch.js` · `input.js` · `conveyor.js` | 순수 모듈(판정·코스·잡기·입력 분류·2 임무 컨베이어 분류 규칙), node로 단위 테스트 |
| `js/save.js` | 저장·이어하기·소리·주인공·**임무 기록(records)** |
| `js/cardart.js` | 카드·아이콘·단서·결과 컷을 Canvas로 생성(같은 화풍 원칙, 지하차도 금지) |
| `js/run3d.js` | three.js 달리기(r149, `vendor/`) — `step/peek/setPaused/finishNow/debugTake` 테스트 훅 |
| `js/run-world.js` · `bridge-look.js` | 빛의 다리 무대(캔버스 뒤 하늘·도시 CSS 층 + 3D 다리·불빛) · 밤/낮 팔레트·구역 모습(순수) |
| `js/ui-story.js` · `ui-inspect.js` · `ui-result.js` · `ui-conveyor.js` | 대화·브리핑·검수(크게 보기 공용 = `zoomer`, 2 임무 이름표 고치기)·감독관·결과·보충 준비·마무리·2 임무 컨베이어 |
| `js/ui-common.js` · `ui-shell.js` | 아이콘 줄·범례·도움말·되돌리기 / 일시정지·타이틀(주인공·임무 고르기) |
| `js/ui-guide.js` · `ui-grade.js` · `ui-city.js` · `showdown.js` | 3 임무 길 안내 시연 · 4 임무 채점 시연 · 도시 복구 화면 · 4 임무 결판·동기 카드 규칙(순수) |
| `js/app.js` | 흐름 상태 기계, `?start=` `?run=` 디버그 진입, `DR.App.debugFill` |

클래식 `<script>` + 전역 `DR`(ES 모듈·fetch 금지 — `file://`로 열려야 함). 공통 패키지 `shared/`는 초등편이라 안 씀.

## 검증(재발명 금지)
- 단위: `node --test "data/tests/*.test.mjs"` (234)
- 브라우저: `PLAYWRIGHT_MODULE=D:/Works/token_economy/node_modules/playwright node data/tests/run-all.mjs` (25개: bgm·boot·**bridge**·cardart·exam·fakes·fire·flow·hero·keys·lost·m1·m2·m3·m4·play·polish·portraits·readability·run·runner·title·touch·tutorial·zones) — `file://`로 엶. ⚠️ 전체가 10분을 넘으니 백그라운드로 돌릴 것(m2-browser만 몇 분). ⚠️ PC 메모리가 빠듯함(백그라운드 작업이 강제 종료된 적 있음) — 헤드리스 브라우저 테스트는 **한 번에 하나씩**(run-all이 차례로 돎), 다른 브라우저 테스트와 겹쳐 돌리지 말 것
- 사람 눈: `tests/_shot-*.png`(gitignore) — 특히 `_shot-cardart.png`(1 임무 그림 시트)·`_shot-cardart-m2.png`(2 임무 물건·아이콘·선별장 컷), `_shot-conveyor-*.png`, `_shot-relabel-375.png`, `_shot-run-*.png`
- ⚠️ 함정: 화면 전환 때 버튼 자동 포커스 금지(Space 연타가 브리핑·결과를 건너뜀 — go()가 blur). 달리기 화면은 `touch-action:none`(폰 스크롤·새로고침 제스처). `.screen[hidden]`은 `!important` — ID 셀렉터의 display가 hidden을 덮어써 숨은 화면이 클릭을 가로챘음.
- ⚠️ 2 임무 화면 개수·라벨(`DR.Cards.displayKey`): 이름표가 맞는 카드 = 그 종류, 틀린 카드(가짜·잘못 고친 카드) = **붙은 이름표의 보통 종류**로 센다. 정체를 드러내는 색·글자 금지("고침" 표시는 맞았는지 말하지 않음).
- ⚠️ 컨베이어 원인 규칙: 가짜 원인은 **물건 자기 장면**의 오염만 본다(통과한 장면의 물건은 늘 맞는 함). `danger:S#` 원인 = 그 장면이 위험으로 실패 → 장면마다 건전지 물건이 하나씩 있어 **위험 장면 = 그 장면에서 비상 정지**(리뷰 I1). 원인을 늘릴 때 `conveyor.test.mjs` 무작위 가방 테스트(통과 장면은 모두 맞음·위험⇔비상 정지)가 지켜 준다.

## 남은 일
- **팀 플레이 피드백**(기획서 §11 체크리스트) → `config.js` 수치 조정. 미확인: 실기기 손맛·터치 실기기·저사양 PC 프레임.
- 3·4 임무 완성(2026-11-02). 남은 것: 도시 복구 그림 6장(Codex, `assets/city/city-0..5.webp`), 레이스 고스트(나중에 얹는 선택 층). 1 임무 결과를 컨베이어식으로 바꿀지는 2 임무를 해 본 뒤 결정(설계 §2).
- 인물 디자인(다른 팀과 맞추기)·완성 일러스트는 외부 조건.
