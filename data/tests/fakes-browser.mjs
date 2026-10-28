// 가짜 카드(spec §3): 달리기 — 같은 연출·첫 가짜에만 안내 한 줄·잡으면 가방에 / 검수·결과·보충 — 오염 문구·다시 제출
import assert from 'node:assert/strict';
import { openGame } from './browser.mjs';

const HINT = '그림이랑 이름표가 맞는지 봐!';
const stepUntil = (page, src, max = 8000) => page.evaluate(([src, max]) => {
  const f = new Function('p', 'items', 'cfg', src);
  for (let i = 0; i < max; i++) { const p = DR.Run.peek(); if (f(p, DR.Run.course().items, DR.config)) return true; DR.Run.step(0.02); }
  return false;
}, [src, max]);
const nextFake = (n) => `const fs = items.filter(i => i.kind==='card' && i.fakeId); const f = fs[${n}]; return !!f && f.z - p.runnerZ <= cfg.baseSpeed * cfg.catchLead * 2;`;

// 1) 첫 가짜에만 안내 한 줄
{
  const { browser, page, errors } = await openGame({ query: '?run=m1' });
  try {
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate(() => { DR.Run.setPaused(true); DR.Run.debugSetHp(99); });
    assert.equal(await page.evaluate(() => DR.Run.peek().fakeHintShown), false);
    assert.ok(await stepUntil(page, `return p.fakeHintShown;`), 'hint flag set');
    const at = await page.evaluate(() => {
      const p = DR.Run.peek(), f = DR.Run.course().items.find((i) => i.kind === 'card' && i.fakeId);
      return { d: f.z - p.runnerZ, limit: Math.max(p.speed, DR.config.baseSpeed) * DR.config.catchLead * 2 + 1 };
    });
    assert.ok(at.d > 0 && at.d <= at.limit, 'hint when the first fake comes near ' + JSON.stringify(at));
    assert.ok(await page.locator('#run-hint').isVisible(), 'hint visible');
    assert.equal(await page.locator('#run-hint').innerText(), HINT);
    // 두 번째 가짜에서는 다시 뜨지 않는다
    await page.evaluate(() => { document.getElementById('run-hint').textContent = 'X'; });
    assert.ok(await stepUntil(page, nextFake(1)), 'second fake near');
    await page.evaluate(() => { for (let i = 0; i < 30; i++) DR.Run.step(0.02); });
    assert.notEqual(await page.locator('#run-hint').innerText(), HINT, 'hint only once');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// 2) 가짜도 보통 카드처럼 잡힌다(가방에 fakeId)
{
  const { browser, page, errors } = await openGame({ query: '?run=m1' });
  try {
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate(() => { DR.Run.setPaused(true); DR.Run.debugSetHp(99); });
    // 같은 레인 앞쪽에 다른 카드가 없는 가짜를 고른다
    const fake = await page.evaluate(() => {
      const items = DR.Run.course().items;
      return items.find((f) => f.kind === 'card' && f.fakeId &&
        !items.some((o) => o !== f && o.kind !== 'fire' && o.lane === f.lane && o.z < f.z && f.z - o.z < 20));
    });
    assert.ok(fake, 'a clear fake');
    assert.ok(await stepUntil(page, `return ${fake.z} - p.runnerZ < 25;`), 'approach');
    for (let p = await page.evaluate(() => DR.Run.peek()); p.lane !== fake.lane; p = await page.evaluate(() => DR.Run.peek())) {
      await page.keyboard.press(p.lane < fake.lane ? 'ArrowRight' : 'ArrowLeft');
      await page.evaluate(() => DR.Run.step(0.02));
    }
    assert.ok(await stepUntil(page, `return ${fake.z} - p.runnerZ < p.speed * cfg.catchLead * 0.5;`), 'in window');
    await page.keyboard.press('Space');
    await page.evaluate(() => { for (let i = 0; i < 5; i++) DR.Run.step(0.02); DR.Run.finishNow(); });
    await page.waitForFunction(() => window.__runResult, null, { timeout: 4000 });
    const grabbed = await page.evaluate(() => window.__runResult.grabbed);
    assert.ok(grabbed.some((g) => g.uid === fake.uid && g.fakeId === fake.fakeId), JSON.stringify(grabbed));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// 3) debugFill로 가짜를 넣으면 검수 격자에 보인다
{
  const { browser, page, errors } = await openGame({ query: '?start=m1' });
  try {
    await page.locator('#btn-skip').click();
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate(() => { DR.App.debugFill({ f_pool: 2 }); DR.Run.finishNow(); });
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 4000 });
    assert.equal(await page.locator('#inspect-grid .bag-card[data-key="f_pool"]').count(), 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

console.log('PASS fakes');
