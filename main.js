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

/* ===================== NETWORK ANIMATION ===================== */
let networkAnim = null;

function initNetwork() {
  const canvas = document.getElementById('networkCanvas');
  if (!canvas) return;
  const section = document.getElementById('hero');
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = section.offsetWidth;
    canvas.height = section.offsetHeight;
  }
  resize();
  window.addEventListener('resize', () => { resize(); });

  function getColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      node: isDark ? 'rgba(160,155,148,0.7)' : 'rgba(90,87,80,0.5)',
      edge: isDark ? 'rgba(160,155,148,0.15)' : 'rgba(90,87,80,0.12)',
      hub: isDark ? 'rgba(240,237,232,0.8)' : 'rgba(26,26,24,0.6)',
      label: isDark ? 'rgba(160,155,148,0.7)' : 'rgba(90,87,80,0.55)'
    };
  }

  // Nodes: hub + satellites
  const labels = ['Policy', 'Research', 'Governance', 'Networks', 'AI', 'Advocacy', 'Data', 'Communication'];
  const nodes = [];

  // Central hub
  nodes.push({ x: 0.5, y: 0.5, r: 6, isHub: true, label: 'Kamyl', vx: 0, vy: 0 });

  // Satellite nodes with initial positions
  const angles = labels.map((_, i) => (i / labels.length) * Math.PI * 2);
  labels.forEach((label, i) => {
    const spread = 0.28 + Math.random() * 0.12;
    nodes.push({
      x: 0.5 + Math.cos(angles[i]) * spread,
      y: 0.5 + Math.sin(angles[i]) * spread * 0.65,
      r: 3.5,
      isHub: false,
      label,
      vx: (Math.random() - 0.5) * 0.0003,
      vy: (Math.random() - 0.5) * 0.0003,
      baseX: 0.5 + Math.cos(angles[i]) * spread,
      baseY: 0.5 + Math.sin(angles[i]) * spread * 0.65,
      phase: Math.random() * Math.PI * 2
    });
  });

  // Edges: hub to all, and a few cross-connections
  const edges = [];
  nodes.slice(1).forEach((_, i) => edges.push([0, i + 1]));
  // Some lateral connections
  [[1,3],[2,5],[4,7],[6,2],[1,8],[5,7]].forEach(([a,b]) => {
    if (nodes[a] && nodes[b]) edges.push([a, b]);
  });

  let mouse = { x: -999, y: -999 };
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / canvas.width;
    mouse.y = (e.clientY - rect.top) / canvas.height;
  });
  canvas.addEventListener('mouseleave', () => { mouse.x = -999; mouse.y = -999; });

  let t = 0;
  let colors = getColors();

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    t += 0.008;

    const W = canvas.width, H = canvas.height;

    // Update satellite positions with gentle drift
    nodes.slice(1).forEach((n, i) => {
      n.x = n.baseX + Math.cos(t + n.phase) * 0.018;
      n.y = n.baseY + Math.sin(t * 0.7 + n.phase) * 0.012;

      // Mouse repulsion
      const dx = n.x - mouse.x, dy = n.y - mouse.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 0.15) {
        const force = (0.15 - dist) / 0.15 * 0.04;
        n.x += (dx / dist) * force;
        n.y += (dy / dist) * force;
      }
    });

    // Draw edges
    edges.forEach(([a, b]) => {
      const na = nodes[a], nb = nodes[b];
      const ax = na.x * W, ay = na.y * H;
      const bx = nb.x * W, by = nb.y * H;
      const dist = Math.sqrt((ax-bx)**2 + (ay-by)**2);
      const alpha = Math.max(0, 1 - dist / (W * 0.5));
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = colors.edge;
      ctx.globalAlpha = alpha * 0.8;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // Draw nodes
    nodes.forEach(n => {
      const nx = n.x * W, ny = n.y * H;
      const pulse = n.isHub ? 1 + Math.sin(t * 1.5) * 0.12 : 1;

      ctx.beginPath();
      ctx.arc(nx, ny, n.r * pulse, 0, Math.PI * 2);
      ctx.fillStyle = n.isHub ? colors.hub : colors.node;
      ctx.fill();

      // Label
      ctx.font = `${n.isHub ? '500' : '300'} ${n.isHub ? 11 : 10}px 'DM Sans', sans-serif`;
      ctx.fillStyle = colors.label;
      ctx.textAlign = 'center';
      const labelY = ny + n.r * pulse + 14;
      ctx.fillText(n.label, nx, labelY);
    });

    requestAnimationFrame(draw);
  }

  draw();

  networkAnim = {
    updateColors: () => { colors = getColors(); }
  };
}

/* ===================== TIMELINE ===================== */
function renderTimeline(id, items, isOrg = false) {
  document.getElementById(id).innerHTML = items.map(item => {
    const isDarkLogo = item.logo && item.logo.includes('goto');
    const company = isOrg ? item.org : item.company;
    const initials = company.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `
    <div class="timeline-item">
      <div class="timeline-left"><div class="timeline-period">${item.period}</div></div>
      <div class="timeline-right">
        <div class="timeline-logo-wrap${isDarkLogo ? ' logo-dark' : ''}" id="wrap-${item.id}">
          <img src="${item.logo}" alt="${company}" class="timeline-logo"
            onerror="this.style.display='none';this.parentElement.querySelector('.logo-fallback').style.display='flex'" />
          <span class="logo-fallback" style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:10px;font-weight:500;color:var(--text-3);">${initials}</span>
        </div>
        <div class="timeline-role">${item.role}</div>
        <div class="timeline-company">${company}</div>
        ${item.type ? `<div class="timeline-type">${item.type}</div>` : ''}
        <ul class="timeline-bullets">${(item.bullets||[]).map(b => `<li>${b}</li>`).join('')}</ul>
      </div>
    </div>
  `}).join('');
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
  el.innerHTML = PORTFOLIO_DATA.publications.map(pub => {
    const safeTitle = pub.title.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    return `
      <div class="pub-card" role="button" tabindex="0"
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

/* ===================== SCROLL ANIMATIONS ===================== */
function initFadeUp() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.06 });
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
  initNetwork();
});
