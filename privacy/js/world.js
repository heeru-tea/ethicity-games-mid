/*
 * 「공유한 순간」 맵 데이터 + 길찾기(순수 로직, 브라우저·Node 겸용)
 * ------------------------------------------------------------
 * 맵: 솔빛학교(교실·도서관·복도·매점 앞·마당 축제 부스) → 교문 → 마을 길 → 우리 집(내 방) → 큰길의 이웃집
 * 좌표는 타일 단위(x: 왼→오, y: 위→아래). 그림은 app/map.js가 그린다.
 *
 * ▸ 사건 트리거(triggers): 사건의 첫 장면 id → 맵에서 그 장면을 여는 조건
 *   { time, mission, target:{ npc:'saebom' } 또는 { obj:'bed' }, spawn?:'gate'|'classroom', tint?, cast:[{who,x,y,dir,pose?}] }
 *   - spawn이 있으면 그 위치에서 시작(다음 날 등교 등). 없으면 직전 위치에서 이어 걷는다.
 *   - 대상(❗)에게 말을 걸거나 조사하면 해당 장면이 열린다.
 * ▸ idle: ❗가 아닌 인물에게 말 걸 때 한 줄(조건은 story.js와 같은 문법, 위에서부터 첫 일치)
 * ▸ objects[].look: 조사 문구
 */
(function (root) {
  'use strict';

  // 2026-10-31 플레이테스트: 쓰지 않던 운동장 아래 절반·마을 남쪽을 잘라 64×34 → 56×23.
  // 마당은 x1~13·y11~21(매점·부스 천막·교문만), 교문은 현관(10·11,10)에서 8칸(14,16~17), 마을은 왼쪽으로 8칸 당겨 교문 바로 밖에서 시작.
  var VERSION = 2; // 지도 좌표 판(저장된 맵 위치가 이 판과 다르면 버리고 장면 시작점에서 다시)
  var W = 56, H = 23;
  var GATE = { x: 14, y: 16 }; // 교문(마당 오른쪽 담장) 두 칸: (14,16)·(14,17). 기둥은 그 위·아래 칸
  var grid = [];
  var y, x;
  for (y = 0; y < H; y++) { grid.push([]); for (x = 0; x < W; x++) grid[y].push('g'); }
  function rect(x0, y0, w, h, ch) {
    for (var yy = y0; yy < y0 + h; yy++) for (var xx = x0; xx < x0 + w; xx++) grid[yy][xx] = ch;
  }
  function at(xx, yy, ch) { grid[yy][xx] = ch; }

  /* 타일 종류: 통행 가능 여부와 임시 색(스프라이트가 없을 때) */
  var TILES = {
    '#': { walk: false, name: '벽' },
    'c': { walk: true, name: '교실 바닥' },
    'l': { walk: true, name: '도서관 바닥' },
    'h': { walk: true, name: '복도' },
    'd': { walk: true, name: '문' },
    'g': { walk: true, name: '풀밭' },
    'p': { walk: true, name: '흙길' },
    'y': { walk: true, name: '운동장' },
    'f': { walk: false, name: '울타리' },
    'T': { walk: false, name: '나무' },
    'w': { walk: false, name: '연못' },
    'H': { walk: false, name: '집 벽' },
    'o': { walk: true, name: '우리 집 문' },
    'r': { walk: true, name: '방 바닥' },
    'x': { walk: true, name: '방문' },
    'e': { walk: false, name: '생울타리' }
  };

  /* ── 지형 ───────────────────────── */
  rect(22, 0, W - 22, 11, 'T');             // 학교 오른쪽 위 숲(방은 이 안에 따로 있음)
  // 학교 건물
  rect(0, 0, 22, 11, '#');
  rect(1, 1, 10, 6, 'c');                   // 2학년 3반 교실
  rect(12, 1, 9, 6, 'l');                   // 도서관
  rect(1, 8, 20, 2, 'h');                   // 복도
  at(8, 7, 'd'); at(15, 7, 'd');            // 교실·도서관 문
  at(10, 10, 'd'); at(11, 10, 'd');         // 건물 현관
  // 마당(울타리 안): 매점 앞 · 현관 → 교문 길 · 아래쪽 부스 천막 줄
  rect(1, 11, 13, 11, 'y');
  rect(0, 11, 1, 12, 'f'); rect(0, 22, 15, 1, 'f'); rect(14, 11, 1, 12, 'f'); rect(22, 0, 1, 11, 'f');
  rect(10, 11, 2, 5, 'p'); rect(10, 16, 4, 2, 'p');   // 현관 → 교문 길(8칸)
  rect(1, 12, 7, 3, 'p');                   // 매점 앞
  at(GATE.x, GATE.y, 'd'); at(GATE.x, GATE.y + 1, 'd'); // 교문
  // 마을: 교문 → 마을 길(연못·벤치 쉼터) → 우리 집 → 큰길의 이웃집 3채. 북쪽은 숲, 동·남쪽 끝은 낮은 생울타리
  rect(22, 11, W - 22, 1, 'T');            // 숲 가장자리(학교 건물 바로 밑 x15~21은 잔디)
  rect(W - 1, 12, 1, H - 12, 'e'); rect(15, H - 1, W - 15, 1, 'e');
  rect(15, 16, 18, 2, 'p');                 // 마을 길
  rect(19, 19, 4, 2, 'w');                  // 연못
  rect(31, 18, 2, 2, 'p');                  // 우리 집 앞에서 아래로 꺾어
  rect(31, 20, W - 32, 2, 'p');             // 큰길(동쪽, 이웃집 앞)
  rect(40, 19, 1, 1, 'p');                  // 세이지 지붕 집 진입로
  rect(46, 19, 1, 1, 'p');                  // 벽돌집 진입로
  rect(52, 19, 1, 1, 'p');                  // 2층집 진입로
  [[17, 13], [21, 12], [25, 13], [30, 12], [16, 20], [37, 12], [39, 13], [45, 12], [50, 13], [53, 12], [26, 20]].forEach(function (p) { at(p[0], p[1], 'T'); });
  // 우리 집(바깥)
  rect(33, 13, 5, 5, 'H');
  rect(32, 16, 1, 3, 'p');
  rect(32, 18, 3, 1, 'p'); // 마을 길에서 현관 계단까지
  rect(33, 19, 2, 1, 'p'); // 현관에서 나와 큰길로
  at(34, 18, 'o');
  // 내 방(숲 속 따로 떨어진 실내 — 문으로만 오간다)
  rect(30, 2, 10, 7, '#');
  rect(31, 3, 8, 5, 'r');
  at(34, 8, 'x');

  /* 문 이동: 이 칸에 들어서면 다른 칸으로 옮겨진다 */
  var DOORS = {
    '34,18': { to: [34, 7], dir: 'up', label: '집 안으로' },
    '34,8': { to: [34, 19], dir: 'down', label: '밖으로' }
  };

  /* 구역 이름(화면 위 표시용) */
  var AREAS = [
    { name: '2학년 3반 교실', x: 1, y: 1, w: 10, h: 6 },
    { name: '도서관', x: 12, y: 1, w: 9, h: 6 },
    { name: '복도', x: 1, y: 7, w: 20, h: 4 },
    { name: '매점 앞', x: 1, y: 11, w: 8, h: 6 },
    { name: '마당 축제 부스', x: 1, y: 18, w: 13, h: 4 },
    { name: '교문', x: 11, y: 15, w: 5, h: 3 },
    { name: '마을 길', x: 15, y: 12, w: 16, h: 10 },
    { name: '우리 집 앞', x: 31, y: 12, w: 7, h: 10 },
    { name: '주택가', x: 38, y: 12, w: W - 39, h: 10 },
    { name: '내 방', x: 31, y: 3, w: 8, h: 5 },
    { name: '마당', x: 1, y: 11, w: 13, h: 11 }
  ];

  /* ── 가구·사물 (w×h = 바닥을 차지하는 칸, 0이면 벽에 걸림) ── */
  var OBJECTS = [
    { id: 'board', name: '칠판', x: 3, y: 0, w: 5, h: 1, icon: '📋', wall: true, look: '칠판: “축제 D-day · 2학년 3반 레트로 사진관 📸”' },
    { id: 'notice', name: '게시판', x: 1, y: 0, w: 2, h: 1, icon: '📌', wall: true, look: '게시판: 축제 부스 배치도. 우리 반은 마당 왼쪽 천막이다.' },
    { id: 'tdesk', name: '교탁', x: 5, y: 2, w: 2, h: 1, icon: '🗂', look: '교탁 위에 출석부와 분필이 놓여 있다.' },
    { id: 'desk1', name: '책상', x: 2, y: 3, w: 1, h: 1, icon: '▭' }, { id: 'desk2', name: '책상', x: 4, y: 3, w: 1, h: 1, icon: '▭' },
    { id: 'desk3', name: '책상', x: 7, y: 3, w: 1, h: 1, icon: '▭' }, { id: 'desk4', name: '책상', x: 9, y: 3, w: 1, h: 1, icon: '▭' },
    { id: 'desk5', name: '책상', x: 2, y: 5, w: 1, h: 1, icon: '▭' }, { id: 'desk6', name: '책상', x: 4, y: 5, w: 1, h: 1, icon: '▭' },
    { id: 'desk7', name: '민준이 책상', x: 7, y: 5, w: 1, h: 1, icon: '▭' }, { id: 'desk8', name: '내 책상', x: 9, y: 5, w: 1, h: 1, icon: '▭', look: '내 책상. 축제 소품 상자가 올려져 있다.' },
    { id: 'locker', name: '사물함', x: 10, y: 1, w: 1, h: 2, icon: '🗄', look: '내 사물함. 축제 소품이 들어 있다.' },
    { id: 'shelf', name: '책장', x: 12, y: 1, w: 9, h: 1, icon: '📚', look: '도서관 책장. ‘개인정보, 어디까지 괜찮을까?’라는 책이 눈에 띈다.' },
    { id: 'pc1', name: '공용 PC 1번', x: 13, y: 4, w: 1, h: 1, icon: '🖥', look: '공용 PC 1번. 꺼져 있다.' },
    { id: 'pc2', name: '공용 PC 2번', x: 15, y: 4, w: 1, h: 1, icon: '🖥', look: '공용 PC 2번. 검색 전용이라고 붙어 있다.' },
    { id: 'pc3', name: '공용 PC 3번', x: 17, y: 4, w: 1, h: 1, icon: '🖥', label: '3', look: '공용 PC 3번.' },
    { id: 'store', name: '학교 매점', x: 2, y: 14, w: 4, h: 1, icon: '🧃', look: '매점. 오늘은 컵떡볶이가 제일 잘 팔린다.' },
    { id: 'tent1', name: '레트로 사진관 천막', x: 2, y: 20, w: 3, h: 1, icon: '⛺', look: '우리 반 부스 ‘레트로 사진관’. 1컷 500원.' },
    { id: 'tent2', name: '옆 반 천막', x: 6, y: 20, w: 3, h: 1, icon: '⛺', look: '옆 반 부스. 솜사탕 냄새가 난다.' },
    { id: 'sign', name: '안내 표지판', x: 16, y: 15, w: 1, h: 1, icon: '🪧', look: '← 솔빛학교 · 우리 집 →' },
    { id: 'bench', name: '벤치', x: 24, y: 14, w: 2, h: 1, icon: '🪑', look: '마을 벤치. 집까지 조금만 더 가면 된다.' },
    { id: 'lamp', name: '가로등', x: 29, y: 15, w: 1, h: 1, icon: '💡', look: '가로등이 막 켜졌다.' },
    { id: 'bed', name: '침대', x: 31, y: 3, w: 1, h: 2, icon: '🛏', look: '내 침대. 아직 잘 시간은 아니다.' },
    { id: 'mypc', name: '내 책상 컴퓨터', x: 36, y: 3, w: 2, h: 1, icon: '💻', look: '내 책상과 컴퓨터.' },
    { id: 'mybook', name: '책꽂이', x: 38, y: 5, w: 1, h: 1, icon: '📚', look: '교과서와 만화책이 섞여 꽂혀 있다.' },
    { id: 'plush', name: '큰 팬더 인형', x: 37, y: 6, w: 2, h: 2, icon: '🧸', look: '구석에 앉은 커다란 팬더 인형. 푹신한 배에 기대면 잠이 올 것 같다.' },
    { id: 'mailbox', name: '노란 우편함', x: 36, y: 18, w: 1, h: 1, icon: '📮', art: 'mailbox', look: '노란 우편함. 여기가 우리 집이다.' }
  ];

  /* 이웃집: 바깥 그림과 조사만(들어갈 수 없음, ❗·문 이동 없음). footprint = 막히는 칸, approach = 현관 앞 진입로 */
  var NEIGHBORS = [
    { id: 'nb_sage', name: '세이지 지붕 집', art: 'house-sage', x: 39, y: 16, w: 5, h: 3, drawW: 5, approach: { x: 40, y: 19 },
      look: '화분에 막 물을 준 듯 흙이 젖어 있다. 저녁 준비하는 냄새가 난다.' },
    { id: 'nb_brick', name: '벽돌집', art: 'house-brick', x: 45, y: 16, w: 5, h: 3, drawW: 5, approach: { x: 46, y: 19 },
      look: '현관 앞에 자전거가 세워져 있다. 안에서 텔레비전 소리가 작게 들린다.' },
    { id: 'nb_balcony', name: '발코니 2층집', art: 'house-balcony', x: 51, y: 16, w: 5, h: 3, drawW: 4.6, approach: { x: 52, y: 19 },
      look: '발코니에 수건이 널려 있다. 위층에서 누군가 피아노를 연습한다.' }
  ];
  NEIGHBORS.forEach(function (n) {
    OBJECTS.push({ id: n.id, name: n.name, x: n.x, y: n.y, w: n.w, h: n.h, icon: '🏠', art: n.art, drawW: n.drawW, look: n.look });
  });

  /* 실내(내 방): 밖에 있을 땐 숲으로 가려 그리고, ❗는 집 문에 띄운다 */
  var INDOOR = { x: 30, y: 2, w: 10, h: 7, entrance: { x: 34, y: 18 }, exit: { x: 34, y: 8 } }; // entrance=집 현관(밖), exit=방문(안)

  var SPAWNS = {
    classroom: { x: 8, y: 6, dir: 'up' },
    gate: { x: 13, y: 16, dir: 'left' },  // 교문 안쪽(현관까지 8칸)
    home: { x: 32, y: 4, dir: 'down' },   // 내 방 침대 옆(아침에 일어난 자리)
    road: { x: 25, y: 16, dir: 'right' }, // 마을 길 가운데
    hall: { x: 10, y: 9, dir: 'down' },   // 복도, 현관 앞
    yard: { x: 9, y: 21, dir: 'right' }   // 마당 축제 부스 앞
  };

  /* ── 사건 트리거 ─────────────────── */
  var schoolDay = function (extra) {
    return [
      { who: 'saebom', x: 5, y: 4, dir: 'down' }, { who: 'haneul', x: 8, y: 2, dir: 'left' },
      { who: 'jiho', x: 3, y: 1, dir: 'down' }, { who: 'minjun', x: 9, y: 6, dir: 'up' }
    ].filter(function (c) { return !extra || extra.indexOf(c.who) < 0; });
  };
  var TRIGGERS = {
    // 등교 오프닝: 내 방에서 일어나 교실까지 걷는다. 길에서 만난 친구는 castLines로 자기소개, 교실에서 새봄이가 반 친구를 소개한다.
    pro_1: { time: 'D-4 · 아침', mission: '학교 가기 — 2학년 3반 교실까지', target: { npc: 'saebom' }, spawn: 'home', tint: 'day',
      hint: '방향키·WASD 또는 화면을 눌러 걸어요',
      cast: [{ who: 'saebom', x: 5, y: 4, dir: 'down' }, { who: 'minjun', x: 9, y: 6, dir: 'left' },
        { who: 'haneul', x: 17, y: 15, dir: 'down' }, { who: 'jiho', x: 12, y: 9, dir: 'down' }],
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
      cast: [{ who: 'saebom', x: 5, y: 4, dir: 'down' }, { who: 'haneul', x: 8, y: 2, dir: 'left' }],
      greet: '저녁을 먹고 침대에 눕자 휴대폰이 울렸다.' },
    c1_e2_a: { time: 'D-3 · 방과 후', mission: '교실에서 엎드려 자는 민준이 살펴보기', target: { npc: 'minjun' }, spawn: 'gate', tint: 'day',
      cast: [{ who: 'minjun', x: 7, y: 6, dir: 'up', pose: 'sleep' }, { who: 'haneul', x: 6, y: 6, dir: 'right' },
        { who: 'saebom', x: 6, y: 1, dir: 'down' }, { who: 'jiho', x: 2, y: 1, dir: 'down' }] },
    c1_e3_a: { time: 'D-2 · 하교 시간', mission: '집에 가서 쉬기 — 교문을 지나 마을 길 끝 우리 집으로', target: { obj: 'bed' }, spawn: 'classroom', tint: 'evening',
      cast: [{ who: 'saebom', x: 15, y: 8, dir: 'down' }, { who: 'haneul', x: 4, y: 15, dir: 'down' }, { who: 'minjun', x: 7, y: 21, dir: 'up' }],
      enterLine: '하루 종일 부스를 꾸몄더니 피곤하다. 침대에 눕자 휴대폰이 울렸다.' },
    c2_e4_a: { time: 'D-1 · 오후', mission: '매점 앞에서 손짓하는 하늘이에게 가기', target: { npc: 'haneul' }, spawn: 'gate', tint: 'day',
      cast: [{ who: 'haneul', x: 4, y: 15, dir: 'right' }, { who: 'jiho', x: 3, y: 21, dir: 'up' },
        { who: 'minjun', x: 7, y: 21, dir: 'up' }, { who: 'saebom', x: 6, y: 9, dir: 'down' }] },
    c2_e5_a: { time: 'D-1 · 저녁', mission: '집에 가서 부스 안내문 쓰기 — 내 방 컴퓨터', target: { obj: 'mypc' }, spawn: 'road', tint: 'night',
      cast: [{ who: 'jiho', x: 3, y: 21, dir: 'up' }, { who: 'minjun', x: 7, y: 21, dir: 'up' }] },
    c2_e6_a: { time: '축제 당일 · 아침', mission: '도서관 공용 PC 3번에서 안내문 출력하기', target: { obj: 'pc3' }, spawn: 'gate', tint: 'day',
      cast: [{ who: 'friend', x: 18, y: 5, dir: 'left' }, { who: 'saebom', x: 3, y: 21, dir: 'up' }, { who: 'jiho', x: 4, y: 21, dir: 'up' }] },
    c3_e7_a: { time: '축제 당일 · 오후', mission: '마당 부스 옆 하늘이네에게 가기', target: { npc: 'haneul' }, spawn: 'hall', tint: 'day',
      cast: [{ who: 'haneul', x: 11, y: 21, dir: 'left' }, { who: 'friend', x: 12, y: 21, dir: 'left' },
        { who: 'minjun', x: 9, y: 6, dir: 'up' }, { who: 'saebom', x: 3, y: 21, dir: 'up' }, { who: 'jiho', x: 7, y: 21, dir: 'up' }] },
    c3_e8_a: { time: '축제 당일 · 저녁', mission: '집에 가서 쉬기 — 내 방 컴퓨터', target: { obj: 'mypc' }, spawn: 'yard', tint: 'evening',
      cast: [{ who: 'haneul', x: 11, y: 21, dir: 'left' }, { who: 'teacher', x: 12, y: 15, dir: 'down' }],
      castLines: { teacher: '고생 많았어. 이제 집에 가서 푹 쉬렴.' } }, // 축제가 끝난 저녁
    c3_e9_a: { time: '축제 다음 날 · 오전', mission: '교실 내 자리에 앉기', target: { obj: 'desk8' }, spawn: 'gate', tint: 'day',
      greet: '자리에 앉자 휴대폰 알림이 연달아 울렸다.',
      skipIf: 'e8_confrontation=fight', // 싸움 경로는 이미 다음 날 교실·상담실 장면을 거쳤다 → 걷기 생략
      cast: schoolDay() },
    ep_1: { time: '다음 주 월요일', mission: '교실에서 담임 선생님께 가기', target: { npc: 'teacher' }, spawn: 'gate', tint: 'day',
      cast: [{ who: 'teacher', x: 6, y: 1, dir: 'down' }].concat(schoolDay()) }
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
    classroom: { name: '2학년 3반 교실', me: { x: 8, y: 6, dir: 'up' } },
    room: { name: '내 방', me: { x: 32, y: 4, dir: 'down' } },
    road: { name: '마을 길', me: { x: 25, y: 16, dir: 'right' } },
    gate: { name: '교문', me: { x: 13, y: 16, dir: 'left' } },
    store: { name: '매점 앞', me: { x: 5, y: 15, dir: 'left' } },
    library: { name: '도서관', me: { x: 17, y: 5, dir: 'up' } },
    hall: { name: '복도', me: { x: 10, y: 9, dir: 'down' } },
    booth: { name: '마당 축제 부스', me: { x: 10, y: 21, dir: 'right' } }
  };
  var classmates = [
    { who: 'saebom', x: 5, y: 4, dir: 'down' }, { who: 'haneul', x: 8, y: 2, dir: 'left' },
    { who: 'jiho', x: 3, y: 1, dir: 'down' }, { who: 'minjun', x: 9, y: 6, dir: 'left' }
  ];
  function only(list, whos) { return list.filter(function (c) { return whos.indexOf(c.who) >= 0; }); }
  var ATDESK = { x: 36, y: 4, dir: 'up' }; // 내 방 책상 컴퓨터 앞
  var BOOTH = [{ who: 'haneul', x: 11, y: 21, dir: 'left' }, { who: 'friend', x: 12, y: 21, dir: 'left' },
    { who: 'saebom', x: 3, y: 21, dir: 'up' }, { who: 'jiho', x: 7, y: 21, dir: 'up' }];

  var STAGES = {
    pro_1: { place: 'classroom', tint: 'day', card: '방과 후 · 오후 5:30 — 축제 준비 중', me: { x: 5, y: 5, dir: 'up' }, cast: classmates,
      bubbles: [{ on: '다 올린다', who: 'jiho', text: '…' }, { on: '넌 뭐 할래', who: 'saebom', text: '👀' }] },
    c1_e1_a: { place: 'room', tint: 'evening', cast: [] },
    c1_e1_b: { place: 'room', tint: 'evening', cast: [] },
    c1_e2_a: { place: 'classroom', tint: 'day', me: { x: 8, y: 6, dir: 'left' },
      cast: [{ who: 'minjun', x: 7, y: 6, dir: 'up', pose: 'sleep' }, { who: 'haneul', x: 6, y: 6, dir: 'right' },
        { who: 'saebom', x: 6, y: 1, dir: 'down' }, { who: 'jiho', x: 2, y: 1, dir: 'down' }] },
    c1_e2_b: { place: 'room', tint: 'night', card: '그날 밤 · 내 방', cast: [] },
    c1_e2_d: { place: 'road', tint: 'day', card: 'D-2 아침 · 등굣길', cast: [] },
    c1_e3_a: { place: 'room', tint: 'night', cast: [] },
    c1_e3_b: { place: 'gate', tint: 'day', card: 'D-1 아침 · 교문 앞', cast: [{ who: 'saebom', x: 12, y: 15, dir: 'down' }] },
    c1_e3_ask: { place: 'classroom', tint: 'day', card: 'D-1 · 교실', cast: only(classmates, ['saebom', 'jiho']),
      bubbles: [{ on: '고마워. 내가 정한 만큼만', who: 'jiho', text: '🙂' }] },
    c1_e3_anon: { place: 'classroom', tint: 'day', card: 'D-1 · 교실', cast: only(classmates, ['saebom', 'jiho', 'haneul']),
      bubbles: [{ on: '역할 바꿨어', who: 'jiho', text: '😌' }] },
    c1_e3_cap: { place: 'classroom', tint: 'day', card: 'D-1 점심 · 교실', cast: only(classmates, ['saebom', 'jiho', 'haneul']),
      bubbles: [{ on: '…화나. 아무한테도', who: 'jiho', text: '💢' }] },
    c2_e4_a: { place: 'store', tint: 'evening', cast: [{ who: 'haneul', x: 4, y: 15, dir: 'right' }],
      bubbles: [{ on: '누가 만든 거래', who: 'haneul', text: '이거 봐 ㅋㅋ' }, { on: '나 보낸 거 지울게', who: 'haneul', text: '…' }] },
    c2_e4_b: { place: 'road', tint: 'evening', card: '그날 저녁 · 집에 가는 길', cast: [] },
    c2_e5_a: { place: 'room', tint: 'night', me: ATDESK, pcOn: true, cast: [] },
    c2_e5_b: { place: 'room', tint: 'night', me: ATDESK, pcOn: true, cast: [] },
    c2_e6_a: { place: 'library', tint: 'day', cast: [{ who: 'friend', x: 18, y: 5, dir: 'left' }] },
    c2_e6_b: { place: 'library', tint: 'day', cast: [{ who: 'friend', x: 18, y: 5, dir: 'left' }] },
    c2_e6_c: { place: 'hall', tint: 'day', card: '1교시 뒤 · 복도', cast: [{ who: 'haneul', x: 12, y: 8, dir: 'down' }],
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
    c3_e8_h: { place: 'hall', tint: 'day', card: '상담실 앞', cast: [] },
    c3_e9_a: { place: 'classroom', tint: 'day', cast: classmates,
      bubbles: [{ on: '다들 퍼 가 주세요', who: 'jiho', text: '…!' }, { on: '당하고만 있으면 안 돼', who: 'saebom', text: '😤' }] },
    c3_e9_b: { place: 'classroom', tint: 'day', card: '점심시간 · 교실', cast: only(classmates, ['saebom', 'jiho']),
      bubbles: [{ on: '그냥 넘어가면 억울한데', who: 'saebom', text: '😣' }] },
    ep_1: { place: 'classroom', tint: 'day', me: { x: 7, y: 2, dir: 'left' },
      cast: [{ who: 'teacher', x: 6, y: 1, dir: 'down' }].concat(classmates) }
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
  function areaName(xx, yy) {
    for (var i = 0; i < AREAS.length; i++) {
      var a = AREAS[i];
      if (xx >= a.x && xx < a.x + a.w && yy >= a.y && yy < a.y + a.h) return a.name;
    }
    return '';
  }

  var WORLD = {
    W: W, H: H, VERSION: VERSION, GATE: GATE, grid: grid,
    POND: { x: 18.9, y: 21.1, w: 4.2, h: 2.2 },               // 연못 그림(격자 w = 19~22, 19~20줄)
    CRITTERS: [{ name: 'rabbit', x: 31, y: 14 }, { name: 'squirrel', x: 38, y: 14 }], // 우리 집 양옆 잔디(그림만)
    TILES: TILES, DOORS: DOORS, OBJECTS: OBJECTS, SPAWNS: SPAWNS, INDOOR: INDOOR,
    indoor: function (xx, yy) { return xx >= INDOOR.x && xx < INDOOR.x + INDOOR.w && yy >= INDOOR.y && yy < INDOOR.y + INDOOR.h; },
    triggers: TRIGGERS, idle: IDLE, DIRS: DIRS, PLACES: PLACES, STAGES: STAGES,
    tile: tile, objectAt: objectAt, walkable: walkable, stepFrom: stepFrom,
    findPath: findPath, adjacentTo: adjacentTo, areaName: areaName, nearestWalkable: nearestWalkable, NEIGHBORS: NEIGHBORS,
    object: function (id) { return OBJECTS.filter(function (o) { return o.id === id; })[0]; }
  };
  root.PRIVACY_WORLD = WORLD;
  if (typeof module !== 'undefined' && module.exports) module.exports = WORLD;
})(typeof window !== 'undefined' ? window : globalThis);

