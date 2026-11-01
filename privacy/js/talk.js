/*
 * 포켓몬식 대화창 — 맵 아래쪽 상자에 한 줄씩. ▼(Enter·Space·클릭)로 다음 줄.
 *   PrivacyTalk.open([{ who, name, text }], { instant, onLine }) → Promise (마지막 줄을 넘기면 끝)
 *   who·name이 없으면 이름 탭 없이(해설·안내). instant면 모든 줄을 한 상자에 쌓고 한 번에 넘긴다.
 * 한 줄씩일 때는 글자가 주르륵 쳐진다(typer.js). 누르기 한 번 = 치는 중이면 그 줄을 다 보여 주기, 다 보였으면 다음 줄.
 *   (다 보인 줄에서 누른 것을 버리지 않는다.) 화면 읽기 프로그램에는 다 쳐진 줄을 한 번만 읽힌다(.talk-live).
 * 글자는 textContent로만 넣는다.
 */
(function () {
  'use strict';

  var box = null, nameEl, textEl, nextBtn, portraitEl, liveEl;
  var lines = [], idx = 0, opts = {}, done = null, typing = null;

  function $(id) { return document.getElementById(id); }
  function setup() {
    if (box) return;
    box = $('talk');
    nameEl = box.querySelector('.talk-name');
    textEl = box.querySelector('.talk-text');
    nextBtn = $('btn-talk-next');
    portraitEl = $('talk-portrait');
    liveEl = box.querySelector('.talk-live');
    nextBtn.addEventListener('click', function (e) { e.stopPropagation(); next(); });
    box.addEventListener('click', function () { next(); });
    // 맵(걷기·말 걸기)보다 먼저 받는다: 열려 있으면 Enter·Space는 대화 넘기기
    document.addEventListener('keydown', function (e) {
      if (!isOpen() || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target === nextBtn) return; // 버튼 자체의 클릭으로 처리
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'BUTTON' || tag === 'INPUT') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      next();
    }, true);
  }

  function para(line) {
    var p = document.createElement('p');
    if (opts.stack && line.name) {
      var b = document.createElement('b');
      b.textContent = line.name + ': ';
      p.appendChild(b);
    }
    p.appendChild(document.createTextNode(line.text));
    return p;
  }

  function announce(text) { if (liveEl) liveEl.textContent = text; }
  function spoken(line) { return (line.name ? line.name + ': ' : '') + line.text; }

  function showLine() {
    var line = lines[idx];
    nameEl.hidden = !line.name;
    nameEl.textContent = line.name || '';
    textEl.textContent = '';
    var p = para(line);
    textEl.appendChild(p);
    textEl.setAttribute('aria-hidden', 'true'); // 치는 동안 한 글자씩 읽히지 않게
    showPortrait(line.who);
    if (opts.onLine) opts.onLine(line, idx);
    var h = window.PrivacyTyper ? window.PrivacyTyper.start(p, line.text, function () { typing = null; lineShown(line); }) : null;
    typing = h && h.active ? h : null;
    if (!h) lineShown(line);
  }
  function lineShown(line) { textEl.removeAttribute('aria-hidden'); announce(spoken(line)); }
  function typingNow() { return !!(typing && typing.active); }

  // opts.portrait(who) → { who, look, expr }(공통 팩 초상화 시트의 한 칸) 또는 null. 대화창 바로 위에 세운다
  function showPortrait(who) {
    if (!portraitEl) return;
    var p = opts.portrait && !opts.stack && who ? opts.portrait(who) : null;
    if (!p || !window.PrivacyCast.paintPortrait(portraitEl, p.who, p.look, p.expr)) { portraitEl.hidden = true; return; }
    var stage = box.offsetParent || box.parentNode;
    portraitEl.style.bottom = (stage.clientHeight - box.offsetTop - 10) + 'px';
    portraitEl.hidden = false;
  }

  function next() {
    if (!isOpen()) return;
    if (typingNow()) { typing.finish(); return; } // 첫 누르기: 이 줄을 다 보여 준다
    if (!opts.stack && idx < lines.length - 1) { idx++; showLine(); return; }
    close();
  }

  function open(list, o) {
    setup();
    if (isOpen()) close();
    lines = (list || []).filter(function (l) { return l && l.text; });
    opts = o || {};
    opts.stack = !!opts.instant && lines.length > 1;
    idx = 0;
    if (!lines.length) return Promise.resolve();
    box.hidden = false;
    if (opts.stack) {
      nameEl.hidden = true;
      textEl.textContent = '';
      textEl.removeAttribute('aria-hidden');
      lines.forEach(function (l, i) { textEl.appendChild(para(l)); if (opts.onLine) opts.onLine(l, i); });
      announce(lines.map(spoken).join(' '));
      showPortrait(null);
    } else showLine();
    nextBtn.focus({ preventScroll: true }); // 키보드로 바로 넘길 수 있게
    return new Promise(function (resolve) { done = resolve; });
  }

  function close() {
    if (!box) return;
    if (typing) { typing.cancel(); typing = null; }
    textEl.removeAttribute('aria-hidden');
    if (liveEl) liveEl.textContent = '';
    box.hidden = true;
    if (portraitEl) portraitEl.hidden = true;
    lines = []; idx = 0;
    var d = done; done = null;
    if (d) d();
  }

  function isOpen() { return !!box && !box.hidden; }

  window.PrivacyTalk = { open: open, next: next, close: close, isOpen: isOpen, typing: typingNow };
})();
