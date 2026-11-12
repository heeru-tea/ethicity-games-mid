// 판단 카드: ‘이 말은 맞을까?’ 문장, 도장 셋, 판단 뒤 피드백. 직접 확인(판단 셋)과 후속 조사(판단 하나)가 같이 쓴다.
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {E,D,S,$,esc,btn,send,actions,portrait}=UI;

 // 판단 뒤: 정답 칸에 ‘✓ 정답’, 고른 오답에 ‘내 선택’(점선). 색만으로 구분하지 않는다
 function stampButton(act,id,label,picked,answer){
  const right=!!picked&&id===answer;
  const mine=!!picked&&id===picked&&!right;
  const tag=right?' <span class="stamp-tag">✓ 정답</span>':mine?' <span class="stamp-tag">내 선택</span>':'';
  const attrs=`data-id="${id}" aria-pressed="${picked===id}" ${picked?'disabled':''}`;
  return btn(esc(label)+tag,act,attrs,right?'stamp-right':mine?'stamp-mine':'');
 }
 function stampButtons(act,picked,answer){
  const buttons=Object.entries(D.stamps).map(([id,label])=>stampButton(act,id,label,picked,answer));
  return `<div class="stamps" role="group" aria-label="판단">${buttons.join('')}</div>`;
 }
 // 사건 5(혼자)의 판단 피드백은 '기록과 맞춰 보면: …' 한 줄(sum). 틀리면 같은 줄 끝에 '정리: …'.
 function verdict(j,picked,answer){
  if(j.sum)return picked===answer?j.sum:`${j.sum} 정리: ${D.stamps[answer]}.`;
  return picked===answer?j.right:`${j.wrong} 정리: ${D.stamps[answer]}.`;
 }
 function verdictBox(j,picked,answer){
  const wrong=picked!==answer;
  const again=wrong&&!j.sum?'<p class="again-head">다시 보자</p>':'';
  return `<div class="finding${wrong?' again':''}" role="status">${again}<p>${esc(verdict(j,picked,answer))}</p></div>`;
 }
 // 지금 보여 줄 판단 문장: 방금 판단한 문장이 있으면 그 문장(피드백을 읽을 수 있게), 없으면 아직 안 한 첫 문장.
 const judgeIndex=k=>S.justJudged!==null?S.justJudged:E.currentJudgment(S.state,k);
 // 판단 문장이 바뀌면 왼쪽 자료도 그 문장의 근거로. 문장마다 한 번만 맞추고, 그 뒤 직접 고른 자료는 그대로 둔다
 function autoEvidence(k){
  if(!E.checked(S.state,k))return;
  const idx=judgeIndex(k);
  const key=idx<0?null:k+idx;
  if(!key||key===S.autoKey)return;
  const first=S.autoKey===null;
  S.autoKey=key;
  // 마지막 자료를 막 찾아 판단할 말이 처음 나올 때는 방금 누른 곳의 안내(점원의 말 문장별 피드백 등)를 남긴다. 다음 말로 넘어갈 때 지운다.
  if(!first)S.tapHint='';
  const src=D.cases[k].judges[idx].src;
  if(!src.includes(S.view)){
   if(first&&S.view)S.keepFinding=S.view;
   S.view=src[0];
  }
 }
 function sourceTags(k,src){
  const c=D.cases[k];
  const tags=src.map(id=>{
   const name=c.checks.find(x=>x.id===id).name;
   return btn(esc(name),'source',`data-id="${id}" aria-pressed="${S.view===id}"`,'source-tag');
  });
  return `<p class="judge-src">볼 자료: ${tags.join(' ')}</p>`;
 }
 function judgeCard(who,text,num,extra){
  return `<h2 class="question-label judge-head">이 말은 맞을까?${num?' '+num:''}</h2>`
   +`<blockquote class="judge-say"><p>“${esc(text)}”</p><cite>${portrait(who)}${esc(D.names[who])}</cite></blockquote>${extra}`;
 }
 function judgeBlock(k){
  const c=D.cases[k];
  const js=S.state.judgments[k];
  const idx=judgeIndex(k);
  const after=c.after?`<p>${esc(c.after)}</p>`:'';
  if(idx<0)return `<section class="judge"><p class="question-label">판단 3개를 마쳤어</p>${after}</section>`;
  const j=c.judges[idx];
  const picked=js[idx]&&js[idx]!=='legacy'?js[idx]:null;
  const answer=E.answers[k][idx];
  let h=`<section class="judge judge-card${S.fresh&&picked?' fresh':''}" aria-label="판단할 말 ${idx+1}/3">`
   +judgeCard(j.who,j.text,(idx+1)+'/3',sourceTags(k,j.src))
   +stampButtons('judge',picked,answer);
  if(js[idx]==='legacy')h+='<p class="hint">이전 저장에서 넘어와 아직 하지 않은 판단이야. 지금 해 볼 수 있어.</p>';
  if(picked){
   h+=verdictBox(j,picked,answer);
   h+=E.currentJudgment(S.state,k)>=0?btn('다음 말 보기','judge-next'):after;
  }
  return h+'</section>';
 }

 actions.judge=(b,k)=>{
  S.keepFinding=null;
  S.fresh=true;
  S.justJudged=E.currentJudgment(S.state,k);
  send({type:'judge',stamp:b.dataset.id});
 };
 actions['judge-next']=()=>{
  S.justJudged=null;
  UI.render();
  $('#work .judge [data-act="judge"]')?.focus({preventScroll:true});
 };

 Object.assign(UI,{stampButtons,verdictBox,judgeIndex,autoEvidence,judgeCard,judgeBlock});
})();
