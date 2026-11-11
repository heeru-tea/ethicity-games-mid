// 시작 화면(2026-11-11) 브라우저 검사 — 진짜 Edge(헤드리스, Playwright).
// 실행: node tests/title-browser.cjs [sizes] [flow] [edge]   (아무것도 안 적으면 셋 다. 브라우저는 한 번에 하나만 띄운다)
//  sizes = 다섯 화면 크기 × 저장 없음/있음: 으뜸 버튼이 스크롤 없이 첫 화면 안, 가로 넘침 없음, 버튼 구성, 모아 얼굴이 판에 가리지 않음 + 캡처(tests/screens/title-*.png)
//  flow  = 키보드로 시작, 설정 → 시작 화면으로, 이어하기 글, 처음부터 하기(취소·지우기), 새로고침하면 다시 시작 화면, 저장 형식 그대로
//  edge  = 움직임 줄이기, 미리보기(?preview=s01)는 건너뜀, 저장 차단, file://로 열기
// 실제 학생 실험이 아니고, 스크린리더가 읽는 소리는 보지 못한다.
'use strict';
const PW=process.env.PLAYWRIGHT_PATH||'D:/Works/token_economy/node_modules/playwright';
const {chromium}=require(PW);
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),http=require('node:http'),{pathToFileURL}=require('node:url'),E=require('../engine.js');
const D=(()=>{global.window={};require('../story.js');return global.window.TransparencyStory;})(),T=D.title;
const root=path.resolve(__dirname,'..'),KEY='ethicity.transparency.progress.v1',shotDir=path.join(__dirname,'screens');
fs.mkdirSync(shotDir,{recursive:true});
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://x').pathname));
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 fs.readFile(file===root?path.join(root,'index.html'):file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':TYPES[path.extname(file)]||'text/html; charset=utf-8'});res.end(err?'missing':data);});
});
const want=process.argv.slice(2),run=name=>!want.length||want.includes(name);
const done=[],ok=m=>{done.push(m);console.log('ok  '+m);};
const SIZES=[[1280,800],[1148,977],[820,1180],[390,844],[780,360]];

// 정답대로 걸어가 그 사건의 그 단계 화면에 선 저장
function stateAt(key,step){
 let s=E.initial();const goal=E.sceneOf(key,step);
 while(s.scene<goal){const k=E.caseKey(s.scene),st=E.stepOf(s.scene);
  if(st==='hook'&&k==='camp')s=E.reduce(s,{type:'ask',id:'who'});
  if(st==='check'){for(const id of E.checks[k])s=E.reduce(s,{type:'check',id});for(const a of E.answers[k])s=E.reduce(s,{type:'judge',stamp:a});}
  if(st==='choose'){s=E.reduce(s,{type:'choose',id:E.choices[k][0]});continue;}
  if(st==='follow'){const m=E.followMarks[k];m.ids.forEach((id,i)=>{s=E.reduce(s,{type:'mark',id,value:k==='photo'?E.truth[i]:m.values[0]});});s=E.reduce(s,{type:'follow-judge',stamp:E.followAnswers[k]});}
  if(st==='notice'){for(const id of E.noticeCards[k].must)s=E.reduce(s,{type:'notice-pick',id});s=E.reduce(s,{type:'notice-post'});}
  s=E.reduce(s,{type:'next'});}
 return s;
}
let browser,url;
// state = 처음 한 번만 심는 저장(새로고침 뒤에는 게임이 저장한 것이 남는다). opts = 브라우저 문맥 설정(reducedMotion 등), init = 열기 전에 넣을 코드
async function withPage(viewport,state,fn,{opts={},init,address}={}){
 const ctx=await browser.newContext({viewport,...opts});
 if(state)await ctx.addInitScript(([k,v])=>{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem(k,v);}},[KEY,JSON.stringify(state)]);
 if(init)await ctx.addInitScript(init);
 const p=await ctx.newPage(),errors=[],failed=[];p.setDefaultTimeout(20000);
 p.on('pageerror',e=>errors.push(String(e)));p.on('requestfailed',r=>failed.push(r.url()));p.on('response',r=>{if(r.status()>=400)failed.push(r.status()+' '+r.url());});
 try{await p.goto(address||url,{waitUntil:'load'});await p.waitForSelector('#app h1');const r=await fn(p);assert.deepEqual(errors,[],'page errors');assert.deepEqual(failed,[],'failed requests');return r;}
 finally{await ctx.close();}
}
const game=p=>p.evaluate(()=>TransparencyGame.getState());
const stored=p=>p.evaluate(k=>localStorage.getItem(k),KEY);
const active=p=>p.evaluate(()=>{const a=document.activeElement;return a?{tag:a.tagName,act:a.dataset.act||null,text:(a.innerText||'').trim()}:null;});
const atTitle=p=>p.evaluate(()=>document.querySelector('#app').className==='at-title'&&!!document.querySelector('#app .title'));
async function settle(p){
 await p.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:30000});
 // 시작 화면 그림은 SVG 안의 image라 document.images에 없다: 같은 주소를 따로 불러 다 열린 뒤 한 박자 기다린다
 await p.evaluate(()=>Promise.all([...new Set([...document.querySelectorAll('.title-scene image')].map(i=>i.href.baseVal))].map(src=>{const im=new Image();im.src=src;return im.decode();})).then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))));
 // 판이 떠오르는 연출(한 번, 0.36초)이 끝난 뒤에 잰다
 await p.waitForFunction(()=>document.getAnimations().every(a=>a.playState==='finished'),null,{timeout:5000});
}
// 시작 화면 한 장을 잰다
const measure=p=>p.evaluate(()=>{
 const q=s=>document.querySelector(s),r=el=>{const b=el.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:b.width,height:b.height};};
 const vis=el=>!!el&&getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0;
 const inView=b=>b.top>=0&&b.left>=0&&b.bottom<=innerHeight+.5&&b.right<=innerWidth+.5;
 const scenes=[...document.querySelectorAll('.title-scene')].filter(vis),scene=scenes[0];
 const main=q('#app .title-actions .primary'),again=q('#app .title-actions [data-act="reset-ask"]'),h1=q('#app h1'),moa=scene.querySelector('.title-moa'),panel=q('.title-panel'),art=q('.title-art'),bg=scene.querySelector('.title-bg'),boxes=scene.querySelector('.title-boxes');
 const m=r(moa),P=r(panel),A=r(art),B=r(boxes);
 // 모아 얼굴 가운데(전신 그림의 가로 54% · 세로 12%)와 가운데 상자의 가운데
 const face={x:m.left+m.width*.54,y:m.top+m.height*.12},box={x:B.left+B.width*.5,y:B.top+B.height*.6};
 const clear=pt=>pt.x>=A.left&&pt.x<=A.right&&pt.y>=A.top&&pt.y<=A.bottom&&pt.x>=0&&pt.x<=innerWidth&&pt.y>=0&&pt.y<=innerHeight&&!(pt.x>=P.left&&pt.x<=P.right&&pt.y>=P.top&&pt.y<=P.bottom);
 return {scrollY,overflow:document.documentElement.scrollWidth-innerWidth,pageHeight:document.documentElement.scrollHeight,viewport:[innerWidth,innerHeight],
  h1:{text:h1.innerText,count:document.querySelectorAll('h1').length,inView:inView(r(h1)),tag:h1.tagName},
  main:{tag:main.tagName,text:main.innerText.replace(/\s+/g,' ').trim(),inView:inView(r(main)),height:r(main).height,font:parseFloat(getComputedStyle(main).fontSize)},
  again:again?{tag:again.tagName,text:again.innerText.trim(),inView:inView(r(again)),height:r(again).height}:null,
  header:getComputedStyle(q('body>header')).display,
  scenes:scenes.length,sceneCls:scene.getAttribute('class'),role:scene.getAttribute('role'),alt:scene.getAttribute('aria-label'),images:[...scene.querySelectorAll('image')].map(i=>i.href.baseVal),htmlImages:document.querySelectorAll('#app img').length,
  faceClear:clear(face),boxClear:clear(box),rects:{art:[A.left,A.top,A.width,A.height].map(Math.round),panel:[P.left,P.top,P.width,P.height].map(Math.round),moa:[m.left,m.top,m.width,m.height].map(Math.round)},
  shown:{hook:vis(q('.title-hook')),lead:vis(q('.title-lead')),facts:vis(q('.title-facts')),peek:vis(q('.title-peek')),keys:vis(q('.title-keys'))},
  panelText:panel.innerText,smallest:Math.min(...[...panel.querySelectorAll('p,li,span,figcaption,h1')].filter(vis).map(e=>parseFloat(getComputedStyle(e).fontSize)))};
});

// 다섯 크기 × 저장 없음/있음
async function sizes(){
 const save=stateAt('writing','check'),from='사건 2 · 글 검사 · 직접 확인'+T.from;
 for(const [w,h] of SIZES)for(const [tag,state] of [['new',null],['save',save]]){
  await withPage({width:w,height:h},state,async p=>{
   await settle(p);
   assert.equal(await atTitle(p),true,'시작 화면이 먼저 나온다');
   const m=await measure(p),at=`${w}x${h} ${tag}`;
   await p.screenshot({path:path.join(shotDir,`title-${w}x${h}-${tag}.png`)});
   // SHOTS_ONLY=1: 캡처와 잰 값만 남기고 넘어간다(배치를 고치는 동안 쓴다)
   if(process.env.SHOTS_ONLY==='1'){console.log(at,JSON.stringify({...m,panelText:undefined,alt:undefined}));return;}
   assert.equal(m.scrollY,0,at);
   assert.ok(m.overflow<=0,at+': 가로 넘침 '+m.overflow+'px');
   assert.deepEqual([m.h1.tag,m.h1.count,m.h1.text],['H1',1,D.report.game],at+': 제목은 h1 하나');
   assert.equal(m.h1.inView,true,at+': 제목이 첫 화면 안');
   assert.equal(m.main.tag,'BUTTON',at);assert.equal(m.main.inView,true,at+': 으뜸 버튼이 스크롤 없이 첫 화면 안');
   assert.ok(m.main.height>=44,at+': 누르는 곳 '+m.main.height);assert.ok(m.main.font>=16,at+': 버튼 글자 '+m.main.font);
   if(state){
    assert.equal(m.main.text,T.resume+' '+from,at+': 이어하기 + 어디부터');
    assert.ok(m.again,at+': 처음부터 하기');assert.deepEqual([m.again.tag,m.again.text,m.again.inView],['BUTTON',T.restart,true],at+': 처음부터 하기도 첫 화면 안');assert.ok(m.again.height>=44,at);
   }else{
    assert.equal(m.main.text,T.start,at+': 게임 시작하기');assert.equal(m.again,null,at+': 저장이 없으면 처음부터 하기 없음');
   }
   assert.equal(m.header,'none',at+': 시작 화면에서는 게임 메뉴(수첩·설정)를 숨긴다');
   assert.deepEqual([m.scenes,m.role,m.alt],[1,'img',T.art],at+': 그림 묶음은 하나만 보이고 대체 글이 있다');
   assert.equal(m.sceneCls,'title-scene '+(w/h>=1.5&&w>=560?'fit-wide':'fit-tall'),at+': 배치에 맞는 맞춤');
   assert.deepEqual([...new Set(m.images)].sort(),[D.art.backgrounds[0],D.art.moa,D.art.props].sort(),at+': 기존 그림 세 장만 쓴다');assert.equal(m.htmlImages,0);
   assert.equal(m.faceClear,true,at+': 모아 얼굴이 그림 칸 안에 보이고 판에 가리지 않음');
   assert.equal(m.boxClear,true,at+': 검은 상자가 그림 칸 안에 보이고 판에 가리지 않음');
   assert.equal(m.shown.lead,true,at+': 무슨 게임인지 한 줄은 늘 보인다');
   assert.ok(m.smallest>=13,at+': 가장 작은 글자 '+m.smallest+'px');
   ok(`${at}: 버튼 첫 화면 안(높이 ${Math.round(m.main.height)}px) · 가로 넘침 없음 · 쪽 높이 ${m.pageHeight}px · 보이는 것 ${Object.entries(m.shown).filter(x=>x[1]).map(x=>x[0]).join('/')}`);
  });
 }
}

// 키보드로 시작 → 게임 안에서 시작 화면으로 → 이어하기 → 처음부터 하기
async function flow(){
 await withPage({width:1280,height:800},null,async p=>{
  await settle(p);
  const fresh=JSON.parse(await stored(p));
  assert.deepEqual(Object.keys(fresh).sort(),Object.keys(E.initial()).sort(),'저장 형식은 그대로(시작 화면을 봤는지는 저장하지 않는다)');assert.equal(fresh.version,6);
  // Tab으로 버튼까지 가서 Enter
  let tabs=0,a;do{await p.keyboard.press('Tab');tabs++;a=await active(p);}while(!(a&&a.act==='start')&&tabs<6);
  assert.equal(a.act,'start','Tab으로 시작 버튼에 닿는다');assert.ok(tabs<=2,'Tab '+tabs+'번');
  await p.keyboard.press('Enter');
  assert.equal(await atTitle(p),false);assert.equal(await p.locator('#app').getAttribute('class'),'step-intro');
  assert.equal(await p.locator('#app h1').innerText(),D.intro.title,'지금의 첫 화면(프롤로그)으로 들어간다');
  assert.equal((await active(p)).tag,'H1','들어가면 초점은 그 화면 제목');
  assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('body>header')).display)!=='none',true,'게임 안에서는 메뉴가 보인다');
  assert.deepEqual(await game(p),fresh,'시작하기는 진행을 바꾸지 않는다');
  ok('키보드: Tab '+tabs+'번 → Enter → 프롤로그, 초점은 제목, 저장 그대로');
  // 설정 → 시작 화면으로(키보드)
  await p.locator('header [data-act="settings"]').focus();await p.keyboard.press('Enter');
  await p.locator('#modal [data-act="title"]').focus();assert.equal(await p.locator('#modal [data-act="title"]').innerText(),T.back);await p.keyboard.press('Enter');
  assert.equal(await atTitle(p),true,'설정에서 시작 화면으로 돌아간다');assert.equal(await p.evaluate(()=>document.querySelector('#modal').open),false);
  await p.waitForFunction(()=>document.activeElement&&document.activeElement.tagName==='H1');
  assert.equal(await p.locator('.title-actions .primary').innerText(),T.start,'아직 프롤로그라 게임 시작하기');
  ok('설정 → 시작 화면으로: 창 닫힘, 초점은 시작 화면 제목');
  // 사건 1 직접 확인까지 간 뒤 다시 시작 화면
  await p.locator('[data-act="start"]').click();await p.locator('.step-nav [data-act="next"]').click();await p.locator('.step-nav [data-act="next"]').click();
  const mid=await game(p);assert.equal(E.stepOf(mid.scene),'check');
  await p.locator('header [data-act="settings"]').click();await p.locator('#modal [data-act="title"]').click();
  assert.equal((await p.locator('.title-actions .primary').innerText()).replace(/\s+/g,' '),T.resume+' 사건 1 · 사진 · 직접 확인'+T.from);
  // 처음부터 하기 → 취소: 그대로 시작 화면, 초점은 누른 버튼
  await p.locator('.title-actions [data-act="reset-ask"]').focus();await p.keyboard.press('Enter');
  assert.equal(await p.locator('#modal-title').innerText(),'처음부터 다시 하기','기존 확인 절차 그대로');
  await p.locator('#modal [data-act="close"]').last().click();
  assert.equal(await atTitle(p),true);await p.waitForFunction(()=>document.activeElement?.dataset?.act==='reset-ask');
  assert.deepEqual(await game(p),mid,'취소하면 진행 그대로');
  // 이어하기 → 하던 화면
  await p.locator('[data-act="start"]').click();assert.equal(await p.locator('#app').getAttribute('class'),'step-check');assert.deepEqual(await game(p),mid);
  // 새로고침: 다시 시작 화면(열 때마다), 이어하기를 누르면 저장된 곳 + 기존 안내
  await p.reload({waitUntil:'load'});await p.waitForSelector('#app h1');
  assert.equal(await atTitle(p),true,'다시 열면 시작 화면부터');assert.deepEqual(await game(p),mid);
  await p.locator('[data-act="start"]').click();
  assert.match(await p.locator('.resume').innerText(),/저장된 곳부터 이어서 해요/,'이어 하면 기존 안내가 그대로 보인다');assert.equal((await game(p)).scene,mid.scene);
  // 다시 시작 화면 → 처음부터 하기 → 지우고 처음부터: 프롤로그, 저장도 처음 상태
  await p.locator('header [data-act="settings"]').click();await p.locator('#modal [data-act="title"]').click();
  await p.locator('.title-actions [data-act="reset-ask"]').click();await p.locator('#modal [data-act="reset"]').click();
  assert.equal(await atTitle(p),false);assert.equal(await p.locator('#app h1').innerText(),D.intro.title);
  assert.deepEqual(JSON.parse(await stored(p)),E.initial(),'지우면 처음 상태로 저장');
  ok('이어하기 글·처음부터 하기(취소/지우기)·새로고침 뒤 다시 시작 화면·이어 하면 기존 안내');
 });
}

async function edge(){
 // 움직임 줄이기: 연출 없음
 await withPage({width:1280,height:800},null,async p=>{
  const a=await p.evaluate(()=>({name:getComputedStyle(document.querySelector('.title-panel')).animationName,n:document.getAnimations().length,opacity:getComputedStyle(document.querySelector('.title-panel')).opacity}));
  assert.deepEqual(a,{name:'none',n:0,opacity:'1'},'움직임 줄이기에서는 연출이 없다');
  ok('움직임 줄이기: 연출 없음');
 },{opts:{reducedMotion:'reduce'}});
 // 보통 설정: 연출은 하나, 한 번, 짧게
 await withPage({width:1280,height:800},null,async p=>{
  const a=await p.evaluate(()=>{const s=getComputedStyle(document.querySelector('.title-panel'));return {name:s.animationName,count:s.animationIterationCount,sec:parseFloat(s.animationDuration),all:[...document.querySelectorAll('#app *')].filter(e=>getComputedStyle(e).animationName!=='none').length};});
  assert.deepEqual([a.name,a.count,a.all],['title-in','1',1]);assert.ok(a.sec<=.5,'연출 '+a.sec+'초');
  ok('연출: 판 하나 · 한 번 · '+a.sec+'초');
 });
 // 미리보기는 시작 화면을 건너뛴다(저장 안 함)
 await withPage({width:1280,height:800},null,async p=>{
  assert.equal(await atTitle(p),false);assert.equal((await game(p)).scene,1);
  ok('?preview=s01: 시작 화면 없이 사건 1');
 },{address:url+'?preview=s01'});
 // 저장이 막혀도 시작 화면에서 시작할 수 있다
 await withPage({width:390,height:844},null,async p=>{
  assert.equal(await atTitle(p),true);assert.equal(await p.locator('.title-actions .primary').innerText(),T.start);
  await p.locator('[data-act="start"]').click();assert.equal(await p.locator('#app h1').innerText(),D.intro.title);
  assert.match(await p.locator('#save-status').innerText(),/저장할 수 없어/);
  ok('저장 차단: 시작 화면 → 게임 시작하기 → 프롤로그');
 },{init:()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}});}});
 // file://로 열어도 된다
 await withPage({width:1280,height:800},null,async p=>{
  await settle(p);assert.equal(await atTitle(p),true);
  const m=await measure(p);assert.equal(m.main.inView,true);assert.equal(m.scenes,1);assert.equal(m.faceClear,true);
  await p.locator('[data-act="start"]').click();assert.equal(await p.locator('#app h1').innerText(),D.intro.title);
  ok('file://: 시작 화면·그림·게임 시작하기');
 },{address:pathToFileURL(path.join(root,'index.html')).href});
}

(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/`;
 browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  if(run('sizes'))await sizes();
  if(run('flow'))await flow();
  if(run('edge'))await edge();
 }finally{await browser.close();server.close();}
 console.log('PASS title checks',done.length);
})().catch(e=>{console.error(e);try{browser?.close();}catch{}server.close();process.exit(1);});
