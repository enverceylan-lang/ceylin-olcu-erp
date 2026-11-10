import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/authHelper";
import { loadShadowErpContext } from "@/lib/serverErpContext";
import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";

// P0: Explicit, read-only recovery; NEVER part of the periodic delta loop.
// Service-role reads are strictly bounded to the verified four-part ERP scope.
const ALLOWED_ROLES = new Set(["ADMIN", "OFFICE"]);
const PAGE_SIZE = 100;

type CanonicalRow = {
  id: string;
  customerId: string;
  roomId: string;
  openingId?: string | null;
  isDeleted?: boolean | null;
  [key: string]: unknown;
};

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.has(String(user.role).toUpperCase())) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ success: false, error: "Server configuration error" }, { status: 500 });

  try {
    const body = await req.json();
    const offset = body?.offset;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000 || offset % PAGE_SIZE !== 0) {
      return NextResponse.json({ success: false, error: "RECOVERY_OFFSET_INVALID" }, { status: 400 });
    }

    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const ctx = await loadShadowErpContext(db, user.id, { requestedScopeId: readRequestedErpScopeId(req) });
    if (!ctx.ready) return NextResponse.json({ success: false, error: "ERP_SCOPE_NOT_READY" }, { status: 409 });

    const scope = {
      tenant_id: ctx.scope.tenantId,
      company_id: ctx.scope.companyId,
      branch_id: ctx.scope.branchId,
      accounting_period_id: ctx.scope.accountingPeriodId,
    };
    const { data, error } = await db.from("measurements")
      .select("*")
      .match(scope)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) return NextResponse.json({ success: false, error: "RECOVERY_MEASUREMENTS_READ_FAILED" }, { status: 503 });

    const rows = (data || []) as CanonicalRow[];
    const active = rows.filter((row) => row.isDeleted !== true);
    const customerIds = [...new Set(active.map((row) => row.customerId).filter(Boolean))];
    const roomIds = [...new Set(active.map((row) => row.roomId).filter(Boolean))];

    const customersResult = customerIds.length
      ? await db.from("customers").select('id,isDeleted').match(scope).in("id", customerIds)
      : { data: [], error: null };
    const roomsResult = roomIds.length
      ? await db.from("rooms").select('id,customerId,name,customerAddressId,isDeleted').match(scope).in("id", roomIds)
      : { data: [], error: null };
    const openingIds = [...new Set(active.map((row) => String(row.openingId || "").trim()).filter(Boolean))];
    const openingsResult = openingIds.length
      ? await db.from("openings").select('id,roomId,name,isDeleted').match(scope).in("id", openingIds)
      : { data: [], error: null };
    if (customersResult.error || roomsResult.error || openingsResult.error) {
      return NextResponse.json({ success: false, error: "RECOVERY_PARENTS_READ_FAILED" }, { status: 503 });
    }

    const liveCustomers = new Set((customersResult.data || [])
      .filter((c) => c.isDeleted !== true).map((c) => c.id));
    const rooms = new Map((roomsResult.data || [])
      .filter((r) => r.isDeleted !== true).map((r) => [r.id, r]));
    const openings = new Map((openingsResult.data || [])
      .filter((o) => o.isDeleted !== true).map((o) => [o.id, o]));
    // A room/opening is returned ONLY after its canonical ownership is verified.
    // Names are authoritative server labels, never invented on the client.
    const verified = active.flatMap((row) => {
      const room = rooms.get(row.roomId);
      if (!liveCustomers.has(row.customerId) || !room || room.customerId !== row.customerId ||
          !String(room.name || "").trim()) return [];
      const openingId = String(row.openingId || "").trim();
      const opening = openingId ? openings.get(openingId) : null;
      if (openingId && (!opening || opening.roomId !== room.id || !String(opening.name || "").trim())) return [];
      return [{
        ...row,
        recoveryParent: {
          room: { id: room.id, name: room.name, customerAddressId: room.customerAddressId || null },
          ...(opening ? { opening: { id: opening.id, name: opening.name } } : {}),
        },
      }];
    });

    // Do not return other-scope or orphan records. No writes, no cursor mutation.
    return NextResponse.json({
      success: true,
      measurements: verified,
      sourceCount: rows.length,
      excludedCount: active.length - verified.length,
      hasMore: rows.length === PAGE_SIZE,
      nextOffset: offset + rows.length,
    });
  } catch {
    return NextResponse.json({ success: false, error: "RECOVERY_READ_FAILED" }, { status: 500 });
  }
}
