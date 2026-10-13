// Drives the online screens against an in-memory fake of the Supabase REST/Auth API.
// (The real server logic + RLS is tested in SQL, see supabase/tests/security_test.sql.)
// Usage: node tests/online-mock.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:8080/';
const OUT = process.argv[3] || 'design/screens';
mkdirSync(OUT, { recursive: true });
const SB = 'https://dcmyphywgcoewqcnxscp.supabase.co';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const ME = '11111111-1111-4111-8111-111111111111';
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ME, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, is_anonymous: true })}.sig`;
const user = { id: ME, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };

const db = {
  room: null,
  players: [],
  secret: null,
};
const others = [
  { user_id: '22222222-2222-4222-8222-222222222222', name: 'سارة', avatar: 'paw', seat: 1 },
  { user_id: '33333333-3333-4333-8333-333333333333', name: 'يوسف', avatar: 'ball', seat: 2 },
  { user_id: '44444444-4444-4444-8444-444444444444', name: 'ليلى', avatar: 'plane', seat: 3 },
];

function handle(path, method, body, accept) {
  if (path.startsWith('/auth/v1/signup') || path.startsWith('/auth/v1/token')) {
    return { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user };
  }
  if (path.startsWith('/auth/v1/user')) return user;
  if (path === '/rest/v1/rpc/spy_get_content') return null;
  if (path === '/rest/v1/rpc/spy_create_room') {
    db.room = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', code: 'KRMZ', host: ME, status: 'lobby', pack_id: body.p_pack, pack_name: 'الحياة اليومية', mode: 'places', minutes: body.p_minutes, round: 0, votes_count: 0 };
    db.players = [{ user_id: ME, name: body.p_name, avatar: body.p_avatar, seat: 0 }, ...others];
    return { id: db.room.id, code: db.room.code };
  }
  if (path === '/rest/v1/rpc/spy_start_round') {
    Object.assign(db.room, {
      status: 'playing',
      round: db.room.round + 1,
      ends_at: new Date(Date.now() + 5 * 60000).toISOString(),
      first_asker: others[0].user_id,
      options: ['مخبزة', 'بنك', 'حلّاق', 'صيدلية', 'سوق الخضار', 'جزّار', 'خيّاط', 'مكتب البريد'],
      locations: [],
      result: null,
    });
    db.secret = { round: db.room.round, kind: 'spy', place: null, role: null, word: null };
    return null;
  }
  if (path === '/rest/v1/rpc/spy_call_vote') {
    db.room.status = 'voting';
    return null;
  }
  if (path === '/rest/v1/rpc/spy_cast_vote') {
    db.room.votes_count = 3;
    db.room.status = 'guess';
    db.room.accused = ME;
    return null;
  }
  if (path === '/rest/v1/rpc/spy_submit_guess') {
    db.room.status = 'result';
    db.room.result = { outcome: body.p_guess === 'مخبزة' ? 'guessed' : 'caught', item: 'مخبزة', spies: [{ id: ME, name: 'أمين' }], accused: ME, guess: body.p_guess, points: { [ME]: 2 } };
    return null;
  }
  if (path === '/rest/v1/rpc/spy_leave_room') return null;
  const single = accept.includes('vnd.pgrst.object');
  if (path.startsWith('/rest/v1/spy_rooms')) return single ? db.room : [db.room];
  if (path.startsWith('/rest/v1/spy_room_players')) return db.players;
  if (path.startsWith('/rest/v1/spy_room_secrets')) return single ? db.secret : [db.secret];
  if (path.startsWith('/rest/v1/spy_user_stats')) return single ? { games_played: 7, times_spy: 2, spy_wins: 1, innocent_wins: 3 } : [];
  if (path.startsWith('/rest/v1/spy_custom_packs')) return [];
  if (path.startsWith('/rest/v1/spy_profiles')) return null;
  return null;
}

const problems = [];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !/realtime|websocket|WebSocket/i.test(m.text())) errors.push(m.text());
});
await context.route(`${SB}/**`, async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  let body = {};
  try {
    body = req.postDataJSON() || {};
  } catch {
    body = {};
  }
  const data = handle(url.pathname, req.method(), body, req.headers()['accept'] || '');
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(data) });
});

const shot = async (name) => {
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  if (overflow) problems.push(`${name}: horizontal overflow`);
  await page.screenshot({ path: `${OUT}/390x844-online-${name}.png` });
};

await page.goto(BASE);
await page.waitForSelector('.home-title');
await page.click('[data-to="online"]');
await page.waitForSelector('#ol-code');
await shot('01-entry');
await page.click('[data-to="online-create"]');
await page.waitForSelector('#ol-create-form');
await page.fill('#ol-name', 'أمين');
await shot('02-create');
await page.click('button[form="ol-create-form"]');
await page.waitForSelector('[data-screen="ol-lobby"]');
await page.waitForTimeout(600);
await shot('03-lobby');
await page.click('[data-action="ol-start"]');
await page.waitForSelector('[data-screen="ol-playing"]');
const card = await page.locator('#ol-card').boundingBox();
await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
await page.mouse.down();
await page.waitForTimeout(300);
await shot('04-playing-card');
const visible = await page.locator('#ol-secret .stamp').count();
await page.mouse.up();
if (!visible) problems.push('online card did not reveal');
if ((await page.locator('#ol-secret').innerHTML()).trim()) problems.push('online secret stays in DOM');
await page.click('[data-action="ol-call-vote"]');
await page.waitForSelector('[data-screen="ol-vote"]');
await shot('05-vote');
await page.click('[data-action="ol-vote"] >> nth=0');
await page.waitForSelector('[data-screen="ol-guess"]');
await page.click('[data-action="ol-guess-pick"] >> nth=0');
await shot('06-guess');
await page.click('[data-action="ol-guess"]');
await page.waitForSelector('[data-screen="ol-result"]');
await shot('07-result');
// reload mid-room: the app must come back into the room
await page.goto(BASE);
await page.waitForSelector('[data-screen="ol-result"]');
if (await page.locator('[data-screen="ol-result"]').count()) {
  // resumed into the room after reload — expected
  await page.click('[data-action="ol-leave"]');
  await page.click('.modal [data-modal="1"]');
  await page.waitForSelector('#ol-code');
}
await page.click('[data-to="online-profile"]');
await page.waitForSelector('.avatars');
await page.waitForTimeout(800);
await shot('08-profile');
await page.click('[data-action="ol-new-pack"]');
await page.waitForSelector('#pk-items');
await page.fill('#pk-name', 'حيّنا');
await page.fill('#pk-items', 'مقهى الحيّ: القهواجي، زبون دائم\nملعب الحيّ: الحارس، الحكم');
await page.click('button[form="ol-pack-form"]');
await page.waitForTimeout(300);
await shot('09-pack-editor-error');

await context.setOffline(true);
await page.goto(BASE).catch(() => {});
await browser.close();
if (errors.length) problems.push('console: ' + errors.join(' | '));
if (problems.length) {
  console.log('PROBLEMS:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('✓ online screens OK (mocked backend)');
