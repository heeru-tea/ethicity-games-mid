// Existing editing/capacity regression scenarios begin from an explicit planned town.
// The actual empty application start is exercised by empty-start-browser.mjs.
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),fixture=require('./planned-fixture.cjs');
export async function plannedTown(page){await page.evaluate(cfg=>{PB.App.s=PB.Session.create(cfg);PB.App._sceneKey=null;PB.Session.beginPlan(PB.App.s);PB.App.go('plan');},fixture);}
