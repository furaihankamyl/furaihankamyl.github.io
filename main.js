/* ===================== THEME ===================== */
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

function updateThemeIcons(t) {
  document.querySelectorAll('.theme-toggle').forEach(b => b.textContent = t === 'dark' ? '☀' : '☾');
}
updateThemeIcons(savedTheme);

function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcons(next);
  if (networkAnim) networkAnim.updateColors();
}
document.getElementById('themeToggle').addEventListener('click', toggleTheme);
document.getElementById('themeToggleMobile').addEventListener('click', toggleTheme);

/* ===================== NAV ===================== */
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
let menuOpen = false;

hamburger.addEventListener('click', () => {
  menuOpen = !menuOpen;
  navLinks.classList.toggle('open', menuOpen);
  const spans = hamburger.querySelectorAll('span');
  if (menuOpen) {
    spans[0].style.transform = 'rotate(45deg) translate(4px, 4px)';
    spans[1].style.opacity = '0';
    spans[2].style.transform = 'rotate(-45deg) translate(4px, -4px)';
  } else {
    spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
  }
});
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  menuOpen = false; navLinks.classList.remove('open');
  hamburger.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
}));

function checkMobile() {
  document.getElementById('themeToggleMobile').style.display = window.innerWidth <= 960 ? 'flex' : 'none';
}
checkMobile();
window.addEventListener('resize', checkMobile);

/* ===================== ABOUT ===================== */
function renderAbout() {
  const el = document.getElementById('aboutText');
  const paragraphs = PORTFOLIO_DATA.personal.about.split('\n\n');
  el.innerHTML = paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
}

/* ===================== NETWORK ANIMATION (fixed hero backdrop) =====================
   Full-viewport constellation on the always-dark hero. Independent of theme.
   Pauses (and hides the fixed layer) once the page content fully covers the hero. */
let networkAnim = null;

function initNetwork() {
  const canvas = document.getElementById('networkCanvas');
  const heroFixed = document.getElementById('heroFixed');
  const hero = document.getElementById('hero');
  if (!canvas || !heroFixed || !hero) return;
  const ctx = canvas.getContext('2d');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const COUNT = isMobile ? 26 : 60;
  const LINK = isMobile ? 110 : 150;

  let W = 0, H = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  const nodes = Array.from({ length: COUNT }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    vx: (Math.random() - 0.5) * 0.22,
    vy: (Math.random() - 0.5) * 0.22,
    r: 1 + Math.random() * 1.5
  }));

  const mouse = { x: -9999, y: -9999 };
  window.addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  window.addEventListener('pointerleave', () => { mouse.x = -9999; mouse.y = -9999; });
  window.addEventListener('resize', () => {
    resize();
    nodes.forEach(n => { n.x = Math.min(n.x, W); n.y = Math.min(n.y, H); });
    if (reduced) drawFrame(false);
  });

  const NODE_COLOR = 'rgba(242,242,242,0.7)';
  const EDGE_RGB = '242,242,242';

  function drawFrame(move) {
    ctx.clearRect(0, 0, W, H);

    if (move) {
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -10) n.x = W + 10; else if (n.x > W + 10) n.x = -10;
        if (n.y < -10) n.y = H + 10; else if (n.y > H + 10) n.y = -10;

        // Gentle repulsion around the cursor (desktop feel; harmless on touch)
        const dx = n.x - mouse.x, dy = n.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 14400 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const f = ((120 - d) / 120) * 0.6;
          n.x += (dx / d) * f;
          n.y += (dy / d) * f;
        }
      });
    }

    // Edges by proximity
    for (let i = 0; i < COUNT; i++) {
      for (let j = i + 1; j < COUNT; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < LINK * LINK) {
          const alpha = (1 - Math.sqrt(d2) / LINK) * 0.3;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.strokeStyle = `rgba(${EDGE_RGB},${alpha.toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // Nodes
    ctx.fillStyle = NODE_COLOR;
    nodes.forEach(n => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  let rafId = null;
  function loop() {
    drawFrame(true);
    rafId = requestAnimationFrame(loop);
  }

  if (reduced) {
    drawFrame(false); // static constellation, no motion
  } else {
    loop();
  }

  // Pause + hide the fixed layer once content fully covers the hero
  const visObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        heroFixed.classList.remove('is-hidden');
        if (!reduced && rafId === null) loop();
      } else {
        heroFixed.classList.add('is-hidden');
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      }
    });
  }, { threshold: 0 });
  visObserver.observe(hero);

  // Hero is always dark; theme toggle doesn't affect it
  networkAnim = { updateColors: () => {} };
}

/* ===================== NAV OVER HERO ===================== */
function initHeroNav() {
  const nav = document.getElementById('nav');
  const hero = document.getElementById('hero');
  if (!nav || !hero) return;
  function update() {
    const threshold = hero.offsetTop + hero.offsetHeight - 80;
    nav.classList.toggle('on-hero', window.scrollY < threshold);
  }
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

/* ===================== EXPERIENCE & LEADERSHIP ===================== */
function renderExpList(id, items, isOrg = false) {
  document.getElementById(id).innerHTML = items.map((item, i) => {
    const org = isOrg ? item.org : item.company;
    const isDarkLogo = item.logo && item.logo.includes('goto');
    const initials = org.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `
    <div class="exp-item fade-up" style="--d:${Math.min(i, 5) * 60}">
      <div class="exp-head">
        <div class="exp-logo-wrap${isDarkLogo ? ' logo-dark' : ''}">
          <img src="${item.logo}" alt="${org}" class="exp-logo"
            onerror="this.style.display='none';this.parentElement.querySelector('.logo-fallback').style.display='flex'" />
          <span class="logo-fallback" style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:9px;font-weight:500;color:var(--text-3);">${initials}</span>
        </div>
        <div class="exp-head-main">
          <div class="exp-role">${item.role}</div>
          <div class="exp-org">${org}${item.type ? ` · ${item.type}` : ''}</div>
        </div>
        <div class="exp-period">${item.period}</div>
      </div>
      <p class="exp-summary">${item.summary}</p>
    </div>`;
  }).join('');
}

/* ===================== ACTIVITIES ===================== */
let activeFilter = 'All';

function renderActivities(filter = 'All') {
  const items = filter === 'All' ? PORTFOLIO_DATA.activities : PORTFOLIO_DATA.activities.filter(a => a.category === filter);
  const el = document.getElementById('activitiesGrid');
  if (!items.length) {
    el.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text-3);font-size:13px;">No activities in this category yet.</div>`;
    return;
  }
  el.innerHTML = items.map((item, i) => `
    <div class="activity-card fade-up" style="--d:${(i % 3) * 80}" onclick="window.location.href='article.html?slug=${item.slug}'">
      <div class="activity-thumb-wrap">
        <img src="${item.thumbnail}" alt="${item.title}" class="activity-thumb"
          onerror="this.parentElement.style.minHeight='120px';this.style.display='none'" />
      </div>
      <div class="activity-body">
        <div class="activity-category">${item.category}</div>
        <h3 class="activity-title">${item.title}</h3>
        <p class="activity-desc">${item.description}</p>
      </div>
      <div class="activity-footer">
        <span class="activity-date">${item.date}</span>
        <span class="activity-arrow">↗</span>
      </div>
    </div>
  `).join('');
  observeFadeUps(el);
  if (el._resetSlider) el._resetSlider();
}

function renderFilterBar() {
  const cats = ['All', ...new Set(PORTFOLIO_DATA.activities.map(a => a.category))];
  const el = document.getElementById('filterBar');
  el.innerHTML = cats.map(c => `<button class="filter-btn ${c === activeFilter ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('');
  el.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.cat;
      el.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === activeFilter));
      renderActivities(activeFilter);
    });
  });
  
}

/* ===================== AWARDS ===================== */
const AWARDS_VISIBLE = 8;

function renderAwards() {
  const list = PORTFOLIO_DATA.awards;
  document.getElementById('awardsList').innerHTML = list.map((a, i) => `
    <div class="award-item${i >= AWARDS_VISIBLE ? ' is-hidden' : ''}">
      <div class="award-year">${a.year}</div>
      <div>
        <div class="award-title">${a.title}</div>
        <div class="award-issuer">${a.issuer}</div>
      </div>
    </div>
  `).join('');

  const wrap = document.getElementById('awardsToggle');
  const btn = document.getElementById('awardsToggleBtn');
  if (!wrap || !btn) return;
  if (list.length <= AWARDS_VISIBLE) { wrap.style.display = 'none'; return; }

  let expanded = false;
  const label = () => { btn.textContent = expanded ? 'Show less' : `Show all ${list.length}`; };
  label();
  btn.onclick = () => {
    expanded = !expanded;
    document.querySelectorAll('#awardsList .award-item').forEach((el, i) => {
      el.classList.toggle('is-hidden', !expanded && i >= AWARDS_VISIBLE);
    });
    btn.setAttribute('aria-expanded', String(expanded));
    label();
    if (!expanded) document.getElementById('awards').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

/* ===================== PUBLICATIONS + PDF MODAL ===================== */
const pdfModal = document.getElementById('pdfModal');
const pdfFrame = document.getElementById('pdfModalFrame');
const pdfTitle = document.getElementById('pdfModalTitle');
const pdfClose = document.getElementById('pdfModalClose');

function openPdf(driveId, title) {
  pdfTitle.textContent = title;
  pdfFrame.src = `https://drive.google.com/file/d/${driveId}/preview`;
  pdfModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePdf() {
  pdfModal.classList.remove('open');
  setTimeout(() => { pdfFrame.src = ''; }, 300);
  document.body.style.overflow = '';
}

pdfClose.addEventListener('click', closePdf);
pdfModal.addEventListener('click', e => { if (e.target === pdfModal) closePdf(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePdf(); });

function renderPublications() {
  const el = document.getElementById('pubList');
  el.innerHTML = PORTFOLIO_DATA.publications.map((pub, i) => {
    const safeTitle = pub.title.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    return `
      <div class="pub-card fade-up" style="--d:${Math.min(i, 6) * 70}" role="button" tabindex="0"
        onclick="openPdf('${pub.driveId}', '${safeTitle}')"
        onkeydown="if(event.key==='Enter')openPdf('${pub.driveId}','${safeTitle}')">
        <div class="pub-year">${pub.year}</div>
        <div class="pub-title">${pub.title}</div>
        <div class="pub-author">${pub.author}</div>
        <div class="pub-venue">${pub.venue}</div>
        <span class="pub-read-btn">Read paper ↗</span>
      </div>
    `;
  }).join('');
  
}

/* ===================== SKILLS ===================== */
function renderSkills() {
  document.getElementById('skillsGrid').innerHTML = Object.entries(PORTFOLIO_DATA.skills).map(([g, tags]) => `
    <div class="skill-group">
      <div class="skill-group-name">${g}</div>
      <div class="skill-tags">${tags.map(t => `<span class="skill-tag">${t}</span>`).join('')}</div>
    </div>
  `).join('');
}

/* ===================== CONTACT ===================== */
function renderContact() {
  const { email, whatsapp, linkedin } = PORTFOLIO_DATA.personal.contact;
  document.getElementById('contactLinks').innerHTML = `
    <a href="mailto:${email}" class="contact-link">✉ Email</a>
    <a href="https://wa.me/${whatsapp}" target="_blank" rel="noopener" class="contact-link">💬 WhatsApp</a>
    <a href="https://linkedin.com/in/${linkedin}" target="_blank" rel="noopener" class="contact-link">in LinkedIn</a>
  `;
  
}

/* ===================== ACTIVITIES SLIDER ===================== */
function initActivitiesSlider() {
  const track = document.getElementById('activitiesGrid');
  const prev = document.getElementById('actPrev');
  const next = document.getElementById('actNext');
  const nav = document.getElementById('sliderNav');
  if (!track || !prev || !next) return;

  const pageStep = () => Math.max(track.clientWidth * 0.92, 240);

  prev.addEventListener('click', () => track.scrollBy({ left: -pageStep(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: pageStep(), behavior: 'smooth' }));

  function update() {
    const fits = track.scrollWidth <= track.clientWidth + 2;
    if (nav) nav.style.display = fits ? 'none' : 'flex';
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  }

  track.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);

  track._resetSlider = () => { track.scrollLeft = 0; update(); };
  update();
}

/* ===================== SCROLL ANIMATIONS ===================== */
let fadeObserver = null;

function initFadeUp() {
  fadeObserver = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); fadeObserver.unobserve(e.target); } });
  }, { threshold: 0.06 });
  document.querySelectorAll('.fade-up').forEach(el => fadeObserver.observe(el));
}

function observeFadeUps(container) {
  if (!fadeObserver) return;
  container.querySelectorAll('.fade-up').forEach(el => {
    if (!el.classList.contains('visible')) fadeObserver.observe(el);
  });
}

/* ===================== SCROLL SPY (active nav) ===================== */
function initScrollSpy() {
  const links = Array.from(document.querySelectorAll('.nav-links a'));
  const map = new Map();
  links.forEach(a => {
    const id = a.getAttribute('href').slice(1);
    const sec = document.getElementById(id);
    if (sec) map.set(sec, a);
  });
  if (!map.size) return;

  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(a => a.classList.remove('active'));
        const active = map.get(e.target);
        if (active) active.classList.add('active');
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

  map.forEach((_, sec) => spy.observe(sec));
}

/* ===================== INIT ===================== */
document.addEventListener('DOMContentLoaded', () => {
  renderAbout();
  renderExpList('experienceList', PORTFOLIO_DATA.experience);
  renderExpList('orgList', PORTFOLIO_DATA.organizations, true);
  renderFilterBar();
  renderActivities();
  renderAwards();
  renderPublications();
  renderSkills();
  renderContact();
  initFadeUp();
  initActivitiesSlider();
  initScrollSpy();
  initNetwork();
  initHeroNav();
});
/* ===================== LIQUID GLASS GLARE ===================== */
(function () {
  const sel = '.activity-card, .pub-card, .slider-btn, .contact-link, .theme-toggle';
  let raf = null, pending = null;
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest(sel);
    if (!el) return;
    pending = { el, x: e.clientX, y: e.clientY };
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });
  function apply() {
    raf = null;
    if (!pending) return;
    const { el, x, y } = pending;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', ((x - r.left) / r.width) * 100 + '%');
    el.style.setProperty('--my', ((y - r.top) / r.height) * 100 + '%');
  }
})();
