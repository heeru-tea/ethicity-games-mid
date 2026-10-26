/*
 * 화면 그리기·입력 처리.
 * 구조가 바뀌는 조작(선택·확정·단계 이동)은 render()로 다시 그리고, 글쓰기 칸은 상태만 고친 뒤 updateNav()로 버튼만 갱신한다
 * (다시 그리면 입력 중 초점이 사라지므로).
 * 학생이 쓴 글·별명은 esc()를 거쳐서만 화면에 넣는다.
 */
(function () {
  'use strict';
  var C = HR.Config, S = HR.Stories, E = HR.Engine, St = HR.Storage;

  var state = E.restore(St.readProgress(), S, C.VERSION) || E.newState(S, C.VERSION);
  var resumed = state.phase !== 'intro';
  var settings = St.readSettings();
  var player = St.readPlayer();
  var nickname = player ? player.nickname : '';
  var storageOk = St.available();
  var assets = null;

  var params = new URLSearchParams(location.search);
  var urlRebuttal = S.REBUTTALS[params.get('rebuttal')] ? params.get('rebuttal') : null;

  var $app = document.getElementById('app');
  var $nav = document.getElementById('nav');
  var $progress = document.getElementById('progress');
  var $where = document.getElementById('where');

  // ── 공통 도우미
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nameText() { return nickname || '위원'; }
  function fill(text) { return text.replace('{name}', nameText()); }
  function save() { St.writeProgress(state); }
  function sound(id) { if (assets) assets.playSound(id); }
  function currentAgenda() { return S.AGENDAS[state.agenda]; }
  function ans() { return state.answers[currentAgenda().id]; }
  function protName(id) { for (var i = 0; i < S.PROTECTIONS.length; i++) if (S.PROTECTIONS[i].id === id) return S.PROTECTIONS[i].name; return id; }
  function choiceText(c) { return c ? c + '. ' + S.CHOICES[c].label : '—'; }

  function textarea(key, value, label, hint, rows) {
    var id = 'f-' + key.replace(/[^a-z0-9]/gi, '-');
    return '<label class="field" for="' + id + '"><span class="field-label">' + esc(label) + '</span>' +
      (hint ? '<span class="field-hint">' + esc(hint) + '</span>' : '') +
      '<textarea id="' + id + '" data-bind="' + esc(key) + '" rows="' + (rows || 3) + '">' + esc(value) + '</textarea></label>';
  }

  // data-bind 경로("answers.library.final.text")로 상태 읽기·쓰기
  function setPath(path, value) {
    var parts = path.split('.'), o = state;
    for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = value;
  }

  // ── 그림(공통 팩). 못 불러오면 그림 없이 진행
  function sceneCanvas(bg, cast) {
    return '<div class="scene"><canvas class="scene-canvas ee-pixel" width="1280" height="720" data-bg="' + esc(bg) + '" data-cast="' + esc(cast.join(',')) + '" aria-hidden="true"></canvas></div>';
  }
  function portrait(role, face) {
    var id = C.CAST[role];
    return '<canvas class="portrait ee-pixel" width="128" height="128" data-char="' + esc(id || '') + '" data-face="' + esc(face || 'neutral') + '" aria-hidden="true"></canvas>';
  }
  function paintCanvases() {
    if (!assets) return;
    Array.prototype.forEach.call($app.querySelectorAll('canvas.scene-canvas'), function (cv) {
      var ctx = cv.getContext('2d');
      try {
        assets.drawBackground(ctx, cv.dataset.bg, 1280, 720);
        var ids = cv.dataset.cast ? cv.dataset.cast.split(',').filter(Boolean) : [];
        var gap = 1280 / (ids.length + 1);
        ids.forEach(function (id, i) {
          var scale = id === 'robot' ? 1.3 : (id === 'teacher' || id === 'librarian') ? 1.6 : 1.5;
          assets.drawCharacter(ctx, id, Math.round(gap * (i + 1)), 640, 'down', 1, scale);
        });
        cv.parentNode.classList.add('painted');
      } catch (e) { /* 그림 없이 진행 */ }
    });
    Array.prototype.forEach.call($app.querySelectorAll('canvas.portrait'), function (cv) {
      if (!cv.dataset.char) return;
      try { assets.drawPortrait(cv.getContext('2d'), cv.dataset.char, cv.dataset.face, 0, 0, 128); cv.classList.add('painted'); } catch (e) { /* 이니셜 없이 빈 칸 */ }
    });
  }

  function guideSpeech(lines) {
    return '<div class="talk">' + portrait('guide', 'explaining') +
      '<div class="ee-speech"><p class="ee-speaker">심의 도우미</p>' +
      lines.map(function (l) { return '<p>' + esc(fill(l.text)) + '</p>'; }).join('') + '</div></div>';
  }

  function bars(list, unit) {
    var max = Math.max.apply(null, list.map(function (b) { return b.value; }));
    return '<div class="bars" role="img" aria-label="' + esc(unit + ': ' + list.map(function (b) { return b.label + ' ' + b.text; }).join(', ')) + '">' +
      list.map(function (b) {
        return '<div class="bar-row"><span class="bar-label">' + esc(b.label) + '</span><span class="bar-track"><span class="bar-fill" style="width:' + Math.max(2, b.value / max * 100) + '%"></span></span><span class="bar-value">' + esc(b.text) + '</span></div>';
      }).join('') + '</div>';
  }

  function facts(list) {
    return '<div class="facts">' + list.map(function (f) { return '<div class="fact"><strong>' + esc(f.big) + '</strong><span>' + esc(f.text) + '</span></div>'; }).join('') + '</div>';
  }

  function choiceButtons(name, selected, disabled) {
    return '<div class="choices" role="group">' + Object.keys(S.CHOICES).map(function (k) {
      return '<button type="button" class="ee-choice" data-action="' + name + '" data-value="' + k + '" aria-pressed="' + (selected === k) + '"' + (disabled ? ' disabled' : '') + '><b>' + k + '.</b> ' + esc(S.CHOICES[k].label) + '</button>';
    }).join('') + '</div>';
  }

  function protChecks(name, selected, ag) {
    return '<div class="prot-grid">' + S.PROTECTIONS.map(function (p) {
      var on = selected.indexOf(p.id) >= 0, rel = ag.related.indexOf(p.id) >= 0;
      return '<button type="button" class="prot" data-action="' + name + '" data-value="' + p.id + '" aria-pressed="' + on + '">' +
        '<span class="prot-mark" aria-hidden="true">' + (on ? '✔' : '') + '</span><span class="prot-body"><b>' + esc(p.name) + '</b>' +
        (rel ? ' <span class="ee-badge">이 안건 관련</span>' : '') + '<small>' + esc(p.desc) + '</small></span></button>';
    }).join('') + '</div>';
  }

  // ── 단계별 화면
  var screens = {};

  screens.intro = function () {
    return sceneCanvas(C.SCENES.intro, ['robot']) + guideSpeech(S.INTRO) +
      '<section class="card"><h2>오늘의 안건</h2><ol class="agenda-list">' + S.AGENDAS.map(function (ag) {
        return '<li><span class="ee-badge">' + esc(ag.no) + '</span> <b>' + esc(ag.area) + '</b> — ' + esc(ag.title) + ' <small>(약 ' + ag.minutes + '분' + (ag.deep ? ', 심화' : '') + ')</small></li>';
      }).join('') + '</ol><p class="muted">선택지는 세 안건 모두 같아요: A. 도입한다 / B. 인권 보호 조건을 마련한 후 도입한다 / C. 도입하지 않는다.</p></section>';
  };

  screens.brief = function (ag) {
    return sceneCanvas(C.SCENES[ag.id], ['robot']) + guideSpeech(ag.guideLines) +
      '<section class="card doc"><p class="doc-no">' + esc(ag.no) + ' · ' + esc(ag.area) + (ag.deep ? ' · 심화 안건' : '') + '</p><h2>' + esc(ag.title) + '</h2>' +
      '<p class="values">' + ag.values.map(function (v) { return '<span class="ee-badge">' + esc(v) + '</span>'; }).join('<span class="vs">vs</span>') + '</p>' +
      '<h3>상황</h3><p>' + esc(ag.situation) + '</p><h3>기대 편익</h3><ul>' + ag.benefits.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></section>';
  };

  screens.data = function (ag) {
    var a = ans(), d = ag.data, h = '<section class="card"><h2>' + esc(d.headline) + '</h2>';
    if (d.kind === 'checklist') {
      var shown = a.data.picks.length > 0;
      h += '<p>' + esc(d.prompt) + '</p><div class="checks">' + d.options.map(function (o) {
        var on = a.data.picks.indexOf(o.id) >= 0;
        return '<button type="button" class="ee-choice" data-action="pick" data-value="' + o.id + '" aria-pressed="' + on + '">' + (on ? '☑ ' : '☐ ') + esc(o.text) + '</button>';
      }).join('') + '</div>';
      if (shown) h += '<div class="ee-notice reveal"><p><b>' + esc(d.reveal) + '</b></p><ul>' + d.options.map(function (o) { return '<li><b>' + esc(o.text) + '</b>: ' + esc(o.note) + '</li>'; }).join('') + '</ul></div>';
      return h + '</section>';
    }
    if (d.table) h += '<table class="data-table"><thead><tr>' + d.table.head.map(function (x) { return '<th scope="col">' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      d.table.rows.map(function (r) { return '<tr>' + r.map(function (x, i) { return i ? '<td>' + esc(x) + '</td>' : '<th scope="row">' + esc(x) + '</th>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    if (d.bars) h += bars(d.bars, '인증 실패율');
    if (d.facts) h += facts(d.facts);
    h += d.questions.map(function (q, i) {
      var rec = a.data.q[q.id] || {};
      var head = '<div class="question"><p class="q-text"><b>질문 ' + (i + 1) + '.</b> ' + esc(q.text) + '</p>';
      if (q.type === 'text') return head + textarea('answers.' + ag.id + '.data.q.' + q.id + '.value', rec.value || '', '내 생각', '', 3) + '</div>';
      var body = '';
      if (q.type === 'choice') body = '<div class="choices row">' + q.options.map(function (o, k) {
        return '<button type="button" class="ee-choice" data-action="quiz" data-q="' + q.id + '" data-value="' + k + '" aria-pressed="' + (String(rec.value) === String(k)) + '"' + (rec.done ? ' disabled' : '') + '>' + esc(o) + '</button>';
      }).join('') + '</div>';
      else body = '<form class="num" data-q="' + q.id + '"><input type="text" inputmode="decimal" aria-label="답" value="' + esc(rec.value == null ? '' : rec.value) + '"' + (rec.done ? ' disabled' : '') + '> <span>' + esc(q.unit) + '</span> <button class="ee-button" type="submit"' + (rec.done ? ' disabled' : '') + '>확인</button></form>';
      var fb = '';
      if (rec.done) fb = '<p class="' + (rec.correct ? 'ee-success' : 'ee-notice') + ' fb">' + (rec.correct ? '✔ 맞아요. ' : '정답을 함께 확인해요. ') + esc(q.explain) + '</p>';
      else if (rec.tries) fb = '<p class="ee-notice fb">다시 생각해 볼까요? ' + esc(q.hint || '') + '</p>';
      return head + body + '<div aria-live="polite">' + fb + '</div></div>';
    }).join('');
    if (d.glossary) h += '<div class="glossary">' + d.glossary.map(function (g) { return '<div class="term"><h3>' + esc(g.term) + '</h3><p>' + esc(g.text) + '</p></div>'; }).join('') + '</div><p class="muted">' + esc(d.glossaryNote) + '</p>';
    return h + '</section>';
  };

  screens.initial = function (ag) {
    var a = ans(), locked = !!a.initial, pending = state._pendingInitial || null;
    var h = '<section class="card"><p class="doc-no">' + esc(ag.no) + ' · 최초 판단</p><h2>' + esc(ag.initialQuestion) + '</h2>';
    if (locked) {
      return h + '<p class="ee-success">🔒 최초 판단: <b>' + esc(choiceText(a.initial)) + '</b><br>확정한 판단은 바꿀 수 없어요. 최종 판단에서 다시 생각할 수 있어요.</p></section>';
    }
    return h + '<p class="muted">지금까지 본 자료만으로 판단해 주세요. 확정하면 바꿀 수 없어요.</p>' + choiceButtons('initial', pending) +
      '<p class="actions"><button type="button" class="ee-button" data-action="lock"' + (pending ? '' : ' disabled') + '>판단 확정하기</button></p></section>';
  };

  screens.extra = function (ag) {
    var x = ag.extra, h = '<section class="card"><h2>' + esc(x.title) + '</h2>';
    if (x.bars) h += bars(x.bars, x.unit);
    if (x.facts) h += facts(x.facts);
    if (x.thought) h += '<blockquote class="thought">' + esc(x.thought) + '</blockquote>';
    if (x.headline) h += '<p class="headline">' + esc(x.headline) + '</p>';
    h += '<ul class="notes">' + x.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
    return h + '<p class="muted">최초 판단: ' + esc(choiceText(ans().initial)) + '</p></section>';
  };

  screens.interview = function (ag) {
    var a = ans(), cast = [];
    ag.interviews.forEach(function (iv) { if (!iv.optional || a.interview.opened) cast.push(C.CAST[iv.role]); });
    var h = sceneCanvas(C.SCENES[ag.id], cast.filter(Boolean)) + '<section class="card"><h2>시민 인터뷰</h2>';
    h += ag.interviews.map(function (iv) {
      if (iv.optional && !a.interview.opened) {
        return '<div class="talk locked-card"><button type="button" class="ee-button secondary" data-action="open-optional">선택 카드 펼치기: ' + esc(iv.who) + ' 의견</button></div>';
      }
      return '<div class="talk">' + portrait(iv.role, iv.face) + '<div class="ee-speech"><p class="ee-speaker">' + esc(iv.who) + (iv.optional ? ' <span class="ee-badge">선택 카드</span>' : '') + '</p><p>“' + esc(iv.line) + '”</p></div></div>';
    }).join('');
    if (ag.interviewTask) {
      var opts = ag.interviews.filter(function (iv) { return !iv.optional || a.interview.opened; });
      h += '<div class="task"><h3>' + esc(ag.interviewTask.prompt) + '</h3><div class="choices row">' + opts.map(function (iv) {
        var k = ag.interviews.indexOf(iv);
        return '<button type="button" class="ee-choice" data-action="iv-pick" data-value="' + k + '" aria-pressed="' + (a.interview.pick === k) + '">' + esc(iv.who) + '</button>';
      }).join('') + '</div>' + textarea('answers.' + ag.id + '.interview.reason', a.interview.reason, '고른 이유', '', 3) + '</div>';
    }
    return h + '</section>';
  };

  function simResult(ag, res) {
    var h = '<div class="aspects">' + S.ASPECTS.map(function (x) {
      var r = res.aspects[x.id], lv = r.level;
      return '<article class="aspect"><h3>' + esc(x.name) + '</h3><p class="meter" aria-label="' + esc(x.name + ' 예상: ' + lv.text) + '">' +
        [1, 2, 3].map(function (n) { return '<span class="cell' + (n <= lv.meter ? ' on' : '') + '"></span>'; }).join('') + '<b>' + esc(lv.text) + '</b></p>' +
        '<h4>기대되는 효과</h4>' + (r.effects.length ? '<ul>' + r.effects.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '<p class="muted">없음</p>') +
        '<h4>남아 있는 위험</h4>' + (r.risks.length ? '<ul class="risk">' + r.risks.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '<p class="muted">없음</p>') + '</article>';
    }).join('') + '</div>';
    function list(title, items, cls) { return '<div class="sim-block ' + (cls || '') + '"><h3>' + esc(title) + '</h3>' + (items.length ? '<ul>' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '<p class="muted">없음</p>') + '</div>'; }
    h += '<div class="sim-blocks">' + list('보호되는 권리', res.rightsProtected, 'good') + list('제한될 위험이 있는 권리', res.rightsAtRisk, 'warn') +
      list('해결되지 않은 문제', res.unresolved) + list('영향을 받는 시민', res.affected) + '</div>';
    return h;
  }

  screens.sim = function (ag) {
    var a = ans(), s = a.sim;
    var h = '<section class="card"><h2>정책 결과 시뮬레이터</h2><p class="muted">정책을 바꿔 가며 결과를 비교해 보세요. 점수나 정답 판정은 하지 않아요. 최초 판단: ' + esc(choiceText(a.initial)) + '</p>' +
      choiceButtons('sim-choice', s.choice);
    if (s.choice === 'B') h += '<h3>보호 조치 고르기 (7가지 중 원하는 만큼)</h3>' + protChecks('sim-prot', s.prot, ag);
    var needProt = s.choice === 'B' && s.prot.length === 0;
    h += '<p class="actions"><button type="button" class="ee-button" data-action="run"' + (needProt ? ' disabled' : '') + '>결과 보기</button>' +
      (needProt ? ' <span class="muted">B안은 보호 조치를 하나 이상 골라야 해요.</span>' : '') + '</p>';
    if (s.ran && !needProt) h += '<div class="sim-out" aria-live="polite"><h3 class="sim-title">' + esc(choiceText(s.choice)) + (s.choice === 'B' ? ' — ' + esc(s.prot.map(protName).join(', ')) : '') + '</h3>' + simResult(ag, E.simulate(ag, s.choice, s.prot, S)) + '</div>';
    return h + '</section>';
  };

  screens.final = function (ag) {
    var a = ans(), f = a.final;
    var h = '<section class="card"><p class="doc-no">' + esc(ag.no) + ' · 최종 판단</p><h2>최종 판단</h2>' +
      '<p class="ee-badge">🔒 최초 판단: ' + esc(choiceText(a.initial)) + '</p>' + choiceButtons('final-choice', f.choice);
    if (f.choice) h += '<p class="muted">' + (f.choice === a.initial ? '최초 판단을 유지했어요.' : '최초 판단에서 바꾸었어요.') + '</p>';
    if (f.choice === 'B') h += '<h3>마련할 보호 조치</h3>' + protChecks('final-prot', f.prot, ag);
    if (ag.finalFactor) h += '<h3>판단에 가장 큰 영향을 준 것</h3><div class="choices row">' + ag.finalFactor.map(function (x) {
      return '<button type="button" class="ee-choice" data-action="factor" data-value="' + esc(x) + '" aria-pressed="' + (f.factor === x) + '">' + esc(x) + '</button>';
    }).join('') + '</div>';
    h += textarea('answers.' + ag.id + '.final.text', f.text, ag.finalQuestion, '', 4);
    return h + '</section>';
  };

  function finalsSummary() {
    return '<table class="data-table"><thead><tr><th scope="col">안건</th><th scope="col">최초</th><th scope="col">최종</th><th scope="col">보호 조치</th></tr></thead><tbody>' +
      S.AGENDAS.map(function (ag) {
        var a = state.answers[ag.id];
        return '<tr><th scope="row">' + esc(ag.area) + '</th><td>' + esc(a.initial || '—') + '</td><td>' + esc(a.final.choice || '—') + '</td><td>' + esc(a.final.choice === 'B' ? a.final.prot.map(protName).join(', ') : '—') + '</td></tr>';
      }).join('') + '</tbody></table><p class="muted">A 도입 · B 조건부 도입 · C 도입하지 않음</p>';
  }

  function guidelineFields() {
    return S.GUIDELINE_FIELDS.map(function (f) { return textarea('guideline.' + f.id, state.guideline[f.id], f.label, f.hint, f.id === 'principle' ? 2 : 3); }).join('');
  }

  screens.guideline = function () {
    var qs = E.consistencyQuestions(state, S);
    return '<section class="card"><h2>정책 가이드라인 작성</h2><p>세 안건의 판단을 바탕으로 윤리시티의 AI 안면인식 가이드라인을 써 주세요.</p>' + finalsSummary() + guidelineFields() + '</section>' +
      '<section class="card"><h2>일관성 점검</h2><p class="muted">세 판단을 나란히 놓고 생긴 질문이에요. 판단이 달라도 괜찮아요. 이유를 설명해 주세요.</p>' +
      qs.map(function (q) { return textarea('consistency.' + q.id, state.consistency[q.id] || '', q.text, '', 3); }).join('') + '</section>';
  };

  screens.rebuttal = function () {
    var rb = S.REBUTTALS[state.rebuttal.id];
    var h = '<section class="card"><h2>반론 검토</h2><blockquote class="thought">' + esc(rb.text) + '</blockquote>' +
      textarea('rebuttal.text', state.rebuttal.text, '이 반론에 대한 나의 답변', '', 4) +
      '<h3>내 정책 가이드라인을</h3><div class="choices row">' +
      '<button type="button" class="ee-choice" data-action="decision" data-value="keep" aria-pressed="' + (state.rebuttal.decision === 'keep') + '">유지한다</button>' +
      '<button type="button" class="ee-choice" data-action="decision" data-value="revise" aria-pressed="' + (state.rebuttal.decision === 'revise') + '">수정한다</button></div></section>';
    if (state.rebuttal.decision === 'revise') h += '<section class="card"><h2>가이드라인 수정</h2>' + guidelineFields() + '</section>';
    return h;
  };

  screens.reflection = function () {
    return '<section class="card"><h2>개인 성찰</h2>' + S.REFLECTION_FIELDS.map(function (f) {
      var extra = f.id === 'right' ? '<div class="chips">' + S.RIGHTS.map(function (r) { return '<button type="button" class="ee-badge chip" data-action="add-right" data-value="' + esc(r) + '">+ ' + esc(r) + '</button>'; }).join('') + '</div>' : '';
      return textarea('reflection.' + f.id, state.reflection[f.id], f.label, '', 3) + extra;
    }).join('') + '</section>';
  };

  screens.report = function () {
    var date = state.completedAt ? new Date(state.completedAt).toLocaleDateString('ko-KR') : '';
    var rb = S.REBUTTALS[state.rebuttal.id || C.REBUTTAL_DEFAULT];
    function para(label, text) { return '<h4>' + esc(label) + '</h4><p class="answer">' + esc(text || '—') + '</p>'; }
    var h = '<section class="card report"><p class="doc-no">윤리시티 안전위원회 심의 보고서 · ' + esc(date) + '</p><h2>' + esc(nameText()) + ' 위원의 심의 결과</h2>' + finalsSummary();
    S.AGENDAS.forEach(function (ag) {
      var a = state.answers[ag.id];
      h += '<h3>' + esc(ag.no + ' ' + ag.area) + '</h3><p>최초 ' + esc(choiceText(a.initial)) + ' → 최종 ' + esc(choiceText(a.final.choice)) + '</p>';
      if (ag.interviewTask && a.interview.pick !== null) h += para('가장 중요한 관점: ' + ag.interviews[a.interview.pick].who, a.interview.reason);
      if (ag.finalFactor) h += '<p>가장 큰 영향: ' + esc(a.final.factor || '—') + '</p>';
      h += para(ag.finalQuestion, a.final.text);
    });
    h += '<h3>정책 가이드라인</h3>' + S.GUIDELINE_FIELDS.map(function (f) { return para(f.label, state.guideline[f.id]); }).join('');
    h += E.consistencyQuestions(state, S).map(function (q) { return para(q.text, state.consistency[q.id]); }).join('');
    h += '<h3>반론 검토</h3><p>' + esc(rb.text) + '</p>' + para('나의 답변 (' + (state.rebuttal.decision === 'revise' ? '가이드라인 수정' : '가이드라인 유지') + ')', state.rebuttal.text);
    h += '<h3>개인 성찰</h3>' + S.REFLECTION_FIELDS.map(function (f) { return para(f.label, state.reflection[f.id]); }).join('');
    h += '</section><section class="card no-print"><p>정답이나 점수는 없어요. 이 보고서는 이 기기에만 저장돼요. 수업에 내려면 PDF로 저장하세요.</p>' +
      '<p class="actions"><button type="button" class="ee-button" data-action="print">PDF로 저장·인쇄</button> <button type="button" class="ee-button secondary" data-action="restart">처음부터 다시</button></p></section>';
    return h;
  };

  // ── 머리 막대(진행 표시)
  function renderProgress() {
    var labels, cur;
    if (state.phase === 'agenda') {
      var ag = currentAgenda();
      $where.textContent = ag.no + ' · ' + ag.area;
      labels = E.STEP_NAMES; cur = state.step;
    } else if (E.WRAP.indexOf(state.phase) >= 0 || state.phase === 'report') {
      $where.textContent = '마무리';
      labels = E.WRAP_NAMES.concat(['보고서']); cur = state.phase === 'report' ? 3 : E.WRAP.indexOf(state.phase);
    } else {
      $where.textContent = '위원회 소집';
      labels = []; cur = 0;
    }
    $progress.innerHTML = labels.map(function (l, i) {
      return '<li' + (i === cur ? ' aria-current="step"' : '') + ' class="' + (i < cur ? 'done' : i === cur ? 'now' : '') + '"><span class="num">' + (i + 1) + '</span><span class="lbl">' + esc(l) + '</span></li>';
    }).join('');
  }

  function updateNav() {
    var ok = E.canAdvance(state, S, C.MIN_TEXT);
    var nextLabel = state.phase === 'intro' ? (resumed ? '이어서 심의하기' : '심의 시작') :
      state.phase === 'reflection' ? '보고서 보기' :
      state.phase === 'agenda' && state.step === E.STEPS.length - 1 ? (state.agenda < S.AGENDAS.length - 1 ? '다음 안건으로' : '마무리 단계로') : '다음';
    var hint = ok ? '' : state.phase === 'agenda' && E.STEPS[state.step] === 'sim' ? '결과를 한 번 이상 확인하면 넘어갈 수 있어요.' :
      state.phase === 'agenda' && E.STEPS[state.step] === 'initial' ? '최초 판단을 확정하면 넘어갈 수 있어요.' : '빈 칸을 채우고 선택을 마치면 넘어갈 수 있어요. (글자 ' + C.MIN_TEXT + '자 이상)';
    if (state.phase === 'report') { $nav.innerHTML = '<button type="button" class="ee-button secondary" data-action="back">이전</button>'; return; }
    $nav.innerHTML = (state.phase !== 'intro' ? '<button type="button" class="ee-button secondary" data-action="back">이전</button>' : '<span></span>') +
      '<span class="nav-hint" aria-live="polite">' + esc(hint) + '</span>' +
      '<button type="button" class="ee-button" data-action="next"' + (ok ? '' : ' disabled') + '>' + esc(nextLabel) + '</button>';
  }

  function render(focusTop) {
    if (state.phase === 'rebuttal' && !state.rebuttal.id) state.rebuttal.id = urlRebuttal || C.REBUTTAL_DEFAULT;
    var html;
    if (state.phase === 'agenda') html = screens[E.STEPS[state.step]](currentAgenda());
    else html = screens[state.phase]();
    $app.innerHTML = html;
    renderProgress();
    updateNav();
    paintCanvases();
    if (focusTop) {
      window.scrollTo(0, 0);
      var h2 = $app.querySelector('h2');
      if (h2) { h2.setAttribute('tabindex', '-1'); h2.focus({ preventScroll: true }); }
    }
  }

  function go(fn) {
    if (fn()) { delete state._pendingInitial; save(); sound('paper'); render(true); }
    if (state.phase === 'report') {
      St.writeResult(E.cardText(state, S, C.TITLE));
    }
  }

  function toggle(list, id) { var i = list.indexOf(id); if (i >= 0) list.splice(i, 1); else list.push(id); }

  // ── 입력
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-action]');
    if (!t) return;
    var act = t.dataset.action, v = t.dataset.value, ag = state.phase === 'agenda' ? currentAgenda() : null, a = ag ? ans() : null;
    switch (act) {
      case 'next': go(function () { return E.next(state, S, C.MIN_TEXT); }); return;
      case 'back': go(function () { return E.back(state, S); }); return;
      case 'pick': toggle(a.data.picks, v); break;
      case 'quiz': E.answerQuestion(state, ag, t.dataset.q, v); break;
      case 'initial': state._pendingInitial = v; break;
      case 'lock': openConfirm('최초 판단을 “' + choiceText(state._pendingInitial) + '”(으)로 확정할까요? 확정하면 바꿀 수 없어요.', function () {
        E.lockInitial(state, ag, state._pendingInitial, S); delete state._pendingInitial; save(); sound('collect'); render();
      }); return;
      case 'open-optional': a.interview.opened = true; break;
      case 'iv-pick': a.interview.pick = Number(v); break;
      case 'sim-choice': a.sim.choice = v; break;
      case 'sim-prot': toggle(a.sim.prot, v); break;
      case 'run': a.sim.ran = true; break;
      case 'final-choice':
        a.final.choice = v;
        if (v === 'B' && !a.final.prot.length && a.sim.choice === 'B') a.final.prot = a.sim.prot.slice();
        if (v !== 'B') a.final.prot = [];
        break;
      case 'final-prot': toggle(a.final.prot, v); break;
      case 'factor': a.final.factor = v; break;
      case 'decision': state.rebuttal.decision = v; break;
      case 'add-right': {
        var cur = state.reflection.right.trim();
        if (cur.indexOf(v) < 0) state.reflection.right = (cur ? cur + ', ' : '') + v;
        break;
      }
      case 'print': window.print(); return;
      case 'restart': openConfirm('처음부터 다시 할까요? 지금까지 쓴 답이 이 기기에서 지워져요. PDF로 저장했는지 확인하세요.', restart); return;
      case 'menu': openMenu(); return;
      default: return;
    }
    sound('tap');
    save();
    var y = window.scrollY;
    render();
    window.scrollTo(0, y);
  });

  document.addEventListener('submit', function (ev) {
    var f = ev.target.closest('form.num');
    if (!f) return;
    ev.preventDefault();
    var rec = E.answerQuestion(state, currentAgenda(), f.dataset.q, f.querySelector('input').value);
    if (!rec) return;
    sound(rec.correct ? 'collect' : rec.done ? 'paper' : 'miss');
    save();
    var y = window.scrollY;
    render();
    window.scrollTo(0, y);
  });

  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (!el.dataset || !el.dataset.bind) return;
    var path = el.dataset.bind;
    // 데이터 질문 서술형 칸은 기록 객체가 없을 수 있다
    var m = path.match(/^answers\.([a-z]+)\.data\.q\.([a-z0-9]+)\.value$/);
    if (m) {
      var q = state.answers[m[1]].data.q;
      q[m[2]] = q[m[2]] || { value: '' };
      q[m[2]].value = el.value;
    } else setPath(path, el.value);
    save();
    updateNav();
  });

  // ── 대화 상자
  var $confirm = document.getElementById('confirm');
  var confirmAction = null;
  function openConfirm(text, fn) {
    document.getElementById('confirm-text').textContent = text;
    confirmAction = fn;
    $confirm.showModal();
  }
  $confirm.addEventListener('close', function () {
    if ($confirm.returnValue === 'ok' && confirmAction) confirmAction();
    confirmAction = null;
  });

  var $menu = document.getElementById('menu');
  function openMenu() {
    document.getElementById('opt-sound').checked = settings.sound;
    var sel = document.getElementById('opt-rebuttal');
    sel.value = state.rebuttal.id || urlRebuttal || C.REBUTTAL_DEFAULT;
    $menu.showModal();
  }
  document.getElementById('opt-sound').addEventListener('change', function (ev) {
    settings.sound = ev.target.checked;
    St.writeSettings(settings);
    if (assets) assets.setSound(settings.sound);
    sound('tap');
  });
  document.getElementById('opt-rebuttal').addEventListener('change', function (ev) {
    state.rebuttal.id = ev.target.value;
    save();
    if (state.phase === 'rebuttal' || state.phase === 'report') render();
  });
  document.getElementById('opt-clear').addEventListener('click', function () {
    $menu.close();
    openConfirm('이 게임 기록을 지울까요? 다른 게임 기록과 공통 플레이어 정보는 그대로 둬요.', restart);
  });

  function restart() {
    St.clearGame();
    state = E.newState(S, C.VERSION);
    resumed = false;
    save();
    render(true);
  }

  // ── 시작
  (function initSelect() {
    var sel = document.getElementById('opt-rebuttal');
    sel.innerHTML = Object.keys(S.REBUTTALS).map(function (k) { return '<option value="' + k + '">' + esc(S.REBUTTALS[k].label) + '</option>'; }).join('');
  })();

  if (!storageOk) {
    var n = document.getElementById('storage-note');
    n.hidden = false;
  }

  render();

  if (window.EthicityAssets && window.ETHICITY_COMMON_MANIFEST) {
    EthicityAssets.load(ETHICITY_COMMON_MANIFEST, C.COMMON_BASE).then(function (loaded) {
      assets = loaded;
      assets.setSound(settings.sound);
      paintCanvases();
    }).catch(function () { /* 그림 없이 진행 */ });
  }

  // 테스트 도구가 상태를 볼 수 있게
  window.HR.App = { state: function () { return state; }, render: render };
})();
