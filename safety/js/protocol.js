/*
 * 최종 산출물 — 나의 의료 AI 안전 운영 프로토콜(기획 5·6-4).
 *   build(state)   선택값과 1차·최종 운영 결과로 문서 데이터를 만든다
 *   render(doc)    화면·인쇄용 HTML
 *   image(doc)     이미지로 저장할 PNG(글자·도형만 그려 file://에서도 저장된다)
 *   print(doc)     인쇄용 영역만 보이게 하고 window.print()
 * 성찰 글은 이 기기에서 만든 문서에만 들어가고, 통합 이벤트·완료 기록에는 넣지 않는다.
 */
(function (root) {
  'use strict';

  var C = root.SafetyConfig, St = root.SafetyStory, Sim = root.SafetySim, P = root.SafetyPatients;

  function outcome(r) { return C.OUTCOME[r.state] + (r.how && r.state !== 'missed' ? ' — ' + C.HOW[r.how] : ''); }

  // 1차와 최종에서 달라진 환자 한 명(없으면 확신도 96% 사례)
  function caseOf(first, fin) {
    var order = [P.REPORT_CASE].concat(P.list.filter(function (p) { return p.note && p.id !== P.REPORT_CASE; }).map(function (p) { return p.id; }));
    var id = order.filter(function (k) { return first.patients[k].state !== fin.patients[k].state; })[0] || P.REPORT_CASE;
    var p = P.byId(id), a = first.patients[id], b = fin.patients[id];
    var changed = a.state !== b.state;
    var text = changed
      ? '1차 운영에서는 「' + outcome(a) + '」, 최종 운영에서는 「' + outcome(b) + '」입니다.'
      : '두 운영 모두 「' + outcome(a) + '」입니다. 기준을 바꿔도 이 환자에게는 같은 일이 일어났습니다.';
    return { id: id, who: p.note, detail: p.detail, text: text, changed: changed };
  }

  // 그 운영에 남아 있는 위험(언제나 하나 이상 — 어떤 기준에도 위험은 남는다)
  function risks(r, policy) {
    var out = [], never = 0, late = 0;
    P.list.forEach(function (p) { var x = r.patients[p.id]; if (x.state === 'missed') never++; if (x.state === 'late') late++; });
    if (never) {
      var s = 'AI가 경증으로 분류한 중증 환자 ' + never + '명을 끝내 알아채지 못했습니다.';
      if (r.patients[P.REPORT_CASE].state === 'missed') s += ' 위험 신호도 불확실성도 없는 오류(확신도 96% 사례)는 재확인 대상에서 빠지기 쉽습니다.';
      out.push(s);
    }
    if (late) out.push('재검토와 진료를 기다리느라 중증 환자 ' + late + '명의 진료가 30분 넘게 늦어졌습니다.');
    if (r.delayed >= 15) out.push('검토 업무가 몰려 ' + r.delayed + '명이 60분 넘게 기다렸습니다' + (r.worsened ? '. 그중 ' + r.worsened + '명은 기다리다 상태가 나빠졌습니다.' : '.'));
    if (!out.length) out.push('이번 환자 100명에게서는 큰 문제가 드러나지 않았습니다. 하지만 새로운 유형의 AI 오류가 나타나면 지금 기준으로 잡지 못할 수 있어 지속적인 검증이 필요합니다.');
    return out;
  }

  function build(s) {
    var first = Sim.run(s.initial_policy), fin = Sim.run(s.revised_policy, s.budget_allocation);
    var er = St.ERROR_RESPONSE.options.filter(function (o) { return o.id === s.error_response; })[0];
    var rp = St.RESPONSIBILITY.options.filter(function (o) { return o.id === s.responsibility_policy; })[0];
    return {
      date: new Date().toLocaleDateString('ko-KR'),
      first: first, final: fin,
      policyFirst: s.initial_policy, policy: s.revised_policy,
      safeguards: s.budget_allocation || [],
      errorResponse: er ? er.short : '', responsibility: rp ? rp.short : '',
      tendency: Sim.tendency(s.revised_policy),
      case: caseOf(first, fin),
      risksFirst: risks(first, s.initial_policy), risksFinal: risks(fin, s.revised_policy),
      reflection: s.reflection || null
    };
  }

  function rowsOf(doc) {
    var p = doc.policy, f = doc.policyFirst;
    function was(k, label) { return f[k] !== p[k] ? ' (처음: ' + label(f[k]) + ')' : ''; }
    return [
      ['경증 환자', C.LEVEL[p.mild].short + was('mild', function (v) { return C.LEVEL[v].short; })],
      ['중증 환자', C.LEVEL[p.severe].short + was('severe', function (v) { return C.LEVEL[v].short; })],
      ['응급 환자', C.EMERG[p.emergency].short + was('emergency', function (v) { return C.EMERG[v].short; })]
    ];
  }
  function compareRows(doc) {
    var a = doc.first, b = doc.final;
    return [
      ['진료 지연 환자 수', a.delayed + '명', b.delayed + '명'],
      ['놓친 위험 환자 수', a.missed + '명', b.missed + '명'],
      ['의료진 추가 검토 건수', a.reviews + '건', b.reviews + '건']
    ];
  }
  function safeguardText(doc) { return doc.safeguards.length ? doc.safeguards.map(function (k) { return C.SAFEGUARD[k].label; }).join(' · ') : '추가 안전장치 없음'; }
  var CLOSING = 'AI를 활용하면서도 위험한 오류를 놓치지 않도록 기준과 안전장치를 마련했습니다. 그러나 어떤 운영 기준에도 위험은 남을 수 있습니다. 지속적인 검증과 개선이 필요합니다.';

  // ── HTML ──
  function h(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function render(doc) {
    var a = h('article', 'protocol-doc');
    var head = h('header', 'pd-head');
    head.appendChild(h('p', 'pd-eyebrow', '미래종합병원 의료 AI 안전기준 위원회 · 청소년 시민위원 · ' + doc.date));
    head.appendChild(h('h2', 'pd-title', '나의 의료 AI 안전 운영 프로토콜'));
    head.appendChild(h('p', 'ee-badge pd-tendency', '경향: ' + St.TENDENCY[doc.tendency].title));
    a.appendChild(head);

    function section(title) { var s = h('section', 'pd-sec'); s.appendChild(h('h3', 'pd-h', title)); a.appendChild(s); return s; }
    var s1 = section('1. AI 활용 기준'), dl = h('dl', 'pd-rows');
    rowsOf(doc).forEach(function (r) { dl.appendChild(h('dt', '', r[0])); dl.appendChild(h('dd', '', r[1])); });
    s1.appendChild(dl);
    section('2. 추가 안전장치').appendChild(h('p', '', safeguardText(doc)));
    var s3 = section('3. 오류 대응 및 책임');
    s3.appendChild(h('p', '', '오류가 발견되면 ' + doc.errorResponse + '. 환자에 대한 즉각적인 보호와 필요한 의료 조치는 언제나 함께 합니다.'));
    s3.appendChild(h('p', '', '책임 체계: ' + doc.responsibility + '.'));
    var s4 = section('4. 언제나 지키는 필수 안전 원칙'), ul = h('ul', 'pd-list');
    St.PRINCIPLES.forEach(function (t) { ul.appendChild(h('li', '', t)); });
    s4.appendChild(ul);

    var s5 = section('5. 운영 결과 비교 (같은 가상 환자 100명)');
    var wrap = h('div', 'table-wrap'), t = h('table', 'pd-table'), thead = h('thead'), tr = h('tr');
    ['비교 항목', '1차 운영', '최종 운영'].forEach(function (x) { var th = h('th', '', x); th.scope = 'col'; tr.appendChild(th); });
    thead.appendChild(tr); t.appendChild(thead);
    var tb = h('tbody');
    compareRows(doc).forEach(function (r) { var row = h('tr'); var th = h('th', '', r[0]); th.scope = 'row'; row.appendChild(th); row.appendChild(h('td', '', r[1])); row.appendChild(h('td', '', r[2])); tb.appendChild(row); });
    var rr = h('tr'), rth = h('th', '', '주요 안전 위험'); rth.scope = 'row'; rr.appendChild(rth);
    var c1 = h('td'), c2 = h('td');
    doc.risksFirst.forEach(function (x) { c1.appendChild(h('p', '', x)); });
    doc.risksFinal.forEach(function (x) { c2.appendChild(h('p', '', x)); });
    rr.appendChild(c1); rr.appendChild(c2); tb.appendChild(rr);
    t.appendChild(tb); wrap.appendChild(t); s5.appendChild(wrap);
    s5.appendChild(h('p', 'pd-note', '최종 운영에는 수정한 기준과 추가 안전장치가 함께 적용되었습니다. 최종 결과가 꼭 더 좋아야 하는 것은 아닙니다.'));

    var s6 = section('6. 한 환자에게 생긴 변화');
    s6.appendChild(h('p', 'pd-case-who', doc.case.id + ' · ' + doc.case.who));
    s6.appendChild(h('p', '', doc.case.detail));
    s6.appendChild(h('p', '', doc.case.text));

    var msg = h('section', 'pd-sec pd-closing'); msg.appendChild(h('h3', 'pd-h', '최종 메시지')); msg.appendChild(h('p', '', CLOSING)); a.appendChild(msg);

    if (doc.reflection) {
      var s7 = section('나의 성찰');
      St.REFLECT.forEach(function (q) {
        s7.appendChild(h('p', 'pd-q', q.text));
        s7.appendChild(h('p', 'pd-a', (doc.reflection[q.id] || '').trim() || '(비워 둠)'));
      });
    }
    return a;
  }

  // ── 이미지(PNG) ──
  function wrapText(ctx, text, width) {
    var out = [], line = '';
    String(text).split('\n').forEach(function (para) {
      line = '';
      para.split(/(\s+)/).forEach(function (word) {
        var test = line + word;
        if (ctx.measureText(test).width <= width) { line = test; return; }
        if (line.trim()) { out.push(line.trim()); line = ''; }
        // 한 단어가 너무 길면 글자 단위로
        for (var i = 0; i < word.length; i++) {
          if (ctx.measureText(line + word[i]).width > width) { out.push(line); line = ''; }
          line += word[i];
        }
      });
      if (line.trim()) out.push(line.trim());
    });
    return out;
  }
  function image(doc) {
    var Wd = 1080, pad = 64, inner = Wd - pad * 2;
    var font = '"Ethicity", "Malgun Gothic", sans-serif';
    var ops = [];
    // 1차: 높이 계산, 2차: 그리기
    function layout(ctx) {
      var y = 0; ops = [];
      function text(str, size, opt) {
        opt = opt || {};
        ctx.font = (opt.bold ? '700 ' : '400 ') + size + 'px ' + font;
        var lines = wrapText(ctx, str, opt.width || inner);
        lines.forEach(function (ln) { y += size * 1.55; ops.push({ t: 'text', s: ln, x: pad + (opt.indent || 0), y: y, size: size, bold: opt.bold, color: opt.color }); });
      }
      function gap(n) { y += n; }
      function rule() { gap(18); ops.push({ t: 'rule', y: y }); gap(10); }
      ops.push({ t: 'band' });
      y = 40;
      text('미래종합병원 의료 AI 안전기준 위원회 · 청소년 시민위원 · ' + doc.date, 20, { color: '#fff9e7' });
      text('나의 의료 AI 안전 운영 프로토콜', 40, { bold: true, color: '#fff9e7' });
      gap(16); ops[0].h = y + 24; y += 40;
      text('경향: ' + St.TENDENCY[doc.tendency].title, 22, { bold: true, color: '#5a8c65' });
      rule();
      text('1. AI 활용 기준', 26, { bold: true });
      rowsOf(doc).forEach(function (r) { text(r[0] + ' — ' + r[1], 22, { indent: 16, width: inner - 16 }); });
      rule();
      text('2. 추가 안전장치', 26, { bold: true }); text(safeguardText(doc), 22, { indent: 16, width: inner - 16 });
      rule();
      text('3. 오류 대응 및 책임', 26, { bold: true });
      text('오류가 발견되면 ' + doc.errorResponse + '. 환자 보호와 필요한 의료 조치는 언제나 함께 합니다.', 22, { indent: 16, width: inner - 16 });
      text('책임 체계: ' + doc.responsibility + '.', 22, { indent: 16, width: inner - 16 });
      rule();
      text('4. 언제나 지키는 필수 안전 원칙', 26, { bold: true });
      St.PRINCIPLES.forEach(function (t) { text('· ' + t, 20, { indent: 16, width: inner - 16 }); });
      rule();
      text('5. 운영 결과 비교 (같은 가상 환자 100명)', 26, { bold: true });
      compareRows(doc).forEach(function (r) { text(r[0] + ': 1차 ' + r[1] + ' → 최종 ' + r[2], 22, { indent: 16, width: inner - 16 }); });
      text('1차 운영의 위험', 22, { bold: true, indent: 16 });
      doc.risksFirst.forEach(function (x) { text('· ' + x, 20, { indent: 32, width: inner - 32 }); });
      text('최종 운영에도 남은 위험', 22, { bold: true, indent: 16 });
      doc.risksFinal.forEach(function (x) { text('· ' + x, 20, { indent: 32, width: inner - 32 }); });
      rule();
      text('6. 한 환자에게 생긴 변화', 26, { bold: true });
      text(doc.case.id + ' · ' + doc.case.who, 22, { bold: true, indent: 16 });
      text(doc.case.detail, 20, { indent: 16, width: inner - 16 });
      text(doc.case.text, 20, { indent: 16, width: inner - 16 });
      rule();
      text('최종 메시지', 26, { bold: true }); text(CLOSING, 22, { indent: 16, width: inner - 16 });
      if (doc.reflection) {
        rule();
        text('나의 성찰', 26, { bold: true });
        St.REFLECT.forEach(function (q) {
          text(q.text, 20, { bold: true, indent: 16, width: inner - 16, color: '#5a8c65' });
          text((doc.reflection[q.id] || '').trim() || '(비워 둠)', 20, { indent: 16, width: inner - 16 });
          gap(6);
        });
      }
      gap(56);
      return y;
    }
    var fontsReady = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('400 22px Ethicity'), document.fonts.load('700 22px Ethicity')]).catch(function () {}) : Promise.resolve();
    return fontsReady.then(function () {
      var c = document.createElement('canvas'), ctx = c.getContext('2d');
      c.width = Wd; c.height = 100;
      var H = Math.ceil(layout(ctx));
      c.width = Wd; c.height = H;
      ctx = c.getContext('2d');
      layout(ctx);
      ctx.fillStyle = '#fff9e7'; ctx.fillRect(0, 0, Wd, H);
      ctx.strokeStyle = '#294b40'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, Wd - 8, H - 8);
      ops.forEach(function (o) {
        if (o.t === 'band') { ctx.fillStyle = '#294b40'; ctx.fillRect(0, 0, Wd, o.h); }
        else if (o.t === 'rule') { ctx.fillStyle = '#a8bb8c'; ctx.fillRect(pad, o.y, inner, 3); }
        else { ctx.fillStyle = o.color || '#294b40'; ctx.font = (o.bold ? '700 ' : '400 ') + o.size + 'px ' + font; ctx.textBaseline = 'alphabetic'; ctx.fillText(o.s, o.x, o.y); }
      });
      ctx.fillStyle = '#5a8c65'; ctx.font = '400 16px ' + font; ctx.fillText('윤리시티 · AI 윤리 탐험대 — 안전성 · 게임 속 환자와 수치는 모두 가상입니다.', pad, H - 28);
      return new Promise(function (resolve) {
        if (c.toBlob) c.toBlob(function (b) { resolve(b ? URL.createObjectURL(b) : c.toDataURL('image/png')); }, 'image/png');
        else resolve(c.toDataURL('image/png'));
      });
    });
  }

  function print(doc) {
    var area = document.getElementById('print-area');
    area.innerHTML = ''; area.appendChild(render(doc));
    document.body.classList.add('printing');
    setTimeout(function () {
      window.print();
      setTimeout(function () { document.body.classList.remove('printing'); }, 400);
    }, 60);
  }

  root.SafetyProtocol = { build: build, render: render, image: image, print: print, risks: risks, caseOf: caseOf };
})(this);
