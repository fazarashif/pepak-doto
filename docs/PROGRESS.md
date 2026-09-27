# Progres (dijeda 2026-09-27)

> Rencana lengkap ada di [PRD.md](PRD.md) dan [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md). Status: **menunggu review user** sebelum development dilanjutkan. Pekerjaan di bawah ini termasuk Tahap 0 (Fondasi) dan Tahap 1 (MVP) di rencana tersebut.

## Sudah selesai
- Scaffold Next.js 16 (App Router, TypeScript, Tailwind v4, `src/`), `npm install` sukses.
- `src/lib/cache.ts`: cache in-memory dengan TTL dan dedup request.
- `src/lib/opendota/types.ts`: tipe respons OpenDota.
- `src/lib/opendota/client.ts`: client OpenDota yang di-cache (heroStats, matchups, laneRoles, itemTimings, playerHeroes, recentMatches, match, requestParse, items, itemIds). Opsional memakai env `OPENDOTA_API_KEY`.
- `src/lib/dota.ts`: konstanta dan helper (bracket, posisi, URL CDN gambar, parse Steam ID, format waktu).
- `src/lib/heroes.ts`: daftar hero dari heroStats.

## Belum dikerjakan (lanjutkan dari sini)
1. `npm i server-only` (sudah di-import di client.ts dan heroes.ts, tapi paketnya belum di-install).
2. **Mesin draft** `src/lib/draft/engine.ts` (fungsi murni):
   - counter = rata-rata keunggulan vs tiap musuh dari `/heroes/{musuh}/matchups`, dihitung sebagai `1 - wins/games`, diperhalus ke 50% (k≈40). Datanya dari match pro, jadi sampelnya kecil.
   - meta = winrate di bracket dari heroStats (`{b}_win / {b}_pick`), diperhalus (k≈200).
   - hero pool = `/players/{id}/heroes`, dengan opsi "hanya hero pool" (≥5 game).
   - komposisi: bonus kecil untuk tag Disabler/Initiator yang belum dimiliki tim, ditambah peringatan (musuh banyak Escape/Pusher/Durable).
   - kecocokan posisi: dari share lane `/scenarios/laneRoles?lane_role=1..4` ditambah tag Support/Carry. Filter kalau fit < 0.25.
   - saran ban = meta + ancaman ke hero tim kita + pick rate.
   - skor ≈ counter·1.0 + meta·0.7 + komposisi + pool. Setiap rekomendasi disertai alasan dalam teks.
3. **API**: `GET /api/heroes`, `POST /api/draft`, `GET /api/match/[id]?slot=|account=`, `POST /api/match/[id]/parse`, `GET /api/player/[id]/recent`.
4. **Analisis post-match** `src/lib/match/analyze.ts` (fungsi murni):
   - nilai A–D dari `players[].benchmarks.pct`. Untuk deaths nilainya dibalik (1 - pct).
   - kalau replay sudah di-parse:
     - laning: `lh_t[10]`, `lane_efficiency_pct`, dan selisih gold lane di menit 10 vs musuh dengan `lane` yang sama.
     - kematian: `deaths_log` per fase dan `killed_by`.
     - waktu beli item: `first_purchase_time` dibandingkan bucket `/scenarios/itemTimings`.
     - vision support: `obs_placed`, `sen_placed`, `observer_kills`.
   - output: kelebihan dan maksimal 3 prioritas perbaikan (teks template, tanpa LLM dulu). Beri catatan kalau match Turbo (game_mode 23).
   - kalau belum di-parse: tetap tampilkan nilai dari benchmarks, plus tombol "Parse replay" yang lalu di-poll.
5. **UI** (tema gelap):
   - navigasi: Beranda / Draft / Analisis Match.
   - pengaturan disimpan di localStorage: Steam ID, bracket, posisi.
   - halaman `/draft`: hero picker dengan pencarian, slot Tim / Musuh / Ban, panel rekomendasi.
   - halaman `/match`: input match ID, daftar match terakhir, dan laporan.
   - pakai `<img>` biasa untuk gambar CDN (matikan aturan eslint `@next/next/no-img-element`).
6. Unit test untuk engine dan analyzer (vitest, data sintetis; jangan pakai fixture match asli karena berisi nama pemain).

## Catatan
- Node 20.18: eslint memberi peringatan engine (butuh ≥20.19). Sebaiknya upgrade ke Node 22 LTS.
- STRATZ (data synergy dan matchup pub) butuh token. Belum dites, jadi ditambahkan nanti di balik interface yang sama.
- GSI ditunda dan akan didiskusikan lagi (user khawatir aplikasinya jadi berat).
