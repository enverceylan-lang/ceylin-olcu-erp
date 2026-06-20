import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPassword } from "@/lib/authHelper";
import crypto from "crypto";


function decodeJwtPayload(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const decoded = Buffer.from(payload, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// Helper to get or create client with current environment variables
function getSupabaseServer() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Helper to verify auth using Supabase users table
async function verifySupabaseAuth(req: NextRequest) {
  let reason = "";
  try {
    const authHeader = req.headers.get("Authorization");
    const authHeaderExists = !!authHeader;
    console.log("[Server Sync Diagnostic] Authorization header exists:", authHeaderExists);
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      reason = `Auth header missing or invalid format (startsWith Bearer: ${authHeader?.startsWith("Bearer ")})`;
      return { user: null, reason };
    }

    const token = authHeader.substring(7);
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [username, credential] = decoded.split(":");
    const decodedUsername = username || "";
    const credentialPresent = !!credential;

    console.log("[Server Sync Diagnostic] Basic Auth decoded username:", decodedUsername);
    console.log("[Server Sync Diagnostic] Basic Auth password exists:", credentialPresent);

    if (!username || !credential) {
      reason = `Decoded username or credential missing (username: ${!!username}, credential: ${!!credential})`;
      return { user: null, reason };
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log("[Server Sync Diagnostic] Supabase URL exists:", !!supabaseUrl);
    console.log("[Server Sync Diagnostic] Supabase service role key exists:", !!supabaseServiceKey);

    const supabaseServer = getSupabaseServer();
    // Fetch user from Supabase using the server client
    const { data: user, error } = await supabaseServer
      .from("users")
      .select("*")
      .eq("username", username.toLowerCase().trim())
      .single();

    const dbUserFound = !!user;
    console.log("[Server Sync Diagnostic] users query success:", !error);
    if (error) {
      console.log("[Server Sync Diagnostic] users query error if any:", error.message);
      reason = `Database query error: ${error.message}`;
      return { user: null, reason };
    } else {
      console.log("[Server Sync Diagnostic] users query error if any:", null);
    }
    console.log("[Server Sync Diagnostic] matched user found:", dbUserFound);

    if (!user) {
      reason = `User ${username} not found in database`;
      return { user: null, reason };
    }

    if (!user.isActive) {
      reason = `User ${username} is not active`;
      return { user: null, reason };
    }

    const isHashed = credential.length === 128;
    const hashedPassword = isHashed ? credential : hashPassword(credential);

    const passwordMatches = user.password === hashedPassword;
    console.log("[Server Sync Diagnostic] password verification success:", passwordMatches);

    if (!passwordMatches) {
      const generatedHashedFirst12 = hashedPassword.substring(0, 12);
      const dbPasswordFirst12 = user.password ? user.password.substring(0, 12) : "None";
      const secret = process.env.SESSION_SECRET || "";
      const secretHash = crypto.createHash("sha256").update(secret).digest("hex");
      reason = `Password mismatch. Generated hash starts with: ${generatedHashedFirst12}, DB hash starts with: ${dbPasswordFirst12}. Secret SHA256: ${secretHash}`;
      return { user: null, reason };
    }

    return { user, reason: "Authenticated successfully" };
  } catch (e: any) {
    console.error("verifySupabaseAuth failed:", e);
    return { user: null, reason: `Exception: ${e.message}` };
  }
}

export async function POST(req: NextRequest) {
  console.log("[Server Sync Diagnostic] request received");
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Log existence of critical env vars — never print their values
  console.log("[Server Config] SESSION_SECRET exists:", !!process.env.SESSION_SECRET);
  console.log("[Server Config] SUPABASE_SERVICE_ROLE_KEY exists:", !!supabaseServiceKey);
  console.log("[Server Config] SUPABASE_URL exists:", !!supabaseUrl);


  if (!supabaseUrl) {
    console.error("[Sync Config Error] Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
    console.log("[Server Sync Diagnostic] final response status and reason:", 500, "Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
    return NextResponse.json(
      {
        success: false,
        error: "Server configuration error",
        reason: "Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL"
      },
      { status: 500 }
    );
  }

  if (!supabaseServiceKey) {
    console.error("[Sync Config Error] Missing SUPABASE_SERVICE_ROLE_KEY");
    console.log("[Server Sync Diagnostic] final response status and reason:", 500, "Missing SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json(
      {
        success: false,
        error: "Server configuration error",
        reason: "Missing SUPABASE_SERVICE_ROLE_KEY"
      },
      { status: 500 }
    );
  }

  const servicePayload = decodeJwtPayload(supabaseServiceKey);

  console.log("[Supabase Config Diagnostics]", {
    supabaseUrlPresent: !!supabaseUrl,
    serviceKeyPresent: !!supabaseServiceKey,
    serviceKeyLooksJwt: supabaseServiceKey.startsWith("eyJ"),
    serviceKeyRole: servicePayload?.role || null,
    serviceKeyRef: servicePayload?.ref || null,
  });

  if (!servicePayload || servicePayload.role !== "service_role") {
    console.error(`[Sync Config Error] SUPABASE_SERVICE_ROLE_KEY is not a service_role key. Decoded role: ${servicePayload?.role || "null"}`);
    console.log("[Server Sync Diagnostic] final response status and reason:", 500, "SUPABASE_SERVICE_ROLE_KEY is not a service_role key");
    return NextResponse.json(
      {
        success: false,
        error: "Server configuration error",
        reason: "SUPABASE_SERVICE_ROLE_KEY is not a service_role key"
      },
      { status: 500 }
    );
  }

  const supabaseServer = getSupabaseServer();

  const authResult = await verifySupabaseAuth(req);
  if (!authResult.user) {
    console.log("[Server Sync Diagnostic] final response status and reason:", 401, authResult.reason);
    return NextResponse.json(
      { success: false, error: "Unauthorized", reason: authResult.reason },
      { status: 401 }
    );
  }
  const user = authResult.user;
  try {
    const { customers: localCustomers, pendingDeletes, users: localUsers } = await req.json();
    console.log("[Sync API POST] Received payload. Local customers count:", localCustomers?.length, "pendingDeletes count:", pendingDeletes?.length);

    // 1. Process deletions (Soft deleted customers are synced as isDeleted=true, not deleted via pendingDeletes)
    if (Array.isArray(pendingDeletes)) {
      for (const del of pendingDeletes) {
        // Only allow hard deleting child structures related to sync
        if (["rooms", "openings", "measurements"].includes(del.table)) {
          const { error } = await supabaseServer.from(del.table).delete().eq("id", del.id);
          if (error) {
            console.error(`[Sync Server Delete Error] Failed to delete from ${del.table} (id: ${del.id}):`, error.message);
          }
        }
      }
    }

    // 2. Pull all entities from Supabase
    const { data: remoteCustomers } = await supabaseServer.from("customers").select("*");
    const { data: remoteRooms } = await supabaseServer.from("rooms").select("*");
    const { data: remoteOpenings } = await supabaseServer.from("openings").select("*");
    const { data: remoteMeasurements } = await supabaseServer.from("measurements").select("*");
    const { data: remoteUsers } = await supabaseServer.from("users").select("*");

    // 3. Sync Users list if user is ADMIN or OFFICE and localUsers is provided
    let finalUsers = remoteUsers || [];
    const isAdminOrOffice = ["ADMIN", "OFFICE", "SALES"].includes(user.role);
    if (isAdminOrOffice && Array.isArray(localUsers)) {
      const mergedUsersMap = new Map<string, any>();
      (remoteUsers || []).forEach(ru => mergedUsersMap.set(ru.id, ru));
      localUsers.forEach(lu => {
        const ru = mergedUsersMap.get(lu.id);
        if (!ru || new Date(lu.updatedAt) > new Date(ru.updatedAt)) {
          let pwd = lu.password;
          if (pwd && pwd.length !== 128) {
            pwd = hashPassword(pwd);
          }
          let finalPassword = pwd || (ru ? ru.password : null);
          if (!finalPassword) {
            console.error(`[Sync User Error] User "${lu.username}" has no password locally or in remote database. Password field cannot be null.`);
            // Lock the account by setting a random high-entropy hash so no one can guess it
            finalPassword = hashPassword(crypto.randomUUID());
          }
          mergedUsersMap.set(lu.id, {
            id: lu.id,
            name: lu.name,
            username: lu.username,
            password: finalPassword,
            role: lu.role,
            isActive: lu.isActive,
            permissions: lu.permissions || [],
            createdAt: lu.createdAt || new Date().toISOString(),
            updatedAt: lu.updatedAt || new Date().toISOString()
          });
        }
      });

      finalUsers = Array.from(mergedUsersMap.values());
      // Push any newer local users to Supabase
      for (const u of finalUsers) {
        const ru = remoteUsers?.find(r => r.id === u.id);
        if (!ru || new Date(u.updatedAt) > new Date(ru.updatedAt)) {
          await supabaseServer.from("users").upsert(u);
        }
      }
    }

    // Sanitize users list (exclude password field) before sending to client
    const sanitizedUsers = finalUsers.map(({ password, ...u }) => u);

    // 4. Merge Customers, Rooms, Openings, Measurements
    // Map remote data for easy lookup
    const roomsByCustomer = new Map<string, any[]>();
    remoteRooms?.forEach(r => {
      const arr = roomsByCustomer.get(r.customerId) || [];
      arr.push(r);
      roomsByCustomer.set(r.customerId, arr);
    });

    const openingsByRoom = new Map<string, any[]>();
    remoteOpenings?.forEach(o => {
      const arr = openingsByRoom.get(o.roomId) || [];
      arr.push(o);
      openingsByRoom.set(o.roomId, arr);
    });

    const measurementsByOpening = new Map<string, any[]>();
    remoteMeasurements?.forEach(m => {
      const arr = measurementsByOpening.get(m.openingId) || [];
      arr.push(m);
      measurementsByOpening.set(m.openingId, arr);
    });

    const mergedCustomersMap = new Map<string, any>();
    if (Array.isArray(localCustomers)) {
      localCustomers.forEach((c: any) => {
        mergedCustomersMap.set(c.id, { ...c });
      });
    }

    remoteCustomers?.forEach((remote: any) => {
      const local = mergedCustomersMap.get(remote.id);
      if (!local) {
        mergedCustomersMap.set(remote.id, {
          id: remote.id,
          name: remote.name,
          phone: remote.phone || "",
          address: remote.address || "",
          mapLocation: remote.mapLocation || "",
          notes: remote.notes || "",
          createdById: remote.createdById || "",
          createdByName: remote.createdByName || "",
          assignedSalesId: remote.assignedSalesId || "",
          assignedSalesName: remote.assignedSalesName || "",
          assignedMeasureId: remote.assignedMeasureId || "",
          assignedMeasureName: remote.assignedMeasureName || "",
          assignedTailorId: remote.assignedTailorId || "",
          assignedTailorName: remote.assignedTailorName || "",
          assignedInstallerId: remote.assignedInstallerId || "",
          assignedInstallerName: remote.assignedInstallerName || "",
          workflowStatus: remote.workflowStatus || "YENI",
          customerCode: remote.customerCode || "",
          taxNumber: remote.taxNumber || "",
          phone2: remote.phone2 || "",
          extraDescription: remote.extraDescription || "",
          generalNote: remote.generalNote || "",
          cariType: remote.cariType || "CUSTOMER",
          approvalStatus: remote.approvalStatus || "APPROVED",
          addressPhotos: remote.addressPhotos || [],
          isDeleted: remote.isDeleted || false,
          deletedAt: remote.deletedAt || null,
          createdAt: remote.createdAt,
          updatedAt: remote.updatedAt,
          rooms: []
        });
      } else {
        // If local has empty/missing media, preserve from remote database
        if (!local.addressPhotos || local.addressPhotos.length === 0) {
          local.addressPhotos = remote.addressPhotos || [];
        }

        if (new Date(remote.updatedAt) > new Date(local.updatedAt || 0)) {
          mergedCustomersMap.set(remote.id, {
            ...local,
            name: remote.name,
            phone: remote.phone || "",
            address: remote.address || "",
            mapLocation: remote.mapLocation || "",
            notes: remote.notes || "",
            createdById: remote.createdById || "",
            createdByName: remote.createdByName || "",
            assignedSalesId: remote.assignedSalesId || "",
            assignedSalesName: remote.assignedSalesName || "",
            assignedMeasureId: remote.assignedMeasureId || "",
            assignedMeasureName: remote.assignedMeasureName || "",
            assignedTailorId: remote.assignedTailorId || "",
            assignedTailorName: remote.assignedTailorName || "",
            assignedInstallerId: remote.assignedInstallerId || "",
            assignedInstallerName: remote.assignedInstallerName || "",
            workflowStatus: remote.workflowStatus || "YENI",
            customerCode: remote.customerCode || "",
            taxNumber: remote.taxNumber || "",
            phone2: remote.phone2 || "",
            extraDescription: remote.extraDescription || "",
            generalNote: remote.generalNote || "",
            cariType: remote.cariType || "CUSTOMER",
            approvalStatus: remote.approvalStatus || "APPROVED",
            isDeleted: remote.isDeleted || false,
            deletedAt: remote.deletedAt || null,
            createdAt: remote.createdAt,
            updatedAt: remote.updatedAt
          });
        }
      }
    });

    const finalCustomers = Array.from(mergedCustomersMap.values());

    for (const c of finalCustomers) {
      const localRooms = c.rooms || [];
      const dbRooms = roomsByCustomer.get(c.id) || [];

      const mergedRoomsMap = new Map<string, any>();
      localRooms.forEach((lr: any) => mergedRoomsMap.set(lr.id, lr));

      dbRooms.forEach((dr: any) => {
        const lr = mergedRoomsMap.get(dr.id);
        if (!lr) {
          mergedRoomsMap.set(dr.id, {
            id: dr.id,
            name: dr.name,
            photos: dr.photos || [],
            videos: dr.videos || [],
            windows: [],
            createdAt: dr.createdAt,
            updatedAt: dr.updatedAt
          });
        } else {
          if (!lr.photos || lr.photos.length === 0) {
            lr.photos = dr.photos || [];
          }
          if (!lr.videos || lr.videos.length === 0) {
            lr.videos = dr.videos || [];
          }

          if (new Date(dr.updatedAt) > new Date(lr.updatedAt || 0)) {
            mergedRoomsMap.set(dr.id, {
              ...lr,
              name: dr.name,
              createdAt: dr.createdAt,
              updatedAt: dr.updatedAt
            });
          }
        }
      });

      const mergedRoomsList = Array.from(mergedRoomsMap.values());

      for (const r of mergedRoomsList) {
        const localOpenings = r.windows || [];
        const dbOpenings = openingsByRoom.get(r.id) || [];

        const mergedOpeningsMap = new Map<string, any>();
        localOpenings.forEach((lo: any) => mergedOpeningsMap.set(lo.id, lo));

        dbOpenings.forEach((do_: any) => {
          const lo = mergedOpeningsMap.get(do_.id);
          if (!lo) {
            mergedOpeningsMap.set(do_.id, {
              id: do_.id,
              name: do_.name,
              width: do_.width || undefined,
              height: do_.height || undefined,
              fieldNotes: do_.fieldNotes || "",
              photos: do_.photos || [],
              videos: do_.videos || [],
              products: [],
              createdAt: do_.createdAt,
              updatedAt: do_.updatedAt
            });
          } else {
            if (!lo.photos || lo.photos.length === 0) {
              lo.photos = do_.photos || [];
            }
            if (!lo.videos || lo.videos.length === 0) {
              lo.videos = do_.videos || [];
            }

            if (new Date(do_.updatedAt) > new Date(lo.updatedAt || 0)) {
              mergedOpeningsMap.set(do_.id, {
                ...lo,
                name: do_.name,
                width: do_.width || undefined,
                height: do_.height || undefined,
                fieldNotes: do_.fieldNotes || "",
                createdAt: do_.createdAt,
                updatedAt: do_.updatedAt
              });
            }
          }
        });

        const mergedOpeningsList = Array.from(mergedOpeningsMap.values());

        for (const o of mergedOpeningsList) {
          const localMeasurements = o.products || [];
          const dbMeasurements = measurementsByOpening.get(o.id) || [];

          const mergedMeasurementsMap = new Map<string, any>();
          localMeasurements.forEach((lm: any) => mergedMeasurementsMap.set(lm.id, lm));

          dbMeasurements.forEach((dm: any) => {
            const lm = mergedMeasurementsMap.get(dm.id);
            const normalizedMeasuredDate = dm.measuredDate ? new Date(dm.measuredDate).toISOString() : new Date().toISOString();

            if (!lm) {
              mergedMeasurementsMap.set(dm.id, {
                id: dm.id,
                templateType: dm.templateType,
                rawValues: dm.rawValues || {},
                productId: dm.productId || undefined,
                productGroup: dm.productGroup || undefined,
                productType: dm.productType || undefined,
                calculatedWidth: dm.calculatedWidth || undefined,
                calculatedHeight: dm.calculatedHeight || undefined,
                details: dm.details || {},
                notes: dm.notes || "",
                status: dm.status || "",
                measuredBy: dm.measuredBy || "",
                measuredById: dm.measuredById || undefined,
                createdById: dm.createdById || undefined,
                measuredDate: normalizedMeasuredDate,
                notesHistory: dm.notesHistory || [],
                photos: dm.photos || [],
                videos: dm.videos || [],
                createdAt: dm.createdAt,
                updatedAt: dm.updatedAt
              });
            } else {
              if (!lm.photos || lm.photos.length === 0) {
                lm.photos = dm.photos || [];
              }
              if (!lm.videos || lm.videos.length === 0) {
                lm.videos = dm.videos || [];
              }

              if (new Date(dm.updatedAt) > new Date(lm.updatedAt || 0)) {
                mergedMeasurementsMap.set(dm.id, {
                  ...lm,
                  templateType: dm.templateType,
                  rawValues: dm.rawValues || {},
                  productId: dm.productId || undefined,
                  productGroup: dm.productGroup || undefined,
                  productType: dm.productType || undefined,
                  calculatedWidth: dm.calculatedWidth || undefined,
                  calculatedHeight: dm.calculatedHeight || undefined,
                  details: dm.details || {},
                  notes: dm.notes || "",
                  status: dm.status || "",
                  measuredBy: dm.measuredBy || "",
                  measuredById: dm.measuredById || undefined,
                  createdById: dm.createdById || undefined,
                  measuredDate: normalizedMeasuredDate,
                  notesHistory: dm.notesHistory || [],
                  createdAt: dm.createdAt,
                  updatedAt: dm.updatedAt
                });
              }
            }
          });

          o.products = Array.from(mergedMeasurementsMap.values());
        }

        r.windows = mergedOpeningsList;
      }

      c.rooms = mergedRoomsList;
    }

    // 5. Push local modifications to Supabase
    for (const c of finalCustomers) {
      // Customer
      const dbCustomer = remoteCustomers?.find(dc => dc.id === c.id);
      if (!dbCustomer || new Date(c.updatedAt || 0) > new Date(dbCustomer.updatedAt)) {
        const { error } = await supabaseServer.from("customers").upsert({
          id: c.id,
          name: c.name,
          phone: c.phone,
          address: c.address,
          mapLocation: c.mapLocation,
          notes: c.notes,
          createdById: c.createdById || null,
          createdByName: c.createdByName || null,
          assignedSalesId: c.assignedSalesId || null,
          assignedSalesName: c.assignedSalesName || null,
          assignedMeasureId: c.assignedMeasureId || null,
          assignedMeasureName: c.assignedMeasureName || null,
          assignedTailorId: c.assignedTailorId || null,
          assignedTailorName: c.assignedTailorName || null,
          assignedInstallerId: c.assignedInstallerId || null,
          assignedInstallerName: c.assignedInstallerName || null,
          workflowStatus: c.workflowStatus || "YENI",
          customerCode: c.customerCode || null,
          taxNumber: c.taxNumber || null,
          phone2: c.phone2 || null,
          extraDescription: c.extraDescription || null,
          generalNote: c.generalNote || null,
          cariType: c.cariType || "CUSTOMER",
          approvalStatus: c.approvalStatus || "APPROVED",
          addressPhotos: (c.addressPhotos && c.addressPhotos.length > 0) ? c.addressPhotos : (dbCustomer?.addressPhotos || []),
          isDeleted: c.isDeleted || false,
          deletedAt: c.deletedAt || null,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt
        });
        if (error) {
          console.error(`[Sync DB Error] Customer upsert failed for ${c.name} (${c.id}):`, error);
          throw new Error(`Customer upsert failed: ${error.message}`);
        }
      }

      // Rooms
      for (const r of c.rooms) {
        const dbRoom = remoteRooms?.find(dr => dr.id === r.id);
        if (!dbRoom || new Date(r.updatedAt || 0) > new Date(dbRoom.updatedAt)) {
          const { error } = await supabaseServer.from("rooms").upsert({
            id: r.id,
            name: r.name,
            customerId: c.id,
            photos: (r.photos && r.photos.length > 0) ? r.photos : (dbRoom?.photos || []),
            videos: (r.videos && r.videos.length > 0) ? r.videos : (dbRoom?.videos || []),
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
          });
          if (error) {
            console.error(`[Sync DB Error] Room upsert failed for ${r.name} (${r.id}):`, error);
            throw new Error(`Room upsert failed: ${error.message}`);
          }
        }

        // Openings
        for (const o of r.windows) {
          const dbOpening = remoteOpenings?.find(do_ => do_.id === o.id);
          if (!dbOpening || new Date(o.updatedAt || 0) > new Date(dbOpening.updatedAt)) {
            const { error } = await supabaseServer.from("openings").upsert({
              id: o.id,
              name: o.name,
              roomId: r.id,
              width: o.width || null,
              height: o.height || null,
              fieldNotes: o.fieldNotes || "",
              photos: (o.photos && o.photos.length > 0) ? o.photos : (dbOpening?.photos || []),
              videos: (o.videos && o.videos.length > 0) ? o.videos : (dbOpening?.videos || []),
              createdAt: o.createdAt,
              updatedAt: o.updatedAt
            });
            if (error) {
              console.error(`[Sync DB Error] Opening upsert failed for ${o.name} (${o.id}):`, error);
              throw new Error(`Opening upsert failed: ${error.message}`);
            }
          }

          // Measurements
          for (const m of o.products) {
            const dbMeasurement = remoteMeasurements?.find(dm => dm.id === m.id);
            if (!dbMeasurement || new Date(m.updatedAt || 0) > new Date(dbMeasurement.updatedAt)) {
              const { error } = await supabaseServer.from("measurements").upsert({
                id: m.id,
                openingId: o.id,
                templateType: m.templateType,
                rawValues: m.rawValues || {},
                productId: m.productId || null,
                productGroup: m.productGroup || null,
                productType: m.productType || null,
                calculatedWidth: m.calculatedWidth || null,
                calculatedHeight: m.calculatedHeight || null,
                details: m.details || {},
                notes: m.notes || "",
                status: m.status || "",
                measuredBy: m.measuredBy || "",
                measuredById: m.measuredById || null,
                createdById: m.createdById || null,
                measuredDate: m.measuredDate || new Date().toISOString(),
                createdAt: m.createdAt,
                updatedAt: m.updatedAt,
                notesHistory: m.notesHistory || [],
                photos: (m.photos && m.photos.length > 0) ? m.photos : (dbMeasurement?.photos || []),
                videos: (m.videos && m.videos.length > 0) ? m.videos : (dbMeasurement?.videos || [])
              });
              if (error) {
                console.error(`[Sync DB Error] Measurement upsert failed for ${m.id}:`, error);
                throw new Error(`Measurement upsert failed: ${error.message}`);
              }
            }
          }
        }
      }
    }
    console.log("[Server Sync Diagnostic] final response status and reason:", 200, "Success");
    return NextResponse.json({
      success: true,
      customers: finalCustomers,
      users: sanitizedUsers
    });

  } catch (error: any) {
    console.error("POST sync failed:", error);
    console.log("[Server Sync Diagnostic] final response status and reason:", 500, error.message || "Internal server error");
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
