// 흐름(궁금한 것 → 직접 확인·판단 셋 → 선택 → 결과 → 후속 조사 → 생각 정리, 마지막 → 보고서) 브라우저 검사. 실제 학생 실험이 아니라 헤드리스 Edge 클릭 프로브다.
// 실행: node tests/flow-browser.cjs   (브라우저는 한 번에 하나만 띄운다)
const PW=process.env.PLAYWRIGHT_PATH||'D:/Works/token_economy/node_modules/playwright';
const {chromium}=require(PW);
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),http=require('node:http'),E=require('../engine.js');
const root=path.resolve(__dirname,'..'),KEY='ethicity.transparency.progress.v1',shotDir=path.join(__dirname,'screens');
fs.mkdirSync(shotDir,{recursive:true});
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://x').pathname));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file===root?path.join(root,'index.html'):file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'})[path.extname(file)]||'text/html; charset=utf-8'});res.end(err?'missing':data);});});
const DESKTOP={width:1366,height:768},WIDE={width:1280,height:800},PHONE={width:390,height:844};
// 모든 사건을 정답으로 마치고 보고서까지 간 저장(서술은 비어 있음)
function finishedState(){let s=E.initial();
 for(let n=0;n<E.REPORT;n++){const k=E.caseKey(n),st=E.stepOf(n);
  if(st==='check'){for(const id of E.checks[k])s=E.reduce(s,{type:'check',id});for(const a of E.answers[k])s=E.reduce(s,{type:'judge',stamp:a});}
  if(st==='choose'){s=E.reduce(s,{type:'choose',id:E.choices[k][0]});continue;}
  if(st==='follow'){const m=E.followMarks[k];m.ids.forEach((id,i)=>{s=E.reduce(s,{type:'mark',id,value:k==='photo'?E.truth[i]:m.values[0]});});s=E.reduce(s,{type:'follow-judge',stamp:E.followAnswers[k]});}
  if(st==='end')s=E.reduce(s,{type:'ask',id:'input'});
  s=E.reduce(s,{type:'next'});}
 assert.equal(s.scene,E.REPORT);return s;}
const results={paths:[],checks:[],readability:[]};
let browser,url,clicks=0;
const state=p=>p.evaluate(()=>TransparencyGame.getState());
const click=(p,sel)=>{clicks++;return p.locator(sel).first().click();};
async function assets(p){await p.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:60000});}
async function measure(p,label,viewport){
 await p.evaluate(()=>window.scrollTo(0,0));
 const m=await p.evaluate(()=>{const app=document.querySelector('#app'),h1=document.querySelector('h1').getBoundingClientRect(),act=document.querySelector('.body button:not(:disabled)');
  return {chars:app.innerText.replace(/\s+/g,'').length,buttons:[...app.querySelectorAll('button')].filter(b=>b.offsetParent&&!b.disabled).length,
   overflow:document.documentElement.scrollWidth>innerWidth,pageHeight:Math.round(document.documentElement.scrollHeight),
   questionInView:h1.top>=0&&h1.bottom<=innerHeight,firstActionInView:!!act&&act.getBoundingClientRect().bottom<=innerHeight,
   codes:(app.innerText.match(/\b[PWF][1-3]\b|S\d\d/g)||[])};});
 assert.equal(m.overflow,false,'horizontal overflow at '+label);assert.deepEqual(m.codes,[],'internal codes shown at '+label);
 results.readability.push({viewport:viewport.width+'x'+viewport.height,screen:label,...m});return m;}
async function shot(p,name,full=false){await assets(p);await p.screenshot({path:path.join(shotDir,name+'.png'),fullPage:full});}
async function discover(p,k,id,wrongFirst){
 await click(p,`[data-act="item"][data-id="${id}"]`);
 if(id==='photo-original'){
  assert.deepEqual(await p.locator('.face-spot').evaluateAll(a=>a.map(b=>b.getAttribute('aria-label'))),['얼굴 1','얼굴 2','얼굴 3','얼굴 4','얼굴 5'],'face names do not reveal the answer');
  if(wrongFirst){await click(p,'[data-act="spot"][data-id="1"]');assert.match(await p.locator('.tap-hint').innerText(),/담이가 아니야/);}
  assert.equal(await p.locator('.body .task').count(),1);await click(p,'[data-act="spot"][data-id="2"]');assert.equal(await p.locator('.face-spot.found').count(),1);
  assert.equal(await p.locator('.body .task').count(),0,'find instruction hidden after 담이 is found');}
 if(id==='photo-rule'){for(const i of [0,1]){await click(p,`[data-act="region"][data-id="${i}"]`);}assert.equal(await p.locator('.center-dot').count(),0,'centre hidden until all regions opened');await click(p,'[data-act="region"][data-id="2"]');assert.match(await p.locator('.regions').innerText(),/오른쪽 8/);assert.equal(await p.locator('.center-dot').count(),1);}
 if(id==='writing-history'){assert.equal(await p.locator('[data-act="record"]').count(),5,'five timed versions');
  if(wrongFirst){await click(p,'[data-act="record"][data-id="h3"]');assert.match(await p.locator('.tap-hint').innerText(),/비슷하지만/);}
  await click(p,'[data-act="record"][data-id="h4"]');}
 if(id==='face-clerk'){if(wrongFirst){await click(p,'[data-act="segment"][data-id="system"]');assert.match(await p.locator('.tap-hint').innerText(),/알림/);}await click(p,'[data-act="segment"][data-id="person"]');}
 assert.ok((await state(p)).evidence.includes(id),'checked '+id);
 assert.ok((await p.locator('.finding').count())>0,'finding shown for '+id);
}
async function judgeThree(p,k,judge){let n=0;
 for(let i=0;i<3;i++){
  assert.equal(await p.locator('.step-nav [data-act="next"]').isDisabled(),true,'choice locked before judgment '+(i+1));
  assert.match(await p.locator('.judge .question-label').innerText(),new RegExp(`${i+1}/3`));
  const pick=judge(k,i);await click(p,`[data-act="judge"][data-id="${pick}"]`);n++;
  const fb=await p.locator('.judge .finding').innerText();if(pick!==E.answers[k][i])assert.match(fb,/정리: 자료/,'wrong pick names the right category');
  if(i<2)await click(p,'[data-act="judge-next"]');
 }
 return n;}
async function follow(p,k,judge,wrongFirst){
 assert.equal(E.stepOf((await state(p)).scene),'follow');
 assert.equal(await p.locator('.step-nav [data-act="next"]').isDisabled(),true,'follow-up must be done');
 if(k==='photo'){assert.equal(await p.locator('.follow-photo canvas').count(),6);for(let i=0;i<6;i++){const v=wrongFirst?'cut':E.truth[i];await click(p,`[data-act="mark"][data-id="p${i+1}"][data-value="${v}"]`);}
  const t=await p.locator('.body .finding').first().innerText();assert.match(t,/잘린 사진은 3장/);assert.match(t,wrongFirst?/다른 사진: 2, 4, 6번/:/기록과 같아/);}
 if(k==='writing'){await click(p,'[data-act="run"]');assert.equal(await p.locator('.visual mark').count(),2);}
 if(k==='face'){for(const r of ['r1','r2','r3','r4'])await click(p,`[data-act="row"][data-id="${r}"]`);assert.equal(await p.locator('.proof').count(),4);}
 const pick=judge(k,'follow');await click(p,`[data-act="follow-judge"][data-id="${pick}"]`);
 assert.match(await p.locator('.judge .unknown').innerText(),/아직 모르는 점/);
 return 1;}
// 생각 정리: 문장 틀이 입력칸 위 실제 글, 글자 수, 비우면 '작성 안 함' 안내, 입력할 때마다 저장
async function reflect(p,k,write){
 assert.equal(E.stepOf((await state(p)).scene),'reflect');
 const labels=(await p.locator('.write-q label').allInnerTexts()).map(t=>t.replace(/\s+/g,' '));assert.match(labels[0],/나는 .*자료를 보고, 이 AI가 .*라고 판단했다/);assert.match(labels[1],/아직 확인하지 못한 것은 .*이고, 그것을 알려면 .*가 필요하다/);
 assert.equal(await p.locator('.write-q textarea').count(),2);assert.equal(await p.locator('.reflect-sum .verdict').count(),3,'summary of the three judgments');assert.match(await p.locator('.reflect-sum').innerText(),/최종 조치/);
 assert.equal(await p.locator('.empty-note:visible').count(),2);assert.match(await p.locator('.empty-note').first().innerText(),/작성 안 함/);
 for(const [q,t] of Object.entries(write||{})){await p.locator(`textarea[data-reflect="${q}"]`).fill(t);assert.equal((await state(p)).reflections[k][q],t,'autosaved '+q);}
 assert.equal(await p.locator('.empty-note:visible').count(),2-Object.keys(write||{}).length);
 if(write&&write.q1)assert.match(await p.locator('.count-n').first().innerText(),new RegExp('^'+[...write.q1].length+'자'));}
async function play(p,{tag,viewport,pick,judge,wrongFirst,shots,write={},note:finalNote=''}){
 const errors=[],external=[];p.on('pageerror',e=>errors.push(String(e)));p.on('request',r=>{if(!r.url().startsWith(url))external.push(r.url());});
 clicks=0;let judgments=0;
 await p.goto(url,{waitUntil:'domcontentloaded'});await assets(p);
 await measure(p,'intro',viewport);if(shots.includes('intro'))await shot(p,`${tag}-intro`,viewport===PHONE);
 await click(p,'[data-act="next"]');
 for(const k of E.CASES){
  assert.equal(E.stepOf((await state(p)).scene),'hook');assert.match(await p.locator('.meta').innerText(),new RegExp(`${E.CASES.indexOf(k)+1}/${E.CASES.length}`));
  await measure(p,k+'-hook',viewport);if(shots.includes(k+'-hook'))await shot(p,`${tag}-${k}-hook`,viewport===PHONE);
  await click(p,'.step-nav [data-act="next"]');
  await measure(p,k+'-check-start',viewport);
  for(const id of E.checks[k])await discover(p,k,id,wrongFirst);
  await measure(p,k+'-check-records',viewport);if(shots.includes(k+'-check-records'))await shot(p,`${tag}-${k}-check-records`,viewport===PHONE);
  judgments+=await judgeThree(p,k,judge);
  await measure(p,k+'-check-done',viewport);if(shots.includes(k+'-check'))await shot(p,`${tag}-${k}-check`,viewport===PHONE);
  await click(p,'.step-nav [data-act="next"]');
  await measure(p,k+'-choose',viewport);
  await click(p,`[data-act="choose"][data-id="${pick[k]}"]`);
  const s=await state(p);assert.equal(E.stepOf(s.scene),'result');assert.equal(s.cases[k].final,pick[k]);
  await measure(p,k+'-result',viewport);assert.equal(await p.locator('.body .unknown').count(),0,'result no longer ends with the unknown line');
  if(k==='photo'){const crop=await p.locator('.stage-photo canvas').getAttribute('data-crop');assert.equal(crop,(pick.photo==='all'?E.ALL:E.AUTO).join(','));}
  if(k==='face'){assert.equal(await p.locator('.stage-status').innerText(),pick.face==='release'?'입장 제한 해제':'입장 제한 중');assert.equal(await p.locator('img.actor.clerkOpen').count(),pick.face==='release'?1:0);}
  if(k==='writing')assert.equal(await p.locator('.stage-status').innerText(),pick.writing==='detector'?'발표: 빠짐':'발표: 그대로 진행');
  if(shots.includes(k+'-result'))await shot(p,`${tag}-${k}-result`,viewport===PHONE);
  await click(p,'.step-nav [data-act="next"]');
  await measure(p,k+'-follow-start',viewport);
  judgments+=await follow(p,k,judge,wrongFirst);
  await measure(p,k+'-follow-done',viewport);if(shots.includes(k+'-follow'))await shot(p,`${tag}-${k}-follow`,viewport===PHONE);
  await click(p,'.step-nav [data-act="next"]');
  await reflect(p,k,write[k]);await measure(p,k+'-reflect',viewport);
  await click(p,'.step-nav [data-act="next"]');
 }
 assert.equal((await state(p)).scene,E.END);await measure(p,'end',viewport);
 await click(p,'[data-act="ask"][data-id="criteria"]');assert.match(await p.locator('.ending-quote').innerText(),/질문이었다/);
 assert.match(await p.locator('label[for="final-note"]').innerText(),/앞으로 AI 서비스를 쓸 때 나는 무엇을 먼저 물어볼까\?/);if(finalNote){await p.locator('#final-note').fill(finalNote);assert.equal((await state(p)).finalNote,finalNote);}
 await measure(p,'end-done',viewport);if(shots.includes('end'))await shot(p,`${tag}-end`,viewport===PHONE);
 await click(p,'.menu [data-act="notebook"]');const note=await p.locator('#modal-body').innerText();
 assert.match(note,/원본 사진에는 다섯 친구가 모두 있고/);assert.match(note,/3\. “/);assert.match(note,/후속 조사/);assert.match(note,/점검표 4개 가운데/);
 assert.doesNotMatch(note.split('확인한 자료')[1].split('이 말은 맞을까?')[0],/^(모아|담이|루루)/m,'facts are third-person, not character lines');
 assert.equal(await p.locator('#modal-body .case-card').count(),3,'notebook uses the grouped case cards');assert.match(note,/내 서술/);
 if(shots.includes('notebook'))await shot(p,`${tag}-notebook`);
 await p.keyboard.press('Escape');
 // 나의 조사 보고서
 await click(p,'.step-nav [data-act="next"]');assert.equal((await state(p)).scene,E.REPORT);await measure(p,'report',viewport);
 const rep=await p.locator('.report').innerText(),cards=p.locator('.report .case-card');assert.equal(await cards.count(),4);
 for(const [i,k] of E.CASES.entries()){const t=await cards.nth(i).innerText();assert.match(t,new RegExp('사건 '+(i+1)));assert.match(t,/확인한 자료/);assert.match(t,/처음 조치[\s\S]*최종 조치/);assert.match(t,/후속 조사/);assert.match(t,/내 서술/);assert.equal((t.match(/내 판단:/g)||[]).length,4,'3 judgments + follow-up in case '+k);}
 const right=(rep.match(/· 정답/g)||[]).length,again=(rep.match(/다시 볼 것/g)||[]).length;assert.equal(right+again,12,'every judgment marked in words');
 const empties=E.CASES.reduce((a,k)=>a+['q1','q2'].filter(q=>!(write[k]||{})[q]).length,0)+(finalNote?0:1);assert.equal((rep.match(/작성 안 함/g)||[]).length,empties,"empty answers show '작성 안 함'");
 for(const k of E.CASES)for(const t of Object.values(write[k]||{}))assert.ok(rep.includes(t),'written reflection in report');if(finalNote)assert.ok(rep.includes(finalNote));
 assert.match(rep,/서버로 보내지 않아요/);assert.match(rep,/인쇄 창에서 대상을 ‘PDF로 저장’으로 고르세요/);
 await p.locator('[data-reporter="name"]').fill('하늘');
 const s=await state(p);assert.equal(s.completed,true);assert.equal(s.reporter.name,'하늘');
 await p.reload({waitUntil:'domcontentloaded'});assert.deepEqual(await state(p),s,'completed play survives reload');assert.equal(await p.locator('[data-reporter="name"]').inputValue(),'하늘');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 results.paths.push({tag,viewport:viewport.width+'x'+viewport.height,judgments,clicks,reportRight:right,reportAgain:again,reportNotWritten:empties,choices:s.cases,judgmentsPicked:s.judgments,completed:s.completed,errors:errors.length,externalRequests:external.length});
}
async function withPage(viewport,fn,init){const ctx=await browser.newContext({viewport});if(init)await ctx.addInitScript(init);const p=await ctx.newPage();p.setDefaultTimeout(30000);try{return await fn(p);}finally{await ctx.close();}}
async function seedPage(p,obj){await p.goto(url);await p.evaluate(({KEY,obj})=>localStorage.setItem(KEY,JSON.stringify(obj)),{KEY,obj});await p.reload();}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/`;
 browser=await chromium.launch({channel:'msedge',headless:true});
 const right=(k,i)=>i==='follow'?E.followAnswers[k]:E.answers[k][i];
 try{
  await withPage(DESKTOP,p=>play(p,{tag:'desktop',viewport:DESKTOP,pick:{photo:'all',writing:'review',face:'release'},judge:right,wrongFirst:false,shots:['photo-check','photo-follow','writing-check-records','writing-follow','face-follow','notebook'],
   write:{photo:{q1:'나는 AI의 자르기 기준 자료를 보고, 이 AI가 눈길이 모일 곳을 중심으로 잘랐다고 판단했다.'},face:{q2:'아직 확인하지 못한 것은 점검이 끝났는지이고, 그것을 알려면 점검 기록이 필요하다.'}},note:'어떤 정보를 썼는지 먼저 물어볼래.'}));
  await withPage(PHONE,p=>play(p,{tag:'phone',viewport:PHONE,pick:{photo:'auto',writing:'detector',face:'maintain'},judge:()=>'confirmed',wrongFirst:true,shots:['photo-check','photo-follow','writing-check-records','face-follow']}));
  // 저장·이어하기·다시 선택·처음부터
  await withPage(PHONE,async p=>{
   await p.goto(url,{waitUntil:'domcontentloaded'});await p.evaluate(()=>localStorage.setItem('ethicity.player',JSON.stringify({nickname:'테스트<b>'})));
   await click(p,'[data-act="next"]');await click(p,'.step-nav [data-act="next"]');await discover(p,'photo','photo-original',false);
   await p.reload({waitUntil:'domcontentloaded'});let s=await state(p);assert.equal(s.scene,2);assert.deepEqual(s.evidence,['photo-original']);
   assert.match(await p.locator('.resume').innerText(),/이어서/);assert.match(await p.locator('#save-status').innerText(),/테스트<b>/);
   await discover(p,'photo','photo-rule',false);await click(p,'[data-act="judge"][data-id="unknown"]');
   await p.reload({waitUntil:'domcontentloaded'});assert.match(await p.locator('.judge .question-label').innerText(),/2\/3/,'resumes at the next judgment');
   await click(p,'[data-act="judge"][data-id="different"]');await click(p,'[data-act="judge-next"]');await click(p,'[data-act="judge"][data-id="unknown"]');
   await click(p,'.step-nav [data-act="next"]');assert.equal(await p.locator('.resume').count(),0,'resume notice disappears after moving on');
   await click(p,'[data-act="choose"][data-id="auto"]');await click(p,'[data-act="rechoose"]');await click(p,'[data-act="choose"][data-id="all"]');
   s=await state(p);assert.deepEqual(s.cases.photo,{first:'auto',final:'all'});
   await click(p,'.step-nav [data-act="next"]');await click(p,'[data-act="mark"][data-id="p1"][data-value="cut"]');
   await p.reload({waitUntil:'domcontentloaded'});s=await state(p);assert.equal(E.stepOf(s.scene),'follow');assert.equal(s.follows.photo.marks.p1,'cut');
   await click(p,'header [data-act="notebook"]');const note=await p.locator('#modal-body').innerText();
   assert.match(note,/1\. “이번 사진은[^”]*”\s*내 판단: 자료로는 알 수 없어 · 다시 볼 것 \(정리: 자료로 확인돼\)/);assert.match(note,/처음 조치\s*자동으로 자른 사진/);assert.match(note,/최종 조치\s*모두 나오는 사진/);
   await p.keyboard.press('Escape');assert.equal(await p.locator('dialog').isVisible(),false);
   await click(p,'header [data-act="settings"]');await click(p,'#modal-body [data-act="reset-ask"]');await click(p,'[data-act="reset"]');
   const saved=JSON.parse(await p.evaluate(k=>localStorage.getItem(k),KEY));assert.equal((await state(p)).scene,0);assert.equal(saved.scene,0);assert.equal(saved.version,3);
   assert.equal(await p.evaluate(()=>localStorage.getItem('ethicity.player')),JSON.stringify({nickname:'테스트<b>'}),'shared player data untouched');
   results.checks.push({saveResume:'mid-check and mid-judgment and mid-follow reload keep progress; rechoose keeps first; notebook lists judgments; reset clears only this game (version 3)'});
  });
  // 키보드만으로 확인 조작
  await withPage(DESKTOP,async p=>{let s=E.initial();s.scene=2;s.furthest=2;await seedPage(p,s);
   await p.locator('[data-act="item"][data-id="photo-rule"]').focus();await p.keyboard.press('Enter');
   for(const i of [0,1,2]){await p.locator(`[data-act="region"][data-id="${i}"]`).focus();await p.keyboard.press('Enter');}
   assert.ok((await state(p)).evidence.includes('photo-rule'));results.checks.push({keyboard:'item and region buttons operable with Enter'});});
  // 이전 저장: version 1 revision 4 (scene 5 = 글 사건 시작), revision 3, 손상 저장
  await withPage(DESKTOP,async p=>{
   const r4={version:1,revision:4,scene:5,furthest:5,evidence:['photo-original','photo-rule'],judgments:{photo:'unknown',writing:null,face:null},cases:{photo:{first:'auto',final:'auto'},writing:{first:null,final:null},face:{first:null,final:null}},question:null,completed:false};
   await seedPage(p,r4);let s=await state(p);assert.equal(s.version,3);assert.equal(E.caseKey(s.scene),'writing');assert.equal(E.stepOf(s.scene),'hook');
   assert.match(await p.locator('h1').innerText(),/의심 표시가 붙은 원고/);await click(p,'.step-nav [data-act="next"]');assert.equal(E.stepOf((await state(p)).scene),'check');
   await click(p,'header [data-act="notebook"]');assert.match(await p.locator('#modal-body').innerText(),/이전 저장에서 넘어와 아직 안 함/);
   await click(p,'#modal-body [data-act="revisit"][data-scene="2"]');assert.match(await p.locator('.judge .question-label').innerText(),/2\/3/);
   const r3={version:1,revision:3,scene:7,furthest:7,evidence:['P1','P2','P3','W1','W2'],tasks:{},claims:{},attempts:{},assistedScenes:[],cases:{photo:{first:'auto',final:'manual',pending:null,help:false},writing:{first:null,final:null,pending:null,help:false},face:{first:null,final:null,pending:null,help:false}},crop:[0,0,1536,1024],completed:false};
   await seedPage(p,r3);s=await state(p);assert.equal(s.scene,E.sceneOf('writing','hook'));assert.equal(s.cases.photo.final,'all');
   await p.evaluate(k=>localStorage.setItem(k,'{broken'),KEY);await p.reload();assert.equal((await state(p)).scene,0);
   results.checks.push({legacySave:'v1 rev4 scene 5 resumes at writing case start, old judgment kept, new ones can be done from notebook; rev3 S07 resumes at writing case start; corrupt save starts at prologue'});});
  // version 2 저장(옛 장면 7 = 글 사건 직접 확인)이 version 3으로 옮겨지고, 서술 칸은 빈 값
  await withPage(DESKTOP,async p=>{
   const v2={version:2,scene:7,furthest:7,evidence:[...E.checks.photo],judgments:{photo:E.answers.photo.slice(),writing:[null,null,null],face:[null,null,null]},cases:{photo:{first:'auto',final:'all'},writing:{first:null,final:null},face:{first:null,final:null}},
    follows:{photo:{marks:Object.fromEntries(E.followMarks.photo.ids.map((id,i)=>[id,E.truth[i]])),judgment:'different'},writing:{marks:{},judgment:null},face:{marks:{},judgment:null}},question:null,completed:false};
   await seedPage(p,v2);const s=await state(p);assert.equal(s.version,3);assert.equal(E.caseKey(s.scene),'writing');assert.equal(E.stepOf(s.scene),'check');
   assert.deepEqual(s.reflections.photo,{q1:'',q2:''});assert.deepEqual(s.cases.photo,{first:'auto',final:'all'});
   assert.equal(JSON.parse(await p.evaluate(k=>localStorage.getItem(k),KEY)).version,3,'same key, rewritten as version 3');
   await click(p,'.step-nav [data-act="back"]');await click(p,'.step-nav [data-act="back"]');assert.equal(E.stepOf((await state(p)).scene),'reflect','new reflection screen of the photo case can be opened');
   assert.equal(await p.locator('.empty-note:visible').count(),2);
   results.checks.push({v2Migration:'version 2 save at old scene 7 resumes at writing check as version 3 with empty reflections; photo reflection reachable'});});
  // 서술 자동 저장·이어하기, 보고서 → 서술 고치기 → 보고서, 인쇄 제목, PDF 쪽수, 캡처(1280×800·390×844)
  const done=finishedState();
  for(const [tag,vp] of [['desktop1280',WIDE],['phone',PHONE]])await withPage(vp,async p=>{const errors=[];p.on('pageerror',e=>errors.push(String(e)));
   const at=JSON.parse(JSON.stringify(done));at.scene=E.sceneOf('photo','reflect');await seedPage(p,at);
   const t1='나는 원본 사진 자료를 보고, 이 AI가 눈길이 모일 곳을 중심으로 잘랐다고 판단했다.';
   await p.locator('textarea[data-reflect="q1"]').fill(t1);await p.reload({waitUntil:'domcontentloaded'});
   assert.equal(await p.locator('textarea[data-reflect="q1"]').inputValue(),t1,'reflection survives reload');assert.equal((await state(p)).reflections.photo.q1,t1);
   assert.equal(await p.locator('.empty-note:visible').count(),1,'only the empty box shows the note');
   await shot(p,`${tag}-reflect`,vp===PHONE);
   await click(p,'[data-act="to-report"]');assert.equal((await state(p)).scene,E.REPORT);assert.ok((await p.locator('#report-photo').innerText()).includes(t1));
   await click(p,`#report-writing [data-act="revisit"]`);assert.equal((await state(p)).scene,E.sceneOf('writing','reflect'),'edit jumps to that case');
   await p.locator('textarea[data-reflect="q2"]').fill('검사 이유');await click(p,'[data-act="to-report"]');assert.match(await p.locator('#report-writing').innerText(),/검사 이유/);
   await p.locator('[data-reporter="name"]').fill('하늘');await p.locator('[data-reporter="number"]').fill('10203');
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow on report');
   await shot(p,`${tag}-report`,true);
   const title=await p.evaluate(()=>{window.print=()=>{window.__printed=document.title;};return document.title;});
   await click(p,'[data-act="print"]');const printed=await p.evaluate(()=>window.__printed);assert.match(printed,/^투명성_보고서_하늘_\d{4}-\d{2}-\d{2}$/);
   await p.evaluate(()=>window.dispatchEvent(new Event('afterprint')));assert.equal(await p.evaluate(()=>document.title),title,'title restored after print');
   if(vp===WIDE){// 가장 긴 경우: 서술 여섯 칸과 마지막 서술을 모두 200자 넘게 채운다
    const long='나는 자료를 보고 판단했다. '.repeat(15),full=JSON.parse(JSON.stringify(done));for(const k of E.CASES)full.reflections[k]={q1:long,q2:long};full.finalNote=long;full.reporter={name:'하늘',number:'10203'};
    for(const [label,st] of [['some empty',await state(p)],['all 200+ chars',full]]){await seedPage(p,st);await p.emulateMedia({media:'print'});
     const hidden=await p.evaluate(()=>['header','footer','.report-actions','[data-act="print"]','#report-photo [data-act="revisit"]'].map(q=>getComputedStyle(document.querySelector(q)).display));assert.ok(hidden.every(d=>d==='none'),'print hides menu and buttons '+hidden);
     const tags=await p.locator('.v-tag').allInnerTexts();assert.ok(tags.length===12&&tags.every(t=>t==='정답'||t==='다시 볼 것'),'right/wrong written in words');
     if(label==='some empty')await p.screenshot({path:path.join(shotDir,'print-preview.png'),fullPage:true});
     const pdf=await p.pdf({preferCSSPageSize:true});const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
     assert.ok(pages>=1&&pages<=3,`PDF ${label}: ${pages} pages`);results.checks.push({printPdf:`${label}: ${pages} pages (A4, 15mm)`});await p.emulateMedia({media:'screen'});}
   }
   assert.deepEqual(errors,[]);results.checks.push({reportEdit:`${tag}: reflection autosave+reload, report → 서술 고치기 → 보고서, print title ${printed} restored on afterprint`});});
  // 피드백 2: 이름표·작은 얼굴, '자료 ·' 머리말, 세 구역을 다 눌러도 화면이 움직이지 않음
  for(const vp of [DESKTOP,PHONE])await withPage(vp,async p=>{await p.goto(url,{waitUntil:'domcontentloaded'});await assets(p);
   assert.equal(await p.locator('.line').first().locator('.portrait').count(),0,'마을 사람들 has no portrait');
   await click(p,'[data-act="next"]');assert.deepEqual(await p.locator('.stage .name-tag').allInnerTexts(),['모아','루루','담이']);
   assert.deepEqual(await p.locator('.stage img.actor').evaluateAll(a=>a.map(i=>i.alt)),['모아','루루','담이'],'actor alt text kept');
   assert.equal(await p.locator('.line .portrait img').count(),2,'portraits next to 루루 and 담이');
   await click(p,'.step-nav [data-act="next"]');await click(p,'[data-act="item"][data-id="photo-original"]');await click(p,'[data-act="spot"][data-id="2"]');
   await click(p,'[data-act="item"][data-id="photo-rule"]');assert.equal((await p.locator('.visual .evidence-head').innerText()).replace(/\s+/g,' '),'자료 · AI의 자르기 기준');
   await click(p,'[data-act="region"][data-id="0"]');await click(p,'[data-act="region"][data-id="1"]');
   // 사진이 화면 맨 위에 오도록 내려 둔 상태에서 마지막 구역을 누른다
   await p.evaluate(()=>window.scrollTo(0,document.querySelector('.visual').getBoundingClientRect().top+scrollY-8));const y0=await p.evaluate(()=>scrollY);
   await p.locator('[data-act="region"][data-id="2"]').click();await p.waitForTimeout(400);const y1=await p.evaluate(()=>scrollY);
   assert.equal(y1,y0,`no auto-scroll after the third region (${vp.width}px)`);assert.equal(await p.locator('.cue').count(),1);assert.equal(await p.locator('.judge-card').count(),1);
   assert.equal(await p.locator('.judge-say cite .portrait').count(),1);
   results.checks.push({feedback2:`${vp.width}px: name tags + alt, portraits, 자료 header, scrollY ${y0}→${y1} after third region`});});
  await withPage(PHONE,async p=>{const errors=[];p.on('pageerror',e=>errors.push(String(e)));await p.goto(url);await click(p,'[data-act="next"]');await click(p,'.step-nav [data-act="next"]');
   assert.equal((await state(p)).scene,2);assert.match(await p.locator('#save-status').innerText(),/저장할 수 없어/);assert.deepEqual(errors,[]);results.checks.push({storageBlocked:'playable in current window with notice'});},
   ()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}});});
 }finally{await browser.close();server.close();}
 const before=fs.existsSync(path.join(__dirname,'readability-before.json'))?JSON.parse(fs.readFileSync(path.join(__dirname,'readability-before.json'),'utf8')):null;
 const sum=list=>({screens:list.length,avgChars:Math.round(list.reduce((a,x)=>a+x.chars,0)/list.length),maxChars:Math.max(...list.map(x=>x.chars)),maxButtons:Math.max(...list.map(x=>x.buttons))});
 const desk=results.readability.filter(x=>x.viewport==='1366x768');
 // 읽는 양: 화면마다 가장 많이 펼친 상태(…-done, -records, result 등)를 더한다. 같은 화면의 시작 상태는 겹치므로 뺀다.
 const readTotal=desk.filter(x=>!/check-start|follow-start|^end$/.test(x.screen)).reduce((a,x)=>a+x.chars,0);
 results.summary={after1366:sum(desk),originalBefore1366:before?sum(before.filter(x=>x.state==='done')):null,
  desktopQuestionAndFirstActionInView:desk.filter(x=>x.questionInView&&x.firstActionInView).length+'/'+desk.length,
  phoneMaxPageHeight:Math.max(...results.readability.filter(x=>x.viewport==='390x844').map(x=>x.pageHeight)),
  desktopPath:{judgments:results.paths[0].judgments,clicks:results.paths[0].clicks,readChars:readTotal}};
 fs.writeFileSync(path.join(__dirname,'flow-results.json'),JSON.stringify(results,null,1));
 console.log(JSON.stringify(results.summary,null,1));console.log('PASS paths',results.paths.length,'checks',results.checks.length);
})().catch(e=>{console.error(e);try{browser?.close();}catch{}server.close();process.exit(1);});
