import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "./prisma";

// Safe, native SHA-512 pbkdf2 password hashing (no external binary dependencies)
export function hashPassword(password: string): string {
  const cleanPassword = (password || "").trim();
  const salt = process.env.SESSION_SECRET || "olcu-erp-salt-1293";
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
    const [username, hashedPassword] = decoded.split(":");

    if (!username || !hashedPassword) {
      return null;
    }

    // Since we shouldn't touch database during local compile checks,
    // if prisma is not yet fully configured or is null, return null safely.
    if (!prisma) return null;

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase().trim() },
    });

    if (!user || !user.isActive || user.password !== hashedPassword) {
      return null;
    }

    return user;
  } catch (error) {
    console.error("Auth verification failed:", error);
    return null;
  }
}
