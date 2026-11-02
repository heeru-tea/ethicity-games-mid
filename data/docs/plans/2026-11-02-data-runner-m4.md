# 데이터 러너 — 4 임무 「채점 AI」 + 도시 복구 화면 구현 계획

**설계:** `docs/specs/2026-11-01-data-runner-m3-m4-design.md` §3·§5~§9. 열린 질문 없음(2026-11-02 사용자 결정 10가지 + "이의 없음" 기본안, 설계 §9에 목록).
핵심: 이름표 = 선택지 번호 1~5 · 1↔7·3↔8·2↔5 오독(7·8 = 선택지 밖 이름표 가짜) · 위험 = 맞는 답을 틀렸다고 채점(S2·S4) / 불편 = 사람이 다시 채점(S1·S3) · 결판 = S4 · 마지막 보충은 동기 카드 고정으로 반드시 읽힘 · 레이스 없음 · 도시 복구 5칸(튜토리얼 + 1~4 임무) + 타이틀 "도시 n/5" · 시험 이름 "새빛 진학 평가".

**지켜야 할 것(앞 임무들 그대로):** 가짜 정체 비노출(라벨·개수·색은 붙은 이름표 기준, "고침"은 맞았는지 말하지 않음) · needRevealed 전 개수 숨김 · 희귀 카드 앞 노이즈 벽 · 가짜는 자기 구역 뒤쪽 절반·앞 15% 밖 · 이름 나온 가짜가 남으면 실패 · 없었다/부족했다 · 화면 전환 때 자동 포커스 금지 · ES 모듈·fetch 금지(`file://`) · **튜토리얼·1~3 임무 코스는 지금과 같음**(새 스냅숏 `tests/fixtures/courses-before-m4.json` — 1~3 임무 대사 한 줄 추가는 코스에 영향 없음).

**Codex 그림(그림 안 숫자·글자 없음):**

| 파일 | 상태(2026-11-02) | 연결 Task |
|---|---|---|
| `assets/title/mission-m4.webp` | 도착, **커밋 안 됨** | Task 5에서 연결하며 같이 커밋(`mission-m4-original.png`는 올리지 않음) |
| `assets/characters/grader-portraits.png`(2표정) | 도착, **커밋 안 됨** | Task 5에서 연결하며 같이 커밋(`grader-portraits-original.png`는 올리지 않음) |
| `assets/story/showdown-senior.webp` | 대기 | Task 5(없으면 배경 없이 — 3 임무 `bg`와 같이 그림 오류면 숨김) |
| `assets/story/senior-after.webp` | 대기 | Task 5(같음) |
| `assets/city/city-0.webp` ~ `city-5.webp` | 대기 | Task 6(없으면 5칸 점 + 문구) |

그림이 늦게 와도 모든 Task는 진행된다(그림 없음 길이 테스트 대상). 도착하면 경로만 맞는지 보고 커밋.

---

## Task 1 — 엔진 작은 확장 + 4 임무 데이터·판정
**파일:** `missions/m4.js`(새), `js/cards.js`, `js/judge.js`, `js/stream.js`, `missions/cast.js`, `index.html`(스크립트 한 줄), `tests/m4.test.mjs`(새), `tests/fixtures/courses-before-m4.json`(새)
- `missions/m4.js` — 설계 §5.3·§5.4 그대로: `id:'m4'`, `title:'채점 AI'`, `bag:30`, `runSeconds:90`, `supplementSeconds:30`, `seed:4401`, `fires:8`, `zones`(S1~S4), `fakeLate:'zone'`, `scenery:'exam'`(Task 4), `labels` 1~5, `labelOptions` 1~5("?" 버튼), `labelExtra:[{id:'7',text:'7'},{id:'8',text:'8'}]`, `labelStyle:'digit'`, `cardTypes` 11종(`neat_1`~`neat_5`·`flag_1`·`loop_3`·`angular_2`·`round_5`·`table_4`·`slant_1`), `counts`, `ambiguous`(`q_25`→`angular_2`·'2', `q_35`→`loop_3`·'3', `icons:['unknown']`), `fakes`(`x_17`·`x_38`·`x_25` = `harm:'danger'`, `x_scribble` truth null, 모두 `scenes:[…]`), `scenes`(조합·`fail.line` — 설계 §5.4 문구), `outcomeText`(pass '제대로 채점했다' · inconvenience '사람 채점으로 넘겼다 · 불편' · danger '맞게 쓴 답에 ✕ · 위험'), `showdownScene:'S4'`, `peerCards:[{key:'slant_1',n:2},{key:'table_4',n:2}]`, `grading`(Task 4), `story`(Task 5).
- `DR.Cards`:
  - `labelText`가 `labelExtra`도 찾는다(7·8 글자).
  - `fakeScenes(mission, card)`: 가짜이고 붙은 이름표가 원래 그대로이며 `fake.scenes`가 있으면 그것, 아니면 `scenesForLabel(지금 이름표)`.
- `DR.Judge.tally`: 틀린 이름표 카드가 쌓이는 장면 = `fakeScenes`. `DR.Judge.readable(mission, result)` = `showdownScene` 장면의 `missing`이 비었나(오염은 안 봄 — 설계 §5.6).
- `DR.Stream.zoneIndex`: 가짜는 `fake.scenes`가 있으면 그중 가장 늦은 구역(없으면 지금 규칙).
- `cast.grader = { name: '채점 담당 선생님', color: '#7BE0A0', shape: 'square' }`.
- **테스트(`m4.test.mjs`)**: 형식(이름표 1~5만 `labels`·7·8은 가짜만·모든 조합 key 존재) · 16장 가방 첫 판 통과 · 장면마다 실패 길 · '7' 흘려 쓴 1 2장 → S2 위험, 1로 고치면 흘려 쓴 1로 셈 · '8'·2에 '5'도 같음 · 낙서 고칠 수 없음, 2장 → S1 불편 · **크게 기운 1 빼면 S4 위험(문구 "7로 읽었다"·"있지도 않은 번호")** · 표 답 빼면 S3·S4 불편 · **크게 기운 1·표 답 전부 빼면 S4 반드시 실패** · "?" 맞게 = 2장 몫 · 7·8 이름표는 어떤 조합도 안 채움 · S4를 노리는 가짜 없음 · `readable`은 오염 무시 · 코스(seed 4401·1·42): 구역 4, 7·8 가짜가 S2 구역 뒤쪽 절반, 희귀 벽 · **`reach.test`에 m4 포함**(seed 16개 + 배포 seed 4401: 장면마다 필요한 카드를 서로 다른 줄에서 채울 수 있음 — 특히 크게 기운 1 3장 중 2장, 같은 종류 드문 카드 2장이 한 줄에 놓여 하나만 잡히는 경우가 S4 필요량을 깨지 않는지) · 튜토리얼·1~3 임무 코스 = 스냅숏 · 금지 문구(실제 시험·학교, %, "못 쓴·악필", "때문에 떨어졌"이 "생각/믿" 없이).

## Task 2 — 앞 임무 잇기(데이터만)
**파일:** `missions/m1.js`·`m2.js`·`m3.js`, `tests/missions.test.mjs`·`tests/m3.test.mjs`
- 동기 "이상한 건 빼자" 한 줄(설계 §5.8 표, `face:'basic'`):
  - 1 임무 `story.intro`: 동기 첫 줄 바로 뒤 — "흙탕물처럼 애매한 사진은 그냥 빼자. 이상한 건 AI만 헷갈려."
  - 2 임무 `story.intro`: 선별장 직원 줄 뒤, 안내 AI "추가 경보" 앞 — "찌그러진 페트병 같은 건 빼자. 이상한 건 빼는 게 깔끔하잖아."
  - 3 임무 `story.intro`: 동기 "누가 이런 걸 시킨 거지?" 바로 뒤 — "옛날 사진은 그냥 다 빼면 되겠네. 이상한 건 빼는 게 제일 안전해."
- 3 임무 정체 공개 `after[0]`: "입학 평가" → "새빛 진학 평가"("나는 예전에 새빛 진학 평가에서 AI 채점 때문에 떨어졌다고 생각해. …").
- 3 임무 `next:'m4'`. 4 임무 `story.recordLine`(3 임무 기록 한 줄).
- **테스트**: 1~3 임무 도입에 동기의 "빼자" 줄이 하나씩(정답을 말하지 않음 — "넣자·지키자" 없음) · 시험 이름은 "새빛 진학 평가"만 · `m3.next === 'm4'` · 키 테스트처럼 도입 길이를 읽는 브라우저 테스트는 길이를 데이터에서 읽으므로 그대로.

## Task 3 — 손글씨 그림(Canvas, 같은 붓)
**파일:** `js/cardart.js`, `tests/cardart-browser.mjs`
- 답안지 한 칸(“답” 칸 테두리 + 연한 줄) + 베지어 획 숫자 1~5·7·8. 변형 = 굵기·기울기·떨림·깃발(1)·고리(3)·꺾임(2)·감김(5). 같은 함수로 모든 카드(독특한 필체도 같은 붓 — **획 일정·떨림 없음·크게·기울게**).
- 종류: 또박또박 1~5 · 흘려 쓴 1(깃발)·3(고리) · 각진 2 · 둥근 5 · 표 안 답(풀이 표 끝 칸, 답 칸 비움) · 크게 기운 1 · 낙서/지우개 자국 · "?" 2장(번짐) · 단서 그림 4장(같은 학생의 다른 답·연필 자국 확대).
- 아이콘: 동그라미 숫자 ①~⑤, 7·8(같은 모양 — 색으로 정체를 드러내지 않음). `labelColors`에 1~5·7·8.
- 결과 컷: 도장 찍힌 답안지(○ 초록 · ✕ 빨강 · "사람 채점" 노랑) + 선생님 실루엣.
- 결판용 **선배 답안지**(`A.sheet(mission, 'senior', read)` — 크게 기운 1을 표 끝 칸에, 위에 "AI가 읽은 답" 자리).
- **테스트/사람 눈**: `_shot-cardart-m4.png` 그림 시트 — 24칸 썸네일에서 1·7, 3·8, 2·5가 닮았지만 구별되는지, 크게 기운 1이 "개성 있는 글씨"로 보이는지. 지하차도 금지 검사 그대로.

## Task 4 — 검수(숫자 버튼)·채점 시연·결과·달리기
**파일:** `js/ui-inspect.js`, `css/style.css`, `js/ui-grade.js`(새), `js/conveyor.js`(필요하면), `js/app.js`, `js/run-feedback.js`(또는 `run3d.js` 알림 자리), `js/run-scenery.js`, `index.html`, `tests/m4.test.mjs`
- 검수: `labelStyle:'digit'`이면 이름표 고치기 버튼 = 동그라미 숫자 하나(48×44px 이상, 아이콘·글자 따로 없음) → **375px에서 5개 한 줄**(설계 §5.5 계산 272px/307px). "?" 설명표 = 1~5 한 줄 + "넣지 않기" 둘째 줄. 7·8이 붙은 카드는 지금 이름표 "7(선택지에 없는 번호)", 눌린 버튼 없음. 범례 "이 시험의 선택지는 1~5번."
- 채점 시연 `DR.UI.grade(mission, result, done)`(새 `js/ui-grade.js`, `ui-guide.js` 틀): 답안지 12장(`mission.grading` — `{ id, scene, art, variant, chose, answer, bin:'o'|'x', wrongBin:'x'|'hold', read, hazard, causes }`), 원인 규칙 = `DR.Conveyor.sort`. 줄마다 "학생이 고른 번호 · AI가 읽은 번호". 위험 = 맞게 쓴 답에 ✕ → 감독관 멈춤 창 한 번("잠깐, 이건 사람이 다시 보자." + 책임 한 줄). 진짜 오답 1장은 늘 ✕(초록). 2배속·건너뛰기·움직임 줄이기·done 한 번.
- `app.js judgeAndShow`: `m.grading`이면 `DR.UI.grade`.
- 달리기 구역 진입 대사 `story.runLines:[{zone,who,text,face}]` — 첫 가짜 안내와 같은 알림 틀(S2·S4 선배 한 줄).
- `RunScenery` 'exam' 테마(구역마다 색만 — 교실 창·칠판 줄 정도, 숫자·글자 없음).
- **테스트**: 시연 원인마다 답안지 ≥1 · 통과 장면 답안지 모두 맞음(무작위 가방) · 위험 장면(S2·S4) ⇔ 멈춤 · 진짜 오답 1장 늘 맞음 · 375px 버튼 5개 같은 줄(브라우저, Task 7).

## Task 5 — 결판·동기 합류·보충 보장·재연결·해커의 이후 + 그림 연결
**파일:** `js/app.js`, `js/save.js`, `js/ui-inspect.js`, `js/ui-story.js`, `js/ui-shell.js`, `missions/m4.js`(story), `css/style.css`, Codex 그림 2장 커밋
- 흐름(`app.js`): 장면 결과 뒤 `showdown(m, r)`:
  - `DR.Judge.readable` 참 → `story.showdown.pass` → (다른 장면 실패 + 보충 남음이면 `passOthers` 한 줄 → 보통 보충, 결판은 다시 안 함) → 재연결(Task 6 `city` 5/5) → 의뢰인 한 줄(선생님 + 택배 기사) → 첫 판 통과였으면 동기 "나도 이거 챙겨 왔어" → `story.after`(bg `senior-after.webp`) → 마무리(최종 토론 질문 2줄).
  - 거짓 → `story.showdown.fail`("봐, 또 지웠잖아.") → 동기 합류(처음 한 번 `peerJoin` 대사) → **동기 카드 규칙**(설계 §5.6 표): 남은 보충 2 = NEW·뺄 수 있음 / 1 = `fixed` / 0 = 달리기 없이 `fixed`로 넣고 다시 제출 1회(보충 횟수 밖).
  - 동기 카드 = `peerCards`로 만든 카드(id `peer_…`), 보충 달리기 뒤 가방에 NEW로 붙인다. 이미 가방에 있으면 다시 넣지 않는다(고정으로만 바꿈).
- 결판 화면: 대화 화면 + `bg: 'assets/story/showdown-senior.webp'` + 선배 답안지 그림(Task 3)과 "AI가 읽은 답: 1 · ○" / "AI가 읽은 답: 7 — 선택지에 없는 번호 · ✕". 그림 줄(대사 데이터)에 `sheet` 필드 → `DR.UI.dialogue`가 대화창 위에 얹는다.
- 검수·보충 준비: `card.fixed`면 빼기 버튼 대신 "동기와 함께 넣음"(누를 수 없음), "1장 빼기" 고르기에서 빠짐.
- 저장: `App.state.peer`('none'|'joined'|'fixed')·결판 통과 여부를 체크포인트에 — 새로고침 뒤 같은 자리에서.
- 초상: `ui-story.js` SHEETS `grader: ['grader', 2]`, SHEET_NAMES `grader: '채점 담당 선생님'` → **`assets/characters/grader-portraits.png` 커밋**.
- 임무 고르기: `MISSION_CARDS`에 `['m4', '4 임무 · 채점', '맞게 쓴 답에 ✕가 찍힌다면?', 'assets/title/mission-m4.webp']` → **`assets/title/mission-m4.webp` 커밋**(README 표에 한 줄).
- 대사 데이터(`m4.story`): intro 7줄(설계 §5.8) · guideBrief · recordLine · supervisorQuestion · gradeIntro · emergency · responsibility · clientPass/Fail(grader) · runLines · showdown{bg, ask, pass, passOthers, fail, peerJoin, peerFixed, peerBox} · reconnect(의뢰인 줄) · after{bg, lines} · outro(시뮬레이션 2줄 + 토론 질문 2줄).
- **테스트**: **결판 보장** — 무작위 가방 + 무작위 빼기(동기 카드 포함, 고정은 못 뺌)로 보충을 끝까지 돌려도 마지막엔 늘 `readable`(남은 보충 0 다시 제출 길 포함) · 동기 카드 NEW/고정 표시 · 첫 판 통과 길에도 동기 "챙겨 왔어" · 대사 인물 모두 cast · 꾸짖는 말 없음 · bg·초상·썸네일 파일 존재(대기 그림은 "있으면 경로가 맞나"만).

## Task 6 — 도시 복구 화면 + 타이틀 "도시 n/5"
**파일:** `js/ui-city.js`(새), `js/app.js`, `js/ui-shell.js`, `js/save.js`(읽기만), `missions/tutorial.js`·`m1.js`~`m4.js`(`cityLine`), `css/style.css`, `index.html`, `tests/city.test.mjs`(새)
- `DR.App.cityCount()` = `(tutorialDone ? 1 : 0)` + m1~m4 중 `records[id].cleared` 개수(0~5).
- `DR.UI.city({ from, to, line }, done)`: `assets/city/city-{from}.webp` → `city-{to}.webp` 0.8초 서서히(움직임 줄이기면 바로), "도시 to/5 — {cityLine}" + [계속]. 숫자 %·점수 없음. `<img>` 오류면 그림 자리를 숨기고 코드 5칸 점만(흐름 안 막음).
- 자리(설계 §7 표): 튜토리얼 마무리 대화 뒤·1 임무 도입 전(0→1) · 1~3 임무 마지막 대화 뒤·"임무 완료" 전(n−1→n, 기록을 남긴 뒤 계산) · 4 임무 결판 통과 뒤 = 재연결(늘 →5). 칸 수가 늘지 않았으면(다시 깸) 건너뜀(4 임무는 늘).
- `cityLine` 예: 튜토리얼 "데이터 러너가 처음 길을 냈다" · m1 "침수 판별 AI가 다시 이어졌다" · m2 "분리배출 분류 AI가 다시 이어졌다" · m3 "길 안내 AI가 다시 이어졌다" · m4 "채점 AI까지, 도시가 다시 이어졌다".
- 타이틀 구석 배지(`ui-shell.js`): 왼쪽 위 16px, 점 5개(10px, 깬 칸 노랑 `#FFD24A`·남은 칸 테두리) + "도시 n/5"(13px). `role="img"`, `aria-label="도시 복구 5칸 중 n칸"`, 포커스·클릭 없음. 0칸이어도 보임. 타이틀 3D·임무 카드와 겹치지 않는지 375·1280 확인.
- **테스트**: `cityCount` 경우들(튜토리얼만·순서 건너뜀·처음부터 = 0) · 재연결은 늘 5 · 다시 깨면 화면 건너뜀 · 그림 없음 → 점 5칸 + 문구, done 한 번 · 타이틀 배지 aria-label·n.

## Task 7 — 검증·리뷰·배포
- 단위 전체(`node --test "data/tests/*.test.mjs"`), 브라우저는 **한 번에 하나씩**(새 `m4-browser.mjs`, `city-browser.mjs` 또는 polish에 합침, 백그라운드):
  - 첫 판 S4 실패 → 결판 "또 지웠잖아" → 동기 합류(NEW 4장) → 보충 → 결판 "읽네" → 도시 5/5 → 해커의 이후 → 마무리.
  - 첫 판 통과 길 · 동기 카드를 빼고 마지막 보충까지 간 길(고정 표시) · 그림 없음 길(도시·결판 배경).
  - 375px 이름표 버튼 5개 한 줄 · 1280·390 · 터치 · 튜토리얼 끝 0→1/5 · 타이틀 "도시 n/5".
- 스크린샷 직접 확인: `_shot-cardart-m4.png`, `_shot-m4-relabel-375.png`, `_shot-m4-grade-*`, `_shot-m4-showdown-1280/390`, `_shot-city-*`, `_shot-title-city`.
- opus 최종 리뷰 → Critical/Important 수정 → `CLAUDE.md` 인수인계 갱신 → push(+ 배포 레포 갱신, boot 스모크).
- 보고는 확인/미확인 구분(미확인 예: 실제 학생 플레이 속도, 대기 중 Codex 그림 실제 모습).

**순서:** Task 1 → 2 → 3 → 4 → 5 → 6 → 7. Task 2·3·6은 Task 1 뒤 서로 독립(병렬 가능, 단 `app.js`를 고치는 Task 4·5·6은 차례로). 그림 대기는 어느 Task도 막지 않는다.
