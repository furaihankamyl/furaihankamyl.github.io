// Shared by article.html and the static explainer pages in research/.
// Theme
const saved = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', saved);
const toggle = document.getElementById('themeToggle');
toggle.textContent = saved === 'dark' ? '☀' : '☾';
toggle.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  toggle.textContent = next === 'dark' ? '☀' : '☾';
});

// Markdown images become figures with their alt text as a visible caption.
// Photos that follow each other directly are laid out side by side.
function captionPhotos(root) {
  root.querySelectorAll('img').forEach(img => {
    if (img.closest('figure, .chart, .schematic')) return;
    const p = img.parentElement;
    const alone = p.tagName === 'P' && p.textContent.trim() === '' && p.querySelectorAll('img').length === 1;
    const fig = document.createElement('figure');
    fig.className = 'photo';
    const cap = img.getAttribute('alt');
    (alone ? p : img).replaceWith(fig);
    fig.appendChild(img);
    if (cap) {
      const fc = document.createElement('figcaption');
      fc.textContent = cap;
      fig.appendChild(fc);
    }
  });
  Array.from(root.querySelectorAll(':scope > figure.photo')).forEach(fig => {
    const next = fig.nextElementSibling;
    if (next && next.matches('figure.photo') && !fig.closest('.gallery')) {
      const g = document.createElement('div');
      g.className = 'gallery';
      fig.before(g);
      g.append(fig, next);
    }
  });
}

// Interactive pieces embedded in article Markdown (scripts inside
// Markdown do not run, so behavior is wired here by data attributes)
function initWidgets(root) {
  // Segmented toggle: sets data-view on the closest .chart
  root.querySelectorAll('.seg').forEach(seg => {
    const chart = seg.closest('.chart');
    seg.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
        chart.dataset.view = btn.dataset.view;
      });
    });
  });

  // Tabs
  root.querySelectorAll('[data-tabs]').forEach(box => {
    const btns = box.querySelectorAll('.tab-btns button');
    btns.forEach(btn => btn.addEventListener('click', () => {
      btns.forEach(b => b.setAttribute('aria-selected', String(b === btn)));
      box.querySelectorAll('.tab-panel').forEach(p => { p.hidden = p.dataset.panel !== btn.dataset.tab; });
    }));
  });

  // Tooltips: hover on desktop, tap on touch, focus for keyboard
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  let current = null;
  function show(el) {
    current = el;
    tip.textContent = el.dataset.tip;
    tip.classList.add('show');
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), window.innerWidth - t.width - 8);
    const top = r.top - t.height - 8 < 64 ? r.bottom + 8 : r.top - t.height - 8;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  function hide() { current = null; tip.classList.remove('show'); }
  root.querySelectorAll('[data-tip]').forEach(el => {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.addEventListener('mouseenter', () => show(el));
    el.addEventListener('mouseleave', hide);
    el.addEventListener('focus', () => show(el));
    el.addEventListener('blur', hide);
    el.addEventListener('click', e => {
      e.stopPropagation();
      if (e.pointerType === 'mouse') return; // hover already handles mouse
      current === el ? hide() : show(el);
    });
  });
  document.addEventListener('click', hide);
  window.addEventListener('scroll', hide, { passive: true });
}

// Reading progress hairline under the nav
(function initReadProgress() {
  const bar = document.getElementById('readProgress');
  let raf = null;
  function update() {
    raf = null;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    bar.style.transform = `scaleX(${p})`;
  }
  window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  window.addEventListener('resize', () => { if (!raf) raf = requestAnimationFrame(update); });
  update();
})();
