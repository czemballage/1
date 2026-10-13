// Supabase access. The SDK (assets/vendor/supabase.js) is loaded lazily, only when an
// online feature is used, so offline play never downloads it.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

let client = null;
let loading = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('sdk_load_failed'));
    document.head.appendChild(s);
  });
}

export async function getClient() {
  if (client) return client;
  if (!loading) {
    loading = loadScript('assets/vendor/supabase.js').then(() => {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'mj-auth' },
        realtime: { params: { eventsPerSecond: 10 } },
      });
      return client;
    });
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

/** Guest-first: reuse the session or create an anonymous one.
 *  If the project has anonymous sign-ins turned off, this throws code 'need_login'
 *  and the UI asks for an email sign-in instead. */
export async function ensureSession() {
  const c = await getClient();
  const { data } = await c.auth.getSession();
  if (data.session) return data.session;
  const res = await c.auth.signInAnonymously();
  if (res.error) {
    const err = toError(res.error);
    if (err.code === 'anon_disabled') err.code = 'need_login';
    throw err;
  }
  return res.data.session;
}

export async function getSession() {
  const c = await getClient();
  const { data } = await c.auth.getSession();
  return data.session || null;
}

/** Where the sign-in link in the email brings the player back to. */
export function redirectUrl() {
  return location.origin + location.pathname;
}

/** True when the page was opened from a sign-in email link. */
export function isAuthRedirect() {
  return /access_token=|error_description=|[?&]code=|type=(magiclink|signup|email_change|recovery)/.test(location.hash + location.search);
}

export async function currentUser() {
  const c = await getClient();
  const { data } = await c.auth.getSession();
  return data.session?.user || null;
}

export async function rpc(name, args = {}) {
  const c = await getClient();
  const { data, error } = await c.rpc(name, args);
  if (error) throw toError(error);
  return data;
}

/** Email one-time code. Anonymous users are upgraded in place (their stats stay). */
export async function sendEmailCode(email) {
  const c = await getClient();
  const user = await currentUser();
  if (user?.is_anonymous) {
    const { error } = await c.auth.updateUser({ email }, { emailRedirectTo: redirectUrl() });
    if (error) throw toError(error);
    return 'email_change';
  }
  const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: redirectUrl() } });
  if (error) throw toError(error);
  return 'email';
}

export async function verifyEmailCode(email, token, type) {
  const c = await getClient();
  const { error } = await c.auth.verifyOtp({ email, token, type });
  if (error) throw toError(error);
}

export async function signOut() {
  const c = await getClient();
  await c.auth.signOut();
}

// Map server / auth errors to stable codes for the UI.
const KNOWN = [
  'not_authenticated', 'bad_name', 'bad_minutes', 'rate_limited', 'pack_not_found', 'room_not_found', 'name_taken',
  'game_started', 'room_full', 'not_host', 'bad_state', 'room_expired', 'not_enough_players', 'too_many_players',
  'pack_too_small', 'not_member', 'not_voting', 'self_vote', 'bad_target', 'not_guessing', 'not_accused',
];

export function toError(e) {
  const msg = String(e?.message || e || '');
  const code =
    KNOWN.find((k) => msg.includes(k)) ||
    (/anonymous/i.test(msg)
      ? 'anon_disabled'
      : /rate limit|too many|seconds/i.test(msg)
        ? 'email_rate'
        : /expired|invalid.*(token|otp)|otp.*(expired|invalid)/i.test(msg)
          ? 'bad_code'
          : /fetch|network|Failed to/i.test(msg)
            ? 'network'
            : 'unknown');
  const err = new Error(msg);
  err.code = code;
  return err;
}

export const ERROR_TEXT = {
  not_authenticated: 'يجب الاتصال أولاً.',
  bad_name: 'الاسم يجب أن يكون من 1 إلى 16 حرفاً.',
  rate_limited: 'أنشأت غرفاً كثيرة. انتظر قليلاً ثم حاول.',
  pack_not_found: 'هذا الملف غير متاح أونلاين.',
  room_not_found: 'ما لقينا غرفة بهذا الرمز.',
  name_taken: 'هذا الاسم مستخدم في الغرفة.',
  game_started: 'الجولة بدأت. انتظر نهايتها ثم ادخل.',
  room_full: 'الغرفة ممتلئة (12 لاعباً).',
  not_host: 'فقط المضيف يقدر يعمل هذا.',
  not_enough_players: 'تحتاجون 3 لاعبين على الأقل.',
  room_expired: 'انتهت صلاحية الغرفة.',
  self_vote: 'ما تقدر تتّهم نفسك!',
  anon_disabled: 'سجّل دخولك بالبريد الإلكتروني أولاً.',
  need_login: 'سجّل دخولك بالبريد الإلكتروني أولاً حتى تلعب أونلاين.',
  email_rate: 'طلبت رسائل كثيرة. انتظر دقيقة ثم حاول.',
  bad_code: 'الرمز غير صحيح أو انتهت صلاحيته. اطلب رسالة جديدة.',
  network: 'تعذّر الاتصال. تحقّق من الإنترنت.',
  unknown: 'حدث خطأ. حاول مرة أخرى.',
};

export const errorText = (e) => ERROR_TEXT[e?.code] || ERROR_TEXT.unknown;
