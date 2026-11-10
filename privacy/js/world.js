/*
 * 「공유한 순간」 맵 데이터 + 길찾기(순수 로직, 브라우저·Node 겸용)
 * ------------------------------------------------------------
 * 2026-10-31 맵 개편(docs/specs/2026-10-31-scene-map-design.md): 타일맵 → **장면 그림 5장**.
 *   장면 = 그림 1장(논리 1280×720)을 40px 칸 32×18로 나눈 방. 장면 5개를 가로로 이어 붙인 한 격자(160×18)에서 걷고,
 *   장면 사이는 출입구 칸(DOORS)을 밟으면 건너편 장면의 도착 칸으로 옮겨진다(길찾기도 이 문을 따라 장면을 넘는다).
 *   교실(0~31) · 도서관(32~63) · 학교 마당(64~95) · 마을 길(96~127) · 우리 집(내 방 + 거실·현관, 128~159)
 *   그림의 가구·문은 그림 그대로 — 여기선 막힌 칸(BLOCK 사각형)과 조사 지점(OBJECTS)만 정한다.
 * 좌표는 칸 단위(x: 왼→오, y: 위→아래, 장면 안 좌표 + 장면 시작 x). 그림은 map.js가 그린다.
 * 2026-11-03 플레이테스트: SCENES[].bg = { x, y, w, h }(칸)가 있으면 그림을 그 사각형에만 줄여 그린다(없으면 지금처럼 장면 전체).
 *   바깥은 bgOuter 그림, 없으면 map.js가 단색 바닥 + 칸 윤곽으로 채운다. 교실(classroom.png)도 책상 높이가 캐릭터 키만 해서 같은 방식 적용 가능(이번엔 안 함).
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

  var VERSION = 4; // 지도 좌표 판(저장된 맵 위치가 이 판과 다르면 버리고 장면 시작점에서 다시). 2026-11-03 플레이테스트: 내 방을 줄이고 현관을 옮겨 4로
  var SW = 32, SH = 18, CELL = 40; // 장면 하나 = 32×18칸, 칸 = 논리 40px(1280×720)
  var BG = '../shared/ethicity-elementary-common-v1/backgrounds/';
  // 2026-11-03 플레이테스트: 내 방 그림은 캐릭터(키 2.24칸)보다 가구가 2.5~3배 커서 0.55배로 줄여 장면 왼쪽 위에만 그린다(나머지는 거실·현관).
  //   그림 좌표(32×18칸 기준)를 장면 칸으로 옮기는 일은 손으로 하지 않고 아래 두 함수로만 한다 — 그림 배율을 바꾸면 ROOM_BG만 고치면 된다.
  var ROOM_BG = { x: 1, y: 2, w: 17.6, h: 9.9 };
  function scaleRect(r, bg) {
    var kx = bg.w / SW, ky = bg.h / SH;
    var x0 = Math.round(bg.x + r[0] * kx), y0 = Math.round(bg.y + r[1] * ky);
    var x1 = Math.round(bg.x + (r[0] + r[2]) * kx), y1 = Math.round(bg.y + (r[1] + r[3]) * ky);
    return [x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)];
  }
  function scalePoint(x, y, bg) { return [Math.round(bg.x + x * bg.w / SW), Math.round(bg.y + y * bg.h / SH)]; }
  function rr(r) { return scaleRect(r, ROOM_BG); }
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
      [20, 11, 4, 3],                                                             // 매점(창구는 아래 14줄을 봄)
      [3, 14, 4, 2], [25, 14, 4, 2], [1, 13, 2, 3], [28, 13, 2, 3],               // 벤치·꽃밭
      [0, 15, 14, 3], [18, 15, 14, 3]                                             // 아래 덤불·교문 기둥(가운데 길만 열림)
    ], open: [[6, 4], [7, 4], [8, 4], [25, 4], [26, 4], [27, 4], [15, 1], [16, 1], [17, 1], [15, 2], [16, 2], [17, 2], [15, 3], [16, 3], [17, 3], [15, 4], [16, 4], [17, 4]] },
    { id: 'village', name: '마을 길', img: 'assets/scenes/village.png', road: true },
    // 우리 집(2026-11-03 플레이테스트): 그림(내 방)은 bg 사각형 안에만. 방문 = 그림 아래 매트 밑 (9~10,12) 두 칸, 그 아래·오른쪽이 거실, 현관 = 오른쪽 아래 (24~27,17)
    //   tools/room-compose.mjs: room-base.png + 판다 축소 + 공통 팩 코르크보드.
    //   바깥(거실·식탁·복도·현관) = bgOuter house.png(2026-11-09, tools/house-art.mjs — 배치 밑그림을 fal nano-banana-pro로 칠함). 아래 거실 칸은 그 그림에 맞춘 것.
    //   house.png를 못 불러오면 map.js drawOuter가 단색 + box 칸(식탁·소파)으로 대신 그린다.
    { id: 'room', name: '내 방', img: 'assets/scenes/room.png', bg: ROOM_BG, bgOuter: 'assets/scenes/house.png',
      lamp: { x: ROOM_BG.x + 25.5 * 0.55, y: ROOM_BG.y + 5.8 * 0.55, r: 9 * 0.55 }, // lamp: 밤에 켜 둔 책상 불빛(map.js sceneLight, 장면 안 칸 좌표)
      rects: [
      rr([0, 0, 32, 7]), rr([0, 7, 3, 5]), rr([0, 12, 2, 3]), rr([0, 15, 1, 3]), // 그림 속 벽(왼쪽은 원근으로 기울어 칸마다 다름)
      rr([2, 4, 7, 8]),                      // 침대
      rr([22, 5, 7, 5]),                     // 컴퓨터 책상·의자
      rr([28, 6, 3, 6]),                     // 책꽂이
      rr([27.5, 14.2, 3.5, 3.6]),            // 판다 인형(tools/room-compose.mjs가 줄인 자리)
      [7, 6, 2, 1],                          // 코르크보드 받침
      [0, 0, 32, 2], [0, 0, 1, 18], [31, 0, 1, 18], // 집 바깥 벽
      [18, 2, 2, 11],                        // 내 방 ↔ 거실 벽
      [20, 2, 11, 3],                        // 거실 위쪽 벽
      [0, 12, 9, 1], [11, 12, 9, 1],         // 내 방 아래 벽(방문 = (9~10,12) 두 칸, 2026-11-09 그림의 문 폭·매트에 맞춤)
      [20, 5, 4, 2],                         // 소파(뒷벽에 붙어 정면)
      [21, 7, 2, 2],                         // 러그 위 낮은 탁자
      [25, 6, 5, 4],                         // 식탁 + 의자 4
      [29, 5, 2, 2],                         // 냉장고
      [20, 10, 1, 2], [30, 10, 1, 2],        // 화분 둘
      [1, 13, 4, 1],                         // 복도 왼쪽 끝 화분·낮은 수납장
      [20, 15, 2, 2],                        // 택배 상자
      [29, 12, 2, 5],                        // 신발장
      [0, 17, 24, 1], [28, 17, 4, 1]         // 아래 벽(현관만 열림)
    ] },
    // 특별실(AI 실습실, 2026-11-10 특별 수업): 공통 팩 ai_lab.png 그대로. 평소엔 갈 수 없다 — 특별 수업 걷기(TRIGGERS.sc_1.warp)에서만 마당→교실 문이 이리로.
    //   맨 끝에 붙여 기존 장면 좌표(ox)가 그대로 → 지도 판 VERSION 그대로. 나가는 문 = 아래 가운데 문간 → 마당 현관 앞
    { id: 'ai_lab', name: 'AI 실습실', img: BG + 'ai_lab.png', rects: [
      [0, 0, 32, 5],                          // 위 벽·책장·칠판·서버장
      [14, 5, 4, 1], [24, 5, 5, 1], [21, 5, 3, 1], // 받침대 위 AI 앞쪽·서버장·서랍장 아랫단
      [0, 0, 2, 11], [31, 0, 1, 18],          // 왼쪽 창 벽·오른쪽 벽
      [2, 5, 4, 6],                           // 왼쪽 컴퓨터 책상·의자
      [26, 6, 5, 6],                          // 오른쪽 컴퓨터 책상·의자
      [0, 11, 3, 5], [29, 11, 2, 5],          // 왼쪽·오른쪽 아래 책장
      [4, 12, 7, 4],                          // 왼쪽 아래 탁자·의자
      [25, 14, 4, 2],                         // 오른쪽 아래 낮은 수납장
      [0, 16, 14, 2], [19, 16, 13, 2], [12, 15, 2, 1], [19, 15, 2, 1] // 아래 벽·문 기둥(가운데 문간 14~18만 열림)
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
    '#################.#........#####', // 14 벤치(16)·가로등 기둥(18)·고양이(27)
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
  // say: 건너편에 도착했을 때 무대 위에 잠깐 뜨는 한 줄(map.js finishStep, 2026-11-02 — 예전엔 '집 안으로' 말고는 모두 '밖으로 나왔다.')
  function door(cells, scene, to, dir, label, say) { cells.forEach(function (c) { DOORS[(S[c[0]].ox + c[1]) + ',' + c[2]] = { to: [S[scene].ox + to[0], to[1]], dir: dir, label: label, scene: scene, say: say }; }); }
  door([['classroom', 15, 17], ['classroom', 16, 17]], 'yard', [7, 5], 'down', '마당으로', '마당으로 나왔다.');
  door([['yard', 6, 4], ['yard', 7, 4], ['yard', 8, 4]], 'classroom', [15, 16], 'up', '교실로', '교실에 들어왔다.');
  door([['library', 14, 17], ['library', 15, 17], ['library', 16, 17], ['library', 17, 17]], 'yard', [26, 5], 'down', '마당으로', '마당으로 나왔다.');
  door([['yard', 25, 4], ['yard', 26, 4], ['yard', 27, 4]], 'library', [15, 16], 'up', '도서관으로', '도서관에 들어왔다.');
  door([['yard', 14, 17], ['yard', 15, 17], ['yard', 16, 17], ['yard', 17, 17]], 'village', [1, 6], 'right', '교문 밖으로', '교문 밖으로 나왔다.');
  door([['village', 0, 5], ['village', 0, 6]], 'yard', [15, 16], 'up', '학교로', '학교에 도착했다.'); // 그림의 길이 왼쪽 끝에서 들어오는 자리(그 아래는 나무)
  door([['village', 24, 11], ['village', 25, 11]], 'room', [25, 16], 'up', '집 안으로', '우리 집에 들어왔다.'); // 2026-11-03 플레이테스트: 도착 칸 = 현관 안쪽(거실 쪽)
  door([['room', 24, 17], ['room', 25, 17], ['room', 26, 17], ['room', 27, 17]], 'village', [24, 12], 'down', '밖으로', '밖으로 나왔다.');
  door([['ai_lab', 14, 17], ['ai_lab', 15, 17], ['ai_lab', 16, 17], ['ai_lab', 17, 17], ['ai_lab', 18, 17]], 'yard', [7, 5], 'down', '마당으로', '마당으로 나왔다.'); // 특별실 → 마당(2026-11-10)
  /* 걷기 구간 워프(2026-11-10 특별 수업, 사용자 결정): 그 걷기에서만 어떤 장면으로 가는 문을 다른 칸으로 보낸다.
   *   trig.warp = { from: 도착 장면 id, to: [전역 x, y], say } — 예: 마당→교실 문이 특별실로. map.js가 걷기 시작마다 setWarp(trig.warp 또는 null)
   *   doorTarget(door, trig) = 그 걷기에서 실제 도착(검사·길찾기용, 바꾸지 않음) · setWarp = DOORS 항목을 잠시 바꾸고 null이면 되돌린다 */
  function doorTarget(d, trig) {
    var w = trig && trig.warp;
    return w && d.scene === w.from ? { to: w.to.slice(), dir: d.dir, label: d.label, scene: sceneAt(w.to[0]).id, say: w.say } : d;
  }
  var warped = [];
  function setWarp(w) {
    warped.forEach(function (o) { DOORS[o.k] = o.d; }); warped = [];
    if (!w) return;
    Object.keys(DOORS).forEach(function (k) { var d = DOORS[k]; if (d.scene === w.from) { warped.push({ k: k, d: d }); DOORS[k] = doorTarget(d, { warp: w }); } });
  } // 2026-11-03 플레이테스트: 현관을 거실 쪽으로(옛 자리 14~17,17은 내 방 아래)

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
    if (s.id === 'room') { // 2026-11-03 플레이테스트: 방문 밖은 거실·현관
      var rx = xx - s.ox;
      if (yy >= 15 && rx >= 22) return '현관';
      if (rx >= 19 || yy >= 13) return '거실';
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
  function pt(x, y) { return { x: S.room.ox + ROOM_BG.x + x * ROOM_BG.w / SW, y: ROOM_BG.y + y * ROOM_BG.h / SH }; } // 내 방 그림 칸 → 전체 칸(반올림 없음)
  function rob(id, name, r, look, extra) { var q = rr(r); return ob(id, name, 'room', q[0], q[1], q[2], q[3], look, extra); } // 내 방 그림 칸 기준 조사 지점
  function rp(x, y, dir) { var q = scalePoint(x, y, ROOM_BG); return P('room', q[0], q[1], dir); } // 내 방 그림 칸 기준 서는 자리
  var OBJECTS = [
    ob('board', '칠판', 'classroom', 10, 4, 12, 1, '칠판: “축제 D-day · 2학년 3반 레트로 사진관 📸”', { wall: true }),
    ob('tdesk', '교탁', 'classroom', 14, 4, 4, 3, '교탁 위에 출석부와 분필이 놓여 있다.'),
    ob('tdesk2', '선생님 책상', 'classroom', 2, 5, 7, 3, '담임 선생님 책상. 축제 부스 배치도가 펼쳐져 있다. 우리 반은 마당 왼쪽 천막이다.'),
    ob('desk7', '민준이 책상', 'classroom', 28, 10, 3, 1, '민준이 책상. 만들다 만 소품이 가지런히 놓여 있다.'),
    // 2026-11-10 사용자 피드백: 기본 자리(책상 윗줄 위)는 바로 앞에 앉은 지호 이름표 옆이라 지호 자리처럼 보였다 → 핀 = 내가 앉을 의자 위
    ob('desk8', '내 책상', 'classroom', 25, 13, 3, 1, '내 책상. 축제 소품 상자가 올려져 있다.', { pin: P('classroom', 26.5, 14.35) }),
    ob('shelf', '전시 책장', 'library', 13, 4, 6, 1, '‘개인정보, 어디까지 괜찮을까?’라는 책이 앞에 놓여 있다.', { wall: true }),
    ob('libdesk', '대출 데스크', 'library', 2, 4, 8, 4, '사서 선생님 자리. 지금은 비어 있다.'),
    ob('pc3', '공용 PC 3번', 'library', 24, 3, 5, 4, '공용 PC 3번. 검색과 출력용이다.', { label: '3' }),
    ob('notice', '게시판', 'yard', 18, 1, 3, 4, '게시판: 솔빛축제 부스 배치도와 일정표가 붙어 있다.', { wall: true }),
    ob('tent1', '레트로 사진관 천막', 'yard', 6, 10, 4, 4, '우리 반 부스 ‘레트로 사진관’. 1컷 500원.'),
    ob('tent2', '옆 반 천막', 'yard', 10, 10, 4, 4, '옆 반 부스. 솜사탕 냄새가 난다.'),
    ob('store', '학교 매점', 'yard', 20, 11, 4, 3, '매점. 오늘은 컵떡볶이가 제일 잘 팔린다.', {
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
    // 내 방(2026-11-03 플레이테스트): 좌표는 그림 칸 → rob()가 장면 칸으로. pin = 목적지 핀 기준점(칸, 없으면 윗변 위) — 침대 핀이 머리판 위 벽에 떠 있어 매트리스 가운데로
    rob('bed', '침대', [2, 4, 7, 8], '내 침대. 아직 잘 시간은 아니다.', { pin: pt(5.55, 9) }),
    rob('mypc', '내 책상 컴퓨터', [22, 5, 7, 5], '내 책상과 컴퓨터.'),
    rob('mybook', '책꽂이', [28, 6, 3, 6], '교과서와 만화책이 섞여 꽂혀 있다.'),
    rob('plush', '큰 팬더 인형', [27.5, 14.2, 3.5, 3.6], '구석에 앉은 커다란 팬더 인형. 푹신한 배에 기대면 잠이 올 것 같다.'),
    ob('corkboard', '코르크보드', 'room', 7, 5, 2, 2, '코르크보드. 축제 일정 메모 옆에 반 친구들과 찍은 사진이 꽂혀 있다. 그땐 누가 어떻게 나왔는지 아무도 신경 쓰지 않았다.'),
    // 그림이 아직 없는 장식(2026-11-03 플레이테스트): 공통 팩에 없어 조사 문구만 넣고 그림 자리는 비워 둠 — wall:true라 막지 않는다(보이지 않는 벽이 되지 않게)
    ob('phone', '협탁 위 휴대폰', 'room', 6, 6, 1, 1, '충전 중인 휴대폰. 단톡방 알림이 99+다.', { wall: true }),
    ob('propbox', '축제 소품 상자', 'room', 11, 6, 2, 1, '축제 소품 상자. 사진관에 쓸 액자와 필름카메라 모형이 들어 있다.', { wall: true }),
    ob('schoolbag', '의자에 걸린 책가방', 'room', 14, 8, 1, 1, '의자에 걸어 둔 책가방. 축제 준비물 쪽지가 삐져나와 있다.', { wall: true }),
    ob('closet', '옷장과 전신거울', 'room', 2, 9, 1, 2, '옷장과 전신거울. 거울 속의 나는 오늘도 교복 차림이다.', { wall: true }),
    ob('cushion', '바닥 쿠션', 'room', 11, 9, 1, 1, '러그 위 바닥 쿠션. 여기 앉아 휴대폰을 보다 보면 시간이 금방 간다.', { wall: true }),
    ob('moodlamp', '무드등', 'room', 16, 9, 1, 1, '작은 무드등. 밤에는 이 불빛만 켜 둘 때가 많다.', { wall: true }),
    // 거실·현관(2026-11-09 house.png). box = 그림을 못 불러올 때 map.js가 칠하는 색
    ob('dtable', '식탁', 'room', 25, 6, 5, 4, '식탁. 엄마가 남겨 둔 반찬에 랩이 씌워져 있다.', { box: 'table' }),
    ob('sofa', '소파', 'room', 20, 5, 4, 2, '소파. 리모컨은 앞 탁자 위에 놓여 있다.', { box: 'sofa' }),
    ob('fridge', '냉장고', 'room', 29, 5, 2, 2, '냉장고. 자석 밑에 엄마 메모가 붙어 있다. “반찬 데워 먹어. 오늘도 좀 늦어.”'),
    ob('parcel', '택배 상자', 'room', 20, 15, 2, 2, '현관 앞 택배 상자. 송장에 우리 집 주소와 엄마 이름, 전화번호가 그대로 적혀 있다.')
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
    home: rp(10, 12, 'down'),                  // 내 방 침대 옆(아침에 일어난 자리)
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
        jiho: '안녕… 꾸미기 하고 싶은데… 반짝이 스티커 사 왔어.'
      },
      greet: [
        { who: 'saebom', text: '왔구나! 오늘 방과 후부터 축제 준비 시작이야.' },
        { who: 'saebom', text: '오늘 방과 후에 단톡방에서 역할 정하자. 공지 꼭 봐 줘.' },
        { who: 'saebom', text: '여기 민준이. 손재주가 진짜 좋아.' },
        { who: 'minjun', text: '…안녕. 집에 옛날 카메라 모형 있는데… 가져와 볼까.' },
        { who: 'saebom', text: '오는 길에 하늘이랑 지호도 봤지? 우리 반 다 같이 잘해 보자!', met: ['haneul', 'jiho'],
          alt: '하늘이랑 지호는 아까 마당에 있더라. 우리 반 다 같이 잘해 보자!' } // met: 이 걷기에서 둘 다 마주쳤을 때만(지나가며 인사·말 걸기), 아니면 alt
      ] },
    c1_e1_a: { time: 'D-4 · 하교', mission: '집에 가기 — 마을 길 끝 우리 집, 내 방 침대', target: { obj: 'bed' }, spawn: 'classroom', tint: 'evening',
      cast: [who('saebom', 'classroom', 12, 8, 'down'), who('haneul', 'classroom', 19, 9, 'left')],
      greet: '저녁을 먹고 침대에 눕자 휴대폰이 울렸다.' },
    // 2026-11-03 플레이테스트: 민준 = 자기 책상(desk7) 의자 칸, 하늘은 책상 건너편 왼쪽으로(? 표시·이름표가 서로 겹치지 않게, 무대 c1_e2_a와 같은 자리)
    c1_e2_a: { time: 'D-3 · 방과 후', mission: '교실에서 엎드려 자는 민준이 살펴보기', target: { npc: 'minjun' }, spawn: 'gate', tint: 'day',
      cast: [who('minjun', 'classroom', 29, 11, 'up', { pose: 'sleep' }), who('haneul', 'classroom', 26, 8, 'right'),
        who('saebom', 'classroom', 12, 8, 'down'), who('jiho', 'classroom', 10, 9, 'down')] },
    c1_e3_a: { time: 'D-2 · 하교 시간', mission: '집에 가서 쉬기 — 교문을 지나 마을 길 끝 우리 집으로', target: { obj: 'bed' }, spawn: 'classroom', tint: 'evening',
      cast: [who('saebom', 'classroom', 20, 8, 'down'), who('haneul', 'yard', 19, 8, 'down'), who('minjun', 'yard', 7, 14, 'up')],
      enterLine: '하루 종일 부스를 꾸몄더니 피곤하다. 침대에 눕자 휴대폰이 울렸다.' },
    c2_e4_a: { time: 'D-1 · 오후', mission: '매점 앞에서 손짓하는 하늘이에게 가기', target: { npc: 'haneul' }, spawn: 'gate', tint: 'day',
      cast: [who('haneul', 'yard', 22, 14, 'left'), who('jiho', 'yard', 7, 14, 'up'),
        who('minjun', 'yard', 4, 11, 'right'), who('saebom', 'classroom', 12, 8, 'down')] },
    c2_e5_a: { time: 'D-1 · 저녁', mission: '집에 가서 부스 안내문 쓰기 — 내 방 컴퓨터', target: { obj: 'mypc' }, spawn: 'road', tint: 'night',
      cast: [who('jiho', 'yard', 7, 14, 'up'), who('minjun', 'yard', 4, 11, 'right')] },
    c2_e6_a: { time: '축제 당일 · 아침', mission: '도서관 공용 PC 3번에서 안내문 출력하기', target: { obj: 'pc3' }, spawn: 'gate', tint: 'day',
      cast: [who('friend', 'library', 23, 8, 'right'), who('saebom', 'yard', 7, 14, 'up'), who('jiho', 'yard', 4, 11, 'right')] },
    c3_e7_a: { time: '축제 당일 · 오후', mission: '마당 부스 옆 하늘이네에게 가기', target: { npc: 'haneul' }, spawn: 'hall', tint: 'day',
      cast: [who('haneul', 'yard', 16, 13, 'left'), who('friend', 'yard', 18, 12, 'left'),
        who('minjun', 'classroom', 29, 11, 'up'), who('saebom', 'yard', 7, 14, 'up'), who('jiho', 'yard', 4, 11, 'right')] },
    c3_e8_a: { time: '축제 당일 · 저녁', mission: '집에 가서 쉬기 — 내 방 컴퓨터', target: { obj: 'mypc' }, spawn: 'yard', tint: 'evening',
      cast: [who('haneul', 'yard', 16, 13, 'left'), who('teacher', 'yard', 16, 8, 'down')],
      castLines: { teacher: '고생 많았어. 이제 집에 가서 푹 쉬렴.' } }, // 축제가 끝난 저녁
    c3_e9_a: { time: '축제 다음 날 · 오전', mission: '교실 내 자리에 앉기', target: { obj: 'desk8' }, spawn: 'gate', tint: 'day',
      greet: '자리에 앉자 휴대폰 알림이 연달아 울렸다.',
      skipIf: 'e8_confrontation=fight', // 싸움 경로는 이미 다음 날 교실·상담실 장면을 거쳤다 → 걷기 생략
      cast: schoolDay() },
    // 특별 수업(2026-11-10): 마당 현관 앞에서 시작, 평소처럼 교실 문으로 들어가면 이 걷기에서만 특별실(AI 실습실)로
    sc_1: { time: 'D-1 · 오후 5교시', mission: '정보 수업 — 교실로 들어가기', target: { npc: 'teacher' }, spawn: 'hall', tint: 'day',
      warp: { from: 'classroom', to: [SCENES.length * 0, 0], say: '오늘 정보 수업은 특별실(AI 실습실)이다. 평소엔 잠겨 있던 곳이다.' },
      cast: [who('teacher', 'ai_lab', 16, 7, 'down'), who('saebom', 'ai_lab', 12, 9, 'right'), who('haneul', 'ai_lab', 12, 12, 'right'),
        who('jiho', 'ai_lab', 20, 9, 'left'), who('minjun', 'ai_lab', 20, 12, 'left')],
      greet: [{ who: 'teacher', text: '왔구나. 오늘 정보 수업은 여기 AI 실습실에서 할 거야.' }] },
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
    room: { name: '내 방', me: rp(12, 12, 'down') },
    road: { name: '마을 길', me: P('village', 12, 10, 'right') },
    gate: { name: '교문', me: P('yard', 15, 15, 'up') },
    store: { name: '매점 앞', me: P('yard', 21, 14, 'right') }, // 매점 창구 바로 앞
    library: { name: '도서관', me: P('library', 26, 7, 'up') },
    hall: { name: '현관 앞', me: P('yard', 7, 7, 'right') }, // 복도는 없앴다(설계 결정) — 현관 앞에서
    booth: { name: '마당 축제 부스', me: P('yard', 14, 13, 'right') },
    ailab: { name: 'AI 실습실', me: P('ai_lab', 16, 11, 'up') } // 특별 수업(2026-11-10)
  };
  function only(list, whos) { return list.filter(function (c) { return whos.indexOf(c.who) >= 0; }); }
  var ATDESK = rp(25, 10, 'up'); // 내 방 책상 컴퓨터 앞
  // 침대에 누운 자리(2026-11-03 플레이테스트): 머리가 베개에 오도록 발 기준 칸 좌표(소수) + pose 'lie'(map.js: 윗몸만 그리고 아래는 이불 속)
  var BED_ME = P('room', 3.7, 5.84, 'down', { pose: 'lie' });
  // 2026-11-10 사용자 버그: 옆 반 친구가 하늘 바로 오른쪽 위(17,12)에 붙어 서서 하늘 머리 위 느낌표가 옆으로 비키며 선이 생겼다 → 한 칸 오른쪽(18,12)
  var BOOTH = [who('haneul', 'yard', 16, 13, 'left'), who('friend', 'yard', 18, 12, 'left'),
    who('saebom', 'yard', 7, 14, 'up'), who('jiho', 'yard', 4, 11, 'right')];

  var SC_CAST = TRIGGERS.sc_1.cast; // 특별 수업 무대 = 걷기 때 자리 그대로
  TRIGGERS.sc_1.warp.to = [S.ai_lab.ox + 16, 15]; // 특별실 문간 안쪽 도착 칸
  var STAGES = {
    // 첫 단톡방: 새봄·하늘·지호·민준이 모두 주인공 둘레에(확대 무대에서 한 화면에 보이게 — 2026-11-01 사용자)
    pro_1: { place: 'classroom', tint: 'day', card: '방과 후 · 오후 5:30 — 축제 준비 중', me: P('classroom', 15, 10, 'up'),
      cast: [who('saebom', 'classroom', 12, 8, 'down'), who('haneul', 'classroom', 18, 9, 'left'), who('jiho', 'classroom', 11, 11, 'right'), who('minjun', 'classroom', 19, 11, 'left')],
      bubbles: [{ on: '다 올린다', who: 'jiho', text: '…' }, { on: '넌 뭐 할래', who: 'saebom', text: '👀' }] },
    // 2026-11-03 플레이테스트: greet '침대에 눕자 휴대폰이 울렸다' — 침대 위에 누운 채 밤 무대로(옛 자리는 러그 한가운데)
    c1_e1_a: { place: 'room', tint: 'night', me: BED_ME, cast: [] }, // 'D-4 · 저녁 8:12' — 8시 이후는 밤(timeTint와 같은 기준, 2026-11-02)
    c1_e1_b: { place: 'room', tint: 'night', me: BED_ME, cast: [] },
    // 2026-11-03 플레이테스트: 주인공이 하늘 바로 아래에 서서 하늘 이름표가 얼굴을 덮고 있었다 → 셋을 서로 2칸 이상 떨어뜨림(둘 다 민준이 책상 건너편, 2026-11-02 '민준이 앞에' 유지)
    c1_e2_a: { place: 'classroom', tint: 'day', me: P('classroom', 29, 8, 'down'),
      cast: [who('minjun', 'classroom', 29, 11, 'up', { pose: 'sleep' }), who('haneul', 'classroom', 26, 8, 'right'),
        who('saebom', 'classroom', 12, 8, 'down'), who('jiho', 'classroom', 10, 9, 'down')] },
    c1_e2_b: { place: 'room', tint: 'night', card: '그날 밤 · 내 방', cast: [] },
    c1_e2_d: { place: 'road', tint: 'day', card: 'D-2 아침 · 등굣길', cast: [] },
    c1_e3_a: { place: 'room', tint: 'night', me: BED_ME, cast: [] }, // 2026-11-03 플레이테스트: 이 걷기도 침대 조사로 열린다
    // 2026-11-09 지시서 C1: 개인톡을 보내는 사람은 그 무대에 세우지 않는다(바로 옆에 서서 개인톡을 보내는 것처럼 보였다). 대사는 그대로.
    //   단톡방(group)은 같은 교실에서 함께 봐도 자연스러워 그대로 둔다. 검사 = tests/fix-1109.mjs C1(정적 검사)
    c1_e3_b: { place: 'gate', tint: 'day', card: 'D-1 아침 · 교문 앞', cast: [] }, // 새봄 개인톡(옛: 새봄이 바로 옆)
    c1_e3_ask: { place: 'classroom', tint: 'day', card: 'D-1 · 교실', cast: only(classmates, ['saebom']) }, // 지호 개인톡
    c1_e3_anon: { place: 'classroom', tint: 'day', card: 'D-1 · 교실', cast: only(classmates, ['saebom', 'haneul']) }, // 지호 '(개인톡)' 줄
    c1_e3_cap: { place: 'classroom', tint: 'day', card: 'D-1 점심 · 교실', cast: [] }, // 하늘 개인톡 + 반응에서 새봄·하늘·지호 모두 메시지
    c2_e4_a: { place: 'store', tint: 'evening', cast: [who('haneul', 'yard', 22, 14, 'left')],
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
    c3_e8_i: { place: 'classroom', tint: 'day', cast: only(classmates, ['saebom', 'haneul', 'jiho']) }, // 민준 개인톡(C1)
    c3_e8_h: { place: 'classroom', tint: 'day', card: '상담실', cast: [] },
    c3_e9_a: { place: 'classroom', tint: 'day', cast: classmates,
      bubbles: [{ on: '다들 퍼 가 주세요', who: 'jiho', text: '…!' }, { on: '당하고만 있으면 안 돼', who: 'saebom', text: '😤' }] },
    c3_e9_b: { place: 'classroom', tint: 'day', card: '점심시간 · 교실', cast: only(classmates, ['saebom', 'jiho']),
      bubbles: [{ on: '그냥 넘어가면 억울한데', who: 'saebom', text: '😣' }] },
    // 특별 수업(2026-11-10): AI 실습실, 선생님은 받침대 AI 앞, 친구 넷은 양쪽에 찬성(왼쪽 새봄·하늘)·반대(오른쪽 지호·민준)
    sc_1: { place: 'ailab', tint: 'day', cast: SC_CAST }, sc_2: { place: 'ailab', tint: 'day', cast: SC_CAST },
    sc_3: { place: 'ailab', tint: 'day', cast: SC_CAST }, sc_4: { place: 'ailab', tint: 'day', cast: SC_CAST },
    sc_5: { place: 'ailab', tint: 'day', cast: SC_CAST },
    // 에필로그: 반 친구 넷이 담임 선생님 앞에 모두 모인다(확대 무대에서 한 화면에 — 2026-11-02 사용자, 첫 단톡방과 같은 방식)
    // board(2026-11-10 사용자 요청): 칠판 분필 글씨 — 그림은 그대로, map.js drawBoard가 교실 칠판 가운데(장면 칸 x·y, 글자 높이 size칸)에 그린다
    ep_1: { place: 'classroom', tint: 'day', me: P('classroom', 16, 9, 'up'), board: { text: '프라이버시', x: 16, y: 2.15, size: 1.45 },
      cast: [who('teacher', 'classroom', 17, 7, 'down'), who('saebom', 'classroom', 14, 9, 'up'), who('haneul', 'classroom', 18, 9, 'up'),
        who('jiho', 'classroom', 14, 11, 'up'), who('minjun', 'classroom', 18, 11, 'up')] }
  };

  /* ── ❗가 아닌 인물에게 말 걸 때 ─────── */
  var IDLE = {
    saebom: [
      { if: 'e9b=calm|del', text: '그때 말려 줘서… 고마워.' },
      { if: 'e4b=blame', text: '…괜찮아. 신경 쓰지 마.' },
      { if: 'trust.saebom>=1', text: '요즘 네 덕분에 든든해.' },
      { if: 'e4', text: '그 가짜 영상… 아직도 돌고 있는 것 같아.' },
      { text: '역할표 아직 정리 중이야!' }
    ],
    haneul: [
      { if: 'e6=logout', text: '그때 로그아웃해 준 거 진짜 고마웠다.' },
      { if: 'e6=leave || e6b=deny', text: '내 계정에 이상한 거 올린 사람 아직도 못 찾았어 ㅡㅡ' }, // 내가 털어놓았으면(own) 하늘이는 이미 안다
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
      { text: '…소품 뭐 만들지 생각 중이야.' } // 역할을 정하기 전(오프닝)에도 맞는 말
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
  // 시각 글자 → 시간대. STAGES·TRIGGERS에 tint가 없을 때의 기본값(장면 첫 sys 줄·걷기 time 글자로 정함)
  //   '밤'·'새벽'·'저녁 8시 이후' = night · '저녁'·'하교' = evening · 그 밖(아침·오전·점심·오후) = day
  function timeTint(text) {
    var s = String(text || '');
    if (/밤|새벽/.test(s)) return 'night';
    var m = /저녁\s*(\d{1,2})\s*:/.exec(s);
    if (m) return Number(m[1]) >= 8 ? 'night' : 'evening';
    if (/저녁|하교/.test(s)) return 'evening';
    return 'day';
  }

  var WORLD = {
    W: W, H: H, VERSION: VERSION, lookFor: lookFor, timeTint: timeTint, SW: SW, SH: SH, CELL: CELL, SCENES: SCENES, sceneAt: sceneAt, grid: grid,
    TILES: TILES, DOORS: DOORS, OBJECTS: OBJECTS, SPAWNS: SPAWNS, BED_ME: BED_ME, scaleRect: scaleRect,
    triggers: TRIGGERS, idle: IDLE, DIRS: DIRS, PLACES: PLACES, STAGES: STAGES,
    tile: tile, objectAt: objectAt, walkable: walkable, stepFrom: stepFrom,
    findPath: findPath, adjacentTo: adjacentTo, doorTarget: doorTarget, setWarp: setWarp, areaName: areaName, nearestWalkable: nearestWalkable, NEIGHBORS: NEIGHBORS,
    object: function (id) { return OBJECTS.filter(function (o) { return o.id === id; })[0]; }
  };
  root.PRIVACY_WORLD = WORLD;
  if (typeof module !== 'undefined' && module.exports) module.exports = WORLD;
})(typeof window !== 'undefined' ? window : globalThis);

