/* 공정성·포용 개편(2026-11-10) 계획 화면 조각: 청원 카드(3단계)·무임 정책 카드(4단계)·'AI가 본 자료' 줄·출발 전 선택 안내.
 * 저장은 PB.Choices(petitionReply·elderPolicy). 입력은 다시 그리지 않고 바로 저장하고, 고르기만 hooks.rerender(포커스 선택자)로 다시 그린다.
 * hooks = { rerender(sel), nudge: 이유 안내를 보일 kind('petition'|'elder'|null), onWhy(kind) } */
(function (root) {
  'use strict';
  var PB = root.PB = root.PB || {}, UI = PB.UI = PB.UI || {};
  var LABELS = {
    petition: { id: 'petition', values: { reflect: '반영한다', 'not-now': '이번엔 못 한다' }, ids: { reflect: 'petition-reflect', 'not-now': 'petition-not-now' }, need: '청원에 답을 골라야 출발할 수 있어요.' },
    elder: { id: 'elder', values: { keep: '유지한다', abolish: '폐지한다' }, ids: { keep: 'elder-keep', abolish: 'elder-abolish' }, need: '무임승차 유지·폐지를 골라야 출발할 수 있어요.' }
  };
  function field(s, kind) { return s[PB.Choices.KINDS[kind].field] || {}; }
  function options(App, s, kind, hooks, legend) {
    var L = LABELS[kind], cur = field(s, kind).choice, box = App.el('div', { 'class': 'fair-options', role: 'group', 'aria-label': legend });
    PB.Choices.KINDS[kind].values.forEach(function (v) {
      var b = App.el('button', { type: 'button', id: L.ids[v], 'class': 'btn fair-option', 'data-choice': v, 'aria-pressed': String(cur === v) }, L.values[v]);
      b.addEventListener('click', function () { PB.Choices.set(s, kind, 'choice', v); App.save(); hooks.rerender('#' + L.ids[v]); });
      box.appendChild(b);
    });
    return box;
  }
  function whyLine(App, s, kind, hooks) {
    var id = LABELS[kind].id, p = App.el('p', { 'class': 'fair-why' }), status = App.el('span', { id: id + '-saved', 'class': 'note note-saved', role: 'status' }),
      inp = App.el('input', { type: 'text', id: id + '-why', 'class': 'note-blank note-reason', maxlength: '200', autocomplete: 'off', 'aria-label': '그렇게 고른 까닭', placeholder: '짧게' });
    inp.value = field(s, kind).why || '';
    inp.addEventListener('input', function () {
      PB.Choices.set(s, kind, 'why', inp.value); App.save(); status.textContent = '저장했어요.';
      var n = document.getElementById('why-nudge'); if (n) n.remove();
    });
    p.appendChild(document.createTextNode('왜냐하면 ')); p.appendChild(inp); p.appendChild(document.createTextNode('.'));
    var wrap = document.createDocumentFragment(); wrap.appendChild(p);
    if (hooks.nudge === kind) wrap.appendChild(App.el('p', { id: 'why-nudge', 'class': 'note', role: 'status' }, '이유를 한 줄 적어 볼까요? 비워 두고 다시 누르면 그대로 출발해요.'));
    wrap.appendChild(status);
    return wrap;
  }
  function shell(App, id, title) {
    var c = App.el('section', { id: id, 'class': 'fair-card', 'aria-labelledby': id + '-h' });
    c.appendChild(App.el('h3', { id: id + '-h' }, title)); return c;
  }
  function petitionCard(App, s, hooks) {
    var fp = s.fixedPetition; hooks = hooks || {};
    if (!fp || s.phase !== PB.Choices.KINDS.petition.phase) return null;
    var zone = App.nodeName(fp.zone), c = shell(App, 'petition-card', zone + ' 주민 청원');
    c.appendChild(App.el('p', { id: 'petition-text', 'class': 'fair-fact' }, App.clock(fp.t) + ' ' + zone + ' 주민 청원: 그때까지 요청 ' + fp.total + '건 중 ' + fp.count + '건이 아직 도착하지 못했어요.'));
    c.appendChild(App.el('p', { 'class': 'fair-frame' }, zone + ' 주민의 청원을'));
    c.appendChild(options(App, s, 'petition', hooks, zone + ' 주민의 청원에 대한 답'));
    c.appendChild(whyLine(App, s, 'petition', hooks));
    return c;
  }
  function elderCard(App, s, hooks) {
    hooks = hooks || {};
    if (s.phase !== PB.Choices.KINDS.elder.phase) return null;
    var c = shell(App, 'elder-card', '어르신 무임승차를 유지할까요?'), h = s.history.filter(function (x) { return x.phase === 3; })[0];
    if (h && h.elder) c.appendChild(App.el('p', { id: 'elder-facts', 'class': 'fair-fact' }, '지난 3단계 무임 승객 ' + h.elder.free + '명 · 받지 않은 운임 ' + App.won(h.elder.unpaid)));
    c.appendChild(App.el('p', { 'class': 'note' }, '이 마을은 어르신 버스 요금이 무료예요(마을 정책).'));
    c.appendChild(options(App, s, 'elder', hooks, '어르신 무임승차 정책'));
    c.appendChild(whyLine(App, s, 'elder', hooks));
    return c;
  }
  /* 'AI가 본 자료' 한 줄(AI 제안 카드 안) */
  function seenLine(App, s) {
    var v = PB.Session.aiView(s), hid = v.hidden.map(function (z) { return App.nodeName(z) + ' 0건'; }).join(' · '),
      head = s.phase === 1 ? '예전 노선의 탑승 기록' : '지난 운행 탑승 기록 ' + v.records + '건';
    return App.el('p', { id: 'rec-seen', 'class': 'note' }, 'AI가 본 자료: ' + head + (hid ? ' · ' + hid : ''));
  }
  /* 출발 전에 골라야 할 것이 남았을 때 한 줄(없으면 null) */
  function required(App, s) {
    var req = PB.Choices.required(s); if (!req.length) return null;
    return App.el('p', { id: 'choice-required', 'class': 'note fair-required', role: 'status' }, LABELS[req[0]].need);
  }
  UI.fairness = { petitionCard: petitionCard, elderCard: elderCard, seenLine: seenLine, required: required, kindOf: function (s) { return s.phase === 3 && s.fixedPetition ? 'petition' : s.phase === 4 ? 'elder' : null; } };
})(typeof window !== 'undefined' ? window : globalThis);
