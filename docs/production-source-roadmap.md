# Üretim, Stok ve Tedarik Yol Haritası

Bu belge, üretim kaynağı geliştirmelerinin sırasını ve güvenlik sınırlarını kalıcı
olarak kaydeder. Tamamlanmamış bir aşama canlı sisteme bağlanmış kabul edilmez.

## Tamamlanan temel kontroller

- 07-A: Satıştan üretim/terzi işine güvenli veri köprüsü
- 07-B: Üretim en, boy, adet, metre ve pile verilerinin doğrulanması
- 07-C: Üretim durum geçişleri ve yetki kontrolleri

## Sıradaki aşamalar

### 07-D — Üretim kaynağı modeli

- Mağaza kesimi, hazır stok ve tedarikçi siparişi kaynaklarını ayırmak
- Aynı üretim kaleminde karma kaynağı desteklemek
- Eksik ve fazla kaynak tahsisini görünür kılmak
- Terzi rolünün kaynak kararlarını değiştirmesini engellemek

Bu aşama yalnız bağımsız alan modeli ve testlerden oluşur. Henüz stok düşmez,
rezervasyon veya tedarikçi siparişi oluşturmaz.

### 07-E — Hazırlık ve tamamlanma durumları

- Terzi ekranında bekleyen/hazır ayrımı
- Kısmi hazır ve tümü hazır hesabı
- Kaynakların üretime hazır olma durumunun tek merkezden hesaplanması

Saf hesaplama modeli ve regresyon paketi hazırlanmıştır. Mevcut üretim ekranına
bağlantı, testler tamamlandıktan sonra ayrıca ve kontrollü biçimde yapılacaktır.
İptal edilen kalemler hazır sayısına veya tamamlanma yüzdesine dahil edilmez.

### 07-F — Mükerrer işlem engelleri

- Mükerrer stok rezervasyonu
- Mükerrer tedarikçi siparişi
- Mükerrer iş emri
- Tekrarlanan isteğin mevcut sonucu bozmaması

### 07-G — Yetki ve modüller arası bağ güvenliği

- Terzinin kaynak ve tedarik bilgilerini değiştirememesi
- Satış, stok, satın alma ve üretim bağlantılarının korunması
- Kayıp veya çelişkili bağlantıların raporlanması

### 07-H — Mağaza kesim akışı

1. 07-H1: Mağaza Kesim Planlama Motoru
2. 07-H2: Top/Lot Kombinasyon Önerileri
3. 07-H3: Rezervasyon ve Mükerrer Kullanım Engeli
4. 07-H4: Gerçek Kesim, Fire ve Kalan Stok
5. 07-H5: Kesim Sonrası Terziye Atama

Kalıcı paket mimarisindeki ana numaralandırma uyarınca bu alt aşamalar
07-B2–07-B7 olarak izlenecektir. 07-B2 mağaza kesim planlama motorunun bağımsız
temeli hazırlanmıştır; canlı stok hareketine henüz bağlanmamıştır.

07-B3 top/lot önerileri, 07-B4 rezervasyon güvenliği, 07-B5 gerçek kesim ve
fire, 07-B6 tedarik/karma kaynak ve 07-B7 terziye güvenli atama için bağımsız
alan motorları hazırlanmıştır. Bunlar kalıcı stok veritabanı kurulana kadar
canlı hareket üretmez.

## Kabul ve etik kuralları

- Üretim hesabı tek bir merkezi hesaplama kaynağından beslenir.
- Lot veya stok kaydı olmadan gerçek rezervasyon yapılmış gibi gösterilmez.
- Test sonucu `0` değilse aşamaya **PAK** denmez.
- Her değişiklikten önce yedek alınır.
- Dar ESLint, TypeScript, ilgili regresyon ve `git diff --check` tamamlanır.
- Kullanıcı açıkça istemedikçe commit, push ve deploy yapılmaz.
- Canlı veride geri döndürülemez işlem, açık onay olmadan yapılmaz.
