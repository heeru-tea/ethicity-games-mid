# 책임성 · 버섯도감 AI의 네 사람

「윤리시티 · AI 윤리 탐험대」 시리즈의 책임성(중·고등) 게임입니다. 학생이 버섯 판별 앱을 둘러싼 네 역할(데이터 수집자 → 개발자 → 배포자 → 사용자)을 차례로 맡아 선택하고, 책임 연결선 맵과 실제 사례로 책임을 함께 생각합니다.

- gameId: `accountability`
- 게임 유형: 일반 미니게임(장면형, 맵 이동 없음)
- 대상: 중·고등 (고1 통합과학2), 약 18분, 1인 1기기, 태블릿 터치 기준
- 개인정보: 게임은 닉네임만 사용. 학번·이름은 마지막 탐구 기록 PDF를 만들 때만 입력받아 PDF 파일에만 쓰고, 저장·전송하지 않음 (연대성 게임과 같은 방식)
- 네트워크: 오프라인 동작 (실제 사례 원문 링크만 인터넷 필요)

## 파일

```
accountability/
├── index.html      실행 진입점
├── game.css        게임 전용 스타일 (.game-accountability 아래에만 적용)
├── game.js         게임 로직 (IIFE)
├── README.md
└── docs/
    ├── scenario.md     시나리오
    ├── scenario.docx   시나리오 (편집용)
    └── media/game-flow.png
```

게임 전용 이미지 파일은 없습니다. 버섯 그림은 코드(SVG)로 그립니다.

## 공통 팩 연결

- COMMON_BASE: `../shared/ethicity-elementary-common-v1`
- 저장소 구조: repo 루트에 `/shared/ethicity-elementary-common-v1/`과 `/accountability/`가 형제 폴더로 있어야 합니다.
- 불러오는 순서: `runtime/common.css` → `game.css` → `runtime/manifest.js` → `runtime/common.js` → `game.js`
- `EthicityAssets.load`로 자산을 읽고 `drawBackground`, `drawCharacter`, `drawPortrait`, `drawIcon`, `drawEffect`, `setSound`, `playSound`를 사용합니다.
- 공통 팩 파일은 수정하지 않았습니다.

### 사용한 공통 asset ID

| 종류 | ID |
|---|---|
| character | robot(안내), saebom(데이터 수집자), onyu(개발자), jiho(배포자), haneul(사용자), daon(친구), teacher(선생님) |
| expression | neutral, happy, worried, explaining |
| background | ai_lab, library, classroom, courtyard, nurse |
| icon | volume, settings, warning, lock |
| effect | clue, unlock, correct |
| sound | tap, collect, paper, door, miss, win |
| UI | .ee-theme, .ee-panel, .ee-speech, .ee-speaker, .ee-button(.secondary), .ee-choice, .ee-badge, .ee-notice, .ee-success, .ee-icon |

## 통합 이벤트 (postMessage)

```js
{ type: 'ethicity:ready', gameId: 'accountability' }
{ type: 'ethicity:progress', gameId: 'accountability', current: 1~9, total: 9 }
{ type: 'ethicity:complete', gameId: 'accountability', result: { completed: true } }
```

result에는 닉네임이나 학생이 쓴 글을 넣지 않습니다.

## 저장 (localStorage)

- `ethicity.accountability.settings`: 효과음, 움직임 줄이기
- `ethicity.accountability.reflection.<닉네임>`: 생각 정리 답 (같은 기기에서 창을 닫았다 열어도 이어 쓰기용)
- `ethicity.accountability.progress`: 진행 중인 탐험(장면 2~8). 창을 닫았다 열면 제목 화면에 [이어서 하기]가 나타남. 새로 시작·다시 하기·완료 시 삭제
- 완료 화면의 [이 기기에서 내 기록 지우기]를 누르면 생각 정리 답과 진행 기록을 모두 지웁니다. 기기를 함께 쓰는 반에서는 PDF 저장 뒤 누르도록 안내해 주세요.

## 탐구 기록 PDF

생각 카드 아래 [PDF로 저장]을 누르면 A4 보고서가 내려받아집니다. 연대성 게임과 같은 방식(캔버스로 A4 페이지를 그려 JPEG로 담은 PDF, 외부 라이브러리 없음)이며 파일명은 `책임성_학번_이름_버섯도감AI.pdf`입니다.

내용: 우리의 선택(엔딩) · 네 자리에서 내린 선택 · 책임 나누기(내 비율과 게임 기록) · 실제 사례 · 생각 정리 4문항 · 기억할 한 문장

## 화면 흐름

START(제목·닉네임) → INTRO(안내 로봇, 오늘의 순서) → GAME(장면 2~5) → RESULT(책임 연결선 맵, 엔딩 E1~E5) → 사례 탐구·생각 카드 → COMPLETE(우리가 발견한 것 / 기억할 한 문장 / 다음 탐험)

## 데이터 예산(장면 2)

예산 100코인으로 세 묶음을 다 살 수 없게 해서 선택에 대가가 따르게 했습니다.

| 묶음 | 가격 | 장수 | 효과 |
|---|---|---|---|
| 해외 공개 데이터 | 40 | 50,000 | 전체 정확도↑, 국내 독버섯은 거의 없음 |
| 국내 수목원 표본 | 70 | 3,000 | 독버섯 인식률↑, S +2 |
| 동호회 회원 사진 | 20 | 10,000 | 싸고 많지만 이름표 틀림 섞임. 검수 못하면 S −1, 인식률 −6 |

해외+국내(110)는 살 수 없으므로 "많은 사진(전체 정확도)"과 "국내 독버섯 사진(인식률)" 중 하나를 고르게 됩니다. 개발자 장면의 시험 결과(전체 정확도 / 독버섯 인식률)는 이 조합으로 정해집니다.

| 조합 | 전체 정확도 | 독버섯 인식률 (검수 못함) |
|---|---|---|
| 해외 | 92 | 71 |
| 해외+동호회 | 93 | 71 (65) |
| 국내 | 84 | 88 |
| 국내+동호회 | 88 | 88 (82) |
| 동호회만 | 79 | 60 (54) |

## 사용자 장면(장면 5)

통합과학 교내 생물 다양성 조사 중, 비 온 다음 날 학교 화단에서 버섯을 발견하는 설정입니다. 다섯 단계로 나뉩니다.

1. 촬영: 갓 윗면·주름·밑동 중 찍을 부분을 고릅니다(최대 3장). 친구 다온이 "한 장이면 충분하잖아"라고 재촉합니다. 세 부분을 모두 찍으면 S +1.
2. 결과 확인: "식용 가능"이 나오면 사진 장수에 따라 확신도가 87% / 74% / 66%로 표시됩니다.
3. 단톡방: 결과만 올리기 / 주의 문구와 함께 올리기 / 올리지 않기.
4. 결정: 먹는다 / 선생님께 확인 / 두고 간다. 앱이 "식용 가능"일 때 확인을 고르면 다온이 한 번 더 재촉합니다.
5. 오류 신고: 앱이 "식용 가능"이라고 한 경우에만 나옵니다. 신고하면 책임 연결선 맵에 "사용자 → 개발자 오류 신고" 선이 생기고, 엔딩과 PDF에 그 결과가 적힙니다.

사용자 기록에 남는 위험 쪽 선택: 사진 3장 미만, 결과만 단톡 공유(이 두 가지는 앱이 "식용 가능"이라고 한 경우에만), 확인 없이 먹기, 오류를 알고도 신고하지 않기.

## 확인한 것

- 다섯 엔딩(E1~E5) 모두 끝까지 진행
- 1180 / 1024 / 760 / 430px에서 가로 스크롤 없음
- 태블릿 가로 화면(1024×768, 1180×820, 1280×800)에서 대화·역할 장면이 모두 한 화면에 들어감. 개발자(4단계)·배포자(3단계)·데이터 수집자(2단계)는 한 화면에 한 질문씩 나뉘어 있음. 세로 화면에서는 이름표 검수·배포자 장면만 조금 스크롤됨. 책임 연결선 맵·사례 탐구·생각 정리처럼 읽고 쓰는 화면은 위아래로 넘겨 봄
- 콘솔 오류·404 없음, ready/progress/complete 이벤트 정상
- 키보드: 모든 선택지는 실제 버튼, 카드 끌기는 누르기로 대체, 카메라 틀은 방향키로 이동
- 움직임 줄이기: 기기 설정(prefers-reduced-motion)과 게임 안 버튼 모두 지원

## 움직임 효과

- 장면 배경: 캐릭터가 공통 걷기 시트(6fps)로 걸어 들어오고, 안내 로봇은 천천히 떠 있음
- 대화: 대사가 한 글자씩 나오고 말하는 동안 얼굴이 살짝 움직임. 버튼을 한 번 누르면 바로 전체 표시
- 화면: 패널 등장(0.3초), 선택 시 톡 튀는 반응, 정확도 막대 채우기, 책임 맵 기록선 그리기, 엔딩 도장, 촬영 플래시, 버섯 살랑임
- 움직임 줄이기를 켜면 모두 정지 화면으로 바뀜
- 효과음은 기본 꺼짐, 버튼을 눌러야 켜짐. BGM 없음

## 알려진 제한

- 공통 팩 ZIP에 `references/`(REF_UI_game.html 등)가 없어 공통 런타임·STYLE_GUIDE 기준으로 맞췄습니다.
- 라벨 검수 장면의 버섯 특징은 게임용으로 단순화했습니다. 수업 전 공식 자료로 검수해 주세요.
- 사례 기사 링크는 2026년 10월 기준으로 확인했습니다.
