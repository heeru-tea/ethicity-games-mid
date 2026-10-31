const fs=require('fs'),path=require('path');
const {createRequire}=require('module');
const req=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/asset-pack.cjs'):require;
const sharp=req('sharp'); const {createCanvas,loadImage}=req('@napi-rs/canvas');
const root=__dirname, ref=path.resolve(root,'../../example/minjun-brief/official');
(async()=>{
 const file=path.join(root,'minjun-sleep-source.png');
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let x0=info.width,y0=info.height,x1=0,y1=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=160){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 const b={x:Math.max(0,x0-2),y:Math.max(0,y0-2),w:x1-x0+5,h:y1-y0+5};
 const c=createCanvas(96,128),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
 const s=Math.min(80/b.w,112/b.h),w=b.w*s,h=b.h*s;
 ctx.drawImage(await loadImage(file),b.x,b.y,b.w,b.h,(96-w)/2,120-h,w,h);
 fs.writeFileSync(path.join(root,'minjun-sleep.png'),c.toBuffer('image/png'));
 const meta=JSON.parse(fs.readFileSync(path.join(root,'minjun-data.json')));
 meta.minjun.sleep={image:'minjun-sleep.png',w:96,h:128,seatAnchor:{x:48,y:120},source:'minjun-sleep-source.png',sourceRect:b};
 fs.writeFileSync(path.join(root,'minjun-data.json'),JSON.stringify(meta,null,2));
 const uri=f=>'data:image/png;base64,'+fs.readFileSync(f).toString('base64');
 const images={};for(const id of ['minjun','onyu','haneul'])images[id]=uri(path.join(id==='minjun'?root:ref,id+'-walk.png'));
 const portraits=['minjun','onyu'].map(id=>`<h3>${id==='minjun'?'민준':'공식 온유'}</h3><img class="portraits" alt="${id} neutral happy worried explaining" src="${uri(path.join(id==='minjun'?root:ref,id+'-portraits.png'))}">`).join('');
 const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>민준 에셋 비교</title><style>
 body{margin:32px;font:16px/1.6 system-ui,'Malgun Gothic',sans-serif;color:#263a32;background:#f6f7f6}main{max-width:1050px;margin:auto}h1{font-size:26px}h2{margin-top:28px;font-size:20px}button{min-height:44px;padding:8px 20px;cursor:pointer}table{border-collapse:collapse;width:100%;max-width:700px}th,td{text-align:left;padding:8px;border-bottom:1px solid #d5ddd8}canvas,img{image-rendering:pixelated}canvas{width:81.6px;height:108.8px;background:#e6ece7}.portraits{width:100%;max-width:768px;background:#e6ece7}.sleep{width:96px;height:128px;background:#e6ece7}.sources{display:flex;gap:16px}.sources img{width:calc(50% - 8px);object-fit:contain;background:#e6ece7}small{color:#53675c}</style>
 <main><h1>민준 · 공통 팩 비교</h1><p>걷기 4방향 · 6fps · 축척 0.85 · 정지 프레임 1(0부터 세는 인덱스)</p><button id="toggle">정지하기</button><h2>같은 축척으로 걷기</h2><table><thead><tr><th>방향</th><th>민준</th><th>공식 온유</th><th>공식 하늘</th></tr></thead><tbody>${['아래','왼쪽','오른쪽','위'].map((d,r)=>`<tr><th>${d}</th>${['minjun','onyu','haneul'].map(id=>`<td><canvas width="96" height="128" data-id="${id}" data-row="${r}" aria-label="${id} ${d} 걷기"></canvas></td>`).join('')}</tr>`).join('')}</tbody></table>
 <h2>대화 표정</h2><p>neutral / happy / worried / explaining</p>${portraits}<h2>책상에 엎드린 민준</h2><img class="sleep" alt="뒷모습의 잠든 민준, 인물만" src="minjun-sleep.png"><p><small>96×128 · 앉은 기준점 (48,120). 책상·의자는 포함하지 않습니다. 실제 맵에서 겹침 확인 필요.</small></p><h2>원본 화풍 비교</h2><div class="sources"><img alt="민준 원본" src="minjun-source.png"><img alt="공식 온유 원본" src="${uri(path.join(ref,'onyu-source.png'))}"></div><p id="status">이미지 확인 중</p></main>
 <script>const sources=${JSON.stringify(images)},loaded={};let running=!matchMedia('(prefers-reduced-motion: reduce)').matches,frame=1;const button=document.getElementById('toggle');function draw(){for(const c of document.querySelectorAll('canvas')){const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.clearRect(0,0,96,128);x.drawImage(loaded[c.dataset.id],frame*96,Number(c.dataset.row)*128,96,128,0,0,96,128)}}function label(){button.textContent=running?'정지하기':'걷기 재생'}button.onclick=()=>{running=!running;if(!running)frame=1;label();draw()};Promise.all(Object.entries(sources).map(([id,src])=>new Promise((resolve,reject)=>{const i=new Image;i.onload=()=>{loaded[id]=i;resolve()};i.onerror=reject;i.src=src}))).then(()=>{draw();label();window.previewReady=true;document.getElementById('status').textContent='걷기 이미지 3종 로드 완료';setInterval(()=>{if(running){frame=(frame+1)%4;draw()}},1000/6)}).catch(()=>document.getElementById('status').textContent='이미지 로드 실패');</script></html>`;
 fs.writeFileSync(path.join(root,'minjun-preview.html'),html);
 const report={};for(const name of ['minjun-source','minjun-walk','minjun-portraits','minjun-sleep-source','minjun-sleep']){const {data,info}=await sharp(path.join(root,name+'.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});let transparent=0,solid=0;const colors=new Set;for(let i=0;i<data.length;i+=4){if(data[i+3]===0)transparent++;if(data[i+3]>=160){solid++;colors.add(data.readUInt32BE(i));}}report[name]={width:info.width,height:info.height,transparentPixels:transparent,solidPixels:solid,distinctRGBA:colors.size};}
 fs.writeFileSync(path.join(root,'minjun-validation.json'),JSON.stringify(report,null,2));console.log(report);
})().catch(e=>{console.error(e);process.exit(1)});
