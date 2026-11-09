# CLAUDE.md — 「데이터 러너: 끊어진 도시」(data) 인수인계

## ★지금 상태 (2026-11-09, 보충 달리기 누적 목표 · 동기 자리 · 4 임무 같은 답안지 전후 비교 — 교사 피드백 `docs/feedback/2026-11-09-m4-supplement-compare.md`, 계획 `docs/plans/2026-11-09-m4-supplement-compare.md`)
- **보충 누적 목표 = 모든 임무 보충 달리기**(공용 `run-feedback`, 판단 R1 — 보충은 늘 첫 결과 뒤라 1 임무 `hideShapes`와 안 겹침, 튜토리얼은 보충 없음·`runGoal` 그대로). `js/need-goal.js`(DR.NeedGoal, 순수): `plan(mission, bag, extra, cfg, named)` = 출발할 때 가방 + 동기 카드로 `DR.Judge.judge` → 빠진 조합이 short(보충 준비의 '출발/다시 제출'과 같은 판정), keys가 같은 조합은 한 줄(필요 = 큰 쪽), 순서 = 모자란 줄(구역 순) → 다 찬 줄. `status(mission, plan, grabbed)` = 가방 + 동기 + 이번에 잡은 카드를 **`DR.Cards.labelCounts`(붙은 이름표 기준 = 검수·보충 준비·결과 화면과 같은 규칙)**로 셈 → 가짜 정체·"?" 정답을 안 드러냄. 달리며 잡은 "?" = `unknown`(세지 않음). `lookAgain` = 판정은 모자란데 화면 개수로는 찬 줄(이름표 틀린 카드가 섞임) → ✓ 안 닮.
  - 화면 `#run-need`(왼쪽 위, 카드보다 아래 z 150): "모자란 자료 · 가방에 든 것까지 셈" + "흘려 쓴 인공지능 1/2장" → 잡으면 "2/2장 ✓"(초록, 다 차면 머리말 "다 모았어요! 결승선까지 달려요") → 다 찬 줄 "✓ 이름"(동기로 찼으면 "(동기 카드로)") — ≤650px는 다 찬 줄 대신 "다 찬 자료 n개는 더 안 담아도 돼요" 한 줄, 모자란 줄은 줄바꿈 칩. 패널이 있으면 구역 칸은 "이번 n장"만(전엔 보충 때 "이번 n/필요 합"), 패널 자리 = `#hud` 아래 끝 + 8px(매 프레임 재서 — 좁은 화면 HUD가 몇 줄이든 안 가림), 패널 아래 끝 = `--need-bottom` → 좁은 화면의 잡기 알림·구역 표지가 그 아래, 넓은 화면 잡기 알림은 오른쪽.
  - 연결: `app.prepSupplement` → `runCourse(…, reserve, need)` → `DR.Run.start` opts `reserve·need` → `RunFeedback.create(…, { need, reserve })`. 쓰러져 다시 달려도 같은 plan.
- **동기 자리**(4 임무 결판 뒤, `peerCards` 합 4장 예약될 때만): 가방 칸 안 끝 `#hud-peer` "동기 자리 4칸"(≤650px "+4칸" — 따로 두면 390px HUD가 세 줄로 넘쳐 패널을 가렸음, aria "가방 4칸은 동기가 가져올 답안 자리예요") + 패널 줄 `#run-need-peer` + 보충 준비 `#prep-slots` "가방 4칸은 동기가 가져올 답안 자리예요. 지금 가방 n장 · 동기 자리 4칸 · 빈칸 m칸(모두 30칸)."
- **같은 답안지 전후 비교**(4 임무 완료 화면 `#outro-compare`, `js/grade-compare.js` DR.GradeCompare 순수 + `DR.UI.gradeCompare` in `ui-grade.js`): 첫 판정 때 `snapshot` = 채점 시연(`DR.Conveyor.sort`) 답안지마다 도장·맞았나·원인 + 실패 장면 빠진 조합·오염 원인 + 첫 가방(최소 필드) → `App.state.firstGrade`(**저장 선택 필드** — 없으면 키도 없음, 옛 저장 → null → 표 없음). `rows` = 마지막 판정과 같은 답안지끼리: 결과가 바뀐 답안지(채점 순서, 최대 3) + 남으면 아직 틀린 것(still) + 처음부터 맞은 ○ 1장(비교용). "내가 바꾼 자료" = 처음 원인 → 조합 진짜 장 수 변화("흘려 쓴 인공지능 1장 → 2장", 동기 카드면 "(동기 카드 2장)") / 이름표 틀린 카드("'인공지능' 이름표가 붙은 또박또박 쓴 알고리즘 2장 → 이름표 고침 1장 · 뺌 1장"), 최대 2줄. 판정 글 "○ 인공지능으로 읽음"·"✕ 알고리즘으로 읽음"·"사람 채점 · 못 읽음"·"✕ 정말 틀린 답". 끝에(왼쪽 색 띠 없이 — 318cd52 사용자 'AI티') "같은 답안지인데 결과가 바뀌었다. 어떤 자료를 고칠지는 AI가 아니라 사람이 정했다." 처음부터 다 맞으면 한 줄. ≤520px = 답안지마다 카드(머리줄 숨김, 칸 이름 `data-label`). `judge.js`엔 읽기 전용 `comboHave`만 더함.
- 2·3 임무에 같은 비교: 컨베이어(`mission.conveyor`)·길 안내(`mission.guide`)도 같은 `DR.Conveyor.sort` 원인 규칙이라 `GradeCompare`를 목록만 바꿔 거의 그대로 쓸 수 있음(판정 글만 임무별로 — 함 이름/안내 문장). 안 만듦.
- **교사 검수 대기**: 새 문장 전부(README 목록에 적음).
- 커밋: 729d9a0(누적 목표·동기 자리) · e9830f3(전후 비교) · 97ef668(390 HUD 고침 — 처음엔 동기 자리 알약이 HUD를 세 줄로 밀어 패널이 구역 칸 뒤에 가려졌음).
- 결과: 단위 353(333 + 20) · 브라우저 33개 — 전체 `run-all` 28/33(bgm·city·runner·tutorial·zones 실패) → 실패 5개를 혼자 다시: zones·city·tutorial 통과, runner·bgm은 두 번째 혼자 실행에서 통과(runner = 진짜 시계 60초 대기 시간 초과, bgm = 예전부터의 '서서히' 줄). 다른 에이전트가 같은 PC에서 브라우저 테스트를 돌리는 중이라 잠금(`D:Works.browser-test.lock`)을 번갈아 씀.
- 미확인: 학생이 달리며 왼쪽 위 패널을 실제로 보는지(1280에서 15px, 390에서 13px), 실기기 휴대폰, 이름표가 틀린 카드가 기대한 줄을 안 올려 '눈치'가 되는 정도(판단 R3), 비교 표 문장(교사 검수).
- 테스트: 단위 `need-goal.test`(10)·`grade-compare.test`(9)·`save.test`(firstGrade 1) · 브라우저 `supplement-browser`(4 임무 1280·390: 첫 달리기엔 패널 없음 → 결판 실패·동기 4장 → `#prep-slots` → `#hud-peer`·bagMax 26 → "흘려 쓴 인공지능 1/2장" → 1장 잡기 → "2/2장 ✓" → 다 찬 줄/한 줄 → "?" 따로 → 끝까지 → 비교 표 gr4·gr11 바뀜 + gr1 비교용, 가로 넘침 없음 / 1 임무 "접힌 우산 1/3장"). 스크린샷 `_shot-supp-prep-peer-*`·`_shot-supp-need-before/after-*`·`_shot-supp-compare-*`.

## ★지금 상태 (2026-11-09, 달리기 무대 2차 = 2·4 임무 실내 무대 — 설계 `docs/specs/2026-11-08-run-indoor-stages-design.md`, 계획 `docs/plans/2026-11-09-run-indoor-stages.md`)
- **임무 데이터 `world`**: m2 `'sorting'`(선별장), m4 `'grading'`(채점 센터 S1~S3 → S4 교무실). 1차 구조를 넓힘 — `run-world.js`가 실내면 CSS 층 6개(하늘·도시 2·창 색조·**실내 벽** `.rw-wall`·비[안 씀]), `bridge-look.js`에 실내 팔레트·구역 모습(순수, node 테스트). `peek().scenery.theme`은 'sorting'·'exam' 그대로, `peek().world`에 `indoor·room·art·artHidden·deck·fog·wallShift`.
- **그림**: `assets/title/int-sorting/int-grading/int-teachers-office.webp`(2560×1080, 창 유리 알파 0, sharp q90 알파 유지 — 269·171·210KB, README 표). 원본 PNG·보라판 백업·ps1·preview는 안 올림. 벽 층 밑변 = 지평선(`--rw-horizon`), 높이 = 지평선까지, 가로 반복. 창 띠(그림 25~68%) 뒤로 **낮 도시**(`bg-*-day.webp`, `.rw-indoor .rw-far/.rw-mid`를 창 높이로) + 시간대 색조(`look.window`: 선별장 오후 → 늦은 오후 구역마다 조금씩, 채점 센터 늦은 오후, 교무실 노을). 4 임무는 두 그림을 처음부터 받아 둠.
- **색 = 실제 장소**(보라 없음 — 단위 테스트가 색상각으로 막음): 선별장 바닥 어두운 초록 고무 벨트 `#1d3a2b` + 롤러 이음매 + 안전 노랑 가장자리, 옆 콘크리트 / 채점 센터 어두운 남색 벨트 `#1b2840` + 흰 가장자리·민트 안쪽 줄 / 교무실 어두운 리놀륨 `#33241e`(더 따뜻하고 어둡게). 안개·옆 바닥 = 그림 아래 3% 평균색에 맞춤(바닥이 그림 바닥선과 이어지게). 흰 카드 대비 ≥ 4.5, 분홍 벽(섞인 색) 칸마다 ≥ 2·평균 ≥ 2.5.
- **소품**(`run-scenery.js`, 실내면 하늘·안개는 run-world가): 선별장 = 초록 옆 벨트·롤러, 분류함(구역 색 = 카드 테두리와 같은 색상, `dimBin` 0.72배로 어둡게, 바깥 x = 길 폭/2 + 3.8), 작은 호퍼(분류함 위), 경광등 날개(천천히 회전, 번쩍임 없음) / 채점 센터 = 옆 벨트(남색)에 답안지(○✕ 기호만, 천천히 흐름)·도장 팔(리듬 있게 꾹), 구역 경계 스캐너 문 / S4 = 교무실 문(열린 문짝) + 책상·묶인 옛 답안지·민트 캐비닛, 교무실 바닥을 S4 자리부터 미리 깔아 둠(레인 줄은 polygonOffset으로 그 위). 레인 위엔 소품 없음. **3D 천장 조명 막대는 뺌**(머리 위를 지날 때 화면을 가로지르는 흰 줄로 보였음 — 그림에 조명이 있음). 4 임무는 4레인 폭(10.8m) 기준.
- `?low=1`·움직임 줄이기 = 벽·도시 층·경광등·도장·답안지 멈춤(`world.moving` false). 그림을 못 읽으면 벽 층만 숨김 → 하늘·도시·방 색 바탕(바깥 풍경처럼 보임).
- 테스트: 단위 `bridge-look.test` 실내 7(팔레트 대비·보라 아님·벨트 색·분류함·구역 모습·그림 파일) · 브라우저 `indoor-browser`(2 임무 구역 4개 look·창빛·분류함 색·움직임 / 4 임무 1280·390 S1 채점 센터 → S4 교무실 그림·바닥·안개 / low·움직임 줄이기 ×3 / 그림 없음) · `bridge-browser` 기대값 바뀜(2 임무 = 실내 층 6개, 전엔 0). 스크린샷 `_shot-indoor-m2-S1~S4-1280`·`_shot-indoor-m4-S1/S4-1280/390`·`_shot-indoor-m2-noart-1280`.
- 결과: 단위 333 · 브라우저 32/32(전체 `run-all`, indoor 새로). 헤드리스 fps(1280, 참고) 2 임무 40 → 43.7 · 4 임무 40 → 42(실내 전 상자 빌딩이 빠져서), 연습 다리 61~64.
- 미확인: 학교 PC 프레임(실내 소품 메시 수 — 4 임무 약 300개 상자), 실기기, 학생 반응("여기가 선별장/채점 센터구나"), 노을 색조 세기. (그림 안 글자: 교무실 벽시계는 원본 크기로 잘라 봐서 숫자 없음 확인, 나머지는 축소본으로만 봄 — 글자 안 보임)

## ★지금 상태 (2026-11-09, 4 임무만 4레인 — 계획 `docs/plans/2026-11-09-m4-four-lanes.md`, 설계 `docs/specs/2026-11-08-run-indoor-stages-design.md` "추가 결정")
- **레인 수 = 임무 데이터**: `missions/m4.js lanes: 4`, 나머지는 없음 = 3(`DR.Stream.laneCount`). 쓰는 곳 = `stream.js`(레인 섞기·듬성듬성 벽 첫 레인·불꽃 레인), `input.js nextLane/startLane`(끝에서 멈춤, 출발 = 3레인 가운데 1 / 4레인 가운데 왼쪽 1), `run3d`(레인 x = (l − (n−1)/2) × 폭, 바닥 폭·레인 줄 n+1개·결승 게이트·옆 빌딩, `camRig` — 4레인은 카메라 조금 높이·뒤로·덜 따라감), `run-feedback`(불 경고 n칸, 화면 카드), `run-world`(다리 폭·가장자리 줄), `play-browser` 자동 조종.
- 연습·1~3 임무: 3레인이면 난수 쓰는 횟수까지 그대로 → 코스가 **바이트 그대로**(`tests/fixtures/courses-before-lanes.json` = 바꾸기 전 5828537에서 만든 스냅숏, 벽·불꽃·개인정보·지지직 표시까지 — `lanes.test`. 다시 만들지 말 것). 화면도 3레인 값 그대로(`camRig`·카드 칸 계산 3레인 가지 그대로).
- 4 임무 코스는 **의도적으로 바뀜**(레인·벽·불꽃만): 카드 종류·거리·구역·앞뒤 간격·드문/가짜 자리 = 같은 seed 3레인 코스와 같음(`lanes.test`). 4 임무 코스 스냅숏 fixture는 원래 없었음(courses-before-m4.json은 1~3 임무만) — 새로 만들 것 없음. 벽 규칙(한 거리에 막힌 레인 2개까지)은 레인 수와 상관없이 그대로 → 4레인은 빈 레인이 늘 2개 이상.
- 화면 카드(34m 안 DOM): 4레인이면 칸 자리를 **같은 기준(러너 앞 20m)·같은 간격(가장 큰 카드 폭 + 10)**으로 — 3레인처럼 카드마다 그 거리에서 재면 앞뒤 간격(0.3초)으로 거리가 다른 옆 레인 카드가 몇 px 겹쳤음. 좁은 화면 카드 폭 = (화면 − 16)/4 − 10(390px에서 83px), 낱말 16px(`.run-feedback.lanes-4`).
- 테스트 훅 `peek().lanes·laneX`, `DR.Run.laneScreen(d)`. 단위 `lanes.test`(7) · 브라우저 `lanes-browser`(4 임무 1280·390 키·끝에서 멈춤·네 레인 화면 안·화면 카드 안 겹침·네 레인 모두 화면 카드·레인 3 카드 잡기 / 연습 3레인 그대로 / 스와이프 ×3 = 레인 3). 스크린샷 `_shot-lanes-m4-1280/390`.
- 참고(고치지 않음): 슬라이딩 6m 창으로 보면 1 임무 seed 1·2201 첫 판에 세 레인 벽이 모이는 자리가 있다(벽 사이 거리는 6m 넘음 — 규칙은 새 벽 자리 기준 6m 안만 봄). 배포 seed 1101은 해당 없음. 1~3 임무 코스는 그대로 두기로 해서 손대지 않음.
- 결과: 단위 326(lanes.test 7 새로) · 브라우저 31/31(전체 `run-all`, lanes 새로 — 이번엔 bgm·m3·play·tutorial·runner 모두 한 번에 통과). 연습·1·3 임무 스크린샷(`_shot-bridge-*`)은 바꾸기 전과 나란히 놓고 봄 — 비·걸음 자세만 다름.
- 미확인: 실제 손맛(4레인 이동 거리·카메라 높이), 실기기 휴대폰에서 83px 카드 낱말 읽기.

## ★지금 상태 (2026-11-09, "지지직" 연출 + 카드 앞뒤 간격 + 4 임무 "?" 더 번지게 — 계획 `docs/plans/2026-11-09-glitch-stagger.md`)
- **지지직**(요청서 `docs/feedback/2026-11-08-glitch-effect.md`, 연출만): `js/glitch.js`(DR.Glitch). 대상 = 흔한 카드만(가짜·"?"·드문·개인정보 제외), 개수 = round(대상 × `mission.glitchRate`) — tutorial 0·m1 0.05·m2 0.15·m3 0.2·m4 없음(파일 안 건드림 = 0). `Stream.build` 끝에서 코스 난수와 **따로 도는** seed 난수로 표시 필드 `item.glitch`(stripe·rgb·glyph)만 붙임 → 카드·벽·불꽃·uid 그대로(`glitch.test`). `cardsOf`·`privacy.test strip`은 glitch를 뺀다. 가방 카드엔 안 들어감(`take`가 안 옮김).
  - 화면: `run3d` 원래 그림 ↔ 효과 그림 2장(처음 켜질 때 만듦, glyph는 이름표 글자만 다시 그림)을 `config.glitch` 일정(0.5초마다 0.16초 = 1초 3번 이하)으로. 거리 `clearDist` = max(속도, 기준 속도) × (catchLead + 1.0초) 안에 한 번 들어오면 **계속 선명**(느려져도 다시 안 흔들림). 화면 카드(34m 안, `run-feedback`)도 같은 상태. 밝기는 그대로(줄 밀기·R/B 채널 어긋남·글자만). 움직임 줄이기 = 효과 없이 멀 때 테두리만 흐리게(3D frame 불투명도 0.45, DOM `.glitch-soft`), 안내도 없음. 첫 등장 안내 "데이터 세계가 흔들려. 가까이 가면 또렷해져!"(달리기마다 한 번, 다른 안내가 떠 있으면 끝난 뒤). 검수·보충·결과는 CardArt 그대로라 해당 없음.
  - 테스트 훅 `DR.Run.glitchState()`·`screenOf(uid)`. 브라우저 `glitch-browser`(2 임무 한 판: 효과 순간은 늘 잡기 구간 1초 전보다 멂·잡기 구간에선 원래 그림·대상 밖 카드 변화 0·1초 3번 이하·안내 1번·지지직 카드를 키로 잡아 검수까지 / 움직임 줄이기). 스크린샷 `_shot-glitch-m2-1280/390(-zoom)`.
- **카드 앞뒤 간격**(설계 `docs/specs/2026-11-08-run-indoor-stages-design.md` "추가 결정"): `config.cardStaggerSec` 0.3초. 한 줄 두 장 중 한 장을 그 지점 속도 × 0.3초 **뒤로만**(드문+흔한 줄이면 흔한 카드 — 드문 카드와 그 벽 그대로). 난수 안 써서 종류·레인·구역 그대로, 벽·불꽃은 옮긴 자리를 보고 다시 정해짐. 듬성듬성 벽 '다음 줄 레인'은 z 같음 → 줄 소속. 드문 카드 벽이 범위 안에 꼭 맞는 자리가 없을 때(후반 드문 카드 둘이 같은 레인에 가까이) 같은 레인 카드와 가장 먼 자리(전엔 카드 위에 설 수 있었음 — m4 seed 3에서 드러남).
  - 스냅숏 fixture(`courses-before-zones/m3/m4.json`)는 **파일 그대로**, 비교만 간격 0 코스로(= 옛 배치) + `stream.test` 관계 테스트(실제 = 그 배치 + 줄마다 한 장만 뒤로). `reach.test`는 간격만큼 떨어진 카드를 한 줄로 묶어 '한 줄 한 장' 그대로 셈. 모든 임무 × seed 17 × 첫 판·보충에서 다른 두 카드 사이 ≥ 0.3초.
  - ⚠️ `play-browser` 자동 조종은 `rows.has(it.z)`로 '한 줄 한 장'을 고르는데, 이제 z가 달라 한 줄 두 장을 다 노릴 수 있다(0.3초 간격이라 잡을 수는 있음).
- **4 임무 "?" 카드 더 번지게**(추가 요청): `cardart drawWordAnswer` smudge만 — 또렷한 획 없이 따로 그린 낱말을 세 겹 원으로 퍼뜨려 찍기(ctx.filter 없이) + 밀린 자국 둘 + 회색 띠 + 받침 자리 문지름. 단서(같은 학생 답·글자 확대)는 그대로 또렷. `cardart-browser` 선명도 비율(진짜 종류 카드 대비) 0.771→0.593 · 0.738→0.586, 같은 학생 단서 0.996·1.013. m4.js 그대로.
- 테스트: 단위 319(glitch.test 8·stream.test 간격 16·reach 묶음 1 새로) · 브라우저 30/30(전에 실패하던 bgm·m3·play도 이번 전체 실행에선 통과).
- 미확인: 실제 달리는 눈으로 지지직이 보이는지(먼 3D 카드는 1280에서 폭 40px 남짓 — 색 어긋남은 작게 보임), 실기기 프레임, 학생이 "?"를 단서 둘로 판단하는지.

## ★지금 상태 (2026-11-08, 4 임무 = 낱말 손글씨판, 최고 난이도 — 설계 `docs/specs/2026-11-08-m4-words-design.md`, 계획 `docs/plans/2026-11-08-m4-words.md`)
- **숫자 1~5 → 낱말 4개**(데이터 `data`·알고리즘 `algo`·인공지능 `ai`·머신러닝 `ml`, 이름표 id는 영문). 보기 밖 낱말 = 가짜에만 `date`('데이트')·`en_ai`('AI'), `labelExtra[].short`(→ `DR.Cards.labelShort`). `labelStyle: 'word'` = 고치기·"?" 버튼이 낱말 넷(CSS `.labels.word` 4칸 격자, ≤330px면 2×2 — 375px는 한 줄, `m4-browser D`).
- **카드 세 갈래**(데이터 `group`): ① 이상해 보이지만 맞음(`rare`·벽) — `cur_ai`·`cur_algo`(흘림, S2)·`alt_ai`'AI'·`alt_data`'data'(S3)·`alt_ml`'머신 러닝'(S3·S4 공용)·`scrawl_ml`(아주 흘림 = 선배 글씨, S4) 19장 / ② 이상하고 틀림 — `x_scribble`(S1)·`x_algo_ai`·`x_ai_algo`(S2)·`x_date`·`x_ai_raw`(S3) 9장 / ③ 반듯한데 틀림 — `x_neat_algo`('인공지능')·`x_neat_data`('머신러닝') 4장(S1). 평범 = `neat_*` 12장(S1·S3 공용 — S3에도 반듯한 답 2장 조합 `S3_neat`, 개인정보 카드가 코스 앞 15% 밖에 놓일 자리가 생김). "?" = `q_ai`·`q_algo`(번진 흘림). 코스 46장, 첫 판 최소 16장.
- 판정: S1·S3 빠짐 = 불편, S2·S4 아주 흘림 빠짐 = 위험, '머신 러닝'만 빠짐 = 불편(결판 "보기에 없는 낱말 · 사람 채점"). 가짜는 낙서만 불편, 나머지 위험. 이상한 걸 다 빼면 S4 반드시 실패(`m4.test`). `rareLate`는 안 씀(S2~S4에 평범한 카드가 없어 맞바꿀 짝이 없음 — 엔진 그대로).
- **손글씨 = OFL 글꼴 4종 + Canvas**(`css/hw-fonts.css` base64 23KB, `assets/fonts/OFL.txt`, README "글꼴"): HW Neat=Poor Story·HW Round=Gamja Flower(반듯 두 학생, variant로 번갈아)·HW Quick=East Sea Dokdo(흘림)·HW Bold=Dokdo(아주 흘림). 나눔손글씨는 예약 글꼴 이름 때문에 안 씀. 남긴 글자 = 낱말 4개 + d·a·t·A·I(글자를 더하려면 저장소 밖에서 `subset-font`로 다시 — README). `cardart.js` `drawWordAnswer`·`writeWord`·`drawWordClue`·`wordSheet`, `wordsReady()`(글꼴 전 그림은 캐시 열쇠 `|hw0`로 따로 — 대체 글꼴 그림이 남지 않게), 낱말 카드 썸네일 48칸(`c.fine`). 옛 숫자 붓(GLYPHS·PEN·drawAnswer)은 남김.
- 화면: 달리는 3D 카드 = 이름표 낱말을 큰 색 띠로(`run3d cardTexture`, 보기 밖이면 "보기에 없는 낱말" 한 줄), DOM 카드 `.run-card-word`. 브리핑 '이번 시험 실제 답안 샘플'(`briefSamples` 4장, 선배 글씨 없음). 채점 시연 14장 '학생이 쓴 답'(다른 표기는 `'AI' (= 인공지능)`)·'AI가 읽은 낱말'. 결판 글·그림 글은 데이터 `showdown.sheetWord/sheetRead/sheetCap/sheetAlt`. 결과 문구 = `cut`·`cutTemplate`(이제 4 임무도 DR.ResultLine 데이터 사용).
- 옛 저장: `DR.Save.fitsMission`(가방의 종류·가짜·"?"·개인정보 id·이름표가 지금 임무에 다 있나) → 아니면 그 임무 브리핑으로(`App.resume`, 1 임무 침수 되돌림도 이것으로). records.m4는 그대로(`m4-browser G`).
- **교사 검수 대기**: `missions/m4.js` 문장 전부, `ui-grade.js`·`ui-result.js` 글, **같은 낱말로 보는 표기**('AI'=인공지능, 'data'=데이터, '머신 러닝'=머신러닝 / '데이트'·'AI' 그대로 = 보기 밖). '알고리듬'은 일부러 안 넣음.
- 그림 대기: 4 임무 카드 썸네일·결판 배경은 아직 숫자판 그림(숫자 '1'·✕).
- 테스트: 단위 `fonts.test`·`m4.test`(24, 새로)·`save.test`(fitsMission)·`result-line.test`(4 임무 문구)·`josa`·`cards`·`privacy` 키 바꿈 — 단위 295. 브라우저 `cardart-browser`(글꼴 4종 읽힘·잉크 폭·갈래 차이·48칸) · `m4-browser`(A~G) · `chapter`·`privacy`·`playtest` 4 임무 키. 스크린샷 `_shot-cardart-m4`·`_shot-m4-run-near-1280/390`·`_shot-m4-zoom-*`·`_shot-m4-relabel-375`·`_shot-m4-inspect-*`·`_shot-m4-showdown-*`.
- 미확인: 실제 학생이 달리며 낱말을 읽는지(헤드리스 스크린샷으로는 가까운 카드만 또렷, 먼 3D 카드는 다른 임무처럼 작음), 교사의 표기 기준 동의, 실기기.

## ★지금 상태 (2026-11-08, 플레이테스트 수정 13건 — 요청서 `docs/feedback/2026-11-08-playtest.md`, 계획 `docs/plans/2026-11-08-playtest-fixes.md`)
- 4 임무 전용(`missions/m4.js`·`ui-grade.js`·`showdown.js`·그림)은 이 작업에선 안 건드림 → 그 뒤 낱말판으로 개편(위 ★). 공용 렌더러 수정만 4 임무에도 닿음 — 결과 문구는 4 임무에서 예전과 같음(`result-line.test` 무작위 가방 400개).
- 조사 = `js/josa.js`(DR.Josa: 숫자 1·3·6·7·8·0, 영문 L·M·N·R 받침, 끝 따옴표·괄호 건너뜀, `fill('{what:이}')`) — judge 문구가 씀(9).
- 조합 이름 = `DR.Cards.comboName`(종류 이름 하나면 그 이름 → 3 임무 '시장 골목', 여럿이면 `what` → 4 임무 '또박또박 쓴 답안', 없으면 A·B)(1).
- 장면 결과 문구 = `js/result-line.js`(DR.ResultLine.sceneLine): 결정 조합 하나 → 조합 `cut`(없으면 기존 `fail.line`), 여럿 → 임무 `cutTemplate[종류]`에 "A와 B"(조합 `item`), 오염만 → 가짜 `cut` / 플레이어 오표기는 `cutTemplate.contam`({label}), 그 밖 → 장면 `cuts`. 1~3 임무 데이터 채움(2 임무 함 이름 = 컨베이어 wrongBin과 같게)(2). ⚠️ 교사 검수 대기 문장에 더함.
- 튜토리얼 연습 카드 = "이 카드도 AI가 배우는 자료야…", 점검표 "이름표가 맞는 카드 n / 11장"(판정 `Judge.exam`은 그대로, 표시만)(3a) · 고치기 창 "그대로 두기"(6) · 시험 각주 짧게(12).
- 타이틀: 진행 중 임무가 없고 기록이 있으면 "N 임무부터 이어하기"(`DR.Save.nextMission` = 기록에서 안 깬 첫 임무, 새 저장 필드 없음) + 그 카드 "다음은 여기"(`.mc-next` = 연습 카드 `.mc-first`와 같은 모양) + 옆 "처음부터". 다 깸 = "처음부터 다시"(확인 창) + 봇 대사 묶음 따로(`title-scene.js LINES_DONE`, `state().lineSet`)(4·11).
- 검수 안내: 이름표 고치기 없는 임무(1 임무 `relabel:false`) = "그림을 보고 필요 없는 카드는 뺀다." · 크게 보기 = 모든 임무 같은 구조(머리줄 이름표 + 닫기 `#btn-zoom-close` 오른쪽 위 → 가운데 사진 → …)(5).
- 보충 준비: 비울 칸 = max(`supplementFreeSlots`, 모자란 장 수 합)(안내에 숫자), "출발할 수 있어요" = `.notice-ok` 초록(7) · 카드 전체 격자 기본 접힘(`#btn-prep-all`, 테스트는 `openPrepAll`)(13).
- 노이즈 경고 = "이번 달리기에서 노이즈로 잃은 카드 n장"(코드는 원래 달릴 때마다 덮어씀 — 보충 뒤 남지 않는 것을 테스트로 고정)(8). 도시 복구 가운데 정렬은 696d4af에서 이미 맞음 — 회귀 테스트만(10). 완료 화면의 "단순화한 규칙" 문단 뺌(감독관 마무리 대사에 한 번)(12).
- 테스트: 단위 `josa.test`·`result-line.test`·`cards.test`(comboName)·`save.test`(nextMission) · 브라우저 `playtest-browser`(항목별, `ONLY=4`처럼 하나만). 바뀐 기대값: `exam-browser`(연습 카드 문장·11장), `flow-browser`(침수 끝 → "1 임무부터 이어하기"), `runner-browser`(노이즈 문구), `m1-browser`(완료 화면 문단 없음). 스크린샷 `_shot-playtest-*`.
- 미확인: 실제 학생이 새 결과 문구·"다음은 여기"를 어떻게 읽는지, 실기기.

## ★지금 상태 (2026-11-08, 도시 복구 그림 6장 연결 + "이어지는" 연출 — 교사 피드백 feedback2)
- 그림 `assets/city/city-0..5.webp`(Codex, 1600×600 = 8:3, 구역 5개 × 20%, city-N = 왼쪽 N칸만 색). 받은 무손실 webp 5.0MB → sharp q90·smartSubsample 1.2MB(원본은 `art-source/city-lossless/`, gitignore). 그림 속 데이터 케이블 = 높이 **94%**(재 봄 — 지시서는 "약 88%") → `config.city.cableY`.
- 틀: 넓은 화면 8:3·`min(100%, 56rem)`(양옆 안 잘림), ≤640px = 4:3 + cover, object-position x = 새 구역이 틀 가운데 오게(지시서 식 `(to-0.5)*20%`를 그대로 쓰면 가운데가 아니라서 cover 계산으로 — 양 끝 구역은 벽에 붙음). 두 장 같은 자리. 자리 계산 = `js/city-look.js`(DR.CityLook, 순수) → CSS 변수 넓은/좁은 두 벌.
- 연출(`ui-city.js`, `.city-page[data-phase]` = wait → line → reveal → flash → text → ready, 시간 `config.city`): 케이블 빛(#7FF9FF 4px 글로우, from 구역 끝 → to 구역 중심) → city-to 겹 clip-path로 새 칸만 아래→위 → 새 칸 brightness 1.25 반짝 → 문구 → 0.8초 뒤 [계속](그 전엔 visibility:hidden). to = 5는 케이블 전체 + 도시 전체 반짝, m4의 2 → 5 같은 건너뜀은 3~5칸이 함께 열림. Space·Enter·클릭 = 바로 ready(`.city-instant`, 계속은 안 눌림 — 버튼은 숨어 있었고 포커스 안 줌, 끝난 뒤 키는 아무것도 안 함). 움직임 줄이기 = 처음부터 ready. 그림 두 장이 `wait`(1.5초) 안에 안 오거나 오류 = 점 5칸 + 문구 + [계속](대체 화면 그대로). 그림이 보이면 큰 점 5칸은 숨김.
- 테스트: 단위 `city-look.test`(6) · 브라우저 `city-browser`(1280·375 × 0→1·1→2·2→3·3→4·4→5·2→5 단계 순서·시간·자리, 건너뛰기 3종, 움직임 줄이기, `DR.UI.city.path`를 없는 이름으로 → 대체 화면). 공용 `browser.mjs`는 이제 도시 그림이 빠져도 오류. 스크린샷 `_shot-city-art-*`.
- 미확인: 실제 눈으로 본 연출 속도감·반짝 세기, 실기기(휴대폰) 성능.
- **3 임무 카드 = 실사풍 거리 사진 14장**(2026-11-08, Codex, `assets/cards/city/*.webp` 384² q82 sharp, 합 약 445KB — 거리 풍경이라 물건 사진보다 큼, 원본 PNG는 gitignore). 종류 9·옛 사진(가짜) 3·개인정보 2(`river_people`·`station_plate`) 모두 `art.photo`로 한꺼번에(Canvas `view` 등은 대체 그림으로 남김 — `cardart.js`는 `o.view`가 있으면 분실물 대체 그림 대신 거리 Canvas). 가림 자리 `mask` = 사진 위(얼굴 남 x0.36·y0.4·w0.075·h0.09 / 여 x0.545·y0.432·w0.07·h0.082 흐리게, 번호판 x0.422·y0.785·w0.11·h0.08 막대), Canvas 대체 그림은 `canvasMask`(옛 자리). 장면 결과 컷·길 안내 시연은 Canvas 그대로. 종류마다 사진 1장이라 같은 종류 카드는 날짜만 다름. 테스트 문턱 조정: `cardart-browser` 장면 조건 차이 150 → 100(사진 낮↔저녁 시장 144·맑음↔비 학교 앞 112, Canvas 버그 때 35), `privacy-browser` 흐림 = std 0.9배 + 잔무늬(grad) 0.6배(작은 얼굴은 머리↔피부 큰 명암이 남아 std만으론 0.81).

## ★지금 상태 (2026-11-08, 「목적에 맞는 활용」 — 개인정보 카드 + 챕터 끝 생각 쓰기)
- **사용자 결정(재논의 금지)**: 설계 `docs/specs/2026-11-08-data-purpose-design.md`, 계획 `docs/plans/2026-11-08-data-purpose.md`. 방향 = 개인정보는 **최대한 보호하는 쪽으로 단순하게**(챕터 끝 정답 방향은 늘 거절, 가명 처리는 한 줄만, 법 설명 없음).
- **① 목적 밖 개인정보 카드**(`js/privacy.js` DR.Privacy, 순수): 임무 파일 `privacy: { on, cards: [{ id, key, fix: 'mask'|'remove', at, art, mask: [{x,y,w,h,look}] }] }`. 카드 = 흔한 종류 카드에 `privateId`만 붙인 것(진짜 `key` 그대로 → 가린 카드 = 그 종류의 정상 카드). `Stream.build` 끝에서 **난수 없이** 표시(그 종류 중 앞 15% 밖·`at` 비율 자리) → 카드 자리·uid·벽은 그대로, 첫 판만. 스냅숏 비교(`walls-helper cardsOf`)는 `privateId`를 빼고, `privacy.test`가 "표시만 늘었다"를 따로 지킴.
  - 1 임무 신분증 지갑(`wallet_closed`로 셈)·메시지 잠금화면(`phone_front`) 가리기 / 2 임무 캔 버리는 사람 얼굴 ×2(`can_drink`) 빼기 / 3 임무 행인 얼굴 강변길(`river_now`)·택시 번호판 역 앞(`station_now`) 가리기 / 4 임무 이름 흘림 획 또박또박 2·4(`neat_2`·`neat_4`) 가리기. **네 임무 모두 켬**(1·2 임무 사진 3장이 와서 384² webp q0.82로 변환, 원본 PNG는 gitignore).
  - `wallet-id` 사진 = **닫힌 지갑의 투명 카드 칸으로 신분증이 보이는 모습**(처음 받은 펼친 지갑판은 1 임무의 드문 모습 '열린 지갑'과 헷갈려 2026-11-08 사용자 결정으로 다시 그림) → 닫힌 지갑 종류로 센다. 가림 상자 = 신분증 카드 전체(x 0.24·y 0.27·w 0.55·h 0.35).
  - 그림: `DR.Cards.artId` = `privateId`(가리면 `privateId#masked`) → 달리기·검수·보충 모두 같은 길. `cardart.js` `maskOver`(문서·번호판·이름 = 검은 막대, 얼굴 = 흐리게), 3 임무 `people`·`plate`, 4 임무 `nameLine`(답 칸 밖 위쪽, 이어 쓴 고리 — 숫자 모양 아님). 개인정보 카드는 그 종류와 같은 씨앗.
  - 검수: 크게 보기에 **모든 카드 공통 '가리기'**(개인정보 아닌 카드 → "가릴 개인정보가 없어"), '가림' 표시, 안내 한 줄. 제출 때 `DR.Privacy.check` → 그대로면 감독관이 막음(어느 카드인지 말 안 함, 버튼은 '검수로 돌아가기'만 — `DR.UI.supervisorBlock`), 2 임무 얼굴을 가리면 "얼굴을 가려도 …" 문장으로 막고 빼야 통과. 장면 판정과는 따로. 달리는 중 알림 없음.
  - 결과: 가릴 수 있던 카드를 뺐으면 마지막 장면에 감독관 "가렸으면 살려 쓸 수 있었어"(`state.privCaught` = 첫 달리기 뒤 가방의 가리기 카드 id, 저장, 옛 저장 []).
  - 테스트 훅: `debugFill`은 개인정보 카드를 **건너뛴다**(기존 테스트 그대로), `privateId`를 id로 주면 그것만. `play-browser` 자동 조종도 고르지 않음.
- **② 챕터 끝**(`js/ui-chapter.js`, `#screen-chapter`, 임무 파일 `chapterEnd`): 1/3 다른 용도 요청(안내 AI 한 줄 + 메시지 카드, 새 초상 없음) → 셋 중 고르기·피드백·다시 고르기 → 2/3 그 임무 개념 질문(대표성·라벨 품질·최신성·편향) → 3/3 문장 틀 생각 쓰기(입력마다 저장, 비워도 됨). 자리 = 1~3 임무 마지막 대화 뒤·도시 복구 전 / 4 임무 재연결 5/5 뒤·의뢰인 대사 전(`app.js finishMission chapterEnd`). 점수 없음.
  - 저장 `records[임무].chapter = { req: {first,last}, concept: {first,last}, note }`(`DR.Save.chapterOf` — 옛 기록은 빈 값, '처음부터'에서 지워짐). 다시 깨면 이전 답이 채워진 채(처음 선택 유지). 임무 완료 요약 `#outro-summary`에 세 줄. 장면 중 새로고침하면 그 판 챕터 끝은 건너뛴다(임무 기록은 이미 남음).
  - 테스트 공용 `passCity`가 챕터 끝도 첫 답으로 지나간다(`passChapter`), `m4-browser ending`도.
- **교사 검수 대기(초안 문장)**: `missions/m1~m4.js chapterEnd` 전부, `js/ui-chapter.js` TEXT, `js/privacy.js` TEXT. 검수 플래그는 두지 않음(README에도 적음).
- 테스트: 단위 `privacy.test`(데이터 규칙·표시·check·wasted)·`chapter.test`(데이터·chapterOf)·`save.test`(privCaught)·`reach.test`(새 1 임무 m1 추가, 옛 침수는 flood, 빼야 하는 카드는 셈 밖). 브라우저 `privacy-browser`(art·flow 4임무×1280·390·reload) · `chapter-browser`(1 임무 자리·다시 고르기·저장·새로고침·다시 깨기·처음부터, 2·3 임무 화면 390, 4 임무 자리). 스크린샷 `_shot-privacy-*`·`_shot-chapter-*`.
- 미확인: 문장의 법적·교육적 정확성(교사 검수), 학생 반응(가리기 버튼을 찾는지, 챕터 끝 길이), 실기기.
- ⚠️ 이 작업 전(1b81f73)에도 실패하던 브라우저 테스트 3개(같은 줄에서 같은 오류, 고치지 않음): `bgm-browser`("바로 끊지 않고 서서히" — 검수로 갈 때 이미 음량 0), `m3-browser`·`play-browser`(3 임무 달리기 끝 `#screen-inspect` 4초 시간 초과). 3 임무 낮 다리 작업 뒤부터로 보임 — 다음 작업에서 따로 볼 것.

## ★지금 상태 (2026-11-07, 달리기 무대 1차 = 「도시 위를 잇는 빛의 다리」)
- **사용자 결정(재논의 금지)**: "엑셀 위에서 달리는 느낌" → 방향 C(도시 위 빛의 다리), 바닥 = 시안 2번 어두운 남색 철판(눈이 덜 피곤, 카드·벽이 잘 보임). 연습·1 임무 = 밤 다리, **3 임무 = 낮 다리**, **2·4 임무 = 실내 무대 유지(2차에서 다듬기)**. 겉모습만(길 모양·코스·판정 그대로). 설계 `docs/specs/2026-11-07-run-bridge-world-design.md`, 계획 `docs/plans/2026-11-07-run-bridge-world.md`.
- **구조**: 임무 데이터 `world: 'bridge'`(+ 3 임무 `worldTime: 'day'`) → `run3d.js start`가 `DR.RunWorld.create`(`js/run-world.js`), 기본 바닥 격자·상자 빌딩 숨김, `peek().world`. 색·구역 모습은 `js/bridge-look.js`(순수, node 테스트 — 밤 바닥 `#16162f`, 낮 바닥 `#535d76`은 분홍 벽 대비 2.2 때문에 계획보다 어둡게, 낮에만 노이즈 벽 = 흰·분홍·연분홍 + 불투명도 0.9 — 진분홍 칸이 낮 바닥과 밝기가 같아서, 리뷰 I1). 1 임무 `scenery: 'bridge'`(구역마다 하늘 색조·다리 아래 불빛 비율), 3 임무 `scenery: 'city'`는 다리 위에서 소품만(등불 S2·강물 다리 아래 S3), 비 = 다리가 S4만.
- **하늘·도시 그림 = 캔버스 뒤 CSS 층**(`.rw-sky/.rw-far/.rw-mid/.rw-tint/.rw-rain`, `#run-stage` isolation + z-index −1). WebGL 텍스처가 아니라서 file:// 더블클릭에서도 막히지 않음(플래그 없는 브라우저로 테스트). 도시 밑변 = `--rw-horizon`(매 프레임 지평선 투영). 그림 못 읽으면 그 층만 숨김 → `#run-stage` 그라디언트가 단색 하늘. 낮 그림 `assets/title/bg-*-day.webp`(Codex, 원본 PNG·preview·ps1은 gitignore), 3 임무 브리핑 때 `DR.RunWorld.preload`.
- 젖은 네온 반사는 레인 밖 여백에만(레인 위에 띠가 지면 카드·벽과 겹침). `?low=1`·움직임 줄이기 = 비·시차·스파크 멈춤(`peek().world.moving`).
- 테스트: 단위 `bridge-look.test`(대비·구역 모습) · 브라우저 `bridge-browser`(연습 밤 1366·375, 다시 달려도 층 5개, 2 임무로 가면 0, low/reduced, 플래그 없는 file://, 1 임무 구역 3색, 그림 없음 대체) · `m3-browser`(낮·구역별 비·저녁빛). 스크린샷 `_shot-bridge-*`. 헤드리스 fps: 이전 16 → 23(상자 빌딩이 빠져 더 가벼움).
- ⚠️ `tutorial-browser`·`runner-browser`는 실시간 대기(30·60초)라 다른 브라우저 테스트 직후 묶어 돌리면 가끔 시간 초과 — 혼자 다시 돌리면 통과(이전 코드도 같은 성질).
- **2 임무 카드 = 실사풍 사진 14장**(2026-11-08, Codex, `assets/cards/recycle/*.webp` 384², 원본 PNG는 gitignore, 1 임무와 같은 `art.photo`/`art.photos`). 신문지·종이 상자, 일반쓰레기(장갑·스펀지·휴지)는 카드 번호로 번갈아. 컨베이어의 처음 보는 물건(variant 3 이상)은 일부러 Canvas. ⚠️ 일부만 사진이면 그림 방식 차이가 가짜 카드 단서가 되니 한 임무 전체를 한꺼번에 켤 것.
- 미확인: 실제 학교 PC 프레임·체감, 실기기 휴대폰, 학생 반응. 2차(2·4 임무 실내 무대)는 2026-11-09 완료(맨 위 ★). 그다음 길 모양(휘기·오르내리기).

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
- **도시 복구 화면**(`js/ui-city.js`, `#screen-city`): 튜토리얼 끝 0→1, 1~3 임무 마지막 대화 뒤(칸이 늘었을 때만), 4 임무는 늘 →5. 칸 = `DR.Save.cityCount`(records.m1~m4 + records.tutorial, '처음부터'면 0). 그림 `assets/city/city-0..5.webp`(2026-11-08 연결 — 위 ★), 못 읽으면 그림 자리 숨기고 점 5칸 + 문구. 타이틀 왼쪽 위 배지 `#title-city`("도시 n/5", role=img).
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
| `js/run-world.js` · `bridge-look.js` | 빛의 다리·실내 무대(캔버스 뒤 하늘·도시·실내 벽 CSS 층 + 3D 다리/벨트·불빛) · 밤/낮/실내 팔레트·구역 모습(순수) |
| `js/ui-story.js` · `ui-inspect.js` · `ui-result.js` · `ui-conveyor.js` | 대화·브리핑·검수(크게 보기 공용 = `zoomer`, 2 임무 이름표 고치기)·감독관·결과·보충 준비·마무리·2 임무 컨베이어 |
| `js/ui-common.js` · `ui-shell.js` | 아이콘 줄·범례·도움말·되돌리기 / 일시정지·타이틀(주인공·임무 고르기) |
| `js/glitch.js` | "지지직" 연출 대상 고르기·선명해지는 거리·깜빡임 일정·효과 그림(연출만, 판정 영향 없음) |
| `js/privacy.js` · `ui-chapter.js` | 목적 밖 개인정보 카드(표시·가리기·제출 판정, 순수) · 챕터 끝(다른 용도 요청·개념 질문·생각 쓰기) |
| `js/ui-guide.js` · `ui-grade.js` · `ui-city.js` · `showdown.js` | 3 임무 길 안내 시연 · 4 임무 채점 시연 · 도시 복구 화면 · 4 임무 결판·동기 카드 규칙(순수) |
| `js/app.js` | 흐름 상태 기계, `?start=` `?run=` 디버그 진입, `DR.App.debugFill` |

클래식 `<script>` + 전역 `DR`(ES 모듈·fetch 금지 — `file://`로 열려야 함). 공통 패키지 `shared/`는 초등편이라 안 씀.

## 검증(재발명 금지)
- 단위: `node --test "data/tests/*.test.mjs"` (353)
- 브라우저: `PLAYWRIGHT_MODULE=D:/Works/token_economy/node_modules/playwright node data/tests/run-all.mjs` (33개: bgm·boot·bridge·cardart·chapter·city·exam·fakes·fire·flow·glitch·hero·indoor·keys·lanes·lost·m1·m2·m3·m4·play·playtest·polish·portraits·privacy·readability·run·runner·**supplement**·title·touch·tutorial·zones) — `file://`로 엶. ⚠️ 전체가 10분을 넘으니 백그라운드로 돌릴 것(m2-browser만 몇 분). ⚠️ PC 메모리가 빠듯함(백그라운드 작업이 강제 종료된 적 있음) — 헤드리스 브라우저 테스트는 **한 번에 하나씩**(run-all이 차례로 돎), 다른 브라우저 테스트와 겹쳐 돌리지 말 것
- 사람 눈: `tests/_shot-*.png`(gitignore) — 특히 `_shot-cardart.png`(1 임무 그림 시트)·`_shot-cardart-m2.png`(2 임무 물건·아이콘·선별장 컷), `_shot-conveyor-*.png`, `_shot-relabel-375.png`, `_shot-run-*.png`
- ⚠️ 함정: 화면 전환 때 버튼 자동 포커스 금지(Space 연타가 브리핑·결과를 건너뜀 — go()가 blur). 달리기 화면은 `touch-action:none`(폰 스크롤·새로고침 제스처). `.screen[hidden]`은 `!important` — ID 셀렉터의 display가 hidden을 덮어써 숨은 화면이 클릭을 가로챘음.
- ⚠️ 2 임무 화면 개수·라벨(`DR.Cards.displayKey`): 이름표가 맞는 카드 = 그 종류, 틀린 카드(가짜·잘못 고친 카드) = **붙은 이름표의 보통 종류**로 센다. 정체를 드러내는 색·글자 금지("고침" 표시는 맞았는지 말하지 않음).
- ⚠️ 컨베이어 원인 규칙: 가짜 원인은 **물건 자기 장면**의 오염만 본다(통과한 장면의 물건은 늘 맞는 함). `danger:S#` 원인 = 그 장면이 위험으로 실패 → 장면마다 건전지 물건이 하나씩 있어 **위험 장면 = 그 장면에서 비상 정지**(리뷰 I1). 원인을 늘릴 때 `conveyor.test.mjs` 무작위 가방 테스트(통과 장면은 모두 맞음·위험⇔비상 정지)가 지켜 준다.

## 남은 일
- **팀 플레이 피드백**(기획서 §11 체크리스트) → `config.js` 수치 조정. 미확인: 실기기 손맛·터치 실기기·저사양 PC 프레임.
- 3·4 임무 완성(2026-11-02). 남은 것: 레이스 고스트(나중에 얹는 선택 층). 1 임무 결과를 컨베이어식으로 바꿀지는 2 임무를 해 본 뒤 결정(설계 §2).
- 인물 디자인(다른 팀과 맞추기)·완성 일러스트는 외부 조건.
