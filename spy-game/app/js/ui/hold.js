// Press-and-hold to reveal a secret card. Shared by pass-and-play and online mode.
// The secret markup is only in the DOM while a finger (or key) is down.
// Handles: pointer capture, finger sliding off, multi-touch (first pointer only),
// pointercancel, long-press context menu, keyboard (Space/Enter), blur / tab hidden.
import { play, vibrate } from './fx.js';

export function bindHold(card, secretEl, getHTML, onFirstOpen) {
  if (!card || !secretEl) return () => {};
  let pid = null;
  let keyDown = false;
  let opened = false;

  const open = () => {
    if (card.classList.contains('is-open')) return;
    secretEl.innerHTML = getHTML();
    card.classList.add('is-open');
    play('reveal');
    vibrate(15);
    if (!opened) {
      opened = true;
      onFirstOpen?.();
    }
  };
  const close = () => {
    card.classList.remove('is-open');
    secretEl.innerHTML = '';
  };

  card.addEventListener('pointerdown', (e) => {
    if (pid !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pid = e.pointerId;
    try {
      card.setPointerCapture(pid);
    } catch {
      /* ignore */
    }
    e.preventDefault();
    open();
  });
  card.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid) return;
    const b = card.getBoundingClientRect();
    const m = 24;
    if (e.clientX < b.left - m || e.clientX > b.right + m || e.clientY < b.top - m || e.clientY > b.bottom + m) {
      pid = null;
      close();
    }
  });
  const end = (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    close();
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
  card.addEventListener('lostpointercapture', end);
  card.addEventListener('contextmenu', (e) => e.preventDefault());
  card.addEventListener('dragstart', (e) => e.preventDefault());
  card.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      keyDown = true;
      open();
    }
  });
  card.addEventListener('keyup', (e) => {
    if (keyDown && (e.key === ' ' || e.key === 'Enter')) {
      keyDown = false;
      close();
    }
  });
  card.addEventListener('blur', close);
  return close;
}

// Close any open card when the window loses focus or the tab is hidden.
function closeAll() {
  document.querySelectorAll('.reveal-card.is-open').forEach((c) => {
    c.classList.remove('is-open');
    const s = c.querySelector('.reveal-card__inside');
    if (s) s.innerHTML = '';
  });
}
window.addEventListener('blur', closeAll);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') closeAll();
});
