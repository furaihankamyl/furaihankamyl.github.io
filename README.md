# Furaihan Kamyl Arnazaye — Portfolio

Personal portfolio website. Built with plain HTML, CSS, and JavaScript. No framework dependencies.

---

## Structure

```
portfolio/
├── index.html          → Main portfolio page
├── article.html        → Article reader (renders Markdown)
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

### 2. Update existing sections

All content is in `data.js`. Find the relevant array and edit directly:

- `experience` → Work history
- `organizations` → Leadership and org experience
- `education` → Education entries
- `awards` → Awards and honors (add to top for newest first)
- `publications` → Research publications with links
- `skills` → Grouped skill tags
- `personal.about` → About Me text (use `\n\n` for paragraph breaks)

---

### 3. Add a new logo

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
