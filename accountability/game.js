/* 윤리시티 · AI 윤리 탐험대 — 책임성 「버섯도감 AI의 네 사람」
   공통 팩(ethicity-elementary-common-v1)의 EthicityAssets 런타임으로 캐릭터·배경·아이콘·효과·효과음을 그립니다. */
(() => {
  'use strict';
  const GAME_ID = 'accountability';
  const COMMON_BASE = window.ACCOUNTABILITY_COMMON_BASE || '../shared/ethicity-elementary-common-v1';
  const KEY = 'ethicity.' + GAME_ID + '.';
  const TOTAL = 9;

  const root = document.getElementById('ga-root');
  const stage = document.getElementById('ga-stage');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const post = msg => { try { if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*'); } catch (e) {} };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(KEY + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(KEY + k); } catch (e) {} }
  };

  /* ---------- cast (공식 character ID) ---------- */
  const CAST = {
    guide: { id: 'robot', name: '안내 로봇' },
    data: { id: 'saebom', name: '새봄', role: '데이터 수집자' },
    developer: { id: 'onyu', name: '온유', role: '개발자' },
    deployer: { id: 'jiho', name: '지호', role: '배포자' },
    user: { id: 'haneul', name: '하늘', role: '사용자' },
    friend: { id: 'daon', name: '다온' },
    teacher: { id: 'teacher', name: '선생님' }
  };
  const ROLE_KEYS = ['data', 'developer', 'deployer', 'user'];

  let A = null;
  const settings = Object.assign({ sound: false, calm: false }, store.get('settings', {}));
  const reduced = () => settings.calm || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const snd = id => { if (A && settings.sound) A.playSound(id); };

  const blank = () => ({
    scene: 0, cart: [], labels: {}, labelSkipped: false,
    tabOpened: false, launch: null, th: 60, log: null,
    ad: null, warn: null, age: null, ate: null, userChoice: null,
    shots: [], share: null, report: null, pushed: false,
    my: { data: 25, developer: 25, deployer: 25, user: 25 }, reason: null, opened: false,
    caseId: null, refl: {}, player: null
  });
  let S = blank();
  const pdfId = { sid: '', name: '' }; // PDF 제출용. 메모리에만 두고 저장·전송하지 않음
  const nick = () => (S.player ? S.player.name : '탐험가');
  const reflKey = () => 'reflection.' + encodeURIComponent(nick());
  const saveRefl = () => store.set(reflKey(), { refl: S.refl, caseId: S.caseId });
  const loadRefl = () => { const v = store.get(reflKey(), null); S.refl = (v && v.refl) || {}; };

  /* ---------- painting helpers ---------- */
  const face = (who, expr = 'neutral', label = '') => `<div class="ga-face" data-face="${who}" data-expr="${expr}" role="img" aria-label="${esc(label || CAST[who].name)}"></div>`;
  const banner = (bg, actors = [], cls = '', tag = '') => `<div class="ga-banner ${cls}"><canvas width="1280" height="720" data-bg="${bg}" data-actors='${JSON.stringify(actors)}' role="img" aria-label="장면 배경"></canvas>${tag ? `<span class="ee-badge ga-tag">${tag}</span>` : ''}</div>`;
  const icon = (id, label = '') => `<canvas width="64" height="64" data-icon="${id}" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'} class="ee-icon"></canvas>`;
  function paint(scope = root) {
    $$('[data-face]', scope).forEach(el => {
      if (el.firstChild) return;
      const c = document.createElement('canvas'); c.width = 256; c.height = 256;
      A.drawPortrait(c.getContext('2d'), CAST[el.dataset.face].id, el.dataset.expr || 'neutral', 0, 0, 256);
      el.appendChild(c);
    });
    $$('canvas[data-bg]', scope).forEach(c => {
      if (c.dataset.done) return; c.dataset.done = 1;
      animateBanner(c, JSON.parse(c.dataset.actors || '[]').sort((a, b) => a[2] - b[2]));
    });
    $$('canvas[data-icon]', scope).forEach(c => {
      if (c.dataset.done) return; c.dataset.done = 1;
      A.drawIcon(c.getContext('2d'), c.dataset.icon, 0, 0, 64);
    });
  }
  /* 장면 배경: 캐릭터가 걸어 들어오고(6fps 걷기 시트), 안내 로봇은 천천히 떠 있음. 움직임 줄이기에서는 정지 화면 */
  function animateBanner(c, actors) {
    const ctx = c.getContext('2d'), t0 = performance.now(), WALK = 900, GAP = 140;
    const scale = who => who === 'guide' ? .65 : who === 'teacher' ? .9 : .85;
    const hasRobot = actors.some(a => a[0] === 'guide');
    const draw = (now, still) => {
      A.drawBackground(ctx, c.dataset.bg, 1280, 720);
      actors.forEach(([who, x, y, dir, sc], i) => {
        const el = still ? 1e9 : now - t0 - i * GAP, p = Math.max(0, Math.min(1, el / WALK));
        const fromLeft = x < 640, sx = x + (fromLeft ? -170 : 170);
        let cx = x, d = dir || 'down', f = 1, cy = y;
        if (p < 1) { const e = 1 - Math.pow(1 - p, 2); cx = sx + (x - sx) * e; d = fromLeft ? 'right' : 'left'; f = Math.floor(Math.max(0, el) / 166) % 4; }
        if (who === 'guide' && !still) cy = y + Math.round(Math.sin(now / 520) * 4);
        if (el < 0) return;
        A.drawCharacter(ctx, CAST[who].id, Math.round(cx), cy, d, f, sc || scale(who));
      });
    };
    const tick = () => {
      if (!c.isConnected) return;
      const now = performance.now();
      if (reduced()) { draw(now, true); return; }
      draw(now, false);
      const entering = now - t0 < WALK + actors.length * GAP + 100;
      if (entering || hasRobot) setTimeout(tick, 83);
    };
    if (reduced() || !actors.length) draw(0, true); else tick();
  }
  function fx(id, el) {
    if (!el) return;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    const c = document.createElement('canvas'); c.width = 80; c.height = 80; c.className = 'ga-fx';
    c.style.left = 'calc(50% - 40px)'; c.style.top = 'calc(50% - 40px)';
    el.appendChild(c);
    const ctx = c.getContext('2d'); const t0 = performance.now(); const rm = reduced();
    const step = now => {
      ctx.clearRect(0, 0, 80, 80);
      const alive = A.drawEffect(ctx, id, 40, 40, now - t0, 80, rm);
      if (alive) requestAnimationFrame(step); else c.remove();
    };
    requestAnimationFrame(step);
  }
  function toast(t, kind = 'ee-notice') {
    const el = document.createElement('div'); el.className = kind + ' ga-toast'; el.setAttribute('role', 'status'); el.textContent = t;
    root.appendChild(el); setTimeout(() => el.remove(), 2000);
  }

  /* ---------- HUD ---------- */
  function hud() {
    const pl = $('#ga-player'); pl.hidden = !S.player; pl.textContent = S.player ? '탐험가 · ' + nick() : '';
    $('#ga-pips').innerHTML = S.scene ? [1, 2, 3, 4, 5, 6, 7, 8].map(i => `<span class="ga-pip ${i < S.scene ? 'done' : ''} ${i === S.scene ? 'now' : ''}" title="${i < 8 ? '장면 ' + i : '사례 탐구'}">${i < 8 ? i : '+'}</span>`).join('') : '';
  }
  function tools() {
    const s = $('#ga-sound'), m = $('#ga-motion');
    s.innerHTML = icon('volume'); m.innerHTML = icon('pause');
    const sync = () => {
      s.setAttribute('aria-pressed', settings.sound); s.setAttribute('aria-label', settings.sound ? '효과음 끄기' : '효과음 켜기'); s.title = s.getAttribute('aria-label');
      m.setAttribute('aria-pressed', settings.calm); m.setAttribute('aria-label', settings.calm ? '움직임 줄이기 끄기' : '움직임 줄이기 켜기'); m.title = m.getAttribute('aria-label');
      root.classList.toggle('ga-calm', settings.calm);
      A.setSound(settings.sound); store.set('settings', settings);
    };
    s.onclick = () => { settings.sound = !settings.sound; sync(); snd('tap'); toast(settings.sound ? '효과음을 켰어요' : '효과음을 껐어요'); };
    m.onclick = () => { settings.calm = !settings.calm; sync(); toast(settings.calm ? '움직임을 줄였어요' : '움직임 줄이기를 껐어요'); };
    paint($('.ga-hud')); sync();
  }
  function go(n) {
    S.scene = n; hud(); window.scrollTo({ top: 0 });
    post({ type: 'ethicity:progress', gameId: GAME_ID, current: n, total: TOTAL });
    if (n >= 2 && n <= 8) store.set('progress', S); else if (n === 9) store.del('progress');
    SCENES[n](); paint(stage);
  }
  function who(key, mission, bg, actors, tag) {
    const r = CAST[key];
    const mini = bg ? `<div class="ga-minibg"><canvas width="1280" height="720" data-bg="${bg}" data-actors='${JSON.stringify(actors)}' role="img" aria-label="${esc(tag || '장면')}"></canvas>${tag ? `<span class="ee-badge">${tag}</span>` : ''}</div>` : '';
    return `<aside class="ee-panel ga-who">${mini}<div class="ga-whohead">${face(key, 'neutral', r.name)}<div><div class="ga-role">${r.role}</div><div class="ga-hint">${esc(nick())}의 역할 · ${r.name}</div></div></div><p class="ga-mission">${mission}</p></aside>`;
  }
  /* 한 화면에 한 질문: 단계 표시와 이전/다음 버튼 */
  const stepBar = (labels, i) => `<ol class="ga-steps" aria-label="진행 순서">${labels.map((l, j) => `<li class="${j < i ? 'done' : j === i ? 'now' : ''}"${j === i ? ' aria-current="step"' : ''}><span>${j < i ? '✓' : j + 1}</span>${l}</li>`).join('')}</ol>`;
  const navBtns = (prev, label, disabled, extra = '') => `<div class="ga-nav">${prev ? '<button class="ee-button secondary" id="ga-prev" type="button">◀ 이전</button>' : ''}${extra}<button class="ee-button" id="ga-next" type="button"${disabled ? ' disabled' : ''}>${label}</button></div>`;
  const pressed = (cur, v) => `aria-pressed="${cur === v}"`;
  function showStep(html) { $('#ga-step').innerHTML = html; paint($('#ga-step')); window.scrollTo({ top: 0 }); }

  /* ---------- talk ---------- */
  function talk(lines, done, bg, actors) {
    let i = 0;
    stage.innerHTML = `<div class="ga-stack ga-talkstage">${banner(bg, actors)}<div id="ga-talkbox"></div></div>`;
    paint(stage);
    const show = () => {
      const l = lines[i];
      $('#ga-talkbox').innerHTML = `<div class="ga-talk">${face(l.who, l.expr || 'neutral')}
          <div class="ee-speech"><p class="ee-speaker">${esc(CAST[l.who].name)}</p><div class="ga-line" aria-live="polite"></div>
          <button class="ee-button" id="ga-next" type="button">${i < lines.length - 1 ? '다음 ▶' : (l.btn || '시작 ▶')}</button></div></div>`;
      paint($('#ga-talkbox'));
      const tw = typewrite($('.ga-line'), l.text, $('#ga-talkbox .ga-face'));
      $('#ga-next').focus({ preventScroll: true });
      $('#ga-next').onclick = () => {
        if (tw.running()) { tw.finish(); return; }
        snd('tap'); i++; i < lines.length ? show() : done();
      };
    };
    show();
  }
  /* 대사를 한 글자씩 보여 줌. 태그(<b>)는 통째로 넣음. 버튼을 한 번 누르면 바로 전체 표시 */
  function typewrite(el, html, faceEl) {
    const tokens = html.match(/<[^>]+>|&[a-z#0-9]+;|[\s\S]/gi) || [];
    let n = 0, timer = null;
    const render = () => { el.innerHTML = tokens.slice(0, n).join(''); };
    const finish = () => { clearTimeout(timer); timer = null; n = tokens.length; render(); faceEl && faceEl.classList.remove('talking'); };
    if (reduced()) { finish(); return { running: () => false, finish }; }
    faceEl && faceEl.classList.add('talking');
    const step = () => {
      do { n++; } while (n < tokens.length && tokens[n - 1].startsWith('<'));
      render();
      if (n < tokens.length && el.isConnected) timer = setTimeout(step, 28); else finish();
    };
    step();
    return { running: () => timer !== null, finish };
  }

  /* ---------- scoring (게임 내부 변수, 학생에게는 숫자로 보여 주지 않음) ---------- */
  const DATASETS = [
    { id: 'global', name: '해외 공개 데이터', price: 40, count: '50,000장', note: '유럽·북미 버섯이 대부분. 국내 독버섯 사진은 거의 없음' },
    { id: 'kr', name: '국내 수목원 표본 사진', price: 70, count: '3,000장', note: '국내 자생종 위주, 전문가가 이름표를 감수함' },
    { id: 'club', name: '동호회 회원 사진', price: 20, count: '10,000장', note: '양이 많고 싸지만 이름표가 틀린 사진이 섞여 있을 수 있음' }
  ];
  const LABELS = [
    { draw: 'egg', tag: '노란달걀버섯 · 식용', right: true },
    { draw: 'forsythia', tag: '노란달걀버섯 · 식용', right: false },
    { draw: 'shiitake', tag: '표고 · 식용', right: true },
    { draw: 'forsythia', tag: '개나리광대버섯 · 독', right: true },
    { draw: 'egg', tag: '개나리광대버섯 · 독', right: false }
  ];
  const hasDomestic = () => S.cart.includes('kr');
  const labelRight = () => LABELS.filter((l, i) => S.labels[i] !== undefined && S.labels[i] === l.right).length;
  const labelsClean = () => !S.labelSkipped && labelRight() >= 4;
  /* 고른 사진에 따라 달라지는 테스트 결과: 해외 사진은 양이 많아 전체 정확도가 높고, 국내 표본은 국내 독버섯을 잘 알아봄.
     동호회 사진은 싸고 많지만, 이름표 검수를 제대로 하지 않으면 틀린 이름표 때문에 독버섯을 더 헷갈림 */
  function accInfo() {
    const g = S.cart.includes('global'), k = hasDomestic(), c = S.cart.includes('club'), clean = labelsClean();
    const overall = k ? (c ? 88 : 84) : g ? (c ? 93 : 92) : 79;
    let tox = k ? 88 : g ? 71 : 60;
    if (c && !clean) tox -= 6;
    const notes = [];
    if (k && !g) notes.push('국내 표본은 사진 수가 적어 전체 숫자는 낮지만, 국내 독버섯은 더 잘 알아봅니다.');
    if (c && !clean) notes.push('동호회 사진의 틀린 이름표가 섞여 독버섯을 헷갈리는 경우가 늘었습니다.');
    if (c && clean) notes.push('이름표 검수로 동호회 사진의 틀린 이름표를 걸러 냈습니다.');
    return { overall, tox, note: notes.join(' ') };
  }
  function score() {
    let s = 0;
    if (hasDomestic()) s += 2;
    if (labelsClean()) s += 1;
    if (S.cart.includes('club') && !labelsClean()) s -= 1;
    if (S.launch === 'delay') s += 2;
    if (S.th >= 90) s += 2; else if (S.th >= 70) s += 1;
    if (nShots() >= 3) s += 1; // 사용자가 갓·주름·밑동을 모두 찍으면 AI가 비교할 단서가 늘어남
    return Math.max(0, s);
  }
  const W = () => (S.ad === 'revise' ? 1 : 0) + (S.warn === 'top' ? 1 : 0);
  const appResult = () => S.th >= 90 ? 'unk' : score() >= 4 ? 'toxic' : 'edible';
  function ending() {
    if (S.th >= 90) return 'E5';
    if (score() >= 4) return 'E1';
    if (!S.ate) return 'E2';
    return S.log === 'on' ? 'E3' : 'E4';
  }
  function risks() {
    return {
      data: [
        [!hasDomestic(), '국내 수목원 표본을 담지 않았다', '국내 수목원 표본을 담았다'],
        [!labelsClean(), S.labelSkipped ? (S.cart.includes('club') ? '동호회 사진을 쓰면서 이름표 검수를 건너뛰었다' : '이름표 검수를 건너뛰었다') : '틀린 이름표를 놓쳤다', '이름표를 꼼꼼히 검수했다']
      ],
      developer: [
        [S.launch === 'today', '마감에 맞춰 오늘 출시했다', '2주 미루고 데이터를 보강했다'],
        [S.th < 70, `신뢰도 기준을 ${S.th}%로 낮게 두었다`, `신뢰도 기준을 ${S.th}%로 정했다`],
        [S.log === 'off', '판별 기록을 저장하지 않았다', '판별 기록을 저장했다']
      ],
      deployer: [
        [S.ad === 'approve', '"버섯 걱정 끝" 광고를 승인했다', '과장 광고 수정을 요청했다'],
        [S.warn === 'bottom', '경고문을 화면 맨 아래에 작게 두었다', '경고문을 결과 바로 위에 크게 두었다']
      ],
      user: [
        [appResult() === 'edible' && nShots() < 3, `사진을 ${nShots()}장만 찍었다`, nShots() >= 3 ? '갓·주름·밑동을 모두 찍었다' : `사진 ${nShots()}장을 찍었다`],
        [appResult() === 'edible' && S.share === 'plain', '"식용이래!"만 단톡방에 올렸다', S.share === 'care' ? '주의 문구와 함께 단톡방에 알렸다' : S.share === 'plain' ? '판별 결과를 단톡방에 알렸다' : '단톡방에 올리지 않았다'],
        [!!S.ate, '확인 없이 따서 먹었다', S.userChoice === 'check' ? '선생님께 확인했다' : '버섯을 두고 갔다'],
        [S.report === 'no', '앱 오류를 알고도 신고하지 않았다', S.report === 'yes' ? '앱 오류를 개발팀에 신고했다' : '앱이 틀리지 않아 신고할 일이 없었다']
      ]
    };
  }
  const riskCount = k => risks()[k].filter(x => x[0]).length;

  /* ---------- mushroom drawing (게임 전용 자료) ---------- */
  const SPECIES = {
    egg: { name: '노란달걀버섯', cap: '#f0a020', gill: '#f6d24a', stem: '#f6d24a', ring: '#f6d24a', volva: '#ffffff', edible: true },
    forsythia: { name: '개나리광대버섯', cap: '#f3cf3a', gill: '#ffffff', stem: '#f5ecc8', ring: '#ffffff', volva: '#ffffff', edible: false },
    shiitake: { name: '표고', cap: '#7a4a2a', gill: '#f4efe2', stem: '#e8dcc2', ring: null, volva: null, edible: true }
  };
  function mush(k) {
    const m = SPECIES[k], o = '#294b40';
    const px = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
    let s = `<svg viewBox="0 0 40 44" shape-rendering="crispEdges" role="img" aria-label="${m.name} 그림">`;
    s += px(10, 4, 20, 2, o) + px(6, 6, 28, 2, o) + px(4, 8, 32, 6, o) + px(2, 14, 36, 4, o);
    s += px(10, 6, 20, 2, m.cap) + px(6, 8, 28, 6, m.cap) + px(4, 14, 32, 2, m.cap) + px(12, 7, 4, 2, 'rgba(255,255,255,.45)');
    s += px(4, 16, 32, 4, o) + px(6, 16, 28, 2, m.gill);
    for (let x = 8; x < 34; x += 4) s += px(x, 16, 1, 2, 'rgba(0,0,0,.25)');
    s += px(16, 18, 8, 22, o) + px(17, 18, 6, 22, m.stem);
    if (m.ring) s += px(13, 23, 14, 3, o) + px(14, 23, 12, 2, m.ring);
    if (m.volva) s += px(12, 34, 16, 8, o) + px(13, 35, 14, 6, m.volva) + px(17, 34, 6, 2, m.stem);
    else s += px(14, 40, 12, 2, o);
    return s + '</svg>';
  }

  /* ---------- drag (터치·마우스, 누르기로도 대체 가능) ---------- */
  function draggable(el, { zones, onDrop, onTap }) {
    let sx, ghost = null, moved = false, over = null, sy;
    el.addEventListener('pointerdown', e => { if (e.button) return; sx = e.clientX; sy = e.clientY; moved = false; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      if (sx === undefined) return;
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return;
      if (!moved) {
        moved = true; const r = el.getBoundingClientRect();
        ghost = el.cloneNode(true); ghost.classList.add('ga-ghost'); ghost.style.width = r.width + 'px';
        ghost._ox = sx - r.left; ghost._oy = sy - r.top; root.appendChild(ghost);
      }
      ghost.style.left = (e.clientX - ghost._ox) + 'px'; ghost.style.top = (e.clientY - ghost._oy) + 'px';
      over = zones().find(z => { const r = z.getBoundingClientRect(); return e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom; }) || null;
      zones().forEach(z => z.classList.toggle('over', z === over));
    });
    const end = () => {
      if (sx === undefined) return;
      if (moved) { ghost && ghost.remove(); zones().forEach(z => z.classList.remove('over')); if (over) onDrop(over); } else if (onTap) onTap();
      sx = undefined; ghost = null; over = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => { ghost && ghost.remove(); sx = undefined; ghost = null; zones().forEach(z => z.classList.remove('over')); });
    el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && onTap) { e.preventDefault(); onTap(); } });
  }
  const pick = (sel, fn) => $$(sel).forEach(b => b.onclick = () => { $$(sel).forEach(x => x.setAttribute('aria-pressed', x === b)); snd('tap'); fn(b.dataset.v, b); });

  /* ---------- 0 START ---------- */
  function sTitle() {
    stage.innerHTML = `<section class="ga-title">
      <div class="ee-panel ga-stack">
        <span class="ga-eyebrow">책임성 · 중·고등</span>
        <h1>버섯도감 AI의<br><em>네 사람</em></h1>
        <p class="ga-lead">사진 한 장으로 버섯 이름을 알려 주는 앱. 그 앱을 만들고, 내놓고, 쓰는 네 사람의 자리에 차례로 서 봅니다.</p>
        <div class="ga-row"><button class="ee-button" id="ga-start" type="button">탐험을 시작합니다</button><span class="ga-hint">약 18분 · 1인 1기기</span></div>
        ${resumeBox()}
      </div>
      ${banner('ai_lab', [['data', 470, 600], ['developer', 590, 610], ['guide', 640, 520], ['deployer', 700, 610], ['user', 820, 600]])}
    </section>`;
    $('#ga-start').onclick = () => { snd('door'); login(); };
    if ($('#ga-resume')) $('#ga-resume').onclick = () => {
      const v = store.get('progress', null); if (!v) return;
      S = Object.assign(blank(), v); snd('door'); go(S.scene);
    };
  }
  function resumeBox() {
    const v = store.get('progress', null);
    if (!v || !v.player || !(v.scene >= 2 && v.scene <= 8)) return '';
    const where = { 2: '데이터 수집자', 3: '개발자', 4: '배포자', 5: '사용자', 6: '책임 연결선 맵', 7: '엔딩', 8: '사례 탐구' }[v.scene];
    return `<div class="ee-notice ga-stack"><p><b>${esc(v.player.name)}</b>님이 하던 탐험이 있어요 · ${where} 장면</p>
      <div class="ga-row"><button class="ee-button secondary" id="ga-resume" type="button">이어서 하기</button><span class="ga-hint">새로 시작하면 이 기록은 지워져요.</span></div></div>`;
  }
  function login() {
    stage.innerHTML = `<section class="ee-panel ga-login ga-stack" style="max-width:560px;margin:24px auto 0;width:100%">
      <span class="ga-eyebrow">탐험가 등록</span>
      <h2>탐험에서 쓸 닉네임을 정하세요</h2>
      <p class="ga-hint">진짜 이름이나 학번 대신 별명을 써 주세요. 닉네임은 대사와 생각 카드에만 쓰이고, 이 기기 밖으로 전송되지 않아요.</p>
      <form id="ga-lf" novalidate class="ga-stack">
        <label for="ga-nick"><b>닉네임 (2~10자)</b></label>
        <input id="ga-nick" autocomplete="off" maxlength="10" placeholder="예: 버섯탐정" value="${esc(S.player ? S.player.name : '')}">
        <div class="ga-err" id="ga-lerr" role="alert"></div>
        <div class="ga-nav"><button class="ee-button secondary" type="button" id="ga-back">뒤로</button><button class="ee-button" type="submit">탐험대 입장 ▶</button></div>
      </form></section>`;
    $('#ga-nick').focus();
    $('#ga-back').onclick = () => go(0);
    $('#ga-lf').addEventListener('submit', ev => {
      ev.preventDefault();
      const name = $('#ga-nick').value.trim().replace(/\s+/g, ' ');
      if (name.length < 2) { $('#ga-lerr').textContent = '닉네임을 2글자 이상 입력하세요.'; $('#ga-nick').focus(); return; }
      if (/^\d+$/.test(name)) { $('#ga-lerr').textContent = '학번처럼 숫자만 쓰지 말고 별명으로 정해 주세요.'; $('#ga-nick').focus(); return; }
      store.del('progress'); S.player = { name }; loadRefl(); snd('collect'); go(1);
    });
  }

  /* ---------- 1 INTRO ---------- */
  const LAB_CREW = [['data', 430, 620], ['developer', 560, 640], ['guide', 660, 560], ['deployer', 760, 640], ['user', 890, 620]];
  function sPrologue() {
    talk([
      { who: 'guide', expr: 'happy', text: `어서 와요, <b>${esc(nick())}</b>! 여기는 윤리시티 AI 실습실이에요. 오늘은 <b>버섯도감 AI</b>라는 앱이 만들어지는 과정을 함께 시뮬레이션해 볼 거예요.` },
      { who: 'guide', expr: 'explaining', text: '사진 한 장만 찍으면 버섯 이름을 알려 주는 앱이에요. 새봄, 온유, 지호, 하늘이 각자 맡은 일이 있어요. 오늘은 당신이 <b>네 사람의 자리</b>에 차례로 서 보는 거예요.' },
      { who: 'guide', expr: 'neutral', text: '정답을 맞히는 시간이 아니에요. 그 자리에 있다면 실제로 했을 선택을 해 주세요. 어떤 일이 일어났는지는 마지막에 함께 확인해요.', btn: '오늘의 순서 보기 ▶' }
    ], roleCards, 'ai_lab', LAB_CREW);
  }
  function roleCards() {
    const what = { data: 'AI가 공부할 사진을 모아요', developer: '모델을 시험하고 출시를 정해요', deployer: '앱 소개 화면을 심사해요', user: '앱으로 버섯을 찍어 봐요' };
    stage.innerHTML = `<section class="ee-panel ga-stack" style="max-width:940px;margin:0 auto;width:100%">
      <span class="ga-eyebrow">장면 1 · 오늘의 순서</span><h2>오늘 서 볼 네 자리</h2>
      <p>앱이 만들어져 사용자에게 닿기까지, 네 사람의 자리에 차례로 서 봅니다. 각 자리에서 내린 선택은 다음 사람에게 그대로 이어져요.</p>
      <ol class="ga-roles">${ROLE_KEYS.map((k, i) => `<li class="ga-rcard ${i ? '' : 'now'}"><span class="ee-badge">${i + 1}번째</span>${face(k, i ? 'neutral' : 'happy')}<b>${CAST[k].role}</b><small>${CAST[k].name}<br>${what[k]}</small></li>`).join('')}</ol>
      <div class="ga-nav"><button class="ee-button" id="ga-go" type="button">${CAST.data.name}의 자리로 ▶</button></div></section>`;
    paint(stage); $('#ga-go').focus({ preventScroll: true });
    $('#ga-go').onclick = () => { snd('door'); go(2); };
  }

  /* ---------- 2 데이터 수집자 ---------- */
  const DATA_STEPS = ['사진 고르기', '이름표 검수'];
  function sData() {
    stage.innerHTML = `<div class="ga-scene">${who('data', '예산 100코인으로 AI가 공부할 버섯 사진을 모으고, 이름표를 검수합니다.', 'library', [['data', 640, 650, 'down', 1.8]], '장면 2 · 도서관 자료실')}<div id="ga-step"></div></div>`;
    paint(stage); stepCart();
  }
  function stepCart() {
    showStep(`<section class="ee-panel ga-stack">${stepBar(DATA_STEPS, 0)}
        <h2>어떤 사진으로 AI를 가르칠까요?</h2>
        <p>예산은 <b>100코인</b>이에요. 카드를 끌어 장바구니에 넣거나 눌러서 담으세요. 사진이 많을수록 AI가 많이 배우지만, 어떤 사진인지도 중요해요.</p>
        <div class="ga-cards" id="ga-sets">${DATASETS.map(d => `<div class="ee-choice ga-dcard" tabindex="0" role="button" data-id="${d.id}" aria-label="${d.name} 담기">
          <b>${d.name}</b><span class="ga-price">${d.price}코인 · 사진 ${d.count}</span><small>${d.note}</small></div>`).join('')}</div>
        <div class="ga-row" style="align-items:stretch">
          <div class="ga-drop" id="ga-cart" style="flex:1 1 280px"><span class="ga-eyebrow">장바구니</span><div id="ga-cartlist" class="ga-stack" style="gap:6px"></div></div>
          <div class="ga-stack" style="flex:0 0 150px;justify-content:center;gap:4px"><span class="ga-eyebrow">남은 예산</span><span class="ga-coins" id="ga-coins">100코인</span><span id="ga-bonus"></span></div>
        </div>
        ${navBtns(false, '이 사진으로 학습시키기 ▶', true)}
      </section>`);
    const spent = () => S.cart.reduce((a, c) => a + DATASETS.find(d => d.id === c).price, 0);
    const add = id => {
      if (S.cart.includes(id)) return;
      const d = DATASETS.find(x => x.id === id);
      if (d.price > 100 - spent()) { snd('miss'); toast('예산이 부족해요. 장바구니에서 빼고 다시 담아 보세요.'); return; }
      S.cart.push(id); snd('collect'); fx('clue', $('#ga-cart')); paintCart();
    };
    const paintCart = () => {
      const left = 100 - spent();
      $('#ga-coins').textContent = left + '코인'; $('#ga-coins').classList.toggle('low', left < 30);
      const photos = S.cart.reduce((a, c) => a + parseInt(DATASETS.find(d => d.id === c).count.replace(/\D/g, ''), 10), 0);
      $('#ga-bonus').innerHTML = S.cart.length ? `<span class="ga-hint">학습 사진 ${photos.toLocaleString()}장</span>` : '';
      $('#ga-cartlist').innerHTML = S.cart.length ? S.cart.map(c => { const d = DATASETS.find(x => x.id === c); return `<div class="ga-cart-item"><span>${d.name} · ${d.count}</span><button type="button" data-rm="${c}" aria-label="${d.name} 빼기">빼기</button></div>`; }).join('') : '<span class="ga-hint">여기에 데이터 카드를 놓으세요</span>';
      $$('.ga-dcard').forEach(c => { const inn = S.cart.includes(c.dataset.id); c.classList.toggle('in', inn); c.setAttribute('aria-pressed', inn); });
      $$('[data-rm]').forEach(b => b.onclick = () => { S.cart = S.cart.filter(x => x !== b.dataset.rm); snd('tap'); paintCart(); });
      $('#ga-next').disabled = !S.cart.length;
    };
    $$('.ga-dcard').forEach(c => draggable(c, { zones: () => [$('#ga-cart')], onDrop: () => add(c.dataset.id), onTap: () => add(c.dataset.id) }));
    paintCart();
    $('#ga-next').onclick = () => { snd('tap'); stepLabels(); };
  }
  function stepLabels() {
    S.labels = {}; S.labelSkipped = false;
    const feat = { egg: '주름 <b>노란색</b> · 턱받이 노란색', forsythia: '주름 <b>흰색</b> · 턱받이 흰색', shiitake: '갈색 갓 · 턱받이 없음' };
    showStep(`<section class="ee-panel ga-stack">${stepBar(DATA_STEPS, 1)}
          <h2>이름표, 정말 맞을까요?</h2>
          <p>이름표가 틀린 사진이 섞이면 AI는 틀린 답을 배웁니다. 도감 카드와 비교해 이름표가 <b>맞음 / 틀림</b>을 골라 보세요.</p>
          <div class="ga-refs compact">${['egg', 'forsythia', 'shiitake'].map(k => `<div class="ee-notice ga-ref">${mush(k)}<div><b>${SPECIES[k].name} ${SPECIES[k].edible ? '(식용)' : '(맹독)'}</b>${feat[k]}</div></div>`).join('')}</div>
          <div class="ga-labels">${LABELS.map((l, i) => `<div class="ga-lab">${mush(l.draw)}<span class="ee-badge">${l.tag}</span>
            <div class="ga-yn"><button type="button" class="ee-choice" data-i="${i}" data-v="1" aria-pressed="false">맞음</button><button type="button" class="ee-choice" data-i="${i}" data-v="0" aria-pressed="false">틀림</button></div></div>`).join('')}</div>
          <p class="ga-hint">게임용으로 단순화한 특징입니다. 실제 야생 버섯은 이것만으로 구별할 수 없어요.</p>
          ${navBtns(true, '검수 완료 ▶', true, '<button class="ee-button secondary" id="ga-skip" type="button">검수 건너뛰기</button>')}
        </section>`);
    $$('.ga-yn .ee-choice').forEach(b => b.onclick = () => {
      S.labels[b.dataset.i] = b.dataset.v === '1'; snd('tap');
      $$(`.ga-yn .ee-choice[data-i="${b.dataset.i}"]`).forEach(x => x.setAttribute('aria-pressed', x === b));
      $('#ga-next').disabled = Object.keys(S.labels).length < LABELS.length;
    });
    $('#ga-prev').onclick = () => { snd('tap'); stepCart(); };
    $('#ga-skip').onclick = () => { S.labelSkipped = true; S.labels = {}; snd('tap'); toast('검수를 건너뛰고 다음 단계로 넘어갑니다.'); setTimeout(() => go(3), 600); };
    $('#ga-next').onclick = () => { snd('paper'); toast('이름표 5장을 모두 살펴봤어요.'); setTimeout(() => go(3), 600); };
  }

  /* ---------- 3 개발자 ---------- */
  const CONF = [97, 94, 91, 88, 86, 83, 79, 76, 72, 68, 64, 58];
  const DEV_STEPS = ['결과 보기', '출시 시기', '신뢰도 기준', '판별 기록'];
  function sDev() {
    stage.innerHTML = `<div class="ga-scene">${who('developer', '모델을 시험하고 출시 시기, 신뢰도 기준, 기록 저장을 정합니다.', 'ai_lab', [['developer', 640, 650, 'down', 1.8]], '장면 3 · AI 실습실')}<div id="ga-step"></div></div>`;
    paint(stage); devStep(0);
  }
  function devStep(i) {
    const { overall: acc, tox, note } = accInfo();
    const recap = `<div class="ee-notice ga-msg">${icon('warning')}<p><b>팀장 메시지</b> · 경쟁 앱이 다음 주에 나온대요. 오늘 꼭 올려 주세요! ${acc}%면 충분하잖아요?</p></div>`;
    let body = '';
    if (i === 0) body = `<h2>테스트 결과가 나왔어요</h2>
          <div class="ga-dash">
            <div class="ga-row" style="align-items:flex-end"><div><span class="ga-hint">전체 정확도</span><div class="ga-big">${acc}%</div></div><span class="ga-spacer"></span>
              <div class="ga-tabs" role="tablist"><button type="button" class="ee-choice" role="tab" aria-selected="true" aria-pressed="true" id="ga-t1">요약</button><button type="button" class="ee-choice" role="tab" aria-selected="false" aria-pressed="false" id="ga-t2">종별 정확도 보기</button></div></div>
            <div id="ga-tab"><p>테스트 사진 1,200장 가운데 ${Math.round(1200 * acc / 100)}장을 맞혔습니다. ${note}</p></div>
          </div>${recap}${navBtns(false, '다음 ▶', false)}`;
    if (i === 1) body = `<h2>출시는 언제 할까요?</h2>${recap}
          <div class="ga-choices">
            <button type="button" class="ee-choice ga-launch" data-v="today" ${pressed(S.launch, 'today')}><b>오늘 출시합니다</b><small>팀장 요청대로 마감을 지킨다</small></button>
            <button type="button" class="ee-choice ga-launch" data-v="delay" ${pressed(S.launch, 'delay')}><b>2주 미루고 독버섯 데이터를 보강합니다</b><small>경쟁 앱보다 늦어진다</small></button>
          </div>${navBtns(true, '다음 ▶', !S.launch)}`;
    if (i === 2) body = `<h2>신뢰도 기준을 정해요</h2>
          <p>AI의 확신이 이 값보다 낮으면 이름 대신 <b>"판별 불가"</b>를 보여 줍니다. 슬라이더를 움직여 미리보기를 살펴보세요.</p>
          <div class="ga-row"><label for="ga-th"><b>신뢰도 기준</b></label><span class="ga-spacer"></span><span class="ga-coins" id="ga-thv">${S.th}%</span></div>
          <input type="range" id="ga-th" min="50" max="95" step="5" value="${S.th}">
          <div class="ga-preview" id="ga-pv"></div>
          <div class="ga-row"><span class="ga-hint">예상 앱 별점</span><span class="ga-stars" id="ga-st"></span><span class="ga-hint" id="ga-stx"></span></div>
          ${navBtns(true, '다음 ▶', false)}`;
    if (i === 3) body = `<h2>판별 기록을 저장할까요?</h2>
          <p>사용자가 찍은 사진과 앱이 내놓은 답을 서버에 남겨 두는 기능입니다.</p>
          <div class="ga-choices">
            <button type="button" class="ee-choice ga-log" data-v="on" ${pressed(S.log, 'on')}><b>기록을 저장합니다</b><small>서버비 월 +20%</small></button>
            <button type="button" class="ee-choice ga-log" data-v="off" ${pressed(S.log, 'off')}><b>저장하지 않습니다</b><small>비용 절감</small></button>
          </div>${navBtns(true, '배포팀에 넘기기 ▶', !S.log)}`;
    showStep(`<section class="ee-panel ga-stack">${stepBar(DEV_STEPS, i)}${body}</section>`);
    if (i === 0) {
      const tab = on => { $('#ga-t1').setAttribute('aria-selected', !on); $('#ga-t1').setAttribute('aria-pressed', !on); $('#ga-t2').setAttribute('aria-selected', on); $('#ga-t2').setAttribute('aria-pressed', on); };
      $('#ga-t2').onclick = () => {
        if (!S.tabOpened) fx('clue', $('#ga-t2'));
        S.tabOpened = true; tab(true); snd('paper');
        $('#ga-tab').innerHTML = `<div class="ga-bars">${[['표고', 97], ['노란달걀버섯', 93], ['개나리광대버섯', tox]].map(([n, v]) => `<div class="ga-bar"><span>${n}</span><div class="ga-track"><div class="ga-fill ${v < 85 ? 'warn' : ''}" data-w="${v}" style="width:0"></div></div><span class="ga-v">${v}%${v < 85 ? ' ▲' : ''}</span></div>`).join('')}</div>
        <p><b>맹독성 개나리광대버섯을 알아보는 비율은 ${tox}%입니다.</b> 나머지는 대부분 노란달걀버섯(식용)으로 판정했습니다.</p>`;
        requestAnimationFrame(() => requestAnimationFrame(() => $$('#ga-tab .ga-fill').forEach(f => { f.style.width = f.dataset.w + '%'; })));
      };
      $('#ga-t1').onclick = () => { tab(false); snd('tap'); };
    }
    if (i === 1) pick('.ga-launch', v => { S.launch = v; $('#ga-next').disabled = false; });
    if (i === 2) {
      const pv = () => {
        $('#ga-thv').textContent = S.th + '%';
        $('#ga-pv').innerHTML = CONF.map(c => c >= S.th ? `<div class="ga-tile">${c}%</div>` : '<div class="ga-tile unk">판별<br>불가</div>').join('');
        const unk = CONF.filter(c => c < S.th).length / CONF.length;
        $('#ga-st').textContent = '★ ' + Math.max(1.5, 4.7 - unk * 3.2).toFixed(1);
        $('#ga-stx').textContent = unk > .5 ? '"맨날 판별 불가래요" 리뷰가 쏟아질 듯' : unk > .2 ? '가끔 답을 안 준다는 불만' : '사용자 만족';
      };
      $('#ga-th').oninput = e => { S.th = +e.target.value; pv(); };
      pv();
    }
    if (i === 3) pick('.ga-log', v => { S.log = v; $('#ga-next').disabled = false; });
    if ($('#ga-prev')) $('#ga-prev').onclick = () => { snd('tap'); devStep(i - 1); };
    $('#ga-next').onclick = () => { if (i < 3) { snd('tap'); devStep(i + 1); } else { snd('door'); go(4); } };
  }

  /* ---------- 4 배포자 ---------- */
  const DEP_STEPS = ['광고 문구', '경고문 위치', '연령 등급'];
  function sDeploy() {
    const AD = `"정확도 ${accInfo().overall}%! 이제 버섯 걱정 끝"`, AD2 = '사진으로 버섯 이름을 알아보는 학습용 앱';
    stage.innerHTML = `<div class="ga-scene">${who('deployer', '앱마켓 심사를 맡았어요. 앱 소개 화면이 사용자에게 어떻게 보일지 정합니다.', 'classroom', [['deployer', 640, 650, 'down', 1.8]], '장면 4 · 교실 심사 회의')}
      <div class="ga-editor"><div id="ga-step"></div>
        <div class="ga-phone" aria-label="앱 상세 화면 미리보기"><div class="ga-screen">
          <div class="ga-apphead"><div class="ga-appicon">${mush('egg')}</div><div><b style="font-size:17px">버섯도감 AI</b><br><span class="ga-hint">교육 · 생활</span></div></div>
          <div id="ga-adline" class="ga-ad">${AD}</div>
          <button type="button" class="ga-slot" id="ga-slotTop" data-v="top">결과 바로 위 (크게)</button>
          <div style="border:2px solid #b3c19c;border-radius:4px;padding:8px;text-align:center"><div style="max-width:64px;margin:0 auto">${mush('egg')}</div><b style="color:var(--ee-green)">노란달걀버섯</b><br><span class="ga-hint">판별 결과 예시</span></div>
          <div style="flex:1"></div>
          <button type="button" class="ga-slot" id="ga-slotBot" data-v="bottom">화면 맨 아래 (작게)</button>
        </div></div>
      </div></div>`;
    paint(stage);
    const phone = () => {
      $('#ga-adline').textContent = S.ad === 'revise' ? AD2 : AD;
      $$('.ga-slot').forEach(s => {
        const on = s.dataset.v === S.warn;
        s.className = 'ga-slot' + (on ? ' filled ' + (S.warn === 'top' ? 'large' : 'small') : '');
        s.textContent = on ? '⚠ 식용 여부 판단에 사용하지 마세요' : (s.dataset.v === 'top' ? '결과 바로 위 (크게)' : '화면 맨 아래 (작게)');
      });
    };
    const place = slot => { S.warn = slot.dataset.v; snd('collect'); phone(); if ($('#ga-chiphome')) { $('#ga-chiphome').innerHTML = '<span class="ga-hint">경고문을 놓았어요. 다른 자리를 누르면 옮길 수 있어요.</span>'; $('#ga-next').disabled = false; } };
    $$('.ga-slot').forEach(s => s.onclick = () => place(s));
    const step = i => {
      let body = '';
      if (i === 0) body = `<h2>광고 문구를 심사해요</h2><p>개발팀이 제출한 문구입니다. 오른쪽 앱 화면에 어떻게 보이는지 확인하세요.</p><div class="ga-ad">${AD}</div>
            <div class="ga-choices">
              <button type="button" class="ee-choice ga-adc" data-v="approve" ${pressed(S.ad, 'approve')}><b>그대로 승인합니다</b><small>숫자가 사실이면 문제없다</small></button>
              <button type="button" class="ee-choice ga-adc" data-v="revise" ${pressed(S.ad, 'revise')}><b>수정을 요청합니다</b><small>"${AD2}"</small></button>
            </div>${navBtns(false, '다음 ▶', !S.ad)}`;
      if (i === 1) body = `<h2>경고문을 어디에 둘까요?</h2><p>경고문을 끌어 오른쪽 앱 화면의 두 자리 중 한 곳에 놓으세요. 자리를 눌러도 됩니다.</p>
            <div id="ga-chiphome">${S.warn ? '<span class="ga-hint">경고문을 놓았어요. 다른 자리를 누르면 옮길 수 있어요.</span>' : '<span class="ga-warnchip" id="ga-wchip" tabindex="0" role="button">⚠ 식용 여부 판단에 사용하지 마세요</span>'}</div>
            ${navBtns(true, '다음 ▶', !S.warn)}`;
      if (i === 2) body = `<h2>연령 등급을 정해요</h2>
            <div class="ga-seg">${['전체', '12세', '15세'].map(a => `<button type="button" class="ee-choice ga-age" data-v="${a}" ${pressed(S.age, a)}>${a}</button>`).join('')}</div>
            <p class="ga-hint">연령 등급은 결과에 영향을 주지 않고 토론 자료로만 쓰입니다.</p>
            ${navBtns(true, '심사 완료, 출시 ▶', !S.age)}`;
      showStep(`<section class="ee-panel ga-stack">${stepBar(DEP_STEPS, i)}${body}</section>`);
      if (i === 0) pick('.ga-adc', v => { S.ad = v; phone(); $('#ga-next').disabled = false; });
      if (i === 1 && $('#ga-wchip')) draggable($('#ga-wchip'), { zones: () => $$('.ga-slot'), onDrop: z => place(z), onTap: () => toast('오른쪽 앱 화면의 자리를 눌러 경고문을 놓으세요') });
      if (i === 2) pick('.ga-age', v => { S.age = v; $('#ga-next').disabled = false; });
      if ($('#ga-prev')) $('#ga-prev').onclick = () => { snd('tap'); step(i - 1); };
      $('#ga-next').onclick = () => { if (i < 2) { snd('tap'); step(i + 1); } else { snd('door'); go(5); } };
    };
    phone(); step(0);
  }

  /* ---------- 5 사용자: 교내 생물 다양성 조사 ---------- */
  const PARTS = { cap: '갓 윗면', gill: '주름', base: '밑동' };
  const nShots = () => (S.shots || []).length;
  const conf = () => [87, 74, 66][Math.max(0, nShots() - 1)];
  const SHARE = {
    edible: { plain: `앱이 식용이래! 확신 ${'{c}'}% 🍄 화단 나무 밑에 많음`, care: '앱은 식용이래. 근데 확실하지 않으니 따지 말자' },
    toxic: { plain: '앱이 독버섯이래! 화단 버섯 만지지 마', care: '앱이 독버섯이래. 확실한 건 선생님께 여쭤보자, 만지지 마' },
    unk: { plain: '앱이 판별 불가래. 무슨 버섯이지?', care: '앱도 모른대. 만지지 말고 선생님께 여쭤보자' }
  };
  const shareText = (r, v) => SHARE[r][v].replace('{c}', conf());
  function sUser() {
    Object.assign(S, { shots: [], share: null, userChoice: null, ate: null, report: null, pushed: false });
    stage.innerHTML = `<div class="ga-scene">${who('user', '통합과학 「우리 학교 생물 다양성 조사」 시간이에요. 비 온 다음 날, 화단 나무 밑에서 노란 버섯을 발견했어요.', 'courtyard', [['user', 560, 650, 'right', 1.8], ['friend', 740, 650, 'left', 1.8]], '장면 5 · 학교 화단')}
      <div class="ga-editor"><div id="ga-step"></div>
        <div class="ga-phone" aria-label="버섯도감 AI 화면"><div class="ga-screen" id="ga-uphone"></div></div>
      </div></div>`;
    paint(stage);
    let r = null;
    const resultBox = () => {
      const verdict = { edible: ['식용 가능', `노란달걀버섯 · 확신 ${conf()}%`], toxic: ['독버섯 의심', '개나리광대버섯 · 맹독'], unk: ['판별 불가', '전문가에게 확인하세요'] }[r];
      return `${S.warn === 'top' ? '<div class="ga-warn-big">⚠ 식용 여부 판단에 사용하지 마세요</div>' : ''}
        <div class="ga-result ${r}"><div style="width:84px">${mush('forsythia')}</div><div class="ga-verdict">${verdict[0]}</div><div class="ga-hint">${verdict[1]}</div><div class="ga-hint">사진 ${nShots()}장으로 판별</div></div>
        ${S.warn === 'bottom' ? '<div class="ga-warn-small">※ 식용 여부 판단에 사용하지 마세요</div>' : ''}`;
    };
    const phone = mode => {
      let h = '<b>버섯도감 AI</b>';
      if (mode === 'cam') {
        h += `<span class="ga-hint">갓·주름·밑동을 찍으면 더 정확해요</span>
          <div class="ga-cam" id="ga-cam"><div class="ga-cammush">${mush('forsythia')}</div>
            ${Object.keys(PARTS).map(p => `<button type="button" class="ga-hot ga-hot-${p} ${S.shots.includes(p) ? 'done' : ''}" data-p="${p}" aria-label="${PARTS[p]} 찍기"><span>${PARTS[p]}</span></button>`).join('')}</div>
          <div class="ga-shots">${Object.keys(PARTS).map(p => `<div class="ga-shot ${S.shots.includes(p) ? 'on' : ''}">${S.shots.includes(p) ? `<div class="ga-crop ga-crop-${p}">${mush('forsythia')}</div>` : ''}<small>${PARTS[p]}</small></div>`).join('')}</div>`;
      } else if (mode === 'sent') {
        h += `<div class="ee-success ga-stack"><b>✓ 오류 신고가 접수됐어요</b><span>판별 결과 화면과 사진 ${nShots()}장이 개발팀에 전달됩니다.</span></div>${resultBox()}`;
      } else h += resultBox();
      $('#ga-uphone').innerHTML = h;
      $$('#ga-uphone .ga-hot').forEach(b => b.onclick = () => shoot(b.dataset.p));
    };
    const dline = () => ['오, 노란 버섯이다! 빨리 찍어 보자.', '찍었네! 한 장이면 충분하지 않아? 종 치기 전에 결과 보자~', '또 찍어? 빨리빨리~', '꼼꼼하네. 이제 결과 보자!'][nShots()];
    const shoot = p => {
      if (S.shots.includes(p)) { toast('이미 찍은 부분이에요'); return; }
      S.shots.push(p); snd('tap'); step(0);
      const cam = $('#ga-cam');
      if (cam && !reduced()) { const fl = document.createElement('div'); fl.className = 'ga-flash'; cam.appendChild(fl); setTimeout(() => fl.remove(), 260); }
      fx('clue', $(`#ga-uphone .ga-hot-${p}`));
    };
    const steps = () => r === 'edible' ? USER_STEPS : USER_STEPS.slice(0, 4);
    const step = i => {
      let body = '';
      if (i === 0) body = `<h2>버섯을 찍어 판별해 보세요</h2>
          <p>오른쪽 앱 화면에서 찍을 부분을 누르세요. 아래 버튼으로도 찍을 수 있어요. 여러 부분을 찍을수록 AI가 비교할 단서가 많아져요.</p>
          <div class="ga-seg">${Object.keys(PARTS).map(p => `<button type="button" class="ee-choice ga-part" data-p="${p}" aria-pressed="${S.shots.includes(p)}">📷 ${PARTS[p]}</button>`).join('')}</div>
          <div class="ga-msg">${face('friend', nShots() === 1 || nShots() === 2 ? 'worried' : 'happy')}<div class="ee-speech" style="flex:1;min-height:auto"><p class="ee-speaker">다온</p>${dline()}</div></div>
          ${navBtns(false, `판별 요청 (사진 ${nShots()}장) ▶`, !nShots())}`;
      if (i === 1) {
        const line = { edible: `식용이래! 확신 ${conf()}%. 조사 끝나고 따 가서 저녁에 라면에 넣자.`, toxic: '독버섯이래… 만지지 말자.', unk: '판별 불가래. 먹어도 되는 건지 모르겠다.' }[r];
        body = `<h2>판별 결과가 나왔어요</h2><p>오른쪽 앱 화면을 확인하세요.</p>
          <div class="ga-msg">${face('friend', r === 'edible' ? 'happy' : 'worried')}<div class="ee-speech" style="flex:1;min-height:auto"><p class="ee-speaker">다온</p>${line}</div></div>
          ${navBtns(false, '다음 ▶', false)}`;
      }
      if (i === 2) {
        const reply = !S.share ? '' : S.share === 'none' ? '<p class="ga-hint">단톡방에는 아무것도 올리지 않았어요.</p>'
          : `<div class="ga-bub me">${esc(shareText(r, S.share))}</div><div class="ga-bub"><b>준우</b> ${r === 'edible' && S.share === 'plain' ? '오 진짜? 이따 나도 따 가야지 ㅋㅋ' : S.share === 'care' ? 'ㅇㅋ 안 건드릴게!' : '헐 조심해야겠다'}</div>`;
        body = `<h2>반 단톡방에 결과를 올릴까요?</h2>
          <div class="ga-chat"><span class="ga-hint">「1학년 생물 조사」 단톡방</span><div class="ga-bub"><b>준우</b> 우리 조는 무당벌레 찾음 🐞 화단에 버섯 엄청 많던데 그거 뭐야?</div>${reply}</div>
          <div class="ga-choices">${[['plain', '결과만 올린다', shareText(r, 'plain')], ['care', '주의 문구와 함께 올린다', shareText(r, 'care')], ['none', '올리지 않는다', '우리 조 일만 하면 된다']].map(o => `<button type="button" class="ee-choice ga-sh" data-v="${o[0]}" ${pressed(S.share, o[0])}><b>${o[1]}</b><small>${esc(o[2])}</small></button>`).join('')}</div>
          ${navBtns(true, '다음 ▶', !S.share)}`;
      }
      if (i === 3) {
        let opts = r === 'edible'
          ? [['eat', '따 가서 저녁에 먹는다', '앱이 식용이라고 했으니까'], ['check', '선생님께 확인한다', '번거롭지만 확실하게'], ['leave', '그냥 두고 간다', '괜히 건드리지 않는다']]
          : [['check', '선생님께 확인한다', '어떤 버섯인지 물어본다'], ['leave', '그냥 두고 간다', '건드리지 않는다']];
        if (r === 'edible' && W() >= 1) opts = [opts[1], opts[0], opts[2]];
        const push = S.pushed && S.userChoice === null;
        body = `<h2>이 버섯을 어떻게 할까요?</h2>
          ${push ? `<div class="ga-msg">${face('friend', 'explaining')}<div class="ee-speech" style="flex:1;min-height:auto"><p class="ee-speaker">다온</p>선생님 지금 교무실 가셨대. 앱이 ${conf()}%라잖아, 그냥 따 가자!</div></div>
            <div class="ga-choices"><button type="button" class="ee-choice ga-uc" data-v="check" aria-pressed="false"><b>그래도 선생님께 확인한다</b><small>교무실까지 다녀온다</small></button><button type="button" class="ee-choice ga-uc" data-v="eat" aria-pressed="false"><b>알았어, 따 가서 먹자</b><small>다온 말대로 한다</small></button></div>`
          : `<div class="ga-choices">${opts.map(o => `<button type="button" class="ee-choice ga-uc" data-v="${o[0]}" ${pressed(S.userChoice, o[0])}><b>${o[1]}</b><small>${o[2]}</small></button>`).join('')}</div>`}
          ${navBtns(!push, r === 'edible' ? '다음 ▶' : '장면 마치기 ▶', !S.userChoice)}`;
      }
      if (i === 4) {
        const reveal = {
          check: `${face('teacher', 'worried')}<div class="ee-speech" style="flex:1;min-height:auto"><p class="ee-speaker">선생님</p>이건 개나리광대버섯이야. 맹독이 있어서 절대 먹으면 안 돼!</div>`,
          leave: `${face('teacher', 'worried')}<div class="ee-speech" style="flex:1;min-height:auto"><p class="ee-speaker">다음 날 아침 · 선생님 공지</p>화단의 노란 버섯은 개나리광대버섯(맹독)입니다. 절대 따지 마세요.</div>`,
          eat: `${face('user', 'worried')}<div class="ee-speech" style="flex:1;min-height:auto"><p class="ee-speaker">그날 밤</p>배가 아파 병원에 갔어요. "독버섯 중독이 의심됩니다."</div>`
        }[S.userChoice];
        body = `<h2>앱이 틀렸어요</h2><div class="ga-msg">${reveal}</div>
          <p>${S.share === 'plain' ? '<b class="ga-warnline">단톡방을 본 준우도 화단 버섯을 따 갔대요.</b> ' : ''}앱은 "식용 가능"이라고 했어요. 이 사실을 개발팀에 알릴까요?</p>
          <div class="ga-choices">${[['yes', '앱에서 오류 신고하기', `판별 결과 화면과 사진 ${nShots()}장을 보낸다`], ['no', '그냥 넘어간다', '신고해도 달라질 게 없을 것 같다']].map(o => `<button type="button" class="ee-choice ga-rp" data-v="${o[0]}" ${pressed(S.report, o[0])}><b>${o[1]}</b><small>${o[2]}</small></button>`).join('')}</div>
          ${navBtns(false, '장면 마치기 ▶', !S.report)}`;
      }
      showStep(`<section class="ee-panel ga-stack ga-tight">${stepBar(steps(), i)}${body}</section>`);
      phone(i === 0 ? 'cam' : S.report === 'yes' ? 'sent' : 'result');
      if (i === 0) $$('.ga-part').forEach(b => b.onclick = () => shoot(b.dataset.p));
      if (i === 2) pick('.ga-sh', v => { S.share = v; snd('paper'); step(2); });
      if (i === 3) pick('.ga-uc', v => {
        if (r === 'edible' && v === 'check' && !S.pushed) { S.pushed = true; S.userChoice = null; snd('miss'); step(3); return; }
        S.userChoice = v; S.ate = v === 'eat'; $('#ga-next').disabled = false;
      });
      if (i === 4) pick('.ga-rp', v => { S.report = v; snd(v === 'yes' ? 'collect' : 'tap'); phone(v === 'yes' ? 'sent' : 'result'); $('#ga-next').disabled = false; });
      if ($('#ga-prev')) $('#ga-prev').onclick = () => { snd('tap'); if (i === 3) { S.pushed = false; S.userChoice = null; S.ate = null; } step(i - 1); };
      $('#ga-next').onclick = () => {
        if (i === 0) { r = appResult(); snd('paper'); }
        if (i === 3 && r !== 'edible') { snd('door'); go(6); return; }
        if (i === 4) { snd('door'); go(6); return; }
        snd('tap'); step(i + 1);
      };
    };
    step(0);
  }
  const USER_STEPS = ['촬영', '결과', '단톡방', '결정', '신고'];

  /* ---------- 6 RESULT: 책임 연결선 맵 ---------- */
  const NODE = { data: [18, 22], developer: [82, 22], deployer: [18, 76], user: [82, 76] };
  const momentLabel = () => S.ate ? '사고' : appResult() === 'edible' ? '아슬아슬한 순간' : '만약 사고가 났다면';
  function mapHTML(showRec, drawIn) {
    const total = ROLE_KEYS.reduce((a, k) => a + riskCount(k), 0);
    let lines = '', tags = '';
    ROLE_KEYS.forEach(k => {
      const [x, y] = NODE[k];
      lines += `<line x1="${x}" y1="${y}" x2="50" y2="50" stroke="#f3cf72" stroke-width="${3 + S.my[k] / 7}" stroke-dasharray="10 7" vector-effect="non-scaling-stroke"/>`;
      if (showRec) {
        const share = total ? riskCount(k) / total * 100 : 0, blind = S.log === 'off' && k !== 'user';
        if (share && !blind) lines += `<line class="${drawIn ? 'ga-draw' : ''}" pathLength="1" x1="50" y1="50" x2="${x}" y2="${y}" stroke="#bf7865" stroke-width="${2 + share / 6}" vector-effect="non-scaling-stroke"/>`;
        if (blind) lines += `<line x1="${x}" y1="${y}" x2="50" y2="50" stroke="#a8bb8c" stroke-width="3" stroke-dasharray="3 6" vector-effect="non-scaling-stroke"/>`;
        tags += `<span class="ga-pct ${blind ? 'blind' : ''} ${drawIn ? 'ga-late' : ''}" style="left:${x * .38 + 31}%;top:${y * .38 + 31}%">${blind ? '기록 없음' : '기록 ' + Math.round(share) + '%'}</span>`;
      }
    });
    if (S.report === 'yes') {
      lines += `<line x1="93" y1="68" x2="93" y2="30" stroke="#5f8f5a" stroke-width="4" vector-effect="non-scaling-stroke"/>`;
      tags += '<span class="ga-flag">오류 신고 ↑</span>';
    }
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${tags}
      <div class="ga-center ${S.ate ? 'hurt' : ''}">${momentLabel()}</div>
      ${ROLE_KEYS.map(k => `<div class="ga-node" style="left:${NODE[k][0]}%;top:${NODE[k][1]}%">${face(k, S.ate ? 'worried' : 'neutral')}<span>${CAST[k].role} ${S.my[k]}%</span></div>`).join('')}
      <div class="ga-legend"><span><i></i>내가 나눈 책임</span>${showRec ? '<span><i class="rec"></i>기록에 남은 위험 쪽 선택</span>' : ''}${S.report === 'yes' ? '<span><i class="rep"></i>사용자 → 개발자 오류 신고</span>' : ''}</div>`;
  }
  function sResult() {
    S.opened = false;
    const head = S.ate
      ? `${banner('nurse', [['user', 560, 600, 'down', .85], ['teacher', 700, 600, 'left']], 'short', '보건실')}<div class="ee-notice"><b>소식</b> · 학교 화단에서 딴 야생 버섯을 먹은 고등학생이 복통으로 병원에 옮겨졌어요. 다행히 회복 중이에요.</div>`
      : `${banner('courtyard', [['user', 560, 600], ['friend', 650, 610], ['teacher', 740, 600, 'left']], 'short', '학교 화단')}<div class="ee-success"><b>조사 소식</b> · 오늘 생물 다양성 조사는 무사히 끝났어요. <button type="button" class="ee-button secondary" id="ga-other" style="margin-left:8px">그날의 다른 가능성 보기</button><span id="ga-otherbox" hidden> ${appResult() === 'edible' ? '앱 말만 믿고 따 가서 먹었다면' : '만약 앱이 "식용 가능 87%"라고 답했고, 확인 없이 따 가서 먹었다면'} 같은 날 사고가 났을 수 있어요. 결과는 네 사람의 선택이 어떻게 쌓이느냐에 달려 있었어요.</span></div>`;
    stage.innerHTML = `<div class="ga-stack">${head}
      <div class="ga-mapgrid">
        <div class="ga-map" id="ga-map">${mapHTML(false)}</div>
        <section class="ee-panel ga-stack">
          <span class="ga-eyebrow">장면 6 · 책임 연결선 맵</span>
          <h2>책임은 누구에게 얼마나 있을까요?</h2>
          <p>${S.ate ? '이 사고에 대해' : appResult() === 'edible' ? '이 아슬아슬한 순간에 대해' : '만약 사고가 났다면'} 네 사람의 책임을 어떻게 나눌지 정해 보세요. 합계가 100%가 되어야 합니다.</p>
          <div class="ga-stack">${ROLE_KEYS.map(k => `<div class="ga-sl">${face(k)}<div><label for="ga-r-${k}">${CAST[k].role} · ${CAST[k].name}</label><input type="range" id="ga-r-${k}" min="0" max="100" step="5" value="${S.my[k]}"></div><span class="ga-v" id="ga-p-${k}">${S.my[k]}%</span></div>`).join('')}</div>
          <div class="ga-row"><b class="ga-sum" id="ga-sum"></b><span class="ga-spacer"></span><button class="ee-button secondary" id="ga-even" type="button">똑같이 나누기</button></div>
          <h3>가장 큰 책임을 준 이유</h3>
          <div class="ga-reason">${['알고도 위험을 감수했다', '마지막에 결정했다', '결과를 바꿀 힘이 가장 컸다', '이익을 가장 많이 얻었다'].map(r => `<button type="button" class="ee-choice" aria-pressed="false">${r}</button>`).join('')}</div>
          <div class="ga-nav"><button class="ee-button" id="ga-open" type="button" disabled>기록 열어 보기</button></div>
        </section>
      </div>
      <div id="ga-records"></div></div>`;
    if ($('#ga-other')) $('#ga-other').onclick = () => { $('#ga-otherbox').hidden = false; $('#ga-other').remove(); snd('paper'); };
    const refresh = () => {
      const sum = ROLE_KEYS.reduce((a, k) => a + S.my[k], 0);
      $('#ga-sum').textContent = `합계 ${sum}%` + (sum === 100 ? ' ✓' : ' (100%가 되도록 맞춰 주세요)');
      $('#ga-sum').className = 'ga-sum ' + (sum === 100 ? 'ok' : 'bad');
      ROLE_KEYS.forEach(k => $('#ga-p-' + k).textContent = S.my[k] + '%');
      $('#ga-map').innerHTML = mapHTML(S.opened, justOpened); justOpened = false; paint($('#ga-map'));
      $('#ga-open').disabled = !(sum === 100 && S.reason);
    };
    ROLE_KEYS.forEach(k => $('#ga-r-' + k).oninput = e => { S.my[k] = +e.target.value; refresh(); });
    $('#ga-even').onclick = () => { ROLE_KEYS.forEach(k => { S.my[k] = 25; $('#ga-r-' + k).value = 25; }); snd('tap'); refresh(); };
    pick('.ga-reason .ee-choice', (v, b) => { S.reason = b.textContent; refresh(); });
    let justOpened = false;
    $('#ga-open').onclick = () => { S.opened = true; justOpened = true; snd('door'); refresh(); records(); };
    refresh();
  }
  function records() {
    const R = risks(), total = ROLE_KEYS.reduce((a, k) => a + riskCount(k), 0), blind = S.log === 'off';
    $('#ga-records').innerHTML = `<section class="ee-panel ga-stack">
      <span class="ga-eyebrow">게임이 남긴 기록</span><h2>네 사람의 선택</h2>
      <p>▲는 위험 쪽으로 기운 선택, ●는 안전 쪽 선택입니다. 맵의 붉은 실선 굵기가 기록에 남은 위험 쪽 선택의 비율이에요.${total ? '' : ' 이번 탐험에서는 위험 쪽 선택이 없었어요.'}</p>
      ${blind ? '<div class="ee-notice"><b>판별 기록이 없어요.</b> 개발 단계에서 기록을 저장하지 않아서, 앱이 실제로 무엇이라고 표시했는지 증명할 수 없어요. 앱 회사는 "사용자가 결과를 잘못 읽었을 수 있다"고 말하고, 책임은 마지막 사람에게 몰려요. 맵에서 사용자를 뺀 세 줄이 "기록 없음"으로 보이는 이유예요.</div>' : ''}
      <div class="ga-recs">${ROLE_KEYS.map(k => `<div class="ga-rec">${face(k)}<div><b>${CAST[k].role} · ${CAST[k].name}</b> <span class="ga-hint">내가 준 책임 ${S.my[k]}% · 기록 ${blind && k !== 'user' ? '확인 불가' : (total ? Math.round(riskCount(k) / total * 100) : 0) + '%'}</span>
        <ul>${R[k].map(([bad, b, g]) => `<li class="${bad ? 'risk' : 'safe'}">${bad ? b : g}</li>`).join('')}${k === 'developer' && S.tabOpened ? '<li class="risk">종별 정확도를 열어 보았다 (알고 있었다)</li>' : ''}</ul></div></div>`).join('')}</div>
      <div class="ga-nav"><button class="ee-button" id="ga-end" type="button">엔딩 보기 ▶</button></div></section>`;
    paint($('#ga-records'));
    $('#ga-records').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    $('#ga-end').onclick = () => go(7);
  }

  /* ---------- 7 ENDING ---------- */
  const ENDINGS = {
    E1: { t: '안전한 하루', q: '앱이 독버섯을 알아보았어요. 여러 사람의 선택이 겹겹이 안전망이 되었어요.', ask: '어느 단계 하나가 빠졌다면 결과가 달라졌을까요?', expr: 'happy' },
    E2: { t: '아슬아슬한 구조', q: '앱은 틀렸지만, 마지막에 당신이 멈췄어요.', ask: '사고를 막는 책임을 마지막 사용자에게만 맡겨도 될까요?', expr: 'worried' },
    E3: { t: '모두의 사고', q: '기록을 따라가면 네 사람 모두의 선택이 보여요.', ask: '책임을 나눌 때 무엇을 기준으로 삼아야 할까요? 알고 있었는지, 바꿀 수 있었는지, 이익을 얻었는지 생각해 봐요.', expr: 'worried' },
    E4: { t: '추적 불가', q: '앱이 무엇이라고 했는지 아무도 증명할 수 없어요. 책임은 사용자에게 돌아갔어요.', ask: 'AI의 작동 기록을 법으로 의무화해야 할까요? 그 비용과 개인정보 문제는요?', expr: 'worried' },
    E5: { t: '너무 조심한 앱', q: '아무도 다치지 않았어요. 하지만 별점 2.1, 한 달 뒤 서비스가 문을 닫았어요.', ask: '책임을 피하려다 기술의 이로움까지 포기한 것은 아닐까요?', expr: 'explaining' }
  };
  function userNotes() {
    const n = [];
    if (S.share === 'plain' && appResult() === 'edible') n.push('단톡방을 본 준우도 화단 버섯을 따 갔어요. 내 공유가 다른 사람의 위험이 될 수도 있어요.');
    if (S.report === 'yes') n.push(S.log === 'off' ? '앱에 기록이 없었지만, 당신이 신고하며 보낸 결과 화면이 앱이 틀렸다는 증거가 되었어요. 개발팀은 다음 업데이트에서 판별을 고쳤어요.' : '당신의 오류 신고로 개발팀이 개나리광대버섯 판별을 고쳤어요. 다음 사용자는 같은 실수를 겪지 않아요.');
    if (S.report === 'no') n.push('아무도 신고하지 않아, 같은 오류가 다른 사용자에게 계속될 수 있어요.');
    return n;
  }
  function pathChips() {
    const ds = S.cart.map(c => DATASETS.find(d => d.id === c).name).join('+');
    return [ds, S.labelSkipped ? '검수 건너뜀' : '이름표 검수', S.launch === 'today' ? '오늘 출시' : '2주 보강', '신뢰도 기준 ' + S.th + '%', S.log === 'on' ? '기록 저장' : '기록 안 함', S.ad === 'approve' ? '광고 승인' : '광고 수정 요청', S.warn === 'top' ? '경고문 크게' : '경고문 작게', `사진 ${nShots()}장`, { plain: '단톡 결과만 공유', care: '단톡 주의와 공유', none: '단톡 안 올림' }[S.share] || '단톡 안 올림', S.ate ? '먹음' : S.userChoice === 'check' ? '선생님께 확인' : '두고 감'].concat(S.report ? [S.report === 'yes' ? '오류 신고' : '신고 안 함'] : []);
  }
  function sEnding() {
    const e = ending(), E = ENDINGS[e];
    const knew = S.tabOpened && (e === 'E3' || e === 'E4') ? '<p><b>그리고 개발자 자리에서 당신은 독버섯 인식률이 낮다는 것을 알고 있었어요.</b> 알고도 출시한 것과 모르고 출시한 것의 책임은 같을까요?</p>' : '';
    stage.innerHTML = `<div class="ga-stack">${banner('classroom', [['guide', 640, 600]], 'short', '장면 7 · 엔딩')}
      <div class="ga-ending">
        <div class="ee-panel ga-code"><b>${e}</b><span>${E.t}</span></div>
        <section class="ee-panel ga-stack">
          <div class="ga-quote">${E.q}</div>${knew}${userNotes().map(t => `<p>${t}</p>`).join('')}
          <div class="ga-talk" style="grid-template-columns:96px minmax(0,1fr)">${face('guide', E.expr)}<div class="ee-speech" style="min-height:auto"><p class="ee-speaker">안내 로봇 · 함께 생각해 봐요</p>${E.ask}</div></div>
          <span class="ga-eyebrow">내가 지나온 선택 경로</span>
          <div class="ga-path">${pathChips().map(c => `<span class="ee-badge">${esc(c)}</span>`).join('')}</div>
          <div class="ga-nav"><button class="ee-button secondary" id="ga-again" type="button">처음부터 다시</button><button class="ee-button" id="ga-cases" type="button">실제 사례 살펴보기 ▶</button></div>
        </section></div></div>`;
    snd('win');
    $('#ga-again').onclick = restart;
    $('#ga-cases').onclick = () => go(8);
  }
  function restart() { const p = S.player; store.del('progress'); S = blank(); S.player = p; loadRefl(); go(0); }

  /* ---------- 8 실제 사례 + 생각 정리 ---------- */
  const CASES = [
    { id: 'kfs', when: '2026.9 · 한국', title: '산림청 "AI로 독버섯 판별하지 마세요"', roles: ['사용자', '개발자'],
      pts: ['산림청이 가을철 독버섯 주의보를 내며 생성형 AI나 사진 판별 서비스의 답도 믿지 말라고 당부했습니다.', '같은 종도 자라는 상태와 환경에 따라 모습이 달라지고, 다른 종끼리 비슷해 보일 수 있기 때문입니다.', '국내 자생 버섯 2,389종 가운데 식용으로 확인된 것은 418종(17%)입니다. 노란달걀버섯과 닮은 맹독성 개나리광대버섯이 대표 사례로 꼽혔습니다.'],
      q: '정부가 미리 경고했는데도 사고가 난다면, 그건 사용자만의 책임일까요?',
      links: [['쿠키뉴스 (2026.9.7)', 'https://www.kukinews.com/article/view/kuk202609070158'], ['OECD AI 사건 모니터 기록', 'https://oecd.ai/en/incidents/2026-09-07-53bc']] },
    { id: 'books', when: '2023 · 미국', title: 'AI가 쓴 버섯 채집 책, 온라인 서점에서 판매', roles: ['배포자', '개발자'],
      pts: ['뉴욕균학회가 아마존 등에서 AI가 쓴 것으로 보이는 버섯 채집·식별 안내서가 팔리고 있다고 경고했습니다.', '저자와 경력은 지어낸 것으로 보였고, 잘못된 설명은 독버섯을 먹는 사고로 이어질 수 있다고 했습니다.', '아마존은 이 문제를 "살펴보고 있다"고 답했습니다.'],
      q: '책을 쓴 사람이 누군지 모를 때, 그 책을 판 서점(플랫폼)에는 어떤 책임이 있을까요?',
      links: [['Fortune (2023.9.3)', 'https://fortune.com/2023/09/03/ai-written-mushroom-hunting-guides-sold-on-amazon-potentially-deadly']] },
    { id: 'aircanada', when: '2024 · 캐나다', title: '챗봇이 잘못 안내한 환불 규정, 회사가 책임', roles: ['배포자(제공자)'],
      pts: ['에어캐나다 챗봇이 가족상 할인 요금을 여행이 끝난 뒤에도 신청할 수 있다고 잘못 안내했습니다.', '회사는 챗봇이 스스로 책임지는 별개의 존재라고 주장했습니다.', '분쟁조정 재판소는 챗봇을 포함해 웹사이트의 모든 정보는 회사 책임이라며 약 650캐나다달러를 배상하라고 결정했습니다.'],
      q: '"AI가 한 말"이라고 하면 회사의 책임이 줄어들까요?',
      links: [['American Bar Association (2024.2.29)', 'https://www.americanbar.org/groups/business_law/resources/business-law-today/2024-february/bc-tribunal-confirms-companies-remain-liable-information-provided-ai-chatbot/']] },
    { id: 'uber', when: '2018 · 미국', title: '자율주행 시험차 보행자 사망 사고', roles: ['사용자', '개발자'],
      pts: ['애리조나에서 우버의 자율주행 시험차가 자전거를 끌고 길을 건너던 보행자를 치어 숨지게 했습니다.', '차에 탄 안전 운전자는 휴대전화를 보고 있었고, 2023년 위험 초래 혐의를 인정해 보호관찰 3년을 받았습니다.', '검찰은 우버를 기소하지 않았지만, 미국 교통안전위원회는 우버의 부실한 안전 절차도 원인으로 지적했습니다.'],
      q: '마지막에 지켜보던 사람만 처벌받는 것은 공정할까요?',
      links: [['AP 통신 보도 (NY1, 2023.7.28)', 'https://ny1.com/nyc/all-boroughs/ap-top-news/2023/07/28/the-backup-driver-in-the-1st-death-by-a-fully-autonomous-car-pleads-guilty-to-endangerment']] },
    { id: 'tesla', when: '2025 · 미국', title: '배심원단 "테슬라에도 사고 책임 33%"', roles: ['개발자', '사용자'],
      pts: ['2019년 플로리다에서 오토파일럿을 켠 테슬라 차량이 정지 신호를 지나쳐 주차된 차를 들이받았고, 보행자 1명이 숨지고 1명이 다쳤습니다.', '운전자는 떨어뜨린 휴대전화를 찾느라 아래를 보고 있었습니다.', '2025년 배심원단은 테슬라의 책임을 33%로 보고 약 2억 4300만 달러를 물어 주라고 평결했습니다. 테슬라는 운전자 책임이라며 항소하겠다고 밝혔습니다.'],
      q: '장면 6에서 내가 나눈 책임 비율과 비교하면 어떤가요?',
      links: [['CarComplaints (2025.8)', 'https://www.carcomplaints.com/news/2025/miami-tesla-autopilot-trial-jury-verdict.shtml'], ['Local 10 News (2025.8.1)', 'https://local10.com/news/local/2025/08/01/in-300m-verdict-miami-federal-jury-finds-tesla-partly-liable-in-autopilot-crash-suit']] },
    { id: 'own', when: '직접 찾기', title: '내가 찾은 뉴스로 정리하기', roles: ['자유'], own: true }
  ];
  const SEARCHES = ['AI 사고 책임', '챗봇 잘못된 답변 책임', '자율주행 사고 책임', 'AI 판별 오류 피해'];
  function sCases() {
    stage.innerHTML = `<div class="ga-stack">${banner('library', [['data', 520, 610, 'right'], ['guide', 660, 560], ['user', 800, 610, 'left']], 'short', '사례 탐구 · 도서관')}
      <section class="ee-panel ga-stack">
        <span class="ga-eyebrow">사례 탐구</span>
        <h2>게임 밖에서도 같은 질문이 일어나고 있어요</h2>
        <p>사례 하나를 골라 읽고 원문 기사도 열어 보세요. 마음에 드는 사례가 없으면 마지막 카드에서 직접 뉴스를 찾아도 됩니다.</p>
        <div class="ga-cases">${CASES.map(c => `<button type="button" class="ee-choice ga-case ${c.own ? 'own' : ''}" data-id="${c.id}" data-v="${c.id}" aria-pressed="${S.caseId === c.id}"><span class="ga-when">${c.when}</span><b>${c.title}</b><span class="ga-roles-mini">${c.roles.map(r => `<span class="ee-badge">${r}</span>`).join('')}</span></button>`).join('')}</div>
      </section>
      <div id="ga-cd"></div></div>`;
    pick('.ga-case', v => { S.caseId = v; saveRefl(); caseDetail(); });
    if (S.caseId) caseDetail(true);
  }
  function caseDetail(quiet) {
    const c = CASES.find(x => x.id === S.caseId), R = S.refl;
    const body = c.own
      ? `<p>아래 검색어를 눌러 뉴스를 찾아보세요. 새 창에서 열립니다. 찾은 기사의 제목과 주소를 생각 정리에 적으면 됩니다.</p>
         <div class="ga-chips">${SEARCHES.map(q => `<a class="ee-button secondary" style="text-decoration:none" target="_blank" rel="noopener" href="https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(q)}">${q} ↗</a>`).join('')}</div>
         <p class="ga-hint">기사를 고를 때: 날짜가 있는지, 누가 썼는지, 다른 언론도 같은 내용을 보도했는지 확인하세요.</p>`
      : `<ul>${c.pts.map(p => `<li>${p}</li>`).join('')}</ul>
         <div class="ee-notice"><b>생각해 볼 질문</b> · ${c.q}</div>
         <div class="ga-links ga-stack" style="gap:4px"><span class="ga-eyebrow">원문 기사</span>${c.links.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t} ↗</a>`).join('')}</div>`;
    $('#ga-cd').innerHTML = `<section class="ee-panel ga-stack">
      <div class="ga-detail ga-stack"><span class="ga-when ga-hint">${c.when}</span><h2>${c.title}</h2>${body}</div>
      <h2 style="margin-top:12px">생각 정리</h2>
      <form class="ga-form" id="ga-rf" novalidate>
        ${c.own ? `<div class="ga-q"><label for="ga-q-title">내가 찾은 기사 제목과 주소</label><input type="text" id="ga-q-title" value="${esc(R.title)}" placeholder="예: ○○일보, 2026.10.○ / 기사 주소"></div>` : ''}
        <div class="ga-q"><span class="ga-ql">이 사례에서 책임이 있는 주체를 모두 고르세요</span>
          <div class="ga-chips" id="ga-q-who">${['데이터 수집자', '개발자', '배포자·제공자', '사용자', '정부·제도'].map(w => `<button type="button" class="ee-choice" aria-pressed="${(R.who || []).includes(w)}">${w}</button>`).join('')}</div></div>
        <div class="ga-q"><label for="ga-q-most">가장 큰 책임은 누구에게 있다고 생각하나요? 이유는?</label><textarea id="ga-q-most" placeholder="예: 개발자. 위험한 버섯을 잘 못 알아본다는 걸 알면서도 출시했기 때문이다.">${esc(R.most)}</textarea></div>
        <div class="ga-q"><label for="ga-q-fix">같은 일이 다시 일어나지 않으려면 무엇이 필요할까요? (규칙이나 제도 한 가지)</label><textarea id="ga-q-fix" placeholder="예: 위험한 판단을 하는 AI는 작동 기록을 반드시 남기게 한다.">${esc(R.fix)}</textarea></div>
        <div class="ga-q"><label for="ga-q-me">게임 속 내 선택과 비교해 보니, 생각이 바뀐 점은?</label><textarea id="ga-q-me" placeholder="예: 게임에서는 사용자 책임을 크게 줬는데, 기사를 보니 회사 책임도 크다는 생각이 들었다.">${esc(R.me)}</textarea></div>
        <div class="ga-nav"><button class="ee-button" type="submit">생각 카드 만들기 ▶</button></div>
      </form>
      <div id="ga-cardout"></div></section>`;
    if (!quiet) { snd('paper'); $('#ga-cd').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); }
    const sync = () => {
      if ($('#ga-q-title')) S.refl.title = $('#ga-q-title').value;
      S.refl.most = $('#ga-q-most').value; S.refl.fix = $('#ga-q-fix').value; S.refl.me = $('#ga-q-me').value;
      S.refl.who = $$('#ga-q-who .ee-choice').filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent);
      saveRefl();
    };
    $$('#ga-q-who .ee-choice').forEach(b => b.onclick = () => { b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); snd('tap'); sync(); });
    $('#ga-rf').addEventListener('input', sync);
    $('#ga-rf').addEventListener('submit', ev => {
      ev.preventDefault(); sync();
      const R2 = S.refl, e = ending();
      if (!R2.most || !R2.most.trim()) { toast('가장 큰 책임에 대한 생각을 적어 주세요'); $('#ga-q-most').focus(); return; }
      const caseName = c.own ? (R2.title || '직접 찾은 기사') : c.title;
      const text = `[윤리시티 · 책임성 생각 카드]\n닉네임: ${nick()}\n내 엔딩: ${e} ${ENDINGS[e].t}\n고른 사례: ${caseName}\n책임 주체: ${(R2.who || []).join(', ') || '-'}\n가장 큰 책임: ${R2.most}\n재발 방지: ${R2.fix || '-'}\n바뀐 생각: ${R2.me || '-'}`;
      $('#ga-cardout').innerHTML = `<div class="ee-success ga-thinkcard ga-stack" style="margin-top:12px">
        <span class="ga-eyebrow">생각 카드 · ${esc(nick())} · ${e} ${ENDINGS[e].t}</span>
        <h3>${esc(caseName)}</h3>
        <dl><dt>책임 주체</dt><dd>${esc((R2.who || []).join(', ') || '-')}</dd><dt>가장 큰 책임</dt><dd>${esc(R2.most)}</dd><dt>재발 방지</dt><dd>${esc(R2.fix || '-')}</dd><dt>바뀐 생각</dt><dd>${esc(R2.me || '-')}</dd></dl>
        <p class="ga-hint">아래에서 탐구 기록 PDF를 저장해 제출하세요. PDF가 안 되면 글을 복사하거나 화면을 캡처해도 돼요.</p>
        <div class="ee-notice ga-stack ga-pdfbox">
          <b>탐구 기록 PDF로 제출하기</b>
          <div class="ga-idrow"><div class="ga-q"><label for="ga-sid">학번</label><input type="text" id="ga-sid" inputmode="numeric" maxlength="6" placeholder="예: 10101" value="${esc(pdfId.sid)}"></div><div class="ga-q"><label for="ga-sname">이름 (PDF 제출용)</label><input type="text" id="ga-sname" maxlength="10" placeholder="이름" value="${esc(pdfId.name)}"></div></div>
          <p class="ga-hint">학번과 이름은 이 기기의 PDF 파일에만 쓰이고 다른 곳으로 보내지 않아요. 저장도 하지 않아요.</p>
          <div class="ga-row"><span class="ga-hint" id="ga-pdfst" role="status" style="margin-right:auto"></span><button class="ee-button secondary" id="ga-copy" type="button">글 복사하기</button><button class="ee-button" id="ga-pdf" type="button">PDF로 저장</button></div>
        </div>
        <div class="ga-nav"><button class="ee-button" id="ga-done" type="button">탐험 마무리하기 ▶</button></div>
        <textarea id="ga-copytext" readonly hidden style="width:100%;min-height:150px;border:3px solid #9fae87;border-radius:4px;padding:8px;font-family:inherit">${esc(text)}</textarea></div>`;
      snd('collect'); fx('correct', $('#ga-cardout'));
      $('#ga-cardout').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      $('#ga-copy').onclick = () => {
        const fallback = () => { const t = $('#ga-copytext'); t.hidden = false; t.focus(); t.select(); toast('글을 선택했어요. 길게 눌러 복사하세요'); };
        try { navigator.clipboard.writeText(text).then(() => toast('복사했어요'), fallback); } catch (err) { fallback(); }
      };
      $('#ga-pdf').onclick = () => downloadPDF(c);
      $('#ga-sid').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); pdfId.sid = e.target.value; });
      $('#ga-sname').addEventListener('input', e => { pdfId.name = e.target.value; });
      $('#ga-done').onclick = () => go(9);
    });
  }

  /* ---------- 9 COMPLETE ---------- */
  function sComplete() {
    stage.innerHTML = `<div class="ga-stack">${banner('courtyard', [['data', 420, 610], ['developer', 520, 620], ['guide', 640, 560], ['deployer', 760, 620], ['user', 860, 610], ['friend', 960, 600]], '', '탐험 완료')}
      <div class="ga-complete">
        <section class="ee-panel ga-stack"><span class="ga-eyebrow">우리가 발견한 것</span>
          <ul><li>AI를 만들고, 내놓고, 쓰는 모든 단계에 사람의 결정이 들어 있어요.</li><li>하나의 사고에는 여러 사람의 선택이 얽혀 있어요.</li><li>작동 기록이 없으면 책임은 마지막 사람에게 몰리기 쉬워요.</li></ul></section>
        <section class="ee-panel ga-stack"><span class="ga-eyebrow">기억할 한 문장</span>
          <p style="font-size:20px;font-weight:700;line-height:1.6">"AI의 책임은 나누어질 수 있지만 사라지지 않아요. 내 자리에서 한 번 더 확인합니다."</p></section>
        <section class="ee-panel ga-stack"><span class="ga-eyebrow">다음 탐험</span>
          <p>교실에서 친구들과 엔딩을 비교하고, 가장 큰 책임이 누구에게 있는지 함께 이야기해 봐요.</p>
          <div class="ga-row"><button class="ee-button" id="ga-replay" type="button">다른 선택으로 다시 탐험하기</button></div>
          <p class="ga-hint">기기를 친구와 함께 쓴다면, PDF를 저장한 뒤 내 기록을 지워 주세요.</p>
          <div class="ga-row"><button class="ee-button secondary" id="ga-wipe" type="button">이 기기에서 내 기록 지우기</button></div></section>
      </div></div>`;
    snd('win');
    post({ type: 'ethicity:complete', gameId: GAME_ID, result: { completed: true } });
    $('#ga-replay').onclick = restart;
    $('#ga-wipe').onclick = () => { store.del(reflKey()); store.del('progress'); S.refl = {}; S.caseId = null; pdfId.sid = ''; pdfId.name = ''; snd('tap'); toast('이 기기에서 내 생각 정리 기록을 지웠어요.'); $('#ga-wipe').disabled = true; };
  }

  /* ---------- 탐구 기록 PDF (연대성 게임과 같은 방식: A4 캔버스 → JPEG → PDF) ---------- */
  function reportBlocks(c) {
    const B = [], d = new Date(), e = ending(), E = ENDINGS[e], R = risks(), R2 = S.refl;
    const total = ROLE_KEYS.reduce((a, k) => a + riskCount(k), 0), blind = S.log === 'off';
    B.push(['title', '버섯도감 AI의 네 사람 · 책임성 탐구 기록']);
    B.push(['meta', `학번: ${pdfId.sid}   ·   이름: ${pdfId.name}   ·   닉네임: ${nick()}   ·   작성일: ${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}   ·   윤리시티 AI 윤리 탐험대\n게임 속 앱·인물·수치는 학습용 가상 설정입니다. 버섯 특징은 학습용으로 단순화했습니다.`]);
    B.push(['h', `1. 우리의 선택 — ${e} ${E.t}`]);
    B.push(['body', E.q]);
    if (S.tabOpened && (e === 'E3' || e === 'E4')) B.push(['body', '개발자 자리에서 독버섯 인식률이 낮다는 것을 알고 있었다.']);
    userNotes().forEach(t => B.push(['body', t]));
    B.push(['note', '함께 생각해 볼 질문: ' + E.ask]);
    B.push(['h', '2. 네 자리에서 내린 선택']);
    ROLE_KEYS.forEach(k => {
      B.push(['sub', `${CAST[k].role} · ${CAST[k].name}`]);
      const lines = R[k].map(([bad, b, g]) => (bad ? '▲ ' + b : '● ' + g));
      if (k === 'developer' && S.tabOpened) lines.push('▲ 종별 정확도를 열어 보았다 (알고 있었다)');
      B.push(['body', lines.join('\n')]);
    });
    B.push(['note', '▲ 위험 쪽으로 기운 선택   ● 안전 쪽 선택']);
    B.push(['h', '3. 책임 나누기']);
    B.push(['body', ROLE_KEYS.map(k => `${CAST[k].role}: 내가 준 책임 ${S.my[k]}%  /  게임 기록 ${blind && k !== 'user' ? '확인 불가' : (total ? Math.round(riskCount(k) / total * 100) : 0) + '%'}`).join('\n')]);
    B.push(['body', '가장 큰 책임을 준 이유: ' + (S.reason || '(선택하지 않음)')]);
    if (blind) B.push(['note', '판별 기록을 저장하지 않아, 앱이 무엇이라고 표시했는지 증명할 수 없었다.']);
    B.push(['h', '4. 실제 사례']);
    if (c.own) B.push(['body', '직접 찾은 기사: ' + (R2.title || '(작성하지 않음)')]);
    else { B.push(['body', `${c.title} (${c.when})`]); B.push(['note', '원문: ' + c.links.map(([t, u]) => `${t} ${u}`).join('\n')]); }
    B.push(['h', '5. 생각 정리']);
    B.push(['sub', '책임이 있는 주체']); B.push(['body', (R2.who || []).join(', ') || '(선택하지 않음)']);
    B.push(['sub', '가장 큰 책임과 이유']); B.push(['body', R2.most || '(작성하지 않음)']);
    B.push(['sub', '재발 방지를 위한 규칙이나 제도']); B.push(['body', R2.fix || '(작성하지 않음)']);
    B.push(['sub', '게임 속 내 선택과 비교해 바뀐 생각']); B.push(['body', R2.me || '(작성하지 않음)']);
    B.push(['h', '6. 기억할 한 문장']);
    B.push(['body', 'AI의 책임은 나누어질 수 있지만 사라지지 않아요. 내 자리에서 한 번 더 확인합니다.']);
    return B;
  }
  function wrapText(ctx, text, maxW) {
    const L = [];
    for (const para of String(text).split('\n')) {
      if (!para) { L.push(''); continue; }
      let line = '';
      for (const ch of para) { if (line && ctx.measureText(line + ch).width > maxW) { L.push(line); line = ch; } else line += ch; }
      L.push(line);
    }
    return L;
  }
  function renderPages(c) {
    const pages = [], W = 1240, H = 1754, Mg = 90, FONT = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif';
    let cv, ctx, y, no = 0;
    const ST = { title: { s: 38, l: 56, c: '#294b40', b: 1, sp: 16 }, h: { s: 29, l: 44, c: '#5a8c65', b: 1, sp: 12 }, sub: { s: 24, l: 37, c: '#294b40', b: 1, sp: 6 }, meta: { s: 21, l: 33, c: '#6b7a6a', sp: 22 }, note: { s: 21, l: 33, c: '#56676f', sp: 10 }, body: { s: 23, l: 37, c: '#1d3039', sp: 18 } };
    const np = () => {
      cv = document.createElement('canvas'); cv.width = W; cv.height = H; ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#72b7c4'; ctx.fillRect(Mg, 52, 52, 6);
      ctx.fillStyle = '#5a8c65'; ctx.font = `bold 17px ${FONT}`; ctx.fillText('윤리시티 · 책임성 · 버섯도감 AI의 네 사람', Mg + 68, 63);
      ctx.strokeStyle = '#d8cfa8'; ctx.beginPath(); ctx.moveTo(Mg, H - 85); ctx.lineTo(W - Mg, H - 85); ctx.stroke();
      ctx.fillStyle = '#6b7a6a'; ctx.font = `18px ${FONT}`; ctx.fillText(`책임성 · ${pdfId.sid} ${pdfId.name}`, Mg, H - 52);
      ctx.textAlign = 'right'; ctx.fillText(String(++no), W - Mg, H - 52); ctx.textAlign = 'left';
      y = 130; pages.push(cv);
    };
    np();
    for (const [k, text] of reportBlocks(c)) {
      const s = ST[k] || ST.body, f = () => { ctx.font = `${s.b ? 'bold ' : ''}${s.s}px ${FONT}`; ctx.fillStyle = s.c; };
      f(); if (k === 'h') y += 10;
      const L = wrapText(ctx, text, W - Mg * 2);
      if (y + s.l * Math.min(L.length, 3) + (['title', 'h', 'sub'].includes(k) ? 90 : 0) > H - 120) { np(); f(); }
      for (const line of L) { if (y + s.l > H - 120) { np(); f(); } ctx.fillText(line, Mg, y); y += s.l; }
      y += s.sp;
    }
    return pages;
  }
  function pagesToPDF(pages) {
    const enc = new TextEncoder(), ch = [], off = [0]; let len = 0;
    const add = v => { const b = typeof v === 'string' ? enc.encode(v) : v; ch.push(b); len += b.length; };
    const obj = (n, h, d) => { off[n] = len; add(`${n} 0 obj\n${h}`); if (d) { add('\nstream\n'); add(d); add('\nendstream'); } add('\nendobj\n'); };
    add('%PDF-1.4\n%ETHICITY\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`);
    pages.forEach((cv, i) => {
      const p = 3 + i * 3, img = p + 1, st = p + 2, raw = atob(cv.toDataURL('image/jpeg', .92).split(',')[1]), bytes = Uint8Array.from(raw, v => v.charCodeAt(0));
      obj(p, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${st} 0 R >>`);
      obj(img, `<< /Type /XObject /Subtype /Image /Width ${cv.width} /Height ${cv.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>`, bytes);
      const cmd = enc.encode('q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ');
      obj(st, `<< /Length ${cmd.length} >>`, cmd);
    });
    const x = len, n = 3 + pages.length * 3;
    add(`xref\n0 ${n}\n0000000000 65535 f \n`);
    for (let i = 1; i < n; i++) add(String(off[i]).padStart(10, '0') + ' 00000 n \n');
    add(`trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`);
    return new Blob(ch, { type: 'application/pdf' });
  }
  async function downloadPDF(c) {
    const b = $('#ga-pdf'), st = $('#ga-pdfst');
    pdfId.sid = $('#ga-sid').value.trim(); pdfId.name = $('#ga-sname').value.trim();
    if (!/^\d{4,6}$/.test(pdfId.sid)) { st.style.color = 'var(--ee-red)'; st.textContent = '학번을 숫자 4~6자리로 입력해 주세요.'; $('#ga-sid').focus(); return; }
    if (pdfId.name.length < 2) { st.style.color = 'var(--ee-red)'; st.textContent = '이름을 입력해 주세요.'; $('#ga-sname').focus(); return; }
    st.style.color = ''; b.disabled = true; st.textContent = '만드는 중…';
    try {
      saveRefl();
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const pages = renderPages(c), pdf = pagesToPDF(pages);
      window.__lastPDF = { pages: pages.length, size: pdf.size };
      const url = URL.createObjectURL(pdf), a = document.createElement('a');
      a.href = url; a.download = `책임성_${pdfId.sid}_${pdfId.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')}_버섯도감AI.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      snd('paper'); st.style.color = 'var(--ee-green)'; st.textContent = `${pages.length}쪽 PDF를 저장했어요.`;
    } catch (err) {
      st.textContent = 'PDF를 만들지 못했어요. [글 복사하기]를 이용해 주세요.';
    } finally { b.disabled = false; }
  }

  const SCENES = [sTitle, sPrologue, sData, sDev, sDeploy, sUser, sResult, sEnding, sCases, sComplete];

  /* ---------- boot ---------- */
  (async () => {
    try {
      A = await EthicityAssets.load(window.ETHICITY_COMMON_MANIFEST, COMMON_BASE);
    } catch (err) {
      stage.innerHTML = `<div class="ee-notice">공통 자산을 불러오지 못했어요. 공통 팩 폴더 위치(${esc(COMMON_BASE)})를 확인해 주세요.<br><small>${esc(err.message)}</small></div>`;
      return;
    }
    tools();
    post({ type: 'ethicity:ready', gameId: GAME_ID });
    go(0);
  })();
})();
