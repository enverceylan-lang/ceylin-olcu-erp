# ENVERP MEDIA AUTHORITY & SCALE CONTRACT V1

## 1. Status / Current Truth

Bu dosya ENVerp medya altyapisinin **yasayan canonical ledger / boundary contract** kaydidir.

Evidence snapshot:

- Repository HEAD: `6df574b379724fbee364893686f03cfc950b0537`
- Branch: `integration/customer-address-authority-v1`
- Contract-folder identity evidence: `ENVERP-MEDIA-CONTRACT-FOLDER-IDENTITY-READONLY-V1-20260924-013638.txt`
- Media source evidence: `ENVERP-MEDIA-STORAGE-AUTHORITY-SCALE-V1-READONLY-REPO-EVIDENCE-20260924-010156.txt`
- Snapshot aninda worktree: clean
- Snapshot aninda staged: 0

Bu contract **tum ENVerp medya sistemi production/runtime PAK** demek degildir.

Truth ayrimi:

- `SOURCE PAK` = current source / SQL / test contract kaniti var.
- `LIVE PAK` = ayrica production/runtime kaniti gerekir.
- `KANITLANMADI` = source veya live kanit tamamlanmamistir.
- `DUR` = kanitlanmis blocker / eksik entegrasyon / celiski vardir.

## 2. Purpose

Bu contract'in amaci:

1. mevcut canonical media core'u kaydetmek;
2. bugune kadar yapilan arastirmayi tekrar sifirdan yaptirmamak;
3. current implementation ile historical design'i ayirmak;
4. bilerek ertelenen module media extension'larini sahip workstream'lerine birakmak;
5. Future Me icin yeniden-acma / freshness kurallarini belirlemek;
6. ilgili module tasarlanmadan onun media lifecycle'ini bugunden kilitlememektir.

Bu contract gelecekteki STOCK / TAILOR / INSTALLATION / SERVICE tasarimlarini onceden dikte etmez.

## 3. Evidence Authority

Evidence onceligi:

1. Current HEAD exact source
2. Current tracked SQL / RPC / RLS / tests
3. Fresh read-only runtime / live evidence
4. Historical repo evidence
5. Independent research reports
6. Inference / recommendation

Bir alt seviye kanit ust seviyedeki guncel exact-source gercegini override edemez.

Historical design bir niyet / onceki mimari yon kanitidir; current implementation kaniti degildir.

Independent researcher raporlari canonical source truth degildir.

## 4. Current Verified Media Core

Current HEAD source kanitinda canonical media cekirdegi su yuzeylerde bulunur:

- `src/app/api/sync/media/route.ts`
- `src/lib/mediaCanonicalClient.ts`
- `src/lib/mediaLifecycleAuthority.ts`
- `src/lib/serverMediaEntitlement.ts`
- `src/components/media/CanonicalMediaPanel.tsx`
- `src/app/api/media-entitlement/route.ts`
- `src/app/api/platform/media-entitlement/route.ts`
- `scripts/setup-media-storage-v1.mjs`

Current tracked SQL packages:

- `docs/sql/20260815_media_stage2_e2e_v1.sql`
- `docs/sql/20260817_media_entitlement_authority_v1.sql`
- `docs/sql/20260818_media_entitlement_service_role_acl_hardening_v1.sql`
- `docs/sql/20260827_media_target_authority_scoped_event_v1.sql`
- `docs/sql/20260828_media_lifecycle_authority_v1.sql`

Current tracked focused media contract tests:

- `tests/mediaEntitlementApiContractSuite.ts`
- `tests/mediaEntitlementSqlContractSuite.ts`
- `tests/mediaLifecycleAuthoritySqlSuite.mjs`
- `tests/mediaLifecycleAuthoritySuite.mjs`
- `tests/mediaStage2ApiContractSuite.ts`
- `tests/mediaStage2SqlContractSuite.ts`
- `tests/mediaTargetAuthorityScopedEventSuite.mjs`

### Current source facts

Current canonical target set:

- `CUSTOMER`
- `ROOM`
- `OPENING`
- `MEASUREMENT`

Current canonical purpose set is measurement/customer-tree photo centric:

- `ADDRESS_PHOTO`
- `ROOM_PHOTO`
- `OPENING_PHOTO`
- `MEASUREMENT_PHOTO`

Current route / client implementation also contains:

- private canonical bucket identifier `enverp-media`;
- signed upload flow;
- signed read flow;
- current signed read TTL of 300 seconds;
- prepare / inspect / finalize RPC flow;
- current photo output ceiling of 4 MiB;
- current max dimension of 2048 px;
- current client input ceiling of 25 MiB;
- WebP canonical photo normalization;
- archive / restore client/server surfaces;
- idempotency / duplicate-handling foundations;
- server-side scope / entitlement checks;
- normal sync paths that sanitize or exclude heavy Base64/DataURL media payloads.

These are **current implementation facts**, not all immutable business rules.

## 5. Current Canonical Scope Closure

At this evidence snapshot:

### SOURCE PAK

- canonical CUSTOMER media target exists;
- canonical ROOM media target exists;
- canonical OPENING media target exists;
- canonical MEASUREMENT media target exists;
- media prepare/finalize/list/archive/restore foundation exists;
- media SQL/RPC authority packages exist;
- focused media contract test packages exist;
- heavy binary/Base64 is intentionally kept out of normal customer/sync payloads;
- measurement/customer media authority has prior closure evidence.

### Important boundary

`CUSTOMER / ROOM / OPENING / MEASUREMENT = SOURCE PAK`

does **not** imply:

`ALL ENVERP MEDIA = PAK`

and does not imply:

- STOCK media PAK;
- TAILOR media PAK;
- INSTALLATION media PAK;
- SERVICE / ISSUE media PAK;
- global retention policy PAK;
- live storage capacity PAK;
- live cost / egress PAK;
- all-device performance PAK.

## 6. Core Invariants

Bu kurallar media core seviyesinde korunur; ilgili module extension'i bunlari sessizce bypass edemez.

### MC-1 — Canonical business media uses explicit authority

Canonical media read/write/archive behavior UI gizlemeye tek basina dayanmaz.

Server-side authority / scope / entitlement kaniti gerekir.

### MC-2 — Exact ERP scope is fail-closed

Tenant / company / branch / accounting-period siniri gereken yerde exact scope kontrolu olmadan media authority acilmaz.

Belirsiz fallback ownership yasaktir.

### MC-3 — Binary transport is not normal domain sync

Base64/DataURL veya agir binary normal customer / measurement / sales sync payload'larina geri sokulmaz.

Binary transport canonical media flow uzerinden ilerler.

### MC-4 — Business link and stored binary are different concerns

Bir business kaydinin medyayi artik aktif UI'da gostermemesi, underlying object'in otomatik fiziksel silinmesi anlamina gelmez.

Archive / supersede / unlink / physical delete ayni semantik degildir.

### MC-5 — Ordinary workflow completion does not silently destroy history

Bir is, olcu, urun veya operasyon lifecycle degisimi future module contract tarafindan acikca tanimlanmadan committed business media'yi sessizce fiziksel silmez.

### MC-6 — Provider visibility and retention are separate concerns

TAILOR / INSTALLER gibi provider workstream'lerinde:

- provider'in **simdi gorebilme hakki**;
- asset'in **ne kadar saklanacagi**

ayni state machine varsayilmaz.

Bu bir future module design constraint'tir; current provider-media implementation PAK iddiasi degildir.

### MC-7 — Existing core is not reopened without contradictory evidence

Current media core, yalniz yeni exact evidence mevcut PAK siniriyla celisirse veya core source degisirse yeniden acilir.

## 7. Current Implementation Snapshot — Not Global Invariants

Asagidakiler current source snapshot'tir ve future module ihtiyacina gore kontrollu degisebilir:

- photo-only canonical media package;
- WebP normalization;
- 4 MiB output ceiling;
- 2048 px max dimension;
- 25 MiB input ceiling;
- 300-second signed read URL;
- current `CanonicalMediaPanel` ADMIN-centered UI behavior;
- current target/purpose enum set;
- current finalize-time object verification flow.

Bu degerlerin varligi onlarin butun future media turleri icin kalici contract oldugu anlamina gelmez.

Ornek:

- el yazisi kroki;
- kumaş/doku detayi;
- issue evidence;
- future document/video media

ayri quality / size / retention karari gerektirebilir.

## 8. Verified Current Gaps

### GAP-1 — STOCK / PRODUCT canonical media

Current source'ta stock/product canonical media target bulunmaz.

Current stock domain'de direct `imageUrl` yuzeyi vardir:

- `prisma/schema.prisma`
- `src/app/stok/page.tsx`
- `src/store/useStore.ts`

Hukum:

`STOCK_PRODUCT_CANONICAL_MEDIA = DUR_CURRENT_GAP`

Bu, Stock icin bugunden exact lifecycle tasarimi yapma yetkisi vermez.

### GAP-2 — TAILOR canonical media

Current media route'ta `TAILOR_JOB` first-class target degildir.

Hukum:

`TAILOR_MEDIA = DUR_CURRENT_GAP`

### GAP-3 — INSTALLATION canonical media

`src/lib/mediaLifecycleAuthority.ts` icinde installation ile ilgili policy izi vardir; current media route target setinde `INSTALLATION` yoktur.

Hukum:

`INSTALLATION_MEDIA = DUR_CURRENT_GAP`

### GAP-4 — ISSUE / SERVICE / COMPLETION media

Historical design bu alanlari dusunmustur; current canonical route first-class target/purpose olarak kapatmamistir.

Hukum:

`ISSUE_SERVICE_COMPLETION_MEDIA = DUR_CURRENT_GAP`

### GAP-5 — Provider media visibility lifecycle

Current provider operation / visibility altyapisi vardir; fakat canonical media READ authority'nin TAILOR / INSTALLER assignment -> active work -> completion -> regrant lifecycle'ina complete baglantisi kanitlanmamistir.

Hukum:

`PROVIDER_MEDIA_VISIBILITY_LIFECYCLE = KANITLANMADI`

## 9. Historical Design — Preserve, Do Not Confuse with Current Truth

Historical media design material daha genis bir model ongormustur. Ornek kavramlar:

- `STOCK_PRODUCT`
- `WORK_ORDER`
- `ISSUE`
- `INSTALLATION_COMPLETION`
- `media_assets`
- `media_links`
- `media_upload_intents`
- `media_audits`
- retention classes
- retention hold
- evidence protection
- archive / supersede
- cleanup eligibility
- checksum / dedup

Bu kavramlar future workstream icin yararli research input'tur.

Ancak historical design:

- current route support kaniti degildir;
- live DB truth kaniti degildir;
- future business kararini otomatik kilitlemez.

## 10. Deferred Module Extensions

Bu alanlar **unutulmadi**. Bilincli olarak kendi owning workstream'lerine ertelendi.

### STOCK / PRODUCT MEDIA

Status:

`DEFERRED_TO_STOCK_WORKSTREAM`

Neden:

Stock workstream tamamlanirken su domain gercekleri birlikte belirlenmelidir:

- active / inactive product lifecycle;
- catalogue visibility vs historical evidence;
- single-image vs multi-image;
- historical sale / production consumers;
- replacement/version behavior;
- archive / physical deletion boundary;
- stock-specific permission model.

Future rule:

Media Core yeniden tasarlanmaz. Bu contract okunur; yalniz STOCK-specific delta arastirilir.

### TAILOR MEDIA

Status:

`DEFERRED_TO_PRODUCTION_TAILOR_WORKSTREAM`

Neden:

Tailor media, gercek production state machine ve provider assignment lifecycle ile birlikte belirlenmelidir.

Future questions include:

- tailor hangi customer / room / measurement / product medyasini gorur;
- el yazisi kroki / instruction medyasi nasil baglanir;
- tailor issue photo nasil ekler;
- work COMPLETED oldugunda provider visibility nasil kapanir;
- 6 ay sonra SERVICE / ISSUE acilinca historical media nasil yeniden referans edilir;
- provider'a gecici re-grant nasil yapilir.

Bu sorular simdiden sabitlenmez.

### INSTALLATION MEDIA

Status:

`DEFERRED_TO_INSTALLATION_WORKSTREAM`

Future questions include:

- before-installation evidence;
- completion evidence;
- damage / missing-material / issue evidence;
- assigned installer read/write authority;
- completion sonrasi provider visibility;
- historical internal access;
- service-case re-use / regrant.

### ISSUE / SERVICE MEDIA

Status:

`DEFERRED_TO_SERVICE_AFTER_SALES_WORKSTREAM`

Future questions include:

- old asset'in yeni service case'e referansi;
- issue timeline vs generic media-link ihtiyaci;
- temporary provider entitlement;
- warranty / dispute / evidence retention;
- service close sonrasi retention.

## 11. Why Deferred — Future Me

Bu extension'larin simdi yapilmamasi teknik unutkanlik degildir.

Karar:

`DO_NOT_PREDESIGN_MODULE_MEDIA_BEFORE_MODULE_LIFECYCLE`

Gerekce:

Module state machine, UI, provider assignment, historical consumer ve business retention ihtiyaci bilinmeden target/purpose/retention contract kilitlemek:

- gereksiz V2/V3 contract dongusu;
- yanlis authorization modeli;
- gereksiz migration;
- future regression;
- domain ile media modelinin tekrar tekrar duzeltilmesi

riski yaratir.

Bu nedenle Media Core yalniz ortak altyapi ve sinirlari korur.

Module-specific media semantigi owning module tarafindan tamamlanir.

## 12. Scale / Retention Open Questions

Asagidakiler bu contract'ta bilincli olarak kapanmamistir.

### OPEN — Live Supabase truth

- live `media_assets` schema / count;
- live `media_links` schema / count;
- live `media_upload_intents` distribution;
- live `media_audits`;
- bucket object count;
- total stored bytes;
- DB-vs-bucket orphan/missing objects;
- duplicate candidates;
- archived/superseded distribution.

Status:

`KANITLANMADI`

### OPEN — Real usage / cost

- Supabase actual storage;
- cached / uncached egress;
- request volume;
- Vercel media-related function invocation / duration / transfer;
- real monthly media cost.

Status:

`KANITLANMADI`

Current official provider pricing may change and is never frozen as a permanent numeric rule in this contract.

### OPEN — Finalize full-object verification cost

Current source performs server-side object verification after upload and includes a full-object download path.

Source existence:

`PAK`

Its real performance / egress / cost impact:

`KANITLANMADI`

Security must not be weakened merely to remove transfer.

### OPEN — Local device pressure

Current source intentionally removes heavy media from normal sync payloads.

Source isolation:

`PAK`

Local draft storage can contain Blob-backed media.

Long-term low-end phone / PC pressure under real usage:

`KANITLANMADI`

### OPEN — Retention duration

No global numeric media retention period is locked here.

Examples such as:

- 6 months;
- 1 year;
- 3 years;
- 5 years;
- permanent

are not canonical until relevant business/legal/module evidence closes them.

Historical A/B/C retention design does not by itself define current business semantics.

## 13. Physical Delete Boundary

Bu contract su global ayrimi korur:

- UI hide != archive
- archive != supersede
- supersede != unlink
- unlink != retention eligibility
- retention eligibility != physical delete

Current Storage `.remove()` usage must always be classified by exact call-site semantics before any deletion conclusion.

Failed / invalid / duplicate / temporary upload cleanup ile committed business-media deletion ayni sey degildir.

Future physical-delete authority must consider at minimum:

- active business links;
- historical links;
- evidence protection;
- legal/audit hold if introduced;
- module retention contract;
- shared/reused asset references;
- exact admin/system authority;
- immutable audit evidence.

Bu contract ordinary business action'a immediate physical delete hakki vermez.

## 14. Independent Research Ledger

2026-09-24 workstream'inde uc bagimsiz researcher ayni media research brief'i ile calistirildi.

### Researcher 1

- useful architecture/lifecycle review;
- provider visibility vs retention separation konusunda yararli convergence;
- current ENVerp exact-source verification incomplete;
- bircok module sonucu `KANITLANMADI` birakildi.

### Researcher 2

- stock/tailor/installation gap ve finalize transfer riski konusunda yararli convergence;
- bazi path/field/schema detaylari exact source olarak fazla kesin sunuldu;
- sample live SQL canonical kabul edilmez;
- exact live schema preflight olmadan kullanilmaz.

### Researcher 3

- repository kendisine verilemedigi icin ENVerp-specific source verdict vermedi;
- fail-closed evidence discipline uyguladi;
- tum implementation-specific alanlari `KANITLANMADI` birakti.

### Canonical authority rule

Independent research:

`RESEARCH_INPUT`

Current repo exact-source evidence:

`CANONICAL_SOURCE_TRUTH`

Uc report'un ortak fikri tek basina PAK yaratmaz.

## 15. Do Not Research From Zero

`DO_NOT_RESEARCH_FROM_ZERO = true`

Future media workstream zorunlu baslangic sirasi:

1. Bu canonical contract READ.
2. Current HEAD / source freshness kontrolu.
3. Ilgili module owner ve current state machine READ.
4. Existing Media Core producer/consumer ve authority siniri READ.
5. Yalniz degisen source veya module-specific delta arastirilir.
6. Daha once PAK kapanan core, celiskili yeni evidence olmadan yeniden tasarlanmaz.

Future researcher su sorularla sifirdan baslamaz:

- "Supabase mi kullanalim?"
- "asset/link modeli gerekli mi?"
- "signed URL kullanalim mi?"
- "binary normal sync'e mi gitsin?"

Bu sorular core seviyesinde tekrar acilmaz; yalniz exact contradictory evidence veya core-generation change yeniden acabilir.

## 16. Reopen / Freshness Triggers

Media Core yeniden acilir only if one or more applies:

1. `src/app/api/sync/media/route.ts` authority semantics changes;
2. canonical asset/link SQL or RPC contract changes;
3. bucket privacy / Storage ACL / RLS model changes;
4. ERP scope / tenant ownership model changes;
5. prepare/finalize/list/archive/restore semantics changes;
6. normal sync yeniden binary/Base64 tasimaya baslar;
7. production/runtime regression prior PAK evidence ile celisir;
8. live DB current repo SQL ile drift gosterir;
9. new media kind requires core-generation change rather than module extension.

Sadece yeni bir module'un media ihtiyaci cikmasi, tek basina Media Core'u sifirdan yeniden arastirma sebebi degildir.

## 17. Module Extension Acceptance Checklist

STOCK / TAILOR / INSTALLATION / SERVICE media extension'i kapanmadan once en az su alanlar exact olarak belirlenir:

- owning business entity / target;
- purpose taxonomy;
- producer(s);
- consumer(s);
- read authority;
- create authority;
- archive/replace authority;
- physical-delete boundary;
- provider assignment / visibility lifecycle if applicable;
- completion / cancellation behavior;
- historical retrieval behavior;
- re-open / service regrant behavior;
- retention decision;
- offline/local-device behavior;
- payload/binary isolation;
- idempotency/retry behavior;
- orphan/duplicate failure modes;
- focused source contract tests;
- regression tests;
- current HEAD freshness;
- live/runtime evidence where required.

## 18. Explicit Non-Claims

Bu contract su iddialari YAPMAZ:

- all-media production runtime PAK;
- live Supabase schema exactly equals historical SQL;
- live bucket object count is known;
- retention A/B/C has current final business meaning;
- all committed media must remain forever;
- no media may ever be physically deleted;
- 300-second signed URL is permanently optimal;
- 4 MiB / 2048 px / WebP is optimal for every future media kind;
- current finalize flow is economically optimal;
- current local Blob behavior is proven safe at scale;
- current Stock `imageUrl` is approved long-term architecture;
- provider media lifecycle is implemented;
- future module target/purpose names are already canonical.

## 19. Current Verdict

At evidence snapshot `6df574b379724fbee364893686f03cfc950b0537`:

- `MEDIA_CORE_CUSTOMER_ROOM_OPENING_MEASUREMENT = SOURCE_PAK`
- `MEDIA_CORE_GLOBAL_RUNTIME = KANITLANMADI`
- `STOCK_PRODUCT_CANONICAL_MEDIA = DUR_CURRENT_GAP`
- `TAILOR_CANONICAL_MEDIA = DUR_CURRENT_GAP`
- `INSTALLATION_CANONICAL_MEDIA = DUR_CURRENT_GAP`
- `ISSUE_SERVICE_COMPLETION_MEDIA = DUR_CURRENT_GAP`
- `PROVIDER_MEDIA_VISIBILITY_LIFECYCLE = KANITLANMADI`
- `LIVE_STORAGE_SCALE_COST = KANITLANMADI`
- `LOCAL_DEVICE_LONG_TERM_MEDIA_PRESSURE = KANITLANMADI`
- `MODULE_EXTENSIONS = DEFERRED_TO_OWNING_WORKSTREAMS`
- `DO_NOT_RESEARCH_FROM_ZERO = true`

## 20. Change Discipline

Bu dosya yasayan canonical contract'tir.

Future update kurali:

`OLD CONTRACT -> CURRENT HEAD DELTA -> NEW EVIDENCE -> CONTRACT UPDATE`

Yeni tarihsel TXT, `FINAL`, `V2`, `V3` contract coplugu uretilmez.

Ayni semantik contract bu dosyada guncellenir.

Anlamli core-generation degisimi ancak exact evidence ile ayri version gerektirir.

Bu contract'in update edilmesi source/SQL/runtime gerceginin yerine gecmez.
