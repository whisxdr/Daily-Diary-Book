/*
 * Copy replacements for the two generated templates.
 *
 * Both packaged pages ship editorial copy for their own demo catalog: a brand
 * name, a fake edition line, section labels, and a colophon crediting artwork
 * that this project does not use. None of it is data, so token substitution does
 * not touch it, and a reader sees the original product's text around their own
 * entries — a shelf headed "Working Volumes" holding their diary, and a colophon
 * claiming the artwork is "original to this conceptual study".
 *
 * These tables replace that copy with the interface language the rest of the app
 * already uses (Indonesian). Every entry is a plain find/replace; the build
 * asserts each anchor is unique and that nothing outside the listed regions
 * changed, so a replacement cannot silently rewrite the page's own logic.
 *
 * Strings the page's script writes into the DOM appear in the tables as their
 * source literal (`"Open book"`), not as rendered text.
 */

/*
 * Packaged copy that must never survive into a generated template.
 *
 * The tables above are the fix; this list is the guard. A replacement only runs
 * when its anchor is found, so a phrase that the tables do not happen to list
 * stays on the page silently — which is how the canvas running heads and the
 * colophon were missed the first time. `check-templates.mjs` scans for these and
 * fails the build, so the next one is caught at build time rather than by a
 * reader.
 */
export const PACKAGED_MARKERS = [
  "Working Volumes",
  "Seven field guides",
  "Seven tools for making",
  "Edition 02",
  "Static catalog",
  "conceptual study",
  "used editorially",
  "Binding the collection",
  "WORKING VOLUMES",
  "IMAGINED EDITION",
  "Field Manuals",
  "The Collection",
  "Getting started",
  "Your first prompt",
  "Before you ship",
  "Field Notes",
  "Field Edition",
  "Read Notes",
  "View Guide",
  "reading list",
  'lang="en"',
];

/** The shelf page ("complete-shelf-v2.html") — the 3D volume shelf. */
export const SHELF_COPY = [
  // Document identity.
  { find: '<html lang="en">', replace: '<html lang="id">', label: "html lang" },
  { find: "<title>Working Volumes — Seven Tools for Making</title>", replace: "<title>Rak catatan — Diary Book</title>", label: "document title" },
  {
    find: "Working Volumes is an original interactive Three.js library of seven tactile field guides for contemporary creative tools.",
    replace: "Rak catatan pribadi: setiap catatan menjadi satu volume di rak tiga dimensi.",
    label: "meta description",
  },

  // Editorial header. The packaged identity named the demo catalog, and the
  // edition line was a fixed "Edition 02 · 2026" regardless of the reader.
  { find: 'aria-label="Collection"', replace: 'aria-label="Koleksi"', label: "header aria-label" },
  { find: "<strong>Working Volumes</strong>", replace: "<strong>Rak Catatan</strong>", label: "header identity" },
  { find: "<span>Seven field guides for making</span>", replace: "<span>Volume dari catatanmu</span>", label: "header tagline" },
  { find: "<span>Edition 02 · 2026</span>", replace: "<span>Edisi pribadi</span>", label: "edition line" },

  // Browse controls.
  { find: 'aria-label="Shelf navigation"', replace: 'aria-label="Navigasi rak"', label: "browse aria-label" },
  { find: 'aria-label="Previous volume"', replace: 'aria-label="Volume sebelumnya"', label: "previous volume" },
  { find: 'aria-label="Next volume"', replace: 'aria-label="Volume berikutnya"', label: "next volume" },
  { find: 'aria-label="Volume index"', replace: 'aria-label="Indeks volume"', label: "index aria-label" },
  { find: 'aria-label="Choose a volume"', replace: 'aria-label="Pilih volume"', label: "choose volume" },
  { find: 'id="inspect" type="button">Open</button>', replace: 'id="inspect" type="button">Buka</button>', label: "inspect button" },
  { find: '<p class="microcopy">Wheel · arrows · select</p>', replace: '<p class="microcopy">Gulir · panah · pilih</p>', label: "browse microcopy" },

  // Detail panel. Its defaults are replaced by the script on selection, but the
  // authored demo copy is what shows before the first volume is picked.
  { find: 'aria-label="Return volume to shelf"', replace: 'aria-label="Kembalikan volume ke rak"', label: "close detail aria-label" },
  { find: "<p class=\"eyebrow\" id=\"detail-eyebrow\">Volume I · Agentic craft</p>", replace: "<p class=\"eyebrow\" id=\"detail-eyebrow\">Volume I</p>", label: "detail eyebrow" },
  { find: "<h2 class=\"detail-title\" id=\"detail-title\">Codex</h2>", replace: "<h2 class=\"detail-title\" id=\"detail-title\">Volume</h2>", label: "detail title" },
  {
    find: "A field manual for turning clear intent into working software, with verification treated as part of the craft.",
    replace: "Pilih satu volume untuk membaca catatannya.",
    label: "detail deck",
  },
  { find: "<dt>Binding</dt>", replace: "<dt>Jilid</dt>", label: "meta binding" },
  { find: "<dt>Format</dt>", replace: "<dt>Tanggal</dt>", label: "meta format" },
  { find: "<dt>Theme</dt>", replace: "<dt>Tema</dt>", label: "meta theme" },
  { find: "<dt>Motif</dt>", replace: "<dt>Motif</dt>", label: "meta motif" },
  { find: 'id="detail-binding">Evergreen cloth · antique brass foil</dd>', replace: 'id="detail-binding">—</dd>', label: "binding default" },
  { find: 'id="detail-format">148 × 216 mm · imagined edition</dd>', replace: 'id="detail-format">—</dd>', label: "format default" },
  { find: 'id="detail-theme">Intent into implementation</dd>', replace: 'id="detail-theme">—</dd>', label: "theme default" },
  { find: 'id="detail-motif">Nested brackets</dd>', replace: 'id="detail-motif">—</dd>', label: "motif default" },
  { find: 'aria-label="Browse sample pages"', replace: 'aria-label="Jelajahi halaman contoh"', label: "page navigation aria-label" },
  { find: 'aria-label="Previous sample page"', replace: 'aria-label="Halaman contoh sebelumnya"', label: "previous page aria-label" },
  { find: 'aria-label="Next sample page"', replace: 'aria-label="Halaman contoh berikutnya"', label: "next page aria-label" },
  { find: '<strong id="page-label">Closed</strong>', replace: '<strong id="page-label">Tertutup</strong>', label: "page label default" },
  { find: '<span id="page-counter">Click book to open</span>', replace: '<span id="page-counter">Klik buku untuk membuka</span>', label: "page counter default" },
  {
    find: '<p class="microcopy">Drag cover or click once to open · Background to orbit</p>',
    replace: '<p class="microcopy">Seret sampul atau klik sekali untuk membuka · Latar untuk memutar</p>',
    label: "detail microcopy",
  },
  { find: 'aria-pressed="false">Open book</button>', replace: 'aria-pressed="false">Buka buku</button>', label: "toggle book button" },
  { find: 'id="reset-view" type="button">Reset view</button>', replace: 'id="reset-view" type="button">Atur ulang tampilan</button>', label: "reset view button" },

  // Static fallback — what a reader without WebGL sees, including the colophon.
  { find: '<p class="fallback__kicker">Working Volumes · Static catalog</p>', replace: '<p class="fallback__kicker">Rak Catatan · Katalog statis</p>', label: "fallback kicker" },
  {
    find: "The complete catalog remains readable while the interactive shelf is prepared.",
    replace: "Katalog tetap terbaca selagi rak interaktif disiapkan.",
    label: "fallback status",
  },
  {
    find: "<span>All bindings, motifs, descriptions, geometry, and cover artworks are original to this conceptual study.</span>",
    replace: "<span>Setiap volume di rak ini berasal dari catatanmu sendiri.</span>",
    label: "fallback colophon",
  },
  {
    find: "<span>Product names are used editorially and remain the property of their respective owners.</span>",
    replace: "<span>Motif dan warna dipilih otomatis dari suasana tiap catatan.</span>",
    label: "fallback colophon 2",
  },
  { find: "<p>Binding the collection</p>", replace: "<p>Menyusun rak</p>", label: "loading text" },

  // Strings the script writes into the DOM. The markup copies of these same
  // lines are replaced above, as their own anchors.
  { find: '"Click book to open"', replace: '"Klik buku untuk membuka"', label: "js page counter" },
  { find: ': "Closed"', replace: ': "Tertutup"', label: "js page label" },
  { find: '? "Close book" : "Open book"', replace: '? "Tutup buku" : "Buka buku"', label: "js toggle label" },
  {
    find: '"Drag pages · Drag cover to close · Background to orbit"',
    replace: '"Seret halaman · Seret sampul untuk menutup · Latar untuk memutar"',
    label: "js microcopy reading",
  },
  {
    find: '"Drag cover or click once to open · Background to orbit"',
    replace: '"Seret sampul atau klik sekali untuk membuka · Latar untuk memutar"',
    label: "js microcopy idle",
  },
  {
    find: "`Selected volume ${selectedIndex + 1} of ${BOOKS.length}: ${book.title}. ${book.note}`",
    replace: "`Volume ${selectedIndex + 1} dari ${BOOKS.length}: ${book.title}. ${book.note}`",
    label: "js live selected",
  },
  {
    find: "`Page ${currentSpread + 1} of ${SPREAD_COUNT}: ${labels[currentSpread]}.`",
    replace: "`Halaman ${currentSpread + 1} dari ${SPREAD_COUNT}: ${labels[currentSpread]}.`",
    label: "js live page",
  },
  {
    find: "`Opening a closed copy of ${activeBook.data.title}. Drag the cover, click the book, or use Open book to begin reading.`",
    replace: "`Membuka ${activeBook.data.title}. Seret sampul, klik buku, atau pakai Buka buku untuk mulai membaca.`",
    label: "js live opening",
  },
  {
    find: "`${activeBook.data.title} closed. Drag the cover, click the book, or use Open book to begin reading.`",
    replace: "`${activeBook.data.title} ditutup. Seret sampul, klik buku, atau pakai Buka buku untuk mulai membaca.`",
    label: "js live closed",
  },
  {
    find: "`${activeBook.data.title} opened to its title page. Drag a page horizontally or use the arrow controls to read.`",
    replace: "`${activeBook.data.title} terbuka di halaman judul. Seret halaman atau pakai tombol panah untuk membaca.`",
    label: "js live opened",
  },
  {
    find: "`Returning ${activeBook.data.title} to the shelf.`",
    replace: "`Mengembalikan ${activeBook.data.title} ke rak.`",
    label: "js live returning",
  },
  {
    find: "`${BOOKS[selectedIndex].title} returned to the shelf.`",
    replace: "`${BOOKS[selectedIndex].title} kembali ke rak.`",
    label: "js live returned",
  },
  {
    find: "`Inspection view reset for ${BOOKS[selectedIndex].title}.`",
    replace: "`Tampilan inspeksi diatur ulang untuk ${BOOKS[selectedIndex].title}.`",
    label: "js live reset",
  },
  { find: '? "Previous sample page"', replace: '? "Halaman contoh sebelumnya"', label: "js previous page label" },
  { find: "`Previous sample page: ", replace: "`Halaman contoh sebelumnya: ", label: "js previous page prefix" },
  { find: '? "Next sample page"', replace: '? "Halaman contoh berikutnya"', label: "js next page label" },
  { find: "`Next sample page: ", replace: "`Halaman contoh berikutnya: ", label: "js next page prefix" },
  {
    find: '"The interactive shelf could not be prepared. The complete static catalog remains available."',
    replace: '"Rak interaktif tidak bisa disiapkan. Katalog statis tetap tersedia."',
    label: "js fallback message",
  },

  /*
   * Strings the script paints onto the book's own canvas pages. They never
   * appear in the HTML, so nothing else here reaches them, but a reader opening
   * a volume sees them: a running head naming the packaged demo catalog, and a
   * colophon claiming the artwork is a study for it. Each anchor carries its own
   * coordinates because the running head repeats across four canvas builders.
   */
  { find: "`WORKING VOLUMES  /  ${book.roman}`, canvasTexture.width / 2, 92", replace: "`RAK CATATAN  /  ${book.roman}`, canvasTexture.width / 2, 92", label: "canvas cover running head" },
  { find: "`WORKING VOLUMES  /  ${pad(index)}`, 58, 70", replace: "`RAK CATATAN  /  ${pad(index)}`, 58, 70", label: "canvas foil running head" },
  { find: "`WORKING VOLUMES  /  ${book.roman}`, 48, 48", replace: "`RAK CATATAN  /  ${book.roman}`, 48, 48", label: "canvas interior running head" },
  { find: "`WORKING VOLUMES  /  ${book.roman}`, 68, 82", replace: "`RAK CATATAN  /  ${book.roman}`, 68, 82", label: "canvas cover foil running head" },
  { find: "`CHAPTER ${pad(chapterIndex + 1)}`", replace: "`BAGIAN ${pad(chapterIndex + 1)}`", label: "canvas chapter head" },
  { find: '"CHAPTER 03"', replace: '"BAGIAN 03"', label: "canvas chapter head 3" },
  { find: '"PLATE 01  /  SYSTEM MOTIF"', replace: '"LEMPENG 01  /  MOTIF SISTEM"', label: "canvas plate 1" },
  { find: '"PLATE 02  /  TECHNICAL SYSTEM"', replace: '"LEMPENG 02  /  SISTEM TEKNIS"', label: "canvas plate 2" },
  { find: "`NOTES  /  ${book.chapters[1].toUpperCase()}`", replace: "`CATATAN  /  ${book.chapters[1].toUpperCase()}`", label: "canvas notes head" },
  { find: '"COLOPHON"', replace: '"KOLOFON"', label: "canvas colophon head" },
  {
    find: "`${book.binding}. ${book.format}. Conceived as an original editorial study for Working Volumes.`",
    replace: "`${book.binding}. ${book.format}. Salah satu volume dari rak catatan pribadi.`",
    label: "canvas colophon copy",
  },
  {
    find: "`SPECIMEN ${book.roman} / ${book.seed}  ·  IMAGINED EDITION`",
    replace: "`SPESIMEN ${book.roman} / ${book.seed}  ·  EDISI PRIBADI`",
    label: "canvas specimen line",
  },
  { find: '"AN IMAGINED EDITION"', replace: '"EDISI PRIBADI"', label: "canvas edition label" },
];

/** The Field Manuals page ("bestsellers-book-showcase.html") — the reader. */
export const MANUAL_COPY = [
  { find: '<html lang="en">', replace: '<html lang="id">', label: "html lang" },
  { find: "<title>Field Manuals — Tools for Thought</title>", replace: "<title>Pembaca catatan — Diary Book</title>", label: "document title" },
  {
    find: "An earth-toned interactive field library for Codex, Claude Code, and Cursor.",
    replace: "Pembaca editorial untuk catatan terbaru: tiga volume terakhir, lengkap dengan isinya.",
    label: "meta description",
  },

  // Masthead.
  { find: 'aria-label="Interactive AI coding field library"', replace: 'aria-label="Pembaca catatan"', label: "stage aria-label" },
  { find: 'aria-label="Field Manuals home">Field Manuals</a>', replace: 'aria-label="Beranda pembaca">Pembaca Catatan</a>', label: "brand" },
  { find: 'aria-label="Open menu" aria-expanded="false"', replace: 'aria-label="Buka menu" aria-expanded="false"', label: "menu button aria-label" },
  {
    find: 'data-toast="The collection is complete.">The Collection</button>',
    replace: 'data-toast="Koleksi sudah lengkap.">Koleksi</button>',
    label: "collection button",
  },
  { find: 'aria-label="AI coding field manuals"', replace: 'aria-label="Kartu catatan"', label: "gallery aria-label" },

  // Detail panel. The section labels are authored, not data, so they stay on
  // screen and have to name what the reader's own record actually holds:
  // paragraphs become the steps, the subtitle becomes the quote, the date
  // becomes the closing line.
  { find: "<h2 class=\"detail-title\" id=\"detailTitle\">Claude Code</h2>", replace: "<h2 class=\"detail-title\" id=\"detailTitle\">Catatan</h2>", label: "detail title default" },
  { find: 'aria-label="Close detail view"', replace: 'aria-label="Tutup tampilan detail"', label: "close detail aria-label" },
  { find: 'aria-label="Getting started guide"', replace: 'aria-label="Isi catatan"', label: "detail scroll aria-label" },
  { find: 'id="gettingStartedLabel">Getting started</p>', replace: 'id="gettingStartedLabel">Isi catatan</p>', label: "doc label steps" },
  { find: 'id="firstPromptLabel">Your first prompt</p>', replace: 'id="firstPromptLabel">Subjudul</p>', label: "doc label quote" },
  { find: 'id="reviewLabel">Before you ship</p>', replace: 'id="reviewLabel">Tanggal</p>', label: "doc label review" },
  { find: '<span class="review-source">Field Notes</span>', replace: '<span class="review-source">Catatan pribadi</span>', label: "review source" },
  { find: 'aria-label="Field edition and publication year"', replace: 'aria-label="Edisi dan tahun"', label: "meta row aria-label" },
  { find: 'aria-label="Field edition"', replace: 'aria-label="Edisi"', label: "stars aria-label" },
  { find: 'aria-label="Field manual actions"', replace: 'aria-label="Aksi catatan"', label: "action rail aria-label" },
  { find: 'aria-label="Save book"', replace: 'aria-label="Simpan catatan"', label: "save button aria-label" },
  { find: 'data-toast="Field edition · 2026">', replace: 'data-toast="Edisi pribadi">', label: "language pill toast" },
  { find: "Field Edition", replace: "Edisi Pribadi", label: "language pill label" },
  { find: 'data-toast="Notes opened.">Read Notes</button>', replace: 'data-toast="Catatan dibuka.">Baca catatan</button>', label: "read notes button" },
  { find: 'data-toast="Guide opened.">View Guide</button>', replace: 'data-toast="Panduan dibuka.">Lihat panduan</button>', label: "view guide button" },

  // Menu.
  { find: 'aria-label="Site menu"', replace: 'aria-label="Menu"', label: "menu layer aria-label" },
  { find: 'data-menu-close>Volumes</a>', replace: 'data-menu-close>Volume</a>', label: "menu volumes" },
  { find: 'data-toast="Field notes are coming soon.">Notes</a>', replace: 'data-toast="Catatan segera hadir.">Catatan</a>', label: "menu notes" },
  { find: 'data-toast="An index of tools for thought.">Index</a>', replace: 'data-toast="Indeks semua catatan.">Indeks</a>', label: "menu index" },

  // Strings the script writes into the DOM.
  { find: 'willOpen ? "Close menu" : "Open menu"', replace: 'willOpen ? "Tutup menu" : "Buka menu"', label: "js menu label" },
  { find: '"Saved to your reading list."', replace: '"Ditambahkan ke daftar bacaan."', label: "js saved toast" },
  { find: '"Removed from your reading list."', replace: '"Dihapus dari daftar bacaan."', label: "js removed toast" },
];
