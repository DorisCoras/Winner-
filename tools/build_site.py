#!/usr/bin/env python3
"""
Winner Marble — statik site üretici.

tools/site_data.py içindeki içerikten tüm HTML sayfalarını üretir.
Çıktı tamamen statiktir: herhangi bir paylaşımlı hosting'e olduğu gibi
yüklenebilir, sunucu tarafı gereksinimi yoktur.

Kullanım:
    python3 tools/build_site.py
"""

import html
import os
import shutil
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from site_data import (  # noqa: E402
    SITE, NAV, FOOTER_EXTRA, CATEGORIES, STONE_INFO, COMMON_SPECS, FINISHES,
    APPLICATIONS, PROCESS, PROJECTS, VALUES, STATS, FAQ, CARE,
)
from generate_textures import STONES  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

STONE_BY_SLUG = {s["slug"]: s for s in STONES}
CAT_BY_KEY = {c["key"]: c for c in CATEGORIES}


def stones_in(cat_key):
    return [s for s in STONES if s["category"] == cat_key]


def e(text):
    return html.escape(str(text), quote=True)


def up(depth):
    """Kök dizine göreli ön ek."""
    return "../" * depth


# ===========================================================================
# SVG simgeleri
# ===========================================================================
ICON = {
    "arrow": '<svg class="btn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
             'stroke-width="1.5" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" '
             'stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "arrow-ne": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" '
                'width="15" height="15" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" '
                'stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "up": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" '
          'width="18" height="18" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" '
          'stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "mail": '<svg class="contact-row__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            'stroke-width="1.4" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="2"/>'
            '<path d="m3 6 9 6.5L21 6" stroke-linecap="round"/></svg>',
    "phone": '<svg class="contact-row__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
             'stroke-width="1.4" aria-hidden="true"><path d="M4 5c0-.6.4-1 1-1h3l1.6 4-2 1.4a13 13 0 0 0 '
             '6 6l1.4-2 4 1.6v3c0 .6-.4 1-1 1A16 16 0 0 1 4 5Z" stroke-linejoin="round"/></svg>',
    "pin": '<svg class="contact-row__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
           'stroke-width="1.4" aria-hidden="true"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/>'
           '<circle cx="12" cy="10" r="2.6"/></svg>',
    "clock": '<svg class="contact-row__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
             'stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/>'
             '<path d="M12 7.5V12l3 1.8" stroke-linecap="round"/></svg>',
    "instagram": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" '
                 'aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/>'
                 '<circle cx="12" cy="12" r="3.8"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" '
                 'stroke="none"/></svg>',
    "linkedin": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
                '<path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM3 9.5h4v11H3v-11Zm6.5 0h3.8v1.5a4.2 '
                '4.2 0 0 1 3.7-2c3 0 4 2 4 4.8v6.7h-4v-6c0-1.4-.5-2.4-1.8-2.4-1 0-1.6.7-1.9 1.4-.1.2-.1.6-.1 '
                '1v6h-4v-11Z"/></svg>',
    "logo": '<svg class="brand__glyph" viewBox="0 0 40 40" fill="none" aria-hidden="true">'
            '<path d="M20 2 38 20 20 38 2 20 20 2Z" stroke="currentColor" stroke-width="1.4"/>'
            '<path d="M20 9.5 30.5 20 20 30.5 9.5 20 20 9.5Z" stroke="currentColor" stroke-width="1" '
            'opacity=".6"/><path d="M20 16.5 23.5 20 20 23.5 16.5 20 20 16.5Z" fill="currentColor"/></svg>',
}


def tile_icon(i):
    """Özellik kutucukları için sade çizgisel simgeler."""
    paths = [
        '<path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 12.5 12 17.5 21 12.5"/><path d="M3 17 12 22 21 17"/>',
        '<circle cx="12" cy="12" r="8.5"/><path d="M12 6.5v5.5l3.5 2"/>',
        '<path d="M4 20V9l8-5 8 5v11"/><path d="M9.5 20v-6h5v6"/>',
        '<path d="M12 3 4 7v6c0 4.5 3.4 7.6 8 8.5 4.6-.9 8-4 8-8.5V7l-8-4Z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
        '<path d="M3 6h18M3 12h18M3 18h18"/>',
        '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    ]
    return ('<svg class="tile__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            'stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            + paths[i % len(paths)] + '</svg>')


# ===========================================================================
# Ortak parçalar
# ===========================================================================
def btn(label, href, variant="gold", extra="", arrow=True):
    cls = "btn btn--%s btn--magnetic" % variant
    if extra:
        cls += " " + extra
    return (
        '<a class="%s" href="%s">'
        '<span class="btn__label">%s</span>%s'
        '</a>' % (cls, href, e(label), ICON["arrow"] if arrow else "")
    )


def stone_card(stone, depth, sizes="(max-width:680px) 88vw, (max-width:1100px) 44vw, 24vw"):
    slug = stone["slug"]
    cat = CAT_BY_KEY[stone["category"]]
    info = STONE_INFO.get(slug, {})
    base = up(depth)
    return (
        '<a class="stone-card shimmer" href="%surunler/%s.html" data-cat="%s">'
        '<span class="stone-card__tag chip"><span class="chip__dot"></span>%s</span>'
        '<span class="stone-card__media">'
        '<img class="stone-card__img" src="%sassets/img/stones/%s.jpg" '
        'srcset="%sassets/img/stones/%s-sm.jpg 560w, %sassets/img/stones/%s.jpg 1120w" '
        'sizes="%s" width="1120" height="1400" loading="lazy" decoding="async" alt="%s doğal taş plaka">'
        '<span class="stone-card__glow"></span>'
        '</span>'
        '<span class="stone-card__body">'
        '<span><span class="stone-card__name">%s</span>'
        '<span class="stone-card__meta">%s</span></span>'
        '<span class="stone-card__go">%s</span>'
        '</span></a>'
        % (base, slug, stone["category"], e(cat["name"]),
           base, slug, base, slug, base, slug, sizes,
           e(stone["name"]),
           e(stone["name"]), e(info.get("origin", cat["name"])),
           ICON["arrow-ne"])
    )


def nav_html(depth, current):
    base = up(depth)
    items = []
    for label, href, kind in NAV:
        cls = "nav-link" + (" is-current" if href == current else "")
        if kind == "mega":
            mega_cols = []
            chunk = [CATEGORIES[0:2], CATEGORIES[2:4], CATEGORIES[4:6]]
            for col in chunk:
                links = []
                for c in col:
                    first = stones_in(c["key"])[0]
                    links.append(
                        '<a class="mega__item" href="%skoleksiyon/%s.html">'
                        '<img class="mega__swatch" src="%sassets/img/stones/%s-sm.jpg" '
                        'width="38" height="38" loading="lazy" decoding="async" alt="">'
                        '<span><span class="mega__label">%s</span><br>'
                        '<span class="mega__count">%d çeşit</span></span></a>'
                        % (base, c["slug"], base, first["slug"], e(c["name"]),
                           len(stones_in(c["key"])))
                    )
                mega_cols.append("".join(links))

            items.append(
                '<li class="has-mega"><a class="%s" href="%skoleksiyon.html">%s</a>'
                '<div class="mega glass glass--dark glass--spectral">'
                '<div class="mega__grid">'
                '<div><p class="mega__col-title">Mermer</p>%s</div>'
                '<div><p class="mega__col-title">Doğal Taş</p>%s</div>'
                '<div><p class="mega__col-title">Özel Koleksiyon</p>%s</div>'
                '</div></div></li>'
                % (cls, base, e(label), mega_cols[0], mega_cols[1], mega_cols[2])
            )
        else:
            items.append('<li><a class="%s" href="%s%s">%s</a></li>'
                         % (cls, base, href, e(label)))

    drawer = []
    for i, (label, href, _k) in enumerate(NAV):
        drawer.append(
            '<a class="nav-drawer__link" href="%s%s">'
            '<span class="nav-drawer__num">0%d</span>%s</a>'
            % (base, href, i + 1, e(label))
        )
    for label, href in FOOTER_EXTRA:
        drawer.append('<a class="nav-drawer__link" href="%s%s">'
                      '<span class="nav-drawer__num">—</span>%s</a>'
                      % (base, href, e(label)))

    return (
        '<div class="scroll-progress" aria-hidden="true"></div>\n'
        '<header class="site-nav">\n'
        '  <div class="site-nav__bg"></div>\n'
        '  <div class="site-nav__inner">\n'
        '    <a class="brand" href="%sindex.html" aria-label="%s ana sayfa">%s'
        '<span class="brand__text"><span class="brand__name">WINNER</span>'
        '<span class="brand__tag">%s</span></span></a>\n'
        '    <nav aria-label="Ana menü"><ul class="nav-list">%s</ul></nav>\n'
        '    <div class="nav-actions">%s'
        '<button class="nav-toggle" type="button" aria-label="Menüyü aç" '
        'aria-expanded="false" aria-controls="nav-drawer"><i></i><i></i><i></i></button></div>\n'
        '  </div>\n'
        '</header>\n'
        '<div class="nav-drawer" id="nav-drawer">%s</div>\n'
        % (base, e(SITE["name"]), ICON["logo"], e(SITE["tagline"]),
           "".join(items),
           btn("Teklif Al", base + "iletisim.html", "glass", "btn--sm"),
           "".join(drawer))
    )


def footer_html(depth):
    base = up(depth)

    cat_links = "".join(
        '<a href="%skoleksiyon/%s.html">%s</a>' % (base, c["slug"], e(c["name"]))
        for c in CATEGORIES
    )
    corp_links = "".join(
        '<a href="%s%s">%s</a>' % (base, href, e(label))
        for label, href, _k in NAV[1:]
    ) + "".join(
        '<a href="%s%s">%s</a>' % (base, href, e(label))
        for label, href in FOOTER_EXTRA
    )
    social = "".join(
        '<a class="social" href="%s" target="_blank" rel="noopener noreferrer" '
        'aria-label="%s">%s</a>' % (url, e(name), ICON[icon])
        for name, url, icon in SITE["social"]
    )

    return (
        '<footer class="site-footer">\n'
        '  <div class="shell">\n'
        '    <div class="footer-grid">\n'
        '      <div class="footer-col">\n'
        '        <a class="brand" href="%sindex.html">%s<span class="brand__text">'
        '<span class="brand__name">WINNER</span>'
        '<span class="brand__tag">%s</span></span></a>\n'
        '        <p class="muted" style="margin-top:1.4rem;max-width:38ch;font-size:var(--step--1)">%s</p>\n'
        '        <div class="social-row" style="margin-top:1.6rem">%s</div>\n'
        '      </div>\n'
        '      <div class="footer-col"><p class="footer-col__title">Koleksiyon</p>'
        '<nav class="footer-links" aria-label="Koleksiyon">%s</nav></div>\n'
        '      <div class="footer-col"><p class="footer-col__title">Kurumsal</p>'
        '<nav class="footer-links" aria-label="Kurumsal">%s</nav></div>\n'
        '      <div class="footer-col"><p class="footer-col__title">İletişim</p>\n'
        '        <nav class="footer-links">'
        '<a href="mailto:%s">%s</a>'
        '<a href="tel:%s">%s</a>'
        '<span class="muted">%s<br>%s</span>'
        '<span class="muted">%s</span>'
        '</nav>\n'
        '      </div>\n'
        '    </div>\n'
        '  </div>\n'
        '  <p class="footer-wordmark" aria-hidden="true">WINNER MARBLE</p>\n'
        '  <div class="shell"><div class="footer-bottom">\n'
        '    <span>© %d %s. Tüm hakları saklıdır.</span>\n'
        '    <span>%s — %s</span>\n'
        '  </div></div>\n'
        '</footer>\n'
        '<button class="to-top glass glass--pill" type="button" aria-label="Sayfa başına dön">%s</button>\n'
        % (base, ICON["logo"], e(SITE["tagline"]),
           e(SITE["description"]), social, cat_links, corp_links,
           e(SITE["email"]), e(SITE["email"]),
           e(SITE["phone_href"]), e(SITE["phone"]),
           e(SITE["address_line1"]), e(SITE["address_line2"]),
           e(SITE["hours"]),
           date.today().year, e(SITE["name"]),
           e(SITE["tagline"]), e(SITE["tagline_tr"]),
           ICON["up"])
    )


REFRACTION_SVG = (
    '<svg class="sr-only" aria-hidden="true" focusable="false">\n'
    '  <filter id="winner-refraction" x="-20%" y="-20%" width="140%" height="140%">\n'
    '    <feTurbulence type="fractalNoise" baseFrequency="0.008 0.014" numOctaves="2" '
    'seed="7" result="turb"/>\n'
    '    <feGaussianBlur in="turb" stdDeviation="1.4" result="soft"/>\n'
    '    <feDisplacementMap in="SourceGraphic" in2="soft" scale="16" '
    'xChannelSelector="R" yChannelSelector="G"/>\n'
    '  </filter>\n'
    '</svg>\n'
)


def page(*, path, title, description, body, depth=0, current="", scene=False, og_image=None):
    """Tam bir HTML sayfası oluşturur ve diske yazar."""
    base = up(depth)
    canonical = SITE["url"].rstrip("/") + "/" + path
    og = og_image or "assets/img/scenes/hero-calacatta.jpg"

    doc = """<!DOCTYPE html>
<html lang="tr" class="has-smooth-scroll">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#08080a">
<link rel="canonical" href="{canonical}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="{site}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{ogurl}">
<meta property="og:locale" content="tr_TR">
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" href="{base}assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="{base}assets/img/apple-touch-icon.png">

<link rel="preconnect" href="">
<link rel="preload" as="font" type="font/woff2" href="{base}assets/fonts/cormorant-garamond-300-latin.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="{base}assets/fonts/jost-300-latin.woff2" crossorigin>

<link rel="stylesheet" href="{base}assets/css/fonts.css">
<link rel="stylesheet" href="{base}assets/css/core.css">
<link rel="stylesheet" href="{base}assets/css/glass.css">
<link rel="stylesheet" href="{base}assets/css/components.css">

<script type="application/ld+json">
{jsonld}
</script>
</head>
<body>
<a class="skip-link" href="#main">İçeriğe geç</a>

<div class="loader" aria-hidden="true">
  <div style="display:grid;place-items:center">
    <span class="loader__mark">WINNER</span>
    <span class="loader__bar"><i></i></span>
  </div>
</div>

{nav}
<main id="main">
{body}
</main>
{footer}
<div class="noise-overlay" aria-hidden="true"></div>
{refraction}
<script src="{base}assets/js/site.js" defer></script>
{scene}
</body>
</html>
"""

    jsonld = (
        '{\n'
        '  "@context": "https://schema.org",\n'
        '  "@type": "Organization",\n'
        '  "name": "%s",\n'
        '  "url": "%s",\n'
        '  "slogan": "%s",\n'
        '  "description": "%s",\n'
        '  "email": "%s",\n'
        '  "telephone": "%s",\n'
        '  "address": { "@type": "PostalAddress", "addressCountry": "TR" },\n'
        '  "sameAs": [%s]\n'
        '}' % (
            SITE["name"], SITE["url"], SITE["tagline"],
            SITE["description"].replace('"', "'"),
            SITE["email"], SITE["phone"],
            ", ".join('"%s"' % u for _n, u, _i in SITE["social"]),
        )
    )

    scene_tag = ('<script type="module" src="%sassets/js/scene.js"></script>' % base) if scene else ""

    doc = doc.format(
        title=e(title), desc=e(description), canonical=canonical,
        site=e(SITE["name"]), ogurl=SITE["url"].rstrip("/") + "/" + og,
        base=base, jsonld=jsonld,
        nav=nav_html(depth, current), body=body,
        footer=footer_html(depth), refraction=REFRACTION_SVG,
        scene=scene_tag,
    )

    out = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(out) or ROOT, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(doc)
    print("  ->", path)


# ===========================================================================
# Yeniden kullanılabilir bölümler
# ===========================================================================
def sec_page_hero(*, eyebrow, title, sub, image, depth, crumbs):
    base = up(depth)
    crumb_html = '<a href="%sindex.html">Ana Sayfa</a>' % base
    for label, href in crumbs:
        crumb_html += '<span class="breadcrumb__sep">/</span>'
        if href:
            crumb_html += '<a href="%s%s">%s</a>' % (base, href, e(label))
        else:
            crumb_html += '<span>%s</span>' % e(label)

    return (
        '<section class="page-hero" id="baslik">\n'
        '  <div class="page-hero__media" style="background-image:url(%sassets/img/scenes/%s.jpg)" '
        'data-parallax="0.18"></div>\n'
        '  <div class="page-hero__veil"></div>\n'
        '  <div class="shell">\n'
        '    <nav class="breadcrumb" aria-label="Sayfa yolu" data-reveal="fade">%s</nav>\n'
        '    <div class="page-hero__inner" style="margin-top:1.4rem">\n'
        '      <span class="eyebrow" data-reveal="fade">%s</span>\n'
        '      <h1 data-reveal>%s</h1>\n'
        '      <p class="lede page-hero__sub" data-reveal data-reveal-delay="0.1">%s</p>\n'
        '    </div>\n'
        '  </div>\n'
        '</section>\n'
        % (base, image, crumb_html, e(eyebrow), e(title), e(sub))
    )


def sec_marquee(items):
    inner = "".join('<span class="marquee__item">%s</span>' % e(i) for i in items)
    return ('<section class="marquee" id="serit" aria-hidden="true">\n'
            '  <div class="marquee__track">%s</div>\n'
            '</section>\n' % inner)


def sec_stats(depth):
    cells = "".join(
        '<div class="stat">'
        '<span class="stat__num"><span data-count="%s">0</span>'
        '<span class="stat__suffix">%s</span></span>'
        '<span class="stat__label">%s</span></div>'
        % (s["num"], e(s["suffix"]), e(s["label"]))
        for s in STATS
    )
    return ('<section class="section section--tight" id="rakamlar">\n'
            '  <div class="shell"><div class="stats" data-reveal>%s</div></div>\n'
            '</section>\n' % cells)


def sec_cta(depth, *, title=None, text=None, image="hero-portoro"):
    base = up(depth)
    title = title or "Projeniz için doğru taşı birlikte seçelim"
    text = text or ("Numune talebi, plaka seçimi ve fiyat teklifi için ekibimize "
                    "yazın; 24 saat içinde size dönüş yapalım.")
    return (
        '<section class="section" id="teklif">\n'
        '  <div class="shell">\n'
        '    <div class="cta-band" data-reveal="zoom">\n'
        '      <div class="cta-band__media" style="background-image:url(%sassets/img/scenes/%s.jpg)" '
        'data-parallax="0.1"></div>\n'
        '      <span class="eyebrow eyebrow--center">Teklif Alın</span>\n'
        '      <h2 style="max-width:18ch">%s</h2>\n'
        '      <p class="lede" style="max-width:52ch">%s</p>\n'
        '      <div style="display:flex;gap:0.9rem;flex-wrap:wrap;justify-content:center">%s%s</div>\n'
        '    </div>\n'
        '  </div>\n'
        '</section>\n'
        % (base, image, e(title), e(text),
           btn("İletişime Geçin", base + "iletisim.html", "gold"),
           btn("Koleksiyonu Gör", base + "koleksiyon.html", "ghost"))
    )


def sec_categories(depth, *, title="Koleksiyon", limit=None):
    base = up(depth)
    cats = CATEGORIES[:limit] if limit else CATEGORIES
    cards = "".join(
        '<a class="cat-card" href="%skoleksiyon/%s.html">'
        '<span class="cat-card__media" style="background-image:url(%sassets/img/scenes/%s.jpg)"></span>'
        '<span class="chip chip--gold" style="justify-self:start">%d çeşit</span>'
        '<span class="cat-card__title">%s</span>'
        '<span class="cat-card__desc">%s</span></a>'
        % (base, c["slug"], base, c["hero"], len(stones_in(c["key"])),
           e(c["name"]), e(c["short"]))
        for c in cats
    )
    return (
        '<section class="section" id="kategoriler">\n'
        '  <div class="shell">\n'
        '    <div class="section-head">\n'
        '      <span class="eyebrow" data-reveal="fade">%s</span>\n'
        '      <h2 data-reveal>Her mekâna bir taş,<br><span class="italic-accent">her taşa bir hikâye</span></h2>\n'
        '      <p class="lede" data-reveal data-reveal-delay="0.08">Beyazın sükûnetinden oniksin '
        'ışığına kadar altı ayrı koleksiyon; hepsi tek tek seçilmiş bloklardan.</p>\n'
        '    </div>\n'
        '    <div class="grid grid-3" data-reveal-stagger="0.09">%s</div>\n'
        '  </div>\n'
        '</section>\n' % (e(title), cards)
    )


def sec_process(depth, *, limit=None):
    steps = PROCESS[:limit] if limit else PROCESS
    items = "".join(
        '<div class="tl-step" data-reveal="left">'
        '<div class="tl-step__dot">%s</div>'
        '<div class="tl-step__body"><h3 class="tl-step__title">%s</h3>'
        '<p class="muted">%s</p></div></div>'
        % (e(s["n"]), e(s["title"]), e(s["text"]))
        for s in steps
    )
    return (
        '<section class="section" id="surec">\n'
        '  <div class="shell">\n'
        '    <div class="section-head">\n'
        '      <span class="eyebrow" data-reveal="fade">Üretim</span>\n'
        '      <h2 data-reveal>Ocaktan şantiyeye<br><span class="italic-accent">yedi durak</span></h2>\n'
        '    </div>\n'
        '    <div class="timeline">%s</div>\n'
        '  </div>\n'
        '</section>\n' % items
    )


# ===========================================================================
# Sayfalar
# ===========================================================================
def build_home():
    depth = 0
    featured = ["calacatta-gold", "portoro-gold", "calacatta-viola", "honey-onyx",
                "verde-guatemala", "nero-marquina", "emperador-dark", "traverten-classic"]

    hscroll_items = "".join(
        '<div class="hscroll__item">'
        '<figure class="hscroll__figure shimmer">'
        '<img src="assets/img/stones/%s.jpg" srcset="assets/img/stones/%s-sm.jpg 560w, '
        'assets/img/stones/%s.jpg 1120w" sizes="(max-width:900px) 74vw, 30vw" '
        'width="1120" height="1400" loading="lazy" decoding="async" alt="%s mermer plaka"></figure>'
        '<div class="hscroll__cap"><span style="font-family:var(--font-display);'
        'font-size:var(--step-1)">%s</span>'
        '<a class="stone-card__go" href="urunler/%s.html" aria-label="%s detay">%s</a></div>'
        '</div>'
        % (s, s, s, e(STONE_BY_SLUG[s]["name"]), e(STONE_BY_SLUG[s]["name"]),
           s, e(STONE_BY_SLUG[s]["name"]), ICON["arrow-ne"])
        for s in featured
    )

    values = "".join(
        '<div class="tile"><span class="tile__num">%s</span>%s'
        '<h3 class="tile__title">%s</h3><p class="muted">%s</p></div>'
        % (e(v["n"]), tile_icon(i), e(v["title"]), e(v["text"]))
        for i, v in enumerate(VALUES)
    )

    apps = "".join(
        '<a class="cat-card" href="uygulamalar.html#%s">'
        '<span class="cat-card__media" style="background-image:url(assets/img/stones/%s.jpg)"></span>'
        '<span class="cat-card__title">%s</span>'
        '<span class="cat-card__desc">%s</span></a>'
        % (a["slug"], a["img"], e(a["title"]), e(a["points"][0]))
        for a in APPLICATIONS[:3]
    )

    projects = "".join(
        '<article class="stone-card shimmer" style="display:block">'
        '<span class="stone-card__media" style="aspect-ratio:4/3">'
        '<img class="stone-card__img" src="assets/img/scenes/%s.jpg" '
        'width="2200" height="1240" loading="lazy" decoding="async" alt="%s">'
        '<span class="stone-card__glow"></span></span>'
        '<span class="stone-card__body"><span>'
        '<span class="stone-card__name">%s</span>'
        '<span class="stone-card__meta">%s · %s</span></span></span></article>'
        % (p["img"], e(p["title"]), e(p["title"]), e(p["place"]), e(p["year"]))
        for p in PROJECTS[:3]
    )

    body = f"""
<!-- ================= Bölüm: Hero ================= -->
<section class="hero" id="hero" data-hero>
  <div class="hero__fallback" style="background-image:url(assets/img/scenes/hero-portoro.jpg)"></div>
  <div class="hero__canvas" data-scene="hero"
       data-texture="assets/img/tex/calacatta-gold-1k.jpg"
       data-roughness="assets/img/tex/roughness-1k.jpg" aria-hidden="true"></div>
  <div class="hero__veil"></div>

  <div class="liquid-blob" style="width:46vw;height:46vw;left:-12vw;top:8vh" aria-hidden="true"></div>
  <div class="liquid-blob liquid-blob--b" style="width:38vw;height:38vw;right:-8vw;bottom:2vh" aria-hidden="true"></div>

  <div class="shell">
    <div class="hero__inner">
      <span class="eyebrow">{e(SITE['tagline'])}</span>
      <h1 class="hero-title hero__title">
        <span class="reveal-line"><span>Doğanın</span></span>
        <span class="reveal-line"><span>en zarif</span></span>
        <span class="reveal-line"><span class="italic-accent">imzası</span></span>
      </h1>
      <p class="lede hero__sub">20 yılı aşkın deneyimle, dünyanın dört bir yanından seçilmiş
      mermer ve doğal taşları yaşam alanlarınıza taşıyoruz.</p>
      <div class="hero__actions">
        {btn("Koleksiyonu Keşfet", "koleksiyon.html", "gold")}
        {btn("Bize Ulaşın", "iletisim.html", "glass")}
      </div>
    </div>
  </div>

  <aside class="hero__aside glass glass--spectral">
    <span class="chip chip--gold"><span class="chip__dot"></span>Canlı Koleksiyon</span>
    <p style="font-size:var(--step--1);color:var(--stone-300)">
      {len(STONES)} taş çeşidi, {len(CATEGORIES)} koleksiyon ve sürekli yenilenen
      blok stoğu ile projelerinize hazırız.</p>
    <a class="nav-link" href="koleksiyon.html" style="color:var(--gold)">Tümünü gör</a>
  </aside>

  <div class="scroll-cue" aria-hidden="true">
    <span>Kaydırın</span>
    <span class="scroll-cue__track"></span>
  </div>
</section>

{sec_marquee([s["name"] for s in STONES[:12]])}

<!-- ================= Bölüm: Manifesto ================= -->
<section class="section" id="manifesto">
  <div class="shell">
    <div class="split">
      <div class="split__media" data-reveal="clip">
        <img src="assets/img/scenes/bookmatch-calacatta-viola.jpg" width="1800" height="1200"
             loading="lazy" decoding="async" data-parallax="0.12"
             alt="Kitap açılımı uygulanmış Calacatta Viola mermer duvar">
        <div class="float-card glass glass--spectral">
          <span class="eyebrow">Kitap Açılımı</span>
          <p style="font-size:var(--step--1);color:var(--stone-300);margin-top:0.4rem">
            Aynı bloktan ardışık kesilen iki plaka, duvarda birbirinin aynası olur.</p>
        </div>
      </div>
      <div class="split__body">
        <span class="eyebrow" data-reveal="fade">Hakkımızda</span>
        <h2 data-reveal>Milyonlarca yılın<br><span class="italic-accent">tek seferlik</span> eseri</h2>
        <div class="flow" data-reveal data-reveal-delay="0.08">
          <p class="lede">Mermer, doğanın tekrar etmeyen imzasıdır. Aynı ocaktan çıkan
          iki plaka bile birbirinin aynısı değildir.</p>
          <p class="muted">Winner Marble olarak 20 yılı aşkın süredir, doğal taşın en zarif ve
          dayanıklı biçimini yaşam alanlarına taşıyoruz. Lüks mermer konusunda uzmanlaşmış
          ekibimiz, dünyanın dört bir yanındaki ocaklardan seçtiği blokları titizlikle
          değerlendirir ve yalnızca onaylananları koleksiyonumuza dâhil eder.</p>
          <p class="muted">Yurt içi ve yurt dışı müşterilerimize güvenilir, kaliteli ve
          estetik çözümler sunarak sektördeki konumumuzu koruyoruz.</p>
        </div>
        <div data-reveal data-reveal-delay="0.16">{btn("Hikâyemiz", "hakkimizda.html", "ghost")}</div>
      </div>
    </div>
  </div>
</section>

{sec_stats(depth)}
{sec_categories(depth)}

<!-- ================= Bölüm: Öne çıkan taşlar (yatay kaydırma) ================= -->
<section class="hscroll" id="one-cikanlar">
  <div class="hscroll__viewport">
    <div class="shell" style="padding-bottom:2rem">
      <span class="eyebrow">Seçkiler</span>
      <h2 style="margin-top:1rem">Öne çıkan taşlar</h2>
    </div>
    <div class="hscroll__track">{hscroll_items}</div>
  </div>
</section>

<!-- ================= Bölüm: Değerlerimiz ================= -->
<section class="section" id="degerler">
  <div class="shell">
    <div class="section-head section-head--center">
      <span class="eyebrow eyebrow--center" data-reveal="fade">Neden Winner</span>
      <h2 data-reveal>Taşı seçmek işin yarısı,<br><span class="italic-accent">doğru iş ortağı</span> diğer yarısı</h2>
    </div>
    <div class="grid grid-4" data-reveal-stagger="0.08">{values}</div>
  </div>
</section>

<!-- ================= Bölüm: Uygulamalar ================= -->
<section class="section" id="uygulamalar">
  <div class="shell">
    <div class="section-head">
      <span class="eyebrow" data-reveal="fade">Uygulama Alanları</span>
      <h2 data-reveal>Taş, doğru yerde<br><span class="italic-accent">karakter kazanır</span></h2>
    </div>
    <div class="grid grid-3" data-reveal-stagger="0.09">{apps}</div>
    <div style="margin-top:2.5rem" data-reveal>{btn("Tüm uygulamalar", "uygulamalar.html", "ghost")}</div>
  </div>
</section>

{sec_process(depth, limit=4)}

<!-- ================= Bölüm: Projeler ================= -->
<section class="section" id="projeler">
  <div class="shell">
    <div class="section-head">
      <span class="eyebrow" data-reveal="fade">Referanslar</span>
      <h2 data-reveal>Taşımızın<br><span class="italic-accent">yaşadığı mekânlar</span></h2>
    </div>
    <div class="grid grid-3" data-reveal-stagger="0.1">{projects}</div>
    <div style="margin-top:2.5rem" data-reveal>{btn("Tüm projeler", "projeler.html", "ghost")}</div>
  </div>
</section>

<!-- ================= Bölüm: Alıntı ================= -->
<section class="section" id="alinti">
  <div class="shell shell--narrow">
    <div class="quote" data-reveal>
      <span class="quote__mark">&ldquo;</span>
      <p class="quote__text">Her blok bir kez kesilir. O yüzden doğru taşı seçmek,
      doğru anı seçmektir.</p>
      <span class="quote__by">Winner Marble — {e(SITE['tagline'])}</span>
    </div>
  </div>
</section>

{sec_cta(depth)}
"""

    page(path="index.html",
         title="%s — %s | Lüks Mermer ve Doğal Taş" % (SITE["name"], SITE["tagline"]),
         description=SITE["description"],
         body=body, depth=depth, current="index.html", scene=True)


def build_about():
    depth = 0
    values = "".join(
        '<div class="tile"><span class="tile__num">%s</span>%s'
        '<h3 class="tile__title">%s</h3><p class="muted">%s</p></div>'
        % (e(v["n"]), tile_icon(i + 2), e(v["title"]), e(v["text"]))
        for i, v in enumerate(VALUES)
    )

    body = f"""
{sec_page_hero(eyebrow="Hakkımızda", title="Kazananların tercihi",
               sub="20 yılı aşkın deneyimle mermerin zamansız güzelliğini "
                   "yaşam alanlarına taşıyoruz.",
               image="hero-portoro", depth=depth, crumbs=[("Hakkımızda", None)])}

<!-- ================= Bölüm: Hikâye ================= -->
<section class="section" id="hikaye">
  <div class="shell">
    <div class="split">
      <div class="split__media" data-reveal="clip">
        <img src="assets/img/scenes/bookmatch-portoro-gold.jpg" width="1800" height="1200"
             loading="lazy" decoding="async" data-parallax="0.12"
             alt="Portoro Gold mermerin kitap açılımı kompozisyonu">
      </div>
      <div class="split__body">
        <span class="eyebrow" data-reveal="fade">Hikâyemiz</span>
        <h2 data-reveal>Taşın dilini<br><span class="italic-accent">bilen bir ekip</span></h2>
        <div class="flow" data-reveal data-reveal-delay="0.08">
          <p class="lede">Mermer, doğal taşın en zarif ve dayanıklı biçimidir.
          Biz de 20 yılı aşkın süredir bu taşı yaşam alanlarına taşıyoruz.</p>
          <p class="muted">Lüks mermer konusunda uzmanlaşmış ekibimizle, dünyanın dört bir
          yanından en kaliteli mermer çeşitlerini özenle seçerek müşterilerimize sunuyoruz.
          Bir bloğun rengi, damar yönü ve iç yapısı; o taşın hangi projede hangi yüzeyde
          hak ettiği yeri bulacağını belirler. İşimizin özü bu değerlendirmedir.</p>
          <p class="muted">Yurt içi ve yurt dışı müşterilerimize güvenilir, kaliteli ve estetik
          çözümler sunarak sektördeki liderliğimizi sürdürüyoruz. Geniş ürün yelpazemizle
          mekânlarınıza hem estetik hem de değer katıyoruz.</p>
        </div>
      </div>
    </div>
  </div>
</section>

{sec_stats(depth)}

<!-- ================= Bölüm: Değerler ================= -->
<section class="section" id="degerler">
  <div class="shell">
    <div class="section-head">
      <span class="eyebrow" data-reveal="fade">Değerlerimiz</span>
      <h2 data-reveal>Üzerinde durduğumuz<br><span class="italic-accent">dört sütun</span></h2>
    </div>
    <div class="grid grid-4" data-reveal-stagger="0.08">{values}</div>
  </div>
</section>

<!-- ================= Bölüm: Yaklaşım ================= -->
<section class="section" id="yaklasim">
  <div class="shell">
    <div class="split split--reverse">
      <div class="split__media" data-reveal="clip">
        <img src="assets/img/scenes/band-verde.jpg" width="2000" height="900"
             loading="lazy" decoding="async" data-parallax="0.1"
             alt="Verde Guatemala doğal taş yüzey">
        <div class="float-card glass glass--spectral">
          <span class="eyebrow">Plaka Seçimi</span>
          <p style="font-size:var(--step--1);color:var(--stone-300);margin-top:0.4rem">
            Vurgu yüzeylerinde plakayı bizzat seçmenizi öneriyoruz.</p>
        </div>
      </div>
      <div class="split__body">
        <span class="eyebrow" data-reveal="fade">Yaklaşımımız</span>
        <h2 data-reveal>Katalogdan değil,<br><span class="italic-accent">plakadan</span> seçin</h2>
        <div class="flow" data-reveal data-reveal-delay="0.08">
          <p class="muted">Doğal taşta iki plaka asla birbirinin aynısı değildir. Bu yüzden
          özellikle vurgu duvarları, tezgâhlar ve kitap açılımı uygulamalarında seçimin
          fotoğraf üzerinden değil, plakanın kendisi üzerinden yapılmasını öneriyoruz.</p>
          <p class="muted">Depomuzu ziyaret edebilir, numaralandırılmış plaka fotoğraflarını
          talep edebilir ya da ekibimizin sizin adınıza seçim yapmasını isteyebilirsiniz.
          Hangi yolu seçerseniz seçin, sevkiyattan önce onayınızı alırız.</p>
        </div>
        <div data-reveal data-reveal-delay="0.16">{btn("Numune talep edin", "iletisim.html", "gold")}</div>
      </div>
    </div>
  </div>
</section>

{sec_cta(depth, title="Bir sonraki projenizde birlikte çalışalım",
         image="band-emperador")}
"""

    page(path="hakkimizda.html",
         title="Hakkımızda — %s" % SITE["name"],
         description="Winner Marble; 20 yılı aşkın deneyimi, lüks mermer konusunda "
                     "uzmanlaşmış ekibi ve dünya çapındaki tedarik ağıyla doğal taş çözümleri sunar.",
         body=body, depth=depth, current="hakkimizda.html",
         og_image="assets/img/scenes/hero-portoro.jpg")


def build_collection_index():
    depth = 0
    filters = '<button class="swatch is-active" data-filter="all" aria-pressed="true">Tümü</button>'
    filters += "".join(
        '<button class="swatch" data-filter="%s" aria-pressed="false">%s</button>'
        % (c["key"], e(c["name"])) for c in CATEGORIES
    )
    cards = "".join(stone_card(s, depth) for s in STONES)

    body = f"""
{sec_page_hero(eyebrow="Koleksiyon", title="Taş koleksiyonumuz",
               sub=f"{len(STONES)} doğal taş çeşidi, {len(CATEGORIES)} koleksiyon. "
                   "Filtreleyerek projenize uygun olanı bulun.",
               image="hero-calacatta", depth=depth, crumbs=[("Koleksiyon", None)])}

<!-- ================= Bölüm: Filtre ================= -->
<section class="section section--tight" id="filtre">
  <div class="shell">
    <div class="swatch-row" data-filter-bar data-reveal="fade">{filters}</div>
  </div>
</section>

<!-- ================= Bölüm: Taş ızgarası ================= -->
<section class="section section--flush-top" id="tasla">
  <div class="shell">
    <div class="grid grid-4" data-filter-grid data-reveal-stagger="0.05">{cards}</div>
  </div>
</section>

<!-- ================= Bölüm: Kategoriler ================= -->
{sec_categories(depth)}
{sec_cta(depth)}
"""

    page(path="koleksiyon.html",
         title="Koleksiyon — %s" % SITE["name"],
         description="Beyaz mermer, siyah mermer, bej ve kahve mermer, traverten, oniks "
                     "ve egzotik doğal taş koleksiyonumuzun tamamı.",
         body=body, depth=depth, current="koleksiyon.html")


def build_category_pages():
    depth = 1
    for cat in CATEGORIES:
        stones = stones_in(cat["key"])
        cards = "".join(stone_card(s, depth) for s in stones)

        others = "".join(
            '<a class="swatch" href="%s.html">%s</a>' % (c["slug"], e(c["name"]))
            for c in CATEGORIES if c["key"] != cat["key"]
        )

        body = f"""
{sec_page_hero(eyebrow="Koleksiyon", title=cat["name"], sub=cat["intro"],
               image=cat["hero"], depth=depth,
               crumbs=[("Koleksiyon", "koleksiyon.html"), (cat["name"], None)])}

<!-- ================= Bölüm: Tanıtım ================= -->
<section class="section section--tight" id="tanitim">
  <div class="shell shell--narrow">
    <p class="lede" data-reveal>{e(cat["desc"])}</p>
  </div>
</section>

<!-- ================= Bölüm: Taşlar ================= -->
<section class="section section--flush-top" id="tasla">
  <div class="shell">
    <div class="section-head">
      <span class="eyebrow" data-reveal="fade">{len(stones)} çeşit</span>
      <h2 data-reveal>{e(cat["name"])} seçenekleri</h2>
    </div>
    <div class="grid grid-3" data-reveal-stagger="0.07">{cards}</div>
  </div>
</section>

<!-- ================= Bölüm: Diğer koleksiyonlar ================= -->
<section class="section" id="diger">
  <div class="shell">
    <div class="rule-diamond" style="margin-bottom:2.5rem"><span></span></div>
    <div class="section-head section-head--center">
      <span class="eyebrow eyebrow--center" data-reveal="fade">Diğer koleksiyonlar</span>
    </div>
    <div class="swatch-row" style="justify-content:center" data-reveal>{others}</div>
  </div>
</section>

{sec_cta(depth, image=cat["hero"])}
"""

        page(path="koleksiyon/%s.html" % cat["slug"],
             title="%s — %s" % (cat["name"], SITE["name"]),
             description=cat["intro"],
             body=body, depth=depth, current="koleksiyon.html",
             og_image="assets/img/scenes/%s.jpg" % cat["hero"])


def build_stone_pages():
    depth = 1
    for stone in STONES:
        slug = stone["slug"]
        cat = CAT_BY_KEY[stone["category"]]
        info = STONE_INFO.get(slug, {})

        specs = [
            ("Menşe", info.get("origin", "—")),
            ("Renk & Desen", info.get("color", "—")),
            ("Koleksiyon", cat["name"]),
        ] + COMMON_SPECS

        spec_rows = "".join(
            '<tr><th scope="row">%s</th><td>%s</td></tr>' % (e(k), e(v))
            for k, v in specs
        )

        uses = "".join('<span class="swatch">%s</span>' % e(u)
                       for u in info.get("uses", []))
        finishes = "".join('<span class="swatch">%s</span>' % e(f) for f in FINISHES)

        siblings = [s for s in stones_in(stone["category"]) if s["slug"] != slug][:3]
        if len(siblings) < 3:
            extra = [s for s in STONES if s["slug"] != slug and s not in siblings]
            siblings += extra[:3 - len(siblings)]
        rel_cards = "".join(stone_card(s, depth,
                                       sizes="(max-width:680px) 88vw, 30vw") for s in siblings)

        body = f"""
<!-- ================= Bölüm: Ürün başlığı ================= -->
<section class="section" id="urun" style="padding-top:150px">
  <div class="shell">
    <nav class="breadcrumb" aria-label="Sayfa yolu" data-reveal="fade">
      <a href="../index.html">Ana Sayfa</a>
      <span class="breadcrumb__sep">/</span>
      <a href="../koleksiyon.html">Koleksiyon</a>
      <span class="breadcrumb__sep">/</span>
      <a href="../koleksiyon/{cat['slug']}.html">{e(cat['name'])}</a>
      <span class="breadcrumb__sep">/</span>
      <span>{e(stone['name'])}</span>
    </nav>

    <div class="stone-detail" style="margin-top:2.5rem">
      <div data-reveal="clip">
        <div class="stone-viewer" data-scene="stone"
             data-texture="../assets/img/stones/{slug}.jpg"
             role="img" aria-label="{e(stone['name'])} plakasının 3B önizlemesi">
          <span class="stone-viewer__hint chip"><span class="chip__dot"></span>Sürükleyerek çevirin</span>
        </div>
        <div class="stone-gallery">
          <img src="../assets/img/stones/{slug}.jpg" width="1120" height="1400"
               loading="lazy" decoding="async" alt="{e(stone['name'])} plaka görünümü">
          <img src="../assets/img/stones/{slug}-sm.jpg" width="560" height="700"
               loading="lazy" decoding="async" alt="{e(stone['name'])} yakın doku">
          <img src="../assets/img/scenes/{cat['hero']}.jpg" width="2200" height="1240"
               loading="lazy" decoding="async" alt="{e(cat['name'])} koleksiyonundan bir yüzey">
        </div>
      </div>

      <div class="split__body">
        <span class="eyebrow" data-reveal="fade">{e(cat['name'])}</span>
        <h1 data-reveal style="font-size:var(--step-4)">{e(stone['name'])}</h1>
        <p class="lede" data-reveal data-reveal-delay="0.06">{e(info.get('blurb', ''))}</p>

        <div data-reveal data-reveal-delay="0.1">
          <p class="footer-col__title" style="margin-bottom:0.8rem">Kullanım alanları</p>
          <div class="swatch-row">{uses}</div>
        </div>

        <div data-reveal data-reveal-delay="0.14">
          <p class="footer-col__title" style="margin-bottom:0.8rem">Yüzey işlemleri</p>
          <div class="swatch-row">{finishes}</div>
        </div>

        <div style="display:flex;gap:0.8rem;flex-wrap:wrap;margin-top:0.6rem" data-reveal data-reveal-delay="0.18">
          {btn("Numune İsteyin", "../iletisim.html", "gold")}
          {btn("Fiyat Teklifi", "../iletisim.html", "ghost")}
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ================= Bölüm: Taşın hikâyesi ================= -->
<section class="section" id="hikaye">
  <div class="shell">
    <div class="split">
      <div class="split__body">
        <span class="eyebrow" data-reveal="fade">Taşın hikâyesi</span>
        <h2 data-reveal>{e(stone['name'])} hakkında</h2>
        <p class="muted" data-reveal data-reveal-delay="0.08">{e(info.get('story', ''))}</p>
      </div>
      <div class="split__media" data-reveal="clip">
        <img src="../assets/img/stones/{slug}.jpg" width="1120" height="1400"
             loading="lazy" decoding="async" data-parallax="0.1"
             alt="{e(stone['name'])} damar dokusu" style="aspect-ratio:auto">
      </div>
    </div>
  </div>
</section>

<!-- ================= Bölüm: Teknik bilgiler ================= -->
<section class="section" id="teknik">
  <div class="shell shell--narrow">
    <div class="section-head">
      <span class="eyebrow" data-reveal="fade">Teknik</span>
      <h2 data-reveal>Ürün bilgileri</h2>
    </div>
    <table class="spec-table" data-reveal>
      <caption class="sr-only">{e(stone['name'])} teknik özellikleri</caption>
      <tbody>{spec_rows}</tbody>
    </table>
    <p class="form__note" style="margin-top:1.2rem">
      Ebat, kalınlık ve yüzey işlemi projeye göre özelleştirilebilir.
      Stok durumu ve güncel fiyat için lütfen bizimle iletişime geçin.</p>
  </div>
</section>

<!-- ================= Bölüm: Benzer taşlar ================= -->
<section class="section" id="benzer">
  <div class="shell">
    <div class="section-head">
      <span class="eyebrow" data-reveal="fade">Benzer taşlar</span>
      <h2 data-reveal>Bunlar da ilginizi çekebilir</h2>
    </div>
    <div class="grid grid-3" data-reveal-stagger="0.08">{rel_cards}</div>
  </div>
</section>

{sec_cta(depth, title=f"{stone['name']} için teklif alın",
         text="Metraj, kalınlık ve yüzey işlemi bilgilerinizi iletin; "
              "size özel fiyat çalışmasını hazırlayalım.",
         image=cat["hero"])}
"""

        page(path="urunler/%s.html" % slug,
             title="%s — %s | %s" % (stone["name"], cat["name"], SITE["name"]),
             description=info.get("blurb", "%s doğal taş." % stone["name"]),
             body=body, depth=depth, current="koleksiyon.html", scene=True,
             og_image="assets/img/stones/%s.jpg" % slug)


def build_applications():
    depth = 0
    blocks = []
    for i, a in enumerate(APPLICATIONS):
        points = "".join('<span class="swatch">%s</span>' % e(p) for p in a["points"])
        reverse = " split--reverse" if i % 2 else ""
        blocks.append(f"""
<section class="section" id="{a['slug']}">
  <div class="shell">
    <div class="split{reverse}">
      <div class="split__media" data-reveal="clip">
        <img src="assets/img/stones/{a['img']}.jpg"
             srcset="assets/img/stones/{a['img']}-sm.jpg 560w, assets/img/stones/{a['img']}.jpg 1120w"
             sizes="(max-width:860px) 92vw, 46vw"
             width="1120" height="1400" loading="lazy" decoding="async"
             data-parallax="0.1" alt="{e(a['title'])} uygulaması için doğal taş">
      </div>
      <div class="split__body">
        <span class="section-index" data-reveal="fade">0{i + 1}</span>
        <h2 data-reveal>{e(a['title'])}</h2>
        <p class="muted" data-reveal data-reveal-delay="0.08">{e(a['text'])}</p>
        <div class="swatch-row" data-reveal data-reveal-delay="0.14">{points}</div>
      </div>
    </div>
  </div>
</section>""")

    body = f"""
{sec_page_hero(eyebrow="Uygulamalar", title="Taşın yaşadığı yerler",
               sub="Mutfaktan cepheye, ışıklı panellerden merdivene: her uygulamanın "
                   "kendi teknik gereklilikleri vardır.",
               image="band-emperador", depth=depth, crumbs=[("Uygulamalar", None)])}

{"".join(blocks)}

{sec_cta(depth, title="Uygulamanıza uygun taşı seçelim",
         text="Projenizin kullanım alanını ve metrajını iletin; teknik olarak "
              "uygun taş seçeneklerini birlikte değerlendirelim.")}
"""

    page(path="uygulamalar.html",
         title="Uygulama Alanları — %s" % SITE["name"],
         description="Mutfak tezgâhı, banyo, zemin, dış cephe, merdiven ve arkadan "
                     "aydınlatmalı panel uygulamalarında doğal taş çözümleri.",
         body=body, depth=depth, current="uygulamalar.html",
         og_image="assets/img/scenes/band-emperador.jpg")


def build_process():
    depth = 0
    body = f"""
{sec_page_hero(eyebrow="Üretim", title="Ocaktan mekâna",
               sub="Bir bloğun plakaya, plakanın mekâna dönüşene kadar geçtiği "
                   "yedi aşama.",
               image="band-traverten", depth=depth, crumbs=[("Üretim", None)])}

{sec_process(depth)}

<!-- ================= Bölüm: Kalite ================= -->
<section class="section" id="kalite">
  <div class="shell">
    <div class="split split--reverse">
      <div class="split__media" data-reveal="clip">
        <img src="assets/img/scenes/band-nero.jpg" width="2000" height="900"
             loading="lazy" decoding="async" data-parallax="0.1"
             alt="Cilalı siyah mermer yüzey">
        <div class="float-card glass glass--spectral">
          <span class="eyebrow">Kontrol</span>
          <p style="font-size:var(--step--1);color:var(--stone-300);margin-top:0.4rem">
            Her plaka tek tek denetlenir; onaylanmayan plaka sevk edilmez.</p>
        </div>
      </div>
      <div class="split__body">
        <span class="eyebrow" data-reveal="fade">Kalite Güvencesi</span>
        <h2 data-reveal>Onaylanmayan plaka<br><span class="italic-accent">yola çıkmaz</span></h2>
        <div class="flow" data-reveal data-reveal-delay="0.08">
          <p class="muted">Ton farkı, kalınlık toleransı, yüzey kusuru ve ebat sapması;
          dördü de sevkiyat öncesi tek tek kontrol edilir. Aynı projeye giden plakaların
          mümkün olduğunca aynı bloktan seçilmesi, uygulamada renk bütünlüğünü garantiler.</p>
          <p class="muted">Doğal boşluklar epoksi ile doldurulur ve gerektiğinde arka
          yüzeye file takviyesi yapılır. Bu işlem, özellikle oniks gibi kırılgan taşlarda
          nakliye ve montaj güvenliğini sağlar.</p>
        </div>
      </div>
    </div>
  </div>
</section>

{sec_stats(depth)}
{sec_cta(depth, title="Üretim sürecimizi yerinde görün",
         text="Depomuzu ziyaret ederek blokları ve plakaları yerinde inceleyebilir, "
              "projeniz için seçim yapabilirsiniz.", image="band-traverten")}
"""

    page(path="uretim.html",
         title="Üretim Süreci — %s" % SITE["name"],
         description="Ocak seçiminden sevkiyata kadar mermer üretim sürecimizin "
                     "yedi aşaması ve kalite kontrol yaklaşımımız.",
         body=body, depth=depth, current="uretim.html",
         og_image="assets/img/scenes/band-traverten.jpg")


def build_projects():
    depth = 0
    cards = "".join(
        '<article class="stone-card shimmer" style="display:block" data-reveal>'
        '<span class="stone-card__media" style="aspect-ratio:4/3">'
        '<img class="stone-card__img" src="assets/img/scenes/%s.jpg" width="2000" height="1200" '
        'loading="lazy" decoding="async" alt="%s — %s">'
        '<span class="stone-card__glow"></span></span>'
        '<span class="stone-card__body"><span>'
        '<span class="stone-card__name">%s</span>'
        '<span class="stone-card__meta">%s · %s</span>'
        '<span class="muted" style="display:block;margin-top:0.6rem;font-size:var(--step--1)">%s</span>'
        '<span class="chip chip--gold" style="margin-top:0.9rem">%s</span>'
        '</span></span></article>'
        % (p["img"], e(p["title"]), e(p["place"]), e(p["title"]), e(p["place"]),
           e(p["year"]), e(p["scope"]), e(p["stone"]))
        for p in PROJECTS
    )

    body = f"""
{sec_page_hero(eyebrow="Referanslar", title="Projelerimiz",
               sub="Konuttan otele, showroom'dan kurumsal merkeze; taşımızın "
                   "yaşadığı mekânlardan bir seçki.",
               image="bookmatch-portoro-gold", depth=depth, crumbs=[("Projeler", None)])}

<!-- ================= Bölüm: Proje ızgarası ================= -->
<section class="section" id="liste">
  <div class="shell">
    <div class="grid grid-2" data-reveal-stagger="0.09">{cards}</div>
  </div>
</section>

{sec_stats(depth)}

<!-- ================= Bölüm: Alıntı ================= -->
<section class="section" id="alinti">
  <div class="shell shell--narrow">
    <div class="quote" data-reveal>
      <span class="quote__mark">&ldquo;</span>
      <p class="quote__text">Doğru taş, mekânın hikâyesini anlatmaya yıllar sonra
      bile devam eder.</p>
      <span class="quote__by">Winner Marble</span>
    </div>
  </div>
</section>

{sec_cta(depth, title="Projenizi birlikte hayata geçirelim", image="hero-onyx")}
"""

    page(path="projeler.html",
         title="Projeler — %s" % SITE["name"],
         description="Winner Marble'ın yurt içi ve yurt dışında tamamladığı "
                     "doğal taş projelerinden referanslar.",
         body=body, depth=depth, current="projeler.html",
         og_image="assets/img/scenes/bookmatch-portoro-gold.jpg")


def build_contact():
    depth = 0
    stone_options = "".join(
        '<option value="%s">%s</option>' % (e(s["name"]), e(s["name"])) for s in STONES
    )

    body = f"""
{sec_page_hero(eyebrow="İletişim", title="Konuşalım",
               sub="Numune talebi, plaka seçimi ya da fiyat teklifi — hangisi olursa "
                   "olsun size 24 saat içinde dönüş yapıyoruz.",
               image="hero-onyx", depth=depth, crumbs=[("İletişim", None)])}

<!-- ================= Bölüm: Form ve bilgiler ================= -->
<section class="section" id="form">
  <div class="shell">
    <div class="split" style="align-items:start">
      <div class="split__body">
        <span class="eyebrow" data-reveal="fade">Teklif Formu</span>
        <h2 data-reveal>Projenizi anlatın</h2>
        <form class="form" data-contact-form data-reveal data-reveal-delay="0.08"
              method="post" action="form-handler.php" novalidate>
          <div class="form__row">
            <label class="field"><span class="field__label">Ad Soyad *</span>
              <input type="text" name="name" required autocomplete="name" placeholder="Adınız ve soyadınız"></label>
            <label class="field"><span class="field__label">E-posta *</span>
              <input type="email" name="email" required autocomplete="email" placeholder="ornek@sirket.com"></label>
          </div>
          <div class="form__row">
            <label class="field"><span class="field__label">Telefon</span>
              <input type="tel" name="phone" autocomplete="tel" placeholder="+90 ..."></label>
            <label class="field"><span class="field__label">İlgilendiğiniz taş</span>
              <select name="subject">
                <option value="">Seçiniz (opsiyonel)</option>
                {stone_options}
                <option value="Diğer">Diğer / Emin değilim</option>
              </select></label>
          </div>
          <label class="field"><span class="field__label">Mesajınız *</span>
            <textarea name="message" required
              placeholder="Proje türü, uygulama alanı, yaklaşık metraj ve teslim tarihi gibi bilgiler teklifi hızlandırır."></textarea></label>

          <!-- Bot tuzağı: gerçek kullanıcılar bu alanı görmez -->
          <div class="sr-only" aria-hidden="true">
            <label>Web sitesi <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
          </div>

          <div class="form__status" role="status" aria-live="polite"></div>
          <p class="form__note">* ile işaretli alanlar zorunludur. Bilgileriniz yalnızca
          talebinizi yanıtlamak için kullanılır.</p>
          <button class="btn btn--gold" type="submit">
            <span class="btn__label">Gönder</span>{ICON['arrow']}</button>
        </form>
      </div>

      <div class="split__body">
        <div class="glass glass--spectral" style="padding:2rem" data-reveal="right">
          <span class="eyebrow">İletişim Bilgileri</span>
          <div style="margin-top:1.5rem">
            <div class="contact-row">{ICON['mail']}
              <div><p class="contact-row__label">E-posta</p>
                <a href="mailto:{e(SITE['email'])}">{e(SITE['email'])}</a><br>
                <a href="mailto:{e(SITE['email_sales'])}">{e(SITE['email_sales'])}</a></div></div>
            <div class="contact-row">{ICON['phone']}
              <div><p class="contact-row__label">Telefon</p>
                <a href="tel:{e(SITE['phone_href'])}">{e(SITE['phone'])}</a></div></div>
            <div class="contact-row">{ICON['pin']}
              <div><p class="contact-row__label">Adres</p>
                <span>{e(SITE['address_line1'])}<br>{e(SITE['address_line2'])}</span></div></div>
            <div class="contact-row" style="border-bottom:0">{ICON['clock']}
              <div><p class="contact-row__label">Çalışma Saatleri</p>
                <span>{e(SITE['hours'])}</span></div></div>
          </div>
        </div>

        <div class="glass" style="padding:1.8rem;margin-top:1.2rem" data-reveal="right" data-reveal-delay="0.1">
          <h3 style="font-size:var(--step-1)">Numune gönderimi</h3>
          <p class="muted" style="margin-top:0.7rem;font-size:var(--step--1)">
            İlgilendiğiniz taşları formda belirtmeniz hâlinde yurt içi ve yurt dışına
            numune gönderimi yapıyoruz. Numuneler 10×10 cm ebadında ve cilalı yüzeylidir.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ================= Bölüm: SSS kısayolu ================= -->
<section class="section" id="sss-kisayol">
  <div class="shell shell--narrow">
    <div class="rule-diamond" style="margin-bottom:2.5rem"><span></span></div>
    <div class="section-head section-head--center">
      <span class="eyebrow eyebrow--center" data-reveal="fade">Yardım</span>
      <h2 data-reveal>Aklınızda soru mu var?</h2>
      <p class="muted" data-reveal data-reveal-delay="0.08">Numune, plaka seçimi, teslim
      süresi ve ihracat evrakları hakkında en sık sorulanları derledik.</p>
      <div data-reveal data-reveal-delay="0.14">{btn("Sıkça Sorulan Sorular", "sss.html", "ghost")}</div>
    </div>
  </div>
</section>
"""

    page(path="iletisim.html",
         title="İletişim — %s" % SITE["name"],
         description="Numune talebi, plaka seçimi ve fiyat teklifi için Winner Marble "
                     "ile iletişime geçin.",
         body=body, depth=depth, current="iletisim.html",
         og_image="assets/img/scenes/hero-onyx.jpg")


def build_faq():
    depth = 0
    items = "".join(
        '<div class="acc-item"><button class="acc-trigger" type="button">'
        '<span>%s</span><span class="acc-icon" aria-hidden="true"></span></button>'
        '<div class="acc-panel"><div class="acc-panel__inner">%s</div></div></div>'
        % (e(q), e(a)) for q, a in FAQ
    )

    faq_ld = ",".join(
        '{"@type":"Question","name":"%s","acceptedAnswer":{"@type":"Answer","text":"%s"}}'
        % (q.replace('"', "'"), a.replace('"', "'")) for q, a in FAQ
    )

    body = f"""
{sec_page_hero(eyebrow="Yardım", title="Sıkça sorulan sorular",
               sub="Numune, plaka seçimi, bakım ve sevkiyat hakkında en çok "
                   "merak edilenler.",
               image="band-nero", depth=depth, crumbs=[("SSS", None)])}

<!-- ================= Bölüm: Sorular ================= -->
<section class="section" id="sorular">
  <div class="shell shell--narrow">
    <div class="accordion" data-reveal>{items}</div>
  </div>
</section>

{sec_cta(depth, title="Cevabını bulamadınız mı?",
         text="Sorunuzu doğrudan bize iletin; ekibimiz kısa sürede yanıtlasın.",
         image="band-nero")}

<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{faq_ld}]}}
</script>
"""

    page(path="sss.html",
         title="Sıkça Sorulan Sorular — %s" % SITE["name"],
         description="Numune talebi, plaka seçimi, bookmatch, yüzey işlemleri, teslim "
                     "süresi ve ihracat evrakları hakkında sık sorulan sorular.",
         body=body, depth=depth, current="", og_image="assets/img/scenes/band-nero.jpg")


def build_care():
    depth = 0
    tiles = "".join(
        '<div class="tile"><span class="tile__num">0%d</span>%s'
        '<h3 class="tile__title">%s</h3><p class="muted">%s</p></div>'
        % (i + 1, tile_icon(i), e(c["title"]), e(c["text"]))
        for i, c in enumerate(CARE)
    )

    body = f"""
{sec_page_hero(eyebrow="Rehber", title="Mermer bakım rehberi",
               sub="Doğru bakımla mermer, ilk günkü parlaklığını on yıllar boyunca korur.",
               image="hero-calacatta", depth=depth, crumbs=[("Mermer Bakımı", None)])}

<!-- ================= Bölüm: Bakım adımları ================= -->
<section class="section" id="adimlar">
  <div class="shell">
    <div class="grid grid-3" data-reveal-stagger="0.08">{tiles}</div>
  </div>
</section>

<!-- ================= Bölüm: Uyarı ================= -->
<section class="section" id="uyari">
  <div class="shell shell--narrow">
    <div class="glass glass--gold glass--spectral" style="padding:2rem" data-reveal>
      <span class="eyebrow">Önemli</span>
      <p class="lede" style="margin-top:1rem">Mermer asidik maddelere karşı hassastır.
      Limon, sirke, şarap ve asit içeren temizleyiciler yüzeyde kalıcı matlık
      (etching) bırakabilir.</p>
      <p class="muted" style="margin-top:1rem">Dökülen sıvılara hemen müdahale edin ve
      silmek yerine emdirerek alın. Yüzeyi ovmak lekeyi yaymaktan başka işe yaramaz.</p>
    </div>
  </div>
</section>

{sec_cta(depth, title="Bakım ürünü ve uygulama desteği",
         text="Emprenye, cila yenileme ve leke müdahalesi konularında ekibimizden "
              "destek alabilirsiniz.")}
"""

    page(path="bakim.html",
         title="Mermer Bakım Rehberi — %s" % SITE["name"],
         description="Mermer temizliği, emprenye, leke müdahalesi ve cila yenileme "
                     "hakkında pratik bakım rehberi.",
         body=body, depth=depth, current="")


def build_404():
    depth = 0
    body = f"""
<section class="section" id="bulunamadi" style="padding-top:180px;min-height:70vh;display:grid;place-items:center">
  <div class="shell shell--narrow" style="text-align:center">
    <span class="eyebrow eyebrow--center">404</span>
    <h1 style="margin-top:1.2rem">Aradığınız sayfa<br><span class="italic-accent">bulunamadı</span></h1>
    <p class="lede" style="margin-top:1.2rem">Bağlantı taşınmış ya da hiç var olmamış olabilir.
    Koleksiyona göz atarak devam edebilirsiniz.</p>
    <div style="display:flex;gap:0.9rem;justify-content:center;flex-wrap:wrap;margin-top:2rem">
      {btn("Ana Sayfa", "index.html", "gold")}
      {btn("Koleksiyon", "koleksiyon.html", "ghost")}
    </div>
  </div>
</section>
"""
    page(path="404.html", title="Sayfa Bulunamadı — %s" % SITE["name"],
         description="Aradığınız sayfa bulunamadı.", body=body, depth=depth, current="")


# ===========================================================================
# Yardımcı dosyalar
# ===========================================================================
def build_extras():
    today = date.today().isoformat()
    urls = ["index.html", "hakkimizda.html", "koleksiyon.html", "uygulamalar.html",
            "uretim.html", "projeler.html", "iletisim.html", "sss.html", "bakim.html"]
    urls += ["koleksiyon/%s.html" % c["slug"] for c in CATEGORIES]
    urls += ["urunler/%s.html" % s["slug"] for s in STONES]

    entries = "".join(
        "  <url><loc>%s/%s</loc><lastmod>%s</lastmod>"
        "<changefreq>monthly</changefreq><priority>%s</priority></url>\n"
        % (SITE["url"].rstrip("/"), u, today, "1.0" if u == "index.html" else "0.7")
        for u in urls
    )
    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n'
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                + entries + '</urlset>\n')
    print("  -> sitemap.xml")

    with open(os.path.join(ROOT, "robots.txt"), "w", encoding="utf-8") as f:
        f.write("User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n"
                % SITE["url"].rstrip("/"))
    print("  -> robots.txt")

    # Basit marka favicon'u
    fav = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">'
           '<rect width="40" height="40" fill="#08080a"/>'
           '<path d="M20 4 36 20 20 36 4 20 20 4Z" fill="none" stroke="#c9a44c" stroke-width="1.6"/>'
           '<path d="M20 16.5 23.5 20 20 23.5 16.5 20 20 16.5Z" fill="#c9a44c"/></svg>')
    with open(os.path.join(ROOT, "assets", "img", "favicon.svg"), "w", encoding="utf-8") as f:
        f.write(fav)
    print("  -> assets/img/favicon.svg")


def main():
    print("Sayfalar üretiliyor...")
    build_home()
    build_about()
    build_collection_index()
    build_category_pages()
    build_stone_pages()
    build_applications()
    build_process()
    build_projects()
    build_contact()
    build_faq()
    build_care()
    build_404()
    print("\nYardımcı dosyalar...")
    build_extras()
    print("\nTamamlandı.")


if __name__ == "__main__":
    main()
