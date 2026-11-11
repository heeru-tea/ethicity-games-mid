/*
 * 화면 처리 — 스토리 데이터(story.js)와 상태 엔진(engine.js)을 화면에 그린다.
 * 모든 이야기 문자열과 별명은 textContent·text node로만 넣는다(HTML로 해석하지 않음).
 * 이야기 글자 속 [[…]] = 강조(js/emph.js, 굵게만): rich()로 그리고, 화면 읽기·캔버스 말풍선·글자 비교에는 plain().
 */
(function () {
  'use strict';

  var story = window.PRIVACY_STORY;
  story.triggers = window.PRIVACY_WORLD.triggers; // 사건 입구 장면 앞에 맵 이동을 넣는다
  var E = window.PrivacyEngine;
  var S = window.PrivacyStorage;
  var CFG = window.PRIVACY_CONFIG || { characterImages: {}, defaultAvatar: 'assets/avatar-default.svg', defaultNickname: '플레이어' };

  var SPEED_MS = { normal: 1500, fast: 500, instant: 0 }; // 메시지 간격(ms): 한 개씩 '두욱' 소리와 함께, 읽을 틈을 두고(타자 효과가 꺼졌을 때)
  // 타자 효과(typer.js)가 켜져 있으면: 친구 메시지 앞 '입력 중…' → 글자가 주르륵 → 다 쳐진 뒤 잠깐 쉬고 다음 메시지
  var TYPING_MS = { normal: 450, fast: 150 }; // '입력 중…' 표시 시간
  var TYPE_GAP = { normal: 900, fast: 300 };  // 한 메시지를 다 친 뒤 다음 메시지까지
  var VIEW_ICON = { group: '👥', dm: '💬', sns: '📱', ai: '✦', pc: '🖥', place: '📍' };
  // 장면을 띄우는 기기: 폰(메신저·SNS) / 모니터(공용 PC·AI) / 없음(그 자리 대화 → 대화창)
  var DEVICE = { group: 'phone', dm: 'phone', sns: 'phone', ai: 'monitor', pc: 'monitor', place: 'none' };
  var WD = window.PRIVACY_WORLD;
  var VIEW_KIND = { group: '단체 대화방', dm: '개인 대화', sns: 'SNS', ai: 'AI 도우미', pc: '공용 컴퓨터', place: '장소' };

  /* ── 상태 ───────────────────────── */
  // 2026-11-09 지시서 B4: 별명이 없으면 '플레이어'가 아니라 고른 주인공 이름(온유·다온) — readPlayer는 별명이 없으면 ''를 돌려주고, 실제 표시 이름은 refreshName()이 정한다.
  //   공통 ethicity.player는 읽기만 한다(쓰지 않음 → 빈 별명이 저장될 일도 없다)
  var player = S.readPlayer('');
  player.storedNick = player.source === 'stored' ? player.nickname : '';
  var progress = { v: 1, run: null, explored: {}, endingsSeen: [], pos: null };
  var settings = { speed: 'normal', reduceMotion: false, look: null, sound: false, nickname: '', joystick: true, helpPlaces: [], helpFold: false }; // joystick: 터치 기기 가상 조이스틱 표시(2026-11-02)
  // helpPlaces·helpFold(2026-11-09 지시서 C5): 조작 안내를 본 장소(장면 그림 id, 최대 3개)·접었는지 — 세 번째 장소에 들어서면 접고, 메뉴 '조작 안내 다시 보기'로 다시
  var NAME_MAX = 10;
  // 이 게임에서만 쓰는 이름(공통 플레이어 정보가 없을 때). 제어 문자·앞뒤 공백을 빼고 10자까지
  // 주인공 이름(고른 모습 m = 온유, f = 다온) · 실제 별명(공통 정보 > 이 게임에서 적은 이름) · 화면에 쓸 이름(별명 없으면 주인공 이름)
  var HERO_NAME = { m: '온유', f: '다온' };
  function heroName() { return HERO_NAME[playerLook()] || ''; }
  function realNick() { return player.storedNick || (player.source === 'stored' ? '' : settings.nickname) || ''; }
  function refreshName() { player.nickname = realNick() || heroName() || CFG.defaultNickname; }
  // 시작 화면 한 줄: '온유 (별명: ○○)' / 별명이 없으면 '온유'
  function playerSummary() { var h = heroName(), n = realNick(); return (h || '아직 고르지 않음') + (n ? ' (별명: ' + n + ')' : ''); }
  function cleanName(v) { return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, NAME_MAX) : ''; }
  var revealTimer = null, revealQueue = [], revealDone = null;
  var typing = null, typingNode = null, typingDots = null; // 지금 쳐지는 메시지(typer 핸들·줄) / '입력 중…' 줄
  var pathBack = 'v-start', reflectBack = 'v-start';
  var noticeMsgs = [];
  var posTimer = null;
  var stagedScene = null, stageToken = 0, cutPending = false, spokenDevice = false;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  // 강조 그리기: 글자 조각 + <strong class="em"> (HTML 해석 없음)
  function rich(tag, cls, text) { var n = el(tag, cls); window.PrivacyEmph.render(n, text); return n; }
  var plain = window.PrivacyEmph.plain;
  // {name} = 별명. 별명 속 [[ ]]는 강조로 읽히지 않게(safe — 보기에는 같음)
  function fill(text) { return String(text).replace(/\{name\}/g, window.PrivacyEmph.safe(player.nickname)); }

  /* ── 불러오기·저장 ───────────────── */
  function loadAll() {
    var r = S.readJSON(S.KEYS.progress);
    if (!r.ok) noticeMsgs.push('저장된 진행 기록이 손상되어 새로 시작해요. (공통 캐릭터와 다른 게임 기록은 그대로예요)');
    var p = r.value;
    if (p && typeof p === 'object' && p.v === 1) {
      if (p.explored && typeof p.explored === 'object') progress.explored = p.explored;
      if (Array.isArray(p.endingsSeen)) progress.endingsSeen = p.endingsSeen.filter(function (c) { return typeof c === 'string'; });
      // 맵 위치: 칸 안이면 받아 둔다(새 건물·울타리 안이면 맵이 가장 가까운 걸을 수 있는 칸으로 옮김)
      // 맵 위치는 지금 지도 판(world VERSION)에서 저장한 것만 — 지도를 줄인 뒤 옛 좌표면 버리고 장면 시작점에서 다시(진행은 그대로)
      if (p.pos && typeof p.pos === 'object' && p.pos.v === window.PRIVACY_WORLD.VERSION && p.pos.x === (p.pos.x | 0) && p.pos.y === (p.pos.y | 0) &&
        p.pos.x >= 0 && p.pos.y >= 0 && p.pos.x < window.PRIVACY_WORLD.W && p.pos.y < window.PRIVACY_WORLD.H) progress.pos = p.pos;
      if (p.run) {
        if (E.isValidState(story, p.run)) progress.run = p.run;
        else noticeMsgs.push('이전 진행을 이어 할 수 없어 처음부터 시작해요.');
      }
    } else if (p) noticeMsgs.push('저장된 진행 기록 형식이 맞지 않아 새로 시작해요.');

    settings.sound = true; // 효과음 기본 켜짐(2026-11-02) — 저장된 설정이 있으면 아래에서 다시 정함
    var st = S.readJSON(S.KEYS.settings).value;
    if (st && typeof st === 'object') {
      if (SPEED_MS.hasOwnProperty(st.speed)) settings.speed = st.speed;
      settings.reduceMotion = !!st.reduceMotion;
      // 효과음 기본 켜짐(2026-11-02 사용자 결정): 메뉴에서 직접 고른 적(soundSet)이 있을 때만 저장값을 따른다.
      // 예전엔 기본 꺼짐이 그대로 저장돼(sound:false) 직접 끈 것과 구분이 안 되므로, soundSet 없는 옛 저장은 한 번 새 기본(켜짐)으로
      settings.soundSet = st.soundSet === true;
      settings.sound = settings.soundSet ? st.sound === true : true;
      if (st.look === 'm' || st.look === 'f') settings.look = st.look;
      settings.nickname = cleanName(st.nickname);
      settings.joystick = st.joystick !== false;
      settings.helpPlaces = Array.isArray(st.helpPlaces) ? st.helpPlaces.filter(function (x) { return typeof x === 'string'; }).slice(0, 3) : [];
      settings.helpFold = st.helpFold === true;
    } else if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settings.reduceMotion = true;
    }
    // 공통 플레이어 정보(ethicity.player)가 있으면 그 별명이 우선. 없을 때만 이 게임에서 적은 이름을 쓴다(공통 키에는 쓰지 않음)
    refreshName();
    if (!S.status.available) noticeMsgs.push('이 브라우저에서는 저장할 수 없어요. 플레이는 되지만, 창을 닫으면 진행이 사라져요.');
  }
  function saveProgress() {
    S.writeJSON(S.KEYS.progress, progress);
    checkWriteFailure();
  }
  function saveSettings() { S.writeJSON(S.KEYS.settings, settings); checkWriteFailure(); }
  // 2026-11-09 지시서 C5: 긴 조작 안내(.map-help)는 처음 두 장소에서만. 세 번째 장소에 들어서면 접는다
  function applyHelp() { $('v-map').classList.toggle('help-folded', settings.helpFold); }
  function onPlace(id) {
    if (settings.helpFold || settings.helpPlaces.indexOf(id) >= 0) return;
    settings.helpPlaces.push(id);
    if (settings.helpPlaces.length > 2) settings.helpFold = true;
    applyHelp(); saveHelp();
  }
  // 걷다가 장소를 지날 때는 안내 기록 두 칸만 저장한다(설정 전체를 쓰면 메모리에만 둔 임시값 — OS 움직임 줄이기·검사용 속도 — 까지 굳어 버렸다, 2026-11-09 nf-resume 프로브)
  function saveHelp() {
    var st = S.readJSON(S.KEYS.settings).value;
    if (!st || typeof st !== 'object') { saveSettings(); return; } // 저장된 설정이 없으면(주인공을 고르기 전) 지금 설정 그대로
    st.helpPlaces = settings.helpPlaces.slice(); st.helpFold = settings.helpFold;
    S.writeJSON(S.KEYS.settings, st); checkWriteFailure();
  }
  var warnedWrite = false;
  function checkWriteFailure() {
    if (S.status.writeFailed && S.status.available && !warnedWrite) {
      warnedWrite = true;
      showNotice('저장 공간에 기록하지 못했어요. 이번 플레이는 계속할 수 있지만, 창을 닫으면 진행이 사라질 수 있어요.');
    }
  }
  function showNotice(msg) {
    var n = $('notice');
    n.textContent = '';
    n.appendChild(el('span', null, msg));
    var x = el('button', 'btn ghost sm', '닫기');
    x.type = 'button';
    x.addEventListener('click', function () { n.hidden = true; });
    n.appendChild(x);
    n.hidden = false;
  }

  function setRun(next) {
    progress.run = next;
    saveProgress();
  }

  /* ── 화면 전환 ───────────────────── */
  var VIEWS = ['v-start', 'v-game', 'v-map', 'v-chapter', 'v-ending', 'v-path', 'v-reflect', 'v-card'];
  var current = 'v-start';
  var STAGE_VIEWS = ['v-map', 'v-game', 'v-chapter']; // 맵 무대 위에 겹쳐 뜨는 화면
  function show(id, focusEl) {
    stopReveal();
    if (STAGE_VIEWS.indexOf(id) < 0) { window.PrivacyMap.hide(); stagedScene = null; stageToken++; }
    if (id !== 'v-map') window.PrivacyTalk.close();
    if (id !== 'v-game') cgShow(null);
    if (id !== 'v-card') cardAfterPrint(); // 인쇄 제목이 남아 있으면 되돌린다(afterprint가 오지 않는 브라우저)
    if (id !== 'v-ending' && $('finale')) { clearTimeout(finaleTimer); finaleState = null; $('finale').hidden = true; }
    $('stage').hidden = STAGE_VIEWS.indexOf(id) < 0;
    VIEWS.forEach(function (v) { $(v).hidden = v !== id; });
    current = id;
    document.body.setAttribute('data-view', id);
    window.scrollTo(0, 0);
    var f = focusEl || $(id).querySelector('h1');
    if (f) { if (!f.hasAttribute('tabindex') && f.tagName === 'H1') f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
  }

  function applySettings() {
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
    window.PrivacyTyper.set({ speed: settings.speed, reduce: settings.reduceMotion });
  }

  /* ── 아바타 ───────────────────────── */
  function playerAvatarSrc() {
    var map = CFG.characterImages || {};
    return (player.character && map[player.character]) || CFG.defaultAvatar;
  }
  function isOfficialAvatar() { return !!(player.character && (CFG.characterImages || {})[player.character]); }

  /* ── 시작 화면 ───────────────────── */
  // 맵 주인공 모습: 공통 캐릭터 코드에 매핑이 있으면 그것, 없으면 학생이 고른 것(이 게임 설정에만 저장)
  function commonLook() { var m = CFG.playerLooks || {}; return player.character && (m[player.character] === 'm' || m[player.character] === 'f') ? m[player.character] : null; }
  function playerLook() { return commonLook() || settings.look; }
  // 시작 화면의 두 주인공 카드. 공통 캐릭터로 모습이 정해져 있으면 그 주인공만 보여 주고 고르기는 막는다
  function renderLookPick() {
    var fixed = commonLook();
    Array.prototype.forEach.call(document.querySelectorAll('#look-pick .hero-card'), function (card) {
      var r = card.querySelector('input');
      card.hidden = !!fixed && r.value !== fixed;
      r.disabled = !!fixed;
      r.checked = r.value === (fixed || settings.look);
    });
    $('look-pick').classList.toggle('fixed', !!fixed);
    $('look-msg').hidden = true;
  }
  /* 시작 화면의 '게임 속 한 장면' 미리보기 + 대표 그림(2026-11-11): 무슨 게임인지 첫 화면에서 보이게 —
   *   대표 그림(assets/landing/title-classroom, 「찍을까?」 직전 교실)과 같은 장면인 사건 2 「잠든 민준이」(c1_e2_a)의
   *   하늘의 말·질문·선택지를 story.js에서 그대로 가져온다(글이 어긋나지 않게). 하늘의 말은 그림 위 말풍선(넓은 화면)과 미리보기 카드에.
   *   누를 수 없는 그림 구실이라 안쪽은 화면 읽기에서 숨기고(aria-hidden), 바깥 role=img의 설명 한 줄이 대신한다.
   *   그림을 못 읽으면 그림 칸을 숨기고(body.no-start-art) 판만 보인다. 장면이 없으면 미리보기 칸을 숨긴다. */
  function renderPeek() {
    var box = $('start-peek');
    if (!box || box.firstChild) return;
    var art = $('start-art-img');
    art.addEventListener('error', function () { if (art.dataset.fallback) document.body.classList.add('no-start-art'); art.dataset.fallback = '1'; });
    window.PrivacyImg.load(art, 'assets/landing/title-classroom.png');
    var sc = story.scenes.c1_e2_a, fig = box.parentNode;
    var say = sc ? (sc.lines || []).filter(function (l) { return typeof l === 'string' && /^haneul: /.test(l); })[0] : null;
    var picks = sc ? (sc.choices || []).filter(function (c) { return !c.if; }) : [];
    if (!say || picks.length < 2) { fig.hidden = true; $('start-say').hidden = true; return; }
    var said = plain(say.replace(/^haneul: /, ''));
    $('start-say').textContent = said;
    var inner = el('div', 'peek-in'); inner.setAttribute('aria-hidden', 'true');
    var line = el('p', 'peek-line');
    line.appendChild(el('span', 'peek-who', story.characters.haneul.name));
    line.appendChild(el('span', 'peek-said', said));
    inner.appendChild(line);
    inner.appendChild(el('p', 'peek-q', sc.prompt));
    picks.slice(0, 3).forEach(function (c, i) {
      var row = el('p', 'peek-choice');
      row.appendChild(el('span', 'peek-num', String(i + 1)));
      row.appendChild(el('span', '', c.text));
      inner.appendChild(row);
    });
    box.appendChild(inner);
  }
  function needLook() {
    if (playerLook()) return false;
    $('look-msg').hidden = false;
    var first = document.querySelector('input[name=look]');
    if (first) first.focus();
    return true;
  }

  // '이번 주인공' 칸: 공통 캐릭터 그림이 있으면 그것, 없으면 고른 주인공(온유·다온) 얼굴. 고르면 바로 바뀐다
  function renderPlayerChip() {
    var img = $('player-avatar'), face = $('player-face'), look = playerLook(), note = $('player-note');
    var cast = window.PrivacyCast, hero = look && cast ? cast.LOOK[look] : null;
    var useFace = !isOfficialAvatar() && hero && cast.paintPortrait(face, 'me', look, 'happy');
    face.hidden = !useFace; img.hidden = !!useFace;
    if (useFace) face.setAttribute('aria-label', (look === 'f' ? '다온' : '온유') + ' 얼굴');
    else { img.src = playerAvatarSrc(); img.alt = isOfficialAvatar() ? '내 캐릭터' : '임시 아바타'; }
    if (player.source === 'damaged') { note.hidden = false; note.textContent = '공통 캐릭터 정보를 읽지 못해 이 게임에서 고른 주인공으로 시작해요.' + (look ? '' : ' 위에서 주인공을 골라 주세요.'); }
    else if (!look) { note.hidden = false; note.textContent = '위에서 주인공을 골라 주세요.'; }
    else note.hidden = true; // 2026-11-09 B4: '온유로 시작해요'는 위 한 줄(이번 주인공: 온유 (별명: ○○))과 겹쳐 뺌
    showPlayerName();
  }

  function showPlayerName() {
    refreshName();
    $('player-name').textContent = playerSummary();
    $('player-name').title = playerSummary();
    $('name-input').placeholder = heroName() || CFG.defaultNickname; // 비우면 이 이름으로 시작
  }
  function renderStart() {
    renderPeek();
    renderLookPick();
    renderPlayerChip();
    var nameField = $('name-field');
    nameField.hidden = player.source === 'stored';
    if (!nameField.hidden && document.activeElement !== $('name-input')) $('name-input').value = settings.nickname;

    var run = progress.run;
    var resumable = run && run.screen !== 'ending';
    $('btn-continue').hidden = !resumable;
    $('btn-new').textContent = resumable ? '처음부터 시작' : '시작하기';
    $('btn-new').className = resumable ? 'btn' : 'btn primary';

    var result = S.readResult();
    var lr = $('last-result');
    if (result) {
      var end = story.endings.filter(function (e) { return e.code === result.ending; })[0];
      lr.hidden = false;
      lr.textContent = '최근 완료: 엔딩 ' + result.ending + (end ? ' · ' + end.title : '');
    } else lr.hidden = true;
    var hasFinished = !!(run && run.screen === 'ending');
    $('start-links').hidden = !(hasFinished || result);
    $('btn-start-path').hidden = !hasFinished;
    $('btn-start-card').hidden = !hasFinished; // 성찰 카드는 엔딩을 본 진행이 있을 때만
    show('v-start', null);
  }

  /* ── 본편 ─────────────────────────── */
  function chapterLabel(n) {
    if (n === 0) return '프롤로그';
    if (n === 4) return '에필로그';
    if (n === 'sc') return '특별 수업 · 정보 시간'; // 1장과 2장 사이(2026-11-10)
    return n + '장 · ' + story.chapters[n].title;
  }

  // 장면 제목: 문자열, 또는 [{ if, title }] 중 처음 맞는 것(예: 9시 전 개인톡 — 누가 말리는지에 따라)
  function viewTitle(v, st) {
    if (!Array.isArray(v.title)) return v.title || '';
    var hit = v.title.filter(function (t) { return E.evalCond(t.if, st); })[0];
    return hit ? hit.title : '';
  }
  function preChoiceState(run) {
    // 반응 표시 중이면, 장면 대사는 선택 전 상태로 판정한다
    return run.reaction && run.history.length ? run.history[run.history.length - 1].snap : run;
  }

  function lineNode(line) {
    var who = line.who || 'narr';
    var li;
    if (line.kind === 'image' && line.photo) { li = el('li', 'ln media'); li.appendChild(photoNode(line)); return li; }
    if (line.kind === 'image') {
      li = el('li', 'ln media');
      var box = el('div', 'media-box');
      box.appendChild(el('span', 'media-icon', '🖼'));
      box.lastChild.setAttribute('aria-hidden', 'true');
      box.appendChild(rich('span', null, fill(line.text)));
      li.appendChild(box);
      return li;
    }
    if (line.kind === 'setting') {
      li = el('li', 'ln setting-row');
      li.appendChild(rich('span', 'set-name', fill(line.text)));
      if (line.meta) li.appendChild(rich('span', 'set-meta', fill(line.meta)));
      return li;
    }
    // 속마음(kind:'thought'): 보낸 말풍선이 아니라 회색 들여쓴 해설처럼. 화면 읽기에는 '속마음:'을 앞에 읽힌다
    if (line.kind === 'thought') {
      li = el('li', 'ln thought');
      li.appendChild(el('span', 'sr-only', '속마음: '));
      li.appendChild(rich('span', null, fill(line.text)));
      return li;
    }
    // 휴대폰 알림(kind:'push'): PC·모니터 창 안에 친구 개인톡이 섞여 보이지 않게, 내 휴대폰에 뜬 알림 카드로
    if (line.kind === 'push') {
      li = el('li', 'ln push');
      var card = el('div', 'push-card');
      var pn = el('span', 'push-head', '📱 휴대폰 알림 · ' + (story.characters[who] || { name: who }).name + (line.meta ? ' (' + line.meta + ')' : ''));
      card.appendChild(pn);
      card.appendChild(rich('p', null, fill(line.text)));
      li.appendChild(card);
      return li;
    }
    if (who === 'sys') { li = el('li', 'ln sys'); li.appendChild(rich('span', null, fill(line.text))); return li; }
    if (who === 'narr') { li = rich('li', 'ln narr', fill(line.text)); return li; }

    var ch = story.characters[who] || { name: who, initial: '?' };
    var isMe = who === 'me';
    li = el('li', 'ln msg' + (isMe ? ' me' : '') + (line.kind === 'post' ? ' post' : '') + (who === 'lumi' ? ' ai' : ''));
    if (!isMe) li.appendChild(avatarNode(who, ch));
    var body = el('div', 'msg-body');
    var name = el('span', 'who', isMe ? player.nickname + ' (나)' : ch.name);
    body.appendChild(name);
    var bubble = el('div', 'bubble');
    bubble.appendChild(rich('p', null, fill(line.text)));
    if (line.meta) bubble.appendChild(rich('span', 'post-meta', fill(line.meta)));
    body.appendChild(bubble);
    li.appendChild(body);
    return li;
  }

  /* 메신저 프로필: 공통 팩 초상화(기본 표정, 루미 = 안내 로봇). 그림이 없는 인물(보호자·낯선 계정 등)·나는 이니셜 */
  function avatarNode(who, ch) {
    var av = el('span', 'av');
    av.setAttribute('aria-hidden', 'true');
    av.setAttribute('data-who', who);
    if (who === 'me' || !window.PrivacyCast.paintPortrait(av, who, playerLook() || 'm', 'neutral')) { av.textContent = ch.initial; return av; }
    av.classList.add('has-face', 'cast-face');
    return av;
  }

  /* 대화방에 올라온 사진: 흐리게 가려 두고, 플레이어가 눌러야 보인다(무엇을 볼지 스스로 고르게).
   * line.photo = 납품 사진 경로. tools/to-webp.mjs로 webp 목록에 오르기 전엔 line.placeholder(맵 그림)를 쓴다 → 없는 파일 요청 없음 */
  function photoNode(line) {
    var real = !!(window.PRIVACY_WEBP || {})[line.photo];
    var fig = el('figure', 'photo blurred' + (real ? '' : ' pixel'));
    var im = document.createElement('img');
    im.alt = line.alt || plain(fill(line.text));
    im.decoding = 'async';
    window.PrivacyImg.load(im, real ? line.photo : line.placeholder);
    fig.appendChild(im);
    var btn = el('button', 'photo-reveal', '눌러서 보기');
    btn.type = 'button';
    btn.addEventListener('click', function () { fig.classList.remove('blurred'); btn.remove(); });
    fig.appendChild(btn);
    fig.appendChild(rich('figcaption', null, fill(line.text)));
    return fig;
  }

  /* ── 폰 메시지 차례로 보이기 ──
   * 한 줄씩: (친구 메시지면 '입력 중…' 잠깐) → 글자가 주르륵(typer.js) → 다 쳐지면 잠깐 쉬고 다음 줄.
   * 누르기(화면·Space·Enter) 한 번 = 치는 중이면 그 줄을 다 보여 주기, 다 보인 상태면 바로 다음 줄(누른 것을 버리지 않음).
   * '모두 보기 ▸▸'는 남은 줄을 한꺼번에. 화면 읽기 프로그램에는 다 보인 줄만 #g-live로 한 번씩 읽힌다. */
  function stopReveal() {
    if (revealTimer) clearTimeout(revealTimer);
    revealTimer = null;
    if (typing) { typing.cancel(); typing = null; }
    if (typingNode) typingNode.removeAttribute('aria-hidden');
    typingNode = null;
    removeDots();
    revealQueue = [];
    revealDone = null;
  }
  function announce(n) {
    if (!n || n._said || !n._say) return;
    n._said = true;
    $('g-live').appendChild(el('p', null, n._say));
  }
  function showDots(n) {
    var l = n._line, ch = story.characters[l.who] || { name: l.who, initial: '?' };
    var li = el('li', 'ln msg typing' + (l.who === 'lumi' ? ' ai' : ''));
    li.setAttribute('aria-hidden', 'true');
    li.appendChild(avatarNode(l.who, ch));
    var body = el('div', 'msg-body');
    body.appendChild(el('span', 'who', ch.name));
    var b = el('div', 'bubble');
    b.appendChild(el('span', 'dots', '입력 중…'));
    body.appendChild(b);
    li.appendChild(body);
    typingDots = li;
    $('g-log').appendChild(li);
    scrollLog(false);
  }
  function removeDots() {
    if (typingDots && typingDots.parentNode) typingDots.parentNode.removeChild(typingDots);
    typingDots = null;
  }
  // 친구가 보낸 말풍선만 '입력 중…'(나·해설·알림·게시물 카드는 없음)
  function wantsDots(n) { var l = n._line; return !!(l && l.who && l.who !== 'me' && l.who !== 'narr' && l.who !== 'sys' && !l.kind); }
  function flushReveal() {
    if (!revealDone) return;
    var log = $('g-log');
    if (revealTimer) clearTimeout(revealTimer);
    revealTimer = null;
    if (typingDots) { removeDots(); revealQueue.unshift(typingNode); } // 아직 화면에 안 붙은 줄
    else if (typing) { typing.cancel(); typingNode.removeAttribute('aria-hidden'); announce(typingNode); }
    typing = null; typingNode = null;
    revealQueue.forEach(function (n) { n.classList.remove('enter'); log.appendChild(n); stageBubble(n._line); announce(n); });
    revealQueue = [];
    var done = revealDone; revealDone = null;
    scrollLog(true);
    done();
  }
  function reveal(nodes, animate, done) {
    stopReveal();
    var log = $('g-log');
    var ms = SPEED_MS[settings.speed];
    if (!animate || ms === 0 || !nodes.length) {
      nodes.forEach(function (n) { log.appendChild(n); stageBubble(n._line); announce(n); });
      scrollLog(true);
      done();
      return;
    }
    revealQueue = nodes.slice();
    revealDone = done;
    $('g-dock').textContent = ''; clearNext();
    var skip = el('button', 'btn ghost skip-btn', '모두 보기'); // 2026-11-09 B3: 글자가 나오는 중 = '모두 보기', 다 나오면 '다음'
    skip.type = 'button';
    skip.addEventListener('click', flushReveal);
    nextBox().appendChild(skip); syncNext();
    revealNext(false);
  }
  // 다음 줄 하나. manual = 눌러서 넘긴 경우('입력 중…' 없이 바로 치기 시작)
  function revealNext(manual) {
    revealTimer = null;
    var n = revealQueue.shift();
    if (!n) return;
    var typed = window.PrivacyTyper.enabled() && !!n._typeEl;
    if (typed && !manual && wantsDots(n)) {
      typingNode = n;
      showDots(n);
      revealTimer = setTimeout(function () { removeDots(); startLine(n, true); }, TYPING_MS[settings.speed] || 0);
      return;
    }
    startLine(n, typed);
  }
  function startLine(n, typed) {
    revealTimer = null;
    typingNode = n;
    if (!settings.reduceMotion) n.classList.add('enter');
    if (typed) n.setAttribute('aria-hidden', 'true'); // 치는 동안은 읽히지 않게 — 다 쳐지면 #g-live로 한 번
    $('g-log').appendChild(n);
    stageBubble(n._line);
    scrollLog(false);
    if (!typed) { lineDone(n); return; }
    var h = window.PrivacyTyper.start(n._typeEl, n._text, function () { typing = null; lineDone(n); });
    typing = h.active ? h : null;
  }
  function lineDone(n) {
    n.removeAttribute('aria-hidden');
    announce(n);
    typingNode = null;
    if (!revealQueue.length) {
      var d = revealDone; revealDone = null;
      if (d) d();
      return;
    }
    var gap = window.PrivacyTyper.enabled() ? TYPE_GAP[settings.speed] : SPEED_MS[settings.speed];
    revealTimer = setTimeout(function () { revealNext(false); }, gap);
  }
  // 누르기: '입력 중…' → 이 줄 바로 다 보여 주기 / 치는 중 → 이 줄 다 보여 주기 / 다 보인 상태 → 다음 줄
  function advanceReveal() {
    if (!revealDone) return;
    if (typingDots) { clearTimeout(revealTimer); var w = typingNode; removeDots(); startLine(w, false); return; }
    if (typing && typing.active) { typing.finish(); return; }
    if (revealTimer) { clearTimeout(revealTimer); revealNext(true); }
  }
  function scrollLog(instant) {
    var phone = $('g-phone');
    phone.scrollTop = phone.scrollHeight;
    var dock = $('g-dock');
    if (dock && dock.getBoundingClientRect().bottom > window.innerHeight) {
      dock.scrollIntoView({ block: 'end', behavior: instant || settings.reduceMotion ? 'auto' : 'smooth' });
    }
  }

  // 2026-11-09 지시서 B3: 넘기기 버튼(모두 보기·다음)은 폰·PC 창 바로 아래 #g-next(같은 너비), 장소 장면(대화창)은 아래 메뉴 상자(#g-dock)
  function nextBox() { var d = progress.run ? deviceOf(progress.run.scene) : 'none'; return d === 'phone' || d === 'monitor' ? $('g-next') : $('g-dock'); }
  function clearNext() { $('g-next').textContent = ''; $('v-game').classList.remove('has-next'); }
  function syncNext() { $('v-game').classList.toggle('has-next', $('g-next').children.length > 0); }
  // 2026-11-09 지시서 C2: 공용 PC·AI 도우미·컴퓨터로 보는 SNS(모니터)는 세로 폰처럼 보이지 않게 브라우저 줄을 단다.
  //   사이트 이름 = view.site || 아래 기본값(SNS는 장면 제목), 로그인 표시 = view.login(공용 PC에 남은 하늘이 계정). 같은 내용이 머리글·설정 카드에 있어 화면 읽기에서는 뺀다
  var PC_SITE = { pc: '스냅로그', ai: 'AI 도우미 루미' };
  function pcBar(v) {
    var bar = el('div', 'pc-bar'), dots = el('span', 'pc-dots');
    bar.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 3; i++) dots.appendChild(el('i'));
    bar.appendChild(dots);
    bar.appendChild(el('span', 'pc-url', '🔒 ' + plain(fill(v.site || PC_SITE[v.type] || (typeof v.title === 'string' ? v.title : '')))));
    if (v.login) bar.appendChild(el('span', 'pc-login', v.login + ' 로그인됨'));
    return bar;
  }
  function deviceOf(sceneId) {
    var st = WD.STAGES[sceneId], v = story.scenes[sceneId].view || { type: 'place' };
    return (st && st.device) || DEVICE[v.type] || 'phone';
  }
  // 장면 중 주인공이 보일 자리: 넓은 화면은 폰 왼쪽 빈 곳, 좁은 화면은 위쪽 맵 자리
  function stageFocus(device) {
    if (device === 'none') return { x: 0.5, y: 0.36 };
    return $('stage').clientWidth <= 720 ? { x: 0.5, y: 0.17 } : { x: 0.7, y: 0.36 }; // 넓은 화면: 폰(왼쪽) 오른쪽 빈 곳
  }
  /* ── 효과음(js/sfx.js). 기본 켜짐(메뉴에서 끔) ──
   * 메시지 알림: 폰·모니터 창(장면 device가 none이 아님)에 친구·상대가 보낸 줄이 올 때만. 그 장면 첫 줄 = 'msg'(두 음), 이어지는 줄 = 'tick'(작게).
   * 내가 보낸 줄(me)·해설(narr)·시스템(sys)·속마음(thought)·설정 카드(setting)·장소 대화창 줄(talk)에는 소리 없음. */
  function sfx(id, force) { if (window.PrivacySfx) { window.PrivacySfx.setEnabled(settings.sound); window.PrivacySfx.play(id, force); } }
  var chimeScene = null;
  function incoming(line) {
    var who = line.who;
    return !line.talk && !!who && who !== 'me' && who !== 'narr' && who !== 'sys' && line.kind !== 'thought' && line.kind !== 'setting' &&
      !!progress.run && deviceOf(progress.run.scene) !== 'none';
  }
  function chime(line) {
    if (!incoming(line)) return;
    var sc = progress.run.scene, first = sc !== chimeScene;
    chimeScene = sc;
    sfx(first ? 'msg' : 'tick');
  }
  window.PrivacySfxDoor = function () { sfx('door'); };
  // 화면에 붙일 줄. _say = 화면 읽기용 한 문장, _typeEl/_text = 타자 효과를 줄 자리(해설·말풍선만)
  function nodeOf(line) {
    var n = lineNode(line), who = line.who || 'narr';
    n._line = line;
    n._say = sayOf(line);
    if (!line.kind && who !== 'sys') {
      n._typeEl = who === 'narr' ? n : n.querySelector('.bubble p');
      n._text = fill(line.text);
    }
    return n;
  }
  function sayOf(line) {
    var who = line.who || 'narr', t = plain(fill(line.text || ''));
    if (line.kind === 'setting') return t + (line.meta ? ', ' + plain(fill(line.meta)) : '');
    if (line.kind === 'image') return '사진: ' + t;
    if (line.kind === 'thought') return '속마음: ' + t;
    if (line.kind === 'push') return '휴대폰 알림, ' + (story.characters[who] || { name: who }).name + (line.meta ? ' ' + plain(fill(line.meta)) : '') + ': ' + t;
    if (who === 'narr' || who === 'sys') return t;
    var name = who === 'me' ? player.nickname + ' (나)' : (story.characters[who] || { name: who }).name;
    return name + ': ' + t + (line.meta ? ' (' + plain(fill(line.meta)) + ')' : '');
  }
  // 줄이 나타날 때: 같은 공간 친구 머리 위 말풍선(폰 메시지는 원문 대신 📱…) + 장면에 적어 둔 반응
  function stageBubble(line) {
    if (!line || !progress.run) return;
    var st = WD.STAGES[progress.run.scene];
    if (!st) return;
    var who = line.who, text = plain(fill(line.text || ''));
    if (who && who !== 'narr' && who !== 'sys' && who !== 'me') {
      window.PrivacyMap.bubble(who, spokenDevice ? text : '📱…', !spokenDevice);
      chime(line);
    }
    (st.bubbles || []).forEach(function (b) { if (text.indexOf(b.on) >= 0) window.PrivacyMap.bubble(b.who, b.text); });
  }
  /* ── 사건 CG(전체 화면 그림): 장면 view.cg로 시작, 대사 줄의 cg·rec·fx로 바뀐다(story.js 작성법) ── */
  var CG_DIR = 'assets/nightfox-event-official/'; // 공통 팩 화풍(온유/다온·새봄·지호·하늘·민준·교사)으로 다시 그린 사건 8 CG
  var CG_LOOK = { arrival: 1, confrontation: 1, clash: 1, recorded: 1 }; // 주인공 남/여 그림이 따로 있는 키
  var CG_ALT = { arrival: '밤의 학교 정문 앞에 도착한 나', confrontation: '@nightfox와 마주 선 나', clash: '서로 옷을 붙잡고 밀치는 두 사람',
    recorded: '휴대폰을 들어 두 사람을 찍는 구경꾼들', 'classroom-reaction': '영상을 본 반 친구들', 'teacher-support': '이야기를 들어 주는 담임 선생님' };
  /* 교실 AI CCTV 감지 화면(특별 수업, story.cctv): 그림 위 빨간 사각형·꼬리표·알림 카드·카메라 이름 줄은 여기서 그린다(그림에는 글자·상자가 없다).
   *   네 장면 모두 같은 빨간색·같은 모양. 표시는 그림이 뜬 뒤 짧게 늦게 잡힌다(CSS .det-on, 움직임 줄이기면 바로). 글자는 꾸밈(aria-hidden) — 같은 내용이 그림 alt·#cg-live에 있다 */
  var CCTV_DIR = 'assets/cctv/';
  function cctvShot(key) { var c = story.cctv; return c && c.shots && Object.prototype.hasOwnProperty.call(c.shots, key) ? c.shots[key] : null; }
  function cgFile(key) {
    if (cctvShot(key)) return CCTV_DIR + key + '.png';
    return CG_DIR + (CG_LOOK[key] ? (playerLook() === 'f' ? 'girl-' : 'boy-') : '') + key + '.png';
  }
  function pct(v) { return (Math.round(v * 100000) / 1000) + '%'; }
  function cctvPaint(box, shot) {
    var det = box.querySelector('.cg-det'), c = story.cctv, b = shot.box, r = det.querySelector('.cg-box');
    det.querySelector('.cg-cam-name').textContent = c.cam;
    det.querySelector('.cg-cam-demo').textContent = c.demo;
    r.style.left = pct(b.x); r.style.top = pct(b.y); r.style.width = pct(b.w); r.style.height = pct(b.h);
    det.querySelector('.cg-tag').textContent = shot.label + ' ' + shot.pct + '%';
    det.querySelector('.cg-alert-what').textContent = c.room + ' · ' + shot.label;
    det.querySelector('.cg-alert-send').textContent = c.send;
    det.hidden = false;
  }
  // 표시 켜기: 그림이 다 내려온 뒤(잔상·빈 화면 위에 상자만 뜨지 않게). 한 박자 뒤에 클래스를 붙여 CSS 지연이 돌게 한다
  function cctvReveal() {
    var box = $('cg');
    if (box.getAttribute('data-mode') !== 'cctv' || box.querySelector('.cg-img').hasAttribute('data-loading')) return;
    void box.offsetWidth;
    box.classList.add('det-on');
  }
  /* 휴대폰 화면 그림(사건 4 가짜 춤 영상, story.clips): 세로 휴대폰 틀 안에 사진 한 장 또는 여러 장을 0.4초마다 넘겨 영상처럼.
   *   움직임 줄이기면 멈춘 한 장 + '다음 장면' 버튼(직접 넘김). 그림을 하나라도 못 불러오면 틀을 숨기고 글만으로 진행.
   *   계정 줄·재생 표시는 꾸밈(aria-hidden) — 화면 읽기에는 화면 칸의 aria-label(alt)과 #cg-live.
   *   ★ 선택지가 뜨기 전에 이야기 줄(cg:null)이 내린다. 혹시 빠져도 renderDock가 한 번 더 내린다(고르는 동안 영상이 돌지 않게) */
  var CLIP_MS = 400;
  var clipTimer = null, clipIdx = 0;
  function clipOf(key) { var c = story.clips; return c && Object.prototype.hasOwnProperty.call(c, key) ? c[key] : null; }
  function clipStop() { if (clipTimer) clearInterval(clipTimer); clipTimer = null; }
  function clipFrame(i, say) {
    var box = $('cg'), ph = box.querySelector('.cg-phone'), frames = ph.querySelectorAll('.cg-frame'), n = frames.length;
    if (!n) return;
    clipIdx = ((i % n) + n) % n;
    Array.prototype.forEach.call(frames, function (f, k) { f.classList.toggle('on', k === clipIdx); });
    ph.querySelector('.cg-prog i').style.width = ((clipIdx + 1) / n * 100) + '%';
    ph.querySelector('.cg-count').textContent = n > 1 ? (clipIdx + 1) + ' / ' + n : '';
    if (say) $('cg-live').textContent = '장면 ' + (clipIdx + 1) + ' / ' + n;
  }
  function clipFail() { // png까지 실패: 틀을 숨기고 무대·글로
    var box = $('cg');
    clipStop();
    box.hidden = true; document.body.classList.remove('cg-on');
    box.querySelector('.cg-phone').setAttribute('data-failed', '');
  }
  function clipShow(box, key, clip) {
    var ph = box.querySelector('.cg-phone'), scr = ph.querySelector('.cg-screen'), step = ph.querySelector('.cg-step'), many = clip.frames.length > 1;
    clipStop();
    ph.removeAttribute('data-failed');
    scr.textContent = '';
    scr.setAttribute('aria-label', clip.alt || '');
    clip.frames.forEach(function (file) {
      var im = document.createElement('img');
      im.className = 'cg-frame'; im.alt = ''; im.decoding = 'async'; im.draggable = false;
      // img-src.js의 webp→png 재시도보다 먼저 등록: png까지 실패했을 때만 틀을 숨긴다(지금 떠 있는 그림일 때만)
      im.onerror = function () { if (/\.png($|\?)/.test(im.src) && im.parentNode === scr && box.getAttribute('data-cg') === key) clipFail(); };
      window.PrivacyImg.load(im, file);
      scr.appendChild(im);
    });
    ph.querySelector('.cg-phone-who').textContent = clip.who || '';
    ph.querySelector('.cg-phone-av').textContent = clip.av || '?';
    ph.classList.toggle('video', !!clip.video);
    ph.querySelector('.cg-phone-bar').hidden = !clip.video;
    step.hidden = !(many && settings.reduceMotion); // 움직임 줄이기: 저절로 넘어가지 않고, 버튼으로 한 장씩
    ph.hidden = false;
    clipFrame(0);
    if (many && !settings.reduceMotion) clipTimer = setInterval(function () { clipFrame(clipIdx + 1); }, CLIP_MS);
  }
  // 휴대폰 틀은 대화창 위에 다 보이게: 대화창이 평소보다 높으면('한 번에'로 여러 줄을 쌓았을 때) 그만큼 틀을 줄인다
  function cgFit() {
    var box = $('cg'), talk = $('talk');
    box.style.paddingBottom = '';
    if (box.hidden || box.getAttribute('data-mode') !== 'phone' || !talk || talk.hidden) return;
    var need = $('stage').getBoundingClientRect().bottom - talk.getBoundingClientRect().top + 8;
    if (need > parseFloat(getComputedStyle(box).paddingBottom)) box.style.paddingBottom = Math.round(need) + 'px';
  }
  function cgShow(key) {
    var box = $('cg'), im = box.querySelector('.cg-img');
    box.style.paddingBottom = '';
    box.classList.remove('shake', 'dim', 'det-on');
    box.querySelector('.cg-rec').hidden = true;
    box.querySelector('.cg-det').hidden = true;
    box.querySelector('.cg-phone').hidden = true;
    clipStop();
    $('cg-live').textContent = '';
    if (!key) { box.hidden = true; box.removeAttribute('data-cg'); box.removeAttribute('data-mode'); document.body.classList.remove('cg-on'); return; }
    var clip = clipOf(key);
    if (clip) {
      box.setAttribute('data-cg', key);
      box.setAttribute('data-mode', 'phone');
      box.hidden = false;
      document.body.classList.add('cg-on');
      clipShow(box, key, clip);
      if (!box.hidden) $('cg-live').textContent = clip.alt || '';
      return;
    }
    var file = cgFile(key), shot = cctvShot(key);
    box.setAttribute('data-cg', key);
    box.setAttribute('data-mode', shot ? 'cctv' : 'event');
    im.alt = shot ? shot.alt : CG_ALT[key] || '';
    if (im.getAttribute('data-file') !== file) {
      im.setAttribute('data-file', file);
      im.removeAttribute('data-failed');
      im.setAttribute('data-loading', ''); // 새 그림이 다 올 때까지 앞 그림(잔상)을 감춘다
      window.PrivacyImg.load(im, file);
    }
    box.hidden = im.hasAttribute('data-failed'); // 그림을 못 불러오면 빈 레이어 대신 무대가 보이게
    document.body.classList.toggle('cg-on', !box.hidden); // CG 장면: 대화창 글자를 키운다
    if (shot) {
      cctvPaint(box, shot);
      if (!box.hidden) $('cg-live').textContent = shot.alt; // 화면 읽기: 그림이 바뀔 때 무엇이 보이고 무엇으로 알렸는지 한 번
      cctvReveal();
    }
  }
  // 줄에 cg 칸이 있으면 그림을 바꾼다. cg:null(또는 false·'') = 그림 내리기
  function hasCg(line) { return !!line && Object.prototype.hasOwnProperty.call(line, 'cg'); }
  function cgLine(line, quiet) {
    if (!line) return;
    if (hasCg(line)) cgShow(line.cg || null);
    var box = $('cg');
    if (box.hidden && !box.hasAttribute('data-cg')) return;
    if (line.rec) box.querySelector('.cg-rec').hidden = false;
    if (line.fx === 'dim') { box.classList.add('dim'); box.querySelector('.cg-rec').hidden = true; }
    if (line.fx === 'shake' && !quiet && !settings.reduceMotion) {
      box.classList.remove('shake');
      void box.offsetWidth; // 같은 클래스로 다시 흔들리게
      box.classList.add('shake');
    }
  }
  function cgSetup() {
    var box = $('cg'), im = box.querySelector('.cg-img');
    // img-src.js의 webp→png 재시도보다 먼저 등록: png까지 실패했을 때만 숨긴다
    im.onerror = function () { if (box.getAttribute('data-mode') === 'phone') return; if (/\.png($|\?)/.test(im.src)) { im.removeAttribute('data-loading'); im.setAttribute('data-failed', ''); box.hidden = true; document.body.classList.remove('cg-on'); } };
    im.onload = function () { im.removeAttribute('data-loading'); cctvReveal(); };
    // 휴대폰 틀 '다음 장면'(움직임 줄이기에서만 보임): 한 장씩 직접 넘긴다. 대화창 넘기기와 섞이지 않게 여기서 멈춘다
    box.querySelector('.cg-step').addEventListener('click', function (e) { e.stopPropagation(); clipFrame(clipIdx + 1, true); });
    window.addEventListener('resize', cgFit);
    box.addEventListener('animationend', function () { box.classList.remove('shake'); });
  }
  // 그 자리 대화(장소 장면)는 포켓몬식 대화창으로 한 줄씩
  function talkLines(list) {
    var items = list.filter(function (l) { return l.who !== 'sys' && (!l.kind || l.kind === 'thought' || l.kind === 'push'); }).map(function (l) {
      var who = l.who || 'narr';
      if (l.kind === 'thought') return { who: null, name: '속마음', text: fill(l.text), line: l }; // 대화창에서는 이름 칸에 '속마음'
      if (who === 'narr') return { who: null, name: null, text: fill(l.text), line: l };
      var ch = story.characters[who] || { name: who };
      return { who: who, name: who === 'me' ? player.nickname + ' (나)' : ch.name, text: fill(l.text), line: l };
    });
    var instant = settings.speed === 'instant';
    var opts = { instant: instant, onLine: function (it) { cgLine(it.line); cgFit(); stageBubble(Object.assign({ talk: true }, it.line)); } };
    if (!instant) return window.PrivacyTalk.open(items, opts);
    // '한 번에' 속도: 모든 줄을 한 상자에 쌓으면 그림이 마지막 것만 남는다 → 그림이 바뀌는 줄(cg 칸)마다 상자를 끊어 그림을 한 장씩 본다(2026-11-10)
    var groups = [], cur = [];
    items.forEach(function (it) { if (hasCg(it.line) && cur.length) { groups.push(cur); cur = []; } cur.push(it); });
    if (cur.length) groups.push(cur);
    var tk = stageToken; // 장면이 바뀌면(이전 선택·메뉴) 남은 묶음은 열지 않는다
    return groups.slice(1).reduce(function (p, g) { return p.then(function () { return tk === stageToken ? window.PrivacyTalk.open(g, opts) : null; }); },
      window.PrivacyTalk.open(groups[0] || [], opts));
  }
  function reactionLines(run, scene) {
    var c = (scene.choices || []).filter(function (x) { return x.id === run.reaction; })[0];
    if (!c) return [];
    return (c.say ? [{ who: 'me', text: c.say }] : []).concat(E.visibleLines(story, c.react, run));
  }

  function renderGame(animate) {
    var run = progress.run;
    var scene = story.scenes[run.scene];
    $('g-chap').textContent = chapterLabel(scene.chapter);
    $('btn-undo').disabled = !run.history.length;
    window.PrivacyTalk.close(); // 앞 장면 대화창이 남아 선택지를 가리지 않게
    var device = deviceOf(run.scene);
    spokenDevice = device !== 'phone';
    $('v-game').setAttribute('data-device', device);
    $('g-phone').setAttribute('data-device', device);
    $('g-phone').hidden = device === 'none';
    $('stage').classList.toggle('dim', device !== 'none');

    var head = $('g-head');
    head.textContent = '';
    var v = scene.view || { type: 'place', title: '' };
    if (device === 'monitor') head.appendChild(pcBar(v)); // 2026-11-09 지시서 C2: 모니터 = 머리글 위 브라우저 줄(사이트·로그인)
    $('g-phone').setAttribute('data-type', v.type);
    var ic = el('span', 'head-icon', VIEW_ICON[v.type] || '');
    ic.setAttribute('aria-hidden', 'true');
    head.appendChild(ic);
    var ht = el('div', 'head-text');
    ht.appendChild(el('span', 'head-kind', VIEW_KIND[v.type] || ''));
    ht.appendChild(el('strong', 'head-title', fill(viewTitle(v, preChoiceState(run)))));
    head.appendChild(ht);
    if (v.meta) head.appendChild(el('span', 'head-meta', v.meta));

    $('g-log').textContent = '';
    $('g-live').textContent = '';
    $('g-dock').textContent = ''; clearNext();
    if (current !== 'v-game') show('v-game', $('g-chap'));
    if (!v.cg) cgShow(null);
    // 무대: 장면이 바뀌면 그 장소로(처음 들어갈 때만 컷 카드)
    var token = ++stageToken;
    var st = WD.STAGES[run.scene] || { place: 'classroom', tint: 'day', cast: [] };
    var ready = Promise.resolve();
    if (stagedScene !== run.scene) {
      if (animate && st.card) cgShow(null); // 컷 카드 뒤로 앞 장면 그림이 비치지 않게
      stagedScene = run.scene;
      cutPending = true;
      ready = window.PrivacyMap.stage(st, { card: animate && st.card ? st.card : null, focus: function () { return stageFocus(device); },
        time: (E.visibleLines(story, scene.lines, preChoiceState(run)).filter(function (l) { return l.who === 'sys'; })[0] || {}).text || st.card }); // tint 없는 무대의 시간대
    }
    ready.then(function () {
      cutPending = false;
      if (token !== stageToken) return;
      var pre = preChoiceState(run);
      var lines = E.visibleLines(story, scene.lines, pre);
      if (v.cg) {
        cgShow(v.cg);
        if (run.reaction) lines.forEach(function (l) { cgLine(l, true); }); // 반응 중 복원: 장면 대사가 바꿔 둔 그림까지
      }
      if (device === 'none') {
        talkLines(run.reaction ? reactionLines(run, scene) : lines).then(function () { if (token === stageToken) renderDock(); });
        return;
      }
      // 반응 표시 중으로 복원된 경우: 장면 대사 + 반응까지 한 번에
      reveal(lines.map(nodeOf).concat(reactionNodes(run, scene)), animate && !run.reaction, renderDock);
    });
  }

  function reactionNodes(run, scene) {
    if (!run.reaction) return [];
    var c = (scene.choices || []).filter(function (x) { return x.id === run.reaction; })[0];
    var out = [];
    var mine = el('li', 'ln choice-echo');
    mine.appendChild(el('span', 'echo-label', '내 선택'));
    mine.appendChild(el('span', null, fill(c.text)));
    mine._say = '내 선택: ' + fill(c.text);
    out.push(mine);
    if (c.say) out.push(nodeOf({ who: 'me', text: c.say }));
    return out.concat(E.visibleLines(story, c.react, run).map(nodeOf));
  }

  function renderDock() {
    var run = progress.run;
    var scene = story.scenes[run.scene];
    var dock = $('g-dock');
    dock.textContent = ''; clearNext();
    if (E.needsChoice(story, run)) {
      if ($('cg').getAttribute('data-mode') === 'phone') cgShow(null); // 휴대폰 틀 영상은 고르는 동안 돌지 않는다(이야기 줄 cg:null이 먼저 내리지만, 빠졌을 때의 안전망)
      var choices = E.visibleChoices(story, scene, run);
      if (scene.prompt) dock.appendChild(el('p', 'prompt', fill(scene.prompt)));
      var list = el('div', 'choices');
      list.setAttribute('role', 'group');
      list.setAttribute('aria-label', scene.prompt ? fill(scene.prompt) : '선택지');
      choices.forEach(function (c, i) {
        var b = el('button', 'choice');
        b.type = 'button';
        b.setAttribute('data-choice', c.id);
        var num = el('span', 'num', String(i + 1));
        num.setAttribute('aria-hidden', 'true');
        b.appendChild(num);
        b.appendChild(el('span', 'choice-text', fill(c.text)));
        b.addEventListener('click', function () { onChoose(c.id); });
        list.appendChild(b);
      });
      dock.appendChild(list);
      focusFirst(list.querySelector('button'));
    } else {
      var go = el('button', 'btn primary continue', '다음');
      go.type = 'button';
      go.id = 'btn-next';
      go.addEventListener('click', onContinue);
      nextBox().appendChild(go); syncNext();
      focusFirst(go);
    }
    scrollLog(true);
  }
  function focusFirst(b) { if (b) b.focus({ preventScroll: true }); }

  function onChoose(id) {
    sfx('tap');
    var run = progress.run;
    var scene = story.scenes[run.scene];
    var next = E.choose(story, run, id);
    var ex = progress.explored[run.scene] || (progress.explored[run.scene] = []);
    if (ex.indexOf(id) < 0) ex.push(id);
    setRun(next);
    $('btn-undo').disabled = false;
    // 화면은 그대로 두고 선택 반응만 이어서 보여 준다
    $('g-dock').textContent = ''; clearNext();
    if (deviceOf(next.scene) === 'none') {
      var tk = stageToken;
      talkLines(reactionLines(next, scene)).then(function () { if (tk === stageToken) renderDock(); });
      return;
    }
    reveal(reactionNodes(next, scene), true, renderDock);
  }

  function onContinue() {
    var run = progress.run;
    var next = E.advance(story, run);
    setRun(next);
    routeRun(true);
  }

  function routeRun(animate) {
    var run = progress.run;
    if (run.screen === 'scene') renderGame(animate);
    else if (run.screen === 'map') renderMap();
    else if (run.screen === 'chapter') renderChapter();
    else if (run.screen === 'ending') renderEnding(true);
  }

  /* ── 맵 ─────────────────────────── */
  function renderMap() {
    var run = progress.run;
    $('btn-undo').disabled = !run.history.length;
    $('stage').classList.remove('dim');
    window.PrivacyTalk.close();
    stagedScene = null; stageToken++;
    show('v-map', $('hud-mission'));
    window.PrivacyMap.show(run);
  }

  /* ── 장 전환 ───────────────────────── */
  var TRUST_WORD = function (d) { return d > 0 ? '믿음이 생김 ↑' : d < 0 ? '믿음이 줄어듦 ↓' : '그대로 →'; }; // 관계 수치는 친밀감이 아니라 신뢰

  // split = E.seriousSplit(...)(ENDING_V2): serious 한 줄 대신 '내가 위험했던 일 / 남을 위험하게 한 일' 두 줄(onlyChanged면 그 값이 곧 변화량)
  function statRows(fromStats, toStats, onlyChanged, split) {
    var dl = el('dl', 'stat-list');
    E.STAT_KEYS.forEach(function (k) {
      if (k === 'serious' && split) {
        split.forEach(function (r) {
          if (onlyChanged && !r.value) return;
          var sr = el('div', 'stat-row');
          sr.setAttribute('data-stat', 'serious-split');
          sr.appendChild(el('dt', null, r.label));
          sr.appendChild(el('dd', null, onlyChanged ? '+' + r.value : String(r.value)));
          dl.appendChild(sr);
        });
        return;
      }
      var d = (toStats[k] || 0) - (fromStats[k] || 0);
      if (onlyChanged && d === 0) return;
      var row = el('div', 'stat-row');
      row.appendChild(el('dt', null, story.stats[k]));
      row.appendChild(el('dd', null, onlyChanged ? (d > 0 ? '+' + d : String(d)) : String(toStats[k] || 0)));
      dl.appendChild(row);
    });
    if (!dl.children.length) dl.appendChild(el('p', 'mute small', '눈에 띄는 변화는 없었어요.'));
    return dl;
  }
  function trustRows(fromTrust, toTrust) {
    var ul = el('ul', 'trust-list');
    story.trustable.forEach(function (k) {
      var d = (toTrust[k] || 0) - (fromTrust[k] || 0);
      var li = el('li');
      li.setAttribute('data-who', k);
      li.appendChild(el('span', 'trust-name', story.characters[k].name));
      li.appendChild(el('span', 'trust-val' + (d > 0 ? ' up' : d < 0 ? ' down' : ''), TRUST_WORD(d)));
      var mark = el('span', 'trust-mark' + (d > 0 ? ' up' : d < 0 ? ' down' : ''), d > 0 ? '♥' : d < 0 ? '💧' : '–');
      mark.setAttribute('aria-hidden', 'true');
      li.appendChild(mark);
      // 그 친구 얼굴(캐릭터 시트에서 머리만 잘라 2배) — 줄 오른쪽 끝
      li.appendChild(window.PrivacySprite.el(k, { face: true, scale: 2, initial: story.characters[k].initial }));
      ul.appendChild(li);
    });
    return ul;
  }
  function eventBlock(eventId, run) {
    var ev = story.events[eventId];
    var box = el('div', 'event-card');
    var h = el('h3');
    h.appendChild(el('span', 'event-topic', ev.topic));
    h.appendChild(document.createTextNode(ev.title));
    box.appendChild(h);
    var ul = el('ul');
    E.eventOutcomes(story, eventId, run).forEach(function (t) { ul.appendChild(rich('li', null, fill(t))); });
    box.appendChild(ul);
    return box;
  }

  function renderChapter() {
    sfx('collect');
    var run = progress.run;
    var n = run.nextChapter, ch = story.chapters[n];
    var prev = run.chapter;
    $('c-eyebrow').textContent = n === 4 ? '마지막' : n === 'sc' ? '특별 수업' : (n + '장');
    $('c-title').textContent = n === 4 ? '에필로그' : ch.title;
    $('c-sub').textContent = ch.sub;
    var sum = $('c-summary');
    sum.textContent = '';
    var plan = prev === 'sc' ? classPlanBlock(run) : null;
    if (plan) sum.appendChild(plan); // 특별 수업 뒤 2장 카드: 수치 변화 대신 '우리 반이 정한 AI CCTV 안'
    else if (prev >= 1 && story.chapters[prev]) {
      sum.appendChild(el('h2', null, chapterLabel(prev) + ' — 지금까지 생긴 변화'));
      story.chapters[prev].events.forEach(function (e) { sum.appendChild(eventBlock(e, run)); });
      var mark = run.chapterMarks[prev] || { stats: {}, trust: {} };
      var grid = el('div', 'change-grid');
      var a = el('div');
      a.appendChild(el('h3', null, '이번 장의 흐름'));
      a.appendChild(statRows(mark.stats, run.stats, true, E.seriousSplit(story, run, prev)));
      var b = el('div');
      b.appendChild(el('h3', null, '친구들의 믿음'));
      b.appendChild(trustRows(mark.trust, run.trust));
      grid.appendChild(a); grid.appendChild(b);
      sum.appendChild(grid);
    } else {
      sum.appendChild(el('p', 'lead-sub', '학급 축제 ‘레트로 사진관’을 준비하는 나흘. 단톡방, SNS, AI 도우미, 공용 컴퓨터에서 여러 번 선택하게 돼요. 지나간 선택은 뒤에서 다시 돌아와요.'));
    }
    $('btn-chapter-go').textContent = n === 4 ? '에필로그 보기' : n === 'sc' ? '특별 수업 시작' : n + '장 시작';
    show('v-chapter');
    // 장 카드 뒤로 직전 장면의 무대를 어둡게 깐다
    $('stage').classList.add('dim');
    if (stagedScene !== run.scene) { stagedScene = run.scene; window.PrivacyMap.stage(WD.STAGES[run.scene] || { place: 'classroom', tint: 'day', cast: [] }); }
  }

  /* 특별 수업 「우리 교실에 AI CCTV를 단다면」(2026-11-10): 우리 반이 정한 안(설치 여부·알림 범위·보관 기간·열람·삭제) + 선생님이 짚은 질문(앞 2줄). 정답 표시 없음.
   *   특별 수업 플래그가 없으면(옛 진행) null. 지금 보기에 없는 옛 값은 그 줄만 '—' */
  function classPlanBlock(run) {
    var rows = E.specialClassRows(story, run);
    if (!rows.length) return null;
    var box = el('section', 'class-plan');
    box.appendChild(el('h3', null, '우리 반이 정한 AI CCTV 안'));
    var dl = el('dl', 'class-rows');
    rows.forEach(function (r) { var row = el('div', 'class-row'); row.appendChild(el('dt', null, r.label)); row.appendChild(el('dd', null, r.text)); dl.appendChild(row); });
    box.appendChild(dl);
    var qs = E.specialClassNotes(story, run).slice(0, 2);
    if (qs.length) { box.appendChild(el('p', 'class-q-label', '선생님이 짚은 질문')); qs.forEach(function (t) { box.appendChild(el('p', 'class-q', t)); }); }
    return box;
  }

  /* ── 엔딩 ─────────────────────────── */
  function endingOf(code) { return story.endings.filter(function (e) { return e.code === code; })[0]; }
  function cardText(end) { return story.title + ' · 엔딩 ' + end.code + ' 「' + end.title + '」 — ' + plain(end.summary); }

  /* ── 엔딩 연출(프로스트펑크식): 검은 화면 → 두 문장 → 9개 사건의 내 선택 → 친구들의 믿음 → 엔딩 이름 ── */
  var finaleTimer = null, finaleState = null;
  // 날짜 = 그 사건에서 처음 고른 장면의 시각(장면에 시각 줄이 없으면 같은 사건의 앞 장면에서). 예: 고민 대화는 털어놓은 D-2가 아니라 고른 D-1
  function sceneDate(id) {
    var sc = story.scenes[id], sys = (sc.lines || []).map(function (l) { return E.normLine(l, story); }).filter(function (l) { return l.who === 'sys'; })[0];
    if (sys) return sys.text.split(' · ')[0];
    // (2026-11-02: 'D-d' 오타로 'D-1 오후 6:05' 같은 제목에서 날짜를 못 읽어 사건 4(매점 앞) 날짜 칸이 비었음 → D-\d+)
    var m = /^(D-\d+|축제 당일|축제 다음 날)/.exec((sc.view && typeof sc.view.title === 'string' ? sc.view.title : '').replace(/^.* · /, ''));
    return m ? m[1] : '';
  }
  function eventDate(eventId, sceneId) {
    var ids = Object.keys(story.scenes).filter(function (k) { return story.scenes[k].event === eventId; });
    var from = sceneId ? ids.indexOf(sceneId) : 0;
    for (var i = Math.max(0, from); i >= 0; i--) { var d = sceneDate(ids[i]); if (d) return d; }
    return '';
  }
  function finale(run, end) {
    var box = $('finale');
    if (!box) {
      box = el('div', 'finale');
      box.id = 'finale';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', '게임이 끝났습니다');
      box.tabIndex = -1;
      box.addEventListener('click', function (e) { if (!e.target.closest('button')) finaleAll(); });
      document.body.appendChild(box);
    }
    box.textContent = '';
    box.hidden = false;
    var lines = [];
    var inner = el('div', 'finale-inner');
    function add(node) { node.classList.add('finale-line'); lines.push(node); return node; }
    inner.appendChild(add(el('p', 'finale-title', '게임이 끝났습니다.')));
    inner.appendChild(add(el('p', 'finale-q', '과연 당신의 선택은 어떠했을까요?')));
    var picks = el('ol', 'finale-choices');
    [1, 2, 3].forEach(function (n) {
      story.chapters[n].events.forEach(function (e) {
        // 첫 선택 → 이어진 선택(수습 등)까지 한 줄로: 성찰 수업에서 “처음엔 이랬지만 그다음엔”을 볼 수 있게
        var hs = run.history.filter(function (x) { return story.scenes[x.scene].event === e; });
        var texts = hs.map(function (h) {
          var c = (story.scenes[h.scene].choices || []).filter(function (x) { return x.id === h.choice; })[0];
          return c ? fill(c.text) : null;
        }).filter(Boolean);
        var li = add(el('li', 'finale-choice'));
        li.appendChild(el('span', 'finale-date', eventDate(e, hs[0] && hs[0].scene)));
        li.appendChild(el('span', 'finale-ev', story.events[e].title));
        li.appendChild(el('span', 'finale-pick', texts.length ? texts.join(' → ') : '—'));
        picks.appendChild(li);
      });
    });
    inner.appendChild(picks);
    inner.appendChild(add(el('p', 'finale-sub', '친구들의 믿음')));
    var bonds = el('ul', 'finale-bonds');
    story.trustable.forEach(function (k) {
      var d = (run.trust[k] || 0) - ((run.chapterMarks[0] && run.chapterMarks[0].trust[k]) || 0);
      var li = add(el('li', 'finale-bond'));
      li.setAttribute('data-who', k);
      li.appendChild(window.PrivacySprite.el(k, { face: true, scale: 2, initial: story.characters[k].initial }));
      li.appendChild(el('span', 'finale-name', story.characters[k].name));
      li.appendChild(el('span', 'finale-word' + (d > 0 ? ' up' : d < 0 ? ' down' : ''), d > 0 ? '믿음이 생김' : d < 0 ? '믿음이 줄어듦' : '그대로'));
      bonds.appendChild(li);
    });
    inner.appendChild(bonds);
    inner.appendChild(add(el('p', 'finale-end', '엔딩 ' + end.code + ' · ' + end.title)));
    // 아무거나 골랐다면 이 엔딩에 닿을 확률(미리 계산한 값 — 플레이어 기록은 모으지 않는다)
    var odds = (window.PRIVACY_ODDS || {})[end.code];
    if (typeof odds === 'number') inner.appendChild(add(el('p', 'finale-odds', '아무거나 골랐다면 이 엔딩에 닿을 확률은 ' + odds + '%예요.')));
    var actions = add(el('div', 'finale-actions'));
    var go = el('button', 'btn primary', '결과 보기');
    go.id = 'finale-go';
    go.type = 'button';
    go.addEventListener('click', finaleClose);
    actions.appendChild(go);
    inner.appendChild(actions);
    var skip = el('button', 'finale-skip', '건너뛰기');
    skip.type = 'button';
    skip.addEventListener('click', finaleClose);
    box.appendChild(skip);
    box.appendChild(inner);
    finaleState = { lines: lines, go: go };
    clearTimeout(finaleTimer);
    if (settings.speed === 'instant' || settings.reduceMotion) { finaleAll(); return; }
    box.focus({ preventScroll: true });
    // 화면이 검게 꺼지는 동안 잠깐 멈췄다가, 두 문장은 천천히, 나머지는 한 줄씩
    var i = 0, step = settings.speed === 'fast' ? 350 : 750;
    (function next() {
      if (!finaleState) return;
      if (i >= lines.length) { go.focus({ preventScroll: true }); return; }
      lines[i].classList.add('on');
      if (i >= 2) lines[i].scrollIntoView({ block: 'nearest' });
      i++;
      finaleTimer = setTimeout(next, i <= 2 ? 1500 : step);
    })();
  }
  function finaleAll() {
    clearTimeout(finaleTimer);
    if (!finaleState) return;
    finaleState.lines.forEach(function (n) { n.classList.add('on'); });
    finaleState.go.focus({ preventScroll: true });
  }
  function finaleClose() {
    clearTimeout(finaleTimer);
    finaleState = null;
    var b = $('finale');
    if (b) b.hidden = true;
    var t = $('e-title');
    if (t && current === 'v-ending') { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  }

  function renderEnding(justArrived) {
    var run = progress.run;
    var end = endingOf(run.ending);
    if (justArrived) {
      sfx('win');
      S.saveResult(end.code, cardText(end));
      if (progress.endingsSeen.indexOf(end.code) < 0) progress.endingsSeen.push(end.code);
      saveProgress();
    }
    $('e-eyebrow').textContent = '엔딩 ' + end.code;
    $('e-title').textContent = end.title;
    window.PrivacyEmph.render($('e-summary'), end.summary);
    var body = $('e-body'); body.textContent = '';
    E.endingBody(story, end, run).forEach(function (t) { body.appendChild(rich('p', null, fill(t))); }); // 조건 줄 + ENDING_V2 선택별 한 줄

    var evs = $('e-events'); evs.textContent = '';
    [1, 2, 3].forEach(function (n) {
      var sec = el('div', 'chapter-group');
      sec.appendChild(el('p', 'group-label', chapterLabel(n)));
      story.chapters[n].events.forEach(function (e) { sec.appendChild(eventBlock(e, run)); });
      evs.appendChild(sec);
    });
    var cls = $('e-class'), plan = classPlanBlock(run); cls.textContent = ''; cls.hidden = !plan; if (plan) cls.appendChild(plan);
    var st = $('e-stats'); st.textContent = '';
    var grid = el('div', 'change-grid');
    var a = el('div');
    a.appendChild(el('h3', null, '선택이 남긴 흔적'));
    a.appendChild(statRows({}, run.stats, false, E.seriousSplit(story, run)));
    var b = el('div');
    b.appendChild(el('h3', null, '친구들의 믿음 (처음과 비교)'));
    b.appendChild(trustRows(run.chapterMarks[0].trust, run.trust));
    grid.appendChild(a); grid.appendChild(b);
    st.appendChild(grid);
    show('v-ending');
    if (justArrived) finale(run, end);
  }

  /* ── 선택 경로 ─────────────────────── */
  function renderPath(back) {
    pathBack = back || pathBack;
    var run = progress.run;
    var list = $('p-list'); list.textContent = '';
    var endBox = $('p-endings'); endBox.textContent = '';

    var eh = el('div', 'endings-seen');
    eh.appendChild(el('h2', null, '엔딩 ' + progress.endingsSeen.length + ' / ' + story.endings.length));
    var eul = el('ul', 'ending-chips');
    story.endings.forEach(function (e) {
      var seen = progress.endingsSeen.indexOf(e.code) >= 0;
      var li = el('li', seen ? 'seen' : 'unseen');
      li.appendChild(el('span', 'chip-code', e.code));
      li.appendChild(el('span', null, seen ? e.title : '아직 보지 못한 엔딩'));
      if (run && run.ending === e.code) li.appendChild(el('span', 'chip-now', '이번 엔딩'));
      eul.appendChild(li);
    });
    eh.appendChild(eul);
    endBox.appendChild(eh);

    if (!run) { list.appendChild(el('p', 'mute', '아직 기록된 선택이 없어요.')); show('v-path'); return; }
    var visited = {};
    run.visited.forEach(function (s) { visited[s] = true; });

    var groups = [{ key: null, title: '프롤로그' }];
    [1, 2, 3].forEach(function (n) {
      story.chapters[n].events.forEach(function (e) { groups.push({ key: e, title: n + '장 · ' + story.events[e].title, topic: story.events[e].topic }); });
    });
    groups.forEach(function (g) {
      var entries = run.history.filter(function (h) { return story.scenes[h.scene].event === g.key; });
      var sec = el('section', 'path-group');
      var h2 = el('h2', null, g.title);
      if (g.topic) { h2.appendChild(el('span', 'event-topic', g.topic)); }
      sec.appendChild(h2);
      entries.forEach(function (h) {
        var sc = story.scenes[h.scene];
        var card = el('div', 'path-step');
        card.appendChild(el('p', 'path-q', sc.label + (sc.prompt ? ' — ' + fill(sc.prompt) : '')));
        var ul = el('ul', 'path-opts');
        E.visibleChoices(story, sc, h.snap).forEach(function (c) {
          var mine = c.id === h.choice;
          var li = el('li', mine ? 'mine' : 'other');
          li.appendChild(el('span', 'opt-mark', mine ? '✓ 내 선택' : '다른 선택'));
          li.appendChild(el('span', 'opt-text', fill(c.text)));
          var ex = progress.explored[h.scene] || [];
          if (!mine && ex.indexOf(c.id) >= 0) li.appendChild(el('span', 'opt-note', '이전 플레이에서 고른 적 있음'));
          ul.appendChild(li);
        });
        card.appendChild(ul);
        sec.appendChild(card);
      });
      if (g.key) {
        var missed = Object.keys(story.scenes).filter(function (id) { return story.scenes[id].event === g.key && !visited[id]; });
        if (missed.length) {
          var m = el('p', 'path-missed');
          m.appendChild(el('span', 'opt-mark', '이번에 지나지 않은 장면'));
          m.appendChild(document.createTextNode(missed.map(function (id) { return story.scenes[id].label; }).join(' · ')));
          sec.appendChild(m);
        }
      }
      list.appendChild(sec);
    });
    show('v-path');
  }

  /* ── 성찰 ─────────────────────────── */
  function renderReflect(back) {
    reflectBack = back || reflectBack;
    $('r-core').textContent = story.reflection.core;
    var b = $('r-basic'), d = $('r-deep');
    b.textContent = ''; d.textContent = '';
    story.reflection.basic.forEach(function (q) { b.appendChild(el('li', null, q)); });
    story.reflection.deep.forEach(function (q) { d.appendChild(el('li', null, q)); });
    show('v-reflect');
  }

  /* ── 성찰 카드(2026-11-10) ───────────────
   * 엔딩 뒤에 여는 한 장: 게임에서 한 선택(자동) + 큰 토픽 세 개에 쓰는 칸 + 이름·학번 → 브라우저 인쇄 창으로 PDF 저장.
   *   로직 = js/card.js(PrivacyCard), 문구 = story.card. 쓴 글·이름·학번은 이 기기에만(ethicity.privacy.card.v1), 입력할 때마다 저장.
   *   지우는 때: 「이 게임 기록 지우기」, 새 진행 시작(startNew). 쓴 글이 있으면 새로 시작하기 전에 먼저 묻는다(guardCard).
   *   인쇄하는 동안만 문서 제목 = 공유한순간_성찰카드_학번_이름(저장되는 PDF 이름) → 끝나면 되돌린다. */
  var Card = window.PrivacyCard, CARD = story.card;
  var card = null, cardBack = 'v-ending';
  var baseTitle = document.title, printTitled = false;
  var CARD_NUM = ['①', '②', '③', '④', '⑤'];
  function cardRaw() { return S.readJSON(S.KEYS.card).value; }
  function cardSave() { if (card) { S.writeJSON(S.KEYS.card, card); checkWriteFailure(); } }
  function cardWipe() { S.remove(S.KEYS.card); card = null; }
  // 새 진행을 시작하기 전: 카드에 쓴 글이 있으면 먼저 묻고, 없으면 바로 next(이름·학번만 있으면 묻지 않는다 — startNew가 함께 지운다)
  function guardCard(next) {
    if (!Card.hasText(cardRaw())) { next(); return; }
    ask(CARD.wipeTitle, CARD.wipeAsk, '지우고 새로 시작', next);
  }
  function todayText() { var d = new Date(); return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; }
  function cardNeed() {
    var t = card && card.sid && card.name ? '' : CARD.needNote, n = $('k-need');
    if (n.textContent !== t) n.textContent = t;
    n.hidden = !t;
  }
  function renderCard(back) {
    var run = progress.run;
    if (!Card.finished(run)) { renderStart(); return; } // 엔딩을 본 진행이 있을 때만
    cardBack = back || cardBack;
    var r = Card.read(cardRaw(), run);
    card = r.card;
    if (r.stale) cardSave(); // 다른 진행에서 쓴 글은 섞지 않는다(빈 카드로 덮어씀)
    var end = endingOf(run.ending);
    $('k-eyebrow').textContent = CARD.title;
    $('k-intro').textContent = CARD.intro;
    $('k-game').textContent = story.title + ' · ' + CARD.title;
    $('k-title').textContent = CARD.heading;
    $('k-sid').value = card.sid;
    $('k-name').value = card.name;
    $('k-date').textContent = todayText();
    $('k-ending').textContent = end ? '엔딩 ' + end.code + ' · ' + end.title : '';
    $('k-device').textContent = CARD.deviceNote;
    $('k-pdf').textContent = CARD.pdfNote;
    var box = $('k-topics');
    box.textContent = '';
    Card.topics(story, E, run).forEach(function (t, i) {
      var sec = el('section', 'rcard-topic'), id = 'k-a' + (i + 1);
      sec.setAttribute('data-topic', t.id);
      var h = el('h2');
      h.appendChild(el('span', 'rcard-num', CARD_NUM[i] || String(i + 1)));
      h.appendChild(document.createTextNode(' ' + t.title));
      sec.appendChild(h);
      // 게임이 채우는 칸: 내가 한 선택(평가 없이 사실만)
      var auto = el('div', 'rcard-auto');
      auto.appendChild(el('p', 'rcard-auto-label', t.label));
      if (t.items.length) {
        var ul = el('ul');
        t.items.forEach(function (it) {
          var li = el('li');
          if (it.head) li.appendChild(el('span', 'rcard-ev', it.head));
          li.appendChild(el('span', 'rcard-out', fill(it.text)));
          ul.appendChild(li);
        });
        auto.appendChild(ul);
      } else auto.appendChild(el('p', 'rcard-empty', t.empty));
      sec.appendChild(auto);
      // 학생이 쓰는 칸: 화면에서는 textarea, 인쇄에서는 같은 글을 문단으로(비우면 '작성 안 함')
      var lab = el('label', 'rcard-q', t.q);
      lab.setAttribute('for', id);
      sec.appendChild(lab);
      var ta = document.createElement('textarea');
      ta.id = id; ta.className = 'rcard-input'; ta.rows = 3; ta.maxLength = Card.MAX_TEXT;
      ta.value = card.answers[i] || '';
      ta.setAttribute('aria-describedby', id + '-count');
      sec.appendChild(ta);
      var cnt = el('p', 'rcard-count');
      cnt.id = id + '-count';
      sec.appendChild(cnt);
      var out = el('p', 'rcard-answer print-only');
      out.setAttribute('aria-hidden', 'true');
      sec.appendChild(out);
      function sync() {
        var v = Card.printText(ta.value);
        cnt.textContent = ta.value.length + ' / ' + Card.MAX_TEXT + '자';
        out.textContent = v || CARD.none;
        out.classList.toggle('none', !v);
      }
      ta.addEventListener('input', function () { if (!card) return; card.answers[i] = Card.cleanText(ta.value); sync(); cardSave(); });
      sync();
      box.appendChild(sec);
    });
    cardNeed();
    show('v-card');
  }
  function cardField(inputId, key, max) {
    $(inputId).addEventListener('input', function () {
      if (!card) return;
      card[key] = Card.cleanLine($(inputId).value, max);
      cardNeed(); cardSave();
    });
  }
  function cardFileTitle() { return Card.fileName(CARD.fileBase, card ? card.sid : '', card ? card.name : ''); }
  // 인쇄 창이 뜨는 동안만 문서 제목을 파일 이름으로(Ctrl+P로 직접 인쇄해도 같다)
  function cardBeforePrint() { if (current === 'v-card' && card) { document.title = cardFileTitle(); printTitled = true; } }
  function cardAfterPrint() { if (printTitled) { document.title = baseTitle; printTitled = false; } }
  function cardPrint() {
    cardBeforePrint();
    try { window.print(); }
    catch (e) { cardAfterPrint(); showNotice('이 브라우저에서는 인쇄 창을 열 수 없어요. 컴퓨터의 크롬·엣지에서 다시 열어 주세요.'); }
  }

  /* ── 메뉴·확인 창 ─────────────────── */
  var lastFocus = null;
  function openOverlay(id) {
    lastFocus = document.activeElement;
    $(id).hidden = false;
    var f = $(id).querySelector('input:checked, button, input');
    if (f) f.focus();
  }
  function closeOverlay(id) {
    $(id).hidden = true;
    if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  var confirmCb = null;
  function ask(title, text, yesLabel, cb) {
    $('confirm-title').textContent = title;
    $('confirm-text').textContent = text;
    $('confirm-yes').textContent = yesLabel || '확인';
    confirmCb = cb;
    openOverlay('confirm');
    $('confirm-no').focus();
  }
  function trapFocus(e, id) {
    if (e.key !== 'Tab') return;
    var f = Array.prototype.filter.call($(id).querySelectorAll('button, input'), function (n) { return !n.disabled; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function syncMenu() {
    Array.prototype.forEach.call(document.querySelectorAll('input[name=speed]'), function (r) { r.checked = r.value === settings.speed; });
    $('opt-motion').checked = settings.reduceMotion;
    $('opt-sound').checked = settings.sound;
    $('opt-joystick').checked = settings.joystick;
    $('opt-joystick-row').hidden = !window.PrivacyMap.isTouch(); // PC(터치 없음)에서는 조이스틱이 없으니 설정도 숨김
  }

  // 새로 시작할 때마다: 어두운 화면에 주의 안내 → '확인했어요'를 눌러야 시작(이어 하기에는 없음)
  function showWarning(done) {
    var w = $('warning'), ok = $('btn-warning-ok');
    w.hidden = false;
    ok.onclick = function () { w.hidden = true; ok.onclick = null; done(); };
    ok.focus({ preventScroll: true });
  }
  function startNew() {
    stopReveal();
    cardWipe(); // 성찰 카드에 쓴 글·이름·학번(쓴 글이 있으면 guardCard가 먼저 물었다)
    progress.pos = null;
    setRun(E.createState(story));
    routeRun(true);
  }

  /* ── 이벤트 연결 ─────────────────── */
  function bind() {
    Array.prototype.forEach.call(document.querySelectorAll('input[name=look]'), function (r) {
      r.addEventListener('change', function () { settings.look = r.value; $('look-msg').hidden = true; saveSettings(); renderPlayerChip(); });
    });
    $('btn-new').addEventListener('click', function () {
      if (needLook()) return;
      if (progress.run && progress.run.screen !== 'ending') {
        ask('처음부터 시작할까요?', '지금까지의 진행은 지워져요. 완료한 결과와 지난 선택 기록은 남아요.', '처음부터', function () { guardCard(function () { showWarning(startNew); }); });
      } else guardCard(function () { showWarning(startNew); });
    });
    $('btn-continue').addEventListener('click', function () { if (needLook()) return; routeRun(false); });
    $('name-input').addEventListener('input', function () {
      settings.nickname = cleanName($('name-input').value);
      showPlayerName();
      saveSettings();
    });
    $('btn-start-path').addEventListener('click', function () { renderPath('v-start'); });
    $('btn-start-reflect').addEventListener('click', function () { renderReflect('v-start'); });
    $('btn-chapter-go').addEventListener('click', function () { setRun(E.advance(story, progress.run)); routeRun(true); });
    $('btn-end-path').addEventListener('click', function () { renderPath('v-ending'); });
    $('btn-end-reflect').addEventListener('click', function () { renderReflect('v-ending'); });
    $('btn-end-replay').addEventListener('click', function () { guardCard(startNew); });
    $('btn-end-card').addEventListener('click', function () { renderCard('v-ending'); });
    $('btn-start-card').addEventListener('click', function () { renderCard('v-start'); });
    $('btn-card-back').addEventListener('click', function () { goTo(cardBack); });
    $('btn-card-print').addEventListener('click', cardPrint);
    cardField('k-sid', 'sid', Card.MAX_SID);
    cardField('k-name', 'name', Card.MAX_NAME);
    window.addEventListener('beforeprint', cardBeforePrint);
    window.addEventListener('afterprint', cardAfterPrint);
    $('btn-path-reflect').addEventListener('click', function () { renderReflect('v-path'); });
    $('btn-path-back').addEventListener('click', function () { goTo(pathBack); });
    $('btn-reflect-back').addEventListener('click', function () { goTo(reflectBack); });
    $('btn-reflect-home').addEventListener('click', renderStart);

    $('btn-undo').addEventListener('click', function () {
      var run = progress.run;
      if (!run || !run.history.length) return;
      var last = run.history[run.history.length - 1];
      var c = (story.scenes[last.scene].choices || []).filter(function (x) { return x.id === last.choice; })[0];
      // c가 없을 수 있다: 보기 id가 바뀐 옛 저장(특별 수업 알림 범위, 2026-11-10) — 문구만 일반적으로
      ask('이전 선택으로 돌아갈까요?', (c ? '“' + fill(c.text) + '”를' : '마지막 선택을') + ' 고르기 직전으로 돌아가요. 그 뒤의 진행은 지워져요.', '돌아가기', function () {
        stopReveal();
        sfx('retry');
        setRun(E.undo(progress.run));
        routeRun(false);
      });
    });

    $('btn-menu').addEventListener('click', function () { syncMenu(); openOverlay('menu'); });
    $('btn-menu-close').addEventListener('click', function () { closeOverlay('menu'); });
    $('menu').addEventListener('click', function (e) { if (e.target === $('menu')) closeOverlay('menu'); }); // 바깥 어두운 곳을 눌러도 닫힘(2026-11-02 모바일)
    Array.prototype.forEach.call(document.querySelectorAll('input[name=speed]'), function (r) {
      r.addEventListener('change', function () { settings.speed = r.value; applySettings(); saveSettings(); });
    });
    $('opt-motion').addEventListener('change', function () { settings.reduceMotion = $('opt-motion').checked; applySettings(); saveSettings(); });
    $('opt-sound').addEventListener('change', function () { settings.sound = $('opt-sound').checked; settings.soundSet = true; saveSettings(); if (settings.sound) sfx('msg', true); }); // 켜면 알림음 미리듣기
    $('opt-joystick').addEventListener('change', function () { settings.joystick = $('opt-joystick').checked; saveSettings(); window.PrivacyMap.setJoystick(); });
    $('btn-menu-home').addEventListener('click', function () { $('menu').hidden = true; renderStart(); });
    $('btn-menu-help').addEventListener('click', function () { settings.helpFold = false; settings.helpPlaces = []; applyHelp(); saveSettings(); closeOverlay('menu'); }); // 다시 두 장소 동안 보임
    $('btn-menu-restart').addEventListener('click', function () {
      $('menu').hidden = true;
      ask('처음부터 다시 할까요?', '지금까지의 진행은 지워져요. 완료한 결과와 지난 선택 기록은 남아요.', '처음부터', function () { guardCard(startNew); });
    });
    $('btn-menu-wipe').addEventListener('click', function () {
      $('menu').hidden = true;
      ask('이 게임 기록을 모두 지울까요?', '‘공유한 순간’의 진행, 지난 선택 기록, 완료 결과, 성찰 카드에 쓴 글과 이름·학번이 지워져요. 공통 캐릭터와 다른 게임 기록은 지우지 않아요.', '지우기', function () {
        cardWipe();
        S.remove(S.KEYS.progress);
        S.remove(S.KEYS.result);
        progress = { v: 1, run: null, explored: {}, endingsSeen: [], pos: null };
        renderStart();
      });
    });
    $('confirm-no').addEventListener('click', function () { confirmCb = null; closeOverlay('confirm'); });
    $('confirm-yes').addEventListener('click', function () { var cb = confirmCb; confirmCb = null; $('confirm').hidden = true; if (cb) cb(); });

    document.addEventListener('keydown', function (e) {
      var fin = $('finale');
      if (fin && !fin.hidden) {
        if (e.key === 'Escape') finaleClose();
        else if ((e.key === 'Enter' || e.key === ' ') && (e.target.tagName || '') !== 'BUTTON') { e.preventDefault(); finaleAll(); }
        return;
      }
      if (!$('confirm').hidden) { if (e.key === 'Escape') { confirmCb = null; closeOverlay('confirm'); } trapFocus(e, 'confirm'); return; }
      if (!$('menu').hidden) { if (e.key === 'Escape') closeOverlay('menu'); trapFocus(e, 'menu'); return; }
      if (current !== 'v-game' || e.altKey || e.ctrlKey || e.metaKey) return;
      var tag = (e.target && e.target.tagName) || '';
      if (revealDone && (e.key === 'Enter' || e.key === ' ') && tag !== 'BUTTON') { e.preventDefault(); advanceReveal(); return; }
      if (/^[1-9]$/.test(e.key)) {
        var b = $('g-dock').querySelectorAll('.choice')[Number(e.key) - 1];
        if (b) { e.preventDefault(); b.click(); }
      }
    });
    $('g-log').addEventListener('click', function (e) { if (e.target.closest && e.target.closest('button')) return; if (revealDone) advanceReveal(); }); // 사진 '눌러서 보기'는 넘기기로 치지 않음
  }
  function goTo(view) {
    if (view === 'v-ending' && progress.run && progress.run.screen === 'ending') renderEnding(false);
    else if (view === 'v-path') renderPath();
    else renderStart();
  }

  /* ── 시작 ─────────────────────────── */
  cgSetup();
  loadAll();
  applySettings();
  applyHelp();
  bind();
  window.PrivacyMap.init({
    story: story,
    fill: fill,
    playerName: function () { return player.nickname; },
    playerLook: function () { return playerLook() || 'm'; },
    evalCond: function (c) { return E.evalCond(c, progress.run); },
    instant: function () { return settings.speed === 'instant'; },
    reduceMotion: function () { return settings.reduceMotion; },
    joystick: function () { return settings.joystick; },
    onPlace: onPlace,
    loadPos: function () { return progress.pos; },
    savePos: function (p) { progress.pos = p; clearTimeout(posTimer); posTimer = setTimeout(saveProgress, 400); },
    onEnter: function () { clearTimeout(posTimer); setRun(E.advance(story, progress.run)); routeRun(true); }
  });
  renderStart();
  if (noticeMsgs.length) showNotice(noticeMsgs.join(' '));

  // 검증용 읽기 전용 창구(게임 동작에는 쓰지 않음)
  window.PrivacyApp = {
    state: function () { return progress.run ? E.clone(progress.run) : null; },
    player: function () { return E.clone(player); },
    setSpeed: function (s) { if (SPEED_MS.hasOwnProperty(s)) { settings.speed = s; applySettings(); } },
    setReduceMotion: function (v) { settings.reduceMotion = !!v; applySettings(); },
    typing: function () { return !!((typing && typing.active) || typingDots); },
    staging: function () { return cutPending; }
  };
})();
