# 윤리시티 초등 공통 에셋 팩

버전 1.0.0 · 제작일 2026년 10월 20일

초등 AI 윤리 게임을 제작하는 팀이 같은 캐릭터·배경·말풍선·버튼·아이콘·효과를 재사용할 수 있는 공통 팩입니다. 새봄이의 픽셀 캐릭터를 시각 기준으로 삼아 따뜻한 크림·세이지·목재 색상으로 구성했습니다. 인권보장 게임에 자동 반영된 버전이 아니라, 팀 전체가 도입할 수 있는 에셋과 연결 예제입니다.


## 단일 패키지 원칙

이 배포본은 **실행용 공통 에셋 + 스타일 문서 + 비주얼/완성게임 레퍼런스**를 한 폴더에 모은 팀 배포용 단일 패키지입니다. 팀원에게 별도의 `REF_*` 파일을 추가로 전달할 필요가 없습니다.

레퍼런스는 모두 `references/` 안에 있습니다.

| 파일 | 용도 |
|---|---|
| `references/REF_A_character_sheet.png` | 캐릭터/스프라이트 그림체 기준 |
| `references/REF_B_world_concept.png` | 학교·마을·건물·자연·AI 로봇 세계관 기준 |
| `references/REF_UI_game.html` | UI·학습 피드백·반응형·접근성 구현 참고 |
| `references/REF_EXPLORE_game.html` | 탐험형 맵·HUD·NPC 대화·엔딩·성찰 구조 참고 |

실제 게임 코드에서는 레퍼런스보다 `manifest.json`과 `runtime/` 및 실제 공통 자산을 우선 사용합니다.

## 가장 먼저 확인

팀원은 먼저 `START_HERE.md`를 읽으세요. LLM 프롬프트 가이드는 `docs/TEAM_LLM_PROMPT_GUIDE_v1.3.docx`에 있습니다.

## 먼저 열어 보기

1. ZIP 전체를 압축 해제합니다.
2. `preview/index.html`을 크롬 또는 엣지로 엽니다. ZIP 내부에서 바로 열지 마세요.
3. 장소·캐릭터·방향·표정을 바꿔 보고, 지도에 초점을 준 뒤 방향키 또는 WASD로 이동합니다. 화면의 방향 버튼도 사용할 수 있습니다.
4. 효과음은 `효과음 켜기`를 누른 뒤 재생합니다. 이미지는 인터넷·Firebase 없이 열 수 있습니다.
5. 전체 정지 미리보기는 `preview/overview.png`를 열면 됩니다.

## 구성

| 폴더 | 내용 |
|---|---|
| characters | 8명 각각 원본 아트 시트, 사방 걷기 시트, 표정 시트 |
| backgrounds | 고정 배경 6장, 재사용 소품 16종을 모은 시트와 원본 |
| ui | 공통 창 8종, 아이콘 24종, 한글 글꼴과 글꼴 라이선스 |
| effects | 피드백 애니메이션 5종과 효과음 7종 |
| runtime | 공통 로더·렌더러·스타일·메타데이터 |
| preview | 실행 예제와 전체 미리보기 |
| docs | 시각 규칙, 파일 목록, 제작 프롬프트와 팀 적용 안내 |
| references | 공식 캐릭터·세계관 이미지와 UI/탐험형 완성 게임 레퍼런스 |
| qa | 규격화 스크립트, 검사 결과, 실제 런타임 렌더링 결과 |
| manifest.json | 파일 경로·프레임·기준점·장소 정보를 모은 기준 데이터 |

## 캐릭터

| ID | 이름 | 특징 |
|---|---|---|
| jiho | 지호 | 여학생, 묶은 머리, 남색 후드, 회색 바지, 크로스백 |
| haneul | 하늘 | 남학생, 짧은 검은 머리, 자주색 바람막이, 백팩 |
| saebom | 새봄 | 여학생, 단발, 노란 꽃 머리핀, 초록 가디건, 독서기록장 |
| onyu | 온유 | 남학생, 안경, 청록 조끼, 갈색 바지 |
| daon | 다온 | 여학생, 양 갈래 머리, 보라색 후드, 남색 바지 |
| teacher | 교사 | 안경, 파란 가디건, 수업 자료철 |
| librarian | 사서 | 안경, 올리브 조끼, 붉은 책 |
| robot | 안내 로봇 | 흰색·하늘색 몸체, 청록색 눈과 안테나 |

캐릭터마다 4방향 × 4프레임 = 걷기 16프레임과 기본·기쁨·걱정·설명의 표정 4개가 있습니다. 총 걷기 128프레임, 표정 32프레임입니다. 원본 아트의 가변 간격은 프레임 추출·정렬 과정에서 보정했습니다. 지호의 왼쪽 방향 중 원본이 반대쪽을 향한 프레임은 규격화 시 좌우 반전했습니다.

- `ID-walk.png`: 384 × 512 PNG, 4열 × 4행, 셀 96 × 128
- 행 순서: 앞 `down` → 왼쪽 `left` → 오른쪽 `right` → 뒤 `up`
- 발 기준점: 각 셀의 (48, 120), 기본 걷기 속도 6fps
- `ID-portraits.png`: 1024 × 256 PNG, 4열, 셀 256 × 256
- 표정 순서: `neutral` → `happy` → `worried` → `explaining`
- 원본은 `ID-source.png`이며 실제 게임에서는 규격화한 walk·portraits 파일을 사용합니다.

## 장소와 소품

학교 중앙마당, 교실, 도서관, 급식실, 보건실, AI 실습실 배경 6장입니다. 논리 화면 1280 × 720에 맞춰 표시하며 원본 PNG 크기는 manifest에 기록했습니다. 배경에 그려진 가구는 고정입니다. 별도의 `props.png`에 책상·의자·책장·칠판·컴퓨터 책상·독서기록장·책 더미·게시판·나무·관목·벤치·화분·대출 데스크·급식 식판·보건실 침대·로봇 충전대를 담았습니다.

미리보기의 이동 영역은 중앙 통로를 확인하기 위한 예시입니다. 실제 게임에서는 배경을 선택한 뒤 출입구와 NPC 위치, 가구의 충돌 영역, 가구 앞·뒤 표시 순서를 장면에 맞게 정해 주세요. 이 팩은 반복 타일맵이나 완성된 방 이동 엔진을 포함하지 않습니다.

## 공통 UI와 효과

공통 창은 `panel`, `speech`, `primary`, `hover`, `pressed`, `disabled`, `notice`, `success` 8종입니다. 64 × 64 PNG의 가장자리 12px을 보존하는 나인슬라이스 방식이며, 말풍선 꼬리는 CSS로 붙입니다. 텍스트는 이미지에 넣지 않고 실제 글자로 표시합니다.

아이콘 24종: home, inspect, notebook, key, lock, check, retry, close, pause, play, music, volume, person, robot, clue, help, exit, warning, heart, timer, map, settings, arrow_left, arrow_right.

효과는 단서 발견 `clue`, 정답 `correct`, 재확인 `retry`, 열쇠 `key`, 문 열기 `unlock`입니다. 각각 64 × 64의 8프레임, 10fps, 0.8초 동안 한 번 표시합니다. 동작 줄이기 설정에서는 정지 프레임으로 표시할 수 있습니다. 효과음은 collect, miss, tap, door, win, paper, retry의 WAV 7종이며, 별도로 제작한 합성음입니다.

## 게임에서 불러오기

팩 폴더 구조를 유지한 채 팀 저장소의 공통 assets 경로에 넣습니다. HTML에서 아래 순서대로 불러오세요. 아래 예시는 게임 HTML과 `assets/`가 같은 위치에 있을 때입니다.

```html
<link rel="stylesheet" href="assets/ethicity-common/runtime/common.css">
<script src="assets/ethicity-common/runtime/manifest.js"></script>
<script src="assets/ethicity-common/runtime/common.js"></script>
<script>
(async () => {
  const assets = await EthicityAssets.load(
    ETHICITY_COMMON_MANIFEST,
    '../shared/ethicity-elementary-common-v1'
  );
  const ctx = document.querySelector('canvas').getContext('2d');
  assets.drawBackground(ctx, 'classroom', 1280, 720);
  assets.drawCharacter(ctx, 'saebom', 720, 490, 'down', 1, 0.85);
})();
</script>
```

`runtime/common.js`는 브라우저 전역 `EthicityAssets`를 제공합니다. 프레임 번호는 0~3이며 서 있는 모습은 1번을 권장합니다. 대화창 CSS는 `ee-theme`, `ee-panel`, `ee-speech`, `ee-button` 등을 사용합니다. 동작 예제는 `preview/preview.js`에 있습니다.

## 검사와 적용 범위

프레임 수·셀 크기·이미지 경로·투명 영역·걷기 변화·표정·장면별 시작점·효과 종료·WAV 형식과 공통 렌더러 출력을 검사했습니다. 자세한 내용은 `qa/verification.json`에 있습니다. 실제 브라우저·터치 기기·스피커에서는 별도 확인이 필요합니다. 기존 팀 저장소나 Firebase 설정은 변경하지 않았습니다.

이미지 원본은 이미지 생성 도구로 제작했고, 코드로 프레임을 추출·정렬하여 시트로 패킹했습니다. UI 아이콘·창·피드백 효과는 좌표 기반 픽셀 코드로 제작했습니다. 글꼴은 동봉한 라이선스를 따릅니다.

## 개발용 재생성

미리보기를 여는 데 Node나 npm 설치는 필요하지 않습니다. 개발자가 규격화 시트나 검사를 다시 실행하려면 `package.json`의 개발 의존성을 설치한 뒤 `npm run verify`를 사용합니다. 원본 아트의 큰 형태나 포즈를 바꿀 때는 원본 이미지부터 수정하고 프레임 추출 결과를 다시 확인해야 합니다. `docs/generation-prompts.json`에 이미지 생성에 사용한 프롬프트를 보관했습니다.
