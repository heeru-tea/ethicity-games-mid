/*
 * 미션 화면 — 운영 기준 설정(미션 1·3), 환자 100명 운영 재생(미션 2·4), 긴급 오류 보고서(미션 3), 안전관리 예산(미션 4).
 * 재생은 결과를 미리 계산해 두고 접수 순서대로 보여 줄 뿐이다(움직임 줄이기면 바로 결과).
 */
(function (root) {
  'use strict';

  var C = root.SafetyConfig, U = root.SafetyUI, Sim = root.SafetySim, P = root.SafetyPatients;
  var el = U.el;

  var TIER = {
    mild: { n: '①', title: '경증 환자', desc: '당장 위험해 보이지 않지만 드물게 중요한 질환이 숨어 있을 수 있는 환자' },
    severe: { n: '②', title: '중증 환자', desc: '상태가 악화되면 심각한 피해가 발생할 수 있는 환자' },
    emergency: { n: '③', title: '응급환자', desc: '의료진의 즉각적인 평가와 처치가 반드시 필요한 환자. AI는 어떤 역할을 할까요?' }
  };

  function policyText(p) { return C.LEVEL[p.mild].short + ' · ' + C.LEVEL[p.severe].short + ' · ' + C.EMERG[p.emergency].short; }

  // 운영 기준 설정. revise면 처음 기준을 미리 골라 두고 '처음' 표시를 붙인다
  function policy(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var value = Object.assign({}, opts.value || {}), first = opts.first;
      var body = el('div', 'policy');
      if (opts.lead) body.appendChild(el('p', 'sheet-lead', opts.lead));
      var confirm;
      function group(key, options) {
        var g = el('section', 'policy-group');
        var h = el('h3', 'policy-h'); h.appendChild(el('span', 'policy-n', TIER[key].n + ' ')); h.appendChild(document.createTextNode(TIER[key].title));
        if (first) { var b = el('span', 'ee-badge policy-first', '처음: ' + (key === 'emergency' ? C.EMERG[first[key]].short : C.LEVEL[first[key]].short)); h.appendChild(b); }
        g.appendChild(h);
        g.appendChild(el('p', 'policy-desc', TIER[key].desc));
        var list = U.choiceList(options, { value: value[key], label: TIER[key].title, onChange: function (v) { value[key] = v; sync(); } });
        g.appendChild(list.el);
        body.appendChild(g);
      }
      var lv = Sim.LEVELS.map(function (k) { return { id: k, text: C.LEVEL[k].label, sub: C.LEVEL[k].how }; });
      group('mild', lv);
      group('severe', lv);
      group('emergency', Sim.EMERGENCY.map(function (k) { return { id: k, text: C.EMERG[k].label, sub: C.EMERG[k].how }; }));
      body.appendChild(el('p', 'ee-notice sheet-note', '모든 선택에서 응급환자의 즉각적인 평가와 의료진의 필수 평가·진단 책임은 유지됩니다. 차이는 AI의 정보를 얼마나 활용하고 어떤 추가 검토를 하는지에 있습니다.'));
      var sh = openSheetWide(opts.eyebrow || '미션 1', opts.title || '의료 AI 활용 기준 설정', body);
      confirm = sh.button('', '', function () { sh.close(); resolve({ mild: value.mild, severe: value.severe, emergency: value.emergency }); });
      function sync() {
        var done = value.mild && value.severe && value.emergency;
        confirm.disabled = !done;
        if (!first) confirm.textContent = done ? '이 기준으로 정하기' : '세 가지를 모두 골라 주세요';
        else {
          var same = done && value.mild === first.mild && value.severe === first.severe && value.emergency === first.emergency;
          confirm.textContent = !done ? '세 가지를 모두 골라 주세요' : same ? '처음 기준을 유지하기' : '수정한 기준으로 정하기';
        }
      }
      sync();
    });
  }
  function openSheetWide(eyebrow, title, body) { return U.openSheet({ eyebrow: eyebrow, title: title, body: body, wide: true }); }

  // ── 운영 재생 ──
  var SYMBOL = { ontime: '✓', delayed: '⏱', worsened: '▼', missed: '!', late: '!', emergency: '+' };
  function stateOf(p, r) { return p.actual === 'emergency' ? 'emergency' : r.state; }
  function clock(min) {
    var h = 9 + Math.floor(min / 60), m = min % 60, pm = h >= 12;
    return (pm ? '오후 ' : '오전 ') + (h > 12 ? h - 12 : h) + ':' + String(m).padStart(2, '0');
  }
  function metricCard(icon, title, sub, value, unit, before) {
    var c = el('div', 'metric');
    var head = el('div', 'metric-head'); head.appendChild(iconEl(icon)); head.appendChild(el('span', 'metric-title', title)); c.appendChild(head);
    var v = el('p', 'metric-value');
    if (before != null) { v.appendChild(el('span', 'metric-before', before + unit + ' → ')); }
    v.appendChild(el('strong', '', String(value))); v.appendChild(document.createTextNode(unit));
    c.appendChild(v);
    c.appendChild(el('p', 'metric-sub', sub));
    return c;
  }
  function iconEl(id) {
    var c = el('canvas', 'ee-icon'); c.width = c.height = 64; c.setAttribute('aria-hidden', 'true');
    U.state.assets.drawIcon(c.getContext('2d'), id, 0, 0, 64); return c;
  }
  function metrics(r, before) {
    var wrap = el('div', 'metrics');
    wrap.appendChild(metricCard('timer', '진료 지연', '60분 넘게 기다린 환자' + (r.worsened ? ' (그중 기다리다 상태가 나빠진 환자 ' + r.worsened + '명)' : ''), r.delayed, '명', before && before.delayed));
    wrap.appendChild(metricCard('warning', '놓친 위험', '제때(30분 안에) 발견하지 못한 중증 환자', r.missed, '명', before && before.missed));
    wrap.appendChild(metricCard('inspect', '검토 업무', '의료진이 AI 결과를 다시 확인한 건수', r.reviews, '건', before && before.reviews));
    return wrap;
  }
  // 이야기에 나오는 환자들의 결과
  function notable(r) {
    var ul = el('ul', 'notable');
    P.list.filter(function (p) { return p.note; }).forEach(function (p) {
      var x = r.patients[p.id], li = el('li');
      li.appendChild(el('strong', '', p.id + ' ' + p.note));
      var how = x.how ? ' · ' + C.HOW[x.how] : '';
      li.appendChild(el('span', 'notable-state st-' + x.state, ' — ' + SYMBOL[x.state] + ' ' + C.OUTCOME[x.state] + how + (x.state !== 'missed' ? ' (대기 ' + Math.max(0, Math.round(x.wait)) + '분)' : '')));
      ul.appendChild(li);
    });
    return ul;
  }

  function playback(r, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var body = el('div', 'playback');
      if (opts.lead) body.appendChild(el('p', 'sheet-lead', opts.lead));
      body.appendChild(el('p', 'ee-badge playback-policy', opts.policyLabel));
      var top = el('div', 'playback-top');
      var clk = el('p', 'playback-clock', clock(0)); clk.setAttribute('aria-hidden', 'true');
      top.appendChild(clk);
      var count = el('p', 'playback-count', '접수 0 / 100명'); top.appendChild(count);
      body.appendChild(top);
      var grid = el('div', 'pgrid'); grid.setAttribute('aria-hidden', 'true');
      var cells = P.list.map(function (p) {
        var c = el('span', 'pcell'); grid.appendChild(c); return { p: p, c: c };
      });
      body.appendChild(grid);
      var legend = el('ul', 'legend');
      [['ontime', '제때 진료'], ['delayed', '60분 넘게 기다림'], ['worsened', '기다리다 상태 악화'], ['missed', '놓친 위험'], ['emergency', '응급 — 즉시 평가']].forEach(function (x) {
        var li = el('li'); li.appendChild(el('span', 'pcell st-' + x[0], SYMBOL[x[0]])); li.appendChild(document.createTextNode(' ' + x[1])); legend.appendChild(li);
      });
      var li2 = el('li'); var rc = el('span', 'pcell rv', ''); li2.appendChild(rc); li2.appendChild(document.createTextNode(' 테두리 = 의료진 재검토')); legend.appendChild(li2);
      body.appendChild(legend);
      var after = el('div', 'playback-after'); after.hidden = true; body.appendChild(after);
      var live = el('p', 'sr-only'); live.setAttribute('aria-live', 'polite'); body.appendChild(live);

      var sh = openSheetWide(opts.eyebrow, opts.title, body);
      var skip = sh.button('바로 결과 보기', 'secondary', finish);
      var ok = sh.button(opts.button || '확인했어요', '', function () { sh.close(); resolve(); });
      ok.disabled = true;

      var i = 0, timer = 0, done = false;
      function reveal(k) {
        var x = cells[k], rr = r.patients[x.p.id], st = stateOf(x.p, rr);
        x.c.className = 'pcell st-' + st + (rr.reviewed ? ' rv' : '');
        x.c.textContent = SYMBOL[st];
      }
      function finish() {
        if (done) return; done = true; clearInterval(timer);
        for (; i < cells.length; i++) reveal(i);
        clk.textContent = clock(240) + ' 운영 종료'; count.textContent = '접수 100 / 100명';
        after.hidden = false;
        after.appendChild(metrics(r, opts.before));
        after.appendChild(el('p', 'ee-success emergency-line', '응급환자 ' + r.emergencyOnTime + '명은 모두 접수 즉시 의료진이 평가했습니다. (모든 기준에 공통)'));
        var d = el('details', 'notable-wrap'); d.appendChild(el('summary', '', '눈여겨볼 환자 ' + P.list.filter(function (p) { return p.note; }).length + '명의 결과 보기'));
        d.appendChild(notable(r)); after.appendChild(d);
        live.textContent = '운영 결과: 진료 지연 ' + r.delayed + '명, 놓친 위험 ' + r.missed + '명, 검토 업무 ' + r.reviews + '건.';
        skip.hidden = true; ok.disabled = false; ok.focus({ preventScroll: true });
        if (U.state.onSound) U.state.onSound('paper');
      }
      if (opts.reducedMotion) finish();
      else timer = setInterval(function () {
        for (var n = 0; n < 2 && i < cells.length; n++, i++) reveal(i);
        clk.textContent = clock(Math.min(240, Math.round(i * 2.4))); count.textContent = '접수 ' + i + ' / 100명';
        if (i >= cells.length) finish();
      }, 70);
    });
  }

  // ── 미션 3 긴급 오류 보고서 ──
  function report(firstResult) {
    return new Promise(function (resolve) {
      var p = P.byId(P.REPORT_CASE), mine = firstResult.patients[p.id];
      var body = el('div', 'report');
      var doc = el('article', 'report-doc');
      var head = el('div', 'report-head'); head.appendChild(iconEl('warning')); head.appendChild(el('strong', '', '긴급 오류 보고서 · 메디AI')); doc.appendChild(head);
      doc.appendChild(el('p', 'report-meta', '대상: ' + p.id + ' · ' + p.note));
      var ai = el('section', 'report-box');
      ai.appendChild(el('p', 'report-label', '메디AI의 판단'));
      var conf = el('div', 'conf'); conf.appendChild(el('span', 'conf-label', '확신도'));
      var bar = el('span', 'conf-bar'); var fillb = el('span', 'conf-fill'); fillb.style.width = p.conf + '%'; bar.appendChild(fillb); conf.appendChild(bar);
      conf.appendChild(el('strong', 'conf-num', p.conf + '%')); ai.appendChild(conf);
      ai.appendChild(el('p', 'report-quote', '“이 환자는 경증일 가능성이 높습니다.”'));
      doc.appendChild(ai);
      var real = el('section', 'report-box real');
      real.appendChild(el('p', 'report-label', '실제 확인 결과'));
      real.appendChild(el('p', '', '해당 환자는 빠른 치료가 필요한 중증 질환을 가지고 있었습니다. AI가 높은 확신도를 표시했지만 잘못된 판단이었습니다.'));
      real.appendChild(el('p', 'report-detail', p.detail));
      doc.appendChild(real);
      var yours = el('p', 'ee-notice report-yours');
      yours.textContent = '당신의 1차 운영에서 이 환자는: ' + C.OUTCOME[mine.state] + (mine.how ? ' (' + C.HOW[mine.how] + ')' : '') +
        (mine.state === 'missed' ? '. 위험 신호도 없고 확신도도 높아 재확인 대상에서 빠졌습니다.' : '.');
      doc.appendChild(yours);
      doc.appendChild(el('p', 'report-foot', '※ 확신도 96%는 AI가 출력한 가상 수치이며, 실제로 정답일 확률이 96%라는 뜻이 아닙니다.'));
      body.appendChild(doc);
      var sh = openSheetWide('미션 3', '긴급 오류 보고서', body);
      sh.button('보고서를 읽었어요', '', function () { sh.close(); resolve(); });
    });
  }

  // ── 미션 4 안전관리 예산 ──
  function budget() {
    return new Promise(function (resolve) {
      var picked = [], body = el('div', 'budget');
      body.appendChild(el('p', 'sheet-lead', '추가 안전관리 예산은 5포인트입니다. 기본적인 환자 보호 의무는 모두 지켜집니다. 추가로 강화할 안전장치를 골라 주세요.'));
      var left = el('p', 'budget-left'); body.appendChild(left);
      var list = el('div', 'choice-list'); list.setAttribute('role', 'group'); list.setAttribute('aria-label', '안전장치');
      var items = Object.keys(Sim.SAFEGUARDS).map(function (k, i) {
        var b = el('button', 'ee-choice budget-item'); b.type = 'button';
        var mark = el('span', 'choice-mark'); mark.setAttribute('aria-hidden', 'true'); b.appendChild(mark);
        var t = el('span', 'choice-text');
        t.appendChild(el('span', 'choice-num', (i + 1) + '. '));
        t.appendChild(document.createTextNode(C.SAFEGUARD[k].label));
        t.appendChild(el('span', 'ee-badge cost', Sim.SAFEGUARDS[k].cost + 'P'));
        t.appendChild(el('span', 'choice-sub', C.SAFEGUARD[k].desc + ' — ' + C.SAFEGUARD[k].how));
        var why = el('span', 'choice-why'); t.appendChild(why);
        b.appendChild(t);
        b.addEventListener('click', function () { toggle(k); });
        list.appendChild(b);
        return { k: k, b: b, mark: mark, why: why };
      });
      body.appendChild(list);
      list.addEventListener('keydown', function (e) {
        var n = Number(e.key);
        if (n >= 1 && n <= items.length) { e.preventDefault(); items[n - 1].b.focus(); toggle(items[n - 1].k); }
      });
      var sh = openSheetWide('미션 4', '안전관리 예산 배분', body);
      var ok = sh.button('', '', function () { sh.close(); resolve(picked.slice()); });
      function toggle(k) {
        var at = picked.indexOf(k);
        if (at >= 0) picked.splice(at, 1);
        else if (Sim.cost(picked) + Sim.SAFEGUARDS[k].cost <= Sim.BUDGET) picked.push(k);
        else { U.notice('남은 예산이 부족해요. 다른 안전장치를 빼고 골라 주세요.'); return; }
        if (U.state.onSound) U.state.onSound('tap');
        sync();
      }
      function sync() {
        var rest = Sim.BUDGET - Sim.cost(picked);
        left.textContent = '남은 예산 ' + rest + 'P / ' + Sim.BUDGET + 'P';
        items.forEach(function (x) {
          var on = picked.indexOf(x.k) >= 0, afford = on || Sim.SAFEGUARDS[x.k].cost <= rest;
          x.b.setAttribute('aria-pressed', on ? 'true' : 'false');
          x.mark.textContent = on ? '✔' : '';
          x.b.classList.toggle('cant', !afford);
          x.why.textContent = afford ? '' : ' (예산이 부족해요)';
        });
        ok.textContent = picked.length ? '이 안전장치로 정하기 (' + Sim.cost(picked) + 'P)' : '추가 안전장치 없이 정하기';
      }
      sync();
    });
  }

  root.SafetyPanels = { policy: policy, playback: playback, report: report, budget: budget, metrics: metrics, policyText: policyText, iconEl: iconEl, clock: clock };
})(this);
