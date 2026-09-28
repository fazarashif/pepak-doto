# Progres

> Rencana lengkap: [PRD.md](PRD.md) dan [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md). Setup hosting: [SETUP.md](SETUP.md).

## Status saat ini (2026-09-28)

- **Tahap 0 (Fondasi):** selesai dan live di Vercel + Neon. Login Steam, halaman admin, dan desain Pepak Doto sudah berjalan.
- **Tahap 1 (MVP):** Draft Assistant dan Post-Match Analyzer ada di branch `feat/stage-1`, menunggu review PR.

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
- **Tombol "Parse replay":** halaman mengecek ulang setiap 10 detik, maksimal 5 menit.
- Match Turbo, match tidak ditemukan, dan data privat masing-masing punya pesan dan ilustrasi sendiri.

### Test
- 38 unit test (mesin draft, analisis match, OpenID, helper). Lint, typecheck, dan build lulus.

## Temuan penting (sudah diterapkan)
- **Persentil kematian OpenDota sudah "makin tinggi makin baik".** Tidak dibalik. Rencana awal salah, dan ini terlihat saat dites dengan data asli (1 kematian dapat nilai D).
- **Winrate waktu item bias ke waktu lambat.** Game panjang yang sudah unggul membuat pembelian lambat terlihat bagus. Pembanding sekarang hanya bucket yang **lebih cepat** dari waktu pemain. Pembelian yang lebih lambat dari semua bucket ditandai "later than most players".
- **Item komponen** (mis. Kaya, Sange) tidak dibahas terpisah kalau item gabungannya juga dibeli.
- **Peran pemain** di match yang belum di-parse ditebak dari last hit per menit (< 2 = support). Support tidak diberi saran farming.
- **Tanda matchup STRATZ:** `vs.synergy` positif berarti hero pertama unggul. Nilainya hampir simetris dan berkorelasi 0,74 dengan winrate. Nilai dihaluskan berdasarkan jumlah match (k = 300).

## Belum dikerjakan dari Tahap 1
- **Script backtest** untuk mengkalibrasi bobot skor draft terhadap hasil match publik (DEVELOPMENT_PLAN tugas 1.5).
- **Smoke test E2E dengan Playwright** (tugas 1.8).

## Catatan lain
- Node 20.18 masih jalan; upgrade ke 22 tetap disarankan.
- Build menampilkan 2 peringatan tidak berbahaya: Next belum punya metrik fallback untuk font Atkinson Hyperlegible.
- Aksara Jawa belum dipakai sampai dicek penutur asli.
