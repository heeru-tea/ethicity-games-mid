/*
 * 효과음 = 공통 팩(shared/ethicity-elementary-common-v1/effects/audio) WAV 7종을 그대로 쓴다(사본 없음).
 * 공통 런타임 playSound와 같은 규칙: 기본 꺼짐(메뉴 "효과음 켜기"), 볼륨 0.45.
 * 쓰임: paper = 메시지 도착 · tap = 선택 · door = 문 드나들기 · collect = 장 마무리 · win = 엔딩 도착 · retry = 되돌리기/처음부터.
 * 같은 소리는 겹쳐 울리지 않게 짧게 거른다. 재생을 못 하는 환경(자동재생 막힘·파일 없음)이면 조용히 넘어간다.
 */
(function (root) {
  'use strict';

  var BASE = '../shared/ethicity-elementary-common-v1/effects/audio/';
  var IDS = ['collect', 'miss', 'tap', 'door', 'win', 'paper', 'retry'];
  var on = false, last = {}, cache = {};

  function play(id) {
    if (!on || IDS.indexOf(id) < 0) return false;
    var now = Date.now();
    if (now - (last[id] || 0) < 150) return false; // 여러 줄이 한꺼번에 와도 한 번만
    last[id] = now;
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

  root.PrivacySfx = { play: play, setEnabled: function (v) { on = !!v; }, ids: IDS, base: BASE };
})(window);
