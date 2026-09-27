# PRD: Pepak Doto

| | |
|---|---|
| Status | **Draft untuk direview** |
| Versi | 0.2 (2026-09-27) |
| Pemilik | Faza |
| Dokumen terkait | [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md), [PROGRESS.md](PROGRESS.md) |

> **Filosofi nama.** *"Pepak"* dalam bahasa Jawa berarti lengkap atau menyeluruh. Pepak Doto membantu pemain memahami Dota lebih dalam: tidak hanya bermain, tetapi belajar dari gameplay, mengenali kesalahan, memahami pola, dan terus berkembang.

**Riwayat perubahan**
- **0.2:**
  - Nama Pepak Doto; aplikasi publik; UI Bahasa Inggris; login Steam.
  - Match Turbo tidak dianalisis; hosting free tier di Vercel yang bisa di-scale.
  - STRATZ dipakai sejak awal; ada panel admin untuk memilih LLM.
- **0.1:** draft awal.

---

## 1. Latar belakang dan masalah

Pemain Dota 2 di pub (Herald sampai Divine) umumnya sulit berkembang karena tiga hal:

1. **Draft:** tidak tahu hero mana yang tepat melawan hero musuh dan cocok di patch sekarang.
2. **Saat bermain:** membeli item yang sama setiap game tanpa menyesuaikan dengan musuh, dan tidak punya rencana permainan.
3. **Setelah bermain:** tidak tahu kenapa kalah atau menang. Situs statistik penuh angka tapi tidak menjelaskan "apa yang harus diperbaiki".

Datanya sebenarnya tersedia gratis (OpenDota, STRATZ), hanya belum diolah menjadi **saran yang bisa langsung dipraktikkan**.

## 2. Visi produk

> Asisten web yang menemani pemain di **tiga momen**: draft, saat bermain, dan setelah bermain. Setiap saran didukung data dan dijelaskan dengan bahasa sederhana.

**Prinsip produk:**
- **Sederhana.** Input minimal. Hero yang diinput saat draft dipakai ulang di fase berikutnya.
- **Berbasis data.** Setiap rekomendasi punya alasan yang bisa dicek.
- **Fokus ke perbaikan.** Output utama adalah "apa yang harus dilakukan berikutnya".
- **Legal dan aman.** Tidak membaca memori game dan tidak melanggar aturan Valve.
- **Mulai gratis, siap dikembangkan.** Semua layanan memakai free tier, tapi dengan arsitektur yang bisa di-upgrade tanpa menulis ulang.

## 3. Target pengguna

Aplikasi **terbuka untuk umum**; di awal penggunanya diperkirakan sedikit.

| Persona | Deskripsi | Kebutuhan utama |
|---|---|---|
| **Pemain yang ingin naik rank** (utama) | Main 3–10 game per minggu, rank Crusader–Ancient, main di 1–2 posisi | Tahu harus pick apa, beli item apa, dan kesalahan yang berulang |
| **Pemain baru / kembali** | Belum hafal counter dan item | Cheat sheet dan panduan sederhana |
| **Pemain kompetitif santai** | Sudah paham dasar, ingin mengukur perkembangan | Tren performa dan target latihan |
| **Admin** (pemilik aplikasi) | Mengelola konfigurasi aplikasi | Memilih LLM, memantau pemakaian dan kuota |

Platform: **web responsif**. Dibuka di PC, atau di HP sebagai layar kedua saat bermain. **Bahasa UI: Inggris.**

## 4. Tujuan dan ukuran keberhasilan

| Tujuan | Ukuran |
|---|---|
| Rekomendasi draft cepat dipakai saat pick | Respons < 2 detik (data sudah di-cache), < 6 detik (cold) |
| Laporan post-match mudah dipahami | Laporan tampil < 5 detik untuk match yang sudah di-parse; maksimal 3 prioritas perbaikan |
| Rekomendasi draft relevan | Backtest ke match publik: skor lebih tinggi berkorelasi dengan winrate lebih tinggi |
| User benar-benar berkembang | (Tahap 3) Target latihan tercapai; tren metrik utama membaik dalam 20 match |
| Biaya nol di awal | Semua layanan tetap dalam free tier. Pemakaian Gemini Pro tertutup kredit Google Cloud bulanan |

## 5. Ruang lingkup fitur

Prioritas: **P0** = wajib di MVP, **P1** = penting, **P2** = nice-to-have / butuh diskusi.

| ID | Fitur | Prioritas | Tahap |
|---|---|---|---|
| F0 | Login Steam + profil pengguna | P0 | 0 |
| F1 | Draft Assistant | P0 | 1 |
| F2 | Post-Match Analyzer | P0 | 1 |
| F3 | Live Match Assistant (input manual) | P1 | 2 |
| F4 | Cheat sheet "how to play against hero X" | P1 | 2 |
| F5 | Tren performa | P1 | 3 |
| F6 | Analisis hero pool | P1 | 3 |
| F7 | Target latihan | P1 | 3 |
| F8 | Heatmap ward | P2 | 3 |
| F9 | Narasi coaching dengan LLM | P1 | 4 |
| F10 | Auto-input via GSI | P2, **ditunda, perlu diskusi** | 5 |
| F11 | Panel admin (pilih LLM, pantau pemakaian) | P1 | 0 (dasar), 4 (LLM) |

### F0: Login Steam dan profil pengguna
- **Login dengan Steam** (Steam OpenID). Pepak Doto tidak pernah melihat password Steam.
- Setelah login, profil otomatis terisi dari Steam dan OpenDota. Detail data yang diambil ada di **§6**.
- Pengguna mengatur **bracket rank** (default dari rank OpenDota) dan **posisi utama**.
- Pengguna bisa **logout** dan **menghapus akun beserta datanya**.
- *Pengguna tanpa login:* lihat pertanyaan terbuka Q1.
- **Kriteria diterima:**
  - Login dan logout berjalan.
  - Profil menampilkan nama, avatar, dan rank.
  - Kalau *Expose Public Match Data* mati, muncul pesan yang menjelaskan cara mengaktifkannya.

### F1: Draft Assistant
**User story:** *Sebagai pemain, saat draft saya ingin memasukkan hero musuh dan tim saya, lalu mendapat daftar hero yang sebaiknya saya pick beserta alasannya.*

- **Input:**
  - hero tim (0–4)
  - hero musuh (0–5)
  - hero yang di-ban
  - bracket dan posisi (default dari profil)
  - toggle "only my hero pool"
- **Output:**
  1. **Top 10–15 rekomendasi**, masing-masing dengan skor dan alasan:
     - counter terhadap hero musuh (sumber utama **STRATZ**, data pub per bracket)
     - **synergy dengan hero tim** (STRATZ)
     - meta di bracket user
     - statistik pribadi user dengan hero tersebut
     - kebutuhan tim yang diisi
  2. **Saran ban** (5 hero).
  3. **Peringatan komposisi.**
- **Perilaku:** rekomendasi otomatis diperbarui setiap kali hero ditambah atau dihapus. Hero yang sudah dipick atau di-ban tidak muncul lagi.
- **Kriteria diterima:**
  - Tetap bisa memberi rekomendasi walau belum ada hero musuh.
  - Filter posisi mengurangi daftar ke hero yang wajar untuk posisi itu.
  - Setiap rekomendasi punya minimal 1 alasan.
  - Kalau STRATZ gagal, otomatis pindah ke data OpenDota dengan label "limited data".

### F2: Post-Match Analyzer
**User story:** *Setelah match, saya ingin memasukkan match ID dan mendapat evaluasi: apa yang sudah bagus dan 3 hal utama yang harus diperbaiki.*

- **Input:**
  - match ID, atau klik dari daftar "my recent matches" (untuk user yang login)
  - pilih pemain; otomatis kalau user login dan ada di match itu
- **Output:**
  - **Ringkasan:** hero, hasil, KDA, durasi, item akhir.
  - **Nilai A–D per aspek:** Farming, Experience, Damage, Survival, Participation. Dibandingkan dengan pemain lain yang memakai hero yang sama.
  - **Kalau replay sudah di-parse**, tambahan:
    - laning (LH/deny menit 10, efisiensi lane, selisih gold lane)
    - kematian (per fase game, siapa pembunuhnya)
    - waktu beli item inti dibandingkan winrate
    - vision (untuk support)
  - **Hasil akhir:** "What went well" dan maksimal **3 prioritas perbaikan** dengan saran konkret.
- **Kalau belum di-parse:** tampilkan analisis dasar dulu, lalu sediakan tombol **"Parse replay"** dengan status proses.
- **Match Turbo tidak didukung.** Muncul pesan jelas dan match Turbo tidak masuk daftar recent matches.
- **Kriteria diterima:**
  - Match privat atau tidak ditemukan menampilkan pesan yang jelas.
  - Match yang sama tidak di-fetch ulang (cache).

### F3: Live Match Assistant (input manual)
**User story:** *Setelah draft selesai, saya ingin tahu item apa yang harus dibeli melawan musuh ini dan rencana main tim saya.*

- **Input:**
  - 10 hero (otomatis dari F1), hero dan posisi saya
  - kondisi game: ahead / even / behind
  - opsional: item yang dimiliki, menit sekarang
- **Output:**
  - build inti per fase
  - item situasional berdasarkan musuh, dengan alasan
  - target waktu item beserta winrate-nya
  - rencana permainan: kapan tim paling kuat, gaya tim, skill musuh yang perlu diwaspadai
  - opsional: timer manual + pengingat event
- **Catatan:** data sifat hero (evasion, ilusi, heal, dan lain-lain) **tidak tersedia dari API**. Disusun sebagai file data sendiri dan diperbarui setiap patch besar.

### F4: Cheat sheet "how to play against hero X"
- Pilih hero, lalu tampil:
  - hero yang meng-counter hero tersebut
  - item counter
  - skill berbahaya
  - kapan hero tersebut paling kuat
  - tips singkat
- Teks tips dibuat dengan LLM di Tahap 4, disimpan per patch.

### F5: Tren performa
- Dari 20–50 match terakhir **(tanpa Turbo)**: grafik persentil GPM/XPM/LH, kematian, dan winrate per hero, posisi, dan durasi.
- Mendeteksi **pola berulang**.

### F6: Analisis hero pool
- Membandingkan winrate pribadi dengan meta di bracket user, lalu membagi hero ke dalam 4 kuadran: *core*, *potential*, *trap*, *avoid*.
- Rekomendasi hero untuk difokuskan per posisi.

### F7: Target latihan
- User memasang target (misalnya "LH@10 ≥ 50 dalam 10 game"), dicek otomatis dari match baru.
- Disimpan di akun, jadi tersinkron antar perangkat.

### F8: Heatmap ward
- Peta posisi ward dari riwayat user, ditambah analisis umur ward per match.

### F9: Narasi coaching dengan LLM
- Mengubah hasil F2, F5, dan F4 menjadi paragraf saran.
- LLM **hanya menerima fakta terstruktur** dan tidak boleh menambah fakta baru.
- **Model yang dipakai dipilih admin** lewat F11. Kalau semua provider gagal, dipakai teks template.
- Hasil disimpan per match per pemain.

### F10: Auto-input via GSI (ditunda)
- Ditunda karena kekhawatiran aplikasi jadi berat. Didiskusikan setelah Tahap 3.

### F11: Panel admin
**User story:** *Sebagai admin, saya ingin memilih LLM yang dipakai aplikasi (Gemini Pro dari akun Google saya atau model gratis lain) dan memantau pemakaiannya, tanpa perlu deploy ulang.*

- **Akses:** hanya akun Steam yang terdaftar sebagai admin. Daftarnya disimpan di environment variable, bukan di UI.
- **Pengaturan LLM:**
  - Daftar provider yang tersedia: **Google Gemini** (Pro atau Flash), **Groq**, **OpenRouter**, dan **provider lain yang kompatibel dengan format OpenAI**.
  - Provider hanya tampil aktif kalau API key-nya sudah diisi di server.
  - Admin memilih **model utama** dan **urutan cadangan**.
  - Tombol **"Test"** untuk mencoba provider.
  - Opsi mematikan fitur LLM sepenuhnya.
- **Batas pemakaian:** batas narasi per user per hari dan batas total per hari, untuk menjaga kuota dan kredit.
- **Monitoring:**
  - jumlah request LLM per provider (hari ini dan bulan ini), perkiraan token
  - sisa kuota OpenDota dan STRATZ
  - jumlah user
- **Kriteria diterima:**
  - Pergantian model langsung berlaku tanpa deploy ulang.
  - Non-admin yang membuka halaman admin mendapat 404.
  - API key tidak pernah tampil utuh di UI.

## 6. Login Steam: data yang diambil dan kegunaannya

| Data | Sumber | Dipakai untuk | Disimpan? |
|---|---|---|---|
| **SteamID64** | Steam OpenID (bukti login) | Identitas akun; dikonversi ke account ID Dota untuk mengambil data OpenDota/STRATZ | Ya |
| **Nama profil + avatar + URL profil** | Steam Web API `GetPlayerSummaries` | Tampilan di header dan profil | Ya (diperbarui saat login) |
| **Rank (medal) + estimasi MMR** | OpenDota `/players/{id}` | Default bracket untuk draft | Ya (diperbarui berkala) |
| **Riwayat match + statistik hero** | OpenDota / STRATZ | Hero pool, tren, target latihan, recent matches | Ringkasan per match saja |
| **Preferensi** (bracket, posisi) & **target latihan** | Input user | Personalisasi | Ya |

**Tidak diambil sama sekali:** password, email, nomor telepon, daftar teman, inventory, dan data pembayaran. Steam OpenID memang tidak memberikan data-data ini.

**Catatan penting:**
- **Login Steam tidak membuka data match privat.** Data match tetap berasal dari OpenDota/STRATZ, jadi user tetap harus mengaktifkan *Expose Public Match Data* di pengaturan Dota 2.
- Pepak Doto butuh **Steam Web API key** (milik admin) untuk `GetPlayerSummaries`. Syarat dari Steam: akun tidak *limited* (pernah belanja minimal $5) dan harus mengisi nama domain saat mendaftar.
- User bisa menghapus akunnya; semua data miliknya ikut terhapus.
- Tersedia halaman **Privacy Policy** dan disclaimer *"Dota 2 is a registered trademark of Valve Corporation. Pepak Doto is not affiliated with Valve."*

## 7. Di luar ruang lingkup (non-goals)
- Membaca match secara live dari memori game atau overlay di dalam game.
- Parsing file replay sendiri.
- Analisis match Turbo.
- Fitur sosial, pro scene, dan betting.
- Aplikasi mobile native.
- Pembayaran atau monetisasi di fase awal. Kalau monetisasi nanti diaktifkan, hosting harus pindah ke paket berbayar karena Vercel Hobby hanya untuk non-komersial.

## 8. Kebutuhan non-fungsional

| Aspek | Kebutuhan |
|---|---|
| Performa | Draft < 2 detik (data sudah di-cache). Halaman ringan di HP |
| Kuota API | Data meta di-cache di database dan diperbarui otomatis sekali sehari. Match yang sudah di-parse disimpan permanen |
| Skalabilitas | Semua layanan free tier dengan jalur upgrade yang jelas (lihat DEVELOPMENT_PLAN §6) |
| Keandalan | Kalau API eksternal error atau rate-limit, muncul pesan jelas dan data cache lama tetap dipakai |
| Keamanan | Session cookie aman (httpOnly, signed). API key hanya di server. Akses admin dicek di server |
| Privasi | Hanya data publik + data yang diinput user. Ada Privacy Policy dan fitur hapus akun |
| Aksesibilitas | Kontras cukup, bisa dipakai dengan keyboard, layout aman di lebar 360 px |
| Bahasa | **UI Bahasa Inggris** |
| Legal | Hanya API publik dan fitur resmi Valve. Ada disclaimer trademark Valve |

## 9. Sumber data

| Data | Sumber | Catatan |
|---|---|---|
| Matchup & synergy hero (pub, per bracket, per posisi) | **STRATZ** (GraphQL, token) | Sumber utama draft. Token dari admin |
| Statistik hero per bracket, peran | OpenDota `/heroStats` | Terverifikasi |
| Matchup cadangan | OpenDota `/heroes/{id}/matchups` | Hanya match pro, sampel kecil |
| Peran lane hero | OpenDota `/scenarios/laneRoles` / STRATZ | – |
| Item populer, waktu beli item, winrate per durasi | OpenDota | Terverifikasi |
| Match, benchmarks, parse replay | OpenDota | Terverifikasi |
| Profil Steam | Steam Web API | Butuh Steam Web API key |
| Konstanta (hero, item, skill) | OpenDota `/constants/*` (dotaconstants) | Terverifikasi |
| Sifat hero untuk counter item | **Disusun sendiri** | Pekerjaan manual per patch |
| Narasi | LLM pilihan admin | Lihat F11 |

## 10. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kuota atau token STRATZ bermasalah | Draft kurang akurat | Cadangan otomatis ke OpenDota. Token diperpanjang tahunan (lihat checklist) |
| Kuota OpenDota habis saat user bertambah | Fitur berhenti | Cache di DB, refresh meta terjadwal. API key berbayar kalau perlu |
| Kredit Gemini habis atau biaya berlebih | Tagihan tidak terduga | Batas harian di F11, budget alert di Google Cloud, cadangan ke model gratis |
| Free tier (Vercel/DB) terlampaui | Aplikasi lambat atau berhenti | Monitoring di F11. Jalur upgrade sudah dirancang |
| Profil atau match privat | Fitur personal tidak jalan | Pesan jelas beserta cara mengaktifkan *Expose Public Match Data* |
| Replay kedaluwarsa atau parse gagal | Analisis detail tidak ada | Tetap tampilkan analisis dasar |
| Patch baru | Data sifat hero dan timer usang | File data diberi versi patch + checklist update |
| Monetisasi di Vercel Hobby | Melanggar ketentuan Vercel | Upgrade ke Vercel Pro (atau pindah host) sebelum monetisasi |

## 11. Keputusan yang sudah diambil
| # | Topik | Keputusan |
|---|---|---|
| D1 | Pengguna | Publik, user awal sedikit |
| D2 | STRATZ | Dipakai; token disiapkan admin |
| D3 | Hosting | Vercel (free tier), dirancang agar bisa di-upgrade |
| D4 | Bahasa UI | Inggris |
| D5 | Login | Steam |
| D6 | Turbo | Tidak dianalisis |
| D7 | Nama | Pepak Doto |
| D8 | LLM | Bisa dikonfigurasi admin: Gemini Pro milik admin atau model gratis |
| D9 | Monetisasi | Mungkin nanti; mulai non-komersial |
| D10 | Repo | GitHub `fazarashif/pepak-doto` (public) |
| D11 | Logo | Didiskusikan nanti; tanyakan ke pemilik saat waktunya |

## 12. Pertanyaan terbuka
Lihat daftar pertanyaan di [DEVELOPMENT_PLAN §11](DEVELOPMENT_PLAN.md#11-pertanyaan-terbuka).
