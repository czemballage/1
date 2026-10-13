// Back-button handling with the History API.
// One "trap" history entry sits on top of the base entry. Pressing back (Android button,
// browser back, iOS swipe) pops the trap → we ask the app what "back" means here.
// If the app handled it we push a new trap; if not (we're on Home) we leave the user on
// the base entry so the next back press exits normally. We never trap the user on Home.

let trapped = false;
let ignoreNext = false;
let handler = () => false;

export function initRouter(onBack) {
  handler = onBack;
  try {
    history.replaceState({ mj: 'base' }, '');
  } catch {
    /* sandboxed iframes can throw */
  }
  window.addEventListener('popstate', (e) => {
    // Hash changes made by scripts (e.g. the auth SDK cleaning the sign-in token from the URL)
    // also fire popstate, with no state. Only our own entries count as a back press.
    if (!e.state || !e.state.mj) return;
    trapped = false;
    if (ignoreNext) {
      ignoreNext = false;
      return;
    }
    let handled = false;
    try {
      handled = handler();
    } catch (e) {
      console.error(e);
    }
    if (handled) arm();
  });
}

/** Call whenever we navigate away from Home (or open a modal) so back is intercepted. */
export function arm() {
  if (trapped) return;
  try {
    history.pushState({ mj: 'trap' }, '');
    trapped = true;
  } catch {
    /* ignore */
  }
}

/** Call when landing on Home so the next back press can leave the app. */
export function disarm() {
  if (!trapped) return;
  trapped = false;
  ignoreNext = true;
  try {
    history.back();
  } catch {
    /* ignore */
  }
}

export function isArmed() {
  return trapped;
}
