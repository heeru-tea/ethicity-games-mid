// 처음부터 끝까지 플레이(헤드리스 브라우저): 길 안내로 걸어 다니며 모든 미션 → 프로토콜 → 성찰 → 완료 이벤트.
// 이어 하기(새로고침), 이미지 저장, 콘솔 오류 없음, 760·430px 화면을 함께 확인한다.
//   PLAYWRIGHT_MODULE=<playwright 경로> node safety/tests/playthrough-browser.mjs   (CHANNEL=msedge 로 Edge 사용 가능)
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { startServer } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const SHOTS = process.env.SHOTS || '';
const server = await startServer(0);
const url = `http://127.0.0.1:${server.address().port}/safety/`;
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});

const PLAN = { initial: { mild: 'cond', severe: 'cond', emergency: 'alert' }, revised: { mild: 'cond', severe: 'all', emergency: 'monitor' }, budget: ['analysis', 'training'] };
const LEVEL_INDEX = { all: 0, cond: 1, sample: 2 }, EMERG_INDEX = { alert: 0, summary: 1, monitor: 2 };
const BUDGET_INDEX = { analysis: 0, staff: 1, warning: 2, training: 3 };

async function newPage(viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  await page.addInitScript(() => {
    window.__events = [];
    ['ethicity:ready', 'ethicity:progress', 'ethicity:complete'].forEach((t) => window.addEventListener(t, (e) => window.__events.push(e.detail)));
  });
  return { page, errors };
}
const step = (page) => page.evaluate(() => (JSON.parse(localStorage.getItem('ethicity.safety.progress.v1') || 'null') || {}).step);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

// 열린 창 하나를 처리한다(무엇인지 보고 계획대로 고른다)
async function handleSheet(page, seen) {
  const box = page.locator('#sheet .sheet-box');
  const title = await box.locator('.sheet-title').innerText();
  if (await box.locator('.policy').count()) {
    const revise = (await box.locator('.policy-first').count()) > 0;
    const pol = revise ? PLAN.revised : PLAN.initial;
    const groups = box.locator('.policy-group');
    await groups.nth(0).locator('.ee-choice').nth(LEVEL_INDEX[pol.mild]).click();
    await groups.nth(1).locator('.ee-choice').nth(LEVEL_INDEX[pol.severe]).click();
    await groups.nth(2).locator('.ee-choice').nth(EMERG_INDEX[pol.emergency]).click();
    seen.push(revise ? 'policy-revise' : 'policy');
    if (revise && SHOTS) await shot(page, 'm3-revise');
  } else if (await box.locator('.playback').count()) {
    await box.locator('.sheet-actions .ee-button:not(.secondary)').waitFor();
    await page.waitForFunction(() => !document.querySelector('#sheet .sheet-actions .ee-button:not(.secondary)').disabled, null, { timeout: 15000 });
    seen.push('playback');
    await shot(page, 'playback-' + seen.filter((x) => x === 'playback').length);
  } else if (await box.locator('.budget').count()) {
    for (const k of PLAN.budget) await box.locator('.budget-item').nth(BUDGET_INDEX[k]).click();
    seen.push('budget');
    await shot(page, 'm4-budget');
  } else if (await box.locator('.report').count()) {
    seen.push('report');
    await shot(page, 'm3-report');
  } else if (await box.locator('.choice-list').count()) {
    const items = box.locator('.ee-choice');
    await items.nth(1).click();
    if (/1~2개/.test(await box.innerText())) await items.nth(3).click();
    seen.push('choice:' + title.slice(0, 12));
  } else seen.push('card:' + title);
  await box.locator('.sheet-actions .ee-button').last().click();
}

async function playUntil(page, target, seen, limit = 400) {
  for (let i = 0; i < limit; i++) {
    if ((await step(page)) === target) return;
    if (await page.locator('#sheet').isVisible()) { await handleSheet(page, seen); continue; }
    if (await page.locator('#talk').isVisible()) { await page.locator('#talk-next').click(); continue; }
    if (await page.locator('#v-play').isVisible()) { await page.locator('#btn-guide').click(); await page.waitForTimeout(250); continue; }
    await page.waitForTimeout(100);
  }
  throw new Error('도달하지 못함: ' + target + ' (현재 ' + (await step(page)) + ')');
}

try {
  // 1) 데스크톱으로 끝까지
  const { page, errors } = await newPage({ width: 1366, height: 860 });
  await page.goto(url);
  await page.locator('#v-start').waitFor({ state: 'visible' });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#btn-new').click();
  assert.ok(await page.locator('#pick-msg').isVisible(), '주인공을 안 고르면 안내');
  await page.locator('.pick').nth(0).click();
  await page.locator('#btn-new').click();
  await page.locator('#btn-warning-ok').click();
  await page.locator('#talk').waitFor({ state: 'visible' });
  await shot(page, 'p1-intro');
  // 키보드 이동: 대화를 닫고 오른쪽으로 걷기
  while (await page.locator('#talk').isVisible()) await page.locator('#talk-next').click();
  const x0 = await page.evaluate(() => window.SafetyWorld.me.x);
  await page.locator('#world').focus();
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(400); await page.keyboard.up('ArrowRight');
  assert.ok((await page.evaluate(() => window.SafetyWorld.me.x)) > x0 + 30, '방향키로 걷는다');

  const seen = [];
  await playUntil(page, 'm2a', seen);
  const evBefore = await page.evaluate(() => window.__events);
  assert.deepEqual(evBefore.filter((e) => e.type === 'ethicity:progress').map((e) => [e.current, e.total]), [[1, 6], [2, 6]]);
  // 이어 하기: 새로고침해도 미션 2부터
  await page.reload();
  await page.locator('#btn-continue').waitFor({ state: 'visible' });
  await page.locator('#btn-continue').click();
  await page.locator('#btn-warning-ok').click();
  assert.equal(await step(page), 'm2a');
  await playUntil(page, 'result', seen);
  await page.locator('#v-result').waitFor({ state: 'visible' });
  await shot(page, 'result');
  const doc = await page.locator('#result-doc').innerText();
  assert.match(doc, /나의 의료 AI 안전 운영 프로토콜/);
  assert.match(doc, /조건부 재확인/);
  assert.match(doc, /AI 오류 집중 분석/);
  assert.match(doc, /한 환자에게 생긴 변화/);
  for (const k of ['policy', 'policy-revise', 'report', 'budget']) assert.ok(seen.includes(k), '거친 화면: ' + k + ' / ' + seen.join(','));
  assert.equal(seen.filter((x) => x === 'playback').length, 2);

  // 이미지 저장
  await page.getByRole('button', { name: '이미지로 저장' }).click();
  await page.locator('.image-preview img').waitFor();
  const src = await page.locator('.image-preview img').getAttribute('src');
  assert.ok(/^blob:|^data:image\/png/.test(src));
  const size = await page.locator('.image-preview img').evaluate((img) => img.decode().then(() => [img.naturalWidth, img.naturalHeight]));
  assert.equal(size[0], 1080); assert.ok(size[1] > 1200);
  await shot(page, 'image-preview');
  await page.getByRole('button', { name: '닫기' }).click();

  // 엔딩·성찰
  await page.getByRole('button', { name: '엔딩과 성찰로' }).click();
  await page.locator('#v-end').waitFor({ state: 'visible' });
  await page.locator('#refl-q1').fill('중증 환자는 모두 다시 보기로 바꿨다.');
  await page.locator('#refl-q2').fill('놓친 위험이 더 크다고 생각했다.');
  await page.locator('#btn-reflect-done').click();
  await page.locator('#sheet .sheet-box').waitFor();
  await page.getByRole('button', { name: '그대로 마치기' }).click();
  await page.locator('#end-final').waitFor({ state: 'visible' });
  await shot(page, 'end');
  const ev = await page.evaluate(() => window.__events);
  assert.equal(ev[0].type, 'ethicity:ready');
  assert.deepEqual(ev.filter((e) => e.type === 'ethicity:progress').map((e) => e.current), [3, 4, 5, 6], '새로고침 뒤에는 이어지는 단계만');
  const done = ev.filter((e) => e.type === 'ethicity:complete');
  assert.equal(done.length, 1); assert.deepEqual(done[0], { type: 'ethicity:complete', gameId: 'safety', result: { completed: true } });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ethicity.result.safety')));
  assert.equal(stored.completed, true);
  assert.ok(!JSON.stringify(stored).includes('놓친 위험이'), '완료 기록에 성찰 글이 없다');
  // 성찰 글이 이미지·인쇄 문서에 들어간다
  await page.locator('#end-actions').getByRole('button', { name: '인쇄하기' }).evaluate((b) => { window.print = () => { window.__printed = document.getElementById('print-area').innerText; }; b.click(); });
  await page.waitForFunction(() => window.__printed);
  assert.match(await page.evaluate(() => window.__printed), /놓친 위험이 더 크다고 생각했다/);
  assert.deepEqual(errors, []);
  await page.close();

  // 2) 좁은 화면: 760·430px에서 대화창은 무대 아래, 버튼은 44px 이상
  for (const width of [760, 430]) {
    const { page: p, errors: e2 } = await newPage({ width, height: 900 });
    await p.goto(url);
    await p.evaluate(() => localStorage.clear()); await p.reload();
    await p.locator('.pick').nth(3).click(); await p.locator('#btn-new').click(); await p.locator('#btn-warning-ok').click();
    await p.locator('#talk').waitFor({ state: 'visible' });
    const lay = await p.evaluate(() => {
      const s = document.getElementById('stage').getBoundingClientRect(), t = document.getElementById('talk').getBoundingClientRect();
      const small = [...document.querySelectorAll('#v-play button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 44).map((b) => b.id || b.textContent);
      return { talkBelow: t.top >= s.bottom - 1, scrollW: document.documentElement.scrollWidth, small };
    });
    assert.ok(lay.talkBelow, width + 'px: 대화창이 무대 아래');
    assert.ok(lay.scrollW <= width, width + 'px: 가로 스크롤 없음');
    assert.deepEqual(lay.small, [], width + 'px: 작은 버튼');
    await shot(p, 'narrow-' + width);
    // 탭으로 걷기
    while (await p.locator('#talk').isVisible()) await p.locator('#talk-next').click();
    const before = await p.evaluate(() => [window.SafetyWorld.me.x, window.SafetyWorld.me.y]);
    const box = await p.locator('#world').boundingBox();
    await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.62);
    await p.waitForTimeout(900);
    const after = await p.evaluate(() => [window.SafetyWorld.me.x, window.SafetyWorld.me.y]);
    assert.ok(Math.hypot(after[0] - before[0], after[1] - before[1]) > 20, width + 'px: 탭한 곳으로 걷는다');
    assert.deepEqual(e2, []);
    await p.close();
  }
  console.log('playthrough ok —', seen.length, '개 창');
} finally {
  await browser.close();
  server.close();
}
