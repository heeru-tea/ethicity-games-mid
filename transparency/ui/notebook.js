// 수첩: 활동 결과를 자동으로 적는다. 열어 보는 것은 선택.
// 사건 카드: 수첩과 보고서가 같이 쓴다. 단계별로 묶어(확인한 자료 → 이 말은 맞을까? → 조치 → 후속 조사 → 내 서술) 한눈에 보이게 한다.
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {E,D,S,esc,btn,send,actions,followFact,noticeSummary,written}=UI;
 const R=D.report;
 const N=D.notice;

 // 판단 한 줄: 내 판단과 정답 여부를 글자로 적는다(색만으로 구분하지 않는다).
 function pickText(p,answer){
  if(!p)return '<span class="v-none">아직 안 함</span>';
  if(p==='legacy')return '<span class="v-none">이전 저장에서 넘어와 아직 안 함</span>';
  const tag=p===answer?'<span class="v-tag v-ok">정답</span>':`<span class="v-tag v-again">다시 볼 것</span> (정리: ${esc(D.stamps[answer])})`;
  return `내 판단: <strong>${esc(D.stamps[p])}</strong> · ${tag}`;
 }
 function verdictLine(num,text,p,answer){
  return `<li class="verdict"><p class="v-say">${num?num+'. ':''}“${esc(text)}”</p><p class="v-pick">${pickText(p,answer)}</p></li>`;
 }
 function verdicts(k){
  const c=D.cases[k];
  const lines=S.state.judgments[k].map((p,i)=>verdictLine(i+1,c.judges[i].text,p,E.answers[k][i]));
  return `<ul class="verdicts">${lines.join('')}</ul>`;
 }
 const optLabel=(k,id)=>D.cases[k].choose.options.find(o=>o.id===id)?.label;
 function chosen(k){
  const cs=S.state.cases[k];
  const legacy=cs.legacyFirst?' (이전 저장에서는 마지막 선택만 남아 있었어)':'';
  return `<div class="pairs"><p class="pair"><span class="k">처음 조치</span> ${esc(optLabel(k,cs.first)||'아직 안 고름')}${legacy}</p>`
   +`<p class="pair"><span class="k">최종 조치</span> ${esc(optLabel(k,cs.final)||'아직 안 고름')}</p></div>`;
 }
 function group(title,html){
  return `<div class="group"><p class="group-label">${esc(title)}</p>${html}</div>`;
 }
 function seenGroup(seen,isReport){
  if(isReport)return `<p>${seen.map(x=>esc(x.name)).join(' · ')||'아직 없음'}</p>`;
  return `<ul class="facts">${seen.map(x=>`<li><strong>${esc(x.name)}</strong> ${esc(x.fact)}</li>`).join('')||'<li>아직 없음</li>'}</ul>`;
 }
 function followGroup(k,isReport){
  const c=D.cases[k];
  const fs=S.state.follows[k];
  let f=E.followReady(S.state,k)?`<p>${esc(followFact(k))}</p>`:'';
  if(fs.judgment)f+=`<ul class="verdicts">${verdictLine(0,c.follow.judge.text,fs.judgment,E.followAnswers[k])}</ul>`;
  else if(isReport)f+='<p class="v-none">아직 안 함</p>';
  if(!isReport&&fs.judgment&&fs.judgment!=='legacy')f+=`<p class="pair"><span class="k">아직 모르는 점</span> ${esc(c.follow.unknown)}</p>`;
  return f;
 }
 // 카드 아래 버튼: 보고서는 ‘서술 고치기’, 수첩은 하지 않은 것 해 보기·다시 고르기
 function cardLinks(k,isReport){
  const cs=S.state.cases[k];
  const fs=S.state.follows[k];
  const go=(label,step)=>btn(label,'revisit',`data-scene="${E.sceneOf(k,step)}"`);
  const links=[];
  if(isReport){
   if(S.state.furthest>=E.sceneOf(k,'reflect'))links.push(go('서술 고치기','reflect'));
   return links;
  }
  if(S.state.judgments[k].includes('legacy'))links.push(go('남은 판단 해 보기','check'));
  if(fs.judgment==='legacy')links.push(go('후속 조사 해 보기','follow'));
  if(S.state.notices[k].posted==='legacy')links.push(go('미리 알리기 해 보기','notice'));
  if(cs.final&&S.state.furthest>=E.sceneOf(k,'choose'))links.push(go('이 사건 다시 골라 보기','choose'));
  return links;
 }
 function caseCard(k,mode){
  const c=D.cases[k];
  const cs=S.state.cases[k];
  const fs=S.state.follows[k];
  const seen=c.checks.filter(x=>S.state.evidence.includes(x.id));
  const isReport=mode==='report';
  const H=isReport?'h2':'h3';
  const r=S.state.reflections[k];
  let h=`<section class="case-card" id="${mode}-${k}" tabindex="-1"><${H} class="case-title"><span class="case-num">사건 ${E.CASES.indexOf(k)+1}</span> ${esc(c.name)}</${H}>`;
  if(!seen.length&&!cs.final)return h+'<p class="hint">아직 시작하지 않았어.</p></section>';
  h+=group('궁금한 것',`<p>${esc(c.question)}</p>`);
  if(c.asks){
   const asked=S.state.asked.length?S.state.asked.map(q=>esc(c.asks.find(a=>a[0]===q)[1])).join(' · '):esc(R.notAsked);
   h+=group(R.asked,`<p>${asked}</p>`);
  }
  h+=group('확인한 자료',seenGroup(seen,isReport));
  h+=group('이 말은 맞을까?',verdicts(k));
  h+=group('조치',chosen(k));
  if(isReport||fs.judgment||E.followReady(S.state,k))h+=group('후속 조사',followGroup(k,isReport));
  if(isReport||S.state.notices[k].posted!==null||S.state.furthest>=E.sceneOf(k,'notice'))h+=group(N.report,noticeSummary(k));
  if(isReport||S.state.furthest>=E.sceneOf(k,'reflect')){
   const F=c.reflect||D.reflect;
   h+=group('내 서술',written(F.q1,r.q1)+written(F.q2,r.q2));
  }
  const links=cardLinks(k,isReport);
  if(links.length)h+=`<div class="card-links">${links.join('')}</div>`;
  return h+'</section>';
 }
 function notebook(){
  const lead='<p class="hint">확인한 것과 고른 것이 자동으로 적혀. 판단 칸은 네가 고른 그대로 남아.</p>';
  UI.open('내 수첩',lead+E.CASES.map(k=>caseCard(k,'note')).join(''));
 }
 // 생각 정리 화면 왼쪽: 이 사건에서 고른 판단 셋과 조치를 작게 보여 준다.
 function reflectSummary(k){
  return `<div class="document reflect-sum"><p class="doc-label">${esc(D.reflect.summary)}</p>${verdicts(k)}${chosen(k)}</div>`;
 }

 actions.notebook=()=>notebook();
 // 수첩·보고서에서 지난 장면으로: 창이 열려 있었으면 닫고, 닫을 때 초점을 창 열기 전 자리로 되돌리지 않는다.
 actions.revisit=b=>{
  S.skipFocusReturn=UI.modal.open;
  UI.close();
  send({type:'revisit',scene:Number(b.dataset.scene)});
 };

 Object.assign(UI,{group,caseCard,reflectSummary});
})();
