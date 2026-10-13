// Pure game logic: no DOM, no storage. Everything here is unit-tested in tests/game.test.mjs.

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const MAX_NAME = 16;
export const GUESS_OPTIONS = 16;
export const TIMER_CHOICES = [3, 5, 6, 8, 10];

/** Phases of a round and the only transitions allowed between them. */
export const PHASES = ['reveal', 'discussion', 'vote', 'spyGuess', 'result'];
export const TRANSITIONS = {
  reveal: ['discussion'],
  discussion: ['vote'],
  vote: ['spyGuess', 'result'],
  spyGuess: ['result'],
  result: [],
};

export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

// ---------------------------------------------------------------- names

export function normalizeName(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function cleanName(s) {
  return String(s ?? '').replace(/[\u0000-\u001F<>]/g, '').replace(/\s+/g, ' ').trim();
}

/** Returns null if ok, or an error key: empty | long | duplicate | full */
export function validateName(name, existing = []) {
  const n = cleanName(name);
  if (!n) return 'empty';
  if ([...n].length > MAX_NAME) return 'long';
  if (existing.length >= MAX_PLAYERS) return 'full';
  const key = normalizeName(n);
  if (existing.some((e) => normalizeName(e) === key)) return 'duplicate';
  return null;
}

// ---------------------------------------------------------------- spies

export function suggestSpies(n) {
  return n >= 8 ? 2 : 1;
}

export function maxSpies(n) {
  return Math.max(1, Math.floor((n - 1) / 2));
}

export function resolveSpyCount(setting, n) {
  const s = setting === 'auto' || setting == null ? suggestSpies(n) : Number(setting);
  return Math.min(Math.max(1, s), maxSpies(n));
}

// ---------------------------------------------------------------- randomness

/** Small seedable PRNG (mulberry32) so tests are deterministic. */
export function makeRng(seed = Date.now() ^ (Math.random() * 1e9)) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function cryptoRng() {
  if (globalThis.crypto?.getRandomValues) {
    const buf = new Uint32Array(1);
    return () => {
      globalThis.crypto.getRandomValues(buf);
      return buf[0] / 4294967296;
    };
  }
  return Math.random;
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------- shuffle bag

/**
 * Draw the next item id from a persisted bag. The bag is an array of ids still to play.
 * When empty, it is refilled with every id reshuffled, never starting with `last`.
 * Ids no longer in the pack are dropped; new ids are added on refill.
 */
export function drawFromBag(bag, allIds, last, rng = Math.random) {
  let b = (bag || []).filter((id) => allIds.includes(id));
  if (!b.length) {
    b = shuffle(allIds, rng);
    if (b.length > 1 && b[b.length - 1] === last) [b[0], b[b.length - 1]] = [b[b.length - 1], b[0]];
  }
  const id = b.pop();
  return { id, bag: b };
}

// ---------------------------------------------------------------- rounds

/**
 * Build a new round.
 * @param {string[]} players names in seat order
 * @param {object} pack { id, name_ar, mode, items }
 * @param {object} settings { mode, spies, minutes, imposter }
 * @param {object} opts { itemId, rng }
 */
export function createRound(players, pack, settings, { itemId, rng = Math.random } = {}) {
  const n = players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error('bad player count');
  const mode = pack.mode === 'words' ? 'words' : settings.mode === 'words' ? 'words' : 'places';
  const item = pack.items.find((i) => i.id === itemId) || pack.items[Math.floor(rng() * pack.items.length)];
  const spyCount = resolveSpyCount(settings.spies, n);
  const spies = shuffle([...Array(n).keys()], rng).slice(0, spyCount).sort((a, b) => a - b);
  const imposter = mode === 'words' && !!settings.imposter;
  let closeWord = null;
  if (imposter) {
    closeWord = item.close_ar || null;
    if (!closeWord) {
      const others = pack.items.filter((i) => i.id !== item.id);
      closeWord = others[Math.floor(rng() * others.length)].name_ar;
    }
  }

  const roles = mode === 'places' ? shuffle(item.roles_ar || [], rng) : [];
  let r = 0;
  const cards = players.map((name, i) => {
    const isSpy = spies.includes(i);
    if (isSpy) return imposter ? { name, isSpy, kind: 'word', word: closeWord } : { name, isSpy, kind: 'spy' };
    if (mode === 'places') return { name, isSpy, kind: 'place', place: item.name_ar, role: roles.length ? roles[r++ % roles.length] : null };
    return { name, isSpy, kind: 'word', word: item.name_ar };
  });

  const start = Math.floor(rng() * n);
  const order = [...Array(n).keys()].map((k) => (start + k) % n);
  const innocents = [...Array(n).keys()].filter((i) => !spies.includes(i));
  const firstAsker = innocents[Math.floor(rng() * innocents.length)];

  const others = shuffle(pack.items.filter((i) => i.id !== item.id).map((i) => i.name_ar), rng).slice(0, GUESS_OPTIONS - 1);
  const options = shuffle([item.name_ar, ...others], rng);

  return {
    id: Math.floor(rng() * 1e9).toString(36),
    phase: 'reveal',
    mode,
    imposter,
    packId: pack.id,
    packName: pack.name_ar,
    item: { id: item.id, name: item.name_ar },
    closeWord,
    cards,
    spies,
    order,
    revealPos: 0,
    revealStep: 'pass',
    seen: false,
    firstAsker,
    minutes: settings.minutes || 6,
    endsAt: null,
    remainingMs: null,
    accused: null,
    guess: null,
    outcome: null,
    points: null,
    applied: false,
    locations: pack.items.map((i) => i.name_ar),
    options,
  };
}

export function transition(round, to, patch = {}) {
  if (!canTransition(round.phase, to)) throw new Error(`illegal transition ${round.phase} → ${to}`);
  return { ...round, ...patch, phase: to };
}

/** Reveal sub-steps: pass → card → (next player) pass … → discussion */
export function revealNext(round) {
  if (round.phase !== 'reveal') throw new Error('not revealing');
  if (round.revealStep === 'pass') return { ...round, revealStep: 'card', seen: false };
  if (!round.seen) return round; // must hold the card at least once
  if (round.revealPos + 1 < round.order.length) return { ...round, revealPos: round.revealPos + 1, revealStep: 'pass', seen: false };
  return startDiscussion(round);
}

export function startDiscussion(round, now = Date.now()) {
  return transition(round, 'discussion', { endsAt: now + round.minutes * 60000, remainingMs: null });
}

export function remainingMs(round, now = Date.now()) {
  if (round.remainingMs != null) return round.remainingMs;
  if (!round.endsAt) return round.minutes * 60000;
  return Math.max(0, round.endsAt - now);
}

export function pauseTimer(round, now = Date.now()) {
  if (round.remainingMs != null) return round;
  return { ...round, remainingMs: remainingMs(round, now), endsAt: null };
}

export function resumeTimer(round, now = Date.now()) {
  if (round.remainingMs == null) return round;
  return { ...round, endsAt: now + round.remainingMs, remainingMs: null };
}

export function accuse(round, index) {
  if (round.phase === 'discussion') round = transition(round, 'vote');
  if (round.phase !== 'vote') throw new Error('not voting');
  const caught = round.spies.includes(index);
  if (caught) return transition(round, 'spyGuess', { accused: index });
  return finish(transition(round, 'result', { accused: index }), 'escaped');
}

export function spyGuess(round, guessName) {
  if (round.phase !== 'spyGuess') throw new Error('not guessing');
  const correct = guessName === round.item.name;
  return finish(transition(round, 'result', { guess: guessName }), correct ? 'guessed' : 'caught');
}

/**
 * Scoring:
 *  escaped  (innocent accused)       → each spy +2
 *  guessed  (spy caught, right guess) → each spy +2
 *  caught   (spy caught, wrong guess) → each innocent +1
 */
export function scoreRound(round, outcome) {
  const points = {};
  round.cards.forEach((c, i) => {
    const spy = round.spies.includes(i);
    let p = 0;
    if ((outcome === 'escaped' || outcome === 'guessed') && spy) p = 2;
    if (outcome === 'caught' && !spy) p = 1;
    points[c.name] = p;
  });
  return points;
}

function finish(round, outcome) {
  return { ...round, outcome, points: scoreRound(round, outcome) };
}

export function applyScores(scores, round) {
  if (round.applied || !round.points) return scores;
  const next = { ...scores };
  for (const [name, p] of Object.entries(round.points)) next[name] = (next[name] || 0) + p;
  return next;
}

/** Ranked list with shared ranks for ties. */
export function ranking(scores, players = Object.keys(scores)) {
  const rows = players.map((name) => ({ name, points: scores[name] || 0 })).sort((a, b) => b.points - a.points);
  let rank = 0;
  let prev = null;
  rows.forEach((r, i) => {
    if (r.points !== prev) rank = i + 1;
    r.rank = rank;
    prev = r.points;
  });
  return rows;
}

/** When resuming from storage never land on an open card. */
export function sanitizeForResume(round) {
  if (!round) return null;
  if (!PHASES.includes(round.phase)) return null;
  if (round.phase === 'reveal') return { ...round, revealStep: 'pass', seen: false };
  return round;
}

/** Online vote tally: strict majority accuses, otherwise null (spies escape). */
export function tallyVotes(votes, playerCount) {
  const counts = {};
  for (const v of Object.values(votes)) if (v != null) counts[v] = (counts[v] || 0) + 1;
  let best = null;
  let bestN = 0;
  for (const [k, n] of Object.entries(counts)) {
    if (n > bestN) [best, bestN] = [k, n];
  }
  return bestN > playerCount / 2 ? best : null;
}
