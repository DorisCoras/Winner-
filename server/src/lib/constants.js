// Uygulama genelinde kullanılan sabit listeler. İstemci bunları /api/lookups üzerinden alır.

export const ROLES = {
  admin: 'Sistem Yöneticisi',
  ik: 'İK Uzmanı',
  yonetici: 'Yönetici',
  personel: 'Personel',
};

export const EMPLOYMENT_TYPES = {
  tam_zamanli: 'Tam Zamanlı',
  yari_zamanli: 'Yarı Zamanlı',
  belirli_sureli: 'Belirli Süreli',
  stajyer: 'Stajyer',
  danisman: 'Danışman',
};

export const EDUCATION_LEVELS = ['İlköğretim', 'Lise', 'Ön Lisans', 'Lisans', 'Yüksek Lisans', 'Doktora'];

export const MARITAL_STATUSES = ['Bekar', 'Evli', 'Boşanmış', 'Dul'];

export const BLOOD_TYPES = ['0 Rh+', '0 Rh-', 'A Rh+', 'A Rh-', 'B Rh+', 'B Rh-', 'AB Rh+', 'AB Rh-'];

export const LEAVE_STATUSES = {
  beklemede: 'Onay Bekliyor',
  onaylandi: 'Onaylandı',
  reddedildi: 'Reddedildi',
  iptal: 'İptal Edildi',
};

// SGK işten çıkış kodlarından sık kullanılanlar. kidem/ihbar alanları varsayılan tazminat
// hakkını gösterir; hesaplama ekranında elle değiştirilebilir (hukuki görüş yerine geçmez).
export const EXIT_CODES = [
  { code: '01', label: 'Deneme süreli sözleşmenin işverence feshi', kidem: false, ihbar: false },
  { code: '02', label: 'Deneme süreli sözleşmenin işçi tarafından feshi', kidem: false, ihbar: false },
  { code: '03', label: 'Belirsiz süreli sözleşmenin işçi tarafından feshi (istifa)', kidem: false, ihbar: false },
  { code: '04', label: 'Belirsiz süreli sözleşmenin işveren tarafından haklı sebep bildirilmeden feshi', kidem: true, ihbar: true },
  { code: '05', label: 'Belirli süreli iş sözleşmesinin sona ermesi', kidem: false, ihbar: false },
  { code: '08', label: 'Emeklilik (yaşlılık) veya toptan ödeme', kidem: true, ihbar: false },
  { code: '10', label: 'Ölüm', kidem: true, ihbar: false },
  { code: '12', label: 'Askerlik', kidem: true, ihbar: false },
  { code: '13', label: 'Kadın işçinin evlenmesi', kidem: true, ihbar: false },
  { code: '14', label: 'Emeklilik için yaş dışındaki şartların tamamlanması', kidem: true, ihbar: false },
  { code: '17', label: 'İşyerinin kapanması', kidem: true, ihbar: true },
  { code: '22', label: 'Diğer nedenler', kidem: false, ihbar: false },
  { code: '23', label: 'İşçi tarafından zorunlu nedenle fesih', kidem: true, ihbar: false },
  { code: '24', label: 'İşçi tarafından sağlık nedeniyle fesih', kidem: true, ihbar: false },
  { code: '25', label: 'İşçi tarafından işverenin ahlak ve iyi niyet kurallarına aykırı davranışı nedeniyle fesih', kidem: true, ihbar: false },
  { code: '27', label: 'İşveren tarafından zorunlu nedenlerle fesih', kidem: true, ihbar: false },
  { code: '28', label: 'İşveren tarafından sağlık nedeniyle fesih', kidem: true, ihbar: false },
  { code: '29', label: 'İşveren tarafından işçinin ahlak ve iyi niyet kurallarına aykırı davranışı nedeniyle fesih', kidem: false, ihbar: false },
];

// Özlük dosyasında bulunması gereken belgeler.
export const DOCUMENT_TYPES = [
  { code: 'kimlik', label: 'Nüfus cüzdanı fotokopisi', required: true },
  { code: 'ikametgah', label: 'İkametgah belgesi', required: true },
  { code: 'adli_sicil', label: 'Adli sicil kaydı', required: true },
  { code: 'diploma', label: 'Diploma / öğrenim belgesi', required: true },
  { code: 'saglik_raporu', label: 'Sağlık raporu (işe giriş muayenesi)', required: true },
  { code: 'is_sozlesmesi', label: 'İş sözleşmesi', required: true },
  { code: 'sgk_giris', label: 'SGK işe giriş bildirgesi', required: true },
  { code: 'kvkk', label: 'KVKK aydınlatma metni ve açık rıza', required: true },
  { code: 'fotograf', label: 'Vesikalık fotoğraf', required: false },
  { code: 'askerlik', label: 'Askerlik durum belgesi', required: false },
  { code: 'isg_egitimi', label: 'İSG eğitim sertifikası', required: false },
  { code: 'ehliyet', label: 'Sürücü belgesi', required: false },
];

export const ASSET_CATEGORIES = ['Bilgisayar', 'Telefon', 'Tablet', 'Monitör', 'Araç', 'Kartvizit / Kart', 'Anahtar', 'İş Kıyafeti', 'Diğer'];

export const ASSET_STATUSES = {
  depoda: 'Depoda',
  zimmetli: 'Zimmetli',
  arizali: 'Arızalı',
  hurda: 'Hurda',
};

export const JOB_STATUSES = { acik: 'Açık', beklemede: 'Beklemede', kapali: 'Kapalı' };

export const CANDIDATE_STAGES = {
  basvuru: 'Başvuru',
  on_eleme: 'Ön Eleme',
  mulakat: 'Mülakat',
  teklif: 'Teklif',
  ise_alindi: 'İşe Alındı',
  red: 'Reddedildi',
};

export const CANDIDATE_SOURCES = ['Kariyer.net', 'LinkedIn', 'Şirket web sitesi', 'Referans', 'İŞKUR', 'Üniversite', 'Diğer'];

export const REVIEW_CRITERIA = [
  { code: 'is_kalitesi', label: 'İş Kalitesi' },
  { code: 'verimlilik', label: 'Verimlilik' },
  { code: 'mesleki_bilgi', label: 'Mesleki Bilgi' },
  { code: 'takim_calismasi', label: 'Takım Çalışması' },
  { code: 'iletisim', label: 'İletişim' },
  { code: 'inisiyatif', label: 'İnisiyatif ve Problem Çözme' },
  { code: 'zaman_yonetimi', label: 'Zaman Yönetimi' },
];

export const DEFAULT_LEAVE_TYPES = [
  { code: 'yillik', name: 'Yıllık İzin', deducts_balance: 1, paid: 1, max_days: null, color: '#2563eb', sort: 1 },
  { code: 'mazeret', name: 'Mazeret İzni', deducts_balance: 0, paid: 1, max_days: 3, color: '#0891b2', sort: 2 },
  { code: 'hastalik', name: 'Hastalık İzni (Rapor)', deducts_balance: 0, paid: 1, max_days: null, color: '#dc2626', sort: 3 },
  { code: 'ucretsiz', name: 'Ücretsiz İzin', deducts_balance: 0, paid: 0, max_days: null, color: '#6b7280', sort: 4 },
  { code: 'evlilik', name: 'Evlilik İzni', deducts_balance: 0, paid: 1, max_days: 3, color: '#db2777', sort: 5 },
  { code: 'olum', name: 'Ölüm İzni', deducts_balance: 0, paid: 1, max_days: 3, color: '#374151', sort: 6 },
  { code: 'babalik', name: 'Babalık İzni', deducts_balance: 0, paid: 1, max_days: 5, color: '#7c3aed', sort: 7 },
  { code: 'dogum', name: 'Doğum İzni', deducts_balance: 0, paid: 1, max_days: 112, color: '#ea580c', sort: 8 },
  { code: 'sut', name: 'Süt İzni', deducts_balance: 0, paid: 1, max_days: null, color: '#ca8a04', sort: 9 },
  { code: 'resmi_gorev', name: 'Görevli / Eğitim', deducts_balance: 0, paid: 1, max_days: null, color: '#059669', sort: 10 },
];

// Resmi tatiller (dini bayram tarihleri Diyanet takvimine göredir; yıllık kontrol edilmelidir).
export const DEFAULT_HOLIDAYS = [
  ['2026-01-01', 'Yılbaşı', 0],
  ['2026-03-19', 'Ramazan Bayramı Arifesi', 1],
  ['2026-03-20', 'Ramazan Bayramı 1. Gün', 0],
  ['2026-03-21', 'Ramazan Bayramı 2. Gün', 0],
  ['2026-03-22', 'Ramazan Bayramı 3. Gün', 0],
  ['2026-04-23', 'Ulusal Egemenlik ve Çocuk Bayramı', 0],
  ['2026-05-01', 'Emek ve Dayanışma Günü', 0],
  ['2026-05-19', 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı', 0],
  ['2026-05-26', 'Kurban Bayramı Arifesi', 1],
  ['2026-05-27', 'Kurban Bayramı 1. Gün', 0],
  ['2026-05-28', 'Kurban Bayramı 2. Gün', 0],
  ['2026-05-29', 'Kurban Bayramı 3. Gün', 0],
  ['2026-05-30', 'Kurban Bayramı 4. Gün', 0],
  ['2026-07-15', 'Demokrasi ve Milli Birlik Günü', 0],
  ['2026-08-30', 'Zafer Bayramı', 0],
  ['2026-10-28', 'Cumhuriyet Bayramı Arifesi', 1],
  ['2026-10-29', 'Cumhuriyet Bayramı', 0],
  ['2027-01-01', 'Yılbaşı', 0],
  ['2027-03-08', 'Ramazan Bayramı Arifesi', 1],
  ['2027-03-09', 'Ramazan Bayramı 1. Gün', 0],
  ['2027-03-10', 'Ramazan Bayramı 2. Gün', 0],
  ['2027-03-11', 'Ramazan Bayramı 3. Gün', 0],
  ['2027-04-23', 'Ulusal Egemenlik ve Çocuk Bayramı', 0],
  ['2027-05-01', 'Emek ve Dayanışma Günü', 0],
  ['2027-05-15', 'Kurban Bayramı Arifesi', 1],
  ['2027-05-16', 'Kurban Bayramı 1. Gün', 0],
  ['2027-05-17', 'Kurban Bayramı 2. Gün', 0],
  ['2027-05-18', 'Kurban Bayramı 3. Gün', 0],
  ['2027-05-19', 'Kurban Bayramı 4. Gün / Atatürk\'ü Anma, Gençlik ve Spor Bayramı', 0],
  ['2027-07-15', 'Demokrasi ve Milli Birlik Günü', 0],
  ['2027-08-30', 'Zafer Bayramı', 0],
  ['2027-10-28', 'Cumhuriyet Bayramı Arifesi', 1],
  ['2027-10-29', 'Cumhuriyet Bayramı', 0],
];
