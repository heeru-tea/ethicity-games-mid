# Codex 그림 지시서: 새 사건 4·5 (2026-11-10)

게임은 「블랙박스를 열어보는 고양이」(중학생 대상 AI 투명성 게임)이다. 작업 폴더는 `D:\Works\ethicity-games-mid-transparency\transparency\`이다.
설계는 `docs/2026-11-10-cases-4-5-rework-design.md`에 있다. 이 문서는 그림만 다룬다. **코드와 기존 파일은 고치지 않는다.**

- 사건 4 「겨울 캠프 명단」: 구청 AI가 캠프 참가자를 뽑았는데, 버스가 드문 솔숲마을 아이들이 본의 아니게 많이 떨어졌다. 모아는 학교 신문부 기자로서 기록을 확인한다. 곰 점원은 “AI가 일부러 차별했다”는 소문을 퍼뜨린다.
- 사건 5 「은하수 홍보 그림」: 루루가 AI로 만든 은하수 그림을 관찰 모임 홍보 게시물에 올렸다. 밤이는 그것을 진짜 사진으로 믿는다.

## 1. 지켜야 할 것 (옛 지시서 `docs/codex-art-brief-4-5.md`와 같다)

- **그림 안에 글자·숫자·로고·워터마크·UI를 넣지 않는다.** 신문 지면, 안내 종이, 휴대폰 화면, 게시판에도 넣지 않는다. 글은 게임이 텍스트로 그린다. 지면과 종이는 회색 줄무늬로만 표현한다.
- 그림체는 지금 게임과 같다. 세밀한 질감의 구아슈 그래픽노블 풍이다. 차분한 숯색 윤곽선, 톤을 낮춘 남색·차가운 회색·짙은 나무 갈색에 작은 노란 포인트를 둔다. 유아용·치비·픽셀아트·사진 실사는 피한다.
- 공통 프롬프트 머리말(그대로 앞에 붙인다):
  > Refined textured gouache graphic-novel / illustrated mystery game for ages 13–15; restrained charcoal contours, muted navy, cool gray, dark wood brown, small yellow accents. Match reference style, not preschool/chibi, not pixel art, not photorealistic. No text, letters, numbers, logos, watermark or UI.
- 무섭거나 위협적인 분위기는 만들지 않는다. 곰 점원도 악당이 아니다. 흥분한 이웃 아저씨 정도로 그린다.

## 2. 그림체 참조 파일

| 용도 | 참조 파일 |
|---|---|
| 배경 | `assets/s01/bg-festival-board.png`, `assets/remaining/bg-school-corridor.png`, `assets/s05/bg-observatory-hill.png` |
| 모아(회색 고양이, 노란 스카프, 남색 재킷, 갈색 수첩) | `assets/s01/moa-attentive.png`, `assets/s05/moa-phone.png` |
| 담이(초록 거북, 크림색 셔츠, 데님 멜빵바지) | `assets/s01/dami-hurt.png` |
| 루루(아이보리 토끼) | `assets/s01/lulu-concerned.png`, `assets/s05/lulu-casual.png` |
| 밤이(검은·흰 고양이, 긴 코트) | `assets/remaining/bami-concerned.png` |
| 곰 점원(갈색 곰, 회색 앞치마) | `assets/remaining/clerk-hesitant.png` |

## 3. 필요한 그림

새 파일은 `assets/s04/`(사건 4)와 `assets/s05/`(사건 5)에 둔다. 같은 이름 파일이 이미 있으면 덮어쓰지 말고 알려 준다.

| # | 파일 | 크기·형식 | 내용 | 필수 | 오기 전 대신 쓸 그림 |
|---|---|---|---|---|---|
| 1 | `assets/s04/bg-newsroom.png` | 1672×941, PNG RGB | 중학교 신문부실. 큰 나무 책상과 의자, 벽 게시판에 붙은 빈 신문 지면(회색 줄무늬만), 창밖은 겨울 오후. 앞쪽 바닥은 인물 3명이 설 수 있게 비운다. **오른쪽 위 벽면은 비워 둔다**(게임이 신문 1면 카드를 띄운다). 사람·동물은 없다. | 필수 | `assets/remaining/bg-school-corridor.png` |
| 2 | `assets/s04/moa-reporter.png` | 1024×1536, PNG RGBA | 모아 전신. 정체성 유지. 팔에 기자 완장(글자 없음), 한 손에 수첩과 연필, 목에 작은 카메라. 진지하게 기록하는 표정, 3/4 각도로 오른쪽을 향한다. | 필수 | `assets/s01/moa-attentive.png` |
| 3 | `assets/s04/dami-letter.png` | 1024×1536, PNG RGBA | 담이 전신. 정체성 유지. 안내 종이 한 장(글자 없음)을 두 손으로 들고 풀 죽었지만 울지는 않는 표정. 3/4 각도로 왼쪽을 향한다. | 필수 | `assets/s01/dami-hurt.png` |
| 4 | `assets/s04/clerk-newspaper.png` | 1024×1536, PNG RGBA | 곰 점원 전신. 정체성 유지. 접힌 신문(글자 없음)을 한 손으로 흔들며 흥분해 말하는 모습. 화났다기보다 들뜬 표정이다. | 권장 | `assets/remaining/clerk-hesitant.png` |
| 5 | `assets/s05/galaxy-ai.png` | 1024×1024, PNG RGB | **게시물 속 AI 그림.** 언덕 위 관측 데크 너머로 은하수가 쏟아지는 장면. 색이 진하고 별이 비현실적으로 많고 고르게 반짝인다. “너무 완벽한 그림”으로 보이게 한다. 그래도 게임 그림체(구아슈)를 따른다. 사람·동물은 없다. | 필수 | 코드로 그린 남보라 하늘 + 별 점 |
| 6 | `assets/s05/hill-real-photo.png` | 1024×1024, PNG RGB | **같은 언덕의 실제 하늘.** 5번과 같은 구도. 아래쪽에 마을 불빛이 번지고, 하늘은 회남색이며 별은 몇 개뿐이다. 은하수는 거의 안 보인다. 5번과 나란히 놓으면 차이가 한눈에 보여야 한다. 사진 실사로 그리지 말고, 같은 그림체로 차분하게 그린다. | 필수 | 코드로 그린 회남색 하늘 + 별 몇 개 |
| 7 | `assets/s05/lulu-phone.png` | 1024×1536, PNG RGBA | 루루 전신. 정체성 유지(`lulu-casual.png`의 외출복이면 더 좋다). 휴대폰(화면은 단색 빛만)을 두 손으로 들고 올릴까 말까 망설이는 표정. | 권장 | `assets/s05/lulu-casual.png` |
| 8 | `assets/s05/bami-phone.png` | 1024×1536, PNG RGBA | 밤이 전신. 정체성 유지. 휴대폰(화면은 단색 빛만)을 보며 기대에 찬 표정. | 권장 | `assets/remaining/bami-concerned.png` |

필요 없는 것: 신문 기사·안내 종이·게시물 화면·표의 내용. 모두 게임이 텍스트로 그린다. 구청 담당자와 올빼미 선생님은 새로 그리지 않는다.

## 4. 그림별 프롬프트 초안 (공통 머리말 뒤에 붙인다)

1. **bg-newsroom**: Wide 16:9 background plate. Middle-school newspaper club room on a winter afternoon, eye-level. Large wooden work table, chairs, a corkboard with blank newspaper pages shown only as gray stripe patterns, window with pale winter light. Clean flat wall area upper right reserved for a code overlay card. Open floor foreground for three character sprites. No people, animals, readable text or logos.
2. **moa-reporter**: Identity-preserve edit of the supplied gray cat Moa sprite. Preserve exact face, yellow scarf, navy jacket, proportions and transparent background. New pose: plain armband (no text), small camera on a neck strap, notebook and pencil in hand, serious note-taking expression, 3/4 view facing right. Full body, no halo.
3. **dami-letter**: Identity-preserve edit of the supplied green turtle Dami sprite. Preserve exact face, shell, cream shirt, denim overalls, proportions, transparent background. New pose: holding one blank sheet of paper with both hands, downcast but not crying, 3/4 view facing left. Full body, no halo.
4. **clerk-newspaper**: Identity-preserve edit of the supplied brown bear clerk sprite. Preserve face, gray apron, proportions, transparent background. New pose: waving a folded newspaper (gray stripes only, no text), excited talkative expression, not angry or threatening. Full body, no halo.
5. **galaxy-ai**: Square illustration. Hilltop wooden observation deck under an impossibly dense, vivid Milky Way pouring across the sky, saturated violet and gold, evenly scattered bright stars, too-perfect look. Same gouache style. No people, animals or text.
6. **hill-real-photo**: Square illustration, same composition and camera angle as galaxy-ai. Realistic night: grayish navy sky, warm village light glow on the horizon, only a few faint stars, Milky Way barely visible. Calm, matching gouache style (not photorealistic). No people, animals or text.
7. **lulu-phone**: Identity-preserve edit of the supplied ivory rabbit Lulu sprite (light evening jacket welcome). Holding a smartphone with a plain glowing screen (no UI) in both hands, hesitant thoughtful expression. Transparent background, full body, no halo.
8. **bami-phone**: Identity-preserve edit of the supplied black-and-white cat Bami sprite. Preserve face, long coat, proportions. Looking at a smartphone with a plain glowing screen (no UI), hopeful expectant expression. Transparent background, full body, no halo.

## 5. 납품 전 확인 목록

- [ ] 파일 이름·경로·크기가 표와 같다(배경 1672×941, 인물 1024×1536, 하늘 두 장 1024×1024).
- [ ] 배경과 하늘 그림은 RGB(알파 없음)이다. 인물은 RGBA이고, 네 모서리 알파가 0이며 흰 테두리나 후광이 없다.
- [ ] 그림 어디에도 글자·숫자·로고·워터마크·UI가 없다. 신문, 종이, 완장, 휴대폰 화면도 확인한다.
- [ ] 인물이 기존 파일과 나란히 놓았을 때 같은 인물로 보인다.
- [ ] 5번과 6번이 같은 구도이고, 나란히 놓으면 “AI 그림은 과장, 실제는 별 몇 개”가 바로 보인다.
- [ ] 신문부실 배경은 앞쪽에 인물 셋이 설 자리가 있고, 오른쪽 위 벽면이 비어 있다.
- [ ] 기존 assets 파일을 덮어쓰거나 고치지 않았다.
- [ ] 실제로 쓴 프롬프트와 생성 도구 이름·날짜를 `generation-prompts.json`(또는 따로 받은 메모)에 적었다.

## 6. 납품 뒤 게임 쪽에서 할 일 (참고, Codex 작업 아님)

`node tools/art-4-5.cjs`로 `.webp` 사본을 만든다. 게임은 `.webp` → `.png` → 대신 그림 순서로 저절로 찾는다. 코드 수정은 필요 없다(`story.js`의 `art.newArt`에 경로가 이미 있다). 그 뒤 `node tests/flow-browser.cjs`로 그림이 쓰이는지 확인한다.
