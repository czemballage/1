# DECISIONS

Decisions taken where the brief was ambiguous, chosen for being simpler, more robust and better on a phone.

1. **Project location**: the repo root already holds an unrelated site (`index.html`, CZ Emballage). To avoid overwriting it, the game lives in `spy-game/`. The deployable app is `spy-game/app/` (the `/index.html`, `/css`, `/js`… tree from the brief). Docs, tests, migrations and scripts sit next to it, not inside the published folder.
2. **Heading font: Reem Kufi** over Lalezar. Reem Kufi has 4 weights, reads like typewritten dossier headings and stays legible at small sizes. Lalezar has one heavy weight and looks cartoonish next to the noir palette.
3. **Western digits (0-9)** everywhere: understood across the Maghreb, Egypt, the Levant and the Gulf, and consistent for the timer, scores and room codes.
4. **Room codes are 4 Latin capital letters** without ambiguous ones (no I, O, L…), easy to type on any keyboard layout.
5. **Two spies**: catching either one counts as "caught"; the spies score as a team.
6. **First asker is never a spy** in pass-and-play: the spy opening the questions is an instant giveaway and frustrating.
7. **Imposter variant ("الدخيل")**: the dakheel is not told they are the spy, so the card is visually identical to an innocent card.
8. **Places packs are playable in Words mode** (location name as the word), so every pack works in both modes.
9. **Spy guess grid** is capped at 16 options (correct + 15 random from the same pack) so it fits a 320×568 screen without long scrolling.
10. **Online vote**: each player votes on their own phone; strict majority accuses; a tie means nobody is accused → spies escape. The host can end the vote early.
11. **Figma body font**: IBM Plex Sans Arabic is not in Figma's font catalogue, so the Figma file uses **Noto Sans Arabic** as a stand-in for body text (similar humanist naskh-sans metrics). The app ships IBM Plex Sans Arabic as the brief asks.
12. **Figma quota**: the connected Figma account is a Starter plan with a View seat, which allows **20 MCP tool calls per month**. The quota ran out after the foundations were built: the file has the variables, the 10 text styles, 47 icon components and 4 component sets (Button, Player Chip, Pack Card, Input). Upgrading costs money, so the remaining work (other components, all screens, responsive checks, motion notes) is delivered as a **code-generated design board** (`design/board.html`, rendered to PNG in `design/`). It uses the same tokens and components as the app, so the design and the build cannot drift. When the quota resets, the board can be pushed into the same Figma file.
13. **Reem Kufi only at display sizes (≥28px)**: on real screenshots its geometric Kufi baseline strokes hurt legibility at 17–23px (e.g. "الجولة"). Small headings (top bar, modal titles, pack names, dares) use IBM Plex Sans Arabic SemiBold; Reem Kufi stays for the title, the name on the pass screen, the secret card, results and scores.
14. **Supabase project**: the existing free-tier project (`dcmyphywgcoewqcnxscp`, eu-west-1) is reused at no cost. It already holds an unrelated `community_messages` table, so every table of the game is prefixed `spy_` to avoid name collisions.
15. **Sounds are synthesised with Web Audio** (stamp thud, typewriter tick, paper swish, alarm). That keeps the download small, and they work offline with no audio files to cache.
16. **Service worker ignores cross-origin requests**: Supabase auth, realtime and RPC are never cached. Downloaded packs are cached by the app in localStorage (`mj:content`). The content check runs at most every 12 hours.
17. **Online "dakheel" variant** is pass-and-play only in v1. Online rounds use the places/words modes.
18. **Deploy**: the container's network policy blocks Netlify (`netlify-mcp.netlify.app`, `api.netlify.com`), so the CLI upload could not run from here. The Netlify site `meen-aljasoos` was created (production public, previews behind team login) and `dist/meen-aljasoos-app.zip` is ready for drag-and-drop. A playable preview is published as a claude.ai artifact.
19. **Migration 0006 (leave room + purge)** contains `DELETE`. The Supabase MCP requires interactive confirmation for those, so it is left for the owner to apply. Until then expired rooms are closed (not deleted), and leaving a room only works client-side.
