# مين الجاسوس؟ 🕵️ — لعبة جماعية عربية

لعبة كشف الجاسوس للعائلة والأصحاب، تعمل على الهاتف بشكل كامل **بدون إنترنت**. اللعب يكون بطريقتين: هاتف واحد يتمرّر بين اللاعبين، أو كل لاعب من هاتفه (أونلاين).

- من 3 إلى 12 لاعباً، وجاسوس واحد أو جاسوسان.
- طريقتا لعب: **أماكن وأدوار** و**كلمات**، مع وضع **الدخيل** الاختياري.
- 14 ملفاً و285 مكاناً وكلمة، بالإضافة إلى 25 حكماً للخاسر.
- لوحة نتائج، وبطاقة نتيجة قابلة للمشاركة، ولا تكرار للأماكن حتى ينتهي الملف.
- تصميم «ملف سرّي عربي» (Arab noir dossier)، وواجهة RTL مصمّمة للهاتف أولاً.

---

## التشغيل محلياً

لا يوجد أي build step: الملفات HTML وCSS وJavaScript عادية (ES modules).

```bash
cd spy-game
npx http-server app -p 8080 -c-1      # أو: npm run serve
# ثم افتح http://localhost:8080
```

> الـ Service Worker يحتاج HTTPS أو `localhost`. افتح التطبيق مرة واحدة وأنت متصل، وبعدها يشتغل بدون إنترنت.

## الاختبارات

```bash
npm test                    # منطق اللعبة: توزيع الأدوار، عدد الجواسيس، النقاط، الـ shuffle-bag، الاستئناف
npm run check:content       # فحص المحتوى: الأعداد، التكرار، الأسماء المتشابهة
node tests/e2e.mjs          # Playwright: 5 مقاسات، 3 و12 لاعباً، الرجوع، إعادة التحميل، بدون إنترنت، تقليل الحركة
node tests/online-mock.mjs  # شاشات الأونلاين مع خادم وهمي
```

اختبارات الأمان في قاعدة البيانات موجودة في `supabase/tests/security_test.sql`. شغّلها في SQL Editor. الاختبار ينتهي بـ `RAISE` فيُلغى كل شيء، ولا تبقى أي بيانات تجريبية.

## النشر

المجلد الذي يُنشر هو **`spy-game/app/`** فقط، وهو موقع ثابت. ملف `spy-game/netlify.toml` مضبوط عليه (ارفع المجلد `spy-game` أو اضبط Base directory = `spy-game` في Netlify).

- **Netlify**: اربط المستودع، أو اسحب مجلد `app` إلى Netlify Drop.
- أي استضافة ثابتة بـ HTTPS تعمل أيضاً، مثل Cloudflare Pages وGitHub Pages وVercel.
- بعد كل تعديل على الملفات، **غيّر رقم `VERSION` في `app/sw.js`** حتى تحمّل الهواتف النسخة الجديدة.

## إضافة ملف (pack) جديد

1. عدّل `scripts/build_packs.py`. الصيغة في كل سطر:
   - أماكن: `id | اسم المكان | دور، دور، دور، دور، دور، دور` (6 أدوار على الأقل، و15 مكاناً على الأقل).
   - كلمات: `id | الكلمة | كلمة قريبة لوضع الدخيل` (25 كلمة على الأقل).
2. شغّل الأوامر التالية:
   ```bash
   python3 scripts/build_packs.py      # يكتب app/content/packs.json
   node scripts/check_packs.mjs        # يجب أن يكون 0 errors
   python3 scripts/build_seed_sql.py   # يولّد migration المحتوى لـ Supabase
   ```
3. ارفع رقم `version` في `packs.json`، ثم شغّل الـ seed على Supabase. الهواتف المتصلة تحمّل التحديث تلقائياً، والهواتف غير المتصلة تبقى على المحتوى المدمج.

## Supabase (الأونلاين والحسابات)

اللعبة تعمل بالكامل كضيف وبدون إنترنت. Supabase يضيف فقط: الغرف الأونلاين، والحساب، والمزامنة، والملفات الخاصة، وتحديث المحتوى.

| المتغيّر | المكان | القيمة |
|---|---|---|
| `SUPABASE_URL` | `app/js/config.js` | `https://<project>.supabase.co` |
| `SUPABASE_KEY` | `app/js/config.js` | المفتاح **publishable / anon** فقط |

> ⚠️ لا تضع مفتاح `service_role` في الواجهة أبداً. كل الجداول محمية بـ RLS.

### الإعداد لأول مرة
1. طبّق الـ migrations بالترتيب من `supabase/migrations/` (عبر `supabase db push` أو SQL Editor).
   - `…06_spy_leave_and_purge.sql` يحتوي على `DELETE`، لذلك يحتاج تطبيقاً يدوياً من صاحب المشروع.
2. في لوحة Supabase، اذهب إلى **Authentication → Sign In / Providers**:
   - فعّل **Allow anonymous sign-ins** (الدخول كضيف).
   - فعّل **Email** مع رمز OTP (لترقية حساب الضيف ببريد إلكتروني).
   - اختياري: فعّل **Leaked password protection**.
3. في **Authentication → URL Configuration**، أضف رابط الموقع المنشور إلى *Site URL* و*Redirect URLs*.

### كيف تُحمى الأسرار؟
- الأدوار والجواسيس تُوزَّع داخل Postgres في الدالة `spy_start_round` (security definer).
- كل لاعب له صف واحد في `spy_room_secrets`، وسياسة RLS تسمح له بقراءة **صفّه فقط**.
- مفتاح الإجابة موجود في `spy_room_answers`، ولا يقرؤه أي عميل.
- جداول الأسرار والإجابات والأصوات **ليست** في Realtime. فقط `spy_rooms` و`spy_room_players` (البيانات العامة) تُبث.
- يتم التحقق على الخادم من: طول الاسم، وعدد اللاعبين (3 إلى 12)، والاسم المكرر، وحدّ 5 غرف في الساعة لكل مستخدم.
- الغرف تنتهي بعد 3 ساعات، ووظيفة `pg_cron` تغلقها كل 15 دقيقة.

## هيكل المشروع

```
spy-game/
  app/                    ← الموقع المنشور
    index.html  manifest.webmanifest  sw.js
    css/  fonts.css tokens.css app.css
    js/   app.js router.js state.js game.js sync.js supabase.js config.js
    js/ui/ setup.js round.js extras.js online.js dom.js hold.js fx.js icons.js
    content/packs.json
    assets/ fonts/ icons/ vendor/ img/
  supabase/migrations/    ← المخطّط والدوال وRLS والمحتوى
  supabase/tests/         ← اختبار الأمان
  tests/                  ← اختبارات الوحدة وPlaywright
  scripts/                ← توليد المحتوى وفحصه
  design/                 ← لقطات الشاشات ولوحة التصميم
  RESEARCH.md  GAME_DESIGN.md  DECISIONS.md  PROGRESS.md  MARKETING.md
```

## الأداء وسهولة الوصول
- التحميل الأول حوالي 450 KB، والخطوط مقطّعة و`font-display: swap`، ومكتبة Supabase تُحمَّل فقط عند الدخول للأونلاين.
- الحركات تستعمل `transform` و`opacity` فقط، وتحترم `prefers-reduced-motion`، ويوجد أيضاً مفتاح لتقليل الحركة في الإعدادات.
- مساحات اللمس 48px على الأقل، والتباين يحقّق WCAG AA، وتوجد تسميات للقارئ الصوتي.
