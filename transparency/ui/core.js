// 화면 코드가 함께 쓰는 바탕: 이름 공간(window.TransparencyUI), 진행 상태, 저장, 행동 보내기, 버튼 만들기.
// 화면 코드는 ui/ 아래 여러 파일로 나뉘어 있고 index.html이 순서대로 읽는다(빌드·모듈 없음, file://로 열어도 된다).
(function(){
 'use strict';
 const E=window.TransparencyEngine;
 const D=window.TransparencyStory;
 const KEY='ethicity.transparency.progress.v1';
 const preview=new URLSearchParams(location.search).get('preview')==='s01';
 const $=s=>document.querySelector(s);
 const ESCAPES={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>ESCAPES[c]);

 // 저장된 진행과 공통 플레이어 별명을 읽는다. 저장소를 못 쓰면 이 창에서만 진행한다.
 let raw=null;
 let saveOK=true;
 let nickname='조사자';
 try{
  raw=localStorage.getItem(KEY);
  const p=JSON.parse(localStorage.getItem('ethicity.player'));
  if(p&&typeof p.nickname==='string'){
   nickname=p.nickname.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,40)||nickname;
  }
 }catch{
  saveOK=false;
 }
 let state=E.restore(raw);
 if(preview){
  state=E.initial();
  state.scene=1;
  state.furthest=1;
 }

 // S = 화면 코드 전체가 함께 보는 값. state만 저장하고 나머지는 화면에만 쓴다.
 const S={
  state,
  saveOK,
  nickname,
  // 화면에만 쓰는 상태(저장하지 않음): 지금 펼친 자료, 눌러 본 사진 구역, 잘못 누른 곳에 대한 짧은 안내.
  view:null,
  regions:new Set(),
  tapHint:'',
  justJudged:null,
  resumed:!preview&&state.scene>0,
  lastFocus:null,
  skipFocusReturn:false,
  // autoKey = 근거 자료를 자동으로 맞춘 판단 문장(한 문장에 한 번만 — 그 뒤 직접 고른 자료는 건드리지 않는다), keepFinding = 마지막 자료를 찾은 직후 자료가 바뀌어도 방금 찾은 내용을 남긴다.
  // revealCue = 마지막 자료를 막 찾아 판단할 말이 처음 나온 순간(화면을 움직이지 않고 한 줄로만 알린다).
  autoKey:null,
  keepFinding:null,
  revealCue:false,
  // opened = 사건 4 기준표에서 연 줄(id), tried = 사건 5(혼자)에서 눌러 봤지만 답이 아닌 곳(글 안내 대신 '아님' 표시만).
  opened:new Set(),
  tried:new Set()
 };

 function saveStatus(){
  if(preview)return 'S01 미리보기 · 진행 저장 안 함';
  if(S.saveOK)return '이 기기에 자동 저장 · '+S.nickname;
  return '저장할 수 없어 이 창에서만 진행해요. 창을 닫으면 기록이 사라져요.';
 }
 function save(){
  if(!preview){
   try{
    localStorage.setItem(KEY,JSON.stringify(S.state));
    S.saveOK=true;
   }catch{
    S.saveOK=false;
   }
  }
  $('#save-status').textContent=saveStatus();
 }
 // 행동 하나를 engine에 보내고, 저장하고, 다시 그린다. 장면이 바뀌면 화면에만 쓰는 상태를 비운다.
 function send(a){
  const before=S.state.scene;
  const k=E.caseKey(before);
  const was=k&&E.stepOf(before)==='check'&&E.checked(S.state,k);
  S.state=E.reduce(S.state,a);
  if(S.state.scene!==before)arrive();
  else if(k&&E.stepOf(before)==='check'&&!was&&E.checked(S.state,k))S.revealCue=true;
  save();
  UI.render(S.state.scene!==before);
 }
 function arrive(){
  S.view=null;
  S.regions=new Set();
  S.opened=new Set();
  S.tried=new Set();
  S.tapHint='';
  S.justJudged=null;
  S.resumed=false;
  S.autoKey=null;
  S.keepFinding=null;
  S.revealCue=false;
 }
 function reset(keepReporter){
  S.state=E.restart(S.state,{keepReporter});
  arrive();
  S.skipFocusReturn=true;
  save();
  UI.render(true);
 }
 function btn(label,act,attrs='',cls=''){
  return `<button ${cls?`class="${cls}"`:''} data-act="${act}" ${attrs}>${label}</button>`;
 }

 const UI=window.TransparencyUI={
  E,D,KEY,preview,S,$,esc,btn,save,send,arrive,reset,
  // views[사건] = 그 사건만의 그림·자료·후속 조사 화면(ui/case-*.js가 채운다).
  views:{},
  // actions[data-act] = 버튼을 눌렀을 때 할 일(각 파일이 자기 몫을 채우고, ui/actions.js가 불러 준다).
  actions:Object.create(null)
 };
})();
