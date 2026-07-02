import { getPendingSyncEvents, markSyncEventsSynced, markSyncEventsError } from './localSyncQueueDb';
import { getSyncCursor, setSyncCursor, saveInboundMeasurement, type InboundMeasurement } from './localDraftDb';
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

export async function pullInboundMeasurements(allLocalCustomers: any[]): Promise<{
  success: boolean;
  fetchedCount: number;
  errors: string[];
}> {
  try {
    const { currentUser } = useAuthStore.getState();
    if (!currentUser || !currentUser.username || !currentUser.password) {
      return { success: false, fetchedCount: 0, errors: ["Local Auth credentials missing."] };
    }

    const token = utf8ToBase64(`${currentUser.username}:${currentUser.password}`);
    const draftCursor = await getSyncCursor('draft_changes_cursor');
    const measurementCursor = await getSyncCursor('measurement_changes_cursor');

    const response = await fetch('/api/delta-sync/pull', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ draftCursor, measurementCursor })
    });

    if (!response.ok) {
      let errText = await response.text();
      return { success: false, fetchedCount: 0, errors: [`API Error: ${response.status} - ${errText}`] };
    }

    const data = await response.json();
    if (!data.success) {
      return { success: false, fetchedCount: 0, errors: [data.error || 'Unknown API Error'] };
    }

    const rawChanges = data.changes || [];
    let maxDraftRevision = draftCursor;
    let maxMeasurementRevision = measurementCursor;

    // Deduplicate changes by entity_id, keeping the latest revision
    const latestChanges = new Map<string, any>();
    for (const change of rawChanges) {
       const key = `${change.entity_type}_${change.entity_id}`;
       const existing = latestChanges.get(key);
       if (!existing || existing.revision < change.revision) {
           latestChanges.set(key, change);
       }
       
       // Advance cursors based on raw changes to not miss any revisions
       if (change.sourceTable === 'draft_changes' && change.revision > maxDraftRevision) {
         maxDraftRevision = change.revision;
       }
       if (change.sourceTable === 'measurement_changes' && change.revision > maxMeasurementRevision) {
         maxMeasurementRevision = change.revision;
       }
    }
    
    const changes = Array.from(latestChanges.values());

    for (const change of changes) {
      const patch = change.patch || {};
      
      // Allow DRAFT, CUSTOMER, ROOM, OPENING, MEASUREMENT events
      const isDraftEvent = change.entity_type === 'DRAFT' && (change.operation === 'INSERT' || change.operation === 'UPDATE');
      const isMeasurementEvent = ['CUSTOMER', 'ROOM', 'OPENING', 'MEASUREMENT'].includes(change.entity_type) && 
                                 (change.operation === 'INSERT' || change.operation === 'UPDATE');

      if (isDraftEvent || isMeasurementEvent) {
        
        let customerName = patch.customerName || patch.name;
        let customerPhone = patch.customerPhone || patch.phone;
        let customerAddress = patch.customerAddress || patch.address;

        const suggested = suggestCustomers({ customerName, customerPhone }, allLocalCustomers);
        
        const inbound: InboundMeasurement = {
          changeId: change.change_id,
          revision: change.revision,
          entityType: change.entity_type,
          entityId: change.entity_id,
          operation: change.operation,
          sourceTable: change.sourceTable,
          customerName: customerName,
          customerPhone: customerPhone,
          customerAddress: customerAddress,
          patch: patch,
          senderId: change.user_id,
          createdAt: new Date().toISOString(),
          status: 'NEW',
          suggestedCustomerIds: suggested.map(s => s.id)
        };

        // Don't import our own changes back into the pool to avoid echo
        if (change.device_id !== 'local-device') { // In real app, compare with actual device ID
            await saveInboundMeasurement(inbound);
        }
      }
    }

    if (maxDraftRevision > draftCursor) {
      await setSyncCursor('draft_changes_cursor', maxDraftRevision);
    }
    if (maxMeasurementRevision > measurementCursor) {
      await setSyncCursor('measurement_changes_cursor', maxMeasurementRevision);
    }

    return { success: true, fetchedCount: changes.length, errors: [] };

  } catch (err: any) {
    console.error('[DeltaSyncClient] Pull failed:', err);
    return { success: false, fetchedCount: 0, errors: [err.message] };
  }
}

// Basic fuzzy matching
export function suggestCustomers(patch: any, localCustomers: any[]): any[] {
  const suggestions: any[] = [];
  if (!patch.customerName && !patch.customerPhone) return suggestions;

  const phone = (patch.customerPhone || '').replace(/\D/g, '');
  const name = (patch.customerName || '').toLowerCase().trim();

  for (const c of localCustomers) {
    if (c.isDeleted) continue;
    
    const cPhone = (c.phone || '').replace(/\D/g, '');
    const cName = (c.name || '').toLowerCase().trim();

    let score = 0;
    
    if (phone && cPhone && cPhone === phone) {
      score += 100; // Exact phone match is very strong
    }
    
    if (name && cName) {
      if (cName === name) score += 50;
      else if (cName.includes(name) || name.includes(cName)) score += 20;
    }

    if (score > 0) {
      suggestions.push({ id: c.id, score });
    }
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, 3);
}
