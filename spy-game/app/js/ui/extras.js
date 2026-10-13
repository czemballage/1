// Scoreboard, dares, share card and app settings.
import { esc, topbar, btn, stamp } from './dom.js';
import { icon } from './icons.js';
import { ranking } from '../game.js';
import { toggleRow } from './setup.js';

export function boardRows(s) {
  const names = [...new Set([...s.players, ...Object.keys(s.session.scores)])];
  return ranking(s.session.scores, names);
}

export function scoreboardScreen(s) {
  const rows = boardRows(s);
  const has = s.session.rounds > 0;
  return `<section class="screen">
    ${topbar({ title: 'لوحة النتائج', meta: has ? `${s.session.rounds} ROUNDS` : '' })}
    <div class="screen__body">
      ${
        has
          ? `<ol class="board">${rows
              .map((r) => `<li><span class="board__rank">${r.rank}</span><span class="board__name">${esc(r.name)}</span><span class="board__pts">${r.points}</span></li>`)
              .join('')}</ol>
             <p class="caption">الجاسوس الناجي: +2 · خمّن المكان: +2 · كشفتم الجاسوس: +1 لكل بريء</p>`
          : `<div class="empty">${icon('trophy', { size: 40 })}<p>ما في نتائج بعد.<br>العبوا جولة وارجعوا هنا.</p></div>`
      }
    </div>
    <div class="screen__actions">
      ${s.round?.phase === 'result' ? btn('جولة أخرى', 'again', { ic: 'refresh' }) : btn('ابدأ لعبة', 'start')}
      ${has ? `<div class="row-2">${btn('شارك النتيجة', 'go', { kind: 'secondary', ic: 'share', attrs: 'data-to="share"' })}${btn('تصفير', 'reset-scores', { kind: 'secondary', ic: 'trash' })}</div>` : ''}
    </div>
  </section>`;
}

export function daresScreen(s, ctx) {
  const r = s.round;
  let who = '';
  if (r?.outcome) {
    who = r.outcome === 'caught' ? r.cards[r.accused].name : 'الأبرياء';
  }
  return `<section class="screen">
    ${topbar({ title: 'الحكم' })}
    <div class="screen__body">
      ${who ? `<p class="lead">الحكم على: <b style="color:var(--paper)">${esc(who)}</b></p>` : ''}
      <article class="sheet dare" aria-live="polite">
        <span class="clip">${icon('clip', { size: 34 })}</span>
        ${stamp('حكم', { size: 'sm' })}
        <p class="dare__text">${esc(ctx.ui.dare || '')}</p>
      </article>
    </div>
    <div class="screen__actions">
      ${btn('تم!', 'dare-done', { ic: 'check' })}
      ${btn('حكم آخر', 'dare-next', { kind: 'secondary', ic: 'refresh' })}
    </div>
  </section>`;
}

export function shareScreen() {
  return `<section class="screen">
    ${topbar({ title: 'شارك النتيجة' })}
    <div class="screen__body screen__body--center">
      <canvas id="share-canvas" class="share-preview" width="1080" height="1350" role="img" aria-label="بطاقة النتيجة"></canvas>
    </div>
    <div class="screen__actions">
      ${btn('شارك', 'share-now', { ic: 'share' })}
      ${btn('حفظ الصورة', 'share-download', { kind: 'secondary', ic: 'download' })}
    </div>
  </section>`;
}

export function prefsScreen(s, ctx) {
  const p = s.prefs;
  return `<section class="screen">
    ${topbar({ title: 'الإعدادات' })}
    <div class="screen__body">
      <button class="tool-btn account-link" data-action="go" data-to="online-profile">${icon('user', { size: 22 })}<span>حسابي وتسجيل الدخول</span>${icon('next', { size: 18 })}</button>
      <div>
        ${toggleRow('sound', 'الأصوات', 'صوت الختم وعدّاد الوقت.', p.sound, 'pref')}
        ${toggleRow('haptics', 'الاهتزاز', 'اهتزاز خفيف عند كشف البطاقة والنتيجة.', p.haptics, 'pref')}
        ${toggleRow('reducedMotion', 'تقليل الحركة', 'إيقاف الحركات والانتقالات.', p.reducedMotion === 'on', 'pref')}
        ${toggleRow('dares', 'أحكام للخاسر', 'تظهر بعد كل جولة.', s.settings.dares, 'toggle')}
      </div>
      ${ctx.storageOk ? '' : `<div class="offline-banner">${icon('lock', { size: 20 })}<span>الحفظ غير متاح في هذا المتصفح (وضع التصفّح الخاص؟). اللعبة تعمل، لكن لن تُحفظ الأسماء.</span></div>`}
      <p class="caption">نسخة المحتوى ${ctx.contentVersion} · ${ctx.packs.length} ملفات · ${ctx.packs.reduce((n, x) => n + x.items.length, 0)} عنصر</p>
    </div>
    <div class="screen__actions">
      ${btn('حذف كل البيانات', 'reset-all', { kind: 'danger', ic: 'trash' })}
    </div>
  </section>`;
}

// ------------------------------------------------------------------ share card (canvas)

function noisePattern(ctx2d) {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d');
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 22;
  }
  g.putImageData(img, 0, 0);
  return ctx2d.createPattern(c, 'repeat');
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function fitText(g, text, maxW, size, weight, family) {
  let s = size;
  do {
    g.font = `${weight} ${s}px ${family}`;
    s -= 2;
  } while (g.measureText(text).width > maxW && s > 18);
  return text;
}

export async function drawShareCard(canvas, s) {
  const g = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  try {
    await Promise.all([
      document.fonts.load('700 60px "Reem Kufi"'),
      document.fonts.load('400 30px "IBM Plex Sans Arabic"'),
      document.fonts.load('600 30px "IBM Plex Sans Arabic"'),
      document.fonts.load('700 60px "Aref Ruqaa"'),
      document.fonts.load('400 30px "Special Elite"'),
    ]);
  } catch {
    /* draw with fallbacks */
  }
  const C = { ink: '#0E0D0B', charcoal: '#1C1A17', manila: '#E9D9B5', paper: '#F4EBD6', red: '#C1121F', faded: '#8E1B1B', brass: '#B8893B', soft: '#5A5144' };
  const bg = g.createRadialGradient(W / 2, 0, 50, W / 2, 200, H);
  bg.addColorStop(0, '#2c2823');
  bg.addColorStop(0.45, C.charcoal);
  bg.addColorStop(1, C.ink);
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  g.direction = 'rtl';
  g.textAlign = 'right';
  g.textBaseline = 'alphabetic';

  // header
  g.fillStyle = '#9C907A';
  g.font = '400 30px "Special Elite", monospace';
  g.textAlign = 'left';
  g.direction = 'ltr';
  g.fillText(`FILE Nº ${String(s.session.rounds).padStart(2, '0')} — TOP SECRET`, 80, 110);
  g.direction = 'rtl';
  g.textAlign = 'right';

  // folder
  g.save();
  g.translate(W / 2, 650);
  g.rotate((-1.5 * Math.PI) / 180);
  g.fillStyle = C.manila;
  roundRect(g, -460, -470, 920, 950, 18);
  g.fill();
  roundRect(g, 60, -515, 400, 70, 14);
  g.fill();
  // sheet
  g.rotate((2.5 * Math.PI) / 180);
  g.fillStyle = C.paper;
  g.shadowColor = 'rgba(0,0,0,.35)';
  g.shadowBlur = 30;
  g.shadowOffsetY = 12;
  g.fillRect(-410, -420, 820, 840);
  g.shadowColor = 'transparent';
  const x0 = 360;
  g.fillStyle = C.ink;
  g.font = '700 84px "Reem Kufi", sans-serif';
  g.fillText('مين الجاسوس؟', x0, -330);

  const r = s.round;
  const spies = r && r.spies ? r.spies.map((i) => r.cards[i].name).join(' و ') : '—';
  g.fillStyle = C.soft;
  g.font = '400 34px "IBM Plex Sans Arabic", sans-serif';
  g.fillText(r && r.spies && r.spies.length > 1 ? 'الجواسيس كانوا' : 'الجاسوس كان', x0, -240);
  g.fillStyle = C.ink;
  fitText(g, spies, 720, 64, 700, '"Reem Kufi", sans-serif');
  g.fillText(spies, x0, -165);
  if (r && r.item) {
    g.fillStyle = C.soft;
    g.font = '400 32px "IBM Plex Sans Arabic", sans-serif';
    g.fillText(`${r.mode === 'places' ? 'المكان' : 'الكلمة'}: ${r.item.name}`, x0, -105);
  }

  // dashed rule
  g.strokeStyle = 'rgba(14,13,11,.3)';
  g.setLineDash([10, 10]);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x0, -70);
  g.lineTo(-x0, -70);
  g.stroke();
  g.setLineDash([]);

  const rows = boardRows(s).slice(0, 5);
  rows.forEach((row, i) => {
    const y = -10 + i * 68;
    if (i === 0) {
      g.fillStyle = C.manila;
      g.fillRect(-x0 - 10, y - 46, 2 * x0 + 20, 62);
    }
    g.fillStyle = C.soft;
    g.font = '400 32px "Special Elite", monospace';
    g.fillText(String(row.rank), x0, y);
    g.fillStyle = C.ink;
    g.font = '600 38px "IBM Plex Sans Arabic", sans-serif';
    let name = row.name;
    while (g.measureText(name).width > 520 && name.length > 2) name = name.slice(0, -1);
    g.fillText(name === row.name ? name : name + '…', x0 - 60, y);
    g.textAlign = 'left';
    g.font = '700 44px "Reem Kufi", sans-serif';
    g.fillText(String(row.points), -x0, y);
    g.textAlign = 'right';
  });

  // stamp
  g.save();
  g.translate(-150, 335);
  g.scale(0.85, 0.85);
  g.rotate((-10 * Math.PI) / 180);
  g.strokeStyle = C.red;
  g.fillStyle = C.red;
  g.globalAlpha = 0.88;
  g.lineWidth = 8;
  roundRect(g, -200, -70, 400, 120, 8);
  g.stroke();
  g.lineWidth = 3;
  roundRect(g, -184, -54, 368, 88, 4);
  g.stroke();
  g.textAlign = 'center';
  g.font = '700 64px "Aref Ruqaa", serif';
  const label = r?.outcome === 'caught' ? 'مكشوف!' : r?.outcome ? 'هرب الجاسوس!' : 'سرّي للغاية';
  fitText(g, label, 340, 64, 700, '"Aref Ruqaa", serif');
  g.fillText(label, 0, 12);
  g.restore();
  g.restore();

  // grain
  g.fillStyle = noisePattern(g);
  g.fillRect(0, 0, W, H);

  // footer
  g.fillStyle = C.manila;
  g.textAlign = 'center';
  g.font = '600 34px "IBM Plex Sans Arabic", sans-serif';
  g.fillText('العبوها الليلة — هاتف واحد ومن 3 إلى 12 لاعب', W / 2, H - 120);
  g.fillStyle = '#9C907A';
  g.direction = 'ltr';
  g.font = '400 28px "Special Elite", monospace';
  g.fillText(location.host || 'meen-aljasoos', W / 2, H - 70);
}

export async function shareCanvas(canvas, { download = false } = {}) {
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('no image');
  const file = new File([blob], 'meen-aljasoos.png', { type: 'image/png' });
  if (!download && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'مين الجاسوس؟', text: 'شوفوا مين كان الجاسوس!' });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'aborted';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'meen-aljasoos.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
