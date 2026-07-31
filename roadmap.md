# Roadmap

Long-term phased feature plan, derived from the original whiteboard layout
ideas. For the technical shape of each phase, see `architecture.md`. For the
actively-worked task list, see `tasks.md`.

## Guiding notes
- Possible rename of site/domain if scope expands beyond chemistry — not
  blocking any phase below, but avoid hardcoding "chemistry-only" assumptions
  in new code/copy where easy to avoid.
- Keep every new route as a real prerendered `.html` file per existing
  convention (SEO, no-JS fallback, hydration router).

## Phase 1 — Content buildout
Existing pages already cover AP Chemistry, Science Olympiad, General
Chemistry. Still needed:
- AP Biology top-level page + sub-pages (mirror the AP Chemistry sub-page
  pattern: lab techniques / unit topics / practice exams, or a
  Biology-appropriate equivalent)
- Fill out AP Chemistry big-ideas content (unit topics page)
- Fill out AP Biology big-ideas content
- Science Olympiad: confirm/expand event list (chem lab, designer genes,
  forensics) across `science-olympiad.md` and its sub-pages

## Phase 2 — Interactive demonstrations
- Identify 3–5 hard-to-understand concepts per subject to prototype first
  (e.g. AP Chem: equilibrium, titration curves; AP Bio: photosynthesis,
  genetics crosses)
- Decide implementation approach: inline vanilla JS/canvas widgets vs. a
  small shared "interactive" component pattern loaded per-page
- Extend `build.py`'s markdown handling to allow embedding raw HTML/JS
  blocks
- Style in `static/css/style.css` to match existing theme

## Phase 3 — Self-recorded example-problem videos
- Decide hosting (YouTube unlisted embeds vs. self-hosted video files)
- Add a reusable video-embed pattern to `templates/base.html` or as a
  content shortcode
- Record and embed first batch: 1–2 example problems per AP Chem/Bio big
  idea

## Phase 4 — Cross-linking
- Audit all pages for opportunities to hyperlink related topics (e.g. AP
  Chem unit topics ↔ relevant Science Olympiad events)
- Confirm internal links use real `.html` paths per the hydration-router
  requirement in `CLAUDE.md`

## Phase 5 — Built-in AI for conceptual questions
Biggest architectural addition — see `architecture.md` for details.
- Decide backend approach (serverless function proxying to an LLM API)
- Define scope: general Q&A vs. scoped to current page's content
- Design a minimal chat UI component
- Handle rate limiting / abuse protection before going live
- Add separate deploy workflow/secrets for the AI backend

## Reference resources (for content accuracy, not for agents)
Use as source material when writing content:
- **Chemistry:** Princeton Review AP Chem prep book, Jeremy Krug YouTube
- **Biology:** Princeton Review AP Bio prep book, Amoeba Sisters YouTube,
  OpenStax Biology
- **General:** Khan Academy, PhET Interactive
