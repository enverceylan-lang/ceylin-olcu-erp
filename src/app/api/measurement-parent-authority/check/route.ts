import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/authHelper';
import { loadShadowErpContext } from '@/lib/serverErpContext';
import { readRequestedErpScopeId } from '@/lib/erpActiveScopeCookie';

/** Read-only and fail-closed. Not an authorization token for queue activation. */
export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ verified: false }, { status: 401 });
  if (!new Set(['ADMIN','MODERATOR','OFFICE','SALES','FIELD','MEASUREMENT'])
    .has(String(user.role).toUpperCase())) {
    return NextResponse.json({ verified: false }, { status: 403 });
  }
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ verified: false }, { status: 400 });
  }
  const record = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown> : null;
  const validId = (v: unknown) => typeof v === 'string' && v.length > 0 &&
    v.length <= 200 && v.trim() === v;
  const customerId = record?.customerId;
  const roomId = record?.roomId;
  const openingId = record?.openingId;
  if (!validId(customerId) || !validId(roomId) ||
      (openingId !== undefined && openingId !== null && openingId !== '' && !validId(openingId))) {
    return NextResponse.json({ verified: false }, { status: 400 });
  }
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ verified: false }, { status: 503 });
  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const context = await loadShadowErpContext(db, user.id,
      { requestedScopeId: readRequestedErpScopeId(req) });
    if (!context.ready) return NextResponse.json({ verified: false }, { status: 409 });
    const scope = {
      tenant_id: context.scope.tenantId,
      company_id: context.scope.companyId,
      branch_id: context.scope.branchId,
      accounting_period_id: context.scope.accountingPeriodId,
    };
    const customer = await db.from('customers').select('id,"isDeleted"')
      .match({ ...scope, id: customerId }).maybeSingle();
    if (customer.error || !customer.data || customer.data.isDeleted !== false) {
      return NextResponse.json({ verified: false });
    }
    const room = await db.from('rooms').select('id,name,"customerId","customerAddressId","createdAt","updatedAt"')
      .match({ ...scope, id: roomId, customerId }).eq('isDeleted', false).maybeSingle();
    if (room.error || !room.data || typeof room.data.name !== 'string' || !room.data.name.trim()) {
      return NextResponse.json({ verified: false });
    }
    let canonicalOpening: Record<string, unknown> | null = null;
    if (typeof openingId === 'string' && openingId) {
      const opening = await db.from('openings').select('id,name,"roomId",width,height,"fieldNotes","createdAt","updatedAt"')
        .match({ ...scope, id: openingId, roomId }).eq('isDeleted', false).maybeSingle();
      if (opening.error || !opening.data || typeof opening.data.name !== 'string' || !opening.data.name.trim()) {
        return NextResponse.json({ verified: false });
      }
      canonicalOpening = opening.data as Record<string, unknown>;
    }
    // Does not mint durable serverVerified proof: rows can change after this read.
    return NextResponse.json({ verified: true, scope: context.scope,
      customerId, roomId, openingId: openingId || null,
      // Existing server-side rows only. No creation, no authority token.
      parentPackage: {
        room: { id: room.data.id, name: room.data.name,
          customerAddressId: room.data.customerAddressId || null,
          createdAt: room.data.createdAt || null, updatedAt: room.data.updatedAt || null },
        ...(canonicalOpening ? { opening: { id: canonicalOpening.id,
          name: canonicalOpening.name, width: canonicalOpening.width ?? null,
          height: canonicalOpening.height ?? null,
          fieldNotes: canonicalOpening.fieldNotes || '',
          createdAt: canonicalOpening.createdAt || null,
          updatedAt: canonicalOpening.updatedAt || null } } : {}),
      } });
  } catch {
    return NextResponse.json({ verified: false }, { status: 503 });
  }
}
