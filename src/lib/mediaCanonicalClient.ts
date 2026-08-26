import { createClient } from "@supabase/supabase-js";

export type CanonicalPhotoTargetType =
  | "CUSTOMER"
  | "ROOM"
  | "OPENING"
  | "MEASUREMENT";

export type CanonicalPhotoPurpose =
  | "ADDRESS_PHOTO"
  | "ROOM_PHOTO"
  | "OPENING_PHOTO"
  | "MEASUREMENT_PHOTO";

export type CanonicalMediaItem = {
  linkId: string;
  assetId: string;
  purpose: string;
  mimeType: string;
  byteSize: number;
  widthPx: number | null;
  heightPx: number | null;
  createdAt: string;
  signedUrl: string;
};

const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const MAX_DIMENSION = 2048;
const SUPPORTED_INPUT_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function browserStorageClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase tarayÄ±cÄ± Storage ayarÄ± eksik.",
    );
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function loadBitmap(
  file: File,
): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error(
      "FotoÄŸraf tarayÄ±cÄ± tarafÄ±ndan aÃ§Ä±lamadÄ±. JPEG, PNG veya WebP kullanÄ±n.",
    );
  }
}

async function canvasToWebp(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return await new Promise<Blob>(
    (resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (!blob) {
            reject(
              new Error(
                "FotoÄŸraf WebP olarak sÄ±kÄ±ÅŸtÄ±rÄ±lamadÄ±.",
              ),
            );
            return;
          }
          resolve(blob);
        },
        "image/webp",
        quality,
      );
    },
  );
}

export async function compressPhotoForCanonicalUpload(
  file: File,
): Promise<{
  blob: Blob;
  width: number;
  height: number;
  checksumSha256: string;
}> {
  if (
    !SUPPORTED_INPUT_MIME.has(file.type)
  ) {
    throw new Error(
      "Bu fotoÄŸraf tÃ¼rÃ¼ desteklenmiyor. JPEG, PNG veya WebP kullanÄ±n.",
    );
  }

  if (
    file.size < 1 ||
    file.size > MAX_INPUT_BYTES
  ) {
    throw new Error(
      "FotoÄŸraf dosyasÄ± 25 MB sÄ±nÄ±rÄ±nÄ± aÅŸÄ±yor.",
    );
  }

  const bitmap = await loadBitmap(file);
  try {
    const scale = Math.min(
      1,
      MAX_DIMENSION / bitmap.width,
      MAX_DIMENSION / bitmap.height,
    );

    const width = Math.max(
      1,
      Math.round(bitmap.width * scale),
    );
    const height = Math.max(
      1,
      Math.round(bitmap.height * scale),
    );

    const canvas =
      document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error(
        "FotoÄŸraf sÄ±kÄ±ÅŸtÄ±rma motoru aÃ§Ä±lamadÄ±.",
      );
    }

    context.drawImage(
      bitmap,
      0,
      0,
      width,
      height,
    );

    let quality = 0.84;
    let blob = await canvasToWebp(
      canvas,
      quality,
    );

    while (
      blob.size > MAX_OUTPUT_BYTES &&
      quality > 0.5
    ) {
      quality -= 0.08;
      blob = await canvasToWebp(
        canvas,
        quality,
      );
    }

    if (
      blob.size < 1 ||
      blob.size > MAX_OUTPUT_BYTES
    ) {
      throw new Error(
        "FotoÄŸraf 4 MB canonical sÄ±nÄ±rÄ±na indirilemedi.",
      );
    }

    const checksumBuffer =
      await crypto.subtle.digest(
        "SHA-256",
        await blob.arrayBuffer(),
      );

    const checksumSha256 = Array.from(
      new Uint8Array(checksumBuffer),
    )
      .map(byte =>
        byte.toString(16).padStart(2, "0"),
      )
      .join("");

    return {
      blob,
      width,
      height,
      checksumSha256,
    };
  } finally {
    bitmap.close();
  }
}

async function sha256Text(
  value: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes,
  );

  return Array.from(new Uint8Array(digest))
    .map(byte =>
      byte.toString(16).padStart(2, "0"),
    )
    .join("");
}

async function mediaApi(
  sessionToken: string | null,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!sessionToken) {
    throw new Error("Yetkilendirme bilgisi eksik.");
  }

  const response = await fetch(
    "/api/sync/media",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(payload),
    },
  );

  const data = (await response.json()) as Record<
    string,
    unknown
  >;

  if (!response.ok || data.success !== true) {
    throw new Error(
      String(
        data.error ||
          "Canonical medya iÅŸlemi baÅŸarÄ±sÄ±z.",
      ),
    );
  }

  return data;
}

export async function uploadCanonicalPhoto(input: {
  file: File;
  targetType: CanonicalPhotoTargetType;
  targetId: string;
  purpose: CanonicalPhotoPurpose;
  sessionToken: string | null;
  replaceLinkId?: string | null;
}): Promise<{
  linkId: string;
  assetId?: string;
}> {
  const compressed =
    await compressPhotoForCanonicalUpload(
      input.file,
    );

  const idempotencyKey =
    crypto.randomUUID();

  const semanticHash = await sha256Text(
    JSON.stringify({
      targetType: input.targetType,
      targetId: input.targetId,
      purpose: input.purpose,
      checksumSha256:
        compressed.checksumSha256,
      byteSize: compressed.blob.size,
      replaceLinkId:
        input.replaceLinkId || null,
    }),
  );

  const prepared = await mediaApi(input.sessionToken, {
    action: "prepare",
    targetType: input.targetType,
    targetId: input.targetId,
    purpose: input.purpose,
    mimeType: "image/webp",
    byteSize: compressed.blob.size,
    checksumSha256:
      compressed.checksumSha256,
    idempotencyKey,
    semanticHash,
    replaceLinkId:
      input.replaceLinkId || null,
  });

  if (
    prepared.committed === true &&
    prepared.linkId
  ) {
    return {
      linkId: String(prepared.linkId),
    };
  }

  const bucket = String(
    prepared.bucket || "",
  );
  const path = String(prepared.path || "");
  const token = String(
    prepared.token || "",
  );
  const intentId = String(
    prepared.intentId || "",
  );

  if (
    !bucket ||
    !path ||
    !token ||
    !intentId
  ) {
    throw new Error(
      "Canonical upload hazÄ±rlÄ±ÄŸÄ± eksik dÃ¶ndÃ¼.",
    );
  }

  const storage = browserStorageClient();
  const { error: uploadError } =
    await storage.storage
      .from(bucket)
      .uploadToSignedUrl(
        path,
        token,
        compressed.blob,
        {
          contentType: "image/webp",
        },
      );

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const finalized = await mediaApi(input.sessionToken, {
    action: "finalize",
    intentId,
    sourceFilename: input.file.name,
  });

  return {
    linkId: String(finalized.linkId),
    assetId: finalized.assetId
      ? String(finalized.assetId)
      : undefined,
  };
}

export async function listCanonicalMedia(input: {
  targetType: CanonicalPhotoTargetType;
  targetId: string;
  sessionToken: string | null;
}): Promise<CanonicalMediaItem[]> {
  if (!input.sessionToken) {
    throw new Error("Yetkilendirme bilgisi eksik.");
  }

  const params = new URLSearchParams({
    targetType: input.targetType,
    targetId: input.targetId,
  });

  const response = await fetch(
    `/api/sync/media?${params.toString()}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${input.sessionToken}`,
      },
      cache: "no-store",
    },
  );

  const data = (await response.json()) as {
    success?: boolean;
    error?: string;
    items?: CanonicalMediaItem[];
  };

  if (!response.ok || data.success !== true) {
    throw new Error(
      data.error ||
        "Canonical medya listesi alÄ±namadÄ±.",
    );
  }

  return Array.isArray(data.items)
    ? data.items
    : [];
}

export async function archiveCanonicalMedia(
  linkId: string,
  sessionToken: string | null,
): Promise<void> {
  await mediaApi(sessionToken, {
    action: "archive",
    linkId,
    reason: "USER_REMOVE",
  });
}
