# CLAUDE.md — 「데이터 러너: 끊어진 도시」(data) 인수인계

## 지금 상태 (2026-10-28)
- **첫 버전 = 튜토리얼 + 1 임무(침수 판별 AI) 전체 흐름 완성**, 브랜치 `data`(origin/data), 워크트리 `D:\Works\ethicity-games-mid-data`. main 병합은 **팀 피드백 뒤 따로 결정**(팀원은 data 브랜치를 받아 `data/index.html` 더블클릭).
- 성공 기준(사용자): **팀원이 돌려 보고 "재밌다"**. 그래서 달리기 손맛이 최우선.
- 문서: 기획서 `data-runner-plan.md`(무엇을) · 설계 `docs/specs/2026-10-27-data-runner-v1-design.md`(어떻게, 기획서와 다른 점) · 계획 `docs/plans/2026-10-28-data-runner-v1.md`.

## 기획서와 달라진 점(사용자 결정 — 재논의 금지)
- 데이터 세계 = **매끈한 3D**(서브웨이 서퍼식 뒤 카메라, three.js). 기획서의 "픽셀 아트"는 카드 썸네일 자동 픽셀화에만 남김. 팀 공유 필요할 수 있음.
- **경계 조합(S3 네온 반사·S4 흙빛 얕은 침수)은 일반 드문 카드로도 채워짐**, 올바르게 분류한 "?" 카드는 2장 몫(`config.ambiguousWeight`).
- 실패 종류는 장면이 아니라 **빠진 조합**으로: 침수 조합(danger) 빠짐 → 위험(감독관이 막아 세움), 정상 조합만 빠짐 → 불편.

## 구조
| 파일 | 역할 |
|---|---|
| `js/config.js` | 손맛·판정 수치 한 곳 |
| `missions/*.js` | 임무 데이터(장면·조합·카드 수·대사) — 2~4 임무는 여기에 파일 추가 |
| `js/judge.js` · `stream.js` · `catch.js` · `input.js` | 순수 모듈(판정·코스·잡기·입력 분류), node로 단위 테스트 |
| `js/cardart.js` | 카드·아이콘·단서·결과 컷을 Canvas로 생성(같은 화풍 원칙, 지하차도 금지) |
| `js/run3d.js` | three.js 달리기(r149, `vendor/`) — `step/peek/setPaused/finishNow/debugTake` 테스트 훅 |
| `js/ui-story.js` · `ui-inspect.js` · `ui-result.js` | 대화·브리핑·검수·감독관·결과·보충 준비·마무리 |
| `js/app.js` | 흐름 상태 기계, `?start=` `?run=` 디버그 진입, `DR.App.debugFill` |

클래식 `<script>` + 전역 `DR`(ES 모듈·fetch 금지 — `file://`로 열려야 함). 공통 패키지 `shared/`는 초등편이라 안 씀.

## 검증(재발명 금지)
- 단위: `node --test "data/tests/*.test.mjs"` (49)
- 브라우저: `PLAYWRIGHT_MODULE=D:/Works/token_economy/node_modules/playwright node data/tests/run-all.mjs` (boot·cardart·run·tutorial·m1, 1366·375) — `file://`로 엶
- 사람 눈: `tests/_shot-*.png`(gitignore) — 특히 `_shot-cardart.png`(모든 그림 시트), `_shot-run-*.png`
- ⚠️ 함정: `.screen[hidden]`은 `!important` — ID 셀렉터의 display가 hidden을 덮어써 숨은 화면이 클릭을 가로챘음.

## 남은 일
- **팀 플레이 피드백**(기획서 §11 체크리스트) → `config.js` 수치 조정. 미확인: 실기기 손맛·터치 실기기·저사양 PC 프레임.
- 2~4 임무(기획서 §8), 레이스 고스트, 해커 서사. "처음 성공/보충 해결" 기록은 `DR.App.state.record`에만 있음(다음 임무 대사 분기용).
- 인물 디자인(다른 팀과 맞추기)·완성 일러스트는 외부 조건.
