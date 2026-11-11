// 2026-11-10 외부 검토(review.md) 3·4·6번을 진짜 Edge(헤드리스, Playwright)에서 본다. 클릭이 아니라 키보드로 조작한다.
// 실행: node tests/review-1110-browser.cjs [focus] [text] [limit]   (아무것도 안 적으면 셋 다. 브라우저는 한 번에 하나만 띄운다)
// 스크린리더가 실제로 어떻게 읽는지는 보지 못한다(접근성 이름·역할·초점까지만).
'use strict';
const PW=process.env.PLAYWRIGHT_PATH||'D:/Works/token_economy/node_modules/playwright';
const {chromium}=require(PW);
const throughTitle=require('./through-title.cjs'); // 시작 화면에서 시작 버튼을 누른 뒤부터 본다
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),http=require('node:http'),E=require('../engine.js');
const D=(()=>{global.window={};require('../story.js');return global.window.TransparencyStory;})();
const root=path.resolve(__dirname,'..'),KEY='ethicity.transparency.progress.v1',shotDir=path.join(__dirname,'screens');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://x').pathname));
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 fs.readFile(file===root?path.join(root,'index.html'):file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':TYPES[path.extname(file)]||'text/html; charset=utf-8'});res.end(err?'missing':data);});
});
const want=process.argv.slice(2),run=name=>!want.length||want.includes(name);
const done=[],ok=m=>{done.push(m);console.log('ok  '+m);};

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
// prep(p) = 열기 전에 할 일(그림 막기 등)
async function withPage(viewport,state,fn,prep){
 const ctx=await browser.newContext({viewport});
 // 처음 한 번만 저장을 심는다(새로고침 뒤에는 게임이 저장한 것이 남아야 한다)
 if(state)await ctx.addInitScript(([k,v])=>{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem(k,v);}},[KEY,JSON.stringify(state)]);
 const p=throughTitle(await ctx.newPage()),errors=[];p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(String(e)));
 try{if(prep)await prep(p);await p.goto(url,{waitUntil:'domcontentloaded'});await p.waitForSelector('#app h1');const r=await fn(p);assert.deepEqual(errors,[],'page errors');return r;}
 finally{await ctx.close();}
}
const game=p=>p.evaluate(()=>TransparencyGame.getState());
const active=p=>p.evaluate(()=>{const a=document.activeElement;return a?{tag:a.tagName,...a.dataset,pressed:a.getAttribute('aria-pressed'),name:a.getAttribute('aria-label')||a.innerText}:null;});
// Tab을 눌러 조건에 맞는 요소까지 간다(초점 순서를 따라가므로 마우스·focus() 없이 닿을 수 있는지도 함께 본다)
async function tabTo(p,match,{back=false,max=80}={}){
 for(let i=0;i<max;i++){await p.keyboard.press(back?'Shift+Tab':'Tab');const a=await active(p);if(a&&match(a))return a;}
 assert.fail('Tab으로 닿지 못함');
}

// 4. 사진 후속 조사: ‘잘렸어’를 키보드로 누른 뒤 초점이 같은 버튼에 남고, Space를 거듭 눌러도 답이 바뀌지 않는다.
async function focusCheck(){
 await withPage({width:1280,height:800},stateAt('photo','follow'),async p=>{
  const isMark=(id,value)=>a=>a.act==='mark'&&a.id===id&&a.value===value;
  await tabTo(p,isMark('p1','cut'));
  await p.keyboard.press('Space');
  let a=await active(p);
  assert.deepEqual([a.act,a.id,a.value,a.pressed],['mark','p1','cut','true'],'초점이 누른 ‘잘렸어’에 남는다: '+JSON.stringify(a));
  assert.equal((await game(p)).follows.photo.marks.p1,'cut');
  for(let i=0;i<3;i++){await p.keyboard.press('Space');assert.equal((await game(p)).follows.photo.marks.p1,'cut','Space를 거듭 눌러도 그대로');}
  a=await active(p);assert.deepEqual([a.id,a.value,a.pressed],['p1','cut','true']);
  ok('사진 1 ‘잘렸어’ Space → 초점 그대로, Space 3번 더 눌러도 답 cut');
  // Tab은 화면 순서대로 다음 버튼(사진 2 ‘나왔어’)으로
  await p.keyboard.press('Tab');a=await active(p);assert.deepEqual([a.act,a.id,a.value],['mark','p2','shown'],'Tab → 사진 2 나왔어');
  await p.keyboard.press('Tab');a=await active(p);assert.deepEqual([a.id,a.value],['p2','cut']);
  await p.keyboard.press('Enter');a=await active(p);assert.deepEqual([a.id,a.value,a.pressed],['p2','cut','true'],'Enter도 같다');
  // 되돌아가 ‘나왔어’로 바꾸면 초점은 ‘나왔어’
  await p.keyboard.press('Shift+Tab');await p.keyboard.press('Space');a=await active(p);assert.deepEqual([a.id,a.value,a.pressed],['p2','shown','true']);
  assert.deepEqual((await game(p)).follows.photo.marks,{p1:'cut',p2:'shown'});
  ok('Tab 순서 사진 1 잘렸어 → 사진 2 나왔어 → 잘렸어, Enter·Shift+Tab 뒤에도 누른 버튼에 초점');
 });
}

// 6. 서술 칸: 진짜 입력(키보드 넣기·붙여넣기·새로고침)에서 화면 = 저장 = 다시 열었을 때, 넘는 글은 알린다.
const LONE=/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
async function limitCheck(){
 const MAX=E.TEXT_MAX,R=D.reflect,fill=s=>s.replace('{max}',MAX);
 await withPage({width:1280,height:800},stateAt('photo','reflect'),async p=>{
  await p.context().grantPermissions(['clipboard-read','clipboard-write']);
  const box=()=>p.evaluate(()=>{const t=document.querySelector('#reflect-q1'),q=t.closest('.write-q');
   return {value:t.value,count:q.querySelector('.count-n').textContent,note:q.querySelector('.limit-note').textContent,noteShown:!!q.querySelector('.limit-note').offsetParent,
    state:TransparencyGame.getState().reflections.photo.q1,stored:JSON.parse(localStorage.getItem('ethicity.transparency.progress.v1')).reflections.photo.q1,
    max:t.maxLength,desc:document.getElementById(t.getAttribute('aria-describedby'))?.innerText||''};});
  // 화면·상태·저장이 같고 글자 수 표시가 같은 단위인지
  const same=async(label,len)=>{const b=await box();assert.equal(b.value,b.state,label+': 화면 = 상태');assert.equal(b.value,b.stored,label+': 화면 = 저장');
   assert.equal(b.count,b.value.length+'자',label+': 글자 수');assert.doesNotMatch(b.value,LONE,label+': 반쪽 이모지 없음');if(len!==undefined)assert.equal(b.value.length,len,label+': 길이');return b;};
  const clear=async()=>{await p.keyboard.press('Control+A');await p.keyboard.press('Delete');};
  await tabTo(p,a=>a.tag==='TEXTAREA'&&a.reflect==='q1');
  let b=await box();assert.equal(b.max,MAX);assert.match(b.desc,new RegExp(MAX+'자까지 쓸 수 있어요'));
  await p.keyboard.type('짧은 글');b=await same('짧은 글',4);assert.equal(b.note,'');assert.equal(b.noteShown,false);
  ok('입력칸 maxlength '+MAX+', 설명 연결(aria-describedby)에 상한 안내, 짧은 글은 안내 없음');
  // 한글 3999 → 4000 → 4001
  await clear();await p.keyboard.insertText('가'.repeat(3999));b=await same('한글 3999',3999);assert.equal(b.note,'');
  await p.keyboard.insertText('나');b=await same('한글 4000',4000);assert.equal(b.note,fill(R.full));assert.equal(b.noteShown,true);
  await p.keyboard.insertText('다');b=await same('한글 4001번째',4000);assert.ok(b.value.endsWith('나'),'넘는 글자는 들어가지 않는다');assert.notEqual(b.note,'','넘쳤다고 알린다');
  const note4001=b.note;
  await p.keyboard.type('라');b=await same('꽉 찬 뒤 타자',4000);assert.notEqual(b.note,'');
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('#reflect-q1');b=await same('새로고침 뒤',4000);assert.equal(b.note,fill(R.full),'다시 열어도 꽉 찼다고 알린다');
  ok('한글 3999·4000·4001: 화면=상태=저장, 4000에서 안내 “'+fill(R.full)+'”, 4001번째는 안 들어가고 안내 “'+note4001+'”, 새로고침 뒤 4000자 그대로');
  // 지우면 안내가 사라진다
  await p.locator('#reflect-q1').focus();await p.keyboard.press('Control+End');await p.keyboard.press('Backspace');b=await same('하나 지움',3999);assert.equal(b.note,'');assert.equal(b.noteShown,false);
  // 이모지: 3999 + 😀(두 단위) → 반쪽을 남기지 않는다
  await p.keyboard.insertText('😀');b=await same('3999 + 이모지');assert.ok(b.value.length===3999||b.value.length===4000);assert.notEqual(b.note,'','이모지가 안 들어갔다고 알린다');
  const emojiLen=b.value.length;
  await clear();await p.keyboard.insertText('😀'.repeat(2000));b=await same('이모지 2000개',4000);assert.equal(b.note,fill(R.full));
  await p.keyboard.insertText('😀');b=await same('이모지 2001번째',4000);assert.notEqual(b.note,'');
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('#reflect-q1');b=await same('이모지 새로고침 뒤',4000);assert.equal(b.value,'😀'.repeat(2000));
  ok('이모지: 3999자 + 😀 → '+emojiLen+'자(반쪽 없음, 안내 있음), 😀×2000 = 4000자 그대로, 2001번째는 안 들어감, 새로고침 뒤 같음');
  // 붙여넣기: 5000자를 붙여 넣으면 4000자만 남고, 빠졌다고 알린다
  await p.locator('#reflect-q1').focus();await clear();
  await p.evaluate(t=>navigator.clipboard.writeText(t),'붙여 넣은 긴 글 '.repeat(500));
  await p.keyboard.press('Control+V');b=await same('5000자 붙여넣기',4000);assert.equal(b.note,fill(R.over),'넘는 글이 빠졌다고 알린다');assert.equal(b.noteShown,true);
  const noteColor=await p.evaluate(()=>getComputedStyle(document.querySelector('.limit-note')).color);
  await p.screenshot({path:path.join(shotDir,'review-limit-1280.png')});
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('#reflect-q1');b=await same('붙여넣기 새로고침 뒤',4000);
  // 앞에 글이 있을 때 넘치는 붙여넣기(가운데에 끼워 넣기)
  await p.locator('#reflect-q1').focus();await clear();await p.keyboard.insertText('가'.repeat(3990));await p.keyboard.press('Control+Home');
  await p.evaluate(t=>navigator.clipboard.writeText(t),'나'.repeat(30));await p.keyboard.press('Control+V');
  b=await same('3990자 앞에 30자 붙여넣기',4000);assert.equal(b.note,fill(R.over));assert.ok(b.value.startsWith('나'.repeat(10)+'가'),'들어갈 수 있는 10자만 들어간다: '+b.value.slice(0,14));
  ok('붙여넣기 5000자 → 4000자 + 안내 “'+fill(R.over)+'”(글자색 '+noteColor+'), 새로고침 뒤 같음, 가운데 끼워 넣기도 같음');
  // maxlength를 거치지 않는 넣기(스크립트·자동 채우기): 화면 코드가 같은 길이로 맞춘다
  await p.locator('#reflect-q1').fill('가'.repeat(4001));b=await same('스크립트로 4001자',4000);assert.equal(b.note,fill(R.over));
  await p.locator('#reflect-q1').fill('가'.repeat(3999)+'😀');b=await same('스크립트로 3999 + 이모지',3999);assert.equal(b.note,fill(R.over));
  await p.locator('#reflect-q1').fill('내 생각 😀');b=await same('짧게 고침',7);assert.equal(b.note,'');
  ok('maxlength를 거치지 않는 입력(4001자, 3999자+이모지)도 화면에서 같은 길이로 잘리고 알림');
 });
 // 마지막 서술 칸
 const end=stateAt('share','reflect');
 await withPage({width:390,height:844},E.reduce(end,{type:'next'}),async p=>{
  const t=p.locator('#final-note');assert.equal(await t.getAttribute('maxlength'),String(MAX));
  await t.focus();await p.keyboard.insertText('가'.repeat(4000));await p.keyboard.insertText('나');
  const r=await p.evaluate(()=>({value:document.querySelector('#final-note').value,state:TransparencyGame.getState().finalNote,note:document.querySelector('.limit-note').textContent,
   overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.equal(r.value.length,4000);assert.equal(r.value,r.state);assert.notEqual(r.note,'');assert.equal(r.overflow,false,'390px에서 가로 넘침 없음');
  ok('마지막 서술 칸(390×844)도 4000자에서 멈추고 알림, 가로 넘침 없음');
 });
}

// 3. 사진 활동: 그림을 하나도 받지 못하게 막아 두고(사진이 보이지 않는 상태), 글 설명·접근성 이름과 키보드만으로 원본 찾기와 여섯 장 표시를 마친다.
//    판단은 화면에서 읽은 글로만 한다(검사 코드가 좌표나 정답을 보고 누르지 않는다). 마지막에 그림을 켠 화면을 캡처한다.
const noImages=p=>p.route(/\.(webp|png|jpg)(\?.*)?$/,r=>r.abort());
const painted=p=>p.waitForFunction(()=>{const c=document.querySelector('canvas[data-crop]');return !!c&&c.getContext('2d').getImageData(20,20,1,1).data[3]>0;});
async function textCheck(){
 // (가) 원본에서 담이 찾기
 await withPage({width:1280,height:800},stateAt('photo','check'),async p=>{
  await tabTo(p,a=>a.act==='item'&&a.id==='photo-original');await p.keyboard.press('Enter');
  assert.equal(await p.getByRole('img',{name:/원본 사진.*사진을 글로 살펴보기/}).count(),1,'그림 설명이 글 설명이 있는 곳을 알려 준다');
  // 자료 칸은 본문보다 앞에 있다: Shift+Tab으로 ‘사진을 글로 살펴보기’까지 되돌아가 Enter로 편다
  let a=await tabTo(p,x=>x.tag==='SUMMARY',{back:true});assert.equal(a.name.trim(),'사진을 글로 살펴보기');
  await p.keyboard.press('Enter');
  const box=p.locator('details.photo-text[data-text="original"]');assert.equal(await box.evaluate(d=>d.open),true);
  const text=(await box.innerText()).replace(/\s+/g,' ');
  const where=/담이: (왼쪽에서 [^.]+)\./.exec(text);assert.ok(where,'글 설명에 담이 자리가 있다: '+text);
  const names=await p.getByRole('button',{name:/^얼굴 \d/}).evaluateAll(b=>b.map(x=>x.getAttribute('aria-label')));
  assert.equal(names.length,5);assert.equal(new Set(names).size,5);for(const n of names)assert.doesNotMatch(n,/토리|루루|담이|모아|몽이/,'버튼 이름은 자리만 말한다');
  assert.equal(await p.getByRole('button',{name:new RegExp(where[1])}).count(),1,'그 자리의 버튼은 하나');
  a=await tabTo(p,x=>x.act==='spot'&&x.name.includes(where[1]),{back:true});
  await p.keyboard.press('Space');
  assert.ok((await game(p)).evidence.includes('photo-original'),'글 설명과 키보드만으로 담이를 찾았다');
  a=await active(p);assert.equal(a.act,'spot');assert.match(a.name,/찾았어: 담이/);
  assert.equal(await box.evaluate(d=>d.open),true,'다시 그린 뒤에도 글 설명이 펼쳐져 있다');
  assert.match(text,/점선 틀\(자동으로 남긴 부분\)은 원본의 오른쪽 위 부분이다\. 틀 안에 온전히 있는 얼굴: 몽이\. 틀 가장자리에 걸린 얼굴: 모아\(틀의 왼쪽 가장자리\)\. 틀 밖에 있는 얼굴: 토리, 루루, 담이\./);
  ok('그림 없이 원본 찾기: Shift+Tab → ‘사진을 글로 살펴보기’ Enter → “담이: '+where[1]+'” → 그 자리 버튼(“'+names[2]+'”) Space → 확인됨, 글 설명은 펼친 채');
 },noImages);
 // (나) 여섯 장 표시
 await withPage({width:1280,height:800},stateAt('photo','follow'),async p=>{
  const picked=[];
  for(let i=1;i<=6;i++){
   const img=p.getByRole('img',{name:new RegExp('^사진 '+i+'\\.')});assert.equal(await img.count(),1,'사진 '+i+'의 그림 이름');
   const name=await img.getAttribute('aria-label');
   assert.doesNotMatch(name,/잘렸|나왔/,'그림 이름이 답을 말하지 않는다');
   // 읽은 글로 판단한다: 온전히 보이는 얼굴에 담이가 있으면 ‘나왔어’, 아니면 ‘잘렸어’
   const whole=(/온전히 보이는 얼굴: ([^.(]+)/.exec(name)||[,''])[1].split(', ');
   const value=whole.includes('담이')?'shown':'cut';picked.push(value);
   const a=await tabTo(p,x=>x.act==='mark'&&x.id==='p'+i&&x.value===value);
   await p.keyboard.press('Space');
   const b=await active(p);assert.deepEqual([b.id,b.value,b.pressed],['p'+i,value,'true']);
  }
  const marks=(await game(p)).follows.photo.marks;
  assert.deepEqual(E.followMarks.photo.ids.map(id=>marks[id]),E.truth,'글 설명만으로 한 표시가 기록과 같다');
  assert.equal(await p.locator('.finding').innerText().then(t=>/네 표시는 기록과 같아/.test(t)),true);
  // 여섯 장 뒤에 글 설명이 있다: Tab → Enter로 펴고, 표시를 바꿔도(다시 그려도) 펼쳐져 있다
  const a=await tabTo(p,x=>x.tag==='SUMMARY');assert.equal(a.name.trim(),'사진을 글로 살펴보기');await p.keyboard.press('Enter');
  const box=p.locator('details.photo-text[data-text="follow"]');assert.equal(await box.evaluate(d=>d.open),true);
  const text=(await box.innerText()).replace(/\s+/g,' ');
  for(let i=1;i<=6;i++)assert.ok(text.includes('사진 '+i+': 원본의 '),'글 설명에 사진 '+i);
  assert.ok(text.includes('이름이 없는 친구는 그 사진에 보이지 않는다.'));
  await tabTo(p,x=>x.act==='mark'&&x.id==='p6'&&x.value==='shown',{back:true});await p.keyboard.press('Space');
  assert.equal(await box.evaluate(d=>d.open),true,'표시한 뒤에도 글 설명이 펼쳐져 있다');
  ok('그림 없이 여섯 장 표시: 그림 이름만 읽고 고른 답 '+picked.join(',')+' = 기록, 글 설명은 Tab으로 닿고 다시 그려도 펼친 채');
 },noImages);
 // (다) 그림을 켠 화면: 캡처(사람이 직접 본다), 좁은 화면 가로 넘침·누르는 곳 높이
 await withPage({width:1280,height:800},stateAt('photo','follow'),async p=>{
  await painted(p);await p.locator('details.photo-text summary').click();
  await p.screenshot({path:path.join(shotDir,'review-photo-text-1280.png'),fullPage:true});
 });
 await withPage({width:1280,height:800},stateAt('photo','check'),async p=>{
  await p.locator('[data-act="item"][data-id="photo-original"]').click();await p.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
  await p.locator('details.photo-text summary').click();
  await p.screenshot({path:path.join(shotDir,'review-photo-original-1280.png'),fullPage:true});
 });
 await withPage({width:390,height:844},stateAt('photo','follow'),async p=>{
  await painted(p);
  const closed=await p.evaluate(()=>({h:document.querySelector('details.photo-text summary').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.ok(closed.h>=44,'‘사진을 글로 살펴보기’ 누르는 곳 높이 '+closed.h);assert.equal(closed.overflow,false);
  await p.locator('details.photo-text summary').click();
  const opened=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,font:parseFloat(getComputedStyle(document.querySelector('.photo-text li')).fontSize)}));
  assert.equal(opened.overflow,false,'390px에서 펼쳐도 가로 넘침 없음');assert.ok(opened.font>=16,'글자 '+opened.font+'px');
  await p.screenshot({path:path.join(shotDir,'review-photo-text-390.png'),fullPage:true});
  ok('그림 켠 화면 캡처 3장(review-photo-text-1280·390, review-photo-original-1280), 390px 가로 넘침 없음, 접힌 줄 높이 '+Math.round(closed.h)+'px, 글자 '+opened.font+'px');
 });
}

(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}/`;
 browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  if(run('focus'))await focusCheck();
  if(run('text'))await textCheck();
  if(run('limit'))await limitCheck();
 }finally{await browser.close();server.close();}
 console.log('PASS review-1110 checks',done.length);
})().catch(e=>{console.error(e);try{browser?.close();}catch{}server.close();process.exit(1);});
