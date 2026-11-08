# 「미리 알리기」 구현 계획

2026-11-08 · 설계 `docs/2026-11-08-notice-design.md`(승인됨, '검토 뒤 정한 것' 포함)를 구현한다. 빵집 점검표 줄 추가는 하지 않는다(설계에서 취소).
작업마다 실패하는 검사를 먼저 쓰고, 실패를 본 뒤 구현해 통과시킨다. 작업마다 `transparency` 브랜치에 커밋(푸시 안 함).

단위 검사: `node --test tests/engine.test.cjs tests/combinations.test.cjs tests/playtest.test.cjs` (`transparency/`에서, 파일을 직접 적는다).
브라우저 검사: `node tests/flow-browser.cjs`, `node tests/playtest-1106-browser.cjs` — 한 번에 하나, 실행 전 `D:\Works\.browser-test.lock` 잡기(mkdir), 끝나면 바로 rmdir.

## 정한 세부(만드는 사람에게 맡긴 것)

- 단계 이름 `notice`, 위치 follow → **notice** → reflect. 사건마다 일곱 화면. 장면: 0 프롤로그, 1~7 사진, 8~14 글, 15~21 얼굴, 22 마지막, 23 보고서.
- 저장 필드 `notices: {photo|writing|face: {picked: [카드 id], posted: null | [카드 id] | 'legacy'}}`.
  - `picked` = 지금 눌러 둔 카드, `posted` = 마지막으로 '안내문 붙이기'를 눌렀을 때의 카드(피드백·보고서·수첩은 이것 기준).
  - 붙인 뒤 카드를 바꾸면 피드백을 숨기고 "다시 붙이기"를 안내한다(바뀐 카드에 옛 피드백이 붙어 헷갈리지 않게).
  - 카드를 하나도 안 고르면 '안내문 붙이기'는 꺼져 있다.
- 카드 종류(engine): `must`(꼭 필요) · `nice`(있으면 좋음) · `conflict`(상충) · `promise`(지킬 수 없는 약속). 카드 문장·순서·피드백 문장은 story.js.
- 판정 `noticeCheck(key, ids)`: 꼭 필요 카드를 모두 넣고 상충·약속 카드가 없으면 `ok`. 있으면 좋음은 판정에 안 넣는다.
- 카드 수: 사진 5(꼭 2·좋음 1·상충 1·약속 1), 글 5(같음), 빵집 6(꼭 3·좋음 1·상충 1·약속 1). 화면 순서는 꼭 필요 카드가 몰리지 않게 섞는다.
- 카드별 피드백 = 상태 글자 태그(예: "꼭 필요 · 빠짐", "부딪침 · 넣음") + 짧은 한 줄. ✓/! 표시와 실선/점선으로도 구분(색만으로 구분 안 함). 전체 판정은 role=status.
- 단계 첫머리 고정 한 줄(모아): "안내문은 잘못된 조치를 대신하지 않아. 그래도 미리 알리는 건 따로 해야 할 일이야." 빵집은 이어서 모아: "가게 입구에는 얼굴 인식을 쓴다는 안내가 없었어."
- 왼쪽(데스크톱)은 사건별 안내문 종이(사진 앱 첫 화면 안내 / 검사기 안내문 / 빵집 입구 안내문). 휴대폰은 카드와 피드백만 먼저, 안내문 종이는 아래.
- 보고서·수첩: 사건 카드에 '미리 알리기' 묶음(붙인 카드 목록, 빠진 꼭 필요 카드, 판정 글자). 인쇄에서는 한 줄로 이어 써서 3쪽 안쪽.
- 저장 version 4. version 3·2·1 저장을 옮길 때 이미 이 단계를 지난 사건은 `posted: 'legacy'`(아직 안 함, 넘어가기는 막지 않음). 수첩에 "미리 알리기 해 보기".
- 마지막 장면 질문 넷째: `notice` "쓰기 전에 무엇을 알려 줬어야 해?". afterAsk "세 질문 모두…" → "네 질문 모두 상자를 여는 질문이야."(숫자만 고침).

## 작업

### 작업 1 — engine: 일곱 단계 배치와 미리 알리기 상태·판정
1. 실패 검사 먼저(engine.test.cjs): 배치(END 22·REPORT 23·사건마다 notice가 follow와 reflect 사이), 카드 고르기 토글(다른 화면·다른 사건 카드 무시), 아무것도 안 고르면 붙이기 안 됨, 붙여야 다음으로, 붙인 뒤 다시 고르기, 판정 세 경우(꼭 필요 빠짐 / 상충 넣음 / 약속 넣음)와 다 맞음(있으면 좋음 넣어도 다 맞음). follow 다음 화면이 notice. combinations.test.cjs의 play()가 notice를 지나도록 고치고 18조합 왕복.
2. 실행 → 실패 확인.
3. engine.js: `SEVEN`, `notices` 초기값, `noticeCards`, `noticeIds`, `noticeCheck`, `noticeDone`, reduce `notice-pick`·`notice-post`, canAdvance, consistent. version 값은 작업 2에서 올린다.
4. 실행 → 통과. 커밋.

### 작업 2 — 저장 version 4와 옮기기
1. 실패 검사 먼저(playtest.test.cjs): version 4 왕복, 망가진 notices는 처음부터, version 3 저장(옛 배치 장면 번호)이 같은 단계로 옮겨지고 이미 지난 사건은 `legacy`·넘어가기 가능·나중에 붙이면 배열로, version 3 후속 조사 중 저장은 legacy 아님(다음이 notice), version 2·1 옮기기도 version 4로.
2. 실행 → 실패 확인.
3. engine.js: `LAYOUT3`, restore에서 version 2·3·4 처리, upgrade(version 1)에서 legacy.
4. 실행 → 통과. 커밋.

### 작업 3 — 미리 알리기 화면(story 문장 + app + css)
1. 실패 검사 먼저: engine.test.cjs에 story 카드 id·종류가 engine과 같은지, 상충 카드마다 부딪치는 이유 문장이 있는지. flow-browser.cjs의 play()에 notice 단계(고정 한 줄, 빵집 도입 대사, 카드 aria-pressed, 붙이기 전 다음 잠김, 붙이기 → 카드별 태그·status, 다시 고르기 → 피드백 숨김·다시 붙이기, 다 맞음/고칠 점) 추가. 1366·390 경로 둘 다.
2. 실행 → 실패 확인(단위 + 브라우저).
3. story.js `notice`(카드·피드백·고정 한 줄), app.js 화면, style.css.
4. 실행 → 통과. 캡처 `desktop1280-notice`, `phone-notice` 확인. 커밋.

### 작업 4 — 보고서·수첩·인쇄·legacy
1. 실패 검사 먼저(flow-browser.cjs): 보고서 사건 카드마다 '미리 알리기'와 붙인 카드 문장, 수첩에도, 새로고침 뒤 유지, version 3 저장(빵집 생각 정리까지 간 상태) → 수첩 "미리 알리기 해 보기" → 그 화면 → 붙이기 → 보고서 반영, 인쇄 3쪽 안쪽(모두 채운 경우 포함).
2. 실행 → 실패 확인.
3. app.js caseCard, style.css(인쇄 한 줄).
4. 실행 → 통과. 캡처 `desktop1280-report`, `phone-report`, `print-preview` 다시 확인. 커밋.

### 작업 5 — 마지막 장면 넷째 질문
1. 실패 검사 먼저: engine.test.cjs에 questions에 `notice`, story asks가 engine questions와 같은 순서·넷, afterAsk가 '세 질문'이 아님. flow-browser.cjs에서 notice 질문을 골라 앱 대답 확인.
2. 실행 → 실패 확인. 3. engine·story 고침. 4. 통과. 커밋.

### 작업 6 — playtest-1106 검사 맞추기, 문서, 마무리
1. playtest-1106-browser.cjs의 저장 만들기(finishCase)에 notices 추가(지금은 version 4에서 앞 사건 notice가 비어 저장이 거절됨 → 실패 확인 후 고침).
2. README·progress.md: 일곱 화면, 저장 version 4, 검증, 교사 검수 대기 문장 목록.
3. 단위 전체·브라우저 둘 다 마지막으로 돌리고 개수 기록. 커밋.
