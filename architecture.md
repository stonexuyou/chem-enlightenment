# Architecture

## Current stack
A **hybrid prerendered + hydrated static site** — no framework, no backend
(yet). See `CLAUDE.md` for full agent-facing conventions; this doc is the
higher-level "why it's shaped this way."

```
content/       Page Markdown (+ front matter) — source of truth
templates/     base.html (shell; bakes content into #app)
static/        css/ img/ js/app.js (hydration router)
build.py       Prerenders dist/<slug>.html + emits dist/js/content.js
dist/          Generated site (git-ignored, not committed)
```

- **Prerender (build time):** `build.py` writes a complete `dist/<slug>.html`
  per route — full content baked into the markup for SEO / no-JS.
- **Real URLs:** every route is a standalone file (`ap-chemistry.html`), so
  deep links resolve directly with no 404 fallback needed.
- **Hydration (runtime):** `static/js/app.js` intercepts internal `.html`
  link clicks over http(s), swaps `#app` from `dist/js/content.js`, and uses
  `history.pushState`/`popstate` for instant, reload-free nav. On `file://`
  or with JS off, it degrades to a plain multi-page site.
- **Deploy:** push to `main` → `.github/workflows/deploy.yml` runs
  `python build.py` and publishes `dist/` to GitHub Pages (Pages source =
  GitHub Actions). `SITE_URL` env var controls the canonical domain baked
  into SEO tags/sitemap.

Why this over Next.js/a plain SPA: ships real content in the HTML (crawlers
and no-JS users see everything) while still getting SPA-style instant nav,
in a few hundred lines of vanilla Python/JS with no build toolchain.

## Planned additions and their architectural impact

### Interactive demonstration widgets (Phase 2 of roadmap)
- Content is currently plain Markdown → HTML via `build.py`. Embedding
  interactive widgets requires extending the markdown pipeline to allow
  raw HTML/JS blocks (or a shortcode syntax) per page.
- Widgets should be self-contained vanilla JS/canvas, loaded from
  `static/js/`, styled via `static/css/style.css` to match the existing
  theme — no new framework dependency.

### Self-recorded videos (Phase 3)
- No architecture change if using YouTube embeds (just an `<iframe>` pattern
  in `templates/base.html` or a content shortcode).
- Self-hosting video files under `static/` would add repo size/bandwidth
  concerns — prefer YouTube unless there's a reason not to.

### Built-in AI for conceptual questions (Phase 5) — biggest change
This is the one piece that doesn't fit the current "static site, no backend"
model:
- GitHub Pages serves static files only — it cannot hold API keys or run
  server code. Needs an external compute layer (e.g. a Cloudflare Worker or
  Vercel serverless function) that proxies chat requests to an LLM API.
- That backend is a **separate deployable** from the GitHub Pages site —
  own repo/dir, own secrets, own CI step. `.github/workflows/deploy.yml`
  stays scoped to the static site; the AI backend gets its own workflow.
- Frontend: a minimal chat widget added to `static/js/`, wired into
  `templates/base.html`, calling the external backend over fetch/CORS.
- Needs rate limiting / abuse protection at the backend before going live
  (no auth layer exists anywhere in the current site).

## Open architectural questions
- Which LLM/provider for the built-in AI backend, and expected traffic/cost?
- Should AI answers be scoped to current-page content only, or general
  tutoring? (Affects whether the backend needs access to `content/*.md` at
  request time.)
- Serverless provider choice (Cloudflare Workers vs. Vercel vs. other) — pick
  based on whichever pairs most simply with GitHub Pages hosting.
