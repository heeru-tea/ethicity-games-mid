# 계획 — 달리기 무대 2차: 2·4 임무 실내 무대 (2026-11-09)

설계: `docs/specs/2026-11-08-run-indoor-stages-design.md`(전부 — 색감 = 실제 장소 색, 바닥은 카드보다 어둡게, 반목표, 그림 안 글자 금지). 1차 구조(`run-world.js`·`bridge-look.js`)를 넓혀 쓴다. 4 임무는 4레인 폭(앞 작업).

## Task 1 — 그림 webp
- `assets/title/int-sorting.png`·`int-grading.png`·`int-teachers-office.png`(2560×1080, 창 유리 알파 0) → 같은 이름 `.webp`(sharp, 알파 유지, 각 ≤ 약 400KB). 원본 PNG는 커밋 안 함. 단위 테스트: 파일 셋 있음·크기 상한.

## Task 2 — 겉모습 데이터(순수, `bridge-look.js`)
- 먼저 테스트(`bridge-look.test`): 실내 팔레트 셋(선별장·채점 센터·교무실) — 바닥 대 흰 카드 ≥ 4.5, 분홍 벽(섞인 색, 칸마다 ≥ 2·평균 ≥ 2.5), 바닥이 카드보다 어둡고 보라 아님(색상각이 보라 범위 밖), 분류함 색은 카드 색과 같은 hex를 지키되 어둡게(밝기 비율) · 구역 모습: m2 S1~S4(구역마다 분류함 색 신호·같은 선별장 그림·밝은 오후), m4 S1~S3 채점 센터(늦은 오후) + S4 교무실(노을, 더 따뜻하고 어둡게) · 창밖 = 낮 도시 그림 + 시간대 색조 · 연습·1·3 임무 모습은 그대로.
- `PALETTE.sorting/grading/office`, `LOOKS.m2/m4`(look에 `room`·`window` 색조·`art` 경로), `INDOOR_ART`.

## Task 3 — 무대(`run-world.js`·`run-scenery.js`·`run3d.js`·CSS)
- 먼저 테스트(브라우저 `indoor-browser`): 2 임무 = 실내 층(하늘·도시 2·창밖 색조·실내 벽) + 선별장 그림, 구역 4개마다 `peek().world.look` 바뀜·분류함 색, 바닥 색 = 팔레트 · 4 임무 S1 = 채점 센터, S4 = 교무실 그림·바닥으로 바뀜 · 레인 위엔 소품 없음(옆 소품 x가 바닥 폭 밖) · `?low=1`·움직임 줄이기 = 움직임 멈춤(`moving:false`, 실내·도시 층 transform 그대로) · 실내 그림 못 읽음 → 그 층만 숨김 · 연습·1·3 임무 층·모습 그대로 · `scenery.theme` 'sorting'·'exam' 유지. 스크린샷 2 임무 구역 4개 1280, 4 임무 S1·S4 × 1280·390.
- 임무 데이터 `world: 'sorting'`(m2)·`'grading'`(m4). `run-world.js`: world 갈래 — 실내면 낮 도시 층을 창 띠 높이로, 그 위 실내 벽 층(밑변 = 지평선), 바닥 = 벨트/리놀륨 텍스처, 레인 줄·가장자리 색, 안개 = 실내 색. `run-scenery.js` sorting·exam: 실내 무대 위에서 옆 소품만(분류함 = 구역 색, 레인에서 멀리·어둡게 / 옆 벨트 답안지·도장 팔(○✕ 기호만)·스캐너 문 / 교무실 책상·캐비닛), 상자 빌딩 숨김. 움직임은 은은하게, low·reduced면 멈춤.
- 기존 브라우저 기대값 바뀜: `bridge-browser`("2 임무로 가면 0" → 실내 층), 다른 건 그대로여야 함.

## Task 4 — 문서·전체 테스트
- CLAUDE.md ★지금 상태, README(그림). 단위 전체 + `run-all.mjs`(잠금, 백그라운드).
