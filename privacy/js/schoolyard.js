/* School grounds: quiet soil, running lanes and paved circulation.
 * 2026-10-19 형태 수정: 트랙을 가로로 긴 경기장 모양(19.8×14.6칸)으로, 골대는 위에서 본 모양으로 골라인 바로 바깥에 직접 그린다.
 * LAYOUT(칸 단위 [x, y, w, h])은 world.js 골대 충돌 칸(3·19, 24~26)과 맞춘다 — 프로브 'yard'가 확인. */
(function () {
  'use strict';
  var tileSize = 48, images = {}, ground;
  var BOTTOM = 33; // 운동장 아래 담장 줄(world.js와 같음)
  var LAYOUT = {
    // 2026-10-19: 매점·현관→교문 길(16~17줄) 바로 밑에서 시작, 축제 부스(18줄)가 트랙 윗부분에 올라선다
    apron: [1.15, 17.6, 20.7, 15.2],
    track: [1.6, 18, 19.8, 14.6], trackR: 4.5,
    infield: [3.1, 19.5, 16.8, 11.6], infieldR: 3, // 경기장 네 모서리가 안쪽 곡선 밖(트랙)으로 나가지 않는 반지름
    pitch: [4, 20.5, 15, 9.6],
    goalMouth: 2.2, goalDepth: 0.65
  };
  function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.roundRect(x*48,y*48,w*48,h*48,r*48);
  }
  function texture(ctx, name, fallback) {
    if (!images[name]) return fallback;
    var c=document.createElement('canvas'); c.width=c.height=384;
    c.getContext('2d').drawImage(images[name].image,0,0,384,384);
    return ctx.createPattern(c,'repeat');
  }
  function build() {
    ground=document.createElement('canvas'); ground.width=22*48; ground.height=BOTTOM*48;
    var c=ground.getContext('2d'), L=LAYOUT, t=L.track, f=L.infield, p=L.pitch;
    // Broad paved apron joins the school entrance, shop, gate and festival stalls.
    c.fillStyle='#c9ccc3'; c.fillRect(48,11*48,21*48,(BOTTOM-11)*48);
    c.strokeStyle='#b9beb5'; c.lineWidth=1;
    for(var y=11;y<=BOTTOM;y+=0.5){c.beginPath();c.moveTo(48,y*48);c.lineTo(22*48,y*48);c.stroke();}
    for(var x=1;x<=22;x++){c.beginPath();c.moveTo(x*48,11*48);c.lineTo(x*48,BOTTOM*48);c.stroke();}
    // Small drain at the building foot, with an uninterrupted entrance gap.
    c.fillStyle='#8f9b94'; c.fillRect(48,11.04*48,9*48,0.11*48);c.fillRect(12*48,11.04*48,10*48,0.11*48);
    // Approach apron, then a stadium-shaped track that is wider than it is tall (like a real school track).
    c.fillStyle='#ddd1b8';rounded(c,L.apron[0],L.apron[1],L.apron[2],L.apron[3],0.35);c.fill();
    c.fillStyle='#b8887c';rounded(c,t[0],t[1],t[2],t[3],L.trackR);c.fill();
    c.globalAlpha=0.38;c.fillStyle=texture(c,'track','#b8887c');c.fill();c.globalAlpha=1;
    c.fillStyle='#d9c7a5';rounded(c,f[0],f[1],f[2],f[3],L.infieldR);c.fill();
    c.globalAlpha=0.3;c.fillStyle=texture(c,'soil','#d9c7a5');c.fill();c.globalAlpha=1;
    c.strokeStyle='#f2e9d6';c.lineWidth=1.5;
    [0.12,0.47,0.82,1.17,1.5].forEach(function(i){rounded(c,t[0]+i,t[1]+i,t[2]-2*i,t[3]-2*i,L.trackR-i);c.stroke();});
    // East-west pitch: goals face each other across the long horizontal axis.
    var cx=p[0]+p[2]/2, cy=p[1]+p[3]/2;
    c.strokeStyle='#faf4e6';c.lineWidth=2;
    c.strokeRect(p[0]*48,p[1]*48,p[2]*48,p[3]*48);
    c.beginPath();c.moveTo(cx*48,p[1]*48);c.lineTo(cx*48,(p[1]+p[3])*48);c.stroke();
    c.beginPath();c.arc(cx*48,cy*48,1.5*48,0,Math.PI*2);c.stroke();
    c.strokeRect(p[0]*48,(cy-2.5)*48,2.2*48,5*48);c.strokeRect((p[0]+p[2]-2.2)*48,(cy-2.5)*48,2.2*48,5*48);
    c.strokeRect(p[0]*48,(cy-1.3)*48,0.8*48,2.6*48);c.strokeRect((p[0]+p[2]-0.8)*48,(cy-1.3)*48,0.8*48,2.6*48);
    c.fillStyle='#faf4e6';c.beginPath();c.arc(cx*48,cy*48,2,0,Math.PI*2);c.fill();
    // Start line across the lanes at the bottom straight.
    c.beginPath();c.moveTo(cx*48,(f[1]+f[3])*48);c.lineTo(cx*48,(t[1]+t[3])*48);c.stroke();
  }
  // 위에서 내려다본 골대: 골라인에 붙은 흰 기둥 틀 + 뒤쪽 그물. (left면 골라인 왼쪽 바깥, 아니면 오른쪽 바깥)
  function drawGoal(ctx, left, tile, cam) {
    var p=LAYOUT.pitch, cy=p[1]+p[3]/2, m=LAYOUT.goalMouth, d=LAYOUT.goalDepth;
    var line=left?p[0]:p[0]+p[2], x0=left?line-d:line, y0=cy-m/2;
    var X=function(v){return v*tile-cam.x;}, Y=function(v){return v*tile-cam.y;};
    ctx.save();
    ctx.fillStyle='rgba(255,255,255,.22)';ctx.fillRect(X(x0),Y(y0),d*tile,m*tile);
    ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=Math.max(1,tile/40);
    for(var g=0.18;g<m;g+=0.18){ctx.beginPath();ctx.moveTo(X(x0),Y(y0+g));ctx.lineTo(X(x0+d),Y(y0+g));ctx.stroke();}
    for(var h=0.16;h<d;h+=0.16){ctx.beginPath();ctx.moveTo(X(x0+h),Y(y0));ctx.lineTo(X(x0+h),Y(y0+m));ctx.stroke();}
    ctx.strokeStyle='#ffffff';ctx.lineWidth=Math.max(2,tile/9);ctx.lineCap='round';
    var back=left?x0:x0+d;
    ctx.beginPath();ctx.moveTo(X(line),Y(y0));ctx.lineTo(X(back),Y(y0));ctx.lineTo(X(back),Y(y0+m));ctx.lineTo(X(line),Y(y0+m));ctx.stroke();
    ctx.fillStyle='#ffffff';[y0,y0+m].forEach(function(py){ctx.beginPath();ctx.arc(X(line),Y(py),Math.max(2,tile/10),0,Math.PI*2);ctx.fill();});
    ctx.restore();
  }
  var NAMES=['soil','track','store','booth-photo','booth-snack'];
  NAMES.forEach(function(name){
    var im=new Image();im.onload=function(){
      var box=[0,0,im.naturalWidth,im.naturalHeight];
      if(name!=='soil' && name!=='track'){try{
        var c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
        var g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);
        var p=g.getImageData(0,0,c.width,c.height).data,l=c.width,t=c.height,r=-1,b=-1;
        for(var y=0;y<c.height;y++)for(var x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3]>=16){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
        if(r>=l)box=[l,t,r-l+1,b-t+1];
      }catch(_) {}}
      images[name]={image:im,box:box};build();
    };window.PrivacyImg.load(im,'assets/schoolyard/'+name+'.png'); // webp 우선(없으면 png)
  });
  build();
  window.PrivacySchoolyard={
    layout:LAYOUT,
    ready:function(){return NAMES.every(function(n){return !!images[n];});},
    drawCell:function(ctx,ch,x,y,tile,cam){
      if(x<1||x>=22||y<11||y>=BOTTOM||'gpy'.indexOf(ch)<0)return false;
      var dx=Math.round(x*tile-cam.x),dy=Math.round(y*tile-cam.y);
      ctx.drawImage(ground,x*tileSize,y*tileSize,48,48,dx,dy,Math.round((x+1)*tile-cam.x)-dx,Math.round((y+1)*tile-cam.y)-dy);return true;
    },
    object:function(ctx,ob,tile,cam){
      if(/^yardGoal/.test(ob.id)){drawGoal(ctx,ob.id==='yardGoalLeft',tile,cam);return true;}
      var key={store:'store',tent1:'booth-photo',tent2:'booth-snack'}[ob.id];
      var a=images[key];if(!a)return false;var b=a.box,w=ob.w+0.2,h=w*b[3]/b[2];
      ctx.save();ctx.imageSmoothingEnabled=true;
      ctx.drawImage(a.image,b[0],b[1],b[2],b[3],(ob.x+(ob.w-w)/2)*tile-cam.x,(ob.y+ob.h-h)*tile-cam.y,w*tile,h*tile);ctx.restore();return true;
    }
  };
}());
