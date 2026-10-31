/* 윤리시티 · AI 윤리 탐험대 — 연대성 「마지막 한 사람까지」
   gameId: solidarity · 공통 팩: ethicity-elementary-common-v1 (수정하지 않고 불러오기만 함) */
(function(){
'use strict';
const GAME_ID='solidarity';
const COMMON_BASE='../shared/ethicity-elementary-common-v1';
const STORE_KEY='ethicity.solidarity.save', SOUND_KEY='ethicity.solidarity.sound';
const M=window.ETHICITY_COMMON_MANIFEST;
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let assets=null;
const cp=p=>COMMON_BASE+'/'+p;
const DEMO=/[?&]demo\b/.test(location.search);let SPEED=1;
function post(msg){if(DEMO)return;try{window.parent.postMessage(Object.assign({gameId:GAME_ID},msg),'*')}catch(e){}}
function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

/* ---------- 공통 자산 표시 (manifest 좌표 그대로 사용) ---------- */
function icon(id,size=24){const f=M.icons.icons[id];const W=512,H=192;return `<span class="gs-icon" aria-hidden="true" style="width:${size}px;height:${size}px;background-image:url('${cp(M.icons.image)}');background-size:${W/f.w*100}% ${H/f.h*100}%;background-position:${f.x/(W-f.w)*100}% ${f.y/(H-f.h)*100}%"></span>`}
function portrait(id,expr='neutral',cls=''){const c=M.characters[id],i=Math.max(0,c.expressions.indexOf(expr));return `<span class="gs-portrait ${cls}" role="img" aria-label="${esc(c.name)}" style="background-image:url('${cp(c.portraits)}');background-position:${i/3*100}% 0"></span>`}
function walkSvg(id,x,y,scale=.85,dir='down',frame=1,cls='spr'){const c=M.characters[id],row=c.directions.indexOf(dir),w=96*scale,h=128*scale;return `<svg class="${cls}" x="${x-48*scale}" y="${y-120*scale}" width="${w}" height="${h}" viewBox="${frame*96} ${row*128} 96 128"><image href="${cp(c.walk)}" width="384" height="512" style="image-rendering:pixelated"/></svg>`}
function propSvg(id,x,y,height){const p=M.props.frames[id],w=height*p.w/p.h;return `<svg x="${x-w/2}" y="${y-height}" width="${w}" height="${height}" viewBox="${p.x} ${p.y} ${p.w} ${p.h}" pointer-events="none"><image href="${cp(M.props.image)}" width="1024" height="1024" style="image-rendering:pixelated"/></svg>`}
function effect(id,x,y,size=56){const e=M.effects.effects[id];if(!e)return;const s=document.createElementNS(NS,'svg');s.setAttribute('x',x-size/2);s.setAttribute('y',y-size/2);s.setAttribute('width',size);s.setAttribute('height',size);s.setAttribute('pointer-events','none');s.innerHTML=`<image href="${cp(M.effects.image)}" width="512" height="320" style="image-rendering:pixelated"/>`;const fx=$('fx');if(!fx)return;fx.appendChild(s);let f=reduced?3:0;const set=()=>s.setAttribute('viewBox',`${f*64} ${e.row*64} 64 64`);set();if(reduced){setTimeout(()=>s.remove(),e.durationMs);return}const iv=setInterval(()=>{f++;if(f>7){clearInterval(iv);s.remove();return}set()},1000/M.effects.fps)}
let soundOn=false,lastMiss=0;function sfx(id){if(!assets||!soundOn)return;if(id==='miss'){const n=Date.now();if(n-lastMiss<1500)return;lastMiss=n}assets.playSound(id)}

/* ---------- 게임 전용 자산 (assets/) ---------- */
const BOX={"residents":[[33,119,83,148],[199,121,78,146],[352,119,80,148],[511,123,79,144],[33,400,83,154],[184,421,116,133],[352,399,82,155],[504,402,92,152]],"buildings":[[12,12,300,217],[336,12,300,215],[660,12,300,231],[12,291,300,218],[336,291,300,229],[660,291,300,255]],"icons":[[12,12,198,200],[236,12,168,200],[460,12,200,126],[12,236,123,200],[236,236,200,137],[460,236,200,165],[12,460,200,170],[236,460,200,186],[460,460,200,123]]};
const SZ={"residents":[627,627],"buildings":[972,558],"icons":[672,672]}; // 시트 크기(건물·아이콘은 Higgsfield 실사 그림)
const SHEET={residents:'assets/residents.png',buildings:'assets/buildings.png',icons:'assets/game-icons.png'};
const RES={elder:0,vn:1,np:2,deaf:3,phone:4,mine:5,chief:6,merchant:7},BLD={house:0,old:1,mine:2,hall:3,shelter:4,center:5},GIC={multi:0,light:1,chief:2,fast:3,sand:4,buddy:5,bc:6,goods:7,buoy:8};
function artSvg(sheet,i,x,y,w,h,cls=''){const b=BOX[sheet][i];return `<svg class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${b.join(' ')}" preserveAspectRatio="xMidYMax meet"><image href="${SHEET[sheet]}" width="${SZ[sheet][0]}" height="${SZ[sheet][1]}"/></svg>`}
function art(sheet,i,cls='gs-art'){const b=BOX[sheet][i];return `<svg class="${cls}" viewBox="${b.join(' ')}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><image href="${SHEET[sheet]}" width="${SZ[sheet][0]}" height="${SZ[sheet][1]}"/></svg>`}
function resOf(h){return h.t==='foreign'?(h.lang==='NP'?RES.np:RES.vn):RES[h.t]}
function bldOf(h){return h.t==='mine'?BLD.mine:h.t==='elder'?BLD.old:BLD.house}
function toast(t,ms=2400){$('toast').textContent=t;$('toast').hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>$('toast').hidden=true,ms)}
function robotSay(text,expr='explaining'){return `<div class="gs-talk">${portrait('robot',expr)}<div class="ee-speech"><p class="ee-speaker">안내 로봇</p><p>${text}</p></div></div>`}

/* ---------- 데이터 ---------- */
const TYPES={phone:{name:'스마트폰 주민',prep:2},elder:{name:'홀로 사는 어르신',prep:4},foreign:{name:'외국인 노동자',prep:3},deaf:{name:'청각장애인',prep:3},mine:{name:'우리 집',prep:2}};
const BASE_HOUSES=[
 {id:'h1',x:170,y:165,t:'phone'},{id:'h2',x:300,y:135,t:'elder'},{id:'h3',x:430,y:175,t:'phone'},{id:'h4',x:565,y:145,t:'foreign',lang:'VN'},{id:'h5',x:700,y:170,t:'deaf'},{id:'h6',x:835,y:150,t:'phone'},
 {id:'h7',x:215,y:300,t:'elder'},{id:'h8',x:370,y:305,t:'mine'},{id:'h9',x:525,y:290,t:'phone'},{id:'h10',x:665,y:315,t:'foreign',lang:'VN'},{id:'h11',x:815,y:290,t:'elder'},{id:'h12',x:290,y:440,t:'phone'}];
const EXTRA_HOUSES=[{id:'h13',x:110,y:250,t:'elder'},{id:'h14',x:745,y:235,t:'foreign',lang:'NP'}];
const BASE={x:520,y:520},SHELTER={x:905,y:520},HALL={x:110,y:450,r:240};
const HELPERS={me:{id:'jiho',name:'나',skill:'우리 집 열쇠',tag:'짐 옮기기 가능'},saebom:{id:'saebom',name:'새봄',skill:'수어 가능',tag:'청각장애인 집 빠름'},daon:{id:'daon',name:'다온',skill:'베트남어 가능',tag:'베트남어 집 빠름'}};
const ROUNDS=[
 {n:1,title:'첫 폭우',rain:80,T:58,maxY:360,houses:'base',helpers:true,bc:1,intro:'AI 홍수 경보 시스템이 처음 가동됐어요. 그런데 경보는 스마트폰이 있고 한국어를 쓰는 주민에게만 가요.'},
 {n:2,title:'장마',rain:110,T:56,maxY:390,houses:'all',helpers:true,bc:1,road:22,intro:'더 센 비가 와요. 주민 회의에서 고친 시스템이 작동해요. 새 이웃도 이사 왔어요. 이번엔 <b>돌발 상황</b>이 생길지도 몰라요.'},
 {n:3,title:'다음 여름',rain:120,T:50,maxY:400,houses:'all',helpers:false,bc:1,intro:'봉사단은 졸업했어요. 이번에는 아무도 달려가지 못해요. 우리가 남긴 시스템만으로 마을이 버틸 수 있을까요?'}];
const UPGRADES=[
 {id:'multi',name:'다국어 경보',desc:'외국인 주민에게 모국어로 바로 경보',cost:1},
 {id:'light',name:'불빛·진동 알림기',desc:'청각장애인 집에 바로 경보',cost:1},
 {id:'chief',name:'이장 전화 연락망',desc:'어르신 집에 3초 뒤 전화 경보',cost:1},
 {id:'fast',name:'AI 예측 고도화',desc:'경보가 4초 빨라짐 (이미 받는 사람만)',cost:2},
 {id:'sand',name:'우리 집 모래주머니',desc:'우리 집 짐은 자동으로 지켜짐',cost:1},
 {id:'buddy',name:'이웃 짝꿍 제도',desc:'어르신마다 이웃 짝꿍이 직접 알림 (회의 2부터)',cost:1,late:true}];
const VOICES1=[[RES.elder,'전화로 한 번만 알려 주면 바로 나가지.'],[RES.vn,'한국어 문자는 무슨 말인지 몰라요.'],[RES.deaf,'소리는 못 들어요. 불빛이면 돼요.'],[RES.merchant,'상인회: AI를 더 좋게 하면 모두 빨라지잖아요!']];
const VOICES2=[[RES.elder,'전화가 와도 혼자 나가기 무서워.'],[RES.np,'네팔어 쓰는 친구도 이사 왔어요.'],['saebom','봉사단: 우리 내년엔 졸업이야. 우리 없이도 될까?']];
const DECOR=[['tree',40,200,78],['tree',975,265,84],['tree',640,450,70],['tree',990,430,66],['shrub',395,240,26],['shrub',610,235,24],['shrub',880,385,26],['bench',700,510,30],['shrub',160,385,26],['tree',30,560,70]];

/* ---------- 상태 ---------- */
let G=null,R=null,raf=0,last=0,paused=true,sel=null;
function newGame(sid,name,me){return{v:2,sid,name,me,round:0,owned:[],goods:0,results:[],chosen:[[],[]],logs:[[],[],[]],stage:'round',ending:null,reflection:'',cases:{title:'',source:'',date:'',url:'',who:'',share:[],shareWhy:'',compare:''},check:[false,false,false],stance:null,stanceWhy:'',created:Date.now()}}
function save(){if(DEMO)return;try{localStorage.setItem(STORE_KEY,JSON.stringify(G))}catch(e){}}
function loadSaved(){if(DEMO)return null;try{const g=JSON.parse(localStorage.getItem(STORE_KEY)||'null');return g&&g.v===2&&typeof g.sid==='string'&&Array.isArray(g.results)?g:null}catch(e){return null}}
function logIt(t){if(G&&G.logs[G.round])G.logs[G.round].push(t)}
function progress(n){n=n||Math.min(6,G.results.length+G.round);if(n<=(G.prog||0))return;G.prog=n;post({type:'ethicity:progress',current:n,total:6})}
function houseList(r){return (r.houses==='base'?BASE_HOUSES:[...BASE_HOUSES,...EXTRA_HOUSES]).map(h=>({...h}))}
function waterY(t){const p=Math.max(0,Math.min(1,t/R.T));return 75+(R.maxY-75)*Math.pow(p,1.35)}
function floodTime(y){return R.T*Math.pow(Math.max(0,(y-12-75))/(R.maxY-75),1/1.35)}
function helperChar(k){return k==='me'?(G?G.me:'jiho'):HELPERS[k].id}

/* ---------- 지도 (1280×720 논리 화면, 내부 좌표는 1000×600 기준을 1.2배) ---------- */
function drawMap(){const m=$('map');m.innerHTML=`
 <defs><radialGradient id="litG"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".95"/><stop offset=".55" stop-color="#f7cf62" stop-opacity=".55"/><stop offset="1" stop-color="#f3cf72" stop-opacity="0"/></radialGradient><filter id="tagSh" x="-20%" y="-40%" width="140%" height="190%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#000" flood-opacity=".45"/></filter><linearGradient id="riv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f9fb3"/><stop offset="1" stop-color="#72b7c4"/></linearGradient><pattern id="wave" width="60" height="20" patternUnits="userSpaceOnUse"><path d="M0 10 Q15 2 30 10 T60 10" fill="none" stroke="#fff9e777" stroke-width="3">${reduced?'':'<animate attributeName="d" dur="1.4s" repeatCount="indefinite" values="M0 10 Q15 2 30 10 T60 10;M0 10 Q15 18 30 10 T60 10;M0 10 Q15 2 30 10 T60 10"/>'}</path></pattern></defs>
 <rect width="1280" height="720" fill="#6f7a5c"/>
 <image href="assets/map-real.jpg" x="0" y="0" width="1280" height="720" preserveAspectRatio="xMidYMid slice"/>
 <rect width="1280" height="720" fill="#fff9e7" opacity=".12"/>
 <g id="world" transform="translate(40,0) scale(1.2)">
 <g id="hall"><circle cx="${HALL.x}" cy="${HALL.y}" r="${HALL.r}" fill="#f3cf7214" stroke="#f3cf7288" stroke-dasharray="8 8"/>${artSvg('buildings',BLD.hall,HALL.x-46,HALL.y-62,92,88)}<text x="${HALL.x}" y="${HALL.y+44}" text-anchor="middle" font-size="14" font-weight="700" fill="#294b40" stroke="#fff9e7" stroke-width="4" paint-order="stroke">마을회관</text></g>
 <g>${artSvg('buildings',BLD.shelter,SHELTER.x-62,SHELTER.y-78,124,104)}<text x="${SHELTER.x}" y="${SHELTER.y+42}" text-anchor="middle" font-size="15" font-weight="700" fill="#294b40" stroke="#fff9e7" stroke-width="4" paint-order="stroke">대피소</text><text id="shelterCount" x="${SHELTER.x}" y="${SHELTER.y-50}" text-anchor="middle" font-size="16" font-weight="700" fill="#294b40" stroke="#fff9e7" stroke-width="4" paint-order="stroke"></text></g>
 <g>${artSvg('buildings',BLD.center,BASE.x-120,BASE.y-70,70,72)}<text x="${BASE.x-85}" y="${BASE.y+18}" text-anchor="middle" font-size="13" font-weight="700" fill="#294b40" stroke="#fff9e7" stroke-width="4" paint-order="stroke">청소년센터</text></g>
 <rect id="flood" x="-34" y="0" width="1068" height="78" fill="#8a7b62" opacity=".72"/>
 <rect id="floodEdge" x="-34" y="74" width="1068" height="8" fill="url(#wave)" opacity=".9"/>
 <g id="houses"></g><g id="dots"></g><g id="helpersG"></g><g id="fx"></g>
 <g class="rain" opacity=".35" pointer-events="none">${Array.from({length:46},(_,i)=>`<line x1="${(i*97)%1000}" y1="${(i*53)%600}" x2="${(i*97)%1000-8}" y2="${(i*53)%600+22}" style="animation-delay:${(i%10)/20}s"/>`).join('')}</g>
 </g>`}
function drawHouses(){$('houses').innerHTML=R.houses.map(h=>`<g class="house" id="g-${h.id}" data-house="${h.id}" tabindex="0" role="button" aria-label="${TYPES[h.t].name}${h.lang?(h.lang==='VN'?' 베트남어':' 네팔어'):''} 집" transform="translate(${h.x},${h.y})">
 <circle class="ring" r="52" fill="#f3cf7255" stroke="#bf7865" stroke-width="4"/>
 <ellipse class="glow" cx="0" cy="14" rx="66" ry="30" fill="url(#litG)" opacity="0"/><circle class="danger-ring" r="50" fill="none" stroke="#bf7865" stroke-width="5" stroke-dasharray="10 6"/>
 <rect class="base" x="-46" y="-50" width="92" height="80" fill="transparent"/>
 ${artSvg('buildings',bldOf(h),-46,-58,92,82,'bimg')}
 ${artSvg('residents',resOf(h),24,-34,34,58,'rimg')}
 ${h.lang?`<text x="58" y="-30" font-size="13" font-weight="700" fill="#294b40" stroke="#fff9e7" stroke-width="3" paint-order="stroke">${h.lang}</text>`:''}
 <g class="status" transform="translate(0,34)"></g>
 ${h.t==='mine'?`<g class="goods">${artSvg('icons',GIC.goods,-64,-20,30,30)}</g>`:''}
 </g>`).join('')}
function setStatus(h,txt,color='#294b40',buoy=false){const g=document.querySelector(`#g-${h.id} .status`);if(!txt){g.innerHTML='';return}const fill={'#5a8c65':'#2f6b45','#bf7865':'#b23f2c','#9a7417':'#8a6512'}[color]||color,w=Math.round([...txt].length*13+22+(buoy?20:0)),x0=-w/2;g.innerHTML=`<g filter="url(#tagSh)"><rect x="${x0}" y="-12" width="${w}" height="24" rx="12" fill="${fill}" stroke="#fffdf6" stroke-width="2"/></g>`+(buoy?artSvg('icons',GIC.buoy,x0+4,-10,20,20):'')+`<text x="${buoy?10:0}" y="5" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">${txt}</text>`}
function floatTxt(x,y,txt,color='#5a8c65'){const g=document.createElementNS(NS,'text');g.setAttribute('x',x);g.setAttribute('y',y);g.setAttribute('text-anchor','middle');g.setAttribute('font-size','18');g.setAttribute('font-weight','700');g.setAttribute('fill',color);g.setAttribute('stroke','#fff9e7');g.setAttribute('stroke-width','4');g.setAttribute('paint-order','stroke');g.classList.add('float');g.textContent=txt;$('fx').appendChild(g);setTimeout(()=>g.remove(),1300)}
function drawHelpers(){$('helpersG').innerHTML=Object.entries(R.helpers).map(([k,hp])=>`<g class="helper" id="hp-${k}" data-helper="${k}" transform="translate(${hp.x},${hp.y})"><ellipse cx="0" cy="0" rx="18" ry="5" fill="#294b4033"/><g class="body">${walkSvg(helperChar(k),0,0,.62,'down',1)}</g><text y="18" text-anchor="middle" font-size="12" font-weight="700" fill="#294b40" stroke="#fff9e7" stroke-width="4" paint-order="stroke">${k==='me'?M.characters[helperChar(k)].name+'(나)':HELPERS[k].name}</text><g class="hstat" transform="translate(0,-86)"></g></g>`).join('')}
function setWalk(k,dir,frame){const el=document.querySelector(`#hp-${k} .spr`);if(!el)return;const c=M.characters[helperChar(k)],row=c.directions.indexOf(dir);el.setAttribute('viewBox',`${frame*96} ${row*128} 96 128`)}
function renderDock(){const r=ROUNDS[G.round];$('dock').innerHTML=Object.entries(HELPERS).map(([k,h])=>{const hp=R.helpers[k],cid=helperChar(k),nm=k==='me'?M.characters[cid].name+'(나)':h.name;const st=!r.helpers?'졸업했어요':hp.task?hp.task.label:'대기 중 · 끌어서 보내기';return `<button class="hcard ${!r.helpers?'off':hp.task?'busy':''}" aria-pressed="${sel===k}" data-hcard="${k}" aria-label="${nm}, ${h.skill}, ${st}">${portrait(cid,hp.task?'explaining':'neutral')}<span><b>${nm}</b><small>${h.skill} · ${h.tag}</small><span class="st">${st}</span></span></button>`}).join('')+`<button class="ee-button bc" id="bcBtn" ${R.bcLeft<1||R.t<R.alertT||!r?'disabled':''}>${art('icons',GIC.bc,'gs-art" style="width:34px;height:30px')}마을방송<small>${R.bcLeft}회 · 회관 근처만</small></button>`;
 document.querySelectorAll('[data-hcard]').forEach(bindHelperDrag);$('bcBtn').onclick=broadcast}
function hudIcons(){$('safePill').innerHTML=`${icon('person',18)}<span id="safeTxt">대피 0/0</span>`;$('helpBtn').innerHTML=icon('help',24);setSoundBtn()}
function setSoundBtn(){$('soundBtn').innerHTML=icon(soundOn?'volume':'music',24);$('soundBtn').setAttribute('aria-pressed',soundOn);$('soundBtn').setAttribute('aria-label',soundOn?'효과음 끄기':'효과음 켜기')}

/* ---------- 라운드 ---------- */
function startRound(){const r=ROUNDS[G.round];R={...r,t:0,houses:houseList(r),helpers:{},bcLeft:r.bc,alertT:G.owned.includes('fast')?1:5,events:[],goodsSaved:0,dots:[],evacuated:0};
 for(const h of R.houses){h.warned=null;h.flooded=false;h.safe=false;h.ft=floodTime(h.y)}
 Object.keys(HELPERS).forEach((k,i)=>R.helpers[k]={x:BASE.x-50+i*50,y:BASE.y-20,task:null,dir:'down'});
 drawMap();drawHouses();drawHelpers();renderDock();updateHud();
 $('roundChip').textContent=`${r.n}라운드 · ${r.title}`;$('rainPill').textContent=`시간당 ${r.rain}mm`;$('goodsPill').hidden=false;updateGoods();
 if(G.owned.includes('sand')){const mine=R.houses.find(h=>h.t==='mine');if(mine)mine.sand=true}
 if(r.road&&r.helpers)R.events.push({at:r.road,fn:roadFlood});
 sfx('door');paused=false;last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop)}
function updateGoods(){$('goodsPill').innerHTML=`${art('icons',GIC.goods,'gs-art" style="width:20px;height:18px')}<span>짐 ${G.goods}</span>`}
const REMOTE=['방송','이장'];
function warn(h,via){if(h.warned!=null||h.flooded)return;h.warned=R.t;h.via=via;document.getElementById('g-'+h.id).classList.add('lit');
 if(G.round>=1&&h.t==='elder'&&REMOTE.includes(via)){h.hesitate=true;setStatus(h,'망설임…','#bf7865');floatTxt(h.x,h.y-96,'혼자는 무서워','#bf7865');if(!R.hesToast){R.hesToast=true;logIt('돌발: 망설이는 어르신');setTimeout(()=>{if(!paused)toast('돌발 상황! 어르신이 혼자 나가기 무서워 망설여요. 누군가 직접 가야 해요.',3600)},400)}}
 else{setStatus(h,'준비 중','#9a7417');h.leaveAt=R.t+TYPES[h.t].prep}
 if(G.owned.includes('buddy')&&h.t==='phone'){const e=R.houses.filter(o=>o.t==='elder'&&!o.buddy&&(o.warned==null||o.hesitate)&&Math.hypot(o.x-h.x,o.y-h.y)<220).sort((a,b)=>Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y))[0];if(e){e.buddy=true;R.events.push({at:R.t+2,fn:()=>{visit(e,'짝꿍');floatTxt(e.x,e.y-70,'짝꿍')}})}}}
function visit(h,by){if(h.flooded||h.safe)return;if(h.hesitate){h.hesitate=false;h.leaveAt=R.t+1;h.via=by;setStatus(h,'함께 출발','#5a8c65')}else warn(h,by)}
function systemAlerts(){for(const h of R.houses){if(h.t==='phone'||h.t==='mine')warn(h,'AI');if(h.t==='foreign'&&G.owned.includes('multi'))warn(h,'다국어');if(h.t==='deaf'&&G.owned.includes('light'))warn(h,'불빛')}
 if(G.owned.includes('chief'))R.events.push({at:R.t+3,fn:()=>R.houses.filter(h=>h.t==='elder').forEach(h=>{if(h.warned==null&&!h.flooded){warn(h,'이장');floatTxt(h.x,h.y-70,'전화')}})});
 for(const h of R.houses)if(h.warned!=null)floatTxt(h.x,h.y-70,'경보!');sfx('collect');
 const left=R.houses.filter(h=>h.warned==null);toast(`AI 경보 발송! 받지 못한 집 ${left.length}곳`,2600);renderDock()}
function broadcast(){if(paused||R.bcLeft<1||R.t<R.alertT)return;R.bcLeft--;logIt('마을방송');sfx('tap');effect('clue',HALL.x,HALL.y-70,64);const ring=document.createElementNS(NS,'circle');ring.setAttribute('cx',HALL.x);ring.setAttribute('cy',HALL.y);ring.setAttribute('r',10);ring.setAttribute('fill','none');ring.setAttribute('stroke','#f3cf72');ring.setAttribute('stroke-width','6');$('fx').appendChild(ring);let rr=10;const iv=setInterval(()=>{rr+=reduced?HALL.r:12;ring.setAttribute('r',rr);ring.setAttribute('opacity',Math.max(0,1-rr/HALL.r));if(rr>=HALL.r){clearInterval(iv);ring.remove()}},16);
 for(const h of R.houses){if(Math.hypot(h.x-HALL.x,h.y-HALL.y)>HALL.r||h.warned!=null)continue;if(h.t==='deaf'){floatTxt(h.x,h.y-70,'못 들음','#bf7865');continue}if(h.t==='foreign'&&!G.owned.includes('multi')){floatTxt(h.x,h.y-70,'무슨 말?','#bf7865');continue}warn(h,'방송');floatTxt(h.x,h.y-70,'방송')}renderDock()}
function sendHelper(k,houseId){const hp=R.helpers[k],h=R.houses.find(x=>x.id===houseId);if(!h||hp.task||!ROUNDS[G.round].helpers)return;
 if(h.flooded){toast('이미 물에 잠겼어요. 구조대를 기다려야 해요.');return}
 let mode='warn';if(h.t==='mine'){if(k!=='me'){toast('우리 집 열쇠는 나만 있어요.');return}if(h.goodsDone||h.sand){toast(h.sand?'모래주머니가 짐을 지키고 있어요.':'짐은 이미 옮겼어요.');return}mode='goods'}
 else if(h.warned!=null&&!h.hesitate){toast('이미 경보를 받은 집이에요.');return}
 if(h.targeted){toast('다른 봉사단원이 이미 가고 있어요.');return}
 const nm=k==='me'?'나':HELPERS[k].name;h.targeted=mode==='warn';logIt(mode==='goods'?`${nm} → 우리 집 짐 옮기기`:`${nm} → ${TYPES[h.t].name}${h.lang?'('+(h.lang==='VN'?'베트남어':'네팔어')+')':''}`);
 let work=2;if(mode==='goods')work=5;else if(h.t==='deaf')work=k==='saebom'?1:4.5;else if(h.t==='foreign')work=(k==='daon'&&h.lang==='VN')?1:4.5;
 const dist=Math.hypot(h.x-hp.x,h.y+40-hp.y),speed=R.slow?SLOW:170;hp.task={house:h,mode,phase:'go',t0:R.t,dur:dist/speed,sx:hp.x,sy:hp.y,tx:h.x+(k==='me'?-38:k==='saebom'?0:38),ty:h.y+66,work,label:mode==='goods'?'짐 옮기는 중':'달려가는 중'};
 hp.task.route=routeTo(hp.x,hp.y,hp.task.tx,hp.task.ty);{const q=along(hp.task.route,0);hp.dir=faceOf(q.dx,q.dy)}sfx('tap');renderDock()}
const SLOW=110;
const ROADS=[[-34,160,1034,160],[-34,422,1034,422],[79,160,79,600],[352,160,352,600],[646,160,646,600],[914,160,914,600]]; // 지도 위 길(내부 좌표)
/* ---------- 길 따라 걷기 (이동 시간은 그대로, 보이는 경로만 길을 따라감) ---------- */
function segX(a,b){const [x1,y1,x2,y2]=a,[x3,y3,x4,y4]=b,den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);if(Math.abs(den)<1e-9)return null;const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/den,u=-((x1-x2)*(y1-y3)-(y1-y2)*(x1-x3))/den;if(t<-1e-6||t>1+1e-6||u<-1e-6||u>1+1e-6)return null;return{x:x1+t*(x2-x1),y:y1+t*(y2-y1)}}
function onSeg(n,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,L=dx*dx+dy*dy,t=((n.x-x1)*dx+(n.y-y1)*dy)/L;if(t<-1e-6||t>1+1e-6)return null;return Math.hypot(n.x-(x1+dx*t),n.y-(y1+dy*t))<.5?t:null}
function nearestOnRoad(x,y){let b=null;for(const [x1,y1,x2,y2] of ROADS){const dx=x2-x1,dy=y2-y1,L=dx*dx+dy*dy,t=Math.max(0,Math.min(1,L?((x-x1)*dx+(y-y1)*dy)/L:0)),px=x1+dx*t,py=y1+dy*t,d=Math.hypot(x-px,y-py);if(!b||d<b.d)b={x:px,y:py,d}}return b}
function routeTo(sx,sy,tx,ty){const S=nearestOnRoad(sx,sy),T=nearestOnRoad(tx,ty);let pts=[{x:sx,y:sy},{x:tx,y:ty}];
 if(Math.hypot(tx-sx,ty-sy)>S.d+T.d+20){const N=[],add=(x,y)=>{let k=N.findIndex(n=>Math.abs(n.x-x)<.5&&Math.abs(n.y-y)<.5);if(k<0){N.push({x,y});k=N.length-1}return k};
  ROADS.forEach(([x1,y1,x2,y2])=>{add(x1,y1);add(x2,y2)});for(let i=0;i<ROADS.length;i++)for(let j=i+1;j<ROADS.length;j++){const p=segX(ROADS[i],ROADS[j]);if(p)add(p.x,p.y)}
  const si=add(S.x,S.y),ti=add(T.x,T.y),adj=N.map(()=>[]);
  ROADS.forEach(([x1,y1,x2,y2])=>{const on=N.map((n,k)=>({k,t:onSeg(n,x1,y1,x2,y2)})).filter(o=>o.t!=null).sort((a,b)=>a.t-b.t);for(let q=1;q<on.length;q++){const a=on[q-1].k,c=on[q].k,d=Math.hypot(N[a].x-N[c].x,N[a].y-N[c].y);adj[a].push([c,d]);adj[c].push([a,d])}});
  const dist=N.map(()=>Infinity),prev=N.map(()=>-1),done=N.map(()=>false);dist[si]=0;
  for(;;){let u=-1;for(let k=0;k<N.length;k++)if(!done[k]&&(u<0||dist[k]<dist[u]))u=k;if(u<0||dist[u]===Infinity||u===ti)break;done[u]=true;for(const [v,w] of adj[u])if(dist[u]+w<dist[v]){dist[v]=dist[u]+w;prev[v]=u}}
  if(dist[ti]<Infinity){const mid=[];for(let k=ti;k>=0;k=prev[k])mid.unshift(N[k]);pts=[{x:sx,y:sy},...mid,{x:tx,y:ty}]}}
 let L=0;const cum=[0];for(let k=1;k<pts.length;k++){L+=Math.hypot(pts[k].x-pts[k-1].x,pts[k].y-pts[k-1].y);cum.push(L)}return{pts,cum,L}}
function along(r,p){const d=r.L*Math.max(0,Math.min(1,p));let k=1;while(k<r.pts.length-1&&r.cum[k]<d)k++;const a=r.pts[k-1],b=r.pts[k],sl=(r.cum[k]-r.cum[k-1])||1,f=Math.max(0,Math.min(1,(d-r.cum[k-1])/sl));return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,dx:b.x-a.x,dy:b.y-a.y}}
function faceOf(dx,dy){return Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down')}
function roadFlood(){if(R.slow)return;R.slow=true;logIt('돌발: 길 잠김');sfx('miss');
 const g=document.createElementNS(NS,'g');g.setAttribute('pointer-events','none');g.innerHTML=[[341,245,24,150],[470,411,260,22],[80,411,180,22]].map(([x,y,w,h])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#8a7b62" opacity=".8"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="url(#wave)"/>`).join('');$('world').insertBefore(g,$('houses'));
 effect('retry',500,370,64);toast('돌발 상황! 길이 물에 잠겨서 봉사단 걸음이 느려졌어요.',3600);
 for(const hp of Object.values(R.helpers)){const tk=hp.task;if(tk&&tk.phase==='go'){const rem=Math.hypot(tk.tx-hp.x,tk.ty-hp.y);tk.sx=hp.x;tk.sy=hp.y;tk.t0=R.t;tk.dur=rem/SLOW;tk.route=routeTo(hp.x,hp.y,tk.tx,tk.ty)}}}
function stepHelpers(){for(const [k,hp] of Object.entries(R.helpers)){const tk=hp.task;if(!tk)continue;const el=document.getElementById('hp-'+k);
 if(tk.phase==='go'){const p=Math.min(1,(R.t-tk.t0)/tk.dur),q=along(tk.route,p);hp.x=q.x;hp.y=q.y;if(q.dx||q.dy)hp.dir=faceOf(q.dx,q.dy);setWalk(k,hp.dir,reduced?1:Math.floor(R.t*M.characters[helperChar(k)].fps)%4);
  if(p>=1){tk.phase='work';tk.t1=R.t;setWalk(k,'up',1);tk.label=tk.mode==='goods'?'짐 옮기는 중':tk.work<=1?'바로 통했어!':'알리는 중';renderDock()}}
 else if(tk.phase==='work'){const p=(R.t-tk.t1)/tk.work;el.querySelector('.hstat').innerHTML=`<rect x="-26" y="-6" width="52" height="10" rx="2" fill="#fff9e7" stroke="#294b40" stroke-width="2"/><rect x="-24" y="-4" width="${48*Math.min(1,p)}" height="6" fill="#f3cf72"/>`;
  if(tk.house.flooded&&tk.mode==='warn'){hp.task=null;el.querySelector('.hstat').innerHTML='';effect('retry',tk.house.x,tk.house.y-30);toast('물이 먼저 들어왔어요…');setWalk(k,'down',1);renderDock();continue}
  if(p>=1){el.querySelector('.hstat').innerHTML='';const h=tk.house;if(tk.mode==='goods'){h.goodsDone=true;G.goods++;R.goodsSaved++;updateGoods();floatTxt(h.x,h.y-70,'짐 지킴!','#9a7417');document.querySelector(`#g-${h.id} .goods`)?.remove();sfx('paper')}else{const was=h.hesitate;visit(h,HELPERS[k].name);effect('correct',h.x,h.y-40);floatTxt(h.x,h.y-80,was?'같이 가요!':tk.work<=1?'통했다!':'전달!');sfx('collect')}hp.task=null;setWalk(k,'down',1);renderDock()}}
 el.setAttribute('transform',`translate(${hp.x},${hp.y})`)}}
function stepHouses(){const wy=waterY(R.t);$('flood').setAttribute('height',wy);$('floodEdge').setAttribute('y',wy-6);
 for(const h of R.houses){const dz=!h.safe&&!h.flooded&&h.t!=='mine'&&(h.leaveAt==null||h.leaveAt>h.ft)&&h.ft-R.t<10&&h.ft-R.t>0;if(dz!==!!h.dz){h.dz=dz;document.getElementById('g-'+h.id).classList.toggle('danger',dz);if(dz&&!G.dangerTip){G.dangerTip=true;toast('빨간 점선이 깜빡이는 집은 곧 물이 닿아요! 서둘러요.',3000)}}
  if(h.safe||h.flooded)continue;if(h.leaveAt!=null&&R.t>=h.leaveAt){h.safe=true;setStatus(h,'대피 ✓','#5a8c65');document.getElementById('g-'+h.id).classList.add('left');R.dots.push({x:h.x+40,y:h.y,r:routeTo(h.x+40,h.y,SHELTER.x,SHELTER.y),t0:R.t,dur:Math.hypot(SHELTER.x-h.x,SHELTER.y-h.y)/(h.t==='elder'?110:170),res:resOf(h)});continue}
  if(wy>=h.y-12){h.flooded=true;h.dz=false;document.getElementById('g-'+h.id).classList.remove('danger');setStatus(h,'구조 대기','#bf7865',true);document.getElementById('g-'+h.id).classList.add('flooded');sfx('miss');if(h.t==='mine'&&!h.goodsDone&&!h.sand)floatTxt(h.x,h.y-70,'짐 잠김','#bf7865')}}
 if(R.t>=R.alertT&&!R.alerted){R.alerted=true;systemAlerts()}
 $('dots').innerHTML=R.dots.map(d=>{const p=Math.min(1,(R.t-d.t0)/d.dur);if(p>=1){if(!d.arr){d.arr=true;R.evacuated++}return ''}const {x,y}=along(d.r,p),bob=reduced?0:Math.abs(Math.sin(R.t*10))*3;return artSvg('residents',d.res,x-15,y-46-bob,30,50)}).join('');
 $('shelterCount').textContent=R.evacuated?`${R.evacuated}명 도착`:''}
function updateHud(){const p=Math.max(0,1-R.t/R.T);$('timerBar').style.width=(p*100)+'%';$('timerWrap').setAttribute('aria-valuenow',Math.round(p*100));$('timerWrap').classList.toggle('low',p<.25);const total=R.houses.filter(h=>h.t!=='mine').length,safe=R.houses.filter(h=>h.t!=='mine'&&h.safe).length;const s=$('safeTxt');if(s)s.textContent=`대피 ${safe}/${total}`}
function loop(now){if(paused)return;const dt=Math.max(0,Math.min(.1,(now-last)/1000));last=now;R.t+=dt*SPEED;
 R.events=R.events.filter(e=>{if(R.t>=e.at){e.fn();return false}return true});
 stepHelpers();stepHouses();updateHud();
 if(R.t>=R.alertT&&$('bcBtn').disabled&&R.bcLeft>0)renderDock();
 const pending=R.houses.some(h=>!h.safe&&!h.flooded&&h.ft<R.T),busy=Object.values(R.helpers).some(h=>h.task);
 if(R.t>=R.T||(!pending&&!busy&&R.t>R.alertT+1&&R.houses.every(h=>h.safe||h.flooded||h.y>R.maxY))){finishRound();return}
 raf=requestAnimationFrame(loop)}

/* ---------- 끌기 · 누르기 ---------- */
function worldPoint(cx,cy){const w=$('world'),pt=$('map').createSVGPoint();pt.x=cx;pt.y=cy;return pt.matrixTransform(w.getScreenCTM().inverse())}
function houseAt(cx,cy){const p=worldPoint(cx,cy);let best=null,bd=60;for(const h of R.houses){const d=Math.hypot(h.x-p.x,h.y-p.y);if(d<bd){bd=d;best=h}}return best}
function bindHelperDrag(card){const k=card.dataset.hcard;
 card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleSel(k)}};
 card.onpointerdown=e=>{if(paused||R.helpers[k].task||!ROUNDS[G.round].helpers)return;e.preventDefault();try{card.setPointerCapture(e.pointerId)}catch(_){}let moved=false,ghost=null,hot=null;const sx=e.clientX,sy=e.clientY;
 card.onpointermove=ev=>{if(!moved&&Math.hypot(ev.clientX-sx,ev.clientY-sy)>8){moved=true;ghost=document.createElement('div');ghost.className='ghost';ghost.innerHTML=portrait(helperChar(k),'happy').replace('gs-portrait','gs-portrait" style="width:64px;height:64px;');document.body.appendChild(ghost)}if(moved){ghost.style.left=ev.clientX+'px';ghost.style.top=ev.clientY+'px';const h=houseAt(ev.clientX,ev.clientY);if(h!==hot){hot&&document.getElementById('g-'+hot.id)?.classList.remove('hot');hot=h;hot&&document.getElementById('g-'+hot.id)?.classList.add('hot')}}};
 card.onpointerup=ev=>{card.onpointermove=card.onpointerup=null;ghost?.remove();hot&&document.getElementById('g-'+hot.id)?.classList.remove('hot');if(moved){const h=houseAt(ev.clientX,ev.clientY);if(h)sendHelper(k,h.id);else toast('집 위에 놓아 주세요.')}else toggleSel(k)}}}
function toggleSel(k){if(paused||R.helpers[k].task)return;sel=sel===k?null:k;renderDock();if(sel){toast(`${k==='me'?'나를':HELPERS[k].name+'을'} 보낼 집을 누르세요.`);document.querySelector(`#g-${R.houses.find(h=>h.warned==null&&!h.flooded)?.id}`)?.focus?.()}}
function bindMap(){$('map').addEventListener('keydown',e=>{if(paused||(e.key!=='Enter'&&e.key!==' '))return;const hs=e.target.closest('[data-house]');if(!hs)return;e.preventDefault();if(sel){sendHelper(sel,hs.dataset.house);sel=null;renderDock()}else toast('먼저 아래에서 봉사단 카드를 고르세요(Enter).')});$('map').addEventListener('pointerdown',e=>{if(paused)return;const hg=e.target.closest('[data-helper]');if(hg&&!R.helpers[hg.dataset.helper].task){const card=document.querySelector(`[data-hcard="${hg.dataset.helper}"]`);card&&card.onpointerdown&&card.onpointerdown(e);return}
 const hs=e.target.closest('[data-house]');if(hs&&sel){sendHelper(sel,hs.dataset.house);sel=null;renderDock();return}if(hs){const h=R.houses.find(x=>x.id===hs.dataset.house);toast(`${TYPES[h.t].name}${h.lang?' ('+(h.lang==='VN'?'베트남어':'네팔어')+')':''} · ${h.safe?'대피 완료':h.flooded?'구조 대기':h.hesitate?'망설이는 중 · 누군가 직접 가야 해요':h.warned!=null?'준비 중':'경보 못 받음'}`)}})}

/* ---------- 라운드 결과 ---------- */
function peekMap(){$('overlay').hidden=true;setInert(false);const b=document.createElement('button');b.className='ee-button gs-back';b.textContent='결과로 돌아가기';document.body.appendChild(b);toast('빨간 테두리 집에는 물이 먼저 닿았어요. 누가 사는 집인지 살펴봐요.',4000);b.focus({preventScroll:true});b.onclick=()=>{b.remove();$('overlay').hidden=false;setInert(true);$('seeMap')?.focus({preventScroll:true})}}
function finishRound(){paused=true;cancelAnimationFrame(raf);for(const h of R.houses){if(!h.safe&&!h.flooded&&h.y<=R.maxY+12)h.flooded=true}
 const list=R.houses.filter(h=>h.t!=='mine'),byType={};for(const h of list)if(!h.safe)document.getElementById('g-'+h.id)?.classList.add('late');for(const h of list){byType[h.t]=byType[h.t]||{s:0,n:0};byType[h.t].n++;if(h.safe)byType[h.t].s++}
 const safe=list.filter(h=>h.safe).length;G.results[G.round]={round:R.n,safe,total:list.length,byType,goods:R.goodsSaved,owned:[...G.owned]};
 const missed=Object.entries(byType).filter(([t,v])=>v.s<v.n).map(([t])=>TYPES[t].name),all=safe===list.length;if(all)sfx('win');
 let insight;const hes=R.houses.some(h=>h.t==='elder'&&!h.safe&&h.hesitate);
 if(G.round===0)insight=missed.length?`AI 경보만으로는 닿지 않는 사람이 있었어요. ${missed.join(', ')}.`:'모두 대피했어요! 봉사단이 정말 바쁘게 뛰었어요.';else if(G.round===1)insight=all?'모두 대피! 이번엔 시스템과 봉사단이 함께 해냈어요.':`아직 남은 사람이 있어요. ${missed.join(', ')}.`;else insight=all?'봉사단 없이도 마을이 스스로 모두를 지켰어요.':`봉사단이 없자 ${missed.join(', ')}에게 경보가 닿지 않았어요.`;if(hes&&G.round>0)insight+=' 전화나 방송만 받은 어르신은 혼자 나서지 못했어요.';
 show(`<span class="kicker">${R.n}라운드 결과 · ${R.title}</span><h2>${all?'모두 대피했어요':`${list.length-safe}곳이 구조를 기다려요`}</h2><div class="result-grid">${['phone','elder','foreign','deaf'].filter(t=>byType[t]).map(t=>`<div class="rg ${byType[t].s<byType[t].n?'bad':''}">${art('residents',t==='foreign'?RES.vn:RES[t])}<b>${byType[t].s}/${byType[t].n}</b><small>${TYPES[t].name}${byType[t].s<byType[t].n?' · 남음':''}</small></div>`).join('')}</div>${R.goodsSaved?`<p class="sub">우리 집 짐을 지켰어요. 그 5초 동안 다른 집은 기다렸어요.</p>`:''}<div class="${all?'ee-success':'ee-notice'}">${insight}</div><div class="row">${all?'':'<button class="ee-button secondary" id="seeMap">지도에서 늦은 집 보기</button>'}<button class="ee-button" id="nextR">${G.round<2?'주민 회의로 →':'마을의 1년 돌아보기 →'}</button></div>`);
 save();progress();if($('seeMap'))$('seeMap').onclick=peekMap;$('nextR').onclick=()=>{if(G.round<2){G.stage='meeting';save();meeting()}else ending()}}

/* ---------- 주민 회의 ---------- */
function meeting(){const idx=G.round,budget=idx===0?3:2,voices=idx===0?VOICES1:VOICES2;let picked=[];sfx('paper');
 const draw=()=>{const spent=picked.reduce((s,id)=>s+UPGRADES.find(u=>u.id===id).cost,0);show(`<span class="kicker">주민 회의 ${idx+1} · 다음 ${idx===0?'장마':'여름'}를 위해</span><h2>무엇을 바꿀까요?</h2><div class="voices"><div class="voice">${art('residents',RES.chief)}<span><b>이장</b> · 주민 여러분의 이야기를 먼저 들어 볼게요.</span></div>${voices.map(([e,t])=>`<div class="voice">${typeof e==='string'?portrait(e,'worried'):art('residents',e)}<span>${t}</span></div>`).join('')}</div>${robotSay(idx===0?'예산은 3칸이에요. 누가 경보에서 빠졌었는지 떠올려 보세요.':'이번엔 2칸이에요. 봉사단이 없을 때도 작동할까요?','explaining')}<p class="sub">남은 예산 <span class="coins">${'●'.repeat(budget-spent)}${'○'.repeat(spent)}</span> · 이미 설치한 것은 계속 작동해요.</p><div class="ups">${UPGRADES.filter(u=>!u.late||idx>0).map(u=>{const own=G.owned.includes(u.id),on=picked.includes(u.id);return `<button class="ee-choice ${own?'owned':''}" aria-pressed="${on}" data-up="${u.id}" ${own||(!on&&spent+u.cost>budget)?'disabled':''}>${art('icons',GIC[u.id])}<span><b>${u.name}${on?' ✓':''}</b><small>${own?'설치됨 ✓':u.desc}</small></span><span class="cost">${'●'.repeat(u.cost)}</span></button>`}).join('')}</div><div class="row"><button class="ee-button" id="goR" ${spent===0?'disabled':''}>${idx===0?'2라운드 · 장마':'3라운드 · 다음 여름'} 시작 →</button></div>`);
  document.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>{const id=b.dataset.up;picked=picked.includes(id)?picked.filter(x=>x!==id):[...picked,id];sfx('tap');draw();document.querySelector(`[data-up="${id}"]`)?.focus()});$('goR').onclick=()=>{G.owned.push(...picked);G.chosen[idx]=picked;G.round++;G.stage='round';save();progress();roundIntro()}};draw()}

/* ---------- 엔딩 ---------- */
function ending(){const [r1,r2,r3]=G.results,rate=r=>Math.round(r.safe/r.total*100),hasInc=['multi','light','chief','buddy'].filter(x=>G.owned.includes(x)).length;
 let E;if(rate(r3)===100)E={t:'마지막 한 사람까지',m:'봉사단이 떠난 뒤에도, 마을의 경보는 모두에게 닿았어요. 연대가 사람의 선의에서 제도로 남았어요.',q:'처음부터 모두에게 닿는 시스템을 만들려면, 누구를 설계에 참여시켜야 할까?',expr:'happy'};
 else if(G.goods>=2&&(r1.safe<r1.total||r2.safe<r2.total))E={t:'우리 집은 무사했지만',m:'우리 집 짐은 지켰어요. 그 사이 경보를 기다리던 집이 있었어요.',q:'우리 가족을 먼저 챙기는 것은 잘못일까? 어디까지가 나의 몫이고 어디부터가 공동체의 몫일까?',expr:'worried'};
 else if(G.owned.includes('fast')&&hasInc<3)E={t:'빨라진 AI, 남겨진 사람',m:'AI는 더 빨라졌지만, 원래 닿지 않던 사람에게는 여전히 닿지 않았어요.',q:'기술이 좋아지면 모두가 좋아질까? 기술의 혜택이 고르게 가려면 무엇이 필요할까?',expr:'worried'};
 else if(rate(r2)>=85&&rate(r3)<85)E={t:'영웅이 떠난 마을',m:'봉사단이 있을 때는 해냈지만, 우리가 떠나자 빈자리가 드러났어요.',q:'한 사람의 헌신과 모두를 위한 제도, 연대에는 무엇이 더 필요할까?',expr:'worried'};
 else E={t:'절반의 연대',m:'누군가는 지켰고, 누군가는 남았어요. 남은 사람은 왜 남았을까요?',q:'경보에서 빠진 사람들의 공통점은 무엇일까? 그들은 왜 처음 설계에서 빠졌을까?',expr:'neutral'};
 const left=[...new Set(G.results.flatMap(r=>Object.entries(r.byType).filter(([t,v])=>v.s<v.n).map(([t])=>TYPES[t].name)))];
 const found=left.length?`경보에서 빠지기 쉬웠던 사람: ${left.join(', ')}. 기술이 닿지 않는 이유는 사람마다 달랐어요.`:'세 번의 비 동안 모든 주민이 대피했어요. 누구도 빠뜨리지 않으려면 시스템과 사람이 함께 움직여야 했어요.';
 const first=!G.completeSent;if(first&&E.expr==='happy')sfx('win');
 show(`<span class="kicker">마을의 1년 · 우리의 선택</span><h2>${E.t}</h2><div class="tl">${G.results.map((r,i)=>`<div>${i+1}라운드 · ${ROUNDS[i].title}<b>${r.safe}/${r.total}</b>대피 ${rate(r)}%</div>`).join('')}</div><p class="sub">설치한 시스템: ${G.owned.map(id=>UPGRADES.find(x=>x.id===id).name).join(' · ')||'없음'} · 지킨 우리 집 짐: ${G.goods}번</p>${robotSay(E.m,E.expr)}
 <div class="found"><div class="ee-notice"><h3>우리가 발견한 것</h3><p>${found}</p></div><div class="ee-success"><h3>기억할 한 문장</h3><p>“경보가 모두에게 닿으려면, 가장 닿기 어려운 사람과 함께 설계해야 해요.”</p></div><div class="ee-notice"><h3>함께 생각해 볼 질문</h3><p>${E.q}</p></div></div>
 <div class="row"><button class="ee-button secondary" id="again">다른 선택으로 다시</button><button class="ee-button" id="toReflect">다음 탐험: 생각 정리하기 →</button></div>`);
 G.ending={t:E.t,m:E.m,q:E.q};G.stage='ending';progress(5);if(first){G.completeSent=true;post({type:'ethicity:complete',result:{completed:true}})}save();$('again').onclick=replay;$('toReflect').onclick=()=>{G.stage='case';progress(6);save();caseScreen()}}

/* ---------- 화면 전환 ---------- */
function setInert(on){const w=document.querySelector('.gs-wrap');if(w){w.inert=on;if(on)w.setAttribute('aria-hidden','true');else w.removeAttribute('aria-hidden')}}
function show(html){$('card').innerHTML=html;$('overlay').hidden=false;setInert(true);$('card').scrollTop=0;const f=$('card').querySelector('button:not([disabled]),input');if(f&&matchMedia('(hover:hover)').matches)f.focus({preventScroll:true})}
function hide(){$('overlay').hidden=true;setInert(false)}
function roundIntro(){const r=ROUNDS[G.round];R={...r,t:0,houses:houseList(r),helpers:{},bcLeft:r.bc,alertT:5,events:[],dots:[],evacuated:0};drawMap();drawHouses();Object.keys(HELPERS).forEach((k,i)=>R.helpers[k]={x:BASE.x-50+i*50,y:BASE.y-20,task:null});drawHelpers();renderDock();
 $('roundChip').textContent=`${r.n}라운드 · ${r.title}`;$('rainPill').textContent=`시간당 ${r.rain}mm`;
 const team=['me','saebom','daon'].map(k=>portrait(helperChar(k))).join('');
 show(`<span class="kicker">${r.n}라운드 · 시간당 ${r.rain}mm</span><h2>${r.title}</h2>${robotSay(r.intro,r.n===3?'worried':'explaining')}${r.n===1?`<div class="grid3"><div><span class="facerow">${team}</span>봉사단 카드를 경보 못 받은 집에 <b>끌어다 놓기</b> (카드 누르고 집 누르기도 돼요)</div><div>${art('icons',GIC.buoy)}물이 차기 전에 주민이 <b>떠나야</b> 대피 성공</div><div>${art('icons',GIC.bc)}마을방송은 회관 근처만 · 못 듣는 사람도 있어요</div></div><p class="sub">새봄이는 청각장애인 집에서, 다온이는 베트남어를 쓰는 집에서 훨씬 빨라요. 우리 집에는 짐이 있어요.</p>`:r.n===3?`<div class="grid3"><div><span class="facerow gray">${team}</span>봉사단 없음</div><div>${art('icons',GIC.light)}설치한 시스템 ${G.owned.length}개</div><div>${art('icons',GIC.bc)}지켜보며 방송만 할 수 있어요</div></div>`:`<p class="sub">설치한 시스템: ${G.owned.map(id=>UPGRADES.find(u=>u.id===id).name).join(' · ')}</p>`}<div class="row"><button class="ee-button" id="go">탐험 시작 ▶</button></div>`);
 $('go').onclick=()=>{hide();startRound()}}
function startScreen(){drawMap();R={houses:houseList(ROUNDS[0]),helpers:{}};drawHouses();let pick='jiho';const sv=loadSaved();
 const draw=()=>{show(`<span class="kicker">윤리시티 · AI 윤리 탐험대 · 연대성</span><h2>마지막 한 사람까지</h2>${robotSay('시간당 80mm의 폭우가 와요. 강변 마을에 AI 홍수 경보가 생겼는데, 경보는 <b>모두에게</b> 닿고 있을까요? 청소년 재난 봉사단이 되어 함께 살펴봐요.','explaining')}
 <h3 class="gs-h3">봉사단은 세 명이에요</h3><div class="team-row">${[['saebom','수어를 할 줄 알아요','청각장애인 주민에게 훨씬 빨리 알려요'],['daon','베트남어를 할 줄 알아요','베트남 출신 주민에게 훨씬 빨리 알려요']].map(([id,a,b])=>`<div class="mate">${portrait(id,'happy')}<span><b>${M.characters[id].name}</b> <small class="tagline">함께하는 친구</small><br><small>${a}<br>→ ${b}</small></span></div>`).join('')}</div><h3 class="gs-h3">남은 한 자리는 나! 내 모습을 골라요</h3><p class="sub" style="margin:0 0 6px;font-size:14px">누구를 골라도 그 캐릭터가 바로 <b>나</b>예요. 모습만 다르고 하는 일은 같아요. 나에게는 <b>우리 집 열쇠</b>가 있어서, 비가 오면 우리 집 짐을 옮길 수 있어요.</p><div class="pick-row">${['jiho','haneul'].map(id=>`<button class="ee-choice" data-pick="${id}" aria-pressed="${pick===id}">${portrait(id,pick===id?'happy':'neutral')}<span><b>${M.characters[id].name}</b></span></button>`).join('')}</div>
 <div class="id-row"><div><label for="sid">학번</label><input class="field" id="sid" inputmode="numeric" maxlength="6" placeholder="예: 10101" value="${esc($('sid')?.value||(DEMO?'0000':''))}"></div><div><label for="sname">이름 (PDF 제출용)</label><input class="field" id="sname" maxlength="10" placeholder="이름" value="${esc($('sname')?.value||(DEMO?'시연':''))}"></div></div>${DEMO?'<p class="ee-notice" style="margin:8px 0 0;font-size:14px"><b>교사 시연 모드</b> · 기록을 저장하지 않아요. 위쪽 ⏩ 버튼으로 3배속, ⏭ 버튼으로 라운드를 바로 끝낼 수 있어요.</p>':''}<p class="sub" style="font-size:13px;margin:6px 0 0">학번과 이름은 이 기기의 PDF 파일에만 쓰이고 다른 곳으로 보내지 않아요.</p><p class="err" id="err" hidden></p>
 <div class="row">${sv?`<button class="ee-button secondary" id="clearBtn">이전 기록 지우기</button><button class="ee-button secondary" id="resumeBtn">이어하기 · ${esc(sv.sid)} ${esc(sv.name)}</button>`:''}<button class="ee-button" id="startBtn">탐험을 시작합니다 →</button></div>`);
 document.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{const a=$('sid').value,n=$('sname').value;pick=b.dataset.pick;sfx('tap');draw();$('sid').value=a;$('sname').value=n;document.querySelector(`[data-pick="${pick}"]`).focus()});
 if(sv){$('resumeBtn').onclick=()=>{G=sv;resume()};$('clearBtn').onclick=()=>confirmClear(startScreen)}
 $('startBtn').onclick=()=>{const sid=$('sid').value.trim(),nm=$('sname').value.trim();if(!/^\d{4,6}$/.test(sid)){$('err').textContent='학번을 숫자 4~6자리로 입력해 주세요.';$('err').hidden=false;$('sid').focus();return}if(!nm){$('err').textContent='이름을 입력해 주세요.';$('err').hidden=false;$('sname').focus();return}G=newGame(sid,nm,pick);save();sfx('door');roundIntro()};
 ['sid','sname'].forEach(id=>$(id).oninput=()=>$('err').hidden=true)};draw()}
function demoBar(){const hb=$('helpBtn'),mk=(id,txt,lab)=>{const b=document.createElement('button');b.className='gs-iconbtn gs-demo';b.id=id;b.textContent=txt;b.setAttribute('aria-label',lab);hb.after(b);return b};
 const sk=mk('demoSkip','⏭','라운드 바로 끝내기'),sp=mk('demoSpeed','⏩','3배속');sp.setAttribute('aria-pressed','false');
 sp.onclick=()=>{SPEED=SPEED===1?3:1;sp.setAttribute('aria-pressed',SPEED>1);sp.textContent=SPEED>1?'×3':'⏩';toast(SPEED>1?'3배속으로 진행해요.':'보통 속도로 돌아왔어요.')};
 sk.onclick=()=>{if(paused||!R||!R.T||!$('overlay').hidden){toast('라운드가 진행 중일 때 쓸 수 있어요.');return}finishRound()}}
function clearSave(){try{localStorage.removeItem(STORE_KEY)}catch(e){}}
function confirmClear(back){show(`<h2>이 기기의 기록을 지울까요?</h2>${robotSay('학번·이름과 작성한 생각 정리가 이 기기에서 모두 지워져요. 다음 친구가 이 태블릿을 쓸 때 눌러 주세요. PDF를 저장했는지 먼저 확인하세요.','worried')}<div class="row"><button class="ee-button secondary" id="noC">돌아가기</button><button class="ee-button" id="yesC">지우고 처음으로</button></div>`);$('noC').onclick=back;$('yesC').onclick=()=>{clearSave();G=null;sfx('tap');startScreen()}}
function resume(){if(G.stage==='case')return caseScreen();if(G.stage==='ending'||G.results.length>=3)return ending();if(G.stage==='meeting')return meeting();G.logs[G.round]=[];roundIntro()}
function replay(){show(`<h2>다른 선택으로 다시 할까요?</h2>${robotSay('1라운드부터 다시 시작해요. 지금 기록은 지워져요. 남기고 싶다면 먼저 생각 정리에서 PDF로 저장하세요.','worried')}<div class="row"><button class="ee-button secondary" id="noR">돌아가기</button><button class="ee-button" id="yesR">다시 시작</button></div>`);$('noR').onclick=ending;$('yesR').onclick=()=>{G=newGame(G.sid,G.name,G.me);save();roundIntro()}}
function help(){if(!R||!$('overlay').hidden)return;const wasRunning=!paused&&R.t<R.T;paused=true;show(`<h2>잠깐 멈춤</h2>${robotSay('봉사단 카드를 집 위로 끌어다 놓거나, 카드를 누른 뒤 집을 눌러요. 물이 집에 닿기 전에 주민이 떠나야 해요. 집을 누르면 누가 사는지 보여요. 빨간 점선이 깜빡이는 집은 곧 물이 닿아요.','explaining')}<div class="row"><button class="ee-button" id="resume">계속하기 ▶</button></div>`);$('resume').onclick=()=>{hide();if(wasRunning){paused=false;last=performance.now();raf=requestAnimationFrame(loop)}}}

/* ---------- 생각 정리 · 사례 찾기 ---------- */
const KEYWORDS=['재난문자 외국인','재난 경보 청각장애인','재난 취약계층 대피','AI 홍수 예보','침수 반지하','디지털 소외 재난'];
const CHECKS=['날짜가 최근 1년 이내인가?','언론사나 기관이 분명한가?','주장과 근거(숫자·사례)가 구분되는가?'];
const STANCES=['개인의 선의가 더 중요','개인 쪽에 가깝다','제도 쪽에 가깝다','사회의 제도가 더 중요'];
const SHARE=['개인·이웃','기업','학교·지자체·정부','지역 공동체'];
function caseScreen(){const c=G.cases;show(`<span class="kicker">다음 탐험 · 생각 정리</span><h2>${esc(G.ending?.t||'')} — 그다음 이야기</h2>
 <label class="fl" for="refl">① 게임에서 어떤 선택이 누구의 대피를 바꿨나요? (한두 문장)</label><textarea class="field" id="refl" maxlength="300" placeholder="예: 1라운드에 짐을 옮기느라 어르신 집이 늦었다 / 다국어 경보를 고르니…">${esc(G.reflection)}</textarea>
 <span class="subh">② 실제 사례 찾기 — 검색어를 누르면 새 탭에서 뉴스 검색이 열려요</span><div class="chips">${KEYWORDS.map(k=>`<a class="ee-choice" href="https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(k)}" target="_blank" rel="noopener noreferrer">${icon('inspect',18)} ${k}</a>`).join('')}</div>
 <div class="two"><label class="fl">기사 제목<input class="field" data-c="title" maxlength="120" value="${esc(c.title)}"></label><label class="fl">언론사·기관<input class="field" data-c="source" maxlength="40" value="${esc(c.source)}"></label></div>
 <div class="two"><label class="fl">날짜<input class="field" data-c="date" maxlength="20" value="${esc(c.date)}" placeholder="예: 2026.08.10"></label><label class="fl">주소(선택)<input class="field" data-c="url" maxlength="300" value="${esc(c.url)}" placeholder="https://"></label></div>
 <div class="checks">${CHECKS.map((t,i)=>`<label class="check"><input type="checkbox" data-check="${i}" ${G.check[i]?'checked':''}> ${t}</label>`).join('')}</div>
 <label class="fl">누가, 어떤 장벽 때문에 위험에서 소외되었나요?<textarea class="field" data-c="who" maxlength="300">${esc(c.who)}</textarea></label>
 <span class="fl">누가 무엇을 해야(나눠야) 할까요? (여러 개 선택)</span><div class="chips">${SHARE.map(x=>`<button class="ee-choice" data-share="${x}" aria-pressed="${c.share.includes(x)}">${x}</button>`).join('')}</div><textarea class="field" data-c="shareWhy" maxlength="300" placeholder="무엇을, 어떻게?" aria-label="무엇을 어떻게 나눠야 할까요">${esc(c.shareWhy)}</textarea>
 <label class="fl">게임 속 나의 선택과 닮은 점·다른 점<textarea class="field" data-c="compare" maxlength="300">${esc(c.compare)}</textarea></label>
 <span class="subh">③ 토론 준비 · 재난에서 '마지막 한 사람'을 지키는 힘은 어디에 더 있을까?</span><div class="chips">${STANCES.map((x,i)=>`<button class="ee-choice" data-stance="${i}" aria-pressed="${G.stance===i}">${x}</button>`).join('')}</div><textarea class="field" id="stw" maxlength="200" placeholder="근거 한 줄 (게임 경험이나 찾은 사례에서)" aria-label="토론 입장의 근거">${esc(G.stanceWhy)}</textarea>
 <div class="row"><span class="sub" id="pdfStatus" style="margin:0 auto 0 0" role="status"></span><button class="ee-button secondary" id="backEnd">← 엔딩</button><button class="ee-button secondary" id="finishBtn">마치기</button><button class="ee-button secondary" id="copyBtn">복사</button><button class="ee-button" id="pdfBtn">PDF로 저장</button></div>`);
 $('refl').oninput=()=>{G.reflection=$('refl').value;save()};$('stw').oninput=()=>{G.stanceWhy=$('stw').value;save()};
 document.querySelectorAll('[data-c]').forEach(el=>el.oninput=()=>{c[el.dataset.c]=el.value;save()});document.querySelectorAll('[data-check]').forEach(el=>el.onchange=()=>{G.check[+el.dataset.check]=el.checked;save()});
 document.querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>{const x=b.dataset.share;c.share=c.share.includes(x)?c.share.filter(y=>y!==x):[...c.share,x];b.setAttribute('aria-pressed',c.share.includes(x));sfx('tap');save()});
 document.querySelectorAll('[data-stance]').forEach(b=>b.onclick=()=>{G.stance=+b.dataset.stance;document.querySelectorAll('[data-stance]').forEach(y=>y.setAttribute('aria-pressed',y===b));sfx('tap');save()});
 $('backEnd').onclick=ending;$('finishBtn').onclick=()=>confirmClear(caseScreen);$('copyBtn').onclick=copyText;$('pdfBtn').onclick=downloadPDF}

/* ---------- 기록 · PDF (학번·이름은 이 기기의 PDF에만 사용) ---------- */
function reportBlocks(){const B=[],d=new Date(),E=G.ending||{},c=G.cases,rate=r=>Math.round(r.safe/r.total*100),up=id=>{const u=UPGRADES.find(x=>x.id===id);return u?u.name:id};
 B.push(['title','마지막 한 사람까지 · 연대성 탐구 기록']);B.push(['meta',`학번: ${G.sid}   ·   이름: ${G.name}   ·   작성일: ${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()}   ·   윤리시티 AI 윤리 탐험대\n게임 속 마을·인물·수치는 학습용 가상 설정입니다.`]);
 B.push(['h',`1. 우리의 선택 — ${E.t||'-'}`]);B.push(['body',E.m||'']);B.push(['note',`함께 생각해 볼 질문: ${E.q||''}`]);
 B.push(['h','2. 라운드별 결과']);G.results.forEach((r,i)=>{B.push(['sub',`${i+1}라운드 · ${ROUNDS[i].title} — 대피 ${r.safe}/${r.total} (${rate(r)}%)`]);B.push(['body',['phone','elder','foreign','deaf'].filter(t=>r.byType[t]).map(t=>`${TYPES[t].name} ${r.byType[t].s}/${r.byType[t].n}`).join(' · ')+(r.goods?` · 우리 집 짐 ${r.goods}번 옮김`:'')]);if(G.logs[i]?.length)B.push(['note','나의 행동: '+G.logs[i].join(' → ')])});
 B.push(['h','3. 주민 회의에서 고친 것']);B.push(['body',`회의 1: ${G.chosen[0].map(up).join(', ')||'-'}\n회의 2: ${G.chosen[1].map(up).join(', ')||'-'}`]);
 B.push(['h','4. 기회를 바꾼 선택']);B.push(['body',G.reflection||'(작성하지 않음)']);
 B.push(['h','5. 실제 사례와 내 생각']);B.push(['body',`제목: ${c.title||'-'}\n출처: ${c.source||'-'} · ${c.date||'-'}${c.url?'\n주소: '+c.url:''}`]);B.push(['note','출처 점검: '+CHECKS.map((t,i)=>(G.check[i]?'✓ ':'○ ')+t).join('  ')]);
 B.push(['sub','누가, 어떤 장벽 때문에 소외되었나']);B.push(['body',c.who||'(작성하지 않음)']);B.push(['sub',`누가 무엇을 해야 하나 — ${c.share.join(', ')||'선택 없음'}`]);B.push(['body',c.shareWhy||'(작성하지 않음)']);B.push(['sub','게임 속 나의 선택과 비교']);B.push(['body',c.compare||'(작성하지 않음)']);
 B.push(['h','6. 토론 입장']);B.push(['body',`${G.stance==null?'(선택하지 않음)':STANCES[G.stance]}\n근거: ${G.stanceWhy||'(작성하지 않음)'}`]);return B}
function copyText(){const t=reportBlocks().map(([k,x])=>k==='title'?'■ '+x:k==='h'?'\n['+x+']':k==='sub'?'- '+x:x).join('\n');show(`<h2>나의 기록 복사</h2><p class="sub">아래 글을 복사해 활동지나 클래스룸에 붙여 넣으세요.</p><textarea class="field" id="cb" style="height:300px" readonly aria-label="복사할 기록">${esc(t)}</textarea><div class="row"><span class="sub" id="cs" style="margin:0 auto 0 0" role="status"></span><button class="ee-button secondary" id="cbBack">← 돌아가기</button><button class="ee-button" id="cbGo">전체 복사</button></div>`);
 $('cbBack').onclick=caseScreen;$('cbGo').onclick=async()=>{const el=$('cb');el.focus();el.select();let ok=false;try{await navigator.clipboard.writeText(el.value);ok=true}catch(e){try{ok=document.execCommand('copy')}catch(_){}}$('cs').textContent=ok?'복사했어요.':'선택된 글을 직접 복사해 주세요.'}}
function wrapText(ctx,text,maxW){const L=[];for(const para of String(text).split('\n')){if(!para){L.push('');continue}let line='';for(const ch of para){if(line&&ctx.measureText(line+ch).width>maxW){L.push(line);line=ch}else line+=ch}L.push(line)}return L}
function renderPages(){const pages=[],W=1240,H=1754,Mg=90,FONT='"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif';let cv,ctx,y,no=0;const S={title:{s:38,l:56,c:'#294b40',b:1,sp:16},h:{s:29,l:44,c:'#5a8c65',b:1,sp:12},sub:{s:24,l:37,c:'#294b40',b:1,sp:6},meta:{s:21,l:33,c:'#6b7a6a',sp:22},note:{s:21,l:33,c:'#56676f',sp:10},body:{s:23,l:37,c:'#1d3039',sp:18}};
 const np=()=>{cv=document.createElement('canvas');cv.width=W;cv.height=H;ctx=cv.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#72b7c4';ctx.fillRect(Mg,52,52,6);ctx.fillStyle='#5a8c65';ctx.font=`bold 17px ${FONT}`;ctx.fillText('윤리시티 · 연대성 · 마지막 한 사람까지',Mg+68,63);ctx.strokeStyle='#d8cfa8';ctx.beginPath();ctx.moveTo(Mg,H-85);ctx.lineTo(W-Mg,H-85);ctx.stroke();ctx.fillStyle='#6b7a6a';ctx.font=`18px ${FONT}`;ctx.fillText(`연대성 · ${G.sid} ${G.name}`,Mg,H-52);ctx.textAlign='right';ctx.fillText(String(++no),W-Mg,H-52);ctx.textAlign='left';y=130;pages.push(cv)};
 np();for(const [k,text] of reportBlocks()){const s=S[k]||S.body,f=()=>{ctx.font=`${s.b?'bold ':''}${s.s}px ${FONT}`;ctx.fillStyle=s.c};f();if(k==='h')y+=10;const L=wrapText(ctx,text,W-Mg*2);if(y+s.l*Math.min(L.length,3)+(['title','h','sub'].includes(k)?90:0)>H-120){np();f()}for(const line of L){if(y+s.l>H-120){np();f()}ctx.fillText(line,Mg,y);y+=s.l}y+=s.sp}return pages}
function pagesToPDF(pages){const enc=new TextEncoder(),ch=[],off=[0];let len=0;const add=v=>{const b=typeof v==='string'?enc.encode(v):v;ch.push(b);len+=b.length};const obj=(n,h,d)=>{off[n]=len;add(`${n} 0 obj\n${h}`);if(d){add('\nstream\n');add(d);add('\nendstream')}add('\nendobj\n')};add('%PDF-1.4\n%ETHICITY\n');obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`);pages.forEach((c,i)=>{const p=3+i*3,img=p+1,st=p+2,raw=atob(c.toDataURL('image/jpeg',.92).split(',')[1]),bytes=Uint8Array.from(raw,v=>v.charCodeAt(0));obj(p,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${st} 0 R >>`);obj(img,`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>`,bytes);const cmd=enc.encode('q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ');obj(st,`<< /Length ${cmd.length} >>`,cmd)});const x=len,n=3+pages.length*3;add(`xref\n0 ${n}\n0000000000 65535 f \n`);for(let i=1;i<n;i++)add(String(off[i]).padStart(10,'0')+' 00000 n \n');add(`trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`);return new Blob(ch,{type:'application/pdf'})}
async function downloadPDF(){const b=$('pdfBtn'),st=$('pdfStatus');b.disabled=true;st.textContent='만드는 중…';try{save();if(document.fonts?.ready)await document.fonts.ready;const pages=renderPages(),pdf=pagesToPDF(pages);window.__lastPDF={pages:pages.length,size:pdf.size};const url=URL.createObjectURL(pdf),a=document.createElement('a');a.href=url;a.download=`연대성_${G.sid}_${G.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')}_마지막한사람까지.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);sfx('paper');st.textContent=`${pages.length}쪽 PDF를 저장했어요.`}catch(e){st.textContent='PDF를 만들지 못했어요. [복사]를 이용해 주세요.'}finally{b.disabled=false}}

/* ---------- 시작 ---------- */
async function boot(){$('card').innerHTML='<p class="loading">윤리시티 자료를 불러오는 중…</p>';$('overlay').hidden=false;
 if(!M||!window.EthicityAssets){$('card').innerHTML='<p class="loading">공통 팩(ethicity-elementary-common-v1)을 찾지 못했어요.<br>solidarity 폴더 옆에 shared 폴더가 있는지 확인해 주세요.</p>';return}
 try{assets=await EthicityAssets.load(M,COMMON_BASE)}catch(e){$('card').innerHTML=`<p class="loading">공통 자산을 불러오지 못했어요.<br><small>${esc(e.message)}</small></p>`;return}
 try{soundOn=localStorage.getItem(SOUND_KEY)==='1'}catch(e){}assets.setSound(soundOn);
 hudIcons();$('soundBtn').onclick=()=>{soundOn=!soundOn;assets.setSound(soundOn);try{localStorage.setItem(SOUND_KEY,soundOn?'1':'0')}catch(e){}setSoundBtn();sfx('tap')};$('helpBtn').onclick=help;if(DEMO)demoBar();document.addEventListener('visibilitychange',()=>{if(document.hidden&&!paused&&$('overlay').hidden)help()});
 bindMap();startScreen();post({type:'ethicity:ready'})}
window.__f={get G(){return G},get R(){return R},get paused(){return paused}};
boot();
})();
