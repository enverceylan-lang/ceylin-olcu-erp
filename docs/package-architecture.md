# ENVERP Paket Mimarisi

Eco, Normal ve Plus ayrı uygulamalar değildir. Tek kod tabanı, tek veri modeli ve
tek iş akışı omurgası kullanılır. Paket yalnız özellik erişimini, otomasyon
seviyesini ve kapasite sınırlarını belirler.

## Paket yükseltme ilkesi

- Normal, Eco özelliklerinin tamamını içerir.
- Plus, Normal özelliklerinin tamamını içerir.
- Paket yükseltildiğinde mevcut kayıtlar taşınmaz veya yeniden anlamlandırılmaz.
- Ölçü ve merkezi hesaplama doğruluğu hiçbir pakette azaltılamaz.

## Erişim karar sırası

1. Paket lisansı
2. Rol izni
3. Kullanıcıya özel kısıt
4. Tenant, şirket, şube ve muhasebe dönemi kapsamı
5. Kayıt sahipliği veya atama kapsamı

Üst sırada reddedilen bir yetki alt sıradaki izinle açılamaz. Özellikle
kullanıcıya özel izin, pakette bulunmayan bir özelliği veya rolün yasakladığı bir
işlemi açamaz.

## Entegrasyon sınırı

`src/lib/packageFeatures.ts` bağımsız karar çekirdeğidir. Mevcut ekranlara henüz
bağlanmamıştır; bu nedenle mevcut kullanıcı erişimlerini değiştirmez. Kalıcı
tenant/şirket/şube/dönem modeli ve paket lisansı veritabanında kurulmadan ekran
kilitleri etkinleştirilmemelidir.
