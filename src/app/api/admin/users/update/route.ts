import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPasswordV2 } from "@/lib/authHelper";
import { requireCompanySession } from "@/lib/companySessionGuard";
import {
  findCompanyUsernameConflict,
  isUserInCompany,
  listCompanyUserIds,
} from "@/lib/companyUserScopeGuard";
import { normalizeUsername } from "@/lib/usernameHelper";
import {
  isKnownFinanceLikePermission,
} from "@/lib/finance/financePermissionCatalog";
import {
  isFinancePermission,
} from "@/lib/finance/financeRoleDefaults";
import {
  mergeSelectedFinancePermissions,
} from "@/lib/finance/userFinancePermissions";

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://placeholder-project.supabase.co";

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "placeholder-service-key";

const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

type UserRecord = {
  id: string;
  name: string;
  username: string;
  password: string | null;
  role: string;
  isActive: boolean;
  permissions: unknown[];
  createdAt: string;
  updatedAt: string;
  email: string | null;
  phone: string | null;
  providerCustomerId: string | null;
  providerType: "TAILOR" | "INSTALLER" | null;
  tcNo: string | null;
  address: string | null;
  profileCompletedAt: string | null;
};
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET(req: NextRequest) {
  try {
    const companySession =
      await requireCompanySession(
        req,
        "WEB",
      );

    if (!companySession.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: companySession.code,
        },
        {
          status: companySession.status,
        },
      );
    }

    const caller = companySession.actor;
    const isAdmin =
      caller.role?.toLowerCase() === "admin";

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için yetkiniz yok." },
        { status: 403 }
      );
    }

    const companyUserIds =
      await listCompanyUserIds(
        supabaseServer,
        companySession.session,
      );

    if (companyUserIds === null) {
      return NextResponse.json(
        { success: false, error: "Şirket kullanıcı kapsamı okunamadı." },
        { status: 500 },
      );
    }

    if (companyUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        users: [],
      });
    }

    const { data: dbUsers, error } = await supabaseServer
      .from("users")
      .select(
        "id, name, username, role, isActive, email, phone, tcNo, address, permissions, createdAt, updatedAt, profileCompletedAt, providerCustomerId, providerType"
      )
      .in("id", companyUserIds)
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to fetch users:", error);

      return NextResponse.json(
        { success: false, error: "Veritabanı hatası." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      users: dbUsers,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";

    console.error("List users API failed:", message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const companySession =
      await requireCompanySession(
        req,
        "WEB",
      );

    if (!companySession.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: companySession.code,
        },
        {
          status: companySession.status,
        },
      );
    }

    const caller = companySession.actor;
    const body = await req.json();

    const {
      id,
      name,
      username,
      role,
      isActive,
      email,
      phone,
      tcNo,
      address,
      password,
    } = body;

    const targetId = typeof id === "string" ? id.trim() : "";

    const cleanUsername =
      username !== undefined ? normalizeUsername(username) : "";

    if (!targetId) {
      return NextResponse.json(
        { success: false, error: "Kullanıcı ID gereklidir." },
        { status: 400 }
      );
    }

    if (username !== undefined && !cleanUsername) {
      return NextResponse.json(
        { success: false, error: "Geçersiz kullanıcı adı." },
        { status: 400 }
      );
    }

    const { data: existingUser, error: fetchError } = await supabaseServer
      .from("users")
      .select("*")
      .eq("id", targetId)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching user:", fetchError);

      return NextResponse.json(
        { success: false, error: "Veritabanı hatası." },
        { status: 500 }
      );
    }

    const isCreate = !existingUser;

    if (!isCreate) {
      const targetInCompany =
        await isUserInCompany(
          supabaseServer,
          companySession.session,
          targetId,
        );

      if (!targetInCompany) {
        return NextResponse.json(
          {
            success: false,
            code: "USER_OUTSIDE_COMPANY_SCOPE",
            error: "Hedef kullanıcı bu şirket kapsamında değil.",
          },
          { status: 403 },
        );
      }
    }

    const isAdmin = caller.role?.toLowerCase() === "admin";
    const isSelfUpdate = !isCreate && targetId === caller.id;
    const hasFinancePermissionUpdate =
      Object.prototype.hasOwnProperty.call(body, "financePermissions");

    // Admin herkes üzerinde işlem yapabilir.
    // Personel yalnız kendi eksik profilini tamamlayabilir.
    if (!isAdmin && !isSelfUpdate) {
      return NextResponse.json(
        {
          success: false,
          error: "Bu işlemi gerçekleştirmek için yetkiniz yok.",
        },
        { status: 403 }
      );
    }

    if (isCreate && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Yeni kullanıcı oluşturma yetkiniz yok.",
        },
        { status: 403 }
      );
    }

    if (hasFinancePermissionUpdate && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          code: "FINANCE_PERMISSION_UPDATE_FORBIDDEN",
          error: "Finans yetkilerini yalnız yönetici güncelleyebilir.",
        },
        { status: 403 }
      );
    }

    const targetRole = String(
      role ?? existingUser?.role ?? "FIELD"
    );
  const normalizedTargetRole =
    targetRole.trim().toUpperCase();

  const requestedProviderCustomerId =
    typeof body.providerCustomerId === "string"
      ? body.providerCustomerId.trim()
      : body.providerCustomerId === null
        ? ""
        : undefined;

  let resolvedProviderCustomerId:
    string | null | undefined;

  let resolvedProviderType:
    "TAILOR" | "INSTALLER" | null | undefined;

  if (
    normalizedTargetRole === "TAILOR" ||
    normalizedTargetRole === "PRODUCTION"
  ) {
    resolvedProviderCustomerId =
      requestedProviderCustomerId === undefined
        ? existingUser?.providerCustomerId ?? undefined
        : requestedProviderCustomerId || null;

    resolvedProviderType =
      resolvedProviderCustomerId
        ? "TAILOR"
        : null;
  } else if (
    normalizedTargetRole === "INSTALLER" ||
    normalizedTargetRole === "INSTALLATION"
  ) {
    resolvedProviderCustomerId =
      requestedProviderCustomerId === undefined
        ? existingUser?.providerCustomerId ?? undefined
        : requestedProviderCustomerId || null;

    resolvedProviderType =
      resolvedProviderCustomerId
        ? "INSTALLER"
        : null;
  } else {
    resolvedProviderCustomerId = null;
    resolvedProviderType = null;
  }
    let nextPermissions: string[] | null = null;

    if (isCreate) {
      const initialPermissions = Array.isArray(body.permissions)
        ? body.permissions
        : [];
      const unknownFinancePermissions = initialPermissions
        .filter(isKnownFinanceLikePermission)
        .map(String);

      if (unknownFinancePermissions.length > 0) {
        return NextResponse.json(
          {
            success: false,
            code: "UNKNOWN_FINANCE_PERMISSION",
            error: "Bilinmeyen finans yetkisi gönderildi.",
          },
          { status: 400 }
        );
      }

      const selectedFinancePermissions = hasFinancePermissionUpdate
        ? body.financePermissions
        : initialPermissions.filter(isFinancePermission);
      const permissionUpdate = mergeSelectedFinancePermissions({
        existingPermissions: initialPermissions,
        selectedFinancePermissions,
        targetRole,
      });

      if (!permissionUpdate.ok) {
        return NextResponse.json(
          {
            success: false,
            code: permissionUpdate.code,
            error: "Finans yetkisi isteği geçersiz.",
          },
          { status: permissionUpdate.code === "PLATFORM_FINANCE_DENIED" ? 403 : 400 }
        );
      }
      nextPermissions = permissionUpdate.permissions;
    } else if (hasFinancePermissionUpdate) {
      const permissionUpdate = mergeSelectedFinancePermissions({
        existingPermissions: existingUser.permissions,
        selectedFinancePermissions: body.financePermissions,
        targetRole,
      });

      if (!permissionUpdate.ok) {
        return NextResponse.json(
          {
            success: false,
            code: permissionUpdate.code,
            error: "Finans yetkisi isteği geçersiz.",
          },
          { status: permissionUpdate.code === "PLATFORM_FINANCE_DENIED" ? 403 : 400 }
        );
      }
      nextPermissions = permissionUpdate.permissions;
    }

    // Kullanıcı adı yalnız admin tarafından belirlenebilir.
    if (
      !isAdmin &&
      username !== undefined &&
      cleanUsername !== existingUser?.username
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "USERNAME_IMMUTABLE",
          error: "Kullanıcı adınızı değiştiremezsiniz.",
        },
        { status: 403 }
      );
    }

    // Yeni kullanıcı oluştururken yalnız ad, kullanıcı adı ve şifre zorunludur.
    // E-posta ve telefonu personel ilk girişte tamamlar.
    if (isCreate) {
      if (!name || !name.trim()) {
        return NextResponse.json(
          { success: false, error: "Ad veya personel etiketi zorunludur." },
          { status: 400 }
        );
      }

      if (!cleanUsername) {
        return NextResponse.json(
          { success: false, error: "Kullanıcı adı zorunludur." },
          { status: 400 }
        );
      }
    }

    let finalPassword = existingUser?.password || null;
    let passwordChanged = false;

    if (password !== undefined && password !== null) {
      const cleanPassword = String(password).trim();

      if (cleanPassword === "" || cleanPassword === "••••") {
        if (isCreate) {
          return NextResponse.json(
            {
              success: false,
              error: "Yeni kullanıcı için şifre/PIN zorunludur.",
            },
            { status: 400 }
          );
        }
      } else {
        finalPassword = hashPasswordV2(cleanPassword);
        passwordChanged = true;
      }
    } else if (isCreate) {
      return NextResponse.json(
        {
          success: false,
          error: "Yeni kullanıcı için şifre/PIN zorunludur.",
        },
        { status: 400 }
      );
    }

    // Kullanıcı adı yalnız aynı şirket kapsamında benzersiz olmalıdır.
    if (cleanUsername) {
      const duplicateUser =
        await findCompanyUsernameConflict(
          supabaseServer,
          companySession.session,
          cleanUsername,
          targetId,
        );

      if (duplicateUser === "READ_FAILED") {
        return NextResponse.json(
          { success: false, error: "Kullanıcı adı kontrol edilemedi." },
          { status: 500 }
        );
      }

      if (duplicateUser) {
        return NextResponse.json(
          {
            success: false,
            code: "USERNAME_EXISTS",
            error: "Bu kullanıcı adı bu şirkette zaten kullanımda.",
          },
          { status: 409 }
        );
      }
    }

    const now = new Date().toISOString();
    let userRecord: UserRecord;

    if (isCreate) {
      userRecord = {
        id: targetId,
        name: String(name).trim(),
        username: cleanUsername,
        password: finalPassword,
        role: role || "FIELD",
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        permissions: nextPermissions || [],
        createdAt: now,
        updatedAt: now,

        // Admin bu alanları boş bırakabilir.
        email:
          typeof email === "string" && email.trim() ? email.trim() : null,
        phone:
          typeof phone === "string" && phone.trim() ? phone.trim() : null,
        tcNo:
          typeof tcNo === "string" && tcNo.trim() ? tcNo.trim() : null,
        address:
          typeof address === "string" && address.trim()
            ? address.trim()
            : null,

        // Admin oluşturması profili tamamlamaz.
        providerCustomerId:
          resolvedProviderCustomerId ?? null,

        providerType:
          resolvedProviderType ?? null,

        profileCompletedAt: null,
      };
    } else {
      userRecord = {
        ...(existingUser as UserRecord),
        updatedAt: now,
      };

      if (passwordChanged) {
        userRecord.password = finalPassword;
      }

      if (isAdmin) {
        // Admin kullanıcı hesabını yönetebilir.
        // Fakat adminin yaptığı düzenleme profil tamamlama tarihi oluşturmaz.
        if (name !== undefined) {
          const cleanName = String(name).trim();

          if (!cleanName) {
            return NextResponse.json(
              { success: false, error: "Ad veya personel etiketi boş olamaz." },
              { status: 400 }
            );
          }

          userRecord.name = cleanName;
        }

        if (username !== undefined) {
          userRecord.username = cleanUsername;
        }

        if (role !== undefined) {
          userRecord.role = role;
        }

        if (nextPermissions) {
          userRecord.permissions = nextPermissions;
        }

        if (isActive !== undefined) {
          userRecord.isActive = Boolean(isActive);
        }

        if (email !== undefined) {
          userRecord.email =
            typeof email === "string" && email.trim() ? email.trim() : null;
        }

        if (phone !== undefined) {
          userRecord.phone =
            typeof phone === "string" && phone.trim() ? phone.trim() : null;
        }

        if (tcNo !== undefined) {
          userRecord.tcNo =
            typeof tcNo === "string" && tcNo.trim() ? tcNo.trim() : null;
        }

        if (address !== undefined) {
          userRecord.address =
            typeof address === "string" && address.trim()
              ? address.trim()
              : null;
        }
    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "providerCustomerId"
      ) ||
      role !== undefined
    ) {
      userRecord.providerCustomerId =
        resolvedProviderCustomerId ?? null;

      userRecord.providerType =
        resolvedProviderType ?? null;
    }

        // Admin mevcut profil durumunu değiştirmez.
        userRecord.profileCompletedAt =
          existingUser.profileCompletedAt || null;
      } else {
        const profileAlreadyCompleted = Boolean(
          existingUser.profileCompletedAt
        );

        if (profileAlreadyCompleted) {
          // Profil tamamlandıktan sonra personel kullanıcı adı,
          // rol, aktiflik ve kimlik bilgilerini değiştiremez.
          // Şifre değişikliği yukarıdaki güvenli akıştan yapılabilir.
          userRecord.profileCompletedAt =
            existingUser.profileCompletedAt;
        } else {
          const cleanName =
            typeof name === "string" ? name.trim() : "";

          const cleanEmail =
            typeof email === "string" ? email.trim() : "";

          const cleanPhone =
            typeof phone === "string" ? phone.trim() : "";

          if (
            !cleanName ||
            cleanName === "İsimsiz Kullanıcı" ||
            !cleanEmail ||
            !cleanPhone
          ) {
            return NextResponse.json(
              {
                success: false,
                code: "PROFILE_REQUIRED",
                error:
                  "Ad soyad, mail adresi ve telefon numarası zorunludur.",
              },
              { status: 400 }
            );
          }

          if (!isValidEmail(cleanEmail)) {
            return NextResponse.json(
              {
                success: false,
                code: "INVALID_EMAIL",
                error: "Geçerli bir mail adresi giriniz.",
              },
              { status: 400 }
            );
          }

          // Personel ilk girişte gerçek bilgilerini tamamlar.
          userRecord.name = cleanName;
          userRecord.email = cleanEmail;
          userRecord.phone = cleanPhone;

          if (tcNo !== undefined) {
            userRecord.tcNo =
              typeof tcNo === "string" && tcNo.trim()
                ? tcNo.trim()
                : null;
          }

          if (address !== undefined) {
            userRecord.address =
              typeof address === "string" && address.trim()
                ? address.trim()
                : null;
          }

          // Kullanıcı adı değişmez.
          userRecord.username = existingUser.username;

          // Profil yalnız personelin başarılı ilk giriş kaydıyla tamamlanır.
          userRecord.profileCompletedAt = now;
        }
      }
    }

    const { error: persistenceError } = await supabaseServer.rpc(
      "manage_company_user_v1",
      {
        p_user: userRecord,
        p_is_create: isCreate,
        p_password_changed: passwordChanged,
        p_actor_user_id: caller.id,
        p_actor_user_scope_id: companySession.session.userScopeId,
        p_tenant_id: companySession.session.tenantId,
        p_company_id: companySession.session.companyId,
      },
    );

    if (persistenceError) {
      const persistenceMessage = String(
        persistenceError.message || "",
      );

      if (
        persistenceMessage.includes(
          "ERP_USER_MGMT_CONFLICT:USERNAME",
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            code: "USERNAME_EXISTS",
            error: "Bu kullanıcı adı bu şirkette zaten kullanımda.",
          },
          { status: 409 },
        );
      }

      if (
        persistenceMessage.includes(
          "ERP_USER_MGMT_FORBIDDEN:",
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            code: "USER_MANAGEMENT_FORBIDDEN",
            error: "Kullanıcı işlemi şirket yetki kapsamı tarafından reddedildi.",
          },
          { status: 403 },
        );
      }

      console.error(
        "Atomic user persistence failed:",
        persistenceError,
      );

      return NextResponse.json(
        {
          success: false,
          code: "USER_MANAGEMENT_PERSIST_FAILED",
          error: "Kullanıcı kaydı atomik olarak tamamlanamadı.",
        },
        { status: 500 },
      );
    }

    console.log("User updated/created status:", {
      hasPassword: Boolean(userRecord.password),
      passwordChanged,
      role: userRecord.role,
      active: userRecord.isActive,
      profileCompleted: Boolean(userRecord.profileCompletedAt),
    });

    return NextResponse.json({
      success: true,
      userId: userRecord.id,
      username: userRecord.username,
      role: userRecord.role,
      active: userRecord.isActive,
      passwordChanged,
      updatedAt: userRecord.updatedAt,
      user: {
        id: userRecord.id,
        name: userRecord.name,
        username: userRecord.username,
        role: userRecord.role,
        isActive: userRecord.isActive,
        permissions: userRecord.permissions,
        createdAt: userRecord.createdAt,
        updatedAt: userRecord.updatedAt,
        email: userRecord.email,
        phone: userRecord.phone,
        tcNo: userRecord.tcNo,
        address: userRecord.address,
        profileCompletedAt:
          userRecord.profileCompletedAt,

        providerCustomerId:
          userRecord.providerCustomerId,

        providerType:
          userRecord.providerType,
        hasPassword: true,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";

    console.error("User update API failed:", message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
