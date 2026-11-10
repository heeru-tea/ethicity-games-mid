// 서술 칸(생각 정리·마지막 서술)과 보고서 이름·학번 칸: 입력칸 그리기와 입력할 때마다 자동 저장.
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {E,D,S,esc,save}=UI;
 const R=D.report;
 const filled=t=>typeof t==='string'&&t.trim()!=='';
 const frameHtml=t=>esc(t).replace(/___/g,'<span class="blank" aria-hidden="true"></span><span class="sr">빈칸</span>');

 // 서술 칸: 문장 틀은 입력칸 위의 실제 글. 글자 수는 보여 주기만 하고 막지 않는다. 앞 줄바꿈은 HTML이 하나 먹으므로 하나 붙인다.
 function writeBox(id,frame,value,data,rows=4){
  return `<div class="write-q"><label class="frame-text" for="${id}">${frameHtml(frame)}</label>`
   +`<textarea id="${id}" ${data} rows="${rows}">\n${esc(value)}</textarea>`
   +`<p class="count"><span class="count-n">${[...value].length}자</span> · ${esc(D.reflect.recommend)}</p>`
   +`<p class="empty-note"${filled(value)?' hidden':''}>${esc(D.reflect.empty)}</p></div>`;
 }
 // 수첩·보고서에 적힌 서술(읽기만). 비웠으면 ‘작성 안 함’.
 function written(frame,value){
  return `<p class="frame-text">${frameHtml(frame)}</p><p class="answer${filled(value)?'':' not-written'}">${filled(value)?esc(value):esc(R.notWritten)}</p>`;
 }

 // 서술·이름 칸: 입력할 때마다 자동 저장한다. 다시 그리지 않아 입력 중인 글(한글 조합)이 끊기지 않는다.
 document.addEventListener('input',e=>{
  const t=e.target;
  if(!t.matches?.('textarea,input'))return;
  if(t.dataset.reflect)S.state=E.reduce(S.state,{type:'reflect',key:E.caseKey(S.state.scene),q:t.dataset.reflect,text:t.value});
  else if('note' in t.dataset)S.state=E.reduce(S.state,{type:'note',text:t.value});
  else if(t.dataset.reporter)S.state=E.reduce(S.state,{type:'reporter',field:t.dataset.reporter,text:t.value});
  else return;
  save();
  const box=t.closest('.write-q');
  if(box){
   box.querySelector('.count-n').textContent=[...t.value].length+'자';
   box.querySelector('.empty-note').hidden=filled(t.value);
  }
 });

 Object.assign(UI,{writeBox,written});
})();
