/*
 * 화면 흐름 — START(표지) → 장면 목록(story.scenes) 순서대로 → COMPLETE.
 * 장면마다 패널(오른쪽/아래 HTML)을 다시 그리고, 무대(canvas)에는 배경과 인물을 세운다.
 * 통합 이벤트: ethicity:ready / ethicity:progress / ethicity:complete (개인정보는 담지 않는다)
 */
(function () {
  'use strict';

  var S = window.DiversityStory;
  var Store = window.DiversityStore;
  var Stage = window.DiversityStage;
  var COMMON = '../shared/ethicity-elementary-common-v1';
  var LETTERS = ['A', 'B', 'C'];
  var TYPE_MS = { normal: 28, fast: 10, instant: 0 };

  var $ = function (id) { return document.getElementById(id); };
  var panel = $('panel'), main = $('main');

  var assets = null;
  var settings = Store.loadSettings();
  var progress = null;           // 진행 중이 아니면 null
  var sceneIndex = -1;           // -1 = 표지
  var view = {};                 // 지금 장면의 임시 상태(고른 것, 대사 위치 등)
  var primary = null;            // Space/Enter로 누를 기본 동작
  var choose = null;             // 숫자 키로 고르기
  var returnTo = null;           // 보고서를 완료 화면에서 다시 볼 때 돌아갈 곳

  // ── 작은 도우미 ──
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }

  function icon(id, label) {
    var c = h('canvas', { class: 'ee-icon', width: 32, height: 32, 'aria-hidden': label ? null : 'true', role: label ? 'img' : null, 'aria-label': label || null });
    assets.drawIcon(c.getContext('2d'), id, 0, 0, 32);
    return c;
  }

  function portrait(id, expr) {
    var c = h('canvas', { class: 'dv-portrait ee-pixel', width: 256, height: 256, 'aria-hidden': 'true' });
    assets.drawPortrait(c.getContext('2d'), id, expr || 'neutral', 0, 0, 256);
    return c;
  }

  function button(label, onClick, opts) {
    opts = opts || {};
    return h('button', { type: 'button', class: 'ee-button' + (opts.secondary ? ' secondary' : ''), disabled: opts.disabled, onclick: onClick, id: opts.id }, [label]);
  }

  function reduced() {
    return settings.motion || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function sound(id) { if (assets) assets.playSound(id); }
  function effect(id) { if (assets) Stage.effect(id); } // 문서형 화면에서는 무대가 숨어 있어 보이지 않을 뿐이다

  function emit(type, extra) {
    var msg = { type: type, gameId: S.gameId };
    if (extra) Object.keys(extra).forEach(function (k) { msg[k] = extra[k]; });
    try { if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*'); } catch (e) { /* 통합 페이지 없이도 동작 */ }
    try { window.dispatchEvent(new CustomEvent(type, { detail: msg })); } catch (e) { /* 오래된 브라우저 */ }
  }

  var toastTimer = 0;
  function toast(text) {
    var t = $('toast');
    t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  function say(text) { $('live').textContent = ''; setTimeout(function () { $('live').textContent = text; }, 30); }

  function save() { if (progress) Store.saveProgress(progress); }

  function optionsOf(set) { return S.options[set]; }
  function pickOf(scene) {
    if (scene.slot === 'initial') return progress.initial;
    return progress.missions[scene.set][scene.slot];
  }

  // ── 화면 틀 ──
  function card(scene, title, kids, eyebrow) {
    var head = h('h2', { class: 'dv-title', tabindex: '-1', text: title });
    var top = eyebrow || (scene && scene.id ? scene.id : null);
    return h('article', { class: 'ee-panel dv-card' }, [top ? h('p', { class: 'dv-eyebrow', text: top }) : null, head].concat(kids));
  }

  function actions(btns) { return h('div', { class: 'dv-actions' }, btns); }

  function mount(node, layout) {
    main.dataset.layout = layout || 'scene';
    panel.replaceChildren(node);
    panel.scrollTop = 0;
    var t = panel.querySelector('.dv-title');
    if (t) t.focus({ preventScroll: true });
    if (layout === 'doc') window.scrollTo(0, 0);
  }

  function hud(scene) {
    var part = partOf(sceneIndex);
    var partEl = $('hud-part');
    if (sceneIndex < 0) { partEl.hidden = true; $('hud-progress').hidden = true; $('hud-place').textContent = S.title; return; }
    partEl.hidden = false; partEl.textContent = S.parts[part];
    $('hud-place').textContent = S.places[scene.bg] || '';
    $('hud-progress').hidden = false;
    $('hud-progress-text').textContent = '진행 ' + (part + 1) + ' / ' + S.parts.length + ' 단계';
    var ol = $('hud-steps');
    ol.replaceChildren.apply(ol, S.parts.map(function (name, i) {
      return h('li', { class: i < part ? 'done' : i === part ? 'now' : '' }, [i < part ? '✓' : String(i + 1)]);
    }));
  }

  function partOf(index) {
    var p = 0;
    for (var i = 0; i <= index && i < S.scenes.length; i++) if (S.scenes[i].type === 'chapter') p = S.scenes[i].part;
    return p;
  }

  // ── 진행 ──
  function go(index) {
    sceneIndex = index;
    var scene = S.scenes[index];
    progress.scene = index;
    if (scene.type === 'complete') progress.done = true;
    save();
    view = {}; primary = null; choose = null;
    if (scene.type === 'chapter') emit('ethicity:progress', { current: scene.part, total: S.parts.length });
    hud(scene);
    Stage.show(scene.bg, scene.cast || [], scene.who || null);
    RENDER[scene.type](scene);
  }

  function next() { go(sceneIndex + 1); }

  // 저장된 위치가 아직 고르지 않은 선택 뒤라면(손상된 저장 등) 그 선택 장면으로 돌려보낸다.
  function safeScene(saved) {
    for (var i = 0; i < saved; i++) {
      var s = S.scenes[i];
      if (s.type === 'choice' && !pickOf(s)) return i;
      if (s.type === 'principle' && !progress.principle) return i;
      if (s.type === 'review' && !progress.confirmed) return i - 1;
      if (s.type === 'reflect' && !progress.reflection.change) return i;
    }
    return saved;
  }

  // ── 대사(한 글자씩) ──
  function typeLine(el, text, done) {
    var ms = reduced() ? 0 : TYPE_MS[settings.speed];
    view.typing = null;
    if (!ms) { el.textContent = text; done(); return; }
    var i = 0;
    el.textContent = '';
    var timer = setInterval(function () {
      i++;
      el.textContent = text.slice(0, i);
      if (i >= text.length) finish();
    }, ms);
    function finish() { clearInterval(timer); el.textContent = text; view.typing = null; done(); }
    view.typing = finish;
  }

  // ── 장면별 그리기 ──
  var RENDER = {
    chapter: function (scene) {
      sound('door');
      var kids = [];
      if (scene.sub) kids.push(h('p', { class: 'dv-lead', text: scene.sub }));
      if (scene.issue) kids.push(h('p', { class: 'dv-issue' }, [h('span', { class: 'ee-badge', text: '핵심 쟁점' }), ' ', scene.issue]));
      var label = scene.part === 0 ? '탐험을 시작합니다' : '계속하기';
      kids.push(actions([button(label, next)]));
      primary = next;
      mount(card(null, scene.title, kids, scene.eyebrow));
    },

    talk: function (scene) {
      if (scene.sound) sound(scene.sound);
      var face = h('div', { class: 'dv-face' });
      var name = h('p', { class: 'ee-speaker' });
      var line = h('p', { class: 'dv-line', 'aria-hidden': 'true' });
      var bubble = h('div', { class: 'ee-speech dv-bubble' }, [name, line]);
      var nextBtn = button('다음 ▼', advance, { id: 'btn-next' });
      var counter = h('span', { class: 'dv-small' });
      mount(card(scene, scene.title || '대화', [h('div', { class: 'dv-talk' }, [face, bubble]), actions([counter, nextBtn])]));
      var i = -1;
      function show() {
        var l = scene.lines[i];
        face.replaceChildren(l.who ? portrait(l.who, l.expr) : icon('robot'));
        name.textContent = l.who ? S.people[l.who] : '안내';
        Stage.speak(l.who);
        counter.textContent = (i + 1) + ' / ' + scene.lines.length;
        nextBtn.textContent = i === scene.lines.length - 1 ? '계속하기 ▶' : '다음 ▼';
        say((l.who ? S.people[l.who] + ': ' : '') + l.text);
        typeLine(line, l.text, function () {});
        if (i === 0 && scene.effect) effect(scene.effect);
      }
      function advance() {
        if (view.typing) { view.typing(); return; }
        if (i < scene.lines.length - 1) { i++; sound('tap'); show(); } else next();
      }
      primary = advance;
      advance();
    },

    rules: function (scene) {
      var list = h('ol', { class: 'dv-rules' }, scene.rules.map(function (r) { return h('li', { text: r }); }));
      primary = next;
      mount(card(scene, scene.title, [
        h('p', { class: 'dv-lead', text: '심의는 다음 순서로 진행합니다.' }),
        list,
        h('p', { text: scene.after }),
        h('p', { class: 'ee-notice' }, [scene.note]),
        actions([button('알겠습니다', next)])
      ], scene.id + ' · 위원 임명 및 임무 안내'));
    },

    case: function (scene) {
      sound('paper');
      primary = next;
      mount(card(scene, scene.title, [
        h('p', { class: 'dv-badges' }, [h('span', { class: 'ee-badge', text: scene.label })]),
        h('div', {}, scene.body.map(function (b) { return h('p', { text: b }); })),
        h('figure', { class: 'dv-request' }, [
          h('figcaption', { class: 'dv-label' }, [icon('notebook'), ' ', scene.requester]),
          h('blockquote', { text: '“' + scene.request + '”' })
        ]),
        h('figure', { class: 'dv-output' }, [
          h('figcaption', { class: 'dv-label' }, [icon('robot'), ' AI 생성 결과 ', h('span', { class: 'dv-small', text: '(이미지를 글로 설명)' })]),
          h('p', { class: 'dv-output-text', text: scene.output })
        ]),
        h('ul', { class: 'dv-quotes' }, scene.quotes.map(function (q) {
          return h('li', { class: 'dv-quote' }, [h('p', { class: 'ee-speaker', text: q.who }), h('p', { text: '“' + q.text + '”' })]);
        })),
        h('p', { class: 'dv-ask' }, [h('strong', { text: scene.ask })]),
        actions([button('선택하러 가기', next)])
      ], scene.id + ' · 사건 제시'));
    },

    choice: function (scene) {
      var opts = optionsOf(scene.set);
      var first = scene.slot === 'final' ? progress.missions[scene.set].first : null;
      var decide = button('결정하기', commit, { disabled: true });
      var btns = LETTERS.map(function (L, n) {
        var o = opts[L];
        return h('button', { type: 'button', class: 'ee-choice dv-choice', 'aria-pressed': 'false', 'data-letter': L, onclick: function () { pick(L); } }, [
          h('span', { class: 'dv-letter', text: L + '.' }),
          h('span', { class: 'dv-choice-body' }, [
            h('span', { class: 'dv-choice-text', text: o.text }),
            o.detail ? h('span', { class: 'dv-choice-detail', text: o.detail }) : null,
            first === L ? h('span', { class: 'ee-badge dv-first' }, ['처음 선택']) : null
          ]),
          h('span', { class: 'dv-picked', 'aria-hidden': 'true', text: '✓ 선택함' })
        ]);
      });
      function pick(L) {
        view.pick = L;
        btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.letter === L)); });
        decide.disabled = false;
        sound('tap');
      }
      function commit() {
        if (!view.pick) return;
        if (scene.slot === 'initial') progress.initial = view.pick;
        else progress.missions[scene.set][scene.slot] = view.pick;
        sound('collect');
        next();
      }
      choose = function (n) { if (n >= 1 && n <= 3) pick(LETTERS[n - 1]); };
      primary = function () { if (view.pick) commit(); };
      var kids = [];
      if (scene.who) kids.push(h('div', { class: 'dv-talk dv-talk-sm' }, [h('div', { class: 'dv-face' }, [portrait(scene.who, 'explaining')]), h('div', { class: 'ee-speech dv-bubble' }, [h('p', { class: 'ee-speaker', text: S.people[scene.who] }), h('p', { text: scene.prompt })])]));
      if (first) kids.push(h('p', { class: 'dv-small' }, ['처음에 고른 선택지에 ', h('span', { class: 'ee-badge', text: '처음 선택' }), ' 표시가 있어요. 유지해도, 바꿔도 괜찮아요.']));
      kids.push(h('div', { class: 'dv-choices', role: 'group', 'aria-label': '선택지' }, btns));
      if (scene.note) kids.push(h('p', { class: 'dv-small', text: scene.note }));
      kids.push(actions([h('span', { class: 'dv-small', text: '하나를 골라야 결정할 수 있어요.' }), decide]));
      mount(card(scene, scene.title, kids, scene.id + (scene.set === 'initial' ? ' · 프롤로그' : ' · ' + S.missions[scene.set].title)));
    },

    result: function (scene) {
      var r = S.results[scene.set], L = progress.missions[scene.set].first, o = r[L];
      Stage.speak(r.critic);
      primary = next;
      mount(card(scene, '당신의 결정으로 나타난 결과', [
        h('p', { class: 'dv-mine' }, [h('span', { class: 'ee-badge', text: '나의 선택' }), ' ', L + '. ' + optionsOf(scene.set)[L].text]),
        h('section', { class: 'ee-success dv-block' }, [h('h3', { class: 'dv-label' }, [icon('check'), ' 긍정적인 결과']), h('p', { text: o.good })]),
        h('section', { class: 'ee-notice dv-block' }, [h('h3', { class: 'dv-label' }, [icon('warning'), ' 새롭게 제기된 문제']), h('p', { text: o.problem })]),
        h('p', { class: 'dv-small', text: S.people[r.reporter] + ' 위원이 결과를 정리했습니다.' }),
        h('section', { class: 'dv-talk' }, [
          h('div', { class: 'dv-face' }, [portrait(r.critic, 'worried')]),
          h('div', { class: 'ee-speech dv-bubble' }, [h('h3', { class: 'ee-speaker', text: '위원회에 접수된 반론 · ' + S.people[r.critic] }), h('p', { text: o.rebuttal })])
        ]),
        h('p', { class: 'dv-small', text: S.resultNote }),
        actions([button('추가 정보 보기', next)])
      ], scene.id + ' · 선택 결과 확인'));
    },

    info: function (scene) {
      var inf = S.info[scene.set];
      Stage.speak(inf.who);
      sound('paper'); effect('clue');
      primary = next;
      mount(card(scene, '추가 조사 결과', [
        h('div', { class: 'dv-talk dv-talk-sm' }, [h('div', { class: 'dv-face' }, [portrait(inf.who, 'explaining')]), h('div', { class: 'ee-speech dv-bubble' }, [h('p', { class: 'ee-speaker', text: S.people[inf.who] }), h('p', { text: '위원회가 사건을 더 조사한 결과 다음 사실을 확인했습니다.' })])]),
        h('ol', { class: 'dv-info' }, inf.items.map(function (t, i) {
          return h('li', {}, [h('span', { class: 'dv-label' }, [icon('inspect'), ' 정보 ' + (i + 1) + '.']), h('p', { text: t })]);
        })),
        actions([button('최종 판단하기', next)])
      ], scene.id + ' · 새로운 정보 공개'));
    },

    verdict: function (scene) {
      var m = progress.missions[scene.set], v = S.verdicts[scene.set], o = optionsOf(scene.set);
      var kept = m.first === m.final;
      var speaker = scene.set === 'edu' ? 'teacher' : scene.set === 'news' ? 'librarian' : 'robot';
      Stage.speak(speaker);
      var last = scene.set === 'edu';
      primary = next;
      mount(card(scene, S.missions[scene.set].title + ' 심의 결과', [
        h('dl', { class: 'dv-path' }, [
          h('dt', { text: '처음 선택' }), h('dd', { text: m.first + '. ' + o[m.first].short }),
          h('dt', { text: '최종 판단' }), h('dd', {}, [m.final + '. ' + o[m.final].short + ' ', h('span', { class: 'ee-badge', text: kept ? '유지' : '수정' })])
        ]),
        h('p', { class: 'ee-notice' }, [kept ? v.keep : v.change]),
        h('div', { class: 'dv-talk dv-talk-sm' }, [h('div', { class: 'dv-face' }, [portrait(speaker, 'explaining')]), h('div', { class: 'ee-speech dv-bubble' }, [h('p', { class: 'ee-speaker', text: S.people[speaker] }), h('p', { text: v.closing })])]),
        actions([button(last ? '최종 심의로' : '다음 사건으로', next)])
      ], scene.id + ' · 미션 종료'));
    },

    link: function (scene) {
      var kids = [];
      primary = next;
      if (scene.set === 'ad') {
        var nf = progress.missions.news.final;
        kids.push(h('div', { class: 'dv-talk' }, [h('div', { class: 'dv-face' }, [portrait('robot', 'explaining')]), h('div', { class: 'ee-speech dv-bubble' }, [h('p', { class: 'ee-speaker', text: S.people.robot }), h('p', { text: S.links.ad[nf] })])]));
        Stage.speak('robot');
      } else {
        var l = S.links.edu, n = progress.missions.news.final, a = progress.missions.ad.final;
        kids.push(h('p', { text: l.lead }));
        kids.push(h('table', { class: 'dv-table' }, [
          h('caption', { text: '이전 심의 결과' }),
          h('tbody', {}, [
            h('tr', {}, [h('th', { scope: 'row', text: '뉴스' }), h('td', { text: n + '. ' + S.options.news[n].text })]),
            h('tr', {}, [h('th', { scope: 'row', text: '광고' }), h('td', { text: a + '. ' + S.options.ad[a].text })])
          ])
        ]));
        kids.push(h('div', { class: 'dv-talk dv-talk-sm' }, [h('div', { class: 'dv-face' }, [portrait('teacher', 'explaining')]), h('div', { class: 'ee-speech dv-bubble' }, [h('p', { class: 'ee-speaker', text: S.people.teacher }), h('p', { text: (n === a ? l.same : l.differ) + ' ' + l.ask })])]));
        Stage.speak('teacher');
      }
      kids.push(actions([button('사건 보기', next)]));
      mount(card(scene, '이전 판단 연결', kids, scene.id));
    },

    principle: function (scene) {
      var decide = button('결정하기', commit, { disabled: true });
      var btns = S.principles.map(function (p) {
        return h('button', { type: 'button', class: 'ee-choice dv-choice', 'aria-pressed': 'false', 'data-id': p.id, onclick: function () { pick(p.id); } }, [
          h('span', { class: 'dv-choice-body' }, [h('strong', { class: 'dv-choice-text', text: p.label }), h('span', { class: 'dv-choice-detail', text: p.text })]),
          h('span', { class: 'dv-picked', 'aria-hidden': 'true', text: '✓ 선택함' })
        ]);
      });
      function pick(id) {
        view.pick = id;
        btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.id === id)); });
        decide.disabled = false; sound('tap');
      }
      function commit() { if (!view.pick) return; progress.principle = view.pick; sound('collect'); next(); }
      if (progress.principle) pick(progress.principle);
      choose = function (n) { if (n >= 1 && n <= 4) pick(S.principles[n - 1].id); };
      primary = function () { if (view.pick) commit(); };
      mount(card(scene, scene.title, [
        h('div', { class: 'dv-talk dv-talk-sm' }, [h('div', { class: 'dv-face' }, [portrait(scene.who, 'explaining')]), h('div', { class: 'ee-speech dv-bubble' }, [h('p', { class: 'ee-speaker', text: S.people[scene.who] }), h('p', { text: scene.prompt })])]),
        h('div', { class: 'dv-choices', role: 'group', 'aria-label': '공통 원칙' }, btns),
        h('p', { class: 'dv-small', text: scene.note }),
        actions([decide])
      ], scene.id + ' · 공통 원칙 결정'));
    },

    charter: function (scene) {
      var pr = principleOf(progress.principle);
      var timer = 0;
      var fields = S.charter.map(function (c) {
        var id = 'charter-' + c.id;
        var ta = h('textarea', { id: id, class: 'dv-textarea', rows: c.id === 'reason' ? 3 : 4, maxlength: 2000, 'aria-describedby': c.ask ? id + '-ask' : null });
        ta.value = progress.charter[c.id];
        ta.addEventListener('input', function () {
          progress.charter[c.id] = ta.value;
          clearTimeout(timer); timer = setTimeout(save, 400);
        });
        return h('div', { class: 'dv-field' }, [
          h('label', { for: id, class: 'dv-article', text: c.article }),
          c.ask ? h('p', { id: id + '-ask', class: 'dv-small', text: c.ask }) : null,
          ta
        ]);
      });
      primary = null; // 글을 쓰는 화면이라 Space/Enter를 가로채지 않는다
      mount(card(scene, scene.title, [
        h('p', { text: scene.lead }),
        h('p', { class: 'dv-badges' }, [h('span', { class: 'ee-badge', text: '공통 원칙: ' + pr.label }), ' ', h('span', { class: 'dv-small', text: pr.text })]),
        h('div', { class: 'dv-fields' }, fields),
        h('p', { class: 'dv-small', text: '적은 글은 이 기기에만 저장돼요. 비워 둔 칸은 보고서에 \'미작성\'으로 표시돼요.' }),
        actions([button('다시 고르기: 공통 원칙', function () { save(); go(sceneIndex - 1); }, { secondary: true }), button('작성 완료 · 점검하기', function () { save(); next(); })])
      ], scene.id + ' · 분야별 적용 기준 제정'), 'doc');
    },

    review: function (scene) {
      var pr = principleOf(progress.principle);
      var empty = S.charter.filter(function (c) { return !progress.charter[c.id].trim(); });
      function confirm() {
        var go2 = function () { progress.confirmed = true; save(); sound('win'); toast('윤리 기준을 확정했어요.'); next(); };
        if (!empty.length) return go2();
        ask('비어 있는 칸이 있어요', empty.map(function (c) { return c.article; }).join(', ') + '이(가) 비어 있어요. 이대로 확정하면 보고서에 \'미작성\'으로 표시돼요.', '이대로 확정', go2);
      }
      primary = null;
      mount(card(scene, scene.title, [
        h('p', { class: 'dv-badges' }, [h('span', { class: 'ee-badge', text: '공통 원칙: ' + pr.label })]),
        charterList(),
        h('section', { class: 'ee-notice dv-block' }, [
          h('h3', { class: 'dv-label' }, [icon('help'), ' 최종 점검']),
          h('ul', { class: 'dv-checks' }, S.reviewChecks.map(function (q) { return h('li', { text: '“' + q + '”' }); }))
        ]),
        h('p', { text: scene.lead }),
        actions([button('기준 수정하기', function () { sound('retry'); go(sceneIndex - 1); }, { secondary: true }), button('이대로 확정하기', confirm)])
      ], scene.id + ' · 윤리 기준 검토'), 'doc');
    },

    report: function (scene) {
      var back = returnTo;
      returnTo = null;
      primary = null;
      mount(h('div', { class: 'dv-report-wrap' }, [card(scene, scene.title, [
        h('p', { class: 'dv-badges' }, [h('span', { class: 'ee-badge', text: '✓ ' + scene.sub })]),
        reportBody(),
        actions([
          button('결과 보고서 복사', copyReport, { secondary: true }),
          button('인쇄하기', function () { window.print(); }, { secondary: true }),
          back != null ? button('완료 화면으로', function () { go(back); }) : button('최종 성찰로', next)
        ])
      ], scene.id + ' · 결과 보고서')]), 'doc');
    },

    reflect: function (scene) {
      var R = S.reflection, init = progress.initial;
      var submit = button('제출하기', commit, { disabled: true });
      var btns = R.options.map(function (o, n) {
        return h('button', { type: 'button', class: 'ee-choice dv-choice', 'aria-pressed': 'false', 'data-id': o.id, onclick: function () { pick(o.id); } }, [
          h('span', { class: 'dv-letter', text: (n + 1) + '.' }),
          h('span', { class: 'dv-choice-body' }, [h('span', { class: 'dv-choice-text', text: o.text })]),
          h('span', { class: 'dv-picked', 'aria-hidden': 'true', text: '✓ 선택함' })
        ]);
      });
      var ta = h('textarea', { id: 'reflect-reason', class: 'dv-textarea', rows: 3, maxlength: 2000 });
      ta.value = progress.reflection.reason;
      ta.addEventListener('input', function () { progress.reflection.reason = ta.value; save(); });
      function pick(id) {
        view.pick = id;
        btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.id === id)); });
        submit.disabled = false; sound('tap');
      }
      function commit() {
        if (!view.pick) return;
        progress.reflection.change = view.pick;
        save();
        Store.saveResult();
        emit('ethicity:progress', { current: S.parts.length, total: S.parts.length });
        emit('ethicity:complete', { result: { completed: true } });
        next();
      }
      choose = function (n) { if (n >= 1 && n <= 3) pick(R.options[n - 1].id); };
      primary = null;
      mount(card(scene, scene.title, [
        h('p', { class: 'dv-mine' }, [h('span', { class: 'ee-badge', text: '게임을 시작할 때 나의 의견' }), ' ', init + '. ' + S.options.initial[init].text]),
        h('p', { class: 'dv-lead', text: R.prompt }),
        h('div', { class: 'dv-choices', role: 'group', 'aria-label': '생각의 변화' }, btns),
        h('div', { class: 'dv-field' }, [h('label', { for: 'reflect-reason', class: 'dv-article', text: R.reasonLabel }), ta]),
        actions([submit])
      ], scene.id + ' · 판단 성찰'));
    },

    complete: function (scene) {
      var C = S.complete;
      sound('win'); Stage.speak('teacher'); effect('correct');
      primary = null;
      var reportIndex = indexOfType('report');
      mount(card(scene, '심의를 마쳤습니다', [
        h('div', { class: 'dv-talk' }, [h('div', { class: 'dv-face' }, [portrait('teacher', 'happy')]), h('div', { class: 'ee-speech dv-bubble' }, [h('p', { class: 'ee-speaker', text: S.people.teacher }), h('p', { text: S.reflection.closing })])]),
        h('section', { class: 'dv-block' }, [h('h3', { class: 'dv-label' }, [icon('clue'), ' 우리가 발견한 것']), h('ul', {}, C.found.map(function (t) { return h('li', { text: t }); }))]),
        h('section', { class: 'ee-success dv-block' }, [h('h3', { class: 'dv-label' }, [icon('heart'), ' 기억할 한 문장']), h('p', { text: C.remember })]),
        h('section', { class: 'ee-notice dv-block' }, [h('h3', { class: 'dv-label' }, [icon('map'), ' 다음 탐험']), h('p', { text: '“' + C.next + '”' }), h('p', { class: 'dv-small', text: C.nextHint })]),
        actions([
          button('결과 보고서 다시 보기', function () { returnTo = sceneIndex; go(reportIndex); }, { secondary: true }),
          button('처음 화면으로', home)
        ])
      ], '탐험 완료'));
    }
  };

  function indexOfType(type) { for (var i = 0; i < S.scenes.length; i++) if (S.scenes[i].type === type) return i; return -1; }
  function principleOf(id) { return S.principles.filter(function (p) { return p.id === id; })[0] || S.principles[0]; }

  function charterList() {
    return h('dl', { class: 'dv-charter' }, S.charter.reduce(function (acc, c) {
      var t = progress.charter[c.id].trim();
      acc.push(h('dt', { text: c.article }));
      acc.push(h('dd', { class: t ? '' : 'dv-empty', text: t || '미작성' }));
      return acc;
    }, []));
  }

  function reportBody() {
    var init = progress.initial;
    var rows = ['news', 'ad', 'edu'].map(function (k) {
      var m = progress.missions[k], o = S.options[k], kept = m.first === m.final;
      return h('tr', {}, [
        h('th', { scope: 'row', text: S.missions[k].label }),
        h('td', { text: m.first + '. ' + o[m.first].short }),
        h('td', {}, [h('strong', { text: m.final + '. ' + o[m.final].text })]),
        h('td', {}, [h('span', { class: 'ee-badge', text: kept ? '유지' : '수정' })])
      ]);
    });
    var pr = principleOf(progress.principle);
    return h('div', { class: 'dv-report' }, [
      h('p', {}, [h('strong', { text: '최초 판단 ' }), init + '. ' + S.options.initial[init].text]),
      h('div', { class: 'dv-table-scroll' }, [h('table', { class: 'dv-table' }, [
        h('caption', { text: '분야별 결정과 판단 과정' }),
        h('thead', {}, [h('tr', {}, [h('th', { scope: 'col', text: '분야' }), h('th', { scope: 'col', text: '처음 선택' }), h('th', { scope: 'col', text: '최종 결정' }), h('th', { scope: 'col', text: '과정' })])]),
        h('tbody', {}, rows)
      ])]),
      h('h3', { text: '우선적으로 선택한 윤리 원칙' }),
      h('p', {}, [h('strong', { text: pr.label }), ' — ' + pr.text]),
      h('h3', { text: '분야별 윤리 기준' }),
      charterList()
    ]);
  }

  function reportText() {
    var lines = ['AI 윤리 심의 결과 보고서 — 다양성 존중 윤리 기준 제정 완료', ''];
    var init = progress.initial;
    lines.push('최초 판단: ' + init + '. ' + S.options.initial[init].text, '');
    ['news', 'ad', 'edu'].forEach(function (k) {
      var m = progress.missions[k], o = S.options[k];
      lines.push(S.missions[k].label + ': ' + m.final + '. ' + o[m.final].text + ' (처음 ' + m.first + '. ' + o[m.first].short + ' → ' + (m.first === m.final ? '유지' : '수정') + ')');
    });
    var pr = principleOf(progress.principle);
    lines.push('', '우선적으로 선택한 윤리 원칙: ' + pr.label + ' — ' + pr.text, '', '분야별 윤리 기준');
    S.charter.forEach(function (c) { lines.push(c.article + ': ' + (progress.charter[c.id].trim() || '미작성')); });
    return lines.join('\n');
  }

  function copyReport() {
    var text = reportText();
    var ok = function () { toast('결과 보고서를 복사했어요.'); sound('collect'); };
    var fallback = function () {
      var ta = h('textarea', { class: 'dv-sr', 'aria-hidden': 'true' });
      ta.value = text; document.body.appendChild(ta); ta.select();
      var done = false;
      try { done = document.execCommand('copy'); } catch (e) { done = false; }
      ta.remove();
      if (done) ok(); else toast('복사하지 못했어요. 인쇄하기로 저장해 주세요.');
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(ok, fallback);
    else fallback();
  }

  // ── 표지 ──
  function home() {
    sceneIndex = -1; primary = null; choose = null; view = {};
    hud(null);
    Stage.show('ai_lab', [
      { id: 'saebom', x: 300, dir: 'right' }, { id: 'jiho', x: 410, dir: 'right' }, { id: 'onyu', x: 520, dir: 'down' },
      { id: 'teacher', x: 640, dir: 'down' }, { id: 'robot', x: 760, dir: 'down' }, { id: 'daon', x: 870, dir: 'left' }, { id: 'haneul', x: 980, dir: 'left' }
    ], null);
    var saved = Store.loadProgress(S.scenes.length, S.principles.map(function (p) { return p.id; }));
    var nick = Store.playerNickname();
    var btns = [];
    if (saved) {
      btns.push(button(saved.done ? '완료 화면 보기' : '이어 하기', function () { start(saved); }));
      btns.push(button('처음부터 시작', function () {
        ask('처음부터 시작할까요?', '지금까지의 선택과 작성한 글이 지워져요.', '처음부터 시작', function () { Store.clearProgress(); start(null); });
      }, { secondary: true }));
    } else {
      btns.push(button('탐험을 시작합니다', function () { start(null); }));
    }
    primary = function () { btns[0].click(); };
    var title = h('h1', { class: 'dv-title dv-logo', tabindex: '-1' }, [S.title, h('span', { class: 'dv-logo-sub', text: S.subtitle })]);
    mount(h('article', { class: 'ee-panel dv-card dv-start' }, [
      h('p', { class: 'dv-eyebrow', text: S.principle + ' · 중·고등학생' }),
      title,
      nick ? h('p', { class: 'dv-lead', text: nick + ' 위원님, 위원회에 오신 것을 환영합니다.' }) : null,
      h('blockquote', { class: 'ee-speech dv-question' }, [h('p', { class: 'ee-speaker', text: '핵심 탐구 질문' }), h('p', { text: S.question })]),
      actions(btns),
      h('details', { class: 'dv-facts' }, [h('summary', { text: '게임 안내' }), h('ul', {}, S.facts.map(function (f) { return h('li', { text: f }); }))])
    ]));
    title.focus({ preventScroll: true });
  }

  function start(saved) {
    progress = saved || Store.emptyProgress();
    var at = saved ? safeScene(saved.scene) : 0;
    go(at);
  }

  // ── 메뉴·확인 창 ──
  var lastFocus = null;
  function openOverlay(el, focusEl) {
    lastFocus = document.activeElement;
    el.hidden = false;
    (focusEl || el.querySelector('button, input')).focus();
  }
  function closeOverlay(el) {
    el.hidden = true;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  var confirmYes = null;
  function ask(title, text, yesLabel, onYes) {
    $('confirm-title').textContent = title;
    $('confirm-text').textContent = text;
    $('confirm-yes').textContent = yesLabel || '확인';
    confirmYes = onYes;
    openOverlay($('confirm'), $('confirm-no'));
  }
  $('confirm-no').addEventListener('click', function () { closeOverlay($('confirm')); });
  $('confirm-yes').addEventListener('click', function () { var f = confirmYes; closeOverlay($('confirm')); if (f) f(); });

  function syncMenu() {
    document.querySelectorAll('input[name=speed]').forEach(function (r) { r.checked = r.value === settings.speed; });
    $('opt-motion').checked = settings.motion;
    $('opt-sound').checked = settings.sound;
  }
  function applySettings() {
    Store.saveSettings(settings);
    Stage.setReducedMotion(reduced());
    if (assets) assets.setSound(settings.sound);
  }
  $('btn-menu').addEventListener('click', function () { syncMenu(); openOverlay($('menu')); });
  $('btn-menu-close').addEventListener('click', function () { closeOverlay($('menu')); });
  document.querySelectorAll('input[name=speed]').forEach(function (r) {
    r.addEventListener('change', function () { settings.speed = r.value; applySettings(); });
  });
  $('opt-motion').addEventListener('change', function (e) { settings.motion = e.target.checked; applySettings(); });
  $('opt-sound').addEventListener('change', function (e) {
    settings.sound = e.target.checked; applySettings();
    if (settings.sound) sound('tap');
  });
  $('btn-menu-home').addEventListener('click', function () { closeOverlay($('menu')); save(); home(); });
  $('btn-menu-restart').addEventListener('click', function () {
    $('menu').hidden = true;
    ask('처음부터 다시 할까요?', '지금까지의 선택과 작성한 글이 지워져요.', '처음부터 다시', function () { Store.clearProgress(); start(null); });
  });
  $('btn-menu-wipe').addEventListener('click', function () {
    $('menu').hidden = true;
    ask('이 게임 기록을 지울까요?', '진행, 작성한 글, 완료 기록, 설정이 지워져요. 다른 게임 기록은 그대로예요.', '기록 지우기', function () {
      Store.clearAll(); progress = null; settings = Store.loadSettings(); applySettings(); home(); toast('이 게임 기록을 지웠어요.');
    });
  });

  // 창 안에서만 Tab이 돌도록, Esc로 닫기
  document.addEventListener('keydown', function (e) {
    var open = !$('confirm').hidden ? $('confirm') : !$('menu').hidden ? $('menu') : null;
    if (open) {
      if (e.key === 'Escape') { e.preventDefault(); closeOverlay(open); return; }
      if (e.key === 'Tab') {
        var f = open.querySelectorAll('button, input');
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      return;
    }
    var tag = e.target.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (choose && /^[1-4]$/.test(e.key)) { e.preventDefault(); choose(Number(e.key)); return; }
    // 버튼·링크에 초점이 있으면 Space/Enter는 그 버튼이 받는다
    if (tag === 'BUTTON' || tag === 'SUMMARY' || tag === 'A') return;
    if ((e.key === ' ' || e.key === 'Enter') && primary) { e.preventDefault(); primary(); }
  });

  // ── 시작 ──
  async function boot() {
    try {
      assets = await window.EthicityAssets.load(window.ETHICITY_COMMON_MANIFEST, COMMON);
    } catch (err) {
      var box = $('loading');
      box.className = 'ee-notice dv-card';
      box.replaceChildren(
        h('p', { text: '그림을 불러오지 못했습니다. 새로고침하면 다시 확인합니다.' }),
        h('button', { type: 'button', class: 'ee-button', onclick: function () { location.reload(); } }, ['새로고침'])
      );
      return;
    }
    Stage.init($('stage'), assets);
    applySettings();
    home();
    emit('ethicity:ready');
  }

  boot();
})();
