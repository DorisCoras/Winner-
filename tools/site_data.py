#!/usr/bin/env python3
"""
Winner Marble — site içeriği.

Tüm metinler, ürün bilgileri ve iletişim verileri burada tutulur.
Sayfaları yeniden üretmek için: python3 tools/build_site.py
"""

# ---------------------------------------------------------------------------
# Site geneli
#
# NOT: Aşağıdaki iletişim alanları doldurulmayı bekliyor. Gerçek adres,
# telefon ve sosyal medya adreslerinizi buraya yazıp build_site.py'yi
# yeniden çalıştırmanız yeterlidir; tüm sayfalar güncellenir.
# ---------------------------------------------------------------------------
SITE = {
    "name": "Winner Marble",
    "tagline": "Choice of Winners",
    "tagline_tr": "Kazananların Tercihi",
    "domain": "winnermarble.com",
    "url": "https://winnermarble.com",
    "description": (
        "Winner Marble, 20 yılı aşkın deneyimiyle doğal taşın en zarif ve "
        "dayanıklı biçimi olan mermeri yaşam alanlarına taşır. Lüks mermer "
        "konusunda uzmanlaşmış ekibimizle dünyanın dört bir yanından seçkin "
        "mermer çeşitlerini yurt içi ve yurt dışı müşterilerimize sunuyoruz."
    ),

    # --- DOLDURULACAK ---
    "email": "info@winnermarble.com",
    "email_sales": "sales@winnermarble.com",
    "phone": "+90 000 000 00 00",
    "phone_href": "+900000000000",
    "whatsapp": "+90 000 000 00 00",
    "address_line1": "Merkez Ofis",
    "address_line2": "Türkiye",
    "hours": "Pazartesi – Cumartesi · 09:00 – 18:00",

    "social": [
        ("Instagram", "https://www.instagram.com/winnermarble/", "instagram"),
        ("LinkedIn", "https://www.linkedin.com/company/winner-marblee", "linkedin"),
    ],

    "founded": 2003,
    "experience_years": "20",
}

# ---------------------------------------------------------------------------
# Ana menü
# ---------------------------------------------------------------------------
NAV = [
    ("Ana Sayfa", "index.html", None),
    ("Hakkımızda", "hakkimizda.html", None),
    ("Koleksiyon", "koleksiyon.html", "mega"),
    ("Uygulamalar", "uygulamalar.html", None),
    ("Üretim", "uretim.html", None),
    ("Projeler", "projeler.html", None),
    ("İletişim", "iletisim.html", None),
]

FOOTER_EXTRA = [
    ("Mermer Bakımı", "bakim.html"),
    ("Sıkça Sorulan Sorular", "sss.html"),
]

# ---------------------------------------------------------------------------
# Kategoriler
# ---------------------------------------------------------------------------
CATEGORIES = [
    {
        "key": "beyaz",
        "slug": "beyaz-mermer",
        "name": "Beyaz Mermer",
        "short": "Işığı yansıtan zamansız zemin",
        "hero": "hero-calacatta",
        "intro": (
            "Beyaz mermer, mekâna genişlik ve sükûnet katan en klasik doğal taş "
            "ailesidir. Calacatta'nın cesur altın damarlarından Carrara'nın sakin "
            "gri bulutlanmasına kadar her biri kendi karakterini taşır."
        ),
        "desc": (
            "Aydınlık mekânlar, geniş salonlar ve zarif banyolar için ideal. "
            "Beyaz zemin üzerindeki damar dokusu, her plakayı tekrar edilemez kılar."
        ),
    },
    {
        "key": "siyah",
        "slug": "siyah-mermer",
        "name": "Siyah Mermer",
        "short": "Derinlik ve dramatik kontrast",
        "hero": "band-nero",
        "intro": (
            "Siyah mermer, mekâna ağırlık ve prestij kazandırır. Portoro'nun altın "
            "damarları ya da Nero Marquina'nın keskin beyaz çizgileri, koyu zemin "
            "üzerinde güçlü bir kontrast yaratır."
        ),
        "desc": (
            "Şömine cepheleri, bar tezgâhları ve vurgu duvarları için tercih edilir. "
            "Cilalı yüzeyde ışığı derinlemesine yansıtır."
        ),
    },
    {
        "key": "bej",
        "slug": "bej-mermer",
        "name": "Bej & Kahve Mermer",
        "short": "Sıcak, davetkâr yumuşaklık",
        "hero": "band-emperador",
        "intro": (
            "Bej ve kahve tonlu mermerler, mekâna sıcaklık ve süreklilik hissi verir. "
            "Geniş yüzeylerde göz yormayan, huzurlu bir bütünlük kurar."
        ),
        "desc": (
            "Otel lobileri, geniş zeminler ve dış cephe kaplamalarında yaygın olarak "
            "kullanılır. Doğal ton geçişleriyle zamansız bir zemin oluşturur."
        ),
    },
    {
        "key": "traverten",
        "slug": "traverten",
        "name": "Traverten",
        "short": "Anadolu'nun katmanlı dokusu",
        "hero": "band-traverten",
        "intro": (
            "Traverten, binlerce yılda katman katman oluşmuş gözenekli bir doğal "
            "taştır. Türkiye, dünyanın en zengin traverten yataklarına sahiptir."
        ),
        "desc": (
            "Dış cephe, havuz çevresi ve teras uygulamalarında öne çıkar. Dolgulu ya "
            "da dolgusuz, cilalı ya da honlu olarak sunulur."
        ),
    },
    {
        "key": "oniks",
        "slug": "oniks",
        "name": "Oniks",
        "short": "Işık geçiren yarı saydam taş",
        "hero": "hero-onyx",
        "intro": (
            "Oniks, arkadan aydınlatıldığında ışığı içinden geçiren ender doğal "
            "taşlardandır. Bu özelliğiyle dekoratif panellerin başrol oyuncusudur."
        ),
        "desc": (
            "Arkadan aydınlatmalı duvar panelleri, bar önleri ve resepsiyon "
            "bankolarında eşsiz bir etki yaratır."
        ),
    },
    {
        "key": "egzotik",
        "slug": "egzotik",
        "name": "Egzotik Taşlar",
        "short": "Nadir renkler, güçlü karakter",
        "hero": "band-verde",
        "intro": (
            "Yeşilin, bordonun ve morun doğal taştaki karşılığı. Sınırlı ocak "
            "rezervleriyle gelen bu taşlar, projelere imza niteliğinde bir kimlik katar."
        ),
        "desc": (
            "Vurgu yüzeyleri, tasarım mobilyaları ve özel koleksiyon projeleri için."
        ),
    },
]

# ---------------------------------------------------------------------------
# Ürün detay içerikleri (slug -> ek bilgi)
# generate_textures.py içindeki STONES listesiyle eşleşir.
# ---------------------------------------------------------------------------
STONE_INFO = {
    "calacatta-gold": dict(
        origin="İtalya / Apuan Alpleri",
        color="Beyaz zemin, altın ve gri damar",
        blurb="Lüks mermerin ölçütü sayılan Calacatta Gold, parlak beyaz zemininde "
              "kalın gri damarlar ve onlara eşlik eden sıcak altın hatlarla tanınır.",
        story="Calacatta Gold, damar yoğunluğu ve altın tonun canlılığıyla "
              "derecelendirilir. Kitap açılımı (bookmatch) uygulandığında iki plaka "
              "birbirinin aynası olur ve duvarda simetrik, tablo etkisinde bir "
              "kompozisyon oluşur. Geniş salon zeminlerinde ve ada tezgâhlarında "
              "mekânın odak noktası hâline gelir.",
        uses=["Mutfak tezgâhı", "Banyo", "Duvar paneli", "Zemin"],
    ),
    "statuario": dict(
        origin="İtalya / Carrara bölgesi",
        color="Parlak beyaz zemin, koyu gri damar",
        blurb="Statuario Venato, heykeltıraşların yüzyıllardır tercih ettiği, çok "
              "beyaz zemin üzerinde net ve dramatik gri damarlara sahip mermerdir.",
        story="Adını heykel (statua) sözcüğünden alır. Zemin beyazlığı Carrara'dan "
              "daha temiz, damar yapısı ise daha belirgindir. Az bulunurluğu onu "
              "koleksiyon sınıfına taşır; genellikle vurgu yüzeylerinde ve özel "
              "tasarım banyolarda kullanılır.",
        uses=["Banyo", "Duvar paneli", "Tezgâh", "Merdiven"],
    ),
    "carrara-bianco": dict(
        origin="İtalya / Carrara",
        color="Açık gri-beyaz, ince gri damar",
        blurb="Carrara Bianco, yumuşak gri bulutlanması ve ince damar ağıyla en çok "
              "tanınan beyaz mermerdir; sakin ve dengeli bir zemin kurar.",
        story="Damarları ince ve dağınıktır; bu nedenle geniş yüzeylerde gözü "
              "yormaz ve mekânı büyütür. Klasik ve modern tasarımın ortak paydası "
              "olarak, mermerle ilk kez çalışılan projelerde güvenli bir tercihtir.",
        uses=["Zemin", "Banyo", "Duvar kaplama", "Mozaik"],
    ),
    "mugla-white": dict(
        origin="Türkiye / Muğla",
        color="Kırık beyaz, ince gri hareket",
        blurb="Muğla White, Türkiye'nin en büyük rezervli beyaz mermerlerinden "
              "biridir; homojen dokusu geniş projelerde renk birliği sağlar.",
        story="Yüksek rezervi sayesinde büyük metrajlı projelerde plaka-plaka renk "
              "farkı en aza iner. Bu tutarlılık, otel ve toplu konut projelerinde "
              "Muğla White'ı öne çıkaran temel özelliktir.",
        uses=["Zemin", "Dış cephe", "Merdiven", "Havuz çevresi"],
    ),
    "bianco-ibiza": dict(
        origin="Türkiye / Ege Bölgesi",
        color="Saf beyaz, çok ince gri damar",
        blurb="Bianco Ibiza, neredeyse kar beyazı zemini ve zar zor seçilen damar "
              "yapısıyla minimal tasarımların taşıdır.",
        story="Sadeliği tasarımcıya alan bırakır: taş öne çıkmaz, mekânı taşır. "
              "Honlu yüzeyle mat ve pürüzsüz, cilalı yüzeyle ışıltılı bir etki verir.",
        uses=["Minimal iç mekân", "Banyo", "Duvar", "Zemin"],
    ),

    "portoro-gold": dict(
        origin="İtalya / Liguria",
        color="Derin siyah zemin, altın damar",
        blurb="Portoro Gold, gece siyahı zemininde akan altın sarısı damarlarıyla "
              "dünyanın en prestijli siyah mermerlerinden biridir.",
        story="Adı 'altın liman' anlamına gelir. Damarların yoğunluğu ve altın tonun "
              "saflığı fiyatını belirler. Küçük yüzeylerde bile güçlü bir etki "
              "bıraktığı için genellikle vurgu elemanı olarak kullanılır: bir şömine "
              "cephesi, bir bar önü ya da bir masa tablası.",
        uses=["Şömine", "Bar tezgâhı", "Vurgu duvarı", "Mobilya"],
    ),
    "nero-marquina": dict(
        origin="İspanya / Bask Bölgesi",
        color="Mat siyah zemin, keskin beyaz damar",
        blurb="Nero Marquina, yoğun siyah zemini üzerinde beyaz kalsit damarlarının "
              "yarattığı net kontrastla tanınır.",
        story="Grafik ve keskin görünümü onu modern tasarımın favorisi yapar. Beyaz "
              "mermerle birlikte kullanıldığında güçlü bir zıtlık kurar; satranç "
              "deseni zeminler bu ikilinin klasik uygulamasıdır.",
        uses=["Zemin", "Banyo", "Duvar paneli", "Tezgâh"],
    ),
    "black-marinace": dict(
        origin="Brezilya",
        color="Siyah çimento içinde çakıl dokusu",
        blurb="Black Marinace, doğal çakılların siyah bir bağlayıcı içinde "
              "birleşmesiyle oluşan bir konglomera taşıdır; her plakası benzersizdir.",
        story="Jeolojik olarak bir nehir yatağının fosilleşmiş hâlidir. Yuvarlak "
              "çakıl kesitleri yüzeyde organik bir mozaik oluşturur. Tekrar etmeyen "
              "dokusu nedeniyle uygulamadan önce plaka seçimi yapılması önerilir.",
        uses=["Vurgu duvarı", "Bar önü", "Mobilya", "Resepsiyon"],
    ),
    "fosil-black": dict(
        origin="Türkiye",
        color="Koyu antrasit, açık fosil izleri",
        blurb="Fosil Black, yüzeyinde milyonlarca yıllık deniz canlılarının "
              "kesitlerini taşıyan, eşsiz ve çarpıcı görünümlü bir doğal taştır.",
        story="Her plaka, oluştuğu dönemin izlerini taşır: kabuk kesitleri, halkalar "
              "ve organik lekeler. Bu nedenle iki plakası asla birbirinin aynısı "
              "değildir. Doğal hikâyesini öne çıkarmak isteyen projelerde tercih edilir.",
        uses=["Vurgu duvarı", "Zemin", "Duvar paneli", "Mobilya"],
    ),
    "grafit-grey": dict(
        origin="Türkiye",
        color="Antrasit gri, açık gri damar",
        blurb="Grafit Grey, siyahın sertliğini yumuşatan, çağdaş mekânlar için "
              "dengeli bir koyu gri alternatiftir.",
        story="Siyah kadar keskin olmadan koyu bir zemin arayan projelerin çözümüdür. "
              "Ahşap ve pirinç detaylarla birlikte sıcak-soğuk dengesi kurar.",
        uses=["Zemin", "Cephe", "Banyo", "Merdiven"],
    ),

    "sandian-beige": dict(
        origin="Türkiye",
        color="Kum beji, yumuşak kahve damar",
        blurb="Sandian Beige, kum tonundaki zemini ve yumuşak damar geçişleriyle "
              "mekâna sakin bir sıcaklık kazandırır.",
        story="Ton geçişleri yumuşak olduğu için geniş zeminlerde kesintisiz bir "
              "yüzey algısı yaratır. Doğal ışıkta bej, yapay ışıkta hafif altın bir "
              "tona bürünür.",
        uses=["Zemin", "Otel lobisi", "Dış cephe", "Banyo"],
    ),
    "crema-marfil": dict(
        origin="İspanya / Alicante",
        color="Krem bej, ince damar",
        blurb="Crema Marfil, dünyanın en çok kullanılan bej mermeridir; homojen "
              "yapısıyla büyük projelerde güvenli bir tercih sunar.",
        story="Geniş rezervi ve tutarlı rengi sayesinde onlarca yıldır ticari "
              "projelerin standardı olmuştur. Klasik mobilyayla da modern çizgiyle "
              "de uyum sağlar.",
        uses=["Zemin", "Duvar", "Merdiven", "Süpürgelik"],
    ),
    "emperador-dark": dict(
        origin="İspanya",
        color="Koyu kahve, açık damar ağı",
        blurb="Emperador Dark, çikolata tonundaki zemini üzerinde açık kahve ve "
              "beyaz damar ağıyla mekâna asalet katar.",
        story="Koyu ahşap ve pirinçle kurduğu uyum, onu klasik iç mimarinin "
              "vazgeçilmezi yapar. Küçük yüzeylerde bile derinlik hissi verir.",
        uses=["Duvar paneli", "Banyo", "Mobilya", "Şömine"],
    ),
    "emperador-light": dict(
        origin="İspanya / Türkiye",
        color="Açık kahve, beyaz damar",
        blurb="Emperador Light, koyu kardeşinin sıcaklığını daha aydınlık bir "
              "zeminde sunar; küçük mekânlarda ferahlık sağlar.",
        story="Açık zemini sayesinde dar alanları daraltmaz. Bej ailesiyle birlikte "
              "kullanıldığında katmanlı ve doğal bir palet oluşturur.",
        uses=["Zemin", "Banyo", "Duvar", "Merdiven"],
    ),

    "traverten-classic": dict(
        origin="Türkiye / Denizli",
        color="Açık bej, yatay katman dokusu",
        blurb="Klasik traverten, sıcak bej tonu ve yatay katmanlı dokusuyla "
              "Anadolu'nun en tanınan doğal taşıdır.",
        story="Termal su kaynaklarının binlerce yılda biriktirdiği kireç "
              "katmanlarından oluşur. Damarına dik (vein cut) ya da paralel (cross "
              "cut) kesilmesine göre tamamen farklı iki desen elde edilir.",
        uses=["Dış cephe", "Havuz çevresi", "Zemin", "Teras"],
    ),
    "traverten-noce": dict(
        origin="Türkiye / Denizli",
        color="Ceviz kahvesi, koyu katmanlar",
        blurb="Noce traverten, ceviz tonundaki sıcak rengiyle dış mekânlara "
              "karakter kazandırır.",
        story="Koyu tonu güneş altında ısı tutar; bu nedenle serin iklimlerde teras "
              "ve bahçe uygulamalarında tercih edilir. Eskitme (tumbled) yüzeyle "
              "rustik bir görünüm elde edilir.",
        uses=["Bahçe", "Teras", "Dış cephe", "Duvar"],
    ),
    "silver-travertine": dict(
        origin="Türkiye",
        color="Gümüş gri, koyu katman çizgileri",
        blurb="Silver Travertine, gri tonlarıyla travertenin doğal dokusunu çağdaş "
              "bir palete taşır.",
        story="Damarına dik kesildiğinde uzun ve düzgün çizgiler oluşur; bu desen "
              "modern cephe kaplamalarında güçlü bir ritim yaratır.",
        uses=["Dış cephe", "Duvar kaplama", "Zemin", "Banyo"],
    ),

    "honey-onyx": dict(
        origin="İran / Türkiye",
        color="Bal sarısı, saydam bantlar",
        blurb="Honey Onyx, arkadan aydınlatıldığında bal rengiyle parlayan, ışığı "
              "içinden geçiren yarı saydam bir doğal taştır.",
        story="Oniks, mağaralarda damla damla biriken kalsitten oluşur; bu yüzden "
              "bantlı bir yapısı vardır. Arkadan LED aydınlatma uygulandığında taş "
              "adeta bir ışık kaynağına dönüşür. Kırılgan yapısı nedeniyle file "
              "takviyesiyle sevk edilir.",
        uses=["Arkadan aydınlatmalı panel", "Bar önü", "Resepsiyon", "Duvar"],
    ),
    "white-onyx": dict(
        origin="İran / Pakistan",
        color="Buz beyazı, saydam bant",
        blurb="Bianco Onyx, buzul beyazı tonuyla arkadan aydınlatmada yumuşak ve "
              "eşit bir ışık dağılımı verir.",
        story="Işık geçirgenliği en yüksek oniks türlerindendir. Beyaz zemini, "
              "arkasındaki aydınlatmanın rengini olduğu gibi yansıtır; renkli LED "
              "ile mekânın atmosferi anında değiştirilebilir.",
        uses=["Işıklı panel", "Tavan", "Banyo", "Dekoratif duvar"],
    ),
    "verde-onyx": dict(
        origin="Pakistan / İran",
        color="Zümrüt yeşili, açık bant",
        blurb="Verde Onyx, zümrüt yeşili tonlarıyla mekâna sıra dışı ve değerli bir "
              "karakter kazandırır.",
        story="Yeşil tonu bakır ve demir minerallerinden gelir. Arkadan "
              "aydınlatıldığında derin bir su etkisi oluşturur; spa ve wellness "
              "alanlarında sıkça tercih edilir.",
        uses=["Işıklı panel", "Spa", "Bar önü", "Vurgu duvarı"],
    ),

    "verde-guatemala": dict(
        origin="Hindistan / Guatemala",
        color="Koyu yeşil, beyaz damar ağı",
        blurb="Verde Guatemala, derin orman yeşili zemininde beyaz damar ağıyla "
              "dikkat çeken güçlü bir doğal taştır.",
        story="Serpantin grubundan gelen yapısı, ona diğer mermerlerden farklı bir "
              "yoğunluk verir. Pirinç ve koyu ahşapla kurduğu kontrast, art deco "
              "esintili tasarımların imzasıdır.",
        uses=["Vurgu duvarı", "Mobilya", "Banyo", "Bar"],
    ),
    "rosso-levanto": dict(
        origin="İtalya / Türkiye",
        color="Bordo zemin, beyaz damar",
        blurb="Rosso Levanto, bordo zemini üzerindeki beyaz damar ağıyla mekâna "
              "sıcak ve iddialı bir vurgu katar.",
        story="Kırmızı tonu demir oksitten gelir. Küçük yüzeylerde kullanıldığında "
              "mücevher etkisi yaratır; büyük yüzeylerde ise mekâna güçlü bir kimlik "
              "kazandırır.",
        uses=["Vurgu duvarı", "Banyo", "Mobilya", "Şömine"],
    ),
    "calacatta-viola": dict(
        origin="İtalya / Apuan Alpleri",
        color="Beyaz zemin, mor-bordo damar",
        blurb="Calacatta Viola, beyaz zemininde akan mor ve bordo damarlarıyla son "
              "yılların en çok konuşulan koleksiyon taşıdır.",
        story="Sınırlı ocak rezervi ve dramatik damar yapısı onu nadir kılar. Kitap "
              "açılımı uygulandığında ortaya çıkan simetrik desen, tek başına bir "
              "sanat eseri niteliğindedir.",
        uses=["Vurgu duvarı", "Tezgâh", "Mobilya", "Banyo"],
    ),
}

# Tüm taşlarda ortak teknik bilgiler
COMMON_SPECS = [
    ("Plaka ebatları", "Slab (ocak boyu) · 2400×1200 mm · 1800×600 mm"),
    ("Kalınlıklar", "18 mm · 20 mm · 30 mm (özel kalınlık talebe göre)"),
    ("Yüzey işlemleri", "Cilalı · Honlu · Eskitme · Fırçalı · Kumlama"),
    ("Kenar detayları", "Düz · Pahlı · Bullnose · Ogee (projeye özel)"),
    ("Teslim", "Ahşap sandık · A kalite paketleme · Konteyner yükleme"),
]

FINISHES = ["Cilalı", "Honlu", "Eskitme", "Fırçalı", "Kumlama"]

# ---------------------------------------------------------------------------
# Uygulama alanları
# ---------------------------------------------------------------------------
APPLICATIONS = [
    dict(
        slug="mutfak",
        title="Mutfak Tezgâhı",
        img="calacatta-gold",
        text="Ada tezgâhı ve arka panelde kesintisiz damar akışı için kitap açılımı "
             "uygulanır. Yoğun kullanım gören yüzeylerde 20 mm ve üzeri kalınlık, "
             "leke tutmaya karşı emprenye uygulaması önerilir.",
        points=["Kitap açılımı damar sürekliliği", "20–30 mm kalınlık",
                "Emprenyeli koruma", "Damlalıklı kenar detayı"],
    ),
    dict(
        slug="banyo",
        title="Banyo & Islak Hacim",
        img="statuario",
        text="Duvardan zemine tek taşla kurulan bütünlük, banyoyu spa atmosferine "
             "taşır. Zeminde honlu yüzey kaymayı azaltır; duvarda cilalı yüzey ışığı "
             "çoğaltır.",
        points=["Zeminde honlu yüzey", "Duvarda cilalı bitiş",
                "Tek parça lavabo tezgâhı", "Duş teknesi ve niş çözümleri"],
    ),
    dict(
        slug="zemin",
        title="Zemin Kaplama",
        img="crema-marfil",
        text="Geniş zeminlerde renk birliği için plakaların aynı bloktan seçilmesi "
             "esastır. Derz aralığı 2 mm'nin altında tutularak kesintisiz bir yüzey "
             "algısı elde edilir.",
        points=["Aynı blok seçimi", "Minimum derz", "Radyant ısıtmaya uygun",
                "Yıllık cila bakımı"],
    ),
    dict(
        slug="cephe",
        title="Dış Cephe Kaplama",
        img="silver-travertine",
        text="Havalandırmalı cephe sistemlerinde mekanik ankraj ile uygulanır. Dona "
             "dayanım ve su emme değerleri, iklime göre taş seçimini belirler.",
        points=["Mekanik ankrajlı sistem", "Düşük su emme oranı",
                "Dona dayanıklı taşlar", "30 mm kalınlık"],
    ),
    dict(
        slug="merdiven",
        title="Merdiven & Basamak",
        img="emperador-light",
        text="Basamak burunlarında kaymaz kanal açılır. Rıht ve basamak aynı "
             "bloktan seçilerek renk bütünlüğü korunur.",
        points=["Kaymaz kanal detayı", "Tek blok seçimi",
                "Küpeşte ve süpürgelik uyumu", "3 cm basamak, 2 cm rıht"],
    ),
    dict(
        slug="aydinlatma",
        title="Arkadan Aydınlatmalı Panel",
        img="honey-onyx",
        text="Yarı saydam oniks plakalar, arkalarına yerleştirilen homojen LED "
             "panellerle ışık kaynağına dönüşür. Plaka kalınlığı ışık geçirgenliğini "
             "doğrudan belirler.",
        points=["10–20 mm ince plaka", "Homojen LED arka panel",
                "File takviyeli montaj", "Isı yalıtımlı kasa"],
    ),
]

# ---------------------------------------------------------------------------
# Üretim süreci
# ---------------------------------------------------------------------------
PROCESS = [
    dict(n="01", title="Ocak Seçimi",
         text="Doğru taş, doğru ocakta başlar. Rezerv yapısı, renk tutarlılığı ve "
              "çatlak oranı incelenerek blok kaynağı belirlenir."),
    dict(n="02", title="Blok Kesimi",
         text="Elmas tel testerelerle ocaktan çıkarılan bloklar, damar yönü ve "
              "verim gözetilerek numaralandırılır ve sınıflandırılır."),
    dict(n="03", title="Plaka Kesimi",
         text="Bloklar, çok bıçaklı katrak ya da elmas testerelerle istenen "
              "kalınlıkta plakalara ayrılır. Damar yönü burada belirlenir."),
    dict(n="04", title="Güçlendirme",
         text="Doğal boşluklar epoksi ile doldurulur, gerektiğinde arka yüzeye file "
              "takviyesi yapılarak plaka taşıma dayanımı artırılır."),
    dict(n="05", title="Yüzey İşlemi",
         text="Cilalı, honlu, eskitme, fırçalı ya da kumlama yüzey seçenekleri "
              "uygulanır. Her yüzey, taşın rengini farklı ortaya çıkarır."),
    dict(n="06", title="Kalite Kontrol",
         text="Her plaka; ton, kalınlık toleransı, yüzey kusuru ve ebat açısından "
              "tek tek denetlenir. Onaylanan plakalar demetlenir."),
    dict(n="07", title="Paketleme & Sevkiyat",
         text="Plakalar ahşap sandıklarda, köşe koruyucularla paketlenir. Konteyner "
              "yüklemesi ve ihracat evrakları tarafımızca yürütülür."),
]

# ---------------------------------------------------------------------------
# Referans projeler
# ---------------------------------------------------------------------------
PROJECTS = [
    dict(title="Sahil Rezidans", place="Bodrum, Türkiye", year="2024",
         scope="Zemin, banyo ve havuz çevresi",
         stone="Muğla White · Traverten Classic", img="hero-calacatta"),
    dict(title="Butik Otel Lobisi", place="İstanbul, Türkiye", year="2024",
         scope="Resepsiyon bankosu ve vurgu duvarı",
         stone="Portoro Gold · Honey Onyx", img="bookmatch-portoro-gold"),
    dict(title="Özel Konut", place="Doha, Katar", year="2023",
         scope="Salon zemini ve şömine cephesi",
         stone="Calacatta Gold", img="hero-onyx"),
    dict(title="Kurumsal Merkez", place="Frankfurt, Almanya", year="2023",
         scope="Dış cephe kaplama",
         stone="Silver Travertine", img="band-traverten"),
    dict(title="Wellness & Spa", place="Antalya, Türkiye", year="2022",
         scope="Islak hacim ve ışıklı paneller",
         stone="Verde Onyx · Bianco Ibiza", img="bookmatch-verde-guatemala"),
    dict(title="Tasarım Showroom", place="Milano, İtalya", year="2022",
         scope="Vurgu duvarları ve mobilya yüzeyleri",
         stone="Calacatta Viola", img="bookmatch-calacatta-viola"),
]

# ---------------------------------------------------------------------------
# Kurumsal değerler
# ---------------------------------------------------------------------------
VALUES = [
    dict(n="01", title="Seçkin Kaynak",
         text="Dünyanın dört bir yanındaki ocaklardan yalnızca renk ve doku "
              "tutarlılığı onaylanan bloklar koleksiyonumuza girer."),
    dict(n="02", title="Uzman Ekip",
         text="Lüks mermer konusunda uzmanlaşmış ekibimiz, projenin taş seçiminden "
              "sevkiyatına kadar her aşamasında yanınızdadır."),
    dict(n="03", title="Kalite Güvencesi",
         text="Her plaka; ton, kalınlık, yüzey ve ebat açısından tek tek denetlenir. "
              "Onaylanmayan plaka sevk edilmez."),
    dict(n="04", title="Küresel Sevkiyat",
         text="Yurt içi ve yurt dışı müşterilerimize ihracat evrakları ve konteyner "
              "yüklemesi dâhil uçtan uca lojistik desteği sunuyoruz."),
]

STATS = [
    dict(num="20", suffix="+", label="Yıllık Deneyim"),
    dict(num="40", suffix="+", label="Ülkeye İhracat"),
    dict(num="120", suffix="+", label="Taş Çeşidi"),
    dict(num="850", suffix="+", label="Tamamlanan Proje"),
]

# ---------------------------------------------------------------------------
# Sıkça sorulan sorular
# ---------------------------------------------------------------------------
FAQ = [
    ("Numune talep edebilir miyim?",
     "Evet. İletişim formundan ilgilendiğiniz taşları belirterek numune talebinde "
     "bulunabilirsiniz. Yurt içi ve yurt dışı numune gönderimi yapıyoruz."),
    ("Plaka seçimini kendim yapabilir miyim?",
     "Elbette. Doğal taşta her plaka benzersiz olduğu için, özellikle vurgu "
     "yüzeylerinde plaka seçiminin bizzat yapılmasını öneriyoruz. Depomuzu ziyaret "
     "edebilir ya da numaralandırılmış plaka fotoğraflarını talep edebilirsiniz."),
    ("Kitap açılımı (bookmatch) nedir?",
     "Aynı bloktan ardışık kesilen iki plakanın birbirinin aynası gibi yan yana "
     "getirilmesidir. Damarlar simetrik olarak buluşur ve duvarda tablo etkisinde "
     "bir kompozisyon oluşur."),
    ("Mermer mutfak tezgâhında kullanılabilir mi?",
     "Kullanılabilir. Mermer asidik maddelere karşı hassastır; limon, sirke ve şarap "
     "gibi maddelerin yüzeyde bekletilmemesi gerekir. Emprenye uygulaması ve düzenli "
     "bakımla uzun yıllar sorunsuz kullanılır."),
    ("Hangi yüzey işlemini seçmeliyim?",
     "Cilalı yüzey rengi derinleştirir ve ışığı yansıtır; iç mekân duvar ve "
     "tezgâhlarda idealdir. Honlu yüzey mattır ve kaymayı azaltır; zeminler ve ıslak "
     "hacimler için önerilir. Eskitme ve fırçalı yüzeyler rustik bir doku verir."),
    ("Minimum sipariş miktarı var mı?",
     "Proje ölçeğine göre değişir. Hem tek plaka hem de konteyner bazlı sevkiyat "
     "yapabiliyoruz. Talebinizi iletmeniz hâlinde size özel fiyat çalışması hazırlarız."),
    ("Teslim süresi ne kadar?",
     "Stoktaki taşlar için hazırlık 3–7 iş günüdür. Özel kesim, özel ebat ve özel "
     "yüzey işlemlerinde süre projeye göre belirlenir ve teklifte açıkça belirtilir."),
    ("İhracat evraklarını siz mi hazırlıyorsunuz?",
     "Evet. Fatura, çeki listesi, menşe şahadetnamesi ve gerekli tüm ihracat "
     "belgeleri tarafımızca hazırlanır; konteyner yüklemesi bizim koordinasyonumuzda "
     "gerçekleşir."),
]

# ---------------------------------------------------------------------------
# Mermer bakım rehberi
# ---------------------------------------------------------------------------
CARE = [
    dict(title="Günlük Temizlik",
         text="Ilık su ve pH nötr temizleyici yeterlidir. Yumuşak bir mikrofiber bez "
              "kullanın ve yüzeyi mutlaka kurulayın. Su lekesi bırakmamak için "
              "silme yönünü tek yönde tutun."),
    dict(title="Kaçınılması Gerekenler",
         text="Limon, sirke, çamaşır suyu ve asitli banyo temizleyicileri mermerin "
              "yüzeyini matlaştırır. Aşındırıcı sünger ve ovma tozları da cilaya "
              "kalıcı zarar verir."),
    dict(title="Leke Müdahalesi",
         text="Dökülen sıvıya hemen müdahale edin; silmek yerine emdirerek alın. "
              "Yağ lekelerinde talk pudrası ile lapa uygulaması, organik lekelerde "
              "seyreltik hidrojen peroksit sonuç verir."),
    dict(title="Emprenye (Koruma)",
         text="Mermer gözenekli bir taştır. Yılda bir kez uygulanan su ve yağ itici "
              "emprenye, sıvıların yüzeyden içeri işlemesini geciktirir ve temizliği "
              "kolaylaştırır."),
    dict(title="Cila Yenileme",
         text="Yoğun kullanılan zeminlerde 3–5 yılda bir profesyonel cila yenileme "
              "önerilir. Bu işlem yüzeydeki mikro çizikleri alarak taşın ilk günkü "
              "parlaklığına dönmesini sağlar."),
    dict(title="Fiziksel Koruma",
         text="Sıcak tencereleri doğrudan tezgâha koymayın, altlık kullanın. "
              "Giriş bölgelerine paspas serilmesi, ayakkabıyla taşınan kumun zemini "
              "aşındırmasını büyük ölçüde önler."),
]
