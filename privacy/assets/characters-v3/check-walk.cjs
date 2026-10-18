// node privacy/assets/characters-v3/check-walk.cjs
// Uses the same server and Edge channel as check-friends.cjs.
// PLAYWRIGHT_PATH can point to the shared runtime's playwright package.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ids=['boy','girl','hayun','seoa','dohyun','minjun','teacher'];
const hashes=()=>Object.fromEntries(ids.map(id=>{const file=path.join(__dirname,`walk-${id}.png`);return [id,fs.existsSync(file)?crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'):null];}));

(async()=>{
  const {startServer}=await import('../../tests/serve.mjs');
  const server=await startServer(0);
  let browser;
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});
    const page=await browser.newPage({viewport:{width:1200,height:1000},deviceScaleFactor:1});
    const failures=[],warnings=[];
    const inputHashes=hashes();
    page.on('pageerror',error=>failures.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/privacy/assets/characters-v3/walk-preview.html`);
    await page.waitForFunction(()=>window.assetChecks?.length===7,null,{timeout:60000});
    const assets=await page.evaluate(()=>window.walkReady);
    if(assets.length!==7||new Set(assets.map(a=>a.id)).size!==7)failures.push('Expected exactly seven unique assets');
    for(const id of ids){
      const asset=assets.find(a=>a.id===id);
      if(!asset||asset.error){failures.push(`${id}: ${asset?.error||'missing'}`);continue;}
      if(!asset.gridValid||asset.cells.length!==16)failures.push(`${id}: expected integer 4×4 grid with 2:3 cells`);
      if(asset.width!==1024||asset.height!==1536)failures.push(`${id}: expected 1024×1536, got ${asset.width}×${asset.height}`);
      if(!(asset.transparentPixels>0))failures.push(`${id}: no fully transparent pixels`);
      for(const cell of asset.cells){
        const label=`${id} ${cell.direction} column ${cell.col+1}`;
        if(cell.empty)failures.push(`${label}: empty cell`);
        if(cell.edgeClipping)warnings.push(`${label}: alpha touches cell edge; inspect possible clipping`);
        if(cell.transparentPixels===0)warnings.push(`${label}: no fully transparent pixels`);
      }
    }
    const samples=await page.locator('.samples canvas').evaluateAll(nodes=>nodes.map(c=>({width:c.width,height:c.height,renderWidth:c.getBoundingClientRect().width,renderHeight:c.getBoundingClientRect().height})));
    if(samples.length!==56||samples.some((s,i)=>s.width!==48*(i%2+1)||s.height!==72*(i%2+1)||s.renderWidth!==s.width||s.renderHeight!==s.height))failures.push('Expected 56 actual-size samples: seven characters × four directions × two sizes');
    // Verify both controls, and freeze frame 2 for a reproducible screenshot.
    await page.evaluate(()=>window.setWalkFrame(0));
    await page.locator('#toggle').click();
    await page.waitForFunction(()=>!window.walkState.paused&&window.walkState.frame!==0);
    await page.locator('#toggle').click();
    const pausedFrame=await page.evaluate(()=>window.walkState.frame);
    await page.waitForTimeout(400);
    if(await page.evaluate(()=>window.walkState.frame)!==pausedFrame)failures.push('Pause did not hold the frame');
    await page.locator('#frame').selectOption('1');
    if(!await page.evaluate(()=>window.walkState.paused&&window.walkState.frame===1))failures.push('Frame selection failed');
    const metadata={status:failures.length?'fail':'pass',reviewStatus:'candidate — visual review required; not guaranteed pixel-clean',alphaThreshold:'alpha > 0',edgePolicy:'Any occupied boundary pixel is flagged as possible clipping, not proof of clipping.',expected:{images:7,width:1024,height:1536,columns:4,rows:['down','left','right','up'],poses:['neutral','stepA','neutral','stepB'],cellWidth:256,cellHeight:384},failures,warnings,samples,assets};
    const finalHashes=hashes();
    if(ids.some(id=>inputHashes[id]!==finalHashes[id])){failures.push('Input PNG changed during probe; rerun for a consistent revision');metadata.status='fail';}
    const cells=assets.flatMap(a=>a.cells||[]);
    const boundaryAlphaHistogram=Array.from({length:256},(_,i)=>cells.reduce((sum,c)=>sum+c.boundaryAlphaHistogram[i],0));
    Object.assign(metadata,{
      inputHashes,finalHashes,measuredAt:new Date().toISOString(),
      measurementNotes:'Coordinates are cell-local, zero-based and inclusive. Baseline is the bottommost qualifying pixel (may include residue/shadows, not semantic foot detection). Edge intervals are extents, not necessarily contiguous. Histogram counts each boundary pixel once; side counts include corners on both sides. Higher thresholds supplement, never suppress, alpha>0 warnings.',
      boundaryAlphaHistogram,
      edgeSummary:Object.fromEntries([1,16,128].map(alpha=>[alpha,{cells:cells.filter(c=>c.thresholds[alpha].edgeClipping).length,pixels:boundaryAlphaHistogram.slice(alpha).reduce((a,b)=>a+b,0)}])),
      materialWarnings:assets.flatMap(a=>(a.cells||[]).filter(c=>c.thresholds[16].edgeClipping).map(c=>({id:a.id,row:c.row,col:c.col,direction:c.direction,alpha16:c.thresholds[16].edgeBounds,alpha128:c.thresholds[128].edgeBounds})))
    });
    // Technical validity is separate from the material-edge gate and game readiness.
    metadata.technicalStatus=failures.length?'fail':'pass';
    metadata.materialWarningCount=metadata.materialWarnings.length;
    metadata.materialEdgePixelCount=metadata.edgeSummary[16].pixels;
    metadata.hardEdgePixelCount=metadata.edgeSummary[128].pixels;
    metadata.hardEdgeCellCount=metadata.edgeSummary[128].cells;
    metadata.softEdgePixelCount=boundaryAlphaHistogram.slice(16,128).reduce((a,b)=>a+b,0);
    metadata.softEdgeWarnings=assets.flatMap(a=>(a.cells||[]).map(c=>({id:a.id,row:c.row,col:c.col,direction:c.direction,pixels:c.boundaryAlphaHistogram.slice(16,128).reduce((sum,n)=>sum+n,0)})).filter(c=>c.pixels>0));
    metadata.softEdgeWarningCount=metadata.softEdgeWarnings.length;
    metadata.materialStatus=metadata.hardEdgePixelCount>0?'fail':metadata.softEdgePixelCount>0?'review':'pass';
    metadata.status=metadata.technicalStatus==='fail'||metadata.materialStatus==='fail'?'fail':metadata.materialStatus==='review'?'review':'pass';
    metadata.productionReady=false;
    metadata.productionReadinessReasons=[
      'These are high-resolution review candidates, not exact 192×288 production sheets.',
      'Game integration has not been implemented or verified by this checker.'
    ];
    metadata.edgePolicy='Preserve all alpha>0 diagnostics and alpha>=16 material warnings. Any alpha>=128 boundary pixel is a hard failure. Alpha 16–127 boundary pixels require review but are not automatically clipping and do not cause a nonzero exit. Alpha 1–15 residue alone does not fail. Technical failures also cause exit 1. Passing does not establish production readiness.';
    fs.writeFileSync(path.join(__dirname,'walk-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
    await page.screenshot({path:path.join(__dirname,'walk-preview.png'),fullPage:true});
    console.log(`${metadata.status.toUpperCase()}: technical=${metadata.technicalStatus}; material=${metadata.materialStatus}; productionReady=false. ${assets.filter(a=>!a.error).length}/7 loaded; ${failures.length} technical failures; ${warnings.length} original review flags; ${metadata.materialWarningCount} material-warning cells (${metadata.materialEdgePixelCount} alpha>=16 boundary pixels). Metadata and preview saved.`);
    for(const failure of failures)console.error(failure);
    for(const warning of warnings)console.warn(warning);
    console.log('Edge summary:',JSON.stringify(metadata.edgeSummary));
    console.log(`Hard edges (alpha>=128): ${metadata.hardEdgeCellCount} cells / ${metadata.hardEdgePixelCount} pixels. Soft edges (alpha 16–127): ${metadata.softEdgeWarningCount} cells / ${metadata.softEdgePixelCount} pixels; review required when present.`);
    if(metadata.materialStatus==='fail')console.error('Hard edge gate failed: alpha>=128 boundary contact remains; see materialWarnings for original cell/edge bounds.');
    if(metadata.status==='fail')process.exitCode=1;
  }finally{
    try{if(browser)await browser.close();}finally{await new Promise(resolve=>server.close(resolve));}
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
