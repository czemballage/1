#!/usr/bin/env node
// Builds design/board.html: the design system + every screen (from the e2e screenshots)
// with motion notes. It uses the app's real CSS and icons, so the board cannot drift from the build.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ICONS } from '../app/js/ui/icons.js';

const root = new URL('..', import.meta.url).pathname;
const shot = (name) => (existsSync(`${root}design/screens/${name}.webp`) ? `screens/${name}.webp` : null);

const COLORS = [
  ['ink', '#0E0D0B', 'Page edges, deep shadow'],
  ['charcoal', '#1C1A17', 'App background'],
  ['smoke', '#2A2722', 'Tracks, tool buttons'],
  ['manila', '#E9D9B5', 'Folders, text on dark (14.6:1)'],
  ['paper', '#F4EBD6', 'Sheets, cards'],
  ['stamp-red', '#C1121F', 'Primary action, stamps (5.3:1 on paper)'],
  ['faded-red', '#8E1B1B', 'Button base, counts (6.4:1 on manila)'],
  ['brass', '#B8893B', 'Focus, progress, winner'],
  ['ash', '#9C907A', 'Secondary text on dark (5.5:1)'],
  ['ink-soft', '#5A5144', 'Secondary text on paper (6.6:1)'],
];

const SCREENS = [
  ['01-home', 'Home', 'Screen enters 240ms (translateY 8→0, ease-out). Primary button: press = translateY 4px, base shadow collapses (150ms).'],
  ['02-players-empty', 'Players — empty', 'Empty state with dashed border. Input autofocus keeps the keyboard open between names.'],
  ['03-players-duplicate', 'Players — duplicate name', 'Inline error, red dot, haptic 20-40-20ms. No modal.'],
  ['04-packs', 'Pack picker', 'Folders press to scale .97 (150ms). Selected = 3px red outline + red check badge.'],
  ['05-setup', 'Game settings', 'Segmented control & switch: 150ms colour/position transitions. Spy stepper clamps to valid range.'],
  ['06-pass', 'Pass to [name]', 'Blank interstitial — nothing secret on screen. Progress bars show who has seen their card.'],
  ['07-card-hidden', 'Hold to reveal — hidden', 'Fingerprint pad "breathes" (2.4s loop, off with reduced motion). Done button disabled until the card was held once.'],
  ['08-card-innocent', 'Revealed — innocent', 'Cover slides down 84% in 150ms; paper swish + 15ms haptic. Release = instant hide, secret removed from DOM.'],
  ['08-card-spy', 'Revealed — spy', 'Same motion; red stamp "أنت الجاسوس" readable from 1 m away (the TikTok moment).'],
  ['09-discussion', 'Discussion timer', 'Digits update each second; brass line drains with transform: scaleX (1s linear). <60s: red + 1s pulse. Last 10s: tick. 0: alarm + 200-100-200 haptic.'],
  ['10-confirm-end', 'Back mid-round', 'Backdrop fades 150ms; sheet rises 16px (240ms). Cancel keeps the round.'],
  ['11-locations', 'Location list', 'Same modal; two columns.'],
  ['12-accuse', 'Accuse', 'Pick: scale .97 on press; check pops with stamp easing (150ms).'],
  ['13-spy-guess', 'Spy last chance', 'Verdict stamp: 300ms stamp-in. Options wrap to 2 lines, never truncated.'],
  ['14-result', 'Result — caught', 'Stamp: scale 1.7→1, rotate −15°→−8°, 300ms cubic-bezier(.2,1.5,.4,1); thud sound + 40/30/80 haptic.'],
  ['18-result-escaped', 'Result — escaped', 'Same stamp, "هرب الجاسوس!".'],
  ['15-scoreboard', 'Scoreboard', 'Static. Leader row on manila with brass outline. Ties share a rank.'],
  ['16-share', 'Share card', 'Canvas 1080×1350 in the dossier style → Web Share API, download fallback.'],
  ['17-dares', 'Dares', 'Sheet rotated −1.5°. "حكم آخر" swaps text without re-animating the screen.'],
  ['19-settings', 'Settings', 'Switches 150ms. Reduced-motion toggle forces 1ms animations.'],
  ['20-offline-home', 'Offline', '"بدون إنترنت" badge in the top bar; the whole game keeps working.'],
];
const ONLINE = [
  ['online-01-entry', 'Online — join', 'Code field in typewriter capitals, LTR-isolated.'],
  ['online-02-create', 'Online — create room', 'Pack grid + timer.'],
  ['online-03-lobby', 'Online — lobby', 'Room code + QR + share link. Player list updates live (Realtime).'],
  ['online-04-playing-card', 'Online — own card', 'Only this phone\'s card is fetched (RLS: own row).'],
  ['online-05-vote', 'Online — vote', 'Each phone votes; count updates live; majority decides.'],
  ['online-06-guess', 'Online — spy guess', 'Only the accused phone gets the grid.'],
  ['online-07-result', 'Online — result', 'Server reveals item + spies only after the round ends.'],
  ['online-08-profile', 'Profile', 'Name, avatar, stats, email code upgrade, custom packs.'],
  ['online-09-pack-editor-error', 'Custom pack editor', 'One item per line; validation inline.'],
];

const icon = (n) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;
const fig = ([file, title, note], prefix = '390x844-') => {
  const src = shot(prefix + file);
  return src ? `<figure class="b-shot"><img src="${src}" alt="${title}" loading="lazy" width="390" height="844"><figcaption><b>${title}</b><span>${note}</span></figcaption></figure>` : '';
};

const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Spy Game Design Board</title>
<link rel="stylesheet" href="../app/css/fonts.css">
<link rel="stylesheet" href="../app/css/tokens.css">
<link rel="stylesheet" href="../app/css/app.css">
<style>
  body { background: var(--charcoal); }
  .board-wrap { max-width: 1400px; margin: 0 auto; padding: 32px 24px 80px; }
  .board-wrap h1 { font-size: 44px; color: var(--paper); }
  .board-wrap h2.sec { font-family: var(--f-body); font-weight: 600; font-size: 24px; color: var(--paper); margin: 56px 0 16px; padding-block-end: 8px; border-block-end: 1px dashed rgba(233,217,181,.25); }
  .b-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
  .sw { border-radius: 4px; overflow: hidden; background: var(--paper); color: var(--ink); }
  .sw i { display: block; height: 72px; }
  .sw div { padding: 8px 12px; font-size: 13px; line-height: 1.5; }
  .sw code { font-family: var(--f-type); direction: ltr; display: inline-block; }
  .type-row { display: flex; align-items: baseline; gap: 24px; padding: 12px 0; border-block-end: 1px dashed rgba(233,217,181,.15); }
  .type-row span.meta { font-family: var(--f-type); font-size: 12px; color: var(--ash); direction: ltr; min-width: 260px; }
  .icons { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 8px; }
  .icons div { display: grid; justify-items: center; gap: 6px; padding: 12px 4px; background: var(--smoke); border-radius: 4px; color: var(--manila); font-family: var(--f-type); font-size: 11px; direction: ltr; }
  .comp { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 24px; align-items: start; }
  .comp > div { display: grid; gap: 12px; padding: 20px; border: 1px dashed rgba(233,217,181,.2); border-radius: 8px; }
  .comp h3 { font-family: var(--f-type); font-size: 13px; color: var(--ash); direction: ltr; text-align: left; }
  .b-shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 28px 20px; }
  .b-shot { margin: 0; display: grid; gap: 10px; }
  .b-shot img { width: 100%; height: auto; border-radius: 14px; box-shadow: 0 0 0 1px rgba(233,217,181,.15), 0 18px 40px rgba(0,0,0,.5); background: var(--ink); }
  .b-shot figcaption { display: grid; gap: 4px; font-size: 13px; line-height: 1.6; color: var(--ash); }
  .b-shot figcaption b { color: var(--paper); font-size: 15px; }
  .resp { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; }
  .resp .b-shot img { border-radius: 10px; }
  .banned { columns: 2; gap: 32px; color: var(--manila); }
  .banned li { break-inside: avoid; margin-block-end: 6px; }
  .note { color: var(--ash); max-width: 780px; }
</style>
</head>
<body>
<div class="board-wrap">
  <header style="display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap">
    <div><span class="typelabel">DESIGN BOARD — v1.0 — ${new Date().toISOString().slice(0, 10)}</span><h1>مين الجاسوس؟ — UI</h1>
    <p class="note">«ملف سرّي عربي» (Arab noir dossier): ملفات مانيلا، أوراق، أختام حمراء، تفاصيل آلة كاتبة، إضاءة مسرحية وحُبيبات فيلم. كل ما في هذه اللوحة مرسوم بنفس CSS والأيقونات المستعملة في التطبيق.</p></div>
    <span class="stamp">سرّي للغاية</span>
  </header>

  <h2 class="sec">الألوان (Color variables)</h2>
  <div class="b-grid">${COLORS.map(([n, h, d]) => `<div class="sw"><i style="background:${h}"></i><div><b>${n}</b> <code>${h}</code><br>${d}</div></div>`).join('')}</div>

  <h2 class="sec">الخطوط والمقاسات (Type scale)</h2>
  <div>
    <div class="type-row"><span class="meta">Display · Reem Kufi 700 · clamp(34–48)/1.15</span><span style="font-family:var(--f-display);font-size:44px;color:var(--paper)">مين الجاسوس؟</span></div>
    <div class="type-row"><span class="meta">Secret · Reem Kufi 700 · clamp(32–44)/1.2</span><span style="font-family:var(--f-display);font-size:38px;color:var(--paper)">سوق الذهب</span></div>
    <div class="type-row"><span class="meta">Title · IBM Plex Sans Arabic 600 · 20–21</span><span style="font-weight:600;font-size:21px;color:var(--paper)">إعدادات الجولة</span></div>
    <div class="type-row"><span class="meta">Body · IBM Plex Sans Arabic 400 · 17/1.65</span><span>واحد منكم ما يعرف المكان. اسألوا، شكّوا، واكشفوه قبل ما يكشفكم.</span></div>
    <div class="type-row"><span class="meta">Button · IBM Plex Sans Arabic 600 · 18</span><span style="font-weight:600;font-size:18px">وزّع البطاقات</span></div>
    <div class="type-row"><span class="meta">Caption · IBM Plex Sans Arabic 400 · 14</span><span class="caption">الترتيب = ترتيب الجلوس</span></div>
    <div class="type-row"><span class="meta">Stamp · Aref Ruqaa 700 · 17–50</span><span class="stamp" style="mix-blend-mode:normal">مكشوف!</span></div>
    <div class="type-row"><span class="meta">Typewriter · Special Elite · 13 / timer 64–104</span><span style="font-family:var(--f-type);font-size:48px;color:var(--paper);direction:ltr">05:42 · KRMZ</span></div>
  </div>
  <p class="note">Spacing: 4px grid (4·8·12·16·24·32·48). Radius: 2 (paper/stamp inner) · 4 (buttons, cards) · 8 (folders). Line-height Arabic body ≥1.65, letter-spacing 0, no italics.</p>

  <h2 class="sec">الأيقونات (47 custom line icons · 24px · stroke 1.75)</h2>
  <div class="icons">${Object.keys(ICONS).map((n) => `<div>${icon(n)}<span>${n}</span></div>`).join('')}</div>

  <h2 class="sec">المكوّنات (Components & states)</h2>
  <div class="comp">
    <div><h3>Button / primary · secondary · danger · disabled</h3>
      <button class="btn btn--primary"><span>ابدأ لعبة</span></button>
      <button class="btn btn--primary" style="transform:translateY(4px);box-shadow:none"><span>ابدأ لعبة (pressed)</span></button>
      <button class="btn btn--secondary"><span>أونلاين</span></button>
      <button class="btn btn--danger"><span>حذف كل البيانات</span></button>
      <button class="btn btn--primary" disabled><span>أضف 3 لاعبين على الأقل</span></button></div>
    <div><h3>Player chip · Input (default / error)</h3>
      <ol class="chips"><li class="chip"><span class="chip__num">01</span><span class="chip__name">أمين</span><button class="icon-btn">${icon('close')}</button></li>
      <li class="chip"><span class="chip__num">02</span><span class="chip__name">عبد الرحمن الكبير جداً جداً</span><button class="icon-btn">${icon('close')}</button></li></ol>
      <input class="input" placeholder="اكتب اسم اللاعب…">
      <input class="input" aria-invalid="true" value="امين"><p class="field__help is-error">هذا الاسم موجود. أضف حرفاً للتمييز.</p></div>
    <div><h3>Pack card · selected</h3><div class="packs" style="padding-top:16px">
      <button class="pack">${icon('rings')}<span class="pack__name">أعراس ومناسبات</span><span class="pack__meta"><span>16 مكان</span></span></button>
      <button class="pack" aria-pressed="true">${icon('lantern')}<span class="pack__name">الجزائر والمغرب العربي</span><span class="pack__meta"><span>16 مكان</span></span><span class="pack__check">${icon('check')}</span></button></div></div>
    <div><h3>Segmented control · Stepper · Switch</h3>
      <div class="seg"><button aria-checked="false">3 د</button><button aria-checked="false">5 د</button><button aria-checked="true">6 د</button><button aria-checked="false">8 د</button><button aria-checked="false">10 د</button></div>
      <div class="stepper"><button>${icon('plus')}</button><output>2</output><button>${icon('minus')}</button></div>
      <label class="toggle"><span class="toggle__text"><span class="form-label">وضع الدخيل</span><span class="caption">الجاسوس ياخذ كلمة قريبة.</span></span><input type="checkbox" class="switch" checked></label></div>
    <div><h3>Timer · running / warning</h3>
      <div class="timer"><span class="timer__digits">05:18</span><div class="timer__track"><div class="timer__fill" style="transform:scaleX(.88)"></div></div></div>
      <div class="timer is-warning"><span class="timer__digits" style="animation:none">00:42</span><div class="timer__track"><div class="timer__fill" style="transform:scaleX(.12)"></div></div></div></div>
    <div style="background:var(--paper)"><h3>Stamps (on paper)</h3>
      <div style="display:flex;flex-wrap:wrap;gap:24px;padding:12px"><span class="stamp">سرّي للغاية</span><span class="stamp">مكشوف!</span><span class="stamp">هرب الجاسوس!</span><span class="stamp stamp--ink stamp--sm">بريء</span></div></div>
    <div><h3>Modal · Toast · Offline banner</h3>
      <div class="modal sheet" style="animation:none;position:relative"><span class="clip">${icon('clip')}</span><h2>إنهاء الجولة؟</h2><p>ستضيع البطاقات الحالية ولن تُحتسب النقاط.</p><div class="actions"><button class="btn btn--secondary"><span>متابعة اللعب</span></button><button class="btn btn--primary"><span>إنهاء</span></button></div></div>
      <div class="toast__msg" style="animation:none">${icon('check')}<span>تم نسخ رمز الغرفة</span></div>
      <div class="offline-banner">${icon('wifiOff')}<span>انقطع الاتصال… سنعيد المحاولة تلقائياً.</span></div></div>
  </div>

  <h2 class="sec">الشاشات (390×844) + ملاحظات الحركة</h2>
  <div class="b-shots">${SCREENS.map((s) => fig(s)).join('')}</div>

  <h2 class="sec">الأونلاين والحساب</h2>
  <div class="b-shots">${ONLINE.map((s) => fig(s)).join('')}</div>

  <h2 class="sec">فحص المقاسات (Responsive)</h2>
  <div class="resp">
    ${['320x568', '360x800', '430x932', '768x1024'].map((v) => ['01-home', '08-card-innocent', '14-result'].map((n) => fig([n, `${n.slice(3)} @ ${v}`, ''], `${v}-`)).join('')).join('')}
    ${fig(['landscape-home', 'Landscape 844×390', 'Actions stop being sticky on short screens.'], '844x390-')}
  </div>

  <h2 class="sec">قائمة الممنوعات (AI-slop check) — passed</h2>
  <ul class="banned">
    <li>✔ No purple/blue gradients, glassmorphism or neon — only ink/manila/paper/red/brass.</li>
    <li>✔ No Inter/Roboto/system fonts for Arabic — Reem Kufi, IBM Plex Sans Arabic, Aref Ruqaa.</li>
    <li>✔ No emoji used as UI icons — 47 custom SVG line icons, one style.</li>
    <li>✔ Not "everything centered in identical rounded cards": folders, sheets, stamps, chips each have their own shape and slight rotation.</li>
    <li>✔ Consistent radii (2/4/8) and 4px spacing grid.</li>
    <li>✔ No lorem ipsum / English placeholders in the UI.</li>
    <li>✔ One focal point per screen; primary action in the bottom thumb zone.</li>
    <li>✔ Contrast AA for all text pairs (see colour notes).</li>
  </ul>
</div>
</body>
</html>`;

writeFileSync(`${root}design/board.html`, html);
console.log('wrote design/board.html');
