import jsPDF from 'jspdf';
import type { Customer } from '@/store/useStore';
import type { Sale } from '@/store/salesStore';
import {
  getSaleNetTotal,
  getSalePaidTotal,
  getSaleRemainingBalance,
  refreshInstallmentPlan
} from '@/lib/salesFinance';

const tr = (value: unknown): string =>
  String(value ?? '')
    .replace(/Ğ/g, 'G').replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S').replace(/İ/g, 'I')
    .replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ç/g, 'c');

const money = (value: number): string =>
  `${Number(value || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} TL`;

const dateText = (value?: string): string => {
  if (!value) return '-';
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('tr-TR');
};

export async function generateSalesPdfFile(
  sale: Sale,
  customer?: Customer
): Promise<File> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const left = 12;
  const right = 198;
  const bottom = 282;
  let y = 14;

  const ensure = (height = 10) => {
    if (y + height > bottom) {
      doc.addPage();
      y = 14;
    }
  };

  const title = (text: string) => {
    ensure(14);
    doc.setFillColor(241, 245, 249);
    doc.rect(left, y, right - left, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(tr(text), left + 3, y + 6);
    y += 13;
  };

  const row = (label: string, value: string) => {
    ensure(7);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(tr(label), left, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(tr(value), left + 42, y, { maxWidth: 140 });
    y += 6;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(37, 99, 235);
  doc.text('CEYLIN ERP', 105, y, { align: 'center' });
  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text('SATIS / TEKLIF FORMU', 105, y, { align: 'center' });
  y += 10;

  title('Satis Bilgileri');
  row('Satis No', sale.saleNo);
  row('Tarih', dateText(sale.createdAt));
  row('Durum', sale.status);
  row('Musteri', customer?.name || 'Bilinmiyor');
  row('Telefon', customer?.phone || '-');
  row('Adres', customer?.address || '-');

  title('Urun Kalemleri');
  sale.items.forEach((item, index) => {
    ensure(17);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(
      tr(`${index + 1}. ${item.roomName || '-'} / ${item.windowName || '-'}`),
      left,
      y
    );
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(
      tr(item.productType || item.productGroup || 'Urun'),
      left + 3,
      y,
      { maxWidth: 80 }
    );
    doc.text(
      tr(`${Number(item.metricSize || 0).toFixed(2)} ${item.metricUnit}`),
      125,
      y,
      { align: 'right' }
    );
    doc.text(tr(money(item.unitPrice)), 158, y, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(tr(money(item.rowTotal)), right, y, { align: 'right' });
    y += 7;
    doc.setDrawColor(226, 232, 240);
    doc.line(left, y - 3, right, y - 3);
  });

  title('Odeme Ozeti');
  row('Ara Toplam', money(sale.totalAmount));
  row('Iskonto', money(sale.discount));
  row('Net Toplam', money(getSaleNetTotal(sale)));
  row('Tahsil Edilen', money(getSalePaidTotal(sale)));
  row('Kalan Bakiye', money(getSaleRemainingBalance(sale)));

  const plan = refreshInstallmentPlan(sale.installmentPlan);
  if (plan?.installments.length) {
    title('Taksit Plani');
    plan.installments.forEach(item => {
      row(
        `${item.sequence}. Taksit`,
        `${dateText(item.dueDate)} | ${money(item.amount)} | ${money(item.paidAmount)} | ${item.status}`
      );
    });
  }

  if (sale.payments?.length) {
    title('Tahsilat Gecmisi');
    [...sale.payments]
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
      .forEach(payment => {
        row(
          dateText(payment.paidAt),
          `${payment.method} | ${money(payment.amount)} | ${payment.note || '-'}`
        );
      });
  }

  title('Musteri Onayi');
  row(
    'Onay Durumu',
    sale.customerApproval?.status || 'BEKLIYOR'
  );
  row(
    'Onay Tarihi',
    dateText(sale.customerApproval?.respondedAt)
  );
  row(
    'Musteri Notu',
    sale.customerApproval?.customerNote || '-'
  );

  ensure(28);
  y += 8;
  doc.setDrawColor(148, 163, 184);
  doc.line(left, y + 10, left + 70, y + 10);
  doc.line(right - 70, y + 10, right, y + 10);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Firma Yetkilisi', left + 35, y + 15, { align: 'center' });
  doc.text('Musteri Onayi', right - 35, y + 15, { align: 'center' });

  const fileName = `${tr(sale.saleNo || sale.id)}-satis.pdf`;
  return new File([doc.output('blob')], fileName, {
    type: 'application/pdf'
  });
}

export function downloadSalesPdfFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}