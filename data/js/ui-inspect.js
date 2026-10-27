/*
 * 검수(기획서 §4.3) · 감독관 질문(§4.4) · 보충 준비(§4.6).
 * 장면별 요약은 "보는 화면"이다 — 숫자·충족 표시를 넣지 않는다(체크리스트 게임 방지).
 */
(function (root) {
  'use strict';

  var DR = root.DR;
  function el() { return DR.UI.el.apply(null, arguments); }

  function variantOf(card) { return parseInt(String(card.id).replace(/\D/g, ''), 10) % 3 || 0; }
  function cardId(card) { return card.key || card.ambiguousId; }
  function ambDef(mission, id) { return mission.ambiguous.filter(function (a) { return a.id === id; })[0]; }
  function labelText(mission, id) { var o = mission.labelOptions.filter(function (x) { return x.id === id; })[0]; return o ? o.text : ''; }

  // 플레이어가 붙인 대로의 key("?" 카드: 맞으면 truthKey, 틀리면 같은 시간대·같은 설명표의 일반 key)
  function effectiveKey(mission, card) {
    if (card.key) return card.key;
    if (!card.assigned) return null;
    var q = ambDef(mission, card.ambiguousId);
    if (card.assigned === q.correctLabel) return q.truthKey;
    var keys = Object.keys(mission.cardTypes);
    for (var i = 0; i < keys.length; i++) {
      var ic = mission.cardTypes[keys[i]].icons;
      if (ic[0] === q.icons[0] && ic[1] === card.assigned && !mission.cardTypes[keys[i]].rare) return keys[i];
    }
    return null;
  }

  function thumbUrl(mission, card) {
    var A = DR.CardArt;
    return A.thumb(A.card(mission, cardId(card), variantOf(card), 192), 24).toDataURL();
  }

  function iconsOf(mission, card) {
    if (card.key) return mission.cardTypes[card.key].icons;
    var q = ambDef(mission, card.ambiguousId);
    return card.assigned ? [q.icons[0], card.assigned] : q.icons;
  }

  function iconRow(mission, card) {
    var row = el('span', { class: 'bag-icons' });
    iconsOf(mission, card).forEach(function (n) {
      if (n === 'none') return;
      var known = ['day', 'night', 'flood_deep', 'flood_shallow', 'wet', 'dry', 'unknown', 'dog', 'cat'].indexOf(n) >= 0;
      if (known) row.appendChild(el('img', { src: DR.CardArt.icon(n, 64).toDataURL(), alt: '' }));
    });
    return row;
  }

  // 가방 격자 — opts: { onOpen(card), onRemove(card) }
  function bagGrid(mission, bag, gridId, opts) {
    var grid = el('div', { id: gridId, class: 'bag-grid' });
    bag.forEach(function (card) {
      var amb = !!card.ambiguousId;
      var state = amb ? (card.assigned === undefined ? '아직 안 정함' : card.assigned === null ? '넣지 않기' : labelText(mission, card.assigned)) : '';
      var open = el('button', { class: 'bag-open', type: 'button', 'aria-label': amb ? '"?" 카드 열기' : '크게 보기' }, [
        el('img', { src: thumbUrl(mission, card), alt: '' }),
        iconRow(mission, card),
        amb ? el('span', { class: 'bag-state', text: state }) : null
      ]);
      if (opts.onOpen) open.addEventListener('click', function () { opts.onOpen(card); });
      var rm = el('button', { class: 'btn-remove', type: 'button', text: '빼기', 'aria-label': '가방에서 빼기' });
      rm.addEventListener('click', function () { DR.Sfx.play('ui'); opts.onRemove(card); });
      grid.appendChild(el('div', { class: 'bag-card' + (amb ? ' ambiguous' : '') + (amb && card.assigned === undefined ? ' undecided' : ''), 'data-id': card.id, 'data-key': card.key || card.ambiguousId }, [open, rm]));
    });
    return grid;
  }

  /* ---------- 검수 ---------- */
  function inspect(mission, bag, done) {
    var screen = document.getElementById('screen-inspect');
    var zoomed = null, zoomCleanup = null;

    function render() {
      var undecided = bag.filter(function (c) { return c.ambiguousId && c.assigned === undefined; }).length;
      screen.innerHTML = '';
      var notice = el('p', { id: 'inspect-undecided', class: 'notice', text: '아직 정하지 않은 "?" 카드 ' + undecided + '장 — 정하지 않으면 넣지 않아요.' });
      notice.hidden = undecided === 0;
      var scenes = el('div', { id: 'inspect-scenes' });
      mission.scenes.forEach(function (s) {
        var keys = {};
        s.combos.forEach(function (c) { c.keys.forEach(function (k) { keys[k] = true; }); });
        var row = el('div', { class: 'scene-thumbs' });
        bag.forEach(function (card) {
          var k = effectiveKey(mission, card);
          if (k && keys[k]) row.appendChild(el('img', { src: thumbUrl(mission, card), alt: '' }));
        });
        if (!row.childNodes.length) row.appendChild(el('span', { class: 'empty', text: '이 장면에 해당하는 카드가 보이지 않는다' }));
        scenes.appendChild(el('section', { class: 'scene-sum', 'data-scene': s.id }, [el('h3', { text: s.title }), row]));
      });
      var submit = el('button', { id: 'btn-submit', class: 'btn btn-primary', type: 'button', text: '감독관에게 제출' });
      submit.addEventListener('click', function () { DR.Sfx.play('ui'); done(bag); });
      screen.appendChild(el('div', { class: 'page' }, [
        el('p', { class: 'kicker', text: '검수 · ' + mission.title }),
        el('h2', { text: '가방 확인 (' + bag.length + '/' + mission.bag + '칸)' }),
        el('p', { class: 'note', text: '카드를 누르면 크게 볼 수 있다. "?" 카드는 단서를 보고 설명표를 붙이거나, 넣지 않기로 정한다.' }),
        notice,
        bagGrid(mission, bag, 'inspect-grid', {
          onOpen: openZoom,
          onRemove: function (card) { bag.splice(bag.indexOf(card), 1); render(); }
        }),
        el('h2', { text: '장면별로 모아 보기' }),
        scenes,
        el('div', { class: 'actions' }, [submit])
      ]));
      if (zoomed) openZoom(zoomed);
    }

    function openZoom(card) {
      if (zoomCleanup) zoomCleanup();
      zoomed = card;
      var A = DR.CardArt, amb = !!card.ambiguousId;
      var big = A.card(mission, cardId(card), variantOf(card), 320);
      var inner = [el('img', { class: 'zoom-art', src: big.toDataURL(), alt: '카드 원본' }), iconRow(mission, card)];
      if (amb) {
        var q = ambDef(mission, card.ambiguousId);
        var clues = el('div', { class: 'clues' });
        q.clues.forEach(function (cl, i) {
          clues.appendChild(el('figure', { class: 'clue' }, [el('img', { src: A.clue(mission, q.id, i, 256).toDataURL(), alt: cl.text }), el('figcaption', { text: cl.text })]));
        });
        var labels = el('div', { class: 'labels', role: 'group', 'aria-label': '설명표 붙이기' });
        mission.labelOptions.concat([{ id: 'none', text: '넣지 않기' }]).forEach(function (o) {
          var val = o.id === 'none' ? null : o.id;
          var b = el('button', { class: 'btn btn-label', type: 'button', 'data-label': o.id, text: o.text, 'aria-pressed': card.assigned === val ? 'true' : 'false' });
          b.addEventListener('click', function () { DR.Sfx.play('ui'); card.assigned = val; render(); });
          labels.appendChild(b);
        });
        inner.push(el('h3', { text: '추가 단서' }), clues, el('h3', { text: '설명표' }), labels);
      }
      var close = el('button', { class: 'btn btn-ghost', type: 'button', text: '닫기' });
      var panel = el('div', { class: 'zoom-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': '카드 크게 보기' }, inner.concat([el('div', { class: 'actions' }, [close])]));
      var overlay = el('div', { id: 'inspect-zoom', class: 'zoom' }, [panel]);
      // 다시 그릴 때 keydown 리스너가 쌓이지 않게 정리 함수를 하나만 둔다
      function cleanup() { overlay.remove(); root.removeEventListener('keydown', onKey); zoomCleanup = null; }
      function shut() { zoomed = null; cleanup(); }
      function onKey(e) { if (e.key === 'Escape') shut(); }
      close.addEventListener('click', shut);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) shut(); });
      root.addEventListener('keydown', onKey);
      zoomCleanup = cleanup;
      screen.appendChild(overlay);
      close.focus();
    }

    DR.App.go('inspect');
    render();
  }

  /* ---------- 감독관 ---------- */
  function supervisor(question, back, submit) {
    var screen = document.getElementById('screen-supervisor');
    screen.innerHTML = '';
    var b = el('button', { id: 'btn-back', class: 'btn', type: 'button', text: '검수로 돌아가기' });
    var c = el('button', { id: 'btn-confirm', class: 'btn btn-primary', type: 'button', text: '제출' });
    b.addEventListener('click', function () { DR.Sfx.play('ui'); back(); });
    c.addEventListener('click', function () { DR.Sfx.play('ui'); submit(); });
    screen.appendChild(el('div', { class: 'page page-center' }, [
      el('p', { class: 'kicker', text: '승인 전' }),
      DR.UI.line({ who: 'supervisor', text: question }),
      el('div', { class: 'actions' }, [b, c])
    ]));
    DR.App.go('supervisor');
  }

  /* ---------- 보충 준비 ---------- */
  function supplementPrep(mission, result, bag, done) {
    var screen = document.getElementById('screen-prep');
    var need = Math.min(DR.config.supplementFreeSlots, mission.bag);
    function render() {
      var free = mission.bag - bag.length, lack = Math.max(0, need - free);
      screen.innerHTML = '';
      var failed = el('ul', { class: 'failed' });
      result.scenes.forEach(function (s) {
        if (s.pass) return;
        var sc = mission.scenes.filter(function (x) { return x.id === s.id; })[0];
        failed.appendChild(el('li', { text: sc.title }));
      });
      var go = el('button', { id: 'btn-supplement', class: 'btn btn-primary', type: 'button', text: '보충 달리기 출발' });
      go.disabled = lack > 0;
      go.addEventListener('click', function () { DR.Sfx.unlock(); DR.Sfx.play('ui'); done(bag); });
      screen.appendChild(el('div', { class: 'page' }, [
        el('p', { class: 'kicker', text: '보충 달리기 준비' }),
        el('h2', { text: '놓친 장면' }),
        failed,
        el('p', { class: 'note', text: '이번엔 그 장면에 필요한 카드가 더 자주 나온다. 가방 칸은 그대로라서, 출발하려면 ' + need + '칸 이상 비어 있어야 한다.' }),
        el('p', { id: 'prep-need', class: 'notice', text: lack > 0 ? lack + '칸 더 비워야 해요.' : '출발할 수 있어요.' }),
        bagGrid(mission, bag, 'prep-grid', { onRemove: function (card) { bag.splice(bag.indexOf(card), 1); render(); } }),
        el('div', { class: 'actions' }, [go])
      ]));
    }
    DR.App.go('prep');
    render();
  }

  root.DR.UI.inspect = inspect;
  root.DR.UI.supervisor = supervisor;
  root.DR.UI.supplementPrep = supplementPrep;
  root.DR.UI.effectiveKey = effectiveKey;
})(window);
