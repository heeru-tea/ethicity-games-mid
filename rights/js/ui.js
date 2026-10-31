// DOM 도우미 — 요소 만들기, 공통 아이콘·초상화(EthicityAssets로 그림), 전체 화면 패널(대화상자), 확인 창.
(function (root) {
  'use strict';
  var A = null; // EthicityAssets 인스턴스(app.js가 넣어 준다)
  var M = root.ETHICITY_COMMON_MANIFEST;

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className = v;
      else if (k === 'on') Object.keys(v).forEach(function (evt) { node.addEventListener(evt, v[evt]); });
      else node.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }
  function append(node, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(node, c); }); return; }
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  function button(label, opts) {
    opts = opts || {};
    var b = el('button', { type: 'button', class: 'ee-button' + (opts.secondary ? ' secondary' : '') + (opts.class ? ' ' + opts.class : ''), id: opts.id });
    if (opts.icon && opts.secondary) b.appendChild(icon(opts.icon, 24)); // 짙은 기본 버튼 위에서는 잉크색 아이콘이 보이지 않아 보조 버튼에만
    b.appendChild(el('span', null, label));
    if (opts.onClick) b.addEventListener('click', opts.onClick);
    return b;
  }

  // 공통 아이콘을 작은 캔버스로. 장식용이면 스크린리더에서 숨긴다.
  function icon(id, size, label) {
    var dpr = Math.min(2, root.devicePixelRatio || 1);
    var c = el('canvas', { class: 'ee-icon r-icon', 'data-id': id, width: size * dpr, height: size * dpr, 'aria-hidden': label ? null : 'true', role: label ? 'img' : null, 'aria-label': label || null });
    c.style.width = c.style.height = size + 'px';
    if (A) A.drawIcon(c.getContext('2d'), id, 0, 0, size * dpr);
    return c;
  }
  function portrait(id, expression, size) {
    var c = el('canvas', { class: 'ee-pixel r-portrait', width: 256, height: 256, 'aria-hidden': 'true' });
    c.style.width = c.style.height = size + 'px';
    if (A && M.characters[id]) A.drawPortrait(c.getContext('2d'), id, expression || 'neutral', 0, 0, 256);
    return c;
  }
  function figure(id, size) {
    var c = el('canvas', { class: 'ee-pixel', width: 96, height: 128, 'aria-hidden': 'true' });
    c.style.width = size + 'px'; c.style.height = Math.round(size * 128 / 96) + 'px';
    if (A) A.drawCharacter(c.getContext('2d'), id, 48, 122, 'down', 1, 1);
    return c;
  }

  // 패널: 무대를 덮는 대화상자. 열 때 앞서 초점이 있던 곳을 기억했다가 닫으면 돌려준다.
  var stack = [];
  function openPanel(content, opts) {
    opts = opts || {};
    var layer = el('div', { class: 'r-overlay' + (opts.wide ? ' wide' : '') });
    var sheet = el('section', { class: 'ee-panel r-sheet', role: opts.alert ? 'alertdialog' : 'dialog', 'aria-modal': 'true', 'aria-label': opts.label || null, tabindex: '-1' });
    append(sheet, content);
    layer.appendChild(sheet);
    $('panels').appendChild(layer);
    var entry = { layer: layer, sheet: sheet, back: document.activeElement, onEscape: opts.onEscape };
    stack.push(entry);
    document.body.classList.add('r-modal-open');
    focusFirst(sheet);
    return entry;
  }
  function closePanel(entry) {
    var i = stack.indexOf(entry);
    if (i < 0) return;
    stack.splice(i, 1);
    entry.layer.remove();
    if (!stack.length) document.body.classList.remove('r-modal-open');
    if (entry.back && document.contains(entry.back)) try { entry.back.focus({ preventScroll: true }); } catch (e) { /* 초점 복귀 실패는 무시 */ }
  }
  function topPanel() { return stack[stack.length - 1] || null; }
  function focusFirst(scope) {
    var target = scope.querySelector('[data-autofocus]') || scope.querySelector('h1, h2') || scope;
    if (target.matches && target.matches('h1, h2')) target.setAttribute('tabindex', '-1');
    try { target.focus({ preventScroll: false }); } catch (e) { /* 무시 */ }
    scope.scrollTop = 0;
  }
  // 대화상자 안에서만 Tab이 돌게 한다.
  document.addEventListener('keydown', function (e) {
    var top = topPanel();
    if (!top) return;
    if (e.key === 'Escape' && top.onEscape) { e.preventDefault(); top.onEscape(); return; }
    if (e.key !== 'Tab') return;
    var items = Array.prototype.filter.call(top.sheet.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'), function (n) { return !n.disabled && n.offsetParent !== null; });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === top.sheet)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  function confirmBox(title, text, yes) {
    return new Promise(function (resolve) {
      var entry;
      function done(v) { closePanel(entry); resolve(v); }
      entry = openPanel([
        el('h2', null, title), el('p', null, text),
        el('div', { class: 'r-actions' }, button('취소', { secondary: true, onClick: function () { done(false); } }), button(yes || '확인', { onClick: function () { done(true); } }))
      ], { alert: true, label: title, onEscape: function () { done(false); } });
    });
  }

  var toastTimer = 0;
  function say(text) {
    var n = $('status');
    n.textContent = text;
    n.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { n.hidden = true; }, 3200);
  }

  function fill(text, names) {
    return String(text).replace(/\{(hero|A|B)\}/g, function (_, k) { return names[k] || ''; });
  }

  root.RightsUI = {
    setAssets: function (a) { A = a; }, assets: function () { return A; },
    $: $, el: el, button: button, icon: icon, portrait: portrait, figure: figure,
    openPanel: openPanel, closePanel: closePanel, topPanel: topPanel, confirm: confirmBox, say: say, fill: fill
  };
})(window);
