/* ===================== THEME ===================== */
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const savedTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');
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
}
document.getElementById('themeToggle').addEventListener('click', toggleTheme);
document.getElementById('themeToggleMobile').addEventListener('click', toggleTheme);

/* ===================== CURSOR ===================== */
const cursor = document.getElementById('cursor');
const ring = document.getElementById('cursorRing');
let mx = -100, my = -100, rx = -100, ry = -100;

document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

function animateCursor() {
  cursor.style.left = mx + 'px'; cursor.style.top = my + 'px';
  rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12;
  ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
  requestAnimationFrame(animateCursor);
}
animateCursor();

document.querySelectorAll('a, button, .activity-card, .pub-card, .edu-card, .filter-btn').forEach(el => {
  el.addEventListener('mouseenter', () => { cursor.classList.add('hovering'); ring.classList.add('hovering'); });
  el.addEventListener('mouseleave', () => { cursor.classList.remove('hovering'); ring.classList.remove('hovering'); });
});

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
  el.innerHTML = PORTFOLIO_DATA.personal.about.split('\n\n').map(p => `<p>${p.trim()}</p>`).join('');
}

/* ===================== TIMELINE ===================== */
function renderTimeline(id, items, isOrg = false) {
  document.getElementById(id).innerHTML = items.map(item => `
    <div class="timeline-item">
      <div class="timeline-left"><div class="timeline-period">${item.period}</div></div>
      <div class="timeline-right">
        <div class="timeline-logo-wrap">
          <img src="${item.logo}" alt="${isOrg ? item.org : item.company}" class="timeline-logo"
            onerror="this.parentElement.style.display='none'" />
        </div>
        <div class="timeline-role">${item.role}</div>
        <div class="timeline-company">${isOrg ? item.org : item.company}</div>
        ${item.type ? `<div class="timeline-type">${item.type}</div>` : ''}
        <ul class="timeline-bullets">${(item.bullets||[]).map(b => `<li>${b}</li>`).join('')}</ul>
      </div>
    </div>
  `).join('');
}

/* ===================== EDUCATION ===================== */
function renderEducation() {
  document.getElementById('eduGrid').innerHTML = PORTFOLIO_DATA.education.map(e => `
    <div class="edu-card">
      <div class="edu-header">
        <div class="edu-logo-wrap">
          <img src="${e.logo}" alt="${e.institution}" class="edu-logo" onerror="this.parentElement.style.display='none'" />
        </div>
        <div>
          <div class="edu-institution">${e.institution}</div>
          <div class="edu-degree">${e.degree}</div>
        </div>
      </div>
      <div class="edu-meta">
        <span class="edu-badge">${e.period}</span>
        <span class="edu-badge">GPA ${e.gpa}</span>
        ${e.honor ? `<span class="edu-badge">${e.honor}</span>` : ''}
      </div>
      ${e.note ? `<p class="edu-note">${e.note}</p>` : ''}
    </div>
  `).join('');
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
  el.innerHTML = items.map(item => `
    <div class="activity-card" onclick="window.location.href='article.html?slug=${item.slug}'">
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

  // Re-attach cursor listeners for new cards
  document.querySelectorAll('.activity-card').forEach(el => {
    el.addEventListener('mouseenter', () => { cursor.classList.add('hovering'); ring.classList.add('hovering'); });
    el.addEventListener('mouseleave', () => { cursor.classList.remove('hovering'); ring.classList.remove('hovering'); });
  });
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
    btn.addEventListener('mouseenter', () => { cursor.classList.add('hovering'); ring.classList.add('hovering'); });
    btn.addEventListener('mouseleave', () => { cursor.classList.remove('hovering'); ring.classList.remove('hovering'); });
  });
}

/* ===================== AWARDS ===================== */
function renderAwards() {
  document.getElementById('awardsList').innerHTML = PORTFOLIO_DATA.awards.map(a => `
    <div class="award-item">
      <div class="award-year">${a.year}</div>
      <div>
        <div class="award-title">${a.title}</div>
        <div class="award-issuer">${a.issuer}</div>
      </div>
    </div>
  `).join('');
}

/* ===================== PUBLICATIONS ===================== */
function drivePreviewUrl(id) {
  return `https://drive.google.com/file/d/${id}/preview`;
}

function openPdf(driveId, title) {
  document.getElementById('pdfModalTitle').textContent = title;
  document.getElementById('pdfModalFrame').src = drivePreviewUrl(driveId);
  document.getElementById('pdfModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePdf() {
  document.getElementById('pdfModal').classList.remove('open');
  document.getElementById('pdfModalFrame').src = '';
  document.body.style.overflow = '';
}

document.getElementById('pdfModalClose').addEventListener('click', closePdf);
document.getElementById('pdfModal').addEventListener('click', e => {
  if (e.target === document.getElementById('pdfModal')) closePdf();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePdf(); });

function renderPublications() {
  document.getElementById('pubList').innerHTML = PORTFOLIO_DATA.publications.map(pub => `
    <div class="pub-card" onclick="openPdf('${pub.driveId}', '${pub.title.replace(/'/g, "\\'")}')">
      <div class="pub-year">${pub.year}</div>
      <div class="pub-title">${pub.title}</div>
      <div class="pub-author">${pub.author}</div>
      <div class="pub-venue">${pub.venue}</div>
      <span class="pub-read-btn">Read paper ↗</span>
    </div>
  `).join('');

  document.querySelectorAll('.pub-card').forEach(el => {
    el.addEventListener('mouseenter', () => { cursor.classList.add('hovering'); ring.classList.add('hovering'); });
    el.addEventListener('mouseleave', () => { cursor.classList.remove('hovering'); ring.classList.remove('hovering'); });
  });
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

/* ===================== SCROLL ANIMATIONS ===================== */
function initFadeUp() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.08 });
  document.querySelectorAll('.fade-up').forEach(el => obs.observe(el));
}

/* ===================== INIT ===================== */
document.addEventListener('DOMContentLoaded', () => {
  renderAbout();
  renderTimeline('experienceTimeline', PORTFOLIO_DATA.experience);
  renderTimeline('orgTimeline', PORTFOLIO_DATA.organizations, true);
  renderEducation();
  renderFilterBar();
  renderActivities();
  renderAwards();
  renderPublications();
  renderSkills();
  renderContact();
  initFadeUp();
});
