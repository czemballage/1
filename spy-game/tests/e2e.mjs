// End-to-end smoke + screenshot run with Playwright (Chromium).
// Usage: node tests/e2e.mjs [baseUrl] [outDir]
// Plays full pass-and-play rounds at several viewports, checks for layout overflow,
// console errors, back-button handling, reload-resume and offline mode.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:8080/';
const OUT = process.argv[3] || 'design/screens';
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  [320, 568],
  [360, 800],
  [390, 844],
  [430, 932],
  [768, 1024],
];
const LONG = 'عبد الرحمن الكبير'; // 16 chars
const NAMES12 = ['أمين', 'سارة', 'يوسف', 'فاطمة', 'كريم', 'ليلى', 'عمر', 'نور', 'حمزة', 'مريم', 'خالد', LONG.slice(0, 16)];

const problems = [];
const log = (...a) => console.log(...a);

async function overflowCheck(page, label) {
  const issues = await page.evaluate(() => {
    const out = [];
    const W = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > W + 1) out.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${W}`);
    for (const el of document.querySelectorAll('#app *')) {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // ignore intentionally rotated decorations
      if (el.closest('.stamp, .clip, .home-stamp, .pass__envelope, .result__stamp')) continue;
      if (r.right > W + 2 || r.left < -2) out.push(`${el.tagName}.${el.className} x:${Math.round(r.left)}-${Math.round(r.right)}`);
      // clipped text: element with overflow hidden whose content is taller than its box (ellipsis is fine horizontally)
      if ((el.tagName === 'P' || el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'SPAN') && cs.overflow === 'hidden' && el.scrollHeight > el.clientHeight + 2 && cs.whiteSpace !== 'nowrap') {
        out.push(`clipped text ${el.className}: ${el.textContent.slice(0, 20)}`);
      }
    }
    // small touch targets
    for (const el of document.querySelectorAll('#app button, #app [role=button], #app input')) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.height < 44 || r.width < 44) && !el.classList.contains('switch')) out.push(`small target ${el.className || el.tagName} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return out.slice(0, 8);
  });
  if (issues.length) problems.push(`[${label}] ${issues.join(' | ')}`);
}

async function shot(page, name, vp) {
  await page.waitForTimeout(450);
  await overflowCheck(page, `${name}@${vp}`);
  await page.screenshot({ path: `${OUT}/${vp}-${name}.png` });
}

async function hold(page, ms = 400) {
  const card = page.locator('#reveal-card');
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  return async () => page.mouse.up();
}

async function run(vw, vh, { names, shots = true }) {
  const vp = `${vw}x${vh}`;
  const ctx = await chromium.newContext?.() ;
  void ctx;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, hasTouch: true, isMobile: vw < 700, locale: 'ar' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(BASE);
  await page.waitForSelector('.home-title');
  if (shots) await shot(page, '01-home', vp);

  await page.click('[data-action="start"]');
  await page.waitForSelector('#pname');
  if (shots) await shot(page, '02-players-empty', vp);
  for (const n of names) {
    await page.fill('#pname', n);
    await page.press('#pname', 'Enter');
  }
  // duplicate name error
  if (names.length < 12) {
    await page.fill('#pname', names[0].replace('أ', 'ا'));
    await page.press('#pname', 'Enter');
    if (shots) await shot(page, '03-players-duplicate', vp);
    await page.fill('#pname', '');
  } else if (shots) await shot(page, '03-players-full', vp);
  await page.click('[data-to="packs"]');
  await page.waitForSelector('.pack');
  await page.click('.pack >> nth=3');
  if (shots) await shot(page, '04-packs', vp);
  await page.click('[data-to="setup"]');
  await page.waitForSelector('[data-action="deal"]');
  if (shots) await shot(page, '05-setup', vp);
  await page.click('[data-action="deal"]');

  // reveal everyone
  for (let i = 0; i < names.length; i++) {
    await page.waitForSelector('[data-screen="pass"]');
    if (shots && i === 0) await shot(page, '06-pass', vp);
    await page.click('[data-action="reveal-next"]');
    await page.waitForSelector('#reveal-card');
    if (shots && i === 0) await shot(page, '07-card-hidden', vp);
    // the done button must be disabled before holding
    const disabled = await page.locator('#card-done').isDisabled();
    if (!disabled) problems.push(`[${vp}] done button enabled before reveal`);
    const release = await hold(page);
    const isSpy = await page.locator('#secret .stamp').count();
    if (shots && (i === 0 || (isSpy && !page._spyShot))) {
      await shot(page, isSpy ? '08-card-spy' : '08-card-innocent', vp);
      if (isSpy) page._spyShot = true;
    }
    await release();
    const leaked = await page.locator('#secret').innerHTML();
    if (leaked.trim()) problems.push(`[${vp}] secret still in DOM after release`);
    await page.click('#card-done');
  }
  await page.waitForSelector('#timer');
  if (shots) await shot(page, '09-discussion', vp);

  // reload mid-round → resume discussion
  await page.reload();
  await page.waitForSelector('#timer');

  // back button mid-round → confirm modal, cancel keeps the game
  await page.goBack();
  await page.waitForSelector('.modal');
  if (shots) await shot(page, '10-confirm-end', vp);
  await page.click('.modal [data-modal="0"]');
  await page.waitForSelector('#timer');

  await page.click('[data-action="show-locations"]');
  await page.waitForSelector('.modal .list');
  if (shots) await shot(page, '11-locations', vp);
  await page.click('.modal [data-modal="0"]');

  await page.click('[data-action="vote-now"]');
  await page.click('.modal [data-modal="1"]');
  await page.waitForSelector('[data-screen="vote"]');
  // accuse the spy: find from storage
  const spies = await page.evaluate(() => JSON.parse(localStorage.getItem('mj:v1')).round.spies);
  await page.click(`[data-action="accuse-pick"][data-i="${spies[0]}"]`);
  if (shots) await shot(page, '12-accuse', vp);
  await page.click('[data-action="accuse-confirm"]');
  await page.waitForSelector('[data-screen="guess"]');
  await page.click('[data-action="guess-pick"] >> nth=0');
  if (shots) await shot(page, '13-spy-guess', vp);
  await page.click('[data-action="guess-confirm"]');
  await page.waitForSelector('[data-screen="result"]');
  if (shots) await shot(page, '14-result', vp);

  await page.click('[data-to="scoreboard"]');
  await page.waitForSelector('.board');
  if (shots) await shot(page, '15-scoreboard', vp);
  await page.click('[data-to="share"]');
  await page.waitForSelector('#share-canvas');
  await page.waitForTimeout(800);
  if (shots) await shot(page, '16-share', vp);
  await page.goBack();
  await page.waitForSelector('.board');
  await page.goBack();
  await page.waitForSelector('[data-screen="result"]');
  if (await page.locator('[data-to="dares"]').count()) {
    await page.click('[data-to="dares"]');
    await page.waitForSelector('.dare');
    if (shots) await shot(page, '17-dares', vp);
    await page.click('[data-action="dare-done"]');
  }
  // second round: escaped path
  await page.click('[data-action="again"]');
  for (let i = 0; i < names.length; i++) {
    await page.click('[data-action="reveal-next"]');
    const release = await hold(page, 120);
    await release();
    await page.click('#card-done');
  }
  await page.click('[data-action="vote-now"]');
  await page.click('.modal [data-modal="1"]');
  const r2 = await page.evaluate(() => JSON.parse(localStorage.getItem('mj:v1')).round);
  const innocent = r2.cards.findIndex((_, i) => !r2.spies.includes(i));
  await page.click(`[data-action="accuse-pick"][data-i="${innocent}"]`);
  await page.click('[data-action="accuse-confirm"]');
  await page.waitForSelector('[data-screen="result"]');
  if (shots) await shot(page, '18-result-escaped', vp);

  // settings
  await page.goBack(); // result → home
  await page.waitForSelector('.home-title');
  await page.click('[data-to="prefs"]');
  await page.waitForSelector('.switch');
  if (shots) await shot(page, '19-settings', vp);

  await browser.close();
  if (errors.length) problems.push(`[${vp}] console: ${errors.join(' | ')}`);
  log(`✓ ${vp} (${names.length} players)`);
}

async function offlineRun() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForSelector('.home-title');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForSelector('.home-title');
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('.home-title', { timeout: 8000 });
  const offlineBadge = await page.locator('.net').first().isVisible();
  await page.screenshot({ path: `${OUT}/390x844-20-offline-home.png` });
  await page.click('[data-action="start"]');
  for (const n of ['أ', 'ب', 'ج']) {
    await page.fill('#pname', n);
    await page.press('#pname', 'Enter');
  }
  await page.click('[data-to="packs"]');
  await page.click('.pack >> nth=0');
  await page.click('[data-to="setup"]');
  await page.click('[data-action="deal"]');
  await page.waitForSelector('[data-screen="pass"]');
  const fontsOk = await page.evaluate(() => document.fonts.check('700 20px "Reem Kufi"', 'مين'));
  await browser.close();
  if (!offlineBadge) problems.push('[offline] badge not visible');
  if (!fontsOk) problems.push('[offline] heading font not loaded');
  if (errors.length) problems.push('[offline] ' + errors.join(' | '));
  log('✓ offline: playable after reload with network off');
}

async function reducedMotionRun() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(BASE);
  await page.waitForSelector('.home-title');
  const dur = await page.evaluate(() => getComputedStyle(document.querySelector('.screen')).animationDuration);
  if (dur !== '0.001s') problems.push(`[reduced-motion] animation-duration ${dur}`);
  await browser.close();
  log('✓ reduced motion');
}

async function landscapeRun() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto(BASE);
  await page.waitForSelector('.home-title');
  await overflowCheck(page, 'landscape-home');
  await page.screenshot({ path: `${OUT}/844x390-landscape-home.png` });
  await browser.close();
  log('✓ landscape');
}

const only = process.env.ONLY;
for (const [w, h] of VIEWPORTS) {
  if (only && only !== `${w}x${h}`) continue;
  await run(w, h, { names: w === 390 ? NAMES12 : w === 320 ? ['أمين', 'سارة', LONG] : NAMES12.slice(0, 5) });
}
if (!only) {
  await run(390, 844, { names: ['أمين', 'سارة', 'يوسف'], shots: false });
  await offlineRun();
  await reducedMotionRun();
  await landscapeRun();
}

if (problems.length) {
  console.log('\nPROBLEMS:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('\nAll e2e checks passed.');
