# Paket Mimarisi 06-H/I/J — Gölge Final

## Durum

Bu aşama yalnız tanı ve karşılaştırma katmanıdır. Paket, rol, kullanıcı kapsamı
ve mevcut erişim sonuçları gerçek ekran veya API erişimini henüz değiştirmez.
Gerçek uygulama 07 aşamasında, ayrıca açık onay ve geri alma planıyla yapılır.

## 06-H — Rol envanteri

- 7 normalize rol: ADMIN, MODERATOR, OFFICE, FIELD, TAILOR, INSTALLER,
  ACCOUNTING
- 3 paket: ECO, NORMAL, PLUS
- 16 paket özelliği
- Toplam 336 gölge karar
- Farklar erişim değişikliği olarak değil, inceleme girdisi olarak tutulur.

## 06-I — Karar bekleyen sınırlar

Aşağıdaki maddeler tahminle karara bağlanmamıştır:

1. ACCOUNTING rolünün menü ve finans/cari erişim yolu
2. MODERATOR rolünün gelişmiş paket özelliklerindeki sınırı
3. OFFICE rolünün stok, satın alma, üretim ve montaj sınırı
4. TAILOR rolünün yalnız kendi hakediş/bordro görünürlüğü
5. INSTALLER rolünün yalnız kendi hakediş/bordro görünürlüğü
6. Çoklu şirket, şube, dönem ve depo yönetim rolleri

Bu kararlar verilene kadar güvenli varsayım mevcut erişimi korumaktır. Paket
motoru bu belirsiz alanlarda gerçek yetki uygulamaz.

## 06-J — Final doğrulama kapsamı

- Paket özellik çekirdeği
- ERP kapsam doğrulaması
- Sunucu gölge kapsam okuyucusu
- Kimliği doğrulanmış gölge API
- Ayarlar gölge durum kartı
- Rol/paket özellik karşılaştırması
- 336 satırlık birleşik rol envanteri
- ESLint, TypeScript ve `git diff --check`

## Değişiklik sınırı

Bu pakette canlı veritabanı yazımı, gerçek yetki aktivasyonu, commit, push veya
deploy yoktur.
