// Round screens, driven only by round.phase (+ revealStep).
import { esc, pad2, topbar, btn, stamp } from './dom.js';
import { icon } from './icons.js';
import { remainingMs } from '../game.js';

export function roundScreen(s, ctx) {
  const r = s.round;
  switch (r.phase) {
    case 'reveal':
      return r.revealStep === 'pass' ? passScreen(r) : cardScreen(r);
    case 'discussion':
      return discussionScreen(r);
    case 'vote':
      return accuseScreen(r, ctx);
    case 'spyGuess':
      return guessScreen(r, ctx);
    case 'result':
      return resultScreen(r, s);
    default:
      return '';
  }
}

function dots(r) {
  return `<div class="progress-dots" aria-hidden="true">${r.order
    .map((_, k) => `<i class="${k < r.revealPos ? 'is-done' : k === r.revealPos ? 'is-now' : ''}"></i>`)
    .join('')}</div>`;
}

function passScreen(r) {
  const card = r.cards[r.order[r.revealPos]];
  return `<section class="screen" data-screen="pass">
    ${topbar({ title: '', meta: `${pad2(r.revealPos + 1)} / ${pad2(r.order.length)}` })}
    <div class="pass">
      <div class="pass__envelope" aria-hidden="true"><div class="folder"></div>${stamp('سرّي', { size: 'sm' })}</div>
      <p class="pass__lead">سلّم الهاتف إلى</p>
      <p class="pass__name">${esc(card.name)}</p>
      ${dots(r)}
      <p class="caption">الباقون: لا تنظروا للشاشة</p>
    </div>
    <div class="screen__actions">
      ${btn(`أنا ${card.name}`, 'reveal-next', { ic: 'user' })}
    </div>
  </section>`;
}

function cardScreen(r) {
  const card = r.cards[r.order[r.revealPos]];
  return `<section class="screen" data-screen="card">
    ${topbar({ title: card.name, back: true, meta: `${pad2(r.revealPos + 1)} / ${pad2(r.order.length)}` })}
    <div class="reveal-wrap">
      <div class="reveal-card" id="reveal-card" tabindex="0" role="button" aria-label="اضغط مطوّلاً لكشف بطاقتك" aria-describedby="hold-note">
        <div class="reveal-card__inside sheet" id="secret" aria-live="polite"></div>
        <div class="reveal-card__cover folder">
          <span class="fp-pad">${icon('fingerprint', { size: 64 })}</span>
          <span class="fp-label">اضغط مطوّلاً لكشف بطاقتك</span>
          <span class="secret__hint">ارفع إصبعك لتخفيها</span>
        </div>
      </div>
    </div>
    <p class="hold-note" id="hold-note">لا تخلّي أحد يشوف بطاقتك</p>
    <div class="screen__actions">
      ${btn('خبّأت البطاقة', 'reveal-next', { ic: 'check', disabled: !r.seen, attrs: 'id="card-done"' })}
    </div>
  </section>`;
}

/** Secret markup is only put in the DOM while the card is held. */
export function secretHTML(r) {
  const card = r.cards[r.order[r.revealPos]];
  if (card.kind === 'spy') {
    const hint = r.mode === 'places' ? 'اسمع الأسئلة جيداً وحاول تعرف المكان.' : 'اسمع جيداً وحاول تعرف الكلمة.';
    return `<span class="secret__spy-icon">${icon('spy', { size: 64 })}</span>
      ${stamp('أنت الجاسوس', { size: '' })}
      <p class="secret__hint">${hint}</p>`;
  }
  if (card.kind === 'place') {
    return `<span class="secret__label">المكان</span>
      <p class="secret__big">${esc(card.place)}</p>
      ${card.role ? `<span class="secret__label">دورك</span><span class="secret__role">${esc(card.role)}</span>` : ''}`;
  }
  return `<span class="secret__label">الكلمة</span><p class="secret__big">${esc(card.word)}</p>`;
}

export function timerParts(r, now = Date.now()) {
  const ms = remainingMs(r, now);
  const total = r.minutes * 60000;
  const sec = Math.ceil(ms / 1000);
  return { ms, text: `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`, frac: total ? ms / total : 0, warning: ms <= 60000, paused: r.remainingMs != null };
}

function discussionScreen(r) {
  const t = timerParts(r);
  const asker = r.cards[r.firstAsker];
  return `<section class="screen" data-screen="discussion">
    ${topbar({ title: 'النقاش' })}
    <div class="screen__body">
      <div class="sheet asker">
        ${icon('user', { size: 28 })}
        <div class="asker__text"><span class="caption" style="color:var(--ink-soft)">يبدأ بالسؤال</span><p class="asker__name">${esc(asker.name)}</p></div>
      </div>
      <div class="timer ${t.warning ? 'is-warning' : ''} ${t.paused ? 'is-paused' : ''}" id="timer" role="timer" aria-live="off">
        <span class="timer__digits" id="timer-digits">${t.text}</span>
        <div class="timer__track"><div class="timer__fill" id="timer-fill" style="transform:scaleX(${t.frac.toFixed(4)})"></div></div>
        <span class="caption" id="timer-cap">${t.paused ? 'متوقّف مؤقتاً' : t.warning ? 'آخر دقيقة!' : 'اسألوا بعض أسئلة ذكية'}</span>
      </div>
      <div class="timer-tools">
        <button class="tool-btn" data-action="${t.paused ? 'resume-timer' : 'pause-timer'}">${icon(t.paused ? 'play' : 'pause', { size: 20 })}<span>${t.paused ? 'استئناف' : 'إيقاف مؤقت'}</span></button>
        <button class="tool-btn" data-action="show-locations">${icon('list', { size: 20 })}<span>${r.mode === 'places' ? 'الأماكن' : 'الكلمات'}</span></button>
      </div>
    </div>
    <div class="screen__actions">
      ${btn('صوّتوا الآن', 'vote-now', { ic: 'users' })}
    </div>
  </section>`;
}

function accuseScreen(r, ctx) {
  const sel = ctx.ui.accuseSel;
  const name = sel != null ? r.cards[sel].name : '';
  return `<section class="screen" data-screen="vote">
    ${topbar({ title: 'التصويت' })}
    <div class="screen__body">
      <h2 class="headline">مين الجاسوس؟</h2>
      <p class="lead">اتّفقوا على اسم واحد، ثم أكّدوا الاتهام.</p>
      <ul class="pick-grid">
        ${r.cards
          .map((c, i) => `<li><button class="pick" data-action="accuse-pick" data-i="${i}" aria-pressed="${sel === i}"><span>${esc(c.name)}</span>${icon('check', { size: 20 })}</button></li>`)
          .join('')}
      </ul>
    </div>
    <div class="screen__actions">
      ${btn(sel != null ? `اتّهم ${name}` : 'اختر المتّهم', 'accuse-confirm', { disabled: sel == null, kind: 'primary' })}
    </div>
  </section>`;
}

function guessScreen(r, ctx) {
  const spy = r.cards[r.accused];
  const sel = ctx.ui.guessSel;
  const what = r.mode === 'places' ? 'المكان' : 'الكلمة';
  return `<section class="screen" data-screen="guess">
    ${topbar({ title: 'فرصة أخيرة' })}
    <div class="screen__body">
      <div>${stamp('مكشوف!', { size: '', animate: true })}</div>
      <h2 class="headline">${esc(spy.name)} جاسوس!</h2>
      <p class="lead">سلّموه الهاتف. إذا خمّن ${what} صح، يفوز الجواسيس.</p>
      <ul class="pick-grid pick-grid--options">
        ${r.options
          .map((o, i) => `<li><button class="pick" data-action="guess-pick" data-i="${i}" aria-pressed="${sel === i}"><span>${esc(o)}</span>${icon('check', { size: 18 })}</button></li>`)
          .join('')}
      </ul>
    </div>
    <div class="screen__actions">
      ${btn(sel != null ? `تخميني: ${r.options[sel]}` : `اختر ${what}`, 'guess-confirm', { disabled: sel == null })}
    </div>
  </section>`;
}

const OUTCOME = {
  escaped: { stamp: 'هرب الجاسوس!', line: (r) => `اتّهمتم ${r.cards[r.accused]?.name || 'بريئاً'} وهو بريء.` },
  guessed: { stamp: 'هرب الجاسوس!', line: (r) => `انكشف الجاسوس لكنه خمّن ${r.mode === 'places' ? 'المكان' : 'الكلمة'} صح.` },
  caught: { stamp: 'مكشوف!', line: (r) => `انكشف الجاسوس وخمّن «${r.guess}».` },
};

function resultScreen(r, s) {
  const o = OUTCOME[r.outcome];
  const spies = r.spies.map((i) => r.cards[i].name);
  const winners = Object.entries(r.points).filter(([, p]) => p > 0);
  const what = r.mode === 'places' ? 'المكان' : 'الكلمة';
  return `<section class="screen" data-screen="result">
    ${topbar({ title: `الجولة ${s.session.rounds}`, back: true })}
    <div class="screen__body">
      <article class="sheet result">
        <div class="result__stamp">${stamp(o.stamp, { size: 'xl', animate: true })}</div>
        <span class="caption" style="color:var(--ink-soft)">${what} كان</span>
        <p class="result__item">${esc(r.item.name)}</p>
        <dl>
          <div class="kv"><dt>${spies.length > 1 ? 'الجواسيس' : 'الجاسوس'}</dt><dd>${esc(spies.join(' و '))}</dd></div>
          ${r.imposter && r.closeWord ? `<div class="kv"><dt>كلمة الدخيل</dt><dd>${esc(r.closeWord)}</dd></div>` : ''}
          <div class="kv"><dt>ماذا حدث</dt><dd>${esc(o.line(r))}</dd></div>
        </dl>
        <ul class="points" aria-label="نقاط الجولة">
          ${winners.map(([n, p]) => `<li><span>${esc(n)}</span><b>+${p}</b></li>`).join('')}
        </ul>
      </article>
    </div>
    <div class="screen__actions">
      ${btn('جولة أخرى', 'again', { ic: 'refresh' })}
      <div class="row-2">
        ${btn('النتائج', 'go', { kind: 'secondary', ic: 'trophy', attrs: 'data-to="scoreboard"' })}
        ${s.settings.dares ? btn('حكم للخاسر', 'go', { kind: 'secondary', ic: 'card', attrs: 'data-to="dares"' }) : btn('شارك', 'go', { kind: 'secondary', ic: 'share', attrs: 'data-to="share"' })}
      </div>
    </div>
  </section>`;
}
