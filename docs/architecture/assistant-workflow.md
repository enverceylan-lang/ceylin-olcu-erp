# CEYLİN ERP → ENVERP Assistant Workflow

## 1. Belgenin amacı

Bu belge CEYLİN ERP → ENVERP projesinde görev alan bütün yapay zekâ
yardımcıları için zorunlu çalışma standardıdır.

Codex, ChatGPT, Gravity veya başka bir yardımcı; analiz, kodlama, test,
arayüz düzenleme, teşhis, raporlama veya refaktör işlemine başlamadan önce
bu belgeyi okumalı ve burada yazan kurallara uymalıdır.

Bu belge proje sahibinin açık talimatlarının yerine geçmez. Çelişki halinde
proje sahibinin en güncel açık talimatı geçerlidir.

---

## 2. Proje çalışma modeli

Proje üç bağımsız çalışma koluyla yürütülür.

### 2.1 Codex — teknik üretim kolu

Codex şu işleri yapabilir:

- Mevcut mimariyi ve devir notlarını okumak
- Sınırları belirlenmiş kod değişiklikleri yapmak
- Unit ve integration testleri yazmak
- Refaktör yapmak
- Lint, TypeScript, test ve build çalıştırmak
- Değişen dosyaları ve diff kapsamını raporlamak
- Commit kapsamı ve commit mesajı önermek

Codex şunları yapamaz:

- Commit oluşturmak
- Push yapmak
- Deploy yapmak
- Kanonik veri modelini sessizce değiştirmek
- Devir notunda olmayan mimari kararı varsaymak
- Kendi yazdığı testleri tek başına nihai güvenlik kanıtı saymak
- Finans, yetki, tenant veya migration kararını tek başına kesinleştirmek

Codex teslimatında zorunlu olarak şunları vermelidir:

- Okuduğu devir ve mimari belgeler
- Kullandığı varsayımlar
- Değişen dosyaların tam listesi
- Her dosyada yapılan işlemin özeti
- Çalıştırılan komutların tam listesi
- Her komutun gerçek exit code değeri
- Geçen ve başarısız testlerin sayısı
- Bilinen eksikler ve kesinleşmemiş noktalar
- Önerilen commit dosya kapsamı
- Commit mesajı önerisi
- Commit, push ve deploy yapılmadığı bilgisi

---

### 2.2 ChatGPT + PowerShell — bağımsız doğrulama kolu

ChatGPT’nin görevi:

- Codex veya Gravity teslimatını gereksinimlerle karşılaştırmak
- Devir notları ve kanonik belgelerle uyumu doğrulamak
- Bağımsız PowerShell teşhis ve kalite kapıları hazırlamak
- Gerçek diff ve dosya kapsamını doğrulamak
- Testlerin ilgili riski gerçekten kapsayıp kapsamadığını değerlendirmek
- Rapor içi çelişkileri tespit etmek
- Red Team, Truth Mode ve Future Me değerlendirmesi yapmak
- Commit öncesi bağımsız TXT kanıtı üretmek

PowerShell doğrulaması, Codex raporunu yalnız tekrar etmemelidir.
Bağımsız olarak şunları çıkarmalıdır:

- Gerçek değişen dosyalar
- Beklenmeyen veya eksik dosyalar
- Gerçek staged ve unstaged kapsam
- Diff check sonucu
- Lint sonucu
- TypeScript sonucu
- Odak testleri
- Gerekli olduğunda full test ve production build
- Kanonik sözleşme uyumu
- Yasak desen ve güvenlik kontrolleri
- Kaynak, stage, commit, push ve deploy durumu

ChatGPT açık kullanıcı onayı olmadan commit, push veya deploy komutu
vermemelidir.

---

### 2.3 Gravity — görsel ve kullanıcı deneyimi kolu

Gravity şu alanlarda kullanılmalıdır:

- Ekran yerleşimi
- Mobil ve masaüstü görünüm
- Buton konumları
- Modal ve panel tasarımları
- Renk, ikon, boşluk ve okunabilirlik
- Görsel raporlar
- Kullanıcı akışı
- Ekran görüntüsü üzerinden görsel düzeltmeler

Gravity şunları yapamaz:

- Finans hesap motorunu yeniden yazmak
- İş mantığını UI içine kopyalamak
- Kanonik veri modelini değiştirmek
- Yetkiyi yalnız buton gizlemeye indirgemek
- API, sync veya ledger sözleşmesini sessizce değiştirmek
- Commit, push veya deploy yapmak

Gravity teslimatında değişen dosyaları, görsel gerekçeleri, etkilenen ekranları
ve çalıştırdığı kontrolleri açıkça raporlamalıdır.

---

## 3. Zorunlu etik inceleme

Her görev ve her rapor aşağıdaki üç mercekle incelenmelidir.

### 3.1 Red Team

Şunlar aktif olarak aranmalıdır:

- Yetkisiz erişim yolları
- Veri karışması
- Tenant, şirket, şube veya dönem izolasyonu ihlali
- Finansal bütünlük kaybı
- Mükerrer kayıt
- İdempotency ihlali
- Sessiz fallback
- Boş catch
- Fiziksel finans kaydı silme
- Doğrudan bakiye değiştirme
- Hassas veri veya anahtar sızıntısı
- Testlerin kaçırabileceği sınır durumları
- Aynı işin paralel ikinci kez oluşturulması
- UI ile backend yetkisinin birbirinden kopması

### 3.2 Truth Mode

Her raporda açıkça ayrılmalıdır:

- Kanıtlanan gerçekler
- Varsayımlar
- Henüz doğrulanmayan noktalar
- Yanlış pozitif ihtimali
- Yanlış negatif ihtimali
- Rapor içi çelişkiler
- Çalışmayan veya atlanan komutlar
- Gerçek exit code değerleri
- Yapılmayan işlemler

Bir raporda kanıt satırları bulunmuyorsa yalnız bulgu sayısı nihai kanıt
olarak kabul edilmez.

Test geçti ifadesi, testin doğru şeyi sınadığı ayrıca doğrulanmadan güvenlik
veya iş mantığı kanıtı sayılmaz.

### 3.3 Future Me

Her değişiklik için şu sorular değerlendirilmelidir:

- Altı ila yirmi dört ay sonra etkisi nedir?
- Yeniden yazım veya migration doğurur mu?
- Tenant, company, branch ve accounting period mimarisiyle uyumlu mu?
- Ölçek büyüdüğünde performans ve bakım etkisi nedir?
- Kanonik modelden sapma oluşturur mu?
- Yeni teknik borç üretir mi?
- Yedekleme ve geri yüklemeyi bozar mı?
- Audit ve izlenebilirliği zayıflatır mı?
- Gelecekteki modüllerin önünü kapatır mı?

---

## 4. Finansal değişmez kurallar

Finans alanında aşağıdaki kurallar tartışmasızdır:

- Cari bakiye doğrudan artırılamaz veya azaltılamaz.
- Bakiye finans hareketlerinden türetilir.
- Finans hareketleri fiziksel olarak silinmez.
- Düzeltme ters kayıt, iptal veya karşı hareketle yapılır.
- Aynı tahsilat ikinci kez işlenemez.
- İdempotency anahtarı zorunludur.
- Tahsilat satışın veya açık taksidin bakiyesini aşamaz.
- Ayrı satışların finans hareketleri birbirine karışamaz.
- Belirsiz müşteri veya satış eşlemesi yapılamaz.
- Fallback müşteri, fallback satış veya sessiz taşıma yapılamaz.
- Finans hareketinde kaynak belge ve işlem kimliği korunur.
- Gelecekte tenantId, companyId, branchId ve accountingPeriodId zorunlu
  kapsam olacaktır.
- Hassas finans ve kullanıcı verileri loglara yazılmaz.
- Kullanıcının ekranda bir alanı değiştirebilmesi backend yetkisi anlamına
  gelmez.

---

## 5. Kanonik model ve sözleşme kuralları

Her veri alanının tek bir kanonik sahibi olmalıdır.

Örnek zincir:

Domain modeli
→ hesap ve iş kuralları
→ adapter
→ sync sözleşmesi
→ kuyruk
→ API route
→ kalıcı veri tabanı

Kurallar:

- API DTO, domain modelinin yerine geçmez.
- Sync sözleşmesi ekran modelinin yerine geçmez.
- Aynı isimde paralel ve çelişen modeller oluşturulamaz.
- Yeni model eklenmeden önce mevcut kanonik model aranır.
- Kanonik model değişikliği ayrı mimari karar ve migration planı gerektirir.
- Geçici uyumluluk adapter’ı sessiz fallback olarak kullanılamaz.
- Import zinciri ve veri sahipliği raporda gösterilmelidir.

---

## 6. Kod değiştirme kuralları

Her kaynak değişikliğinde:

1. Git çalışma ağacı kontrol edilir.
2. Değiştirilecek dosyalar kesinleştirilir.
3. Mevcut dosyalar yedeklenir.
4. TS ve TSX dosyaları UTF-8 BOM olmadan yazılır.
5. Beklenmeyen dosyalar değiştirilmez.
6. Dar lint çalıştırılır.
7. TypeScript kontrolü çalıştırılır.
8. İlgili testler çalıştırılır.
9. Gerekli olduğunda local validation ve build çalıştırılır.
10. Diff check yapılır.
11. Değişen kapsam raporlanır.
12. Kullanıcı açıkça onaylamadan commit yapılmaz.

---

## 7. Commit, push ve deploy kapısı

Aşağıdaki ifadeler onay sayılmaz:

- devam
- peki
- tamam
- okudum
- sonraki adıma geç

Bunlar yalnız kullanıcının cevabı okuduğunu ve çalışmaya devam edilmesini
istediğini ifade eder.

Commit, push veya deploy için açık talimat gerekir.

Örnek açık talimatlar:

- ONAY
- COMMIT ET
- PUSH ET
- DEPLOY ET

PAK ifadesi test veya adımın geçtiği anlamına gelir; tek başına commit,
push veya deploy izni değildir.

Commit yalnız şu şartlarla oluşturulur:

- Codex veya Gravity teslimatı mevcut
- Bağımsız PowerShell TXT raporu mevcut
- İki rapor karşılaştırılmış
- Red Team değerlendirmesi yapılmış
- Truth Mode değerlendirmesi yapılmış
- Future Me değerlendirmesi yapılmış
- Dosya kapsamı kesinleşmiş
- Test ve kalite kapıları geçmiş
- Kullanıcı açık onay vermiş

Commit PowerShell üzerinden oluşturulur.
Codex ve Gravity commit oluşturamaz.

Push ve deploy için commit onayından ayrı açık kullanıcı onayı gerekir.

---

## 8. Rapor formatı

Her teknik raporun sonunda en az şu alanlar bulunmalıdır:

RED TEAM SONUCU:
TRUTH MODE SONUCU:
FUTURE ME SONUCU:
ETİK KURAL İHLALİ:
KESİNLEŞMEMİŞ NOKTALAR:
UZUN VADELİ ETKİ:
KAYNAK DEĞİŞTİRİLDİ:
STAGE YAPILDI:
COMMIT YAPILDI:
PUSH YAPILDI:
DEPLOY YAPILDI:
NİHAİ HÜKÜM:

Yalnız FINAL DURUM=True yazılması yeterli değildir.
Başarı hükmü kanıtlarla desteklenmelidir.

---

## 9. Devir notu zorunluluğu

Her yardımcı göreve başlamadan önce:

- Güncel devir notunu okumalıdır.
- Bu assistant-workflow belgesini okumalıdır.
- İlgili mimari belgeleri okumalıdır.
- İlgili kanonik sözleşmeyi okumalıdır.
- Yapılacak işler listesindeki mevcut sırayı doğrulamalıdır.

Devir notu ile kod çelişirse sessiz karar verilmez.
Çelişki raporlanır ve kanıt istenir.

Devir notunda bulunmayan bir varsayım gerçek kabul edilmez.

---

## 10. Nihai çalışma zinciri

Codex üretir ve raporlar
→ ChatGPT gereksinim ve devir notuyla karşılaştırır
→ PowerShell bağımsız kanıt üretir
→ Red Team, Truth Mode ve Future Me değerlendirmesi yapılır
→ Gerekli görsel işler Gravity tarafından tamamlanır
→ Gravity değişiklikleri ayrıca doğrulanır
→ Kullanıcı açık onay verirse PowerShell commit oluşturur
→ Kullanıcı ayrıca açık onay verirse push yapılır
→ Kullanıcı ayrıca açık onay verirse deploy doğrulanır

Hiçbir yardımcı tek başına işi tamamlanmış veya güvenli ilan edemez.

---

## 11. Ceylin-ENVERP Tower ilkesi

Bu proje geçici yamalarla değil, kalıcı ve denetlenebilir bir mimariyle
inşa edilir.

Temel:
- Finansal bütünlük
- Veri izolasyonu
- Kanonik sözleşmeler
- Audit ve izlenebilirlik

Kolonlar:
- Test
- İdempotency
- Yetki
- Yedekleme
- Migration güvenliği

Katlar:
- Cari
- Satış
- Finans
- Stok
- Üretim
- Montaj
- Takvim
- Excel köprü
- Saha uygulaması

Vitrin:
- Gravity tarafından doğrulanan kullanıcı deneyimi

Kalite kontrol:
- Codex üretimi
- ChatGPT incelemesi
- Bağımsız PowerShell kanıtı
- Kullanıcı açık onayı

Kolon kesilmez, finans hareketi kaybolmaz, kanonik model sessizce
değiştirilmez.
