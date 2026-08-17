// =====================================================================
// popup.js
// UI + logika download. State persisten: popup hanya membaca/menulis
// chrome.storage.local, jadi ditutup-buka tetap menampilkan progress live.
// =====================================================================

const $ = (id) => document.getElementById(id);
const ta = $("accounts");
const delayInput = $("delay");
const startBtn = $("start");
const stopBtn = $("stop");
const downloadBtn = $("download");
const barFill = $("barFill");
const counter = $("counter");
const logEl = $("log");

// ---------- parsing input ----------
// Dukung: komentar "#", prefix "@", URL profil yang ditempel, dan suffix "*".
// Suffix "*" (boleh ada spasi sebelumnya) = akun "besar" -> ditaruh di akhir
// antrian, supaya akun ringan selesai dulu dan akun berat tidak memblok awal.
// Reorder dilakukan di sini (popup), tanpa probe / request tambahan.
function parseAccounts(text) {
  const groupA = []; // normal / tidak ditandai
  const groupB = []; // ditandai "*" -> proses terakhir
  text.split("\n").forEach((raw) => {
    let line = raw.split("#")[0].trim(); // buang komentar inline
    if (!line) return;

    const isBig = /\*\s*$/.test(line); // tanda * di akhir baris
    line = line.replace(/\*\s*$/, "").trim();

    const username = line
      .replace(/^@/, "")
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/[/?].*$/, "")
      .trim();
    if (!username) return;

    (isBig ? groupB : groupA).push(username);
  });
  // final order = [...Grup A (kecil/unknown), ...Grup B (besar)]
  return [...groupA, ...groupB];
}

// ---------- start / stop ----------
async function start() {
  const accounts = parseAccounts(ta.value);
  if (!accounts.length) {
    alert("Masukkan minimal satu username.");
    return;
  }
  let delay = parseInt(delayInput.value, 10);
  if (isNaN(delay) || delay < 30) delay = 30;
  delayInput.value = delay;

  // Run baru: reset hasil, log, dan progress sebelumnya.
  await chrome.storage.local.set({
    allEdges: [],
    skipped: [],
    log: [],
    progress: { completed: 0, total: accounts.length, edges: 0 }
  });

  chrome.runtime.sendMessage({ type: "START", accounts, delay }, () => {});
}

function stop() {
  chrome.runtime.sendMessage({ type: "STOP" }, () => {});
}

// ---------- download dua CSV ----------
function csvEscape(v) {
  v = v == null ? "" : String(v);
  if (/[",\n\r]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
  return v;
}
function toCsv(header, rows) {
  const lines = [header.map(csvEscape).join(",")];
  for (const r of rows) lines.push(r.map(csvEscape).join(","));
  return lines.join("\r\n");
}
function triggerDownload(name, content) {
  // BOM \uFEFF supaya Excel membaca UTF-8 dengan benar.
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function download() {
  const { allEdges = [] } = await chrome.storage.local.get("allEdges");
  if (!allEdges.length) {
    alert("Belum ada data untuk diunduh.");
    return;
  }

  // edges.csv : source, target, type=Directed
  const edgesCsv = toCsv(
    ["source", "target", "type"],
    allEdges.map((e) => [e.source, e.target, e.type || "Directed"])
  );

  // nodes_raw.csv : id, title, institution, followers, is_verified
  // institution: source = "government", target-only = "unknown".
  const nodes = new Map();
  for (const e of allEdges) {
    if (!nodes.has(e.source)) {
      nodes.set(e.source, { id: e.source, title: e.source, institution: "government" });
    }
  }
  for (const e of allEdges) {
    if (!nodes.has(e.target)) {
      nodes.set(e.target, {
        id: e.target,
        title: e.target_fullname || e.target,
        institution: "unknown"
      });
    } else {
      // Node yang juga muncul sebagai target: lengkapi title bila masih kosong.
      const n = nodes.get(e.target);
      if (n.title === e.target && e.target_fullname) n.title = e.target_fullname;
    }
  }
  const nodesCsv = toCsv(
    ["id", "title", "institution", "followers", "is_verified"],
    [...nodes.values()].map((n) => [n.id, n.title, n.institution, "", ""])
  );

  triggerDownload("edges.csv", edgesCsv);
  // jeda kecil supaya browser tidak menggabung/menolak unduhan kedua.
  setTimeout(() => triggerDownload("nodes_raw.csv", nodesCsv), 350);
}

// ---------- render state (persisten & live) ----------
async function render() {
  const { scrapeState, progress = {}, log = [] } = await chrome.storage.local.get([
    "scrapeState",
    "progress",
    "log"
  ]);

  const running = !!(scrapeState && scrapeState.running);

  // Pulihkan daftar akun & jeda saat popup dibuka ulang di tengah run.
  if (scrapeState && document.activeElement !== ta && !ta.value.trim()) {
    ta.value = (scrapeState.accounts || []).join("\n");
  }
  if (scrapeState && scrapeState.delay && document.activeElement !== delayInput) {
    delayInput.value = scrapeState.delay;
  }

  startBtn.disabled = running;
  stopBtn.disabled = !running;
  ta.disabled = running;
  delayInput.disabled = running;

  const total = progress.total || (scrapeState ? scrapeState.accounts.length : 0) || 0;
  const completed = progress.completed || 0;
  const pctAccounts = total ? Math.round((completed / total) * 100) : 0;
  barFill.style.width = pctAccounts + "%";

  if (running || completed) {
    const cur = progress.current ? "@" + progress.current : "-";
    const curPct = progress.currentPct != null ? " (" + progress.currentPct + "%)" : "";
    counter.innerHTML =
      "Akun <b>" + completed + "/" + total + "</b> · edges <b>" +
      (progress.edges || 0) + "</b> · sekarang " + cur +
      (running ? curPct : "");
  } else {
    counter.textContent = "Idle.";
  }

  // log
  logEl.innerHTML = "";
  for (const entry of log) {
    const d = document.createElement("div");
    d.innerHTML = '<span class="t">[' + entry.ts + "]</span> " + escapeHtml(entry.msg);
    logEl.appendChild(d);
  }
  logEl.scrollTop = logEl.scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

// ---------- wiring ----------
startBtn.addEventListener("click", start);
stopBtn.addEventListener("click", stop);
downloadBtn.addEventListener("click", download);

// Update live tanpa polling: dengarkan perubahan storage dari content.js.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.progress || changes.log || changes.scrapeState) render();
});

render();
