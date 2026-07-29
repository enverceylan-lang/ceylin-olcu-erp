import type {
  ErpScope
} from "@/lib/erpScope";

export interface CustomerFinanceAllocationRecord
  extends ErpScope {
  id: string;

  cashMovementId: string;
  journalEntryId: string;

  customerId: string;
  openItemId: string;

  saleId: string | null;
  installmentId: string | null;

  documentNumber: string;
  dueDate: string;

  allocatedAmount: number;
  currency: string;

  createdBy: string;
  createdAt: string;
}
