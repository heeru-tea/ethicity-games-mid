# 다양성(diversity)

AI윤리교육 게임 중등편 — 다양성 편

## 이력 관리

- 커밋 메시지는 한국어로 씁니다.
- 형식: `type(diversity): 설명`
  - `feat` 기능 추가 · `fix` 버그 수정 · `docs` 문서 · `refactor` 구조 정리 · `test` 테스트 · `chore` 기타
  - 예: `feat(diversity): 첫 장면과 인물 선택`

## 실행

- `index.html`을 브라우저로 엽니다. 공통 팩(`../shared/ethicity-elementary-common-v1/`)을 같은 저장소 구조 그대로 씁니다.
- 로컬 서버: `node diversity/tests/serve.mjs` → `http://127.0.0.1:8080/diversity/`

## 구성

| 파일 | 내용 |
|---|---|
| `js/story.js` | 화면 문구 전체(시나리오 + `scenario/` 보완안), 탐험 장소·좌표·로봇 동료 대사 |
| `js/store.js` | 저장(`ethicity.diversity.progress.v2`·`settings.v1`, 완료 시 `ethicity.result.diversity`) |
| `js/stage.js` | 1280×720 무대 — 공통 runtime으로 배경·인물·효과, 발 좌표 순서로 앞뒤 |
| `js/walk.js` | 걷기 — 방향키·WASD, 누른 곳까지 길 찾기, 장면별 이동 영역·가구 충돌, 로봇 동료 따라오기 |
| `js/app.js` | 화면 흐름, 지도·장소 탐험, 선택·보고서·성찰, 통합 이벤트(`ethicity:ready/progress/complete`) |
| `css/diversity.css` | `.game-diversity` 아래 전용 스타일 |

## 탐험 구조

- 네 미션 모두 탐험형입니다: 중앙마당 지도 → 도서관(뉴스) → 지도 → 마당·게시판(광고) → 지도 → 교실(교육) → AI 실습실(최종 심의). 미션마다 단서 → 첫 판단 → 결과 듣기 → 추가 정보 → 최종 판단, 최종 심의는 위원장 선생님 → AI 단상(공통 원칙) → 회의 테이블(제정서).
- 게임 시작 전 공통 팩 학생 5명 중 한 명을 골라 그 모습(walk sheet)으로 걸어 다닙니다. 고른 학생이 맡던 위원 역할은 `story.js`의 `standIn` 학생이 대신 맡습니다.
- 걷기: 방향키·WASD, 표시된 곳 앞에서 Space·Enter로 살펴보기. 무대 바닥·장소 버튼·패널 목록을 누르면 그곳까지 걸어갑니다(움직임 줄이기면 바로 이동). 그래서 터치·키보드·화면 읽기 프로그램 모두로 끝까지 할 수 있습니다.
- 이동 영역과 가구 충돌은 공통 팩 walkAreas(예제용) 대신 `story.js`의 `walks`에 장면별로 정했습니다.
- 로봇은 위원이 아니라 동료입니다: 물어보기, 어디로 가지?(다음 목적지 표시), 단계를 마쳤을 때 돌아보기.

## 검사

```
PLAYWRIGHT_PATH=<playwright 설치 경로> node diversity/tests/check-flow.cjs
```

키보드만(1280)·터치만(760, 430·움직임 줄이기)으로 끝까지 진행하며 콘솔 오류, 가로 넘침, 통합 이벤트, 저장 키, 손상된 저장값과 이어 하기를 확인합니다. 화면은 `tests/_shot-*.png`(커밋 제외)로 남습니다.
