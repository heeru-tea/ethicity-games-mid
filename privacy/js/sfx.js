/*
 * 효과음 = 공통 팩(shared/ethicity-elementary-common-v1/effects/audio) WAV 7종을 그대로 쓴다(사본 없음)
 *        + 메시지 알림음 2종은 파일 없이 Web Audio로 합성(2026-11-02, 아래 SYNTH).
 * 기본 켜짐(2026-11-02 사용자 결정 — 저장 규칙은 app.js), 메뉴 "효과음"으로 끈다. WAV 볼륨 0.45.
 * 쓰임: msg = 폰·모니터 창이 열리고 첫 메시지가 올 때 · tick = 같은 창에 이어서 오는 메시지 · tap = 선택 · door = 문 드나들기
 *       · collect = 장 마무리 · win = 엔딩 도착 · retry = 되돌리기/처음부터. (paper는 예전 메시지 소리 — 합성이 안 되는 환경의 대신 소리)
 * 같은 소리는 겹쳐 울리지 않게 150ms 안에 한 번만(msg·tick은 한 묶음). 재생을 못 하는 환경(자동재생 막힘·파일 없음)이면 조용히 넘어간다.
 */
(function (root) {
  'use strict';

  var BASE = '../shared/ethicity-elementary-common-v1/effects/audio/';
  var IDS = ['collect', 'miss', 'tap', 'door', 'win', 'paper', 'retry'];
  var on = false, last = {}, cache = {};

  /* ── 메시지 알림음(합성) ─────────────────────────────
   * msg  = 부드러운 두 음 '띵–동'(A5 880Hz → E6 1319Hz, 위로 5도, 0.3초). 사인파 + 아주 옅은 배음, 빠른 시작·짧은 감쇠.
   *        카카오톡 알림(“카톡!” 목소리)·아이폰 트라이톤과 겹치지 않는 평범한 실로폰풍 — 교실 30명이라 작게.
   * tick = 이어지는 메시지: 한 음 G6 1568Hz, 0.08초, msg의 절반쯤 크기.
   * 휴대폰 브라우저는 사용자 입력 안에서 깨운 AudioContext만 소리를 낸다 → 첫 pointerdown·touchend·keydown에서 만들고 resume +
   * 무음 한 번 재생(iOS). 돌아가기 시작하면 듣기를 멈춘다(publicness 휴대폰 효과음과 같은 방식). */
  var ctx = null, SYNTH = { msg: 1, tick: 1 };
  function audioCtx() {
    if (!ctx) { var C = root.AudioContext || root.webkitAudioContext; if (!C) return null; try { ctx = new C(); } catch (e) { return null; } }
    return ctx;
  }
  var UNLOCK = ['pointerdown', 'touchend', 'keydown'];
  function unlock() {
    var a = audioCtx(); if (!a) return;
    try { if (a.state === 'suspended' && a.resume) a.resume(); } catch (e) { /* 다음 입력에서 다시 */ }
    try { var b = a.createBuffer(1, 1, 22050), s = a.createBufferSource(); s.buffer = b; s.connect(a.destination); s.start(0); } catch (e) { /* 무음 재생 없이 */ }
    if (a.state === 'running') UNLOCK.forEach(function (ev) { root.document.removeEventListener(ev, unlock, true); });
  }
  if (root.document) UNLOCK.forEach(function (ev) { root.document.addEventListener(ev, unlock, true); });

  function note(a, f, at, len, peak) {
    var t = a.currentTime + at;
    [[f, peak, 'sine'], [f * 2, peak * 0.12, 'sine']].forEach(function (p) { // 바탕음 + 옅은 옥타브 배음(유리·실로폰 느낌)
      var o = a.createOscillator(), g = a.createGain();
      o.type = p[2]; o.frequency.setValueAtTime(p[0], t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(p[1], t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + len + 0.02);
    });
  }
  function synth(id) {
    var a = audioCtx(); if (!a) return false;
    try {
      if (a.state === 'suspended' && a.resume) a.resume();
      if (id === 'msg') { note(a, 880, 0, 0.16, 0.11); note(a, 1318.5, 0.09, 0.22, 0.09); }
      else note(a, 1568, 0, 0.08, 0.05);
      return true;
    } catch (e) { return false; }
  }

  function wav(id) {
    try {
      var a = cache[id] || (cache[id] = new Audio(BASE + id + '.wav'));
      var s = a.paused ? a : a.cloneNode(); // 앞 소리가 아직 울리면 사본으로 겹쳐 재생
      s.volume = 0.45;
      s.currentTime = 0;
      var p = s.play();
      if (p && p.catch) p.catch(function () {});
      return true;
    } catch (e) { return false; }
  }

  function play(id, force) { // force = 거르기 없이(메뉴에서 켤 때 미리듣기)
    if (!on || (IDS.indexOf(id) < 0 && !SYNTH[id])) return false;
    var key = SYNTH[id] ? 'msg' : id; // msg·tick은 한 묶음으로 거른다(첫 소리와 바로 뒤 소리가 겹치지 않게)
    var now = Date.now();
    if (!force && now - (last[key] || 0) < 150) return false; // 여러 줄이 한꺼번에 와도 한 번만
    last[key] = now;
    if (SYNTH[id]) return synth(id) || (id === 'msg' && wav('paper')); // 합성이 안 되는 환경: 메시지 첫 소리만 예전 종이 소리로
    return wav(id);
  }

  root.PrivacySfx = { play: play, setEnabled: function (v) { on = !!v; }, isOn: function () { return on; }, ids: IDS, synth: Object.keys(SYNTH), base: BASE };
})(window);
