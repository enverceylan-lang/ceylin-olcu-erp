import { useStore, subscribeToStoreChanges, Customer, Room, WindowItem, ProductMeasurement } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';

// Track if a sync is currently in progress
let isSyncing = false;

// Helper functions for client-side merging using "latest updatedAt wins" strategy
function mergeCustomers(local: Customer[], remote: Customer[]): Customer[] {
  const mergedMap = new Map<string, Customer>();

  // Add all local customers to the map
  local.forEach(lc => {
    mergedMap.set(lc.id, { ...lc });
  });

  // Merge remote customers
  remote.forEach(rc => {
    const lc = mergedMap.get(rc.id);
    if (!lc) {
      // If not present locally, add it
      mergedMap.set(rc.id, rc);
    } else {
      // If present in both, compare updatedAt
      const lcTime = new Date(lc.updatedAt || 0).getTime();
      const rcTime = new Date(rc.updatedAt || 0).getTime();
      
      let finalCustomer: Customer;
      if (rcTime > lcTime) {
        // Remote is newer, take remote but keep local rooms to merge them below
        finalCustomer = {
          ...rc,
          rooms: lc.rooms || []
        };
      } else {
        // Local is newer or equal, take local
        finalCustomer = { ...lc };
      }

      // Merge rooms
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

export async function syncNow() {
  if (isSyncing) return;
  isSyncing = true;

  const store = useStore.getState();
  const authStore = useAuthStore.getState();

  // Check network connection
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

    if (!currentUser) {
      // If no user is logged in, we cannot authenticate the request.
      // Simply complete the run as synced for now.
      store.setSyncStatus('synced');
      isSyncing = false;
      return;
    }

    // Add diagnostic console logs without exposing full password
    const usernameUsed = currentUser.username;
    const credentialPresent = !!currentUser.password;
    console.log(`[Sync Diagnostics] Username: ${usernameUsed}, Credential present: ${credentialPresent}`);

    if (!currentUser.password) {
      console.warn("Sync auth missing credential. Please logout and login again.");
      store.setSyncStatus('error');
      isSyncing = false;
      authStore.logout();
      return;
    }

    // Calculate payload counts for logging
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

    console.log("Sync started...");
    console.log(`Payload counts: customers=${localCustomers.length}, rooms=${roomCount}, openings=${openingCount}, measurements=${measurementCount}, users=${localUsers.length}`);

    // Construct Authorization header: Bearer base64(username:password)
    const token = btoa(`${currentUser.username}:${currentUser.password}`);

    const response = await fetch('/api/sync/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        customers: localCustomers,
        pendingDeletes: pendingDeletes,
        users: localUsers
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Sync failed with status ${response.status}: ${errorText}`);
      throw new Error(`Sync API returned status ${response.status}`);
    }

    const result = await response.json();
    if (result.success) {
      console.log("Sync success!");
      // Update local store with merged data
      if (result.customers) {
        const currentCustomers = useStore.getState().customers || [];
        const merged = mergeCustomers(currentCustomers, result.customers);
        store.setCustomers(merged);
      }
      if (result.users) {
        useAuthStore.setState({ users: result.users });
      }
      store.clearPendingDeletes();
      store.setSyncStatus('synced');
    } else {
      console.error("Sync failed with error:", result.error || 'Sync service failed');
      throw new Error(result.error || 'Sync service failed');
    }
  } catch (error) {
    console.error('Sync error:', error);
    store.setSyncStatus('error');
  } finally {
    isSyncing = false;
  }
}

export function initSync() {
  if (typeof window === 'undefined') return;

  // Initial sync delay
  setTimeout(() => {
    syncNow();
  }, 1000);

  // Connection status event listeners
  const handleOnline = () => {
    const store = useStore.getState();
    store.setSyncStatus('pending');
    syncNow();
  };

  const handleOffline = () => {
    const store = useStore.getState();
    store.setSyncStatus('offline');
  };

  const handleAppResume = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      console.log("[Sync Service] App resume / tab focused. Triggering auto-sync.");
      syncNow();
    }
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('focus', handleAppResume);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleAppResume);
  }

  // Subscribe to store changes to trigger sync immediately
  const unsubscribeStore = subscribeToStoreChanges(() => {
    syncNow();
  });

  // Periodic sync every 60 seconds (as requested for first version)
  const interval = setInterval(() => {
    syncNow();
  }, 60000);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('focus', handleAppResume);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleAppResume);
    }
    unsubscribeStore();
    clearInterval(interval);
  };
}

