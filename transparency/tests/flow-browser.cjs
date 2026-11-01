// 새 흐름(궁금한 것 → 직접 확인 → 선택 → 결과) 브라우저 검사. 실제 학생 실험이 아니라 헤드리스 Edge 클릭 프로브다.
// 실행: node tests/flow-browser.cjs   (브라우저는 한 번에 하나만 띄운다)
const PW=process.env.PLAYWRIGHT_PATH||'D:/Works/token_economy/node_modules/playwright';
const {chromium}=require(PW);
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),http=require('node:http'),E=require('../engine.js');
const root=path.resolve(__dirname,'..'),KEY='ethicity.transparency.progress.v1',shotDir=path.join(__dirname,'screens');
fs.mkdirSync(shotDir,{recursive:true});
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://x').pathname));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file===root?path.join(root,'index.html'):file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'})[path.extname(file)]||'text/html; charset=utf-8'});res.end(err?'missing':data);});});
const DESKTOP={width:1366,height:768},PHONE={width:390,height:844};
const results={paths:[],checks:[],readability:[]};
let browser,url;
const state=p=>p.evaluate(()=>TransparencyGame.getState());
const click=(p,sel)=>p.locator(sel).first().click();
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
 if(id==='photo-original'){if(wrongFirst){await click(p,'[data-act="spot"][data-id="1"]');assert.match(await p.locator('.tap-hint').innerText(),/루루/);}await click(p,'[data-act="spot"][data-id="2"]');assert.equal(await p.locator('.face-spot.found').count(),1);}
 if(id==='photo-rule'){for(const i of [0,1]){await click(p,`[data-act="region"][data-id="${i}"]`);}assert.equal(await p.locator('.center-dot').count(),0,'centre hidden until all regions opened');await click(p,'[data-act="region"][data-id="2"]');assert.match(await p.locator('.regions').innerText(),/오른쪽 8/);assert.equal(await p.locator('.center-dot').count(),1);}
 if(id==='writing-history'){if(wrongFirst){await click(p,'[data-act="record"][data-id="draft"]');assert.match(await p.locator('.tap-hint').innerText(),/초안/);}await click(p,'[data-act="record"][data-id="revision"]');}
 if(id==='face-clerk'){if(wrongFirst){await click(p,'[data-act="segment"][data-id="system"]');assert.match(await p.locator('.tap-hint').innerText(),/알림/);}await click(p,'[data-act="segment"][data-id="person"]');}
 assert.ok((await state(p)).evidence.includes(id),'checked '+id);
 assert.ok((await p.locator('.finding').count())>0,'finding shown for '+id);
}
async function play(p,{tag,viewport,pick,judge,wrongFirst,shots}){
 const errors=[],external=[];p.on('pageerror',e=>errors.push(String(e)));p.on('request',r=>{if(!r.url().startsWith(url))external.push(r.url());});
 await p.goto(url,{waitUntil:'domcontentloaded'});await assets(p);
 await measure(p,'intro',viewport);if(shots.includes('intro'))await shot(p,`${tag}-intro`,viewport===PHONE);
 await click(p,'[data-act="next"]');
 for(const k of E.CASES){
  assert.equal(E.stepOf((await state(p)).scene),'hook');await measure(p,k+'-hook',viewport);if(shots.includes(k+'-hook'))await shot(p,`${tag}-${k}-hook`,viewport===PHONE);
  await click(p,'.step-nav [data-act="next"]');
  await measure(p,k+'-check-start',viewport);
  assert.equal(await p.locator('.step-nav [data-act="next"]').isDisabled(),true,'cannot choose before checking');
  for(const id of E.checks[k])await discover(p,k,id,wrongFirst);
  assert.equal(await p.locator('.step-nav [data-act="next"]').isDisabled(),true,'judgment still needed');
  await click(p,`[data-act="judge"][data-id="${judge(k)}"]`);
  const fb=await p.locator('.judge .finding').innerText();assert.ok(fb.length>10);
  if(judge(k)!==E.answers[k])assert.match(fb,/자료(로|와)/,'wrong judgment feedback names the right category');
  await measure(p,k+'-check-done',viewport);if(shots.includes(k+'-check'))await shot(p,`${tag}-${k}-check`,viewport===PHONE);
  await click(p,'.step-nav [data-act="next"]');
  await measure(p,k+'-choose',viewport);if(shots.includes(k+'-choose'))await shot(p,`${tag}-${k}-choose`,viewport===PHONE);
  assert.equal(await p.locator('.body').innerText().then(t=>/결과|바꾸|계획/.test(t.replace('결과를 볼 수 있어',''))),false,'no plan text before choosing');
  await click(p,`[data-act="choose"][data-id="${pick[k]}"]`);
  const s=await state(p);assert.equal(E.stepOf(s.scene),'result');assert.equal(s.cases[k].final,pick[k]);
  await measure(p,k+'-result',viewport);
  if(k==='photo'){const crop=await p.locator('.stage-photo canvas').getAttribute('data-crop');assert.equal(crop,(pick.photo==='all'?E.ALL:E.AUTO).join(','));}
  if(k==='face'){assert.equal(await p.locator('.stage-status').innerText(),pick.face==='release'?'입장 제한 해제':'입장 제한 중');assert.equal(await p.locator('img.actor.clerkOpen').count(),pick.face==='release'?1:0);}
  if(k==='writing')assert.equal(await p.locator('.stage-status').innerText(),pick.writing==='detector'?'발표: 빠짐':'발표: 함');
  assert.match(await p.locator('.unknown').innerText(),/아직 모르는 점/);
  if(shots.includes(k+'-result'))await shot(p,`${tag}-${k}-result`,viewport===PHONE);
  await click(p,'.step-nav [data-act="next"]');
 }
 assert.equal((await state(p)).scene,13);await measure(p,'end',viewport);
 await click(p,'[data-act="ask"][data-id="criteria"]');assert.match(await p.locator('.ending-quote').innerText(),/질문이었다/);
 await measure(p,'end-done',viewport);if(shots.includes('end'))await shot(p,`${tag}-end`,viewport===PHONE);
 const s=await state(p);assert.equal(s.completed,true);
 await p.reload({waitUntil:'domcontentloaded'});assert.deepEqual(await state(p),s,'completed play survives reload');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 results.paths.push({tag,viewport:viewport.width+'x'+viewport.height,choices:s.cases,judgments:s.judgments,completed:s.completed,errors:errors.length,externalRequests:external.length});
}
async function withPage(viewport,fn,init){const ctx=await browser.newContext({viewport});if(init)await ctx.addInitScript(init);const p=await ctx.newPage();p.setDefaultTimeout(30000);try{return await fn(p);}finally{await ctx.close();}}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/`;
 browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  await withPage(DESKTOP,p=>play(p,{tag:'desktop',viewport:DESKTOP,pick:{photo:'all',writing:'review',face:'release'},judge:k=>E.answers[k],wrongFirst:false,shots:['intro','photo-hook','photo-check','photo-result','writing-check','face-check','face-result','end']}));
  await withPage(PHONE,p=>play(p,{tag:'phone',viewport:PHONE,pick:{photo:'auto',writing:'detector',face:'maintain'},judge:()=>'confirmed',wrongFirst:true,shots:['intro','photo-hook','photo-check','writing-choose','writing-result','face-check','end']}));
  // 저장·이어하기·다시 선택·처음부터
  await withPage(PHONE,async p=>{
   await p.goto(url,{waitUntil:'domcontentloaded'});await p.evaluate(()=>localStorage.setItem('ethicity.player',JSON.stringify({nickname:'테스트<b>'})));
   await click(p,'[data-act="next"]');await click(p,'.step-nav [data-act="next"]');await discover(p,'photo','photo-original',false);
   await p.reload({waitUntil:'domcontentloaded'});let s=await state(p);assert.equal(s.scene,2);assert.deepEqual(s.evidence,['photo-original']);
   assert.match(await p.locator('.resume').innerText(),/이어서/);assert.match(await p.locator('#save-status').innerText(),/테스트<b>/);
   await discover(p,'photo','photo-rule',false);await click(p,'[data-act="judge"][data-id="unknown"]');await click(p,'.step-nav [data-act="next"]');
   assert.equal(await p.locator('.resume').count(),0,'resume notice disappears after moving on');
   await click(p,'[data-act="choose"][data-id="auto"]');await click(p,'[data-act="rechoose"]');await click(p,'[data-act="choose"][data-id="all"]');
   s=await state(p);assert.deepEqual(s.cases.photo,{first:'auto',final:'all'});
   await click(p,'.step-nav [data-act="next"]');await p.reload({waitUntil:'domcontentloaded'});assert.equal((await state(p)).scene,5);
   await click(p,'header [data-act="notebook"]');const note=await p.locator('#modal-body').innerText();
   assert.match(note,/내가 고른 칸: 자료로는 알 수 없어/);await shot(p,'phone-notebook');assert.match(note,/처음 고른 것\s*자동으로 자른 사진/);assert.match(note,/마지막으로 고른 것\s*모두 나오는 사진/);
   await p.keyboard.press('Escape');assert.equal(await p.locator('dialog').isVisible(),false);
   await click(p,'header [data-act="settings"]');await click(p,'#modal-body [data-act="reset-ask"]');await click(p,'[data-act="reset"]');
   assert.equal((await state(p)).scene,0);assert.equal(JSON.parse(await p.evaluate(k=>localStorage.getItem(k),KEY)).scene,0);
   assert.equal(await p.evaluate(()=>localStorage.getItem('ethicity.player')),JSON.stringify({nickname:'테스트<b>'}),'shared player data untouched');
   results.checks.push({saveResume:'mid-check reload keeps scene+records; rechoose keeps first; notebook shows judgment/first/final; reset clears only this game'});
  });
  // 키보드만으로 확인 조작
  await withPage(DESKTOP,async p=>{let s=E.initial();s.scene=2;s.furthest=2;await p.goto(url);await p.evaluate(({KEY,s})=>localStorage.setItem(KEY,JSON.stringify(s)),{KEY,s});await p.reload();
   await p.locator('[data-act="item"][data-id="photo-rule"]').focus();await p.keyboard.press('Enter');
   for(const i of [0,1,2]){await p.locator(`[data-act="region"][data-id="${i}"]`).focus();await p.keyboard.press('Enter');}
   assert.ok((await state(p)).evidence.includes('photo-rule'));results.checks.push({keyboard:'item and region buttons operable with Enter'});});
  // 이전 판(revision 3) 저장 불러오기, 손상 저장, 저장 차단
  await withPage(DESKTOP,async p=>{const old={version:1,revision:3,scene:7,furthest:7,evidence:['P1','P2','P3','W1','W2'],tasks:{},claims:{},attempts:{},assistedScenes:[],cases:{photo:{first:'auto',final:'manual',pending:null,help:false},writing:{first:null,final:null,pending:null,help:false},face:{first:null,final:null,pending:null,help:false}},crop:[0,0,1536,1024],completed:false};
   await p.goto(url);await p.evaluate(({KEY,old})=>localStorage.setItem(KEY,JSON.stringify(old)),{KEY,old});await p.reload();const s=await state(p);
   assert.equal(s.scene,5);assert.equal(s.cases.photo.final,'all');assert.match(await p.locator('h1').innerText(),/의심 표시/);
   await p.evaluate(k=>localStorage.setItem(k,'{broken'),KEY);await p.reload();assert.equal((await state(p)).scene,0);
   results.checks.push({legacySave:'revision 3 S07 save opens writing case start, photo choice kept',corruptSave:'starts at prologue'});});
  await withPage(PHONE,async p=>{const errors=[];p.on('pageerror',e=>errors.push(String(e)));await p.goto(url);await click(p,'[data-act="next"]');await click(p,'.step-nav [data-act="next"]');
   assert.equal((await state(p)).scene,2);assert.match(await p.locator('#save-status').innerText(),/저장할 수 없어/);assert.deepEqual(errors,[]);results.checks.push({storageBlocked:'playable in current window with notice'});},
   ()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}});});
 }finally{await browser.close();server.close();}
 const before=fs.existsSync(path.join(__dirname,'readability-before.json'))?JSON.parse(fs.readFileSync(path.join(__dirname,'readability-before.json'),'utf8')):null;
 const sum=list=>({screens:list.length,avgChars:Math.round(list.reduce((a,x)=>a+x.chars,0)/list.length),maxChars:Math.max(...list.map(x=>x.chars)),maxButtons:Math.max(...list.map(x=>x.buttons))});
 const desk=results.readability.filter(x=>x.viewport==='1366x768');
 results.summary={after1366:sum(desk),before1366:before?sum(before.filter(x=>x.state==='done')):null,
  desktopQuestionAndFirstActionInView:desk.filter(x=>x.questionInView&&x.firstActionInView).length+'/'+desk.length,
  phoneMaxPageHeight:Math.max(...results.readability.filter(x=>x.viewport==='390x844').map(x=>x.pageHeight))};
 fs.writeFileSync(path.join(__dirname,'flow-results.json'),JSON.stringify(results,null,1));
 console.log(JSON.stringify(results.summary,null,1));console.log('PASS paths',results.paths.length,'checks',results.checks.length);
})().catch(e=>{console.error(e);try{browser?.close();}catch{}server.close();process.exit(1);});
