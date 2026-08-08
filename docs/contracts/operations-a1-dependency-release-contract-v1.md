# ENVerp Operations A1 — Dependency + Release Contract V1

## Purpose

Bu sözleşme, bir operasyonun ilerlemeye serbest bırakılıp bırakılamayacağını belirleyen **orchestration-level dependency/release** kararını tanımlar.

## Canonical distinction

- **Material Ready / releasedForCutting** fiziksel malzeme/kesim gerçeğidir.
- **Operation Released** operasyon bağımlılıklarının karşılandığı anlamına gelir.
- Bu iki kavram aynı source-truth değildir.

## Invariants

1. Required dependency `WAITING` ise operasyon release edilmez.
2. Required dependency `BLOCKED` ise operasyon `BLOCKED` olur.
3. Explicit blocker varsa operasyon `BLOCKED` olur.
4. Optional dependency tek başına release'i engellemez.
5. Tüm required dependency'ler `SATISFIED` ve explicit blocker yoksa `RELEASED`.
6. Policy stock/material truth hesaplamaz; yalnız dışarıdan verilen dependency sinyallerini okur.
7. Policy operation, stock, production veya finance state mutation yapmaz.
8. Karar deterministik olmalıdır; input mutate edilmez.
9. Parent/child veya readiness gibi kaynaklar dependency input üretebilir; kaynak gerçeği kendi modülünde kalır.
10. UI bu policy sonucunu gösterir; release state uydurmaz.

## Current package status

Bu dosya Operations A1 paketinin Step 1-2 sözleşmesidir.

Tamamlanan:
- `OperationTransitionRejectReason` transition ve repository katmanı için canonical reject reason type'ıdır.
- `decideOperationTransition` opsiyonel release context kabul eder.
- `IN_PROGRESS` ve `COMPLETED`, release context verildiğinde dependency/release gate'ine tabidir.
- `ASSIGNED / SENT / ACCEPTED`, erken atama ve görünürlük için release beklerken ilerleyebilir.
- Mevcut 4-parametreli caller sözleşmesi geriye uyumlu kalır.

Henüz:
- repository/store normal transition producer'ı release context üretmiyor,
- provider transition bypass yolu harden edilmedi,
- C light / B dark Operations UI bağlanmadı.

Bu nedenle paket henüz `RELEASE_READY` değildir ve commit/push yapılmamalıdır.

## Contract implementation

- `src/lib/operationDependencyReleasePolicy.ts`

## Contract test

- `tests/operationDependencyReleasePolicySuite.ts`

## Required before release

- normal transition enforcement wiring,
- provider path equivalent enforcement,
- focused transition/provider regression,
- Operations UI projection (C light / B dark),
- ESLint,
- TypeScript,
- build if relevant,
- `git diff --check`,
- scoped semantic diff,
- exact stage only.

## Step 3 — Normal producer pass-through

Tamamlanan:
- `updateOperationRecordStatus(..., context?)` resolved `OperationTransitionContext` kabul eder ve workflow'a aynen aktarır.
- `useOperationsStore.updateStatus(..., context?)` aynı context'i repository katmanına aktarır.
- Store ve repository readiness / dependency gerçeği hesaplamaz.
- Material readiness, parent/child veya başka domain source-truth'ları dış producer tarafından dependency input'a çevrilir.
- `context` verilmezse legacy transition davranışı korunur.

Henüz:
- gerçek resolved context producer'ı çağıran üst katmanda bağlanacak,
- provider transition bypass yolu aynı release contract'a bağlanacak,
- C-light / B-dark Operations UI release/blocker durumunu gösterecek.

## Step 4 — Provider release gate

Tamamlanan:
- Provider command mutation boundary opsiyonel resolved `OperationTransitionContext` kabul eder.
- Provider `START -> IN_PROGRESS` ve `REPORT_COMPLETED -> COMPLETED` hedeflerinde aynı `decideOperationRelease` policy'si uygulanır.
- Provider visibility / link / action transition kuralları release kontrolünden önce çalışmaya devam eder.
- Store provider action context'i hesaplamaz; yalnız command boundary'ye taşır.
- Release bekliyorsa `OPERATION_RELEASE_WAITING`, blocker varsa `OPERATION_RELEASE_BLOCKED` döner.

Henüz:
- üst katmanda gerçek dependency/readiness source-truth resolved context'e çevrilecek,
- Operations C-light / B-dark UI release ve blocker durumunu gösterecek.

## Final UI / Resolver binding

- Explicit source-truth binding: `Operation.saleId -> ProductionItem.orderId -> ProductionSourcePlan.productionItemId`.
- A1 material dependency is projected for `TAILOR` operations; later operation kinds keep their existing transition contract until their own explicit dependency packages are introduced.
- Resolver produces `OperationTransitionContext.release`; store/repository do not recompute material truth.
- Normal `updateStatus` and provider `updateProviderStatus` receive the same resolved context.
- Operations UI renders domain-derived `Serbest / Bağımlılık Bekliyor / Blokeli` state and a `Şimdi ne yapmalıyım?` action card.
- C-light uses teal/light surfaces; B-dark uses cyan/navy dark surfaces with identical domain semantics.
- Layout remains mobile-first and expands to multi-column health panels on larger viewports.