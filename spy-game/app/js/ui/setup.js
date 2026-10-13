// Home + game setup screens (players → pack → settings).
import { esc, pad2, topbar, btn, stamp } from './dom.js';
import { icon } from './icons.js';
import { MIN_PLAYERS, MAX_PLAYERS, MAX_NAME, TIMER_CHOICES, suggestSpies, maxSpies, resolveSpyCount } from '../game.js';

export function homeScreen(s, ctx) {
  const active = s.round && s.round.phase !== 'result';
  const rounds = s.session.rounds;
  return `<section class="screen">
    <header class="topbar">
      <span class="topbar__meta">FILE Nº ${pad2((rounds % 99) + 1)}</span>
      <span class="topbar__title"></span>
      <span class="net" role="status">${icon('wifiOff', { size: 16 })}بدون إنترنت</span>
      <button class="icon-btn" data-action="go" data-to="online-profile" aria-label="حسابي">${icon('user')}</button>
      <button class="icon-btn" data-action="go" data-to="prefs" aria-label="الإعدادات">${icon('sliders')}</button>
    </header>
    <div class="home-hero">
      <div class="folder home-folder">
        <span class="home-stamp">${stamp('سرّي للغاية', { size: 'sm' })}</span>
        <div class="sheet home-sheet">
          <span class="clip">${icon('clip', { size: 36 })}</span>
          <h1 class="home-title">مين الجاسوس؟</h1>
          <p class="home-sub">واحد منكم ما يعرف المكان. اسألوا، شكّوا، واكشفوه قبل ما يكشفكم.</p>
          <div class="home-meta"><span>3–12 لاعب</span><span>${ctx.packs.length} ملفات</span></div>
        </div>
      </div>
    </div>
    <div class="screen__actions">
      ${active ? btn('أكمل الجولة', 'resume', { ic: 'play' }) + btn('جولة جديدة', 'start', { kind: 'secondary' }) : btn('ابدأ لعبة', 'start')}
      <div class="row-2">
        ${btn('أونلاين', 'go', { kind: 'secondary', ic: 'globe', attrs: 'data-to="online"' })}
        ${btn('النتائج', 'go', { kind: 'secondary', ic: 'trophy', attrs: 'data-to="scoreboard"' })}
      </div>
    </div>
  </section>`;
}

export function playersScreen(s, ctx) {
  const n = s.players.length;
  const err = ctx.ui.nameError;
  const errText = { duplicate: 'هذا الاسم موجود. أضف حرفاً للتمييز.', long: `الاسم أطول من ${MAX_NAME} حرفاً.`, full: `الحد الأقصى ${MAX_PLAYERS} لاعباً.`, empty: '' }[err] || '';
  return `<section class="screen">
    ${topbar({ title: 'اللاعبون', meta: `${pad2(n)} / ${MAX_PLAYERS}` })}
    <div class="screen__body">
      <form class="add-row" data-form="add-player" autocomplete="off" novalidate>
        <div class="field">
          <label class="sr-only" for="pname">اسم اللاعب</label>
          <input id="pname" class="input" name="name" maxlength="${MAX_NAME + 4}" placeholder="اكتب اسم اللاعب…" enterkeyhint="done" autocapitalize="words" ${n >= MAX_PLAYERS ? 'disabled' : ''} aria-invalid="${err && err !== 'empty' ? 'true' : 'false'}" aria-describedby="pname-help" value="${esc(ctx.ui.draftName || '')}">
          <p id="pname-help" class="field__help ${errText ? 'is-error' : ''}" aria-live="polite">${errText || (n < MIN_PLAYERS ? `أضف ${MIN_PLAYERS - n} على الأقل` : 'الترتيب = ترتيب الجلوس')}</p>
        </div>
        <button class="add-btn" type="submit" aria-label="أضف" ${n >= MAX_PLAYERS ? 'disabled' : ''}>${icon('plus')}</button>
      </form>
      ${
        n
          ? `<ol class="chips">${s.players
              .map(
                (p, i) => `<li class="chip ${ctx.ui.newChip === i ? 'is-new' : ''}"><span class="chip__num">${pad2(i + 1)}</span><span class="chip__name">${esc(p)}</span>
                <button class="icon-btn" data-action="remove-player" data-i="${i}" aria-label="احذف ${esc(p)}">${icon('close', { size: 20 })}</button></li>`
              )
              .join('')}</ol>`
          : `<div class="empty">${icon('users', { size: 40 })}<p>ما في لاعبين بعد.<br>أضف أسماء الموجودين حول الهاتف.</p></div>`
      }
    </div>
    <div class="screen__actions">
      ${btn(n < MIN_PLAYERS ? `أضف ${MIN_PLAYERS - n} لاعبين على الأقل` : 'التالي: اختر الملف', 'go', { disabled: n < MIN_PLAYERS, ic: n < MIN_PLAYERS ? '' : 'next', attrs: 'data-to="packs"' })}
    </div>
  </section>`;
}

export function packsScreen(s, ctx) {
  return `<section class="screen">
    ${topbar({ title: 'اختر الملف' })}
    <div class="screen__body">
      <div class="packs" role="list">
        ${ctx.packs
          .map((p) => {
            const sel = p.id === s.packId;
            return `<button class="pack" role="listitem" data-action="pick-pack" data-id="${esc(p.id)}" aria-pressed="${sel}">
              ${icon(p.icon, { size: 28 })}
              <span class="pack__name">${esc(p.name_ar)}</span>
              <span class="pack__meta"><span>${p.items.length} ${p.mode === 'places' ? 'مكان' : 'كلمة'}</span>${p.custom ? '<span>· خاص</span>' : ''}</span>
              ${sel ? `<span class="pack__check">${icon('check', { size: 22 })}</span>` : ''}
            </button>`;
          })
          .join('')}
      </div>
    </div>
    <div class="screen__actions">
      ${btn('التالي: الإعدادات', 'go', { disabled: !s.packId, ic: 'next', attrs: 'data-to="setup"' })}
    </div>
  </section>`;
}

export function setupScreen(s, ctx) {
  const pack = ctx.packById(s.packId);
  const n = s.players.length;
  const st = s.settings;
  const wordsOnly = pack?.mode === 'words';
  const mode = wordsOnly ? 'words' : st.mode;
  const spies = resolveSpyCount(st.spies, n);
  const max = maxSpies(n);
  const seg = (name, options, value) =>
    `<div class="seg" role="radiogroup" aria-label="${esc(name)}">${options
      .map((o) => `<button role="radio" aria-checked="${o.v === value}" data-action="${o.action}" data-v="${o.v}" ${o.disabled ? 'disabled' : ''}>${esc(o.label)}</button>`)
      .join('')}</div>`;
  return `<section class="screen">
    ${topbar({ title: 'إعدادات الجولة', meta: pack ? '' : '' })}
    <div class="screen__body">
      <div class="form">
        <div class="form-group">
          <span class="form-label">الملف</span>
          <button class="tool-btn" data-action="go" data-to="packs">${pack ? icon(pack.icon, { size: 20 }) : ''}<span>${esc(pack?.name_ar || 'اختر')}</span>${icon('edit', { size: 18 })}</button>
        </div>
        <div class="form-group">
          <span class="form-label" id="lbl-mode">طريقة اللعب</span>
          ${seg('طريقة اللعب', [
            { label: 'أماكن وأدوار', v: 'places', action: 'set-mode', disabled: wordsOnly },
            { label: 'كلمات', v: 'words', action: 'set-mode' },
          ], mode)}
          <p class="caption">${mode === 'places' ? 'كل واحد يعرف المكان ودوره فيه، إلا الجاسوس.' : 'كل واحد يعرف الكلمة، إلا الجاسوس.'}</p>
        </div>
        <div class="form-group">
          <span class="form-label">عدد الجواسيس</span>
          <div class="stepper">
            <button data-action="spies" data-d="1" aria-label="زيادة" ${spies >= max ? 'disabled' : ''}>${icon('plus', { size: 22 })}</button>
            <output aria-live="polite">${spies}</output>
            <button data-action="spies" data-d="-1" aria-label="إنقاص" ${spies <= 1 ? 'disabled' : ''}>${icon('minus', { size: 22 })}</button>
          </div>
          <p class="caption">المقترح لـ ${n} لاعبين: ${suggestSpies(n)}${st.spies === 'auto' ? ' (تلقائي)' : ''}</p>
        </div>
        <div class="form-group">
          <span class="form-label">مدة النقاش</span>
          ${seg('مدة النقاش', TIMER_CHOICES.map((m) => ({ label: `${m} د`, v: m, action: 'set-minutes' })), st.minutes)}
        </div>
        <div>
          ${mode === 'words' ? toggleRow('imposter', 'وضع الدخيل', 'الجاسوس ياخذ كلمة قريبة وما يعرف إنه جاسوس.', st.imposter) : ''}
          ${toggleRow('dares', 'أحكام للخاسر', 'حكم خفيف ومضحك بعد كل جولة.', st.dares)}
        </div>
      </div>
    </div>
    <div class="screen__actions">
      ${btn('وزّع البطاقات', 'deal', { ic: 'card' })}
    </div>
  </section>`;
}

export function toggleRow(key, title, desc, checked, action = 'toggle') {
  return `<label class="toggle"><span class="toggle__text"><span class="form-label">${esc(title)}</span><span class="caption">${esc(desc)}</span></span>
    <input type="checkbox" role="switch" class="switch" data-action="${action}" data-key="${key}" ${checked ? 'checked' : ''}></label>`;
}
