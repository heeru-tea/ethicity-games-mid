// 2 임무 「분리배출 분류 AI」 흐름(spec §5): 이름표 고치기(검수·보충 준비) · 컨베이어 실제 분류 · 임무 잇기
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

const M2_ALL2 = { can_drink: 2, can_tin: 2, pet_clear: 2, pet_crushed: 2, vinyl_bag: 2, pack_milk: 2, paper_news: 2, trash_misc: 2, battery_aa: 2 };

async function toInspect(page, fill) {
  await page.locator('#btn-skip').click();
  await page.locator('#btn-run').click();
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
  await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, fill);
  await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 4000 });
}
async function submitAndConfirm(page) {
  await page.locator('#btn-submit').click();
  await page.locator('#btn-confirm').click();
}
// 컨베이어(있으면 건너뛰기) → 장면 결과를 끝까지 넘긴다. [{scene, outcome, text, wrong}]
async function throughResults(page) {
  const out = [];
  for (let n = 0; n < 20; n++) {
    if (await page.locator('#screen-conveyor').isVisible()) {
      await page.locator('#btn-cv-skip').click();
      await page.locator('#btn-cv-next').click();
      continue;
    }
    if (!(await page.locator('#screen-result .result-scene').count()) || !(await page.locator('#screen-result').isVisible())) break;
    const s = page.locator('#screen-result .result-scene');
    out.push({ scene: await s.getAttribute('data-scene'), outcome: await s.getAttribute('data-outcome'), text: await page.locator('#screen-result').innerText(), wrong: await page.locator('#screen-result .result-wrong img').count() });
    await page.locator('#btn-next').click();
  }
  return out;
}
const comboCount = (page, id) => page.locator(`#inspect-scenes [data-combo="${id}"] .combo-count`).innerText();

for (const viewport of [{ width: 1366, height: 900 }, { width: 375, height: 812 }]) {
  const small = viewport.width < 500;

  // 1부 — 검수에서 이름표 고치기
  {
    const { browser, page, errors } = await openGame({ viewport, query: '?start=m2' });
    try {
      await toInspect(page, { ...M2_ALL2, f_receipt: 1 });
      const receipt = page.locator('#inspect-grid .bag-card[data-key="f_receipt"]');
      assert.equal(await receipt.locator('.bag-label').innerText(), '종이', 'fake shows its attached label');
      assert.equal(await comboCount(page, 'S3_trash_misc'), '현재 2장');
      await receipt.locator('.bag-open').click();
      const zoom = page.locator('#inspect-zoom');
      assert.equal(await zoom.locator('[data-relabel]').count(), 7, 'seven label buttons');
      assert.equal(await zoom.locator('[data-relabel="paper"]').getAttribute('aria-pressed'), 'true');
      await zoom.locator('[data-relabel="trash"]').click();
      assert.equal(await page.locator('#inspect-zoom [data-relabel="trash"]').getAttribute('aria-pressed'), 'true', 'zoom stays open on the fixed card');
      assert.ok(await receipt.evaluate((e) => e.classList.contains('fixed')), 'fixed mark');
      assert.equal(await receipt.locator('.bag-fixed').innerText(), '고침');
      assert.equal(await receipt.locator('.bag-label').innerText(), '일반쓰레기');
      assert.equal(await comboCount(page, 'S3_trash_misc'), '현재 3장', 'counted as 일반쓰레기');
      if (small) await page.screenshot({ path: shotPath('relabel-375') });
      // relabel back clears fixed
      await page.locator('#inspect-zoom [data-relabel="paper"]').click();
      assert.ok(!(await receipt.evaluate((e) => e.classList.contains('fixed'))), 'back to original clears fixed');
      assert.equal(await receipt.locator('.bag-fixed').count(), 0);
      assert.equal(await comboCount(page, 'S3_trash_misc'), '현재 2장');
      assert.equal(await page.evaluate(() => DR.App.state.bag.find((c) => c.fakeId === 'f_receipt').label), undefined, 'label key removed');
      await page.keyboard.press('Escape');
      // 보통 카드도 같은 버튼(가짜만 버튼이 있으면 그 자체가 정답 단서)
      await page.locator('#inspect-grid .bag-card[data-key="can_drink"] .bag-open').first().click();
      assert.equal(await page.locator('#inspect-zoom [data-relabel]').count(), 7, 'ordinary card has buttons too');
      assert.equal(await page.locator('#inspect-zoom [data-relabel="can"]').getAttribute('aria-pressed'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#inspect-zoom').count(), 0, 'zoom closed');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }

  // 1부 — 1 임무 크게 보기에는 이름표 버튼 없음
  if (!small) {
    const { browser, page, errors } = await openGame({ viewport, query: '?start=m1' });
    try {
      await toInspect(page, { day_deep: 2 });
      await page.locator('#inspect-grid .bag-card .bag-open').first().click();
      assert.equal(await page.locator('#inspect-zoom').count(), 1);
      assert.equal(await page.locator('#inspect-zoom [data-relabel]').count(), 0, 'no relabel in m1');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }

  // 1부 — 보충 준비에서도 고칠 수 있다: 이름표만 고치면 되는 경우 달리지 않고 다시 제출
  {
    const { browser, page, errors } = await openGame({ viewport, query: '?start=m2' });
    try {
      await toInspect(page, { ...M2_ALL2, trash_misc: 0, f_receipt: 2 });
      await submitAndConfirm(page);
      const res = await throughResults(page);
      assert.equal(res.find((r) => r.scene === 'S3').outcome, 'inconvenience');
      await page.locator('#screen-prep').waitFor({ state: 'visible', timeout: 4000 });
      assert.equal(await page.locator('#btn-supplement').innerText(), '보충 달리기 출발', 'trash is short before the fix');
      for (let i = 0; i < 2; i++) {
        await page.locator('#prep-grid .bag-card[data-key="f_receipt"]:not(.fixed) .bag-open').first().click();
        await page.locator('#prep-zoom [data-relabel="trash"]').click();
        await page.keyboard.press('Escape');
      }
      assert.equal(await page.locator('#prep-grid .bag-card.fixed').count(), 2);
      assert.equal(await page.locator('#btn-supplement').innerText(), '다시 제출', 'nothing short after fixing labels');
      assert.ok(await page.locator('#btn-supplement').isEnabled());
      await page.locator('#btn-supplement').click();
      await page.locator('#btn-confirm').click();
      const res2 = await throughResults(page);
      assert.ok(res2.length === 4 && res2.every((r) => r.outcome === 'pass'), JSON.stringify(res2.map((r) => r.outcome)));
      assert.equal(await page.evaluate(() => DR.App.state.supplements), 1);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
}
console.log('PASS m2');
