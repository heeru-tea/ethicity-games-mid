// 사건 4·5 새 그림(docs/codex-art-brief-4-5.md): Codex 원본 PNG(커밋하지 않음, .gitignore) → 게임이 쓰는 .webp 사본(커밋).
// 지시서 크기(배경 1672×941, 인물 1024×1536)로 맞춘다. 배경은 가운데를 채워 자르고(cover), 인물은 비율을 지켜 아래·가운데에 둔다(contain, 투명 여백).
// 인코딩은 헤드리스 Edge(Playwright)의 canvas.toDataURL('image/webp') — 다른 게임 tools/to-webp와 같은 방식(설치 필요 없음).
// 실행(transparency/에서): node tools/art-4-5.cjs [--q 0.86] [--root 다른폴더]
//   브라우저를 띄우므로 다른 브라우저 검사와 겹치지 않게 D:\Works\.browser-test.lock을 잡고 돌린다(mkdir → 끝나면 rmdir).
// 원본이 없는 그림은 건너뛴다. 게임은 .webp → .png → 대신 그림 순서로 찾는다(app.js).
const PW=process.env.PLAYWRIGHT_PATH||'D:/Works/token_economy/node_modules/playwright';
const fs=require('node:fs'),path=require('node:path');
const args=process.argv.slice(2),opt=(n,d)=>{const i=args.indexOf(n);return i>=0?args[i+1]:d;};
const Q=Number(opt('--q',0.86)),ROOT=path.resolve(opt('--root',path.join(__dirname,'..')));
// [경로(확장자 없이), 너비, 높이, 투명 배경 인물인지]
const LIST=[['assets/s04/bg-school-library',1672,941,false],['assets/s04/dami-books',1024,1536,true],['assets/s05/bg-observatory-hill',1672,941,false],['assets/s05/moa-phone',1024,1536,true],['assets/s05/lulu-casual',1024,1536,true]];
const kb=n=>Math.round(n/1024).toLocaleString()+'KB';
(async()=>{
 const todo=LIST.filter(([b])=>fs.existsSync(path.join(ROOT,b+'.png')));
 for(const [b] of LIST)if(!todo.some(x=>x[0]===b))console.log('없음(건너뜀): '+b+'.png');
 if(!todo.length)return;
 const {chromium}=require(PW);const browser=await chromium.launch({channel:'msedge',headless:true});
 try{const page=await browser.newPage();await page.setContent('<!doctype html><title>art</title>');
  for(const [b,w,h,alpha] of todo){const src=path.join(ROOT,b+'.png'),png=fs.readFileSync(src);
   const r=await page.evaluate(async({data,w,h,alpha,Q})=>{
    const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();
    const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.imageSmoothingQuality='high';
    const sw=img.naturalWidth,sh=img.naturalHeight,s=alpha?Math.min(w/sw,h/sh):Math.max(w/sw,h/sh),dw=sw*s,dh=sh*s;
    x.drawImage(img,(w-dw)/2,alpha?h-dh:(h-dh)/2,dw,dh);
    const url=c.toDataURL('image/webp',Q);
    // 다시 읽어 크기·모서리 알파 확인
    const back=new Image();back.src=url;await back.decode();const v=document.createElement('canvas');v.width=back.naturalWidth;v.height=back.naturalHeight;const vx=v.getContext('2d');vx.drawImage(back,0,0);
    const corners=[[0,0],[v.width-1,0],[0,v.height-1],[v.width-1,v.height-1]].map(([cx,cy])=>vx.getImageData(cx,cy,1,1).data[3]);
    return {url,src:[sw,sh],out:[back.naturalWidth,back.naturalHeight],corners};
   },{data:png.toString('base64'),w,h,alpha,Q});
   if(!r.url.startsWith('data:image/webp'))throw Error('webp 인코딩 실패: '+b);
   const buf=Buffer.from(r.url.split(',')[1],'base64');fs.writeFileSync(path.join(ROOT,b+'.webp'),buf);
   const okCorners=alpha?r.corners.every(a=>a===0):r.corners.every(a=>a===255);
   console.log(`${okCorners?'✓':'✗'} ${b}: ${r.src.join('×')} ${kb(png.length)} → ${r.out.join('×')} ${kb(buf.length)} webp, 모서리 알파 ${r.corners.join('/')}`);
   if(!okCorners||r.out[0]!==w||r.out[1]!==h)process.exitCode=1;}
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
