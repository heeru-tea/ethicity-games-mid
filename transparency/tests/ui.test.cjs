// 화면 코드의 동작 검사(브라우저 없이 tests/dom-stub.cjs로). 화면 기록(render-snapshot)이 '그대로인지'를 본다면, 여기는 '맞게 움직이는지'를 본다.
// 2026-11-10 외부 검토(review.md) 3·4·6번. 진짜 브라우저의 초점·입력기·스크린리더는 보지 못한다(브라우저 검사와 사람 몫).
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGame,parseTags}=require('./dom-stub.cjs');
const E=require('../engine.js');
const KEY='ethicity.transparency.progress.v1';

// 정답대로 걸어가 그 사건의 그 단계 화면에 선 저장을 만든다.
function stateAt(key,step){
 let s=E.initial();const goal=E.sceneOf(key,step);
 while(s.scene<goal){const k=E.caseKey(s.scene),st=E.stepOf(s.scene);
  if(st==='hook'&&k==='camp')s=E.reduce(s,{type:'ask',id:'who'});
  if(st==='check'){for(const id of E.checks[k])s=E.reduce(s,{type:'check',id});for(const a of E.answers[k])s=E.reduce(s,{type:'judge',stamp:a});}
  if(st==='choose'){s=E.reduce(s,{type:'choose',id:E.choices[k][0]});continue;}
  if(st==='follow'){const m=E.followMarks[k];m.ids.forEach((id,i)=>{s=E.reduce(s,{type:'mark',id,value:k==='photo'?E.truth[i]:m.values[0]});});s=E.reduce(s,{type:'follow-judge',stamp:E.followAnswers[k]});}
  if(st==='notice'){for(const id of E.noticeCards[k].must)s=E.reduce(s,{type:'notice-pick',id});s=E.reduce(s,{type:'notice-post'});}
  s=E.reduce(s,{type:'next'});}
 assert.equal(s.scene,goal);return s;
}
const open=(key,step)=>{const g=createGame({storage:{[KEY]:JSON.stringify(stateAt(key,step))}});g.snap();return g;};

// 4. 사진 후속 조사: ‘나왔어’·‘잘렸어’는 data-act·data-id가 같고 data-value만 다르다. 다시 그린 뒤 초점은 누른 그 버튼으로 돌아가야 한다.
test('review 4: after marking 잘렸어 the focus stays on 잘렸어; pressing it again does not flip the answer',()=>{
 const g=open('photo','follow');
 g.click('mark',{id:'p1',value:'cut'});
 let fx=g.snap().fx;
 assert.equal(g.state().follows.photo.marks.p1,'cut');
 assert.match(fx,/^focus button\[mark\|p1\|cut\]$/m,'초점이 누른 버튼으로: '+fx);
 assert.deepEqual(g.focused(),{tag:'BUTTON',act:'mark',id:'p1',value:'cut'});
 // 초점이 있는 버튼을 그대로 다시 누른다(Space를 거듭 누르는 것과 같다)
 for(let i=0;i<3;i++){const f=g.focused();g.click(f.act,{id:f.id,value:f.value});assert.equal(g.state().follows.photo.marks.p1,'cut','거듭 눌러도 답이 그대로');}
 assert.deepEqual(g.focused(),{tag:'BUTTON',act:'mark',id:'p1',value:'cut'});
 // ‘나왔어’를 누르면 그쪽으로
 g.click('mark',{id:'p1',value:'shown'});assert.match(g.snap().fx,/^focus button\[mark\|p1\|shown\]$/m);assert.equal(g.state().follows.photo.marks.p1,'shown');
 // 다른 사진의 버튼도 제자리
 g.click('mark',{id:'p4',value:'cut'});assert.deepEqual(g.focused(),{tag:'BUTTON',act:'mark',id:'p4',value:'cut'});
 // 화면 순서: 사진마다 나왔어 → 잘렸어, 사진 1 → 6 (Tab 순서는 DOM 순서)
 const marks=parseTags(g.app.innerHTML,'button').filter(b=>b['data-act']==='mark').map(b=>b['data-id']+':'+b['data-value']);
 assert.deepEqual(marks,E.followMarks.photo.ids.flatMap(id=>[id+':shown',id+':cut']));
});

// 6. 서술 칸: 입력칸 제한(maxlength)·글자 수 표시·저장이 같은 단위(UTF-16)이고, 상한을 알린다.
//    상한을 넘는 글이 들어오면(붙여넣기·입력기) 화면에 남는 글 = 저장된 글 = 다시 열었을 때 글이고, 넘는 글이 빠졌다고 알린다.
const unesc=v=>v.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const boxText=(g,id)=>{const m=new RegExp(`<textarea id="${id}"[^>]*>\\n([\\s\\S]*?)</textarea>`).exec(g.app.innerHTML);assert.ok(m,id);return unesc(m[1]);};
const boxAttrs=(g,id)=>parseTags(g.app.innerHTML,'textarea').find(a=>a.id===id);
const SAMPLES={ko3999:'가'.repeat(3999),ko4000:'가'.repeat(4000),ko4001:'가'.repeat(4001),emojiFit:'😀'.repeat(2000),emojiOver:'😀'.repeat(2001),emojiSplit:'가'.repeat(3999)+'😀',
 short:'짧은 글 😀',pasted:'붙여 넣은 긴 글 '.repeat(700)};
test('review 6: the write box limits, counts and saves in one unit; text over the cap is cut on screen too, with a notice',()=>{
 const MAX=E.TEXT_MAX;
 for(const [name,v] of Object.entries(SAMPLES)){
  const g=open('photo','reflect'),R=g.D.reflect,fill=s=>s.replace('{max}',MAX);
  for(const id of ['reflect-q1','reflect-q2'])assert.equal(boxAttrs(g,id).maxlength,String(MAX),'입력칸 제한 = 저장 상한');
  assert.ok(g.app.innerHTML.includes(fill(R.limit)),'상한을 미리 알린다');assert.match(fill(R.limit),/4000자/);
  const r=g.input('reflect','q1',v),want=E.clipText(v);
  assert.equal(r.value,want,name+': 화면에 남은 글');
  assert.equal(g.state().reflections.photo.q1,want,name+': 상태');
  assert.equal(JSON.parse(g.stored()).reflections.photo.q1,want,name+': 저장');
  assert.equal(r.count,want.length+'자',name+': 글자 수 표시는 저장 단위와 같다');
  assert.equal(r.limit,want!==v?fill(R.over):want.length>=MAX?fill(R.full):'',name+': 상한 안내');
  // 다시 열기(재방문): 저장된 것으로 새로 열면 입력칸 글·글자 수가 같다
  const g2=createGame({storage:{[KEY]:g.stored()}});
  assert.equal(boxText(g2,'reflect-q1'),want,name+': 다시 열었을 때');
  assert.ok(g2.app.innerHTML.includes(`<span class="count-n">${want.length}자</span>`),name+': 다시 열었을 때 글자 수');
  assert.equal(g2.app.innerHTML.includes('>'+fill(R.full)+'<'),want.length>=MAX,name+': 다시 열었을 때 꽉 찼다는 안내');
  // 같은 화면을 다시 그려도(이전 → 다음) 같다
  g.click('back');g.click('next');assert.equal(boxText(g,'reflect-q1'),want,name+': 다시 그린 뒤');
 }
 // 줄이면 안내가 사라진다
 const g=open('photo','reflect');
 assert.notEqual(g.input('reflect','q1','가'.repeat(4001)).limit,'');assert.equal(g.input('reflect','q1','가'.repeat(3990)).limit,'');
 // 입력기(한글 조합) 중에는 입력칸 글을 건드리지 않고, 조합이 끝나면 맞춘다. 저장은 늘 상한 안.
 const over='가'.repeat(4001);
 let r=g.input('reflect','q2',over,{composing:true});assert.equal(r.value,over,'조합 중에는 그대로');assert.equal(g.state().reflections.photo.q2.length,4000);
 r=g.input('reflect','q2',over,{type:'compositionend'});assert.equal(r.value,'가'.repeat(4000));assert.equal(r.limit,g.D.reflect.over.replace('{max}',MAX));assert.equal(g.state().reflections.photo.q2,r.value);
 // 넘치게 붙여 넣으려는 순간(beforeinput): 브라우저가 잘라 넣기 전에 알린다
 const g3=open('photo','reflect');g3.input('reflect','q1','가'.repeat(3990));
 r=g3.input('reflect','q1','가'.repeat(3990),{type:'beforeinput',inputType:'insertFromPaste',data:'나'.repeat(30)});assert.equal(r.limit,g3.D.reflect.over.replace('{max}',MAX),'붙여넣기가 넘칠 때');
 r=g3.input('reflect','q1','가'.repeat(3990)+'나'.repeat(10));assert.equal(r.limit,g3.D.reflect.over.replace('{max}',MAX),'브라우저가 잘라 넣은 직후에도 안내가 남는다');
 r=g3.input('reflect','q1','가'.repeat(3990)+'나'.repeat(9));assert.equal(r.limit,'','지우면 사라진다');
 r=g3.input('reflect','q1','가'.repeat(100),{type:'beforeinput',inputType:'insertFromPaste',data:'나'.repeat(30)});assert.equal(r.limit,'','안 넘치면 조용히');
 // 마지막 서술 칸도 같다
 const e=open('share','reflect');e.click('next');assert.equal(E.stepOf(e.state().scene),'end');
 assert.equal(boxAttrs(e,'final-note').maxlength,String(MAX));
 r=e.input('note','','가'.repeat(3999)+'😀');assert.equal(r.value,'가'.repeat(3999));assert.equal(e.state().finalNote,r.value);assert.equal(JSON.parse(e.stored()).finalNote,r.value);assert.equal(r.count,'3999자');
});
