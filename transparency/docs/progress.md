# Progress — implementation-plan.md

Assets: remaining PNG 11개 생성 및 파일 크기/알파 확인. 앞서 12개라고 설명한 개수 정정. 상태 표식은 접근 가능한 코드로 제작 예정.
Pre-flight: story 데이터와 engine 단계 ID를 S00~S13으로 고정. app은 engine의 canAdvance만 사용. 기존 공통 저장 확인 완료; 공식 캐릭터 매핑은 비어 있어 강제 매핑하지 않음.
Ruling: 사용자 확정 기획과 연속 실행 지시를 구현 승인으로 간주하여 재승인 절차를 추가하지 않음.
Ruling: 별도 worktree로 미추적 에셋을 옮기지 않고 승인된 transparency/ 안에 구현; 기존 privacy/ 미추적 파일은 유지.

Task 1: complete — engine tests RED 0/8 → GREEN 8/8.
Task 2: implemented — S00~S13, evidence modal, comparisons, help, choices, crop controls, notebook, sources. S01 Edge screenshots checked at 1440px and 390px. No page errors or overflow. Browser sandbox profile failed; elevated local test execution succeeded.
Task 3: in progress — 27 action combinations reachable. Browser careful path reached ending, then reload failed because restore regex rejected f1/f3. Added roundtrip regression RED → regex fix → GREEN 9/9 including 27 roundtrips. Three browser paths rerunning.
Review: fresh read-only reviewer dispatched under requesting-code-review skill.

Final review findings: no Critical, 4 Important (help exposure untracked, pending action ending inconsistency, keyboard focus loss, stale ordering on reload).
Final: fixed help exposure — help-view marks case assistance and subsequent task status; unit RED→GREEN and browser close-with-Escape RED→GREEN.
Final: fixed ending consistency — retain last committed final, reset completion on revision, prohibit leaving pending action, validate completed save prerequisites; unit RED→GREEN.
Final: fixed focus — stable control selector restores focus after rendering; evidence modal returns focus. Real keyboard Enter/Escape/range twice RED→GREEN.
Final: fixed ordering — verified order displays canonical arrangement and is locked; reload probe RED→GREEN.
Final engine suite: 12/12 passed including 27 final-choice combinations and roundtrips. Browser review regressions: 4/4 passed.
Ruling: arrays lock after successful verification instead of persisting unfinished arrangements; reloading unfinished activity restarts that arrangement, without claiming it verified.
Not judged by reviewer: actual student learning, duration, assistive technology live use, exhaustive screenshot QA. These remain explicitly unverified.
Workspace observation: privacy/js/story.js and privacy/tests/probe-post.js changed outside this task during execution; left untouched. Our writes remain under transparency/.

Task 3: complete — final browser paths careful/trusting/help all reached endings and survived reload; blocked storage playable; corrupt storage safe; no page errors or external requests during play. 14 scenes checked at 375px without horizontal overflow or missing scene images. Art gallery image load check passed. S01 1440px/390px captures, S12 release and mobile S05/ending visually inspected.
Final status: implementation and generated assets remain uncommitted in transparency/. No merge, push or public deployment performed. No deferred code-review findings. Actual learner outcomes/duration and screen-reader/Safari/Firefox use remain unverified.

2026-11-02 읽기 부담 개선: 사건마다 궁금한 것 → 직접 확인(누르고 찾기 + 세 갈래 판단 하나) → 선택 → 결과 네 화면. 주장 네 개 판정·도움 경로·범위 슬라이더 제거, 자료 번호 숨김, 수첩 자동 기록. 저장 revision 4, revision 3 이하 저장은 사건 단위로 옮김. 검증은 README ‘검증’ 참고(단위 14, 브라우저 경로 2 + 점검 4). 1366×768 화면당 글자 수 평균 567→155, 최대 1127→378.

2026-11-02 분량 늘리기 1단계: 사건마다 판단 셋(세 칸이 한 번씩 정답), 결과 뒤 후속 조사(사진 6장·선생님 글 검사·점검표), 작성 기록 5버전·얼굴 버튼 '얼굴 1~5', 수첩 3인칭 사실·판단 셋·후속 조사. 저장 version 2(version 1 저장 옮기기, scene 5 이어하기 확인). 사건 4·5는 설계만(docs/2026-11-02-incidents-4-5-design.md, 그림 지시서 docs/codex-art-brief-4-5.md).

2026-11-08 교사 피드백 반영: 사건마다 생각 정리(문장 틀 2개·자동 저장·비우면 작성 안 함), 마지막 서술과 나의 조사 보고서(PDF로 저장하기 = window.print, 서술 고치기 왕복), 인쇄용 CSS(A4·15mm·사건 카드 안 잘림·정답/다시 볼 것 글자·인쇄 제목). 저장 version 3(version 2는 장면 번호 옮기고 빈 서술). 수첩을 보고서와 같은 사건 카드로. 피드백 2: 대사 옆 작은 얼굴·장면 이름표, 왼쪽 칸 자료 머리말, 세 구역 뒤 자동 스크롤 제거(안내 한 줄), 사진 점수 설명의 게임을 이야기 속 AI로. 피드백 2의 #5·#6·#8(개발자 쪽 설명 가능성, 학생이 투명성을 고치는 후속 조사, 전체 문장 다듬기)은 교사 내용 결정이 필요해 하지 않음. 검증: 단위 19/19, flow-browser PASS(경로 2·점검 11, PDF 2쪽/긴 서술 3쪽), playtest-1106 PASS.

2026-11-08 미리 알리기(설계 docs/2026-11-08-notice-design.md, 계획 docs/2026-11-08-notice-plan.md): 사건마다 후속 조사와 생각 정리 사이에 '만든 사람이라면: 미리 알리기'(카드 고르기·안내문 붙이기·카드별 피드백, 고정 한 줄, 빵집 도입 대사). 보고서·수첩·인쇄에 붙인 안내문. 마지막 장면 넷째 질문. 저장 version 4(version 3 저장은 지난 사건을 legacy로, 수첩 '미리 알리기 해 보기'). 기존 판단 문장·정답·선택지·아직 모르는 점·빵집 점검표는 그대로. 카드·피드백 문장은 교사 검수 대기(README '교사 검수 대기'). 검증: 단위 25/25, flow-browser PASS(경로 2·점검 17, PDF 3쪽/3쪽), playtest-1106 PASS(미리 알리기 키보드·대비 포함). 휴대폰 390 빵집 미리 알리기 화면은 붙이기 전 1097px(화면 844px의 1.3배, 이전·다음 버튼이 아래), 피드백이 나오면 더 길어진다.

2026-11-08 후속 수정: ① 미리 알리기 휴대폰 높이 — 고정 한 줄·도입 대사를 한 묶음으로, 카드 줄·여백·줄 간격 축소(44px·16px 유지), 붙이기 안내를 버튼 옆으로, 휴대폰 이전·다음 한 줄. 390×844 붙이기 전 사진 942→844, 글 967→844, 빵집 1097→875px(경로 측정, 이어하기 안내 없음; 이어하기 안내가 있으면 빵집 932px). 붙인 뒤 1411→1283, 1474→1345, 1684→1499px. 문장은 바꾸지 않음. ② 처음부터 다시 하기 대화상자에 ‘이름과 학번도 지우기’(기본 체크). 풀면 이름·학번만 남김(engine restart). 생각 정리 위치는 그대로(설계 문구와 일치). 검증: 단위 26/26, flow-browser PASS(경로 2·점검 18, 휴대폰 높이 단언 세 사건), playtest-1106 PASS.

2026-11-08 사건 4·5(설계 docs/2026-11-02-incidents-4-5-design.md ⑥ 보완까지, 계획 docs/2026-11-08-cases-4-5-plan.md): 사건 4 「같은 책만 추천하는 도서관」(library)·사건 5 「밤하늘 관찰 모임」(recommend, 모아 혼자) 각각 일곱 화면(미리 알리기·생각 정리 포함). 장면 0 프롤로그, 1~35 사건 다섯, 36 마지막, 37 보고서. 마지막 장면 질문 넷을 사건 5 궁금한 것으로 옮김(asked, 하나 이상 물어야 직접 확인), 마지막 장면은 대사 2줄·마무리·마지막 문장·마지막 서술·메뉴, 완료는 마지막 장면에 들어갈 때. 혼자 규칙(모아 한 줄·잘못 누른 곳 글 안내·남은 자료·상태 표시·결과 피드백 없음, 판단 ‘기록과 맞춰 보면’ 한 줄, 미리 알리기 태그만). 보고서 사건 카드 다섯(사건 5에 물어본 질문), 인쇄 4쪽 안쪽(묶음 이름 왼쪽 칸·9pt). 저장 version 5: version 4 사건 장면 그대로, 마지막·보고서·완료 저장은 사건 4 첫 화면(question → asked), v1~v3 사슬. 새 그림 5장(Codex 납품, 원본 PNG는 .gitignore) → tools/art-4-5.cjs로 webp 사본, 없으면 대신 그림. 사건 1~3 문장은 프롤로그 ‘다섯 개’·질문 옮기기 말고 그대로. 새 문장 전부 교사 검수 대기(README). 검증: 단위 31/31, flow-browser PASS(경로 2·점검 20, PDF 3쪽/긴 경우 4쪽, 휴대폰 미리 알리기 붙이기 전 도서관 844px·모임 앱 864px), playtest-1106 PASS(사건 다섯 판단 15개 근거 자료 한 화면, 사건 5 한 줄 피드백). 미확인: 문장의 교육적 적절성(교사 검수), 실제 학생 플레이 시간(사건 다섯, 데스크톱 경로 클릭 133번·읽는 글자 약 15,000자 프로브 값, 사건 1~3만일 때 80번·9,350자), 실제 인쇄 창.

2026-11-10 사건 4·5 새로 짬(설계 docs/2026-11-10-cases-4-5-rework-design.md, 계획 docs/2026-11-10-cases-4-5-rework-plan.md): 정부 「AI 윤리기준」 7. 투명성의 주체별 역할 가운데 사용자가 고른 두 축(정부·사회의 몫, 이용자도 알릴 의무)을 넣으려고 교사 검수 전이던 옛 사건 4·5(도서관 추천·밤하늘 모임, 둘 다 추천 AI라 겹침)를 버리고 새로 짰다. 사건 4 「겨울 캠프 명단」(camp): 구청 AI 선발이 본의 아니게 버스 드문 솔숲마을에 불리, 모아는 신문부 기자, 구청에 묻기(옛 사건 5 질문 장치 이동)·공개 페이지 빈 칸·마을별 결과·기준표(영업비밀 가림)·과장/정확/축소 기사·새 공개 페이지. 사건 5 「은하수 홍보 그림」(share, 혼자): 루루가 AI 그림을 DM엔 밝히고 냥스타엔 숨김, 작업 기록·AI 그림과 실제 사진·DM/게시물 비교·세 곳(DM·냥스타·학교 게시판)·나눌 때 알리기. 저장 version 6(version 5 저장은 사건 1~3 유지, 새 사건 4 첫 화면부터). 마지막 장면 마무리·토론 질문 넷. 검증: node 32 통과, flow-browser PASS paths 2 checks 21, playtest-1106 PASS, 캡처 확인(인물 겹침·게시물 카드 가림 고침). 새 그림 8장은 Codex 지시서 docs/codex-art-brief-4-5-v2.md(사용자가 맡김), 오기 전엔 대신 그림. 미검증: 실제 학생 반응·플레이 시간, 교사 문장 검수(사용자가 im-not-ai로 다듬을 예정).

2026-11-10 그림 용량: 사건 1~3 PNG 18장(36.0MB) → 같은 크기 webp(4.5MB, q88·사진류 q92). story.js 그림 경로·style.css 소품·art.html·flow-browser 기대값을 .webp로, 원본 PNG는 .gitignore(로컬 보관). 힌트·판단 피드백 상자(.finding)의 왼쪽 색 띠 → 얇은 전체 테두리. 확인: 크기·알파 같음, 그림 경로 16개 파일 있음, node 32 통과, 확대 비교 2장. 미확인: 브라우저 테스트(flow-browser·playtest-1106 — 다른 작업이 브라우저 잠금을 쓰는 중이라 못 돌림), 테두리 바뀐 화면 캡처, 배포 사본 반영.
