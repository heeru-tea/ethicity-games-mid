// 서술 칸(생각 정리·마지막 서술)과 보고서 이름·학번 칸: 입력칸 그리기와 입력할 때마다 자동 저장.
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {E,D,S,esc,save}=UI;
 const R=D.report;
 const MAX=E.TEXT_MAX;
 const filled=t=>typeof t==='string'&&t.trim()!=='';
 const frameHtml=t=>esc(t).replace(/___/g,'<span class="blank" aria-hidden="true"></span><span class="sr">빈칸</span>');
 const maxText=t=>t.replace('{max}',MAX);
 // 상한 안내: 넘는 글이 빠졌으면 over, 꽉 찼으면 full, 아니면 없음.
 const limitNote=(value,over)=>over?maxText(D.reflect.over):value.length>=MAX?maxText(D.reflect.full):'';

 // 서술 칸: 문장 틀은 입력칸 위의 실제 글. 앞 줄바꿈은 HTML이 하나 먹으므로 하나 붙인다.
 // 상한(engine TEXT_MAX)은 입력칸 maxlength·글자 수 표시·저장이 모두 같은 단위(UTF-16)다. 이모지는 두 자 넘게 셀 수 있다.
 function writeBox(id,frame,value,data,rows=4){
  return `<div class="write-q"><label class="frame-text" for="${id}">${frameHtml(frame)}</label>`
   +`<textarea id="${id}" ${data} rows="${rows}" maxlength="${MAX}" aria-describedby="${id}-count">\n${esc(value)}</textarea>`
   +`<p class="count" id="${id}-count"><span class="count-n">${value.length}자</span> · ${esc(D.reflect.recommend)} · ${esc(maxText(D.reflect.limit))}</p>`
   +`<p class="limit-note" role="status">${esc(limitNote(value,false))}</p>`
   +`<p class="empty-note"${filled(value)?' hidden':''}>${esc(D.reflect.empty)}</p></div>`;
 }
 // 수첩·보고서에 적힌 서술(읽기만). 비웠으면 ‘작성 안 함’.
 function written(frame,value){
  return `<p class="frame-text">${frameHtml(frame)}</p><p class="answer${filled(value)?'':' not-written'}">${filled(value)?esc(value):esc(R.notWritten)}</p>`;
 }

 // 넘는 글이 방금 빠진 입력칸(브라우저가 잘라 넣었거나 아래에서 잘랐다). 다음 입력에서 한 번 쓰고 지운다.
 const overflowed=new WeakSet();
 // 서술·이름 칸: 입력할 때마다 자동 저장한다. 다시 그리지 않아 입력 중인 글(한글 조합)이 끊기지 않는다.
 function sync(t,composing,inputType){
  // 지우거나 되돌린 입력이면 앞서 남은 ‘빠졌다’ 표시는 지운다.
  if(/^(delete|history)/.test(inputType||''))overflowed.delete(t);
  const isText=!!t.dataset.reflect||'note' in t.dataset;
  // 상한을 넘은 글이 들어와 있으면(maxlength가 못 막은 붙여넣기·입력기) 저장되는 만큼만 남긴다: 화면 = 저장 = 다시 열었을 때.
  // 한글 조합 중에는 입력칸을 건드리지 않고(조합이 깨진다) 조합이 끝났을 때 맞춘다.
  if(isText&&!composing){
   const clipped=E.clipText(t.value);
   if(clipped!==t.value){
    t.value=clipped;
    overflowed.add(t);
   }
  }
  if(t.dataset.reflect)S.state=E.reduce(S.state,{type:'reflect',key:E.caseKey(S.state.scene),q:t.dataset.reflect,text:t.value});
  else if('note' in t.dataset)S.state=E.reduce(S.state,{type:'note',text:t.value});
  else if(t.dataset.reporter)S.state=E.reduce(S.state,{type:'reporter',field:t.dataset.reporter,text:t.value});
  else return;
  save();
  const box=t.closest('.write-q');
  if(box){
   box.querySelector('.count-n').textContent=t.value.length+'자';
   box.querySelector('.empty-note').hidden=filled(t.value);
   const note=box.querySelector('.limit-note');
   // ‘빠졌다’ 표시는 입력칸이 꽉 찼을 때만 믿는다(넘친 글이 있었다면 지금 꽉 차 있다. 끝의 이모지 한 개가 통째로 빠지면 한 자 모자랄 수 있다).
   if(note)note.textContent=limitNote(t.value,overflowed.has(t)&&t.value.length>=MAX-1);
   if(!composing)overflowed.delete(t);
  }
 }
 const field=e=>e.target.matches?.('textarea,input')?e.target:null;
 document.addEventListener('input',e=>{
  const t=field(e);
  if(t)sync(t,!!e.isComposing,e.inputType);
 });
 document.addEventListener('compositionend',e=>{
  const t=field(e);
  if(t)sync(t,false);
 });
 // 넣으려는 글이 상한을 넘으면 브라우저(maxlength)가 넘는 만큼을 말없이 버린다. 그 순간을 잡아 빠졌다고 알린다.
 document.addEventListener('beforeinput',e=>{
  const t=field(e);
  if(!t||!(t.dataset.reflect||'note' in t.dataset)||e.isComposing||typeof e.data!=='string')return;
  const after=t.value.length-(t.selectionEnd-t.selectionStart)+e.data.length;
  if(after<=MAX)return;
  overflowed.add(t);
  const note=t.closest('.write-q')?.querySelector('.limit-note');
  if(note)note.textContent=limitNote(t.value,true);
 });

 Object.assign(UI,{writeBox,written});
})();
