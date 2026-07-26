# Kalıcı Veri Modeli Entegrasyon Planı

## Mevcut gerçeklik

- Prisma şeması kullanıcı, cari, oda, açıklık, ölçü, ürün ve temel satış
  modellerini içerir.
- Uygulamanın canlı API yolları Supabase tablolarına doğrudan erişir.
- Yerel IndexedDB/Zustand kayıtları çevrimdışı çalışma omurgasının parçasıdır.
- Prisma şemasını tek başına değiştirmek Supabase veya yerel kayıtları güvenli
  biçimde dönüştürmez.

## Güvenli sıra

1. Canlı Supabase tablo, kolon, indeks, constraint, RLS ve satır sayısı envanteri
   yalnız okunur biçimde alınır.
2. Tam sistem yedeği ve geri yükleme provası yapılır.
3. Organizasyon/paket tabloları ayrı ve RLS kapalı erişimle oluşturulur.
4. Mevcut tek işletme için tenant, şirket, şube ve dönem başlangıç kayıtları
   kullanıcı onayıyla hazırlanır.
5. Mevcut kayıtlarla ilişki kuracak kolonlar önce nullable eklenir.
6. Sunucu tarafında çift yazım ve kapsam doğrulaması pilot ortamda denenir.
7. Eksik kapsamlar raporlanır; sessiz varsayılan atama yapılmaz.
8. Backfill işlemi sayım ve örneklem doğrulamasıyla yapılır.
9. Ancak bütün kayıtlar kapsama bağlandıktan sonra zorunlu constraint düşünülür.
10. Eco/Normal/Plus ekran bayrakları en son etkinleştirilir.

## Uygulanmayacak işlemler

- Canlı veritabanına bu aşamada SQL çalıştırmak
- Mevcut UUID/TEXT kimliklerini topluca değiştirmek
- Cari, ölçü veya satış kayıtlarını silmek
- Manuel `balance` alanını finans hareketlerine sessizce çevirmek
- Paket bilgisi bulunmayan kullanıcıların ekranlarını otomatik kapatmak

## Geri alma sınırı

İlk organizasyon/paket tabloları mevcut tablolara kolon eklemeden ayrı
kurulmalıdır. Böylece pilot başarısız olursa uygulama eski akışını kullanmaya
devam eder. Fiziksel tablo kaldırma, veri silme veya geri dönüşü zor bir işlem
bu planın parçası değildir.
