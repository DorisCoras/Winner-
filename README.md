# FIMAR Holding İK Yönetim Sistemi

FIMAR Holding ve grup şirketleri için geliştirilmiş, Türkçe arayüzlü **İnsan Kaynakları yönetim uygulaması**.
Personel özlük bilgilerinden izin ve bordroya, işe alımdan zimmet ve performans yönetimine kadar İK süreçlerini
tek bir web uygulamasında toplar. Türkiye mevzuatına (4857 sayılı İş Kanunu, SGK ve gelir vergisi kuralları)
göre hesaplama yapar.

## Özellikler

| Modül | İçerik |
|---|---|
| **Gösterge paneli** | Role göre özetler: personel sayısı, bekleyen onaylar, bugün izinliler, açık pozisyonlar, bordro maliyeti, iş yıldönümleri, deneme süresi bitenler, eksik/süresi dolan özlük belgeleri, duyurular |
| **Personel** | Çok şirketli (holding + grup şirketleri) yapı, departman ve yönetici hiyerarşisi, T.C. Kimlik No ve IBAN doğrulama, özlük dosyası belge takibi, işten çıkış (SGK çıkış kodları) ve yeniden işe alım, Excel'e aktarma |
| **Kıdem / ihbar** | İşten çıkışta kıdem tazminatı (tavan kontrolü), ihbar tazminatı (2–8 hafta) ve kullanılmayan izin ücreti ön hesabı |
| **İzin yönetimi** | İş Kanunu m.53'e göre otomatik yıllık izin hakedişi (14/20/26 gün, 18 yaş altı–50 yaş üstü en az 20 gün), hafta sonu ve resmi tatilleri (arife yarım gün) düşen gün hesabı, yönetici/İK onay akışı, ekip izin takvimi |
| **Bordro** | Brütten nete / netten brüte hesaplama, kümülatif gelir vergisi matrahı, asgari ücret gelir ve damga vergisi istisnası, SGK tavanı, 5 puanlık işveren teşviki; şirket bazında aylık bordro dönemleri, ek ödeme/kesinti, onay kilidi, bordro pusulası, banka ödeme listesi |
| **İşe alım** | İlan yönetimi, aday havuzu (Kanban: başvuru → ön eleme → mülakat → teklif → işe alındı), adaydan tek tıkla personel kaydı |
| **Performans** | Yetkinlik bazlı (1–5) değerlendirme, taslak/tamamlandı akışı, çalışanın "okudum" onayı |
| **Zimmet** | Demirbaş envanteri, zimmetleme/iade, zimmet geçmişi, yazdırılabilir zimmet tutanağı |
| **Duyurular, rehber, organizasyon şeması** | Grup geneli veya şirkete özel duyurular, personel rehberi, yönetim hiyerarşisi ağacı |
| **Raporlar** | Personel dağılımı (şirket, departman, cinsiyet, yaş, kıdem), giriş-çıkış ve devir oranı, izin kullanımı, bordro maliyeti |
| **Belgeler** | Çalışma belgesi (İş K. m.28), bordro pusulası, zimmet tutanağı – yazdırılabilir |
| **Yönetim** | Kullanıcılar ve roller, izin türleri, resmi tatiller, yıllık bordro parametreleri, genel ayarlar, işlem geçmişi (audit log) |

### Roller ve yetkiler

| Rol | Yetki |
|---|---|
| **Sistem Yöneticisi** (`admin`) | Her şey + kullanıcı yönetimi, işlem geçmişi, kayıt silme |
| **İK Uzmanı** (`ik`) | Tüm personel, izin, bordro, işe alım, zimmet, rapor ve ayarlar |
| **Yönetici** (`yonetici`) | Kendi ekibini (doğrudan ve dolaylı bağlılar) görür, ekibinin izinlerini onaylar, performans değerlendirmesi yapar |
| **Personel** (`personel`) | Kendi profili, izin talepleri, bordro pusulaları, zimmetleri, değerlendirmeleri; rehber ve duyurular |

**KVKK:** T.C. Kimlik No, maaş, IBAN, adres, kan grubu gibi kişisel veriler yalnızca İK yetkilileri ve çalışanın
kendisine gösterilir. İzin takviminde sağlık verisi içerebilecek izin türleri yetkisiz kişilere "İzinli" olarak
maskelenir. Tüm değişiklikler işlem geçmişine kaydedilir.

## Hızlı başlangıç

Gereksinim: **Node.js 22.13 veya üzeri** (yerleşik `node:sqlite` kullanılır; ayrı bir veritabanı sunucusu gerekmez).

```bash
npm install          # bağımlılıkları kur
npm run seed         # (isteğe bağlı) veritabanını sıfırla ve demo verisini yükle
npm run dev          # API (http://localhost:3000) + arayüz (http://localhost:5173)
```

Tarayıcıda **http://localhost:5173** adresini açın.

### Demo hesapları

Geliştirme ortamında ilk çalıştırmada kurgusal demo verisi (4 şirket, ~50 personel, izinler, bordrolar,
adaylar, zimmetler) yüklenir. Tüm hesapların şifresi **`Demo1234`**:

| E-posta | Rol |
|---|---|
| `admin@fimar.com.tr` | Sistem Yöneticisi |
| `ik@fimar.com.tr` | İK Uzmanı |
| `yonetici@fimar.com.tr` | Yönetici (Yazılım Geliştirme) |
| `personel@fimar.com.tr` | Personel |

> Demo verisindeki kişi, T.C. Kimlik No, IBAN ve "Örnek …" grup şirketleri tamamen kurgusaldır.

## Canlı ortama alma

```bash
npm run build                                   # arayüzü client/dist klasörüne derler
NODE_ENV=production SEED_DEMO=false \
ADMIN_EMAIL=ik.admin@fimar.com.tr ADMIN_PASSWORD='GucluSifre2026' \
DB_PATH=/var/lib/fimar-ik/fimar-ik.db \
npm start                                       # http://localhost:3000
```

Üretimde API ve derlenmiş arayüz aynı porttan sunulur. İlk açılışta yalnızca holding şirketi, izin türleri,
resmi tatiller, bordro parametreleri ve bir yönetici hesabı oluşturulur; yönetici ilk girişte şifresini
değiştirmek zorundadır. Uygulamayı HTTPS sunan bir ters vekil sunucunun (nginx, IIS, Caddy vb.) arkasında
çalıştırın ve `TRUST_PROXY=true` ayarlayın. Tüm ayarlar için `.env.example` dosyasına bakın.

### Docker

```bash
docker build -t fimar-ik .
docker run -d -p 3000:3000 -v fimar-ik-data:/data \
  -e ADMIN_EMAIL=ik.admin@fimar.com.tr -e ADMIN_PASSWORD='GucluSifre2026' \
  -e COOKIE_SECURE=false fimar-ik        # HTTPS arkasında COOKIE_SECURE=true bırakın
```

### Yedekleme

Tüm veriler tek bir SQLite dosyasındadır (`DB_PATH`). Düzenli yedek için uygulama çalışırken
`sqlite3 fimar-ik.db ".backup yedek.db"` komutunu veya dosya sistemi anlık görüntülerini kullanın.

## Mevzuat parametreleri — önemli

Bordro ve tazminat hesapları **Ayarlar → Bordro Parametreleri** ekranındaki yıllık değerlerle yapılır.
2025 ve 2026 için varsayılan değerler yüklüdür (2026: brüt asgari ücret 33.030 TL, gelir vergisi dilimleri
190.000 / 400.000 / 1.500.000 / 5.300.000 TL, SGK işçi %14 + işsizlik %1, damga vergisi ‰7,59).
**SGK işveren oranları, teşvikler, SGK tavan katsayısı ve kıdem tazminatı tavanı dönemsel olarak değişir;
canlı kullanımdan önce ve her dönem başında mali müşaviriniz/muhasebe biriminizle doğrulayın.**
Resmi tatillerdeki dini bayram tarihleri de her yıl Diyanet takvimine göre kontrol edilmelidir.

Uygulama muhasebe/bordro yazılımının yerine geçmez; hesaplamalar ön hesap ve kontrol amaçlıdır.

## Proje yapısı

```
server/                Express 5 API + SQLite (node:sqlite)
  src/schema.sql       Veritabanı şeması
  src/lib/             İş kuralları: izin (leave.js), bordro (payroll.js), tazminat (severance.js),
                       doğrulayıcılar (T.C. Kimlik, IBAN), sabit listeler
  src/routes/          API uç noktaları (auth, personel, izin, bordro, işe alım, zimmet, …)
  src/seed.js          Demo verisi üreticisi
  test/                Birim ve API testleri (node:test)
client/                React 19 + Vite arayüz
  src/pages/           Sayfalar
  src/components/      Ortak bileşenler (tablo, modal, form, grafik, menü)
scripts/dev.mjs        API + arayüzü birlikte başlatır
```

## Geliştirme

```bash
npm test             # sunucu testleri (izin hakedişi, bordro, tazminat, doğrulayıcılar, API yetkileri)
npm run build        # arayüz derlemesi
```

Tüm API uç noktaları `/api` altındadır ve oturum çerezi (HttpOnly, SameSite=Strict) ile korunur.
