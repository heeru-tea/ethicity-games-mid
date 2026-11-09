/*
 * 인물 그림 = 윤리시티 공통 팩(ethicity-elementary-common-v1) 공식 캐릭터.
 *   주인공 m/f → 온유(onyu)/다온(daon), 새봄·지호·하늘·교사 = 공식 ID 그대로, 루미(가상 AI) → robot.
 *   민준·옆 반 친구(friend)는 이 게임 전용 인물이라 같은 규격·화풍으로 만든 assets/characters-official/ 그림을 쓴다.
 * 규격(공통 팩 manifest): 걷기 시트 384×512 = 칸 96×128 × 4프레임 × 아래·왼·오·위, 발 기준점 (48,120), 정지 프레임 1
 *                       초상화 1024×256 = 256×256 × neutral·happy·worried·explaining
 * 공통 팩 파일은 복사·변형하지 않고 그대로 불러 CSS·canvas에서 칸만 잘라 쓴다.
 */
(function () {
  'use strict';
  var BASE = '../shared/ethicity-elementary-common-v1/characters/';
  var OWN = 'assets/characters-official/';
  var OFFICIAL = { saebom: 1, jiho: 1, haneul: 1, onyu: 1, daon: 1, teacher: 1, robot: 1 };
  var CUSTOM = { minjun: 1, friend: 1 };
  var LOOK = { m: 'onyu', f: 'daon' };
  var EXPR = ['neutral', 'happy', 'worried', 'explaining'];

  // 이야기 속 인물(who) → 그림 ID. 그림이 없는 인물(보호자·낯선 계정 등)은 null
  function id(who, look) {
    if (who === 'me') return LOOK[look] || null;
    if (who === 'lumi') return 'robot';
    return OFFICIAL[who] || CUSTOM[who] ? who : null;
  }
  function dir(i) { return CUSTOM[i] ? OWN : BASE; }
  // 2026-11-02: 같은 그림의 webp 사본(tools/to-webp.mjs, q0.9 · 크기 그대로)이 있으면 그 주소 — PNG 4.8MB → 1.6MB. 공통 팩 원본은 그대로
  function web(p) { return window.PrivacyImg ? window.PrivacyImg.src(p) : p; }
  function walk(who, look) { var i = id(who, look); return i ? web(dir(i) + i + '-walk.png') : null; }
  function portraits(who, look) { var i = id(who, look); return i ? web(dir(i) + i + '-portraits.png') : null; }
  function sleep() { return web(OWN + 'minjun-sleep.png'); }

  // 첫 등장 때 내려받기·디코딩을 시작하지 않도록 시작 화면에서 두 장씩 준비한다.
  // 이미지 참조를 보관하고, 지도에서는 준비된 시트를 바로 재사용한다.
  var prepared = {}, warming = false;
  function ready(src) { return prepared[src] || null; }
  function warm() {
    if (warming || (navigator.connection && navigator.connection.saveData)) return;
    warming = true;
    var ids = ['onyu', 'daon', 'saebom', 'jiho', 'haneul', 'teacher', 'minjun', 'friend', 'robot'];
    var queue = [];
    ids.forEach(function (who) { queue.push(walk(who), portraits(who)); });
    queue.push(sleep());
    function next() {
      var src = queue.shift();
      if (!src) return;
      var im = new Image();
      im.fetchPriority = 'low';
      function finish(ok) {
        im.onload = im.onerror = null;
        if (ok) prepared[src] = im;
        setTimeout(next, 0);
      }
      im.onload = function () {
        if (im.decode) im.decode().then(function () { finish(true); }, function () { finish(false); });
        else finish(true);
      };
      im.onerror = function () { finish(false); };
      im.src = src;
    }
    next(); next();
  }
  function scheduleWarm() {
    if (window.requestIdleCallback) window.requestIdleCallback(warm, { timeout: 500 });
    else setTimeout(warm, 0);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleWarm);
  else scheduleWarm();

  // 초상화 시트의 한 칸을 요소 배경으로(정사각형 요소 기준)
  function paintPortrait(node, who, look, expr) {
    var src = portraits(who, look);
    if (!src) return false;
    var k = Math.max(0, EXPR.indexOf(expr || 'neutral'));
    node.style.backgroundImage = 'url("' + src + '")';
    node.style.backgroundSize = '400% 100%';
    node.style.backgroundPosition = (k * 100 / 3) + '% 0';
    node.style.backgroundRepeat = 'no-repeat';
    node.style.imageRendering = 'pixelated';
    return true;
  }

  window.PrivacyCast = {
    id: id, walk: walk, portraits: portraits, sleep: sleep, paintPortrait: paintPortrait, ready: ready,
    LOOK: LOOK, CELL: { w: 96, h: 128, ax: 48, ay: 120, body: 112 }, STOP_FRAME: 1
  };
})();
