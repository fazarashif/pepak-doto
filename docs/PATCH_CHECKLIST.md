# Checklist update data per patch

Sebagian besar data diperbarui otomatis. Dua file di `data/` disusun manual, jadi perlu dicek setiap ada patch Dota yang besar (7.xx) atau hero baru.

| Data | Cara diperbarui |
|---|---|
| Matchup, posisi, build item, tipe damage (STRATZ) | Otomatis, sinkron harian (GitHub Actions) |
| Winrate per durasi (OpenDota) | Otomatis, sinkron harian |
| Nama item dan skill, gambar | Otomatis dari OpenDota (cache 24 jam) |
| `data/hero-traits.json` (sifat hero, skill berbahaya) | **Manual**, pakai langkah di bawah |
| `data/counter-items.json` (aturan item counter) | **Manual**, pakai langkah di bawah |
| Bobot skor draft | Cek dengan backtest |

## Langkah

1. **Tunggu 2–3 hari setelah patch.** Statistik STRATZ butuh cukup banyak match di patch baru.
2. **Jalankan script draf:**
   ```bash
   npm run draft:hero-traits
   ```
   Perhatikan output-nya:
   - *Heroes missing from data/hero-traits.json*: ada hero baru. Tambahkan ke file.
   - *Dangerous abilities that no longer exist*: skill diganti atau dihapus. Ganti dengan key skill yang baru.
   - *Counter items that no longer exist*: item dihapus. Ganti atau hapus dari `data/counter-items.json`.
3. **Cek hero yang berubah di patch notes.** Buka `.data/hero-traits.draft.json` dan lihat hero tersebut:
   - `onlyInDraft`: sifat yang terdeteksi script tapi tidak ada di file. Bisa jadi sifat baru, bisa juga salah tangkap kata kunci.
   - `onlyInReviewed`: sifat di file yang tidak lagi terdeteksi. Cek apakah skillnya memang berubah.
   - `dangerousDraft`: usulan skill berbahaya (ultimate dan skill channel).

   Script hanya membaca kata kunci, jadi keputusan akhir tetap manual.
4. **Sunting file:**
   - `data/hero-traits.json`: ubah `traits` dan `dangerous`. Isi `patch` dengan versi baru dan `reviewed` dengan tanggal hari ini.
   - `data/counter-items.json`: ubah daftar item bila ada item baru yang lebih cocok. Perbarui `patch` dan `reviewed`.

   Arti tiap sifat ada di `src/lib/items/traits.ts`.
5. **Tes:**
   ```bash
   npm test
   ```
   Tes memastikan semua sifat valid dan tiap hero punya minimal satu skill berbahaya.
6. **Cek bobot draft** (opsional, tiap patch besar):
   ```bash
   npm run backtest -- --fresh
   ```
   Kalau hasil regresi logistik jauh berbeda dari bobot sekarang (`WEIGHTS` di `src/lib/draft/engine.ts`), perbarui bobotnya dan catat di PROGRESS.md.
7. **Commit dan PR** seperti biasa. Setelah di-merge, tidak perlu langkah lain; sinkron harian mengambil statistik patch baru sendiri.

## Tahunan

- **Token STRATZ berlaku 1 tahun.** Buat token baru di https://stratz.com/api, lalu ganti `STRATZ_TOKEN` di Vercel, di GitHub Secrets, dan di `.env.local`.
