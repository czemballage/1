// Sign-in flow when the Supabase project has anonymous sign-ins DISABLED (the real config today).
// Expect: tapping "create room" sends the player to "حسابي"; the email form sends a link without
// needing a guest session; returning from the email link signs the player in.
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:8080/';
const OUT = process.argv[3] || 'design/screens';
const SB = 'https://dcmyphywgcoewqcnxscp.supabase.co';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const ME = '55555555-5555-4555-8555-555555555555';
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ME, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, email: 'amine@example.com' })}.sig`;
const user = { id: ME, aud: 'authenticated', role: 'authenticated', email: 'amine@example.com', is_anonymous: false, app_metadata: { provider: 'email' }, user_metadata: {} };
const calls = [];
const problems = [];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await context.route(`${SB}/**`, async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  calls.push(`${req.method()} ${url.pathname}`);
  if (url.pathname === '/auth/v1/signup') return route.fulfill({ status: 422, headers: cors, contentType: 'application/json', body: JSON.stringify({ code: 422, error_code: 'anonymous_provider_disabled', msg: 'Anonymous sign-ins are disabled' }) });
  if (url.pathname === '/auth/v1/otp') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{}' });
  if (url.pathname === '/auth/v1/user') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(user) });
  if (url.pathname.startsWith('/rest/v1/spy_user_stats')) return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ games_played: 4, times_spy: 1, spy_wins: 1, innocent_wins: 2 }) });
  return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: url.pathname.includes('/rpc/') ? 'null' : '[]' });
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(BASE);
await page.waitForSelector('.home-title');
// account button is on the home screen
if (!(await page.locator('[data-to="online-profile"]').count())) problems.push('no account button on home');
await page.click('[data-to="online"]');
await page.click('[data-to="online-create"]');
await page.fill('#ol-name', 'أمين');
await page.click('button[form="ol-create-form"]');
await page.waitForSelector('#ol-email', { timeout: 8000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/390x844-account-01-login.png` });
await page.fill('#ol-email', 'amine@example.com');
await page.click('form[data-form="ol-otp-send"] button[type="submit"]');
await page.waitForSelector('#ol-otp');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/390x844-account-02-sent.png` });
if (!calls.includes('POST /auth/v1/otp')) problems.push('email was not sent');

// simulate coming back from the email link
await page.goto('about:blank');
await page.goto(`${BASE}#access_token=${jwt}&expires_in=3600&refresh_token=r&token_type=bearer&type=magiclink`);
await page.waitForSelector('.account-card .badge', { timeout: 8000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/390x844-account-03-signed-in.png` });
if (page.url().includes('access_token')) problems.push('token left in the URL');
await browser.close();
if (errors.length) problems.push('errors: ' + errors.join(' | '));
if (problems.length) {
  console.log('PROBLEMS:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('✓ sign-in works with anonymous sign-ins disabled');
