# Brief desain untuk Claude Design

## Cara pakai
1. Salin seluruh isi blok **Prompt** di bawah ke Claude Design.
2. Kalau hasil pertama sudah cocok arahnya, minta Claude Design melanjutkan ke bagian berikutnya. Kerjakan bertahap: identitas dulu, lalu aset, lalu layar.
3. Serahkan hasilnya dengan cara di bagian **Serah terima**.

## Serah terima (yang saya butuhkan)
1. **Link desain Claude Design.** Saya bisa membacanya langsung dari link claude.ai.
2. **File hasil ekspor**, ditaruh di folder `design/claude-design/` di repo (commit ke branch mana saja), dengan struktur:
   ```
   design/claude-design/
   ├─ tokens/        tokens.css, tokens.json
   ├─ logo/          SVG + PNG
   ├─ patterns/      SVG pola batik (bisa di-tile)
   ├─ ornaments/     SVG pembatas, sudut, pita bookmark
   ├─ illustrations/ SVG/WebP banner dan ilustrasi
   ├─ social/        og-image.png, favicon
   └─ mockups/       PNG layar desktop dan HP
   ```
3. Kalau ada file yang tidak bisa diekspor dari Claude Design, cukup link-nya. Saya bisa membuat ulang aset dari desainnya.

Setelah itu saya akan:
- mengoptimalkan SVG dan gambar, lalu memindahkannya ke `public/brand/`
- mengganti token warna dan font di `globals.css`
- menerapkan banner, pola, dan ornamen ke halaman yang sudah ada, tetap mengikuti aturan aksesibilitas dan performa

---

## Prompt

```text
I'm building Pepak Doto, a web app that helps Dota 2 players improve. I need a visual identity and key screens that feel specific to this product, not like a generic dark SaaS template.

ABOUT THE PRODUCT
- Helps pub players (mostly Crusader to Ancient rank, age 16-35) at three moments: during the draft (hero picks that counter the enemy), during the game (items and a game plan), and after the game (a review of their match with what to fix).
- Web app, English UI. Used on desktop and on a phone as a second screen while playing, so it has to work at 390px wide.
- Dark theme is the default. A light theme is also needed.
- Built with Next.js and Tailwind CSS. Colors and type will be implemented as CSS variables.

THE CONCEPT
"Pepak" is Javanese for complete or thorough. It is also the name of the classic Javanese reference book that students keep on their desk, a small compendium of everything you need to know. The app should feel like that book, written for the Dota battlefield: an annotated field guide that a patient Javanese scholar wrote about the game.

Blend three sources:
1. Dota 2: an ancient battlefield, two sides (Radiant and Dire), three lanes, runes, the Aegis, the minimap. Keep it to mood and motifs. Do not redraw Valve characters, logos or official art. The app already shows official hero portraits from Valve's CDN, so custom art must be original and must sit well next to those portraits.
2. Javanese culture: batik motifs (kawung, parang, truntum, sidomukti), batik prada (gold leaf on dark cloth), the natural dye colors sogan brown and wedel indigo, wayang kulit shadow puppets and the gunungan, aksara Jawa script, lontar palm-leaf manuscripts. Use them with respect: as ornament and texture, not as a costume, and without religious symbols.
3. The book: chapters, a ribbon bookmark, index tabs, notes in the margin, stamped or underlined annotations, the feel of a well-used study guide.

Mood: crafted, calm, a little mysterious, serious about improvement. Not kitsch, not a tourism poster, not medieval fantasy.

VISUAL DIRECTION AND LIMITS
- Color: a near-black ink base for dark mode, gold (like batik prada gold leaf, also close to the Aegis) as the single main accent, plus one or two supporting heritage tones (sogan brown, wedel indigo) for surfaces and illustrations. Radiant green and Dire red are reserved for team data only. Avoid purple or blue AI gradients and glassmorphism.
- Contrast: all text at WCAG AA (4.5:1 body, 3:1 large text) in both themes. Batik patterns behind text stay very subtle (around 5-8% opacity).
- Type: free Google Fonts only. A display face with character for headings (a serif is fine here because of the book concept, but not Fraunces or Instrument Serif), a very readable sans for body text, and a monospace or tabular figures for stats. Aksara Jawa (Noto Sans Javanese) may appear as a decorative accent only. Mark any Javanese script text so I can have it checked by a native reader.
- Shapes: one consistent corner-radius system. Suggest how batik-like borders or ornaments can frame panels without making the UI heavy.
- Motion ideas are welcome, but keep them subtle and optional (for example a bookmark ribbon sliding in or a pattern slowly revealing). Everything must still work with motion turned off.

WHAT I NEED (please deliver as downloadable files where you can, and keep a shareable link)
1. Design tokens
   - tokens.css: CSS custom properties for light and dark themes (background, surfaces, borders, text, muted text, accent, text on accent, radiant, dire, danger), radius scale, shadow scale, spacing notes.
   - tokens.json with the same values.
   - Font choices with the exact Google Fonts names and weights.
2. Logo (optional, explore 3 directions first and let me choose)
   - Ideas to consider: a book or lontar leaf combined with a rune or the three lanes; a kawung motif shaped like a map; the letter P as a gunungan silhouette.
   - Wordmark and symbol, SVG, one-color versions using currentColor plus full-color versions for dark and light backgrounds.
   - Favicon as SVG, PNG 32x32, and apple-touch-icon PNG 180x180.
3. Batik patterns: 2 or 3 seamless, tileable SVG patterns (for example kawung and parang), single color using currentColor so I can recolor and set opacity in code. Keep each file small (under 30 KB).
4. Ornaments: a section divider, a panel corner ornament, a ribbon bookmark, an index tab shape and a small "margin note" marker. All SVG, single color, currentColor.
5. Home page hero banner: an original illustration that merges the three sources (for example an open field guide whose pages become the three-lane battlefield in batik linework). Provide it layered if possible (background texture, main illustration, foreground details) as SVG, or as WebP and PNG at 2400x1200 plus a mobile crop at 1080x1350.
6. Spot illustrations, SVG: one each for "during the draft", "during the game", "after the game", plus empty states for "no heroes match your search", "match not found" and "your match data is private".
7. Social: Open Graph image 1200x630 PNG.
8. Screen mockups at 1440px desktop and 390px mobile, dark theme first and one light-theme example:
   - Home page (hero, the three moments section, the "what we get from your Steam account" section, footer)
   - Heroes page (search, attribute filters, a grid of official hero portraits, a side panel with win rate by rank)
   - Profile page (avatar, name, rank, preferences form, sign out, delete account)
   - Sign in page
   - Optional concepts for later: draft assistant (ally, enemy and ban slots with a ranked list of suggested heroes and the reasons) and post-match review (grades A to D, lane summary, deaths timeline, item timings)
9. Components with states (default, hover, focus, disabled, error): primary, secondary, ghost and danger buttons; text input and select; filter chips; panel or card; header with desktop nav and mobile menu; footer; rank badge; grade badge A to D; small "In development" label; confirmation dialog.
10. A short usage note: when to use each pattern and ornament, what not to do, and how the design expresses the Dota, Javanese and book ideas.

Technical notes for the files:
- SVG: clean viewBox, no embedded raster images, no fonts converted to outlines unless it's the logo, optimized, under 40 KB each where possible.
- Raster: WebP plus PNG fallback, 2x resolution.
- Name files in kebab-case, for example pattern-kawung.svg, ornament-divider.svg, hero-banner-desktop.webp.
```
