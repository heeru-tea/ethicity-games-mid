// 시작 — 공통 자산 불러오기, 시작 화면(위원 고르기), 메뉴·설정, 가로 모드 안내, 결과 화면.
(function (root) {
  'use strict';
  var BASE = '../shared/ethicity-elementary-common-v1';
  var D = root.RightsData, UI = root.RightsUI, Stage = root.RightsStage, P = root.RightsPanels, Flow = root.RightsFlow, Store = root.RightsStore;
  var el = UI.el, $ = UI.$;
  var A = null, hero = null, settings = null, rotateDismissed = false;

  function loadSettings() {
    var reduce = false;
    try { reduce = root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* 무시 */ }
    var s = Store.read('settings', null) || {};
    return { textSpeed: s.textSpeed || 'normal', reduceMotion: s.reduceMotion == null ? reduce : !!s.reduceMotion, sound: !!s.sound };
  }
  function applySettings() {
    document.body.classList.toggle('r-reduce', settings.reduceMotion);
    Stage.setReduced(settings.reduceMotion);
    if (A) A.setSound(settings.sound);
    Store.write('settings', settings);
  }

  // ── 시작 화면 ───────────────────────────────────────────
  function buildPicker() {
    var box = $('hero-pick'), M = root.ETHICITY_COMMON_MANIFEST.characters;
    box.replaceChildren();
    D.STUDENTS.forEach(function (id) {
      var b = el('button', { type: 'button', class: 'r-hero', 'aria-pressed': 'false', 'data-id': id }, UI.figure(id, 72), el('span', null, M[id].name));
      b.addEventListener('click', function () {
        hero = id;
        Array.prototype.forEach.call(box.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        $('pick-msg').hidden = true;
        A.playSound('tap');
      });
      box.appendChild(b);
    });
  }
  function refreshStart() {
    var saved = Flow.load();
    $('btn-continue').hidden = !(saved && !saved.done);
    $('btn-result').hidden = !(saved && saved.done);
    if (saved && !saved.done) {
      var M = root.ETHICITY_COMMON_MANIFEST.characters;
      $('btn-continue').textContent = '이어 하기 (' + M[saved.hero].name + ' 위원)';
    }
  }
  function notice() {
    return new Promise(function (resolve) {
      var entry = UI.openPanel([
        el('p', { class: 'r-eyebrow' }, '시작하기 전에'),
        el('h2', { class: 'r-title' }, '이 게임의 자료는 모두 가상이에요'),
        el('ul', { class: 'r-list' },
          el('li', null, '윤리시티, 시민복합센터, 공공기관, 등장인물과 사례는 모두 수업을 위해 만든 가상 상황이에요.'),
          el('li', null, '정확도·오류율 같은 수치도 학습용 가상 데이터예요. 실제 안면인식 기술의 성능은 알고리즘·촬영 환경·데이터·평가 방법·사용 목적에 따라 달라져요.'),
          el('li', null, '특정 집단에서 항상 같은 오류가 생긴다고 일반화하지 않아요. 기술적으로 가능하다고 해서 법적·윤리적으로 허용되는 것도 아니에요.'),
          el('li', null, '실제 이름이나 얼굴 사진은 필요하지 않아요.')),
        el('div', { class: 'r-actions' }, UI.button('확인했어요', { onClick: function () { UI.closePanel(entry); resolve(); } }))
      ], { label: '가상 자료 안내' });
    });
  }
  async function startNew() {
    if (!hero) { $('pick-msg').hidden = false; $('hero-pick').firstChild.focus(); return; }
    var saved = Flow.load();
    if (saved && !saved.done && !(await UI.confirm('새로 시작할까요?', '진행 중인 심의 기록이 지워지고 처음부터 시작해요.', '새로 시작'))) return;
    Store.remove('progress');
    await notice();
    begin({ hero: hero });
  }
  function begin(opts) {
    $('screen-start').hidden = true;
    $('screen-end').hidden = true;
    opts.assets = A; opts.settings = settings; opts.onFinish = showEnd;
    Flow.start(opts).catch(function (e) { console.error(e); UI.say('진행 중 문제가 생겼어요. 새로고침하면 저장된 곳부터 이어 할 수 있어요.'); });
    checkRotate();
  }

  // ── 무대 버튼 · 메뉴 ────────────────────────────────────
  function bindStage() {
    $('btn-act').addEventListener('click', function () { Stage.act(); });
    $('btn-go').addEventListener('click', function () { if (!Stage.toTarget()) UI.say('지금은 대화나 자료를 먼저 확인해 주세요.'); });
    $('btn-map').addEventListener('click', async function () {
      if (Flow.travel && document.body.classList.contains('r-free')) { Flow.travel(); return; }
      await P.map(Flow.room(), null);
    });
    $('btn-book').addEventListener('click', async function () {
      var S = Flow.state();
      for (;;) {
        var pick = await P.notebook(S ? S.cards : []);
        if (!pick) return;
        await P.viewCard(pick.open);
      }
    });
    $('btn-menu').addEventListener('click', menu);
    document.querySelectorAll('[data-icon]').forEach(function (n) { n.replaceWith(UI.icon(n.getAttribute('data-icon'), 24)); });
  }
  function menu() {
    var entry;
    function close() { UI.closePanel(entry); }
    function radio(value, label) {
      var input = el('input', { type: 'radio', name: 'speed', value: value });
      input.checked = settings.textSpeed === value;
      input.addEventListener('change', function () { settings.textSpeed = value; applySettings(); });
      return el('label', { class: 'r-opt' }, input, label);
    }
    function check(key, label) {
      var input = el('input', { type: 'checkbox' });
      input.checked = !!settings[key];
      input.addEventListener('change', function () {
        settings[key] = input.checked; applySettings();
        if (key === 'sound' && input.checked) A.playSound('tap');
      });
      return el('label', { class: 'r-opt' }, input, label);
    }
    var playing = !$('stage').hidden;
    entry = UI.openPanel([
      el('h2', { class: 'r-title' }, '메뉴'),
      el('fieldset', { class: 'r-set' }, el('legend', null, '대사 나오는 속도'), radio('normal', '보통'), radio('fast', '빠르게'), radio('instant', '한 번에')),
      el('fieldset', { class: 'r-set' }, el('legend', null, '화면과 소리'), check('reduceMotion', '움직임 줄이기 (화면 효과 멈추기)'), check('sound', '효과음 켜기')),
      el('div', { class: 'r-menu-actions' },
        playing ? UI.button('처음 화면으로 (진행은 저장됨)', { secondary: true, icon: 'home', onClick: function () { location.reload(); } }) : null,
        UI.button('처음부터 다시 하기', { secondary: true, icon: 'retry', onClick: async function () {
          if (await UI.confirm('처음부터 다시 할까요?', '이 게임의 진행 기록을 지우고 시작 화면으로 돌아가요.', '다시 하기')) { Store.remove('progress'); location.reload(); }
        } }),
        UI.button('이 게임 기록 지우기', { secondary: true, icon: 'close', onClick: async function () {
          if (await UI.confirm('기록을 지울까요?', '이 게임의 진행·결정·권고안과 설정을 지워요. 공통 그림과 다른 게임의 기록은 그대로예요.', '지우기')) { Store.remove('progress'); Store.remove('settings'); location.reload(); }
        } })),
      el('p', { class: 'r-mute' }, '기록은 이 기기의 브라우저에만 있어요.'),
      el('div', { class: 'r-actions' }, UI.button('닫기', { onClick: close }))
    ], { label: '메뉴', onEscape: close });
  }

  // 세로 휴대폰에서 무대가 보일 때만 가로 모드를 권한다(막지는 않음).
  function checkRotate() {
    var show = !rotateDismissed && !$('stage').hidden && root.innerHeight > root.innerWidth && root.innerWidth < 760;
    $('rotate').hidden = !show;
    if (show && !$('rotate').contains(document.activeElement)) $('btn-rotate-ok').focus();
  }

  // ── 결과 화면 ───────────────────────────────────────────
  function endingKeys(S) {
    var finals = [1, 2, 3].map(function (c) { return S.ch[c].final; });
    var intro = finals.filter(function (f) { return f.pick !== 'no'; }).length;
    var changed = finals.filter(function (f) { return f.changed; }).length;
    return [intro >= 2 ? 'cautious' : 'rights', changed >= 2 ? 'grew' : 'kept'];
  }
  function showEnd(S) {
    var sec = $('screen-end'), names = Flow.namesFor(S.hero);
    var whyAll = [];
    [1, 2, 3].forEach(function (c) { if (S.ch[c].final.changed) S.ch[c].final.why.forEach(function (w) { if (whyAll.indexOf(w) < 0) whyAll.push(w); }); });
    var value = function (k) { var o = D.VALUE.options.filter(function (x) { return x[0] === S.prologue[k]; })[0]; return o ? o[1] : '—'; };
    var text = S.rec ? P.recText(S.rec) : '';
    var copyMsg = el('p', { class: 'r-mute', role: 'status' });

    sec.replaceChildren(el('div', { class: 'r-end-inner' },
      el('p', { class: 'r-eyebrow' }, '윤리시티 AI 윤리위원회 · 심의 완료'),
      el('h1', { id: 'end-title', class: 'r-logo r-end-title', tabindex: '-1' }, D.CLOSING[0]),
      D.CLOSING.slice(1).map(function (t) { return el('p', { class: 'r-lead' }, t); }),
      el('p', { class: 'ee-success r-remember' }, el('span', { class: 'r-eyebrow' }, '기억할 한 문장'), el('strong', null, D.REMEMBER)),

      el('h2', null, '이번 심의에서 보인 판단의 특징'),
      el('div', { class: 'r-endings' }, endingKeys(S).map(function (k) {
        var E = D.ENDINGS[k];
        return el('article', { class: 'ee-panel r-ending' }, el('h3', null, E.title), el('p', null, E.body),
          k === 'grew' && whyAll.length ? el('p', { class: 'r-mute' }, '내가 고른 변화의 이유: ' + whyAll.join(', ')) : null);
      })),
      el('p', { class: 'ee-notice' }, '이 특징은 너의 성격이나 등급이 아니야. 이번 심의에서 고른 선택과 근거가 만든 모습일 뿐이야.'),

      el('h2', null, '우리가 발견한 것'),
      el('ol', { class: 'r-found' },
        el('li', null, el('strong', null, '건물 출입 — 공정성 발견. '), 'AI가 정확하더라도 모든 사람에게 공정하지 않을 수 있다. ', el('span', { class: 'ee-badge' }, D.CHAPTERS[1].principle)),
        el('li', null, el('strong', null, '채용 — 피해의 심각성 이해. '), 'AI의 오류가 개인의 중요한 기회와 권리를 제한할 수 있다. ', el('span', { class: 'ee-badge' }, D.CHAPTERS[2].principle)),
        el('li', null, el('strong', null, '치안 — 도입의 정당성 판단. '), '정확도가 높더라도 모든 활용이 정당한 것은 아니다. ', el('span', { class: 'ee-badge' }, D.CHAPTERS[3].principle))),

      el('h2', null, '선택 경로'),
      el('div', { class: 'r-table-wrap' }, el('table', { class: 'r-table' },
        el('thead', null, el('tr', null, ['', '처음', '마지막', '그때 고를 수 있었던 다른 선택'].map(function (t) { return el('th', { scope: 'col' }, t); }))),
        el('tbody', null,
          el('tr', null, el('th', { scope: 'row' }, '가치 판단'), el('td', null, value('first')), el('td', null, value('again')), el('td', { class: 'r-mute' }, D.VALUE.options.filter(function (o) { return o[0] !== S.prologue.again; }).map(function (o) { return o[1]; }).join(' / '))),
          [1, 2, 3].map(function (c) {
            var r = S.ch[c];
            return el('tr', null, el('th', { scope: 'row' }, D.CHAPTERS[c].title), el('td', null, '✓ ' + P.policyLabel(r.first.pick)), el('td', null, '✓ ' + P.policyLabel(r.final.pick) + (r.final.changed ? ' (변경)' : ' (유지)')),
              el('td', { class: 'r-mute' }, D.POLICY.filter(function (p) { return p.id !== r.final.pick; }).map(function (p) { return p.label; }).join(' / ') + (c === 3 && r.scope ? ' · 활용 범위 대안 ' + r.scope.pick : '')));
          })))),

      el('h2', null, '나의 정책 권고안'),
      el('pre', { class: 'ee-panel r-rec-text', id: 'print-area' }, text),
      el('div', { class: 'r-actions r-left' },
        UI.button('권고안 복사', { onClick: function () { copy(text, copyMsg); } }),
        UI.button('활동지로 인쇄', { secondary: true, icon: 'notebook', onClick: function () { root.print(); } })),
      copyMsg,

      el('h2', null, '교실 토론 질문'),
      el('ol', { class: 'r-q' }, D.DISCUSS.basic.map(function (q) { return el('li', null, q); })),
      el('h3', null, '더 깊이 ', el('span', { class: 'ee-badge' }, '심화 토론')),
      el('ol', { class: 'r-q' }, D.DISCUSS.deep.map(function (q) { return el('li', null, q); })),
      el('p', { class: 'r-mute' }, '토론 답은 어디에도 저장되거나 보내지 않아요. 짝이나 모둠과 말로 나눠 보세요.'),

      el('h2', null, '다음 탐험'),
      el('p', null, names.hero + ' 위원의 심의는 여기까지예요. 다른 결정을 골라 다시 심의해 보면, 같은 증거가 어떻게 다르게 보이는지 확인할 수 있어요.'),
      el('div', { class: 'r-actions r-left' },
        UI.button('처음 화면', { secondary: true, icon: 'home', onClick: function () { location.reload(); } }),
        UI.button('다른 판단으로 다시 심의하기', { onClick: async function () {
          if (await UI.confirm('다시 심의할까요?', '지금 결과와 권고안이 지워져요. 필요하면 먼저 복사하거나 인쇄해 두세요.', '다시 하기')) { Store.remove('progress'); location.reload(); }
        } }))
    ));
    $('stage').hidden = true;
    $('screen-start').hidden = true;
    sec.hidden = false;
    $('rotate').hidden = true;
    root.scrollTo(0, 0);
    $('end-title').focus();
    Flow.emit('complete', { result: { completed: true } });
  }
  function copy(text, msg) {
    function fallback() {
      var t = el('textarea', { class: 'r-sr' }); t.value = text; document.body.appendChild(t); t.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      t.remove();
      msg.textContent = ok ? '권고안을 복사했어요.' : '복사하지 못했어요. 글을 직접 선택해 복사해 주세요.';
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { msg.textContent = '권고안을 복사했어요.'; }, fallback);
    else fallback();
  }

  // ── 시작 ────────────────────────────────────────────────
  async function boot() {
    settings = loadSettings();
    bindStage();
    $('btn-new').addEventListener('click', startNew);
    $('btn-continue').addEventListener('click', function () { var s = Flow.load(); if (s) begin({ state: s }); });
    $('btn-result').addEventListener('click', function () { var s = Flow.load(); if (s) showEnd(s); });
    $('btn-rotate-ok').addEventListener('click', function () { rotateDismissed = true; checkRotate(); Stage.resize(); });
    root.addEventListener('resize', checkRotate);
    root.addEventListener('orientationchange', checkRotate);
    $('btn-new').disabled = true;
    try {
      A = await root.EthicityAssets.load(root.ETHICITY_COMMON_MANIFEST, BASE);
    } catch (e) {
      $('load-msg').textContent = '공통 그림을 불러오지 못했어요. 폴더 구성(shared/ethicity-elementary-common-v1)을 확인해 주세요. ' + e.message;
      return;
    }
    try { await document.fonts.load('700 20px Ethicity'); } catch (e) { /* 글꼴은 대체 글꼴로 */ }
    UI.setAssets(A);
    Stage.init(A);
    P.setFx(Flow.fx);
    applySettings();
    // 불러오기 전에 만든 HUD 아이콘을 다시 그린다
    document.querySelectorAll('canvas.r-icon').forEach(function (c) { A.drawIcon(c.getContext('2d'), c.getAttribute('data-id'), 0, 0, c.width); });
    buildPicker();
    refreshStart();
    $('btn-new').disabled = false;
    $('load-msg').hidden = true;
    Flow.emit('ready');
  }
  boot();
})(window);
