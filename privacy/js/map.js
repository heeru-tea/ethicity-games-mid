/*
 * 맵 화면 — 장면 그림(world.js SCENES) 위를 걸어 다니다 ❗ 대상에게 말을 걸면 사건 장면이 열린다.
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
  var questIcon = null;
  var questImage = new Image();
  questImage.onload = function () { questIcon = questImage; };
  window.PrivacyImg.load(questImage, 'assets/icons/quest.png');
  var ROW = { down: 0, left: 1, right: 2, up: 3 };
  var KEY_DIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
  var CHAR_COLOR = window.PrivacySprite.COLOR; // 관계 보고 얼굴 대체색과 같은 색
  var TINT = { day: null, evening: 'rgba(255,181,100,0.08)', night: 'rgba(41,63,118,0.18)' };

  var o = null;                 // init 옵션
  var canvas, ctx, wrap;
  var active = false, raf = null, tmr = null, lastT = 0;
  var camS = null, camT = 0, camTarget = { x: 0, y: 0 }, frameDt = 0; // 걷기 카메라(camS): 데드존 — 가운데 상자를 벗어날 때만 바로 따라감. camTarget = 그 목표(프로브용)
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
    passGreeted = {};
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
    held = []; path = null; actOnArrive = false; busy = false; bubbles = [];
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
    c.textContent = opts.card; c.hidden = false;
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
    var ns = neighbors();
    if (!ns.length) { say('가까이 가서 눌러 보세요. {!}가 다음 목적지예요.'); return; }
    var t = ns.filter(isTarget)[0];
    if (t) {
      me.dir = t.dir;
      busy = true;
      say('');
      var who0 = t.type === 'npc' ? t.c.who : null;
      var greet = [].concat(trig.greet || []).map(function (g) { return typeof g === 'string' ? personLine(who0, g) : personLine(g.who || null, g.text); });
      var g0 = gen;
      talk(greet).then(function () { busy = false; if (active && mode === 'walk' && gen === g0) o.onEnter(); });
      return;
    }
    var n = ns[0];
    me.dir = n.dir;
    say('');
    if (n.type === 'npc') {
      var lines = WD.idle[n.c.who] || [{ text: '…' }];
      var hit = lines.filter(function (l) { return o.evalCond(l.if); })[0];
      var own = trig.castLines && trig.castLines[n.c.who]; // 이 걷기 구간에서만 하는 말(오프닝 자기소개 등)
      talk([personLine(n.c.who, own || hit.text)]);
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
  // 글자 속 {!}를 노란 느낌표 그림(quest.png)으로
  function rich(node, text) {
    node.textContent = '';
    String(text).split('{!}').forEach(function (part, i) {
      if (i) { var ic = document.createElement('span'); ic.className = 'ico-quest'; ic.setAttribute('role', 'img'); ic.setAttribute('aria-label', '노란 느낌표'); node.appendChild(ic); }
      if (part) node.appendChild(document.createTextNode(part));
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
  function updateHint() {
    var near = nearTarget();
    var btn = $('btn-map-act');
    rich(btn, near ? '{!} ' + targetBox().name + (trig.target.npc ? '에게 말 걸기' : ' 조사하기') : '말 걸기 · 조사하기');
    btn.classList.toggle('primary', near);
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
    say(b.name + ' 앞에 왔어요. 말 걸기를 눌러 보세요.');
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
      path = null; actOnArrive = false;
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
    var npc = cast.filter(function (c) { return c.x === tx && c.y === ty; })[0];
    var ob = WD.objectAt(tx, ty) || WD.OBJECTS.filter(function (b) { return tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h; })[0];
    var p;
    if (npc || ob) {
      var box = npc ? { x: npc.x, y: npc.y, w: 1, h: 1 } : ob;
      p = WD.findPath({ x: me.x, y: me.y }, WD.adjacentTo({ contains: boxContains(box) }), blocked);
      actOnArrive = true;
    } else {
      p = WD.findPath({ x: me.x, y: me.y }, function (x, y) { return x === tx && y === ty; }, blocked);
      actOnArrive = false;
    }
    if (!p) { actOnArrive = false; return; }
    held = [];
    if (!p.length) { if (actOnArrive) { actOnArrive = false; faceBox(npc ? { x: npc.x, y: npc.y, w: 1, h: 1 } : ob); act(); } return; }
    path = p;
    if (!me.moving) tryStep(path.shift());
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
  var STAGE_ZOOM = 1.3; // 장면 무대: 폰·선택 상자 옆에 인물이 보이게 조금 당겨 본다(focus로 카메라 이동)
  var lastScene = null, fadeUntil = 0;
  function draw(t) {
    var sc = WD.sceneAt(Math.round(me.fx)) || WD.SCENES[0];
    if (lastScene && lastScene !== sc.id && !o.reduceMotion()) fadeUntil = t + 260; // 장면이 바뀌면 짧게 어두워졌다 밝아짐
    lastScene = sc.id;
    // 칸 크기: 넓은 화면은 장면 전체가 한눈에, 휴대폰은 칸이 28px 밑으로 줄지 않게(넘치면 주인공을 따라감)
    var fit = Math.min(viewW / WD.SW, viewH / WD.SH);
    T = Math.max(28, fit * (mode === 'stage' ? STAGE_ZOOM : 1));
    var sx0 = sc.ox * T, sw = WD.SW * T, sh = WD.SH * T;
    var px = me.fx * T + T / 2, py = me.fy * T + T / 2;
    var f = typeof focus === 'function' ? focus() : focus; // 장면 중엔 화면 크기에 따라 매번 다시
    var cx, cy;
    if (mode === 'stage') {
      var fx = f ? f.x : 0.5, fy = f ? f.y : 0.5;
      // 주인공을 focus 자리에 두려고 장면 밖(폰·선택 상자 뒤)까지 조금 넘어갈 수 있음
      // 장면이 화면보다 작아도(휴대폰) 주인공을 focus 자리로 옮길 수 있게, 장면 가장자리가 화면 끝에서 10%까지 들어오는 것을 허용
      cx = Math.max(sx0 - viewW * 0.9, Math.min(sx0 + sw - viewW * 0.1, px - viewW * fx));
      cy = Math.max(-viewH * 0.9, Math.min(sh - viewH * 0.1, py - viewH * fy));
      camS = { x: cx, y: cy };
    } else {
      // 걷기: 데드존 카메라(화면 가운데 상자 안에서는 배경이 그대로). 장면이 화면보다 작으면 가운데 고정
      if (!camS || camT !== T || camS.scene !== sc.id) camS = { x: px - viewW / 2, y: py - viewH / 2, scene: sc.id };
      var hx = viewW * 0.25, hy = viewH * 0.2, ccx = camS.x + viewW / 2, ccy = camS.y + viewH / 2;
      if (px > ccx + hx) camS.x = px - hx - viewW / 2; else if (px < ccx - hx) camS.x = px + hx - viewW / 2;
      if (py > ccy + hy) camS.y = py - hy - viewH / 2; else if (py < ccy - hy) camS.y = py + hy - viewH / 2;
      camS.x = sw <= viewW ? sx0 - (viewW - sw) / 2 : Math.max(sx0, Math.min(sx0 + sw - viewW, camS.x));
      camS.y = sh <= viewH ? -(viewH - sh) / 2 : Math.max(0, Math.min(sh - viewH, camS.y));
    }
    camTarget.x = camS.x; camTarget.y = camS.y;
    camT = T;
    cam.x = Math.round(camS.x); cam.y = Math.round(camS.y); // 정수 픽셀: 그림이 반 픽셀씩 떨리지 않게
    ctx.fillStyle = '#1F2A27';
    ctx.fillRect(0, 0, viewW, viewH);
    var img = sceneImage(sc), bx = Math.round(sx0 - cam.x), by = Math.round(-cam.y);
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
    var tint = mode === 'stage' ? stageInfo.tint : trig.tint;
    if (TINT[tint] && !(sc.id === 'room' && tint === 'day')) { ctx.fillStyle = TINT[tint]; ctx.fillRect(0, 0, viewW, viewH); }
    if (fadeUntil > t) { ctx.fillStyle = 'rgba(15,20,18,' + Math.min(1, (fadeUntil - t) / 260) + ')'; ctx.fillRect(0, 0, viewW, viewH); }
    if (mode === 'walk') drawMarker(t);
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
  // ❗가 들어갈 수 있는 캔버스 안 영역: 위 HUD(시간·할 일·버튼) 아래, 아래 버튼·안내 문구 위
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
  function drawMarker(t) {
    var b = targetBox();
    // 목적지가 다른 장면이면, 지금 장면에서 그쪽으로 가는 출입구에(어디로 가야 하는지 바로 보이게)
    if (WD.sceneAt(b.x) !== WD.sceneAt(me.x)) b = exitToward() || b;
    var bob = o.reduceMotion() ? 0 : Math.sin(t / 220) * T * 0.08;
    var mx = (b.x + b.w / 2) * T - cam.x, my = b.y * T - cam.y - T * (b.who ? HEAD + 0.65 : 0.55) + bob;
    // 화면 밖이거나 위 안내 상자·아래 버튼에 가리는 자리면, 보이는 띠 안으로 옮기고 방향 화살표를 단다
    var iconSize = Math.max(32, Math.round(T * 0.8)), sa = safeArea();
    // 내 캐릭터(머리 꼭대기 약 0.65칸 위 ~ 발)와 겹치면 내 머리 위로 비켜 선다
    var px0 = me.fx * T - cam.x, pTop = (me.fy - HEAD) * T - cam.y, pBot = (me.fy + 1) * T - cam.y;
    if (Math.abs(mx - (px0 + T / 2)) < (iconSize / 2 + T * 0.35) && my + iconSize / 2 > pTop && my - iconSize / 2 < pBot) my = pTop - iconSize / 2 - 4;
    var tx0 = mx, ty0 = my;
    mx = Math.max(sa.left + iconSize / 2, Math.min(sa.right - iconSize / 2, mx));
    my = Math.max(sa.top + iconSize / 2, Math.min(sa.bottom - iconSize / 2, my));
    var off = Math.abs(mx - tx0) > 2 || Math.abs(my - ty0) > 2;
    lastMarker = { x: mx, y: my, tx: b.x, ty: b.y, off: off };
    if (questIcon) {
      // 생성 원본의 투명 여백을 제외한 알파 경계(>16). 원본 PNG는 보존한다.
      var iw = Math.round(iconSize * 630 / 669);
      ctx.drawImage(questIcon, 313, 293, 630, 669, Math.round(mx - iw / 2), Math.round(my - iconSize / 2), iw, iconSize);
    } else {
      ctx.fillStyle = '#FFF6DB';
      roundRect(mx - iconSize / 2, my - iconSize / 2, iconSize, iconSize, 4); ctx.fill();
      ctx.strokeStyle = '#17334C'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#9B6100'; ctx.font = 'bold ' + Math.round(T * 0.4) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', mx, my + 1);
    }
    ctx.fillStyle = '#17334C';
    if (off) {
      var ang = Math.atan2((b.y + b.h / 2) * T - cam.y - my, (b.x + b.w / 2) * T - cam.x - mx);
      ctx.save(); ctx.translate(mx + Math.cos(ang) * T * 0.45, my + Math.sin(ang) * T * 0.45); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  // 말풍선: 인물마다 하나씩, 3.2초 뒤 사라짐. 길면 12자에서 자른다
  // weak(자동 '📱…')은 살아 있는 반응 말풍선을 덮지 않는다
  function setBubble(c, text, weak) {
    text = String(text);
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
      cam: function () { return { x: cam.x, y: cam.y, tx: camTarget.x, ty: camTarget.y }; },
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
