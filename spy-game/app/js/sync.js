// Content updates and cloud sync. Everything here is best-effort: failures never block play.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { storage, getState } from './state.js';

/**
 * Ask the server for packs newer than `version`. Uses plain fetch (no SDK) so it's cheap.
 * Newer content is cached in localStorage and applied immediately.
 */
export async function refreshContent(version, ctx) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/spy_get_content`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_since: version }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  if (!data || !Array.isArray(data.packs) || !data.packs.length || data.version <= version) return false;
  // sanity check before trusting remote content
  const valid = data.packs.every((p) => p.id && p.name_ar && Array.isArray(p.items) && p.items.length >= 3);
  if (!valid) return false;
  storage.set('mj:content', data);
  ctx.setPacks(data);
  if (['home', 'packs', 'prefs'].includes(getState().screen)) ctx.render();
  return true;
}

// ------------------------------------------------------------------ user data (signed-in)

let pushTimer = null;

/** Debounced upload of player list + game settings for the signed-in user. */
export function schedulePush(client, userId) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    const s = getState();
    try {
      await client.from('spy_user_data').upsert({
        user_id: userId,
        players: s.players.slice(0, 12),
        settings: s.settings,
        updated_at: new Date().toISOString(),
      });
    } catch {
      /* offline: next change retries */
    }
  }, 1500);
}

export async function pullUserData(client, userId) {
  const { data } = await client.from('spy_user_data').select('players, settings').eq('user_id', userId).maybeSingle();
  return data;
}

export async function fetchStats(client, userId) {
  const { data } = await client.from('spy_user_stats').select('games_played, times_spy, spy_wins, innocent_wins').eq('user_id', userId).maybeSingle();
  return data || { games_played: 0, times_spy: 0, spy_wins: 0, innocent_wins: 0 };
}

export async function saveProfile(client, userId, profile) {
  await client.from('spy_profiles').upsert({ id: userId, display_name: profile.name, avatar: profile.avatar, updated_at: new Date().toISOString() });
}

// ------------------------------------------------------------------ custom packs

export async function listCustomPacks(client) {
  const { data, error } = await client.from('spy_custom_packs').select('id, name_ar, mode, items, updated_at').order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveCustomPack(client, pack) {
  const row = { name_ar: pack.name_ar, mode: pack.mode, items: pack.items, updated_at: new Date().toISOString() };
  const q = pack.id ? client.from('spy_custom_packs').update(row).eq('id', pack.id).select().single() : client.from('spy_custom_packs').insert(row).select().single();
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function deleteCustomPack(client, id) {
  const { error } = await client.from('spy_custom_packs').delete().eq('id', id);
  if (error) throw error;
}

/** Custom packs are mirrored locally so they also work offline in pass-and-play. */
export function cacheCustomPacks(rows, ctx) {
  const packs = rows.map((r) => ({ id: r.id, name_ar: r.name_ar, icon: 'edit', mode: r.mode, items: r.items }));
  storage.set('mj:custom-packs', packs);
  ctx.setPacks();
}
