/* School grounds: quiet soil, running lanes and paved circulation. */
(function () {
  'use strict';
  var tileSize = 48, images = {}, ground;
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
    ground=document.createElement('canvas'); ground.width=22*48; ground.height=44*48;
    var c=ground.getContext('2d');
    // Broad paved apron joins the school entrance, shop, gate and festival stalls.
    c.fillStyle='#c9ccc3'; c.fillRect(48,11*48,21*48,33*48);
    c.strokeStyle='#b9beb5'; c.lineWidth=1;
    for(var y=11;y<=44;y+=0.5){c.beginPath();c.moveTo(48,y*48);c.lineTo(22*48,y*48);c.stroke();}
    for(var x=1;x<=22;x++){c.beginPath();c.moveTo(x*48,11*48);c.lineTo(x*48,44*48);c.stroke();}
    // Small drain at the building foot, with an uninterrupted entrance gap.
    c.fillStyle='#8f9b94'; c.fillRect(48,11.04*48,9*48,0.11*48);c.fillRect(12*48,11.04*48,10*48,0.11*48);
    // Two-tile approach apron separates the festival plaza from the track.
    c.fillStyle='#ddd1b8';rounded(c,1.15,22,20.7,21.5,0.35);c.fill();
    c.fillStyle='#b8887c';rounded(c,1.6,22.5,19.8,20.5,6);c.fill();
    c.globalAlpha=0.38;c.fillStyle=texture(c,'track','#b8887c');c.fill();c.globalAlpha=1;
    c.fillStyle='#d9c7a5';rounded(c,3.1,24,16.8,17.5,4.5);c.fill();
    c.globalAlpha=0.3;c.fillStyle=texture(c,'soil','#d9c7a5');c.fill();c.globalAlpha=1;
    c.strokeStyle='#f2e9d6';c.lineWidth=1.5;
    [0.12,0.47,0.82,1.17,1.5].forEach(function(i){rounded(c,1.6+i,22.5+i,19.8-2*i,20.5-2*i,6-i);c.stroke();});
    // East-west pitch: goals face each other across the long horizontal axis.
    c.strokeStyle='#faf4e6';c.lineWidth=2;
    c.strokeRect(4*48,28*48,15*48,9*48);
    c.beginPath();c.moveTo(11.5*48,28*48);c.lineTo(11.5*48,37*48);c.stroke();
    c.beginPath();c.arc(11.5*48,32.5*48,1.65*48,0,Math.PI*2);c.stroke();
    c.strokeRect(4*48,30*48,2.2*48,5*48);c.strokeRect(16.8*48,30*48,2.2*48,5*48);
    c.strokeRect(4*48,31.2*48,0.8*48,2.6*48);c.strokeRect(18.2*48,31.2*48,0.8*48,2.6*48);
    c.fillStyle='#faf4e6';c.beginPath();c.arc(11.5*48,32.5*48,2,0,Math.PI*2);c.fill();
    c.beginPath();c.moveTo(11.5*48,41.5*48);c.lineTo(11.5*48,43*48);c.stroke();
  }  ['soil','track','goal-left','goal-right','store','booth-photo','booth-snack'].forEach(function(name){
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
    ready:function(){return ['soil','track','goal-left','goal-right','store','booth-photo','booth-snack'].every(function(n){return !!images[n];});},
    drawCell:function(ctx,ch,x,y,tile,cam){
      if(x<1||x>=22||y<11||y>=44||'gpy'.indexOf(ch)<0)return false;
      var dx=Math.round(x*tile-cam.x),dy=Math.round(y*tile-cam.y);
      ctx.drawImage(ground,x*tileSize,y*tileSize,48,48,dx,dy,Math.round((x+1)*tile-cam.x)-dx,Math.round((y+1)*tile-cam.y)-dy);return true;
    },
    object:function(ctx,ob,tile,cam){
      var key={yardGoalLeft:'goal-left',yardGoalRight:'goal-right',store:'store',tent1:'booth-photo',tent2:'booth-snack'}[ob.id];
      var a=images[key];if(!a)return false;      var b=a.box,w=ob.w+0.2,h=w*b[3]/b[2];
      if(/^yardGoal/.test(ob.id)){h=3.1;w=h*b[2]/b[3];}
      ctx.save();ctx.imageSmoothingEnabled=true;
      ctx.drawImage(a.image,b[0],b[1],b[2],b[3],(ob.x+(ob.w-w)/2)*tile-cam.x,(ob.y+ob.h-h)*tile-cam.y,w*tile,h*tile);ctx.restore();return true;
    }
  };
}());


