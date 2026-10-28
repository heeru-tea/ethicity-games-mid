/*
 * 흐름 상태 기계 — 화면(section) 전환과 임무 진행.
 * 튜토리얼: 프롤로그(프로필·독백) → 대화 → 브리핑 → 달리기 → 결과(실패면 다시) → 시험관 → 1 임무
 * 1 임무: 대화 → 브리핑 → 달리기 → 검수 → 감독관 → 결과 → (실패) 보충 → … → 선배 → 마무리
 */
(function (root) {
  'use strict';

  var SCREENS = ['title', 'profile', 'story', 'briefing', 'run', 'inspect', 'supervisor', 'result', 'prep', 'outro'];
  var DR = root.DR;

  // 화면을 바꿀 때 포커스를 풀어 둔다 — 연타한 Space/Enter가 다음 화면 버튼을 눌러 브리핑·결과를 건너뛰지 않게
  function go(name) {
    if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
    SCREENS.forEach(function (s) {
      var el = document.getElementById('screen-' + s);
      if (el) el.hidden = s !== name;
    });
    App.screen = name;
  }

  function seedFor(m) { return DR.config.randomSeed ? (Date.now() >>> 0) : m.seed; }

  // 달리기에서 잡은 카드 → 판정용 가방 항목
  function toBag(grabbed) {
    return grabbed.map(function (g) {
      return g.key ? { id: g.uid, key: g.key } : { id: g.uid, ambiguousId: g.ambiguousId, assigned: undefined };
    });
  }

  // 달리기 한 판: course를 달리고 끝나면 onDone(새로 잡은 가방 항목)
  function runCourse(m, course, bag, onDone) {
    go('run');
    App.course = course;
    DR.Run.start(document.getElementById('run-stage'), {
      mission: m, course: course, bag: bag, bagMax: m.bag,
      onEnd: function (r) {
        root.__runResult = r;
        // 화면 전환은 다음 틱에(달리기 루프 안에서 장면을 치우지 않게)
        setTimeout(function () { DR.Run.stop(); onDone(toBag(r.grabbed)); }, 0);
      }
    });
  }

  /* ---------- 튜토리얼 ---------- */
  function startTutorial() {
    var m = DR.Missions.tutorial;
    App.state = { mission: 'tutorial', bag: [], supplements: 0, firstTry: null, seed: seedFor(m) };
    DR.UI.prologue(DR.Prologue, function () {
      DR.UI.dialogue(m.story.intro, function () {
        DR.UI.briefing(m, tutorialRun);
      });
    });
  }

  function tutorialRun() {
    var m = DR.Missions.tutorial;
    var course = DR.Stream.build(m, DR.config, { seed: App.state.seed });
    runCourse(m, course, [], function (bag) {
      App.state.bag = bag;
      var r = DR.Judge.judge(m, bag, DR.config);
      App.lastJudge = r;
      DR.UI.tutorialResult(m, r, {
        onRetry: function () { DR.Sfx.play('ui'); tutorialRun(); },
        onNext: function () {
          DR.Sfx.play('ui');
          DR.UI.dialogue(m.story.outro, function () { startMission('m1'); });
        }
      });
    });
  }

  /* ---------- 임무 ---------- */
  function startMission(id) {
    var m = DR.Missions[id];
    App.state = { mission: id, bag: [], supplements: 0, firstTry: null, seed: seedFor(m), record: null };
    DR.UI.dialogue(m.story.intro, function () {
      DR.UI.briefing(m, function () {
        var course = DR.Stream.build(m, DR.config, { seed: App.state.seed });
        runCourse(m, course, [], function (bag) {
          App.state.bag = bag;
          App.afterRun(m);
        });
      });
    });
  }

  // 달리기 뒤: 검수 → 감독관 → 결과
  function afterRun(m) { review(m); }

  function review(m) {
    DR.UI.inspect(m, App.state.bag, function () { askSupervisor(m); });
  }

  function askSupervisor(m) {
    DR.UI.supervisor(m.story.supervisorQuestion, function () { review(m); }, function () { judgeAndShow(m); });
  }

  function judgeAndShow(m) {
    var r = DR.Judge.judge(m, App.state.bag, DR.config);
    App.lastJudge = r;
    if (App.state.firstTry === null) App.state.firstTry = r.allPass;
    DR.UI.result(m, r, function () {
      if (r.allPass || App.state.supplements >= DR.config.maxSupplements) finishMission(m);
      else prepSupplement(m, r);
    });
  }

  // 보충: 빠진 조합에 모자란 장 수만큼(여유 포함) 그 카드가 나오는 짧은 코스. 이미 모은 가방은 그대로.
  // 부족분은 보충 준비에서 플레이어가 카드를 뺀 뒤의 가방으로 센다.
  function prepSupplement(m, r) {
    DR.UI.supplementPrep(m, r, App.state.bag, function (bag) {
      App.state.supplements++;
      var short = DR.Judge.shortfall(m, bag, DR.config);
      var course = DR.Stream.build(m, DR.config, { seed: App.state.seed + App.state.supplements, focusCounts: short });
      runCourse(m, course, bag, function (fresh) {
        App.state.bag = bag.concat(fresh);
        var undecided = fresh.some(function (c) { return c.ambiguousId && c.assigned === undefined; });
        if (undecided) review(m); else askSupervisor(m);
      });
    });
  }

  function finishMission(m) {
    App.state.record = { firstTry: App.state.firstTry, supplements: App.state.supplements };
    DR.UI.dialogue(m.story.senior, function () {
      DR.UI.outro(m.story.outro, function () { DR.Sfx.play('ui'); go('title'); });
    });
  }

  // 테스트 훅: 달리는 중 현재 코스에서 key(또는 ambiguousId) 카드를 앞에서부터 골라 가방에 넣는다
  function debugFill(counts) {
    var items = DR.Run.course().items;
    Object.keys(counts).forEach(function (id) {
      var need = counts[id];
      for (var i = 0; i < items.length && need > 0; i++) {
        var it = items[i];
        if (it.kind === 'card' && (it.key === id || it.ambiguousId === id) && !DR.Run.isTaken(it.uid)) {
          DR.Run.debugTake(it.uid); need--;
        }
      }
      if (need > 0) throw new Error('코스에 ' + id + ' 카드가 모자람');
    });
  }

  // 디버그 진입: index.html?run=m1 — 타이틀을 건너뛰고 그 임무 달리기만(손맛 조정·테스트용)
  function debugRun(id) {
    var m = DR.Missions[id];
    go('run');
    var course = DR.Stream.build(m, DR.config, { seed: m.seed });
    App.course = course;
    DR.Run.start(document.getElementById('run-stage'), {
      mission: m, course: course, bag: [], bagMax: m.bag,
      onEnd: function (r) { root.__runResult = r; }
    });
  }

  var App = {
    screen: 'title', state: null, lastJudge: null, course: null,
    go: go, startTutorial: startTutorial, startMission: startMission, afterRun: afterRun, debugFill: debugFill
  };
  DR.App = App;

  document.getElementById('btn-start').addEventListener('click', function () {
    DR.Sfx.unlock(); DR.Sfx.play('ui');
    startTutorial();
  });

  var params = new URLSearchParams(root.location.search);
  if (params.get('run')) debugRun(params.get('run'));
  else if (params.get('start')) startMission(params.get('start'));
})(window);
