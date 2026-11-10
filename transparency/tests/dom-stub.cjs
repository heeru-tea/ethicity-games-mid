// 브라우저 없이 게임 화면 코드를 돌리기 위한 작은 DOM 흉내(render-snapshot.test.cjs 전용).
// 진짜 DOM이 아니다: 화면 코드가 만든 HTML 문자열과, 초점·스크롤·창 열기 같은 호출 순서만 기록한다.
// index.html의 <script src> 순서대로 읽으므로 화면 코드를 여러 파일로 나눠도 그대로 쓴다.
'use strict';
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..');
const FIXED_NOW=new Date(2026,10,10,9,30,0).getTime(); // 보고서 날짜가 흔들리지 않게 고정(2026년 11월 10일)

function scriptList(){
 const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
 return [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1]);
}
const unesc=v=>v.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function parseTags(html,tag){
 const out=[];
 for(const m of html.matchAll(new RegExp('<'+tag+'\\b([^>]*)>','g'))){
  const attrs={};
  for(const a of m[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[a[1]]=a[2]===undefined?'':unesc(a[2]);
  out.push(attrs);
 }
 return out;
}
const camel=s=>s.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
const datasetOf=attrs=>Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[camel(k.slice(5)),v]));
const cssEscape=v=>String(v).replace(/[^\w-]/g,c=>'\\'+c);

// opts: search(주소 뒤 ?…), storage({키:값} 처음 저장), blocked(저장소 읽기부터 막힘), visualTop(.visual의 화면 위치)
function createGame(opts={}){
 const fx=[]; // 지난 기록 뒤에 일어난 호출(초점·스크롤·창)
 const log=x=>fx.push(x);
 const store=new Map(Object.entries(opts.storage||{}));
 const env={blocked:!!opts.blocked,failSet:false,visualTop:opts.visualTop||0,resetChecked:true};
 const listeners={document:{},window:{},modal:{}},pending=[];
 const on=where=>(type,fn)=>{(listeners[where][type]||(listeners[where][type]=[])).push(fn);};
 const headerHtml=fs.readFileSync(path.join(ROOT,'index.html'),'utf8').replace(/<main[\s\S]*?<\/main>/,'').replace(/<script[\s\S]*$/,'');

 let active=null;
 // 화면 조각 하나(초점을 받을 수 있는 것). live()가 false면 다시 그려져 사라진 요소.
 function node(desc,{attrs={},tag='div',live=()=>true,disabled=false,extra={}}={}){
  const n={tagName:tag.toUpperCase(),dataset:datasetOf(attrs),disabled,
   get isConnected(){return live();},
   hasAttribute:a=>a in attrs,getAttribute:a=>a in attrs?attrs[a]:null,
   focus(){log('focus '+desc);if(!n.disabled)active=n;},
   scrollIntoView(o){log('scrollIntoView '+desc+' '+JSON.stringify(o||null));},
   closest:()=>null,matches:()=>false,...extra};
  return n;
 }
 const body=node('body',{tag:'body'});active=body;
 function holder(name){let html='',gen=0;const h={className:'',textContent:'',get gen(){return gen;},get innerHTML(){return html;},set innerHTML(v){html=String(v);gen++;},
  contains:el=>!!el&&el.owner===h&&el.isConnected};return Object.assign(h,{name});}
 const app=holder('app'),modalTitle=holder('modal-title'),modalBody=holder('modal-body'),saveStatus=holder('save-status');
 function buttonNode(attrs,owner){
  const gen=owner?owner.gen:0,desc='button['+['data-act','data-id','data-value','data-scene','data-case'].filter(a=>a in attrs).map(a=>attrs[a]).join('|')+']';
  const n=node(desc,{attrs,tag:'button',disabled:'disabled' in attrs,live:()=>!owner||owner.gen===gen});n.owner=owner||null;return n;
 }
 // 화면 코드가 초점을 되돌릴 때 쓰는 선택자(button[data-act="…"][data-id="…"])만 푼다.
 app.querySelector=sel=>{
  const m=/^button((?:\[[\w-]+="[^"]*"\])+)$/.exec(sel);if(!m)throw new Error('흉내 못 내는 선택자(#app): '+sel);
  const want=[...m[1].matchAll(/\[([\w-]+)="([^"]*)"\]/g)].map(x=>[x[1],x[2].replace(/\\(.)/g,'$1')]);
  const hit=parseTags(app.innerHTML,'button').find(a=>want.every(([k,v])=>a[k]===v));
  return hit?buttonNode(hit,app):null;
 };
 const modal={open:false,
  showModal(){log('showModal');modal.open=true;},
  // 진짜 브라우저처럼 close 이벤트는 바로 오지 않고, 지금 처리 중인 누르기가 끝난 뒤에 온다(fire 끝에서 부른다).
  close(){log('modal.close');if(!modal.open)return;modal.open=false;pending.push(()=>{log('modal close event');for(const f of listeners.modal.close||[])f({});});},
  addEventListener:on('modal'),
  getBoundingClientRect:()=>({left:100,right:500,top:100,bottom:400})};
 const has=(h,s)=>h.innerHTML.includes(s);
 const document={title:'블랙박스를 열어보는 고양이',addEventListener:on('document'),
  get activeElement(){return active;},
  querySelector(sel){
   if(sel==='#modal')return modal;
   if(sel==='#app')return app;
   if(sel==='#save-status')return saveStatus;
   if(sel==='#modal-title')return modalTitle;
   if(sel==='#modal-body')return modalBody;
   if(sel==='h1')return has(app,'<h1')?node('h1',{tag:'h1'}):null;
   if(sel==='#work')return has(app,'id="work"')?node('#work'):null;
   if(sel==='.visual')return has(app,'class="visual"')?node('.visual',{extra:{getBoundingClientRect:()=>({top:env.visualTop})}}):null;
   if(sel==='#work .judge [data-act="judge"]'){const hit=parseTags(app.innerHTML,'button').find(a=>a['data-act']==='judge');return hit?buttonNode(hit,app):null;}
   if(sel==='#reset-reporter')return has(modalBody,'id="reset-reporter"')?{checked:env.resetChecked}:null;
   throw new Error('흉내 못 내는 선택자: '+sel);
  },
  querySelectorAll(sel){
   if(sel!=='canvas[data-crop]')throw new Error('흉내 못 내는 선택자(All): '+sel);
   return parseTags(app.innerHTML+modalBody.innerHTML,'canvas').filter(a=>'data-crop' in a).map(a=>({dataset:datasetOf(a),width:Number(a.width),height:Number(a.height),
    getContext:()=>({clearRect:()=>{},drawImage:(img,...r)=>log('draw '+r.join(','))})}));
  },
  getElementById(id){return has(app,'id="'+id+'"')?node('#'+id):null;}};
 const images=[];
 class Image{constructor(){this.complete=false;this.naturalWidth=0;this.onload=null;this.onerror=null;this.src='';this.settled=false;images.push(this);}}
 class FixedDate extends Date{constructor(...a){if(a.length)super(...a);else super(FIXED_NOW);}static now(){return FIXED_NOW;}}
 const localStorage={
  getItem(k){if(env.blocked)throw new Error('blocked');return store.has(k)?store.get(k):null;},
  setItem(k,v){if(env.blocked||env.failSet)throw new Error('blocked');store.set(k,String(v));},
  removeItem(k){store.delete(k);}};
 const sb={console,URLSearchParams,document,localStorage,Image,Date:FixedDate,CSS:{escape:cssEscape},location:{search:opts.search||''},
  addEventListener:on('window'),scrollTo:(x,y)=>log('scrollTo '+x+','+y),print:()=>log('print')};
 sb.window=sb;
 vm.createContext(sb);
 const scripts=scriptList();
 for(const src of scripts)vm.runInContext(fs.readFileSync(path.join(ROOT,src),'utf8'),sb,{filename:src});
 const KEY=sb.TransparencyGame.storageKey;

 const fields=new Map();
 const fire=(where,type,e)=>{for(const f of listeners[where][type]||[])f(e);};
 const settle=()=>{while(pending.length)pending.shift()();};
 // 지금 화면에서 누를 수 있는 버튼을 찾는다: 열린 창 → 본문(#app) → 머리말·창 머리(index.html)
 function findButton(act,data={}){
  const want=a=>a['data-act']===act&&Object.entries(data).every(([k,v])=>a['data-'+k]===String(v));
  const places=modal.open?[[modalBody,modalBody.innerHTML],[null,headerHtml]]:[[app,app.innerHTML],[null,headerHtml]];
  for(const [owner,html] of places){const hit=parseTags(html,'button').find(want);if(hit)return buttonNode(hit,owner);}
  return null;
 }
 const game={env,images,scripts,E:sb.TransparencyEngine,D:sb.TransparencyStory,api:sb.TransparencyGame,app,modal,clicked:new Set(),
  storageKey:KEY,stored:()=>store.has(KEY)?store.get(KEY):null,
  state:()=>sb.TransparencyGame.getState(),
  // 지금 초점이 있는 요소의 data-*(없으면 null). 키보드로 같은 버튼을 다시 누르는 검사에 쓴다.
  focused:()=>active&&active.isConnected?{tag:active.tagName,...active.dataset}:null,
  has:(act,data)=>{const b=findButton(act,data);return !!b&&!b.disabled;},
  buttons:act=>parseTags(modal.open?modalBody.innerHTML:app.innerHTML,'button').filter(a=>!act||a['data-act']===act),
  // 버튼 누르기. 화면에 없는 버튼이면 대본 잘못이므로 멈춘다(disabled 버튼은 눌러도 아무 일 없어야 한다).
  click(act,data){
   const b=findButton(act,data);if(!b)throw new Error(`화면에 없는 버튼: ${act} ${JSON.stringify(data||{})}`);
   if(!b.disabled){active=b;game.clicked.add(act);}
   const e={target:{closest:()=>b},clientX:300,clientY:200};
   if(b.owner===modalBody||(!b.owner&&modal.open))fire('modal','click',e);
   fire('document','click',e);settle();
  },
  clickNothing(){fire('document','click',{target:{closest:()=>null}});},
  // 창 바깥(어두운 곳) 누르기 / 창 안 빈 곳 누르기
  clickBackdrop(inside){const e={target:modal,clientX:inside?300:10,clientY:inside?200:10};e.target.closest=()=>null;fire('modal','click',e);fire('document','click',e);delete modal.closest;settle();},
  // 글 칸에 입력. kind: reflect(q1·q2) · note · reporter(name·number) · other(관계없는 칸) · none(입력칸 아님) · fake(입력칸이 아닌데 data-reflect만 있음)
  // o: type(기본 input, compositionend·beforeinput도 보낼 수 있다) · composing(입력기 조합 중) · data·inputType(beforeinput)
  // 돌려주는 값: 화면 코드가 손댄 뒤의 입력칸 글(value)·글자 수(count)·상한 안내(limit)
  input(kind,key,value,o={}){
   const sel={reflect:`data-reflect="${key}"`,note:'data-note',reporter:`data-reporter="${key}"`}[kind];
   if(sel&&!has(app,sel))throw new Error('화면에 없는 입력칸: '+sel);
   // 같은 화면(다시 그리기 전)의 같은 입력칸은 같은 요소다: 이어지는 이벤트(beforeinput → input)가 같은 target을 받는다.
   const fid=app.gen+':'+kind+':'+key;let f=fields.get(fid);
   if(!f){const count={textContent:''},empty={hidden:null},limit={textContent:''},box=kind==='reflect'||kind==='note'?{querySelector:s=>s==='.count-n'?count:s==='.empty-note'?empty:s==='.limit-note'?limit:null}:null;
    const dataset=kind==='reflect'?{reflect:key}:kind==='note'?{note:''}:kind==='reporter'?{reporter:key}:{};
    f={count,empty,limit,box,target:{matches:()=>kind!=='none'&&kind!=='fake',dataset:kind==='fake'?{reflect:key}:dataset,closest:()=>box}};fields.set(fid,f);}
   const {count,empty,limit,box,target}=f,len=String(value??'').length;Object.assign(target,{value,selectionStart:len,selectionEnd:len});
   fire('document',o.type||'input',{target,isComposing:!!o.composing,data:o.data,inputType:o.inputType});
   if(box)log(`count=${count.textContent} emptyHidden=${empty.hidden}`+(limit.textContent?' limit='+limit.textContent:''));
   return {value:target.value,count:count.textContent,limit:limit.textContent,emptyHidden:empty.hidden};
  },
  windowEvent(type){fire('window',type,{});},
  // 그림 불러오기 흉내: ok(src)가 참이면 열림, 아니면 실패. 새로 생긴 시도까지 차례로 끝낸다.
  settleImages(ok){
   for(let i=0;i<images.length;i++){const img=images[i];if(img.settled||!img.src)continue;img.settled=true;
    if(ok(img.src)){img.complete=true;img.naturalWidth=1536;log('img-load '+img.src);if(img.onload)img.onload();}
    else{log('img-error '+img.src);if(img.onerror)img.onerror();}}
  },
  // 지금 화면 기록 한 장
  snap(){
   const rec={cls:app.className,html:app.innerHTML,modalOpen:modal.open,modalTitle:modalTitle.textContent,modalBody:modalBody.innerHTML,
    save:saveStatus.textContent,stored:game.stored(),title:document.title,state:JSON.stringify(game.state()),art:JSON.stringify(sb.TransparencyGame.art()),fx:fx.join('\n')};
   fx.length=0;return rec;
  }};
 return game;
}
module.exports={createGame,scriptList,parseTags,FIXED_NOW};
