/*
 * 맵 화면 — 장면 그림(world.js SCENES) 위를 걸어 다니다 목적지(핀 ! 또는 ? 인물)에 말을 걸거나 조사하면 사건 장면이 열린다.
 * 장면마다 그림 1장(논리 1280×720) + 40px 칸 32×18. 출입구 칸을 밟으면 옆 장면으로(짧은 페이드).
 * 인물: 공통 팩 걷기 시트를 공통 런타임과 같은 0.8배(몸 약 2.2칸)로. 로드 실패 시 옛 시트, 이어 임시 도형.
 * 조작: 방향키/WASD 이동, Space/Enter 말 걸기·조사, 화면 탭 = 그 칸까지 걸어가기(인물·사물을 탭하면 가서 말 걸기)
 *   터치 기기: 왼쪽 아래 가상 조이스틱(8방향·밀어낸 거리로 걷기/빠르게, 메뉴 '조이스틱 표시'로 끔). 키보드와 같은 tryStep을 탄다.
 * 2026-11-02 모바일: 출입구 칸은 길찾기(WD.findPath)가 밟는 순간 건너편으로 옮겨 '목표 칸'으로 삼을 수 없었다 →
 *   탭은 tapPath()가 문 옆 칸까지 간 뒤 문 쪽으로 한 걸음, 막힌 칸을 누르면 가장 가까운 갈 수 있는 칸(문 우선). 문 옆에서 말 걸기 버튼 = 나가기.
 *   목적지로 바로 가기는 ?debug=1(교사 확인용)에서만. 대신 목적지 쪽 출구가 반짝이고, 화면 밖이면 가장자리 핀+화살표.
 * 2026-11-03 플레이테스트: 출구 핀은 출입구 묶음 가운데에 고정(drawExitPin, 내 캐릭터·이름표를 피해 움직이지 않음) · 문을 지나면 남은 길·입력을 버리고 한 박자 멈춤(finishStep) ·
 *   방금 지나온 출입구는 버튼이 가리키지 않음(arrived) · 대화 중 두 인물을 좌우로 살짝 밀어 그림(nudge) · 이름표·?·말풍선 겹침 규칙(drawTags·clearMark·drawOneBubble) ·
 *   줄여 그리는 장면(SCENES[].bg, drawOuter) · 침대에 누운 모습(pose 'lie').
 */
(function () {
  'use strict';

  var WD = window.PRIVACY_WORLD;
  var STEP_MS = 110; // 한 칸(40px, 몸 높이의 약 0.45) 걷는 시간 — 옛 48px 칸 150ms와 같은 눈높이 속도
  // 가상 조이스틱 수치(2026-11-05 사용자 피드백 '조이스틱이 너무 예민함') — 조이스틱 손맛은 여기 한 곳에서만 고친다. 거리는 받침 반지름 대비 비율
  var JOY = {
    R: 52,          // 받침 반지름(px)
    ENTER: 0.38,    // 이만큼(약 20px) 밀어야 입력으로 친다(옛 데드존 0.25 = 13px — 손가락을 올려놓다 스친 정도로 걸었다)
    LEAVE: 0.26,    // 입력 중에는 이보다 덜 밀어야 놓은 것으로 친다(ENTER와 차이 = 경계에서 걷기·멈춤이 깜빡이지 않게)
    PUSH: 0.7,      // 이만큼(약 36px) 밀면 방향 돌리는 시간 없이 바로 걷는다
    TURN_MS: 130,   // 살짝 민 첫 입력은 이 시간 동안 방향만 돌리고 걷지 않는다(옛 0 — 살짝 스쳐도 한 칸 걸었다)
    DIAG: 12,       // 대각선(가로·세로 번갈아 걷기)으로 보는 폭 = 45° ± 이 각도(옛 ±22.5° — 원의 절반이 대각선이라 곧게 밀어도 한 칸씩 옆으로 튀었다)
    HOLD_DEG: 10,   // 지금 방향을 유지하는 여유 각도(옛 0 — 경계에서 손가락 떨림만으로 방향이 바뀌었다)
    FAST: 0.92,     // 이만큼 밀면 빠르게(옛 0.75 — 조금만 힘줘도 빠른 걸음)
    SLOW: 0.6,      // 이보다 덜 밀면 천천히
    SLOW_K: 1.3     // 천천히 걸을 때 걸음 시간 배수(옛 없음 = 1)
  };
  var BODY = 2.24, HEAD = 1.25; // 인물 몸 높이·머리 꼭대기(칸 위쪽에서 몇 칸 위) — 말풍선·이름표·느낌표 자리 기준
  var SPRITE_DIR = 'assets/sprites/';
  /*
   * 맵 표시 두 가지(그림: assets/markers/, tools/marker-art.mjs — 공통 팩 말풍선·팔레트로 맞춘 16칸 픽셀 그림, 정수 배로 키워 그림)
   *  ▸ 목적지 핀(dest.png, 금색 핀 + 느낌표): 이번 걷기 구간의 목적지가 '사물·장소'일 때 그 위에.
   *    목적지가 다른 장면이면(사람이든 사물이든) 지금 장면에서 그쪽으로 가는 출입구 위에. 화면 밖이면 가장자리에 붙이고 화살표.
   *  ▸ 물음표 말풍선(talk.png, ?): 같은 장면에 있는 인물 중 말을 걸어 볼 만한 사람 머리 위에.
   *    (1) 목적지 인물(trig.target.npc) — 말을 걸면 사건이 열린다. 같은 장면이면 핀 대신 이 ?가 목적지 표시를 맡는다(겹치지 않게 하나만).
   *    (2) 이 걷기 구간에서 할 말이 있는 인물(trig.castLines)
   *    (3) 지금까지의 선택에 반응하는 한 줄이 있는 인물(world.js IDLE에서 조건(if)이 맞는 줄 — 기본 줄만 있으면 ? 없음)
   *    (2)(3)은 직접 말을 걸면(Space·말 걸기 버튼·탭) 이 걷기 구간에서 사라진다. 지나가며 저절로 뜬 말풍선은 말 건 것으로 치지 않는다.
   *    말을 거는 것은 대사만 보여 준다 — 관계·플래그·엔딩 점수는 바뀌지 않는다.
   *  둘 다 모양·글자(!·?)로 구분되고(색만으로 구분하지 않음), 버튼 글자와 지도 설명(aria-label)에도 같은 내용이 글로 나온다.
   *  위아래로 살짝 흔들림(움직임 줄이기면 멈춤).
   */
  var MARK = { dest: null, talk: null };
  ['dest', 'talk'].forEach(function (k) {
    var im = new Image();
    im.onload = function () { MARK[k] = im; };
    window.PrivacyImg.load(im, 'assets/markers/' + k + '.png');
  });
  var ROW = { down: 0, left: 1, right: 2, up: 3 };
  var KEY_DIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
  var CHAR_COLOR = window.PrivacySprite.COLOR; // 관계 보고 얼굴 대체색과 같은 색
  var TINT = { day: null, evening: 'rgba(255,181,100,0.08)', night: 'rgba(41,63,118,0.18)' };

  var o = null;                 // init 옵션
  var canvas, ctx, wrap;
  var active = false, raf = null, tmr = null, lastT = 0;
  var camS = null, camT = 0, camTarget = { x: 0, y: 0 }, frameDt = 0; // 걷기 카메라(camS): 데드존 — 가운데 상자를 벗어날 때만 바로 따라감. camTarget = 그 목표(프로브용)
  var stageTint = null; // 장면 무대의 시간대(STAGES tint, 없으면 시각 줄로 정함)
  var mode = null, stageInfo = null, focus = null, gen = 0; // gen: show()마다 +1(지난 인사말이 새 걷기를 넘기지 않게) // focus: 장면 중 주인공을 둘 화면 위치(비율). 폰·선택 상자에 가리지 않게 // mode: 'walk'(걷기·입력) | 'stage'(장면 무대: 그리기만)
  var run = null, trig = null, targetId = null;
  var cast = [], blocked = {};
  var me = { x: 0, y: 0, dir: 'down', fx: 0, fy: 0, moving: false, t: 0, from: null, to: null, door: null, frame: 0 };
  var held = [], queued = null, path = null, actOnArrive = false, busy = false;
  // 디버그: ?debug=1 = 걷는 칸·막힘·출입구·조사 지점 색 표시 + '목적지로 바로 가기' 버튼(교사 확인용), ?debug=grid = 색 표시만
  var DEBUG = { grid: false, skip: false };
  // 가상 조이스틱: on = 손가락이 닿아 있음, dx·dy = 방향(-1~1), mag = 밀어낸 정도(0~1). lastAxis = 대각선에서 번갈아 걷기용
  // live = ENTER를 넘어 입력 중, walking = 이번 입력에서 걷기 시작함(살짝 민 첫 입력 구분), sector = 지금 방향 'h'|'v'|'d', pushAt = 입력이 시작된 때
  var joy = { on: false, dx: 0, dy: 0, mag: 0, lastAxis: null, id: null, start: null, rest: null, live: false, walking: false, sector: null, pushAt: 0 };
  var guideUntil = 0; // 같은 상대에게 3번째 말 걸면 잠깐 방향 안내(출구 반짝임·화살표)를 강조
  // 2026-11-03 플레이테스트
  var DOOR_HOLD_MS = 280, stepHold = 0; // 문을 지난 뒤 이때까지 누르고 있던 키·조이스틱으로는 걷지 않는다(문 지나자마자 다시 문으로 들어가는 일 방지). 0 = 멈춤 없음
  var arrived = null;  // 방금 지나온 출입구: { scene: 떠나온 장면 id, steps: 도착 뒤 걸은 칸 수 } — 2칸 걷거나 다른 상대가 생기면 null
  var nudge = null, nudgeK = 0; // 말 거는 동안 두 인물을 밀어 그리는 양(칸): { c, mx, cx }. 실제 칸 좌표는 그대로
  var walkTint = null; // 걷기 중 시간대를 잠깐 바꿈(침대에 누우면 밤)
  var bubbles = [], T = 40, viewW = 0, viewH = 0, cam = { x: 0, y: 0 }, dpr = 1;
  var sprites = {}, lastArea = '', lastLook = null;
  var WALK_FILES = {
    'char_player_m.png': 'boy', 'char_player_f.png': 'girl',
    'char_hayun.png': 'saebom', 'char_seoa.png': 'jiho',
    'char_dohyun.png': 'haneul', 'char_minjun.png': 'minjun', 'char_teacher.png': 'teacher'
  };
  // 임시 도형의 머리 모양(색이 아니라 실루엣으로도 구분)
  var HAIR = { saebom: 'long', jiho: 'pony', haneul: 'short', minjun: 'short', teacher: 'short', friend: 'short' };

  function $(id) { return document.getElementById(id); }

  /* ── 스프라이트(있으면) ─────────── */
  // official = 공통 팩 규격 그림 주소(PrivacyCast). 있으면 먼저 쓰고, 못 불러오면 옛 시트로 내려간다
  function loadSprite(key, file, official) {
    if (sprites[key] !== undefined) return;
    sprites[key] = null;
    var character = WALK_FILES[file];
    // A late response from a previous player selection must not replace the new one.
    var token = {};
    sprites[key] = token;
    if (official) {
      var oi = new Image();
      oi.onload = function () {
        if (sprites[key] !== token) return;
        oi.privacyOfficial = true; // 공통 팩 그림은 색 보정(palette) 없이 그대로
        sprites[key] = oi;
      };
      oi.onerror = function () { if (sprites[key] === token) load(!!character); };
      oi.src = official;
      return;
    }
    function load(modern) {
      var im = new Image();
      im.onload = function () {
        if (sprites[key] !== token) return;
        if (modern && (im.naturalWidth % 4 || im.naturalHeight % 4 || im.naturalWidth * 3 !== im.naturalHeight * 2)) { load(false); return; }
        im.privacyModern = modern;
        sprites[key] = modern ? im : window.PrivacyPalette.image(im, true);
      };
      im.onerror = function () {
        if (sprites[key] !== token) return;
        if (modern) load(false); else sprites[key] = false;
      };
      im.src = modern ? 'assets/characters-v3/walk-' + character + '.png' : SPRITE_DIR + file;
    }
    load(!!character);
  }

  /* ── 대상 ─────────────────────── */
  function targetBox() {
    if (trig.target.npc) {
      var c = cast.filter(function (k) { return k.who === trig.target.npc; })[0];
      return { x: c.x, y: c.y, w: 1, h: 1, who: c.who, name: o.story.characters[c.who].name };
    }
    var ob = WD.object(trig.target.obj);
    return { x: ob.x, y: ob.y, w: ob.w, h: ob.h, obj: ob, name: ob.name };
  }
  function boxContains(b) { return function (x, y) { return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h; }; }
  function routeToTarget() { return WD.findPath({ x: me.x, y: me.y }, WD.adjacentTo({ contains: boxContains(targetBox()) }), blocked); }

  /* ── 열기·닫기 ─────────────────── */
  function show(r) {
    run = r;
    targetId = r.mapTarget;
    trig = WD.triggers[targetId];
    cast = trig.cast.slice();
    passGreeted = {}; talked = {}; talkMarks = []; lastLabel = '';
    streak = { who: null, n: 0 }; guideUntil = 0;
    arrived = null; stepHold = 0; nudge = null; walkTint = null;
    blocked = {};
    cast.forEach(function (c) { blocked[c.x + ',' + c.y] = true; loadSprite(c.who, 'char_' + c.who + '.png', window.PrivacyCast.walk(c.who)); });
    var look = o.playerLook();
    if (look !== lastLook) { delete sprites.me; lastLook = look; }
    loadSprite('me', 'char_player_' + look + '.png', window.PrivacyCast.walk('me', look));
    loadSprite('minjun_sleep', 'minjun_sleep.png', window.PrivacyCast.sleep());

    var pos = o.loadPos();
    var newDay = false;
    if (pos && pos.for === targetId) place(pos);
    else if (trig.spawn) { place(WD.SPAWNS[trig.spawn]); newDay = true; }
    else if (pos) place(pos);
    else place(WD.SPAWNS.classroom);
    nudgeFree();
    savePos();

    $('m-time').textContent = trig.time;
    $('m-mission').textContent = trig.mission;
    held = []; path = null; actOnArrive = false; busy = false; bubbles = []; tapWant = null;
    mode = 'walk'; stageInfo = null; focus = null; gen++; camS = null;
    lastArea = '';
    updateArea();
    // 첫 안내: 터치 기기에서 조이스틱이 보이면 조이스틱으로 안내(world.js 글은 키보드·탭 기준)
    curHint = trig.hint && joyShown() ? '왼쪽 아래 조이스틱이나 화면을 눌러 걸어요' : trig.hint || '';
    say(curHint);
    active = true;
    joyLayout();
    resize();
    if (newDay) dayCard(trig.time);
    updateHint();
    lastT = performance.now();
    schedule();
  }
  // 장면 무대: 입력 없이 장소·인물·시간대만 그린다. card가 있으면 잠깐 컷 카드를 띄우고 끝나면 resolve
  function stage(st, opts) {
    opts = opts || {};
    mode = 'stage'; stageInfo = st; trig = null; targetId = null; focus = opts.focus || null; gen++; camS = null;
    stageTint = st.tint || WD.timeTint(opts.time); // tint가 없는 무대는 장면 첫 시각 줄(아침·오후·저녁·밤)로
    cast = st.cast.slice(); blocked = {}; nudge = null; walkTint = null; arrived = null; stepHold = 0;
    cast.forEach(function (c) { loadSprite(c.who, 'char_' + c.who + '.png', window.PrivacyCast.walk(c.who)); });
    var look = o.playerLook();
    if (look !== lastLook) { delete sprites.me; lastLook = look; }
    loadSprite('me', 'char_player_' + look + '.png', window.PrivacyCast.walk('me', look));
    loadSprite('minjun_sleep', 'minjun_sleep.png', window.PrivacyCast.sleep());
    place(st.me || WD.PLACES[st.place].me);
    held = []; path = null; actOnArrive = false; busy = false; bubbles = [];
    say('');
    lastArea = ''; updateArea();
    active = true; resize(); lastT = performance.now(); schedule();
    var c = $('cut');
    if (!opts.card) { c.hidden = true; return Promise.resolve(); }
    c.textContent = window.PrivacyEmph ? window.PrivacyEmph.plain(opts.card) : opts.card; c.hidden = false;
    var ms = o.instant() || o.reduceMotion() ? 900 : 1400;
    return new Promise(function (res) { setTimeout(function () { c.hidden = true; res(); }, ms); });
  }
  function clearBubbles() { bubbles = []; }
  function hide() { active = false; mode = null; held = []; path = null; joyRelease(); if (raf) cancelAnimationFrame(raf); clearTimeout(tmr); raf = null; }
  // 화면 갱신은 rAF, 탭이 가려지거나 rAF가 멈춘 환경에선 타이머가 대신 진행시킨다
  function schedule() {
    if (!active) return;
    if (raf) cancelAnimationFrame(raf);
    clearTimeout(tmr);
    raf = requestAnimationFrame(loop);
    tmr = setTimeout(function () { loop(performance.now()); }, 50);
  }
  function place(p) { me.x = p.x; me.y = p.y; me.dir = p.dir || 'down'; me.fx = p.x; me.fy = p.y; me.moving = false; me.pose = p.pose || null; }
  function nudgeFree() {
    if (WD.walkable(me.x, me.y, blocked)) return;
    if (!WD.walkable(me.x, me.y)) { var nw = WD.nearestWalkable(me.x, me.y, blocked); if (nw) { place({ x: nw.x, y: nw.y, dir: me.dir }); return; } }
    var p = WD.findPath({ x: me.x, y: me.y }, function (x, y) { return WD.walkable(x, y, blocked); }, {});
    if (!p) return;
    var cur = { x: me.x, y: me.y };
    p.forEach(function (d) { cur = WD.stepFrom(cur.x, cur.y, d, {}); });
    place({ x: cur.x, y: cur.y, dir: me.dir });
  }
  function savePos() { o.savePos({ x: me.x, y: me.y, dir: me.dir, for: targetId, v: WD.VERSION }); }
  // 이 걷기 구간에서 할 말(castLines)이 있는 인물 곁(2칸 안)을 지나가면, 말을 걸지 않아도 머리 위에 한 번 저절로 뜬다
  // (‘목적지로 바로 가기’로 지나쳐도 오프닝의 하늘이 인사를 놓치지 않게)
  var passGreeted = {};
  function greetPassing() {
    if (!trig || !trig.castLines) return;
    cast.forEach(function (c) {
      var line = trig.castLines[c.who];
      if (!line || passGreeted[c.who] || Math.abs(c.x - me.x) + Math.abs(c.y - me.y) > 2) return;
      passGreeted[c.who] = true;
      bubbleFor(c.who, o.fill(line));
    });
  }

  function dayCard(text) {
    var c = $('cut');
    c.textContent = text;
    c.hidden = false;
    setTimeout(function () { c.hidden = true; }, o.instant() ? 0 : 1400);
  }

  /* ── 이동 ─────────────────────── */
  // 한 칸 걷기 — 키보드·탭 경로·조이스틱·말 걸기 버튼(문 앞)이 모두 이 함수를 지난다(같은 충돌·출입구 판정)
  var curHint = '';
  function tryStep(dir, fromJoy) {
    me.dir = dir;
    var d = WD.DIRS[dir], nx = me.x + d[0], ny = me.y + d[1];
    if (!WD.walkable(nx, ny, blocked)) return false;
    var door = WD.DOORS[nx + ',' + ny] || null;
    // 나갈 조건이 있는 출입구(DOORS[].need = story.js 조건 문법, needText = '…해'): 못 나가면 이유를 한 줄로. 지금 지도엔 조건 있는 문이 없다
    if (door && door.need && !o.evalCond(door.need)) {
      var why = '먼저 ' + (door.needText || '할 일을 끝내') + '야 해요.';
      if ($('m-say').textContent !== why) flashSay(why);
      return false;
    }
    if (curHint && $('m-say').textContent === curHint) say(''); // 첫 걸음을 떼면 안내는 사라진다
    me.moving = true; me.t = 0;
    me.fast = !!fromJoy && joy.mag >= JOY.FAST; // 조이스틱을 끝까지 밀면 빠르게
    me.slow = !!fromJoy && joy.mag < JOY.SLOW;  // 살짝 밀면 천천히
    me.from = { x: me.x, y: me.y }; me.to = { x: nx, y: ny };
    me.door = door;
    return true;
  }
  function stepMs() { return me.fast ? Math.round(STEP_MS * 0.6) : me.slow ? Math.round(STEP_MS * JOY.SLOW_K) : STEP_MS; }
  function holding() { return stepHold > performance.now(); } // 문을 막 지난 한 박자
  function finishStep() {
    me.moving = false;
    var fromScene = me.door ? WD.sceneAt(me.to.x) : null; // 문을 지나는 걸음이면 떠나는 장면
    me.x = me.to.x; me.y = me.to.y;
    if (me.door) { if (window.PrivacySfxDoor) window.PrivacySfxDoor(); me.x = me.door.to[0]; me.y = me.door.to[1]; me.dir = me.door.dir; flashSay(me.door.say || (me.door.label === '집 안으로' ? '우리 집에 들어왔다.' : '밖으로 나왔다.')); } // 문마다 도착 문구(world.js door say)
    // 2026-11-03 플레이테스트: 문을 지나면 이전 장소에서 계산한 길·예약 입력을 버리고 멈춘다(옛: 남은 길을 새 장소에서 이어 걸어 방 안 책상 옆까지 혼자 갔다).
    //   누르고 있는 키·조이스틱은 DOOR_HOLD_MS 뒤에 다시 받는다(loop). 방금 지나온 출입구는 arrived로 기억해 버튼이 가리키지 않게 한다(doorNear)
    if (fromScene) {
      path = null; queued = null; actOnArrive = false; tapWant = null;
      arrived = { scene: fromScene.id, steps: 0 };
      stepHold = performance.now() + DOOR_HOLD_MS;
    } else if (arrived && (++arrived.steps >= 2 || neighbors().length)) arrived = null; // 2칸 걸었거나 다른 상대가 생기면 끝
    me.fx = me.x; me.fy = me.y;
    me.frame = (me.frame + 1) % 4;
    me.walked = (me.walked || 0) + 1; // 걸은 칸 수: 걷기 동작을 칸이 바뀌어도 이어 가게
    savePos();
    updateArea();
    updateHint();
    greetPassing();
    if (fromScene) return;
    if (path && path.length) { tryStep(path.shift()) || (path = null); return; }
    if (path && !path.length) {
      path = null;
      if (actOnArrive) { actOnArrive = false; act(); }
      return;
    }
    if (held.length) { queued = null; tryStep(held[held.length - 1]); }
    else if (queued) { var q = queued; queued = null; tryStep(q); }
    else if (joy.on) stepJoy();
  }
  function updateArea() {
    var a = WD.areaName(me.x, me.y);
    if (a !== lastArea) { lastArea = a; $('m-area').textContent = a ? '📍 ' + a : ''; if ($('m-say').textContent) sayLayout(); } // HUD 높이가 바뀌면 안내 한 줄도 따라 내려감
  }

  /* ── 상호작용 ───────────────────── */
  function neighbors() {
    var list = [], order = [me.dir, 'up', 'down', 'left', 'right'];
    order.forEach(function (dir) {
      var d = WD.DIRS[dir], x = me.x + d[0], y = me.y + d[1];
      cast.forEach(function (c) { if (c.x === x && c.y === y) list.push({ type: 'npc', c: c, dir: dir }); });
      WD.OBJECTS.forEach(function (ob) {
        if (x >= ob.x && x < ob.x + ob.w && y >= ob.y && y < ob.y + ob.h) list.push({ type: 'obj', ob: ob, dir: dir });
      });
    });
    return list;
  }
  function isTarget(n) { return trig.target.npc ? n.type === 'npc' && n.c.who === trig.target.npc : n.type === 'obj' && n.ob.id === trig.target.obj; }
  function nearTarget() { return neighbors().some(isTarget); }

  function act() {
    if (mode !== 'walk') return;
    if (window.PrivacyTalk.isOpen()) { window.PrivacyTalk.next(); return; }
    if (busy || me.moving) return;
    var spoke = pick();
    tapWant = null; // 누른 상대에게 한 번 말 걸면 끝
    if (!spoke) { say('가까이 가서 눌러 보세요. {!}는 갈 곳, {?}는 말 걸어 볼 사람이에요.'); return; }
    if (spoke.type === 'door') { say(''); tryStep(spoke.dir); return; } // 문 매트 옆: 버튼으로도 나간다(걸어서 밟는 것과 같은 tryStep)
    var t = isTarget(spoke) ? spoke : null;
    var fresh = spoke.type === 'npc' && !!talkReason(spoke.c); // ?가 떠 있던 사람(할 말이 남아 있음)
    var whoKey = spoke.type === 'npc' ? spoke.c.who : 'obj:' + spoke.ob.id;
    streak = streak.who === whoKey ? { who: whoKey, n: streak.n + 1 } : { who: whoKey, n: 1 }; // 같은 상대에게 연속 몇 번째인지
    if (spoke.type === 'npc') { talked[spoke.c.who] = true; updateHint(); } // 말 건 사람의 ?는 이번 걷기에서 지운다(버튼 글자도 바로 따라감)
    if (t) {
      me.dir = t.dir;
      busy = true;
      say('');
      if (t.type === 'obj' && t.ob.id === 'bed') lieDown();
      var who0 = t.type === 'npc' ? t.c.who : null;
      // greet 줄의 met: 이 걷기에서 그 인물들을 모두 마주쳤을 때(지나가며 인사 말풍선·말 걸기)만 text, 아니면 alt(없으면 줄 생략)
      var greet = [].concat(trig.greet || []).map(function (g) {
        if (g && g.met && !g.met.every(function (w) { return passGreeted[w] || talked[w]; })) return g.alt ? { who: g.who, text: g.alt } : null;
        return g;
      }).filter(Boolean).map(function (g) { return typeof g === 'string' ? personLine(who0, g) : personLine(g.who || null, g.text); });
      var g0 = gen;
      talk(greet).then(function () { busy = false; if (active && mode === 'walk' && gen === g0) o.onEnter(); });
      if (t.type === 'npc') setNudge(t.c);
      return;
    }
    var n = spoke;
    me.dir = n.dir;
    say('');
    if (n.type === 'npc') {
      var lines = WD.idle[n.c.who] || [{ text: '…' }];
      var hit = lines.filter(function (l) { return o.evalCond(l.if); })[0];
      var own = trig.castLines && trig.castLines[n.c.who]; // 이 걷기 구간에서만 하는 말(오프닝 자기소개 등)
      var out = [personLine(n.c.who, own || hit.text)];
      // 할 말이 끝난 사람(?가 없던 사람)에게 또 말을 걸면: 대사 뒤에 다음 목적지 한 줄. 같은 사람에게 3번째부터는 더 또렷하게
      var loud = streak.n >= 3, nudge = !fresh;
      // 2026-11-02 요일·상황별 한마디(js/idle-lines.js): ?가 없던 사람은 이 걷기 구간의 줄을 차례로(안내 없이) →
      //   다 쓴 뒤 첫 번째 되풀이부터 다음 목적지 한 줄, 두 번째 되풀이부터 더 또렷하게. 줄이 없는 사람은 위 옛 방식
      var dl = !fresh && window.PrivacyIdleLines && window.PrivacyIdleLines.next(targetId, n.c.who, o.evalCond);
      if (dl) { out[0] = personLine(n.c.who, dl.text); nudge = dl.over > 0; loud = dl.over >= 2; }
      if (nudge) out.push({ who: null, name: null, text: nudgeText(loud) });
      var g1 = gen;
      setNudge(n.c);
      talk(out).then(function () {
        if (!loud || fresh || !active || mode !== 'walk' || gen !== g1) return;
        // 3번째부터: 바로 가기 대신 방향 안내를 강조(주인공 옆 화살표 + 출구 반짝임을 몇 초 더 또렷하게)
        var away = WD.sceneAt(targetBox().x) !== WD.sceneAt(me.x);
        say('{!} 목적지: ' + targetBox().name + (away ? ' — 반짝이는 출구와 화살표를 따라가요.' : ' — 화살표 쪽으로 가 보세요.'));
        guideUntil = performance.now() + 6000;
      });
    } else {
      talk([{ who: null, name: null, text: WD.lookFor(n.ob, trig && trig.time) }]); // 매점처럼 날마다 바뀌는 문구
    }
  }
  // 2026-11-03 플레이테스트: 스프라이트 폭이 한 칸보다 넓어(약 1.3칸) 바로 옆 칸 사람과 말하면 몸이 반쯤 겹쳤다 →
  //   대화 중에만 두 사람을 서로 반대쪽으로 0.25칸씩 그린다. 위아래로 붙으면 좌우로 0.3칸씩 비킨다. 칸 좌표·충돌은 그대로, 대화가 끝나면(draw) 돌아온다.
  //   엎드린 민준이는 의자에 앉아 있어 밀지 않는다
  function setNudge(c) {
    if (!c || c.pose) return;
    var dx = c.x - me.x, k = dx ? 0.25 : 0.3, side = dx ? (dx > 0 ? 1 : -1) : 1;
    nudge = { c: c, mx: -side * k, cx: side * k };
    nudgeK = 0;
  }
  function nudgeX(c) { return nudge && nudge.c === c ? nudge.cx * nudgeK : 0; }
  function nudgeMe() { return nudge ? nudge.mx * nudgeK : 0; }
  // 침대 조사로 장면이 열릴 때(2026-11-03 플레이테스트, greet '침대에 눕자…'): 침대 위에 누운 모습 + 밤 조명. 칸 좌표는 그대로 두고 그리는 자리만 옮긴다
  function lieDown() {
    var b = WD.BED_ME;
    me.fx = b.x; me.fy = b.y; me.dir = 'down'; me.pose = 'lie';
    walkTint = 'night';
    if (!o.reduceMotion()) fadeUntil = performance.now() + 260;
  }
  // 'saebom: 대사' 형식이면 말한 사람을 그 이름으로, 아니면 기본 화자로
  function personLine(who, text) {
    var m = /^(\w+): ([\s\S]*)$/.exec(text);
    if (m && o.story.characters[m[1]]) { who = m[1]; text = m[2]; }
    return { who: who, name: who ? o.story.characters[who].name : null, text: o.fill(text) };
  }
  // 대화창에 줄이 뜰 때 말하는 사람이 맵에 있으면 머리 위에도 짧게
  // 글자 속 {!}·{?}를 지도 표시 그림(목적지 핀·물음표 말풍선)으로. 그림마다 읽어 줄 이름을 단다
  var ICON = { '{!}': ['ico-quest', '목적지 표시(느낌표 핀)'], '{?}': ['ico-talk', '물음표 말풍선'] };
  function rich(node, text) {
    node.textContent = '';
    String(text).split(/(\{!\}|\{\?\})/).forEach(function (part) {
      if (ICON[part]) { var ic = document.createElement('span'); ic.className = ICON[part][0]; ic.setAttribute('role', 'img'); ic.setAttribute('aria-label', ICON[part][1]); node.appendChild(ic); }
      else if (part) node.appendChild(document.createTextNode(part));
    });
  }
  // 대화 초상화 = 공통 팩 초상화 시트(기본 표정). 맵에서 말 걸기·오프닝에 쓴다
  function portraitFor(who) {
    return window.PrivacyCast.id(who, o.playerLook()) ? { who: who, look: o.playerLook(), expr: 'neutral' } : null;
  }
  function talk(lines) {
    return window.PrivacyTalk.open(lines, { instant: o.instant(), portrait: portraitFor, onLine: function (l) {
      var c = cast.filter(function (k) { return k.who === l.who; })[0];
      if (c) setBubble(c, l.text);
    } });
  }
  // 짧은 안내(문 드나들기·길 안내)는 대화창 대신 무대 위 한 줄로
  var sayTimer = null;
  function say(text, speaker) {
    clearTimeout(sayTimer);
    $('m-say').classList.remove('fade-out');
    if (text && speaker) setBubble(speaker, text);
    rich($('m-say'), text || '');
    if (text) sayLayout(); // 보일 때만 자리 계산(매 프레임 계산하면 헤드리스 프로브가 느려졌다)
  }
  // 잠깐 알리는 말(문 드나들기 등): 1.3초 보인 뒤 0.5초에 걸쳐 사라진다(움직임 줄이기면 바로)
  function flashSay(text) {
    say(text);
    var n = $('m-say');
    sayTimer = setTimeout(function () {
      n.classList.add('fade-out');
      sayTimer = setTimeout(function () { if (n.textContent === text) say(''); else n.classList.remove('fade-out'); }, o.reduceMotion() ? 0 : 500);
    }, 1300);
  }
  // 말 걸기·조사하기가 향할 상대: 목적지 > ?가 뜬 사람 > (바라보는 쪽부터) 그냥 옆에 있는 사람·사물. 버튼 글자도 같은 상대를 가리킨다
  //   단, 화면에서 사람·사물을 눌러 걸어간 경우(tapWant)는 누른 그 상대
  var tapWant = null;
  function pick() {
    var ns = neighbors();
    var tapped = tapWant && ns.filter(function (n) { return tapWant.npc ? n.type === 'npc' && n.c.who === tapWant.npc : n.type === 'obj' && n.ob.id === tapWant.obj; })[0];
    return tapped || ns.filter(isTarget)[0] || ns.filter(function (n) { return n.type === 'npc' && talkReason(n.c); })[0] || ns[0] || doorNear();
  }
  // 바로 옆(바라보는 쪽 먼저)에 출입구 칸이 있으면 { type:'door', door, dir } — 말 걸기 버튼이 '○○ 가기'가 된다
  //   2026-11-03 플레이테스트: 방금 지나온 출입구(arrived)는 고르지 않는다 — 도착하자마자 큰 버튼이 '교실로 가기'처럼 되돌아가는 문을 가리켜,
  //   진행 버튼인 줄 알고 누르면 왔던 곳으로 돌아갔다. 걸어서 매트를 다시 밟는 것은 그대로 된다(tryStep)
  function doorNear() {
    var order = [me.dir, 'up', 'down', 'left', 'right'];
    for (var i = 0; i < order.length; i++) {
      var d = WD.DIRS[order[i]], x = me.x + d[0], y = me.y + d[1], door = WD.DOORS[x + ',' + y];
      if (door && WD.walkable(x, y, blocked) && !(arrived && door.scene === arrived.scene)) return { type: 'door', door: door, dir: order[i] };
    }
    return null;
  }
  // 다음 목적지 한 줄: 할 일(mission) '집에 가서 쉬기 — 내 방 컴퓨터' → '지금은 집에 가서 쉬자. (내 방 컴퓨터)'
  var streak = { who: null, n: 0 };
  function nudgeText(loud) {
    var parts = String(trig.mission || '').split(' — ');
    var line = '지금은 ' + parts[0].replace(/기$/, '자') + '.' + (parts[1] ? ' (' + parts[1] + ')' : '');
    return loud ? '같은 말만 돌아온다. ' + line : line;
  }
  function updateHint() {
    var p = pick(), near = !!p && isTarget(p);
    var btn = $('btn-map-act');
    // ?는 지도에 실제로 ?가 뜬 사람(목적지 인물·할 말이 남은 사람)에게만. 그냥 옆에 있는 사람은 이름만, 버튼도 보조 모양(ghost)
    var asks = !!p && !near && p.type === 'npc' && !!talkReason(p.c);
    var ex = p && p.type === 'door' ? exitToward() : null;
    var way = !!ex && p.door.to[0] === ex.door.to[0] && p.door.to[1] === ex.door.to[1]; // 목적지 쪽 출구
    rich(btn, !p ? '말 걸기 · 조사하기'
      : near ? (trig.target.npc ? '{?} ' + targetBox().name + '에게 말 걸기' : '{!} ' + targetBox().name + ' 조사하기')
      : p.type === 'door' ? (way ? '{!} ' : '') + p.door.label + ' 가기'
      : p.type === 'npc' ? (asks ? '{?} ' : '') + o.story.characters[p.c.who].name + '에게 말 걸기'
      : p.ob.name + ' 조사하기');
    btn.classList.toggle('primary', near || way);
    btn.classList.toggle('ghost', !near && !asks && !way);
    updateLabel();
  }
  // ? 표시 이유: 'target' 목적지 인물 · 'lines' 이번 걷기에서 할 말 · 'react' 지금까지의 선택에 반응하는 한 줄 · null 없음
  var talked = {};
  function talkReason(c) {
    if (!trig || mode !== 'walk') return null;
    if (trig.target.npc === c.who) return 'target';
    if (talked[c.who]) return null;
    if (trig.castLines && trig.castLines[c.who]) return 'lines';
    var hit = (WD.idle[c.who] || []).filter(function (l) { return o.evalCond(l.if); })[0];
    return hit && hit.if ? 'react' : null;
  }
  // 지도 설명(aria-label): 목적지와 ?가 뜬 사람을 글로
  var lastLabel = '';
  function updateLabel() {
    if (!trig || !canvas) return;
    var sc = WD.sceneAt(me.x);
    var names = cast.filter(function (c) { return WD.sceneAt(c.x) === sc && c.who !== trig.target.npc && talkReason(c); })
      .map(function (c) { return o.story.characters[c.who].name; });
    var label = '학교와 마을 지도. 방향키로 걷고 Space로 말을 겁니다. 목적지: ' + targetBox().name + '.'
      + (names.length ? ' 물음표 말풍선이 뜬 사람(할 말이 있어 보임): ' + names.join(', ') + '.' : '');
    if (label !== lastLabel) { lastLabel = label; canvas.setAttribute('aria-label', label); }
  }

  // 목적지로 바로 가기: 일반 플레이에서는 버튼이 숨겨져 있고(index.html hidden) ?debug=1에서만 보인다(교사 확인용).
  //   검증 프로브(?probe=…)는 숨은 버튼을 눌러 사건 장면으로 빨리 간다. 도착 처리(말 걸기 → o.onEnter)는 걸어서 온 것과 같다.
  function skipToTarget() {
    if (mode !== 'walk' || !DEBUG.skip) return;
    if (busy) return;
    var p = routeToTarget();
    if (!p) { say('지금은 그곳으로 갈 수 없어요.'); return; }
    var cur = { x: me.x, y: me.y };
    p.forEach(function (d) { var n = WD.stepFrom(cur.x, cur.y, d, blocked); cur = { x: n.x, y: n.y }; });
    path = null; held = [];
    place({ x: cur.x, y: cur.y, dir: me.dir });
    var b = targetBox();
    // 대상을 바라보게
    ['up', 'down', 'left', 'right'].forEach(function (dir) {
      var d = WD.DIRS[dir];
      if (boxContains(b)(me.x + d[0], me.y + d[1])) me.dir = dir;
    });
    savePos(); updateArea(); updateHint();
    say(b.name + ' 앞에 왔어요. ' + (b.obj ? '조사하기' : '말 걸기') + '를 눌러 보세요.'); // 사물이면 '조사하기'
    $('btn-map-act').focus();
  }

  /* ── 입력 ─────────────────────── */
  function overlayOpen() { return !$('menu').hidden || !$('confirm').hidden; }
  function onKeyDown(e) {
    if (mode !== 'walk' || overlayOpen() || e.altKey || e.ctrlKey || e.metaKey) return;
    var tag = (e.target && e.target.tagName) || '';
    var dir = KEY_DIR[e.key];
    if (dir) {
      e.preventDefault();
      if (window.PrivacyTalk.isOpen()) { if (busy) return; window.PrivacyTalk.close(); } // 걸으면 대화창은 닫힌다(목적지 인사말은 끝까지)
      if (e.repeat && held.indexOf(dir) >= 0) return; // 길게 누름은 held로 이어 간다
      path = null; actOnArrive = false; tapWant = null;
      if (joy.on) joyRelease(); // 2026-11-05 사용자 피드백: 키를 누르면 조이스틱 입력은 끝(둘이 섞여 번갈아 걷지 않게)
      if (held.indexOf(dir) < 0) held.push(dir);
      if (!me.moving && !busy && !holding()) { if (!tryStep(dir)) queued = null; }
      else queued = dir; // 걷는 중 짧게 누른 키: 지금 칸이 끝나면 한 칸(문을 막 지난 한 박자 동안 누른 키도)
      return;
    }
    if ((e.key === ' ' || e.key === 'Enter') && tag !== 'BUTTON' && tag !== 'INPUT') { e.preventDefault(); act(); }
  }
  function onKeyUp(e) {
    var dir = KEY_DIR[e.key];
    if (dir) { var i = held.indexOf(dir); if (i >= 0) held.splice(i, 1); }
  }
  function onPointer(e) {
    if (mode !== 'walk' || busy) return;
    if (joy.on && joy.live) return; // 2026-11-05 사용자 피드백: 조이스틱을 미는 동안 다른 손가락 탭은 받지 않는다(탭 길과 조이스틱이 섞이지 않게)
    if (window.PrivacyTalk.isOpen()) { window.PrivacyTalk.close(); return; }
    if (me.moving && me.door) return; // 문을 지나는 중(건너편 장면으로 옮겨지는 걸음)
    // 걷는 중에 누르면 지금 걸음이 끝나는 칸에서 새 길을 잇는다(예전엔 떠난 칸에서 계산해 한 칸 어긋났다 — 문 매트 연타)
    var from = me.moving ? { x: me.to.x, y: me.to.y } : { x: me.x, y: me.y };
    var r = canvas.getBoundingClientRect();
    var tx = Math.floor((e.clientX - r.left + cam.x) / T), ty = Math.floor((e.clientY - r.top + cam.y) / T);
    var pin = pinAt(e.clientX - r.left, e.clientY - r.top); // 목적지 핀(사람이 아닌 사물·출입구)을 눌렀으면 그 자리로
    if (pin) { tx = pin.tx; ty = pin.ty; }
    var npc = cast.filter(function (c) { return c.x === tx && c.y === ty; })[0] || (pin ? null : markAt(e.clientX - r.left, e.clientY - r.top));
    var ob = WD.DOORS[tx + ',' + ty] ? null : WD.objectAt(tx, ty) || WD.OBJECTS.filter(function (b) { return tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h; })[0];
    var p;
    if (npc || ob) {
      var box = npc ? { x: npc.x, y: npc.y, w: 1, h: 1 } : ob;
      p = WD.findPath(from, WD.adjacentTo({ contains: boxContains(box) }), blocked);
      actOnArrive = true;
      tapWant = npc ? { npc: npc.who } : { obj: ob.id };
    } else {
      var tp = tapPath(tx, ty, from);
      p = tp && tp.dirs;
      actOnArrive = false; tapWant = null;
      if (tp && !tp.dirs.length && !tp.exact) { flashSay('그곳으로는 갈 수 없어요.'); return; } // 막힌 곳인데 더 가까이 갈 칸도 없음
    }
    if (!p) { actOnArrive = false; return; }
    held = [];
    if (me.moving) { path = p; return; } // 이 걸음이 끝나면 finishStep이 이어 간다(빈 길이면 도착 처리)
    if (!p.length) { if (actOnArrive) { actOnArrive = false; faceBox(npc ? { x: npc.x, y: npc.y, w: 1, h: 1 } : ob); act(); } return; }
    path = p;
    if (!me.moving) tryStep(path.shift());
  }
  // 물음표 말풍선을 눌러도 그 사람에게 가서 말 걸기(머리 위 그림이라 사람 칸보다 위에 있음)
  //   화면 밖·HUD 밑이라 옮겨 그린(off) 목적지 인물 ?도 그려진 자리를 누르면 그 사람에게(2026-11-02 모바일: 옮긴 ?를 누르면 그 아래 칸으로 걷기만 했다)
  function markAt(x, y) {
    var marks = talkMarks.slice();
    if (lastMarker && lastMarker.who && lastMarker.x != null) marks.push(lastMarker);
    var hit = marks.filter(function (m) { return Math.abs(x - m.x) <= m.w / 2 + 4 && Math.abs(y - m.y) <= m.h / 2 + 4; })[0];
    return hit ? cast.filter(function (c) { return c.who === hit.who; })[0] : null;
  }
  // 목적지 핀(사물·장소·출입구)을 눌렀나: 핀은 칸 위에 떠 있어 누른 칸이 목적지와 다르다 → 핀이 가리키는 칸 { tx, ty }
  //   출입구를 가리키는 핀이면 그 출입구 칸(아래 tapPath가 문 옆 칸까지 + 문 쪽 한 걸음으로 지나간다)
  function pinAt(x, y) {
    var m = lastMarker;
    if (!m || m.who || m.x == null || m.hidden) return null;
    if (Math.abs(x - m.x) > m.w / 2 + 6 || Math.abs(y - m.y) > m.h / 2 + 6) return null;
    if (WD.DOORS[m.tx + ',' + m.ty]) return { tx: m.tx, ty: m.ty };
    var b = targetBox();
    return b.obj ? { tx: b.x, ty: b.y } : null;
  }
  function faceBox(b) {
    ['up', 'down', 'left', 'right'].forEach(function (dir) { var d = WD.DIRS[dir]; if (boxContains(b)(me.x + d[0], me.y + d[1])) me.dir = dir; });
  }
  // 빈 곳을 눌렀을 때 갈 길: 지금 장면 안에서 걸어서 닿는 칸(+ 그 옆 출입구 칸) 중 누른 칸에 가장 가까운 곳.
  //   WD.findPath는 출입구 칸을 밟는 순간 건너편으로 옮겨서 출입구 칸 자체를 목표로 못 잡는다(옛 버그: 문 매트를 눌러도 반응 없음)
  //   → 출입구 칸은 '문 옆 칸까지 + 문 쪽 한 걸음'으로. 거리가 같으면 출입구 우선(그림의 매트가 문 칸보다 조금 넓다), 그다음 짧은 길.
  //   돌려주는 값 { dirs, exact(누른 칸 그대로인가), door } 또는 null
  function tapPath(tx, ty, from) {
    from = from || { x: me.x, y: me.y };
    var sc = WD.sceneAt(from.x), start = from.x + ',' + from.y, prev = {}, seen = {}, q = [{ x: from.x, y: from.y }];
    function dist(x, y) { return Math.abs(x - tx) + Math.abs(y - ty); }
    var best = { d: dist(from.x, from.y), door: false, key: start };
    function better(d, door) { return d < best.d || (d === best.d && door && !best.door); }
    seen[start] = true;
    while (q.length) {
      var cur = q.shift(), ck = cur.x + ',' + cur.y;
      for (var dir in WD.DIRS) {
        var v = WD.DIRS[dir], nx = cur.x + v[0], ny = cur.y + v[1], nk = nx + ',' + ny;
        if (seen[nk] || !WD.walkable(nx, ny, blocked)) continue;
        seen[nk] = true;
        if (WD.DOORS[nk]) { if (better(dist(nx, ny), true)) best = { d: dist(nx, ny), door: true, key: ck, dir: dir }; continue; }
        if (WD.sceneAt(nx) !== sc) continue;
        prev[nk] = { from: ck, dir: dir };
        if (better(dist(nx, ny), false)) best = { d: dist(nx, ny), door: false, key: nk };
        q.push({ x: nx, y: ny });
      }
    }
    var dirs = [], k = best.key;
    while (prev[k]) { dirs.unshift(prev[k].dir); k = prev[k].from; }
    if (best.door) dirs.push(best.dir);
    return { dirs: dirs, exact: best.d === 0, door: best.door };
  }

  /* ── 가상 조이스틱(터치 기기) ─────────────
   * #joy = 왼쪽 아래(말 걸기 버튼 위) 보이지 않는 터치 영역. 그 안을 누른 자리에 받침이 나타나고(플로팅), 떼면 기본 자리로 돌아간다.
   * 평소 40% · 누르는 중 80% 불투명(css). 8방향: 대각선은 가로·세로를 번갈아 한 칸씩(격자 이동), 한쪽이 막히면 다른 쪽.
   * 2026-11-05 사용자 피드백(너무 예민함): 수치는 파일 위쪽 JOY 한 곳. 살짝 민 첫 입력 = 방향만, 계속 밀면 걷기, 끝까지 = 빠르게.
   *   방향은 지금 칸(sector)을 HOLD_DEG만큼 유지하고, 대각선 폭을 좁혀 곧게 밀 때 옆으로 튀지 않게 했다.
   *   이동은 키보드와 같은 tryStep → 충돌·출입구·도착 처리가 같다. 문을 지난 한 박자(holding) 동안은 걷지 않는다.
   * 영역(받침보다 조금 큰 자리)은 걷기 카메라가 피하는 자리라, 주인공·출구는 늘 그 밖에 보인다.
   */
  function isTouch() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0 || !!(window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches);
  }
  function joyShown() { return isTouch() && (!o.joystick || o.joystick() !== false); }
  // 각도(0 = 가로, 90 = 세로) → 방향 칸. 지금 칸은 HOLD_DEG만큼 더 넓게 봐서 경계에서 떨려도 바뀌지 않는다
  function joySector(ang) {
    var lo = 45 - JOY.DIAG, hi = 45 + JOY.DIAG, keep = JOY.HOLD_DEG, s = joy.sector;
    if (s === 'h' && ang < lo + keep) return 'h';
    if (s === 'v' && ang > hi - keep) return 'v';
    if (s === 'd' && ang >= lo - keep && ang <= hi + keep) return 'd';
    return ang < lo ? 'h' : ang > hi ? 'v' : 'd';
  }
  function joyDirs() {
    if (!joy.on || !joy.live) return [];
    var ax = Math.abs(joy.dx), ay = Math.abs(joy.dy), h = joy.dx > 0 ? 'right' : 'left', v = joy.dy > 0 ? 'down' : 'up';
    joy.sector = joySector(Math.atan2(ay, ax) * 180 / Math.PI);
    if (joy.sector === 'h') return [h];
    if (joy.sector === 'v') return [v];
    return joy.lastAxis === 'h' ? [v, h] : [h, v]; // 대각선: 지난 걸음과 다른 축 먼저
  }
  function joyFace(dir) { if (me.dir !== dir) { me.dir = dir; updateHint(); } } // 말 걸기 상대가 바뀔 수 있어 버튼도 따라간다
  function stepJoy() {
    if (mode !== 'walk' || busy || me.moving || holding()) return false;
    var ds = joyDirs();
    if (!ds.length) { joy.walking = false; return false; } // 멈춰 선 채 손을 가운데로 돌렸다 = 다음 입력은 다시 첫 입력
    if (!joy.walking) { // 첫 입력: 살짝 밀면 TURN_MS 동안 방향만(톡 건드리면 돌아보기만), 세게 밀면 바로
      joyFace(ds[0]);
      if (joy.mag < JOY.PUSH && performance.now() - joy.pushAt < JOY.TURN_MS) return false;
      joy.walking = true;
    }
    for (var i = 0; i < ds.length; i++) {
      if (tryStep(ds[i], true)) { joy.lastAxis = ds[i] === 'left' || ds[i] === 'right' ? 'h' : 'v'; return true; }
    }
    joyFace(ds[0]); // 막혀도 그쪽을 바라본다(말 걸기 상대가 바뀜)
    return false;
  }
  // 받침 기본 자리(영역 왼쪽 아래)와 영역 크기: 말 걸기 버튼 바로 위, 위 HUD 아래까지
  function joyLayout() {
    var z = $('joy');
    if (!z) return;
    z.hidden = !(joyShown() && mode === 'walk');
    if (z.hidden) { joy.rest = null; return; }
    var vm = $('v-map').getBoundingClientRect(), ctl = document.querySelector('#v-map .map-controls').getBoundingClientRect();
    var hud = $('hud').getBoundingClientRect();
    if (!vm.height) return; // 아직 화면에 없음
    var key = [vm.left, vm.top, vm.width, vm.height, ctl.top, ctl.left, hud.bottom].map(Math.round).join(',');
    if (key === joy.layoutKey && joy.rest) return; // 그대로면 다시 쓰지 않는다(매 프레임 확인)
    joy.layoutKey = key;
    // 버튼 줄이 조이스틱 자리(왼쪽 min(46%, 200px))와 가로로 겹칠 때만 그 위로. 가로 화면처럼 버튼이 오른쪽에 있으면 맨 아래 왼쪽
    var over = ctl.left - vm.left < Math.min(vm.width * 0.46, 200) + 4;
    var bottom = over ? Math.max(8, vm.bottom - ctl.top + 6) : 8;
    z.style.bottom = bottom + 'px';
    z.style.height = (JOY.R * 2 + 28) + 'px';
    var zr = z.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
    joy.restAt = { x: 16 + JOY.R, y: zr.height - 6 - JOY.R }; // 영역 안 좌표(받침 가운데)
    if (!joy.on) joyPut(joy.restAt.x, joy.restAt.y);
    // 캔버스 좌표의 조이스틱 영역 전체: 걷기 카메라가 이 자리를 피해 주인공·출구를 그 밖에 둔다
    joy.rest = { x0: zr.left - cr.left, y0: zr.top - cr.top, x1: zr.right - cr.left, y1: zr.bottom - cr.top };
  }
  // 짧은 안내 한 줄(#m-say)은 위 HUD 바로 아래에(say()가 글을 띄울 때마다)(360 폭에서 HUD가 3줄이 되면 고정 top 84px이 '지금 할 일'을 덮었다)
  var sayTop = null;
  function sayLayout() {
    var hud = $('hud'), st = $('stage');
    if (!hud || !st || !hud.getClientRects().length) return;
    var top = Math.round(hud.getBoundingClientRect().bottom - st.getBoundingClientRect().top + 6);
    if (top !== sayTop) { sayTop = top; $('m-say').style.top = top + 'px'; }
  }
  function joyPut(x, y) { var b = document.querySelector('#joy .joy-base'); if (b) { b.style.left = x + 'px'; b.style.top = y + 'px'; } }
  function joyKnob(x, y) { var k = document.querySelector('#joy .joy-knob'); if (k) k.style.transform = 'translate(' + x + 'px,' + y + 'px)'; }
  function joyRelease() {
    joy.on = false; joy.dx = joy.dy = joy.mag = 0; joy.id = null; joy.start = null;
    joy.live = false; joy.walking = false; joy.sector = null;
    var z = $('joy');
    if (!z) return;
    z.classList.remove('active');
    joyKnob(0, 0);
    if (joy.restAt) joyPut(joy.restAt.x, joy.restAt.y);
  }
  function joyDown(e) {
    if (mode !== 'walk' || overlayOpen() || joy.id !== null) return;
    e.preventDefault();
    var z = $('joy'), zr = z.getBoundingClientRect();
    try { z.setPointerCapture(e.pointerId); } catch (err) { /* 합성 이벤트 */ }
    // 받침이 영역 밖으로 반쯤 나가지 않게
    var x = Math.max(JOY.R, Math.min(zr.width - JOY.R, e.clientX - zr.left)), y = Math.max(JOY.R, Math.min(zr.height - JOY.R, e.clientY - zr.top));
    // 2026-11-05 사용자 피드백: 민 거리는 손가락이 처음 닿은 자리부터 잰다. 옛 기준(영역 안으로 끌어당긴 받침 가운데)은 영역 가장자리를 누르면 최대 40px쯤 어긋나,
    //   손가락이 살짝만 떨려도 끝까지 민 것처럼 빠르게 걸었다
    joy.id = e.pointerId; joy.start = { x: e.clientX, y: e.clientY, t: performance.now() };
    joy.on = true; joy.dx = joy.dy = joy.mag = 0; joy.live = false; joy.walking = false; joy.sector = null;
    joyPut(x, y); joyKnob(0, 0);
    z.classList.add('active');
  }
  function joyMove(e) {
    if (joy.id !== e.pointerId || !joy.on) return;
    e.preventDefault();
    var dx = e.clientX - joy.start.x, dy = e.clientY - joy.start.y, len = Math.sqrt(dx * dx + dy * dy);
    var k = len > JOY.R ? JOY.R / len : 1;
    joyKnob(dx * k, dy * k);
    joy.mag = Math.min(1, len / JOY.R);
    joy.dx = len ? dx / len : 0; joy.dy = len ? dy / len : 0;
    var was = joy.live;
    joy.live = joy.mag >= (was ? JOY.LEAVE : JOY.ENTER);
    if (!joy.live) { joy.sector = null; return; } // 놓은 것으로 침(걷던 칸은 마저 걷는다)
    if (!was) joy.pushAt = performance.now();
    if (window.PrivacyTalk.isOpen()) { if (busy) return; window.PrivacyTalk.close(); } // 걸으면 대화창은 닫힌다(키보드와 같이)
    path = null; actOnArrive = false; tapWant = null; held = []; queued = null; // 입력이 섞이지 않게 탭 길·키 예약은 버린다
    stepJoy();
  }
  function joyUp(e) {
    if (joy.id !== e.pointerId) return;
    joyRelease(); // 톡 눌렀다 뗀 것은 아무 일 없음(땅 탭으로 넘기면 받침 밑 엉뚱한 곳 — 예: 방 출구 — 으로 걸어가 버렸다)
  }

  /* ── 그리기 ─────────────────────── */
  function resize() {
    if (!active) return;
    var cssW = wrap.clientWidth;
    var cssH = Math.max(240, wrap.clientHeight);
    dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    if (cssW !== viewW || cssH !== viewH) camS = null; // 회전·크기 변화 뒤 걷기 카메라를 내 캐릭터 기준으로 다시(가장자리·버튼 밑에 남지 않게)
    viewW = cssW; viewH = cssH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  function loop(t) {
    if (raf) cancelAnimationFrame(raf);
    clearTimeout(tmr);
    raf = null;
    if (!active) return;
    // 경과 시간을 걸음 단위로 소비(타이머가 느리게 와도 이동 속도는 일정)
    var dt = Math.max(0, Math.min(1000, t - lastT)); lastT = t;
    frameDt = Math.min(100, dt);
    while (me.moving && dt > 0) {
      var need = (1 - me.t) * stepMs();
      if (dt >= need) { dt -= need; me.t = 1; finishStep(); }
      else { me.t += dt / stepMs(); dt = 0; }
    }
    if (overlayOpen() && (path || held.length || queued || joy.on)) { path = null; held = []; queued = null; actOnArrive = false; tapWant = null; joyRelease(); } // 메뉴 뒤에서 계속 걷지 않게
    if (stepHold && !holding()) { // 문을 지난 한 박자가 끝남: 그동안 누르고 있던 키로 다시 걷는다
      stepHold = 0;
      if (mode === 'walk' && !busy && !me.moving && !path) {
        if (held.length) { queued = null; tryStep(held[held.length - 1]); }
        else if (queued) { var q0 = queued; queued = null; tryStep(q0); }
      }
    }
    if (!me.moving && joy.on && mode === 'walk' && !busy && !path) stepJoy(); // 막혀 있다가 방향을 바꾸면 바로 다시 걷는다
    if (me.moving) { me.fx = me.from.x + (me.to.x - me.from.x) * me.t; me.fy = me.from.y + (me.to.y - me.from.y) * me.t; }
    draw(t);
    schedule();
  }
  // 걷기 동작: 반 칸마다 한 프레임(한 칸에 2프레임), 칸이 바뀌어도 이어진다
  function walkFrame() { return me.moving ? Math.floor(((me.walked || 0) + me.t) * 2) % 4 : 0; }
  // 장면 그림(world.js SCENES[].img): 장면마다 한 장. 못 불러오면 단색 바닥 + 걷는 칸 윤곽
  var sceneImg = {};
  function sceneImage(sc, field) {
    var key = sc.id + (field || ''), src = sc[field || 'img'];
    if (!src) return null;
    if (sceneImg[key] === undefined) {
      var im = new Image();
      sceneImg[key] = null;
      im.onload = function () { sceneImg[key] = im; };
      im.onerror = function () { sceneImg[key] = false; };
      window.PrivacyImg.load(im, src);
    }
    return sceneImg[key];
  }
  // 줄여 그리는 장면(SCENES[].bg, 2026-11-03 플레이테스트)의 그림 바깥: bgOuter 그림이 있으면 장면 전체에, 없으면 단색 바닥 + 칸 윤곽.
  //   막힌 칸 중 벽은 벽 색(거실 위쪽 벽은 내 방 그림처럼 크림 벽 + 초록 징두리), 조사 지점 box(식탁·소파)는 색을 채운 칸
  var OUTER = { floor: '#D8B98C', line: 'rgba(120,80,40,0.14)', wall: '#F3E6CB', trim: '#7C9270', edge: '#6E5A45', ink: '#294B40',
    table: ['#B98A5A', '#D2A777'], sofa: ['#6F8C7A', '#8CA998'] };
  function drawOuter(sc, bx, by) {
    var oi = sceneImage(sc, 'bgOuter');
    if (oi) { ctx.drawImage(oi, bx, by, Math.round(WD.SW * T), Math.round(WD.SH * T)); return; }
    var c = Math.ceil(T), gx, gy;
    ctx.fillStyle = OUTER.floor; ctx.fillRect(bx, by, Math.round(WD.SW * T), Math.round(WD.SH * T));
    ctx.fillStyle = OUTER.line;
    for (gy = 0; gy < WD.SH * 2; gy++) ctx.fillRect(bx, by + gy * T / 2, Math.round(WD.SW * T), 1); // 마룻널
    for (gy = 0; gy < WD.SH; gy++) for (gx = 0; gx < WD.SW; gx++) {
      if (WD.grid[gy][sc.ox + gx] !== '#') continue;
      var below = gy + 1 < WD.SH && WD.grid[gy + 1][sc.ox + gx] !== '#';
      ctx.fillStyle = gx >= 20 && gy < 5 ? (gy === 4 ? OUTER.trim : OUTER.wall) : OUTER.edge;
      if (below && gy === 4 && gx >= 20) ctx.fillStyle = OUTER.trim;
      ctx.fillRect(Math.round(bx + gx * T), Math.round(by + gy * T), c, c);
    }
    WD.OBJECTS.forEach(function (ob) {
      if (!ob.box || WD.sceneAt(ob.x) !== sc) return;
      var col = OUTER[ob.box], x = bx + (ob.x - sc.ox) * T, y = by + ob.y * T, w = ob.w * T, h = ob.h * T;
      ctx.fillStyle = col[0]; roundRect(x + 2, y + 2, w - 4, h - 4, 6); ctx.fill();
      ctx.strokeStyle = OUTER.ink; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = col[1]; roundRect(x + T * 0.2, y + T * 0.2, w - T * 0.4, h - T * 0.55, 4); ctx.fill();
    });
  }
  var STAGE_ZOOM = 1.3; // 장면 무대: 폰·선택 상자 옆에 인물이 보이게 조금 당겨 본다(보이는 영역 가운데로 카메라 이동)
  var lastScene = null, fadeUntil = 0, lastView = null;
  // 장면 무대에서 지도를 가리는 것(폰·모니터 창, 선택 상자, 대화창)을 뺀 '보이는 지도 영역'(캔버스 좌표).
  // 가리는 상자들의 가장자리로 캔버스를 나눈 사각형 중, 어떤 상자와도 겹치지 않는 가장 넓은 것(넓은 화면: 폰 오른쪽·선택 상자 위 / 휴대폰: 아래 시트 위).
  var OCCLUDERS = ['#g-phone', '#g-dock', '#talk'];
  // 걷기 중 지도를 가리는 것: 위 HUD, 아래 말 걸기 버튼 줄, 조이스틱 받침(기본 자리) — 주인공·끝 줄(출구 매트)이 그 밑에 숨지 않게
  var WALK_OCCLUDERS = ['#hud', '#v-map .map-controls'];
  function freeRect(sel, extra) {
    var cr = canvas.getBoundingClientRect(), boxes = [], xs = [0, viewW], ys = [0, viewH];
    function add(r) {
      r = { x0: Math.max(0, r.x0), y0: Math.max(0, r.y0), x1: Math.min(viewW, r.x1), y1: Math.min(viewH, r.y1) };
      if (r.x1 <= r.x0 || r.y1 <= r.y0) return;
      boxes.push(r); xs.push(r.x0, r.x1); ys.push(r.y0, r.y1);
    }
    (sel || OCCLUDERS).forEach(function (q) {
      var e = document.querySelector(q);
      if (!e || e.hidden || !e.getClientRects().length) return;
      var b = e.getBoundingClientRect();
      if (b.width < 8 || b.height < 8) return; // 빈 선택 상자 자리
      add({ x0: b.left - cr.left, y0: b.top - cr.top, x1: b.right - cr.left, y1: b.bottom - cr.top });
    });
    (extra || []).forEach(add);
    var best = { x0: 0, y0: 0, x1: viewW, y1: viewH }, bestA = boxes.length ? -1 : Infinity;
    for (var a = 0; a < xs.length && boxes.length; a++) for (var b2 = 0; b2 < xs.length; b2++) {
      if (xs[b2] - xs[a] < 80) continue;
      for (var c = 0; c < ys.length; c++) for (var d = 0; d < ys.length; d++) {
        if (ys[d] - ys[c] < 80) continue;
        var cand = { x0: xs[a], x1: xs[b2], y0: ys[c], y1: ys[d] }, area = (cand.x1 - cand.x0) * (cand.y1 - cand.y0);
        if (area <= bestA) continue;
        if (boxes.some(function (o) { return o.x0 < cand.x1 && cand.x0 < o.x1 && o.y0 < cand.y1 && cand.y0 < o.y1; })) continue;
        best = cand; bestA = area;
      }
    }
    return bestA < 0 ? { x0: 0, y0: 0, x1: viewW, y1: viewH } : best; // 남는 곳이 아주 좁으면 화면 전체 기준
  }
  // 카메라 한 축: want = 원하는 카메라 위치, 장면 a0~a0+len, 보이는 영역 v0~v1(캔버스 좌표), full = 캔버스 길이.
  // 보이는 영역이 장면 안에 들어오게 하고, 되도록 캔버스 전체도 장면 안에(가려진 곳 틈으로도 빈 곳이 안 보이게).
  // loose(2026-11-03 플레이테스트): 줄여 그린 내 방은 침대가 장면 왼쪽 끝이라, 캔버스 전체를 장면 안에 두면 주인공이 폰 뒤에 숨었다 →
  //   보이는 영역만 장면 안에 두고 폰 뒤로는 장면 밖(흐린 배경)이 와도 되게 한다
  function fitAxis(want, a0, len, v0, v1, full, loose) {
    if (len <= v1 - v0) return a0 + len / 2 - (v0 + v1) / 2; // 장면이 더 작으면 보이는 영역 가운데
    var lo = a0 - v0, hi = a0 + len - v1;
    if (!loose && len >= full && Math.max(lo, a0) <= Math.min(hi, a0 + len - full)) { lo = Math.max(lo, a0); hi = Math.min(hi, a0 + len - full); }
    return Math.max(lo, Math.min(hi, want));
  }
  // 걷기 카메라 한 축: 장면이 캔버스 가운데에 놓여도 가림 상자에 안 걸리면 옛 배치(가운데), 보이는 영역보다 작으면 그 가운데,
  // 크면 장면 끝이 보이는 영역 안으로 들어오지 않게(가림 상자 밑으로는 흐린 배경이 보일 수 있음) — 끝 칸도 가림 없이 볼 수 있다
  function walkAxis(want, a0, len, v0, v1, full) {
    if (len <= full && (full - len) / 2 >= v0 - 0.5 && (full + len) / 2 <= v1 + 0.5) return a0 - (full - len) / 2;
    if (len <= v1 - v0) return a0 + len / 2 - (v0 + v1) / 2;
    return Math.max(a0 - v0, Math.min(a0 + len - v1, want));
  }
  // 장면 그림 바깥(장면이 화면보다 작을 때 남는 곳): 검정 대신 같은 그림을 아주 작게 줄였다 키운 흐린 배경 + 살짝 어둡게
  var blurImg = {};
  function drawBackdrop(sc, img) {
    ctx.fillStyle = '#1F2A27';
    ctx.fillRect(0, 0, viewW, viewH);
    if (!img) return;
    var b = blurImg[sc.id];
    if (!b) {
      b = blurImg[sc.id] = document.createElement('canvas');
      b.width = 32; b.height = 18;
      var bc = b.getContext('2d');
      bc.imageSmoothingEnabled = true; bc.imageSmoothingQuality = 'high';
      bc.drawImage(img, 0, 0, 32, 18);
    }
    var s = Math.max(viewW / 32, viewH / 18);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(b, (viewW - 32 * s) / 2, (viewH - 18 * s) / 2, 32 * s, 18 * s);
    ctx.restore();
    ctx.fillStyle = 'rgba(15,20,18,0.35)';
    ctx.fillRect(0, 0, viewW, viewH);
  }
  // 저녁·밤(2026-11-02): 장면 그림은 낮 그림이라 옛 옅은 덮개(TINT)만으로는 창밖·햇빛 무늬가 낮처럼 보였다.
  //   → 인물을 그리기 전에 그림 층에만 색을 곱한다(multiply). 밤 = 남색(창밖 하늘·바닥 햇빛 무늬가 함께 어두워짐), 저녁 = 노을빛.
  //   밤의 내 방은 책상 불빛(SCENES[].lamp)을 따뜻하게 밝힌다. 인물은 그 위에 그려 알아보기 쉽게 두고, 마지막에 TINT로 시간대만 맞춘다.
  var SCENE_MUL = { evening: 'rgb(244,200,164)', night: 'rgb(78,92,150)' };
  function sceneLight(sc, tint, bx, by) {
    if (!SCENE_MUL[tint]) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = SCENE_MUL[tint];
    ctx.fillRect(0, 0, viewW, viewH);
    if (tint === 'night' && sc.lamp) {
      var lx = bx + sc.lamp.x * T, ly = by + sc.lamp.y * T, lr = sc.lamp.r * T;
      var g = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      g.addColorStop(0, 'rgba(255,214,150,0.42)'); g.addColorStop(0.5, 'rgba(255,200,130,0.16)'); g.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = g;
      ctx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
    }
    ctx.restore();
  }
  function draw(t) {
    var sc = WD.sceneAt(Math.round(me.fx)) || WD.SCENES[0];
    if (lastScene && lastScene !== sc.id && !o.reduceMotion()) fadeUntil = t + 260; // 장면이 바뀌면 짧게 어두워졌다 밝아짐
    lastScene = sc.id;
    // 칸 크기: 넓은 화면은 장면 전체가 한눈에, 휴대폰은 칸이 28px 밑으로 줄지 않게(넘치면 주인공을 따라감)
    var fit = Math.min(viewW / WD.SW, viewH / WD.SH);
    T = Math.max(28, fit * (mode === 'stage' ? STAGE_ZOOM : 1));
    var sx0 = sc.ox * T, sw = WD.SW * T, sh = WD.SH * T;
    var px = me.fx * T + T / 2, py = me.fy * T + T / 2;
    var cx, cy;
    if (mode === 'stage') {
      // 장면 무대(2026-11-02 플레이테스트): 폰·선택 상자·대화창에 가리지 않는 '보이는 지도 영역'(freeRect) 가운데쯤에 주인공을 두되,
      // 카메라는 지금 장면 하나(ox~ox+SW, 0~SH) 안에서만 움직인다 — 장면 밖(검은 빈 곳)을 비추지 않게.
      // 보이는 영역이 장면보다 크면 장면을 그 영역 가운데에 두고, 남는 곳은 흐린 배경(drawBackdrop)이 채운다.
      var fr = freeRect();
      cx = fitAxis(px - (fr.x0 + fr.x1) / 2, sx0, sw, fr.x0, fr.x1, viewW, !!sc.bg);
      cy = fitAxis(py - (fr.y0 + (fr.y1 - fr.y0) * 0.62), 0, sh, fr.y0, fr.y1, viewH); // 몸이 칸 위로 2칸쯤 서므로 조금 아래에
      // 선택 상자가 늦게 나타나 영역이 바뀌면 부드럽게 옮겨 간다(움직임 줄이기·처음·크기 변경은 바로)
      var k = !camS || camS.T !== T || o.reduceMotion() ? 1 : Math.min(1, frameDt / 140);
      camS = { x: camS && k < 1 ? camS.x + (cx - camS.x) * k : cx, y: camS && k < 1 ? camS.y + (cy - camS.y) * k : cy, T: T };
      lastView = { T: T, free: fr, scene: { x0: sx0, y0: 0, x1: sx0 + sw, y1: sh } };
    } else {
      // 걷기: 데드존 카메라(보이는 영역 가운데 상자 안에서는 배경이 그대로).
      // 보이는 영역(wf) = HUD·버튼 줄·조이스틱 받침을 뺀 가장 넓은 빈 사각형(2026-11-02 모바일: 가로 화면에서 끝 줄 출구 매트가 버튼 밑에 숨었다).
      // 넓은 화면처럼 장면이 가운데에 그대로 다 보이면 옛 배치 그대로(PC 화면 불변).
      joyLayout(); // 버튼 글자 줄 수·화면 회전으로 버튼 줄 높이가 바뀌면 조이스틱 자리도 따라간다(바뀔 때만 씀)
      var wf = freeRect(WALK_OCCLUDERS, joy.rest && !$('joy').hidden ? [joy.rest] : []);
      var fcx = (wf.x0 + wf.x1) / 2, fcy = (wf.y0 + wf.y1) / 2;
      if (!camS || camT !== T || camS.scene !== sc.id) camS = { x: px - fcx, y: py - fcy, scene: sc.id };
      var hx = (wf.x1 - wf.x0) * 0.25, hy = (wf.y1 - wf.y0) * 0.2, ccx = camS.x + fcx, ccy = camS.y + fcy;
      if (px > ccx + hx) camS.x = px - hx - fcx; else if (px < ccx - hx) camS.x = px + hx - fcx;
      if (py > ccy + hy) camS.y = py - hy - fcy; else if (py < ccy - hy) camS.y = py + hy - fcy;
      camS.x = walkAxis(camS.x, sx0, sw, wf.x0, wf.x1, viewW);
      camS.y = walkAxis(camS.y, 0, sh, wf.y0, wf.y1, viewH);
      lastView = { T: T, free: wf, scene: { x0: sx0, y0: 0, x1: sx0 + sw, y1: sh } };
    }
    camTarget.x = camS.x; camTarget.y = camS.y;
    camT = T;
    cam.x = Math.round(camS.x); cam.y = Math.round(camS.y); // 정수 픽셀: 그림이 반 픽셀씩 떨리지 않게
    var img = sceneImage(sc), bx = Math.round(sx0 - cam.x), by = Math.round(-cam.y);
    drawBackdrop(sc, img);
    if (img) {
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      if (sc.bg) { // 줄여 그리는 장면: 바깥부터 깔고 그림은 bg 사각형에만(bg가 없는 장면은 옛 그대로)
        drawOuter(sc, bx, by);
        ctx.drawImage(img, Math.round(bx + sc.bg.x * T), Math.round(by + sc.bg.y * T), Math.round(sc.bg.w * T), Math.round(sc.bg.h * T));
      } else ctx.drawImage(img, bx, by, Math.round(sw), Math.round(sh));
      ctx.restore();
    } else {
      ctx.fillStyle = '#D9CBA8'; ctx.fillRect(bx, by, sw, sh);
      ctx.fillStyle = 'rgba(60,70,60,0.35)';
      for (var gy = 0; gy < WD.SH; gy++) for (var gx = 0; gx < WD.SW; gx++) if (WD.grid[gy][sc.ox + gx] === '#') ctx.fillRect(bx + gx * T, by + gy * T, T + 1, T + 1);
    }
    if (DEBUG.grid) debugGrid(sc, bx, by);
    // 공용 PC 3번: 그림의 컴퓨터 화면 옆 작은 번호표(목적지이거나 켜진 장면일 때 화면도 밝게)
    var pc = WD.object('pc3');
    if (pc && sc.id === 'library') {
      var on = (trig && trig.target.obj === 'pc3') || (stageInfo && stageInfo.place === 'library');
      var lx = (pc.x + 3.05) * T - cam.x, ly = (pc.y + 1.2) * T - cam.y;
      if (on) { ctx.fillStyle = 'rgba(160,230,255,0.35)'; ctx.fillRect(lx - T * 1.05, ly - T * 0.75, T * 1.1, T * 0.85); }
      ctx.fillStyle = '#FFFFFF'; roundRect(lx + T * 0.15, ly + T * 0.05, T * 0.42, T * 0.42, 3); ctx.fill();
      ctx.fillStyle = '#16201F'; ctx.font = 'bold ' + Math.round(T * 0.32) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pc.label || '3', lx + T * 0.36, ly + T * 0.27);
    }
    var tint = mode === 'stage' ? stageTint : walkTint || trig.tint || WD.timeTint(trig.time);
    sceneLight(sc, tint, bx, by);
    if (mode === 'walk') drawExitGlow(t); // 목적지 쪽 출구 칸 반짝임(인물 아래 바닥에)
    // 말 거는 동안 밀어 그리기(setNudge): 대화창이 닫히면 원래대로
    if (nudge) {
      if (window.PrivacyTalk.isOpen() || busy) nudgeK = o.reduceMotion() ? 1 : Math.min(1, nudgeK + frameDt / 120);
      else nudge = null;
    }
    var list = []; // 앞뒤 순서: { y: 아래쪽 행, fn } — 가구는 그림에 그려져 있으므로 인물만
    cast.forEach(function (c) {
      if (WD.sceneAt(c.x) !== sc) return;
      list.push({ y: c.y, fn: function () { drawPerson(c.who, o.story.characters[c.who].name, c.x + nudgeX(c), c.y, c.dir, 0, c.pose, false); } });
    });
    list.push({ y: me.fy + 0.01, fn: function () { drawPerson('me', o.playerName(), me.fx + nudgeMe(), me.fy, me.dir, walkFrame(), me.pose, me.moving); } });
    list.sort(function (a, b) { return a.y - b.y; });
    tags = [];
    list.forEach(function (d) { d.fn(); });
    drawTags();
    if (TINT[tint] && !(sc.id === 'room' && tint === 'day')) { ctx.fillStyle = TINT[tint]; ctx.fillRect(0, 0, viewW, viewH); }
    if (fadeUntil > t) { ctx.fillStyle = 'rgba(15,20,18,' + Math.min(1, (fadeUntil - t) / 260) + ')'; ctx.fillRect(0, 0, viewW, viewH); }
    if (mode === 'walk') { drawTalkMarks(t); drawMarker(t); drawGuide(t); }
    drawBubble(t);
  }
  // ?debug=1 · ?debug=grid: 걷는 칸(초록)·막힘(빨강)·출입구(파랑)·조사 지점(노랑)·사람이 막은 칸(보라)을 그림 위에 겹쳐 본다.
  //   목적지 쪽 출구는 하늘색 테두리, 내 칸은 흰 테두리, 목적지는 분홍 테두리(교사·작업자 눈 확인용)
  function debugGrid(sc, bx, by) {
    ctx.save();
    for (var gy = 0; gy < WD.SH; gy++) for (var gx = 0; gx < WD.SW; gx++) {
      var X = sc.ox + gx, door = WD.DOORS[X + ',' + gy], obj = WD.objectAt(X, gy);
      ctx.fillStyle = door ? 'rgba(40,90,230,0.5)' : obj ? 'rgba(240,200,30,0.42)' : WD.grid[gy][X] === '#' ? 'rgba(220,40,40,0.3)'
        : blocked[X + ',' + gy] ? 'rgba(150,60,200,0.4)' : 'rgba(40,200,90,0.22)';
      ctx.fillRect(bx + gx * T + 1, by + gy * T + 1, T - 2, T - 2);
    }
    function outline(x, y, w, h, col) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(x * T - cam.x + 1, y * T - cam.y + 1, w * T - 2, h * T - 2); }
    if (mode === 'walk' && trig) {
      exitCells().forEach(function (c) { outline(c.x, c.y, 1, 1, '#7FE3FF'); });
      var b = targetBox(); outline(b.x, b.y, b.w, b.h, '#FF5FA2');
    }
    outline(me.x, me.y, 1, 1, '#FFFFFF');
    ctx.restore();
  }
  // 목적지 쪽 출구(다른 장면으로 가야 할 때 지금 장면의 출입구 칸 묶음). 같은 장면이면 []
  function exitCells() {
    if (mode !== 'walk' || !trig || WD.sceneAt(targetBox().x) === WD.sceneAt(me.x)) return [];
    var ex = exitToward();
    if (!ex) return [];
    if (ex.cells) return ex.cells;
    var sc = WD.sceneAt(ex.x);
    ex.cells = Object.keys(WD.DOORS).filter(function (k) {
      var d = WD.DOORS[k], xy = k.split(',').map(Number);
      return d.to[0] === ex.door.to[0] && d.to[1] === ex.door.to[1] && WD.sceneAt(xy[0]) === sc;
    }).map(function (k) { var xy = k.split(',').map(Number); return { x: xy[0], y: xy[1] }; });
    return ex.cells;
  }
  // 출구 반짝임: 금색으로 은은하게 깜빡이는 칸 + 테두리 + 나가는 쪽 화살표(움직임 줄이기면 깜빡임 없이 고정)
  function drawExitGlow(t) {
    var cells = exitCells();
    if (!cells.length) return;
    var ex = exitToward(), boost = guideUntil > performance.now();
    var pulse = o.reduceMotion() ? 0.5 : 0.5 + 0.5 * Math.sin(t / 260);
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    ctx.save();
    cells.forEach(function (c) {
      var sx = c.x * T - cam.x, sy = c.y * T - cam.y;
      x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx + T); y1 = Math.max(y1, sy + T);
      ctx.fillStyle = 'rgba(255,214,102,' + ((boost ? 0.34 : 0.2) + 0.2 * pulse).toFixed(3) + ')';
      ctx.fillRect(sx, sy, T, T);
    });
    ctx.lineWidth = boost ? 4 : 3;
    ctx.strokeStyle = 'rgba(41,75,64,0.85)'; ctx.strokeRect(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2);
    ctx.lineWidth = boost ? 2.5 : 1.5;
    ctx.strokeStyle = '#FFE7A3'; ctx.strokeRect(x0 + 3, y0 + 3, x1 - x0 - 6, y1 - y0 - 6);
    // 반짝이 셋: 테두리 위를 천천히 돈다(움직임 줄이기면 제자리)
    var per = 2 * (x1 - x0 + y1 - y0);
    for (var i = 0; i < 3; i++) {
      var s = ((o.reduceMotion() ? 0 : t / 14) + i * per / 3) % per, sx2, sy2;
      if (s < x1 - x0) { sx2 = x0 + s; sy2 = y0; } else if ((s -= x1 - x0) < y1 - y0) { sx2 = x1; sy2 = y0 + s; }
      else if ((s -= y1 - y0) < x1 - x0) { sx2 = x1 - s; sy2 = y1; } else { s -= x1 - x0; sx2 = x0; sy2 = y1 - s; }
      sparkle(sx2, sy2, T * 0.16);
    }
    // 나가는 쪽 화살표(출구 묶음 가운데)
    var ang = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[ex.dir] || 0;
    var nudge = o.reduceMotion() ? 0 : Math.sin(t / 200) * T * 0.08;
    ctx.translate((x0 + x1) / 2 + Math.cos(ang) * nudge, (y0 + y1) / 2 + Math.sin(ang) * nudge); ctx.rotate(ang);
    arrowShape(T * (boost ? 0.42 : 0.34));
    ctx.restore();
  }
  function sparkle(x, y, r) {
    ctx.fillStyle = '#FFF6D5';
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.3, y - r * 0.3); ctx.lineTo(x + r, y); ctx.lineTo(x + r * 0.3, y + r * 0.3);
    ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.3, y + r * 0.3); ctx.lineTo(x - r, y); ctx.lineTo(x - r * 0.3, y - r * 0.3); ctx.closePath(); ctx.fill();
  }
  // 오른쪽을 가리키는 굵은 화살표(지금 변환 기준 가운데). 흰 몸 + 짙은 초록 테두리
  function arrowShape(s) {
    ctx.beginPath();
    ctx.moveTo(s, 0); ctx.lineTo(-s * 0.1, -s * 0.85); ctx.lineTo(-s * 0.1, -s * 0.35); ctx.lineTo(-s, -s * 0.35);
    ctx.lineTo(-s, s * 0.35); ctx.lineTo(-s * 0.1, s * 0.35); ctx.lineTo(-s * 0.1, s * 0.85); ctx.closePath();
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.lineWidth = Math.max(2, s * 0.16); ctx.strokeStyle = '#294B40'; ctx.lineJoin = 'round'; ctx.stroke();
  }
  // 방향 안내 강조(같은 상대에게 3번째 말 건 뒤 6초): 주인공 발치 옆에 목적지(또는 그쪽 출구) 쪽을 가리키는 화살표
  function drawGuide(t) {
    if (guideUntil <= performance.now() || !trig) return;
    var b = targetBox();
    if (WD.sceneAt(b.x) !== WD.sceneAt(me.x)) b = exitToward() || b;
    var px = (me.fx + 0.5) * T - cam.x, py = (me.fy + 0.5) * T - cam.y;
    var ang = Math.atan2((b.y + b.h / 2) * T - cam.y - py, (b.x + b.w / 2) * T - cam.x - px);
    var r = T * (1.1 + (o.reduceMotion() ? 0 : 0.12 * Math.sin(t / 180)));
    ctx.save(); ctx.translate(px + Math.cos(ang) * r, py + Math.sin(ang) * r); ctx.rotate(ang);
    arrowShape(T * 0.45);
    ctx.restore();
  }
  function drawPerson(who, name, fx, fy, dir, frame, pose, moving) {
    var sx = fx * T - cam.x, sy = fy * T - cam.y;
    if (sx < -T * 2 || sy < -T * 2 || sx > viewW + T || sy > viewH + T) return;
    var sheet = pose === 'sleep' ? sprites.minjun_sleep : sprites[who];
    if (sheet && sheet.naturalWidth && sheet.privacyOfficial) {
      // 공통 팩 규격: 칸 96×128, 발 기준점 (48,120). 몸(약 112px)이 옛 그림처럼 1.5타일 높이가 되게 줄이고 발을 타일 아래쪽에 맞춘다
      var C = window.PrivacyCast.CELL, s = T * BODY / C.body, dw = C.w * s, dh = C.h * s;
      var sm = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false; // 픽셀 그림
      // 2026-11-03 플레이테스트: 엎드린 민준이는 의자 칸에 앉은 모습(발 기준점 = 다른 인물과 같은 칸 아래). 옛 규칙(발 = 칸 위쪽)은 책상 위에 서 있는 것처럼 보였다
      if (pose === 'sleep') ctx.drawImage(sheet, 0, 0, C.w, C.h, sx + T / 2 - C.ax * s, sy + T - C.ay * s, dw, dh);
      else if (pose === 'lie') { // 침대에 누움: 위에서 본 침대라 정면 그림의 윗몸만 그리고, 아래는 그림의 이불에 맡긴다
        var lieH = C.h * 0.6;
        ctx.drawImage(sheet, window.PrivacyCast.STOP_FRAME * C.w, ROW.down * C.h, C.w, lieH, sx + T / 2 - C.ax * s, sy + T - C.ay * s, dw, lieH * s);
      } else {
        var f = moving ? frame : window.PrivacyCast.STOP_FRAME;
        ctx.drawImage(sheet, f * C.w, ROW[dir] * C.h, C.w, C.h, sx + T / 2 - C.ax * s, sy + T - C.ay * s, dw, dh);
      }
      ctx.imageSmoothingEnabled = sm;
    } else if (sheet && sheet.naturalWidth) {
      // 칸 = 가로 1타일 × 세로 1.5타일, 발밑이 타일 아래쪽에 오도록
      var fw = sheet.naturalWidth / (pose === 'sleep' ? 1 : 4), fh = sheet.naturalHeight / (pose === 'sleep' ? 1 : 4);
      if (pose === 'sleep') ctx.drawImage(sheet, 0, 0, fw, fh, sx, sy + T - T * 1.5, T, T * 1.5); // 의자 칸에 앉은 모습(2026-11-03 플레이테스트, 위 공통 팩 규칙과 같게)
      else {
        var smoothing = ctx.imageSmoothingEnabled;
        if (sheet.privacyModern) ctx.imageSmoothingEnabled = true;
        ctx.drawImage(sheet, frame * fw, ROW[dir] * fh, fw, fh, sx, sy + T - T * 1.5, T, T * 1.5);
        ctx.imageSmoothingEnabled = smoothing;
      }
    } else {
      var col = CHAR_COLOR[who] || '#777';
      var bob = frame % 2 ? -T * 0.04 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.ellipse(sx + T / 2, sy + T * 0.9, T * 0.3, T * 0.09, 0, 0, 7); ctx.fill();
      if (pose === 'sleep') {
        ctx.fillStyle = col; roundRect(sx + T * 0.15, sy - T * 0.15, T * 0.7, T * 0.5, T * 0.15); ctx.fill();
        ctx.fillStyle = '#F2D2B6'; ctx.beginPath(); ctx.arc(sx + T / 2, sy - T * 0.25, T * 0.22, 0, 7); ctx.fill();
        ctx.fillStyle = '#16201F'; ctx.font = Math.round(T * 0.32) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('z', sx + T * 0.85, sy - T * 0.55);
      } else {
        ctx.fillStyle = col; roundRect(sx + T * 0.2, sy + T * 0.3 + bob, T * 0.6, T * 0.6, T * 0.18); ctx.fill();
        var hair = who === 'me' ? (o.playerLook() === 'f' ? 'pony' : 'short') : HAIR[who];
        var hx = sx + T / 2, hy = sy + T * 0.18 + bob, hr = T * 0.27;
        ctx.fillStyle = '#4A3426';
        if (hair === 'long') { roundRect(hx - hr * 1.05, hy - hr * 0.6, hr * 2.1, hr * 1.9, hr * 0.8); ctx.fill(); }
        if (hair === 'pony') { var px = dir === 'left' ? hr : dir === 'right' ? -hr : hr * 0.95; ctx.beginPath(); ctx.ellipse(hx + px, hy + hr * 0.15, hr * 0.35, hr * 0.66, 0, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#F2D2B6'; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, 7); ctx.fill();
        ctx.fillStyle = '#4A3426';
        ctx.beginPath(); ctx.arc(hx, hy, hr * 1.02, Math.PI * 1.02, Math.PI * 1.98); ctx.fill(); // 앞머리
        if (dir === 'up') { ctx.beginPath(); ctx.arc(hx, hy, hr, 0, 7); ctx.fill(); }
        // 바라보는 방향(눈)
        ctx.fillStyle = '#16201F';
        var ex = dir === 'left' ? -0.1 : dir === 'right' ? 0.1 : 0;
        if (dir !== 'up') { ctx.fillRect(sx + T * (0.4 + ex), sy + T * 0.16 + bob, T * 0.06, T * 0.08); ctx.fillRect(sx + T * (0.54 + ex), sy + T * 0.16 + bob, T * 0.06, T * 0.08); }
        ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold ' + Math.round(T * 0.3) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(who === 'me' ? '나' : (o.story.characters[who] || {}).initial || '?', sx + T / 2, sy + T * 0.62 + bob);
      }
    }
    // 이름표(색이 아니라 글자로 구분) — 내 것은 머리 위, 다른 인물은 발밑. 실제 그리기는 drawTags()에서 겹침을 피해
    tags.push({ me: who === 'me', who: who, label: name.length > 8 ? name.slice(0, 8) + '…' : name, cx: sx + T / 2, y: who === 'me' ? sy - T * (HEAD + 0.35) : sy + T * 0.98, feet: sy + T * 0.98,
      body: pose === 'lie' ? null : { x0: sx - T * 0.1, x1: sx + T * 1.1, y0: sy + T - T * BODY, y1: sy + T * 0.98 } }); // body: 머리 꼭대기~발(이름표·? 겹침 판정)
  }
  var tags = [];
  function drawTags() {
    var fs = Math.max(12, Math.round(T * 0.26)), h = Math.max(T * 0.34, fs + 6), placed = [], top = mode === 'walk' ? safeArea().top : 0;
    var plaques = window.PrivacySchool && window.PrivacySchool.plaques ? window.PrivacySchool.plaques(T, cam) : [];
    function hit(r) { return placed.concat(plaques).some(function (q) { return r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h; }); }
    ctx.font = '600 ' + fs + 'px sans-serif';
    tags.sort(function (a, b) { return (b.me ? 1 : 0) - (a.me ? 1 : 0); }); // 내 이름표 먼저 자리 잡기
    // 2026-11-03 플레이테스트: 발밑 이름표가 다른 인물의 몸(머리 꼭대기~발)에 걸리면 얼굴을 덮는다 → 옆으로 비키고, 옆도 안 되면 그 이름표 주인의 머리 위로
    function onBody(r, self) {
      return tags.filter(function (q) { return q !== self && q.body && r.x < q.body.x1 && q.body.x0 < r.x + r.w && r.y < q.body.y1 && q.body.y0 < r.y + r.h; })[0];
    }
    function clearOfBodies(r, t) {
      var b = onBody(r, t);
      if (!b) return;
      var x0 = r.x;
      [b.body.x1 + 2, b.body.x0 - r.w - 2].some(function (x) { r.x = x; return !onBody(r, t) && !hit(r); }) || (r.x = x0);
      if (!onBody(r, t) && !hit(r)) return;
      r.x = x0; r.y = t.body ? t.body.y0 - h - 2 : r.y;
    }
    tags.forEach(function (t) {
      var w = ctx.measureText(t.label).width + 10, r = { x: t.cx - w / 2, y: t.y, w: w, h: h };
      if (t.me && r.y < top && t.feet != null) { r.y = t.feet; t.me = 'below'; } // 위 안내 상자에 가리면 내 발밑으로
      for (var k = 0; k < 3 && hit(r); k++) r.y += (t.me === true ? -1 : 1) * (h + 2);
      if (t.me !== true) clearOfBodies(r, t);
      placed.push(r);
      ctx.fillStyle = t.me ? 'rgba(15,118,110,0.92)' : 'rgba(22,32,31,0.72)';
      roundRect(r.x, r.y, w, h, 4); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.label, r.x + w / 2, r.y + h / 2);
    });
    lastTags = placed.map(function (r, i) { return { x: r.x, y: r.y, w: r.w, h: r.h, me: !!tags[i].me, label: tags[i].label, who: tags[i].who }; });
    lastBodies = tags.filter(function (q) { return q.body; }).map(function (q) { return { who: q.who, x0: q.body.x0, x1: q.body.x1, y0: q.body.y0, y1: q.body.y1 }; });
    tags = [];
  }
  // 이름표와 겹치지 않게(2026-11-02 모바일: 목적지 핀이 내 머리 위로 비켜 서며 내 이름표를 덮었다)
  //   표시 그림(가운데 mx,my · w×h)이 이름표에 걸리면 그 이름표 위로 올린다. 흔들림 폭만큼 여유를 둔다
  var lastTags = [], lastBodies = [];
  function tagHit(mx, my, w, h, pad) {
    return lastTags.filter(function (r) { return mx + w / 2 > r.x - 2 && mx - w / 2 < r.x + r.w + 2 && my + h / 2 + pad > r.y && my - h / 2 - pad < r.y + r.h; })[0];
  }
  function markPad() { return 3 + (o.reduceMotion() ? 0 : Math.ceil(T * 0.06)); }
  function aboveTags(mx, my, w, h) {
    var pad = markPad();
    for (var k = 0, hit; k < 4 && (hit = tagHit(mx, my, w, h, pad)); k++) my = hit.y - h / 2 - pad;
    return my;
  }
  // 2026-11-03 플레이테스트: ?가 다른 인물의 몸·이름표에 걸리면 그 사람 것처럼 보인다(민준이의 ?가 하늘이 이름표 옆) →
  //   걸린 것 반대쪽(대상 머리 위쪽)으로 x만 비킨다. 비켰으면 tail = true → drawTail이 대상 머리까지 꼬리를 잇는다
  function clearMark(c, mx, my, w, h) {
    var pad = markPad(), self = c.who;
    function blockers(x) {
      var a = lastBodies.filter(function (b) { return b.who !== self; })
        .concat(lastTags.filter(function (r) { return r.who !== self; }).map(function (r) { return { x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h }; }));
      return a.filter(function (b) { return x + w / 2 + 2 > b.x0 && x - w / 2 - 2 < b.x1 && my + h / 2 + pad > b.y0 && my - h / 2 - pad < b.y1; });
    }
    var hit = blockers(mx);
    if (!hit.length) return { x: mx, tail: false };
    var left = Math.min.apply(null, hit.map(function (b) { return b.x0; })) - w / 2 - 3;
    var right = Math.max.apply(null, hit.map(function (b) { return b.x1; })) + w / 2 + 3;
    var mid = (Math.min.apply(null, hit.map(function (b) { return b.x0; })) + Math.max.apply(null, hit.map(function (b) { return b.x1; }))) / 2;
    var order = mx >= mid ? [right, left] : [left, right]; // 대상 쪽(겹친 것에서 먼 쪽) 먼저
    for (var i = 0; i < 2; i++) if (Math.abs(order[i] - mx) <= T * 1.6 && !blockers(order[i]).length) return { x: order[i], tail: true };
    return { x: mx, tail: false }; // 비킬 자리가 없으면 옛 규칙(aboveTags)에 맡긴다
  }
  // ?에서 대상 머리까지 짧은 꼬리
  function drawTail(mx, my, h, c) {
    var hx = (c.x + nudgeX(c)) * T - cam.x + T / 2, hy = c.y * T - cam.y - T * (HEAD - (c.pose === 'sleep' ? 0.1 : 0)) + T * 0.1;
    ctx.save();
    ctx.strokeStyle = '#294B40'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(mx, my + h / 2 - 1); ctx.lineTo(hx, Math.max(my + h / 2 + 2, hy)); ctx.stroke();
    ctx.restore();
  }
  // 목적지 표시가 들어갈 수 있는 캔버스 안 영역: 위 HUD(시간·할 일·버튼) 아래, 아래 버튼·안내 문구 위
  var lastMarker = null;
  var saCache = { t: -1, v: null };
  function safeArea() {
    if (saCache.t === lastT && saCache.v) return saCache.v; // 한 프레임에 여러 번(이름표·표시) 불려도 한 번만 잰다
    var cr = canvas.getBoundingClientRect(), top = 6, bottom = viewH - 6;
    ['.hud-left', '.hud .bar-actions', '#m-say'].forEach(function (q) {
      var e = document.querySelector(q);
      if (e && e.getClientRects().length) top = Math.max(top, e.getBoundingClientRect().bottom - cr.top + 8);
    });
    ['#v-map .map-controls', '#v-map .map-help'].forEach(function (q) {
      var e = document.querySelector(q);
      if (e && e.getClientRects().length) bottom = Math.min(bottom, e.getBoundingClientRect().top - cr.top - 8);
    });
    if (bottom - top < 80) { top = 6; bottom = viewH - 6; } // 아주 좁으면 가림보다 표시를 우선
    saCache = { t: lastT, v: { left: 6, right: viewW - 6, top: top, bottom: bottom } };
    return saCache.v;
  }
  // 지금 자리에서 목적지까지 길 위의 첫 출입구 칸(같은 자리·목적지면 다시 계산하지 않음)
  var exitCache = { key: '', box: null };
  function exitToward() {
    var key = me.x + ',' + me.y + ',' + targetId;
    if (exitCache.key === key) return exitCache.box;
    var p = routeToTarget(), cur = { x: me.x, y: me.y }, box = null;
    for (var i = 0; p && i < p.length; i++) {
      var d = WD.DIRS[p[i]], nx = cur.x + d[0], ny = cur.y + d[1];
      if (WD.DOORS[nx + ',' + ny]) { box = { x: nx, y: ny, w: 1, h: 1, dir: p[i], door: WD.DOORS[nx + ',' + ny] }; break; }
      cur = { x: nx, y: ny };
    }
    exitCache = { key: key, box: box };
    return box;
  }
  // 표시 그림 크기: 16칸 그림을 정수 배로(칸 크기의 약 0.8, 최소 2배 = 32px) — 픽셀이 고르게 또렷하도록
  function markScale() { return Math.max(2, Math.round(T * 0.8 / 16)); }
  function markSize(kind) { var im = MARK[kind], s = markScale(); return im && im.naturalWidth ? { w: im.naturalWidth * s, h: im.naturalHeight * s } : { w: 16 * s, h: 16 * s }; }
  // 그림 하나를 (가운데 x, 가운데 y)에. 그림을 못 불러오면 같은 모양의 글자 상자(크림 바탕·잉크 테두리 + ! ?)
  function drawMark(kind, mx, my) {
    var im = MARK[kind], s = markScale();
    if (im && im.naturalWidth) {
      var w = im.naturalWidth * s, h = im.naturalHeight * s, sm = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(im, Math.round(mx - w / 2), Math.round(my - h / 2), w, h);
      ctx.imageSmoothingEnabled = sm;
      return { w: w, h: h };
    }
    var size = 16 * s;
    ctx.fillStyle = kind === 'dest' ? '#F3CF72' : '#FFF9E7';
    roundRect(mx - size / 2, my - size / 2, size, size, kind === 'dest' ? size / 2 : 4); ctx.fill();
    ctx.strokeStyle = '#294B40'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#294B40'; ctx.font = 'bold ' + Math.round(size * 0.6) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(kind === 'dest' ? '!' : '?', mx, my + 1);
    return { w: size, h: size };
  }
  // 위아래 살짝 흔들림(움직임 줄이기 = 0). 사람마다 박자를 조금 어긋나게
  function markBob(t, phase) { return o.reduceMotion() ? 0 : Math.round(Math.sin(t / 300 + (phase || 0)) * T * 0.06); }
  function headY(c) { return c.y * T - cam.y - T * (c.pose === 'sleep' ? HEAD + 0.3 : HEAD + 0.6); } // ? 가운데 자리(머리 꼭대기 위). 엎드린 그림은 머리가 낮아 조금 아래(2026-11-03 플레이테스트: 의자 칸으로 옮김)
  // 목적지 인물이 아닌 ? (목적지 인물의 ?는 drawMarker가 화면 밖 화살표까지 맡는다)
  var talkMarks = [];
  function drawTalkMarks(t) {
    talkMarks = [];
    var sc = WD.sceneAt(me.x), now = performance.now();
    cast.forEach(function (c, i) {
      if (WD.sceneAt(c.x) !== sc || c.who === trig.target.npc) return;
      var why = talkReason(c);
      if (!why) return;
      if (bubbles.some(function (b) { return b.who === c && b.until > now; })) return; // 말하는 중엔 말풍선만
      var sz = markSize('talk'), clr = clearMark(c, c.x * T - cam.x + T / 2, headY(c), sz.w, sz.h), mx = clr.x, my = aboveTags(mx, headY(c), sz.w, sz.h) + markBob(t, i * 1.7);
      if (clr.tail) drawTail(mx, my, sz.h, c);
      var d = drawMark('talk', mx, my);
      talkMarks.push({ who: c.who, why: why, x: mx, y: my, w: d.w, h: d.h, tx: c.x, ty: c.y, tail: clr.tail });
    });
    updateLabel(); // 장면이 바뀌거나 말을 걸면 지도 설명 글도 따라 바뀐다(바뀔 때만 다시 씀)
  }
  // 출구 핀(2026-11-03 플레이테스트): 옛 규칙은 '문 칸 윗변 - 0.55칸'이라 나가기 직전 서는 칸과 겹쳤고, 겹치면 내 머리·이름표 위로 밀려 올라갔다.
  //   또 경로상 첫 문 칸을 따라가서 매트를 걸을 때 좌우로 옮겨 다녔다. → 같은 출입구 칸 묶음 가운데에 고정하고 나를 피하지 않는다.
  //   자리: 위쪽 출구 = 매트 바로 바깥(문 쪽), 아래·왼쪽·오른쪽 출구 = 매트 위. 그 출입구 바로 옆에 서면 흐리게(매트 반짝임·화살표가 있다). 위쪽 출구는 그 자리가 내 머리·이름표라 숨긴다.
  //   화면 가림(safeArea)으로 밀리면 가장자리 띠 안으로 옮기되 머리 위로 올리지는 않는다.
  function drawExitPin(t, ex) {
    var cells = exitCells();
    var x0 = Math.min.apply(null, cells.map(function (c) { return c.x; })), x1 = Math.max.apply(null, cells.map(function (c) { return c.x; })) + 1;
    var y0 = Math.min.apply(null, cells.map(function (c) { return c.y; })), y1 = Math.max.apply(null, cells.map(function (c) { return c.y; })) + 1;
    var mid = cells[Math.floor(cells.length / 2)], ms = markSize('dest'), sa = safeArea(), iconSize = 16 * markScale();
    var cx = (x0 + x1) / 2 * T - cam.x, cy = (y0 + y1) / 2 * T - cam.y;
    var mx = cx, my = (ex.dir === 'up' ? y0 * T - cam.y - ms.h / 2 - 2 : cy) + markBob(t, 0), tx0 = mx, ty0 = my;
    mx = Math.max(sa.left + iconSize / 2, Math.min(sa.right - iconSize / 2, mx));
    my = Math.max(sa.top + iconSize / 2, Math.min(sa.bottom - iconSize / 2, my));
    var jr = joy.rest && !$('joy').hidden ? joy.rest : null; // 조이스틱 받침(기본 자리)에 걸리면 그 위로
    if (jr && mx + ms.w / 2 > jr.x0 && mx - ms.w / 2 < jr.x1 && my + ms.h / 2 > jr.y0 && my - ms.h / 2 < jr.y1) my = jr.y0 - ms.h / 2 - 4;
    var off = Math.abs(mx - tx0) > 2 || Math.abs(my - ty0) > 2;
    var dn = doorNear(), near = !!dn && dn.door.to[0] === ex.door.to[0] && dn.door.to[1] === ex.door.to[1];
    if (near && ex.dir === 'up') { lastMarker = { x: null, y: null, tx: mid.x, ty: mid.y, kind: 'dest', hidden: true, exit: true }; return; }
    ctx.save();
    if (near) ctx.globalAlpha = 0.4;
    var d = drawMark('dest', mx, my);
    ctx.restore();
    lastMarker = { x: mx, y: my, tx: mid.x, ty: mid.y, off: off, kind: 'dest', w: d.w, h: d.h, who: null, exit: true, dim: near };
    if (off) {
      var ang = Math.atan2(cy - my, cx - mx);
      ctx.fillStyle = '#294B40';
      ctx.save(); ctx.translate(mx + Math.cos(ang) * T * 0.45, my + Math.sin(ang) * T * 0.45); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  function drawMarker(t) {
    if (me.pose) { lastMarker = null; return; } // 침대에 누운 뒤
    var b = targetBox();
    // 목적지가 다른 장면이면, 지금 장면에서 그쪽으로 가는 출입구에(어디로 가야 하는지 바로 보이게)
    if (WD.sceneAt(b.x) !== WD.sceneAt(me.x)) {
      var ex = exitToward();
      if (ex && exitCells().length) { drawExitPin(t, ex); return; }
      b = ex || b;
    }
    var kind = b.who ? 'talk' : 'dest'; // 같은 장면의 목적지 인물 = ?, 나머지(사물·출입구) = 핀
    var tc = b.who ? cast.filter(function (k) { return k.who === b.who; })[0] : null;
    if (tc && bubbles.some(function (q) { return q.who === tc && q.until > performance.now(); })) { lastMarker = { x: null, y: null, tx: b.x, ty: b.y, kind: kind, hidden: true }; return; }
    var bob = markBob(t, 0), anchor = b.obj && b.obj.pin; // pin: 사물의 표시 기준점(침대 = 매트리스 가운데)
    var mx = anchor ? anchor.x * T - cam.x : (b.x + b.w / 2) * T - cam.x, my = tc ? headY(tc) : anchor ? anchor.y * T - cam.y : b.y * T - cam.y - T * 0.55;
    var clr = tc ? clearMark(tc, tc.x * T - cam.x + T / 2, my, markSize('talk').w, markSize('talk').h) : null;
    if (clr) mx = clr.x;
    // 화면 밖이거나 위 안내 상자·아래 버튼에 가리는 자리면, 보이는 띠 안으로 옮기고 방향 화살표를 단다
    var iconSize = 16 * markScale(), sa = safeArea(), ms = markSize(kind);
    // 내 캐릭터(머리 꼭대기 약 0.65칸 위 ~ 발)와 겹치면 내 머리 위로 비켜 서고, 내 이름표에 걸리면 이름표 위로(둘 다 보이게)
    var px0 = me.fx * T - cam.x, pTop = (me.fy - HEAD) * T - cam.y, pBot = (me.fy + 1) * T - cam.y;
    if (Math.abs(mx - (px0 + T / 2)) < (iconSize / 2 + T * 0.35) && my + iconSize / 2 > pTop && my - iconSize / 2 < pBot) my = pTop - iconSize / 2 - 4;
    my = aboveTags(mx, my, ms.w, ms.h) + bob;
    var tx0 = mx, ty0 = my;
    mx = Math.max(sa.left + iconSize / 2, Math.min(sa.right - iconSize / 2, mx));
    my = Math.max(sa.top + iconSize / 2, Math.min(sa.bottom - iconSize / 2, my));
    // 화면 위 끝에 붙어 다시 이름표에 걸리면 이름표 옆으로
    var th = tagHit(mx, my, ms.w, ms.h, markPad());
    if (th) mx = th.x + th.w + ms.w / 2 + 4 <= sa.right ? th.x + th.w + ms.w / 2 + 4 : th.x - ms.w / 2 - 4;
    // 조이스틱 받침(기본 자리)에 걸리면 그 위로
    var jr = joy.rest && !$('joy').hidden ? joy.rest : null;
    if (jr && mx + ms.w / 2 > jr.x0 && mx - ms.w / 2 < jr.x1 && my + ms.h / 2 > jr.y0 && my - ms.h / 2 < jr.y1) my = jr.y0 - ms.h / 2 - 4;
    var off = Math.abs(mx - tx0) > 2 || Math.abs(my - ty0) > 2;
    if (clr && clr.tail && !off) drawTail(mx, my, ms.h, tc);
    var d = drawMark(kind, mx, my);
    lastMarker = { x: mx, y: my, tx: b.x, ty: b.y, off: off, kind: kind, w: d.w, h: d.h, who: b.who || null, tail: !!(clr && clr.tail) };
    ctx.fillStyle = '#294B40';
    if (off) {
      var ang = Math.atan2((b.y + b.h / 2) * T - cam.y - my, (b.x + b.w / 2) * T - cam.x - mx);
      ctx.save(); ctx.translate(mx + Math.cos(ang) * T * 0.45, my + Math.sin(ang) * T * 0.45); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  // 말풍선: 인물마다 하나씩, 3.2초 뒤 사라짐. 길면 12자에서 자른다
  // weak(자동 '📱…')은 살아 있는 반응 말풍선을 덮지 않는다
  function setBubble(c, text, weak) {
    text = window.PrivacyEmph ? window.PrivacyEmph.plain(text) : String(text); // 캔버스 말풍선은 맨 글자([[강조]] 기호 없이)
    var now = performance.now();
    if (weak && bubbles.some(function (b) { return b.who === c && !b.weak && b.until > now; })) return;
    bubbles = bubbles.filter(function (b) { return b.who !== c; });
    bubbles.push({ text: text.length > 12 ? text.slice(0, 12) + '…' : text, who: c, until: now + 3200, weak: !!weak });
  }
  function bubbleFor(who, text, weak) {
    var c = who === 'me' ? 'me' : cast.filter(function (k) { return k.who === who; })[0];
    if (!c) return false;
    setBubble(c, text, weak);
    return true;
  }
  function liveBubbles() { var now = performance.now(); return bubbles.filter(function (b) { return b.until > now; }); }
  var lastBubbles = [];
  function drawBubble() {
    bubbles = liveBubbles();
    lastBubbles = [];
    bubbles.forEach(drawOneBubble);
  }
  function drawOneBubble(bubble) {
    var who = bubble.who === 'me' ? { x: me.fx, y: me.fy } : bubble.who;
    if (WD.sceneAt(Math.round(who.x)) !== WD.sceneAt(Math.round(me.fx))) return; // 다른 장면의 인물
    var cx = (who.x + (bubble.who === 'me' ? nudgeMe() : nudgeX(bubble.who))) * T - cam.x + T / 2;
    var by = who.y * T - cam.y - T * (HEAD - 0.15);
    var fs = Math.max(13, Math.round(T * 0.32));
    ctx.font = fs + 'px sans-serif';
    var lines = wrapText(bubble.text, Math.min(viewW - 40, T * 7));
    var w = Math.max.apply(null, lines.map(function (l) { return ctx.measureText(l).width; })) + 20;
    var h = lines.length * (fs + 4) + 14;
    var x = Math.max(8, Math.min(viewW - w - 8, cx - w / 2)), y = Math.max(8, by - h);
    // 2026-11-03 플레이테스트: 말풍선이 이름표를 덮지 않게(하늘이 첫 대화 말풍선이 내 이름표를 덮었다) — 걸린 이름표 위로, 위가 모자라면 옆으로
    for (var k = 0; k < 4; k++) {
      var tagged = lastTags.filter(function (r) { return x < r.x + r.w && r.x < x + w && y < r.y + r.h + 2 && r.y - 2 < y + h; })[0];
      if (!tagged) break;
      if (tagged.y - h - 3 >= 8) y = tagged.y - h - 3;
      else x = tagged.x + tagged.w + w + 12 <= viewW ? tagged.x + tagged.w + 4 : Math.max(8, tagged.x - w - 4);
    }
    lastBubbles.push({ x: x, y: y, w: w, h: h, text: bubble.text });
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    roundRect(x, y, w, h, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(22,32,31,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#16201F'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach(function (l, i) { ctx.fillText(l, x + 10, y + 7 + i * (fs + 4)); });
  }
  function wrapText(text, maxW) {
    var out = [], cur = '';
    Array.prototype.forEach.call(text, function (ch) {
      if (ctx.measureText(cur + ch).width > maxW && cur) { out.push(cur); cur = ch; } else cur += ch;
    });
    if (cur) out.push(cur);
    return out.slice(0, 4);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* ── 초기화 ─────────────────────── */
  function init(options) {
    o = options;
    var qs = location.search;
    DEBUG.grid = /[?&]debug=(1|grid)(&|$)/.test(qs);       // 걷는 칸 겹쳐 보기
    DEBUG.skip = /[?&]debug=1(&|$)/.test(qs) || /[?&]probe=/.test(qs); // 바로 가기: 교사 확인(?debug=1)·검증 프로브만
    $('btn-map-skip').hidden = !/[?&]debug=1(&|$)/.test(qs); // 일반 플레이(프로브 포함)에서는 안 보인다 — 걸어서만
    window.PRIVACY_DEBUG_GRID = DEBUG.grid; // 옛 이름(다른 검사용). 2026-11-02: 옛 정규식 끝 단어 경계 기호가 글자 BS(0x08)로 깨져 ?debug=grid가 안 먹던 것 고침
    canvas = $('m-canvas'); wrap = $('m-wrap');
    ctx = canvas.getContext('2d');
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', function () { held = []; queued = null; });
    canvas.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', function () { joyLayout(); resize(); });
    if (window.ResizeObserver) new ResizeObserver(function () { joyLayout(); resize(); }).observe(wrap); // 무대 크기가 바뀌어도 캔버스를 맞춘다
    // 말 걸기 버튼: 마우스·키보드(Enter·Space)·보통 터치는 click. 조이스틱을 끌었다 뗀 직후 첫 탭에서 click이 안 오는 일이 있어서
    //   (2026-11-02 모바일 검사) 터치는 손을 뗀 뒤 click을 잠깐(350ms) 기다렸다가 안 오면 직접 실행한다.
    //   click보다 먼저 실행하면 대화창이 손가락 밑에 열려 뒤따르는 click이 첫 줄을 넘겨 버린다 → click이 오면 그때 실행
    var actBtn = $('btn-map-act'), actDown = null, actWait = null, actTouchAt = -1e9;
    function actNow() { if (actWait) { clearTimeout(actWait); actWait = null; } actTouchAt = performance.now(); act(); }
    actBtn.addEventListener('pointerdown', function (e) { actDown = e.pointerType === 'mouse' ? null : e.pointerId; });
    actBtn.addEventListener('pointerup', function (e) {
      if (e.pointerType === 'mouse' || actDown !== e.pointerId) return;
      actDown = null; clearTimeout(actWait); actWait = setTimeout(actNow, 350);
    });
    actBtn.addEventListener('pointercancel', function () { actDown = null; });
    actBtn.addEventListener('click', function () { if (actWait) { actNow(); return; } if (performance.now() - actTouchAt < 700) return; act(); });
    $('btn-map-skip').addEventListener('click', skipToTarget);
    var z = $('joy');
    if (z) {
      z.addEventListener('pointerdown', joyDown);
      z.addEventListener('pointermove', joyMove);
      z.addEventListener('pointerup', joyUp);
      z.addEventListener('pointercancel', joyUp);
      z.addEventListener('lostpointercapture', function (e) { if (joy.id === e.pointerId) joyRelease(); });
      z.addEventListener('contextmenu', function (e) { e.preventDefault(); }); // 길게 누름 메뉴 막기
    }
  }

  window.PrivacyMap = {
    init: init, show: show, hide: hide, stage: stage, bubble: bubbleFor, clearBubbles: clearBubbles,
    isTouch: isTouch,
    setJoystick: function () { if (!joyShown()) joyRelease(); joyLayout(); }, // 메뉴 '조이스틱 표시'가 바뀌면
    debugMode: function () { return { grid: DEBUG.grid, skip: DEBUG.skip }; },
    // 검증용(읽기 전용 + 경로 계산)
    debug: {
      me: function () { return { x: me.x, y: me.y, dir: me.dir, moving: me.moving, area: WD.areaName(me.x, me.y) }; },
      route: routeToTarget,
      nearTarget: nearTarget,
      marker: function () { return lastMarker; },
      talkMarks: function () { return talkMarks.map(function (m) { return { who: m.who, why: m.why, x: m.x, y: m.y, w: m.w, h: m.h }; }); }, // 목적지 인물 말고 ?가 뜬 사람들(마지막 그린 화면 기준)
      cam: function () { return { x: cam.x, y: cam.y, tx: camTarget.x, ty: camTarget.y }; },
      // 보이는 지도 영역(free)과 장면 그림이 화면에 놓인 자리(scene, 캔버스 좌표) — 장면 밖이 보이는지(gap) 검사용
      view: function () {
        if (!lastView) return null;
        var s = lastView.scene, f = lastView.free;
        var sc = { x0: s.x0 - cam.x, y0: s.y0 - cam.y, x1: s.x1 - cam.x, y1: s.y1 - cam.y };
        return { T: lastView.T, free: f, scene: sc, tint: mode === 'stage' ? stageTint : trig && trig.tint,
          gap: { left: Math.max(0, sc.x0 - f.x0), right: Math.max(0, f.x1 - sc.x1), top: Math.max(0, sc.y0 - f.y0), bottom: Math.max(0, f.y1 - sc.y1) } };
      },
      walkFrame: walkFrame,
      // 2026-11-02 모바일 검사용: 이름표·표시 그림·조이스틱 받침·출구 칸(캔버스 좌표), 방향 안내 강조, 조이스틱 상태
      tags: function () { return lastTags.slice(); },
      // 2026-11-03 플레이테스트 검사용: 인물 몸(캔버스 좌표)·말풍선 자리·방금 지나온 출입구·문 지난 뒤 멈춤·밀어 그리기
      bodies: function () { return lastBodies.slice(); },
      bubbleRects: function () { return lastBubbles.slice(); },
      arrived: function () { return arrived ? { scene: arrived.scene, steps: arrived.steps } : null; },
      holding: holding,
      nudge: function () { return nudge ? { who: nudge.c.who, mx: nudge.mx * nudgeK, cx: nudge.cx * nudgeK } : null; },
      pose: function () { return me.pose || null; },
      tint: function () { return mode === 'stage' ? stageTint : walkTint || (trig && trig.tint); },
      drawRect: function () { return { x: me.fx, y: me.fy }; },
      joy: function () { return { shown: joyShown() && !$('joy').hidden, on: joy.on, mag: joy.mag, dx: joy.dx, dy: joy.dy, rest: joy.rest, fast: !!(me.moving && me.fast), slow: !!(me.moving && me.slow), live: joy.live, walking: joy.walking, sector: joy.sector }; },
      JOY: JOY,
      exitCells: function () { return exitCells().map(function (c) { return { x: c.x, y: c.y, x0: c.x * T - cam.x, y0: c.y * T - cam.y, x1: (c.x + 1) * T - cam.x, y1: (c.y + 1) * T - cam.y }; }); },
      meRect: function () { return { x0: me.fx * T - cam.x, y0: (me.fy + 1 - BODY) * T - cam.y, x1: (me.fx + 1) * T - cam.x, y1: (me.fy + 1) * T - cam.y }; },
      guide: function () { return guideUntil > performance.now(); },
      tapPath: tapPath,
      tick: function (ms) { loop(lastT + ms); }, // 검증용: 화면 루프를 정해진 시간만큼 한 번 돌림
      routeTo: function (tx, ty) { return WD.findPath({ x: me.x, y: me.y }, function (x, y) { return x === tx && y === ty; }, blocked); },
      place: function (x, y, dir) { place({ x: x, y: y, dir: dir || 'down' }); camS = null; arrived = null; stepHold = 0; if (mode === 'walk') updateHint(); }, // 검증·스크린샷용 순간이동
      stage: function () {
        return { mode: mode, place: stageInfo && stageInfo.place, tint: stageInfo && stageInfo.tint,
          cast: cast.map(function (c) { return c.who; }),
          bubbles: liveBubbles().map(function (b) { return b.who === 'me' ? 'me' : b.who.who; }),
          bubbleTexts: liveBubbles().map(function (b) { return b.text; }) };
      },
      tileToClient: function (tx, ty) { var r = canvas.getBoundingClientRect(); return { x: r.left + tx * T - cam.x + T / 2, y: r.top + ty * T - cam.y + T / 2 }; }
    }
  };
})();
