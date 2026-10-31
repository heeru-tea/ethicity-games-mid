/*
 * 탐험 무대 — 장소 한 곳이 1280×720 고정 화면 하나다(공통 팩에는 이동 엔진이 없어 이 게임이 만든다).
 *   그리기: 배경 → 출입구 안내판 → 인물·물건(발 y 순서로 앞뒤) → 목표 표시
 *   이동: 방향키/WASD, 바닥을 누르면 그 자리까지 길을 찾아 걷기, 사람·물건을 누르면 다가가서 말 걸기
 *   이동 판정은 config의 walk/block 사각형 + 다른 인물 둘레. 길찾기는 16px 격자 A*
 * 인물 그림: 공식 캐릭터는 EthicityAssets.drawCharacter, 이 게임 인물은 assets/art의 96×128 그림(없으면 임시 도형)
 */
(function (root) {
  'use strict';

  var C = root.SafetyConfig;
  var CELL = 16, GW = Math.ceil(C.STAGE_W / CELL), GH = Math.ceil(C.STAGE_H / CELL);
  var KEY_DIR = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] };

  var W = {
    canvas: null, ctx: null, assets: null, art: {},
    roomId: null, room: null,
    me: { id: 'saebom', x: 640, y: 600, dir: 'up', moving: false, walkT: 0 },
    bot: { x: 600, y: 640, dir: 'up', moving: false, walkT: 0 },
    trail: [],
    cast: [],          // { id, kind:'npc'|'extra', x, y, dir }
    targets: [],       // 목표 id(인물·물건)
    guide: null,       // 길 안내 강조 { id } 또는 { exit }
    path: null, pathGoal: null, // 자동 걷기
    held: [], paused: false, t: 0, last: 0, raf: 0, active: false,
    tapMark: null,
    on: { interact: null, exit: null, near: null },
    reducedMotion: function () { return false; }
  };

  function inRect(r, x, y) { return x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]; }
  function floorOk(x, y) {
    var R = W.room;
    if (!R.walk.some(function (r) { return inRect(r, x, y); })) return false;
    return !R.block.some(function (r) { return inRect(r, x, y); });
  }
  function actorAt(x, y, except) {
    return W.cast.some(function (a) { return a.id !== except && Math.abs(a.x - x) < 26 && Math.abs(a.y - y) < 16; });
  }
  function walkable(x, y, except) { return floorOk(x, y) && !actorAt(x, y, except); }

  // ── 장소 ──
  function setRoom(id, spawn) {
    W.roomId = id; W.room = C.ROOMS[id];
    var sp = Array.isArray(spawn) ? spawn : (W.room.spawn[spawn] || W.room.spawn.door || W.room.spawn.start);
    W.me.x = sp[0]; W.me.y = sp[1]; W.me.dir = sp[2] || 'up'; W.me.moving = false;
    W.bot.x = sp[0] - 46; W.bot.y = sp[1] + 10; W.bot.dir = W.me.dir;
    W.trail = []; W.path = null; W.pathGoal = null; W.held = []; W.tapMark = null;
    notifyNear();
  }
  function setCast(list) { W.cast = list.filter(function (a) { return a.room === W.roomId; }); notifyNear(); }
  function setTargets(ids) { W.targets = ids.slice(); notifyNear(); }
  function setGuide(g) { W.guide = g; }

  // ── 상호작용 대상 ──
  function interactables() {
    var list = W.cast.map(function (a) { return { id: a.id, kind: a.kind, x: a.x, y: a.y, at: [a.x, a.y], hit: [a.x - 34, a.y - 130, 68, 138] }; });
    var objs = W.room.objects || {};
    Object.keys(objs).forEach(function (k) { var o = objs[k]; list.push({ id: k, kind: 'object', x: o.x, y: o.y, at: o.at, hit: o.hit }); });
    return list;
  }
  function nearest() {
    var best = null, bd = 1e9;
    interactables().forEach(function (it) {
      var d = Math.hypot(it.at[0] - W.me.x, it.at[1] - W.me.y);
      if (it.kind !== 'object') d = Math.hypot(it.x - W.me.x, (it.y - W.me.y) * 1.4);
      var range = it.kind === 'object' ? C.TALK_RANGE : C.TALK_RANGE + 10;
      if (d <= range && d < bd) { bd = d; best = it; }
    });
    return best;
  }
  var lastNear = undefined;
  function notifyNear() {
    if (!W.room) return;
    var n = nearest(), id = n ? n.id : null;
    if (id !== lastNear) { lastNear = id; if (W.on.near) W.on.near(n); }
  }
  function interact(it) {
    it = it || nearest();
    if (!it || W.paused) return false;
    face(it);
    if (W.on.interact) W.on.interact(it.id, it.kind);
    return true;
  }
  function face(it) {
    var dx = it.x - W.me.x, dy = it.y - W.me.y;
    W.me.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    var a = W.cast.filter(function (c) { return c.id === it.id; })[0];
    if (a) {
      var ax = W.me.x - a.x, ay = W.me.y - a.y;
      a.dir = Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? 'left' : 'right') : (ay < 0 ? 'up' : 'down');
    }
  }

  // ── 길찾기(16px 격자 A*) ──
  function cellOf(x, y) { return [Math.max(0, Math.min(GW - 1, Math.floor(x / CELL))), Math.max(0, Math.min(GH - 1, Math.floor(y / CELL)))]; }
  function cellFree(cx, cy, goalKey) {
    var x = cx * CELL + CELL / 2, y = cy * CELL + CELL / 2;
    return (cx + ',' + cy) === goalKey ? true : walkable(x, y); // 목표 칸은 목표 지점을 이미 확인했다(칸 중심이 영역 밖이어도 된다)
  }
  function nearestFree(x, y) {
    if (floorOk(x, y) && !actorAt(x, y)) return [x, y];
    for (var r = 8; r < 400; r += 8) {
      for (var a = 0; a < 16; a++) {
        var px = x + Math.cos(a / 16 * Math.PI * 2) * r, py = y + Math.sin(a / 16 * Math.PI * 2) * r;
        if (floorOk(px, py) && !actorAt(px, py)) return [px, py];
      }
    }
    return null;
  }
  function findPath(gx, gy) {
    var goal = nearestFree(gx, gy); if (!goal) return null;
    var s = cellOf(W.me.x, W.me.y), g = cellOf(goal[0], goal[1]), gk = g[0] + ',' + g[1];
    var open = [[s[0], s[1]]], came = {}, gs = {}, fs = {}, sk = s[0] + ',' + s[1];
    gs[sk] = 0; fs[sk] = Math.hypot(g[0] - s[0], g[1] - s[1]);
    var closed = {}, guard = 0;
    while (open.length && guard++ < 6000) {
      open.sort(function (a, b) { return fs[a[0] + ',' + a[1]] - fs[b[0] + ',' + b[1]]; });
      var cur = open.shift(), ck = cur[0] + ',' + cur[1];
      if (ck === gk) {
        var pts = [[goal[0], goal[1]]], k = came[ck];
        while (k && k !== sk) { var p = k.split(',').map(Number); pts.unshift([p[0] * CELL + CELL / 2, p[1] * CELL + CELL / 2]); k = came[k]; }
        return simplify(pts);
      }
      closed[ck] = true;
      for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        var nx = cur[0] + dx, ny = cur[1] + dy, nk = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || closed[nk]) continue;
        if (!cellFree(nx, ny, gk) && nk !== sk) continue;
        if (dx && dy && (!cellFree(cur[0] + dx, cur[1], gk) || !cellFree(cur[0], cur[1] + dy, gk))) continue;
        var ng = gs[ck] + (dx && dy ? 1.414 : 1);
        if (gs[nk] == null || ng < gs[nk]) {
          came[nk] = ck; gs[nk] = ng; fs[nk] = ng + Math.hypot(g[0] - nx, g[1] - ny);
          if (!open.some(function (o) { return o[0] === nx && o[1] === ny; })) open.push([nx, ny]);
        }
      }
    }
    return null;
  }
  // 직선으로 갈 수 있는 중간 점은 건너뛴다
  function clearLine(a, b) {
    var n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6);
    for (var i = 1; i < n; i++) { var x = a[0] + (b[0] - a[0]) * i / n, y = a[1] + (b[1] - a[1]) * i / n; if (!walkable(x, y)) return false; }
    return true;
  }
  function simplify(pts) {
    var out = [], from = [W.me.x, W.me.y], i = 0;
    while (i < pts.length) {
      var j = pts.length - 1;
      while (j > i && !clearLine(from, pts[j])) j--;
      out.push(pts[j]); from = pts[j]; i = j + 1;
    }
    return out;
  }

  // 자동 걷기: 목표 지점까지 걸어간 뒤 goal.then(상호작용·출입) 실행
  function walkTo(x, y, goal) {
    var p = findPath(x, y);
    if (!p) return false;
    W.path = p; W.pathGoal = goal || null; W.tapMark = { x: p[p.length - 1][0], y: p[p.length - 1][1], t: W.t };
    return true;
  }
  function walkToTarget(id) {
    var it = interactables().filter(function (i) { return i.id === id; })[0];
    if (!it) return false;
    if (Math.hypot(it.at[0] - W.me.x, it.at[1] - W.me.y) < 30) { interact(it); return true; }
    var gx = it.at[0], gy = it.at[1];
    if (it.kind !== 'object') { gy = it.y + 40; if (!floorOk(gx, gy)) { gy = it.y; gx = it.x + (W.me.x < it.x ? -52 : 52); } }
    return walkTo(gx, gy, { interact: it.id });
  }
  function walkToExit(exitId) {
    var e = W.room.exits.filter(function (x) { return x.id === exitId; })[0];
    if (!e) return false;
    var cx = e.rect[0] + e.rect[2] / 2, cy = e.rect[1] + e.rect[3] / 2;
    return walkTo(cx, cy, { exit: e.id });
  }

  // ── 입력 ──
  function onKeyDown(e) {
    if (!W.active || W.paused) return;
    var tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (KEY_DIR[e.key]) {
      e.preventDefault();
      if (W.held.indexOf(e.key) < 0) W.held.push(e.key);
      W.path = null; W.pathGoal = null;
    } else if ((e.key === ' ' || e.key === 'Enter') && (tag === 'CANVAS' || tag === 'BODY' || tag === 'MAIN' || e.target === document.body)) {
      if (interact()) e.preventDefault();
    }
  }
  function onKeyUp(e) { var i = W.held.indexOf(e.key); if (i >= 0) W.held.splice(i, 1); }
  function toLogical(ev) {
    var r = W.canvas.getBoundingClientRect();
    return [(ev.clientX - r.left) * C.STAGE_W / r.width, (ev.clientY - r.top) * C.STAGE_H / r.height];
  }
  function onPointer(ev) {
    if (!W.active || W.paused) return;
    var p = toLogical(ev), x = p[0], y = p[1];
    // 사람·물건
    var hits = interactables().filter(function (it) { return inRect(it.hit, x, y); });
    if (hits.length) { hits.sort(function (a, b) { return b.y - a.y; }); walkToTarget(hits[0].id); return; }
    // 출입구 안내판·출입구
    var ex = W.room.exits.filter(function (e) { var s = e.sign; return inRect(e.rect, x, y) || (s && Math.abs(s.x - x) < 80 && Math.abs(s.y - y) < 30); })[0];
    if (ex) { walkToExit(ex.id); return; }
    walkTo(x, y, null);
  }

  // ── 매 프레임 ──
  function tryMove(dx, dy) {
    var nx = W.me.x + dx, ny = W.me.y + dy;
    if (walkable(nx, ny)) { W.me.x = nx; W.me.y = ny; return true; }
    if (dx && walkable(W.me.x + dx, W.me.y)) { W.me.x += dx; return true; }
    if (dy && walkable(W.me.x, W.me.y + dy)) { W.me.y += dy; return true; }
    return false;
  }
  function dirOf(dx, dy) { return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'); }

  function update(dt) {
    var step = C.SPEED * dt, moved = false;
    if (!W.paused && W.held.length) {
      var vx = 0, vy = 0;
      W.held.forEach(function (k) { vx += KEY_DIR[k][0]; vy += KEY_DIR[k][1]; });
      var len = Math.hypot(vx, vy);
      if (len) { vx /= len; vy /= len; W.me.dir = dirOf(vx, vy); moved = tryMove(vx * step, vy * step); }
    } else if (!W.paused && W.path && W.path.length) {
      var t = W.path[0], ddx = t[0] - W.me.x, ddy = t[1] - W.me.y, d = Math.hypot(ddx, ddy);
      if (d <= step) { W.me.x = t[0]; W.me.y = t[1]; W.path.shift(); moved = true; }
      else { W.me.dir = dirOf(ddx, ddy); moved = tryMove(ddx / d * step, ddy / d * step); if (!moved) W.path = null; }
      if (W.path && !W.path.length) {
        var goal = W.pathGoal; W.path = null; W.pathGoal = null;
        if (goal && goal.interact) { var it = interactables().filter(function (i) { return i.id === goal.interact; })[0]; if (it) interact(it); }
      }
    }
    W.me.moving = moved;
    if (moved) W.me.walkT += dt;
    // 안내 로봇은 조금 뒤에서 따라온다
    if (moved) { W.trail.push([W.me.x, W.me.y, W.me.dir]); if (W.trail.length > 60) W.trail.shift(); }
    var lag = W.trail[Math.max(0, W.trail.length - 16)];
    if (lag && Math.hypot(lag[0] - W.bot.x, lag[1] - W.bot.y) > 34) {
      var bx = lag[0] - W.bot.x, by = lag[1] - W.bot.y, bd = Math.hypot(bx, by), bs = Math.min(bd - 30, step * 1.05);
      W.bot.x += bx / bd * bs; W.bot.y += by / bd * bs; W.bot.dir = dirOf(bx, by); W.bot.moving = true; W.bot.walkT += dt;
    } else W.bot.moving = false;
    // 출입구
    if (moved && !W.paused) {
      var ex = W.room.exits.filter(function (e) { return inRect(e.rect, W.me.x, W.me.y); })[0];
      if (ex && W.on.exit) { W.held = []; W.path = null; W.on.exit(ex); return; }
    }
    if (moved) notifyNear();
  }

  // ── 그리기 ──
  function drawBackground(ctx) {
    var bg = W.room.bg;
    if (bg.indexOf('art:') === 0) {
      var img = W.art[bg.slice(4)];
      if (img) { ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0, C.STAGE_W, C.STAGE_H); }
      else drawPlaceholderRoom(ctx, W.roomId);
    } else W.assets.drawBackground(ctx, bg, C.STAGE_W, C.STAGE_H);
  }
  // 그림을 만들기 전·불러오지 못했을 때의 임시 방(이동 영역과 같은 자리에 가구를 그린다)
  function drawPlaceholderRoom(ctx, id) {
    var P = { wall: '#fff9e7', wain: '#a8bb8c', floor: '#f2e7c7', line: '#e2d3ac', ink: '#294b40', wood: '#c9a66b', dark: '#7a5a3a' };
    ctx.fillStyle = P.floor; ctx.fillRect(0, 0, 1280, 720);
    ctx.strokeStyle = P.line; ctx.lineWidth = 2;
    for (var y = 280; y < 720; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke(); }
    for (var x = 0; x < 1280; x += 96) { ctx.beginPath(); ctx.moveTo(x, 260); ctx.lineTo(x, 720); ctx.stroke(); }
    ctx.fillStyle = P.wall; ctx.fillRect(0, 0, 1280, 250);
    ctx.fillStyle = P.wain; ctx.fillRect(0, 200, 1280, 60);
    ctx.fillStyle = P.ink; ctx.fillRect(0, 258, 1280, 4);
    ctx.fillStyle = '#e9dcbc'; ctx.fillRect(0, 680, 1280, 40);
    function box(r, fill) { ctx.fillStyle = fill; ctx.fillRect(r[0], r[1], r[2], r[3]); ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.strokeRect(r[0] + 1.5, r[1] + 1.5, r[2] - 3, r[3] - 3); }
    if (id === 'lobby') {
      box([584, 96, 112, 164], P.dark); box([596, 108, 88, 148], '#9b7a52');
      box([120, 150, 330, 100], P.wood); box([120, 150, 330, 26], '#e3c58e');
      box([930, 110, 170, 120], P.ink); ctx.fillStyle = '#72b7c4'; ctx.fillRect(946, 126, 138, 88);
      box([0, 380, 26, 190], '#d8c79d'); box([1254, 380, 26, 190], '#d8c79d');
      W.room.block.forEach(function (r) { box([r[0], r[1] - 26, r[2], r[3] + 10], '#8fae86'); });
    } else if (id === 'meeting') {
      box([520, 60, 240, 150], P.ink); ctx.fillStyle = '#e6edda'; ctx.fillRect(536, 76, 208, 118);
      box([140, 110, 150, 140], P.wood); box([990, 110, 150, 140], P.wood);
      ctx.fillStyle = P.wood; ctx.beginPath(); ctx.ellipse(640, 380, 230, 70, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.stroke();
      [[470, 300], [640, 290], [810, 300], [470, 460], [640, 470], [810, 460]].forEach(function (c) { box([c[0] - 22, c[1] - 18, 44, 36], '#5a8c65'); });
    }
    ctx.fillStyle = '#e9dcbc'; ctx.fillRect(0, 680, 1280, 40);
    var ex = W.room.exits.filter(function (e) { return e.sign && e.sign.dir === 'down'; })[0];
    if (ex) { ctx.fillStyle = P.floor; ctx.fillRect(ex.rect[0], 670, ex.rect[2], 50); }
  }

  function drawSign(ctx, e, glow) {
    var s = e.sign; if (!s) return;
    ctx.save();
    ctx.font = '700 20px Ethicity, "Malgun Gothic", sans-serif';
    var arrow = { left: '◀ ', right: ' ▶', up: '▲ ', down: '▼ ' }[s.dir];
    var text = s.dir === 'right' ? s.text + arrow : arrow + s.text;
    var w = ctx.measureText(text).width + 28, h = 36, x = Math.max(4, Math.min(1276 - w, s.x - w / 2)), y = Math.min(720 - h - 2, s.y - h / 2);
    if (glow) { ctx.fillStyle = 'rgba(243,207,114,0.75)'; ctx.fillRect(x - 6, y - 6, w + 12, h + 12); }
    ctx.fillStyle = '#c9a66b'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#fff9e7'; ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    ctx.strokeStyle = '#294b40'; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    ctx.fillStyle = '#294b40'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2 + 1);
    ctx.restore();
  }

  function frameOf(a) { return a.moving ? Math.floor(a.walkT * 6) % 4 : 1; }
  function drawActor(ctx, a) {
    ctx.fillStyle = 'rgba(41,75,64,0.18)';
    ctx.beginPath(); ctx.ellipse(a.x, a.y - 2, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
    if (a.common) { W.assets.drawCharacter(ctx, a.common, a.x, a.y, a.dir, frameOf(a), a.scale); return; }
    var img = W.art['npc-' + a.id + '-stand'] || W.art[a.id];
    var s = C.SCALE.adult;
    if (img) { ctx.imageSmoothingEnabled = false; ctx.drawImage(img, Math.round(a.x - 48 * s), Math.round(a.y - 120 * s), 96 * s, 128 * s); return; }
    // 임시 도형: 그림이 준비되면 바뀐다
    var info = C.NPCS[a.id] || {}, col = info.color || '#a8bb8c';
    ctx.fillStyle = '#294b40'; ctx.fillRect(a.x - 17, a.y - 66, 34, 64);
    ctx.fillStyle = col; ctx.fillRect(a.x - 14, a.y - 63, 28, 58);
    ctx.fillStyle = '#294b40'; ctx.beginPath(); ctx.arc(a.x, a.y - 82, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f6d7b8'; ctx.beginPath(); ctx.arc(a.x, a.y - 82, 15, 0, Math.PI * 2); ctx.fill();
    if (!info.extra) {
      ctx.fillStyle = '#294b40'; ctx.font = '700 15px Ethicity, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((info.short || '').slice(0, 2), a.x, a.y - 34);
    }
  }

  function drawMarker(ctx, x, y) {
    var bob = W.reducedMotion() ? 0 : Math.round(Math.sin(W.t * 4) * 4);
    var cx = x, cy = y + bob;
    ctx.fillStyle = '#f3cf72'; ctx.strokeStyle = '#294b40'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 19, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 6, cy + 16); ctx.lineTo(cx, cy + 26); ctx.lineTo(cx + 6, cy + 16); ctx.fill();
    W.assets.drawIcon(ctx, 'clue', cx - 16, cy - 16, 32);
  }
  function drawGuideRing(ctx, x, y) {
    var r = W.reducedMotion() ? 40 : 36 + Math.sin(W.t * 5) * 6;
    ctx.strokeStyle = '#f3cf72'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x, y - 4, r, r * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#294b40'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y - 4, r + 4, r * 0.4 + 3, 0, 0, Math.PI * 2); ctx.stroke();
  }

  function draw() {
    var ctx = W.ctx;
    ctx.imageSmoothingEnabled = false;
    drawBackground(ctx);
    var guideExit = W.guide && W.guide.exit;
    W.room.exits.forEach(function (e) { if (e.sign && e.sign.dir !== 'down') drawSign(ctx, e, guideExit === e.id); });
    // 탭한 자리
    if (W.tapMark && W.path) { ctx.strokeStyle = 'rgba(41,75,64,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(W.tapMark.x, W.tapMark.y, 16, 6, 0, 0, Math.PI * 2); ctx.stroke(); }
    if (W.guide && W.guide.id) {
      var g = interactables().filter(function (i) { return i.id === W.guide.id; })[0];
      if (g) drawGuideRing(ctx, g.kind === 'object' ? g.at[0] : g.x, g.kind === 'object' ? g.at[1] : g.y);
    }
    var actors = W.cast.map(function (a) { return a; });
    actors.push({ x: W.me.x, y: W.me.y, dir: W.me.dir, moving: W.me.moving, walkT: W.me.walkT, common: W.me.id, scale: C.SCALE.student });
    actors.push({ x: W.bot.x, y: W.bot.y, dir: W.bot.dir, moving: W.bot.moving, walkT: W.bot.walkT, common: 'robot', scale: C.SCALE.robot });
    actors.sort(function (a, b) { return a.y - b.y; });
    actors.forEach(function (a) { drawActor(ctx, a); });
    W.room.exits.forEach(function (e) { if (e.sign && e.sign.dir === 'down') drawSign(ctx, e, guideExit === e.id); });
    // 목표 표시
    interactables().forEach(function (it) {
      if (W.targets.indexOf(it.id) < 0) return;
      if (it.kind === 'object') drawMarker(ctx, it.x, it.hit[1] - 12);
      else drawMarker(ctx, it.x, it.y - 152);
    });
  }

  function loop(now) {
    if (!W.active) return;
    var dt = Math.min(0.05, (now - (W.last || now)) / 1000); W.last = now; W.t += dt;
    update(dt);
    draw();
    W.raf = requestAnimationFrame(loop);
  }

  function init(opts) {
    W.canvas = opts.canvas; W.ctx = W.canvas.getContext('2d');
    W.canvas.width = C.STAGE_W; W.canvas.height = C.STAGE_H;
    W.assets = opts.assets; W.art = opts.art || {};
    W.on = opts.on || W.on; W.reducedMotion = opts.reducedMotion || W.reducedMotion;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', function () { W.held = []; });
    W.canvas.addEventListener('pointerdown', function (e) { if (e.button === 0 || e.pointerType !== 'mouse') onPointer(e); });
  }
  function start() { if (W.active) return; W.active = true; W.last = 0; W.raf = requestAnimationFrame(loop); }
  function stop() { W.active = false; cancelAnimationFrame(W.raf); W.held = []; }
  function pause(on) { W.paused = !!on; if (on) { W.held = []; W.path = null; W.pathGoal = null; } }

  root.SafetyWorld = {
    init: init, start: start, stop: stop, pause: pause, setRoom: setRoom, setCast: setCast, setTargets: setTargets, setGuide: setGuide,
    interact: interact, nearest: nearest, walkToTarget: walkToTarget, walkToExit: walkToExit, interactables: interactables,
    me: W.me, state: W, draw: function () { if (W.room) draw(); }
  };
})(this);
