# Fonts (all free on Google Fonts)

| Role | Family | Weights |
|---|---|---|
| Display / headings | Alegreya | 500, 700, italic 500 |
| Wordmark, chapter labels, index tabs | Alegreya SC | 500, 700 |
| Body and UI | Atkinson Hyperlegible Next | 400, 500, 700 |
| Stats, timers, percentages | Atkinson Hyperlegible Mono | 400, 500 |
| Decorative accent only | Noto Sans Javanese | 400 |

CSS2 URL:
https://fonts.googleapis.com/css2?family=Alegreya:ital,wght@0,500;0,700;1,500&family=Alegreya+SC:wght@500;700&family=Atkinson+Hyperlegible+Next:wght@400;500;700&family=Atkinson+Hyperlegible+Mono:wght@400;500&family=Noto+Sans+Javanese&display=swap

next/font/google:
  Alegreya({ subsets:["latin"], weight:["500","700"], style:["normal","italic"], variable:"--font-display" })
  Alegreya_SC({ subsets:["latin"], weight:["500","700"], variable:"--font-display-sc" })
  Atkinson_Hyperlegible_Next({ subsets:["latin"], weight:["400","500","700"], variable:"--font-sans" })
  Atkinson_Hyperlegible_Mono({ subsets:["latin"], weight:["400","500"], variable:"--font-mono" })
  Noto_Sans_Javanese({ subsets:["javanese"], weight:"400", variable:"--font-javanese", preload:false })

Use font-variant-numeric: tabular-nums on every stat column.

Javanese script used so far (NEEDS NATIVE READER CHECK):
  ꦥꦼꦥꦏ꧀  intended reading: "pepak"
