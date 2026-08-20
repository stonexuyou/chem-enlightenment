# Tasks

Working task list for the current focus area. High-level phases live in
`roadmap.md`; this file tracks the concrete, actively-worked breakdown.
Update statuses as work progresses; move to the next phase's tasks here once
a phase wraps.

## Current focus: Phase 1 — Content buildout

- [ ] AP Biology top-level page (`content/ap-biology.md`)
- [ ] AP Biology sub-pages (mirror AP Chemistry pattern: lab techniques /
      unit topics / practice exams, or Biology-appropriate equivalent)
- [ ] Fill out AP Chemistry unit-topics content
      (`content/ap-chemistry-sub-page-unit-topics.md`)
- [ ] Fill out AP Biology big-ideas content
- [ ] Confirm/expand Science Olympiad event list (chem lab, designer genes,
      forensics) in `content/science-olympiad.md` and its sub-pages
- [ ] Add new pages to `ORDER` list and nav in `build.py` + `<nav>` in
      `templates/base.html`
- [ ] `python build.py` and spot-check `dist/` output for each new page

## Phase 2 — Interactive demonstrations (MVP done)
See `visualization-plan.md`.

- [x] Choose first visualization architecture (vanilla JS + native SVG, no
      framework/bundler)
- [x] Decide markdown-embed approach — raw HTML placeholder passes through
      Python-Markdown untouched, so `build.py` needed no changes
- [x] Implement reusable widget registry/lifecycle (`window.ChemViz`)
- [x] Add Unit 8 strong acid/strong base titration prototype
- [x] Verify widget lifecycle across hydrated navigation, Back/Forward and
      `file://`
- [x] Add Unit 5 reaction-energy / catalyst diagram (plan §2.1)
- [x] Add Unit 7 equilibrium particle model (plan §2.2) — first Canvas widget,
      first rAF loop, exercises the registry's cleanup contract for real
- [x] Add Unit 3 ideal-gas / piston widget (plan §2.3)
- [x] Add Unit 3 dilution widget (plan §2.4)
- [ ] Phase 2 complete — next is Phase 3 (Three.js VSEPR viewer), which
      first needs a pinned dependency strategy (vendored vs pinned CDN)
- [ ] Revisit a `{{chem:…}}` shortcode in `build.py` only if repeated raw-HTML
      embeds become hard to maintain

## Backlog
See `roadmap.md` Phases 3–5 (videos, cross-linking, built-in AI).
