// 시작: 사건 4·5 새 그림 찾기, 바깥에서 쓰는 window.TransparencyGame, 첫 저장 안내와 첫 화면(시작 화면 — ui/title.js. 미리보기는 바로 게임 화면).
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {E,D,S,KEY,save,render}=UI;
 const A=D.art;

 // 사건 4·5 새 그림(docs/codex-art-brief-4-5-v2.md): 게임용 사본(.webp) → 원본(.png)을 차례로 불러 보고, 열리는 것이 있으면 그것을 쓴다. 없으면 story의 대신 그림 그대로.
 const artFound={};
 function useArt(key,src,bg){
  A[key]=src;
  if(bg!==undefined)A.backgrounds[bg]=src;
  artFound[key]=src;
  // 새 그림이 나오는 사건 4·5 화면을 보고 있을 때만 다시 그린다(시작 화면에는 이 그림이 없다).
  if(!S.title&&['camp','share'].includes(E.caseKey(S.state.scene)))render(false);
 }
 function tryNext(key,bg,list){
  if(!list.length)return;
  const src=list[0];
  const img=new Image();
  img.onload=()=>useArt(key,src,bg);
  img.onerror=()=>tryNext(key,bg,list.slice(1));
  img.src=src;
 }
 // alt = 지시서 그림이 없을 때 먼저 써 볼 다른 새 그림(예: 루루 휴대폰 → 이미 있는 루루 외출복).
 for(const [key,{base,alt,bg}] of Object.entries(A.newArt||{})){
  tryNext(key,bg,[base,alt].filter(Boolean).flatMap(b=>['webp','png'].map(x=>b+'.'+x)));
 }

 window.TransparencyGame={
  getState:()=>JSON.parse(JSON.stringify(S.state)),
  storageKey:KEY,
  art:()=>({...artFound})
 };
 save();
 render(false);
})();
