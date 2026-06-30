# CLAUDE.md — Chemical Enlightenment (hybrid)

Guidance for AI coding agents working in this repo.

## What this is
A **hybrid (prerendered + hydrated) static site** for chem-enlightenment.com.
`build.py` prerenders a real `dist/<slug>.html` per route (SEO / no-JS) **and**
emits `dist/js/content.js`, which `static/js/app.js` uses to hydrate navigation
into instant, reload-free client-side swaps on http(s). On `file://` it degrades
to a plain multi-page site.

## Build & preview
```
pip install -r requirements.txt
python build.py        # writes dist/ (prerendered HTML + js/content.js)
```
Open `dist/index.html`. (Instant client-side nav only shows over http(s).)

## Source of truth — do NOT edit generated output
- Edit page content in `content/*.md` (Markdown + `--- title / description / slug ---` front matter).
- Edit layout/shell in `templates/base.html`.
- Edit theme in `static/css/style.css`; hydration router in `static/js/app.js`.
- **Never hand-edit `dist/`** (incl. `dist/js/content.js`) — it is git-ignored and
  regenerated on every build. The prerendered HTML and `content.js` come from the
  same content, so edit the source and re-run `python build.py`.

## Conventions / gotchas
- Internal links must stay **real `.html` paths** (e.g. `ap-chemistry.html`) — the
  hydration router only intercepts `.html` links; hashes, `mailto:`, external, and
  `_blank`/`download` links are left to the browser.
- Page order is controlled by the `ORDER` list in `build.py`.
- Nav highlight is controlled by `active_for(slug)` in `build.py`.
- Adding a top-level nav item means editing **both** the `nav` list in `build.py`
  and the `<nav>` in `templates/base.html`.

## Add a page
1. Create `content/<slug>.md` with front matter (`title`, `description`, `slug`).
2. Add `<slug>` to `ORDER` in `build.py`.
3. `python build.py` → produces `dist/<slug>.html`.

## Deploy
Pushing to `main` triggers `.github/workflows/deploy.yml`, which runs
`python build.py` and publishes `dist/` to GitHub Pages (Pages source must be
**GitHub Actions**). Every route is a real file, so deep links resolve directly —
no 404 fallback needed. Do not commit `dist/`.
