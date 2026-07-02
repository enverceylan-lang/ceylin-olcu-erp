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

function deepSanitizeMedia(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
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
    const { user, reason } = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized", details: reason }, { status: 401 });
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: "Forbidden", details: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { draftCursor = 0, measurementCursor = 0 } = body;

    const { data: draftChanges, error: draftError } = await supabaseServer
      .from('draft_changes')
      .select('*')
      .gt('revision', draftCursor)
      .order('revision', { ascending: true })
      .limit(100);

    if (draftError) {
      return NextResponse.json({ success: false, error: "Database error (draft)", details: draftError.message }, { status: 500 });
    }

    const { data: measurementChanges, error: measurementError } = await supabaseServer
      .from('measurement_changes')
      .select('*')
      .gt('revision', measurementCursor)
      .order('revision', { ascending: true })
      .limit(100);

    if (measurementError) {
      return NextResponse.json({ success: false, error: "Database error (measurement)", details: measurementError.message }, { status: 500 });
    }

    const sanitizedDrafts = (draftChanges || []).map(change => ({
      ...change,
      sourceTable: 'draft_changes',
      patch: deepSanitizeMedia(change.patch)
    }));

    const sanitizedMeasurements = (measurementChanges || []).map(change => ({
      ...change,
      sourceTable: 'measurement_changes',
      patch: deepSanitizeMedia(change.patch)
    }));

    const allChanges = [...sanitizedDrafts, ...sanitizedMeasurements];

    return NextResponse.json({
      success: true,
      changes: allChanges,
      fetchedCount: allChanges.length
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error", details: err.message }, { status: 500 });
  }
}
