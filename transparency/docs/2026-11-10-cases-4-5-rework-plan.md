# 사건 4·5 새로 짜기 구현 계획

> 실행: Native(이 세션에서 직접, 사용자 ‘ㄱㄱ’ 2026-11-10). 단계는 체크박스로 추적.

**목표:** 설계 `docs/2026-11-10-cases-4-5-rework-design.md`대로 사건 4(`library`→`camp`)·5(`recommend`→`share`)를 갈아 끼운다.
**구조:** 엔진(키·정답·저장 v6) → story(문장) → app(자료 화면·후속 조사·화면 카드·사건별 생각 정리 틀) → 브라우저 테스트 → 문서·그림 지시서. 장면 번호(22~28, 29~35)와 일곱 단계는 그대로.
**기술:** 바닐라 JS, node:test, 헤드리스 Edge(Playwright).

## Global Constraints
- 사건 1~3 문장·정답·장면 번호 변경 금지.
- 판단 세 칸은 사건마다 한 번씩 정답. camp = `['unknown','different','confirmed']`, share = `['different','confirmed','unknown']`. 후속 조사 정답 둘 다 `different`.
- 휴대폰 390×844: 글자 16px·누르는 곳 44px 이상.
- 실제 상표·기관 이름 금지(DM·냥스타·모아마을 구청 청소년과).
- 새 문장은 모두 교사 검수 대기(README 목록), 사용자가 나중에 im-not-ai(humanize)로 다듬음.

## Review Focus
1. 옛 version 5 저장(사건 4·5 도중·완료)을 열면 사건 1~3 기록은 남고 새 사건 4 첫 화면에서 이어진다 → playtest.test에 v5→v6 테스트.
2. version 1~4 저장의 옛 질문(`question`)은 더 이상 사건 4 질문이 아니므로 버린다(`asked=[]`), 손상 판정은 옛 질문 목록으로 → playtest.test.
3. 사건 4 질문을 하나도 안 하면 직접 확인으로 못 간다(옛 사건 5 규칙 이동) → engine.test.
4. 사건 5 혼자 규칙: 모아 화자 줄·결과 모아 피드백 없음, 판단 sum 한 줄 → engine.test 구조 검사.
5. 새 그림이 없을 때 대신 그림으로 뜬다(.webp→.png→대신) → flow-browser 그림 검사.

---

### Task 1: 엔진 — 키·정답·질문·저장 v6
**Files:** `engine.js`, `tests/engine.test.cjs`, `tests/playtest.test.cjs`, `tests/combinations.test.cjs`
**Produces:** `CASES=['photo','writing','face','camp','share']`; `checks.camp=['camp-page','camp-results','camp-criteria']`, `checks.share=['share-log','share-photo','share-compare']`; `choices.camp=['loud','accurate','quiet']`, `choices.share=['keep','tag','explain']`; `followMarks.camp={ids:['changed'],values:['found']}`, `followMarks.share={ids:['dm','post','board'],values:['open']}`; `questions=['purpose','criteria','who','appeal']`, `OLD_QUESTIONS=['input','criteria','unknown','notice']`; `noticeCards.camp={must:['camp-role','camp-office','camp-appeal'],nice:['camp-items'],conflict:['camp-everyone'],promise:['camp-never']}`, `noticeCards.share={must:['share-ai','share-real'],nice:['share-photo','share-spell'],conflict:['share-settings'],promise:['share-same']}`; `initial().version===6`; `ask` 액션은 camp hook에서만; `canAdvance` hook 게이트·`consistent`의 asked 검사는 camp.
- [ ] 테스트 먼저: 위 값 단언, camp hook 질문 게이트, v5 저장(scene 25·30·37·completed) → scene 22·completed false·사건 1~3 그대로·camp/share 빈 값, v4·v1 옛 질문 → `asked` 빈 배열, 조합 162개·판단 20개.
- [ ] 실패 확인 `node --test tests/engine.test.cjs tests/playtest.test.cjs tests/combinations.test.cjs`
- [ ] 구현: restore에 version 5를 OLD 경로로(KEYS=OLD3, `n>=RESUME?RESUME:n`), 6은 현재 경로. 옛 질문 검증은 OLD_QUESTIONS.
- [ ] 통과 확인, 커밋.

### Task 2: story — 사건 4·5 문장, 마지막 장면, 사건별 생각 정리 틀
**Files:** `story.js`, `tests/engine.test.cjs`(story 구조 검사 부분)
**Produces:** `cases.camp`(hook, asks/askPrompt/askNeed/askWho:'office'/afterAsk, checks 3개+각 자료 데이터 `page`·`results`·`criteria`, judges, choose(options에 `screen`), follow(`segments` old/new, judge, unknown, more), notice(cards, title, paper), `reflect:{q1,q2}`), `cases.share`(solo, soloNote, `post`(화면 카드), checks+`log`·`photos`·`compare`, judges(sum), choose(options `screen`), follow(`places`), notice(+`principle`), `reflect`); names에 `office:'구청 청소년과'`, `paper:'마을 신문'`, `moaReporter`·`damiLetter`·`clerkPaper`·`luluPhone`·`bamiPhone`; art.newArt는 설계 §6 파일; ending 마무리·토론 넷.
- [ ] 구조 테스트 먼저: 카드 id가 engine noticeCards와 일치, judges 3개·src가 checks 안, share 문장에 moa 화자 없음·결과 feedback 없음·judges sum 있음, asks id = E.questions, options id = E.choices.
- [ ] 문장 넣기(설계 문장 그대로, §3·§4·§5).
- [ ] 통과 확인, 커밋.

### Task 3: app — 자료 화면·찾기·후속 조사·화면 카드·생각 정리 틀
**Files:** `app.js`, `style.css`
- 자료 찾기 액션: `cell`(공개 페이지 빈 칸, target 둘 중 하나), `village`(마을 행, 솔숲), `crit`(기준표 행 열기, 넷 모두 열면 확인), `part`(작업 기록 부분, 그림), `line`(지난 모임 기록 줄), `said`(DM/게시물 비교, DM 줄). camp는 잘못 누르면 tapHint, share(혼자)는 `tried` 표시만.
- 후속 조사: camp = 옛 library `change` 장치(새 공개 페이지에서 달라진 말), share = 옛 recommend `list` 장치로 세 곳 카드.
- 화면 카드: camp = 마을 신문 1면(결과에 따라 option.screen), share = 냥스타 게시물(phone 모양, 결과에 따라 option.screen).
- 질문 대답 화자 `c.askWho`. 생각 정리·보고서 서술 틀은 `c.reflect||D.reflect`. 미리 알리기 고정 한 줄은 `c.notice.principle||N.principle`. 그림 다시 그리기 대상 키 camp/share.
- [ ] 구현 → 헤드리스로 각 화면 열어 JS 오류 0 확인, 커밋.

### Task 4: 브라우저 테스트 갈아 끼우기
**Files:** `tests/flow-browser.cjs`, `tests/playtest-1106-browser.cjs`
- [ ] library/recommend 분기를 camp/share로(찾기 클릭 대상·화면 카드 글·보고서 ‘물어본 질문’은 사건 4 카드), 그림 대신 검사 파일 이름 갱신, PDF 쪽수 기준 재측정.
- [ ] `node tests/flow-browser.cjs` → `PASS`, `node tests/playtest-1106-browser.cjs` → PASS(한 번에 하나씩), 커밋.

### Task 5: 그림 지시서·문서
**Files:** `docs/codex-art-brief-4-5-v2.md`, `README.md`, `docs/progress.md`
- [ ] 설계 §6 그림 8장 지시서(기존 지시서 머리말·참조 파일 형식).
- [ ] README 사건 4·5 설명·교사 검수 목록 교체, progress 기록. 커밋·push(transparency 브랜치).
