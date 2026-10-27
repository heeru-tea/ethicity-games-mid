/*
 * 흐름 상태 기계 — 화면(section) 전환과 임무 진행.
 */
(function (root) {
  'use strict';

  var SCREENS = ['title', 'story', 'briefing', 'run', 'inspect', 'supervisor', 'result', 'prep', 'outro'];

  function go(name) {
    SCREENS.forEach(function (s) {
      var el = document.getElementById('screen-' + s);
      if (el) el.hidden = s !== name;
    });
    App.screen = name;
  }

  // 디버그 진입: index.html?run=m1 — 타이틀을 건너뛰고 그 임무 달리기만(손맛 조정·테스트용)
  function debugRun(id) {
    var m = root.DR.Missions[id];
    go('run');
    var course = root.DR.Stream.build(m, root.DR.config, { seed: m.seed });
    root.DR.Run.start(document.getElementById('run-stage'), {
      mission: m, course: course, bag: [], bagMax: m.bag,
      onEnd: function (r) { root.__runResult = r; }
    });
  }

  var App = { screen: 'title', go: go };

  root.DR = root.DR || {};
  root.DR.App = App;

  var params = new URLSearchParams(root.location.search);
  if (params.get('run')) debugRun(params.get('run'));
})(window);
