# CLAUDE.md — 「데이터 러너: 끊어진 도시」(data) 인수인계

## ★지금 상태 (2026-11-02, 4 임무 「채점 AI」 + 도시 복구 화면 — 이야기 끝까지)
- **4 임무 완성**(계획 `docs/plans/2026-11-02-data-runner-m4.md` Task 1~7, 설계 §5·§7). `missions/m4.js`: 이름표 = 선택지 번호 1~5(`labels`), 가짜에만 7·8(`labelExtra`), `labelStyle:'digit'`(고치기·"?" 버튼 = 동그라미 숫자 하나, 375px 한 줄), 가짜가 쌓이는 장면은 데이터 `fake.scenes`(`DR.Cards.fakeScenes` — 이름표를 바꾸면 바뀐 이름표 기준). S2·S4 위험 / S1·S3 불편. 크게 기운 1·표 답을 다 빼면 S4는 반드시 실패(테스트).
- 흐름: 대화 → 브리핑 → 달리기(시험장 배경 `RunScenery` exam, S2·S4 들어설 때 선배 한 줄 `story.runLines`) → 검수 → 감독관 → **채점 시연**(`js/ui-grade.js`, 답안지 13장, 원인 규칙 = `DR.Conveyor.sort` + 새 원인 `any:가짜id`) → 장면 결과 → **결판**(`DR.Judge.readable` = S4 조합만, 대사 줄 `sheet` → 대화창 위 선배 답안 `DR.CardArt.sheet`, bg `showdown-senior.webp`) ─ 못 읽음 → "봐, 또 지웠잖아" → 동기 합류(`js/showdown.js`: 남은 보충 2 = NEW·뺄 수 있음 / 1 = 고정 "동기와 함께 넣음" / 0 = 고정 + 다시 제출) → 보충(동기 카드는 달리기 뒤 가방에, 그만큼 칸 비워 둠) → … ─ 읽음 → **도시 재연결 5/5** → 의뢰인(선생님·택배 기사) → (합류한 적 없으면) 동기 "챙겨 왔어" → 해커의 이후(bg `senior-after.webp`) → 마무리(토론 질문 2개, `#outro-questions`).
- **도시 복구 화면**(`js/ui-city.js`, `#screen-city`): 튜토리얼 끝 0→1, 1~3 임무 마지막 대화 뒤(칸이 늘었을 때만), 4 임무는 늘 →5. 칸 = `DR.Save.cityCount`(records.m1~m4 + records.tutorial, '처음부터'면 0). **그림 `assets/city/city-0..5.webp`는 아직 없음** → `<img>` 오류로 그림 자리 숨기고 점 5칸 + 문구. 파일만 그 이름으로 넣으면 저절로 쓰인다. 타이틀 왼쪽 위 배지 `#title-city`("도시 n/5", role=img).
- 손글씨 카드 = Canvas 같은 붓(`cardart.js` GLYPHS·PEN — 깃발 1↔7, 고리 3↔8, 각진 2↔5, 둥근 5↔2). 크게 기운 1 = 굵고 일정, 떨림 없음. 동기 "이상한 건 빼자" 한 줄이 1~3 임무 도입에도. 시험 이름 = "새빛 진학 평가"(3 임무도).
- 저장: 체크포인트에 `peer`·`peerPending`·`showdownPassed`. 4 임무 S4 구역은 짧다(seed 4401에서 약 8초 — 7·8 가짜가 이제 S2에 쌓여서, 설계 §5.9의 23초는 그 전 계산).
- 테스트: 단위 `m4.test`(26)·`city.test`·`save.test` 추가, 브라우저 `m4-browser`(A 첫 판 S4 실패 → 동기 → 통과 1280·390 / B 첫 판 통과 / C 동기 카드 빼고 마지막 보충 고정 + 결판 그림 없음 / D 375px 버튼 / E 타이틀 배지·임무 카드), `cardart-browser`(→ `_shot-cardart-m4.png`). 앞 임무 브라우저 테스트는 `passCity`로 도시 화면을 지난다.

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
- **불꽃(방해 세력, 3 임무에서 선배로 밝혀질 복선)**: 날아오는 불꽃에 맞으면 감속·흔들림·HP-1, HP 3 다 잃으면 그 달리기를 처음부터(그 판 카드 비움). 벽은 감속만. 너무 어렵지 않게(1 임무 6개·튜토리얼 연습 2개·늘 빈 레인) — `config.hp`·`config.fire`·`mission.fires`.
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
| `js/ui-story.js` · `ui-inspect.js` · `ui-result.js` · `ui-conveyor.js` | 대화·브리핑·검수(크게 보기 공용 = `zoomer`, 2 임무 이름표 고치기)·감독관·결과·보충 준비·마무리·2 임무 컨베이어 |
| `js/ui-common.js` · `ui-shell.js` | 아이콘 줄·범례·도움말·되돌리기 / 일시정지·타이틀(주인공·임무 고르기) |
| `js/ui-guide.js` · `ui-grade.js` · `ui-city.js` · `showdown.js` | 3 임무 길 안내 시연 · 4 임무 채점 시연 · 도시 복구 화면 · 4 임무 결판·동기 카드 규칙(순수) |
| `js/app.js` | 흐름 상태 기계, `?start=` `?run=` 디버그 진입, `DR.App.debugFill` |

클래식 `<script>` + 전역 `DR`(ES 모듈·fetch 금지 — `file://`로 열려야 함). 공통 패키지 `shared/`는 초등편이라 안 씀.

## 검증(재발명 금지)
- 단위: `node --test "data/tests/*.test.mjs"` (170)
- 브라우저: `PLAYWRIGHT_MODULE=D:/Works/token_economy/node_modules/playwright node data/tests/run-all.mjs` (21개: bgm·boot·cardart·fakes·fire·flow·hero·keys·m1·m2·m3·**m4**·play·polish·portraits·readability·run·title·touch·tutorial·zones) — `file://`로 엶. ⚠️ 전체가 10분을 넘으니 백그라운드로 돌릴 것(m2-browser만 몇 분). ⚠️ PC 메모리가 빠듯함(백그라운드 작업이 강제 종료된 적 있음) — 헤드리스 브라우저 테스트는 **한 번에 하나씩**(run-all이 차례로 돎), 다른 브라우저 테스트와 겹쳐 돌리지 말 것
- 사람 눈: `tests/_shot-*.png`(gitignore) — 특히 `_shot-cardart.png`(1 임무 그림 시트)·`_shot-cardart-m2.png`(2 임무 물건·아이콘·선별장 컷), `_shot-conveyor-*.png`, `_shot-relabel-375.png`, `_shot-run-*.png`
- ⚠️ 함정: 화면 전환 때 버튼 자동 포커스 금지(Space 연타가 브리핑·결과를 건너뜀 — go()가 blur). 달리기 화면은 `touch-action:none`(폰 스크롤·새로고침 제스처). `.screen[hidden]`은 `!important` — ID 셀렉터의 display가 hidden을 덮어써 숨은 화면이 클릭을 가로챘음.
- ⚠️ 2 임무 화면 개수·라벨(`DR.Cards.displayKey`): 이름표가 맞는 카드 = 그 종류, 틀린 카드(가짜·잘못 고친 카드) = **붙은 이름표의 보통 종류**로 센다. 정체를 드러내는 색·글자 금지("고침" 표시는 맞았는지 말하지 않음).
- ⚠️ 컨베이어 원인 규칙: 가짜 원인은 **물건 자기 장면**의 오염만 본다(통과한 장면의 물건은 늘 맞는 함). `danger:S#` 원인 = 그 장면이 위험으로 실패 → 장면마다 건전지 물건이 하나씩 있어 **위험 장면 = 그 장면에서 비상 정지**(리뷰 I1). 원인을 늘릴 때 `conveyor.test.mjs` 무작위 가방 테스트(통과 장면은 모두 맞음·위험⇔비상 정지)가 지켜 준다.

## 남은 일
- **팀 플레이 피드백**(기획서 §11 체크리스트) → `config.js` 수치 조정. 미확인: 실기기 손맛·터치 실기기·저사양 PC 프레임.
- 3·4 임무 완성(2026-11-02). 남은 것: 도시 복구 그림 6장(Codex, `assets/city/city-0..5.webp`), 레이스 고스트(나중에 얹는 선택 층). 1 임무 결과를 컨베이어식으로 바꿀지는 2 임무를 해 본 뒤 결정(설계 §2).
- 인물 디자인(다른 팀과 맞추기)·완성 일러스트는 외부 조건.
