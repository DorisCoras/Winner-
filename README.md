# Winner Marble — Web Sitesi

Lüks mermer ve doğal taş için hazırlanmış, tamamen **statik** bir web sitesi.
39 ayrı HTML sayfası, 3B mermer sahneleri, sıvı cam (liquid glass) arayüz
katmanı ve kaydırma efektleri içerir.

Site hiçbir dış servise bağlı değildir: yazı tipleri, 3B kütüphanesi ve tüm
görseller proje içinde yerel olarak bulunur. Klasörü olduğu gibi hosting'inize
yüklediğinizde çalışır.

---

## 1. Hızlı kurulum

1. Aşağıdaki dosya ve klasörleri hosting'inizin **kök dizinine**
   (`public_html`, `httpdocs` ya da `www`) yükleyin:

   ```
   index.html          hakkimizda.html     koleksiyon.html
   uygulamalar.html    uretim.html         projeler.html
   iletisim.html       sss.html            bakim.html
   404.html            sitemap.xml         robots.txt
   .htaccess           form-handler.php

   koleksiyon/         (6 kategori sayfası)
   urunler/            (23 ürün sayfası)
   assets/             (css, js, img, fonts, vendor)
   ```

2. Tarayıcıdan alan adınızı açın. Başka bir işlem gerekmez.

> `tools/` klasörünü **yüklemenize gerek yoktur** — orası yalnızca sayfaları ve
> görselleri yeniden üretmek için kullanılan geliştirme betiklerini içerir.

**Alt klasörde de çalışır.** Tüm bağlantılar görelidir; siteyi
`ornekalanadi.com/yeni/` gibi bir alt dizine de koyabilirsiniz.

---

## 2. Yayına almadan önce doldurulması gerekenler

Aşağıdaki bilgiler şu an **yer tutucudur**. Gerçek bilgilerinizle
değiştirilmeleri gerekir:

| Bilgi | Şu anki değer |
|---|---|
| Telefon | `+90 000 000 00 00` |
| Adres | `Merkez Ofis / Türkiye` |
| E-posta | `info@winnermarble.com`, `sales@winnermarble.com` |
| Çalışma saatleri | `Pazartesi – Cumartesi · 09:00 – 18:00` |

Ayrıca **Projeler** sayfasındaki referans projeler ve **Rakamlar** bölümündeki
istatistikler (20+ yıl, 40+ ülke, 120+ çeşit, 850+ proje) örnek olarak
girilmiştir; kendi gerçek verilerinizle güncelleyin.

### Nasıl değiştirilir?

**Yöntem A — betikle (önerilen).** `tools/site_data.py` dosyasındaki `SITE`
sözlüğünü düzenleyin ve şu komutu çalıştırın:

```bash
python3 tools/build_site.py
```

Tüm sayfalar (39 dosya) bilgileri güncellenmiş olarak yeniden üretilir.

**Yöntem B — elle.** Python kullanmak istemiyorsanız, HTML dosyalarında
`+90 000 000 00 00` gibi ifadeleri bir metin düzenleyicinin "tümünü değiştir"
özelliğiyle arayıp değiştirebilirsiniz.

---

## 3. İletişim formu

Form iki şekilde çalışır:

- **PHP varsa:** `form-handler.php` dosyası formu alır ve e-posta gönderir.
  Dosyanın içindeki `$ALICI` değişkenine kendi e-posta adresinizi yazın.
- **PHP yoksa:** JavaScript otomatik olarak ziyaretçinin e-posta uygulamasını
  açar. Hiçbir ayar gerekmez, form yine de kullanılabilir kalır.

Formda görünmez bir bot tuzağı (honeypot) alanı vardır; otomatik spam
gönderimlerini süzer.

---

## 4. Klasör yapısı

```
assets/
  css/
    fonts.css        yerel yazı tipi tanımları
    core.css         renk/tipografi belirteçleri, düzen sistemi
    glass.css        sıvı cam katmanı, düğmeler
    components.css   menü, hero, kartlar, zaman çizelgesi, footer …
  js/
    site.js          kaydırma efektleri, menü, form, sayaçlar (bağımsız)
    scene.js         3B mermer sahneleri (ES modülü)
  img/
    stones/          23 taşın plaka görselleri (2 boyutta)
    scenes/          hero, bant ve kitap açılımı kompozisyonları
    tex/             3B sahne doku haritaları
  fonts/             Cormorant Garamond + Jost (woff2, OFL lisanslı)
  vendor/            three.module.min.js (MIT lisanslı)

tools/               geliştirme betikleri (hosting'e yüklenmez)
  site_data.py       TÜM İÇERİK burada
  build_site.py      sayfaları üretir
  generate_textures.py  mermer görsellerini üretir
  fetch_fonts.py     yazı tiplerini indirir
```

---

## 5. İçerik güncelleme

Bütün metinler, ürün açıklamaları, SSS ve proje listesi
**`tools/site_data.py`** dosyasındadır. Düzenledikten sonra:

```bash
python3 tools/build_site.py
```

Yeni bir taş eklemek için:

1. `tools/generate_textures.py` içindeki `STONES` listesine taşı ekleyin
   (renk paleti ve desen stiliyle birlikte).
2. `tools/site_data.py` içindeki `STONE_INFO` sözlüğüne açıklamalarını yazın.
3. Sırasıyla çalıştırın:

```bash
python3 tools/generate_textures.py <yeni-taş-slug>
python3 tools/build_site.py
```

### Görseller hakkında

Tüm mermer görselleri `tools/generate_textures.py` tarafından **prosedürel
olarak üretilmiştir** (fraktal gürültü + alan bükme ile damar simülasyonu).
Bu nedenle telif/lisans sorunu yoktur ve istediğiniz zaman yeniden
üretilebilirler. Kendi fotoğraflarınızı kullanmak isterseniz
`assets/img/stones/` altındaki dosyaları aynı adlarla değiştirmeniz yeterlidir
(`<slug>.jpg` ve `<slug>-sm.jpg`).

---

## 6. Teknik notlar

- **Bağımlılık yok.** Derleme adımı, npm, CDN ya da veritabanı gerekmez.
- **3B sahneler** Three.js ile çalışır. WebGL desteklenmeyen cihazlarda sahne
  sessizce devre dışı kalır ve arka planda yüksek çözünürlüklü mermer görseli
  gösterilir — sayfa bozulmaz.
- **Erişilebilirlik:** klavye ile gezinme, `prefers-reduced-motion` desteği,
  "içeriğe geç" bağlantısı ve anlamlı `alt` metinleri mevcuttur.
- **SEO:** her sayfada canonical adres, Open Graph etiketleri, JSON-LD
  kuruluş verisi; SSS sayfasında `FAQPage` şeması; ayrıca `sitemap.xml` ve
  `robots.txt` üretilir.
- **Performans:** görseller `srcset` ile iki boyutta sunulur, ekran dışı
  görseller `loading="lazy"` ile ertelenir, `.htaccess` sıkıştırma ve önbellek
  başlıklarını ayarlar.
- Toplam boyut yaklaşık **11 MB** (çoğu görsel).

### Lisanslar

- Three.js — MIT
- Cormorant Garamond, Jost — SIL Open Font License 1.1
- Görseller — bu proje için üretilmiştir

---

## 7. Yerel önizleme

```bash
python3 -m http.server 8000
```

Ardından tarayıcıda `http://localhost:8000` adresini açın.

> 3B sahneler ES modülü kullandığı için dosyayı doğrudan çift tıklayarak
> (`file://`) açtığınızda 3B kısmı çalışmaz; yukarıdaki gibi bir yerel sunucu
> ya da gerçek hosting üzerinden açın. Sitenin geri kalanı her durumda çalışır.
