// 후속 조사의 공통 틀: 자료 칸, 사실 한 줄, 판단 카드. 사건마다 다른 부분은 views[사건].follow에 있다.
//  view({f,fs,locked}) = 왼쪽 자료 칸 · fact({f,fs}) = 조사 결과를 적은 사실 문장(수첩·보고서도 쓴다)
//  before({fs}) = 조사하는 동안 오른쪽 위에 보일 것(버튼·진행 수·잘못 누른 안내) · finding(fs) = 조사를 마친 뒤 결과 상자(없으면 사실 문장 한 줄)
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {E,D,S,esc,btn,send,actions,more,stampButtons,verdictBox,judgeCard}=UI;

 // 후속 조사
 function followView(k){
  const f=D.cases[k].follow;
  const fs=S.state.follows[k];
  const locked=!!fs.judgment&&fs.judgment!=='legacy';
  return UI.views[k].follow.view({f,fs,locked});
 }
 function followFact(k){
  return UI.views[k].follow.fact({f:D.cases[k].follow,fs:S.state.follows[k]});
 }
 // 아직 다 하지 않았을 때 '몇 개 가운데 몇 개' 안내(단위는 사건마다 다르다).
 function followCount(k,unit){
  if(E.followReady(S.state,k))return '';
  const fs=S.state.follows[k];
  const m=E.followMarks[k];
  const done=m.ids.filter(id=>fs.marks[id]).length;
  return `<p class="hint">${done}/${m.ids.length} ${unit}.</p>`;
 }
 function followBody(k){
  const f=D.cases[k].follow;
  const fs=S.state.follows[k];
  const own=UI.views[k].follow;
  let b=own.before({fs});
  if(!E.followReady(S.state,k))return b;
  b+=own.finding?own.finding(fs):`<div class="finding" role="status"><p>${esc(followFact(k))}</p></div>`;
  const j=f.judge;
  const picked=fs.judgment&&fs.judgment!=='legacy'?fs.judgment:null;
  const answer=E.followAnswers[k];
  const src=`<p class="judge-src">볼 자료: <span class="source-name">${esc(f.src)}</span></p>`;
  b+=`<section class="judge judge-card" aria-label="판단할 말">${judgeCard(j.who,j.text,'',src)}${stampButtons('follow-judge',picked,answer)}`;
  if(fs.judgment==='legacy')b+='<p class="hint">이전 저장에서 넘어와 아직 하지 않은 조사야. 지금 해 볼 수 있어.</p>';
  if(picked)b+=`${verdictBox(j,picked,answer)}<p class="unknown"><strong>아직 모르는 점</strong> ${esc(f.unknown)}</p>${more(f.more)}`;
  return b+'</section>';
 }

 actions['follow-judge']=b=>send({type:'follow-judge',stamp:b.dataset.id});
 // 눌러서 여는 줄(점검표 항목·그림을 올린 곳)
 UI.openMark=b=>send({type:'mark',id:b.dataset.id,value:'open'});

 Object.assign(UI,{followView,followFact,followCount,followBody});
})();
