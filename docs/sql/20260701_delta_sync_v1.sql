-- ==============================================================================
-- CEYLİN Ölçü ERP - Delta Sync V1 Migration
-- ==============================================================================
-- 
-- ÖNEMLİ GARANTİ KURALLARI (V1 Delta Sync Mimari Prensipleri):
-- 1. Remote Boş İse Local Silinmez: Sunucuda yeni event yoksa cihaz verisi korunur.
-- 2. Full Overwrite Yapılmaz: Veriler asla tüm state olarak ezilmez, sadece değişen (patch) alanlar apply edilir.
-- 3. Fiziksel Silme Yok: Sadece 'operation' = 'SOFT_DELETE' eventleri işletilir.
-- 4. Foto/Video Gönderilmez: Bu tablolara kesinlikle base64 veya raw binary/medya eklenmez.
-- 5. Patch Küçük Olmalıdır: `patch` JSONB alanı sadece mutasyona uğrayan anahtarları tutar.
-- 6. Conflict/Çakışma: Aynı revision içinde çakışma varsa `conflict_status` güncellenir, otomatik veri kaybı yaşatılmaz.
-- 
-- NOT: RLS (Row Level Security) taslak olarak hazırlanmıştır. Auth yapısı
-- cihaz tokenları / UUID üzerinden bağlanabilir. Güvenlik için public erişim kapatılmalıdır.
-- ==============================================================================

-- 1. devices
-- Her PC/Telefon cihazını temsil eder.
CREATE TABLE IF NOT EXISTS public.devices (
    device_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL CHECK (device_type IN ('PC', 'PHONE', 'TABLET')),
    assigned_user_id UUID, -- auth.users foreign key (opsiyonel)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_seen_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(assigned_user_id);

-- 2. customers_light
-- Büyük nested datası olmayan minimum cari kart bilgisi (Senkron aramalar için cache niteliğinde).
CREATE TABLE IF NOT EXISTS public.customers_light (
    customer_id UUID PRIMARY KEY,
    cari_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    source_device_id UUID REFERENCES public.devices(device_id),
    revision BIGINT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_customers_light_name ON public.customers_light(cari_name);
CREATE INDEX IF NOT EXISTS idx_customers_light_phone ON public.customers_light(phone);
CREATE INDEX IF NOT EXISTS idx_customers_light_updated_at ON public.customers_light(updated_at);

-- 3. measurement_jobs
-- Sahaya gönderilecek veya sahadan alınan görev/iş durumları.
CREATE TABLE IF NOT EXISTS public.measurement_jobs (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers_light(customer_id),
    assigned_device_id UUID REFERENCES public.devices(device_id),
    assigned_user_id UUID,
    status TEXT NOT NULL CHECK (status IN ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'READY_TO_TRANSFER', 'TRANSFERRED', 'APPROVED', 'CANCELLED')),
    title TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    revision BIGINT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_measurement_jobs_customer_id ON public.measurement_jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_measurement_jobs_assigned_device ON public.measurement_jobs(assigned_device_id);
CREATE INDEX IF NOT EXISTS idx_measurement_jobs_status ON public.measurement_jobs(status);

-- 4. measurement_changes
-- Ölçü, cari, oda, açıklık değişiklik eventleri (Event Sourcing).
CREATE TABLE IF NOT EXISTS public.measurement_changes (
    change_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- CUSTOMER, ROOM, OPENING, MEASUREMENT
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'SOFT_DELETE')),
    patch JSONB NOT NULL,
    device_id UUID REFERENCES public.devices(device_id),
    user_id UUID,
    revision BIGINT GENERATED ALWAYS AS IDENTITY, -- Auto-increment global sıralama için
    created_at TIMESTAMPTZ DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now(),
    conflict_status TEXT DEFAULT 'NONE' CHECK (conflict_status IN ('NONE', 'CONFLICT', 'RESOLVED')),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_measurement_changes_entity ON public.measurement_changes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_measurement_changes_device ON public.measurement_changes(device_id);
CREATE INDEX IF NOT EXISTS idx_measurement_changes_revision ON public.measurement_changes(revision);

-- 5. draft_changes
-- Yerel saha taslağı değişiklik eventleri (Saha telefonlarından gelen izole akış).
CREATE TABLE IF NOT EXISTS public.draft_changes (
    change_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'SOFT_DELETE')),
    patch JSONB NOT NULL,
    device_id UUID REFERENCES public.devices(device_id),
    user_id UUID,
    revision BIGINT GENERATED ALWAYS AS IDENTITY,
    created_at TIMESTAMPTZ DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_draft_changes_draft_id ON public.draft_changes(draft_id);
CREATE INDEX IF NOT EXISTS idx_draft_changes_device ON public.draft_changes(device_id);
CREATE INDEX IF NOT EXISTS idx_draft_changes_revision ON public.draft_changes(revision);

-- 6. sync_cursors
-- Her cihazın hangi revision'a kadar veri aldığı/gönderdiği (Pull/Push pointerları).
CREATE TABLE IF NOT EXISTS public.sync_cursors (
    device_id UUID REFERENCES public.devices(device_id),
    stream_name TEXT NOT NULL, -- örn: 'MEASUREMENT_CHANGES', 'DRAFT_CHANGES'
    last_pulled_revision BIGINT DEFAULT 0,
    last_pushed_revision BIGINT DEFAULT 0,
    last_synced_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (device_id, stream_name)
);

CREATE INDEX IF NOT EXISTS idx_sync_cursors_updated ON public.sync_cursors(updated_at);

-- 7. sync_events
-- Teknik sync audit/event logu (Kişisel veri veya detaylı JSON içermez).
CREATE TABLE IF NOT EXISTS public.sync_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(device_id),
    event_type TEXT NOT NULL, -- örn: 'SYNC_START', 'SYNC_ERROR', 'CONFLICT_DETECTED'
    status TEXT NOT NULL,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB -- Sadece teknik meta veriler (örnek: duration_ms, retry_count)
);

CREATE INDEX IF NOT EXISTS idx_sync_events_device_created ON public.sync_events(device_id, created_at);


-- ==============================================================================
-- RLS (Row Level Security) Taslağı
-- Güvenlik prensipleri gereği ileride public erişime kapatılmalıdır.
-- ==============================================================================

-- Bütün tablolar için RLS'yi aktif et (Yorum satırı olarak bırakıldı, devreye alınca açılacak)
-- ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.customers_light ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.measurement_jobs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.measurement_changes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.draft_changes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.sync_cursors ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.sync_events ENABLE ROW LEVEL SECURITY;

-- Örnek Policy: Sadece oturum açmış kullanıcılar/cihazlar yazıp okuyabilir
-- CREATE POLICY "Enable read/write for authenticated users only" ON public.measurement_changes
--   FOR ALL USING (auth.role() = 'authenticated');
