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

1. Di project `pepak-doto` di Vercel, buka tab **Storage**.
2. **Create Database → Neon (Serverless Postgres) → Continue**. Setujui syarat Neon kalau diminta.
3. Pengaturan:
   - **Region:** Singapore (`aws-ap-southeast-1`), paling dekat ke Indonesia.
   - **Plan:** Free.
   - **Database name:** `pepak-doto`.
4. Saat menghubungkan ke project:
   - Pilih environment **Production** dan **Preview** saja. **Jangan centang Development**, supaya laptop tetap memakai database lokal (PGlite) dan tidak menyentuh data production.
   - Biarkan *prefix* kosong, supaya nama variabelnya `DATABASE_URL`.
5. Samakan region server Vercel dengan database: **Settings → Functions → Function Region → Singapore (sin1)**.

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

## Masalah umum

| Gejala | Penyebab | Solusi |
|---|---|---|
| Kembali ke halaman Sign in dengan "took too long" | Login Steam lebih dari 10 menit, atau dimulai di tab lain | Ulangi dari tombol Sign in |
| "Sign-in isn't set up on this server yet" | `SESSION_SECRET` kosong atau kurang dari 32 karakter | Isi lalu deploy ulang / jalankan ulang dev |
| Menu Admin tidak muncul | Steam ID tidak cocok | Cek `ADMIN_STEAM_IDS` (SteamID64, 17 digit) |
| Rank tidak muncul di Profile | Data match privat | Aktifkan *Expose Public Match Data* di Dota 2 |
