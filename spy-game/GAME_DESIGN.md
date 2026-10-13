# GAME DESIGN — مين الجاسوس؟

## Name
Working title: **مين الجاسوس؟**. Alternatives:
1. **الملف السرّي** (The Secret File): fits the dossier art direction.
2. **دخيل** (Intruder): one short word, easy to say as a TikTok hashtag (#دخيل).
3. **العميل صفر** (Agent Zero): a playful spy-movie feel.

We keep **مين الجاسوس؟** in the app because it explains the game instantly and is what people actually search for.

## Rules (final)

### Players & spies
- 3–12 players. Names are trimmed, 1–16 characters, must be unique (compared after whitespace and Arabic-letter normalisation: أ/إ/آ→ا, ة→ه, ى→ي).
- Spy count: auto = 1 for 3–7 players, 2 for 8–12. The user can override within `1 … floor((n-1)/2)` so innocents always outnumber spies.

### Modes
- **أماكن (places)**: one random location from the pack. Each innocent gets the location + a role from that location (roles are shuffled; if there are more innocents than roles, roles repeat). Spies get "أنت الجاسوس".
- **كلمات (words)**: one random word. Innocents get the word. Spies get "أنت الجاسوس" and no word.
- **الدخيل (words variant, setting)**: the spy gets a *close but different* word (`close_ar`) and is **not told** they are the spy. The card looks exactly like an innocent card.
- Places packs can also be played in Words mode (the location name is used as the word), so every pack works in both.

### Round
1. **Reveal**: pass-and-play in seat order, starting at a random seat.
2. **Discussion**: timer (3/5/6/8/10 min, default 6). The app picks a random first asker (never a spy in pass-and-play, so the spy doesn't have to open). Questions go in any order after that.
3. **Vote**: available any time ("صوّتوا الآن") and forced when the timer ends. The group picks one name → confirm.
4. **Outcome**
   - Accused is **innocent** → spies escape. **Each spy +2.**
   - Accused is **a spy** → caught → **spy's last chance**: that spy picks the location/word from a grid (up to 16 options: the correct one + random others from the same pack).
     - Correct guess → **each spy +2** (the spies still win).
     - Wrong guess → **each innocent +1**.
   - With 2 spies, catching either one counts as "caught" (simpler for a group at a table).
5. **Result**: stamp reveal + the real card (location/word), who the spies were, round points, then the scoreboard. One tap: "جولة أخرى" with the same players/settings.

### Scoreboard
- Kept for the whole session (survives reloads). Reset button with confirmation.
- Rank by points, ties share a rank.

### Dares (أحكام)
- Optional (setting, default ON). On the result screen, if the innocents lost, the "losing side" draws a dare card; if the spy lost, the caught spy draws. Family-safe list stored in `packs.json` (`dares`).

### No repeats
- Shuffle-bag per pack (`bag:<packId>` in localStorage): a shuffled list of item ids; pop one per round; refill + reshuffle when empty, making sure the last item played is not first in the new bag.

## Screens (pass-and-play)

| # | Screen | Primary action (bottom) | Notes |
|---|---|---|---|
| 1 | Splash | — | 600 ms max, skipped if content is cached |
| 2 | Home | "ابدأ لعبة" | secondary: لعب أونلاين, النتائج, الإعدادات |
| 3 | Players | "التالي" | add/remove/reorder names, remembered |
| 4 | Pack picker | "التالي" | grid of folders, mode filter |
| 5 | Game settings | "وزّع البطاقات" | spies stepper, timer segmented, mode, dares toggle |
| 6 | Pass to [name] | "أنا [name]" | blank interstitial, nothing secret on screen |
| 7 | Hold to reveal | press-and-hold card → "خبّأت البطاقة ✓" | button disabled until the card has been held at least once |
| 8 | Discussion | "صوّتوا الآن" | big timer, first asker, pause, show the location list (for everyone, it helps the spy too) |
| 9 | Accuse | "تأكيد الاتهام" | pick one name |
| 10 | Spy last chance | tap one option | pass the phone to the accused |
| 11 | Result | "جولة أخرى" | stamp, card, points, dares, scoreboard link |
| 12 | Scoreboard | "جولة أخرى" | share card, reset |
| 13 | Dares | "تم!" | random dare card |
| 14 | Share card | "شارك" | canvas image, Web Share or download |
| 15 | Settings | — | sound, haptics, reduced motion, dares, imposter variant, language of numerals, reset data |
| 16 | Online: Login/Profile | "متابعة كضيف" / "أرسل الرمز" | email OTP, display name, avatar |
| 17 | Online lobby | "أنشئ غرفة" / "ادخل" | 4-letter code |
| 18 | Online waiting room | host: "ابدأ" | players list, share link/QR |
| 19 | Online card | hold to reveal | own card only |
| 20 | Online discussion + vote | tap a name | each phone votes, majority, ties → no one is accused (spies escape) |
| 21 | Online result | "جولة أخرى" (host) | |

Plus global: offline banner, toast, confirm modal, error/empty states (no packs, room not found, room full, game already started).

## Flow

```
Splash → Home ─┬─ Players → Pack → Settings → [Pass(i) → Reveal(i)] × n → Discussion → Accuse
               │                                                        ↓
               │                    Result ← SpyGuess ← (accused is spy)│
               │                    Result ←──────────── (innocent) ────┘
               │                    Result → (جولة أخرى) → Pass(0)…
               │                    Result → Scoreboard → Share
               ├─ Online → Profile → Lobby → Room → Card → Discussion/Vote → Result
               ├─ Scoreboard
               └─ Settings
```

State machine phases: `home → setup → reveal → discussion → vote → spyGuess → result`. `reveal` keeps an index `i` and a sub-step `pass|card`.

## Edge cases

| Case | Behaviour |
|---|---|
| 3 players | 1 spy, max spies 1. Grid and lists fit without scroll. |
| 12 players | 2 spies; players list scrolls; accuse grid is 2 columns of 6, no scroll on 390×844. |
| Duplicate names | inline error "الاسم موجود"; Add disabled. |
| Empty names | trimmed empty name is ignored; Next disabled until ≥3. |
| Very long names | max 16 characters; ellipsis everywhere in lists; full name on the pass screen (wraps to 2 lines). |
| Back button during setup | goes to the previous setup step. |
| Back button mid-round (reveal/discussion/vote/guess) | confirm modal "إنهاء الجولة؟"; cancel keeps the game. |
| Back on Home | normal exit (we don't trap the user). |
| Phone locked mid-discussion | timer is based on `endsAt`; on return it shows the correct remaining time or jumps to the vote. Wake lock is re-acquired. |
| Browser reload / app killed | state saved after every transition → resume on the same screen. During reveal, the resume lands on the **pass** interstitial of the current player (never on an open card). |
| Pack deleted/updated while a round is saved | the round keeps a snapshot of the chosen item + option list, so it doesn't depend on the pack. |
| Storage unavailable | in-memory fallback, banner in settings "الحفظ غير متاح". |
| Offline | everything works; online mode button shows "يتطلب اتصال". |
| Rotation to landscape | layout still works (scrolls); the card stays centred; no forced lock. |
| Reduced motion | stamp appears without scale/rotate; no grain animation; timer has no pulse. |
