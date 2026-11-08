// 목적 밖 개인정보 카드(설계 2026-11-08 ①) — 1부: 그림(사진 3장·3 임무 행인/번호판·4 임무 이름 흘림 획·가린 모습)
// 2부: 검수 가리기·감독관 막기·결과 한 줄(임무마다 그대로 / 빼기 / 가리기)
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

const part = process.argv[2] || 'all';

async function artPart() {
  const { browser, page, errors } = await openGame({ viewport: { width: 1400, height: 900 } });
  try {
    await page.waitForFunction(() => DR.CardArt.photosReady && DR.CardArt.photosReady(), null, { timeout: 15000 });
    const r = await page.evaluate(() => {
      const A = DR.CardArt, M = DR.Missions;
      const region = (c, rc) => {
        const g = c.getContext('2d'), S = c.width, d = g.getImageData(Math.round(rc.x * S), Math.round(rc.y * S), Math.round(rc.w * S), Math.round(rc.h * S)).data;
        let s = 0, s2 = 0, n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; s2 += v * v; }
        return { mean: s / n, std: Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)) };
      };
      const diff = (a, b) => { const x = a.getContext('2d').getImageData(0, 0, a.width, a.height).data, y = b.getContext('2d').getImageData(0, 0, b.width, b.height).data; let s = 0; for (let i = 0; i < x.length; i += 4) s += Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]); return s / (x.length / 4); };
      const out = { cards: [] };
      for (const id of ['m1', 'm2', 'm3', 'm4']) for (const d of M[id].privacy.cards) {
        const plain = A.card(M[id], d.id, 0, 256, 4), masked = A.card(M[id], d.id + '#masked', 0, 256, 4), base = A.card(M[id], d.key, 0, 256, 4);
        const row = { id: d.id, photo: plain.photo || '', maskedPhoto: masked.photo || '', diffBase: diff(plain, base), regions: [] };
        for (const rc of d.mask) {
          const inset = { x: rc.x + rc.w * 0.12, y: rc.y + rc.h * 0.12, w: rc.w * 0.76, h: rc.h * 0.76 }; // 둥근 모서리 밖은 빼고
          const a = region(plain, inset), b = region(masked, inset);
          row.regions.push({ look: rc.look, plainStd: a.std, maskedStd: b.std, maskedMean: b.mean });
        }
        // 가린 칸 밖은 같은 그림
        row.outside = region(masked, { x: 0, y: 0.92, w: 1, h: 0.08 }).mean - region(plain, { x: 0, y: 0.92, w: 1, h: 0.08 }).mean;
        out.cards.push(row);
      }
      // 4 임무 이름 줄은 답 칸(y 0.18 ~ 0.92) 밖 — 숫자 판단 단서와 섞이지 않게
      const n4 = M.m4.privacy.cards[0];
      out.m4NameAboveBox = n4.mask.every((rc) => rc.y + rc.h <= 0.18);
      out.m4AnswerSame = region(A.card(M.m4, n4.id, 0, 256), { x: 0.12, y: 0.2, w: 0.76, h: 0.7 }).mean - region(A.card(M.m4, n4.key, 0, 256), { x: 0.12, y: 0.2, w: 0.76, h: 0.7 }).mean;

      // 사람 눈 확인용 시트
      const sheet = document.createElement('div');
      sheet.style.cssText = 'position:fixed;inset:0;z-index:99;background:#111;display:flex;flex-wrap:wrap;gap:8px;padding:8px;overflow:hidden';
      const add = (c, label) => { const f = document.createElement('figure'); f.style.cssText = 'margin:0;color:#fff;font:12px sans-serif'; const k = document.createElement('canvas'); k.width = k.height = 200; k.getContext('2d').drawImage(c, 0, 0, 200, 200); f.append(k, Object.assign(document.createElement('figcaption'), { textContent: label })); sheet.append(f); };
      for (const id of ['m1', 'm2', 'm3', 'm4']) for (const d of M[id].privacy.cards) {
        add(A.card(M[id], d.id, 0, 256, 4), d.id);
        add(A.card(M[id], d.id + '#masked', 0, 256, 4), d.id + ' 가림');
      }
      add(A.thumb(A.card(M.m4, 'p_name_2', 0, 192), 24), 'm4 썸네일');
      add(A.thumb(A.card(M.m4, 'p_name_2#masked', 0, 192), 24), 'm4 썸네일 가림');
      add(A.thumb(A.card(M.m3, 'p_river_people', 0, 192), 24), 'm3 썸네일');
      document.body.append(sheet);
      return out;
    });
    await page.screenshot({ path: shotPath('privacy-art') });
    for (const c of r.cards) {
      if (c.id.startsWith('p_wallet') || c.id.startsWith('p_phone') || c.id.startsWith('p_person')) {
        assert.ok(c.photo, c.id + ' uses its photo');
        assert.ok(c.maskedPhoto === '' || c.maskedPhoto === c.photo, c.id);
      }
      assert.ok(c.diffBase > 3, c.id + ' differs from the plain card of its kind: ' + c.diffBase);
      for (const g of c.regions) {
        if (g.look === 'bar') assert.ok(g.maskedMean < 40 && g.maskedStd < 12, c.id + ' bar is dark and flat ' + JSON.stringify(g));
        else assert.ok(g.maskedStd < g.plainStd * 0.8, c.id + ' blur lowers detail ' + JSON.stringify(g));
      }
      assert.ok(Math.abs(c.outside) < 1, c.id + ' outside the mask unchanged');
    }
    assert.equal(r.m4NameAboveBox, true);
    assert.ok(Math.abs(r.m4AnswerSame) < 0.5, 'm4 answer box drawn like the plain neat card');
    assert.deepEqual(errors, []);
    console.log('privacy art OK', r.cards.length);
  } finally { await browser.close(); }
}

if (part === 'all' || part === 'art') await artPart();
