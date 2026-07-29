#!/usr/bin/env python3
"""
Winner Marble - prosedürel doğal taş görsel üretici.

Her taş çeşidi için yüksek çözünürlüklü, fotogerçekçiye yakın plaka
görselleri üretir. Tüm görseller yerel olarak üretildiği için lisans
sorunu yoktur ve istenildiği zaman yeniden üretilebilir.

Kullanım:
    python3 tools/generate_textures.py
"""

import math
import os

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_STONES = os.path.join(ROOT, "assets", "img", "stones")
OUT_SCENES = os.path.join(ROOT, "assets", "img", "scenes")
OUT_TEX = os.path.join(ROOT, "assets", "img", "tex")

# Süper örnekleme çarpanı (kenar yumuşatma için yüksek render, sonra küçültme)
SS = 1.6


# --------------------------------------------------------------------------
# Gürültü altyapısı
# --------------------------------------------------------------------------
def _perlin_field(Y, X, g, rng):
    """
    Periyodik gradyan (Perlin) gürültüsü. Y ve X ızgara birimindedir.
    Değer gürültüsünün aksine eksene hizalı ızgara izi bırakmaz.
    """
    g = max(2, int(g))
    ang = (rng.random((g, g)).astype(np.float32) * (2.0 * np.pi))
    gx = np.cos(ang)
    gy = np.sin(ang)

    y0 = np.floor(Y).astype(np.int32)
    x0 = np.floor(X).astype(np.int32)
    fy = (Y - y0).astype(np.float32)
    fx = (X - x0).astype(np.float32)

    y0m = np.mod(y0, g)
    x0m = np.mod(x0, g)
    y1m = np.mod(y0 + 1, g)
    x1m = np.mod(x0 + 1, g)

    n00 = gy[y0m, x0m] * fy + gx[y0m, x0m] * fx
    n01 = gy[y0m, x1m] * fy + gx[y0m, x1m] * (fx - 1.0)
    n10 = gy[y1m, x0m] * (fy - 1.0) + gx[y1m, x0m] * fx
    n11 = gy[y1m, x1m] * (fy - 1.0) + gx[y1m, x1m] * (fx - 1.0)

    u = fx * fx * fx * (fx * (fx * 6.0 - 15.0) + 10.0)
    v = fy * fy * fy * (fy * (fy * 6.0 - 15.0) + 10.0)

    nx0 = n00 + u * (n01 - n00)
    nx1 = n10 + u * (n11 - n10)
    return nx0 + v * (nx1 - nx0)


def fbm(h, w, rng, base=4, octaves=6, persistence=0.5, lacunarity=2.0):
    """
    Fraktal Brown hareketi. Her oktav rastgele döndürülür; böylece
    oktavlar üst üste binerken yön yanlılığı ve ızgara izi oluşmaz.
    """
    ar = w / float(h)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    yy /= h
    xx /= w
    xx *= ar  # en-boy oranını koru, dokunun esnemesini engelle

    total = np.zeros((h, w), dtype=np.float32)
    amp = 1.0
    norm = 0.0
    freq = float(base)
    for _ in range(octaves):
        a = float(rng.random()) * 2.0 * np.pi
        ca, sa = math.cos(a), math.sin(a)
        ox = float(rng.random()) * 32.0
        oy = float(rng.random()) * 32.0

        rx = (xx * ca - yy * sa) * freq + ox
        ry = (xx * sa + yy * ca) * freq + oy

        g = max(2, int(round(freq * max(1.0, ar))) + 2)
        total += amp * _perlin_field(ry, rx, g, rng)
        norm += amp
        amp *= persistence
        freq *= lacunarity

    total /= max(norm, 1e-6)
    # Perlin yaklaşık -0.7..0.7 aralığında; 0..1'e taşı
    return np.clip(total * 0.72 + 0.5, 0.0, 1.0)


def soften(mask, radius=1.2):
    """Damar maskesini hafifçe yumuşat - neon/kenar kırılması olmasın."""
    if radius <= 0:
        return mask
    img = Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8), mode="L")
    img = img.filter(ImageFilter.GaussianBlur(radius=radius))
    return np.asarray(img, dtype=np.float32) / 255.0


def normalize(a):
    lo, hi = float(a.min()), float(a.max())
    if hi - lo < 1e-6:
        return np.zeros_like(a)
    return (a - lo) / (hi - lo)


def smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / max(edge1 - edge0, 1e-6), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


# --------------------------------------------------------------------------
# Damar üretimi
# --------------------------------------------------------------------------
def vein_layer(h, w, rng, angle_deg, freq, warp, sharpness, octaves=6, base=3):
    """
    Alan bükmeli (domain warping) sinüs bandı ile keskin damar hatları üretir.
    Dönen değer 0..1 arası, 1 = damarın merkezi.
    """
    ar = w / float(h)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    xx = xx / w * ar
    yy = yy / h

    a = math.radians(angle_deg)
    proj = xx * math.cos(a) + yy * math.sin(a)

    turb = fbm(h, w, rng, base=base, octaves=octaves, persistence=0.55)
    turb2 = fbm(h, w, rng, base=base * 2, octaves=max(2, octaves - 1), persistence=0.5)

    field = proj * freq + (turb - 0.5) * warp + (turb2 - 0.5) * warp * 0.35
    band = np.abs(np.sin(field * math.pi))
    ridge = np.clip(1.0 - band, 0.0, 1.0) ** sharpness

    # Damar kenarlarını yumuşat; ölçek arttıkça yumuşama azalsın
    return soften(ridge, radius=max(0.6, 2.0 - freq * 0.05))


def crackle(h, w, rng, freq, warp, sharpness):
    """
    İnce kılcal çatlak ağı. Bükme miktarı frekansla ölçeklenir; aksi halde
    iki damar kümesi düzenli bir kafes deseni oluşturur (doğal görünmez).
    Çatlaklar ayrıca yamalar halinde dağıtılır.
    """
    a1 = float(rng.uniform(0.0, 180.0))
    a2 = a1 + float(rng.uniform(52.0, 128.0))
    wp = warp * freq * 0.34

    a = vein_layer(h, w, rng, a1, freq * 0.55, wp, sharpness, octaves=6, base=4)
    b = vein_layer(h, w, rng, a2, freq * 0.72, wp * 1.15, sharpness, octaves=6, base=4)
    net = np.maximum(a, b)

    # Çatlaklar taşın her yerinde eşit yoğunlukta olmaz
    patch = smoothstep(0.40, 0.74, fbm(h, w, rng, base=4, octaves=4, persistence=0.6))
    return net * patch


def voronoi_cells(h, w, rng, points, jitter=1.0):
    """Marinace / breccia için çakıl-blok deseni. F2-F1 ile hücre sınırları."""
    ar = w / float(h)
    n = points
    px = (rng.random(n).astype(np.float32)) * ar
    py = rng.random(n).astype(np.float32)

    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    xx = xx / w * ar
    yy = yy / h

    # Hafif bükme, hücrelerin organik görünmesi için
    wx = (fbm(h, w, rng, base=6, octaves=4) - 0.5) * 0.06 * jitter
    wy = (fbm(h, w, rng, base=6, octaves=4) - 0.5) * 0.06 * jitter
    xx = xx + wx
    yy = yy + wy

    best = np.full((h, w), 1e9, dtype=np.float32)
    second = np.full((h, w), 1e9, dtype=np.float32)
    ids = np.zeros((h, w), dtype=np.int32)

    for i in range(n):
        d = (xx - px[i]) ** 2 + (yy - py[i]) ** 2
        closer = d < best
        second = np.where(closer, best, np.minimum(second, d))
        ids = np.where(closer, i, ids)
        best = np.where(closer, d, best)

    edge = np.sqrt(second) - np.sqrt(best)
    return normalize(edge), ids, n


# --------------------------------------------------------------------------
# Renk eşlemesi
# --------------------------------------------------------------------------
def build_lut(stops):
    """stops: [(pozisyon 0..1, (r,g,b)), ...] -> 256x3 uint8 LUT"""
    stops = sorted(stops, key=lambda s: s[0])
    lut = np.zeros((256, 3), dtype=np.float32)
    positions = [s[0] for s in stops]
    colors = [np.array(s[1], dtype=np.float32) for s in stops]
    for i in range(256):
        t = i / 255.0
        if t <= positions[0]:
            lut[i] = colors[0]
            continue
        if t >= positions[-1]:
            lut[i] = colors[-1]
            continue
        for j in range(len(positions) - 1):
            if positions[j] <= t <= positions[j + 1]:
                span = positions[j + 1] - positions[j]
                f = 0.0 if span < 1e-6 else (t - positions[j]) / span
                lut[i] = colors[j] * (1 - f) + colors[j + 1] * f
                break
    return lut


def apply_lut(gray, lut):
    idx = np.clip((gray * 255.0), 0, 255).astype(np.uint8)
    return lut[idx]


def blend(base, color, mask):
    """mask 0..1 ile düz renk karıştırma."""
    m = mask[..., None]
    c = np.array(color, dtype=np.float32)
    return base * (1 - m) + c * m


# --------------------------------------------------------------------------
# Cilalı yüzey son işlemleri
# --------------------------------------------------------------------------
def polish(rgb, rng, h, w, sheen=0.16, grain=4.0, vignette=0.14):
    """Cila parlaklığı, ince tane ve kenar koyulaşması."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    xx /= w
    yy /= h

    # Geniş ölçekli ışık düşümü - plakanın cilalı yüzeyinde kayan parlaklık
    light = np.exp(-(((xx - 0.32) ** 2) / 0.55 + ((yy - 0.18) ** 2) / 0.9))
    sweep = 0.5 + 0.5 * np.sin((xx * 1.1 + yy * 0.55) * math.pi * 0.9)
    lightmap = 1.0 + sheen * (light * 0.75 + sweep * 0.35 - 0.35)
    rgb = rgb * lightmap[..., None]

    # Kenar koyulaşma
    r = np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2) / 0.72
    rgb = rgb * (1.0 - vignette * np.clip(r, 0, 1) ** 2.1)[..., None]

    # Taş tanesi
    if grain > 0:
        noise = rng.normal(0.0, grain, size=(h, w, 1)).astype(np.float32)
        rgb = rgb + noise

    return np.clip(rgb, 0, 255)


# --------------------------------------------------------------------------
# Taş stilleri
# --------------------------------------------------------------------------
def render_veined(h, w, spec, rng):
    """Klasik damarlı mermer (Calacatta, Statuario, Portoro, Nero Marquina...)."""
    lut = build_lut(spec["base"])

    cloud = fbm(h, w, rng, base=spec.get("cloud_base", 3), octaves=6, persistence=0.58)
    cloud = normalize(cloud)
    cloud = smoothstep(0.1, 0.9, cloud)
    rgb = apply_lut(cloud, lut)

    angle = spec.get("angle", 62)

    # Ana damarlar
    v1 = vein_layer(
        h, w, rng, angle,
        spec.get("v1_freq", 3.0),
        spec.get("v1_warp", 2.6),
        spec.get("v1_sharp", 9.0),
    )
    v1 = v1 * spec.get("v1_amt", 1.0)

    # Damar gövdesi (ana damarın etrafındaki yumuşak hale)
    halo = vein_layer(
        h, w, rng, angle,
        spec.get("v1_freq", 3.0),
        spec.get("v1_warp", 2.6),
        max(1.6, spec.get("v1_sharp", 9.0) * 0.22),
    )
    if spec.get("halo_color"):
        rgb = blend(rgb, spec["halo_color"], np.clip(halo * spec.get("halo_amt", 0.35), 0, 1))

    # İkincil ince damarlar
    v2 = vein_layer(
        h, w, rng, angle + spec.get("v2_angle_off", 14),
        spec.get("v2_freq", 9.0),
        spec.get("v2_warp", 1.5),
        spec.get("v2_sharp", 16.0),
    )
    v2 = v2 * spec.get("v2_amt", 0.6)

    # Kılcal ağ
    v3 = crackle(h, w, rng, spec.get("v3_freq", 22.0), spec.get("v3_warp", 1.0),
                 spec.get("v3_sharp", 26.0)) * spec.get("v3_amt", 0.28)

    rgb = blend(rgb, spec["vein"], np.clip(v1, 0, 1))
    if spec.get("vein2"):
        rgb = blend(rgb, spec["vein2"], np.clip(v2, 0, 1))
    else:
        rgb = blend(rgb, spec["vein"], np.clip(v2, 0, 1))
    rgb = blend(rgb, spec.get("vein3", spec["vein"]), np.clip(v3, 0, 1))

    # Altın / metalik damar aksanı
    if spec.get("accent"):
        acc = vein_layer(
            h, w, rng, angle - 8,
            spec.get("acc_freq", 5.0),
            spec.get("acc_warp", 2.2),
            spec.get("acc_sharp", 20.0),
        )
        acc = acc * spec.get("acc_amt", 0.55) * (0.35 + 0.65 * cloud)
        rgb = blend(rgb, spec["accent"], np.clip(acc, 0, 1))

    return rgb


def render_travertine(h, w, spec, rng):
    """Traverten: yatay katmanlanma ve gözenek dokusu."""
    lut = build_lut(spec["base"])

    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    xx /= w
    yy /= h

    nb = spec.get("bands", 26)
    warp = (fbm(h, w, rng, base=4, octaves=5) - 0.5) * 0.16
    warp_fine = (fbm(h, w, rng, base=14, octaves=4) - 0.5) * 0.035

    bands = 0.5 + 0.5 * np.sin((yy + warp + warp_fine) * math.pi * nb)
    bands = bands * 0.46 + fbm(h, w, rng, base=3, octaves=6, persistence=0.6) * 0.54
    bands = normalize(bands)
    rgb = apply_lut(bands, lut)

    # Katman çizgileri - traverten yatağının ince tabakalanması
    lines = np.abs(np.sin((yy + warp * 1.35 + warp_fine) * math.pi * nb))
    lines = soften((1.0 - lines) ** 10.0, radius=0.7)
    rgb = blend(rgb, spec["vein"], np.clip(lines * spec.get("line_amt", 0.35), 0, 1))

    # Gözenekler - tabakalanma yönünde yassılmış boşluklar.
    # Yatayda sıkıştırılmış bir alan üretip geri esneterek elde edilir.
    pw = max(8, w // 4)
    pores_small = fbm(h, pw, rng, base=26, octaves=3, persistence=0.45)
    pores = np.asarray(
        Image.fromarray((pores_small * 255).astype(np.uint8), mode="L")
        .resize((w, h), Image.BILINEAR),
        dtype=np.float32) / 255.0

    thr = spec.get("pore_thr", 0.62)
    pore_mask = smoothstep(thr, thr + 0.055, pores)
    gate = smoothstep(0.45, 0.8, fbm(h, w, rng, base=7, octaves=4))
    pore_mask = soften(pore_mask * gate, radius=0.8)
    rgb = blend(rgb, spec.get("pore", (120, 100, 82)),
                np.clip(pore_mask * spec.get("pore_amt", 0.45), 0, 1))

    return rgb


def render_breccia(h, w, spec, rng):
    """Breş / Marinace: çimento içinde çakıl ve blok parçaları."""
    lut = build_lut(spec["base"])
    cells = spec.get("cells", 190)

    # İki ölçekli çakıl dağılımı - konglomera taşlarda taneler eşit boyda olmaz
    edge_c, ids_c, n_c = voronoi_cells(h, w, rng, max(12, cells // 5),
                                       jitter=spec.get("jitter", 1.0))
    edge_f, ids_f, n_f = voronoi_cells(h, w, rng, cells,
                                       jitter=spec.get("jitter", 1.0) * 0.8)

    # Hangi bölgede iri, hangisinde ince tane baskın olacak
    scale_mask = smoothstep(0.42, 0.62, fbm(h, w, rng, base=3, octaves=4))

    tone_c = rng.random(n_c).astype(np.float32)[ids_c]
    tone_f = rng.random(n_f).astype(np.float32)[ids_f]
    tone_map = tone_c * scale_mask + tone_f * (1.0 - scale_mask)
    tone_map = tone_map * 0.74 + fbm(h, w, rng, base=10, octaves=5) * 0.26
    rgb = apply_lut(normalize(tone_map), lut)

    # Hücre içi damar / doku
    inner = fbm(h, w, rng, base=18, octaves=5, persistence=0.55)
    rgb = rgb * (0.86 + 0.28 * inner)[..., None]

    # Çimento hattı (hücre sınırları)
    sw = spec.get("seam_w", 0.045)
    seam_c = (1.0 - smoothstep(0.0, sw * 1.3, edge_c)) * scale_mask
    seam_f = (1.0 - smoothstep(0.0, sw * 0.7, edge_f)) * (1.0 - scale_mask)
    seam = soften(np.maximum(seam_c, seam_f), radius=0.9)
    rgb = blend(rgb, spec["vein"], np.clip(seam * spec.get("seam_amt", 0.95), 0, 1))

    # İnce ikincil çatlaklar
    cr = crackle(h, w, rng, 26, 1.1, 24) * 0.2
    rgb = blend(rgb, spec.get("vein3", spec["vein"]), np.clip(cr, 0, 1))

    return np.clip(rgb, 0, 255)


def render_onyx(h, w, spec, rng):
    """Oniks: yarı saydam, ışık geçiren geniş bantlar."""
    lut = build_lut(spec["base"])

    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    xx /= w
    yy /= h

    warp = (fbm(h, w, rng, base=2, octaves=6, persistence=0.6) - 0.5) * spec.get("warp", 3.0)
    field = (xx * 0.42 + yy * 0.9) * spec.get("bands", 7.0) + warp
    bands = 0.5 + 0.5 * np.sin(field * math.pi)
    bands = bands ** 1.35
    detail = fbm(h, w, rng, base=8, octaves=5, persistence=0.5)
    mix = normalize(bands * 0.72 + detail * 0.28)
    rgb = apply_lut(mix, lut)

    # İç ışıma - oniksin arkadan aydınlatılmış hissi
    glow = np.exp(-(((xx - 0.45) ** 2) / 0.42 + ((yy - 0.52) ** 2) / 0.55))
    rgb = rgb * (1.0 + spec.get("glow", 0.22) * glow)[..., None]

    # İnce kristal damarları
    v = vein_layer(h, w, rng, 74, 6.0, 2.4, 14.0) * 0.3
    rgb = blend(rgb, spec["vein"], np.clip(v, 0, 1))

    return np.clip(rgb, 0, 255)


def render_fossil(h, w, spec, rng):
    """Fosilli / bulutlu koyu taş: yumuşak organik lekelenme."""
    lut = build_lut(spec["base"])

    cloud = fbm(h, w, rng, base=4, octaves=7, persistence=0.62)
    cloud2 = fbm(h, w, rng, base=11, octaves=5, persistence=0.5)
    mix = normalize(cloud * 0.68 + cloud2 * 0.32)
    rgb = apply_lut(mix, lut)

    # Fosil kesitleri - dairesel/halka izler
    edge, ids, n = voronoi_cells(h, w, rng, spec.get("cells", 70), jitter=1.4)
    rings = np.abs(np.sin(edge * math.pi * 9.0))
    ring_mask = (1.0 - rings) ** 12.0 * smoothstep(0.0, 0.35, edge)
    rgb = blend(rgb, spec["vein"], np.clip(ring_mask * spec.get("ring_amt", 0.5), 0, 1))

    v = crackle(h, w, rng, 16, 1.3, 20) * 0.24
    rgb = blend(rgb, spec.get("vein3", spec["vein"]), np.clip(v, 0, 1))

    return np.clip(rgb, 0, 255)


RENDERERS = {
    "veined": render_veined,
    "travertine": render_travertine,
    "breccia": render_breccia,
    "onyx": render_onyx,
    "fossil": render_fossil,
}


# --------------------------------------------------------------------------
# Taş kataloğu
# --------------------------------------------------------------------------
STONES = [
    # ---------------- Beyaz Mermer ----------------
    dict(
        slug="calacatta-gold", name="Calacatta Gold", category="beyaz",
        style="veined", seed=1011,
        base=[(0.0, (232, 229, 222)), (0.5, (245, 243, 238)), (1.0, (252, 251, 248))],
        vein=(120, 116, 112), vein2=(168, 163, 156), vein3=(198, 193, 186),
        halo_color=(214, 205, 190), halo_amt=0.30,
        accent=(186, 148, 84), acc_amt=0.5, acc_freq=4.2, acc_warp=2.4, acc_sharp=18,
        angle=64, v1_freq=2.6, v1_warp=2.9, v1_sharp=8.0, v1_amt=0.92,
        v2_freq=8.0, v2_sharp=15.0, v2_amt=0.5, v3_amt=0.22,
    ),
    dict(
        slug="statuario", name="Statuario Venato", category="beyaz",
        style="veined", seed=2022,
        base=[(0.0, (238, 237, 234)), (0.55, (248, 248, 246)), (1.0, (254, 254, 253))],
        vein=(88, 90, 94), vein2=(146, 149, 154), vein3=(190, 192, 196),
        halo_color=(206, 208, 212), halo_amt=0.34,
        angle=70, v1_freq=2.2, v1_warp=3.2, v1_sharp=7.0, v1_amt=0.95,
        v2_freq=7.0, v2_sharp=14.0, v2_amt=0.55, v3_amt=0.26,
    ),
    dict(
        slug="carrara-bianco", name="Carrara Bianco", category="beyaz",
        style="veined", seed=3033,
        base=[(0.0, (226, 227, 226)), (0.5, (238, 239, 238)), (1.0, (247, 248, 248))],
        vein=(132, 137, 140), vein2=(174, 178, 181), vein3=(200, 203, 205),
        halo_color=(210, 213, 214), halo_amt=0.4,
        angle=58, v1_freq=4.5, v1_warp=2.2, v1_sharp=6.0, v1_amt=0.55,
        v2_freq=13.0, v2_sharp=11.0, v2_amt=0.42, v3_freq=30, v3_amt=0.3,
        cloud_base=5,
    ),
    dict(
        slug="mugla-white", name="Muğla White", category="beyaz",
        style="veined", seed=4044,
        base=[(0.0, (235, 234, 230)), (0.5, (246, 245, 242)), (1.0, (253, 252, 250))],
        vein=(160, 158, 152), vein2=(196, 194, 188), vein3=(214, 212, 207),
        halo_color=(224, 222, 216), halo_amt=0.3,
        angle=76, v1_freq=5.5, v1_warp=1.8, v1_sharp=8.0, v1_amt=0.45,
        v2_freq=15.0, v2_sharp=13.0, v2_amt=0.35, v3_amt=0.2,
    ),
    dict(
        slug="bianco-ibiza", name="Bianco Ibiza", category="beyaz",
        style="veined", seed=5055,
        base=[(0.0, (240, 240, 238)), (0.5, (249, 249, 248)), (1.0, (255, 255, 255))],
        vein=(150, 152, 155), vein2=(190, 192, 195), vein3=(214, 216, 218),
        halo_color=(228, 229, 231), halo_amt=0.26,
        angle=48, v1_freq=3.2, v1_warp=2.6, v1_sharp=9.0, v1_amt=0.6,
        v2_freq=10.0, v2_sharp=16.0, v2_amt=0.38, v3_amt=0.18,
    ),

    # ---------------- Siyah Mermer ----------------
    dict(
        slug="portoro-gold", name="Portoro Gold", category="siyah",
        style="veined", seed=6066,
        base=[(0.0, (10, 10, 12)), (0.5, (20, 19, 21)), (1.0, (34, 32, 33))],
        vein=(172, 136, 66), vein2=(202, 174, 116), vein3=(112, 90, 48),
        halo_color=(46, 40, 30), halo_amt=0.5,
        accent=(216, 194, 142), acc_amt=0.2, acc_freq=6.0, acc_warp=2.0, acc_sharp=26,
        angle=68, v1_freq=3.0, v1_warp=2.4, v1_sharp=9.0, v1_amt=0.8,
        v2_freq=9.0, v2_sharp=16.0, v2_amt=0.42, v3_amt=0.18,
    ),
    dict(
        slug="nero-marquina", name="Nero Marquina", category="siyah",
        style="veined", seed=7077,
        base=[(0.0, (12, 12, 14)), (0.5, (22, 22, 25)), (1.0, (36, 36, 40))],
        vein=(238, 238, 236), vein2=(198, 198, 198), vein3=(150, 150, 152),
        halo_color=(58, 58, 62), halo_amt=0.3,
        angle=54, v1_freq=2.8, v1_warp=3.0, v1_sharp=10.0, v1_amt=0.88,
        v2_freq=8.5, v2_sharp=17.0, v2_amt=0.55, v3_freq=24, v3_amt=0.3,
    ),
    dict(
        slug="black-marinace", name="Black Marinace", category="siyah",
        style="breccia", seed=8088,
        base=[(0.0, (14, 14, 16)), (0.35, (30, 29, 31)), (0.7, (52, 50, 52)), (1.0, (86, 82, 82))],
        vein=(8, 8, 10), vein3=(120, 116, 112),
        cells=210, seam_w=0.05, seam_amt=0.95, jitter=1.1,
    ),
    dict(
        slug="fosil-black", name="Fosil Black", category="siyah",
        style="fossil", seed=9099,
        base=[(0.0, (16, 16, 18)), (0.45, (30, 30, 33)), (0.8, (54, 53, 55)), (1.0, (78, 76, 76))],
        vein=(196, 190, 178), vein3=(110, 106, 102),
        cells=64, ring_amt=0.42,
    ),
    dict(
        slug="grafit-grey", name="Grafit Grey", category="siyah",
        style="veined", seed=10101,
        base=[(0.0, (52, 53, 56)), (0.5, (72, 74, 78)), (1.0, (98, 100, 104))],
        vein=(226, 226, 228), vein2=(178, 180, 184), vein3=(140, 142, 146),
        halo_color=(112, 114, 118), halo_amt=0.3,
        angle=82, v1_freq=3.4, v1_warp=2.6, v1_sharp=9.0, v1_amt=0.7,
        v2_freq=11.0, v2_sharp=16.0, v2_amt=0.4, v3_amt=0.24,
    ),

    # ---------------- Bej & Kahve ----------------
    dict(
        slug="sandian-beige", name="Sandian Beige", category="bej",
        style="veined", seed=11111,
        base=[(0.0, (206, 190, 168)), (0.5, (224, 210, 190)), (1.0, (238, 227, 210))],
        vein=(158, 138, 112), vein2=(190, 172, 148), vein3=(206, 190, 168),
        halo_color=(200, 182, 158), halo_amt=0.32,
        angle=72, v1_freq=4.0, v1_warp=2.4, v1_sharp=8.5, v1_amt=0.62,
        v2_freq=12.0, v2_sharp=15.0, v2_amt=0.42, v3_amt=0.26,
    ),
    dict(
        slug="crema-marfil", name="Crema Marfil", category="bej",
        style="veined", seed=12121,
        base=[(0.0, (224, 212, 190)), (0.5, (236, 226, 206)), (1.0, (246, 239, 224))],
        vein=(186, 166, 138), vein2=(210, 194, 170), vein3=(226, 214, 194),
        halo_color=(218, 204, 182), halo_amt=0.34,
        angle=60, v1_freq=5.0, v1_warp=2.0, v1_sharp=7.0, v1_amt=0.5,
        v2_freq=14.0, v2_sharp=13.0, v2_amt=0.38, v3_amt=0.28,
    ),
    dict(
        slug="emperador-dark", name="Emperador Dark", category="bej",
        style="veined", seed=13131,
        base=[(0.0, (44, 30, 24)), (0.5, (66, 46, 36)), (1.0, (92, 66, 50))],
        vein=(226, 214, 196), vein2=(186, 164, 138), vein3=(140, 116, 94),
        halo_color=(104, 78, 60), halo_amt=0.34,
        angle=50, v1_freq=3.6, v1_warp=2.8, v1_sharp=10.0, v1_amt=0.7,
        v2_freq=12.0, v2_sharp=18.0, v2_amt=0.48, v3_freq=26, v3_amt=0.3,
    ),
    dict(
        slug="emperador-light", name="Emperador Light", category="bej",
        style="veined", seed=14141,
        base=[(0.0, (150, 124, 100)), (0.5, (178, 152, 126)), (1.0, (202, 180, 154))],
        vein=(236, 228, 214), vein2=(206, 188, 166), vein3=(160, 136, 112),
        halo_color=(190, 168, 144), halo_amt=0.3,
        angle=66, v1_freq=4.4, v1_warp=2.4, v1_sharp=9.0, v1_amt=0.6,
        v2_freq=13.0, v2_sharp=16.0, v2_amt=0.42, v3_amt=0.26,
    ),

    # ---------------- Traverten ----------------
    dict(
        slug="traverten-classic", name="Traverten Classic", category="traverten",
        style="travertine", seed=15151,
        base=[(0.0, (198, 178, 150)), (0.5, (222, 205, 178)), (1.0, (240, 228, 206))],
        vein=(170, 148, 118), pore=(138, 116, 90),
        bands=24, line_amt=0.32, pore_thr=0.63,
    ),
    dict(
        slug="traverten-noce", name="Traverten Noce", category="traverten",
        style="travertine", seed=16161,
        base=[(0.0, (108, 82, 60)), (0.5, (140, 110, 84)), (1.0, (176, 148, 118))],
        vein=(84, 62, 44), pore=(64, 46, 32),
        bands=22, line_amt=0.38, pore_thr=0.6,
    ),
    dict(
        slug="silver-travertine", name="Silver Travertine", category="traverten",
        style="travertine", seed=17171,
        base=[(0.0, (124, 124, 126)), (0.5, (156, 156, 158)), (1.0, (196, 196, 198))],
        vein=(92, 92, 96), pore=(74, 74, 78),
        bands=28, line_amt=0.42, pore_thr=0.64,
    ),

    # ---------------- Oniks ----------------
    dict(
        slug="honey-onyx", name="Honey Onyx", category="oniks",
        style="onyx", seed=18181,
        base=[(0.0, (168, 112, 44)), (0.4, (214, 158, 74)), (0.75, (238, 196, 118)), (1.0, (250, 228, 178))],
        vein=(255, 240, 206), bands=6.0, warp=2.6, glow=0.26,
    ),
    dict(
        slug="white-onyx", name="Bianco Onyx", category="oniks",
        style="onyx", seed=19191,
        base=[(0.0, (196, 196, 190)), (0.4, (224, 224, 218)), (0.75, (240, 240, 236)), (1.0, (252, 252, 250))],
        vein=(255, 255, 255), bands=5.0, warp=3.0, glow=0.2,
    ),
    dict(
        slug="verde-onyx", name="Verde Onyx", category="oniks",
        style="onyx", seed=20202,
        base=[(0.0, (28, 62, 52)), (0.4, (52, 100, 82)), (0.75, (96, 146, 120)), (1.0, (168, 200, 176))],
        vein=(214, 236, 220), bands=6.5, warp=2.8, glow=0.24,
    ),

    # ---------------- Egzotik ----------------
    dict(
        slug="verde-guatemala", name="Verde Guatemala", category="egzotik",
        style="veined", seed=21212,
        base=[(0.0, (16, 40, 32)), (0.5, (26, 58, 46)), (1.0, (42, 80, 62))],
        vein=(228, 236, 228), vein2=(150, 186, 158), vein3=(96, 134, 108),
        halo_color=(54, 92, 72), halo_amt=0.32,
        angle=44, v1_freq=3.4, v1_warp=3.2, v1_sharp=10.0, v1_amt=0.8,
        v2_freq=11.0, v2_sharp=17.0, v2_amt=0.5, v3_freq=26, v3_amt=0.3,
    ),
    dict(
        slug="rosso-levanto", name="Rosso Levanto", category="egzotik",
        style="veined", seed=22222,
        base=[(0.0, (64, 16, 20)), (0.5, (92, 24, 28)), (1.0, (124, 40, 42))],
        vein=(238, 232, 224), vein2=(196, 178, 168), vein3=(140, 92, 84),
        halo_color=(140, 60, 56), halo_amt=0.34,
        angle=58, v1_freq=3.0, v1_warp=3.0, v1_sharp=9.5, v1_amt=0.85,
        v2_freq=10.0, v2_sharp=16.0, v2_amt=0.52, v3_amt=0.28,
    ),
    dict(
        slug="calacatta-viola", name="Calacatta Viola", category="egzotik",
        style="veined", seed=23232,
        base=[(0.0, (228, 222, 216)), (0.5, (240, 236, 231)), (1.0, (250, 248, 245))],
        vein=(118, 44, 58), vein2=(168, 92, 96), vein3=(196, 150, 146),
        halo_color=(206, 176, 172), halo_amt=0.4,
        accent=(88, 28, 42), acc_amt=0.4, acc_freq=4.6, acc_warp=2.6, acc_sharp=20,
        angle=66, v1_freq=2.4, v1_warp=3.2, v1_sharp=8.0, v1_amt=0.9,
        v2_freq=8.0, v2_sharp=15.0, v2_amt=0.55, v3_amt=0.24,
    ),
]


# --------------------------------------------------------------------------
# Üretim
# --------------------------------------------------------------------------
def render_stone(spec, w, h, seed_off=0):
    rng = np.random.default_rng(spec["seed"] + seed_off)
    rw, rh = int(w * SS), int(h * SS)
    rgb = RENDERERS[spec["style"]](rh, rw, spec, rng)
    rgb = polish(
        rgb, rng, rh, rw,
        sheen=spec.get("sheen", 0.17),
        grain=spec.get("grain", 3.4),
        vignette=spec.get("vignette", 0.13),
    )
    img = Image.fromarray(rgb.astype(np.uint8), mode="RGB")
    img = img.resize((w, h), Image.LANCZOS)
    img = img.filter(ImageFilter.UnsharpMask(radius=1.4, percent=52, threshold=2))
    return img


def save(img, path, quality=86):
    img.save(path, "JPEG", quality=quality, optimize=True, progressive=True)
    kb = os.path.getsize(path) / 1024
    print(f"  -> {os.path.relpath(path, ROOT)}  ({img.width}x{img.height}, {kb:.0f} KB)")


def bookmatch(img):
    """Kitap açılımı (bookmatch) - plakanın aynalanmış eşleşmesi."""
    mirrored = img.transpose(Image.FLIP_LEFT_RIGHT)
    out = Image.new("RGB", (img.width * 2, img.height))
    out.paste(img, (0, 0))
    out.paste(mirrored, (img.width, 0))
    return out


def main():
    import sys
    only = set(sys.argv[1:])

    for d in (OUT_STONES, OUT_SCENES, OUT_TEX):
        os.makedirs(d, exist_ok=True)

    # --- Plaka görselleri (portre) ---
    LG = (1120, 1400)
    SM = (560, 700)
    print("Plaka görselleri üretiliyor...")
    for spec in STONES:
        if only and spec["slug"] not in only:
            continue
        print(f"[{spec['name']}]")
        img = render_stone(spec, *LG)
        save(img, os.path.join(OUT_STONES, f"{spec['slug']}.jpg"), 86)
        save(img.resize(SM, Image.LANCZOS),
             os.path.join(OUT_STONES, f"{spec['slug']}-sm.jpg"), 82)

    if only:
        print("\n(Sadece seçili taşlar üretildi; sahne/doku adımları atlandı.)")
        return

    # --- Hero / geniş sahneler ---
    print("\nGeniş sahne görselleri üretiliyor...")
    wide_specs = [
        ("hero-calacatta", "calacatta-gold", 2200, 1240),
        ("hero-portoro", "portoro-gold", 2200, 1240),
        ("hero-onyx", "honey-onyx", 2200, 1240),
        ("band-nero", "nero-marquina", 2000, 900),
        ("band-verde", "verde-guatemala", 2000, 900),
        ("band-traverten", "traverten-classic", 2000, 900),
        ("band-emperador", "emperador-dark", 2000, 900),
    ]
    by_slug = {s["slug"]: s for s in STONES}
    for out_name, slug, w, h in wide_specs:
        spec = dict(by_slug[slug])
        print(f"[{out_name}]")
        img = render_stone(spec, w, h, seed_off=777)
        save(img, os.path.join(OUT_SCENES, f"{out_name}.jpg"), 84)
        save(img.resize((w // 2, h // 2), Image.LANCZOS),
             os.path.join(OUT_SCENES, f"{out_name}-sm.jpg"), 80)

    # --- Bookmatch kompozisyonlar ---
    print("\nKitap açılımı kompozisyonlar üretiliyor...")
    for slug in ("calacatta-viola", "portoro-gold", "verde-guatemala", "honey-onyx"):
        spec = dict(by_slug[slug])
        img = render_stone(spec, 900, 1200, seed_off=4242)
        bm = bookmatch(img)
        print(f"[bookmatch-{slug}]")
        save(bm, os.path.join(OUT_SCENES, f"bookmatch-{slug}.jpg"), 85)

    # --- 3B sahne dokuları ---
    print("\n3B doku haritaları üretiliyor...")
    for slug in ("calacatta-gold", "portoro-gold", "nero-marquina", "verde-guatemala",
                 "honey-onyx", "emperador-dark"):
        spec = dict(by_slug[slug])
        img = render_stone(spec, 1024, 1024, seed_off=1234)
        save(img, os.path.join(OUT_TEX, f"{slug}-1k.jpg"), 84)

    # Pürüzlülük haritası (cila varyasyonu)
    rng = np.random.default_rng(31337)
    r = fbm(1024, 1024, rng, base=6, octaves=6, persistence=0.55)
    r = (normalize(r) * 70 + 20).astype(np.uint8)
    Image.fromarray(r, mode="L").save(
        os.path.join(OUT_TEX, "roughness-1k.jpg"), "JPEG", quality=80, optimize=True)
    print("  -> assets/img/tex/roughness-1k.jpg")

    print("\nTamamlandı.")


if __name__ == "__main__":
    main()
