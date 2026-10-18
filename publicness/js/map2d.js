/*
 * SVG 지도 — 3D가 안 될 때의 대체 무대이자 조작 지도. 3D 무대(view3d.js)와 같은 StageView 인터페이스.
 * 좌표는 config의 평면 좌표(x 오른쪽, y 아래)를 그대로 쓴다. 지도 클릭은 정보 보기·노선 편집용이며
 * 키보드 사용자는 오른쪽 패널의 정류장 목록 버튼으로 같은 일을 한다.
 */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var U = 110, PAD = 70, LANE = 7;

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function create(svg, opts) {
    opts = opts || {};
    var nodes = {}, layers = {}, routeSegs = {}, reduced = false;
    ['roads', 'routes', 'stops', 'badges', 'buses'].forEach(function (k) { layers[k] = el('g', { 'class': 'layer-' + k }, svg); });

    function px(n) { return { x: n.x * U, y: n.y * U }; }

    function setScene(scene) {
      nodes = {};
      scene.nodes.forEach(function (n) { nodes[n.id] = n; });
      var xs = scene.nodes.map(function (n) { return n.x * U; }), ys = scene.nodes.map(function (n) { return n.y * U; });
      var minX = Math.min.apply(null, xs) - PAD, minY = Math.min.apply(null, ys) - PAD;
      var w = Math.max.apply(null, xs) - minX + PAD, h = Math.max.apply(null, ys) - minY + PAD;
      svg.setAttribute('viewBox', [minX, minY, w, h].join(' '));
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      layers.roads.innerHTML = ''; layers.stops.innerHTML = '';
      scene.roads.forEach(function (r) {
        var a = px(nodes[r.a]), b = px(nodes[r.b]);
        el('line', { 'class': 'road', x1: a.x, y1: a.y, x2: b.x, y2: b.y }, layers.roads);
        var t = el('text', { 'class': 'road-min', x: (a.x + b.x) / 2 + 8, y: (a.y + b.y) / 2 - 8 }, layers.roads);
        t.textContent = r.min + '분';
      });
      scene.nodes.forEach(function (n) {
        var p = px(n);
        var g = el('g', { 'class': 'stop-g', 'data-node': n.id }, layers.stops);
        el('circle', { 'class': 'stop-dot', cx: p.x, cy: p.y, r: 16 }, g);
        var id = el('text', { x: p.x, y: p.y + 5, 'text-anchor': 'middle', 'class': 'stop-label' }, g);
        id.textContent = n.id;
        var label = el('text', { x: p.x, y: p.y + 38, 'text-anchor': 'middle', 'class': 'stop-label' }, g);
        label.textContent = n.name;
        g.addEventListener('click', function () { if (opts.onNode) opts.onNode(n.id); });
      });
    }

    function segKey(a, b) { return a < b ? a + b : b + a; }
    function offsetFor(a, b, num) {
      var list = routeSegs[segKey(a, b)] || [num], k = list.indexOf(num), n = list.length;
      var A = px(nodes[a]), B = px(nodes[b]), dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
      var sign = a < b ? 1 : -1, off = (k - (n - 1) / 2) * LANE * sign;
      return { x: -dy / len * off, y: dx / len * off };
    }

    function setRoutes(routes) {
      layers.routes.innerHTML = '';
      routeSegs = {};
      routes.forEach(function (r) {
        for (var i = 1; i < r.route.nodes.length; i++) {
          var k = segKey(r.route.nodes[i - 1], r.route.nodes[i]);
          (routeSegs[k] = routeSegs[k] || []).push(r.num);
        }
      });
      routes.forEach(function (r) {
        var ns = r.route.nodes;
        for (var i = 1; i < ns.length; i++) {
          if (!nodes[ns[i - 1]] || !nodes[ns[i]]) continue;
          var a = px(nodes[ns[i - 1]]), b = px(nodes[ns[i]]), o = offsetFor(ns[i - 1], ns[i], r.num);
          el('line', { 'class': 'route-line' + (r.dim ? ' dim' : ''), x1: a.x + o.x, y1: a.y + o.y, x2: b.x + o.x, y2: b.y + o.y,
            stroke: r.color, 'stroke-dasharray': r.dash || '', 'data-route': r.num }, layers.routes);
        }
        ns.forEach(function (id, i) {
          if (r.route.stops[i] || !nodes[id]) return;
          var nb = ns[i - 1], o = offsetFor(nb, id, r.num), p = px(nodes[id]);
          el('circle', { 'class': 'pass-ring', cx: p.x + o.x, cy: p.y + o.y, r: 5, stroke: r.color }, layers.routes);
        });
      });
    }

    function classAll(cls, ids) {
      Array.prototype.forEach.call(layers.stops.querySelectorAll('.stop-g'), function (g) {
        g.classList.toggle(cls, ids.indexOf(g.getAttribute('data-node')) >= 0);
      });
    }
    function setSelectable(ids) {
      classAll('selectable', ids || []);
      Array.prototype.forEach.call(layers.stops.querySelectorAll('.stop-g'), function (g) {
        g.classList.toggle('dim', !!(ids && ids.length) && ids.indexOf(g.getAttribute('data-node')) < 0 && !g.classList.contains('selected'));
      });
    }
    function setSelected(ids) { classAll('selected', ids || []); }

    // buses: [{ id, x, y, num, color }] — x,y는 평면 좌표(구간 보간 결과), lane은 노선 차선
    function setBuses(buses) {
      layers.buses.innerHTML = '';
      buses.forEach(function (b) {
        var g = el('g', { 'class': 'bus-g', 'data-bus': b.id }, layers.buses);
        var x = b.x * U + (b.dx || 0), y = b.y * U + (b.dy || 0);
        el('rect', { x: x - 13, y: y - 9, width: 26, height: 18, rx: 4, fill: b.color }, g);
        var t = el('text', { x: x, y: y + 4, 'text-anchor': 'middle' }, g);
        t.textContent = b.id;
      });
    }

    function setWaiting(map) {
      layers.badges.innerHTML = '';
      Object.keys(map || {}).forEach(function (id) {
        if (!map[id] || !nodes[id]) return;
        var p = px(nodes[id]);
        var g = el('g', { 'class': 'wait-badge', 'data-wait': id }, layers.badges);
        var label = String(map[id]);
        el('rect', { x: p.x + 12, y: p.y - 28, width: 12 + label.length * 7, height: 18, rx: 9 }, g);
        var t = el('text', { x: p.x + 18 + label.length * 3.5, y: p.y - 15, 'text-anchor': 'middle' }, g);
        t.textContent = label;
      });
    }

    function flash(id) {
      var g = layers.stops.querySelector('[data-node="' + id + '"]');
      if (!g || reduced) return;
      g.classList.remove('flash'); void g.getBBox; g.classList.add('flash');
    }

    // 무대 위 DOM 오버레이용 위치(백분율)
    function project(x, y) {
      var vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect();
      var s = Math.min(r.width / vb.width, r.height / vb.height);
      var ox = (r.width - vb.width * s) / 2, oy = (r.height - vb.height * s) / 2;
      return { left: ox + (x * U - vb.x) * s, top: oy + (y * U - vb.y) * s };
    }
    function laneOffset(a, b, num) { var o = offsetFor(a, b, num); return { dx: o.x, dy: o.y }; }

    return {
      kind: '2d', ok: true, setScene: setScene, setRoutes: setRoutes, setSelectable: setSelectable, setSelected: setSelected,
      setBuses: setBuses, setWaiting: setWaiting, flash: flash, project: project, laneOffset: laneOffset,
      setReducedMotion: function (v) { reduced = !!v; },
      show: function (v) { svg.style.display = v ? '' : 'none'; },
      dispose: function () { svg.innerHTML = ''; }
    };
  }

  root.PB = root.PB || {};
  root.PB.Map2D = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);
