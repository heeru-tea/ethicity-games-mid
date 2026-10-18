# 야외 오브젝트 교체 — 2026-10-18

새로 생성한 투명 PNG 4종. 집 외관 및 새 잔디·흙길과 함께 사용한다.

| 파일 | 연결 | 표시 크기(48px 타일 기준) |
|---|---|---|
| tree.png | 기존 모든 T 나무 | 약 1.64×2.25칸, 좌표별 약간의 크기 변화 |
| lamp.png | lamp 가로등 | 0.66×2.3칸 |
| bench.png | bench 벤치 | 2×1.15칸 |
| pond.png | 마을 물 영역 (27,19)~(30,20) | 4.2×2.2칸, 돌 둑 포함 |

사용자가 화면의 테이블로 지칭한 야외 가구는 world.js의 bench였다. 이번에는 해당 벤치를 교체했다. 실내 책상·매점·천막은 변경하지 않았다.

## 연결

- index.html → js/outdoor.js → js/map.js.
- outdoor.js는 로드 시 알파 영역을 측정해 투명 여백을 제외하고 그린다. PNG 원본은 변경하지 않는다.
- 새 소재에는 palette.js 색상 보정을 중복 적용하지 않는다.
- 실패 시 기존 atlas 소재를 사용한다. file:// 보안으로 알파 측정이 막히면 전체 이미지 사용. HTTP 권장.
- 연못은 기존 물 칸을 잔디로 먼저 덮고 연못 전체 이미지를 한 번 그린다. 현재 고정 맵 전용 좌표이므로 물 영역 이동 시 map.js의 연못 좌표도 변경해야 한다.
- world.js, 문 좌표, 충돌 영역 및 스토리는 변경하지 않았다. 나무의 기존 밀집 배치는 유지한다.

## 검증

격리된 Playwright Edge에서 1200×900, 390×844 실제 화면 확인. 집 앞 저장 위치에서 이어 하기 및 연못 주변 새로고침 확인. 해당 경로 pageerror 0, 새 자산 4종 로딩 완료 확인. JS 구문 및 git diff --check 통과. 전체 엔딩 회귀 검증은 수행하지 않았다.

재현 스크립트: tests/terrain-browser-check.cjs. Playwright 설치 위치는 PLAYWRIGHT_PATH로 지정 가능. tests/_shot-outdoor.png, _shot-terrain.png, _shot-terrain-mobile.png는 로컬 확인 캡처다.

로컬 파일만 변경했다. 원격 push/배포는 하지 않았다. 새로고침 후 확인하며 캐시가 남으면 Ctrl+F5.

## 2026-10-18 장식 동물
- rabbit.png / squirrel.png: 투명 배경 단일 정지 포즈. 풀잎 먹는 토끼와 도토리를 든 다람쥐.
- outdoor.js collectDecorations → map.js 깊이 정렬 목록에 연결. 토끼 (39,14)·다람쥐 (46,14) — 우리 집 양옆 잔디에 배치(2026-10-18 사용자 요청으로 옮김). 알파 경계 기준 최대 0.68칸, 종횡비 보존.
- world 객체/충돌/트리거/저장 데이터에 등록하지 않는 순수 장식. 애니메이션·소리·상호작용 없음.
- 로컬 실제 맵 PC/모바일 캡처 및 pageerror 0 확인(terrain-browser-check.cjs). 미배포.
