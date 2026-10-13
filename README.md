# Our Little Savings — Jurnal Tabungan Berdua

Website responsif HTML/CSS/JavaScript dengan Supabase Auth, PostgreSQL, RLS, dan Realtime.

## Fitur
- Login dan daftar akun untuk dua orang.
- Dashboard total tabungan, total per orang, progres target Rp1.000.000.
- Catatan setoran Rp25.000 per orang pada setiap minggu (tanggal minggu dimulai hari Senin).
- Unique constraint di database untuk mencegah setoran ganda per orang per minggu.
- Riwayat setoran dengan filter.
- Catatan bersama dan personalisasi nama/foto.
- Sinkronisasi antarperangkat via Supabase Realtime.

## 1. Buat project Supabase
1. Buka https://supabase.com/ lalu buat project baru.
2. Masuk ke **SQL Editor** dan jalankan seluruh isi `supabase.sql`.
3. Buka **Project Settings → API** (atau API Keys). Salin **Project URL** dan **anon/publishable key**.
4. Edit `config.js`:
   - `SUPABASE_URL`: Project URL.
   - `SUPABASE_ANON_KEY`: anon/publishable key.
   - Jangan pernah memakai `service_role` key di website/browser.

## 2. Siapkan dua akun
1. Buka website, pilih **Buat akun**, lalu daftar menggunakan email masing-masing.
2. Jika Supabase meminta konfirmasi email, buka email dan konfirmasi.
3. Di Supabase Dashboard → **Authentication → Users**, salin UUID akun kamu dan akun pasangan.
4. Buka SQL Editor, ganti placeholder pada query di bagian akhir `supabase.sql` dengan UUID asli, lalu jalankan query `insert into public.couple_members...`.
5. Kedua akun sekarang menjadi anggota jurnal yang sama. Logout lalu login lagi bila dashboard belum terbuka.

**Keamanan:** RLS membatasi data pada anggota pasangan yang sudah dimasukkan ke `couple_members`. Jangan menghapus RLS dan jangan membagikan key `service_role`.

## 3. Jalankan website di komputer
Cara sederhana:
- Buka folder website dengan VS Code.
- Gunakan ekstensi **Live Server** dan pilih `index.html`.
- Bisa juga gunakan server lokal lain. Jangan mengandalkan `file://` untuk pengujian Supabase.

## 4. Publikasikan gratis dengan GitHub Pages
1. Buat repository GitHub baru.
2. Upload `index.html`, `style.css`, `app.js`, `config.js`, dan `README.md` ke root repository. `supabase.sql` boleh disimpan juga, tetapi tidak diperlukan oleh browser.
3. Buka **Settings → Pages**.
4. Pada Build and deployment pilih **Deploy from a branch**, branch `main`, folder `/(root)`, lalu Save.
5. Tunggu hingga URL GitHub Pages tersedia. Buka URL tersebut dan coba login dari kedua perangkat.

GitHub Pages hanya meng-host frontend statis. Supabase yang menyimpan akun dan data secara online.

## 5. Pengaturan Supabase yang disarankan
- Authentication → URL Configuration: tambahkan URL GitHub Pages ke **Site URL** dan **Redirect URLs**.
- Untuk penggunaan pribadi, kamu boleh mematikan email confirmation di Authentication → Providers → Email agar pendaftaran langsung mendapat sesi login; pertimbangkan keamanan email bila website dipakai lebih luas.
- Aktifkan Realtime untuk tabel `savings_entries`, `couple_settings`, dan `couple_notes` di Database → Publications/Replication.
- Jika tabel tidak bisa diakses, cek apakah SQL sudah dijalankan dan kedua UUID sudah terdaftar di `couple_members`.

## Aturan tabungan
- Website menghitung satu pekan mulai hari Senin.
- Setoran ditetapkan Rp25.000 per akun per pekan.
- Database punya unique constraint `(couple_id, user_id, week_start)`, sehingga dua klik/permintaan untuk orang dan pekan yang sama tidak bisa membuat dua setoran.
- Website tidak mengizinkan pengguna mencatat setoran atas nama akun pasangan. Masing-masing harus login dan mencatat setoran sendiri.
- Target awal Rp1.000.000; dapat diubah pada `config.js`.

## Foto
Di bagian Personalisasi, masukkan URL gambar `https://...` yang dapat diakses publik. Foto disimpan sebagai URL, bukan diunggah ke Supabase Storage. Jangan gunakan tautan yang membutuhkan login. Minta persetujuan pasangan sebelum memakai foto pribadi.
