/*
 * 결과 화면 — 예상과 실제를 한 카드에 나눠 보이고, 모든 생활권 표·재정·주민 반응을 원자료와 함께 보여 준다.
 * 단계마다 수요·사건이 다를 수 있으므로 차이를 전부 노선 변경 탓으로 말하지 않는다.
 */
(function (root) {
  'use strict';
  var PB = root.PB, cfg = PB.config, M = PB.Metrics, S = PB.Session;
  var UI = PB.UI = PB.UI || {};

  function app() { return PB.App; }
  function el(t, a, x) { return app().el(t, a, x); }
  function table(headers, rows, foot) {
    var t = el('table'), th = el('thead'), tr = el('tr');
    headers.forEach(function (h) { tr.appendChild(el('th', { scope: 'col' }, h)); });
    th.appendChild(tr); t.appendChild(th);
    var tb = el('tbody');
    rows.forEach(function (r) {
      var row = el('tr');
      r.forEach(function (c, i) { row.appendChild(el(i === 0 ? 'th' : 'td', i === 0 ? { scope: 'row' } : null, c)); });
      tb.appendChild(row);
    });
    t.appendChild(tb);
    if (foot) {
      var tf = el('tfoot'), fr = el('tr');
      foot.forEach(function (c, i) { fr.appendChild(el(i === 0 ? 'th' : 'td', i === 0 ? { scope: 'row' } : null, c)); });
      tf.appendChild(fr); t.appendChild(tf);
    }
    var w = el('div', { 'class': 'table-wrap' }); w.appendChild(t);
    return w;
  }
  UI.table = table;

  UI.result = function (App, panel) {
    var s = App.s, h = s.history[s.history.length - 1], m = h.metrics, e = h.expected;
    panel.appendChild(el('p', { 'class': 'eyebrow' }, h.phase + '단계 · ' + cfg.phases[h.phase - 1] + ' — 결과'));
    panel.appendChild(el('h2', null, '운행이 끝났어요'));

    // 사건
    if (h.event && h.event.type === 'demand') {
      var od = PB.Demand.directional(cfg, h.phase)[h.event.odIndex];
      panel.appendChild(el('p', { 'class': 'callout' }, h.event.t + '분에 ' + App.nodeName(od.o) + '→' + App.nodeName(od.d) + ' 요청이 12건 늘었어요(추가 수요).'));
    }
    if (h.petition) panel.appendChild(el('p', { 'class': 'callout warn' }, h.petition.t + '분 ' + App.nodeName(h.petition.zone) + ' 주민 청원: 그때까지 요청 ' + h.petition.total + '건 중 ' + h.petition.count + '명이 아직 도착하지 못했어요.'));

    // 예상과 실제
    var cmp = el('section', { id: 'result-compare', 'class': 'card' });
    cmp.appendChild(el('h3', null, '예상과 실제'));
    var row = function (name, f) { return [name, f(e), f(m)]; };
    cmp.appendChild(table(['', '예상', '실제'], [
      row('요청', function (x) { return x.N + '건'; }),
      row('도착', function (x) { return x.arrived + '명 (' + M.fmtRate(x.arrivalRate) + ')'; }),
      row('최장 대기', function (x) { return x.maxWait + '분'; }),
      row('이번 단계 손익', function (x) { return App.won(x.costs.total); }),
      row('학교·병원 도착률', function (x) { return M.fmtRate(x.essential.arriveRate); })
    ]));
    var notes = ['예상은 추가 사건 없는 기본 수요 기준이에요.'];
    if (m.N !== e.N) notes.push('실제 요청이 ' + (m.N - e.N) + '건 늘어 분모가 달라요(추가 수요).');
    notes.push('단계마다 수요와 사건이 달라서, 차이를 모두 노선 변경의 효과로 볼 수는 없어요.');
    cmp.appendChild(el('p', { 'class': 'note' }, notes.join(' ')));
    panel.appendChild(cmp);

    // 생활권 표
    var zs = el('section', { 'aria-labelledby': 'zone-h' });
    zs.appendChild(el('h3', { id: 'zone-h' }, '출발 생활권별 결과'));
    var ids = Object.keys(m.zones);
    var rows = ids.map(function (id) {
      var z = m.zones[id];
      return [App.nodeName(id) + '(' + id + ')', String(z.N), String(z.arrived), String(z.waiting), String(z.transfer), String(z.riding),
        M.fmtRate(z.rate), z.N ? z.maxWait + '분' : '-', z.D == null ? '-' : String(z.D),
        (h.trustBefore[id] != null ? h.trustBefore[id] : cfg.trust.initial) + '→' + h.trustAfter[id]];
    });
    var tbl = table(['생활권', '요청', '도착', '미탑승', '환승 중', '탑승 중', '도착률', '최장 대기', '불만', '신뢰'], rows,
      ['합계', String(m.N), String(m.arrived), String(m.waiting), String(m.transfer), String(m.riding), M.fmtRate(m.arrivalRate), m.maxWait + '분', '', '']);
    tbl.querySelector('table').id = 'zone-table';
    zs.appendChild(tbl);
    zs.appendChild(el('p', { 'class': 'note' }, '전체 도착률은 인원 합으로 계산해요(생활권 비율의 평균이 아니에요). 불만·신뢰는 게임 반응을 위한 지수예요. 노선 연결률은 공식 공공성 지수가 아니에요.'));
    var extra = el('dl', { 'class': 'kv' });
    [['이용자(한 번 이상 탄 사람)', m.users + '명 / ' + m.N],
      ['승차 횟수(환승 포함)', m.boardings + '회'],
      ['요금 낸 미완료', m.costs.paidUnfinished + '명'],
      ['완료한 이동의 평균 소요', m.travel.doneAvg == null ? '-' : Math.round(m.travel.doneAvg) + '분'],
      ['미완료 이동의 관측 경과(120분까지)', m.travel.openAvg == null ? '-' : Math.round(m.travel.openAvg) + '분'],
      ['학교·병원 연결률 / 도착률', M.fmtRate(m.essential.linkRate) + ' / ' + M.fmtRate(m.essential.arriveRate)]
    ].forEach(function (kv) { extra.appendChild(el('dt', null, kv[0])); extra.appendChild(el('dd', null, kv[1])); });
    zs.appendChild(extra);
    panel.appendChild(zs);

    // 주민
    var rs = el('section', { 'aria-labelledby': 'res-h' });
    rs.appendChild(el('h3', { id: 'res-h' }, '자주 보는 주민'));
    var ul = el('ul', { 'class': 'plain' });
    cfg.residents.forEach(function (rd) {
      var r = h.residents[rd.id];
      if (!r) return;
      var state = r.status === 'arrived' ? App.nodeName(rd.d) + '에 도착' : r.status === 'riding' ? '아직 버스 안' : r.status === 'transfer' ? '갈아타는 중' : (r.fail === 'NO_LINK' ? '탈 수 있는 노선 없음' : '아직 타지 못함');
      ul.appendChild(el('li', null, rd.role + ' ' + rd.name + '(' + rd.o + '→' + rd.d + '): ' + state + ' · 기다린 시간 ' + r.waitTotal + '분' + (r.transfer ? ' · 한 번 갈아탐' : '')));
    });
    rs.appendChild(ul);
    panel.appendChild(rs);

    var bs = el('section', { 'aria-labelledby': 'bub-h' });
    bs.appendChild(el('h3', { id: 'bub-h' }, '운행 중 들린 말'));
    var bl = el('ul', { id: 'bubble-replay', 'class': 'feed' });
    PB.Narrative.bubbles(s.current.result, cfg, cfg.bus.window).forEach(function (b) {
      var who = b.residentId ? cfg.residents.filter(function (r) { return r.id === b.residentId; })[0].name : '주민';
      bl.appendChild(el('li', null, b.t + '분 · ' + who + '(' + App.nodeName(b.node) + '): “' + b.text + '”'));
    });
    bs.appendChild(bl);
    panel.appendChild(bs);

    // 재정
    var fs = el('section', { id: 'finance', 'aria-labelledby': 'fin-h' });
    fs.appendChild(el('h3', { id: 'fin-h' }, '재정(가상원)'));
    var k = m.costs, bal = s.history.reduce(function (a, x) { return a + x.metrics.costs.total; }, 0);
    fs.appendChild(table(['항목', '금액'], [
      ['위탁 지원금', App.won(k.subsidy)], ['운임 수입', App.won(k.fare)], ['차량 보유비', App.won(-k.holding)],
      ['원격 관제·운영비', App.won(-k.op)], ['에너지·정비(이동)', App.won(-k.move)]
    ], ['이번 단계 손익', App.won(k.total)]));
    fs.appendChild(el('p', null, '누적 잔액: ' + App.won(bal)));
    if (bal < 0) fs.appendChild(el('p', { 'class': 'note' }, '잔액이 마이너스여도 운행과 다음 단계는 그대로 이어져요.'));
    panel.appendChild(fs);

    var last = s.phase >= cfg.phases.length;
    panel.appendChild(el('button', { type: 'button', 'class': 'btn btn-primary btn-lg', id: 'btn-next-phase', onclick: function () {
      S.nextPhase(s); App.go(s.stage === 'ending' ? 'ending' : 'reveal');
    } }, last ? '학기 마무리 보기' : (s.phase + 1) + '단계로'));
    return {};
  };
})(window);
