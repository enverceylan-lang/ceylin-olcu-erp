export type ProviderPortalType =
  | "TAILOR"
  | "INSTALLER";

export interface ProviderPortalUser {
  id: string;
  role: string;

  providerCustomerId?:
    string | null;

  providerType?:
    ProviderPortalType | null;
}

export type ProviderPortalBlockedReason =
  | "PROVIDER_CUSTOMER_LINK_MISSING"
  | "PROVIDER_TYPE_MISSING"
  | "PROVIDER_TYPE_MISMATCH";

export type ProviderPortalMode =
  | {
      mode: "MANAGEMENT";
      isProvider: false;
      title: "Operasyonlar";
      description:
        "Satıştan terzi, tedarikçi veya montaj işi oluşturun.";
    }
  | {
      mode: "PROVIDER_READY";
      isProvider: true;
      providerType:
        ProviderPortalType;
      providerCustomerId:
        string;
      title:
        | "Benim Dikim İşlerim"
        | "Benim Montaj İşlerim";
      description:
        "Yalnız hesabınıza bağlı hizmet sağlayıcı carisine atanmış işler gösterilir.";
      emptyMessage:
        | "Size atanmış aktif dikim işi bulunmuyor."
        | "Size atanmış aktif montaj işi bulunmuyor.";
    }
  | {
      mode: "PROVIDER_BLOCKED";
      isProvider: true;
      providerType:
        ProviderPortalType;
      reason:
        ProviderPortalBlockedReason;
      title:
        | "Benim Dikim İşlerim"
        | "Benim Montaj İşlerim";
      message:
        "Hizmet sağlayıcı cari bağlantınız bulunamadı. Yönetici, kullanıcı hesabınız ile Terzi veya Montajcı cari kartı arasındaki bağlantıyı kontrol etmelidir.";
    };

function normalizeRole(
  role: string
): string {
  return role
    .trim()
    .toUpperCase();
}

export function resolveProviderPortalType(
  role: string
): ProviderPortalType | null {
  const normalized =
    normalizeRole(role);

  if (
    normalized === "TAILOR" ||
    normalized === "PRODUCTION"
  ) {
    return "TAILOR";
  }

  if (
    normalized === "INSTALLER" ||
    normalized === "INSTALLATION"
  ) {
    return "INSTALLER";
  }

  return null;
}

function providerTitle(
  providerType:
    ProviderPortalType
):
  | "Benim Dikim İşlerim"
  | "Benim Montaj İşlerim" {
  if (providerType === "TAILOR") {
    return "Benim Dikim İşlerim";
  }

  return "Benim Montaj İşlerim";
}

export function resolveProviderPortalMode(
  user:
    ProviderPortalUser | null | undefined
): ProviderPortalMode {
  const resolvedType =
    user
      ? resolveProviderPortalType(
          user.role
        )
      : null;

  if (!resolvedType) {
    return {
      mode: "MANAGEMENT",
      isProvider: false,
      title: "Operasyonlar",
      description:
        "Satıştan terzi, tedarikçi veya montaj işi oluşturun."
    };
  }

  const title =
    providerTitle(
      resolvedType
    );

  const providerCustomerId =
    String(
      user?.providerCustomerId || ""
    ).trim();

  if (!providerCustomerId) {
    return {
      mode: "PROVIDER_BLOCKED",
      isProvider: true,
      providerType:
        resolvedType,
      reason:
        "PROVIDER_CUSTOMER_LINK_MISSING",
      title,
      message:
        "Hizmet sağlayıcı cari bağlantınız bulunamadı. Yönetici, kullanıcı hesabınız ile Terzi veya Montajcı cari kartı arasındaki bağlantıyı kontrol etmelidir."
    };
  }

  if (!user?.providerType) {
    return {
      mode: "PROVIDER_BLOCKED",
      isProvider: true,
      providerType:
        resolvedType,
      reason:
        "PROVIDER_TYPE_MISSING",
      title,
      message:
        "Hizmet sağlayıcı cari bağlantınız bulunamadı. Yönetici, kullanıcı hesabınız ile Terzi veya Montajcı cari kartı arasındaki bağlantıyı kontrol etmelidir."
    };
  }

  if (
    user.providerType !==
    resolvedType
  ) {
    return {
      mode: "PROVIDER_BLOCKED",
      isProvider: true,
      providerType:
        resolvedType,
      reason:
        "PROVIDER_TYPE_MISMATCH",
      title,
      message:
        "Hizmet sağlayıcı cari bağlantınız bulunamadı. Yönetici, kullanıcı hesabınız ile Terzi veya Montajcı cari kartı arasındaki bağlantıyı kontrol etmelidir."
    };
  }

  return {
    mode: "PROVIDER_READY",
    isProvider: true,
    providerType:
      resolvedType,
    providerCustomerId,
    title,
    description:
      "Yalnız hesabınıza bağlı hizmet sağlayıcı carisine atanmış işler gösterilir.",
    emptyMessage:
      resolvedType === "TAILOR"
        ? "Size atanmış aktif dikim işi bulunmuyor."
        : "Size atanmış aktif montaj işi bulunmuyor."
  };
}