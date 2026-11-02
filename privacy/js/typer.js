/*
 * 타자 효과 — 글자를 한 글자씩 "주르륵" 보여 준다. 폰 메시지(app.js)와 대화창(talk.js)이 함께 쓴다.
 *   PrivacyTyper.set({ speed, reduce })   app.js가 설정을 바꿀 때마다 알려 준다(speed: normal | fast | instant)
 *   PrivacyTyper.enabled()                지금 타자 효과를 쓰는지(한 번에 보기·움직임 줄이기·OS 동작 줄이기면 false)
 *   PrivacyTyper.start(el, text, onDone) → { active, finish(), cancel() }
 *     - 꺼져 있거나 한 글자뿐이면 바로 전체 글자를 넣고 onDone을 곧장 부른다(active=false).
 *     - finish(): 지금 바로 다 보여 주고 onDone. cancel(): 다 보여 주되 onDone은 부르지 않음(화면을 떠날 때).
 *   보통 글자당 30ms, 긴 메시지도 1.5초 안에 끝나게 글자당 시간을 줄인다(빠르게: 12ms·0.6초).
 *   아직 안 쳐진 글자는 투명하게 자리만 차지해(.type-rest) 말풍선 크기·줄바꿈이 처음부터 그대로다.
 *   느린 타이머에서도 속도가 같도록, 흐른 시간으로 몇 글자까지 보일지 계산한다.
 * 글자 속 [[…]] = 강조(emph.js): 치는 동안에도 굵은 글씨로 나오고 [[ ]] 기호는 보이지 않는다. 글자 수는 기호를 뺀 글자로 센다.
 * 글자는 textContent·text node로만 넣는다(HTML로 해석하지 않음).
 */
(function (root) {
  'use strict';

  var RATE = { normal: { ms: 30, cap: 1500 }, fast: { ms: 12, cap: 600 } };
  var state = { speed: 'normal', reduce: false };

  function osReduce() {
    try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  function enabled() { return !!RATE[state.speed] && !state.reduce && !osReduce(); }
  function now() { return root.performance && performance.now ? performance.now() : Date.now(); }
  function chars(text) { return Array.from ? Array.from(text) : String(text).split(''); } // 이모지가 반으로 잘리지 않게
  // 강조 표시를 살려 from~to 글자만 그린다(emph.js가 없으면 맨 글자)
  function draw(el, text, from, to) {
    if (root.PrivacyEmph) { root.PrivacyEmph.render(el, text, from, to); return; }
    el.textContent = chars(text).slice(from || 0, to == null ? undefined : to).join('');
  }
  function plainOf(text) { return root.PrivacyEmph ? root.PrivacyEmph.plain(text) : text; }

  function start(el, text, onDone) {
    text = String(text == null ? '' : text);
    var h = { active: false, finish: function () {}, cancel: function () {} };
    var cs = chars(plainOf(text));
    if (!enabled() || cs.length < 2) { draw(el, text); if (onDone) onDone(); return h; }
    var r = RATE[state.speed];
    var per = Math.min(r.ms, r.cap / cs.length);
    var shown = document.createElement('span'), rest = document.createElement('span');
    rest.className = 'type-rest';
    rest.setAttribute('aria-hidden', 'true');
    el.textContent = '';
    el.appendChild(shown);
    el.appendChild(rest);
    var t0 = now(), n = -1, timer = null;
    function paint(k) {
      if (k === n) return;
      n = k;
      draw(shown, text, 0, k);
      draw(rest, text, k, cs.length);
    }
    function settle() { clearTimeout(timer); timer = null; h.active = false; draw(el, text); }
    function tick() {
      timer = null;
      var k = Math.min(cs.length, 1 + Math.floor((now() - t0) / per));
      paint(k);
      if (k >= cs.length) { h.finish(); return; }
      timer = setTimeout(tick, Math.max(10, per));
    }
    h.active = true;
    h.finish = function () { if (!h.active) return; settle(); if (onDone) onDone(); };
    h.cancel = function () { if (h.active) settle(); };
    paint(1);
    timer = setTimeout(tick, Math.max(10, per));
    return h;
  }

  root.PrivacyTyper = {
    set: function (o) { if (o.speed) state.speed = o.speed; if ('reduce' in o) state.reduce = !!o.reduce; },
    enabled: enabled,
    start: start,
    RATE: RATE
  };
})(typeof window !== 'undefined' ? window : globalThis);
