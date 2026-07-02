# CEYLİN ÖLÇÜ ERP - Roadmap & Gelecek Planları

## V1F / V1G Sonrası Planlanan Modüller

### 1. Servis / Tamir / Atölye İşleri Modülü

**Amaç:** 
Dışarıdan gelen, normal cari/satış kaydı açılması gerekmeyen küçük tamir, kısaltma, tadilat ve atölye işlerini takip etmek.

**Örnek Senaryolar:**
- Perde boyu kısaltma
- Fon perde etek düzeltme
- Stor/zebra tamir
- Dışarıdan gelen ürün tadilatı
- Küçük dikim işleri
- Atölyeye verilen manuel işler

**Temel Alanlar (Veri Modeli Notları):**
- **İş Emri No:** Her iş için benzersiz numara (Örn: `SRV-2026-0001`).
- **Müşteri Tipi:** Manuel / Geçici / Cari Bağlı
- **Müşteri Adı:** (Zorunlu)
- **Telefon:** (Opsiyonel)
- **Adres:** (Opsiyonel)
- **Ürün Tipi:** (Örn: Fon, Stor, Zebra vb.)
- **İş Açıklaması:** (Zorunlu metin alanı)
- **Adet / Metre:** Miktar bilgisi
- **Teslim Alınan Tarih:** İşin mağazaya/sisteme giriş tarihi.
- **Atölyeye Verilen Tarih:** İşin yapım aşamasına geçtiği tarih.
- **Atanan Terzi/Personel:** İşi yapacak kişi.
- **Durum:** Alındı / Atölyede / Hazır / Teslim Edildi / İptal
- **Ücret:** (Opsiyonel)
- **Terzi Hakedişe İşlendi mi?:** `boolean` (Varsayılan: `false`)
- **Not:** Ek açıklamalar.

**İş Kuralları (Business Rules):**
1. Bu işler, normal bir satış carisi açılmadan da sisteme kaydedilip takip edilebilir.
2. İş sonradan mevcut bir cariye bağlanabilir (Opsiyonel).
3. Terzi hakedişleri **sadece** sistemde tamamlanmış (Teslim Edildi/Hazır vb.) iş emirlerinden oluşur.
4. Sistem dışı veya sözlü iletilen işler otomatik hakedişe eklenmez, mutlaka sistemde kaydı olmalıdır.
5. Admin ve moderatör yetkisine sahip kullanıcılar manuel iş emri açabilir.
6. Terziler / Personel sisteme girdiğinde sadece kendisine atanmış işleri görür (Row Level Security / Yetkilendirme).
7. "Teslim Edildi" statüsüne geçen işler kapanır.
8. Bu modül ilerleyen aşamalarda takvim/randevu sistemlerine ve gelişmiş hakediş raporlarına entegre edilecektir.
