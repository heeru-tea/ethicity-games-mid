// 창(dialog): 열기·닫기·초점 되돌리기와, 창에 담는 글(참고 사례·토론 질문·설정·처음부터 다시 하기).
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {D,S,$,esc,btn,actions,paint,reset}=UI;
 const modal=$('#modal');

 function open(title,html){
  S.lastFocus=document.activeElement;
  $('#modal-title').textContent=title;
  $('#modal-body').innerHTML=html;
  if(!modal.open)modal.showModal();
  paint();
 }
 function close(){
  modal.close();
 }
 // 창 바깥(어두운 곳)을 누르면 닫는다.
 modal.addEventListener('click',e=>{
  if(e.target!==modal)return;
  const r=modal.getBoundingClientRect();
  if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();
 });
 // 닫히면 창을 열기 전 자리로 초점을 되돌린다(장면이 바뀌어 새 제목에 초점을 준 경우는 건너뛴다).
 modal.addEventListener('close',()=>{
  if(S.skipFocusReturn){
   S.skipFocusReturn=false;
   return;
  }
  if(S.lastFocus?.isConnected&&!S.lastFocus.disabled)S.lastFocus.focus({preventScroll:true});
 });

 // [주소, 이름, 무엇을 참고했는지]
 const SOURCES=[
  [
   'https://www.nist.gov/publications/four-principles-explainable-artificial-intelligence',
   'NIST (2021)',
   '설명·이해 가능성·설명 정확성·지식 한계의 개념 참고.'
  ],
  [
   'https://blog.x.com/engineering/en_us/topics/insights/2021/sharing-learnings-about-our-image-cropping-algorithm',
   'Twitter (2021)',
   '자동 자르기와 사용자 통제 문제 참고.'
  ],
  [
   'https://www.vanderbilt.edu/brightspace/2023/08/16/guidance-on-ai-detection-and-why-were-disabling-turnitins-ai-detector/',
   'Vanderbilt (2023)',
   'AI 탐지 기능 비활성화 발표와 신뢰성·설명 부족 우려 참고.'
  ],
  [
   'https://www.ftc.gov/news-events/news/press-releases/2023/12/rite-aid-banned-using-ai-facial-recognition-after-ftc-says-retailer-deployed-technology-without',
   'FTC (2023)',
   'Rite Aid에 대한 규제기관의 주장과 제안된 합의 명령 발표 참고. '
    +'주장을 모두 법적으로 확정된 사실로 표현하지 않으며, 2023년 발표를 현재의 법적·운영 상태로 단정하지 않아요.'
  ]
 ];
 function sources(){
  const items=SOURCES.map(([href,name,note])=>`<li><a target="_blank" rel="noopener" href="${href}">${name}</a>: ${note}</li>`);
  open('참고한 실제 사례',
   '<p>도시·동물·대사·문서·수치·선택 결과는 모두 창작이에요. 실제 기업의 모델이나 내부 문서를 재현하지 않았어요.</p>'
   +`<ul>${items.join('')}</ul>`
   +'<p class="hint">링크를 열 때만 외부 사이트로 이동해요. 게임 진행이나 선택은 외부로 보내지 않아요.</p>');
 }
 function discussion(){
  open('토론 질문',`<ol>${D.ending.discussion.map(q=>`<li>${esc(q)}</li>`).join('')}</ol>`);
 }
 function settings(){
  open('설정',
   '<p>진행은 이 브라우저에 자동 저장돼요. 다시 열면 하던 곳부터 이어져요. 계정 가입이나 교사용 수집은 없어요.</p>'
   +`<div class="menu">${btn('참고한 실제 사례','sources')}${btn('처음부터 다시 하기','reset-ask')}</div>`
   +'<p class="hint">플레이 시간과 교육 효과는 아직 실제 학생을 대상으로 검증하지 않았어요.</p>');
 }
 function resetAsk(){
  open('처음부터 다시 하기',
   '<p>이 게임의 진행과 수첩 기록을 지우고 처음으로 돌아가요. 공통 플레이어 정보와 다른 게임 기록은 그대로 둬요.</p>'
   +'<label class="check-row"><input type="checkbox" id="reset-reporter" checked> 이름과 학번도 지우기</label>'
   +`<div class="menu">${btn('지우고 처음부터','reset','','primary')}${btn('취소','close')}</div>`);
 }

 actions.close=()=>close();
 actions.sources=()=>sources();
 actions.discussion=()=>discussion();
 actions.settings=()=>settings();
 actions['reset-ask']=()=>resetAsk();
 // 체크를 풀었을 때만 이름·학번을 남긴다.
 actions.reset=()=>{
  const keep=$('#reset-reporter')?.checked===false;
  close();
  reset(keep);
 };

 Object.assign(UI,{modal,open,close});
})();
