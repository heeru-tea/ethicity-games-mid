// 무대 — 1280×720 논리 화면을 비율대로 줄여 그리고, 방 안 걷기·조사하기를 맡는다.
// 공통 팩에는 이동 엔진이 없고 walkAreas는 예제라서, 걷기 영역은 data.js ROOMS.walk(직접 잰 값)로 16px 격자를 만든다.
(function (root) {
  'use strict';
  var D = root.RightsData, W = 1280, H = 720, CELL = 16, COLS = W / CELL, ROWS = H / CELL;
  var SPEED = 230, REACH = 95;
  var A, canvas, ctx, box, wrap;
  var room = null, grid = null, cast = [], hero = null, names = {};
  var spots = [], done = {}, target = null, exitWanted = false;
  var keys = {}, locked = true, active = false, raf = 0, last = 0, effects = [], reduced = false;
  var handlers = { interact: null, exit: null };

  var KEY_DIR = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };

  function init(assets) {
    A = assets;
    canvas = document.getElementById('stage-canvas');
    box = document.getElementById('stage-box');
    wrap = document.getElementById('stage-wrap');
    ctx = canvas.getContext('2d');
    canvas.width = W; canvas.height = H;
    canvas.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', function (e) { var d = KEY_DIR[e.key]; if (d) delete keys[d]; });
    root.addEventListener('blur', function () { keys = {}; });
    root.addEventListener('resize', resize);
    if (root.ResizeObserver) new ResizeObserver(resize).observe(wrap);
  }

  // 무대 상자를 비율 유지로 맞춘다(남는 곳은 여백). 캔버스 내부 해상도는 1280×720 그대로, 화면 크기만 줄인다.
  function resize() {
    if (!wrap) return;
    var w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    var s = Math.min(w / W, h / H);
    box.style.width = Math.floor(W * s) + 'px';
    box.style.height = Math.floor(H * s) + 'px';
  }

  function buildGrid(r) {
    var g = new Uint8Array(COLS * ROWS);
    for (var cy = 0; cy < ROWS; cy++) for (var cx = 0; cx < COLS; cx++) {
      if (inWalk(r, cx * CELL + CELL / 2, cy * CELL + CELL / 2)) g[cy * COLS + cx] = 1;
    }
    return g;
  }
  function inWalk(r, x, y) {
    return r.walk.some(function (q) { return x >= q[0] && x <= q[0] + q[2] && y >= q[1] && y <= q[1] + q[3]; });
  }
  function cellOf(x, y) { return { x: Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL))), y: Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL))) }; }
  function walkable(cx, cy) { return cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS && grid[cy * COLS + cx] === 1; }
  function nearestWalkable(c) {
    if (walkable(c.x, c.y)) return c;
    for (var r = 1; r < 40; r++) {
      var best = null, bd = 1e9;
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !walkable(c.x + dx, c.y + dy)) continue;
        var d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = { x: c.x + dx, y: c.y + dy }; }
      }
      if (best) return best;
    }
    return null;
  }
  // 8방향 너비 우선 탐색. 대각선은 두 옆 칸이 모두 열려 있을 때만(모서리 끼임 방지).
  function findPath(fx, fy, tx, ty) {
    var s = nearestWalkable(cellOf(fx, fy)), t = nearestWalkable(cellOf(tx, ty));
    if (!s || !t) return null;
    var prev = new Int32Array(COLS * ROWS).fill(-1), si = s.y * COLS + s.x, ti = t.y * COLS + t.x, queue = [si], head = 0;
    prev[si] = si;
    while (head < queue.length) {
      var i = queue[head++];
      if (i === ti) break;
      var x = i % COLS, y = (i / COLS) | 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = x + dx, ny = y + dy;
        if (!walkable(nx, ny) || (dx && dy && (!walkable(x + dx, y) || !walkable(x, y + dy)))) continue;
        var ni = ny * COLS + nx;
        if (prev[ni] !== -1) continue;
        prev[ni] = i; queue.push(ni);
      }
    }
    if (prev[ti] === -1) return null;
    var path = [], k = ti;
    while (k !== si) { path.push({ x: (k % COLS) * CELL + CELL / 2, y: ((k / COLS) | 0) * CELL + CELL / 2 }); k = prev[k]; }
    path.reverse();
    if (path.length && inWalk(room, tx, ty)) path[path.length - 1] = { x: tx, y: ty };
    return path;
  }

  function setRoom(roomId, castList, heroId, nameMap) {
    room = D.ROOMS[roomId];
    room.id = roomId;
    grid = buildGrid(room);
    names = nameMap;
    cast = (castList || []).map(function (c) {
      var id = c.id === 'A' || c.id === 'B' ? names.ids[c.id] : c.id;
      return { id: id, role: c.id, x: c.x, y: c.y, dir: c.dir || 'down', home: c.dir || 'down' };
    });
    hero = { id: heroId, x: room.hero.x, y: room.hero.y, dir: room.hero.dir, path: null, pending: null, moving: false, t: 0 };
    spots = []; done = {}; target = null; exitWanted = false; effects = [];
    keys = {};
  }
  // flow가 지금 조사할 곳 목록·끝난 곳·다음 목표를 알려 준다. exitWanted면 출입구가 목표.
  function setSpots(list, doneMap, targetId, wantExit) {
    spots = list.map(function (id) { return spotGeom(id); });
    done = doneMap || {};
    target = targetId;
    exitWanted = !!wantExit;
  }
  function spotGeom(id) {
    var s = D.SPOTS[id], g = { id: id, label: s.label, need: s.need || [] };
    var npc = s.npc && cast.filter(function (c) { return c.id === s.npc || c.role === s.npc; })[0];
    if (npc) {
      g.npc = npc;
      g.rect = s.rect || [npc.x - 45, npc.y - 115, 90, 125];
      g.stand = s.stand || { x: npc.x, y: npc.y + 50 };
      g.mark = s.mark || { x: npc.x, y: npc.y - 118 };
    } else { g.rect = s.rect; g.stand = s.stand; g.mark = s.mark; }
    return g;
  }
  function available(g) { return !done[g.id] && g.need.every(function (n) { return done[n]; }); }

  function show(on) {
    active = on;
    document.getElementById('stage').hidden = !on;
    if (on) { resize(); last = performance.now(); if (!raf) raf = requestAnimationFrame(loop); }
    else { keys = {}; if (raf) cancelAnimationFrame(raf); raf = 0; }
  }
  function lock(on) {
    locked = on;
    document.body.classList.toggle('r-free', !on);
    if (on) { keys = {}; if (hero) { hero.path = null; hero.pending = null; hero.moving = false; } }
  }
  function setReduced(on) { reduced = on; }

  function toLogical(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  }
  function hit(rect, p) { return p.x >= rect[0] && p.x <= rect[0] + rect[2] && p.y >= rect[1] && p.y <= rect[1] + rect[3]; }
  function onPointer(e) {
    if (!active || locked) return;
    canvas.focus({ preventScroll: true });
    var p = toLogical(e);
    for (var i = 0; i < spots.length; i++) {
      var g = spots[i];
      if (!done[g.id] && hit(g.rect, p)) { goTo(g.stand, g); return; }
    }
    if (hit(room.exit.rect, p)) { goTo(room.exit, 'exit'); return; }
    goTo(p, null);
  }
  function goTo(p, pending) {
    var path = findPath(hero.x, hero.y, p.x, p.y);
    if (!path) return false;
    hero.path = path; hero.pending = pending;
    if (!path.length) arrive();
    return true;
  }
  function arrive() {
    var pending = hero.pending;
    hero.path = null; hero.pending = null; hero.moving = false;
    if (pending === 'exit') { if (handlers.exit) handlers.exit(); }
    else if (pending) interact(pending);
  }
  function interact(g) {
    if (!available(g)) {
      if (handlers.interact) handlers.interact(g.id, true);
      return;
    }
    face(hero, g.npc || g.mark);
    if (g.npc) face(g.npc, hero);
    if (handlers.interact) handlers.interact(g.id, false);
  }
  function face(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    a.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  }
  function nearest() {
    var best = null, bd = REACH;
    spots.forEach(function (g) {
      if (done[g.id]) return;
      var d = Math.hypot(g.stand.x - hero.x, g.stand.y - hero.y);
      if (d < bd) { bd = d; best = g; }
    });
    if (!best && Math.hypot(room.exit.x - hero.x, room.exit.y - hero.y) < REACH) return 'exit';
    return best;
  }
  // 말 걸기·조사하기: 가까운 곳이 있으면 바로, 없으면 목표로 걸어간다.
  function act() {
    if (!active || locked) return;
    var n = nearest();
    if (n === 'exit') { if (handlers.exit) handlers.exit(); return; }
    if (n) { interact(n); return; }
    toTarget();
  }
  function toTarget() {
    if (!active || locked) return false;
    if (exitWanted) return goTo(room.exit, 'exit');
    var g = spots.filter(function (s) { return s.id === target; })[0];
    return g ? goTo(g.stand, g) : false;
  }
  function onKeyDown(e) {
    if (!active || locked || document.body.classList.contains('r-modal-open')) return;
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
    var d = KEY_DIR[e.key];
    if (d) { e.preventDefault(); keys[d] = true; hero.path = null; hero.pending = null; return; }
    if ((e.key === ' ' || e.key === 'Enter') && (e.target === canvas || e.target === document.body)) { e.preventDefault(); act(); }
  }

  function update(dt) {
    var dx = 0, dy = 0;
    if (hero.path) {
      var p = hero.path[0];
      if (!p) { arrive(); return; }
      var vx = p.x - hero.x, vy = p.y - hero.y, len = Math.hypot(vx, vy), step = SPEED * dt;
      if (len <= step) { hero.x = p.x; hero.y = p.y; hero.path.shift(); if (!hero.path.length) { arrive(); return; } }
      else { hero.x += vx / len * step; hero.y += vy / len * step; }
      dx = vx; dy = vy; hero.moving = true;
    } else {
      if (keys.left) dx--; if (keys.right) dx++; if (keys.up) dy--; if (keys.down) dy++;
      if (dx || dy) {
        var l = Math.hypot(dx, dy), nx = hero.x + dx / l * SPEED * dt, ny = hero.y + dy / l * SPEED * dt;
        if (inWalk(room, nx, hero.y)) hero.x = nx;
        if (inWalk(room, hero.x, ny)) hero.y = ny;
        hero.moving = true;
      } else hero.moving = false;
    }
    if (dx || dy) hero.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  }

  function scaleOf(id) { return id === 'robot' ? 0.65 : (id === 'teacher' || id === 'librarian') ? 0.9 : 0.8; }

  function draw(now) {
    A.drawBackground(ctx, room.bg, W, H);
    var list = cast.map(function (c) { return { y: c.y, draw: function () { A.drawCharacter(ctx, c.id, c.x, c.y, c.dir, 1, scaleOf(c.id)); } }; });
    if (room.cctv) list.push({ y: room.cctv.y, draw: function () { drawCctv(room.cctv.x, room.cctv.y, now); } });
    list.push({ y: hero.y, draw: function () { A.drawCharacter(ctx, hero.id, hero.x, hero.y, hero.dir, hero.moving ? Math.floor(now / 1000 * 6) % 4 : 1, scaleOf(hero.id)); } });
    list.sort(function (a, b) { return a.y - b.y; }).forEach(function (o) { o.draw(); });
    drawMarks(now);
    effects = effects.filter(function (f) { return A.drawEffect(ctx, f.id, f.x, f.y, now - f.t, 96, reduced); });
  }
  function drawMarks(now) {
    var bob = reduced ? 0 : Math.round(Math.sin(now / 260) * 4);
    spots.forEach(function (g) {
      if (!available(g)) return;
      var main = g.id === target && !exitWanted;
      A.drawIcon(ctx, main ? 'clue' : 'inspect', g.mark.x - (main ? 20 : 14), g.mark.y - (main ? 40 : 28) + (main ? bob : 0), main ? 40 : 28);
      if (main) tag(g.label, g.mark.x, g.mark.y - 50 + bob);
    });
    if (exitWanted) {
      A.drawIcon(ctx, 'map', room.exit.x - 20, room.exit.y - 92 + bob, 40);
      tag('출입구 · 지도 열기', room.exit.x, room.exit.y - 100 + bob);
    }
  }
  function tag(text, x, y) {
    ctx.font = '700 20px Ethicity, "Malgun Gothic", sans-serif';
    var w = Math.ceil(ctx.measureText(text).width) + 24, h = 32, left = Math.max(8, Math.min(W - w - 8, Math.round(x - w / 2))), top = Math.max(8, Math.round(y - h));
    ctx.fillStyle = '#294b40'; ctx.fillRect(left - 3, top - 3, w + 6, h + 6);
    ctx.fillStyle = '#fff9e7'; ctx.fillRect(left, top, w, h);
    ctx.fillStyle = '#294b40'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(text, left + 12, top + h / 2 + 1);
  }
  // CCTV 시험 장치 — 공통 팩에 없어 4px 픽셀 단위 좌표 코드로 그린다(팔레트·외곽선은 공통 규칙).
  function drawCctv(x, y, now) {
    var P = 4, ox = Math.round(x / P) * P, oy = Math.round(y / P) * P;
    function px(c, cx, cy, w, h) { ctx.fillStyle = c; ctx.fillRect(ox + cx * P, oy + cy * P, w * P, h * P); }
    px('#294b40', -2, -26, 4, 26); px('#7b8a83', -1, -26, 2, 25);          // 기둥
    px('#294b40', -6, 0, 12, 2); px('#5a8c65', -5, 0, 10, 1);              // 받침
    px('#294b40', -3, -30, 6, 5); px('#c9d2cc', -2, -29, 4, 3);            // 팔
    px('#294b40', -9, -35, 14, 7); px('#f2f0e6', -8, -34, 12, 5); px('#c9d2cc', -8, -30, 12, 1); // 몸체
    px('#294b40', -12, -34, 4, 5); px('#5a6b66', -11, -33, 2, 3);          // 렌즈
    px(reduced || Math.floor(now / 600) % 2 ? '#bf7865' : '#f3cf72', 2, -33, 2, 2); // 작동 표시등
  }

  function loop(now) {
    raf = 0;
    if (!active) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!locked && hero) update(dt);
    if (room) draw(now);
    raf = requestAnimationFrame(loop);
  }

  function effect(id, where) {
    var p = where || { x: hero.x, y: hero.y - 120 };
    effects.push({ id: id, x: p.x, y: p.y, t: performance.now() });
  }
  function spotMark(id) { var g = spots.filter(function (s) { return s.id === id; })[0]; return g ? { x: g.mark.x, y: g.mark.y - 20 } : null; }
  function resetFacing() { cast.forEach(function (c) { c.dir = c.home; }); }

  root.RightsStage = {
    init: init, resize: resize, setRoom: setRoom, setSpots: setSpots, show: show, lock: lock, setReduced: setReduced,
    act: act, toTarget: toTarget, effect: effect, spotMark: spotMark, resetFacing: resetFacing,
    on: function (name, fn) { handlers[name] = fn; },
    isActive: function () { return active; },
    // 시험용: 경로 탐색과 걷기 영역 확인
    _debug: { findPath: function (a, b, c, d) { return findPath(a, b, c, d); }, inWalk: function (x, y) { return inWalk(room, x, y); }, hero: function () { return hero; } }
  };
})(window);
