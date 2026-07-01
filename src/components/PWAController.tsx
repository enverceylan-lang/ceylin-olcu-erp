"use client";

import { useEffect, useState } from "react";
import { WifiOff, Download, RefreshCw, X, HelpCircle, AlertCircle } from "lucide-react";
import { initSync } from "@/lib/syncService";
import { useStore } from "@/store/useStore";

export function PWAController() {
  const [isOffline, setIsOffline] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showIosPrompt, setShowIosPrompt] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    let cleanupSync: (() => void) | undefined;
    // 1. Check offline status
    if (typeof window !== "undefined") {
      // Restore customers from IndexedDB to Zustand store on startup
      useStore.getState().initializeCustomersFromDb();

      cleanupSync = initSync();
      setIsOffline(!navigator.onLine);

      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // 2. Handle in-app installation (Android / Chrome)
      const handleBeforeInstallPrompt = (e: Event) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later.
        setDeferredPrompt(e);
        // Update UI to show the install button
        // Only show if not already in standalone mode
        const isStandalone = window.matchMedia("(display-mode: standalone)").matches || 
                             ("standalone" in window.navigator && (window.navigator as any).standalone);
        if (!isStandalone) {
          setShowInstallPrompt(true);
        }
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

      const handleAppInstalled = () => {
        console.log("App was successfully installed!");
        setShowInstallPrompt(false);
        setDeferredPrompt(null);
      };

      window.addEventListener("appinstalled", handleAppInstalled);

      // 3. iOS detection & instruction prompt
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches || 
                           ("standalone" in window.navigator && (window.navigator as any).standalone);
      const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      
      if (isiOS && !isStandalone) {
        // Show iOS installation tips (Safari menu -> Add to Home Screen)
        // Check if user has already dismissed it this session
        const dismissed = sessionStorage.getItem("pwa-ios-prompt-dismissed");
        if (!dismissed) {
          setShowIosPrompt(true);
        }
      }

      // 4. Service Worker registration and update detection
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").then((registration) => {
          console.log("Service Worker registered with scope:", registration.scope);

          // Check if there's already a waiting worker on page load
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setShowUpdateBanner(true);
          }

          // Listen for updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  setWaitingWorker(newWorker);
                  setShowUpdateBanner(true);
                }
              });
            }
          });
        }).catch((err) => {
          console.error("Service Worker registration failed:", err);
        });

        // Handle page refresh when the new service worker takes control
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });
      }

      return () => {
        if (cleanupSync) cleanupSync();
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleUpdateClick = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    setShowUpdateBanner(false);
  };

  const dismissIosPrompt = () => {
    setShowIosPrompt(false);
    sessionStorage.setItem("pwa-ios-prompt-dismissed", "true");
  };

  return (
    <>
      {/* Offline Banner */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white px-4 py-2.5 flex items-center justify-center gap-2 font-medium shadow-md animate-slide-down">
          <WifiOff className="w-5 h-5 animate-pulse" />
          <span className="text-sm sm:text-base">
            Çevrimdışı Çalışıyorsunuz
          </span>
          <span className="hidden sm:inline text-xs bg-red-700/50 px-2 py-0.5 rounded-full border border-red-500/20">
            Yerel verileriniz kullanılabilir
          </span>
        </div>
      )}

      {/* Update Banner */}
      {showUpdateBanner && (
        <div className="fixed bottom-4 right-4 z-[9999] max-w-sm w-[calc(100vw-2rem)] bg-slate-900 dark:bg-slate-950 text-white rounded-xl shadow-2xl border border-slate-700/60 p-4 animate-fade-in backdrop-blur-md bg-opacity-95">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <RefreshCw className="w-5 h-5 animate-spin-slow" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-slate-100">Yeni sürüm hazır</h4>
              <p className="text-xs text-slate-400 mt-1">Uygulamanın yeni sürümü yüklendi. Güncellemek için tıklayın.</p>
              <div className="flex gap-2 mt-3 justify-end">
                <button
                  onClick={() => setShowUpdateBanner(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
                >
                  Daha Sonra
                </button>
                <button
                  onClick={handleUpdateClick}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-1 shadow-lg shadow-blue-500/20"
                >
                  Güncelle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Android/Chrome Install Prompt */}
      {showInstallPrompt && (
        <div className="fixed bottom-4 left-4 z-[9999] max-w-sm w-[calc(100vw-2rem)] bg-slate-900 dark:bg-slate-950 text-white rounded-xl shadow-2xl border border-slate-700/60 p-4 animate-fade-in backdrop-blur-md bg-opacity-95">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Download className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-slate-100">Telefona Yükle</h4>
              <p className="text-xs text-slate-400 mt-1">Ölçü ERP uygulamasını ana ekranınıza ekleyip tam ekran kullanabilirsiniz.</p>
              <div className="flex gap-2 mt-3 justify-end">
                <button
                  onClick={() => setShowInstallPrompt(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
                >
                  Kapat
                </button>
                <button
                  onClick={handleInstallClick}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-1 shadow-lg shadow-indigo-500/20"
                >
                  Yükle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* iOS Installation Instructions */}
      {showIosPrompt && (
        <div className="fixed bottom-4 left-4 right-4 md:left-4 md:right-auto md:max-w-sm z-[9999] bg-slate-900 dark:bg-slate-950 text-white rounded-xl shadow-2xl border border-slate-700/60 p-4 animate-fade-in backdrop-blur-md bg-opacity-95">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-sm text-slate-100">iPhone/iPad'e Yükle</h4>
                <button onClick={dismissIosPrompt} className="text-slate-400 hover:text-white p-0.5 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Bu uygulamayı ana ekranınıza eklemek için:
                <br />
                <span className="font-semibold text-slate-200">Safari paylaş menüsü → Ana Ekrana Ekle</span>
                <br />
                seçeneğine dokunun.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
