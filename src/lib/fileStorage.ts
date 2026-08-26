/**
 * Legacy DataURL/Base64 producer is intentionally fail-closed.
 *
 * Canonical media uploads must use mediaCanonicalClient:
 * device-side compression -> signed direct Storage upload -> server verification
 * -> canonical media_assets/media_links.
 */
export function fileToDataUrl(
  file: File,
  type: "photo" | "video",
): Promise<string> {
  void file;
  void type;

  return Promise.reject(
    new Error(
      "Legacy Base64/DataURL medya yükleme kapalı. Yeni fotoğraflar canonical medya akışından yüklenmelidir.",
    ),
  );
}
