/*
 * 계획 화면 — 운영 목표 → 모의 AI 제안(수락·수정·거절) → 노선 편집 → 버스 배정·출차 → 예상 지표 → 출발 확인.
 * 노선 편집은 드래그 없이 ‘다음으로 갈 수 있는 정류장’ 버튼(키보드)이나 지도 클릭으로 한 칸씩.
 */
(function (root) {
  'use strict';
  var PB = root.PB, cfg = PB.config, S = PB.Session, G = PB.Graph, M = PB.Metrics;
  var UI = PB.UI = PB.UI || {};
  var $ = function (s) { return document.querySelector(s); };

  var GOALS = [
    { id: 'profit', name: '수익', desc: '운임과 지원금에서 운영비를 뺀 이번 단계 손익을 크게' },
    { id: 'time', name: '이동 시간', desc: '모든 요청의 이동 시간 합을 작게(못 탄 사람은 120분으로 계산)' },
    { id: 'reach', name: '소외 지역 연결', desc: '도착률이 낮았던 두 지역의 도착률을 높게' }
  ];
  var P = { phase: null, rec: null, progress: null, token: 0, editing: null, msg: null };

  function app() { return PB.App; }
  function st() { return app().s; }
  function el(t, a, x) { return app().el(t, a, x); }
  function rerender(focusSel) {
    app().keepFocus = true;
    app().render();
    if (focusSel) { var f = $(focusSel); if (f) f.focus({ preventScroll: true }); }
  }
  function goalName(id) { return GOALS.filter(function (g) { return g.id === id; })[0].name; }
  function nodeLabel(id) { return app().nodeName(id) + '(' + id + ')'; }
  function routeLabelById(rid) {
    if (!rid) return '미배정';
    var hit = st().draft.routes.filter(function (r) { return r.nodes.length >= 2 && G.routeId(r) === rid; })[0];
    return hit ? hit.num + '번 노선' : '새 노선 ' + rid.replace(/-/g, '–');
  }

  /* ── 노선 편집 ───────────────────── */
  function editingRoute() { return P.editing != null ? S.routeByNum(st(), P.editing) : null; }
  function nextStops() {
    var r = editingRoute(), g = S.graph(st());
    if (!r) return [];
    if (!r.nodes.length) return g.nodes.slice();
    return G.neighbors(g, r.nodes[r.nodes.length - 1]).filter(function (n) { return r.nodes.indexOf(n) < 0; });
  }
  function addStop(id) {
    var r = editingRoute();
    if (!r || nextStops().indexOf(id) < 0) return false;
    r.nodes.push(id); r.stops.push(true);
    return true;
  }

  /* ── AI 제안 ─────────────────────── */
  function choose(goal) {
    var s = st();
    S.chooseGoal(s, goal);
    var token = ++P.token, phase = s.phase;
    P.rec = null; P.progress = { done: 0, total: 0 };
    rerender('.goal-btn[data-goal="' + goal + '"]');
    PB.Advisor.recommend(S.revealed(s), goal, function (done, total) {
      if (token !== P.token) return;
      P.progress = { done: done, total: total };
      var pg = $('#rec-progress');
      if (pg) pg.textContent = '모의 AI가 후보 계획을 비교하는 중… (' + done + '개 평가)';
    }).then(function (rec) {
      if (token !== P.token || st() !== s || s.phase !== phase || s.stage !== 'plan') return;
      P.rec = rec; P.progress = null;
      rerender('#rec-card h3');
    });
  }

  function metricRows(base, rec, targets, heads) {
    heads = heads || (rec ? ['지금 계획', '추천 계획'] : ['예상']);
    var rows = [
      ['도착 예상', function (m) { return m.arrived + ' / ' + m.N + '명 (' + M.fmtRate(m.arrivalRate) + ')'; }],
      ['최장 대기', function (m) { return m.maxWait + '분'; }],
      ['이번 단계 손익', function (m) { return app().won(m.costs.total); }],
      ['학교·병원 연결률', function (m) { return M.fmtRate(m.essential.linkRate); }]
    ];
    if (targets && targets.length) rows.splice(1, 0, ['대상 지역 도착률', function (m) {
      return targets.map(function (z) { return z + ' ' + M.fmtRate(m.zones[z] ? m.zones[z].rate : null); }).join(' · ');
    }]);
    var t = el('table');
    var head = el('thead'), hr = el('tr');
    [''].concat(heads).forEach(function (h) { hr.appendChild(el('th', { scope: 'col' }, h)); });
    head.appendChild(hr); t.appendChild(head);
    var body = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(el('th', { scope: 'row' }, r[0]));
      tr.appendChild(el('td', null, r[1](base)));
      if (rec) tr.appendChild(el('td', null, r[1](rec)));
      body.appendChild(tr);
    });
    t.appendChild(body);
    var w = el('div', { 'class': 'table-wrap' }); w.appendChild(t);
    return w;
  }

  function renderGoal(panel) {
    var s = st(), sec = el('section', { 'aria-labelledby': 'goal-h' });
    sec.appendChild(el('h3', { id: 'goal-h' }, '1. 운영 목표 고르기'));
    sec.appendChild(el('p', { 'class': 'note' }, '목표에 따라 모의 AI가 다른 계획을 제안해요. 받아들일지는 운영자가 정해요.'));
    var row = el('div', { 'class': 'goal-row', role: 'group', 'aria-label': '운영 목표' });
    GOALS.forEach(function (g) {
      var b = el('button', { type: 'button', 'class': 'btn goal-btn', 'data-goal': g.id, 'aria-pressed': String(s.goal === g.id), onclick: function () { choose(g.id); } });
      b.appendChild(el('b', null, g.name));
      b.appendChild(el('span', { 'class': 'goal-desc' }, g.desc));
      if (P.progress) b.disabled = true;
      row.appendChild(b);
    });
    sec.appendChild(row);
    if (P.progress) sec.appendChild(el('p', { id: 'rec-progress', 'class': 'note', 'aria-live': 'polite' }, '모의 AI가 후보 계획을 비교하는 중…'));
    if (P.rec) sec.appendChild(recCard(P.rec));
    panel.appendChild(sec);
  }

  function recCard(rec) {
    var s = st(), c = el('div', { id: 'rec-card', 'class': 'card' });
    c.appendChild(el('span', { 'class': 'tag' }, '모의 AI: 알려진 수요로 후보를 비교하는 규칙 기반 추천'));
    c.appendChild(el('h3', { tabindex: '-1' }, '목표 「' + goalName(rec.goal) + '」에 맞춘 제안'));
    if (rec.goal === 'reach') c.appendChild(el('p', null, '대상 지역: ' + rec.targets.map(nodeLabel).join(', ')));
    if (rec.changes.length) {
      c.appendChild(el('p', { 'class': 'h-small' }, '바뀌는 점'));
      var ul = el('ul');
      rec.changes.forEach(function (ch) {
        ul.appendChild(el('li', null, ch.busId + '호차: ' + routeLabelById(ch.before.routeId) + '(출차 ' + ch.before.offset + '분) → ' +
          routeLabelById(ch.after.routeId) + (ch.after.routeId ? '(출차 ' + ch.after.offset + '분)' : '')));
      });
      c.appendChild(ul);
    } else c.appendChild(el('p', null, '지금 계획을 그대로 두는 것이 이 목표에는 가장 나았어요.'));
    c.appendChild(metricRows(rec.baseline, rec.expected, rec.goal === 'reach' ? rec.targets : null));
    c.appendChild(el('p', { 'class': 'note' }, '추가 사건 없는 기본 수요 기준 · 후보 ' + rec.candidates + '개 노선으로 계획 ' + rec.evaluated + '개를 비교했어요. 가장 좋은 답을 보장하지 않아요.'));
    var acts = el('div', { 'class': 'row-actions' });
    acts.appendChild(el('button', { type: 'button', 'class': 'btn', id: 'rec-reject', onclick: function () { S.markGoalAction(s, 'reject'); P.msg = '제안을 거절하고 지금 계획을 유지했어요.'; rerender('#rec-reject'); } }, '거절'));
    acts.appendChild(el('button', { type: 'button', 'class': 'btn', id: 'rec-modify', onclick: function () { S.applyRecommendation(s, rec); S.markGoalAction(s, 'modify'); P.msg = '제안을 계획에 옮겼어요. 아래에서 고쳐 보세요.'; rerender('#routes-h'); } }, '받아서 고치기'));
    acts.appendChild(el('button', { type: 'button', 'class': 'btn btn-primary', id: 'rec-accept', onclick: function () { S.applyRecommendation(s, rec); P.msg = '제안을 계획에 옮겼어요. 출발은 직접 눌러야 해요.'; rerender('#rec-accept'); } }, '수락'));
    c.appendChild(acts);
    if (rec.fourth && s.owned < cfg.bus.maxBuses) {
      var f = el('div', { id: 'rec-fourth', 'class': 'card card-soft' });
      var b4 = rec.fourth.plan.buses.filter(function (b) { return b.id === 4; })[0];
      f.appendChild(el('h4', null, '별도 제안: 4호차를 들이면'));
      f.appendChild(el('p', null, '4호차를 새 노선 ' + app().describeRoute(b4.route) + '에 출차 ' + b4.offset + '분으로 배정하면:'));
      f.appendChild(metricRows(rec.expected, rec.fourth.expected, null, ['추천(3대)', '4호차 추가']));
      f.appendChild(el('p', { 'class': 'note' }, '4호차는 자동으로 들이지 않아요. 보유비와 운행비가 늘어요.'));
      f.appendChild(el('button', { type: 'button', 'class': 'btn', id: 'btn-fourth', onclick: function () { S.applyFourth(s, rec); P.msg = '4호차를 들여 새 노선에 배정했어요.'; rerender('.bus-card[data-bus="4"] select'); } }, '4호차 들이고 이 노선에 배정'));
      c.appendChild(f);
    }
    return c;
  }

  /* ── 노선 목록 ───────────────────── */
  function renderRoutes(panel) {
    var s = st(), g = S.graph(s), sec = el('section', { 'aria-labelledby': 'routes-h' });
    sec.appendChild(el('h3', { id: 'routes-h', tabindex: '-1' }, '2. 노선'));
    if (P.msg) sec.appendChild(el('p', { 'class': 'callout', role: 'status' }, P.msg));
    s.draft.routes.forEach(function (r) {
      var stl = app().routeStyle(r.num), editing = P.editing === r.num;
      var c = el('div', { 'class': 'card route-card' + (editing ? ' editing' : ''), 'data-num': r.num });
      var h = el('div', { 'class': 'route-head' });
      var sw = el('span', { 'class': 'route-swatch', 'aria-hidden': 'true' }); sw.style.background = stl.color;
      h.appendChild(sw);
      h.appendChild(el('b', null, r.num + '번 노선'));
      h.appendChild(el('span', { 'class': 'note' }, ' ' + stl.colorName + ' ' + stl.dashName));
      var errs = r.nodes.length ? G.validateRoute(g, r) : ['정류장을 고르는 중'];
      h.appendChild(el('span', { 'class': 'note cycle' }, errs.length ? ' · 미완성' : ' · 한 바퀴 ' + G.cycleMinutes(g, r) + '분'));
      c.appendChild(h);
      var chips = el('div', { 'class': 'chips', role: 'group', 'aria-label': r.num + '번 노선 정류장(눌러서 정차·통과 바꾸기)' });
      r.nodes.forEach(function (id, i) {
        var end = i === 0 || i === r.nodes.length - 1;
        var b = el('button', { type: 'button', 'class': 'chip' + (r.stops[i] ? ' stop' : ' pass'), 'data-i': i,
          'aria-label': nodeLabel(id) + ' ' + (r.stops[i] ? '정차' : '통과') + (end ? ' (끝점은 항상 정차)' : ', 눌러서 바꾸기'),
          onclick: function () { r.stops[i] = !r.stops[i]; rerender('.route-card[data-num="' + r.num + '"] .chip[data-i="' + i + '"]'); } },
        id + (r.stops[i] ? ' ●' : ' ○'));
        if (end) b.disabled = true;
        chips.appendChild(b);
        if (i < r.nodes.length - 1) chips.appendChild(el('span', { 'class': 'chip-sep', 'aria-hidden': 'true' }, '→'));
      });
      c.appendChild(chips);
      if (editing) {
        var ns = nextStops();
        var box = el('div', { 'class': 'next-box' });
        box.appendChild(el('p', { 'class': 'h-small' }, r.nodes.length ? '다음 정류장 (도로로 이어진 곳만)' : '시작 정류장'));
        var row = el('div', { 'class': 'chips' });
        ns.forEach(function (id) {
          row.appendChild(el('button', { type: 'button', 'class': 'btn btn-sm next-stop', 'data-node': id, onclick: function () {
            addStop(id); rerender('.route-card.editing .next-stop') ; } }, nodeLabel(id)));
        });
        if (!ns.length) row.appendChild(el('span', { 'class': 'note' }, '더 갈 수 있는 정류장이 없어요.'));
        box.appendChild(row);
        c.appendChild(box);
      }
      var acts = el('div', { 'class': 'row-actions' });
      if (editing) {
        acts.appendChild(el('button', { type: 'button', 'class': 'btn btn-sm btn-undo', onclick: function () { r.nodes.pop(); r.stops.pop(); if (r.nodes.length) r.stops[r.nodes.length - 1] = true; rerender('.route-card.editing .btn-undo'); } }, '되돌리기'));
        acts.appendChild(el('button', { type: 'button', 'class': 'btn btn-sm btn-primary btn-finish', onclick: function () {
          if (r.nodes.length < 2) { P.msg = '노선에는 정류장이 두 곳 이상 있어야 해요.'; rerender('.route-card.editing .btn-finish'); return; }
          P.editing = null; P.msg = r.num + '번 노선을 완성했어요. 버스를 배정해 보세요.'; rerender('.bus-card select'); } }, '노선 완성'));
      } else {
        acts.appendChild(el('button', { type: 'button', 'class': 'btn btn-sm btn-edit', onclick: function () { P.editing = r.num; P.msg = null; rerender('.route-card.editing .next-stop'); } }, '끝에 이어 붙이기'));
      }
      acts.appendChild(el('button', { type: 'button', 'class': 'btn btn-sm btn-delete', onclick: function () {
        var out = S.deleteRoute(s, r.num);
        if (P.editing === r.num) P.editing = null;
        P.msg = r.num + '번 노선을 지웠어요.' + (out.unassigned.length ? ' ' + out.unassigned.join('·') + '호차는 미배정이 되었어요.' : '');
        rerender('#btn-new-route'); } }, '지우기'));
      c.appendChild(acts);
      sec.appendChild(c);
    });
    sec.appendChild(el('button', { type: 'button', 'class': 'btn', id: 'btn-new-route', onclick: function () {
      var r = S.addRoute(s, { nodes: [], stops: [] });
      P.editing = r.num; P.msg = null;
      rerender('.route-card.editing .next-stop'); } }, '+ 새 노선 만들기'));
    panel.appendChild(sec);
  }

  /* ── 버스 ───────────────────────── */
  function renderBuses(panel) {
    var s = st(), g = S.graph(s), sec = el('section', { 'aria-labelledby': 'buses-h' });
    sec.appendChild(el('h3', { id: 'buses-h' }, '3. 버스 배정과 출차 시각'));
    s.draft.buses.forEach(function (b) {
      var c = el('div', { 'class': 'card bus-card', 'data-bus': b.id });
      var lab = el('label', { 'for': 'bus-sel-' + b.id }, b.id + '호차 노선 ');
      c.appendChild(lab);
      var sel = el('select', { id: 'bus-sel-' + b.id, onchange: function (e) {
        S.assign(s, b.id, e.target.value === '' ? null : Number(e.target.value)); rerender('#bus-sel-' + b.id); } });
      sel.appendChild(el('option', { value: '' }, '미배정(중앙역 주차)'));
      s.draft.routes.forEach(function (r) {
        var ok = r.nodes.length >= 2 && G.validateRoute(g, r).length === 0;
        var o = el('option', { value: String(r.num) }, r.num + '번 노선' + (ok ? ' · ' + r.nodes.join('–') : ' · 미완성'));
        if (b.routeNum === r.num) o.selected = true;
        sel.appendChild(o);
      });
      if (b.routeNum == null) sel.value = '';
      c.appendChild(sel);
      var offs = el('div', { 'class': 'offsets', role: 'group', 'aria-label': b.id + '호차 첫 출차 시각' });
      offs.appendChild(el('span', { 'class': 'note' }, '첫 출차 '));
      cfg.bus.offsets.forEach(function (o) {
        offs.appendChild(el('button', { type: 'button', 'class': 'btn btn-sm offset-btn', 'data-offset': o, 'aria-pressed': String(b.offset === o),
          onclick: function () { S.setOffset(s, b.id, o); rerender('.bus-card[data-bus="' + b.id + '"] .offset-btn[data-offset="' + o + '"]'); } }, o + '분'));
      });
      c.appendChild(offs);
      var r = b.routeNum != null ? S.routeByNum(s, b.routeNum) : null;
      if (r && G.validateRoute(g, r).length === 0) {
        var tl = PB.Schedule.timeline(g, cfg, b.id, r, b.offset);
        var deps = tl.visits.filter(function (v) { return v.node === r.nodes[0] && v.runOut !== v.runIn && v.t < cfg.bus.window; }).map(function (v) { return v.t + cfg.bus.dwell; });
        var same = s.draft.buses.filter(function (x) { return x.routeNum === b.routeNum; }).length;
        c.appendChild(el('p', { 'class': 'note' }, '예정 출발(' + nodeLabel(r.nodes[0]) + '): ' + deps.slice(0, 6).join(', ') + (deps.length > 6 ? '분 …' : '분')));
        c.appendChild(el('p', { 'class': 'note' }, '이 노선 버스 ' + same + '대 · 평균 간격 약 ' + Math.round(G.cycleMinutes(g, r) / same) + '분' + (r.nodes[0] !== cfg.bus.depot ? ' · 중앙역에서 빈 차로 출발' : '')));
      } else if (b.routeNum == null) c.appendChild(el('p', { 'class': 'note' }, '중앙역에 주차해요. 보유비 ' + app().won(cfg.finance.holding) + '은 들어요.'));
      sec.appendChild(c);
    });
    if (s.phase >= cfg.fourthFromPhase && s.owned < cfg.bus.maxBuses) {
      sec.appendChild(el('button', { type: 'button', 'class': 'btn', id: 'btn-fourth-intro', onclick: function () {
        S.introduceFourth(s); P.msg = '4호차를 들였어요. 처음에는 새 노선에 배정해야 해요.'; rerender('#bus-sel-4'); } }, '4호차 들이기 (보유비 +' + app().won(cfg.finance.holding) + ')'));
    }
    panel.appendChild(sec);
  }

  /* ── 예상·출발 ───────────────────── */
  function renderExpected(panel) {
    var s = st(), sec = el('section', { id: 'expected', 'aria-labelledby': 'exp-h' });
    sec.appendChild(el('h3', { id: 'exp-h' }, '4. 지금 계획의 예상'));
    var m = S.expected(s);
    sec.appendChild(metricRows(m, null, null));
    var z = Object.keys(m.zones).map(function (id) { return id + ' ' + M.fmtRate(m.zones[id].rate); }).join(' · ');
    sec.appendChild(el('p', { 'class': 'note' }, '출발 지역별 도착: ' + z));
    sec.appendChild(el('p', { 'class': 'note' }, '추가 사건 없는 기본 수요 기준이에요. 실제 운행은 달라질 수 있어요.'));
    panel.appendChild(sec);
  }

  function renderDepart(panel) {
    var s = st(), errs = S.validate(s), sec = el('section', { 'aria-labelledby': 'dep-h' });
    sec.appendChild(el('h3', { id: 'dep-h' }, '5. 출발'));
    var box = el('div', { id: 'plan-errors', 'aria-live': 'polite' });
    if (errs.length) {
      var ul = el('ul', { 'class': 'callout warn' });
      errs.forEach(function (e) { ul.appendChild(el('li', null, e)); });
      box.appendChild(el('p', null, '출발하기 전에 고칠 곳이 있어요.'));
      box.appendChild(ul);
    }
    sec.appendChild(box);
    var btn = el('button', { type: 'button', 'class': 'btn btn-primary btn-lg', id: 'btn-depart', 'aria-disabled': String(errs.length > 0), onclick: function () {
      if (S.validate(st()).length) { var pe = $('#plan-errors'); if (pe) { pe.setAttribute('tabindex', '-1'); pe.focus(); } return; }
      var running = s.draft.buses.filter(function (b) { return b.routeNum != null; }).length;
      var body = $('#confirm-depart-body');
      body.innerHTML = '';
      body.appendChild(el('p', null, '버스 ' + s.draft.buses.length + '대 중 ' + running + '대가 운행해요.' + (running < s.draft.buses.length ? ' 미배정 ' + (s.draft.buses.length - running) + '대는 중앙역에 주차하고 보유비는 들어요.' : '')));
      $('#confirm-depart').showModal();
      $('#confirm-yes').focus();
    } }, '이 계획으로 출발');
    sec.appendChild(btn);
    panel.appendChild(sec);
  }

  UI.plan = function (App, panel) {
    var s = App.s;
    if (P.phase !== s.phase) { P = { phase: s.phase, rec: null, progress: null, token: P.token + 1, editing: null, msg: null }; }
    panel.appendChild(el('p', { 'class': 'eyebrow' }, s.phase + '단계 · ' + cfg.phases[s.phase - 1] + ' — 계획'));
    panel.appendChild(el('h2', null, '목표를 고르고 노선을 다듬어요'));
    renderGoal(panel);
    renderRoutes(panel);
    renderBuses(panel);
    renderExpected(panel);
    renderDepart(panel);
    App.onNodeClick = function (id) {
      if (P.editing != null && addStop(id)) rerender('.route-card.editing .next-stop');
    };
    var r = editingRoute();
    return { selectable: nextStops(), selected: r ? r.nodes : [] };
  };

  // 출발 확인(한 번만 바인딩). 운행 시작은 세션이 한 번만 허용한다
  function depart() {
    var dlg = $('#confirm-depart');
    if (dlg.open) dlg.close();
    var App = app();
    if (App.busy) return;
    App.busy = true;
    var res = S.startRun(App.s);
    App.busy = false;
    if (res) App.go('run');
  }
  $('#confirm-yes').addEventListener('click', depart);
  $('#confirm-no').addEventListener('click', function () { $('#confirm-depart').close(); });
})(window);
