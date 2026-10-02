export interface CutSlipRow {
  cutOrderId: string;
  roomName: string;
  openingName: string;
  productType: string;
  stockItemId: string;
  lotLabel: string;
  reservedMeters: number;
  plannedCutMeters: number;
}

export interface CutSlipPrintInput {
  companyName: string;
  saleNo: string;
  customerName: string;
  operationId: string;
  rows: CutSlipRow[];
  generatedAt?: string;
}

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function meterText(
  value: number,
): string {
  return new Intl.NumberFormat(
    "tr-TR",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  ).format(value);
}

export function buildCutSlipPrintHtml(
  input: CutSlipPrintInput,
): string {
  const generatedAt =
    input.generatedAt ??
    new Date().toISOString();

  const rows = input.rows
    .map(
      (row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>
          <strong>${escapeHtml(row.roomName || "-")}</strong>
          <div class="muted">${escapeHtml(row.openingName || "-")}</div>
        </td>
        <td>
          ${escapeHtml(row.productType || "-")}
          <div class="muted">${escapeHtml(row.stockItemId)}</div>
        </td>
        <td>${escapeHtml(row.lotLabel)}</td>
        <td class="num">${escapeHtml(meterText(row.reservedMeters))} m</td>
        <td class="num">${escapeHtml(meterText(row.plannedCutMeters))} m</td>
        <td class="code">${escapeHtml(row.cutOrderId)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>${escapeHtml(input.companyName)} — Kesim Fişi — ${escapeHtml(input.saleNo)}</title>
<style>
* { box-sizing: border-box; }
body {
  margin: 24px;
  font-family: Arial, Helvetica, sans-serif;
  color: #111827;
  background: #ffffff;
}
.header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  border-bottom: 3px solid #111827;
  padding-bottom: 14px;
}
h1 {
  margin: 0;
  font-size: 24px;
}
.subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: #4b5563;
}
.meta {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 7px 14px;
  margin: 18px 0;
  font-size: 13px;
}
.label { font-weight: 700; }
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
th, td {
  border: 1px solid #d1d5db;
  padding: 8px;
  vertical-align: top;
}
th {
  background: #f3f4f6;
  text-align: left;
}
.num {
  text-align: right;
  white-space: nowrap;
}
.code {
  font-size: 9px;
  word-break: break-all;
}
.muted {
  margin-top: 3px;
  color: #6b7280;
  font-size: 10px;
}
.footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 36px;
}
.sign {
  border-top: 1px solid #9ca3af;
  padding-top: 8px;
  font-size: 12px;
}
.note {
  margin-top: 18px;
  border: 1px solid #d1d5db;
  padding: 10px;
  font-size: 11px;
  color: #4b5563;
}
@media print {
  body { margin: 10mm; }
}
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(input.companyName)}</h1>
      <div class="subtitle">KESİM FİŞİ</div>
    </div>
    <div class="subtitle">
      ${escapeHtml(
        new Date(generatedAt).toLocaleString(
          "tr-TR",
        ),
      )}
    </div>
  </div>

  <div class="meta">
    <div class="label">Satış No</div>
    <div>${escapeHtml(input.saleNo)}</div>

    <div class="label">Cari</div>
    <div>${escapeHtml(input.customerName)}</div>

    <div class="label">Ana Operasyon</div>
    <div>${escapeHtml(input.operationId)}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Oda / Açıklık</th>
        <th>Ürün</th>
        <th>Top / Lot</th>
        <th>Ayrılan</th>
        <th>Kesilecek</th>
        <th>Kesim Emri</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="note">
    Bu fiş, ENVerp'teki aktif stok rezervasyonu ve kesim planı kayıtlarından üretilen operasyon çıktısıdır.
  </div>

  <div class="footer">
    <div class="sign">Kesimi Yapan</div>
    <div class="sign">Kontrol / Teslim</div>
  </div>
</body>
</html>`;
}

export function openCutSlipPrintWindow(
  input: CutSlipPrintInput,
): void {
  if (typeof window === "undefined") {
    throw new Error(
      "CUT_SLIP_PRINT_BROWSER_REQUIRED",
    );
  }

  if (input.rows.length === 0) {
    throw new Error(
      "CUT_SLIP_ROWS_REQUIRED",
    );
  }

  const printWindow =
    window.open(
      "",
      "_blank",
      "noopener,noreferrer",
    );

  if (!printWindow) {
    throw new Error(
      "CUT_SLIP_PRINT_WINDOW_BLOCKED",
    );
  }

  printWindow.document.open();
  printWindow.document.write(
    buildCutSlipPrintHtml(input),
  );
  printWindow.document.close();
  printWindow.focus();

  window.setTimeout(() => {
    printWindow.print();
  }, 300);
}
