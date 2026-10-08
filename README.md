# Furaihan Kamyl Arnazaye — Portfolio

Personal portfolio website. Built with plain HTML, CSS, and JavaScript. No framework dependencies.

---

## Structure

```
portfolio/
├── index.html          → Main portfolio page
├── article.html        → Article reader for Writing posts (renders Markdown in the browser)
├── article.css         → Styles shared by article.html and research/ pages
├── article-widgets.js  → Charts, tabs, tooltips, and photo captions shared by both
├── research/<slug>/    → Static explainer pages, generated (do not edit by hand)
├── cite/               → BibTeX and RIS citation files, generated
├── sitemap.xml         → Generated
├── tools/build.mjs     → Generator for the three items above
├── 404.html            → Custom 404 page
├── data.js             → All portfolio content (edit this to update content)
├── main.js             → Rendering logic (do not edit unless structural change)
├── images/
│   ├── profile.jpg     → Hero photo
│   ├── logos/          → Organization logos
│   └── *.png           → Activity thumbnails and article images
└── content/
    └── *.md            → Article content in Markdown format
```

---

## How to Update Content

### 1. Add a new Activity post

**Step 1 — Add entry to `data.js`**

Open `data.js`, find the `activities` array, and add a new object:

```js
{
  id: "unique-id",
  title: "Your Activity Title",
  date: "2025",
  category: "Collaboration",         // Options: Collaboration, Speaking and Presentation, Research and Analysis
  thumbnail: "images/your-thumb.png",
  description: "Short description shown on the card (1-2 sentences).",
  slug: "your-activity-slug"         // Must match the .md filename
}
```

**Step 2 — Upload thumbnail image**

Upload your image to the `images/` folder. Name it to match what you put in `thumbnail`.

**Step 3 — Create the article file**

Create a new file in `content/` named `your-activity-slug.md`.

Write the article content in Markdown:

```markdown
# Article Title

Introduction paragraph here.

## Section Heading

Content here. You can use **bold**, *italic*, and lists.

- Item one
- Item two

![Caption](images/your-image.png)
```

That's it. The website automatically renders the card and article.

---

### 2. Add an explainer article to a publication

Each publication card can carry a plain-language article explaining the study, next to the paper itself.

**Step 1 — Add `slug` (and optionally `summary`) to the publication in `data.js`:**

```js
{
  title: "Comparing the Effectiveness of Network Governance of LPKA Kelas II Jakarta",
  venue: "Thesis, Universitas Indonesia",
  author: "Furaihan Kamyl Arnazaye",
  year: 2025,
  driveId: "...",
  slug: "thesis-lpka-network-governance",           // Must match the .md filename, unique across activities too
  summary: "One-sentence takeaway shown on the card.", // Optional
  explainerTitle: "Headline for the article page"    // Optional, defaults to the paper title
}
```

**Step 2 — Create `content/thesis-lpka-network-governance.md`** and write the explainer in Markdown (same format as activity articles).

**Step 3 — Build the static page.** Explainers are published as plain HTML at `research/<slug>/` so search engines can read them without running JavaScript. After any change to a publication in `data.js` or to its explainer in `content/`, run:

```
npm install      # once
npm run build
```

Commit the regenerated `research/`, `cite/`, and `sitemap.xml` together with your edit. Old `article.html?slug=<slug>` links forward to the new page. Link to an explainer from other Markdown as `research/<slug>/`.

Optional publication fields:

- `translation`: English translation shown under an Indonesian title
- `doi`: adds a DOI button on the card and in the article
- `pdf`: path to a PDF hosted in this repo (for example `papers/x.pdf`), used instead of `driveId`
- `role`: your role on the paper, shown at the end of the explainer
- `citation`: structured metadata for the paper. The build turns it into the APA 7 reference, BibTeX, RIS, the citation meta tags read by Zotero and Google Scholar, and schema.org data. Fields: `type` (`article`, `thesis`, `conference`, or `manuscript`), `key` (BibTeX key), `title` (as published), `sentence` (sentence case, for APA), `translated` (English title in sentence case, for non-English papers), `protect` (phrases BibTeX must keep capitalized), `language` (`id` or `en`), `date` (`YYYY` or `YYYY-MM-DD`), then `journal`, `volume`, `issue`, `pages`, `issn` for articles, `thesisType`, `institution`, `place` for theses, `event` for conference papers, and `institution`, `url`, `note` for manuscripts. Authors come from `author`, and the last word of each name is read as the family name.

Experience and organization entries take a `highlights` array, rendered as bullet points.

After editing `data.js`, bump the `?v=` number on the `data.js` and `main.js` script tags in `index.html` (and on `data.js` in `article.html`, and on `article.css` and `article-widgets.js` when those change, including in `tools/build.mjs`) so returning visitors get the new version.

The card then shows an **Explainer** badge, opens the article on click, and keeps a "Read paper ↗" button for the PDF. The article page links back to Publications and ends with a link to the full paper. Publications without `slug` behave as before (open the PDF).

---

### 3. Update existing sections

All content is in `data.js`. Find the relevant array and edit directly:

- `experience` → Work history
- `organizations` → Leadership and org experience
- `education` → Education entries
- `awards` → Awards and honors (add to top for newest first)
- `publications` → Research publications with links
- `skills` → Grouped skill tags
- `personal.about` → About Me text (use `\n\n` for paragraph breaks)

---

### 4. Add a new logo

Upload the logo PNG (preferably with transparent or dark background) to `images/logos/`. Then reference it in `data.js` as `"images/logos/your-logo.png"`.

---

## Deployment (GitHub Pages)

1. Create a GitHub repository named `username.github.io` (replace with your GitHub username)
2. Upload all files from this folder to the repository root
3. Go to repository Settings → Pages → Source: Deploy from branch → Branch: `main` → Folder: `/ (root)`
4. Your site will be live at `https://username.github.io`

For subsequent updates: edit files directly on GitHub (click pencil icon) or use GitHub Desktop.

---

## Adding Analytics

Google Analytics is ready to be added. Once you have a Measurement ID (format: G-XXXXXXXXXX):

1. Open `index.html`
2. Paste the following just before `</head>`:

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

Replace `G-XXXXXXXXXX` with your actual Measurement ID.

---

## Notes

- Dark/light mode preference is saved automatically per browser
- All publication links open in a new tab
- Activity filter remembers across page navigation via URL hash
- Article reading time is calculated automatically from word count
- Images that fail to load are hidden gracefully (no broken image icons)
