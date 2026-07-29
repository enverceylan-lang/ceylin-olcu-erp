import { create } from "zustand";
import {
  assertPlatformMetadataOnly,
  buildPlatformCompanyLicenseView,
  validatePlatformLicenseUpdate,
  type PlatformCompanyLicenseRecord,
  type PlatformCompanyLicenseView,
  type PlatformLicenseUpdateRequest
} from "@/lib/platformAdminContracts";

export interface PlatformAdminState {
  companies:
    PlatformCompanyLicenseView[];

  selectedCompanyId:
    string | null;

  loading: boolean;
  error: string | null;

  replaceCompanies(
    records:
      PlatformCompanyLicenseRecord[]
  ): void;

  selectCompany(
    companyId: string | null
  ): void;

  previewLicenseUpdate(
    request:
      PlatformLicenseUpdateRequest
  ):
    | {
        valid: true;
        normalizedPackage:
          PlatformCompanyLicenseRecord["package"];
      }
    | {
        valid: false;
        reason: string;
      };

  clear(): void;
}

export function buildSafePlatformCompanyViews(
  records:
    PlatformCompanyLicenseRecord[]
): PlatformCompanyLicenseView[] {
  assertPlatformMetadataOnly(records);

  return records
    .map(
      buildPlatformCompanyLicenseView
    )
    .sort((left, right) =>
      left.companyName.localeCompare(
        right.companyName,
        "tr"
      )
    );
}

export const usePlatformAdminStore =
  create<PlatformAdminState>(
    (set, get) => ({
      companies: [],
      selectedCompanyId: null,
      loading: false,
      error: null,

      replaceCompanies: records => {
        const companies =
          buildSafePlatformCompanyViews(
            records
          );

        const selectedCompanyId =
          get().selectedCompanyId;

        const selectionStillExists =
          selectedCompanyId !== null &&
          companies.some(
            company =>
              company.companyId ===
              selectedCompanyId
          );

        set({
          companies,
          selectedCompanyId:
            selectionStillExists
              ? selectedCompanyId
              : null,
          error: null
        });
      },

      selectCompany: companyId =>
        set({
          selectedCompanyId:
            companyId
        }),

      previewLicenseUpdate:
        request => {
          const result =
            validatePlatformLicenseUpdate(
              request
            );

          if (!result.valid) {
            return {
              valid: false,
              reason: result.reason
            };
          }

          return {
            valid: true,
            normalizedPackage:
              result.normalizedPackage
          };
        },

      clear: () =>
        set({
          companies: [],
          selectedCompanyId: null,
          loading: false,
          error: null
        })
    })
  );