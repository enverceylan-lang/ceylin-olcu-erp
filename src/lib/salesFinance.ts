import type {
  InstallmentStatus,
  Sale,
  SaleInstallment,
  SaleInstallmentPlan,
  SalePayment
} from '@/store/salesStore';

const roundMoney = (value: number): number =>
  Number(Number(value || 0).toFixed(2));

function addMonths(dateText: string, monthCount: number): string {
  const source = new Date(`${dateText}T12:00:00`);

  if (Number.isNaN(source.getTime())) {
    throw new Error('Geçersiz ilk vade tarihi.');
  }

  source.setMonth(source.getMonth() + monthCount);

  return source.toISOString().slice(0, 10);
}

export function getSaleNetTotal(sale: Sale): number {
  return roundMoney(
    Number(sale.totalAmount || 0) -
      Number(sale.discount || 0)
  );
}

export function getSalePaidTotal(sale: Sale): number {
  const paymentTotal = (sale.payments || []).reduce(
    (total, payment) =>
      total + Number(payment.amount || 0),
    0
  );

  return roundMoney(
    Math.max(
      Number(sale.downPayment || 0),
      paymentTotal
    )
  );
}

export function getSaleRemainingBalance(sale: Sale): number {
  return roundMoney(
    Math.max(
      0,
      getSaleNetTotal(sale) - getSalePaidTotal(sale)
    )
  );
}

export function resolveInstallmentStatus(
  installment: SaleInstallment,
  todayText = new Date().toISOString().slice(0, 10)
): InstallmentStatus {
  const amount = roundMoney(installment.amount);
  const paidAmount = roundMoney(installment.paidAmount);

  if (installment.status === 'IPTAL') {
    return 'IPTAL';
  }

  if (paidAmount >= amount && amount > 0) {
    return 'ODENDI';
  }

  if (paidAmount > 0) {
    return 'KISMI_ODENDI';
  }

  if (installment.dueDate < todayText) {
    return 'GECIKTI';
  }

  return 'BEKLIYOR';
}

export function refreshInstallmentPlan(
  plan?: SaleInstallmentPlan
): SaleInstallmentPlan | undefined {
  if (!plan) return undefined;

  return {
    ...plan,
    installments: plan.installments.map(installment => ({
      ...installment,
      status: resolveInstallmentStatus(installment)
    }))
  };
}

export function createEqualInstallmentPlan(args: {
  totalAmount: number;
  installmentCount: number;
  firstDueDate: string;
}): SaleInstallmentPlan {
  const totalAmount = roundMoney(args.totalAmount);
  const installmentCount = Math.max(
    1,
    Math.trunc(Number(args.installmentCount || 1))
  );

  if (totalAmount <= 0) {
    throw new Error(
      'Taksitlendirilecek tutar sıfırdan büyük olmalıdır.'
    );
  }

  const baseAmount = roundMoney(
    totalAmount / installmentCount
  );

  let distributed = 0;

  const installments: SaleInstallment[] =
    Array.from({ length: installmentCount }).map(
      (_, index) => {
        const isLast = index === installmentCount - 1;
        const amount = isLast
          ? roundMoney(totalAmount - distributed)
          : baseAmount;

        distributed = roundMoney(distributed + amount);

        return {
          id: crypto.randomUUID(),
          sequence: index + 1,
          dueDate: addMonths(args.firstDueDate, index),
          amount,
          paidAmount: 0,
          status: 'BEKLIYOR'
        };
      }
    );

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    firstDueDate: args.firstDueDate,
    installmentCount,
    frequency: 'MONTHLY',
    totalPlannedAmount: totalAmount,
    installments
  };
}

export function applyPaymentToSale(
  sale: Sale,
  payment: SalePayment
): Sale {
  const normalizedPayment: SalePayment = {
    ...payment,
    amount: roundMoney(payment.amount)
  };

  if (normalizedPayment.amount <= 0) {
    throw new Error(
      'Tahsilat tutarı sıfırdan büyük olmalıdır.'
    );
  }

  const payments = [
    ...(sale.payments || []),
    normalizedPayment
  ];

  let remainingPayment = normalizedPayment.amount;

  const installmentPlan = sale.installmentPlan
    ? {
        ...sale.installmentPlan,
        installments: sale.installmentPlan.installments.map(
          installment => {
            if (
              remainingPayment <= 0 ||
              (
                normalizedPayment.installmentId &&
                normalizedPayment.installmentId !==
                  installment.id
              )
            ) {
              return installment;
            }

            const openAmount = roundMoney(
              installment.amount -
                installment.paidAmount
            );

            if (openAmount <= 0) {
              return installment;
            }

            const appliedAmount = Math.min(
              openAmount,
              remainingPayment
            );

            remainingPayment = roundMoney(
              remainingPayment - appliedAmount
            );

            const paidAmount = roundMoney(
              installment.paidAmount + appliedAmount
            );

            const updated: SaleInstallment = {
              ...installment,
              paidAmount,
              lastPaymentAt: normalizedPayment.paidAt,
              status: installment.status
            };

            return {
              ...updated,
              status: resolveInstallmentStatus(updated)
            };
          }
        )
      }
    : undefined;

  const updatedSale: Sale = {
    ...sale,
    payments,
    installmentPlan,
    updatedAt: new Date().toISOString()
  };

  return {
    ...updatedSale,
    remainingBalance:
      getSaleRemainingBalance(updatedSale)
  };
}

export function getOverdueInstallments(
  sale: Sale
): SaleInstallment[] {
  return (
    refreshInstallmentPlan(sale.installmentPlan)
      ?.installments.filter(
        installment =>
          installment.status === 'GECIKTI'
      ) || []
  );
}