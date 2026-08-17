// =====================================================================
// content.js
//
// Semua logika ada di sini: deteksi private, buka dialog Following, cari
// scroll container DI DALAM dialog, scroll+ekstrak, deteksi stall, simpan
// ke chrome.storage.local per-akun, lalu self-navigate ke akun berikutnya.
//
// Hidup di konteks halaman => selamat dari kematian service worker MV3.
// =====================================================================

(async () => {
  // Guard anti double-run. Event "complete" di background bisa ter-fire lebih
  // dari sekali untuk dokumen yang sama; flag ini mencegah eksekusi ganda.
  // Pada self-navigation (dokumen baru) flag otomatis hilang, jadi akun
  // berikutnya tetap diproses.
  if (window.__IG_SNA_SCRAPER__) return;
  window.__IG_SNA_SCRAPER__ = true;

  // ---------- konstanta ----------
  // Path satu-segmen yang BUKAN profil orang (harus difilter dari hasil).
  const SYSTEM_PATHS = new Set([
    "explore", "reels", "reel", "p", "stories", "accounts", "direct", "about",
    "developer", "legal", "privacy", "terms", "directory", "web", "session",
    "emails", "challenge", "ajax", "graphql", "api", "your_activity",
    "lite", "igtv", "tv", "locations", "create", "settings", "help", "press"
  ]);
  // Teks tombol aksi di tiap baris (jangan dikira nama lengkap).
  const BUTTON_WORDS =
    /^(following|follow|requested|message|follow back|mengikuti|ikuti|diminta|pesan|ikuti balik)$/i;

  const MAX_STALL = 10; // berhenti scroll bila N iterasi tanpa data baru

  // ---------- util ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function getState() {
    const { scrapeState } = await chrome.storage.local.get("scrapeState");
    return scrapeState || null;
  }
  async function isRunning() {
    const s = await getState();
    return !!(s && s.running);
  }
  async function stopRunning() {
    const s = await getState();
    if (s) {
      s.running = false;
      await chrome.storage.local.set({ scrapeState: s });
    }
  }

  async function log(msg) {
    const { log = [] } = await chrome.storage.local.get("log");
    const ts = new Date().toLocaleTimeString("id-ID", { hour12: false });
    log.push({ ts, msg });
    while (log.length > 250) log.shift(); // batasi memori storage
    await chrome.storage.local.set({ log });
  }

  // Polling helper: jalankan fn sampai truthy atau timeout.
  async function waitFor(fn, timeout = 10000, interval = 300) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      let v;
      try { v = fn(); } catch (_) { v = null; }
      if (v) return v;
      await sleep(interval);
    }
    return null;
  }

  // ---------- deteksi kondisi halaman ----------
  function pageText() {
    return document.body ? document.body.innerText : "";
  }
  function isPrivate() {
    return /This Account is Private|This account is private|Akun Ini Privat|Akun ini privat/i.test(
      pageText()
    );
  }
  function isUnavailable() {
    return /Sorry, this page isn't available|Sorry, this page isn’t available|Halaman ini tidak tersedia/i.test(
      pageText()
    );
  }
  function isLoginWall() {
    return (
      location.pathname.includes("/accounts/login") ||
      !!document.querySelector('input[name="password"]')
    );
  }

  // Naik ke ancestor "clickable": tag a/button, role=button, punya onclick,
  // atau computed cursor:pointer.
  function clickableAncestor(node) {
    let el = node;
    for (let i = 0; i < 8 && el; i++) {
      const tag = el.tagName;
      if (
        tag === "A" ||
        tag === "BUTTON" ||
        (el.getAttribute && el.getAttribute("role") === "button") ||
        (el.hasAttribute && el.hasAttribute("onclick")) ||
        el.onclick
      ) {
        return el;
      }
      try {
        if (getComputedStyle(el).cursor === "pointer") return el;
      } catch (_) {}
      el = el.parentElement;
    }
    return node;
  }

  function logFollowingBtn(el) {
    try {
      console.log(
        "[SNA] FOLLOWING BTN:",
        el.tagName,
        typeof el.className === "string" ? el.className : "",
        (el.textContent || "").slice(0, 30)
      );
    } catch (_) {}
  }

  // Klik via dispatch event LENGKAP. IG memakai href="#" + handler React, jadi
  // .click() biasa sering tidak memicu pembukaan dialog. Urutan pointer+mouse
  // meniru klik manusia.
  function realClick(el) {
    const r = el.getBoundingClientRect();
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: r.x + r.width / 2,
      clientY: r.y + r.height / 2
    };
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
      try {
        const Ev = type.startsWith("pointer") ? PointerEvent : MouseEvent;
        el.dispatchEvent(new Ev(type, opts));
      } catch (_) {
        el.dispatchEvent(new MouseEvent("click", opts));
      }
    });
  }

  // Cari STATS BOX: ancestor terkecil yang memuat ketiga kata statistik
  // (kiriman/posts + pengikut/followers + diikuti/following) sekaligus.
  function findStatsBox() {
    const POSTS = /(kiriman|posts)/i;
    const FOLLOWERS = /(pengikut|followers)/i;
    const FOLLOWING = /(diikuti|following|mengikuti)/i;
    const candidates = [...document.querySelectorAll("section *, header *, main *")].filter((el) => {
      const t = el.textContent || "";
      return t.length < 400 && POSTS.test(t) && FOLLOWERS.test(t) && FOLLOWING.test(t);
    });
    candidates.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
    return candidates[0] || null;
  }

  // Pembuka daftar Following.
  // STRUKTUR ASLI (terverifikasi via DevTools): tiap statistik adalah satu
  // <div> di dalam STATS BOX. Following = <a href="#" role="link"> berisi
  // "<span>3.323</span> diikuti". href literal "#", BUKAN /following/, jadi
  // pencocokan berbasis href percuma. Strategi: temukan item yang teksnya
  // mengandung "diikuti"/"following", ambil anchor/clickable-nya.
  function getFollowingLink() {
    const FOLLOWING = /(diikuti|following|mengikuti)/i;
    // Hindari "followers"/"pengikut" agar tidak salah ambil item Followers.
    const NOT_FOLLOWERS = /(pengikut|followers)/i;

    const box = findStatsBox();
    if (box) {
      // Anak langsung box = tiga item statistik. Cari item "diikuti".
      const items = [...box.children];
      for (const item of items) {
        const t = (item.textContent || "").toLowerCase();
        if (FOLLOWING.test(t) && !NOT_FOLLOWERS.test(t)) {
          const a = item.querySelector('a, [role="link"], [role="button"]') || clickableAncestor(item);
          logFollowingBtn(a);
          return a;
        }
      }
      // Fallback dalam box: anchor terakhir (urutan posts, followers, following;
      // posts tanpa anchor, jadi anchor ke-2 = following).
      const anchors = box.querySelectorAll('a, [role="link"]');
      if (anchors.length >= 2) {
        const el = anchors[anchors.length - 1];
        logFollowingBtn(el);
        return el;
      }
    }

    // Fallback global: <a> yang teksnya memuat "diikuti"/"following" + angka.
    const a2 = [...document.querySelectorAll('a, [role="link"]')].find((a) => {
      const t = (a.textContent || "").toLowerCase();
      return FOLLOWING.test(t) && !NOT_FOLLOWERS.test(t) && /\d/.test(t);
    });
    if (a2) {
      logFollowingBtn(a2);
      return a2;
    }

    // Fallback terluas: span/li pendek "diikuti"/"following" + angka.
    const s3 = [...document.querySelectorAll("span, li, div")].find((el) => {
      const t = (el.textContent || "").toLowerCase();
      return (
        FOLLOWING.test(t) &&
        !NOT_FOLLOWERS.test(t) &&
        /\d/.test(t) &&
        t.length < 30
      );
    });
    if (s3) {
      const el = clickableAncestor(s3);
      logFollowingBtn(el);
      return el;
    }

    return null;
  }

  // Kumpulkan area statistik profil dan textContent SEMUA elemen di dalamnya.
  // Untuk verifikasi struktur DOM lewat DevTools.
  function collectStatsArea() {
    const container = findStatsBox();
    if (!container) return { found: false, fullText: "", elements: [] };

    // textContent (bukan innerText) tiap elemen, termasuk nested, supaya
    // struktur span bersarang terlihat utuh.
    const elements = [...container.querySelectorAll("*")]
      .map((el) => ({
        tag: el.tagName,
        href: el.getAttribute ? el.getAttribute("href") : null,
        title: el.getAttribute ? el.getAttribute("title") : null,
        text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60)
      }))
      .filter((e) => e.text);

    return {
      found: true,
      fullText: (container.textContent || "").replace(/\s+/g, " ").trim(),
      elements
    };
  }

  // Print area statistik ke console. Dipanggil sekali per akun (tanpa syarat),
  // jadi tetap terlihat walau getFollowingLink berhasil.
  function dumpStatsArea(source) {
    const stats = collectStatsArea();
    console.log("[SNA] DIAGNOSTIC stats @" + source, stats);
    return stats;
  }

  // Dump kondisi halaman saat pencarian gagal. Tujuannya membedakan:
  // belum login / interstitial / DOM berubah. Lihat console: "[SNA] DIAGNOSTIC".
  function dumpDiagnostics(source) {
    const hrefs = Array.from(document.querySelectorAll("a[href]"))
      .map((a) => a.getAttribute("href"))
      .filter(Boolean);

    const mentions = [];
    document.querySelectorAll("a, button, div, span, li").forEach((n) => {
      const t = (n.textContent || "").replace(/\s+/g, " ").trim();
      if (t && t.length <= 40 && /(following|mengikuti)/i.test(t)) {
        mentions.push({
          tag: n.tagName,
          text: t,
          href: n.getAttribute ? n.getAttribute("href") : null
        });
      }
    });

    const bodyHead = (document.body ? document.body.innerText : "").slice(0, 500);
    const diag = {
      source,
      url: location.href,
      title: document.title,
      hasDialog: !!document.querySelector('div[role="dialog"]'),
      hasPasswordField: !!document.querySelector('input[name="password"]'),
      looksLoginPage: /\blog in\b|masuk|sign up|daftar/i.test(bodyHead),
      anchorCount: hrefs.length,
      followingHrefs: hrefs.filter((h) => h.includes("/following")),
      sampleHrefs: hrefs.slice(0, 40),
      mentionsFollowing: mentions.slice(0, 15),
      stats: collectStatsArea()
    };
    console.log("[SNA] DIAGNOSTIC", diag);
    return diag;
  }

  // Parse angka following untuk estimasi persen. Best-effort lintas-locale:
  // "1,234" / "1.234" / "1.2K" / "1,2 rb" / "3 jt".
  function parseCount(raw) {
    if (!raw) return null;
    const s = String(raw).toLowerCase().trim();
    let mult = 1;
    if (/(k\b|k$|\brb\b|rb$)/.test(s)) mult = 1e3;
    if (/(m\b|m$|\bjt\b|jt$)/.test(s)) mult = 1e6;
    let num = s.replace(/[^\d.,]/g, "");
    if (!num) return null;
    if (mult > 1) {
      num = num.replace(",", ".");
      const f = parseFloat(num);
      return isNaN(f) ? null : Math.round(f * mult);
    }
    num = num.replace(/[.,]/g, ""); // separator ribuan
    const n = parseInt(num, 10);
    return isNaN(n) ? null : n;
  }

  // ---------- DOM dialog ----------
  // Cari scroll container DI DALAM dialog, bukan scan seluruh halaman.
  // Kandidat: div overflowY scroll/auto, scrollHeight>clientHeight, isi link profil.
  function findScroller(dialog) {
    const divs = Array.from(dialog.querySelectorAll("div"));
    let best = null;
    for (const d of divs) {
      const oy = getComputedStyle(d).overflowY;
      if ((oy === "auto" || oy === "scroll") && d.scrollHeight > d.clientHeight + 10) {
        if (d.querySelector('a[href^="/"]')) {
          if (!best || d.scrollHeight > best.scrollHeight) best = d;
        }
      }
    }
    return best;
  }

  function hasSpinner(dialog) {
    return !!dialog.querySelector(
      '[role="progressbar"], svg[aria-label*="Loading"], svg[aria-label*="Memuat"], [aria-label="Loading..."]'
    );
  }

  function countProfileLinks(dialog) {
    let n = 0;
    dialog.querySelectorAll('a[href^="/"]').forEach((a) => {
      const m = (a.getAttribute("href") || "").match(/^\/([^/?#]+)\/$/);
      if (m && !SYSTEM_PATHS.has(m[1])) n++;
    });
    return n;
  }

  // Cari nama lengkap dari baris yang memuat anchor username. Naik beberapa
  // level lalu ambil span pertama yang masuk akal. Best-effort; target
  // (username) adalah field andalan, fullname bonus.
  function findFullName(anchor, username) {
    let node = anchor;
    for (let i = 0; i < 6 && node.parentElement; i++) {
      node = node.parentElement;
      const spans = node.querySelectorAll("span");
      for (const s of spans) {
        const t = (s.textContent || "").trim();
        if (!t || t === username) continue;
        if (BUTTON_WORDS.test(t)) continue;
        if (t.length > 80) continue;
        if (/^[\d.,]+\s*(followers|following|posts|pengikut|mengikuti)?$/i.test(t)) continue;
        return t;
      }
    }
    return "";
  }

  // Ekstrak {username -> fullname} dari isi dialog saat ini.
  function extractFromDialog(dialog) {
    const map = new Map();
    dialog.querySelectorAll('a[href^="/"]').forEach((a) => {
      const href = a.getAttribute("href") || "";
      const m = href.match(/^\/([^/?#]+)\/$/); // profil = tepat satu segmen
      if (!m) return;
      const username = m[1];
      if (SYSTEM_PATHS.has(username)) return;

      const text = (a.textContent || "").trim();
      let fullname = map.get(username) || "";
      // Tiap baris punya 2 anchor href sama: avatar (teks kosong) + username
      // (teks = username). Nama lengkap hanya dicari dari anchor username.
      if (text === username) {
        const fn = findFullName(a, username);
        if (fn) fullname = fn;
      }
      if (!map.has(username) || (fullname && !map.get(username))) {
        map.set(username, fullname);
      }
    });
    return map;
  }

  // ---------- progress & penyimpanan ----------
  async function reportProgress(state, currentEdges, followingCount, source) {
    const { allEdges = [] } = await chrome.storage.local.get("allEdges");
    const pct = followingCount
      ? Math.min(100, Math.round((currentEdges / followingCount) * 100))
      : null;
    await chrome.storage.local.set({
      progress: {
        completed: state.currentIndex,
        total: state.accounts.length,
        edges: allEdges.length + currentEdges, // approx (akun ini belum disimpan)
        current: source,
        currentEdges,
        currentPct: pct
      }
    });
  }

  // Simpan SETELAH tiap akun selesai (bukan hanya di akhir) supaya data tidak
  // hilang bila crawl ter-interrupt. Dedup by source+target.
  async function saveEdges(source, seenMap) {
    const { allEdges = [] } = await chrome.storage.local.get("allEdges");
    const key = (s, t) => s + "\u0000" + t;
    const existing = new Set(allEdges.map((e) => key(e.source, e.target)));
    seenMap.forEach((fullname, target) => {
      if (existing.has(key(source, target))) return;
      existing.add(key(source, target));
      allEdges.push({
        source,
        target,
        target_fullname: fullname || "",
        type: "Directed"
      });
    });
    await chrome.storage.local.set({ allEdges });
  }

  async function markSkipped(username, reason) {
    const { skipped = [] } = await chrome.storage.local.get("skipped");
    skipped.push({ username, reason });
    await chrome.storage.local.set({ skipped });
  }

  // ---------- maju ke akun berikutnya / selesai ----------
  async function finishOrNext() {
    const fresh = await getState();
    if (!fresh) return;

    const nextIndex = fresh.currentIndex + 1;
    fresh.currentIndex = nextIndex;
    await chrome.storage.local.set({ scrapeState: fresh });

    const { progress = {} } = await chrome.storage.local.get("progress");
    progress.completed = nextIndex;
    progress.total = fresh.accounts.length;
    await chrome.storage.local.set({ progress });

    if (nextIndex >= fresh.accounts.length) {
      fresh.running = false;
      await chrome.storage.local.set({ scrapeState: fresh });
      await log("SELESAI. " + nextIndex + " akun diproses. Klik Download.");
      return;
    }

    // Hormati Stop: bila user menekan Stop selama akun ini, jangan navigasi.
    if (!fresh.running) {
      await log("Berhenti (Stop). Tidak melanjutkan.");
      return;
    }

    const delay = Math.max(30, fresh.delay || 60);
    await log("Jeda " + delay + " detik sebelum akun berikutnya...");
    // Timer jeda hidup di konteks halaman (content.js), bukan service worker,
    // jadi selamat walau worker idle/mati selama jeda.
    await sleep(delay * 1000);

    // Cek ulang running SETELAH jeda (user mungkin menekan Stop saat menunggu).
    if (!(await isRunning())) {
      await log("Berhenti (Stop) saat jeda. Tidak navigasi.");
      return;
    }

    const next = (fresh.accounts[nextIndex] || "").trim();
    await log("Navigasi ke @" + next);
    // SELF-NAVIGATION (bukan sendMessage ke background): content script
    // menggerakkan crawl dengan mengubah lokasinya sendiri. Inilah kunci
    // workaround MV3 — tidak pernah bergantung pada service worker untuk maju.
    window.location.href = "https://www.instagram.com/" + next + "/";
  }

  // ---------- alur utama satu akun ----------
  async function run() {
    const state = await getState();
    if (!state || !state.running) {
      await log("State tidak aktif. Berhenti.");
      return;
    }

    if (isLoginWall()) {
      await log("Tidak ada sesi login. Login di tab Instagram, lalu Start ulang.");
      await stopRunning();
      return;
    }

    const idx = state.currentIndex;
    const source = (state.accounts[idx] || "").trim();
    if (!source) {
      await finishOrNext();
      return;
    }

    await log("[" + (idx + 1) + "/" + state.accounts.length + "] Membuka @" + source);

    // Tunggu header profil siap (link following / penanda private / 404).
    await waitFor(() => getFollowingLink() || isPrivate() || isUnavailable(), 12000, 400);

    // Verifikasi struktur area statistik (console). Tidak memengaruhi alur.
    dumpStatsArea(source);

    if (isUnavailable()) {
      await log("@" + source + " tidak tersedia (404/typo). Skip.");
      await markSkipped(source, "unavailable");
      await finishOrNext();
      return;
    }
    if (isPrivate()) {
      await log("@" + source + " privat. Skip (flag: private).");
      await markSkipped(source, "private");
      await finishOrNext();
      return;
    }

    const followingLink = getFollowingLink();
    if (!followingLink) {
      const d = dumpDiagnostics(source);
      // Modal login bisa muncul TERLAMBAT (setelah cek isLoginWall di awal run).
      // Kalau halaman minta login, sesi tab tidak dikenali: hentikan, jangan skip diam-diam.
      if (d.hasPasswordField || d.looksLoginPage) {
        await log(
          "@" + source +
            " halaman minta login (sesi tidak dikenali / modal login muncul). Login ulang di tab Instagram, lalu Start lagi."
        );
        await stopRunning();
        return;
      }
      await log(
        "@" + source +
          " Following tidak ketemu. anchors=" + d.anchorCount +
          ", /following-href=" + d.followingHrefs.length +
          ", dialog=" + d.hasDialog +
          ". Detail di console [SNA] DIAGNOSTIC. Skip."
      );
      await markSkipped(source, "no_following_button");
      await finishOrNext();
      return;
    }

    // Estimasi jumlah following dari tombol untuk persentase progress.
    const cntEl =
      followingLink.querySelector("[title]") ||
      followingLink.querySelector("span span") ||
      followingLink.querySelector("span");
    const followingCount = parseCount(
      (cntEl && (cntEl.getAttribute("title") || cntEl.textContent)) ||
        followingLink.textContent
    );

    // Klik tombol Following lewat dispatch event lengkap (href="#" + React).
    realClick(followingLink);

    const dialog = await waitFor(
      () => document.querySelector('div[role="dialog"]'),
      12000,
      300
    );
    if (!dialog) {
      await log("@" + source + " dialog Following tidak muncul. Skip.");
      await markSkipped(source, "no_dialog");
      await finishOrNext();
      return;
    }

    // Saat sesi tidak login (sessionid kosong), klik Following memunculkan
    // MODAL LOGIN, bukan daftar following. Deteksi dan hentikan, jangan
    // memperlakukannya sebagai dialog kosong.
    if (
      dialog.querySelector('input[name="password"]') ||
      /\blog in\b|log into|masuk|sign up|daftar/i.test(dialog.innerText || "")
    ) {
      await log(
        "@" + source +
          " yang terbuka modal LOGIN, bukan daftar following. Sesi tidak login. Login penuh di tab Instagram, lalu Start lagi."
      );
      await stopRunning();
      return;
    }

    // waitForFirstItem: tunggu minimal 2 link profil sebelum mulai scroll.
    // Akun dengan banyak following butuh waktu render; jangan scroll prematur.
    const ready = await waitFor(() => countProfileLinks(dialog) >= 2, 15000, 400);
    if (!ready) {
      await log("@" + source + " isi dialog tidak termuat. Skip.");
      await markSkipped(source, "empty_dialog");
      await finishOrNext();
      return;
    }

    const scroller = findScroller(dialog) || dialog;
    await log("@" + source + " mulai scroll (≈" + (followingCount ?? "?") + " following).");

    // ---------- loop scroll + ekstrak + stall counter ----------
    const seen = new Map(); // username -> fullname
    let stall = 0;
    while (stall < MAX_STALL) {
      // Cek running tiap iterasi supaya Stop responsif di tengah scroll.
      if (!(await isRunning())) {
        await log("Stop ditekan saat scroll. Menyimpan data parsial.");
        break;
      }

      const batch = extractFromDialog(dialog);
      let added = 0;
      batch.forEach((fn, u) => {
        if (u === source) return; // jangan masukkan diri sendiri
        if (!seen.has(u)) {
          seen.set(u, fn);
          added++;
        } else if (!seen.get(u) && fn) {
          seen.set(u, fn); // lengkapi fullname bila baru ketemu
        }
      });
      stall = added > 0 ? 0 : stall + 1;

      await reportProgress(state, seen.size, followingCount, source);

      scroller.scrollTop = scroller.scrollHeight;
      // Scroll adaptif: bila spinner loading terdeteksi, tunggu lebih lama.
      await sleep(hasSpinner(dialog) ? 1600 : 750);
    }

    await log("@" + source + " selesai: " + seen.size + " following terkumpul.");
    await saveEdges(source, seen); // simpan per-akun
    await finishOrNext();
  }

  try {
    await run();
  } catch (e) {
    await log("Error: " + (e && e.message ? e.message : String(e)));
  }
})();
