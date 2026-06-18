import { useStore } from '@/store/useStore';
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
      throw new Error(`Sync API returned status ${response.status}`);
    }

    const result = await response.json();
    if (result.success) {
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
      throw new Error(result.error || 'Sync service failed');
    }
  } catch (error) {
    console.error('Sync error:', error);
    store.setSyncStatus('pending');
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

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Periodic sync every 30 seconds
  const interval = setInterval(() => {
    syncNow();
  }, 30000);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    clearInterval(interval);
  };
}
