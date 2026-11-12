// 배경음악(2026-11-12, 사용자가 만든 곡 두 개 — assets/bgm/):
//  main   = noche-del-taller.mp3 : 시작 화면·프롤로그·궁금한 것·선택·결과·미리 알리기·생각 정리·마지막·보고서(사건 사이와 마무리)
//  search = searching-motif.mp3  : 사건 안에서 자료를 보고 판단하는 동안(직접 확인·후속 조사)
// 어느 곡인지는 #app의 class(step-… / at-title)로 정한다 — 화면 코드는 건드리지 않는다. 수첩·설정 창을 열어도 곡은 그대로(잠깐 볼 때마다 바뀌지 않게).
// 곡이 바뀌면 약 1초 겹쳐 넘기고(크로스페이드), 반복 재생, 같은 곡이면 다시 시작하지 않는다. 탭을 숨기면 멈추고 돌아오면 그 자리부터.
// 브라우저는 첫 누르기·키 입력 전에는 소리를 막으므로 그때 처음 불러온다(preload none, 첫 화면 로딩을 막지 않음). 소리를 못 읽거나 재생이 막혀도 조용히 넘어간다.
// 켜고 끄기는 설정 창의 ‘배경음악’(기본 켜짐). 값은 진행 저장과 따로 ethicity.transparency.settings.v1 {bgm:true|false} — 저장이 막혀도 이 창에서는 그대로 쓴다.
// 움직임 줄이기와는 상관없다. 인쇄에는 영향이 없다(소리만).
(function(){
 'use strict';
 const KEY='ethicity.transparency.settings.v1',VOL=0.14,FADE=1000,STEP=50,DIR='assets/bgm/';
 const TRACKS={main:'noche-del-taller.mp3',search:'searching-motif.mp3'};
 const SEARCH=['check','follow'];
 // #app class → 곡 이름
 function trackFor(cls){
  const m=/(?:^|\s)step-([a-z]+)/.exec(cls||'');
  return m&&SEARCH.includes(m[1])?'search':'main';
 }
 function readOn(){
  try{const v=JSON.parse(localStorage.getItem(KEY)||'null');return !(v&&v.bgm===false);}catch{return true;}
 }
 function writeOn(v){
  try{let o={};try{o=JSON.parse(localStorage.getItem(KEY)||'null')||{};}catch{o={};}o.bgm=v;localStorage.setItem(KEY,JSON.stringify(o));return true;}catch{return false;}
 }
 let on=readOn(),started=false,cur=null;
 const players={};
 const app=()=>document.getElementById?document.getElementById('app'):null;
 function player(name){
  if(players[name])return players[name];
  let a;
  try{a=new Audio();}catch{return null;}
  a.preload='none';a.loop=true;a.volume=0;a.src=DIR+TRACKS[name];
  try{a.addEventListener('error',()=>{});}catch{}
  players[name]=a;
  return a;
 }
 // 소리 크기를 to까지 FADE 동안 천천히 바꾼다. 끝나면 done.
 function fade(a,to,done){
  clearInterval(a._fade);
  const from=a.volume,t0=Date.now();
  if(typeof setInterval!=='function'){a.volume=to;if(done)done();return;}
  a._fade=setInterval(()=>{
   const k=Math.min(1,(Date.now()-t0)/FADE);
   try{a.volume=Math.max(0,Math.min(1,from+(to-from)*k));}catch{}
   if(k>=1){clearInterval(a._fade);a._fade=null;if(done)done();}
  },STEP);
 }
 function safePlay(a,then){
  try{const p=a.play();if(p&&typeof p.then==='function')p.then(then,()=>{});else then();}catch{}
 }
 // 다시 재생이 늦게 시작돼도 그 사이 꺼졌거나 다른 곡이 됐으면 멈춘다.
 function rise(name){
  const a=players[name];if(!a)return;
  if(!on||document.hidden||cur!==name){a.pause();return;}
  fade(a,VOL);
 }
 function play(name){
  if(!on||!started||document.hidden)return;
  if(cur===name){
   const a=players[name];if(!a)return;
   if(a.paused){a.volume=0;safePlay(a,()=>rise(name));}
   else fade(a,VOL);
   return;
  }
  const old=cur&&players[cur];
  cur=name;
  const a=player(name);
  if(a){a.volume=0;safePlay(a,()=>rise(name));}
  if(old&&!old.paused)fade(old,0,()=>{if(players[cur]!==old)old.pause();});
 }
 function pauseAll(){for(const a of Object.values(players)){clearInterval(a._fade);a._fade=null;try{a.pause();}catch{}}}
 function update(){
  const el=app();
  play(trackFor(el?el.className:''));
 }
 function set(v){
  on=!!v;writeOn(on);
  if(on){started=true;update();}else pauseAll();
 }
 // 첫 누르기·키 입력: 이때부터 소리를 불러온다.
 const first=()=>{if(started)return;started=true;update();};
 try{
  document.addEventListener('pointerdown',first,true);
  document.addEventListener('keydown',first,true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseAll();else update();});
  // 설정 창의 ‘배경음악’ 체크(창은 다시 그려지므로 문서에서 듣는다)
  document.addEventListener('change',e=>{const t=e&&e.target;if(t&&t.id==='opt-bgm')set(!!t.checked);});
 }catch{}
 if(typeof MutationObserver==='function'&&app())new MutationObserver(update).observe(app(),{attributes:true,attributeFilter:['class']});
 window.TransparencyBgm={trackFor,set,update,isOn:()=>on,
  state:()=>({on,started,cur,tracks:Object.fromEntries(Object.entries(players).map(([k,a])=>[k,{src:a.src,paused:a.paused,volume:a.volume,loop:a.loop,preload:a.preload,time:a.currentTime}]))})};
})();
