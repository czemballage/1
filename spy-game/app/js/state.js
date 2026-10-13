// App store: a single state object, persisted to localStorage after every change.
// Storage can throw (Safari private mode, quota, disabled cookies) → in-memory fallback.

const KEY = 'mj:v1';
const memory = new Map();
let storageOk = true;

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      storageOk = false;
      return memory.has(key) ? memory.get(key) : fallback;
    }
  },
  set(key, value) {
    memory.set(key, value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      storageOk = false;
    }
  },
  remove(key) {
    memory.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      storageOk = false;
    }
  },
  get ok() {
    return storageOk;
  },
};

export const DEFAULT_SETTINGS = {
  mode: 'places',
  spies: 'auto',
  minutes: 6,
  imposter: false,
  dares: true,
};

export const DEFAULT_PREFS = {
  sound: true,
  haptics: true,
  reducedMotion: 'auto', // auto | on
};

function initialState() {
  return {
    screen: 'home',
    players: [],
    packId: null,
    settings: { ...DEFAULT_SETTINGS },
    prefs: { ...DEFAULT_PREFS },
    session: { scores: {}, rounds: 0, lastSpies: [] },
    round: null,
    lastItem: {},
    online: null,
  };
}

function load() {
  const saved = storage.get(KEY, null);
  const base = initialState();
  if (!saved || typeof saved !== 'object') return base;
  return {
    ...base,
    ...saved,
    settings: { ...base.settings, ...(saved.settings || {}) },
    prefs: { ...base.prefs, ...(saved.prefs || {}) },
    session: { ...base.session, ...(saved.session || {}) },
  };
}

let state = load();
const listeners = new Set();

export function getState() {
  return state;
}

/** Shallow-merge a patch (or the result of fn(state)) and persist. */
export function setState(patch) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  storage.set(KEY, state);
  for (const fn of listeners) fn(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetAll() {
  const prefs = state.prefs;
  state = { ...initialState(), prefs };
  storage.set(KEY, state);
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('mj:bag:'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  for (const fn of listeners) fn(state);
}

// Shuffle bags live in their own keys so they survive "new session".
export const bags = {
  get: (packId) => storage.get('mj:bag:' + packId, []),
  set: (packId, bag) => storage.set('mj:bag:' + packId, bag),
};
