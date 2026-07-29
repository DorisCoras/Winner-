#!/usr/bin/env python3
"""
Google Fonts'tan gerekli yazı tiplerini indirip yerelleştirir.

Site hiçbir dış kaynağa bağlı kalmasın diye woff2 dosyaları
assets/fonts altına indirilir ve yerel bir @font-face css'i yazılır.
Türkçe karakterler için latin + latin-ext alt kümeleri alınır.
"""

import os
import re
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, "assets", "fonts")
CSS_OUT = os.path.join(ROOT, "assets", "css", "fonts.css")

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

SPEC = ("https://fonts.googleapis.com/css2"
        "?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400"
        "&family=Jost:wght@300;400;500;600"
        "&display=swap")

WANTED_SUBSETS = {"latin", "latin-ext"}


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    return data if binary else data.decode("utf-8")


def main():
    os.makedirs(FONT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(CSS_OUT), exist_ok=True)

    css = fetch(SPEC)

    # Google Fonts css'i "/* subset */" yorumlarıyla bloklara ayrılmış gelir
    blocks = re.split(r"/\*\s*([a-z0-9\-]+)\s*\*/", css)
    out = ["/* Winner Marble - yerel yazı tipleri (Google Fonts, OFL) */\n"]
    seen = {}

    i = 1
    while i + 1 < len(blocks):
        subset = blocks[i].strip()
        body = blocks[i + 1]
        i += 2
        if subset not in WANTED_SUBSETS:
            continue

        m_fam = re.search(r"font-family:\s*'([^']+)'", body)
        m_wt = re.search(r"font-weight:\s*(\d+)", body)
        m_st = re.search(r"font-style:\s*(\w+)", body)
        m_url = re.search(r"src:\s*url\((https://[^)]+\.woff2)\)", body)
        m_range = re.search(r"unicode-range:\s*([^;]+);", body)
        if not (m_fam and m_url):
            continue

        fam = m_fam.group(1)
        weight = m_wt.group(1) if m_wt else "400"
        style = m_st.group(1) if m_st else "normal"
        url = m_url.group(1)

        slug = fam.lower().replace(" ", "-")
        name = f"{slug}-{weight}{'-italic' if style == 'italic' else ''}-{subset}.woff2"
        path = os.path.join(FONT_DIR, name)

        if name not in seen:
            print(f"indiriliyor: {name}")
            data = fetch(url, binary=True)
            with open(path, "wb") as f:
                f.write(data)
            seen[name] = len(data)

        rng = m_range.group(1).strip() if m_range else ""
        out.append(
            "@font-face {\n"
            f"  font-family: '{fam}';\n"
            f"  font-style: {style};\n"
            f"  font-weight: {weight};\n"
            "  font-display: swap;\n"
            f"  src: url('../fonts/{name}') format('woff2');\n"
            + (f"  unicode-range: {rng};\n" if rng else "")
            + "}\n"
        )

    with open(CSS_OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(out))

    total = sum(seen.values()) / 1024
    print(f"\n{len(seen)} dosya, toplam {total:.0f} KB")
    print(f"CSS: {os.path.relpath(CSS_OUT, ROOT)}")


if __name__ == "__main__":
    main()
