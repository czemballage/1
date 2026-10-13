// Online mode: each player on their own phone. Rooms, roles and votes live in Supabase;
// the spy's identity is decided server-side and every phone only ever reads its own card.
import { getState, setState, storage } from '../state.js';
import { esc, topbar, btn, stamp, toast, confirmModal, $ } from './dom.js';
import { icon } from './icons.js';
import { getClient, ensureSession, currentUser, rpc, errorText, sendEmailCode, verifyEmailCode, signOut, toError } from '../supabase.js';
import { schedulePush, pullUserData, fetchStats, saveProfile, listCustomPacks, saveCustomPack, deleteCustomPack, cacheCustomPacks } from '../sync.js';
import { bindHold } from './hold.js';
import { play, vibrate } from './fx.js';
import { arm } from '../router.js';
import { TIMER_CHOICES, MAX_NAME, cleanName, normalizeName } from '../game.js';
import { timerParts } from './round.js';

export const AVATARS = ['spy', 'user', 'crown', 'paw', 'ball', 'plane', 'lantern', 'dallah'];

const o = {
  me: null,
  room: null,
  players: [],
  secret: null,
  channel: null,
  poll: null,
  tick: null,
  busy: false,
  error: '',
  myVote: null,
  voteRound: 0,
  guessSel: null,
  calledVote: false,
  lastStatus: null,
  stats: null,
  customPacks: null,
  otp: { email: '', type: null },
  edit: null,
  create: { packId: null, minutes: 6 },
};

const profile = () => storage.get('mj:profile', { name: '', avatar: 'spy' });
const setProfile = (p) => storage.set('mj:profile', { ...profile(), ...p });
const isHost = () => o.room && o.me && o.room.host === o.me.id;
const meName = (id) => o.players.find((p) => p.user_id === id)?.name || '؟';

// ------------------------------------------------------------------ screens

export function screen(s, ctx) {
  const offline = !navigator.onLine;
  if (offline && s.screen !== 'online-room') return offlineScreen();
  switch (s.screen) {
    case 'online-create':
      return createScreen(ctx);
    case 'online-profile':
      return profileScreen(ctx);
    case 'online-pack':
      return packEditor();
    case 'online-room':
      return roomScreen(ctx, offline);
    default:
      return entryScreen(ctx);
  }
}

function offlineScreen() {
  return `<section class="screen">
    ${topbar({ title: 'اللعب أونلاين' })}
    <div class="screen__body screen__body--center">
      <div class="empty">${icon('wifiOff', { size: 44 })}<p><b style="color:var(--paper)">اللعب أونلاين يحتاج إنترنت.</b><br>اللعب على هاتف واحد يشتغل بدون إنترنت.</p></div>
    </div>
    <div class="screen__actions">${btn('العب على هاتف واحد', 'go', { attrs: 'data-to="players"', ic: 'users' })}</div>
  </section>`;
}

function errorLine() {
  return o.error ? `<div class="offline-banner" role="alert">${icon('close', { size: 20 })}<span>${esc(o.error)}</span></div>` : '';
}

function nameField(id = 'ol-name') {
  const p = profile();
  return `<div class="field"><label class="form-label" for="${id}">اسمك في الغرفة</label>
    <input id="${id}" class="input" name="name" maxlength="${MAX_NAME + 4}" required placeholder="مثلاً: أمين" value="${esc(p.name)}" autocomplete="nickname"></div>`;
}

function entryScreen(ctx) {
  const code = ctx.ui.joinCode || '';
  const p = profile();
  return `<section class="screen">
    ${topbar({ title: 'اللعب أونلاين', end: `<button class="icon-btn" data-action="go" data-to="online-profile" aria-label="الحساب">${icon(p.avatar || 'user')}</button>` })}
    <div class="screen__body">
      ${errorLine()}
      <form class="sheet form" data-form="ol-join" style="padding:var(--s6) var(--s4)" autocomplete="off" novalidate>
        <span class="clip">${icon('clip', { size: 34 })}</span>
        <h2 style="font-family:var(--f-body);font-weight:600;font-size:21px">ادخل غرفة صديقك</h2>
        <div class="field"><label class="form-label" for="ol-code" style="color:var(--ink)">رمز الغرفة</label>
          <input id="ol-code" class="code-input" name="code" maxlength="4" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABCD" value="${esc(code)}" required></div>
        <div style="color:var(--ink)">${nameField('ol-join-name').replace('class="form-label"', 'class="form-label" style="color:var(--ink)"')}</div>
        <button class="btn btn--secondary" type="submit" ${o.busy ? 'disabled' : ''} style="color:var(--ink);box-shadow:inset 0 0 0 2px var(--ink)">${icon('next')}<span>${o.busy ? 'جارٍ الدخول…' : 'ادخل الغرفة'}</span></button>
      </form>
      <p class="caption">كل لاعب يلعب من هاتفه. المضيف ينشئ الغرفة ويرسل الرمز للباقين.</p>
    </div>
    <div class="screen__actions">
      ${btn('أنشئ غرفة جديدة', 'go', { ic: 'plus', attrs: 'data-to="online-create"' })}
    </div>
  </section>`;
}

function createScreen(ctx) {
  const packs = ctx.packs;
  const sel = o.create.packId || getState().packId || packs[0]?.id;
  return `<section class="screen">
    ${topbar({ title: 'غرفة جديدة' })}
    <div class="screen__body">
      ${errorLine()}
      <form class="form" data-form="ol-create" autocomplete="off" novalidate id="ol-create-form">
        ${nameField()}
        <div class="form-group"><span class="form-label">الملف</span>
          <div class="packs" role="radiogroup" aria-label="الملف" style="padding-block-start:var(--s3)">
            ${packs
              .map(
                (p) => `<button type="button" class="pack" role="radio" aria-checked="${p.id === sel}" aria-pressed="${p.id === sel}" data-action="ol-pick-pack" data-id="${esc(p.id)}">
                ${icon(p.icon, { size: 24 })}<span class="pack__name">${esc(p.name_ar)}</span>
                <span class="pack__meta"><span>${p.items.length} ${p.mode === 'places' ? 'مكان' : 'كلمة'}</span></span></button>`
              )
              .join('')}
          </div>
        </div>
        <div class="form-group"><span class="form-label">مدة النقاش</span>
          <div class="seg" role="radiogroup" aria-label="مدة النقاش">${TIMER_CHOICES.map(
            (m) => `<button type="button" role="radio" aria-checked="${m === o.create.minutes}" data-action="ol-minutes" data-v="${m}">${m} د</button>`
          ).join('')}</div>
        </div>
      </form>
    </div>
    <div class="screen__actions">
      <button class="btn btn--primary" type="submit" form="ol-create-form" ${o.busy ? 'disabled' : ''}>${icon('globe')}<span>${o.busy ? 'جارٍ الإنشاء…' : 'أنشئ الغرفة'}</span></button>
    </div>
  </section>`;
}

function profileScreen() {
  const p = profile();
  const u = o.me;
  const st = o.stats;
  const signed = u && !u.is_anonymous && u.email;
  const rate = st && st.times_spy ? Math.round((st.spy_wins / st.times_spy) * 100) : 0;
  return `<section class="screen">
    ${topbar({ title: 'الحساب' })}
    <div class="screen__body">
      ${errorLine()}
      <form class="form" data-form="ol-profile" autocomplete="off" novalidate>
        ${nameField('ol-profile-name')}
        <div class="form-group"><span class="form-label">الصورة</span>
          <div class="avatars" role="radiogroup" aria-label="الصورة">${AVATARS.map(
            (a) => `<button type="button" class="avatar-opt" role="radio" aria-checked="${a === p.avatar}" aria-pressed="${a === p.avatar}" data-action="ol-avatar" data-v="${a}" aria-label="${a}">${icon(a, { size: 30 })}</button>`
          ).join('')}</div>
        </div>
        <button class="btn btn--secondary" type="submit">${icon('check')}<span>حفظ</span></button>
      </form>
      ${
        st
          ? `<dl class="sheet" style="padding:var(--s4);display:grid;grid-template-columns:repeat(3,1fr);text-align:center;gap:var(--s2);margin:0">
          <div><dt class="caption" style="color:var(--ink-soft)">جولات</dt><dd class="board__pts" style="margin:0">${st.games_played}</dd></div>
          <div><dt class="caption" style="color:var(--ink-soft)">مرّات جاسوس</dt><dd class="board__pts" style="margin:0">${st.times_spy}</dd></div>
          <div><dt class="caption" style="color:var(--ink-soft)">فوز الجاسوس</dt><dd class="board__pts" style="margin:0"><span class="ltr">${rate}%</span></dd></div></dl>`
          : ''
      }
      <div class="form-group">
        <span class="form-label">حفظ الحساب</span>
        ${
          signed
            ? `<p class="caption">مسجّل بـ <span class="ltr">${esc(u.email)}</span> — أسماؤك وإعداداتك وملفاتك محفوظة في السحابة.</p>${btn('تسجيل الخروج', 'ol-signout', { kind: 'ghost' })}`
            : o.otp.type
              ? `<form class="add-row" data-form="ol-otp-verify" autocomplete="one-time-code" novalidate>
                  <div class="field"><label class="sr-only" for="ol-otp">الرمز</label><input id="ol-otp" class="input ltr" name="token" inputmode="numeric" maxlength="8" placeholder="الرمز من البريد" required></div>
                  <button class="add-btn" type="submit" aria-label="تأكيد">${icon('check')}</button></form>
                 <p class="caption">أرسلنا رمزاً إلى <span class="ltr">${esc(o.otp.email)}</span></p>`
              : `<form class="add-row" data-form="ol-otp-send" novalidate>
                  <div class="field"><label class="sr-only" for="ol-email">البريد الإلكتروني</label><input id="ol-email" class="input ltr" type="email" name="email" inputmode="email" autocomplete="email" placeholder="name@example.com" required></div>
                  <button class="add-btn" type="submit" aria-label="أرسل الرمز">${icon('next')}</button></form>
                 <p class="caption">اختياري: أدخل بريدك لنرسل لك رمز دخول، فتنحفظ نتائجك وملفاتك على كل أجهزتك.</p>`
        }
      </div>
      <div class="form-group">
        <span class="form-label">ملفاتك الخاصة</span>
        ${
          o.customPacks == null
            ? '<p class="caption">جارٍ التحميل…</p>'
            : o.customPacks.length
              ? `<ul class="chips">${o.customPacks
                  .map(
                    (p, i) => `<li class="chip"><span class="chip__num">${p.items.length}</span><span class="chip__name">${esc(p.name_ar)}</span>
                  <button class="icon-btn" data-action="ol-edit-pack" data-i="${i}" aria-label="تعديل">${icon('edit', { size: 20 })}</button>
                  <button class="icon-btn" data-action="ol-del-pack" data-i="${i}" aria-label="حذف">${icon('trash', { size: 20 })}</button></li>`
                  )
                  .join('')}</ul>`
              : '<p class="caption">أنشئ ملفك: أماكن مدرستك، أكلات عائلتك، نكت شلّتكم…</p>'
        }
        ${btn('ملف جديد', 'ol-new-pack', { kind: 'secondary', ic: 'plus' })}
      </div>
    </div>
  </section>`;
}

function packEditor() {
  const e = o.edit || { name_ar: '', mode: 'places', text: '' };
  return `<section class="screen">
    ${topbar({ title: e.id ? 'تعديل الملف' : 'ملف جديد' })}
    <div class="screen__body">
      ${errorLine()}
      <form class="form" data-form="ol-pack-save" id="ol-pack-form" novalidate>
        <div class="field"><label class="form-label" for="pk-name">اسم الملف</label><input id="pk-name" class="input" name="name" maxlength="30" required value="${esc(e.name_ar)}" placeholder="مثلاً: حيّنا"></div>
        <div class="form-group"><span class="form-label">النوع</span>
          <div class="seg" role="radiogroup">${[
            ['places', 'أماكن وأدوار'],
            ['words', 'كلمات'],
          ]
            .map(([v, l]) => `<button type="button" role="radio" aria-checked="${e.mode === v}" data-action="ol-pack-mode" data-v="${v}">${l}</button>`)
            .join('')}</div>
        </div>
        <div class="field"><label class="form-label" for="pk-items">العناصر — سطر لكل عنصر (3 على الأقل)</label>
          <textarea id="pk-items" name="items" class="input" style="height:auto;min-height:220px;padding-block:12px;line-height:1.8" placeholder="${
            e.mode === 'places' ? 'مقهى الحيّ: القهواجي، زبون دائم، لاعب دومينو\nملعب الحيّ: الحارس، الحكم، المشجّع' : 'تفاحة\nموز\nبطيخ'
          }">${esc(e.text)}</textarea>
          <p class="caption">${e.mode === 'places' ? 'اكتب المكان ثم «:» ثم الأدوار مفصولة بفاصلة (الأدوار اختيارية).' : 'كلمة واحدة أو أكثر في كل سطر.'}</p></div>
      </form>
    </div>
    <div class="screen__actions">
      <button class="btn btn--primary" type="submit" form="ol-pack-form">${icon('check')}<span>حفظ الملف</span></button>
    </div>
  </section>`;
}

// ------------------------------------------------------------------ room

function playersList() {
  return `<ul class="chips">${o.players
    .map(
      (p) => `<li class="chip"><span class="chip__num">${icon(p.avatar || 'user', { size: 20 })}</span><span class="chip__name">${esc(p.name)}</span>
      ${p.user_id === o.room.host ? `<span class="badge">${icon('crown', { size: 14 })}المضيف</span>` : ''}${p.user_id === o.me?.id ? '<span class="caption" style="color:var(--ink-soft);padding-inline-end:12px">أنت</span>' : ''}</li>`
    )
    .join('')}</ul>`;
}

function roomScreen(ctx, offline) {
  const r = o.room;
  if (!r) return `<section class="screen">${topbar({ title: 'الغرفة' })}<div class="splash"><p class="muted">جارٍ الاتصال…</p></div></section>`;
  const banner = offline ? `<div class="offline-banner">${icon('wifiOff', { size: 20 })}<span>انقطع الاتصال… سنعيد المحاولة تلقائياً.</span></div>` : '';
  const n = o.players.length;
  const title = `غرفة ${r.code}`;
  const head = topbar({ title, meta: r.round ? `ROUND ${r.round}` : '' });

  if (r.status === 'lobby' || r.status === 'closed') {
    const link = joinLink();
    return `<section class="screen" data-screen="ol-lobby">
      ${head}
      <div class="screen__body">
        ${banner}${errorLine()}
        <div class="sheet room-code">
          <span class="caption" style="color:var(--ink-soft)">رمز الغرفة</span>
          <span class="room-code__value">${esc(r.code)}</span>
          <canvas class="qr" id="ol-qr" width="168" height="168" role="img" aria-label="رمز QR للدخول"></canvas>
          <span class="caption" style="color:var(--ink-soft)">${esc(r.pack_name)} · ${r.minutes} د</span>
        </div>
        <div class="row-2">
          ${btn('شارك الرابط', 'ol-share', { kind: 'secondary', ic: 'share', attrs: `data-link="${esc(link)}"` })}
          ${btn('نسخ', 'ol-copy', { kind: 'secondary', ic: 'copy', attrs: `data-link="${esc(link)}"` })}
        </div>
        <p class="form-label">اللاعبون (${n}/12)</p>
        ${playersList()}
      </div>
      <div class="screen__actions">
        ${
          isHost()
            ? btn(n < 3 ? `ننتظر ${3 - n} لاعبين على الأقل` : 'ابدأ الجولة', 'ol-start', { disabled: n < 3 || o.busy, ic: n < 3 ? '' : 'play' })
            : `<p class="caption" style="text-align:center">بانتظار المضيف ليبدأ الجولة…</p>`
        }
        ${btn('خروج من الغرفة', 'ol-leave', { kind: 'ghost' })}
      </div>
    </section>`;
  }

  if (r.status === 'playing') {
    const t = timerParts({ minutes: r.minutes, endsAt: new Date(r.ends_at).getTime(), remainingMs: null });
    return `<section class="screen" data-screen="ol-playing">
      ${head}
      <div class="screen__body">
        ${banner}
        <div class="sheet asker">${icon('user', { size: 26 })}<div class="asker__text"><span class="caption" style="color:var(--ink-soft)">يبدأ بالسؤال</span><p class="asker__name">${esc(meName(r.first_asker))}</p></div></div>
        <div class="reveal-wrap" style="padding-block:var(--s2)">
          <div class="reveal-card" id="ol-card" tabindex="0" role="button" aria-label="اضغط مطوّلاً لكشف بطاقتك" style="height:min(38vh,320px);min-height:220px">
            <div class="reveal-card__inside sheet" id="ol-secret"></div>
            <div class="reveal-card__cover folder"><span class="fp-pad">${icon('fingerprint', { size: 56 })}</span><span class="fp-label">اضغط مطوّلاً لكشف بطاقتك</span></div>
          </div>
        </div>
        <div class="timer ${t.warning ? 'is-warning' : ''}" id="ol-timer" style="flex:none">
          <span class="timer__digits" id="ol-digits" style="font-size:56px">${t.text}</span>
          <div class="timer__track"><div class="timer__fill" id="ol-fill" style="transform:scaleX(${t.frac.toFixed(4)})"></div></div>
        </div>
      </div>
      <div class="screen__actions">
        ${isHost() ? btn('صوّتوا الآن', 'ol-call-vote', { ic: 'users' }) : '<p class="caption" style="text-align:center">المضيف يفتح التصويت، أو يفتح تلقائياً عند انتهاء الوقت.</p>'}
      </div>
    </section>`;
  }

  if (r.status === 'voting') {
    const voted = o.voteRound === r.round ? o.myVote : null;
    return `<section class="screen" data-screen="ol-vote">
      ${head}
      <div class="screen__body">
        ${banner}${errorLine()}
        <h2 class="headline">مين الجاسوس؟</h2>
        <p class="lead">صوّت من هاتفك. الأغلبية تقرّر. <span class="ltr">${r.votes_count}/${n}</span> صوّتوا.</p>
        <ul class="pick-grid">${o.players
          .filter((p) => p.user_id !== o.me?.id)
          .map((p) => `<li><button class="pick" data-action="ol-vote" data-id="${p.user_id}" aria-pressed="${voted === p.user_id}"><span>${esc(p.name)}</span>${icon('check', { size: 20 })}</button></li>`)
          .join('')}</ul>
        <p class="caption">تقدر تغيّر صوتك قبل ما يكتمل التصويت.</p>
      </div>
      <div class="screen__actions">
        ${isHost() ? btn('أغلق التصويت الآن', 'ol-close-vote', { kind: 'secondary' }) : ''}
      </div>
    </section>`;
  }

  if (r.status === 'guess') {
    const mine = r.accused === o.me?.id;
    const what = r.mode === 'places' ? 'المكان' : 'الكلمة';
    return `<section class="screen" data-screen="ol-guess">
      ${head}
      <div class="screen__body">
        ${banner}${errorLine()}
        <div class="sheet verdict"><h2>${esc(meName(r.accused))} جاسوس!</h2>${stamp('مكشوف!', { size: 'sm', animate: true })}</div>
        ${
          mine
            ? `<p class="lead">فرصتك الأخيرة: خمّن ${what}.</p>
               <ul class="pick-grid pick-grid--options">${(r.options || [])
                 .map((op, i) => `<li><button class="pick" data-action="ol-guess-pick" data-i="${i}" aria-pressed="${o.guessSel === i}"><span>${esc(op)}</span>${icon('check', { size: 18 })}</button></li>`)
                 .join('')}</ul>`
            : `<p class="lead">الجاسوس يحاول يخمّن ${what}… انتظروا.</p>`
        }
      </div>
      <div class="screen__actions">${mine ? btn(o.guessSel != null ? `تخميني: ${r.options[o.guessSel]}` : `اختر ${what}`, 'ol-guess', { disabled: o.guessSel == null || o.busy }) : ''}</div>
    </section>`;
  }

  // result
  const res = r.result || {};
  const stampText = res.outcome === 'caught' ? 'مكشوف!' : 'هرب الجاسوس!';
  const mine = res.points?.[o.me?.id] || 0;
  const spies = (res.spies || []).map((x) => x.name).join(' و ');
  const line =
    res.outcome === 'escaped'
      ? res.accused
        ? `اتّهمتم ${meName(res.accused)} وهو بريء.`
        : 'ما اتّفقتم على اسم، فهرب الجاسوس.'
      : res.outcome === 'guessed'
        ? 'انكشف الجاسوس لكنه خمّن صح.'
        : `انكشف الجاسوس وخمّن «${res.guess || ''}».`;
  return `<section class="screen" data-screen="ol-result">
    ${head}
    <div class="screen__body">
      ${banner}
      <article class="sheet result">
        <div class="result__stamp">${stamp(stampText, { size: 'xl', animate: true })}</div>
        <span class="caption" style="color:var(--ink-soft)">${r.mode === 'places' ? 'المكان' : 'الكلمة'} كان</span>
        <p class="result__item">${esc(res.item || '')}</p>
        <dl>
          <div class="kv"><dt>${(res.spies || []).length > 1 ? 'الجواسيس' : 'الجاسوس'}</dt><dd>${esc(spies)}</dd></div>
          <div class="kv"><dt>ماذا حدث</dt><dd>${esc(line)}</dd></div>
          <div class="kv"><dt>نقاطك</dt><dd><span class="ltr">+${mine}</span></dd></div>
        </dl>
      </article>
    </div>
    <div class="screen__actions">
      ${isHost() ? btn('جولة أخرى', 'ol-start', { ic: 'refresh', disabled: o.busy || n < 3 }) : '<p class="caption" style="text-align:center">بانتظار المضيف للجولة التالية…</p>'}
      ${btn('خروج من الغرفة', 'ol-leave', { kind: 'ghost' })}
    </div>
  </section>`;
}

function joinLink() {
  const u = new URL(location.href);
  u.search = `?room=${o.room.code}`;
  u.hash = '';
  return u.toString();
}

// ------------------------------------------------------------------ after render

export function after(s, ctx, same) {
  clearInterval(o.tick);
  if (s.screen === 'online-profile' && !same) loadProfileData(ctx);
  if (s.screen === 'online' && (!same || !o.resumeTried)) {
    o.resumeTried = true;
    resumeRoom(ctx);
  }
  if (s.screen !== 'online-room' || !o.room) return;
  const r = o.room;
  if (r.status === 'lobby') drawQR();
  if (r.status === 'playing') {
    bindHold($('#ol-card'), $('#ol-secret'), secretHTML);
    o.tick = setInterval(() => tickTimer(ctx), 250);
  }
}

export const keepAwake = () => ['playing', 'voting', 'guess'].includes(o.room?.status);

function secretHTML() {
  const c = o.secret;
  if (!c || c.round !== o.room.round) return '<p class="secret__hint">جارٍ تحميل بطاقتك…</p>';
  if (c.kind === 'spy')
    return `<span class="secret__spy-icon">${icon('spy', { size: 56 })}</span>${stamp('أنت الجاسوس')}<p class="secret__hint">${o.room.mode === 'places' ? 'اسمع الأسئلة وحاول تعرف المكان.' : 'اسمع جيداً وحاول تعرف الكلمة.'}</p>`;
  if (c.kind === 'place')
    return `<span class="secret__label">المكان</span><p class="secret__big">${esc(c.place)}</p>${c.role ? `<span class="secret__label">دورك</span><span class="secret__role">${esc(c.role)}</span>` : ''}`;
  return `<span class="secret__label">الكلمة</span><p class="secret__big">${esc(c.word)}</p>`;
}

function tickTimer(ctx) {
  const r = o.room;
  if (!r || r.status !== 'playing') return clearInterval(o.tick);
  const t = timerParts({ minutes: r.minutes, endsAt: new Date(r.ends_at).getTime(), remainingMs: null });
  const d = $('#ol-digits');
  if (!d) return;
  d.textContent = t.text;
  $('#ol-fill').style.transform = `scaleX(${t.frac.toFixed(4)})`;
  $('#ol-timer').classList.toggle('is-warning', t.warning);
  if (t.ms <= 0 && !o.calledVote) {
    o.calledVote = true;
    play('alarm');
    vibrate([200, 100, 200]);
    rpc('spy_call_vote', { p_room: r.id })
      .then(() => refresh(ctx))
      .catch(() => {});
  }
}

function drawQR() {
  const c = $('#ol-qr');
  if (!c) return;
  const draw = () => {
    try {
      const qr = window.qrcode(0, 'M');
      qr.addData(joinLink());
      qr.make();
      const n = qr.getModuleCount();
      const g = c.getContext('2d');
      const size = c.width;
      const cell = size / n;
      g.fillStyle = '#F4EBD6';
      g.fillRect(0, 0, size, size);
      g.fillStyle = '#0E0D0B';
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) g.fillRect(Math.floor(x * cell), Math.floor(y * cell), Math.ceil(cell), Math.ceil(cell));
    } catch {
      c.hidden = true;
    }
  };
  if (window.qrcode) return draw();
  const s = document.createElement('script');
  s.src = 'assets/vendor/qrcode.js';
  s.onload = draw;
  s.onerror = () => (c.hidden = true);
  document.head.appendChild(s);
}

// ------------------------------------------------------------------ data

async function withBusy(ctx, fn) {
  if (o.busy) return;
  o.busy = true;
  o.error = '';
  ctx.render();
  try {
    await fn();
  } catch (e) {
    const err = e.code ? e : toError(e);
    o.error = errorText(err);
    vibrate([20, 40, 20]);
  } finally {
    o.busy = false;
    ctx.render();
  }
}

async function connect() {
  await ensureSession();
  o.me = await currentUser();
  return o.me;
}

async function refresh(ctx) {
  if (!o.room) return;
  const c = await getClient();
  const [{ data: room, error: e1 }, { data: players, error: e2 }] = await Promise.all([
    c.from('spy_rooms').select('*').eq('id', o.room.id).maybeSingle(),
    c.from('spy_room_players').select('user_id, name, avatar, seat').eq('room_id', o.room.id).order('seat'),
  ]);
  if (e1 || e2) throw toError(e1 || e2); // network hiccup: keep the current state, the poll retries
  if (!room || room.status === 'closed') {
    leaveLocal(ctx, room ? 'أُغلقت الغرفة' : 'خرجت من الغرفة');
    return;
  }
  const prev = o.room;
  o.room = room;
  o.players = players || [];
  if (room.round && (!o.secret || o.secret.round !== room.round)) {
    const { data: secret } = await c.from('spy_room_secrets').select('round, kind, place, role, word').eq('room_id', room.id).maybeSingle();
    o.secret = secret;
  }
  if (prev.status !== room.status) onStatusChange(prev.status, room.status);
  if (getState().screen === 'online-room') ctx.render();
}

function onStatusChange(from, to) {
  if (to === 'playing') {
    o.calledVote = false;
    o.myVote = null;
    o.guessSel = null;
    play('reveal');
    vibrate(30);
  }
  if (to === 'voting') vibrate(60);
  if (to === 'guess' || to === 'result') {
    play('stamp');
    vibrate([40, 30, 80]);
  }
}

async function enterRoom(ctx, room) {
  o.room = { id: room.id, code: room.code, status: 'lobby' };
  o.secret = null;
  setState({ online: { roomId: room.id, code: room.code } });
  arm();
  ctx.navigate('online-room');
  await refresh(ctx);
  subscribe(ctx);
}

async function subscribe(ctx) {
  const c = await getClient();
  unsubscribe(c);
  const id = o.room.id;
  o.channel = c
    .channel('room:' + id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'spy_rooms', filter: `id=eq.${id}` }, () => refresh(ctx))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'spy_room_players', filter: `room_id=eq.${id}` }, () => refresh(ctx))
    .subscribe();
  // Safety net if the realtime socket drops (mobile networks, backgrounded tab).
  clearInterval(o.poll);
  o.poll = setInterval(() => {
    if (document.visibilityState === 'visible' && navigator.onLine) refresh(ctx).catch(() => {});
  }, 5000);
}

function unsubscribe(c) {
  clearInterval(o.poll);
  if (o.channel && c) c.removeChannel(o.channel);
  o.channel = null;
}

async function leaveLocal(ctx, message) {
  const c = await getClient().catch(() => null);
  unsubscribe(c);
  clearInterval(o.tick);
  o.room = null;
  o.players = [];
  o.secret = null;
  setState({ online: null });
  if (message) toast(message, 'close');
  ctx.navigate('online');
}

async function resumeRoom(ctx) {
  const saved = getState().online;
  if (!saved?.roomId || o.room || !navigator.onLine) return;
  try {
    await connect();
    o.room = { id: saved.roomId, code: saved.code, status: 'lobby' };
    await refresh(ctx);
    if (o.room) {
      ctx.navigate('online-room');
      subscribe(ctx);
    }
  } catch {
    o.room = null;
    setState({ online: null });
  }
}

async function loadProfileData(ctx) {
  if (!navigator.onLine) return;
  try {
    await connect();
    const c = await getClient();
    const [stats, packs] = await Promise.all([fetchStats(c, o.me.id), listCustomPacks(c)]);
    o.stats = stats;
    o.customPacks = packs;
    cacheCustomPacks(packs, ctx);
    if (!o.me.is_anonymous) {
      const data = await pullUserData(c, o.me.id);
      const s = getState();
      if (data && !s.players.length && data.players?.length) setState({ players: data.players, settings: { ...s.settings, ...data.settings } });
    }
  } catch (e) {
    o.customPacks = o.customPacks || [];
    o.error = errorText(e.code ? e : toError(e));
  }
  if (getState().screen === 'online-profile') ctx.render();
}

// ------------------------------------------------------------------ actions

function readName(form) {
  const name = cleanName(form.elements.name.value);
  if (!name || [...name].length > MAX_NAME) {
    o.error = `اكتب اسماً من 1 إلى ${MAX_NAME} حرفاً.`;
    return null;
  }
  setProfile({ name });
  return name;
}

export async function submit(kind, form, ctx) {
  o.error = '';
  if (kind === 'ol-join') {
    const code = String(form.elements.code.value || '').toUpperCase().replace(/[^A-Z]/g, '');
    const name = readName(form);
    if (code.length !== 4) o.error = 'رمز الغرفة 4 أحرف.';
    if (o.error || !name) return ctx.render();
    ctx.ui.joinCode = code;
    return withBusy(ctx, async () => {
      await connect();
      const room = await rpc('spy_join_room', { p_code: code, p_name: name, p_avatar: profile().avatar });
      ctx.ui.joinCode = '';
      await enterRoom(ctx, room);
    });
  }
  if (kind === 'ol-create') {
    const name = readName(form);
    if (!name) return ctx.render();
    const packId = o.create.packId || getState().packId || ctx.packs[0].id;
    const pack = ctx.packById(packId);
    return withBusy(ctx, async () => {
      await connect();
      const room = await rpc('spy_create_room', { p_name: name, p_avatar: profile().avatar, p_pack: packId, p_mode: pack?.mode || 'places', p_minutes: o.create.minutes });
      await enterRoom(ctx, room);
    });
  }
  if (kind === 'ol-profile') {
    if (!readName(form)) return ctx.render();
    toast('تم الحفظ');
    if (navigator.onLine) {
      try {
        await connect();
        await saveProfile(await getClient(), o.me.id, profile());
      } catch {
        /* saved locally anyway */
      }
    }
    return ctx.render();
  }
  if (kind === 'ol-otp-send') {
    const email = String(form.elements.email.value || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      o.error = 'اكتب بريداً صحيحاً.';
      return ctx.render();
    }
    return withBusy(ctx, async () => {
      await connect();
      o.otp = { email, type: await sendEmailCode(email) };
    });
  }
  if (kind === 'ol-otp-verify') {
    const token = String(form.elements.token.value || '').trim();
    return withBusy(ctx, async () => {
      await verifyEmailCode(o.otp.email, token, o.otp.type);
      o.otp = { email: '', type: null };
      o.me = await currentUser();
      const c = await getClient();
      await saveProfile(c, o.me.id, profile()).catch(() => {});
      schedulePush(c, o.me.id);
      toast('تم حفظ حسابك');
      loadProfileData(ctx);
    });
  }
  if (kind === 'ol-pack-save') {
    const name = cleanName(form.elements.name.value).slice(0, 30);
    const mode = o.edit?.mode || 'places';
    const seen = new Set();
    const items = String(form.elements.items.value || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 150)
      .map((line, i) => {
        if (mode === 'places') {
          const [place, roles = ''] = line.split(/[:：]/);
          return { id: 'i' + (i + 1), name_ar: cleanName(place).slice(0, 40), roles_ar: roles.split(/[،,]/).map((x) => cleanName(x).slice(0, 40)).filter(Boolean).slice(0, 12) };
        }
        return { id: 'i' + (i + 1), name_ar: cleanName(line).slice(0, 40) };
      })
      .filter((it) => it.name_ar && !seen.has(normalizeName(it.name_ar)) && seen.add(normalizeName(it.name_ar)));
    o.edit = { ...o.edit, name_ar: name, text: form.elements.items.value };
    if (!name) o.error = 'اكتب اسم الملف.';
    else if (items.length < 3) o.error = 'أضف 3 عناصر مختلفة على الأقل.';
    if (o.error) return ctx.render();
    return withBusy(ctx, async () => {
      await connect();
      const c = await getClient();
      await saveCustomPack(c, { id: o.edit.id, name_ar: name, mode, items });
      o.customPacks = await listCustomPacks(c);
      cacheCustomPacks(o.customPacks, ctx);
      o.edit = null;
      toast('تم حفظ الملف — تجده في قائمة الملفات');
      ctx.navigate('online-profile');
    });
  }
}

export async function action(name, el, ctx) {
  const r = o.room;
  switch (name) {
    case 'ol-pick-pack':
      o.create.packId = el.dataset.id;
      return ctx.render();
    case 'ol-minutes':
      o.create.minutes = Number(el.dataset.v);
      return ctx.render();
    case 'ol-avatar':
      setProfile({ avatar: el.dataset.v });
      return ctx.render();
    case 'ol-start':
      return withBusy(ctx, async () => {
        await rpc('spy_start_round', { p_room: r.id });
        await refresh(ctx);
      });
    case 'ol-call-vote':
      return withBusy(ctx, async () => {
        await rpc('spy_call_vote', { p_room: r.id });
        await refresh(ctx);
      });
    case 'ol-vote':
      o.myVote = el.dataset.id;
      o.voteRound = r.round;
      vibrate(10);
      ctx.render();
      return withBusy(ctx, async () => {
        await rpc('spy_cast_vote', { p_room: r.id, p_target: el.dataset.id });
        await refresh(ctx);
      });
    case 'ol-close-vote':
      return withBusy(ctx, async () => {
        await rpc('spy_close_vote', { p_room: r.id });
        await refresh(ctx);
      });
    case 'ol-guess-pick':
      o.guessSel = Number(el.dataset.i);
      return ctx.render();
    case 'ol-guess':
      return withBusy(ctx, async () => {
        await rpc('spy_submit_guess', { p_room: r.id, p_guess: r.options[o.guessSel] });
        await refresh(ctx);
      });
    case 'ol-share': {
      const url = el.dataset.link;
      try {
        if (navigator.share) await navigator.share({ title: 'مين الجاسوس؟', text: `ادخل غرفتي في «مين الجاسوس؟» — الرمز ${r.code}`, url });
        else throw new Error('no share');
      } catch (e) {
        if (e?.name !== 'AbortError') copy(url);
      }
      return;
    }
    case 'ol-copy':
      return copy(el.dataset.link);
    case 'ol-leave':
      if (!(await confirmModal('الخروج من الغرفة؟', 'تقدر ترجع بنفس الرمز ما دامت الجولة لم تبدأ.', 'خروج', 'بقاء'))) return;
      try {
        await rpc('spy_leave_room', { p_room: r.id });
      } catch {
        /* leave function may be pending deployment; leaving locally is enough */
      }
      return leaveLocal(ctx);
    case 'ol-signout':
      await signOut();
      o.me = null;
      o.stats = null;
      o.customPacks = null;
      toast('تم تسجيل الخروج');
      return ctx.navigate('online');
    case 'ol-new-pack':
      o.edit = { name_ar: '', mode: 'places', text: '' };
      o.error = '';
      return ctx.navigate('online-pack');
    case 'ol-edit-pack': {
      const p = o.customPacks[Number(el.dataset.i)];
      o.edit = {
        id: p.id,
        name_ar: p.name_ar,
        mode: p.mode,
        text: p.items.map((it) => (p.mode === 'places' && it.roles_ar?.length ? `${it.name_ar}: ${it.roles_ar.join('، ')}` : it.name_ar)).join('\n'),
      };
      o.error = '';
      return ctx.navigate('online-pack');
    }
    case 'ol-pack-mode':
      o.edit = { ...o.edit, mode: el.dataset.v, text: $('#pk-items')?.value || o.edit.text, name_ar: $('#pk-name')?.value || o.edit.name_ar };
      return ctx.render();
    case 'ol-del-pack': {
      const p = o.customPacks[Number(el.dataset.i)];
      if (!(await confirmModal('حذف الملف؟', `سيُحذف «${p.name_ar}» نهائياً.`, 'حذف', 'إلغاء'))) return;
      return withBusy(ctx, async () => {
        const c = await getClient();
        await deleteCustomPack(c, p.id);
        o.customPacks = await listCustomPacks(c);
        cacheCustomPacks(o.customPacks, ctx);
      });
    }
  }
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('تم نسخ الرابط', 'copy');
  } catch {
    toast(text, 'link');
  }
}

export function back(s, ctx) {
  o.error = '';
  if (s.screen === 'online-room') {
    action('ol-leave', null, ctx);
    return true;
  }
  if (s.screen === 'online-pack') {
    ctx.navigate('online-profile');
    return true;
  }
  if (s.screen === 'online-create' || s.screen === 'online-profile') {
    ctx.navigate('online');
    return true;
  }
  return false;
}

export function netChanged(online, ctx) {
  if (getState().screen.startsWith('online')) {
    ctx.render();
    if (online && o.room) refresh(ctx).catch(() => {});
  }
}

// Push player list / settings changes to the cloud for signed-in users.
export async function syncUp() {
  if (!o.me || o.me.is_anonymous || !navigator.onLine) return;
  schedulePush(await getClient(), o.me.id);
}
