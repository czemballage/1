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
