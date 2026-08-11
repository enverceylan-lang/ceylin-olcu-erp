"use client";

import {
  Camera,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(
    source: HTMLVideoElement,
  ): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorConstructor =
  new (options?: {
    formats?: string[];
  }) => BarcodeDetectorLike;

interface BarcodeScannerButtonProps {
  onDetected(
    barcode: string,
  ): void;
  disabled?: boolean;
  title?: string;
}

export function BarcodeScannerButton({
  onDetected,
  disabled = false,
  title = "Barkod okut",
}: BarcodeScannerButtonProps) {
  const [open, setOpen] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const videoRef =
    useRef<HTMLVideoElement | null>(
      null,
    );

  const streamRef =
    useRef<MediaStream | null>(
      null,
    );

  const animationRef =
    useRef<number | null>(
      null,
    );

  const zxingStopRef =
    useRef<(() => void) | null>(
      null,
    );

  const close = () => {
    if (
      animationRef.current !== null
    ) {
      window.cancelAnimationFrame(
        animationRef.current,
      );
      animationRef.current = null;
    }

    zxingStopRef.current?.();
    zxingStopRef.current = null;

    streamRef.current
      ?.getTracks()
      .forEach(track =>
        track.stop(),
      );

    streamRef.current = null;
    setOpen(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const stopLocalResources = () => {
      if (
        animationRef.current !== null
      ) {
        window.cancelAnimationFrame(
          animationRef.current,
        );
        animationRef.current = null;
      }

      zxingStopRef.current?.();
      zxingStopRef.current = null;

      streamRef.current
        ?.getTracks()
        .forEach(track =>
          track.stop(),
        );

      streamRef.current = null;
    };

    const finish = (
      value: string,
    ) => {
      const normalized =
        value.trim();

      if (
        !normalized ||
        cancelled
      ) {
        return;
      }

      onDetected(normalized);
      stopLocalResources();
      setOpen(false);
    };

    const startNativeDetector =
      async (
        detectorConstructor:
          BarcodeDetectorConstructor,
      ): Promise<boolean> => {
        if (
          !navigator.mediaDevices
            ?.getUserMedia
        ) {
          return false;
        }

        try {
          const stream =
            await navigator.mediaDevices
              .getUserMedia({
                video: {
                  facingMode: {
                    ideal:
                      "environment",
                  },
                },
                audio: false,
              });

          if (cancelled) {
            stream
              .getTracks()
              .forEach(track =>
                track.stop(),
              );

            return true;
          }

          streamRef.current =
            stream;

          const video =
            videoRef.current;

          if (!video) {
            throw new Error(
              "VIDEO_ELEMENT_MISSING",
            );
          }

          video.srcObject = stream;
          await video.play();

          const detector =
            new detectorConstructor({
              formats: [
                "ean_13",
                "ean_8",
                "code_128",
                "code_39",
                "upc_a",
                "upc_e",
                "itf",
                "codabar",
                "qr_code",
              ],
            });

          const scan = async () => {
            if (
              cancelled ||
              !videoRef.current
            ) {
              return;
            }

            try {
              const results =
                await detector.detect(
                  videoRef.current,
                );

              const value =
                results[0]?.rawValue;

              if (value) {
                finish(value);
                return;
              }
            }
            catch {
              // Native frame decode failures
              // are retried.
            }

            animationRef.current =
              window.requestAnimationFrame(
                () => {
                  void scan();
                },
              );
          };

          void scan();
          return true;
        }
        catch {
          stopLocalResources();
          return false;
        }
      };

    const startZxingFallback =
      async (): Promise<void> => {
        try {
          const {
            BrowserMultiFormatReader,
          } = await import(
            "@zxing/browser"
          );

          if (cancelled) {
            return;
          }

          const reader =
            new BrowserMultiFormatReader();

          const video =
            videoRef.current;

          if (!video) {
            throw new Error(
              "VIDEO_ELEMENT_MISSING",
            );
          }

          const controls =
            await reader.decodeFromConstraints(
              {
                video: {
                  facingMode: {
                    ideal:
                      "environment",
                  },
                },
                audio: false,
              },
              video,
              (
                result,
                decodeError,
              ) => {
                if (
                  cancelled
                ) {
                  return;
                }

                if (result) {
                  finish(
                    result.getText(),
                  );
                  return;
                }

                void decodeError;
              },
            );

          zxingStopRef.current =
            () => {
              controls.stop();
            };
        }
        catch {
          stopLocalResources();

          setError(
            "Kamera veya barkod okuyucu başlatılamadı. Kamera iznini ve tarayıcı ayarlarını kontrol edin.",
          );
        }
      };

    const start = async () => {
      setError(null);

      if (
        !navigator.mediaDevices
          ?.getUserMedia
      ) {
        setError(
          "Kamera erişimi bu cihazda kullanılamıyor.",
        );
        return;
      }

      const detectorConstructor = (
        window as unknown as {
          BarcodeDetector?:
            BarcodeDetectorConstructor;
        }
      ).BarcodeDetector;

      if (
        detectorConstructor
      ) {
        const nativeStarted =
          await startNativeDetector(
            detectorConstructor,
          );

        if (nativeStarted) {
          return;
        }
      }

      await startZxingFallback();
    };

    void start();

    return () => {
      cancelled = true;
      stopLocalResources();
    };
  }, [open, onDetected]);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          setOpen(true)
        }
        title={title}
        aria-label={title}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <Camera className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Barkod tarayıcı"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">
                  Barkod Okut
                </h3>

                <p className="text-xs text-gray-500">
                  Barkodu kameranın karşısında sabit tutun.
                </p>
              </div>

              <button
                type="button"
                onClick={close}
                aria-label="Kamerayı kapat"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-video w-full object-cover"
              />
            </div>

            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={close}
              className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </>
  );
}