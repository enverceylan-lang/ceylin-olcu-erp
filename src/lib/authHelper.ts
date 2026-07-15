import { NextRequest } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Safe, native SHA-512 pbkdf2 password hashing (no external binary dependencies)
export function hashPassword(password: string): string {
  const cleanPassword = (password || "").trim();
  const salt = process.env.HASH_SALT || process.env.SESSION_SECRET || "olcu-erp-salt-1293";
  return crypto.pbkdf2Sync(cleanPassword, salt, 1000, 64, "sha512").toString("hex");
}

// Extract credentials from Authorization header and authenticate requests
export async function verifyAuth(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7); // Strip 'Bearer '
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [username, credential] = decoded.split(":");

    if (!username || !credential) {
      return null;
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return null;
    }

    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: user, error } = await supabaseServer
      .from("users")
      .select("*")
      .eq("username", username.toLowerCase().trim())
      .single();

    if (error || !user || !user.isActive) {
      return null;
    }

    if (!user.password || user.password.trim() === "") {
      return null;
    }

    const defaultHashes = [
      "737cca8746ba4b84c7898f055c9f5c251016bd006f32ddf4be6fc2adde15fe72fa6167ed96001110725115f7308da9763712a5fa0924faf3329f301fc6e20382",
      hashPassword("123")
    ];

    const isDefaultAdminCredentials =
      (user.username === "admin" || user.id === "user-admin") &&
      (credential === "123" || defaultHashes.includes(user.password));

    if (isDefaultAdminCredentials) {
      return null;
    }

    const isHashed = credential.length === 128;
    const hashedPassword = isHashed ? credential : hashPassword(credential);

    if (user.password !== hashedPassword) {
      return null;
    }

    return user;
  } catch (error) {
    console.error("Auth verification failed:", error);
    return null;
  }
}

