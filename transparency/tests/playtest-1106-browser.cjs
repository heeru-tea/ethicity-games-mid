// 2026-11-06 플레이테스트 지시서 확인(헤드리스 Edge). 판단 문장마다 근거 자료가 같이 보이는지, 오답 표시, 키보드, 기존 저장, 칩 대비.
// 실행: node tests/playtest-1106-browser.cjs   (SHOT_DIR에 스크린샷)
const PW=process.env.PLAYWRIGHT_PATH||'D:/Works/token_economy/node_modules/playwright';
const {chromium}=require(PW);
const throughTitle=require('./through-title.cjs'); // 시작 화면에서 시작 버튼을 누른 뒤부터 본다
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),http=require('node:http'),E=require('../engine.js');
const root=path.resolve(__dirname,'..'),KEY='ethicity.transparency.progress.v1',shotDir=process.env.SHOT_DIR||path.join(__dirname,'screens');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://x').pathname));fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(b);});});
const D=(()=>{global.window={};require('../story.js');return global.window.TransparencyStory;})();
const state=p=>p.evaluate(()=>TransparencyGame.getState());
const lum=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
const contrast=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((m,n)=>n-m);return (x+.05)/(y+.05);};
const rgb=s=>s.match(/\d+(\.\d+)?/g).slice(0,3).map(Number);
const ok=m=>console.log('  ok',m);
// 엔진 검증(consistent)을 지나는 저장: 앞 사건을 모두 끝낸 상태로 그 사건·단계에 선다
function finishCase(s,k,follow=true){if(k==='camp'&&!s.asked.length)s.asked=['who'];s.evidence.push(...E.checks[k]);s.judgments[k]=E.answers[k].slice();s.cases[k]={first:E.choices[k][0],final:E.choices[k][0]};
 if(follow){const m=E.followMarks[k],marks={};m.ids.forEach((id,i)=>{marks[id]=k==='photo'?E.truth[i]:m.values[0];});s.follows[k]={marks,judgment:E.followAnswers[k]};const must=E.noticeCards[k].must.slice();s.notices[k]={picked:must,posted:must.slice()};}}
function stateAt(k,step){const s=E.initial(),i=E.CASES.indexOf(k);E.CASES.slice(0,i).forEach(x=>finishCase(s,x));if(k==='camp')s.asked=['who'];if(step==='follow')finishCase(s,k,false);if(step==='notice'){finishCase(s,k);s.notices[k]={picked:[],posted:null};}s.scene=s.furthest=E.sceneOf(k,step);return s;}
const seed=async(p,s)=>{await p.evaluate(({KEY,s})=>localStorage.setItem(KEY,JSON.stringify(s)),{KEY,s});await p.reload();assert.equal((await state(p)).scene,s.scene,'저장한 곳에서 시작');};
async function discover(p,id){
 await p.locator(`[data-act="item"][data-id="${id}"]`).click();
 if(id==='photo-original')await p.locator('[data-act="spot"][data-id="2"]').click();
 if(id==='photo-rule')for(const i of [0,1,2])await p.locator(`[data-act="region"][data-id="${i}"]`).click();
 if(id==='writing-history')await p.locator('[data-act="record"][data-id="h4"]').click();
 if(id==='face-clerk')await p.locator('[data-act="segment"][data-id="person"]').click();
 if(id==='camp-page')for(const c of ['office','appeal'])await p.locator(`[data-act="cell"][data-id="${c}"]`).click();
 if(id==='camp-results')await p.locator('[data-act="village"][data-id="pine"]').click();
 if(id==='camp-criteria')for(const r of ['join','essay','order','secret'])await p.locator(`[data-act="crit"][data-id="${r}"]`).click();
 if(id==='share-log')await p.locator('[data-act="part"][data-id="pic"]').click();
 if(id==='share-photo')await p.locator('[data-act="skyline"][data-id="sky"]').click();
 if(id==='share-compare')await p.locator('[data-act="said"][data-id="dm"]').click();
}
// 근거 자료마다 화면에서 찾을 표시
const MARK={'photo-rule':'.guide-box','writing-guide':'.visual .document ul','writing-history':'.visual .records','face-alert':'.visual .document','face-photo':'.visual .evidence-photo',
 'camp-page':'.visual .document','camp-results':'.visual .camp-table','camp-criteria':'.visual .score-formula','camp-bus':'.visual .note-card','share-log':'.visual .records','share-photo':'.visual .sky-pair','share-compare':'.visual .compare-pair'};
async function caseRun(p,k,vp,wrong){
 const c=D.cases[k],n=E.sceneOf(k,'check');
 await seed(p,stateAt(k,'check'));
 for(const x of c.checks)await discover(p,x.id);
 for(let i=0;i<3;i++){const j=c.judges[i];
  assert.match(await p.locator('.judge-head').innerText(),new RegExp(`이 말은 맞을까\\? ${i+1}/3`));
  // 2026-11-08: 판단 카드가 나와도 화면을 자동으로 내리지 않는다. 휴대폰에서는 학생이 직접 내리는 것처럼 휠로 내린 뒤 확인한다(자료 칸은 위에 붙어 있다).
  if(i===0){const t=await p.locator('.judge-say').evaluate(e=>e.getBoundingClientRect().bottom-innerHeight);if(t>0){await p.mouse.move(195,600);await p.mouse.wheel(0,t+24);await p.waitForTimeout(300);}}
  const m=await p.evaluate(()=>{const s=document.querySelector('.judge-head'),cs=getComputedStyle(s),say=document.querySelector('.judge-say').getBoundingClientRect(),v=document.querySelector('.visual').getBoundingClientRect(),pressed=[...document.querySelectorAll('.source-tag')].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.dataset.id),cardB=document.querySelector('.stamps').getBoundingClientRect();return {size:parseFloat(cs.fontSize),weight:+cs.fontWeight,color:cs.color,pressed,tags:[...document.querySelectorAll('.source-tag')].map(b=>b.textContent),say:{t:say.top,b:say.bottom},v:{t:v.top,b:v.bottom,l:v.left,r:v.right},stampsB:cardB.bottom,vh:innerHeight,vw:innerWidth};});
  assert.ok(m.size>=18&&m.size<=20.5&&m.weight>=700,'머리말 18~20px 굵게 '+JSON.stringify(m));
  assert.deepEqual(m.tags,j.src.map(id=>c.checks.find(x=>x.id===id).name),'태그 = 근거 자료 이름');
  assert.ok(j.src.includes(m.pressed[0]),`${k} ${i+1}: 지금 보이는 자료가 근거 ${JSON.stringify(m.pressed)}`);
  await p.locator(MARK[m.pressed[0]]).first().waitFor({state:'visible',timeout:8000}); // 그림은 다 받아야 높이가 생긴다
  const both=m.v.t<m.vh&&m.v.b>0&&m.say.t>=0&&m.say.b<=m.vh; assert.ok(both,`${k} ${i+1}: 자료와 판단 문장이 한 화면 ${JSON.stringify(m)}`);
  if(i===0)await p.screenshot({path:path.join(shotDir,`_t1106-${k}-${vp}.png`)});
  const answer=E.answers[k][i],pick=wrong?Object.keys(D.stamps).find(x=>x!==answer):answer;
  await p.locator(`[data-act="judge"][data-id="${pick}"]`).click();
  const r=await p.evaluate(()=>({right:[...document.querySelectorAll('.stamp-right')].map(b=>b.innerText),mine:[...document.querySelectorAll('.stamp-mine')].map(b=>b.innerText),rb:document.querySelector('.stamp-right')&&getComputedStyle(document.querySelector('.stamp-right')).borderStyle,mb:document.querySelector('.stamp-mine')&&getComputedStyle(document.querySelector('.stamp-mine')).borderStyle,head:document.querySelector('.again-head')?.innerText||'',fb:document.querySelector('.judge .finding').innerText}));
  assert.equal(r.right.length,1);assert.match(r.right[0],/✓ 정답/);
  // 사건 5(혼자): 피드백은 '기록과 맞춰 보면: …' 한 줄(틀리면 끝에 '정리: …'), '다시 보자' 머리말 없음
  if(wrong){assert.match(r.mine[0],/내 선택/);assert.equal(r.mb,'dashed');assert.equal(r.rb,'solid');assert.equal(r.head,c.solo?'':'다시 보자');assert.ok(r.fb.includes(c.solo?j.sum:j.wrong),'피드백 본문 그대로');if(c.solo)assert.match(r.fb,/정리: 자료/);if(i===0)await p.screenshot({path:path.join(shotDir,`_t1106-wrong-${k}-${vp}.png`)});}
  else{assert.equal(r.mine.length,0);assert.equal(r.head,'');assert.ok(r.fb.startsWith(c.solo?'기록과 맞춰 보면: ':'맞아,'));}
  if(i<2)await p.locator('[data-act="judge-next"]').click();
 }
 assert.equal(await p.locator('.step-nav [data-act="next"]').isDisabled(),false);
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/index.html`;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const [vp,viewport,wrong] of [['1280',{width:1280,height:800},true],['390',{width:390,height:844},false],['390w',{width:390,height:844},true]]){
   const ctx=await browser.newContext({viewport,reducedMotion:'reduce'}),p=throughTitle(await ctx.newPage()),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.goto(url);for(const k of E.CASES)await caseRun(p,k,vp,wrong);
   assert.deepEqual(errors,[]);ok(`${vp}: 사건 ${E.CASES.length}개 판단 ${E.CASES.length*3}개 — 근거 자료와 판단 문장 한 화면, ${wrong?'오답 표시':'정답 표시'}`);await ctx.close();
  }
  // 직접 고른 자료는 다시 안 바꾸고, 다음 문장으로 가면 맞춘다
  {const ctx=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'}),p=throughTitle(await ctx.newPage());await p.goto(url);
   await seed(p,stateAt('writing','check'));
   for(const x of D.cases.writing.checks)await discover(p,x.id);
   assert.equal(await p.locator('.finding.quiet').count(),1,'찾은 내용 흐리게 유지');
   await p.locator('[data-act="source"][data-id="writing-history"]').click();assert.equal(await p.locator('[data-act="source"][data-id="writing-history"]').getAttribute('aria-pressed'),'true','태그를 누르면 그 자료');
   await p.locator('[data-act="item"][data-id="writing-guide"]').click();assert.ok(await p.locator('.visual .document ul').isVisible(),'자료 버튼도 그대로');
   // 키보드: 태그 → Enter, 도장 → Enter, 다음 말
   await p.locator('[data-act="source"][data-id="writing-history"]').focus();await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>document.activeElement.dataset.act),'source','Enter 뒤 초점 유지');assert.ok(await p.locator('.visual .records').isVisible());
   await p.keyboard.press('Tab');await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.dataset.act),'judge','Tab으로 판단 버튼');await p.keyboard.press('Enter');
   assert.equal(await p.locator('.stamp-right').count(),1);await p.locator('[data-act="judge-next"]').focus();await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>document.activeElement.dataset.act),'judge','다음 말로 넘어가면 판단 버튼에 초점');
   ok('태그·자료 버튼·키보드');await ctx.close();}
  // 점검표 칩
  {const ctx=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'}),p=throughTitle(await ctx.newPage());await p.goto(url);
   await seed(p,stateAt('face','follow'));
   const chips=await p.evaluate(()=>[...document.querySelectorAll('.chip')].map(c=>{const s=getComputedStyle(c),own=s.backgroundColor;return {t:c.textContent,size:parseFloat(s.fontSize),w:+s.fontWeight,fg:s.color,bg:own};}));
   assert.deepEqual(chips.map(c=>c.t),['✓ 완료','◐ 진행 중','○ 예정','○ 예정']);
   chips.forEach(c=>{assert.ok(c.size>=16&&c.size<=18&&c.w>=700,JSON.stringify(c));const cr=contrast(rgb(c.fg),rgb(c.bg));assert.ok(cr>=4.5,c.t+' 대비 '+cr);console.log('   ',c.t,'대비',cr.toFixed(1));});
   assert.equal(await p.locator('.row-open').count(),4);await p.locator('[data-act="row"][data-id="r1"]').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('.row-open').count(),3,'Enter로 열림');
   assert.equal(await p.locator('.proof').evaluate(n=>getComputedStyle(n).color),await p.evaluate(()=>getComputedStyle(document.body).color),'근거 줄 = 본문 색');
   await p.screenshot({path:path.join(shotDir,'_t1106-chips-1280.png')});ok('칩 16~18px·대비 4.5 이상·근거 보기·키보드');await ctx.close();}
  // 저장(version 4): 판단 중간에서 이어하기, 키 구조 그대로
  {const ctx=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'}),p=throughTitle(await ctx.newPage());await p.goto(url);
   const base=await p.evaluate(()=>TransparencyGame.getState()),old=stateAt('face','check');old.evidence.push(...E.checks.face);old.judgments.face=['different','confirmed',null];
   await seed(p,old);
   assert.match(await p.locator('.judge-head').innerText(),/3\/3/);assert.ok(await p.locator('.visual .evidence-photo').isVisible(),'이어하기에서도 근거 자료(비교 사진)');assert.equal(await p.locator('.compare-labels span').first().innerText(),'등록된 사진');
   await p.screenshot({path:path.join(shotDir,'_t1106-compare-1280.png')});
   const s=await state(p);assert.equal(s.version,7);assert.deepEqual(Object.keys(s).sort(),Object.keys(base).sort(),'저장 구조 그대로');ok('version 7 이어하기');await ctx.close();}
  // 후속 조사 카드·집계 기준
  {const ctx=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'}),p=throughTitle(await ctx.newPage());await p.goto(url);
   await seed(p,stateAt('photo','follow'));
   for(let i=0;i<6;i++)await p.locator(`[data-act="mark"][data-id="p${i+1}"][data-value="${E.truth[i]}"]`).click();
   const f=await p.locator('.body .finding').first().innerText();console.log('   ',f.split('\n')[0]);assert.match(f,/얼굴이 일부라도 사진 틀 밖으로 나가면 잘린 것으로 셌다\. 잘린 횟수: /);assert.match(f,/토리 \d/);assert.match(f,/몽이 \d/);assert.doesNotMatch(f,/다람쥐|강아지/);
   assert.equal(await p.locator('.judge-card .source-name').innerText(),'사진 6장');assert.equal(await p.locator('.judge-head').innerText(),'이 말은 맞을까?');ok('후속 조사 카드·집계 기준·이름');await ctx.close();}
  // 미리 알리기(2026-11-08): 카드·붙이기를 키보드로, 누른 뒤 초점 유지, 피드백 태그 대비, 판정 status
  {const ctx=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'}),p=throughTitle(await ctx.newPage());await p.goto(url);
   await seed(p,stateAt('face','notice'));const n=E.noticeCards.face;
   for(const id of [n.must[0],n.conflict[0]]){await p.locator(`[data-act="notice-pick"][data-id="${id}"]`).focus();await p.keyboard.press('Enter');
    assert.equal(await p.evaluate(()=>document.activeElement.dataset.id),id,'Enter 뒤 초점 유지');assert.equal(await p.locator(`[data-act="notice-pick"][data-id="${id}"]`).getAttribute('aria-pressed'),'true');}
   await p.keyboard.press('Space');assert.equal(await p.locator(`[data-act="notice-pick"][data-id="${n.conflict[0]}"]`).getAttribute('aria-pressed'),'false','Space로 다시 빼기');
   await p.keyboard.press('Space');await p.locator('[data-act="notice-post"]').focus();await p.keyboard.press('Enter');
   assert.equal(await p.evaluate(()=>document.activeElement.dataset.act),'notice-post');assert.equal(await p.locator('.notice-verdict[role="status"]').count(),1);
   assert.equal(await p.locator(`[data-act="notice-pick"][data-id="${n.must[0]}"]`).getAttribute('aria-describedby'),'fb-'+n.must[0],'카드와 피드백 연결');
   const tags=await p.evaluate(()=>[...document.querySelectorAll('.fb-tag')].map(c=>{const s=getComputedStyle(c);return {t:c.textContent,fg:s.color,bg:s.backgroundColor,bs:s.borderStyle};}));
   tags.forEach(c=>{const cr=contrast(rgb(c.fg),rgb(c.bg));assert.ok(cr>=4.5,c.t+' 대비 '+cr);assert.ok(/^[✓!○] /.test(c.t),'기호+글자 '+c.t);assert.equal(c.bs,c.t.startsWith('!')?'dashed':'solid',c.t);});
   const st=await state(p);assert.deepEqual(st.notices.face.posted,[n.must[0],n.conflict[0]]);ok(`미리 알리기 키보드·초점·aria-describedby·태그 ${tags.length}개 대비 4.5 이상·! 점선`);await ctx.close();}
  console.log('PASS playtest-1106');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
