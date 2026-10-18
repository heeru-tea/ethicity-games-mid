/*
 * 캐릭터 시트를 화면(DOM)에 그리는 도우미 — 장 요약·엔딩의 관계 보고 얼굴 등.
 *   PrivacySprite.el(who, { face, scale, look, initial }) → <span class="spr">
 *   시트 = 48×72 칸 × 4프레임(가로) × 아래·왼·오·위(세로). 아래 방향 첫 프레임을 쓴다.
 *   face: 새 초상화를 기존 44×38 영역에 contain으로 표시한다.
 *   새 그림 실패 → 기존 시트(얼굴은 머리 부분) → 이니셜 동그라미.
 */
(function () {
  'use strict';
  var DIR = 'assets/sprites/';
  var NEW_DIR = 'assets/characters-v3/';
  var NEW_CHARACTERS = ['hayun', 'seoa', 'dohyun', 'minjun', 'teacher'];
  var SHEET = { w: 192, h: 288 };
  var FULL = { x: 0, y: 0, w: 48, h: 72 };
  var FACE = { x: 2, y: 0, w: 44, h: 38 };
  // 그림이 없을 때 쓰는 인물 색(맵 임시 도형과 같은 색)
  var COLOR = { me: '#0F766E', hayun: '#4E6FC9', dohyun: '#D06A2E', seoa: '#B04F8C', minjun: '#3F7F5C', teacher: '#6E6150', friend: '#7B808A' };

  function el(who, opts) {
    opts = opts || {};
    var k = opts.scale || 2;
    var box = opts.face ? FACE : FULL;
    var file = who === 'me' ? 'char_player_' + (opts.look || 'm') + '.png' : 'char_' + who + '.png';
    var character = who === 'me' ? ((opts.look || 'm') === 'f' ? 'girl' : ((opts.look || 'm') === 'm' ? 'boy' : null))
      : (NEW_CHARACTERS.indexOf(who) !== -1 ? who : null);
    var n = document.createElement('span');
    n.className = 'spr' + (opts.face ? ' face' : '') + ' fallback';
    n.setAttribute('data-who', who);
    n.setAttribute('aria-hidden', 'true');
    n.style.width = box.w * k + 'px';
    n.style.height = box.h * k + 'px';
    n.style.backgroundColor = COLOR[who] || '#7B808A';
    n.textContent = opts.initial || '';
    function load(src, modern) {
      var img = new Image();
      img.onload = function () {
        n.classList.remove('fallback');
        n.classList.add('loaded');
        n.textContent = '';
        n.style.backgroundColor = '';
        n.style.backgroundImage = 'url("' + src + '")';
        n.style.backgroundSize = modern && opts.face ? 'contain' : SHEET.w * k + 'px ' + SHEET.h * k + 'px';
        n.style.backgroundPosition = modern && opts.face ? 'center' : -box.x * k + 'px ' + -box.y * k + 'px';
        // High-resolution 4×4 sheets use the same logical 192×288 size.
        n.style.imageRendering = modern ? 'auto' : '';
      };
      img.onerror = function () {
        if (modern) load(DIR + file, false);
      };
      img.src = src;
    }
    load(character ? NEW_DIR + (opts.face ? character + '-portrait.png' : 'walk-' + character + '.png') : DIR + file, !!character);
    return n;
  }

  window.PrivacySprite = { el: el, COLOR: COLOR };
})();
