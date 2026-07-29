import type { ErpScope } from "@/lib/erpScope";
import type {
  FinanceSourceDocumentType
} from "@/lib/finance/financeContracts";

export type FinanceJournalStatus =
  | "POSTED"
  | "REVERSED";

export interface FinanceJournalEntry extends ErpScope {
  id: string;
  journalNo: string;
  transactionId: string;
  idempotencyKey: string;
  sourceDocumentType: FinanceSourceDocumentType;
  sourceDocumentId: string;
  description: string | null;
  currency: string;
  status: FinanceJournalStatus;
  reversalOfJournalEntryId: string | null;
  createdBy: string;
  createdAt: string;
  postedAt: string;
  reversedAt: string | null;
}

export interface FinanceJournalLine extends ErpScope {
  id: string;
  journalEntryId: string;
  lineNo: number;
  accountId: string;
  customerId: string | null;
  supplierId: string | null;
  chequeNoteId: string | null;
  description: string | null;
  debitAmount: number;
  creditAmount: number;
  currency: string;
}

export interface FinanceJournalPosting {
  entry: FinanceJournalEntry;
  lines: FinanceJournalLine[];
}

export type FinanceJournalWriteResult =
  | {
      outcome: "CREATED";
      posting: FinanceJournalPosting;
    }
  | {
      outcome: "REPLAY";
      posting: FinanceJournalPosting;
    };
