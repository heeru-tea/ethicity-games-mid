const fs=require('fs'),path=require('path'),{createRequire}=require('module');const req=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/asset-ui.cjs'):require,{createCanvas}=req('@napi-rs/canvas');const root=path.resolve(__dirname,'..'),P={ink:'#294b40',cream:'#fff9e7',sage:'#a8bb8c',gold:'#f3cf72',blue:'#72b7c4',red:'#bf7865',green:'#5a8c65',paper:'#f2e7c7'};
const icons=['home','inspect','notebook','key','lock','check','retry','close','pause','play','music','volume','person','robot','clue','help','exit','warning','heart','timer','map','settings','arrow_left','arrow_right'];
function drawIcon(c,id,x,y,s=3){c.save();c.translate(x,y);c.scale(s,s);const R=(x,y,w,h,col=P.ink)=>{c.fillStyle=col;c.fillRect(x,y,w,h)},L=(x1,y1,x2,y2,col=P.ink)=>{let dx=Math.abs(x2-x1),dy=-Math.abs(y2-y1),sx=x1<x2?1:-1,sy=y1<y2?1:-1,er=dx+dy;while(true){R(x1,y1,2,2,col);if(x1===x2&&y1===y2)break;const e=er*2;if(e>=dy){er+=dy;x1+=sx;}if(e<=dx){er+=dx;y1+=sy;}}};
if(id==='home'){L(2,7,8,1);L(8,1,14,7);R(3,7,10,8);R(5,8,6,7,P.cream);R(7,11,2,4);}
if(id==='inspect'){R(3,1,7,2);R(1,3,2,7);R(3,10,7,2);R(10,3,2,7);L(10,10,14,14);}
if(id==='notebook'){R(3,1,11,14);R(5,3,7,10,P.cream);for(let i=0;i<3;i++){R(1,3+i*4,4,1);R(6,4+i*3,5,1);}}
if(id==='key'){R(1,2,6,6);R(3,4,2,2,P.cream);R(6,5,8,2);R(10,7,2,3);R(13,7,2,2);}
if(id==='lock'){R(4,1,7,2);R(3,3,2,4);R(10,3,2,4);R(2,7,11,8);R(7,10,2,3,P.cream);}
if(id==='check'){L(2,8,6,12);L(6,12,13,3);}
if(id==='retry'){R(4,2,7,2);R(2,4,2,8);R(4,12,8,2);R(12,6,2,6);L(9,5,13,1);L(9,5,14,6);}
if(id==='close'){L(3,3,12,12);L(12,3,3,12);}
if(id==='pause'){R(4,2,3,12);R(10,2,3,12);}
if(id==='play'){for(let i=0;i<6;i++)R(4+i,2+i,1,12-2*i);}
if(id==='music'){R(6,2,8,2);R(6,3,2,9);R(12,3,2,8);R(3,10,5,4);R(9,9,5,4);}
if(id==='volume'){R(1,6,4,5);for(let i=0;i<4;i++)R(5+i,5-i,1,7+2*i);R(11,5,2,6);R(14,3,1,10);}
if(id==='person'){R(5,1,6,6);R(3,9,10,6);R(5,9,6,2,P.gold);}
if(id==='robot'){R(2,3,12,10);R(4,5,8,5,P.blue);R(5,6,2,2);R(10,6,2,2);R(7,0,2,3);R(0,6,2,4);R(14,6,2,4);}
if(id==='clue'){R(7,0,2,11);R(7,13,2,2);}
if(id==='help'){R(4,1,7,2);R(10,3,2,4);R(7,6,5,2);R(7,8,2,3);R(7,13,2,2);}
if(id==='exit'){R(2,1,8,2);R(2,1,2,14);R(2,13,8,2);R(7,7,8,2);L(11,4,14,7);L(14,7,11,11);}
if(id==='warning'){for(let i=0;i<7;i++)R(7-i,1+i*2,2+i*2,2);R(7,6,2,5,P.cream);R(7,12,2,2,P.cream);}
if(id==='heart'){R(2,3,4,2);R(9,3,4,2);R(1,5,13,4);R(3,9,9,2);R(5,11,5,2);R(7,13,1,2);}
if(id==='timer'){R(6,0,4,2);R(4,3,8,2);R(2,5,2,7);R(12,5,2,7);R(4,12,8,2);R(7,5,2,5);R(8,9,3,2);}
if(id==='map'){R(1,3,4,12);R(6,1,4,12);R(11,3,4,12);R(2,5,2,7,P.cream);R(7,3,2,7,P.cream);R(12,5,2,7,P.cream);}
if(id==='settings'){R(5,1,6,14);R(1,5,14,6);R(3,3,10,10);R(6,6,4,4,P.cream);}
if(id.startsWith('arrow_')){const left=id.endsWith('left');L(left?10:5,2,left?4:11,8);L(left?4:11,8,left?10:5,14);}
c.restore();}
const atlas=createCanvas(512,192),ctx=atlas.getContext('2d');icons.forEach((id,i)=>drawIcon(ctx,id,(i%8)*64+8,Math.floor(i/8)*64+8,3));fs.writeFileSync(path.join(root,'ui/icons.png'),atlas.toBuffer('image/png'));const iconData=Object.fromEntries(icons.map((id,i)=>[id,{x:i%8*64,y:Math.floor(i/8)*64,w:64,h:64}]));fs.writeFileSync(path.join(root,'ui/icons.json'),JSON.stringify({image:'ui/icons.png',icons:iconData},null,2));
const skins={panel:[P.cream,P.ink,P.paper],speech:[P.cream,P.ink,P.paper],primary:[P.ink,'#183b30','#3d6b56'],hover:['#3c6e56','#183b30','#57836b'],pressed:['#1f4035','#183b30','#315544'],disabled:['#c4cbb9','#8a9983','#d5d9cb'],notice:['#fff0bd','#a68c4e','#ffe49b'],success:['#edf4df','#5a805c','#d5e4c5']};
for(const [name,[fill,edge,shine]]of Object.entries(skins)){const c=createCanvas(64,64),cx=c.getContext('2d');cx.fillStyle=edge;cx.fillRect(8,0,48,64);cx.fillRect(0,8,64,48);cx.fillRect(4,4,56,56);cx.fillStyle=fill;cx.fillRect(10,6,44,52);cx.fillRect(6,10,52,44);cx.fillStyle=shine;cx.fillRect(12,8,40,3);cx.fillRect(8,12,3,40);fs.writeFileSync(path.join(root,'ui/'+name+'.png'),c.toBuffer('image/png'));}
// Five short, non-flashing feedback animations; each row has eight frames.
const effectNames=['clue','correct','retry','key','unlock'],fx=createCanvas(512,320),fc=fx.getContext('2d');fc.imageSmoothingEnabled=false;
for(let r=0;r<5;r++)for(let f=0;f<8;f++){const cx=f*64,cy=r*64,t=f/7;fc.save();fc.translate(cx,cy);const pix=(x,y,w,h,color)=>{fc.fillStyle=color;fc.fillRect(Math.round(x/2)*2,Math.round(y/2)*2,w,h)};const len=3+Math.round(Math.sin(Math.PI*t)*4);for(let k=0;k<6;k++){const a=k*Math.PI/3,d=7+t*20,x=30+Math.cos(a)*d,y=30+Math.sin(a)*d;pix(x,y,4,4,r===2?P.red:P.gold);}const ic=['clue','check','retry','key','lock'][r];drawIcon(fc,ic,16,14,2);if(r===4&&f>3){pix(36,14,6,5,P.cream);pix(36,8-(f-4)*2,4,6,P.ink);}fc.restore();}
fs.writeFileSync(path.join(root,'effects/feedback.png'),fx.toBuffer('image/png'));fs.writeFileSync(path.join(root,'effects/feedback.json'),JSON.stringify({image:'effects/feedback.png',frameWidth:64,frameHeight:64,fps:10,loop:false,effects:Object.fromEntries(effectNames.map((n,i)=>[n,{row:i,frames:8,durationMs:800}]))},null,2));console.log('24 icons, 8 UI skins, 5 feedback animations built');
