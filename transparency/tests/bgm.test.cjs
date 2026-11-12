// 배경음악(ui/bgm.js) 동작 검사 — 브라우저 없이 가짜 Audio·문서·시계로. 실제로 소리가 들리는지는 보지 못한다(사람 몫).
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const SRC=fs.readFileSync(path.join(__dirname,'..','ui','bgm.js'),'utf8');
const KEY='ethicity.transparency.settings.v1',PROGRESS='ethicity.transparency.progress.v1';

// 가짜 환경: Audio(만든 순서 기록, play는 약속을 돌려줌), document(이벤트·hidden), #app(class), localStorage, 손으로 돌리는 시계.
function env({store={},blocked=false,reject=false,noAudio=false}={}){
 let now=0,seq=0;const timers=new Map(),audios=[],listeners={},observers=[];
 const app={className:'at-title'};
 class Audio{constructor(){this.paused=true;this.volume=1;this.loop=false;this.preload='auto';this.src='';this.currentTime=0;this.plays=0;audios.push(this);}
  play(){this.plays++;if(reject)return Promise.reject(new Error('NotAllowedError'));this.paused=false;return Promise.resolve();}
  pause(){this.paused=true;}addEventListener(){}}
 const localStorage={getItem:k=>{if(blocked)throw new Error('blocked');return k in store?store[k]:null;},setItem:(k,v)=>{if(blocked)throw new Error('blocked');store[k]=String(v);}};
 const document={hidden:false,getElementById:id=>id==='app'?app:null,addEventListener:(t,fn)=>{(listeners[t]||(listeners[t]=[])).push(fn);}};
 const sb={document,localStorage,Date:{now:()=>now},Promise,JSON,Math,Object,
  setInterval:(fn,ms)=>{const id=++seq;timers.set(id,{fn,ms,next:now+ms});return id;},clearInterval:id=>timers.delete(id),
  MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}}};
 if(!noAudio)sb.Audio=Audio;
 sb.window=sb;vm.createContext(sb);vm.runInContext(SRC,sb);
 const fire=(t,e={})=>(listeners[t]||[]).forEach(fn=>fn(e));
 const tick=ms=>{const end=now+ms;while(true){const due=[...timers.entries()].filter(([,t])=>t.next<=end).sort((a,b)=>a[1].next-b[1].next)[0];if(!due)break;now=due[1].next;due[1].next+=due[1].ms;due[1].fn();}now=end;};
 const flush=()=>new Promise(r=>setImmediate(r));
 const goTo=cls=>{app.className=cls;observers.forEach(o=>o.fn());};
 return {B:sb.TransparencyBgm,audios,store,document,fire,tick,flush,goTo,app,timers};
}
const byName=(e,n)=>e.audios.find(a=>a.src.endsWith(n==='main'?'noche-del-taller.mp3':'searching-motif.mp3'));

test('bgm: which song where — 조사곡 only while looking at records (직접 확인·후속 조사), 메인곡 everywhere else',()=>{
 const {B}=env();
 for(const [cls,t] of [['at-title','main'],['step-intro','main'],['step-hook','main'],['step-check','search'],['step-check judging','search'],['step-choose','main'],['step-result','main'],
  ['step-follow','search'],['step-notice','main'],['step-reflect','main'],['step-end','main'],['step-report','main'],['','main']])assert.equal(B.trackFor(cls),t,cls);
});
test('bgm: nothing is loaded before the first press; then the main song loops at about 0.14 after a 1-second rise',async()=>{
 const e=env();e.goTo('at-title');e.tick(3000);assert.equal(e.audios.length,0,'no audio before a user gesture (first screen not blocked)');
 e.fire('pointerdown');await e.flush();
 assert.equal(e.audios.length,1);const m=byName(e,'main');assert.equal(m.src,'assets/bgm/noche-del-taller.mp3');assert.equal(m.loop,true);assert.equal(m.preload,'none');assert.equal(m.paused,false);
 e.tick(500);assert.ok(m.volume>0.05&&m.volume<0.1,'rising '+m.volume);e.tick(600);assert.equal(m.volume,0.14);
 e.fire('keydown');e.fire('pointerdown');await e.flush();assert.equal(e.audios.length,1,'later presses do not reload');assert.equal(m.plays,1);
});
test('bgm: moving to a record screen crossfades to the search song in about a second; the same song is never restarted; coming back crossfades again',async()=>{
 const e=env();e.fire('pointerdown');await e.flush();e.tick(1100);const m=byName(e,'main');
 m.currentTime=42;e.goTo('step-check');await e.flush();const s=byName(e,'search');
 assert.ok(s&&!s.paused&&!m.paused,'both play while crossing');e.tick(500);assert.ok(m.volume>0.04&&m.volume<0.1&&s.volume>0.04&&s.volume<0.1,`crossing ${m.volume} ${s.volume}`);
 e.tick(600);assert.equal(m.paused,true,'old song paused after the fade');assert.equal(s.volume,0.14);assert.equal(s.loop,true);
 // 직접 확인 → 판단 중 → 선택 전 다시 직접 확인처럼 같은 곡이면 그대로
 s.currentTime=10;e.goTo('step-check judging');e.goTo('step-follow');await e.flush();e.tick(1100);assert.equal(s.plays,1,'same song: not restarted');assert.equal(s.currentTime,10);assert.equal(e.audios.length,2);
 e.goTo('step-choose');await e.flush();assert.equal(m.paused,false);assert.equal(m.currentTime,42,'main resumes where it was (no restart from 0)');e.tick(1100);assert.equal(s.paused,true);assert.equal(m.volume,0.14);
 assert.equal(e.audios.length,2,'two audio elements at most');
});
test('bgm: hiding the tab pauses, coming back resumes the same song from where it was',async()=>{
 const e=env();e.fire('pointerdown');await e.flush();e.tick(1100);const m=byName(e,'main');m.currentTime=30;
 e.document.hidden=true;e.fire('visibilitychange');assert.equal(m.paused,true);
 e.goTo('step-check');await e.flush();assert.equal(e.audios.length,1,'nothing starts while hidden');
 e.document.hidden=false;e.goTo('step-hook');e.fire('visibilitychange');await e.flush();assert.equal(m.paused,false);assert.equal(m.currentTime,30);e.tick(1100);assert.equal(m.volume,0.14);
});
test('bgm: the setting is its own key (not the progress save), defaults to on, survives a reload, and turning it off stops the music',async()=>{
 const store={[PROGRESS]:'{"version":8}'};const e=env({store});assert.equal(e.B.isOn(),true,'default on');
 e.fire('pointerdown');await e.flush();e.tick(1100);const m=byName(e,'main');
 e.fire('change',{target:{id:'opt-bgm',checked:false}});assert.equal(e.B.isOn(),false);assert.equal(m.paused,true);
 assert.deepEqual(JSON.parse(store[KEY]),{bgm:false});assert.equal(store[PROGRESS],'{"version":8}','progress save untouched');
 e.goTo('step-check');await e.flush();assert.equal(e.audios.length,1,'off: no new song');
 const r=env({store});assert.equal(r.B.isOn(),false,'reload keeps off');r.fire('pointerdown');await r.flush();assert.equal(r.audios.length,0);
 r.fire('change',{target:{id:'opt-bgm',checked:true}});await r.flush();assert.equal(JSON.parse(store[KEY]).bgm,true);assert.equal(r.audios.length,1);assert.equal(r.audios[0].paused,false);
 r.fire('change',{target:{id:'other',checked:false}});assert.equal(r.B.isOn(),true,'other checkboxes ignored');
});
test('bgm: blocked storage, refused playback and no Audio at all never throw',async()=>{
 const b=env({blocked:true});assert.equal(b.B.isOn(),true);b.fire('pointerdown');await b.flush();b.fire('change',{target:{id:'opt-bgm',checked:false}});assert.equal(b.B.isOn(),false,'works for this window');
 const r=env({reject:true});r.fire('pointerdown');await r.flush();r.tick(2000);assert.equal(r.audios[0].paused,true,'refused: stays quiet');r.goTo('step-check');await r.flush();
 const n=env({noAudio:true});n.fire('pointerdown');await n.flush();n.goTo('step-check');await n.flush();assert.equal(n.B.state().cur,'search');
 const bad=env({store:{[KEY]:'{oops'}});assert.equal(bad.B.isOn(),true,'broken setting → default on');
});
