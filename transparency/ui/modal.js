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
   // 2026-11-12: 중학생 눈높이로 풀어 씀(뜻은 그대로 — 규제기관의 주장과 제안된 합의 명령이고, 확정된 사실·지금 상태로 단정하지 않는다).
   '미국의 한 소매 체인(Rite Aid)이 매장에서 얼굴 인식을 안전장치 없이 썼다고 미국 연방거래위원회(FTC)가 문제 삼은 2023년 발표를 참고했어요. '
    +'이 내용은 기관의 주장과 그때 내놓은 합의안이에요. 주장이 모두 법으로 확정된 사실은 아니고, 지금은 상황이 달라졌을 수 있어요.'
  ],
  // 사건 4(자동화된 결정의 기준 공개·설명 요구)와 사건 5(생성형 AI 결과물 표시)의 근거. 2026-11-12 국가법령정보센터에서 조문을 직접 확인(README).
  [
   'https://www.law.go.kr/법령/개인정보보호법/제37조의2',
   '개인정보 보호법 제37조의2 (한국)',
   '사람 없이 자동으로(AI 포함) 내린 결정이 내 권리나 의무에 큰 영향을 줄 때, 그 결정을 거부하거나 설명을 요구할 수 있고, '
    +'결정의 기준과 절차를 쉽게 확인할 수 있게 공개해야 한다는 조항을 참고했어요. 행정기관의 자동적 처분처럼 이 조항이 적용되지 않는 경우도 있어요.'
  ],
  [
   'https://www.law.go.kr/법령/인공지능발전과신뢰기반조성등에관한기본법/제31조',
   '인공지능기본법 제31조 (한국, 2026년 1월 시행)',
   '생성형 AI로 만든 결과물에는 AI가 만들었다는 사실을 표시해야 한다는 조항을 참고했어요. '
    +'이 조항은 AI 서비스를 제공하는 사업자의 의무예요. 이용자 한 사람 한 사람의 의무를 정한 조항은 아니에요.'
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
   +`<div class="menu">${btn('참고한 실제 사례','sources')}${btn(esc(D.title.back),'title')}${btn('처음부터 다시 하기','reset-ask')}</div>`
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
