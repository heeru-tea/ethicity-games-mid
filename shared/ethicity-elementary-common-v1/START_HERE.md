# START HERE — 팀원은 이 폴더 하나만 사용하세요

이 폴더 `ethicity-elementary-common-v1` 하나가 윤리시티 팀의 공통 패키지입니다.

별도의 REF 파일을 밖에서 찾을 필요가 없습니다.

## 1) LLM 작업 가이드
- `docs/TEAM_LLM_PROMPT_GUIDE_v1.3.docx`

## 2) 실제 게임에서 사용하는 공통 자산
- `manifest.json`
- `runtime/`
- `characters/`
- `backgrounds/`
- `ui/`
- `effects/`

## 3) LLM이 참고할 공식 레퍼런스
- `references/REF_A_character_sheet.png`
- `references/REF_B_world_concept.png`
- `references/REF_UI_game.html`
- `references/REF_EXPLORE_game.html`

## 핵심 원칙
1. `manifest.json`에 이미 있는 자산은 새로 그리지 않습니다.
2. 실제 구현은 `runtime/`과 공통 자산을 우선합니다.
3. `references/`는 공통 팩에 없는 새 장소·사건 CG·소품 등이 필요할 때 스타일 참고용으로 사용합니다.
4. 팀원은 이 공통 폴더를 임의 수정하지 않고 자기 게임 폴더에서 작업합니다.
