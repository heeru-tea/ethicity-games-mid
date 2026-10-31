/*
 * 화면 부품 — 대화창(표정 그림 + .ee-speech), 가운데 창(.ee-panel 시트), 선택지(.ee-choice), 확인 창, 알림.
 * 모든 선택은 실제 <button>이고 숫자 키 1~4로도 고른다. 창이 열리면 첫 버튼에 초점을 두고 Tab이 창 밖으로 나가지 않는다.
 */
(function (root) {
  'use strict';

  var C = root.SafetyConfig;
  var EXPR = { neutral: 0, happy: 1, worried: 2, explaining: 3 };
  var SPEED = { slow: 34, normal: 18, fast: 7, instant: 0 };

  var U = { assets: null, art: {}, player: 'saebom', settings: { speed: 'normal' }, onSound: null };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function sound(id) { if (U.onSound) U.onSound(id); }

  function nameOf(who) {
    if (who === 'robot') return '안내 로봇';
    if (who === 'me') return '나 (청소년 시민위원)';
    if (who === 'narr') return '';
    return (C.NPCS[who] || {}).name || who;
  }

  // 표정 그림을 canvas에 그린다(공식 캐릭터는 공통 팩, 이 게임 인물은 assets/art, 없으면 임시 얼굴)
  function drawFace(canvas, who, expr) {
    var ctx = canvas.getContext('2d'), size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;
    var id = who === 'me' ? U.player : who;
    if (id === 'robot' || C.PLAYERS.indexOf(id) >= 0) { U.assets.drawPortrait(ctx, id, expr || 'neutral', 0, 0, size); return; }
    var sheet = U.art['npc-' + id + '-portraits'];
    if (sheet) { ctx.drawImage(sheet, (EXPR[expr] || 0) * 256, 0, 256, 256, 0, 0, size, size); return; }
    var info = C.NPCS[id] || {};
    ctx.fillStyle = '#e6edda'; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = info.color || '#a8bb8c'; ctx.fillRect(size * 0.2, size * 0.62, size * 0.6, size * 0.38);
    ctx.fillStyle = '#f6d7b8'; ctx.beginPath(); ctx.arc(size / 2, size * 0.42, size * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#294b40'; ctx.lineWidth = Math.max(2, size / 40); ctx.stroke();
    ctx.fillStyle = '#294b40'; ctx.font = '700 ' + Math.round(size * 0.16) + 'px Ethicity, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((info.short || '?').slice(0, 2), size / 2, size * 0.82);
  }
  function faceCanvas(who, expr, size) {
    var c = el('canvas', 'ee-pixel face'); c.width = c.height = 256; c.style.width = c.style.height = (size || 96) + 'px';
    drawFace(c, who, expr); c.setAttribute('aria-hidden', 'true'); return c;
  }

  // ── 대화 ──
  var talkState = null;
  function fill(text, vars) { return String(text).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? vars[k] : m; }); }
  function talk(lines, vars) {
    return new Promise(function (resolve) {
      var box = $('talk'), face = $('talk-face'), name = $('talk-name'), text = $('talk-text'), next = $('talk-next');
      var i = -1, timer = 0, full = '', shown = 0;
      box.hidden = false;
      function finishTyping() { clearInterval(timer); timer = 0; text.textContent = full; }
      function show() {
        i++;
        if (i >= lines.length) { close(); return; }
        var ln = lines[i], who = ln[0];
        full = fill(ln[1], vars);
        box.classList.toggle('narr', who === 'narr');
        face.hidden = who === 'narr';
        if (who !== 'narr') drawFace(face, who, ln[2]);
        name.textContent = nameOf(who); name.hidden = who === 'narr';
        var ms = SPEED[U.settings.speed] != null ? SPEED[U.settings.speed] : 18;
        if (!ms) { text.textContent = full; }
        else {
          shown = 0; text.textContent = '';
          clearInterval(timer);
          timer = setInterval(function () { shown += 1; text.textContent = full.slice(0, shown); if (shown >= full.length) finishTyping(); }, ms);
        }
        $('talk-live').textContent = (name.hidden ? '' : name.textContent + ': ') + full;
        next.textContent = i === lines.length - 1 ? '닫기' : '다음 ▶';
        next.focus({ preventScroll: true });
      }
      function advance() { sound('tap'); if (timer) finishTyping(); else show(); }
      function onKey(e) {
        if (e.key === 'Enter' || e.key === ' ') { if (e.target === next) return; e.preventDefault(); advance(); }
      }
      function close() {
        clearInterval(timer); box.hidden = true;
        next.removeEventListener('click', advance); box.removeEventListener('click', onBox); window.removeEventListener('keydown', onKey);
        talkState = null; resolve();
      }
      function onBox(e) { if (e.target === next) return; advance(); }
      talkState = { advance: advance };
      next.addEventListener('click', advance);
      box.addEventListener('click', onBox);
      window.addEventListener('keydown', onKey);
      show();
    });
  }

  // ── 시트(가운데 창) ──
  var sheetStack = [];
  function openSheet(opts) {
    var host = $('sheet'), prev = document.activeElement;
    host.innerHTML = ''; host.hidden = false;
    var box = el('div', 'ee-panel sheet-box' + (opts.wide ? ' wide' : ''));
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    var id = 'sheet-title-' + Date.now();
    if (opts.eyebrow) box.appendChild(el('p', 'sheet-eyebrow', opts.eyebrow));
    var h = el('h2', 'sheet-title', opts.title || ''); h.id = id; box.setAttribute('aria-labelledby', id); box.appendChild(h);
    var body = el('div', 'sheet-body'); box.appendChild(body);
    if (opts.body) body.appendChild(opts.body);
    var actions = el('div', 'sheet-actions'); box.appendChild(actions);
    host.appendChild(box);
    var api = {
      el: box, body: body, actions: actions,
      button: function (label, cls, onClick) { var b = el('button', 'ee-button ' + (cls || ''), label); b.type = 'button'; b.addEventListener('click', onClick); actions.appendChild(b); return b; },
      close: function () {
        host.removeEventListener('keydown', trap); host.hidden = true; host.innerHTML = '';
        sheetStack.pop();
        if (prev && prev.focus && document.contains(prev)) prev.focus({ preventScroll: true });
      }
    };
    function trap(e) {
      if (e.key !== 'Tab') return;
      var f = box.querySelectorAll('button:not([disabled]), textarea, input, [href], [tabindex="0"]');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    host.addEventListener('keydown', trap);
    sheetStack.push(api);
    setTimeout(function () { var f = box.querySelector('.ee-choice, .ee-button, textarea'); (f || h).focus({ preventScroll: true }); box.scrollTop = 0; }, 30);
    return api;
  }

  // 선택지 묶음: options [{id,text,sub}] → 버튼들. multi면 여러 개 고름(max까지)
  function choiceList(options, opts) {
    opts = opts || {};
    var wrap = el('div', 'choice-list'), picked = (opts.value ? [].concat(opts.value) : []).slice();
    wrap.setAttribute('role', 'group');
    if (opts.label) wrap.setAttribute('aria-label', opts.label);
    var buttons = options.map(function (o, i) {
      var b = el('button', 'ee-choice'); b.type = 'button';
      var mark = el('span', 'choice-mark', ''); mark.setAttribute('aria-hidden', 'true');
      b.appendChild(mark);
      var t = el('span', 'choice-text'); t.appendChild(el('span', 'choice-num', (i + 1) + '. ')); t.appendChild(document.createTextNode(o.text));
      if (o.sub) { t.appendChild(el('span', 'choice-sub', o.sub)); }
      b.appendChild(t);
      b.addEventListener('click', function () { toggle(o.id); });
      return { o: o, b: b, mark: mark };
    });
    function toggle(id) {
      sound('tap');
      if (opts.max && opts.max > 1) {
        var at = picked.indexOf(id);
        if (at >= 0) picked.splice(at, 1);
        else if (picked.length < opts.max) picked.push(id);
        else { picked.shift(); picked.push(id); }
      } else picked = [id];
      sync();
      if (opts.onChange) opts.onChange(opts.max > 1 ? picked.slice() : picked[0]);
    }
    function sync() {
      buttons.forEach(function (x) {
        var on = picked.indexOf(x.o.id) >= 0;
        x.b.setAttribute('aria-pressed', on ? 'true' : 'false');
        x.mark.textContent = on ? '✔' : '';
      });
    }
    buttons.forEach(function (x) { wrap.appendChild(x.b); });
    sync();
    wrap.addEventListener('keydown', function (e) {
      var n = Number(e.key);
      if (n >= 1 && n <= buttons.length) { e.preventDefault(); e.stopPropagation(); buttons[n - 1].b.focus(); toggle(buttons[n - 1].o.id); }
    });
    return { el: wrap, value: function () { return opts.max > 1 ? picked.slice() : picked[0]; } };
  }

  // 질문 하나에 답하기(한 개 또는 여러 개). 고른 뒤 '선택하기'로 확정
  function choose(o) {
    return new Promise(function (resolve) {
      var body = el('div');
      if (o.lead) body.appendChild(el('p', 'sheet-lead', o.lead));
      var min = o.min || 1, max = o.max || 1;
      if (max > 1) body.appendChild(el('p', 'sheet-help', min + '~' + max + '개를 고를 수 있어요.'));
      var confirm;
      var list = choiceList(o.options, { max: max, label: o.question, onChange: function (v) { confirm.disabled = !(max > 1 ? v.length >= min : v); } });
      body.appendChild(list.el);
      if (o.note) body.appendChild(el('p', 'ee-notice sheet-note', o.note));
      var sh = openSheet({ eyebrow: o.eyebrow, title: o.question, body: body });
      confirm = sh.button(o.confirm || '선택하기', '', function () { sh.close(); resolve(list.value()); });
      confirm.disabled = true;
    });
  }

  // 장 전환 카드
  function card(o) {
    return new Promise(function (resolve) {
      var body = el('div', 'chapter-card');
      body.appendChild(el('p', 'chapter-text', o.text));
      var sh = openSheet({ eyebrow: o.eyebrow, title: o.title, body: body });
      sh.el.classList.add('chapter');
      sh.button(o.button || '시작하기', '', function () { sh.close(); resolve(); });
    });
  }

  // 확인 창(브라우저 confirm 대신)
  function ask(title, text, yes, no) {
    return new Promise(function (resolve) {
      var body = el('div'); body.appendChild(el('p', 'sheet-lead', text));
      var sh = openSheet({ title: title, body: body });
      sh.button(no || '돌아가기', 'secondary', function () { sh.close(); resolve(false); });
      sh.button(yes || '확인', '', function () { sh.close(); resolve(true); });
    });
  }

  var noticeTimer = 0;
  function notice(msg) {
    var n = $('notice'); n.textContent = msg; n.hidden = false;
    clearTimeout(noticeTimer); noticeTimer = setTimeout(function () { n.hidden = true; }, 3200);
  }

  root.SafetyUI = { state: U, talk: talk, openSheet: openSheet, choiceList: choiceList, choose: choose, card: card, ask: ask, notice: notice,
    faceCanvas: faceCanvas, drawFace: drawFace, el: el, nameOf: nameOf, isTalking: function () { return !!talkState; }, sheetOpen: function () { return sheetStack.length > 0; } };
})(this);
