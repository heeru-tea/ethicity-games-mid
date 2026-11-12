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
  if(st==='notice'){if(E.noticeFix(s,k))for(const x of E.noticeSlots[k])s=E.reduce(s,{type:'notice-slot',slot:x.id,opt:x.ok[0]});else for(const id of E.noticeIds(k))if(E.noticeCards[k].must.includes(id)!==s.notices[k].picked.includes(id))s=E.reduce(s,{type:'notice-pick',id});s=E.reduce(s,{type:'notice-post'});}
  s=E.reduce(s,{type:'next'});}
 assert.equal(s.scene,goal);return s;
}
// 시작 화면(2026-11-11)이 먼저 나오므로 ‘이어하기’를 눌러 그 화면으로 들어간다.
const enter=g=>{if(g.has('start'))g.click('start');g.snap();return g;};
const open=(key,step)=>enter(createGame({storage:{[KEY]:JSON.stringify(stateAt(key,step))}}));

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
  const g2=enter(createGame({storage:{[KEY]:g.stored()}}));
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

// 시작 화면(2026-11-11, ui/title.js): 열면 먼저 나오고, 저장 형식은 건드리지 않는다. 배치·초점·그림은 tests/title-browser.cjs(진짜 Edge) 몫.
const T=require('./dom-stub.cjs').createGame({}).D.title;
// 화면 코드는 다른 실행 환경(vm)에서 돌므로 상태는 JSON으로 옮겨 견준다.
const plain=g=>JSON.parse(JSON.stringify(g.state()));
const titleParts=g=>{const html=g.app.innerHTML,buttons=parseTags(html,'button');
 return {html,text:textOf(html),buttons,acts:buttons.map(b=>b['data-act']),h1:[...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map(m=>unesc(m[1].replace(/<[^>]*>/g,''))),/* 2026-11-12 제목 글자 그림: h1 안에 span·img가 들어간다 — 글자만 모아 견준다 */imgs:parseTags(html,'img'),
  main:textOf((/<button class="primary" data-act="start" >([\s\S]*?)<\/button>/.exec(html)||[,''])[1])};};
test('title: opening the game shows the start screen first; 게임 시작하기 enters the prologue and the save is untouched',()=>{
 const g=createGame({}),boot=g.snap(),t=titleParts(g),D=g.D;
 assert.equal(boot.cls,'at-title');assert.equal(boot.fx,'','처음 열 때는 초점·스크롤을 건드리지 않는다');
 assert.deepEqual(t.h1,[D.report.game],'제목은 h1 하나');
 assert.deepEqual(t.acts,['start'],'저장이 없으면 버튼은 게임 시작하기 하나');assert.equal(t.main,T.start);assert.equal(t.buttons[0].class,'primary');
 for(const s of [T.kind,T.hook,T.lead,...T.facts,T.peek.tag,T.keys])assert.ok(t.text.includes(s),'시작 화면에 없는 글: '+s);
 assert.equal(t.html.includes('id="work"'),true,'‘본문으로 건너뛰기’가 닿을 곳');
 // 그림: SVG 묶음(맞춤이 다른 두 벌 — 화면에는 CSS가 하나만 보인다)마다 설명 글 하나, 안에 든 그림은 기존 그림 세 장뿐
 const scenes=parseTags(t.html,'svg').filter(s=>/title-scene/.test(s.class||''));
 assert.deepEqual(scenes.map(s=>[s.class,s.role,s['aria-label'],s.preserveAspectRatio]),[['title-scene fit-tall','img',T.art,'xMaxYMax slice'],['title-scene fit-wide','img',T.art,'xMaxYMid slice']]);
 assert.deepEqual([...new Set(parseTags(t.html,'image').map(i=>i.href))].sort(),[D.art.backgrounds[0],D.art.moa,D.art.props].sort(),'기존 그림만 쓴다');
 assert.deepEqual(t.imgs.map(i=>[i.src,i.alt,i['aria-hidden']]),[['assets/title-type/blackbox.png','','true']],'img는 제목 글자 그림 하나뿐 — 글자는 HTML에 있고 그림은 화면 읽기에서 뺀다(2026-11-12)');
 // 게임 속 한 장면: 사진 사건의 판단 문장과 세 갈래를 그대로(새 문장 아님), 누를 수 없는 그림
 const j=D.cases[T.peek.case].judges[T.peek.judge];
 assert.ok(t.text.includes('“'+j.text+'”'));for(const s of Object.values(D.stamps))assert.ok(t.html.includes('<span>'+s+'</span>'));
 const card=parseTags(t.html,'div').find(d=>d.class==='peek-card');assert.equal(card.role,'img');assert.ok(card['aria-label'].includes(j.text));
 assert.doesNotMatch(card['aria-label']+t.text,/정답|맞아, /,'한 장면은 답을 말하지 않는다');
 // 분량: README에 적힌 값(사건 5개, 판단 20개)과 engine이 같다
 assert.equal(T.facts[0],'사건 '+g.E.CASES.length+'개');assert.equal(T.facts[1],'판단 '+(g.E.CASES.length*4)+'개');
 // 저장 형식 그대로: 시작 화면을 봤는지는 저장하지 않는다
 const stored=g.stored(),state=plain(g);
 assert.deepEqual(Object.keys(JSON.parse(stored)).sort(),Object.keys(E.initial()).sort());assert.deepEqual(JSON.parse(stored),E.initial());
 g.click('start');const after=g.snap();
 assert.equal(after.cls,'step-intro');assert.ok(after.html.includes(D.intro.title),'지금의 첫 화면(프롤로그)');assert.equal(after.html.includes('class="resume"'),false);
 assert.equal(after.fx,'focus h1\nscrollTo 0,0','들어가면 그 화면 제목에 초점');
 assert.equal(g.stored(),stored);assert.deepEqual(plain(g),state);
});
test('title: with a saved game the main button is 이어하기 with where it resumes; 처음부터 하기 goes through the existing confirmation',()=>{
 const end=E.reduce(stateAt('share','reflect'),{type:'next'}),report=E.reduce(end,{type:'next'}),backToIntro=E.reduce(stateAt('photo','check'),{type:'revisit',scene:0});
 assert.equal(end.scene,E.END);assert.equal(report.scene,E.REPORT);assert.deepEqual([backToIntro.scene,backToIntro.furthest>0],[0,true]);
 const cases=[[stateAt('photo','hook'),'사건 1 · 사진 · 궁금한 것부터'],[stateAt('writing','check'),'사건 2 · 글 검사 · 직접 확인부터'],[stateAt('face','notice'),'사건 3 · 얼굴 인식 · 미리 알리기부터'],
  [stateAt('camp','reflect'),'사건 4 · 구청 캠프 · 생각 정리부터'],[stateAt('share','follow'),'사건 5 · 은하수 그림 · 후속 조사부터'],[end,'마지막 장면부터'],[report,'나의 조사 보고서부터'],[backToIntro,'프롤로그부터']];
 for(const [s,from] of cases){
  const g=createGame({storage:{[KEY]:JSON.stringify(s)}});g.snap();let t=titleParts(g);
  assert.equal(g.app.className,'at-title',from);
  assert.deepEqual(t.acts,['start','reset-ask'],from+': 이어하기가 먼저(으뜸), 처음부터 하기는 다음');
  assert.equal(t.main,T.resume+' '+from);assert.equal(textOf(t.html).includes(T.restart),true);
  // 처음부터 하기 → 기존 확인 창 → 취소: 그대로
  g.click('reset-ask');let r=g.snap();assert.deepEqual([r.modalOpen,r.modalTitle],[true,'처음부터 다시 하기']);assert.match(r.modalBody,/이름과 학번도 지우기/);
  g.click('close');r=g.snap();assert.deepEqual([r.modalOpen,r.cls],[false,'at-title']);assert.deepEqual(plain(g),s,from+': 취소하면 진행 그대로');
  // 이어하기 → 저장된 화면, 기존 이어하기 안내도 그대로
  g.click('start');r=g.snap();assert.equal(r.cls.split(' ')[0],'step-'+E.stepOf(s.scene));assert.deepEqual(plain(g),s);
  assert.equal(r.html.includes('저장된 곳부터 이어서 해요.'),s.scene>0,from+': 기존 안내');
 }
 // 시작 화면에서 처음부터 하기 → 지우고 처음부터: 프롤로그로 들어가고 저장도 처음 상태
 const g=createGame({storage:{[KEY]:JSON.stringify(cases[1][0])}});g.click('reset-ask');g.click('reset');const r=g.snap();
 assert.equal(r.cls,'step-intro');assert.deepEqual(JSON.parse(g.stored()),E.initial());assert.match(r.fx,/focus h1/);
 // 지운 뒤 다시 열면 게임 시작하기
 assert.deepEqual(titleParts(createGame({storage:{[KEY]:g.stored()}})).acts,['start']);
});
test('title: 설정 → 시작 화면으로 comes back with the progress kept; every open starts at the start screen; the preview skips it',()=>{
 const g=createGame({});g.click('start');g.click('next');g.click('next');g.click('item',{id:'photo-original'});const s=plain(g),saved=g.stored();g.snap();
 g.click('settings');const menu=parseTags(g.snap().modalBody,'button').map(b=>b['data-act']);assert.deepEqual(menu,['sources','title','reset-ask'],'설정 창에 시작 화면으로');
 assert.ok(g.modal.open);g.click('title');const r=g.snap();
 assert.deepEqual([r.cls,r.modalOpen],['at-title',false]);assert.match(r.fx,/focus h1\nscrollTo 0,0/);assert.doesNotMatch(r.fx,/focus button\[settings\]/,'초점은 시작 화면 제목에 남는다');
 assert.equal(titleParts(g).main,T.resume+' 사건 1 · 사진 · 직접 확인부터');assert.deepEqual(plain(g),s);assert.equal(g.stored(),saved,'시작 화면으로 가도 저장은 그대로');
 // 이어하기: 보던 자료까지 그대로
 g.click('start');assert.ok(parseTags(g.app.innerHTML,'button').some(b=>b['data-act']==='item'&&b['data-id']==='photo-original'&&b['aria-pressed']==='true'),'보던 자료가 펼쳐진 채');
 // 다시 열면 또 시작 화면부터
 assert.equal(createGame({storage:{[KEY]:saved}}).app.className,'at-title');
 // 미리보기(?preview=s01)는 시작 화면 없이 사건 1
 const p=createGame({search:'?preview=s01'});assert.equal(p.app.className,'step-hook');assert.equal(p.has('start'),false);
 // 시작 화면을 보는 동안 사건 4·5 새 그림이 열려도 다시 그리지 않고(초점·연출 유지), 들어가면 새 그림을 쓴다
 const c=createGame({storage:{[KEY]:JSON.stringify(stateAt('camp','hook'))}}),gen=c.app.gen;c.settleImages(src=>src.endsWith('.webp'));
 assert.equal(c.app.gen,gen,'시작 화면은 다시 그리지 않는다');c.click('start');assert.ok(c.app.innerHTML.includes('assets/s04/bg-newsroom.webp'));
});

// ── 2026-11-12 수정 요청(14건) ──
const D=JSON.parse(JSON.stringify(require('./dom-stub.cjs').createGame({}).D));
const st=g=>JSON.parse(JSON.stringify(g.state()));
const text=h=>h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
const cls=(g,c)=>parseTags(g.app.innerHTML,'button').filter(b=>(b.class||'').split(' ').includes(c));
// 1·8. 사건 4 공개 페이지: 칸 class는 is-empty(전역 .blank와 겹치지 않음), 누른 빈 칸만 확인 표시, 둘 다 눌러야 자료 확인
test('request 1·8: public-page cells never carry the .blank class; one blank cell marks only itself, both are needed to confirm the record',()=>{
 const g=open('camp','check');g.click('item',{id:'camp-page'});
 const cells=()=>parseTags(g.app.innerHTML,'button').filter(b=>b['data-act']==='cell');
 assert.equal(cells().length,4);assert.ok(cells().every(b=>!b.class.split(' ').includes('blank')),'no .blank on buttons');
 assert.deepEqual(cells().filter(b=>b.class.includes('is-empty')).map(b=>b['data-id']),['office','appeal']);
 const marks=()=>(g.app.innerHTML.match(/<mark>/g)||[]).length,tags=()=>(g.app.innerHTML.match(/class="cell-tag"/g)||[]).length;
 g.click('cell',{id:'use'});assert.match(text(g.app.innerHTML),/이 칸은 적혀 있어\./);assert.equal(marks(),0);
 g.click('cell',{id:'appeal'});
 assert.equal(g.state().evidence.includes('camp-page'),false,'one cell is not enough');assert.equal(marks(),1);assert.equal(tags(),1);
 assert.match(text(g.app.innerHTML),/빈 칸 하나를 찾았어\. 하나 더 있어\./);assert.match(text(g.app.innerHTML),/비어 있는 칸 두 개를 모두 찾아/,'task still shown');
 g.click('cell',{id:'appeal'});assert.equal(g.state().evidence.includes('camp-page'),false,'same cell twice is still one');
 g.click('cell',{id:'office'});assert.equal(g.state().evidence.includes('camp-page'),true);assert.equal(marks(),2);assert.equal(tags(),2);
 assert.doesNotMatch(text(g.app.innerHTML),/하나 더 있어/);
 // 예전 저장(칸 하나로 확인한 것)은 그대로 확인됨: 둘 다 표시
 const s=stateAt('camp','choose'),old=enter(createGame({storage:{[KEY]:JSON.stringify(s)}}));old.click('back');old.click('item',{id:'camp-page'});
 assert.equal((old.app.innerHTML.match(/class="cell-tag"/g)||[]).length,2);
});
// 2·6. 사건 4: 버스 쪽지는 따로 여는 자료 카드, 판단 3은 기준표+쪽지를 보는 문장, 화자 정리
test('request 2·6 (and follow-up 1): the bus note is its own record card; judgment 3 is now a fact from the village results; rumour speaker and name tags',()=>{
 const C=D.cases.camp,j=C.judges[2];
 // 후속 요청 1(2026-11-12): 판단 3은 마을별 결과의 새 칸(평균 참여·참여 점수)으로 직접 확인되는 문장. 버스와 불참의 관계는 판단이 아니라 모아의 물음.
 assert.equal(j.text,'솔숲마을 신청자들은 지난 프로그램 참여 횟수가 적어, 이 항목에서 받은 점수도 낮았어.');assert.deepEqual(j.src,['camp-results','camp-criteria']);assert.equal(E.answers.camp[2],'confirmed');
 assert.doesNotMatch(j.text+j.right,/버스/,'no bus causation in the judged sentence or its feedback');assert.match(j.right,/0\.5번/);assert.match(j.right,/10점/);
 assert.equal(C.checks.find(x=>x.id==='camp-bus').finding[0][1],'버스가 적어서 참여하기 어려웠을까? 더 확인하려면 어떤 자료가 필요할까?');
 assert.equal(C.criteria.rows.find(r=>r.top).w,0.5);assert.ok(C.note.lines.some(t=>/하루 네 번/.test(t)));
 assert.equal(C.criteria.bus,undefined,'no small caption under the criteria table any more');assert.doesNotMatch(C.checks[2].more,/버스/);
 // 화자: 소문은 반 친구, 판단 2는 구청 발표, 선생님은 장면 그림에도
 assert.deepEqual(C.hook.map(l=>l[0]),['dami','classmate','teacher']);assert.equal(C.judges[0].who,'classmate');assert.equal(C.judges[1].who,'announce');assert.equal(D.names.announce,'구청 발표');
 assert.ok(C.cast.includes('teacher'));assert.doesNotMatch(JSON.stringify(C),/'clerk'|"clerk"|clerkPaper/,'the bakery clerk is not in case 4');
 const g=open('camp','hook');assert.match(g.app.innerHTML,/class="name-tag pos-1 teacher"><span>선생님<\/span>/);
 g.click('ask',{id:'who'});g.click('next');
 assert.deepEqual(parseTags(g.app.innerHTML,'button').filter(b=>b['data-act']==='item').map(b=>b['data-id']),E.checks.camp);
 g.click('item',{id:'camp-bus'});assert.equal(g.state().evidence.includes('camp-bus'),true,'opening the note confirms it');
 assert.match(g.app.innerHTML,/class="document note-card"/);for(const t of C.note.lines)assert.ok(g.app.innerHTML.includes(t));
 g.click('item',{id:'camp-criteria'});for(const r of C.criteria.rows)g.click('crit',{id:r.id});
 assert.doesNotMatch(g.app.innerHTML,/class="caption"/,'criteria card has no bus caption');
 // 판단 3 화면: 볼 자료 둘, 판단한 문장이 수첩·보고서에 그대로
 const r=open('camp','choose');r.click('back');
 const s=enter(createGame({storage:{[KEY]:JSON.stringify(Object.assign(stateAt('camp','check'),{}))}}));
 for(const id of E.checks.camp){s.click('item',{id});if(id==='camp-page'){s.click('cell',{id:'office'});s.click('cell',{id:'appeal'});}if(id==='camp-results')s.click('village',{id:'pine'});if(id==='camp-criteria')for(const x of C.criteria.rows)s.click('crit',{id:x.id});}
 s.click('judge',{id:'unknown'});s.click('judge-next');s.click('judge',{id:'different'});s.click('judge-next');
 assert.ok(s.app.innerHTML.includes(j.text));assert.deepEqual(parseTags(s.app.innerHTML,'button').filter(b=>b['data-act']==='source').map(b=>b['data-id']),j.src);
 s.click('judge',{id:'confirmed'});assert.ok(s.app.innerHTML.includes(j.right));assert.ok(s.app.innerHTML.includes(C.after),'conclusion after the last judgment');
 s.click('notebook');assert.ok(s.snap().modalBody.includes(j.text));
 const rep=enter(createGame({storage:{[KEY]:JSON.stringify(E.reduce(E.reduce(stateAt('share','reflect'),{type:'next'}),{type:'next'}))}}));
 assert.equal(E.stepOf(rep.state().scene),'report');assert.ok(rep.app.innerHTML.includes('3. “'+j.text+'”'),'report carries the new sentence');
 assert.ok(rep.app.innerHTML.includes('“'+D.cases.share.follow.judge.text+'”'));assert.doesNotMatch(rep.app.innerHTML,/참여 횟수가 가장 크게 들어가\.”|따로 안 알려도 돼/);
});
// 3. 자료를 열 때 모아는 답을 말하지 않는다: 묻기만 하고, 결론은 판단을 마친 뒤(after)
test('request 3: 모아 only asks when a record opens; the conclusions come after the three judgments; fewer 모아 lines from case 3 on, none in case 5',()=>{
 const moa=k=>D.cases[k].checks.flatMap(x=>(x.finding||[]).filter(l=>l[0]==='moa').map(l=>l[1]));
 for(const k of ['photo','writing','face','camp'])for(const t of moa(k))assert.match(t,/[까]\?$/,k+' 모아 line is a question: '+t);
 assert.deepEqual([moa('photo').length,moa('writing').length,moa('face').length,moa('camp').length,moa('share').length],[1,2,2,1,0]);
 const all=k=>JSON.stringify(D.cases[k].checks);
 assert.doesNotMatch(all('writing'),/확정한 게 아니야/);assert.match(D.cases.writing.after,/AI가 썼다고 확정한 게 아니야/);
 assert.doesNotMatch(all('face'),/이 사진만으로 같은 고양이인지 알 수 없어/);assert.match(D.cases.face.after,/이 사진만으로 같은 고양이인지 알 수 없어/);
 assert.doesNotMatch(all('face'),/까지만 말해/);assert.match(D.cases.face.after,/‘닮았으니 확인해 달라’까지만 말해/);
 // 화면: 자료를 다 열어도 결론 문장은 없고, 판단 셋을 마치면 나온다
 const g=open('writing','hook');g.click('next');g.click('item',{id:'writing-guide'});g.click('item',{id:'writing-history'});g.click('record',{id:'h4'});
 assert.doesNotMatch(g.app.innerHTML,/확정한 게 아니야/);
 E.answers.writing.forEach((a,i)=>{g.click('judge',{id:a});if(i<2)g.click('judge-next');});
 assert.ok(g.app.innerHTML.includes(D.cases.writing.after));
 // 한마디가 없는 자료는 빈 상자를 그리지 않는다(사건 4 공개 페이지)
 const c=open('camp','check');c.click('item',{id:'camp-page'});c.click('cell',{id:'office'});c.click('cell',{id:'appeal'});
 assert.doesNotMatch(c.app.innerHTML,/class="finding/);
});
// 4. 사건 3 점원의 말: 문장마다 다른 안내, ‘그 손님이래요’ 문장으로만 진행
test('request 4: each sentence of the clerk gets its own feedback; only 그 손님이래요 confirms the record',()=>{
 const F=D.cases.face,seg=id=>F.clerkSegments.find(x=>x.id===id);
 const g=open('face','hook');g.click('next');g.click('item',{id:'face-clerk'});
 const hint=()=>{const m=/<p class="tap-hint" role="status">([^<]*)<\/p>/.exec(g.app.innerHTML);return m?m[1]:'';};
 g.click('segment',{id:'rule'});assert.equal(g.state().evidence.includes('face-clerk'),false,'the shop-rule sentence does not confirm');
 assert.match(hint(),/가게 규칙/);assert.match(hint(),/따로 있어/);assert.equal((g.app.innerHTML.match(/<mark>/g)||[]).length,0);
 g.click('segment',{id:'system'});assert.equal(hint(),seg('system').hint);assert.equal(g.state().evidence.includes('face-clerk'),false);
 g.click('segment',{id:'person'});assert.equal(g.state().evidence.includes('face-clerk'),true);
 assert.match(hint(),/‘그 손님’이라고 정한 건 점원이야/);assert.notEqual(hint(),seg('rule').hint);
 assert.match(g.app.innerHTML,/<mark>전에 문제를 일으킨 그 손님이래요\.<\/mark>/);assert.equal((g.app.innerHTML.match(/<mark>/g)||[]).length,1);
 // 찾은 뒤에도 문장마다 안내가 나온다(‘따로 있어’는 빠진다)
 g.click('segment',{id:'rule'});assert.equal(hint(),seg('rule').hint);g.click('segment',{id:'person'});assert.equal(hint(),seg('person').found);
 // 점원의 말이 마지막 자료여도 방금 누른 문장의 안내가 남는다
 const l=open('face','hook');l.click('next');l.click('item',{id:'face-alert'});l.click('item',{id:'face-photo'});l.click('item',{id:'face-clerk'});l.click('segment',{id:'person'});
 assert.ok(l.app.innerHTML.includes(seg('person').found));assert.match(l.app.innerHTML,/이 말은 맞을까\? 1\/3/);
 l.click('judge',{id:'different'});l.click('judge-next');assert.doesNotMatch(l.app.innerHTML,/class="tap-hint"/,'cleared at the next sentence');
});
// 5. 사건 5(혼자): 답이 아닌 곳을 누르면 ‘아님’ 표시와 짧은 중립 안내
test('request 5: in case 5 a wrong tap shows a short neutral line (and the 아님 tag); the right tap clears it; still no 모아 lines',()=>{
 const S5=D.cases.share,g=open('share','hook');g.click('next');
 const hint=()=>{const m=/<p class="tap-hint" role="status">([^<]*)<\/p>/.exec(g.app.innerHTML);return m?m[1]:'';};
 g.click('item',{id:'share-log'});assert.equal(hint(),'');
 g.click('part',{id:'time'});assert.equal(hint(),'이건 루루가 직접 한 부분이야.');assert.match(g.app.innerHTML,/class="tried-tag">아님/);assert.equal(g.state().evidence.length,stateAt('share','check').evidence.length);
 g.click('part',{id:'text'});assert.equal(hint(),S5.log.find(x=>x.id==='text').hint);
 g.click('part',{id:'pic'});assert.equal(hint(),'');assert.equal(g.state().evidence.includes('share-log'),true);
 g.click('item',{id:'share-photo'});for(const id of ['date','people']){g.click('skyline',{id});assert.equal(hint(),S5.photos.lines.find(x=>x.id===id).hint);}
 g.click('item',{id:'share-compare'});assert.equal(hint(),'','opening another record clears it');g.click('said',{id:'post'});assert.equal(hint(),S5.compare.post.hint);
 for(const h of [...S5.log,...S5.photos.lines,S5.compare.post].map(x=>x.hint).filter(Boolean)){assert.ok([...h].length<=34,h);assert.doesNotMatch(h,/틀렸|아니야\.|다시/,'neutral: '+h);}
 assert.doesNotMatch(g.app.innerHTML,/class="who">모아/);
});
// 7. 구청에 묻기: 받은 답을 모두 쌓아 보여 주고, 물어본 질문과 이어지는 자료 버튼에 표시
test('request 7: answers pile up in the order asked; the answer no longer gives away the empty cell; related record buttons are marked',()=>{
 const C=D.cases.camp;assert.doesNotMatch(JSON.stringify(C.asks),/안 적혀/);
 for(const a of C.asks)assert.ok(E.checks.camp.includes(a[3]),a[0]+' → related record');
 const g=open('camp','hook');assert.doesNotMatch(g.app.innerHTML,/answer-item/);
 g.click('ask',{id:'criteria'});g.click('ask',{id:'who'});
 const items=()=>[...g.app.innerHTML.matchAll(/<div class="answer-item"( role="status")?><p class="answer-q">([^<]*)<\/p>/g)].map(m=>[m[2],!!m[1]]);
 assert.deepEqual(items(),[['무엇을 기준으로 뽑았어요?',false],['누가 책임지는 부서예요?',true]]);
 for(const id of ['criteria','who'])assert.ok(g.app.innerHTML.includes(C.asks.find(a=>a[0]===id)[2]));
 g.click('ask',{id:'criteria'});assert.deepEqual(items().map(x=>x[1]),[true,false],'asking again only moves the live answer');assert.deepEqual(st(g).asked,['criteria','who']);
 g.click('next');
 assert.deepEqual(cls(g,'asked').map(b=>b['data-id']),['camp-page','camp-criteria']);assert.equal((g.app.innerHTML.match(/class="asked-tag">물어본 것</g)||[]).length,2);
 const one=open('camp','check');assert.deepEqual(cls(one,'asked').map(b=>b['data-id']),['camp-page'],'stateAt asks only 누가 책임지는 부서예요');
 const none=open('photo','check');assert.equal(cls(none,'asked').length,0);
});
// 9. 조치 선택지 길이: 사건 4·5는 세 선택지 길이가 비슷하고, 정답이 혼자 가장 길지 않다
test('request 9: in cases 4 and 5 the three options are about the same length and the best one is not the longest',()=>{
 for(const [k,best] of [['camp','accurate'],['share','explain']]){const o=D.cases[k].choose.options,len=o.map(x=>[...x.label].length);
  assert.ok(Math.max(...len)-Math.min(...len)<=3,k+' '+len);assert.ok(len[o.findIndex(x=>x.id===best)]<Math.max(...len)||len.filter(n=>n===Math.max(...len)).length>1,k+' best is not alone the longest '+len);}
});
// 11·13. 사건 5 후속 조사 판단은 사실 문장, 사건 3 점검표 ‘완료’ 근거에 실행 기록
test('request 11·13: the case 5 follow-up judgment is a statement of fact (confirmed); the finished checklist row cites what was actually done',()=>{
 const j=D.cases.share.follow.judge;assert.equal(j.text,'게시물과 게시판을 본 사람은 DM을 보지 못했어.');assert.equal(E.followAnswers.share,'confirmed');
 for(const c of Object.values(D.cases))for(const x of [...c.judges,c.follow.judge])assert.doesNotMatch(x.text,/(해도|안 해도|안 알려도|막아도|올려도) (돼|된다|괜찮)/,'no “may/need not” sentence among the judgments: '+x.text);
 assert.equal(D.cases.share.follow.places.find(p=>p.id==='dm').who,'모아 한 명');
 const r1=D.cases.face.follow.rows[0];assert.equal(r1.status,'완료');assert.match(r1.proof,/공지문/);assert.match(r1.proof,/알림 기록 세 건/);assert.match(r1.proof,/담당자 확인/);
});
// 저장: version 6 저장(이번 수정 전)으로 이어하기
test('old saves: a version 6 save from before this change resumes on screen — case 4 judgment 3 and the case 5 follow-up show as not done yet and can be done from the notebook',()=>{
 const v6=JSON.parse(JSON.stringify(E.reduce(E.reduce(stateAt('share','reflect'),{type:'next'}),{type:'next'})));
 v6.version=6;v6.evidence=v6.evidence.filter(id=>id!=='camp-bus');v6.follows.share.judgment='different';v6.reflections.camp={q1:'기준표를 보고',q2:''};v6.reporter={name:'하늘',number:'10203'};
 const g=createGame({storage:{[KEY]:JSON.stringify(v6)}});assert.match(text(g.app.innerHTML),/이어하기/);assert.match(text(g.app.innerHTML),/나의 조사 보고서부터/);
 g.click('start');const s=st(g);
 assert.equal(s.version,8);assert.equal(E.stepOf(s.scene),'report');assert.equal(s.completed,true);assert.deepEqual(s.judgments.camp,['unknown','different','legacy']);assert.equal(s.follows.share.judgment,'legacy');
 assert.ok(s.evidence.includes('camp-bus'));assert.deepEqual(s.reflections.camp,{q1:'기준표를 보고',q2:''});assert.deepEqual(s.reporter,{name:'하늘',number:'10203'});
 assert.match(g.app.innerHTML,/3\. “솔숲마을 신청자들은 지난 프로그램 참여 횟수가 적어, 이 항목에서 받은 점수도 낮았어\.”<\/p><p class="v-pick"><span class="v-none">이전 저장에서 넘어와 아직 안 함/);
 g.click('notebook');const nb=g.snap().modalBody;assert.match(nb,/남은 판단 해 보기/);assert.match(nb,/후속 조사 해 보기/);
 g.click('revisit',{scene:E.sceneOf('camp','check')});assert.match(g.app.innerHTML,/이 말은 맞을까\? 3\/3/);assert.match(g.app.innerHTML,/이전 저장에서 넘어와 아직 하지 않은 판단이야/);
 g.click('judge',{id:'confirmed'});assert.deepEqual(st(g).judgments.camp,['unknown','different','confirmed']);
 g.click('notebook');g.click('revisit',{scene:E.sceneOf('share','follow')});g.click('follow-judge',{id:'confirmed'});assert.equal(g.state().follows.share.judgment,'confirmed');
 assert.deepEqual(E.restore(g.stored()),st(g));
});

// ── 2026-11-12 외부 검토: 사건 4 표의 접근성 이름 ──
// 표 머리(‘마을·신청·합격’, ‘항목·비중’)는 aria-hidden이라, 줄마다 열 이름이 든 이름을 준다.
// 누르는 줄(버튼) = aria-label(버튼 안 글을 대신하므로 두 번 읽히지 않는다). 읽기만 하는 줄(div) = 숫자 앞 화면 읽기 전용 글자(.sr).
// 보이는 글은 그대로. 모든 줄이 같은 형식이고 찾기 전후로 같아 정답이 드러나지 않는다. 브라우저가 계산한 이름은 tests/a11y-camp-browser.cjs가 본다.
const label=b=>(/aria-label="([^"]*)"/.exec(b.attrs)||[])[1];
const visible=h=>h.replace(/<span class="sr">[^<]*<\/span>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const inner=(html,act)=>[...html.matchAll(new RegExp('<button ([^>]*data-act="'+act+'"[^>]*)>([^]*?)</button>','g'))].map(m=>({attrs:m[1],html:m[2]}));
test('a11y: every village button is named “마을, 신청 N명, 합격 N명”; the same form for all rows, before and after the find; criteria rows say 비중',()=>{
 const C=D.cases.camp,g=open('camp','check');g.click('item',{id:'camp-results'});
 const check=()=>{const rows=inner(g.app.innerHTML,'village');assert.equal(rows.length,4);
  rows.forEach((b,i)=>{const r=C.results.rows[i];
   assert.equal(label(b),r.name+', 신청 '+r.apply+'명, 합격 '+r.pass+'명, 평균 참여 '+r.joins+'번, 참여 점수 '+r.score+'점');
   assert.equal(visible(b.html),r.name+' '+r.apply+'명 '+r.pass+'명 '+r.joins+'번 '+r.score+'점','what is seen is what is named');
   assert.doesNotMatch(b.html,/class="sr"/,'the label is the name; no extra hidden text inside (nothing is read twice)');
   for(const part of [r.name,r.apply+'명',r.pass+'명'])assert.ok(label(b).includes(part),'the name contains what is seen: '+part);});
  return rows;};
 let rows=check();assert.ok(rows.every(b=>!/<mark>/.test(b.html)),'no row is singled out before the find');
 assert.equal(new Set(rows.map(b=>b.attrs.replace(/data-id="[^"]*"/,'').replace(/aria-label="[^"]*"/,''))).size,1,'all four buttons carry the same attributes apart from the id and the name');
 const before=rows.map(label);
 g.click('village',{id:'city'});check();assert.equal(g.state().evidence.includes('camp-results'),false);
 g.click('village',{id:'pine'});assert.deepEqual(check().map(label),before,'names do not change after the find');assert.equal(g.state().evidence.includes('camp-results'),true,'the find still works');
 assert.match(g.app.innerHTML,/class="score-headrow" aria-hidden="true"/,'the visual header stays hidden from screen readers (the rows carry the column names)');
 // 선발 기준표: 안 연 줄 ‘… 비중 열기’, 연 줄 ‘항목, 비중 0.5’(둘 다 aria-label), 다 연 뒤의 읽기 줄은 글 안에 ‘비중’
 g.click('item',{id:'camp-criteria'});
 let crit=inner(g.app.innerHTML,'crit');assert.equal(crit.length,4);
 crit.forEach((b,i)=>{const r=C.criteria.rows[i];assert.equal(label(b),(r.hidden?'가린 항목':r.name)+' 비중 열기');assert.doesNotMatch(b.html+label(b),/0\.\d/,'weight neither shown nor read before opening');});
 assert.doesNotMatch(crit.map(label).join(' '),/영업비밀/,'the hidden row is not named before opening');
 g.click('crit',{id:'join'});crit=inner(g.app.innerHTML,'crit');
 assert.equal(label(crit[0]),'지난 구청 프로그램 참여 횟수, 비중 0.5');assert.equal(visible(crit[0].html),'지난 구청 프로그램 참여 횟수 0.5');assert.doesNotMatch(crit[0].html,/class="sr"/);
 for(const id of ['essay','order','secret'])g.click('crit',{id});
 const done=[...g.app.innerHTML.matchAll(/<div class="score-row[^"]*">([^]*?)<\/div>/g)].map(m=>m[1]);
 assert.deepEqual(done.map(h=>h.replace(/<span class="num">/g,' ').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim()),C.criteria.rows.map(r=>r.name+' 비중 '+r.w.toFixed(1)));
 assert.deepEqual(done.map(visible),C.criteria.rows.map(r=>r.name+' '+r.w.toFixed(1)));
});


// ── 2026-11-12 수정 요청 10·후속 6: 사건 4·5 미리 알리기 ‘고치기’ 화면 ──
// 칸마다 이름·초안 한 줄·선택지 버튼(aria-pressed), 모든 칸을 골라야 붙이기, 붙이면 칸마다 ✓/! 태그와 한 줄, 판정은 다시 볼 칸 이름.
// 보고서·수첩: ‘고친 안내문’ + 최종 문장 + 다시 볼 칸 + 판정. 이 기능 전에 카드로 붙인 사건 4·5 안내문은 ‘이전 방식으로 작성한 안내문’.
const NF=D.notice.fix;
const fbOf=(html,id)=>{const m=new RegExp('<p class="card-fb ([^"]*)" id="fb-slot-'+id+'"><span class="fb-tag">([^<]*)</span>([^<]*)</p>').exec(html);return m?{cls:m[1],tag:unesc(m[2]),say:unesc(m[3]).trim()}:null;};
const opt=(html,slot,value)=>parseTags(html,'button').find(b=>b['data-act']==='notice-slot'&&b['data-id']===slot&&b['data-value']===value);
const postBtn=html=>parseTags(html,'button').find(b=>b['data-act']==='notice-post');
const paperOf=html=>{const m=/<div class="(notice-paper[^"]*)">([\s\S]*?)<\/div>/.exec(html);return {cls:m[1],text:textOf(m[2])};};
test('request 6: case 4 — a short 구청 notice with three blanks and an overstated line; choose a sentence for every slot, then post; feedback names the slots to look at again',()=>{
 const C=D.cases.camp,X=C.notice.fix,g=open('camp','notice');let h=g.app.innerHTML;
 assert.ok(h.includes('<h1 tabindex="-1">구청 안내문 초안, 어디를 고칠까?</h1>'));assert.ok(textOf(h).includes(NF.task));
 assert.deepEqual(paperOf(h),{cls:'notice-paper draft',text:'처음 초안 · 구청 안내문 · 청소년 겨울 캠프 AI가 하는 일: (비어 있음) 담당 부서: (비어 있음) 재검토 방법: (비어 있음) AI가 뽑으니 절대 차별이 없어요.'});
 const groups=[...h.matchAll(/<div class="fix-slot" role="group" aria-label="([^"]*)">/g)].map(m=>unesc(m[1]));
 assert.deepEqual(groups,['칸 1. AI가 하는 일, 초안: (비어 있음)','칸 2. 담당 부서, 초안: (비어 있음)','칸 3. 재검토 방법, 초안: (비어 있음)','칸 4. 마지막 문장, 초안: “AI가 뽑으니 절대 차별이 없어요.”']);
 const labels=slot=>[...h.matchAll(new RegExp('data-id="'+slot+'" data-value="[^"]*" aria-pressed="false"><span class="pick-box" aria-hidden="true"></span><span>([^<]*)</span>','g'))].map(m=>unesc(m[1]));
 assert.deepEqual(labels('role'),['비워 두기','AI가 알아서 명단을 정해요.','AI가 점수를 매기고, 담당자가 최종 확인해요.']);
 assert.deepEqual(labels('appeal'),['비워 두기','이의가 있으면 14일 안에 재검토를 신청해요.','신청자 모두의 이름과 점수를 공개해요.']);
 assert.deepEqual(labels('claim'),['그대로 두기','이 문장 빼기','점수에 쓰는 항목과 비중을 알려 드려요.']);
 assert.ok('disabled' in postBtn(h));assert.match(h,/<p class="hint">모든 칸을 골라야 붙일 수 있어\. 남은 칸 4개\.<\/p>/);
 // 세 칸만 고르면 아직
 g.click('notice-slot',{id:'role',value:'camp-auto'});g.click('notice-slot',{id:'office',value:'camp-office'});g.click('notice-slot',{id:'appeal',value:'camp-everyone'});h=g.app.innerHTML;
 assert.equal(opt(h,'role','camp-auto')['aria-pressed'],'true');assert.ok('disabled' in postBtn(h));assert.match(h,/남은 칸 1개\./);
 g.click('notice-slot',{id:'claim',value:'keep'});h=g.app.innerHTML;assert.equal('disabled' in postBtn(h),false);assert.match(h,/안내문을 한 번 붙이면 다음으로 갈 수 있어\./);
 g.click('notice-post');h=g.app.innerHTML;
 assert.deepEqual(fbOf(h,'role'),{cls:'fb-again',tag:'! AI가 하는 일 · 다시 보기',say:X.say['camp-auto']});
 assert.deepEqual(fbOf(h,'office'),{cls:'fb-ok',tag:'✓ 담당 부서',say:D.notice.fb.must.in});
 assert.deepEqual(fbOf(h,'appeal'),{cls:'fb-again',tag:'! 재검토 방법 · 다시 보기',say:C.notice.cards.find(c=>c.id==='camp-everyone').clash});
 assert.deepEqual(fbOf(h,'claim'),{cls:'fb-again',tag:'! 마지막 문장 · 다시 보기',say:D.notice.fb.promise.in});
 assert.match(h,/<div class="finding again notice-verdict" role="status"><p class="again-head">고칠 점이 있어<\/p><p>다시 볼 칸: AI가 하는 일, 재검토 방법, 마지막 문장\. 그 칸을 다시 골라 붙여 볼 수 있어\. 이대로 넘어가도 돼\.<\/p><\/div>/);
 assert.equal(opt(h,'role','camp-auto')['aria-describedby'],'fb-slot-role');
 assert.deepEqual(paperOf(h),{cls:'notice-paper',text:'구청 안내문 · 청소년 겨울 캠프 AI가 알아서 명단을 정해요. 담당 부서는 구청 청소년과예요. 신청자 모두의 이름과 점수를 공개해요. AI가 뽑으니 절대 차별이 없어요.'});
 assert.ok(!parseTags(h,'button').find(b=>b['data-act']==='next'&&'disabled' in b),'posted once: can move on');
 // 한 칸을 바꾸면 피드백을 숨기고 다시 붙이기 안내
 g.click('notice-slot',{id:'role',value:'camp-role'});h=g.app.innerHTML;assert.equal(h.includes('card-fb'),false);assert.match(h,/<p class="hint repost" role="status">칸을 바꿨어\. ‘고친 안내문 다시 붙이기’를 누르면 다시 확인해 줄게\.<\/p>/);
 g.click('notice-slot',{id:'appeal',value:'camp-appeal'});g.click('notice-slot',{id:'claim',value:'drop'});g.click('notice-post');h=g.app.innerHTML;
 assert.deepEqual(fbOf(h,'claim'),{cls:'fb-ok',tag:'✓ 마지막 문장',say:D.notice.fb.promise.out});assert.match(h,/<p><strong>다 맞았어\.<\/strong> 이제 쓰는 사람이 미리 알고 고를 수 있어\./);
 g.click('notice-slot',{id:'claim',value:'camp-items'});g.click('notice-post');assert.deepEqual(fbOf(g.app.innerHTML,'claim'),{cls:'fb-ok',tag:'✓ 마지막 문장',say:X.say['camp-items']});
 // 수첩: 고친 안내문 문장과 판정
 g.click('notebook');const nb=g.snap().modalBody;
 assert.match(nb,/<div class="notice-sum"><p class="n-kind">고친 안내문<\/p><ul class="notice-list"><li>AI가 점수를 매기고, 담당자가 최종 확인해요\.<\/li><li>담당 부서는 구청 청소년과예요\.<\/li><li>이의가 있으면 14일 안에 재검토를 신청해요\.<\/li><li>점수에 쓰는 항목과 비중을 알려 드려요\.<\/li><\/ul><p class="v-pick">판정: <span class="v-tag v-ok">다 맞음<\/span><\/p><\/div>/);
 g.click('close');assert.deepEqual(E.restore(g.stored()),st(g));
 // 새로고침: 고른 칸과 붙인 안내문 그대로
 const again=createGame({storage:{[KEY]:g.stored()}});again.click('start');h=again.app.innerHTML;assert.equal(opt(h,'claim','camp-items')['aria-pressed'],'true');assert.match(h,/다 맞았어\./);
});
test('request 6: case 5 (alone) — the 냥스타 notice; ‘#AI그림’ alone is not enough without the real sky; tags only, the clash reason stays, one-line verdict',()=>{
 const C=D.cases.share,g=open('share','notice');let h=g.app.innerHTML;
 assert.ok(h.includes('<h1 tabindex="-1">냥스타 홍보문 초안, 어디를 고칠까?</h1>'));assert.match(h,/<p class="line plain">알리는 건 벌이 아니야\./);
 assert.equal(paperOf(h).text,'처음 초안 · 냥스타 홍보문 · 루루 이번 주 토요일, 뒷산에서 만나요! 밤하늘 관찰 모임 AI로 만든 부분: (비어 있음) 토요일에 이 그림처럼 보일 거예요. 덧붙일 것: (비어 있음)');
 assert.ok(opt(h,'more','blank'));assert.match(h,/data-value="blank" aria-pressed="false"><span class="pick-box" aria-hidden="true"><\/span><span>덧붙이지 않기<\/span>/);
 for(const [id,o] of [['ai','share-tag'],['sky','keep'],['more','share-settings']])g.click('notice-slot',{id,value:o});g.click('notice-post');h=g.app.innerHTML;
 assert.deepEqual(fbOf(h,'ai'),{cls:'fb-ok',tag:'✓ AI로 만든 부분',say:''},'alone: tag only');
 assert.deepEqual(fbOf(h,'sky'),{cls:'fb-again',tag:'! 실제 하늘 · 다시 보기',say:''});
 assert.deepEqual(fbOf(h,'more'),{cls:'fb-again',tag:'! 덧붙일 것 · 다시 보기',say:C.notice.cards.find(c=>c.id==='share-settings').clash},'the clash reason stays');
 assert.match(h,/<div class="finding again notice-verdict" role="status"><p><strong>고칠 점이 있어<\/strong> · 다시 볼 칸: 실제 하늘, 덧붙일 것\.<\/p><\/div>/);
 assert.equal((h.match(/class="line moa"/g)||[]).length,0,'still no 모아 lines');
 g.click('notice-slot',{id:'sky',value:'share-real'});g.click('notice-slot',{id:'more',value:'blank'});g.click('notice-post');h=g.app.innerHTML;
 assert.match(h,/<p><strong>다 맞았어\.<\/strong><\/p>/);assert.equal(paperOf(h).text,'냥스타 홍보문 · 루루 이번 주 토요일, 뒷산에서 만나요! 밤하늘 관찰 모임 #AI그림 실제 뒷산에서는 은하수가 거의 안 보여요.');
 g.click('next');g.click('notebook');assert.match(textOf(g.snap().modalBody),/고친 안내문 이번 주 토요일, 뒷산에서 만나요! 밤하늘 관찰 모임 #AI그림 실제 뒷산에서는 은하수가 거의 안 보여요\. 판정: 다 맞음/);
});
test('request 6 and old saves: a case 4/5 notice posted by card picking before this change shows as ‘이전 방식으로 작성한 안내문’ and stays card-style on its screen',()=>{
 const fin=JSON.parse(JSON.stringify(E.reduce(E.reduce(stateAt('share','reflect'),{type:'next'}),{type:'next'})));
 const v6=JSON.parse(JSON.stringify(fin));v6.version=6;v6.evidence=v6.evidence.filter(id=>id!=='camp-bus');v6.follows.share.judgment='different';
 v6.notices.camp={picked:['camp-role','camp-office','camp-appeal'],posted:['camp-role','camp-office','camp-appeal']};v6.notices.share={picked:['share-ai','share-same'],posted:['share-ai','share-same']};
 const g=createGame({storage:{[KEY]:JSON.stringify(v6)}});g.click('start');const s=st(g);
 assert.deepEqual(s.notices.camp,v6.notices.camp);assert.deepEqual(s.notices.share,v6.notices.share,'never rewritten');
 const rep=g.app.innerHTML,card=k=>textOf([...rep.matchAll(/<section class="case-card" id="report-(\w+)"[\s\S]*?<\/section>/g)].find(m=>m[1]===k)[0]);
 assert.match(card('camp'),/미리 알리기 이전 방식으로 작성한 안내문 AI가 점수를 매기고, 담당자가 최종 확인해요\. 담당 부서는 구청 청소년과예요\. 이의가 있으면 14일 안에 재검토를 신청해요\. 판정: 다 맞음/);
 assert.match(card('share'),/미리 알리기 이전 방식으로 작성한 안내문 토요일에 이 그림처럼 보일 거예요\. \(지킬 수 없는 약속\) 은하수 그림은 AI로 만들었어요\. 빠짐: 실제 뒷산에서는 은하수가 거의 안 보여요\. 판정: 고칠 점 있음/);
 assert.equal(textOf(rep).includes('고친 안내문'),false);
 for(const k of ['photo','writing','face'])assert.equal(card(k).includes('이전 방식'),false,'cases 1~3 have no label');
 g.click('notebook');g.click('revisit',{scene:E.sceneOf('camp','choose')});g.click('next');g.click('next');g.click('next');assert.equal(g.state().scene,E.sceneOf('camp','notice'));let h=g.app.innerHTML;
 assert.ok(h.includes('<h1 tabindex="-1">'+D.cases.camp.notice.title+'</h1>'));assert.ok(textOf(h).includes(D.notice.task));assert.equal(h.includes('fix-slot'),false);assert.match(h,/안내문 다시 붙이기<\/button>/);
 g.click('notice-pick',{id:'camp-items'});g.click('notice-post');assert.equal(st(g).notices.camp.mode,undefined,'still card-style');
 // version 6 저장이 사건 4 미리 알리기에 서 있고 아무것도 안 골랐으면 → 고치기 화면, 이어서 다음으로
 const at6=JSON.parse(JSON.stringify(stateAt('camp','notice')));at6.version=6;at6.evidence=at6.evidence.filter(id=>id!=='camp-bus');at6.notices.camp={picked:[],posted:null};
 const g2=createGame({storage:{[KEY]:JSON.stringify(at6)}});g2.click('start');h=g2.app.innerHTML;
 assert.match(h,/구청 안내문 초안, 어디를 고칠까\?/);assert.equal((h.match(/class="fix-slot"/g)||[]).length,4);assert.match(h,/저장된 곳부터 이어서 해요\./);
 for(const x of E.noticeSlots.camp)g2.click('notice-slot',{id:x.id,value:x.options[0]});g2.click('notice-post');g2.click('next');assert.equal(E.stepOf(g2.state().scene),'reflect','continues past the step');
 // 카드를 고르던 중이던 version 7 저장 → 카드 고르기 그대로
 const mid=JSON.parse(JSON.stringify(stateAt('camp','notice')));mid.version=7;mid.notices.camp={picked:['camp-office'],posted:null};
 const g3=createGame({storage:{[KEY]:JSON.stringify(mid)}});g3.click('start');h=g3.app.innerHTML;
 assert.ok(h.includes(D.cases.camp.notice.title));assert.equal(h.includes('fix-slot'),false);assert.equal(parseTags(h,'button').find(b=>b['data-id']==='camp-office')['aria-pressed'],'true');
});

// ── 2026-11-12 후속 요청 1~5 ──
test('follow-up 1: case 4 village results carry the average participation and its score; the numbers, the rule, judgment 3 and its feedback agree; the bus stays a question',()=>{
 const C=D.cases.camp,T=C.results,j=C.judges[2];
 assert.deepEqual(T.head,['마을','신청','합격','평균 참여','참여 점수']);
 assert.equal(T.rows.reduce((n,r)=>n+r.apply,0),60);assert.equal(T.rows.reduce((n,r)=>n+r.pass,0),40,'40 places kept');
 for(const r of T.rows){assert.ok(r.joins<5,'below the cap');assert.equal(r.score,Math.min(100,r.joins*20),r.name+' score = 20 per time (cap 100)');}
 const pine=T.rows.find(r=>r.target);for(const k of ['joins','score','pass'])assert.equal(Math.min(...T.rows.map(r=>r[k])),pine[k],'솔숲마을 lowest '+k);
 assert.match(T.rule,/1번 참여할 때마다 20점/);assert.match(T.rule,/5번 이상은 100점/);assert.match(T.rule,/평균/);
 assert.equal(E.answers.camp[2],'confirmed');assert.ok(j.right.includes(pine.joins+'번')&&j.right.includes(pine.score+'점'),'feedback uses the record numbers');
 assert.doesNotMatch(j.text+j.right+j.wrong,/버스/);assert.match(C.after,/버스 때문에 못 갔는지, 일부러 차별했는지는 기록만으로는 몰라/,'not confirmed from the records');
 assert.match(C.checks.find(x=>x.id==='camp-results').fact,/0\.5번/);
 // 화면: 표에 다섯 칸과 규칙, 판단 3의 볼 자료에서 바로 보인다
 const g=open('camp','check');g.click('item',{id:'camp-results'});let h=g.app.innerHTML;
 assert.ok(h.includes('<span class="num">0.5번</span><span class="num">10점</span>'));assert.ok(h.includes(`<p class="score-rule">${T.rule}</p>`));
 g.click('village',{id:'pine'});g.click('item',{id:'camp-bus'});assert.ok(g.app.innerHTML.includes('버스가 적어서 참여하기 어려웠을까? 더 확인하려면 어떤 자료가 필요할까?'));
 // 수첩·보고서의 사실 문장
 g.click('notebook');assert.ok(g.snap().modalBody.includes(C.checks.find(x=>x.id==='camp-results').fact));
});
test('follow-up 2: no 모아 speech box without a line — records with only extra detail show a neutral ‘자료 설명’; checked over every record of cases 1~5',()=>{
 for(const k of E.CASES){const c=D.cases[k],g=open(k,'choose');g.click('back');
  for(const x of c.checks){g.click('item',{id:x.id});const h=g.app.innerHTML;
   for(const m of h.matchAll(/<div class="finding[^"]*" role="status">([\s\S]*?)<\/div>/g))if(/<details/.test(m[1])||!/class="line|<p/.test(m[1]))assert.match(m[1],/class="line/,k+' '+x.id+': a speech box needs a line');
   if(!c.solo&&!(x.finding&&x.finding.length)&&x.more){assert.ok(h.includes(`<details class="more record-note"><summary>자료 설명</summary><p>${x.more}</p></details>`),k+' '+x.id+' extra detail as a neutral note');}}}
 // 재현 경로 두 곳: 사건 3 점원의 말을 다시 열기, 사건 4 기준표를 모두 연 순간
 const f=open('face','choose');f.click('back');f.click('item',{id:'face-clerk'});assert.doesNotMatch(f.app.innerHTML,/<div class="finding[^"]*" role="status"><details/);
 const s=open('camp','check');s.click('item',{id:'camp-criteria'});for(const r of D.cases.camp.criteria.rows)s.click('crit',{id:r.id});assert.doesNotMatch(s.app.innerHTML,/<div class="finding[^"]*" role="status"><details/);
});
test('follow-up 3: the record found last stays on screen when the first judgment appears; 볼 자료 moves to the judged record; 다음 말 보기 still switches',()=>{
 const g=open('face','check');
 g.click('item',{id:'face-alert'});g.click('item',{id:'face-clerk'});g.click('segment',{id:D.cases.face.clerkSegments.find(x=>x.found).id});
 g.click('item',{id:'face-photo'});let h=g.app.innerHTML;
 assert.equal(E.checked(g.state(),'face'),true);
 const pressedItem=()=>parseTags(g.app.innerHTML,'button').find(b=>b['data-act']==='item'&&b['aria-pressed']==='true')?.['data-id'];
 assert.equal(pressedItem(),'face-photo','the photo the student just opened stays');assert.match(h,/<p class="evidence-head"><span>자료<\/span> · 얼굴 비교 사진<\/p>/);
 assert.match(h,/이 말은 맞을까\? 1\/3/);
 g.click('source',{id:'face-alert'});assert.equal(pressedItem(),'face-alert','볼 자료 moves to the record');
 g.click('item',{id:'face-photo'});g.click('judge',{id:'different'});assert.equal(pressedItem(),'face-photo','judging does not move it');
 g.click('judge-next');g.click('judge',{id:'confirmed'});g.click('judge-next');assert.equal(pressedItem(),'face-photo','third judgment uses the photo');
 // 사건 5도 같다(마지막 자료 DM과 게시물)
 const s=open('share','check');for(const x of D.cases.share.checks)s.click('item',{id:x.id});
 s.click('item',{id:'share-log'});s.click('part',{id:'pic'});s.click('item',{id:'share-photo'});s.click('skyline',{id:'sky'});s.click('item',{id:'share-compare'});s.click('said',{id:'dm'});
 assert.equal(parseTags(s.app.innerHTML,'button').find(b=>b['data-act']==='item'&&b['aria-pressed']==='true')['data-id'],'share-compare');
 // 이어하기(보던 자료가 없음)는 첫 판단의 근거 자료로
 const r=open('face','check');const st0=JSON.parse(JSON.stringify(r.state()));
 const t=createGame({storage:{[KEY]:JSON.stringify(Object.assign(st0,{evidence:[...st0.evidence,...E.checks.face]}))}});t.click('start');
 assert.equal(parseTags(t.app.innerHTML,'button').find(b=>b['data-act']==='item'&&b['aria-pressed']==='true')['data-id'],'face-alert');
});
test('follow-up 4: case 4 follow-up needs both changed lines; one line says one more; both are saved separately and survive a reload',()=>{
 const F=D.cases.camp.follow,g=open('camp','follow');let h=g.app.innerHTML;
 assert.ok(h.includes(F.task));assert.equal(F.task,'예전과 달라진 두 줄을 모두 찾아 눌러 봐.');
 g.click('change',{id:'use'});assert.ok(g.app.innerHTML.includes(F.segments.find(x=>x.id==='use').hint),'unchanged line: neutral feedback kept');
 g.click('change',{id:'office'});h=g.app.innerHTML;assert.ok(h.includes('<p class="tap-hint" role="status">하나를 찾았어. 달라진 줄이 하나 더 있어.</p>'));
 assert.deepEqual(st(g).follows.camp,{marks:{office:'found'},judgment:null});assert.equal(parseTags(h,'button').some(b=>b['data-act']==='follow-judge'),false,'no judgment yet');
 assert.ok(h.includes('<mark>담당 부서: 구청 청소년과.</mark> <span class="cell-tag">찾음</span>'));
 const re=createGame({storage:{[KEY]:g.stored()}});re.click('start');assert.ok(re.app.innerHTML.includes('<span class="cell-tag">찾음</span>'),'reload keeps the found line');
 re.click('change',{id:'appeal'});h=re.app.innerHTML;assert.deepEqual(st(re).follows.camp.marks,{office:'found',appeal:'found'});
 assert.ok(parseTags(h,'button').some(b=>b['data-act']==='follow-judge'),'both lines: the judgment appears');assert.equal(h.includes('하나를 찾았어'),false);
});
test('follow-up 5: the privacy law note says it covers fully automated decisions, excludes automatic administrative dispositions, and is not applied as such to the game’s 구청',()=>{
 const g=open('photo','hook');g.click('settings');g.click('sources');const t=textOf(g.snap().modalBody);
 assert.match(t,/완전히 자동으로 내린 결정/);assert.match(t,/행정기본법 제20조/);assert.match(t,/담당자가 명단을 최종 확인하므로, 이 조항이 그대로 적용된다고 볼 수는 없어요/);
 assert.match(t,/문제의 짜임만 참고했어요/);assert.match(t,/사업자의 의무예요\. 이용자 한 사람 한 사람의 의무를 정한 조항은 아니에요/,'case 5 distinction kept');
});
