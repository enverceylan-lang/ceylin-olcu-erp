import { useStore, subscribeToStoreChanges, Customer, Room, WindowItem, ProductMeasurement } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';

// Track if a sync is currently in progress
let isSyncing = false;

// Track last 413 Payload Too Large error timestamp
let last413Time = 0;

// Helper to encode base64 safely with UTF-8 support (avoids Turkish character btoa crashes)
// btoa() fails on non-Latin1 characters (e.g. Ş, Ğ, İ, Ü, Ö, Ç).
// This implementation encodes the string as UTF-8 bytes first, then base64-encodes the bytes.
function utf8ToBase64(str: string): string {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
    return String.fromCharCode(parseInt(p1, 16));
  }));
}

// Deep clone payload and strip any raw base64 data URLs / media arrays
function stripMediaAndDataUrls(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    if (obj.startsWith('data:image/') || obj.startsWith('data:video/') || obj.startsWith('data:application/')) {
      return '';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => stripMediaAndDataUrls(item));
  }

  if (typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      if (['addressPhotos', 'photos', 'videos'].includes(key) && Array.isArray(obj[key])) {
        res[key] = [];
      } else {
        res[key] = stripMediaAndDataUrls(obj[key]);
      }
    }
    return res;
  }

  return obj;
}

// ─── Client-side merge helpers — "latest updatedAt wins" strategy ───

function mergeCustomers(local: Customer[], remote: Customer[]): Customer[] {
  const mergedMap = new Map<string, Customer>();

  // Seed map with all local customers
  local.forEach(lc => {
    mergedMap.set(lc.id, { ...lc });
  });

  // Merge remote customers on top
  remote.forEach(rc => {
    const lc = mergedMap.get(rc.id);
    if (!lc) {
      // Only exists remotely — add it
      mergedMap.set(rc.id, rc);
    } else {
      const lcTime = new Date(lc.updatedAt || 0).getTime();
      const rcTime = new Date(rc.updatedAt || 0).getTime();

      let finalCustomer: Customer;
      if (rcTime > lcTime) {
        // Remote is newer — take remote fields but merge rooms separately
        finalCustomer = {
          ...rc,
          rooms: lc.rooms || []
        };
      } else {
        // Local is newer or equal — keep local
        finalCustomer = { ...lc };
      }

      // Always merge rooms from both sides
      const mergedRooms = mergeRooms(lc.rooms || [], rc.rooms || []);
      finalCustomer.rooms = mergedRooms;

      mergedMap.set(rc.id, finalCustomer);
    }
  });

  return Array.from(mergedMap.values());
}

function mergeRooms(local: Room[], remote: Room[]): Room[] {
  const mergedMap = new Map<string, Room>();

  local.forEach(lr => {
    mergedMap.set(lr.id, { ...lr });
  });

  remote.forEach(rr => {
    const lr = mergedMap.get(rr.id);
    if (!lr) {
      mergedMap.set(rr.id, rr);
    } else {
      const lrTime = new Date(lr.updatedAt || 0).getTime();
      const rrTime = new Date(rr.updatedAt || 0).getTime();

      let finalRoom: Room;
      if (rrTime > lrTime) {
        finalRoom = {
          ...rr,
          windows: lr.windows || []
        };
      } else {
        finalRoom = { ...lr };
      }

      const mergedWindows = mergeWindows(lr.windows || [], rr.windows || []);
      finalRoom.windows = mergedWindows;

      mergedMap.set(rr.id, finalRoom);
    }
  });

  return Array.from(mergedMap.values());
}

function mergeWindows(local: WindowItem[], remote: WindowItem[]): WindowItem[] {
  const mergedMap = new Map<string, WindowItem>();

  local.forEach(lw => {
    mergedMap.set(lw.id, { ...lw });
  });

  remote.forEach(rw => {
    const lw = mergedMap.get(rw.id);
    if (!lw) {
      mergedMap.set(rw.id, rw);
    } else {
      const lwTime = new Date(lw.updatedAt || 0).getTime();
      const rwTime = new Date(rw.updatedAt || 0).getTime();

      let finalWindow: WindowItem;
      if (rwTime > lwTime) {
        finalWindow = {
          ...rw,
          products: lw.products || []
        };
      } else {
        finalWindow = { ...lw };
      }

      const mergedProducts = mergeProducts(lw.products || [], rw.products || []);
      finalWindow.products = mergedProducts;

      mergedMap.set(rw.id, finalWindow);
    }
  });

  return Array.from(mergedMap.values());
}

function mergeProducts(local: ProductMeasurement[], remote: ProductMeasurement[]): ProductMeasurement[] {
  const mergedMap = new Map<string, ProductMeasurement>();

  local.forEach(lp => {
    mergedMap.set(lp.id, { ...lp });
  });

  remote.forEach(rp => {
    const lp = mergedMap.get(rp.id);
    if (!lp) {
      mergedMap.set(rp.id, rp);
    } else {
      const lpTime = new Date(lp.updatedAt || 0).getTime();
      const rpTime = new Date(rp.updatedAt || 0).getTime();

      if (rpTime > lpTime) {
        mergedMap.set(rp.id, rp);
      }
      // else keep local
    }
  });

  return Array.from(mergedMap.values());
}

// ─── Main Sync Function ───

export async function syncNow(isManual: boolean = false) {
  if (isSyncing) return;

  // ── Auto-sync throttle after 413 payload error ──
  if (!isManual && last413Time > 0) {
    const elapsed = Date.now() - last413Time;
    if (elapsed < 60000) {
      console.log(`[Client Sync] Auto-sync throttled: last sync failed with 413 Payload Too Large (${Math.ceil((60000 - elapsed) / 1000)}s remaining).`);
      return;
    }
  }

  isSyncing = true;

  const store = useStore.getState();
  const authStore = useAuthStore.getState();

  // Check network connection — set offline status and abort early if no connection
  if (typeof window !== 'undefined' && !window.navigator.onLine) {
    store.setSyncStatus('offline');
    isSyncing = false;
    return;
  }

  store.setSyncStatus('pending');

  try {
    const localCustomers = store.customers || [];
    const pendingDeletes = store.pendingDeletes || [];
    const localUsers = authStore.users || [];
    const currentUser = authStore.currentUser;

    // ── Diagnostic logs (no secret values printed) ──
    console.log('[Client Sync] currentUser exists:', !!currentUser);
    if (currentUser) {
      console.log('[Client Sync] currentUser.username:', currentUser.username);
      console.log('[Client Sync] currentUser.role:', currentUser.role);
      console.log('[Client Sync] credential/password exists:', !!currentUser.password);
    }
    console.log('[Client Sync] Authorization header will be sent:', !!(currentUser && currentUser.password));

    // ── Guard: no user logged in ──
    // Do NOT set status to 'synced' here — no sync actually occurred.
    // Use 'offline' as a neutral non-error state while unauthenticated.
    if (!currentUser) {
      console.log('[Client Sync] No user logged in — sync skipped.');
      store.setSyncStatus('offline');
      isSyncing = false;
      return;
    }

    // ── Guard: user has no stored credential ──
    // This can happen when sanitized remote users overwrite the local users list
    // and the currentUser's password gets lost. Force re-login rather than
    // silently failing or showing a false "synced" status.
    if (!currentUser.password) {
      console.warn('[Client Sync] currentUser has no stored credential. Sync aborted — please log out and log in again.');
      store.setSyncStatus('error');
      isSyncing = false;
      return;
    }

    // ── Payload diagnostics (counts only, no data values) ──
    let roomCount = 0;
    let openingCount = 0;
    let measurementCount = 0;
    localCustomers.forEach(c => {
      roomCount += (c.rooms || []).length;
      (c.rooms || []).forEach(r => {
        openingCount += (r.windows || []).length;
        (r.windows || []).forEach(w => {
          measurementCount += (w.products || []).length;
        });
      });
    });

    console.log('[Client Sync] payload counts:', {
      customers: localCustomers.length,
      rooms: roomCount,
      openings: openingCount,
      measurements: measurementCount,
      users: localUsers.length,
      pendingDeletes: pendingDeletes.length
    });

    // ── Task A: Measure raw payload size and section breakdown ──
    const getObjSize = (obj: any): number => {
      try {
        const str = JSON.stringify(obj);
        return typeof Blob !== 'undefined' ? new Blob([str]).size : str.length;
      } catch {
        return 0;
      }
    };

    const sizeCustomers = getObjSize(localCustomers);
    const sizeUsers = getObjSize(localUsers);
    const sizePendingDeletes = getObjSize(pendingDeletes);

    // Extract flat arrays of sub-entities to measure their sizes
    const roomsFlat: any[] = [];
    const openingsFlat: any[] = [];
    const measurementsFlat: any[] = [];
    localCustomers.forEach(c => {
      if (c.rooms) {
        roomsFlat.push(...c.rooms.map(({ windows, ...rest }: any) => rest));
        c.rooms.forEach((r: any) => {
          if (r.windows) {
            openingsFlat.push(...r.windows.map(({ products, ...rest }: any) => rest));
            r.windows.forEach((w: any) => {
              if (w.products) {
                measurementsFlat.push(...w.products);
              }
            });
          }
        });
      }
    });

    const sizeRooms = getObjSize(roomsFlat);
    const sizeOpenings = getObjSize(openingsFlat);
    const sizeMeasurements = getObjSize(measurementsFlat);
    const rawTotalSize = sizeCustomers + sizeUsers + sizePendingDeletes;

    console.log('[Client Sync Size Info] Raw Section Sizes (approximate):', {
      customersTotalBranch: (sizeCustomers / 1024).toFixed(2) + ' KB',
      roomsOnlyFlat: (sizeRooms / 1024).toFixed(2) + ' KB',
      openingsOnlyFlat: (sizeOpenings / 1024).toFixed(2) + ' KB',
      measurementsOnlyFlat: (sizeMeasurements / 1024).toFixed(2) + ' KB',
      usersSection: (sizeUsers / 1024).toFixed(2) + ' KB',
      pendingDeletesSection: (sizePendingDeletes / 1024).toFixed(2) + ' KB',
      totalRawPayload: (rawTotalSize / 1024).toFixed(2) + ' KB'
    });

    // ── Task B: Sanitizing outgoing sync payload by stripping media ──
    const sanitizedCustomers = stripMediaAndDataUrls(localCustomers);
    const sanitizedPayload = {
      customers: sanitizedCustomers,
      pendingDeletes: pendingDeletes,
      users: localUsers
    };
    const sanitizedJsonSize = getObjSize(sanitizedPayload);
    console.log('[Client Sync Size Info] Sanitized Payload Size:', (sanitizedJsonSize / 1024).toFixed(2) + ' KB');

    // ── Build Authorization header using UTF-8-safe base64 ──
    // Prevents btoa crash on Turkish characters (Ş, Ğ, İ, Ü, Ö, Ç) in usernames/passwords.
    const token = utf8ToBase64(`${currentUser.username}:${currentUser.password}`);

    const response = await fetch('/api/sync/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(sanitizedPayload)
    });

    console.log('[Client Sync] response status:', response.status);

    // ── Task E: Handle 413 Payload Too Large explicitly ──
    if (response.status === 413) {
      last413Time = Date.now();
      console.error('[Client Sync] response error 413: Request Entity Too Large. Senkronizasyon paketi çok büyük. Fotoğraf/video verileri ayrı aktarılmalı.');
      store.setSyncStatus('error');
      isSyncing = false;
      return;
    }

    // ── HTTP error — do NOT set "synced" — set error ──
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Client Sync] response error:', errorText);
      store.setSyncStatus('error');
      isSyncing = false;
      return;
    }

    const result = await response.json();
    console.log('[Client Sync] response body success:', !!result.success);

    // ── API returned success: false — do NOT set "synced" ──
    if (!result.success) {
      console.error('[Client Sync] Sync API returned success: false —', result.error || 'unknown error');
      store.setSyncStatus('error');
      isSyncing = false;
      return;
    }

    // ── Confirmed success — apply merged data ──
    console.log('[Client Sync] counts received from server:', {
      customers: result.customers?.length ?? 0,
      users: result.users?.length ?? 0
    });

    if (result.customers) {
      const getCounts = (list: any[]) => {
        let rooms = 0;
        let openings = 0;
        let measurements = 0;
        list.forEach(c => {
          if (Array.isArray(c.rooms)) {
            rooms += c.rooms.length;
            c.rooms.forEach((r: any) => {
              if (Array.isArray(r.windows)) {
                openings += r.windows.length;
                r.windows.forEach((w: any) => {
                  if (Array.isArray(w.products)) {
                    measurements += w.products.length;
                  }
                });
              }
            });
          }
        });
        return { customers: list.length, rooms, openings, measurements };
      };

      const currentCustomers = useStore.getState().customers || [];
      const beforeCounts = getCounts(currentCustomers);
      const remoteCounts = getCounts(result.customers);

      const merged = mergeCustomers(currentCustomers, result.customers);
      const afterCounts = getCounts(merged);

      console.log('[Client Sync] before local counts:', beforeCounts);
      console.log('[Client Sync] remote counts:', remoteCounts);
      console.log('[Client Sync] after local counts:', afterCounts);

      store.setCustomers(merged);
    }

    // ── Safe user merge — never overwrite valid local credentials ──
    if (result.users) {
      const latestLocalUsers = useAuthStore.getState().users || [];
      // Keep a reference to the active session password BEFORE modifying the users list.
      // currentUser.password is the plain-text PIN/password entered at login time and
      // is never included in sanitized server responses. We must preserve it.
      const activeSessionPassword = currentUser.password;
      const activeUserId = currentUser.id;

      const mergedUsers = result.users.map((remoteUser: any) => {
        const localUser = latestLocalUsers.find((u: any) => u.id === remoteUser.id);

        // Priority for credential resolution:
        // 1. Active session user's password (most trustworthy — was just used to authenticate)
        // 2. Existing local users list password (may be plain-text or hashed)
        // 3. Remote user's password (only if server did not sanitize it — should not happen)
        // Never assign undefined, null, or empty string as the password.
        let preservedPassword: string | undefined;
        if (remoteUser.id === activeUserId) {
          // This is the currently logged-in user — always use the session password
          preservedPassword = activeSessionPassword;
        } else {
          // For other users, use what's already locally stored
          preservedPassword = localUser?.password || remoteUser.password;
        }

        if (!preservedPassword) {
          console.warn(`[Client Sync] User "${remoteUser.username}" has no recoverable local credential.`);
        }

        return {
          ...remoteUser,
          password: preservedPassword  // may be undefined for users never locally logged in
        };
      });

      useAuthStore.setState({ users: mergedUsers });

      // Ensure currentUser in the session still has its password intact
      // (it may have been partially overwritten by the setState above)
      const updatedCurrentUser = mergedUsers.find((u: any) => u.id === activeUserId);
      if (updatedCurrentUser && !updatedCurrentUser.password && activeSessionPassword) {
        // Patch currentUser directly to restore the session password
        useAuthStore.setState({
          currentUser: {
            ...useAuthStore.getState().currentUser!,
            password: activeSessionPassword
          }
        });
        console.log('[Client Sync] Restored session password for currentUser after merge.');
      }
    }

    // ── Clear pending deletes only after a confirmed successful sync ──
    store.clearPendingDeletes();

    // ── Only set "synced" after all of the above succeeded ──
    store.setSyncStatus('synced');

  } catch (error) {
    console.error('[Client Sync] Unexpected error during sync:', error);
    store.setSyncStatus('error');
  } finally {
    isSyncing = false;
  }
}

// ─── Sync Initializer — called once on app mount via PWAController ───

export function initSync() {
  if (typeof window === 'undefined') return;

  // Initial sync with a short delay to let the app render first
  setTimeout(() => {
    syncNow();
  }, 1000);

  // Re-sync when coming back online after being offline
  const handleOnline = () => {
    const store = useStore.getState();
    store.setSyncStatus('pending');
    syncNow();
  };

  // Mark as offline immediately when network drops
  const handleOffline = () => {
    const store = useStore.getState();
    store.setSyncStatus('offline');
  };

  // Re-sync when the app tab is focused / resumed from background
  const handleAppResume = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      console.log('[Sync] App focused / tab resumed — triggering sync.');
      syncNow();
    }
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('focus', handleAppResume);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleAppResume);
  }

  // Sync whenever the main data store changes (customer add/edit/delete)
  const unsubscribeStore = subscribeToStoreChanges(() => {
    syncNow();
  });

  // Sync when a user logs in or switches accounts
  let lastUserId: string | null = useAuthStore.getState().currentUser?.id ?? null;
  const unsubscribeAuth = useAuthStore.subscribe((state) => {
    const currentId = state.currentUser?.id ?? null;
    if (currentId && lastUserId !== currentId) {
      console.log('[Sync] User login or switch detected — triggering immediate sync.');
      syncNow();
    }
    lastUserId = currentId;
  });

  // Periodic background sync every 60 seconds
  const interval = setInterval(() => {
    syncNow();
  }, 60000);

  // Return cleanup function for use in React effects
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('focus', handleAppResume);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleAppResume);
    }
    unsubscribeStore();
    unsubscribeAuth();
    clearInterval(interval);
  };
}
