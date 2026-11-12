// 화면 코드(그리기·버튼 처리)를 고쳐도 만들어 내는 HTML이 한 글자도 달라지지 않는지 확인한다(브라우저 없이 node로).
// 대본대로 버튼을 누를 때마다 #app HTML·class, 창(제목·내용), 저장 안내, 저장된 JSON, 초점·스크롤 호출을 기록해 저장해 둔 기록과 견준다.
// 기록 다시 만들기(화면을 일부러 바꿨을 때만): UPDATE_SNAPSHOT=1 node tests/render-snapshot.test.cjs
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {createGame}=require('./dom-stub.cjs');
const HASHES=path.join(__dirname,'render-snapshot.hashes.json'),FULL=path.join(__dirname,'render-snapshot.full.json.br');
const UPDATE=process.env.UPDATE_SNAPSHOT==='1';
// 화면 코드가 처리하는 data-act 전부(2026-11-10 나누기 전 app.js 기준 37개 + 2026-11-11 시작 화면의 start·title). 대본이 하나도 빠짐없이 눌러 봐야 한다.
const ALL_ACTS=['close','next','back','source','item','spot','region','record','segment','cell','village','crit','part','skyline','said','change','list','judge','judge-next','notice-pick','notice-post',
 'mark','run','row','follow-judge','choose','rechoose','ask','notebook','print','to-report','revisit','sources','discussion','settings','reset-ask','reset','start','title'];
const FIELDS=['cls','html','modalOpen','modalTitle','modalBody','save','stored','title','state','art','fx'];
const sha=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,16);
const hashOf=rec=>sha(FIELDS.map(f=>f+'\u0000'+String(rec[f])).join('\u0001'));

const clicked=new Set(),seenActs=new Set(),saves={};
// 대본 하나를 돌리는 도구 묶음
function play(opts,script){
 const g=createGame(opts),steps=[],E=g.E,D=g.D;
 const rec=label=>{const r=g.snap();for(const m of (r.html+r.modalBody).matchAll(/data-act="([^"]+)"/g))seenActs.add(m[1]);steps.push({label,...r});};
 const act=(a,data,label)=>{g.click(a,data);rec(label||a+(data?':'+Object.values(data).join('|'):''));};
 const at=()=>{const s=g.state();return {s,k:E.caseKey(s.scene),step:E.stepOf(s.scene)};};
 const peek=(what='notebook')=>{act(what);act('close',undefined,'close-'+what);};
 const wobble=()=>{if(g.has('back')){act('back');act('next',undefined,'next-again');}};
 // 자료 하나에서 누를 곳: wrong = 답이 아닌 곳, right = 다 누르면 자료가 확인되는 곳(v = 정답이 둘일 때 고를 번호)
 const pickOne=(list,v)=>[list[(v||0)%list.length]];
 const taps=(id,v=0)=>{const C=D.cases.camp,S=D.cases.share,ids=(rows,f)=>rows.filter(f).map(r=>r.id);
  return ({
   'photo-original':()=>({act:'spot',wrong:[0,1,3,4],right:[2]}),
   'photo-rule':()=>({act:'region',wrong:[],right:[0,1,2]}),
   'writing-history':()=>({act:'record',wrong:ids(D.history,r=>!r.target),right:ids(D.history,r=>r.target)}),
   'face-clerk':()=>({act:'segment',wrong:ids(D.cases.face.clerkSegments,r=>!r.found),right:pickOne(ids(D.cases.face.clerkSegments,r=>r.found),v)}),
   'camp-page':()=>({act:'cell',wrong:ids(C.page.rows,r=>!r.blank),right:v?ids(C.page.rows,r=>r.blank).reverse():ids(C.page.rows,r=>r.blank)}),
   'camp-results':()=>({act:'village',wrong:ids(C.results.rows,r=>!r.target),right:ids(C.results.rows,r=>r.target)}),
   'camp-criteria':()=>({act:'crit',wrong:[],right:v?ids(C.criteria.rows,()=>true).reverse():ids(C.criteria.rows,()=>true)}),
   'share-log':()=>({act:'part',wrong:ids(S.log,r=>!r.target),right:ids(S.log,r=>r.target)}),
   'share-photo':()=>({act:'skyline',wrong:ids(S.photos.lines,r=>!r.target),right:ids(S.photos.lines,r=>r.target)}),
   'share-compare':()=>({act:'said',wrong:['post'],right:['dm']})
  }[id]||(()=>null))();};
 // 직접 확인: 자료 찾기(틀린 곳 먼저 눌러 보기 선택) → 판단 셋
 function check(m){const {k}=at(),c=D.cases[k],items=m.reverse?c.checks.slice().reverse():c.checks;
  if(m.early){act('next',undefined,'next-disabled');}
  for(const x of items){act('item',{id:x.id});const t=taps(x.id,m.v);if(!t)continue;
   if(m.wrongTaps)for(const id of t.wrong)act(t.act,{id},'wrong-'+t.act+':'+id);
   for(const id of t.right)act(t.act,{id});
   // 이미 찾은 자료를 다시 눌러 본다(눌러도 그대로여야 한다)
   if(m.wrongTaps&&g.has(t.act,{id:t.right[0]})){act(t.act,{id:t.right[0]},'again-'+t.act);if(t.wrong.length)act(t.act,{id:t.wrong[0]},'again-wrong-'+t.act);}}
  for(let i=0;i<3;i++){const ans=E.answers[k][i],wrong=E.stamps[(E.stamps.indexOf(ans)+1+i)%3];
   if(m.sources){for(const b of g.buttons('source'))act('source',{id:b['data-id']});act('item',{id:c.checks[(i+1)%c.checks.length].id},'item-while-judging');}
   act('judge',{id:m.judge(i)?ans:wrong},'judge'+(i+1));
   if(m.wrongTaps)act('judge',{id:ans},'judge-disabled');
   if(m.sources&&g.buttons('source').length)act('source',{id:g.buttons('source')[0]['data-id']},'source-after-judge');
   if(i<2)act('judge-next');}
 }
 function follow(m){const {k}=at(),f=D.cases[k].follow,ids=E.followMarks[k].ids;
  if(k==='photo'){ids.forEach((id,i)=>{const t=E.truth[i],other=t==='cut'?'shown':'cut';
    if(m.wrongTaps)act('mark',{id,value:m.followRight?other:t},'mark-first');
    act('mark',{id,value:m.followRight||i%2?(m.followRight?t:other):t});});}
  else if(k==='writing')act('run');
  else if(k==='face')for(const id of m.reverse?ids.slice().reverse():ids)act('row',{id});
  else if(k==='camp'){if(m.wrongTaps)for(const s of f.segments.filter(x=>!x.changed))act('change',{id:s.id},'wrong-change:'+s.id);act('change',{id:pickOne(f.segments.filter(x=>x.changed).map(x=>x.id),m.v)[0]});}
  else for(const id of m.reverse?ids.slice().reverse():ids)act('list',{id});
  if(m.peek)peek();
  const ans=E.followAnswers[k];act('follow-judge',{id:m.followRight?ans:E.stamps[(E.stamps.indexOf(ans)+1+(m.v||0))%3]});
  if(m.wrongTaps){if(k==='photo')act('mark',{id:'p1',value:'cut'},'mark-locked');if(k==='writing')act('run',undefined,'run-disabled');if(k==='face')act('row',{id:'r1'},'row-after');if(k==='share')act('list',{id:'dm'},'list-after');}
 }
 function notice(m){const {s,k}=at(),n=E.noticeCards[k],pick=id=>act('notice-pick',{id}),post=()=>act('notice-post');
  // 사건 4·5 고치기(2026-11-12 요청 10): 초안이 들어 있다. setTo = 원하는 집합과 다른 카드만 눌러 맞춘다. 초안 그대로는 붙일 수 없다.
  if(E.noticeFix(s,k)){const setTo=ids=>{for(const id of E.noticeIds(k))if(ids.includes(id)!==g.state().notices[k].picked.includes(id))pick(id);};
   if(m.notice==='ok'){act('notice-post',undefined,'post-same-draft');setTo(n.must);post();}
   if(m.notice==='nice'){setTo([...n.nice,...n.must]);post();}
   if(m.notice==='stay'){setTo([n.must[0],n.conflict[0]]);post();}
   if(m.notice==='fix'){act('notice-post',undefined,'post-same-draft');pick(n.promise[0]);post();pick(n.promise[0]);act('notice-post',undefined,'post-back-to-draft');setTo(n.must);post();pick(n.conflict[0]);pick(n.nice[0]);post();}
   return;}
  if(m.notice==='ok'){n.must.forEach(pick);post();}
  if(m.notice==='nice'){[...n.nice,...n.must].forEach(pick);post();}
  if(m.notice==='stay'){[n.must[0],n.conflict[0]].forEach(pick);post();}
  if(m.notice==='fix'){act('notice-post',undefined,'post-disabled');[...n.conflict,...n.promise].forEach(pick);post();pick(n.promise[0]);post();n.must.forEach(pick);post();pick(n.conflict[0]);pick(n.nice[0]);post();}
 }
 function oneCase(m0){const m={v:0,...m0};
  let {k}=at();const c=D.cases[k],opts=E.choices[k];
  // 궁금한 것(사건 4는 구청에 묻기)
  if(c.asks){if(m.early)act('next',undefined,'next-disabled');const ids=c.asks.map(a=>a[0]);
   if(m.asks==='all')ids.forEach(id=>act('ask',{id}));else{act('ask',{id:ids[m.v+2]});act('ask',{id:ids[m.v]});act('ask',{id:ids[m.v+2]},'ask-again');}}
  if(m.peek)peek();
  act('next');if(m.wobble)wobble();
  check(m);if(m.peek)peek();if(m.wobble)wobble();
  rest(m);
 }
 // 판단을 마친 직접 확인 화면에서 다음 사건 첫 화면까지
 function rest(m0){const m={v:0,...m0},{k}=at(),opts=E.choices[k];
  act('next');if(m.wobble)wobble();
  const first=opts[m.choice%opts.length];act('choose',{id:first});if(m.peek)peek();
  if(m.rechoose){act('rechoose');act('choose',{id:opts[(m.choice+1)%opts.length]});}
  if(m.revisit){act('notebook');act('revisit',{scene:E.sceneOf(k,'choose')});act('choose',{id:opts[(m.choice+2)%opts.length]});}
  act('next');if(m.wobble)wobble();
  follow(m);if(m.peek)peek();if(m.wobble)wobble();
  act('next');if(m.wobble)wobble();
  if(m.peek)peek();
  notice(m);if(m.peek)peek();if(m.wobble)wobble();
  act('next');if(m.wobble)wobble();
  if(m.write){g.input('fake','q1','입력칸이 아닌 곳');rec('input-fake');g.input('reflect','q1',m.write+' 첫째 '+k);rec('input-q1');if(m.write2){g.input('reflect','q2',m.write2);rec('input-q2');g.input('reflect','q2','');rec('input-q2-empty');}
   if(m.rerender){act('back');act('next',undefined,'reflect-again');}}
  if(m.peek)peek();
  if(m.save)saves[m.save+':'+k]=g.stored();
  act('next');
 }
 rec('boot');
 // 시작 화면(2026-11-11)이 먼저 나온다: 으뜸 버튼(게임 시작하기·이어하기)을 눌러 예전 첫 화면으로 들어간 뒤 대본을 돈다. 미리보기에는 시작 화면이 없다.
 if(g.has('start'))act('start');
 script({g,E,D,rec,act,at,peek,wobble,check,follow,notice,oneCase,rest});
 for(const a of g.clicked)clicked.add(a);
 return steps;
}

const SCENARIOS={
 // 다섯 사건을 모두 맞게: 판단 정답·첫 선택·꼭 필요 카드만. 마지막 장면·보고서·인쇄·보고서에서 고치러 가기·이름 남기고 다시 하기.
 'walk-correct'(t){const {g,E,act,rec,peek}=t,m={judge:()=>true,choice:0,followRight:true,notice:'ok',asks:'all',write:'내 생각',write2:'둘째 줄\n줄바꿈',peek:true,save:'reflect'};
  act('next');
  for(const k of E.CASES){
   if(k==='photo'){act('next');act('item',{id:'photo-original'});saves['check:photo']=g.stored();act('back');act('next');act('back');}
   t.oneCase(m);}
  g.input('note','','마지막 <서술> & "따옴표"');rec('input-note');saves.end=g.stored();
  peek();peek('sources');peek('discussion');peek('settings');
  act('next');saves.report=g.stored();
  g.input('reporter','name','김 모아/1반');rec('input-name');g.input('reporter','number','20312\u0007');rec('input-number');
  g.input('other');rec('input-other');g.input('none');rec('input-none');
  g.windowEvent('beforeprint');rec('beforeprint');g.windowEvent('afterprint');rec('afterprint');
  act('print');g.windowEvent('beforeprint');g.windowEvent('afterprint');rec('print-done');
  peek();
  act('revisit',{scene:E.sceneOf('writing','reflect')});g.input('reflect','q1','고친 서술');rec('input-fix');act('to-report',{case:'writing'});
  act('revisit',{scene:E.sceneOf('share','reflect')});act('next',undefined,'next-from-revisit');act('next');
  act('revisit',{scene:E.END});g.input('note','','');rec('input-note-empty');act('back');act('to-report',{case:'share'});
  act('notebook');act('revisit',{scene:E.sceneOf('face','choose')});act('choose',{id:'crowd'});
  act('rechoose');act('settings');act('reset-ask');g.env.resetChecked=false;act('reset');act('next');
 },
 // 틀린 곳 먼저 누르기·판단 모두 틀리기·볼 자료 바꾸기·앞뒤로 오가기·다른 선택·안내문 고쳐 붙이기. 서술은 비워 둔다.
 'walk-wrong'(t){const {g,E,act,peek}=t,m={judge:()=>false,choice:2,followRight:false,notice:'fix',asks:'some',v:0,wrongTaps:true,sources:true,wobble:true,rechoose:true,early:true,save:'wrong'};
  g.env.visualTop=-40;
  act('next');
  for(const k of E.CASES)t.oneCase({...m,revisit:k==='writing'||k==='share'});
  peek();act('next');peek();
  g.windowEvent('beforeprint');t.rec('beforeprint-empty-name');g.windowEvent('afterprint');
  act('back');act('reset-ask');act('reset');
 },
 // 섞어서: 판단 첫째만 맞고, 가운데 선택, 있으면 좋은 카드까지 / 하나만 붙이고 넘어가기. 자료는 거꾸로 순서.
 'walk-mixed'(t){const {g,E,act,rec}=t,m={judge:i=>i===0,choice:1,followRight:true,asks:'some',v:1,reverse:true,write:'<b>굵게</b> & \'작은\' "큰" 😀'};
  act('next');
  E.CASES.forEach((k,i)=>t.oneCase({...m,notice:i%2?'stay':'nice',followRight:i%2===0,wrongTaps:k==='share'||k==='writing',rerender:true,peek:k==='camp'||k==='share'}));
  act('next');g.input('reporter','name','  ');rec('input-name-blank');act('print');g.input('reporter','name','a\\b:c*d?e"f<g>h|i  j');rec('input-name-odd');act('print');g.windowEvent('afterprint');rec('afterprint');
  t.peek();
 },
 // 창: 설정 → 참고 사례 → 닫기, 다시 하기 묻기 → 취소·바깥 누르기, 빈 수첩, 아무것도 아닌 곳 누르기
 'modals'(t){const {g,act,rec}=t;
  g.clickNothing();rec('click-nothing');
  act('notebook');g.clickBackdrop(true);rec('backdrop-inside');g.clickBackdrop(false);rec('backdrop-outside');
  act('settings');act('sources');act('close');
  act('settings');act('reset-ask');act('close',undefined,'cancel');
  act('settings');act('reset-ask');act('reset');
  act('next');act('settings');act('reset-ask');act('reset');
  g.windowEvent('beforeprint');rec('beforeprint-not-report');g.windowEvent('afterprint');rec('afterprint');
 }
};
// 시작 화면: 설정 → 시작 화면으로(프롤로그라 ‘게임 시작하기’) → 사건 1 직접 확인까지 → 시작 화면으로(‘이어하기’ + 어디부터) → 처음부터 하기 취소 → 이어하기 → 다시 시작 화면 → 지우고 처음부터 → 프롤로그
SCENARIOS['title']=t=>{const {act}=t;
 act('settings');act('title');act('start');
 act('next');act('next');act('item',{id:'photo-original'});act('settings');act('title');
 act('reset-ask');act('close',undefined,'cancel');act('start');
 act('settings');act('title');act('reset-ask');act('reset');
 act('settings');act('title');};
// 화면에만 쓰는 상태가 장면을 옮길 때 지워지는지: 눌러 본 구역·연 줄·'아님' 표시·잘못 누른 안내
SCENARIOS['view-state']=t=>{const {act,E,D}=t,m={judge:()=>true,choice:0,followRight:true,notice:'ok',asks:'all'};
 act('next');act('next');act('item',{id:'photo-rule'});act('region',{id:0});act('back');act('next');act('item',{id:'photo-rule'});act('back');
 t.oneCase(m);t.oneCase(m);
 // 사건 3: 점원의 말을 마지막 자료로. 문장마다 다른 안내가 나오고(‘바로 막으라고’는 가게 규칙 이야기 — 아직 확인 아님), ‘그 손님이래요’ 문장으로 찾는다.
 // 판단하는 중에 다른 문장을 눌러 안내를 띄운 뒤 다음 말로 넘어간다.
 act('next');for(const id of ['face-photo','face-alert','face-clerk'])act('item',{id});act('segment',{id:'system'});act('segment',{id:'rule'});act('segment',{id:'person'});
 act('item',{id:'face-clerk'});act('segment',{id:'system'},'wrong-while-judging');act('segment',{id:'rule'},'rule-after-found');act('segment',{id:'person'},'person-again');
 for(let i=0;i<3;i++){act('judge',{id:E.answers.face[i]});if(i<2)act('judge-next');}
 t.rest(m);
 act('ask',{id:'who'});act('next');act('item',{id:'camp-criteria'});act('crit',{id:'essay'});act('item',{id:'camp-page'});act('cell',{id:'use'});act('cell',{id:'appeal'},'cell-one-of-two');act('back');act('next');act('item',{id:'camp-criteria'});act('item',{id:'camp-page'});
 t.check(m);t.rest(m);
 act('next');act('item',{id:'share-log'});act('part',{id:'text'});act('item',{id:'share-photo'});act('skyline',{id:'date'});act('item',{id:'share-compare'});act('said',{id:'post'});
 act('item',{id:'share-log'});act('back');act('next');for(const id of E.checks.share)act('item',{id});
 t.check(m);t.rest(m);
};
// 그림이 열렸을 때: 축제 사진(canvas 다시 그리기)과 사건 4·5 새 그림(.webp → .png → 대신 그림)
const ART_OK={webp:src=>src.endsWith('.webp'),mixed:src=>/festival|\.png$/.test(src)&&!/lulu-phone|hill-real|dami-letter/.test(src)||/lulu-casual\.webp$/.test(src),none:()=>false};

function buildAll(){
 const out={};
 for(const [name,script] of Object.entries(SCENARIOS))out[name]=play({},script);
 // 저장된 곳부터 이어 하기: 위 대본이 남긴 저장으로 새로 연다
 for(const [tag,raw] of Object.entries(saves)){
  out['resume '+tag]=play({storage:{'ethicity.transparency.progress.v1':raw}},({g,act,peek})=>{
   const again=tag.startsWith('reflect:s')||tag==='report'||tag==='check:photo';
   if(again){act('reset-ask',undefined,'reset-ask-banner');act('close',undefined,'cancel');}
   peek();if(g.has('next'))act('next');if(g.has('back'))act('back');
   if(again){act('settings');act('reset-ask');act('reset');}});
  for(const [mode,ok] of Object.entries(ART_OK))if(/check:photo|:camp|:share|report/.test(tag)&&(mode!=='none'||tag==='reflect:camp')){
   out['art-'+mode+' '+tag]=play({storage:{'ethicity.transparency.progress.v1':raw}},({g,E,rec,act,peek})=>{
    g.settleImages(ok);rec('images-settled');peek();
    if(tag==='check:photo'){act('item',{id:'photo-original'});act('spot',{id:2});act('item',{id:'photo-rule'});act('region',{id:1});}
    else{const k=/:(camp|share)/.exec(tag)?.[1]||'share';
     // 수첩에서 그 사건의 선택 화면으로 → 직접 확인으로 돌아가 자료를 하나씩 열고 → 선택마다 결과 화면
     act('notebook');act('revisit',{scene:E.sceneOf(k,'choose')});act('back');for(const id of E.checks[k])act('item',{id});
     act('back');act('next');act('next');for(const id of E.choices[k]){act('choose',{id});act('rechoose');}}});}
 }
 const KEY='ethicity.transparency.progress.v1';
 out['art-photo-walk']=play({},t=>{t.g.settleImages(ART_OK.webp);t.rec('images-settled');t.act('next');t.oneCase({judge:()=>true,choice:1,followRight:true,notice:'ok'});
  // 전체 사진을 고른 뒤 앞 화면(직접 확인·궁금한 것)으로 돌아가도 무대 사진은 자동으로 자른 사진이어야 한다
  t.act('notebook');t.act('revisit',{scene:t.E.sceneOf('photo','choose')});t.act('back');t.act('back');});
 out['preview']=play({search:'?preview=s01',storage:{[KEY]:saves.report}},({g,act})=>{act('next');act('item',{id:'photo-original'});act('spot',{id:0});act('spot',{id:2});act('back');act('next');act('notebook');act('close');act('settings');act('reset-ask');act('reset');});
 out['no-preview-param']=play({search:'?preview=s02&x=1',storage:{[KEY]:saves['check:photo']}},({act})=>{act('next');});
 out['storage-blocked']=play({blocked:true},({act})=>{act('next');act('next');act('notebook');act('close');});
 out['storage-write-fails']=play({},({g,act,rec})=>{act('next');g.env.failSet=true;act('next');act('item',{id:'photo-original'});g.env.failSet=false;g.input('other');rec('input-other-no-save');act('spot',{id:2});});
 const players={ok:'{"nickname":"  루\\u0007루 <b>&  "}',long:JSON.stringify({nickname:'가'.repeat(60)}),blank:'{"nickname":"   "}',notString:'{"nickname":3}',nullValue:'null',broken:'{nick'};
 for(const [tag,p] of Object.entries(players))out['player '+tag]=play({storage:{'ethicity.player':p,[KEY]:saves['check:photo']}},({act})=>{act('next');});
 // 옛 저장(판단 하나짜리 version 1 · 주장 판정 방식 · version 2)과 망가진 저장
 const E=require('../engine.js'),c=f=>({first:f,final:f});
 const v1={version:1,revision:4,scene:13,furthest:13,evidence:[...E.checks.photo,...E.checks.writing,...E.checks.face],judgments:{photo:'confirmed',writing:'different',face:'unknown'},
  cases:{photo:c('all'),writing:c('review'),face:{first:'maintain',final:'release',legacyFirst:true}},question:'input',completed:true};
 const v1old={version:1,scene:13,evidence:['P1','P2','W2','W3','F1','F2','F3'],cases:{photo:{final:'manual'},writing:{first:'detector',final:'draft'},face:{final:'crowd'}}};
 const v2={version:2,scene:16,furthest:16,evidence:v1.evidence,judgments:{photo:E.answers.photo,writing:['confirmed','unknown','confirmed'],face:E.answers.face},cases:{photo:c('auto'),writing:c('detector'),face:c('maintain')},
  follows:Object.fromEntries(['photo','writing','face'].map(k=>[k,{marks:Object.fromEntries(E.followMarks[k].ids.map((id,i)=>[id,k==='photo'?E.truth[i]:E.followMarks[k].values[0]])),judgment:E.followAnswers[k]}])),question:'notice',completed:true};
 const legacy=({g,E,act,peek,rec})=>{peek();
  for(const k of ['photo','writing','face']){
   if(g.state().judgments[k].includes('legacy')){act('notebook');act('revisit',{scene:E.sceneOf(k,'check')});
    while(g.buttons('judge').some(b=>!('disabled' in b))){act('judge',{id:E.answers[k][E.currentJudgment(g.state(),k)]});if(g.has('judge-next'))act('judge-next');}
    act('next');act('next');}
   if(g.state().follows[k].judgment==='legacy'){act('notebook');act('revisit',{scene:E.sceneOf(k,'follow')});
    if(k==='photo')E.followMarks.photo.ids.forEach((id,i)=>act('mark',{id,value:E.truth[i]}));else if(k==='writing')act('run');else for(const id of E.followMarks[k].ids)act('row',{id});
    act('follow-judge',{id:'unknown'});act('next');}
   if(g.state().notices[k].posted==='legacy'){act('notebook');act('revisit',{scene:E.sceneOf(k,'notice')});act('notice-pick',{id:E.noticeCards[k].must[0]});act('notice-post');act('next');act('next');}
   peek();}
  rec('legacy-done');};
 out['legacy v1r4']=play({storage:{[KEY]:JSON.stringify(v1)}},legacy);
 out['legacy v1 old']=play({storage:{[KEY]:JSON.stringify(v1old)}},legacy);
 out['legacy v2']=play({storage:{[KEY]:JSON.stringify(v2)}},legacy);
 out['broken-save']=play({storage:{[KEY]:'{"version":6,"scene":99'}},({act})=>{act('notebook');});
 return out;
}

const all=buildAll();
const hashes=Object.fromEntries(Object.entries(all).map(([name,steps])=>[name,steps.map(s=>s.label+' '+hashOf(s))]));
const total=Object.values(all).reduce((n,s)=>n+s.length,0);

if(UPDATE){
 // 전체 기록은 같은 글을 한 번만 담아 brotli로 눌러 둔다(틀렸을 때 어디가 다른지 보여 주는 데만 쓴다).
 const blobs=[],index=new Map(),put=v=>{const s=String(v);if(!index.has(s)){index.set(s,blobs.length);blobs.push(s);}return index.get(s);};
 const full={fields:FIELDS,scenarios:Object.fromEntries(Object.entries(all).map(([n,steps])=>[n,steps.map(s=>FIELDS.map(f=>put(s[f])))])),blobs};
 fs.writeFileSync(HASHES,JSON.stringify({note:'tests/render-snapshot.test.cjs가 만든 화면 기록(걸음마다 sha256 앞 16자). 손으로 고치지 않는다.',scripts:require('./dom-stub.cjs').scriptList(),steps:total,scenarios:hashes},null,1)+'\n');
 fs.writeFileSync(FULL,zlib.brotliCompressSync(Buffer.from(JSON.stringify(full)),{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:9,[zlib.constants.BROTLI_PARAM_LGWIN]:24}}));
 console.log(`기록 다시 만듦: 대본 ${Object.keys(all).length}개 · ${total}걸음 · 누른 data-act ${clicked.size}/${ALL_ACTS.length}`);
}
const want=JSON.parse(fs.readFileSync(HASHES,'utf8'));
let fullCache=null;
const fullOf=(name,i)=>{try{fullCache=fullCache||JSON.parse(zlib.brotliDecompressSync(fs.readFileSync(FULL)).toString());const row=fullCache.scenarios[name]?.[i];return row&&Object.fromEntries(FIELDS.map((f,n)=>[f,fullCache.blobs[row[n]]]));}catch{return null;}};
// 처음 달라지는 곳 앞뒤를 잘라 보여 준다
function excerpt(a,b){let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;const cut=s=>JSON.stringify(s.slice(Math.max(0,i-80),i+160));return `  ${i}번째 글자부터 다름\n  전: ${cut(a)}\n  후: ${cut(b)}`;}

for(const [name,steps] of Object.entries(all))test('화면 기록: '+name+' ('+steps.length+'걸음)',()=>{
 const exp=want.scenarios[name];assert.ok(exp,'저장된 기록에 없는 대본');
 for(let i=0;i<Math.max(steps.length,exp.length);i++){
  const got=hashes[name][i];if(got===exp[i])continue;
  let msg=`${name} ${i+1}번째 걸음이 다름\n  기대: ${exp[i]}\n  실제: ${got}`;
  const old=fullOf(name,i);
  if(old&&steps[i])for(const f of FIELDS)if(String(steps[i][f])!==old[f])msg+=`\n[${f}]\n`+excerpt(old[f],String(steps[i][f]));
  assert.fail(msg);
 }
});
test('대본이 data-act를 모두 눌러 본다',()=>{
 assert.deepEqual(ALL_ACTS.filter(a=>!clicked.has(a)),[],'누르지 않은 data-act');
 assert.deepEqual([...seenActs].filter(a=>!ALL_ACTS.includes(a)),[],'목록에 없는 data-act가 화면에 나옴');
 assert.equal(total,want.steps,'걸음 수');
});
