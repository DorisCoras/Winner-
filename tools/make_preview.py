#!/usr/bin/env python3
"""
Ana sayfayı tek bir HTML dosyasına paketler (önizleme amaçlı).

Tüm CSS, JavaScript, yazı tipleri ve görseller dosyanın içine gömülür;
Three.js modülü klasik betiğe çevrilir. Sonuç, hiçbir dış dosyaya
ihtiyaç duymadan tek başına açılabilir.

Görseller önizleme boyutuna küçültülür — bu dosya yayın sürümünün
yerine geçmez, yalnızca siteyi göstermek içindir.

Kullanım:
    python3 tools/make_preview.py [cikti.html]
"""

import base64
import io
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "preview", "index-preview.html")

# Önizlemede tutulacak yazı tipi dosyaları (boyutu düşürmek için alt küme)
FONT_KEEP = (
    "cormorant-garamond-300-latin", "cormorant-garamond-300-latin-ext",
    "cormorant-garamond-400-latin", "cormorant-garamond-400-latin-ext",
    "cormorant-garamond-300-italic-latin", "cormorant-garamond-300-italic-latin-ext",
    "jost-300-latin", "jost-300-latin-ext",
    "jost-400-latin", "jost-400-latin-ext",
    "jost-500-latin", "jost-500-latin-ext",
)

# Yol kalıbına göre en büyük genişlik ve JPEG kalitesi
IMG_RULES = [
    ("assets/img/scenes/hero-",      1500, 70),
    ("assets/img/scenes/bookmatch-", 1100, 70),
    ("assets/img/scenes/",            900, 68),
    ("assets/img/tex/roughness",      256, 60),
    ("assets/img/tex/",               720, 74),
    ("assets/img/stones/",            520, 72),
]

_img_cache = {}


def data_uri(path, mime):
    with open(path, "rb") as f:
        return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode("ascii"))


def image_uri(rel):
    """Görseli önizleme boyutuna küçültüp data URI olarak döndürür."""
    rel = rel.split("?")[0].lstrip("./")
    if rel in _img_cache:
        return _img_cache[rel]

    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        return None

    if rel.endswith(".svg"):
        uri = data_uri(path, "image/svg+xml")
        _img_cache[rel] = uri
        return uri

    width, quality = 900, 70
    for prefix, w, q in IMG_RULES:
        if rel.startswith(prefix):
            width, quality = w, q
            break

    img = Image.open(path).convert("RGB")
    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    uri = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    _img_cache[rel] = uri
    return uri


def build_css():
    """Dört CSS dosyasını birleştirir; yazı tipi ve görsel yollarını gömer."""
    parts = []

    # --- fonts.css: yalnızca seçili alt küme ---
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

    # --- diğer stil dosyaları ---
    for name in ("core.css", "glass.css", "components.css"):
        css = open(os.path.join(ROOT, "assets/css", name), encoding="utf-8").read()

        def sub(m):
            raw = m.group(1).strip("'\"")
            if raw.startswith("data:"):
                return m.group(0)
            rel = raw.replace("../", "assets/")
            uri = image_uri(rel)
            return "url(%s)" % uri if uri else m.group(0)

        css = re.sub(r"url\((\.\./[^)]+)\)", sub, css)
        parts.append(css)

    return "\n".join(parts)


def build_js():
    """site.js + Three.js + scene.js -> tek klasik betik."""
    site = open(os.path.join(ROOT, "assets/js/site.js"), encoding="utf-8").read()
    three = open(os.path.join(ROOT, "assets/vendor/three.module.min.js"), encoding="utf-8").read()
    scene = open(os.path.join(ROOT, "assets/js/scene.js"), encoding="utf-8").read()

    # Three.js bir ES modülü: sondaki export listesini bir THREE nesnesine çevir
    m = re.search(r"export\{([^}]*)\};?\s*$", three)
    if not m:
        raise SystemExit("three.module.min.js içinde export listesi bulunamadı")

    pairs = []
    for item in m.group(1).split(","):
        item = item.strip()
        if " as " in item:
            local, public = item.split(" as ")
        else:
            local = public = item
        pairs.append("%s:%s" % (public.strip(), local.strip()))

    three_body = three[:m.start()] + "\nconst THREE={%s};\n" % ",".join(pairs)

    # scene.js'in import satırını kaldır (THREE artık yerel bir sabit)
    scene = re.sub(r"^\s*import\s+\*\s+as\s+THREE\s+from\s+['\"][^'\"]+['\"];?\s*$",
                   "", scene, flags=re.M)

    return site, "(function(){'use strict';\n%s\n%s\n})();" % (three_body, scene)


def main():
    html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()

    body = re.search(r"<body[^>]*>(.*)</body>", html, re.S).group(1)

    # Betik etiketlerini çıkar; kendi gömülü sürümlerimizi ekleyeceğiz
    body = re.sub(r'<script[^>]*src="[^"]*"[^>]*></script>', "", body)

    # <img src> ve stil içi background-image yollarını göm
    def sub_attr(m):
        uri = image_uri(m.group(2))
        return '%s="%s"' % (m.group(1), uri) if uri else m.group(0)

    body = re.sub(r'(src)="(assets/[^"]+)"', sub_attr, body)
    body = re.sub(r'(data-texture|data-roughness)="(assets/[^"]+)"', sub_attr, body)

    def sub_url(m):
        uri = image_uri(m.group(1))
        return "url(%s)" % uri if uri else m.group(0)

    body = re.sub(r"url\((assets/[^)]+)\)", sub_url, body)

    # srcset/sizes gerekmez: tek görsel gömüldü, ikinci kopya boşuna yer kaplar
    body = re.sub(r'\s+srcset="[^"]*"', "", body)
    body = re.sub(r'\s+sizes="[^"]*"', "", body)

    css = build_css()
    site_js, scene_js = build_js()

    # Önizlemede diğer sayfalar bulunmadığı için iç bağlantıları bilgilendir
    notice_js = """
(function () {
  var toast = document.createElement('div');
  toast.className = 'preview-toast';
  toast.textContent = 'Bu tek dosyalık önizlemede yalnızca ana sayfa yer alıyor.';
  document.body.appendChild(toast);
  var timer;
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^(https?:|mailto:|tel:)/.test(href)) return;
    e.preventDefault();
    toast.classList.add('is-on');
    clearTimeout(timer);
    timer = setTimeout(function () { toast.classList.remove('is-on'); }, 2600);
  });
})();
"""

    toast_css = """
.preview-toast {
  position: fixed;
  left: 50%;
  bottom: 1.6rem;
  transform: translate(-50%, 130%);
  z-index: 400;
  padding: 0.85rem 1.4rem;
  border-radius: 999px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  color: #f6f4ef;
  background: rgba(20, 20, 24, 0.86);
  backdrop-filter: blur(18px) saturate(1.6);
  -webkit-backdrop-filter: blur(18px) saturate(1.6);
  box-shadow: inset 0 0 0 1px rgba(201, 164, 76, 0.45), 0 20px 50px -22px rgba(0,0,0,0.9);
  transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
  max-width: min(90vw, 460px);
  text-align: center;
}
.preview-toast.is-on { transform: translate(-50%, 0); }
"""

    out = (
        "<style>\n%s\n%s\n</style>\n%s\n<script>\n%s\n</script>\n"
        "<script>\n%s\n</script>\n<script>\n%s\n</script>\n"
        % (css, toast_css, body, site_js, scene_js, notice_js)
    )

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(out)

    print("%s  (%.2f MB)" % (os.path.relpath(OUT, ROOT), os.path.getsize(OUT) / 1024 / 1024))


if __name__ == "__main__":
    main()
