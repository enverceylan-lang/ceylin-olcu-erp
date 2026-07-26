# Paket Mimarisi 10 — Final Canlı Geçiş Runbook

## Kesin durum

Bu paket kaynak kodu, regresyon, canlı ön kontrol, post-deploy sıkılaştırma ve
geri dönüş hazırlığını tek yerde toplar. Commit, push ve deploy ayrı açık onay
gerektirir. Bu onay verilmeden sistem “canlıya alınmış” sayılmaz.

## Sıra

1. `scripts/package-architecture-10-final.ps1` exit code sonuçları PAK olmalı.
2. Tam sistem JSON yedeği indirilip bütünlük kontrolü yapılmalı.
3. Canlı Supabase yedeği/snapshot durumu doğrulanmalı.
4. `20260726_package_architecture_10_live_preflight.sql` çalıştırılmalı.
5. Dokuz tablonun `unscoped_rows` değeri sıfır olmalı.
6. Açık commit/push/deploy onayı alınmalı.
7. Yeni uygulama sürümü dağıtılmalı.
8. Admin, Office ve Field giriş smoke testleri yapılmalı.
9. Cari oluşturma, oda/açıklık/ölçü kaydetme ve saha görevi smoke yapılmalı.
10. Kapsam seçici ve `/api/erp-scopes` doğrulanmalı.
11. PDF oluşturma/paylaşma smoke yapılmalı.
12. Yeni kayıt sonrası canlı ön kontrol yeniden çalıştırılmalı.
13. Tüm `unscoped_rows` değerleri yine sıfırsa kapsam hardening uygulanmalı.
14. Hardening sonrası `20260726_business_scope_v1_verify.sql` 9/9 geçmeli.

## DUR koşulları

- Herhangi bir test exit code değeri sıfır değilse
- Giriş veya senkronizasyon başarısızsa
- Yeni kayıtta kapsam kolonlarından biri boşsa
- PDF oluşturma/paylaşma başarısızsa
- Yetkisiz kapsam kimliği kabul edilirse
- Canlı yedek doğrulanmamışsa

## Geri dönüş

- Uygulama sorunu: önceki Vercel sürümüne dönülür.
- NOT NULL kaynaklı yazma sorunu:
  `20260726_business_scope_v1_compatibility_unlock.sql` uygulanır.
- Kapsam kolonları, FK ve indeksler korunur; tam kolon rollback yalnız veri
  kullanılmadığı kesin ise ve ayrıca açık onayla değerlendirilir.
- Paket enforcement modu `shadow` olarak kalır.
