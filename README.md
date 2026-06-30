# Chemical Enlightenment — hybrid (prerendered SPA)

The best of both worlds: every route is **prerendered** to a real HTML file with
full content baked in (great for SEO and no-JS users), and a tiny **hydration**
script upgrades navigation to **instant, reload-free** client-side swaps for
visitors with JavaScript.

This is the hydrated (prerendered SPA) version of the project — a self-contained
static site with no build-time dependencies on any sibling project.

## How it works

1. **Prerender (build time):** `build.py` writes a complete `dist/<slug>.html`
   for every route — header, nav, footer, and the page content already in the
   markup. A crawler or a no-JS browser sees the full page immediately.
2. **Real URLs:** links use real paths (`ap-chemistry.html`), so each route is a
   standalone, indexable, deep-linkable page.
3. **Hydration (runtime):** `js/app.js` runs on top of the prerendered HTML. On
   http(s) it intercepts internal link clicks, swaps `#app` from the embedded
   `js/content.js`, and `history.pushState()`s the real URL — **no reload**.
   Back/forward work via `popstate`.
4. **Fallbacks:** with JS off (or opened from `file://`), the real prerendered
   pages just work as a normal multi-page site. Nothing breaks.

```
content/       Page Markdown (+ front matter) — source of truth
templates/     base.html (shell; bakes content into #app)
static/        css/ img/ js/app.js (hydration router)
build.py       Prerenders dist/<slug>.html + emits dist/js/content.js
dist/          Generated site (git-ignored)
```

## Build & preview

```powershell
pip install -r requirements.txt
python build.py
```

Open `dist/index.html`. (From `file://` it behaves as a plain multi-page site;
deploy to a web server / Pages to see the instant client-side navigation.)

## Edit content
Edit `content/*.md`, then re-run `python build.py`. Content stays the single
source for both the prerendered HTML and `content.js`.

## Deploy to GitHub Pages
The included `.github/workflows/deploy.yml` builds with Python and publishes
`dist/`. Enable **Settings → Pages → Source: GitHub Actions**. Because every
route is a real file, deep links resolve directly — no 404 fallback needed.

## Why this over a plain SPA?
A hash-routed SPA renders everything client-side, so crawlers/no-JS users
see an empty shell. This hybrid ships real content in the HTML **and** keeps the
SPA feel — the pattern frameworks like Next.js / Astro automate, here in a few
lines of vanilla JS.
