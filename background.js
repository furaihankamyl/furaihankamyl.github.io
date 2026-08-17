// =====================================================================
// background.js  (MV3 service worker)
//
// Sengaja MINIMAL. Tugasnya hanya dua:
//   1. Terima START/STOP dari popup.
//   2. Inject ulang content.js setiap kali tab crawl selesai memuat.
//
// MENGAPA minimal: service worker MV3 mati setelah ~30 detik idle. Crawl
// kita berjalan menit-an dan multi-akun, jadi SEMUA state, navigasi, dan
// penulisan storage ditaruh di content.js (hidup di konteks halaman, tidak
// ikut mati). Background tidak boleh memegang logika navigasi atau state.
// =====================================================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START") {
    startRun(msg.accounts, msg.delay).then(() => sendResponse({ ok: true }));
    return true; // async sendResponse
  }
  if (msg.type === "STOP") {
    stopRun().then(() => sendResponse({ ok: true }));
    return true;
  }
});

function profileUrl(username) {
  return "https://www.instagram.com/" + String(username).trim() + "/";
}

async function startRun(accounts, delay) {
  // currentIndex=0; running=true. allEdges sudah direset oleh popup saat Start.
  await chrome.storage.local.set({
    scrapeState: { accounts, currentIndex: 0, delay, running: true }
  });

  // Buka satu tab khusus untuk crawl dan catat id-nya. Re-injection di
  // onUpdated hanya berlaku untuk tab ini, supaya tidak mengganggu tab IG lain.
  const tab = await chrome.tabs.create({ url: profileUrl(accounts[0]) });
  await chrome.storage.local.set({ scrapeTabId: tab.id });
  // Tidak perlu inject manual di sini: event "complete" untuk load pertama
  // akan ditangkap onUpdated di bawah (IG butuh beberapa detik untuk load,
  // jauh lebih lama dari penulisan scrapeTabId di atas).
}

async function stopRun() {
  const { scrapeState } = await chrome.storage.local.get("scrapeState");
  if (scrapeState) {
    scrapeState.running = false;
    await chrome.storage.local.set({ scrapeState });
  }
}

// Inti workaround MV3:
// content.js maju ke akun berikutnya dengan mengubah window.location.href
// sendiri (self-navigation), BUKAN dengan mengirim pesan ke background.
// Self-navigation = full page load => event "complete" di bawah ter-fire =>
// kita inject content.js lagi. Loop berlanjut walau service worker sempat
// tidur/mati di antara akun, karena yang menjaga timer jeda adalah halaman.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;

  const { scrapeState, scrapeTabId } = await chrome.storage.local.get([
    "scrapeState",
    "scrapeTabId"
  ]);

  if (!scrapeState || !scrapeState.running) return; // tidak sedang crawl
  if (tabId !== scrapeTabId) return;                 // bukan tab crawl kita
  if (!tab.url || !tab.url.startsWith("https://www.instagram.com/")) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  } catch (e) {
    // Injection bisa gagal di halaman non-IG / chrome:// dsb. Abaikan.
    console.warn("[SNA] inject gagal:", e && e.message);
  }
});
