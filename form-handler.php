<?php
/**
 * Winner Marble — iletişim formu alıcısı.
 *
 * Bu dosya ZORUNLU DEĞİLDİR. Sunucunuzda PHP yoksa ya da bu dosyayı
 * yüklemezseniz form, ziyaretçinin e-posta uygulamasını açarak çalışmaya
 * devam eder (assets/js/site.js içindeki yedek davranış).
 *
 * Kurulum:
 *   1. $ALICI adresini kendi e-posta adresinizle değiştirin.
 *   2. Dosyayı sitenin kök dizinine yükleyin.
 *   3. Hosting panelinizde PHP mail() fonksiyonunun açık olduğundan emin olun.
 */

declare(strict_types=1);

// ---------------------------------------------------------------- ayarlar
$ALICI  = 'info@winnermarble.com';          // teklif taleplerinin gideceği adres
$KONU_ON = '[winnermarble.com] Teklif talebi';

// Gönderen olarak kendi alan adınızdaki bir adresi kullanın; ziyaretçinin
// adresini From alanına koymak SPF/DKIM nedeniyle teslimatı bozar.
$GONDEREN = 'noreply@winnermarble.com';

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method']);
    exit;
}

/** Başlık enjeksiyonunu önlemek için satır sonlarını temizler. */
function tek_satir(string $v): string
{
    return trim(str_replace(["\r", "\n", "%0a", "%0d"], ' ', $v));
}

function alan(string $ad, int $max = 2000): string
{
    $v = (string) ($_POST[$ad] ?? '');
    $v = trim($v);
    if (function_exists('mb_substr')) {
        return mb_substr($v, 0, $max);
    }
    return substr($v, 0, $max);
}

// ---------------------------------------------------------------- bot tuzağı
// Gerçek kullanıcılar bu alanı görmediği için dolu gelmesi bot demektir.
if (alan('website') !== '') {
    echo json_encode(['ok' => true]);   // bota başarı döndür, e-posta gönderme
    exit;
}

// ---------------------------------------------------------------- doğrulama
$ad      = tek_satir(alan('name', 120));
$eposta  = tek_satir(alan('email', 160));
$telefon = tek_satir(alan('phone', 60));
$konu    = tek_satir(alan('subject', 120));
$mesaj   = alan('message', 5000);

if ($ad === '' || $eposta === '' || $mesaj === '') {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'eksik_alan']);
    exit;
}

if (!filter_var($eposta, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'gecersiz_eposta']);
    exit;
}

// ---------------------------------------------------------------- gönderim
$govde = "Yeni teklif talebi\n"
    . str_repeat('-', 40) . "\n"
    . "Ad Soyad : {$ad}\n"
    . "E-posta  : {$eposta}\n"
    . "Telefon  : " . ($telefon !== '' ? $telefon : '-') . "\n"
    . "İlgi     : " . ($konu !== '' ? $konu : '-') . "\n"
    . str_repeat('-', 40) . "\n\n"
    . $mesaj . "\n\n"
    . str_repeat('-', 40) . "\n"
    . 'IP    : ' . ($_SERVER['REMOTE_ADDR'] ?? '-') . "\n"
    . 'Tarih : ' . date('d.m.Y H:i') . "\n";

$basliklar = [
    'From: Winner Marble <' . $GONDEREN . '>',
    'Reply-To: ' . $ad . ' <' . $eposta . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
    'X-Mailer: PHP/' . phpversion(),
];

$konuBasligi = $KONU_ON . ' — ' . $ad;
if (function_exists('mb_encode_mimeheader')) {
    $konuBasligi = mb_encode_mimeheader($konuBasligi, 'UTF-8');
}

$gonderildi = @mail($ALICI, $konuBasligi, $govde, implode("\r\n", $basliklar));

if (!$gonderildi) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'gonderilemedi']);
    exit;
}

echo json_encode(['ok' => true]);
