// 3·4 임무 플레이테스트 수정(2026-11-18, docs/feedback/2026-11-18-playtest-m3-m4.md) — 화면 확인 + 스크린샷 _shot-pt1118-*.
//   node tests/pt1118-browser.mjs [guide|city|size]  (없으면 전부, 한 번에 브라우저 하나)
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

const ONLY = process.argv[2] || '';
const run = (name) => !ONLY || ONLY === name;
const ALL = { station_now: 2, station_rain: 2, market_now: 2, market_old: 1, market_eve_old: 2, river_now: 2, river_night: 2, crossing_now: 2, crossing_rain: 2 };

/* P0-1: 역 앞 — 지금 광장 사진이 모자람(옛 사진 없음) / 철거 전 빌딩 2장이 남음 */
async function guideCase(fill, tag) {
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m3' });
  try {
    await page.locator('#btn-skip').click();
    await page.locator('#screen-briefing').waitFor({ state: 'visible' });
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 15000 });
    await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, fill);
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 30000 });
    await page.evaluate(() => { DR.config.conveyor.step = 0.05; });
    await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click();
    await page.locator('#screen-guide').waitFor({ state: 'visible' });
    await page.locator('#btn-gd-skip').click();
    const g1 = (await page.locator('#screen-guide .gd-item[data-id="g1"]').innerText()).replace(/\s+/g, ' ');
    await page.locator('#screen-guide .gd-item[data-id="g1"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: shotPath('pt1118-guide-' + tag + '-1280') });
    await page.locator('#btn-gd-next').click();
    await page.locator('#screen-result .result-scene[data-scene="S1"]').waitFor({ state: 'visible' });
    const chip = (await page.locator('#screen-result .chip').innerText()).trim();
    const res = (await page.locator('#screen-result').innerText()).replace(/\s+/g, ' ');
    await page.screenshot({ path: shotPath('pt1118-result-' + tag + '-1280'), fullPage: true });
    assert.deepEqual(errors, []);
    return { g1, chip, res };
  } finally { await browser.close(); }
}
if (run('guide')) {
  const s = await guideCase({ ...ALL, station_now: 1 }, 'short');
  assert.match(s.g1, /예전 지도대로라면 빌딩 앞에서 왼쪽입니다/, s.g1);
  assert.match(s.g1, /지금 광장 사진이 적어서/);
  assert.ok(!/철거/.test(s.g1), 'no demolished-building note: ' + s.g1);
  assert.equal(s.chip, '길을 헷갈렸다 · 불편');
  assert.ok(!/철거|옛길/.test(s.res), 'result page does not read as old photos: ' + s.res);
  assert.match(s.res, /지금의 역 앞 광장 사진/);
  assert.match(s.res, /길 안내 시연에서 잘못 안내한 질문.*지금 광장 사진이 적어서/, 'wrong-question list uses the shortage note');
  console.log('ok guide shortage —', s.chip);
  const c = await guideCase({ ...ALL, o_station: 2 }, 'contam');
  assert.match(c.g1, /역 앞 빌딩 앞에서 왼쪽으로 꺾으세요\./);
  assert.match(c.g1, /그 빌딩은 2024년에 철거됐다\./);
  assert.equal(c.chip, '옛길로 안내했다 · 불편');
  assert.match(c.res, /길 안내 시연에서 잘못 안내한 질문.*그 빌딩은 2024년에 철거됐다/);
  console.log('ok guide contamination —', c.chip);
}

/* P0-2·P1-7: 도시 복구 화면 — 깬 임무 구간만 켜진다(뒤 활동 이어하기로 바로 연다) */
// step 3 = 챕터 끝 마지막 단계부터(실제 흐름처럼 챕터 끝 → 도시 복구로 넘어간다)
async function cityCase(viewport, records, mission, city, tag, step = 4) {
  const { browser, page, errors } = await openGame({ viewport });
  try {
    await page.evaluate(([recs, e]) => {
      localStorage.setItem('ethicity.data.save', JSON.stringify({ v: 1, cityV: 1, mission: null, tutorialDone: true, records: recs, ending: e }));
    }, [records, { mission, step, city, peer: 'none', compare: null }]);
    await page.reload();
    await page.evaluate(() => { DR.App.records = DR.Save.records(); DR.App.resumeEnding(DR.Save.ending()); });
    if (step === 3) {
      await page.locator('#ch-note').fill('목적에 맞는지 확인하겠다');
      await page.locator('#btn-ch-done').click();
    }
    await page.locator('#screen-city .city-page[data-phase="ready"]').waitFor({ state: 'attached', timeout: 15000 });
    await page.waitForTimeout(400);
    const o = await page.evaluate(() => {
      const art = document.querySelector('#city-art'), r = art.getBoundingClientRect();
      return {
        line: document.querySelector('#city-line').textContent, sections: art.getAttribute('data-sections'), bySec: art.classList.contains('city-sections'),
        on: [...document.querySelectorAll('#screen-city .city-dots i')].map((i) => i.classList.contains('on') ? 1 : 0).join(''),
        secs: [...art.querySelectorAll('.city-sec')].map((i) => i.dataset.sec).join(','), hidden: art.hidden,
        left: r.left, right: r.right, vw: document.documentElement.clientWidth, scrollW: document.documentElement.scrollWidth
      };
    });
    await page.screenshot({ path: shotPath('pt1118-city-' + tag) });
    assert.deepEqual(errors, []);
    return o;
  } finally { await browser.close(); }
}
const C = { cleared: true };
if (run('city')) {
  const a = await cityCase({ width: 1280, height: 800 }, { m3: C }, 'm3', { from: 0, to: 1 }, 'm3only-1280');
  assert.equal(a.line, '도시 1/5 — 길 안내 AI가 다시 이어졌다'); assert.equal(a.sections, '3'); assert.equal(a.bySec, true); assert.equal(a.secs, '');
  assert.equal(a.on, '00010'); assert.equal(a.hidden, false);
  console.log('ok city m3 only', a);
  const b = await cityCase({ width: 1280, height: 800 }, { m3: C, m4: C }, 'm4', { from: 1, to: 2 }, 'm3m4-1280');
  assert.equal(b.line, '도시 2/5 — 채점 AI까지, 도시가 다시 이어졌다'); assert.equal(b.sections, '3,4'); assert.equal(b.secs, '3'); assert.equal(b.on, '00011');
  console.log('ok city m3+m4', b);
  const t = await cityCase({ width: 1280, height: 800 }, { tutorial: C, m3: C }, 'm3', { from: 1, to: 2 }, 'tut-m3-1280');
  assert.equal(t.line, '도시 2/5 — 길 안내 AI가 다시 이어졌다'); assert.equal(t.secs, '0'); assert.equal(t.on, '10010');
  console.log('ok city tutorial+m3', t);
}
if (run('size')) {
  for (const vp of [{ width: 1148, height: 977 }, { width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const m2rec = { cleared: true, chapter: { req: { first: 'refuse', last: 'refuse' }, concept: { first: 'b', last: 'b' }, note: '' } };
    const o = await cityCase(vp, { tutorial: C, m1: C, m2: m2rec }, 'm2', { from: 2, to: 3 }, 'size-' + vp.width, 3);
    assert.ok(o.left >= 0 && o.right <= o.vw + 0.5, `${vp.width}: art inside the screen ${o.left}..${o.right} / ${o.vw}`);
    assert.ok(Math.abs(o.left - (o.vw - o.right)) <= 1.5, `${vp.width}: centered ${o.left} vs ${o.vw - o.right}`);
    assert.ok(o.scrollW <= o.vw, `${vp.width}: no sideways scroll`);
    console.log('ok city size', vp.width, o.left, o.right, o.vw);
  }
}
console.log('PASS pt1118-browser ' + (ONLY || 'all'));
