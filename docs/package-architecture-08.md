# Paket Mimarisi 08 — İş Verisi Kapsam Migrasyonu

Bu çalışma tek paket olarak yürütülür ancak geri dönüşsüz risk oluşturmamak için
zorunlu kapıları sırasıyla geçer:

1. Salt-okunur canlı tablo ve kolon envanteri
2. Kısmi kolon çakışması ve kurulu olmayan modül analizi
3. Kesin hedef tablo listesi
4. Kapsam kolonları, birleşik yabancı anahtarlar ve indeksler
5. Mevcut kayıtların CEYLIN/MERKEZ/2026 varsayılan kapsamına bağlanması
6. Uygulama yazma yolları kapsamı gönderdikten sonra NOT NULL sıkılaştırması
7. Canlı doğrulama
8. Uygulama regresyonu
9. Geri alma doğrulaması

İlk envanter sonucu görülmeden sonraki SQL hazırlanmaz. `PARTIAL_SCOPE_COLLISION`
bulgusu migrasyonu durdurur. Kurulu olmayan stok, üretim veya finans tablosu
tahminle oluşturulmaz; ilgili modülün kalıcı veri modeli aşamasına bırakılır.

Uygulama yazma yolları dört kapsam kolonunu göndermeden `NOT NULL` uygulanmaz.
Kapsam kolonları, yabancı anahtarlar, indeksler ve mevcut kayıtların geri
doldurulması korunurken yeni legacy yazımlar geçici olarak nullable kalır.

Canlı migrasyon ayrıca açık onay gerektirir. Commit, push ve deploy bu paketin
otomatik parçası değildir.
