# Panduan setup

Urutan yang disarankan:
1. Jalankan dan coba di laptop (bagian A).
2. Review lalu merge PR ke `main`.
3. Setup Vercel dan Neon (bagian B–E).

Dengan urutan ini, deploy production pertama sudah berisi semua kode dan langsung membuat tabel database.

---

## A. Menjalankan di laptop

**Sekali saja per laptop:**
1. Install **Node.js 22 LTS** dari https://nodejs.org (versi 20 masih jalan, tapi 22 lebih aman untuk ke depan).
2. Clone repo (laptop kedua):
   ```bash
   git clone https://github.com/fazarashif/pepak-doto.git
   ```
3. Buka folder project di terminal, lalu install dependency:
   ```bash
   npm install
   ```
4. Buat file `.env.local` di folder project (lihat `.env.example`). Minimal isi `SESSION_SECRET` dan `ADMIN_STEAM_IDS`. Di laptop kedua bisa juga diambil dari Vercel (lihat bagian F).

**Setiap kali mau menjalankan:**
1. Buka terminal di folder project:
   - VS Code: *File → Open Folder* ke folder project, lalu *Terminal → New Terminal*.
   - Atau Windows Terminal / PowerShell, lalu `cd` ke folder project.
2. Jalankan:
   ```bash
   npm run dev
   ```
3. Buka http://localhost:3000 di browser.
4. Stop dengan `Ctrl + C` di terminal.

Setelah mengubah `.env.local`, stop lalu jalankan ulang `npm run dev`.

**Cek login di laptop:**
1. Klik *Sign in with Steam*, login di halaman Steam, lalu kembali ke Pepak Doto.
2. Anda akan masuk ke halaman Profile.
3. Menu **Admin** muncul di navigasi karena Steam ID Anda ada di `ADMIN_STEAM_IDS`.

---

## B. Membuat project di Vercel

1. Buka https://vercel.com/signup dan pilih **Continue with GitHub** (akun `fazarashif`). Pilih paket **Hobby**.
2. Di dashboard: **Add New… → Project**.
3. Di *Import Git Repository*, pilih **pepak-doto**.
   - Kalau repo tidak muncul, klik *Adjust GitHub App Permissions* dan beri akses ke repo `pepak-doto` saja.
4. Di halaman *Configure Project*:
   - **Project Name:** `pepak-doto`. Nama ini menentukan URL `pepak-doto.vercel.app`. Kalau sudah dipakai orang lain, Vercel memberi nama lain.
   - **Framework Preset:** Next.js (terdeteksi otomatis).
   - **Build Command:** biarkan default. `npm run build` sudah termasuk migrasi database.
   - **Environment Variables:** bisa dikosongkan dulu, diisi di bagian D.
5. Klik **Deploy**. Deploy pertama ini belum punya database, jadi login belum bisa dipakai. Itu normal.

## C. Membuat database Neon lewat Vercel

Istilah: yang disebut "Database" di Vercel adalah "Project" di Neon.

**1. Masuk ke dashboard project**
- Kalau Anda masih di halaman *pepak-doto – Deployment* (detail satu deploy), klik nama **pepak-doto** di breadcrumb kiri atas, atau tombol **Continue to Dashboard**.
- Di dashboard project ada deretan tab di atas: *Overview, Deployments, Analytics, Logs, …, Storage, Settings*.

**2. Mulai membuat database**
- Klik tab **Storage**, lalu **Create Database**.
- Muncul daftar penyedia dari Marketplace. Pilih **Neon** (Serverless Postgres), lalu **Continue**.

**3. Akun Neon**
- Pilih **Create New Neon Account** (akun Neon dibuat dan ditagihkan lewat Vercel, jadi tidak perlu daftar terpisah), lalu **Continue**.
- Baca dan setujui syarat Neon.

**4. Pengaturan database**
| Pilihan | Isi |
|---|---|
| Region | **Singapore** (`aws-ap-southeast-1`) |
| Plan | **Free** |
| Database name | `pepak-doto` |
| Auth / Neon Auth (kalau ada) | **Matikan**. Login kita memakai Steam |

Klik **Create**. Tunggu beberapa detik sampai status database *Available*.

**5. Hubungkan ke project** (dialog *Connect Project*; kalau tidak muncul otomatis, buka **Storage → pepak-doto → Connect Project**)
| Pilihan | Isi |
|---|---|
| Project | `pepak-doto` |
| Environments | Centang **Production** dan **Preview**. **Jangan centang Development**, supaya laptop tetap memakai database lokal |
| Custom prefix | **Kosongkan**, supaya variabelnya bernama `DATABASE_URL` |
| Advanced Options → Deployments Configuration | Biarkan **mati** untuk sekarang |

Klik **Connect**.

**6. Cek hasilnya**
- Buka **Settings → Environment Variables**. Harus ada `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, dan beberapa `PG…`/`POSTGRES_…`. Semuanya dibuat otomatis; tidak perlu diubah.

**7. Samakan region server**
- **Settings → Functions → Function Region**, pilih **Singapore (sin1)**, lalu **Save**. Server dan database jadi berada di kota yang sama, sehingga halaman lebih cepat.

Catatan: deploy *Preview* (misalnya dari PR) memakai database yang sama dengan production, tapi migrasi hanya dijalankan saat deploy production.

## D. Mengisi environment variable

Buka **Settings → Environment Variables**. Tambahkan variabel di bawah ini dan tandai sebagai **Sensitive**.

| Nama | Nilai | Environment |
|---|---|---|
| `SESSION_SECRET` | Buat baru (perintah di bawah). Jangan pakai nilai dari laptop | Production, Preview |
| `SESSION_SECRET` | Buat satu lagi, khusus laptop | Development |
| `CRON_SECRET` | Buat baru (perintah di bawah) | Production |
| `ADMIN_STEAM_IDS` | `76561198251713204` | Production, Preview, Development |
| `STRATZ_TOKEN` | Salin dari `.env.local` | Production, Preview, Development |
| `STEAM_WEB_API_KEY` | Salin dari `.env.local` | Production, Preview, Development |

Perintah membuat nilai acak (jalankan di terminal, lalu salin hasilnya):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`DATABASE_URL` tidak perlu diisi manual; sudah terisi otomatis dari langkah C.

## E. Deploy ulang dan cek

1. Perubahan environment variable baru berlaku setelah deploy ulang. Setelah PR di-merge ke `main`, Vercel akan deploy otomatis. Kalau tidak, buka **Deployments**, pilih deploy teratas, lalu **⋯ → Redeploy**.
2. Di log build harus ada baris `[migrate] done`, yang berarti tabel sudah dibuat di Neon.
3. Buka https://pepak-doto.vercel.app, lalu **Sign in with Steam**.
4. Buka **/admin** dan pastikan baris *Database* bertuliskan **Neon**.
5. **Settings → Cron Jobs** harus menampilkan `/api/cron/daily`.

## F. Laptop kedua: mengambil env dari Vercel (opsional)

Daripada menyalin `.env.local` manual:
```bash
npx vercel login
npx vercel link
npx vercel env pull .env.local
```
Hasilnya berisi variabel environment *Development*. `DATABASE_URL` tidak ikut, jadi laptop tetap memakai PGlite.

## G. Sinkron data hero harian (GitHub Actions)

Data STRATZ (matchup, posisi, build item) dan winrate per durasi dari OpenDota diambil **sekali sehari oleh GitHub Actions**, lalu disimpan di Neon. Website hanya membaca salinan di Neon.

Alasannya, token STRATZ hanya boleh dipakai dari **2 alamat IP per 15 menit**, sedangkan server Vercel memakai IP yang berganti-ganti. Karena itu di Vercel aplikasi tidak memanggil STRATZ langsung.

**Sekali saja: isi secret di GitHub**
1. Ambil connection string Neon production:
   - Vercel → project `pepak-doto` → **Storage** → klik database Neon → tab **.env.local** → klik **Show secret**.
   - Salin nilai `DATABASE_URL` (diawali `postgresql://`).
2. Buka https://github.com/fazarashif/pepak-doto → **Settings → Secrets and variables → Actions → New repository secret**.
3. Tambahkan dua secret:

   | Name | Secret |
   |---|---|
   | `STRATZ_TOKEN` | Token STRATZ (sama dengan di `.env.local`) |
   | `DATABASE_URL` | Connection string dari langkah 1 |

   `OPENDOTA_API_KEY` boleh dilewati; tanpa key tetap jalan.

**Menjalankan pertama kali (tidak perlu menunggu jadwal)**
1. Pastikan PR yang berisi tabel `hero_data` sudah di-merge dan deploy production selesai (log build berisi `[migrate] done`).
2. GitHub → tab **Actions** → **Sync hero data** → **Run workflow** → **Run workflow**.
3. Tunggu sekitar 10 menit. Kalau hijau, buka **/admin**: baris *Hero data sync* menampilkan waktu sinkron terakhir.

Setelah itu workflow jalan otomatis setiap hari pukul 02:15 UTC (09:15 WIB).

**Catatan:**
- GitHub mematikan jadwal otomatis kalau repo tidak ada aktivitas (commit) selama 60 hari. Kalau baris *Hero data sync* di /admin berwarna merah karena sudah lebih dari 2 hari, buka tab Actions lalu aktifkan lagi workflow-nya.
- Di laptop tidak perlu sinkron. Data diambil langsung dari STRATZ saat dibutuhkan, lalu disimpan di database lokal. Kalau mau mengisi semuanya sekaligus, stop `npm run dev` lalu jalankan `npm run sync:hero-data -- --local`.
- Kalau token STRATZ sedang dipakai dari 2 IP lain (mis. laptop dan sandbox), sinkron menunggu sampai IP bebas (maksimal ±15 menit), lalu lanjut.

## H. Coaching notes (LLM)

Tanpa API key apa pun, tombol coaching tetap jalan dan memberi versi template (lebih kaku, isinya sama). Urutan model default: **Claude Haiku 4.5**, lalu **Gemini**, lalu **OpenRouter**. Urutan ini bisa diubah di **/admin → Coaching notes (LLM)**.

**1. Claude (utama, berbayar per pemakaian)**
1. Buka https://console.anthropic.com dan buat akun. Akun ini terpisah dari langganan claude.ai.
2. **Billing → Add credits.** Isi kredit awal kecil, misalnya $5.
3. **Limits → Spend limit.** Pasang batas belanja bulanan, misalnya $5–10. Kalau batas tercapai, Claude berhenti menjawab dan aplikasi otomatis pindah ke cadangan gratis.
4. **API keys → Create key.** Beri nama `pepak-doto` lalu salin key-nya. Key hanya tampil sekali.

**2. Gemini (cadangan gratis)**
1. Buka https://aistudio.google.com, login dengan akun Google.
2. **Get API key → Create API key**, lalu salin.
3. Free tier cukup; tidak perlu mengaktifkan billing. Catatan: data di free tier boleh dipakai Google untuk melatih model. Prompt kita hanya berisi statistik, tanpa nama atau ID pemain.

**3. OpenRouter (cadangan gratis kedua)**
1. Buka https://openrouter.ai dan buat akun.
2. **Keys → Create key**, lalu salin. Model `:free` tidak butuh kredit, tapi dibatasi sekitar 50 request per hari.

**4. Isi di Vercel**
Vercel → project `pepak-doto` → **Settings → Environment Variables**:

| Nama | Environment |
|---|---|
| `ANTHROPIC_API_KEY` | Production (dan Preview kalau mau mencoba di preview) |
| `GEMINI_API_KEY` | Production, Preview |
| `OPENROUTER_API_KEY` | Production, Preview |

Lalu **Deployments → ⋯ → Redeploy**. Di laptop, isi key yang sama di `.env.local` kalau ingin mencoba lokal.

**5. Cek**
1. Buka **/admin → Coaching notes (LLM)**. Ketiga provider harus bertuliskan *set*.
2. Tekan **Test** di tiap baris. Hasil yang benar berisi waktu respon dan jawaban JSON kecil.
3. Buka salah satu match, tekan **Get coaching notes**. Di bawah catatan tertulis "Written by Claude Haiku 4.5".
4. Tabel pemakaian di /admin menampilkan token dan perkiraan biaya per hari.

**Kalau model cadangan diganti penyedianya:** nama model Gemini dan OpenRouter kadang berganti. Kalau Test gagal dengan pesan model tidak ditemukan, ketik nama model yang baru di kolom Model lalu Save.

## Masalah umum

| Gejala | Penyebab | Solusi |
|---|---|---|
| Kembali ke halaman Sign in dengan "took too long" | Login Steam lebih dari 10 menit, atau dimulai di tab lain | Ulangi dari tombol Sign in |
| "Sign-in isn't set up on this server yet" | `SESSION_SECRET` kosong atau kurang dari 32 karakter | Isi lalu deploy ulang / jalankan ulang dev |
| Menu Admin tidak muncul | Steam ID tidak cocok | Cek `ADMIN_STEAM_IDS` (SteamID64, 17 digit) |
| Rank tidak muncul di Profile | Data match privat | Aktifkan *Expose Public Match Data* di Dota 2 |
