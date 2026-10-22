# Recon map: FlipaClip (2D frame-by-frame animation app, Visual Blasters LLC)

Scope: web, core loop only: draw on a frame, add frames, onion-skin, play, export.
Sources: Play Store listing (user screenshot, reference only), support.flipaclip.com/article/17-onion-skinning, public store pitch ("Create animations easily"). Own account not used.

## Screens
| ID | screen | purpose | key components | states |
| --- | --- | --- | --- | --- |
| S01 | Projects/home | list + new project | project cards, new button | empty, filled |
| S02 | Stage (editor) | draw frames | canvas, tool rail, timeline, play bar | empty, drawing, playing |
| S03 | Timeline | frame strip | thumbnails, add/dup/delete | 1 frame, many |
| S04 | Onion skin settings | before/after frames, opacity | toggle, sliders | on/off |
| S05 | Export | video/GIF/PNG | format buttons | idle, exporting |

## Flows
F01 New project -> S02 draw -> add frame -> draw -> play -> export (happy path ~6 clicks)
edge: delete last frame, undo past start, play with 1 frame

## Inferred data model
Project(id, name, fps, width, height, frames[]) ; Frame(id, layers[]) ; Layer(bitmap). Confidence: medium.

## Hard parts
Pointer-smooth drawing, per-frame undo, video export, storage size.
## Out of scope (skip)
Original logo/assets/copy, audio library, cloud accounts, premium layers/paid tier, community.
Size: S for the web core loop.
