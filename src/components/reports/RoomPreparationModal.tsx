import React, { useEffect, useState } from 'react';
import { normalizeRole, useAuthStore } from "@/store/useAuthStore";
import { X, Save, AlertCircle, Sparkles } from 'lucide-react';
import { Room, SelectedProductItem } from '@/store/useStore';
import { MeasurementRecord } from '@/store/measurementStore';
import {
  getTemplateLabel,
  resolveMeasurementProductType
} from '@/lib/measurementAdapter';

interface RoomPreparationModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  customerId: string;
  measurements: MeasurementRecord[];
  onSave: (
    updated: MeasurementRecord[],
    transferToSale: boolean
  ) => Promise<void>;
}

type HeightMode = 'AUTO' | 'MEASUREMENT' | 'CUSTOM';

type ProductPartHeightOverride = {
  mode?: HeightMode;
  source?: string;
  customHeightCm?: number;
};

type ProductOptions = {
  systemType?: 'SINGLE' | 'DOUBLE';
  tulleStyle?: 'PLEATED' | 'CROSSOVER' | 'REGISTER';
  pleatType?: 'TIGHT' | 'NORMAL' | 'SPARSE' | 'AMERICAN' | 'CUSTOM';
  customPleatFactor?: number;
  openingType?: 'SINGLE' | 'DOUBLE';

  doorFonRequested?: boolean;
  wingQuantity?: 1 | 2;
  fonPlacement?: 'LEFT' | 'BOTH';

  heightMode?: HeightMode;
  heightSource?: string;
  customHeightCm?: number;

  partHeightOverrides?: Record<
    string,
    ProductPartHeightOverride
  >;

  groups?: Array<{
    generatedItemId?: string;
    groupType?: string;
    realWidthCm?: number;
    realHeightCm?: number;
  }>;
};
const PRODUCT_TYPES_OPTIONS = [
  { type: 'TUL', label: 'Tül' },
  { type: 'GUNESLIK', label: 'Güneşlik' },
  { type: 'FON', label: 'Fon' },
  { type: 'RUSTIK', label: 'Rustik' },
  { type: 'TAVAN_RUSTIK', label: 'Tavan Rustik' },
  { type: 'STOR', label: 'Stor' },
  { type: 'ZEBRA', label: 'Zebra' },
  { type: 'DIKEY_STOR', label: 'Dikey Stor' },
  { type: 'DIKEY_TUL', label: 'Dikey Tül' },
  { type: 'AHSAP_JALUZI', label: 'Ahşap Jaluzi' },
  { type: 'JALUZI', label: 'Metal Jaluzi' },
  { type: 'PICASSO', label: 'Picasso' },
  { type: 'PLICELL', label: 'Plicell' },
  { type: 'BIRIZ', label: 'Biriz' }
];

function optionKey(measurementId: string, productType: string): string {
  return `${measurementId}:${productType}`;
}

function defaultOptions(productType: string): ProductOptions {
  if (productType === 'STOR' || productType === 'PLICELL') {
    return { systemType: 'SINGLE' };
  }

  if (productType === 'TUL') {
    return {
      tulleStyle: 'PLEATED',
      pleatType: 'TIGHT'
    };
  }

  if (
    productType === 'DIKEY_STOR' ||
    productType === 'DIKEY_TUL'
  ) {
    return { openingType: 'SINGLE' };
  }

  return {};
}

function measurementContainsDoor(
  measurement: MeasurementRecord,
  room: Room
): boolean {
  /*
   * Kapıya Fon sorusu yalnız bağımsız kapı açıklığında sorulur.
   * Camlarla aynı cephe içinde bulunan KAPI segmenti ayrı açıklık değildir.
   */
  const openingId =
    measurement.openingId ||
    measurement.windowId ||
    '';

  const opening = room.windows?.find(
    window => window.id === openingId
  );

  const openingIdentity = String(
    opening?.name ||
    measurement.openingName ||
    measurement.openingLabel ||
    measurement.windowName ||
    ''
  )
    .trim()
    .toLocaleUpperCase('tr-TR');

  return (
    openingIdentity.includes('KAPI') ||
    openingIdentity.includes('DOOR')
  );
}

export function RoomPreparationModal({
  isOpen,
  onClose,
  room,
  measurements,
  onSave
}: RoomPreparationModalProps) {
  const currentUser = useAuthStore(state => state.currentUser);
  const normalizedRole = normalizeRole(currentUser?.role);
  const canTransferToSale =
    normalizedRole === 'ADMIN' ||
    normalizedRole === 'OFFICE' ||
    normalizedRole === 'MODERATOR';
  const [localSelections, setLocalSelections] =
    useState<Record<string, string[]>>({});

  const [localOptions, setLocalOptions] =
    useState<Record<string, ProductOptions>>({});

  const [isSaving, setIsSaving] = useState(false);

  const [activeTabs, setActiveTabs] =
    useState<Record<string, 'PRODUCTS' | 'HEIGHTS'>>({});

  useEffect(() => {
    if (!isOpen) return;

    const initialSelections: Record<string, string[]> = {};
    const initialOptions: Record<string, ProductOptions> = {};

    const roomMeasurements = measurements.filter(
      measurement =>
        measurement.roomId === room.id &&
        !measurement.isDeleted
    );

    roomMeasurements.forEach(measurement => {
      const activeProducts =
        measurement.selectedProducts?.filter(product => {
          if (!product.isActive) return false;

          if (measurement.templateType === 'PLICELL') {
            return product.productType === 'PLICELL';
          }

          return product.productType !== 'PLICELL';
        }) || [];

      if (activeProducts.length > 0) {
        initialSelections[measurement.id] =
          activeProducts.map(product => product.productType);

        activeProducts.forEach(product => {
          const overrides =
            (product.userOverrides || {}) as ProductOptions;

          const calculation =
            (product.calculation || {}) as ProductOptions;

          initialOptions[
            optionKey(measurement.id, product.productType)
          ] = {
            ...defaultOptions(product.productType),
            ...calculation,
            ...overrides
          };
        });
      } else {
        const fallbackType =
          resolveMeasurementProductType(measurement);

        initialSelections[measurement.id] =
          fallbackType ? [fallbackType] : [];

        if (fallbackType) {
          initialOptions[
            optionKey(measurement.id, fallbackType)
          ] = defaultOptions(fallbackType);
        }
      }
    });

    const frameId = window.requestAnimationFrame(() => {
      setLocalSelections(initialSelections);
      setLocalOptions(initialOptions);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isOpen, room.id, measurements]);

  if (!isOpen) return null;

  const roomMeasurements = measurements.filter(
    measurement =>
      measurement.roomId === room.id &&
      !measurement.isDeleted
  );

  const updateOptions = (
    measurementId: string,
    productType: string,
    patch: Partial<ProductOptions>
  ) => {
    const key = optionKey(measurementId, productType);

    setLocalOptions(previous => ({
      ...previous,
      [key]: {
        ...defaultOptions(productType),
        ...(previous[key] || {}),
        ...patch
      }
    }));
  };

  const handleToggle = (
    measurementId: string,
    productType: string
  ) => {
    const current =
      localSelections[measurementId] || [];

    const updated = current.includes(productType)
      ? current.filter(type => type !== productType)
      : [...current, productType];

    setLocalSelections(previous => ({
      ...previous,
      [measurementId]: updated
    }));

    if (!current.includes(productType)) {
      const key = optionKey(measurementId, productType);

      setLocalOptions(previous => ({
        ...previous,
        [key]: {
          ...defaultOptions(productType),
          ...(previous[key] || {})
        }
      }));
    }
  };

  const getHeightSources = (measurement: MeasurementRecord) => {
    const raw = measurement.rawValues || {};

    const candidates = [
      {
        key: 'solYukseklikCm',
        label: 'Sol Boy',
        value: Number(raw.solYukseklikCm || 0)
      },
      {
        key: 'ortaYukseklikCm',
        label: 'Orta Boy',
        value: Number(raw.ortaYukseklikCm || 0)
      },
      {
        key: 'sagYukseklikCm',
        label: 'Sağ Boy',
        value: Number(raw.sagYukseklikCm || 0)
      },
      {
        key: 'kaloriferMermerBoyuCm',
        label: 'Kalorifer / Mermer Boyu',
        value: Number(raw.kaloriferMermerBoyuCm || 0)
      },
      {
        key: 'camIciCm',
        label: 'Cam İçi Boyu',
        value: Number(raw.camIciCm || 0)
      },
      {
        key: 'windowHeight',
        label: 'Cam Boyu',
        value: Number(raw.windowHeight || 0)
      },
      {
        key: 'height',
        label: 'Kayıtlı Boy',
        value: Number(raw.height || 0)
      },
      {
        key: 'boy',
        label: 'Ölçü Boyu',
        value: Number(raw.boy || 0)
      }
    ];

    const unique = new Map<string, {
      key: string;
      label: string;
      value: number;
    }>();

    candidates.forEach(candidate => {
      if (
        Number.isFinite(candidate.value) &&
        candidate.value > 0
      ) {
        unique.set(
          `${candidate.key}:${candidate.value}`,
          candidate
        );
      }
    });

    return Array.from(unique.values());
  };

  const updatePartHeightOverride = (
    measurementId: string,
    productType: string,
    partKey: string,
    patch: Partial<ProductPartHeightOverride>
  ) => {
    const key = optionKey(measurementId, productType);

    setLocalOptions(previous => {
      const current = {
        ...defaultOptions(productType),
        ...(previous[key] || {})
      };

      return {
        ...previous,
        [key]: {
          ...current,
          partHeightOverrides: {
            ...(current.partHeightOverrides || {}),
            [partKey]: {
              ...(current.partHeightOverrides?.[partKey] || {}),
              ...patch
            }
          }
        }
      };
    });
  };

  const renderHeightEditor = (
    measurement: MeasurementRecord,
    productType: string
  ) => {
    const key = optionKey(measurement.id, productType);

    const options =
      localOptions[key] ||
      defaultOptions(productType);

    const heightSources =
      getHeightSources(measurement);

    const existingProduct =
      measurement.selectedProducts?.find(
        product =>
          product.productType === productType
      );

    const calculationGroups =
      Array.isArray(existingProduct?.calculation?.groups)
        ? existingProduct?.calculation?.groups
        : Array.isArray(options.groups)
          ? options.groups
          : [];

    const parts: Array<{
      key: string;
      label: string;
      width: number;
      normalHeight: number;
    }> =
      calculationGroups.length > 0
        ? calculationGroups.map(
            (group: any, index: number) => ({
              key:
                String(
                  group.generatedItemId ||
                  `${productType}-${index}`
                ),
              label: `Parça ${index + 1}`,
              width: Number(
                group.realWidthCm || 0
              ),
              normalHeight: Number(
                group.realHeightCm || 0
              )
            })
          )
        : [];

    const renderModeFields = (
      mode: HeightMode,
      source: string | undefined,
      customHeightCm: number | undefined,
      onPatch: (
        patch: Partial<ProductPartHeightOverride>
      ) => void,
      namePrefix: string
    ) => (
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 p-2 text-[11px]">
          <input
            type="radio"
            name={`${namePrefix}-height-mode`}
            checked={mode === 'AUTO'}
            onChange={() =>
              onPatch({
                mode: 'AUTO',
                source: undefined,
                customHeightCm: undefined
              })
            }
          />
          Normal Boy
        </label>

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 p-2 text-[11px]">
          <input
            type="radio"
            name={`${namePrefix}-height-mode`}
            checked={mode === 'MEASUREMENT'}
            onChange={() =>
              onPatch({
                mode: 'MEASUREMENT'
              })
            }
          />
          Ölçüden Ata
        </label>

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 p-2 text-[11px]">
          <input
            type="radio"
            name={`${namePrefix}-height-mode`}
            checked={mode === 'CUSTOM'}
            onChange={() =>
              onPatch({
                mode: 'CUSTOM'
              })
            }
          />
          Özel Boy
        </label>

        {mode === 'MEASUREMENT' && (
          <select
            value={source || ''}
            onChange={event =>
              onPatch({
                source: event.target.value
              })
            }
            className="sm:col-span-3 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"
          >
            <option value="">
              Boy ölçüsü seç
            </option>

            {heightSources.map(item => (
              <option
                key={`${item.key}-${item.value}`}
                value={item.key}
              >
                {item.label}: {item.value} cm
              </option>
            ))}
          </select>
        )}

        {mode === 'CUSTOM' && (
          <div className="sm:col-span-3">
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
              Özel Boy (cm)
            </label>

            <input
              type="number"
              min="1"
              step="1"
              value={customHeightCm || ''}
              onChange={event =>
                onPatch({
                  customHeightCm:
                    Number(event.target.value || 0)
                })
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"
            />
          </div>
        )}
      </div>
    );

    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h5 className="text-sm font-black text-white">
              {
                PRODUCT_TYPES_OPTIONS.find(
                  option =>
                    option.type === productType
                )?.label || productType
              }
            </h5>

            <p className="text-[10px] text-slate-400">
              Boş bırakılırsa normal otomatik boy kullanılır.
            </p>
          </div>

          <span className="rounded bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-300">
            Ürün Boyu
          </span>
        </div>

        {renderModeFields(
          options.heightMode || 'AUTO',
          options.heightSource,
          options.customHeightCm,
          patch =>
            updateOptions(
              measurement.id,
              productType,
              {
                heightMode:
                  patch.mode ||
                  options.heightMode ||
                  'AUTO',
                heightSource:
                  patch.source,
                customHeightCm:
                  patch.customHeightCm
              }
            ),
          `${measurement.id}-${productType}-product`
        )}

        {parts.length > 0 && (
          <div className="mt-4 space-y-3 border-t border-slate-800 pt-3">
            <div>
              <h6 className="text-[11px] font-black uppercase text-amber-300">
                Parça Bazlı Boylar
              </h6>
              <p className="text-[10px] text-slate-500">
                Parçada seçim yapılmazsa ürün boyu kullanılır.
              </p>
            </div>

            {parts.map(part => {
              const partOverride =
                options.partHeightOverrides?.[
                  part.key
                ] || {};

              return (
                <div
                  key={part.key}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">
                      {part.label}
                    </span>

                    <span className="text-[10px] text-slate-400">
                      {part.width > 0
                        ? `${part.width} cm en`
                        : ''}
                      {part.normalHeight > 0
                        ? ` · Normal ${part.normalHeight} cm`
                        : ''}
                    </span>
                  </div>

                  {renderModeFields(
                    partOverride.mode || 'AUTO',
                    partOverride.source,
                    partOverride.customHeightCm,
                    patch =>
                      updatePartHeightOverride(
                        measurement.id,
                        productType,
                        part.key,
                        patch
                      ),
                    `${measurement.id}-${productType}-${part.key}`
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderProductOptions = (
    measurement: MeasurementRecord,
    productType: string
  ) => {
    const measurementId = measurement.id;

    const options =
      localOptions[optionKey(measurementId, productType)] ||
      defaultOptions(productType);

    const hasDoor =
      measurementContainsDoor(
        measurement,
        room
      );

    if (
      productType === 'FON' &&
      hasDoor
    ) {
      const doorFonRequested =
        options.doorFonRequested;

      const wingQuantity =
        options.wingQuantity === 2
          ? 2
          : 1;

      return (
        <div className="mt-3 space-y-3 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-amber-300">
              Kapıya fon perde istiyor musunuz?
            </label>

            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name={`${measurementId}-${productType}-door-fon`}
                  checked={doorFonRequested === false}
                  onChange={() =>
                    updateOptions(
                      measurementId,
                      productType,
                      {
                        doorFonRequested: false,
                        wingQuantity: undefined,
                        fonPlacement: undefined
                      }
                    )
                  }
                />
                Hayır
              </label>

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name={`${measurementId}-${productType}-door-fon`}
                  checked={doorFonRequested === true}
                  onChange={() =>
                    updateOptions(
                      measurementId,
                      productType,
                      {
                        doorFonRequested: true,
                        wingQuantity: 1,
                        fonPlacement: 'LEFT'
                      }
                    )
                  }
                />
                Evet
              </label>
            </div>
          </div>

          {doorFonRequested === true && (
            <div className="border-t border-amber-500/20 pt-3">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-amber-300">
                Kaç Fon Kanadı?
              </label>

              <div className="flex flex-wrap gap-4 text-xs">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name={`${measurementId}-${productType}-wing`}
                    checked={wingQuantity === 1}
                    onChange={() =>
                      updateOptions(
                        measurementId,
                        productType,
                        {
                          doorFonRequested: true,
                          wingQuantity: 1,
                          fonPlacement: 'LEFT'
                        }
                      )
                    }
                  />
                  1 Kanat — Sol Taraf
                </label>

                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name={`${measurementId}-${productType}-wing`}
                    checked={wingQuantity === 2}
                    onChange={() =>
                      updateOptions(
                        measurementId,
                        productType,
                        {
                          doorFonRequested: true,
                          wingQuantity: 2,
                          fonPlacement: 'BOTH'
                        }
                      )
                    }
                  />
                  2 Kanat — Sol ve Sağ
                </label>
              </div>

              <p className="mt-2 text-[11px] text-amber-200">
                Kumaş miktarı yalnız KASA A.Ş. tarafından hesaplanır.
              </p>
            </div>
          )}
        </div>
      );
    }

    if (productType === 'STOR' || productType === 'PLICELL') {
      return (
        <div className="mt-3 rounded-lg border border-blue-500/20 bg-slate-950/60 p-3">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Sistem Tipi
          </label>

          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name={`${measurementId}-${productType}-system`}
                checked={options.systemType !== 'DOUBLE'}
                onChange={() =>
                  updateOptions(measurementId, productType, {
                    systemType: 'SINGLE'
                  })
                }
              />
              Tek Sistem
            </label>

            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name={`${measurementId}-${productType}-system`}
                checked={options.systemType === 'DOUBLE'}
                onChange={() =>
                  updateOptions(measurementId, productType, {
                    systemType: 'DOUBLE'
                  })
                }
              />
              Çiftli Sistem
            </label>
          </div>

          {productType === 'STOR' &&
            options.systemType === 'DOUBLE' && (
              <p className="mt-2 text-[11px] text-emerald-400">
                Satışta iki ayrı kalem oluşur: Stor Tül + Stor.
              </p>
            )}

          {productType === 'PLICELL' &&
            options.systemType === 'DOUBLE' && (
              <p className="mt-2 text-[11px] text-emerald-400">
                Aynı ölçü iki Plicell katmanı olarak hesaplanır.
              </p>
            )}
        </div>
      );
    }

    if (productType === 'TUL') {
      return (
        <div className="mt-3 space-y-3 rounded-lg border border-blue-500/20 bg-slate-950/60 p-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Tül Modeli
            </label>

            <select
              value={options.tulleStyle || 'PLEATED'}
              onChange={event =>
                updateOptions(measurementId, productType, {
                  tulleStyle: event.target.value as
                    ProductOptions['tulleStyle']
                })
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"
            >
              <option value="PLEATED">Pileli</option>
              <option value="CROSSOVER">Kruvaze (+1 metre)</option>
              <option value="REGISTER">Register (×3,65)</option>
            </select>
          </div>

          {options.tulleStyle === 'PLEATED' && (
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Pile Tipi
              </label>

              <select
                value={options.pleatType || 'TIGHT'}
                onChange={event =>
                  updateOptions(measurementId, productType, {
                    pleatType: event.target.value as
                      ProductOptions['pleatType']
                  })
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"
              >
                <option value="TIGHT">Sık Pile — 3,1</option>
                <option value="NORMAL">Normal Pile — 2,6</option>
                <option value="SPARSE">Seyrek Pile — 2,1</option>
                <option value="AMERICAN">Amerikan — 3,1</option>
                <option value="CUSTOM">Kullanıcı Tanımlı</option>
              </select>
            </div>
          )}

          {options.tulleStyle === 'PLEATED' &&
            options.pleatType === 'CUSTOM' && (
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Özel Pile Katsayısı
                </label>

                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={options.customPleatFactor || ''}
                  onChange={event =>
                    updateOptions(measurementId, productType, {
                      customPleatFactor:
                        Number(event.target.value || 0)
                    })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"
                />
              </div>
            )}
        </div>
      );
    }

    if (
      productType === 'DIKEY_STOR' ||
      productType === 'DIKEY_TUL'
    ) {
      return (
        <div className="mt-3 rounded-lg border border-blue-500/20 bg-slate-950/60 p-3">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Açılım Tipi
          </label>

          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name={`${measurementId}-${productType}-opening`}
                checked={options.openingType !== 'DOUBLE'}
                onChange={() =>
                  updateOptions(measurementId, productType, {
                    openingType: 'SINGLE'
                  })
                }
              />
              Tek Açılır
            </label>

            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name={`${measurementId}-${productType}-opening`}
                checked={options.openingType === 'DOUBLE'}
                onChange={() =>
                  updateOptions(measurementId, productType, {
                    openingType: 'DOUBLE'
                  })
                }
              />
              Çift Açılır
            </label>
          </div>
        </div>
      );
    }

    return null;
  };

  const handleSaveClick = async (
    transferToSale: boolean
  ) => {
    if (transferToSale && !canTransferToSale) {
      alert(
        'Bu kullanıcı rolünün satışa aktarma yetkisi bulunmuyor.'
      );
      return;
    }

    const invalidDoorFonMeasurement =
      roomMeasurements.find(measurement => {
        const selectedTypes =
          localSelections[measurement.id] || [];

        if (
          !selectedTypes.includes('FON') ||
          !measurementContainsDoor(
            measurement,
            room
          )
        ) {
          return false;
        }

        const fonOptions =
          localOptions[
            optionKey(
              measurement.id,
              'FON'
            )
          ] || defaultOptions('FON');

        return (
          fonOptions.doorFonRequested !== true &&
          fonOptions.doorFonRequested !== false
        );
      });

    if (invalidDoorFonMeasurement) {
      alert(
        'Kapılı açıklıkta Fon için Evet veya Hayır seçimi yapın.'
      );
      return;
    }

    try {
      setIsSaving(true);

      const updatedList: MeasurementRecord[] =
        roomMeasurements.map(measurement => {
          const requestedTypes =
            localSelections[measurement.id] || [];

          const baseSelectedTypes =
            measurement.templateType === 'PLICELL'
              ? requestedTypes.filter(
                  productType => productType === 'PLICELL'
                )
              : requestedTypes.filter(
                  productType => productType !== 'PLICELL'
                );

          const fonOptions =
            localOptions[
              optionKey(
                measurement.id,
                'FON'
              )
            ] || defaultOptions('FON');

          const doorFonAllowed =
            !measurementContainsDoor(
              measurement,
              room
            ) ||
            fonOptions.doorFonRequested === true;

          const selectedTypes =
            doorFonAllowed
              ? baseSelectedTypes
              : baseSelectedTypes.filter(
                  productType =>
                    productType !== 'FON' &&
                    productType !== 'TAVAN_RUSTIK'
                );

          const newSelected: SelectedProductItem[] =
            selectedTypes.map(productType => {
              const existing =
                measurement.selectedProducts?.find(
                  product =>
                    product.productType === productType
                );

              const overrides =
                localOptions[
                  optionKey(measurement.id, productType)
                ] || defaultOptions(productType);

              return {
                productType,
                isActive: true,
                stockId: existing?.stockId,
                applicationType:
                  existing?.applicationType ||
                  (
                    productType === 'DIKEY_STOR'
                      ? 'DIKEY_STOR'
                      : productType === 'DIKEY_TUL'
                        ? 'DIKEY_TUL'
                        : undefined
                  ),
                calculation: existing?.calculation,
                userOverrides: {
                  ...(existing?.userOverrides || {}),
                  ...overrides
                },
                addedAt:
                  existing?.addedAt ||
                  new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
            });

          measurement.selectedProducts?.forEach(existing => {
            if (
              !selectedTypes.includes(existing.productType)
            ) {
              newSelected.push({
                ...existing,
                isActive: false,
                updatedAt: new Date().toISOString()
              });
            }
          });

          return {
            ...measurement,
            selectedProducts: newSelected
          };
        });

      await onSave(updatedList, transferToSale);
      onClose();
    } catch (error) {
      console.error(error);
      alert('Seçimler kaydedilirken bir hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 font-sans text-slate-100 backdrop-blur-md">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
              <Sparkles className="h-5 w-5" />
            </div>

            <div>
              <h3 className="text-xl font-black uppercase tracking-wide text-white">
                {room.name}
              </h3>
              <p className="text-xs text-slate-400">
                Satışa Hazırlık / Oda Ürün Seçimleri
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {roomMeasurements.length === 0 ? (
            <div className="space-y-2 py-12 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-slate-500" />
              <p className="font-medium text-slate-400">
                Bu odada henüz ölçü kaydı bulunmuyor.
              </p>
            </div>
          ) : (
            roomMeasurements.map(measurement => {
              const selectedTypes =
                localSelections[measurement.id] || [];

              const opening = room.windows?.find(
                window =>
                  window.id ===
                  (
                    measurement.openingId ||
                    measurement.windowId
                  )
              );

              return (
                <div
                  key={measurement.id}
                  className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-5"
                >
                  <div className="border-b border-slate-800 pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                      {opening?.name || 'Açıklık'}
                    </span>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveTabs(previous => ({
                            ...previous,
                            [measurement.id]: 'PRODUCTS'
                          }))
                        }
                        className={
                          (activeTabs[measurement.id] || 'PRODUCTS') === 'PRODUCTS'
                            ? 'rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black text-white'
                            : 'rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-400'
                        }
                      >
                        Ham Ölçü / Ürünler
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setActiveTabs(previous => ({
                            ...previous,
                            [measurement.id]: 'HEIGHTS'
                          }))
                        }
                        className={
                          activeTabs[measurement.id] === 'HEIGHTS'
                            ? 'rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-black text-white'
                            : 'rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-400'
                        }
                      >
                        Ürün Boyları
                      </button>

                      <span className="text-xs text-slate-400">
                        {getTemplateLabel(measurement.templateType)}
                      </span>
                    </div>
                  </div>

                  {(activeTabs[measurement.id] || 'PRODUCTS') === 'PRODUCTS' ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {PRODUCT_TYPES_OPTIONS
                      .filter(option =>
                        measurement.templateType === 'PLICELL'
                          ? option.type === 'PLICELL'
                          : option.type !== 'PLICELL'
                      )
                      .map(option => {
                      const checked =
                        selectedTypes.includes(option.type);

                      return (
                        <div
                          key={option.type}
                          className={
                            checked
                              ? 'rounded-lg border border-blue-500/40 bg-blue-600/10 p-3 text-blue-300'
                              : 'rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-slate-400'
                          }
                        >
                          <label className="flex cursor-pointer items-center gap-3 text-xs font-semibold">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                handleToggle(
                                  measurement.id,
                                  option.type
                                )
                              }
                              className="h-4 w-4 cursor-pointer"
                            />
                            <span>{option.label}</span>
                          </label>

                          {checked &&
                            renderProductOptions(
                              measurement,
                              option.type
                            )}
                        </div>
                      );
                    })}
                  </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedTypes.length === 0 ? (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-300">
                          Önce Ham Ölçü / Ürünler sekmesinden ürün seçin.
                        </div>
                      ) : (
                        selectedTypes.map(productType => (
                          <React.Fragment
                            key={`${measurement.id}-${productType}`}
                          >
                            {renderHeightEditor(
                              measurement,
                              productType
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-col justify-end gap-3 border-t border-slate-800 p-6 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="cursor-pointer rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700"
          >
            İptal
          </button>

          <button
            type="button"
            onClick={() => handleSaveClick(false)}
            disabled={isSaving}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>

          {canTransferToSale && (


            <button


              type="button"


              onClick={() => handleSaveClick(true)}


              disabled={isSaving}


              className="cursor-pointer rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-50"


            >


              Kaydet ve Satışa Aktar


            </button>


          )}
        </div>
      </div>
    </div>
  );
}
