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
 // 꽉 찬 칸에 더 넣으려다 막힌 뒤(입력 이벤트 없이 끝남), 글을 크게 줄인 다음 입력에는 ‘빠졌다’가 남지 않는다
 g3.input('reflect','q1','가'.repeat(4000));r=g3.input('reflect','q1','가'.repeat(4000),{type:'beforeinput',inputType:'insertText',data:'나'});assert.equal(r.limit,g3.D.reflect.over.replace('{max}',MAX));
 r=g3.input('reflect','q1','가'.repeat(200));assert.equal(r.limit,'','줄인 뒤에는 조용히');
 // 마지막 서술 칸도 같다
 const e=open('share','reflect');e.click('next');assert.equal(E.stepOf(e.state().scene),'end');
 assert.equal(boxAttrs(e,'final-note').maxlength,String(MAX));
 r=e.input('note','','가'.repeat(3999)+'😀');assert.equal(r.value,'가'.repeat(3999));assert.equal(e.state().finalNote,r.value);assert.equal(JSON.parse(e.stored()).finalNote,r.value);assert.equal(r.count,'3999자');
});

// 3. 사진 활동의 글 설명: 사진을 보지 않고도 같은 관찰(누가 어디에 있고, 틀 가장자리가 어느 얼굴을 지나는지)을 할 수 있어야 한다.
//    설명은 engine 좌표(faces·AUTO·FOLLOW_CROPS)에서 만든다. 답(‘잘렸어/나왔어’, 누가 담이인지)을 버튼 이름으로 읽어 주지는 않는다.
const NAMES=['토리','루루','담이','모아','몽이'];
const attrOf=(html,tag,pick)=>parseTags(html,tag).filter(pick);
const textOf=html=>unesc(html.replace(/<\/?strong>/g,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
const detailsOf=(g,key)=>{const m=new RegExp(`<details class="more photo-text" data-text="${key}"( open)?>([\\s\\S]*?)</details>`).exec(g.app.innerHTML);assert.ok(m,'‘사진을 글로 살펴보기’ '+key);return {open:!!m[1],html:m[2],text:textOf(m[2])};};
const toggle=(g,key,isOpen,match=s=>s==='details.photo-text')=>g.documentEvent('toggle',{target:{matches:match,open:isOpen,dataset:{text:key}}});
test('review 3: the original photo has position names on the face buttons and a text description made from the coordinates',()=>{
 const g=open('photo','check');g.click('item',{id:'photo-original'});
 const spots=attrOf(g.app.innerHTML,'button',b=>b['data-act']==='spot').map(b=>b['aria-label']);
 assert.deepEqual(spots,['얼굴 1: 왼쪽에서 첫째, 사진의 왼쪽 위','얼굴 2: 왼쪽에서 둘째, 사진의 가운데 위','얼굴 3: 왼쪽에서 셋째, 사진의 한가운데','얼굴 4: 왼쪽에서 넷째, 사진의 가운데 위','얼굴 5: 왼쪽에서 다섯째, 사진의 오른쪽 위']);
 assert.equal(new Set(spots).size,5,'이름이 서로 다르다');for(const s of spots)for(const n of NAMES)assert.ok(!s.includes(n),'버튼 이름이 답을 말하지 않는다: '+s);
 const img=attrOf(g.app.innerHTML,'img',a=>/원본 사진/.test(a.alt))[0];assert.match(img.alt,/사진을 글로 살펴보기/,'그림 설명이 글 설명이 있는 곳을 알려 준다');
 const d=detailsOf(g,'original');assert.equal(d.open,false);assert.match(d.html,/<summary>사진을 글로 살펴보기<\/summary>/);
 for(const line of ['토리: 왼쪽에서 첫째. 사진의 왼쪽 위.','루루: 왼쪽에서 둘째. 사진의 가운데 위.','담이: 왼쪽에서 셋째. 사진의 한가운데. 다섯 얼굴 가운데 가장 아래쪽.','모아: 왼쪽에서 넷째. 사진의 가운데 위.','몽이: 왼쪽에서 다섯째. 사진의 오른쪽 위.',
  '점선 틀(자동으로 남긴 부분)은 원본의 오른쪽 위 부분이다. 틀 안에 온전히 있는 얼굴: 몽이. 틀 가장자리에 걸린 얼굴: 모아(틀의 왼쪽 가장자리). 틀 밖에 있는 얼굴: 토리, 루루, 담이.'])assert.ok(d.text.includes(line),'없는 줄: '+line+'\n'+d.text);
 // 글 설명만 읽고 담이를 찾는다: ‘담이: 왼쪽에서 셋째’ → ‘왼쪽에서 셋째’ 버튼
 const where=/담이: (왼쪽에서 [^.]+)\./.exec(d.text)[1],hit=attrOf(g.app.innerHTML,'button',b=>b['data-act']==='spot'&&b['aria-label'].includes(where));
 assert.equal(hit.length,1);g.click('spot',{id:hit[0]['data-id']});assert.ok(g.state().evidence.includes('photo-original'),'글 설명과 버튼 이름만으로 담이를 찾았다');
 assert.match(attrOf(g.app.innerHTML,'button',b=>b['data-act']==='spot'&&b['data-id']==='2')[0]['aria-label'],/담이/,'찾은 뒤에는 찾은 얼굴이 담이라고 이름에 붙는다');
 // 펼친 채로 다시 그려도 펼쳐져 있다(화면을 다시 그릴 때마다 접히면 읽다가 끊긴다)
 toggle(g,'original',true);g.click('spot',{id:0});assert.equal(detailsOf(g,'original').open,true);
 toggle(g,'original',false);g.click('spot',{id:1});assert.equal(detailsOf(g,'original').open,false);
 toggle(g,'original',true,()=>false);g.click('spot',{id:1});assert.equal(detailsOf(g,'original').open,false,'다른 details는 상관없다');
 // 세 구역 점수를 모두 열면 잘린 범위·중심을 그림 설명이 말한다(노란 테두리·점은 그림으로만 보였다)
 g.click('item',{id:'photo-rule'});const ruleAlt=()=>attrOf(g.app.innerHTML,'img',a=>/세 구역/.test(a.alt))[0].alt;
 assert.doesNotMatch(ruleAlt(),/잘린 범위/,'점수를 다 열기 전에는 말하지 않는다');for(const id of [0,1,2])g.click('region',{id});
 const rule=ruleAlt();assert.match(rule,/실제로 잘린 범위는 원본의 오른쪽 위 부분이고, 자르기 중심은 오른쪽 구역에 있다\./);
 // 장면을 옮기면 접힌다
 g.click('item',{id:'photo-original'});toggle(g,'original',true);g.click('back');g.click('next');g.click('item',{id:'photo-original'});assert.equal(detailsOf(g,'original').open,false,'장면을 옮기면 접힌다');
 // 좌표를 바꾸면 설명도 바뀐다(손으로 쓴 글이 아니다): 담이 얼굴을 왼쪽 아래 끝으로 옮긴다
 const g2=open('photo','check');g2.E.faces[2].splice(0,4,40,800,165,150);g2.click('item',{id:'photo-original'});
 const d2=detailsOf(g2,'original').text;assert.ok(d2.includes('담이: 왼쪽에서 첫째. 사진의 왼쪽 아래. 다섯 얼굴 가운데 가장 아래쪽.'),d2);assert.ok(d2.includes('토리: 왼쪽에서 둘째.'),d2);
 assert.equal(attrOf(g2.app.innerHTML,'button',b=>b['data-act']==='spot')[2]['aria-label'],'얼굴 3: 왼쪽에서 첫째, 사진의 왼쪽 아래');
});
test('review 3: each follow-up photo says in words which faces are whole and which are crossed by the frame edge; nothing reads out the answer',()=>{
 const g=open('photo','follow');
 const labels=attrOf(g.app.innerHTML,'canvas',c=>'data-crop' in c&&/^사진 \d/.test(c['aria-label'])).map(c=>c['aria-label']);
 assert.deepEqual(labels,[
  '사진 1. 원본의 오른쪽 위 부분. 온전히 보이는 얼굴: 몽이. 가장자리에 걸려 일부만 보이는 얼굴: 모아(사진의 왼쪽 가장자리).',
  '사진 2. 원본의 가운데 위 부분. 온전히 보이는 얼굴: 토리, 루루, 담이, 모아. 가장자리에 걸려 일부만 보이는 얼굴: 몽이(사진의 오른쪽 가장자리).',
  '사진 3. 원본의 왼쪽 위 부분. 온전히 보이는 얼굴: 토리. 가장자리에 걸려 일부만 보이는 얼굴: 루루(사진의 오른쪽·위쪽 가장자리).',
  '사진 4. 원본의 오른쪽 위 부분. 온전히 보이는 얼굴: 담이, 모아, 몽이. 가장자리에 걸려 일부만 보이는 얼굴: 루루(사진의 왼쪽 가장자리).',
  '사진 5. 원본의 오른쪽 위 부분. 온전히 보이는 얼굴: 몽이. 가장자리에 걸려 일부만 보이는 얼굴: 모아(사진의 왼쪽 가장자리).',
  '사진 6. 원본의 한가운데 부분. 온전히 보이는 얼굴: 토리, 루루, 담이, 모아, 몽이(다섯 모두).']);
 assert.equal(new Set(labels).size,6,'사진 이름이 서로 다르다');
 // 설명이 좌표와 맞는지: ‘온전히 보이는 얼굴’ = 잘리지 않은 얼굴, 이름이 아예 없는 친구 = 틀 밖
 const wholeOf=t=>(/온전히 보이는 얼굴: ([^.(]+)/.exec(t)||[,''])[1].split(', ').filter(Boolean);
 labels.forEach((t,i)=>{const r=E.FOLLOW_CROPS[i],cut=E.cutFaces(r);
  assert.deepEqual(wholeOf(t),NAMES.filter((_,n)=>!cut.includes(n)),'사진 '+(i+1));
  NAMES.forEach((n,k)=>assert.equal(t.includes(n),E.faceIn(r,k).state!=='out','사진 '+(i+1)+' '+n));
  assert.doesNotMatch(t,/잘렸|나왔|정답|맞아/,'답을 읽어 주지 않는다');});
 // 글 설명만 읽고 여섯 장을 표시한다: ‘온전히 보이는 얼굴’에 담이가 있으면 나왔어, 없으면 잘렸어
 const d=detailsOf(g,'follow');assert.match(d.html,/<summary>사진을 글로 살펴보기<\/summary>/);
 assert.ok(d.text.includes('이름이 없는 친구는 그 사진에 보이지 않는다.'),d.text);
 labels.forEach((t,i)=>{const line=t.replace(/^사진 \d\. /,'');assert.ok(d.text.includes('사진 '+(i+1)+': '+line),'글 설명에 같은 줄: '+t);
  g.click('mark',{id:'p'+(i+1),value:wholeOf(line).includes('담이')?'shown':'cut'});});
 assert.deepEqual(E.followMarks.photo.ids.map(id=>g.state().follows.photo.marks[id]),E.truth,'글 설명만으로 한 표시가 기록과 같다');
 // 표시 묶음 이름·버튼은 그대로(나왔어/잘렸어), 사진 번호로 구분된다
 const groups=attrOf(g.app.innerHTML,'div',a=>a.role==='group'&&/담이가 나왔나/.test(a['aria-label']||'')).map(a=>a['aria-label']);
 assert.deepEqual(groups,[1,2,3,4,5,6].map(n=>`사진 ${n}에 담이가 나왔나`));
 // 펼친 채로 표시해도 펼쳐져 있다
 const g2=open('photo','follow');toggle(g2,'follow',true);g2.click('mark',{id:'p1',value:'cut'});assert.equal(detailsOf(g2,'follow').open,true);
 // 좌표를 바꾸면 설명도 바뀐다: 사진 2의 틀을 담이 얼굴 가운데(가로 777)에서 끊는다
 const g3=open('photo','follow');g3.E.FOLLOW_CROPS[1].splice(0,4,0,0,777,518);g3.click('mark',{id:'p6',value:'shown'});
 const l2=attrOf(g3.app.innerHTML,'canvas',c=>/^사진 2/.test(c['aria-label']||''))[0]['aria-label'];
 assert.equal(l2,'사진 2. 원본의 왼쪽 위 부분. 온전히 보이는 얼굴: 토리, 루루. 가장자리에 걸려 일부만 보이는 얼굴: 담이(사진의 오른쪽 가장자리).');
});
// 사진 사건의 화면 코드에 손으로 적어 둔 사진 설명도 좌표와 맞아야 한다(review 2의 연장).
test('review 2·3: hand-written photo descriptions in the screen code still agree with the crops',()=>{
 const g=open('photo','hook'),auto=attrOf(g.app.innerHTML,'canvas',c=>/자동으로 자른 사진\./.test(c['aria-label']||''))[0];
 assert.equal(auto['aria-label'],'자동으로 자른 사진. 담이 얼굴이 없다.');assert.equal(auto['data-crop'],E.AUTO.join(','));assert.equal(E.faceIn(E.AUTO,2).state,'out');
 g.click('next');g.click('item',{id:'photo-original'});
 assert.match(attrOf(g.app.innerHTML,'img',a=>/원본 사진/.test(a.alt))[0].alt,/^다섯 친구가 모두 나온 축제 원본 사진\./);assert.deepEqual(E.cutFaces([0,0,...E.PHOTO]),[]);assert.equal(E.faces.length,5);
});
