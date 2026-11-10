// 나의 조사 보고서: 이 화면이 그대로 인쇄된다. 이름·학번은 이 기기 저장에만 남는다.
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {E,D,S,esc,btn,send,actions,group,caseCard,written}=UI;
 const R=D.report;

 function today(){
  const d=new Date();
  const p=n=>String(n).padStart(2,'0');
  return {
   text:`${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`,
   file:`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`
  };
 }
 function reportHead(){
  const rp=S.state.reporter;
  const field=(label,key)=>`<label>${label} <input data-reporter="${key}" maxlength="40" autocomplete="off" value="${esc(rp[key])}"></label>`;
  return `<div class="report-head"><p class="report-game">${esc(R.game)} · ${esc(R.title)}</p><p class="report-date">작성일 ${today().text}</p>`
   +`<div class="reporter">${field('이름','name')}${field('학번','number')}</div>`
   +`<p class="hint no-print">${esc(R.privacy)}</p></div>`;
 }
 function endCard(){
  const e=D.ending;
  return `<section class="case-card" id="report-end" tabindex="-1"><h2 class="case-title">${esc(e.title)}</h2>`
   +group('마지막 서술',written(D.reflect.finalPrompt,S.state.finalNote))
   +`<div class="card-links">${btn('서술 고치기','revisit',`data-scene="${E.END}"`)}</div></section>`;
 }
 function reportPage(){
  return `<article class="report" aria-label="${esc(R.title)}">`
   +reportHead()
   +`<div class="report-actions no-print">${btn('PDF로 저장하기','print','','primary')}<p class="hint">${esc(R.printHint)}</p></div>`
   +E.CASES.map(k=>caseCard(k,'report')).join('')
   +endCard()
   +'</article>';
 }

 // PDF 기본 파일 이름이 되도록 인쇄하는 동안만 제목을 바꾼다.
 const baseTitle=document.title;
 function reportTitle(){
  const name=S.state.reporter.name.trim().replace(/[\\/:*?"<>|\s]+/g,'_');
  return ['투명성_보고서',name,today().file].filter(Boolean).join('_');
 }
 window.addEventListener('beforeprint',()=>{
  if(E.stepOf(S.state.scene)==='report')document.title=reportTitle();
 });
 window.addEventListener('afterprint',()=>{
  document.title=baseTitle;
 });

 actions.print=()=>{
  document.title=reportTitle();
  window.print();
 };
 // 서술을 고친 뒤 보고서로: 고친 사건 카드로 바로 간다.
 actions['to-report']=b=>{
  send({type:'revisit',scene:E.REPORT});
  const card=document.getElementById('report-'+b.dataset.case);
  if(card){
   card.scrollIntoView({block:'start'});
   card.focus({preventScroll:true});
  }
 };

 UI.reportPage=reportPage;
})();
