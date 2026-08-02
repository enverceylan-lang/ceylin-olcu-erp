import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createClient,
} from "@supabase/supabase-js";
import {
  hashPassword,
} from "@/lib/authHelper";
import {
  normalizeUsername,
} from "@/lib/usernameHelper";
import {
  assertPlatformMetadataOnly,
} from "@/lib/platformAdminContracts";
import {
  normalizeErpPackage,
} from "@/lib/packageFeatures";
import {
  requirePlatformSuperAdmin,
} from "@/lib/platformAdminServerGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

type CompanyRow = {
  tenant_id: string;
  company_id: string;
  company_code: string;
  slug: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type TenantRow = {
  tenant_id: string;
  tenant_code: string;
  name: string;
  is_active: boolean;
};

type LicenseRow = {
  tenant_id: string;
  package_code: string;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  feature_overrides: Record<string, unknown> | null;
  branch_limit: number;
  user_limit: number;
};

function serverClient() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function cleanText(
  value: unknown,
  maxLength: number,
): string {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function cleanCode(
  value: unknown,
  maxLength: number,
): string {
  return cleanText(value, maxLength)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cleanSlug(
  value: unknown,
): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function isIsoDate(value: string): boolean {
  return (
    value.length > 0 &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(
  request: NextRequest,
) {
  const access =
    await requirePlatformSuperAdmin(request);

  if (!access.allowed) {
    return NextResponse.json(
      {
        success: false,
        code: access.code,
      },
      {
        status: access.status,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const supabase = serverClient();

  if (!supabase) {
    return NextResponse.json(
      {
        success: false,
        code: "SERVER_CONFIGURATION_MISSING",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const [
    companiesResult,
    tenantsResult,
    licensesResult,
  ] = await Promise.all([
    supabase
      .from("erp_companies")
      .select(
        "tenant_id,company_id,company_code,slug,name,is_active,created_at,updated_at",
      )
      .order("name", { ascending: true }),
    supabase
      .from("erp_tenants")
      .select(
        "tenant_id,tenant_code,name,is_active",
      ),
    supabase
      .from("erp_package_licenses")
      .select(
        "tenant_id,package_code,starts_at,ends_at,is_active,feature_overrides,branch_limit,user_limit",
      )
      .eq("is_active", true),
  ]);

  if (
    companiesResult.error ||
    tenantsResult.error ||
    licensesResult.error
  ) {
    console.error(
      "[Platform Companies] Metadata read failed.",
    );

    return NextResponse.json(
      {
        success: false,
        code: "PLATFORM_METADATA_READ_FAILED",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const companies =
    (companiesResult.data || []) as CompanyRow[];
  const tenants =
    (tenantsResult.data || []) as TenantRow[];
  const licenses =
    (licensesResult.data || []) as LicenseRow[];

  const tenantById =
    new Map(
      tenants.map((row) => [
        row.tenant_id,
        row,
      ]),
    );

  const licenseByTenant =
    new Map(
      licenses.map((row) => [
        row.tenant_id,
        row,
      ]),
    );

  const records =
    companies.map((company) => {
      const tenant =
        tenantById.get(company.tenant_id);
      const license =
        licenseByTenant.get(company.tenant_id);

      return {
        tenantId: company.tenant_id,
        tenantCode:
          tenant?.tenant_code || "",
        tenantName:
          tenant?.name || "",
        tenantActive:
          tenant?.is_active === true,

        companyId: company.company_id,
        companyCode: company.company_code,
        companySlug: company.slug,
        companyName: company.name,
        companyActive: company.is_active,

        package:
          license?.package_code || null,
        licenseActive:
          license?.is_active === true,
        licenseStartsAt:
          license?.starts_at || null,
        licenseEndsAt:
          license?.ends_at || null,
        branchLimit:
          license?.branch_limit ?? null,
        userLimit:
          license?.user_limit ?? null,
        featureOverrides:
          license?.feature_overrides || {},

        createdAt: company.created_at,
        updatedAt: company.updated_at,
      };
    });

  assertPlatformMetadataOnly({
    companies: records,
  });

  return NextResponse.json(
    {
      success: true,
      companies: records,
    },
    {
      status: 200,
      headers: NO_STORE_HEADERS,
    },
  );
}

export async function POST(
  request: NextRequest,
) {
  const access =
    await requirePlatformSuperAdmin(request);

  if (!access.allowed) {
    return NextResponse.json(
      {
        success: false,
        code: access.code,
      },
      {
        status: access.status,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const supabase = serverClient();

  if (!supabase) {
    return NextResponse.json(
      {
        success: false,
        code: "SERVER_CONFIGURATION_MISSING",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  let body: Record<string, unknown>;

  try {
    body =
      (await request.json()) as Record<
        string,
        unknown
      >;
  } catch {
    return NextResponse.json(
      {
        success: false,
        code: "INVALID_JSON",
      },
      {
        status: 400,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const tenantCode =
    cleanCode(body.tenantCode, 50);
  const tenantName =
    cleanText(body.tenantName, 200);
  const companyCode =
    cleanCode(body.companyCode, 50);
  const companySlug =
    cleanSlug(body.companySlug);
  const companyName =
    cleanText(body.companyName, 200);
  const branchCode =
    cleanCode(body.branchCode, 50);
  const branchName =
    cleanText(body.branchName, 200);
  const periodCode =
    cleanCode(body.periodCode, 50);
  const periodName =
    cleanText(body.periodName, 200);
  const periodStartsOn =
    cleanText(body.periodStartsOn, 10);
  const periodEndsOn =
    cleanText(body.periodEndsOn, 10);

  const packageCode =
    normalizeErpPackage(
      cleanText(body.package, 20),
    );

  const licenseStartsAt =
    cleanText(body.licenseStartsAt, 40);
  const licenseEndsAt =
    cleanText(body.licenseEndsAt, 40);

  const branchLimit =
    Number(body.branchLimit);
  const userLimit =
    Number(body.userLimit);

  const admin =
    body.companyAdmin &&
    typeof body.companyAdmin === "object" &&
    !Array.isArray(body.companyAdmin)
      ? (
          body.companyAdmin as Record<
            string,
            unknown
          >
        )
      : {};

  const adminName =
    cleanText(admin.name, 200);
  const adminUsername =
    normalizeUsername(
      cleanText(admin.username, 100),
    );
  const adminPassword =
    cleanText(admin.password, 500);
  const adminEmail =
    cleanText(admin.email, 200);
  const adminPhone =
    cleanText(admin.phone, 50);

  const featureOverrides =
    body.featureOverrides &&
    typeof body.featureOverrides ===
      "object" &&
    !Array.isArray(body.featureOverrides)
      ? body.featureOverrides
      : {};

  if (
    !tenantCode ||
    !tenantName ||
    !companyCode ||
    companySlug.length < 3 ||
    !companyName ||
    !branchCode ||
    !branchName ||
    !periodCode ||
    !periodName ||
    !isDateOnly(periodStartsOn) ||
    !isDateOnly(periodEndsOn) ||
    periodEndsOn < periodStartsOn ||
    !packageCode ||
    !isIsoDate(licenseStartsAt) ||
    (
      licenseEndsAt &&
      (
        !isIsoDate(licenseEndsAt) ||
        new Date(licenseEndsAt).getTime() <
          new Date(
            licenseStartsAt,
          ).getTime()
      )
    ) ||
    !Number.isInteger(branchLimit) ||
    branchLimit < 1 ||
    branchLimit > 1000 ||
    !Number.isInteger(userLimit) ||
    userLimit < 1 ||
    userLimit > 100000 ||
    !adminName ||
    !adminUsername ||
    !adminPassword
  ) {
    return NextResponse.json(
      {
        success: false,
        code: "PROVISION_REQUEST_INVALID",
      },
      {
        status: 400,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  if (
    adminPassword === "123" ||
    adminPassword.length < 8
  ) {
    return NextResponse.json(
      {
        success: false,
        code: "ADMIN_PASSWORD_WEAK",
      },
      {
        status: 400,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const passwordHash =
    hashPassword(adminPassword);

  const rpcRequest = {
    tenant_code: tenantCode,
    tenant_name: tenantName,
    company_code: companyCode,
    company_slug: companySlug,
    company_name: companyName,
    branch_code: branchCode,
    branch_name: branchName,
    period_code: periodCode,
    period_name: periodName,
    period_starts_on: periodStartsOn,
    period_ends_on: periodEndsOn,
    package_code: packageCode,
    license_starts_at: licenseStartsAt,
    license_ends_at:
      licenseEndsAt || null,
    branch_limit: branchLimit,
    user_limit: userLimit,
    feature_overrides: featureOverrides,
    company_admin_name: adminName,
    company_admin_username:
      adminUsername,
    company_admin_password_hash:
      passwordHash,
    company_admin_email:
      adminEmail || null,
    company_admin_phone:
      adminPhone || null,
  };

  const { data, error } =
    await supabase.rpc(
      "provision_platform_company_v1",
      {
        p_request: rpcRequest,
        p_actor_user_id:
          access.actor.id,
      },
    );

  if (error) {
    console.error(
      "[Platform Companies] Provision failed.",
    );

    const message =
      String(error.message || "");

    const conflict =
      message.includes(
        "PLATFORM_PROVISION_CONFLICT",
      );

    return NextResponse.json(
      {
        success: false,
        code: conflict
          ? "PLATFORM_PROVISION_CONFLICT"
          : "PLATFORM_PROVISION_FAILED",
      },
      {
        status: conflict ? 409 : 500,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  assertPlatformMetadataOnly(data);

  return NextResponse.json(
    {
      success: true,
      provisioned: data,
    },
    {
      status: 201,
      headers: NO_STORE_HEADERS,
    },
  );
}