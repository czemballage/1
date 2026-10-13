# RESEARCH — مين الجاسوس؟

Short, decision-oriented notes. Each section ends with what we take from it.

## 1. Spyfall / "Imposter / Who is the spy" and its mobile versions

- **Spyfall** (Alexandr Ushan, 2014): everyone except the spy gets the same location + a role; the spy has to work out the location from the questions people ask. Rounds last about 8 minutes, and the spy can stop the clock to guess.
- **The word variant** (Imposter / Undercover / Mr. White): everyone gets a word; the imposter gets nothing ("Mr. White") or a close but different word ("Undercover"). For example, *Imposter Up* by Cosmicode on Google Play has a "Mr. White" with no word at all.
- The app stores are crowded with near-identical clones: [Imposter Spy Party Game](https://apps.apple.com/app/id1611983535) (offline, one phone, 3–20 players), [Imposter Party – Multiplayer](https://apps.apple.com/app/id6756916475) (subscription), [Imposter Game – Who is the Spy?](https://apps.apple.com/us/app/-/id6758616649), [Faky](https://apps.apple.com/us/app/-/id6753783454). Almost none are in Arabic with local content, so **our edge is native Arabic content and a distinct look**.
- Recurring player complaints in reviews of clones (taken from listing review sections and app-store review aggregators; patterns, not quotes):
  - **Repetition**: the same location comes back in consecutive rounds, so the spy can guess it. → *shuffle-bag that persists across sessions.*
  - **Peeking / leaking**: the next player sees the previous card because it stays on screen; "tap to flip" cards get left open. → *press-and-hold reveal plus a blank interstitial between players.*
  - **Setup friction**: typing names every time, ads between rounds, paywalls on the "good" packs. → *remember names, one-tap "another round", no ads, all packs free.*
  - **Pacing**: rounds drag; nobody knows who should talk first. → *random first asker, short default timer (6 min), "vote now" button.*
  - **Too-similar items** (café vs restaurant) make innocents look like spies. → *similarity checker script on the content.*
  - **Translation quality**: machine-translated Arabic. → *hand-written content.*

**Takeaway:** pass-and-play has to be leak-proof and quick to start; content quality is the product.

## 2. What makes party games go viral (TikTok / Reels)

- The "word impostor" trend spread on TikTok and Reels because its emotional beats (confusion → accusation → denial → "I knew it!") fit 30–60 s clips and are understood within seconds ([Tampere Univ. PlayLab](https://blogs.tuni.fi/playlab/game-related-media/guess-betray-repeat-how-word-impostor-became-last-months-most-addictive-guessing-game/), [Expreso](https://www.expreso.ec/ocio/el-juego-del-impostor-se-vuelve-viral-en-tiktok-como-jugar-con-y-sin-app-270185.html), [La Capital](https://www.lacapital.com.ar/informacion-general/el-fenomeno-viral-del-momento-como-se-juega-al-impostor-y-cuales-son-sus-reglas-n10238921.html/amp)).
- It grew first in livestreams, then in short clips. It costs nothing, needs no setup, and the "#FakyChallenge" app tie-in shows that a branded share moment works ([Faky](https://apps.apple.com/us/app/-/id6753783454)).
- What we take from it:
  - **One big reveal moment** that reads on camera: a full-screen red stamp "مكشوف!" / "هرب الجاسوس!" with a thud sound and a haptic.
  - **The spy's face when they get the card** is the clip. The "أنت الجاسوس" card has to be instantly readable from 1 m away (large type, red).
  - **Share card image** at the end: scoreboard plus "الجاسوس كان: …" in the dossier style, so every shared image advertises the game.
  - **Dares (أحكام)** create a second funny moment after the reveal.
  - Local, relatable content (عرس, حمّام, سوق الجمعة) gets reactions and comments from the same region.

## 3. Arabic RTL mobile UI

- **Line height**: Arabic needs more than Latin. Sources range from ≥1.5 to 1.6–1.8 for body text ([RTL checklist](https://freezil-website-wjfnk.kinsta.page/blog/rtl-website-checklist.html), [Arabic typography guide](https://freezil-website-wjfnk.kinsta.page/blog/arabic-typography-guide.html), [hapy.co](https://hapy.co/journal/arabic-website-design-basics/)). → **body 1.65, headings 1.3**.
- **Size**: Arabic reads small. Aim for ~17px body on mobile ([Dubai Design System typography](https://designsystem.dubai.ae/foundations/typography)). → **body 17px, min 14px**.
- **Letter spacing**: always 0, because spacing letters apart breaks the connected script.
- **No italics**: Arabic has none; a synthetic oblique looks broken.
- **Fonts that render Arabic well (Google Fonts)**: IBM Plex Sans Arabic (UI/body, many weights), Reem Kufi (geometric Kufi display), Lalezar (heavy display, one weight), Aref Ruqaa (calligraphic Ruqaa, good for stamps), Tajawal, Cairo, Kufam.
  → **Reem Kufi** for headings (it pairs with the typewriter/dossier feel and has 4 weights, where Lalezar has one), **IBM Plex Sans Arabic** for body, **Aref Ruqaa** for stamps.
- **Numerals**: Western digits (0-9) are understood across the Maghreb, Egypt, the Levant and the Gulf, and Algeria and Morocco use them by default. → use Western digits everywhere (timer, scores, room code) for consistency; room codes use Latin letters only (easy to type on any keyboard).
- **Mirroring**: mirror directional icons (back arrow, chevrons, "next"); do NOT mirror clocks, play icons, checkmarks or logos.
- **CSS**: use logical properties (`margin-inline-start`, `inset-inline-end`, `padding-block`) everywhere.
- **Mixed text** (Latin room code inside Arabic text): wrap it in `<bdi>` / `dir="ltr"` to avoid bidi jumps.

## 4. Mobile web pitfalls

| Pitfall | Fix |
|---|---|
| `100vh` includes the hidden URL bar on iOS/Android, so bottom buttons fall off-screen | `min-height: 100svh` with `100dvh` for the app shell, `100vh` fallback first |
| Notch / home indicator | `viewport-fit=cover` + `env(safe-area-inset-*)` padding |
| iOS zooms on focus if the input font is < 16px | inputs ≥ 16px |
| Double-tap zoom / 300ms delay | `touch-action: manipulation` |
| Pull-to-refresh reloads mid-game | `overscroll-behavior: none` on html/body |
| Long-press opens the callout / context menu on the reveal card | `-webkit-touch-callout: none; user-select: none;` + `contextmenu` preventDefault |
| Finger slides off the hold button | Pointer Events + `setPointerCapture`; hide on `pointerup`/`pointercancel`/`lostpointercapture`/`blur`/`visibilitychange` |
| Screen sleeps during discussion | Screen Wake Lock API: Safari 16.4+, Chrome 84+ ([caniuse](https://caniuse.com/wake-lock), [Chrome docs](https://developer.chrome.com/docs/capabilities/web-apis/wake-lock)). Released when the page is hidden → re-request on `visibilitychange`. Was broken in installed iOS PWAs before iOS 18.4 ([WebKit 254545](https://bugs.webkit.org/show_bug.cgi?id=254545)) → fail silently |
| Android keyboard resizes the viewport and pushes the CTA up | use the `interactive-widget=resizes-content` viewport hint; keep the CTA in normal flow on the input screen |
| Android back button exits the app | History API: push a state per screen, intercept `popstate`, confirm mid-round |
| Audio blocked until a user gesture (iOS) | create/resume the `AudioContext` on the first tap |
| Timer drifts when backgrounded | store `endsAt` timestamp, compute remaining from `Date.now()` |
| `localStorage` throws (Safari private mode, quota) | wrap every access in try/catch, keep an in-memory fallback |
| `navigator.vibrate` missing on iOS | feature-detect, no-op |

Sources: [caniuse wake-lock](https://caniuse.com/wake-lock), [Chrome wake lock article](https://developer.chrome.com/docs/capabilities/web-apis/wake-lock), [whatpwacando.today](https://whatpwacando.today/wake-lock), [progressier](https://progressier.com/pwa-capabilities/screen-wake-lock).
