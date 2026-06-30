/*
 * Hybrid hydration router for Chemical Enlightenment.
 *
 * Each route is prerendered to a real <slug>.html file (full content in the
 * initial HTML — great for SEO / no-JS). This script "hydrates" those pages:
 * on http(s) it intercepts internal link clicks and swaps content client-side
 * via the History API for instant, reload-free navigation. The content already
 * lives in the page on first paint, so there is no initial render here.
 *
 * On file:// the History API is unreliable, so we do nothing and let the real
 * prerendered pages work as a normal multi-page site.
 */
(function () {
  if (location.protocol === "file:") return;

  var SITE = window.SITE || { pages: {} };
  var app = document.getElementById("app");
  var main = document.getElementById("main");
  if (!app) return;

  function sectionOf(slug) {
    if (slug === "index") return "index";
    if (slug.indexOf("ap-chemistry") === 0) return "ap-chemistry";
    if (slug.indexOf("science-olympiad") === 0 || slug.indexOf("scioly") === 0) return "science-olympiad";
    if (slug.indexOf("general-chemistry") === 0) return "general-chemistry";
    return "";
  }

  function slugFromPath(path) {
    var file = (path || "").split("/").pop() || "index.html";
    if (file === "") file = "index.html";
    var slug = file.replace(/\.html$/, "");
    return slug || "index";
  }

  function setMeta(name, content) {
    var m = document.querySelector('meta[name="' + name + '"]');
    if (m) m.setAttribute("content", content || "");
  }

  function setActiveNav(section) {
    var links = document.querySelectorAll("#site-nav a[data-slug]");
    for (var i = 0; i < links.length; i++) {
      links[i].classList.toggle("active", links[i].getAttribute("data-slug") === section);
    }
  }

  function escapeText(t) {
    var d = document.createElement("div");
    d.textContent = t || "";
    return d.innerHTML;
  }

  function closeMenu() {
    var nav = document.getElementById("site-nav");
    var tog = document.querySelector(".nav-toggle");
    if (nav) nav.classList.remove("open");
    if (tog) tog.setAttribute("aria-expanded", "false");
  }

  function swap(slug, push, href) {
    var page = SITE.pages[slug];
    if (!page) return false; // unknown route -> let the browser navigate normally
    if (push) {
      try { history.pushState({ slug: slug }, "", href); }
      catch (e) { return false; }
    }
    document.title = page.title + " | Chemical Enlightenment";
    setMeta("description", page.description);
    app.innerHTML = '<h1 class="page-title">' + escapeText(page.title) + "</h1>" + page.html;
    setActiveNav(sectionOf(slug));
    closeMenu();
    window.scrollTo(0, 0);
    if (main) { main.focus(); }
    return true;
  }

  // Intercept internal link clicks -> client-side swap.
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest("a") : null;
    if (!a) return;
    if (a.target === "_blank" || a.hasAttribute("download")) return;
    var href = a.getAttribute("href") || "";
    if (!href || href.charAt(0) === "#") return;                 // in-page anchor
    if (/^https?:\/\//i.test(href)) return;                       // absolute/external
    if (/^[a-z][a-z0-9+.\-]*:/i.test(href)) return;               // mailto:, tel:, etc.
    if (!/\.html(?:$|[?#])/.test(href)) return;                   // only our page files
    var slug = slugFromPath(href.split("#")[0].split("?")[0]);
    if (swap(slug, true, href)) e.preventDefault();
  });

  // Mobile hamburger toggle.
  document.addEventListener("click", function (e) {
    var t = e.target;
    while (t && t !== document) {
      if (t.classList && t.classList.contains("nav-toggle")) {
        var nav = document.getElementById("site-nav");
        var open = nav.classList.toggle("open");
        t.setAttribute("aria-expanded", String(open));
        return;
      }
      t = t.parentNode;
    }
  });

  // Back/forward.
  window.addEventListener("popstate", function () {
    swap(slugFromPath(location.pathname), false, null);
  });
})();
