import type {
  FieldTask
} from "@/lib/localFieldTaskDb";

import {
  saveLocalCustomers
} from "@/lib/localCustomerDb";

import {
  type Customer,
  useStore
} from "@/store/useStore";

import {
  type MeasurementRecord,
  useMeasurementStore
} from "@/store/measurementStore";

interface TaskCustomerSnapshot {
  customer?: Customer;
  measurements?: MeasurementRecord[];
}

export async function ensureFieldTaskCustomer(
  task: FieldTask,
  _sessionToken?: string
): Promise<{
  customer: Customer;
  roomCount: number;
  openingCount: number;
  measurementCount: number;
}> {
  const snapshot =
    task.customerSnapshot as
      | TaskCustomerSnapshot
      | undefined;

  if (!snapshot?.customer) {
    throw new Error(
      "Bu eski görevde cari ölçü paketi yok. Görevi yeniden atayın."
    );
  }

  const customer: Customer = {
    ...snapshot.customer,

    id: task.customerId,

    name:
      snapshot.customer.name ||
      task.customerName ||
      "İsimsiz Cari",

    phone:
      snapshot.customer.phone ||
      task.customerPhone ||
      "",

    address:
      snapshot.customer.address ||
      task.customerAddress ||
      "",

    mapLocation:
      snapshot.customer.mapLocation ||
      task.mapLocation ||
      "",

    notes:
      snapshot.customer.notes || "",

    rooms:
      Array.isArray(snapshot.customer.rooms)
        ? snapshot.customer.rooms
        : [],

    assignedMeasureId:
      task.assignedUserId,

    assignedMeasureName:
      task.assignedUserName
  };

  await saveLocalCustomers([customer]);

  useStore.setState(state => {
    const exists =
      state.customers.some(
        item => item.id === customer.id
      );

    return {
      customers: exists
        ? state.customers.map(item =>
            item.id === customer.id
              ? customer
              : item
          )
        : [customer, ...state.customers]
    };
  });

  const measurements =
    Array.isArray(snapshot.measurements)
      ? snapshot.measurements
      : [];

  if (measurements.length > 0) {
    await useMeasurementStore
      .getState()
      .batchUpsertMeasurements(
        measurements
      );
  }

  const roomCount =
    customer.rooms.length;

  const openingCount =
    customer.rooms.reduce(
      (total, room) =>
        total +
        (room.windows?.length || 0),
      0
    );

  return {
    customer,
    roomCount,
    openingCount,
    measurementCount:
      measurements.length
  };
}
