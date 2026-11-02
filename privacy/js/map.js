/*
 * 맵 화면 — 장면 그림(world.js SCENES) 위를 걸어 다니다 목적지(핀 ! 또는 ? 인물)에 말을 걸거나 조사하면 사건 장면이 열린다.
 * 장면마다 그림 1장(논리 1280×720) + 40px 칸 32×18. 출입구 칸을 밟으면 옆 장면으로(짧은 페이드).
 * 인물: 공통 팩 걷기 시트를 공통 런타임과 같은 0.8배(몸 약 2.2칸)로. 로드 실패 시 옛 시트, 이어 임시 도형.
 * 조작: 방향키/WASD 이동, Space/Enter 말 걸기·조사, 화면 탭 = 그 칸까지 걸어가기(인물·사물을 탭하면 가서 말 걸기)
 */
(function () {
  'use strict';

  var WD = window.PRIVACY_WORLD;
  var STEP_MS = 110; // 한 칸(40px, 몸 높이의 약 0.45) 걷는 시간 — 옛 48px 칸 150ms와 같은 눈높이 속도
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
    streak = { who: null, n: 0 }; $('btn-map-skip').classList.remove('primary');
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
    say(trig.hint || '');
    active = true;
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
    cast = st.cast.slice(); blocked = {};
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
  function hide() { active = false; mode = null; held = []; path = null; if (raf) cancelAnimationFrame(raf); clearTimeout(tmr); raf = null; }
  // 화면 갱신은 rAF, 탭이 가려지거나 rAF가 멈춘 환경에선 타이머가 대신 진행시킨다
  function schedule() {
    if (!active) return;
    if (raf) cancelAnimationFrame(raf);
    clearTimeout(tmr);
    raf = requestAnimationFrame(loop);
    tmr = setTimeout(function () { loop(performance.now()); }, 50);
  }
  function place(p) { me.x = p.x; me.y = p.y; me.dir = p.dir || 'down'; me.fx = p.x; me.fy = p.y; me.moving = false; }
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
  function tryStep(dir) {
    me.dir = dir;
    var d = WD.DIRS[dir], nx = me.x + d[0], ny = me.y + d[1];
    if (!WD.walkable(nx, ny, blocked)) return false;
    if (trig.hint && $('m-say').textContent === trig.hint) say(''); // 첫 걸음을 떼면 안내는 사라진다
    me.moving = true; me.t = 0;
    me.from = { x: me.x, y: me.y }; me.to = { x: nx, y: ny };
    me.door = WD.DOORS[nx + ',' + ny] || null;
    return true;
  }
  function finishStep() {
    me.moving = false;
    me.x = me.to.x; me.y = me.to.y;
    if (me.door) { if (window.PrivacySfxDoor) window.PrivacySfxDoor(); me.x = me.door.to[0]; me.y = me.door.to[1]; me.dir = me.door.dir; flashSay(me.door.label === '집 안으로' ? '우리 집에 들어왔다.' : '밖으로 나왔다.'); }
    me.fx = me.x; me.fy = me.y;
    me.frame = (me.frame + 1) % 4;
    me.walked = (me.walked || 0) + 1; // 걸은 칸 수: 걷기 동작을 칸이 바뀌어도 이어 가게
    savePos();
    updateArea();
    updateHint();
    greetPassing();
    if (path && path.length) { tryStep(path.shift()) || (path = null); return; }
    if (path && !path.length) {
      path = null;
      if (actOnArrive) { actOnArrive = false; act(); }
      return;
    }
    if (held.length) { queued = null; tryStep(held[held.length - 1]); }
    else if (queued) { var q = queued; queued = null; tryStep(q); }
  }
  function updateArea() {
    var a = WD.areaName(me.x, me.y);
    if (a !== lastArea) { lastArea = a; $('m-area').textContent = a ? '📍 ' + a : ''; }
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
    var t = isTarget(spoke) ? spoke : null;
    var fresh = spoke.type === 'npc' && !!talkReason(spoke.c); // ?가 떠 있던 사람(할 말이 남아 있음)
    var whoKey = spoke.type === 'npc' ? spoke.c.who : 'obj:' + spoke.ob.id;
    streak = streak.who === whoKey ? { who: whoKey, n: streak.n + 1 } : { who: whoKey, n: 1 }; // 같은 상대에게 연속 몇 번째인지
    if (spoke.type === 'npc') { talked[spoke.c.who] = true; updateHint(); } // 말 건 사람의 ?는 이번 걷기에서 지운다(버튼 글자도 바로 따라감)
    if (t) {
      me.dir = t.dir;
      busy = true;
      say('');
      var who0 = t.type === 'npc' ? t.c.who : null;
      // greet 줄의 met: 이 걷기에서 그 인물들을 모두 마주쳤을 때(지나가며 인사 말풍선·말 걸기)만 text, 아니면 alt(없으면 줄 생략)
      var greet = [].concat(trig.greet || []).map(function (g) {
        if (g && g.met && !g.met.every(function (w) { return passGreeted[w] || talked[w]; })) return g.alt ? { who: g.who, text: g.alt } : null;
        return g;
      }).filter(Boolean).map(function (g) { return typeof g === 'string' ? personLine(who0, g) : personLine(g.who || null, g.text); });
      var g0 = gen;
      talk(greet).then(function () { busy = false; if (active && mode === 'walk' && gen === g0) o.onEnter(); });
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
      var loud = streak.n >= 3;
      if (!fresh) out.push({ who: null, name: null, text: nudgeText(loud) });
      var g1 = gen;
      talk(out).then(function () {
        if (!loud || fresh || !active || mode !== 'walk' || gen !== g1) return;
        say('{!} 목적지: ' + targetBox().name + ' — ‘목적지로 바로 가기’를 눌러도 돼요.');
        $('btn-map-skip').classList.add('primary');
      });
    } else {
      talk([{ who: null, name: null, text: WD.lookFor(n.ob, trig && trig.time) }]); // 매점처럼 날마다 바뀌는 문구
    }
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
    return tapped || ns.filter(isTarget)[0] || ns.filter(function (n) { return n.type === 'npc' && talkReason(n.c); })[0] || ns[0] || null;
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
    rich(btn, !p ? '말 걸기 · 조사하기'
      : near ? (trig.target.npc ? '{?} ' + targetBox().name + '에게 말 걸기' : '{!} ' + targetBox().name + ' 조사하기')
      : p.type === 'npc' ? (asks ? '{?} ' : '') + o.story.characters[p.c.who].name + '에게 말 걸기'
      : p.ob.name + ' 조사하기');
    btn.classList.toggle('primary', near);
    btn.classList.toggle('ghost', !near && !asks);
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

  function skipToTarget() {
    if (mode !== 'walk') return;
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
      if (held.indexOf(dir) < 0) held.push(dir);
      if (!me.moving && !busy) { if (!tryStep(dir)) queued = null; }
      else queued = dir; // 걷는 중 짧게 누른 키: 지금 칸이 끝나면 한 칸
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
    if (window.PrivacyTalk.isOpen()) { window.PrivacyTalk.close(); return; }
    var r = canvas.getBoundingClientRect();
    var tx = Math.floor((e.clientX - r.left + cam.x) / T), ty = Math.floor((e.clientY - r.top + cam.y) / T);
    var npc = cast.filter(function (c) { return c.x === tx && c.y === ty; })[0] || markAt(e.clientX - r.left, e.clientY - r.top);
    var ob = WD.objectAt(tx, ty) || WD.OBJECTS.filter(function (b) { return tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h; })[0];
    var p;
    if (npc || ob) {
      var box = npc ? { x: npc.x, y: npc.y, w: 1, h: 1 } : ob;
      p = WD.findPath({ x: me.x, y: me.y }, WD.adjacentTo({ contains: boxContains(box) }), blocked);
      actOnArrive = true;
      tapWant = npc ? { npc: npc.who } : { obj: ob.id };
    } else {
      p = WD.findPath({ x: me.x, y: me.y }, function (x, y) { return x === tx && y === ty; }, blocked);
      actOnArrive = false; tapWant = null;
    }
    if (!p) { actOnArrive = false; return; }
    held = [];
    if (!p.length) { if (actOnArrive) { actOnArrive = false; faceBox(npc ? { x: npc.x, y: npc.y, w: 1, h: 1 } : ob); act(); } return; }
    path = p;
    if (!me.moving) tryStep(path.shift());
  }
  // 물음표 말풍선을 눌러도 그 사람에게 가서 말 걸기(머리 위 그림이라 사람 칸보다 위에 있음)
  function markAt(x, y) {
    var marks = talkMarks.slice();
    if (lastMarker && lastMarker.who && lastMarker.x != null && !lastMarker.off) marks.push(lastMarker);
    var hit = marks.filter(function (m) { return Math.abs(x - m.x) <= m.w / 2 + 4 && Math.abs(y - m.y) <= m.h / 2 + 4; })[0];
    return hit ? cast.filter(function (c) { return c.who === hit.who; })[0] : null;
  }
  function faceBox(b) {
    ['up', 'down', 'left', 'right'].forEach(function (dir) { var d = WD.DIRS[dir]; if (boxContains(b)(me.x + d[0], me.y + d[1])) me.dir = dir; });
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
      var need = (1 - me.t) * STEP_MS;
      if (dt >= need) { dt -= need; me.t = 1; finishStep(); }
      else { me.t += dt / STEP_MS; dt = 0; }
    }
    if (me.moving) { me.fx = me.from.x + (me.to.x - me.from.x) * me.t; me.fy = me.from.y + (me.to.y - me.from.y) * me.t; }
    draw(t);
    schedule();
  }
  // 걷기 동작: 반 칸마다 한 프레임(한 칸에 2프레임), 칸이 바뀌어도 이어진다
  function walkFrame() { return me.moving ? Math.floor(((me.walked || 0) + me.t) * 2) % 4 : 0; }
  // 장면 그림(world.js SCENES[].img): 장면마다 한 장. 못 불러오면 단색 바닥 + 걷는 칸 윤곽
  var sceneImg = {};
  function sceneImage(sc) {
    if (sceneImg[sc.id] === undefined) {
      var im = new Image();
      sceneImg[sc.id] = null;
      im.onload = function () { sceneImg[sc.id] = im; };
      im.onerror = function () { sceneImg[sc.id] = false; };
      window.PrivacyImg.load(im, sc.img);
    }
    return sceneImg[sc.id];
  }
  var STAGE_ZOOM = 1.3; // 장면 무대: 폰·선택 상자 옆에 인물이 보이게 조금 당겨 본다(보이는 영역 가운데로 카메라 이동)
  var lastScene = null, fadeUntil = 0, lastView = null;
  // 장면 무대에서 지도를 가리는 것(폰·모니터 창, 선택 상자, 대화창)을 뺀 '보이는 지도 영역'(캔버스 좌표).
  // 가리는 상자들의 가장자리로 캔버스를 나눈 사각형 중, 어떤 상자와도 겹치지 않는 가장 넓은 것(넓은 화면: 폰 오른쪽·선택 상자 위 / 휴대폰: 아래 시트 위).
  var OCCLUDERS = ['#g-phone', '#g-dock', '#talk'];
  function freeRect() {
    var cr = canvas.getBoundingClientRect(), boxes = [], xs = [0, viewW], ys = [0, viewH];
    OCCLUDERS.forEach(function (q) {
      var e = document.querySelector(q);
      if (!e || e.hidden || !e.getClientRects().length) return;
      var b = e.getBoundingClientRect();
      if (b.width < 8 || b.height < 8) return; // 빈 선택 상자 자리
      var r = { x0: Math.max(0, b.left - cr.left), y0: Math.max(0, b.top - cr.top), x1: Math.min(viewW, b.right - cr.left), y1: Math.min(viewH, b.bottom - cr.top) };
      if (r.x1 <= r.x0 || r.y1 <= r.y0) return;
      boxes.push(r); xs.push(r.x0, r.x1); ys.push(r.y0, r.y1);
    });
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
  function fitAxis(want, a0, len, v0, v1, full) {
    if (len <= v1 - v0) return a0 + len / 2 - (v0 + v1) / 2; // 장면이 더 작으면 보이는 영역 가운데
    var lo = a0 - v0, hi = a0 + len - v1;
    if (len >= full && Math.max(lo, a0) <= Math.min(hi, a0 + len - full)) { lo = Math.max(lo, a0); hi = Math.min(hi, a0 + len - full); }
    return Math.max(lo, Math.min(hi, want));
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
      cx = fitAxis(px - (fr.x0 + fr.x1) / 2, sx0, sw, fr.x0, fr.x1, viewW);
      cy = fitAxis(py - (fr.y0 + (fr.y1 - fr.y0) * 0.62), 0, sh, fr.y0, fr.y1, viewH); // 몸이 칸 위로 2칸쯤 서므로 조금 아래에
      // 선택 상자가 늦게 나타나 영역이 바뀌면 부드럽게 옮겨 간다(움직임 줄이기·처음·크기 변경은 바로)
      var k = !camS || camS.T !== T || o.reduceMotion() ? 1 : Math.min(1, frameDt / 140);
      camS = { x: camS && k < 1 ? camS.x + (cx - camS.x) * k : cx, y: camS && k < 1 ? camS.y + (cy - camS.y) * k : cy, T: T };
      lastView = { T: T, free: fr, scene: { x0: sx0, y0: 0, x1: sx0 + sw, y1: sh } };
    } else {
      // 걷기: 데드존 카메라(화면 가운데 상자 안에서는 배경이 그대로). 장면이 화면보다 작으면 가운데 고정
      if (!camS || camT !== T || camS.scene !== sc.id) camS = { x: px - viewW / 2, y: py - viewH / 2, scene: sc.id };
      var hx = viewW * 0.25, hy = viewH * 0.2, ccx = camS.x + viewW / 2, ccy = camS.y + viewH / 2;
      if (px > ccx + hx) camS.x = px - hx - viewW / 2; else if (px < ccx - hx) camS.x = px + hx - viewW / 2;
      if (py > ccy + hy) camS.y = py - hy - viewH / 2; else if (py < ccy - hy) camS.y = py + hy - viewH / 2;
      camS.x = sw <= viewW ? sx0 - (viewW - sw) / 2 : Math.max(sx0, Math.min(sx0 + sw - viewW, camS.x));
      camS.y = sh <= viewH ? -(viewH - sh) / 2 : Math.max(0, Math.min(sh - viewH, camS.y));
      lastView = { T: T, free: { x0: 0, y0: 0, x1: viewW, y1: viewH }, scene: { x0: sx0, y0: 0, x1: sx0 + sw, y1: sh } };
    }
    camTarget.x = camS.x; camTarget.y = camS.y;
    camT = T;
    cam.x = Math.round(camS.x); cam.y = Math.round(camS.y); // 정수 픽셀: 그림이 반 픽셀씩 떨리지 않게
    var img = sceneImage(sc), bx = Math.round(sx0 - cam.x), by = Math.round(-cam.y);
    drawBackdrop(sc, img);
    if (img) {
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, bx, by, Math.round(sw), Math.round(sh));
      ctx.restore();
    } else {
      ctx.fillStyle = '#D9CBA8'; ctx.fillRect(bx, by, sw, sh);
      ctx.fillStyle = 'rgba(60,70,60,0.35)';
      for (var gy = 0; gy < WD.SH; gy++) for (var gx = 0; gx < WD.SW; gx++) if (WD.grid[gy][sc.ox + gx] === '#') ctx.fillRect(bx + gx * T, by + gy * T, T + 1, T + 1);
    }
    if (window.PRIVACY_DEBUG_GRID) debugGrid(sc, bx, by);
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
    var tint = mode === 'stage' ? stageTint : trig.tint || WD.timeTint(trig.time);
    sceneLight(sc, tint, bx, by);
    var list = []; // 앞뒤 순서: { y: 아래쪽 행, fn } — 가구는 그림에 그려져 있으므로 인물만
    cast.forEach(function (c) {
      if (WD.sceneAt(c.x) !== sc) return;
      list.push({ y: c.pose === 'sleep' ? c.y - 0.5 : c.y, fn: function () { drawPerson(c.who, o.story.characters[c.who].name, c.x, c.y, c.dir, 0, c.pose, false); } });
    });
    list.push({ y: me.fy + 0.01, fn: function () { drawPerson('me', o.playerName(), me.fx, me.fy, me.dir, walkFrame(), null, me.moving); } });
    list.sort(function (a, b) { return a.y - b.y; });
    tags = [];
    list.forEach(function (d) { d.fn(); });
    drawTags();
    if (TINT[tint] && !(sc.id === 'room' && tint === 'day')) { ctx.fillStyle = TINT[tint]; ctx.fillRect(0, 0, viewW, viewH); }
    if (fadeUntil > t) { ctx.fillStyle = 'rgba(15,20,18,' + Math.min(1, (fadeUntil - t) / 260) + ')'; ctx.fillRect(0, 0, viewW, viewH); }
    if (mode === 'walk') { drawTalkMarks(t); drawMarker(t); }
    drawBubble(t);
  }
  // ?debug=grid: 걷는 칸(초록)·막힘(빨강)·출입구(파랑)·조사 지점(노랑)을 그림 위에 겹쳐 본다(사람 눈 확인용)
  function debugGrid(sc, bx, by) {
    ctx.save(); ctx.font = Math.round(T * 0.3) + 'px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    for (var gy = 0; gy < WD.SH; gy++) for (var gx = 0; gx < WD.SW; gx++) {
      var X = sc.ox + gx, door = WD.DOORS[X + ',' + gy], obj = WD.objectAt(X, gy);
      ctx.fillStyle = door ? 'rgba(40,90,230,0.45)' : obj ? 'rgba(240,200,30,0.4)' : WD.grid[gy][X] === '#' ? 'rgba(220,40,40,0.28)' : 'rgba(40,200,90,0.16)';
      ctx.fillRect(bx + gx * T + 1, by + gy * T + 1, T - 2, T - 2);
    }
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
      if (pose === 'sleep') ctx.drawImage(sheet, 0, 0, C.w, C.h, sx + T / 2 - C.ax * s, sy - C.ay * s, dw, dh); // 한 칸 위 책상에 앉아 엎드림(옛 규칙: 책상 y - 0.5칸)
      else {
        var f = moving ? frame : window.PrivacyCast.STOP_FRAME;
        ctx.drawImage(sheet, f * C.w, ROW[dir] * C.h, C.w, C.h, sx + T / 2 - C.ax * s, sy + T - C.ay * s, dw, dh);
      }
      ctx.imageSmoothingEnabled = sm;
    } else if (sheet && sheet.naturalWidth) {
      // 칸 = 가로 1타일 × 세로 1.5타일, 발밑이 타일 아래쪽에 오도록
      var fw = sheet.naturalWidth / (pose === 'sleep' ? 1 : 4), fh = sheet.naturalHeight / (pose === 'sleep' ? 1 : 4);
      if (pose === 'sleep') ctx.drawImage(sheet, 0, 0, fw, fh, sx, sy - T * 1.5, T, T * 1.5); // 바로 위 책상 칸에 겹쳐 그림(납품 규칙: 책상 y - 0.5칸)
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
    tags.push({ me: who === 'me', label: name.length > 8 ? name.slice(0, 8) + '…' : name, cx: sx + T / 2, y: who === 'me' ? sy - T * (HEAD + 0.35) : sy + T * 0.98 });
  }
  var tags = [];
  function drawTags() {
    var h = T * 0.34, placed = [];
    var plaques = window.PrivacySchool && window.PrivacySchool.plaques ? window.PrivacySchool.plaques(T, cam) : [];
    function hit(r) { return placed.concat(plaques).some(function (q) { return r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h; }); }
    ctx.font = '600 ' + Math.max(11, Math.round(T * 0.26)) + 'px sans-serif';
    tags.sort(function (a, b) { return (b.me ? 1 : 0) - (a.me ? 1 : 0); }); // 내 이름표 먼저 자리 잡기
    tags.forEach(function (t) {
      var w = ctx.measureText(t.label).width + 8, r = { x: t.cx - w / 2, y: t.y, w: w, h: h };
      for (var k = 0; k < 3 && hit(r); k++) r.y += (t.me ? -1 : 1) * (h + 2);
      placed.push(r);
      ctx.fillStyle = t.me ? 'rgba(15,118,110,0.92)' : 'rgba(22,32,31,0.72)';
      roundRect(r.x, r.y, w, h, 4); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.label, t.cx, r.y + h / 2);
    });
    tags = [];
  }
  // 목적지 표시가 들어갈 수 있는 캔버스 안 영역: 위 HUD(시간·할 일·버튼) 아래, 아래 버튼·안내 문구 위
  var lastMarker = null;
  function safeArea() {
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
    return { left: 6, right: viewW - 6, top: top, bottom: bottom };
  }
  // 지금 자리에서 목적지까지 길 위의 첫 출입구 칸(같은 자리·목적지면 다시 계산하지 않음)
  var exitCache = { key: '', box: null };
  function exitToward() {
    var key = me.x + ',' + me.y + ',' + targetId;
    if (exitCache.key === key) return exitCache.box;
    var p = routeToTarget(), cur = { x: me.x, y: me.y }, box = null;
    for (var i = 0; p && i < p.length; i++) {
      var d = WD.DIRS[p[i]], nx = cur.x + d[0], ny = cur.y + d[1];
      if (WD.DOORS[nx + ',' + ny]) { box = { x: nx, y: ny, w: 1, h: 1 }; break; }
      cur = { x: nx, y: ny };
    }
    exitCache = { key: key, box: box };
    return box;
  }
  // 표시 그림 크기: 16칸 그림을 정수 배로(칸 크기의 약 0.8, 최소 2배 = 32px) — 픽셀이 고르게 또렷하도록
  function markScale() { return Math.max(2, Math.round(T * 0.8 / 16)); }
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
  function headY(c) { return c.y * T - cam.y - T * (c.pose === 'sleep' ? HEAD + 0.95 : HEAD + 0.6); } // ? 가운데 자리(머리 꼭대기 위). 엎드린 그림은 한 칸 위 책상에 그려져 더 높이
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
      var mx = c.x * T - cam.x + T / 2, my = headY(c) + markBob(t, i * 1.7);
      var d = drawMark('talk', mx, my);
      talkMarks.push({ who: c.who, why: why, x: mx, y: my, w: d.w, h: d.h, tx: c.x, ty: c.y });
    });
    updateLabel(); // 장면이 바뀌거나 말을 걸면 지도 설명 글도 따라 바뀐다(바뀔 때만 다시 씀)
  }
  function drawMarker(t) {
    var b = targetBox();
    // 목적지가 다른 장면이면, 지금 장면에서 그쪽으로 가는 출입구에(어디로 가야 하는지 바로 보이게)
    if (WD.sceneAt(b.x) !== WD.sceneAt(me.x)) b = exitToward() || b;
    var kind = b.who ? 'talk' : 'dest'; // 같은 장면의 목적지 인물 = ?, 나머지(사물·출입구) = 핀
    var tc = b.who ? cast.filter(function (k) { return k.who === b.who; })[0] : null;
    if (tc && bubbles.some(function (q) { return q.who === tc && q.until > performance.now(); })) { lastMarker = { x: null, y: null, tx: b.x, ty: b.y, kind: kind, hidden: true }; return; }
    var bob = markBob(t, 0);
    var mx = (b.x + b.w / 2) * T - cam.x, my = (tc ? headY(tc) : b.y * T - cam.y - T * 0.55) + bob;
    // 화면 밖이거나 위 안내 상자·아래 버튼에 가리는 자리면, 보이는 띠 안으로 옮기고 방향 화살표를 단다
    var iconSize = 16 * markScale(), sa = safeArea();
    // 내 캐릭터(머리 꼭대기 약 0.65칸 위 ~ 발)와 겹치면 내 머리 위로 비켜 선다
    var px0 = me.fx * T - cam.x, pTop = (me.fy - HEAD) * T - cam.y, pBot = (me.fy + 1) * T - cam.y;
    if (Math.abs(mx - (px0 + T / 2)) < (iconSize / 2 + T * 0.35) && my + iconSize / 2 > pTop && my - iconSize / 2 < pBot) my = pTop - iconSize / 2 - 4;
    var tx0 = mx, ty0 = my;
    mx = Math.max(sa.left + iconSize / 2, Math.min(sa.right - iconSize / 2, mx));
    my = Math.max(sa.top + iconSize / 2, Math.min(sa.bottom - iconSize / 2, my));
    var off = Math.abs(mx - tx0) > 2 || Math.abs(my - ty0) > 2;
    var d = drawMark(kind, mx, my);
    lastMarker = { x: mx, y: my, tx: b.x, ty: b.y, off: off, kind: kind, w: d.w, h: d.h, who: b.who || null };
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
  function drawBubble() {
    bubbles = liveBubbles();
    bubbles.forEach(drawOneBubble);
  }
  function drawOneBubble(bubble) {
    var who = bubble.who === 'me' ? { x: me.fx, y: me.fy } : bubble.who;
    if (WD.sceneAt(Math.round(who.x)) !== WD.sceneAt(Math.round(me.fx))) return; // 다른 장면의 인물
    var cx = who.x * T - cam.x + T / 2;
    var by = who.y * T - cam.y - T * (HEAD - 0.15);
    var fs = Math.max(13, Math.round(T * 0.32));
    ctx.font = fs + 'px sans-serif';
    var lines = wrapText(bubble.text, Math.min(viewW - 40, T * 7));
    var w = Math.max.apply(null, lines.map(function (l) { return ctx.measureText(l).width; })) + 20;
    var h = lines.length * (fs + 4) + 14;
    var x = Math.max(8, Math.min(viewW - w - 8, cx - w / 2)), y = Math.max(8, by - h);
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
    window.PRIVACY_DEBUG_GRID = /[?&]debug=grid/.test(location.search); // 걷는 칸 겹쳐 보기
    canvas = $('m-canvas'); wrap = $('m-wrap');
    ctx = canvas.getContext('2d');
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', function () { held = []; queued = null; });
    canvas.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(function () { resize(); }).observe(wrap); // 무대 크기가 바뀌어도 캔버스를 맞춘다
    $('btn-map-act').addEventListener('click', act);
    $('btn-map-skip').addEventListener('click', skipToTarget);
  }

  window.PrivacyMap = {
    init: init, show: show, hide: hide, stage: stage, bubble: bubbleFor, clearBubbles: clearBubbles,
    // 검증용(읽기 전용 + 경로 계산)
    debug: {
      me: function () { return { x: me.x, y: me.y, dir: me.dir, moving: me.moving, area: WD.areaName(me.x, me.y) }; },
      route: routeToTarget,
      nearTarget: nearTarget,
      marker: function () { return lastMarker; },
      talkMarks: function () { return talkMarks.map(function (m) { return { who: m.who, why: m.why, x: m.x, y: m.y }; }); }, // 목적지 인물 말고 ?가 뜬 사람들(마지막 그린 화면 기준)
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
      tick: function (ms) { loop(lastT + ms); }, // 검증용: 화면 루프를 정해진 시간만큼 한 번 돌림
      routeTo: function (tx, ty) { return WD.findPath({ x: me.x, y: me.y }, function (x, y) { return x === tx && y === ty; }, blocked); },
      place: function (x, y, dir) { place({ x: x, y: y, dir: dir || 'down' }); camS = null; }, // 검증·스크린샷용 순간이동
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
