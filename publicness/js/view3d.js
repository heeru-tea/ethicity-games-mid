/*
 * 3D 마을 무대 — Three.js r149(vendor/three.min.js). 고정 직교 카메라, 회전·확대 없음.
 * SVG 지도(map2d.js)와 같은 StageView 인터페이스를 따른다. 조작은 오른쪽 패널(키보드)로도 모두 가능하고,
 * 여기서는 정류장 클릭(레이캐스트)만 받는다. WebGL을 만들 수 없으면 { ok:false }를 돌려주고 앱은 SVG로 간다.
 * 건물은 외부 모델 없이 상자·원기둥으로 만든 미니어처다(원작 게임 그래픽을 따라 하지 않음).
 */
(function (root) {
  'use strict';
  var K = 10;               // 지도 1칸 → 3D 10
  var PX = 110;             // SVG 1칸 = 110px (버스 차선 오프셋 변환용)
  var LANE = 1.0;           // 노선 띠 간격(3D)
  var AZ = -0.32, EL = 0.66; // 카메라 방위·고도(라디안)
  var C = {
    bg: 0xF5F5F4, ground: 0xEAE7E1, road: 0xA3A9B2, stop: 0xFFFFFF, ring: 0x1A1D24, accent: 0x2563EB, warn: 0x9A3412,
    wall: [0xE8E3DA, 0xDAD4C9, 0xCFD7DB, 0xE4D6C6, 0xD7DDD3], roof: [0x8E9AA6, 0xB0805A, 0x7C8A8C, 0x9B6B5B],
    green: 0xB9CFA2, field: 0xDCCDA6, people: 0x8A5A44
  };

  function supported() {
    try {
      var c = document.createElement('canvas');
      return !!(root.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  function create(container, opts) {
    opts = opts || {};
    var T = root.THREE;
    if (!T || !supported()) return { ok: false, kind: '3d' };
    var renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true }); } catch (e) { return { ok: false, kind: '3d' }; }
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    renderer.setClearColor(C.bg, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    var labels = document.createElement('div');
    labels.className = 'labels-3d';
    labels.setAttribute('aria-hidden', 'true');
    container.appendChild(labels);

    var scene = new T.Scene();
    var camera = new T.OrthographicCamera(-50, 50, 30, -30, 1, 1000);
    scene.add(new T.HemisphereLight(0xffffff, 0xb3aa9e, 0.85));
    var sun = new T.DirectionalLight(0xffffff, 0.55);
    sun.position.set(-40, 80, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    var sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 250;
    scene.add(sun);

    var groups = { world: new T.Group(), routes: new T.Group(), buses: new T.Group(), people: new T.Group() };
    Object.keys(groups).forEach(function (k) { scene.add(groups[k]); });
    var nodes = {}, stops = {}, hits = [], zoneGroups = {}, routeSegs = {}, busMesh = {}, lastBus = {};
    var labelEls = { stop: {}, wait: {}, bus: {} };
    var reduced = false, dirty = true, bounds = null, rising = null, prevIds = null, waitingNow = {};

    var matCache = {};
    function mat(color, extra) {
      var key = color + JSON.stringify(extra || {});
      if (!matCache[key]) matCache[key] = new T.MeshLambertMaterial(Object.assign({ color: color }, extra || {}));
      return matCache[key];
    }
    function mesh(geo, color, x, y, z, parent, shadow) {
      var m = new T.Mesh(geo, mat(color));
      m.position.set(x, y, z);
      if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
      parent.add(m);
      return m;
    }
    function box(w, h, d, color, x, z, parent, y) { return mesh(new T.BoxGeometry(w, h, d), color, x, (y || 0) + h / 2, z, parent); }
    function house(x, z, parent, wall, roof) {
      box(3, 2.2, 3, wall, x, z, parent);
      var r = mesh(new T.ConeGeometry(2.5, 1.6, 4), roof, x, 2.2 + 0.8, z, parent);
      r.rotation.y = Math.PI / 4;
    }
    function w(i) { return C.wall[i % C.wall.length]; }
    function rf(i) { return C.roof[i % C.roof.length]; }

    // 생활권별 블록 묶음. (ox, oz)는 정류장에서 도로를 피한 쪽으로 옮긴 위치
    var ZONES = {
      A: function (g) { box(9, 2.6, 4.5, 0xD9DEE3, 0, 0, g); box(10.5, 0.4, 5.6, 0x8E9AA6, 0, 0, g, 2.6); box(2.4, 5.5, 2.4, 0xCFD7DB, 3.6, -0.6, g); },
      B: function (g) { [[0, 0, 7], [3.8, 0.5, 9], [-0.4, 3.8, 6], [3.6, 4.2, 8], [7.2, 2, 5]].forEach(function (p, i) { box(3, p[2], 3, w(i), p[0] - 3, p[1] - 3, g); }); },
      C: function (g) { mesh(new T.BoxGeometry(10, 0.12, 6), C.green, 0, 0.06, 2.5, g, false); box(9, 3.6, 3, 0xE6D6B2, 0, -2, g); box(3, 3.6, 4, 0xE6D6B2, 3, 1, g); },
      D: function (g) { box(5, 6.5, 4, 0xF3F3F1, -2.5, 0, g); box(4, 4.2, 4, 0xEDEEEE, 2.5, 0.5, g); box(5.2, 0.5, 0.3, 0x9FB3C8, -2.5, -2.1, g, 5.2); },
      E: function (g) { [[-4, 0], [-1, 0], [2, 0], [5, 0], [-2.5, 3.2], [0.5, 3.2], [3.5, 3.2]].forEach(function (p, i) {
        box(2.6, 1.8, 2.6, w(i + 1), p[0], p[1], g); var a = box(2.9, 0.25, 1.4, rf(i), p[0], p[1] - 1.4, g, 1.5); a.rotation.x = -0.3; }); },
      F: function (g) { mesh(new T.BoxGeometry(7, 0.1, 5), C.field, -2, 0.05, 2, g, false); mesh(new T.BoxGeometry(5, 0.1, 4), C.green, 4, 0.05, 3, g, false);
        house(-3, -2.5, g, w(0), rf(1)); house(1.5, -1.5, g, w(3), rf(0)); house(5, -3, g, w(4), rf(3)); },
      G: function (g) { for (var i = 0; i < 3; i++) { box(3, 3, 7, 0xB9BEC5, -3 + i * 3, 0, g); var s = box(3.3, 0.3, 7.2, 0x8E969F, -3 + i * 3, 0, g, 3.3); s.rotation.z = 0.45; }
        mesh(new T.CylinderGeometry(0.5, 0.6, 8, 10), 0xA5ABB2, 5, 4, -2, g); },
      H: function (g) { var d = mesh(new T.SphereGeometry(4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xC9D3DD, 0, 0, 0, g); d.scale.y = 0.7;
        var tr = mesh(new T.TorusGeometry(6.5, 0.35, 6, 40), 0xC98B6B, 0, 0.1, 0, g, false); tr.rotation.x = Math.PI / 2; },
      I: function (g) { [[-3, -2, 14], [1, -3, 18], [4.5, -0.5, 12], [-1, 2, 10], [3, 3, 15]].forEach(function (p, i) { box(2.8, p[2], 2.8, i % 2 ? 0xDCE3EA : 0xE4E8EC, p[0], p[1], g); }); }
    };
    var OFFS = { A: [-7, -7], B: [-7, -7], C: [0, 8], D: [0, 8.5], E: [1, 8], F: [-4, 8], G: [7, 7], H: [0, -9], I: [8, -8] };

    function wp(id) { return { x: nodes[id].x * K, z: nodes[id].y * K }; }

    function clear(g) { while (g.children.length) { var c = g.children.pop(); if (c.geometry) c.geometry.dispose(); } }

    function setScene(sceneDef) {
      var ids = sceneDef.nodes.map(function (n) { return n.id; });
      clear(groups.world); hits = []; stops = {}; zoneGroups = {};
      nodes = {};
      sceneDef.nodes.forEach(function (n) { nodes[n.id] = n; });
      var xs = ids.map(function (id) { return nodes[id].x * K; }), zs = ids.map(function (id) { return nodes[id].y * K; });
      bounds = { minX: Math.min.apply(null, xs) - 11, maxX: Math.max.apply(null, xs) + 11, minZ: Math.min.apply(null, zs) - 12, maxZ: Math.max.apply(null, zs) + 13 };
      var gw = bounds.maxX - bounds.minX + 40, gd = bounds.maxZ - bounds.minZ + 40;
      var ground = mesh(new T.BoxGeometry(gw, 0.2, gd), C.ground, (bounds.minX + bounds.maxX) / 2, -0.1, (bounds.minZ + bounds.maxZ) / 2, groups.world);
      ground.castShadow = false;
      sceneDef.roads.forEach(function (r) {
        var a = wp(r.a), b = wp(r.b), len = Math.hypot(b.x - a.x, b.z - a.z);
        var m = mesh(new T.BoxGeometry(len, 0.12, 2.6), C.road, (a.x + b.x) / 2, 0.06, (a.z + b.z) / 2, groups.world, false);
        m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
        m.receiveShadow = true;
      });
      ids.forEach(function (id) {
        var p = wp(id), g = new T.Group();
        g.position.set(p.x + OFFS[id][0], 0, p.z + OFFS[id][1]);
        g.name = 'zone-' + id;
        ZONES[id](g);
        groups.world.add(g);
        zoneGroups[id] = g;
        var base = mesh(new T.CylinderGeometry(1.5, 1.5, 0.5, 24), C.stop, p.x, 0.25, p.z, groups.world);
        base.material = new T.MeshLambertMaterial({ color: C.stop, transparent: true });
        var ring = mesh(new T.TorusGeometry(1.6, 0.22, 8, 32), C.ring, p.x, 0.52, p.z, groups.world, false);
        ring.rotation.x = Math.PI / 2;
        ring.material = new T.MeshLambertMaterial({ color: C.ring });
        var hit = new T.Mesh(new T.CylinderGeometry(3.2, 3.2, 4, 12), new T.MeshBasicMaterial({ visible: false }));
        hit.position.set(p.x, 1.5, p.z); hit.userData.node = id;
        groups.world.add(hit); hits.push(hit);
        stops[id] = { base: base, ring: ring };
      });
      // 새로 생긴 생활권은 솟아오르며 등장(움직임 줄이기면 바로)
      if (prevIds) ids.forEach(function (id) {
        if (prevIds.indexOf(id) < 0 && !reduced) { zoneGroups[id].scale.y = 0.02; rising = { id: id, t0: root.performance.now() }; }
      });
      prevIds = ids.slice();
      labels.innerHTML = ''; labelEls = { stop: {}, wait: {}, bus: {} };
      ids.forEach(function (id) {
        var l = document.createElement('div'); l.className = 'label-3d stop-name'; l.textContent = nodes[id].name; labels.appendChild(l); labelEls.stop[id] = l;
      });
      fit(); dirty = true;
    }

    function segKey(a, b) { return a < b ? a + b : b + a; }
    function laneWorld(a, b, num) {
      var list = routeSegs[segKey(a, b)] || [num], k = list.indexOf(num), n = list.length;
      var A = wp(a), B = wp(b), dx = B.x - A.x, dz = B.z - A.z, len = Math.hypot(dx, dz) || 1;
      var sign = a < b ? 1 : -1, off = (k - (n - 1) / 2) * LANE * sign;
      return { x: -dz / len * off, z: dx / len * off };
    }

    function setRoutes(routes) {
      clear(groups.routes);
      routeSegs = {};
      routes.forEach(function (r) {
        for (var i = 1; i < r.route.nodes.length; i++) {
          var k = segKey(r.route.nodes[i - 1], r.route.nodes[i]);
          (routeSegs[k] = routeSegs[k] || []).push(r.num);
        }
      });
      routes.forEach(function (r, ri) {
        var color = new T.Color(r.color).getHex(), m = new T.MeshLambertMaterial({ color: color, transparent: !!r.dim, opacity: r.dim ? 0.3 : 1 });
        var dash = (r.dash || '').split(' ').filter(Boolean).map(function (x) { return Number(x) * K / PX; });
        var ns = r.route.nodes;
        for (var i = 1; i < ns.length; i++) {
          if (!nodes[ns[i - 1]] || !nodes[ns[i]]) continue;
          var a = wp(ns[i - 1]), b = wp(ns[i]), o = laneWorld(ns[i - 1], ns[i], r.num);
          var len = Math.hypot(b.x - a.x, b.z - a.z), ux = (b.x - a.x) / len, uz = (b.z - a.z) / len, ang = -Math.atan2(uz, ux);
          var pieces = [];
          if (!dash.length) pieces.push([1.8, len - 1.8]);
          else { var pos = 1.8, di = 0; while (pos < len - 1.8) { var on = Math.min(dash[di % dash.length], len - 1.8 - pos); pieces.push([pos, pos + on]); pos += on + (dash[(di + 1) % dash.length] || 0); di += 2; } }
          pieces.forEach(function (pc) {
            var L = pc[1] - pc[0]; if (L <= 0.05) return;
            var c = (pc[0] + pc[1]) / 2;
            var seg = new T.Mesh(new T.BoxGeometry(L, 0.18, 0.75), m);
            seg.position.set(a.x + ux * c + o.x, 0.22 + ri * 0.01, a.z + uz * c + o.z);
            seg.rotation.y = ang;
            groups.routes.add(seg);
          });
        }
        ns.forEach(function (id, i) {
          if (r.route.stops[i] || !nodes[id]) return;
          var o = laneWorld(ns[i - 1], id, r.num), p = wp(id);
          var ring = new T.Mesh(new T.TorusGeometry(0.55, 0.16, 6, 16), m);
          ring.rotation.x = Math.PI / 2; ring.position.set(p.x + o.x, 0.75, p.z + o.z);
          groups.routes.add(ring);
        });
      });
      dirty = true;
    }

    var selectable = [], selected = [];
    function paintStops() {
      Object.keys(stops).forEach(function (id) {
        var s = stops[id], isSel = selected.indexOf(id) >= 0, can = selectable.indexOf(id) >= 0;
        s.ring.material.color.setHex(can ? C.accent : C.ring);
        s.base.material.color.setHex(isSel ? C.accent : C.stop);
        s.base.material.opacity = selectable.length && !can && !isSel ? 0.4 : 1;
        s.ring.scale.setScalar(can ? 1.25 : 1);
      });
      dirty = true;
    }
    function setSelectable(ids) { selectable = ids || []; paintStops(); }
    function setSelected(ids) { selected = ids || []; paintStops(); }

    function setBuses(list) {
      var seen = {};
      list.forEach(function (b) {
        seen[b.id] = true;
        var g = busMesh[b.id];
        if (!g) {
          g = new T.Group();
          var body = new T.Mesh(new T.BoxGeometry(3.2, 1.6, 1.7), new T.MeshLambertMaterial({ color: 0xffffff }));
          body.position.y = 1.1; body.castShadow = true; g.add(body);
          var stripe = new T.Mesh(new T.BoxGeometry(3.25, 0.45, 1.75), new T.MeshLambertMaterial({ color: 0x6B7280 }));
          stripe.position.y = 0.95; g.add(stripe);
          var dome = new T.Mesh(new T.SphereGeometry(0.35, 10, 6), new T.MeshLambertMaterial({ color: 0x9AA1A9 }));
          dome.position.set(0.4, 2.0, 0); g.add(dome);
          g.userData.stripe = stripe;
          groups.buses.add(g); busMesh[b.id] = g;
        }
        if (!labelEls.bus[b.id]) { var l = document.createElement('div'); l.className = 'label-3d bus-num'; labels.appendChild(l); labelEls.bus[b.id] = l; }
        g.userData.stripe.material.color.set(b.color);
        var x = b.x * K + (b.dx || 0) * K / PX, z = b.y * K + (b.dy || 0) * K / PX;
        var last = lastBus[b.id];
        if (last && Math.hypot(x - last.x, z - last.z) > 0.05) g.rotation.y = -Math.atan2(z - last.z, x - last.x);
        lastBus[b.id] = { x: x, z: z };
        g.position.set(x, 0, z);
        g.visible = true;
        labelEls.bus[b.id].textContent = b.id;
        labelEls.bus[b.id].style.background = b.color;
      });
      Object.keys(busMesh).forEach(function (id) { if (!seen[id]) { busMesh[id].visible = false; if (labelEls.bus[id]) labelEls.bus[id].style.display = 'none'; } else if (labelEls.bus[id]) labelEls.bus[id].style.display = ''; });
      dirty = true;
    }

    var personGeo = null;
    function setWaiting(map) {
      waitingNow = map || {};
      clear(groups.people);
      personGeo = personGeo || new T.CylinderGeometry(0.28, 0.28, 1.0, 8);
      Object.keys(labelEls.wait).forEach(function (id) { labelEls.wait[id].remove(); });
      labelEls.wait = {};
      Object.keys(waitingNow).forEach(function (id) {
        var n = waitingNow[id];
        if (!n || !nodes[id]) return;
        var p = wp(id);
        for (var i = 0; i < Math.min(n, 12); i++) {
          var m = new T.Mesh(personGeo, mat(C.people));
          m.position.set(p.x + 2.4 + (i % 4) * 0.75, 0.5, p.z - 2.2 + Math.floor(i / 4) * 0.75);
          m.castShadow = true;
          groups.people.add(m);
        }
        var l = document.createElement('div'); l.className = 'label-3d wait-num'; l.textContent = n; labels.appendChild(l); labelEls.wait[id] = l;
      });
      dirty = true;
    }

    function flash(id) {
      if (reduced || !stops[id]) return;
      var s = stops[id], t0 = root.performance.now();
      s.flashT0 = t0; dirty = true;
    }

    function toScreen(x, y, z) {
      var v = new T.Vector3(x, y, z).project(camera);
      var r = container.getBoundingClientRect();
      return { left: (v.x + 1) / 2 * r.width, top: (1 - v.y) / 2 * r.height };
    }
    function project(x, y) { return toScreen(x * K, 2, y * K); }
    function laneOffset(a, b, num) { var o = laneWorld(a, b, num); return { dx: o.x * PX / K, dy: o.z * PX / K }; }

    function fit() {
      if (!bounds) return;
      var r = container.getBoundingClientRect(), wdt = Math.max(1, r.width), hgt = Math.max(1, r.height);
      renderer.setSize(wdt, hgt, false);
      renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
      var cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2;
      var dir = new T.Vector3(Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL));
      camera.position.set(cx + dir.x * 300, dir.y * 300, cz + dir.z * 300);
      camera.lookAt(cx, 0, cz);
      camera.updateMatrixWorld();
      var inv = camera.matrixWorldInverse, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      [bounds.minX, bounds.maxX].forEach(function (x) { [bounds.minZ, bounds.maxZ].forEach(function (z) { [0, 8].forEach(function (y) {
        var v = new T.Vector3(x, y, z).applyMatrix4(inv);
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      }); }); });
      var vw = maxX - minX, vh = maxY - minY, aspect = wdt / hgt, mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
      if (vw / vh > aspect) vh = vw / aspect; else vw = vh * aspect;
      camera.left = mx - vw / 2; camera.right = mx + vw / 2; camera.top = my + vh / 2; camera.bottom = my - vh / 2;
      camera.updateProjectionMatrix();
      dirty = true;
    }

    function placeLabels() {
      Object.keys(labelEls.stop).forEach(function (id) {
        if (!nodes[id]) return;
        var p = wp(id), s = toScreen(p.x, 0, p.z + 2.6);
        var l = labelEls.stop[id]; l.style.left = s.left + 'px'; l.style.top = s.top + 'px';
      });
      Object.keys(labelEls.wait).forEach(function (id) {
        var p = wp(id), s = toScreen(p.x + 3.5, 2.2, p.z - 2.5);
        var l = labelEls.wait[id]; l.style.left = s.left + 'px'; l.style.top = s.top + 'px';
      });
      Object.keys(labelEls.bus).forEach(function (id) {
        var g = busMesh[id]; if (!g || !g.visible) return;
        var s = toScreen(g.position.x, 3.2, g.position.z);
        var l = labelEls.bus[id]; l.style.left = s.left + 'px'; l.style.top = s.top + 'px';
      });
    }

    function frame() {
      var now = root.performance.now();
      if (rising) {
        var f = Math.min(1, (now - rising.t0) / 800);
        if (zoneGroups[rising.id]) zoneGroups[rising.id].scale.y = 0.02 + 0.98 * (1 - Math.pow(1 - f, 3));
        dirty = true;
        if (f >= 1) rising = null;
      }
      Object.keys(stops).forEach(function (id) {
        var s = stops[id];
        if (s.flashT0 == null) return;
        var f = (now - s.flashT0) / 1200;
        s.ring.material.color.setHex(f < 1 ? C.warn : (selectable.indexOf(id) >= 0 ? C.accent : C.ring));
        if (f >= 1) s.flashT0 = null;
        dirty = true;
      });
      if (dirty && container.offsetParent !== null) {
        renderer.render(scene, camera);
        placeLabels();
        dirty = false;
      }
    }
    (function loop() { frame(); root.requestAnimationFrame(loop); })();
    root.setInterval(frame, 100);

    if (root.ResizeObserver) new root.ResizeObserver(function () { fit(); frame(); }).observe(container);

    var ray = new T.Raycaster(), ptr = new T.Vector2();
    renderer.domElement.addEventListener('click', function (e) {
      var r = renderer.domElement.getBoundingClientRect();
      ptr.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ptr, camera);
      var hit = ray.intersectObjects(hits, false)[0];
      if (hit && opts.onNode) opts.onNode(hit.object.userData.node);
    });

    return {
      kind: '3d', ok: true, setScene: setScene, setRoutes: setRoutes, setSelectable: setSelectable, setSelected: setSelected,
      setBuses: setBuses, setWaiting: setWaiting, flash: flash, project: project, laneOffset: laneOffset,
      setReducedMotion: function (v) { reduced = !!v; },
      show: function (v) { container.hidden = !v; if (v) { fit(); dirty = true; frame(); } },
      dispose: function () { renderer.dispose(); },
      __nodeIds: function () { return Object.keys(zoneGroups); },
      __pickForTest: function (id) { if (opts.onNode) opts.onNode(id); }
    };
  }

  root.PB = root.PB || {};
  root.PB.View3D = { create: create, supported: supported };
})(window);
