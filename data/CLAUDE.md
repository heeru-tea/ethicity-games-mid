# CLAUDE.md — 「데이터 러너: 끊어진 도시」(data) 인수인계

## ★지금 상태 (2026-11-02)
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
| `js/app.js` | 흐름 상태 기계, `?start=` `?run=` 디버그 진입, `DR.App.debugFill` |

클래식 `<script>` + 전역 `DR`(ES 모듈·fetch 금지 — `file://`로 열려야 함). 공통 패키지 `shared/`는 초등편이라 안 씀.

## 검증(재발명 금지)
- 단위: `node --test "data/tests/*.test.mjs"` (145)
- 브라우저: `PLAYWRIGHT_MODULE=D:/Works/token_economy/node_modules/playwright node data/tests/run-all.mjs` (15개: boot·cardart·fakes·fire·flow·hero·keys·m1·**m2**·portraits·readability·run·touch·tutorial·zones) — `file://`로 엶. ⚠️ 전체가 10분을 넘으니 백그라운드로 돌릴 것(m2-browser만 몇 분). ⚠️ PC 메모리가 빠듯함(백그라운드 작업이 강제 종료된 적 있음) — 헤드리스 브라우저 테스트는 **한 번에 하나씩**(run-all이 차례로 돎), 다른 브라우저 테스트와 겹쳐 돌리지 말 것
- 사람 눈: `tests/_shot-*.png`(gitignore) — 특히 `_shot-cardart.png`(1 임무 그림 시트)·`_shot-cardart-m2.png`(2 임무 물건·아이콘·선별장 컷), `_shot-conveyor-*.png`, `_shot-relabel-375.png`, `_shot-run-*.png`
- ⚠️ 함정: 화면 전환 때 버튼 자동 포커스 금지(Space 연타가 브리핑·결과를 건너뜀 — go()가 blur). 달리기 화면은 `touch-action:none`(폰 스크롤·새로고침 제스처). `.screen[hidden]`은 `!important` — ID 셀렉터의 display가 hidden을 덮어써 숨은 화면이 클릭을 가로챘음.
- ⚠️ 2 임무 화면 개수·라벨(`DR.Cards.displayKey`): 이름표가 맞는 카드 = 그 종류, 틀린 카드(가짜·잘못 고친 카드) = **붙은 이름표의 보통 종류**로 센다. 정체를 드러내는 색·글자 금지("고침" 표시는 맞았는지 말하지 않음).
- ⚠️ 컨베이어 원인 규칙: 가짜 원인은 **물건 자기 장면**의 오염만 본다(통과한 장면의 물건은 늘 맞는 함). `danger:S#` 원인 = 그 장면이 위험으로 실패 → 장면마다 건전지 물건이 하나씩 있어 **위험 장면 = 그 장면에서 비상 정지**(리뷰 I1). 원인을 늘릴 때 `conveyor.test.mjs` 무작위 가방 테스트(통과 장면은 모두 맞음·위험⇔비상 정지)가 지켜 준다.

## 남은 일
- **팀 플레이 피드백**(기획서 §11 체크리스트) → `config.js` 수치 조정. 미확인: 실기기 손맛·터치 실기기·저사양 PC 프레임.
- 3·4 임무(설계 초안 승인 대기), 레이스 고스트, 해커 서사. 1 임무 결과를 컨베이어식으로 바꿀지는 2 임무를 해 본 뒤 결정(설계 §2).
- 인물 디자인(다른 팀과 맞추기)·완성 일러스트는 외부 조건.
