# PRD: Pepak Doto

| | |
|---|---|
| Status | **Draft untuk direview** |
| Versi | 0.6 (2026-09-28) |
| Pemilik | Faza |
| Dokumen terkait | [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md), [PROGRESS.md](PROGRESS.md) |

> **Filosofi nama.** *"Pepak"* dalam bahasa Jawa berarti lengkap atau menyeluruh. Pepak Doto membantu pemain memahami Dota lebih dalam: tidak hanya bermain, tetapi belajar dari gameplay, mengenali kesalahan, memahami pola, dan terus berkembang.

**Riwayat perubahan**
- **0.6:**
  - Rincian F9 (narasi coaching) untuk Tahap 4 (keputusan D30–D33).
  - Game time di Game Plan menampilkan item inti berikutnya dan keadaan "saat ini".
- **0.5:**
  - Rincian F5–F8 untuk Tahap 3 (keputusan D26–D29).
  - Profil bisa dilihat siapa saja lewat account ID; target latihan tetap butuh login.
  - Parse replay otomatis untuk match baru user yang login.
- **0.4:**
  - Rincian F3 (Game Plan di `/live`) dan F4 (cheat sheet) untuk Tahap 2.
  - Data item, durasi, dan tipe damage diambil dari STRATZ per posisi per bracket.
  - Data STRATZ disinkron harian lewat GitHub Actions ke Neon karena token STRATZ hanya boleh dipakai dari 2 IP per 15 menit.
  - Timer manual ditunda; tips cheat sheet menunggu LLM di Tahap 4.
  - **LLM utama diganti ke Claude (Anthropic API, berbayar per pemakaian)** dengan model default Claude Haiku 4.5. Admin tetap bisa mengganti model atau pindah ke LLM gratis. Menggantikan keputusan 0.3 "hanya LLM gratis".
  - Link OpenDota/STRATZ di laporan match hanya tampil untuk admin.
- **0.3:**
  - Hanya LLM gratis (tanpa billing), tetap bisa diatur admin.
  - Batas narasi 10 per user dan 200 total per hari.
  - Nama dan avatar diambil dari OpenDota; Steam Web API key opsional.
  - Tanpa lisensi.
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
- **Biaya kecil, siap dikembangkan.** Hosting, database, dan data memakai free tier. Satu-satunya biaya adalah LLM utama (Claude), yang dibatasi pemakaiannya. Arsitekturnya bisa di-upgrade tanpa menulis ulang.

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
| Biaya terkendali | Hosting, database, dan data tetap di free tier. Biaya Claude API tidak melewati batas belanja yang dipasang di Anthropic Console |

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

### F3: Live Match Assistant / Game Plan (input manual, `/live`)
**User story:** *Setelah draft selesai, saya ingin tahu item apa yang harus dibeli melawan musuh ini dan rencana main tim saya.*

- **Halaman terpisah** `/live`. Di halaman draft ada tombol **"Start game plan"** yang membawa 10 hero, hero, posisi, dan rank lewat URL. `/live` juga bisa diisi manual tanpa lewat draft.
- **Dirancang untuk HP atau layar kedua:** satu kolom, bagian terpenting (item berikutnya) di atas, dan tidak ada yang berat di browser.
- **Input:**
  - 10 hero, hero dan posisi saya, bracket
  - kondisi game: ahead / even / behind (default: even)
  - opsional: item yang sudah dimiliki (item ini dicoret dari saran), menit sekarang (fase yang sedang berjalan disorot)
- **Output:**
  - **Build inti per fase** (start, early, mid, late), termasuk boots, dari data pembelian STRATZ untuk hero + posisi + bracket. Tiap item diberi waktu beli yang umum.
  - **Item situasional melawan musuh ini, dengan alasan tertulis.** Contoh: "Monkey King Bar: Phantom Assassin punya evasion." Saran untuk support dan core dibedakan.
  - **Target waktu item** beserta winrate-nya.
  - **Rencana permainan:**
    - kurva kekuatan kedua tim menurut durasi game, lalu kesimpulan sederhana (mis. "Tim Anda lebih kuat sebelum menit 30. Cari fight dan objektif lebih awal.")
    - komposisi damage musuh (physical / magic / pure) dan pengaruhnya ke item bertahan
    - skill musuh yang perlu diwaspadai: ultimate, disable panjang, skill yang menembus BKB
  - **Kondisi game mengubah penekanan:**
    - *Behind:* item bertahan dan item murah didahulukan, plus saran bermain lebih aman.
    - *Ahead:* item untuk menekan dan menutup game didahulukan.
    - *Even:* urutan standar.
- **Ditunda:** timer manual + pengingat event (rune, Roshan, Tormentor, siang/malam). Game sudah punya timer bawaan, jadi nilai tambahnya kecil.
- **Catatan:** sifat khusus hero (ilusi, evasion, ultimate yang menembus BKB, buff yang bisa di-dispel, summon, dan lain-lain) **tidak tersedia dari API**. Disusun sebagai file data sendiri (draf dibuat script dari deskripsi skill, lalu direview), dan diperbarui setiap patch besar. Hal yang bisa diukur (tipe damage, stun, heal, invisible) diambil dari statistik STRATZ.

### F4: Cheat sheet "how to play against hero X" (`/heroes/[id]`)
- Pilih hero, lalu tampil:
  - hero yang meng-counter hero tersebut, per bracket
  - item counter beserta alasannya (dari aturan yang sama dengan F3)
  - skill berbahaya
  - kapan hero tersebut paling kuat (kurva winrate menurut durasi game)
  - build yang biasa dipakai hero tersebut, supaya tahu kapan item pentingnya jadi
- **Tahap 2 hanya menampilkan data.** Tips tertulis dibuat dengan LLM di Tahap 4 dan disimpan per patch.

### Halaman profil pemain (F5–F8)
- **Alamat:** `/players/[accountId]`. Bisa dibuka siapa saja untuk akun yang datanya publik, termasuk tamu (D27). `/profile` tetap untuk pengaturan akun sendiri dan menautkan ke profil pemain milik user.
- **Tab:** Trends, Heroes, Goals, Wards.
- **Sumber data** tanpa parse replay:
  - `/players/{id}/matches`: satu request untuk banyak match, berisi hero, K/D/A, GPM, XPM, LH, damage, durasi, party, dan rank rata-rata.
  - `/benchmarks?hero_id=`: persentil per hero, di-cache.

  Persentil tiap match dihitung sendiri dari dua sumber ini, jadi tidak perlu membuka detail tiap match.
- **Penyimpanan:**
  - Ringkasan match untuk user yang login disimpan di tabel `match_summaries` (dipakai target latihan).
  - Akun lain (dibuka tamu) hanya di-cache sementara, supaya database tidak membengkak.
- **Parse otomatis (D26):** cron harian meminta parse untuk match 7 hari terakhir milik user yang login dan belum di-parse, maksimal 10 match per user per hari. Data dari replay (LH@10, ward) masuk ke ringkasan setelah parse selesai.
- **Match Turbo tidak ikut**, begitu juga match yang ditinggal (abandon).

### F5: Tren performa
- Dari **50 match terakhir** (bisa diganti ke 20) **tanpa Turbo** (D29):
  - grafik persentil GPM, XPM, LH/menit, kematian/menit, dan damage/menit per match, dengan rata-rata bergerak
  - winrate per hero, posisi, durasi game, dan solo/party
- **Pola berulang**, dideteksi dengan aturan sederhana dan ditulis sebagai kalimat. Contoh:
  - "Di game yang kalah, Anda mati rata-rata 2× lebih banyak."
  - "Winrate Anda 38% di game lebih dari 40 menit."
  - "Sebagai Pos 5 persentil GPM Anda bagus, tapi kematian tinggi."
- Setiap pola disertai jumlah game yang mendasarinya. Pola dengan sampel terlalu kecil tidak ditampilkan.

### F6: Analisis hero pool
- Membandingkan winrate pribadi (dihaluskan) dengan winrate meta hero tersebut di bracket user (data STRATZ hasil sinkron), lalu membagi hero ke 4 kuadran:
  - *core*: sering dimainkan dan di atas meta
  - *potential*: jarang dimainkan tapi di atas meta
  - *trap*: sering dimainkan tapi di bawah meta
  - *avoid*: jarang dan di bawah meta
- Rekomendasi hero untuk difokuskan per posisi.

### F7: Target latihan
- **Hanya untuk user yang login.** Disimpan di akun (tabel `goals`), jadi sama di semua perangkat.
- **Target bebas (D28):** user memilih metrik, arah (≥ atau ≤), angka, dan jumlah game. Contoh: "LH@10 ≥ 50 dalam 10 game", "Mati ≤ 6 dalam 5 game".
- **Daftar metrik** tetap ditentukan aplikasi supaya bisa dicek otomatis:
  - tanpa parse: kematian, K/D/A, GPM, XPM, LH/menit, damage/menit, winrate, dan persentil masing-masing
  - butuh parse: LH@10, denies@10, observer dan sentry yang dipasang
- **Pengecekan:** target dicek otomatis dari match baru (termasuk hero dan posisi kalau user membatasinya). Match yang belum di-parse tidak dihitung untuk metrik yang butuh parse.
- **Tampilan:** progres (mis. "7 dari 10 game tercapai"), riwayat per match, dan status selesai.

### F8: Heatmap ward
- Peta posisi observer dan sentry dari `/players/{id}/wardmap` (agregat dari match yang sudah di-parse), bisa difilter observer/sentry.
- Untuk match yang sudah di-parse: umur rata-rata ward dan berapa yang di-deward musuh.
- Kalau match yang di-parse masih sedikit, tampil catatan jumlah match yang dipakai.

### F9: Narasi coaching dengan LLM
- **Tiga tempat (D30):**
  - **Match review:** "Coach's notes", yaitu 1–2 paragraf yang menjelaskan prioritas perbaikan dan hal yang sudah bagus dengan bahasa natural. Disimpan per match per pemain.
  - **Tren di profil pemain:** ringkasan pola dan persentil dari 20/50 match terakhir, ditutup satu saran latihan yang bisa langsung dijadikan target. Disimpan per akun, dan dibuat ulang kalau ada match baru.
  - **Tips cheat sheet hero:** 3–5 tips "cara melawan hero X" dari data counter, item, skill berbahaya, dan kurva kekuatan. Disimpan per hero per kelompok rank per patch, lalu dibaca semua orang.
- **Dibuat lewat tombol** ("Get coaching notes" / "Get tips"), bukan otomatis (D31). Narasi yang sudah ada langsung tampil tanpa tombol.
- **Membuat narasi baru butuh login** (D32). Tamu tetap bisa membaca narasi yang sudah tersimpan, misalnya tips cheat sheet.
- **Batas:** narasi dari cache tidak dihitung. Narasi baru masuk ke batas 10 per user per hari dan 200 total per hari.
- LLM **hanya menerima fakta terstruktur** dan tidak boleh menambah fakta baru. Prompt tidak berisi nama pemain, Steam ID, atau match ID.
- **Pemeriksaan otomatis:** narasi yang menyebut hero atau item di luar data yang diberikan ditolak. Router lalu mencoba provider berikutnya, dan terakhir memakai teks template.
- Bahasa narasi: Inggris, sama dengan UI.
- **Model dipilih admin** lewat F11. Kalau semua provider gagal, dipakai teks template.

### F10: Auto-input via GSI (ditunda)
- Ditunda karena kekhawatiran aplikasi jadi berat. Didiskusikan setelah Tahap 3.

### F11: Panel admin
**User story:** *Sebagai admin, saya ingin memilih LLM yang dipakai aplikasi (Claude atau yang gratis) dan memantau pemakaiannya, tanpa perlu deploy ulang.*

- **Akses:** awalnya hanya pemilik aplikasi. Steam ID admin disimpan di environment variable, bukan di UI.
- **Pengaturan LLM:**
  - **Default: Claude Haiku 4.5** (Anthropic API, berbayar per pemakaian). Admin bisa memilih model Claude lain, mis. Claude Sonnet 5 kalau butuh kualitas lebih.
  - **Pilihan gratis** tetap tersedia dan bisa dijadikan utama atau cadangan: **Google Gemini** (free tier Flash / Flash-Lite), **Groq**, **OpenRouter** (model `:free`), dan **provider lain yang kompatibel dengan format OpenAI**, misalnya Cerebras atau Mistral. Yang disiapkan di Tahap 4: **Gemini dan OpenRouter** (D33).
  - Kalau Claude error atau batas belanja tercapai, router otomatis pindah ke cadangan gratis.
  - API key disimpan di **environment variable Vercel**; UI hanya menampilkan status "configured".
  - Provider hanya tampil aktif kalau API key-nya sudah diisi di server.
  - Admin memilih **model utama** dan **urutan cadangan**.
  - Tombol **"Test"** untuk mencoba provider.
  - Opsi mematikan fitur LLM sepenuhnya.
- **Batas pemakaian** (default, bisa diubah admin): **10 narasi per user per hari**, **200 total per hari**.
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
| **Nama profil + avatar + URL profil** | OpenDota `/players/{id}` (profil Steam yang disalin OpenDota). Steam Web API opsional untuk data terbaru | Tampilan di header dan profil | Ya (diperbarui saat login) |
| **Rank (medal) + estimasi MMR** | OpenDota `/players/{id}` | Default bracket untuk draft | Ya (diperbarui berkala) |
| **Riwayat match + statistik hero** | OpenDota / STRATZ | Hero pool, tren, target latihan, recent matches | Ringkasan per match saja |
| **Preferensi** (bracket, posisi) & **target latihan** | Input user | Personalisasi | Ya |

**Tidak diambil sama sekali:** password, email, nomor telepon, daftar teman, inventory, dan data pembayaran. Steam OpenID memang tidak memberikan data-data ini.

**Catatan penting:**
- **Login Steam tidak membuka data match privat.** Data match tetap berasal dari OpenDota/STRATZ, jadi user tetap harus mengaktifkan *Expose Public Match Data* di pengaturan Dota 2.
- **Steam Web API key tidak wajib.** Nama dan avatar diambil dari OpenDota (terverifikasi). Kalau nanti dibutuhkan data yang lebih segar, admin bisa membuat key di steamcommunity.com/dev/apikey. Syaratnya akun tidak *limited* (pernah belanja minimal $5) dan mengisi domain `pepak-doto.vercel.app`.
- User yang **tidak login** tetap bisa memakai Draft Assistant dan Post-Match Analyzer.
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
| Build item per posisi per bracket (full, starting, boots) | **STRATZ** `itemFullPurchase`, `itemStartingPurchase`, `itemBootPurchase` | Terverifikasi 2026-09-28 |
| Winrate per durasi game, tipe damage, stun, heal, invisible | **STRATZ** `heroStats.stats` | Terverifikasi 2026-09-28 |
| Item populer, waktu beli item, winrate per durasi (cadangan) | OpenDota | Terverifikasi |
| Match, benchmarks, parse replay | OpenDota | Terverifikasi |
| Profil Steam (nama, avatar) | OpenDota `/players/{id}`; Steam Web API opsional | Terverifikasi |
| Konstanta (hero, item, skill) | OpenDota `/constants/*` (dotaconstants) | Terverifikasi |
| Sifat hero untuk counter item | **Disusun sendiri** | Pekerjaan manual per patch |
| Narasi | LLM pilihan admin | Lihat F11 |

## 10. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kuota atau token STRATZ bermasalah | Draft kurang akurat | Cadangan otomatis ke OpenDota. Token diperpanjang tahunan (lihat checklist) |
| Token STRATZ hanya boleh dipakai dari **2 IP per 15 menit**, sedangkan IP server Vercel berganti-ganti | Request dari Vercel ditolak, draft jatuh ke data cadangan | Sinkron harian lewat GitHub Actions (satu IP) ke Neon. Website hanya membaca Neon |
| Kuota OpenDota habis saat user bertambah | Fitur berhenti | Cache di DB, refresh meta terjadwal. API key berbayar kalau perlu |
| Biaya Claude API membengkak | Tagihan tak terduga | Batas belanja bulanan di Anthropic Console, batas 10/user dan 200/hari di aplikasi, cache narasi, pindah otomatis ke LLM gratis |
| Kuota LLM gratis habis atau kebijakannya berubah | Narasi cadangan tidak tampil | Beberapa provider cadangan, batas harian di F11, teks template sebagai pilihan terakhir |
| Free tier Gemini (kalau dipakai sebagai cadangan) boleh dipakai Google untuk melatih model | Isi prompt terlihat oleh Google | Prompt hanya berisi statistik match (tanpa nama atau ID pemain). Disebutkan di Privacy Policy |
| Storage DB free (0,5 GB) penuh | Tulis data gagal | Simpan ringkasan, bukan JSON match mentah. Cache mentah dibersihkan otomatis. Pantau di admin |
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
| D8 | LLM | **Utama: Claude (Anthropic API, berbayar), default Claude Haiku 4.5.** Admin bisa mengganti model atau memakai LLM gratis. Satu model utama + cadangan (diperbarui 2026-09-28; sebelumnya hanya LLM gratis) |
| D9 | Monetisasi | Mungkin nanti; mulai non-komersial |
| D10 | Repo | GitHub `fazarashif/pepak-doto` (public), **tanpa lisensi** |
| D11 | Logo | Didiskusikan nanti; tanyakan ke pemilik saat waktunya |
| D12 | Tanpa login | Draft dan Post-Match bisa dipakai tanpa login |
| D13 | Admin | Hanya pemilik aplikasi (dulu) |
| D14 | API key | Environment variable Vercel |
| D15 | Batas LLM | 10 per user, 200 total per hari |
| D16 | Domain | `pepak-doto.vercel.app` dulu |
| D17 | Database | Neon Postgres (justifikasi di DEVELOPMENT_PLAN §2.1) |
| D18 | Analytics | Vercel Web Analytics (tanpa cookie) |
| D19 | Steam Web API key | Tidak wajib; profil dari OpenDota |
| D20 | Game Plan | Halaman terpisah `/live`, diisi dari draft lewat tombol "Start game plan" atau manual |
| D21 | Sifat hero | Draf dari script, semua hero direview saat development, pemilik cek sampel (mis. 10 hero yang sering dimainkan) |
| D22 | Timer manual | Ditunda |
| D23 | Tips cheat sheet | Data saja di Tahap 2; tips tertulis dari LLM di Tahap 4 |
| D24 | Sinkron STRATZ | GitHub Actions harian menulis ke Neon; secret `STRATZ_TOKEN` dan `DATABASE_URL` di GitHub |
| D25 | Link sumber data | Link OpenDota/STRATZ di laporan match hanya untuk admin |
| D26 | Parse otomatis | Cron harian meminta parse match 7 hari terakhir milik user yang login, maks 10 per user per hari |
| D27 | Akses profil | Siapa saja bisa melihat profil akun publik lewat account ID (`/players/[id]`); target latihan butuh login |
| D28 | Target latihan | Bebas: metrik (dari daftar), arah, angka, jumlah game |
| D29 | Jumlah match tren | 50 terakhir (bisa 20), tanpa Turbo |
| D30 | Tempat narasi LLM | Match review, tren profil pemain, tips cheat sheet hero |
| D31 | Pemicu narasi | Tombol di halaman; narasi tersimpan tampil langsung |
| D32 | Membuat narasi | Hanya user yang login; tamu bisa membaca yang tersimpan |
| D33 | LLM cadangan | Gemini dan OpenRouter (free tier), setelah Claude |

## 12. Pertanyaan terbuka
Lihat daftar pertanyaan di [DEVELOPMENT_PLAN §11](DEVELOPMENT_PLAN.md#11-pertanyaan-terbuka).
