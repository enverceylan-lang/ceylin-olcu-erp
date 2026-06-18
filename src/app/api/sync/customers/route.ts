import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPassword } from "@/lib/authHelper";

// Server-side service-role client that bypasses RLS
const supabaseUrl = process.env.SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
});

// Helper to verify auth using Supabase users table
async function verifySupabaseAuth(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.substring(7);
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [username, credential] = decoded.split(":");
    if (!username || !credential) return null;

    // Fetch user from Supabase using the server client
    const { data: user, error } = await supabaseServer
      .from("users")
      .select("*")
      .eq("username", username.toLowerCase().trim())
      .single();

    if (error || !user || !user.isActive) return null;

    const isHashed = credential.length === 128;
    const hashedPassword = isHashed ? credential : hashPassword(credential);

    if (user.password !== hashedPassword) return null;
    return user;
  } catch (e) {
    console.error("verifySupabaseAuth failed:", e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await verifySupabaseAuth(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { customers: localCustomers, pendingDeletes, users: localUsers } = await req.json();

    // 1. Process deletions
    if (Array.isArray(pendingDeletes)) {
      for (const del of pendingDeletes) {
        // Only allow deleting tables related to sync
        if (["customers", "rooms", "openings", "measurements"].includes(del.table)) {
          await supabaseServer.from(del.table).delete().eq("id", del.id);
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
          mergedUsersMap.set(lu.id, {
            id: lu.id,
            name: lu.name,
            username: lu.username,
            password: pwd || (ru ? ru.password : hashPassword("123")),
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
          createdAt: remote.createdAt,
          updatedAt: remote.updatedAt,
          rooms: []
        });
      } else if (new Date(remote.updatedAt) > new Date(local.updatedAt || 0)) {
        mergedCustomersMap.set(remote.id, {
          ...local,
          name: remote.name,
          phone: remote.phone || "",
          address: remote.address || "",
          mapLocation: remote.mapLocation || "",
          notes: remote.notes || "",
          createdAt: remote.createdAt,
          updatedAt: remote.updatedAt
        });
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
        } else if (new Date(dr.updatedAt) > new Date(lr.updatedAt || 0)) {
          mergedRoomsMap.set(dr.id, {
            ...lr,
            name: dr.name,
            photos: dr.photos || [],
            videos: dr.videos || [],
            createdAt: dr.createdAt,
            updatedAt: dr.updatedAt
          });
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
          } else if (new Date(do_.updatedAt) > new Date(lo.updatedAt || 0)) {
            mergedOpeningsMap.set(do_.id, {
              ...lo,
              name: do_.name,
              width: do_.width || undefined,
              height: do_.height || undefined,
              fieldNotes: do_.fieldNotes || "",
              photos: do_.photos || [],
              videos: do_.videos || [],
              createdAt: do_.createdAt,
              updatedAt: do_.updatedAt
            });
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
            } else if (new Date(dm.updatedAt) > new Date(lm.updatedAt || 0)) {
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
                photos: dm.photos || [],
                videos: dm.videos || [],
                createdAt: dm.createdAt,
                updatedAt: dm.updatedAt
              });
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
        await supabaseServer.from("customers").upsert({
          id: c.id,
          name: c.name,
          phone: c.phone,
          address: c.address,
          mapLocation: c.mapLocation,
          notes: c.notes,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt
        });
      }

      // Rooms
      for (const r of c.rooms) {
        const dbRoom = remoteRooms?.find(dr => dr.id === r.id);
        if (!dbRoom || new Date(r.updatedAt || 0) > new Date(dbRoom.updatedAt)) {
          await supabaseServer.from("rooms").upsert({
            id: r.id,
            name: r.name,
            customerId: c.id,
            photos: r.photos || [],
            videos: r.videos || [],
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
          });
        }

        // Openings
        for (const o of r.windows) {
          const dbOpening = remoteOpenings?.find(do_ => do_.id === o.id);
          if (!dbOpening || new Date(o.updatedAt || 0) > new Date(dbOpening.updatedAt)) {
            await supabaseServer.from("openings").upsert({
              id: o.id,
              name: o.name,
              roomId: r.id,
              width: o.width || null,
              height: o.height || null,
              fieldNotes: o.fieldNotes || "",
              photos: o.photos || [],
              videos: o.videos || [],
              createdAt: o.createdAt,
              updatedAt: o.updatedAt
            });
          }

          // Measurements
          for (const m of o.products) {
            const dbMeasurement = remoteMeasurements?.find(dm => dm.id === m.id);
            if (!dbMeasurement || new Date(m.updatedAt || 0) > new Date(dbMeasurement.updatedAt)) {
              await supabaseServer.from("measurements").upsert({
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
                photos: m.photos || [],
                videos: m.videos || []
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      customers: finalCustomers,
      users: sanitizedUsers
    });

  } catch (error: any) {
    console.error("POST sync failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
