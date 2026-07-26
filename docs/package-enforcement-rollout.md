# Paket Mimarisi 07 — Kontrollü Gerçek Yetkilendirme

## 07-A durumu

Geçiş kapısı hazırlanmıştır ancak hiçbir ekran veya API bu kapıya bağlanmamıştır.
Varsayılan mod `shadow` değeridir ve mevcut erişim kararını aynen korur.

## Geçiş modları

- `shadow`: Yalnız karşılaştırır; mevcut erişim uygulanır.
- `pilot`: Yalnız açıkça listelenen pilot özelliklerde paket kararı uygulanabilir.
- `full`: Tüm özelliklerde paket kararı uygulanabilir.

`pilot` veya `full` seçilmiş olsa bile işletme kararları çözülmemişse kapı mevcut
erişimi korur. Bilinmeyen ortam değeri de güvenli biçimde `shadow` kabul edilir.

## 07-B onaylanan yetki matrisi

Yetki matrisi kullanıcı tarafından 2026-07-26 tarihinde onaylanmıştır.

- ADMIN bütün özellikleri, sistem ayarlarını, paket lisansını ve kapsamları
  yönetebilir.
- MODERATOR operasyon özelliklerini kullanabilir ve yalnız atanmış kapsamlar
  arasında seçim yapabilir; sistem ayarı ve paket lisansı yönetemez.
- OFFICE operasyon özelliklerini kullanabilir ve yalnız atanmış kapsamlar
  arasında seçim yapabilir; sistem ayarı ve paket lisansı yönetemez.
- FIELD ölçü özelliğini yalnız görev/sahiplik sınırında kullanır.
- TAILOR atanmış üretim işlerini ve kendi hakedişini görür; ücret kuralını
  değiştiremez.
- INSTALLER atanmış montaj işlerini ve kendi hakedişini görür; ücret kuralını
  değiştiremez.
- ACCOUNTING yalnız temel finans ve cari finans özelliklerini varsayılan
  kapsamında kullanır.

Bu sözleşme henüz ekran veya API erişimine bağlanmamıştır.

## Aktivasyon ön koşulları

1. 06-I içindeki altı işletme kararının kullanıcı tarafından onaylanması
2. Pilot özellik ve pilot rolün açıkça seçilmesi
3. Mevcut davranış, gölge davranış ve beklenen davranış kayıtlarının çıkarılması
4. Geri alma komutunun hazır olması
5. Dar regresyon ve tam sistem regresyonunun exit code 0 olması
6. Canlı smoke kontrolü için ayrıca açık onay verilmesi

## Önerilen ilk pilot

İlk pilot için `measurement` özelliği önerilir; merkezi ölçü doğruluğu bütün
paketlerde korunur. Ancak rol ve sahiplik kuralları ayrıca doğrulanmadan bu pilot
da etkinleştirilmez.

## 07-C ölçü pilot karar hattı

Ölçü özelliği onaylı rol matrisi, paket lisansı, kullanıcı özellik kısıtı ve
geçiş kapısıyla sunucu tarafında birlikte değerlendirilmektedir. Sonuç yalnız
`/api/erp-context` tanı yanıtında ve Ayarlar gölge kartında gösterilir. Ölçü
sayfası veya ölçü kayıt API'leri bu kararla henüz engellenmez.

## 07-D/E/F birleşik final hazırlığı

- FIELD için atanmış kullanıcı veya kayıt sahibi olma şartı modellenmiştir.
- Tenant, şirket, şube ve muhasebe dönemi kapsam eşitliği doğrulanır.
- ADMIN, MODERATOR ve OFFICE ölçü özelliğini kullanabilir.
- ACCOUNTING, TAILOR ve INSTALLER ölçü özelliğini kullanamaz.
- `shadow` geri dönüşü mevcut erişimi aynen geri getirir.
- Aktivasyon hazır olma denetimi açık `activationApproved` değeri olmadan
  hiçbir zaman hazır sonucu vermez.

Bu final hazırlığı gerçek ölçü ekranına veya kayıt API'sine bağlanmamıştır.

## Geri alma

Pilot sırasında beklenmeyen erişim farkında çalışma modu `shadow` yapılır ve
mevcut erişim kararı anında yeniden esas alınır. Veritabanı şeması veya kullanıcı
kayıtları bu kapı tarafından değiştirilmez.

## Değişiklik sınırı

07-A kapsamında canlı veritabanı yazımı, gerçek yetki aktivasyonu, commit, push
ve deploy yoktur.
