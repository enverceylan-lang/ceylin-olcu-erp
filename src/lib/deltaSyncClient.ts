import { getPendingSyncEvents, markSyncEventsSynced, markSyncEventsError } from './localSyncQueueDb';
import { useAuthStore } from '@/store/useAuthStore';

// btoa() fails on non-Latin1 characters (e.g. Ş, Ğ, İ, Ü, Ö, Ç).
function utf8ToBase64(str: string): string {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
    return String.fromCharCode(parseInt(p1, 16));
  }));
}

export async function pushDeltaSyncEvents(): Promise<{
  success: boolean;
  pushedCount: number;
  errors: string[];
  debug: {
    pendingCount: number;
    apiStatus: number | string;
    syncedCount: number;
    errorCount: number;
    firstStatus: string;
  };
}> {
  try {
    const pendingEvents = await getPendingSyncEvents(50);
    
    if (pendingEvents.length === 0) {
      return { 
        success: true, 
        pushedCount: 0, 
        errors: [],
        debug: {
          pendingCount: 0,
          apiStatus: 'N/A',
          syncedCount: 0,
          errorCount: 0,
          firstStatus: 'NONE'
        }
      };
    }

    const firstStatus = pendingEvents[0].syncStatus;

    const { currentUser } = useAuthStore.getState();
    if (!currentUser || !currentUser.username || !currentUser.password) {
      return {
        success: false,
        pushedCount: 0,
        errors: ["Local Auth credentials missing."],
        debug: {
          pendingCount: pendingEvents.length,
          apiStatus: 401,
          syncedCount: 0,
          errorCount: 0,
          firstStatus
        }
      };
    }

    const token = utf8ToBase64(`${currentUser.username}:${currentUser.password}`);

    // Call the server-side API route which uses the Service Role Key
    const response = await fetch('/api/delta-sync/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ events: pendingEvents })
    });

    let data: any = {};
    let errText = '';

    if (!response.ok) {
      errText = await response.text();
      try {
        const json = JSON.parse(errText);
        errText = json.error || json.details || errText;
      } catch (e) {}
      
      return {
        success: false,
        pushedCount: 0,
        errors: [`API returned ${response.status}: ${errText}`],
        debug: {
          pendingCount: pendingEvents.length,
          apiStatus: response.status,
          syncedCount: 0,
          errorCount: 0,
          firstStatus
        }
      };
    }

    data = await response.json();

    const { success, syncedIds, errorIds, errors } = data;

    // Update Local Queue based on the server response
    if (syncedIds && syncedIds.length > 0) {
      await markSyncEventsSynced(syncedIds);
    }
    
    if (errorIds && errorIds.length > 0) {
      const errMsgs = Array.isArray(errors) ? errors.join(', ') : (errors || 'Unknown error');
      await markSyncEventsError(errorIds, errMsgs);
    }

    return {
      success: success && (errorIds || []).length === 0,
      pushedCount: (syncedIds || []).length,
      errors: Array.isArray(errors) ? errors : (errors ? [String(errors)] : []),
      debug: {
        pendingCount: pendingEvents.length,
        apiStatus: response.status,
        syncedCount: (syncedIds || []).length,
        errorCount: (errorIds || []).length,
        firstStatus
      }
    };

  } catch (err: any) {
    console.error('[DeltaSyncClient] Push failed:', err);
    return { 
      success: false, 
      pushedCount: 0, 
      errors: [err.message],
      debug: {
        pendingCount: -1,
        apiStatus: 'EXCEPTION',
        syncedCount: 0,
        errorCount: 0,
        firstStatus: 'UNKNOWN'
      }
    };
  }
}
