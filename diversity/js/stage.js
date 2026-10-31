/*
 * 무대 — 1280×720 논리 화면에 공통 배경·인물·효과를 그린다.
 * 그림은 모두 공통 팩 runtime(EthicityAssets)으로 그리고, 직접 잘라 그리지 않는다.
 * 서 있는 인물은 정지 프레임(1번), 걷는 인물(플레이어·로봇 동료)은 walk.js가 넘겨 주는 프레임으로 그린다.
 * 인물마다 발 좌표(x, y)를 두고, y가 작은(뒤쪽) 인물부터 그려 앞뒤를 맞춘다.
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
  function feet(c) { return c.y || FEET_Y; }

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
    current.cast.slice().sort(function (a, b) { return feet(a) - feet(b); }).forEach(function (c) {
      var s = scaleOf(c.id);
      assets.drawCharacter(ctx, c.id, c.x, feet(c), c.dir || 'down', c.frame == null ? 1 : c.frame, s);
      if (c.id === current.speaker) marker(c.x, feet(c) - 120 * s);
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
      if (bg && bg !== current.bg) fx = null; // 앞 장면의 효과가 새 배경 위에 남지 않게
      current.bg = bg || current.bg;
      current.cast = cast || [];
      current.speaker = speaker || null;
      if (!raf) draw();
    },
    // 걷기 중 매 프레임 인물 목록만 바꾼다
    setCast: function (cast) {
      current.cast = cast || [];
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
      var y = who ? feet(who) - 120 * scaleOf(who.id) - 48 : 220;
      fx = { id: id, x: x, y: y, start: null };
      if (!raf) raf = global.requestAnimationFrame(tick);
    }
  };
})(window);
