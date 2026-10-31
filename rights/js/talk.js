// 대화창 — 같은 캐릭터 ID의 공통 초상화 + .ee-speech. 한 줄씩 넘기고, 대화 전체를 건너뛸 수 있다.
(function (root) {
  'use strict';
  var UI = root.RightsUI;
  var ROLE = { teacher: '선생님 · 사무국장', librarian: '사서 · 시설 관리자', robot: '안내 로봇' };
  var SPEED = { normal: 28, fast: 10, instant: 0 };
  var state = null;

  function speakerOf(who, names) {
    var id = who === 'hero' || who === 'A' || who === 'B' ? names.ids[who] : who;
    return { id: id, name: ROLE[id] || root.RightsData.nameOf(id) };
  }

  // lines: [[말하는 사람, 표정, 글], ...] → 모두 넘기면 끝나는 Promise
  function run(lines, names, speed) {
    return new Promise(function (resolve) {
      var talk = UI.$('talk');
      state = { lines: lines, i: -1, names: names, speed: SPEED[speed] == null ? 28 : SPEED[speed], timer: 0, full: '', typing: false, resolve: resolve };
      talk.hidden = false;
      document.body.classList.add('r-talking');
      next();
      UI.$('talk-next').focus({ preventScroll: true });
    });
  }
  function show(line) {
    var sp = speakerOf(line[0], state.names), por = UI.$('talk-portrait');
    por.replaceChildren(UI.portrait(sp.id, line[1], 112));
    UI.$('talk-name').textContent = sp.name;
    state.full = UI.fill(line[2], state.names);
    UI.$('talk-live').textContent = sp.name + ': ' + state.full;
    var text = UI.$('talk-text');
    clearInterval(state.timer);
    if (!state.speed || document.body.classList.contains('r-reduce')) { text.textContent = state.full; state.typing = false; return; }
    var n = 0;
    state.typing = true;
    text.textContent = '';
    state.timer = setInterval(function () {
      n += 1;
      text.textContent = state.full.slice(0, n);
      if (n >= state.full.length) { clearInterval(state.timer); state.typing = false; }
    }, state.speed);
  }
  function next() {
    if (!state) return;
    if (state.typing) { clearInterval(state.timer); UI.$('talk-text').textContent = state.full; state.typing = false; return; }
    state.i += 1;
    if (state.i >= state.lines.length) { finish(); return; }
    show(state.lines[state.i]);
  }
  function finish() {
    if (!state) return;
    clearInterval(state.timer);
    var done = state.resolve;
    state = null;
    UI.$('talk').hidden = true;
    UI.$('talk-live').textContent = '';
    document.body.classList.remove('r-talking');
    done();
  }

  document.addEventListener('DOMContentLoaded', function () {
    UI.$('talk-next').addEventListener('click', next);
    UI.$('talk-skip').addEventListener('click', finish);
    UI.$('talk-text').addEventListener('click', next);
  });
  document.addEventListener('keydown', function (e) {
    if (!state || document.body.classList.contains('r-modal-open')) return;
    if ((e.key === ' ' || e.key === 'Enter') && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); next(); }
  });

  root.RightsTalk = { run: run, isOpen: function () { return !!state; } };
})(window);
