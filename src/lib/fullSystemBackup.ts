import type Dexie from "dexie";

import { localCustomerDb } from "@/lib/localCustomerDb";
import { localDraftDb } from "@/lib/localDraftDb";
import { localFieldTaskDb } from "@/lib/localFieldTaskDb";
import { localMeasurementDb } from "@/lib/localMeasurementDb";
import { localSalesDb } from "@/lib/localSalesDb";
import { localSyncQueueDb } from "@/lib/localSyncQueueDb";
import { saleDueNotificationDb } from "@/lib/saleDueNotificationDb";

export const FULL_SYSTEM_BACKUP_VERSION =
  "ceylin-full-system-v1" as const;

type JsonRecord =
  Record<string, unknown>;

interface SerializedBinaryValue {
  __ceylinBinaryType:
    | "Blob"
    | "File"
    | "ArrayBuffer"
    | "TypedArray";
  mimeType?: string;
  fileName?: string;
  lastModified?: number;
  constructorName?: string;
  byteLength: number;
  base64: string;
}

export interface FullSystemBackupTable {
  name: string;
  primaryKey: string;
  rowCount: number;
  rows: unknown[];
}

export interface FullSystemBackupDatabase {
  name: string;
  tables: FullSystemBackupTable[];
}

export interface FullSystemBackupManifest {
  databaseCount: number;
  tableCount: number;
  indexedDbRowCount: number;
  localStorageKeyCount: number;
  omittedSensitiveLocalStorageKeys: string[];
}

export interface FullSystemBackupPayload {
  version:
    typeof FULL_SYSTEM_BACKUP_VERSION;
  exportedAt: string;
  application: "CEYLİN ERP";
  manifest: FullSystemBackupManifest;
  localStorage: Record<string, string>;
  indexedDb: FullSystemBackupDatabase[];
  checksumAlgorithm: "SHA-256";
  checksum: string;
}

export interface RestoreResult {
  restoredDatabaseCount: number;
  restoredTableCount: number;
  restoredIndexedDbRowCount: number;
  restoredLocalStorageKeyCount: number;
}

interface RegisteredDatabase {
  name: string;
  database: Dexie;
}

const REGISTERED_DATABASES:
  RegisteredDatabase[] = [
    {
      name: "CeylinLocalCustomerDb",
      database: localCustomerDb,
    },
    {
      name: "CeylinLocalDraftDb",
      database: localDraftDb,
    },
    {
      name: "CeylinFieldTaskDb",
      database: localFieldTaskDb,
    },
    {
      name: "CeylinLocalMeasurementDb",
      database: localMeasurementDb,
    },
    {
      name: "CeylinLocalSalesDb",
      database: localSalesDb,
    },
    {
      name: "CeylinLocalSyncQueueDb",
      database: localSyncQueueDb,
    },
    {
      name: "CeylinSaleDueNotificationDb",
      database: saleDueNotificationDb,
    },
  ];

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|jwt|credential|authorization|session|authversion)/i;

const SENSITIVE_NESTED_FIELD_PATTERN =
  /^(password|passwd|secret|token|jwt|credential|authorization|sessiontoken|sessionexpiresat|rememberme|authversion)$/i;

function assertBrowser(): void {
  if (
    typeof window === "undefined" ||
    typeof localStorage === "undefined"
  ) {
    throw new Error(
      "Tam sistem yedeği yalnız tarayıcıda çalıştırılabilir.",
    );
  }
}

function isPlainObject(
  value: unknown,
): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function bytesToBase64(
  bytes: Uint8Array,
): string {
  let binary = "";

  const chunkSize = 0x8000;

  for (
    let index = 0;
    index < bytes.length;
    index += chunkSize
  ) {
    const chunk =
      bytes.subarray(
        index,
        Math.min(
          index + chunkSize,
          bytes.length,
        ),
      );

    binary +=
      String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function base64ToBytes(
  base64: string,
): Uint8Array<ArrayBuffer> {
  const binary =
    atob(base64);

  const buffer =
    new ArrayBuffer(
      binary.length,
    );

  const bytes =
    new Uint8Array(buffer);

  for (
    let index = 0;
    index < binary.length;
    index++
  ) {
    bytes[index] =
      binary.charCodeAt(index);
  }

  return bytes;
}

function copyBytesToArrayBuffer(
  bytes: Uint8Array,
): ArrayBuffer {
  const buffer =
    new ArrayBuffer(
      bytes.byteLength,
    );

  new Uint8Array(buffer).set(
    bytes,
  );

  return buffer;
}

async function serializeBackupValue(
  value: unknown,
): Promise<unknown> {
  if (
    typeof Blob !== "undefined" &&
    value instanceof Blob
  ) {
    const bytes =
      new Uint8Array(
        await value.arrayBuffer(),
      );

    const serialized:
      SerializedBinaryValue = {
        __ceylinBinaryType:
          typeof File !== "undefined" &&
          value instanceof File
            ? "File"
            : "Blob",
        mimeType:
          value.type || undefined,
        byteLength:
          bytes.byteLength,
        base64:
          bytesToBase64(bytes),
      };

    if (
      typeof File !== "undefined" &&
      value instanceof File
    ) {
      serialized.fileName =
        value.name;

      serialized.lastModified =
        value.lastModified;
    }

    return serialized;
  }

  if (
    value instanceof ArrayBuffer
  ) {
    const bytes =
      new Uint8Array(value);

    return {
      __ceylinBinaryType:
        "ArrayBuffer",
      byteLength:
        bytes.byteLength,
      base64:
        bytesToBase64(bytes),
    } satisfies SerializedBinaryValue;
  }

  if (
    ArrayBuffer.isView(value)
  ) {
    const bytes =
      new Uint8Array(
        value.buffer,
        value.byteOffset,
        value.byteLength,
      );

    return {
      __ceylinBinaryType:
        "TypedArray",
      constructorName:
        value.constructor.name,
      byteLength:
        bytes.byteLength,
      base64:
        bytesToBase64(bytes),
    } satisfies SerializedBinaryValue;
  }

  if (Array.isArray(value)) {
    return Promise.all(
      value.map(item =>
        serializeBackupValue(item),
      ),
    );
  }

  if (isPlainObject(value)) {
    const result:
      JsonRecord = {};

    for (
      const [
        key,
        nestedValue,
      ] of Object.entries(value)
    ) {
      result[key] =
        await serializeBackupValue(
          nestedValue,
        );
    }

    return result;
  }

  return value;
}

function isSerializedBinaryValue(
  value: unknown,
): value is SerializedBinaryValue {
  return (
    isPlainObject(value) &&
    typeof value.__ceylinBinaryType ===
      "string" &&
    typeof value.byteLength ===
      "number" &&
    typeof value.base64 ===
      "string"
  );
}

function typedArrayConstructor(
  name: string | undefined,
):
  | typeof Uint8Array
  | typeof Uint8ClampedArray
  | typeof Int8Array
  | typeof Uint16Array
  | typeof Int16Array
  | typeof Uint32Array
  | typeof Int32Array
  | typeof Float32Array
  | typeof Float64Array {
  const constructors = {
    Uint8Array,
    Uint8ClampedArray,
    Int8Array,
    Uint16Array,
    Int16Array,
    Uint32Array,
    Int32Array,
    Float32Array,
    Float64Array,
  };

  return (
    constructors[
      name as keyof typeof constructors
    ] || Uint8Array
  );
}

async function deserializeBackupValue(
  value: unknown,
): Promise<unknown> {
  if (isSerializedBinaryValue(value)) {
    const bytes =
      base64ToBytes(
        value.base64,
      );

    if (
      bytes.byteLength !==
      value.byteLength
    ) {
      throw new Error(
        "Binary medya boyutu yedek manifestiyle uyuşmuyor.",
      );
    }

    const arrayBuffer =
      copyBytesToArrayBuffer(
        bytes,
      );

    if (
      value.__ceylinBinaryType ===
      "Blob"
    ) {
      return new Blob(
        [arrayBuffer],
        {
          type:
            value.mimeType || "",
        },
      );
    }

    if (
      value.__ceylinBinaryType ===
      "File"
    ) {
      return new File(
        [arrayBuffer],
        value.fileName ||
          "restored-file",
        {
          type:
            value.mimeType || "",
          lastModified:
            value.lastModified ||
            Date.now(),
        },
      );
    }

    if (
      value.__ceylinBinaryType ===
      "ArrayBuffer"
    ) {
      return arrayBuffer;
    }

    const Constructor =
      typedArrayConstructor(
        value.constructorName,
      );

    return new Constructor(
      arrayBuffer,
    );
  }

  if (Array.isArray(value)) {
    return Promise.all(
      value.map(item =>
        deserializeBackupValue(item),
      ),
    );
  }

  if (isPlainObject(value)) {
    const result:
      JsonRecord = {};

    for (
      const [
        key,
        nestedValue,
      ] of Object.entries(value)
    ) {
      result[key] =
        await deserializeBackupValue(
          nestedValue,
        );
    }

    return result;
  }

  return value;
}

function sanitizeNestedSensitiveData(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(item =>
      sanitizeNestedSensitiveData(item),
    );
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const result:
    JsonRecord = {};

  for (
    const [
      key,
      nestedValue,
    ] of Object.entries(value)
  ) {
    if (
      SENSITIVE_NESTED_FIELD_PATTERN.test(
        key,
      )
    ) {
      continue;
    }

    result[key] =
      sanitizeNestedSensitiveData(
        nestedValue,
      );
  }

  return result;
}

function sanitizeLocalStorageValue(
  key: string,
  value: string,
): string | null {
  if (
    SENSITIVE_KEY_PATTERN.test(key)
  ) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(value);

    return JSON.stringify(
      sanitizeNestedSensitiveData(
        parsed,
      ),
    );
  } catch {
    return value;
  }
}

function compareStableKeys(
  left: string,
  right: string,
): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function stableStringify(
  value: unknown,
): string {
  if (Array.isArray(value)) {
    return `[${value
      .map(item => stableStringify(item))
      .join(",")}]`;
  }

  if (isPlainObject(value)) {
    const entries = Object.keys(value)
      .sort(compareStableKeys)
      .map(
        key =>
          `${JSON.stringify(key)}:${stableStringify(
            value[key],
          )}`,
      );

    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
}

async function sha256Hex(
  value: string,
): Promise<string> {
  const bytes =
    new TextEncoder().encode(value);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      bytes,
    );

  return Array.from(
    new Uint8Array(digest),
  )
    .map(byte =>
      byte.toString(16).padStart(2, "0"),
    )
    .join("");
}

function withoutChecksum(
  payload: Omit<
    FullSystemBackupPayload,
    "checksum"
  > | FullSystemBackupPayload,
): Omit<
  FullSystemBackupPayload,
  "checksum"
> {
  const content = Object.fromEntries(
    Object.entries(payload).filter(
      ([key]) => key !== "checksum",
    ),
  );

  return content as Omit<
    FullSystemBackupPayload,
    "checksum"
  >;
}

function normalizeForChecksum(
  value: unknown,
): unknown {
  const serialized =
    JSON.stringify(value);

  if (serialized === undefined) {
    throw new Error(
      "Checksum girdisi JSON biçimine dönüştürülemedi.",
    );
  }

  return JSON.parse(
    serialized,
  ) as unknown;
}

async function calculateChecksum(
  payload: Omit<
    FullSystemBackupPayload,
    "checksum"
  > | FullSystemBackupPayload,
): Promise<string> {
  const normalized =
    normalizeForChecksum(
      withoutChecksum(payload),
    );

  return sha256Hex(
    stableStringify(
      normalized,
    ),
  );
}

function getPrimaryKeyName(
  table: Dexie.Table,
): string {
  const keyPath =
    table.schema.primKey.keyPath;

  if (typeof keyPath === "string") {
    return keyPath;
  }

  if (Array.isArray(keyPath)) {
    return keyPath.join("+");
  }

  return "id";
}

function collectLocalStorage(): {
  values: Record<string, string>;
  omittedSensitiveKeys: string[];
} {
  const values:
    Record<string, string> = {};

  const omittedSensitiveKeys:
    string[] = [];

  for (
    let index = 0;
    index < localStorage.length;
    index++
  ) {
    const key =
      localStorage.key(index);

    if (!key) {
      continue;
    }

    if (SENSITIVE_KEY_PATTERN.test(key)) {
      omittedSensitiveKeys.push(key);
      continue;
    }

    const value =
      localStorage.getItem(key);

    if (value === null) {
      continue;
    }

    const sanitizedValue =
      sanitizeLocalStorageValue(
        key,
        value,
      );

    if (sanitizedValue === null) {
      omittedSensitiveKeys.push(key);
      continue;
    }

    values[key] =
      sanitizedValue;
  }

  omittedSensitiveKeys.sort();

  return {
    values,
    omittedSensitiveKeys,
  };
}

async function exportDatabases():
  Promise<FullSystemBackupDatabase[]> {
  const result:
    FullSystemBackupDatabase[] = [];

  for (
    const registered of
    REGISTERED_DATABASES
  ) {
    await registered.database.open();

    const tables:
      FullSystemBackupTable[] = [];

    for (
      const table of
      registered.database.tables
    ) {
      const rows =
        await table.toArray();

      const serializedRows =
        await Promise.all(
          rows.map(row =>
            serializeBackupValue(row),
          ),
        );

      tables.push({
        name: table.name,
        primaryKey:
          getPrimaryKeyName(table),
        rowCount:
          serializedRows.length,
        rows:
          serializedRows,
      });
    }

    result.push({
      name: registered.name,
      tables,
    });
  }

  return result;
}

function buildManifest(
  localStorageValues:
    Record<string, string>,
  omittedSensitiveKeys: string[],
  indexedDb:
    FullSystemBackupDatabase[],
): FullSystemBackupManifest {
  const tableCount =
    indexedDb.reduce(
      (total, database) =>
        total +
        database.tables.length,
      0,
    );

  const indexedDbRowCount =
    indexedDb.reduce(
      (databaseTotal, database) =>
        databaseTotal +
        database.tables.reduce(
          (tableTotal, table) =>
            tableTotal +
            table.rows.length,
          0,
        ),
      0,
    );

  return {
    databaseCount:
      indexedDb.length,
    tableCount,
    indexedDbRowCount,
    localStorageKeyCount:
      Object.keys(
        localStorageValues,
      ).length,
    omittedSensitiveLocalStorageKeys:
      omittedSensitiveKeys,
  };
}

export async function createFullSystemBackup():
  Promise<FullSystemBackupPayload> {
  assertBrowser();

  const {
    values,
    omittedSensitiveKeys,
  } = collectLocalStorage();

  const indexedDb =
    await exportDatabases();

  const unsignedPayload:
    Omit<
      FullSystemBackupPayload,
      "checksum"
    > = {
      version:
        FULL_SYSTEM_BACKUP_VERSION,
      exportedAt:
        new Date().toISOString(),
      application: "CEYLİN ERP",
      manifest: buildManifest(
        values,
        omittedSensitiveKeys,
        indexedDb,
      ),
      localStorage: values,
      indexedDb,
      checksumAlgorithm: "SHA-256",
    };

  const checksum =
    await calculateChecksum(
      unsignedPayload,
    );

  return {
    ...unsignedPayload,
    checksum,
  };
}

function assertStringRecord(
  value: unknown,
  label: string,
): asserts value is Record<
  string,
  string
> {
  if (!isPlainObject(value)) {
    throw new Error(
      `${label} nesne değil.`,
    );
  }

  for (
    const [
      key,
      nestedValue,
    ] of Object.entries(value)
  ) {
    if (
      typeof key !== "string" ||
      typeof nestedValue !== "string"
    ) {
      throw new Error(
        `${label} içinde geçersiz değer var.`,
      );
    }
  }
}

function assertBackupStructure(
  value: unknown,
): asserts value is FullSystemBackupPayload {
  if (!isPlainObject(value)) {
    throw new Error(
      "Yedek dosyası nesne değil.",
    );
  }

  if (
    value.version !==
    FULL_SYSTEM_BACKUP_VERSION
  ) {
    throw new Error(
      "Yedek sürümü desteklenmiyor.",
    );
  }

  if (
    value.application !== "CEYLİN ERP"
  ) {
    throw new Error(
      "Yedek başka bir uygulamaya ait.",
    );
  }

  if (
    value.checksumAlgorithm !==
      "SHA-256" ||
    typeof value.checksum !== "string" ||
    value.checksum.length !== 64
  ) {
    throw new Error(
      "Yedek bütünlük bilgisi geçersiz.",
    );
  }

  assertStringRecord(
    value.localStorage,
    "localStorage",
  );

  if (!Array.isArray(value.indexedDb)) {
    throw new Error(
      "IndexedDB yedek bölümü eksik.",
    );
  }

  if (!isPlainObject(value.manifest)) {
    throw new Error(
      "Yedek manifesti eksik.",
    );
  }

  for (
    const database of
    value.indexedDb
  ) {
    if (
      !isPlainObject(database) ||
      typeof database.name !==
        "string" ||
      !Array.isArray(database.tables)
    ) {
      throw new Error(
        "Geçersiz IndexedDB veritabanı kaydı.",
      );
    }

    for (
      const table of database.tables
    ) {
      if (
        !isPlainObject(table) ||
        typeof table.name !== "string" ||
        typeof table.primaryKey !==
          "string" ||
        typeof table.rowCount !==
          "number" ||
        !Array.isArray(table.rows) ||
        table.rowCount !==
          table.rows.length
      ) {
        throw new Error(
          "Geçersiz IndexedDB tablo kaydı.",
        );
      }
    }
  }
}

function databaseMap():
  Map<string, Dexie> {
  return new Map(
    REGISTERED_DATABASES.map(
      item => [
        item.name,
        item.database,
      ],
    ),
  );
}

export async function validateFullSystemBackup(
  value: unknown,
): Promise<FullSystemBackupPayload> {
  assertBrowser();
  assertBackupStructure(value);

  const calculatedChecksum =
    await calculateChecksum(value);

  if (
    calculatedChecksum !==
    value.checksum
  ) {
    throw new Error(
      "Yedek dosyasının SHA-256 bütünlük doğrulaması başarısız.",
    );
  }

  const registered =
    databaseMap();

  const backupDatabaseNames =
    new Set(
      value.indexedDb.map(
        database => database.name,
      ),
    );

  for (
    const expected of
    REGISTERED_DATABASES
  ) {
    if (
      !backupDatabaseNames.has(
        expected.name,
      )
    ) {
      throw new Error(
        `Zorunlu veritabanı yedekte yok: ${expected.name}`,
      );
    }
  }

  for (
    const databaseBackup of
    value.indexedDb
  ) {
    const database =
      registered.get(
        databaseBackup.name,
      );

    if (!database) {
      throw new Error(
        `Bilinmeyen veritabanı: ${databaseBackup.name}`,
      );
    }

    await database.open();

    const actualTables =
      new Map(
        database.tables.map(
          table => [
            table.name,
            table,
          ],
        ),
      );

    for (
      const tableBackup of
      databaseBackup.tables
    ) {
      const actualTable =
        actualTables.get(
          tableBackup.name,
        );

      if (!actualTable) {
        throw new Error(
          `Yedekteki tablo uygulamada bulunamadı: ${databaseBackup.name}.${tableBackup.name}`,
        );
      }

      const primaryKey =
        getPrimaryKeyName(
          actualTable,
        );

      if (
        primaryKey !==
        tableBackup.primaryKey
      ) {
        throw new Error(
          `Tablo anahtarı uyuşmuyor: ${databaseBackup.name}.${tableBackup.name}`,
        );
      }
    }
  }

  const expectedTableCount =
    value.indexedDb.reduce(
      (total, database) =>
        total +
        database.tables.length,
      0,
    );

  const expectedRowCount =
    value.indexedDb.reduce(
      (databaseTotal, database) =>
        databaseTotal +
        database.tables.reduce(
          (tableTotal, table) =>
            tableTotal +
            table.rows.length,
          0,
        ),
      0,
    );

  if (
    value.manifest.databaseCount !==
      value.indexedDb.length ||
    value.manifest.tableCount !==
      expectedTableCount ||
    value.manifest.indexedDbRowCount !==
      expectedRowCount ||
    value.manifest.localStorageKeyCount !==
      Object.keys(
        value.localStorage,
      ).length
  ) {
    throw new Error(
      "Yedek manifestindeki sayılar içerikle uyuşmuyor.",
    );
  }

  return value;
}

async function restoreDatabase(
  databaseBackup:
    FullSystemBackupDatabase,
): Promise<{
  tableCount: number;
  rowCount: number;
}> {
  const database =
    databaseMap().get(
      databaseBackup.name,
    );

  if (!database) {
    throw new Error(
      `Veritabanı kayıtlı değil: ${databaseBackup.name}`,
    );
  }

  await database.open();

  const tableNames =
    databaseBackup.tables.map(
      table => table.name,
    );

  const tables =
    tableNames.map(name =>
      database.table(name),
    );

  let rowCount = 0;

  await database.transaction(
    "rw",
    tables,
    async () => {
      for (
        const tableBackup of
        databaseBackup.tables
      ) {
        const table =
          database.table(
            tableBackup.name,
          );

        await table.clear();

        if (
          tableBackup.rows.length > 0
        ) {
          const restoredRows =
            await Promise.all(
              tableBackup.rows.map(
                row =>
                  deserializeBackupValue(
                    row,
                  ),
              ),
            );

          await table.bulkPut(
            restoredRows,
          );
        }

        rowCount +=
          tableBackup.rows.length;
      }
    },
  );

  return {
    tableCount:
      databaseBackup.tables.length,
    rowCount,
  };
}

function findBackupDatabase(
  payload: FullSystemBackupPayload,
  databaseName: string,
): FullSystemBackupDatabase | undefined {
  return payload.indexedDb.find(
    database =>
      database.name === databaseName,
  );
}

function findBackupTable(
  payload: FullSystemBackupPayload,
  databaseName: string,
  tableName: string,
): FullSystemBackupTable | undefined {
  return findBackupDatabase(
    payload,
    databaseName,
  )?.tables.find(
    table =>
      table.name === tableName,
  );
}

function extractNestedCustomerRelations(
  localStorageValues:
    Record<string, string>,
): {
  customerIds: Set<string>;
  roomToCustomer:
    Map<string, string>;
  openingToRoom:
    Map<string, string>;
} {
  const customerIds =
    new Set<string>();

  const roomToCustomer =
    new Map<string, string>();

  const openingToRoom =
    new Map<string, string>();

  const raw =
    localStorageValues[
      "ceylin_customers_backup"
    ];

  if (!raw) {
    return {
      customerIds,
      roomToCustomer,
      openingToRoom,
    };
  }

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(raw);
  } catch {
    throw new Error(
      "Cari ilişki yedeği geçersiz JSON içeriyor.",
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Cari ilişki yedeği dizi değil.",
    );
  }

  for (const customer of parsed) {
    if (
      !isPlainObject(customer) ||
      typeof customer.id !== "string"
    ) {
      continue;
    }

    customerIds.add(
      customer.id,
    );

    const rooms =
      Array.isArray(customer.rooms)
        ? customer.rooms
        : [];

    for (const room of rooms) {
      if (
        !isPlainObject(room) ||
        typeof room.id !== "string"
      ) {
        continue;
      }

      roomToCustomer.set(
        room.id,
        customer.id,
      );

      const windows =
        Array.isArray(room.windows)
          ? room.windows
          : [];

      for (const opening of windows) {
        if (
          !isPlainObject(opening) ||
          typeof opening.id !==
            "string"
        ) {
          continue;
        }

        openingToRoom.set(
          opening.id,
          room.id,
        );
      }
    }
  }

  return {
    customerIds,
    roomToCustomer,
    openingToRoom,
  };
}

function validateMeasurementRelations(
  payload: FullSystemBackupPayload,
): void {
  const customerTable =
    findBackupTable(
      payload,
      "CeylinLocalCustomerDb",
      "customers",
    );

  const measurementTable =
    findBackupTable(
      payload,
      "CeylinLocalMeasurementDb",
      "measurements",
    );

  if (
    !customerTable ||
    !measurementTable
  ) {
    throw new Error(
      "Cari veya ölçü tablosu yedekte bulunamadı.",
    );
  }

  const customerIds =
    new Set<string>();

  const roomToCustomer =
    new Map<string, string>();

  const openingToRoom =
    new Map<string, string>();

  for (
    const customer of
    customerTable.rows
  ) {
    if (
      !isPlainObject(customer) ||
      typeof customer.id !== "string"
    ) {
      throw new Error(
        "Geçersiz cari kaydı bulundu.",
      );
    }

    customerIds.add(customer.id);

    const rooms =
      Array.isArray(customer.rooms)
        ? customer.rooms
        : [];

    for (const room of rooms) {
      if (
        !isPlainObject(room) ||
        typeof room.id !== "string"
      ) {
        throw new Error(
          "Geçersiz oda kaydı bulundu.",
        );
      }

      roomToCustomer.set(
        room.id,
        customer.id,
      );

      const openings =
        Array.isArray(room.windows)
          ? room.windows
          : [];

      for (
        const opening of openings
      ) {
        if (
          !isPlainObject(opening) ||
          typeof opening.id !==
            "string"
        ) {
          throw new Error(
            "Geçersiz açıklık kaydı bulundu.",
          );
        }

        openingToRoom.set(
          opening.id,
          room.id,
        );
      }
    }
  }

  if (
    customerIds.size === 0 &&
    measurementTable.rows.length > 0
  ) {
    const legacyRelations =
      extractNestedCustomerRelations(
        payload.localStorage,
      );

    for (
      const id of
      legacyRelations.customerIds
    ) {
      customerIds.add(id);
    }

    for (
      const [
        roomId,
        customerId,
      ] of legacyRelations.roomToCustomer
    ) {
      roomToCustomer.set(
        roomId,
        customerId,
      );
    }

    for (
      const [
        openingId,
        roomId,
      ] of legacyRelations.openingToRoom
    ) {
      openingToRoom.set(
        openingId,
        roomId,
      );
    }
  }

  const measurementIds =
    new Set<string>();

  for (
    const measurement of
    measurementTable.rows
  ) {
    if (
      !isPlainObject(measurement) ||
      typeof measurement.id !==
        "string" ||
      typeof measurement.customerId !==
        "string" ||
      typeof measurement.roomId !==
        "string" ||
      typeof measurement.openingId !==
        "string"
    ) {
      throw new Error(
        "Kimlik bağlantıları eksik ölçü bulundu.",
      );
    }

    if (
      measurementIds.has(
        measurement.id,
      )
    ) {
      throw new Error(
        `Mükerrer ölçü kimliği bulundu: ${measurement.id}`,
      );
    }

    measurementIds.add(
      measurement.id,
    );

    if (
      !customerIds.has(
        measurement.customerId,
      )
    ) {
      throw new Error(
        `Ölçünün carisi bulunamadı: ${measurement.id}`,
      );
    }

    const expectedCustomerId =
      roomToCustomer.get(
        measurement.roomId,
      );

    if (
      expectedCustomerId !==
      measurement.customerId
    ) {
      throw new Error(
        `Ölçünün oda–cari bağlantısı uyuşmuyor: ${measurement.id}`,
      );
    }

    const expectedRoomId =
      openingToRoom.get(
        measurement.openingId,
      );

    if (
      expectedRoomId !==
      measurement.roomId
    ) {
      throw new Error(
        `Ölçünün açıklık–oda bağlantısı uyuşmuyor: ${measurement.id}`,
      );
    }
  }
}

async function verifyRestoredState(
  payload:
    FullSystemBackupPayload,
): Promise<void> {
  for (
    const databaseBackup of
    payload.indexedDb
  ) {
    const database =
      databaseMap().get(
        databaseBackup.name,
      );

    if (!database) {
      throw new Error(
        `Restore doğrulamasında veritabanı bulunamadı: ${databaseBackup.name}`,
      );
    }

    await database.open();

    for (
      const tableBackup of
      databaseBackup.tables
    ) {
      const actualCount =
        await database
          .table(
            tableBackup.name,
          )
          .count();

      if (
        actualCount !==
        tableBackup.rowCount
      ) {
        throw new Error(
          `Restore sonrası kayıt sayısı uyuşmuyor: ${databaseBackup.name}.${tableBackup.name}; beklenen ${tableBackup.rowCount}, bulunan ${actualCount}`,
        );
      }
    }
  }

  const measurementTable =
    databaseMap()
      .get(
        "CeylinLocalMeasurementDb",
      )
      ?.table("measurements");

  const customerTable =
    databaseMap()
      .get(
        "CeylinLocalCustomerDb",
      )
      ?.table("customers");

  if (
    measurementTable &&
    customerTable
  ) {
    const measurements =
      await measurementTable.toArray();

    const customers =
      await customerTable.toArray();

    const validationPayload:
      FullSystemBackupPayload = {
        ...payload,
        indexedDb:
          payload.indexedDb.map(
            database => {
              if (
                database.name ===
                "CeylinLocalCustomerDb"
              ) {
                return {
                  ...database,
                  tables:
                    database.tables.map(
                      table =>
                        table.name ===
                        "customers"
                          ? {
                              ...table,
                              rowCount:
                                customers.length,
                              rows:
                                customers,
                            }
                          : table,
                    ),
                };
              }

              if (
                database.name ===
                "CeylinLocalMeasurementDb"
              ) {
                return {
                  ...database,
                  tables:
                    database.tables.map(
                      table =>
                        table.name ===
                        "measurements"
                          ? {
                              ...table,
                              rowCount:
                                measurements.length,
                              rows:
                                measurements,
                            }
                          : table,
                    ),
                };
              }

              return database;
            },
          ),
      };

    validateMeasurementRelations(
      validationPayload,
    );
  }

  const authRaw =
    localStorage.getItem(
      "curtain-erp-auth-v1",
    );

  if (authRaw) {
    const lowered =
      authRaw.toLowerCase();

    if (
      lowered.includes(
        "sessiontoken",
      ) ||
      lowered.includes(
        "sessionexpiresat",
      ) ||
      lowered.includes(
        '"rememberme":true',
      )
    ) {
      throw new Error(
        "Restore sonrası oturum güvenlik alanları temizlenmedi.",
      );
    }
  }
}

async function applyBackup(
  payload:
    FullSystemBackupPayload,
): Promise<RestoreResult> {
  let restoredTableCount = 0;
  let restoredIndexedDbRowCount = 0;

  for (
    const databaseBackup of
    payload.indexedDb
  ) {
    const result =
      await restoreDatabase(
        databaseBackup,
      );

    restoredTableCount +=
      result.tableCount;

    restoredIndexedDbRowCount +=
      result.rowCount;
  }

  const currentKeys:
    string[] = [];

  for (
    let index = 0;
    index < localStorage.length;
    index++
  ) {
    const key =
      localStorage.key(index);

    if (
      key &&
      !SENSITIVE_KEY_PATTERN.test(key)
    ) {
      currentKeys.push(key);
    }
  }

  for (
    const key of currentKeys
  ) {
    localStorage.removeItem(key);
  }

  for (
    const [
      key,
      value,
    ] of Object.entries(
      payload.localStorage,
    )
  ) {
    localStorage.setItem(
      key,
      value,
    );
  }

  return {
    restoredDatabaseCount:
      payload.indexedDb.length,
    restoredTableCount,
    restoredIndexedDbRowCount,
    restoredLocalStorageKeyCount:
      Object.keys(
        payload.localStorage,
      ).length,
  };
}

export async function restoreFullSystemBackup(
  rawPayload: unknown,
): Promise<RestoreResult> {
  assertBrowser();

  const payload =
    await validateFullSystemBackup(
      rawPayload,
    );

  validateMeasurementRelations(
    payload,
  );

  const safetySnapshot =
    await createFullSystemBackup();

  try {
    const result =
      await applyBackup(
        payload,
      );

    await verifyRestoredState(
      payload,
    );

    return result;
  } catch (restoreError) {
    try {
      await applyBackup(
        safetySnapshot,
      );
    } catch (rollbackError) {
      console.error(
        "[FullSystemBackup] Restore and rollback both failed.",
        rollbackError,
      );

      throw new Error(
        "Geri yükleme başarısız oldu ve güvenlik geri dönüşü de tamamlanamadı. Uygulamayı kapatın ve yeni işlem yapmayın.",
      );
    }

    throw new Error(
      restoreError instanceof Error
        ? `Geri yükleme başarısız oldu; eski veriler geri kondu: ${restoreError.message}`
        : "Geri yükleme başarısız oldu; eski veriler geri kondu.",
    );
  }
}

export function downloadFullSystemBackup(
  payload:
    FullSystemBackupPayload,
): void {
  assertBrowser();

  const blob =
    new Blob(
      [
        JSON.stringify(
          payload,
          null,
          2,
        ),
      ],
      {
        type:
          "application/json;charset=utf-8",
      },
    );

  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  const datePart =
    new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

  anchor.href = url;
  anchor.download =
    `ceylin-erp-tam-sistem-yedek-${datePart}.json`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(
    () =>
      URL.revokeObjectURL(url),
    0,
  );
}