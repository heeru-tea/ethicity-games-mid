/*
 * 3D 마을 무대 — Three.js r149(vendor/three.min.js). 고정 직교 카메라, 회전·확대 없음.
 * SVG 지도(map2d.js)와 같은 StageView 인터페이스를 따른다. 조작은 오른쪽 패널(키보드)로도 모두 가능하고,
 * 여기서는 정류장 클릭(레이캐스트)만 받는다. WebGL을 만들 수 없으면 { ok:false }를 돌려주고 앱은 SVG로 간다.
 * 건물은 외부 모델 없이 상자·원기둥으로 만든 미니어처다(원작 게임 그래픽을 따라 하지 않음).
 */
(function (root) {
  'use strict';
  var K = 10;               // 지도 1칸 → 3D 10
  var PX = 110;             // SVG 1칸 = 110px (버스 차선 오프셋 변환용)
  var LANE = 1.0;           // 노선 띠 간격(3D)
  var CAMERA_ELEVATION = 55; // 지면 기준 고도각: 건물 옆면과 노선 가독성의 절충
  var C = {
    bg: 0xF5F5F4, ground: 0xEAE7E1, road: 0xA3A9B2, stop: 0xFFFFFF, ring: 0x1A1D24, accent: 0x2563EB, warn: 0x9A3412,
    wall: [0xE8E3DA, 0xDAD4C9, 0xCFD7DB, 0xE4D6C6, 0xD7DDD3], roof: [0x8E9AA6, 0xB0805A, 0x7C8A8C, 0x9B6B5B],
    green: 0x93AD8F, field: 0xC7B995, people: 0x8A5A44
  };

  function supported() {
    try {
      var c = document.createElement('canvas');
      return !!(root.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  function create(container, opts) {
    opts = opts || {};
    var T = root.THREE;
    if (!T || !supported()) return { ok: false, kind: '3d' };
    var renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true }); } catch (e) { return { ok: false, kind: '3d' }; }
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    renderer.setClearColor(C.bg, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    var labels = document.createElement('div');
    labels.className = 'labels-3d';
    labels.setAttribute('aria-hidden', 'true');
    container.appendChild(labels);

    var scene = new T.Scene();
    var camera = new T.OrthographicCamera(-50, 50, 30, -30, 1, 1000);
    scene.add(new T.HemisphereLight(0xffffff, 0xb3aa9e, 0.85));
    var sun = new T.DirectionalLight(0xffffff, 0.55);
    sun.position.set(-40, 80, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    var sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 250;
    scene.add(sun);

    var groups = { world: new T.Group(), routes: new T.Group(), buses: new T.Group(), people: new T.Group() };
    Object.keys(groups).forEach(function (k) { scene.add(groups[k]); });
    var nodes = {}, stops = {}, hits = [], zoneGroups = {}, routeSegs = {}, busMesh = {}, lastBus = {};
    var labelEls = { stop: {}, wait: {}, bus: {} };
    var reduced = false, dirty = true, bounds = null, rising = null, prevIds = null, waitingNow = {}, currentRoutes = [];

    var matCache = {};
    function mat(color, extra) {
      var key = color + JSON.stringify(extra || {});
      if (!matCache[key]) matCache[key] = new T.MeshLambertMaterial(Object.assign({ color: color }, extra || {}));
      return matCache[key];
    }
    function mesh(geo, color, x, y, z, parent, shadow) {
      var m = new T.Mesh(geo, mat(color));
      m.position.set(x, y, z);
      if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
      parent.add(m);
      return m;
    }
    function box(w, h, d, color, x, z, parent, y) { return mesh(new T.BoxGeometry(w, h, d), color, x, (y || 0) + h / 2, z, parent); }
    function house(x, z, parent, wall, roof) {
      box(3, 2.2, 3, wall, x, z, parent);
      var r = mesh(new T.ConeGeometry(2.5, 1.6, 4), roof, x, 2.2 + 0.8, z, parent);
      r.rotation.y = Math.PI / 4;
      box(.65,1.2,.1,0x6E837F,x-.6,z+1.55,parent);box(.75,.65,.1,0x89A9B2,x+.6,z+1.55,parent,1);
    }
    // Shared miniature vocabulary: slate roofs, blue-grey glazing and muted planting.
    function tree(x,z,g,size){size=size||1;box(.28,1.5*size,.28,0x8D7761,x,z,g);mesh(new T.IcosahedronGeometry(1.15*size,1),0x78967D,x,2*size,z,g);}
    function bench(x,z,g){box(1.8,.18,.65,0xA58C70,x,z,g,.65);box(1.8,.65,.16,0xA58C70,x,z-.3,g,.7);[-.6,.6].forEach(function(dx){box(.15,.65,.45,0x66746D,x+dx,z,g);});}
    function windows(x,z,width,height,g){for(var y=1.5;y<height-.5;y+=1.8){box(width*.75,.65,.08,0x7393A3,x,z,g,y);}}
    function building(x,z,width,depth,height,g,color){box(width,height,depth,color||0xDADFD8,x,z,g);box(width+.25,.28,depth+.25,0x71858A,x,z,g,height);windows(x,z+depth/2+.05,width,height,g);box(.8,1.35,.12,0x526F7B,x,z+depth/2+.08,g);}
    function garden(x,z,g){box(2.2,.25,1.1,0xC6CCBE,x,z,g);[-.65,0,.65].forEach(function(dx){mesh(new T.IcosahedronGeometry(.5,0),0x819B7D,x+dx,.65,z,g);});}
    function w(i) { return C.wall[i % C.wall.length]; }
    function rf(i) { return C.roof[i % C.roof.length]; }

    // 생활권별 블록 묶음. (ox, oz)는 정류장에서 도로를 피한 쪽으로 옮긴 위치
    var ZONES = {
      N: function(g){
        box(26,.18,19,0xCAD3D5,0,-2,g);
        [[-9,-6,5,5,13],[-3,-7,5,5,19],[4,-7,5,5,16],[10,-5,4,5,12],[-8,1,4,4,8],[-2,0,4,4,11],[5,0,5,4,9]].forEach(function(p,i){building(p[0],p[1],p[2],p[3],p[4],g,[0xC8D5DC,0xDDE3E3,0xB6C9D5][i%3]);});
        box(14,.15,3,0x82979C,0,5,g);garden(-8,5,g);garden(8,5,g);
      },
      A: function (g) {
        box(9, 2.6, 4.5, 0xD9DEE3, 0, 0, g); box(10.5, 0.4, 5.6, 0x8E9AA6, 0, 0, g, 2.6); box(2.4, 5.5, 2.4, 0xCFD7DB, 3.6, -0.6, g);
        windows(0,2.3,8,2.6,g);box(3,.25,1.5,0x819B8A,0,3,g,2);
        var tracks = new T.Group(); tracks.name = 'station-rails'; g.add(tracks);
        [-5, -8].forEach(function(z) {
          box(23, .15, 2.4, 0xB8B5AF, 0, z, tracks);
          for(var x=-11;x<=11;x+=1.1)box(.35,.2,2,0x786B5C,x,z,tracks,.15);
          [-.65,.65].forEach(function(d){box(23,.24,.17,0x58636B,0,z+d,tracks,.35);});
        });
        box(16,.5,1.3,0xD6D8D8,0,-3.1,tracks);
      },
      B: function (g) {
        [[-3,-2,6],[1,-2,7.5],[-3,2,4.5],[1,2,5.5]].forEach(function(p,i){building(p[0],p[1],3,2.8,p[2],g,w(i));});garden(4,1,g);tree(4,-2,g,.8);
      },
      C: function (g) {
        box(11,.15,8,0xC9D3BE,0,0,g);building(0,-2,8,3,4,g,0xDBD5C5);building(4,.4,2.8,4,3,g,0xDBD5C5);
        box(3,.2,4,0xDFDCD0,-1,2,g);[-1,0,1].forEach(function(x){box(.22,2,.22,0xF0EBDD,x,-.35,g);});box(3.4,.35,1.3,0x71858A,0,-.2,g,2);tree(-4,2,g);bench(2,3,g);
      },
      D: function (g) {
        building(-2,0,4.6,4,6,g,0xE3E6DF);building(2.5,.4,4,3.2,3.6,g,0xD8E1DF);box(2.8,.25,1.5,0x749DA5,0,2.6,g,2.1);
        box(.35,1.5,.12,0x68908D,-2,2.08,g,4.1);box(1.25,.35,.13,0x68908D,-2,2.1,g,4.65);garden(3,3,g);
      },
      E: function (g) {
        box(12,.1,8,0xD9D1C3,0,1,g);[-3.8,0,3.8].forEach(function(x,i){building(x,-1.5,3.2,3,2.5,g,w(i));
          var canopy=box(3.5,.2,1.8,[0x829B86,0xBD9B79,0x7F99AB][i],x,.6,g,1.8);canopy.rotation.x=.12;
          [-1,0,1].forEach(function(dx){box(.22,.06,1.8,0xECE8D8,x+dx,.6,g,1.94);});
          box(2.5,.7,.8,0x9D8870,x,1.1,g);box(2.2,.15,.7,[0xB2BA81,0xCEAE7E,0x92AB8C][i],x,1.1,g,.7);
        });bench(0,4,g);tree(-5,3.5,g,.8);tree(5,3.5,g,.8);
      },
      F: function (g) {
        box(12,.1,8,0xBBC6A5,0,0,g);house(-3,-1.8,g,w(0),rf(0));house(2,-2.4,g,w(3),rf(2));
        box(1.3,.1,5,0xD8CEB9,-.5,1.2,g);box(3,.15,2,0xB09C76,3,2,g);[-.6,0,.6].forEach(function(d){box(2.6,.12,.18,0x7F9970,3,2+d,g,.15);});
        [-5,5].forEach(function(x){tree(x,-2,g,.9);});bench(-3,2,g);garden(-3,3.4,g);
      },
      G: function (g) {
        [-3,2].forEach(function(x){building(x,0,4,6,3.4,g,0xBCC8C8);box(3,.2,5,0x647C88,x,0,g,3.8);box(2,1.7,.15,0x829599,x,3.1,g);});
        box(2.5,1.1,1.7,0xB5A48A,5,2,g);mesh(new T.CylinderGeometry(.5,.6,5,10),0x7D8F94,5,2.5,-2,g);
      },
      H: function (g) {
        var turf=mesh(new T.CylinderGeometry(8.4,8.4,.16,48),0x79A879,0,.08,0,g,false);turf.scale.z=.82;
        // Open-front tiered stands surround a visible baseball field.
        for(var i=0;i<22;i++){var a=i/22*Math.PI*2;if(Math.sin(a)>.62)continue;
          for(var row=0;row<3;row++){var radius=7.2+row*.85,h=.65+row*.7;
            var stand=box(2.6,h,.9,0xC9D0D4,Math.cos(a)*radius,Math.sin(a)*radius*.82,g);stand.rotation.y=-a-Math.PI/2;
            var seat=box(2.4,.18,.55,row%2?0x809BB0:0xA3B6C4,Math.cos(a)*radius,Math.sin(a)*radius*.82,g,h);seat.rotation.y=stand.rotation.y;
          }
        }
        var infield=box(4.5,.1,4.5,0xC9A47B,0,1.1,g,.18);infield.rotation.y=Math.PI/4;
        var inner=box(3.2,.12,3.2,0x87AE7F,0,1.1,g,.25);inner.rotation.y=Math.PI/4;
        [[0,4.2],[-3.15,1.1],[0,-2.05],[3.15,1.1]].forEach(function(p){var base=box(.48,.12,.48,0xFFF9EA,p[0],p[1],g,.4);base.rotation.y=Math.PI/4;});
        [-1,1].forEach(function(sign){var line=box(.09,.04,8.5,0xF5F3DB,sign*3,1.2,g,.45);line.rotation.y=sign*Math.PI/4;});
        [[-9,-5],[9,-5],[-9,4],[9,4]].forEach(function(p){box(.35,7,.35,0x8A969D,p[0],p[1],g);box(2.7,1.1,.5,0x65727C,p[0],p[1],g,6.5);[-.8,0,.8].forEach(function(x){box(.55,.6,.12,0xFFF5C5,p[0]+x,p[1]+.3,g,6.8);});});
        box(4.8,2.4,.45,0x3F5964,0,-7.6,g,3);box(.3,3,.3,0x8A969D,-1.7,-7.6,g);box(.3,3,.3,0x8A969D,1.7,-7.6,g);
        garden(-6,5,g);garden(6,5,g);g.scale.setScalar(.75);
      },
      I: function (g) {
        box(12,.12,9,0xCFD7CA,0,0,g);[[-3,-2,8.5],[1,-2.5,10],[4,1,7]].forEach(function(p,i){building(p[0],p[1],2.8,3,p[2],g,i===1?0xD6DFE0:0xE4E5DD);
          box(.5,p[2],.12,0x93A8AD,p[0]-.9,p[1]+1.57,g);});
        building(-2,2.6,5,2,2,g,0xBFCABF);box(5.4,.22,1,0x819B8A,-2,3.9,g,1.7);tree(-5,2,g,.8);tree(4,-3,g,.9);bench(1,3,g);garden(2,3.7,g);
      },
      L: function(g){
        var lawn=mesh(new T.CylinderGeometry(7.4,7.4,.12,32),0xB5CBA4,0,.06,0,g,false);lawn.scale.z=.7;
        [[-2,0,3.3],[1,.6,3],[3,-.5,2]].forEach(function(p){var water=mesh(new T.CylinderGeometry(p[2],p[2],.08,32),0x91BBC8,p[0],.16,p[1],g,false);water.scale.z=.72;});
        [[-5,-2],[4,-3],[-4,3],[5,2]].forEach(function(p){box(.3,1.3,.3,0x9A8265,p[0],p[1],g);mesh(new T.ConeGeometry(1.2,2.5,7),0x7F9E78,p[0],2.2,p[1],g);});
        [-2,2].forEach(function(x){box(1.8,.18,1.1,0xB69871,x,3.5,g,.8);box(2.1,.15,.4,0xA88B65,x,4.4,g,.5);});
      },
      M: function(g){
        tree(-6,3,g,.85);tree(6,3,g,.85);bench(0,5,g);
        box(13,.15,9,0xD6D7D0,0,1,g);box(11,3,6,0xD4DDE0,0,0,g);box(9,2.2,5,0xE6E0D5,0,-.3,g,3);box(11.6,.35,6.5,0x8C9EAA,0,0,g,5.2);
        [-4,-2,0,2,4].forEach(function(x){box(1.5,1.7,.18,0x94BACB,x,3.1,g,.5);box(1.5,.8,.18,0xB2CDD5,x,2.3,g,3.7);});
        box(5,.35,1.3,0xA7B29D,0,3.5,g,2.3);box(2,.2,1.6,0xBED3D7,-2,-.3,g,5.6);box(2,.2,1.6,0xBED3D7,2,-.3,g,5.6);
      },
      K: function(g){
        tree(-4,-1,g,.8);garden(3,4,g);
        box(8,.16,7,0xBCD1AD,0,1,g);box(7,2.8,3.8,0xE7DFCD,0,-1,g);box(7.6,.35,4.4,0x789B8A,0,-1,g,2.8);
        [-2,0,2].forEach(function(x){box(1.1,1,.14,0xB3CFDC,x,1,g,1);});
        box(2,.15,3,0xCDD1CA,0,3,g);box(2.5,.4,.7,0x9E8665,-2.5,3,g,.6);
        var play=box(.9,.12,2,0xD9B574,2.5,3,g,.6);play.rotation.x=.4;box(.2,1.6,.2,0x8FAD9A,2.5,2.3,g);
      },
      J: function(g){
        windows(0,-.2,9,2.8,g);bench(-5,4,g);tree(6,-2,g,.8);
        box(12,.12,10,0xCCD2D5,0,1,g);box(10,2.8,3.5,0xD6DDE0,0,-2,g);box(11,.35,4.2,0x7F929E,0,-2,g,2.8);
        [-3.5,0,3.5].forEach(function(x,i){box(2.2,1.5,5,[0x789DB6,0x86A48C,0xB9A17B][i],x,3,g);box(1.8,.5,.16,0xE3F0F4,x,.45,g,.8);});
      }
    };
    var OFFS = { A: [-7, -7], B: [-7, -7], C: [0, 8], D: [0, 8.5], E: [1, 8], F: [-4, 8], G: [7, 7], H: [0, -11], I: [4, -6], J: [0, 9], K: [-7, 0], L:[0,6], M:[0,8], N:[0,-5] };

    function wp(id) { return { x: nodes[id].x * K, z: nodes[id].y * K }; }

    // 정류장 미니어처: 이번 단계 승차 요청 수(출발+도착) 등급에 따라 시설 규모만 달리한다.
    // 색·강조는 모든 등급이 같다(이용객 수이지 중요도가 아님). 붐비는 곳의 대기 인물은 장식이라 계획 화면에서만 보인다.
    var STOP_SIZE = { low: [3.0, 1.8], mid: [3.6, 2.0], high: [4.6, 2.4] }, PLAT = 0.35, STOP_SCALE = 1.6;
    function seat(x, z, g) { box(1.1, 0.1, 0.38, 0xA58C70, x, z, g, PLAT + 0.42); box(1.1, 0.4, 0.08, 0xA58C70, x, z - 0.17, g, PLAT + 0.52); [-0.42, 0.42].forEach(function (dx) { box(0.08, 0.42, 0.32, 0x66746D, x + dx, z, g, PLAT); }); }
    function buildStop(id, tier, p) {
      // 정류장 하나를 원점 기준으로 만들고 묶음째 키워 지도 축척에서도 시설이 읽히게 한다
      var g = new T.Group(), size = STOP_SIZE[tier], W = size[0], D = size[1], back = -D / 2 + 0.2;
      g.name = 'stop-' + id; g.position.set(p.x, 0, p.z); g.scale.setScalar(STOP_SCALE); groups.world.add(g);
      // 승강장: 어두운 연석 위 밝은 판, 앞쪽 노란 안전선
      box(W + 0.24, PLAT - 0.05, D + 0.24, 0x7D8792, 0, 0, g);
      var base = mesh(new T.BoxGeometry(W, PLAT, D), C.stop, 0, PLAT / 2 + 0.01, 0, g);
      base.material = new T.MeshLambertMaterial({ color: C.stop, transparent: true });
      box(W, 0.04, 0.14, 0xE2B93B, 0, D / 2 - 0.1, g, PLAT + 0.01);
      // 표지판 기둥과 둥근 정류장 표지
      var sx = W / 2 - 0.35, sz = D / 2 - 0.4;
      box(0.14, 2.6, 0.14, 0x687782, sx, sz, g, PLAT);
      var sign = mesh(new T.CylinderGeometry(0.42, 0.42, 0.1, 20), C.accent, sx, PLAT + 2.75, sz, g); sign.rotation.x = Math.PI / 2;
      if (tier === 'low') seat(-0.5, back + 0.25, g);
      else {
        // 셸터: 기둥·뒷유리·지붕, 칸마다 의자
        var bays = tier === 'high' ? 2 : 1, bw = 1.7, hw = bays * bw, cx = -0.35;
        for (var i = 0; i <= bays; i++) box(0.1, 2.0, 0.1, 0x5B6670, cx - hw / 2 + i * bw, back, g, PLAT);
        var glass = box(hw, 1.3, 0.05, 0x9CC3D5, cx, back, g, PLAT + 0.5); glass.material = mat(0x9CC3D5, { transparent: true, opacity: 0.55 });
        box(hw + 0.4, 0.1, 1.2, 0x46525C, cx, back + 0.45, g, PLAT + 2.0);
        for (var k = 0; k < bays; k++) seat(cx - hw / 2 + bw / 2 + k * bw, back + 0.35, g);
      }
      var crowd = null;
      if (tier === 'high') {
        // 도착 안내 전광판
        box(0.12, 2.2, 0.12, 0x5B6670, -W / 2 + 0.3, D / 2 - 0.4, g, PLAT);
        box(0.9, 0.42, 0.12, 0x1F2933, -W / 2 + 0.3, D / 2 - 0.4, g, PLAT + 2.1);
        box(0.7, 0.08, 0.13, 0xF2A33A, -W / 2 + 0.3, D / 2 - 0.4, g, PLAT + 2.28);
        crowd = new T.Group(); crowd.name = 'crowd-' + id;
        [0x5A6B7B, 0x8C6E5D, 0x6E7F62, 0x7A6A8C].forEach(function (color, n) {
          var px = -W / 2 + 1.0 + n * 0.62, pz = D / 2 - 0.55 - (n % 2) * 0.3;
          mesh(new T.CylinderGeometry(0.17, 0.2, 0.72, 10), color, px, PLAT + 0.36, pz, crowd);
          mesh(new T.SphereGeometry(0.16, 12, 8), 0xE8C9A8, px, PLAT + 0.88, pz, crowd);
        });
        crowd.visible = crowdVisible; g.add(crowd);
      }
      // 강조 테두리는 평소 숨김. 지도 깜빡임(flash) 때만 바닥에 잠깐 비친다
      var halo = new T.Mesh(new T.RingGeometry(Math.max(W, D) * 0.6, Math.max(W, D) * 0.6 + 0.5, 40), new T.MeshBasicMaterial({ color: C.warn, transparent: true, opacity: 0.6, depthWrite: false }));
      halo.rotation.x = -Math.PI / 2; halo.position.set(0, 0.04, 0); halo.visible = false; g.add(halo);
      return { base: base, ring: halo, sign: sign, crowd: crowd, tier: tier, front: (D / 2 + 0.12) * STOP_SCALE };
    }
    var crowdVisible = true;
    function setCrowd(v) { crowdVisible = !!v; Object.keys(stops).forEach(function (id) { if (stops[id].crowd) stops[id].crowd.visible = crowdVisible; }); dirty = true; }

    function clear(g) { while (g.children.length) { var c = g.children.pop(); if (c.geometry) c.geometry.dispose(); } }

    function setScene(sceneDef) {
      var ids = sceneDef.nodes.map(function (n) { return n.id; });
      clear(groups.world); hits = []; stops = {}; zoneGroups = {};
      nodes = {};
      sceneDef.nodes.forEach(function (n) { nodes[n.id] = n; });
      var xs = ids.map(function (id) { return nodes[id].x * K; }), zs = ids.map(function (id) { return nodes[id].y * K; });
      bounds = { minX: Math.min.apply(null, xs) - 20, maxX: Math.max.apply(null, xs) + 16, minZ: Math.min.apply(null, zs) - 18, maxZ: Math.max.apply(null, zs) + 18 };
      var gw = bounds.maxX - bounds.minX + 40, gd = bounds.maxZ - bounds.minZ + 40;
      var ground = mesh(new T.BoxGeometry(gw, 0.2, gd), C.ground, (bounds.minX + bounds.maxX) / 2, -0.1, (bounds.minZ + bounds.maxZ) / 2, groups.world);
      ground.castShadow = false;
      if(sceneDef.river && sceneDef.river.length){
        // Flat ribbons sit below roads and route markings, with softly coloured banks.
        [[.25,0xD3DFCD,.012],[.18,0xA8CBD4,.018]].forEach(function(style){
          var vertices=[],points=sceneDef.river.filter(function(p){return p.y*K>=bounds.minZ-20&&p.y*K<=bounds.maxZ+20;});
          for(var i=1;i<points.length;i++){
            var a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.y-a.y,len=Math.hypot(dx,dz);
            var ox=-dz/len*style[0],oz=dx/len*style[0];
            [[a.x+ox,a.y+oz],[a.x-ox,a.y-oz],[b.x+ox,b.y+oz],[a.x-ox,a.y-oz],[b.x-ox,b.y-oz],[b.x+ox,b.y+oz]].forEach(function(p){vertices.push(p[0]*K,style[2],p[1]*K);});
          }
          var geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
          var ribbon=new T.Mesh(geometry,mat(style[1],{side:T.DoubleSide}));ribbon.name='river';groups.world.add(ribbon);
        });
      }
      if(sceneDef.boundary){for(var dz=-3.5*K;dz<3.5*K;dz+=3){var dash=box(.27,.09,1.6,0x24292D,sceneDef.boundary.x*K,dz,groups.world,.04);dash.name='admin-boundary';}}
      sceneDef.roads.forEach(function (r) {
        var a = wp(r.a), b = wp(r.b), len = Math.hypot(b.x - a.x, b.z - a.z);
        var m = mesh(new T.BoxGeometry(len, 0.12, 2.6), C.road, (a.x + b.x) / 2, 0.06, (a.z + b.z) / 2, groups.world, false);
        m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
        m.receiveShadow = true;
      });
      ids.forEach(function (id) {
        var p = wp(id), g = new T.Group();
        g.position.set(p.x + OFFS[id][0], 0, p.z + OFFS[id][1]);
        g.name = 'zone-' + id;
        ZONES[id](g);
        groups.world.add(g);
        zoneGroups[id] = g;
        var tier = (sceneDef.load && sceneDef.load[id] && sceneDef.load[id].tier) || 'low';
        stops[id] = buildStop(id, tier, p);
        var hit = new T.Mesh(new T.CylinderGeometry(4, 4, 4, 12), new T.MeshBasicMaterial({ visible: false }));
        hit.position.set(p.x, 1.5, p.z); hit.userData.node = id;
        groups.world.add(hit); hits.push(hit);
      });
      // 새로 생긴 생활권은 솟아오르며 등장(움직임 줄이기면 바로)
      if (prevIds) ids.forEach(function (id) {
        if (prevIds.indexOf(id) < 0 && !reduced) { zoneGroups[id].scale.y = 0.02; rising = { id: id, t0: root.performance.now() }; }
      });
      prevIds = ids.slice();
      labels.innerHTML = ''; labelEls = { stop: {}, wait: {}, bus: {} };
      ids.forEach(function (id) {
        var l = document.createElement('div'), ld = sceneDef.load && sceneDef.load[id]; l.className = 'label-3d stop-name'; l.textContent = nodes[id].name; l.dataset.tier = ld ? ld.tier : 'low';
        if (ld) { var c = document.createElement('span'); c.className = 'stop-load'; c.textContent = '요청 ' + ld.count + '건'; l.appendChild(c); }
        labels.appendChild(l); labelEls.stop[id] = l;
      });
      fit(); dirty = true;
    }

    function segKey(a, b) { return a < b ? a + b : b + a; }
    function laneWorld(a, b, num) {
      var list = routeSegs[segKey(a, b)] || [num], k = list.indexOf(num), n = list.length;
      var A = wp(a), B = wp(b), dx = B.x - A.x, dz = B.z - A.z, len = Math.hypot(dx, dz) || 1;
      var sign = a < b ? 1 : -1, off = (k - (n - 1) / 2) * LANE * sign;
      return { x: -dz / len * off, z: dx / len * off };
    }

    function setRoutes(routes) {
      currentRoutes = routes;
      clear(groups.routes);
      routeSegs = {};
      routes.forEach(function (r) {
        for (var i = 1; i < r.route.nodes.length; i++) {
          var k = segKey(r.route.nodes[i - 1], r.route.nodes[i]);
          (routeSegs[k] = routeSegs[k] || []).push(r.num);
        }
      });
      routes.forEach(function (r, ri) {
        var color = new T.Color(r.color).getHex(), m = new T.MeshLambertMaterial({ color: color, transparent: !!r.dim, opacity: r.dim ? 0.24 : 1 });
        var dash = (r.dash || '').split(' ').filter(Boolean).map(function (x) { return Number(x) * K / PX; });
        var ns = r.route.nodes;
        for (var i = 1; i < ns.length; i++) {
          if (!nodes[ns[i - 1]] || !nodes[ns[i]]) continue;
          var a = wp(ns[i - 1]), b = wp(ns[i]), o = laneWorld(ns[i - 1], ns[i], r.num);
          var len = Math.hypot(b.x - a.x, b.z - a.z), ux = (b.x - a.x) / len, uz = (b.z - a.z) / len, ang = -Math.atan2(uz, ux);
          var road=new T.Mesh(new T.BoxGeometry(len,0.10,2.6),mat(C.road));road.position.set((a.x+b.x)/2,0.08,(a.z+b.z)/2);road.rotation.y=ang;groups.routes.add(road);
          var pieces = [];
          if (!dash.length) pieces.push([1.8, len - 1.8]);
          else { var pos = 1.8, di = 0; while (pos < len - 1.8) { var on = Math.min(dash[di % dash.length], len - 1.8 - pos); pieces.push([pos, pos + on]); pos += on + (dash[(di + 1) % dash.length] || 0); di += 2; } }
          pieces.forEach(function (pc) {
            var L = pc[1] - pc[0]; if (L <= 0.05) return;
            var c = (pc[0] + pc[1]) / 2;
            var seg = new T.Mesh(new T.BoxGeometry(L, 0.18, r.dim ? 0.28 : 0.65), m);
            seg.position.set(a.x + ux * c + o.x, 0.22 + ri * 0.01, a.z + uz * c + o.z);
            seg.rotation.y = ang;
            groups.routes.add(seg);
          });
        }
        ns.forEach(function (id, i) {
          if (r.route.stops[i] || !nodes[id]) return;
          var o = laneWorld(ns[i - 1], id, r.num), p = wp(id);
          var ring = new T.Mesh(new T.TorusGeometry(0.55, 0.16, 6, 16), m);
          ring.rotation.x = Math.PI / 2; ring.position.set(p.x + o.x, 0.75, p.z + o.z);
          groups.routes.add(ring);
        });
      });
      dirty = true;
    }

    var selectable = [], selected = [];
    function paintStops() {
      Object.keys(stops).forEach(function (id) {
        var s = stops[id], isSel = selected.indexOf(id) >= 0, can = selectable.indexOf(id) >= 0;
        s.base.material.color.setHex(isSel ? C.accent : C.stop);
        s.base.material.opacity = selectable.length && !can && !isSel ? 0.4 : 1;
      });
      dirty = true;
    }
    function setSelectable(ids) { selectable = ids || []; paintStops(); }
    function setSelected(ids) { selected = ids || []; paintStops(); }

    function setBuses(list) {
      var seen = {};
      list.forEach(function (b) {
        seen[b.id] = true;
        var g = busMesh[b.id];
        if (!g) {
          g = new T.Group();
          var body = new T.Mesh(new T.BoxGeometry(3.2, 1.6, 1.7), new T.MeshLambertMaterial({ color: 0xffffff }));
          body.position.y = 1.1; body.castShadow = true; g.add(body);
          var stripe = new T.Mesh(new T.BoxGeometry(3.25, 0.45, 1.75), new T.MeshLambertMaterial({ color: 0x6B7280 }));
          stripe.position.y = 0.95; g.add(stripe);
          var dome = new T.Mesh(new T.SphereGeometry(0.35, 10, 6), new T.MeshLambertMaterial({ color: 0x9AA1A9 }));
          dome.position.set(0.4, 2.0, 0); g.add(dome);
          g.userData.stripe = stripe;
          groups.buses.add(g); busMesh[b.id] = g;
        }
        if (!labelEls.bus[b.id]) { var l = document.createElement('div'); l.className = 'label-3d bus-num'; labels.appendChild(l); labelEls.bus[b.id] = l; }
        g.userData.stripe.material.color.set(b.color);
        var x = b.x * K + (b.dx || 0) * K / PX, z = b.y * K + (b.dy || 0) * K / PX;
        var last = lastBus[b.id];
        if (last && Math.hypot(x - last.x, z - last.z) > 0.05) g.rotation.y = -Math.atan2(z - last.z, x - last.x);
        lastBus[b.id] = { x: x, z: z };
        g.position.set(x, 0, z);
        g.visible = true;
        labelEls.bus[b.id].textContent = b.id+'호차'+(b.regional?' 광역':b.express?' 직행':'');
        g.scale.x=b.regional?1.4:b.express?1.2:1;
        if(b.riders>0){var count=document.createElement('span');count.className='rider-count';count.dataset.riders=b.riders;count.textContent=b.riders+'명';labelEls.bus[b.id].appendChild(count);}
        labelEls.bus[b.id].setAttribute('aria-label',b.id+'호차'+(b.regional?' 광역 · 정원 24명':b.express?' 직행 · 정원 18명':'')+' · 탑승 '+(b.riders||0)+'명');
        labelEls.bus[b.id].style.background = b.color;
      });
      Object.keys(busMesh).forEach(function (id) { if (!seen[id]) { busMesh[id].visible = false; if (labelEls.bus[id]) {labelEls.bus[id].remove();delete labelEls.bus[id];} } else if (labelEls.bus[id]) labelEls.bus[id].style.display = ''; });
      dirty = true;
    }

    var personGeo = null;
    function setWaiting(map) {
      waitingNow = map || {};
      clear(groups.people);
      personGeo = personGeo || new T.CylinderGeometry(0.28, 0.28, 1.0, 8);
      Object.keys(labelEls.wait).forEach(function (id) { labelEls.wait[id].remove(); });
      labelEls.wait = {};
      Object.keys(waitingNow).forEach(function (id) {
        var n = waitingNow[id];
        if (!n || !nodes[id]) return;
        var p = wp(id);
        for (var i = 0; i < Math.min(n, 12); i++) {
          var m = new T.Mesh(personGeo, mat(C.people));
          m.position.set(p.x + 2.4 + (i % 4) * 0.75, 0.5, p.z - 2.2 + Math.floor(i / 4) * 0.75);
          m.castShadow = true;
          groups.people.add(m);
        }
        var l = document.createElement('div'); l.className = 'label-3d wait-num'; l.textContent = n; labels.appendChild(l); labelEls.wait[id] = l;
      });
      dirty = true;
    }

    function flash(id) {
      if (reduced || !stops[id]) return;
      var s = stops[id], t0 = root.performance.now();
      s.flashT0 = t0; dirty = true;
    }

    function toScreen(x, y, z) {
      var v = new T.Vector3(x, y, z).project(camera);
      var r = container.getBoundingClientRect();
      return { left: (v.x + 1) / 2 * r.width, top: (1 - v.y) / 2 * r.height };
    }
    function project(x, y) { return toScreen(x * K, 2, y * K); }
    function laneOffset(a, b, num) { var o = laneWorld(a, b, num); return { dx: o.x * PX / K, dy: o.z * PX / K }; }

    function fit() {
      if (!bounds) return;
      var r = container.getBoundingClientRect(), wdt = Math.max(1, r.width), hgt = Math.max(1, r.height);
      renderer.setSize(wdt, hgt, false);
      renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
      var cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2;
      // No sideways rotation: retain the map orientation while showing building height.
      camera.up.set(0, 1, 0);
      var elevation = CAMERA_ELEVATION * Math.PI / 180;
      var dir = new T.Vector3(0, Math.sin(elevation), Math.cos(elevation));
      camera.position.set(cx + dir.x * 300, dir.y * 300, cz + dir.z * 300);
      camera.lookAt(cx, 0, cz);
      camera.updateMatrixWorld();
      var inv = camera.matrixWorldInverse, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      [bounds.minX, bounds.maxX].forEach(function (x) { [bounds.minZ, bounds.maxZ].forEach(function (z) { [0, nodes.N?21:8].forEach(function (y) {
        var v = new T.Vector3(x, y, z).applyMatrix4(inv);
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      }); }); });
      var vw = maxX - minX, vh = maxY - minY, aspect = wdt / hgt, mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
      if (vw / vh > aspect) vh = vw / aspect; else vw = vh * aspect;
      camera.left = mx - vw / 2; camera.right = mx + vw / 2; camera.top = my + vh / 2; camera.bottom = my - vh / 2;
      camera.updateProjectionMatrix();
      dirty = true;
    }

    function placeLabels() {
      Object.keys(labelEls.stop).forEach(function (id) {
        if (!nodes[id]) return;
        var p = wp(id), s = toScreen(p.x, 0, p.z + (stops[id] ? stops[id].front : 1.5) + 0.3);
        var l = labelEls.stop[id]; l.style.left = s.left + 'px'; l.style.top = s.top + 'px';
      });
      Object.keys(labelEls.wait).forEach(function (id) {
        var p = wp(id), s = toScreen(p.x + 3.5, 2.2, p.z - 2.5);
        var l = labelEls.wait[id]; l.style.left = s.left + 'px'; l.style.top = s.top + 'px';
      });
      Object.keys(labelEls.bus).forEach(function (id) {
        var g = busMesh[id]; if (!g || !g.visible) return;
        var s = toScreen(g.position.x, 3.2, g.position.z);
        var l = labelEls.bus[id]; l.style.left = s.left + 'px'; l.style.top = s.top + 'px';
      });
    }

    function frame() {
      var now = root.performance.now();
      if (rising) {
        var f = Math.min(1, (now - rising.t0) / 800);
        if (zoneGroups[rising.id]) zoneGroups[rising.id].scale.y = 0.02 + 0.98 * (1 - Math.pow(1 - f, 3));
        dirty = true;
        if (f >= 1) rising = null;
      }
      Object.keys(stops).forEach(function (id) {
        var s = stops[id];
        if (s.flashT0 == null) return;
        var f = (now - s.flashT0) / 1200;
        s.ring.visible = f < 1; s.ring.material.opacity = 0.6 * (1 - f);
        if (f >= 1) s.flashT0 = null;
        dirty = true;
      });
      if (dirty && container.offsetParent !== null) {
        renderer.render(scene, camera);
        placeLabels();
        dirty = false;
      }
    }
    (function loop() { frame(); root.requestAnimationFrame(loop); })();
    root.setInterval(frame, 100);

    if (root.ResizeObserver) new root.ResizeObserver(function () { fit(); frame(); }).observe(container);

    root.PB.RoutePointer.attach(renderer.domElement,function(x,y){return root.PB.RoutePointer.pick(renderer.domElement,project,nodes,currentRoutes,x,y,function(a,b,num){var o=laneWorld(a,b,num);return{x:o.x/K,y:o.z/K};});},opts);

    return {
      kind: '3d', ok: true, setScene: setScene, setRoutes: setRoutes, setSelectable: setSelectable, setSelected: setSelected,
      setBuses: setBuses, setWaiting: setWaiting, setCrowd: setCrowd, flash: flash, project: project, laneOffset: laneOffset,
      setReducedMotion: function (v) { reduced = !!v; },
      show: function (v) { container.hidden = !v; if (v) { fit(); dirty = true; frame(); } },
      dispose: function () { renderer.dispose(); },
      __nodeIds: function () { return Object.keys(zoneGroups); },
      __pickForTest: function (id) { if (opts.onNode) opts.onNode(id); }
    };
  }

  root.PB = root.PB || {};
  root.PB.View3D = { create: create, supported: supported };
})(window);
