import React, { useEffect, useState } from 'react';
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

type ProductOptions = {
  systemType?: 'SINGLE' | 'DOUBLE';
  tulleStyle?: 'PLEATED' | 'CROSSOVER' | 'REGISTER';
  pleatType?: 'TIGHT' | 'NORMAL' | 'SPARSE' | 'AMERICAN' | 'CUSTOM';
  customPleatFactor?: number;
  openingType?: 'SINGLE' | 'DOUBLE';
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

export function RoomPreparationModal({
  isOpen,
  onClose,
  room,
  measurements,
  onSave
}: RoomPreparationModalProps) {
  const [localSelections, setLocalSelections] =
    useState<Record<string, string[]>>({});

  const [localOptions, setLocalOptions] =
    useState<Record<string, ProductOptions>>({});

  const [isSaving, setIsSaving] = useState(false);

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

    setLocalSelections(initialSelections);
    setLocalOptions(initialOptions);
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

  const renderProductOptions = (
    measurementId: string,
    productType: string
  ) => {
    const options =
      localOptions[optionKey(measurementId, productType)] ||
      defaultOptions(productType);

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
    try {
      setIsSaving(true);

      const updatedList: MeasurementRecord[] =
        roomMeasurements.map(measurement => {
          const requestedTypes =
            localSelections[measurement.id] || [];

          const selectedTypes =
            measurement.templateType === 'PLICELL'
              ? requestedTypes.filter(
                  productType => productType === 'PLICELL'
                )
              : requestedTypes.filter(
                  productType => productType !== 'PLICELL'
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

                    <h4 className="font-bold text-white">
                      Ham Ölçü:{' '}
                      <span className="font-normal text-slate-300">
                        {getTemplateLabel(
                          measurement.templateType
                        )}
                      </span>
                    </h4>
                  </div>

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
                              measurement.id,
                              option.type
                            )}
                        </div>
                      );
                    })}
                  </div>
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

          <button
            type="button"
            onClick={() => handleSaveClick(true)}
            disabled={isSaving}
            className="cursor-pointer rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Kaydet ve Satışa Aktar
          </button>
        </div>
      </div>
    </div>
  );
}