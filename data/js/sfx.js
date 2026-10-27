/*
 * 효과음 — 소리 파일 없이 Web Audio로 합성(file:// 오프라인). 첫 사용자 입력 뒤 AudioContext를 만든다.
 * 음소거 상태는 localStorage(실패해도 동작).
 */
(function (root) {
  'use strict';

  var KEY = 'dr.muted';
  var ctx = null;
  var muted = false;
  try { muted = root.localStorage.getItem(KEY) === '1'; } catch (e) { /* 저장소 막힘 — 기본값 */ }

  function audio() {
    if (ctx) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }

  function tone(a, freq, to, dur, type, vol, delay) {
    var t0 = a.currentTime + (delay || 0);
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(a, dur, vol) {
    var n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = vol;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(a.destination);
    src.start();
  }

  var SOUNDS = {
    grab: function (a) { tone(a, 660, 990, 0.09, 'triangle', 0.18); },
    perfect: function (a) { tone(a, 880, 0, 0.08, 'triangle', 0.16); tone(a, 1320, 0, 0.14, 'triangle', 0.14, 0.06); tone(a, 1760, 0, 0.12, 'sine', 0.08, 0.12); },
    hit: function (a) { noise(a, 0.18, 0.35); tone(a, 140, 70, 0.18, 'square', 0.08); },
    lane: function (a) { tone(a, 320, 260, 0.04, 'square', 0.04); },
    full: function (a) { tone(a, 200, 160, 0.14, 'square', 0.1); },
    ui: function (a) { tone(a, 520, 0, 0.06, 'triangle', 0.1); }
  };

  function play(name) {
    if (muted || !SOUNDS[name]) return;
    var a = audio();
    if (!a) return;
    if (a.state === 'suspended') a.resume();
    try { SOUNDS[name](a); } catch (e) { /* 소리 실패는 게임을 막지 않는다 */ }
  }

  var Sfx = {
    play: play,
    get muted() { return muted; },
    setMuted: function (m) {
      muted = !!m;
      try { root.localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) { /* 무시 */ }
    },
    unlock: function () { var a = audio(); if (a && a.state === 'suspended') a.resume(); }
  };

  root.DR = root.DR || {};
  root.DR.Sfx = Sfx;
})(window);
