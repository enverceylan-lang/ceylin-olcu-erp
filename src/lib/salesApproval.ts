import type {
  CustomerApprovalStatus,
  Sale,
  SaleCustomerApproval
} from '@/store/salesStore';
import { getSaleRemainingBalance } from '@/lib/salesFinance';

const TOKEN_VALID_DAYS = 30;

function addDays(
  isoDate: string,
  dayCount: number
): string {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + dayCount);
  return date.toISOString();
}

function normalizePhone(phone?: string): string {
  if (!phone) return '';

  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('90')) {
    return digits;
  }

  if (digits.startsWith('0')) {
    return `90${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `90${digits}`;
  }

  return digits;
}

export function createSaleApproval(
  sale: Sale
): SaleCustomerApproval {
  const now = new Date().toISOString();

  return {
    status: 'BEKLIYOR',
    token: crypto.randomUUID().replace(/-/g, ''),
    tokenCreatedAt: now,
    tokenExpiresAt: addDays(now, TOKEN_VALID_DAYS),
    approvedPhone:
      sale.customerApproval?.approvedPhone
  };
}

export function isSaleApprovalTokenValid(
  approval?: SaleCustomerApproval
): boolean {
  if (!approval?.token || !approval.tokenExpiresAt) {
    return false;
  }

  return (
    approval.status === 'BEKLIYOR' &&
    new Date(approval.tokenExpiresAt).getTime() >
      Date.now()
  );
}

export function buildSaleApprovalUrl(args: {
  origin: string;
  saleId: string;
  token: string;
}): string {
  const origin = args.origin.replace(/\/+$/, '');

  return `${origin}/onay/satis/${encodeURIComponent(
    args.saleId
  )}?token=${encodeURIComponent(args.token)}`;
}

export function buildSaleApprovalMessage(args: {
  customerName: string;
  saleNo: string;
  approvalUrl: string;
  remainingBalance: number;
}): string {
  const remaining = Number(
    args.remainingBalance || 0
  ).toLocaleString('tr-TR', {
    style: 'currency',
    currency: 'TRY'
  });

  return [
    `Sayın ${args.customerName},`,
    '',
    `${args.saleNo} numaralı satış/teklif kaydınız hazırlanmıştır.`,
    `Kalan bakiye: ${remaining}`,
    '',
    'Ürünleri ve ödeme planını inceleyerek onay verebilir veya düzeltme talebinizi iletebilirsiniz:',
    args.approvalUrl,
    '',
    'CEYLİN PERDE & ÇEYİZ'
  ].join('\n');
}

export function buildWhatsAppApprovalUrl(args: {
  phone?: string;
  message: string;
}): string {
  const phone = normalizePhone(args.phone);

  return `https://wa.me/${phone}?text=${encodeURIComponent(
    args.message
  )}`;
}

export function prepareSaleForApproval(args: {
  sale: Sale;
  origin: string;
  customerName: string;
  customerPhone?: string;
}): {
  sale: Sale;
  approvalUrl: string;
  whatsappUrl: string;
} {
  const approval = createSaleApproval(args.sale);

  const approvalUrl = buildSaleApprovalUrl({
    origin: args.origin,
    saleId: args.sale.id,
    token: approval.token || ''
  });

  const message = buildSaleApprovalMessage({
    customerName: args.customerName,
    saleNo: args.sale.saleNo,
    approvalUrl,
    remainingBalance:
      getSaleRemainingBalance(args.sale)
  });

  const sentAt = new Date().toISOString();

  return {
    sale: {
      ...args.sale,
      customerApproval: {
        ...approval,
        sentAt,
        approvedPhone: args.customerPhone
      },
      whatsappApprovalSentAt: sentAt,
      updatedAt: sentAt
    },
    approvalUrl,
    whatsappUrl: buildWhatsAppApprovalUrl({
      phone: args.customerPhone,
      message
    })
  };
}

export function applySaleApprovalResponse(args: {
  sale: Sale;
  status: Extract<
    CustomerApprovalStatus,
    'ONAYLANDI' | 'DUZELTME_ISTENDI'
  >;
  customerNote?: string;
  approvedName?: string;
  approvedPhone?: string;
}): Sale {
  const respondedAt = new Date().toISOString();

  return {
    ...args.sale,
    customerApproval: {
      ...(args.sale.customerApproval || {
        status: 'BEKLIYOR'
      }),
      status: args.status,
      respondedAt,
      customerNote:
        args.customerNote?.trim() || undefined,
      approvedName:
        args.approvedName?.trim() || undefined,
      approvedPhone:
        args.approvedPhone?.trim() || undefined
    },
    status:
      args.status === 'ONAYLANDI'
        ? 'ONAYLANDI'
        : args.sale.status,
    updatedAt: respondedAt
  };
}