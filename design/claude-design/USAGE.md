# Pepak Doto: usage notes

## The idea in one line
The app is a field guide to Dota 2, written the way a patient scholar would annotate it. The book supplies the structure: chapters, tabs, a ribbon and margin notes. Javanese batik supplies the texture and the gold. Dota supplies the map, the lanes and the runes.

## Where each source shows up
- **Dota:** the logo is a minimap (frame = top and bottom lanes, kawung leaves = mid lane and river). The hero banner is a three-lane map on an open book. Diamonds stand for towers and runes. Radiant and dire colors appear only in team data.
- **Javanese:** kawung, parang and truntum patterns. Gold on dark comes from batik prada. Sogan brown and wedel indigo are used for large surfaces and illustration only. Aksara Jawa appears as a decorative accent only (ꦥꦼꦥꦏ꧀, which still needs a native check).
- **Book:** Alegreya for headings. Chapter I, II and III for draft, game and review. Index tabs, the ribbon bookmark, italic margin notes, and stamp-style A to D grades.

## Patterns
| Pattern | Use for | Size | Opacity |
|---|---|---|---|
| Kawung | page background, hero, empty states | 40px | 6% dark / 8% light |
| Parang | draft board, during-game areas | 40px | 6–7% |
| Truntum | review chapter, sign-in backdrop, dialogs | 32px | 6–8% |

Apply patterns with CSS `mask` on a colored pseudo-element (see `.batik` in tokens.css). Don't use `background-image`, because the files are single-color masks.
Never put a pattern behind tables, stats or body text longer than two lines.

## Ornaments
- **Divider:** goes between chapters or page sections, never between list rows. On mobile, use it at 200px, aligned left.
- **Panel corner:** goes on two opposite corners only, inset 6px, at 70% of --accent.
- **Ribbon:** marks exactly one item on a screen: the current chapter, the top pick or the selected hero.
- **Index tab:** holds a chapter label in Alegreya SC 700, 14px, and sits on a panel's top edge.
- **Margin note:** a 10–16px marker before a coaching tip or "why this pick" reason. The text is Alegreya italic in --accent-fg.

Frame at most one panel per screen (corners plus ribbon plus tab). Every other panel gets a 1px --border and nothing more.

## Don'ts
- Don't use radiant or dire for decoration, buttons or success states. Success uses --accent-fg.
- No gradients, glass or blur. Surfaces are flat, like cloth and paper.
- Don't use gold text on light surfaces. Use --accent-fg (#83580F), not --accent.
- Don't use wayang figures, gunungan silhouettes or other religious or ceremonial objects as decoration.
- Don't redraw Valve heroes, items, rank medals or the Aegis. The rank badge is text plus the kawung mark.
- Don't use aksara Jawa as UI text or without a Latin label nearby.

## Motion (only inside `prefers-reduced-motion: no-preference`)
- Ribbon: slides down 8px into place on selection (`--dur-ribbon`, `--ease-page`).
- Pattern reveal: the hero pattern fades from 0 to its target opacity over `--dur-reveal`, once per session.
- Everything else uses opacity or transform only, under 250ms. Nothing loops.

## Radius
sm 4px (badges, tags), md 6px (buttons, inputs, portraits), lg 10px (panels, dialogs), pill (filter chips only).

## Files
- tokens/: tokens.css, tokens.json, fonts.md
- logo/: symbol and lockup in one-color (currentColor), dark and light versions, plus logo-symbol-small.svg with thicker strokes for sizes under 24px. The wordmark is outlined Alegreya SC 700.
- social/: favicon.svg, favicon-32.png, apple-touch-icon.png (180), icon-512.png, og-image.png (1200×630)
- patterns/, ornaments/: single-color SVG, currentColor
- illustrations/: hero banner (desktop 2400×1200, mobile 1080×1350; dark and light; SVG with layer-texture, layer-illustration and layer-details groups; PNG and WebP), 3 spot illustrations and 3 empty states (currentColor)
