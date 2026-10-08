// Builds the static, indexable pages for research explainers.
//
//   npm install        (once, installs marked at the same version article.html uses)
//   npm run build
//
// Reads data.js and content/<slug>.md, then writes:
//   research/<slug>/index.html   one crawlable page per publication explainer
//   cite/<key>.bib, cite/<key>.ris, cite/all.bib, cite/all.ris
//   sitemap.xml
// Run it again after editing a publication in data.js or an explainer in content/.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://furaihankamyl.github.io';
const ME = {
  '@type': 'Person',
  name: 'Furaihan Kamyl Arnazaye',
  url: `${SITE}/`,
  sameAs: ['https://www.linkedin.com/in/furaihankamyl/']
};
const LANG_NAME = { id: 'Indonesian', en: 'English' };
const BIB_LANGID = { id: 'indonesian', en: 'english' };

const read = f => readFileSync(join(ROOT, f), 'utf8');
const write = (f, text) => {
  mkdirSync(dirname(join(ROOT, f)), { recursive: true });
  writeFileSync(join(ROOT, f), text);
};
const DATA = new Function(`${read('data.js')}; return PORTFOLIO_DATA;`)();

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Dates from git history, so pages carry real published and modified dates
function gitDates(file) {
  try {
    const out = execFileSync('git', ['log', '--follow', '--format=%cs', '--', file], { cwd: ROOT, encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);
    if (out.length) return { published: out[out.length - 1], modified: out[0] };
  } catch (e) { /* not a git checkout */ }
  const today = new Date().toISOString().slice(0, 10);
  return { published: today, modified: today };
}

// ---------- Authors ----------

// "Furaihan Kamyl Arnazaye" -> { family: "Arnazaye", given: "Furaihan Kamyl" }
const authorsOf = pub => pub.author.split(',').map(n => n.trim()).map(n => {
  const parts = n.split(/\s+/);
  return { full: n, family: parts.pop(), given: parts.join(' ') };
});
const initials = given => given.split(/\s+/).map(g => `${g[0]}.`).join(' ');

// ---------- APA 7 ----------

function apaAuthors(list) {
  const names = list.map(a => `${a.family}, ${initials(a.given)}`);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
}

// Returns { html, text }. Italics are kept in html for pasting into Word or Docs.
function apa(pub) {
  const c = pub.citation;
  const year = c.date.slice(0, 4);
  const tr = c.translated ? ` [${c.translated}]` : '';
  const pages = c.pages ? c.pages.replace('-', '–') : '';
  const head = `${apaAuthors(authorsOf(pub))} (${year}). `;
  let html;
  if (c.type === 'article') {
    html = `${esc(c.sentence)}${esc(tr)}. <i>${esc(c.journal)}, ${esc(c.volume)}</i>(${esc(c.issue)}), ${pages}.`
      + (pub.doi ? ` https://doi.org/${esc(pub.doi)}` : '');
  } else if (c.type === 'thesis') {
    html = `<i>${esc(c.sentence)}</i>${esc(tr)} [${esc(c.thesisType)}, ${esc(c.institution)}].`;
  } else if (c.type === 'conference') {
    html = `<i>${esc(c.sentence)}</i>${esc(tr)} [Paper presentation]. ${esc(c.event)}.`;
  } else {
    html = `<i>${esc(c.sentence)}</i>${esc(tr)} [Unpublished manuscript]. ${esc(c.institution)}.`
      + (c.url ? ` ${esc(c.url)}` : '');
  }
  html = esc(head) + html;
  const text = html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  return { html, text };
}

// ---------- BibTeX ----------

function bibTitle(c) {
  let t = c.title;
  for (const phrase of c.protect || []) t = t.replace(phrase, `{${phrase}}`);
  return t;
}

function bibtex(pub) {
  const c = pub.citation;
  const f = [
    ['author', authorsOf(pub).map(a => `${a.family}, ${a.given}`).join(' and ')],
    ['title', bibTitle(c)]
  ];
  if (c.translated) f.push(['titleaddon', `[${c.translated}]`]);
  let type;
  if (c.type === 'article') {
    type = 'article';
    f.push(['journal', c.journal], ['year', c.date.slice(0, 4)], ['volume', c.volume],
      ['number', c.issue], ['pages', c.pages.replace('-', '--')]);
    if (c.issn) f.push(['issn', c.issn]);
    if (pub.doi) f.push(['doi', pub.doi]);
  } else if (c.type === 'thesis') {
    type = 'mastersthesis'; // BibTeX has no bachelor's type. "type" sets the label.
    f.push(['type', c.thesisType], ['school', c.institution], ['address', c.place], ['year', c.date.slice(0, 4)]);
  } else if (c.type === 'conference') {
    type = 'unpublished';
    f.push(['note', `Paper presented at ${c.event}`], ['year', c.date.slice(0, 4)]);
  } else {
    type = 'unpublished';
    f.push(['note', `Unpublished manuscript, ${c.institution}`], ['year', c.date.slice(0, 4)]);
    if (c.url) f.push(['url', c.url]);
  }
  f.push(['langid', BIB_LANGID[c.language]]);
  const width = Math.max(...f.map(([k]) => k.length));
  return `@${type}{${c.key},\n${f.map(([k, v]) => `  ${k.padEnd(width)} = {${v}}`).join(',\n')}\n}\n`;
}

// ---------- RIS ----------

function ris(pub) {
  const c = pub.citation;
  const TY = { article: 'JOUR', thesis: 'THES', conference: 'CPAPER', manuscript: 'UNPB' }[c.type];
  const r = [['TY', TY]];
  authorsOf(pub).forEach(a => r.push(['AU', `${a.family}, ${a.given}`]));
  r.push(['TI', c.title]);
  if (c.translated) r.push(['TT', c.translated]);
  r.push(['PY', c.date.slice(0, 4)]);
  if (c.date.length === 10) r.push(['DA', c.date.replace(/-/g, '/')]);
  if (c.type === 'article') {
    const [sp, ep] = c.pages.split('-');
    r.push(['T2', c.journal], ['VL', c.volume], ['IS', c.issue], ['SP', sp], ['EP', ep]);
    if (c.issn) r.push(['SN', c.issn]);
    if (pub.doi) r.push(['DO', pub.doi], ['UR', `https://doi.org/${pub.doi}`]);
  } else if (c.type === 'thesis') {
    r.push(['PB', c.institution], ['CY', c.place], ['M3', c.thesisType]);
  } else if (c.type === 'conference') {
    r.push(['T2', c.event], ['M3', 'Paper presentation']);
  } else {
    r.push(['PB', c.institution], ['M3', 'Unpublished manuscript']);
    if (c.url) r.push(['UR', c.url]);
    if (c.note) r.push(['N1', c.note]);
  }
  r.push(['LA', LANG_NAME[c.language]], ['ER', '']);
  return r.map(([k, v]) => `${k}  - ${v}`).join('\r\n') + '\r\n';
}

// ---------- Page metadata ----------

// Highwire Press tags. Zotero, Mendeley, and Google Scholar read these.
function highwire(pub) {
  const c = pub.citation;
  const t = [['citation_title', c.title]];
  authorsOf(pub).forEach(a => t.push(['citation_author', `${a.family}, ${a.given}`]));
  t.push(['citation_publication_date', c.date.replace(/-/g, '/')], ['citation_language', c.language]);
  if (c.type === 'article') {
    const [sp, ep] = c.pages.split('-');
    t.push(['citation_journal_title', c.journal], ['citation_volume', c.volume], ['citation_issue', c.issue],
      ['citation_firstpage', sp], ['citation_lastpage', ep]);
    if (c.issn) t.push(['citation_issn', c.issn]);
  } else if (c.type === 'thesis') {
    t.push(['citation_dissertation_institution', c.institution]);
  } else if (c.type === 'conference') {
    t.push(['citation_conference_title', c.event]);
  } else {
    t.push(['citation_technical_report_institution', c.institution]);
  }
  if (pub.doi) t.push(['citation_doi', pub.doi]);
  if (pub.pdf) t.push(['citation_pdf_url', `${SITE}/${pub.pdf}`]);
  return t.map(([k, v]) => `  <meta name="${k}" content="${esc(v)}" />`).join('\n');
}

function jsonLd(pub, url, dates) {
  const c = pub.citation;
  const work = {
    '@type': c.type === 'thesis' ? 'Thesis' : 'ScholarlyArticle',
    name: c.title,
    ...(c.translated && { alternateName: c.translated }),
    author: authorsOf(pub).map(a => a.full === ME.name ? ME : { '@type': 'Person', name: a.full }),
    datePublished: c.date,
    inLanguage: c.language
  };
  if (pub.doi) work.sameAs = `https://doi.org/${pub.doi}`;
  if (c.type === 'article') {
    work.pagination = c.pages;
    work.isPartOf = {
      '@type': 'PublicationIssue', issueNumber: c.issue,
      isPartOf: {
        '@type': 'PublicationVolume', volumeNumber: c.volume,
        isPartOf: { '@type': 'Periodical', name: c.journal, ...(c.issn && { issn: c.issn }) }
      }
    };
  }
  if (c.type === 'thesis') work.sourceOrganization = { '@type': 'CollegeOrUniversity', name: c.institution };
  const doc = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: pub.explainerTitle,
    description: pub.summary,
    url,
    mainEntityOfPage: url,
    image: `${SITE}/images/og-cover.jpg`,
    inLanguage: 'en',
    datePublished: dates.published,
    dateModified: dates.modified,
    author: ME,
    isBasedOn: work
  };
  return JSON.stringify(doc, null, 2).replace(/</g, '\\u003c');
}

// ---------- Explainer body ----------

marked.setOptions({ breaks: true, gfm: true }); // same options as article.html

// Pages live two folders down, so relative links in the Markdown become root-relative
const rootRelative = html => html.replace(/(\s(?:href|src))="(?!https?:|\/|#|mailto:|data:)([^"]*)"/g, '$1="/$2"');

function readingTime(md) {
  const prose = md.split('\n').filter(l => !l.trim().startsWith('<')).join(' ');
  return `${Math.ceil(prose.trim().split(/\s+/).length / 200)} min read`;
}

const paperUrl = pub => pub.pdf ? `/${pub.pdf}` : `https://drive.google.com/file/d/${pub.driveId}/view`;
const pageUrl = slug => `${SITE}/research/${slug}/`;

function page(pub, next) {
  const md = read(`content/${pub.slug}.md`);
  const url = pageUrl(pub.slug);
  const dates = gitDates(`content/${pub.slug}.md`);
  const c = pub.citation;
  const title = `${pub.explainerTitle} | Furaihan Kamyl Arnazaye`;
  const cite = apa(pub);
  const paperTitle = pub.translation ? `${pub.title} (${pub.translation})` : pub.title;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!-- Generated by tools/build.mjs from data.js and content/${pub.slug}.md. Edit those, then run npm run build. -->
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(pub.summary)}" />
  <meta name="author" content="Furaihan Kamyl Arnazaye" />
  <link rel="canonical" href="${url}" />

  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Furaihan Kamyl Arnazaye" />
  <meta property="og:title" content="${esc(pub.explainerTitle)}" />
  <meta property="og:description" content="${esc(pub.summary)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${SITE}/images/og-cover.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="article:author" content="Furaihan Kamyl Arnazaye" />
  <meta property="article:published_time" content="${dates.published}" />
  <meta property="article:modified_time" content="${dates.modified}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(pub.explainerTitle)}" />
  <meta name="twitter:description" content="${esc(pub.summary)}" />
  <meta name="twitter:image" content="${SITE}/images/og-cover.jpg" />

  <!-- Citation data for the paper this explainer is based on -->
${highwire(pub)}

  <script type="application/ld+json">
${jsonLd(pub, url, dates)}
  </script>

  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
  <script>document.documentElement.setAttribute("data-theme", localStorage.getItem("theme") || "dark");</script>
  <link rel="stylesheet" href="/article.css?v=1" />
</head>
<body>

<nav>
  <a href="/#publications" class="nav-back">← Publications</a>
  <a href="/" class="nav-name">Kamyl</a>
  <button class="theme-toggle" id="themeToggle" aria-label="Toggle theme">☀</button>
</nav>
<div class="read-progress" id="readProgress"></div>

<main class="article-wrap">
  <article>
    <header class="article-meta">
      <div class="article-category">Research Explainer</div>
      <h1 class="article-headline">${esc(pub.explainerTitle)}</h1>
      <div class="article-info">
        <span>By Furaihan Kamyl Arnazaye</span>
        <span>·</span>
        <span>${pub.year}</span>
        <span>·</span>
        <span class="reading-time">${readingTime(md)}</span>
      </div>
    </header>

    <div id="articleContent" class="article-content">
${rootRelative(marked.parse(md)).trim()}
    </div>
  </article>

  <section class="paper-cta" aria-labelledby="paperTitle">
    <div class="paper-cta-label">The full paper</div>
    <h2 class="paper-cta-title" id="paperTitle">${esc(paperTitle)}</h2>
    <div class="paper-cta-venue">${esc(pub.venue)}, ${pub.year}</div>
    <dl class="paper-cta-meta">
      <dt>Authors</dt><dd>${esc(pub.author)}</dd>
      ${pub.role ? `<dt>My role</dt><dd>${esc(pub.role)}</dd>` : ''}
    </dl>
    <div class="paper-cta-actions">
      <a class="back-link" href="${esc(paperUrl(pub))}" target="_blank" rel="noopener">Read the paper ↗</a>
      ${pub.doi ? `<a class="back-link" href="https://doi.org/${esc(pub.doi)}" target="_blank" rel="noopener">DOI ↗</a>` : ''}
    </div>

    <div class="cite-box" id="cite" data-tabs>
      <div class="cite-head">
        <div class="paper-cta-label">Cite this paper</div>
        <div class="tab-btns" role="tablist">
          <button type="button" role="tab" data-tab="apa" aria-selected="true">APA 7</button>
          <button type="button" role="tab" data-tab="bibtex" aria-selected="false">BibTeX</button>
          <button type="button" role="tab" data-tab="ris" aria-selected="false">RIS</button>
        </div>
      </div>
      <div class="tab-panel" data-panel="apa"><p class="cite-apa">${cite.html}</p></div>
      <div class="tab-panel" data-panel="bibtex" hidden><pre class="cite-code">${esc(bibtex(pub))}</pre></div>
      <div class="tab-panel" data-panel="ris" hidden><pre class="cite-code">${esc(ris(pub).replace(/\r/g, ''))}</pre></div>
      <div class="paper-cta-actions">
        <button type="button" class="back-link" id="citeCopy">Copy citation</button>
        <a class="back-link" href="/cite/${c.key}.bib" download>Download .bib</a>
        <a class="back-link" href="/cite/${c.key}.ris" download>Download .ris</a>
      </div>
      <p class="cite-note">Use .ris for Mendeley and EndNote, and .bib for LaTeX. Zotero's browser extension can also save this page with the paper's citation data.</p>
    </div>
  </section>

  <a class="article-next" href="/research/${next.slug}/">
    <div class="article-next-label"><span>Next explainer</span><span>↗</span></div>
    <div class="article-next-title">${esc(next.explainerTitle)}</div>
    <div class="article-next-cat">Research Explainer · ${next.year}</div>
  </a>

  <div class="article-back-bottom">
    <a href="/#publications" class="back-link">← Back to Publications</a>
  </div>
</main>

<script src="/article-widgets.js?v=1"></script>
<script>
  const content = document.getElementById('articleContent');
  initWidgets(document.querySelector('.article-wrap'));
  captionPhotos(content);

  // Copy the citation in the open tab. APA keeps its italics when pasted into Word or Docs.
  const copyBtn = document.getElementById('citeCopy');
  copyBtn.addEventListener('click', async () => {
    const panel = document.querySelector('#cite .tab-panel:not([hidden])');
    const el = panel.querySelector('.cite-apa, .cite-code');
    const text = el.textContent;
    try {
      if (el.classList.contains('cite-apa') && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([el.innerHTML], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      copyBtn.textContent = 'Copied';
    } catch (e) {
      copyBtn.textContent = 'Select the text to copy';
    }
    setTimeout(() => { copyBtn.textContent = 'Copy citation'; }, 2000);
  });
</script>
</body>
</html>
`;
}

// ---------- Build ----------

const pubs = DATA.publications.filter(p => p.slug && p.citation);
pubs.forEach((pub, i) => write(`research/${pub.slug}/index.html`, page(pub, pubs[(i + 1) % pubs.length])));

const header = '% Furaihan Kamyl Arnazaye, publications. Generated from https://furaihankamyl.github.io\n\n';
pubs.forEach(pub => {
  write(`cite/${pub.citation.key}.bib`, bibtex(pub));
  write(`cite/${pub.citation.key}.ris`, ris(pub));
});
write('cite/all.bib', header + pubs.map(bibtex).join('\n'));
write('cite/all.ris', pubs.map(ris).join('\r\n'));

const urls = [
  { loc: `${SITE}/`, lastmod: gitDates('index.html').modified, priority: '1.0' },
  ...pubs.map(p => ({ loc: pageUrl(p.slug), lastmod: gitDates(`content/${p.slug}.md`).modified, priority: '0.8' })),
  ...DATA.activities.map(a => ({ loc: `${SITE}/article.html?slug=${a.slug}`, lastmod: gitDates(`content/${a.slug}.md`).modified, priority: '0.6' }))
];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${esc(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`);

console.log(`Built ${pubs.length} explainer pages, ${pubs.length * 2 + 2} citation files, and sitemap.xml (${urls.length} URLs).`);
