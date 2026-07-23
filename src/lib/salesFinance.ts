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

  const saleOpenAmount =
    getSaleRemainingBalance(sale);

  if (
    normalizedPayment.amount > saleOpenAmount
  ) {
    throw new Error(
      'Tahsilat tutarı satışın açık bakiyesini aşamaz.'
    );
  }

  const originalInstallments =
    sale.installmentPlan?.installments || [];

  const sortedOpenInstallments =
    [...originalInstallments]
      .filter(installment =>
        installment.status !== 'IPTAL' &&
        roundMoney(
          installment.amount -
            installment.paidAmount
        ) > 0
      )
      .sort((left, right) => {
        const dateCompare =
          left.dueDate.localeCompare(
            right.dueDate
          );

        if (dateCompare !== 0) {
          return dateCompare;
        }

        return left.sequence - right.sequence;
      });

  const selectedInstallment =
    normalizedPayment.installmentId
      ? sortedOpenInstallments.find(
          installment =>
            installment.id ===
              normalizedPayment.installmentId
        )
      : undefined;

  if (
    normalizedPayment.installmentId &&
    !selectedInstallment
  ) {
    throw new Error(
      'Seçilen taksit bulunamadı veya kapanmış.'
    );
  }

  const allocationOrder =
    selectedInstallment
      ? [
          selectedInstallment,
          ...sortedOpenInstallments.filter(
            installment =>
              installment.id !==
                selectedInstallment.id
          )
        ]
      : sortedOpenInstallments;

  let remainingPayment =
    normalizedPayment.amount;

  const installmentUpdates =
    new Map<string, SaleInstallment>();

  for (const installment of allocationOrder) {
    if (remainingPayment <= 0) break;

    const openAmount = roundMoney(
      installment.amount -
        installment.paidAmount
    );

    if (openAmount <= 0) continue;

    const appliedAmount = roundMoney(
      Math.min(openAmount, remainingPayment)
    );

    remainingPayment = roundMoney(
      remainingPayment - appliedAmount
    );

    const updatedInstallment: SaleInstallment = {
      ...installment,
      paidAmount: roundMoney(
        installment.paidAmount + appliedAmount
      ),
      lastPaymentAt: normalizedPayment.paidAt,
      status: installment.status
    };

    installmentUpdates.set(
      installment.id,
      {
        ...updatedInstallment,
        status: resolveInstallmentStatus(
          updatedInstallment
        )
      }
    );
  }

  if (
    sale.installmentPlan &&
    remainingPayment > 0
  ) {
    throw new Error(
      'Tahsilatın tamamı açık taksitlere dağıtılamadı.'
    );
  }

  const installmentPlan =
    sale.installmentPlan
      ? {
          ...sale.installmentPlan,
          installments:
            originalInstallments.map(
              installment =>
                installmentUpdates.get(
                  installment.id
                ) || installment
            )
        }
      : undefined;

  const updatedSale: Sale = {
    ...sale,
    payments: [
      ...(sale.payments || []),
      normalizedPayment
    ],
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
  sale: Sale,
  todayText = new Date()
    .toISOString()
    .slice(0, 10)
): SaleInstallment[] {
  return (
    sale.installmentPlan?.installments.filter(
      installment => {
        if (installment.status === 'IPTAL') {
          return false;
        }

        const openAmount = roundMoney(
          installment.amount -
            installment.paidAmount
        );

        return (
          openAmount > 0 &&
          installment.dueDate < todayText
        );
      }
    ) || []
  );
}
