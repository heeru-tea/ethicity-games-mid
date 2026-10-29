/*
 * 무대 — 1280×720 논리 화면에 공통 배경·인물·효과를 그린다.
 * 그림은 모두 공통 팩 runtime(EthicityAssets)으로 그리고, 직접 잘라 그리지 않는다.
 * 비주얼 노벨형이라 걷기 이동은 없다. 인물은 정지 프레임(1번)으로 세운다.
 */
(function (global) {
  'use strict';

  var W = 1280, H = 720;
  var FEET_Y = 520; // 공통 배경의 가운데 빈 바닥(아래쪽 55%) 안
  var SCALE = { teacher: 0.95, librarian: 0.95, robot: 0.65 };
  var STUDENT_SCALE = 0.85;
  var GOLD = '#f3cf72', INK = '#294b40';

  var assets = null, ctx = null;
  var current = { bg: null, cast: [], speaker: null };
  var fx = null, raf = 0, reducedMotion = false;

  function scaleOf(id) { return SCALE[id] || STUDENT_SCALE; }

  // 말하는 사람 머리 위의 작은 금색 표시(색만이 아니라 대화창 이름으로도 구분된다)
  function marker(x, top) {
    ctx.fillStyle = GOLD; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 11, top - 22); ctx.lineTo(x + 11, top - 22); ctx.lineTo(x, top - 8); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    if (current.bg) assets.drawBackground(ctx, current.bg, W, H);
    current.cast.forEach(function (c) {
      var s = scaleOf(c.id);
      assets.drawCharacter(ctx, c.id, c.x, FEET_Y, c.dir || 'down', 1, s);
      if (c.id === current.speaker) marker(c.x, FEET_Y - 120 * s);
    });
  }

  function tick(now) {
    draw();
    if (fx) {
      if (fx.start == null) fx.start = now;
      var alive = assets.drawEffect(ctx, fx.id, fx.x, fx.y, now - fx.start, 96, reducedMotion);
      if (!alive) { fx = null; draw(); }
    }
    raf = fx ? global.requestAnimationFrame(tick) : 0;
  }

  global.DiversityStage = {
    init: function (canvas, loaded) {
      assets = loaded;
      canvas.width = W; canvas.height = H;
      ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
    },
    setReducedMotion: function (on) { reducedMotion = !!on; },
    show: function (bg, cast, speaker) {
      current.bg = bg || current.bg;
      current.cast = cast || [];
      current.speaker = speaker || null;
      if (!raf) draw();
    },
    speak: function (id) {
      current.speaker = id || null;
      if (!raf) draw();
    },
    // 공통 피드백 효과 한 번(0.8초). 위치를 주지 않으면 말하는 사람 머리 위, 없으면 화면 가운데 위.
    effect: function (id) {
      var who = current.cast.filter(function (c) { return c.id === current.speaker; })[0] || null;
      var x = who ? who.x : W / 2;
      var y = who ? FEET_Y - 120 * scaleOf(who.id) - 48 : 220;
      fx = { id: id, x: x, y: y, start: null };
      if (!raf) raf = global.requestAnimationFrame(tick);
    }
  };
})(window);
