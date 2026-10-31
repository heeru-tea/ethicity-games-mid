/*
 * 걷기 — 탐험 장면(지도·장소)에서 플레이어를 움직인다. 좌표는 1280×720 논리 화면, 인물은 발 기준점.
 * 공통 팩의 walkAreas는 예제용이라 쓰지 않고, 장면마다 걸을 수 있는 영역(area)과 가구 충돌(block)을 story.js에 둔다.
 *   방향키·WASD: 직접 걷기 / 장소·바닥 누르기: 길을 찾아 걸어가기(격자 너비 우선 탐색)
 *   로봇 동료는 플레이어가 지나간 길을 조금 늦게 따라온다.
 * 그리기는 DiversityStage에 인물 목록을 넘겨 맡긴다.
 */
(function (global) {
  'use strict';

  var W = 1280, H = 720;
  var SPEED = 240;      // 초당 논리 픽셀
  var CELL = 16;        // 길 찾기 격자
  var NPC_R = 34;       // 인물 발 주변은 지나가지 못한다(위아래는 납작한 타원)
  var RANGE = 80;       // 이만큼 가까우면 살펴볼 수 있다
  var FOLLOW = 16;      // 로봇이 몇 걸음 뒤를 따라오는지
  var KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };

  var st = null, raf = 0, last = 0;
  var held = {};

  function inRect(x, y, r) { return x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]; }

  function free(x, y) {
    if (!st.area.some(function (r) { return inRect(x, y, r); })) return false;
    if (st.block.some(function (r) { return inRect(x, y, r); })) return false;
    return !st.npcs.some(function (n) { return Math.hypot(n.x - x, (n.y - y) * 1.6) < NPC_R; });
  }

  function dirOf(dx, dy, fallback) {
    if (!dx && !dy) return fallback;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  // 지금 자리에서 닿을 수 있는 칸 가운데 목표에 가장 가까운 칸까지의 길
  function findPath(tx, ty) {
    var cols = W / CELL, rows = H / CELL;
    var key = function (c, r) { return r * cols + c; };
    var center = function (k) { return { x: (k % cols) * CELL + CELL / 2, y: Math.floor(k / cols) * CELL + CELL / 2 }; };
    var sc = Math.floor(st.p.x / CELL), sr = Math.floor(st.p.y / CELL);
    var start = key(sc, sr), prev = {}, queue = [start], best = start;
    var dist = function (k) { var p = center(k); return Math.hypot(p.x - tx, p.y - ty); };
    prev[start] = -1;
    while (queue.length) {
      var k = queue.shift(), c = k % cols, r = Math.floor(k / cols);
      if (dist(k) < dist(best)) best = k;
      for (var dc = -1; dc <= 1; dc++) for (var dr = -1; dr <= 1; dr++) {
        if (!dc && !dr) continue;
        var nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        var nk = key(nc, nr);
        if (prev[nk] !== undefined) continue;
        var p = center(nk);
        if (!free(p.x, p.y)) continue;
        // 대각선은 양옆 칸이 모두 비어 있을 때만(모서리 끼임 방지)
        if (dc && dr && !(free(p.x, p.y - dr * CELL) && free(p.x - dc * CELL, p.y))) continue;
        prev[nk] = k;
        queue.push(nk);
      }
    }
    var pts = [];
    for (var b = best; b !== start && b !== -1; b = prev[b]) pts.unshift(center(b));
    if (free(tx, ty) && Math.floor(tx / CELL) === best % cols && Math.floor(ty / CELL) === Math.floor(best / cols)) pts.push({ x: tx, y: ty });
    return smooth(pts);
  }

  function clear(a, b) {
    var n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6);
    for (var i = 1; i <= n; i++) if (!free(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false;
    return true;
  }

  // 곧게 갈 수 있는 점은 건너뛴다
  function smooth(pts) {
    var out = [], from = { x: st.p.x, y: st.p.y }, i = 0;
    while (i < pts.length) {
      var j = pts.length - 1;
      while (j > i && !clear(from, pts[j])) j--;
      out.push(pts[j]);
      from = pts[j];
      i = j + 1;
    }
    return out;
  }

  function step(who, dx, dy, dist) {
    var nx = who.x + dx * dist, ny = who.y + dy * dist, moved = false;
    if (free(nx, who.y)) { who.x = nx; moved = true; }
    if (free(who.x, ny)) { who.y = ny; moved = true; }
    return moved;
  }

  function tick(now) {
    if (!st) return;
    var mine = st; // 도착해서 연 화면이 걷기를 멈추거나 새로 시작하면 이 프레임은 여기서 끝낸다
    var dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    var p = st.p, moved = false;
    var kx = 0, ky = 0;
    Object.keys(held).forEach(function (k) { if (held[k]) { kx += KEYS[k][0]; ky += KEYS[k][1]; } });
    if (kx || ky) {
      st.path = null; st.then = null;
      var len = Math.hypot(kx, ky);
      moved = step(p, kx / len, ky / len, SPEED * dt);
      p.dir = dirOf(kx, ky, p.dir);
    } else if (st.path) {
      var t = st.path[0], gx = t.x - p.x, gy = t.y - p.y, d = Math.hypot(gx, gy);
      var go = Math.min(d, SPEED * dt);
      if (d > 0.5) { p.x += gx / d * go; p.y += gy / d * go; p.dir = dirOf(gx, gy, p.dir); moved = true; }
      if (d - go < 1) {
        st.path.shift();
        if (!st.path.length) arrive();
      }
    }
    if (st !== mine) return;
    if (moved) {
      p.t += dt;
      st.trail.push({ x: p.x, y: p.y });
      if (st.trail.length > 200) st.trail.splice(0, 100);
    }
    p.frame = moved ? Math.floor(p.t * 8) % 4 : 1;
    follow(dt);
    checkNear();
    draw();
    raf = global.requestAnimationFrame(tick);
  }

  function follow(dt) {
    var r = st.r;
    if (!r) return;
    var target = st.trail.length > FOLLOW ? st.trail[st.trail.length - 1 - FOLLOW] : null;
    var moving = false;
    if (target) {
      var gx = target.x - r.x, gy = target.y - r.y, d = Math.hypot(gx, gy);
      if (d > 2) {
        var go = Math.min(d, SPEED * 1.1 * dt);
        r.x += gx / d * go; r.y += gy / d * go;
        r.dir = dirOf(gx, gy, r.dir);
        moving = true;
      }
    }
    if (moving) r.t += dt;
    r.frame = moving ? Math.floor(r.t * 6) % 4 : 1;
  }

  function arrive() {
    var then = st.then, face = st.face;
    st.path = null; st.then = null; st.face = null;
    if (face) st.p.dir = face;
    if (then) then();
  }

  function nearest() {
    var best = null, bestD = RANGE;
    st.spots.forEach(function (s) {
      var d = Math.hypot(s.x - st.p.x, s.y - st.p.y);
      if (d <= bestD) { bestD = d; best = s.id; }
    });
    return best;
  }

  function checkNear() {
    var n = nearest();
    if (n !== st.near) { st.near = n; if (st.onNear) st.onNear(n); }
  }

  function draw() {
    var cast = st.npcs.slice();
    cast.push({ id: st.p.id, x: st.p.x, y: st.p.y, dir: st.p.dir, frame: st.p.frame });
    if (st.r) cast.push({ id: 'robot', x: st.r.x, y: st.r.y, dir: st.r.dir, frame: st.r.frame });
    global.DiversityStage.setCast(cast);
  }

  global.DiversityWalk = {
    // o: area[], block[], npcs[{id,x,y,dir}], player{id,x,y,dir}, robot{x,y,dir}|null, spots[{id,x,y}], onNear(id|null), reduced
    start: function (o) {
      this.stop();
      held = {};
      st = {
        area: o.area, block: o.block || [], npcs: o.npcs || [], spots: o.spots || [],
        p: { id: o.player.id, x: o.player.x, y: o.player.y, dir: o.player.dir || 'down', t: 0, frame: 1 },
        r: o.robot ? { x: o.robot.x, y: o.robot.y, dir: o.robot.dir || 'down', t: 0, frame: 1 } : null,
        trail: [], path: null, then: null, face: null, near: undefined, onNear: o.onNear, reduced: !!o.reduced
      };
      last = 0;
      checkNear();
      draw();
      raf = global.requestAnimationFrame(tick);
    },
    // 멈추고 마지막 자리를 돌려준다(같은 장면으로 돌아올 때 이어서 서기 위해)
    stop: function () {
      if (raf) global.cancelAnimationFrame(raf);
      raf = 0;
      if (!st) return null;
      var out = { player: { x: st.p.x, y: st.p.y, dir: st.p.dir }, robot: st.r ? { x: st.r.x, y: st.r.y, dir: st.r.dir } : null };
      st = null;
      return out;
    },
    active: function () { return !!st; },
    // 목표까지 걸어간 뒤 then. 움직임 줄이기면 바로 그 자리로.
    goTo: function (x, y, then, face) {
      if (!st) return;
      if (st.reduced) {
        var path = findPath(x, y);
        var end = path.length ? path[path.length - 1] : st.p;
        st.p.x = end.x; st.p.y = end.y;
        if (st.r) { st.r.x = end.x + (end.x > 640 ? -48 : 48); st.r.y = end.y + 8; }
        st.path = null; st.then = then; st.face = face || st.p.dir;
        draw(); checkNear(); arrive();
        return;
      }
      st.path = findPath(x, y);
      st.then = then || null;
      st.face = face || null;
      if (!st.path.length) arrive();
    },
    key: function (k, down) {
      var name = KEYS[k] ? k : k.length === 1 && KEYS[k.toLowerCase()] ? k.toLowerCase() : null;
      if (!name || !st) return false;
      held[name] = down;
      return true;
    },
    release: function () { held = {}; },
    near: function () { return st ? st.near : null; },
    position: function () { return st ? { x: st.p.x, y: st.p.y, dir: st.p.dir } : null; }
  };
})(window);
