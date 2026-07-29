#!/usr/bin/env python3
"""
Sitenin TAMAMINI (39 sayfa) tek bir HTML dosyasına paketler.

Menü, alt bilgi ve stiller bir kez yazılır; her sayfanın <main> içeriği
bir JavaScript nesnesinde saklanır. Bağlantılar hash yönlendiricisiyle
çalışır, böylece tek dosya içinde gerçek bir gezinme kurulur.

Görseller ve yazı tipleri data URI olarak gömülür; Three.js modülü
klasik betiğe çevrilir. Sonuç, sunucu gerektirmeden tek başına açılır.

Not: Bu bir GÖSTERİM paketidir. Görseller boyut için küçültülür ve
tüm site tek dosyaya sığdırılır. Yayına alınacak sürüm, kök dizindeki
çok sayfalı yapıdır.

Kullanım:
    python3 tools/make_site_bundle.py [cikti.html]
"""

import base64
import io
import json
import os
import posixpath
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "preview", "index-preview.html")

FONT_KEEP = (
    "cormorant-garamond-300-latin", "cormorant-garamond-300-latin-ext",
    "cormorant-garamond-400-latin", "cormorant-garamond-400-latin-ext",
    "cormorant-garamond-300-italic-latin", "cormorant-garamond-300-italic-latin-ext",
    "jost-300-latin", "jost-300-latin-ext",
    "jost-400-latin", "jost-400-latin-ext",
    "jost-500-latin", "jost-500-latin-ext",
)

IMG_RULES = [
    ("assets/img/scenes/bookmatch-", 1000, 68),
    ("assets/img/scenes/hero-",      1200, 68),
    ("assets/img/scenes/",            820, 66),
    ("assets/img/tex/roughness",      256, 60),
    ("assets/img/tex/",               640, 72),
    ("assets/img/stones/",            470, 70),
]

_cache = {}      # kök-göreli yol -> data URI
_ids = {}        # kök-göreli yol -> kayıt defteri numarası
_registry = []   # numara sırasına göre data URI listesi

# Yerine geçene kadar kırık simge görünmesin diye 1x1 saydam GIF
BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"


def data_uri(path, mime):
    with open(path, "rb") as f:
        return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode("ascii"))


def image_id(rel):
    """Görseli kayıt defterine ekler ve numarasını döndürür.

    Aynı görsel onlarca sayfada geçtiği için data URI'yi her seferinde
    gömmek dosyayı katlıyordu; bunun yerine tek kopya tutulup sayfalarda
    yalnızca numarası yazılır, çalışma anında yerine konur.
    """
    uri = image_uri(rel)
    if uri is None:
        return None
    key = re.sub(r"-sm(\.jpg)$", r"\1", rel.split("?")[0].lstrip("./"))
    if key not in _ids:
        _ids[key] = len(_registry)
        _registry.append(uri)
    return _ids[key]


def image_uri(rel):
    """Görseli küçültüp data URI döndürür. -sm türevleri aslıyla aynı kaydı paylaşır."""
    rel = rel.split("?")[0].lstrip("./")

    # "<slug>-sm.jpg" ile "<slug>.jpg" aynı görseli göstersin: tek kopya yeter
    key = re.sub(r"-sm(\.jpg)$", r"\1", rel)
    if key in _cache:
        return _cache[key]

    path = os.path.join(ROOT, key)
    if not os.path.exists(path):
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            return None

    if key.endswith(".svg"):
        uri = data_uri(path, "image/svg+xml")
        _cache[key] = uri
        return uri

    width, quality = 800, 68
    for prefix, w, q in IMG_RULES:
        if key.startswith(prefix):
            width, quality = w, q
            break

    img = Image.open(path).convert("RGB")
    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    uri = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    _cache[key] = uri
    return uri


# ---------------------------------------------------------------------------
# Yol ve bağlantı normalleştirme
# ---------------------------------------------------------------------------
def canon(page_path, href):
    """Bir sayfadaki göreli bağlantıyı köke göre tek biçime çevirir."""
    base = posixpath.dirname(page_path)
    return posixpath.normpath(posixpath.join(base, href)) if base else posixpath.normpath(href)


def inline_assets(html, page_path):
    """Varlık yollarını kayıt defteri numaralarıyla değiştirir.

    Gerçek data URI'ler tek bir yerde tutulur; burada yalnızca
    data-img / data-bg / data-texture-id işaretleri bırakılır.
    """
    base = posixpath.dirname(page_path)

    def to_root(rel):
        return posixpath.normpath(posixpath.join(base, rel)) if base else posixpath.normpath(rel)

    def fix_tag(m):
        tag = m.group(0)

        # <img src="assets/..."> -> data-img="N"
        def sub_src(mm):
            i = image_id(to_root(mm.group(1)))
            return 'src="%s" data-img="%d"' % (BLANK, i) if i is not None else mm.group(0)

        tag = re.sub(r'src="((?:\.\./)*assets/[^"]+)"', sub_src, tag)

        # 3B doku yolları
        for attr in ("data-texture", "data-roughness"):
            def sub_tex(mm, a=attr):
                i = image_id(to_root(mm.group(1)))
                return '%s-id="%d"' % (a, i) if i is not None else mm.group(0)
            tag = re.sub(r'%s="((?:\.\./)*assets/[^"]+)"' % attr, sub_tex, tag)

        # style="...background-image:url(assets/...)..." -> data-bg="N"
        sm = re.search(r'style="([^"]*)"', tag)
        if sm and "url(" in sm.group(1):
            style = sm.group(1)
            found = []

            def sub_url(mm):
                i = image_id(to_root(mm.group(1)))
                if i is None:
                    return mm.group(0)
                found.append(i)
                return "url(%s)" % BLANK

            new_style = re.sub(r"url\(((?:\.\./)*assets/[^)]+)\)", sub_url, style)
            if found:
                tag = tag.replace('style="%s"' % style,
                                  'style="%s" data-bg="%d"' % (new_style, found[0]))
        return tag

    html = re.sub(r"<[^>]+>", fix_tag, html)

    # Tek görsel gömüldüğü için srcset/sizes gereksiz
    html = re.sub(r'\s+srcset="[^"]*"', "", html)
    html = re.sub(r'\s+sizes="[^"]*"', "", html)
    return html


def rewrite_links(html, page_path):
    """İç bağlantıları hash yönlendiricisinin anlayacağı biçime çevirir."""
    def sub(m):
        href = m.group(1)
        if (not href or href.startswith("#") or href.startswith("mailto:")
                or href.startswith("tel:") or href.startswith("http")
                or href.startswith("data:")):
            return m.group(0)
        path, _, frag = href.partition("#")
        if not path.endswith(".html"):
            return m.group(0)
        target = canon(page_path, path)
        return 'href="#/%s%s"' % (target, ("~" + frag) if frag else "")

    return re.sub(r'href="([^"]*)"', sub, html)


def build_css():
    parts = []
    fonts_css = open(os.path.join(ROOT, "assets/css/fonts.css"), encoding="utf-8").read()
    kept = []
    for block in re.findall(r"@font-face\s*\{[^}]*\}", fonts_css):
        m = re.search(r"url\('\.\./fonts/([^']+)'\)", block)
        if not m:
            continue
        name = m.group(1)
        if not any(name.startswith(k + ".") for k in FONT_KEEP):
            continue
        uri = data_uri(os.path.join(ROOT, "assets/fonts", name), "font/woff2")
        kept.append(block.replace("url('../fonts/%s')" % name, "url(%s)" % uri))
    parts.append("\n".join(kept))

    for name in ("core.css", "glass.css", "components.css"):
        css = open(os.path.join(ROOT, "assets/css", name), encoding="utf-8").read()

        def sub(m):
            raw = m.group(1).strip("'\"")
            if raw.startswith("data:"):
                return m.group(0)
            uri = image_uri(raw.replace("../", "assets/"))
            return "url(%s)" % uri if uri else m.group(0)

        parts.append(re.sub(r"url\((\.\./[^)]+)\)", sub, css))
    return "\n".join(parts)


def build_js():
    site = open(os.path.join(ROOT, "assets/js/site.js"), encoding="utf-8").read()
    three = open(os.path.join(ROOT, "assets/vendor/three.module.min.js"), encoding="utf-8").read()
    scene = open(os.path.join(ROOT, "assets/js/scene.js"), encoding="utf-8").read()

    m = re.search(r"export\{([^}]*)\};?\s*$", three)
    if not m:
        raise SystemExit("three.module.min.js içinde export listesi bulunamadı")

    pairs = []
    for item in m.group(1).split(","):
        item = item.strip()
        local, public = item.split(" as ") if " as " in item else (item, item)
        pairs.append("%s:%s" % (public.strip(), local.strip()))

    three_body = three[:m.start()] + "\nconst THREE={%s};\n" % ",".join(pairs)
    scene = re.sub(r"^\s*import\s+\*\s+as\s+THREE\s+from\s+['\"][^'\"]+['\"];?\s*$",
                   "", scene, flags=re.M)
    return site, "(function(){'use strict';\n%s\n%s\n})();" % (three_body, scene)


ROUTER_JS = r"""
(function () {
  'use strict';
  var main = document.getElementById('main');
  var current = null;

  /* Kayıt defterindeki görselleri yerine koyar. Aynı görsel onlarca
     sayfada geçtiği için dosyada tek kopya tutulur. */
  function hydrate(root) {
    root.querySelectorAll('[data-img]').forEach(function (el) {
      var u = WM_IMG[+el.getAttribute('data-img')];
      if (u) el.src = u;
    });
    root.querySelectorAll('[data-bg]').forEach(function (el) {
      var u = WM_IMG[+el.getAttribute('data-bg')];
      if (u) el.style.backgroundImage = 'url("' + u + '")';
    });
    ['texture', 'roughness'].forEach(function (name) {
      root.querySelectorAll('[data-' + name + '-id]').forEach(function (el) {
        var u = WM_IMG[+el.getAttribute('data-' + name + '-id')];
        if (u) el.setAttribute('data-' + name, u);
      });
    });
  }
  window.WM_HYDRATE = hydrate;

  function keyFromHash() {
    var h = (location.hash || '').replace(/^#\//, '');
    if (!h) return { page: 'index.html', frag: '' };
    var parts = h.split('~');
    var page = parts[0] || 'index.html';
    if (!WM_PAGES[page]) page = 'index.html';
    return { page: page, frag: parts[1] || '' };
  }

  function markNav(page) {
    var links = document.querySelectorAll('.site-nav .nav-link, .nav-drawer__link');
    Array.prototype.forEach.call(links, function (a) {
      var href = (a.getAttribute('href') || '').replace(/^#\//, '').split('~')[0];
      var on = href === page ||
        (page.indexOf('urunler/') === 0 && href === 'koleksiyon.html') ||
        (page.indexOf('koleksiyon/') === 0 && href === 'koleksiyon.html');
      a.classList.toggle('is-current', !!on);
    });
  }

  function render() {
    var t = keyFromHash();
    if (t.page === current && !t.frag) return;

    var data = WM_PAGES[t.page];
    if (!data) return;

    // 3B sahneleri serbest bırak: tarayıcının WebGL bağlam sınırı dolmasın
    if (window.WinnerScene && current !== null) window.WinnerScene.dispose();

    current = t.page;
    document.title = data.t;
    main.innerHTML = data.h;
    hydrate(main);
    markNav(t.page);

    window.scrollTo(0, 0);

    if (window.WinnerSite) window.WinnerSite.mount();
    if (window.WinnerScene) window.WinnerScene.mount();

    var hero = main.querySelector('[data-hero]');
    if (hero) requestAnimationFrame(function () { hero.classList.add('is-revealed'); });

    if (t.frag) {
      var el = document.getElementById(t.frag);
      if (el) {
        setTimeout(function () {
          window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 84 });
        }, 60);
      }
    }
  }

  hydrate(document.body);   // menü ve alt bilgi bir kez
  window.addEventListener('hashchange', render);
  render();
})();
"""


def main():
    pages = {}
    order = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in (".git", "assets", "tools", "preview")]
        for fn in sorted(filenames):
            if not fn.endswith(".html"):
                continue
            rel = posixpath.relpath(os.path.join(dirpath, fn), ROOT).replace(os.sep, "/")
            order.append(rel)

    order.sort(key=lambda p: (p != "index.html", p))

    shell_html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()

    for rel in order:
        raw = open(os.path.join(ROOT, rel), encoding="utf-8").read()
        title = re.search(r"<title>(.*?)</title>", raw, re.S).group(1).strip()
        body = re.search(r'<main id="main">(.*?)</main>', raw, re.S).group(1)
        body = inline_assets(body, rel)
        body = rewrite_links(body, rel)
        pages[rel] = {"t": title, "h": body}

    # --- Kabuk: menü, alt bilgi, perde, kırılma filtresi ---
    def grab(pattern):
        m = re.search(pattern, shell_html, re.S)
        return m.group(0) if m else ""

    loader = grab(r'<div class="loader".*?</div>\s*</div>')
    progress = '<div class="scroll-progress" aria-hidden="true"></div>'
    header = grab(r"<header class=\"site-nav\">.*?</header>")
    drawer = grab(r'<div class="nav-drawer" id="nav-drawer">.*?</div>\s*(?=<main)')
    footer = grab(r"<footer class=\"site-footer\">.*?</footer>")
    totop = grab(r'<button class="to-top".*?</button>')
    noise = '<div class="noise-overlay" aria-hidden="true"></div>'
    refraction = grab(r"<svg class=\"sr-only\".*?</svg>")

    shell_parts = []
    for part in (header, drawer, footer, totop):
        part = inline_assets(part, "index.html")
        part = rewrite_links(part, "index.html")
        shell_parts.append(part)
    header, drawer, footer, totop = shell_parts

    css = build_css()
    site_js, scene_js = build_js()

    doc = (
        "<style>\n%s\n</style>\n"
        "%s\n%s\n%s\n%s\n"
        '<main id="main"></main>\n'
        "%s\n%s\n%s\n%s\n"
        "<script>window.WM_IMG=%s;window.WM_PAGES=%s;</script>\n"
        "<script>\n%s\n</script>\n"
        "<script>\n%s\n</script>\n"
        "<script>\n%s\n</script>\n"
        % (css, loader, progress, header, drawer,
           footer, totop, noise, refraction,
           json.dumps(_registry),
           # Sayfa içeriğinde JSON-LD betikleri var; "</script>" dizisi
           # gömülü betiği erkenden kapatmasın diye kaçırılır.
           json.dumps(pages, ensure_ascii=False).replace("</", "<\\/"),
           site_js, scene_js, ROUTER_JS)
    )

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(doc)

    print("%d sayfa paketlendi -> %s (%.2f MB, %d benzersiz görsel)"
          % (len(pages), os.path.relpath(OUT, ROOT),
             os.path.getsize(OUT) / 1024 / 1024, len(_registry)))


if __name__ == "__main__":
    main()
