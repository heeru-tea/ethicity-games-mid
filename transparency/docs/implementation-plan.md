# 블랙박스를 열어보는 고양이 Implementation Plan

Goal: 확정 기획 S00~S13을 독립적인 오프라인 웹 게임으로 구현한다.
Architecture: index.html + 로컬 CSS/일반 script. story.js는 대사와 자료, engine.js는 순수 상태 전이, app.js는 렌더링/입력/저장. 서버·빌드·외부 전송 없음.
Tech Stack: HTML, CSS, vanilla JS, Node test runner, headless Edge.
Spec: confirmed-spec.txt (사용자 원문). 사용자 최신 지시: 나머지 에셋 제작 후 본격 구현.

Global constraints: privacy/ 변경 금지. 사용자 캐릭터 ethicity.player 읽기만. 전용 키 ethicity.transparency.progress.v1. 2·5·8은 가상 예측값. 15~20분 목표는 미검증. 도움은 독립 이해로 표시하지 않는다. 모든 조치 분기는 계속 가능. 공개 배포 없음.

Design: 장면 일러스트를 주인공으로 하고 아래에 읽기 쉬운 대화, 조사 패널. Pretendard/system sans. design.md 서브 C(#FDFBF6/#F5EFE1/#23201A/#6D675C/#EDE7DA/#B45309) 사용. 이미지 자체는 확정 남색/회색/노랑. 모바일에서는 사진·버튼을 세로로 배치. 장식적 모션 없음.

Review focus: 손상된 저장 복원, 재선택 후 최초 기록, 도움 경로의 잠금 조건, 사진 실제 좌표와 기록 일치, 모바일 키보드/사진 확대.

- [x] Task 1: 상태 전이 tests/engine.test.cjs를 먼저 작성하고 실패 확인. engine.js로 단서 잠금, 도움, 선택 확정, 복원 검증 구현. node --test tests/engine.test.cjs 통과.
- [x] Task 2: story.js에 장면별 대사/자료/선택 결과, index.html/style.css/app.js에 조사·대조·조치·후일담·수첩 구현. S01 실제 실행과 전체 연결 확인. 주요 DOM 동작은 headless Edge probe로 검증.
- [x] Task 3: 테스트로 세 모의 플레이 경로와 27개 조치 조합, 선택 수정, 저장 차단, 모바일 레이아웃 확인. 실제 스크린샷 검토. 별도 리뷰 후 중요한 결함 수정.

실행: 현재 사용자가 지정한 작업 사본의 새 transparency/ 안에서 진행한다. 기존 다른 게임과 공통 파일은 수정하지 않는다. 변경은 검토 가능한 미커밋 상태로 유지한다.
