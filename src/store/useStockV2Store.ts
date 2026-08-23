import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StockV2BottomFinishOption, StockV2ProductProfile, StockV2Scope } from "@/lib/stock/stockV2Contracts";
import { stockV2ScopeKey, validateStockV2BottomFinishOption } from "@/lib/stock/stockV2Policy";

interface StockV2State {
  profiles: StockV2ProductProfile[];
  bottomFinishOptions: StockV2BottomFinishOption[];
  upsertProfile(profile: StockV2ProductProfile): void;
  removeProfile(productId: string, scope: StockV2Scope): void;
  upsertBottomFinishOption(option: StockV2BottomFinishOption): void;
  removeBottomFinishOption(optionId: string, productId: string, scope: StockV2Scope): void;
}

function sameProductScope(leftProductId: string, leftScope: StockV2Scope, rightProductId: string, rightScope: StockV2Scope): boolean {
  return leftProductId === rightProductId && stockV2ScopeKey(leftScope) === stockV2ScopeKey(rightScope);
}

export const useStockV2Store = create<StockV2State>()(
  persist(
    (set, get) => ({
      profiles: [],
      bottomFinishOptions: [],
      upsertProfile: profile => {
        stockV2ScopeKey(profile.scope);
        set(state => {
          const same = state.profiles.find(current => sameProductScope(current.productId, current.scope, profile.productId, profile.scope));
          if (same && same.id !== profile.id) throw new Error("STOCK_V2_PROFILE_DUPLICATE_PRODUCT_SCOPE");
          const exists = state.profiles.some(current => current.id === profile.id);
          return { profiles: exists ? state.profiles.map(current => current.id === profile.id ? profile : current) : [...state.profiles, profile] };
        });
      },
      removeProfile: (productId, scope) => {
        const scopeKey = stockV2ScopeKey(scope);
        set(state => ({
          profiles: state.profiles.filter(current => !(current.productId === productId && stockV2ScopeKey(current.scope) === scopeKey)),
          bottomFinishOptions: state.bottomFinishOptions.filter(current => !(current.productId === productId && stockV2ScopeKey(current.scope) === scopeKey)),
        }));
      },
      upsertBottomFinishOption: option => {
        const profile = get().profiles.find(current => sameProductScope(current.productId, current.scope, option.productId, option.scope));
        if (!profile) throw new Error("STOCK_V2_PROFILE_REQUIRED_BEFORE_FINISH_OPTION");
        validateStockV2BottomFinishOption(option, profile);
        set(state => {
          const duplicateCode = state.bottomFinishOptions.some(current =>
            current.id !== option.id && current.productId === option.productId &&
            stockV2ScopeKey(current.scope) === stockV2ScopeKey(option.scope) &&
            current.kind === option.kind &&
            current.code.trim().toLocaleUpperCase("tr") === option.code.trim().toLocaleUpperCase("tr")
          );
          if (duplicateCode) throw new Error("STOCK_V2_FINISH_CODE_DUPLICATE");
          const exists = state.bottomFinishOptions.some(current => current.id === option.id);
          return { bottomFinishOptions: exists ? state.bottomFinishOptions.map(current => current.id === option.id ? option : current) : [...state.bottomFinishOptions, option] };
        });
      },
      removeBottomFinishOption: (optionId, productId, scope) => {
        const scopeKey = stockV2ScopeKey(scope);
        set(state => ({ bottomFinishOptions: state.bottomFinishOptions.filter(current => !(current.id === optionId && current.productId === productId && stockV2ScopeKey(current.scope) === scopeKey)) }));
      },
    }),
    {
      name: "enverp-stock-v2-profile-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ profiles: state.profiles, bottomFinishOptions: state.bottomFinishOptions }),
    },
  ),
);