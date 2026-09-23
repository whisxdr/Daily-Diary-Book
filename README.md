# Diary Book — 3D Diary Book

Rak catatan pribadi yang setiap entrinya menjadi satu volume 3D di rak. Tulis catatan, volume baru muncul dengan motif dan warnanya sendiri.

Dibangun di atas halaman ThreeUI yang byte-exact: rak "Working Volumes" dan pembaca "Field Manuals". Kedua dokumen asli tidak pernah dimodifikasi — data entri disuntikkan lewat template hasil build.

## Menjalankan

```bash
npm install
npm run dev
```

Buka `http://localhost:5173/`.

Tanpa konfigurasi tambahan, catatan disimpan di `localStorage` browser dan aplikasi jalan penuh secara offline.

## Mode cloud (opsional)

Salin `.env.example` ke `.env.local`, isi dari project settings Supabase:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Jalankan `supabase/schema.sql` sekali di SQL editor Supabase. Skema itu membuat tabel `entries` dengan RLS aktif dan empat policy yang scoped ke `auth.uid()` — anon key ikut terkirim ke browser, jadi policy itu satu-satunya pemisah antara diary satu pembaca dan pembaca lain.

Saat env terisi, login magic link aktif dan catatan disimpan ke cloud. Ekspor/impor JSON tetap tersedia sebagai jaring pengaman.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Build produksi: template → check derive → typecheck → bundle |
| `npm run preview` | Sajikan hasil build |
| `npm run check:derive` | Uji semua bentuk entri tetap menghasilkan record yang bisa dirender |
| `npm run verify:threeui` | Cocokkan file ThreeUI dengan SHA-256 revisi terdaftar |

## Struktur

```
scripts/
  build-templates.mjs   ekstrak BOOKS + kartu, emit template, assert diff terbatas
  check-derive.mjs      regresi bentuk entri
  verify-threeui.mjs    cek digest sumber terdaftar
public/landing-pages/
  complete-shelf-v2.html          900 KB, byte-exact
  bestsellers-book-showcase.html  3.5 MB, byte-exact
  *.template.html                 generated, gitignored
src/
  lib/derive.ts         entri → field BOOKS + kartu manual
  lib/usePageBlob.ts    fetch template, isi token, blob URL
  components/           ShelfView, EntryEditor, EntryList, ManualReader, AuthGate
supabase/schema.sql     tabel entries + RLS + 4 policy
```

## Cara kerja integrasi

Kedua halaman ThreeUI tidak menerima data: katalognya hardcoded di array `const BOOKS` dan tiga kartunya markup statis. Tidak ada query param, global, atau message listener.

Jadi data disuntikkan dengan mengganti literal tersebut menjadi token, sekali di build time:

1. `build-templates.mjs` menemukan literal dengan bracket matcher yang menghormati string dan komentar, lalu mem-parse hasilnya sebagai bukti valid.
2. Script memastikan template hanya berbeda dari sumber di region yang diganti.
3. Script memastikan template tetap parse sebagai JavaScript setelah semua token diganti nilai contoh.
4. Runtime: `fetch` template → ganti token → blob URL → prop `sourceUrl` frame.

Bagian yang rapuh (mencari akhir literal) berjalan sekali saat build di bawah assertion, bukan tiap page load. File di `public/landing-pages/` tetap byte-exact dan digest-nya diverifikasi `verify:threeui`.

## Catatan teknis

**`chapters` selalu tiga item.** Halaman rak mengakses `chapters[0..2]` tanpa cek panjang — di punggung buku, pelat, dan label halaman. Array pendek melempar `TypeError` di dalam skrip scene, yang ditangkap `initialize().catch()` dan berubah jadi katalog statis. Karena itu `derive.ts` mengisi slot yang kosong dengan label cadangan, bukan memotong array. `check:derive` menguji kasus ini.

**`fill` adalah dependency `usePageBlob`.** Dokumen rak dibangun ulang setiap daftar entri berubah; kalau tidak, rak tetap menampilkan katalog saat pertama dibangun. Template-nya sendiri di-cache per URL, jadi rebuild tidak mengunduh ulang 870 KB.

**Rak 3D tidak bisa diakses keyboard.** Canvas di dalam iframe tidak reachable lewat Tab atau screen reader. `EntryList` di sebelahnya bukan cadangan opsional — itu jalur aksesibel ke entri yang sama, dan tetap tampil di semua lebar viewport.

**Klik volume di dalam iframe tidak diteruskan ke React.** Halaman tidak punya message listener, jadi navigasi utama lewat `EntryList`.

## Sumber ThreeUI

File terdaftar berasal dari `@designcodeio/threeui@1.2.0`. `verify:threeui` mencocokkan SHA-256 tiap file; kalau mismatch, perbaikannya adalah re-integrasi dari sumber terdaftar, bukan memperbarui digest yang diharapkan.

`pageTypography.js` dan `pageRecipes.js` direkonstruksi dari npm karena bundle terdaftar tidak memuatnya — catatan ini tercetak saat verifikasi.

## Lisensi

Kode aplikasi: milik pemilik repo.

Dua dokumen HTML di `public/landing-pages/` adalah karya ThreeUI dan dipakai sesuai lisensi paketnya. Nama produk di dalamnya dipakai secara editorial dan tetap milik pemiliknya masing-masing.
