/*
 * 「공유한 순간」 맵 데이터 + 길찾기(순수 로직, 브라우저·Node 겸용)
 * ------------------------------------------------------------
 * 2026-10-31 맵 개편(docs/specs/2026-10-31-scene-map-design.md): 타일맵 → **장면 그림 5장**.
 *   장면 = 그림 1장(논리 1280×720)을 40px 칸 32×18로 나눈 방. 장면 5개를 가로로 이어 붙인 한 격자(160×18)에서 걷고,
 *   장면 사이는 출입구 칸(DOORS)을 밟으면 건너편 장면의 도착 칸으로 옮겨진다(길찾기도 이 문을 따라 장면을 넘는다).
 *   교실(0~31) · 도서관(32~63) · 학교 마당(64~95) · 마을 길(96~127) · 내 방(128~159)
 *   그림의 가구·문은 그림 그대로 — 여기선 막힌 칸(BLOCK 사각형)과 조사 지점(OBJECTS)만 정한다.
 * 좌표는 칸 단위(x: 왼→오, y: 위→아래, 장면 안 좌표 + 장면 시작 x). 그림은 map.js가 그린다.
 *
 * ▸ 사건 트리거(triggers): 사건의 첫 장면 id → 맵에서 그 장면을 여는 조건
 *   { time, mission, target:{ npc:'saebom' } 또는 { obj:'bed' }, spawn?, tint?, cast:[{who,x,y,dir,pose?}] }
 *   - spawn이 있으면 그 위치에서 시작(다음 날 등교 등). 없으면 직전 위치에서 이어 걷는다.
 *   - 대상(❗)에게 말을 걸거나 조사하면 해당 장면이 열린다.
 * ▸ idle: ❗가 아닌 인물에게 말 걸 때 한 줄(조건은 story.js와 같은 문법, 위에서부터 첫 일치)
 * ▸ objects[].look: 조사 문구
 */
(function (root) {
  'use strict';

  var VERSION = 3; // 지도 좌표 판(저장된 맵 위치가 이 판과 다르면 버리고 장면 시작점에서 다시)
  var SW = 32, SH = 18, CELL = 40; // 장면 하나 = 32×18칸, 칸 = 논리 40px(1280×720)
  var BG = '../shared/ethicity-elementary-common-v1/backgrounds/';
  // rects: 막힌 칸 [x, y, w, h](장면 안 좌표). 나머지는 걸을 수 있다. open: 막힌 사각형 안에서 다시 여는 칸
  var SCENES = [
    { id: 'classroom', name: '2학년 3반 교실', img: BG + 'classroom.png', rects: [
      [0, 0, 32, 5], [0, 5, 9, 1], [14, 5, 4, 1], [22, 5, 10, 1], // 앞 벽(칠판 아래 바닥만 열림)
      [0, 0, 1, 18], [31, 0, 1, 18], [0, 6, 2, 4], [30, 6, 2, 4],  // 옆 벽
      [2, 5, 7, 3], [0, 7, 3, 3], [14, 4, 4, 3],                   // 선생님 책상·책 탁자·교탁
      [25, 3, 5, 4], [29, 5, 2, 3],                                // 컴퓨터 책상·의자·화분
      [0, 10, 7, 1], [0, 13, 7, 1], [25, 10, 6, 1], [25, 13, 6, 1], // 학생 책상 윗면(의자 줄은 앉을 수 있게 열어 둠)
      [0, 10, 1, 6]
    ] },
    { id: 'library', name: '도서관', img: BG + 'library.png', rects: [
      [0, 0, 32, 5], [0, 0, 2, 15], [30, 0, 2, 15], [1, 9, 2, 4], [29, 9, 2, 4], // 책장 벽
      [2, 4, 8, 4],                                                            // 대출 데스크
      [24, 3, 5, 4],                                                           // 공용 PC 자리·화분·키오스크
      [2, 12, 6, 4], [24, 12, 6, 4],                                           // 책 읽는 탁자
      [0, 15, 8, 3], [24, 15, 8, 3], [0, 16, 14, 2], [18, 16, 14, 2],          // 아래 벽(가운데 문간만 열림)
      [10, 15, 3, 1], [19, 15, 3, 1], [29, 5, 1, 3]                            // 문간 양옆 기둥·화분, 오른쪽 책장 옆면
    ] },
    { id: 'yard', name: '학교 마당', img: 'assets/scenes/yard.png', rects: [
      [0, 0, 32, 1], [0, 1, 15, 4], [18, 1, 14, 3], [18, 4, 7, 1], [28, 4, 4, 2], // 건물·덤불(현관·도서관 문 칸은 아래에서 다시 엶)
      [13, 5, 2, 1], [24, 5, 1, 1],
      [0, 5, 3, 5], [0, 10, 2, 7], [29, 6, 3, 8], [30, 14, 2, 4],                 // 나무
      [2, 11, 1, 2], [3, 13, 2, 1], [27, 13, 1, 1], [28, 12, 1, 1],               // 왼쪽 아래 나무 가장자리·꽃덤불, 오른쪽 꽃덤불
      [6, 10, 8, 4],                                                              // 축제 천막 2개(앞 줄 14는 서는 자리)
      [20, 12, 4, 3],                                                             // 매점 가판대
      [3, 14, 4, 2], [25, 14, 4, 2], [1, 13, 2, 3], [28, 13, 2, 3],               // 벤치·꽃밭
      [0, 15, 14, 3], [18, 15, 14, 3]                                             // 아래 덤불·교문 기둥(가운데 길만 열림)
    ], open: [[6, 4], [7, 4], [8, 4], [25, 4], [26, 4], [27, 4], [15, 1], [16, 1], [17, 1], [15, 2], [16, 2], [17, 2], [15, 3], [16, 3], [17, 3], [15, 4], [16, 4], [17, 4]] },
    { id: 'village', name: '마을 길', img: 'assets/scenes/village.png', road: true },
    { id: 'room', name: '내 방', img: 'assets/scenes/room.png', rects: [
      [0, 0, 32, 7], [0, 7, 3, 5], [0, 12, 2, 3], [0, 15, 1, 3], [30, 7, 2, 6], [31, 13, 1, 5], // 벽
      [2, 4, 7, 8],                          // 침대
      [22, 5, 7, 5],                         // 컴퓨터 책상·의자
      [28, 6, 3, 6],                         // 책꽂이
      [28, 13, 4, 5],                        // 팬더 인형
      [0, 17, 14, 1], [18, 17, 14, 1]        // 아래(문 매트만 열림)
    ] }
  ];
  var W = SW * SCENES.length, H = SH;
  SCENES.forEach(function (s, i) { s.ox = i * SW; });
  var S = {}; SCENES.forEach(function (s) { S[s.id] = s; });
  function P(scene, x, y, dir, extra) { var p = { x: S[scene].ox + x, y: y }; if (dir) p.dir = dir; if (extra) for (var k in extra) p[k] = extra[k]; return p; }
  function who(w, scene, x, y, dir, extra) { var p = P(scene, x, y, dir, extra); p.who = w; return p; }

  var grid = [];
  var y, x;
  for (y = 0; y < H; y++) { grid.push([]); for (x = 0; x < W; x++) grid[y].push('.'); }
  // 마을 길: 그림의 대각선 길(왼쪽 가운데 → 오른쪽 아래)을 칸마다 직접 그린 지도('.' 걸음, '#' 막힘).
  //   2026-11-01: 길 띠 보간이 그림 길보다 위로 떠서 왼쪽 나무·집 앞 화단 위를 걸었다 → 그림의 길 색을 칸마다 재서 다시 그림.
  //   길 + 집 앞 잔디·계단만 걷는다. 왼쪽 끝 나무(0~2, 7~10)·아래쪽 꽃밭·연못·벤치·가로등 기둥(18, 14~15)은 막힘.
  var VILLAGE = [
    '################################', // 0
    '################################', // 1
    '################################', // 2
    '################################', // 3
    '################################', // 4
    '.###############################', // 5  왼쪽 끝 = 학교로 가는 출입구(0,5)(0,6)
    '........########################', // 6  세이지 지붕 집 계단(6~7, 6)
    '##..........####################', // 7
    '###..........###################', // 8
    '###..............###############', // 9  벽돌집 계단(15~16, 9)
    '#####...............############', // 10
    '########..............##..######', // 11 우리 집 현관(24~25, 11)
    '###########...............######', // 12 우리 집 계단(23~25, 12)
    '#############.............######', // 13
    '#################.#.........####', // 14 벤치(16)·가로등 기둥(18)
    '######################.....#####', // 15 아래 덤불 앞
    '#######################....#####', // 16
    '#########################..#####'  // 17
  ];
  SCENES.forEach(function (s) {
    var r, i, j;
    if (s.road) {
      for (j = 0; j < SH; j++) for (i = 0; i < SW; i++) grid[j][s.ox + i] = VILLAGE[j].charAt(i) === '.' ? '.' : '#';
      return;
    }
    s.rects.forEach(function (rc) { for (j = rc[1]; j < rc[1] + rc[3]; j++) for (i = rc[0]; i < rc[0] + rc[2]; i++) grid[j][s.ox + i] = '#'; });
    (s.open || []).forEach(function (c) { grid[c[1]][s.ox + c[0]] = '.'; });
  });

  var TILES = { '#': { walk: false, name: '막힘' }, '.': { walk: true, name: '바닥' } };

  /* 출입구: 이 칸에 들어서면 다른 장면의 칸으로 옮겨진다 */
  var DOORS = {};
  function door(cells, scene, to, dir, label) { cells.forEach(function (c) { DOORS[(S[c[0]].ox + c[1]) + ',' + c[2]] = { to: [S[scene].ox + to[0], to[1]], dir: dir, label: label, scene: scene }; }); }
  door([['classroom', 15, 17], ['classroom', 16, 17]], 'yard', [7, 5], 'down', '마당으로');
  door([['yard', 6, 4], ['yard', 7, 4], ['yard', 8, 4]], 'classroom', [15, 16], 'up', '교실로');
  door([['library', 14, 17], ['library', 15, 17], ['library', 16, 17], ['library', 17, 17]], 'yard', [26, 5], 'down', '마당으로');
  door([['yard', 25, 4], ['yard', 26, 4], ['yard', 27, 4]], 'library', [15, 16], 'up', '도서관으로');
  door([['yard', 14, 17], ['yard', 15, 17], ['yard', 16, 17], ['yard', 17, 17]], 'village', [1, 6], 'right', '교문 밖으로');
  door([['village', 0, 5], ['village', 0, 6]], 'yard', [15, 16], 'up', '학교로'); // 그림의 길이 왼쪽 끝에서 들어오는 자리(그 아래는 나무)
  door([['village', 24, 11], ['village', 25, 11]], 'room', [15, 16], 'up', '집 안으로');
  door([['room', 14, 17], ['room', 15, 17], ['room', 16, 17], ['room', 17, 17]], 'village', [24, 12], 'down', '밖으로');

  /* 구역 이름(화면 위 표시용): 장면 이름, 마당만 조금 나눔 */
  function areaName(xx, yy) {
    var s = sceneAt(xx);
    if (!s) return '';
    if (s.id === 'yard') {
      var lx = xx - s.ox;
      if (yy <= 7 && lx <= 12) return '현관 앞';
      if (yy >= 15 && lx >= 13 && lx <= 18) return '교문';
      if (lx >= 18 && yy >= 11) return '매점 앞';
      if (lx <= 14 && yy >= 9) return '축제 부스';
    }
    return s.name;
  }
  function sceneAt(xx) { return SCENES[Math.floor(xx / SW)] || null; }

  /* ── 조사 지점(그림 위 사각형, w×h칸) — 그림을 따로 붙이지 않는다. wall:true면 막지 않음(벽에 걸린 것) ── */
  function ob(id, name, scene, x0, y0, w, h, look, extra) {
    var o = { id: id, name: name, x: S[scene].ox + x0, y: y0, w: w, h: h, look: look };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  var OBJECTS = [
    ob('board', '칠판', 'classroom', 10, 4, 12, 1, '칠판: “축제 D-day · 2학년 3반 레트로 사진관 📸”', { wall: true }),
    ob('tdesk', '교탁', 'classroom', 14, 4, 4, 3, '교탁 위에 출석부와 분필이 놓여 있다.'),
    ob('tdesk2', '선생님 책상', 'classroom', 2, 5, 7, 3, '담임 선생님 책상. 축제 부스 배치도가 펼쳐져 있다. 우리 반은 마당 왼쪽 천막이다.'),
    ob('desk7', '민준이 책상', 'classroom', 28, 10, 3, 1, '민준이 책상. 만들다 만 소품이 가지런히 놓여 있다.'),
    ob('desk8', '내 책상', 'classroom', 25, 13, 3, 1, '내 책상. 축제 소품 상자가 올려져 있다.'),
    ob('shelf', '전시 책장', 'library', 13, 4, 6, 1, '‘개인정보, 어디까지 괜찮을까?’라는 책이 앞에 놓여 있다.', { wall: true }),
    ob('libdesk', '대출 데스크', 'library', 2, 4, 8, 4, '사서 선생님 자리. 지금은 비어 있다.'),
    ob('pc3', '공용 PC 3번', 'library', 24, 3, 5, 4, '공용 PC 3번. 검색과 출력용이다.', { label: '3' }),
    ob('notice', '게시판', 'yard', 18, 1, 3, 4, '게시판: 솔빛축제 부스 배치도와 일정표가 붙어 있다.', { wall: true }),
    ob('tent1', '레트로 사진관 천막', 'yard', 6, 10, 4, 4, '우리 반 부스 ‘레트로 사진관’. 1컷 500원.'),
    ob('tent2', '옆 반 천막', 'yard', 10, 10, 4, 4, '옆 반 부스. 솜사탕 냄새가 난다.'),
    ob('store', '학교 매점', 'yard', 20, 12, 4, 3, '매점. 오늘은 컵떡볶이가 제일 잘 팔린다.', {
      // 날마다 잘 팔리는 간식이 바뀐다(걷기 구간 time의 ' · ' 앞 = 날). 상표 이름은 쓰지 않는다
      looks: {
        'D-4': '매점. 오늘은 컵떡볶이가 제일 잘 팔린다.',
        'D-3': '매점. 오늘은 아이스크림이 제일 잘 팔린다. 냉장고가 벌써 반쯤 비었다.',
        'D-2': '매점. 오늘은 치즈 과자가 인기다. 마지막 한 봉지가 남았다.',
        'D-1': '매점. 축제 준비하는 애들이 초코우유를 몇 개씩 사 간다.',
        '축제 당일': '매점. 축제라서 슬러시 기계 앞에 줄이 길다.',
        '축제 다음 날': '매점. 오늘은 소시지빵이 제일 먼저 다 팔렸다.',
        '다음 주 월요일': '매점. 월요일 아침이라 삼각김밥이 잘 나간다.'
      } }),
    ob('lamp', '가로등', 'village', 18, 13, 1, 1, '가로등이 막 켜졌다.'),
    ob('mailbox', '노란 우편함', 'village', 26, 12, 1, 2, '노란 우편함. 여기가 우리 집이다.'),
    ob('bed', '침대', 'room', 2, 4, 7, 8, '내 침대. 아직 잘 시간은 아니다.'),
    ob('mypc', '내 책상 컴퓨터', 'room', 22, 5, 7, 5, '내 책상과 컴퓨터.'),
    ob('mybook', '책꽂이', 'room', 28, 6, 3, 6, '교과서와 만화책이 섞여 꽂혀 있다.'),
    ob('plush', '큰 팬더 인형', 'room', 28, 13, 4, 5, '구석에 앉은 커다란 팬더 인형. 푹신한 배에 기대면 잠이 올 것 같다.')
  ];

  /* 이웃집: 조사만(들어갈 수 없음). approach = 현관 앞 계단 칸 */
  var NEIGHBORS = [
    { id: 'nb_sage', name: '세이지 지붕 집', scene: 'village', x: S.village.ox + 4, y: 1, w: 7, h: 5, approach: P('village', 6, 6),
      look: '화분에 막 물을 준 듯 흙이 젖어 있다. 저녁 준비하는 냄새가 난다.' },
    { id: 'nb_brick', name: '벽돌집', scene: 'village', x: S.village.ox + 13, y: 3, w: 8, h: 6, approach: P('village', 15, 9),
      look: '현관 앞에 화분이 놓여 있다. 안에서 텔레비전 소리가 작게 들린다.' }
  ];
  NEIGHBORS.forEach(function (n) { OBJECTS.push({ id: n.id, name: n.name, x: n.x, y: n.y, w: n.w, h: n.h, look: n.look, wall: true }); });

  var SPAWNS = {
    classroom: P('classroom', 15, 15, 'down'), // 하교: 교실 뒷문 쪽
    gate: P('yard', 15, 15, 'up'),             // 등교: 교문 안쪽
    home: P('room', 10, 12, 'down'),           // 내 방 침대 옆(아침에 일어난 자리)
    road: P('village', 12, 10, 'right'),       // 마을 길 가운데
    hall: P('yard', 7, 6, 'down'),             // 현관 앞
    yard: P('yard', 14, 13, 'right')           // 마당 축제 부스 옆
  };

  /* ── 사건 트리거 ─────────────────── */
  var classmates = [
    who('saebom', 'classroom', 12, 8, 'down'), who('haneul', 'classroom', 19, 9, 'left'),
    who('jiho', 'classroom', 26, 11, 'up'), who('minjun', 'classroom', 29, 11, 'up')
  ];
  var schoolDay = function (extra) { return classmates.filter(function (c) { return !extra || extra.indexOf(c.who) < 0; }); };
  var TRIGGERS = {
    // 등교 오프닝: 내 방에서 일어나 교실까지 걷는다. 길에서 만난 친구는 castLines로 자기소개(지나가면 저절로 한 번), 교실에서 새봄이가 반 친구를 소개한다.
    pro_1: { time: 'D-4 · 아침', mission: '학교 가기 — 2학년 3반 교실까지', target: { npc: 'saebom' }, spawn: 'home', tint: 'day',
      hint: '방향키·WASD 또는 화면을 눌러 걸어요',
      cast: [who('saebom', 'classroom', 12, 8, 'down'), who('minjun', 'classroom', 29, 11, 'up'),
        who('haneul', 'yard', 17, 11, 'left'), who('jiho', 'yard', 11, 6, 'down')],
      castLines: {
        haneul: '어, 왔냐? 이번 축제 때 사진 진짜 많이 찍자 ㅋㅋ 다 올려야지!',
        jiho: '안녕… 나 꾸미기 담당이야. 반짝이 스티커 잔뜩 사 왔어.'
      },
      greet: [
        { who: 'saebom', text: '왔구나! 오늘 방과 후부터 축제 준비 시작이야.' },
        { who: 'saebom', text: '나는 정산이랑 역할표 담당. 공지는 단톡방에 올릴 테니까 꼭 확인해 줘.' },
        { who: 'saebom', text: '여기 민준이는 소품 담당이야. 손재주가 진짜 좋아.' },
        { who: 'minjun', text: '…안녕. 소품은 거의 다 돼 가.' },
        { who: 'saebom', text: '오는 길에 하늘이랑 지호도 봤지? 우리 반 다 같이 잘해 보자!' }
      ] },
    c1_e1_a: { time: 'D-4 · 하교', mission: '집에 가기 — 마을 길 끝 우리 집, 내 방 침대', target: { obj: 'bed' }, spawn: 'classroom', tint: 'evening',
      cast: [who('saebom', 'classroom', 12, 8, 'down'), who('haneul', 'classroom', 19, 9, 'left')],
      greet: '저녁을 먹고 침대에 눕자 휴대폰이 울렸다.' },
    c1_e2_a: { time: 'D-3 · 방과 후', mission: '교실에서 엎드려 자는 민준이 살펴보기', target: { npc: 'minjun' }, spawn: 'gate', tint: 'day',
      cast: [who('minjun', 'classroom', 29, 11, 'up', { pose: 'sleep' }), who('haneul', 'classroom', 27, 12, 'right'),
        who('saebom', 'classroom', 12, 8, 'down'), who('jiho', 'classroom', 10, 9, 'down')] },
    c1_e3_a: { time: 'D-2 · 하교 시간', mission: '집에 가서 쉬기 — 교문을 지나 마을 길 끝 우리 집으로', target: { obj: 'bed' }, spawn: 'classroom', tint: 'evening',
      cast: [who('saebom', 'classroom', 20, 8, 'down'), who('haneul', 'yard', 19, 8, 'down'), who('minjun', 'yard', 11, 14, 'up')],
      enterLine: '하루 종일 부스를 꾸몄더니 피곤하다. 침대에 눕자 휴대폰이 울렸다.' },
    c2_e4_a: { time: 'D-1 · 오후', mission: '매점 앞에서 손짓하는 하늘이에게 가기', target: { npc: 'haneul' }, spawn: 'gate', tint: 'day',
      cast: [who('haneul', 'yard', 19, 14, 'left'), who('jiho', 'yard', 8, 14, 'up'),
        who('minjun', 'yard', 11, 14, 'up'), who('saebom', 'classroom', 12, 8, 'down')] },
    c2_e5_a: { time: 'D-1 · 저녁', mission: '집에 가서 부스 안내문 쓰기 — 내 방 컴퓨터', target: { obj: 'mypc' }, spawn: 'road', tint: 'night',
      cast: [who('jiho', 'yard', 8, 14, 'up'), who('minjun', 'yard', 11, 14, 'up')] },
    c2_e6_a: { time: '축제 당일 · 아침', mission: '도서관 공용 PC 3번에서 안내문 출력하기', target: { obj: 'pc3' }, spawn: 'gate', tint: 'day',
      cast: [who('friend', 'library', 23, 8, 'right'), who('saebom', 'yard', 8, 14, 'up'), who('jiho', 'yard', 9, 14, 'up')] },
    c3_e7_a: { time: '축제 당일 · 오후', mission: '마당 부스 옆 하늘이네에게 가기', target: { npc: 'haneul' }, spawn: 'hall', tint: 'day',
      cast: [who('haneul', 'yard', 15, 13, 'left'), who('friend', 'yard', 16, 13, 'left'),
        who('minjun', 'classroom', 29, 11, 'up'), who('saebom', 'yard', 8, 14, 'up'), who('jiho', 'yard', 11, 14, 'up')] },
    c3_e8_a: { time: '축제 당일 · 저녁', mission: '집에 가서 쉬기 — 내 방 컴퓨터', target: { obj: 'mypc' }, spawn: 'yard', tint: 'evening',
      cast: [who('haneul', 'yard', 15, 13, 'left'), who('teacher', 'yard', 16, 8, 'down')],
      castLines: { teacher: '고생 많았어. 이제 집에 가서 푹 쉬렴.' } }, // 축제가 끝난 저녁
    c3_e9_a: { time: '축제 다음 날 · 오전', mission: '교실 내 자리에 앉기', target: { obj: 'desk8' }, spawn: 'gate', tint: 'day',
      greet: '자리에 앉자 휴대폰 알림이 연달아 울렸다.',
      skipIf: 'e8_confrontation=fight', // 싸움 경로는 이미 다음 날 교실·상담실 장면을 거쳤다 → 걷기 생략
      cast: schoolDay() },
    ep_1: { time: '다음 주 월요일', mission: '교실에서 담임 선생님께 가기', target: { npc: 'teacher' }, spawn: 'gate', tint: 'day',
      cast: [who('teacher', 'classroom', 17, 7, 'down')].concat(schoolDay()) }
  };

  /* ── 장면 무대 ─────────────────────
   * 모든 장면은 맵 위 한 장소에서 벌어진다. 폰·모니터는 그 장소 위에 떠오른다.
   *   STAGES[장면 id] = { place, tint, cast:[{who,x,y,dir,pose?}], me?:{x,y,dir}, device?, card?, bubbles?:[{on,who,text}] }
   *   - device 생략: view.type으로 정함(group·dm·sns → phone, pc·ai → monitor, place → none)
   *   - card: 앞 장면과 장소가 바뀔 때 잠깐 띄우는 문구
   *   - bubbles: 장면의 한 줄(on = 그 줄에 들어 있는 글자)이 나타날 때 who 머리 위에 text
   *   - 폰 장면에서 같은 공간 친구가 보낸 메시지는 원문 대신 '📱…'만 머리 위에 뜬다(개인톡을 소리 내 말한 것처럼 보이지 않게)
   */
  var PLACES = {
    classroom: { name: '2학년 3반 교실', me: P('classroom', 15, 12, 'up') },
    room: { name: '내 방', me: P('room', 12, 12, 'down') },
    road: { name: '마을 길', me: P('village', 12, 10, 'right') },
    gate: { name: '교문', me: P('yard', 15, 15, 'up') },
    store: { name: '매점 앞', me: P('yard', 18, 14, 'right') },
    library: { name: '도서관', me: P('library', 26, 7, 'up') },
    hall: { name: '현관 앞', me: P('yard', 7, 7, 'right') }, // 복도는 없앴다(설계 결정) — 현관 앞에서
    booth: { name: '마당 축제 부스', me: P('yard', 14, 13, 'right') }
  };
  function only(list, whos) { return list.filter(function (c) { return whos.indexOf(c.who) >= 0; }); }
  var ATDESK = P('room', 25, 10, 'up'); // 내 방 책상 컴퓨터 앞
  var BOOTH = [who('haneul', 'yard', 15, 13, 'left'), who('friend', 'yard', 16, 13, 'left'),
    who('saebom', 'yard', 8, 14, 'up'), who('jiho', 'yard', 11, 14, 'up')];

  var STAGES = {
    // 첫 단톡방: 새봄·하늘·지호·민준이 모두 주인공 둘레에(확대 무대에서 한 화면에 보이게 — 2026-11-01 사용자)
    pro_1: { place: 'classroom', tint: 'day', card: '방과 후 · 오후 5:30 — 축제 준비 중', me: P('classroom', 15, 10, 'up'),
      cast: [who('saebom', 'classroom', 12, 8, 'down'), who('haneul', 'classroom', 18, 9, 'left'), who('jiho', 'classroom', 11, 11, 'right'), who('minjun', 'classroom', 19, 11, 'left')],
      bubbles: [{ on: '다 올린다', who: 'jiho', text: '…' }, { on: '넌 뭐 할래', who: 'saebom', text: '👀' }] },
    c1_e1_a: { place: 'room', tint: 'evening', cast: [] },
    c1_e1_b: { place: 'room', tint: 'evening', cast: [] },
    c1_e2_a: { place: 'classroom', tint: 'day', me: P('classroom', 30, 12, 'left'),
      cast: [who('minjun', 'classroom', 29, 11, 'up', { pose: 'sleep' }), who('haneul', 'classroom', 27, 12, 'right'),
        who('saebom', 'classroom', 12, 8, 'down'), who('jiho', 'classroom', 10, 9, 'down')] },
    c1_e2_b: { place: 'room', tint: 'night', card: '그날 밤 · 내 방', cast: [] },
    c1_e2_d: { place: 'road', tint: 'day', card: 'D-2 아침 · 등굣길', cast: [] },
    c1_e3_a: { place: 'room', tint: 'night', cast: [] },
    c1_e3_b: { place: 'gate', tint: 'day', card: 'D-1 아침 · 교문 앞', cast: [who('saebom', 'yard', 16, 14, 'left')] },
    c1_e3_ask: { place: 'classroom', tint: 'day', card: 'D-1 · 교실', cast: only(classmates, ['saebom', 'jiho']),
      bubbles: [{ on: '고마워. 내가 정한 만큼만', who: 'jiho', text: '🙂' }] },
    c1_e3_anon: { place: 'classroom', tint: 'day', card: 'D-1 · 교실', cast: only(classmates, ['saebom', 'jiho', 'haneul']),
      bubbles: [{ on: '역할 바꿨어', who: 'jiho', text: '😌' }] },
    c1_e3_cap: { place: 'classroom', tint: 'day', card: 'D-1 점심 · 교실', cast: only(classmates, ['saebom', 'jiho', 'haneul']),
      bubbles: [{ on: '…화나. 아무한테도', who: 'jiho', text: '💢' }] },
    c2_e4_a: { place: 'store', tint: 'evening', cast: [who('haneul', 'yard', 19, 14, 'left')],
      bubbles: [{ on: '누가 만든 거래', who: 'haneul', text: '이거 봐 ㅋㅋ' }, { on: '나 보낸 거 지울게', who: 'haneul', text: '…' }] },
    c2_e4_b: { place: 'road', tint: 'evening', card: '그날 저녁 · 집에 가는 길', cast: [] },
    c2_e5_a: { place: 'room', tint: 'night', me: ATDESK, pcOn: true, cast: [] },
    c2_e5_b: { place: 'room', tint: 'night', me: ATDESK, pcOn: true, cast: [] },
    c2_e6_a: { place: 'library', tint: 'day', cast: [who('friend', 'library', 23, 8, 'right')] },
    c2_e6_b: { place: 'library', tint: 'day', cast: [who('friend', 'library', 23, 8, 'right')] },
    c2_e6_c: { place: 'hall', tint: 'day', card: '1교시 뒤 · 현관 앞', cast: [who('haneul', 'yard', 8, 7, 'left')],
      bubbles: [{ on: '아까 진짜 고마웠어', who: 'haneul', text: '🙏' }, { on: '다음부터는 진짜 그러지 마라', who: 'haneul', text: '😠' }] },
    c3_e7_a: { place: 'booth', tint: 'day', cast: BOOTH,
      bubbles: [{ on: '해 해', who: 'friend', text: 'ㅋㅋㅋ' }, { on: '다음은 내 차례다', who: 'haneul', text: '👀' }] },
    c3_e7_small: { place: 'booth', tint: 'day', card: '그날 오후 · 마당', cast: only(BOOTH, ['haneul']) }, // 민준이 개인톡(민준이는 이 자리에 없다)
    c3_e7_b: { place: 'booth', tint: 'day', card: '그날 오후 · 마당', cast: only(BOOTH, ['haneul']) },
    c3_e8_a: { place: 'room', tint: 'evening', me: ATDESK, pcOn: true, device: 'monitor', cast: [] },
    c3_e8_b: { place: 'room', tint: 'night', cast: [] },
    // 사건 8 현장 「렌즈 안에 갇힌 밤」: CG가 무대를 덮는다(장소는 CG 뒤 배경·컷 카드용)
    c3_e8_c: { place: 'gate', tint: 'night', card: '렌즈 안에 갇힌 밤 — 저녁 9:00 · 학교 정문 앞', cast: [] },
    c3_e8_d: { place: 'gate', tint: 'night', cast: [] },
    c3_e8_e: { place: 'room', tint: 'night', card: '그날 밤 · 내 방', cast: [] },
    c3_e8_f: { place: 'classroom', tint: 'day', card: '축제 다음 날 · 아침', cast: classmates },
    c3_e8_g: { place: 'classroom', tint: 'day', cast: classmates },
    c3_e8_i: { place: 'classroom', tint: 'day', cast: classmates },
    c3_e8_h: { place: 'classroom', tint: 'day', card: '상담실', cast: [] },
    c3_e9_a: { place: 'classroom', tint: 'day', cast: classmates,
      bubbles: [{ on: '다들 퍼 가 주세요', who: 'jiho', text: '…!' }, { on: '당하고만 있으면 안 돼', who: 'saebom', text: '😤' }] },
    c3_e9_b: { place: 'classroom', tint: 'day', card: '점심시간 · 교실', cast: only(classmates, ['saebom', 'jiho']),
      bubbles: [{ on: '그냥 넘어가면 억울한데', who: 'saebom', text: '😣' }] },
    ep_1: { place: 'classroom', tint: 'day', me: P('classroom', 16, 9, 'up'),
      cast: [who('teacher', 'classroom', 17, 7, 'down')].concat(classmates) }
  };

  /* ── ❗가 아닌 인물에게 말 걸 때 ─────── */
  var IDLE = {
    saebom: [
      { if: 'e9b=calm|del', text: '그때 말려 줘서… 고마워.' },
      { if: 'e4b=blame', text: '…괜찮아. 신경 쓰지 마.' },
      { if: 'trust.saebom>=1', text: '요즘 네 덕분에 든든해.' },
      { if: 'e4', text: '합성 사진… 아직도 돌고 있는 것 같아.' },
      { text: '역할표 아직 정리 중이야!' }
    ],
    haneul: [
      { if: 'e6=logout', text: '그때 로그아웃해 준 거 진짜 고마웠다.' },
      { if: 'e6=post|leave', text: '내 계정에 이상한 거 올린 사람 아직도 못 찾았어 ㅡㅡ' },
      { if: 'trust.haneul<0', text: '…뭐.' },
      { text: '축제 때 사진 많이 찍자 ㅋㅋ' }
    ],
    jiho: [
      { if: 'trust.jiho<0', text: '(지호는 대답 없이 고개를 돌렸다.)' },
      { if: 'trust.jiho>=1', text: '꾸미기 재료 같이 고를래?' },
      { text: '반짝이 스티커 더 사야 해.' }
    ],
    minjun: [
      { if: 'trust.minjun<0', text: '(민준이는 눈을 피했다.)' },
      { if: 'trust.minjun>=1', text: '…고마웠어. 그때.' },
      { text: '…소품 거의 다 됐어.' }
    ],
    teacher: [{ text: '준비 잘 되어 가니? 무슨 일 있으면 언제든 말해.' }],
    friend: [{ text: '너 몇 반이야? 우리 반 부스도 놀러 와~' }]
  };

  /* ── 길찾기 ─────────────────────── */
  function tile(xx, yy) { return xx < 0 || yy < 0 || xx >= W || yy >= H ? '#' : grid[yy][xx]; }
  function objectAt(xx, yy) {
    for (var i = 0; i < OBJECTS.length; i++) {
      var o = OBJECTS[i];
      if (!o.wall && xx >= o.x && xx < o.x + o.w && yy >= o.y && yy < o.y + o.h) return o;
    }
    return null;
  }
  // blocked: 'x,y' → true (인물 등 추가로 막힌 칸)
  function walkable(xx, yy, blocked) {
    var t = TILES[tile(xx, yy)];
    if (!t || !t.walk) return false;
    if (objectAt(xx, yy)) return false;
    return !(blocked && blocked[xx + ',' + yy]);
  }
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  function stepFrom(xx, yy, dir, blocked) {
    var d = DIRS[dir], nx = xx + d[0], ny = yy + d[1];
    if (!walkable(nx, ny, blocked)) return null;
    var door = DOORS[nx + ',' + ny];
    return door ? { x: door.to[0], y: door.to[1], door: true, dir: door.dir } : { x: nx, y: ny };
  }
  // from에서 goal(x,y)→true 인 칸까지 방향 목록(문 이동 포함). 못 가면 null
  function findPath(from, goal, blocked) {
    var key = function (p) { return p.x + ',' + p.y; };
    var prev = {}, q = [from], seen = {};
    seen[key(from)] = true;
    while (q.length) {
      var cur = q.shift();
      if (goal(cur.x, cur.y)) {
        var dirs = [], k = key(cur);
        while (prev[k]) { dirs.unshift(prev[k].dir); k = prev[k].from; }
        return dirs;
      }
      for (var d in DIRS) {
        var n = stepFrom(cur.x, cur.y, d, blocked);
        if (!n || seen[key(n)]) continue;
        seen[key(n)] = true;
        prev[key(n)] = { from: key(cur), dir: d };
        q.push({ x: n.x, y: n.y });
      }
    }
    return null;
  }
  // 대상(인물 칸 또는 사물 footprint)에 붙어 설 수 있는 칸인가
  function adjacentTo(target) {
    return function (xx, yy) {
      for (var d in DIRS) {
        var nx = xx + DIRS[d][0], ny = yy + DIRS[d][1];
        if (target.contains(nx, ny)) return true;
      }
      return false;
    };
  }
  function nearestWalkable(xx, yy, blocked) {
    for (var r = 0; r <= Math.max(W, H); r++) {
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) + Math.abs(dy) !== r) continue;
        if (walkable(xx + dx, yy + dy, blocked)) return { x: xx + dx, y: yy + dy };
      }
    }
    return null;
  }
  // 조사 문구: 날마다 바뀌는 사물(looks: { 'D-4': …, '축제 당일': … })은 걷기 구간 time('D-1 · 오후')의 날 부분으로 고른다
  function lookFor(o, time) {
    if (!o) return '';
    var day = String(time || '').split(' · ')[0];
    return (o.looks && o.looks[day]) || o.look || o.name;
  }
  var WORLD = {
    W: W, H: H, VERSION: VERSION, lookFor: lookFor, SW: SW, SH: SH, CELL: CELL, SCENES: SCENES, sceneAt: sceneAt, grid: grid,
    TILES: TILES, DOORS: DOORS, OBJECTS: OBJECTS, SPAWNS: SPAWNS,
    triggers: TRIGGERS, idle: IDLE, DIRS: DIRS, PLACES: PLACES, STAGES: STAGES,
    tile: tile, objectAt: objectAt, walkable: walkable, stepFrom: stepFrom,
    findPath: findPath, adjacentTo: adjacentTo, areaName: areaName, nearestWalkable: nearestWalkable, NEIGHBORS: NEIGHBORS,
    object: function (id) { return OBJECTS.filter(function (o) { return o.id === id; })[0]; }
  };
  root.PRIVACY_WORLD = WORLD;
  if (typeof module !== 'undefined' && module.exports) module.exports = WORLD;
})(typeof window !== 'undefined' ? window : globalThis);

