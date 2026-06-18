import { supabase } from './supabaseClient';
import { useStore, Customer, Room, WindowItem, ProductMeasurement } from '@/store/useStore';
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
    // 1. Sync Users
    await syncUsers(authStore);

    // 2. Sync Customers, Rooms, Openings, and Measurements
    await syncCoreData(store);

    store.setSyncStatus('synced');
  } catch (error) {
    console.error('Sync error:', error);
    store.setSyncStatus('pending');
  } finally {
    isSyncing = false;
  }
}

async function syncUsers(authStore: any) {
  const localUsers = authStore.users || [];
  
  // Pull users from Supabase
  const { data: remoteUsers, error: pullError } = await supabase
    .from('users')
    .select('*');

  if (pullError) {
    console.error('Failed to pull users:', pullError);
    return;
  }

  const mergedUsersMap = new Map<string, any>();

  // Add all local users
  localUsers.forEach((u: any) => mergedUsersMap.set(u.id, u));

  // Merge remote users (latest updatedAt wins)
  remoteUsers?.forEach((remote: any) => {
    const local = mergedUsersMap.get(remote.id);
    if (!local || new Date(remote.updatedAt) > new Date(local.updatedAt)) {
      mergedUsersMap.set(remote.id, {
        id: remote.id,
        name: remote.name,
        username: remote.username,
        password: remote.password,
        role: remote.role,
        isActive: remote.isActive,
        permissions: remote.permissions,
        createdAt: remote.createdAt,
        updatedAt: remote.updatedAt
      });
    }
  });

  const finalUsers = Array.from(mergedUsersMap.values());
  useAuthStore.setState({ users: finalUsers });

  // Push local users that are newer to Supabase
  for (const u of finalUsers) {
    const remote = remoteUsers?.find(r => r.id === u.id);
    if (!remote || new Date(u.updatedAt) > new Date(remote.updatedAt)) {
      const { error: pushError } = await supabase
        .from('users')
        .upsert({
          id: u.id,
          name: u.name,
          username: u.username,
          password: u.password,
          role: u.role,
          isActive: u.isActive,
          permissions: u.permissions,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt
        });
      if (pushError) {
        console.error('Failed to push user to Supabase:', u.id, pushError);
      }
    }
  }
}

async function syncCoreData(store: any) {
  const localCustomers = store.customers || [];
  const pendingDeletes = store.pendingDeletes || [];

  // 1. Process deletes first
  const failedDeletes: typeof pendingDeletes = [];
  for (const del of pendingDeletes) {
    const { error } = await supabase
      .from(del.table)
      .delete()
      .eq('id', del.id);
    if (error) {
      console.error(`Failed to delete from ${del.table} on Supabase:`, del.id, error);
      failedDeletes.push(del);
    }
  }
  useStore.setState({ pendingDeletes: failedDeletes });

  // 2. Pull all entities from Supabase
  const { data: remoteCustomers, error: custError } = await supabase.from('customers').select('*');
  const { data: remoteRooms, error: roomsError } = await supabase.from('rooms').select('*');
  const { data: remoteOpenings, error: openingsError } = await supabase.from('openings').select('*');
  const { data: remoteMeasurements, error: measError } = await supabase.from('measurements').select('*');

  if (custError) throw custError;
  if (roomsError) throw roomsError;
  if (openingsError) throw openingsError;
  if (measError) throw measError;

  // Group remote data for easier lookup
  const roomsByCustomer = new Map<string, any[]>();
  remoteRooms?.forEach(r => {
    const arr = roomsByCustomer.get(r.customerId) || [];
    arr.push(r);
    roomsByCustomer.set(r.customerId, arr);
  });

  const openingsByRoom = new Map<string, any[]>();
  remoteOpenings?.forEach(o => {
    const arr = openingsByRoom.get(o.roomId) || [];
    arr.push(o);
    openingsByRoom.set(o.roomId, arr);
  });

  const measurementsByOpening = new Map<string, any[]>();
  remoteMeasurements?.forEach(m => {
    const arr = measurementsByOpening.get(m.openingId) || [];
    arr.push(m);
    measurementsByOpening.set(m.openingId, arr);
  });

  // 3. Merge Customers
  const mergedCustomersMap = new Map<string, any>();

  // Add all local customers
  localCustomers.forEach((c: any) => {
    mergedCustomersMap.set(c.id, { ...c });
  });

  // Merge remote customers
  remoteCustomers?.forEach((remote: any) => {
    const local = mergedCustomersMap.get(remote.id);
    if (!local) {
      mergedCustomersMap.set(remote.id, {
        id: remote.id,
        name: remote.name,
        phone: remote.phone || '',
        address: remote.address || '',
        mapLocation: remote.mapLocation || '',
        notes: remote.notes || '',
        createdAt: remote.createdAt,
        updatedAt: remote.updatedAt,
        rooms: []
      });
    } else if (new Date(remote.updatedAt) > new Date(local.updatedAt || 0)) {
      mergedCustomersMap.set(remote.id, {
        ...local,
        name: remote.name,
        phone: remote.phone || '',
        address: remote.address || '',
        mapLocation: remote.mapLocation || '',
        notes: remote.notes || '',
        createdAt: remote.createdAt,
        updatedAt: remote.updatedAt
      });
    }
  });

  const finalCustomers = Array.from(mergedCustomersMap.values());

  // 4. Merge Rooms, Openings, and Measurements
  for (const c of finalCustomers) {
    const localRooms = c.rooms || [];
    const dbRooms = roomsByCustomer.get(c.id) || [];

    const mergedRoomsMap = new Map<string, any>();
    localRooms.forEach((lr: any) => mergedRoomsMap.set(lr.id, lr));

    dbRooms.forEach((dr: any) => {
      const lr = mergedRoomsMap.get(dr.id);
      if (!lr) {
        mergedRoomsMap.set(dr.id, {
          id: dr.id,
          name: dr.name,
          photos: dr.photos || [],
          videos: dr.videos || [],
          windows: [],
          createdAt: dr.createdAt,
          updatedAt: dr.updatedAt
        });
      } else if (new Date(dr.updatedAt) > new Date(lr.updatedAt || 0)) {
        mergedRoomsMap.set(dr.id, {
          ...lr,
          name: dr.name,
          photos: dr.photos || [],
          videos: dr.videos || [],
          createdAt: dr.createdAt,
          updatedAt: dr.updatedAt
        });
      }
    });

    const mergedRoomsList = Array.from(mergedRoomsMap.values());

    for (const r of mergedRoomsList) {
      const localOpenings = r.windows || [];
      const dbOpenings = openingsByRoom.get(r.id) || [];

      const mergedOpeningsMap = new Map<string, any>();
      localOpenings.forEach((lo: any) => mergedOpeningsMap.set(lo.id, lo));

      dbOpenings.forEach((do_: any) => {
        const lo = mergedOpeningsMap.get(do_.id);
        if (!lo) {
          mergedOpeningsMap.set(do_.id, {
            id: do_.id,
            name: do_.name,
            width: do_.width || undefined,
            height: do_.height || undefined,
            fieldNotes: do_.fieldNotes || '',
            photos: do_.photos || [],
            videos: do_.videos || [],
            products: [],
            createdAt: do_.createdAt,
            updatedAt: do_.updatedAt
          });
        } else if (new Date(do_.updatedAt) > new Date(lo.updatedAt || 0)) {
          mergedOpeningsMap.set(do_.id, {
            ...lo,
            name: do_.name,
            width: do_.width || undefined,
            height: do_.height || undefined,
            fieldNotes: do_.fieldNotes || '',
            photos: do_.photos || [],
            videos: do_.videos || [],
            createdAt: do_.createdAt,
            updatedAt: do_.updatedAt
          });
        }
      });

      const mergedOpeningsList = Array.from(mergedOpeningsMap.values());

      for (const o of mergedOpeningsList) {
        const localMeasurements = o.products || [];
        const dbMeasurements = measurementsByOpening.get(o.id) || [];

        const mergedMeasurementsMap = new Map<string, any>();
        localMeasurements.forEach((lm: any) => mergedMeasurementsMap.set(lm.id, lm));

        dbMeasurements.forEach((dm: any) => {
          const lm = mergedMeasurementsMap.get(dm.id);
          const normalizedMeasuredDate = dm.measuredDate ? new Date(dm.measuredDate).toISOString() : new Date().toISOString();

          if (!lm) {
            mergedMeasurementsMap.set(dm.id, {
              id: dm.id,
              templateType: dm.templateType,
              rawValues: dm.rawValues || {},
              productId: dm.productId || undefined,
              productGroup: dm.productGroup || undefined,
              productType: dm.productType || undefined,
              calculatedWidth: dm.calculatedWidth || undefined,
              calculatedHeight: dm.calculatedHeight || undefined,
              details: dm.details || {},
              notes: dm.notes || '',
              status: dm.status || '',
              measuredBy: dm.measuredBy || '',
              measuredById: dm.measuredById || undefined,
              createdById: dm.createdById || undefined,
              measuredDate: normalizedMeasuredDate,
              notesHistory: dm.notesHistory || [],
              photos: dm.photos || [],
              videos: dm.videos || [],
              createdAt: dm.createdAt,
              updatedAt: dm.updatedAt
            });
          } else if (new Date(dm.updatedAt) > new Date(lm.updatedAt || 0)) {
            mergedMeasurementsMap.set(dm.id, {
              ...lm,
              templateType: dm.templateType,
              rawValues: dm.rawValues || {},
              productId: dm.productId || undefined,
              productGroup: dm.productGroup || undefined,
              productType: dm.productType || undefined,
              calculatedWidth: dm.calculatedWidth || undefined,
              calculatedHeight: dm.calculatedHeight || undefined,
              details: dm.details || {},
              notes: dm.notes || '',
              status: dm.status || '',
              measuredBy: dm.measuredBy || '',
              measuredById: dm.measuredById || undefined,
              createdById: dm.createdById || undefined,
              measuredDate: normalizedMeasuredDate,
              notesHistory: dm.notesHistory || [],
              photos: dm.photos || [],
              videos: dm.videos || [],
              createdAt: dm.createdAt,
              updatedAt: dm.updatedAt
            });
          }
        });

        o.products = Array.from(mergedMeasurementsMap.values());
      }

      r.windows = mergedOpeningsList;
    }

    c.rooms = mergedRoomsList;
  }

  // Update Zustand local store with merged data
  store.setCustomers(finalCustomers);

  // 5. Push local modifications to Supabase
  for (const c of finalCustomers) {
    // Customer basic details
    const dbCustomer = remoteCustomers?.find(dc => dc.id === c.id);
    if (!dbCustomer || new Date(c.updatedAt || 0) > new Date(dbCustomer.updatedAt)) {
      const { error } = await supabase
        .from('customers')
        .upsert({
          id: c.id,
          name: c.name,
          phone: c.phone,
          address: c.address,
          mapLocation: c.mapLocation,
          notes: c.notes,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt
        });
      if (error) console.error('Failed to push customer:', c.id, error);
    }

    // Customer Rooms
    for (const r of c.rooms) {
      const dbRoom = remoteRooms?.find(dr => dr.id === r.id);
      if (!dbRoom || new Date(r.updatedAt || 0) > new Date(dbRoom.updatedAt)) {
        const { error } = await supabase
          .from('rooms')
          .upsert({
            id: r.id,
            name: r.name,
            customerId: c.id,
            photos: r.photos || [],
            videos: r.videos || [],
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
          });
        if (error) console.error('Failed to push room:', r.id, error);
      }

      // Room Openings
      for (const o of r.windows) {
        const dbOpening = remoteOpenings?.find(do_ => do_.id === o.id);
        if (!dbOpening || new Date(o.updatedAt || 0) > new Date(dbOpening.updatedAt)) {
          const { error } = await supabase
            .from('openings')
            .upsert({
              id: o.id,
              name: o.name,
              roomId: r.id,
              width: o.width || null,
              height: o.height || null,
              fieldNotes: o.fieldNotes || '',
              photos: o.photos || [],
              videos: o.videos || [],
              createdAt: o.createdAt,
              updatedAt: o.updatedAt
            });
          if (error) console.error('Failed to push opening:', o.id, error);
        }

        // Opening Measurements
        for (const m of o.products) {
          const dbMeasurement = remoteMeasurements?.find(dm => dm.id === m.id);
          if (!dbMeasurement || new Date(m.updatedAt || 0) > new Date(dbMeasurement.updatedAt)) {
            const { error } = await supabase
              .from('measurements')
              .upsert({
                id: m.id,
                openingId: o.id,
                templateType: m.templateType,
                rawValues: m.rawValues || {},
                productId: m.productId || null,
                productGroup: m.productGroup || null,
                productType: m.productType || null,
                calculatedWidth: m.calculatedWidth || null,
                calculatedHeight: m.calculatedHeight || null,
                details: m.details || {},
                notes: m.notes || '',
                status: m.status || '',
                measuredBy: m.measuredBy || '',
                measuredById: m.measuredById || null,
                createdById: m.createdById || null,
                measuredDate: m.measuredDate || new Date().toISOString(),
                createdAt: m.createdAt,
                updatedAt: m.updatedAt,
                notesHistory: m.notesHistory || [],
                photos: m.photos || [],
                videos: m.videos || []
              });
            if (error) console.error('Failed to push measurement:', m.id, error);
          }
        }
      }
    }
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
