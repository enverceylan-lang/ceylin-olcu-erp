import type {
  OperationRecord
} from "./operationsWorkflow";
import {
  buildOperationWhatsAppText
} from "./operationsWorkflow";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function getOperationKindLabel(
  operation: OperationRecord
): string {
  if (operation.kind === "TAILOR") {
    return "TERZİ İŞ EMRİ";
  }

  if (operation.kind === "SUPPLIER") {
    return "TEDARİKÇİ SİPARİŞİ";
  }

  return "MONTAJ İŞ EMRİ";
}

export function getOperationStatusLabel(
  status: OperationRecord["status"]
): string {
  const labels: Record<
    OperationRecord["status"],
    string
  > = {
    DRAFT: "Taslak",
    ASSIGNED: "Atandı",
    SENT: "Gönderildi",
    ACCEPTED: "Kabul Edildi",
    IN_PROGRESS: "İşleme Alındı",
    COMPLETED: "Tamamlandı",
    PROBLEM: "Sorun Var",
    CANCELLED: "İptal Edildi"
  };

  return labels[status];
}

export function buildOperationPrintHtml(
  operation: OperationRecord
): string {
  const details = operation.details
    .map(
      item =>
        `<li>${escapeHtml(item)}</li>`
    )
    .join("");

  const partyName =
    operation.party?.name ??
    "Atama yapılmadı";

  const phone =
    operation.party?.phone ?? "-";

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>${escapeHtml(getOperationKindLabel(operation))}</title>
<style>
body {
  font-family: Arial, Helvetica, sans-serif;
  margin: 32px;
  color: #111827;
}
.header {
  border-bottom: 3px solid #111827;
  padding-bottom: 12px;
  margin-bottom: 24px;
}
h1 {
  margin: 0;
  font-size: 24px;
}
.meta {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 8px;
  margin-bottom: 20px;
}
.label {
  font-weight: bold;
}
.box {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 16px;
  margin-top: 16px;
}
ul {
  padding-left: 22px;
}
.footer {
  margin-top: 40px;
  border-top: 1px solid #d1d5db;
  padding-top: 12px;
  font-size: 12px;
  color: #4b5563;
}
@media print {
  button {
    display: none;
  }
}
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(getOperationKindLabel(operation))}</h1>
</div>

<div class="meta">
  <div class="label">Müşteri</div>
  <div>${escapeHtml(operation.customerName)}</div>

  <div class="label">İş Başlığı</div>
  <div>${escapeHtml(operation.title)}</div>

  <div class="label">Atanan / Tedarikçi</div>
  <div>${escapeHtml(partyName)}</div>

  <div class="label">Telefon</div>
  <div>${escapeHtml(phone)}</div>

  <div class="label">Planlanan Başlangıç</div>
  <div>${escapeHtml(
    new Date(operation.scheduledAt)
      .toLocaleString("tr-TR")
  )}</div>

  <div class="label">Termin</div>
  <div>${escapeHtml(
    new Date(operation.dueAt)
      .toLocaleString("tr-TR")
  )}</div>

  <div class="label">Durum</div>
  <div>${escapeHtml(
    getOperationStatusLabel(operation.status)
  )}</div>

  <div class="label">Adres</div>
  <div>${escapeHtml(operation.address ?? "-")}</div>
</div>

<div class="box">
  <strong>İş Detayları</strong>
  <ul>${details}</ul>
</div>

${
  operation.notes
    ? `<div class="box">
        <strong>Not</strong>
        <p>${escapeHtml(operation.notes)}</p>
      </div>`
    : ""
}

<div class="footer">
  İş No: ${escapeHtml(operation.id)}<br>
  Satış No: ${escapeHtml(operation.saleId)}<br>
  Oluşturulma: ${escapeHtml(
    new Date(operation.createdAt)
      .toLocaleString("tr-TR")
  )}
</div>
</body>
</html>`;
}

export function openOperationPrintWindow(
  operation: OperationRecord
): void {
  if (typeof window === "undefined") {
    throw new Error(
      "OPERATION_PRINT_BROWSER_REQUIRED"
    );
  }

  const printWindow = window.open(
    "",
    "_blank",
    "noopener,noreferrer"
  );

  if (!printWindow) {
    throw new Error(
      "OPERATION_PRINT_WINDOW_BLOCKED"
    );
  }

  printWindow.document.open();
  printWindow.document.write(
    buildOperationPrintHtml(operation)
  );
  printWindow.document.close();
  printWindow.focus();

  window.setTimeout(() => {
    printWindow.print();
  }, 300);
}

export function buildOperationWhatsAppUrl(
  operation: OperationRecord
): string {
  const phone = (
    operation.party?.phone ?? ""
  ).replace(/\D/g, "");

  const text = encodeURIComponent(
    buildOperationWhatsAppText(operation)
  );

  if (phone.length === 0) {
    return `https://wa.me/?text=${text}`;
  }

  return `https://wa.me/${phone}?text=${text}`;
}