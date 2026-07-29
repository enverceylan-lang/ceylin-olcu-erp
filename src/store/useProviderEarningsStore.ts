import {
  create
} from "zustand";
import {
  persist
} from "zustand/middleware";
import type {
  ProviderEarningsEntry
} from "@/lib/providerEarningsViewService";
import type {
  ProviderPaymentSnapshot
} from "@/lib/providerEarningsLedgerService";

interface ProviderEarningsStore {
  entries:
    ProviderEarningsEntry[];

  paymentSnapshots:
    ProviderPaymentSnapshot[];

  replaceSnapshot(
    entries:
      ProviderEarningsEntry[],
    paymentSnapshots:
      ProviderPaymentSnapshot[]
  ): void;

  clearSnapshot(): void;
}

export const useProviderEarningsStore =
  create<ProviderEarningsStore>()(
    persist(
      set => ({
        entries: [],
        paymentSnapshots: [],

        replaceSnapshot:
          (
            entries,
            paymentSnapshots
          ) => {
            set({
              entries:
                [...entries],

              paymentSnapshots:
                [...paymentSnapshots]
            });
          },

        clearSnapshot:
          () => {
            set({
              entries: [],
              paymentSnapshots: []
            });
          }
      }),
      {
        name:
          "enverp-provider-earnings-read-model-v1"
      }
    )
  );