# Progres

> Rencana lengkap: [PRD.md](PRD.md) dan [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md). Setup hosting: [SETUP.md](SETUP.md).

## Status saat ini (2026-09-28)

- **Tahap 0 (Fondasi):** selesai dan live di Vercel + Neon. Login Steam, halaman admin, dan desain Pepak Doto sudah berjalan.
- **Tahap 1 (MVP):** Draft Assistant dan Post-Match Analyzer sudah di-merge (PR #3 dan #4). Smoke test E2E ditunda atas keputusan pemilik.
- **Tahap 2 (In-game):** di-merge (PR #6). Sinkron data hero harian berjalan lewat GitHub Actions.
- **Tahap 3 (Profil pemain):** rencana sudah dibahas (PRD 0.5, DEVELOPMENT_PLAN §7), menunggu review sebelum coding. Branch `feat/stage-3`.

## Tahap 1: yang sudah dikerjakan

### Draft Assistant (`/draft`)
- **Papan draft:** slot tim (4 + "You"), musuh (5), dan ban (sampai 16). Di desktop, pemilih hero tampil di bawah papan. Di HP, mengetuk slot membuka pemilih hero sebagai dialog.
- **State di URL** (`?a=…&e=…&b=…&r=…&p=…`), jadi aman di-refresh dan bisa dibagikan.
- **Default rank dan posisi:** diambil dari URL, lalu preferensi profil, lalu rank asli OpenDota.
- **Rekomendasi pick (12) dan ban (5)** beserta alasan tertulis, peringatan komposisi, dan pita bookmark pada pick teratas.
- **Data STRATZ:**
  - `heroVsHeroMatchup` untuk counter dan synergy.
  - `heroStats.stats(groupByPosition)` untuk winrate meta **per posisi per bracket** dan filter posisi. Ini lebih akurat daripada data lane OpenDota.
  - Kalau STRATZ gagal, otomatis pindah ke OpenDota (hanya match pro, filter posisi tidak berlaku) dengan catatan di UI.
- **Hero pool** (user login): menambah skor, plus toggle "only heroes I've played at least 5 times". Data dari `/players/{id}/heroes?date=365`.
- **Pembatasan request:** paling banyak 4 request STRATZ sekaligus (batas STRATZ 8/detik), dan hasilnya di-cache 12–24 jam di database.

### Post-Match Analyzer (`/match`, `/match/[id]`)
- **Input:** match ID atau link OpenDota/Dotabuff/STRATZ. User yang login juga mendapat daftar 10 match terakhir (tanpa Turbo).
- **Pilih pemain:** otomatis kalau user login dan ada di match itu. Kalau tidak, muncul pilihan 10 pemain.
- **Nilai A–D** (farming, XP, damage, survival, partisipasi) dari persentil OpenDota. `pct_bracket` dipakai kalau tersedia.
- **Kalau replay sudah di-parse:**
  - laning menit ke-10 (LH/DN, efisiensi, selisih gold lane)
  - kematian per fase dan pembunuh terbanyak
  - waktu beli item inti
  - vision
- **Ringkasan:** maksimal 3 prioritas perbaikan beserta tips, dan hal yang sudah bagus.
- **Tombol "Parse replay":**
  - Setelah diminta, halaman mengecek OpenDota setiap 30 detik (tanpa cache) selama maksimal 30 menit, lalu refresh sendiri begitu replay selesai.
  - Status menunggu disimpan di sessionStorage, jadi tetap ada setelah halaman di-refresh.
  - Match yang lebih tua dari 14 hari diberi catatan bahwa replay-nya mungkin sudah dihapus Valve.
  - Tanpa API key, OpenDota menaruh permintaan di antrean prioritas rendah (priority -2). Saat dites 2026-09-28, dua match baru belum selesai setelah 15 menit lebih. Jadi parse lambat itu sifat antrean OpenDota, bukan bug di aplikasi.
- Match Turbo, match tidak ditemukan, dan data privat masing-masing punya pesan dan ilustrasi sendiri.

### Test
- 38 unit test (mesin draft, analisis match, OpenID, helper). Lint, typecheck, dan build lulus.

## Temuan penting (sudah diterapkan)
- **Persentil kematian OpenDota sudah "makin tinggi makin baik".** Tidak dibalik. Rencana awal salah, dan ini terlihat saat dites dengan data asli (1 kematian dapat nilai D).
- **Winrate waktu item bias ke waktu lambat.** Game panjang yang sudah unggul membuat pembelian lambat terlihat bagus. Pembanding sekarang hanya bucket yang **lebih cepat** dari waktu pemain. Pembelian yang lebih lambat dari semua bucket ditandai "later than most players".
- **Item komponen** (mis. Kaya, Sange) tidak dibahas terpisah kalau item gabungannya juga dibeli.
- **Peran pemain** di match yang belum di-parse ditebak dari last hit per menit (< 2 = support). Support tidak diberi saran farming.
- **Tanda matchup STRATZ:** `vs.synergy` positif berarti hero pertama unggul. Nilainya hampir simetris dan berkorelasi 0,74 dengan winrate. Nilai dihaluskan berdasarkan jumlah match (k = 300).

## Backtest skor draft (`npm run backtest`)
Data: 3.899 match All Pick publik (≈1.000 per kelompok rank, durasi ≥ 15 menit), dievaluasi dengan 5-fold cross-validation. Margin error ±1,6 poin.

| Metode | Akurasi | AUC |
|---|---|---|
| Selalu tebak Radiant | 51,7% | 0,50 |
| Counter saja | 53,4% | – |
| Synergy saja | 51,4% | – |
| Meta saja | 55,0% | – |
| Bobot lama 1 / 0,6 / 0,7 | 55,9% | 0,588 |
| **Bobot baru 1 / 0,2 / 0,5** | **56,3%** | **0,591** |

Kesimpulan:
- Skor draft punya daya prediksi nyata (+4,6 poin di atas tebakan dasar). Angka ini wajar, karena di pub draft hanya menentukan sebagian kecil hasil.
- Meta adalah komponen terkuat, counter kedua, dan synergy lemah. Bobot diganti ke 1 / 0,2 / 0,5 (dekat dengan hasil regresi logistik 1 / 0,17 / 0,49).
- Per kelompok rank dengan bobot baru (tim dengan skor lebih tinggi menang): Herald–Guardian 58,2%, Crusader–Archon 55,2%, Legend–Ancient 58,5%, Divine–Immortal 55,3%.
- Batasan: statistik STRATZ berasal dari periode yang sama, sehingga hasilnya sedikit optimis. Komposisi tim (disable, initiator) dan hero pool tidak ikut diuji.
- Hasil lengkap tersimpan di `.data/backtest/last-result.json` (lokal, tidak di-commit). Jalankan ulang setiap ada patch besar.

## Belum dikerjakan dari Tahap 1
- **Smoke test E2E dengan Playwright** (tugas 1.8). Ditunda.

## Tahap 2: yang sudah dikerjakan

### Sinkron data hero harian
- `npm run sync:hero-data` mengambil dari STRATZ: matchup, posisi, build item (full, starting, boots), dan tipe damage per hero, untuk 5 kelompok rank. Dari OpenDota: winrate per durasi game. Hasilnya disimpan di tabel `hero_data`.
- Dijalankan GitHub Actions setiap hari pukul 02:15 UTC. Di Vercel aplikasi tidak memanggil STRATZ langsung (batas 2 IP per 15 menit). Di laptop, data yang belum ada diambil saat dibutuhkan.
- Uji coba: 2 hero di 1 kelompok rank cukup 4 request STRATZ. Perkiraan sinkron penuh ±250 request STRATZ + ±127 request OpenDota, sekitar 10 menit.
- Status sinkron terakhir tampil di /admin (baris *Hero data sync*).

### Game Plan (`/live`)
- Bisa dibuka dari draft (tombol "Start game plan", atau "Game plan with {hero}" di tiap saran pick), atau diisi manual.
- Isi: item untuk melawan lineup musuh beserta alasannya, build biasa per fase (starting, boots, laning, mid, late) dengan waktu beli, kurva kekuatan kedua tim menurut durasi, komposisi damage musuh, dan skill musuh yang perlu diwaspadai.
- Tombol "Got it?" menandai item yang sudah dibeli. Pilihan Behind/Even/Ahead mengubah urutan saran dan menambah tips. Game time menyorot fase yang sedang berjalan. Semua disimpan di URL.
- Setelah hero dan musuh terisi, setelan dilipat supaya di HP hasilnya langsung terlihat.

### Cheat sheet (`/heroes/[id]`)
- Hero yang meng-counter (per kelompok rank), item yang membantu per peran, skill berbahaya, kapan hero paling kuat, item penting hero tersebut, dan hero yang lemah melawannya.
- Dibuka dari halaman Heroes ("How to play against ...").

### Data manual
- `data/hero-traits.json`: 10 sifat untuk 127 hero, drafnya dari `npm run draft:hero-traits` lalu direview satu per satu. Hero yang paling perlu dicek pemilik: Ring Master dan Largo (hero baru, belum diberi sifat), serta hero yang sering dimainkan.
- `data/counter-items.json`: 12 aturan item counter.
- Cara update per patch: [PATCH_CHECKLIST.md](PATCH_CHECKLIST.md).

### Lain-lain
- Beranda: label "In development" diganti link ke tiap fitur. Menu navigasi mendapat "Game plan".
- Link OpenDota/STRATZ di laporan match hanya untuk admin (PR #5).
- Test: 71 unit test.

## Temuan Tahap 2
- **Token STRATZ hanya boleh dipakai dari 2 IP per 15 menit.** Server Vercel memakai IP yang berganti-ganti, jadi request dari production bisa ditolak dan draft jatuh ke data cadangan OpenDota. Solusinya sinkron harian lewat GitHub Actions (tugas 2.1).
- STRATZ punya data pembelian item per menit (`itemFullPurchase`), starting items, boots, winrate per durasi (`stats` dengan `groupByTime`), dan rata-rata damage physical/magic/pure, stun, heal, serta invisible per hero. Semua per posisi per bracket.
- **Flag `bkbpierce` OpenDota juga menandai serangan fisik** (mis. Coup de Grace PA, Focus Fire WR). Label "Goes through BKB" hanya ditampilkan untuk hero yang memang punya disable menembus BKB menurut `hero-traits.json`.
- **Statistik item STRATZ mencakup periode lebih panjang daripada statistik posisi,** sehingga persentase pembeli sempat lewat 100%. Penyebutnya sekarang diambil yang terbesar.
- **Winrate per durasi dari STRATZ hanya sampai menit 35.** Untuk kurva kekuatan dipakai data OpenDota (bin 5 menit sampai 60+).
- **Statistik stun/disable STRATZ tidak konsisten** (Magnus hampir nol), jadi tidak dipakai untuk aturan item.

## Catatan lain
- Node 20.18 masih jalan; upgrade ke 22 tetap disarankan.
- Build menampilkan 2 peringatan tidak berbahaya: Next belum punya metrik fallback untuk font Atkinson Hyperlegible.
- Aksara Jawa belum dipakai sampai dicek penutur asli.
