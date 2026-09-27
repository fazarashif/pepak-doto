# Progres

> Rencana lengkap: [PRD.md](PRD.md) dan [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md).

## Status saat ini (2026-09-27)

**Tahap 0 (Fondasi): kode selesai di branch `feat/foundation`, menunggu setup Vercel + Neon oleh pemilik.**

### Selesai
| # | Tugas | Catatan |
|---|---|---|
| 0.1–0.4 | Scaffold, client OpenDota, helper Dota, repo GitHub | |
| 0.5 | Dependency | Zod, jose, Drizzle, Neon driver, PGlite, Phosphor, next-themes, cva, Vitest, Prettier, Vercel Analytics. Node masih 20.18 (jalan), upgrade ke 22 tetap disarankan |
| 0.7 | Skema DB + migrasi | `users`, `app_settings`, `api_cache`, `api_usage`. Migrasi di `drizzle/`. Lokal otomatis memakai PGlite (`.data/pglite`, tidak di-commit) dan migrasi jalan sendiri |
| 0.8 | Login Steam | OpenID 2.0 + cookie state anti-CSRF + verifikasi ke Steam + session JWT (30 hari). Logout dan hapus akun lewat server action |
| 0.9 | Admin | `/admin` hanya untuk Steam ID di `ADMIN_STEAM_IDS` (selain itu 404). Menampilkan status layanan, jumlah user, dan pemakaian API 7 hari |
| 0.10 | Layout | Tema gelap (default) + terang, navigasi desktop/HP, skip link, footer + disclaimer Valve, halaman Privacy, 404 |
| 0.11 | Profil | Avatar, nama, rank, form preferensi (rank + posisi), catatan kalau data match privat |
| 0.12 | Hero picker | Pencarian, filter atribut, state kosong. Dipakai di `/heroes` (winrate per rank, hero terpilih tersimpan di URL) |
| 0.13 | Client STRATZ | Token terverifikasi (15.000 request/hari). Query `heroVsHeroMatchup` (synergy + advantage) sudah dicoba |
| 0.14 | Error ramah | Halaman tetap jalan kalau DB/API gagal; pesan jelas di Heroes dan Sign in |
| – | Cache 2 lapis | Memori + tabel `api_cache`. Cron harian `/api/cron/daily` membersihkan cache kedaluwarsa (`vercel.json`) |
| – | Test | 16 unit test (validasi OpenID, konversi ID, redirect aman, bracket STRATZ). Lint, typecheck, dan build production lulus |

### Menunggu pemilik
1. **Vercel:** import repo `fazarashif/pepak-doto` di vercel.com, lalu pasang **Neon** dari tab Storage/Marketplace. Env `DATABASE_URL` terisi otomatis.
2. **Env di Vercel:** `SESSION_SECRET` (buat baru, jangan pakai yang lokal), `ADMIN_STEAM_IDS`, `STRATZ_TOKEN`, `STEAM_WEB_API_KEY`, `CRON_SECRET`.
3. **Migrasi ke Neon:** `npm run db:migrate` dengan `DATABASE_URL` Neon.
4. **SteamID64 pemilik** untuk `ADMIN_STEAM_IDS` (lokal dan Vercel).
5. Coba login Steam sendiri (tidak bisa dites otomatis karena butuh akun asli).

### Temuan yang perlu diingat untuk Tahap 1
- **OpenDota tidak punya data Immortal** (`8_pick` = 0 untuk semua hero). Draft untuk user Immortal perlu memakai data Divine atau STRATZ (`DIVINE_IMMORTAL`).
- STRATZ mengelompokkan rank berpasangan (Herald–Guardian, Crusader–Archon, Legend–Ancient, Divine–Immortal). Nilai `synergy` sudah dalam poin persen.
- JSON match OpenDota ±230 KB, jadi hanya di-cache di memori. Yang disimpan permanen nanti adalah laporan ringkas.
- `.env.local` di laptop pertama sempat berupa folder; isinya sudah dipindah ke file yang benar. Folder aslinya ada di `.env.local.original/` (diabaikan Git, boleh dihapus).

## Berikutnya: Tahap 1
Draft Assistant (STRATZ + meta + hero pool) dan Post-Match Analyzer. Rincian di DEVELOPMENT_PLAN §7.
