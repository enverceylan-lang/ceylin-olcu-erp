import { useStore, subscribeToStoreChanges } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';

// Track if a sync is currently in progress
let isSyncing = false;

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
        store.setCustomers(result.customers);
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

