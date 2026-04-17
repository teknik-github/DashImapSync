# dash-imapsync

Dashboard `Nuxt 4 + Nitro` untuk mengelola migrasi email berbasis `imapsync`.

Styling UI menggunakan Tailwind CSS v4.

Fitur yang tersedia:
- Dashboard utama dengan filter card status (Queued, Running, Success, Failed)
- CRUD migration job (single & batch)
- Halaman Job Migration dengan card grid dan fitur search
- Halaman Batch Migration untuk import file CSV/TXT/Excel
- Halaman Logs dengan filter status dan inline log viewer (Live logs & Batch logs)
- Admin login berbasis session cookie dengan rate limiting dan password hashing (SHA-256)
- Queue run manual dan retry run
- Eksekusi binary `imapsync` di server
- Endpoint test connection berbasis `imapsync --justconnect`
- Batch import migration via CSV, TXT, dan Excel ke dalam satu batch job
- Live log via Server-Sent Events
- Auto-create database dan auto-migration schema MySQL saat server boot
- Docker support dengan imapsync terinstall di dalam image

## Prerequisite

Pastikan server tempat aplikasi berjalan sudah punya:
- MySQL yang bisa diakses aplikasi
- Binary `imapsync` tersedia di `PATH`, atau set path khusus via env `NUXT_IMAPSYNC_BINARY`
- Secret key untuk enkripsi password mailbox di database

Contoh cek binary:

```bash
which imapsync
```

## Environment

Copy `.env.example` menjadi `.env` lalu isi nilainya.

Variable utama:
- `NUXT_DB_HOST`
- `NUXT_DB_PORT`
- `NUXT_DB_USER`
- `NUXT_DB_PASSWORD`
- `NUXT_DB_NAME`
- `NUXT_ADMIN_USERNAME`
- `NUXT_ADMIN_PASSWORD` — bisa berupa plaintext atau SHA-256 hex (64 karakter)
- `NUXT_AUTH_SECRET`
- `NUXT_IMAPSYNC_SECRET_KEY`
- `NUXT_IMAPSYNC_BINARY`
- `NUXT_IMAPSYNC_CONCURRENCY`
- `NUXT_IMAPSYNC_QUEUE_POLL_MS`

Catatan:
- Database akan dibuat otomatis jika belum ada
- Schema tabel juga akan dimigrate otomatis saat boot pertama
- Password mailbox disimpan terenkripsi di MySQL
- `NUXT_ADMIN_PASSWORD` bisa disimpan sebagai SHA-256 hash untuk keamanan tambahan; sistem akan otomatis mendeteksinya

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

Default URL:

```text
http://localhost:3000
```

## Verification

```bash
npm run typecheck
npm run build
```

## Production Preview

```bash
npm run preview
```

## Docker

Build dan jalankan menggunakan Docker:

```bash
docker build -t dash-imapsync .
docker run -p 3000:3000 --env-file .env dash-imapsync
```

Image sudah mencakup binary `imapsync` yang diinstall dari GitHub (via `wget`), beserta seluruh dependensi Perl yang dibutuhkan. Tidak perlu install `imapsync` terpisah di host.

Volume default untuk log imapsync:

```text
/app/LOG_imapsync
```

## Struktur Halaman

| Path | Keterangan |
|------|-----------|
| `/login` | Login admin |
| `/` | Dashboard — ringkasan status + daftar job dengan filter |
| `/jobs` | Job Migration — daftar semua job dalam card grid dengan search |
| `/jobs/new` | Form buat single migration job baru |
| `/jobs/:id` | Detail job — edit konfigurasi, run history, dan live log |
| `/batch-migration` | Import batch migration via file CSV/TXT/Excel |
| `/logs` | Logs — riwayat semua run dengan filter status dan inline log viewer |

## Navigasi Sidebar

Sidebar tetap (fixed) tersedia di semua halaman kecuali `/login`, berisi:
- **Dashboard** — `/`
- Seksi **Migration**:
  - **Single Migration** — `/jobs/new`
  - **Batch Migration** — `/batch-migration`
  - **Job Migration** — `/jobs`
  - **Logs** — `/logs`
- Info user dan tombol **Logout** di bagian bawah

## API

| Method | Path | Keterangan |
|--------|------|-----------|
| `POST` | `/api/auth/login` | Login admin |
| `POST` | `/api/auth/logout` | Logout |
| `GET` | `/api/auth/session` | Cek sesi aktif |
| `GET` | `/api/jobs` | Daftar semua job + summary dashboard |
| `POST` | `/api/jobs` | Buat job baru |
| `POST` | `/api/jobs/import` | Import batch job dari file |
| `POST` | `/api/jobs/test-connection` | Test koneksi IMAP |
| `GET` | `/api/jobs/:id` | Detail job |
| `PUT` | `/api/jobs/:id` | Update konfigurasi job |
| `DELETE` | `/api/jobs/:id` | Hapus job |
| `POST` | `/api/jobs/:id/runs` | Jalankan job |
| `GET` | `/api/logs` | Riwayat semua run (dengan filter status & pagination) |
| `GET` | `/api/runs/:id` | Detail run |
| `POST` | `/api/runs/:id/cancel` | Cancel run |
| `POST` | `/api/runs/:id/retry` | Retry run |
| `GET` | `/api/runs/:id/stream` | Live log stream (SSE) |

## Keamanan

- **Rate limiting login**: maksimal 5 percobaan per 15 menit per IP. Melewati batas akan mendapat HTTP 429.
- **Password hashing**: `NUXT_ADMIN_PASSWORD` bisa disimpan sebagai SHA-256 hash (64-char hex). Sistem otomatis mendeteksi dan membandingkan secara aman.
- **Session cookie**: HMAC-signed, tidak ada plaintext credential yang disimpan di sisi client.
- **Enkripsi password mailbox**: disimpan dengan AES-256-GCM di database.
- **Input limits**: username maksimal 128 karakter, password 256 karakter pada endpoint login.

## Catatan Operasional

- Untuk keamanan, aplikasi tidak mengembalikan password mailbox ke UI setelah disimpan.
- Saat edit job, field password bisa dikosongkan untuk tetap memakai secret yang sudah tersimpan.
- Endpoint test connection bisa memakai password baru dari form, atau secret tersimpan jika dipanggil dari halaman edit job.
- Jika server restart saat run masih berjalan, run tersebut otomatis ditandai gagal saat boot berikutnya.
- Jika binary `imapsync` tidak ditemukan, run akan gagal dengan pesan error yang jelas di log.

## File Import

Format file yang didukung:

- `.csv`
- `.txt`
- `.xlsx`
- `.xls`

Header CSV/Excel minimal yang didukung:

```text
sourceUsername,sourcePassword,destinationUsername,destinationPassword
```

Catatan CSV:
- Kolom minimum yang wajib diisi: `sourceUsername`, `sourcePassword`, `destinationUsername`, `destinationPassword`
- `sourceHost` dan `destinationHost` bisa diisi sekali dari form import dan akan diterapkan ke semua row
- Satu file import membuat **satu batch job** yang menampung banyak mailbox pair
- Jika kolom `name` tidak ada, sistem otomatis membuat nama batch job dari nama file upload
- Opsi `continue on error` bisa diaktifkan agar batch tetap lanjut ke mailbox pair berikutnya ketika satu item gagal
- `sourcePort`, `destinationPort`, `sourceSecurity`, dan `destinationSecurity` boleh dikosongkan
- `sourcePort`, `destinationPort`, `sourceSecurity`, dan `destinationSecurity` tetap bisa ditambahkan di CSV bila ingin override per row
- `folderFilter` bisa diisi banyak folder dengan separator `|`, misalnya `INBOX|Sent Items|Archive`
- Import berjalan dalam satu transaksi MySQL: jika satu row invalid, seluruh batch dibatalkan

Format TXT:

```text
sourceUsername sourcePassword destinationUsername destinationPassword
```

Contoh:

```text
user1@source.tld app-password-src user1@destination.tld app-password-dst
```

Catatan TXT:
- Satu baris mewakili satu migration job
- Setiap baris harus berisi tepat 4 nilai yang dipisahkan spasi
- `sourceHost` dan `destinationHost` diambil dari form import global

Catatan Excel:
- Sistem membaca worksheet pertama
- Header kolom mengikuti format CSV yang sama
# DashImapSync
