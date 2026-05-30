/* ===================== THEME ===================== */
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const savedTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', savedTheme);

function updateThemeIcons(theme) {
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = theme === 'dark' ? '☀' : '☾';
  });
}
updateThemeIcons(savedTheme);

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcons(next);
}

document.getElementById('themeToggle').addEventListener('click', toggleTheme);
document.getElementById('themeToggleMobile').addEventListener('click', toggleTheme);

/* ===================== NAV / HAMBURGER ===================== */
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

navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    menuOpen = false;
    navLinks.classList.remove('open');
    hamburger.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
  });
});

// Show mobile theme toggle on small screens
function checkMobileTheme() {
  const isMobile = window.innerWidth <= 900;
  document.getElementById('themeToggleMobile').style.display = isMobile ? 'flex' : 'none';
}
checkMobileTheme();
window.addEventListener('resize', checkMobileTheme);

/* ===================== ABOUT ===================== */
function renderAbout() {
  const el = document.getElementById('aboutText');
  const paragraphs = PORTFOLIO_DATA.personal.about.split('\n\n');
  el.innerHTML = paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
}

/* ===================== TIMELINE ===================== */
function renderTimeline(containerId, items, isOrg = false) {
  const el = document.getElementById(containerId);
  el.innerHTML = items.map(item => {
    const company = isOrg ? item.org : item.company;
    const logo = item.logo;
    const role = item.role;
    const type = item.type || '';
    const period = item.period;
    const bullets = item.bullets || [];
    return `
      <div class="timeline-item">
        <div class="timeline-left">
          <div class="timeline-period">${period}</div>
        </div>
        <div class="timeline-right">
          <img src="${logo}" alt="${company}" class="timeline-logo" onerror="this.style.display='none'" />
          <div class="timeline-role">${role}</div>
          <div class="timeline-company">${company}</div>
          ${type ? `<div class="timeline-type">${type}</div>` : ''}
          <ul class="timeline-bullets">
            ${bullets.map(b => `<li>${b}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }).join('');
}

/* ===================== EDUCATION ===================== */
function renderEducation() {
  const el = document.getElementById('eduGrid');
  el.innerHTML = PORTFOLIO_DATA.education.map(edu => `
    <div class="edu-card">
      <div class="edu-header">
        <img src="${edu.logo}" alt="${edu.institution}" class="edu-logo" onerror="this.style.display='none'" />
        <div>
          <div class="edu-institution">${edu.institution}</div>
          <div class="edu-degree">${edu.degree}</div>
        </div>
      </div>
      <div class="edu-meta">
        <span class="edu-badge">${edu.period}</span>
        <span class="edu-badge">GPA ${edu.gpa}</span>
        ${edu.honor ? `<span class="edu-badge">${edu.honor}</span>` : ''}
      </div>
      ${edu.note ? `<p class="edu-note">${edu.note}</p>` : ''}
    </div>
  `).join('');
}

/* ===================== ACTIVITIES ===================== */
let activeFilter = 'All';

function renderActivities(filter = 'All') {
  const el = document.getElementById('activitiesGrid');
  const items = filter === 'All'
    ? PORTFOLIO_DATA.activities
    : PORTFOLIO_DATA.activities.filter(a => a.category === filter);

  if (items.length === 0) {
    el.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text-3);font-size:13px;">No activities in this category yet.</div>`;
    return;
  }

  el.innerHTML = items.map(item => `
    <div class="activity-card" onclick="openArticle('${item.slug}')">
      <div class="activity-thumb-wrap">
        <img src="${item.thumbnail}" alt="${item.title}" class="activity-thumb"
          onerror="this.parentElement.style.background='var(--bg-2)';this.style.display='none'" />
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
}

function renderFilterBar() {
  const categories = ['All', ...new Set(PORTFOLIO_DATA.activities.map(a => a.category))];
  const el = document.getElementById('filterBar');
  el.innerHTML = categories.map(cat => `
    <button class="filter-btn ${cat === activeFilter ? 'active' : ''}" data-cat="${cat}">${cat}</button>
  `).join('');
  el.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.cat;
      el.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === activeFilter));
      renderActivities(activeFilter);
    });
  });
}

function openArticle(slug) {
  window.location.href = `article.html?slug=${slug}`;
}

/* ===================== AWARDS ===================== */
function renderAwards() {
  const el = document.getElementById('awardsList');
  el.innerHTML = PORTFOLIO_DATA.awards.map(a => `
    <div class="award-item">
      <div class="award-year">${a.year}</div>
      <div class="award-content">
        <div class="award-title">${a.title}</div>
        <div class="award-issuer">${a.issuer}</div>
      </div>
    </div>
  `).join('');
}

/* ===================== PUBLICATIONS ===================== */
function renderPublications() {
  const el = document.getElementById('pubList');
  el.innerHTML = PORTFOLIO_DATA.publications.map((pub, i) => `
    <div class="pub-item">
      <div class="pub-index">${String(i + 1).padStart(2, '0')}</div>
      <div class="pub-content">
        <div class="pub-title">${pub.title}</div>
        <div class="pub-venue">${pub.venue} · ${pub.year}</div>
        ${pub.url ? `<a href="${pub.url}" target="_blank" rel="noopener" class="pub-link">Read paper ↗</a>` : ''}
      </div>
    </div>
  `).join('');
}

/* ===================== SKILLS ===================== */
function renderSkills() {
  const el = document.getElementById('skillsGrid');
  el.innerHTML = Object.entries(PORTFOLIO_DATA.skills).map(([group, tags]) => `
    <div class="skill-group">
      <div class="skill-group-name">${group}</div>
      <div class="skill-tags">
        ${tags.map(t => `<span class="skill-tag">${t}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

/* ===================== CONTACT ===================== */
function renderContact() {
  const { email, whatsapp, linkedin } = PORTFOLIO_DATA.personal.contact;
  const el = document.getElementById('contactLinks');
  el.innerHTML = `
    <a href="mailto:${email}" class="contact-link">
      <span class="contact-icon">✉</span> Email
    </a>
    <a href="https://wa.me/${whatsapp}" target="_blank" rel="noopener" class="contact-link">
      <span class="contact-icon">💬</span> WhatsApp
    </a>
    <a href="https://linkedin.com/in/${linkedin}" target="_blank" rel="noopener" class="contact-link">
      <span class="contact-icon">in</span> LinkedIn
    </a>
  `;
}

/* ===================== INTERSECTION OBSERVER ===================== */
function initFadeUp() {
  const els = document.querySelectorAll('.fade-up');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  els.forEach(el => observer.observe(el));
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
