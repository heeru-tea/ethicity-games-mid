# Codex 그림 지시서: 사건 4·5

게임은 「블랙박스를 열어보는 고양이」(중학생 대상 AI 투명성 게임)이다. 작업 폴더는 `D:\Works\ethicity-games-mid-transparency\transparency\`이다.
설계는 `docs/2026-11-02-incidents-4-5-design.md`에 있다. 이 문서는 그림만 다룬다. 코드와 기존 파일은 고치지 않는다.

## 1. 지켜야 할 것

- **그림 안에 글자·숫자·로고·워터마크·UI를 넣지 않는다.** 책 표지, 간판, 포스터, 휴대폰 화면, 시간표도 마찬가지다. 자료의 글과 숫자는 게임이 텍스트로 그린다. 책등과 표지는 색 띠나 무늬만 둔다.
- 지금 게임과 같은 그림체를 쓴다. 세밀한 질감의 구아슈 그래픽노블 풍이다. 차분한 숯색 윤곽선, 톤을 낮춘 남색·차가운 회색·짙은 나무 갈색에 작은 노란 포인트를 둔다. 유아용·치비·픽셀아트·사진 실사는 피한다.
- 기존 공통 프롬프트 머리말(그대로 앞에 붙인다):
  > Refined textured gouache graphic-novel / illustrated mystery game for ages 13–15; restrained charcoal contours, muted navy, cool gray, dark wood brown, small yellow accents. Match reference style, not preschool/chibi, not pixel art, not photorealistic. No text, letters, numbers, logos, watermark or UI.
- 무섭거나 위협적인 분위기는 만들지 않는다. 인물은 모두 평범하고 인간적인 표정이다.

## 2. 그림체 참조 파일 (이 파일들과 나란히 놓고 맞춘다)

| 용도 | 참조 파일 |
|---|---|
| 배경 그림체·빛·구도 | `assets/s01/bg-festival-board.png`, `assets/remaining/bg-school-corridor.png`, `assets/remaining/bg-repair-shop.png` |
| 모아(회색 고양이, 노란 스카프, 남색 재킷, 갈색 수첩) | `assets/s01/moa-attentive.png`, `assets/remaining/moa-expressions.png` |
| 담이(초록 거북, 크림색 셔츠, 데님 멜빵바지) | `assets/s01/dami-hurt.png` |
| 루루(아이보리 토끼, 남색 카디건, 갈색 치마, 가방) | `assets/s01/lulu-concerned.png` |
| 사서 역 올빼미 선생님 | `assets/remaining/teacher-listening.png` |
| 기존 생성 프롬프트 | `assets/s01/generation-prompts.json`, `assets/remaining/generation-prompts.json` |

## 3. 필요한 그림 목록

새 파일은 `assets/s04/`(사건 4)와 `assets/s05/`(사건 5)에 둔다. 규격은 기존 assets와 같다.

| # | 파일 | 크기·형식 | 내용 | 필수 | 오기 전 대신 쓸 그림 |
|---|---|---|---|---|---|
| 1 | `assets/s04/bg-school-library.png` | 1672×941, PNG RGB(알파 없음) | 중학교 도서관 안, 눈높이 구도. 왼쪽과 가운데에 책장, 오른쪽에 화면이 꺼진(검은) 대출·추천 단말기 하나, 낮은 열람 탁자. 늦은 오후 창빛. 앞쪽 바닥은 인물 3명이 설 수 있게 비운다. 오른쪽 위에 코드로 띄울 화면 카드를 놓을 빈 벽면이 있어야 한다. 책등은 무늬만 넣고 글자는 넣지 않는다. 사람과 동물은 넣지 않는다. | 필수 | `assets/remaining/bg-school-corridor.png` |
| 2 | `assets/s04/dami-books.png` | 1024×1536, PNG RGBA(투명 배경, 모서리 알파 0) | 담이 전신. `dami-hurt.png`의 얼굴·옷·비율을 그대로 유지한다. 공룡 그림책 두 권(표지는 무늬만)을 품에 안고 고개를 갸웃한 표정이다. 실망은 하지만 울지는 않는다. 3/4 각도로 왼쪽을 향한다. | 권장 | `assets/s01/dami-hurt.png` |
| 3 | `assets/s05/bg-observatory-hill.png` | 1672×941, PNG RGB | 언덕 위 나무 관측 데크의 밤. 망원경 두세 대가 있고, 멀리 아래로 마을 불빛과 빈 버스 정류장 지붕이 작게 보인다. 하늘에는 별이 있다. 앞쪽 데크는 인물 3명이 설 수 있게 비운다. 표지판에 글자를 넣지 않는다. 사람과 동물은 넣지 않는다. | 필수 | `assets/remaining/bg-repair-shop.png` |
| 4 | `assets/s05/moa-phone.png` | 1024×1536, PNG RGBA | 모아 전신. `moa-attentive.png`의 정체성을 그대로 유지한다. 한 손에 화면이 빈 휴대폰(화면은 단색 빛만)을 들고, 다른 손은 턱에 대고 생각하는 표정이다. 3/4 각도로 오른쪽을 향한다. | 권장 | `assets/s01/moa-attentive.png` |
| 5 | `assets/s05/lulu-casual.png` | 1024×1536, PNG RGBA | 루루 전신. `lulu-concerned.png`의 정체성을 유지한다. 밤 외출용 얇은 겉옷을 걸치고 반가운 표정으로 한 손을 들어 인사한다. | 선택 | `assets/s01/lulu-concerned.png` |

필요 없는 것: 책 표지 일러스트, 점수표, 안내문, 휴대폰 화면 내용, 버스 시간표. 이것들은 모두 게임이 텍스트로 그린다. 사서 선생님도 새로 그리지 않는다. `teacher-listening.png`를 다시 쓴다.

## 4. 그림별 프롬프트 초안 (공통 머리말 뒤에 붙인다)

1. **bg-school-library**: Wide 16:9 background plate. Quiet middle-school library interior at late afternoon, eye-level. Wooden bookshelves left and center with spines as plain color bands and patterns only, a low reading table, a small borrowing/recommendation kiosk at right with a blank dark screen. Clean flat wall area upper right reserved for a code overlay card. Open floor foreground for three character sprites. No people, animals, readable signage or posters.
2. **dami-books**: Identity-preserve edit of the supplied green turtle Dami sprite. Preserve exact face, shell, cream shirt, denim overalls, proportions, style and transparent background. New pose: hugging two picture books with plain patterned covers (no text) to chest, head slightly tilted, puzzled mildly disappointed expression. Full body, clean transparent silhouette, no halo.
3. **bg-observatory-hill**: Wide 16:9 background plate. Wooden observation deck on a hilltop at night, two or three small telescopes on tripods, railing, starry navy sky, distant village lights below and a tiny empty bus-stop shelter far down the road. Open deck foreground for three sprites. No people, animals, readable signs or text.
4. **moa-phone**: Identity-preserve edit of the supplied gray cat Moa sprite. Preserve exact face, yellow scarf, navy jacket, crossbody bag, proportions and transparent background. New pose: holding a smartphone whose screen is a plain soft glow (no UI), other hand at chin, thoughtful questioning expression. Full body, no halo.
5. **lulu-casual**(선택): Identity-preserve edit of the supplied ivory rabbit Lulu sprite. Preserve face, ears and proportions. Add a light evening jacket over the cardigan, one hand raised in a friendly wave, warm expression. Transparent background, full body, no halo.

## 5. 납품 전 확인 목록

- [ ] 파일 이름·경로·크기가 표와 정확히 같다(배경 1672×941, 인물 1024×1536).
- [ ] 배경은 RGB(알파 없음)이다. 인물은 RGBA이고, 네 모서리 알파가 0이다. 가장자리에 흰 테두리나 후광이 없다.
- [ ] 그림 어디에도 글자·숫자·로고·워터마크·UI가 없다. 책등, 표지, 간판, 휴대폰 화면, 정류장 표지판도 확인한다.
- [ ] 모아·담이·루루가 기존 파일과 나란히 놓았을 때 같은 인물로 보인다(얼굴형, 색, 옷, 머리 대 몸 비율 약 1:4).
- [ ] 배경 앞쪽에 인물 셋이 설 빈자리가 있다. 사건 4 배경은 오른쪽 위 벽면이 비어 있다.
- [ ] 인물 발끝이 그림 아래쪽 가까이에 있고, 기존 인물 PNG와 키 비율이 비슷하다.
- [ ] 기존 assets 파일을 덮어쓰거나 고치지 않았다.
- [ ] `assets/s04/generation-prompts.json`·`assets/s05/generation-prompts.json`에 실제로 쓴 프롬프트를 적었다.
- [ ] `asset-manifest.json`(파일, 크기, 알파 여부, 모서리 알파 값)을 기존 형식대로 적었다.
- [ ] 생성 도구 이름과 날짜를 적었다. 실제 학생 반응 같은 확인하지 않은 내용은 적지 않았다.

## 6. 납품 뒤 게임 쪽에서 할 일 (참고, Codex 작업 아님)

`story.js`의 `art`에 새 경로 키(`library`, `damiBooks`, `observatory`, `moaPhone`, `luluCasual`)를 더한다. 배경 배열에 두 장을 추가한다. `art.html` 보관함에도 추가한다.
