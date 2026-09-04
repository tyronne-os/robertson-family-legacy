# Magnolia Robertson family book — chapter page template

`Voice Narrator Widget.dc.html` is the locked TEMPLATE for every chapter page (currently built for Chapter Six / Lydia Robertson). New chapters = same structure, new text + new framed photo. Follow exactly:

## Structure
- Top nav bar: HOME / CHAPTERS / PHOTO ALBUM / SUBMIT A CHAPTER (Cinzel, gold on dark).
- Two-page open-book spread, gold metallic royal-trim border wrapping the whole spread (linear-gradient 155deg gold sequence, ~10px thick, inset bevel highlights).
- Left "page": parchment (#F4E9D4→#EFE1C7→#E2CFAC gradient), chapter title (Cinzel caps) + Pinyon Script subtitle centered, then chapter body text — 2-column article (column-count:2), left-aligned (never justify — causes word-space rivers at this width), 24px, font-weight 600, color #000, line-height 1.5. Drop cap on the first paragraph only: Pinyon Script, ~96px, float left. Section breaks ("Her Pride & Her Joy", "Her Legacy" style subheads) in bold Pinyon Script 34px, color #7A1E1E. Left page is sticky-scrollable (height calc(100vh-36px), overflow-y:auto) so it matches the right page's height.
- Right "page": large framed portrait photo (pre-framed PNG/JPEG the user supplies — gold oval frame baked into the image), sits in a sticky column (position:sticky, height calc(100vh-36px)), image sized with flex:1 1 0%; min-height:0; height:100%; object-fit:contain (NOT max-height guessing — this is the fix that prevents caption clipping). Below the photo: name in Pinyon Script 26px + location line in Cinzel 11px caps, then a static voice-player placeholder pill (play glyph circle, "NARRATE THIS CHAPTER" label, thin progress bar, gear icon) — inline under the photo, NOT a floating fixed-position widget. This player is currently a visual placeholder only; wiring happens outside this tool.
- Footer inside left page: "Robertson Family Reunion" / page number, Pinyon Script.

## Fonts/colors
Cinzel (headers/labels/nav), Pinyon Script (title, drop cap, names, section subheads), EB Garamond (nav/misc italic). Gold accents #C9A227/#F0D98C/#8A6A1F. Parchment #F4E9D4/#EFE1C7/#E2CFAC. Body text black #000, weight 600, 24px.

## Process for each new chapter
1. User provides: chapter text (typos get cleaned up, content preserved) + a photo already composited into a gold oval frame (or raw photo + frame to composite via run_script white-background removal).
2. Duplicate this exact structure into a new file (or new state in this file) with the new chapter number/name/text/photo.
3. Do not redesign — only swap content unless the user explicitly asks for a layout change.
