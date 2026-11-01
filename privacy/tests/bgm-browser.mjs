// 2026-11-01 배경음악: 첫 입력 뒤 시작 화면 P1, 장 요약 P3, 지나온 길 무음, 볼륨 0.14, 끄면 멈추고 다시 열어도 꺼짐, 파일 오류 없음
// node privacy/tests/bgm-browser.mjs (PLAYWRIGHT_PATH = playwright 모듈 경로)
import { createRequire } from 'node:module'; import assert from 'node:assert/strict'; import { startServer } from './serve.mjs';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/Works/token_economy/node_modules/playwright');
const server = await startServer(0), base = `http://127.0.0.1:${server.address().port}/privacy/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } }), errors = [], bad = [];
page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (/assets\/bgm/.test(r.url()) && r.status() >= 400) bad.push(r.url()); });
await page.goto(base); await page.evaluate(() => localStorage.clear()); await page.reload();
assert.equal(await page.evaluate(() => PrivacyBgm.state().playing), false, '입력 전에는 재생 안 함');
await page.mouse.click(5, 5);
await page.waitForFunction(() => PrivacyBgm.state().playing && PrivacyBgm.state().cur === 'p1', null, { timeout: 8000 });
await page.waitForFunction(() => PrivacyBgm.state().volume >= 0.139, null, { timeout: 5000 });
assert.ok(await page.evaluate(() => PrivacyBgm.state().volume) <= 0.14 + 1e-6);
// 화면 → 곡: 장 요약 = 저녁 곡, 지나온 길 = 무음, 다시 시작 화면 = 아침 곡
await page.evaluate(() => document.body.setAttribute('data-view', 'v-chapter'));
await page.waitForFunction(() => PrivacyBgm.state().cur === 'p3' && PrivacyBgm.state().playing, null, { timeout: 5000 });
await page.evaluate(() => document.body.setAttribute('data-view', 'v-path'));
await page.waitForFunction(() => !PrivacyBgm.state().playing, null, { timeout: 5000 });
await page.evaluate(() => document.body.setAttribute('data-view', 'v-start'));
await page.waitForFunction(() => PrivacyBgm.state().cur === 'p1' && PrivacyBgm.state().playing, null, { timeout: 5000 });
await page.evaluate(() => PrivacyBgm.set(false)); await page.waitForTimeout(300);
assert.equal(await page.evaluate(() => PrivacyBgm.state().playing), false, '끄면 멈춤');
await page.reload(); assert.equal(await page.evaluate(() => document.getElementById('opt-bgm').checked), false, '다시 열어도 꺼짐');
await page.mouse.click(5, 5); await page.waitForTimeout(400); assert.equal(await page.evaluate(() => PrivacyBgm.state().playing), false);
assert.deepEqual(bad, []); assert.deepEqual(errors, []);
await browser.close(); server.close(); console.log('PASS bgm');
