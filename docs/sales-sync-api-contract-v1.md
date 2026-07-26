# Satış Senkronizasyon API Sözleşmesi V1

Durum: Taslak. Herhangi bir route'a bağlanmamıştır ve canlı senkronizasyonu açmaz.

## Kimlik doğrulama

- Her istek `verifyAuth` ile doğrulanmış aktif kullanıcı gerektirir.
- İzin verilen roller: `ADMIN`, `MODERATOR`, `OFFICE`, `SALES`.
- Admin bütün satışlarda işlem yapabilir.
- Diğer roller yalnız `ownerUserId` değeri kendi kullanıcı kimliğiyle eşleşen satışlarda işlem yapabilir.
- `RESTORE` yalnız Admin tarafından yapılabilir.

## İstek sınırları

- Bir istekte en fazla 50 değişiklik kabul edilir.
- `changeId`, `deviceId`, `saleId` ve `ownerUserId` zorunludur.
- `baseVersion` sıfır veya pozitif güvenli tamsayı olmalıdır.
- `UPSERT` ve `SOFT_DELETE` işlemleri geçerli satış zarfı gerektirir.
- `APPEND_PAYMENT` geçerli, pozitif tutarlı ve benzersiz kimlikli tahsilat gerektirir.

## Çakışma kuralları

- Sunucu sürümü `baseVersion` ile eşleşmezse kayıt ezilmez; `409 VERSION_CONFLICT` döner.
- Aynı `changeId` tekrar gönderilirse idempotent cevap verilir.
- Aynı tahsilat kimliği aynı içerikle tekrar gönderilirse ikinci kayıt oluşmaz.
- Aynı tahsilat kimliği farklı içerikle gelirse `PAYMENT_ID_COLLISION` oluşur.
- Satış sahibini değiştiren istemci isteği reddedilir.
- Fiziksel silme endpoint'i bulunmaz.

## Veri güvenliği

- Fotoğraf, video, adres fotoğrafı ve base64 içerik satış senkronizasyon yüküne alınmaz.
- Parola, token, hash, salt ve secret alanları her seviyede kaldırılır.
- Tarayıcı Supabase tablolarına doğrudan erişmez.
- Hata yanıtları kişisel veri veya gizli yapılandırma içermez.

## Devreye alma koşulları

1. SQL taslağı ayrı bir test projesinde uygulanmalı.
2. API route testleri geçmeli.
3. Tek pilot cihazla push/pull doğrulanmalı.
4. Geri alma ve yerel yedek doğrulanmalı.
5. Mevcut kayıt aktarımı kullanıcı önizlemesi ve onayı olmadan yapılmamalı.
