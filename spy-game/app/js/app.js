// App controller: loads content, renders the current screen from state, wires actions.
import { getState, setState, storage, bags, resetAll } from './state.js';
import * as G from './game.js';
import { initRouter, arm } from './router.js';
import { $, modal, confirmModal, closeModal, toast, esc } from './ui/dom.js';
import { homeScreen, playersScreen, packsScreen, setupScreen } from './ui/setup.js';
import { roundScreen, secretHTML, timerParts } from './ui/round.js';
import { scoreboardScreen, daresScreen, shareScreen, prefsScreen, drawShareCard, shareCanvas } from './ui/extras.js';
import { unlockAudio, play, vibrate, keepAwake, reducedMotion } from './ui/fx.js';
import { bindHold } from './ui/hold.js';

// ------------------------------------------------------------------ context

const ui = { nameError: null, draftName: '', newChip: null, accuseSel: null, guessSel: null, dare: '' };
let content = { version: 0, packs: [], dares: [] };
let packs = [];
let online = null; // lazily imported module

export const ctx = {
  ui,
  get packs() {
    return packs;
  },
  get dares() {
    return content.dares || [];
  },
  get contentVersion() {
    return content.version;
  },
  get storageOk() {
    return storage.ok;
  },
  packById: (id) => packs.find((p) => p.id === id),
  render: () => render(),
  navigate: (to) => navigate(to),
  setPacks: (next) => applyContent(next),
};

const BUNDLED = 'content/packs.json';

async function loadContent() {
  let bundled = null;
  try {
    bundled = await fetch(BUNDLED).then((r) => (r.ok ? r.json() : null));
  } catch {
    bundled = null;
  }
  const cached = storage.get('mj:content', null);
  if (!bundled && !cached) throw new Error('no content');
  applyContent(cached && (!bundled || cached.version > bundled.version) ? cached : bundled);
}

function applyContent(c = content) {
  content = c;
  const custom = storage.get('mj:custom-packs', []);
  packs = [...c.packs, ...custom.filter((p) => p.items?.length >= 3).map((p) => ({ ...p, custom: true }))];
  const s = getState();
  if (s.packId && !packs.some((p) => p.id === s.packId)) setState({ packId: null });
}

// ------------------------------------------------------------------ render

const SCREENS = {
  home: homeScreen,
  players: playersScreen,
  packs: packsScreen,
  setup: setupScreen,
  round: roundScreen,
  scoreboard: scoreboardScreen,
  dares: daresScreen,
  share: shareScreen,
  prefs: prefsScreen,
};

let lastKey = '';

function screenKey(s) {
  const r = s.round;
  return s.screen === 'round' && r ? `round:${r.phase}:${r.revealPos}:${r.revealStep}` : s.screen;
}

export function render() {
  const s = getState();
  const root = document.getElementById('app');
  let html;
  if (s.screen.startsWith('online')) {
    if (!online) {
      loadOnline().then(render);
      html = '<section class="screen"><div class="splash"><p class="muted">جارٍ التحميل…</p></div></section>';
    } else html = online.screen(s, ctx);
  } else {
    if (s.screen === 'round' && !s.round) s.screen = 'home';
    html = (SCREENS[s.screen] || homeScreen)(s, ctx);
  }
  const key = screenKey(s);
  const same = key === lastKey;
  lastKey = key;
  const focusId = document.activeElement?.id;
  root.innerHTML = html;
  const sec = root.firstElementChild;
  if (same && sec) sec.classList.add('no-anim');
  document.documentElement.classList.toggle('reduce-motion', reducedMotion());
  afterRender(s, same, focusId);
}

function afterRender(s, same, focusId) {
  if (!same) window.scrollTo(0, 0);
  const r = s.round;
  const inRound = s.screen === 'round' && r && ['reveal', 'discussion', 'vote', 'spyGuess'].includes(r.phase);
  keepAwake(inRound || (s.screen.startsWith('online') && online?.keepAwake?.()));
  stopTimer();
  if (s.screen === 'round' && r?.phase === 'discussion') startTimer();
  if (s.screen === 'round' && r?.phase === 'reveal' && r.revealStep === 'card') bindRoundHold();
  if (s.screen === 'players') {
    const inp = $('#pname');
    if (inp && (focusId === 'pname' || ui.focusName)) inp.focus({ preventScroll: true });
    ui.focusName = false;
  }
  if (s.screen === 'share') drawShareCard($('#share-canvas'), s).catch(() => {});
  if (s.screen.startsWith('online')) online?.after?.(s, ctx, same);
  if (!same) {
    const h = document.querySelector('.topbar__title, h1, h2');
    if (h && !document.activeElement?.closest?.('#app')) {
      h.setAttribute('tabindex', '-1');
    }
  }
}

function commit(patch) {
  setState(patch);
  render();
  if (online && ('players' in patch || 'settings' in patch)) online.syncUp?.();
}

export function navigate(to) {
  ui.nameError = null;
  ui.newChip = null;
  if (to !== 'round') {
    ui.accuseSel = null;
    ui.guessSel = null;
  }
  if (to === 'dares') ui.dare = pickDare();
  if (to !== 'home') arm();
  commit({ screen: to });
}

// ------------------------------------------------------------------ back button

async function confirmEndRound() {
  const ok = await confirmModal('إنهاء الجولة؟', 'ستضيع البطاقات الحالية ولن تُحتسب النقاط.', 'إنهاء', 'متابعة اللعب');
  if (ok) {
    keepAwake(false);
    commit({ round: null, screen: 'home' });
  }
}

function handleBack() {
  if (closeModal(null)) return true;
  const s = getState();
  if (s.screen.startsWith('online')) {
    if (online?.back(s, ctx)) return true;
    navigate('home');
    return true;
  }
  if (s.screen === 'round' && s.round && s.round.phase !== 'result') {
    confirmEndRound();
    return true;
  }
  const map = {
    players: 'home',
    packs: 'players',
    setup: 'packs',
    scoreboard: s.round?.phase === 'result' ? 'round' : 'home',
    dares: s.round ? 'round' : 'home',
    share: 'scoreboard',
    prefs: 'home',
    round: 'home',
  };
  if (s.screen === 'home') return false;
  navigate(map[s.screen] || 'home');
  return true;
}

// ------------------------------------------------------------------ rounds

function pickDare() {
  const d = ctx.dares;
  if (!d.length) return '';
  let next;
  do next = d[Math.floor(Math.random() * d.length)];
  while (d.length > 1 && next === ui.dare);
  return next;
}

function deal() {
  const s = getState();
  const pack = ctx.packById(s.packId);
  if (!pack || s.players.length < G.MIN_PLAYERS) {
    navigate(!pack ? 'packs' : 'players');
    return;
  }
  const rng = G.cryptoRng();
  const ids = pack.items.map((i) => i.id);
  const { id, bag } = G.drawFromBag(bags.get(pack.id), ids, s.lastItem?.[pack.id], rng);
  bags.set(pack.id, bag);
  const round = G.createRound(s.players, pack, s.settings, { itemId: id, rng });
  ui.accuseSel = null;
  ui.guessSel = null;
  arm();
  play('reveal');
  commit({ round, screen: 'round', lastItem: { ...s.lastItem, [pack.id]: id } });
}

function updateRound(fn) {
  const s = getState();
  let round = fn(s.round);
  const patch = { round };
  if (round.phase === 'result' && !round.applied) {
    patch.session = {
      ...s.session,
      scores: G.applyScores(s.session.scores, round),
      rounds: s.session.rounds + 1,
    };
    patch.round = { ...round, applied: true };
    setTimeout(() => {
      play('stamp');
      vibrate([40, 30, 80]);
    }, 60);
  }
  commit(patch);
}

// ------------------------------------------------------------------ discussion timer

let timerId = null;
let lastSecond = null;

function startTimer() {
  const tick = () => {
    const r = getState().round;
    if (!r || r.phase !== 'discussion') return stopTimer();
    const t = timerParts(r);
    const d = $('#timer-digits');
    if (!d) return;
    d.textContent = t.text;
    $('#timer-fill').style.transform = `scaleX(${t.frac.toFixed(4)})`;
    const box = $('#timer');
    box.classList.toggle('is-warning', t.warning);
    if (t.warning && !t.paused) $('#timer-cap').textContent = 'آخر دقيقة!';
    const sec = Math.ceil(t.ms / 1000);
    if (!t.paused && sec !== lastSecond && sec <= 10 && sec > 0) play('tick');
    lastSecond = sec;
    if (t.ms <= 0 && !t.paused) {
      stopTimer();
      play('alarm');
      vibrate([200, 100, 200]);
      updateRound((round) => G.transition(round, 'vote'));
      toast('انتهى الوقت! حان وقت التصويت', 'timer');
    }
  };
  tick();
  timerId = setInterval(tick, 250);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

// ------------------------------------------------------------------ hold to reveal

function bindRoundHold() {
  bindHold($('#reveal-card'), $('#secret'), () => secretHTML(getState().round), () => {
    const r = getState().round;
    if (!r.seen) {
      setState({ round: { ...r, seen: true } });
      const done = $('#card-done');
      if (done) done.disabled = false;
    }
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const s = getState();
  if (s.screen === 'round' && s.round?.phase === 'discussion') render();
});

// ------------------------------------------------------------------ actions

const actions = {
  go: (el) => navigate(el.dataset.to),
  back: () => handleBack(),
  async start() {
    const s = getState();
    if (s.round && s.round.phase !== 'result') {
      const ok = await confirmModal('جولة جديدة؟', 'الجولة الحالية لم تنتهِ وستُلغى.', 'جولة جديدة', 'رجوع');
      if (!ok) return;
    }
    setState({ round: null });
    navigate('players');
  },
  resume: () => navigate('round'),

  'remove-player': (el) => {
    const i = Number(el.dataset.i);
    const players = getState().players.filter((_, k) => k !== i);
    ui.newChip = null;
    commit({ players });
  },
  'pick-pack': (el) => {
    const pack = ctx.packById(el.dataset.id);
    const s = getState();
    const settings = pack?.mode === 'words' ? { ...s.settings, mode: 'words' } : s.settings;
    commit({ packId: el.dataset.id, settings });
  },
  'set-mode': (el) => commit({ settings: { ...getState().settings, mode: el.dataset.v } }),
  'set-minutes': (el) => commit({ settings: { ...getState().settings, minutes: Number(el.dataset.v) } }),
  spies: (el) => {
    const s = getState();
    const n = s.players.length;
    const cur = G.resolveSpyCount(s.settings.spies, n);
    const next = Math.min(G.maxSpies(n), Math.max(1, cur + Number(el.dataset.d)));
    commit({ settings: { ...s.settings, spies: next === G.suggestSpies(n) ? 'auto' : next } });
  },
  toggle: (el) => commit({ settings: { ...getState().settings, [el.dataset.key]: el.checked } }),
  pref: (el) => {
    const k = el.dataset.key;
    const v = k === 'reducedMotion' ? (el.checked ? 'on' : 'auto') : el.checked;
    commit({ prefs: { ...getState().prefs, [k]: v } });
  },
  deal: () => deal(),
  again: () => deal(),

  'reveal-next': () => {
    const r = getState().round;
    if (!r || r.phase !== 'reveal') return;
    if (r.revealStep === 'card' && !r.seen) return toast('اضغط مطوّلاً على البطاقة أولاً', 'fingerprint');
    const next = G.revealNext(r);
    if (next.phase === 'discussion') {
      play('stamp');
      vibrate(40);
    }
    updateRound(() => next);
  },
  async 'vote-now'() {
    const ok = await confirmModal('نوقف الوقت ونصوّت؟', 'تقدرون تصوّتون الآن بدون انتظار نهاية الوقت.', 'صوّتوا', 'رجوع');
    const r = getState().round;
    if (ok && r?.phase === 'discussion') updateRound((round) => G.transition(round, 'vote'));
  },
  'pause-timer': () => updateRound((r) => G.pauseTimer(r)),
  'resume-timer': () => updateRound((r) => G.resumeTimer(r)),
  'show-locations': () => {
    const r = getState().round;
    modal({
      title: r.mode === 'places' ? 'كل الأماكن في الملف' : 'كل الكلمات في الملف',
      html: `<ul class="list">${r.locations.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`,
      actions: [{ label: 'رجوع للنقاش', value: true }],
    });
  },
  'accuse-pick': (el) => {
    ui.accuseSel = Number(el.dataset.i);
    vibrate(10);
    render();
  },
  'accuse-confirm': () => {
    if (ui.accuseSel == null) return;
    const i = ui.accuseSel;
    ui.accuseSel = null;
    ui.guessSel = null;
    updateRound((r) => G.accuse(r, i));
  },
  'guess-pick': (el) => {
    ui.guessSel = Number(el.dataset.i);
    vibrate(10);
    render();
  },
  'guess-confirm': () => {
    const r = getState().round;
    if (ui.guessSel == null) return;
    const g = r.options[ui.guessSel];
    ui.guessSel = null;
    updateRound((round) => G.spyGuess(round, g));
  },
  'dare-next': () => {
    ui.dare = pickDare();
    render();
  },
  'dare-done': () => navigate(getState().round ? 'round' : 'home'),
  async 'share-now'() {
    try {
      const res = await shareCanvas($('#share-canvas'));
      if (res === 'downloaded') toast('تم حفظ الصورة', 'download');
    } catch {
      toast('تعذّرت المشاركة', 'close');
    }
  },
  async 'share-download'() {
    try {
      await shareCanvas($('#share-canvas'), { download: true });
      toast('تم حفظ الصورة', 'download');
    } catch {
      toast('تعذّر الحفظ', 'close');
    }
  },
  async 'reset-scores'() {
    if (await confirmModal('تصفير النتائج؟', 'ستُحذف نقاط كل اللاعبين في هذه الجلسة.', 'تصفير', 'إلغاء')) {
      commit({ session: { scores: {}, rounds: 0 } });
      toast('تم التصفير');
    }
  },
  async 'reset-all'() {
    if (await confirmModal('حذف كل البيانات؟', 'الأسماء والنتائج والإعدادات المحفوظة على هذا الهاتف.', 'حذف', 'إلغاء')) {
      resetAll();
      navigate('home');
      toast('تم الحذف');
    }
  },
};

function addPlayer(form) {
  const input = form.elements.name;
  const s = getState();
  const err = G.validateName(input.value, s.players);
  ui.focusName = true;
  if (err) {
    ui.nameError = err;
    ui.draftName = input.value;
    if (err === 'empty') return input.focus();
    vibrate([20, 40, 20]);
    return render();
  }
  ui.nameError = null;
  ui.draftName = '';
  ui.newChip = s.players.length;
  commit({ players: [...s.players, G.cleanName(input.value)] });
}

// ------------------------------------------------------------------ events

document.addEventListener(
  'pointerdown',
  () => {
    unlockAudio();
  },
  { passive: true }
);

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled || el.closest('#modal')) return;
  if (el.matches('input[type="checkbox"]')) return; // handled on change
  unlockAudio();
  const name = el.dataset.action;
  if (name.startsWith('ol-')) {
    await loadOnline();
    return online.action(name, el, ctx);
  }
  const fn = actions[name];
  if (fn) {
    e.preventDefault();
    try {
      await fn(el, e);
    } catch (err) {
      console.error(err);
      toast('حدث خطأ غير متوقّع', 'close');
    }
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (!el.matches('input[type="checkbox"][data-action]')) return;
  const name = el.dataset.action;
  if (name.startsWith('ol-')) return online?.action(name, el, ctx);
  actions[name]?.(el);
});

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  if (form.dataset.form === 'add-player') return addPlayer(form);
  await loadOnline();
  online.submit(form.dataset.form, form, ctx);
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'pname') {
    ui.draftName = e.target.value;
    if (ui.nameError) {
      ui.nameError = null;
      e.target.setAttribute('aria-invalid', 'false');
      const help = $('#pname-help');
      help.classList.remove('is-error');
      help.textContent = '';
    }
  }
});

// Online / offline indicator.
function updateNet() {
  document.documentElement.classList.toggle('is-offline', !navigator.onLine);
  online?.netChanged?.(navigator.onLine, ctx);
}
window.addEventListener('online', updateNet);
window.addEventListener('offline', updateNet);

async function loadOnline() {
  if (!online) online = await import('./ui/online.js');
  return online;
}

// ------------------------------------------------------------------ boot

async function boot() {
  initRouter(handleBack);
  updateNet();
  try {
    await loadContent();
  } catch {
    document.getElementById('app').innerHTML = `<section class="screen"><div class="splash"><h1 class="splash__title">مين الجاسوس؟</h1><p class="muted">تعذّر تحميل المحتوى. اتصل بالإنترنت مرة واحدة ثم أعد المحاولة.</p><button class="btn btn--primary" onclick="location.reload()"><span>إعادة المحاولة</span></button></div></section>`;
    return;
  }
  // Resume an interrupted round safely.
  const s = getState();
  const round = G.sanitizeForResume(s.round);
  const patch = { round };
  if (s.screen === 'round' && !round) patch.screen = 'home';
  if (round && round.phase === 'discussion' && G.remainingMs(round) <= 0) patch.round = G.transition(round, 'vote');
  if (s.screen.startsWith('online')) patch.screen = 'online';
  // Deep link to join a room: ?room=ABCD
  const room = new URLSearchParams(location.search).get('room');
  if (room) {
    patch.screen = 'online';
    ui.joinCode = room.toUpperCase().slice(0, 4);
  }
  setState(patch);
  if (getState().screen !== 'home') arm();
  try {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]);
  } catch {
    /* ignore */
  }
  render();
  // Background: check for newer packs from the cloud (never blocks play).
  if (navigator.onLine) {
    import('./sync.js')
      .then((m) => m.refreshContent(content.version, ctx))
      .catch(() => {});
  }
}

boot();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
