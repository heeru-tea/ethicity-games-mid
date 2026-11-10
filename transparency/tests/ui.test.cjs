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
