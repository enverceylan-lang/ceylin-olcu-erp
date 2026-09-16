import {
  classifyCustomerRootScope,
  customerTreeScopeIssue,
  migrateLegacyCustomerRootScope,
  readErpScope,
  stampCustomerTreeScope,
} from '@/lib/customerTreeScope';
import { erpScopeMatches } from '@/lib/erpScope';
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/authHelper";
import { loadShadowErpContext } from "@/lib/serverErpContext";
import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";
type SyncRecord = Record<string, unknown> & {
  id: string;
  customerId?: string;
  roomId?: string;
  openingId?: string;
  rooms?: SyncRecord[];
  addresses?: SyncRecord[];
  windows?: SyncRecord[];
  products?: SyncRecord[];
  photos?: unknown[];
  videos?: unknown[];
  addressPhotos?: unknown[];
  notesHistory?: unknown[];
  updatedAt?: string | number | Date;
  createdAt?: string | number | Date;
  measuredDate?: string | number | Date;
};

// Helper to identify if a string is a base64 / data URL
function isDataUrl(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  return val.startsWith('data:') || val.includes(';base64,') || val.length > 5000;
}

// Strip any raw base64 data URLs from nested objects/arrays
// TODO Future architecture: media files should be uploaded to Supabase Storage buckets, and only their public URLs/storage paths saved in DB/media_files table.
function sanitizeMediaValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;

  if (typeof val === 'string') {
    if (isDataUrl(val)) {
      return '';
    }
    return val;
  }

  if (Array.isArray(val)) {
    return val
      .map(item => sanitizeMediaValue(item))
      .filter(item => item !== '');
  }

  if (typeof val === 'object') {
    const source = val as Record<string, unknown>;
    const res: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      if (['addressPhotos', 'photos', 'videos'].includes(key) && Array.isArray(source[key])) {
        res[key] = source[key]
          .map((item: unknown) => sanitizeMediaValue(item))
          .filter((item: unknown) => item !== '');
      } else {
        res[key] = sanitizeMediaValue(source[key]);
      }
    }
    return res;
  }

  return val;
}



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

export async function POST(req: NextRequest) {
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

  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const erpContext = await loadShadowErpContext(
    supabaseServer,
    user.id,
    { requestedScopeId: readRequestedErpScopeId(req) },
  );

  if (!erpContext.ready) {
    return NextResponse.json(
      {
        success: false,
        error: "ERP scope is not ready",
        reason: erpContext.reason,
      },
      { status: erpContext.reason === "READ_FAILED" ? 503 : 409 },
    );
  }

  const scopeColumns = {
    tenant_id: erpContext.scope.tenantId,
    company_id: erpContext.scope.companyId,
    branch_id: erpContext.scope.branchId,
    accounting_period_id:
      erpContext.scope.accountingPeriodId,
  };
  try {
    const body = await req.json();
    const rawLocalCustomers = body.customers || [];
    const pendingDeletes = body.pendingDeletes || [];
    // The legacy users payload is intentionally ignored.
    
    const sanitizedLocalCustomers =
      sanitizeMediaValue(rawLocalCustomers);

    const incomingLocalCustomers: SyncRecord[] =
      Array.isArray(sanitizedLocalCustomers)
        ? sanitizedLocalCustomers.filter(
            (item): item is SyncRecord =>
              Boolean(item) &&
              typeof item === "object" &&
              typeof (item as { id?: unknown }).id ===
                "string",
          )
        : [];

    const localCustomers: SyncRecord[] = [];
    const rejectedScopeCustomers: Array<{ id: string; reason: string }> = [];
    let migratedLegacyCustomerScopeCount = 0;

    const pilotLegacyMigrationCompanyId = String(
      process.env.ENVERP_PILOT_LEGACY_CUSTOMER_SCOPE_COMPANY_ID || "",
    ).trim();
    const allowPilotLegacyCustomerScopeMigration =
      process.env.ENVERP_PILOT_LEGACY_CUSTOMER_SCOPE_MIGRATION === "true" &&
      Boolean(pilotLegacyMigrationCompanyId) &&
      pilotLegacyMigrationCompanyId === erpContext.scope.companyId;

    for (const customer of incomingLocalCustomers) {
      const classification = classifyCustomerRootScope(
        customer,
        erpContext.scope,
      );

      if (classification === "CONFLICT") {
        rejectedScopeCustomers.push({
          id: customer.id,
          reason: "CUSTOMER_SCOPE_CONFLICT",
        });
        continue;
      }

      if (
        classification === "LEGACY_MISSING" &&
        !allowPilotLegacyCustomerScopeMigration
      ) {
        rejectedScopeCustomers.push({
          id: customer.id,
          reason: "CUSTOMER_SCOPE_LEGACY_UNPROVEN",
        });
        continue;
      }

      const normalizedCustomer =
        classification === "LEGACY_MISSING"
          ? migrateLegacyCustomerRootScope(customer, erpContext.scope)
          : customer;

      const scopeIssue = customerTreeScopeIssue(
        normalizedCustomer,
        erpContext.scope,
      );
      if (scopeIssue) {
        rejectedScopeCustomers.push({
          id: customer.id,
          reason: scopeIssue,
        });
        continue;
      }

      if (classification === "LEGACY_MISSING") {
        migratedLegacyCustomerScopeCount++;
      }
      localCustomers.push(normalizedCustomer);
    }

    if (rejectedScopeCustomers.length > 0) {
      console.warn("[Sync API POST] rejected customer scope records:", {
        count: rejectedScopeCustomers.length,
        rejectedScopeCustomers,
      });
    }
    
    let incomingRoomsCount = 0;
    let incomingOpeningsCount = 0;
    let incomingMeasurementsCount = 0;
    if (Array.isArray(localCustomers)) {
      localCustomers.forEach((c: SyncRecord) => {
        if (Array.isArray(c.rooms)) {
          incomingRoomsCount += c.rooms.length;
          c.rooms.forEach((r: SyncRecord) => {
            if (Array.isArray(r.windows)) {
              incomingOpeningsCount += r.windows.length;
              r.windows.forEach((w: SyncRecord) => {
                if (Array.isArray(w.products)) {
                  incomingMeasurementsCount += w.products.length;
                }
              });
            }
          });
        }
      });
    }

    console.log("[Sync API POST] incoming counts:", {
      customers: localCustomers?.length || 0,
      rooms: incomingRoomsCount,
      openings: incomingOpeningsCount,
      measurements: incomingMeasurementsCount
    });
    console.log("[Sync API POST - Step 4] incoming rooms count:", incomingRoomsCount);
    console.log("[Sync API POST - Step 4] incoming openings/windows count:", incomingOpeningsCount);
    console.log("[Sync API POST - Step 4] incoming measurements/products count:", incomingMeasurementsCount);

    // 1. Process deletions (Soft deleted customers are synced as isDeleted=true, not deleted via pendingDeletes)
    if (Array.isArray(pendingDeletes)) {
      for (const del of pendingDeletes) {
        const deleteScope = readErpScope(del);
        if (
          !deleteScope ||
          !erpScopeMatches(deleteScope, erpContext.scope)
        ) {
          return NextResponse.json(
            {
              success: false,
              error: "SYNC_DELETE_SCOPE_FORBIDDEN",
            },
            { status: 403 },
          );
        }

        if (del.table === "measurements") {
          return NextResponse.json(
            {
              success: false,
              error: "MEASUREMENT_PHYSICAL_DELETE_UNSUPPORTED",
            },
            { status: 409 },
          );
        }

        // Legacy hard delete remains limited to non-measurement child structures.
        if (["rooms", "openings"].includes(del.table)) {
          const { error } = await supabaseServer
            .from(del.table)
            .delete()
            .eq("id", del.id)
            .match(scopeColumns);
          if (error) {
            console.error(`[Sync Server Delete Error] Failed to delete from ${del.table} (id: ${del.id}):`, error.message);
          }
        }
      }
    }
    // 2. Pull all entities from Supabase with error checks
    const { data: remoteCustomers, error: errCustomers } = await supabaseServer.from("customers").select("*").match(scopeColumns);
    const { data: remoteRooms, error: errRooms } = await supabaseServer.from("rooms").select("*").match(scopeColumns);
    const { data: remoteOpenings, error: errOpenings } = await supabaseServer.from("openings").select("*").match(scopeColumns);
    const { data: remoteMeasurements, error: errMeasurements } = await supabaseServer.from("measurements").select("*").match(scopeColumns);
    const { data: remoteAddresses, error: errAddresses } = await supabaseServer.from("customer_addresses").select("*").match(scopeColumns);
    const {
      data: scopedUserRows,
      error: errUserScopes,
    } = await supabaseServer
      .from("erp_user_scopes")
      .select("user_id")
      .match(scopeColumns)
      .eq("is_active", true);

    const scopedUserIds = Array.from(
      new Set(
        (scopedUserRows || [])
          .map((row) => String(row.user_id || "").trim())
          .filter(Boolean),
      ),
    );

    const remoteUsersResult =
      scopedUserIds.length > 0
        ? await supabaseServer
            .from("users")
            .select("*")
            .in("id", scopedUserIds)
        : { data: [], error: null };

    const {
      data: remoteUsers,
      error: errUsers,
    } = remoteUsersResult;

    const fetchError =
      errCustomers ||
      errRooms ||
      errOpenings ||
      errMeasurements ||
      errAddresses ||
      errUserScopes ||
      errUsers;
    if (fetchError) {
      console.error("[Sync Server Fetch Error] Database fetch failed:", fetchError.message);
      return NextResponse.json(
        { success: false, error: "Veritabanı bağlantı hatası: " + fetchError.message },
        { status: 500 }
      );
    }

    console.log("[Sync API POST] fetched counts:", {
      customers: remoteCustomers?.length || 0,
      rooms: remoteRooms?.length || 0,
      openings: remoteOpenings?.length || 0,
      measurements: remoteMeasurements?.length || 0
    });
    console.log("[Sync API POST - Step 5] fetched rooms count:", remoteRooms?.length || 0);
    console.log("[Sync API POST - Step 5] fetched openings count:", remoteOpenings?.length || 0);
    console.log("[Sync API POST - Step 5] fetched measurements count:", remoteMeasurements?.length || 0);

    // 3. User accounts are managed only through dedicated admin APIs.
    // Full-data sync must never create users, change passwords, roles or account state.
    const finalUsers = remoteUsers || [];

    // Sanitize users list (exclude password field, include hasPassword) before sending to client
    const sanitizedUsers = finalUsers.map(({ password, ...u }) => ({ ...u, hasPassword: !!password }));

    // 4. Merge Customers, Rooms, Openings, Measurements
    // Map remote data for easy lookup
    const roomsByCustomer = new Map<string, SyncRecord[]>();
    remoteRooms?.forEach(r => {
      const arr = roomsByCustomer.get(r.customerId) || [];
      arr.push(r);
      roomsByCustomer.set(r.customerId, arr);
    });

    const addressesByCustomer = new Map<string, SyncRecord[]>();
    remoteAddresses?.forEach((rawAddress: SyncRecord) => {
      const customerId = String(rawAddress.customerId || "").trim();
      if (!customerId) {
        return;
      }

      const normalizedAddress: SyncRecord = {
        id: rawAddress.id,
        customerId,
        title: rawAddress.title || "",
        normalizedTitle: rawAddress.normalized_title || "",
        legacyPrimary: rawAddress.legacyPrimary || false,
        phone: rawAddress.phone || "",
        province: rawAddress.province || "",
        district: rawAddress.district || "",
        address: rawAddress.address || "",
        mapLocation: rawAddress.mapLocation || "",
        latitude: rawAddress.latitude ?? undefined,
        longitude: rawAddress.longitude ?? undefined,
        isDeleted: rawAddress.isDeleted || false,
        createdAt: rawAddress.createdAt,
        updatedAt: rawAddress.updatedAt,
      };

      const arr = addressesByCustomer.get(customerId) || [];
      arr.push(normalizedAddress);
      addressesByCustomer.set(customerId, arr);
    });
    const openingsByRoom = new Map<string, SyncRecord[]>();
    remoteOpenings?.forEach(o => {
      const arr = openingsByRoom.get(o.roomId) || [];
      arr.push(o);
      openingsByRoom.set(o.roomId, arr);
    });

    const measurementsByOpening = new Map<string, SyncRecord[]>();
    remoteMeasurements?.forEach(m => {
      const arr = measurementsByOpening.get(m.openingId) || [];
      arr.push(m);
      measurementsByOpening.set(m.openingId, arr);
    });

    const mergedCustomersMap = new Map<string, SyncRecord>();
    if (Array.isArray(localCustomers)) {
      localCustomers.forEach((c: SyncRecord) => {
        mergedCustomersMap.set(c.id, { ...c });
      });
    }

    remoteCustomers?.forEach((remote: SyncRecord) => {
      const remoteCanonical = remote as SyncRecord & {
        location?: string | null;
        createdBy?: string | null;
        status?: string | null;
        assignedTo?: string | null;
      };
      const local = mergedCustomersMap.get(remote.id);
      if (!local) {
        mergedCustomersMap.set(remote.id, {
          id: remote.id,
          name: remote.name,
          phone: remote.phone || "",
          address: remote.address || "",
          mapLocation: remoteCanonical.location || remote.mapLocation || "",
          notes: remote.notes || "",
          createdById: remoteCanonical.createdBy || remote.createdById || "",
          createdByName: remote.createdByName || "",
          assignedSalesId: remote.assignedSalesId || "",
          assignedSalesName: remote.assignedSalesName || "",
          assignedMeasureId: remote.assignedMeasureId || "",
          assignedMeasureName: remote.assignedMeasureName || "",
          assignedTailorId: remote.assignedTailorId || "",
          assignedTailorName: remote.assignedTailorName || "",
          assignedInstallerId: remote.assignedInstallerId || "",
          assignedInstallerName: remote.assignedInstallerName || "",
          workflowStatus: remoteCanonical.status || remote.workflowStatus || "YENI",
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

        if (new Date(remote.updatedAt ?? 0) > new Date(local.updatedAt || 0)) {
          mergedCustomersMap.set(remote.id, {
            ...local,
            name: remote.name,
            phone: remote.phone || "",
            address: remote.address || "",
            mapLocation: remoteCanonical.location || remote.mapLocation || local.mapLocation || "",
            notes: remote.notes || "",
            createdById: remoteCanonical.createdBy || remote.createdById || local.createdById || "",
            createdByName: remote.createdByName || local.createdByName || "",
            assignedSalesId: remote.assignedSalesId || local.assignedSalesId || "",
            assignedSalesName: remote.assignedSalesName || local.assignedSalesName || "",
            assignedMeasureId: remote.assignedMeasureId || local.assignedMeasureId || "",
            assignedMeasureName: remote.assignedMeasureName || local.assignedMeasureName || "",
            assignedTailorId: remote.assignedTailorId || local.assignedTailorId || "",
            assignedTailorName: remote.assignedTailorName || local.assignedTailorName || "",
            assignedInstallerId: remote.assignedInstallerId || local.assignedInstallerId || "",
            assignedInstallerName: remote.assignedInstallerName || local.assignedInstallerName || "",
            workflowStatus: remoteCanonical.status || remote.workflowStatus || local.workflowStatus || "YENI",
            customerCode: remote.customerCode || local.customerCode || "",
            taxNumber: remote.taxNumber || local.taxNumber || "",
            phone2: remote.phone2 || local.phone2 || "",
            extraDescription: remote.extraDescription || local.extraDescription || "",
            generalNote: remote.generalNote || local.generalNote || "",
            cariType: remote.cariType || local.cariType || "CUSTOMER",
            approvalStatus: remote.approvalStatus || local.approvalStatus || "APPROVED",
            isDeleted: remote.isDeleted || false,
            deletedAt: remote.deletedAt || local.deletedAt || null,
            createdAt: remote.createdAt,
            updatedAt: remote.updatedAt
          });
        }
      }
    });

    for (const customer of mergedCustomersMap.values()) {
      const localAddresses = Array.isArray(customer.addresses)
        ? (customer.addresses as SyncRecord[])
        : [];
      const remoteScopedAddresses = addressesByCustomer.get(customer.id) || [];
      const mergedAddresses = new Map<string, SyncRecord>();

      localAddresses.forEach((address) => {
        if (address && typeof address.id === "string" && address.id) {
          mergedAddresses.set(address.id, address);
        }
      });

      remoteScopedAddresses.forEach((remoteAddress) => {
        const localAddress = mergedAddresses.get(remoteAddress.id);
        if (
          !localAddress ||
          new Date(remoteAddress.updatedAt || 0) >
            new Date(localAddress.updatedAt || 0)
        ) {
          mergedAddresses.set(remoteAddress.id, remoteAddress);
        }
      });

      customer.addresses = Array.from(mergedAddresses.values());
    }
    const finalCustomers = Array.from(mergedCustomersMap.values()).map(
      (customer) => stampCustomerTreeScope(customer, erpContext.scope),
    );

    for (const c of finalCustomers) {
      const localRooms = c.rooms || [];
      const dbRooms = roomsByCustomer.get(c.id) || [];

      const mergedRoomsMap = new Map<string, SyncRecord>();
      localRooms.forEach((lr: SyncRecord) => mergedRoomsMap.set(lr.id, lr));

      dbRooms.forEach((dr: SyncRecord) => {
        const lr = mergedRoomsMap.get(dr.id);
        if (!lr) {
          mergedRoomsMap.set(dr.id, {
            id: dr.id,
            name: dr.name,
            photos: dr.photos || [],
            videos: dr.videos || [],
            customerAddressId: dr.customerAddressId || undefined,
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

          if (new Date(dr.updatedAt ?? 0) > new Date(lr.updatedAt || 0)) {
            mergedRoomsMap.set(dr.id, {
              ...lr,
              name: dr.name,
              customerAddressId: dr.customerAddressId || undefined,
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

        const mergedOpeningsMap = new Map<string, SyncRecord>();
        localOpenings.forEach((lo: SyncRecord) => mergedOpeningsMap.set(lo.id, lo));

        dbOpenings.forEach((do_: SyncRecord) => {
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

            if (new Date(do_.updatedAt ?? 0) > new Date(lo.updatedAt || 0)) {
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

          const mergedMeasurementsMap = new Map<string, SyncRecord>();
          localMeasurements.forEach((lm: SyncRecord) => mergedMeasurementsMap.set(lm.id, lm));

          dbMeasurements.forEach((dm: SyncRecord) => {
            const lm = mergedMeasurementsMap.get(dm.id);
            const normalizedMeasuredDate = dm.measuredDate ? new Date(dm.measuredDate).toISOString() : new Date().toISOString();
            const normalizedEntityVersion = Number(dm.entity_version);
            const canonicalVersion =
              Number.isInteger(normalizedEntityVersion) &&
              normalizedEntityVersion > 0
                ? normalizedEntityVersion
                : undefined;

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
                ...(canonicalVersion ? { version: canonicalVersion } : {}),
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

              if (new Date(dm.updatedAt ?? 0) > new Date(lm.updatedAt || 0)) {
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
                ...(canonicalVersion ? { version: canonicalVersion } : {}),
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
    let customersUpsertedCount = 0;
    let roomsUpsertedCount = 0;
    let addressesPersistedCount = 0;
    let openingsUpsertedCount = 0;
    const measurementsUpsertedCount = 0;

    for (const c of finalCustomers) {
      // Customer
      const dbCustomer = remoteCustomers?.find(dc => dc.id === c.id);
      if (!dbCustomer || new Date(c.updatedAt || 0) > new Date(dbCustomer.updatedAt)) {
        const dbCustomerCanonical = dbCustomer as
          | (SyncRecord & {
              location?: string | null;
              createdBy?: string | null;
              status?: string | null;
              assignedTo?: string | null;
            })
          | undefined;

        const { error } = await supabaseServer.from("customers").upsert({
          ...scopeColumns,
          id: c.id,
          name: c.name,
          phone: c.phone || null,
          address: c.address || null,
          location: c.mapLocation || dbCustomerCanonical?.location || null,
          notes: c.notes || dbCustomer?.notes || null,
          createdBy: c.createdById || dbCustomerCanonical?.createdBy || null,
          status: c.workflowStatus || dbCustomerCanonical?.status || "YENI",

          // FUTURE-ME:
          // Local domain owns independent SALES/MEASURE/TAILOR/INSTALLER
          // assignments. Remote canonical schema exposes only one assignedTo.
          // Never collapse four role assignments into one lossy value.
          assignedTo: dbCustomerCanonical?.assignedTo || null,

          isDeleted: c.isDeleted || false,
          createdAt: c.createdAt || dbCustomer?.createdAt,
          updatedAt: c.updatedAt || dbCustomer?.updatedAt
        });
        if (error) {
          console.error(`[Sync DB Error] Customer upsert failed for ${c.name} (${c.id}):`, error);
          throw new Error(`Customer upsert failed: ${error.message}`);
        }
        customersUpsertedCount++;
      }

      // Customer addresses: canonical RPC only; never raw customer_addresses mutation.
      for (const a of c.addresses ?? []) {
        const dbAddress = remoteAddresses?.find(
          (remoteAddress) => remoteAddress.id === a.id,
        );

        const localUpdatedAt = new Date(a.updatedAt || 0).getTime();
        const remoteUpdatedAt = new Date(dbAddress?.updatedAt || 0).getTime();

        if (dbAddress && localUpdatedAt <= remoteUpdatedAt) {
          continue;
        }

        let operation: "INSERT" | "UPDATE" | "SOFT_DELETE";
        if (a.isDeleted) {
          if (!dbAddress || dbAddress.isDeleted) {
            continue;
          }
          operation = "SOFT_DELETE";
        } else {
          operation = dbAddress ? "UPDATE" : "INSERT";
        }

        const addressExpectedVersion = dbAddress
          ? Number(dbAddress.entity_version ?? dbAddress.entityVersion)
          : 0;

        if (
          dbAddress &&
          (!Number.isInteger(addressExpectedVersion) ||
            addressExpectedVersion <= 0)
        ) {
          throw new Error("CUSTOMER_ADDRESS_EXPECTED_VERSION_MISSING");
        }

        const addressChangeId = [
          "customer-address",
          operation,
          a.id,
          String(a.updatedAt || a.createdAt || ""),
        ].join(":");

        const { error: addressError } = await supabaseServer.rpc(
          "persist_customer_address_authority_v1",
          {
            p_operation: operation,
            p_address: {
              id: a.id,
              customerId: c.id,
              title: a.title || null,
              phone: a.phone || null,
              province: a.province || null,
              district: a.district || null,
              address: a.address || "",
              mapLocation: a.mapLocation || null,
              latitude: a.latitude ?? null,
              longitude: a.longitude ?? null,
              legacyPrimary: a.legacyPrimary || false,
              createdAt: a.createdAt || null,
            },
            p_context: {
              tenantId: erpContext.scope.tenantId,
              companyId: erpContext.scope.companyId,
              branchId: erpContext.scope.branchId,
              accountingPeriodId: erpContext.scope.accountingPeriodId,
              changeId: addressChangeId,
              expectedVersion: addressExpectedVersion,
              actorUserId: user.id,
            },
          },
        );

        if (addressError) {
          console.error(
            `[Sync DB Error] Customer address authority failed for ${c.id}/${a.id}:`,
            addressError,
          );
          throw new Error(
            `Customer address authority failed: ${addressError.message}`,
          );
        }

        addressesPersistedCount++;
      }
      // Rooms
      for (const r of c.rooms ?? []) {
        const dbRoom = remoteRooms?.find(dr => dr.id === r.id);
        if (!dbRoom || new Date(r.updatedAt || 0) > new Date(dbRoom.updatedAt)) {
          const { error } = await supabaseServer.from("rooms").upsert({
            ...scopeColumns,
            id: r.id,
            name: r.name,
            customerId: c.id,
            customerAddressId:
              r.customerAddressId ||
              dbRoom?.customerAddressId ||
              null,
            photos: (r.photos && r.photos.length > 0) ? r.photos : (dbRoom?.photos || []),
            videos: (r.videos && r.videos.length > 0) ? r.videos : (dbRoom?.videos || []),
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
          });
          if (error) {
            console.error(`[Sync DB Error] Room upsert failed for ${r.name} (${r.id}):`, error);
            throw new Error(`Room upsert failed: ${error.message}`);
          }
          roomsUpsertedCount++;
        }

        // Openings
        for (const o of r.windows ?? []) {
          const dbOpening = remoteOpenings?.find(do_ => do_.id === o.id);
          if (!dbOpening || new Date(o.updatedAt || 0) > new Date(dbOpening.updatedAt)) {
            const { error } = await supabaseServer.from("openings").upsert({
              ...scopeColumns,
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
            openingsUpsertedCount++;
          }

          // Measurements are read/merged here for legacy response compatibility only.
          // Canonical measurement writes are owned exclusively by
          // persist_measurement_authority_v1 through delta-sync/push.
          // A second timestamp-based writer here would reintroduce dual authority.
        }
      }
    }
    console.log("[Sync API POST] upserted counts:", {
      customers: customersUpsertedCount,
      rooms: roomsUpsertedCount,
      addresses: addressesPersistedCount,
      openings: openingsUpsertedCount,
      measurements: measurementsUpsertedCount
    });
    console.log("[Sync API POST - Step 4] upserted rooms count:", roomsUpsertedCount);
    console.log("[Sync API POST - Step 4] upserted openings count:", openingsUpsertedCount);
    console.log("[Sync API POST - Step 4] upserted measurements count:", measurementsUpsertedCount);

    let responseRoomsCount = 0;
    let responseOpeningsCount = 0;
    let responseMeasurementsCount = 0;
    finalCustomers.forEach((c: SyncRecord) => {
      if (Array.isArray(c.rooms)) {
        responseRoomsCount += c.rooms.length;
        c.rooms.forEach((r: SyncRecord) => {
          if (Array.isArray(r.windows)) {
            responseOpeningsCount += r.windows.length;
            r.windows.forEach((w: SyncRecord) => {
              if (Array.isArray(w.products)) {
                responseMeasurementsCount += w.products.length;
              }
            });
          }
        });
      }
    });

    console.log("[Sync API POST] response counts:", {
      customers: finalCustomers.length,
      rooms: responseRoomsCount,
      openings: responseOpeningsCount,
      measurements: responseMeasurementsCount
    });
    console.log("[Sync API POST - Step 5] response customers rooms count:", responseRoomsCount);
    console.log("[Sync API POST - Step 5] response customers openings/windows count:", responseOpeningsCount);
    console.log("[Sync API POST - Step 5] response customers measurements/products count:", responseMeasurementsCount);
    console.log("[Sync API POST - Step 5] response customers has nested rooms/windows/products:", (responseRoomsCount > 0 && responseOpeningsCount > 0 && responseMeasurementsCount > 0));

    console.log("[Server Sync Diagnostic] final response status and reason:", 200, "Success");
    return NextResponse.json({
      success: true,
      customerScopeMigration: {
        received: incomingLocalCustomers.length,
        accepted: localCustomers.length,
        migrated: migratedLegacyCustomerScopeCount,
        rejected: rejectedScopeCustomers.length,
        rejectedCustomers: rejectedScopeCustomers,
      },
      customers: sanitizeMediaValue(
        finalCustomers.map((c: SyncRecord) => ({
          ...c,
          rooms: [],
        })),
      ),
      users: sanitizedUsers,
      metrics: {
        incoming: {
          customers: localCustomers?.length || 0,
          rooms: incomingRoomsCount,
          openings: incomingOpeningsCount,
          measurements: incomingMeasurementsCount
        },
        fetched: {
          customers: remoteCustomers?.length || 0,
          rooms: remoteRooms?.length || 0,
          openings: remoteOpenings?.length || 0,
          measurements: remoteMeasurements?.length || 0
        },
        upserted: {
          customers: customersUpsertedCount,
          rooms: roomsUpsertedCount,
          openings: openingsUpsertedCount,
          measurements: measurementsUpsertedCount
        },
        response: {
          customers: finalCustomers.length,
          rooms: responseRoomsCount,
          openings: responseOpeningsCount,
          measurements: responseMeasurementsCount
        }
      }
    });

  } catch (error: unknown) {
    console.error("[Sync Customers API] Internal error.", error);

    const message =
      error instanceof Error ? error.message : "";

    let publicError = "SYNC_CUSTOMERS_INTERNAL_ERROR";

    if (message === "CUSTOMER_ADDRESS_EXPECTED_VERSION_MISSING") {
      publicError = "CUSTOMER_ADDRESS_EXPECTED_VERSION_MISSING";
    } else if (message.startsWith("Customer upsert failed:")) {
      publicError = "SYNC_CUSTOMER_UPSERT_FAILED";
    } else if (
      message.startsWith("Customer address authority failed:")
    ) {
      publicError = "SYNC_CUSTOMER_ADDRESS_AUTHORITY_FAILED";
    } else if (message.startsWith("Room upsert failed:")) {
      publicError = "SYNC_ROOM_UPSERT_FAILED";
    } else if (message.startsWith("Opening upsert failed:")) {
      publicError = "SYNC_OPENING_UPSERT_FAILED";
    }

    return NextResponse.json(
      { success: false, error: publicError },
      { status: 500 }
    );
  }
}
