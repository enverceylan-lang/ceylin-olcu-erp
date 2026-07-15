import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPassword, verifyAuth } from "@/lib/authHelper";
import { normalizeUsername } from "@/lib/usernameHelper";

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

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET(req: NextRequest) {
  try {
    const caller = await verifyAuth(req);

    if (!caller) {
      return NextResponse.json(
        { success: false, error: "Yetkisiz erişim." },
        { status: 401 }
      );
    }

    const isAdmin = caller.role?.toLowerCase() === "admin";

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için yetkiniz yok." },
        { status: 403 }
      );
    }

    const { data: dbUsers, error } = await supabaseServer
      .from("users")
      .select(
        "id, name, username, role, isActive, email, phone, tcNo, address, permissions, createdAt, updatedAt, profileCompletedAt"
      )
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
    const caller = await verifyAuth(req);

    if (!caller) {
      return NextResponse.json(
        { success: false, error: "Yetkisiz erişim." },
        { status: 401 }
      );
    }

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
    const isAdmin = caller.role?.toLowerCase() === "admin";
    const isSelfUpdate = !isCreate && targetId === caller.id;

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
        finalPassword = hashPassword(cleanPassword);
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

    // Kullanıcı adı benzersiz olmalıdır.
    if (cleanUsername) {
      const { data: duplicateUser, error: dupError } = await supabaseServer
        .from("users")
        .select("id")
        .eq("username", cleanUsername)
        .neq("id", targetId)
        .maybeSingle();

      if (dupError) {
        console.error("Error checking duplicate username:", dupError);

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
            error: "Bu kullanıcı adı zaten kullanımda.",
          },
          { status: 409 }
        );
      }
    }

    const now = new Date().toISOString();
    let userRecord: any;

    if (isCreate) {
      userRecord = {
        id: targetId,
        name: String(name).trim(),
        username: cleanUsername,
        password: finalPassword,
        role: role || "FIELD",
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        permissions: Array.isArray(body.permissions) ? body.permissions : [],
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
        profileCompletedAt: null,
      };
    } else {
      userRecord = {
        ...existingUser,
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

    const { error: upsertError } = await supabaseServer
      .from("users")
      .upsert(userRecord);

    if (upsertError) {
      console.error("Upsert user failed:", upsertError);

      return NextResponse.json(
        {
          success: false,
          error: "Kullanıcı kaydedilemedi: " + upsertError.message,
        },
        { status: 500 }
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
        profileCompletedAt: userRecord.profileCompletedAt,
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