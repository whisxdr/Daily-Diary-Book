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

Jalankan `supabase/schema.sql` sekali di SQL editor Supabase. Skema itu membuat tabel `entries` dan `categories` dengan RLS aktif dan policy yang scoped ke `auth.uid()` — anon key ikut terkirim ke browser, jadi policy itu satu-satunya pemisah antara diary satu pembaca dan pembaca lain.

Saat env terisi, login magic link aktif dan catatan disimpan ke cloud. Ekspor/impor JSON tetap tersedia sebagai jaring pengaman.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Build produksi: template → check derive → check cover → check store → typecheck → bundle |
| `npm run preview` | Sajikan hasil build |
| `npm run check:derive` | Uji semua bentuk entri tetap menghasilkan record yang bisa dirender |
| `npm run check:cover` | Uji sampul tiap volume mengikuti kategorinya, bukan posisinya di rak |
| `npm run check:store` | Uji impor tidak bisa menimpa nama kategori pembaca, dan daftar rusak tetap tampil |
| `npm run verify:threeui` | Cocokkan file ThreeUI dengan SHA-256 revisi terdaftar |

## Kategori

Kategori adalah milik pembaca, bukan aplikasi. Tombol **Kategori** membuka dialog untuk menamai ulang, menambah, dan menghapus kategori — misalnya Life, Experience, Experiment.

Yang bisa diedit adalah **nama**-nya. **Tampilan** buku (motif, warna kain, foil, sampul) dipilih dari tujuh look yang sudah dirancang, karena tiap look adalah pasangan tetap antara palet dan gambar sampul di atlas halaman rak. Pembaca memilih look mana yang dipakai sebuah kategori; tidak membuat look baru.

Entri menyimpan **id** kategori, bukan namanya. Jadi menamai ulang kategori tidak menyentuh satu entri pun — dan tidak ada entri yang bisa menunjuk label yang sudah tidak ada. Menghapus kategori yang masih dipakai akan menanyakan dulu, lalu **memindahkan** entri-entrinya ke kategori pertama, bukan menghapusnya. Pemindahan itu sungguhan menulis ulang entrinya: `findCategory` memang tetap akan *menampilkan* entri ber-id hilang di bawah kategori pertama, tapi id yang tersimpan tetap menunjuk kategori yang sudah tidak ada — jumlah catatan di dialog akan mengkredit kategori hantu, dan entri itu akan diam-diam kembali menempel kalau id-nya muncul lagi lewat impor.

Kategori disimpan sekali per pembaca (localStorage `diary-book:categories`, atau satu baris `public.categories` di cloud) dan diselesaikan per id saat render. Ekspor JSON ikut membawa daftar kategori, jadi hasil impor mengembalikan nama yang dipakai entri — bukan hanya entrinya. Selama pembaca belum mengubah satu pun nama atau tampilan, ekspor tetap berupa array polos seperti versi lama, supaya backup masih bisa dibaca build sebelumnya.

## Struktur

```
scripts/
  build-templates.mjs   ekstrak BOOKS + kartu, emit template, assert diff terbatas
  check-derive.mjs      regresi bentuk entri + resolusi kategori
  check-cover-art.mjs   sampul mengikuti kategori, diuji lewat template hasil build
  check-store.mjs       impor tidak menimpa kategori pembaca, store lokal tetap utuh
  verify-threeui.mjs    cek digest sumber terdaftar
public/landing-pages/
  complete-shelf-v2.html          900 KB, byte-exact
  bestsellers-book-showcase.html  3.5 MB, byte-exact
  *.template.html                 generated, gitignored
src/
  lib/types.ts          model entri + kategori, normalisasi daftar kategori
  lib/derive.ts         entri → field BOOKS + kartu manual
  lib/usePageBlob.ts    fetch template, isi token, blob URL
  components/           ShelfView, EntryEditor, EntryList, CategoryManager, ManualReader, AuthGate
supabase/schema.sql     tabel entries + categories + RLS
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

**Sampul dulu mengikuti posisi, bukan kategori.** Identitas visual sebuah volume dirakit dua mekanisme. Warna kain, foil, kertas, dinding, dan tinta dibaca dari objek `book` — `derive.ts` mengisinya dari kategori entri. Tapi gambar sampulnya dipilih dari posisi volume di rak, `COVER_CROPS[BOOKS.indexOf(book)]`, di `complete-shelf-v2.html:2414`.

Dengan satu entri keduanya sepakat secara kebetulan — kategori default adalah motif pertama, dan satu-satunya buku ada di slot 0 — jadi kerusakannya baru terlihat sejak buku kedua. Entri "Play" di slot 0 memakai gambar sampul ultramarine milik motif "brackets" di atas kain coral.

Atlasnya disusun dalam urutan motif, jadi crop milik sebuah kategori adalah indeks motifnya. `derive.ts` sekarang mengirim `coverCrop` pada book, dan halaman membacanya dari sana — ketergantungan pada posisi hilang sepenuhnya. `check:cover` menguji ini lewat template hasil build, karena dua bagian itu hidup di file berbeda: satu TypeScript, satu patch build-time pada sumber HTML yang immutable.

**Impor tidak boleh menimpa kategori diam-diam.** Impor mengganti daftar kategori pembaca dengan yang ada di file. Sementara `normalizeCategories` selalu menjawab dengan tujuh kategori bawaan kalau masukannya tidak bisa dipakai — jadi pertanyaan "apakah `categories` sebuah array?" salah. `[]`, `"nope"`, `[{nope: 1}]`, `[{id: 1}]` semuanya lolos pertanyaan itu dan semuanya dinormalisasi jadi bawaan. Kalau dianggap sebagai daftar dari file, impor satu backup yang sedikit rusak akan mengganti nama kategori yang sudah ditulis pembaca dan memindahkan setiap entri yang memakainya: tanpa error, tanpa crash, hanya kata-katanya yang hilang. Jadi patokannya adalah identitas — `normalizeCategories` mengembalikan instance `DEFAULT_CATEGORIES` yang sama saat gagal, dan hanya daftar yang benar-benar selamat dari normalisasi yang dianggap ada. `check:store` menguji ini, termasuk kasus di mana pembaca sudah punya nama sendiri lalu mengimpor file yang membawa nilai rusak.

**`chapters` selalu tiga item.** Halaman rak mengakses `chapters[0..2]` tanpa cek panjang — di punggung buku, pelat, dan label halaman. Array pendek melempar `TypeError` di dalam skrip scene, yang ditangkap `initialize().catch()` dan berubah jadi katalog statis. Karena itu `derive.ts` mengisi slot yang kosong dengan label cadangan, bukan memotong array. `check:derive` menguji kasus ini.

**`fill` adalah dependency `usePageBlob`.** Dokumen rak dibangun ulang setiap daftar entri berubah; kalau tidak, rak tetap menampilkan katalog saat pertama dibangun. Template-nya sendiri di-cache per URL, jadi rebuild tidak mengunduh ulang 870 KB. Daftar kategori ikut jadi dependency: menamai ulang kategori atau mengganti look-nya harus membangun ulang dokumen, atau rak tetap memakai palet saat pertama dibangun.

**Rak 3D tidak bisa diakses keyboard.** Canvas di dalam iframe tidak reachable lewat Tab atau screen reader. `EntryList` di sebelahnya bukan cadangan opsional — itu jalur aksesibel ke entri yang sama, dan tetap tampil di semua lebar viewport.

**Klik volume di dalam iframe tidak diteruskan ke React.** Halaman tidak punya message listener, jadi navigasi utama lewat `EntryList`.

## Sumber ThreeUI

File terdaftar berasal dari `@designcodeio/threeui@1.2.0`. `verify:threeui` mencocokkan SHA-256 tiap file; kalau mismatch, perbaikannya adalah re-integrasi dari sumber terdaftar, bukan memperbarui digest yang diharapkan.

`pageTypography.js` dan `pageRecipes.js` direkonstruksi dari npm karena bundle terdaftar tidak memuatnya — catatan ini tercetak saat verifikasi.

## Lisensi

Kode aplikasi: milik pemilik repo.

Dua dokumen HTML di `public/landing-pages/` adalah karya ThreeUI dan dipakai sesuai lisensi paketnya. Nama produk di dalamnya dipakai secara editorial dan tetap milik pemiliknya masing-masing.
