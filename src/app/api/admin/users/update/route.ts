import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPassword, verifyAuth } from "@/lib/authHelper";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function POST(req: NextRequest) {
  try {
    const caller = await verifyAuth(req);
    if (!caller) {
      return NextResponse.json({ success: false, error: "Yetkisiz erişim." }, { status: 401 });
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

    const targetId = (id || "").trim();
    const cleanUsername = (username || "").trim().toLowerCase();

    if (!targetId) {
      return NextResponse.json({ success: false, error: "Kullanıcı ID gereklidir." }, { status: 400 });
    }

    // 1. Fetch existing user from database
    const { data: existingUser, error: fetchError } = await supabaseServer
      .from("users")
      .select("*")
      .eq("id", targetId)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching user:", fetchError);
      return NextResponse.json({ success: false, error: "Veritabanı hatası." }, { status: 500 });
    }

    const isCreate = !existingUser;

    // Check authorization:
    // - ADMIN can create or edit anyone.
    // - Other users can only edit themselves (no creation allowed, no editing others).
    const isAdmin = caller.role?.toLowerCase() === "admin";
    if (!isAdmin && targetId !== caller.id) {
      return NextResponse.json({ success: false, error: "Bu işlemi gerçekleştirmek için yetkiniz yok." }, { status: 403 });
    }

    if (isCreate && !isAdmin) {
      return NextResponse.json({ success: false, error: "Yeni kullanıcı oluşturma yetkiniz yok." }, { status: 403 });
    }

    // 2. Validate password
    let finalPassword = existingUser?.password || null;
    let passwordChanged = false;

    if (password !== undefined && password !== null) {
      const cleanPassword = password.trim();
      if (cleanPassword === "" || cleanPassword === "••••") {
        if (isCreate) {
          return NextResponse.json({ success: false, error: "Yeni kullanıcı için şifre/PIN zorunludur." }, { status: 400 });
        }
        // For updates, empty or placeholder password means preserve the existing one
      } else {
        finalPassword = hashPassword(cleanPassword);
        passwordChanged = true;
      }
    } else if (isCreate) {
      return NextResponse.json({ success: false, error: "Yeni kullanıcı için şifre/PIN zorunludur." }, { status: 400 });
    }

    // 3. Check username uniqueness
    if (cleanUsername) {
      const { data: duplicateUser, error: dupError } = await supabaseServer
        .from("users")
        .select("id")
        .eq("username", cleanUsername)
        .neq("id", targetId)
        .maybeSingle();

      if (dupError) {
        console.error("Error checking duplicate username:", dupError);
      }

      if (duplicateUser) {
        console.log("Duplicate username check status:", {
          duplicateUsernameCount: 1
        });
        return NextResponse.json({ success: false, error: "Bu kullanıcı adı zaten kullanımda." }, { status: 400 });
      }
    } else if (isCreate) {
      return NextResponse.json({ success: false, error: "Kullanıcı adı zorunludur." }, { status: 400 });
    }

    // 4. Build user data to save
    const now = new Date().toISOString();
    let userRecord: any = {};

    if (isCreate) {
      userRecord = {
        id: targetId,
        name: (name || "").trim(),
        username: cleanUsername,
        password: finalPassword,
        role: role || "FIELD",
        isActive: isActive !== undefined ? isActive : true,
        permissions: body.permissions || [],
        createdAt: now,
        updatedAt: now,
        email: email ? email.trim() : null,
        phone: phone ? phone.trim() : null,
        tcNo: tcNo ? tcNo.trim() : null,
        address: address ? address.trim() : null,
        profileCompletedAt: null,
      };
    } else {
      // Update
      userRecord = {
        ...existingUser,
        updatedAt: now,
      };

      if (passwordChanged) {
        userRecord.password = finalPassword;
      }

      if (isAdmin) {
        // Admin can update all fields
        if (name !== undefined) userRecord.name = name.trim();
        if (username !== undefined) userRecord.username = cleanUsername;
        if (role !== undefined) userRecord.role = role;
        if (isActive !== undefined) userRecord.isActive = isActive;
        if (email !== undefined) userRecord.email = email.trim() || null;
        if (phone !== undefined) userRecord.phone = phone.trim() || null;
        if (tcNo !== undefined) userRecord.tcNo = tcNo.trim() || null;
        if (address !== undefined) userRecord.address = address.trim() || null;
      } else {
        // Self-update by non-admin:
        // "Ad soyad/mail/telefon bilgilerini profil tamamlandıktan sonra kendi değiştiremez. Bu alanları sadece admin değiştirebilir."
        const isProfileComplete = !!existingUser.profileCompletedAt;

        if (!isProfileComplete) {
          // If profile is incomplete, they can fill it
          if (name !== undefined) userRecord.name = name.trim();
          if (email !== undefined) userRecord.email = email.trim() || null;
          if (phone !== undefined) userRecord.phone = phone.trim() || null;
          if (tcNo !== undefined) userRecord.tcNo = tcNo.trim() || null;
          if (address !== undefined) userRecord.address = address.trim() || null;
          
          // If they are filling the required fields, mark as completed
          if (userRecord.name && userRecord.email && userRecord.phone) {
            userRecord.profileCompletedAt = now;
          }
        } else {
          // Profile is complete, they cannot change these fields. Only password is allowed (handled above).
        }
      }
    }

    // 5. Save to Supabase
    const { error: upsertError } = await supabaseServer
      .from("users")
      .upsert(userRecord);

    if (upsertError) {
      console.error("Upsert user failed:", upsertError);
      return NextResponse.json({ success: false, error: "Kullanıcı kaydedilemedi: " + upsertError.message }, { status: 500 });
    }

    // Secure Logging (Only boolean flags and non-sensitive status)
    console.log("User updated/created status:", {
      hasPassword: !!userRecord.password,
      passwordChanged,
      role: userRecord.role,
      active: userRecord.isActive,
      duplicateUsernameCount: 0
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
      }
    });

  } catch (error: any) {
    console.error("User update API failed:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}
