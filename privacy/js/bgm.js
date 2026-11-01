/*
 * 배경음악(BGM) — 2026-11-01. 곡은 fal ElevenLabs Music(가사 없음) 5곡, assets/bgm/*.mp3:
 *   P1 아침 등굣길 = 시작 화면·등교 걷기(pro_1) / P2 축제 준비 = 낮 걷기·대화 장면 / P3 저녁 귀갓길 = 저녁 걷기·장 요약
 *   P4 렌즈 안에 갇힌 밤 = 축제 당일 밤 사건(c3_e8_c~f) / P5 우리가 고른 것 = 엔딩(한 번) / 지나온 길·성찰 화면은 무음
 * 효과음(#opt-sound)과 따로 #opt-bgm, 저장 키 ethicity.privacy.bgm('1'/'0', 기본 켜짐). 볼륨 0.14(publicness와 같은 값), 대화 장면은 0.1.
 * 화면이 바뀌면(body[data-view]) 0.6초 동안 줄였다 키움, 같은 곡이면 이어서. 탭이 숨으면 멈춤. 첫 클릭·키 입력 전에는 브라우저가 막으므로 그때 다시 시도.
 */
(function () {
  'use strict';
  var KEY = 'ethicity.privacy.bgm', VOL = 0.14, READ_VOL = 0.1, FADE = 600, DIR = 'assets/bgm/';
  var TRACK = { p1: 'p1-morning.mp3', p2: 'p2-festival-prep.mp3', p3: 'p3-after-school.mp3', p4: 'p4-night-gate.mp3', p5: 'p5-ending.mp3' };
  var NIGHT = ['c3_e8_c', 'c3_e8_d', 'c3_e8_e', 'c3_e8_f'];
  var on = read(), audio = null, cur = null, want = null, vol = VOL, fadeT = null;
  function read() { try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } }
  function write(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) { /* 이번 창에서만 */ } }
  function state() { try { return window.PrivacyApp && window.PrivacyApp.state(); } catch (e) { return null; } }
  function tintOf(st) {
    var W = window.PRIVACY_WORLD; if (!W || !st) return 'day';
    var t = st.mapTarget && W.triggers[st.mapTarget], s = st.scene && W.STAGES[st.scene];
    return (document.body.getAttribute('data-view') === 'v-map' ? (t && t.tint) : (s && s.tint)) || 'day';
  }
  // 화면 → 곡(null = 무음)
  function pick() {
    var view = document.body.getAttribute('data-view') || 'v-start', st = state();
    vol = VOL;
    if (view === 'v-start') return 'p1';
    if (view === 'v-ending') return 'p5';
    if (view === 'v-path' || view === 'v-reflect') return null;
    if (view === 'v-chapter') return 'p3';
    if (st && NIGHT.indexOf(st.scene) >= 0 && view === 'v-game') { vol = READ_VOL; return 'p4'; }
    if (view === 'v-map' && st && st.mapTarget === 'pro_1') return 'p1';
    var tint = tintOf(st);
    if (view === 'v-game') vol = READ_VOL;
    return tint === 'evening' || tint === 'night' ? 'p3' : 'p2';
  }
  function fadeTo(a, to, ms, done) {
    clearInterval(fadeT); var from = a.volume, t0 = Date.now();
    fadeT = setInterval(function () { var k = Math.min(1, (Date.now() - t0) / ms); a.volume = from + (to - from) * k; if (k >= 1) { clearInterval(fadeT); if (done) done(); } }, 40);
  }
  // 재생이 늦게 시작돼도(play() 약속) 그 사이 꺼졌으면 바로 멈춘다
  function rise() { if (!on || document.hidden || !audio) { if (audio) audio.pause(); return; } fadeTo(audio, vol, FADE); }
  function play() {
    if (!on || document.hidden) return;
    if (!want) { if (audio && !audio.paused) { var a = audio; fadeTo(a, 0, FADE, function () { a.pause(); }); } return; }
    if (audio && cur === want) { if (audio.paused) { audio.volume = 0; audio.play().then(rise, function () {}); } else fadeTo(audio, vol, FADE); return; }
    var next = function () {
      if (audio) audio.pause();
      if (!on) return;
      audio = new Audio(DIR + TRACK[want]); audio.loop = want !== 'p5'; audio.volume = 0; cur = want;
      audio.play().then(rise, function () { /* 첫 입력 전에는 막힘 — 다음 입력에서 다시 */ });
    };
    if (audio && !audio.paused) fadeTo(audio, 0, FADE, next); else next();
  }
  function stop() { clearInterval(fadeT); if (audio) audio.pause(); }
  function update() { var w = pick(); if (w === want && audio && !audio.paused && cur === w) { fadeTo(audio, vol, 300); return; } want = w; play(); }
  function set(v) { on = !!v; write(on); var c = document.getElementById('opt-bgm'); if (c) c.checked = on; if (on) update(); else stop(); }
  new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
  ['pointerdown', 'keydown'].forEach(function (t) { document.addEventListener(t, function () { if (!audio || audio.paused) update(); }, true); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { if (audio) audio.pause(); } else update(); });
  // 같은 화면 안에서 장면·걷기 목표가 바뀔 때(낮→저녁, 밤 사건) 곡을 다시 고른다
  setInterval(function () { if (on && !document.hidden && audio && !audio.paused && pick() !== cur) update(); }, 1500);
  var box = document.getElementById('opt-bgm');
  if (box) { box.checked = on; box.addEventListener('change', function () { set(box.checked); }); }
  window.PrivacyBgm = { set: set, isOn: function () { return on; }, state: function () { return { on: on, want: want, cur: cur, playing: !!(audio && !audio.paused), volume: audio ? audio.volume : 0 }; } };
})();
