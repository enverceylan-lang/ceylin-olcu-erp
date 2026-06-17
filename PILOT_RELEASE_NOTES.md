# Ölçü ERP V1.0 – Saha Pilot

## Bu pakette yapılanlar

- Uygulama adı ve görünür sürüm etiketi `Ölçü ERP V1.0 – Saha Pilot` olarak düzenlendi.
- Cari listesindeki ve cari detayındaki kayıtlı konum bağlantıları Google Maps'te yeni sekmede açılır.
- Ölçü şablonları ve iş akışı durumları kullanıcıya Türkçe gösterilir.
- Fotoğraf/video önizlemeleri artık geçici `blob:` adresleri yerine cihazda kalıcı `data:` adresleri olarak saklanır.
- Pilot medya sınırları: fotoğraf 4 MB, video 12 MB.
- Ayarlar ekranına cihaz yedeği indirme ve geri yükleme eklendi.
- Geçersiz Tailwind renk sınıfları standart sınıflarla değiştirildi.

## Pilot kullanım sınırı

Bu sürüm hâlâ Zustand + localStorage kullanır. Veriler yalnızca kullanılan tarayıcı/cihazdadır. Farklı cihazlar arasında otomatik senkronizasyon yoktur.

Her iş gününün sonunda **Ayarlar → Yedek İndir** kullanılmalıdır.

## Kurulum

```powershell
npm install
npx prisma generate
npm run dev
```

Prisma bu pilotun Cari/Ölçü akışında henüz aktif veri kaynağı değildir; ancak mevcut proje bağımlılıklarının tip üretimi için `npx prisma generate` çalıştırılmalıdır.

## V1.0.1 - WhatsApp Ölçü Raporu
- Cari detay ekranına `WhatsApp Ölçü Raporu` düğmesi eklendi.
- Rapor; müşteri, adres, oda, açıklık, ölçü şablonu, ham ölçü alanları, toplam ölçü, ölçüyü alan personel, tarih, not ve medya sayılarını içerir.
- Mobilde sistem paylaşım ekranını açar; WhatsApp seçilebilir.
- Masaüstünde WhatsApp Web için hazır metin açılır.
- Fotoğraf/video dosyaları otomatik eklenmez, raporda adetleri gösterilir.
