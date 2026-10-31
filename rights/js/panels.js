// 활동 패널 — 자료 카드, 결정(키워드 필수 + 글 선택), 데이터 해석, 생각 문항, 분류, 대안 선택, 장 카드, 권고안.
// 모두 Promise를 돌려준다. 가치 선택에는 판정 표시를 하지 않는다(correct 효과는 데이터 해석에만).
(function (root) {
  'use strict';
  var D = root.RightsData, UI = root.RightsUI, el = UI.el, button = UI.button;
  var NOTE_MAX = 100, REC_MAX = 200;
  var fx = function () {}; // (효과 ID) → 무대 효과·효과음. app.js가 연결한다.

  function policyLabel(id) { var p = D.POLICY.filter(function (x) { return x.id === id; })[0]; return p ? p.label : '—'; }

  function show(content, opts) {
    return new Promise(function (resolve) {
      var entry = UI.openPanel(content(function (v) { UI.closePanel(entry); resolve(v); }), opts);
    });
  }

  // ── 고르기 도구 ─────────────────────────────────────────
  function single(options, onChange, initial) {
    var cur = initial == null ? null : initial;
    var list = el('div', { class: 'r-choices', role: 'group' });
    var btns = options.map(function (o) {
      var b = el('button', { type: 'button', class: 'ee-choice', 'aria-pressed': String(o.id === cur) },
        el('span', { class: 'r-choice-mark', 'aria-hidden': 'true' }, o.id === cur ? '●' : '○'),
        el('span', { class: 'r-choice-body' }, el('strong', null, o.label), o.sub ? el('span', { class: 'r-choice-sub' }, o.sub) : null));
      b.addEventListener('click', function () {
        cur = o.id;
        btns.forEach(function (x, i) { var on = options[i].id === cur; x.setAttribute('aria-pressed', String(on)); x.firstChild.textContent = on ? '●' : '○'; });
        onChange(cur);
      });
      list.appendChild(b);
      return b;
    });
    return { node: list, get: function () { return cur; } };
  }
  function chips(labels, onChange, initial) {
    var picked = (initial || []).slice();
    var wrap = el('div', { class: 'r-chips', role: 'group' });
    labels.forEach(function (label) {
      var on = picked.indexOf(label) >= 0;
      var b = el('button', { type: 'button', class: 'r-chip', 'aria-pressed': String(on) }, el('span', { 'aria-hidden': 'true', class: 'r-chip-mark' }, on ? '✓' : '+'), label);
      b.addEventListener('click', function () {
        var i = picked.indexOf(label);
        if (i >= 0) picked.splice(i, 1); else picked.push(label);
        var now = i < 0;
        b.setAttribute('aria-pressed', String(now));
        b.firstChild.textContent = now ? '✓' : '+';
        onChange(picked.slice());
      });
      wrap.appendChild(b);
    });
    return { node: wrap, get: function () { return picked.slice(); } };
  }
  function noteField(label, max, initial) {
    var id = 'n' + Math.random().toString(36).slice(2, 8);
    var area = el('textarea', { id: id, class: 'r-note', maxlength: String(max), rows: '2', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': id + '-h' });
    area.value = initial || '';
    var count = el('span', { class: 'r-count', 'aria-hidden': 'true' }, area.value.length + ' / ' + max);
    area.addEventListener('input', function () { count.textContent = area.value.length + ' / ' + max; });
    return {
      node: el('div', { class: 'r-field' },
        el('label', { for: id }, label, el('span', { class: 'ee-badge r-optional' }, '선택')),
        area,
        el('p', { class: 'r-help', id: id + '-h' }, '이름·연락처 같은 개인정보는 쓰지 마세요. 이 기기에만 저장돼요. ', count)),
      get: function () { return area.value.trim().slice(0, max); }
    };
  }
  // 조건을 다 채울 때까지 버튼을 막고, 왜 막혔는지 글로 보여 준다(색만으로 구분하지 않음).
  function gate(label, check, onGo) {
    var why = el('p', { class: 'r-gate', 'aria-live': 'polite' });
    var go = button(label, { onClick: function () { if (!check()) onGo(); } });
    function refresh() { var msg = check(); go.disabled = !!msg; why.textContent = msg || ''; why.hidden = !msg; }
    refresh();
    return { node: el('div', { class: 'r-actions' }, why, go), refresh: refresh };
  }
  function head(eyebrow, title) {
    return [el('p', { class: 'r-eyebrow' }, eyebrow), el('h2', { class: 'r-title' }, title)];
  }

  // ── 자료 카드 ───────────────────────────────────────────
  function cardBody(id) {
    var c = D.CARDS[id], nodes = [];
    var who = el('div', { class: 'r-who' });
    if (c.kind === 'say') {
      who.appendChild(c.portrait ? UI.portrait(c.portrait, 'neutral', 72) : el('span', { class: 'r-faceless' }, UI.icon('person', 40)));
      who.appendChild(el('div', null, el('p', { class: 'ee-speaker' }, c.who), el('p', { class: 'r-mute' }, c.portrait ? '위원회 출석 진술' : '얼굴은 공개하지 않은 진술입니다')));
    } else {
      who.appendChild(el('span', { class: 'r-faceless' }, UI.icon(c.kind === 'data' ? 'clue' : c.kind === 'screen' ? 'warning' : 'notebook', 40)));
      who.appendChild(el('div', null, el('p', { class: 'ee-speaker' }, c.who), c.tag ? el('span', { class: 'ee-badge' }, c.tag) : null));
    }
    nodes.push(who, el('h2', { class: 'r-title' }, c.title));
    if (c.body) nodes.push(el('blockquote', { class: 'r-quote' }, c.body.map(function (t) { return el('p', null, t); })));
    if (c.stats) nodes.push(el('div', { class: 'r-tiles' }, c.stats.map(function (s) { return tile(s[1], s[0]); })));
    if (c.log) nodes.push(el('ol', { class: 'r-screen', 'aria-label': c.title }, c.log.map(function (t) { return el('li', null, t); })));
    if (c.chart) nodes.push(chart(c.chart));
    if (c.note) nodes.push(el('p', { class: 'ee-notice r-note-box' }, c.note));
    return nodes;
  }
  function tile(value, label, tone) {
    return el('div', { class: 'r-tile' + (tone ? ' ' + tone : '') }, el('strong', null, value), el('span', null, label));
  }
  // 1장 막대: 한 계열이라 한 색(공통 green), 값은 글자로 함께 적고 표가 곧 표 보기다.
  function chart(kind) {
    if (kind === 'groups') {
      var rows = [['A집단', 5, 0.5], ['B집단', 10, 1.0], ['C집단', 50, 5.0]];
      return el('div', { class: 'r-table-wrap' }, el('table', { class: 'r-table' },
        el('caption', null, '집단별 최초 출입 시도 실패 (정상 등록 이용자 1,000명당)'),
        el('thead', null, el('tr', null, el('th', { scope: 'col' }, '집단'), el('th', { scope: 'col' }, '실패 건수'), el('th', { scope: 'col' }, '실패율'), el('th', { scope: 'col', class: 'r-bar-col' }, '막대'))),
        el('tbody', null, rows.map(function (r) {
          var bar = el('span', { class: 'r-bar', title: r[0] + ' 실패율 ' + r[2].toFixed(1) + '% (' + r[1] + '건)' });
          bar.style.width = (r[2] / 5 * 100) + '%';
          return el('tr', null, el('th', { scope: 'row' }, r[0]), el('td', null, r[1] + '건'), el('td', null, r[2].toFixed(1) + '%'), el('td', { class: 'r-bar-col', 'aria-hidden': 'true' }, el('span', { class: 'r-bar-track' }, bar)));
        }))));
    }
    if (kind === 'funnel') {
      return el('div', { class: 'r-flow' },
        el('div', { class: 'r-tiles' }, tile('1,960명', '첫 시도 본인 확인 성공'), tile('40명', '첫 시도 본인 확인 실패', 'warn')),
        el('p', { class: 'r-flow-arrow' }, '첫 시도에 실패한 40명은'),
        el('div', { class: 'r-tiles' }, tile('30명', '추가 확인으로 면접 참여'), tile('10명', '시간 내 확인 실패로 면접 미참여', 'warn')));
    }
    if (kind === 'false') {
      return el('div', { class: 'r-tiles' }, tile('9,950명', '정상적으로 불일치 판정'), tile('50명', '잘못된 일치 표시(오탐)', 'warn'));
    }
    return null;
  }
  function card(id) {
    return show(function (done) {
      return [cardBody(id), el('div', { class: 'r-actions' }, button('확인했어요', { onClick: function () { done(); } }))];
    }, { label: D.CARDS[id].title });
  }
  function viewCard(id) { return card(id); }

  // ── 프롤로그 ────────────────────────────────────────────
  function principles() {
    return show(function (done) {
      return [head('윤리위원회 심의 원칙', '심의를 시작하기 전에'),
        el('ul', { class: 'r-list' }, D.PRINCIPLES.map(function (t) { return el('li', null, t); })),
        el('div', { class: 'r-actions' }, button('원칙을 확인했어요', { onClick: function () { done(); } }))];
    }, { label: '윤리위원회 심의 원칙' });
  }
  function value(prev) {
    return show(function (done) {
      var opts = D.VALUE.options.map(function (o) { return { id: o[0], label: o[1] }; }), pick;
      var g = gate('이 생각으로 기록하기', function () { return pick ? '' : '하나를 골라 주세요.'; }, function () { done(pick); });
      var s = single(opts, function (v) { pick = v; g.refresh(); });
      var before = prev ? el('p', { class: 'ee-notice' }, '처음 회의에서 고른 생각: ', el('strong', null, opts.filter(function (o) { return o.id === prev; })[0].label)) : null;
      return [head(prev ? '다시 생각해 보기' : '초기 가치 판단', D.VALUE.q), before,
        el('p', { class: 'r-mute' }, prev ? '세 가지 사건을 검토한 지금은 어떻게 생각하나요? 같아도, 달라져도 괜찮아요.' : '정답은 없어요. 지금 생각을 기록해 두고, 마지막에 다시 보여 드릴게요.'),
        s.node, g.node];
    }, { label: '가치 판단' });
  }

  // ── 결정 ────────────────────────────────────────────────
  function decide(ch, phase, prev) {
    var C = D.CHAPTERS[ch];
    var opts = D.POLICY.map(function (p) { return { id: p.id, label: p.label, sub: C.options[p.id] }; });
    if (phase === 'first') {
      return show(function (done) {
        var pick = null, keys = [];
        var g = gate('1차 결정 기록하기', function () { return !pick ? '도입 · 조건부 도입 · 미도입 중 하나를 골라 주세요.' : !keys.length ? '판단 근거 키워드를 하나 이상 골라 주세요.' : ''; },
          function () { done({ pick: pick, keys: keys, note: note.get() }); });
        var s = single(opts, function (v) { pick = v; g.refresh(); });
        var k = chips(C.keys, function (v) { keys = v; g.refresh(); });
        var note = noteField('근거를 한 줄로 더 적어 보기', NOTE_MAX);
        return [head(ch + '장 · 1차 결정', C.ask), s.node,
          el('h3', null, '판단 근거 (하나 이상)'), k.node, note.node, g.node];
      }, { label: ch + '장 1차 결정' });
    }
    return show(function (done) {
      var pick = null, follow = [], why = [];
      var body = el('div');
      var g = gate('최종 결정 기록하기', function () {
        if (!pick) return '최종 결정을 골라 주세요.';
        if (!follow.length) return pick === 'cond' ? '보호 조건을 하나 이상 골라 주세요.' : '필요한 후속 조치를 하나 이상 골라 주세요.';
        if (!why.length) return (pick === prev.pick ? '판단을 유지한' : '판단을 바꾼') + ' 이유를 하나 이상 골라 주세요.';
        return '';
      }, function () { done({ pick: pick, follow: follow, why: why, note: note.get(), changed: pick !== prev.pick }); });
      var note = noteField('내 판단을 한 줄로 더 적어 보기', NOTE_MAX);
      function rebuild() {
        follow = []; why = [];
        body.replaceChildren();
        if (!pick) { g.refresh(); return; }
        if (pick === 'cond') {
          body.appendChild(el('h3', null, '어떤 보호 조건이 필요할까요? (하나 이상)'));
          body.appendChild(guardPicker(C.guards, function (v) { follow = v; g.refresh(); }));
          body.appendChild(el('p', { class: 'ee-notice' }, '조건을 붙였다고 자동으로 정당해지지는 않아요. 고른 조건이 실제로 작동하려면 무엇이 더 필요할지 생각해 보세요.'));
        } else {
          body.appendChild(el('h3', null, pick === 'adopt' ? '도입한다면 함께 필요한 후속 조치 (하나 이상)' : '도입하지 않는다면 필요한 후속 조치 (하나 이상)'));
          body.appendChild(pick === 'adopt' ? guardPicker(C.guards, function (v) { follow = v; g.refresh(); })
            : chips(D.NO_FOLLOW, function (v) { follow = v; g.refresh(); }).node);
        }
        body.appendChild(el('h3', null, pick === prev.pick ? '새 정보를 검토하고도 같은 판단을 유지한 이유는? (하나 이상)' : '어떤 정보나 주장이 생각을 바꾸게 했나요? (하나 이상)'));
        body.appendChild(chips(D.WHY, function (v) { why = v; g.refresh(); }).node);
        g.refresh();
      }
      var s = single(opts, function (v) { pick = v; rebuild(); });
      return [head(ch + '장 · 최종 심의', C.ask),
        el('p', { class: 'ee-notice' }, '1차 결정: ', el('strong', null, policyLabel(prev.pick)), prev.keys.length ? ' — 근거: ' + prev.keys.join(', ') : ''),
        s.node, body, note.node, g.node];
    }, { label: ch + '장 최종 결정' });
  }
  // 보호 조건 고르기 — 2장은 기대 효과와 한계를 함께 보여 준다.
  function guardPicker(guards, onChange) {
    var picked = [];
    var wrap = el('div', { class: 'r-guards', role: 'group' });
    guards.forEach(function (gd) {
      var b = el('button', { type: 'button', class: 'ee-choice r-guard', 'aria-pressed': 'false' },
        el('span', { class: 'r-choice-mark', 'aria-hidden': 'true' }, '+'),
        el('span', { class: 'r-choice-body' }, el('strong', null, gd.label),
          gd.good ? el('span', { class: 'r-choice-sub' }, '기대 효과: ' + gd.good) : null,
          gd.limit ? el('span', { class: 'r-choice-sub' }, '한계: ' + gd.limit) : null));
      b.addEventListener('click', function () {
        var i = picked.indexOf(gd.label);
        if (i >= 0) picked.splice(i, 1); else picked.push(gd.label);
        b.setAttribute('aria-pressed', String(i < 0));
        b.firstChild.textContent = i < 0 ? '✓' : '+';
        onChange(picked.slice());
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  // ── 데이터 해석(사실 확인) ─────────────────────────────
  function quiz(id) {
    var Q = D.QUIZ[id];
    return show(function (done) {
      var first = null, tries = 0, finished = false;
      var feedback = el('div', { class: 'r-feedback', 'aria-live': 'polite' });
      var next = button('다음', { onClick: function () { done({ first: first, tries: tries }); } });
      next.hidden = true;
      var list = el('div', { class: 'r-choices', role: 'group' });
      Q.options.forEach(function (label, i) {
        var b = el('button', { type: 'button', class: 'ee-choice', 'aria-pressed': 'false' }, el('span', { class: 'r-choice-mark', 'aria-hidden': 'true' }, '○'), el('span', { class: 'r-choice-body' }, label));
        b.addEventListener('click', function () {
          if (finished) return;
          if (first === null) first = i;
          tries += 1;
          Array.prototype.forEach.call(list.children, function (x, j) { x.setAttribute('aria-pressed', String(j === i)); x.firstChild.textContent = j === i ? '●' : '○'; });
          if (i === Q.answer) {
            finished = true; fx('correct');
            feedback.replaceChildren(el('p', { class: 'ee-success' }, el('strong', null, '✓ 자료에서 확인했어요. '), Q.ok));
          } else if (tries >= 2) {
            finished = true; fx('retry');
            feedback.replaceChildren(el('p', { class: 'ee-notice' }, el('strong', null, '함께 확인해요. '), (Q.notes && Q.notes[i] ? Q.notes[i] + ' ' : '') + '→ ' + Q.options[Q.answer] + ' ' + Q.ok));
          } else {
            fx('retry');
            feedback.replaceChildren(el('p', { class: 'ee-notice' }, el('strong', null, '↺ 다시 살펴볼까요? '), (Q.notes && Q.notes[i]) || Q.hint));
          }
          if (finished) { Array.prototype.forEach.call(list.children, function (x) { x.disabled = true; }); next.hidden = false; next.focus(); }
        });
        list.appendChild(b);
      });
      var src = { q1: 'c1_table', q2: 'c2_stats', q3: 'c3_stats' }[id.slice(0, 2)];
      return [head('데이터 분석', Q.q), el('details', { class: 'r-peek' }, el('summary', null, '자료 다시 보기'), cardBody(src)),
        list, feedback, el('div', { class: 'r-actions' }, next)];
    }, { label: '데이터 분석' });
  }

  // ── 정답 없는 생각 문항 ─────────────────────────────────
  function reflect(id) {
    var R = D.REFLECT[id];
    return show(function (done) {
      var pick = null;
      var out = el('div', { 'aria-live': 'polite' });
      var next = button('다음', { onClick: function () { done(pick); } });
      next.hidden = true;
      var s = single(R.options.map(function (o, i) { return { id: i, label: o[0] }; }), function (v) {
        pick = v;
        out.replaceChildren(el('p', { class: 'r-say' }, R.options[v][1]), el('p', { class: 'ee-notice' }, R.core));
        next.hidden = false;
      });
      return [head('다시 생각해 보기', R.q), el('p', { class: 'r-mute' }, '정답을 가리는 질문이 아니에요. 지금 생각에 가까운 것을 골라 보세요.'), s.node, out, el('div', { class: 'r-actions' }, next)];
    }, { label: '다시 생각해 보기' });
  }
  function factors() {
    var F = D.FACTORS;
    return show(function (done) {
      var picked = [];
      var g = gate('다음', function () { return picked.length ? '' : '하나 이상 골라 주세요.'; }, function () { done({ picked: picked, note: note.get() }); });
      var c = chips(F.items, function (v) { picked = v; g.refresh(); });
      var note = noteField('내 생각을 한 줄로 적어 보기', NOTE_MAX);
      return [head('핵심 딜레마', F.q), el('p', { class: 'r-mute' }, F.lead), c.node, note.node, g.node];
    }, { label: '핵심 딜레마' });
  }
  function sort() {
    var S = D.SORT;
    return show(function (done) {
      var pick = {}, checks = 0;
      var out = el('div', { 'aria-live': 'polite' });
      var rows = S.items.map(function (it, i) {
        var res = el('span', { class: 'r-sort-res' });
        var btns = S.bins.map(function (b) {
          var x = el('button', { type: 'button', class: 'r-chip', 'aria-pressed': 'false' }, b[1]);
          x.addEventListener('click', function () {
            pick[i] = b[0];
            btns.forEach(function (y, j) { y.setAttribute('aria-pressed', String(S.bins[j][0] === b[0])); });
            res.textContent = '';
            g.refresh();
          });
          return x;
        });
        return { node: el('li', { class: 'r-sort-row' }, el('span', { class: 'r-sort-q' }, it[0]), el('span', { class: 'r-sort-btns', role: 'group', 'aria-label': it[0] }, btns), res), res: res };
      });
      var g = gate('나눈 결과 확인하기', function () { return Object.keys(pick).length < S.items.length ? '모든 질문을 나누어 주세요.' : ''; }, function () {
        checks += 1;
        var miss = 0;
        S.items.forEach(function (it, i) {
          var ok = pick[i] === it[1];
          if (!ok) miss++;
          rows[i].res.textContent = ok ? '✓' : '↺ 다시 볼까요';
        });
        if (!miss || checks >= 2) {
          fx(miss ? 'retry' : 'correct');
          out.replaceChildren(el('p', { class: miss ? 'ee-notice' : 'ee-success' }, miss ? '함께 확인해요. 정확도를 묻는 질문은 기술적 판단, 이유·권한·범위를 묻는 질문은 윤리적 판단이에요.' : '✓ 두 판단을 구분했어요. 정확도가 높아도 윤리적 판단의 질문은 그대로 남아요.'));
          g.node.replaceChildren(button('다음', { onClick: function () { done({ checks: checks }); } }));
          g.node.lastChild.focus();
        } else { fx('retry'); out.replaceChildren(el('p', { class: 'ee-notice' }, '↺ 표시한 질문을 다시 살펴볼까요? 그 질문이 ‘얼마나 정확한가’를 묻는지, ‘그래도 되는가’를 묻는지 생각해 보세요.')); }
      });
      return [head('판단 나누기', S.q),
        el('div', { class: 'r-bins' }, S.bins.map(function (b) { return el('p', { class: 'ee-badge' }, el('strong', null, b[1] + ' '), b[2]); })),
        el('ol', { class: 'r-sort' }, rows.map(function (r) { return r.node; })), out, g.node];
    }, { label: '판단 나누기' });
  }
  function scope() {
    var S = D.SCOPE;
    return show(function (done) {
      var pick = null;
      var extra = el('div', { 'aria-live': 'polite' });
      var g = gate('이 대안으로 기록하기', function () { return pick ? '' : '대안 하나를 골라 주세요.'; }, function () { done({ pick: pick, note: note.get() }); });
      var s = single(S.options.map(function (o) { return { id: o.id, label: '대안 ' + o.id + '. ' + o.label, sub: o.body }; }), function (v) {
        pick = v;
        extra.replaceChildren(v === 'B' ? el('p', { class: 'ee-notice' }, S.noteB) : el('p', { class: 'r-mute' }, '어떤 대안이든, 그 선택이 무엇을 얻고 무엇을 포기하는지 함께 말할 수 있어야 해요.'));
        g.refresh();
      });
      var note = noteField('이 대안을 고른 이유', NOTE_MAX);
      return [head('활용 범위 선택', S.q), s.node, extra, note.node, g.node];
    }, { label: '활용 범위 선택' });
  }

  // ── 장 카드 ─────────────────────────────────────────────
  function chapterStart(ch) {
    var C = D.CHAPTERS[ch];
    return show(function (done) {
      return [el('div', { class: 'r-chapter' }, el('p', { class: 'r-eyebrow' }, 'CHAPTER ' + ch + ' · ' + C.title), el('h2', { class: 'r-title' }, C.q), el('p', null, el('span', { class: 'ee-badge' }, '핵심 가치'), ' ' + C.values)),
        el('div', { class: 'r-actions' }, button('심의 시작하기', { onClick: function () { done(); } }))];
    }, { label: ch + '장 ' + C.title });
  }
  function chapterEnd(ch, rec) {
    var C = D.CHAPTERS[ch];
    return show(function (done) {
      return [el('div', { class: 'r-chapter' }, el('p', { class: 'r-eyebrow' }, 'CHAPTER ' + ch + ' · ' + C.title + ' 심의 완료'),
          el('h2', { class: 'r-title' }, C.end),
          el('div', { class: 'r-compare' }, tile(policyLabel(rec.first.pick), '1차 결정'), tile(policyLabel(rec.final.pick), rec.final.changed ? '최종 결정 (변경)' : '최종 결정 (유지)')),
          el('p', { class: 'ee-success r-principle' }, UI.icon('key', 32), el('span', null, '얻은 학습 원칙: ', el('strong', null, C.principle)))),
        el('div', { class: 'r-actions' }, button(ch < 3 ? '다음 안건으로' : '최종 권고안으로', { onClick: function () { done(); } }))];
    }, { label: ch + '장 완료' });
  }

  // ── 에필로그 ────────────────────────────────────────────
  function review(S) {
    return show(function (done) {
      var rows = [1, 2, 3].map(function (ch) {
        var r = S.ch[ch];
        return el('tr', null, el('th', { scope: 'row' }, D.CHAPTERS[ch].title), el('td', null, policyLabel(r.first.pick)), el('td', null, policyLabel(r.final.pick)),
          el('td', null, el('strong', null, r.final.changed ? '변경' : '유지'), el('br'), el('span', { class: 'r-mute' }, r.final.why.join(', ')), r.final.note ? el('span', { class: 'r-quote-line' }, '“' + r.final.note + '”') : null));
      });
      return [head('나의 정책 결정 돌아보기', '세 안건의 1차 결정과 최종 결정'),
        el('div', { class: 'r-table-wrap' }, el('table', { class: 'r-table' }, el('thead', null, el('tr', null, ['심의 안건', '1차 결정', '최종 결정', '유지·변경과 그 이유'].map(function (t) { return el('th', { scope: 'col' }, t); }))), el('tbody', null, rows))),
        el('p', { class: 'r-mute' }, '판단을 바꾼 것도, 유지한 것도 모두 의미가 있어요. 중요한 건 그 이유예요.'),
        el('div', { class: 'r-actions' }, button('다음', { onClick: function () { done(); } }))];
    }, { label: '결정 돌아보기', wide: true });
  }
  function guide() {
    return show(function (done) {
      return [head('인권 보장 가이드라인', '권고안을 쓰기 전에 다섯 가지를 점검해요'),
        el('ol', { class: 'r-guide' }, D.GUIDE.map(function (g) { return el('li', null, el('strong', null, g[0]), el('span', null, g[1])); })),
        el('div', { class: 'r-actions' }, button('권고안 쓰기', { onClick: function () { done(); } }))];
    }, { label: '인권 보장 가이드라인' });
  }
  function recommend(prev) {
    return show(function (done) {
      var data = {}, notes = {};
      var g = gate('권고안 완성하기', function () {
        var miss = D.REC.filter(function (r) { return !(data[r.id] && data[r.id].length); });
        return miss.length ? miss.length + '개 문항에 키워드를 하나 이상 골라 주세요.' : '';
      }, function () {
        var out = {};
        D.REC.forEach(function (r) { out[r.id] = { keys: data[r.id], note: notes[r.id].get() }; });
        done(out);
      });
      var blocks = D.REC.map(function (r, i) {
        var init = prev && prev[r.id];
        data[r.id] = init ? init.keys.slice() : [];
        notes[r.id] = noteField('덧붙일 말', REC_MAX, init && init.note);
        return el('fieldset', { class: 'r-rec' }, el('legend', null, (i + 1) + '. ' + r.q),
          chips(r.keys, function (v) { data[r.id] = v; g.refresh(); }, data[r.id]).node, notes[r.id].node);
      });
      g.refresh();
      return [head('윤리시티 AI 인권 보장 정책 권고안', '네 문항에 답해 권고안을 완성해요'), blocks, g.node];
    }, { label: '정책 권고안 작성', wide: true });
  }
  function recText(rec) {
    var lines = ['윤리시티 AI 인권 보장 정책 권고안', ''];
    D.REC.forEach(function (r, i) {
      var a = rec[r.id];
      lines.push((i + 1) + '. ' + r.q);
      lines.push('   ' + a.keys.join(', ') + (a.note ? ' — ' + a.note : ''));
    });
    lines.push('', '※ 수업용 가상 심의에서 작성한 권고안입니다.');
    return lines.join('\n');
  }

  // ── 지도 · 심의 기록 ────────────────────────────────────
  var PLACES = ['classroom', 'library', 'ai_lab', 'courtyard'];
  function map(current, targetRoom) {
    return show(function (done) {
      var items = PLACES.map(function (id) {
        var R = D.ROOMS[id], here = id === current, go = id === targetRoom;
        var b = el('button', { type: 'button', class: 'ee-choice r-place', 'aria-current': here ? 'location' : null, disabled: !go || null },
          UI.icon(go ? 'map' : here ? 'person' : 'lock', 32),
          el('span', { class: 'r-choice-body' }, el('strong', null, R.name), el('span', { class: 'r-choice-sub' }, here ? '지금 있는 곳' : go ? '지금 할 일이 있는 곳 · 눌러서 이동' : '이번 단계와 관계없는 곳')));
        if (go) b.addEventListener('click', function () { done(id); });
        return b;
      });
      return [head('윤리시티 지도', targetRoom && targetRoom !== current ? '이동할 곳을 골라 주세요' : '지금은 이곳에서 할 일이 있어요'),
        el('div', { class: 'r-choices' }, items),
        el('div', { class: 'r-actions' }, button('닫기', { secondary: true, icon: 'close', onClick: function () { done(null); } }))];
    }, { label: '윤리시티 지도', onEscape: null });
  }
  function notebook(found, names) {
    return show(function (done) {
      var list = found.length ? el('ul', { class: 'r-book' }, found.map(function (id) {
        var c = D.CARDS[id];
        return el('li', null, el('button', { type: 'button', class: 'ee-choice', on: { click: function () { done({ open: id }); } } }, el('span', { class: 'r-choice-body' }, el('strong', null, c.title), el('span', { class: 'r-choice-sub' }, c.who))));
      })) : el('p', { class: 'r-mute' }, '아직 모은 자료가 없어요.');
      return [head('심의 기록', '지금까지 살펴본 자료와 진술'), list, el('div', { class: 'r-actions' }, button('닫기', { secondary: true, icon: 'close', onClick: function () { done(null); } }))];
    }, { label: '심의 기록' });
  }

  root.RightsPanels = {
    setFx: function (f) { fx = f; }, policyLabel: policyLabel, cardBody: cardBody, recText: recText,
    card: card, viewCard: viewCard, principles: principles, value: value, decide: decide, quiz: quiz, reflect: reflect,
    factors: factors, sort: sort, scope: scope, chapterStart: chapterStart, chapterEnd: chapterEnd,
    review: review, guide: guide, recommend: recommend, map: map, notebook: notebook,
    el: el, tile: tile
  };
})(window);
