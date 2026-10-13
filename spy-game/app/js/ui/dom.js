// Tiny DOM helpers shared by all screens. Screens return HTML strings built with esc();
// events are wired once through data-action delegation in app.js.
import { icon } from './icons.js';
import { arm } from '../router.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export const pad2 = (n) => String(n).padStart(2, '0');
export const $ = (sel, root = document) => root.querySelector(sel);

export function topbar({ title = '', back = true, meta = '', end = '' } = {}) {
  return `<header class="topbar">
    ${back ? `<button class="icon-btn" data-action="back" aria-label="رجوع">${icon('back')}</button>` : ''}
    <h1 class="topbar__title">${esc(title)}</h1>
    <span class="net" role="status">${icon('wifiOff', { size: 16 })}بدون إنترنت</span>
    ${meta ? `<span class="topbar__meta">${esc(meta)}</span>` : ''}
    ${end}
  </header>`;
}

export function btn(label, action, { kind = 'primary', ic = '', disabled = false, attrs = '' } = {}) {
  return `<button class="btn btn--${kind}" data-action="${action}" ${disabled ? 'disabled' : ''} ${attrs}>${ic ? icon(ic) : ''}<span>${esc(label)}</span></button>`;
}

export function stamp(text, { size = '', ink = false, animate = false } = {}) {
  return `<span class="stamp ${size ? 'stamp--' + size : ''} ${ink ? 'stamp--ink' : ''} ${animate ? 'is-in' : ''}">${esc(text)}</span>`;
}

// ------------------------------------------------------------------ toast

let toastTimer = null;
export function toast(message, ic = 'check') {
  const root = document.getElementById('toast');
  if (!root) return;
  root.innerHTML = `<div class="toast__msg" role="status">${icon(ic, { size: 20 })}<span>${esc(message)}</span></div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    root.innerHTML = '';
  }, 2400);
}

// ------------------------------------------------------------------ modal

let modalClose = null;

/**
 * Show a modal. Resolves with the value of the clicked [data-modal] button, or null when dismissed.
 * @param {{title:string, body?:string, html?:string, actions:{label:string, value:any, kind?:string}[]}} opts
 */
export function modal({ title, body = '', html = '', actions = [{ label: 'حسناً', value: true }] }) {
  closeModal(null);
  arm();
  return new Promise((resolve) => {
    const root = document.getElementById('modal');
    const prevFocus = document.activeElement;
    root.innerHTML = `<div class="modal-backdrop" data-modal-dismiss>
      <div class="modal sheet" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <span class="clip">${icon('clip', { size: 34 })}</span>
        <h2 id="modal-title">${esc(title)}</h2>
        ${body ? `<p>${esc(body)}</p>` : ''}${html}
        <div class="actions" style="${actions.length === 1 ? 'grid-template-columns:1fr' : ''}">
          ${actions.map((a, i) => `<button class="btn btn--${a.kind || (i === actions.length - 1 ? 'primary' : 'secondary')}" data-modal="${i}"><span>${esc(a.label)}</span></button>`).join('')}
        </div>
      </div></div>`;
    const done = (v) => {
      root.innerHTML = '';
      modalClose = null;
      document.removeEventListener('keydown', onKey);
      prevFocus?.focus?.({ preventScroll: true });
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') done(null);
    };
    document.addEventListener('keydown', onKey);
    root.querySelector('.modal-backdrop').addEventListener('click', (e) => {
      const b = e.target.closest('[data-modal]');
      if (b) done(actions[Number(b.dataset.modal)].value);
      else if (e.target.hasAttribute('data-modal-dismiss')) done(null);
    });
    modalClose = done;
    root.querySelector('[data-modal]:last-child')?.focus({ preventScroll: true });
  });
}

export function closeModal(v = null) {
  if (modalClose) {
    modalClose(v);
    return true;
  }
  return false;
}

export const confirmModal = (title, body, okLabel = 'تأكيد', cancelLabel = 'إلغاء') =>
  modal({ title, body, actions: [{ label: cancelLabel, value: false, kind: 'secondary' }, { label: okLabel, value: true, kind: 'primary' }] });
