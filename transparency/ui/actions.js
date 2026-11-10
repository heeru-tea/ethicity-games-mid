// 버튼 누르기: data-act가 붙은 버튼을 누르면 actions[data-act]를 부른다.
// 여기에는 장면을 오가는 공통 버튼만 있고, 나머지는 그 화면을 그리는 파일이 actions에 채워 둔다
// (자료 고르기 → evidence.js, 판단 → judge.js·follow.js, 사건별 누르기 → case-*.js, 수첩·보고서·창 → notebook.js·report.js·modal.js).
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {E,S,send,actions}=UI;

 actions.next=()=>send({type:'next'});
 actions.back=()=>send({type:'revisit',scene:S.state.scene-1});
 actions.choose=b=>send({type:'choose',id:b.dataset.id});
 // 결과 화면에서 선택 화면으로
 actions.rechoose=()=>send({type:'revisit',scene:S.state.scene-1});
 // 사건 4 구청에 묻기: 이미 물어본 질문을 다시 눌러도 그 대답을 보여 준다.
 actions.ask=b=>{
  S.view=b.dataset.id;
  send({type:'ask',id:b.dataset.id});
 };

 document.addEventListener('click',e=>{
  const b=e.target.closest('button[data-act]');
  if(!b||b.disabled)return;
  S.revealCue=false;
  const run=actions[b.dataset.act];
  if(run)run(b,E.caseKey(S.state.scene));
 });
})();
