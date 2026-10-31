/* 학교 마당: 현관 앞 포장 마당 + 매점 + 아래쪽 축제 부스 천막 줄(흙바닥).
 * 2026-10-31 플레이테스트: 쓰지 않던 운동장(트랙·골대)을 걷어 내고 x1~13·y11~21 작은 마당으로(world.js와 같은 크기).
 * LAYOUT(칸 단위 [x, y, w, h]) — booth = 천막 줄 흙바닥. */
(function () {
  'use strict';
  var tileSize = 48, images = {}, ground;
  var LEFT = 1, RIGHT = 14, TOP = 11, BOTTOM = 22; // 마당 = [LEFT, RIGHT) × [TOP, BOTTOM) (담장 안쪽)
  var LAYOUT = { booth: [1.25, 18.6, 12.5, 3.15], boothR: 0.45 };
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
    ground=document.createElement('canvas'); ground.width=RIGHT*48; ground.height=BOTTOM*48;
    var c=ground.getContext('2d'), b=LAYOUT.booth;
    // 현관·매점·교문을 잇는 포장 마당(보도블록 줄눈)
    c.fillStyle='#c9ccc3'; c.fillRect(LEFT*48,TOP*48,(RIGHT-LEFT)*48,(BOTTOM-TOP)*48);
    c.strokeStyle='#b9beb5'; c.lineWidth=1;
    for(var y=TOP;y<=BOTTOM;y+=0.5){c.beginPath();c.moveTo(LEFT*48,y*48);c.lineTo(RIGHT*48,y*48);c.stroke();}
    for(var x=LEFT;x<=RIGHT;x++){c.beginPath();c.moveTo(x*48,TOP*48);c.lineTo(x*48,BOTTOM*48);c.stroke();}
    // 건물 아래 배수로(현관 앞은 끊김)
    c.fillStyle='#8f9b94'; c.fillRect(LEFT*48,(TOP+0.04)*48,9*48,0.11*48); c.fillRect(12*48,(TOP+0.04)*48,(RIGHT-12)*48,0.11*48);
    // 축제 부스 천막 줄: 흙바닥
    c.fillStyle='#d9c7a5'; rounded(c,b[0],b[1],b[2],b[3],LAYOUT.boothR); c.fill();
    c.globalAlpha=0.35; c.fillStyle=texture(c,'soil','#d9c7a5'); c.fill(); c.globalAlpha=1;
  }
  var NAMES=['soil','store','booth-photo','booth-snack'];
  NAMES.forEach(function(name){
    var im=new Image();im.onload=function(){
      var box=[0,0,im.naturalWidth,im.naturalHeight];
      if(name!=='soil'){try{
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
      if(x<LEFT||x>=RIGHT||y<TOP||y>=BOTTOM||'gpy'.indexOf(ch)<0)return false;
      var dx=Math.round(x*tile-cam.x),dy=Math.round(y*tile-cam.y);
      ctx.drawImage(ground,x*tileSize,y*tileSize,48,48,dx,dy,Math.round((x+1)*tile-cam.x)-dx,Math.round((y+1)*tile-cam.y)-dy);return true;
    },
    object:function(ctx,ob,tile,cam){
      var key={store:'store',tent1:'booth-photo',tent2:'booth-snack'}[ob.id];
      var a=images[key];if(!a)return false;var b=a.box,w=ob.w+0.2,h=w*b[3]/b[2];
      ctx.save();ctx.imageSmoothingEnabled=true;
      ctx.drawImage(a.image,b[0],b[1],b[2],b[3],(ob.x+(ob.w-w)/2)*tile-cam.x,(ob.y+ob.h-h)*tile-cam.y,w*tile,h*tile);ctx.restore();return true;
    }
  };
}());
