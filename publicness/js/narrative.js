/*
 * 주민 반응·이야기 — 조건 판정과 숫자 채우기만 한다. 문장은 stories.js에 있다.
 * 말풍선은 그 시각까지의 실제 로그가 뒷받침할 때만, 이야기는 해당 주민의 단계별 기록에서만 만든다.
 */
(function (root) {
  'use strict';
  var NODE = typeof require === 'function' && typeof module !== 'undefined';
  var stories = NODE ? require('./stories.js') : root.PB.stories;
  var Graph = NODE ? require('./graph.js') : root.PB.Graph;
  var Demand = NODE ? require('./demand.js') : root.PB.Demand;
  var Session = NODE ? require('./session.js') : root.PB.Session;

  var MAX_BUBBLES = 12;

  function batchim(word) {
    var c = String(word).charCodeAt(String(word).length - 1);
    if (c < 0xac00 || c > 0xd7a3) return false;
    return (c - 0xac00) % 28 !== 0;
  }
  // {이가}{은는}은 바로 앞에 채워진 낱말의 받침을 본다
  function fill(text, vars) {
    var out = '', re = /\{([^}]+)\}/g, last = 0, m, prev = '';
    while ((m = re.exec(text))) {
      out += text.slice(last, m.index);
      var k = m[1], v;
      if (k === '이가') v = batchim(prev || out) ? '이' : '가';
      else if (k === '은는') v = batchim(prev || out) ? '은' : '는';
      else v = vars[k] != null ? String(vars[k]) : m[0];
      out += v;
      prev = (k === '이가' || k === '은는') ? '' : v;
      last = re.lastIndex;
    }
    return out + text.slice(last);
  }

  function nodeName(config, id) {
    for (var i = 0; i < config.nodes.length; i++) if (config.nodes[i].id === id) return config.nodes[i].name;
    return id;
  }
  function resident(config, id) { return config.residents.filter(function (r) { return r.id === id; })[0]; }
  function residentOf(config, p) {
    if (p.kind !== 'base' || p.key.slice(-2) !== '-0') return null;
    var r = config.residents.filter(function (x) { return x.o === p.o && x.d === p.d; })[0];
    return r ? r.id : null;
  }

  // 운행 중 말풍선 후보를 로그에서 만들고, 주민 우선·긴 대기 우선으로 최대 12개
  function bubbles(result, config, upToT) {
    var B = stories.bubbles, list = [];
    var byId = {};
    result.passengers.forEach(function (p) { byId[p.id] = p; });
    function push(t, p, node, kind, text, prio) {
      list.push({ t: t, pid: p.id, node: node, kind: kind, text: text, residentId: residentOf(config, p), prio: residentOf(config, p) ? 0 : prio });
    }
    result.passengers.forEach(function (p) {
      if (p.fail === 'NO_LINK') push(p.t, p, p.o, 'noLink', fill(B.noLink.text, { stop: nodeName(config, p.d) }), 1);
      B.wait.forEach(function (w, k) {
        var t = p.t + w.minWait;
        if (t > config.bus.window) return;
        if (p.firstBoardT != null && p.firstBoardT <= t) return;
        push(t, p, p.o, 'wait', fill(w.text, { wait: w.minWait }), k === B.wait.length - 1 ? 2 : 4);
      });
    });
    result.log.forEach(function (e) {
      var p = e.pid != null ? byId[e.pid] : null;
      if (e.type === 'arrive' && residentOf(config, p)) push(e.t, p, e.node, 'arrive', fill(B.arrive.text, { stop: nodeName(config, e.node) }), 5);
      if (e.type === 'alight') push(e.t, p, e.node, 'transfer', B.transfer.text, 5);
    });
    result.log.forEach(function (e) {
      if (e.type !== 'full') return;
      list.push({ t: e.t, pid: null, node: e.node, kind: 'full', text: B.full.text, residentId: null, prio: 3 });
    });
    list.sort(function (a, b) { return a.prio - b.prio || a.t - b.t || (a.pid || 0) - (b.pid || 0); });
    // 같은 사람·같은 종류는 하나만
    var seen = {}, picked = [];
    list.forEach(function (b) {
      var p = b.pid != null ? byId[b.pid] : null;
      // 주민이 아닌 사람의 ‘노선 없음’은 같은 출발·목적지에서 한 번만
      var k = b.kind === 'noLink' && !b.residentId ? 'noLink' + p.o + p.d : (b.pid || 'n' + b.node + b.t) + b.kind;
      if (seen[k] || picked.length >= MAX_BUBBLES) return;
      seen[k] = true;
      picked.push(b);
    });
    return picked.filter(function (b) { return b.t <= upToT; }).sort(function (a, b) { return a.t - b.t || (a.pid || 0) - (b.pid || 0); })
      .map(function (b) { var o = {}; for (var k in b) if (k !== 'prio') o[k] = b[k]; return o; });
  }

  function observed(records) {
    var out = [];
    records.forEach(function (r, i) { if (r) out.push({ phase: i + 1, status: r.status, waitTotal: r.waitTotal, arriveT: r.arriveT, firstBoardT: r.firstBoardT, transfer: r.transfer }); });
    return out;
  }

  function residentStory(records, residentId, config) {
    var rd = resident(config, residentId), ev = observed(records);
    if (!rd || !ev.length) return null;
    var first = ev[0], last = ev[ev.length - 1];
    var vars = { name: rd.name, stop: nodeName(config, rd.d), zone: nodeName(config, rd.o) };
    var own = stories.residents[residentId] || {}, key = null, drop = null;
    var waitDropped = ev.length >= 2 && first.status === 'arrived' && last.status === 'arrived' && first.waitTotal >= 15 && first.waitTotal - last.waitTotal >= 5;
    var checks = {
      'haneul.waitDropped': waitDropped,
      'jun.waitDropped': waitDropped,
      'narae.nowArrives': ev.length >= 3 && first.status !== 'arrived' && ev.slice(-2).every(function (e) { return e.status === 'arrived'; }),
      'jun.steady': ev.length >= 2 && ev.every(function (e) { return e.status === 'arrived'; }),
      'sol.neverBoarded': ev.every(function (e) { return e.firstBoardT == null; }),
      'sol.ridingAtEnd': last.firstBoardT != null && last.status !== 'arrived'
    };
    Object.keys(own).forEach(function (k) { if (!key && checks[k]) key = k; });
    var text;
    if (key) {
      text = fill(own[key].text, vars);
      if (/waitDropped$/.test(key)) drop = first.waitTotal - last.waitTotal;
    } else {
      var prev = ev[ev.length - 2];
      var diff = prev ? last.waitTotal - prev.waitTotal : 0;
      if (prev && prev.status === 'arrived' && last.status === 'arrived' && diff !== 0) {
        key = 'any.change';
        text = fill(stories.residents.any[key].text, Object.assign({ diff: Math.abs(diff), change: diff < 0 ? '줄었' : '늘었' }, vars));
      } else {
        key = 'any.current';
        text = fill(stories.residents.any[last.status === 'arrived' ? 'any.current.arrived' : 'any.current.open'].text, vars);
      }
    }
    var C = stories.closing;
    var closing = fill(last.status === 'arrived' ? C.arrived.text : last.firstBoardT != null ? C.riding.text : C.notBoarded.text, vars);
    return { residentId: residentId, name: rd.name, role: rd.role, conditionKey: key, text: text, closing: closing, evidence: ev, drop: drop };
  }

  function zoneSubtitleText(kind) { return stories.subtitles[kind]; }

  function hookLines(session) {
    var cfg = session.config, plan = Session.toPlan(session);
    var reqs = Demand.base(cfg, 1, session.seed).length;
    var throughF = plan.buses.some(function (b) { return b.route && b.route.nodes.indexOf('F') >= 0; });
    var H = stories.hook;
    return [fill(H.line1.text, { buses: session.owned, requests: reqs }), fill(throughF ? H.line2Served.text : H.line2.text, {})];
  }

  var api = { fill: fill, bubbles: bubbles, residentStory: residentStory, zoneSubtitleText: zoneSubtitleText, hookLines: hookLines, nodeName: nodeName };
  root.PB = root.PB || {};
  root.PB.Narrative = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
