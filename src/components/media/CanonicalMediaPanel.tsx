"use client";

import { useAuthStore } from "@/store/useAuthStore";

import Image from "next/image";
import {
  Camera,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  archiveCanonicalMedia,
  listCanonicalMedia,
  uploadCanonicalPhoto,
  type CanonicalMediaItem,
  type CanonicalPhotoPurpose,
  type CanonicalPhotoTargetType,
} from "@/lib/mediaCanonicalClient";

type Props = {
  targetType: CanonicalPhotoTargetType;
  targetId: string;
  purpose: CanonicalPhotoPurpose;
  actorRole?: string | null;
  compact?: boolean;
};

export function CanonicalMediaPanel({
  targetType,
  targetId,
  purpose,
  actorRole,
  compact = false,
}: Props) {
  const { sessionToken } = useAuthStore();
  const role = String(actorRole || "").toUpperCase();
  const isAdmin = role === "ADMIN";
  const [mediaEntitlement, setMediaEntitlement] =
    useState<{
      sessionToken: string | null;
      enabled: boolean;
    }>({
      sessionToken: null,
      enabled: false,
    });
  const mediaEntitlementReady =
    Boolean(sessionToken) &&
    mediaEntitlement.sessionToken === sessionToken;
  const mediaEnabled =
    mediaEntitlementReady &&
    mediaEntitlement.enabled;
  const canUpload =
    mediaEnabled &&
    (isAdmin || targetType === "MEASUREMENT");

  const [items, setItems] = useState<
    CanonicalMediaItem[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<
    string | null
  >(null);
  const inputRef = useRef<HTMLInputElement | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    if (!sessionToken) {
      return () => {
        cancelled = true;
      };
    }

    void fetch("/api/media-entitlement", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    })
      .then(async response => {
        const payload =
          (await response.json()) as {
            success?: boolean;
            mediaEnabled?: boolean;
          };

        if (cancelled) return;

        setMediaEntitlement({
          sessionToken,
          enabled:
            response.ok &&
            payload.success === true &&
            payload.mediaEnabled === true,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setMediaEntitlement({
            sessionToken,
            enabled: false,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  const refresh = useCallback(async () => {
    if (!mediaEnabled || !isAdmin) {
      setItems([]);
      return;
    }

    try {
      const next = await listCanonicalMedia({
        targetType,
        targetId,
        sessionToken,
      });
      setItems(next);
      setMessage(null);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Medya listesi alÃƒâ€Ã‚Â±namadÃƒâ€Ã‚Â±.",
      );
    }
  }, [isAdmin, mediaEnabled, sessionToken, targetId, targetType]);

  useEffect(() => {
    if (!mediaEnabled || !isAdmin) return;

    let cancelled = false;

    void listCanonicalMedia({
      targetType,
      targetId,
      sessionToken,
    })
      .then(next => {
        if (!cancelled) {
          setItems(next);
          setMessage(null);
        }
      })
      .catch(error => {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Medya listesi alÃƒâ€Ã‚Â±namadÃƒâ€Ã‚Â±.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin, mediaEnabled, sessionToken, targetId, targetType]);

  async function onFile(
    file: File | undefined,
  ) {
    if (!file || busy) return;

    setBusy(true);
    setMessage(null);
    try {
      await uploadCanonicalPhoto({
        file,
        targetType,
        targetId,
        purpose,
        sessionToken,
      });

      if (isAdmin) {
        await refresh();
      } else {
        setMessage(
          "FotoÃƒâ€Ã…Â¸raf gÃƒÆ’Ã‚Â¼venli Ãƒâ€¦Ã…Â¸ekilde gÃƒÆ’Ã‚Â¶nderildi. ÃƒÆ’Ã¢â‚¬â€œlÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â¼ fotoÃƒâ€Ã…Â¸raflarÃƒâ€Ã‚Â± yalnÃƒâ€Ã‚Â±z ADMIN tarafÃƒâ€Ã‚Â±ndan gÃƒÆ’Ã‚Â¶rÃƒÆ’Ã‚Â¼ntÃƒÆ’Ã‚Â¼lenebilir.",
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "FotoÃƒâ€Ã…Â¸raf yÃƒÆ’Ã‚Â¼klenemedi.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function archive(linkId: string) {
    if (!isAdmin || busy) return;

    setBusy(true);
    setMessage(null);
    try {
      await archiveCanonicalMedia(linkId, sessionToken);
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "FotoÃƒâ€Ã…Â¸raf arÃƒâ€¦Ã…Â¸ivlenemedi.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!mediaEntitlementReady || !mediaEnabled) {
    return null;
  }

  return (
    <div
      className={
        compact
          ? "space-y-2"
          : "space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
      }
      data-canonical-media-target={`${targetType}:${targetId}`}
    >
      {isAdmin && items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map(item => (
            <div
              key={item.linkId}
              className="relative h-16 w-16 overflow-hidden rounded border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
            >
              <Image
                src={item.signedUrl}
                alt="Canonical fotoÃƒâ€Ã…Â¸raf"
                fill
                unoptimized
                sizes="64px"
                className="object-cover"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void archive(item.linkId)
                }
                className="absolute right-0 top-0 rounded-bl bg-red-600 p-1 text-white disabled:opacity-50"
                aria-label="FotoÃƒâ€Ã…Â¸rafÃƒâ€Ã‚Â± gÃƒÆ’Ã‚Â¶rÃƒÆ’Ã‚Â¼nÃƒÆ’Ã‚Â¼mden kaldÃƒâ€Ã‚Â±r"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {canUpload && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={event =>
              void onFile(
                event.target.files?.[0],
              )
            }
          />
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              inputRef.current?.click()
            }
            className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            FotoÃƒâ€Ã…Â¸raf Ekle
          </button>
        </>
      )}

      {message && (
        <div className="text-xs text-amber-700 dark:text-amber-300">
          {message}
        </div>
      )}
    </div>
  );
}
