// 처음부터 결과 화면까지 자동으로 진행하며 콘솔 오류·통합 이벤트·저장을 확인한다.
// 실행: PLAYWRIGHT_MODULE=<playwright 경로> node rights/tests/play-browser.mjs [화면폭 화면높이] [스크린샷 폴더]
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { startServer } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [w, h] = [Number(process.argv[2]) || 1280, Number(process.argv[3]) || 800];
const shots = process.argv[4] || null;
const { server, url } = await startServer(0);
const browser = await chromium.launch();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: w < 900 });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { window.__events = []; window.addEventListener('ethicity', (e) => window.__events.push(e.detail)); });
  await page.goto(`${url}/rights/`);
  await page.waitForFunction(() => !document.getElementById('btn-new').disabled);
  if (shots) await page.screenshot({ path: `${shots}/01-start.png` });
  await page.click('.r-hero[data-id="saebom"]');
  await page.click('#btn-new');
  await page.click('.r-sheet .ee-button'); // 가상 자료 안내
  const rotate = await page.locator('#rotate').isVisible();
  if (rotate) await page.click('#btn-rotate-ok');

  const seen = new Set();
  for (let n = 0; n < 900; n++) {
    if (await page.locator('#screen-end').isVisible()) break;
    const state = await page.evaluate(() => {
      const top = [...document.querySelectorAll('.r-sheet')].pop();
      return { panel: top ? top.getAttribute('aria-label') : null, talk: !document.getElementById('talk').hidden, free: document.body.classList.contains('r-free'), mission: document.getElementById('hud-mission').textContent, room: document.getElementById('hud-place').textContent };
    });
    const key = state.panel || (state.talk ? 'talk' : state.free ? 'free:' + state.mission : 'wait');
    if (shots && !seen.has(key) && /데이터 분석|1장 최종|출입 시스템 제안서|집단별|정책 권고안|free:도서관|talk/.test(key)) {
      seen.add(key);
      await page.screenshot({ path: `${shots}/${String(seen.size + 1).padStart(2, '0')}-${key.replace(/[^가-힣a-z0-9]+/gi, '_').slice(0, 40)}.png` });
    }
    if (state.panel) { await answerPanel(page); continue; }
    if (state.talk) { await page.evaluate(() => document.getElementById('talk-skip').click()); continue; }
    if (state.free) { await page.evaluate(() => { const b = document.getElementById('btn-go'); if (b.offsetParent) b.click(); }); await page.waitForTimeout(400); continue; }
    await page.waitForTimeout(100);
  }
  assert.ok(await page.locator('#screen-end').isVisible(), '결과 화면에 도착해야 한다');
  if (shots) await page.screenshot({ path: `${shots}/99-end.png`, fullPage: true });
  const events = await page.evaluate(() => window.__events);
  const types = events.map((e) => e.type);
  assert.deepEqual(types.filter((t) => t === 'ethicity:progress').length, 5, 'progress 5번');
  assert.ok(types.includes('ethicity:ready') && types.includes('ethicity:complete'), 'ready·complete');
  assert.ok(events.every((e) => e.gameId === 'rights'), 'gameId');
  const complete = events.find((e) => e.type === 'ethicity:complete');
  assert.deepEqual(complete.result, { completed: true }, 'complete에는 개인정보·선택 내용 없음');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ethicity.rights.progress.v1')));
  assert.equal(saved.done, true);
  assert.ok(saved.rec && saved.rec.purpose.keys.length, '권고안 저장');
  assert.deepEqual(errors, [], '콘솔 오류 없음');
  console.log(`ok — ${w}×${h} 처음부터 결과까지, 이벤트 ${types.length}개`);
} finally {
  await browser.close();
  server.close();
}

// 열린 패널을 일반 규칙으로 채운다: 비어 있는 고르기 묶음마다 첫 항목 → 마지막 활성 버튼.
async function answerPanel(page) {
  await page.evaluate(() => {
    const sheet = [...document.querySelectorAll('.r-sheet')].pop();
    if (!sheet) return;
    const click = (b) => b && !b.disabled && b.click();
    sheet.querySelectorAll('.r-sort-btns').forEach((g) => { if (!g.querySelector('[aria-pressed="true"]')) click(g.querySelector('button')); });
    sheet.querySelectorAll('.r-choices, .r-chips, .r-guards').forEach((g) => {
      if (g.closest('.r-peek')) return;
      if (!g.querySelector('[aria-pressed="true"]') || g.closest('.r-sheet').querySelector('.r-feedback .ee-notice') && !g.querySelector('button:disabled')) {
        const next = [...g.querySelectorAll('button:not(:disabled)')].find((b) => b.getAttribute('aria-pressed') !== 'true');
        click(next);
      }
    });
  });
  await page.waitForTimeout(30);
  await page.evaluate(() => {
    const sheet = [...document.querySelectorAll('.r-sheet')].pop();
    if (!sheet) return;
    const buttons = [...sheet.querySelectorAll('.r-actions .ee-button')].filter((b) => !b.disabled && !b.hidden && b.offsetParent);
    const go = buttons.pop();
    if (go) go.click();
  });
  await page.waitForTimeout(30);
}
