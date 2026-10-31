# 옆 반 친구 납품

- friend-source.png: 1122×1402, 투명, 4열×5행 20개 실루엣.
- friend-walk.png: 384×512, 96×128 칸, down/left/right/up, 4프레임, 6fps, 발 기준점 (48,120).
- friend-portraits.png: 1024×256, neutral/happy/worried/explaining.
- friend-data.json: 프레임 좌표·원본 영역·기준점.
- friend-preview.html / friend-preview.png: 공식 지호·새봄·다온과 같은 축척 0.85 비교. HTML은 걷기 애니메이션, PNG는 정지 프레임 1.
- friend-prompts.json: 공식 characters.base 원문과 지정 인물 설명. 내장 image_gen 사용, 재생성 0회.
- pack-friend.cjs: 기존 pack-minjun.cjs 복사 후 인물 ID·표시명·결과 파일명만 변경. 원본 수정 없음.
- friend-validation.json: 규격 검사 결과. 20개 연결 실루엣 분리 성공.

육안으로 방향·표정·의상 및 공식 캐릭터와 크기를 대조했다. 머리의 파도 모양은 완만하며, 원본은 생성형 픽셀풍이라 모든 윤곽이 단일 논리 픽셀 격자에 정렬된 수작업 픽셀아트는 아니다. 공식 팩도 같은 방식의 생성 원본을 사용한다. 실제 게임 연결과 모바일 맵 합성은 하지 않았다. 코드·shared·기존 그림 수정 및 커밋·push 없음.
