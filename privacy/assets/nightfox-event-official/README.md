# 사건 8 공식 화풍 CG 납품

내장 image_gen으로 생성. 게임 코드·shared·기존 그림은 수정하지 않음. 커밋·push 없음.

- boy-arrival.png — 온유 · 도착 — 1280×720, 2280180 bytes
- girl-arrival.png — 다온 · 도착 — 1280×720, 2274747 bytes
- boy-confrontation.png — 온유 · 대치 — 1280×720, 2263683 bytes
- girl-confrontation.png — 다온 · 대치 — 1280×720, 2270180 bytes
- boy-clash.png — 온유 · 몸싸움 — 1280×720, 2229988 bytes
- girl-clash.png — 다온 · 몸싸움 — 1280×720, 2244716 bytes
- boy-recorded.png — 온유 · 촬영 — 1280×720, 2163620 bytes
- girl-recorded.png — 다온 · 촬영 — 1280×720, 2126881 bytes
- classroom-reaction.png — 교실 · 친구들의 반응 — 1280×720, 2029975 bytes
- teacher-support.png — 상담실 · 담임의 도움 — 1280×720, 1784215 bytes

등장 인물: boy=온유, girl=다온. 도착·대치·몸싸움·촬영에는 동일한 나이트폭스 및 구경꾼. 교실=지호·새봄·하늘·민준과 일반 학생. 상담=공식 여성 담임만, 주인공 신체 없음.

## 검수

10장 전부 1280×720, 비불투명 픽셀 0. 생성 원본은 1672×941이며 nearest 방식으로 규격화했다. 남녀는 주인공 교체 편집으로 구도를 유지했다. 각 결과를 육안 확인했으나 생성 편집 특성상 남녀 배경의 픽셀 단위 완전 동일성은 보장하지 않는다. 공식 대비 이벤트 인물 크기가 크고, 상담은 1인칭에 맞춰 가까운 시점이다. 촬영 전경 휴대폰은 다소 부드럽게 묘사됐다. 실제 게임 연결·모바일 합성 검증은 하지 않았다.

재생성 1회: 교실 배경 학생의 주요 캐릭터 복제 외형을 일반 학생으로 교정. 나머지 10개 최초 생성(친구 포함), 남녀 변형은 요청된 별도 산출물이며 실패 재시도에 포함하지 않음.

## 생성 지시문

### boy-arrival

```text
Use case: illustration-story. One complete opaque 1280x720 landscape 16:9 game event scene, edge to edge. Match official reference courtyard's elevated three-quarter RPG view, pixel density and muted warm palette, crisp stepped pixel clusters, dark brown outlines, 16-bit pixel art, large heads and compact bodies exactly like supplied character sheets. NOT anime/webtoon, realism, painterly or 3D. No text, lettering, speech bubbles, labels, phone UI or watermarks. Night scenes use restrained navy ambient light and warm lamplight, no horror, neon, flash or dramatic effects. Preserve character identities exactly, no reinterpretation. Onyu: wavy brown hair, round glasses, teal sweater vest, cream shirt, brown trousers, white sneakers, navy book bag. Nightfox: older teenage boy 16-17, same compact large-head style, black cap pulled low, gray mask lowered under chin, dark navy quilted sleeveless puffer vest over gray long sleeves, dark pants and shoes. Tension without glorification, wounds or blood.
SCENE boy-arrival: Onyu has arrived at school front gate at night. Onyu in left foreground, body turned toward the open school gate, looking cautiously toward Nightfox waiting on the right middle ground with a few indistinct bystanders further right. Cream school building, trees and brick gateposts behind, warm lamps atop posts. Preserve these narrative positions from old scene but use elevated orthographic game view and pixel style. Full bodies visible, calm readable staging.
```

### girl-arrival

```text
Edit reference image 1 to create girl-arrival, an alternate version of exactly the same RPG event composition. Change ONLY the left foreground protagonist Onyu into Daon from reference image 2: two short low dark-chestnut pigtails, orange geometric clip, lavender zip hoodie, cream T-shirt, indigo trousers, cream shoes and lilac backpack, no glasses. Match her exact sheet identity, big head compact body and pixel outlines. Keep identical pose orientation, character scale and position. Keep school, gate, lighting, Nightfox and all bystanders pixel-for-pixel as much as possible. Opaque 1280x720 landscape 16:9, no text.
```

### boy-confrontation

```text
Use case: illustration-story. One complete opaque 1280x720 landscape 16:9 game event scene, edge to edge. Match official reference courtyard's elevated three-quarter RPG view, pixel density and muted warm palette, crisp stepped pixel clusters, dark brown outlines, 16-bit pixel art, large heads and compact bodies exactly like supplied character sheets. NOT anime/webtoon, realism, painterly or 3D. No text, lettering, speech bubbles, labels, phone UI or watermarks. Night scenes use restrained navy ambient light and warm lamplight, no horror, neon, flash or dramatic effects. Preserve character identities exactly, no reinterpretation. Onyu: wavy brown hair, round glasses, teal sweater vest, cream shirt, brown trousers, white sneakers, navy book bag. Nightfox: older teenage boy 16-17, same compact large-head style, black cap pulled low, gray mask lowered under chin, dark navy quilted sleeveless puffer vest over gray long sleeves, dark pants and shoes. Tension without glorification, wounds or blood.
SCENE boy-confrontation. Use image 1 as exact continuity reference for gate, lighting, Onyu and Nightfox. Move the confrontation forward: Onyu left and Nightfox right face each other across a short gap in front of the gate. Nightfox extends one open hand in a challenging conversational gesture; Onyu looks tense and attentive. Several indistinct onlookers behind them at the edges. Medium-wide elevated three-quarter RPG view, full bodies visible, no contact yet. Same clothing and same faces, especially Nightfox's black cap, mask under chin and navy quilted vest.
```

### girl-confrontation

```text
Edit reference image 1 to create girl-confrontation, an alternate version of exactly the same RPG event composition. Change ONLY the left protagonist Onyu into Daon from reference image 2: two short low dark-chestnut pigtails, orange geometric clip, lavender zip hoodie, cream T-shirt, indigo trousers, cream shoes and lilac backpack, no glasses. Match her exact sheet identity, big head compact body and pixel outlines. Keep identical pose orientation, character scale and position. Keep school, gate, lighting, Nightfox and all bystanders pixel-for-pixel as much as possible. Opaque 1280x720 landscape 16:9, no text.
```

### boy-clash

```text
Use case: illustration-story. One complete opaque 1280x720 landscape 16:9 game event scene, edge to edge. Match official reference courtyard's elevated three-quarter RPG view, pixel density and muted warm palette, crisp stepped pixel clusters, dark brown outlines, 16-bit pixel art, large heads and compact bodies exactly like supplied character sheets. NOT anime/webtoon, realism, painterly or 3D. No text, lettering, speech bubbles, labels, phone UI or watermarks. Night scenes use restrained navy ambient light and warm lamplight, no horror, neon, flash or dramatic effects. Preserve character identities exactly, no reinterpretation. Onyu: wavy brown hair, round glasses, teal sweater vest, cream shirt, brown trousers, white sneakers, navy book bag. Nightfox: older teenage boy 16-17, same compact large-head style, black cap pulled low, gray mask lowered under chin, dark navy quilted sleeveless puffer vest over gray long sleeves, dark pants and shoes. Tension without glorification, wounds or blood.
SCENE boy-clash. Continuation of image 1, keep same school gate and people identity. Onyu on left and Nightfox on right now close together in middle foreground, both standing and bracing their feet, mutually gripping each other's sleeves/upper arm clothing and pushing apart. Show clearly a brief non-graphic scuffle, neither winning, no punches, no kicks, no injuries, no blood, no effects. Onyu's glasses stay on. Readable separate hands attached to correct arms, tense worried expressions. Bystanders at perimeter, elevated three-quarter RPG composition with full compact bodies. Same Nightfox cap, lowered mask and vest.
```

### girl-clash

```text
Edit reference image 1 to create girl-clash, an alternate version of exactly the same RPG event composition. Change ONLY the left protagonist Onyu into Daon from reference image 2: two short low dark-chestnut pigtails, orange geometric clip, lavender zip hoodie, cream T-shirt, indigo trousers, cream shoes and lilac backpack, no glasses. Match her exact sheet identity, big head compact body and pixel outlines. Keep identical pose orientation, character scale and position. Keep school, gate, lighting, Nightfox and all bystanders pixel-for-pixel as much as possible. Opaque 1280x720 landscape 16:9, no text. Preserve the mutual sleeve-gripping and pushing pose exactly. Daon looks tense, not smiling; no blood or injuries.
```

### boy-recorded

```text
Use case: illustration-story. One complete opaque 1280x720 landscape 16:9 game event scene, edge to edge. Match official reference courtyard's elevated three-quarter RPG view, pixel density and muted warm palette, crisp stepped pixel clusters, dark brown outlines, 16-bit pixel art, large heads and compact bodies exactly like supplied character sheets. NOT anime/webtoon, realism, painterly or 3D. No text, lettering, speech bubbles, labels, phone UI or watermarks. Night scenes use restrained navy ambient light and warm lamplight, no horror, neon, flash or dramatic effects. Preserve character identities exactly, no reinterpretation. Onyu: wavy brown hair, round glasses, teal sweater vest, cream shirt, brown trousers, white sneakers, navy book bag. Nightfox: older teenage boy 16-17, same compact large-head style, black cap pulled low, gray mask lowered under chin, dark navy quilted sleeveless puffer vest over gray long sleeves, dark pants and shoes. Tension without glorification, wounds or blood.
SCENE boy-recorded. Same gate after the scuffle in reference 1: Onyu left center turns worriedly toward the nearby camera, one open hand raised defensively, Nightfox right center turns slightly away. Several surrounding bystanders in back/side views now raise phones clearly aimed at the pair. Include a prominent horizontal phone held by an anonymous bystander's hands at lower right foreground showing tiny image-only silhouettes of the same scene, no UI/no text. Preserve gate and pixel palette, large-head compact body Onyu with round glasses. No injuries or blood. Recording and loss of privacy are the focus, not fighting victory.
```

### girl-recorded

```text
Edit reference image 1 to create girl-recorded, an alternate version of exactly the same RPG event composition. Change ONLY the left-center protagonist Onyu into Daon from reference image 2: two short low dark-chestnut pigtails, orange geometric clip, lavender zip hoodie, cream T-shirt, indigo trousers, cream shoes and lilac backpack, no glasses. Match her exact sheet identity, big head compact body and pixel outlines. Keep identical pose orientation, character scale and position. Keep school, gate, lighting, Nightfox and all bystanders pixel-for-pixel as much as possible. Opaque 1280x720 landscape 16:9, no text. Also replace Onyu with the same Daon on EVERY phone screen depicting the scene, including the big horizontal foreground phone. Preserve worried expression and open raised hand. No glasses, no text.
```

### classroom-reaction

```text
Use case: illustration-story. Opaque 1280x720 16:9 pixel RPG event CG classroom-reaction. Image 1 is the exact classroom style/environment guide: elevated three-quarter game view, honey wood, cream and sage, controlled pixel clusters, dark warm outlines. Image 2 is official cast sheet: top groups Jiho navy hoodie low ponytail; Haneul black hair burgundy windbreaker; Saebom chestnut bob flower clip sage cardigan coral skirt; Onyu MUST NOT APPEAR. Bottom groups including Daon and teacher MUST NOT APPEAR. Image 3 is Minjun identity navy-blue tousled hair, sleepy eyes, charcoal open hoodie over white T-shirt, black pants, dark green crossbody pouch. Scene: next morning classroom, concerned whispers after a classmate was filmed. Show FOUR distinct main friends near desks: Jiho left foreground looking concerned toward viewer, Saebom beside her with hand near mouth and cream notebook, Haneul center-right holding a phone low with screen hidden, Minjun right looking quietly worried downward. A few generic classmates farther back whisper in pairs. Preserve all four exact hair/clothes and large-head compact-body pack proportions. No protagonist Onyu/Daon, no player body or silhouette. Same readable RPG pixel density as reference, no anime/webtoon/3D/photorealism, no text, no numbers, no speech bubbles, no UI. Warm gentle morning light.
```

### teacher-support

```text
Use case: illustration-story. Opaque 1280x720 16:9 game event CG teacher-support. Reference 1 is exact official teacher identity: adult woman late thirties, tied-low shoulder length dark brown hair, soft rectangular glasses, dusty blue cardigan over cream blouse, charcoal trousers. Preserve this face/hair/clothes and cute large-head compact-body pixel RPG proportions. Reference 2 is environment style only, use same pixel density and warm outlines, cream sage honey wood palette. Scene: morning after school festival, calm counseling room. First-person view from student seated opposite teacher at a wooden table. ONLY teacher is visible centered behind table, facing viewer with empathetic attentive expression, one hand open in reassuring gesture, other near a slim green folder. No player face, hands, body or silhouette anywhere. A notebook without writing, tissue box on table, bookshelf, leafy plants, warm window light. Readable slightly elevated view over table consistent with RPG, no cinematic depth of field. Explicitly pixel art like references, no webtoon, semi-realism, 3D, lettering, speech bubbles, UI, labels, watermark. Full scene not sprite sheet.
```

### classroom-reaction-correction

```text
Edit this classroom image. Preserve the FOUR foreground main characters and all furniture/background exactly: Jiho in navy at left, Saebom flower clip sage cardigan, Haneul black hair burgundy jacket holding phone, Minjun blue-black hair charcoal hoodie at right. Change ONLY the six background whispering students to distinct generic classmates so they are NOT duplicates of those four: use varied short hair and braids, muted gray/ochre/blue shirts or sweatshirts, plain trousers; remove every flower clip and remove sage cardigans, burgundy jackets and navy hoodies from background students. Keep their current positions, whispering poses and large-head compact-body pixel style. No Onyu round glasses or Daon lavender pigtails. Opaque 1280x720 16:9, no text, no new objects.
```
