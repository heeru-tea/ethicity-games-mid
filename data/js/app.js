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

  var App = { screen: 'title', go: go };

  root.DR = root.DR || {};
  root.DR.App = App;
})(window);
