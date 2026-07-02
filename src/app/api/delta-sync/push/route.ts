import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPassword } from "@/lib/authHelper";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const ALLOWED_ENTITY_TYPES = ['DRAFT', 'CUSTOMER', 'ROOM', 'OPENING', 'MEASUREMENT'];
const ALLOWED_OPERATIONS = ['INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE'];

// Recursive function to deep clean any media or huge fields from the payload
function deepSanitizeMedia(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    // Strip large strings or data URIs
    if (obj.startsWith('data:image') || obj.startsWith('data:video') || obj.includes(';base64,') || obj.length > 10000) {
      return '[REDACTED_MEDIA]';
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitizeMedia(item));
  }
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      if (['photos', 'videos', 'addressPhotos'].includes(key)) {
        // Drop the array/value entirely
        continue;
      }
      res[key] = deepSanitizeMedia(obj[key]);
    }
    return res;
  }
  return obj;
}

async function verifyAuth(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { user: null, reason: "Missing or invalid Authorization header" };
  }

  try {
    const token = authHeader.substring(7);
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [username, credential] = decoded.split(":");

    if (!username || !credential) {
      return { user: null, reason: "Invalid token payload" };
    }

    const { data: user, error } = await supabaseServer
      .from("users")
      .select("*")
      .eq("username", username.toLowerCase().trim())
      .single();

    if (error || !user || !user.isActive) {
      return { user: null, reason: "User not found or inactive" };
    }

    const isHashed = credential.length === 128;
    const hashedPassword = isHashed ? credential : hashPassword(credential);

    if (user.password !== hashedPassword) {
      return { user: null, reason: "Invalid credentials" };
    }

    return { user, reason: null };
  } catch (e: any) {
    return { user: null, reason: "Token parsing error" };
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth Check
    const { user, reason } = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized", details: reason }, { status: 401 });
    }

    // 2. Parse Body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const { events } = body;

    // 3. Payload Limits & Basic Validation
    if (!events || !Array.isArray(events)) {
      return NextResponse.json({ success: false, error: "Invalid payload: events must be an array" }, { status: 400 });
    }

    if (events.length > 50) {
      return NextResponse.json({ success: false, error: "Payload too large: maximum 50 events allowed" }, { status: 400 });
    }

    const measurementChanges: any[] = [];
    const draftChanges: any[] = [];
    const rejectedIds: string[] = [];
    const errors: string[] = [];

    for (const event of events) {
      // 4. Strict Validation per event
      if (!event.changeId || typeof event.changeId !== 'string' || event.changeId.length > 100) {
        errors.push(`Invalid or missing changeId`);
        continue; // Unrecoverable without ID
      }
      if (!ALLOWED_ENTITY_TYPES.includes(event.entityType)) {
        rejectedIds.push(event.changeId);
        errors.push(`Invalid entityType: ${event.entityType} for event ${event.changeId}`);
        continue;
      }
      if (!ALLOWED_OPERATIONS.includes(event.operation)) {
        rejectedIds.push(event.changeId);
        errors.push(`Invalid operation: ${event.operation} for event ${event.changeId}`);
        continue;
      }

      // 5. Deep Media Sanitization
      const cleanPatch = deepSanitizeMedia(event.patch);

      const isDraft = event.entityType === 'DRAFT';
      
      const payload = {
        change_id: event.changeId,
        operation: event.operation,
        patch: cleanPatch,
        device_id: event.deviceId ? String(event.deviceId).substring(0, 100) : 'unknown',
        user_id: user.id, // Force server-side verified user
        created_at: event.createdAt || new Date().toISOString()
      };

      if (isDraft) {
        draftChanges.push({
          ...payload,
          draft_id: event.entityId
        });
      } else {
        measurementChanges.push({
          ...payload,
          entity_type: event.entityType,
          entity_id: event.entityId
        });
      }
    }

    const syncedIds: string[] = [];
    const errorIds: string[] = [...rejectedIds];

    // Push Measurement Changes
    if (measurementChanges.length > 0) {
      const { error } = await supabaseServer
        .from('measurement_changes')
        .upsert(measurementChanges, { onConflict: 'change_id' });

      if (error) {
        errors.push(`Failed to push measurement_changes: ${error.message}`);
        errorIds.push(...measurementChanges.map(c => c.change_id));
      } else {
        syncedIds.push(...measurementChanges.map(c => c.change_id));
      }
    }

    // Push Draft Changes
    if (draftChanges.length > 0) {
      const { error } = await supabaseServer
        .from('draft_changes')
        .upsert(draftChanges, { onConflict: 'change_id' });

      if (error) {
        errors.push(`Failed to push draft_changes: ${error.message}`);
        errorIds.push(...draftChanges.map(c => c.change_id));
      } else {
        syncedIds.push(...draftChanges.map(c => c.change_id));
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      syncedIds,
      errorIds,
      errors
    });

  } catch (error: any) {
    console.error("[DeltaSync API] Internal Error"); // Sanitized log, no payload dumping
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
