const {chromium}=require('C:/Users/정벅/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),http=require('node:http');
const root=path.resolve(__dirname,'..'),KEY='ethicity.transparency.progress.v1';
const server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}if(file===root)file=path.join(root,'index.html');fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
const answers={2:{center:'right'},3:{rule:'P2',record:'P3',known:'known',unknown:'unknown'},6:{revision:'hesitate'},7:{'w-limit':'W2','draft-limit':'part'},10:{'link-alert':'F1','link-interpret':'F3','link-action':'F3',uncertainty:'limit'},11:{word:'certain',f1:'F1',f3:'F3'}};
// DOM probes dispatch real click events; keyboard operation is checked separately.
const click=(p,act,more='')=>p.locator(`button[data-act="${act}"]${more}`).first().evaluate(b=>{if(b.disabled)throw new Error('Attempt to click disabled '+b.dataset.act);b.click();});
async function readDialogue(p){while(await p.locator('[data-act="next-line"]:not(:disabled)').count())await click(p,'next-line');}
async function evidence(p){const ids=await p.locator('.work .evidence-nav [data-act="evidence"]').evaluateAll(a=>a.map(b=>b.dataset.id));for(const id of ids){await click(p,'evidence',`[data-id="${id}"]`);assert.equal(await p.locator('dialog').isVisible(),true);await click(p,'close');}}
async function answer(p,id,value){await click(p,'answer',`[data-task="${id}"][data-value="${value}"]`);}
async function play(browser,url,profile){
 const ctx=await browser.newContext({viewport:{width:profile==='help'?390:1440,height:1000}}),p=await ctx.newPage(),errors=[],external=[];p.on('pageerror',e=>errors.push(String(e)));p.on('request',r=>{if(!r.url().startsWith(url))external.push(r.url());});p.setDefaultTimeout(10000);await p.goto(url);await click(p,'start');
 for(let n=1;n<=13;n++){
  assert.equal(await p.evaluate(()=>TransparencyGame.getState().scene),n);
  await readDialogue(p);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow scene ${n}`);
  if([2,3,6,7,10,11].includes(n)){
   if([2,6,10].includes(n)){assert.equal(await p.locator('[data-act="next"]').isDisabled(),true);}
   await evidence(p);
   if(profile==='help'){await click(p,'help');await click(p,'accept-help');}
   else{
    if(n===2){await click(p,'compare');await click(p,'overlay');}
    if(n===6){await click(p,'move','[data-kind="order"][data-index="1"]');await click(p,'move','[data-kind="order"][data-index="2"]');await click(p,'check-order');await click(p,'why');}
    if(n===10){await click(p,'move','[data-kind="flow"][data-index="1"]');await click(p,'move','[data-kind="flow"][data-index="2"]');await click(p,'check-order');}
    if(profile==='trusting'){const wrong=await p.locator('[data-act="answer"]').evaluateAll(a=>{const b=a.find(b=>b.dataset.value!==b.dataset.answer);return b?{task:b.dataset.task,value:b.dataset.value}:null;});if(wrong){await answer(p,wrong.task,wrong.value);assert.equal(await p.evaluate(t=>!!TransparencyGame.getState().tasks[TransparencyGame.getState().scene+':'+t],wrong.task),false);}}
    for(const [id,value]of Object.entries(answers[n]||{}))await answer(p,id,value);
   }
  }
  if([4,8,12].includes(n)){
   const choice=profile==='careful'?{4:'manual',8:'review',12:'release'}[n]:profile==='trusting'?{4:'auto',8:'detector',12:'maintain'}[n]:{4:'dami',8:'draft',12:'crowd'}[n];
   await click(p,'choose',`[data-id="${choice}"]`);
   assert.equal(await p.locator('[data-act="confirm"]').isDisabled(),true);
   if(n===4&&choice==='manual')await click(p,'full-crop');
   if(profile==='help'){await click(p,'help');await click(p,'accept-help');}
   else if(n===8){await answer(p,'tool-question','tool');await answer(p,'process-question','process');}
   else await answer(p,'effect',n===4?(choice==='auto'?'explanation':'both'):(choice==='release'?'restriction':choice==='maintain'?'explanation':'audience'));
   await click(p,'confirm');
   if(n===12){assert.equal(await p.locator('.stage-status').textContent(),choice==='release'?'입장 제한 해제':'입장 제한 중');await p.screenshot({path:path.join(__dirname,`s12-${profile}.png`),fullPage:true});}
  }
  if(n===13){await click(p,'recommend','[data-id="unknown"]');if(profile==='help'){await click(p,'help');await click(p,'accept-help');}else await answer(p,'schedule','schedule');}
  assert.equal(await p.locator('[data-act="next"]').isEnabled(),true,`scene ${n} cannot advance (${profile})`);
  await click(p,'next');
 }
 const state=await p.evaluate(()=>TransparencyGame.getState());assert.equal(state.completed,true);assert.equal(state.cases.photo.help,profile==='help');assert.equal(errors.length,0,errors.join('\n'));assert.equal(external.length,0,external.join('\n'));
 await p.reload();assert.equal(await p.evaluate(()=>TransparencyGame.getState().completed),true);
 await p.screenshot({path:path.join(__dirname,`ending-${profile}.png`),fullPage:true});await ctx.close();return {profile,completed:true,help:state.cases.photo.help,choices:Object.fromEntries(Object.entries(state.cases).map(([k,c])=>[k,c.final])),errors,externalRequests:external.length};
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`;
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{const results=[];for(const profile of ['careful','trusting','help']){results.push(await play(browser,url,profile));console.log('PASS',profile);}
  const ctx=await browser.newContext();const p=await ctx.newPage();await p.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}}));await p.goto(url);await click(p,'start');assert.equal(await p.evaluate(()=>TransparencyGame.getState().scene),1);assert.match(await p.locator('#save-status').textContent(),/저장할 수 없어/);results.push({storageBlocked:'playable'});await ctx.close();
  const damaged=await browser.newPage();await damaged.goto(url);await damaged.evaluate(k=>{localStorage.setItem(k,'{broken');localStorage.setItem('ethicity.player',JSON.stringify({nickname:'<img src=x onerror=alert(1)>',character:'existing'}));},KEY);await damaged.reload();assert.equal(await damaged.evaluate(()=>TransparencyGame.getState().scene),0);assert.equal(await damaged.locator('#save-status img').count(),0);results.push({damagedStorage:'safe reset',player:'read-only, escaped'});await damaged.close();
  fs.writeFileSync(path.join(__dirname,'browser-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1)});
