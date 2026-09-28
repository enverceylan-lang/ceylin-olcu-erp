# ENVERP INVOICE SAME-LINE REGRESSION CONTRACT V1

## 1. Contract ID / Purpose

Contract ID: `INVOICE-SAME-LINE-REGRESSION-CONTRACT-V1`

Amaç: Satış, Alış, Satış İade ve Alış İade hatlarında kaynak belge ve kaynak satır kimliklerinin; stok, cari, fiyat ve finans sonuçlarına giderken yeni ve bağımsız bir ticari gerçek gibi yeniden üretilmesini engellemek.

Canonical sıra:

`Producer -> Canonical Authority -> Persistence -> Finance/Stock/Cari Effect -> Return/Reversal -> Consumer`

Temel yasa:

> Aynı ticari gerçek downstream aşamada yeni ve bağımsız bir ticari gerçek gibi yeniden yaratılmaz. Kaynak belge ve kaynak satır identity'si korunur.

Bu contract eski F1-F6, Sales Authority, Sale Return Authority, Finance RCA veya ADMIN Delete workstream'lerini yeniden açmaz. Bunların daha önce kapanmış kanıtları frozen baseline olarak kullanılır. Yalnız current exact contradiction bu baseline'ı yeniden açabilir.

## 2. Validation Baseline

- Canonical repo: `C:\ENVERP-repo`
- Branch: `main`
- Validation HEAD: `c9747c8cc16924dcd434f9f163046ff17afa198e`
- Cross-workstream freshness note:
  - `c9747c8cc16924dcd434f9f163046ff17afa198e`
  - `src/lib/serverMeasurementAuthority.ts` measurement parentPackage name projection
  - Finance/Fatura broad RCA reopen: NO
- Purchase F1-F6 frozen baseline:
  - `7b1c8d2c22142ff1a62178ec1b2dfb53d8713c22`
  - `feat: complete purchase receipt invoice return flows F1-F6`
- Sales / Sale Return authority frozen baseline:
  - `d53ad11cd83cfdc4f7af21ab8c338c02ada3c695`
  - `7194964124cb6a2bb3f3461a64b36dddb0a12c26`

## 3. Canonical Authority Hierarchy

### Sales Invoice line

`Sale -> Sale Line -> Sales Authority -> persisted sale truth -> invoice representation -> finance/cari consequence`

Invoice presentation or downstream consumer may not invent a new sale identity, customer identity, stock identity, quantity/unit truth or independent sale price truth.

### Purchase Invoice line

`Supplier Receipt -> Purchase Draft -> Purchase Line -> Purchase Approval -> payable`

Physical stock truth belongs to Supplier Receipt / Mal Kabul. Purchase approval creates the payable truth and must not create the same stock receipt again.

### Sales Return line

`Approved Sale -> exact source Sale/Sale Line -> Sale Return -> bounded reversal`

The return remains linked to its exact source sale identity and source-line context. It may not behave as a new independent sale or an unrelated finance source.

### Purchase Return line

`Approved Purchase -> exact Purchase Line -> Purchase Return -> stock OUT + payable reversal`

The stock-out and payable-reversal effects must remain attributable to the same purchase return and the same source purchase line.

## 4. F01-F20 Living Invariants

| ID | Invariant | Contract status |
| --- | --- | --- |
| F01 | Sales identity preserved — `saleId` zincir boyunca korunur. | FROZEN BASELINE PAK -> SAME-LINE LOCK |
| F02 | Sales line identity preserved — satış satırı downstream'de anonim/yeni satıra dönüşmez. | REGRESSION LOCK |
| F03 | Customer identity preserved — satış müşterisi başka customer ile değiştirilemez. | FROZEN BASELINE PAK -> SAME-LINE LOCK |
| F04 | Stock identity preserved — ilgili satış satırının stok identity'si korunur. | REGRESSION LOCK |
| F05 | Quantity/unit preserved — miktar ve birim sessizce yeniden yorumlanmaz. | REGRESSION LOCK |
| F06 | Sale price truth preserved — onaylanmış satış fiyatı downstream price truth'tur. | REGRESSION LOCK |
| F07 | Invoice does not independently reprice — invoice kendi bağımsız satış fiyat authority'sini oluşturamaz. | CONTRACT INVARIANT |
| F08 | Approval authority server-side — satış onayı canonical server authority dışında oluşmaz. | FROZEN BASELINE PAK |
| F09 | Sale finance registration idempotent — aynı satış tekrar işlendiğinde ikinci finans kaydı doğmaz. | FROZEN BASELINE + REGRESSION LOCK |
| F10 | Sale Return exact source reference — iade exact kaynak `saleId` ve kaynak satır bağını korur. | FROZEN BASELINE -> SAME-LINE LOCK |
| F11 | Sale Return reversal bounded — finansal reversal kaynak satış sınırını aşamaz. | REGRESSION LOCK |
| F12 | Purchase identity preserved — `purchaseDocumentId` korunur. | FROZEN BASELINE PAK |
| F13 | Purchase line identity preserved — `purchaseDocumentLineId` korunur. | FROZEN BASELINE -> SAME-LINE LOCK |
| F14 | Supplier identity preserved — tedarikçi identity'si zincirde değişmez. | REGRESSION LOCK |
| F15 | Supplier Receipt linkage preserved — Mal Kabul bağlantısı alış hattında kaybolmaz. | REGRESSION LOCK |
| F16 | Purchase approval creates payable only once — aynı approval aynı borcu iki kez yaratamaz. | FROZEN BASELINE + IDEMPOTENCY LOCK |
| F17 | Purchase approval does not double stock — stok Mal Kabul'de oluşmuşsa alış onayı ikinci kez artırmaz. | FROZEN BASELINE PAK |
| F18 | Purchase Return bounded by approved/remaining quantity — kaynak/onaylı/kalan miktar aşılamaz. | REGRESSION LOCK |
| F19 | Purchase Return same-line effect — `stock OUT + payable reversal` aynı purchase return/source line identity üzerinde birleşir. | FROZEN BASELINE -> SAME-LINE LOCK |
| F20 | Delete/reversal/audit/orphan boundaries preserved — silme/ters kayıt yetim finans veya belge ilişkisi bırakamaz. | FROZEN BASELINE; ADMIN Delete broad RCA reopen yok |

## 5. Regression Ownership

Bu contract eski workstream'leri yeniden ispatlamaz. Yeni regression suite yalnız aşağıdaki frozen baseline yüzeylerinin birbirleriyle kurduğu same-line bağı kilitler.

Sales side references:

- `src/app/api/sales/authority/persist/route.ts`
- `src/app/api/sales/authority/approve/route.ts`
- `src/app/api/sales/returns/authority/route.ts`
- `src/app/satis-iade/page.tsx`
- `tests/salesFaturalarFinalSemanticClosureSuite.ts`
- `tests/saleStockIdentityContract.test.ts`
- `tests/salesPaymentIdempotencySuite.ts`
- `tests/saleReturnFinanceCommandSuite.ts`
- `tests/saleReturnPersistenceContractSuite.ts`

Purchase side references:

- `src/lib/purchaseApprovalServerContract.ts`
- `src/app/api/purchases/approve/route.ts`
- `docs/sql/20260827_purchase_approval_authority_v1.sql`
- `src/lib/purchaseReturnServerContract.ts`
- `src/app/api/purchases/returns/route.ts`
- `docs/sql/20260828_purchase_return_authority_v1.sql`
- `tests/purchaseApprovalNoStockMutationSuite.ts`
- `tests/purchaseReturnNoReceiptReversalSuite.ts`
- `tests/purchaseReturnServerContractSuite.ts`
- `tests/purchaseFaturalarUiContractSuite.ts`

F20 frozen baseline dependency:

- `tests/saleDeletionPolicySuite.ts`
- historical ADMIN business-document permanent-delete evidence remains frozen and is not re-proved by this suite.

## 6. Stock / Finance / Cari Boundaries

- Supplier Receipt / Mal Kabul = physical stock truth.
- Purchase Approval = supplier payable truth.
- Purchase Approval must not be a second stock-IN producer.
- Purchase Return goods line = stock OUT.
- Purchase Return = payable reversal, not a new unrelated payable.
- Sale Return finance effect must remain linked to the source sale/return identity.
- No direct balance overwrite is authorized by this contract.
- No new finance writer is authorized by this contract.
- No new stock writer is authorized by this contract.

## 7. Idempotency / Reversal

- Same canonical sale operation may not create duplicate finance registration.
- Same purchase approval idempotency identity may not create duplicate payable.
- Same purchase return idempotency identity may not create duplicate return/reversal.
- Return/reversal amount or quantity may not exceed its canonical source boundary.

## 8. Delete Boundary

This contract does not redesign document deletion.

Frozen rule:

- ADMIN business-document delete workstream remains closed baseline.
- No orphan finance/document relation may be introduced.
- Delete and reversal are different semantics.
- This workstream does not authorize live delete, finance rewrite, SQL migration or cleanup.

## 9. Scope / Auth

Existing server-side authority and exact ERP scope rules remain owned by their canonical modules.

This contract does not weaken:

- authentication,
- role authorization,
- tenant/company/branch/accounting-period isolation,
- idempotency,
- SQL/RPC authority,
- audit boundaries.

## 10. Explicit Non-Scope

This contract/test package does not modify:

- `src/app/**`
- `src/lib/**`
- API routes
- Sales/Purchase authority implementation
- Return authority implementation
- Finance authority
- SQL / RPC / RLS
- UI
- live data
- environment configuration

Only this living contract and its regression contract suite are owned by this package.

## 11. Acceptance Gate

Full closure for this package requires:

- contract file present,
- `invoiceSameLineRegressionContractSuite.ts` PASS,
- TypeScript noEmit PASS,
- owned-file whitespace/diff hygiene PASS,
- exact two-file mutation boundary preserved,
- separate stage approval,
- separate commit approval,
- separate push approval,
- separate deploy/runtime decision if ever needed.

## 12. OPEN / DUR / KANITLANMADI

At creation baseline:

- Broad Purchase RCA: CLOSED / FROZEN
- Broad Sales Authority RCA: CLOSED / FROZEN
- Broad Sale Return RCA: CLOSED / FROZEN
- Broad ADMIN Delete RCA: CLOSED / FROZEN
- Finance stale-session RCA: CLOSED / OUT OF SCOPE
- SAME-LINE living contract: CREATED BY THIS PACKAGE
- SAME-LINE regression lock: must PASS before source package PAK
- Runtime/live acceptance: not required for a docs+test-only package unless future exact evidence changes this boundary.

## 13. Change Discipline

Future rule:

`OLD CONTRACT -> CURRENT HEAD DELTA -> NEW EVIDENCE -> CONTRACT UPDATE`

Do not create FINAL/FINAL2/V2/V3 clutter for the same semantics.

Reopen frozen baselines only if a current exact source or shared-file delta creates a contradiction.

## 14. Changelog

### V1 — creation candidate

- Binds Sales Invoice / Purchase Invoice / Sales Return / Purchase Return under one living same-line contract.
- Preserves frozen baseline authority decisions.
- Adds F01-F20 regression invariants.
- Does not mutate domain source, SQL, RPC, UI or runtime authority.
