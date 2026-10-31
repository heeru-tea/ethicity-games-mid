/*
 * 캐릭터 그림을 화면(DOM)에 그리는 도우미 — 장 요약·엔딩의 관계 보고 얼굴 등.
 *   PrivacySprite.el(who, { face, scale, look, initial }) → <span class="spr">
 *   그림 = 윤리시티 공통 팩 공식 캐릭터(PrivacyCast). face면 초상화 시트의 기본 표정,
 *   아니면 걷기 시트의 아래 보기 정지 프레임. 그림이 없거나 못 불러오면 이니셜 동그라미.
 */
(function () {
  'use strict';
  var FULL = { w: 48, h: 72 };   // 전신: 옛 칸과 같은 화면 크기(× scale)
  var FACE = { w: 38, h: 38 };   // 얼굴: 정사각(초상화 칸 256×256)
  // 그림이 없을 때 쓰는 인물 색(맵 임시 도형과 같은 색)
  var COLOR = { me: '#0F766E', saebom: '#4E6FC9', haneul: '#D06A2E', jiho: '#B04F8C', minjun: '#3F7F5C', teacher: '#6E6150', friend: '#7B808A' };

  function el(who, opts) {
    opts = opts || {};
    var k = opts.scale || 2;
    var look = opts.look || 'm';
    var box = opts.face ? FACE : FULL;
    var n = document.createElement('span');
    n.className = 'spr' + (opts.face ? ' face' : '') + ' fallback';
    n.setAttribute('data-who', who);
    n.setAttribute('aria-hidden', 'true');
    n.style.width = box.w * k + 'px';
    n.style.height = box.h * k + 'px';
    n.style.backgroundColor = COLOR[who] || '#7B808A';
    n.textContent = opts.initial || '';

    var src = opts.face ? window.PrivacyCast.portraits(who, look) : window.PrivacyCast.walk(who, look);
    if (!src) return n;
    var img = new Image();
    img.onload = function () {
      n.classList.remove('fallback');
      n.classList.add('loaded');
      n.textContent = '';
      n.style.backgroundColor = '';
      n.style.imageRendering = 'pixelated';
      if (opts.face) { window.PrivacyCast.paintPortrait(n, who, look, 'neutral'); return; }
      // 걷기 시트(4×4 칸 96×128)에서 아래 보기 정지 프레임: 칸 높이를 상자 높이에 맞춘다
      var C = window.PrivacyCast.CELL, s = box.h * k / C.h;
      n.style.width = Math.round(C.w * s) + 'px';
      n.style.backgroundImage = 'url("' + src + '")';
      n.style.backgroundSize = 4 * C.w * s + 'px ' + 4 * C.h * s + 'px';
      n.style.backgroundPosition = -window.PrivacyCast.STOP_FRAME * C.w * s + 'px 0';
      n.style.backgroundRepeat = 'no-repeat';
    };
    img.src = src;
    return n;
  }

  window.PrivacySprite = { el: el, COLOR: COLOR };
})();
