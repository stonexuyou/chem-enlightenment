#!/usr/bin/env python3
"""
Hybrid static builder for Chemical Enlightenment.

For each page it does TWO things:
  1. Prerenders a real dist/<slug>.html with the full content baked in
     (works with no JavaScript -> SEO + accessibility friendly).
  2. Emits dist/js/content.js (window.SITE) so static/js/app.js can swap
     content client-side via the History API for instant SPA-style navigation.

Usage:  python build.py
"""
import os
import json
import shutil
import datetime
import urllib.parse
import markdown
import jinja2

ROOT = os.path.dirname(os.path.abspath(__file__))
CONTENT = os.path.join(ROOT, "content")
TEMPLATES = os.path.join(ROOT, "templates")
STATIC = os.path.join(ROOT, "static")
DIST = os.path.join(ROOT, "dist")

# Base URL for canonical links, Open Graph, sitemap, robots, and 404 assets.
# Override per environment (e.g. a custom domain):  $env:SITE_URL = "https://www.chem-enlightenment.com"
SITE_URL = os.environ.get("SITE_URL", "https://stonexuyou.github.io/chem-enlightenment").rstrip("/")

ORDER = ["index", "general-chemistry", "ap-chemistry",
         "ap-chemistry-sub-page-unit-topics", "ap-chemistry-sub-page-lab-techniques",
         "ap-chemistry-sub-page-practice-exams", "science-olympiad",
         "scioly-sub-page-current-season-topics", "scioly-sub-page-tips-for-competition",
         "scioly-sub-page-practice-tests"]


def active_for(slug):
    if slug == "index":
        return "index"
    if slug.startswith("ap-chemistry"):
        return "ap-chemistry"
    if slug.startswith("science-olympiad") or slug.startswith("scioly"):
        return "science-olympiad"
    if slug.startswith("general-chemistry"):
        return "general-chemistry"
    return ""


def canonical_for(slug):
    return SITE_URL + "/" if slug == "index" else SITE_URL + "/" + slug + ".html"


NOT_FOUND_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page not found | Chemical Enlightenment</title>
  <meta name="robots" content="noindex">
  <link rel="icon" href="{site}/img/chemical-enlightenment-logo.png">
  <link rel="stylesheet" href="{site}/css/style.css">
</head>
<body>
  <header class="site-header">
    <a class="brand" href="{site}/">
      <img src="{site}/img/chemical-enlightenment-logo.png" alt="Chemical Enlightenment logo" width="40" height="40">
      <span>Chemical Enlightenment</span>
    </a>
  </header>
  <main class="content">
    <h1 class="page-title">Page not found</h1>
    <p>Sorry, that page doesn&rsquo;t exist. <a href="{site}/">Return home</a>.</p>
  </main>
  <footer class="site-footer">
    <p>&copy; {year} Chemical Enlightenment &middot; Free AP Chemistry &amp; Science Olympiad resources</p>
  </footer>
</body>
</html>
"""


def write_seo_files(order, year):
    """Emit sitemap.xml, robots.txt, and a branded 404.html into DIST."""
    today = datetime.date.today().isoformat()

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for slug in order:
        lines.append("  <url><loc>{}</loc><lastmod>{}</lastmod></url>".format(canonical_for(slug), today))
    lines.append("</urlset>")
    open(os.path.join(DIST, "sitemap.xml"), "w", encoding="utf-8").write("\n".join(lines) + "\n")

    open(os.path.join(DIST, "robots.txt"), "w", encoding="utf-8").write(
        "User-agent: *\nAllow: /\nSitemap: {}/sitemap.xml\n".format(SITE_URL))

    # Absolute asset URLs so the 404 renders correctly at any missing path depth.
    open(os.path.join(DIST, "404.html"), "w", encoding="utf-8").write(
        NOT_FOUND_HTML.format(site=SITE_URL, year=year))

    # GitHub Pages needs a CNAME file in the artifact to serve a custom domain.
    # Emitted only for a real domain -- writing one for a *.github.io URL would
    # make Pages try to serve a host it does not own.
    host = urllib.parse.urlparse(SITE_URL).hostname or ""
    if host and not host.endswith(".github.io"):
        open(os.path.join(DIST, "CNAME"), "w", encoding="utf-8").write(host + "\n")


def parse_front_matter(text):
    meta = {}
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) == 3:
            for line in parts[1].strip().splitlines():
                k, _, v = line.partition(":")
                meta[k.strip()] = v.strip().strip('"')
            return meta, parts[2].lstrip("\n")
    return meta, text


def clean_dist():
    if os.path.isdir(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)
    for sub in ("css", "img", "js"):
        src = os.path.join(STATIC, sub)
        if os.path.isdir(src):
            shutil.copytree(src, os.path.join(DIST, sub))
    os.makedirs(os.path.join(DIST, "js"), exist_ok=True)
    open(os.path.join(DIST, ".nojekyll"), "w").close()


def main():
    clean_dist()
    md = markdown.Markdown(extensions=["extra", "sane_lists", "attr_list"])

    # Pass 1: collect rendered page data (single source for both outputs).
    pages = {}
    for fname in os.listdir(CONTENT):
        if not fname.endswith(".md"):
            continue
        meta, body = parse_front_matter(open(os.path.join(CONTENT, fname), encoding="utf-8").read())
        slug = meta.get("slug") or os.path.splitext(fname)[0]
        html = md.convert(body)
        md.reset()
        pages[slug] = {"title": meta.get("title", slug),
                       "description": meta.get("description", ""),
                       "html": html}

    order = [s for s in ORDER if s in pages] + [s for s in pages if s not in ORDER]

    # content.js for client-side hydration / navigation.
    data = {"pages": pages, "order": order,
            "nav": [["index", "Home"], ["ap-chemistry", "AP Chemistry"],
                    ["science-olympiad", "Science Olympiad"], ["general-chemistry", "General Chemistry"]]}
    with open(os.path.join(DIST, "js", "content.js"), "w", encoding="utf-8") as f:
        f.write("/* Generated by build.py — do not edit by hand. */\n")
        f.write("window.SITE = " + json.dumps(data, ensure_ascii=False) + ";\n")

    # Pass 2: prerender a real HTML file per route (content baked in).
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(TEMPLATES),
                             autoescape=False, undefined=jinja2.StrictUndefined)
    template = env.get_template("base.html")
    year = datetime.date.today().year
    og_image = SITE_URL + "/img/chemical-enlightenment-logo.png"
    for slug in order:
        p = pages[slug]
        out = template.render(title=p["title"], description=p["description"],
                              content=p["html"], active=active_for(slug), year=year,
                              site_url=SITE_URL, canonical=canonical_for(slug), og_image=og_image)
        open(os.path.join(DIST, slug + ".html"), "w", encoding="utf-8").write(out)

    write_seo_files(order, year)

    print(f"Prerendered {len(order)} pages + content.js + sitemap/robots/404 -> {DIST}")
    for slug in order:
        print("  ", slug + ".html")


if __name__ == "__main__":
    main()
