# 윤리시티 내부 레퍼런스

이 폴더는 팀원이 별도의 REF 파일을 찾아다니지 않도록 공통 에셋 팩 안에 레퍼런스를 함께 넣은 위치입니다.

- `REF_A_character_sheet.png` — 공식 캐릭터/스프라이트 비주얼 참고
- `REF_B_world_concept.png` — 공식 세계관·마을·학교·AI 로봇 콘셉트 보드
- `REF_UI_game.html` — 완성된 윤리시티 UI/학습 게임 구현 참고
- `REF_EXPLORE_game.html` — 탐험형 게임의 화면 구조·맵/HUD/NPC 대화·엔딩/성찰 구조 참고

## 사용 원칙

1. 이미 `characters/`, `backgrounds/`, `ui/`, `effects/`에 존재하는 자산은 레퍼런스를 보고 다시 생성하지 않습니다.
2. 레퍼런스는 공통 팩에 없는 새 장소·새 사건 CG·새 소품 등이 정말 필요할 때만 스타일 기준으로 사용합니다.
3. 실제 런타임 구현 기준은 `manifest.json`, `runtime/common.css`, `runtime/common.js`가 우선입니다.
4. 팀원에게 별도의 외부 REF 파일을 전달할 필요가 없습니다. 이 폴더 안의 파일을 사용하면 됩니다.
