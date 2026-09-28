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
- **Smoke test E2E dengan Playwright** (tugas 1.8).

## Catatan lain
- Node 20.18 masih jalan; upgrade ke 22 tetap disarankan.
- Build menampilkan 2 peringatan tidak berbahaya: Next belum punya metrik fallback untuk font Atkinson Hyperlegible.
- Aksara Jawa belum dipakai sampai dicek penutur asli.
