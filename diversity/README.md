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
| `js/story.js` | 화면 문구 전체(시나리오 + `scenario/` 보완안) |
| `js/store.js` | 저장(`ethicity.diversity.*`, 완료 시 `ethicity.result.diversity`) |
| `js/stage.js` | 1280×720 무대 — 공통 runtime으로 배경·인물·효과 |
| `js/app.js` | 화면 흐름, 선택·보고서·성찰, 통합 이벤트(`ethicity:ready/progress/complete`) |
| `css/diversity.css` | `.game-diversity` 아래 전용 스타일 |

## 검사

```
PLAYWRIGHT_PATH=<playwright 설치 경로> node diversity/tests/check-flow.cjs
```

키보드만(1280)·터치만(760, 430·움직임 줄이기)으로 끝까지 진행하며 콘솔 오류, 가로 넘침, 통합 이벤트, 저장 키, 손상된 저장값과 이어 하기를 확인합니다. 화면은 `tests/_shot-*.png`(커밋 제외)로 남습니다.
