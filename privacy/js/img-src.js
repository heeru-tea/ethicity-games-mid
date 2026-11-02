/*
 * 그림 주소 고르기 — tools/to-webp.mjs가 만든 목록(js/webp-list.js)에 있는 .png는 같은 자리의 .webp를 먼저 쓴다.
 *   PrivacyImg.src('assets/x.png')     → 'assets/x.webp' 또는 그대로
 *   PrivacyImg.load(img, 'assets/x.png') → webp로 불러오고, 실패하면 png로 한 번 다시
 * 원본 PNG는 그대로 두므로 webp를 못 쓰는 환경에서도 그림이 뜬다.
 */
(function () {
  'use strict';
  // 목록 값 1 = 같은 자리 .webp, 문자열 = 공통 팩 그림의 webp 사본 경로(assets/shared-webp/…)
  function src(png) { var v = (window.PRIVACY_WEBP || {})[png]; return typeof v === 'string' ? v : v ? png.replace(/\.png$/, '.webp') : png; }
  function load(im, png) {
    var w = src(png);
    if (w !== png) {
      im.addEventListener('error', function retry() {
        im.removeEventListener('error', retry);
        im.src = png;
      });
    }
    im.src = w;
  }
  /*
   * 장면 그림 미리 받기(2026-11-02) — 지도는 장면 그림을 그 장면에 처음 들어갈 때에야 요청해서,
   * 느린 학교망에선 문을 지날 때마다 빈 화면이 몇 초씩 보였다. 게임 화면이 처음 열리고 지금 장면 그림이
   * 다 내려온 뒤(최대 8초 기다림), 나머지 장면 그림(world.js SCENES, webp)을 한 장씩 차례로 받아 둔다.
   * 같은 주소라 지도가 나중에 그 장면에 들어가면 브라우저 캐시에서 바로 나온다. 데이터 절약 모드면 하지 않는다.
   */
  var warmed = [], warmState = 'idle';
  function sceneUrls() {
    var W = window.PRIVACY_WORLD;
    return W && W.SCENES ? W.SCENES.map(function (s) { return src(s.img); }) : [];
  }
  function abs(u) { try { return new URL(u, location.href).href; } catch (e) { return u; } }
  function fetched(u) { try { return performance.getEntriesByName(abs(u)).length > 0; } catch (e) { return false; } }
  function warmNext(list) {
    var u = list.shift();
    if (!u) { warmState = 'done'; return; }
    if (fetched(u)) { warmNext(list); return; }
    var im = new Image();
    warmed.push(im); // 참조를 들고 있어야 메모리 캐시에 남는다
    im.onload = im.onerror = function () { im.onload = im.onerror = null; setTimeout(function () { warmNext(list); }, 50); };
    im.src = u;
  }
  function warm() {
    if (warmState !== 'idle') return;
    try { if (navigator.connection && navigator.connection.saveData) { warmState = 'off'; return; } } catch (e) { /* 모름 — 그냥 진행 */ }
    var list = sceneUrls();
    if (!list.length) return;
    warmState = 'waiting';
    var started = false;
    function go() { if (started) return; started = true; if (po) po.disconnect(); clearTimeout(t); warmState = 'loading'; setTimeout(function () { warmNext(list.slice()); }, 300); }
    var po = null, t = setTimeout(go, 8000), want = list.map(abs);
    if (list.some(fetched)) { go(); return; }
    try {
      po = new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { if (want.indexOf(e.name) >= 0) go(); }); });
      po.observe({ type: 'resource', buffered: true });
    } catch (e) { /* 관찰 못 하면 8초 뒤에 */ }
  }
  function watchStart() {
    var b = document.body;
    if (!b) return;
    function check() { var v = b.getAttribute('data-view'); if (v === 'v-map' || v === 'v-game') { mo.disconnect(); warm(); } }
    var mo = new MutationObserver(check);
    mo.observe(b, { attributes: true, attributeFilter: ['data-view'] });
    check();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchStart); else watchStart();

  window.PrivacyImg = { src: src, load: load, warm: warm, warmState: function () { return { state: warmState, n: warmed.length }; } };
})();
