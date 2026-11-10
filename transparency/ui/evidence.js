// 직접 확인의 자료 칸: 자료 고르기, 자료 화면 불러오기, 맞는 곳·틀린 곳을 눌렀을 때의 공통 처리.
// 자료 화면 자체는 사건별 파일(ui/case-*.js)의 views[사건].evidence[자료 id]에 있다.
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {E,S,$,esc,send,actions}=UI;

 // 자료 화면. 눌러서 차이를 찾게 한다.
 function itemView(k,id){
  const draw=UI.views[k].evidence[id];
  return draw?draw(S.state.evidence.includes(id)):'';
 }
 // 왼쪽 그림 칸이 지금 ‘자료’라는 것을 보이게 한다(판단 도장 ‘자료로 확인돼’가 가리키는 곳).
 function evidenceHead(name){
  return `<p class="evidence-head"><span>자료</span> · ${esc(name)}</p>`;
 }
 // 자료를 아직 고르지 않았을 때 왼쪽 칸: 사건이 따로 정한 그림(자른 사진·검사 결과)이 없으면 사건 무대.
 function defaultView(k){
  const idle=UI.views[k].idle;
  return idle?idle():UI.caseStage(k);
 }

 // 맞는 곳을 눌렀다: 잘못 누른 안내를 지우고 그 자료를 확인한 것으로 한다.
 function found(id){
  S.tapHint='';
  send({type:'check',id});
 }
 // 틀린 곳을 눌렀다: 짧은 안내만 띄운다.
 function miss(hint){
  S.tapHint=hint;
  UI.render();
 }
 // 사건 5(혼자): 글 안내 대신 누른 곳에 '아님' 표시만 남긴다.
 function missQuietly(key){
  S.tried.add(key);
  UI.render();
 }
 const triedTag=key=>S.tried.has(key)?' <span class="tried-tag">아님</span>':'';

 function showEvidence(id){
  S.view=id;
  S.keepFinding=null;
  S.tapHint='';
 }
 // 자료 칸이 화면 위로 밀려나 있으면 다시 보이게 올린다.
 function bringVisualIntoView(){
  const vis=$('.visual');
  if(vis&&vis.getBoundingClientRect().top<0)vis.scrollIntoView({block:'start'});
 }
 actions.source=b=>{
  showEvidence(b.dataset.id);
  UI.render();
  bringVisualIntoView();
 };
 // 누를 곳이 없는 자료(views[사건].plain)는 여는 것만으로 확인한 것이 된다.
 actions.item=(b,k)=>{
  showEvidence(b.dataset.id);
  const plain=UI.views[k]?.plain||[];
  if(plain.includes(S.view)&&!S.state.evidence.includes(S.view))send({type:'check',id:S.view});
  else UI.render();
  bringVisualIntoView();
 };

 Object.assign(UI,{itemView,evidenceHead,defaultView,found,miss,missQuietly,triedTag});
})();
