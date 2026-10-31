# Publicness 지도 중심 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 예측의 신뢰성을 회복하고 계획 화면을 지도 중심으로 단순화하면서, 출발 전 판단과 운행 결과를 비교하는 교육 구조를 유지한다.

**Architecture:** 기존 PB 전역 네임스페이스, 순수 시뮬레이션 엔진, SVG/Three.js 지도 인터페이스를 유지한다. 공통 주민 판정을 정리한 뒤 계획·결과·성찰 화면을 분리한다. 긴급 조정은 별도 후속 작업으로 구현하며 이미 운행한 기록을 보존한다.

**Tech Stack:** 정적 HTML/CSS/JavaScript, Three.js UMD, Node test, 기존 Playwright/Edge 브라우저 테스트.

**Spec:** 2026-10-26 사용자 메시지의 Aside 테스트 보고와 Mini Metro 방향 제안. 아래 설계 선택은 검토용 권장안이며 구현 승인으로 간주하지 않는다.

## Global Constraints

- 작업 대상: `D:\Works\ethicity-games-mid-publicness\publicness`. `D:\Works\publicness`에는 PRD만 존재한다.
- 계획 작성만 수행한다. 제품 코드 변경·배포·사용자 저장 데이터 초기화는 하지 않는다.
- 기존 지도 클릭·드래그 노선 편집, 되돌리기, 기본 5단계와 도전 8단계의 특수 버스 제한을 보존한다.
- `file://` 실행, SVG 대체 지도, 375px 폭, 키보드 접근성, reduced-motion을 지원한다.
- 페이퍼+딥블루 기반을 유지한다. 노선 범주색에는 번호·선무늬를 병기한다.
- 사용자의 현재 3단계 저장 진행은 테스트에 쓰지 않는다. 별도 브라우저 컨텍스트와 고정 fixture로 검증한다.
- 예측은 공개된 기본 수요, 실제 결과는 사건 수요 포함이라는 차이를 유지한다. 같은 입력에 대한 판정만 반드시 같아야 한다.

## 확인된 사항과 미확인 사항

- 코드 확인: `ui-plan.js`의 `peopleCount()`와 `people()`는 `dayStatus`로 집계·표시한다. `session.js`의 `residentRecords()`는 별도로 `residentVerdict()`를 호출하여 `satisfied`와 `reasons`를 추가한다. 왕복 완료와 기준 충족이 혼용되어 있다.
- 코드 확인: `advisor.js`의 후보 평가는 `Metrics.summarize()`를 직접 사용한다. 공통 판정 연결 지점이 필요하다.
- 코드 확인: 운행은 하루를 미리 계산하고 재생하는 구조다. 긴급 조정에는 재생 UI 외에 엔진·저장 변경이 필요하다.
- 미확인: 보고된 나래의 정확한 4시간 48분 상태, 드롭다운 지연, 808px 넘침, 경기장 이탈은 이번 작업에서 브라우저 재현하지 않았다. 원인 확정 전 재현한다.

## Review Focus

- 저장 복원 중 새 전환 화면 때문에 단계·정산이 중복되지 않아야 한다 → 작업 5.
- 검색 중 노선을 수정하면 이전 AI 응답이 새 계획에 적용되지 않아야 한다 → 작업 4.
- SVG·터치·키보드에서도 버스 배정과 취소가 가능해야 한다 → 작업 3.
- 도전 모드 직행·광역 버스 제약을 드래그로 우회할 수 없어야 한다 → 작업 3·6.
- 운행 건너뛰기가 긴급 조정 판단 기회를 무단으로 지나치지 않아야 한다 → 작업 6.

## 권장 화면 흐름

`계획 → 출발 확인 → 운행 → 결과 → 생각하기 → 달라진 점 → 다음 계획`

마지막 라운드는 결과 뒤 기존 학기 결말·최종 성찰로 이어진다. 첫 라운드는 이전 결과 없이 짧은 상황 소개와 지도 조작으로 진입한다. 긴급 조정은 후속 작업에서 운행 중에 삽입한다.

계획 화면은 지도와 하단 툴바를 기본으로 한다. 툴바에는 노선 칩, 버스 토큰, 되돌리기, AI 제안, 출발을 둔다. 텍스트 보기는 기본 접힘이며 노선·버스·인물·수요의 동등한 조작과 정확한 수치를 제공한다. 출발 위험 경고는 접힌 패널에만 숨기지 않는다.

## 작업 1: 주민 판정과 예측 계약 통일 — 최우선

**Files:** 수정 `publicness/js/session.js`, `advisor.js`, `ui-plan.js`, 필요 시 `metrics.js`; 추가 `publicness/js/resident-evaluation.js`, `publicness/tests/prediction-consistency.test.mjs`; 스크립트 등록 `index.html` 및 Node fixture 로더.

**Interfaces:** `PB.ResidentEvaluation.records(config, phase, result)` → 기존 주민 레코드 형태(`dayStatus`, `satisfied`, `reasons` 포함). `PB.ResidentEvaluation.count(records)` → `{ completed, satisfied, total }`. 기존 `Session.residentVerdict` 공개 API는 호환 래퍼로 유지한다.

- [ ] 왕복 완료지만 대기 기준을 초과하는 fixture를 만든다. 왕복 완료 인원은 유지되고 기준 충족 인원은 줄어드는 실패 테스트를 작성한다. 기준 이하·경계값·초과도 검사한다.
- [ ] `residentRecords`/`residentVerdict`의 순수 판정을 공통 모듈로 옮기고 실제 결과, 기본 수요 예상, AI 후보 평가 모두 연결한다.
- [ ] AI 비교와 사이드바를 ‘주요 인물 기준 충족 n/m명’으로 바꾼다. 왕복했지만 대기가 긴 주민은 그 이유를 명시한다.
- [ ] 빠른 이동·형평 등 AI 목표함수의 의미는 유지한다. 판정 통일을 이유로 모든 목표를 만족 인원 최대화로 바꾸지 않는다. 목표가 개선되어도 나래가 불리해지면 숨기지 않고 표시한다.
- [ ] 동일 초안의 AI 적용 미리보기·적용 후 예상·출발 확인에서 `satisfied`와 사유가 일치하는지 검사한다. 돌발 수요 없는 실행과도 일치해야 한다.
- [ ] `node --test publicness/tests/prediction-consistency.test.mjs` 및 기존 advisor/resident-result 테스트 통과를 확인한다.

## 작업 2: 보고된 UI 버그 세 가지 재현·수정

**Files:** `publicness/js/ui-plan.js`, `app.js`, `view3d.js`, `css/style.css`; 추가 `publicness/tests/aside-regressions-browser.mjs`.

- [ ] ‘맨 앞 → 병원 다음 → 외곽 다음 → 산업 다음’ 순서를 실제 select 조작으로 재현한다. 매번 표시값·편집 상태·실제 정류장 삽입 위치를 대조한다.
- [ ] `P.anchor`, 전체 재렌더, `App.keepFocus` 복원 경로를 조사한다. 표시값은 상태에서 결정하고 포커스 복원이 이전 값으로 덮어쓰지 않도록 수정한다. 원인 확인 전 임의 지연을 넣지 않는다.
- [ ] 결과 화면의 `scrollWidth > clientWidth`인 요소를 찾아 목록·표·grid/flex 최소폭을 수정한다. 긴 문장은 줄바꿈하고 표만 자체 스크롤을 허용한다. 패널 전체를 잘라 문제를 감추지 않는다.
- [ ] 경기장 모델의 로컬 원점·크기·`zoneOffset()`·정류장 좌표 변환을 점검한다. 정류장을 기준으로 제한된 오프셋에 배치하고 노선·다른 장소를 침범하지 않게 한다.
- [ ] 375/768/1366px 및 기본/여러 고정 랜덤 시드에서 검사한다. 경기장은 수치 프로브와 3D 스크린샷으로 확인한다.
- [ ] `node publicness/tests/aside-regressions-browser.mjs` 통과. 드롭다운과 버스 콤보박스의 연속 조작도 회귀 검사한다.

## 작업 3: 지도와 하단 툴바 중심 계획 화면

**Files:** `index.html`, `css/style.css`, `js/ui-plan.js`, `map2d.js`, `view3d.js`, `route-pointer.js`; 추가 `tests/map-first-browser.mjs` (이 절의 경로는 `publicness/` 기준).

**Interfaces:** 모든 배정은 기존 `Session.canAssign()`/`Session.assign()`을 사용한다. 지도는 노선 선택과 버스 드롭 대상 노선 번호를 UI에 전달하며 직접 초안을 변경하지 않는다.

- [ ] 기존 클릭·연장·중간 삽입·교체·순환·되돌리기를 회귀 기준으로 기록한다.
- [ ] 사이드바 기본 접힘과 툴바를 구현한다. 노선 칩은 번호·색·선무늬·선택 상태를 표시한다.
- [ ] 버스 토큰을 노선으로 드래그해 배정한다. 터치·키보드는 ‘토큰 선택 → 노선 선택’으로 동등하게 배정한다. 취소·쉬기·배정된 노선 확인을 제공한다. 기본 화면의 콤보박스와 개별 배정 버튼은 제거한다.
- [ ] 주요 인물 얼굴을 집 정류장에 배치한다. 클릭/Enter 시 목적지 점선을 보여 주고 Esc로 닫는다. 같은 정류장의 인물은 겹치지 않게 펼친다.
- [ ] 수요는 정류장 주변 사람 표시의 3단계 밀도로 표현한다(권장안). 정류장 클릭 영역은 고정해 수요가 적어도 누르기 쉽게 한다. 정확한 수치는 선택 시와 텍스트 보기에서 제공한다.
- [ ] 지도 편집과 버스 드래그의 입력 충돌, 모바일 툴바 넘침, 특수 버스 제한, SVG 대체 동작을 검사한다.
- [ ] `node publicness/tests/map-first-browser.mjs` 및 기존 route-pointer/route-edit 테스트 통과.

## 작업 4: AI 진입점 하나와 지도 위 미리보기

**Files:** `publicness/js/ui-plan.js`, `map2d.js`, `view3d.js`, 필요 시 `advisor.js`; 추가 `publicness/tests/ai-overlay-browser.mjs`.

- [ ] 기본 화면의 AI 진입점을 ‘AI 제안’ 하나로 통합한다. 기존 목표 선택은 버튼을 누른 뒤 펼쳐지는 영역에 둔다. 목표를 하나로 몰래 고정하지 않는다.
- [ ] 현재 노선은 유지하고 제안 노선만 점선으로 겹친다. 변경 없는 구간은 과도하게 강조하지 않는다. 미리보기 자체는 초안·저장·되돌리기 이력을 바꾸지 않는다.
- [ ] 비교는 ‘도착률’, ‘주요 인물 기준 충족’, ‘가장 긴 대기’의 최대 세 줄로 제한한다. ‘적용/돌아가기’와 예측의 수요 범위를 표시한다.
- [ ] AI 검색 중 편집·라운드 이동 시 응답을 폐기한다. 적용 시 작업 1의 동일 판정으로 다시 확인하며 되돌리기를 지원한다.
- [ ] `node publicness/tests/ai-overlay-browser.mjs`로 미리보기 취소, 적용, 되돌리기, 늦은 응답을 검사한다.

## 작업 5: 결과·생각하기·달라진 점 분리

**Files:** `publicness/js/ui-result.js`, `app.js`, `session.js`, `stories.js`, `storage.js`, `cutscene.js`, `css/style.css`; 필요 시 추가 `publicness/js/ui-transition.js`; 추가 `publicness/tests/round-transition-browser.mjs`.

- [ ] 결과를 전체 화면으로 전환한다. 인물별 ‘만족/불만족 + 실제 기록 기반 한 줄 이유’를 순서대로 공개한다. reduced-motion과 ‘한 번에 보기’를 제공한다.
- [ ] 주요 지표는 ‘도착률’과 ‘가장 오래 기다린 사람’ 두 개로 제한한다. 최대 대기는 미도착자도 포함하며 운행 종료 시까지의 관측값임을 명시한다. 나머지 통계·재정은 상세 보기로 보존한다.
- [ ] 다음 단계의 기존 윤리 사례·질문을 생각하기 화면으로 옮긴다. 짧은 답변을 단계별 저장하되 평가 점수로 환산하지 않는다. 권장안은 입력 강제 없이 ‘나중에 생각하기’를 허용하는 것이다.
- [ ] 달라진 점은 실제 단계 차이를 계산하여 신규 정류장 등장과 실제 추가 버스 수만 표시한다. 매번 임의로 +1을 보여 주지 않는다. 기존 등장 애니메이션과 중복 실행하지 않는다.
- [ ] 전환 위치·답변을 저장하되 구형 저장은 기본값으로 복원한다. `SCENARIO_VERSION` 변경으로 저장을 지우지 않고 별도 저장 스키마 마이그레이션을 검토한다.
- [ ] 기본 5단계·도전 8단계, 재정 조기 종료, 마지막 라운드, 화면별 새로고침의 중복 정산 방지를 검사한다.
- [ ] `node publicness/tests/round-transition-browser.mjs` 및 기존 progression/session/finance 테스트 통과.

## 작업 6: 제한적 긴급 조정 — 별도 후속 구현

**설계 권장안:** 하루 최대 2회, 10:00/15:00에 멈춘다. 초반 학습 부담을 줄이기 위해 3단계부터 제공한다. 첫 버전은 버스 1대 재배정 또는 변경 없이 계속만 허용한다. 정류장 추가·삭제는 후속 확장으로 남긴다.

**Files:** `publicness/js/sim.js`, `session.js`, `schedule.js`, `ui-run.js`, `config.js`, `storage.js`; 추가 `publicness/tests/emergency.test.mjs`, `publicness/tests/emergency-browser.mjs`.

- [ ] 먼저 엔진 상태의 중간 저장·재개 가능성을 조사한다. 승객 대기·탑승·귀가 생성, 차량 위치, 정산 로그, 사건 처리 상태를 열거하고 재개 계약을 정의한다.
- [ ] 무조정 재개 결과가 기존 하루 일괄 실행과 같은지 검사한다. 변경 시점 이전의 로그·승객 상태는 변하면 안 된다.
- [ ] 혼잡 상황 카드는 해당 시각까지 관측된 사실로만 생성한다. 버스 재배정은 현재 탑승 승객을 내려주고 기존 노선 종점에 도착한 뒤 새 노선으로 이동하는 방식으로 설계한다. 이동 시간과 비용을 계산하고 순간이동을 금지한다.
- [ ] 첫 버전의 조정 비용은 남은 조정권 1회 차감으로 명시한다. 숨은 신뢰 감점은 넣지 않는다. 금전 비용은 실제 이동·운영 비용과 중복되지 않도록 한다.
- [ ] 출발 전 예상, 무조정 기준 실행, 실제 조정 실행, 변경 이력을 분리 저장한다. 결과 상세에서 조정으로 달라진 부분을 비교한다. AI에는 미래의 비공개 사건을 제공하지 않는다.
- [ ] 화면 재생만 약 20초로 줄인다(판단 시간 제외). 엔진 시계·대기 임계값·수요 발생 시각은 유지한다.
- [ ] ‘끝까지 건너뛰기’도 미결정 조정 시점에서는 멈춘다. ‘남은 조정 없이 끝내기’를 명시적으로 선택한 경우에만 결과로 직행한다.
- [ ] 중간 저장 복원, 조정 횟수 제한, 실제 운행 결과의 결정성, 직행·광역 제약, 속도 변경 및 건너뛰기 동등성을 검사한다.
- [ ] `node --test publicness/tests/emergency.test.mjs`와 `node publicness/tests/emergency-browser.mjs` 통과 후 통합한다.

## 검증·전달

- 작업 1~2는 신뢰성 수정 묶음, 작업 3~5는 지도 중심 개편 묶음, 작업 6은 후속 실험으로 나눈다. 작업 6 때문에 앞선 수정 배포가 지연되지 않게 한다.
- 각 묶음에서 `node --test "publicness/tests/*.test.mjs"`와 해당 브라우저 테스트를 실행한다. UI 개편으로 기존 선택자가 바뀌면 동등한 사용자 행동을 검증하도록 테스트를 갱신한다.
- 실제 포인터 조작·키보드·375px/태블릿/데스크톱·SVG/3D를 검증한다. 헤드리스 narrow viewport는 브라우저 viewport 또는 iframe을 사용한다.
- 최종 보고에 코드/단위 테스트 확인, 브라우저 프로브 확인, 시각 확인, 학생 플레이 미확인을 구분한다. 저장 데이터와 배포는 별도 요청 범위를 따른다.
